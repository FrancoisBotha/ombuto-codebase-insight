// Stage 1, Extract files (FR-005, Architecture §3). No tree-sitter yet.
//
// For the analysed commit it:
//   1. lists every tracked file with `git ls-tree -r -l -z <commit>` through
//      the safe git runner;
//   2. reads each distinct blob's content with `git cat-file --batch`, fed
//      through stdin in size-bounded batches, and stores the blob once in
//      raw_blob (size, line count, language by extension, binary flag,
//      generated/vendored flag, parse_status 'skipped', since nothing is
//      parsed in epic 1), with text content in raw_blob_content. The AFTER
//      INSERT trigger in Schema.ddl fills raw_content_fts;
//   3. writes one raw_tree_entry row per path → blob.
//
// The stage runner calls `run(ctx)` synchronously inside one transaction, so
// git is invoked through `runGitSync`. Every write is idempotent: tree entries
// for the commit are replaced wholesale, blobs are upserted by sha and content
// (immutable per sha) is inserted only when missing, so re-running for the
// same commit yields identical rows and no duplicate FTS entries.
//
// Every run is a full extract (epic 1 §3); re-using blobs already in raw_blob
// across commits is incremental extraction, which arrives in epic 14.
import { runGitSync as defaultRunGitSync } from '../../shared/git/gitRunner.js';
import { languageForPath } from '../../shared/files/languageByExtension.js';
import { countLines, isBinaryContent, isGenerated } from '../../shared/files/fileHeuristics.js';

/** Summed blob size per `cat-file --batch` call. Bounds memory on large repos. */
export const DEFAULT_BATCH_BYTES = 32 * 1024 * 1024;

/** Headroom for `cat-file --batch` headers and separators per batch. */
const BATCH_OVERHEAD_BYTES = 4 * 1024 * 1024;

/** One `cat-file --batch` call reads at most DEFAULT_BATCH_BYTES; generous even on slow disks. */
const BATCH_TIMEOUT_MS = 5 * 60 * 1000;

const SHA_RE = /^[0-9a-f]{40,64}$/;

// --- pure parsers -------------------------------------------------------------

/**
 * Parses `git ls-tree -r -l -z` output.
 * Record format: `<mode> SP <type> SP <sha> SP <size, right-justified> TAB <path> NUL`.
 * `size` is `-` for non-blobs (submodule commits) and comes back as null.
 *
 * @param {Buffer|string} output
 * @returns {Array<{mode: string, type: string, sha: string, size: number|null, path: string}>}
 */
export function parseLsTree(output) {
  const text = Buffer.isBuffer(output) ? output.toString('utf8') : String(output ?? '');
  const entries = [];
  for (const record of text.split('\0')) {
    if (record === '') continue;
    const tab = record.indexOf('\t');
    if (tab === -1) throw new Error(`extract_files: malformed ls-tree record: ${JSON.stringify(record)}`);
    const meta = record.slice(0, tab).trim().split(/\s+/);
    if (meta.length !== 4) throw new Error(`extract_files: malformed ls-tree record: ${JSON.stringify(record)}`);
    const [mode, type, sha, sizeText] = meta;
    const size = sizeText === '-' ? null : Number.parseInt(sizeText, 10);
    if (sizeText !== '-' && !Number.isFinite(size)) {
      throw new Error(`extract_files: bad size in ls-tree record: ${JSON.stringify(record)}`);
    }
    entries.push({ mode, type, sha, size, path: record.slice(tab + 1) });
  }
  return entries;
}

/**
 * Parses `git cat-file --batch` output into one object per requested name.
 * Each object is `<sha> SP <type> SP <size> LF <content> LF`, or
 * `<name> SP missing LF`. Content is sliced by the declared size, so it may
 * hold any bytes (NUL, newlines).
 *
 * @param {Buffer} output
 * @returns {Array<{sha: string, type: string, size: number|null, content: Buffer|null}>}
 */
export function parseCatFileBatch(output) {
  const buf = Buffer.isBuffer(output) ? output : Buffer.from(output ?? '');
  const objects = [];
  let pos = 0;
  while (pos < buf.length) {
    const nl = buf.indexOf(0x0a, pos);
    if (nl === -1) throw new Error('extract_files: truncated cat-file --batch output (no header line end)');
    const header = buf.toString('utf8', pos, nl).split(' ');
    pos = nl + 1;
    if (header.length === 2 && header[1] === 'missing') {
      objects.push({ sha: header[0], type: 'missing', size: null, content: null });
      continue;
    }
    if (header.length !== 3) {
      throw new Error(`extract_files: malformed cat-file --batch header: ${JSON.stringify(header.join(' '))}`);
    }
    const [sha, type, sizeText] = header;
    const size = Number.parseInt(sizeText, 10);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`extract_files: bad size in cat-file --batch header: ${JSON.stringify(header.join(' '))}`);
    }
    // Content, then the single LF git appends after every object.
    if (pos + size + 1 > buf.length) {
      throw new Error(`extract_files: truncated cat-file --batch output for ${sha} (expected ${size} bytes)`);
    }
    const content = Buffer.from(buf.subarray(pos, pos + size));
    pos += size + 1;
    objects.push({ sha, type, size, content });
  }
  return objects;
}

/**
 * Groups blobs, in order, into batches whose summed size stays within
 * `budgetBytes`. A blob larger than the budget gets a batch of its own.
 *
 * @template {{size: number|null}} T
 * @param {T[]} blobs
 * @param {number} budgetBytes
 * @returns {T[][]}
 */
export function planBatches(blobs, budgetBytes = DEFAULT_BATCH_BYTES) {
  const batches = [];
  let current = [];
  let currentBytes = 0;
  for (const blob of blobs) {
    const size = blob.size ?? 0;
    if (current.length > 0 && currentBytes + size > budgetBytes) {
      batches.push(current);
      current = [];
      currentBytes = 0;
    }
    current.push(blob);
    currentBytes += size;
  }
  if (current.length > 0) batches.push(current);
  return batches;
}

// --- the stage ----------------------------------------------------------------

/**
 * Runs the Extract files stage for `ctx.commitSha` inside the transaction the
 * stage runner opened. Returns the number of rows written (tree entries +
 * blobs + content rows).
 *
 * @param {{db: import('better-sqlite3').Database, repoPath: string, commitSha: string,
 *          progress: (p: {done?: number, total?: number, unit?: string, message?: string}) => void}} ctx
 * @param {{runGitSync?: typeof defaultRunGitSync, batchBytes?: number}} [deps]
 * @returns {number}
 */
export function runExtractFiles(ctx, deps = {}) {
  const { db, repoPath, commitSha } = ctx;
  const progress = typeof ctx.progress === 'function' ? ctx.progress : () => {};
  const runGitSync = deps.runGitSync ?? defaultRunGitSync;
  const batchBytes = deps.batchBytes ?? DEFAULT_BATCH_BYTES;
  if (!SHA_RE.test(commitSha)) throw new Error(`extract_files: commitSha must be a full object sha (got ${commitSha})`);

  const q = {
    deleteTree: db.prepare('DELETE FROM raw_tree_entry WHERE commit_sha = ?'),
    insertTree: db.prepare('INSERT INTO raw_tree_entry (commit_sha, path, blob_sha) VALUES (?, ?, ?)'),
    upsertBlob: db.prepare(`
      INSERT INTO raw_blob (blob_sha, language, size_bytes, line_count, is_binary, is_generated, parse_status, parse_error)
      VALUES (@sha, @language, @size, @lineCount, @isBinary, @isGenerated, 'skipped', NULL)
      ON CONFLICT(blob_sha) DO UPDATE SET
        language = excluded.language,
        size_bytes = excluded.size_bytes,
        line_count = excluded.line_count,
        is_binary = excluded.is_binary,
        is_generated = excluded.is_generated,
        parse_status = excluded.parse_status,
        parse_error = excluded.parse_error`),
    // Content is immutable per sha; OR IGNORE keeps the FTS index free of duplicates.
    insertContent: db.prepare('INSERT OR IGNORE INTO raw_blob_content (blob_sha, content) VALUES (?, ?)'),
  };

  // 1. Tree listing.
  progress({ done: 0, total: null, unit: 'files', message: 'Listing tracked files' });
  const { stdout } = runGitSync(['ls-tree', '-r', '-l', '-z', commitSha], { cwd: repoPath });
  const entries = parseLsTree(stdout).filter((e) => e.type === 'blob');
  const total = entries.length;
  let rows = 0;
  progress({ done: 0, total, unit: 'files', message: `Found ${total} tracked files` });

  // 2. Distinct blobs, with every path they appear at (the generated flag is
  //    per blob, so a blob counts as generated if any of its paths is).
  const blobs = new Map();
  for (const e of entries) {
    const b = blobs.get(e.sha);
    if (b) b.paths.push(e.path);
    else blobs.set(e.sha, { sha: e.sha, size: e.size ?? 0, paths: [e.path] });
  }
  for (const b of blobs.values()) b.paths.sort();
  const toFetch = [...blobs.values()];
  let done = 0;

  // 3. Content in size-bounded batches.
  for (const batch of planBatches(toFetch, batchBytes)) {
    const input = `${batch.map((b) => b.sha).join('\n')}\n`;
    const batchSize = batch.reduce((n, b) => n + b.size, 0);
    const maxBuffer = batchSize + batch.length * 128 + BATCH_OVERHEAD_BYTES;
    const result = runGitSync(['cat-file', '--batch'], { cwd: repoPath, input, maxBuffer, timeoutMs: BATCH_TIMEOUT_MS });
    const objects = new Map(parseCatFileBatch(result.stdout).map((o) => [o.sha, o]));

    for (const b of batch) {
      const obj = objects.get(b.sha);
      if (!obj || obj.type !== 'blob' || !obj.content) {
        throw new Error(`extract_files: git did not return blob ${b.sha} (${b.paths[0]})`);
      }
      const content = obj.content;
      const isBinary = isBinaryContent(content);
      // Language and generated flag come from the paths; take the first path
      // with a known language so a blob shared by foo.js and foo.txt is javascript.
      const language = isBinary ? null : b.paths.map(languageForPath).find((l) => l !== null) ?? null;
      const isGen = b.paths.some((p) => isGenerated({ path: p, content, isBinary }));

      q.upsertBlob.run({
        sha: b.sha,
        language,
        size: content.length,
        lineCount: isBinary ? 0 : countLines(content),
        isBinary: isBinary ? 1 : 0,
        isGenerated: isGen ? 1 : 0,
      });
      rows++;
      if (!isBinary) {
        // Counted whether inserted now or already present: the stage's output
        // includes this row either way, so rows_written is stable across re-runs.
        q.insertContent.run(b.sha, content.toString('utf8'));
        rows++;
      }
      done += b.paths.length;
    }
    progress({ done, total, unit: 'files', message: `Extracted ${done} of ${total} files` });
  }

  // An empty tree has no batch to report completion; say so once.
  if (toFetch.length === 0) progress({ done: total, total, unit: 'files', message: `Extracted ${total} files` });

  // 4. Tree entries for this commit, after their blobs exist (raw_tree_entry
  //    references raw_blob and foreign keys are checked immediately). Replaced
  //    wholesale so a re-run leaves exactly the same rows.
  q.deleteTree.run(commitSha);
  for (const e of entries) {
    q.insertTree.run(commitSha, e.path, e.sha);
    rows++;
  }
  return rows;
}

/** Registry entry for src/worker/stages/index.js. */
export const extractFilesStage = Object.freeze({
  id: 'extract_files',
  label: 'Extract files',
  run: (ctx) => runExtractFiles(ctx),
});

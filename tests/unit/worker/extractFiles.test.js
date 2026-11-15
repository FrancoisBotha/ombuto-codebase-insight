// Extract files stage (FR-005): tracked tree at HEAD → raw_tree_entry, one
// raw_blob per distinct blob, raw_blob_content (+ FTS via triggers) for text
// blobs. Pure parsers are tested on literal git output; the stage itself runs
// through the real stage runner against a temporary fixture git repository.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { openInsightDb, repoId } from '../../../src/shared/db/insightDb.js';
import { WORKER_MSG } from '../../../src/shared/ipcChannels.js';
import { runPipeline } from '../../../src/worker/stageRunner.js';
import { STAGES } from '../../../src/worker/stages/index.js';
import {
  extractFilesStage,
  runExtractFiles,
  parseLsTree,
  parseCatFileBatch,
  planBatches,
} from '../../../src/worker/stages/extractFiles.js';

const SHA_A = 'a'.repeat(40);
const SHA_B = 'b'.repeat(40);

// ---------------------------------------------------------------------------
// Pure parsers
// ---------------------------------------------------------------------------

describe('extractFiles · parseLsTree', () => {
  it('parses `ls-tree -r -l -z` records (mode, type, sha, padded size, tab, path, NUL)', () => {
    const out = Buffer.from(
      `100644 blob ${SHA_A}     655\t.gitattributes\0` +
        `100755 blob ${SHA_B}   11944\tsrc/with space/run.sh\0` +
        `160000 commit ${'c'.repeat(40)}       -\tvendor/submodule\0`,
    );
    const entries = parseLsTree(out);
    expect(entries).toEqual([
      { mode: '100644', type: 'blob', sha: SHA_A, size: 655, path: '.gitattributes' },
      { mode: '100755', type: 'blob', sha: SHA_B, size: 11944, path: 'src/with space/run.sh' },
      { mode: '160000', type: 'commit', sha: 'c'.repeat(40), size: null, path: 'vendor/submodule' },
    ]);
  });

  it('keeps paths with tabs or newlines intact (NUL-separated, not quoted)', () => {
    const out = Buffer.from(`100644 blob ${SHA_A}       3\tweird\tname\nhere.txt\0`);
    expect(parseLsTree(out)[0].path).toBe('weird\tname\nhere.txt');
  });

  it('returns an empty list for empty output', () => {
    expect(parseLsTree(Buffer.alloc(0))).toEqual([]);
  });
});

describe('extractFiles · parseCatFileBatch', () => {
  it('splits `cat-file --batch` output into per-object buffers using the declared sizes', () => {
    const body = Buffer.from('hello\nworld\n');
    const out = Buffer.concat([
      Buffer.from(`${SHA_A} blob ${body.length}\n`),
      body,
      Buffer.from('\n'),
      Buffer.from(`${SHA_B} blob 0\n`),
      Buffer.from('\n'),
      Buffer.from(`${'d'.repeat(40)} missing\n`),
    ]);
    const objects = parseCatFileBatch(out);
    expect(objects).toHaveLength(3);
    expect(objects[0]).toMatchObject({ sha: SHA_A, type: 'blob', size: 12 });
    expect(objects[0].content.equals(body)).toBe(true);
    expect(objects[1]).toMatchObject({ sha: SHA_B, type: 'blob', size: 0 });
    expect(objects[1].content.length).toBe(0);
    expect(objects[2]).toEqual({ sha: 'd'.repeat(40), type: 'missing', size: null, content: null });
  });

  it('does not get confused by newlines or NUL bytes inside blob content', () => {
    const body = Buffer.from([0x0a, 0x00, 0x0a, 0x61, 0x0a]);
    const out = Buffer.concat([Buffer.from(`${SHA_A} blob 5\n`), body, Buffer.from('\n')]);
    const [obj] = parseCatFileBatch(out);
    expect(obj.content.equals(body)).toBe(true);
  });

  it('throws on a truncated response', () => {
    const out = Buffer.from(`${SHA_A} blob 100\nshort\n`);
    expect(() => parseCatFileBatch(out)).toThrow(/truncated/i);
  });
});

describe('extractFiles · planBatches', () => {
  it('groups blobs into batches whose summed size stays within the budget', () => {
    const blobs = [
      { sha: 'a', size: 60 },
      { sha: 'b', size: 50 },
      { sha: 'c', size: 10 },
      { sha: 'd', size: 500 }, // larger than the budget: a batch of its own
      { sha: 'e', size: 1 },
    ];
    const batches = planBatches(blobs, 100);
    expect(batches.map((b) => b.map((x) => x.sha))).toEqual([['a'], ['b', 'c'], ['d'], ['e']]);
  });

  it('returns no batches for no blobs', () => {
    expect(planBatches([], 100)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The stage against a fixture repository
// ---------------------------------------------------------------------------

const FTS_TOKEN = 'quokkaSearchToken';

// Text content; CRLF-free so the blob is byte-identical on every platform.
const FIXTURE_FILES = {
  'src/app.js': `// app\nexport function ${FTS_TOKEN}() {\n  return 42;\n}\n`,
  'src/copy.js': `// app\nexport function ${FTS_TOKEN}() {\n  return 42;\n}\n`, // same blob as src/app.js
  'README.md': '# Fixture\n\nHello world.\n',
  'empty.txt': '',
  'no-newline.py': 'print("hi")',
  'node_modules/dep/index.js': 'module.exports = 1;\n',
  'dist/app.min.js': `${'var a=1;'.repeat(400)}\n`,
  'package-lock.json': '{\n  "lockfileVersion": 3\n}\n',
  'data/long.txt': `${'x'.repeat(2000)}\n${'y'.repeat(2000)}\n`, // long lines but not a known generated path → still generated by line length
  'Dockerfile': 'FROM scratch\n',
};
const BINARY_FILE = 'assets/logo.png';
const BINARY_BYTES = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]), Buffer.alloc(300, 0x7f)]);

async function makeFixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-extract-'));
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig('user.email', 'test@example.com');
  await git.addConfig('user.name', 'Test');
  await git.addConfig('core.autocrlf', 'false');
  for (const [rel, content] of Object.entries(FIXTURE_FILES)) {
    const abs = path.join(dir, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, content);
  }
  fs.mkdirSync(path.join(dir, path.dirname(BINARY_FILE)), { recursive: true });
  fs.writeFileSync(path.join(dir, BINARY_FILE), BINARY_BYTES);
  // -f: a global excludes file may ignore node_modules/ or dist/.
  await git.raw(['add', '-f', '--', '.']);
  await git.commit('fixture');
  const headSha = (await git.revparse(['HEAD'])).trim();
  // The authoritative list of (path → blob sha) at HEAD, for comparison.
  const lsTree = await git.raw(['ls-tree', '-r', '-z', 'HEAD']);
  const expected = new Map();
  for (const rec of lsTree.split('\0').filter(Boolean)) {
    const [meta, p] = rec.split('\t');
    expected.set(p, meta.split(' ')[2]);
  }
  return { dir, headSha, expected };
}

describe('extractFiles · stage on a fixture repository', () => {
  let fixture;
  let userDataPath;
  let db;
  let events;
  const post = (e) => events.push(e);

  beforeAll(async () => {
    fixture = await makeFixtureRepo();
  });
  afterAll(() => {
    fs.rmSync(fixture.dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-userdata-'));
    db = openInsightDb(fixture.dir, { userDataPath });
    events = [];
  });
  afterEach(() => {
    if (db.open) db.close();
    fs.rmSync(userDataPath, { recursive: true, force: true });
  });

  const startRun = () => ({ repoPath: fixture.dir, repoId: repoId(fixture.dir), headSha: fixture.headSha, branch: 'main' });
  const run = () => runPipeline({ db, stages: [extractFilesStage], post, startRun: startRun() });

  const blobOf = (p) => fixture.expected.get(p);
  const blobRow = (p) => db.prepare('SELECT * FROM raw_blob WHERE blob_sha = ?').get(blobOf(p));
  const contentRow = (p) => db.prepare('SELECT * FROM raw_blob_content WHERE blob_sha = ?').get(blobOf(p));

  it('is registered as the extract_files stage in the stage registry', () => {
    const registered = STAGES.find((s) => s.id === 'extract_files');
    expect(registered).toBeDefined();
    expect(registered.label).toBe('Extract files');
    expect(typeof registered.run).toBe('function');
    expect(extractFilesStage.id).toBe('extract_files');
    expect(typeof extractFilesStage.run).toBe('function');
  });

  it('lists every tracked file at HEAD into raw_tree_entry with its blob sha', () => {
    const result = run();
    expect(result.status).toBe('done');

    const rows = db.prepare('SELECT path, blob_sha FROM raw_tree_entry WHERE commit_sha = ? ORDER BY path').all(fixture.headSha);
    const got = new Map(rows.map((r) => [r.path, r.blob_sha]));
    expect(got.size).toBe(Object.keys(FIXTURE_FILES).length + 1);
    expect(got).toEqual(fixture.expected);
    expect(got.get('src/app.js')).toBe(got.get('src/copy.js'));
  });

  it('stores each distinct blob once in raw_blob with size, line count, language, flags and parse_status skipped', () => {
    run();
    const distinct = new Set(fixture.expected.values());
    expect(db.prepare('SELECT count(*) AS n FROM raw_blob').get().n).toBe(distinct.size);
    expect(db.prepare("SELECT count(*) AS n FROM raw_blob WHERE parse_status <> 'skipped'").get().n).toBe(0);
    expect(db.prepare('SELECT count(*) AS n FROM raw_blob WHERE parse_error IS NOT NULL').get().n).toBe(0);

    const app = blobRow('src/app.js');
    expect(app).toMatchObject({
      language: 'javascript',
      size_bytes: Buffer.byteLength(FIXTURE_FILES['src/app.js']),
      line_count: 4,
      is_binary: 0,
      is_generated: 0,
      parse_status: 'skipped',
    });
    expect(blobRow('README.md')).toMatchObject({ language: 'markdown', line_count: 3, is_binary: 0, is_generated: 0 });
    expect(blobRow('empty.txt')).toMatchObject({ language: 'text', size_bytes: 0, line_count: 0, is_binary: 0 });
    expect(blobRow('no-newline.py')).toMatchObject({ language: 'python', line_count: 1 });
    expect(blobRow('Dockerfile')).toMatchObject({ language: 'dockerfile', line_count: 1 });
  });

  it('flags binary blobs (NUL in the first chunk) and stores no content for them', () => {
    run();
    const png = blobRow(BINARY_FILE);
    expect(png).toMatchObject({ is_binary: 1, size_bytes: BINARY_BYTES.length, line_count: 0, language: null, parse_status: 'skipped' });
    expect(contentRow(BINARY_FILE)).toBeUndefined();
  });

  it('flags generated/vendored blobs by path (node_modules, dist, lockfile, .min.) and by long average line length', () => {
    run();
    expect(blobRow('node_modules/dep/index.js').is_generated).toBe(1);
    expect(blobRow('dist/app.min.js').is_generated).toBe(1);
    expect(blobRow('package-lock.json').is_generated).toBe(1);
    expect(blobRow('data/long.txt').is_generated).toBe(1);
    expect(blobRow('src/app.js').is_generated).toBe(0);
    expect(blobRow('README.md').is_generated).toBe(0);
  });

  it('stores text blob content in raw_blob_content and makes it searchable through raw_content_fts', () => {
    run();
    const textBlobs = new Set(Object.keys(FIXTURE_FILES).map(blobOf));
    expect(db.prepare('SELECT count(*) AS n FROM raw_blob_content').get().n).toBe(textBlobs.size);
    expect(contentRow('src/app.js').content).toBe(FIXTURE_FILES['src/app.js']);
    expect(contentRow('empty.txt').content).toBe('');
    expect(contentRow('no-newline.py').content).toBe('print("hi")');

    const hits = db
      .prepare(
        `SELECT c.blob_sha FROM raw_content_fts f
         JOIN raw_blob_content c ON c.rowid = f.rowid
         WHERE raw_content_fts MATCH ?`,
      )
      .all(FTS_TOKEN);
    expect(hits.map((h) => h.blob_sha)).toEqual([blobOf('src/app.js')]);
    expect(db.prepare('SELECT count(*) AS n FROM raw_content_fts WHERE raw_content_fts MATCH ?').get('nosuchtokenanywhere').n).toBe(0);
  });

  it('reports progress counts in files and completes with a rows_written total', () => {
    const result = run();
    const fileCount = fixture.expected.size;
    const progress = events.filter((e) => e.type === WORKER_MSG.STAGE_PROGRESS);
    expect(progress.length).toBeGreaterThan(1);
    for (const p of progress) expect(p).toMatchObject({ stage: 'extract_files', unit: 'files' });
    // Before the tree is listed the total is unknown (null); after that every
    // event carries the file count and a monotonically growing done count.
    const counted = progress.filter((p) => p.total !== null);
    expect(counted.length).toBeGreaterThan(0);
    let previousDone = -1;
    for (const p of counted) {
      expect(p.total).toBe(fileCount);
      expect(p.done).toBeGreaterThanOrEqual(previousDone);
      expect(p.done).toBeLessThanOrEqual(fileCount);
      previousDone = p.done;
    }
    expect(progress.at(-1)).toMatchObject({ done: fileCount, total: fileCount });

    const completed = events.find((e) => e.type === WORKER_MSG.STAGE_COMPLETED);
    const distinct = new Set(fixture.expected.values()).size;
    const textBlobs = new Set(Object.keys(FIXTURE_FILES).map(blobOf)).size;
    expect(completed.rowsWritten).toBe(fileCount + distinct + textBlobs);
    const stageRow = db.prepare("SELECT * FROM pipeline_stage WHERE run_id = ? AND stage = 'extract_files'").get(result.runId);
    expect(stageRow.status).toBe('done');
    expect(stageRow.rows_written).toBe(completed.rowsWritten);
    expect(events.at(-1).type).toBe(WORKER_MSG.RUN_COMPLETED);
  });

  it('runs inside the runner transaction and never opens its own', () => {
    let before = null;
    let after = null;
    const probe = {
      id: 'extract_files',
      label: 'Extract files',
      run: (ctx) => {
        before = ctx.db.inTransaction;
        const n = runExtractFiles(ctx);
        after = ctx.db.inTransaction; // still inside the one transaction the runner opened
        return n;
      },
    };
    const result = runPipeline({ db, stages: [probe], post, startRun: startRun() });
    expect(result.status).toBe('done');
    expect(before).toBe(true);
    expect(after).toBe(true);
    expect(db.inTransaction).toBe(false);
  });

  it('writes nothing when git fails (an unknown commit): the whole stage rolls back', () => {
    const bad = { ...startRun(), headSha: 'f'.repeat(40) };
    const result = runPipeline({ db, stages: [extractFilesStage], post, startRun: bad });
    expect(result.status).toBe('failed');
    expect(result.error).toMatch(/ls-tree|not a tree|Not a valid object|fatal/i);
    expect(db.prepare('SELECT count(*) AS n FROM raw_tree_entry').get().n).toBe(0);
    expect(db.prepare('SELECT count(*) AS n FROM raw_blob').get().n).toBe(0);
    expect(db.prepare('SELECT count(*) AS n FROM raw_blob_content').get().n).toBe(0);
    expect(db.inTransaction).toBe(false);
  });

  it('re-running for the same commit yields identical rows (idempotent) and no duplicate FTS hits', () => {
    const snapshot = () => ({
      tree: db.prepare('SELECT * FROM raw_tree_entry ORDER BY commit_sha, path').all(),
      blobs: db.prepare('SELECT * FROM raw_blob ORDER BY blob_sha').all(),
      content: db.prepare('SELECT * FROM raw_blob_content ORDER BY blob_sha').all(),
      fts: db.prepare('SELECT count(*) AS n FROM raw_content_fts WHERE raw_content_fts MATCH ?').get(FTS_TOKEN).n,
    });
    const first = run();
    const after1 = snapshot();
    const second = run();
    const after2 = snapshot();

    expect(first.status).toBe('done');
    expect(second.status).toBe('done');
    expect(second.runId).not.toBe(first.runId);
    expect(after2).toEqual(after1);
    expect(after2.fts).toBe(1);
    const stageRows = db.prepare("SELECT rows_written FROM pipeline_stage WHERE stage = 'extract_files' ORDER BY run_id").all();
    expect(stageRows[0].rows_written).toBe(stageRows[1].rows_written);
  });
});

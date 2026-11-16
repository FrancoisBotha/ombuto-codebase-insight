// Test helper (not a test): builds a temporary insight.db and seeds the
// raw_snapshot / raw_blob / raw_blob_content / raw_tree_entry / pipeline_run
// rows the main-process query modules read. Used by the queries, opener and
// worker-manager tests. Never writes outside the OS temp dir.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { openInsightDb } from '../../../../src/shared/db/insightDb.js';

export const COMMIT_A = 'a'.repeat(40);
export const COMMIT_B = 'b'.repeat(40);

/** Deterministic fake blob sha for a file (content-addressed like git, loosely). */
export function fakeBlobSha(seed) {
  return crypto.createHash('sha1').update(String(seed)).digest('hex');
}

/**
 * Creates a temp userData folder and a temp "repo" folder, opens a writable
 * insight.db for the repo and returns handles plus a cleanup function.
 */
export function makeTempDb() {
  const userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-userdata-'));
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-repo-'));
  const db = openInsightDb(repoPath, { userDataPath });
  const cleanup = () => {
    if (db.open) db.close();
    fs.rmSync(userDataPath, { recursive: true, force: true });
    fs.rmSync(repoPath, { recursive: true, force: true });
  };
  return { db, userDataPath, repoPath, cleanup };
}

/**
 * Seeds one analysed commit.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {object} opts
 * @param {string} opts.commitSha
 * @param {string|null} [opts.branch]
 * @param {number} [opts.committedAt]
 * @param {number} [opts.analysedAt]
 * @param {Array<{path: string, lines?: number, bytes?: number, language?: string|null,
 *                binary?: boolean, generated?: boolean, content?: string|null, sha?: string}>} opts.files
 * @param {'done'|'failed'|'running'|null} [opts.runStatus='done']  null = no pipeline_run row
 * @param {string|null} [opts.runError]
 * @returns {{runId: number|null}}
 */
export function seedCommit(db, opts) {
  const {
    commitSha,
    branch = 'main',
    committedAt = 1_700_000_000,
    analysedAt = 1_700_000_100,
    files,
    runStatus = 'done',
    runError = null,
  } = opts;

  const insertSnapshot = db.prepare(`
    INSERT INTO raw_snapshot (commit_sha, branch, committed_at, analysed_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(commit_sha) DO UPDATE SET branch = excluded.branch, analysed_at = excluded.analysed_at`);
  const upsertBlob = db.prepare(`
    INSERT INTO raw_blob (blob_sha, language, size_bytes, line_count, is_binary, is_generated, parse_status, parse_error)
    VALUES (@sha, @language, @bytes, @lines, @binary, @generated, 'skipped', NULL)
    ON CONFLICT(blob_sha) DO NOTHING`);
  const insertContent = db.prepare('INSERT OR IGNORE INTO raw_blob_content (blob_sha, content) VALUES (?, ?)');
  const insertTree = db.prepare('INSERT OR REPLACE INTO raw_tree_entry (commit_sha, path, blob_sha) VALUES (?, ?, ?)');
  const insertRun = db.prepare('INSERT INTO pipeline_run (commit_sha, started_at, finished_at, status, error) VALUES (?, ?, ?, ?, ?)');
  const insertStage = db.prepare(
    'INSERT INTO pipeline_stage (run_id, stage, status, started_at, finished_at, rows_written, error) VALUES (?, ?, ?, ?, ?, ?, ?)',
  );

  return db.transaction(() => {
    insertSnapshot.run(commitSha, branch, committedAt, analysedAt);
    for (const f of files) {
      const binary = f.binary ? 1 : 0;
      const content = binary ? null : f.content ?? (f.lines ? `${'x\n'.repeat(f.lines)}` : '');
      const lines = f.lines ?? (content ? content.split('\n').filter((_, i, a) => i < a.length - 1 || a[i] !== '').length : 0);
      const bytes = f.bytes ?? (content ? Buffer.byteLength(content) : 0);
      const sha = f.sha ?? fakeBlobSha(`${commitSha}:${f.path}`);
      upsertBlob.run({
        sha,
        language: f.language === undefined ? guessLanguage(f.path) : f.language,
        bytes,
        lines: binary ? 0 : lines,
        binary,
        generated: f.generated ? 1 : 0,
      });
      if (!binary) insertContent.run(sha, content);
      insertTree.run(commitSha, f.path, sha);
    }
    let runId = null;
    if (runStatus) {
      const finished = runStatus === 'running' ? null : analysedAt + 5;
      runId = Number(insertRun.run(commitSha, analysedAt, finished, runStatus, runError).lastInsertRowid);
      const stageStatus = runStatus === 'done' ? 'done' : runStatus === 'failed' ? 'failed' : 'running';
      insertStage.run(runId, 'extract_files', stageStatus, analysedAt, finished, files.length, runStatus === 'failed' ? runError : null);
      for (const s of ['extract_history', 'transform', 'deps_secrets', 'load_reporting', 'ai_enrichment']) {
        insertStage.run(runId, s, runStatus === 'running' ? 'pending' : 'skipped', finished, finished, null, null);
      }
    }
    return { runId };
  })();
}

function guessLanguage(p) {
  const ext = path.posix.extname(p).toLowerCase();
  return (
    {
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.sql': 'sql',
      '.md': 'markdown',
      '.json': 'json',
      '.yml': 'yaml',
      '.txt': 'text',
    }[ext] ?? null
  );
}

/** A spread of files whose shapes the inventory tests reason about explicitly. */
export const SAMPLE_FILES = [
  { path: 'README.md', lines: 10 },
  { path: 'package.json', lines: 20 },
  { path: 'src/app.js', lines: 100 },
  { path: 'src/util.js', lines: 60 },
  { path: 'src/api/routes.js', lines: 300 },
  { path: 'src/api/handlers.js', lines: 500 },
  { path: 'src/db/schema.sql', lines: 150 },
  { path: 'src/db/migrate.py', lines: 40 },
  { path: 'tests/app.test.js', lines: 900 },
  { path: 'docs/guide.md', lines: 30 },
  { path: 'assets/logo.png', binary: true, bytes: 2048 },
  { path: 'dist/bundle.min.js', lines: 3, bytes: 50_000, generated: true },
];

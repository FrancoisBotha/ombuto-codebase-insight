// Per-repo analysis database (insight.db): location, creation and opening.
//
// Shared by the main process (read-only queries) and the pipeline worker (the
// only writer, NFR-003). It deliberately does not import `electron`: callers
// inject the userData folder once with configureInsightDb(), or per call.
//
// The schema is docs/Data Model/Schema.ddl, executed verbatim. The code
// follows the file; nothing in here hand-copies DDL (see CLAUDE.md).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

/** Bump when Schema.ddl changes shape. A mismatch refuses to open (no migrations yet). */
export const SCHEMA_VERSION = 1;

export const DB_FILE_NAME = 'insight.db';
export const REPOS_DIR_NAME = 'repos';

export const DEFAULT_DDL_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../docs/Data Model/Schema.ddl',
);

const config = {
  userDataPath: null,
  ddlPath: DEFAULT_DDL_PATH,
};

/**
 * Set process-wide defaults. Main calls this once with
 * `app.getPath('userData')`; the worker gets the same value from main.
 */
export function configureInsightDb({ userDataPath, ddlPath } = {}) {
  if (userDataPath !== undefined) config.userDataPath = userDataPath;
  if (ddlPath !== undefined) config.ddlPath = ddlPath;
  return { ...config };
}

function resolveUserDataPath(opts = {}) {
  const p = opts.userDataPath ?? config.userDataPath;
  if (!p) {
    throw new Error('insightDb: userDataPath is not configured; call configureInsightDb({ userDataPath }) first');
  }
  return p;
}

// --- repo identity ----------------------------------------------------------

/**
 * Canonical form of a repository path: absolute, `.`/`..` resolved, forward
 * slashes, no trailing slash. On Windows the result is also lower-cased, since
 * the filesystem is case-insensitive and C:\Repo and c:/repo/ are one checkout.
 */
export function normaliseRepoPath(repoPath, { platform = process.platform } = {}) {
  if (typeof repoPath !== 'string' || repoPath.trim() === '') {
    throw new TypeError('insightDb: repoPath must be a non-empty string');
  }
  const isWindows = platform === 'win32';
  const impl = isWindows ? path.win32 : path.posix;
  let p = impl.normalize(impl.resolve(repoPath.trim()));
  p = p.replace(/\\/g, '/');
  // Strip trailing separators, but keep a bare root ("/" or "c:/").
  p = p.replace(/\/+$/, '');
  if (isWindows) {
    p = p.toLowerCase();
    if (/^[a-z]:$/.test(p)) p += '/';
  } else if (p === '') {
    p = '/';
  }
  return p;
}

/** Stable id for a checkout: SHA-256 of the normalised path, first 32 hex chars. */
export function repoId(repoPath, opts = {}) {
  const normalised = normaliseRepoPath(repoPath, opts);
  return crypto.createHash('sha256').update(normalised, 'utf8').digest('hex').slice(0, 32);
}

const REPO_ID_RE = /^[0-9a-f]{16,64}$/;

function assertRepoId(id) {
  if (typeof id !== 'string' || !REPO_ID_RE.test(id)) {
    throw new TypeError(`insightDb: invalid repo id ${JSON.stringify(id)}`);
  }
}

// --- paths -------------------------------------------------------------------

/** `<userData>/repos` */
export function reposRootDir(opts = {}) {
  return path.join(resolveUserDataPath(opts), REPOS_DIR_NAME);
}

/** `<userData>/repos/<repo-id>` */
export function repoDataDir(id, opts = {}) {
  assertRepoId(id);
  return path.join(reposRootDir(opts), id);
}

/** `<userData>/repos/<repo-id>/insight.db` */
export function insightDbPath(id, opts = {}) {
  return path.join(repoDataDir(id, opts), DB_FILE_NAME);
}

/** Deletes the repo's whole data folder (database, WAL and shm files). */
export function removeRepoData(id, opts = {}) {
  const dir = repoDataDir(id, opts);
  fs.rmSync(dir, { recursive: true, force: true });
}

// --- open / create -----------------------------------------------------------

function applyPragmas(db) {
  // journal_mode is persistent in the file; on a readonly connection the
  // pragma reports the stored mode (always 'wal' for databases we created).
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
}

function readMeta(db) {
  const hasMeta = db
    .prepare("SELECT 1 FROM sqlite_schema WHERE type = 'table' AND name = 'schema_meta'")
    .get();
  if (!hasMeta) return null;
  return Object.fromEntries(db.prepare('SELECT key, value FROM schema_meta').all().map((r) => [r.key, r.value]));
}

function createSchema(db, { id, repoRoot, ddlPath }) {
  const ddl = fs.readFileSync(ddlPath, 'utf8');
  const insertMeta = () => {
    const stmt = db.prepare('INSERT INTO schema_meta (key, value) VALUES (?, ?)');
    stmt.run('schema_version', String(SCHEMA_VERSION));
    stmt.run('repo_id', id);
    stmt.run('repo_root', repoRoot);
    stmt.run('created_at', String(Math.floor(Date.now() / 1000)));
  };
  db.transaction(() => {
    db.exec(ddl);
    insertMeta();
  })();
}

function checkVersion(meta, dbPath) {
  const found = meta?.schema_version;
  if (found !== String(SCHEMA_VERSION)) {
    throw new Error(
      `insightDb: schema version mismatch in ${dbPath}: found ${found ?? 'none'}, expected ${SCHEMA_VERSION}`,
    );
  }
}

/**
 * Open (or create) the insight.db for a repository.
 *
 * @param {string} repoPath  absolute path of the git work tree
 * @param {object} [options]
 * @param {boolean} [options.readonly=false]  open for main-process queries; never creates
 * @param {string}  [options.userDataPath]     overrides configureInsightDb()
 * @param {string}  [options.ddlPath]          overrides the Schema.ddl location
 * @returns {import('better-sqlite3').Database}
 */
export function openInsightDb(repoPath, options = {}) {
  const { readonly = false } = options;
  const ddlPath = options.ddlPath ?? config.ddlPath;
  const repoRoot = normaliseRepoPath(repoPath);
  const id = repoId(repoPath);
  const dbPath = insightDbPath(id, options);

  if (readonly) {
    if (!fs.existsSync(dbPath)) {
      throw new Error(`insightDb: no database for repo ${repoRoot} at ${dbPath}`);
    }
    const db = new Database(dbPath, { readonly: true });
    try {
      applyPragmas(db);
      checkVersion(readMeta(db), dbPath);
    } catch (err) {
      db.close();
      throw err;
    }
    return db;
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new Database(dbPath);
  try {
    applyPragmas(db);
    const meta = readMeta(db);
    if (meta === null) {
      createSchema(db, { id, repoRoot, ddlPath });
    } else {
      checkVersion(meta, dbPath);
    }
  } catch (err) {
    db.close();
    throw err;
  }
  return db;
}

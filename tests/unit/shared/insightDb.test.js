// Guards src/shared/db/insightDb.js: the per-repo insight.db is created from
// docs/Data Model/Schema.ddl (never hand-copied DDL), opened with WAL and
// foreign keys on, stamped in schema_meta, and located by a stable repo id.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import {
  SCHEMA_VERSION,
  normaliseRepoPath,
  repoId,
  repoDataDir,
  insightDbPath,
  openInsightDb,
  removeRepoData,
} from '../../../src/shared/db/insightDb.js';

const DDL_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../docs/Data Model/Schema.ddl');

// Table names the canonical DDL creates; the module must produce exactly these.
function tablesOf(db) {
  return db
    .prepare("SELECT name FROM sqlite_schema WHERE type IN ('table', 'index', 'trigger') AND name NOT LIKE 'sqlite_%' ORDER BY name")
    .all()
    .map((r) => r.name);
}

describe('insightDb', () => {
  let userDataPath;
  let repoPath;
  const open = [];

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-userdata-'));
    repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-repo-'));
  });

  afterEach(() => {
    for (const db of open.splice(0)) if (db.open) db.close();
    fs.rmSync(userDataPath, { recursive: true, force: true });
    fs.rmSync(repoPath, { recursive: true, force: true });
  });

  const track = (db) => (open.push(db), db);

  describe('repoId', () => {
    it('is a stable hash of the normalised absolute path', () => {
      const a = repoId('C:\\Repo', { platform: 'win32' });
      const b = repoId('C:\\Repo', { platform: 'win32' });
      expect(a).toBe(b);
      expect(a).toMatch(/^[0-9a-f]{16,64}$/);
      expect(repoId('C:\\Other', { platform: 'win32' })).not.toBe(a);
    });

    it('on Windows folds case and normalises separators and trailing slashes', () => {
      const base = repoId('C:\\Repo', { platform: 'win32' });
      expect(repoId('c:/repo/', { platform: 'win32' })).toBe(base);
      expect(repoId('C:/Repo\\', { platform: 'win32' })).toBe(base);
      expect(repoId('c:\\REPO', { platform: 'win32' })).toBe(base);
    });

    it('on POSIX keeps case but still strips trailing slashes', () => {
      const base = repoId('/home/me/Repo', { platform: 'linux' });
      expect(repoId('/home/me/Repo/', { platform: 'linux' })).toBe(base);
      expect(repoId('/home/me/repo', { platform: 'linux' })).not.toBe(base);
    });

    it('normaliseRepoPath resolves relative segments', () => {
      expect(normaliseRepoPath('C:\\Repo\\sub\\..\\', { platform: 'win32' })).toBe('c:/repo');
      expect(normaliseRepoPath('/home/me/Repo/./x/', { platform: 'linux' })).toBe('/home/me/Repo/x');
    });
  });

  describe('paths', () => {
    it('places the repo folder and database under <userData>/repos/<repo-id>', () => {
      const id = repoId(repoPath);
      expect(repoDataDir(id, { userDataPath })).toBe(path.join(userDataPath, 'repos', id));
      expect(insightDbPath(id, { userDataPath })).toBe(path.join(userDataPath, 'repos', id, 'insight.db'));
    });
  });

  describe('openInsightDb', () => {
    it('creates a new database by executing Schema.ddl verbatim', () => {
      const db = track(openInsightDb(repoPath, { userDataPath }));
      expect(fs.existsSync(insightDbPath(repoId(repoPath), { userDataPath }))).toBe(true);

      const reference = new Database(':memory:');
      reference.exec(fs.readFileSync(DDL_PATH, 'utf8'));
      expect(tablesOf(db)).toEqual(tablesOf(reference));
      reference.close();
    });

    it('sets journal_mode=WAL and foreign_keys=ON', () => {
      const db = track(openInsightDb(repoPath, { userDataPath }));
      expect(db.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(db.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(db.readonly).toBe(false);
    });

    it('fills schema_meta on creation', () => {
      const before = Math.floor(Date.now() / 1000);
      const db = track(openInsightDb(repoPath, { userDataPath }));
      const meta = Object.fromEntries(db.prepare('SELECT key, value FROM schema_meta').all().map((r) => [r.key, r.value]));
      expect(meta.schema_version).toBe(String(SCHEMA_VERSION));
      expect(meta.repo_id).toBe(repoId(repoPath));
      expect(meta.repo_root).toBe(normaliseRepoPath(repoPath));
      expect(Number(meta.created_at)).toBeGreaterThanOrEqual(before);
      expect(Number(meta.created_at)).toBeLessThanOrEqual(Math.floor(Date.now() / 1000) + 1);
    });

    it('reopens an existing database with a matching version without re-running the DDL', () => {
      const first = track(openInsightDb(repoPath, { userDataPath }));
      const createdAt = first.prepare("SELECT value FROM schema_meta WHERE key = 'created_at'").get().value;
      first.prepare("INSERT INTO raw_snapshot (commit_sha, committed_at, analysed_at) VALUES ('abc', 1, 2)").run();
      first.close();

      const second = track(openInsightDb(repoPath, { userDataPath }));
      expect(second.prepare('SELECT count(*) AS n FROM raw_snapshot').get().n).toBe(1);
      expect(second.prepare("SELECT value FROM schema_meta WHERE key = 'created_at'").get().value).toBe(createdAt);
      expect(second.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(second.pragma('foreign_keys', { simple: true })).toBe(1);
    });

    it('rejects an existing database whose schema version does not match', () => {
      const db = track(openInsightDb(repoPath, { userDataPath }));
      db.prepare("UPDATE schema_meta SET value = '999' WHERE key = 'schema_version'").run();
      db.close();
      expect(() => openInsightDb(repoPath, { userDataPath })).toThrow(/schema version/i);
    });

    it('opens readonly for main-process queries', () => {
      track(openInsightDb(repoPath, { userDataPath })).close();
      const ro = track(openInsightDb(repoPath, { userDataPath, readonly: true }));
      expect(ro.readonly).toBe(true);
      expect(ro.pragma('journal_mode', { simple: true })).toBe('wal');
      expect(ro.pragma('foreign_keys', { simple: true })).toBe(1);
      expect(ro.prepare("SELECT value FROM schema_meta WHERE key = 'schema_version'").get().value).toBe(String(SCHEMA_VERSION));
      expect(() => ro.prepare("INSERT INTO raw_snapshot (commit_sha, committed_at, analysed_at) VALUES ('x', 1, 2)").run()).toThrow(
        /readonly/i,
      );
    });

    it('refuses a readonly open of a database that does not exist yet', () => {
      expect(() => openInsightDb(repoPath, { userDataPath, readonly: true })).toThrow();
      expect(fs.existsSync(insightDbPath(repoId(repoPath), { userDataPath }))).toBe(false);
    });
  });

  describe('removeRepoData', () => {
    it("deletes the repo's data folder", () => {
      const id = repoId(repoPath);
      track(openInsightDb(repoPath, { userDataPath })).close();
      const dir = repoDataDir(id, { userDataPath });
      expect(fs.existsSync(dir)).toBe(true);
      removeRepoData(id, { userDataPath });
      expect(fs.existsSync(dir)).toBe(false);
      expect(fs.existsSync(path.join(userDataPath, 'repos'))).toBe(true);
    });

    it('is a no-op for an unknown repo id', () => {
      expect(() => removeRepoData('0'.repeat(32), { userDataPath })).not.toThrow();
    });

    it('rejects ids that are not a plain hash', () => {
      expect(() => removeRepoData('../repos', { userDataPath })).toThrow();
      expect(() => removeRepoData('', { userDataPath })).toThrow();
    });
  });
});

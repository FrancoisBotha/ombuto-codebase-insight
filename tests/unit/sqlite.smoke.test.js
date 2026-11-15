// Guards the native-module setup: better-sqlite3 must load under the test
// runtime and include FTS5 (Architecture §2, Storage).
import { describe, it, expect } from 'vitest';
import Database from 'better-sqlite3';

describe('better-sqlite3 smoke', () => {
  it('opens an in-memory database with FTS5 available', () => {
    const db = new Database(':memory:');
    db.exec("CREATE VIRTUAL TABLE t USING fts5(body); INSERT INTO t VALUES ('hello world');");
    const row = db.prepare("SELECT count(*) AS n FROM t WHERE t MATCH 'hello'").get();
    expect(row.n).toBe(1);
    db.close();
  });
});

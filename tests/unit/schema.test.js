// Guards docs/Data Model/Schema.ddl, the canonical database schema:
// it must execute in SQLite, keep the raw → metric → report layering, keep AI
// output quarantined, and stay readable by Ombuto Code's ER diagram parser.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';

const DDL_PATH = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/Data Model/Schema.ddl');
const ddl = fs.readFileSync(DDL_PATH, 'utf8');

const BOOKKEEPING = new Set(['schema_meta', 'guard_log']);

function layerOf(table) {
  if (table.startsWith('raw_')) return 'raw';
  if (table.startsWith('metric_')) return 'metric';
  if (table.startsWith('report_')) return 'report';
  if (table.startsWith('ai_')) return 'ai';
  if (table.startsWith('pipeline_') || table === 'schema_meta') return 'bookkeeping';
  if (table === 'guard_log') return 'guard';
  return null;
}

// Which layers each layer may hold foreign keys to.
const MAY_REFERENCE = {
  raw: ['raw'],
  metric: ['raw', 'metric'],
  report: ['raw', 'metric', 'report'],
  bookkeeping: ['raw', 'bookkeeping'],
  guard: ['guard'],
  ai: ['raw', 'metric', 'report', 'ai', 'guard'],
};

describe('Schema.ddl', () => {
  let db;
  let tables;

  beforeAll(() => {
    db = new Database(':memory:');
    db.exec(ddl);
    tables = db
      .prepare("SELECT name FROM sqlite_schema WHERE type = 'table' AND name NOT LIKE 'sqlite_%'")
      .all()
      .map((r) => r.name);
  });

  afterAll(() => db?.close());

  it('executes and creates the core tables', () => {
    for (const t of ['raw_snapshot', 'raw_blob', 'raw_commit', 'metric_file', 'report_snapshot', 'ai_answer', 'guard_log']) {
      expect(tables).toContain(t);
    }
  });

  it('gives every table a known layer prefix', () => {
    const unknown = tables.filter((t) => layerOf(t) === null && !BOOKKEEPING.has(t));
    expect(unknown).toEqual([]);
  });

  it('only lets each layer reference the layers below it, and quarantines ai_*', () => {
    const violations = [];
    for (const table of tables) {
      const from = layerOf(table);
      for (const fk of db.prepare(`PRAGMA foreign_key_list("${table}")`).all()) {
        const to = layerOf(fk.table);
        if (!MAY_REFERENCE[from]?.includes(to)) violations.push(`${table} -> ${fk.table}`);
      }
    }
    expect(violations).toEqual([]);
  });

  it('keeps FTS5 in sync with raw_blob_content through triggers', () => {
    db.prepare(
      "INSERT INTO raw_blob (blob_sha, size_bytes, line_count, parse_status) VALUES ('b1', 10, 1, 'parsed')",
    ).run();
    db.prepare("INSERT INTO raw_blob_content (blob_sha, content) VALUES ('b1', 'function parse_repo() {}')").run();
    const hit = () => db.prepare("SELECT count(*) AS n FROM raw_content_fts WHERE raw_content_fts MATCH 'parse_repo'").get().n;
    expect(hit()).toBe(1);
    db.prepare("DELETE FROM raw_blob_content WHERE blob_sha = 'b1'").run();
    expect(hit()).toBe(0);
  });

  it('stays parseable by the Ombuto Code ER diagram parser', () => {
    // Same regex as .ombutocode/src/src/renderer/ddlParser.js: a table body ends
    // at the first ");". A body that swallows another statement means the
    // viewer would mis-render the schema.
    const blocks = [...ddl.matchAll(/CREATE\s+TABLE\s+(\w+)\s*\(([\s\S]*?)\);/gi)];
    const regular = tables.filter((t) => !t.startsWith('raw_content_fts'));
    expect(blocks.map((m) => m[1]).sort()).toEqual(regular.sort());
    for (const [, name, body] of blocks) {
      expect(body, `table ${name} body overruns into another statement`).not.toMatch(/CREATE\s/i);
    }
  });
});

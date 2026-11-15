// Drives src/worker/stageRunner.js with fake stages against a temp insight.db:
// raw_snapshot / pipeline_run / pipeline_stage bookkeeping, per-stage
// transactions, skipped stages, failures and idempotent reruns (NFR-003/004).
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { openInsightDb, repoId } from '../../../src/shared/db/insightDb.js';
import { WORKER_MSG } from '../../../src/shared/ipcChannels.js';
import { runPipeline } from '../../../src/worker/stageRunner.js';

const SHA = 'a'.repeat(40);

describe('stageRunner', () => {
  let userDataPath;
  let repoPath;
  let db;
  let events;
  const post = (e) => events.push(e);

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-userdata-'));
    repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-repo-'));
    db = openInsightDb(repoPath, { userDataPath });
    events = [];
  });

  afterEach(() => {
    if (db.open) db.close();
    fs.rmSync(userDataPath, { recursive: true, force: true });
    fs.rmSync(repoPath, { recursive: true, force: true });
  });

  const startRun = () => ({ repoPath, repoId: repoId(repoPath), headSha: SHA, branch: 'main', committedAt: 1_700_000_000 });
  const types = () => events.map((e) => e.type);
  const stageRows = (runId) =>
    db.prepare('SELECT * FROM pipeline_stage WHERE run_id = ? ORDER BY rowid').all(runId);

  // A fake stage that writes blobs so the tests can see rows and transactions.
  const writeBlobs = (n, prefix = 'b') => (ctx) => {
    const ins = ctx.db.prepare(
      "INSERT OR REPLACE INTO raw_blob (blob_sha, size_bytes, line_count, parse_status) VALUES (?, 1, 1, 'skipped')",
    );
    for (let i = 0; i < n; i++) {
      ins.run(`${prefix}${i}`);
      ctx.progress({ done: i + 1, total: n, unit: 'files' });
    }
    return n;
  };

  it('writes raw_snapshot for HEAD, a pipeline_run row and a pipeline_stage row per registered stage', () => {
    const stages = [
      { id: 'extract_files', label: 'Extract files', run: writeBlobs(3) },
      { id: 'extract_history', label: 'Extract history', run: null },
    ];
    const before = Math.floor(Date.now() / 1000);
    const result = runPipeline({ db, stages, post, startRun: startRun() });

    const snap = db.prepare('SELECT * FROM raw_snapshot WHERE commit_sha = ?').get(SHA);
    expect(snap.branch).toBe('main');
    expect(snap.committed_at).toBe(1_700_000_000);
    expect(snap.analysed_at).toBeGreaterThanOrEqual(before);

    const run = db.prepare('SELECT * FROM pipeline_run WHERE id = ?').get(result.runId);
    expect(run.commit_sha).toBe(SHA);
    expect(run.status).toBe('done');
    expect(run.error).toBeNull();
    expect(run.finished_at).toBeGreaterThanOrEqual(run.started_at);

    const rows = stageRows(result.runId);
    expect(rows.map((r) => r.stage)).toEqual(['extract_files', 'extract_history']);
    expect(result.status).toBe('done');
  });

  it('records completed stages as done with rows_written and unimplemented stages as skipped', () => {
    const stages = [
      { id: 'extract_files', label: 'Extract files', run: writeBlobs(4) },
      { id: 'transform', label: 'Transform', run: null },
    ];
    const { runId } = runPipeline({ db, stages, post, startRun: startRun() });
    const [files, transform] = stageRows(runId);

    expect(files.status).toBe('done');
    expect(files.rows_written).toBe(4);
    expect(files.started_at).not.toBeNull();
    expect(files.finished_at).toBeGreaterThanOrEqual(files.started_at);
    expect(files.error).toBeNull();

    expect(transform.status).toBe('skipped');
    expect(transform.rows_written).toBeNull();
    expect(transform.error).toBeNull();

    expect(db.prepare('SELECT count(*) AS n FROM raw_blob').get().n).toBe(4);
  });

  it('posts run started, stage started/progress/completed/skipped and run completed events with counts', () => {
    const stages = [
      { id: 'extract_files', label: 'Extract files', run: writeBlobs(2) },
      { id: 'transform', label: 'Transform', run: null },
    ];
    const { runId } = runPipeline({ db, stages, post, startRun: startRun() });

    expect(types()).toEqual([
      WORKER_MSG.RUN_STARTED,
      WORKER_MSG.STAGE_STARTED,
      WORKER_MSG.STAGE_PROGRESS,
      WORKER_MSG.STAGE_PROGRESS,
      WORKER_MSG.STAGE_COMPLETED,
      WORKER_MSG.STAGE_SKIPPED,
      WORKER_MSG.RUN_COMPLETED,
    ]);

    const started = events[0];
    expect(started).toMatchObject({ runId, repoId: repoId(repoPath), commitSha: SHA });
    expect(started.stages).toEqual([
      { id: 'extract_files', label: 'Extract files' },
      { id: 'transform', label: 'Transform' },
    ]);

    expect(events[1]).toMatchObject({ runId, stage: 'extract_files', label: 'Extract files' });
    expect(events[2]).toMatchObject({ runId, stage: 'extract_files', done: 1, total: 2, unit: 'files' });
    expect(events[3]).toMatchObject({ runId, stage: 'extract_files', done: 2, total: 2 });
    expect(events[4]).toMatchObject({ runId, stage: 'extract_files', rowsWritten: 2 });
    expect(events[5]).toMatchObject({ runId, stage: 'transform', label: 'Transform' });
    expect(events[6]).toMatchObject({ runId, commitSha: SHA });
    expect(events[6].stages).toEqual([
      { stage: 'extract_files', status: 'done', rowsWritten: 2 },
      { stage: 'transform', status: 'skipped', rowsWritten: null },
    ]);
  });

  it('a thrown stage error rolls back that stage, marks stage and run failed with the message, and emits it', () => {
    const stages = [
      { id: 'extract_files', label: 'Extract files', run: writeBlobs(2) },
      {
        id: 'extract_history',
        label: 'Extract history',
        run: (ctx) => {
          ctx.db.prepare("INSERT INTO raw_author (name, email) VALUES ('x', 'x@example.com')").run();
          throw new Error('git exploded');
        },
      },
      { id: 'transform', label: 'Transform', run: null },
    ];
    const result = runPipeline({ db, stages, post, startRun: startRun() });

    expect(result.status).toBe('failed');
    expect(result.error).toBe('git exploded');

    const run = db.prepare('SELECT * FROM pipeline_run WHERE id = ?').get(result.runId);
    expect(run.status).toBe('failed');
    expect(run.error).toBe('git exploded');
    expect(run.finished_at).not.toBeNull();

    const [files, history, transform] = stageRows(result.runId);
    expect(files.status).toBe('done');
    expect(history.status).toBe('failed');
    expect(history.error).toBe('git exploded');
    expect(history.finished_at).not.toBeNull();
    expect(transform.status).toBe('pending');

    // The failed stage's own writes were rolled back; the earlier stage's commit stayed.
    expect(db.prepare('SELECT count(*) AS n FROM raw_author').get().n).toBe(0);
    expect(db.prepare('SELECT count(*) AS n FROM raw_blob').get().n).toBe(2);

    expect(types()).toEqual([
      WORKER_MSG.RUN_STARTED,
      WORKER_MSG.STAGE_STARTED,
      WORKER_MSG.STAGE_PROGRESS,
      WORKER_MSG.STAGE_PROGRESS,
      WORKER_MSG.STAGE_COMPLETED,
      WORKER_MSG.STAGE_STARTED,
      WORKER_MSG.STAGE_FAILED,
      WORKER_MSG.RUN_FAILED,
    ]);
    expect(events[6]).toMatchObject({ runId: result.runId, stage: 'extract_history', error: 'git exploded' });
    expect(events[7]).toMatchObject({ runId: result.runId, commitSha: SHA, stage: 'extract_history', error: 'git exploded' });
    expect(db.inTransaction).toBe(false);
  });

  it('runs each stage in its own transaction', () => {
    const seen = [];
    const stages = [
      { id: 'a', label: 'A', run: (ctx) => (seen.push(ctx.db.inTransaction), 0) },
      { id: 'b', label: 'B', run: (ctx) => (seen.push(ctx.db.inTransaction), 0) },
    ];
    runPipeline({ db, stages, post, startRun: startRun() });
    expect(seen).toEqual([true, true]);
    expect(db.inTransaction).toBe(false);
  });

  it('re-running for the same commit is idempotent: same snapshot and same stage rows', () => {
    const stages = [{ id: 'extract_files', label: 'Extract files', run: writeBlobs(3) }];
    const first = runPipeline({ db, stages, post, startRun: startRun() });
    const blobsAfterFirst = db.prepare('SELECT blob_sha FROM raw_blob ORDER BY blob_sha').all();

    const second = runPipeline({ db, stages, post, startRun: startRun() });

    expect(second.runId).not.toBe(first.runId);
    expect(db.prepare('SELECT count(*) AS n FROM raw_snapshot').get().n).toBe(1);
    expect(db.prepare('SELECT count(*) AS n FROM pipeline_run WHERE commit_sha = ?').get(SHA).n).toBe(2);
    expect(db.prepare('SELECT blob_sha FROM raw_blob ORDER BY blob_sha').all()).toEqual(blobsAfterFirst);
    expect(stageRows(second.runId).map((r) => [r.stage, r.status, r.rows_written])).toEqual(
      stageRows(first.runId).map((r) => [r.stage, r.status, r.rows_written]),
    );
  });

  it('fills committed_at from analysed_at when the start message carries no commit time', () => {
    const { repoPath: p, repoId: id, headSha } = startRun();
    runPipeline({ db, stages: [], post, startRun: { repoPath: p, repoId: id, headSha } });
    const snap = db.prepare('SELECT * FROM raw_snapshot WHERE commit_sha = ?').get(SHA);
    expect(snap.branch).toBeNull();
    expect(snap.committed_at).toBe(snap.analysed_at);
  });

  it('gives stages a context with the db, run id, commit and repo identity', () => {
    let ctx;
    runPipeline({
      db,
      stages: [{ id: 'a', label: 'A', run: (c) => ((ctx = c), 0) }],
      post,
      startRun: startRun(),
    });
    expect(ctx.db).toBe(db);
    expect(ctx.commitSha).toBe(SHA);
    expect(ctx.repoPath).toBe(repoPath);
    expect(ctx.repoId).toBe(repoId(repoPath));
    expect(typeof ctx.runId).toBe('number');
    expect(ctx.stage).toEqual({ id: 'a', label: 'A' });
  });

  it('rejects a start message without a head sha before writing anything', () => {
    expect(() => runPipeline({ db, stages: [], post, startRun: { repoPath, repoId: repoId(repoPath) } })).toThrow(/headSha/);
    expect(db.prepare('SELECT count(*) AS n FROM pipeline_run').get().n).toBe(0);
  });
});

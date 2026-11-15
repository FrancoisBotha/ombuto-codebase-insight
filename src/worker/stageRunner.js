// Stage runner: runs the registered pipeline stages for one commit with
// pipeline_run / pipeline_stage bookkeeping and progress events (Architecture
// §3, NFR-003/004). Pure: takes an open insight.db, a stage list and a `post`
// callback, so tests drive it without a utilityProcess. src/worker/pipeline.js
// wires it to parentPort.
//
// A stage is `{ id, label, run }`. `run(ctx)` is synchronous and executes inside
// its own transaction (better-sqlite3 transactions cannot span awaits); it
// returns the number of rows written (or `{ rowsWritten }`). A stage with
// `run: null` is not implemented yet and is recorded as `skipped`. Re-running a
// stage for the same commit must produce the same rows (idempotent writes).
//
// Events posted, in order, all carrying `runId`, `repoId` and `commitSha`:
//   RUN_STARTED     { stages: [{ id, label }] }
//   STAGE_STARTED   { stage, label }
//   STAGE_PROGRESS  { stage, label, done, total, unit, message }   (from ctx.progress)
//   STAGE_COMPLETED { stage, label, rowsWritten, durationMs }
//   STAGE_SKIPPED   { stage, label, reason }
//   STAGE_FAILED    { stage, label, error }
//   RUN_COMPLETED   { stages: [{ stage, status, rowsWritten }] }
//   RUN_FAILED      { stage, error }
import { WORKER_MSG } from '../shared/ipcChannels.js';

const nowSeconds = () => Math.floor(Date.now() / 1000);

function errorMessage(err) {
  if (err instanceof Error) return err.message || String(err);
  return typeof err === 'string' ? err : JSON.stringify(err);
}

function validateStart(startRun) {
  if (!startRun || typeof startRun !== 'object') throw new TypeError('stageRunner: startRun message is required');
  const { repoPath, repoId, headSha } = startRun;
  if (typeof repoPath !== 'string' || repoPath === '') throw new TypeError('stageRunner: startRun.repoPath is required');
  if (typeof repoId !== 'string' || repoId === '') throw new TypeError('stageRunner: startRun.repoId is required');
  if (typeof headSha !== 'string' || !/^[0-9a-f]{7,64}$/i.test(headSha)) {
    throw new TypeError('stageRunner: startRun.headSha must be a commit sha');
  }
}

function validateStages(stages) {
  if (!Array.isArray(stages)) throw new TypeError('stageRunner: stages must be an array');
  const ids = new Set();
  for (const s of stages) {
    if (!s || typeof s.id !== 'string' || typeof s.label !== 'string') {
      throw new TypeError('stageRunner: every stage needs a string id and label');
    }
    if (s.run !== null && s.run !== undefined && typeof s.run !== 'function') {
      throw new TypeError(`stageRunner: stage ${s.id} run must be a function or null`);
    }
    if (ids.has(s.id)) throw new TypeError(`stageRunner: duplicate stage id ${s.id}`);
    ids.add(s.id);
  }
}

/**
 * Run the pipeline for one commit.
 *
 * @param {object} args
 * @param {import('better-sqlite3').Database} args.db  open, writable insight.db
 * @param {Array<{id: string, label: string, run: ((ctx: object) => number | {rowsWritten?: number}) | null}>} args.stages
 * @param {(event: object) => void} args.post  receives each progress event
 * @param {{repoPath: string, repoId: string, headSha: string, branch?: string|null, committedAt?: number|null}} args.startRun
 * @returns {{runId: number, status: 'done'|'failed', error: string|null, stages: Array<{stage: string, status: string, rowsWritten: number|null}>}}
 */
export function runPipeline({ db, stages, post = () => {}, startRun }) {
  validateStart(startRun);
  validateStages(stages);
  const { repoPath, repoId, headSha: commitSha } = startRun;
  const branch = startRun.branch ?? null;

  const q = {
    upsertSnapshot: db.prepare(`
      INSERT INTO raw_snapshot (commit_sha, branch, committed_at, analysed_at)
      VALUES (@commitSha, @branch, @committedAt, @analysedAt)
      ON CONFLICT(commit_sha) DO UPDATE SET
        branch = COALESCE(excluded.branch, raw_snapshot.branch),
        analysed_at = excluded.analysed_at`),
    insertRun: db.prepare("INSERT INTO pipeline_run (commit_sha, started_at, status) VALUES (?, ?, 'running')"),
    insertStage: db.prepare("INSERT INTO pipeline_stage (run_id, stage, status) VALUES (?, ?, 'pending')"),
    stageRunning: db.prepare("UPDATE pipeline_stage SET status = 'running', started_at = ? WHERE run_id = ? AND stage = ?"),
    stageDone: db.prepare(
      "UPDATE pipeline_stage SET status = 'done', finished_at = ?, rows_written = ? WHERE run_id = ? AND stage = ?",
    ),
    stageSkipped: db.prepare("UPDATE pipeline_stage SET status = 'skipped', started_at = ?, finished_at = ? WHERE run_id = ? AND stage = ?"),
    stageFailed: db.prepare("UPDATE pipeline_stage SET status = 'failed', finished_at = ?, error = ? WHERE run_id = ? AND stage = ?"),
    runDone: db.prepare("UPDATE pipeline_run SET status = 'done', finished_at = ? WHERE id = ?"),
    runFailed: db.prepare("UPDATE pipeline_run SET status = 'failed', finished_at = ?, error = ? WHERE id = ?"),
  };

  // Run start: snapshot (idempotent per commit), run row and one pending row
  // per registered stage, in one transaction.
  const startedAt = nowSeconds();
  const runId = db.transaction(() => {
    q.upsertSnapshot.run({
      commitSha,
      branch,
      committedAt: startRun.committedAt ?? startedAt,
      analysedAt: startedAt,
    });
    const id = Number(q.insertRun.run(commitSha, startedAt).lastInsertRowid);
    for (const s of stages) q.insertStage.run(id, s.id);
    return id;
  })();

  const base = { runId, repoId, commitSha };
  const emit = (type, fields) => post({ type, ...base, ...fields });
  const summary = stages.map((s) => ({ stage: s.id, status: 'pending', rowsWritten: null }));

  emit(WORKER_MSG.RUN_STARTED, { stages: stages.map((s) => ({ id: s.id, label: s.label })) });

  for (let i = 0; i < stages.length; i++) {
    const stage = stages[i];
    const stageFields = { stage: stage.id, label: stage.label };

    if (!stage.run) {
      const t = nowSeconds();
      q.stageSkipped.run(t, t, runId, stage.id);
      summary[i].status = 'skipped';
      emit(WORKER_MSG.STAGE_SKIPPED, { ...stageFields, reason: 'not implemented' });
      continue;
    }

    const stageStartedAt = nowSeconds();
    const startedMs = Date.now();
    q.stageRunning.run(stageStartedAt, runId, stage.id);
    emit(WORKER_MSG.STAGE_STARTED, stageFields);

    const ctx = {
      db,
      runId,
      repoPath,
      repoId,
      commitSha,
      stage: { id: stage.id, label: stage.label },
      progress: ({ done = null, total = null, unit = null, message = null } = {}) =>
        emit(WORKER_MSG.STAGE_PROGRESS, { ...stageFields, done, total, unit, message }),
    };

    let rowsWritten;
    try {
      // The stage's writes commit together or not at all.
      rowsWritten = db.transaction(() => {
        const result = stage.run(ctx);
        if (result && typeof result.then === 'function') {
          throw new Error(`stage ${stage.id} returned a promise; stages must be synchronous`);
        }
        const n = typeof result === 'number' ? result : result?.rowsWritten;
        return Number.isFinite(n) ? n : 0;
      })();
    } catch (err) {
      const message = errorMessage(err);
      const t = nowSeconds();
      q.stageFailed.run(t, message, runId, stage.id);
      q.runFailed.run(t, message, runId);
      summary[i].status = 'failed';
      emit(WORKER_MSG.STAGE_FAILED, { ...stageFields, error: message });
      emit(WORKER_MSG.RUN_FAILED, { stage: stage.id, error: message });
      return { runId, status: 'failed', error: message, stages: summary };
    }

    q.stageDone.run(nowSeconds(), rowsWritten, runId, stage.id);
    summary[i].status = 'done';
    summary[i].rowsWritten = rowsWritten;
    emit(WORKER_MSG.STAGE_COMPLETED, { ...stageFields, rowsWritten, durationMs: Date.now() - startedMs });
  }

  q.runDone.run(nowSeconds(), runId);
  emit(WORKER_MSG.RUN_COMPLETED, { stages: summary });
  return { runId, status: 'done', error: null, stages: summary };
}

// Main-side manager for the pipeline worker (utilityProcess), epic 1 FR-004 /
// NFR-004. Forks the worker lazily, posts START_RUN, forwards every worker
// event to `onEvent` (main relays them to the renderer), tracks the active run
// and, when the worker dies mid-run, marks that run and its unfinished stages
// `failed` in insight.db with the error recorded, emits RUN_FAILED and lets
// the next run fork a fresh worker. The app never goes down with the worker.
//
// The worker is normally the only writer (NFR-003). The crash path is the one
// exception: the writer is gone, so main records the failure itself in a
// short-lived connection and closes it again.
//
// Pure of Electron: main injects `fork` (utilityProcess.fork wrapper); tests
// inject a fake child.
import { WORKER_MSG } from '../../shared/ipcChannels.js';
import { openInsightDb } from '../../shared/db/insightDb.js';

const nowSeconds = () => Math.floor(Date.now() / 1000);

/**
 * @param {object} deps
 * @param {() => {on: Function, postMessage: Function, kill: Function, pid?: number}} deps.fork
 * @param {string} deps.userDataPath
 * @param {(event: object) => void} deps.onEvent
 * @param {typeof openInsightDb} [deps.openDb]
 * @param {(...args: any[]) => void} [deps.log]
 */
export function createWorkerManager({ fork, userDataPath, onEvent, openDb = openInsightDb, log = console.error }) {
  if (typeof fork !== 'function') throw new TypeError('createWorkerManager needs fork()');
  if (typeof userDataPath !== 'string' || userDataPath === '') throw new TypeError('createWorkerManager needs userDataPath');
  if (typeof onEvent !== 'function') throw new TypeError('createWorkerManager needs onEvent(event)');

  let worker = null;
  /** @type {{repoPath: string, repoId: string, headSha: string, runId: number|null, stage: string|null, startedAt: number} | null} */
  let active = null;
  let disposed = false;

  function emit(event) {
    try {
      onEvent(event);
    } catch (err) {
      log('workerManager: onEvent threw', err);
    }
  }

  function handleMessage(raw) {
    // Electron hands the parent the posted message itself; tolerate a
    // MessageEvent-shaped `{ data }` too.
    const msg = raw && typeof raw === 'object' && typeof raw.type === 'string' ? raw : raw?.data;
    if (!msg || typeof msg.type !== 'string') return;
    switch (msg.type) {
      case WORKER_MSG.PONG:
        return;
      case WORKER_MSG.RUN_STARTED:
        if (active && typeof msg.runId === 'number') active.runId = msg.runId;
        break;
      case WORKER_MSG.STAGE_STARTED:
        if (active) active.stage = msg.stage ?? null;
        break;
      case WORKER_MSG.STAGE_COMPLETED:
      case WORKER_MSG.STAGE_SKIPPED:
      case WORKER_MSG.STAGE_FAILED:
        if (active) active.stage = null;
        break;
      case WORKER_MSG.RUN_COMPLETED:
      case WORKER_MSG.RUN_FAILED:
        active = null;
        break;
      default:
        break;
    }
    emit(msg);
  }

  /** Records the crash in insight.db. Returns the run id it marked (or null). */
  function markRunFailed(run, error) {
    let db = null;
    try {
      db = openDb(run.repoPath, { userDataPath });
      const t = nowSeconds();
      const runId =
        run.runId ??
        db
          .prepare("SELECT id FROM pipeline_run WHERE commit_sha = ? AND status = 'running' ORDER BY id DESC LIMIT 1")
          .get(run.headSha)?.id ??
        null;
      if (runId === null) return null;
      db.transaction(() => {
        db.prepare("UPDATE pipeline_run SET status = 'failed', finished_at = ?, error = ? WHERE id = ? AND status = 'running'").run(t, error, runId);
        db.prepare(
          "UPDATE pipeline_stage SET status = 'failed', finished_at = ?, error = ? WHERE run_id = ? AND status IN ('running', 'pending')",
        ).run(t, error, runId);
      })();
      return runId;
    } catch (err) {
      log('workerManager: could not record the worker crash in insight.db', err);
      return run.runId ?? null;
    } finally {
      if (db?.open) db.close();
    }
  }

  function handleExit(code) {
    worker = null;
    if (disposed || !active) return;
    const run = active;
    active = null;
    const where = run.stage ? ` during stage ${run.stage}` : '';
    const error = `Pipeline worker exited unexpectedly (code ${code ?? 'unknown'})${where}. The run was marked failed.`;
    const runId = markRunFailed(run, error);
    emit({
      type: WORKER_MSG.RUN_FAILED,
      runId,
      repoId: run.repoId,
      commitSha: run.headSha,
      stage: run.stage,
      error,
    });
  }

  function ensureWorker() {
    if (worker) return worker;
    worker = fork();
    worker.on('message', handleMessage);
    worker.on('exit', handleExit);
    return worker;
  }

  return {
    /**
     * Posts START_RUN for a repo. The worker is forked on first use and after
     * a crash. Throws if the fork itself fails.
     * @param {{repoPath: string, repoId: string, headSha: string, branch?: string|null, committedAt?: number|null}} msg
     */
    startRun(msg) {
      if (disposed) throw new Error('workerManager: disposed');
      const w = ensureWorker();
      active = {
        repoPath: msg.repoPath,
        repoId: msg.repoId,
        headSha: msg.headSha,
        runId: null,
        stage: null,
        startedAt: nowSeconds(),
      };
      w.postMessage({ type: WORKER_MSG.START_RUN, ...msg, userDataDir: userDataPath });
    },

    /** The run in flight, or null. */
    activeRun() {
      return active ? { ...active } : null;
    },

    /** True while a run for `repoId` is in flight. */
    isRunning(repoId) {
      return active !== null && (repoId === undefined || active.repoId === repoId);
    },

    /** Kills the worker (app quit). A later startRun forks a new one unless disposed. */
    dispose() {
      disposed = true;
      const w = worker;
      worker = null;
      active = null;
      try {
        w?.kill();
      } catch (err) {
        log('workerManager: kill failed', err);
      }
    },
  };
}

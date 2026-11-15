// Pipeline worker (Electron utilityProcess). The only writer to the per-repo
// SQLite database (NFR-003). Main sends START_RUN; the worker opens insight.db,
// runs the registered stages through the stage runner and posts progress
// events back. A failed run never kills the worker: it reports RUN_FAILED and
// waits for the next message (NFR-004).
import { WORKER_MSG } from '../shared/ipcChannels.js';
import { openInsightDb } from '../shared/db/insightDb.js';
import { runPipeline } from './stageRunner.js';
import { STAGES } from './stages/index.js';

function errorMessage(err) {
  return err instanceof Error ? err.message || String(err) : String(err);
}

/**
 * Attach the worker's message loop to a port (process.parentPort in the app,
 * a fake in tests). Returns the handler so a caller can detach it.
 *
 * @param {{on: Function, postMessage: Function}} port
 * @param {object} [options]
 * @param {Array} [options.stages=STAGES]   stage registry override (tests)
 * @param {Function} [options.openDb=openInsightDb]
 */
export function attachWorker(port, { stages = STAGES, openDb = openInsightDb } = {}) {
  const post = (msg) => port.postMessage(msg);

  function handleStartRun(msg) {
    const { repoPath, repoId, userDataDir, headSha, branch, committedAt } = msg;
    let db = null;
    try {
      if (typeof userDataDir !== 'string' || userDataDir === '') {
        throw new TypeError('startRun.userDataDir is required');
      }
      db = openDb(repoPath, { userDataPath: userDataDir });
      runPipeline({
        db,
        stages,
        post,
        startRun: { repoPath, repoId, headSha, branch, committedAt },
      });
    } catch (err) {
      // Stage failures are already reported by the runner; this catches
      // everything before a run row exists (bad message, unopenable db).
      post({
        type: WORKER_MSG.RUN_FAILED,
        runId: null,
        repoId: repoId ?? null,
        commitSha: headSha ?? null,
        stage: null,
        error: errorMessage(err),
      });
    } finally {
      if (db?.open) db.close();
    }
  }

  const onMessage = (event) => {
    const msg = event?.data;
    if (!msg || typeof msg !== 'object') return;
    switch (msg.type) {
      case WORKER_MSG.PING:
        post({ type: WORKER_MSG.PONG });
        break;
      case WORKER_MSG.START_RUN:
        handleStartRun(msg);
        break;
      default:
        break;
    }
  };

  port.on('message', onMessage);
  return onMessage;
}

if (process.parentPort) attachWorker(process.parentPort);

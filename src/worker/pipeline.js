// Pipeline worker (Electron utilityProcess). The only writer to the per-repo
// SQLite database. Pipeline stages are added by later tickets.
import { WORKER_MSG } from '../shared/ipcChannels.js';

process.parentPort?.on('message', (event) => {
  const msg = event.data;
  if (msg?.type === WORKER_MSG.PING) {
    process.parentPort.postMessage({ type: WORKER_MSG.PONG });
  }
});

// IPC channel names shared by main, preload and renderer.
// Renderer → main queries are read-only (see docs/Architecture/Architecture.md §3).
// WINDOW_* channels drive the frameless window's custom title bar buttons.
export const IPC = Object.freeze({
  APP_INFO: 'app:info',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window:toggle-maximize',
  WINDOW_CLOSE: 'window:close',
});

// Messages between main and the pipeline worker (utilityProcess).
// main → worker: PING, START_RUN { repoPath, repoId, userDataDir, headSha, branch?, committedAt? }
// worker → main: PONG and the run/stage progress events (see src/worker/stageRunner.js
// for each event's fields).
export const WORKER_MSG = Object.freeze({
  PING: 'ping',
  PONG: 'pong',
  START_RUN: 'run:start',
  RUN_STARTED: 'run:started',
  RUN_COMPLETED: 'run:completed',
  RUN_FAILED: 'run:failed',
  STAGE_STARTED: 'stage:started',
  STAGE_PROGRESS: 'stage:progress',
  STAGE_COMPLETED: 'stage:completed',
  STAGE_SKIPPED: 'stage:skipped',
  STAGE_FAILED: 'stage:failed',
});

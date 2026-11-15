// IPC channel names shared by main, preload and renderer.
// Renderer → main queries are read-only (see docs/Architecture/Architecture.md §3).
export const IPC = Object.freeze({
  APP_INFO: 'app:info',
});

// Messages between main and the pipeline worker (utilityProcess).
export const WORKER_MSG = Object.freeze({
  PING: 'ping',
  PONG: 'pong',
});

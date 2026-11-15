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
export const WORKER_MSG = Object.freeze({
  PING: 'ping',
  PONG: 'pong',
});

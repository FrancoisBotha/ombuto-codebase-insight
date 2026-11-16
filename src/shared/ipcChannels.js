// IPC channel names shared by main, preload and renderer.
// Renderer → main queries are read-only (see docs/Architecture/Architecture.md §3).
// WINDOW_* channels drive the frameless window's custom title bar buttons.
//
// Epic 1 channels (all `ipcMain.handle` / `ipcRenderer.invoke` unless noted):
//   GIT_CHECK         → { available, version, message }                  (FR-002)
//   REPO_OPEN_DIALOG  → native folder dialog, then opens the pick        (FR-001)
//   REPO_OPEN_PATH    (path) → opens a dropped or recent folder          (FR-001, FR-003)
//   RECENTS_LIST      → recent repositories                               (FR-003)
//   RECENTS_REMOVE    (repoId) → removes the entry and its insight.db folder
//   RUN_STATUS        → the current repo's latest pipeline run with stages (FR-006)
//   RUN_EVENT         main → renderer push (webContents.send) of worker events
//   REPO_REFRESH      → full re-run of the current repo
//   REPO_INFO         → name, path, branch, HEAD sha, analysed time, file count
//   INVENTORY         → Size & Inventory aggregates                       (FR-007)
//   FILE_TREE         → explorer tree                                     (FR-008)
//   FILE_CONTENT      (path) → one file's content and metadata           (FR-008)
//   FILE_SEARCH       (query, limit) → path search for the palette       (FR-008)
export const IPC = Object.freeze({
  APP_INFO: 'app:info',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window:toggle-maximize',
  WINDOW_CLOSE: 'window:close',
  GIT_CHECK: 'git:check',
  REPO_OPEN_DIALOG: 'repo:open-dialog',
  REPO_OPEN_PATH: 'repo:open-path',
  RECENTS_LIST: 'recents:list',
  RECENTS_REMOVE: 'recents:remove',
  RUN_STATUS: 'pipeline:status',
  RUN_EVENT: 'pipeline:event',
  REPO_REFRESH: 'repo:refresh',
  REPO_INFO: 'repo:info',
  INVENTORY: 'inventory:summary',
  FILE_TREE: 'files:tree',
  FILE_CONTENT: 'files:content',
  FILE_SEARCH: 'files:search',
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

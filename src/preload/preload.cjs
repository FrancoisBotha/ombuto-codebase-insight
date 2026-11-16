// Preload bridge. Must be CommonJS: sandboxed preloads cannot be ES modules.
// Exposes a narrow, read-only API (`window.insight`) to the renderer, plus
// window controls for the custom title bar. The renderer never sees
// ipcRenderer, Node or the filesystem (NFR-002): every call is an invoke on a
// named channel and main validates the arguments.
const { contextBridge, ipcRenderer, webUtils } = require('electron');

// Keep in sync with src/shared/ipcChannels.js (a sandboxed preload cannot import ESM).
// tests/unit/preload/preloadBridge.test.js fails if the two drift.
const IPC = {
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
};

/**
 * @typedef {{ ok: false, reason: string, message: string }} OpenError
 * @typedef {{ path: string, repoId: string, name: string, headSha: string, branch: string|null,
 *             committedAt: number|null, lastAnalysedAt: string|null }} RepoSummary
 * @typedef {{ runId: number, commitSha: string, status: string, startedAt: number,
 *             finishedAt: number|null, error: string|null }} RunSummary
 * @typedef {{ ok: true, status: 'ready'|'indexing', repo: RepoSummary, run: RunSummary|null } | OpenError} OpenResult
 * @typedef {{ path: string, repoId: string, displayName: string, lastAnalysedAt: string|null, lastOpenedAt: string }} RecentEntry
 * @typedef {RunSummary & { stages: Array<{ stage: string, status: string, startedAt: number|null,
 *             finishedAt: number|null, rowsWritten: number|null, error: string|null }> }} RunStatus
 * @typedef {{ type: string, runId: number|null, repoId: string|null, commitSha: string|null,
 *             stage?: string, label?: string, done?: number|null, total?: number|null, unit?: string|null,
 *             message?: string|null, rowsWritten?: number, durationMs?: number, reason?: string,
 *             error?: string, stages?: Array<object> }} RunEvent
 * @typedef {{ path: string, blobSha: string, language: string|null, lines: number, bytes: number,
 *             isBinary: boolean, isGenerated: boolean }} FileSummary
 * @typedef {{ type: 'dir', name: string, path: string, children: Array<TreeNode>, fileCount: number, lines: number, bytes: number }
 *         | (FileSummary & { type: 'file', name: string })} TreeNode
 *
 * @typedef {object} InsightApi
 * @property {() => Promise<{ name: string, version: string }>} getAppInfo
 * @property {{ minimize: () => void, toggleMaximize: () => void, close: () => void }} window
 * @property {{ check: () => Promise<{ available: boolean, version: string|null, raw: string|null, message: string|null }> }} git
 * @property {{
 *   openDialog: () => Promise<OpenResult | { ok: false, reason: 'cancelled' }>,
 *   openPath: (folderPath: string) => Promise<OpenResult>,
 *   openDropped: (file: File) => Promise<OpenResult>,
 *   pathForFile: (file: File) => string,
 *   refresh: () => Promise<OpenResult>,
 *   info: () => Promise<(RepoSummary & { analysedAt: number|null, fileCount: number, lastRun: RunSummary|null }) | null>,
 * }} repo
 * @property {{ list: () => Promise<RecentEntry[]>, remove: (repoId: string) => Promise<{ ok: boolean, message?: string, recents: RecentEntry[] }> }} recents
 * @property {{ status: () => Promise<RunStatus|null>, onEvent: (cb: (event: RunEvent) => void) => () => void }} run
 * @property {{ summary: (options?: { largestLimit?: number, folderDepth?: number, folderLimit?: number }) => Promise<object|null> }} inventory
 * @property {{
 *   tree: () => Promise<{ commitSha: string, fileCount: number, children: TreeNode[] } | null>,
 *   content: (path: string) => Promise<(FileSummary & { content: string|null }) | null>,
 *   search: (query: string, limit?: number) => Promise<FileSummary[]>,
 * }} files
 */

/** @type {InsightApi} */
const api = {
  getAppInfo: () => ipcRenderer.invoke(IPC.APP_INFO),
  window: {
    minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
    toggleMaximize: () => ipcRenderer.send(IPC.WINDOW_TOGGLE_MAXIMIZE),
    close: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
  },
  git: {
    check: () => ipcRenderer.invoke(IPC.GIT_CHECK),
  },
  repo: {
    openDialog: () => ipcRenderer.invoke(IPC.REPO_OPEN_DIALOG),
    openPath: (folderPath) => ipcRenderer.invoke(IPC.REPO_OPEN_PATH, folderPath),
    // Dropped File objects carry no usable path in a sandboxed renderer;
    // webUtils.getPathForFile is the supported way to resolve one.
    pathForFile: (file) => webUtils.getPathForFile(file),
    openDropped: (file) => ipcRenderer.invoke(IPC.REPO_OPEN_PATH, webUtils.getPathForFile(file)),
    refresh: () => ipcRenderer.invoke(IPC.REPO_REFRESH),
    info: () => ipcRenderer.invoke(IPC.REPO_INFO),
  },
  recents: {
    list: () => ipcRenderer.invoke(IPC.RECENTS_LIST),
    remove: (repoId) => ipcRenderer.invoke(IPC.RECENTS_REMOVE, repoId),
  },
  run: {
    status: () => ipcRenderer.invoke(IPC.RUN_STATUS),
    /** Subscribe to worker events; returns an unsubscribe function. */
    onEvent: (callback) => {
      const listener = (_event, payload) => callback(payload);
      ipcRenderer.on(IPC.RUN_EVENT, listener);
      return () => ipcRenderer.removeListener(IPC.RUN_EVENT, listener);
    },
  },
  inventory: {
    summary: (options) => (options === undefined ? ipcRenderer.invoke(IPC.INVENTORY) : ipcRenderer.invoke(IPC.INVENTORY, options)),
  },
  files: {
    tree: () => ipcRenderer.invoke(IPC.FILE_TREE),
    content: (filePath) => ipcRenderer.invoke(IPC.FILE_CONTENT, filePath),
    search: (query, limit) => (limit === undefined ? ipcRenderer.invoke(IPC.FILE_SEARCH, query) : ipcRenderer.invoke(IPC.FILE_SEARCH, query, limit)),
  },
};

contextBridge.exposeInMainWorld('insight', api);

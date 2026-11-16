// The renderer's single data seam. Every view reads its data from here and
// nowhere else. Welcome and Indexing (epic 1 FR-001..FR-004, FR-006) are real:
// their exports call the preload bridge (window.insight.*, read-only IPC against
// main and the per-repo insight.db). The other screens still re-export sample
// data from src/renderer/mock/ until their tickets wire them. See
// docs/Architecture/prototype-port.md.

// --- Welcome + Indexing: IPC through the preload bridge ------------------------
// Every helper tolerates a missing bridge (unit tests, a plain browser tab in
// dev) by resolving to an empty/"not available" value instead of throwing.

const bridge = () => (typeof window !== 'undefined' && window.insight) || null;

const NO_BRIDGE = 'The application bridge is not available in this window.';

/** FR-002: is the system git CLI available? */
export const checkGit = () =>
  bridge()?.git?.check() ?? Promise.resolve({ available: false, version: null, raw: null, message: NO_BRIDGE });

/** FR-001: native folder dialog, then open the pick. */
export const openRepoDialog = () =>
  bridge()?.repo?.openDialog() ?? Promise.resolve({ ok: false, reason: 'no-bridge', message: NO_BRIDGE });

/** FR-001/FR-003: open a folder path (a recent, or a resolved drop). */
export const openRepoPath = (folderPath) =>
  bridge()?.repo?.openPath(folderPath) ?? Promise.resolve({ ok: false, reason: 'no-bridge', message: NO_BRIDGE });

/** FR-001: open a folder dropped on the Welcome drop zone (a DOM File). */
export const openDroppedFolder = (file) =>
  bridge()?.repo?.openDropped(file) ?? Promise.resolve({ ok: false, reason: 'no-bridge', message: NO_BRIDGE });

/** Full re-run of the current repo (sidebar footer refresh, ⌘R). */
export const refreshRepo = () =>
  bridge()?.repo?.refresh() ?? Promise.resolve({ ok: false, reason: 'no-bridge', message: NO_BRIDGE });

/** Title bar / sidebar / status bar facts for the open repo, or null. */
export const getRepoInfo = () => bridge()?.repo?.info() ?? Promise.resolve(null);

/** FR-003: recent repositories, most recently opened first. */
export const listRecents = () => bridge()?.recents?.list() ?? Promise.resolve([]);

/** FR-003: remove a recent and delete its insight.db folder. */
export const removeRecent = (repoId) =>
  bridge()?.recents?.remove(repoId) ?? Promise.resolve({ ok: false, message: NO_BRIDGE, recents: [] });

/** FR-006: the current repo's latest pipeline run with its stages, or null. */
export const getRunStatus = () => bridge()?.run?.status() ?? Promise.resolve(null);

/** FR-006: subscribe to worker run events; returns an unsubscribe function. */
export const onRunEvent = (callback) => bridge()?.run?.onEvent(callback) ?? (() => {});

// --- Screens still on sample data ---------------------------------------------
export * from '../mock/harborApi.js';
export * from '../mock/screens/overview.js';
export * from '../mock/screens/inventory.js';
export * from '../mock/screens/architecture.js';
export * from '../mock/screens/complexity.js';
export * from '../mock/screens/quality.js';
export * from '../mock/screens/deps.js';
export * from '../mock/screens/hotspots.js';
export * from '../mock/screens/history.js';
export * from '../mock/screens/ask.js';
export * from '../mock/screens/diagrams.js';
export * from '../mock/screens/file.js';
export * from '../mock/screens/report.js';
export * from '../mock/screens/settings.js';

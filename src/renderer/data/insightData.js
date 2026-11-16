// The renderer's single data seam. Every view reads its data from here and
// nowhere else. Welcome and Indexing (epic 1 FR-001..FR-004, FR-006) and Size &
// Inventory / Files (FR-007, FR-008) are real: their exports call the preload
// bridge (window.insight.*, read-only IPC against main and the per-repo
// insight.db). The other screens still re-export sample data from
// src/renderer/mock/ until their tickets wire them. See
// docs/Architecture/prototype-port.md.

// Every helper tolerates a missing bridge (unit tests, a plain browser tab in
// dev, no repository open) by resolving to an empty/"not available" value
// instead of throwing.
const bridge = () => (typeof window !== 'undefined' && window.insight) || null;

// --- Welcome + Indexing: IPC through the preload bridge ------------------------

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
export * from '../mock/screens/architecture.js';
export * from '../mock/screens/complexity.js';
export * from '../mock/screens/quality.js';
export * from '../mock/screens/deps.js';
export * from '../mock/screens/hotspots.js';
export * from '../mock/screens/history.js';
export * from '../mock/screens/ask.js';
export * from '../mock/screens/diagrams.js';
export * from '../mock/screens/report.js';
export * from '../mock/screens/settings.js';

// --- Size & Inventory and Files: read-only IPC (FR-007, FR-008) ----------------
// Each call degrades to an empty result when the bridge is absent, so the views
// render their empty states instead of throwing.

/**
 * Size & Inventory aggregates for the open repository's HEAD, or null.
 * @param {{largestLimit?: number, folderDepth?: number, folderLimit?: number}} [options]
 */
export async function fetchInventory(options) {
  const api = bridge()?.inventory;
  if (!api) return null;
  return (await api.summary(options)) ?? null;
}

/** The explorer tree ({ commitSha, fileCount, children }) for HEAD, or null. */
export async function fetchFileTree() {
  const api = bridge()?.files;
  if (!api) return null;
  return (await api.tree()) ?? null;
}

/** One tracked file with its content (null content for binary files), or null. */
export async function fetchFileContent(filePath) {
  const api = bridge()?.files;
  if (!api) return null;
  return (await api.content(filePath)) ?? null;
}

/** Path search for the command palette's Files group. */
export async function searchFiles(query, limit = 5) {
  const api = bridge()?.files;
  if (!api) return [];
  return (await api.search(query, limit)) ?? [];
}

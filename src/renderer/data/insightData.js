// The renderer's single data seam. Every view reads its data from here and
// nowhere else. Today it re-exports sample data from src/renderer/mock/; later
// tickets replace these exports with read-only IPC queries (window.insight.*)
// against the per-repo insight.db. See docs/Architecture/prototype-port.md.
export * from '../mock/harborApi.js';
export * from '../mock/screens/welcome.js';
export * from '../mock/screens/indexing.js';
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

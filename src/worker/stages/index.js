// Pipeline stage registry, in run order (Architecture §3). Stage ids match
// the pipeline_stage.stage values in docs/Data Model/Schema.ddl.
//
// Each entry is `{ id, label, run }`. `run(ctx)` is a synchronous function
// that writes inside the transaction the runner opens for it and returns the
// number of rows written; see src/worker/stageRunner.js for the ctx shape.
// `run: null` means the stage is not implemented yet and the runner records
// it as `skipped`. The ticket that implements a stage replaces its `null`.
export const STAGES = Object.freeze([
  { id: 'extract_files', label: 'Extract files', run: null },
  { id: 'extract_history', label: 'Extract history', run: null },
  { id: 'transform', label: 'Transform structure & history', run: null },
  { id: 'deps_secrets', label: 'Dependencies & secrets', run: null },
  { id: 'load_reporting', label: 'Load reporting', run: null },
  { id: 'ai_enrichment', label: 'AI enrichment', run: null },
]);

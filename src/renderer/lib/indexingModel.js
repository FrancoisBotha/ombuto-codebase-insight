// Pure view-model for the Indexing screen and the shell chrome (epic 1
// FR-006, UI notes §6). Turns the worker's run events (src/worker/stageRunner.js)
// and the RUN_STATUS snapshot (src/main/queries/repoQueries.js) into one plain
// `run` object the views render. No DOM, no IPC, no Vue, so it is unit-tested
// on its own (tests/unit/renderer/indexingModel.test.js).
import { WORKER_MSG } from '../../shared/ipcChannels.js';

/** Per-stage copy for the Indexing rows, keyed by pipeline_stage.stage. */
export const STAGE_META = Object.freeze({
  extract_files: { label: 'Extract files', detail: 'Tracked files at HEAD · language, size, lines, binary and generated flags', unit: 'files' },
  extract_history: { label: 'Extract history', detail: 'Commits, churn, co-change, ownership, code age', unit: 'commits' },
  transform: { label: 'Transform structure & history', detail: 'Import graph, call graph, cycle detection, hotspots', unit: 'edges' },
  deps_secrets: { label: 'Dependencies & secrets', detail: 'Lockfiles, advisories, licenses, secret patterns', unit: 'packages' },
  load_reporting: { label: 'Load reporting', detail: 'Health score, risks and report tables', unit: 'rows' },
  ai_enrichment: { label: 'AI enrichment', detail: 'Module summaries via the configured LLM provider', unit: 'modules', optional: true },
});

/** Features that unlock as stages finish: which stage gates which screen. */
export const READY_ITEMS = Object.freeze([
  { label: 'Size & Inventory', stage: 'extract_files', icon: 'mdi-format-list-numbered', id: 'inventory' },
  { label: 'Files', stage: 'extract_files', icon: 'mdi-file-code-outline', id: 'file' },
  { label: 'Hotspots & ownership', stage: 'transform', icon: 'mdi-fire', id: 'hotspots' },
  { label: 'Dependency graph & cycles', stage: 'transform', icon: 'mdi-graph-outline', id: 'architecture' },
  { label: 'Dependency health', stage: 'deps_secrets', icon: 'mdi-package-variant-closed', id: 'deps' },
  { label: 'Ask the codebase', stage: 'ai_enrichment', icon: 'mdi-chat-question-outline', id: 'ask' },
]);

/** Keep this many log lines; the view shows the newest. */
export const LOG_LIMIT = 200;

const FINISHED = new Set(['done', 'skipped', 'failed']);

export function emptyRun() {
  return { runId: null, commitSha: null, status: null, startedAt: null, finishedAt: null, error: null, stages: [], log: [] };
}

function newStage(id, label) {
  const meta = STAGE_META[id] || {};
  return {
    id,
    label: label || meta.label || id,
    detail: meta.detail || '',
    optional: Boolean(meta.optional),
    status: 'pending',
    done: null,
    total: null,
    unit: meta.unit || null,
    rowsWritten: null,
    error: null,
    message: null,
  };
}

/**
 * Builds the run model from a RUN_STATUS snapshot (null → empty run). Used to
 * seed the screen when it mounts mid-run or after the app restarts.
 */
export function runFromStatus(status) {
  if (!status) return emptyRun();
  const stages = (status.stages || []).map((s) => {
    const st = newStage(s.stage);
    st.status = s.status || 'pending';
    st.rowsWritten = s.rowsWritten ?? null;
    st.error = s.error ?? null;
    if (st.status === 'done' && Number.isFinite(st.rowsWritten)) {
      st.done = st.rowsWritten;
      st.total = st.rowsWritten;
    }
    return st;
  });
  return {
    runId: status.runId ?? null,
    commitSha: status.commitSha ?? null,
    status: status.status ?? null,
    startedAt: status.startedAt ?? null,
    finishedAt: status.finishedAt ?? null,
    error: status.error ?? null,
    stages,
    log: [],
  };
}

function clock(now) {
  const d = new Date(now);
  const p = (n) => String(n).padStart(2, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

function logLine(event) {
  const t = event.type;
  const label = event.label || STAGE_META[event.stage]?.label || event.stage || '';
  switch (t) {
    case WORKER_MSG.RUN_STARTED: return `run   started (${(event.stages || []).length} stages)`;
    case WORKER_MSG.STAGE_STARTED: return `stage ${label}: started`;
    case WORKER_MSG.STAGE_PROGRESS: return `stage ${label}: ${event.message || `${event.done ?? 0} / ${event.total ?? '?'} ${event.unit || ''}`.trim()}`;
    case WORKER_MSG.STAGE_COMPLETED: return `stage ${label}: done · ${Number(event.rowsWritten ?? 0).toLocaleString()} rows in ${Number(event.durationMs ?? 0).toLocaleString()} ms`;
    case WORKER_MSG.STAGE_SKIPPED: return `stage ${label}: skipped (${event.reason || 'not built yet'})`;
    case WORKER_MSG.STAGE_FAILED: return `stage ${label}: FAILED · ${event.error || 'unknown error'}`;
    case WORKER_MSG.RUN_COMPLETED: return 'run   completed';
    case WORKER_MSG.RUN_FAILED: return `run   failed · ${event.error || 'unknown error'}`;
    default: return `${t} ${label}`.trim();
  }
}

/**
 * Applies one worker event to a run model and returns a new model (the input
 * is not mutated). Events for a different run are ignored once a run is
 * known, except RUN_STARTED, which replaces the run.
 *
 * @param {ReturnType<typeof emptyRun>} run
 * @param {object} event   see src/worker/stageRunner.js for each event's fields
 * @param {number} [now]   Date.now() for the log timestamp (tests)
 */
export function applyRunEvent(run, event, now = Date.now()) {
  if (!event || typeof event.type !== 'string') return run;
  const prev = run || emptyRun();
  const isNewRun = event.type === WORKER_MSG.RUN_STARTED;
  if (!isNewRun && prev.runId !== null && event.runId !== undefined && event.runId !== null && event.runId !== prev.runId) {
    return prev;
  }

  let next;
  if (isNewRun) {
    next = {
      ...emptyRun(),
      runId: event.runId ?? null,
      commitSha: event.commitSha ?? null,
      status: 'running',
      startedAt: Math.floor(now / 1000),
      stages: (event.stages || []).map((s) => newStage(s.id, s.label)),
    };
  } else {
    next = { ...prev, stages: prev.stages.map((s) => ({ ...s })) };
    if (next.runId === null && event.runId !== undefined) next.runId = event.runId ?? null;
    if (!next.commitSha && event.commitSha) next.commitSha = event.commitSha;
    if (next.status === null) next.status = 'running';

    const stageIndex = next.stages.findIndex((s) => s.id === event.stage);
    let stage = stageIndex >= 0 ? next.stages[stageIndex] : null;
    if (!stage && event.stage && event.type.startsWith('stage:')) {
      stage = newStage(event.stage, event.label);
      next.stages.push(stage);
    }

    switch (event.type) {
      case WORKER_MSG.STAGE_STARTED:
        stage.status = 'running';
        break;
      case WORKER_MSG.STAGE_PROGRESS:
        stage.status = 'running';
        stage.done = event.done ?? stage.done;
        stage.total = event.total ?? stage.total;
        stage.unit = event.unit || stage.unit;
        stage.message = event.message ?? stage.message;
        break;
      case WORKER_MSG.STAGE_COMPLETED:
        stage.status = 'done';
        stage.rowsWritten = event.rowsWritten ?? null;
        if (stage.total === null && Number.isFinite(event.rowsWritten)) stage.total = event.rowsWritten;
        stage.done = stage.total;
        break;
      case WORKER_MSG.STAGE_SKIPPED:
        stage.status = 'skipped';
        stage.message = event.reason || null;
        break;
      case WORKER_MSG.STAGE_FAILED:
        stage.status = 'failed';
        stage.error = event.error || 'unknown error';
        break;
      case WORKER_MSG.RUN_COMPLETED:
        next.status = 'done';
        next.finishedAt = Math.floor(now / 1000);
        break;
      case WORKER_MSG.RUN_FAILED:
        next.status = 'failed';
        next.error = event.error || 'unknown error';
        next.finishedAt = Math.floor(now / 1000);
        break;
      default:
        break;
    }
  }

  next.log = [...(isNewRun ? [] : prev.log), { t: clock(now), m: logLine(event) }].slice(-LOG_LIMIT);
  return next;
}

/** Fraction of one stage that is complete, 0..1. */
export function stageFraction(stage) {
  if (!stage) return 0;
  if (FINISHED.has(stage.status)) return 1;
  if (stage.status !== 'running') return 0;
  if (Number.isFinite(stage.done) && Number.isFinite(stage.total) && stage.total > 0) {
    return Math.max(0, Math.min(1, stage.done / stage.total));
  }
  return 0;
}

/** Overall run progress 0..1: every stage weighs the same. */
export function overallProgress(run) {
  if (!run || run.stages.length === 0) return run?.status === 'done' ? 1 : 0;
  if (run.status === 'done') return 1;
  const sum = run.stages.reduce((acc, s) => acc + stageFraction(s), 0);
  return sum / run.stages.length;
}

/** True once Extract files is done: Size & Inventory and Files can open. */
export function canExplore(run) {
  return Boolean(run?.stages.find((s) => s.id === 'extract_files' && s.status === 'done'));
}

/**
 * The "Start exploring now" list: each item unlocks when its gating stage is
 * done; a skipped gate reads "Skipped", an unfinished one "Waiting".
 */
export function readyItems(run) {
  const done = run?.status === 'done';
  return READY_ITEMS.map((item) => {
    const stage = run?.stages.find((s) => s.id === item.stage);
    const ok = stage?.status === 'done';
    const state = ok ? (done ? 'Ready' : 'Partial') : stage?.status === 'skipped' ? 'Skipped' : stage?.status === 'failed' ? 'Failed' : 'Waiting';
    return { ...item, ok, state };
  });
}

/** Seconds-since-epoch or ISO string → ms; null when absent/invalid. */
export function toMillis(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value * 1000 : null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** "just now", "5m ago", "2h ago", "3d ago"; "never" when absent. */
export function formatRelative(value, now = Date.now()) {
  const ms = toMillis(value);
  if (ms === null) return 'never';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

/** First seven characters of a sha; '' when absent. */
export function shortSha(sha) {
  return typeof sha === 'string' ? sha.slice(0, 7) : '';
}

/** "m:ss" elapsed between a start (seconds-since-epoch) and now. */
export function formatElapsed(startedAt, now = Date.now()) {
  const ms = toMillis(startedAt);
  if (ms === null) return '0:00';
  const s = Math.max(0, Math.floor((now - ms) / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

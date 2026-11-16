// @vitest-environment happy-dom
// Indexing screen on real worker events (FR-006): overall progress, per-stage
// status and counts, live log, failed-stage error, skipped stages, unlocking.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import IndexingView from '../../../src/renderer/views/IndexingView.vue';
import { useInsightStore } from '../../../src/renderer/stores/insightStore.js';
import { useRepoStore } from '../../../src/renderer/stores/repoStore.js';
import { WORKER_MSG } from '../../../src/shared/ipcChannels.js';

const REPO = { path: 'C:\\dev\\harbor-api', repoId: 'id1', name: 'harbor-api', headSha: 'a91f3c2deadbeef', branch: 'main', committedAt: 1, lastAnalysedAt: null };
const base = { runId: 7, repoId: 'id1', commitSha: 'a91f3c2deadbeef' };
const ev = (type, fields = {}) => ({ type, ...base, ...fields });
const STAGES = [
  { id: 'extract_files', label: 'Extract files' },
  { id: 'extract_history', label: 'Extract history' },
  { id: 'transform', label: 'Transform structure & history' },
  { id: 'deps_secrets', label: 'Dependencies & secrets' },
  { id: 'load_reporting', label: 'Load reporting' },
  { id: 'ai_enrichment', label: 'AI enrichment' },
];

let listeners;
function makeBridge() {
  listeners = [];
  return {
    getAppInfo: async () => ({ name: 'insight', version: '1.0.0' }),
    git: { check: vi.fn(async () => ({ available: true, version: '2.52.0', raw: '', message: null })) },
    repo: {
      openDialog: vi.fn(), openPath: vi.fn(), openDropped: vi.fn(), pathForFile: vi.fn(),
      refresh: vi.fn(async () => ({ ok: true, status: 'indexing', repo: REPO, run: null })),
      info: vi.fn(async () => ({ ...REPO, analysedAt: null, fileCount: 0, lastRun: null })),
    },
    recents: { list: vi.fn(async () => []), remove: vi.fn() },
    run: {
      status: vi.fn(async () => null),
      onEvent: vi.fn((cb) => { listeners.push(cb); return () => { listeners = listeners.filter((l) => l !== cb); }; }),
    },
    inventory: { summary: vi.fn(async () => null) },
    files: { tree: vi.fn(async () => null), content: vi.fn(async () => null), search: vi.fn(async () => []) },
  };
}
const push = (e) => listeners.forEach((l) => l(e));

let pinia;
async function mountIndexing() {
  const repoStore = useRepoStore();
  repoStore.start();
  await repoStore.setOpened({ ok: true, status: 'indexing', repo: REPO, run: null });
  useInsightStore().go('indexing');
  const w = mount(IndexingView, { global: { plugins: [pinia], directives: { hover: {} } } });
  await flushPromises();
  return w;
}

describe('IndexingView.vue', () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    window.insight = makeBridge();
  });
  afterEach(() => {
    useRepoStore().stop();
    delete window.insight;
  });

  it('shows the real repo in the header and every stage from RUN_STARTED', async () => {
    const w = await mountIndexing();
    push(ev(WORKER_MSG.RUN_STARTED, { stages: STAGES }));
    await flushPromises();
    const text = w.text();
    expect(text).toContain('Analysing harbor-api');
    expect(text).toContain('main @ a91f3c2');
    expect(text).toContain('C:\\dev\\harbor-api');
    for (const s of STAGES) expect(text).toContain(s.label);
    expect(text).not.toContain('Parsing files');
    w.unmount();
  });

  it('shows per-stage progress counts and the overall percentage', async () => {
    const w = await mountIndexing();
    push(ev(WORKER_MSG.RUN_STARTED, { stages: STAGES }));
    push(ev(WORKER_MSG.STAGE_STARTED, { stage: 'extract_files', label: 'Extract files' }));
    push(ev(WORKER_MSG.STAGE_PROGRESS, { stage: 'extract_files', label: 'Extract files', done: 300, total: 600, unit: 'files', message: 'Extracted 300 of 600 files' }));
    await flushPromises();
    const row = w.findAll('[data-stage]').find((r) => r.attributes('data-stage') === 'extract_files');
    expect(row.text()).toContain('300 / 600');
    expect(row.text()).toContain('files');
    expect(row.attributes('data-status')).toBe('running');
    expect(w.find('[data-overall]').text()).toBe('8%');
    expect(w.find('[data-log]').text()).toContain('Extracted 300 of 600 files');
    w.unmount();
  });

  it('marks unbuilt stages skipped', async () => {
    const w = await mountIndexing();
    push(ev(WORKER_MSG.RUN_STARTED, { stages: STAGES }));
    push(ev(WORKER_MSG.STAGE_SKIPPED, { stage: 'extract_history', label: 'Extract history', reason: 'not implemented' }));
    await flushPromises();
    const row = w.findAll('[data-stage]').find((r) => r.attributes('data-stage') === 'extract_history');
    expect(row.attributes('data-status')).toBe('skipped');
    expect(row.text().toLowerCase()).toContain('skipped');
    w.unmount();
  });

  it('shows a failed stage error', async () => {
    const w = await mountIndexing();
    push(ev(WORKER_MSG.RUN_STARTED, { stages: STAGES }));
    push(ev(WORKER_MSG.STAGE_STARTED, { stage: 'extract_files', label: 'Extract files' }));
    push(ev(WORKER_MSG.STAGE_FAILED, { stage: 'extract_files', label: 'Extract files', error: 'git cat-file exited 128' }));
    push(ev(WORKER_MSG.RUN_FAILED, { stage: 'extract_files', error: 'git cat-file exited 128' }));
    await flushPromises();
    const row = w.findAll('[data-stage]').find((r) => r.attributes('data-stage') === 'extract_files');
    expect(row.attributes('data-status')).toBe('failed');
    expect(row.find('[data-stage-error]').text()).toContain('git cat-file exited 128');
    expect(useInsightStore().scr).toBe('indexing');
    w.unmount();
  });

  it('unlocks Size & Inventory when Extract files completes and lands there on click', async () => {
    const w = await mountIndexing();
    push(ev(WORKER_MSG.RUN_STARTED, { stages: STAGES }));
    await flushPromises();
    const explore = w.find('button.om-btn--primary');
    expect(explore.attributes('disabled')).toBeDefined();
    const item = () => w.findAll('[data-ready]').find((r) => r.attributes('data-ready') === 'inventory');
    expect(item().text()).toContain('Waiting');
    await item().trigger('click');
    expect(useInsightStore().scr).toBe('indexing');

    push(ev(WORKER_MSG.STAGE_STARTED, { stage: 'extract_files', label: 'Extract files' }));
    push(ev(WORKER_MSG.STAGE_COMPLETED, { stage: 'extract_files', label: 'Extract files', rowsWritten: 600, durationMs: 10 }));
    await flushPromises();
    expect(item().text()).toContain('Partial');
    expect(explore.attributes('disabled')).toBeUndefined();
    await item().trigger('click');
    expect(useInsightStore().scr).toBe('inventory');

    useInsightStore().go('indexing');
    await explore.trigger('click');
    expect(useInsightStore().scr).toBe('inventory');
    w.unmount();
  });

  it('the end of a run lands on Size & Inventory', async () => {
    const w = await mountIndexing();
    push(ev(WORKER_MSG.RUN_STARTED, { stages: STAGES }));
    push(ev(WORKER_MSG.STAGE_COMPLETED, { stage: 'extract_files', label: 'Extract files', rowsWritten: 600, durationMs: 10 }));
    for (const s of STAGES.slice(1)) push(ev(WORKER_MSG.STAGE_SKIPPED, { stage: s.id, label: s.label, reason: 'not implemented' }));
    push(ev(WORKER_MSG.RUN_COMPLETED, { stages: [] }));
    await flushPromises();
    expect(useInsightStore().scr).toBe('inventory');
    w.unmount();
  });

  it('seeds from pipeline:status when mounted mid-run', async () => {
    window.insight.run.status = vi.fn(async () => ({
      runId: 7, commitSha: 'a91f3c2deadbeef', status: 'running', startedAt: 1, finishedAt: null, error: null,
      stages: [
        { stage: 'extract_files', status: 'done', startedAt: 1, finishedAt: 2, rowsWritten: 42, error: null },
        { stage: 'extract_history', status: 'running', startedAt: 2, finishedAt: null, rowsWritten: null, error: null },
      ],
    }));
    const w = await mountIndexing();
    const rows = w.findAll('[data-stage]');
    expect(rows.map((r) => r.attributes('data-status'))).toEqual(['done', 'running']);
    expect(rows[0].text()).toContain('42');
    w.unmount();
  });
});

// @vitest-environment happy-dom
// Shell chrome on real data (epic UI notes §6): title bar repo name and
// branch pill, sidebar repo name, footer "Analysed … · <sha>", status bar
// path/branch/file count, neutral health pill, ⌘O and ⌘R shortcuts.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import App from '../../../src/renderer/App.vue';
import { useInsightStore } from '../../../src/renderer/stores/insightStore.js';
import { useRepoStore } from '../../../src/renderer/stores/repoStore.js';
import { WORKER_MSG } from '../../../src/shared/ipcChannels.js';

const NOW_S = Math.floor(Date.now() / 1000);
const REPO = { path: 'C:\\dev\\harbor-api', repoId: 'id1', name: 'harbor-api', headSha: 'a91f3c2deadbeef', branch: 'main', committedAt: 1, lastAnalysedAt: null };

let listeners;
function makeBridge() {
  listeners = [];
  return {
    getAppInfo: async () => ({ name: 'insight', version: '9.9.9' }),
    git: { check: vi.fn(async () => ({ available: true, version: '2.52.0', raw: '', message: null })) },
    repo: {
      openDialog: vi.fn(async () => ({ ok: true, status: 'ready', repo: REPO, run: { runId: 1, status: 'done' } })),
      openPath: vi.fn(), openDropped: vi.fn(), pathForFile: vi.fn(),
      refresh: vi.fn(async () => ({ ok: true, status: 'indexing', repo: REPO, run: null })),
      info: vi.fn(async () => ({ ...REPO, analysedAt: NOW_S - 2 * 3600, fileCount: 612, lastRun: { runId: 1, status: 'done' } })),
    },
    recents: { list: vi.fn(async () => []), remove: vi.fn() },
    run: {
      status: vi.fn(async () => null),
      onEvent: vi.fn((cb) => { listeners.push(cb); return () => {}; }),
    },
    inventory: { summary: vi.fn(async () => null) },
    files: { tree: vi.fn(async () => null), content: vi.fn(async () => null), search: vi.fn(async () => []) },
  };
}

let pinia;
function mountApp() {
  return mount(App, { global: { plugins: [pinia], directives: { hover: {} }, stubs: { Teleport: true, CodeView: true } } });
}
const key = (k, extra = {}) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, ctrlKey: true, ...extra }));

describe('shell chrome', () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
    window.insight = makeBridge();
  });
  afterEach(() => {
    delete window.insight;
  });

  it('shows "No repository open" and no repo chrome on Welcome', async () => {
    const w = mountApp();
    await flushPromises();
    expect(w.find('.om-statusbar').text()).toContain('No repository open');
    expect(w.text()).not.toContain('harbor-api');
    w.unmount();
  });

  it('after a repo opens, the title bar, sidebar, footer and status bar are real', async () => {
    const w = mountApp();
    await flushPromises();
    await useRepoStore().setOpened({ ok: true, status: 'ready', repo: REPO, run: { runId: 1, status: 'done' } });
    useInsightStore().go('inventory');
    await flushPromises();

    const title = w.find('[data-titlebar-repo]');
    expect(title.text()).toContain('harbor-api');
    expect(title.text()).toContain('main');
    expect(w.find('[data-sidebar-repo]').text()).toBe('harbor-api');
    const pill = w.find('[data-health-pill]');
    expect(pill.text()).toBe('—');
    expect(pill.attributes('style')).toContain('--om-tone-neutral-bg');
    expect(w.find('[data-sidebar-footer]').text()).toContain('Analysed 2h ago · a91f3c2');
    const sb = w.find('.om-statusbar').text();
    expect(sb).toContain('C:\\dev\\harbor-api');
    expect(sb).toContain('main');
    expect(sb).toContain('612 files · analysed 2h ago');
    expect(w.text()).not.toContain('~/dev/harbor-api');
    w.unmount();
  });

  it('status bar shows the real progress while indexing', async () => {
    const w = mountApp();
    await flushPromises();
    await useRepoStore().setOpened({ ok: true, status: 'indexing', repo: REPO, run: null });
    useInsightStore().go('indexing');
    const base = { runId: 7, repoId: 'id1', commitSha: REPO.headSha };
    listeners.forEach((l) => l({ type: WORKER_MSG.RUN_STARTED, ...base, stages: [{ id: 'extract_files', label: 'Extract files' }, { id: 'extract_history', label: 'Extract history' }] }));
    listeners.forEach((l) => l({ type: WORKER_MSG.STAGE_COMPLETED, ...base, stage: 'extract_files', label: 'Extract files', rowsWritten: 1, durationMs: 1 }));
    await flushPromises();
    expect(w.find('.om-statusbar').text()).toContain('Analysing… 50%');
    w.unmount();
  });

  it('Ctrl/Cmd+O opens the native dialog', async () => {
    const w = mountApp();
    await flushPromises();
    key('o');
    await flushPromises();
    expect(window.insight.repo.openDialog).toHaveBeenCalledTimes(1);
    expect(useInsightStore().scr).toBe('inventory');
    w.unmount();
  });

  it('sidebar refresh and Ctrl/Cmd+R re-run a full analysis', async () => {
    const w = mountApp();
    await flushPromises();
    await useRepoStore().setOpened({ ok: true, status: 'ready', repo: REPO, run: { runId: 1, status: 'done' } });
    useInsightStore().go('inventory');
    await flushPromises();
    await w.find('[title="Re-analyse  ⌘R"]').trigger('click');
    await flushPromises();
    expect(window.insight.repo.refresh).toHaveBeenCalledTimes(1);
    expect(useInsightStore().scr).toBe('indexing');

    useInsightStore().go('inventory');
    key('r');
    await flushPromises();
    expect(window.insight.repo.refresh).toHaveBeenCalledTimes(2);
    expect(useInsightStore().scr).toBe('indexing');
    w.unmount();
  });
});

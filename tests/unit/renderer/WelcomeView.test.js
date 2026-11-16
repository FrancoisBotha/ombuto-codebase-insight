// @vitest-environment happy-dom
// Welcome screen on real data (FR-001..FR-003): native dialog, drop zone,
// git check, recents with open/remove, neutral score chip.
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import WelcomeView from '../../../src/renderer/views/WelcomeView.vue';
import { useInsightStore } from '../../../src/renderer/stores/insightStore.js';

const REPO = { path: 'C:\\dev\\harbor-api', repoId: 'id1', name: 'harbor-api', headSha: 'a91f3c2deadbeef', branch: 'main', committedAt: 1, lastAnalysedAt: null };

function makeBridge(overrides = {}) {
  const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  return {
    getAppInfo: async () => ({ name: 'insight', version: '1.0.0' }),
    git: { check: vi.fn(async () => ({ available: true, version: '2.52.0', raw: 'git version 2.52.0', message: null })) },
    repo: {
      openDialog: vi.fn(async () => ({ ok: true, status: 'indexing', repo: REPO, run: null })),
      openPath: vi.fn(async () => ({ ok: true, status: 'indexing', repo: REPO, run: null })),
      openDropped: vi.fn(async () => ({ ok: true, status: 'indexing', repo: REPO, run: null })),
      pathForFile: vi.fn(() => 'C:\\dev\\dropped'),
      refresh: vi.fn(async () => ({ ok: true, status: 'indexing', repo: REPO, run: null })),
      info: vi.fn(async () => null),
    },
    recents: {
      list: vi.fn(async () => [
        { path: 'C:\\dev\\harbor-api', repoId: 'id1', displayName: 'harbor-api', lastAnalysedAt: twoHoursAgo, lastOpenedAt: twoHoursAgo },
        { path: 'D:\\work\\ledger-web', repoId: 'id2', displayName: 'ledger-web', lastAnalysedAt: null, lastOpenedAt: twoHoursAgo },
      ]),
      remove: vi.fn(async () => ({ ok: true, recents: [] })),
    },
    run: { status: vi.fn(async () => null), onEvent: vi.fn(() => () => {}) },
    inventory: { summary: vi.fn(async () => null) },
    files: { tree: vi.fn(async () => null), content: vi.fn(async () => null), search: vi.fn(async () => []) },
    ...overrides,
  };
}

let pinia;
function mountWelcome() {
  return mount(WelcomeView, { global: { plugins: [pinia], directives: { hover: {} } } });
}

/** Dispatches a drop with a dataTransfer carrying `file` (DragEvent.dataTransfer is read-only). */
function dropOn(zone, file) {
  const drop = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', { value: { files: [file] } });
  zone.element.dispatchEvent(drop);
}

describe('WelcomeView.vue', () => {
  beforeEach(() => {
    pinia = createPinia();
    setActivePinia(pinia);
  });
  afterEach(() => {
    delete window.insight;
  });

  it('lists real recents with path, last-analysed time and a neutral dash chip', async () => {
    window.insight = makeBridge();
    const w = mountWelcome();
    await flushPromises();
    const text = w.text();
    expect(text).toContain('harbor-api');
    expect(text).toContain('C:\\dev\\harbor-api');
    expect(text).toContain('ledger-web');
    expect(text).toContain('2h ago');
    expect(text).not.toContain('infra-terraform');
    const chips = w.findAll('[title="Health score"]');
    expect(chips.length).toBe(2);
    for (const c of chips) {
      expect(c.text()).toBe('—');
      expect(c.attributes('style')).toContain('--om-tone-neutral-bg');
    }
    w.unmount();
  });

  it('opens a recent on click and lands on Indexing', async () => {
    window.insight = makeBridge();
    const w = mountWelcome();
    await flushPromises();
    const row = w.findAll('[data-recent]').find((r) => r.text().includes('ledger-web'));
    await row.trigger('click');
    await flushPromises();
    expect(window.insight.repo.openPath).toHaveBeenCalledWith('D:\\work\\ledger-web');
    expect(useInsightStore().scr).toBe('indexing');
    w.unmount();
  });

  it('lands on Size & Inventory when a recent is already analysed for its HEAD', async () => {
    window.insight = makeBridge();
    window.insight.repo.openPath = vi.fn(async () => ({ ok: true, status: 'ready', repo: REPO, run: { runId: 1, status: 'done' } }));
    const w = mountWelcome();
    await flushPromises();
    await w.find('[data-recent]').trigger('click');
    await flushPromises();
    expect(useInsightStore().scr).toBe('inventory');
    w.unmount();
  });

  it('supports Remove from recents without opening the row', async () => {
    window.insight = makeBridge();
    const w = mountWelcome();
    await flushPromises();
    const btn = w.find('[data-recent] [title="Remove from recents"]');
    expect(btn.exists()).toBe(true);
    await btn.trigger('click');
    await flushPromises();
    expect(window.insight.recents.remove).toHaveBeenCalledWith('id1');
    expect(window.insight.repo.openPath).not.toHaveBeenCalled();
    expect(w.text()).not.toContain('harbor-api');
    w.unmount();
  });

  it('Open Folder… opens the native dialog and goes to Indexing', async () => {
    window.insight = makeBridge();
    const w = mountWelcome();
    await flushPromises();
    await w.find('button.om-btn--primary').trigger('click');
    await flushPromises();
    expect(window.insight.repo.openDialog).toHaveBeenCalledTimes(1);
    expect(useInsightStore().scr).toBe('indexing');
    w.unmount();
  });

  it('a cancelled dialog stays on Welcome without a message', async () => {
    window.insight = makeBridge();
    window.insight.repo.openDialog = vi.fn(async () => ({ ok: false, reason: 'cancelled', message: '' }));
    const w = mountWelcome();
    await flushPromises();
    await w.find('button.om-btn--primary').trigger('click');
    await flushPromises();
    expect(useInsightStore().scr).toBe('welcome');
    expect(w.find('[data-open-error]').exists()).toBe(false);
    w.unmount();
  });

  it('shows a clear message for a non-git folder', async () => {
    window.insight = makeBridge();
    window.insight.repo.openDialog = vi.fn(async () => ({ ok: false, reason: 'not-a-repo', message: '"C:\\tmp\\notes" is not inside a git repository.' }));
    const w = mountWelcome();
    await flushPromises();
    await w.find('button.om-btn--primary').trigger('click');
    await flushPromises();
    expect(w.find('[data-open-error]').text()).toContain('is not inside a git repository');
    expect(useInsightStore().scr).toBe('welcome');
    w.unmount();
  });

  it('dropping a folder on the drop zone opens it', async () => {
    window.insight = makeBridge();
    const w = mountWelcome();
    await flushPromises();
    const file = { name: 'dropped' };
    dropOn(w.find('[data-drop-zone]'), file);
    await flushPromises();
    expect(window.insight.repo.openDropped).toHaveBeenCalledWith(file);
    expect(useInsightStore().scr).toBe('indexing');
    w.unmount();
  });

  it('with git missing, shows the install message and disables opening', async () => {
    const message = 'Git was not found on your PATH. Install Git for Windows, then restart the app.';
    window.insight = makeBridge();
    window.insight.git.check = vi.fn(async () => ({ available: false, version: null, raw: null, message }));
    const w = mountWelcome();
    await flushPromises();
    expect(w.find('[data-git-missing]').text()).toContain('Git was not found');
    const btn = w.find('button.om-btn--primary');
    expect(btn.attributes('disabled')).toBeDefined();
    await btn.trigger('click');
    dropOn(w.find('[data-drop-zone]'), { name: 'x' });
    await w.find('[data-recent]').trigger('click');
    await flushPromises();
    expect(window.insight.repo.openDialog).not.toHaveBeenCalled();
    expect(window.insight.repo.openDropped).not.toHaveBeenCalled();
    expect(window.insight.repo.openPath).not.toHaveBeenCalled();
    w.unmount();
  });

  it('mounts without the preload bridge (no crash, no recents)', async () => {
    const w = mountWelcome();
    await flushPromises();
    expect(w.text()).toContain('Open a repository.');
    expect(w.findAll('[data-recent]')).toHaveLength(0);
    w.unmount();
  });
});

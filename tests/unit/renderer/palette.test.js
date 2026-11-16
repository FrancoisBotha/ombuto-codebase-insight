// Command palette Files group (FR-008): file matches come from the
// files:search IPC query, not from sample data.
import { describe, it, expect, afterEach } from 'vitest';
import { palItems, refreshPaletteFiles } from '../../../src/renderer/lib/palette.js';

function fakeStore(state = {}) {
  const store = {
    state: { q: '', pi: 0, palFiles: undefined, ...state },
    props: { theme: 'dark' },
    go(id, extra) { store.state.screen = id; Object.assign(store.state, extra || {}); },
    setState(patch) { Object.assign(store.state, typeof patch === 'function' ? patch(store.state) : patch); },
  };
  return store;
}

describe('palette.js', () => {
  afterEach(() => {
    delete globalThis.window;
  });

  it('refreshPaletteFiles searches real paths via IPC and stores them in state', async () => {
    const calls = [];
    globalThis.window = { insight: { files: { search: async (q, n) => { calls.push([q, n]); return [{ path: 'src/app.js' }, { path: 'src/api/app.test.js' }]; } } } };
    const store = fakeStore({ q: 'app' });
    await refreshPaletteFiles(store);
    expect(calls).toEqual([['app', 5]]);
    expect(store.state.palFiles.map((f) => f.path)).toEqual(['src/app.js', 'src/api/app.test.js']);
  });

  it('refreshPaletteFiles clears the list for a blank query without calling IPC', async () => {
    let called = false;
    globalThis.window = { insight: { files: { search: async () => { called = true; return [{ path: 'x' }]; } } } };
    const store = fakeStore({ q: '   ', palFiles: [{ path: 'old' }] });
    await refreshPaletteFiles(store);
    expect(called).toBe(false);
    expect(store.state.palFiles).toEqual([]);
  });

  it('palItems lists the searched files under a Files header and opens them in Files', () => {
    const store = fakeStore({ q: 'app', palFiles: [{ path: 'src/app.js' }] });
    const items = palItems(store);
    const header = items.findIndex((i) => i.header === 'Files');
    expect(header).toBeGreaterThanOrEqual(0);
    const item = items[header + 1];
    expect(item.label).toBe('src/app.js');
    item.run();
    expect(store.state.screen).toBe('file');
    expect(store.state.fsel).toBe('src/app.js');
  });

  it('palItems shows no Files group and no sample paths when nothing was searched', () => {
    const store = fakeStore({ q: 'invoice' });
    const items = palItems(store);
    expect(items.some((i) => i.header === 'Files')).toBe(false);
    expect(items.some((i) => (i.label || '').includes('src/billing'))).toBe(false);
  });
});

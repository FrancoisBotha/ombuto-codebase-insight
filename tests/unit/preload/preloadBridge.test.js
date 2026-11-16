// The preload bridge (NFR-002): exposes the typed, read-only `window.insight`
// API over the shared IPC channels, resolves dropped folders with
// webUtils.getPathForFile, and main keeps contextIsolation/sandbox on and
// nodeIntegration off. Electron is mocked; the preload must stay CommonJS.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { IPC } from '../../../src/shared/ipcChannels.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const PRELOAD = path.join(ROOT, 'src/preload/preload.cjs');
const MAIN = path.join(ROOT, 'src/main/main.js');

const exposed = {};
const invoke = vi.fn(async () => 'result');
const send = vi.fn();
const listeners = new Map();
const electronMock = {
  contextBridge: { exposeInMainWorld: (name, api) => (exposed[name] = api) },
  ipcRenderer: {
    invoke,
    send,
    on: (ch, fn) => listeners.set(fn, ch),
    removeListener: (ch, fn) => listeners.delete(fn),
  },
  webUtils: { getPathForFile: vi.fn((file) => `/resolved/${file.name}`) },
};

function loadPreload() {
  // Load the CommonJS preload with the electron module swapped for the mock.
  const require = createRequire(import.meta.url);
  const Module = require('node:module');
  const original = Module._load;
  Module._load = function patched(request, ...rest) {
    if (request === 'electron') return electronMock;
    return original.call(this, request, ...rest);
  };
  try {
    delete require.cache[require.resolve(PRELOAD)];
    require(PRELOAD);
  } finally {
    Module._load = original;
  }
  return exposed.insight;
}

describe('preload bridge', () => {
  let api;
  beforeEach(() => {
    invoke.mockClear();
    send.mockClear();
    electronMock.webUtils.getPathForFile.mockClear();
    api = loadPreload();
  });

  it('keeps its channel names in sync with src/shared/ipcChannels.js', () => {
    const text = fs.readFileSync(PRELOAD, 'utf8');
    const block = /const IPC = \{([\s\S]*?)\n\};/.exec(text);
    expect(block).not.toBeNull();
    const pairs = [...block[1].matchAll(/^\s*([A-Z_]+):\s*'([^']+)'/gm)].map((m) => [m[1], m[2]]);
    expect(Object.fromEntries(pairs)).toEqual({ ...IPC });
  });

  it('exposes the window API with every query group', () => {
    expect(api).toBeDefined();
    expect(typeof api.getAppInfo).toBe('function');
    expect(typeof api.window.minimize).toBe('function');
    expect(typeof api.git.check).toBe('function');
    expect(typeof api.repo.openDialog).toBe('function');
    expect(typeof api.repo.openPath).toBe('function');
    expect(typeof api.repo.openDropped).toBe('function');
    expect(typeof api.repo.pathForFile).toBe('function');
    expect(typeof api.repo.refresh).toBe('function');
    expect(typeof api.repo.info).toBe('function');
    expect(typeof api.recents.list).toBe('function');
    expect(typeof api.recents.remove).toBe('function');
    expect(typeof api.run.status).toBe('function');
    expect(typeof api.run.onEvent).toBe('function');
    expect(typeof api.inventory.summary).toBe('function');
    expect(typeof api.files.tree).toBe('function');
    expect(typeof api.files.content).toBe('function');
    expect(typeof api.files.search).toBe('function');
  });

  it('routes each call to its channel with its arguments', async () => {
    await api.git.check();
    await api.repo.openDialog();
    await api.repo.openPath('C:\\code\\x');
    await api.recents.list();
    await api.recents.remove('abc');
    await api.run.status();
    await api.repo.refresh();
    await api.repo.info();
    await api.inventory.summary();
    await api.files.tree();
    await api.files.content('src/a.js');
    await api.files.search('app', 10);
    expect(invoke.mock.calls).toEqual([
      [IPC.GIT_CHECK],
      [IPC.REPO_OPEN_DIALOG],
      [IPC.REPO_OPEN_PATH, 'C:\\code\\x'],
      [IPC.RECENTS_LIST],
      [IPC.RECENTS_REMOVE, 'abc'],
      [IPC.RUN_STATUS],
      [IPC.REPO_REFRESH],
      [IPC.REPO_INFO],
      [IPC.INVENTORY],
      [IPC.FILE_TREE],
      [IPC.FILE_CONTENT, 'src/a.js'],
      [IPC.FILE_SEARCH, 'app', 10],
    ]);
  });

  it('resolves dropped folders with webUtils.getPathForFile, never a File path property', async () => {
    const file = { name: 'harbor-api', path: 'should-not-be-used' };
    expect(api.repo.pathForFile(file)).toBe('/resolved/harbor-api');
    await api.repo.openDropped(file);
    expect(electronMock.webUtils.getPathForFile).toHaveBeenCalledWith(file);
    expect(invoke).toHaveBeenCalledWith(IPC.REPO_OPEN_PATH, '/resolved/harbor-api');
  });

  it('run.onEvent subscribes to run events, hands the callback the payload only, and returns an unsubscribe', () => {
    const got = [];
    const off = api.run.onEvent((e) => got.push(e));
    expect(listeners.size).toBe(1);
    const [fn, channel] = [...listeners.entries()][0];
    expect(channel).toBe(IPC.RUN_EVENT);
    fn({ sender: 'ipc-event' }, { type: 'run:started', runId: 1 });
    expect(got).toEqual([{ type: 'run:started', runId: 1 }]);
    off();
    expect(listeners.size).toBe(0);
  });

  it('is CommonJS and never exposes ipcRenderer or Node directly', () => {
    const text = fs.readFileSync(PRELOAD, 'utf8');
    expect(text).toMatch(/require\('electron'\)/);
    expect(text).not.toMatch(/^\s*import\s/m);
    expect(api.ipcRenderer).toBeUndefined();
    expect(api.require).toBeUndefined();
  });
});

describe('main process hardening and handlers (text contract; main.js needs Electron to load)', () => {
  const text = fs.readFileSync(MAIN, 'utf8');

  it('keeps contextIsolation and sandbox on and nodeIntegration off', () => {
    expect(text).toMatch(/contextIsolation:\s*true/);
    expect(text).toMatch(/sandbox:\s*true/);
    expect(text).toMatch(/nodeIntegration:\s*false/);
  });

  it('registers a handler for every renderer → main query channel', () => {
    const queryChannels = Object.keys(IPC).filter((k) => !k.startsWith('WINDOW_') && k !== 'RUN_EVENT');
    for (const key of queryChannels) {
      expect(text, `ipcMain.handle(IPC.${key}`).toMatch(new RegExp(`ipcMain\\.handle\\(\\s*IPC\\.${key}\\b`));
    }
    expect(text).toMatch(/IPC\.RUN_EVENT/);
  });
});

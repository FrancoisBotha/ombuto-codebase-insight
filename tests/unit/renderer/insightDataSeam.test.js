// @vitest-environment happy-dom
// The data seam: Welcome and Indexing exports call the preload bridge, and
// the matching mock files are gone.
import { describe, it, expect, vi, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as data from '../../../src/renderer/data/insightData.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');

describe('insightData.js seam (Welcome + Indexing)', () => {
  afterEach(() => {
    delete window.insight;
  });

  it('no longer ships the Welcome and Indexing mock files or their exports', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/renderer/mock/screens/welcome.js'))).toBe(false);
    expect(fs.existsSync(path.join(ROOT, 'src/renderer/mock/screens/indexing.js'))).toBe(false);
    expect(data.WELCOME_RECENTS).toBeUndefined();
    expect(data.INDEXING_STAGES).toBeUndefined();
    expect(data.INDEXING_READY).toBeUndefined();
    expect(data.INDEXING_LOG).toBeUndefined();
    const seam = fs.readFileSync(path.join(ROOT, 'src/renderer/data/insightData.js'), 'utf8');
    expect(seam).not.toMatch(/mock\/screens\/welcome/);
    expect(seam).not.toMatch(/mock\/screens\/indexing/);
  });

  it('routes Welcome and Indexing calls through window.insight', async () => {
    const off = vi.fn();
    window.insight = {
      git: { check: vi.fn(async () => ({ available: true })) },
      repo: { openDialog: vi.fn(async () => 'd'), openPath: vi.fn(async () => 'p'), openDropped: vi.fn(async () => 'f'), refresh: vi.fn(async () => 'r'), info: vi.fn(async () => 'i') },
      recents: { list: vi.fn(async () => ['x']), remove: vi.fn(async () => 'rm') },
      run: { status: vi.fn(async () => 's'), onEvent: vi.fn(() => off) },
    };
    await expect(data.checkGit()).resolves.toEqual({ available: true });
    await expect(data.openRepoDialog()).resolves.toBe('d');
    await expect(data.openRepoPath('C:\\x')).resolves.toBe('p');
    expect(window.insight.repo.openPath).toHaveBeenCalledWith('C:\\x');
    const file = { name: 'f' };
    await expect(data.openDroppedFolder(file)).resolves.toBe('f');
    expect(window.insight.repo.openDropped).toHaveBeenCalledWith(file);
    await expect(data.refreshRepo()).resolves.toBe('r');
    await expect(data.getRepoInfo()).resolves.toBe('i');
    await expect(data.listRecents()).resolves.toEqual(['x']);
    await expect(data.removeRecent('id')).resolves.toBe('rm');
    expect(window.insight.recents.remove).toHaveBeenCalledWith('id');
    await expect(data.getRunStatus()).resolves.toBe('s');
    const cb = () => {};
    expect(data.onRunEvent(cb)).toBe(off);
    expect(window.insight.run.onEvent).toHaveBeenCalledWith(cb);
  });

  it('degrades safely without the bridge', async () => {
    const git = await data.checkGit();
    expect(git.available).toBe(false);
    expect(typeof git.message).toBe('string');
    await expect(data.listRecents()).resolves.toEqual([]);
    await expect(data.getRunStatus()).resolves.toBeNull();
    await expect(data.getRepoInfo()).resolves.toBeNull();
    const open = await data.openRepoDialog();
    expect(open.ok).toBe(false);
    expect(typeof data.onRunEvent(() => {})).toBe('function');
  });
});

import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRecentsStore, openRecentsStore, MAX_RECENTS } from '../../../src/main/repo/recentsStore.js';

function memoryStore(initial = {}) {
  const data = { ...initial };
  return {
    get: (key, fallback) => (key in data ? data[key] : fallback),
    set: (key, value) => {
      data[key] = value;
    },
    data,
  };
}

function clock(start = '2026-11-15T10:00:00.000Z') {
  let t = new Date(start).getTime();
  return {
    now: () => new Date(t).toISOString(),
    tick: (ms = 60_000) => {
      t += ms;
    },
  };
}

describe('recentsStore', () => {
  it('starts empty and upserts an entry with path, repoId, display name and last-analysed time', () => {
    const c = clock();
    const recents = createRecentsStore({ store: memoryStore(), now: c.now });
    expect(recents.list()).toEqual([]);

    const entry = recents.upsert({
      path: 'C:\\code\\harbor-api',
      repoId: 'abc123',
      displayName: 'harbor-api',
      lastAnalysedAt: '2026-11-14T09:00:00.000Z',
    });
    expect(entry).toMatchObject({
      path: 'C:\\code\\harbor-api',
      repoId: 'abc123',
      displayName: 'harbor-api',
      lastAnalysedAt: '2026-11-14T09:00:00.000Z',
      lastOpenedAt: c.now(),
    });
    expect(recents.list()).toHaveLength(1);
  });

  it('upsert is keyed by repoId and keeps lastAnalysedAt when not given; display name defaults to the folder name', () => {
    const c = clock();
    const recents = createRecentsStore({ store: memoryStore(), now: c.now });
    recents.upsert({ path: '/home/me/proj', repoId: 'r1', lastAnalysedAt: '2026-11-01T00:00:00.000Z' });
    c.tick();
    const updated = recents.upsert({ path: '/home/me/proj-moved', repoId: 'r1' });

    expect(recents.list()).toHaveLength(1);
    expect(updated.path).toBe('/home/me/proj-moved');
    expect(updated.displayName).toBe('proj-moved');
    expect(updated.lastAnalysedAt).toBe('2026-11-01T00:00:00.000Z');
    expect(updated.lastOpenedAt).toBe(c.now());
  });

  it('lists most recently opened first', () => {
    const c = clock();
    const recents = createRecentsStore({ store: memoryStore(), now: c.now });
    recents.upsert({ path: '/a', repoId: 'a' });
    c.tick();
    recents.upsert({ path: '/b', repoId: 'b' });
    c.tick();
    recents.upsert({ path: '/c', repoId: 'c' });
    expect(recents.list().map((e) => e.repoId)).toEqual(['c', 'b', 'a']);

    c.tick();
    recents.touch('a');
    expect(recents.list().map((e) => e.repoId)).toEqual(['a', 'c', 'b']);
  });

  it('touch updates lastOpenedAt and lastAnalysedAt (defaulting to now) and returns null for unknown ids', () => {
    const c = clock();
    const recents = createRecentsStore({ store: memoryStore(), now: c.now });
    recents.upsert({ path: '/a', repoId: 'a' });
    c.tick();
    const touched = recents.touch('a');
    expect(touched.lastAnalysedAt).toBe(c.now());
    expect(touched.lastOpenedAt).toBe(c.now());

    c.tick();
    const explicit = recents.touch('a', { lastAnalysedAt: '2026-11-15T12:34:56.000Z' });
    expect(explicit.lastAnalysedAt).toBe('2026-11-15T12:34:56.000Z');
    expect(explicit.lastOpenedAt).toBe(c.now());

    expect(recents.touch('nope')).toBeNull();
  });

  it('remove deletes the entry and invokes the callback with the entry so the repo data folder can be deleted', async () => {
    const recents = createRecentsStore({ store: memoryStore() });
    recents.upsert({ path: '/a', repoId: 'a' });
    recents.upsert({ path: '/b', repoId: 'b' });

    const deleted = [];
    const removed = await recents.remove('a', async (entry) => {
      deleted.push(entry.repoId);
    });
    expect(removed.repoId).toBe('a');
    expect(deleted).toEqual(['a']);
    expect(recents.list().map((e) => e.repoId)).toEqual(['b']);

    expect(await recents.remove('missing', async () => deleted.push('x'))).toBeNull();
    expect(deleted).toEqual(['a']);
  });

  it('remove keeps the entry when the delete callback fails, and rethrows', async () => {
    const recents = createRecentsStore({ store: memoryStore() });
    recents.upsert({ path: '/a', repoId: 'a' });
    await expect(recents.remove('a', async () => { throw new Error('EBUSY'); })).rejects.toThrow('EBUSY');
    expect(recents.list()).toHaveLength(1);
  });

  it('remove works without a callback', async () => {
    const recents = createRecentsStore({ store: memoryStore() });
    recents.upsert({ path: '/a', repoId: 'a' });
    await recents.remove('a');
    expect(recents.list()).toEqual([]);
  });

  it('rejects upserts without a path or repoId', () => {
    const recents = createRecentsStore({ store: memoryStore() });
    expect(() => recents.upsert({ repoId: 'x' })).toThrow(/path/);
    expect(() => recents.upsert({ path: '/x' })).toThrow(/repoId/);
  });

  it('caps the list at MAX_RECENTS, dropping the least recently opened', () => {
    const c = clock();
    const recents = createRecentsStore({ store: memoryStore(), now: c.now });
    for (let i = 0; i < MAX_RECENTS + 3; i += 1) {
      recents.upsert({ path: `/r${i}`, repoId: `r${i}` });
      c.tick();
    }
    const ids = recents.list().map((e) => e.repoId);
    expect(ids).toHaveLength(MAX_RECENTS);
    expect(ids).not.toContain('r0');
    expect(ids[0]).toBe(`r${MAX_RECENTS + 2}`);
  });

  it('persists through the underlying store so a fresh instance sees the same list', () => {
    const store = memoryStore();
    createRecentsStore({ store }).upsert({ path: '/a', repoId: 'a' });
    const again = createRecentsStore({ store });
    expect(again.list().map((e) => e.repoId)).toEqual(['a']);
    expect(again.get('a').path).toBe('/a');
  });

  it('openRecentsStore uses electron-store and writes a JSON file in the given folder', async () => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-recents-'));
    try {
      const recents = await openRecentsStore({ cwd, name: 'recents-test' });
      recents.upsert({ path: 'C:\\code\\x', repoId: 'x', displayName: 'x' });
      const file = path.join(cwd, 'recents-test.json');
      expect(fs.existsSync(file)).toBe(true);
      const json = JSON.parse(fs.readFileSync(file, 'utf8'));
      expect(json.recents[0].repoId).toBe('x');

      const reopened = await openRecentsStore({ cwd, name: 'recents-test' });
      expect(reopened.list()[0].path).toBe('C:\\code\\x');
    } finally {
      fs.rmSync(cwd, { recursive: true, force: true });
    }
  });
});

// The renderer data seam (FR-007, FR-008): the Inventory and Files exports
// call the preload bridge (window.insight.*) instead of re-exporting sample data.
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as data from '../../../src/renderer/data/insightData.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const mockDir = path.resolve(here, '../../../src/renderer/mock/screens');

describe('insightData.js — Inventory and Files on IPC', () => {
  afterEach(() => {
    delete globalThis.window;
  });

  it('fetchInventory calls window.insight.inventory.summary and returns its result', async () => {
    const calls = [];
    globalThis.window = { insight: { inventory: { summary: async (o) => { calls.push(o); return { totals: { files: 3 } }; } } } };
    const res = await data.fetchInventory({ largestLimit: 6 });
    expect(res).toEqual({ totals: { files: 3 } });
    expect(calls).toEqual([{ largestLimit: 6 }]);
  });

  it('fetchFileTree and fetchFileContent call window.insight.files', async () => {
    const calls = [];
    globalThis.window = {
      insight: {
        files: {
          tree: async () => { calls.push('tree'); return { fileCount: 1, children: [] }; },
          content: async (p) => { calls.push('content:' + p); return { path: p, content: 'x' }; },
          search: async () => [],
        },
      },
    };
    expect(await data.fetchFileTree()).toEqual({ fileCount: 1, children: [] });
    expect(await data.fetchFileContent('src/a.js')).toEqual({ path: 'src/a.js', content: 'x' });
    expect(calls).toEqual(['tree', 'content:src/a.js']);
  });

  it('searchFiles calls window.insight.files.search with the query and limit', async () => {
    const calls = [];
    globalThis.window = { insight: { files: { search: async (q, n) => { calls.push([q, n]); return [{ path: 'src/a.js' }]; } } } };
    expect(await data.searchFiles('a.js', 5)).toEqual([{ path: 'src/a.js' }]);
    expect(calls).toEqual([['a.js', 5]]);
  });

  it('degrades to empty results when the preload bridge is missing', async () => {
    expect(await data.fetchInventory()).toBeNull();
    expect(await data.fetchFileTree()).toBeNull();
    expect(await data.fetchFileContent('x')).toBeNull();
    expect(await data.searchFiles('x')).toEqual([]);
  });

  it('no longer exports the inventory and file sample data', () => {
    for (const name of Object.keys(data)) {
      expect(name.startsWith('INVENTORY_'), name).toBe(false);
      expect(name.startsWith('FILE_'), name).toBe(false);
    }
  });

  it('mock/screens/inventory.js and mock/screens/file.js are deleted', () => {
    expect(fs.existsSync(path.join(mockDir, 'inventory.js'))).toBe(false);
    expect(fs.existsSync(path.join(mockDir, 'file.js'))).toBe(false);
  });
});

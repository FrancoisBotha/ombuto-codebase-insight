// @vitest-environment happy-dom
// Size & Inventory on real data (FR-007, FR-010): totals, lines by language,
// size distribution, largest files and lines by folder come from the
// inventory IPC query; parser-derived cells say "Not analysed yet".
import { describe, it, expect, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import InventoryView from '../../../src/renderer/views/InventoryView.vue';
import { useInsightStore } from '../../../src/renderer/stores/insightStore.js';

const INVENTORY = {
  commitSha: 'a'.repeat(40),
  totals: { files: 12, sourceFiles: 10, binaryFiles: 1, generatedFiles: 1, lines: 2113, sourceLines: 2110, bytes: 60000 },
  languages: [
    { language: 'javascript', files: 6, lines: 1920, bytes: 50000, share: 0.91 },
    { language: 'sql', files: 1, lines: 150, bytes: 3000, share: 0.07 },
    { language: null, files: 3, lines: 40, bytes: 900, share: 0.02 },
  ],
  sizeDistribution: {
    files: 10, lines: 2110, median: 80, p90: 500, max: 900, mean: 211,
    histogram: [
      { label: '<50', min: 0, max: 50, files: 4, lines: 100 },
      { label: '50–100', min: 50, max: 100, files: 2, lines: 160 },
      { label: '100–200', min: 100, max: 200, files: 1, lines: 150 },
      { label: '200–400', min: 200, max: 400, files: 1, lines: 300 },
      { label: '400–800', min: 400, max: 800, files: 1, lines: 500 },
      { label: '800+', min: 800, max: null, files: 1, lines: 900 },
    ],
    concentration: { topFiles: 1, topShare: 0.43, filesForHalf: 2 },
  },
  largestFiles: [
    { path: 'tests/app.test.js', language: 'javascript', lines: 900, bytes: 9000 },
    { path: 'src/api/handlers.js', language: 'javascript', lines: 500, bytes: 5000 },
  ],
  folders: [
    { folder: 'tests', files: 1, lines: 900, bytes: 9000 },
    { folder: 'src/api', files: 2, lines: 800, bytes: 8000 },
  ],
};

function mountView() {
  const pinia = createPinia();
  const wrapper = mount(InventoryView, {
    global: { plugins: [pinia], directives: { hover: {} }, stubs: { Teleport: true } },
  });
  return { wrapper, store: useInsightStore(pinia) };
}

const SAMPLE_STRINGS = ['harbor', '48,212', 'salesforce', '1,284', 'placeOrder', 'src/integrations', '612 files'];

describe('InventoryView.vue', () => {
  afterEach(() => {
    delete window.insight;
  });

  it('shows real totals, languages, size distribution, largest files and folders from IPC', async () => {
    window.insight = { inventory: { summary: async () => INVENTORY } };
    const { wrapper } = mountView();
    await flushPromises();
    const text = wrapper.text();

    expect(text).toContain('12 files');
    expect(text).toContain('2,113');
    expect(text).toContain('JavaScript');
    expect(text).toContain('1,920');
    expect(text).toContain('SQL');
    expect(text).toContain('<50');
    expect(text).toContain('800+');
    expect(text).toContain('tests/app.test.js');
    expect(text).toContain('src/api/handlers.js');
    expect(text).toContain('src/api');
    expect(text).toContain('43%');
    for (const s of SAMPLE_STRINGS) expect(text).not.toContain(s);

    const html = wrapper.html();
    expect(html).toMatch(/Median[\s\S]*?>80</);
    expect(html).toMatch(/P90[\s\S]*?>500</);
    expect(html).toMatch(/Max[\s\S]*?>900</);
    wrapper.unmount();
  });

  it('says "Not analysed yet" for functions, classes, types, comments and blanks', async () => {
    window.insight = { inventory: { summary: async () => INVENTORY } };
    const { wrapper } = mountView();
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('Functions');
    expect(text).toContain('Classes');
    expect(text).toContain('Types');
    expect(text).toContain('Comment lines');
    expect(text).toContain('Blank lines');
    expect((text.match(/Not analysed yet/g) || []).length).toBeGreaterThanOrEqual(5);
    wrapper.unmount();
  });

  it('opens a largest file in Files when clicked', async () => {
    window.insight = { inventory: { summary: async () => INVENTORY } };
    const { wrapper, store } = mountView();
    await flushPromises();
    const row = wrapper
      .findAll('div')
      .find((d) => /cursor:\s*pointer/.test(d.attributes('style') || '') && d.text().includes('tests/app.test.js'));
    expect(row).toBeTruthy();
    await row.trigger('click');
    expect(store.state.screen).toBe('file');
    expect(store.state.fsel).toBe('tests/app.test.js');
    wrapper.unmount();
  });

  it('shows no sample data when no repository is open', async () => {
    const { wrapper } = mountView();
    await flushPromises();
    const text = wrapper.text();
    for (const s of SAMPLE_STRINGS) expect(text).not.toContain(s);
    wrapper.unmount();
  });
});

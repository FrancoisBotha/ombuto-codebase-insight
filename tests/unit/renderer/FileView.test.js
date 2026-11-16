// @vitest-environment happy-dom
// Files on real data (FR-008, FR-010): explorer tree with filter, file content
// from the database in the code pane with a language mode, binary files not
// viewable, and no sample data in the side panels.
import { describe, it, expect, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import FileView from '../../../src/renderer/views/FileView.vue';
import { useInsightStore } from '../../../src/renderer/stores/insightStore.js';

const file = (path, extra = {}) => ({
  type: 'file', name: path.slice(path.lastIndexOf('/') + 1), path,
  language: 'javascript', lines: 2, bytes: 20, isBinary: false, isGenerated: false, ...extra,
});
const dir = (path, children) => ({
  type: 'dir', name: path.slice(path.lastIndexOf('/') + 1), path, children,
  fileCount: children.length, lines: 0, bytes: 0,
});

const TREE = {
  commitSha: 'a'.repeat(40),
  fileCount: 4,
  children: [
    dir('src', [dir('src/api', [file('src/api/routes.js')]), file('src/app.js')]),
    file('README.md', { language: 'markdown' }),
    file('logo.png', { language: null, lines: 0, bytes: 2048, isBinary: true }),
  ],
};

const CONTENT = {
  'src/app.js': { ...file('src/app.js'), content: 'export const answer = 42;\nexport const b = 2;\n' },
  'src/api/routes.js': { ...file('src/api/routes.js'), content: 'routes\n' },
  'README.md': { ...file('README.md', { language: 'markdown' }), content: '# Hi\n' },
  'logo.png': { ...file('logo.png', { language: null, lines: 0, bytes: 2048, isBinary: true }), content: null },
};

const CodeViewStub = {
  props: ['code', 'language', 'start', 'variant'],
  template: '<pre class="code-stub" :data-language="language">{{ code }}</pre>',
};

function mountView(state = {}) {
  const pinia = createPinia();
  const store = useInsightStore(pinia);
  store.setState(state);
  const wrapper = mount(FileView, {
    global: { plugins: [pinia], directives: { hover: {} }, stubs: { Teleport: true, CodeView: CodeViewStub } },
  });
  return { wrapper, store };
}

function bridge() {
  const calls = [];
  window.insight = {
    files: {
      tree: async () => { calls.push('tree'); return TREE; },
      content: async (p) => { calls.push('content:' + p); return CONTENT[p] ?? null; },
      search: async () => [],
    },
  };
  return calls;
}

const SAMPLE_STRINGS = ['invoice.ts', 'buildInvoice', 'm.okafor', 'src/billing', '612 files', 'Stripe'];

describe('FileView.vue', () => {
  afterEach(() => {
    delete window.insight;
  });

  it('renders the real explorer tree and the file count', async () => {
    bridge();
    const { wrapper } = mountView({ fsel: 'src/app.js' });
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('src');
    expect(text).toContain('app.js');
    expect(text).toContain('README.md');
    expect(text).toContain('logo.png');
    expect(text).toContain('4 files');
    for (const s of SAMPLE_STRINGS) expect(text).not.toContain(s);
    wrapper.unmount();
  });

  it('filters the tree by the explorer filter', async () => {
    bridge();
    const { wrapper } = mountView({ fsel: 'src/app.js' });
    await flushPromises();
    await wrapper.find('input').setValue('routes');
    await flushPromises();
    const text = wrapper.text();
    expect(text).toContain('routes.js');
    expect(text).not.toContain('README.md');
    expect(text).not.toContain('logo.png');
    wrapper.unmount();
  });

  it('shows the selected file content in the code pane with a language mode', async () => {
    const calls = bridge();
    const { wrapper } = mountView({ fsel: 'src/app.js' });
    await flushPromises();
    const pane = wrapper.find('.code-stub');
    expect(pane.exists()).toBe(true);
    expect(pane.text()).toContain('export const answer = 42;');
    expect(pane.attributes('data-language')).toBe('javascript');
    expect(calls).toContain('content:src/app.js');
    expect(wrapper.text()).toContain('2 lines');
    expect(wrapper.text()).toContain('JavaScript');
    wrapper.unmount();
  });

  it('switches content when a file is picked in the tree', async () => {
    bridge();
    const { wrapper, store } = mountView({ fsel: 'src/app.js' });
    await flushPromises();
    const row = wrapper.findAll('div').find((d) => d.attributes('title') === 'README.md');
    expect(row).toBeTruthy();
    await row.trigger('click');
    await flushPromises();
    expect(store.state.fsel).toBe('README.md');
    expect(wrapper.find('.code-stub').text()).toContain('# Hi');
    wrapper.unmount();
  });

  it('shows binary files as not viewable', async () => {
    bridge();
    const { wrapper } = mountView({ fsel: 'logo.png' });
    await flushPromises();
    expect(wrapper.find('.code-stub').exists()).toBe(false);
    expect(wrapper.text().toLowerCase()).toContain('not viewable');
    wrapper.unmount();
  });

  it('side panels show "Not analysed yet" instead of sample metrics', async () => {
    bridge();
    const { wrapper } = mountView({ fsel: 'src/app.js' });
    await flushPromises();
    expect(wrapper.text()).toContain('Not analysed yet');
    for (const s of SAMPLE_STRINGS) expect(wrapper.text()).not.toContain(s);
    wrapper.unmount();
  });

  it('renders an empty state without the preload bridge and without sample data', async () => {
    const { wrapper } = mountView();
    await flushPromises();
    for (const s of SAMPLE_STRINGS) expect(wrapper.text()).not.toContain(s);
    wrapper.unmount();
  });
});

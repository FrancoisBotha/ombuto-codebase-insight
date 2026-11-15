// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import App from '../../src/renderer/App.vue';

describe('App.vue', () => {
  afterEach(() => {
    delete window.insight;
  });

  it('renders the shell title and the version from the preload bridge', async () => {
    window.insight = { getAppInfo: async () => ({ name: 'insight', version: '9.9.9' }) };
    const wrapper = mount(App, { global: { plugins: [createPinia()], directives: { hover: {} } } });
    await flushPromises();
    expect(wrapper.text()).toContain('Codebase Insight');
    expect(wrapper.text()).toContain('Codebase Insight 9.9.9');
    wrapper.unmount();
  });
});

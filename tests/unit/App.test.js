// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { mount, flushPromises } from '@vue/test-utils';
import { createPinia } from 'pinia';
import App from '../../src/renderer/App.vue';

describe('App.vue', () => {
  afterEach(() => {
    delete window.insight;
  });

  it('renders the title and the version from the preload bridge', async () => {
    window.insight = { getAppInfo: async () => ({ name: 'insight', version: '9.9.9' }) };
    const wrapper = mount(App, { global: { plugins: [createPinia()] } });
    await flushPromises();
    expect(wrapper.text()).toContain('Ombuto Codebase Insight');
    expect(wrapper.text()).toContain('v9.9.9');
  });
});

// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import OmPrototypeBanner from '../../../src/renderer/components/ds/OmPrototypeBanner.vue';

describe('OmPrototypeBanner.vue', () => {
  it('shows the prototype notice text', () => {
    const wrapper = mount(OmPrototypeBanner);
    expect(wrapper.text()).toBe('Prototype — this screen shows sample data, not your repository');
    wrapper.unmount();
  });

  it('shows the flask-outline icon', () => {
    const wrapper = mount(OmPrototypeBanner);
    const icon = wrapper.find('.mdi.mdi-flask-outline');
    expect(icon.exists()).toBe(true);
    wrapper.unmount();
  });

  it('is a slim strip styled with the info tone tokens', () => {
    const wrapper = mount(OmPrototypeBanner);
    const root = wrapper.find('.om-prototype-banner');
    expect(root.exists()).toBe(true);
    expect(root.attributes('role')).toBe('note');
    const style = root.attributes('style') || '';
    expect(style).toContain('--om-tone-blue-bg');
    expect(style).toContain('--om-tone-blue-fg');
    expect(style).toContain('flex-shrink: 0');
    wrapper.unmount();
  });
});

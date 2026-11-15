// @vitest-environment happy-dom
import { describe, it, expect, afterEach } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import OverviewView from '../../../src/renderer/views/OverviewView.vue';
import ComplexityView from '../../../src/renderer/views/ComplexityView.vue';
import HotspotsView from '../../../src/renderer/views/HotspotsView.vue';
import HistoryView from '../../../src/renderer/views/HistoryView.vue';
import ArchitectureView from '../../../src/renderer/views/ArchitectureView.vue';
import QualityView from '../../../src/renderer/views/QualityView.vue';
import DepsView from '../../../src/renderer/views/DepsView.vue';
import AskView from '../../../src/renderer/views/AskView.vue';
import DiagramsView from '../../../src/renderer/views/DiagramsView.vue';
import ReportView from '../../../src/renderer/views/ReportView.vue';
import SettingsView from '../../../src/renderer/views/SettingsView.vue';
import WelcomeView from '../../../src/renderer/views/WelcomeView.vue';
import IndexingView from '../../../src/renderer/views/IndexingView.vue';
import InventoryView from '../../../src/renderer/views/InventoryView.vue';
import FileView from '../../../src/renderer/views/FileView.vue';

const BANNER = '.om-prototype-banner';
const TEXT = 'Prototype — this screen shows sample data, not your repository';

function mountView(component) {
  return mount(component, {
    global: {
      plugins: [createPinia()],
      directives: { hover: {} },
      stubs: { Teleport: true, CodeView: true },
    },
  });
}

const WITH_BANNER = [
  ['Overview', OverviewView], ['Complexity', ComplexityView], ['Hotspots', HotspotsView],
  ['History', HistoryView], ['Architecture', ArchitectureView], ['Quality', QualityView],
  ['Deps', DepsView], ['Ask', AskView], ['Diagrams', DiagramsView], ['Report', ReportView],
];

const WITHOUT_BANNER = [
  ['Welcome', WelcomeView], ['Indexing', IndexingView], ['Inventory', InventoryView], ['File', FileView],
];

describe('Prototype banner placement', () => {
  afterEach(() => {
    delete window.insight;
  });

  describe.each(WITH_BANNER)('%s view', (_name, component) => {
    it('shows exactly one prototype banner with the notice text', () => {
      const wrapper = mountView(component);
      const banners = wrapper.findAll(BANNER);
      expect(banners).toHaveLength(1);
      expect(banners[0].text()).toBe(TEXT);
      wrapper.unmount();
    });
  });

  describe.each(WITHOUT_BANNER)('%s view', (_name, component) => {
    it('shows no prototype banner', () => {
      const wrapper = mountView(component);
      expect(wrapper.findAll(BANNER)).toHaveLength(0);
      wrapper.unmount();
    });
  });

  it('Settings shows a banner under the mock-backed LLM Provider and Analysis sections only', () => {
    const wrapper = mountView(SettingsView);
    const banners = wrapper.findAll(BANNER);
    expect(banners).toHaveLength(2);
    const html = wrapper.html();
    const idx = (s) => html.indexOf(s);
    const [llm, analysis, appearance] = [idx('LLM Provider'), idx('>Analysis<'), idx('>Appearance<')];
    const bannerIdx = [...html.matchAll(/om-prototype-banner/g)].map((m) => m.index);
    expect(bannerIdx[0]).toBeGreaterThan(llm);
    expect(bannerIdx[0]).toBeLessThan(analysis);
    expect(bannerIdx[1]).toBeGreaterThan(analysis);
    expect(bannerIdx[1]).toBeLessThan(appearance);
    wrapper.unmount();
  });
});

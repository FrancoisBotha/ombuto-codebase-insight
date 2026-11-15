// UI state for the whole app. Mirrors the prototype's single component state
// (docs/References/Ombuto Codebase Insight prototype) so that deep links between
// screens behave exactly as designed. See docs/Architecture/prototype-port.md.
import { defineStore } from 'pinia';
import { reactive, computed } from 'vue';

// The prototype's initial state, verbatim.
const INITIAL = {
  screen: null, theme: null, collapsed: false, pal: false, q: '', pi: 0,
  metric: 'cxc', sel: 'src/billing/invoice.ts', explain: 'idle',
  arch: 'module', node: 'billing', c4sel: 'api', cycles: true, clusters: true, hideShared: false, zoom: 0.8,
  diagram: 'erd', dtab: 'canvas', exportOpen: false, toast: null,
  cite: 1, extra: [], askInput: '', asking: false, ftab: 'metrics',
  sortKey: 'vulns', sortDir: -1, depFilter: 'all', depQ: '', badgeStyle: 'flat', copied: null,
  llm: 'local', t: 34, skipLlm: false,
  sections: { summary: true, health: true, hotspots: true, risks: true, deps: true, ai: true },
  ignored: ['node_modules/', 'dist/', 'coverage/', '**/*.generated.ts', 'vendor/'],
};

// Keys the prototype sets later without declaring them up front. Declared here
// (as undefined, matching the prototype's `S.x || default` reads) so Vue tracks them.
const LATE_KEYS = [
  'cli', 'cxF', 'cxSel', 'cxTh', 'fsel', 'gMain', 'gsel', 'mdlg', 'mfilter', 'mq', 'msort',
  'orCleared', 'orDefault', 'orInput', 'orModels', 'orVals', 'ptab', 'qtab', 'tbColor', 'tg',
  'topen', 'tq', 'unitLang',
];

// The prototype's dev-only "Tweaks" props. In dev builds they can be set with
// URL query params, e.g. ?startScreen=overview&viewState=error&theme=light.
function readTweaks() {
  const props = { theme: 'dark', viewState: 'loaded', startScreen: 'welcome' };
  if (import.meta.env?.DEV && typeof window !== 'undefined') {
    const q = new URLSearchParams(window.location.search);
    for (const k of Object.keys(props)) if (q.get(k)) props[k] = q.get(k);
  }
  return props;
}

export const useInsightStore = defineStore('insight', () => {
  const state = reactive({ ...structuredClone(INITIAL), ...Object.fromEntries(LATE_KEYS.map((k) => [k, undefined])) });
  const props = reactive(readTweaks());
  const timers = {};

  /** Current screen id (prototype: scr()). */
  const scr = computed(() => state.screen || props.startScreen || 'welcome');
  /** Active theme (prototype: S.theme || props.theme || 'dark'). */
  const theme = computed(() => state.theme || props.theme || 'dark');
  /** Overview view state tweak (prototype: props.viewState || 'loaded'). */
  const viewState = computed(() => props.viewState || 'loaded');

  /** Prototype setState: accepts a patch object or a function of state. */
  function setState(patch) {
    const p = typeof patch === 'function' ? patch(state) : patch;
    if (p) Object.assign(state, p);
  }

  /** Prototype go(): navigate, closing the palette and export menu. */
  function go(id, extra) {
    setState({ screen: id, pal: false, exportOpen: false, ...(extra || {}) });
  }

  /** Named timeout; re-scheduling the same key clears the previous one. */
  function later(key, ms, fn) {
    clearTimeout(timers[key]);
    timers[key] = setTimeout(fn, ms);
  }

  /** Prototype toast(): show for 2.6s and close the export menu. */
  function toast(m) {
    setState({ toast: m, exportOpen: false });
    later('toast', 2600, () => setState({ toast: null }));
  }

  return { state, props, scr, theme, viewState, setState, go, later, toast };
});

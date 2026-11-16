<script setup>
// App shell (prototype root, lines 26–1781): title bar, sidebar, active screen,
// status bar, command palette and toast, plus the global keyboard shortcuts.
// The status bar reads the open repo and run from repoStore (epic 1 UI notes §6);
// the prototype's indexing ticker is gone, real worker events drive progress.
import { computed, onMounted, onBeforeUnmount } from 'vue';
import { useAppStore } from './stores/appStore.js';
import { useInsightStore } from './stores/insightStore.js';
import { useRepoStore } from './stores/repoStore.js';
import { formatRelative } from './lib/indexingModel.js';
import { NAV } from './lib/constants.js';
import { palItems } from './lib/palette.js';
import TitleBar from './components/shell/TitleBar.vue';
import AppSidebar from './components/shell/AppSidebar.vue';
import CommandPalette from './components/shell/CommandPalette.vue';
import OmStatusBar from './components/ds/OmStatusBar.vue';
import WelcomeView from './views/WelcomeView.vue';
import IndexingView from './views/IndexingView.vue';
import OverviewView from './views/OverviewView.vue';
import InventoryView from './views/InventoryView.vue';
import ArchitectureView from './views/ArchitectureView.vue';
import ComplexityView from './views/ComplexityView.vue';
import QualityView from './views/QualityView.vue';
import DepsView from './views/DepsView.vue';
import HotspotsView from './views/HotspotsView.vue';
import HistoryView from './views/HistoryView.vue';
import AskView from './views/AskView.vue';
import DiagramsView from './views/DiagramsView.vue';
import FileView from './views/FileView.vue';
import ReportView from './views/ReportView.vue';
import SettingsView from './views/SettingsView.vue';

const appStore = useAppStore();
const store = useInsightStore();
const repoStore = useRepoStore();
const S = store.state;

const VIEWS = {
  welcome: WelcomeView, indexing: IndexingView, overview: OverviewView, inventory: InventoryView,
  architecture: ArchitectureView, complexity: ComplexityView, quality: QualityView, deps: DepsView,
  hotspots: HotspotsView, history: HistoryView, ask: AskView, diagrams: DiagramsView,
  file: FileView, report: ReportView, settings: SettingsView,
};
const view = computed(() => VIEWS[store.scr] || WelcomeView);
const hasRepo = computed(() => store.scr !== 'welcome');

const sb = computed(() => {
  const scr = store.scr;
  const repo = repoStore.repo;
  const info = repoStore.info;
  if (scr === 'welcome' || !repo) return { path: 'No repository open', branch: '', project: '' };
  const analysing = scr === 'indexing' || repoStore.indexing;
  return {
    path: repo.path,
    branch: repo.branch || (repo.headSha || '').slice(0, 7),
    project: analysing
      ? 'Analysing… ' + Math.round(repoStore.progress * 100) + '%'
      : (info?.fileCount ?? 0).toLocaleString() + ' files · analysed ' + formatRelative(info?.analysedAt ?? repo.lastAnalysedAt),
  };
});
const build = computed(() => 'Codebase Insight ' + (appStore.version || ''));

function onKey(e) {
  const mod = e.metaKey || e.ctrlKey;
  const k = e.key.toLowerCase();
  if (mod && k === 'k') { e.preventDefault(); store.setState((s) => ({ pal: !s.pal, q: '', pi: 0 })); return; }
  if (S.pal) {
    const items = palItems(store).filter((i) => !i.header);
    if (e.key === 'Escape') store.setState({ pal: false });
    else if (e.key === 'ArrowDown') { e.preventDefault(); store.setState((s) => ({ pi: Math.min(items.length - 1, s.pi + 1) })); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); store.setState((s) => ({ pi: Math.max(0, s.pi - 1) })); }
    else if (e.key === 'Enter') { const it = items[S.pi]; it && it.run(); }
    return;
  }
  if (e.key === 'Escape' && S.exportOpen) store.setState({ exportOpen: false });
  if (e.key === 'Escape' && S.mdlg) { store.setState({ mdlg: false }); return; }
  if (mod && /^[1-9]$/.test(e.key) && store.scr !== 'welcome') { e.preventDefault(); store.go(NAV[+e.key - 1].id); }
  if (mod && e.key === ',') { e.preventDefault(); store.go('settings'); }
  if (mod && k === 'b') { e.preventDefault(); store.setState((s) => ({ collapsed: !s.collapsed })); }
  if (mod && k === 'o') { e.preventDefault(); repoStore.openDialog(); }
  if (mod && k === 'r') { e.preventDefault(); repoStore.refresh(); }
}

onMounted(() => {
  appStore.loadAppInfo();
  repoStore.start();
  window.addEventListener('keydown', onKey);
});
onBeforeUnmount(() => {
  repoStore.stop();
  window.removeEventListener('keydown', onKey);
});
</script>

<template>
  <div id="om-root" class="om-root" :data-theme="store.theme" style="width:100%;height:100vh;min-height:760px;display:flex;flex-direction:column;background:var(--om-bg);color:var(--om-text);overflow:hidden;position:relative">
    <TitleBar />
    <div style="flex:1;display:flex;min-height:0">
      <AppSidebar v-if="hasRepo" />
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;background:var(--om-bg)">
        <component :is="view" />
      </div>
    </div>
    <div data-theme="dark">
      <OmStatusBar :path="sb.path" :branch="sb.branch" :project="sb.project" :build="build" />
    </div>
    <CommandPalette />
    <div v-if="S.toast" style="position:absolute;right:20px;bottom:40px;z-index:1300;display:flex;align-items:center;gap:8px;padding:9px 14px;border-radius:6px;background:var(--om-dialog);border:1px solid var(--om-border);box-shadow:0 4px 20px rgba(0,0,0,.5);font-size:.78rem;color:var(--om-text-strong)"><span class="mdi mdi-check-circle" style="color:var(--om-mint)"></span>{{ S.toast }}</div>
  </div>
</template>

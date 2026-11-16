<script setup>
// Welcome screen (prototype lines 134–180) on real data (epic 1 FR-001..FR-003):
// native folder dialog, drop zone, git check and recents from the preload bridge.
import { computed, onMounted } from 'vue';
import { useRepoStore } from '../stores/repoStore.js';
import { formatRelative } from '../lib/indexingModel.js';
import OmButton from '../components/ds/OmButton.vue';
import logoUrl from '../assets/logo.svg';

const repoStore = useRepoStore();
const canOpen = computed(() => repoStore.canOpen);
const gitMissing = computed(() => repoStore.gitMissing);
const gitMessage = computed(() => repoStore.git?.message || '');
const openError = computed(() => repoStore.openError);
const recents = computed(() =>
  repoStore.recents.map((e) => ({
    id: e.repoId,
    name: e.displayName || e.path,
    path: e.path,
    lang: '',
    score: '—',
    bg: 'var(--om-tone-neutral-bg)',
    fg: 'var(--om-tone-neutral-fg)',
    when: e.lastAnalysedAt ? 'Analysed ' + formatRelative(e.lastAnalysedAt) : 'Not analysed yet',
    status: 'Opened ' + formatRelative(e.lastOpenedAt),
    statusFg: 'var(--om-text-muted)',
    open: () => repoStore.openPath(e.path),
    remove: () => repoStore.remove(e.repoId),
  })),
);
const openRepo = () => repoStore.openDialog();
const onDrop = (e) => {
  const file = e.dataTransfer?.files?.[0];
  if (file) repoStore.openDropped(file);
};
onMounted(() => repoStore.loadWelcome());
</script>

<template>
  <div style="flex:1;overflow:auto;display:flex;justify-content:center;padding:56px 32px">
    <div style="width:100%;max-width:920px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.25fr);gap:40px;align-content:start">
      <div style="display:flex;flex-direction:column;gap:20px">
        <img :src="logoUrl" alt="" style="width:40px;height:40px">
        <div style="display:flex;flex-direction:column;gap:8px">
          <h1 style="margin:0;font-size:1.75rem;font-weight:600;color:var(--om-text-strong);line-height:1.25">Open a repository.</h1>
          <p style="margin:0;font-size:.9rem;color:var(--om-text-muted);text-wrap:pretty;line-height:1.55">Point Codebase Insight at any local git repo. It maps dependencies, history, hotspots and risk — then lets you ask questions about it.</p>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <OmButton variant="primary" icon="folder-open-outline" :disabled="!canOpen" @click="openRepo">Open Folder…</OmButton>
          <span style="font-family:var(--font-mono);font-size:.65rem;padding:1px 6px;border:1px solid var(--om-border);border-radius:3px;color:var(--om-text-muted)">⌘O</span>
        </div>
        <div data-drop-zone @click="openRepo" @dragover.prevent @dragenter.prevent @drop.prevent="onDrop" v-hover="'border-color:var(--om-teal);color:var(--om-text)'" :style="{ border: '1.5px dashed var(--om-border)', borderRadius: '8px', padding: '28px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', color: 'var(--om-text-muted)', cursor: canOpen ? 'pointer' : 'default', opacity: gitMissing ? 0.5 : 1, transition: 'border-color .15s' }">
          <span class="mdi mdi-tray-arrow-down" style="font-size:1.6rem"></span>
          <span style="font-size:.82rem">Drop a repository folder here</span>
          <span style="font-size:.7rem;color:var(--om-text-placeholder)">Any folder containing a <span style="font-family:var(--font-mono)">.git</span> directory</span>
        </div>
        <div v-if="gitMissing" data-git-missing style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:6px;background:var(--om-tone-red-bg);color:var(--om-tone-red-fg);font-size:.78rem;line-height:1.5">
          <span class="mdi mdi-alert-circle-outline" style="font-size:1.05rem;margin-top:1px"></span>
          <span><b style="font-weight:600">Git is not available.</b> {{ gitMessage }}</span>
        </div>
        <div v-if="openError" data-open-error style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:6px;background:var(--om-tone-red-bg);color:var(--om-tone-red-fg);font-size:.78rem;line-height:1.5">
          <span class="mdi mdi-alert-circle-outline" style="font-size:1.05rem;margin-top:1px"></span>
          <span>{{ openError }}</span>
        </div>
        <div style="display:flex;gap:10px;align-items:flex-start;padding:12px 14px;border-radius:6px;background:var(--om-mint-tint);font-size:.78rem;line-height:1.5">
          <span class="mdi mdi-shield-lock-outline" style="color:var(--om-mint);font-size:1.05rem;margin-top:1px"></span>
          <span style="color:var(--om-text-value)"><b style="font-weight:600;color:var(--om-text-strong)">Analysis runs locally.</b> Your code never leaves this machine. LLM features use Ollama by default — cloud providers are opt-in, per request.</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;align-items:center;justify-content:space-between">
          <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Recent Repositories</span>
          <span style="font-size:.68rem;color:var(--om-text-placeholder)">↑↓ to select · ⏎ to open</span>
        </div>
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
          <div v-if="!recents.length" style="padding:20px 14px;font-size:.78rem;color:var(--om-text-placeholder)">No recent repositories yet. Open a folder to get started.</div>
          <div v-for="r in recents" :key="r.id" data-recent @click="r.open" v-hover="'background:var(--om-card-raised)'" :style="{ display: 'grid', gridTemplateColumns: '40px minmax(0,1fr) auto auto', gap: '12px', alignItems: 'center', padding: '12px 14px', borderBottom: '1px solid var(--om-border)', cursor: canOpen ? 'pointer' : 'default', transition: 'background .12s' }">
            <div :style="{ width: '40px', height: '40px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '.8rem', fontWeight: 600, background: r.bg, color: r.fg }" title="Health score">{{ r.score }}</div>
            <div style="min-width:0;display:flex;flex-direction:column;gap:2px">
              <div style="display:flex;align-items:center;gap:8px"><span style="font-size:.88rem;font-weight:600;color:var(--om-text-strong)">{{ r.name }}</span><span v-if="r.lang" style="font-size:.65rem;padding:0 6px;border-radius:999px;background:var(--om-tone-neutral-bg);color:var(--om-tone-neutral-fg)">{{ r.lang }}</span></div>
              <span style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ r.path }}</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
              <span style="font-size:.7rem;color:var(--om-text-label)">{{ r.when }}</span>
              <span :style="{ fontSize: '.65rem', color: r.statusFg }">{{ r.status }}</span>
            </div>
            <button class="om-ghost-icon" title="Remove from recents" @click.stop="r.remove"><span class="mdi mdi-close"></span></button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Welcome screen (prototype lines 134–180).
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import { WELCOME_RECENTS } from '@/data/insightData.js';
import OmButton from '../components/ds/OmButton.vue';
import logoUrl from '../assets/logo.svg';

const store = useInsightStore();
const tone = (s) =>
  s >= 80 ? ['var(--om-tone-green-bg)', 'var(--om-tone-green-fg)']
    : s >= 60 ? ['var(--om-tone-yellow-bg)', 'var(--om-tone-yellow-fg)']
      : ['var(--om-tone-red-bg)', 'var(--om-tone-red-fg)'];
const recents = computed(() =>
  WELCOME_RECENTS.map(([name, path, lang, score, when, status, statusFg]) => {
    const [bg, fg] = tone(score);
    return { name, path, lang, score, when, status, statusFg, bg, fg, open: () => store.go('indexing', { t: 34 }) };
  }),
);
const openRepo = () => store.go('indexing', { t: 34 });
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
          <OmButton variant="primary" icon="folder-open-outline" @click="openRepo">Open Folder…</OmButton>
          <span style="font-family:var(--font-mono);font-size:.65rem;padding:1px 6px;border:1px solid var(--om-border);border-radius:3px;color:var(--om-text-muted)">⌘O</span>
        </div>
        <div @click="openRepo" v-hover="'border-color:var(--om-teal);color:var(--om-text)'" style="border:1.5px dashed var(--om-border);border-radius:8px;padding:28px 20px;display:flex;flex-direction:column;align-items:center;gap:8px;color:var(--om-text-muted);cursor:pointer;transition:border-color .15s">
          <span class="mdi mdi-tray-arrow-down" style="font-size:1.6rem"></span>
          <span style="font-size:.82rem">Drop a repository folder here</span>
          <span style="font-size:.7rem;color:var(--om-text-placeholder)">Any folder containing a <span style="font-family:var(--font-mono)">.git</span> directory</span>
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
          <div v-for="r in recents" :key="r.name" @click="r.open" v-hover="'background:var(--om-card-raised)'" style="display:grid;grid-template-columns:40px minmax(0,1fr) auto;gap:12px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--om-border);cursor:pointer;transition:background .12s">
            <div :style="{ width: '40px', height: '40px', borderRadius: '999px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-mono)', fontSize: '.8rem', fontWeight: 600, background: r.bg, color: r.fg }" title="Health score">{{ r.score }}</div>
            <div style="min-width:0;display:flex;flex-direction:column;gap:2px">
              <div style="display:flex;align-items:center;gap:8px"><span style="font-size:.88rem;font-weight:600;color:var(--om-text-strong)">{{ r.name }}</span><span style="font-size:.65rem;padding:0 6px;border-radius:999px;background:var(--om-tone-neutral-bg);color:var(--om-tone-neutral-fg)">{{ r.lang }}</span></div>
              <span style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ r.path }}</span>
            </div>
            <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px">
              <span style="font-size:.7rem;color:var(--om-text-label)">{{ r.when }}</span>
              <span :style="{ fontSize: '.65rem', color: r.statusFg }">{{ r.status }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

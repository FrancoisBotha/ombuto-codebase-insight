<script setup>
// Title bar (prototype lines 28–56).
import { computed } from 'vue';
import { useInsightStore } from '../../stores/insightStore.js';
import { useRepoStore } from '../../stores/repoStore.js';
import { shortSha } from '../../lib/indexingModel.js';
import logoUrl from '../../assets/logo.svg';

const store = useInsightStore();
const repoStore = useRepoStore();
const S = store.state;
const hasRepo = computed(() => store.scr !== 'welcome');
const repoName = computed(() => repoStore.repo?.name || '');
const branch = computed(() => repoStore.repo?.branch || shortSha(repoStore.repo?.headSha) || '');
const titlebarBg = computed(() => S.tbColor || 'var(--om-titlebar)');
const llmBadge = computed(() =>
  S.llm === 'local' ? 'Local · Ollama'
    : S.llm === 'cli' ? 'Local CLI · ' + { claude: 'Claude Code', codex: 'Codex' }[S.cli || 'claude']
      : S.llm === 'openrouter' ? 'OpenRouter · cloud' : 'Cloud API · opt-in',
);
const openPalette = () => store.setState({ pal: true, q: '', pi: 0 });
const win = (action) => window.insight?.window?.[action]?.();
</script>

<template>
  <div class="app-drag" :style="{ height: '32px', flexShrink: 0, display: 'flex', alignItems: 'center', background: titlebarBg, color: '#fff', transition: 'background-color .2s', userSelect: 'none', paddingLeft: '10px', gap: '10px' }">
    <div style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:500;letter-spacing:.5px;white-space:nowrap">
      <img :src="logoUrl" alt="" style="width:16px;height:16px;display:block">
      <span>Codebase Insight</span>
    </div>
    <template v-if="hasRepo">
      <div style="width:1px;height:14px;background:rgba(255,255,255,.2)"></div>
      <div data-titlebar-repo style="display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:.72rem;white-space:nowrap">
        <span style="color:rgba(255,255,255,.9)">{{ repoName }}</span>
        <span v-if="branch" style="display:flex;align-items:center;gap:3px;padding:1px 6px;border-radius:3px;background:rgba(255,255,255,.1);color:rgba(255,255,255,.7)"><span class="mdi mdi-source-branch"></span>{{ branch }}</span>
      </div>
    </template>
    <div style="flex:1;display:flex;justify-content:center;min-width:0">
      <div class="app-no-drag" @click="openPalette" v-hover="'background:rgba(255,255,255,.13)'" style="width:400px;max-width:100%;height:22px;display:flex;align-items:center;gap:8px;padding:0 8px;border-radius:4px;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.1);cursor:pointer;color:rgba(255,255,255,.5);font-size:.72rem">
        <span class="mdi mdi-magnify" style="font-size:.9rem"></span>
        <span style="flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Search files, symbols, insights, commands…</span>
        <span style="font-family:var(--font-mono);font-size:.62rem;padding:0 5px;border:1px solid rgba(255,255,255,.2);border-radius:3px;line-height:1.5">⌘K</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;gap:6px;font-size:.68rem;color:rgba(255,255,255,.65);white-space:nowrap" title="All analysis and LLM calls run on this machine">
      <span class="mdi mdi-shield-lock-outline" style="color:var(--om-mint);font-size:.85rem"></span>
      <span>{{ llmBadge }}</span>
    </div>
    <div class="app-no-drag" style="display:flex">
      <div class="om-win-btn" @click="win('minimize')"><span class="mdi mdi-window-minimize"></span></div>
      <div class="om-win-btn" @click="win('toggleMaximize')"><span class="mdi mdi-window-maximize"></span></div>
      <div class="om-win-btn om-win-btn--close" @click="win('close')"><span class="mdi mdi-close"></span></div>
    </div>
  </div>
</template>

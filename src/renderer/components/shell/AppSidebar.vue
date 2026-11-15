<script setup>
// Sidebar navigation (prototype lines 60–130).
import { computed } from 'vue';
import { useInsightStore } from '../../stores/insightStore.js';
import { NAV } from '../../lib/constants.js';

const store = useInsightStore();
const S = store.state;

const nav = computed(() =>
  NAV.map((n) => ({
    ...n,
    cls: 'om-board-item' + (store.scr === n.id ? ' is-active' : ''),
    ccls: 'om-collapsed-item' + (store.scr === n.id ? ' is-active' : ''),
    tip: n.label + '  ' + n.hint,
    go: () => store.go(n.id),
  })),
);
const groups = computed(() => [
  { label: 'Analyse', pad: '6px 16px 4px', items: nav.value.filter((n) => n.g === 'a') },
  { label: 'History', pad: '12px 16px 4px', items: nav.value.filter((n) => n.g === 'h') },
  { label: 'Understand', pad: '12px 16px 4px', items: nav.value.filter((n) => n.g === 'u') },
  { label: 'Share', pad: '12px 16px 4px', items: nav.value.filter((n) => n.g === 's') },
]);
const sidebarCls = computed(() => 'om-sidebar' + (S.collapsed ? ' om-sidebar--collapsed' : ''));
const settingsCls = computed(() => 'om-board-item' + (store.scr === 'settings' ? ' is-active' : ''));
const settingsCCls = computed(() => 'om-collapsed-item' + (store.scr === 'settings' ? ' is-active' : ''));
const toggleDrawer = () => store.setState((s) => ({ collapsed: !s.collapsed }));
const goSettings = () => store.go('settings');
const reanalyse = () => store.go('indexing', { t: 0 });
</script>

<template>
  <div :class="sidebarCls" style="height:auto">
    <template v-if="!S.collapsed">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px 10px 16px;border-bottom:1px solid rgba(255,255,255,.06);min-height:48px">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column">
          <span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:rgba(255,255,255,.3)">Repository</span>
          <span style="font-family:var(--font-mono);font-size:.78rem;color:rgba(255,255,255,.85)">harbor-api</span>
        </div>
        <span style="font-family:var(--font-mono);font-size:.7rem;font-weight:600;padding:1px 6px;border-radius:999px;background:var(--om-tone-yellow-bg);color:var(--om-tone-yellow-fg)" title="Health score">72</span>
        <button class="om-ghost-icon" @click="toggleDrawer" title="Collapse  ⌘B"><span class="mdi mdi-chevron-double-left"></span></button>
      </div>
      <div style="flex:1;overflow:auto;padding:8px 0;display:flex;flex-direction:column;gap:2px">
        <template v-for="g in groups" :key="g.label">
          <div :style="{ fontSize: '.6rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', color: 'rgba(255,255,255,.28)', padding: g.pad }">{{ g.label }}</div>
          <div v-for="n in g.items" :key="n.id" :class="n.cls" @click="n.go">
            <span class="om-board-icon"><span :class="'mdi mdi-' + n.icon"></span></span>
            <span style="flex:1">{{ n.label }}</span>
            <span style="font-family:var(--font-mono);font-size:.6rem;color:rgba(255,255,255,.25)">{{ n.hint }}</span>
          </div>
        </template>
      </div>
      <div style="border-top:1px solid rgba(255,255,255,.06);padding:8px 0">
        <div :class="settingsCls" @click="goSettings">
          <span class="om-board-icon"><span class="mdi mdi-cog-outline"></span></span>
          <span style="flex:1">Settings</span>
          <span style="font-family:var(--font-mono);font-size:.6rem;color:rgba(255,255,255,.25)">⌘,</span>
        </div>
        <div style="padding:6px 16px 2px;font-size:.65rem;color:rgba(255,255,255,.35);display:flex;align-items:center;gap:6px">
          <span class="mdi mdi-check-circle-outline" style="color:var(--om-mint)"></span>
          <span style="flex:1">Analysed 2h ago · a91f3c2</span>
          <span @click="reanalyse" style="cursor:pointer;color:rgba(255,255,255,.55)" title="Re-analyse  ⌘R"><span class="mdi mdi-refresh"></span></span>
        </div>
      </div>
    </template>
    <template v-else>
      <div style="display:flex;justify-content:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.06)">
        <button class="om-ghost-icon" @click="toggleDrawer" title="Expand  ⌘B"><span class="mdi mdi-chevron-double-right"></span></button>
      </div>
      <div style="flex:1;padding:6px 0">
        <div v-for="n in nav" :key="n.id" :class="n.ccls" @click="n.go" :title="n.tip"><span :class="'mdi mdi-' + n.icon"></span></div>
      </div>
      <div :class="settingsCCls" @click="goSettings" title="Settings  ⌘," style="margin-bottom:8px"><span class="mdi mdi-cog-outline"></span></div>
    </template>
  </div>
</template>

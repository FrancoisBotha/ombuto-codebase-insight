<script setup>
// ⌘K command palette overlay (prototype lines 1752–1776).
import { computed, ref, watch, nextTick } from 'vue';
import { useInsightStore } from '../../stores/insightStore.js';
import { palItems } from '../../lib/palette.js';

const store = useInsightStore();
const S = store.state;
const input = ref(null);

const items = computed(() => {
  const list = palItems(store);
  let k = -1;
  return list.map((it, i) => {
    if (it.header) return { key: 'h' + i, header: true, isItem: false, label: it.header };
    k++;
    const idx = k, act = idx === S.pi;
    return {
      key: 'i' + i, header: false, isItem: true, label: it.label, icon: it.icon, hint: it.hint,
      font: it.mono ? 'var(--font-mono)' : 'var(--font-sans)',
      bg: act ? 'var(--om-mint-tint-strong)' : 'transparent',
      fg: act ? 'var(--om-mint)' : 'var(--om-text)',
      run: it.run,
      hover: () => S.pi !== idx && store.setState({ pi: idx }),
    };
  });
});
const empty = computed(() => items.value.length === 0);
const onQ = (e) => store.setState({ q: e.target.value, pi: 0 });
const close = () => store.setState({ pal: false });

// Prototype focuses the input 30ms after opening.
watch(
  () => S.pal,
  (open) => open && setTimeout(() => nextTick(() => input.value?.focus()), 30),
  { immediate: true },
);
</script>

<template>
  <div v-if="S.pal" @click="close" style="position:absolute;inset:0;z-index:1200;background:rgba(0,0,0,.5);display:flex;justify-content:center;align-items:flex-start;padding-top:84px">
    <div @click.stop style="width:600px;max-width:calc(100% - 40px);background:var(--om-dialog);border:1px solid var(--om-border);border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.5);overflow:hidden;display:flex;flex-direction:column">
      <div style="display:flex;align-items:center;gap:10px;padding:12px 14px;border-bottom:1px solid var(--om-border)">
        <span class="mdi mdi-magnify" style="color:var(--om-text-muted);font-size:1.1rem"></span>
        <input ref="input" :value="S.q" @input="onQ" placeholder="Type a command, file or question…" style="flex:1;border:none;outline:none;background:transparent;color:var(--om-text-strong);font-family:inherit;font-size:.92rem">
        <span style="font-family:var(--font-mono);font-size:.62rem;padding:1px 6px;border:1px solid var(--om-border);border-radius:3px;color:var(--om-text-muted)">esc</span>
      </div>
      <div style="max-height:380px;overflow:auto;padding:6px">
        <template v-for="it in items" :key="it.key">
          <div v-if="it.header" style="padding:8px 10px 4px;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">{{ it.label }}</div>
          <div v-if="it.isItem" @click="it.run" @mouseenter="it.hover" :style="{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 10px', borderRadius: '6px', cursor: 'pointer', background: it.bg, color: it.fg }">
            <span :class="'mdi mdi-' + it.icon" style="font-size:1rem;opacity:.8"></span>
            <span :style="{ flex: 1, fontSize: '.82rem', fontFamily: it.font }">{{ it.label }}</span>
            <span style="font-family:var(--font-mono);font-size:.64rem;color:var(--om-text-muted)">{{ it.hint }}</span>
          </div>
        </template>
        <div v-if="empty" style="padding:20px;text-align:center;font-size:.8rem;color:var(--om-text-muted)">No matches. Press ⏎ to ask the codebase instead.</div>
      </div>
      <div style="display:flex;gap:14px;padding:8px 14px;border-top:1px solid var(--om-border);font-size:.64rem;color:var(--om-text-muted)"><span>↑↓ navigate</span><span>⏎ open</span><span>esc close</span><span style="margin-left:auto">Type a file name to jump</span></div>
    </div>
  </div>
</template>

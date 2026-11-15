<script setup>
// Indexing screen (prototype lines 182–237). Progress (S.t) is advanced by the
// ticker in App.vue, as in the prototype's componentDidMount.
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import { INDEXING_STAGES, INDEXING_READY, INDEXING_LOG } from '@/data/insightData.js';
import OmButton from '../components/ds/OmButton.vue';

const store = useInsightStore();
const S = store.state;

const idx = computed(() => {
  const t = S.t;
  const stages = INDEXING_STAGES.map((s) => {
    const p = Math.max(0, Math.min(1, (t - s.a) / (s.b - s.a)));
    const done = p >= 1, run = p > 0 && !done;
    return {
      ...s,
      w: (p * 100).toFixed(1) + '%',
      count: Math.round(p * s.tot).toLocaleString() + ' / ' + s.tot.toLocaleString(),
      icon: done ? 'mdi-check-circle' : run ? 'mdi-loading mdi-spin' : 'mdi-circle-outline',
      iconFg: done ? 'var(--om-mint)' : run ? 'var(--om-teal)' : 'var(--om-gray-400)',
      barFg: s.optional ? 'var(--om-indigo)' : done ? 'var(--om-mint)' : 'var(--om-teal)',
      op: p > 0 ? 1 : 0.55,
    };
  });
  const ready = INDEXING_READY.map(([label, at, icon, id]) => {
    const ok = t >= at;
    return {
      label, icon: ok ? icon : 'mdi-lock-outline', fg: ok ? 'var(--om-mint)' : 'var(--om-gray-400)',
      state: ok ? (t >= 100 ? 'Ready' : 'Partial') : 'Waiting', op: ok ? 1 : 0.6, cursor: ok ? 'pointer' : 'default',
      go: () => ok && store.go(id),
    };
  });
  const log = INDEXING_LOG.slice(0, Math.max(2, Math.min(5, Math.floor(t / 12)))).map(([lt, m]) => ({ t: lt, m }));
  return { pct: Math.round(t), pctW: t.toFixed(1) + '%', elapsed: String(Math.round(t * 0.4)).padStart(2, '0'), stages, ready, log };
});
const goOverview = () => store.go('overview');
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0">
    <div style="flex:1;display:flex;flex-direction:column;gap:2px">
      <div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Analysing harbor-api</div>
      <div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">~/dev/harbor-api · main @ a91f3c2 · started 0:{{ idx.elapsed }} ago</div>
    </div>
    <OmButton variant="secondary" icon="pause">Pause</OmButton>
  </div>
  <div style="flex:1;overflow:auto;padding:24px;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);gap:20px;align-content:start">
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Overall</span><span style="font-family:var(--font-mono);font-size:.8rem;color:var(--om-text-strong)">{{ idx.pct }}%</span></div>
        <div style="height:6px;border-radius:3px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: idx.pctW, background: 'var(--om-mint)', transition: 'width .2s' }"></div></div>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px">
        <div v-for="s in idx.stages" :key="s.label" :style="{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) auto', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--om-border)', alignItems: 'start', opacity: s.op }">
          <span :class="'mdi ' + s.icon" :style="{ fontSize: '1.1rem', color: s.iconFg, marginTop: '1px' }"></span>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
            <div style="display:flex;align-items:center;gap:8px"><span style="font-size:.88rem;font-weight:600;color:var(--om-text-strong)">{{ s.label }}</span><span v-if="s.optional" style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:0 6px;border-radius:999px;color:var(--ai);border:1px solid var(--ai-line)">Optional · LLM</span></div>
            <span style="font-size:.72rem;color:var(--om-text-muted)">{{ s.detail }}</span>
            <div style="height:3px;border-radius:2px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: s.w, background: s.barFg }"></div></div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:120px">
            <span style="font-family:var(--font-mono);font-size:.82rem;color:var(--om-text-strong)">{{ s.count }}</span>
            <span style="font-size:.65rem;color:var(--om-text-muted)">{{ s.unit }}</span>
          </div>
        </div>
      </div>
      <div style="background:var(--om-terminal);border:1px solid var(--om-border);border-radius:6px;padding:10px 12px;font-family:var(--font-mono);font-size:.68rem;line-height:1.7;color:var(--om-text-muted)">
        <div v-for="l in idx.log" :key="l.t + l.m" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="color:var(--om-gray-400)">{{ l.t }}</span>  {{ l.m }}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="font-size:.95rem;font-weight:600;color:var(--om-text-strong)">Start exploring now</div>
        <div style="font-size:.78rem;color:var(--om-text-muted);line-height:1.5">Results appear as each stage finishes. Partial views are marked until analysis completes.</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div v-for="r in idx.ready" :key="r.label" @click="r.go" v-hover="'background:var(--om-card-raised)'" :style="{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px', background: 'var(--om-inset)', fontSize: '.8rem', cursor: r.cursor, opacity: r.op }">
            <span :class="'mdi ' + r.icon" :style="{ color: r.fg }"></span>
            <span style="flex:1;color:var(--om-text)">{{ r.label }}</span>
            <span style="font-size:.65rem;color:var(--om-text-muted)">{{ r.state }}</span>
          </div>
        </div>
        <OmButton variant="primary" icon="arrow-right" @click="goOverview">Explore Partial Results</OmButton>
      </div>
      <div style="display:flex;gap:10px;padding:12px 14px;border-radius:6px;background:var(--om-mint-tint);font-size:.75rem;line-height:1.5;color:var(--om-text-value)">
        <span class="mdi mdi-shield-lock-outline" style="color:var(--om-mint);font-size:1rem"></span>
        <span>Everything here runs on this machine. LLM summaries use <span style="font-family:var(--font-mono)">llama3.1:8b</span> via Ollama on localhost.</span>
      </div>
    </div>
  </div>
</template>

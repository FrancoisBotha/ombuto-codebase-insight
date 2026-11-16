<script setup>
// Indexing screen (prototype lines 182–237) on real worker events (epic 1
// FR-006): overall progress, per-stage status and counts, the live event log,
// a failed stage's error and the features that unlock as stages finish.
import { computed, onMounted, onBeforeUnmount, ref } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import { useRepoStore } from '../stores/repoStore.js';
import { stageFraction, shortSha, formatElapsed } from '../lib/indexingModel.js';
import OmButton from '../components/ds/OmButton.vue';

const store = useInsightStore();
const repoStore = useRepoStore();

const LOG_LINES = 8;
const now = ref(Date.now());
let ticker = null;

const STATUS = {
  pending: { icon: 'mdi-circle-outline', fg: 'var(--om-gray-400)', op: 0.55 },
  running: { icon: 'mdi-loading mdi-spin', fg: 'var(--om-teal)', op: 1 },
  done: { icon: 'mdi-check-circle', fg: 'var(--om-mint)', op: 1 },
  skipped: { icon: 'mdi-skip-next-circle-outline', fg: 'var(--om-gray-400)', op: 0.55 },
  failed: { icon: 'mdi-alert-circle', fg: 'var(--om-danger)', op: 1 },
};

const n = (v) => (Number.isFinite(v) ? v.toLocaleString() : null);

function count(s) {
  if (s.status === 'skipped') return 'Skipped';
  if (s.status === 'failed') return 'Failed';
  if (s.status === 'done') return n(s.rowsWritten) ?? n(s.total) ?? '—';
  if (s.status === 'running') {
    if (n(s.done) !== null && n(s.total) !== null) return n(s.done) + ' / ' + n(s.total);
    return n(s.done) ?? '…';
  }
  return n(s.total) !== null ? '0 / ' + n(s.total) : '—';
}

const repo = computed(() => repoStore.repo);
const idx = computed(() => {
  const run = repoStore.run;
  const pct = repoStore.progress * 100;
  const stages = run.stages.map((s) => {
    const st = STATUS[s.status] || STATUS.pending;
    return {
      ...s,
      w: (stageFraction(s) * 100).toFixed(1) + '%',
      count: count(s),
      unitLabel: s.status === 'skipped' ? 'not built yet' : s.unit || '',
      icon: st.icon,
      iconFg: st.fg,
      barFg: s.status === 'failed' ? 'var(--om-danger)' : s.optional ? 'var(--om-indigo)' : s.status === 'done' ? 'var(--om-mint)' : 'var(--om-teal)',
      op: st.op,
    };
  });
  const ready = repoStore.ready.map((r) => ({
    ...r,
    icon: r.ok ? r.icon : 'mdi-lock-outline',
    fg: r.ok ? 'var(--om-mint)' : 'var(--om-gray-400)',
    op: r.ok ? 1 : 0.6,
    cursor: r.ok ? 'pointer' : 'default',
    go: () => r.ok && store.go(r.id),
  }));
  const log = run.log.slice(-LOG_LINES);
  const sub = [
    repo.value?.path || '',
    (repo.value?.branch || 'detached') + ' @ ' + (shortSha(run.commitSha || repo.value?.headSha) || '—'),
    run.status === 'running' || run.status === null ? 'started ' + formatElapsed(run.startedAt, now.value) + ' ago' : run.status,
  ].join(' · ');
  return { pct: Math.round(pct), pctW: pct.toFixed(1) + '%', sub, stages, ready, log, error: run.status === 'failed' ? run.error : null };
});
const canExplore = computed(() => repoStore.exploring);
const goInventory = () => canExplore.value && store.go('inventory');

onMounted(() => {
  repoStore.ensureRun();
  ticker = setInterval(() => { now.value = Date.now(); }, 1000);
});
onBeforeUnmount(() => clearInterval(ticker));
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0">
    <div style="flex:1;display:flex;flex-direction:column;gap:2px">
      <div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Analysing {{ repo?.name || 'repository' }}</div>
      <div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">{{ idx.sub }}</div>
    </div>
    <OmButton variant="secondary" icon="pause">Pause</OmButton>
  </div>
  <div style="flex:1;overflow:auto;padding:24px;display:grid;grid-template-columns:minmax(0,1.5fr) minmax(300px,1fr);gap:20px;align-content:start">
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Overall</span><span data-overall style="font-family:var(--font-mono);font-size:.8rem;color:var(--om-text-strong)">{{ idx.pct }}%</span></div>
        <div style="height:6px;border-radius:3px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: idx.pctW, background: idx.error ? 'var(--om-danger)' : 'var(--om-mint)', transition: 'width .2s' }"></div></div>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px">
        <div v-if="!idx.stages.length" style="padding:14px 16px;font-size:.78rem;color:var(--om-text-placeholder)">Waiting for the pipeline to start…</div>
        <div v-for="s in idx.stages" :key="s.id" :data-stage="s.id" :data-status="s.status" :style="{ display: 'grid', gridTemplateColumns: '24px minmax(0,1fr) auto', gap: '12px', padding: '14px 16px', borderBottom: '1px solid var(--om-border)', alignItems: 'start', opacity: s.op }">
          <span :class="'mdi ' + s.icon" :style="{ fontSize: '1.1rem', color: s.iconFg, marginTop: '1px' }"></span>
          <div style="display:flex;flex-direction:column;gap:6px;min-width:0">
            <div style="display:flex;align-items:center;gap:8px"><span style="font-size:.88rem;font-weight:600;color:var(--om-text-strong)">{{ s.label }}</span><span v-if="s.optional" style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:0 6px;border-radius:999px;color:var(--ai);border:1px solid var(--ai-line)">Optional · LLM</span></div>
            <span style="font-size:.72rem;color:var(--om-text-muted)">{{ s.detail }}</span>
            <span v-if="s.error" data-stage-error style="font-size:.72rem;color:var(--om-danger);white-space:pre-wrap;word-break:break-word">{{ s.error }}</span>
            <div style="height:3px;border-radius:2px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: s.w, background: s.barFg }"></div></div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:2px;min-width:120px">
            <span style="font-family:var(--font-mono);font-size:.82rem;color:var(--om-text-strong)">{{ s.count }}</span>
            <span style="font-size:.65rem;color:var(--om-text-muted)">{{ s.unitLabel }}</span>
          </div>
        </div>
      </div>
      <div data-log style="background:var(--om-terminal);border:1px solid var(--om-border);border-radius:6px;padding:10px 12px;font-family:var(--font-mono);font-size:.68rem;line-height:1.7;color:var(--om-text-muted)">
        <div v-if="!idx.log.length" style="color:var(--om-gray-400)">Waiting for events…</div>
        <div v-for="(l, i) in idx.log" :key="i + l.t + l.m" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis"><span style="color:var(--om-gray-400)">{{ l.t }}</span>  {{ l.m }}</div>
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:16px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:12px">
        <div style="font-size:.95rem;font-weight:600;color:var(--om-text-strong)">Start exploring now</div>
        <div style="font-size:.78rem;color:var(--om-text-muted);line-height:1.5">Results appear as each stage finishes. Partial views are marked until analysis completes.</div>
        <div style="display:flex;flex-direction:column;gap:6px">
          <div v-for="r in idx.ready" :key="r.id" :data-ready="r.id" @click="r.go" v-hover="'background:var(--om-card-raised)'" :style="{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px', background: 'var(--om-inset)', fontSize: '.8rem', cursor: r.cursor, opacity: r.op }">
            <span :class="'mdi ' + r.icon" :style="{ color: r.fg }"></span>
            <span style="flex:1;color:var(--om-text)">{{ r.label }}</span>
            <span style="font-size:.65rem;color:var(--om-text-muted)">{{ r.state }}</span>
          </div>
        </div>
        <OmButton variant="primary" icon="arrow-right" :disabled="!canExplore" @click="goInventory">Explore Partial Results</OmButton>
      </div>
      <div style="display:flex;gap:10px;padding:12px 14px;border-radius:6px;background:var(--om-mint-tint);font-size:.75rem;line-height:1.5;color:var(--om-text-value)">
        <span class="mdi mdi-shield-lock-outline" style="color:var(--om-mint);font-size:1rem"></span>
        <span>Everything here runs on this machine. LLM summaries use <span style="font-family:var(--font-mono)">llama3.1:8b</span> via Ollama on localhost.</span>
      </div>
    </div>
  </div>
</template>

<script setup>
// Hotspots screen (prototype lines 394–496; logic in more() "// hotspots").
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import {
  FILES, AUTHORS,
  HOTSPOTS_COCHANGE_SCORES, HOTSPOTS_COCHANGE_WIDTHS,
  HOTSPOTS_INVOICE_EXPLAIN, HOTSPOTS_INVOICE_SUGGESTION, HOTSPOTS_DEFAULT_SUGGESTION,
} from '../data/insightData.js';
import { METRICS, SEV } from '../lib/constants.js';
import { hash, rng } from '../lib/random.js';
import { sevOf, tabs } from '../lib/viewHelpers.js';
import { buildTreemap } from '../lib/treemap.js';
import OmButton from '../components/ds/OmButton.vue';
import OmBadge from '../components/ds/OmBadge.vue';
import OmPrototypeBanner from '../components/ds/OmPrototypeBanner.vue';

const store = useInsightStore();
const S = store.state;

const hs = computed(() => {
  const tm = buildTreemap({
    files: FILES, metric: S.metric, sel: S.sel, theme: store.theme, W: 1000, H: 620, labels: true,
    onPick: (p) => store.setState({ sel: p, explain: 'idle' }),
  });
  const f = FILES.find((x) => x.path === S.sel) || FILES[0];
  const r = rng(hash(f.path));
  const n = Math.min(4, Math.max(2, f.authors));
  const names = AUTHORS.slice().sort(() => r() - 0.5).slice(0, n);
  let rem = 100 - f.own;
  const authors = names.map((nm, i) => {
    let p = i === 0 ? f.own : i === n - 1 ? rem : Math.max(1, Math.round(rem * 0.6));
    if (i > 0) rem -= p;
    return { name: nm, pct: p + '%', w: p + '%' };
  });
  const weeks = Array.from({ length: 26 }, (_, i) => Math.floor(((r() * r() * f.churn) / 4) * (0.3 + i / 18)));
  const wmx = Math.max(1, ...weeks);
  const others = FILES.filter((x) => x !== f)
    .sort((a, b) => (b.dir === f.dir) - (a.dir === f.dir) || (hash(f.path + a.path) % 97) - (hash(f.path + b.path) % 97))
    .slice(0, 3);
  const sevF = SEV[sevOf(f)];
  const isInv = f.name === 'invoice.ts';
  return {
    tm, lo: tm.met.lo, hi: tm.met.hi, metricLabel: tm.met.label,
    metricTabs: tabs(METRICS.map((m) => [m.id, m.label]), S.metric, 'metric', store.setState),
    f: { name: f.name, dir: f.dir, path: f.path, sev: sevF.label, tone: sevF.tone },
    metrics: [
      ['Churn · 90d', f.churn, 'commits'], ['Complexity', f.cx, 'cyclomatic'], ['Lines', f.loc.toLocaleString(), 'LOC'],
      ['Code age', f.age, 'months'], ['Authors', f.authors, 'all time'], ['Top owner', f.own + '%', names[0]],
      ['Fix commits', f.bugs, '“fix” / “bug” in message'], ['Bus factor', f.own > 80 ? 1 : f.authors > 5 ? 3 : 2, f.own > 80 ? 'at risk' : 'people'],
      ['Fix ratio', Math.round((f.bugs / Math.max(1, f.churn)) * 100) + '%', 'of all changes'],
    ].map(([k, v, u]) => ({ k, v, u })),
    authors,
    timeline: weeks.map((c, i) => ({ h: ((c / wmx) * 100).toFixed(0) + '%', bg: c ? 'var(--om-teal)' : 'var(--om-border)', tip: c + ' commits · week ' + (i + 1) })),
    cochange: others.map((o, i) => ({
      key: o.path, hidden: hash(f.path + o.path) % 3 === 0 || i === 2, name: o.name, dir: o.dir,
      score: HOTSPOTS_COCHANGE_SCORES[i], w: HOTSPOTS_COCHANGE_WIDTHS[i],
      pick: () => store.setState({ sel: o.path, explain: 'idle' }),
    })),
    idle: S.explain === 'idle', loading: S.explain === 'loading', done: S.explain === 'done',
    explainText: isInv
      ? HOTSPOTS_INVOICE_EXPLAIN
      : f.name + ' changed ' + f.churn + ' times in 90 days and has cyclomatic complexity ' + f.cx + '. ' +
        (f.own > 80
          ? f.own + '% of its recent lines come from one author, so knowledge is concentrated — a review from someone else is the cheapest mitigation.'
          : 'Changes are spread across ' + f.authors + ' authors with no clear owner, which tends to increase merge conflicts and inconsistent fixes.') +
        ' Most edits cluster in a few functions; extracting them and adding tests before further changes would lower the risk.',
    suggestion: isInv ? HOTSPOTS_INVOICE_SUGGESTION : HOTSPOTS_DEFAULT_SUGGESTION,
    explain: () => {
      store.setState({ explain: 'loading' });
      store.later('explain', 1400, () => store.setState({ explain: 'done' }));
    },
    openFile: () => store.go('file', { fsel: f.path }),
    askFile: () => store.go('ask'),
  };
});
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0;flex-wrap:wrap">
    <div style="display:flex;flex-direction:column;gap:2px;margin-right:auto">
      <div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Hotspots &amp; History</div>
      <div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">Area = lines of code · colour = {{ hs.metricLabel }} · last 90 days</div>
    </div>
    <div style="display:flex;gap:2px;padding:2px;border-radius:6px;background:var(--om-inset);border:1px solid var(--om-border)">
      <button v-for="m in hs.metricTabs" :key="m.id" @click="m.pick" :style="{ border: 'none', fontFamily: 'inherit', fontSize: '.74rem', fontWeight: 500, padding: '5px 10px', borderRadius: '4px', cursor: 'pointer', background: m.bg, color: m.fg, whiteSpace: 'nowrap' }">{{ m.label }}</button>
    </div>
    <select class="om-select om-select--md"><option>Last 90 days</option><option>Last 12 months</option><option>All time</option></select>
  </div>
  <OmPrototypeBanner />
  <div style="flex:1;min-height:0;display:flex">
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;padding:14px 16px;gap:10px">
      <div style="flex:1;min-height:0;position:relative;background:var(--om-inset);border-radius:6px;overflow:hidden">
        <div v-for="d in hs.tm.dirs" :key="'d' + d.label" :style="{ position: 'absolute', left: d.l, top: d.t, width: d.w, height: d.h, boxSizing: 'border-box', border: '1px solid var(--om-border)', padding: '2px 6px', fontFamily: 'var(--font-mono)', fontSize: '.62rem', fontWeight: 500, color: 'var(--om-text-label)', textTransform: 'uppercase', letterSpacing: '.04em', overflow: 'hidden', whiteSpace: 'nowrap' }">{{ d.label }}</div>
        <div v-for="c in hs.tm.cells" :key="c.key" @click="c.pick" :title="c.tip" v-hover="'filter:brightness(1.18)'" :style="{ position: 'absolute', left: c.l, top: c.t, width: c.w, height: c.h, background: c.bg, color: c.fg, boxShadow: c.ring, zIndex: c.z, boxSizing: 'border-box', border: '1px solid var(--om-inset)', padding: '4px 6px', overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1px', transition: 'filter .12s' }">
          <span style="font-family:var(--font-mono);font-size:.68rem;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ c.name }}</span>
          <span style="font-family:var(--font-mono);font-size:.6rem;opacity:.8;white-space:nowrap">{{ c.val }}</span>
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:14px;font-size:.68rem;color:var(--om-text-muted)">
        <div style="display:flex;align-items:center;gap:3px"><span style="margin-right:4px">{{ hs.lo }}</span><span v-for="(c, i) in hs.tm.legend" :key="i" :style="{ width: '18px', height: '8px', borderRadius: '2px', background: c }"></span><span style="margin-left:4px">{{ hs.hi }}</span></div>
        <span style="margin-left:auto">Click a tile to inspect · <span style="font-family:var(--font-mono)">⌘E</span> explain selected</span>
      </div>
    </div>
    <div style="width:340px;flex-shrink:0;border-left:1px solid var(--om-border);background:var(--om-surface);overflow:auto;display:flex;flex-direction:column">
      <div style="padding:14px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;align-items:center;gap:8px">
          <span class="mdi mdi-file-code-outline" style="color:var(--om-text-muted)"></span>
          <span style="font-family:var(--font-mono);font-size:.9rem;font-weight:500;color:var(--om-text-strong);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">{{ hs.f.name }}</span>
          <OmBadge kind="flag" :tone="hs.f.tone">{{ hs.f.sev }}</OmBadge>
        </div>
        <span style="font-family:var(--font-mono);font-size:.68rem;color:var(--om-text-muted)">{{ hs.f.path }}</span>
        <div style="display:flex;gap:6px">
          <OmButton variant="secondary" icon="file-eye-outline" @click="hs.openFile">Open File</OmButton>
          <OmButton variant="ghost" icon="chat-question-outline" @click="hs.askFile">Ask</OmButton>
        </div>
      </div>
      <div style="padding:12px 16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 8px;border-bottom:1px solid var(--om-border)">
        <div v-for="m in hs.metrics" :key="m.k" style="display:flex;flex-direction:column;gap:1px;min-width:0">
          <span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);white-space:nowrap">{{ m.k }}</span>
          <span style="font-family:var(--font-mono);font-size:.95rem;color:var(--om-text-strong)">{{ m.v }}</span>
          <span style="font-size:.6rem;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ m.u }}</span>
        </div>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:8px">
        <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Change Timeline · 26 Weeks</span>
        <div style="height:46px;display:flex;align-items:flex-end;gap:2px">
          <div v-for="(w, i) in hs.timeline" :key="i" :title="w.tip" :style="{ flex: 1, height: w.h, minHeight: '2px', background: w.bg, borderRadius: '1px' }"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:.58rem;color:var(--om-text-placeholder)"><span>May</span><span>Jul</span><span>Sep</span><span>Oct</span></div>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:7px">
        <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Top Authors</span>
        <div v-for="a in hs.authors" :key="a.name" style="display:grid;grid-template-columns:90px minmax(0,1fr) 34px;gap:8px;align-items:center;font-size:.72rem">
          <span style="font-family:var(--font-mono);color:var(--om-text-value)">{{ a.name }}</span>
          <div style="height:4px;border-radius:2px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: a.w, background: 'var(--om-blue)' }"></div></div>
          <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-muted)">{{ a.pct }}</span>
        </div>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:6px">
        <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Changes Together With</span>
        <div v-for="c in hs.cochange" :key="c.key" @click="c.pick" v-hover="'color:var(--om-text-strong)'" style="display:flex;align-items:center;gap:8px;font-size:.72rem;cursor:pointer;padding:2px 0">
          <span style="font-family:var(--font-mono);color:var(--om-text-value);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ c.name }}</span>
          <span style="font-family:var(--font-mono);font-size:.62rem;color:var(--om-text-muted)">{{ c.dir }}</span>
          <span v-if="c.hidden" title="These files change together but neither imports the other — hidden coupling" style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;padding:0 5px;border-radius:999px;background:var(--om-tone-yellow-bg);color:var(--om-tone-yellow-fg)">No import</span>
          <span style="font-family:var(--font-mono);color:var(--om-teal)">{{ c.score }}</span>
        </div>
      </div>
      <div style="padding:14px 16px;display:flex;flex-direction:column;gap:10px">
        <template v-if="hs.idle">
          <button @click="hs.explain" v-hover="'border-style:solid'" style="display:flex;align-items:center;justify-content:center;gap:8px;padding:9px 12px;border-radius:6px;border:1px dashed var(--ai-line);background:var(--ai-bg);color:var(--ai);font-family:inherit;font-size:.82rem;font-weight:500;cursor:pointer">
            <span class="mdi mdi-creation"></span>Explain This Hotspot<span style="font-family:var(--font-mono);font-size:.62rem;opacity:.7;margin-left:4px">⌘E</span>
          </button>
          <span style="font-size:.65rem;color:var(--om-text-muted);text-align:center">Sends metrics + 3 snippets to llama3.1:8b on this machine</span>
        </template>
        <div v-if="hs.loading" style="border:1px dashed var(--ai-line);background:var(--ai-bg);border-radius:6px;padding:12px;display:flex;align-items:center;gap:8px;font-size:.76rem;color:var(--ai)"><span class="mdi mdi-loading mdi-spin"></span>Reading 48 commits and buildInvoice…</div>
        <div v-if="hs.done" style="border:1px dashed var(--ai-line);background:var(--ai-bg);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:8px">
          <span style="display:flex;align-items:center;gap:4px;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--ai)"><span class="mdi mdi-creation"></span>Why this is risky · AI</span>
          <span style="font-size:.78rem;line-height:1.55;color:var(--om-text);text-wrap:pretty">{{ hs.explainText }}</span>
          <div style="display:flex;gap:6px;font-size:.74rem;line-height:1.45;color:var(--om-text-strong)"><span class="mdi mdi-lightbulb-on-outline" style="color:var(--ai)"></span><span>{{ hs.suggestion }}</span></div>
          <span style="font-size:.62rem;color:var(--om-text-muted)">Based on computed metrics above · verify before acting</span>
        </div>
      </div>
    </div>
  </div>
</template>

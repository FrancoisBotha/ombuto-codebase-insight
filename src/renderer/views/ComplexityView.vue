<script setup>
// Complexity screen (prototype lines 498–603; logic in more(), the S.cxTh block).
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import {
  CXFN, CXMOD,
  COMPLEXITY_BUCKETS, COMPLEXITY_OVER, COMPLEXITY_EXCESS_TOTAL, COMPLEXITY_TAIL_OTHERS, COMPLEXITY_STATS, COMPLEXITY_TREND,
} from '../data/insightData.js';
import { SEV } from '../lib/constants.js';
import { tabs } from '../lib/viewHelpers.js';
import OmButton from '../components/ds/OmButton.vue';
import OmBadge from '../components/ds/OmBadge.vue';

const store = useInsightStore();
const S = store.state;

const cx = computed(() => {
  const th = S.cxTh || '10/20';
  const [W, C] = th.split('/').map(Number);
  const band = (v) => (v > C ? 'critical' : v > W ? 'warning' : 'info');
  const fcol = (b) => (b === 'critical' ? 'var(--om-danger)' : b === 'warning' ? 'var(--om-warning)' : 'var(--om-blue)');
  const B = COMPLEXITY_BUCKETS, ON = COMPLEXITY_OVER;
  const cf = S.cxF || 'all';
  const all = CXFN.map(([fn, path, lines, cc, cog, nest, params, ret, mi, d, cov]) => {
    const [a, b] = lines.split('–').map(Number);
    return { fn, path, file: path.split('/').pop(), dir: path.split('/').slice(1, -1).join('/'), lines, len: b - a + 1, cc, cog, nest, params, ret, mi, d, cov, b: band(cc) };
  });
  const counts = { all: all.length, critical: all.filter((f) => f.b === 'critical').length, warning: all.filter((f) => f.b === 'warning').length, rising: all.filter((f) => f.d > 0).length };
  const fns = all.filter((f) => cf === 'all' || (cf === 'rising' ? f.d > 0 : f.b === cf));
  const sel = all.find((f) => f.fn === S.cxSel) || all[0];
  const EX = COMPLEXITY_EXCESS_TOTAL, ex = all.map((f) => f.cc - 10), top = ex.reduce((a, b) => a + b, 0), pct = Math.round((top / EX) * 100);
  const vol = sel.cc * 95 + sel.cog * 10, dif = 10 + sel.cog / 2;
  return {
    thTabs: tabs([['10/20', '10 / 20'], ['15/30', '15 / 30']], th, 'cxTh', store.setState),
    warn: W, crit: C,
    stats: COMPLEXITY_STATS.map(([k, v, sub]) =>
      k === 'Over W' ? ['Over ' + W, String(ON[W]), sub] : k === 'Over C' ? ['Over ' + C, String(ON[C]), sub] : [k, v, sub],
    ).map(([k, v, sub]) => ({ k, v, sub, fg: sub === 'critical' ? 'var(--om-danger)' : sub === 'warning' ? 'var(--om-warning)' : 'var(--om-text-muted)' })),
    hist: B.map(([l, lo, n]) => ({ l, n: n.toLocaleString(), h: Math.max(2, Math.sqrt(n / 612) * 100).toFixed(1) + '%', bg: fcol(band(lo)) })),
    tail: {
      n: all.length, pct: pct + '%', rest: 100 - pct + '%', others: COMPLEXITY_TAIL_OTHERS,
      segs: all.map((f, i) => ({ w: ((ex[i] / EX) * 100).toFixed(2) + '%', op: i % 2 ? 0.7 : 1, tip: f.fn + ' · +' + ex[i] + ' over 10' })),
      top3: all.slice(0, 3).map((f, i) => ({ fn: f.fn, file: f.file, share: Math.round((ex[i] / EX) * 100) + '%' })),
    },
    mods: CXMOD.map(([m, avg, o]) => ({ m, avg: avg.toFixed(1), w: (avg / 8) * 100 + '%', bg: fcol(avg > 6 ? 'critical' : avg > 4.5 ? 'warning' : 'info'), over: o ? o + ' over 20' : '' })),
    trend: COMPLEXITY_TREND.map((v, i) => ({ h: (v / 14) * 100 + '%', tip: v + ' functions over 20', bg: i > 8 ? 'var(--om-danger)' : 'var(--om-gray-500)' })),
    filters: [['all', 'All'], ['critical', 'Critical'], ['warning', 'Warning'], ['rising', 'Rising']].map(([k, l]) => ({
      k, l, n: counts[k],
      bg: cf === k ? 'var(--om-mint-tint-strong)' : 'transparent',
      fg: cf === k ? 'var(--om-mint)' : 'var(--om-text-muted)',
      bd: cf === k ? 'rgba(109,212,160,.35)' : 'var(--om-border)',
      pick: () => store.setState({ cxF: k }),
    })),
    rows: fns.map((f) => ({
      ...f,
      w: Math.min(100, (f.cc / 38) * 100) + '%', bar: fcol(f.b), sev: SEV[f.b].label, tone: SEV[f.b].tone,
      nestFg: f.nest >= 5 ? 'var(--om-warning)' : 'var(--om-text-value)',
      parFg: f.params >= 5 ? 'var(--om-warning)' : 'var(--om-text-value)',
      retFg: f.ret >= 10 ? 'var(--om-warning)' : 'var(--om-text-value)',
      miFg: f.mi < 35 ? 'var(--om-danger)' : f.mi < 50 ? 'var(--om-warning)' : 'var(--om-text-value)',
      dl: f.d > 0 ? '▲ ' + f.d : f.d < 0 ? '▼ ' + -f.d : '—',
      dfg: f.d > 0 ? 'var(--om-danger)' : f.d < 0 ? 'var(--om-success)' : 'var(--om-text-muted)',
      covL: f.cov + '%', covFg: f.cov < 50 ? 'var(--om-warning)' : 'var(--om-text-value)',
      bg: f.fn === sel.fn ? 'var(--om-mint-tint)' : 'transparent',
      pick: () => store.setState({ cxSel: f.fn }),
    })),
    empty: fns.length === 0,
    sel: {
      fn: sel.fn, path: sel.path, lines: sel.lines,
      open: () => store.go('file', { fsel: sel.path, sel: sel.path }),
      m: [
        ['Cyclomatic', sel.cc], ['Cognitive', sel.cog], ['Max nesting', sel.nest], ['Parameters', sel.params],
        ['Return points', sel.ret], ['Lines', sel.len], ['Maintainability', sel.mi], ['Coverage', sel.cov + '%'],
        ['Halstead volume', vol.toLocaleString()], ['Difficulty', dif.toFixed(1)], ['Effort', Math.round((vol * dif) / 1000) + 'k'], ['Est. bugs', (vol / 3000).toFixed(2)],
      ].map(([k, v]) => ({ k, v })),
    },
  };
});

const GRID = 'minmax(0,1.2fr) minmax(0,1.2fr) 110px 40px 40px 46px 34px 40px 50px 44px 80px';
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0;flex-wrap:wrap">
    <div style="display:flex;flex-direction:column;gap:2px;margin-right:auto">
      <div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Complexity</div>
      <div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">Per function · cyclomatic, cognitive, nesting, Halstead · main @ a91f3c2</div>
    </div>
    <span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Thresholds · warn / critical</span>
    <div style="display:flex;gap:2px;padding:2px;border-radius:6px;background:var(--om-inset);border:1px solid var(--om-border)">
      <button v-for="m in cx.thTabs" :key="m.id" @click="m.pick" :style="{ border: 'none', fontFamily: 'var(--font-mono)', fontSize: '.72rem', fontWeight: 500, padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', background: m.bg, color: m.fg }">{{ m.label }}</button>
    </div>
  </div>
  <div style="flex:1;overflow:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px">
    <div style="flex-shrink:0;background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px">
      <div v-for="s in cx.stats" :key="s.k" style="display:flex;flex-direction:column;gap:1px;border-left:1px solid var(--om-border);padding-left:14px;min-width:0">
        <span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);white-space:nowrap">{{ s.k }}</span>
        <span style="font-family:var(--font-mono);font-size:1.1rem;color:var(--om-text-strong)">{{ s.v }}</span>
        <span :style="{ fontSize: '.62rem', color: s.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }">{{ s.sub }}</span>
      </div>
    </div>
    <div style="flex-shrink:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.15fr) minmax(0,1fr);gap:14px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:10px;min-width:0">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Distribution · Functions by CC</span>
        <div style="height:130px;display:flex;align-items:flex-end;gap:5px;border-bottom:1px solid var(--om-border)">
          <div v-for="b in cx.hist" :key="b.l" style="flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:3px"><span style="font-family:var(--font-mono);font-size:.58rem;color:var(--om-text-value)">{{ b.n }}</span><div :style="{ width: '100%', height: b.h, background: b.bg, borderRadius: '2px 2px 0 0' }"></div></div>
        </div>
        <div style="display:flex;gap:5px"><span v-for="b in cx.hist" :key="b.l" style="flex:1;text-align:center;font-family:var(--font-mono);font-size:.56rem;color:var(--om-text-muted)">{{ b.l }}</span></div>
        <span style="font-size:.6rem;color:var(--om-text-muted)">Square-root scale so the long tail stays visible.</span>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:10px;min-width:0">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">The Long Tail</span>
        <div style="font-size:.95rem;line-height:1.4;color:var(--om-text);text-wrap:pretty"><span style="font-family:var(--font-mono);font-size:1.5rem;color:var(--om-text-strong)">{{ cx.tail.n }}</span> functions hold <span style="font-family:var(--font-mono);font-size:1.5rem;color:var(--om-danger)">{{ cx.tail.pct }}</span> of all complexity above 10.</div>
        <div style="display:flex;height:14px;border-radius:3px;overflow:hidden;gap:1px">
          <span v-for="(g, i) in cx.tail.segs" :key="i" :title="g.tip" :style="{ width: g.w, background: 'var(--om-danger)', opacity: g.op }"></span>
          <span style="flex:1;background:var(--om-gray-500)"></span>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.62rem;color:var(--om-text-muted)"><span>Top {{ cx.tail.n }} · {{ cx.tail.pct }}</span><span>{{ cx.tail.others }} · {{ cx.tail.rest }}</span></div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-top:2px">
          <div v-for="t in cx.tail.top3" :key="t.fn" style="display:flex;gap:8px;font-family:var(--font-mono);font-size:.7rem"><span style="color:var(--om-text-strong)">{{ t.fn }}()</span><span style="color:var(--om-text-muted);flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ t.file }}</span><span style="color:var(--om-danger)">{{ t.share }}</span></div>
        </div>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:7px;min-width:0">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Average CC by Module</span>
        <div v-for="m in cx.mods" :key="m.m" style="display:grid;grid-template-columns:78px minmax(0,1fr) 28px 62px;gap:8px;align-items:center;font-size:.68rem">
          <span style="font-family:var(--font-mono);color:var(--om-text-value)">{{ m.m }}</span>
          <div style="height:6px;border-radius:3px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: m.w, background: m.bg }"></div></div>
          <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-strong)">{{ m.avg }}</span>
          <span style="font-size:.58rem;color:var(--om-danger);white-space:nowrap">{{ m.over }}</span>
        </div>
      </div>
    </div>
    <div style="flex-shrink:0;background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
      <div style="display:flex;align-items:center;gap:8px;padding:12px 16px;flex-wrap:wrap">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);margin-right:auto">Most Complex Functions</span>
        <button v-for="f in cx.filters" :key="f.k" @click="f.pick" :style="{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit', fontSize: '.7rem', fontWeight: 500, padding: '3px 10px', borderRadius: '999px', cursor: 'pointer', background: f.bg, color: f.fg, border: '1px solid ' + f.bd }">{{ f.l }}<span style="font-family:var(--font-mono);font-size:.62rem;opacity:.75">{{ f.n }}</span></button>
      </div>
      <div :style="{ display: 'grid', gridTemplateColumns: GRID }" style="gap:10px;padding:6px 16px;border-top:1px solid var(--om-border);font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)"><span>Function</span><span>File</span><span>Cyclomatic</span><span style="text-align:right" title="Cognitive complexity">Cog</span><span style="text-align:right" title="Max nesting depth">Nest</span><span style="text-align:right" title="Parameter count">Params</span><span style="text-align:right" title="Return points">Ret</span><span style="text-align:right" title="Maintainability index">MI</span><span style="text-align:right">Δ 30d</span><span style="text-align:right">Cov</span><span>Severity</span></div>
      <div v-for="r in cx.rows" :key="r.fn + r.path" @click="r.pick" v-hover="'background:var(--om-card-raised)'" :style="{ display: 'grid', gridTemplateColumns: GRID, gap: '10px', padding: '7px 16px', borderTop: '1px solid var(--om-border)', alignItems: 'center', fontFamily: 'var(--font-mono)', fontSize: '.72rem', cursor: 'pointer', background: r.bg }">
        <span style="color:var(--om-text-strong);font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ r.fn }}()</span>
        <div style="min-width:0;display:flex;flex-direction:column"><span style="color:var(--om-text-value);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ r.file }}</span><span style="font-size:.6rem;color:var(--om-text-muted)">{{ r.dir }} · {{ r.lines }}</span></div>
        <span style="display:flex;align-items:center;gap:6px"><span style="width:22px;text-align:right;color:var(--om-text-strong)">{{ r.cc }}</span><span style="flex:1;height:5px;border-radius:2px;background:var(--om-inset);overflow:hidden"><span :style="{ display: 'block', height: '100%', width: r.w, background: r.bar }"></span></span></span>
        <span style="text-align:right;color:var(--om-text-value)">{{ r.cog }}</span>
        <span :style="{ textAlign: 'right', color: r.nestFg }">{{ r.nest }}</span>
        <span :style="{ textAlign: 'right', color: r.parFg }">{{ r.params }}</span>
        <span :style="{ textAlign: 'right', color: r.retFg }">{{ r.ret }}</span>
        <span :style="{ textAlign: 'right', color: r.miFg }">{{ r.mi }}</span>
        <span :style="{ textAlign: 'right', color: r.dfg }">{{ r.dl }}</span>
        <span :style="{ textAlign: 'right', color: r.covFg }">{{ r.covL }}</span>
        <span><OmBadge kind="flag" :tone="r.tone">{{ r.sev }}</OmBadge></span>
      </div>
      <div v-if="cx.empty" style="padding:24px;text-align:center;font-size:.76rem;color:var(--om-text-muted);border-top:1px solid var(--om-border)">No functions in this band at the current thresholds.</div>
    </div>
    <div style="flex-shrink:0;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) minmax(0,1fr);gap:14px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:10px;min-width:0">
        <div style="display:flex;align-items:center;gap:8px">
          <div style="flex:1;min-width:0;display:flex;flex-direction:column"><span style="font-family:var(--font-mono);font-size:.86rem;font-weight:500;color:var(--om-text-strong)">{{ cx.sel.fn }}()</span><span style="font-family:var(--font-mono);font-size:.64rem;color:var(--om-text-muted)">{{ cx.sel.path }} · {{ cx.sel.lines }}</span></div>
          <OmButton variant="secondary" icon="file-eye-outline" @click="cx.sel.open">Open File</OmButton>
        </div>
        <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 8px">
          <div v-for="m in cx.sel.m" :key="m.k" style="display:flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:.56rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ m.k }}</span><span style="font-family:var(--font-mono);font-size:.9rem;color:var(--om-text-strong)">{{ m.v }}</span></div>
        </div>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:8px;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:baseline"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Over 20 · 12 Months</span><span style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-danger)">9 → 14</span></div>
        <div style="flex:1;min-height:54px;display:flex;align-items:flex-end;gap:3px"><div v-for="(t, i) in cx.trend" :key="i" :title="t.tip" :style="{ flex: 1, height: t.h, background: t.bg, borderRadius: '1px' }"></div></div>
        <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:.58rem;color:var(--om-text-placeholder)"><span>Nov ’25</span><span>Oct ’26</span></div>
      </div>
      <div style="border:1px dashed var(--ai-line);background:var(--ai-bg);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:8px;min-width:0">
        <span style="display:flex;align-items:center;gap:4px;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--ai)"><span class="mdi mdi-creation"></span>Refactoring candidates · AI</span>
        <span style="font-size:.78rem;line-height:1.55;color:var(--om-text);text-wrap:pretty">placeOrder has nesting depth 6 and 9 return points — it mixes validation, pricing and persistence. Moving pricing into billing would remove about 14 branches and weaken the billing ↔ orders cycle.</span>
        <span style="font-size:.62rem;color:var(--om-text-muted)">Interpreted from computed metrics · verify before acting</span>
      </div>
    </div>
  </div>
</template>

<script setup>
// Commit History screen (prototype lines 605–706; logic in more(), "out.gh").
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import { GIT, GFORK, GMERGE, GFILES, GAI, FILES, HISTORY_STATS, HISTORY_INSIGHTS, HISTORY_LANE_BRANCHES } from '@/data/insightData.js';
import { SEV } from '../lib/constants.js';
import { sevOf } from '../lib/viewHelpers.js';
import { hash, rng } from '../lib/random.js';
import OmBadge from '../components/ds/OmBadge.vue';

const store = useInsightStore();
const S = store.state;

const RH = 34, X = (l) => 14 + l * 16, Y = (i) => i * RH + RH / 2;
const LC = ['var(--om-mint)', 'var(--om-blue)', 'var(--om-tone-yellow-fg)', 'var(--om-tone-orange-fg)'];
const curveD = (x1, y1, x2, y2) => 'M' + x1 + ' ' + y1 + 'C' + x1 + ' ' + (y1 + y2) / 2 + ',' + x2 + ' ' + (y1 + y2) / 2 + ',' + x2 + ' ' + y2;
const heat = ['#232a31', '#1d4436', '#28694f', '#3f9068', '#6dd4a0'];

// Heatmap is generated from a fixed seed (rng(91)), so it is computed once.
const weeks = (() => {
  const hr = rng(91);
  return Array.from({ length: 26 }, (_, w) => ({
    days: Array.from({ length: 7 }, (_, d) => {
      const v = d > 4 ? (hr() < 0.85 ? 0 : 1) : Math.min(4, Math.floor(hr() * hr() * 5 * (0.6 + w / 40)));
      return { bg: heat[v], tip: 'Week ' + (w + 1) + ' · ' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][d] + ' · ' + [0, 2, 5, 9, 14][v] + ' commits' };
    }),
  }));
})();

const stats = HISTORY_STATS.map(([k, v, sub]) => ({ k, v, sub, fg: k === 'Reverts' ? 'var(--om-warning)' : 'var(--om-text-muted)' }));
const insights = HISTORY_INSIGHTS.map(([ic, sv, t, d]) => ({ ic, t, d, fg: SEV[sv].fg }));

const gh = computed(() => {
  const rows = GIT.filter((g) => !S.gMain || g.lane === 0);
  const ix = Object.fromEntries(rows.map((g, i) => [g.h, i]));
  const sel = S.gsel || 'a12e7f4';

  const lines = [], curves = [], circles = [];
  [0, 1, 2, 3].forEach((l) => {
    const is = rows.map((g, i) => (g.lane === l ? i : -1)).filter((i) => i >= 0);
    if (is.length > 1) lines.push({ key: 'l' + l, x1: X(l), y1: Y(is[0]), x2: X(l), y2: Y(is[is.length - 1]), c: LC[l] });
  });
  GFORK.forEach(([m, b], k) => {
    if (ix[m] != null && ix[b] != null) {
      const g = GIT.find((x) => x.h === b);
      curves.push({ key: 'f' + k, d: curveD(X(0), Y(ix[m]), X(g.lane), Y(ix[b])), c: LC[g.lane] });
    }
  });
  GMERGE.forEach(([m, b], k) => {
    if (ix[m] != null && ix[b] != null) {
      const g = GIT.find((x) => x.h === b);
      curves.push({ key: 'm' + k, d: curveD(X(g.lane), Y(ix[b]), X(0), Y(ix[m])), c: LC[g.lane] });
    }
  });
  rows.forEach((g, i) => {
    const on = g.h === sel;
    if (on) circles.push({ key: 's' + i, cx: X(g.lane), cy: Y(i), r: 8, fill: 'none', stroke: 'var(--om-text-strong)', sw: 1.5 });
    circles.push({ key: 'c' + i, cx: X(g.lane), cy: Y(i), r: g.kind === 'merge' ? 5 : 4, fill: g.kind === 'merge' ? 'var(--om-card)' : LC[g.lane], stroke: LC[g.lane], sw: 2 });
  });

  const G = GIT.find((g) => g.h === sel) || GIT[0];
  const r2 = rng(hash(G.h));
  const files = (GFILES[G.h] || FILES.slice().sort(() => r2() - 0.5).slice(0, 2).map((f) => [f.path, Math.round(G.add / 2), Math.round(G.del / 2)])).map(([p, a, d]) => {
    const F = FILES.find((x) => x.path === p), sv = F ? sevOf(F) : null, t = Math.max(1, a + d);
    return {
      p, name: p.split('/').pop(), dir: p.split('/').slice(0, -1).join('/'), a: '+' + a, d: '−' + d,
      aw: (a / t) * 100 + '%', dw: (d / t) * 100 + '%',
      dot: sv === 'critical' ? 'var(--om-danger)' : sv === 'warning' ? 'var(--om-warning)' : 'transparent',
      open: () => FILES.find((x) => x.path === p) && store.go('file', { fsel: p }),
    };
  });
  const hot = files.filter((f) => { const F = FILES.find((x) => x.path === f.p); return F && sevOf(F) === 'critical'; }).map((f) => f.name);
  const tests = files.some((f) => f.p.startsWith('test/'));
  const notes = [];
  if (G.kind === 'revert') notes.push({ sev: 'WARNING', tone: 'yellow', t: 'Revert — ' + (G.h === 'c0d4e9a' ? '2nd revert in tax logic this month' : 'reverts a change from the day before') });
  if (hot.length && !tests && G.kind !== 'merge') notes.push({ sev: 'WARNING', tone: 'yellow', t: 'Changes hotspot ' + hot.join(', ') + ' with no test changes' });
  if (G.add + G.del > 150) notes.push({ sev: 'INFO', tone: 'blue', t: 'Large change · ' + (G.add + G.del) + ' lines' });

  return {
    svgH: rows.length * RH, lines, curves, circles,
    toggles: [['all', 'All Branches'], ['main', 'First-Parent · main']].map(([k, l]) => {
      const on = (k === 'main') === !!S.gMain;
      return { k, l, bg: on ? 'var(--om-card-raised)' : 'transparent', fg: on ? 'var(--om-mint)' : 'var(--om-text-muted)', pick: () => store.setState({ gMain: k === 'main' }) };
    }),
    rows: rows.map((g) => ({
      ...g,
      bg: g.h === sel ? 'var(--om-mint-tint)' : 'transparent',
      isRevert: g.kind === 'revert',
      mfg: g.kind === 'merge' ? 'var(--om-text-muted)' : 'var(--om-text-strong)',
      refs: g.refs.map((r) => ({ r, ic: /^v\d/.test(r) ? 'mdi-tag-outline' : r === 'HEAD' ? 'mdi-crosshairs-gps' : 'mdi-source-branch', fg: LC[g.lane] })),
      a: '+' + g.add, d: '−' + g.del,
      pick: () => store.setState({ gsel: g.h }),
    })),
    c: {
      h: G.h, msg: G.msg, author: G.author, when: G.when, a: '+' + G.add, d: '−' + G.del,
      nf: files.length + ' file' + (files.length > 1 ? 's' : ''),
      branch: HISTORY_LANE_BRANCHES[G.lane], files, notes, hasNotes: notes.length > 0,
      ai: GAI[G.h] || (G.msg + '. ' + files.length + ' file' + (files.length > 1 ? 's' : '') + ' changed, ' + G.add + ' lines added and ' + G.del + ' removed. ' + (hot.length ? 'Touches the hotspot ' + hot.join(', ') + '.' : 'No hotspot files are touched.')),
    },
  };
});
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0;flex-wrap:wrap">
    <div style="display:flex;flex-direction:column;gap:2px;margin-right:auto">
      <div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Commit History</div>
      <div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">8,412 commits · 4 active branches · since Aug 2022</div>
    </div>
    <div style="display:flex;gap:2px;padding:2px;border-radius:6px;background:var(--om-inset);border:1px solid var(--om-border)">
      <button v-for="m in gh.toggles" :key="m.k" @click="m.pick" :style="{ border: 'none', fontFamily: 'inherit', fontSize: '.72rem', fontWeight: 500, padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', background: m.bg, color: m.fg, whiteSpace: 'nowrap' }">{{ m.l }}</button>
    </div>
    <select class="om-select om-select--md"><option>All authors</option><option>m.okafor</option><option>j.lindqvist</option><option>p.nair</option></select>
    <select class="om-select om-select--md"><option>Last 90 days</option><option>Last 12 months</option><option>All time</option></select>
  </div>
  <div style="flex:1;min-height:0;display:flex">
    <div style="flex:1;min-width:0;overflow:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:16px">
        <div v-for="s in stats" :key="s.k" style="display:flex;flex-direction:column;gap:1px;border-left:1px solid var(--om-border);padding-left:14px;min-width:0">
          <span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);white-space:nowrap">{{ s.k }}</span>
          <span style="font-family:var(--font-mono);font-size:1rem;color:var(--om-text-strong);white-space:nowrap">{{ s.v }}</span>
          <span :style="{ fontSize: '.62rem', color: s.fg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }">{{ s.sub }}</span>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:auto minmax(0,1fr);gap:14px">
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px;display:flex;flex-direction:column;gap:8px">
          <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Activity · 26 Weeks</span>
          <div style="display:flex;gap:3px">
            <div style="display:grid;grid-template-rows:repeat(7,10px);gap:3px;font-size:.55rem;color:var(--om-text-placeholder);line-height:10px;margin-right:2px"><span>Mon</span><span></span><span>Wed</span><span></span><span>Fri</span><span></span><span>Sun</span></div>
            <div v-for="(w, wi) in weeks" :key="wi" style="display:grid;grid-template-rows:repeat(7,10px);gap:3px"><span v-for="(d, di) in w.days" :key="di" :title="d.tip" :style="{ width: '10px', height: '10px', borderRadius: '2px', background: d.bg }"></span></div>
          </div>
          <div style="display:flex;align-items:center;gap:3px;font-size:.6rem;color:var(--om-text-muted)"><span style="margin-right:3px">less</span><span v-for="c in heat" :key="c" :style="{ width: '10px', height: '10px', borderRadius: '2px', background: c }"></span><span style="margin-left:3px">more</span></div>
        </div>
        <div style="display:flex;flex-direction:column;gap:8px;min-width:0">
          <div v-for="n in insights" :key="n.t" style="flex:1;display:flex;gap:10px;align-items:flex-start;background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:10px 14px;min-width:0">
            <span :class="'mdi ' + n.ic" :style="{ fontSize: '1rem', color: n.fg, marginTop: '1px' }"></span>
            <div style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:.8rem;font-weight:500;color:var(--om-text-strong)">{{ n.t }}</span><span style="font-family:var(--font-mono);font-size:.66rem;color:var(--om-text-muted);text-wrap:pretty">{{ n.d }}</span></div>
          </div>
        </div>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:14px;padding:10px 16px;border-bottom:1px solid var(--om-border);font-size:.66rem;color:var(--om-text-muted)">
          <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;margin-right:auto">Git Graph</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;background:var(--om-mint)"></span>main</span>
          <span style="display:flex;align-items:center;gap:5px"><span style="width:8px;height:8px;border-radius:50%;border:2px solid var(--om-text-muted);box-sizing:border-box"></span>merge</span>
          <span style="font-family:var(--font-mono)">↑↓ move · ⏎ open diff</span>
        </div>
        <div style="position:relative">
          <svg :width="72" :height="gh.svgH" style="position:absolute;left:6px;top:0;pointer-events:none">
            <line v-for="l in gh.lines" :key="l.key" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" :style="{ stroke: l.c, strokeWidth: 1.8 }" />
            <path v-for="p in gh.curves" :key="p.key" :d="p.d" :style="{ fill: 'none', stroke: p.c, strokeWidth: 1.8 }" />
            <circle v-for="c in gh.circles" :key="c.key" :cx="c.cx" :cy="c.cy" :r="c.r" :style="{ fill: c.fill, stroke: c.stroke, strokeWidth: c.sw }" />
          </svg>
          <div v-for="g in gh.rows" :key="g.h" @click="g.pick" v-hover="'background:var(--om-white-04)'" :style="{ height: '34px', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 92px 84px 72px 64px', gap: '12px', alignItems: 'center', padding: '0 16px 0 86px', cursor: 'pointer', background: g.bg, borderTop: '1px solid var(--om-white-04)', fontSize: '.76rem' }">
            <div style="display:flex;align-items:center;gap:6px;min-width:0">
              <span v-for="r in g.refs" :key="r.r" :style="{ display: 'flex', alignItems: 'center', gap: '3px', fontFamily: 'var(--font-mono)', fontSize: '.62rem', padding: '0 6px', borderRadius: '999px', border: '1px solid ' + r.fg, color: r.fg, whiteSpace: 'nowrap', lineHeight: 1.5 }"><span :class="'mdi ' + r.ic"></span>{{ r.r }}</span>
              <OmBadge v-if="g.isRevert" kind="flag" tone="yellow" icon="undo-variant">REVERT</OmBadge>
              <span :style="{ color: g.mfg, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }">{{ g.msg }}</span>
            </div>
            <span style="font-family:var(--font-mono);font-size:.68rem;color:var(--om-text-value);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ g.author }}</span>
            <span style="font-size:.68rem;color:var(--om-text-muted);white-space:nowrap">{{ g.when }}</span>
            <span style="font-family:var(--font-mono);font-size:.66rem;white-space:nowrap;text-align:right"><span style="color:var(--om-success)">{{ g.a }}</span> <span style="color:var(--om-danger)">{{ g.d }}</span></span>
            <span style="font-family:var(--font-mono);font-size:.66rem;color:var(--om-blue);text-align:right">{{ g.h }}</span>
          </div>
        </div>
      </div>
    </div>
    <div style="width:340px;flex-shrink:0;border-left:1px solid var(--om-border);background:var(--om-surface);overflow:auto;display:flex;flex-direction:column">
      <div style="padding:14px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;align-items:center;gap:8px;font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)"><span class="mdi mdi-source-commit"></span><span style="color:var(--om-blue)">{{ gh.c.h }}</span><span>·</span><span style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ gh.c.branch }}</span></div>
        <span style="font-size:.9rem;font-weight:600;color:var(--om-text-strong);line-height:1.4">{{ gh.c.msg }}</span>
        <div style="display:flex;gap:10px;font-size:.7rem;color:var(--om-text-muted)"><span style="font-family:var(--font-mono);color:var(--om-text-value)">{{ gh.c.author }}</span><span>{{ gh.c.when }}</span><span style="margin-left:auto;font-family:var(--font-mono)"><span style="color:var(--om-success)">{{ gh.c.a }}</span> <span style="color:var(--om-danger)">{{ gh.c.d }}</span></span></div>
      </div>
      <div v-if="gh.c.hasNotes" style="padding:12px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:6px">
        <div v-for="n in gh.c.notes" :key="n.t" style="display:flex;gap:8px;align-items:flex-start;font-size:.74rem;color:var(--om-text);line-height:1.45"><OmBadge kind="flag" :tone="n.tone">{{ n.sev }}</OmBadge><span>{{ n.t }}</span></div>
      </div>
      <div style="padding:12px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:6px">
        <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Files Changed · {{ gh.c.nf }}</span>
        <div v-for="f in gh.c.files" :key="f.p" @click="f.open" v-hover="'color:var(--om-text-strong)'" style="display:grid;grid-template-columns:8px minmax(0,1fr) 70px 40px;gap:8px;align-items:center;padding:4px 0;cursor:pointer">
          <span :style="{ width: '6px', height: '6px', borderRadius: '50%', background: f.dot }"></span>
          <div style="min-width:0;display:flex;flex-direction:column"><span style="font-family:var(--font-mono);font-size:.72rem;color:var(--om-text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ f.name }}</span><span style="font-family:var(--font-mono);font-size:.6rem;color:var(--om-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ f.dir }}</span></div>
          <div style="display:flex;height:5px;border-radius:2px;overflow:hidden;background:var(--om-inset)"><span :style="{ width: f.aw, background: 'var(--om-success)' }"></span><span :style="{ width: f.dw, background: 'var(--om-danger)' }"></span></div>
          <span style="font-family:var(--font-mono);font-size:.62rem;color:var(--om-text-muted);text-align:right;white-space:nowrap">{{ f.a }} {{ f.d }}</span>
        </div>
      </div>
      <div style="padding:14px 16px">
        <div style="border:1px dashed var(--ai-line);background:var(--ai-bg);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:6px">
          <span style="display:flex;align-items:center;gap:4px;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--ai)"><span class="mdi mdi-creation"></span>What changed · AI</span>
          <span style="font-size:.78rem;line-height:1.55;color:var(--om-text);text-wrap:pretty">{{ gh.c.ai }}</span>
          <span style="font-size:.62rem;color:var(--om-text-muted)">Interpreted from the diff · verify before acting</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
// Code Quality screen (prototype `is.quality` block, lines 794–938; view-model out.q in more()).
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import { SEV } from '../lib/constants.js';
import { sevOf } from '../lib/viewHelpers.js';
import OmBadge from '../components/ds/OmBadge.vue';
import {
  FILES, QUALITY_TABS, QUALITY_STATS, QUALITY_CLONES, QUALITY_UNUSED_EXP, QUALITY_UNREF_FILES, QUALITY_UNUSED_FNS,
  QUALITY_TYPE_ROWS, QUALITY_TYPE_TILES, QUALITY_OTHER_LANGS, QUALITY_DOC_ROWS, QUALITY_LOW_COMMENT,
  QUALITY_TODO_KINDS, QUALITY_TODOS, QUALITY_TEST_TILES, QUALITY_SKIPPED, QUALITY_UNTESTED,
} from '../data/insightData.js';

const store = useInsightStore();
const S = store.state;

const ageFg = (a) => (/y/.test(a) && parseInt(a) >= 2 ? 'var(--om-warning)' : 'var(--om-text-value)');

const q = computed(() => {
  const QT = S.qtab || 'dup';
  const qt = (k, l, n) => ({ k, l, n, fg: QT === k ? 'var(--om-mint)' : 'var(--om-text-muted)', bd: QT === k ? 'var(--om-mint)' : 'transparent', pick: () => store.setState({ qtab: k }) });
  return {
    tabs: QUALITY_TABS.map(([k, l, n]) => qt(k, l, n)),
    isDup: QT === 'dup', isDead: QT === 'dead', isTypes: QT === 'types', isDocs: QT === 'docs', isTests: QT === 'tests',
    stats: QUALITY_STATS.map(([k, v, sub]) => ({ k, v, sub })),
    clones: QUALITY_CLONES.map(([t, a, ar, b, br, l, tk, sim, note]) => ({ t, a: a.split('/').pop() + ':' + ar, ad: a.split('/').slice(0, -1).join('/'), b: b.split('/').pop() + ':' + br, bd: b.split('/').slice(0, -1).join('/'), l, tk, sim, note, tone: t === 'Exact' ? 'red' : 'yellow' })),
    unusedExp: QUALITY_UNUSED_EXP.map(([n, p, w, warn]) => ({ n, p, w, warn, hasWarn: !!warn })),
    unrefFiles: QUALITY_UNREF_FILES.map(([p, l, w]) => ({ p, l, w })),
    unusedFns: QUALITY_UNUSED_FNS.map(([n, p]) => ({ n, p })),
    typeRows: QUALITY_TYPE_ROWS.map(([p, c, a, ti, ed, nn]) => ({ p, c: c.toFixed(1) + '%', w: c + '%', bg: c < 88 ? 'var(--om-warning)' : 'var(--om-mint)', a, ti, ed, nn, afg: a >= 15 ? 'var(--om-warning)' : 'var(--om-text-value)' })),
    typeTiles: QUALITY_TYPE_TILES.map(([k, v, s2]) => ({ k, v, s2 })),
    otherLangs: QUALITY_OTHER_LANGS.map(([l, d]) => ({ l, d })),
    docRows: QUALITY_DOC_ROWS.map(([p, v]) => ({ p, v: v + '%', w: v + '%', bg: v < 35 ? 'var(--om-warning)' : 'var(--om-teal)' })),
    lowComment: QUALITY_LOW_COMMENT.map(([p, v]) => ({ p, v })),
    todoKinds: QUALITY_TODO_KINDS.map(([k, n]) => ({ k, n })),
    todos: QUALITY_TODOS.map(([k, t, p, a, age]) => ({ k, t, p, a, age, afg: ageFg(age), tone: k === 'TODO' ? 'blue' : k === 'FIXME' ? 'yellow' : 'red' })),
    testTiles: QUALITY_TEST_TILES.map(([k, v, s2]) => ({ k, v, s2 })),
    skipped: QUALITY_SKIPPED.map(([n, p, a]) => ({ n, p, a })),
    untested: QUALITY_UNTESTED.map((p) => {
      const F = FILES.find((x) => x.path === p), sv = sevOf(F);
      return { p, churn: F.churn + ' changes', cx: 'cc ' + F.cx, sev: SEV[sv].label, tone: SEV[sv].tone, open: () => store.go('file', { fsel: p }) };
    }),
  };
});
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0;flex-wrap:wrap"><div style="display:flex;flex-direction:column;gap:2px;margin-right:auto"><div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Code Quality</div><div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">Duplication · dead code · type safety · documentation · tests</div></div></div>
  <div style="flex:1;overflow:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px">
    <div style="flex-shrink:0;background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px;display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:14px">
      <div v-for="s in q.stats" :key="s.k" style="display:flex;flex-direction:column;gap:1px;border-left:1px solid var(--om-border);padding-left:12px;min-width:0"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ s.k }}</span><span style="font-family:var(--font-mono);font-size:1.05rem;color:var(--om-text-strong)">{{ s.v }}</span><span style="font-size:.6rem;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ s.sub }}</span></div>
    </div>
    <div style="flex-shrink:0;display:flex;border-bottom:1px solid var(--om-border);gap:4px">
      <button v-for="t in q.tabs" :key="t.k" @click="t.pick" :style="{ display: 'flex', alignItems: 'center', gap: '7px', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 500, padding: '8px 12px 7px', cursor: 'pointer', color: t.fg, borderBottom: '2px solid ' + t.bd, marginBottom: '-1px', whiteSpace: 'nowrap' }">{{ t.l }}<span style="font-family:var(--font-mono);font-size:.64rem;padding:0 6px;border-radius:999px;background:var(--om-tone-neutral-bg);color:var(--om-tone-neutral-fg)">{{ t.n }}</span></button>
    </div>

    <div v-if="q.isDup" style="flex-shrink:0;background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Clone Groups · token-based, ≥ 15 lines</span><span style="font-size:.64rem;color:var(--om-text-muted)">14 exact · 9 near-clones</span></div>
      <div style="display:grid;grid-template-columns:64px minmax(0,1fr) minmax(0,1fr) 50px 56px 50px minmax(0,1.2fr);gap:12px;padding:6px 16px;border-top:1px solid var(--om-border);font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)"><span>Type</span><span>Location A</span><span>Location B</span><span style="text-align:right">Lines</span><span style="text-align:right">Tokens</span><span style="text-align:right">Sim</span><span>Difference</span></div>
      <div v-for="(c, i) in q.clones" :key="i" style="display:grid;grid-template-columns:64px minmax(0,1fr) minmax(0,1fr) 50px 56px 50px minmax(0,1.2fr);gap:12px;padding:8px 16px;border-top:1px solid var(--om-border);align-items:center;font-size:.72rem">
        <span><OmBadge kind="flag" :tone="c.tone">{{ c.t }}</OmBadge></span>
        <div style="min-width:0;display:flex;flex-direction:column;font-family:var(--font-mono)"><span style="color:var(--om-text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ c.a }}</span><span style="font-size:.6rem;color:var(--om-text-muted)">{{ c.ad }}</span></div>
        <div style="min-width:0;display:flex;flex-direction:column;font-family:var(--font-mono)"><span style="color:var(--om-text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ c.b }}</span><span style="font-size:.6rem;color:var(--om-text-muted)">{{ c.bd }}</span></div>
        <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-value)">{{ c.l }}</span>
        <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-muted)">{{ c.tk }}</span>
        <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-value)">{{ c.sim }}</span>
        <span style="color:var(--om-text-muted)">{{ c.note }}</span>
      </div>
    </div>

    <div v-if="q.isDead" style="flex-shrink:0;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
        <div style="display:flex;justify-content:space-between;padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Unused Exports · 12</span><span style="font-size:.64rem;color:var(--om-text-muted)">no importer anywhere in the repo</span></div>
        <div v-for="u in q.unusedExp" :key="u.n" style="display:flex;align-items:center;gap:10px;padding:7px 16px;border-top:1px solid var(--om-border);font-size:.72rem">
          <span style="font-family:var(--font-mono);color:var(--om-text-strong);min-width:130px">{{ u.n }}</span>
          <span style="font-family:var(--font-mono);color:var(--om-text-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ u.p }}</span>
          <OmBadge v-if="u.hasWarn" kind="flag" tone="yellow">{{ u.warn }}</OmBadge>
          <span style="font-size:.66rem;color:var(--om-text-muted);white-space:nowrap">{{ u.w }}</span>
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
          <div style="padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Unreferenced Files · 3</span></div>
          <div v-for="u in q.unrefFiles" :key="u.p" style="display:flex;align-items:center;gap:10px;padding:7px 16px;border-top:1px solid var(--om-border);font-size:.72rem"><span style="font-family:var(--font-mono);color:var(--om-text-strong);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ u.p }}</span><span style="font-family:var(--font-mono);font-size:.66rem;color:var(--om-text-muted)">{{ u.l }}</span><span style="font-size:.66rem;color:var(--om-warning);white-space:nowrap">{{ u.w }}</span></div>
        </div>
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
          <div style="padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Unused Functions Within a File · 5</span></div>
          <div v-for="u in q.unusedFns" :key="u.n" style="display:flex;gap:10px;padding:6px 16px;border-top:1px solid var(--om-border);font-family:var(--font-mono);font-size:.72rem"><span style="color:var(--om-text-strong);min-width:120px">{{ u.n }}()</span><span style="color:var(--om-text-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ u.p }}</span></div>
        </div>
      </div>
    </div>

    <template v-if="q.isTypes">
      <div style="flex-shrink:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px">
        <div v-for="t in q.typeTiles" :key="t.k" style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:10px 14px;display:flex;flex-direction:column;gap:1px"><span style="font-family:var(--font-mono);font-size:.62rem;color:var(--om-text-muted)">{{ t.k }}</span><span style="font-family:var(--font-mono);font-size:1.2rem;color:var(--om-text-strong)">{{ t.v }}</span><span style="font-size:.6rem;color:var(--om-text-muted)">{{ t.s2 }}</span></div>
      </div>
      <div style="flex-shrink:0;display:grid;grid-template-columns:minmax(0,1.6fr) minmax(0,1fr);gap:14px">
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
          <div style="padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">TypeScript Signals by Folder</span></div>
          <div style="display:grid;grid-template-columns:110px minmax(0,1fr) 46px 64px 70px 46px;gap:12px;padding:6px 16px;border-top:1px solid var(--om-border);font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)"><span>Folder</span><span>Type coverage</span><span style="text-align:right">any</span><span style="text-align:right">ts-ignore</span><span style="text-align:right">eslint-off</span><span style="text-align:right">!</span></div>
          <div v-for="r in q.typeRows" :key="r.p" style="display:grid;grid-template-columns:110px minmax(0,1fr) 46px 64px 70px 46px;gap:12px;padding:7px 16px;border-top:1px solid var(--om-border);align-items:center;font-family:var(--font-mono);font-size:.72rem">
            <span style="color:var(--om-text-value)">{{ r.p }}</span>
            <span style="display:flex;align-items:center;gap:8px"><span style="flex:1;height:5px;border-radius:2px;background:var(--om-inset);overflow:hidden"><span :style="{ display: 'block', height: '100%', width: r.w, background: r.bg }"></span></span><span style="width:44px;text-align:right;color:var(--om-text-strong)">{{ r.c }}</span></span>
            <span :style="{ textAlign: 'right', color: r.afg }">{{ r.a }}</span><span style="text-align:right;color:var(--om-text-value)">{{ r.ti }}</span><span style="text-align:right;color:var(--om-text-value)">{{ r.ed }}</span><span style="text-align:right;color:var(--om-text-value)">{{ r.nn }}</span>
          </div>
        </div>
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:10px">
          <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Other Language Signals</span>
          <div v-for="o in q.otherLangs" :key="o.l" style="display:flex;flex-direction:column;gap:2px;padding:8px 10px;border-radius:6px;border:1px dashed var(--om-border)"><div style="display:flex;justify-content:space-between"><span style="font-size:.78rem;font-weight:500;color:var(--om-text-label)">{{ o.l }}</span><span style="font-size:.6rem;color:var(--om-text-placeholder)">not detected</span></div><span style="font-family:var(--font-mono);font-size:.64rem;color:var(--om-text-muted)">{{ o.d }}</span></div>
          <span style="font-size:.62rem;color:var(--om-text-muted)">Read from the syntax tree for each language found.</span>
        </div>
      </div>
    </template>

    <div v-if="q.isDocs" style="flex-shrink:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.6fr);gap:14px">
      <div style="display:flex;flex-direction:column;gap:14px">
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:7px">
          <div style="display:flex;justify-content:space-between"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">JSDoc on Exported Functions</span><span style="font-family:var(--font-mono);font-size:.72rem;color:var(--om-text-strong)">38%</span></div>
          <div v-for="d in q.docRows" :key="d.p" style="display:grid;grid-template-columns:90px minmax(0,1fr) 36px;gap:8px;align-items:center;font-family:var(--font-mono);font-size:.7rem"><span style="color:var(--om-text-value)">{{ d.p }}</span><div style="height:5px;border-radius:2px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: d.w, background: d.bg }"></div></div><span style="text-align:right;color:var(--om-text-strong)">{{ d.v }}</span></div>
        </div>
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:6px">
          <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Lowest Comment Density</span>
          <div v-for="d in q.lowComment" :key="d.p" style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:.7rem"><span style="color:var(--om-text-value)">{{ d.p }}</span><span style="color:var(--om-warning)">{{ d.v }}</span></div>
        </div>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
        <div style="display:flex;align-items:center;gap:8px;padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);margin-right:auto">TODO / FIXME / HACK · oldest first</span>
          <span v-for="k in q.todoKinds" :key="k.k" style="font-family:var(--font-mono);font-size:.64rem;padding:1px 8px;border-radius:999px;background:var(--om-tone-neutral-bg);color:var(--om-tone-neutral-fg)">{{ k.k }} {{ k.n }}</span>
        </div>
        <div v-for="t in q.todos" :key="t.p" style="display:grid;grid-template-columns:64px minmax(0,1fr) 70px 60px;gap:12px;padding:8px 16px;border-top:1px solid var(--om-border);align-items:center;font-size:.72rem">
          <span><OmBadge kind="flag" :tone="t.tone">{{ t.k }}</OmBadge></span>
          <div style="min-width:0;display:flex;flex-direction:column;gap:1px"><span style="color:var(--om-text-strong);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ t.t }}</span><span style="font-family:var(--font-mono);font-size:.62rem;color:var(--om-text-muted)">{{ t.p }}</span></div>
          <span style="font-family:var(--font-mono);font-size:.66rem;color:var(--om-text-muted)">{{ t.a }}</span>
          <span :style="{ fontFamily: 'var(--font-mono)', fontSize: '.7rem', textAlign: 'right', color: t.afg }" title="Age from git blame">{{ t.age }}</span>
        </div>
      </div>
    </div>

    <template v-if="q.isTests">
      <div style="flex-shrink:0;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:10px">
        <div v-for="t in q.testTiles" :key="t.k" style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:10px 14px;display:flex;flex-direction:column;gap:1px"><span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">{{ t.k }}</span><span style="font-family:var(--font-mono);font-size:1.2rem;color:var(--om-text-strong)">{{ t.v }}</span><span style="font-size:.6rem;color:var(--om-text-muted)">{{ t.s2 }}</span></div>
      </div>
      <div style="flex-shrink:0;display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr);gap:14px">
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
          <div style="display:flex;justify-content:space-between;padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Source Files Without Tests · by churn</span><span style="font-size:.64rem;color:var(--om-text-muted)">matched by *.test.ts naming</span></div>
          <div v-for="u in q.untested" :key="u.p" @click="u.open" v-hover="'background:var(--om-card-raised)'" style="display:flex;align-items:center;gap:10px;padding:7px 16px;border-top:1px solid var(--om-border);font-size:.72rem;cursor:pointer">
            <span style="font-family:var(--font-mono);color:var(--om-text-strong);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ u.p }}</span>
            <span style="font-family:var(--font-mono);font-size:.66rem;color:var(--om-text-muted)">{{ u.churn }} · {{ u.cx }}</span>
            <OmBadge kind="flag" :tone="u.tone">{{ u.sev }}</OmBadge>
          </div>
        </div>
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
          <div style="padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Skipped Tests · 11</span></div>
          <div v-for="t in q.skipped" :key="t.n" style="display:flex;flex-direction:column;gap:2px;padding:7px 16px;border-top:1px solid var(--om-border)"><div style="display:flex;justify-content:space-between;gap:8px;font-size:.74rem"><span style="color:var(--om-text-strong)">{{ t.n }}</span><span style="font-size:.66rem;color:var(--om-warning);white-space:nowrap">{{ t.a }}</span></div><span style="font-family:var(--font-mono);font-size:.62rem;color:var(--om-text-muted)">{{ t.p }}</span></div>
        </div>
      </div>
    </template>
  </div>
</template>

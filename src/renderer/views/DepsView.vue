<script setup>
// Dependencies screen (prototype `is.deps` block, lines 1386–1431; view-model out.dp in more()).
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import { SEV, VSEV, STAT } from '../lib/constants.js';
import OmBadge from '../components/ds/OmBadge.vue';
import OmPrototypeBanner from '../components/ds/OmPrototypeBanner.vue';
import { DEPS, DEPS_VULN_RANK } from '../data/insightData.js';

const store = useInsightStore();
const S = store.state;

const COLS = [['name', 'Package', 'left'], ['cur', 'Current', 'left'], ['latest', 'Latest', 'left'], ['status', 'Status', 'left'], ['vulns', 'Vulnerabilities', 'left'], ['lic', 'License', 'left'], ['size', 'Size', 'right'], ['rel', 'Last Release', 'left'], ['used', 'Used In', 'right']];
const FILTERS = [['all', 'All'], ['vuln', 'Vulnerable'], ['major', 'Major Behind'], ['license', 'License Issues'], ['deprecated', 'Deprecated']];
const mon = (d) => { const [y, m] = d.split('-'); return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][+m - 1] + ' ' + y; };

const dp = computed(() => {
  const VR = DEPS_VULN_RANK;
  let rows = DEPS.map(([name, cur, latest, status, vuln, lic, size, rel, used, licNote]) => ({ name, cur, latest, status, st: STAT[status], vuln, lic, licNote: licNote || (lic === 'WTFPL' ? 'Non-OSI license' : ''), size, rel, used }));
  const cnt = { all: rows.length, vuln: rows.filter((r) => r.vuln).length, major: rows.filter((r) => r.status === 'major').length, license: rows.filter((r) => r.licNote).length, deprecated: rows.filter((r) => r.status === 'deprecated').length };
  const fl = { all: () => true, vuln: (r) => r.vuln, major: (r) => r.status === 'major', license: (r) => r.licNote, deprecated: (r) => r.status === 'deprecated' }[S.depFilter];
  rows = rows.filter(fl).filter((r) => !S.depQ || r.name.includes(S.depQ.toLowerCase()));
  const key = { name: (r) => r.name, cur: (r) => r.cur, latest: (r) => r.latest, status: (r) => r.st.r, vulns: (r) => (r.vuln ? VR[r.vuln[0]] : 0), lic: (r) => r.lic, size: (r) => r.size, rel: (r) => r.rel, used: (r) => r.used }[S.sortKey];
  rows.sort((a, b) => { const x = key(a), y = key(b); return (x > y ? 1 : x < y ? -1 : a.name.localeCompare(b.name)) * S.sortDir; });
  return {
    cols: COLS.map(([k, l, al]) => ({
      k, l, al,
      arrow: S.sortKey === k ? (S.sortDir > 0 ? 'mdi-arrow-up' : 'mdi-arrow-down') : '',
      fg: S.sortKey === k ? 'var(--om-text-strong)' : 'var(--om-text-muted)',
      pick: () => store.setState((s) => ({ sortKey: k, sortDir: s.sortKey === k ? -s.sortDir : (k === 'name' || k === 'lic' ? 1 : -1) })),
    })),
    rows: rows.map((r) => {
      const vs = r.vuln ? SEV[VSEV[r.vuln[0]]] : null;
      const old = +r.rel.slice(0, 4) <= 2022;
      return {
        name: r.name, cur: r.cur, latest: r.latest, same: r.cur === r.latest, stL: r.st.l, stT: r.st.tone,
        hasV: !!r.vuln, noV: !r.vuln, vL: r.vuln ? r.vuln[0].toUpperCase() : '', vT: vs ? vs.tone : '', vD: r.vuln ? r.vuln[1] : '',
        lic: r.lic, licNote: r.licNote, licFg: r.licNote ? 'var(--om-warning)' : 'var(--om-text-value)',
        size: r.size >= 1000 ? (r.size / 1000).toFixed(1) + ' MB' : r.size + ' kB',
        rel: mon(r.rel), relFg: old ? 'var(--om-warning)' : 'var(--om-text-value)', relNote: old ? 'stale' : '', used: r.used + ' files',
      };
    }),
    empty: rows.length === 0,
    count: rows.length,
    filters: FILTERS.map(([k, l]) => ({
      k, l, n: cnt[k],
      bg: S.depFilter === k ? 'var(--om-mint-tint-strong)' : 'transparent',
      fg: S.depFilter === k ? 'var(--om-mint)' : 'var(--om-text-muted)',
      bd: S.depFilter === k ? 'rgba(109,212,160,.35)' : 'var(--om-border)',
      pick: () => store.setState({ depFilter: k }),
    })),
  };
});
const onQ = (e) => store.setState({ depQ: e.target.value });
const GRID = 'minmax(140px,1.3fr) 80px 80px 120px minmax(200px,2fr) minmax(110px,1fr) 70px 110px 70px';
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0">
    <div style="display:flex;flex-direction:column;gap:2px;margin-right:auto">
      <div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Dependencies</div>
      <div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">package-lock.json · 18 direct · 124 transitive · advisories synced 24 Oct</div>
    </div>
    <div style="display:flex;gap:16px">
      <div style="display:flex;flex-direction:column;align-items:flex-end"><span style="font-family:var(--font-mono);font-size:1rem;color:var(--om-danger)">2</span><span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Critical</span></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end"><span style="font-family:var(--font-mono);font-size:1rem;color:var(--om-warning)">4</span><span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Warning</span></div>
      <div style="display:flex;flex-direction:column;align-items:flex-end"><span style="font-family:var(--font-mono);font-size:1rem;color:var(--om-text-strong)">7</span><span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Major Behind</span></div>
    </div>
  </div>
  <OmPrototypeBanner />
  <div style="display:flex;align-items:center;gap:8px;padding:10px 20px;border-bottom:1px solid var(--om-border);flex-wrap:wrap">
    <div style="position:relative;width:240px"><span class="mdi mdi-magnify" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--om-text-muted)"></span><input class="om-input" :value="S.depQ" @input="onQ" placeholder="Filter packages" style="padding-left:28px;padding-top:5px;padding-bottom:5px;font-size:.78rem"></div>
    <button v-for="f in dp.filters" :key="f.k" @click="f.pick" :style="{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit', fontSize: '.72rem', fontWeight: 500, padding: '4px 10px', borderRadius: '999px', cursor: 'pointer', background: f.bg, color: f.fg, border: '1px solid ' + f.bd }">{{ f.l }}<span style="font-family:var(--font-mono);font-size:.64rem;opacity:.75">{{ f.n }}</span></button>
    <span style="margin-left:auto;font-size:.68rem;color:var(--om-text-muted)">{{ dp.count }} shown · click a column to sort</span>
  </div>
  <div style="flex:1;min-height:0;overflow:auto">
    <div style="min-width:1000px">
      <div :style="{ position: 'sticky', top: 0, zIndex: 2, display: 'grid', gridTemplateColumns: GRID, gap: '12px', padding: '8px 20px', background: 'var(--om-surface)', borderBottom: '1px solid var(--om-border)' }">
        <button v-for="c in dp.cols" :key="c.k" @click="c.pick" :style="{ display: 'flex', alignItems: 'center', gap: '3px', justifyContent: c.al, border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: '.62rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px', color: c.fg, textAlign: 'left' }">{{ c.l }}<span :class="'mdi ' + c.arrow"></span></button>
      </div>
      <div v-for="r in dp.rows" :key="r.name" v-hover="'background:var(--om-surface)'" :style="{ display: 'grid', gridTemplateColumns: GRID, gap: '12px', padding: '8px 20px', borderBottom: '1px solid var(--om-border)', alignItems: 'center', fontSize: '.76rem' }">
        <span style="font-family:var(--font-mono);font-weight:500;color:var(--om-text-strong)">{{ r.name }}</span>
        <span style="font-family:var(--font-mono);color:var(--om-text-value)">{{ r.cur }}</span>
        <span style="font-family:var(--font-mono);color:var(--om-text-muted)">{{ r.latest }}</span>
        <span><OmBadge kind="flag" :tone="r.stT">{{ r.stL }}</OmBadge></span>
        <div style="display:flex;align-items:center;gap:8px;min-width:0">
          <template v-if="r.hasV"><OmBadge kind="flag" :tone="r.vT" icon="shield-alert-outline">{{ r.vL }}</OmBadge><span style="font-size:.7rem;color:var(--om-text-value);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ r.vD }}</span></template>
          <span v-if="r.noV" style="font-size:.7rem;color:var(--om-text-placeholder)">None known</span>
        </div>
        <div style="display:flex;flex-direction:column;min-width:0"><span :style="{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: r.licFg }">{{ r.lic }}</span><span style="font-size:.62rem;color:var(--om-warning)">{{ r.licNote }}</span></div>
        <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-value)">{{ r.size }}</span>
        <div style="display:flex;gap:6px;align-items:baseline"><span :style="{ fontFamily: 'var(--font-mono)', fontSize: '.72rem', color: r.relFg }">{{ r.rel }}</span><span style="font-size:.6rem;color:var(--om-warning)">{{ r.relNote }}</span></div>
        <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-muted)">{{ r.used }}</span>
      </div>
      <div v-if="dp.empty" style="padding:40px;text-align:center;font-size:.8rem;color:var(--om-text-muted)">No packages match this filter.</div>
    </div>
  </div>
</template>

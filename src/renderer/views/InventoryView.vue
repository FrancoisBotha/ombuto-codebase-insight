<script setup>
// Size & Inventory screen (prototype lines 708–792; logic in more(), "out.inv").
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import {
  FILES, INVENTORY_LANGS, INVENTORY_LANG_MAX, INVENTORY_FOLDERS, INVENTORY_FOLDER_MAX, INVENTORY_UNITS,
  INVENTORY_COUNTS, INVENTORY_FHIST, INVENTORY_BIG_FILES, INVENTORY_BIG_FNS,
} from '@/data/insightData.js';

const store = useInsightStore();
const S = store.state;

const st = (c, m, b, mx) => ({ cw: (c / mx) * 100 + '%', mw: (m / mx) * 100 + '%', bw: (b / mx) * 100 + '%' });

const langs = INVENTORY_LANGS.map(([l, f, c, m, b, col]) => ({ l, f, c: c.toLocaleString(), col, ...st(c, m, b, INVENTORY_LANG_MAX), cpct: Math.round((m / (c + m)) * 100) + '%' }));
const folders = INVENTORY_FOLDERS.map(([p, f, c, m, b]) => ({ p, f, c: c.toLocaleString(), ...st(c, m, b, INVENTORY_FOLDER_MAX) }));
const counts = INVENTORY_COUNTS.map(([k, v]) => ({ k, v }));
const fhist = INVENTORY_FHIST.map(([l, n]) => ({ l, n, h: (n / 268) * 100 + '%', bg: n < 30 ? 'var(--om-warning)' : 'var(--om-blue)' }));
const bigFiles = INVENTORY_BIG_FILES.map(([p, n]) => ({ p, n: n.toLocaleString(), w: (n / 1840) * 100 + '%', open: () => FILES.find((x) => x.path === p) && store.go('file', { fsel: p }) }));
const bigFns = INVENTORY_BIG_FNS.map(([n, f, l]) => ({ n, f, l, w: (l / 168) * 100 + '%' }));

const inv = computed(() => {
  const ul = S.unitLang || 'ts', U = INVENTORY_UNITS[ul];
  return {
    ltabs: Object.entries(INVENTORY_UNITS).map(([k, x]) => ({
      k, l: x.l,
      fg: k === ul ? 'var(--om-mint)' : x.det ? 'var(--om-text-label)' : 'var(--om-text-placeholder)',
      bd: k === ul ? 'var(--om-mint)' : 'transparent',
      dot: x.det ? 'var(--om-mint)' : 'transparent',
      pick: () => store.setState({ unitLang: k }),
    })),
    units: U.u.map(([k, v]) => ({ k, v: v || '—', fg: v === '0' || !v ? 'var(--om-text-muted)' : 'var(--om-text-strong)' })),
    unot: !U.det,
    ulabel: U.l,
  };
});
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0;flex-wrap:wrap"><div style="display:flex;flex-direction:column;gap:2px;margin-right:auto"><div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Size &amp; Inventory</div><div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">612 files · 48,212 lines of code · tree-sitter, language-aware</div></div></div>
  <div style="flex:1;overflow:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px">
    <div style="flex-shrink:0;background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:14px">
      <div v-for="c in counts" :key="c.k" style="display:flex;flex-direction:column;gap:1px;border-left:1px solid var(--om-border);padding-left:12px;min-width:0"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ c.k }}</span><span style="font-family:var(--font-mono);font-size:1rem;color:var(--om-text-strong)">{{ c.v }}</span></div>
    </div>
    <div style="flex-shrink:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:9px;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Lines by Language</span>
          <div style="display:flex;gap:10px;font-size:.62rem;color:var(--om-text-muted)"><span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--om-blue)"></span>Code</span><span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--om-mint-deep)"></span>Comments</span><span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--om-gray-500)"></span>Blank</span></div></div>
        <div style="display:grid;grid-template-columns:80px minmax(0,1fr) 54px 60px 46px;gap:10px;font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)"><span>Language</span><span></span><span style="text-align:right">Files</span><span style="text-align:right">Code</span><span style="text-align:right">Cmt %</span></div>
        <div v-for="l in langs" :key="l.l" style="display:grid;grid-template-columns:80px minmax(0,1fr) 54px 60px 46px;gap:10px;align-items:center;font-size:.72rem">
          <span style="display:flex;align-items:center;gap:6px;color:var(--om-text-strong)"><span :style="{ width: '6px', height: '6px', borderRadius: '2px', background: l.col }"></span>{{ l.l }}</span>
          <div style="display:flex;height:8px;border-radius:2px;overflow:hidden;background:var(--om-inset)"><span :style="{ width: l.cw, background: 'var(--om-blue)' }"></span><span :style="{ width: l.mw, background: 'var(--om-mint-deep)' }"></span><span :style="{ width: l.bw, background: 'var(--om-gray-500)' }"></span></div>
          <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-muted)">{{ l.f }}</span>
          <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-strong)">{{ l.c }}</span>
          <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-muted)">{{ l.cpct }}</span>
        </div>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;display:flex;flex-direction:column;min-width:0">
        <div style="display:flex;align-items:flex-end;gap:2px;padding:6px 10px 0;border-bottom:1px solid var(--om-border)">
          <button v-for="t in inv.ltabs" :key="t.k" @click="t.pick" :style="{ display: 'flex', alignItems: 'center', gap: '5px', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '.72rem', fontWeight: 500, padding: '7px 8px 6px', cursor: 'pointer', color: t.fg, borderBottom: '2px solid ' + t.bd, marginBottom: '-1px', whiteSpace: 'nowrap' }">{{ t.l }}<span :style="{ width: '5px', height: '5px', borderRadius: '50%', background: t.dot }"></span></button>
        </div>
        <div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Language Units · {{ inv.ulabel }}</span><span v-if="inv.unot" style="font-size:.64rem;color:var(--om-text-muted)">Not detected in this repository</span></div>
          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 12px">
            <div v-for="u in inv.units" :key="u.k" style="display:flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:.6rem;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ u.k }}</span><span :style="{ fontFamily: 'var(--font-mono)', fontSize: '.95rem', color: u.fg }">{{ u.v }}</span></div>
          </div>
          <span style="font-size:.62rem;color:var(--om-text-muted)">Counted from the syntax tree, not by regex. Dots mark languages found in this repo.</span>
        </div>
      </div>
    </div>
    <div style="flex-shrink:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:14px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:10px;min-width:0">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">File Size Distribution</span>
        <div style="display:flex;gap:16px">
          <div style="display:flex;flex-direction:column"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Median</span><span style="font-family:var(--font-mono);font-size:1.05rem;color:var(--om-text-strong)">64</span></div>
          <div style="display:flex;flex-direction:column"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">P90</span><span style="font-family:var(--font-mono);font-size:1.05rem;color:var(--om-text-strong)">312</span></div>
          <div style="display:flex;flex-direction:column"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Max</span><span style="font-family:var(--font-mono);font-size:1.05rem;color:var(--om-warning)">1,840</span></div>
          <div style="display:flex;flex-direction:column;margin-left:auto;text-align:right"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Fn median / P90</span><span style="font-family:var(--font-mono);font-size:1.05rem;color:var(--om-text-strong)">9 / 48</span></div>
        </div>
        <div style="height:80px;display:flex;align-items:flex-end;gap:5px;border-bottom:1px solid var(--om-border)">
          <div v-for="b in fhist" :key="b.l" style="flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px"><span style="font-family:var(--font-mono);font-size:.56rem;color:var(--om-text-value)">{{ b.n }}</span><div :style="{ width: '100%', height: b.h, minHeight: '2px', background: b.bg, borderRadius: '2px 2px 0 0' }"></div></div>
        </div>
        <div style="display:flex;gap:5px"><span v-for="b in fhist" :key="b.l" style="flex:1;text-align:center;font-family:var(--font-mono);font-size:.56rem;color:var(--om-text-muted)">{{ b.l }}</span></div>
        <span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);margin-top:4px">Where size concentrates</span>
        <div style="display:flex;height:14px;border-radius:3px;overflow:hidden;gap:1px"><span title="Top 1% of files" style="width:9%;background:var(--om-danger)"></span><span title="Next 9% of files" style="width:38%;background:var(--om-warning)"></span><span title="Remaining 90%" style="flex:1;background:var(--om-gray-500)"></span></div>
        <span style="font-size:.7rem;color:var(--om-text);line-height:1.45">The largest <b style="font-weight:600">10% of files</b> hold <span style="font-family:var(--font-mono);color:var(--om-text-strong)">47%</span> of the code; the top 6 alone hold 9%.</span>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:7px;min-width:0">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Largest Files</span>
        <div v-for="f in bigFiles" :key="f.p" @click="f.open" style="display:flex;flex-direction:column;gap:3px;cursor:pointer">
          <div style="display:flex;justify-content:space-between;gap:8px;font-family:var(--font-mono);font-size:.7rem"><span style="color:var(--om-text-value);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ f.p }}</span><span style="color:var(--om-text-strong)">{{ f.n }}</span></div>
          <div style="height:4px;border-radius:2px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: f.w, background: 'var(--om-blue)' }"></div></div>
        </div>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:7px;min-width:0">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Largest Functions · Lines</span>
        <div v-for="f in bigFns" :key="f.n" style="display:flex;flex-direction:column;gap:3px">
          <div style="display:flex;justify-content:space-between;gap:8px;font-family:var(--font-mono);font-size:.7rem"><span style="color:var(--om-text-strong);white-space:nowrap">{{ f.n }}() <span style="color:var(--om-text-muted)">{{ f.f }}</span></span><span style="color:var(--om-text-strong)">{{ f.l }}</span></div>
          <div style="height:4px;border-radius:2px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: f.w, background: 'var(--om-warning)' }"></div></div>
        </div>
      </div>
    </div>
    <div style="flex-shrink:0;background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Lines by Folder</span><span style="font-size:.62rem;color:var(--om-text-muted)">code · comments · blank</span></div>
      <div v-for="f in folders" :key="f.p" style="display:grid;grid-template-columns:150px minmax(0,1fr) 54px 70px;gap:12px;align-items:center;padding:5px 16px;border-top:1px solid var(--om-white-04);font-size:.72rem">
        <span style="font-family:var(--font-mono);color:var(--om-text-value)">{{ f.p }}</span>
        <div style="display:flex;height:8px;border-radius:2px;overflow:hidden;background:var(--om-inset)"><span :style="{ width: f.cw, background: 'var(--om-blue)' }"></span><span :style="{ width: f.mw, background: 'var(--om-mint-deep)' }"></span><span :style="{ width: f.bw, background: 'var(--om-gray-500)' }"></span></div>
        <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-muted)">{{ f.f }} files</span>
        <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-strong)">{{ f.c }}</span>
      </div>
    </div>
  </div>
</template>

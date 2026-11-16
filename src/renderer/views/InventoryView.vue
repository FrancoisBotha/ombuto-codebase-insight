<script setup>
// Size & Inventory screen (prototype lines 708–792; logic in more(), "out.inv").
// Data comes from the inventory:summary IPC query over raw_tree_entry/raw_blob
// (FR-007). Anything the parser would provide (functions, classes, types,
// comment/blank splits) shows "Not analysed yet" until epic 2 (FR-010).
import { computed, onMounted, ref } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import { fetchInventory } from '@/data/insightData.js';
import { languageLabel, languageColor } from '../lib/codeLanguage.js';

const NOT_YET = 'Not analysed yet';
const LARGEST_LIMIT = 6;

const store = useInsightStore();
const S = store.state;
const data = ref(null);

onMounted(async () => {
  data.value = await fetchInventory({ largestLimit: LARGEST_LIMIT });
});

const n = (v) => (typeof v === 'number' ? v.toLocaleString() : '—');
const pct = (x) => Math.max(0, Math.min(100, x * 100)) + '%';
const st = (c, mx) => ({ cw: mx > 0 ? pct(c / mx) : '0%', mw: '0%', bw: '0%' });

// Per-language unit labels the parser will count (epic 2). The tab strip is UI
// configuration, not sample data: every value is "—" until then.
const UNIT_LANGS = [
  { k: 'typescript', l: 'TypeScript', ids: ['typescript', 'tsx', 'javascript'], u: ['Exports', 'Interfaces', 'Type aliases', 'Enums', 'Classes', 'Async functions', 'React / Vue components', 'Hooks / composables'] },
  { k: 'sql', l: 'SQL', ids: ['sql'], u: ['Tables', 'Views', 'Indexes', 'Migrations', 'Stored functions'] },
  { k: 'python', l: 'Python', ids: ['python'], u: ['Modules', 'Classes', 'Functions', 'Decorators', 'Async functions'] },
  { k: 'java', l: 'Java / C#', ids: ['java', 'c_sharp'], u: ['Packages / namespaces', 'Classes', 'Interfaces', 'Annotations'] },
  { k: 'go', l: 'Go', ids: ['go'], u: ['Packages', 'Structs', 'Interfaces', 'Goroutine launches'] },
  { k: 'rust', l: 'Rust', ids: ['rust'], u: ['Crates', 'Modules', 'Traits', 'Impl blocks', 'Unsafe blocks'] },
];

const header = computed(() => {
  const t = data.value?.totals;
  if (!t) return 'No analysed repository open';
  const extra = [t.binaryFiles ? n(t.binaryFiles) + ' binary' : '', t.generatedFiles ? n(t.generatedFiles) + ' generated' : ''].filter(Boolean);
  return n(t.files) + ' files · ' + n(t.lines) + ' lines' + (extra.length ? ' · ' + extra.join(', ') : '') + ' · language by extension';
});

const counts = computed(() => {
  const t = data.value?.totals;
  return [
    ['Files', t ? n(t.files) : '—'], ['Lines', t ? n(t.lines) : '—'], ['Comment lines', NOT_YET], ['Blank lines', NOT_YET],
    ['Functions', NOT_YET], ['Classes', NOT_YET], ['Methods', NOT_YET], ['Types', NOT_YET],
  ].map(([k, v]) => ({ k, v, ph: v === NOT_YET }));
});

const langs = computed(() => {
  const rows = data.value?.languages || [];
  const mx = rows.reduce((m, r) => Math.max(m, r.lines), 0);
  return rows.map((r, i) => ({ id: r.language ?? 'other', l: languageLabel(r.language), f: n(r.files), c: n(r.lines), col: languageColor(r.language, i), ...st(r.lines, mx), cpct: '—' }));
});

const detected = computed(() => new Set((data.value?.languages || []).map((r) => r.language)));

const inv = computed(() => {
  const det = (x) => x.ids.some((id) => detected.value.has(id));
  const ul = S.unitLang || (UNIT_LANGS.find(det) || UNIT_LANGS[0]).k;
  const U = UNIT_LANGS.find((x) => x.k === ul) || UNIT_LANGS[0];
  return {
    ltabs: UNIT_LANGS.map((x) => ({
      k: x.k, l: x.l,
      fg: x.k === U.k ? 'var(--om-mint)' : det(x) ? 'var(--om-text-label)' : 'var(--om-text-placeholder)',
      bd: x.k === U.k ? 'var(--om-mint)' : 'transparent',
      dot: det(x) ? 'var(--om-mint)' : 'transparent',
      pick: () => store.setState({ unitLang: x.k }),
    })),
    units: U.u.map((k) => ({ k, v: '—', fg: 'var(--om-text-muted)' })),
    unot: true,
    ulabel: U.l,
  };
});

const dist = computed(() => {
  const d = data.value?.sizeDistribution;
  const hist = d?.histogram || [];
  const mx = hist.reduce((m, b) => Math.max(m, b.files), 0);
  const c = d?.concentration;
  const topPct = c ? Math.round(c.topShare * 100) : 0;
  return {
    median: d ? n(d.median) : '—', p90: d ? n(d.p90) : '—', max: d ? n(d.max) : '—',
    fhist: hist.map((b) => ({ l: b.label, n: b.files, h: mx > 0 ? pct(b.files / mx) : '0%', bg: b.min >= 400 ? 'var(--om-warning)' : 'var(--om-blue)' })),
    topW: pct(c?.topShare || 0), topPct: topPct + '%', topFiles: c ? n(c.topFiles) : '—', half: c ? n(c.filesForHalf) : '—',
    has: !!d && d.files > 0,
  };
});

const bigFiles = computed(() => {
  const rows = data.value?.largestFiles || [];
  const mx = rows[0]?.lines || 0;
  return rows.map((f) => ({ p: f.path, n: n(f.lines), w: mx > 0 ? pct(f.lines / mx) : '0%', open: () => store.go('file', { fsel: f.path }) }));
});

const folders = computed(() => {
  const rows = data.value?.folders || [];
  const mx = rows.reduce((m, r) => Math.max(m, r.lines), 0);
  return rows.map((r) => ({ p: r.folder, f: n(r.files), c: n(r.lines), ...st(r.lines, mx) }));
});
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0;flex-wrap:wrap"><div style="display:flex;flex-direction:column;gap:2px;margin-right:auto"><div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Size &amp; Inventory</div><div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">{{ header }}</div></div></div>
  <div style="flex:1;overflow:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px">
    <div style="flex-shrink:0;background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px;display:grid;grid-template-columns:repeat(8,minmax(0,1fr));gap:14px">
      <div v-for="c in counts" :key="c.k" style="display:flex;flex-direction:column;gap:1px;border-left:1px solid var(--om-border);padding-left:12px;min-width:0"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ c.k }}</span><span :style="{ fontFamily: 'var(--font-mono)', fontSize: c.ph ? '.68rem' : '1rem', lineHeight: c.ph ? '1.5rem' : 'normal', color: c.ph ? 'var(--om-text-muted)' : 'var(--om-text-strong)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }">{{ c.v }}</span></div>
    </div>
    <div style="flex-shrink:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:14px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:9px;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Lines by Language</span>
          <div style="display:flex;gap:10px;font-size:.62rem;color:var(--om-text-muted)"><span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--om-blue)"></span>Code</span><span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--om-mint-deep)"></span>Comments</span><span style="display:flex;align-items:center;gap:4px"><span style="width:8px;height:8px;border-radius:2px;background:var(--om-gray-500)"></span>Blank</span></div></div>
        <div style="display:grid;grid-template-columns:80px minmax(0,1fr) 54px 60px 46px;gap:10px;font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)"><span>Language</span><span></span><span style="text-align:right">Files</span><span style="text-align:right">Lines</span><span style="text-align:right">Cmt %</span></div>
        <div v-for="l in langs" :key="l.id" style="display:grid;grid-template-columns:80px minmax(0,1fr) 54px 60px 46px;gap:10px;align-items:center;font-size:.72rem">
          <span style="display:flex;align-items:center;gap:6px;color:var(--om-text-strong);min-width:0"><span :style="{ width: '6px', height: '6px', borderRadius: '2px', background: l.col, flexShrink: 0 }"></span><span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ l.l }}</span></span>
          <div style="display:flex;height:8px;border-radius:2px;overflow:hidden;background:var(--om-inset)"><span :style="{ width: l.cw, background: 'var(--om-blue)' }"></span><span :style="{ width: l.mw, background: 'var(--om-mint-deep)' }"></span><span :style="{ width: l.bw, background: 'var(--om-gray-500)' }"></span></div>
          <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-muted)">{{ l.f }}</span>
          <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-strong)">{{ l.c }}</span>
          <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-muted)">{{ l.cpct }}</span>
        </div>
        <div v-if="langs.length === 0" style="padding:12px 0;font-size:.74rem;color:var(--om-text-muted);text-align:center">No files extracted yet.</div>
        <span style="font-size:.62rem;color:var(--om-text-muted)">Comment and blank line splits: {{ NOT_YET.toLowerCase() }}.</span>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;display:flex;flex-direction:column;min-width:0">
        <div style="display:flex;align-items:flex-end;gap:2px;padding:6px 10px 0;border-bottom:1px solid var(--om-border)">
          <button v-for="t in inv.ltabs" :key="t.k" @click="t.pick" :style="{ display: 'flex', alignItems: 'center', gap: '5px', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '.72rem', fontWeight: 500, padding: '7px 8px 6px', cursor: 'pointer', color: t.fg, borderBottom: '2px solid ' + t.bd, marginBottom: '-1px', whiteSpace: 'nowrap' }">{{ t.l }}<span :style="{ width: '5px', height: '5px', borderRadius: '50%', background: t.dot }"></span></button>
        </div>
        <div style="padding:12px 16px;display:flex;flex-direction:column;gap:10px">
          <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Language Units · {{ inv.ulabel }}</span><span v-if="inv.unot" style="font-size:.64rem;color:var(--om-text-muted)">{{ NOT_YET }}</span></div>
          <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px 12px">
            <div v-for="u in inv.units" :key="u.k" style="display:flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:.6rem;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ u.k }}</span><span :style="{ fontFamily: 'var(--font-mono)', fontSize: '.95rem', color: u.fg }">{{ u.v }}</span></div>
          </div>
          <span style="font-size:.62rem;color:var(--om-text-muted)">Counted from the syntax tree once code analysis runs. Dots mark languages found in this repo.</span>
        </div>
      </div>
    </div>
    <div style="flex-shrink:0;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,1fr);gap:14px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:10px;min-width:0">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">File Size Distribution</span>
        <div style="display:flex;gap:16px">
          <div style="display:flex;flex-direction:column"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Median</span><span style="font-family:var(--font-mono);font-size:1.05rem;color:var(--om-text-strong)">{{ dist.median }}</span></div>
          <div style="display:flex;flex-direction:column"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">P90</span><span style="font-family:var(--font-mono);font-size:1.05rem;color:var(--om-text-strong)">{{ dist.p90 }}</span></div>
          <div style="display:flex;flex-direction:column"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Max</span><span style="font-family:var(--font-mono);font-size:1.05rem;color:var(--om-warning)">{{ dist.max }}</span></div>
          <div style="display:flex;flex-direction:column;margin-left:auto;text-align:right"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Fn median / P90</span><span style="font-family:var(--font-mono);font-size:.68rem;line-height:1.6rem;color:var(--om-text-muted)">{{ NOT_YET }}</span></div>
        </div>
        <div style="height:80px;display:flex;align-items:flex-end;gap:5px;border-bottom:1px solid var(--om-border)">
          <div v-for="b in dist.fhist" :key="b.l" style="flex:1;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:2px"><span style="font-family:var(--font-mono);font-size:.56rem;color:var(--om-text-value)">{{ b.n }}</span><div :style="{ width: '100%', height: b.h, minHeight: '2px', background: b.bg, borderRadius: '2px 2px 0 0' }"></div></div>
        </div>
        <div style="display:flex;gap:5px"><span v-for="b in dist.fhist" :key="b.l" style="flex:1;text-align:center;font-family:var(--font-mono);font-size:.56rem;color:var(--om-text-muted)">{{ b.l }}</span></div>
        <span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);margin-top:4px">Where size concentrates</span>
        <div style="display:flex;height:14px;border-radius:3px;overflow:hidden;gap:1px"><span title="Largest 10% of files" :style="{ width: dist.topW, background: 'var(--om-danger)' }"></span><span title="Remaining 90%" style="flex:1;background:var(--om-gray-500)"></span></div>
        <span v-if="dist.has" style="font-size:.7rem;color:var(--om-text);line-height:1.45">The largest <b style="font-weight:600">10% of files</b> ({{ dist.topFiles }}) hold <span style="font-family:var(--font-mono);color:var(--om-text-strong)">{{ dist.topPct }}</span> of the lines; the {{ dist.half }} largest alone hold half.</span>
        <span v-else style="font-size:.7rem;color:var(--om-text-muted);line-height:1.45">No source files extracted yet.</span>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:7px;min-width:0">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Largest Files</span>
        <div v-for="f in bigFiles" :key="f.p" @click="f.open" :title="f.p" style="display:flex;flex-direction:column;gap:3px;cursor:pointer">
          <div style="display:flex;justify-content:space-between;gap:8px;font-family:var(--font-mono);font-size:.7rem"><span style="color:var(--om-text-value);overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ f.p }}</span><span style="color:var(--om-text-strong)">{{ f.n }}</span></div>
          <div style="height:4px;border-radius:2px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: f.w, background: 'var(--om-blue)' }"></div></div>
        </div>
        <div v-if="bigFiles.length === 0" style="padding:12px 0;font-size:.74rem;color:var(--om-text-muted);text-align:center">No source files extracted yet.</div>
      </div>
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:7px;min-width:0">
        <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Largest Functions · Lines</span>
        <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;padding:16px 8px;text-align:center">
          <span style="font-size:.8rem;color:var(--om-text-strong)">{{ NOT_YET }}</span>
          <span style="font-size:.68rem;color:var(--om-text-muted);line-height:1.45">Function sizes come from the syntax tree once code analysis runs.</span>
        </div>
      </div>
    </div>
    <div style="flex-shrink:0;background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Lines by Folder</span><span style="font-size:.62rem;color:var(--om-text-muted)">lines · comments and blanks {{ NOT_YET.toLowerCase() }}</span></div>
      <div v-for="f in folders" :key="f.p" style="display:grid;grid-template-columns:150px minmax(0,1fr) 54px 70px;gap:12px;align-items:center;padding:5px 16px;border-top:1px solid var(--om-white-04);font-size:.72rem">
        <span style="font-family:var(--font-mono);color:var(--om-text-value);overflow:hidden;text-overflow:ellipsis;white-space:nowrap" :title="f.p">{{ f.p }}</span>
        <div style="display:flex;height:8px;border-radius:2px;overflow:hidden;background:var(--om-inset)"><span :style="{ width: f.cw, background: 'var(--om-blue)' }"></span><span :style="{ width: f.mw, background: 'var(--om-mint-deep)' }"></span><span :style="{ width: f.bw, background: 'var(--om-gray-500)' }"></span></div>
        <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-muted)">{{ f.f }} files</span>
        <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-strong)">{{ f.c }}</span>
      </div>
      <div v-if="folders.length === 0" style="padding:12px 16px;border-top:1px solid var(--om-white-04);font-size:.74rem;color:var(--om-text-muted);text-align:center">No source files extracted yet.</div>
    </div>
  </div>
</template>

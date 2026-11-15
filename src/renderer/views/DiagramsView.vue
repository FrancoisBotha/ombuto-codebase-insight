<script setup>
// Diagrams screen (prototype lines 1065–1158; logic in more() "// diagrams").
// Export items only show a toast, as in the prototype.
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import { DIAGRAMS, BOXES, SEQS } from '@/data/insightData.js';
import { tabs } from '../lib/viewHelpers.js';
import OmButton from '../components/ds/OmButton.vue';

const store = useInsightStore();
const S = store.state;

const dg = computed(() => {
  const D = DIAGRAMS.find((d) => d.id === S.diagram) || DIAGRAMS[0];
  const dg = { isBoxes: D.r === 'boxes', isSeq: D.r === 'seq', title: D.title, type: D.type, src: D.src, meta: D.meta, isAi: D.kind === 'ai' };
  let mm = [];
  if (D.r === 'boxes') {
    const B = BOXES[D.id], W = B.w, find = (id) => B.boxes.find((b) => b.id === id), ry = (b, i) => b.y + 30 + i * 24 + 12;
    dg.boxes = B.boxes.map((b) => ({
      title: b.id, l: b.x + 'px', t: b.y + 'px', w: W + 'px',
      rows: b.rows.map(([n, ty, k]) => ({ n, ty, k, kFg: k === 'PK' ? 'var(--om-warning)' : k === 'FK' ? 'var(--om-blue)' : 'var(--om-text-muted)' })),
    }));
    dg.links = B.links.map(([fa, fi, ta, ti], i) => {
      const A = find(fa), T = find(ta);
      const y1 = ry(A, fi), y2 = ry(T, ti);
      let x1, x2, d;
      if (A.x === T.x) { x1 = A.x; x2 = T.x; d = `M${x1} ${y1}H${x1 - 26}V${y2}H${x2}`; }
      else { x1 = A.x > T.x ? A.x : A.x + W; x2 = A.x > T.x ? T.x + W : T.x; const mx = (x1 + x2) / 2; d = `M${x1} ${y1}H${mx}V${y2}H${x2}`; }
      return { key: i, d, x1, y1, x2, y2 };
    });
    if (D.id === 'erd') {
      mm = ['erDiagram', ...B.links.map(([a, , b]) => `  ${b.toUpperCase()} ||--o{ ${a.toUpperCase()} : ""`)];
      B.boxes.forEach((b) => { mm.push(`  ${b.id.toUpperCase()} {`); b.rows.forEach(([n, t, k]) => mm.push(`    ${t} ${n}${k ? ' ' + k : ''}`)); mm.push('  }'); });
    } else if (D.id === 'class') {
      mm = ['classDiagram'];
      B.boxes.forEach((b) => { mm.push(`  class ${b.id} {`); b.rows.forEach(([n, t, k]) => mm.push(`    ${k}${n} ${t}`)); mm.push('  }'); });
      B.links.forEach(([a, , b]) => mm.push(`  ${a} --> ${b}`));
    } else {
      mm = ['flowchart LR', ...B.links.map(([a, , b]) => `  ${a} --> ${b}`)];
    }
  } else {
    const Q = SEQS[D.id], np = Q.parts.length, px = (i) => 100 + i * (800 / (np - 1));
    dg.parts = Q.parts.map((p, i) => ({ p, l: px(i) + 'px' }));
    dg.seqH = 90 + Q.msgs.length * 42 + 'px';
    dg.msgs = Q.msgs.map(([a, b, label, ret], k) => {
      const y = 86 + k * 42, self = a === b;
      const x1 = px(a), x2 = px(b);
      return { label, self, line: !self, right: x2 > x1, left: x2 < x1, l: Math.min(x1, x2) + 'px', w: Math.abs(x2 - x1) + 'px', t: y + 'px', bs: ret ? 'dashed' : 'solid', sl: x1 + 'px', n: k + 1 };
    });
    const id = (p) => p.replace(/[^\w]/g, '_');
    mm = ['sequenceDiagram', ...Q.parts.map((p) => '  participant ' + id(p)), ...Q.msgs.map(([a, b, l, ret]) => `  ${id(Q.parts[a])}${ret ? '-->>' : '->>'}${id(Q.parts[b])}: ${l}`)];
  }
  dg.mermaid = mm.join('\n');
  const dfname = D.title.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  return {
    ...dg,
    gallery: DIAGRAMS.map((d) => ({
      ...d,
      bd: d.id === D.id ? 'var(--om-mint)' : 'var(--om-border)',
      bg: d.id === D.id ? 'var(--om-card-raised)' : 'var(--om-card)',
      kl: d.kind === 'ai' ? 'AI-assisted' : 'Computed',
      kfg: d.kind === 'ai' ? 'var(--ai)' : 'var(--om-text-muted)',
      ki: d.kind === 'ai' ? 'mdi-creation' : 'mdi-function-variant',
      pick: () => store.setState({ diagram: d.id, exportOpen: false }),
    })),
    vtabs: tabs([['canvas', 'Canvas'], ['source', 'Mermaid Source']], S.dtab, 'dtab', store.setState),
    isCanvas: S.dtab === 'canvas',
    isSource: S.dtab === 'source',
    exportOpen: S.exportOpen,
    exports: [['Mermaid', '.mmd', '⌘⇧M', 'language-markdown-outline'], ['PlantUML', '.puml', '', 'leaf'], ['SVG', '.svg', '⌘⇧S', 'svg'], ['PNG · 2×', '.png', '⌘⇧P', 'file-image-outline'], ['Copy Mermaid', '', '⌘C', 'content-copy']].map(([l, ext, k, ic]) => ({
      l, ext, k, ic,
      run: () => store.toast(ext ? 'Saved ' + dfname + ext + ' to ~/Downloads' : 'Mermaid source copied to clipboard'),
    })),
  };
});

const toggleExport = () => store.setState((s) => ({ exportOpen: !s.exportOpen }));
const closeExport = () => S.exportOpen && store.setState({ exportOpen: false });
const svgStyle = { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' };
</script>

<template>
  <div style="flex:1;min-height:0;display:flex">
    <div style="width:260px;flex-shrink:0;border-right:1px solid var(--om-border);background:var(--om-surface);display:flex;flex-direction:column;min-height:0">
      <div style="padding:12px 14px;border-bottom:1px solid var(--om-border);display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Diagrams</span>
        <button class="om-ghost-icon" title="Generate diagram" style="color:var(--om-text-muted)"><span class="mdi mdi-plus"></span></button>
      </div>
      <div style="flex:1;overflow:auto;padding:10px;display:flex;flex-direction:column;gap:8px">
        <div v-for="g in dg.gallery" :key="g.id" @click="g.pick" v-hover="'border-color:var(--om-border-hover)'" :style="{ border: '1px solid ' + g.bd, background: g.bg, borderRadius: '6px', padding: '10px', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '8px', transition: 'border-color .15s' }">
          <div style="height:54px;border-radius:4px;background:var(--om-inset);display:flex;align-items:center;justify-content:center"><span :class="'mdi mdi-' + g.icon" style="font-size:1.4rem;color:var(--om-text-muted)"></span></div>
          <div style="display:flex;flex-direction:column;gap:2px">
            <span style="font-size:.8rem;font-weight:600;color:var(--om-text-strong)">{{ g.title }}</span>
            <div style="display:flex;justify-content:space-between;font-size:.64rem;color:var(--om-text-muted)"><span>{{ g.type }}</span><span :style="{ display: 'flex', alignItems: 'center', gap: '3px', color: g.kfg }"><span :class="'mdi ' + g.ki"></span>{{ g.kl }}</span></div>
          </div>
        </div>
      </div>
    </div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;min-height:0">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 16px;border-bottom:1px solid var(--om-border);flex-wrap:wrap">
        <div style="display:flex;flex-direction:column;gap:2px;margin-right:auto;min-width:0">
          <div style="display:flex;align-items:center;gap:8px"><span style="font-size:.95rem;font-weight:600;color:var(--om-text-strong)">{{ dg.title }}</span><span style="font-size:.66rem;padding:0 7px;border-radius:999px;background:var(--om-tone-neutral-bg);color:var(--om-tone-neutral-fg)">{{ dg.type }}</span></div>
          <span style="font-family:var(--font-mono);font-size:.68rem;color:var(--om-text-muted)">{{ dg.meta }} · from {{ dg.src }}</span>
        </div>
        <div style="display:flex;gap:2px;padding:2px;border-radius:6px;background:var(--om-inset);border:1px solid var(--om-border)">
          <button v-for="m in dg.vtabs" :key="m.id" @click="m.pick" :style="{ border: 'none', fontFamily: 'inherit', fontSize: '.72rem', fontWeight: 500, padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', background: m.bg, color: m.fg }">{{ m.label }}</button>
        </div>
        <div style="position:relative">
          <OmButton variant="primary" icon="tray-arrow-down" @click="toggleExport">Export</OmButton>
          <div v-if="dg.exportOpen" style="position:absolute;right:0;top:calc(100% + 4px);width:250px;background:var(--om-dialog);border:1px solid var(--om-border);border-radius:6px;box-shadow:0 4px 20px rgba(0,0,0,.5);padding:4px;z-index:50">
            <div v-for="x in dg.exports" :key="x.l" @click="x.run" v-hover="'background:var(--om-gray-700)'" style="display:flex;align-items:center;gap:10px;padding:7px 10px;border-radius:4px;cursor:pointer;font-size:.78rem;color:var(--om-text)">
              <span :class="'mdi mdi-' + x.ic" style="color:var(--om-text-muted)"></span><span style="flex:1">{{ x.l }} <span style="font-family:var(--font-mono);font-size:.66rem;color:var(--om-text-muted)">{{ x.ext }}</span></span><span style="font-family:var(--font-mono);font-size:.64rem;color:var(--om-text-muted)">{{ x.k }}</span>
            </div>
          </div>
        </div>
      </div>
      <div v-if="dg.isAi" style="display:flex;align-items:center;gap:8px;padding:6px 16px;font-size:.7rem;color:var(--ai);background:var(--ai-bg);border-bottom:1px dashed var(--ai-line)"><span class="mdi mdi-creation"></span>Structure traced from code; labels and grouping written by llama3.1:8b. Check against source before sharing.</div>
      <div @click="closeExport" style="flex:1;min-height:0;overflow:auto;background:var(--om-inset);position:relative">
        <template v-if="dg.isCanvas">
          <div v-if="dg.isBoxes" style="position:relative;width:1000px;height:500px;margin:24px auto">
            <svg width="1000" height="500" :style="svgStyle">
              <g v-for="k in dg.links" :key="k.key">
                <path :d="k.d" style="fill:none;stroke:var(--om-gray-300);stroke-width:1.3" />
                <circle :cx="k.x2" :cy="k.y2" r="3.5" style="fill:var(--om-gray-300)" />
                <circle :cx="k.x1" :cy="k.y1" r="3.5" style="fill:var(--om-card);stroke:var(--om-gray-300);stroke-width:1.3" />
              </g>
            </svg>
            <div v-for="b in dg.boxes" :key="b.title" :style="{ position: 'absolute', left: b.l, top: b.t, width: b.w, background: 'var(--om-card)', border: '1px solid var(--om-border)', borderRadius: '6px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,.4)' }">
              <div style="height:30px;display:flex;align-items:center;gap:6px;padding:0 10px;background:var(--om-card-raised);border-bottom:1px solid var(--om-border);font-family:var(--font-mono);font-size:.76rem;font-weight:600;color:var(--om-text-strong)">{{ b.title }}</div>
              <div v-for="(r, i) in b.rows" :key="i" style="height:24px;display:grid;grid-template-columns:26px minmax(0,1fr) auto;align-items:center;gap:4px;padding:0 10px 0 6px;font-family:var(--font-mono);font-size:.68rem;border-top:1px solid var(--om-white-04)">
                <span :style="{ fontSize: '.56rem', fontWeight: 700, color: r.kFg }">{{ r.k }}</span>
                <span style="color:var(--om-text-value);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ r.n }}</span>
                <span style="color:var(--om-text-muted)">{{ r.ty }}</span>
              </div>
            </div>
          </div>
          <div v-if="dg.isSeq" :style="{ position: 'relative', width: '1000px', height: dg.seqH, margin: '24px auto' }">
            <template v-for="p in dg.parts" :key="p.p">
              <div :style="{ position: 'absolute', left: p.l, top: 0, bottom: 0, width: 0, borderLeft: '1px dashed var(--om-gray-500)' }"></div>
              <div :style="{ position: 'absolute', left: p.l, top: 0, transform: 'translateX(-50%)', minWidth: '120px', padding: '7px 12px', background: 'var(--om-card)', border: '1px solid var(--om-border)', borderRadius: '6px', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '.74rem', fontWeight: 500, color: 'var(--om-text-strong)', whiteSpace: 'nowrap' }">{{ p.p }}</div>
            </template>
            <template v-for="m in dg.msgs" :key="m.n">
              <div v-if="m.line" :style="{ position: 'absolute', left: m.l, top: m.t, width: m.w, borderTop: '1.5px ' + m.bs + ' var(--om-text-label)' }">
                <div style="position:absolute;left:0;right:0;bottom:3px;text-align:center;font-family:var(--font-mono);font-size:.66rem;color:var(--om-text-value);white-space:nowrap"><span style="color:var(--om-text-placeholder)">{{ m.n }}.</span> {{ m.label }}</div>
                <span v-if="m.right" class="mdi mdi-menu-right" style="position:absolute;right:-9px;top:-10px;font-size:1.1rem;color:var(--om-text-label)"></span>
                <span v-if="m.left" class="mdi mdi-menu-left" style="position:absolute;left:-9px;top:-10px;font-size:1.1rem;color:var(--om-text-label)"></span>
              </div>
              <template v-if="m.self">
                <div :style="{ position: 'absolute', left: m.sl, top: m.t, width: '34px', height: '16px', marginTop: '-8px', border: '1.5px solid var(--om-text-label)', borderLeft: 'none', borderRadius: '0 4px 4px 0' }"></div>
                <div :style="{ position: 'absolute', left: m.sl, top: m.t, margin: '-8px 0 0 42px', fontFamily: 'var(--font-mono)', fontSize: '.66rem', color: 'var(--om-text-value)', whiteSpace: 'nowrap' }"><span style="color:var(--om-text-placeholder)">{{ m.n }}.</span> {{ m.label }}</div>
              </template>
            </template>
          </div>
        </template>
        <div v-if="dg.isSource" style="padding:20px;display:flex;justify-content:center">
          <pre style="margin:0;width:100%;max-width:760px;padding:16px 18px;background:var(--om-terminal);border:1px solid var(--om-border);border-radius:6px;font-family:var(--font-mono);font-size:.74rem;line-height:1.65;color:var(--om-text-value);white-space:pre;overflow:auto">{{ dg.mermaid }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

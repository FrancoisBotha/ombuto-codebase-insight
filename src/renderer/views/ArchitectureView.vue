<script setup>
// Architecture screen (prototype lines 940–1063; logic in more() "// architecture").
// Module positions are the prototype's fixed sample coordinates (elkjs layout
// arrives with real module graphs). See docs/Architecture/prototype-port.md.
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import { MODS, EDGES, CLUSTERS, MODSUM, CLS, C4, C4E } from '@/data/insightData.js';
import { seg, tabs } from '../lib/viewHelpers.js';
import OmBadge from '../components/ds/OmBadge.vue';

const store = useInsightStore();
const S = store.state;

const pos = Object.fromEntries(MODS.map((m) => [m.id, m]));
const isCyc = ([a, b]) => EDGES.some(([c, d]) => c === b && d === a);
const cyc = new Set(EDGES.filter(isCyc).flat());
const fan = (id) => ({ i: EDGES.filter((e) => e[1] === id).length, o: EDGES.filter((e) => e[0] === id).length });
const c4p = Object.fromEntries(C4.map((c) => [c.id, c]));
const KS = { person: ['var(--om-tone-blue-bg)', '999px'], sys: ['var(--om-tone-eval-bg)', '8px'], db: ['var(--om-card-raised)', '8px'], ext: ['var(--om-tone-neutral-bg)', '8px'], 'ext-sys': ['var(--om-tone-neutral-bg)', '8px'] };
const markers = [['ar', 'var(--om-gray-400)'], ['arc', 'var(--om-danger)'], ['arm', 'var(--om-mint)']];

const ar = computed(() => {
  const vis = MODS.filter((m) => !(S.hideShared && m.c === 'shared'));
  const vids = new Set(vis.map((m) => m.id));
  const E = EDGES.filter(([a, b]) => vids.has(a) && vids.has(b));
  const edges = E.map(([a, b], i) => {
    const c = S.cycles && isCyc([a, b]);
    const touch = a === S.node || b === S.node;
    const L = seg(pos[a], pos[b], 62, 24, isCyc([a, b]) ? 5 : 0);
    const col = touch ? 'var(--om-mint)' : c ? 'var(--om-danger)' : 'var(--om-gray-500)';
    return {
      key: i, ...L,
      markerEnd: 'url(#' + (touch ? 'arm' : c ? 'arc' : 'ar') + ')',
      style: { stroke: col, strokeWidth: touch || c ? 1.6 : 1, strokeDasharray: c && !touch ? '5 4' : undefined, opacity: !touch && !c ? 0.55 : 1 },
    };
  });
  const nd = pos[S.node] || pos.billing;
  const fn = fan(nd.id);
  const c4edges = C4E.map(([a, b, l, tech], i) => {
    const pair = (a === 'api' && b === 'stripe') || (a === 'stripe' && b === 'api');
    const L = seg(c4p[a], c4p[b], 96, 42, pair ? 8 : 0);
    const mx = (L.x1 + L.x2) / 2, my = (L.y1 + L.y2) / 2;
    return { key: i, L, tx: mx, ty: my + (pair && a === 'stripe' ? 14 : -6), text: l + (tech ? ' [' + tech + ']' : '') };
  });
  const c4s = c4p[S.c4sel] || c4p.api;
  return {
    isModule: S.arch === 'module',
    isC4: S.arch === 'c4',
    viewTabs: tabs([['module', 'Module Graph'], ['c4', 'C4 · Containers']], S.arch, 'arch', store.setState),
    chips: [['cycles', 'Highlight cycles', 'sync'], ['clusters', 'Cluster by folder', 'select-group'], ['hideShared', 'Hide shared/', 'eye-off-outline']].map(([k, l, ic]) => ({
      key: k, label: l, icon: ic,
      bg: S[k] ? 'var(--om-mint-tint-strong)' : 'transparent',
      fg: S[k] ? 'var(--om-mint)' : 'var(--om-text-muted)',
      bd: S[k] ? 'rgba(109,212,160,.35)' : 'var(--om-border)',
      pick: () => store.setState((s) => ({ [k]: !s[k] })),
    })),
    zoomPct: Math.round(S.zoom * 100) + '%',
    xf: 'translate(-50%,-50%) scale(' + S.zoom + ')',
    edges,
    c4edges,
    clusters: S.clusters
      ? CLUSTERS.filter((c) => !(S.hideShared && c.id === 'shared')).map((c) => ({ label: c.id + '/', l: c.x + 'px', t: c.y + 'px', w: c.w + 'px', h: c.h + 'px' }))
      : [],
    nodes: vis.map((m) => {
      const sel = m.id === S.node, c = S.cycles && cyc.has(m.id);
      return {
        id: m.id, l: m.x + 'px', t: m.y + 'px', meta: m.files + ' files · ' + m.loc,
        bd: sel ? 'var(--om-mint)' : c ? 'var(--om-tone-red-border)' : 'var(--om-border)',
        bg: sel ? 'var(--om-card-raised)' : 'var(--om-card)',
        dot: c ? 'var(--om-danger)' : 'var(--om-gray-500)',
        pick: () => store.setState({ node: m.id }),
      };
    }),
    n: {
      id: nd.id,
      path: 'src/' + (nd.c === 'domain' ? '' : nd.c + '/') + nd.id + '/',
      inCycle: cyc.has(nd.id),
      cycleWith: EDGES.filter((e) => e[0] === nd.id && isCyc(e)).map((e) => e[1]).join(', '),
      summary: MODSUM[nd.id] || nd.id + ' groups ' + nd.files + ' file' + (nd.files > 1 ? 's' : '') + ' in the ' + nd.c + ' layer. Mostly internal helpers with few direct callers outside it.',
      stats: [['Files', nd.files], ['Lines', nd.loc], ['Fan-in', fn.i], ['Fan-out', fn.o], ['Instability', (fn.o / Math.max(1, fn.i + fn.o)).toFixed(2)], ['Layer', nd.c]].map(([k, v]) => ({ k, v })),
      imports: EDGES.filter((e) => e[0] === nd.id).map((e) => ({ id: e[1], cyc: isCyc(e), pick: () => store.setState({ node: e[1] }) })),
      importers: EDGES.filter((e) => e[1] === nd.id).map((e) => ({ id: e[0], cyc: isCyc(e), pick: () => store.setState({ node: e[0] }) })),
      classes: (CLS[nd.id] || []).map(([n, dit, noc, lcom]) => ({ n, dit, noc, lcom: lcom.toFixed(2), lw: lcom * 100 + '%', lfg: lcom > 0.6 ? 'var(--om-warning)' : 'var(--om-teal)' })),
      noClasses: !CLS[nd.id],
    },
    c4: C4.map((c) => {
      const sel = c.id === S.c4sel, ext = c.kind.startsWith('ext');
      return {
        ...c, l: c.x + 'px', tp: c.y + 'px', bg: KS[c.kind][0], rad: KS[c.kind][1],
        bd: sel ? 'var(--om-mint)' : ext ? 'var(--om-gray-400)' : 'var(--om-blue)',
        bs: ext ? 'dashed' : 'solid',
        pick: () => store.setState({ c4sel: c.id }),
      };
    }),
    c: {
      t: c4s.t, s: c4s.s, d: c4s.d,
      rels: C4E.filter((e) => e[0] === c4s.id || e[1] === c4s.id).map(([a, b, l, tech]) => ({ dir: a === c4s.id ? '→' : '←', other: c4p[a === c4s.id ? b : a].t, l: l + (tech ? ' · ' + tech : '') })),
    },
  };
});

const zin = () => store.setState((s) => ({ zoom: Math.min(1.6, +(s.zoom + 0.1).toFixed(2)) }));
const zout = () => store.setState((s) => ({ zoom: Math.max(0.4, +(s.zoom - 0.1).toFixed(2)) }));
const fit = () => store.setState({ zoom: 0.8 });
const svgStyle = { position: 'absolute', left: 0, top: 0, overflow: 'visible', pointerEvents: 'none' };
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0;flex-wrap:wrap">
    <div style="display:flex;flex-direction:column;gap:2px;margin-right:auto">
      <div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Architecture</div>
      <div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">14 modules · 26 import edges · 3 cycles</div>
    </div>
    <div style="display:flex;gap:2px;padding:2px;border-radius:6px;background:var(--om-inset);border:1px solid var(--om-border)">
      <button v-for="m in ar.viewTabs" :key="m.id" @click="m.pick" :style="{ border: 'none', fontFamily: 'inherit', fontSize: '.74rem', fontWeight: 500, padding: '5px 12px', borderRadius: '4px', cursor: 'pointer', background: m.bg, color: m.fg, whiteSpace: 'nowrap' }">{{ m.label }}</button>
    </div>
  </div>
  <div style="flex:1;min-height:0;display:flex">
    <div style="flex:1;min-width:0;position:relative;overflow:hidden;background:var(--om-inset)">
      <div style="position:absolute;left:12px;top:12px;z-index:5;display:flex;gap:6px;flex-wrap:wrap">
        <template v-if="ar.isModule">
          <button v-for="c in ar.chips" :key="c.key" @click="c.pick" :style="{ display: 'flex', alignItems: 'center', gap: '5px', fontFamily: 'inherit', fontSize: '.7rem', fontWeight: 500, padding: '4px 10px', borderRadius: '999px', cursor: 'pointer', background: c.bg, color: c.fg, border: '1px solid ' + c.bd }"><span :class="'mdi mdi-' + c.icon"></span>{{ c.label }}</button>
        </template>
      </div>
      <div style="position:absolute;right:12px;top:12px;z-index:5;display:flex;align-items:center;gap:2px;background:var(--om-card);border:1px solid var(--om-border);border-radius:6px;padding:2px">
        <button class="om-ghost-icon" @click="zout" title="Zoom out  −" style="color:var(--om-text-muted)"><span class="mdi mdi-minus"></span></button>
        <span style="font-family:var(--font-mono);font-size:.68rem;color:var(--om-text-value);width:38px;text-align:center">{{ ar.zoomPct }}</span>
        <button class="om-ghost-icon" @click="zin" title="Zoom in  +" style="color:var(--om-text-muted)"><span class="mdi mdi-plus"></span></button>
        <button class="om-ghost-icon" @click="fit" title="Fit  ⌘0" style="color:var(--om-text-muted)"><span class="mdi mdi-fit-to-screen-outline"></span></button>
      </div>
      <div :style="{ position: 'absolute', left: '50%', top: '50%', width: '1000px', height: '620px', transform: ar.xf, transition: 'transform .2s ease' }">
        <template v-if="ar.isModule">
          <div v-for="c in ar.clusters" :key="c.label" :style="{ position: 'absolute', left: c.l, top: c.t, width: c.w, height: c.h, border: '1px dashed var(--om-gray-500)', borderRadius: '10px', background: 'var(--om-white-04)' }"><span style="position:absolute;left:10px;top:6px;font-family:var(--font-mono);font-size:.68rem;color:var(--om-text-muted)">{{ c.label }}</span></div>
          <svg width="1000" height="620" :style="svgStyle">
            <defs>
              <marker v-for="[id, c] in markers" :key="id" :id="id" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" :style="{ fill: c }" /></marker>
            </defs>
            <line v-for="e in ar.edges" :key="e.key" :x1="e.x1" :y1="e.y1" :x2="e.x2" :y2="e.y2" :marker-end="e.markerEnd" :style="e.style" />
          </svg>
          <div v-for="n in ar.nodes" :key="n.id" @click="n.pick" v-hover="'border-color:var(--om-border-hover)'" :style="{ position: 'absolute', left: n.l, top: n.t, transform: 'translate(-50%,-50%)', minWidth: '112px', padding: '6px 10px', borderRadius: '6px', border: '1px solid ' + n.bd, background: n.bg, boxShadow: '0 1px 2px rgba(0,0,0,.3)', cursor: 'pointer', display: 'flex', flexDirection: 'column', gap: '1px', transition: 'border-color .15s' }">
            <div style="display:flex;align-items:center;gap:6px"><span :style="{ width: '6px', height: '6px', borderRadius: '50%', background: n.dot }"></span><span style="font-family:var(--font-mono);font-size:.76rem;font-weight:500;color:var(--om-text-strong)">{{ n.id }}</span></div>
            <span style="font-size:.6rem;color:var(--om-text-muted);padding-left:12px">{{ n.meta }}</span>
          </div>
        </template>
        <template v-if="ar.isC4">
          <div style="position:absolute;left:150px;top:150px;width:780px;height:440px;border:1.5px dashed var(--om-blue);border-radius:12px"><span style="position:absolute;left:12px;bottom:8px;font-size:.7rem;color:var(--om-blue)">harbor-api · System boundary</span></div>
          <svg width="1000" height="620" :style="svgStyle">
            <defs>
              <marker id="c4a" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0L10,5L0,10z" style="fill:var(--om-gray-300)" /></marker>
            </defs>
            <g v-for="e in ar.c4edges" :key="e.key">
              <line :x1="e.L.x1" :y1="e.L.y1" :x2="e.L.x2" :y2="e.L.y2" marker-end="url(#c4a)" style="stroke:var(--om-gray-400);stroke-width:1.2" />
              <text :x="e.tx" :y="e.ty" text-anchor="middle" style="fill:var(--om-text-muted);font-size:11px;font-family:Roboto, sans-serif">{{ e.text }}</text>
            </g>
          </svg>
          <div v-for="c in ar.c4" :key="c.id" @click="c.pick" :style="{ position: 'absolute', left: c.l, top: c.tp, transform: 'translate(-50%,-50%)', width: '180px', minHeight: '74px', padding: '8px 12px', borderRadius: c.rad, border: '1.5px ' + c.bs + ' ' + c.bd, background: c.bg, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: '2px' }">
            <span style="font-size:.82rem;font-weight:600;color:var(--om-text-strong)">{{ c.t }}</span>
            <span style="font-size:.6rem;color:var(--om-text-label)">[{{ c.s }}]</span>
            <span style="font-size:.64rem;color:var(--om-text-muted)">{{ c.d }}</span>
          </div>
        </template>
      </div>
      <div style="position:absolute;left:12px;bottom:12px;display:flex;gap:14px;font-size:.66rem;color:var(--om-text-muted);background:var(--om-card);border:1px solid var(--om-border);border-radius:6px;padding:5px 10px">
        <span style="display:flex;align-items:center;gap:5px"><span style="width:16px;border-top:1.5px dashed var(--om-danger)"></span>Cycle</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:16px;border-top:1.5px solid var(--om-mint)"></span>Selected</span>
        <span style="display:flex;align-items:center;gap:5px"><span style="width:16px;border-top:1px solid var(--om-gray-500)"></span>Import</span>
        <span>Scroll to zoom · drag to pan</span>
      </div>
    </div>
    <div style="width:320px;flex-shrink:0;border-left:1px solid var(--om-border);background:var(--om-surface);overflow:auto">
      <template v-if="ar.isModule">
        <div style="padding:14px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:6px">
          <div style="display:flex;align-items:center;gap:8px"><span class="mdi mdi-cube-outline" style="color:var(--om-text-muted)"></span><span style="font-family:var(--font-mono);font-size:.95rem;font-weight:500;color:var(--om-text-strong);flex:1">{{ ar.n.id }}</span>
            <OmBadge v-if="ar.n.inCycle" kind="flag" tone="red" icon="sync">IN CYCLE</OmBadge>
          </div>
          <span style="font-family:var(--font-mono);font-size:.68rem;color:var(--om-text-muted)">{{ ar.n.path }}</span>
          <span v-if="ar.n.inCycle" style="font-size:.72rem;color:var(--om-tone-red-fg)">Mutual import with {{ ar.n.cycleWith }}</span>
        </div>
        <div style="padding:12px 16px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px 8px;border-bottom:1px solid var(--om-border)">
          <div v-for="m in ar.n.stats" :key="m.k" style="display:flex;flex-direction:column;gap:1px"><span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">{{ m.k }}</span><span style="font-family:var(--font-mono);font-size:.92rem;color:var(--om-text-strong)">{{ m.v }}</span></div>
        </div>
        <div style="padding:12px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:6px">
          <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Imports →</span>
          <div style="display:flex;flex-wrap:wrap;gap:5px">
            <span v-for="i in ar.n.imports" :key="i.id" @click="i.pick" style="font-family:var(--font-mono);font-size:.68rem;padding:2px 8px;border-radius:999px;background:var(--om-tone-neutral-bg);color:var(--om-tone-neutral-fg);cursor:pointer;display:flex;align-items:center;gap:4px">{{ i.id }}<span v-if="i.cyc" class="mdi mdi-sync" style="color:var(--om-danger)"></span></span>
          </div>
          <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);margin-top:6px">← Imported By</span>
          <div style="display:flex;flex-wrap:wrap;gap:5px">
            <span v-for="i in ar.n.importers" :key="i.id" @click="i.pick" style="font-family:var(--font-mono);font-size:.68rem;padding:2px 8px;border-radius:999px;background:var(--om-tone-neutral-bg);color:var(--om-tone-neutral-fg);cursor:pointer;display:flex;align-items:center;gap:4px">{{ i.id }}<span v-if="i.cyc" class="mdi mdi-sync" style="color:var(--om-danger)"></span></span>
          </div>
        </div>
        <div style="padding:12px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:6px">
          <div style="display:grid;grid-template-columns:minmax(0,1fr) 30px 30px 80px;gap:8px;font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)"><span>Classes</span><span title="Depth of inheritance">DIT</span><span title="Number of subclasses">NOC</span><span title="Lack of cohesion of methods — high means several classes glued together">LCOM</span></div>
          <div v-for="c in ar.n.classes" :key="c.n" style="display:grid;grid-template-columns:minmax(0,1fr) 30px 30px 80px;gap:8px;align-items:center;font-family:var(--font-mono);font-size:.7rem">
            <span style="color:var(--om-text-strong);overflow:hidden;text-overflow:ellipsis">{{ c.n }}</span><span style="color:var(--om-text-value)">{{ c.dit }}</span><span style="color:var(--om-text-value)">{{ c.noc }}</span>
            <span style="display:flex;align-items:center;gap:5px"><span style="flex:1;height:4px;border-radius:2px;background:var(--om-inset);overflow:hidden"><span :style="{ display: 'block', height: '100%', width: c.lw, background: c.lfg }"></span></span><span :style="{ color: c.lfg }">{{ c.lcom }}</span></span>
          </div>
          <span v-if="ar.n.noClasses" style="font-size:.7rem;color:var(--om-text-muted)">No classes — functions only.</span>
          <span style="font-size:.62rem;color:var(--om-text-muted)">LCOM above 0.6 suggests the class does several unrelated jobs.</span>
        </div>
        <div style="padding:14px 16px">
          <div style="border:1px dashed var(--ai-line);background:var(--ai-bg);border-radius:6px;padding:12px;display:flex;flex-direction:column;gap:6px">
            <span style="display:flex;align-items:center;gap:4px;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--ai)"><span class="mdi mdi-creation"></span>Module summary · AI</span>
            <span style="font-size:.78rem;line-height:1.55;color:var(--om-text);text-wrap:pretty">{{ ar.n.summary }}</span>
          </div>
        </div>
      </template>
      <template v-if="ar.isC4">
        <div style="padding:14px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:4px">
          <span style="font-size:.95rem;font-weight:600;color:var(--om-text-strong)">{{ ar.c.t }}</span>
          <span style="font-size:.7rem;color:var(--om-text-muted)">{{ ar.c.s }}</span>
        </div>
        <div style="padding:12px 16px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:6px">
          <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Relationships</span>
          <div v-for="(r, i) in ar.c.rels" :key="i" style="display:flex;gap:8px;font-size:.74rem;align-items:baseline"><span style="font-family:var(--font-mono);color:var(--om-teal)">{{ r.dir }}</span><span style="color:var(--om-text-strong);font-weight:500">{{ r.other }}</span><span style="color:var(--om-text-muted)">{{ r.l }}</span></div>
        </div>
        <div style="padding:12px 16px;display:flex;flex-direction:column;gap:8px;font-size:.72rem;color:var(--om-text-muted);line-height:1.5">
          <div style="display:flex;gap:6px"><span class="mdi mdi-function-variant"></span><span>Containers and links inferred from <span style="font-family:var(--font-mono)">docker-compose.yml</span>, <span style="font-family:var(--font-mono)">k8s/</span> and package imports.</span></div>
          <div style="display:flex;gap:6px;color:var(--ai)"><span class="mdi mdi-creation"></span><span>Descriptions are AI-written.</span></div>
        </div>
      </template>
    </div>
  </div>
</template>

// Hotspot treemap layout (prototype: Component.treemap). Uses d3-hierarchy's
// squarified layout as the architecture prescribes; the prototype used its own
// squarify. See docs/Architecture/prototype-port.md.
import { hierarchy, treemap as d3treemap, treemapSquarify } from 'd3-hierarchy';
import { METRICS } from './constants.js';
import { HEAT, AGE, ramp, lum } from './color.js';

/**
 * @param {object} o
 * @param {Array} o.files  FILES sample rows
 * @param {string} o.metric  metric id
 * @param {string} o.sel  selected path
 * @param {'dark'|'light'} o.theme
 * @param {number} o.W  layout width (units; output is in %)
 * @param {number} o.H  layout height
 * @param {boolean} o.labels  reserve 18 units for folder labels
 * @param {(path:string)=>void} o.onPick
 */
export function buildTreemap({ files, metric, sel, theme, W, H, labels, onPick }) {
  const met = METRICS.find((x) => x.id === metric) || METRICS[0];
  const st = (met.id === 'age' ? AGE : HEAT)[theme];
  const byDir = {};
  files.forEach((f) => (byDir[f.dir] = byDir[f.dir] || []).push(f));
  const top = labels ? 18 : 0;

  const root = hierarchy({ children: Object.entries(byDir).map(([d, fs]) => ({ d, children: fs.map((f) => ({ f })) })) })
    .sum((n) => (n.f ? n.f.loc : 0))
    .sort((a, b) => b.value - a.value);

  d3treemap()
    .tile(treemapSquarify.ratio(1))
    .size([W, H])
    .paddingTop((n) => (n.depth === 1 ? top : 0))
    .paddingRight((n) => (n.depth === 1 ? 2 : 0))
    .paddingBottom((n) => (n.depth === 1 ? 2 : 0))
    .paddingLeft((n) => (n.depth === 1 ? 2 : 0))(root);

  const pct = (v, T) => ((v / T) * 100).toFixed(3) + '%';
  const cells = [], dirs = [];
  for (const D of root.children || []) {
    dirs.push({ label: D.data.d.replace('src/', ''), l: pct(D.x0, W), t: pct(D.y0, H), w: pct(D.x1 - D.x0, W), h: pct(D.y1 - D.y0, H) });
    for (const c of D.children || []) {
      const f = c.data.f;
      const w = c.x1 - c.x0, h = c.y1 - c.y0;
      const bg = ramp(st, met.val(f));
      const isSel = f.path === sel;
      cells.push({
        key: f.path, l: pct(c.x0, W), t: pct(c.y0, H), w: pct(w, W), h: pct(h, H), bg,
        fg: lum(bg) > 0.6 ? '#172b4d' : 'rgba(255,255,255,.88)',
        name: w > 70 && h > 26 ? f.name : '',
        val: w > 70 && h > 44 ? met.fmt(f) : '',
        short: w > 90 && h > 24 ? f.name : '',
        tip: f.path + ' — ' + met.fmt(f),
        ring: isSel ? 'inset 0 0 0 2px var(--om-mint)' : 'none',
        z: isSel ? 2 : 1,
        pick: () => onPick(f.path),
      });
    }
  }
  return { cells, dirs, legend: [0, 0.25, 0.5, 0.75, 1].map((t) => ramp(st, t)), met };
}

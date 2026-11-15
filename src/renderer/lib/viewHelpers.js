// Shared view-model helpers, ported from the prototype's more() preamble.
// See docs/Architecture/prototype-port.md.

/** Hotspot severity from churn × complexity (prototype: sevOf). */
export const sevOf = (f) => {
  const r = (f.churn * f.cx) / 2928;
  return r > 0.6 ? 'critical' : r > 0.3 ? 'warning' : 'info';
};

/** Edge segment between two box centres, clipped to the box edges (prototype: seg). */
export const seg = (A, B, hw, hh, off) => {
  const dx = B.x - A.x, dy = B.y - A.y, len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * off, ny = (dx / len) * off;
  const k = Math.min(hw / Math.max(Math.abs(dx), 1e-6), hh / Math.max(Math.abs(dy), 1e-6), 0.45);
  return { x1: A.x + dx * k + nx, y1: A.y + dy * k + ny, x2: B.x - dx * k + nx, y2: B.y - dy * k + ny };
};

/**
 * Segmented / underline tab models (prototype: tabs).
 * @param {Array<[string,string]>} list  [id, label] pairs
 * @param {string} cur  active id
 * @param {string} key  state key to set
 * @param {(patch:object)=>void} setState
 */
export const tabs = (list, cur, key, setState) =>
  list.map(([id, label]) => ({
    id,
    label,
    bg: id === cur ? 'var(--om-card-raised)' : 'transparent',
    fg: id === cur ? 'var(--om-mint)' : 'var(--om-text-muted)',
    bd: id === cur ? 'var(--om-mint)' : 'transparent',
    pick: () => setState({ [key]: id }),
  }));

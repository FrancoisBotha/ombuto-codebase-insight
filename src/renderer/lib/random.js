// Deterministic hash / PRNG used to generate sample values.
// Extracted verbatim from the prototype (docs/References/Ombuto Codebase Insight prototype,
// "Codebase Insight.dc.html"). See docs/Architecture/prototype-port.md.
export const hash=s=>{let h=7;for(const c of s)h=(h*31+c.charCodeAt(0))%2147483647;return h||1};
export const rng=seed=>{let s=seed;return()=>{s=(s*16807)%2147483647;return s/2147483647}};

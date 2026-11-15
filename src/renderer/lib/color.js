// Colour helpers and heat / age ramps.
// Extracted verbatim from the prototype (docs/References/Ombuto Codebase Insight prototype,
// "Codebase Insight.dc.html"). See docs/Architecture/prototype-port.md.
export const hx=h=>[1,3,5].map(i=>parseInt(h.slice(i,i+2),16));
export const mix=(a,b,t)=>{const A=hx(a),B=hx(b);return '#'+A.map((v,i)=>Math.round(v+(B[i]-v)*t).toString(16).padStart(2,'0')).join('')};
export const ramp=(st,t)=>{t=Math.max(0,Math.min(1,t));const n=st.length-1;const i=Math.min(n-1,Math.floor(t*n));return mix(st[i],st[i+1],t*n-i)};
export const lum=h=>{const [r,g,b]=hx(h);return (.299*r+.587*g+.114*b)/255};
export const HEAT={dark:['#2a3038','#4d4429','#8a6420','#b8553c','#e06060'],light:['#e9edf1','#f5e3b5','#f0c070','#ea8c6c','#e06060']};
export const AGE={dark:['#1f6b57','#1f4a44','#253540','#2a3038','#22262c'],light:['#6dd4a0','#a9e2c7','#cfe3dc','#e3e8ec','#eef1f4']};

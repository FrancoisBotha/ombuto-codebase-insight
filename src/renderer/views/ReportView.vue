<script setup>
// Share Report screen (prototype lines 1433–1530; view-model in more() "// report").
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import { tabs } from '../lib/viewHelpers.js';
import { FILES, REPORT_BADGES, REPORT_SECTIONS, REPORT_SUBSCORES, REPORT_EXPORTS } from '../data/insightData.js';
import OmButton from '../components/ds/OmButton.vue';
import OmPrototypeBanner from '../components/ds/OmPrototypeBanner.vue';

const store = useInsightStore();
const S = store.state;

const rp = computed(() => {
  const bs = S.badgeStyle;
  return {
    secs: REPORT_SECTIONS.map(([k, l]) => ({
      k, l,
      ic: S.sections[k] ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline',
      fg: S.sections[k] ? 'var(--om-mint)' : 'var(--om-text-muted)',
      pick: () => store.setState((s) => ({ sections: { ...s.sections, [k]: !s.sections[k] } })),
    })),
    on: S.sections,
    subscores: REPORT_SUBSCORES.map(([k, v]) => ({ k, v, w: v + '%', fg: v >= 70 ? '#1f9a56' : v >= 55 ? '#c98a10' : '#c04040' })),
    hot: [...FILES].sort((a, b) => b.churn * b.cx - a.churn * a.cx).slice(0, 4).map((f) => ({ p: f.path, c: f.churn, x: f.cx })),
    styles: tabs([['flat', 'Flat'], ['square', 'Square'], ['large', 'Large']], bs, 'badgeStyle', store.setState),
    badges: REPORT_BADGES.map(([id, l, v, c]) => {
      const snip = `![${l}: ${v}](.insight/badges/${id}.svg)`;
      return {
        id, l, v, c,
        lbl: bs === 'large' ? l.toUpperCase() : l,
        val: bs === 'large' ? v.toUpperCase() : v,
        rad: bs === 'flat' ? '3px' : '0',
        pad: bs === 'large' ? '5px 9px' : '2px 6px',
        fs: bs === 'large' ? '.62rem' : '.68rem',
        ls: bs === 'large' ? '.08em' : '0',
        snip,
        copied: S.copied === id,
        notCopied: S.copied !== id,
        copy: () => {
          try { navigator.clipboard && navigator.clipboard.writeText(snip); } catch (e) { /* ignore */ }
          store.setState({ copied: id });
          store.later('copied', 1800, () => store.setState({ copied: null }));
        },
      };
    }),
    exp: REPORT_EXPORTS.map(([l, ic]) => ({
      l, ic,
      run: () => store.toast('Saved harbor-api-health-2026-10-24.' + (l === 'Markdown' ? 'md' : l.toLowerCase()) + ' to ~/Downloads'),
    })),
  };
});
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0">
    <div style="display:flex;flex-direction:column;gap:2px;margin-right:auto">
      <div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Share Report</div>
      <div style="font-size:.7rem;color:var(--om-text-muted)">Metrics and file paths only — no source code is included</div>
    </div>
    <OmButton v-for="x in rp.exp" :key="x.l" variant="secondary" :icon="x.ic" @click="x.run">{{ x.l }}</OmButton>
  </div>
  <OmPrototypeBanner />
  <div style="flex:1;min-height:0;display:flex">
    <div style="width:340px;flex-shrink:0;border-right:1px solid var(--om-border);background:var(--om-surface);overflow:auto;padding:16px;display:flex;flex-direction:column;gap:18px">
      <div style="display:flex;flex-direction:column;gap:6px">
        <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Include Sections</span>
        <div v-for="s in rp.secs" :key="s.k" @click="s.pick" style="display:flex;align-items:center;gap:8px;font-size:.8rem;cursor:pointer;padding:3px 0;color:var(--om-text)"><span :class="'mdi ' + s.ic" :style="{ color: s.fg, fontSize: '1rem' }"></span>{{ s.l }}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">README Badges</span>
          <div style="display:flex;gap:2px;padding:2px;border-radius:6px;background:var(--om-inset);border:1px solid var(--om-border)"><button v-for="m in rp.styles" :key="m.id" @click="m.pick" :style="{ border: 'none', fontFamily: 'inherit', fontSize: '.68rem', fontWeight: 500, padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', background: m.bg, color: m.fg }">{{ m.label }}</button></div>
        </div>
        <div v-for="b in rp.badges" :key="b.id" style="display:flex;flex-direction:column;gap:6px;padding:10px;border-radius:6px;background:var(--om-card);border:1px solid var(--om-border)">
          <div :style="{ display: 'flex', width: 'fit-content', fontFamily: 'Verdana,var(--font-sans)', fontSize: b.fs, letterSpacing: b.ls, borderRadius: b.rad, overflow: 'hidden', lineHeight: 1.3 }">
            <span :style="{ background: '#444c56', color: '#fff', padding: b.pad }">{{ b.lbl }}</span><span :style="{ background: b.c, color: '#161a1f', fontWeight: 600, padding: b.pad }">{{ b.val }}</span>
          </div>
          <div style="display:flex;align-items:center;gap:6px">
            <code style="flex:1;min-width:0;font-family:var(--font-mono);font-size:.64rem;color:var(--om-text-muted);background:var(--om-inset);padding:4px 6px;border-radius:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ b.snip }}</code>
            <button @click="b.copy" class="om-square om-square--sm" title="Copy Markdown">
              <span v-if="b.notCopied" class="mdi mdi-content-copy"></span>
              <span v-if="b.copied" class="mdi mdi-check" style="color:var(--om-mint)"></span>
            </button>
          </div>
        </div>
        <span style="font-size:.66rem;color:var(--om-text-muted);line-height:1.5">Badges are written as SVG files to <span style="font-family:var(--font-mono)">.insight/badges/</span> in your repo and refresh on each analysis. No external badge service is used.</span>
      </div>
    </div>
    <div style="flex:1;min-width:0;overflow:auto;background:var(--om-inset);padding:28px;display:flex;justify-content:center">
      <div data-theme="light" style="width:100%;max-width:720px;background:#fff;color:#2c3e50;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.4);padding:40px 44px;display:flex;flex-direction:column;gap:22px;align-self:flex-start">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;border-bottom:1px solid #e1e4e8;padding-bottom:18px">
          <div style="display:flex;flex-direction:column;gap:4px">
            <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#6b778c">Codebase Health Report</span>
            <span style="font-size:1.5rem;font-weight:600;color:#172b4d;font-family:var(--font-mono)">harbor-api</span>
            <span style="font-family:var(--font-mono);font-size:.7rem;color:#6b778c">main @ a91f3c2 · 24 October 2026</span>
          </div>
          <div style="display:flex;flex-direction:column;align-items:flex-end"><span style="font-family:var(--font-mono);font-size:2.4rem;font-weight:300;line-height:1;color:#172b4d">72</span><span style="font-size:.66rem;font-weight:600;color:#856404;background:#fff3cd;padding:1px 8px;border-radius:999px">FAIR</span></div>
        </div>
        <div v-if="rp.on.summary" style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px">
          <div style="display:flex;flex-direction:column"><span style="font-size:.6rem;font-weight:600;text-transform:uppercase;color:#6b778c">Lines</span><span style="font-family:var(--font-mono);font-size:1rem;color:#172b4d">48,212</span></div>
          <div style="display:flex;flex-direction:column"><span style="font-size:.6rem;font-weight:600;text-transform:uppercase;color:#6b778c">Contributors</span><span style="font-family:var(--font-mono);font-size:1rem;color:#172b4d">23</span></div>
          <div style="display:flex;flex-direction:column"><span style="font-size:.6rem;font-weight:600;text-transform:uppercase;color:#6b778c">Coverage</span><span style="font-family:var(--font-mono);font-size:1rem;color:#172b4d">68%</span></div>
          <div style="display:flex;flex-direction:column"><span style="font-size:.6rem;font-weight:600;text-transform:uppercase;color:#6b778c">Cycles</span><span style="font-family:var(--font-mono);font-size:1rem;color:#172b4d">3</span></div>
        </div>
        <div v-if="rp.on.ai" style="border:1px dashed rgba(67,56,202,.35);background:rgba(67,56,202,.04);border-radius:6px;padding:12px 14px;display:flex;flex-direction:column;gap:6px">
          <span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:#4338ca">✦ AI narrative</span>
          <span style="font-size:.82rem;line-height:1.6;color:#2c3e50">harbor-api is in fair shape with risk concentrated in billing. One file, invoice.ts, accounts for most recent change and complexity. Two critical vulnerabilities have simple patch upgrades available. Auth and database code depend on single authors.</span>
        </div>
        <div v-if="rp.on.health" style="display:flex;flex-direction:column;gap:8px">
          <span style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#44546f">Health Breakdown</span>
          <div v-for="s in rp.subscores" :key="s.k" style="display:grid;grid-template-columns:140px minmax(0,1fr) 30px;gap:10px;align-items:center;font-size:.76rem"><span style="color:#44546f">{{ s.k }}</span><div style="height:5px;border-radius:3px;background:#eef1f4;overflow:hidden"><div :style="{ height: '100%', width: s.w, background: s.fg }"></div></div><span style="font-family:var(--font-mono);text-align:right;color:#172b4d">{{ s.v }}</span></div>
        </div>
        <div v-if="rp.on.hotspots" style="display:flex;flex-direction:column;gap:6px">
          <span style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#44546f">Top Hotspots</span>
          <div v-for="h in rp.hot" :key="h.p" style="display:grid;grid-template-columns:minmax(0,1fr) 90px 60px;gap:10px;font-family:var(--font-mono);font-size:.72rem;padding:5px 0;border-top:1px solid #e1e4e8"><span style="color:#172b4d">{{ h.p }}</span><span style="color:#6b778c">{{ h.c }} commits</span><span style="color:#6b778c;text-align:right">cc {{ h.x }}</span></div>
        </div>
        <div v-if="rp.on.risks" style="display:flex;flex-direction:column;gap:6px">
          <span style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#44546f">Key Risks</span>
          <div style="display:flex;gap:8px;font-size:.76rem;align-items:center"><span style="font-size:.6rem;font-weight:600;padding:1px 7px;border-radius:999px;background:#fde8ea;color:#7f1d1d">CRITICAL</span>Cycle between billing and orders (14 import sites)</div>
          <div style="display:flex;gap:8px;font-size:.76rem;align-items:center"><span style="font-size:.6rem;font-weight:600;padding:1px 7px;border-radius:999px;background:#fff3cd;color:#856404">WARNING</span>Bus factor 1 in auth/oauth.ts and infra/db/client.ts</div>
        </div>
        <div v-if="rp.on.deps" style="display:flex;flex-direction:column;gap:6px">
          <span style="font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:#44546f">Dependency Health</span>
          <span style="font-size:.76rem;color:#2c3e50">18 direct packages · 6 with known vulnerabilities (2 critical) · 7 a major version behind · 1 license change to review (ua-parser-js → AGPL-3.0).</span>
        </div>
        <span style="font-size:.62rem;color:#6b778c;border-top:1px solid #e1e4e8;padding-top:12px">Generated locally by Ombuto Codebase Insight 0.4.0. Sections marked ✦ are AI-written.</span>
      </div>
    </div>
  </div>
</template>

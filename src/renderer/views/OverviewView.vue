<script setup>
// Overview screen (prototype lines 239–392), with the four view states
// loaded / empty / loading / error (store.viewState, the prototype's "viewState" tweak).
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import {
  FILES, OVERVIEW_LANGS, OVERVIEW_SUMMARY, OVERVIEW_SUBSCORES, OVERVIEW_RISKS, OVERVIEW_ACTIVITY_CHIPS,
} from '@/data/insightData.js';
import { SEV } from '../lib/constants.js';
import { buildTreemap } from '../lib/treemap.js';
import OmButton from '../components/ds/OmButton.vue';
import OmBadge from '../components/ds/OmBadge.vue';

const store = useInsightStore();
const S = store.state;

const langs = OVERVIEW_LANGS.map(([name, p, c]) => ({ name, pct: p + '%', w: p + '%', c }));
const summary = OVERVIEW_SUMMARY.map(([k, v, sub]) => ({ k, v, sub }));
const sc = (v) => (v >= 70 ? 'var(--om-success)' : v >= 55 ? 'var(--om-warning)' : 'var(--om-danger)');
const subscores = OVERVIEW_SUBSCORES.map(([k, v]) => ({ k, v, w: v + '%', fg: sc(v) }));

const topHot = computed(() =>
  [...FILES]
    .sort((a, b) => b.churn * b.cx - a.churn * a.cx)
    .slice(0, 6)
    .map((f) => {
      const r = (f.churn * f.cx) / 2928;
      return {
        key: f.path, name: f.name, dir: f.dir, churn: f.churn, cx: f.cx, w: (r * 100).toFixed(0) + '%',
        fg: r > 0.6 ? 'var(--om-danger)' : r > 0.35 ? 'var(--om-warning)' : 'var(--om-blue)',
        open: () => store.go('hotspots', { sel: f.path, explain: 'idle' }),
      };
    }),
);
const risks = OVERVIEW_RISKS.map(([sev, title, detail, id, extra]) => ({
  ...SEV[sev], sev: SEV[sev].label, title, detail, go: () => store.go(id, extra),
}));
const activityChips = OVERVIEW_ACTIVITY_CHIPS.map(([label, id, extra]) => ({ label, go: () => store.go(id, extra) }));

const tmSmall = computed(() =>
  buildTreemap({
    files: FILES, metric: S.metric, sel: S.sel, theme: store.theme, W: 1000, H: 330, labels: false,
    onPick: (path) => store.setState({ sel: path, explain: 'idle' }),
  }),
);
const ov = computed(() => {
  const vs = store.viewState;
  return { loaded: vs === 'loaded', empty: vs === 'empty', loading: vs === 'loading', error: vs === 'error' };
});
const goReport = () => store.go('report');
const goHotspots = () => store.go('hotspots');
const reanalyse = () => store.go('indexing', { t: 0 });
</script>

<template>
  <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0">
    <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0">
      <div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Overview</div>
      <div style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted)">main @ a91f3c2 · analysed 24 Oct 2026, 11:42 · 612 files</div>
    </div>
    <div style="display:flex;align-items:center;gap:14px;font-size:.68rem;color:var(--om-text-muted)">
      <span style="display:flex;align-items:center;gap:5px"><span class="mdi mdi-function-variant" style="color:var(--om-text-label)"></span>Computed</span>
      <span style="display:flex;align-items:center;gap:5px;color:var(--ai)"><span class="mdi mdi-creation"></span>AI-interpreted</span>
    </div>
    <OmButton variant="secondary" icon="export-variant" @click="goReport">Share</OmButton>
  </div>

  <div v-if="ov.loaded" style="flex:1;overflow:auto;padding:16px 20px;display:flex;flex-direction:column;gap:14px">
    <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px;display:grid;grid-template-columns:minmax(220px,1.6fr) repeat(6,minmax(0,1fr));gap:16px;align-items:center">
      <div style="display:flex;flex-direction:column;gap:6px">
        <div style="display:flex;height:6px;border-radius:3px;overflow:hidden;gap:2px">
          <div v-for="l in langs" :key="l.name" :style="{ width: l.w, background: l.c }"></div>
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:4px 10px;font-size:.66rem;color:var(--om-text-muted)">
          <span v-for="l in langs" :key="l.name" style="display:flex;align-items:center;gap:4px"><span :style="{ width: '6px', height: '6px', borderRadius: '2px', background: l.c }"></span>{{ l.name }} <span style="font-family:var(--font-mono)">{{ l.pct }}</span></span>
        </div>
      </div>
      <div v-for="s in summary" :key="s.k" style="display:flex;flex-direction:column;gap:1px;border-left:1px solid var(--om-border);padding-left:14px">
        <span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">{{ s.k }}</span>
        <span style="font-family:var(--font-mono);font-size:1rem;color:var(--om-text-strong)">{{ s.v }}</span>
        <span style="font-size:.62rem;color:var(--om-text-muted);white-space:nowrap">{{ s.sub }}</span>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(260px,300px) minmax(0,1.25fr) minmax(0,1fr);gap:14px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:16px;display:flex;flex-direction:column;gap:14px">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Health Score</span><span class="mdi mdi-function-variant" style="color:var(--om-text-muted)" title="Computed from 5 deterministic signals"></span></div>
        <div style="display:flex;align-items:flex-end;gap:10px">
          <span style="font-size:3.4rem;font-weight:300;line-height:.9;color:var(--om-text-strong);font-family:var(--font-mono)">72</span>
          <div style="display:flex;flex-direction:column;gap:4px;padding-bottom:2px">
            <OmBadge kind="flag" tone="yellow">FAIR</OmBadge>
            <span style="font-size:.68rem;color:var(--om-text-muted)"><span style="color:var(--om-danger)">▼ 3</span> since 10 Oct</span>
          </div>
        </div>
        <div style="display:flex;flex-direction:column;gap:9px">
          <div v-for="s in subscores" :key="s.k" style="display:flex;flex-direction:column;gap:3px">
            <div style="display:flex;justify-content:space-between;font-size:.72rem"><span style="color:var(--om-text-label)">{{ s.k }}</span><span :style="{ fontFamily: 'var(--font-mono)', color: s.fg }">{{ s.v }}</span></div>
            <div style="height:4px;border-radius:2px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: s.w, background: s.fg }"></div></div>
          </div>
        </div>
      </div>

      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;display:flex;flex-direction:column;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Top Hotspots</span><a @click="goHotspots" style="font-size:.7rem;cursor:pointer">Open treemap →</a></div>
        <div style="display:grid;grid-template-columns:minmax(0,1fr) 54px 44px 90px;gap:10px;padding:0 16px 6px;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-placeholder)"><span>File</span><span style="text-align:right">Churn</span><span style="text-align:right">CC</span><span>Risk</span></div>
        <div v-for="h in topHot" :key="h.key" @click="h.open" v-hover="'background:var(--om-card-raised)'" style="display:grid;grid-template-columns:minmax(0,1fr) 54px 44px 90px;gap:10px;padding:8px 16px;border-top:1px solid var(--om-border);align-items:center;cursor:pointer;font-size:.75rem">
          <div style="min-width:0;display:flex;flex-direction:column"><span style="font-family:var(--font-mono);color:var(--om-text-strong);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ h.name }}</span><span style="font-family:var(--font-mono);font-size:.62rem;color:var(--om-text-muted)">{{ h.dir }}</span></div>
          <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-value)">{{ h.churn }}</span>
          <span style="font-family:var(--font-mono);text-align:right;color:var(--om-text-value)">{{ h.cx }}</span>
          <div style="display:flex;align-items:center;gap:6px"><div style="flex:1;height:4px;border-radius:2px;background:var(--om-inset);overflow:hidden"><div :style="{ height: '100%', width: h.w, background: h.fg }"></div></div></div>
        </div>
      </div>

      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;display:flex;flex-direction:column;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px 8px"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Key Risks</span><span style="font-size:.68rem;color:var(--om-text-muted)">2 critical · 3 warning · 1 info</span></div>
        <div v-for="r in risks" :key="r.title" @click="r.go" v-hover="'background:var(--om-card-raised)'" style="display:flex;gap:10px;padding:9px 16px;border-top:1px solid var(--om-border);cursor:pointer;align-items:flex-start">
          <span :class="'mdi ' + r.icon" :style="{ color: r.fg, fontSize: '.95rem', marginTop: '1px' }"></span>
          <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
            <span style="font-size:.78rem;color:var(--om-text-strong);font-weight:500">{{ r.title }}</span>
            <span style="font-family:var(--font-mono);font-size:.65rem;color:var(--om-text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{{ r.detail }}</span>
          </div>
          <OmBadge kind="flag" :tone="r.tone">{{ r.sev }}</OmBadge>
        </div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:14px">
      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:12px 16px 16px;display:flex;flex-direction:column;gap:10px;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center"><span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Hotspot Map · Churn × Complexity</span><div style="display:flex;align-items:center;gap:3px;font-size:.62rem;color:var(--om-text-muted)"><span>low</span><span v-for="(c, i) in tmSmall.legend" :key="i" :style="{ width: '14px', height: '8px', borderRadius: '2px', background: c }"></span><span>high</span></div></div>
        <div @click="goHotspots" style="position:relative;height:230px;border-radius:4px;overflow:hidden;cursor:pointer;background:var(--om-inset)">
          <div v-for="c in tmSmall.cells" :key="c.key" :style="{ position: 'absolute', left: c.l, top: c.t, width: c.w, height: c.h, background: c.bg, border: '1px solid var(--om-card)', boxSizing: 'border-box', padding: '3px 5px', overflow: 'hidden', color: c.fg, fontFamily: 'var(--font-mono)', fontSize: '.6rem', whiteSpace: 'nowrap' }" :title="c.tip">{{ c.short }}</div>
        </div>
      </div>
      <div style="border:1px dashed var(--ai-line);background:var(--ai-bg);border-radius:8px;padding:12px 16px 14px;display:flex;flex-direction:column;gap:10px;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Recent Activity · Last 14 Days</span>
          <span style="display:flex;align-items:center;gap:4px;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--ai)"><span class="mdi mdi-creation"></span>AI summary · llama3.1:8b</span>
        </div>
        <div style="font-size:.82rem;line-height:1.6;color:var(--om-text);text-wrap:pretty">63 commits from 7 authors. Most work landed in <span style="font-family:var(--font-mono);font-size:.76rem">billing</span> — the proration rewrite (#412) touched <span style="font-family:var(--font-mono);font-size:.76rem">invoice.ts</span> 9 times and pushed its complexity from 48 to 61. Auth had a cookie-name migration; two PRs in <span style="font-family:var(--font-mono);font-size:.76rem">session.ts</span> revert each other. Billing test coverage fell from 71% to 64%.</div>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          <span v-for="c in activityChips" :key="c.label" @click="c.go" style="font-family:var(--font-mono);font-size:.66rem;padding:2px 8px;border-radius:999px;background:var(--om-tone-blue-bg);color:var(--om-tone-blue-fg);cursor:pointer">{{ c.label }}</span>
        </div>
        <div style="margin-top:auto;font-size:.65rem;color:var(--om-text-muted)">Interpreted from 63 commit messages and diffs · verify before acting</div>
      </div>
    </div>
  </div>

  <div v-if="ov.empty" style="flex:1;display:flex;align-items:center;justify-content:center;padding:40px">
    <div style="max-width:440px;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center">
      <div style="width:52px;height:52px;border-radius:999px;background:var(--om-inset);display:flex;align-items:center;justify-content:center"><span class="mdi mdi-chart-box-outline" style="font-size:1.6rem;color:var(--om-text-muted)"></span></div>
      <div style="font-size:1.1rem;font-weight:600;color:var(--om-text-strong)">This branch hasn’t been analysed.</div>
      <div style="font-size:.82rem;color:var(--om-text-muted);line-height:1.55;text-wrap:pretty">You switched to <span style="font-family:var(--font-mono)">feature/proration-v2</span>. Results for <span style="font-family:var(--font-mono)">main</span> are 2 hours old. A full analysis of this repo takes about 40 seconds.</div>
      <div style="display:flex;gap:8px">
        <OmButton variant="primary" icon="play" @click="reanalyse">Analyse Branch</OmButton>
        <OmButton variant="secondary">View main Results</OmButton>
      </div>
      <span style="font-size:.68rem;color:var(--om-text-placeholder)">Press <span style="font-family:var(--font-mono)">⌘R</span> to analyse</span>
    </div>
  </div>

  <div v-if="ov.loading" style="flex:1;overflow:hidden;padding:16px 20px;display:flex;flex-direction:column;gap:14px">
    <div style="display:flex;align-items:center;gap:8px;font-size:.75rem;color:var(--om-text-muted)"><span class="mdi mdi-loading mdi-spin" style="color:var(--om-teal)"></span>Computing health score — 3 of 5 signals ready</div>
    <div style="height:70px;border-radius:8px;background:var(--om-card);border:1px solid var(--om-border)"></div>
    <div style="display:grid;grid-template-columns:300px minmax(0,1.25fr) minmax(0,1fr);gap:14px">
      <div style="height:320px;border-radius:8px;background:var(--om-card);border:1px solid var(--om-border);padding:16px;display:flex;flex-direction:column;gap:12px"><div style="width:40%;height:10px;border-radius:3px;background:var(--om-inset)"></div><div style="width:50%;height:44px;border-radius:4px;background:var(--om-inset)"></div><div style="height:8px;border-radius:3px;background:var(--om-inset)"></div><div style="height:8px;border-radius:3px;background:var(--om-inset);width:80%"></div><div style="height:8px;border-radius:3px;background:var(--om-inset);width:65%"></div></div>
      <div style="height:320px;border-radius:8px;background:var(--om-card);border:1px solid var(--om-border);padding:16px;display:flex;flex-direction:column;gap:14px"><div style="width:30%;height:10px;border-radius:3px;background:var(--om-inset)"></div><div style="height:12px;border-radius:3px;background:var(--om-inset)"></div><div style="height:12px;border-radius:3px;background:var(--om-inset);width:90%"></div><div style="height:12px;border-radius:3px;background:var(--om-inset);width:75%"></div></div>
      <div style="height:320px;border-radius:8px;background:var(--om-card);border:1px solid var(--om-border);padding:16px;display:flex;flex-direction:column;gap:14px"><div style="width:30%;height:10px;border-radius:3px;background:var(--om-inset)"></div><div style="height:12px;border-radius:3px;background:var(--om-inset)"></div><div style="height:12px;border-radius:3px;background:var(--om-inset);width:70%"></div></div>
    </div>
  </div>

  <div v-if="ov.error" style="flex:1;display:flex;align-items:center;justify-content:center;padding:40px">
    <div style="width:100%;max-width:560px;background:var(--om-card);border:1px solid var(--om-tone-red-border);border-radius:8px;overflow:hidden">
      <div style="display:flex;gap:12px;padding:16px 18px;background:var(--om-tone-red-bg)">
        <span class="mdi mdi-alert-octagon-outline" style="font-size:1.3rem;color:var(--om-tone-red-fg)"></span>
        <div style="display:flex;flex-direction:column;gap:4px">
          <span style="font-size:.95rem;font-weight:600;color:var(--om-tone-red-fg)">Git history couldn’t be read.</span>
          <span style="font-size:.78rem;color:var(--om-text-value);line-height:1.5">This is a shallow clone (depth 1). Hotspots, ownership and code age need full history. Static analysis finished normally.</span>
        </div>
      </div>
      <div style="padding:14px 18px;display:flex;flex-direction:column;gap:12px">
        <div style="background:var(--om-terminal);border-radius:4px;padding:8px 10px;font-family:var(--font-mono);font-size:.68rem;color:var(--om-text-muted);line-height:1.6">$ git log --numstat --since=2y<br>fatal: log for 'main' only has 1 entries<br>hint: run 'git fetch --unshallow' to fetch full history</div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <OmButton variant="primary" icon="download-outline">Fetch Full History</OmButton>
          <OmButton variant="secondary">Continue Without History</OmButton>
          <OmButton variant="ghost" icon="content-copy">Copy Log</OmButton>
        </div>
      </div>
    </div>
  </div>
</template>

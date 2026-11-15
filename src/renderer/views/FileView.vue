<script setup>
// Files (prototype lines 1254–1384; logic: more() "// file" and the explorer tree block).
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import OmButton from '../components/ds/OmButton.vue';
import OmBadge from '../components/ds/OmBadge.vue';
import CodeView from '../components/CodeView.vue';
import { sevOf, tabs } from '../lib/viewHelpers.js';
import { hash, rng } from '../lib/random.js';
import {
  FILES, INVOICE, SNIPS, COMMITS,
  FILE_BLAME_INVOICE, FILE_BLAME_DEFAULT, FILE_CYC, FILE_INVOICE_TILES, FILE_FNS, FILE_MONTHS,
  FILE_IMPORTS, FILE_IMPORTERS, FILE_EXTRA,
} from '../data/insightData.js';

const store = useInsightStore();
const S = store.state;

const SRC = { 'src/billing/invoice.ts': [INVOICE, 1], 'src/auth/session.ts': [SNIPS.session.code, 1], 'src/api/middleware.ts': [SNIPS.middleware.code, 1], 'src/auth/permissions.ts': [SNIPS.permissions.code, 36] };

const fl = computed(() => {
  const fp = S.fsel || 'src/billing/invoice.ts';
  const FF = FILES.find((x) => x.path === fp);
  const fname = fp.split('/').pop();
  const fdir = fp.split('/').slice(0, -1).join('/') || '.';
  const src = SRC[fp];
  const fr = rng(hash(fp));
  const fsev = FF ? sevOf(FF) : null;
  const lang = fname.endsWith('.ts') ? 'TypeScript' : fname.endsWith('.sql') ? 'SQL' : fname.endsWith('.json') ? 'JSON' : fname.endsWith('.yml') ? 'YAML' : 'Markdown';
  const nLines = src ? src[0].split('\n').length : 0;
  const totalLoc = FF ? FF.loc : Math.round(20 + fr() * 180);
  return {
    src,
    blame: fp.endsWith('invoice.ts') ? FILE_BLAME_INVOICE : FILE_BLAME_DEFAULT,
    noCode: !src,
    foldDisp: src && totalLoc > nLines ? 'flex' : 'none',
    more: totalLoc - nLines + ' more lines',
    name: fname, dir: fdir,
    hasSev: !!fsev && fsev !== 'info', sevTone: fsev === 'critical' ? 'red' : 'yellow', sevLabel: fsev === 'critical' ? 'HOTSPOT' : 'WATCH',
    hasCycle: !!FILE_CYC[fdir], cycle: FILE_CYC[fdir] || '',
    metaLine: fp.endsWith('invoice.ts')
      ? '812 lines · TypeScript · 7 authors · last change 2 days ago by m.okafor'
      : FF
        ? FF.loc + ' lines · ' + lang + ' · ' + FF.authors + ' authors · ' + FF.own + '% top author · last change ' + (FF.age < 2 ? 'this month' : FF.age + ' mo ago')
        : totalLoc + ' lines · ' + lang + ' · not in hotspot analysis',
    tabs: tabs([['metrics', 'Metrics'], ['history', 'History'], ['deps', 'Dependencies'], ['summary', 'Summary']], S.ftab, 'ftab', store.setState),
    isMetrics: S.ftab === 'metrics', isHistory: S.ftab === 'history', isDeps: S.ftab === 'deps', isSummary: S.ftab === 'summary',
    tiles: (fp.endsWith('invoice.ts') || !FF
      ? FILE_INVOICE_TILES
      : [
        ['Cyclomatic', String(FF.cx), FF.cx > 40 ? 'high' : FF.cx > 20 ? 'moderate' : 'low', FF.cx > 40 ? 'var(--om-danger)' : FF.cx > 20 ? 'var(--om-warning)' : 'var(--om-text-muted)'],
        ['Cognitive', String(Math.round(FF.cx * 1.4)), '', 'var(--om-text-muted)'],
        ['Lines', FF.loc.toLocaleString(), Math.max(2, Math.round(FF.loc / 60)) + ' functions', 'var(--om-text-muted)'],
        ['Coverage', Math.round(45 + fr() * 45) + '%', '', 'var(--om-text-muted)'],
        ['Churn · 90d', String(FF.churn), 'commits', 'var(--om-text-muted)'],
        ['Duplication', Math.round(fr() * 8) + '%', '', 'var(--om-text-muted)'],
      ]).map(([k, v, s, sf]) => ({ k, v, s, sf })),
    fns: FILE_FNS.map(([n, l, cc, cg]) => ({ n, l, cc, cg, w: (cc / 14) * 100 + '%', fg: cc >= 10 ? 'var(--om-danger)' : cc >= 7 ? 'var(--om-warning)' : 'var(--om-blue)' })),
    months: FILE_MONTHS.map((c, i) => ({ h: (c / 12) * 100 + '%', tip: c + ' commits', bg: i > 8 ? 'var(--om-warning)' : 'var(--om-teal)' })),
    commits: COMMITS.map(([h, a, w, m, p, d]) => ({ h, a, w, m, p, d })),
    imports: FILE_IMPORTS.map(([s, p, c]) => ({ s, p, c })),
    importers: FILE_IMPORTERS.map(([p, c]) => ({ p, c })),
  };
});
const askFile = () => store.go('ask');
const openEditor = () => store.toast('Opened invoice.ts:13 in VS Code');

const tr = computed(() => {
  const fp = S.fsel || 'src/billing/invoice.ts';
  const all = [...FILES.map((x) => x.path), ...FILE_EXTRA];
  const root = { d: {}, f: [] };
  all.forEach((p) => {
    const parts = p.split('/');
    let n = root, acc = '';
    parts.slice(0, -1).forEach((sg) => { acc = acc ? acc + '/' + sg : sg; n.d[sg] = n.d[sg] || { path: acc, d: {}, f: [] }; n = n.d[sg]; });
    n.f.push(p);
  });
  const q = (S.tq || '').toLowerCase();
  const open = S.topen || { src: 1, 'src/billing': 1, 'src/auth': 1, test: 0 };
  const rows = [];
  const icon = (nm) => nm.endsWith('.ts') ? ['mdi-language-typescript', 'var(--om-blue)'] : nm.endsWith('.sql') ? ['mdi-database-outline', 'var(--om-tone-yellow-fg)'] : nm.endsWith('.json') ? ['mdi-code-json', 'var(--om-tone-yellow-fg)'] : nm.endsWith('.yml') ? ['mdi-file-cog-outline', 'var(--om-text-muted)'] : ['mdi-language-markdown-outline', 'var(--om-text-muted)'];
  const hasMatch = (n) => n.f.some((p) => p.toLowerCase().includes(q)) || Object.values(n.d).some(hasMatch);
  const walk = (n, depth) => {
    Object.keys(n.d).sort().forEach((k) => {
      const c = n.d[k];
      if (q && !hasMatch(c)) return;
      const isOpen = q ? true : !!open[c.path];
      rows.push({ key: 'd:' + c.path, name: k, pad: 8 + depth * 14 + 'px', chev: isOpen ? 'mdi-chevron-down' : 'mdi-chevron-right', icon: isOpen ? 'mdi-folder-open-outline' : 'mdi-folder-outline', ifg: 'var(--om-text-label)', fg: 'var(--om-text-value)', font: 'var(--font-sans)', bg: 'transparent', bar: 'transparent', dot: 'transparent', tip: c.path + '/', pick: () => store.setState((s) => ({ topen: { ...(s.topen || open), [c.path]: !isOpen } })) });
      if (isOpen) walk(c, depth + 1);
    });
    n.f.slice().sort().forEach((p) => {
      if (q && !p.toLowerCase().includes(q)) return;
      const nm = p.split('/').pop(), F = FILES.find((x) => x.path === p), sv = F ? sevOf(F) : null, on = p === fp, [ic, ifg] = icon(nm);
      rows.push({ key: 'f:' + p, name: nm, pad: 8 + depth * 14 + 'px', chev: '', icon: ic, ifg, fg: on ? 'var(--om-mint)' : F ? 'var(--om-text)' : 'var(--om-text-muted)', font: 'var(--font-mono)', bg: on ? 'var(--om-mint-tint-strong)' : 'transparent', bar: on ? 'var(--om-mint)' : 'transparent', dot: sv === 'critical' ? 'var(--om-danger)' : sv === 'warning' ? 'var(--om-warning)' : 'transparent', tip: p + (F ? ' — churn ' + F.churn + ', cc ' + F.cx : ''), pick: () => store.setState({ fsel: p, ftab: 'metrics' }) });
    });
  };
  walk(root, 0);
  return { rows, empty: rows.length === 0, q: S.tq || '' };
});
const onQ = (e) => store.setState({ tq: e.target.value });
const collapseAll = () => store.setState({ topen: {}, tq: '' });
</script>

<template>
  <div style="flex:1;min-height:0;display:flex">
    <div style="width:250px;flex-shrink:0;border-right:1px solid var(--om-border);background:var(--om-surface);display:flex;flex-direction:column;min-height:0">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 12px 8px">
        <span style="flex:1;font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Explorer</span>
        <button class="om-ghost-icon" @click="collapseAll" title="Collapse all" style="color:var(--om-text-muted)"><span class="mdi mdi-collapse-all-outline"></span></button>
      </div>
      <div style="padding:0 10px 8px;position:relative"><span class="mdi mdi-magnify" style="position:absolute;left:19px;top:7px;color:var(--om-text-muted);font-size:.85rem"></span><input class="om-input" :value="tr.q" @input="onQ" placeholder="Filter files" style="padding:4px 8px 4px 26px;font-size:.74rem"></div>
      <div style="flex:1;min-height:0;overflow:auto;padding-bottom:8px">
        <div v-for="r in tr.rows" :key="r.key" @click="r.pick" :title="r.tip" v-hover="'background:var(--om-white-04)'" :style="{ display: 'flex', alignItems: 'center', gap: '5px', height: '24px', paddingRight: '10px', paddingLeft: r.pad, cursor: 'pointer', background: r.bg, boxShadow: 'inset 2px 0 0 ' + r.bar, fontSize: '.76rem', color: r.fg }">
          <span :class="'mdi ' + r.chev" style="width:12px;font-size:.85rem;color:var(--om-text-muted)"></span>
          <span :class="'mdi ' + r.icon" :style="{ fontSize: '.9rem', color: r.ifg }"></span>
          <span :style="{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: r.font }">{{ r.name }}</span>
          <span :style="{ width: '6px', height: '6px', borderRadius: '50%', background: r.dot, flexShrink: 0 }"></span>
        </div>
        <div v-if="tr.empty" style="padding:16px;font-size:.74rem;color:var(--om-text-muted);text-align:center">No files match.</div>
      </div>
      <div style="display:flex;gap:10px;padding:7px 12px;border-top:1px solid var(--om-border);font-size:.62rem;color:var(--om-text-muted)">
        <span style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:var(--om-danger)"></span>Hotspot</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:var(--om-warning)"></span>Watch</span>
        <span style="margin-left:auto;font-family:var(--font-mono)">612 files</span>
      </div>
    </div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;min-height:0">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0;flex-wrap:wrap">
        <div style="display:flex;flex-direction:column;gap:4px;margin-right:auto;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:.8rem;color:var(--om-text-muted)"><span>{{ fl.dir }}</span><span>/</span><span style="color:var(--om-text-strong);font-weight:500;font-size:.9rem">{{ fl.name }}</span></div>
          <div style="display:flex;gap:6px;align-items:center">
            <OmBadge v-if="fl.hasSev" kind="flag" :tone="fl.sevTone" icon="fire">{{ fl.sevLabel }}</OmBadge>
            <OmBadge v-if="fl.hasCycle" kind="flag" tone="yellow" icon="sync">{{ fl.cycle }}</OmBadge>
            <span style="font-family:var(--font-mono);font-size:.66rem;color:var(--om-text-muted)">{{ fl.metaLine }}</span>
          </div>
        </div>
        <OmButton variant="secondary" icon="chat-question-outline" @click="askFile">Ask About File</OmButton>
        <OmButton variant="ghost" icon="open-in-new" @click="openEditor">Open in Editor</OmButton>
      </div>
      <div style="flex:1;min-height:0;display:flex">
        <div style="flex:1;min-width:0;display:flex;flex-direction:column;min-height:0;background:var(--om-inset)">
          <div style="display:flex;align-items:center;gap:16px;padding:6px 14px;border-bottom:1px solid var(--om-border);font-size:.64rem;color:var(--om-text-muted)">
            <span style="display:flex;align-items:center;gap:5px"><span style="width:12px;height:6px;border-radius:1px;background:#b8553c"></span>Complexity per line</span>
            <span style="display:flex;align-items:center;gap:5px">Blame age <span style="width:6px;height:10px;background:#6dd4a0"></span><span style="width:6px;height:10px;background:#4fa077"></span><span style="width:6px;height:10px;background:#444c56"></span><span style="width:6px;height:10px;background:#2d333b"></span> new → old</span>
            <span style="margin-left:auto;font-family:var(--font-mono)">⌘G go to line · ⌘F find</span>
          </div>
          <div v-if="fl.noCode" style="flex:1;min-height:0;overflow:auto;padding:6px 0;font-family:var(--font-mono);font-size:.74rem;line-height:1.7">
            <div style="padding:40px 24px;font-family:var(--font-sans);font-size:.8rem;color:var(--om-text-muted);text-align:center">Source preview isn’t included in this prototype for {{ fl.name }}. Metrics on the right are live.</div>
          </div>
          <div v-else style="flex:1;min-height:0;display:flex;flex-direction:column;font-family:var(--font-mono);font-size:.74rem;line-height:1.7">
            <div style="flex:1;min-height:0">
              <CodeView variant="file" :code="fl.src[0]" :start="fl.src[1]" :blame="fl.blame" />
            </div>
            <div :style="{ display: fl.foldDisp, alignItems: 'center', gap: '8px', margin: '6px 0 10px 80px', padding: '4px 10px', width: 'fit-content', borderRadius: '4px', background: 'var(--om-card)', border: '1px solid var(--om-border)', fontSize: '.68rem', color: 'var(--om-text-muted)', cursor: 'pointer' }"><span class="mdi mdi-unfold-more-horizontal"></span>{{ fl.more }}</div>
          </div>
        </div>
        <div style="width:380px;flex-shrink:0;border-left:1px solid var(--om-border);background:var(--om-surface);display:flex;flex-direction:column;min-height:0">
          <div style="display:flex;border-bottom:1px solid var(--om-border);padding:0 8px">
            <button v-for="t in fl.tabs" :key="t.id" @click="t.pick" :style="{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '.76rem', fontWeight: 500, padding: '10px 10px 8px', cursor: 'pointer', color: t.fg, borderBottom: '2px solid ' + t.bd }">{{ t.label }}</button>
          </div>
          <div style="flex:1;min-height:0;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:14px">
            <template v-if="fl.isMetrics">
              <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px">
                <div v-for="m in fl.tiles" :key="m.k" style="background:var(--om-card);border:1px solid var(--om-border);border-radius:6px;padding:8px 10px;display:flex;flex-direction:column;gap:1px">
                  <span style="font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">{{ m.k }}</span>
                  <span style="font-family:var(--font-mono);font-size:1rem;color:var(--om-text-strong)">{{ m.v }}</span>
                  <span :style="{ fontSize: '.6rem', color: m.sf }">{{ m.s }}</span>
                </div>
              </div>
              <div style="display:flex;flex-direction:column">
                <div style="display:grid;grid-template-columns:minmax(0,1fr) 62px 70px 30px;gap:8px;padding-bottom:6px;font-size:.58rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)"><span>Function</span><span>Lines</span><span>Cyclomatic</span><span style="text-align:right">Cog</span></div>
                <div v-for="f in fl.fns" :key="f.n" style="display:grid;grid-template-columns:minmax(0,1fr) 62px 70px 30px;gap:8px;padding:6px 0;border-top:1px solid var(--om-border);align-items:center;font-family:var(--font-mono);font-size:.7rem">
                  <span style="color:var(--om-text-strong);overflow:hidden;text-overflow:ellipsis">{{ f.n }}</span><span style="color:var(--om-text-muted)">{{ f.l }}</span>
                  <span style="display:flex;align-items:center;gap:5px"><span style="width:20px;text-align:right;color:var(--om-text-value)">{{ f.cc }}</span><span style="flex:1;height:4px;border-radius:2px;background:var(--om-inset);overflow:hidden"><span :style="{ display: 'block', height: '100%', width: f.w, background: f.fg }"></span></span></span>
                  <span style="text-align:right;color:var(--om-text-muted)">{{ f.cg }}</span>
                </div>
              </div>
            </template>
            <template v-if="fl.isHistory">
              <div style="display:flex;flex-direction:column;gap:6px">
                <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Commits per Month</span>
                <div style="height:50px;display:flex;align-items:flex-end;gap:3px"><div v-for="(m, i) in fl.months" :key="i" :title="m.tip" :style="{ flex: 1, height: m.h, background: m.bg, borderRadius: '1px' }"></div></div>
                <div style="display:flex;justify-content:space-between;font-family:var(--font-mono);font-size:.58rem;color:var(--om-text-placeholder)"><span>Nov ’25</span><span>Oct ’26</span></div>
              </div>
              <div style="display:flex;flex-direction:column">
                <div v-for="c in fl.commits" :key="c.h" style="display:flex;flex-direction:column;gap:3px;padding:8px 0;border-top:1px solid var(--om-border)">
                  <span style="font-size:.76rem;color:var(--om-text-strong);line-height:1.4">{{ c.m }}</span>
                  <div style="display:flex;gap:8px;font-family:var(--font-mono);font-size:.64rem;color:var(--om-text-muted)"><span style="color:var(--om-blue)">{{ c.h }}</span><span>{{ c.a }}</span><span>{{ c.w }}</span><span style="margin-left:auto;color:var(--om-success)">{{ c.p }}</span><span style="color:var(--om-danger)">{{ c.d }}</span></div>
                </div>
              </div>
            </template>
            <template v-if="fl.isDeps">
              <div style="display:flex;flex-direction:column;gap:6px">
                <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Imports · 5</span>
                <div v-for="i in fl.imports" :key="i.s" style="display:flex;flex-direction:column;padding:6px 8px;border-radius:4px;background:var(--om-card);border:1px solid var(--om-border)"><span style="font-family:var(--font-mono);font-size:.72rem;color:var(--om-text-strong)">{{ i.s }}</span><span style="font-family:var(--font-mono);font-size:.62rem;color:var(--om-text-muted)">{{ i.p }}</span></div>
              </div>
              <div style="display:flex;flex-direction:column;gap:6px">
                <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Imported By · 5</span>
                <div v-for="i in fl.importers" :key="i.p" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:4px;background:var(--om-card);border:1px solid var(--om-border)"><span style="font-family:var(--font-mono);font-size:.72rem;color:var(--om-text-strong);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis">{{ i.p }}</span><OmBadge v-if="i.c" kind="flag" tone="red" icon="sync">CYCLE</OmBadge></div>
              </div>
            </template>
            <div v-if="fl.isSummary" style="border:1px dashed var(--ai-line);background:var(--ai-bg);border-radius:6px;padding:12px 14px;display:flex;flex-direction:column;gap:10px">
              <div style="display:flex;justify-content:space-between;align-items:center"><span style="display:flex;align-items:center;gap:4px;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--ai)"><span class="mdi mdi-creation"></span>File summary · AI</span><button class="om-ghost-icon" title="Regenerate" style="color:var(--ai)"><span class="mdi mdi-refresh"></span></button></div>
              <span style="font-size:.8rem;line-height:1.6;color:var(--om-text);text-wrap:pretty">Turns an order into invoice lines, applies tax and returns totals. buildInvoice is the entry point; the rest of the file handles credits, finalisation, voiding and the Stripe payload.</span>
              <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Watch out for</span>
              <div style="display:flex;flex-direction:column;gap:6px;font-size:.76rem;line-height:1.5;color:var(--om-text)">
                <div style="display:flex;gap:6px"><span style="color:var(--ai)">·</span><span>Proration and bundles are handled in the same loop, so a change to one often breaks the other (lines 17–31).</span></div>
                <div style="display:flex;gap:6px"><span style="color:var(--ai)">·</span><span>Invalid tax is zeroed rather than raised (lines 36–39) — callers can’t tell.</span></div>
                <div style="display:flex;gap:6px"><span style="color:var(--ai)">·</span><span>Imported by orders/checkout.ts while importing order state — part of the billing ↔ orders cycle.</span></div>
              </div>
              <span style="font-size:.62rem;color:var(--om-text-muted)">Generated 2h ago from this file and 12 recent commits</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

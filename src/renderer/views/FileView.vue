<script setup>
// Files (prototype lines 1254–1384; logic: more() "// file" and the explorer tree block).
// The explorer tree and the file content come from the files:tree and
// files:content IPC queries (FR-008). Metrics, history, dependencies and the AI
// summary arrive in later epics; their panels show "Not analysed yet" (FR-010).
import { computed, onMounted, ref, watch } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import OmButton from '../components/ds/OmButton.vue';
import CodeView from '../components/CodeView.vue';
import { tabs } from '../lib/viewHelpers.js';
import { fetchFileTree, fetchFileContent } from '../data/insightData.js';
import { languageLabel, fileIcon } from '../lib/codeLanguage.js';

const NOT_YET = 'Not analysed yet';
const PANEL_HINTS = {
  metrics: 'Function metrics and complexity come from the syntax tree once code analysis runs.',
  history: 'Commits, churn and blame for this file arrive with git history extraction.',
  deps: 'Imports and importers arrive with dependency analysis.',
  summary: 'AI file summaries arrive with AI enrichment.',
};

const store = useInsightStore();
const S = store.state;

const tree = ref(null);
const file = ref(null);
const loading = ref(false);

onMounted(async () => {
  tree.value = await fetchFileTree();
});

let seq = 0;
watch(
  () => S.fsel,
  async (fp) => {
    const s = ++seq;
    if (!fp) { file.value = null; loading.value = false; return; }
    loading.value = true;
    const res = await fetchFileContent(fp);
    if (s !== seq) return;
    file.value = res;
    loading.value = false;
  },
  { immediate: true },
);

const fmtBytes = (b) => (b < 1024 ? b + ' B' : b < 1024 * 1024 ? (b / 1024).toFixed(1) + ' KB' : (b / 1024 / 1024).toFixed(1) + ' MB');

const fl = computed(() => {
  const fp = S.fsel || '';
  const F = file.value;
  const fname = fp ? fp.split('/').pop() : '—';
  const fdir = fp ? fp.split('/').slice(0, -1).join('/') || '.' : '';
  const state = !fp ? 'none' : loading.value ? 'loading' : !F ? 'missing' : F.isBinary ? 'binary' : F.content == null ? 'missing' : 'code';
  const metaLine = F
    ? [F.lines.toLocaleString() + ' lines', languageLabel(F.language), fmtBytes(F.bytes), F.isBinary ? 'binary' : '', F.isGenerated ? 'generated' : ''].filter(Boolean).join(' · ')
    : state === 'loading' ? 'Loading…' : fp ? 'Not tracked at HEAD' : 'Select a file in the explorer';
  const ftab = S.ftab || 'metrics';
  return {
    state, name: fname, dir: fdir, metaLine,
    code: state === 'code' ? F.content : '',
    lang: F?.language ?? null,
    paneNote:
      state === 'none' ? 'Select a file in the explorer to read its code.'
        : state === 'loading' ? 'Loading…'
          : state === 'binary' ? fname + ' is a binary file and is not viewable (' + fmtBytes(F.bytes) + ').'
            : fname + ' is not tracked at HEAD, or its content was not stored.',
    tabs: tabs([['metrics', 'Metrics'], ['history', 'History'], ['deps', 'Dependencies'], ['summary', 'Summary']], ftab, 'ftab', store.setState),
    panelHint: PANEL_HINTS[ftab] || PANEL_HINTS.metrics,
  };
});
const askFile = () => store.go('ask');
const openEditor = () => store.toast('Open in Editor is not available yet');

const allDirs = (node, out = []) => {
  for (const c of node.children || []) if (c.type === 'dir') { out.push(c.path); allDirs(c, out); }
  return out;
};

const tr = computed(() => {
  const fp = S.fsel || '';
  const root = tree.value;
  const q = (S.tq || '').toLowerCase();
  const open = S.topen;
  const rows = [];
  const hasMatch = (n) => n.type === 'file' ? n.path.toLowerCase().includes(q) : n.children.some(hasMatch);
  const isOpen = (c, depth) =>
    q ? true : open && Object.prototype.hasOwnProperty.call(open, c.path) ? !!open[c.path] : depth === 0 || (!!fp && fp.startsWith(c.path + '/'));
  const walk = (n, depth) => {
    for (const c of n.children) {
      if (c.type === 'dir') {
        if (q && !hasMatch(c)) continue;
        const o = isOpen(c, depth);
        rows.push({ key: 'd:' + c.path, name: c.name, pad: 8 + depth * 14 + 'px', chev: o ? 'mdi-chevron-down' : 'mdi-chevron-right', icon: o ? 'mdi-folder-open-outline' : 'mdi-folder-outline', ifg: 'var(--om-text-label)', fg: 'var(--om-text-value)', font: 'var(--font-sans)', bg: 'transparent', bar: 'transparent', dot: 'transparent', tip: c.path + '/', pick: () => store.setState((s) => ({ topen: { ...(s.topen || {}), [c.path]: !o } })) });
        if (o) walk(c, depth + 1);
      } else {
        if (q && !c.path.toLowerCase().includes(q)) continue;
        const on = c.path === fp, [ic, ifg] = fileIcon(c.language, c.isBinary);
        rows.push({ key: 'f:' + c.path, name: c.name, pad: 8 + depth * 14 + 'px', chev: '', icon: ic, ifg, fg: on ? 'var(--om-mint)' : c.isBinary || c.isGenerated ? 'var(--om-text-muted)' : 'var(--om-text)', font: 'var(--font-mono)', bg: on ? 'var(--om-mint-tint-strong)' : 'transparent', bar: on ? 'var(--om-mint)' : 'transparent', dot: 'transparent', tip: c.path, pick: () => store.setState({ fsel: c.path, ftab: 'metrics' }) });
      }
    }
  };
  if (root) walk(root, 0);
  return { rows, empty: rows.length === 0, emptyNote: root ? 'No files match.' : 'No analysed repository open.', q: S.tq || '', count: root ? root.fileCount.toLocaleString() + ' files' : '— files' };
});
const onQ = (e) => store.setState({ tq: e.target.value });
const collapseAll = () => store.setState({ topen: Object.fromEntries(allDirs(tree.value || {}).map((p) => [p, false])), tq: '' });
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
        <div v-if="tr.empty" style="padding:16px;font-size:.74rem;color:var(--om-text-muted);text-align:center">{{ tr.emptyNote }}</div>
      </div>
      <div style="display:flex;gap:10px;padding:7px 12px;border-top:1px solid var(--om-border);font-size:.62rem;color:var(--om-text-muted)">
        <span style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:var(--om-danger)"></span>Hotspot</span>
        <span style="display:flex;align-items:center;gap:4px"><span style="width:6px;height:6px;border-radius:50%;background:var(--om-warning)"></span>Watch</span>
        <span style="margin-left:auto;font-family:var(--font-mono)">{{ tr.count }}</span>
      </div>
    </div>
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;min-height:0">
      <div style="display:flex;align-items:center;gap:12px;padding:10px 20px;border-bottom:1px solid var(--om-border);flex-shrink:0;flex-wrap:wrap">
        <div style="display:flex;flex-direction:column;gap:4px;margin-right:auto;min-width:0">
          <div style="display:flex;align-items:center;gap:6px;font-family:var(--font-mono);font-size:.8rem;color:var(--om-text-muted)"><span>{{ fl.dir }}</span><span v-if="fl.dir">/</span><span style="color:var(--om-text-strong);font-weight:500;font-size:.9rem">{{ fl.name }}</span></div>
          <div style="display:flex;gap:6px;align-items:center">
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
            <span style="display:flex;align-items:center;gap:5px">Blame age <span style="width:6px;height:10px;background:#6dd4a0"></span><span style="width:6px;height:10px;background:#4fa077"></span><span style="width:6px;height:10px;background:#444c56"></span><span style="width:6px;height:10px;background:#2d333b"></span> new → old · {{ NOT_YET.toLowerCase() }}</span>
            <span style="margin-left:auto;font-family:var(--font-mono)">⌘G go to line · ⌘F find</span>
          </div>
          <div v-if="fl.state !== 'code'" style="flex:1;min-height:0;overflow:auto;padding:6px 0;font-family:var(--font-mono);font-size:.74rem;line-height:1.7">
            <div style="padding:40px 24px;font-family:var(--font-sans);font-size:.8rem;color:var(--om-text-muted);text-align:center">{{ fl.paneNote }}</div>
          </div>
          <div v-else style="flex:1;min-height:0;display:flex;flex-direction:column;font-family:var(--font-mono);font-size:.74rem;line-height:1.7">
            <div style="flex:1;min-height:0">
              <CodeView variant="file" :code="fl.code" :start="1" :language="fl.lang" />
            </div>
          </div>
        </div>
        <div style="width:380px;flex-shrink:0;border-left:1px solid var(--om-border);background:var(--om-surface);display:flex;flex-direction:column;min-height:0">
          <div style="display:flex;border-bottom:1px solid var(--om-border);padding:0 8px">
            <button v-for="t in fl.tabs" :key="t.id" @click="t.pick" :style="{ border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '.76rem', fontWeight: 500, padding: '10px 10px 8px', cursor: 'pointer', color: t.fg, borderBottom: '2px solid ' + t.bd }">{{ t.label }}</button>
          </div>
          <div style="flex:1;min-height:0;overflow:auto;padding:14px 16px;display:flex;flex-direction:column;gap:14px">
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;padding:28px 12px;text-align:center">
              <span class="mdi mdi-flask-empty-outline" style="font-size:1.4rem;color:var(--om-text-placeholder)"></span>
              <span style="font-size:.8rem;color:var(--om-text-strong)">{{ NOT_YET }}</span>
              <span style="font-size:.7rem;color:var(--om-text-muted);line-height:1.5">{{ fl.panelHint }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

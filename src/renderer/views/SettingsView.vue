<script setup>
// Settings screen (prototype lines 1532–1700; view-model in more() "// settings" and orVals()),
// plus the OpenRouter model picker dialog (prototype lines 1709–1751), teleported to the app root.
import { computed } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import {
  OR_MODELS, OR_DEF,
  SETTINGS_TOGGLES, SETTINGS_CLIS, SETTINGS_PROVIDERS, SETTINGS_ACTIVE_NAMES, SETTINGS_SENT_LOCAL,
  SETTINGS_SENT_REMOTE, SETTINGS_NEVER, SETTINGS_LANGS, SETTINGS_THEMES, SETTINGS_SWATCHES, SETTINGS_KEYS,
} from '../data/insightData.js';
import OmButton from '../components/ds/OmButton.vue';
import OmBadge from '../components/ds/OmBadge.vue';
import OmPrototypeBanner from '../components/ds/OmPrototypeBanner.vue';

const store = useInsightStore();
const S = store.state;

// Prototype orVals(S).
const or = computed(() => {
  const sel = S.orModels || OR_DEF;
  const def = S.orDefault && sel.includes(S.orDefault) ? S.orDefault : sel[0];
  const hasKey = !S.orCleared, full = sel.length >= 5;
  const setSel = (next) => store.setState((s) => ({ orModels: next, orDefault: next.includes(s.orDefault) ? s.orDefault : next[0] }));
  const by = Object.fromEntries(OR_MODELS.map((m) => [m.slug, m]));
  const price = (m) => (m.free ? 'Free' : '$' + m.pin + ' / $' + m.pout);
  const q = (S.mq || '').toLowerCase(), f = S.mfilter || 'all', so = S.msort || 'featured';
  let list = OR_MODELS.filter((m) => (!q || (m.name + m.slug).toLowerCase().includes(q)) && (f === 'all' || (f === 'preferred' && sel.includes(m.slug)) || (f === 'sota' && m.sota) || (f === 'free' && m.free)));
  const sk = { featured: (m) => m.rank, price: (m) => m.pin + m.pout, context: (m) => -m.ctxN, name: (m) => m.name }[so];
  list = [...list].sort((a, b) => { const x = sk(a), y = sk(b); return x > y ? 1 : x < y ? -1 : 0; });
  const tab = (k, l, n) => ({ k, l, n, bg: f === k ? 'var(--om-mint-tint-strong)' : 'transparent', fg: f === k ? 'var(--om-mint)' : 'var(--om-text-muted)', bd: f === k ? 'rgba(109,212,160,.35)' : 'var(--om-border)', pick: () => store.setState({ mfilter: k }) });
  return {
    hasKey, noKey: !hasKey, keyMask: 'sk-or-v1-••••••••afbc', input: S.orInput || '',
    onInput: (e) => store.setState({ orInput: e.target.value }),
    canSave: !!(S.orInput || '').trim(), cantSave: !(S.orInput || '').trim(),
    save: () => { if (!(S.orInput || '').trim()) return; store.setState({ orCleared: false, orInput: '' }); store.toast('OpenRouter key verified and saved to the OS keychain'); },
    clear: () => { store.setState({ orCleared: true, orInput: '' }); store.toast('OpenRouter key removed from the keychain'); },
    listOp: hasKey ? 1 : 0.45, count: sel.length, full, notFull: !full,
    models: sel.map((slug) => {
      const m = by[slug] || { name: slug, vendor: '', ctx: '', free: false };
      return { slug, meta: (m.ctx ? m.ctx + ' ctx · ' : '') + price(m), isDef: slug === def, notDef: slug !== def, setDef: () => hasKey && store.setState({ orDefault: slug }), rm: () => hasKey && setSel(sel.filter((x) => x !== slug)) };
    }),
    empty: sel.length === 0,
    openDlg: () => hasKey && store.setState({ mdlg: true, mq: '', mfilter: 'all' }),
    dlg: {
      open: !!S.mdlg, close: () => store.setState({ mdlg: false }), q: S.mq || '',
      onQ: (e) => store.setState({ mq: e.target.value }), sort: so, onSort: (e) => store.setState({ msort: e.target.value }),
      tabs: [tab('all', 'All', OR_MODELS.length), tab('preferred', 'Preferred', sel.length), tab('sota', 'SOTA', OR_MODELS.filter((m) => m.sota).length), tab('free', 'Free', OR_MODELS.filter((m) => m.free).length)],
      full, count: sel.length, empty: list.length === 0,
      rows: list.map((m) => {
        const on = sel.includes(m.slug), dis = !on && full;
        return {
          slug: m.slug, name: m.name, initial: m.vendor[0], meta: m.vendor + ' · ' + m.ctx + ' ctx · ' + price(m), free: m.free, sota: m.sota, on,
          bd: on ? 'var(--om-mint)' : 'var(--om-border)', bg: on ? 'var(--om-mint-tint)' : 'var(--om-card)', ic: on ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline', icfg: on ? 'var(--om-mint)' : 'var(--om-text-muted)',
          avBg: on ? 'var(--om-mint)' : 'var(--om-gray-600)', avFg: on ? '#11151a' : 'var(--om-text-strong)', op: dis ? 0.45 : 1, cur: dis ? 'not-allowed' : 'pointer',
          toggle: () => { if (on) setSel(sel.filter((x) => x !== m.slug)); else if (!full) setSel([...sel, m.slug]); },
        };
      }),
    },
  };
});

const st = computed(() => {
  const theme = store.theme;
  const tg = S.tg || SETTINGS_TOGGLES;
  const tgl = (k) => () => store.setState(() => ({ tg: { ...tg, [k]: !tg[k] } }));
  const T = (k) => ({ bg: tg[k] ? 'var(--om-teal-btn)' : 'var(--om-gray-500)', kl: tg[k] ? '16px' : '2px', pick: tgl(k) });
  const PT = S.ptab || S.llm;
  const c = SETTINGS_PROVIDERS.find((x) => x[0] === PT);
  return {
    isLocal: PT === 'local', isCloud: PT === 'cloud', isOR: PT === 'openrouter', isCli: PT === 'cli',
    clis: SETTINGS_CLIS.map(([id, l, bin, ver, path]) => {
      const on = (S.cli || 'claude') === id, found = !!path;
      return {
        id, l, bin, ver, path, found, missing: !found, status: found ? 'v' + ver + ' · signed in' : 'Not found on PATH', sfg: found ? 'var(--om-success)' : 'var(--om-text-muted)',
        radio: on ? 'mdi-radiobox-marked' : 'mdi-radiobox-blank', rfg: on ? 'var(--om-mint)' : 'var(--om-text-muted)', bd: on ? 'var(--om-mint)' : 'var(--om-border)', bg: on ? 'var(--om-mint-tint)' : 'transparent', op: found ? 1 : 0.6,
        pick: () => found && store.setState({ cli: id }),
      };
    }),
    cliTest: () => store.toast('claude responded in 1.8 s · non-interactive mode OK'),
    cards: SETTINGS_PROVIDERS.map(([id, t, d, ic]) => {
      const cur = PT === id, act = S.llm === id;
      return { id, t, d, ic, act, cur, fg: cur ? 'var(--om-mint)' : 'var(--om-text-muted)', bd: cur ? 'var(--om-mint)' : 'transparent', dot: act ? 'var(--om-mint)' : 'transparent', pick: () => store.setState({ ptab: id }) };
    }),
    pane: { t: c[1], d: c[2], ic: c[3], isActive: S.llm === PT, notActive: S.llm !== PT, use: () => { store.setState({ llm: PT }); store.toast(c[1] + ' is now the active LLM provider'); } },
    activeName: SETTINGS_ACTIVE_NAMES[S.llm],
    sent: S.llm === 'local' ? SETTINGS_SENT_LOCAL : SETTINGS_SENT_REMOTE,
    dest: S.llm === 'local' ? 'localhost:11434 — never leaves this machine'
      : S.llm === 'cli' ? 'the CLI’s own provider (' + ((S.cli || 'claude') === 'codex' ? 'OpenAI' : 'Anthropic') + '), under your existing CLI login'
        : S.llm === 'openrouter' ? 'openrouter.ai over TLS → routed to ' + (S.orDefault || (S.orModels || OR_DEF)[0] || '—').split('/')[0] + ' · zero data retention on'
          : 'api.anthropic.com over TLS — zero-retention endpoint',
    never: SETTINGS_NEVER,
    tHistory: T('history'), tSecrets: T('secrets'), tSummaries: T('summaries'), tBranch: T('branch'), tConfirm: T('confirm'), tRedact: T('redact'),
    ignored: S.ignored.map((p) => ({ p, rm: () => store.setState((s) => ({ ignored: s.ignored.filter((x) => x !== p) })) })),
    addIgnored: (e) => {
      if (e.key === 'Enter' && e.target.value.trim()) {
        const v = e.target.value.trim();
        e.target.value = '';
        store.setState((s) => ({ ignored: [...s.ignored, v] }));
      }
    },
    langs: SETTINGS_LANGS.map(([l, cnt, on]) => ({ l, c: cnt, ic: on ? 'mdi-checkbox-marked' : 'mdi-checkbox-blank-outline', fg: on ? 'var(--om-mint)' : 'var(--om-text-muted)' })),
    themes: SETTINGS_THEMES.map(([id, l, ic]) => {
      const on = id === theme;
      return { id, l, ic, fg: on ? '#fff' : 'var(--om-text-muted)', bg: on ? 'var(--om-blue-action)' : 'transparent', pick: () => store.setState({ theme: id }) };
    }),
    swatches: SETTINGS_SWATCHES.map((col) => ({ c: col, ring: S.tbColor === col ? '0 0 0 2px var(--om-card), 0 0 0 4px var(--om-text-strong)' : 'none', pick: () => store.setState({ tbColor: col }) })),
    tbReset: () => store.setState({ tbColor: null }),
    tbResetRing: !S.tbColor ? '0 0 0 2px var(--om-card), 0 0 0 4px var(--om-text-strong)' : 'none',
    keys: SETTINGS_KEYS.map(([l, k]) => ({ l, k })),
    test: () => store.toast('Ollama reachable · 3 models installed · 41 ms'),
  };
});

const toggleStyle = (t) => ({ width: '34px', height: '18px', borderRadius: '999px', background: t.bg, position: 'relative', cursor: 'pointer', flexShrink: 0 });
const knobStyle = (t) => ({ position: 'absolute', top: '2px', left: t.kl, width: '14px', height: '14px', borderRadius: '50%', background: '#fff', transition: 'left .15s' });
</script>

<template>
  <div style="flex:1;min-height:0;overflow:auto">
    <div style="max-width:820px;margin:0 auto;padding:24px 28px 48px;display:flex;flex-direction:column;gap:28px">
      <div style="font-size:1.25rem;font-weight:600;color:var(--om-text-strong)">Settings</div>
      <div style="display:flex;flex-direction:column;gap:12px">
        <div style="display:flex;flex-direction:column;gap:2px"><span style="font-size:.95rem;font-weight:600;color:var(--om-text-strong)">LLM Provider</span><span style="font-size:.76rem;color:var(--om-text-muted)">Used for summaries, Q&amp;A, tours and explanations. Deterministic analysis never uses an LLM.</span></div>
        <OmPrototypeBanner style="border-radius:6px;border-bottom:none" />
        <div style="display:flex;align-items:flex-end;border-bottom:1px solid var(--om-border);gap:4px">
          <button v-for="c in st.cards" :key="c.id" @click="c.pick" v-hover="'color:var(--om-text-strong)'" :style="{ display: 'flex', alignItems: 'center', gap: '7px', border: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 500, padding: '9px 14px 8px', cursor: 'pointer', color: c.fg, borderBottom: '2px solid ' + c.bd, marginBottom: '-1px', whiteSpace: 'nowrap' }">
            <span :class="'mdi mdi-' + c.ic"></span>{{ c.t }}<span title="Active provider" :style="{ width: '6px', height: '6px', borderRadius: '50%', background: c.dot }"></span>
          </button>
          <span style="margin-left:auto;padding-bottom:9px;font-size:.68rem;color:var(--om-text-muted);white-space:nowrap">Active: <span style="color:var(--om-mint);font-weight:500">{{ st.activeName }}</span></span>
        </div>
        <div style="display:flex;align-items:center;gap:12px">
          <span :class="'mdi mdi-' + st.pane.ic" style="font-size:1.2rem;color:var(--om-text-muted)"></span>
          <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:.88rem;font-weight:600;color:var(--om-text-strong)">{{ st.pane.t }}</span><span style="font-size:.74rem;color:var(--om-text-muted)">{{ st.pane.d }}</span></div>
          <OmBadge v-if="st.pane.isActive" kind="flag" tone="green" icon="check">ACTIVE</OmBadge>
          <OmButton v-if="st.pane.notActive" variant="primary" icon="swap-horizontal" @click="st.pane.use">Use This Provider</OmButton>
        </div>
        <div v-if="st.isLocal" style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:14px;display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr) auto;gap:10px;align-items:end">
          <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Endpoint</span><input class="om-input" value="http://localhost:11434" style="font-family:var(--font-mono);font-size:.76rem"></label>
          <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Model</span><select class="om-select om-select--md" style="height:36px;font-family:var(--font-mono)"><option>llama3.1:8b</option><option>qwen2.5-coder:14b</option><option>deepseek-coder-v2:16b</option></select></label>
          <OmButton variant="secondary" icon="lan-connect" @click="st.test">Test</OmButton>
          <span style="grid-column:1/-1;display:flex;align-items:center;gap:6px;font-size:.72rem;color:var(--om-success)"><span class="mdi mdi-check-circle-outline"></span>Connected · 3 models installed · 41 ms</span>
        </div>
        <div v-if="st.isOR" style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px">
          <div style="padding:14px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:flex-start;gap:12px">
              <div style="flex:1;display:flex;flex-direction:column;gap:3px"><span style="font-size:.86rem;font-weight:600;color:var(--om-text-strong)">OpenRouter API Key</span><span style="font-size:.74rem;color:var(--om-text-muted);line-height:1.45;text-wrap:pretty">Stored in the OS keychain. Routes every request — Anthropic, OpenAI, Google, open-source models — through one endpoint.</span></div>
              <span v-if="or.hasKey" style="display:flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:.68rem;padding:2px 9px;border-radius:999px;background:var(--om-tone-green-bg);color:var(--om-tone-green-fg);white-space:nowrap"><span class="mdi mdi-key-variant"></span>{{ or.keyMask }}</span>
              <OmBadge v-if="or.noKey" kind="flag" tone="neutral">NO KEY</OmBadge>
            </div>
            <div style="display:flex;gap:8px;align-items:center">
              <input class="om-input" type="password" :value="or.input" @input="or.onInput" :placeholder="or.keyMask" style="flex:1;font-family:var(--font-mono);font-size:.76rem">
              <OmButton variant="primary" :disabled="or.cantSave" @click="or.save">Save</OmButton>
              <OmButton variant="secondary" @click="or.clear">Clear</OmButton>
            </div>
          </div>
          <div style="padding:14px;display:flex;flex-direction:column;gap:10px">
            <div style="display:flex;align-items:flex-start;gap:12px">
              <div style="flex:1;display:flex;flex-direction:column;gap:3px"><span style="font-size:.86rem;font-weight:600;color:var(--om-text-strong)">Preferred Models</span><span style="font-size:.74rem;color:var(--om-text-muted);line-height:1.45">Pick up to 5 OpenRouter models (vendor/model slugs) and mark one as default. Disabled until a valid API key is saved.</span></div>
              <OmButton variant="primary" icon="magnify" :disabled="or.noKey" @click="or.openDlg">Select Models…</OmButton>
            </div>
            <div :style="{ display: 'flex', flexDirection: 'column', gap: '6px', opacity: or.listOp }">
              <div v-for="m in or.models" :key="m.slug" style="display:flex;align-items:center;gap:10px;padding:8px 8px 8px 12px;border-radius:6px;background:var(--om-card-raised);border:1px solid var(--om-border)">
                <span v-if="m.isDef" class="mdi mdi-star" style="color:var(--om-mint);font-size:.85rem"></span>
                <span style="font-family:var(--font-mono);font-size:.78rem;color:var(--om-text-strong);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ m.slug }}</span>
                <span style="font-family:var(--font-mono);font-size:.64rem;color:var(--om-text-muted);white-space:nowrap">{{ m.meta }}</span>
                <OmBadge v-if="m.isDef" kind="flag" tone="green">DEFAULT</OmBadge>
                <button v-if="m.notDef" @click="m.setDef" class="om-square om-square--sm" style="font-family:inherit;font-size:.68rem;font-weight:500">Set Default</button>
                <button @click="m.rm" class="om-square om-square--sm" title="Remove from preferred"><span class="mdi mdi-trash-can-outline"></span></button>
              </div>
              <div v-if="or.empty" style="padding:14px;text-align:center;font-size:.76rem;color:var(--om-text-muted);border:1px dashed var(--om-border);border-radius:6px">No models selected. Ask falls back to the local model.</div>
            </div>
            <span v-if="or.full" style="font-size:.7rem;color:var(--om-text-muted)">Limit of 5 reached.</span>
            <span v-if="or.notFull" style="font-size:.7rem;color:var(--om-text-muted)">{{ or.count }} of 5 selected.</span>
          </div>
        </div>
        <div v-if="st.isCli" style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:12px">
          <div style="display:flex;flex-direction:column;gap:3px"><span style="font-size:.86rem;font-weight:600;color:var(--om-text-strong)">Detected CLIs</span><span style="font-size:.74rem;color:var(--om-text-muted);line-height:1.45">Runs the CLI non-interactively with a read-only prompt. No API key is stored here — the CLI uses its own login and billing.</span></div>
          <div style="display:flex;flex-direction:column;gap:6px">
            <div v-for="c in st.clis" :key="c.id" @click="c.pick" :style="{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '6px', border: '1px solid ' + c.bd, background: c.bg, opacity: c.op, cursor: 'pointer' }">
              <span :class="'mdi ' + c.radio" :style="{ color: c.rfg, fontSize: '1rem' }"></span>
              <span style="font-size:.82rem;font-weight:500;color:var(--om-text-strong);width:110px">{{ c.l }}</span>
              <span style="font-family:var(--font-mono);font-size:.7rem;color:var(--om-text-muted);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ c.path }}</span>
              <span :style="{ fontSize: '.7rem', color: c.sfg }">{{ c.status }}</span>
              <span v-if="c.missing" style="font-family:var(--font-mono);font-size:.64rem;color:var(--om-text-muted)">npm i -g @google/gemini-cli</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:10px;align-items:end">
            <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Command</span><input class="om-input" value="claude -p --output-format json --allowedTools Read" style="font-family:var(--font-mono);font-size:.74rem"></label>
            <OmButton variant="secondary" icon="console" @click="st.cliTest">Test</OmButton>
          </div>
          <div style="display:flex;gap:8px;padding:8px 12px;border-radius:6px;background:var(--om-tone-yellow-bg);color:var(--om-tone-yellow-fg);font-size:.72rem;line-height:1.45"><span class="mdi mdi-alert-outline"></span><span>The CLI runs locally but sends prompts to its own cloud provider. It is restricted to read-only tools inside this repository.</span></div>
        </div>
        <div v-if="st.isCloud" style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;padding:14px;display:flex;flex-direction:column;gap:12px">
          <div style="display:grid;grid-template-columns:200px minmax(0,1fr);gap:10px">
            <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Provider</span><select class="om-select om-select--md" style="height:36px"><option>Anthropic</option><option>OpenAI</option><option>Azure OpenAI</option></select></label>
            <label style="display:flex;flex-direction:column;gap:4px"><span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">API Key</span><input class="om-input" type="password" value="sk-ant-xxxxxxxxxxxxxxxx" style="font-family:var(--font-mono);font-size:.76rem"></label>
          </div>
          <span style="font-size:.68rem;color:var(--om-text-muted)">Stored in the OS keychain. Never written to disk or logs.</span>
          <div style="display:flex;align-items:center;gap:10px"><div @click="st.tConfirm.pick" :style="toggleStyle(st.tConfirm)"><div :style="knobStyle(st.tConfirm)"></div></div><span style="font-size:.8rem;color:var(--om-text)">Show exactly what will be sent and ask before each request</span></div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px">
          <div style="border-radius:8px;padding:12px 14px;background:var(--om-tone-blue-bg);display:flex;flex-direction:column;gap:6px">
            <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-tone-blue-fg)">Sent per request</span>
            <div v-for="s in st.sent" :key="s" style="display:flex;gap:6px;font-size:.76rem;color:var(--om-text)"><span class="mdi mdi-arrow-right" style="color:var(--om-tone-blue-fg)"></span>{{ s }}</div>
            <span style="font-family:var(--font-mono);font-size:.66rem;color:var(--om-tone-blue-fg);margin-top:2px">To: {{ st.dest }}</span>
          </div>
          <div style="border-radius:8px;padding:12px 14px;background:var(--om-mint-tint);display:flex;flex-direction:column;gap:6px">
            <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-mint)">Never sent</span>
            <div v-for="s in st.never" :key="s" style="display:flex;gap:6px;font-size:.76rem;color:var(--om-text)"><span class="mdi mdi-close" style="color:var(--om-mint)"></span>{{ s }}</div>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        <span style="font-size:.95rem;font-weight:600;color:var(--om-text-strong)">Analysis</span>
        <OmPrototypeBanner style="border-radius:6px;border-bottom:none" />
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px">
          <div style="padding:12px 14px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:8px">
            <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Ignored Paths</span>
            <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center">
              <span v-for="g in st.ignored" :key="g.p" style="display:flex;align-items:center;gap:4px;font-family:var(--font-mono);font-size:.7rem;padding:2px 4px 2px 8px;border-radius:999px;background:var(--om-tone-neutral-bg);color:var(--om-tone-neutral-fg)">{{ g.p }}<span @click="g.rm" class="mdi mdi-close" style="cursor:pointer;opacity:.7"></span></span>
              <input @keydown="st.addIgnored" placeholder="Add glob, press ⏎" style="border:none;outline:none;background:transparent;color:var(--om-text);font-family:var(--font-mono);font-size:.72rem;width:150px">
            </div>
            <span style="font-size:.66rem;color:var(--om-text-muted)">.gitignore is always respected.</span>
          </div>
          <div style="padding:12px 14px;border-bottom:1px solid var(--om-border);display:flex;flex-direction:column;gap:8px">
            <span style="font-size:.66rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted)">Languages Detected</span>
            <div style="display:flex;flex-wrap:wrap;gap:14px">
              <span v-for="l in st.langs" :key="l.l" style="display:flex;align-items:center;gap:6px;font-size:.78rem;color:var(--om-text)"><span :class="'mdi ' + l.ic" :style="{ color: l.fg, fontSize: '1rem' }"></span>{{ l.l }}<span style="font-family:var(--font-mono);font-size:.64rem;color:var(--om-text-muted)">{{ l.c }}</span></span>
            </div>
          </div>
          <div style="padding:12px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--om-border)"><span style="flex:1;font-size:.8rem;color:var(--om-text)">Read git history <span style="color:var(--om-text-muted);font-size:.72rem">— needed for hotspots, ownership and code age</span></span><select class="om-select om-select--md"><option>All history</option><option>Last 2 years</option><option>Last 12 months</option></select><div @click="st.tHistory.pick" :style="toggleStyle(st.tHistory)"><div :style="knobStyle(st.tHistory)"></div></div></div>
          <div style="padding:12px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--om-border)"><span style="flex:1;font-size:.8rem;color:var(--om-text)">Scan for secrets <span style="color:var(--om-text-muted);font-size:.72rem">— 41 patterns, results stay local</span></span><div @click="st.tSecrets.pick" :style="toggleStyle(st.tSecrets)"><div :style="knobStyle(st.tSecrets)"></div></div></div>
          <div style="padding:12px 14px;display:flex;align-items:center;gap:10px;border-bottom:1px solid var(--om-border)"><span style="flex:1;font-size:.8rem;color:var(--om-text)">Write module summaries after indexing <span style="color:var(--ai);font-size:.72rem">— uses the LLM</span></span><div @click="st.tSummaries.pick" :style="toggleStyle(st.tSummaries)"><div :style="knobStyle(st.tSummaries)"></div></div></div>
          <div style="padding:12px 14px;display:flex;align-items:center;gap:10px"><span style="flex:1;font-size:.8rem;color:var(--om-text)">Re-analyse automatically on branch switch</span><div @click="st.tBranch.pick" :style="toggleStyle(st.tBranch)"><div :style="knobStyle(st.tBranch)"></div></div></div>
        </div>
      </div>

      <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;overflow:hidden;flex-shrink:0">
        <div style="display:flex;align-items:center;gap:14px;padding:16px;border-bottom:1px solid var(--om-border);background:var(--om-surface)">
          <div style="width:40px;height:40px;border-radius:6px;background:var(--om-tone-blue-bg);display:flex;align-items:center;justify-content:center;flex-shrink:0"><span class="mdi mdi-palette-outline" style="font-size:1.2rem;color:var(--om-tone-blue-fg)"></span></div>
          <div style="display:flex;flex-direction:column;gap:3px"><span style="font-size:.95rem;font-weight:600;color:var(--om-text-strong)">Appearance</span><span style="font-size:.76rem;color:var(--om-text-muted)">Customize the look and feel of the app</span></div>
        </div>
        <div style="display:flex;align-items:center;gap:16px;padding:14px 16px;border-bottom:1px solid var(--om-border)">
          <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:0"><span style="font-size:.84rem;font-weight:600;color:var(--om-text-strong)">Theme</span><span style="font-size:.74rem;color:var(--om-text-muted)">Switch between light and dark mode</span></div>
          <div style="display:flex;border:1px solid var(--om-border);border-radius:6px;overflow:hidden">
            <button v-for="t in st.themes" :key="t.id" @click="t.pick" :style="{ display: 'flex', alignItems: 'center', gap: '7px', border: 'none', fontFamily: 'inherit', fontSize: '.8rem', fontWeight: 500, padding: '7px 16px', cursor: 'pointer', color: t.fg, background: t.bg, transition: 'background-color .15s' }"><span :class="'mdi mdi-' + t.ic"></span>{{ t.l }}</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:16px;padding:14px 16px;flex-wrap:wrap">
          <div style="flex:1;display:flex;flex-direction:column;gap:3px;min-width:220px"><span style="font-size:.84rem;font-weight:600;color:var(--om-text-strong)">Title Bar Color</span><span style="font-size:.74rem;color:var(--om-text-muted)">Tint the window title bar to tell multiple instances apart</span></div>
          <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:flex-end">
            <button @click="st.tbReset" title="Default" :style="{ width: '26px', height: '26px', borderRadius: '4px', border: '1px dashed var(--om-gray-400)', background: 'transparent', color: 'var(--om-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: st.tbResetRing }"><span class="mdi mdi-close"></span></button>
            <button v-for="c in st.swatches" :key="c.c" @click="c.pick" :title="c.c" v-hover="'transform:scale(1.08)'" :style="{ width: '26px', height: '26px', borderRadius: '4px', border: 'none', background: c.c, cursor: 'pointer', boxShadow: c.ring, transition: 'transform .12s' }"></button>
          </div>
        </div>
      </div>

      <div style="display:flex;flex-direction:column;gap:12px">
        <span style="font-size:.95rem;font-weight:600;color:var(--om-text-strong)">Keyboard</span>
        <div style="background:var(--om-card);border:1px solid var(--om-border);border-radius:8px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr))">
          <div v-for="k in st.keys" :key="k.l" style="display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-bottom:1px solid var(--om-border);font-size:.78rem;color:var(--om-text)">{{ k.l }}<span style="font-family:var(--font-mono);font-size:.66rem;padding:1px 6px;border:1px solid var(--om-border);border-radius:3px;color:var(--om-text-label)">{{ k.k }}</span></div>
        </div>
        <span style="font-size:.66rem;color:var(--om-text-muted)">Shown with ⌘ on macOS and Ctrl on Windows and Linux.</span>
      </div>
    </div>
  </div>

  <Teleport defer to="#om-root">
    <div v-if="or.dlg.open" @click="or.dlg.close" style="position:absolute;inset:0;z-index:1150;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;padding:24px">
      <div @click.stop style="width:720px;max-width:100%;max-height:calc(100% - 40px);background:var(--om-dialog);border:1px solid var(--om-border);border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,.5);display:flex;flex-direction:column;overflow:hidden">
        <div style="display:flex;align-items:center;padding:14px 18px;border-bottom:1px solid var(--om-border)">
          <span style="flex:1;font-size:.72rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-label)">Preferred OpenRouter Models</span>
          <button class="om-ghost-icon" @click="or.dlg.close" title="Close  esc" style="color:var(--om-text-muted)"><span class="mdi mdi-close"></span></button>
        </div>
        <div style="padding:12px 18px;display:flex;flex-direction:column;gap:10px;border-bottom:1px solid var(--om-border)">
          <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
            <div style="position:relative;flex:1;min-width:200px"><span class="mdi mdi-magnify" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--om-text-muted)"></span><input class="om-input" :value="or.dlg.q" @input="or.dlg.onQ" placeholder="Search by name or vendor…" style="padding-left:28px;padding-top:5px;padding-bottom:5px;font-size:.78rem"></div>
            <button v-for="t in or.dlg.tabs" :key="t.k" @click="t.pick" :style="{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'inherit', fontSize: '.72rem', fontWeight: 500, padding: '4px 10px', borderRadius: '999px', cursor: 'pointer', background: t.bg, color: t.fg, border: '1px solid ' + t.bd }">{{ t.l }}<span style="font-family:var(--font-mono);font-size:.64rem;opacity:.75">{{ t.n }}</span></button>
            <span style="font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.5px;color:var(--om-text-muted);margin-left:4px">Sort</span>
            <select class="om-select om-select--md" :value="or.dlg.sort" @change="or.dlg.onSort"><option value="featured">Featured</option><option value="price">Price</option><option value="context">Context</option><option value="name">Name</option></select>
          </div>
          <div v-if="or.dlg.full" style="display:flex;align-items:center;gap:8px;padding:7px 12px;border-radius:6px;background:var(--om-tone-blue-bg);color:var(--om-tone-blue-fg);font-size:.76rem"><span class="mdi mdi-information-outline"></span><span><b style="font-weight:600">Limit reached.</b> You have 5 models selected. Remove one to add another.</span></div>
        </div>
        <div style="flex:1;min-height:0;overflow:auto;padding:10px 18px;display:flex;flex-direction:column;gap:6px">
          <div v-for="r in or.dlg.rows" :key="r.slug" @click="r.toggle" :style="{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '6px', border: '1px solid ' + r.bd, background: r.bg, opacity: r.op, cursor: r.cur, transition: 'border-color .15s' }">
            <span :style="{ width: '30px', height: '30px', flexShrink: 0, borderRadius: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '.8rem', fontWeight: 600, background: r.avBg, color: r.avFg }">{{ r.initial }}</span>
            <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:2px">
              <div style="display:flex;align-items:center;gap:8px"><span style="font-size:.84rem;font-weight:500;color:var(--om-text-strong)">{{ r.name }}</span>
                <OmBadge v-if="r.free" kind="flag" tone="green">FREE</OmBadge>
                <OmBadge v-if="r.sota" kind="flag" tone="blue">SOTA</OmBadge>
              </div>
              <span style="font-family:var(--font-mono);font-size:.64rem;color:var(--om-text-muted)">{{ r.meta }}</span>
            </div>
            <span :class="'mdi ' + r.ic" :style="{ fontSize: '1.15rem', color: r.icfg }"></span>
          </div>
          <div v-if="or.dlg.empty" style="padding:24px;text-align:center;font-size:.78rem;color:var(--om-text-muted)">No models match.</div>
        </div>
        <div style="display:flex;align-items:center;padding:12px 18px;border-top:1px solid var(--om-border)">
          <span style="flex:1;font-size:.74rem;color:var(--om-text-muted)"><span style="font-family:var(--font-mono);color:var(--om-text-strong)">{{ or.dlg.count }}</span> of 5 selected · prices per 1M tokens in / out</span>
          <OmButton variant="primary" @click="or.dlg.close">Done</OmButton>
        </div>
      </div>
    </div>
  </Teleport>
</template>

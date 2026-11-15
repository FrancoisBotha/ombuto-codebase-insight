<script setup>
// Ask the Codebase (prototype lines 1160–1252; logic: Component.ask and more() "// ask").
import { computed, ref, watch, nextTick } from 'vue';
import { useInsightStore } from '../stores/insightStore.js';
import OmButton from '../components/ds/OmButton.vue';
import CodeView from '../components/CodeView.vue';
import OmPrototypeBanner from '../components/ds/OmPrototypeBanner.vue';
import { SNIPS, CITES, ANSWER, ANSWER2, STARTERS, OR_DEF, ASK_Q0, ASK_THINKING_STEPS, ASK_FOLLOWUPS } from '../data/insightData.js';

const store = useInsightStore();
const S = store.state;
const chat = ref(null);

function ask(q) {
  if (!q || !q.trim() || S.asking) return;
  store.setState((s) => ({ extra: [...s.extra, { role: 'user', text: q }], askInput: '', asking: true }));
  store.later('ask', 1600, () => {
    const blocks = /auth|login|session|permission/i.test(q) ? ANSWER : ANSWER2;
    store.setState((s) => ({ asking: false, extra: [...s.extra, { role: 'ai', blocks }], cite: blocks[0].cites[0] }));
  });
}

const mkC = (ids) =>
  ids.map((i) => {
    const c = CITES[i], sn = SNIPS[c.snip];
    const on = S.cite === i;
    return {
      key: i,
      label: sn.path.split('/').pop() + ':' + c.a + '–' + c.b,
      tip: sn.path + ' lines ' + c.a + '–' + c.b,
      bg: on ? 'var(--om-mint-tint-strong)' : 'var(--om-tone-blue-bg)',
      fg: on ? 'var(--om-mint)' : 'var(--om-tone-blue-fg)',
      pick: () => store.setState({ cite: i }),
    };
  });
const base = { isUser: false, isAi: false, isThinking: false, isError: false };
const U = (t) => ({ ...base, isUser: true, text: t });
const A = (bl) => ({
  ...base,
  isAi: true,
  blocks: bl.map((b) => ({ text: b.text, cites: mkC(b.cites) })),
  foot: 'Grounded in ' + new Set(bl.flatMap((b) => b.cites.map((i) => CITES[i].snip))).size + ' files · ' + bl.reduce((a, b) => a + b.cites.reduce((x, i) => x + CITES[i].b - CITES[i].a + 1, 0), 0) + ' lines read',
});
const TH = { ...base, isThinking: true, steps: ASK_THINKING_STEPS.map(([l, i]) => ({ l, i })) };

const msgs = computed(() => {
  const vs = store.viewState;
  let m = vs === 'empty' ? [] : vs === 'loading' ? [U(ASK_Q0), TH] : vs === 'error' ? [U(ASK_Q0), { ...base, isError: true }] : [U(ASK_Q0), A(ANSWER)];
  m = [...m, ...S.extra.map((x) => (x.role === 'user' ? U(x.text) : A(x.blocks)))];
  if (S.asking) m.push(TH);
  return m;
});
const empty = computed(() => msgs.value.length === 0);
const hasMsgs = computed(() => msgs.value.length > 0);
const starters = STARTERS.map((q) => ({ q, ask: () => ask(q) }));
const followups = ASK_FOLLOWUPS.map((q) => ({ q, ask: () => ask(q) }));

const C = computed(() => CITES[S.cite] || CITES[1]);
const sn = computed(() => SNIPS[C.value.snip]);
const pv = computed(() => ({ path: sn.value.path, range: 'lines ' + C.value.a + '–' + C.value.b }));

const model = computed(() =>
  S.llm === 'local' ? 'llama3.1:8b · local'
    : S.llm === 'cli' ? (S.cli || 'claude') + ' CLI · local'
      : S.llm === 'openrouter' ? (S.orDefault || (S.orModels || OR_DEF)[0] || 'no model') + ' · OpenRouter'
        : 'claude-sonnet · cloud',
);

const onInput = (e) => store.setState({ askInput: e.target.value });
const onKey = (e) => {
  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(S.askInput); }
};
const send = () => ask(S.askInput);
const retry = () => store.toast('Retrying… Ollama still unreachable');
const toSettings = () => store.go('settings');

// Prototype componentDidUpdate: scroll chat to bottom 20ms after messages change.
watch(
  () => [S.extra, S.asking],
  () => nextTick(() => { const el = chat.value; if (el) setTimeout(() => { el.scrollTop = el.scrollHeight; }, 20); }),
);
</script>

<template>
  <OmPrototypeBanner />
  <div style="flex:1;min-height:0;display:flex">
    <div style="flex:1.15;min-width:0;display:flex;flex-direction:column;min-height:0">
      <div style="display:flex;align-items:center;gap:12px;padding:12px 20px;border-bottom:1px solid var(--om-border)">
        <div style="display:flex;flex-direction:column;gap:2px;margin-right:auto">
          <div style="font-size:1.05rem;font-weight:600;color:var(--om-text-strong)">Ask the Codebase</div>
          <div style="font-size:.7rem;color:var(--om-text-muted)">Answers cite files and lines from harbor-api@a91f3c2</div>
        </div>
        <span style="display:flex;align-items:center;gap:5px;font-family:var(--font-mono);font-size:.68rem;padding:2px 8px;border-radius:999px;background:var(--om-mint-tint);color:var(--om-mint)"><span class="mdi mdi-laptop"></span>{{ model }}</span>
      </div>
      <div ref="chat" style="flex:1;min-height:0;overflow:auto;padding:20px;display:flex;flex-direction:column;gap:18px">
        <div v-if="empty" style="margin:auto 0;display:flex;flex-direction:column;gap:16px;max-width:620px;align-self:center;width:100%">
          <div style="display:flex;flex-direction:column;gap:6px">
            <span class="mdi mdi-chat-question-outline" style="font-size:1.6rem;color:var(--om-text-muted)"></span>
            <span style="font-size:1.1rem;font-weight:600;color:var(--om-text-strong)">Ask anything about harbor-api.</span>
            <span style="font-size:.8rem;color:var(--om-text-muted);line-height:1.5">Answers are grounded in the indexed code and git history. Every claim links to the lines it came from.</span>
          </div>
          <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px">
            <button v-for="s in starters" :key="s.q" @click="s.ask" v-hover="'border-color:var(--om-border-hover)'" style="text-align:left;font-family:inherit;font-size:.8rem;color:var(--om-text);background:var(--om-card);border:1px solid var(--om-border);border-radius:6px;padding:10px 12px;cursor:pointer;display:flex;gap:8px;align-items:center"><span class="mdi mdi-arrow-top-right" style="color:var(--om-text-muted)"></span>{{ s.q }}</button>
          </div>
        </div>
        <template v-for="(m, mi) in msgs" :key="mi">
          <div v-if="m.isUser" style="align-self:flex-end;max-width:75%;padding:9px 13px;border-radius:12px 12px 3px 12px;background:var(--om-card-raised);border:1px solid var(--om-border);font-size:.84rem;color:var(--om-text-strong)">{{ m.text }}</div>
          <div v-if="m.isAi" style="display:flex;flex-direction:column;gap:10px;max-width:92%">
            <span style="display:flex;align-items:center;gap:4px;font-size:.6rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--ai)"><span class="mdi mdi-creation"></span>AI answer</span>
            <div v-for="(b, bi) in m.blocks" :key="bi" style="display:flex;flex-direction:column;gap:6px">
              <span style="font-size:.84rem;line-height:1.6;color:var(--om-text);text-wrap:pretty">{{ b.text }}</span>
              <div style="display:flex;flex-wrap:wrap;gap:5px">
                <button v-for="c in b.cites" :key="c.key" @click="c.pick" :title="c.tip" :style="{ display: 'flex', alignItems: 'center', gap: '4px', border: 'none', fontFamily: 'var(--font-mono)', fontSize: '.66rem', padding: '2px 8px', borderRadius: '999px', background: c.bg, color: c.fg, cursor: 'pointer' }"><span class="mdi mdi-code-tags"></span>{{ c.label }}</button>
              </div>
            </div>
            <span style="font-size:.64rem;color:var(--om-text-muted)">{{ m.foot }} · verify cited lines</span>
          </div>
          <div v-if="m.isThinking" style="display:flex;flex-direction:column;gap:6px;padding:10px 12px;border:1px dashed var(--ai-line);background:var(--ai-bg);border-radius:6px;max-width:420px">
            <div v-for="s in m.steps" :key="s.l" style="display:flex;align-items:center;gap:8px;font-size:.74rem;color:var(--om-text-value)"><span :class="'mdi ' + s.i" style="color:var(--ai)"></span>{{ s.l }}</div>
          </div>
          <div v-if="m.isError" style="display:flex;flex-direction:column;gap:10px;padding:12px 14px;border:1px solid var(--om-tone-red-border);background:var(--om-tone-red-bg);border-radius:6px;max-width:520px">
            <div style="display:flex;gap:8px;align-items:flex-start"><span class="mdi mdi-lan-disconnect" style="color:var(--om-tone-red-fg);font-size:1rem"></span><div style="display:flex;flex-direction:column;gap:3px"><span style="font-size:.84rem;font-weight:600;color:var(--om-tone-red-fg)">Ollama isn’t responding.</span><span style="font-size:.74rem;color:var(--om-text-value);line-height:1.5">No reply from <span style="font-family:var(--font-mono)">localhost:11434</span> after 30 s. Start it with <span style="font-family:var(--font-mono)">ollama serve</span>, or switch provider. Your question was not sent anywhere else.</span></div></div>
            <div style="display:flex;gap:8px">
              <OmButton variant="secondary" icon="refresh" @click="retry">Retry</OmButton>
              <OmButton variant="ghost" icon="cog-outline" @click="toSettings">LLM Settings</OmButton>
            </div>
          </div>
        </template>
      </div>
      <div style="padding:12px 20px 16px;border-top:1px solid var(--om-border);display:flex;flex-direction:column;gap:8px">
        <div v-if="hasMsgs" style="display:flex;gap:6px;flex-wrap:wrap">
          <button v-for="s in followups" :key="s.q" @click="s.ask" v-hover="'border-color:var(--om-border-hover)'" style="font-family:inherit;font-size:.7rem;color:var(--om-text-label);background:transparent;border:1px solid var(--om-border);border-radius:999px;padding:3px 10px;cursor:pointer">{{ s.q }}</button>
        </div>
        <div style="display:flex;align-items:flex-end;gap:8px;background:var(--om-surface);border:1px solid var(--om-border);border-radius:6px;padding:8px 8px 8px 12px">
          <textarea :value="S.askInput" @input="onInput" @keydown="onKey" rows="2" placeholder="Ask about code, history or architecture…" style="flex:1;resize:none;border:none;outline:none;background:transparent;color:var(--om-text);font-family:inherit;font-size:.84rem;line-height:1.5"></textarea>
          <OmButton variant="primary" icon="send" @click="send">Ask</OmButton>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.64rem;color:var(--om-text-placeholder)"><span>⏎ send · ⇧⏎ new line · @ to mention a file</span><span>Only cited snippets are read by the model</span></div>
      </div>
    </div>
    <div style="flex:1;min-width:0;border-left:1px solid var(--om-border);display:flex;flex-direction:column;min-height:0;background:var(--om-inset)">
      <div style="display:flex;align-items:center;gap:8px;padding:10px 14px;border-bottom:1px solid var(--om-border);background:var(--om-surface)">
        <span class="mdi mdi-file-code-outline" style="color:var(--om-text-muted)"></span>
        <span style="font-family:var(--font-mono);font-size:.76rem;color:var(--om-text-strong);flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">{{ pv.path }}</span>
        <span style="font-family:var(--font-mono);font-size:.66rem;padding:1px 7px;border-radius:999px;background:var(--om-mint-tint-strong);color:var(--om-mint)">{{ pv.range }}</span>
      </div>
      <div style="flex:1;min-height:0">
        <CodeView variant="ask" :code="sn.code" :start="sn.start" :hlA="C.a" :hlB="C.b" />
      </div>
    </div>
  </div>
</template>

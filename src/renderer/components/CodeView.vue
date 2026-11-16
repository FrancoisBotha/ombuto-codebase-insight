<script setup>
// Read-only code viewer on CodeMirror 6 (Architecture §2). Reproduces the
// prototype's hand-built code panes:
//  - variant "ask":  line numbers + cited-range highlight (mint tint, 2px mint bar)
//  - variant "file": line numbers + per-line complexity heat bar + blame-age strip
// Token colours follow the prototype's tokenizer (keywords blue, types yellow,
// strings green, numbers orange, comments muted). See docs/Architecture/prototype-port.md.
import { onMounted, onBeforeUnmount, ref, watch } from 'vue';
import { EditorState, RangeSetBuilder } from '@codemirror/state';
import { EditorView, lineNumbers, gutter, GutterMarker, Decoration, ViewPlugin } from '@codemirror/view';
import { HighlightStyle, syntaxHighlighting } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { HEAT, ramp } from '../lib/color.js';
import { languageExtension } from '../lib/codeLanguage.js';

const props = defineProps({
  code: { type: String, default: '' },
  start: { type: Number, default: 1 },
  variant: { type: String, default: 'ask' }, // 'ask' | 'file'
  hlA: { type: Number, default: 0 },
  hlB: { type: Number, default: 0 },
  /** (lineNo) => age in days, for the blame strip (variant "file"); null = no blame yet. */
  blame: { type: Function, default: null },
  /** raw_blob.language id (see lib/codeLanguage.js); unknown ids render as plain text. */
  language: { type: String, default: 'typescript' },
});

const host = ref(null);
let view = null;

const highlight = HighlightStyle.define([
  { tag: [t.comment, t.lineComment, t.blockComment], color: 'var(--om-text-muted)' },
  { tag: [t.string, t.special(t.string)], color: 'var(--om-tone-green-fg)' },
  { tag: [t.keyword, t.controlKeyword, t.moduleKeyword, t.definitionKeyword, t.operatorKeyword, t.bool, t.null, t.self], color: 'var(--om-tone-blue-fg)' },
  { tag: [t.typeName, t.className, t.namespace], color: 'var(--om-tone-yellow-fg)' },
  { tag: [t.number], color: 'var(--om-tone-orange-fg)' },
  { tag: [t.operator, t.punctuation, t.bracket, t.separator, t.derefOperator], color: 'var(--om-text-label)' },
]);

// Prototype heat: branch keywords and indentation per line.
function heatOf(line) {
  const ind = line.match(/^ */)[0].length / 2;
  const br = (line.match(/\b(if|for|while|case|catch)\b|\?\?|\?\.|&&|\|\|/g) || []).length;
  return line.trim() ? Math.min(8, br * 2 + Math.max(0, ind - 1)) : 0;
}
function ageBg(age) {
  if (age === null) return 'var(--om-inset)'; // no blame data yet (git history arrives in a later epic)
  return age < 7 ? '#6dd4a0' : age < 60 ? '#4fa077' : age < 365 ? '#444c56' : '#2d333b';
}

class HeatMarker extends GutterMarker {
  constructor(heat) { super(); this.heat = heat; }
  eq(o) { return o.heat === this.heat; }
  toDOM() {
    const wrap = document.createElement('span');
    wrap.className = 'cv-heat-wrap';
    const bar = document.createElement('span');
    bar.className = 'cv-heat-bar';
    bar.style.width = this.heat * 3 + 'px';
    bar.style.background = ramp(HEAT.dark, this.heat / 8);
    wrap.appendChild(bar);
    return wrap;
  }
}
class AgeMarker extends GutterMarker {
  constructor(age) { super(); this.age = age; }
  eq(o) { return o.age === this.age; }
  toDOM() {
    const el = document.createElement('span');
    el.className = 'cv-age-bar';
    el.style.background = ageBg(this.age);
    el.title = this.age === null ? 'Blame not analysed yet' : this.age ? (this.age < 1 ? 'today' : this.age + ' days ago') : '';
    return el;
  }
}

function lineNo(view, pos) {
  return view.state.doc.lineAt(pos).number + props.start - 1;
}

function citeHighlight() {
  const deco = Decoration.line({ class: 'cv-cited' });
  return ViewPlugin.fromClass(
    class {
      constructor(v) { this.decorations = this.build(v); }
      update(u) { if (u.docChanged) this.decorations = this.build(u.view); }
      build(v) {
        const b = new RangeSetBuilder();
        if (!props.hlA) return b.finish();
        for (let i = 1; i <= v.state.doc.lines; i++) {
          const n = i + props.start - 1;
          if (n >= props.hlA && n <= props.hlB) {
            const l = v.state.doc.line(i);
            b.add(l.from, l.from, deco);
          }
        }
        return b.finish();
      }
    },
    { decorations: (p) => p.decorations },
  );
}

const theme = (variant) =>
  EditorView.theme({
    '&': { fontSize: variant === 'file' ? '.74rem' : '.72rem', background: 'transparent', color: 'var(--om-text)', height: '100%' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': { fontFamily: 'var(--font-mono)', lineHeight: variant === 'file' ? '1.7' : '1.65', padding: variant === 'file' ? '6px 0' : '8px 0', overflow: 'auto' },
    '.cm-content': { padding: '0', caretColor: 'transparent' },
    '.cm-line': { padding: '0 16px 0 0' },
    ...(variant === 'file' ? { '.cm-line:hover': { background: 'var(--om-white-04)' } } : {}),
    '.cm-gutters': { background: 'transparent', border: 'none', color: 'var(--om-gray-400)', userSelect: 'none' },
    '.cm-lineNumbers .cm-gutterElement': {
      width: variant === 'file' ? '40px' : '44px', boxSizing: 'border-box', padding: variant === 'file' ? '0 8px 0 0' : '0 12px 0 0', textAlign: 'right', minWidth: '0',
    },
    '.cm-gutter.cv-heat': { width: '28px' },
    '.cv-heat .cm-gutterElement': { display: 'flex', alignItems: 'center', height: '100%' },
    '.cv-heat-wrap': { display: 'flex', alignItems: 'center', height: '100%' },
    '.cv-heat-bar': { display: 'block', height: '6px', borderRadius: '1px' },
    '.cm-gutter.cv-age': { width: '4px', marginRight: '12px' },
    '.cv-age .cm-gutterElement': { padding: '0' },
    '.cv-age-bar': { display: 'block', width: '4px', height: '100%' },
    '.cv-cited': { background: 'rgba(109,212,160,.09)', boxShadow: 'inset 2px 0 0 var(--om-mint)' },
    '.cm-selectionBackground, &.cm-focused .cm-selectionBackground': { background: 'rgba(91,155,213,.25)' },
  });

function extensions() {
  const ext = [
    EditorState.readOnly.of(true),
    EditorView.editable.of(false),
    languageExtension(props.language) ?? [],
    syntaxHighlighting(highlight),
    theme(props.variant),
    lineNumbers({ formatNumber: (n) => String(n + props.start - 1) }),
  ];
  if (props.variant === 'file') {
    ext.push(
      gutter({ class: 'cv-heat', lineMarker: (v, line) => new HeatMarker(heatOf(v.state.doc.sliceString(line.from, line.to))) }),
      gutter({ class: 'cv-age', lineMarker: (v, line) => new AgeMarker(props.blame ? props.blame(lineNo(v, line.from)) : null) }),
    );
  } else {
    ext.push(citeHighlight());
  }
  return ext;
}

function mount() {
  view?.destroy();
  view = new EditorView({ parent: host.value, state: EditorState.create({ doc: props.code, extensions: extensions() }) });
}

onMounted(mount);
watch(() => [props.code, props.start, props.hlA, props.hlB, props.blame, props.variant, props.language], mount);
onBeforeUnmount(() => view?.destroy());
</script>

<template>
  <div ref="host" class="cv-host" style="height:100%;min-height:0"></div>
</template>

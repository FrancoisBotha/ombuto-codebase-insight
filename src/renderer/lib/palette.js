// Command palette items (prototype: Component.palItems), shared by the palette
// overlay and the global keyboard handler.
import { NAV } from './constants.js';
import { FILES } from '../data/insightData.js';

export function palItems(store) {
  const S = store.state;
  const go = store.go;
  const q = S.q.trim().toLowerCase();
  const m = (s) => !q || s.toLowerCase().includes(q);
  const out = [];
  const nav = [
    ...NAV.map((n) => ({ label: 'Go to ' + n.label, icon: n.icon, hint: n.hint, run: () => go(n.id) })),
    { label: 'Go to Settings', icon: 'cog-outline', hint: '⌘,', run: () => go('settings') },
  ].filter((i) => m(i.label));
  const act = [
    { label: 'Ask the codebase…', icon: 'chat-question-outline', hint: '⌘J', run: () => go('ask') },
    { label: 'Re-analyse repository', icon: 'refresh', hint: '⌘R', run: () => go('indexing', { t: 0 }) },
    { label: 'Explain selected hotspot', icon: 'creation', hint: '⌘E', run: () => go('hotspots', { explain: 'done' }) },
    { label: 'Export report…', icon: 'export-variant', hint: '⌘⇧E', run: () => go('report') },
    { label: 'Toggle light / dark theme', icon: 'theme-light-dark', hint: '⌘⇧L', run: () => store.setState((s) => ({ pal: false, theme: (s.theme || store.props.theme || 'dark') === 'dark' ? 'light' : 'dark' })) },
    { label: 'Open repository…', icon: 'folder-open-outline', hint: '⌘O', run: () => go('welcome') },
    { label: 'Toggle navigation drawer', icon: 'dock-left', hint: '⌘B', run: () => store.setState((s) => ({ pal: false, collapsed: !s.collapsed })) },
  ].filter((i) => m(i.label));
  const files = FILES.filter((f) => q && m(f.path))
    .slice(0, 5)
    .map((f) => ({ label: f.path, icon: 'file-code-outline', hint: '', mono: true, run: () => go('file', { fsel: f.path, sel: f.path }) }));
  if (files.length) out.push({ header: 'Files' }, ...files);
  if (act.length) out.push({ header: 'Actions' }, ...act);
  if (nav.length) out.push({ header: 'Navigate' }, ...nav);
  return out;
}

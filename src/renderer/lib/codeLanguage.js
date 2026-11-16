// Language ids → CodeMirror modes, display names, colours and explorer icons.
// The ids are the raw_blob.language values written by the Extract files stage
// (src/shared/files/languageByExtension.js). Grammar languages use the Lezer
// packages already bundled for CodeView; common text formats use the stream
// parsers in @codemirror/legacy-modes; everything else renders as plain text.
import { StreamLanguage } from '@codemirror/language';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { java } from '@codemirror/lang-java';
import { go } from '@codemirror/lang-go';
import { rust } from '@codemirror/lang-rust';
import { sql } from '@codemirror/lang-sql';
import { json } from '@codemirror/legacy-modes/mode/javascript';
import { yaml } from '@codemirror/legacy-modes/mode/yaml';
import { xml, html } from '@codemirror/legacy-modes/mode/xml';
import { css, sCSS, less } from '@codemirror/legacy-modes/mode/css';
import { shell } from '@codemirror/legacy-modes/mode/shell';
import { powerShell } from '@codemirror/legacy-modes/mode/powershell';
import { toml } from '@codemirror/legacy-modes/mode/toml';
import { properties } from '@codemirror/legacy-modes/mode/properties';
import { dockerFile } from '@codemirror/legacy-modes/mode/dockerfile';
import { cmake } from '@codemirror/legacy-modes/mode/cmake';
import { groovy } from '@codemirror/legacy-modes/mode/groovy';
import { ruby } from '@codemirror/legacy-modes/mode/ruby';
import { swift } from '@codemirror/legacy-modes/mode/swift';
import { lua } from '@codemirror/legacy-modes/mode/lua';
import { r } from '@codemirror/legacy-modes/mode/r';
import { perl } from '@codemirror/legacy-modes/mode/perl';
import { erlang } from '@codemirror/legacy-modes/mode/erlang';
import { haskell } from '@codemirror/legacy-modes/mode/haskell';
import { clojure } from '@codemirror/legacy-modes/mode/clojure';
import { protobuf } from '@codemirror/legacy-modes/mode/protobuf';
import { stex } from '@codemirror/legacy-modes/mode/stex';
import { vb } from '@codemirror/legacy-modes/mode/vb';
import { c, cpp, csharp, kotlin, scala, dart, objectiveC } from '@codemirror/legacy-modes/mode/clike';

const stream = (mode) => () => StreamLanguage.define(mode);

/** language id → () => CodeMirror extension. Built lazily and cached. */
const FACTORIES = {
  javascript: () => javascript(),
  typescript: () => javascript({ typescript: true }),
  tsx: () => javascript({ typescript: true, jsx: true }),
  python: () => python(),
  java: () => java(),
  go: () => go(),
  rust: () => rust(),
  sql: () => sql(),
  json: stream(json),
  yaml: stream(yaml),
  xml: stream(xml),
  html: stream(html),
  vue: stream(html),
  svelte: stream(html),
  css: stream(css),
  scss: stream(sCSS),
  less: stream(less),
  shell: stream(shell),
  powershell: stream(powerShell),
  toml: stream(toml),
  ini: stream(properties),
  properties: stream(properties),
  dotenv: stream(properties),
  dockerfile: stream(dockerFile),
  cmake: stream(cmake),
  groovy: stream(groovy),
  ruby: stream(ruby),
  swift: stream(swift),
  lua: stream(lua),
  r: stream(r),
  perl: stream(perl),
  erlang: stream(erlang),
  haskell: stream(haskell),
  clojure: stream(clojure),
  protobuf: stream(protobuf),
  latex: stream(stex),
  visual_basic: stream(vb),
  c: stream(c),
  cpp: stream(cpp),
  c_sharp: stream(csharp),
  kotlin: stream(kotlin),
  scala: stream(scala),
  dart: stream(dart),
  objective_c: stream(objectiveC),
};
const cache = new Map();

/**
 * CodeMirror language extension for a language id, or null when the file
 * should render as plain text (markdown, text, csv, unknown ids, null).
 */
export function languageExtension(languageId) {
  if (!languageId || !Object.prototype.hasOwnProperty.call(FACTORIES, languageId)) return null;
  if (!cache.has(languageId)) cache.set(languageId, FACTORIES[languageId]());
  return cache.get(languageId);
}

const LABELS = {
  javascript: 'JavaScript', typescript: 'TypeScript', tsx: 'TSX', python: 'Python', java: 'Java',
  c_sharp: 'C#', go: 'Go', rust: 'Rust', sql: 'SQL', json: 'JSON', yaml: 'YAML', markdown: 'Markdown',
  html: 'HTML', css: 'CSS', scss: 'SCSS', less: 'Less', xml: 'XML', text: 'Text', shell: 'Shell',
  powershell: 'PowerShell', batch: 'Batch', toml: 'TOML', ini: 'INI', properties: 'Properties',
  dotenv: 'Dotenv', csv: 'CSV', vue: 'Vue', svelte: 'Svelte', graphql: 'GraphQL', protobuf: 'Protobuf',
  terraform: 'Terraform', dockerfile: 'Dockerfile', makefile: 'Makefile', groovy: 'Groovy',
  kotlin: 'Kotlin', scala: 'Scala', ruby: 'Ruby', php: 'PHP', swift: 'Swift', objective_c: 'Objective-C',
  c: 'C', cpp: 'C++', lua: 'Lua', r: 'R', dart: 'Dart', elixir: 'Elixir', erlang: 'Erlang',
  haskell: 'Haskell', clojure: 'Clojure', perl: 'Perl', visual_basic: 'Visual Basic', fsharp: 'F#',
  latex: 'LaTeX', restructuredtext: 'reStructuredText', asciidoc: 'AsciiDoc', org: 'Org', nix: 'Nix',
  cmake: 'CMake', gitignore: 'gitignore', gitattributes: 'gitattributes',
};

/** Display name for a language id ("Other" for null). */
export function languageLabel(languageId) {
  if (!languageId) return 'Other';
  if (Object.prototype.hasOwnProperty.call(LABELS, languageId)) return LABELS[languageId];
  const s = languageId.replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Bar colour per language for the inventory charts; cycles for the rest. */
const COLORS = {
  javascript: 'var(--om-tone-yellow-fg)', typescript: 'var(--om-blue)', tsx: 'var(--om-blue)',
  python: 'var(--om-teal)', java: 'var(--om-tone-orange-fg)', c_sharp: 'var(--om-tone-green-fg)',
  go: 'var(--om-teal)', rust: 'var(--om-tone-orange-fg)', sql: 'var(--om-tone-yellow-fg)',
  json: 'var(--om-gray-500)', yaml: 'var(--om-mint)', markdown: 'var(--om-text-muted)',
  html: 'var(--om-tone-orange-fg)', css: 'var(--om-blue)', shell: 'var(--om-tone-orange-fg)', vue: 'var(--om-mint)',
};
const FALLBACK_COLORS = ['var(--om-blue)', 'var(--om-mint)', 'var(--om-tone-yellow-fg)', 'var(--om-tone-orange-fg)', 'var(--om-teal)', 'var(--om-gray-500)'];

export function languageColor(languageId, index = 0) {
  if (languageId && Object.prototype.hasOwnProperty.call(COLORS, languageId)) return COLORS[languageId];
  return FALLBACK_COLORS[index % FALLBACK_COLORS.length];
}

/** [mdi icon class, colour] for an explorer row. */
export function fileIcon(languageId, isBinary) {
  if (isBinary) return ['mdi-file-outline', 'var(--om-text-placeholder)'];
  switch (languageId) {
    case 'typescript': case 'tsx': return ['mdi-language-typescript', 'var(--om-blue)'];
    case 'javascript': return ['mdi-language-javascript', 'var(--om-tone-yellow-fg)'];
    case 'python': return ['mdi-language-python', 'var(--om-blue)'];
    case 'java': case 'kotlin': return ['mdi-language-java', 'var(--om-tone-orange-fg)'];
    case 'c_sharp': return ['mdi-language-csharp', 'var(--om-tone-green-fg)'];
    case 'go': return ['mdi-language-go', 'var(--om-teal)'];
    case 'rust': return ['mdi-language-rust', 'var(--om-tone-orange-fg)'];
    case 'c': return ['mdi-language-c', 'var(--om-blue)'];
    case 'cpp': return ['mdi-language-cpp', 'var(--om-blue)'];
    case 'ruby': return ['mdi-language-ruby', 'var(--om-danger)'];
    case 'php': return ['mdi-language-php', 'var(--om-blue)'];
    case 'swift': return ['mdi-language-swift', 'var(--om-tone-orange-fg)'];
    case 'lua': return ['mdi-language-lua', 'var(--om-blue)'];
    case 'r': return ['mdi-language-r', 'var(--om-blue)'];
    case 'sql': return ['mdi-database-outline', 'var(--om-tone-yellow-fg)'];
    case 'json': return ['mdi-code-json', 'var(--om-tone-yellow-fg)'];
    case 'yaml': case 'toml': case 'ini': case 'properties': case 'dotenv': return ['mdi-file-cog-outline', 'var(--om-text-muted)'];
    case 'markdown': case 'restructuredtext': case 'asciidoc': return ['mdi-language-markdown-outline', 'var(--om-text-muted)'];
    case 'html': case 'vue': case 'svelte': return ['mdi-language-html5', 'var(--om-tone-orange-fg)'];
    case 'css': case 'scss': case 'less': return ['mdi-language-css3', 'var(--om-blue)'];
    case 'xml': return ['mdi-xml', 'var(--om-text-muted)'];
    case 'shell': case 'powershell': case 'batch': return ['mdi-console', 'var(--om-text-muted)'];
    case 'dockerfile': return ['mdi-docker', 'var(--om-blue)'];
    case 'text': case null: case undefined: return ['mdi-file-document-outline', 'var(--om-text-muted)'];
    default: return ['mdi-file-code-outline', 'var(--om-text-muted)'];
  }
}

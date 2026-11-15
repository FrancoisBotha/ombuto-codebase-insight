// Guards the vendored tree-sitter grammars (resources/grammars/): every grammar
// in the manifest must load in the installed web-tree-sitter and parse a sample
// without errors. Fails on ABI drift after upgrading web-tree-sitter or a grammar.
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Parser, Language } from 'web-tree-sitter';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../resources/grammars');
const manifest = JSON.parse(fs.readFileSync(path.join(DIR, 'grammars.json'), 'utf8'));

const SAMPLES = {
  javascript: 'function f(a) { return a + 1 }',
  typescript: 'function f(a: number): number { return a }',
  tsx: 'const x = <div className="a" />;',
  python: 'def f(a):\n    return a\n',
  java: 'class A { int f() { return 1; } }',
  c_sharp: 'class A { int F() { return 1; } }',
  go: 'package m\n\nfunc f() int { return 1 }\n',
  rust: 'fn f() -> i32 { 1 }',
  sql: 'SELECT a, count(*) FROM t JOIN u ON t.id = u.tid WHERE a > 1 GROUP BY a;',
};

describe('vendored tree-sitter grammars', () => {
  beforeAll(async () => {
    await Parser.init();
  });

  it('covers every language named in the architecture', () => {
    expect(Object.keys(manifest.grammars).sort()).toEqual(Object.keys(SAMPLES).sort());
  });

  for (const [lang, entry] of Object.entries(manifest.grammars)) {
    it(`loads and parses ${lang}`, async () => {
      const language = await Language.load(fs.readFileSync(path.join(DIR, entry.file)));
      const parser = new Parser();
      parser.setLanguage(language);
      const tree = parser.parse(SAMPLES[lang]);
      expect(tree.rootNode.hasError).toBe(false);
      parser.delete();
    });
  }
});

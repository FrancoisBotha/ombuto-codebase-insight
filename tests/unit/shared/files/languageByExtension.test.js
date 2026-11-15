// Pure language-by-extension map used by the Extract files stage (FR-005).
// It must cover every vendored tree-sitter grammar plus common text formats.
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  LANGUAGE_BY_EXTENSION,
  LANGUAGE_BY_FILENAME,
  GRAMMAR_LANGUAGES,
  languageForPath,
} from '../../../../src/shared/files/languageByExtension.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const grammarsJson = JSON.parse(
  fs.readFileSync(path.resolve(here, '../../../../resources/grammars/grammars.json'), 'utf8'),
);

describe('languageByExtension', () => {
  it('covers every grammar vendored in resources/grammars/', () => {
    const grammarIds = Object.keys(grammarsJson.grammars).sort();
    expect([...GRAMMAR_LANGUAGES].sort()).toEqual(grammarIds);
    const mapped = new Set(Object.values(LANGUAGE_BY_EXTENSION));
    for (const id of grammarIds) expect(mapped.has(id)).toBe(true);
  });

  it('maps the grammar languages by their usual extensions', () => {
    expect(languageForPath('src/Program.cs')).toBe('c_sharp');
    expect(languageForPath('cmd/main.go')).toBe('go');
    expect(languageForPath('src/main/java/App.java')).toBe('java');
    expect(languageForPath('src/index.js')).toBe('javascript');
    expect(languageForPath('src/index.mjs')).toBe('javascript');
    expect(languageForPath('tools/db-query.cjs')).toBe('javascript');
    expect(languageForPath('src/App.jsx')).toBe('javascript');
    expect(languageForPath('scripts/run.py')).toBe('python');
    expect(languageForPath('src/lib.rs')).toBe('rust');
    expect(languageForPath('docs/Data Model/Schema.ddl')).toBe('sql');
    expect(languageForPath('db/migrate.sql')).toBe('sql');
    expect(languageForPath('src/App.tsx')).toBe('tsx');
    expect(languageForPath('src/index.ts')).toBe('typescript');
    expect(languageForPath('src/types.d.ts')).toBe('typescript');
    expect(languageForPath('src/index.mts')).toBe('typescript');
  });

  it('covers common text formats', () => {
    expect(languageForPath('package.json')).toBe('json');
    expect(languageForPath('.github/workflows/ci.yml')).toBe('yaml');
    expect(languageForPath('config.yaml')).toBe('yaml');
    expect(languageForPath('README.md')).toBe('markdown');
    expect(languageForPath('index.html')).toBe('html');
    expect(languageForPath('styles/app.css')).toBe('css');
    expect(languageForPath('styles/app.scss')).toBe('scss');
    expect(languageForPath('pom.xml')).toBe('xml');
    expect(languageForPath('scripts/build.sh')).toBe('shell');
    expect(languageForPath('Cargo.toml')).toBe('toml');
    expect(languageForPath('notes.txt')).toBe('text');
    expect(languageForPath('src/App.vue')).toBe('vue');
    expect(languageForPath('app.ini')).toBe('ini');
    expect(languageForPath('scripts/build.ps1')).toBe('powershell');
  });

  it('recognises well-known extensionless file names', () => {
    expect(languageForPath('Dockerfile')).toBe('dockerfile');
    expect(languageForPath('docker/Dockerfile')).toBe('dockerfile');
    expect(languageForPath('Makefile')).toBe('makefile');
    expect(languageForPath('.gitignore')).toBe('gitignore');
    expect(LANGUAGE_BY_FILENAME.Dockerfile).toBe('dockerfile');
  });

  it('is case-insensitive on the extension and returns null for unknown files', () => {
    expect(languageForPath('legacy/SCRIPT.JS')).toBe('javascript');
    expect(languageForPath('image.png')).toBeNull();
    expect(languageForPath('archive.tar.gz')).toBeNull();
    expect(languageForPath('noext')).toBeNull();
    expect(languageForPath('')).toBeNull();
    expect(languageForPath(null)).toBeNull();
  });

  it('is a frozen, pure map (no mutation surprises)', () => {
    expect(Object.isFrozen(LANGUAGE_BY_EXTENSION)).toBe(true);
    expect(Object.isFrozen(LANGUAGE_BY_FILENAME)).toBe(true);
    expect(Object.isFrozen(GRAMMAR_LANGUAGES)).toBe(true);
  });
});

// CodeMirror language mode by language id (FR-008): ids are the raw_blob.language
// values written by the Extract files stage (src/shared/files/languageByExtension.js).
import { describe, it, expect } from 'vitest';
import { languageExtension, languageLabel, fileIcon } from '../../../src/renderer/lib/codeLanguage.js';
import { languageForPath } from '../../../src/shared/files/languageByExtension.js';

describe('codeLanguage.js', () => {
  it('returns a CodeMirror extension for the grammar languages', () => {
    for (const id of ['javascript', 'typescript', 'tsx', 'python', 'java', 'c_sharp', 'go', 'rust', 'sql']) {
      expect(languageExtension(id), id).toBeTruthy();
    }
  });

  it('returns an extension for common text formats and null for plain text or unknown ids', () => {
    expect(languageExtension('json')).toBeTruthy();
    expect(languageExtension('yaml')).toBeTruthy();
    expect(languageExtension('shell')).toBeTruthy();
    expect(languageExtension('text')).toBeNull();
    expect(languageExtension(null)).toBeNull();
    expect(languageExtension('no-such-language')).toBeNull();
  });

  it('resolves a mode by file extension through the shared language table', () => {
    expect(languageExtension(languageForPath('src/app.ts'))).toBeTruthy();
    expect(languageExtension(languageForPath('db/schema.sql'))).toBeTruthy();
    expect(languageExtension(languageForPath('notes.unknownext'))).toBeNull();
  });

  it('gives display names for language ids', () => {
    expect(languageLabel('typescript')).toBe('TypeScript');
    expect(languageLabel('c_sharp')).toBe('C#');
    expect(languageLabel(null)).toBe('Other');
    expect(languageLabel('some_new_lang')).toBe('Some new lang');
  });

  it('picks an explorer icon by language, with a distinct icon for binary files', () => {
    expect(fileIcon('typescript', false)[0]).toBe('mdi-language-typescript');
    expect(fileIcon(null, true)[0]).not.toBe(fileIcon(null, false)[0]);
  });
});

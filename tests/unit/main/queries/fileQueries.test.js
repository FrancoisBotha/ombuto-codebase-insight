// Read-only file queries for the Files view and the command palette (FR-008):
// explorer tree, file content and path search over raw_tree_entry / raw_blob.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getFileTree, buildFileTree, getFileContent, searchFilePaths } from '../../../../src/main/queries/fileQueries.js';
import { makeTempDb, seedCommit, COMMIT_A, COMMIT_B } from './seedInsightDb.js';

const FILES = [
  { path: 'README.md', content: '# Hi\n' },
  { path: 'src/app.js', content: 'export const a = 1;\nexport const b = 2;\n' },
  { path: 'src/api/routes.js', content: 'routes\n' },
  { path: 'src/api/handlers.js', content: 'handlers\n' },
  { path: 'src/App.vue', content: '<template/>\n', language: 'vue' },
  { path: 'tests/app.test.js', content: 'test\n' },
  { path: 'assets/logo.png', binary: true, bytes: 99 },
  { path: 'dist/bundle.min.js', content: 'x\n', generated: true },
];

describe('fileQueries', () => {
  let t;
  beforeEach(() => {
    t = makeTempDb();
    seedCommit(t.db, { commitSha: COMMIT_A, files: FILES });
    seedCommit(t.db, { commitSha: COMMIT_B, files: [{ path: 'elsewhere/only-in-b.js', content: 'b\n' }] });
  });
  afterEach(() => t.cleanup());

  describe('getFileTree', () => {
    it('returns a nested tree for the commit: folders first, sorted, with file metadata', () => {
      const tree = getFileTree(t.db, COMMIT_A);
      expect(tree.commitSha).toBe(COMMIT_A);
      expect(tree.fileCount).toBe(FILES.length);

      const names = tree.children.map((n) => `${n.type}:${n.name}`);
      expect(names).toEqual(['dir:assets', 'dir:dist', 'dir:src', 'dir:tests', 'file:README.md']);

      const src = tree.children.find((n) => n.name === 'src');
      expect(src.path).toBe('src');
      expect(src.children.map((n) => n.name)).toEqual(['api', 'App.vue', 'app.js']);
      expect(src.fileCount).toBe(4);
      expect(src.lines).toBe(2 + 1 + 1 + 1);

      const app = src.children.find((n) => n.name === 'app.js');
      expect(app).toMatchObject({
        type: 'file',
        path: 'src/app.js',
        language: 'javascript',
        lines: 2,
        isBinary: false,
        isGenerated: false,
      });
      expect(typeof app.bytes).toBe('number');

      const png = tree.children.find((n) => n.name === 'assets').children[0];
      expect(png).toMatchObject({ name: 'logo.png', isBinary: true, lines: 0, bytes: 99 });
      const min = tree.children.find((n) => n.name === 'dist').children[0];
      expect(min.isGenerated).toBe(true);
      expect(JSON.stringify(tree)).not.toContain('only-in-b');
    });

    it('buildFileTree is pure and handles an empty list', () => {
      expect(buildFileTree([])).toEqual({ type: 'dir', name: '', path: '', children: [], fileCount: 0, lines: 0, bytes: 0 });
    });
  });

  describe('getFileContent', () => {
    it('returns the text content and blob metadata for a path at the commit', () => {
      const f = getFileContent(t.db, COMMIT_A, 'src/app.js');
      expect(f).toMatchObject({
        path: 'src/app.js',
        language: 'javascript',
        lines: 2,
        isBinary: false,
        isGenerated: false,
        content: 'export const a = 1;\nexport const b = 2;\n',
      });
      expect(f.blobSha).toMatch(/^[0-9a-f]{40}$/);
    });

    it('returns null content for binary files and null for unknown paths or the wrong commit', () => {
      const png = getFileContent(t.db, COMMIT_A, 'assets/logo.png');
      expect(png).toMatchObject({ isBinary: true, content: null, bytes: 99 });
      expect(getFileContent(t.db, COMMIT_A, 'nope.js')).toBeNull();
      expect(getFileContent(t.db, COMMIT_A, 'elsewhere/only-in-b.js')).toBeNull();
      expect(getFileContent(t.db, COMMIT_B, 'elsewhere/only-in-b.js')).not.toBeNull();
    });

    it('rejects non-string paths', () => {
      expect(() => getFileContent(t.db, COMMIT_A, 42)).toThrow(TypeError);
    });
  });

  describe('searchFilePaths', () => {
    it('matches case-insensitively on any part of the path, file-name matches first', () => {
      const hits = searchFilePaths(t.db, COMMIT_A, 'app');
      const paths = hits.map((h) => h.path);
      expect(paths[0]).toBe('src/app.js'); // basename starts with the query
      expect(paths).toContain('src/App.vue');
      expect(paths).toContain('tests/app.test.js');
      expect(paths).not.toContain('src/api/routes.js');
      expect(hits[0]).toMatchObject({ language: 'javascript', lines: 2 });
    });

    it('ranks a basename hit above a folder-only hit, shorter paths first on ties', () => {
      // Both hits are folder-only (rank 2): the shorter path wins the tie.
      const paths = searchFilePaths(t.db, COMMIT_A, 'api').map((h) => h.path);
      expect(paths).toEqual(['src/api/routes.js', 'src/api/handlers.js']);
      // 'tests/app.test.js' matches on its basename; 'tests/' alone would be folder-only.
      const tests = searchFilePaths(t.db, COMMIT_A, 'test').map((h) => h.path);
      expect(tests[0]).toBe('tests/app.test.js');
      // 'src' is in the folder of five files; the only basename hit must come first.
      seedCommit(t.db, { commitSha: COMMIT_B, files: [{ path: 'z/longer/folder/src.js', content: 'x\n' }, { path: 'src/a.js', content: 'y\n' }], runStatus: null });
      const src = searchFilePaths(t.db, COMMIT_B, 'src').map((h) => h.path);
      expect(src).toEqual(['z/longer/folder/src.js', 'src/a.js']);
    });

    it('treats LIKE wildcards literally, honours the limit and returns nothing for a blank query', () => {
      expect(searchFilePaths(t.db, COMMIT_A, '%')).toEqual([]);
      expect(searchFilePaths(t.db, COMMIT_A, '_')).toEqual([]);
      expect(searchFilePaths(t.db, COMMIT_A, '')).toEqual([]);
      expect(searchFilePaths(t.db, COMMIT_A, '   ')).toEqual([]);
      expect(searchFilePaths(t.db, COMMIT_A, 'js', { limit: 2 })).toHaveLength(2);
      expect(searchFilePaths(t.db, COMMIT_A, 'only-in-b')).toEqual([]);
    });
  });
});

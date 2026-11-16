// Read-only inventory aggregates over raw_tree_entry / raw_blob (epic 1 FR-007,
// NFR-005). Seeded temp database; binary and generated files are excluded
// from the source breakdowns and reported in the totals.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getInventory,
  getInventoryTotals,
  getLinesByLanguage,
  getSizeDistribution,
  getLargestFiles,
  getLinesByFolder,
  SIZE_BUCKETS,
} from '../../../../src/main/queries/inventoryQueries.js';
import { makeTempDb, seedCommit, SAMPLE_FILES, COMMIT_A, COMMIT_B } from './seedInsightDb.js';

describe('inventoryQueries', () => {
  let t;
  beforeEach(() => {
    t = makeTempDb();
    seedCommit(t.db, { commitSha: COMMIT_A, files: SAMPLE_FILES });
    // A second commit with different files must not leak into COMMIT_A's numbers.
    seedCommit(t.db, { commitSha: COMMIT_B, files: [{ path: 'other.js', lines: 5000 }] });
  });
  afterEach(() => t.cleanup());

  // Source files = not binary, not generated.
  const SOURCE = SAMPLE_FILES.filter((f) => !f.binary && !f.generated);
  const sourceLines = SOURCE.reduce((n, f) => n + f.lines, 0);

  it('totals count every tracked file, text lines, bytes and the binary/generated share', () => {
    const totals = getInventoryTotals(t.db, COMMIT_A);
    expect(totals.files).toBe(SAMPLE_FILES.length);
    expect(totals.binaryFiles).toBe(1);
    expect(totals.generatedFiles).toBe(1);
    expect(totals.sourceFiles).toBe(SOURCE.length);
    expect(totals.lines).toBe(sourceLines + 3); // generated lines count toward the repo total
    expect(totals.sourceLines).toBe(sourceLines);
    expect(totals.bytes).toBeGreaterThan(50_000 + 2048);
  });

  it('lines by language sum source lines per language, most lines first', () => {
    const langs = getLinesByLanguage(t.db, COMMIT_A);
    expect(langs[0]).toMatchObject({ language: 'javascript', files: 5, lines: 100 + 60 + 300 + 500 + 900 });
    const byLang = Object.fromEntries(langs.map((l) => [l.language, l]));
    expect(byLang.sql).toMatchObject({ files: 1, lines: 150 });
    expect(byLang.python).toMatchObject({ files: 1, lines: 40 });
    expect(byLang.markdown).toMatchObject({ files: 2, lines: 40 });
    expect(byLang.json).toMatchObject({ files: 1, lines: 20 });
    expect(langs.map((l) => l.lines)).toEqual([...langs.map((l) => l.lines)].sort((a, b) => b - a));
    for (const l of langs) expect(l.share).toBeCloseTo(l.lines / sourceLines, 6);
    expect(langs.reduce((n, l) => n + l.lines, 0)).toBe(sourceLines);
  });

  it('size distribution gives median, P90, max, histogram buckets and concentration over source files', () => {
    const d = getSizeDistribution(t.db, COMMIT_A);
    // Sorted source lines: 10 20 30 40 60 100 150 300 500 900 (n = 10)
    expect(d.files).toBe(10);
    expect(d.median).toBe(60); // nearest-rank: ceil(0.5 * 10) = 5th → 60
    expect(d.p90).toBe(500); // ceil(0.9 * 10) = 9th → 500
    expect(d.max).toBe(900);
    expect(d.mean).toBeCloseTo(sourceLines / 10, 6);

    expect(d.histogram.map((b) => b.label)).toEqual(SIZE_BUCKETS.map((b) => b.label));
    const byLabel = Object.fromEntries(d.histogram.map((b) => [b.label, b.files]));
    expect(byLabel['<50']).toBe(4); // 10 20 30 40
    expect(byLabel['50–100']).toBe(1); // 60   (100 belongs to the next bucket)
    expect(byLabel['100–200']).toBe(2); // 100 150
    expect(byLabel['200–400']).toBe(1); // 300
    expect(byLabel['400–800']).toBe(1); // 500
    expect(byLabel['800+']).toBe(1); // 900
    expect(d.histogram.reduce((n, b) => n + b.files, 0)).toBe(10);

    // Top 10% of files (1 file: 900 lines) hold 900 / 2110 of the lines.
    expect(d.concentration.topFiles).toBe(1);
    expect(d.concentration.topShare).toBeCloseTo(900 / sourceLines, 6);
    // Fewest files holding at least half the lines: 900 + 500 = 1400 >= 1055 → 2.
    expect(d.concentration.filesForHalf).toBe(2);
  });

  it('size distribution is all-zero/empty for a commit with no source files', () => {
    const d = getSizeDistribution(t.db, 'f'.repeat(40));
    expect(d).toMatchObject({ files: 0, median: 0, p90: 0, max: 0, mean: 0 });
    expect(d.histogram.every((b) => b.files === 0)).toBe(true);
    expect(d.concentration).toEqual({ topFiles: 0, topShare: 0, filesForHalf: 0 });
  });

  it('largest files are source files by line count, limited, excluding generated and binary', () => {
    const top = getLargestFiles(t.db, COMMIT_A, { limit: 3 });
    expect(top.map((f) => f.path)).toEqual(['tests/app.test.js', 'src/api/handlers.js', 'src/api/routes.js']);
    expect(top[0]).toMatchObject({ lines: 900, language: 'javascript' });
    expect(typeof top[0].bytes).toBe('number');
    const all = getLargestFiles(t.db, COMMIT_A, { limit: 100 });
    expect(all.map((f) => f.path)).not.toContain('dist/bundle.min.js');
    expect(all.map((f) => f.path)).not.toContain('assets/logo.png');
  });

  it('lines by folder aggregate at two levels by default, with root files under "(root)"', () => {
    const folders = getLinesByFolder(t.db, COMMIT_A);
    const byFolder = Object.fromEntries(folders.map((f) => [f.folder, f]));
    expect(byFolder['src/api']).toMatchObject({ files: 2, lines: 800 });
    expect(byFolder['src/db']).toMatchObject({ files: 2, lines: 190 });
    expect(byFolder.src).toMatchObject({ files: 2, lines: 160 }); // files directly in src/
    expect(byFolder.tests).toMatchObject({ files: 1, lines: 900 });
    expect(byFolder.docs).toMatchObject({ files: 1, lines: 30 });
    expect(byFolder['(root)']).toMatchObject({ files: 2, lines: 30 });
    expect(byFolder.dist).toBeUndefined();
    expect(folders[0].folder).toBe('tests');
  });

  it('lines by folder at depth 1 rolls everything up to the top-level folder', () => {
    const folders = getLinesByFolder(t.db, COMMIT_A, { depth: 1 });
    const byFolder = Object.fromEntries(folders.map((f) => [f.folder, f]));
    expect(byFolder.src).toMatchObject({ files: 6, lines: 160 + 800 + 190 });
    expect(byFolder['(root)']).toMatchObject({ files: 2, lines: 30 });
  });

  it('getInventory bundles every section for one commit', () => {
    const inv = getInventory(t.db, COMMIT_A);
    expect(inv.commitSha).toBe(COMMIT_A);
    expect(inv.totals.files).toBe(SAMPLE_FILES.length);
    expect(inv.languages[0].language).toBe('javascript');
    expect(inv.sizeDistribution.max).toBe(900);
    expect(inv.largestFiles[0].path).toBe('tests/app.test.js');
    expect(inv.folders[0].folder).toBe('tests');
  });

  it('never writes: every query works on a readonly connection', async () => {
    const { openInsightDb } = await import('../../../../src/shared/db/insightDb.js');
    const ro = openInsightDb(t.repoPath, { userDataPath: t.userDataPath, readonly: true });
    try {
      expect(ro.readonly).toBe(true);
      expect(getInventory(ro, COMMIT_A).totals.files).toBe(SAMPLE_FILES.length);
    } finally {
      ro.close();
    }
  });

  it('answers for a ~100k-line repo well within one second (NFR-005)', () => {
    const big = makeTempDb();
    try {
      // 4,000 files averaging 25 lines → 100k lines, across 40 folders and 6 languages.
      const exts = ['.js', '.ts', '.py', '.sql', '.md', '.json'];
      const files = [];
      for (let i = 0; i < 4000; i += 1) {
        const lines = 1 + ((i * 7919) % 49);
        files.push({
          path: `pkg${i % 40}/mod${i % 7}/file${i}${exts[i % exts.length]}`,
          lines,
          bytes: lines * 30,
          content: '', // keep seeding fast: inventory never reads content
          language: ['javascript', 'typescript', 'python', 'sql', 'markdown', 'json'][i % 6],
        });
      }
      seedCommit(big.db, { commitSha: COMMIT_A, files });
      const totalLines = files.reduce((n, f) => n + f.lines, 0);
      expect(totalLines).toBeGreaterThan(90_000);

      const started = performance.now();
      const inv = getInventory(big.db, COMMIT_A);
      const elapsed = performance.now() - started;

      expect(inv.totals.files).toBe(4000);
      expect(inv.totals.lines).toBe(totalLines);
      expect(elapsed).toBeLessThan(500);
    } finally {
      big.cleanup();
    }
  });
});

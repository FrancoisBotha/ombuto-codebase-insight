// Read-only Size & Inventory aggregates (FR-007, NFR-005) over raw_tree_entry
// joined to raw_blob for one commit. Nothing here reads file content or
// metric_* (that arrives in epic 2), and nothing writes.
//
// "Source files" are tracked files that are neither binary nor generated.
// Totals count every file and report the binary/generated share; the
// breakdowns (languages, size distribution, largest files, folders) use
// source files only, so a minified bundle doesn't dwarf the real code.

/** Histogram buckets in lines per file; `max` is exclusive, null = open-ended. */
export const SIZE_BUCKETS = Object.freeze([
  { label: '<50', min: 0, max: 50 },
  { label: '50–100', min: 50, max: 100 },
  { label: '100–200', min: 100, max: 200 },
  { label: '200–400', min: 200, max: 400 },
  { label: '400–800', min: 400, max: 800 },
  { label: '800+', min: 800, max: null },
]);

export const DEFAULT_LARGEST_LIMIT = 10;
export const DEFAULT_FOLDER_LIMIT = 25;

const SOURCE_FILES_CTE = `
  WITH src AS (
    SELECT t.path, b.language, b.line_count, b.size_bytes
    FROM raw_tree_entry t
    JOIN raw_blob b ON b.blob_sha = t.blob_sha
    WHERE t.commit_sha = @commitSha AND b.is_binary = 0 AND b.is_generated = 0
  )`;

/**
 * @param {import('better-sqlite3').Database} db
 * @param {string} commitSha
 * @returns {{files: number, sourceFiles: number, binaryFiles: number, generatedFiles: number,
 *            lines: number, sourceLines: number, bytes: number}}
 */
export function getInventoryTotals(db, commitSha) {
  const row = db
    .prepare(
      `SELECT
         count(*)                                                            AS files,
         coalesce(sum(b.is_binary), 0)                                       AS binaryFiles,
         coalesce(sum(b.is_generated), 0)                                    AS generatedFiles,
         coalesce(sum(CASE WHEN b.is_binary = 0 AND b.is_generated = 0 THEN 1 ELSE 0 END), 0) AS sourceFiles,
         coalesce(sum(CASE WHEN b.is_binary = 0 THEN b.line_count ELSE 0 END), 0)             AS lines,
         coalesce(sum(CASE WHEN b.is_binary = 0 AND b.is_generated = 0 THEN b.line_count ELSE 0 END), 0) AS sourceLines,
         coalesce(sum(b.size_bytes), 0)                                      AS bytes
       FROM raw_tree_entry t
       JOIN raw_blob b ON b.blob_sha = t.blob_sha
       WHERE t.commit_sha = ?`,
    )
    .get(commitSha);
  return {
    files: row.files,
    sourceFiles: row.sourceFiles,
    binaryFiles: row.binaryFiles,
    generatedFiles: row.generatedFiles,
    lines: row.lines,
    sourceLines: row.sourceLines,
    bytes: row.bytes,
  };
}

/**
 * Source lines per language, most lines first. `language` is the raw_blob
 * value (null when the extension is unknown); `share` is the fraction of all
 * source lines.
 *
 * @returns {Array<{language: string|null, files: number, lines: number, bytes: number, share: number}>}
 */
export function getLinesByLanguage(db, commitSha) {
  const rows = db
    .prepare(
      `${SOURCE_FILES_CTE}
       SELECT language, count(*) AS files, sum(line_count) AS lines, sum(size_bytes) AS bytes
       FROM src
       GROUP BY language
       ORDER BY lines DESC, files DESC, language`,
    )
    .all({ commitSha });
  const total = rows.reduce((n, r) => n + r.lines, 0);
  return rows.map((r) => ({
    language: r.language,
    files: r.files,
    lines: r.lines,
    bytes: r.bytes,
    share: total > 0 ? r.lines / total : 0,
  }));
}

/** Nearest-rank percentile over source line counts: the ceil(p * n)-th smallest. */
function percentileStmt(db) {
  return db.prepare(
    `${SOURCE_FILES_CTE}
     SELECT line_count FROM src ORDER BY line_count LIMIT 1 OFFSET @offset`,
  );
}

/**
 * File size distribution in lines per source file: median, P90, max, mean,
 * the histogram over SIZE_BUCKETS and two concentration measures (the share
 * of lines in the largest 10% of files, and the fewest files that hold half
 * the lines).
 *
 * @returns {{files: number, lines: number, median: number, p90: number, max: number, mean: number,
 *            histogram: Array<{label: string, min: number, max: number|null, files: number, lines: number}>,
 *            concentration: {topFiles: number, topShare: number, filesForHalf: number}}}
 */
export function getSizeDistribution(db, commitSha) {
  const agg = db
    .prepare(
      `${SOURCE_FILES_CTE}
       SELECT count(*) AS files, coalesce(sum(line_count), 0) AS lines, coalesce(max(line_count), 0) AS max FROM src`,
    )
    .get({ commitSha });
  const n = agg.files;

  const bucketCase = SIZE_BUCKETS.map(
    (b, i) => `WHEN line_count >= ${b.min}${b.max === null ? '' : ` AND line_count < ${b.max}`} THEN ${i}`,
  ).join(' ');
  const bucketRows = db
    .prepare(
      `${SOURCE_FILES_CTE}
       SELECT CASE ${bucketCase} END AS bucket, count(*) AS files, sum(line_count) AS lines
       FROM src GROUP BY bucket`,
    )
    .all({ commitSha });
  const byBucket = new Map(bucketRows.map((r) => [r.bucket, r]));
  const histogram = SIZE_BUCKETS.map((b, i) => ({
    label: b.label,
    min: b.min,
    max: b.max,
    files: byBucket.get(i)?.files ?? 0,
    lines: byBucket.get(i)?.lines ?? 0,
  }));

  if (n === 0) {
    return {
      files: 0,
      lines: 0,
      median: 0,
      p90: 0,
      max: 0,
      mean: 0,
      histogram,
      concentration: { topFiles: 0, topShare: 0, filesForHalf: 0 },
    };
  }

  const pct = percentileStmt(db);
  const rank = (p) => Math.max(0, Math.ceil(p * n) - 1);
  const median = pct.get({ commitSha, offset: rank(0.5) }).line_count;
  const p90 = pct.get({ commitSha, offset: rank(0.9) }).line_count;

  const topFiles = Math.max(1, Math.ceil(n * 0.1));
  const top = db
    .prepare(
      `${SOURCE_FILES_CTE}
       SELECT coalesce(sum(line_count), 0) AS lines FROM (SELECT line_count FROM src ORDER BY line_count DESC LIMIT @topFiles)`,
    )
    .get({ commitSha, topFiles });

  // Fewest files (largest first) whose running total reaches half the lines.
  const half = db
    .prepare(
      `${SOURCE_FILES_CTE}, ranked AS (
         SELECT line_count,
                sum(line_count) OVER (ORDER BY line_count DESC ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS running,
                row_number() OVER (ORDER BY line_count DESC) AS rn
         FROM src
       )
       SELECT min(rn) AS n FROM ranked WHERE running * 2 >= @total`,
    )
    .get({ commitSha, total: agg.lines });

  return {
    files: n,
    lines: agg.lines,
    median,
    p90,
    max: agg.max,
    mean: agg.lines / n,
    histogram,
    concentration: {
      topFiles,
      topShare: agg.lines > 0 ? top.lines / agg.lines : 0,
      filesForHalf: agg.lines > 0 ? half.n ?? 0 : 0,
    },
  };
}

/**
 * Largest source files by line count.
 * @returns {Array<{path: string, language: string|null, lines: number, bytes: number}>}
 */
export function getLargestFiles(db, commitSha, { limit = DEFAULT_LARGEST_LIMIT } = {}) {
  return db
    .prepare(
      `${SOURCE_FILES_CTE}
       SELECT path, language, line_count AS lines, size_bytes AS bytes
       FROM src ORDER BY line_count DESC, path LIMIT @limit`,
    )
    .all({ commitSha, limit: clampLimit(limit, DEFAULT_LARGEST_LIMIT) });
}

/**
 * Source lines per folder, most lines first. `depth` 1 groups by top-level
 * folder; `depth` 2 (default) by the first two path segments, so `src/api`
 * and `src/db` are separate while files directly in `src/` stay under `src`.
 * Files at the repository root are reported under `(root)`.
 *
 * @returns {Array<{folder: string, files: number, lines: number, bytes: number}>}
 */
export function getLinesByFolder(db, commitSha, { depth = 2, limit = DEFAULT_FOLDER_LIMIT } = {}) {
  const folderExpr =
    depth <= 1
      ? `CASE WHEN seg1 IS NULL THEN '(root)' ELSE seg1 END`
      : `CASE
           WHEN seg1 IS NULL THEN '(root)'
           WHEN instr(rest, '/') = 0 THEN seg1
           ELSE seg1 || '/' || substr(rest, 1, instr(rest, '/') - 1)
         END`;
  return db
    .prepare(
      `${SOURCE_FILES_CTE}, split AS (
         SELECT line_count, size_bytes,
                CASE WHEN instr(path, '/') = 0 THEN NULL ELSE substr(path, 1, instr(path, '/') - 1) END AS seg1,
                CASE WHEN instr(path, '/') = 0 THEN NULL ELSE substr(path, instr(path, '/') + 1) END AS rest
         FROM src
       ), folders AS (
         SELECT ${folderExpr} AS folder, line_count, size_bytes FROM split
       )
       SELECT folder, count(*) AS files, sum(line_count) AS lines, sum(size_bytes) AS bytes
       FROM folders GROUP BY folder ORDER BY lines DESC, files DESC, folder LIMIT @limit`,
    )
    .all({ commitSha, limit: clampLimit(limit, DEFAULT_FOLDER_LIMIT) });
}

/**
 * Everything the Size & Inventory screen needs for one commit, in one call.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} commitSha
 * @param {{largestLimit?: number, folderDepth?: number, folderLimit?: number}} [options]
 */
export function getInventory(db, commitSha, options = {}) {
  return {
    commitSha,
    totals: getInventoryTotals(db, commitSha),
    languages: getLinesByLanguage(db, commitSha),
    sizeDistribution: getSizeDistribution(db, commitSha),
    largestFiles: getLargestFiles(db, commitSha, { limit: options.largestLimit }),
    folders: getLinesByFolder(db, commitSha, { depth: options.folderDepth, limit: options.folderLimit }),
  };
}

function clampLimit(limit, fallback) {
  const n = Number(limit);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(Math.floor(n), 1000);
}

// Read-only queries about the analysed commit and its pipeline runs, for the
// title bar, sidebar footer, status bar, Indexing screen and the FR-009
// "open straight from the database" decision. Every function takes an open
// insight.db (readonly in main) and never writes.

function runFromRow(row) {
  if (!row) return null;
  return {
    runId: row.id,
    commitSha: row.commit_sha,
    status: row.status,
    startedAt: row.started_at,
    finishedAt: row.finished_at,
    error: row.error,
  };
}

/**
 * Latest run row for a commit (any status), or null.
 * @param {import('better-sqlite3').Database} db
 * @param {string} commitSha
 */
export function findLatestRun(db, commitSha) {
  return runFromRow(
    db.prepare('SELECT * FROM pipeline_run WHERE commit_sha = ? ORDER BY id DESC LIMIT 1').get(commitSha),
  );
}

/**
 * Latest completed (`done`) run for exactly this commit, or null (FR-009).
 * @param {import('better-sqlite3').Database} db
 * @param {string} commitSha
 */
export function findCompletedRun(db, commitSha) {
  return runFromRow(
    db
      .prepare("SELECT * FROM pipeline_run WHERE commit_sha = ? AND status = 'done' ORDER BY id DESC LIMIT 1")
      .get(commitSha),
  );
}

/**
 * Repo-level facts for one commit: branch, HEAD sha, commit and analysed
 * times, tracked file count and the latest run. Null if the commit was never
 * recorded in raw_snapshot. Name and path are added by main (they come from
 * the folder, not the database).
 *
 * @param {import('better-sqlite3').Database} db
 * @param {string} commitSha
 * @returns {{commitSha: string, branch: string|null, committedAt: number, analysedAt: number,
 *            fileCount: number, lastRun: object|null} | null}
 */
export function getRepoInfo(db, commitSha) {
  const snap = db.prepare('SELECT commit_sha, branch, committed_at, analysed_at FROM raw_snapshot WHERE commit_sha = ?').get(commitSha);
  if (!snap) return null;
  const { n } = db.prepare('SELECT count(*) AS n FROM raw_tree_entry WHERE commit_sha = ?').get(commitSha);
  return {
    commitSha: snap.commit_sha,
    branch: snap.branch,
    committedAt: snap.committed_at,
    analysedAt: snap.analysed_at,
    fileCount: n,
    lastRun: findLatestRun(db, commitSha),
  };
}

/**
 * A pipeline run with its stages, by id or (when omitted) the most recent run
 * in the database. Null when there is no such run.
 *
 * @param {import('better-sqlite3').Database} db
 * @param {number} [runId]
 * @returns {{runId: number, commitSha: string, status: string, startedAt: number, finishedAt: number|null,
 *            error: string|null, stages: Array<{stage: string, status: string, startedAt: number|null,
 *            finishedAt: number|null, rowsWritten: number|null, error: string|null}>} | null}
 */
export function getRunStatus(db, runId) {
  const row =
    runId === undefined || runId === null
      ? db.prepare('SELECT * FROM pipeline_run ORDER BY id DESC LIMIT 1').get()
      : db.prepare('SELECT * FROM pipeline_run WHERE id = ?').get(runId);
  if (!row) return null;
  const stages = db
    .prepare('SELECT stage, status, started_at, finished_at, rows_written, error FROM pipeline_stage WHERE run_id = ? ORDER BY rowid')
    .all(row.id)
    .map((s) => ({
      stage: s.stage,
      status: s.status,
      startedAt: s.started_at,
      finishedAt: s.finished_at,
      rowsWritten: s.rows_written,
      error: s.error,
    }));
  return { ...runFromRow(row), stages };
}

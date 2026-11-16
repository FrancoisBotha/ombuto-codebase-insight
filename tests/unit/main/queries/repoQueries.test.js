// Read-only repo / run queries for the title bar, sidebar footer, status bar
// and Indexing screen: repo info, completed-run lookup (FR-009) and run status.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { getRepoInfo, findCompletedRun, getRunStatus } from '../../../../src/main/queries/repoQueries.js';
import { makeTempDb, seedCommit, COMMIT_A, COMMIT_B } from './seedInsightDb.js';

describe('repoQueries', () => {
  let t;
  beforeEach(() => {
    t = makeTempDb();
  });
  afterEach(() => t.cleanup());

  it('getRepoInfo returns branch, HEAD sha, analysed time, file count and the last run for a commit', () => {
    seedCommit(t.db, {
      commitSha: COMMIT_A,
      branch: 'main',
      committedAt: 1_700_000_000,
      analysedAt: 1_700_000_100,
      files: [{ path: 'a.js', lines: 1 }, { path: 'b.js', lines: 2 }, { path: 'c/d.js', lines: 3 }],
    });
    const info = getRepoInfo(t.db, COMMIT_A);
    expect(info).toMatchObject({
      commitSha: COMMIT_A,
      branch: 'main',
      committedAt: 1_700_000_000,
      analysedAt: 1_700_000_100,
      fileCount: 3,
    });
    expect(info.lastRun).toMatchObject({ status: 'done', commitSha: COMMIT_A });
    expect(typeof info.lastRun.runId).toBe('number');
  });

  it('getRepoInfo returns null for a commit that was never analysed', () => {
    expect(getRepoInfo(t.db, COMMIT_A)).toBeNull();
  });

  it('findCompletedRun finds the latest done run for exactly that commit (FR-009)', () => {
    seedCommit(t.db, { commitSha: COMMIT_A, files: [{ path: 'a.js', lines: 1 }], runStatus: 'failed', runError: 'boom' });
    expect(findCompletedRun(t.db, COMMIT_A)).toBeNull();

    const { runId } = seedCommit(t.db, { commitSha: COMMIT_A, files: [{ path: 'a.js', lines: 1 }], runStatus: 'done' });
    const found = findCompletedRun(t.db, COMMIT_A);
    expect(found).toMatchObject({ runId, commitSha: COMMIT_A, status: 'done' });
    expect(typeof found.finishedAt).toBe('number');

    // A different HEAD has no completed run → caller starts a new run.
    expect(findCompletedRun(t.db, COMMIT_B)).toBeNull();
    seedCommit(t.db, { commitSha: COMMIT_B, files: [{ path: 'z.js', lines: 1 }], runStatus: 'running' });
    expect(findCompletedRun(t.db, COMMIT_B)).toBeNull();
  });

  it('getRunStatus returns the run row with every stage, by id or latest', () => {
    const first = seedCommit(t.db, { commitSha: COMMIT_A, files: [{ path: 'a.js', lines: 1 }], runStatus: 'failed', runError: 'disk full' });
    const second = seedCommit(t.db, { commitSha: COMMIT_B, files: [{ path: 'b.js', lines: 1 }], runStatus: 'running' });

    const latest = getRunStatus(t.db);
    expect(latest).toMatchObject({ runId: second.runId, commitSha: COMMIT_B, status: 'running', error: null, finishedAt: null });
    expect(latest.stages.map((s) => s.stage)).toEqual([
      'extract_files',
      'extract_history',
      'transform',
      'deps_secrets',
      'load_reporting',
      'ai_enrichment',
    ]);
    expect(latest.stages[0]).toMatchObject({ status: 'running', rowsWritten: 1 });
    expect(latest.stages[1]).toMatchObject({ status: 'pending' });

    const failed = getRunStatus(t.db, first.runId);
    expect(failed).toMatchObject({ runId: first.runId, status: 'failed', error: 'disk full' });
    expect(failed.stages[0]).toMatchObject({ stage: 'extract_files', status: 'failed', error: 'disk full' });
    expect(typeof failed.startedAt).toBe('number');
  });

  it('getRunStatus is null when there is no run', () => {
    expect(getRunStatus(t.db)).toBeNull();
    expect(getRunStatus(t.db, 999)).toBeNull();
  });
});

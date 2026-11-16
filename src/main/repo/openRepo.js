// Repo-open orchestration for the main process (epic 1 FR-001, FR-003,
// FR-004, FR-009). Pure of Electron: main injects the recents store, the
// userData folder and a `startRun` that posts to the pipeline worker, so unit
// tests drive it against a fixture repository.
//
// open(folder):
//   1. validate the folder and resolve the git work-tree root;
//   2. resolve HEAD (sha, branch, commit time) through the safe git runner;
//   3. upsert the repo in recents;
//   4. if insight.db already holds a completed run for that HEAD → 'ready',
//      no run (FR-009, NFR-005). Otherwise → start a run → 'indexing'.
// refresh(): a full re-run of the current repo regardless of completed runs.
import fs from 'node:fs';
import path from 'node:path';
import { validateRepoFolder } from './validateRepoFolder.js';
import { runGit as defaultRunGit, GitError } from '../../shared/git/gitRunner.js';
import { repoId as computeRepoId, insightDbPath, openInsightDb } from '../../shared/db/insightDb.js';
import { findCompletedRun } from '../queries/repoQueries.js';

/**
 * HEAD of a work tree: `{ sha, branch, committedAt }`; `branch` is null when
 * detached. Returns null for a repository with no commits yet.
 *
 * @param {string} repoRoot
 * @param {{runGit?: typeof defaultRunGit}} [deps]
 */
export async function resolveHead(repoRoot, { runGit = defaultRunGit } = {}) {
  let sha;
  let committedAt;
  try {
    const { stdout } = await runGit(['log', '-1', '--format=%H %ct', 'HEAD'], { cwd: repoRoot, timeoutMs: 15_000 });
    const [h, ct] = String(stdout).trim().split(/\s+/);
    sha = h;
    committedAt = Number.parseInt(ct, 10);
  } catch (err) {
    if (err instanceof GitError && err.code === 'EXIT' && /does not have any commits|unknown revision|ambiguous argument|bad default revision/i.test(err.stderr)) {
      return null;
    }
    throw err;
  }
  if (!/^[0-9a-f]{40,64}$/.test(sha ?? '')) return null;

  const { stdout: ref } = await runGit(['rev-parse', '--abbrev-ref', 'HEAD'], { cwd: repoRoot, timeoutMs: 15_000 });
  const branchName = String(ref).trim();
  return {
    sha,
    branch: branchName === '' || branchName === 'HEAD' ? null : branchName,
    committedAt: Number.isFinite(committedAt) ? committedAt : null,
  };
}

/**
 * Looks for a completed run for `headSha` in the repo's insight.db, opening
 * it readonly only if the file exists. Null when there is no database, the
 * database is unreadable, or no run is done for that commit.
 */
export function findCompletedRunFor(repoRoot, headSha, { userDataPath, openDb = openInsightDb } = {}) {
  if (!fs.existsSync(insightDbPath(computeRepoId(repoRoot), { userDataPath }))) return null;
  let db = null;
  try {
    db = openDb(repoRoot, { userDataPath, readonly: true });
    return findCompletedRun(db, headSha);
  } catch {
    // A corrupt or mismatched database is treated as "not analysed": the
    // worker recreates what it can on the next run.
    return null;
  } finally {
    if (db?.open) db.close();
  }
}

/**
 * @param {object} deps
 * @param {ReturnType<import('./recentsStore.js').createRecentsStore>} deps.recents
 * @param {string} deps.userDataPath
 * @param {(msg: {repoPath: string, repoId: string, headSha: string, branch: string|null, committedAt: number|null}) => (void|Promise<void>)} deps.startRun
 * @param {typeof defaultRunGit} [deps.runGit]
 * @param {typeof openInsightDb} [deps.openDb]
 */
export function createRepoOpener({ recents, userDataPath, startRun, runGit = defaultRunGit, openDb = openInsightDb }) {
  if (!recents) throw new TypeError('createRepoOpener needs a recents store');
  if (typeof userDataPath !== 'string' || userDataPath === '') throw new TypeError('createRepoOpener needs userDataPath');
  if (typeof startRun !== 'function') throw new TypeError('createRepoOpener needs startRun(msg)');

  /** The repo currently open in the app, or null. */
  let current = null;

  function describe(root, id, head, entry) {
    return {
      path: root,
      repoId: id,
      name: entry?.displayName ?? path.basename(root),
      headSha: head.sha,
      branch: head.branch,
      committedAt: head.committedAt,
      lastAnalysedAt: entry?.lastAnalysedAt ?? null,
    };
  }

  async function launchRun(repo) {
    try {
      await startRun({
        repoPath: repo.path,
        repoId: repo.repoId,
        headSha: repo.headSha,
        branch: repo.branch,
        committedAt: repo.committedAt,
      });
      return { ok: true, status: 'indexing', repo, run: null };
    } catch (err) {
      return {
        ok: false,
        reason: 'run-failed',
        message: `Could not start the analysis: ${err?.message ?? String(err)}`,
        repo,
      };
    }
  }

  return {
    /** @returns {Promise<{ok: true, status: 'ready'|'indexing', repo: object, run: object|null} | {ok: false, reason: string, message: string}>} */
    async open(folderPath) {
      const valid = await validateRepoFolder(folderPath, { runGit });
      if (!valid.ok) return valid;
      const root = valid.root;

      let head;
      try {
        head = await resolveHead(root, { runGit });
      } catch (err) {
        return { ok: false, reason: 'git-error', message: `git could not read HEAD of "${root}": ${err?.message ?? err}` };
      }
      if (!head) {
        return {
          ok: false,
          reason: 'no-commits',
          message: `"${root}" has no commits yet. Commit something first, then open it again.`,
        };
      }

      const id = computeRepoId(root);
      const entry = recents.upsert({ path: root, repoId: id });
      const repo = describe(root, id, head, entry);
      current = repo;

      const completed = findCompletedRunFor(root, head.sha, { userDataPath, openDb });
      if (completed) return { ok: true, status: 'ready', repo, run: completed };
      return launchRun(repo);
    },

    /** Full re-run of the current repo at its current HEAD. */
    async refresh() {
      if (!current) return { ok: false, reason: 'no-repo', message: 'No repository is open.' };
      let head;
      try {
        head = await resolveHead(current.path, { runGit });
      } catch (err) {
        return { ok: false, reason: 'git-error', message: `git could not read HEAD of "${current.path}": ${err?.message ?? err}` };
      }
      if (!head) return { ok: false, reason: 'no-commits', message: `"${current.path}" has no commits.` };
      const entry = recents.get(current.repoId);
      current = describe(current.path, current.repoId, head, entry);
      return launchRun(current);
    },

    /** The repo currently open, or null. */
    current() {
      return current ? { ...current } : null;
    },

    /** Forget the current repo (after remove-from-recents, for example). */
    close() {
      current = null;
    },
  };
}

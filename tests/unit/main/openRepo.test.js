// Repo-open orchestration (FR-001, FR-003, FR-004, FR-009): validate the
// folder, resolve HEAD, upsert recents, then either open straight from the
// database (HEAD already has a completed run) or start a run in the worker.
// Driven against a real fixture repository built with simple-git.
import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { createRepoOpener, resolveHead } from '../../../src/main/repo/openRepo.js';
import { createRecentsStore } from '../../../src/main/repo/recentsStore.js';
import { openInsightDb, repoId } from '../../../src/shared/db/insightDb.js';
import { runPipeline } from '../../../src/worker/stageRunner.js';

function memoryStore() {
  const data = {};
  return { get: (k, d) => (k in data ? data[k] : d), set: (k, v) => (data[k] = v) };
}

async function makeRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-open-'));
  const git = simpleGit(dir);
  await git.init(['--initial-branch=main']);
  await git.addConfig('user.email', 'test@example.com');
  await git.addConfig('user.name', 'Test');
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'a.js'), 'const a = 1;\n');
  await git.add('.');
  await git.commit('one');
  return { dir, git };
}

/** Records a completed run for `headSha` in the repo's insight.db, as the worker would. */
function seedCompletedRun(repoPath, userDataPath, headSha) {
  const db = openInsightDb(repoPath, { userDataPath });
  try {
    const r = runPipeline({
      db,
      stages: [{ id: 'extract_files', label: 'Extract files', run: () => 0 }],
      startRun: { repoPath, repoId: repoId(repoPath), headSha, branch: 'main' },
    });
    return r.runId;
  } finally {
    db.close();
  }
}

describe('openRepo', () => {
  let repo;
  let userDataPath;
  let recents;
  let started;
  let opener;

  beforeAll(async () => {
    repo = await makeRepo();
  });
  afterAll(() => fs.rmSync(repo.dir, { recursive: true, force: true }));

  beforeEach(() => {
    userDataPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-userdata-'));
    recents = createRecentsStore({ store: memoryStore() });
    started = [];
    opener = createRepoOpener({
      recents,
      userDataPath,
      startRun: async (msg) => {
        started.push(msg);
      },
    });
  });
  afterEach(() => fs.rmSync(userDataPath, { recursive: true, force: true }));

  describe('resolveHead', () => {
    it('returns the HEAD sha, branch and commit time of a work tree', async () => {
      const head = await resolveHead(repo.dir);
      const sha = (await repo.git.revparse(['HEAD'])).trim();
      expect(head).toMatchObject({ sha, branch: 'main' });
      expect(head.committedAt).toBeGreaterThan(1_600_000_000);
    });

    it('reports a detached HEAD as branch null', async () => {
      const sha = (await repo.git.revparse(['HEAD'])).trim();
      await repo.git.checkout(sha);
      try {
        expect((await resolveHead(repo.dir)).branch).toBeNull();
      } finally {
        await repo.git.checkout('main');
      }
    });

    it('returns null for a repository without commits', async () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-empty-'));
      try {
        await simpleGit(empty).init();
        expect(await resolveHead(empty)).toBeNull();
      } finally {
        fs.rmSync(empty, { recursive: true, force: true });
      }
    });
  });

  describe('open', () => {
    it('rejects a folder that is not a git work tree with a clear message and touches nothing', async () => {
      const plain = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-plain-'));
      try {
        const result = await opener.open(plain);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('not-a-git-repo');
        expect(result.message).toMatch(/not inside a git repository/i);
        expect(recents.list()).toEqual([]);
        expect(started).toEqual([]);
      } finally {
        fs.rmSync(plain, { recursive: true, force: true });
      }
    });

    it('rejects an empty path and a missing folder', async () => {
      expect((await opener.open('')).reason).toBe('invalid-path');
      expect((await opener.open(path.join(repo.dir, 'does-not-exist'))).reason).toBe('not-found');
    });

    it('validates, upserts recents and starts a worker run when HEAD has no completed run', async () => {
      const sha = (await repo.git.revparse(['HEAD'])).trim();
      const result = await opener.open(path.join(repo.dir, 'src')); // a sub-folder resolves to the root

      expect(result.ok).toBe(true);
      expect(result.status).toBe('indexing');
      expect(result.repo).toMatchObject({
        path: path.resolve(repo.dir),
        repoId: repoId(repo.dir),
        name: path.basename(repo.dir),
        headSha: sha,
        branch: 'main',
      });
      expect(result.repo.lastAnalysedAt).toBeNull();

      expect(started).toHaveLength(1);
      expect(started[0]).toMatchObject({ repoPath: path.resolve(repo.dir), repoId: repoId(repo.dir), headSha: sha, branch: 'main' });
      expect(typeof started[0].committedAt).toBe('number');

      const entries = recents.list();
      expect(entries).toHaveLength(1);
      expect(entries[0]).toMatchObject({ repoId: repoId(repo.dir), path: path.resolve(repo.dir), displayName: path.basename(repo.dir) });
    });

    it('opens straight from the database with no run when HEAD already has a completed run (FR-009)', async () => {
      const sha = (await repo.git.revparse(['HEAD'])).trim();
      const runId = seedCompletedRun(repo.dir, userDataPath, sha);

      const result = await opener.open(repo.dir);
      expect(result.ok).toBe(true);
      expect(result.status).toBe('ready');
      expect(result.run).toMatchObject({ runId, status: 'done', commitSha: sha });
      expect(result.repo.headSha).toBe(sha);
      expect(started).toEqual([]);
      expect(recents.list()[0].repoId).toBe(repoId(repo.dir));
    });

    it('a different HEAD starts a new run even though an older HEAD was analysed', async () => {
      const oldSha = (await repo.git.revparse(['HEAD'])).trim();
      seedCompletedRun(repo.dir, userDataPath, oldSha);

      fs.writeFileSync(path.join(repo.dir, 'src', 'b.js'), 'const b = 2;\n');
      await repo.git.add('.');
      await repo.git.commit('two');
      const newSha = (await repo.git.revparse(['HEAD'])).trim();
      expect(newSha).not.toBe(oldSha);

      const result = await opener.open(repo.dir);
      expect(result.status).toBe('indexing');
      expect(result.repo.headSha).toBe(newSha);
      expect(started.map((s) => s.headSha)).toEqual([newSha]);
    });

    it('refresh always starts a full re-run of the current repo, even with a completed run', async () => {
      const sha = (await repo.git.revparse(['HEAD'])).trim();
      seedCompletedRun(repo.dir, userDataPath, sha);
      const opened = await opener.open(repo.dir);
      expect(opened.status).toBe('ready');

      const refreshed = await opener.refresh();
      expect(refreshed.ok).toBe(true);
      expect(refreshed.status).toBe('indexing');
      expect(started.map((s) => s.headSha)).toEqual([sha]);
      expect(opener.current().headSha).toBe(sha);
    });

    it('refresh with no open repo reports that', async () => {
      const result = await opener.refresh();
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('no-repo');
      expect(opener.current()).toBeNull();
    });

    it('reports a repository with no commits instead of starting a run', async () => {
      const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-empty-'));
      try {
        await simpleGit(empty).init();
        const result = await opener.open(empty);
        expect(result.ok).toBe(false);
        expect(result.reason).toBe('no-commits');
        expect(started).toEqual([]);
      } finally {
        fs.rmSync(empty, { recursive: true, force: true });
      }
    });

    it('surfaces a failing worker start as an error result instead of throwing', async () => {
      const failing = createRepoOpener({
        recents,
        userDataPath,
        startRun: async () => {
          throw new Error('worker unavailable');
        },
      });
      const result = await failing.open(repo.dir);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('run-failed');
      expect(result.message).toMatch(/worker unavailable/);
    });
  });
});

// The worker's message loop (src/worker/pipeline.js) driven through a fake
// parentPort: startRun opens insight.db via insightDb.js, runs the registered
// stages, posts progress to main, and survives failures for a later run.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { insightDbPath, repoId } from '../../../src/shared/db/insightDb.js';
import { WORKER_MSG } from '../../../src/shared/ipcChannels.js';
import { attachWorker } from '../../../src/worker/pipeline.js';
import { STAGES } from '../../../src/worker/stages/index.js';

const SHA = 'c'.repeat(40);

class FakePort extends EventEmitter {
  constructor() {
    super();
    this.posted = [];
  }
  postMessage(msg) {
    this.posted.push(msg);
  }
  send(msg) {
    this.emit('message', { data: msg });
  }
  types() {
    return this.posted.map((m) => m.type);
  }
}

describe('pipeline worker', () => {
  let userDataDir;
  let repoPath;
  let port;

  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-userdata-'));
    repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-repo-'));
    port = new FakePort();
  });

  afterEach(() => {
    fs.rmSync(userDataDir, { recursive: true, force: true });
    fs.rmSync(repoPath, { recursive: true, force: true });
  });

  const startRun = (extra = {}) => ({
    type: WORKER_MSG.START_RUN,
    repoPath,
    repoId: repoId(repoPath),
    userDataDir,
    headSha: SHA,
    ...extra,
  });

  it('still answers ping with pong', () => {
    attachWorker(port);
    port.send({ type: WORKER_MSG.PING });
    expect(port.types()).toEqual([WORKER_MSG.PONG]);
  });

  it('on startRun opens (creates) insight.db under userDataDir and completes a run', () => {
    attachWorker(port, { stages: [{ id: 'extract_files', label: 'Extract files', run: () => 0 }] });
    port.send(startRun());

    expect(fs.existsSync(insightDbPath(repoId(repoPath), { userDataPath: userDataDir }))).toBe(true);
    expect(port.types()[0]).toBe(WORKER_MSG.RUN_STARTED);
    expect(port.types().at(-1)).toBe(WORKER_MSG.RUN_COMPLETED);
    expect(port.posted.at(-1)).toMatchObject({ repoId: repoId(repoPath), commitSha: SHA });
  });

  it('registers the real stage list; stages without an implementation are skipped', async () => {
    // The real extract_files stage (OPINV-004) reads the repository, so the
    // temp folder has to be a git repo with a commit at the given head sha.
    const git = simpleGit(repoPath);
    await git.init();
    await git.addConfig('user.email', 'test@example.com');
    await git.addConfig('user.name', 'Test');
    fs.writeFileSync(path.join(repoPath, 'a.txt'), 'hello\n');
    await git.add('.');
    await git.commit('init');
    const headSha = (await git.revparse(['HEAD'])).trim();

    expect(STAGES.length).toBeGreaterThan(0);
    for (const s of STAGES) {
      expect(typeof s.id).toBe('string');
      expect(typeof s.label).toBe('string');
      expect(s.run === null || typeof s.run === 'function').toBe(true);
    }
    expect(STAGES.map((s) => s.id)).toEqual([
      'extract_files',
      'extract_history',
      'transform',
      'deps_secrets',
      'load_reporting',
      'ai_enrichment',
    ]);

    attachWorker(port);
    port.send(startRun({ headSha }));
    const skipped = port.posted.filter((m) => m.type === WORKER_MSG.STAGE_SKIPPED).map((m) => m.stage);
    const unimplemented = STAGES.filter((s) => s.run === null).map((s) => s.id);
    expect(skipped).toEqual(unimplemented);
    expect(port.types().at(-1)).toBe(WORKER_MSG.RUN_COMPLETED);
  });

  it('a failing stage posts stage and run failed with the message, and the worker serves a later run', () => {
    let fail = true;
    attachWorker(port, {
      stages: [
        {
          id: 'extract_files',
          label: 'Extract files',
          run: () => {
            if (fail) throw new Error('boom');
            return 0;
          },
        },
      ],
    });

    port.send(startRun());
    expect(port.types()).toEqual([
      WORKER_MSG.RUN_STARTED,
      WORKER_MSG.STAGE_STARTED,
      WORKER_MSG.STAGE_FAILED,
      WORKER_MSG.RUN_FAILED,
    ]);
    expect(port.posted[2]).toMatchObject({ stage: 'extract_files', error: 'boom' });
    expect(port.posted[3]).toMatchObject({ commitSha: SHA, error: 'boom' });

    fail = false;
    port.posted.length = 0;
    port.send(startRun());
    expect(port.types().at(-1)).toBe(WORKER_MSG.RUN_COMPLETED);
  });

  it('a bad start message posts run failed without a run id and keeps the worker alive', () => {
    attachWorker(port, { stages: [] });
    port.send(startRun({ headSha: undefined }));
    expect(port.types()).toEqual([WORKER_MSG.RUN_FAILED]);
    expect(port.posted[0]).toMatchObject({ runId: null, repoId: repoId(repoPath) });
    expect(typeof port.posted[0].error).toBe('string');

    port.send({ type: WORKER_MSG.PING });
    expect(port.types().at(-1)).toBe(WORKER_MSG.PONG);
  });

  it('ignores unknown messages', () => {
    attachWorker(port);
    port.send({ type: 'nope' });
    port.send(undefined);
    expect(port.posted).toEqual([]);
  });
});

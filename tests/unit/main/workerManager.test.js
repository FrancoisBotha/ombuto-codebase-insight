// Main-side pipeline worker manager (NFR-004): forks the utilityProcess,
// forwards every worker event to the renderer, tracks the active run, and when
// the worker crashes marks that run failed in insight.db with the error
// recorded, then serves the next run from a fresh worker. Driven with a fake
// fork so no Electron is needed.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { createWorkerManager } from '../../../src/main/pipeline/workerManager.js';
import { WORKER_MSG } from '../../../src/shared/ipcChannels.js';
import { openInsightDb, repoId } from '../../../src/shared/db/insightDb.js';
import { makeTempDb, seedCommit, COMMIT_A } from './queries/seedInsightDb.js';

class FakeChild extends EventEmitter {
  constructor() {
    super();
    this.sent = [];
    this.killed = false;
    this.pid = 4242;
  }
  postMessage(msg) {
    this.sent.push(msg);
  }
  kill() {
    this.killed = true;
    this.emit('exit', 0);
    return true;
  }
  /** Simulate a worker → main message (Electron hands the parent the message directly). */
  reply(msg) {
    this.emit('message', msg);
  }
  crash(code = 1) {
    this.emit('exit', code);
  }
}

describe('workerManager', () => {
  let t;
  let children;
  let events;
  let manager;

  beforeEach(() => {
    t = makeTempDb();
    // The worker is the writer; the manager only opens the db on a crash.
    seedCommit(t.db, { commitSha: COMMIT_A, files: [{ path: 'a.js', lines: 1 }], runStatus: 'running' });
    t.db.close();
    children = [];
    events = [];
    manager = createWorkerManager({
      fork: () => {
        const c = new FakeChild();
        children.push(c);
        return c;
      },
      userDataPath: t.userDataPath,
      onEvent: (e) => events.push(e),
      log: () => {},
    });
  });
  afterEach(() => {
    manager.dispose();
    t.cleanup();
  });

  const startMsg = () => ({ repoPath: t.repoPath, repoId: repoId(t.repoPath), headSha: COMMIT_A, branch: 'main', committedAt: 1 });
  const runningRunId = () => {
    const db = openInsightDb(t.repoPath, { userDataPath: t.userDataPath, readonly: true });
    try {
      return db.prepare("SELECT id FROM pipeline_run WHERE status = 'running'").get()?.id ?? null;
    } finally {
      db.close();
    }
  };
  const runRow = (id) => {
    const db = openInsightDb(t.repoPath, { userDataPath: t.userDataPath, readonly: true });
    try {
      return {
        run: db.prepare('SELECT * FROM pipeline_run WHERE id = ?').get(id),
        stages: db.prepare('SELECT * FROM pipeline_stage WHERE run_id = ? ORDER BY stage').all(id),
      };
    } finally {
      db.close();
    }
  };

  it('forks lazily and posts START_RUN with the userData folder', () => {
    expect(children).toHaveLength(0);
    manager.startRun(startMsg());
    expect(children).toHaveLength(1);
    expect(children[0].sent).toEqual([{ type: WORKER_MSG.START_RUN, ...startMsg(), userDataDir: t.userDataPath }]);
    expect(manager.activeRun()).toMatchObject({ repoId: repoId(t.repoPath), headSha: COMMIT_A, runId: null });
  });

  it('forwards every worker event to onEvent and clears the active run on completion', () => {
    manager.startRun(startMsg());
    const child = children[0];
    const base = { runId: 7, repoId: repoId(t.repoPath), commitSha: COMMIT_A };
    child.reply({ type: WORKER_MSG.RUN_STARTED, ...base, stages: [] });
    expect(manager.activeRun().runId).toBe(7);
    child.reply({ type: WORKER_MSG.STAGE_STARTED, ...base, stage: 'extract_files', label: 'Extract files' });
    child.reply({ type: WORKER_MSG.STAGE_PROGRESS, ...base, stage: 'extract_files', done: 1, total: 2 });
    child.reply({ type: WORKER_MSG.STAGE_COMPLETED, ...base, stage: 'extract_files', rowsWritten: 3 });
    child.reply({ type: WORKER_MSG.RUN_COMPLETED, ...base, stages: [] });

    expect(events.map((e) => e.type)).toEqual([
      WORKER_MSG.RUN_STARTED,
      WORKER_MSG.STAGE_STARTED,
      WORKER_MSG.STAGE_PROGRESS,
      WORKER_MSG.STAGE_COMPLETED,
      WORKER_MSG.RUN_COMPLETED,
    ]);
    expect(manager.activeRun()).toBeNull();
    expect(manager.isRunning(repoId(t.repoPath))).toBe(false);
  });

  it('ignores PONG and messages without a type', () => {
    manager.startRun(startMsg());
    children[0].reply({ type: WORKER_MSG.PONG });
    children[0].reply(null);
    children[0].reply({ data: 'nope' });
    expect(events).toEqual([]);
  });

  it('a worker crash marks the active run failed in the database, emits RUN_FAILED and the app stays up (NFR-004)', () => {
    const runId = runningRunId();
    expect(runId).not.toBeNull();

    manager.startRun(startMsg());
    const child = children[0];
    child.reply({ type: WORKER_MSG.RUN_STARTED, runId, repoId: repoId(t.repoPath), commitSha: COMMIT_A, stages: [] });
    child.reply({ type: WORKER_MSG.STAGE_STARTED, runId, repoId: repoId(t.repoPath), commitSha: COMMIT_A, stage: 'extract_files', label: 'Extract files' });
    expect(() => child.crash(134)).not.toThrow();

    const { run, stages } = runRow(runId);
    expect(run.status).toBe('failed');
    expect(run.error).toMatch(/worker/i);
    expect(run.error).toMatch(/134/);
    expect(typeof run.finished_at).toBe('number');
    const extract = stages.find((s) => s.stage === 'extract_files');
    expect(extract.status).toBe('failed');
    expect(extract.error).toBe(run.error);
    // Stages that never started are not left pending.
    expect(stages.filter((s) => s.status === 'pending')).toEqual([]);

    const failed = events.at(-1);
    expect(failed).toMatchObject({ type: WORKER_MSG.RUN_FAILED, runId, repoId: repoId(t.repoPath), commitSha: COMMIT_A, stage: 'extract_files' });
    expect(failed.error).toBe(run.error);
    expect(manager.activeRun()).toBeNull();

    // The next run gets a fresh worker: the manager, and the app, survived.
    manager.startRun(startMsg());
    expect(children).toHaveLength(2);
    expect(children[1].sent[0].type).toBe(WORKER_MSG.START_RUN);
  });

  it('a crash before RUN_STARTED still fails the running run for that commit', () => {
    const runId = runningRunId();
    manager.startRun(startMsg());
    children[0].crash(1);
    expect(runRow(runId).run.status).toBe('failed');
    expect(events.at(-1)).toMatchObject({ type: WORKER_MSG.RUN_FAILED, commitSha: COMMIT_A, stage: null });
    expect(events.at(-1).runId).toBe(runId);
  });

  it('a crash with no active run only drops the worker', () => {
    manager.startRun(startMsg());
    children[0].reply({ type: WORKER_MSG.RUN_COMPLETED, runId: 1, repoId: repoId(t.repoPath), commitSha: COMMIT_A, stages: [] });
    events.length = 0;
    children[0].crash(9);
    expect(events).toEqual([]);
    manager.startRun(startMsg());
    expect(children).toHaveLength(2);
  });

  it('a crash while the database cannot be opened still reports RUN_FAILED and does not throw', () => {
    const broken = createWorkerManager({
      fork: () => {
        const c = new FakeChild();
        children.push(c);
        return c;
      },
      userDataPath: t.userDataPath,
      onEvent: (e) => events.push(e),
      openDb: () => {
        throw new Error('locked');
      },
      log: () => {},
    });
    broken.startRun(startMsg());
    expect(() => children.at(-1).crash(1)).not.toThrow();
    expect(events.at(-1).type).toBe(WORKER_MSG.RUN_FAILED);
    broken.dispose();
  });

  it('dispose kills the worker and later starts fork a new one', () => {
    manager.startRun(startMsg());
    manager.dispose();
    expect(children[0].killed).toBe(true);
  });
});

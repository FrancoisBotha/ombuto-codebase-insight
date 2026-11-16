// Pure view-model for the Indexing screen (FR-006): how worker events and a
// RUN_STATUS snapshot turn into per-stage status, counts, overall progress,
// the live log and the unlock list. No DOM, no IPC.
import { describe, it, expect } from 'vitest';
import { WORKER_MSG } from '../../../src/shared/ipcChannels.js';
import {
  emptyRun,
  runFromStatus,
  applyRunEvent,
  overallProgress,
  readyItems,
  formatRelative,
  shortSha,
} from '../../../src/renderer/lib/indexingModel.js';

const base = { runId: 7, repoId: 'r1', commitSha: 'a91f3c2deadbeef' };
const ev = (type, fields = {}) => ({ type, ...base, ...fields });

const STAGES = [
  { id: 'extract_files', label: 'Extract files' },
  { id: 'extract_history', label: 'Extract history' },
  { id: 'transform', label: 'Transform structure & history' },
];

function started() {
  return applyRunEvent(emptyRun(), ev(WORKER_MSG.RUN_STARTED, { stages: STAGES }));
}

describe('indexingModel', () => {
  describe('runFromStatus', () => {
    it('maps a RUN_STATUS snapshot to stages with status, counts and errors', () => {
      const run = runFromStatus({
        runId: 3, commitSha: 'abc1234', status: 'failed', startedAt: 100, finishedAt: 120, error: 'boom',
        stages: [
          { stage: 'extract_files', status: 'done', startedAt: 100, finishedAt: 110, rowsWritten: 612, error: null },
          { stage: 'extract_history', status: 'failed', startedAt: 110, finishedAt: 120, rowsWritten: null, error: 'boom' },
          { stage: 'transform', status: 'skipped', startedAt: null, finishedAt: null, rowsWritten: null, error: null },
        ],
      });
      expect(run.runId).toBe(3);
      expect(run.status).toBe('failed');
      expect(run.error).toBe('boom');
      expect(run.stages.map((s) => s.status)).toEqual(['done', 'failed', 'skipped']);
      expect(run.stages[0].rowsWritten).toBe(612);
      expect(run.stages[0].label).toBe('Extract files');
      expect(run.stages[1].error).toBe('boom');
    });

    it('returns an empty run for null', () => {
      const run = runFromStatus(null);
      expect(run.runId).toBeNull();
      expect(run.stages).toEqual([]);
    });
  });

  describe('applyRunEvent', () => {
    it('RUN_STARTED registers the stages as pending', () => {
      const run = started();
      expect(run.runId).toBe(7);
      expect(run.status).toBe('running');
      expect(run.stages.map((s) => [s.id, s.status])).toEqual([
        ['extract_files', 'pending'], ['extract_history', 'pending'], ['transform', 'pending'],
      ]);
    });

    it('STAGE_STARTED and STAGE_PROGRESS update one stage with done/total/unit', () => {
      let run = started();
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_STARTED, { stage: 'extract_files', label: 'Extract files' }));
      expect(run.stages[0].status).toBe('running');
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_PROGRESS, { stage: 'extract_files', label: 'Extract files', done: 40, total: 100, unit: 'files', message: 'Extracted 40 of 100 files' }));
      expect(run.stages[0]).toMatchObject({ status: 'running', done: 40, total: 100, unit: 'files' });
      expect(run.stages[1].status).toBe('pending');
    });

    it('STAGE_COMPLETED marks the stage done with rowsWritten', () => {
      let run = started();
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_STARTED, { stage: 'extract_files', label: 'Extract files' }));
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_COMPLETED, { stage: 'extract_files', label: 'Extract files', rowsWritten: 612, durationMs: 1500 }));
      expect(run.stages[0]).toMatchObject({ status: 'done', rowsWritten: 612 });
    });

    it('STAGE_SKIPPED marks an unbuilt stage skipped', () => {
      let run = started();
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_SKIPPED, { stage: 'extract_history', label: 'Extract history', reason: 'not implemented' }));
      expect(run.stages[1].status).toBe('skipped');
    });

    it('STAGE_FAILED and RUN_FAILED record the error on the stage and the run', () => {
      let run = started();
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_STARTED, { stage: 'extract_files', label: 'Extract files' }));
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_FAILED, { stage: 'extract_files', label: 'Extract files', error: 'git exploded' }));
      run = applyRunEvent(run, ev(WORKER_MSG.RUN_FAILED, { stage: 'extract_files', error: 'git exploded' }));
      expect(run.stages[0]).toMatchObject({ status: 'failed', error: 'git exploded' });
      expect(run.status).toBe('failed');
      expect(run.error).toBe('git exploded');
    });

    it('RUN_COMPLETED marks the run done', () => {
      let run = started();
      run = applyRunEvent(run, ev(WORKER_MSG.RUN_COMPLETED, { stages: [] }));
      expect(run.status).toBe('done');
    });

    it('appends a timestamped log line per event and keeps the newest', () => {
      let run = started();
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_STARTED, { stage: 'extract_files', label: 'Extract files' }));
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_PROGRESS, { stage: 'extract_files', label: 'Extract files', done: 1, total: 2, unit: 'files', message: 'Extracted 1 of 2 files' }));
      expect(run.log.length).toBe(3);
      expect(run.log.at(-1).m).toContain('Extracted 1 of 2 files');
      expect(run.log.at(-1).t).toMatch(/^\d\d:\d\d:\d\d$/);
    });

    it('ignores events from another run once a run is known', () => {
      let run = started();
      run = applyRunEvent(run, { ...ev(WORKER_MSG.STAGE_STARTED, { stage: 'extract_files', label: 'Extract files' }), runId: 99 });
      expect(run.stages[0].status).toBe('pending');
    });

    it('a new RUN_STARTED replaces an older run', () => {
      let run = started();
      run = applyRunEvent(run, ev(WORKER_MSG.RUN_COMPLETED, { stages: [] }));
      run = applyRunEvent(run, { ...ev(WORKER_MSG.RUN_STARTED, { stages: STAGES }), runId: 8 });
      expect(run.runId).toBe(8);
      expect(run.status).toBe('running');
      expect(run.stages.every((s) => s.status === 'pending')).toBe(true);
    });
  });

  describe('overallProgress', () => {
    it('is 0 with no stages, counts finished stages and a running stage fraction', () => {
      expect(overallProgress(emptyRun())).toBe(0);
      let run = started();
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_STARTED, { stage: 'extract_files', label: 'Extract files' }));
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_PROGRESS, { stage: 'extract_files', label: 'Extract files', done: 50, total: 100, unit: 'files' }));
      expect(overallProgress(run)).toBeCloseTo((0.5) / 3, 5);
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_COMPLETED, { stage: 'extract_files', label: 'Extract files', rowsWritten: 100 }));
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_SKIPPED, { stage: 'extract_history', label: 'Extract history' }));
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_SKIPPED, { stage: 'transform', label: 'Transform' }));
      run = applyRunEvent(run, ev(WORKER_MSG.RUN_COMPLETED, { stages: [] }));
      expect(overallProgress(run)).toBe(1);
    });
  });

  describe('readyItems', () => {
    it('locks Size & Inventory and Files until extract_files is done, and marks skipped stages', () => {
      let run = started();
      let items = readyItems(run);
      const inv = items.find((i) => i.id === 'inventory');
      expect(inv.ok).toBe(false);
      expect(inv.state).toBe('Waiting');
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_COMPLETED, { stage: 'extract_files', label: 'Extract files', rowsWritten: 1 }));
      run = applyRunEvent(run, ev(WORKER_MSG.STAGE_SKIPPED, { stage: 'transform', label: 'Transform structure & history' }));
      items = readyItems(run);
      expect(items.find((i) => i.id === 'inventory')).toMatchObject({ ok: true, state: 'Partial' });
      expect(items.find((i) => i.id === 'file')).toMatchObject({ ok: true, state: 'Partial' });
      expect(items.find((i) => i.id === 'hotspots')).toMatchObject({ ok: false, state: 'Skipped' });
      run = applyRunEvent(run, ev(WORKER_MSG.RUN_COMPLETED, { stages: [] }));
      expect(readyItems(run).find((i) => i.id === 'inventory').state).toBe('Ready');
    });
  });

  describe('formatting helpers', () => {
    it('formatRelative renders seconds-since-epoch and ISO strings relative to now', () => {
      const now = Date.UTC(2026, 10, 16, 12, 0, 0);
      expect(formatRelative(null, now)).toBe('never');
      expect(formatRelative(now / 1000 - 30, now)).toBe('just now');
      expect(formatRelative(now / 1000 - 5 * 60, now)).toBe('5m ago');
      expect(formatRelative(new Date(now - 2 * 3600 * 1000).toISOString(), now)).toBe('2h ago');
      expect(formatRelative(now / 1000 - 3 * 86400, now)).toBe('3d ago');
    });

    it('shortSha keeps seven characters', () => {
      expect(shortSha('a91f3c2deadbeef')).toBe('a91f3c2');
      expect(shortSha(null)).toBe('');
    });
  });
});

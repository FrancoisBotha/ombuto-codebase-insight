import { describe, it, expect } from 'vitest';
import { IPC, WORKER_MSG } from '../../src/shared/ipcChannels.js';

describe('ipcChannels', () => {
  it('exposes frozen, unique channel names', () => {
    expect(Object.isFrozen(IPC)).toBe(true);
    expect(Object.isFrozen(WORKER_MSG)).toBe(true);
    const names = Object.values(IPC);
    expect(new Set(names).size).toBe(names.length);
  });

  it('defines the epic 1 renderer ↔ main channels', () => {
    const expected = [
      'GIT_CHECK',
      'REPO_OPEN_DIALOG',
      'REPO_OPEN_PATH',
      'RECENTS_LIST',
      'RECENTS_REMOVE',
      'RUN_STATUS',
      'RUN_EVENT',
      'REPO_REFRESH',
      'REPO_INFO',
      'INVENTORY',
      'FILE_TREE',
      'FILE_CONTENT',
      'FILE_SEARCH',
    ];
    for (const key of expected) expect(typeof IPC[key], key).toBe('string');
  });

  it('keeps renderer channels distinct from worker message types', () => {
    const ipc = new Set(Object.values(IPC));
    for (const msg of Object.values(WORKER_MSG)) expect(ipc.has(msg), msg).toBe(false);
  });
});

import { describe, it, expect } from 'vitest';
import { IPC, WORKER_MSG } from '../../src/shared/ipcChannels.js';

describe('ipcChannels', () => {
  it('exposes frozen, unique channel names', () => {
    expect(Object.isFrozen(IPC)).toBe(true);
    expect(Object.isFrozen(WORKER_MSG)).toBe(true);
    const names = Object.values(IPC);
    expect(new Set(names).size).toBe(names.length);
  });
});

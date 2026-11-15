import { describe, it, expect } from 'vitest';
import { checkGit, parseGitVersion, gitInstallMessage } from '../../../../src/shared/git/checkGit.js';
import { GitError } from '../../../../src/shared/git/gitRunner.js';

describe('checkGit', () => {
  it('reports git available with its parsed version', async () => {
    const runGit = async (args) => {
      expect(args).toEqual(['--version']);
      return { stdout: 'git version 2.52.0.windows.1\n', stderr: '', exitCode: 0 };
    };
    const result = await checkGit({ runGit });
    expect(result.available).toBe(true);
    expect(result.version).toBe('2.52.0');
    expect(result.raw).toBe('git version 2.52.0.windows.1');
    expect(result.message).toBeNull();
  });

  it('reports git missing with a helpful install message', async () => {
    const runGit = async () => {
      throw new GitError('spawn git ENOENT', { code: 'ENOENT', args: ['--version'] });
    };
    const result = await checkGit({ runGit, platform: 'win32' });
    expect(result.available).toBe(false);
    expect(result.version).toBeNull();
    expect(result.message).toMatch(/not found/i);
    expect(result.message).toMatch(/git-scm\.com/);
    expect(result.message).toMatch(/winget|Git for Windows/i);
  });

  it('tailors the install hint to the platform', () => {
    expect(gitInstallMessage('darwin')).toMatch(/xcode-select|brew/);
    expect(gitInstallMessage('linux')).toMatch(/apt|dnf/);
    expect(gitInstallMessage('win32')).toMatch(/winget|Git for Windows/i);
  });

  it('reports other failures without crashing', async () => {
    const runGit = async () => {
      throw new GitError('git exited with code 1', { code: 'EXIT', exitCode: 1, stderr: 'boom', args: ['--version'] });
    };
    const result = await checkGit({ runGit });
    expect(result.available).toBe(false);
    expect(result.message).toContain('boom');
  });

  it('parses version strings from different platforms', () => {
    expect(parseGitVersion('git version 2.39.5 (Apple Git-154)')).toBe('2.39.5');
    expect(parseGitVersion('git version 2.43.0')).toBe('2.43.0');
    expect(parseGitVersion('nonsense')).toBeNull();
  });

  it('finds the real system git on this machine', async () => {
    const result = await checkGit();
    expect(result.available).toBe(true);
    expect(result.version).toMatch(/^\d+\.\d+\.\d+$/);
  });
});

// runGitSync: the synchronous entry point of the safe git runner, used by
// pipeline stages (which run inside a synchronous better-sqlite3 transaction).
// It must carry exactly the same safety guarantees as runGit (NFR-001).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { GitError, runGitSync } from '../../../../src/shared/git/gitRunner.js';

function fakeExecFileSync({ stdout = Buffer.alloc(0), error = null } = {}) {
  const calls = [];
  const impl = (file, args, options) => {
    calls.push({ file, args, options });
    if (error) throw error;
    return stdout;
  };
  return { impl, calls };
}

describe('gitRunner · runGitSync (with injected execFileSync)', () => {
  it('invokes git with an argument array, the safe flags, a scrubbed env and no shell', () => {
    const { impl, calls } = fakeExecFileSync({ stdout: Buffer.from('out') });
    const result = runGitSync(['ls-tree', '-r', '-l', '-z', 'HEAD'], {
      cwd: '/repo',
      execFileSync: impl,
      env: { PATH: '/usr/bin', GIT_EXTERNAL_DIFF: '/evil', GIT_DIR: '/elsewhere' },
    });

    expect(Buffer.isBuffer(result.stdout)).toBe(true);
    expect(result.stdout.toString()).toBe('out');
    expect(result.exitCode).toBe(0);
    const [call] = calls;
    expect(call.file).toBe('git');
    expect(call.args[0]).toBe('--no-pager');
    expect(call.args.join(' ')).toContain('-c core.fsmonitor=false');
    expect(call.args.slice(-5)).toEqual(['ls-tree', '-r', '-l', '-z', 'HEAD']);
    expect(call.options.shell).toBeFalsy();
    expect(call.options.windowsHide).toBe(true);
    expect(call.options.cwd).toBe('/repo');
    expect(call.options.env.GIT_EXTERNAL_DIFF).toBeUndefined();
    expect(call.options.env.GIT_DIR).toBeUndefined();
    expect(call.options.env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(call.options.timeout).toBeGreaterThan(0);
    expect(call.options.maxBuffer).toBeGreaterThan(0);
  });

  it('passes stdin input through so cat-file --batch can be fed object names', () => {
    const { impl, calls } = fakeExecFileSync();
    runGitSync(['cat-file', '--batch'], { execFileSync: impl, input: 'abc\ndef\n' });
    expect(calls[0].options.input).toBe('abc\ndef\n');
    expect(calls[0].args).not.toContain('--no-textconv');
  });

  it('refuses writing subcommands and global options, like runGit', () => {
    const { impl, calls } = fakeExecFileSync();
    expect(() => runGitSync(['commit', '-m', 'x'], { execFileSync: impl })).toThrow(GitError);
    expect(() => runGitSync(['-C', '/x', 'ls-tree'], { execFileSync: impl })).toThrow(GitError);
    expect(calls).toHaveLength(0);
  });

  it('maps a non-zero exit to a GitError with exit code and stderr', () => {
    const error = Object.assign(new Error('Command failed'), { status: 128, stderr: Buffer.from('fatal: not a tree') });
    const { impl } = fakeExecFileSync({ error });
    let caught;
    try {
      runGitSync(['ls-tree', 'deadbeef'], { cwd: '/repo', execFileSync: impl });
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(GitError);
    expect(caught.code).toBe('EXIT');
    expect(caught.exitCode).toBe(128);
    expect(caught.stderr).toContain('not a tree');
    expect(caught.message).toContain('128');
  });

  it('maps a missing binary, a full buffer and a timeout to ENOENT, MAXBUFFER and TIMEOUT', () => {
    const cases = [
      [Object.assign(new Error('spawnSync git ENOENT'), { code: 'ENOENT' }), 'ENOENT'],
      [Object.assign(new Error('spawnSync git ENOBUFS'), { code: 'ENOBUFS' }), 'MAXBUFFER'],
      [Object.assign(new Error('spawnSync git ETIMEDOUT'), { code: 'ETIMEDOUT', signal: 'SIGTERM', status: null }), 'TIMEOUT'],
    ];
    for (const [error, expected] of cases) {
      const { impl } = fakeExecFileSync({ error });
      let caught;
      try {
        runGitSync(['--version'], { execFileSync: impl });
      } catch (e) {
        caught = e;
      }
      expect(caught, expected).toBeInstanceOf(GitError);
      expect(caught.code).toBe(expected);
    }
  });
});

describe('gitRunner · runGitSync against a real fixture repository', () => {
  it('returns raw bytes for ls-tree -z and answers a cat-file --batch request from stdin', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-gitsync-'));
    try {
      const git = simpleGit(dir);
      await git.init();
      await git.addConfig('user.email', 'test@example.com');
      await git.addConfig('user.name', 'Test');
      fs.writeFileSync(path.join(dir, 'a.txt'), 'hello\nworld\n');
      await git.add('.');
      await git.commit('init');

      const { stdout } = runGitSync(['ls-tree', '-r', '-l', '-z', 'HEAD'], { cwd: dir });
      expect(Buffer.isBuffer(stdout)).toBe(true);
      const text = stdout.toString('utf8');
      expect(text.endsWith('\0')).toBe(true);
      expect(text).toMatch(/^100644 blob [0-9a-f]{40,64} +12\ta\.txt\0$/);

      const sha = text.split(' ')[2];
      const batch = runGitSync(['cat-file', '--batch'], { cwd: dir, input: `${sha}\n` });
      expect(batch.stdout.toString()).toBe(`${sha} blob 12\nhello\nworld\n\n`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

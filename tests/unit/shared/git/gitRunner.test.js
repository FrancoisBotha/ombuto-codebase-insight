import { describe, it, expect } from 'vitest';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import {
  GitError,
  buildGitArgs,
  buildGitEnv,
  runGit,
  streamGit,
  READ_ONLY_SUBCOMMANDS,
} from '../../../../src/shared/git/gitRunner.js';

// ---------------------------------------------------------------------------
// Fakes for child_process so the tests can inspect exactly what is invoked.
// ---------------------------------------------------------------------------

function fakeExecFile({ stdout = '', stderr = '', error = null } = {}) {
  const calls = [];
  const impl = (file, args, options, callback) => {
    calls.push({ file, args, options });
    const child = new EventEmitter();
    child.kill = () => {};
    queueMicrotask(() => callback(error, stdout, stderr));
    return child;
  };
  return { impl, calls };
}

function fakeSpawn({ stdout = '', stderr = '', exitCode = 0, error = null, hang = false } = {}) {
  const calls = [];
  const impl = (file, args, options) => {
    calls.push({ file, args, options });
    const child = new EventEmitter();
    child.stdout = new PassThrough();
    child.stderr = new PassThrough();
    child.stdin = new PassThrough();
    child.killed = false;
    child.kill = () => {
      child.killed = true;
      queueMicrotask(() => child.emit('close', null, 'SIGTERM'));
      return true;
    };
    queueMicrotask(() => {
      if (error) {
        child.emit('error', error);
        return;
      }
      if (hang) return;
      if (stdout) child.stdout.write(stdout);
      if (stderr) child.stderr.write(stderr);
      child.stdout.end();
      child.stderr.end();
      child.emit('close', exitCode, null);
    });
    return child;
  };
  return { impl, calls };
}

async function fixtureRepo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-gitrunner-'));
  const git = simpleGit(dir);
  await git.init();
  await git.addConfig('user.email', 'test@example.com');
  await git.addConfig('user.name', 'Test');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'hello\nworld\n');
  fs.mkdirSync(path.join(dir, 'sub'));
  fs.writeFileSync(path.join(dir, 'sub', 'b.txt'), 'b\n');
  await git.add('.');
  await git.commit('init');
  return dir;
}

// ---------------------------------------------------------------------------

describe('gitRunner · buildGitArgs', () => {
  it('prefixes every invocation with the safe global flags', () => {
    const argv = buildGitArgs(['ls-tree', '-r', 'HEAD']);
    expect(argv[0]).toBe('--no-pager');
    expect(argv).toContain('-c');
    const cIndex = argv.indexOf('-c');
    expect(argv[cIndex + 1]).toBe('core.fsmonitor=false');
    // The caller's args come last and untouched.
    expect(argv.slice(-3)).toEqual(['ls-tree', '-r', 'HEAD']);
  });

  it('adds --no-textconv and --no-ext-diff to diff-family subcommands', () => {
    for (const sub of ['diff', 'log', 'show', 'diff-tree']) {
      const argv = buildGitArgs([sub, 'HEAD']);
      const subIndex = argv.indexOf(sub);
      expect(argv.slice(subIndex + 1)).toContain('--no-textconv');
      expect(argv.slice(subIndex + 1)).toContain('--no-ext-diff');
      expect(argv[argv.length - 1]).toBe('HEAD');
    }
  });

  it('adds --no-textconv to blame and grep (which support it) but not --no-ext-diff', () => {
    for (const sub of ['blame', 'grep']) {
      const argv = buildGitArgs([sub, 'a.txt']);
      expect(argv).toContain('--no-textconv');
      expect(argv).not.toContain('--no-ext-diff');
    }
  });

  it('does not add --no-textconv to subcommands that reject it', () => {
    for (const sub of ['ls-tree', 'cat-file', 'rev-parse', 'ls-files', 'rev-list']) {
      const argv = buildGitArgs([sub]);
      expect(argv).not.toContain('--no-textconv');
      expect(argv).not.toContain('--no-ext-diff');
    }
  });

  it('allows only read-only subcommands; hook-running or writing commands are rejected', () => {
    for (const sub of ['commit', 'merge', 'rebase', 'checkout', 'push', 'pull', 'fetch', 'gc', 'stash', 'reset', 'clone', 'am', 'apply', 'submodule']) {
      expect(() => buildGitArgs([sub])).toThrow(GitError);
      expect(READ_ONLY_SUBCOMMANDS.has(sub)).toBe(false);
    }
    for (const sub of ['rev-parse', 'ls-tree', 'cat-file', 'log', 'blame', 'rev-list', 'show', 'diff']) {
      expect(READ_ONLY_SUBCOMMANDS.has(sub)).toBe(true);
    }
  });

  it('rejects argument lists that are not arrays of strings or start with a global option', () => {
    expect(() => buildGitArgs('ls-tree -r HEAD')).toThrow(GitError);
    expect(() => buildGitArgs([])).toThrow(GitError);
    expect(() => buildGitArgs(['-C', '/x', 'ls-tree'])).toThrow(GitError);
    expect(() => buildGitArgs(['ls-tree', 42])).toThrow(GitError);
  });
});

describe('gitRunner · buildGitEnv', () => {
  it('drops variables that could redirect git or run external programs', () => {
    const env = buildGitEnv({
      PATH: '/usr/bin',
      GIT_EXTERNAL_DIFF: '/evil',
      GIT_PAGER: 'less',
      GIT_DIR: '/elsewhere/.git',
      GIT_WORK_TREE: '/elsewhere',
      GIT_CONFIG_PARAMETERS: "'diff.external=/evil'",
    });
    expect(env.PATH).toBe('/usr/bin');
    expect(env.GIT_EXTERNAL_DIFF).toBeUndefined();
    expect(env.GIT_PAGER).toBeUndefined();
    expect(env.GIT_DIR).toBeUndefined();
    expect(env.GIT_WORK_TREE).toBeUndefined();
    expect(env.GIT_CONFIG_PARAMETERS).toBeUndefined();
    expect(env.GIT_TERMINAL_PROMPT).toBe('0');
    expect(env.GIT_OPTIONAL_LOCKS).toBe('0');
  });
});

describe('gitRunner · runGit (buffered, with injected execFile)', () => {
  it('invokes the git binary with an argument array and never a shell', async () => {
    const { impl, calls } = fakeExecFile({ stdout: 'out' });
    const result = await runGit(['ls-tree', '-r', 'HEAD'], { cwd: '/repo', execFile: impl });

    expect(result.stdout).toBe('out');
    expect(result.exitCode).toBe(0);
    expect(calls).toHaveLength(1);
    const [call] = calls;
    expect(call.file).toBe('git');
    expect(Array.isArray(call.args)).toBe(true);
    expect(call.options.shell).toBeFalsy();
    expect(call.options.windowsHide).toBe(true);
    expect(call.options.cwd).toBe('/repo');
    expect(call.options.timeout).toBeGreaterThan(0);
    expect(call.options.env.GIT_EXTERNAL_DIFF).toBeUndefined();
  });

  it('passes the safe flags on every call', async () => {
    const { impl, calls } = fakeExecFile();
    await runGit(['rev-parse', '--show-toplevel'], { execFile: impl });
    await runGit(['log', '-1'], { execFile: impl });
    await runGit(['cat-file', '-p', 'HEAD'], { execFile: impl });
    for (const call of calls) {
      expect(call.args).toContain('--no-pager');
      expect(call.args.join(' ')).toContain('-c core.fsmonitor=false');
    }
    expect(calls[1].args).toContain('--no-textconv');
    expect(calls[1].args).toContain('--no-ext-diff');
  });

  it('throws a GitError with exit code and stderr on failure', async () => {
    const error = Object.assign(new Error('Command failed'), { code: 128 });
    const { impl } = fakeExecFile({ error, stderr: 'fatal: not a git repository' });
    const promise = runGit(['rev-parse', '--show-toplevel'], { cwd: '/nope', execFile: impl });
    await expect(promise).rejects.toBeInstanceOf(GitError);
    const err = await promise.catch((e) => e);
    expect(err.exitCode).toBe(128);
    expect(err.stderr).toContain('not a git repository');
    expect(err.message).toContain('128');
    expect(err.message).toContain('not a git repository');
    expect(err.args).toEqual(['rev-parse', '--show-toplevel']);
  });

  it('reports a missing git binary as code ENOENT', async () => {
    const error = Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' });
    const { impl } = fakeExecFile({ error });
    const err = await runGit(['--version'], { execFile: impl }).catch((e) => e);
    expect(err).toBeInstanceOf(GitError);
    expect(err.code).toBe('ENOENT');
  });

  it('reports a timeout as code TIMEOUT', async () => {
    const error = Object.assign(new Error('killed'), { killed: true, signal: 'SIGTERM', code: null });
    const { impl } = fakeExecFile({ error });
    const err = await runGit(['log'], { execFile: impl, timeoutMs: 5 }).catch((e) => e);
    expect(err).toBeInstanceOf(GitError);
    expect(err.code).toBe('TIMEOUT');
    expect(err.message).toMatch(/timed out/i);
  });
});

describe('gitRunner · streamGit (with injected spawn)', () => {
  it('spawns git with an argument array, safe flags and no shell, and resolves on exit 0', async () => {
    const { impl, calls } = fakeSpawn({ stdout: 'line1\nline2\n' });
    const proc = streamGit(['ls-tree', '-r', '-z', 'HEAD'], { cwd: '/repo', spawn: impl });

    let collected = '';
    for await (const chunk of proc.stdout) collected += chunk.toString();
    const { exitCode } = await proc.done;

    expect(exitCode).toBe(0);
    expect(collected).toBe('line1\nline2\n');
    const [call] = calls;
    expect(call.file).toBe('git');
    expect(call.options.shell).toBeFalsy();
    expect(call.options.windowsHide).toBe(true);
    expect(call.args).toContain('--no-pager');
    expect(call.args.join(' ')).toContain('-c core.fsmonitor=false');
    expect(call.args.slice(-4)).toEqual(['ls-tree', '-r', '-z', 'HEAD']);
  });

  it('exposes stdin so cat-file --batch can be driven', () => {
    const { impl } = fakeSpawn();
    const proc = streamGit(['cat-file', '--batch'], { spawn: impl });
    expect(typeof proc.stdin.write).toBe('function');
    expect(typeof proc.stdin.end).toBe('function');
  });

  it('rejects done with a GitError carrying exit code and stderr', async () => {
    const { impl } = fakeSpawn({ exitCode: 128, stderr: 'fatal: bad object' });
    const proc = streamGit(['cat-file', '-p', 'deadbeef'], { spawn: impl });
    proc.stdout.resume();
    const err = await proc.done.catch((e) => e);
    expect(err).toBeInstanceOf(GitError);
    expect(err.exitCode).toBe(128);
    expect(err.stderr).toContain('bad object');
  });

  it('kills the process and rejects with TIMEOUT when no output arrives in time', async () => {
    const { impl } = fakeSpawn({ hang: true });
    const proc = streamGit(['cat-file', '--batch'], { spawn: impl, timeoutMs: 10 });
    proc.stdout.resume();
    const err = await proc.done.catch((e) => e);
    expect(err).toBeInstanceOf(GitError);
    expect(err.code).toBe('TIMEOUT');
    expect(proc.child.killed).toBe(true);
  });

  it('rejects with ENOENT when git is missing', async () => {
    const error = Object.assign(new Error('spawn git ENOENT'), { code: 'ENOENT' });
    const { impl } = fakeSpawn({ error });
    const proc = streamGit(['ls-tree', 'HEAD'], { spawn: impl });
    const err = await proc.done.catch((e) => e);
    expect(err).toBeInstanceOf(GitError);
    expect(err.code).toBe('ENOENT');
  });
});

describe('gitRunner · against a real fixture repository', () => {
  it('runs ls-tree buffered and streams cat-file --batch', async () => {
    const dir = await fixtureRepo();
    try {
      const { stdout } = await runGit(['ls-tree', '-r', '--name-only', 'HEAD'], { cwd: dir });
      expect(stdout.split(/\r?\n/).filter(Boolean).sort()).toEqual(['a.txt', 'sub/b.txt']);

      const proc = streamGit(['cat-file', '--batch'], { cwd: dir });
      proc.stdin.end('HEAD:a.txt\n');
      let out = '';
      for await (const chunk of proc.stdout) out += chunk.toString();
      await proc.done;
      expect(out).toMatch(/^[0-9a-f]{40,64} blob 12\n/);
      expect(out).toContain('hello\nworld\n');
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('surfaces the real exit code and stderr for a failing command', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-nongit-'));
    try {
      const err = await runGit(['rev-parse', '--show-toplevel'], { cwd: dir }).catch((e) => e);
      expect(err).toBeInstanceOf(GitError);
      expect(err.exitCode).toBe(128);
      expect(err.stderr).toMatch(/not a git repository/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

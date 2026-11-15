import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { validateRepoFolder } from '../../../src/main/repo/validateRepoFolder.js';
import { GitError } from '../../../src/shared/git/gitRunner.js';

function samePath(a, b) {
  const na = path.resolve(a);
  const nb = path.resolve(b);
  return process.platform === 'win32' ? na.toLowerCase() === nb.toLowerCase() : na === nb;
}

async function fixtureRepo() {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'insight-validate-')));
  const git = simpleGit(dir);
  await git.init();
  fs.mkdirSync(path.join(dir, 'src'));
  fs.writeFileSync(path.join(dir, 'src', 'index.js'), '// hi\n');
  return dir;
}

describe('validateRepoFolder', () => {
  it('resolves the work-tree root for a folder inside a git repo', async () => {
    const dir = await fixtureRepo();
    try {
      const result = await validateRepoFolder(path.join(dir, 'src'));
      expect(result.ok).toBe(true);
      expect(samePath(result.root, dir)).toBe(true);
      expect(samePath(result.path, path.join(dir, 'src'))).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a folder that is not inside a git work tree with a clear message', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-nongit-'));
    try {
      const result = await validateRepoFolder(dir);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not-a-git-repo');
      expect(result.message).toMatch(/not (inside )?a git repository/i);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a bare repository', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-bare-'));
    try {
      await simpleGit(dir).init(true);
      const result = await validateRepoFolder(dir);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('bare-repo');
      expect(result.message).toMatch(/bare/i);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects a path that does not exist or is a file', async () => {
    const missing = await validateRepoFolder(path.join(os.tmpdir(), 'insight-does-not-exist-' + Date.now()));
    expect(missing.ok).toBe(false);
    expect(missing.reason).toBe('not-found');
    expect(missing.message).toMatch(/does not exist/i);

    const file = path.join(os.tmpdir(), `insight-file-${Date.now()}.txt`);
    fs.writeFileSync(file, 'x');
    try {
      const result = await validateRepoFolder(file);
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('not-a-folder');
    } finally {
      fs.rmSync(file, { force: true });
    }
  });

  it('rejects an empty or non-string path', async () => {
    expect((await validateRepoFolder('')).ok).toBe(false);
    expect((await validateRepoFolder(undefined)).ok).toBe(false);
    expect((await validateRepoFolder('')).reason).toBe('invalid-path');
  });

  it('reports git missing as its own reason', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-nogit-'));
    try {
      const runGit = async () => {
        throw new GitError('spawn git ENOENT', { code: 'ENOENT', args: ['rev-parse'] });
      };
      const result = await validateRepoFolder(dir, { runGit });
      expect(result.ok).toBe(false);
      expect(result.reason).toBe('git-missing');
      expect(result.message).toMatch(/git/i);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('calls git rev-parse --show-toplevel through the runner with the folder as cwd', async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-spy-'));
    try {
      const calls = [];
      const runGit = async (args, opts) => {
        calls.push({ args, opts });
        return { stdout: dir.replace(/\\/g, '/') + '\n', stderr: '', exitCode: 0 };
      };
      const result = await validateRepoFolder(dir, { runGit });
      expect(result.ok).toBe(true);
      expect(calls[0].args).toEqual(['rev-parse', '--show-toplevel']);
      expect(samePath(calls[0].opts.cwd, dir)).toBe(true);
      expect(samePath(result.root, dir)).toBe(true);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

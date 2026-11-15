// Validates a folder the user picked or dropped and resolves its git
// work-tree root (epic 1 FR-001). Never throws for user-facing problems:
// returns `{ ok: false, reason, message }` so the renderer can show it.

import fs from 'node:fs/promises';
import path from 'node:path';
import { runGit as defaultRunGit } from '../../shared/git/gitRunner.js';
import { gitInstallMessage } from '../../shared/git/checkGit.js';

/**
 * @param {string} folderPath
 * @param {object} [options]
 * @param {Function} [options.runGit]  injectable runner (tests)
 * @returns {Promise<
 *   | { ok: true, path: string, root: string }
 *   | { ok: false, reason: 'invalid-path'|'not-found'|'not-a-folder'|'not-a-git-repo'|'bare-repo'|'git-missing'|'git-error', message: string }
 * >}
 */
export async function validateRepoFolder(folderPath, { runGit = defaultRunGit } = {}) {
  if (typeof folderPath !== 'string' || folderPath.trim() === '') {
    return { ok: false, reason: 'invalid-path', message: 'No folder was selected.' };
  }
  const resolved = path.resolve(folderPath);

  let stat;
  try {
    stat = await fs.stat(resolved);
  } catch (err) {
    if (err?.code === 'ENOENT' || err?.code === 'ENOTDIR') {
      return { ok: false, reason: 'not-found', message: `The folder "${resolved}" does not exist.` };
    }
    return { ok: false, reason: 'not-found', message: `The folder "${resolved}" could not be read: ${err.message}` };
  }
  if (!stat.isDirectory()) {
    return { ok: false, reason: 'not-a-folder', message: `"${resolved}" is a file, not a folder. Choose the repository's folder.` };
  }

  try {
    const { stdout } = await runGit(['rev-parse', '--show-toplevel'], { cwd: resolved, timeoutMs: 15_000 });
    const top = String(stdout).trim();
    if (!top) {
      return { ok: false, reason: 'git-error', message: `git did not report a work tree for "${resolved}".` };
    }
    return { ok: true, path: resolved, root: path.resolve(top) };
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return { ok: false, reason: 'git-missing', message: gitInstallMessage() };
    }
    const stderr = String(err?.stderr ?? '');
    if (/not a git repository/i.test(stderr)) {
      return {
        ok: false,
        reason: 'not-a-git-repo',
        message: `"${resolved}" is not inside a git repository. Choose a folder that contains a git checkout.`,
      };
    }
    if (/must be run in a work tree/i.test(stderr) || /bare repository/i.test(stderr)) {
      return {
        ok: false,
        reason: 'bare-repo',
        message: `"${resolved}" is a bare repository with no working tree. Choose a normal checkout.`,
      };
    }
    return {
      ok: false,
      reason: 'git-error',
      message: `git could not open "${resolved}": ${stderr.trim() || err?.message || 'unknown error'}`,
    };
  }
}

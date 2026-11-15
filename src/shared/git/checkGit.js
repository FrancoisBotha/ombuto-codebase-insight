// Checks that the system git CLI is available (Architecture §4: git is a
// runtime prerequisite checked on the Welcome screen; epic 1 FR-002).

import { runGit as defaultRunGit } from './gitRunner.js';

const VERSION_RE = /git version (\d+\.\d+\.\d+)/;

/** Extracts "2.52.0" from "git version 2.52.0.windows.1"; null if unrecognised. */
export function parseGitVersion(text) {
  const match = VERSION_RE.exec(String(text ?? ''));
  return match ? match[1] : null;
}

/** Human-readable install instructions for the given platform. */
export function gitInstallMessage(platform = process.platform) {
  const base = 'Git was not found on your PATH. Ombuto Codebase Insight needs the git command line to read repositories.';
  const site = 'Download it from https://git-scm.com/downloads';
  switch (platform) {
    case 'win32':
      return `${base} Install Git for Windows (${site}, or run "winget install Git.Git"), then restart the app.`;
    case 'darwin':
      return `${base} Run "xcode-select --install" or "brew install git" (${site}), then restart the app.`;
    default:
      return `${base} Install it with your package manager, for example "sudo apt install git" or "sudo dnf install git" (${site}), then restart the app.`;
  }
}

/**
 * @param {object} [options]
 * @param {Function} [options.runGit]   injectable runner (tests)
 * @param {string}   [options.platform] injectable platform for the install hint
 * @returns {Promise<{available: boolean, version: string|null, raw: string|null, message: string|null}>}
 */
export async function checkGit({ runGit = defaultRunGit, platform = process.platform } = {}) {
  try {
    const { stdout } = await runGit(['--version'], { timeoutMs: 10_000 });
    const raw = String(stdout).trim();
    const version = parseGitVersion(raw);
    if (!version) {
      return {
        available: false,
        version: null,
        raw,
        message: `The git on your PATH gave an unexpected answer to "git --version": "${raw}". ${gitInstallMessage(platform)}`,
      };
    }
    return { available: true, version, raw, message: null };
  } catch (err) {
    if (err?.code === 'ENOENT') {
      return { available: false, version: null, raw: null, message: gitInstallMessage(platform) };
    }
    const detail = err?.stderr || err?.message || String(err);
    return {
      available: false,
      version: null,
      raw: null,
      message: `Could not run git: ${detail}`,
    };
  }
}

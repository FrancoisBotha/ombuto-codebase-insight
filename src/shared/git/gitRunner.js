// Safe runner for the system git CLI. The only module that may start git.
//
// The analysed repository is untrusted input (Architecture §5, NFR-001), so:
//   - git is always started with an argument array via child_process, never a
//     shell, so paths and refs from the repo can't be interpreted as commands;
//   - every invocation disables the fsmonitor hook (`-c core.fsmonitor=false`)
//     and the pager, and drops environment variables that could redirect git
//     or make it run external programs;
//   - diff-family subcommands get `--no-ext-diff` and `--no-textconv`, so
//     `diff.external`, `diff.<driver>.command` and `diff.<driver>.textconv`
//     from the repo's config or .gitattributes can't run anything;
//   - only read-only subcommands are allowed. Nothing that writes, and nothing
//     that runs hooks, can be invoked through this module.
//
// Used by the main process (folder validation, git check) and by the pipeline
// worker (extraction stages). Both `runGit` (buffered) and `streamGit`
// (streamed, for large `ls-tree` / `cat-file --batch` output) accept injectable
// `execFile` / `spawn` implementations so unit tests can inspect invocations.

import { execFile as nodeExecFile, spawn as nodeSpawn } from 'node:child_process';

export const DEFAULT_TIMEOUT_MS = 60_000;
export const DEFAULT_MAX_BUFFER = 64 * 1024 * 1024;

/** Global options placed before the subcommand on every call. */
export const SAFE_GLOBAL_ARGS = Object.freeze(['--no-pager', '-c', 'core.fsmonitor=false']);

/** Read-only subcommands this runner will start. Anything else is refused. */
export const READ_ONLY_SUBCOMMANDS = new Set([
  '--version',
  'rev-parse',
  'rev-list',
  'ls-tree',
  'ls-files',
  'cat-file',
  'log',
  'show',
  'shortlog',
  'diff',
  'diff-tree',
  'diff-index',
  'diff-files',
  'blame',
  'grep',
  'for-each-ref',
  'show-ref',
  'symbolic-ref',
  'name-rev',
  'describe',
  'count-objects',
  'check-ignore',
  'check-attr',
  'merge-base',
  'var',
]);

/** Subcommands that take diff options: both `--no-ext-diff` and `--no-textconv`. */
const DIFF_OPTION_SUBCOMMANDS = new Set(['diff', 'diff-tree', 'diff-index', 'diff-files', 'log', 'show']);

/** Subcommands that accept `--no-textconv` but not `--no-ext-diff`. */
const TEXTCONV_ONLY_SUBCOMMANDS = new Set(['blame', 'grep']);

/**
 * Environment variables that could point git at another repository, inject
 * configuration, or make it run external programs. Never inherited.
 */
const STRIPPED_ENV = [
  'GIT_DIR',
  'GIT_WORK_TREE',
  'GIT_COMMON_DIR',
  'GIT_INDEX_FILE',
  'GIT_OBJECT_DIRECTORY',
  'GIT_ALTERNATE_OBJECT_DIRECTORIES',
  'GIT_NAMESPACE',
  'GIT_CONFIG_PARAMETERS',
  'GIT_CONFIG_COUNT',
  'GIT_EXTERNAL_DIFF',
  'GIT_EXTERNAL_DIFF_TRUST_EXIT_CODE',
  'GIT_PAGER',
  'GIT_EDITOR',
  'GIT_SEQUENCE_EDITOR',
  'GIT_SSH',
  'GIT_SSH_COMMAND',
  'GIT_ASKPASS',
  'GIT_PREFIX',
];

export class GitError extends Error {
  /**
   * @param {string} message
   * @param {{code?: string, args?: string[], cwd?: string, exitCode?: number|null,
   *          signal?: string|null, stderr?: string, cause?: Error}} [details]
   */
  constructor(message, details = {}) {
    super(message, details.cause ? { cause: details.cause } : undefined);
    this.name = 'GitError';
    /** One of: BAD_ARGS, DISALLOWED, ENOENT, TIMEOUT, MAXBUFFER, EXIT, SPAWN. */
    this.code = details.code ?? 'EXIT';
    this.args = details.args ?? [];
    this.cwd = details.cwd;
    this.exitCode = details.exitCode ?? null;
    this.signal = details.signal ?? null;
    this.stderr = details.stderr ?? '';
  }
}

function describeCommand(args) {
  return `git ${args.join(' ')}`;
}

/**
 * Validates the caller's argument list and returns the full argv to pass to
 * git: safe global flags, the subcommand, its safe flags, then the caller's
 * remaining arguments untouched.
 *
 * `args[0]` must be a read-only subcommand (or `--version`); global options
 * such as `-C` or `-c` must not be passed by callers — use `cwd` instead.
 */
export function buildGitArgs(args) {
  if (!Array.isArray(args) || args.length === 0) {
    throw new GitError('git arguments must be a non-empty array of strings', { code: 'BAD_ARGS', args: [] });
  }
  for (const a of args) {
    if (typeof a !== 'string') {
      throw new GitError(`git arguments must all be strings (got ${typeof a})`, { code: 'BAD_ARGS', args: [] });
    }
  }
  const [subcommand, ...rest] = args;
  if (subcommand !== '--version' && subcommand.startsWith('-')) {
    throw new GitError(
      `git arguments must start with a subcommand, not a global option (${subcommand}); pass cwd as an option`,
      { code: 'BAD_ARGS', args },
    );
  }
  if (!READ_ONLY_SUBCOMMANDS.has(subcommand)) {
    throw new GitError(`git subcommand "${subcommand}" is not allowed: only read-only commands may run`, {
      code: 'DISALLOWED',
      args,
    });
  }

  const safeSubcommandArgs = [];
  if (DIFF_OPTION_SUBCOMMANDS.has(subcommand)) {
    safeSubcommandArgs.push('--no-ext-diff', '--no-textconv');
  } else if (TEXTCONV_ONLY_SUBCOMMANDS.has(subcommand)) {
    safeSubcommandArgs.push('--no-textconv');
  }

  return [...SAFE_GLOBAL_ARGS, subcommand, ...safeSubcommandArgs, ...rest];
}

/**
 * Returns the environment git runs with: the parent's, minus variables that
 * redirect git or run external programs, with prompts and optional locks off
 * and messages in English so errors can be matched.
 */
export function buildGitEnv(baseEnv = process.env) {
  const env = { ...baseEnv };
  for (const key of STRIPPED_ENV) delete env[key];
  env.GIT_TERMINAL_PROMPT = '0';
  env.GIT_OPTIONAL_LOCKS = '0';
  env.LC_ALL = 'C';
  return env;
}

function toGitError(err, { args, cwd, stderr, timeoutMs }) {
  const text = (stderr ?? '').toString().trim();
  if (err.code === 'ENOENT') {
    return new GitError('git executable not found on PATH', { code: 'ENOENT', args, cwd, cause: err });
  }
  if (err.killed || err.signal === 'SIGTERM' || err.signal === 'SIGKILL') {
    return new GitError(`${describeCommand(args)} timed out after ${timeoutMs} ms`, {
      code: 'TIMEOUT',
      args,
      cwd,
      signal: err.signal ?? 'SIGTERM',
      stderr: text,
      cause: err,
    });
  }
  if (err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
    return new GitError(`${describeCommand(args)} produced more output than maxBuffer allows; use streamGit`, {
      code: 'MAXBUFFER',
      args,
      cwd,
      stderr: text,
      cause: err,
    });
  }
  if (typeof err.code === 'number') {
    return new GitError(`${describeCommand(args)} exited with code ${err.code}${text ? `: ${text}` : ''}`, {
      code: 'EXIT',
      args,
      cwd,
      exitCode: err.code,
      stderr: text,
      cause: err,
    });
  }
  return new GitError(`${describeCommand(args)} failed: ${err.message}`, {
    code: 'SPAWN',
    args,
    cwd,
    stderr: text,
    cause: err,
  });
}

/**
 * Runs git and buffers its output.
 *
 * @param {string[]} args  subcommand and arguments, e.g. ['ls-tree', '-r', 'HEAD']
 * @param {object} [options]
 * @param {string} [options.cwd]            repository folder
 * @param {number} [options.timeoutMs]      overall timeout (default 60 s)
 * @param {number} [options.maxBuffer]      stdout/stderr cap (default 64 MiB)
 * @param {'utf8'|'buffer'} [options.encoding]  'buffer' for raw blob bytes
 * @param {string} [options.gitPath]        binary to run (default 'git' on PATH)
 * @param {Function} [options.execFile]     injectable child_process.execFile
 * @returns {Promise<{stdout: string|Buffer, stderr: string, exitCode: 0}>}
 */
export function runGit(args, options = {}) {
  const {
    cwd,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxBuffer = DEFAULT_MAX_BUFFER,
    encoding = 'utf8',
    gitPath = 'git',
    execFile = nodeExecFile,
    env,
  } = options;
  const argv = buildGitArgs(args);

  return new Promise((resolve, reject) => {
    execFile(
      gitPath,
      argv,
      {
        cwd,
        env: buildGitEnv(env),
        timeout: timeoutMs,
        maxBuffer,
        encoding,
        windowsHide: true,
        // Deliberately no `shell` option: arguments go straight to git.
      },
      (err, stdout, stderr) => {
        if (err) {
          reject(toGitError(err, { args, cwd, stderr, timeoutMs }));
          return;
        }
        resolve({ stdout, stderr: (stderr ?? '').toString(), exitCode: 0 });
      },
    );
  });
}

/**
 * Starts git and exposes its stdout as a stream, for large outputs such as
 * `ls-tree -r -z HEAD` or an interactive `cat-file --batch` session.
 *
 * `timeoutMs` is an inactivity timeout: it resets whenever stdout produces
 * data, so a long batch session stays alive while it is still answering.
 *
 * @param {string[]} args
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {number} [options.timeoutMs]   inactivity timeout (default 60 s, 0 = none)
 * @param {string} [options.gitPath]
 * @param {Function} [options.spawn]     injectable child_process.spawn
 * @returns {{child: import('node:child_process').ChildProcess,
 *            stdout: import('node:stream').Readable,
 *            stdin: import('node:stream').Writable,
 *            done: Promise<{exitCode: number, stderr: string}>}}
 */
export function streamGit(args, options = {}) {
  const { cwd, timeoutMs = DEFAULT_TIMEOUT_MS, gitPath = 'git', spawn = nodeSpawn, env } = options;
  const argv = buildGitArgs(args);

  const child = spawn(gitPath, argv, {
    cwd,
    env: buildGitEnv(env),
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
    // Deliberately no `shell` option.
  });

  const stderrChunks = [];
  child.stderr.on('data', (chunk) => stderrChunks.push(chunk));

  let timer = null;
  let timedOut = false;
  const clearTimer = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  const armTimer = () => {
    clearTimer();
    if (!timeoutMs) return;
    timer = setTimeout(() => {
      timedOut = true;
      child.kill('SIGTERM');
    }, timeoutMs);
  };
  child.stdout.on('data', armTimer);
  armTimer();

  const done = new Promise((resolve, reject) => {
    let settled = false;
    const settle = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimer();
      fn(value);
    };
    child.on('error', (err) => {
      settle(reject, toGitError(err, { args, cwd, stderr: Buffer.concat(stderrChunks).toString(), timeoutMs }));
    });
    child.on('close', (exitCode, signal) => {
      const stderr = Buffer.concat(stderrChunks.map((c) => (Buffer.isBuffer(c) ? c : Buffer.from(c)))).toString();
      if (timedOut) {
        settle(reject, new GitError(`${describeCommand(args)} timed out after ${timeoutMs} ms of inactivity`, {
          code: 'TIMEOUT',
          args,
          cwd,
          signal: signal ?? 'SIGTERM',
          stderr: stderr.trim(),
        }));
        return;
      }
      if (exitCode === 0) {
        settle(resolve, { exitCode: 0, stderr });
        return;
      }
      settle(reject, new GitError(
        `${describeCommand(args)} exited with code ${exitCode ?? `signal ${signal}`}${stderr.trim() ? `: ${stderr.trim()}` : ''}`,
        { code: 'EXIT', args, cwd, exitCode, signal, stderr: stderr.trim() },
      ));
    });
  });
  // Callers that only consume `stdout` still get a clean rejection if they
  // never await `done`; avoid an unhandled-rejection crash in that case.
  done.catch(() => {});

  return { child, stdout: child.stdout, stdin: child.stdin, done };
}

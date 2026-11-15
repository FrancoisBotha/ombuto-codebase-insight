// Pure heuristics for the Extract files stage (FR-005): binary detection,
// generated / vendored detection and line counting. No I/O, no git.
//
// These are heuristics (epic 1 §10): they will be tuned as real repositories
// show false positives. Keep every rule here, with a test, so the tuning is
// visible.

/** Bytes inspected for a NUL byte when deciding whether content is binary. */
export const BINARY_SNIFF_BYTES = 8192;

/** Average line length (bytes) above which text counts as minified/generated. */
export const MINIFIED_AVG_LINE_LENGTH = 400;

/** Path segments (whole folder names, any depth) that hold vendored or built code. */
export const GENERATED_DIRS = Object.freeze([
  'node_modules',
  'bower_components',
  'jspm_packages',
  'vendor',
  'vendors',
  'third_party',
  'third-party',
  'dist',
  'build',
  'out',
  'target',
  'bin',
  'obj',
  '__pycache__',
  '__generated__',
  '.yarn',
  '.pnp',
  '.nuget',
]);
// A "packages" folder is handled separately in isGeneratedPath: it is vendored
// only when it looks like a NuGet restore folder (packages/<Name>.<version>/).

/** Exact lockfile names, in any folder. */
export const LOCKFILE_NAMES = Object.freeze([
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'bun.lockb',
  'bun.lock',
  'Cargo.lock',
  'go.sum',
  'poetry.lock',
  'Pipfile.lock',
  'pdm.lock',
  'uv.lock',
  'composer.lock',
  'Gemfile.lock',
  'packages.lock.json',
  'paket.lock',
  'mix.lock',
  'pubspec.lock',
  'flake.lock',
  'gradle.lockfile',
]);

/** File-name patterns for minified bundles, source maps and generated code. */
const GENERATED_NAME_PATTERNS = Object.freeze([
  /\.min\.[^./]+$/i, // app.min.js, app.min.css, vendor.min.map
  /\.map$/i, // source maps
  /\.bundle\.[^./]+$/i, // app.bundle.js
  /\.generated\.[^./]+$/i, // Api.generated.cs
  /\.designer\.cs$/i, // WinForms designer files
  /\.g\.(cs|i\.cs|vb)$/i, // Roslyn / XAML generated
  /\.pb\.(go|cc|h|rb|swift|dart)$/i, // protobuf
  /_pb2(_grpc)?\.py$/i, // protobuf (python)
  /\.pb\.d\.ts$/i,
  /\.d\.ts\.map$/i,
]);

// Packages folders are only "generated" when they look like a NuGet restore
// folder (packages/<Name>.<version>/...), not a monorepo's packages/<name>/src.
const NUGET_PACKAGE_SEGMENT = /^[^/]+\.\d+(\.\d+)+/;

function segmentsOf(filePath) {
  return filePath
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .split('/')
    .filter((s) => s !== '' && s !== '.');
}

/**
 * True when the first `BINARY_SNIFF_BYTES` bytes contain a NUL byte, which is
 * how git itself decides a blob is binary.
 *
 * @param {Buffer|Uint8Array} content
 */
export function isBinaryContent(content) {
  if (!content || content.length === 0) return false;
  const limit = Math.min(content.length, BINARY_SNIFF_BYTES);
  for (let i = 0; i < limit; i++) {
    if (content[i] === 0) return true;
  }
  return false;
}

/**
 * True when the path is in a well-known vendored or build-output folder, is a
 * lockfile, or is named like a minified bundle, source map or generated file.
 *
 * @param {string} filePath  repo-relative path, forward or back slashes
 */
export function isGeneratedPath(filePath) {
  if (typeof filePath !== 'string' || filePath === '') return false;
  const segments = segmentsOf(filePath);
  if (segments.length === 0) return false;
  const base = segments[segments.length - 1];
  const dirs = segments.slice(0, -1);

  for (let i = 0; i < dirs.length; i++) {
    const d = dirs[i];
    if (d === 'packages') {
      const next = dirs[i + 1];
      if (next && NUGET_PACKAGE_SEGMENT.test(next)) return true;
      continue;
    }
    if (GENERATED_DIRS.includes(d)) return true;
  }

  if (LOCKFILE_NAMES.includes(base)) return true;
  return GENERATED_NAME_PATTERNS.some((re) => re.test(base));
}

/**
 * True when the text's average line length is very long (minified or
 * machine-written). Empty content is never minified.
 *
 * @param {string|Buffer} content
 * @param {{threshold?: number}} [options]
 */
export function isMinifiedContent(content, { threshold = MINIFIED_AVG_LINE_LENGTH } = {}) {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  if (!buf || buf.length === 0) return false;
  const lines = countLines(buf);
  if (lines === 0) return false;
  return buf.length / lines > threshold;
}

/**
 * Combined generated / vendored decision for one blob at one path.
 *
 * @param {{path: string, content?: Buffer|string|null, isBinary?: boolean}} input
 */
export function isGenerated({ path, content = null, isBinary = false }) {
  if (isGeneratedPath(path)) return true;
  if (isBinary || content == null) return false;
  return isMinifiedContent(content);
}

/**
 * Number of lines: newline-terminated lines plus a final unterminated one.
 * An empty file has 0 lines; "a\nb" and "a\nb\n" both have 2.
 *
 * @param {Buffer|Uint8Array|string} content
 */
export function countLines(content) {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  if (!buf || buf.length === 0) return 0;
  let n = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0a) n++;
  }
  if (buf[buf.length - 1] !== 0x0a) n++;
  return n;
}

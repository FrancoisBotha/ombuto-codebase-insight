// Pure binary / generated detection and line counting used by the Extract
// files stage (FR-005, epic 1 §10: heuristic, expect tuning).
import { describe, it, expect } from 'vitest';
import {
  BINARY_SNIFF_BYTES,
  MINIFIED_AVG_LINE_LENGTH,
  isBinaryContent,
  isGeneratedPath,
  isMinifiedContent,
  isGenerated,
  countLines,
} from '../../../../src/shared/files/fileHeuristics.js';

describe('fileHeuristics · isBinaryContent', () => {
  it('flags content with a NUL byte in the first chunk', () => {
    expect(isBinaryContent(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x00, 0x1a]))).toBe(true);
    expect(isBinaryContent(Buffer.from('abc\0def'))).toBe(true);
  });

  it('treats text without NUL bytes as text, including UTF-8 and empty files', () => {
    expect(isBinaryContent(Buffer.from('hello\nworld\n'))).toBe(false);
    expect(isBinaryContent(Buffer.from('héllo wörld — ünïcode ✓\n', 'utf8'))).toBe(false);
    expect(isBinaryContent(Buffer.alloc(0))).toBe(false);
  });

  it('only inspects the first chunk', () => {
    expect(BINARY_SNIFF_BYTES).toBeGreaterThan(0);
    const late = Buffer.concat([Buffer.alloc(BINARY_SNIFF_BYTES, 0x61), Buffer.from([0])]);
    expect(isBinaryContent(late)).toBe(false);
    const early = Buffer.concat([Buffer.alloc(BINARY_SNIFF_BYTES - 1, 0x61), Buffer.from([0]), Buffer.alloc(10, 0x61)]);
    expect(isBinaryContent(early)).toBe(true);
  });
});

describe('fileHeuristics · isGeneratedPath', () => {
  it('flags well-known vendored and build output folders anywhere in the path', () => {
    for (const p of [
      'node_modules/left-pad/index.js',
      'packages/app/node_modules/x/y.js',
      'vendor/github.com/pkg/errors/errors.go',
      'dist/app.js',
      'build/main.js',
      'out/bundle.js',
      'target/classes/App.class',
      'bin/Debug/App.dll',
      'obj/Debug/App.dll',
      'bower_components/jquery/jquery.js',
      '.yarn/releases/yarn-3.2.0.cjs',
      '__pycache__/mod.cpython-311.pyc',
      '__generated__/schema.js',
      'third_party/lib/x.c',
    ]) {
      expect(isGeneratedPath(p), p).toBe(true);
    }
  });

  it('flags lockfiles', () => {
    for (const p of [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'npm-shrinkwrap.json',
      'Cargo.lock',
      'go.sum',
      'poetry.lock',
      'Pipfile.lock',
      'composer.lock',
      'Gemfile.lock',
      'packages.lock.json',
      'src/packages.lock.json',
    ]) {
      expect(isGeneratedPath(p), p).toBe(true);
    }
  });

  it('flags minified bundles, source maps and generated code by name', () => {
    for (const p of [
      'assets/app.min.js',
      'assets/app.min.css',
      'assets/vendor.min.map',
      'assets/app.js.map',
      'assets/app.bundle.js',
      'src/Api.generated.cs',
      'src/Form.Designer.cs',
      'src/Models.g.cs',
      'proto/api.pb.go',
      'proto/api_pb2.py',
      'proto/api_pb2_grpc.py',
    ]) {
      expect(isGeneratedPath(p), p).toBe(true);
    }
  });

  it('leaves ordinary source paths alone', () => {
    for (const p of [
      'src/index.js',
      'src/worker/stages/extractFiles.js',
      'docs/Data Model/Schema.ddl',
      'package.json',
      'README.md',
      'src/distribution/report.js', // "dist" only as a whole segment
      'src/vendors.js',
      'tests/unit/build.test.js',
      'src/minify.js',
    ]) {
      expect(isGeneratedPath(p), p).toBe(false);
    }
  });

  it('accepts backslash separators and a leading ./', () => {
    expect(isGeneratedPath('node_modules\\x\\y.js')).toBe(true);
    expect(isGeneratedPath('./dist/app.js')).toBe(true);
  });
});

describe('fileHeuristics · isMinifiedContent', () => {
  it('flags text whose average line length is very long', () => {
    const minified = `${'var a=1;'.repeat(200)}\n${'b();'.repeat(300)}\n`;
    expect(minified.length / 2).toBeGreaterThan(MINIFIED_AVG_LINE_LENGTH);
    expect(isMinifiedContent(minified)).toBe(true);
    expect(isMinifiedContent(Buffer.from(minified))).toBe(true);
  });

  it('does not flag ordinary code, empty files or short one-liners', () => {
    const code = Array.from({ length: 50 }, (_, i) => `const value${i} = compute(${i}); // comment`).join('\n');
    expect(isMinifiedContent(code)).toBe(false);
    expect(isMinifiedContent('')).toBe(false);
    expect(isMinifiedContent('export default {};\n')).toBe(false);
  });
});

describe('fileHeuristics · isGenerated', () => {
  it('combines path and content heuristics', () => {
    expect(isGenerated({ path: 'node_modules/x/index.js', content: 'ok\n' })).toBe(true);
    expect(isGenerated({ path: 'src/app.js', content: `${'x();'.repeat(500)}\n` })).toBe(true);
    expect(isGenerated({ path: 'src/app.js', content: 'const a = 1;\n' })).toBe(false);
  });

  it('never applies the line-length rule to binary content', () => {
    const blob = Buffer.concat([Buffer.from([0]), Buffer.alloc(5000, 0x61)]);
    expect(isGenerated({ path: 'assets/logo.png', content: blob, isBinary: true })).toBe(false);
  });
});

describe('fileHeuristics · countLines', () => {
  it('counts newline-terminated lines and a trailing unterminated line', () => {
    expect(countLines(Buffer.from('a\nb\nc\n'))).toBe(3);
    expect(countLines(Buffer.from('a\nb\nc'))).toBe(3);
    expect(countLines('a\r\nb\r\n')).toBe(2);
    expect(countLines(Buffer.from('single line'))).toBe(1);
  });

  it('counts an empty file as zero lines', () => {
    expect(countLines(Buffer.alloc(0))).toBe(0);
    expect(countLines('')).toBe(0);
  });
});

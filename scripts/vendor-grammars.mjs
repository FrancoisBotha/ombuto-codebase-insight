#!/usr/bin/env node
// Refreshes the tree-sitter grammar .wasm files in resources/grammars/.
//
// Why vendored: the official grammar npm packages ship working .wasm files but
// also run native install scripts (node-gyp-build) the app never needs, and the
// SQL grammar publishes no .wasm at all. The `tree-sitter-wasms` bundle is
// built for an older ABI and fails to load in web-tree-sitter 0.27.
//
// Usage:
//   node scripts/vendor-grammars.mjs          # npm-packaged grammars only
//   node scripts/vendor-grammars.mjs --sql    # also rebuild SQL from source
//                                             # (first run downloads ~700 MB of
//                                             #  wasi-sdk + binaryen into
//                                             #  %LOCALAPPDATA%/tree-sitter)
//
// To upgrade a grammar: bump its version below, run the script, run
// `npx vitest run tests/unit/grammars.smoke.test.js`, commit resources/grammars/.
// web-tree-sitter 0.27 accepts grammar ABI 13–15; the smoke test catches drift.

import { execSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'resources', 'grammars');
const MANIFEST = path.join(OUT, 'grammars.json');

const NPM_GRAMMARS = [
  { pkg: 'tree-sitter-javascript', version: '0.25.0', files: { javascript: 'tree-sitter-javascript.wasm' } },
  {
    pkg: 'tree-sitter-typescript',
    version: '0.23.2',
    files: { typescript: 'tree-sitter-typescript.wasm', tsx: 'tree-sitter-tsx.wasm' },
  },
  { pkg: 'tree-sitter-python', version: '0.25.0', files: { python: 'tree-sitter-python.wasm' } },
  { pkg: 'tree-sitter-java', version: '0.23.5', files: { java: 'tree-sitter-java.wasm' } },
  { pkg: 'tree-sitter-c-sharp', version: '0.23.5', files: { c_sharp: 'tree-sitter-c_sharp.wasm' } },
  { pkg: 'tree-sitter-go', version: '0.25.0', files: { go: 'tree-sitter-go.wasm' } },
  { pkg: 'tree-sitter-rust', version: '0.24.0', files: { rust: 'tree-sitter-rust.wasm' } },
];

const SQL_GRAMMAR = {
  pkg: 'DerekStride/tree-sitter-sql',
  version: '0.3.13',
  cli: 'tree-sitter-cli@0.27.2',
  url: 'https://github.com/DerekStride/tree-sitter-sql/releases/download/v0.3.13/tree-sitter-sql-v0.3.13.tar.gz',
  files: { sql: 'tree-sitter-sql.wasm' },
};

// Commands are built only from the constants above (no user input), so a plain
// shell string is safe and lets Windows resolve npm.cmd / npx.cmd.
const run = (command, cwd) =>
  execSync(command, { cwd, stdio: ['ignore', 'pipe', 'inherit'] }).toString().trim();
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

function readManifest() {
  return fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) : { grammars: {} };
}

function record(manifest, lang, file, source) {
  const dest = path.join(OUT, file);
  manifest.grammars[lang] = { file, ...source, sha256: sha256(dest), bytes: fs.statSync(dest).size };
}

function copyLicence(fromDir, name) {
  const lic = fs.readdirSync(fromDir).find((f) => /^licen[cs]e/i.test(f));
  if (!lic) throw new Error(`No licence file found for ${name}`);
  fs.mkdirSync(path.join(OUT, 'licenses'), { recursive: true });
  fs.copyFileSync(path.join(fromDir, lic), path.join(OUT, 'licenses', `${name.replace('/', '__')}.LICENSE`));
}

function vendorNpm(manifest, tmp) {
  for (const g of NPM_GRAMMARS) {
    const dir = fs.mkdtempSync(path.join(tmp, 'pkg-'));
    // `npm pack` only downloads the tarball; no install scripts run.
    const tgz = run(`npm pack ${g.pkg}@${g.version} --silent`, dir).split(/\r?\n/).pop();
    run(`tar -xzf ${tgz}`, dir);
    const pkgDir = path.join(dir, 'package');
    for (const [lang, file] of Object.entries(g.files)) {
      fs.copyFileSync(path.join(pkgDir, file), path.join(OUT, file));
      record(manifest, lang, file, { source: `npm:${g.pkg}@${g.version}`, license: 'MIT' });
    }
    copyLicence(pkgDir, g.pkg);
    console.log(`vendored ${g.pkg}@${g.version}`);
  }
}

async function vendorSql(manifest, tmp) {
  const dir = fs.mkdtempSync(path.join(tmp, 'sql-'));
  const res = await fetch(SQL_GRAMMAR.url);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${SQL_GRAMMAR.url}`);
  fs.writeFileSync(path.join(dir, 'src.tar.gz'), Buffer.from(await res.arrayBuffer()));
  run('tar -xzf src.tar.gz', dir);
  const file = SQL_GRAMMAR.files.sql;
  run(`npx --yes ${SQL_GRAMMAR.cli} build --wasm -o ${file} .`, dir);
  fs.copyFileSync(path.join(dir, file), path.join(OUT, file));
  record(manifest, 'sql', file, {
    source: `github:${SQL_GRAMMAR.pkg}@v${SQL_GRAMMAR.version} (built with ${SQL_GRAMMAR.cli})`,
    license: 'MIT',
  });
  copyLicence(dir, SQL_GRAMMAR.pkg);
  console.log(`built ${SQL_GRAMMAR.pkg}@${SQL_GRAMMAR.version}`);
}

fs.mkdirSync(OUT, { recursive: true });
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'insight-grammars-'));
const manifest = readManifest();
try {
  vendorNpm(manifest, tmp);
  if (process.argv.includes('--sql')) await vendorSql(manifest, tmp);
  manifest.grammars = Object.fromEntries(Object.entries(manifest.grammars).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2) + '\n');
  console.log(`wrote ${path.relative(ROOT, MANIFEST)}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

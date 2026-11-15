# Test Strategy

Playbook for every ticket's build and test phases on Ombuto Codebase Insight.
All commands run from the repository root on Windows (PowerShell or Git Bash),
macOS or Linux.

## 1. Stack and frameworks
- Language and version: JavaScript (ES modules, `"type": "module"`), no TypeScript.
  Node.js >= 22 for tooling. The app itself runs on Electron 45's bundled Node (24.x).
- App frameworks: Electron 45 (main process + `utilityProcess` pipeline worker +
  sandboxed preload), Vue 3 + Pinia renderer built by Vite 8.
- Test framework(s): Vitest 4. Vue components are tested with `@vue/test-utils`
  in a `happy-dom` environment (opt-in per file).
- Lint tool(s): none — no linter configured for this project.
- Type-check tool(s): none — plain JavaScript, no type checker.
- Code formatter(s): none — no formatter configured for this project.

## 2. Test directory layout
- `tests/unit/` — unit tests for all processes (main, worker, shared, renderer).
  Mirror the source path in the file name when it helps, e.g.
  `src/worker/stages/extractHistory.js` → `tests/unit/worker/extractHistory.test.js`.
- `tests/integration/` — not created yet. Use it for tests that need a real
  git repository fixture, a real on-disk SQLite database, or that run a full
  pipeline stage end to end.
- `tests/fixtures/` — not created yet. Small fixture repositories and source
  files for parser and pipeline tests.
- Vitest picks up `tests/**/*.test.js` (see `vitest.config.js`).
- Current scaffold tests: `tests/unit/ipcChannels.test.js`,
  `tests/unit/App.test.js`, `tests/unit/sqlite.smoke.test.js`.

## 3. How to run tests for a specific file or test class
```bash
npx vitest run tests/unit/ipcChannels.test.js          # one file
npx vitest run tests/unit/worker/                      # one folder
npx vitest run tests/unit/App.test.js -t "renders"     # tests whose name matches
```

## 4. How to run the full project test suite
```bash
npm test          # = vitest run
```

## 5. Lint and type-check commands
- Lint: none — no linter configured.
- Type check: none — plain JavaScript.
- The closest compile gate is the renderer build, `npm run build` (Vite fails on
  syntax errors and bad imports in renderer code and `.vue` files). Main, preload
  and worker code are not bundled; a syntax error there shows up only when a
  test imports the file or the app is launched.

## 6. Coverage and reporting
Coverage not tracked. (`@vitest/coverage-v8` is not installed; do not add it
inside a feature ticket.)

## 7. Conventions tests must follow
- Naming: `<subject>.test.js` (e.g. `hotspotRanking.test.js`). Smoke tests that
  guard environment setup use `<subject>.smoke.test.js`.
- Directory: new unit tests go under `tests/unit/`, mirroring the `src/`
  sub-folder of the code under test (`main/`, `worker/`, `shared/`, `renderer/`).
- Style: `describe` per module/component, `it` per behaviour, arrange-act-assert.
  Import `describe/it/expect` explicitly from `vitest` (globals are off).
- Renderer component tests: add `// @vitest-environment happy-dom` on line 1,
  mount with a fresh `createPinia()`, and stub the preload bridge by assigning
  `window.insight = { ... }` (delete it in `afterEach`). Never import `electron`
  in renderer code or renderer tests.
- SQLite in tests: use `new Database(':memory:')` or a file under the OS temp
  dir. Never write to `<userData>`.
- Git in tests: build fixture repos in a temp dir with `simple-git`; never run
  git against this repository's own history.
- The analysed repository is untrusted input: tests must never execute fixture
  code, run its scripts or install its packages.

## 8. What NOT to test in the per-ticket TDD cycle
- Launching the real Electron app or driving the window (no E2E harness exists).
- Full pipeline runs over large or real-world repositories; performance and
  repo-size-ceiling measurements.
- Network calls to OSV.dev, package registries, Ollama, OpenRouter or any AI
  provider — stub `fetch` / the HTTP client instead.
- Spawning real AI CLIs (Claude Code, Codex, Gemini) — stub `child_process`.
- Visual layout of SVG treemaps and ELK graphs beyond "renders the expected
  nodes"; pixel or snapshot comparisons.
These belong in integration or regression tests, or in manual verification.

## 9. Known pitfalls on this project
- **Preload must stay CommonJS** (`src/preload/preload.cjs`). With
  `sandbox: true`, Electron cannot load an ESM preload. Its channel names are
  duplicated from `src/shared/ipcChannels.js`; keep the two in sync.
- **`.cjs` tools.** The package is `"type": "module"`, so `.js` files are ESM.
  Ombuto Code's tools in `.ombutocode/tools/*.cjs` must keep their `.cjs`
  extension.
- **better-sqlite3 uses N-API prebuilds** (v13), so one binary works in plain
  Node (tests) and Electron (app) with no `electron-rebuild`. If it is ever
  pinned to a version without N-API prebuilds, tests must run under Electron's
  Node (`cross-env ELECTRON_RUN_AS_NODE=1 electron node_modules/vitest/vitest.mjs run`)
  and a rebuild step must be added.
- **Dev server port is 5175** (`strictPort`), so it doesn't clash with Ombuto
  Code's 5174. `npm run electron:dev` fails fast if the port is taken.
- **`npm start` builds first.** The main process loads `dist/renderer/index.html`
  unless `VITE_DEV_SERVER_URL` is set; a stale `dist/` shows an old UI.
- **Renderer has no Node.** Anything needing the filesystem, git or SQLite goes
  through IPC to main (reads) or the worker (writes), never the renderer.
- **Node 25 on the dev machine** triggers harmless `EBADENGINE` warnings from
  some transitive tooling; Node 22/24 LTS avoids them.

## 10. Phase gates — what each agent runs

**The rule for deciding where something goes:**

| Put it in the BUILD phase when it is | Put it in the TEST phase when it is |
|---|---|
| Fast (seconds) | Slow (minutes) |
| Scopable to the files just changed | Only meaningful across the whole project |
| Deterministic, no external services | Needs a browser, database, network or fixture data |
| Catching mistakes in code just written | Catching regressions elsewhere |

### Build phase (in_progress) — MUST run before finishing, CHANGED FILES ONLY

- Formatter (write):  none — no formatter configured.
- Linter / vet:       none — no linter configured.
- Type / compile check: none for main/worker/preload/shared (plain JS, unbundled).
  If the ticket changed anything under `src/renderer/`, run `npm run build`
  (takes about a second) as the compile check.
- Tests written for this ticket: `npx vitest run <test files for this ticket>`
  (see section 3), plus existing test files covering the changed modules.

### Build phase — MUST NOT run (too slow, or owned by a later phase)

- Full test suite:    `npm test`
- Repo-wide lint:     none — no linter.
- Integration / E2E:  `npx vitest run tests/integration/` once that folder exists;
  no E2E suite exists.
- Production build / packaging: none — no packaging (electron-builder) is configured yet.

### Test phase — runs regardless

- The ticket's tests (`npx vitest run <files>`), plus `npm run build` if
  renderer files changed. This is verification, not first discovery.

### Splitting the tests themselves

- **Build agent runs:** the unit tests it wrote for this ticket under
  `tests/unit/`, and any existing unit tests covering the files it changed.
- **Test agent only:** `tests/integration/` (fixture git repos, on-disk SQLite,
  full pipeline stages) once it exists. No contract, snapshot or E2E suites exist.
- **Regression closeout ticket only:** the full suite, `npm test`.

### Notes

- `npm run build` covers the whole renderer and can't be scoped to single files;
  only errors in the ticket's own files count against it.
- Pre-existing failures in untouched files are never the current ticket's
  responsibility, in either phase.
- See also section 8 — what to leave out of the per-ticket TDD cycle.

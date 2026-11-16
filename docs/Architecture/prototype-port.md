# Prototype Port Record

The first increment of the renderer was ported from the design prototype using the
Bootstrap Prototype workflow. This file records what came from where and **every
deliberate deviation**. Downstream agents must treat the deviations below as
intentional and must not "fix" them back towards the prototype (or away from it)
without a ticket.

## Source

- **Location:** `docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/`
  (read-only reference; the handoff `README.md` there is the screen-by-screen spec).
- **Built with:** a single HTML file (`prototype/Codebase Insight.dc.html`, ~2,300
  lines) run by a proprietary React-style runtime (`support.js`, `DCLogic`
  component, `<sc-if>`/`<sc-for>` templates), the Ombuto Code Design System tokens
  and component CSS, a React bundle of DS components (Button, Badge, StatusBar),
  Roboto / Roboto Mono from Google Fonts and `@mdi/font@6.9.96` from jsDelivr.
- **Data:** entirely hard-coded sample data for the fictional repo `harbor-api`.
- **Fidelity confirmed:** the user compared the running Electron app with the
  prototype and confirmed it matches (2026-11-15).

## Build and run (verified)

| Purpose | Command |
| --- | --- |
| Install | `npm install` |
| Build renderer | `npm run build` (Vite → `dist/renderer/`) |
| Run (dev, hot reload) | `npm run electron:dev` (Vite on `http://127.0.0.1:5175` + Electron) |
| Run (built) | `npm start` |
| Tests | `npx vitest run` |

Dev-only tweaks (the prototype's "Tweaks" props) are URL query params, read only
in dev builds: `?startScreen=<id>&viewState=loaded|empty|loading|error&theme=dark|light`,
e.g. `http://127.0.0.1:5175/?startScreen=overview&viewState=error` in a browser.

## Renderer structure

```
src/renderer/
  App.vue                     shell: root, layout, screen switch, status bar, toast,
                              global shortcuts, indexing ticker
  main.js                     fonts/icons (npm), CSS, Pinia, v-hover directive
  assets/ds/*.css             DS tokens + component CSS (verbatim)
  assets/main.css             imports tokens + prototype <style> block (verbatim)
  assets/logo.svg             prototype assets/logo.svg
  components/ds/              OmButton, OmBadge, OmStatusBar (Vue ports of DS React components)
  components/shell/           TitleBar, AppSidebar, CommandPalette
  components/CodeView.vue     CodeMirror 6 read-only code viewer (Ask + Files)
  views/<Screen>View.vue      one per prototype screen
  stores/insightStore.js      the prototype's component state, as one Pinia store
  stores/appStore.js          app name/version from the preload bridge (pre-existing)
  data/insightData.js         THE data seam — views import data only from here
  mock/harborApi.js           prototype top-level sample constants (verbatim)
  mock/screens/<screen>.js    sample arrays that were inline in renderVals()/more()
  lib/                        view constants and helpers extracted from the prototype
```

## File map: prototype → repository

| Prototype | Repository |
| --- | --- |
| `<helmet>` `<link>`s to `_ds/…/tokens/*.css` | `src/renderer/assets/ds/{colors,typography,spacing,components}.css` (verbatim) |
| `_ds/…/tokens/fonts.css` (CDN `@import`s) | `src/renderer/main.js` imports of `@fontsource/roboto`, `@fontsource/roboto-mono`, `@mdi/font` |
| `<style>` block in `<helmet>` | `src/renderer/assets/main.css` (verbatim) |
| `assets/logo.svg` | `src/renderer/assets/logo.svg` |
| DS bundle `Button` / `Badge` / `StatusBar` | `components/ds/OmButton.vue` / `OmBadge.vue` / `OmStatusBar.vue` |
| Root `.om-root`, layout, status bar, toast (lines 26–27, 132, 1704–1707, 1777–1780) | `App.vue` |
| Title bar (28–56) | `components/shell/TitleBar.vue` |
| Sidebar (60–130) | `components/shell/AppSidebar.vue` |
| Command palette (1752–1776) + `palItems()` | `components/shell/CommandPalette.vue`, `lib/palette.js` |
| `componentDidMount` keyboard handler + indexing interval | `App.vue` (`onKey`, `setInterval`) |
| `state={…}`, `setState`, `go`, `toast` | `stores/insightStore.js` |
| Welcome (`is.welcome`) | `views/WelcomeView.vue` (real data since OPINV-006; `mock/screens/welcome.js` deleted) |
| Indexing (`is.indexing`) | `views/IndexingView.vue` (real data since OPINV-006; `mock/screens/indexing.js` deleted) |
| Overview (`is.overview`, 4 view states) | `views/OverviewView.vue`, `mock/screens/overview.js` |
| Size & Inventory (`is.inventory`) | `views/InventoryView.vue`, `mock/screens/inventory.js` |
| Architecture (`is.architecture`) | `views/ArchitectureView.vue` |
| Complexity (`is.complexity`) | `views/ComplexityView.vue`, `mock/screens/complexity.js` |
| Code Quality (`is.quality`) | `views/QualityView.vue`, `mock/screens/quality.js` |
| Dependencies (`is.deps`) | `views/DepsView.vue`, `mock/screens/deps.js` |
| Hotspots (`is.hotspots`) | `views/HotspotsView.vue`, `mock/screens/hotspots.js` |
| Commit History (`is.history`) | `views/HistoryView.vue`, `mock/screens/history.js` |
| Ask the Codebase (`is.ask`) | `views/AskView.vue`, `mock/screens/ask.js` |
| Diagrams (`is.diagrams`) | `views/DiagramsView.vue` |
| Files (`is.file`) | `views/FileView.vue`, `mock/screens/file.js` |
| Share Report (`is.report`) | `views/ReportView.vue`, `mock/screens/report.js` |
| Settings (`is.settings`) + OpenRouter model dialog (`st.or.dlg`) | `views/SettingsView.vue` (dialog teleported to `#om-root`), `mock/screens/settings.js` |
| Constants `AUTHORS`…`COMMITS` (sample data) | `mock/harborApi.js` (verbatim, `export` added) |
| `METRICS`, `NAV`, `SEV`, `VSEV`, `STAT` | `lib/constants.js` (verbatim) |
| `hx`, `mix`, `ramp`, `lum`, `HEAT`, `AGE` | `lib/color.js` (verbatim) |
| `hash`, `rng` | `lib/random.js` (verbatim) |
| `sevOf`, `seg`, `tabs` (top of `more()`) | `lib/viewHelpers.js` |
| `Component.treemap()` | `lib/treemap.js` (`buildTreemap`) |
| `Component.code()` + `tok()` | `components/CodeView.vue` |
| `style-hover="…"` attribute | `lib/hoverStyle.js` (`v-hover` directive) |

## Deviations from the prototype

Each item is intentional. The reason is the constraint that forced it.

### Agreed with the user at plan time

1. **Vue 3 SFCs instead of the DC/React runtime.** *Architecture §2 (Vue 3 + Pinia + Vite).*
   Markup and inline styles were copied verbatim; bindings became `:style`, `v-if`, `v-for`.
   `support.js` and the DS React bundle are not used.
2. **Sample data lives in the renderer behind one seam.** *Architecture §3 says every
   screen reads from SQLite via read-only IPC, but no pipeline or IPC queries exist yet.*
   All sample data is in `src/renderer/mock/` and reached only through
   `src/renderer/data/insightData.js`. View-model derivations (sorting, widths, tones,
   treemap layout) are in the views' `computed`, as in the prototype. **Follow-up:**
   replace the seam's exports with IPC queries against `insight.db`, and move
   metric-like derivations (e.g. hotspot ranking by churn × complexity, severity
   from `sevOf`) into the pipeline's `metric_*`/`report_*` tables.
3. **Fonts and icons bundled locally from npm** (`@fontsource/roboto`,
   `@fontsource/roboto-mono`, `@mdi/font` pinned to the prototype's `6.9.96`).
   *Local-first principle and the renderer CSP (`default-src 'self'`) forbid CDN loads.*
   Glyphs and fonts are identical.
4. **Code panes use CodeMirror 6** (`components/CodeView.vue`) for both Ask's preview and
   Files. *Architecture §2 names CodeMirror 6 as the code viewer (user's decision).*
   Consequences:
   - Token colours use the same palette as the prototype's tokenizer (keywords blue,
     types yellow, strings green, numbers orange, comments muted, punctuation label),
     but tokens are classified by the Lezer TypeScript parser, so some tokens colour
     differently (e.g. function names stay default text).
   - Files: the per-line complexity heat bar and blame-age strip are CodeMirror gutters
     with the prototype's formulas and colours.
   - Files: the row hover tint covers the code text only, not the line-number gutter.
   - Files: the "N more lines" fold sits pinned below the code pane instead of at the
     end of the scrolled code (CodeMirror owns its scroller).
5. **Treemap layout uses d3-hierarchy** (`treemapSquarify.ratio(1)`, same padding).
   *Architecture §2 names d3-hierarchy (user's decision).* Tile arrangement can differ
   slightly from the prototype's own `squarify`. Affects Hotspots and the Overview mini map.
6. **Module graph keeps the prototype's fixed node positions.** *Architecture §2 names
   elkjs; the positions are sample data.* elkjs comes in with real graph data.
7. **Frameless Electron window.** *The prototype draws its own title bar with window
   buttons.* `BrowserWindow` uses `frame: false`; the title bar is the drag region
   (`.app-drag` / `.app-no-drag` in `main.css`); the buttons call
   `window.insight.window.{minimize,toggleMaximize,close}` over new
   `window:*` IPC channels (`src/shared/ipcChannels.js`, `preload.cjs`, `main.js`).
   These are window controls, not data queries; the read-only rule for data IPC stands.
8. **One Pinia store mirroring the prototype's component state** (`insightStore.js`):
   same keys and defaults, `setState`/`go`/`toast` with the prototype's semantics, plus
   `later(key, ms, fn)` for the prototype's named timeouts. Deep links between screens
   behave as before.
9. **Dev "Tweaks" props are URL query params in dev builds only** (see Build and run).
10. **Status bar shows the real app version** from the existing `getAppInfo` bridge
    (`Codebase Insight 0.1.0`) instead of the prototype's hard-coded `0.4.0`.
11. **Shortcut glyphs kept as ⌘** everywhere, as in the prototype; the handler accepts
    Ctrl or Meta, as the prototype's did.

### Found during the port

12. `style-hover` became the `v-hover` directive, which emits generated `:hover` CSS
    rules marked `!important` (so they win over inline styles, as in the prototype runtime).
13. Settings' OpenRouter model dialog is rendered with `<Teleport defer to="#om-root">`
    so its absolute overlay is positioned against the app root, as in the prototype.
14. Settings keeps a single provider list (`SETTINGS_PROVIDERS`) where the prototype
    rebuilt it twice; toggle-pill styles are produced by two style helpers with
    identical values. No visible change.
15. Complexity's "Over warn / Over critical" stat labels and values are filled from the
    active thresholds in the view (mock stores `null`), reproducing the prototype's
    `'Over '+W` construction.
16. Commit History's activity heatmap is generated once on load (the prototype
    regenerated it every render from the same fixed seed `rng(91)`, so output is the same).
    Commits without a `GFILES` entry pick two sample files with a random-comparator
    sort, as the prototype did; the pick depends on the engine's sort, as before.
17. C4 relationship label font size is written `11px` (React accepted a bare `11`).
18. Some list items carry extra `id` / `k` / `slug` fields used only as Vue `:key`s.
19. `@lezer/highlight` is declared as a direct dependency (it was already present
    transitively via CodeMirror) because `CodeView` imports its `tags`.

## Prototype behaviour preserved as-is (do not treat as bugs of the port)

- ⌘E, ⌘J and ⌘R appear as hints but have no keyboard handler (only the palette,
  ⌘1–9, ⌘, ⌘B, ⌘O and Esc are wired), exactly as in the prototype.
- Inert buttons and controls in the prototype stay inert: Indexing *Pause*; Overview
  *View main Results*, *Fetch Full History*, *Continue Without History*, *Copy Log*;
  Hotspots period select; Commit History author/period selects and the "↑↓ move · ⏎
  open diff" hint; Diagrams "Generate diagram" (+); Files fold chip and Summary
  *Regenerate*.
- The Overview mini treemap colours by the current hotspot metric (`S.metric`) even
  though its label reads "Churn × Complexity".
- All AI answers, explanations, tests and exports are mocked with timers and toasts.
  (Welcome's "Open Folder…", drop zone and recents, the Indexing screen, the title
  bar, sidebar footer and status bar run on real data since epic 1 / OPINV-006:
  `stores/repoStore.js` + `lib/indexingModel.js` over the `window.insight` bridge.
  ⌘O opens the native dialog and ⌘R re-runs the analysis; the health pill and the
  recent-row score chip show "—" until Epic 5.)

## Not ported

- `support.js` (prototype runtime) and `_ds/…/_ds_bundle.js` (DS React components);
  replaced by Vue equivalents.
- `_ds/…/_adherence.oxlintrc.json`, `_ds_manifest.json`, `readme.md`, `styles.css`
  (the CSS is imported via `main.css` instead).
- The prototype's `squarify()` and `tok()` (replaced by d3-hierarchy and CodeMirror).
- Dead code: `CXFN_OLD` is extracted with the other constants but unused; unused
  view-model fields (`hasClasses`, class `low`, history `gh.gh`/`mainOnly`/`isMerge`/
  `refs[].tag`/`on`, inventory language `m`/`b` and `udet`, complexity `warn`/`crit`,
  co-change `w`, settings `tRedact`) are computed or dropped but never rendered, as in
  the prototype.

## Known gaps / suggested follow-up tickets

- Replace `data/insightData.js` exports with read-only IPC queries backed by `insight.db`
  (screen by screen), and delete the corresponding `mock/` files.
- Lay out the module graph with elkjs once real module data exists.
- Real "Open Folder…" (native dialog via main process) and drag-and-drop on Welcome.
- Decide whether ⌘E / ⌘J / ⌘R should be wired (product decision; unwired in the prototype).
- Optional `CodeView` slot so the Files "N more lines" fold scrolls with the code.
- Platform-aware shortcut glyphs (Ctrl on Windows/Linux), which the handoff README
  mentions but the prototype does not implement.
- Code-split the renderer bundle (Vite warns at ~740 kB; harmless for a desktop app).
- Unit tests for ported behaviour per `docs/Test Strategy/test-strategy.md`
  (only the shell test was updated in this port).

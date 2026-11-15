# Epic 1: Open & Inventory a Repo

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15

---

## 1. Purpose
Turn the ported prototype into a working product for the first time. Today
every screen shows hard-coded sample data for the fictional `harbor-api`
repo, the worker is a ping/pong stub and there are no data IPC queries. This
epic puts the minimum real plumbing in place: the per-repo database, the
pipeline worker with its first stage, safe git access and read-only IPC. On
top of that it gives the user a real repo they can open, watch being
indexed, measure and read.

It also makes it obvious which screens are still running on sample data:
those screens get a "Prototype" banner until the epic that wires them
removes it.

**Working increment:** A user can open any local git repository with a
folder dialog, watch it index, and then browse its real file inventory
(languages, lines, size distribution, largest files and folders). They can
read any file's code in the Files view, and reopening the repo later is
instant.

## 2. User Story
As a developer who has just inherited a codebase,
I want to point the app at my local checkout and see what's in it,
So that I get an honest picture of its size and shape without uploading it
anywhere.

## 3. Scope
- **In Scope:**
  - Welcome: real "Open Folder…" (native dialog), drag-and-drop of a folder,
    non-git folders rejected, system git check, real recent repositories
    (open, remove).
  - Per-repo `insight.db` created from `docs/Data Model/Schema.ddl` at
    `<userData>/repos/<repo-id>/insight.db`, WAL mode, foreign keys on,
    `schema_meta` filled.
  - Pipeline worker (`utilityProcess`) with a stage runner, run/stage
    bookkeeping (`pipeline_run`, `pipeline_stage`) and progress events.
  - Stage 1 **Extract files**, without tree-sitter: the tracked file tree at
    HEAD, blob metadata, language by extension, binary and generated
    detection, and content for text files.
  - Read-only typed IPC queries for Welcome, Indexing, Size & Inventory,
    Files, the command palette's file search, the title bar, the sidebar
    footer and the status bar.
  - Indexing screen driven by real stage events. Stages not built yet show
    as skipped.
  - Size & Inventory: the parts derivable from file data (files, lines,
    lines by language, size distribution, largest files, lines by folder).
  - Files: real explorer tree and real code in the CodeMirror pane.
  - The sidebar footer's refresh (⌘R) re-runs a full analysis.
  - A reusable "Prototype" banner on every screen, and Settings section,
    whose data still comes from `src/renderer/mock/`.
- **Out of Scope:**
  - tree-sitter parsing, functions/classes/types counts and comment/blank
    line splits (Epic 2). Those Inventory cells show "Not analysed yet".
  - git history, blame and hotspots (Epics 3–4).
  - Incremental re-extraction, branch switching and ignored paths
    (Epic 14). This epic always does a full extract for a new HEAD.
  - Files "Open in Editor". Opening untrusted repo files with the OS
    default handler can run them (`.bat`, `.command`), so it needs its own
    ticket and a safety decision.
  - Persisting Appearance settings (theme, title bar colour).
  - The Diagrams and Share Report screens. They keep the Prototype banner;
    they aren't PRD must-haves.

## 4. Functional Requirements
1. FR-001 — Welcome "Open Folder…" (⌘O) opens a native folder dialog, and
   dropping a folder on the drop zone does the same. A folder that is not
   inside a git work tree is rejected with a clear message.
2. FR-002 — Welcome checks that the system git CLI is available. If it is
   missing, it says so and explains how to install it, and opening is
   disabled.
3. FR-003 — Recent repositories are stored in `electron-store` and listed on
   Welcome with path and last-analysed time. Clicking a row opens it.
   "Remove from recents" deletes that repo's `insight.db` folder.
4. FR-004 — Opening a repo creates or opens its `insight.db` from
   `Schema.ddl`, writes `raw_snapshot` for HEAD and starts a pipeline run in
   the worker.
5. FR-005 — The Extract files stage records every tracked file at HEAD in
   `raw_tree_entry` and each distinct blob in `raw_blob` (language by
   extension, size, line count, binary and generated flags). It also stores
   text content in `raw_blob_content`, which fills the FTS index through the
   existing triggers.
6. FR-006 — The Indexing screen shows the real run: overall progress,
   per-stage status and counts, a log of stage events, and the error of a
   failed stage. When Extract files is done, "Start exploring now" unlocks
   Size & Inventory and Files.
7. FR-007 — Size & Inventory shows real totals, lines by language, file size
   distribution (median, P90, max, histogram, concentration), largest files
   and lines by folder. Clicking a file opens it in Files.
8. FR-008 — Files shows the real explorer tree with a filter, and real code
   from the database in the CodeMirror pane. The command palette's Files
   group searches real paths.
9. FR-009 — Reopening a repo whose HEAD already has a completed run opens
   straight from the database without re-running the pipeline. A different
   HEAD starts a new run.
10. FR-010 — Every screen, and every Settings section, whose data still
    comes from `src/renderer/mock/` shows a "Prototype" banner saying it
    shows sample data. Screens backed by the database show no banner.
    Within a real screen, a panel with no real data yet shows an empty "Not
    analysed yet" state, never sample data.

## 5. Non-Functional Requirements
1. NFR-001 — The analysed repo is read-only and untrusted. git always runs
   with an argument array (no shell), `--no-textconv`, no external diff and
   `core.fsmonitor` disabled. Nothing from the repo is executed.
2. NFR-002 — The renderer has no filesystem, git or SQLite access. Data
   reaches it only through typed, read-only IPC queries. `contextIsolation`
   and `sandbox` stay on and `nodeIntegration` stays off.
3. NFR-003 — The worker is the only writer to `insight.db`. Each stage
   commits in its own transaction and is idempotent: re-running it for the
   same commit gives the same rows.
4. NFR-004 — A worker crash or a stage error marks the run `failed` with the
   error recorded and shown. The app stays up, and the UI stays responsive
   while indexing.
5. NFR-005 — Reopening an already analysed, unchanged repo of about 100k
   lines shows Size & Inventory within 1 second.

## 6. UI/UX Notes
- Keep the ported prototype's layout and styles. The data changes, the look
  doesn't (see `docs/Architecture/prototype-port.md`).
- Prototype banner: a slim, full-width strip under the screen header, in
  the info tone, with an `mdi-flask-outline` icon and the text "Prototype —
  this screen shows sample data, not your repository". It uses existing
  `--om-*` tokens and is one shared component.
- The title bar repo name and branch pill, sidebar repo name, footer
  "Analysed … · <sha>", and status bar path/branch/file count become real.
  The health-score pill and the Welcome recent-row score chip show a neutral
  "—" until Epic 5.
- After indexing, "Explore Partial Results" and the end of the run land on
  Size & Inventory, which becomes Overview in Epic 5.
- Indexing's Pause button stays inert (as in the prototype).

## 7. Data Model Impact
- Uses the existing tables: `schema_meta`, `raw_snapshot`, `pipeline_run`,
  `pipeline_stage`, `raw_blob`, `raw_blob_content`, `raw_tree_entry`,
  `raw_content_fts`.
- `raw_blob.parse_status` is `skipped` for every blob in this epic, because
  nothing is parsed yet.
- Inventory aggregates come from read-only SQL over `raw_tree_entry` and
  `raw_blob`. `metric_file` arrives in Epic 2.
- No schema change expected. If one is needed, update `Schema.ddl` in the
  same ticket.

## 8. Integration Impact
- System git CLI through a single safe runner module in main/worker (also
  used by Epics 3, 4, 14).
- `electron-store` for recent repositories.
- `src/shared/ipcChannels.js`, `src/preload/preload.cjs` and
  `src/main/main.js` gain data query channels and worker messages. These are
  scaffolding files, so tickets that touch them must be chained.
- `src/renderer/data/insightData.js`, the data seam, switches Welcome,
  Indexing, Inventory and Files exports to IPC. Their `mock/screens/*.js`
  files are deleted.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can open a real local git
      repo, watch it index, browse its Size & Inventory and read any file's
      code, end to end, without any other epic being complete.
- [ ] Opening a non-git folder, or running without git installed, gives a
      clear message and no crash.
- [ ] Reopening an analysed repo from Recents shows results with no
      pipeline run (NFR-005).
- [ ] "Remove from recents" deletes that repo's database folder.
- [ ] Every screen still on sample data shows the Prototype banner. Welcome,
      Indexing, Size & Inventory and Files don't.
- [ ] The git runner has unit tests proving the safe flags and argument
      arrays (NFR-001).
- [ ] `npx vitest run` passes, including `tests/unit/schema.test.js`.

## 10. Risks & Unknowns
- Large repos: storing every text blob's content makes the database
  roughly as large as the checkout. That is accepted in Architecture §5;
  measure it on a large repo.
- Generated and vendored detection is heuristic (minified line length,
  well-known paths). Expect tuning.
- `repo-id` must be stable per checkout. Use a hash of the normalised
  absolute path, and handle case-insensitive Windows paths.
- This epic carries the most plumbing and is at the top of the ticket
  range.

## 11. Dependencies
- None. This is the first slice. It depends on the Bootstrap Prototype port
  already in `master` (tooling, not an epic).

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md (§3 pipeline, §5 security)
- prototype port: docs/Architecture/prototype-port.md
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Welcome, Indexing, Size & Inventory, Files)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- test strategy: docs/Test Strategy/test-strategy.md
- epic: epic_01_OPEN_AND_INVENTORY.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Note: `docs/Code Map/` does not exist yet. This epic's closeout ticket
creates it for the first time.

Suggested tickets (complexity: high, about 8 tickets):
1. Database module: create or open `insight.db` from `Schema.ddl`, set
   pragmas, `schema_meta`, repo-id and paths (back end).
2. Safe git runner, git availability check, folder validation, native
   dialog and recents in `electron-store` (back end, main).
3. Worker stage runner, run/stage bookkeeping, progress events and the
   Extract files stage (back end, worker).
4. Read-only IPC queries plus preload bridge for repo, run status,
   inventory, file tree and file content (scaffolding, chain after 1–3).
5. Welcome and Indexing views on real data (front end).
6. Size & Inventory and Files views on real data, plus palette file search
   (front end).
7. Prototype banner component, applied to every mock-backed screen and
   Settings section (front end).
8. Closeout: end-to-end check on a real repo and code map regeneration.

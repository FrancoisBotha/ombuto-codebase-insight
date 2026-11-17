# Epic 2: Function Complexity

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-17
Depends On: epic_01_OPEN_AND_INVENTORY

---

## 1. Purpose
Bring in real code parsing. The Extract files stage starts parsing supported
languages with `web-tree-sitter` and the vendored grammars. A first
Transform stage computes per-function complexity, and the Complexity screen
moves from sample data to the user's repo. Inventory gains the counts that
need a parser.

**Working increment:** A user can open their repo and see every function
ranked by complexity on the Complexity screen: distribution, long tail,
average by module and most-complex table, with a thresholds toggle. They can
jump from any function to its lines in Files, where a complexity heat gutter
shows the hot lines.

## 2. User Story
As a tech lead reviewing an unfamiliar codebase,
I want to see which functions are the most complex and how concentrated
that complexity is,
So that I know which code is hardest to change safely.

## 3. Scope
- **In Scope:**
  - Parse TS/JS/TSX, Python, Java, C#, Go, Rust and SQL blobs into
    `raw_symbol` and `raw_function`, using only the vendored grammars in
    `resources/grammars/`.
  - A Transform stage writing `metric_function` (cyclomatic, cognitive,
    band) and `metric_file` (loc, function count, complexity sum/max, module
    path, is_test).
  - Complexity screen on real data: stat strip (Functions, Median CC, P90
    CC, Over warn, Over critical), distribution, long tail, average CC by
    module, most-complex table (Function, File, Cyclomatic, Cog, Nest,
    Params, Severity) with All/Critical/Warning filters, and selected
    function detail with Open File.
  - The thresholds toggle (10/20 or 15/30), persisted in `electron-store`.
  - Size & Inventory gains comment and blank lines, Functions, Classes,
    Methods, Types, Largest Functions, and Language Units derivable from
    symbol kinds.
  - Files: complexity heat gutter, and the Metrics tab (tiles plus function
    table).
- **Out of Scope:**
  - Metrics the schema doesn't carry: Avg MI, MI, Halstead
    volume/difficulty/effort/bugs, returns count (Ret) and test coverage
    (Cov). These show "—"; adding them needs a new ticket with a schema
    change.
  - Δ 30d, the Rising filter and the "Over 20 · 12 Months" trend (Epic 14).
  - AI refactoring candidates. They aren't a PRD must-have and stay empty.
  - Language units that need data beyond symbol kinds (decorators,
    goroutine launches, unsafe blocks, hooks, migrations). These show "—".
  - Imports (Epic 6), and fingerprints and TODOs (Epic 7).

## 4. Functional Requirements
1. FR-011 — Extract files parses every supported-language blob with
   `web-tree-sitter` and writes `raw_symbol` and `raw_function` (params,
   lines, decision points, max nesting, nesting weight, cognitive
   complexity computed from the syntax tree; see §7). A blob that fails
   to parse is marked `parse_status = error` with its error, and the stage
   carries on.
2. FR-012 — A Transform stage computes `metric_function` (cyclomatic =
   decision points + 1, cognitive copied from `raw_function.cognitive`,
   band) and `metric_file` (loc excluding blank and comment
   lines, function count, complexity sum and max, module path, is_test from
   path conventions) for the analysed commit.
3. FR-013 — The Complexity screen shows the stat strip, distribution
   histogram, long-tail card, average CC by module and most-complex table,
   all from IPC queries. The table filters by All, Critical and Warning,
   and clicking a row shows that function's detail.
4. FR-014 — The thresholds toggle (10/20 or 15/30) re-colours the screen and
   is remembered between sessions.
5. FR-015 — Size & Inventory shows comment and blank lines, Functions,
   Classes, Methods, Types, Largest Functions and per-language units derived
   from `raw_symbol`.
6. FR-016 — Files shows the per-line complexity heat gutter and the Metrics
   tab (tiles and function table) for the open file.
7. FR-017 — Selecting a function (Complexity table, detail "Open File",
   Inventory's Largest Functions) opens Files scrolled to and highlighting
   that function's lines.

## 5. Non-Functional Requirements
1. NFR-006 — Extract files plus Transform for a repo of about 100k lines
   finishes within 2 minutes on a typical laptop. Indexing shows per-file
   progress.
2. NFR-007 — Grammars load only from `resources/grammars/` and are checked
   against the sha256 in `grammars.json`. A grammar that fails to load, or a
   parse that throws, affects only that language's or blob's rows, never
   the run.

## 6. UI/UX Notes
- Remove the Prototype banner from Complexity. Inventory's "Not analysed
  yet" cells fill in.
- Columns with no data source (MI, Ret, Cov, Δ 30d) show "—" with a tooltip
  "Not measured", and the Rising filter is disabled.
- Indexing's "Parsing files" stage shows real `n / total`.

## 7. Data Model Impact
- Writes `raw_symbol`, `raw_function`, `metric_function` and `metric_file`.
  `raw_blob.parse_status` becomes `parsed`, `skipped` or `error`.
- **Expected schema change (same ticket as the first extraction ticket):**
  add `raw_function.cognitive INTEGER NOT NULL`, computed during extraction
  while the syntax tree is in hand. Cognitive complexity (SonarSource spec)
  can't be rebuilt in Transform from `decision_points` and
  `nesting_weight`: it adds flat increments with no nesting penalty
  (`else`, `else if`, labelled `break`/`goto`, recursion) and counts each
  run of identical boolean operators once (`a && b && c` adds 1), so a
  Transform-time value would only approximate it. `metric_function.cognitive`
  stays and is copied from `raw_function`. Update `Schema.ddl` and run
  `tests/unit/schema.test.js`.
- **Expected schema change (same ticket as the Transform stage):**
  `metric_file` has NOT NULL columns this epic can't fill yet:
  `churn_commits`, `churn_lines`, `author_count`, `bus_factor`,
  `todo_count`, `undocumented_exports`, `has_test`. Make them nullable, with
  NULL meaning "not analysed yet", rather than writing misleading zeros.
  Epics 3, 4 and 7 fill them. Update `Schema.ddl` and run
  `tests/unit/schema.test.js`.

## 8. Integration Impact
- `web-tree-sitter` plus vendored grammars, loaded in the worker. No new
  npm grammar packages (see CLAUDE.md).
- New IPC queries for complexity and file metrics (scaffolding; chain the
  tickets).
- `mock/screens/complexity.js` is deleted. The inventory mock pieces still
  in use are removed.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can open a real repo,
      see its real function complexity on the Complexity screen and jump to
      a function's lines in Files, end to end, without any other epic being
      complete.
- [ ] Each supported language has a unit test showing symbol and
      decision-point extraction on a small fixture, including an expected
      cognitive complexity value.
- [ ] `raw_function.cognitive` is in `Schema.ddl`, and the schema test
      passes.
- [ ] A deliberately broken file is marked `error` and doesn't fail the run.
- [ ] Inventory shows real comment/blank lines and symbol counts.
- [ ] `metric_file` nullability change is in `Schema.ddl`, and the schema
      test passes.
- [ ] `npx vitest run` passes, including `tests/unit/grammars.smoke.test.js`.

## 10. Risks & Unknowns
- Cyclomatic and cognitive rules differ per language. Agree one
  decision-point node list per grammar and document it in the code.
- SQL complexity is of limited value. SQL files may yield symbols (tables,
  views) but few functions.
- Parsing speed in WASM on very large repos is an open question
  (Architecture §6). Measure it here.

## 11. Dependencies
- epic_01_OPEN_AND_INVENTORY: database, worker stage runner, Extract files
  stage, IPC seam, Files view.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Complexity, Size & Inventory, Files)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_02_FUNCTION_COMPLEXITY.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: medium-high, about 7 tickets):
1. Grammar loader in the worker, plus symbol and function extraction for
   TS/JS/TSX and Python, including cognitive complexity and the
   `raw_function.cognitive` schema change (back end).
2. Symbol and function extraction for Java, C#, Go, Rust and SQL, including
   cognitive complexity (back end).
3. Transform stage: `metric_function`, `metric_file`, and the `Schema.ddl`
   nullability change (back end).
4. IPC queries for complexity, file metrics and inventory symbol counts
   (scaffolding).
5. Complexity screen on real data, plus a persisted thresholds toggle
   (front end).
6. Inventory symbol cards, Files heat gutter and Metrics tab (front end).
7. Closeout: end-to-end check and code map regeneration.

# Epic 7: Code Quality

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_04_OWNERSHIP_AND_HISTORY, epic_05_OVERVIEW_AND_HEALTH_SCORE, epic_06_MODULE_STRUCTURE

---

## 1. Purpose
Complete the PRD's "Complexity and quality" feature with the quality
signals beyond complexity: duplication, dead code, language-specific
smells, documentation and TODO gaps, and missing tests.

**Working increment:** A user can open the Code Quality screen and review
their repo's real duplication clusters, dead code, language smells,
doc/TODO gaps (with age from blame) and source files without tests (sorted
by churn), each linking to its lines in Files, with quality risks on
Overview.

## 2. User Story
As a developer about to change an inherited codebase,
I want to see duplicated code, dead code, risky patterns and untested files,
So that I can clean up safely and know where tests are missing.

## 3. Scope
- **In Scope:**
  - Extract files adds `raw_fingerprint` (normalised token windows),
    `raw_todo`, and `raw_symbol.has_doc`.
  - Transform:
    - duplication clusters (`metric_duplication_cluster`/`_instance`);
    - dead code (unreferenced exports, unimported files, unused privates);
    - smells (`metric_smell`);
    - test mapping (`is_test`, `has_test`);
    - `metric_file.todo_count` and `undocumented_exports`.
  - Smell rules per language: TS `any`, `@ts-ignore`, `eslint-disable`,
    non-null `!`; Python bare `except:`, mutable defaults; Rust
    `.unwrap()`, `unsafe`; Go ignored errors; Java/C# generic and empty
    catch.
  - Code Quality screen on real data: stat strip and the Duplication, Dead
    Code, Type Safety, Docs & TODOs and Tests tabs.
  - Quality sub-score, quality risks, and Overview's Coverage stat as a
    test:source / untested-files measure (not line coverage).
  - The Commit History "hotspot touched without tests" auto-note.
- **Out of Scope:**
  - Line or branch coverage from coverage reports (not in the PRD; no
    schema).
  - Type coverage % that would need a type checker. Show signals, not a
    checker result.
  - Near-duplicate similarity beyond the fingerprint approach.

## 4. Functional Requirements
1. FR-042 — Extract files writes `raw_fingerprint`, `raw_todo` (TODO,
   FIXME, HACK, XXX) and `raw_symbol.has_doc` for every supported language.
2. FR-043 — Transform clusters matching fingerprints into duplication
   clusters with their instances and line counts.
3. FR-044 — Transform records dead code: unreferenced exports (with a
   "possible dynamic use" flag), unimported files and unused private
   functions within a file.
4. FR-045 — Transform records language smells in `metric_smell`, with rule
   id, severity and message.
5. FR-046 — Transform maps test files to source files (`is_test`,
   `has_test`) and fills `todo_count` and `undocumented_exports`. TODO age
   comes from blame.
6. FR-047 — The Code Quality screen shows the real stat strip and all five
   tabs, with count pills. Each finding links to Files at its lines;
   untested files are sorted by churn.
7. FR-048 — Load reporting adds a quality sub-score and quality risks
   (large duplication clusters, untested hotspots), and Overview's Coverage
   stat shows the real test measure.

## 5. Non-Functional Requirements
1. NFR-012 — Duplication detection uses windowed fingerprints indexed by
   hash and stays within the NFR-006 time budget on a 100k-line repo.
   Generated and vendored files are excluded from all quality findings.

## 6. UI/UX Notes
- Remove the Prototype banner from Code Quality.
- Dead-code findings are labelled "likely". Static analysis can't see
  reflection, dynamic imports or framework entry points.
- TODO rows aged 2 years or more get the amber highlight, as specified.

## 7. Data Model Impact
- Writes `raw_fingerprint`, `raw_todo`, `metric_duplication_cluster`,
  `metric_duplication_instance`, `metric_dead_code` and `metric_smell`.
  Fills `metric_file.todo_count`, `undocumented_exports` and `has_test`.
  `report_risk.category = 'quality'`.
- Similarity percentage and token counts for the Duplication table aren't
  in the schema. Derive them at query time, or add columns to `Schema.ddl`
  in that ticket.

## 8. Integration Impact
- Extends the parse stage, the transform stage and the load providers.
- New IPC queries for each quality tab.
- `mock/screens/quality.js` is deleted.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can open a real repo and
      review its real duplication, dead code, smells, doc/TODO gaps and
      untested files on Code Quality, jumping to each in Files, end to end,
      without any other epic being complete.
- [ ] Each smell rule and the duplication detector have fixture-based unit
      tests.
- [ ] Generated files produce no findings.
- [ ] `npx vitest run` passes.

## 10. Risks & Unknowns
- False positives in dead code (DI containers, framework conventions).
  Keep the "likely" label and the dynamic-use flag.
- Test-to-source mapping conventions differ per ecosystem. Document the
  rules.
- At the top of the ticket range. If it grows, split vertically into
  "Duplication & Dead Code" and "Smells, Docs & Tests".

## 11. Dependencies
- epic_04_OWNERSHIP_AND_HISTORY: blame for TODO age.
- epic_05_OVERVIEW_AND_HEALTH_SCORE: load stage and Overview.
- epic_06_MODULE_STRUCTURE: resolved imports for dead code. Epic 6 itself
  depends on Epic 2's parser.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Code Quality)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_07_CODE_QUALITY.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: high, about 8 tickets):
1. Parse additions: fingerprints, TODOs and doc detection (back end).
2. Duplication clustering (back end).
3. Dead code detection (back end).
4. Language smell rules (back end).
5. Test mapping, file quality columns, and quality sub-score and risks
   (back end).
6. IPC queries for the quality tabs (scaffolding).
7. Code Quality screen tabs, Overview Coverage stat and History auto-note
   (front end).
8. Closeout: end-to-end check and code map regeneration.

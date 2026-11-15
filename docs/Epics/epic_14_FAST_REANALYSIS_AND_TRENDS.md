# Epic 14: Fast Re-analysis & Trends

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_04_OWNERSHIP_AND_HISTORY, epic_05_OVERVIEW_AND_HEALTH_SCORE

---

## 1. Purpose
Make the app something you keep open while working: after a `git pull` or
branch switch, re-analysis takes seconds, because only changed blobs and new
commits are extracted (Architecture §3 and §4). Keeping a snapshot per
analysed commit turns the database into a trend source ("▼ 3 since 10 Oct").

**Working increment:** A user can pull new commits or switch branch,
re-analyse in seconds, and see on Overview how the health score and risks
moved since the previous snapshot. They can control the history range and
ignored paths in Settings.

## 2. User Story
As a tech lead using the app over several weeks,
I want re-analysis after a pull to be near-instant and to see what got
better or worse,
So that I can track the codebase's direction, not just its state.

## 3. Scope
- **In Scope:**
  - Incremental extract: blobs already in `raw_blob` are not re-parsed;
    history extraction reads only commits not in `raw_commit`; blame runs
    only for changed files. Transforms and load are recomputed for the new
    commit.
  - A snapshot per analysed commit is kept (`raw_snapshot`,
    `report_snapshot`). Unreferenced raw rows are pruned on a documented
    rule.
  - Overview trend: "▼/▲ n since <date>" on the health score and sub-scores
    versus the previous snapshot, plus new and resolved risks.
  - Complexity Δ and the Rising filter versus the previous snapshot.
  - ⌘R and the sidebar refresh run incremental re-analysis. Welcome recent
    rows show change status (for example "1 new critical").
  - Branch switch: Overview's empty state "This branch hasn't been
    analysed" with Analyse Branch, and the Settings toggle "Auto re-analyse
    on branch switch".
  - Settings → Analysis: Ignored Paths globs and the git history range
    select, applied by the pipeline (`raw_snapshot.history_since`).
  - Hotspots period select and Commit History period select, bound to the
    history window.
- **Out of Scope:**
  - Back-filling snapshots for past commits ("Over 20 · 12 Months" trend
    from history). Trends start from the first analysed snapshot; the card
    says so.
  - Watching the filesystem for uncommitted changes. Analysis is per
    commit.

## 4. Functional Requirements
1. FR-087 — Re-analysis extracts only blobs not already in `raw_blob`,
   commits not already in `raw_commit`, and blame for files whose blob
   changed, then recomputes transforms and load for the new commit.
2. FR-088 — Each analysed commit keeps its own `raw_snapshot` and
   `report_snapshot`. Raw rows no snapshot references are pruned by a
   documented retention rule.
3. FR-089 — Overview shows health-score and sub-score deltas, and new and
   resolved risks, versus the previous snapshot. Complexity shows Δ per
   function and enables the Rising filter.
4. FR-090 — ⌘R and the sidebar refresh start an incremental re-analysis.
   Welcome's recent rows show what changed at the last analysis (for
   example "1 new critical").
5. FR-091 — When HEAD is on a branch or commit with no snapshot, Overview
   shows "This branch hasn't been analysed" with Analyse Branch. With "Auto
   re-analyse on branch switch" on, analysis starts on its own when the app
   regains focus on a new HEAD.
6. FR-092 — Settings → Analysis Ignored Paths (globs) and the history range
   select are saved and applied by the pipeline. The history window is
   recorded in `raw_snapshot.history_since`, and the Hotspots and Commit
   History period selects use it.

## 5. Non-Functional Requirements
1. NFR-023 — Re-analysis after a pull that changes 50 files on a repo of
   about 100k lines completes within 10 seconds on a typical laptop.
2. NFR-024 — An incremental run produces the same `metric_*` and `report_*`
   rows as a full run from an empty database for the same commit (an
   equivalence test on a fixture repo).

## 6. UI/UX Notes
- Trends use ▲/▼ with green and red tones per direction of "better".
- Remove the last Prototype banners from the Settings Analysis card.
- After this epic, only Diagrams, Share Report and Architecture C4 keep the
  Prototype banner.

## 7. Data Model Impact
- Uses the existing per-commit keys. No new tables expected.
- If pruning needs a reference count or an `analysed_at` index, add it to
  `Schema.ddl` in that ticket.

## 8. Integration Impact
- Touches every pipeline stage (incremental guards). Chain the tickets per
  stage to avoid merge conflicts.
- Main process gains HEAD-change detection on window focus.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can pull new commits into
      an analysed repo, re-analyse in seconds and see the Overview trend
      versus the previous snapshot, end to end, without any later epic.
- [ ] NFR-023 is measured and recorded. The NFR-024 equivalence test passes.
- [ ] Ignored paths remove files from all screens after re-analysis.
- [ ] `npx vitest run` passes.

## 10. Risks & Unknowns
- Co-change and ownership are window-based. A new commit can change values
  for untouched files, so those transforms recompute fully. They are cheap
  per Architecture §3.
- Rebased or force-pushed histories leave orphaned commits. The pruning
  rule must handle them.

## 11. Dependencies
- epic_04_OWNERSHIP_AND_HISTORY: blame and history stages to make
  incremental.
- epic_05_OVERVIEW_AND_HEALTH_SCORE: snapshots and Overview to show trends.
  Stages from later epics (6–9) become incremental if they are done; if
  not, the epic that adds them must follow the incremental rules.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md (§3 incremental extraction, §4)
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Overview, Settings)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_14_FAST_REANALYSIS_AND_TRENDS.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: medium-high, about 7 tickets):
1. Incremental Extract files (skip known blobs) and ignored paths
   (back end).
2. Incremental history and blame, plus the history range (back end).
3. Snapshot retention and pruning, plus the equivalence test (back end).
4. Trend and delta queries, and the HEAD-change detection IPC
   (scaffolding).
5. Overview trends, Complexity Δ and Rising, and Welcome change status
   (front end).
6. Branch empty state, auto re-analyse, Analysis settings and period
   selects (front end).
7. Closeout: end-to-end check and code map regeneration.

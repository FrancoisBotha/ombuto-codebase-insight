# Epic 5: Overview & Health Score

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_03_HOTSPOTS, epic_04_OWNERSHIP_AND_HISTORY

---

## 1. Purpose
Give the user the PRD's "short list of priorities rather than raw totals."
This epic adds the Load reporting stage (`report_*`), a health score with
sub-scores, a computed hotspot ranking with reasons, and key risks. Overview
becomes the real landing screen.

The health-score weights are an open product question (Architecture §6),
and the decision is **deferred**. This epic ships a clearly marked
provisional formula, kept in one place, so that changing it later only
re-runs the load stage.

**Working increment:** A user can open their repo and land on a real
Overview: a summary strip, a health score with sub-score bars, the top
hotspots, a short list of key risks that each link to their detail, and a
mini hotspot treemap. The same score appears in the sidebar and on Welcome's
recent repos.

## 2. User Story
As a developer in their first days with a codebase,
I want one screen that tells me how healthy it is and what to look at first,
So that I don't have to read every metric to know where to start.

## 3. Scope
- **In Scope:**
  - Load reporting stage writing `report_snapshot`, `report_subscore`,
    `report_hotspot` (ranking moves here from Epic 3's interim query, with a
    computed `reason`) and `report_risk`.
  - Provisional score: sub-scores for the signals that exist (complexity,
    churn concentration, ownership/bus factor), equal weights,
    `weights_version = 'provisional-1'`.
  - Overview on real data: summary strip (language bar, Lines,
    Contributors, Age, Commits), health score with FAIR-style badge and
    sub-score bars, Top Hotspots, Key Risks with deep links, and the mini
    treemap.
  - Overview loading state ("n of m signals ready") from stage events.
  - Landing after indexing and on reopen moves to Overview.
  - Health score shown in the sidebar pill and Welcome recent rows.
  - Hotspots reads its ranking from `report_hotspot`.
- **Out of Scope:**
  - Final weights and sub-score set (deferred product decision).
  - Structure, quality, dependency and secret sub-scores and risks. Epics
    6–9 each add their own.
  - Coverage and Cycles stats. These show "Not analysed" until Epics 6 and
    7.
  - Trend line "▼ 3 since …" and the unanalysed-branch empty state
    (Epic 14).
  - AI Recent Activity summary (Epic 12). The card shows an empty AI state.
  - Share button and Share Report screen (not a PRD must-have; stays a
    prototype).

## 4. Functional Requirements
1. FR-029 — A Load reporting stage writes `report_snapshot`,
   `report_subscore`, `report_hotspot` and `report_risk` for the analysed
   commit. Each hotspot and risk carries a computed (never AI) reason.
2. FR-030 — The scoring formula lives in one module, records
   `weights_version`, and shows sub-scores without data as "Not analysed",
   excluded from the score. It is labelled provisional in the UI tooltip.
3. FR-031 — Overview shows the summary strip, health score with sub-score
   bars, Top Hotspots (rows open Hotspots with that file selected), Key
   Risks (rows deep-link to the relevant screen and selection) and the mini
   treemap (click → Hotspots).
4. FR-032 — After indexing and on reopen the app lands on Overview. The
   sidebar health pill and Welcome's recent-row chips show the real score
   and tone.
5. FR-033 — While stages are still running, Overview shows its loading
   state with how many signals are ready, and fills in as stages finish.

## 5. Non-Functional Requirements
1. NFR-010 — The Load reporting stage can be re-run on its own from
   existing `metric_*` rows without re-parsing or re-reading history, and
   gives identical rows for the same inputs.

## 6. UI/UX Notes
- Remove the Prototype banner from Overview. The Share button stays, with a
  banner on the Share Report screen.
- The "Computed vs AI-interpreted" legend stays. The Recent Activity card is
  an empty AI block until Epic 12.
- Risk rows use the shared severity system (CRITICAL / WARNING / INFO).

## 7. Data Model Impact
- Writes `report_snapshot`, `report_subscore`, `report_hotspot` and
  `report_risk`. `report_risk.category` values used here: complexity,
  ownership.
- No schema change expected (`weights_version` and free-form `score_key`
  already allow a provisional formula).

## 8. Integration Impact
- New stage in the worker pipeline. Later epics (6–9, 14) extend its
  sub-score and risk providers, so design it as a list of providers.
- New IPC queries for overview, snapshot and risks. The Hotspots query
  switches to `report_hotspot`.
- `mock/screens/overview.js` is deleted.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can open a real repo, land
      on a real Overview with a health score, top hotspots and key risks,
      and click through to each detail, end to end, without any other epic
      being complete.
- [ ] Re-running only the load stage gives identical `report_*` rows
      (NFR-010).
- [ ] Changing a weight constant and re-running load changes the score
      without re-extracting.
- [ ] No Overview panel shows sample data.
- [ ] `npx vitest run` passes.

## 10. Risks & Unknowns
- **Health score weights are deferred.** The provisional formula may
  mislead. Label it, and expect a follow-up ticket when the product call is
  made.
- Score jumps as Epics 6–9 add sub-scores. This is expected; record each
  change as a new `weights_version`.

## 11. Dependencies
- epic_03_HOTSPOTS: churn and the interim ranking.
- epic_04_OWNERSHIP_AND_HISTORY: bus factor and author counts (NOT NULL in
  `report_snapshot`/`report_hotspot`).

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md (§3 report layer, §6 health score weights)
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Overview)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_05_OVERVIEW_AND_HEALTH_SCORE.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: medium, about 6 tickets):
1. Load reporting stage framework with sub-score and risk providers, plus
   the provisional formula (back end).
2. Hotspot ranking and reasons into `report_hotspot`, with complexity and
   ownership risks (back end).
3. IPC queries for overview and risks; Hotspots switched to
   `report_hotspot` (scaffolding).
4. Overview screen on real data, including the loading state (front end).
5. Landing on Overview, sidebar pill and Welcome score chips (front end).
6. Closeout: end-to-end check and code map regeneration.

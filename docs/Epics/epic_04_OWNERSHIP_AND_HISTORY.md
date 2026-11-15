# Epic 4: Ownership & History

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_03_HOTSPOTS

---

## 1. Purpose
Answer "who understands this code, and who has left?" This epic adds
`git blame`, line ownership and bus factor, and the real Commit History
screen, so knowledge gaps sit next to the hotspots from Epic 3.

**Working increment:** A user can see who owns each file and its bus
factor (Hotspots Ownership metric, inspector authors), browse their repo's
real commit history (activity heatmap, git graph, commit inspector with the
files changed), and see line age in the Files blame strip.

## 2. User Story
As a tech lead taking over a codebase,
I want to know which files only one person understands and how the team has
worked over time,
So that I can plan knowledge transfer before that person is unavailable.

## 3. Scope
- **In Scope:**
  - Blame of each text file at HEAD (safe runner, porcelain output) into
    `raw_blame_range`.
  - Transform: `metric_ownership`, plus `metric_file.author_count`,
    `bus_factor`, `top_owner_id` and `top_owner_share`.
  - Hotspots: the Ownership metric is enabled; the inspector shows Authors,
    Top owner, Bus factor and Top Authors bars.
  - Commit History screen on real data: stat strip (Commits 90d, Active
    Authors, Merged PRs, Reverts, Avg Size, Off-Hours), the 26-week
    heatmap, insight cards for reverts and review concentration, and a git
    graph from `parent_shas` with the First-Parent toggle.
  - Commit inspector: hash, message, author, +/−, auto-notes (revert, large
    change, hotspot touched), and files changed with split bars and hotspot
    dots that link to Files.
  - Files: blame-age strip gutter.
- **Out of Scope:**
  - Branch and tag ref pills, the long-lived-branch card and All Branches.
    The schema stores no refs, and history is HEAD only. They show "—" or
    stay disabled; a later ticket with a schema change can add them.
  - Author and period selects (Epic 14 history range).
  - AI "What changed" (Epic 12).
  - "Hotspot touched without tests" note (needs `has_test`, Epic 7).
    Omitted until then.

## 4. Functional Requirements
1. FR-024 — An extract step runs `git blame --porcelain` (safe runner) for
   each text file at HEAD and writes contiguous ranges to
   `raw_blame_range`.
2. FR-025 — Transform computes `metric_ownership` per file and author, and
   fills `metric_file.author_count`, `bus_factor` (the fewest authors owning
   at least 50% of lines), `top_owner_id` and `top_owner_share`.
3. FR-026 — Hotspots enables the Ownership metric, and its inspector shows
   Authors, Top owner, Bus factor and Top Authors bars for the selected
   file.
4. FR-027 — The Commit History screen shows real stats, heatmap, insight
   cards and git graph, with a First-Parent toggle. Selecting a commit
   shows the inspector with auto-notes and the files changed, each linking
   to Files.
5. FR-028 — Files shows a blame-age strip for the open file, coloured from
   new to old.

## 5. Non-Functional Requirements
1. NFR-009 — Blame runs with a bounded number of concurrent git processes,
   skips binary and generated files, and reports progress. A blame failure
   on one file is recorded and doesn't fail the stage.

## 6. UI/UX Notes
- Remove the Prototype banner from Commit History.
- Author identity: show name, and merge identities only when name and email
  both match (`raw_author` UNIQUE). Don't guess aliases.
- "Merged PRs" is derived from merge commits and conventional PR subjects.
  Label it as an estimate.

## 7. Data Model Impact
- Writes `raw_blame_range`, `metric_ownership`, and the ownership columns
  of `metric_file` (nullable since Epic 2).
- No new tables expected.

## 8. Integration Impact
- Safe git runner (blame).
- New IPC queries for ownership, commit list, commit detail and the blame
  strip.
- `mock/screens/history.js` is deleted.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can open a real repo and
      see real ownership and bus factor on Hotspots, browse real commit
      history with a commit's changed files, and see blame age in Files,
      end to end, without any other epic being complete.
- [ ] Bus factor is unit-tested on fixed blame data, including the 50%
      boundary.
- [ ] A repo with merges draws the git graph and the First-Parent toggle
      works.
- [ ] `npx vitest run` passes.

## 10. Risks & Unknowns
- Blame is the slowest git operation. On large repos it may dominate
  indexing; consider deferring blame until after the first usable results.
- Git graph lane layout for very wide histories: cap the visible lanes and
  paginate the commit list.

## 11. Dependencies
- epic_03_HOTSPOTS: commits and authors in `raw_*`, and the Hotspots
  screen and inspector this epic extends.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Hotspots, Commit History, Files)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_04_OWNERSHIP_AND_HISTORY.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: medium, about 6 tickets):
1. Blame extraction with bounded concurrency (back end).
2. Ownership and bus factor transform (back end).
3. IPC queries for ownership, commits, commit detail and blame strip
   (scaffolding).
4. Hotspots ownership metric and inspector authors, plus the Files blame
   strip (front end).
5. Commit History screen and inspector on real data (front end).
6. Closeout: end-to-end check and code map regeneration.

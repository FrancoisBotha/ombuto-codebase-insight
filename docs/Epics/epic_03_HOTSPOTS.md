# Epic 3: Hotspots

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_02_FUNCTION_COMPLEXITY

---

## 1. Purpose
Deliver the product's core idea: combine the code's structure with its git
history to say where to look first. This epic adds the Extract history
stage (`git log --numstat`), churn metrics, and the real Hotspots treemap,
where files that change often and are complex stand out.

**Working increment:** A user can open their repo, go to Hotspots and see a
churn × complexity treemap of their real files. They can switch metric
(Churn × Complexity, Churn, Complexity, Code Age, Bug Fixes), inspect a
file's change timeline and open it in Files, whose History tab lists the
commits that touched it.

## 2. User Story
As a developer new to a codebase,
I want to see which complex files also change the most,
So that I know where bugs and change cost actually concentrate.

## 3. Scope
- **In Scope:**
  - Extract history stage: `git log --numstat` over HEAD's history, with
    rename detection, into `raw_author`, `raw_commit` and `raw_commit_file`.
  - Transform: `metric_file` churn columns, and first/last commit time,
    following renames.
  - Hotspots ranking by churn × complexity, computed in a main-process
    read-only query over `metric_file`. This is an interim step: Epic 5
    moves ranking into `report_hotspot`.
  - Hotspots screen on real data: treemap (area = LOC, colour = metric),
    metrics Churn × Complexity, Churn, Complexity, Code Age and Bug Fixes,
    folder frames, selection and legend.
  - Inspector: Churn, Complexity, Lines, Code age, Fix commits and Fix ratio
    (fix detection from commit subjects), the 26-week change timeline, and
    Open File.
  - Files History tab: monthly bars and the commit list.
  - Shallow clones and unreadable history are detected and explained, with
    "Continue Without History".
- **Out of Scope:**
  - Ownership, authors, bus factor and blame (Epic 4). Those inspector cells
    show "Not analysed yet", and the Ownership metric is disabled.
  - "Changes Together With" (Epic 6).
  - Explain This Hotspot (Epic 12).
  - The period select and history range setting (Epic 14). Analysis uses
    full history.
  - "Fetch Full History", which would write to the repo. It stays inert;
    the app never modifies the repo.

## 4. Functional Requirements
1. FR-018 — An Extract history stage runs `git log --numstat` (safe runner,
   rename detection) over HEAD's history and writes `raw_author`,
   `raw_commit` and `raw_commit_file`.
2. FR-019 — Transform fills `metric_file.churn_commits`, `churn_lines`,
   `first_commit_at` and `last_commit_at` for each file at HEAD, following
   renames.
3. FR-020 — The Hotspots screen shows a real treemap and ranked files for
   the metrics Churn × Complexity, Churn, Complexity, Code Age and Bug
   Fixes. Clicking a tile selects it.
4. FR-021 — The Hotspots inspector shows Churn, Complexity, Lines, Code age,
   Fix commits, Fix ratio and a 26-week change timeline for the selected
   file, and Open File goes to Files.
5. FR-022 — The Files History tab shows monthly change bars and the list of
   commits that touched the file (subject, author, date, +/−).
6. FR-023 — When history is shallow or can't be read, Indexing and the
   affected screens say why. The user can continue with complexity-only
   results; history-based panels show "History unavailable".

## 5. Non-Functional Requirements
1. NFR-008 — History extraction streams git output rather than buffering
   it, and handles 10k commits within 60 seconds on a typical laptop, with
   progress shown on Indexing.

## 6. UI/UX Notes
- Remove the Prototype banner from Hotspots. Overview stays a prototype
  until Epic 5.
- The Overview mini treemap is still sample data. Don't wire it here.
- Fix-commit detection uses a documented keyword list (fix, bug, hotfix,
  revert, …). Show "heuristic" in the cell tooltip.

## 7. Data Model Impact
- Writes `raw_author`, `raw_commit`, `raw_commit_file`, and the
  history columns of `metric_file`.
- `raw_snapshot.history_since` stays NULL (full history).
- No new tables expected. Fix counts are derived at query time from
  `raw_commit` subjects. If a stored column is preferred, add it to
  `Schema.ddl` in that ticket.

## 8. Integration Impact
- Safe git runner from Epic 1 (log, numstat, rename detection).
- New IPC queries for hotspots, the file timeline and file history.
- `mock/screens/hotspots.js` is deleted once all its exports are replaced.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can open a real repo and
      explore a real churn × complexity Hotspots treemap, then open a
      hotspot's file and see its commit history, end to end, without any
      other epic being complete.
- [ ] Renamed files keep their history (test with a fixture repo).
- [ ] A shallow clone shows the "history unavailable" path and doesn't fail
      the run.
- [ ] No panel on Hotspots shows sample data.
- [ ] `npx vitest run` passes.

## 10. Risks & Unknowns
- Rename-following on very long histories is slow. Limit similarity
  detection if it is.
- The hotspot score formula is interim until Epic 5. Keep it in one function
  so Epic 5 can move it.
- Monorepos with 100k+ commits (Architecture §6 open question). Record the
  measured time.

## 11. Dependencies
- epic_02_FUNCTION_COMPLEXITY: complexity in `metric_file` is half of the
  hotspot score.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Hotspots, Files)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_03_HOTSPOTS.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: medium, about 6 tickets):
1. Extract history stage: streaming log/numstat parser, authors, commits
   and files (back end).
2. Churn transform with rename following, plus shallow-history detection
   (back end).
3. IPC queries for hotspots, file timeline and file history (scaffolding).
4. Hotspots treemap and inspector on real data (front end).
5. Files History tab, plus "history unavailable" states (front end).
6. Closeout: end-to-end check and code map regeneration.

# Epic 8: Dependency Health

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_05_OVERVIEW_AND_HEALTH_SCORE

---

## 1. Purpose
Show the state of the repo's third-party packages: what is outdated,
vulnerable, deprecated or oddly licensed. This is the first epic that talks
to the network. It sends only package names and versions, and lookups can
be turned off.

**Working increment:** A user can open the Dependencies screen and see their
repo's real packages from its lockfiles, flagged as outdated, vulnerable
(OSV.dev), deprecated or oddly licensed, with filters, search and sorting.
Dependency risks appear on Overview, and lookups can be turned off, in
which case packages show "Not checked".

## 2. User Story
As a tech lead inheriting a codebase,
I want to know which dependencies are vulnerable, abandoned or badly
licensed,
So that I can plan upgrades and spot legal and security exposure early.

## 3. Scope
- **In Scope:**
  - Lockfile detection and parsers for package-lock, yarn, pnpm, poetry,
    requirements, go.sum, cargo, nuget-lock, gradle and maven →
    `raw_lockfile`, `raw_lockfile_entry` (direct/dev).
  - OSV.dev batch queries → `raw_advisory`.
  - Registry lookups (npm, PyPI, Maven Central, NuGet, Go proxy, crates.io)
    for latest version, licence and deprecation → `raw_package`,
    `raw_package_version`, with a freshness window.
  - Transform → `metric_dependency` and `metric_dependency_advisory`
    (outdated, major behind, licence flag, advisory count, max severity).
  - Dependencies screen on real data: header counts, search, filter pills,
    sortable table and "Used In" (from `raw_import` specifiers).
  - Settings → Analysis: an "Online dependency lookups" toggle, on by
    default.
  - Dependency sub-score and risks on Overview.
  - Indexing stage "Scanning dependencies & secrets" (the dependencies
    half).
- **Out of Scope:**
  - Package Size column (no schema). Shows "—".
  - Bundling the OSV database (rejected in Architecture §4).
  - Secret scanning (Epic 9).
  - Running package managers. Lockfiles are parsed, never executed.

## 4. Functional Requirements
1. FR-049 — The pipeline finds supported lockfiles at HEAD and parses them
   into `raw_lockfile` and `raw_lockfile_entry`, marking direct and dev
   dependencies.
2. FR-050 — When lookups are on, the pipeline queries OSV.dev in batches
   for each package and version and stores advisories in `raw_advisory`.
3. FR-051 — When lookups are on, the pipeline queries each ecosystem's
   registry for latest version, licence and deprecation and caches them in
   `raw_package` and `raw_package_version`.
4. FR-052 — Transform writes `metric_dependency` and
   `metric_dependency_advisory`: outdated, major versions behind, licence
   flag (ok / copyleft / unknown / none), advisory count and max severity.
   With lookups off or offline, the status is `not_checked`.
5. FR-053 — The Dependencies screen shows the real table with search,
   filter pills (All, Vulnerable, Major Behind, License Issues, Deprecated),
   column sorting, the empty state and "Used In" links.
6. FR-054 — Settings → Analysis has an "Online dependency lookups" toggle.
   When off, nothing is sent and packages show "Not checked".
7. FR-055 — Load reporting adds a dependency sub-score and risks
   (critical/high advisories, deprecated direct dependencies, licence
   flags).

## 5. Non-Functional Requirements
1. NFR-013 — Outbound lookups send only ecosystem, package name and
   version. No paths, file contents or repo identifiers. A unit test checks
   the request payloads.
2. NFR-014 — Network failures and timeouts never fail the run. Affected
   packages become `not_checked` and Indexing logs why. Requests are rate
   limited and use a generic client User-Agent.

## 6. UI/UX Notes
- Remove the Prototype banner from Dependencies, and from the Settings
  Analysis section once all its toggles are real (secret scan arrives in
  Epic 9; until then that row keeps an inline "Prototype" tag).
- The privacy note shows when lookups are on: "Package names and versions
  are checked online".

## 7. Data Model Impact
- Writes `raw_lockfile`, `raw_lockfile_entry`, `raw_package`,
  `raw_package_version`, `raw_advisory`, `metric_dependency` and
  `metric_dependency_advisory`. `report_risk.category = 'dependency'`.
- The setting lives in `electron-store`, not the database.
- No schema change expected.

## 8. Integration Impact
- External: OSV.dev API and six package registries (HTTPS from the worker).
- New stage `deps_secrets` in the worker (shared with Epic 9).
- New IPC queries for dependencies. `mock/screens/deps.js` is deleted.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can open a real repo and
      see its real packages flagged as outdated, vulnerable, deprecated or
      oddly licensed on Dependencies, end to end, without any other epic
      being complete.
- [ ] With lookups off, no network request is made (test with a stubbed
      fetch) and the UI shows "Not checked".
- [ ] Each lockfile parser has a fixture test.
- [ ] `npx vitest run` passes. Network calls are mocked in tests.

## 10. Risks & Unknowns
- Ten lockfile formats is a lot. Prioritise npm/yarn/pnpm, pypi and cargo,
  and document any format left for a follow-up.
- Registry API rate limits on large monorepos. Cache by `fetched_at`.
- Licence "odd" rules (non-OSI, licence changed between versions) need a
  documented list.

## 11. Dependencies
- epic_05_OVERVIEW_AND_HEALTH_SCORE: the load stage and Overview risks.
  "Used In" reads `raw_import` when Epic 6 is done; before that it shows
  "—".

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md (§4 online lookups, §5 what leaves the machine)
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Dependencies, Settings)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_08_DEPENDENCY_HEALTH.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: medium-high, about 7 tickets):
1. Lockfile parsers for npm/yarn/pnpm, pypi (poetry, requirements) and
   cargo (back end).
2. Lockfile parsers for go.sum, nuget, gradle and maven (back end).
3. OSV and registry lookup clients with caching, rate limits and the
   offline path (back end).
4. Dependency transform, plus sub-score and risks (back end).
5. IPC queries and settings toggle wiring (scaffolding).
6. Dependencies screen on real data (front end).
7. Closeout: end-to-end check and code map regeneration.

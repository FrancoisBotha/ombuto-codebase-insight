# Epic 6: Module Structure & Hidden Coupling

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_02_FUNCTION_COMPLEXITY, epic_03_HOTSPOTS, epic_05_OVERVIEW_AND_HEALTH_SCORE

---

## 1. Purpose
Show how the modules actually depend on each other, and where files are
coupled without the code saying so. This epic extracts imports, resolves
them to repo files, builds the module graph with cycles, fan-in, fan-out
and instability, and adds co-change analysis, which needs those resolved
imports to flag "changes together but doesn't import".

**Working increment:** A user can explore their repo's real module
dependency graph on Architecture (cycles highlighted, fan-in/fan-out and
instability per module), see a file's imports and importers in Files, and
see which files change together without importing each other in the
Hotspots inspector. Cycles appear as Overview risks.

## 2. User Story
As a tech lead reviewing a codebase,
I want to see the real dependency structure, its cycles, and hidden change
coupling,
So that I know which boundaries are real and which changes will ripple.

## 3. Scope
- **In Scope:**
  - Extract files adds `raw_import` for every supported language.
  - Import resolution to repo files → `metric_import_edge`: relative paths,
    package roots, `tsconfig` paths/baseUrl, Python packages, Java/C#
    namespaces by folder, Go module path, Rust `mod`/`use`. Externals are
    ignored.
  - Module transform: `metric_module` (folder-level modules, fan-in,
    fan-out, instability, bus factor), `metric_module_edge`, and
    `metric_cycle` (strongly connected components).
  - Architecture → Module Graph on real data with `elkjs` layout, folder
    clusters, cycle highlighting, filter chips, zoom, and the inspector
    (stats, Imports / Imported By).
  - Files Dependencies tab, and the CYCLE badge in the file header.
  - Co-change transform → `metric_cochange` with support, confidence and
    `has_import_edge`.
  - Hotspots inspector "Changes Together With", with the NO IMPORT tag.
  - Structure sub-score, cycle risks, and the Overview Cycles stat.
- **Out of Scope:**
  - The C4 · Containers view. It is not in the PRD; keep it with a
    Prototype banner.
  - The Classes table (DIT, NOC, LCOM). The schema has no class metrics,
    so it shows "Not measured".
  - The Layer stat, unless derivable from folder conventions. Otherwise
    "—".
  - AI module summary (Epic 12).

## 4. Functional Requirements
1. FR-034 — Extract files writes `raw_import` (specifier, kind, imported
   names, line) for every supported language.
2. FR-035 — Transform resolves imports to files at HEAD and writes
   `metric_import_edge`. Unresolvable specifiers are treated as external
   and not stored.
3. FR-036 — Transform computes `metric_module`, `metric_module_edge` and
   `metric_cycle`, with instability = fan-out / (fan-in + fan-out), NULL
   when both are 0.
4. FR-037 — Architecture's Module Graph shows real modules laid out with
   `elkjs` in folder clusters. Cycle edges are highlighted; filters, zoom
   and fit work; selecting a module shows its stats and its import and
   importer chips.
5. FR-038 — The Files Dependencies tab lists the file's imports and
   importers with CYCLE badges, each linking to that file. The header shows
   CYCLE when the file's module is in a cycle.
6. FR-039 — Transform computes `metric_cochange` pairs over the history
   window, with support, confidence and `has_import_edge` (0 means hidden
   coupling).
7. FR-040 — The Hotspots inspector lists "Changes Together With" for the
   selected file, with a coupling score and a NO IMPORT tag on pairs that
   don't import each other.
8. FR-041 — Load reporting adds a structure sub-score and cycle and
   hidden-coupling risks, and Overview's Cycles stat shows the real count.

## 5. Non-Functional Requirements
1. NFR-011 — Graph layout runs off the UI thread (a web worker in the
   renderer). A graph of 300 modules lays out and renders within 2 seconds.
   Co-change pair generation is bounded: very large commits above a
   documented file count are skipped.

## 6. UI/UX Notes
- Remove the Prototype banner from Architecture's Module Graph view only.
  C4 keeps it.
- Node positions come from `elkjs` (prototype-port deviation 6 says elkjs
  comes in with real data).
- Unresolved-import share is shown in the graph footer, so users know how
  complete the graph is.

## 7. Data Model Impact
- Writes `raw_import`, `metric_import_edge`, `metric_module`,
  `metric_module_edge`, `metric_cycle` and `metric_cochange`.
  `report_risk.category = 'structure'`.
- No schema change expected.

## 8. Integration Impact
- `elkjs` (already an architecture choice) in the renderer.
- Extends the parse code from Epic 2, the transform stage and the load
  stage's provider list.
- New IPC queries for module graph, module detail, file dependencies and
  co-change.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can open a real repo and
      explore its real module graph with cycles, see a file's imports and
      importers, and see hidden change coupling on Hotspots, end to end,
      without any other epic being complete.
- [ ] Resolution is unit-tested per language on fixtures, including a
      deliberate cycle.
- [ ] Overview shows real Cycles and any cycle risks.
- [ ] `npx vitest run` passes.

## 10. Risks & Unknowns
- Import resolution varies a lot by ecosystem (path aliases, Java source
  roots, C# namespaces that don't match folders). Aim for good coverage of
  TS/JS and Python first, and show the unresolved share.
- "Module = folder" may be too coarse or too fine. Pick a documented
  default depth.
- This epic is at the top of the ticket range. If it grows, split
  co-change out as its own epic (vertically).

## 11. Dependencies
- epic_02_FUNCTION_COMPLEXITY: the parse stage this extends.
- epic_03_HOTSPOTS: commit file lists for co-change, and the Hotspots
  inspector.
- epic_05_OVERVIEW_AND_HEALTH_SCORE: the load stage that structure risks
  plug into.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md
- prototype port: docs/Architecture/prototype-port.md (deviation 6)
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Architecture, Hotspots, Files)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_06_MODULE_STRUCTURE.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: high, about 8 tickets):
1. Import extraction and resolution for TS/JS/TSX and Python (back end).
2. Import extraction and resolution for Java, C#, Go and Rust (back end).
3. Module graph, cycles and fan metrics transform (back end).
4. Co-change transform, plus structure sub-score and risks in load
   (back end).
5. IPC queries for graph, module, file dependencies and co-change
   (scaffolding).
6. Architecture Module Graph with elkjs and inspector (front end).
7. Files Dependencies tab, CYCLE badges, Hotspots "Changes Together With"
   and Overview Cycles stat (front end).
8. Closeout: end-to-end check and code map regeneration.

# Epic 12: AI Explanations & Summaries

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_04_OWNERSHIP_AND_HISTORY, epic_06_MODULE_STRUCTURE, epic_11_REMOTE_AI_WITH_GUARD

---

## 1. Purpose
Complete the PRD's "explanations of hotspots and commits on request" and
add the optional AI enrichment stage (module summaries). All of it goes
through the AI service and guard from Epics 10–11, is stored in `ai_*`, and
is always shown apart from computed facts.

**Working increment:** A user can click "Explain This Hotspot" (⌘E) or ask
for "What changed" on a commit and get a labelled AI explanation. They can
also turn on module summaries, which are written during indexing and shown
on Architecture and in Files, and see an AI recent-activity summary on
Overview.

## 2. User Story
As a developer looking at a hotspot or an unfamiliar commit,
I want a plain-language explanation on request,
So that I understand the "why" faster, while still seeing which parts are
computed fact.

## 3. Scope
- **In Scope:**
  - Explain This Hotspot (inspector button and ⌘E): the prompt uses the
    file's computed metrics, `report_hotspot.reason` and snippets. The
    answer, with a 💡 suggestion line, is stored in `ai_explanation`.
  - Commit "What changed" in the Commit History inspector, from the commit
    subject, body and diff stats, plus snippets from the analysed version.
  - Overview "Recent Activity · Last 14 Days" AI summary.
  - Stage 6 **AI enrichment** (optional): module summaries →
    `ai_module_summary`. A Settings → Analysis toggle "Module summaries
    (LLM)" is off by default. It is shown on Indexing as the optional
    stage.
  - Module summaries in the Architecture inspector and the Files Summary
    tab, with Regenerate.
  - Cached per commit and target. Regenerate replaces.
- **Out of Scope:**
  - AI refactoring candidates on Complexity (not a PRD must-have).
  - AI-assisted Diagrams (the Diagrams screen stays a prototype).
  - Any use of AI output in scores, ranks or risks (forbidden by design).

## 4. Functional Requirements
1. FR-076 — "Explain This Hotspot" and ⌘E request an explanation of the
   selected hotspot through the guarded AI service and show it in the AI
   block with a suggestion line. It is stored in `ai_explanation`
   (`target_kind = hotspot`).
2. FR-077 — The Commit History inspector offers "What changed" for the
   selected commit and stores the result with `target_kind = commit`.
3. FR-078 — Overview's Recent Activity card can generate an AI summary of
   the last 14 days of commits, with file chips that link to Files.
4. FR-079 — When "Module summaries (LLM)" is on, the pipeline's AI
   enrichment stage writes one `ai_module_summary` per module through the
   guarded service. When it is off, the stage is `skipped`, and a failure
   never fails the run.
5. FR-080 — The Architecture inspector and the Files Summary tab show the
   module summary, with Regenerate.
6. FR-081 — Explanations and summaries are reused for the same commit and
   target until the user regenerates them, and each shows its provider,
   model and date.

## 5. Non-Functional Requirements
1. NFR-021 — Every AI output uses the AI block pattern and shows provider,
   model and commit. Computed values such as `report_hotspot.reason` are
   never replaced or edited by AI text. A test asserts that the load stage
   reads no `ai_*` table.

## 6. UI/UX Notes
- Remove remaining "Not analysed yet" placeholders for AI panels. Empty AI
  blocks show a "Generate" action instead.
- Explanation loading states follow the prototype: idle → loading → result.

## 7. Data Model Impact
- Writes `ai_explanation` and `ai_module_summary`.
- **Expected schema change:** `ai_explanation.target_kind` documents
  `hotspot | commit | risk`. The recent-activity summary needs a new value
  (`activity`, with `target_ref` = the window, for example `14d`). Update
  the column comment in `Schema.ddl` in that ticket.

## 8. Integration Impact
- AI service gains request kinds `explain` and `summary` (already in the
  `guard_log.request_kind` values).
- The worker's AI enrichment stage calls the main-process AI service via
  worker messages. The worker must not hold API keys.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can get a labelled AI
      explanation of a real hotspot and a real commit, and see module
      summaries after turning the setting on, end to end, with no later
      epic needed.
- [ ] With a remote provider, explanation requests appear in "What was
      sent".
- [ ] With module summaries off, no AI request is made during indexing.
- [ ] `npx vitest run` passes. Providers are stubbed.

## 10. Risks & Unknowns
- Summarising many modules with a remote provider costs money and time.
  Show a count and estimate before the first enabled run.
- The worker-to-main AI request path is new. Keep keys and the guard in
  main only.

## 11. Dependencies
- epic_04_OWNERSHIP_AND_HISTORY: commits for "What changed" and recent
  activity.
- epic_06_MODULE_STRUCTURE: modules to summarise.
- epic_11_REMOTE_AI_WITH_GUARD: guarded AI service. It also brings in
  Epic 10.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md (§3 stage 6 AI enrichment, ai_* quarantine)
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Hotspots, Commit History, Overview, Architecture, Files)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_12_AI_EXPLANATIONS.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: medium, about 6 tickets):
1. Explanation requests (hotspot, commit, activity) in the AI service,
   storage, and the schema comment update (back end).
2. AI enrichment stage with the worker→main request path and module
   summaries (back end).
3. IPC for explanations and summaries (scaffolding).
4. Explain This Hotspot (⌘E), commit "What changed" and Overview Recent
   Activity (front end).
5. Module summaries in Architecture and Files, the settings toggle and the
   Indexing optional stage (front end).
6. Closeout: end-to-end check and code map regeneration.

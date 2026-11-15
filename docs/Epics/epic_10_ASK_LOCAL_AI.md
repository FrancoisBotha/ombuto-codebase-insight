# Epic 10: Ask the Codebase (Local AI)

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_02_FUNCTION_COMPLEXITY

---

## 1. Purpose
Let the user ask questions about their code and get answers that cite real
lines, using a local Ollama model so nothing leaves the machine. This epic
builds the main-process AI service (retrieval from the database, prompt
assembly, citation validation and storage in `ai_*`) that the remote
providers (Epic 11), explanations (Epic 12) and CLIs (Epic 13) reuse.

**Working increment:** A user with Ollama installed can pick an endpoint and
model in Settings, ask a question on Ask the Codebase, and get an answer
clearly labelled AI, with citation chips that open the exact cited lines in
the preview pane. Nothing is sent off the machine.

## 2. User Story
As a developer learning a codebase,
I want to ask "where is X handled?" and get an answer that points at the
exact lines,
So that I can check the answer myself instead of trusting it blindly.

## 3. Scope
- **In Scope:**
  - Settings → LLM Provider → Local · Ollama: endpoint, model list from the
    Ollama API, Test. Persisted in `electron-store`.
  - Retrieval in main from the database only: FTS5 over
    `raw_content_fts` plus the `raw_symbol` name index, ranked and trimmed
    to a snippet budget. The repo is never read directly.
  - Prompt with numbered snippets (path, blob, line range) and an
    instruction to cite by snippet and line.
  - Citation parsing and validation against `raw_blob_content` line counts.
    Invalid citations are stored with `is_valid = 0` and shown as such.
  - Storage in `ai_answer` and `ai_citation`, tagged with provider, model
    and commit.
  - Ask screen on real data: model pill, starter questions, thinking steps,
    answers with citation chips, preview with highlighted lines, the
    "Grounded in N files · M lines read" footer, follow-ups, and the error
    state when Ollama isn't responding.
  - "Ask About File" (Files) and Ask (Hotspots inspector) pre-fill a
    question scoped to that file. ⌘J opens Ask.
  - Privacy badge shows "Local · Ollama".
- **Out of Scope:**
  - OpenRouter, Direct API and the outbound guard (Epic 11).
  - Local CLI providers (Epic 13).
  - Embedding-based retrieval (rejected in Architecture §4).
  - Hotspot and commit explanations, and module summaries (Epic 12).

## 4. Functional Requirements
1. FR-061 — Settings lets the user set the Ollama endpoint and model (listed
   from the server) and test the connection. The settings persist.
2. FR-062 — The AI service retrieves candidate snippets for a question from
   `raw_content_fts` and `raw_symbol` for the current commit, ranks them,
   and trims them to a configurable snippet budget.
3. FR-063 — The AI service sends the question and snippets to Ollama,
   parses the citations in the answer and validates each one against real
   lines in `raw_*`, marking invalid ones.
4. FR-064 — Each answer and its citations are stored in `ai_answer` and
   `ai_citation` with provider, model and commit. Previous answers for the
   repo reload when Ask is reopened.
5. FR-065 — The Ask screen shows real conversations: starters, thinking
   steps, answers with citation chips that load the cited lines with
   highlight in the preview, the grounding footer, and the "Ollama isn't
   responding" error with Retry and LLM Settings.
6. FR-066 — "Ask About File" in Files, Ask in the Hotspots inspector, and ⌘J
   open Ask with a question pre-filled for that file.
7. FR-067 — The title-bar privacy badge shows "Local · Ollama" when Ollama
   is the active provider.

## 5. Non-Functional Requirements
1. NFR-016 — AI output is rendered as sanitised Markdown with no raw HTML,
   is display-only and is never executed. Repo content can contain prompt
   injection, so links and code in answers are inert text.
2. NFR-017 — In this epic only a loopback Ollama endpoint (`localhost`,
   `127.0.0.1`, `::1`) is accepted. A non-loopback endpoint would send code
   off the machine without the guard. It is rejected with an explanation
   until Epic 11 routes it through the guard.
3. NFR-018 — No code in `raw_*`, `metric_*` or `report_*` paths reads
   `ai_*`. The schema test and a module-boundary test enforce it.

## 6. UI/UX Notes
- Remove the Prototype banner from Ask and from Settings' Ollama pane. The
  other provider tabs keep it.
- Every answer uses the AI block pattern (dashed indigo border, `mdi-creation`
  eyebrow, "verify before acting" footnote).
- Invalid citations render as struck-through chips with a "lines not found"
  tooltip.

## 7. Data Model Impact
- Writes `ai_answer` and `ai_citation`. `guard_log_id` is NULL (local
  provider).
- No schema change expected.

## 8. Integration Impact
- Ollama HTTP API (`/api/tags`, `/api/chat`) over loopback.
- New main-process AI service module. Ask queries go over IPC; the AI call
  runs in main, not the renderer.
- `mock/screens/ask.js` is deleted.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user with Ollama can configure
      it, ask a question about their real repo and open the cited lines
      from the answer, end to end, without any other epic beyond 1–2 being
      complete.
- [ ] A fabricated citation is stored with `is_valid = 0` and shown as
      invalid (test with a stubbed model).
- [ ] A non-loopback endpoint is refused (NFR-017).
- [ ] Markdown with HTML and script in an answer renders as inert text.
- [ ] `npx vitest run` passes. Ollama is stubbed in tests.

## 10. Risks & Unknowns
- Small local models follow citation formats poorly. Use a strict format
  and a lenient parser, and show invalid citations rather than hide them.
- Snippet budget versus model context. Make it configurable and show "M
  lines read".

## 11. Dependencies
- epic_02_FUNCTION_COMPLEXITY: `raw_symbol` for the symbol index. FTS comes
  from Epic 1. Ask works without history; Hotspots' Ask button needs Epic 3
  but degrades gracefully.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md (§3 AI service, §4 lexical retrieval, §5 renderer hardening)
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Ask the Codebase, Settings)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_10_ASK_LOCAL_AI.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: medium-high, about 7 tickets):
1. Retrieval: FTS5 and symbol ranking with a snippet budget (back end).
2. AI service core with a provider interface, Ollama provider and loopback
   check (back end).
3. Citation parsing, validation and `ai_*` storage (back end).
4. Ollama settings pane and privacy badge (front end).
5. IPC for ask and answer history (scaffolding).
6. Ask screen on real data, plus entry points from Files and Hotspots
   (front end).
7. Closeout: end-to-end check and code map regeneration.

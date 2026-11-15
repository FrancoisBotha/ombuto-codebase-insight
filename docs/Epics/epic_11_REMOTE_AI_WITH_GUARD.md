# Epic 11: Remote AI with Outbound Guard

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_09_SECRETS_SCAN, epic_10_ASK_LOCAL_AI

---

## 1. Purpose
Let users who want stronger models use OpenRouter or a direct API, without
company secrets or personal data leaving the machine unnoticed. Remote
providers and the deterministic outbound guard are one slice: a remote
provider without the guard must not ship, and a guard without a remote
provider has nothing to guard.

**Working increment:** A user can choose OpenRouter or a direct API
(Anthropic or OpenAI), store the key in the OS keychain and ask questions.
Every request is first checked for secrets, PII and deny-listed terms,
which are redacted, warned about or blocked per setting. Afterwards the user
can review exactly what was sent in a "What was sent" view, and the privacy
badge always shows which mode is active.

## 2. User Story
As a developer whose company forbids uploading code wholesale,
I want to use a strong remote model while the app strips secrets and
sensitive terms and shows me what it sent,
So that I get better answers without breaking policy.

## 3. Scope
- **In Scope:**
  - Settings → OpenRouter: key, model picker dialog, routing and allowed
    providers.
  - Settings → Direct API: provider (Anthropic or OpenAI), key, model, and
    "Show exactly what will be sent and ask before each request".
  - API keys stored with Electron `safeStorage`.
  - Deterministic guard tier in the main-process AI service:
    - secret rules (shared module from Epic 9);
    - PII patterns: emails, phones, IPs, and national ID and card formats
      with checksum validation;
    - a user-defined deny-list of terms and paths.
  - Per-check action: off / warn / redact / block. Defaults: redact
    secrets, warn PII, block deny-list. Warn shows the flagged spans and
    asks before sending.
  - `guard_log` for every remote request: provider, model, kind, payload
    hash and bytes, findings and action. Full sent text only if the user
    turns that on.
  - A "What was sent" view: a Settings section listing `guard_log` with
    detail.
  - Privacy badge for each mode. Settings "Sent per request" / "Never sent"
    panels made real.
  - A non-loopback Ollama endpoint is allowed and treated as remote, so it
    goes through the guard (lifts NFR-017).
- **Out of Scope:**
  - Local CLI providers and the bypass setting (Epic 13).
  - The local-LLM guard tier (Epic 13).
  - Explanations and summaries (Epic 12). They will use the same guarded
    path automatically.

## 4. Functional Requirements
1. FR-068 — Settings → OpenRouter lets the user enter a key, choose a model
   in the model dialog and restrict allowed providers. Ask then uses
   OpenRouter.
2. FR-069 — Settings → Direct API lets the user choose Anthropic or OpenAI,
   enter a key and model, and turn on "ask before each request", which
   shows the exact payload for approval.
3. FR-070 — API keys are stored and read only through Electron
   `safeStorage`, and can be replaced or removed in Settings.
4. FR-071 — Before any remote request, the guard checks the payload with the
   secret rules, PII patterns (with checksum validation for ID and card
   numbers) and the user's deny-list of terms and paths.
5. FR-072 — Each check has an action (off / warn / redact / block) with
   defaults redact / warn / block. Warn shows the flagged spans and needs
   the user's confirmation. Block refuses with the reason. Redact replaces
   spans before sending.
6. FR-073 — Every remote request writes a `guard_log` row with provider,
   model, kind, payload hash and bytes, findings and action. The full sent
   text is stored only when "Keep full sent text" is on.
7. FR-074 — A "What was sent" view lists `guard_log` entries with
   findings, actions and (when kept) the exact text, and links each answer
   to its log entry.
8. FR-075 — The privacy badge shows the active mode (Local · Ollama,
   OpenRouter, Direct API) at all times, and Settings' "Sent per request" /
   "Never sent" panels describe the real behaviour.

## 5. Non-Functional Requirements
1. NFR-019 — There is exactly one code path to any remote provider, and it
   always runs the guard. A test asserts that no provider client can be
   called except through the guarded send.
2. NFR-020 — API keys never appear in `electron-store`, the database, logs,
   IPC responses or the renderer. The renderer only learns "key set / not
   set".

## 6. UI/UX Notes
- Remove the Prototype banner from the OpenRouter and Direct API panes.
  The Local CLI pane keeps it until Epic 13.
- The warn dialog lists flagged spans in context, with Send redacted / Send
  anyway / Cancel. Use the warning tone.
- The "What was sent" view is new UI. Use the card and table patterns.

## 7. Data Model Impact
- Writes `guard_log`. `ai_answer.guard_log_id` is set for remote answers.
- The deny-list and guard actions live in `electron-store`. Keys live in
  `safeStorage`.
- No schema change expected.

## 8. Integration Impact
- External: OpenRouter API, Anthropic API, OpenAI API (plain HTTP, per
  Architecture §2).
- The AI service gains a guard module and provider clients. The Epic 9
  secret-rules module is reused unchanged.
- Settings mock (`mock/screens/settings.js`) entries for these providers are
  removed.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can configure OpenRouter
      or a direct API, ask a question about their real repo, have a planted
      fake secret redacted before sending, and see the request in "What was
      sent", end to end. This needs Epics 9 and 10, and no later epic.
- [ ] Guard rules have fixture tests: valid and invalid card checksums, a
      deny-listed path, and a secret.
- [ ] NFR-019 and NFR-020 tests pass.
- [ ] `npx vitest run` passes. Providers are stubbed in tests.

## 10. Risks & Unknowns
- PII patterns are noisy in code (emails in tests, IPs in configs). The
  "warn" default may annoy users; tune it.
- Provider API changes. Keep the clients thin, and pin model ids in
  settings rather than code.

## 11. Dependencies
- epic_09_SECRETS_SCAN: the shared secret-rules module.
- epic_10_ASK_LOCAL_AI: the AI service, retrieval, citation validation and
  Ask screen.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md (§4 outbound guard, §5 outbound guardrails and secrets)
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Settings)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_11_REMOTE_AI_WITH_GUARD.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: high, about 8 tickets):
1. Deterministic guard: secret, PII and deny-list detection plus the
   redaction engine (back end).
2. Guarded send path and `guard_log` writing, with the single-path test
   (back end).
3. `safeStorage` key store and the OpenRouter and Direct API clients
   (back end).
4. IPC for provider config, guard decisions (warn prompt) and the log
   (scaffolding).
5. Settings OpenRouter and Direct API panes, guard actions and deny-list
   UI (front end).
6. Warn/approve dialog and privacy badge modes (front end).
7. "What was sent" view (front end).
8. Closeout: end-to-end check and code map regeneration.

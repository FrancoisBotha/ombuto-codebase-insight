# Epic 13: Local CLI Providers & LLM Guard

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_11_REMOTE_AI_WITH_GUARD

---

## 1. Purpose
Let users who already pay for Claude Code, Codex or Gemini CLI use them as
the AI provider, safely by default, and add the optional local-LLM second
check on outbound payloads (Architecture §5).

**Working increment:** A user can pick a detected local CLI (Claude Code,
Codex or Gemini) as the provider and ask questions. By default the CLI gets
no tools and only guarded snippets. The user can turn on "Let the CLI read
the repo directly", which shows a yellow "Guard bypassed" badge and logs
each request, or turn on the local-LLM guard check, which blocks the
request if Ollama is unavailable.

## 2. User Story
As a developer who already uses an AI coding CLI,
I want Codebase Insight to use it with the same guardrails as other
providers,
So that I don't need another API key and I don't trade away control of
what is sent.

## 3. Scope
- **In Scope:**
  - CLI detection: path, version and signed-in status for Claude Code,
    Codex and Gemini CLI. A missing CLI is greyed out with its install
    command.
  - Command template per CLI (editable), run with `child_process` using an
    argument array, no shell. With guardrails on: no tools, and only the
    guarded snippets in the prompt.
  - The "Let the CLI read the repo directly (bypasses guardrails)" setting:
    read-only tools enabled, yellow "Guard bypassed" badge, and every
    request logged in `guard_log` as `bypassed`.
  - Local-LLM guard tier (optional, off by default): an Ollama model
    reviews the outgoing payload with a fixed classification prompt and
    returns structured findings, which go through the same off / warn /
    redact / block actions.
  - Fail closed: if the LLM tier is on and Ollama is unavailable, the
    request is blocked with the reason, and logged as `failed_closed`.
  - Privacy badge "Local CLI · <name>".
- **Out of Scope:**
  - Choosing the recommended guard model (Architecture §6 open question).
    Ship a configurable model and measure latency; the recommendation is a
    follow-up.
  - Write-capable CLI tools (never allowed).

## 4. Functional Requirements
1. FR-082 — Settings → Local CLI detects Claude Code, Codex and Gemini CLI
   with path, version and signed-in status, and greys out missing ones with
   their install command.
2. FR-083 — The AI service runs the selected CLI from its command template
   with an argument array and no shell, with no tools, passing only the
   guarded prompt. The answer goes through the same citation validation and
   `ai_*` storage.
3. FR-084 — The "Let the CLI read the repo directly (bypasses guardrails)"
   setting enables read-only tools only. While it is on, the badge shows
   yellow "Guard bypassed" and each request is logged with action
   `bypassed`.
4. FR-085 — The optional local-LLM guard tier sends the outgoing payload to
   the configured Ollama model with a fixed classification prompt, parses
   structured findings, and applies the configured action. It is off by
   default.
5. FR-086 — When the LLM tier is on but Ollama is unreachable or returns an
   invalid result, the request is blocked, the user is told why, and the
   request is logged as `failed_closed`.

## 5. Non-Functional Requirements
1. NFR-022 — CLI runs have a timeout, are killed on cancel, run with a
   working directory outside the repo when tools are off, and never inherit
   API keys from Codebase Insight's own key store.

## 6. UI/UX Notes
- Remove the last Prototype banner from Settings → LLM Provider.
- The yellow note in the CLI pane says the CLI sends prompts to its own
  provider.
- The LLM guard setting shows the measured check latency after the first
  run.

## 7. Data Model Impact
- Writes `guard_log` with providers `cli:claude`, `cli:codex`, `cli:gemini`
  and actions `bypassed` and `failed_closed`. Findings include
  `tier = llm`.
- No schema change expected.

## 8. Integration Impact
- `child_process` for the CLIs, and the Ollama API for the guard tier.
- Extends the Epic 11 guard with a second tier and the provider registry
  with CLI providers.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user with a local CLI can
      select it, ask a question about their real repo with guardrails on,
      and see the bypass state and log entries when they turn bypass on,
      end to end.
- [ ] With the LLM tier on and Ollama stopped, a request is blocked and
      logged `failed_closed`.
- [ ] Tests prove the CLI is spawned without a shell and without tools by
      default (spawn stubbed).
- [ ] `npx vitest run` passes.

## 10. Risks & Unknowns
- CLI flags and output formats change between versions. Keep templates
  editable and parse defensively.
- Signed-in detection may not be reliable for every CLI. Show "unknown"
  rather than guessing.
- Local-LLM guard latency may make Ask feel slow (Architecture §6).

## 11. Dependencies
- epic_11_REMOTE_AI_WITH_GUARD: the guard, actions, `guard_log` and privacy
  badge.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md (§5 local CLI and the guard, outbound guardrails tier 2; §6 guard model)
- screen spec: docs/References/Ombuto Codebase Insight prototype/design_handoff_codebase_insight/README.md (Settings)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_13_LOCAL_CLI_AND_LLM_GUARD.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: medium, about 6 tickets):
1. CLI detection and provider runner, with no shell and no tools by default
   (back end).
2. Bypass mode with read-only tools and logging (back end).
3. Local-LLM guard tier and fail-closed behaviour (back end).
4. IPC for CLI detection and settings (scaffolding).
5. Local CLI settings pane, LLM guard settings and badge states
   (front end).
6. Closeout: end-to-end check and code map regeneration.

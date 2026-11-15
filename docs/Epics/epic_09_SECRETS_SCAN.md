# Epic 9: Secrets Scan

Status: NEW
Owner: human
Created: 2026-11-15
Last Updated: 2026-11-15
Depends On: epic_05_OVERVIEW_AND_HEALTH_SCORE

---

## 1. Purpose
Find credentials committed to the repo, entirely locally, and show them
without ever storing or displaying the secret value. The rule set is built
as a shared module, because Epic 11's outbound guard reuses it to stop
secrets being sent to remote AI providers.

**Working increment:** A user can open their repo and see a real list of
committed secrets (file, line, rule, masked preview and the commit that
introduced it), jump to the line in Files, and see secret risks at the top
of Overview. The scan can be turned off in Settings.

## 2. User Story
As a tech lead inheriting a codebase,
I want to know whether keys or passwords were committed,
So that I can rotate them before they cause an incident.

## 3. Scope
- **In Scope:**
  - A built-in rule set: gitleaks-style regexes for common providers (AWS,
    GCP, Azure, GitHub, Slack, Stripe, private keys, JWTs, connection
    strings) plus a generic high-entropy rule. It is a pure module with no
    pipeline coupling, so the AI guard can reuse it.
  - Scan of all text blobs at HEAD (from `raw_blob_content`) →
    `metric_secret_finding` with masked preview and entropy.
    `first_seen_sha` comes from blame when available.
  - A **Secrets** tab on the Dependencies screen ("Dependencies and
    secrets" in the PRD): rule, file:line, masked preview, first seen, open
    in Files.
  - Files: a marker on lines with a finding.
  - Secret risks (critical) on Overview, and a secret sub-score.
  - Settings → Analysis "Secret scan" toggle (on by default).
- **Out of Scope:**
  - Scanning all historical blobs (only HEAD). Note as a follow-up.
  - Verifying secrets against providers (that would send them out).
  - Bundling a gitleaks binary (rejected in Architecture §4).
  - The outbound AI guard itself (Epic 11).

## 4. Functional Requirements
1. FR-056 — A shared secret-rules module detects secrets in text with
   provider regexes and an entropy rule, and returns rule id, line, span and
   a masked preview. It has no dependency on the pipeline or database.
2. FR-057 — The `deps_secrets` stage scans every non-generated text blob at
   HEAD and writes `metric_secret_finding` (path, line, rule, masked
   preview, entropy, and `first_seen_sha` from blame).
3. FR-058 — The Dependencies screen gains a Secrets tab listing findings
   with rule, location, masked preview and first-seen commit. Each row
   opens Files at that line.
4. FR-059 — Files marks lines with a secret finding in the gutter. The code
   pane still shows the file as committed; the finding panel shows only the
   masked preview.
5. FR-060 — Load reporting adds secret risks (critical) and a secret
   sub-score, and Settings → Analysis has a "Secret scan" toggle that skips
   the scan when off.

## 5. Non-Functional Requirements
1. NFR-015 — The full secret value is never written to the database, logs,
   IPC payloads or the Indexing log. Only masked previews leave the scanner.
   A unit test asserts this on a fixture containing known fake keys.

## 6. UI/UX Notes
- New UI (not in the prototype): follow the Dependencies table pattern and
  the severity system. Use the CRITICAL tone for provider keys and the
  WARNING tone for entropy-only hits.
- Remove the inline "Prototype" tag from the Settings secret-scan row.

## 7. Data Model Impact
- Writes `metric_secret_finding`. `report_risk.category = 'secret'`,
  `target_kind = 'secret'`.
- No schema change expected.

## 8. Integration Impact
- New shared module (for example `src/shared/secretRules.js`) imported by
  the worker now, and by the main-process AI guard in Epic 11.
- Extends the `deps_secrets` stage from Epic 8. If Epic 8 isn't done, this
  epic creates the stage and Epic 8 joins it. Chain the tickets that touch
  the stage file.
- New IPC queries for secret findings.

## 9. Acceptance Criteria
- [ ] The application builds and runs, and a user can open a real repo and
      see its committed secrets with masked previews, jump to each line and
      see them as Overview risks, end to end, without any other epic being
      complete.
- [ ] Each rule has positive and negative fixture tests. The entropy rule
      doesn't flag ordinary hashes in lockfiles.
- [ ] NFR-015 test passes.
- [ ] `npx vitest run` passes.

## 10. Risks & Unknowns
- False positives from entropy (hashes, test fixtures). Exclude lockfiles
  and generated files, and allow inline ignore comments as a follow-up.
- The Files code pane shows the raw file, and so the secret. That is the
  checkout's own content (Architecture §5, data at rest). The masked rule
  covers stored findings and outbound data, not viewing your own file.

## 11. Dependencies
- epic_05_OVERVIEW_AND_HEALTH_SCORE: load stage and Overview risks.
  `first_seen_sha` uses blame from Epic 4, which Epic 5 already depends on.

## 12. References
- prd: docs/Product Requirements Document/PRD.md
- architecture: docs/Architecture/Architecture.md (§4 built-in secret rules, §5 secrets)
- data_model: docs/Data Model/Schema.ddl
- style_guide: no StyleGuide.md yet; design tokens are in src/renderer/assets/ds/
- epic: epic_09_SECRETS_SCAN.md

## 13. Implementation Notes
Before modifying a module, use `docs/Code Map/codemap.json` to answer three questions:

1. What calls it?
2. What does it affect?
3. Which tests cover it?

Do NOT regenerate the code map inside a feature ticket. Mid-epic the map is expected to lag the code, and that drift is normal. If the map is missing, stale, or cannot answer the three questions, read the affected code directly and record in the ticket notes which questions it could not answer. The epic's final closeout ticket regenerates `codemap.html`, `codemap.json`, and `codemap.lock` together.

Suggested tickets (complexity: medium, about 5 tickets):
1. Shared secret-rules module with fixtures and the masking test
   (back end).
2. Scan stage, first-seen via blame, plus risks and sub-score (back end).
3. IPC queries and the settings toggle (scaffolding).
4. Secrets tab on Dependencies and the Files gutter marker (front end).
5. Closeout: end-to-end check and code map regeneration.

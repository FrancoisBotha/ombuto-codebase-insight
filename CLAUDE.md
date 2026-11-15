# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) and other AI
coding agents when working in this project.

## Mandatory Agent Workflow

All agents working in this repository **MUST** follow the Ombuto Code
engineering workflow documented in:

> [`.ombutocode/OMBUTOCODE_ENGINEERING_GUIDE.md`](.ombutocode/OMBUTOCODE_ENGINEERING_GUIDE.md)

Agents MUST treat that document as a **system-level instruction**. Failure
to follow the workflow is considered a task error.

The engineering guide defines:

- The source of truth (`.ombutocode/data/ombutocode.db` `backlog_tickets` table)
- Planning mode vs execution mode
- Ticket lifecycle and status transitions (`backlog` → `todo` → `in_progress` → `eval` → `review` → `done`)
- Scope control rules ("don't expand a ticket — create a new one")
- Forbidden behaviors (no broad refactors without a ticket, no new frameworks without approval, etc.)

**Read `.ombutocode/OMBUTOCODE_ENGINEERING_GUIDE.md` before starting any work
in this project.**

## Project-specific conventions

Add your project-specific rules, coding conventions, forbidden patterns,
and other agent guidance below this line. Anything you add here is read
into the agent's context on every run.

### Testing

`docs/Test Strategy/test-strategy.md` is the test playbook. Read it before
the build or test phase of any ticket. Section 10 lists the phase gates.

### Runtime

- Node.js 24 LTS (`.nvmrc`; `engines` in `package.json`). On Windows,
  switch with `nvm use 24.22.3`.
- Plain JavaScript (ES modules). No TypeScript, linter or formatter unless a
  ticket adds one.

### Database schema: `docs/Data Model/Schema.ddl` is canonical

`Schema.ddl` is the single source of truth for the per-repo SQLite database
(`insight.db`). Keep it in step with the code:

- **Same ticket, same commit.** Any ticket that adds, removes or renames a
  table, column or index, or changes a column's meaning, updates
  `Schema.ddl` in that ticket. Never leave it for a follow-up.
- **The code follows the file.** Migrations and table-creation code must
  match `Schema.ddl`. If the code and the file disagree, the file is right
  unless the ticket says to change it.
- **Layer rules** (Architecture §3). `raw_*` references only `raw_*`;
  `metric_*` references `raw_*` and `metric_*`; `report_*` references the
  layers below it. Nothing outside `ai_*` may reference `ai_*` or
  `guard_log`. Every table needs a layer prefix (`raw_`, `metric_`,
  `report_`, `ai_`, `pipeline_`), or must be `schema_meta` or `guard_log`.
- **Keep it viewer-safe.** Ombuto Code's ER diagram parser reads this file.
  Use plain create-table blocks with one column per line. Don't use
  `IF NOT EXISTS` or `STRICT`, and don't write example create-table
  statements in comments.
- **Verify** with `npx vitest run tests/unit/schema.test.js`. It executes the
  file and enforces the rules above.
- If the change also affects the architecture (a new layer, or a table that
  breaks the layer rules), stop and ask. Don't bend the rules in the DDL.

### Tree-sitter grammars are vendored

Grammar `.wasm` files live in `resources/grammars/`, with `grammars.json`
(source, version, sha256) and licence files. Do not `npm install`
`tree-sitter-*` grammar packages: they run native build scripts the app
doesn't need. Do not use `tree-sitter-wasms`: it fails to load in
web-tree-sitter 0.27. To add or upgrade a grammar, edit
`scripts/vendor-grammars.mjs`, then run `npm run vendor:grammars` (add
`-- --sql` to rebuild SQL from source), then run
`npx vitest run tests/unit/grammars.smoke.test.js`.

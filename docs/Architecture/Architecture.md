# Architecture: Ombuto Codebase Insight

## 1. What We're Building
A single-user desktop app (Electron + Vue 3) that analyses a local git
repository and presents risk, complexity, structure and ownership signals, plus
optional AI-assisted Q&A with line citations. See PRD at
`docs/Product Requirements Document/PRD.md`. The defining architectural property
is that it is **local-first and AI-optional**: all analysis is deterministic and
runs on the user's machine, and AI output is a separate, clearly labelled layer
that never feeds back into computed facts.

## 2. Tech Stack
- Shell: Electron — same as Ombuto Code; desktop file and git CLI access.
- UI: Vue 3 + Pinia + Vite — same as Ombuto Code; reuses its design system
  (`--om-*` tokens) and renderer components.
- Parsing: `web-tree-sitter` (WASM) + per-language grammars (TS/JS, Python,
  Java, C#, Go, Rust, SQL) — one parser API for every language; no native builds.
  Grammar `.wasm` files are vendored in `resources/grammars/` (see §4).
- Git: system git CLI via `simple-git` — fast, complete log/numstat/blame.
- Storage: SQLite via `better-sqlite3`, one database per repo — incremental
  writes during indexing, FTS5 built in.
- Code viewer: CodeMirror 6 — already in Ombuto Code; line highlighting for
  citations.
- Visuals: plain SVG + `d3-hierarchy` (treemap) + `elkjs` (module graph layout
  with folder clusters).
- Secrets scan: built-in regex + entropy rules (gitleaks-style rule set).
- Dependency data: in-house lockfile parsers + OSV.dev for advisories, package
  registries for latest version / licence / deprecation.
- AI (optional): plain HTTP to Ollama / OpenRouter / direct API;
  `child_process` for local CLIs (Claude Code, Codex, Gemini).
- Settings & keys: `electron-store` for settings, Electron `safeStorage` for
  API keys.

## 3. How It's Put Together
The app is an **ETL pipeline feeding a local reporting database**. The git
repository is the source system and is never written to. The per-repo SQLite
database is the **source of truth for everything the app shows**: every screen,
drill-down, AI prompt and shared report. Nothing in the UI computes metrics on
the fly.

**The database** lives at `<userData>/repos/<repo-id>/insight.db` (WAL mode).
Tables fall into three layers, each derived only from the layer below:
- **`raw_*` — extracted facts.** Files and blob SHAs, parsed symbols and
  imports, file content (for FTS and the file view), commits, per-file numstat,
  blame ranges, lockfile entries. No interpretation.
- **`metric_*` — transformed metrics.** Per-function complexity, duplication
  clusters, module graph edges and cycles, fan-in/out and instability, churn,
  ownership and bus factor, co-change pairs, dead code, smells, dependency
  status, secret findings.
- **`report_*` — reporting.** Health score and sub-scores, hotspot ranking, key
  risks, overview summary. Keyed by commit, with a snapshot kept per analysed
  commit so trends ("▼ 3 since 10 Oct") come straight from the table.

AI output lives in a separate **`ai_*`** set (summaries, answers, explanations,
each tagged with provider, model and commit). Outbound AI traffic is recorded
in **`guard_log`** (see §5). Nothing in `raw_*`, `metric_*` or `report_*` reads
from either.

**The pipeline** runs in an Electron `utilityProcess` worker — the only writer.
Stages match the Indexing screen:
1. **Extract files** — tree-sitter parse → `raw_*` (symbols, imports, functions,
   TODOs, duplication fingerprints).
2. **Extract history** — `git log --numstat`, `git blame` → `raw_*`.
3. **Transform structure & history** → `metric_*` (graphs, cycles, complexity,
   churn, ownership, co-change, duplication, dead code).
4. **Extract & transform dependencies & secrets** — lockfiles, OSV/registry
   lookups, secret rules.
5. **Load reporting** → `report_*` (scores, hotspots, risks).
6. **AI enrichment** (optional) → `ai_*` module summaries.

Each stage commits in its own transaction and is **idempotent** (re-running for
the same commit gives the same rows). On commit the worker emits a "stage done"
event and the UI unlocks the features that depend on it — that is how partial
results appear early. Extraction is **incremental**: parsed rows are keyed by
blob SHA and history by commit, so a re-run extracts only changed files and new
commits, then recomputes the (cheap) transforms. Reopening an unchanged repo is
just a database read.

**Main process** owns the window, settings and recent repos, starts pipeline
runs, relays progress, and serves the renderer's typed, read-only IPC queries
(`getHotspots`, `getFile`, `getModuleGraph`, …) against the database. It also
hosts the **AI service**, which retrieves snippets from the database (FTS5 over
file content + symbol index — never the repo directly), passes them through the
outbound guard when the provider is remote, sends them, validates that every
citation points to real lines in `raw_*`, and writes the result to `ai_*`.

**Renderer** (Vue 3 + Pinia) is presentation only: no filesystem, git or SQLite
access.

## 4. Key Decisions
- **Database is the source of truth for reporting; an ETL pipeline is its only
  writer.** Every screen, AI prompt and shared report reads from SQLite.
  Considered computing metrics on demand in the UI and rejected it: reports must
  be reproducible and screens instant on large repos.
- **Layered tables (`raw_*` → `metric_*` → `report_*`).** Each layer can be
  rebuilt from the one below, so a scoring change needs no re-parse. Considered
  one flat results table; rejected because it mixes facts with interpretation.
- **AI output quarantined in `ai_*`; computed tables never read it.** Enforces
  the PRD's computed-vs-AI separation at the data level, not just in the UI.
- **Separate app, not a mode inside Ombuto Code.** Shares the design system and
  renderer patterns, but audience and release cycle differ.
- **Analysis in a `utilityProcess` worker, not the main process.** Long parses
  and blames would freeze the UI, and a crashing grammar shouldn't take down the
  app. Considered `worker_threads`; rejected for weaker crash isolation with
  native modules.
- **System git CLI, not isomorphic-git.** Far faster blame and numstat over
  years of history; the audience has git installed. git becomes a runtime
  prerequisite, checked on the Welcome screen.
- **`web-tree-sitter` (WASM), not native tree-sitter bindings.** One build for
  every OS, no grammar compile step; slower parsing is acceptable at this scale.
- **Grammars vendored as `.wasm` files, not npm dependencies.** The official
  grammar packages ship usable `.wasm` files but also run native install
  scripts the app never uses. The SQL grammar publishes no `.wasm` at all, so
  it is built from source. The `tree-sitter-wasms` bundle was rejected
  because it targets an older parser ABI and fails to load. The files, a
  manifest (source, version, sha256) and their licences are committed and
  refreshed by `scripts/vendor-grammars.mjs`. The cost is about 24 MB in git.
- **`better-sqlite3`, not `sql.js` (Ombuto Code's choice).** Incremental writes
  instead of whole-file rewrites, fast bulk inserts, FTS5 included. It is a
  native module, but v13+ ships N-API prebuilds: the same binary loads in
  Electron and in plain Node (unit tests), so no Electron rebuild step is
  needed. Moving to a version without N-API prebuilds would bring back the
  rebuild and running tests under Electron's Node.
- **Incremental extraction keyed by blob SHA and commit.** Instant reopen,
  seconds to re-analyse after a pull. Full re-analysis every time is too slow on
  large histories.
- **Lexical retrieval (FTS5 + symbol index) for Ask, not embeddings.** Works with
  every provider including small local models, needs no embedding model, and
  citations map directly to lines.
- **Online dependency lookups sending only package names and versions.** On by
  default, can be turned off; offline means "not checked". Considered bundling
  the OSV database; rejected for download size and staleness.
- **Built-in secret rules, not a bundled gitleaks binary.** One less
  platform-specific binary to ship and update.
- **Outbound guard in front of remote AI providers: deterministic rules first,
  local LLM as an optional second check.** Patterns are predictable and fast;
  the local model catches what they miss without data leaving the machine.
  Considered the LLM check alone; rejected as not reliable enough to be the
  only barrier.

## 5. Security & Data
**Trust boundary** is the user's machine. The **analysed repo is untrusted
input** — it may be inherited, unfamiliar or hostile. It is parsed, never
executed: no build scripts, package installs or tests. git runs with an argument
array (no shell) and with `--no-textconv`, no external diff and `core.fsmonitor`
disabled, so repo config can't make git run commands.

**Renderer hardening.** `contextIsolation`, `sandbox`, no `nodeIntegration`.
Code is shown as text in CodeMirror. AI output is rendered as sanitised Markdown
with no raw HTML, because repo content can steer the model (prompt injection).
AI output is display-only and never executed.

**What leaves the machine:**
- Dependency lookups: package names and versions only (can be turned off).
- AI via a remote provider (OpenRouter, direct API, or a local CLI that calls
  its own service): only the snippets selected for that request, after the
  outbound guard. Ollama sends nothing off the machine.

The title-bar privacy badge always shows the active mode.

**Outbound guardrails.** Every request to a remote AI provider passes through a
guard in the AI service before it is sent. Two tiers:
1. **Deterministic, always on** — the secret-scan rules; PII patterns (emails,
   phone numbers, IP addresses, national ID and card formats with checksum
   validation); a user-defined deny-list of terms and paths (customer names,
   internal hostnames, `config/prod/`).
2. **Local-LLM check, optional (off by default)** — an Ollama model reviews the
   outgoing payload with a fixed classification prompt and returns structured
   findings for things patterns miss (personal data in prose, odd-format
   credentials, business-sensitive content).

Each check has a configurable action: **off / warn / redact / block**. Defaults:
redact for secrets, warn for PII, block for deny-list hits. Warn shows the
flagged spans and asks before sending. If the local-LLM check is enabled but
Ollama is unavailable, the guard **fails closed** and says why. Every outbound
request is logged in `guard_log` (provider, findings, action taken, payload
hash; full sent text only if the user turns that on), which backs a "What was
sent" view. The LLM tier is probabilistic and supplements the deterministic
tier rather than replacing it.

**Local CLI and the guard.** With guardrails on, local CLIs run **with no
tools** by default and receive only the guarded snippets in the prompt. A single
setting — **"Let the CLI read the repo directly (bypasses guardrails)"** —
enables read-only tools for users who want better answers. While it's on, the
privacy badge shows a yellow "Guard bypassed" state and every CLI request is
logged in `guard_log` as `bypassed`.

**Secrets.** API keys are stored via Electron `safeStorage` (OS keychain), never
in `electron-store` or the database. Secret-scan findings store file, line, rule
and a masked preview — never the full value.

**Data at rest.** The database is not encrypted. It holds copies of source code
(for FTS and the file view) at standard user permissions in the app's data
folder — the same sensitivity as the checkout itself. "Remove from recents"
deletes the repo's database. No compliance requirements apply.

## 6. Open Questions
- **Guard model:** which Ollama model to recommend for the local-LLM check —
  small enough to keep Ask responsive. Measure latency on a typical laptop.
- **Repo size ceiling:** measured limit for very large monorepos (multi-million
  lines, 100k+ commits), and whether to default to a capped history range or
  folder sub-selection above it.
- **Health score weights:** formula for the five sub-scores. A product call;
  `report_*` is built so changing weights only re-runs the load stage.

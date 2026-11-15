-- =============================================================================
-- Ombuto Codebase Insight: per-repo analysis database (SQLite, better-sqlite3)
-- Location: <userData>/repos/<repo-id>/insight.db   (WAL mode, foreign_keys ON)
-- Source:   docs/Architecture/Architecture.md §3
--
-- CANONICAL SCHEMA. Any ticket that adds, removes or changes a table, column
-- or index updates this file in the same ticket (see CLAUDE.md).
-- tests/unit/schema.test.js executes this file and enforces the layer rules.
--
-- Layers (each derived only from the layer(s) below it):
--   raw_*     extracted facts: files/blobs, parse output, git history,
--             lockfiles, registry/OSV lookups. No interpretation.
--   metric_*  transformed metrics, computed from raw_* (and earlier metric_*).
--   report_*  scores, hotspot ranking, risks, one snapshot per analysed commit.
--   ai_*      AI output, tagged with provider/model/commit. QUARANTINED:
--             nothing in raw_*/metric_*/report_* may reference ai_* or guard_log.
--   guard_log outbound AI request audit log (Architecture §5).
--   pipeline_*, schema_meta: bookkeeping for the ETL worker.
--
-- Keys: parse output is keyed by blob SHA and history by commit SHA, so
-- re-runs extract only new blobs/commits (incremental extraction). Metrics and
-- reports are keyed by the analysed commit (raw_snapshot.commit_sha).
--
-- Conventions: timestamps are INTEGER unix epoch seconds (*_at); booleans are
-- INTEGER 0/1 (is_*/has_*); JSON is stored as TEXT; line numbers are 1-based
-- and inclusive; paths are repo-relative with forward slashes.
--
-- Not stored here: settings and recent repos (electron-store), API keys
-- (Electron safeStorage). Secret values are never stored, only masked previews.
--
-- Viewer note: Ombuto Code's ER diagram parser reads this file with a regex.
-- Keep each table a plain create-table block, one column per line, with no
-- IF NOT EXISTS, no STRICT suffix, and no closing-paren-semicolon inside a
-- table body. Don't write example create-table statements in comments either:
-- the parser would pick them up as tables.
-- =============================================================================

PRAGMA foreign_keys = ON;

-- -----------------------------------------------------------------------------
-- Bookkeeping
-- -----------------------------------------------------------------------------

CREATE TABLE schema_meta (
    key             TEXT PRIMARY KEY,       -- schema_version | repo_id | repo_root | created_at
    value           TEXT NOT NULL
);

-- One row per analysed commit. Metrics and reports hang off this.
CREATE TABLE raw_snapshot (
    commit_sha      TEXT PRIMARY KEY,
    branch          TEXT,                   -- NULL when detached
    committed_at    INTEGER NOT NULL,
    analysed_at     INTEGER NOT NULL,
    history_since   INTEGER                 -- start of history window; NULL = full history
);

CREATE TABLE pipeline_run (
    id              INTEGER PRIMARY KEY,
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    started_at      INTEGER NOT NULL,
    finished_at     INTEGER,
    status          TEXT NOT NULL,          -- running | done | failed | cancelled
    error           TEXT
);

CREATE TABLE pipeline_stage (
    run_id          INTEGER NOT NULL REFERENCES pipeline_run(id) ON DELETE CASCADE,
    stage           TEXT NOT NULL,          -- extract_files | extract_history | transform | deps_secrets | load_reporting | ai_enrichment
    status          TEXT NOT NULL,          -- pending | running | done | failed | skipped
    started_at      INTEGER,
    finished_at     INTEGER,
    rows_written    INTEGER,
    error           TEXT,
    PRIMARY KEY (run_id, stage)
);

-- -----------------------------------------------------------------------------
-- raw_*: files and parse output (stage 1, Extract files)
-- -----------------------------------------------------------------------------

CREATE TABLE raw_blob (
    blob_sha        TEXT PRIMARY KEY,
    language        TEXT,                   -- javascript | typescript | tsx | python | java | c_sharp | go | rust | sql; NULL = not parsed
    size_bytes      INTEGER NOT NULL,
    line_count      INTEGER NOT NULL,
    is_binary       INTEGER NOT NULL DEFAULT 0,
    is_generated    INTEGER NOT NULL DEFAULT 0,  -- minified, vendored or generated code
    parse_status    TEXT NOT NULL,          -- parsed | skipped | error
    parse_error     TEXT
);

-- File content, used for FTS and the file view. Text blobs only.
CREATE TABLE raw_blob_content (
    blob_sha        TEXT PRIMARY KEY REFERENCES raw_blob(blob_sha) ON DELETE CASCADE,
    content         TEXT NOT NULL
);

-- The file tree of each analysed commit: path -> blob.
CREATE TABLE raw_tree_entry (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    path            TEXT NOT NULL,
    blob_sha        TEXT NOT NULL REFERENCES raw_blob(blob_sha),
    PRIMARY KEY (commit_sha, path)
);
CREATE INDEX ix_raw_tree_entry_blob ON raw_tree_entry(blob_sha);

-- Full-text index over file content (Ask retrieval, Architecture §4).
CREATE VIRTUAL TABLE raw_content_fts USING fts5(
    content,
    content = 'raw_blob_content',
    content_rowid = 'rowid',
    tokenize = "unicode61 tokenchars '_'"
);

CREATE TRIGGER trg_raw_blob_content_ai AFTER INSERT ON raw_blob_content BEGIN
    INSERT INTO raw_content_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER trg_raw_blob_content_ad AFTER DELETE ON raw_blob_content BEGIN
    INSERT INTO raw_content_fts(raw_content_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
END;

-- Declarations found by tree-sitter (classes, functions, methods, types, ...).
CREATE TABLE raw_symbol (
    id              INTEGER PRIMARY KEY,
    blob_sha        TEXT NOT NULL REFERENCES raw_blob(blob_sha) ON DELETE CASCADE,
    parent_id       INTEGER REFERENCES raw_symbol(id) ON DELETE CASCADE,
    kind            TEXT NOT NULL,          -- class | interface | struct | enum | function | method | variable | type | module
    name            TEXT NOT NULL,
    qualified_name  TEXT,                   -- e.g. Foo.bar
    is_exported     INTEGER NOT NULL DEFAULT 0,
    has_doc         INTEGER NOT NULL DEFAULT 0,  -- preceded by a doc comment
    start_line      INTEGER NOT NULL,
    end_line        INTEGER NOT NULL
);
CREATE INDEX ix_raw_symbol_blob ON raw_symbol(blob_sha);
CREATE INDEX ix_raw_symbol_name ON raw_symbol(name);

-- Raw complexity inputs per function/method symbol, counted from the AST so the
-- transform stage never re-parses.
CREATE TABLE raw_function (
    symbol_id       INTEGER PRIMARY KEY REFERENCES raw_symbol(id) ON DELETE CASCADE,
    blob_sha        TEXT NOT NULL REFERENCES raw_blob(blob_sha) ON DELETE CASCADE,
    param_count     INTEGER NOT NULL,
    line_count      INTEGER NOT NULL,
    decision_points INTEGER NOT NULL,       -- if / loop / case / catch / && / || / ?: nodes
    max_nesting     INTEGER NOT NULL,
    nesting_weight  INTEGER NOT NULL        -- decision points weighted by nesting depth
);
CREATE INDEX ix_raw_function_blob ON raw_function(blob_sha);

CREATE TABLE raw_import (
    id              INTEGER PRIMARY KEY,
    blob_sha        TEXT NOT NULL REFERENCES raw_blob(blob_sha) ON DELETE CASCADE,
    specifier       TEXT NOT NULL,          -- as written: './util' | 'react' | 'java.util.List'
    kind            TEXT NOT NULL,          -- static | dynamic | require | type_only | using | use
    imported_names  TEXT,                   -- JSON array of names; NULL = whole module
    line            INTEGER NOT NULL
);
CREATE INDEX ix_raw_import_blob ON raw_import(blob_sha);

CREATE TABLE raw_todo (
    blob_sha        TEXT NOT NULL REFERENCES raw_blob(blob_sha) ON DELETE CASCADE,
    line            INTEGER NOT NULL,
    tag             TEXT NOT NULL,          -- TODO | FIXME | HACK | XXX
    text            TEXT NOT NULL,
    PRIMARY KEY (blob_sha, line)
);

-- Rolling hashes over normalised token windows, input to duplication clustering.
CREATE TABLE raw_fingerprint (
    blob_sha        TEXT NOT NULL REFERENCES raw_blob(blob_sha) ON DELETE CASCADE,
    hash            INTEGER NOT NULL,
    start_line      INTEGER NOT NULL,
    end_line        INTEGER NOT NULL,
    PRIMARY KEY (blob_sha, start_line, hash)
);
CREATE INDEX ix_raw_fingerprint_hash ON raw_fingerprint(hash);

-- -----------------------------------------------------------------------------
-- raw_*: git history (stage 2, Extract history)
-- -----------------------------------------------------------------------------

CREATE TABLE raw_author (
    id              INTEGER PRIMARY KEY,
    name            TEXT NOT NULL,
    email           TEXT NOT NULL,
    UNIQUE (name, email)
);

CREATE TABLE raw_commit (
    sha             TEXT PRIMARY KEY,
    author_id       INTEGER NOT NULL REFERENCES raw_author(id),
    committer_id    INTEGER NOT NULL REFERENCES raw_author(id),
    authored_at     INTEGER NOT NULL,
    committed_at    INTEGER NOT NULL,
    parent_shas     TEXT NOT NULL,          -- space-separated; more than one = merge
    subject         TEXT NOT NULL,
    body            TEXT
);
CREATE INDEX ix_raw_commit_committed_at ON raw_commit(committed_at);
CREATE INDEX ix_raw_commit_author ON raw_commit(author_id);

-- git log --numstat, one row per file per commit.
CREATE TABLE raw_commit_file (
    commit_sha      TEXT NOT NULL REFERENCES raw_commit(sha) ON DELETE CASCADE,
    path            TEXT NOT NULL,
    old_path        TEXT,                   -- set on rename/copy
    change_type     TEXT NOT NULL,          -- A | M | D | R | C
    lines_added     INTEGER,                -- NULL for binary files
    lines_deleted   INTEGER,
    PRIMARY KEY (commit_sha, path)
);
CREATE INDEX ix_raw_commit_file_path ON raw_commit_file(path);

-- git blame of each analysed file version, as contiguous line ranges.
CREATE TABLE raw_blame_range (
    blob_sha        TEXT NOT NULL REFERENCES raw_blob(blob_sha) ON DELETE CASCADE,
    path            TEXT NOT NULL,
    start_line      INTEGER NOT NULL,
    line_count      INTEGER NOT NULL,
    commit_sha      TEXT NOT NULL REFERENCES raw_commit(sha),
    PRIMARY KEY (blob_sha, path, start_line)
);

-- -----------------------------------------------------------------------------
-- raw_*: dependencies (stage 4, Extract dependencies)
-- -----------------------------------------------------------------------------

CREATE TABLE raw_lockfile (
    blob_sha        TEXT PRIMARY KEY REFERENCES raw_blob(blob_sha) ON DELETE CASCADE,
    ecosystem       TEXT NOT NULL,          -- npm | pypi | maven | nuget | go | crates
    format          TEXT NOT NULL           -- package-lock | yarn | pnpm | poetry | requirements | go.sum | cargo | nuget-lock | gradle | maven
);

CREATE TABLE raw_lockfile_entry (
    blob_sha        TEXT NOT NULL REFERENCES raw_lockfile(blob_sha) ON DELETE CASCADE,
    package         TEXT NOT NULL,
    version         TEXT NOT NULL,
    is_direct       INTEGER NOT NULL,
    is_dev          INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (blob_sha, package, version)
);

-- Registry lookups (only package names and versions leave the machine).
CREATE TABLE raw_package (
    ecosystem       TEXT NOT NULL,
    package         TEXT NOT NULL,
    latest_version  TEXT,
    fetched_at      INTEGER NOT NULL,
    PRIMARY KEY (ecosystem, package)
);

CREATE TABLE raw_package_version (
    ecosystem       TEXT NOT NULL,
    package         TEXT NOT NULL,
    version         TEXT NOT NULL,
    license         TEXT,                   -- SPDX expression as published
    is_deprecated   INTEGER NOT NULL DEFAULT 0,
    deprecation_msg TEXT,
    published_at    INTEGER,
    fetched_at      INTEGER NOT NULL,
    PRIMARY KEY (ecosystem, package, version)
);

-- OSV.dev advisories.
CREATE TABLE raw_advisory (
    id              TEXT PRIMARY KEY,       -- OSV id, e.g. GHSA-xxxx-xxxx-xxxx
    ecosystem       TEXT NOT NULL,
    package         TEXT NOT NULL,
    summary         TEXT,
    severity        TEXT,                   -- low | moderate | high | critical
    cvss_score      REAL,
    affected        TEXT NOT NULL,          -- JSON: OSV affected ranges
    published_at    INTEGER,
    fetched_at      INTEGER NOT NULL
);
CREATE INDEX ix_raw_advisory_package ON raw_advisory(ecosystem, package);

-- -----------------------------------------------------------------------------
-- metric_*: transformed metrics (stages 3 and 4)
-- -----------------------------------------------------------------------------

CREATE TABLE metric_function (
    symbol_id       INTEGER PRIMARY KEY REFERENCES raw_function(symbol_id) ON DELETE CASCADE,
    cyclomatic      INTEGER NOT NULL,
    cognitive       INTEGER NOT NULL,
    band            TEXT NOT NULL           -- low | moderate | high | very_high
);

CREATE TABLE metric_file (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    path            TEXT NOT NULL,
    module_path     TEXT NOT NULL,          -- folder-level module the file belongs to
    language        TEXT,
    loc             INTEGER NOT NULL,       -- non-blank, non-comment lines
    function_count  INTEGER NOT NULL,
    complexity_sum  INTEGER NOT NULL,
    complexity_max  INTEGER NOT NULL,
    churn_commits   INTEGER NOT NULL,       -- commits touching the file in the history window
    churn_lines     INTEGER NOT NULL,       -- lines added + deleted in the window
    first_commit_at INTEGER,
    last_commit_at  INTEGER,
    author_count    INTEGER NOT NULL,
    bus_factor      INTEGER NOT NULL,       -- fewest authors owning >= 50% of lines
    top_owner_id    INTEGER REFERENCES raw_author(id),
    top_owner_share REAL,                   -- 0..1
    todo_count      INTEGER NOT NULL,
    undocumented_exports INTEGER NOT NULL,
    is_test         INTEGER NOT NULL,
    has_test        INTEGER NOT NULL,       -- some test file maps to this file
    PRIMARY KEY (commit_sha, path)
);
CREATE INDEX ix_metric_file_module ON metric_file(commit_sha, module_path);

-- Line ownership from blame, per file and author.
CREATE TABLE metric_ownership (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    path            TEXT NOT NULL,
    author_id       INTEGER NOT NULL REFERENCES raw_author(id),
    lines_owned     INTEGER NOT NULL,
    commit_count    INTEGER NOT NULL,
    share           REAL NOT NULL,          -- 0..1 of the file's lines
    PRIMARY KEY (commit_sha, path, author_id)
);

-- Imports resolved to files inside the repo.
CREATE TABLE metric_import_edge (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    from_path       TEXT NOT NULL,
    to_path         TEXT NOT NULL,
    import_count    INTEGER NOT NULL,
    PRIMARY KEY (commit_sha, from_path, to_path)
);
CREATE INDEX ix_metric_import_edge_to ON metric_import_edge(commit_sha, to_path);

CREATE TABLE metric_module (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    module_path     TEXT NOT NULL,
    file_count      INTEGER NOT NULL,
    loc             INTEGER NOT NULL,
    fan_in          INTEGER NOT NULL,       -- modules depending on this one
    fan_out         INTEGER NOT NULL,       -- modules this one depends on
    instability     REAL,                   -- fan_out / (fan_in + fan_out); NULL when both are 0
    bus_factor      INTEGER NOT NULL,
    cycle_id        INTEGER,                -- strongly connected component id; NULL = not in a cycle
    PRIMARY KEY (commit_sha, module_path)
);

CREATE TABLE metric_module_edge (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    from_module     TEXT NOT NULL,
    to_module       TEXT NOT NULL,
    import_count    INTEGER NOT NULL,
    in_cycle        INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (commit_sha, from_module, to_module)
);

CREATE TABLE metric_cycle (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    cycle_id        INTEGER NOT NULL,
    module_count    INTEGER NOT NULL,
    edge_count      INTEGER NOT NULL,
    PRIMARY KEY (commit_sha, cycle_id)
);

-- Files that change together. path_a < path_b so each pair is stored once.
CREATE TABLE metric_cochange (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    path_a          TEXT NOT NULL,
    path_b          TEXT NOT NULL,
    co_commits      INTEGER NOT NULL,
    support         REAL NOT NULL,          -- co_commits / commits in window
    confidence      REAL NOT NULL,          -- co_commits / min(commits touching a, commits touching b)
    has_import_edge INTEGER NOT NULL,       -- 0 = hidden coupling
    PRIMARY KEY (commit_sha, path_a, path_b),
    CHECK (path_a < path_b)
);

CREATE TABLE metric_duplication_cluster (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    cluster_id      INTEGER NOT NULL,
    line_count      INTEGER NOT NULL,
    instance_count  INTEGER NOT NULL,
    PRIMARY KEY (commit_sha, cluster_id)
);

CREATE TABLE metric_duplication_instance (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    cluster_id      INTEGER NOT NULL,
    path            TEXT NOT NULL,
    start_line      INTEGER NOT NULL,
    end_line        INTEGER NOT NULL,
    PRIMARY KEY (commit_sha, cluster_id, path, start_line)
);

CREATE TABLE metric_dead_code (
    id              INTEGER PRIMARY KEY,
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    path            TEXT NOT NULL,
    symbol_id       INTEGER REFERENCES raw_symbol(id),  -- NULL for whole-file findings
    reason          TEXT NOT NULL           -- unreferenced_export | unimported_file | unused_private
);
CREATE INDEX ix_metric_dead_code_commit ON metric_dead_code(commit_sha, path);

CREATE TABLE metric_smell (
    id              INTEGER PRIMARY KEY,
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    path            TEXT NOT NULL,
    line            INTEGER NOT NULL,
    language        TEXT NOT NULL,
    rule_id         TEXT NOT NULL,          -- e.g. js/long-parameter-list
    severity        TEXT NOT NULL,          -- info | warning | error
    message         TEXT NOT NULL
);
CREATE INDEX ix_metric_smell_commit ON metric_smell(commit_sha, path);

CREATE TABLE metric_dependency (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    lockfile_path   TEXT NOT NULL,
    ecosystem       TEXT NOT NULL,
    package         TEXT NOT NULL,
    version         TEXT NOT NULL,
    is_direct       INTEGER NOT NULL,
    is_dev          INTEGER NOT NULL,
    check_status    TEXT NOT NULL,          -- checked | not_checked (offline or lookups disabled)
    latest_version  TEXT,
    is_outdated     INTEGER,
    major_behind    INTEGER,
    is_deprecated   INTEGER,
    license         TEXT,
    license_flag    TEXT,                   -- ok | copyleft | unknown | none
    advisory_count  INTEGER NOT NULL DEFAULT 0,
    max_severity    TEXT,
    PRIMARY KEY (commit_sha, lockfile_path, package, version)
);

CREATE TABLE metric_dependency_advisory (
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    ecosystem       TEXT NOT NULL,
    package         TEXT NOT NULL,
    version         TEXT NOT NULL,
    advisory_id     TEXT NOT NULL REFERENCES raw_advisory(id),
    PRIMARY KEY (commit_sha, ecosystem, package, version, advisory_id)
);

-- Committed secrets. Never stores the secret value.
CREATE TABLE metric_secret_finding (
    id              INTEGER PRIMARY KEY,
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    path            TEXT NOT NULL,
    line            INTEGER NOT NULL,
    rule_id         TEXT NOT NULL,          -- e.g. aws-access-key | generic-high-entropy
    masked_preview  TEXT NOT NULL,          -- e.g. AKIA************WXYZ
    entropy         REAL,
    first_seen_sha  TEXT REFERENCES raw_commit(sha)
);
CREATE INDEX ix_metric_secret_finding_commit ON metric_secret_finding(commit_sha, path);

-- -----------------------------------------------------------------------------
-- report_*: reporting (stage 5, Load reporting). One snapshot per analysed
-- commit; trends come from comparing snapshots.
-- -----------------------------------------------------------------------------

CREATE TABLE report_snapshot (
    commit_sha      TEXT PRIMARY KEY REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    generated_at    INTEGER NOT NULL,
    health_score    REAL NOT NULL,          -- 0..100
    weights_version TEXT NOT NULL,          -- id of the scoring formula (Architecture §6: weights are open)
    file_count      INTEGER NOT NULL,
    loc             INTEGER NOT NULL,
    commit_count    INTEGER NOT NULL,
    author_count    INTEGER NOT NULL,
    active_author_count INTEGER NOT NULL,   -- authors with commits in the last 90 days
    languages       TEXT NOT NULL           -- JSON: {"typescript": 41200, ...} loc per language
);

-- The health score's sub-scores. Keys are not fixed yet (Architecture §6).
CREATE TABLE report_subscore (
    commit_sha      TEXT NOT NULL REFERENCES report_snapshot(commit_sha) ON DELETE CASCADE,
    score_key       TEXT NOT NULL,
    score           REAL NOT NULL,          -- 0..100
    weight          REAL NOT NULL,
    detail          TEXT,                   -- JSON: inputs behind the score
    PRIMARY KEY (commit_sha, score_key)
);

CREATE TABLE report_hotspot (
    commit_sha      TEXT NOT NULL REFERENCES report_snapshot(commit_sha) ON DELETE CASCADE,
    rank            INTEGER NOT NULL,
    path            TEXT NOT NULL,
    score           REAL NOT NULL,
    churn_commits   INTEGER NOT NULL,
    complexity_sum  INTEGER NOT NULL,
    bus_factor      INTEGER NOT NULL,
    top_owner_id    INTEGER REFERENCES raw_author(id),
    reason          TEXT NOT NULL,          -- short computed explanation, never AI text
    PRIMARY KEY (commit_sha, rank),
    UNIQUE (commit_sha, path)
);

CREATE TABLE report_risk (
    commit_sha      TEXT NOT NULL REFERENCES report_snapshot(commit_sha) ON DELETE CASCADE,
    rank            INTEGER NOT NULL,
    category        TEXT NOT NULL,          -- complexity | ownership | structure | quality | dependency | secret
    severity        TEXT NOT NULL,          -- low | medium | high | critical
    title           TEXT NOT NULL,
    detail          TEXT NOT NULL,
    target_kind     TEXT NOT NULL,          -- file | module | package | secret | cycle
    target_ref      TEXT NOT NULL,          -- path, module path, package@version or row id
    PRIMARY KEY (commit_sha, rank)
);

-- -----------------------------------------------------------------------------
-- guard_log: every outbound request to a remote AI provider (Architecture §5)
-- -----------------------------------------------------------------------------

CREATE TABLE guard_log (
    id              INTEGER PRIMARY KEY,
    created_at      INTEGER NOT NULL,
    provider        TEXT NOT NULL,          -- openrouter | anthropic | openai | cli:claude | cli:codex | cli:gemini | ollama
    model           TEXT,
    request_kind    TEXT NOT NULL,          -- ask | explain | summary
    payload_sha256  TEXT NOT NULL,
    payload_bytes   INTEGER NOT NULL,
    findings        TEXT NOT NULL,          -- JSON array of {tier, rule, action, span}
    action          TEXT NOT NULL,          -- sent | redacted | warned_sent | blocked | failed_closed | bypassed
    sent_text       TEXT                    -- full sent payload, only if the user enables it
);
CREATE INDEX ix_guard_log_created ON guard_log(created_at);

-- -----------------------------------------------------------------------------
-- ai_*: optional AI output (stage 6 and on-demand). Display only. May reference
-- raw_*; must never be referenced by raw_*, metric_* or report_*.
-- -----------------------------------------------------------------------------

CREATE TABLE ai_module_summary (
    id              INTEGER PRIMARY KEY,
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    module_path     TEXT NOT NULL,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    summary_md      TEXT NOT NULL,
    guard_log_id    INTEGER REFERENCES guard_log(id)  -- NULL for local (Ollama) requests
);
CREATE INDEX ix_ai_module_summary_module ON ai_module_summary(commit_sha, module_path);

CREATE TABLE ai_answer (
    id              INTEGER PRIMARY KEY,
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    question        TEXT NOT NULL,
    answer_md       TEXT NOT NULL,
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    guard_log_id    INTEGER REFERENCES guard_log(id)
);

-- Citations in an answer, checked against real lines in raw_* before storing.
CREATE TABLE ai_citation (
    answer_id       INTEGER NOT NULL REFERENCES ai_answer(id) ON DELETE CASCADE,
    ordinal         INTEGER NOT NULL,
    path            TEXT NOT NULL,
    blob_sha        TEXT NOT NULL REFERENCES raw_blob(blob_sha),
    start_line      INTEGER NOT NULL,
    end_line        INTEGER NOT NULL,
    is_valid        INTEGER NOT NULL,       -- 0 = model cited lines that do not exist
    PRIMARY KEY (answer_id, ordinal)
);

CREATE TABLE ai_explanation (
    id              INTEGER PRIMARY KEY,
    commit_sha      TEXT NOT NULL REFERENCES raw_snapshot(commit_sha) ON DELETE CASCADE,
    target_kind     TEXT NOT NULL,          -- hotspot | commit | risk
    target_ref      TEXT NOT NULL,          -- path, commit sha or risk rank
    provider        TEXT NOT NULL,
    model           TEXT NOT NULL,
    created_at      INTEGER NOT NULL,
    body_md         TEXT NOT NULL,
    guard_log_id    INTEGER REFERENCES guard_log(id)
);
CREATE INDEX ix_ai_explanation_target ON ai_explanation(commit_sha, target_kind, target_ref);

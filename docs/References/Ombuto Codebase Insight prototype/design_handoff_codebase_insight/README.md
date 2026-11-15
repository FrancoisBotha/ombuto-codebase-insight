# Handoff: Ombuto Codebase Insight

## Overview
Codebase Insight is a desktop app (an Ombuto Code sibling: Electron + Vue 3) that analyses a local git repository. It shows size, complexity, structure, quality, dependency health and git-history signals, then lets the user ask questions about the code with grounded, cited answers. **All analysis runs locally**. LLM features default to Ollama; OpenRouter, a direct API or a local coding CLI (Claude Code / Codex / Gemini) are opt-in.

Core principle, visible everywhere: **computed facts and AI interpretation are always visually distinct.** Computed numbers are plain mono text. AI text sits in a dashed indigo box labelled "· AI" with a "verify before acting" footnote.

## About the Design Files
The files in `prototype/` are **design references built in HTML**. They are a working prototype showing the intended look, layout and behaviour, not production code to copy. Recreate these screens in the target codebase's environment. For Ombuto that is **Vue 3 + Electron**, reusing the existing Ombuto Code renderer patterns (`main.css`, `titlebar.css`, `BoardList.vue`, `StatusBar.vue`, `SettingsView.vue`). All data in the prototype is hard-coded sample data for a fictional repo, `harbor-api`.

To view it: serve the `prototype/` folder over any static server and open `Codebase Insight.dc.html`. The page has three dev-only "Tweaks" props: `theme` (dark/light), `viewState` (loaded/empty/loading/error) and `startScreen`.

## Fidelity
**High-fidelity.** Final colours, type, spacing and interactions, all built on the Ombuto Code Design System tokens. Recreate it pixel-accurately using the app's existing components and CSS variables (`--om-*`). Logic and data are mocked.

---

## App Shell (every screen except Welcome)
- **Title bar**: 32px high, background `--om-titlebar` (#1a2a3a), or the user-chosen tint from Settings → Appearance. Left to right:
  - logo (16px) and "Codebase Insight" (12px/500, letter-spacing .5px);
  - a divider, then repo name and branch pill in mono .72rem;
  - a centred search field (400px max, 22px high, rgba(255,255,255,.08) bg, "⌘K" key hint) that opens the command palette;
  - a privacy badge (`mdi-shield-lock-outline` in mint, plus "Local · Ollama", "OpenRouter", "Local CLI · Claude Code" etc.);
  - Windows-style window buttons (`.om-win-btn`).
- **Sidebar**: 250px, collapses to 50px icons (`.om-sidebar`, `.om-board-item`, `.om-collapsed-item`). Header row (48px):
  - a "REPOSITORY" eyebrow (.6rem/600 uppercase);
  - the repo name in mono;
  - a health-score pill (yellow tone, "72");
  - a collapse button.

  Nav groups (eyebrows .6rem uppercase, rgba(255,255,255,.28)). Shortcut hints sit right-aligned in mono .6rem:
  - **Analyse**: Overview, Size & Inventory, Architecture, Complexity, Code Quality, Dependencies
  - **History**: Hotspots, Commit History
  - **Understand**: Ask the Codebase, Diagrams, Files
  - **Share**: Share Report

  The footer holds Settings (⌘,) and "Analysed 2h ago · a91f3c2" with a refresh icon (⌘R → re-run indexing).
- **Status bar**: 24px, design-system `StatusBar`. Shows path, branch, "612 files · analysed 2h ago" and "Codebase Insight 0.4.0". During indexing it shows "Analysing… NN%".
- **Screen header pattern**: padding 10–12px 20px, bottom border `--om-border`. Title is 1.05rem/600 `--om-text-strong`; the subline is mono .7rem `--om-text-muted`. Right-aligned controls are segmented toggles: a 2px-padded `--om-inset` track, 4px-radius buttons, with the active button on `--om-card-raised` with mint text.
- **Card pattern**: `--om-card` bg, 1px `--om-border`, 8px radius. Section labels are .7rem/600 uppercase, .5px tracking, muted. Stat strips are a 6-column grid where each cell has a 1px left border, a .6rem uppercase label, a mono 1–1.1rem value and a .62rem sub-label.
- **AI block pattern**: 1px **dashed** `--ai-line` border, `--ai-bg` fill, 6–8px radius. Eyebrow: `mdi-creation` icon plus ".6rem/600 uppercase" text in `--ai`. Footnote at .62rem muted: "Interpreted from … · verify before acting".
  - Dark: `--ai:#a5b4fc; --ai-line:rgba(129,140,248,.45); --ai-bg:rgba(129,140,248,.07)`
  - Light: `--ai:#4338ca; --ai-line:rgba(67,56,202,.35); --ai-bg:rgba(67,56,202,.05)`
- **Severity system** (consistent everywhere): CRITICAL = red tone / `--om-danger` #e06060, WARNING = yellow tone / `--om-warning` #e5a830, INFO = blue tone / `--om-blue` #5b9bd5. Use the design-system `Badge` with `kind="flag"` and a `tone`.

## Screens

### 1. Welcome
- **Purpose:** Open a repo (no sidebar on this screen).
- **Layout:** Centred two-column grid, max 920px, columns 1fr / 1.25fr, gap 40px, padding 56px 32px.
- **Left column:**
  - 40px logo;
  - H1 "Open a repository." (1.75rem/600);
  - body text (.9rem muted);
  - primary Button "Open Folder…" (`folder-open-outline`) with a ⌘O hint;
  - a dashed 1.5px drop zone ("Drop a repository folder here");
  - a mint-tint privacy note: **"Analysis runs locally."** …
- **Right column:** "RECENT REPOSITORIES" list card. Each row is a 40/1fr/auto grid:
  - a round 40px health-score chip, tone ≥80 green, ≥60 yellow, else red;
  - the name with a language pill, and the path in mono;
  - time and status on the right. Status can be red, e.g. "1 new critical", or yellow, e.g. "Partial — git history unavailable".
- **Interaction:** Clicking a row starts Indexing.

### 2. Indexing
- **Layout:** Header ("Analysing harbor-api", elapsed time) with a Pause button. Below it, a grid of 1.5fr and minmax(300px,1fr).
- **Left column:**
  - an overall progress bar (6px, mint);
  - a stage list card. Each stage has a status icon (check / spinner / outline circle), a title, a detail line, a 3px bar and an "n / total" count;
  - a terminal-style log (`--om-terminal`, mono .68rem).

  The five stages are:
  - Parsing files
  - Reading git history
  - Building graphs
  - Scanning dependencies & secrets
  - Writing module summaries. This stage has an "Optional · LLM" indigo tag and an indigo bar.
- **Right column:** "Start exploring now" card listing features that unlock as stages finish (lock icon → mint icon, "Waiting / Partial / Ready"), plus a primary "Explore Partial Results" button and a privacy note.
- **Behaviour:** Progress auto-advances in the prototype (0.3% per 120ms).

### 3. Overview
- **Header:** "Overview" with a legend: Computed (`mdi-function-variant`) vs AI-interpreted (indigo `mdi-creation`), plus a Share button.
- **Row 1:** summary strip. A language bar (stacked 6px, legend) plus six stats: Lines, Contributors, Age, Commits, Coverage, Cycles.
- **Row 2** (300px / 1.25fr / 1fr):
  - **Health Score**: 3.4rem/300 mono "72", FAIR badge, "▼ 3 since 10 Oct", five sub-score bars coloured ≥70 green, ≥55 amber, else red.
  - **Top Hotspots**: table of File / Churn / CC / Risk bar; rows open the Hotspots screen.
  - **Key Risks**: icon, title, mono detail and severity badge; each row deep-links to the relevant screen.
- **Row 3:**
  - a mini hotspot treemap (230px high, click → Hotspots);
  - an AI "Recent Activity · Last 14 Days" summary with mono file-name chips.
- **View states** (`viewState`):
  - empty: "This branch hasn't been analysed." with Analyse Branch / View main Results;
  - loading: skeleton cards and the line "Computing health score — 3 of 5 signals ready";
  - error: red card "Git history couldn't be read." with a terminal excerpt and Fetch Full History / Continue Without History / Copy Log.

### 4. Size & Inventory
- **Stat strip** (8 columns): Files, Lines of code, Comment lines, Blank lines, Functions, Classes, Methods, Types.
- **Lines by Language**: a stacked bar per language (code `--om-blue`, comments `--om-mint-deep`, blank `--om-gray-500`) with files, code and comment-% columns.
- **Language Units** card: tabs for TypeScript, SQL, Python, Java / C#, Go and Rust. A mint dot marks languages detected in the repo. The card shows a 4-column grid of unit counts:
  - TS: exports, interfaces, type aliases, enums, classes, async functions, React/Vue components, hooks/composables;
  - SQL: tables, views, indexes, migrations, stored functions;
  - Python: modules, classes, functions, decorators, async functions;
  - Java/C#: packages/namespaces, classes, interfaces, annotations;
  - Go: packages, structs, interfaces, goroutine launches;
  - Rust: crates, modules, traits, impl blocks, unsafe blocks.

  Languages that aren't detected show "—" and "Not detected in this repository".
- **File Size Distribution**: Median / P90 / Max plus function median / P90, a histogram (buckets <50 … 800+, small buckets amber), and a "Where size concentrates" bar: top 1% red, next 9% amber, rest grey. Caption: "The largest 10% of files hold 47% of the code".
- **Largest Files** and **Largest Functions**: bar lists. Clicking a file opens Files.
- **Lines by Folder**: a stacked code/comment/blank bar per folder, with file count and LOC.

### 5. Architecture
- **Header toggle:** Module Graph | C4 · Containers.
- **Module graph:**
  - 1000×620 canvas, centred, scaled by zoom (40–160%, step 10, transition .2s);
  - dashed folder clusters (`api/`, `domain/`, `infra/`, `shared/`);
  - nodes are cards (min-width 112px, 6px radius) with a dot (red if in a cycle), the mono name and "n files · n.nk";
  - edges are SVG lines with arrowheads. Cycle edges are red dashed (5 4), edges touching the selection are mint, others grey at 55% opacity.
  - Filter chips (pills): Highlight cycles, Cluster by folder, Hide shared/.
  - Zoom control box top-right: − / % / + / fit.
  - Legend bottom-left.
- **Right inspector** (320px):
  - module name, path and an IN CYCLE badge;
  - stats: Files, Lines, Fan-in, Fan-out, Instability (= fan-out / (fan-in + fan-out), Robert Martin) and Layer;
  - Imports → and ← Imported By chips (cycle chips get a red sync icon; clicking selects that module);
  - a **Classes** table: DIT (inheritance depth), NOC (subclasses) and an LCOM bar, amber when above 0.6, with the hint "LCOM above 0.6 suggests the class does several unrelated jobs";
  - an AI module summary.
- **C4 view:**
  - people are round; systems are blue-bordered; external systems are dashed grey; databases are raised cards;
  - a dashed blue system boundary;
  - labelled relationships ("Calls [GraphQL]");
  - the inspector lists relationships.

### 6. Complexity
- **Header:** thresholds toggle, warn/critical = 10/20 or 15/30. This re-colours everything below.
- **Stat strip:** Functions, Median CC, P90 CC, Over warn, Over critical, Avg MI.
- **Row** (3 columns):
  - **Distribution**: square-root-scaled histogram (buckets 1–2 … 31+).
  - **The Long Tail**: "**12** functions hold **NN%** of all complexity above 10", with a segmented red bar against grey and the top-3 contributors.
  - **Average CC by Module**: bars.
- **Most Complex Functions** table:
  - columns: Function, File, Cyclomatic (value and bar), Cog, Nest, Params, Ret, MI, Δ 30d, Cov, Severity;
  - amber highlights: nesting ≥5, params ≥5, returns ≥10, MI <50 (red <35), coverage <50%;
  - filters: All / Critical / Warning / Rising;
  - clicking a row selects it.
- **Bottom row:**
  - **Selected function detail**: 12 metrics, including Halstead volume, difficulty, effort and estimated bugs, plus an Open File button.
  - "Over 20 · 12 Months" trend bars.
  - AI refactoring candidates.

### 7. Code Quality
- **Stat strip:** Duplicated lines, Dead code, Type coverage, JSDoc coverage, TODO/FIXME/HACK, Test:source ratio.
- **Underline tabs:** each carries a count pill.
  - **Duplication**: clone-groups table with Type (Exact red / Near yellow), Location A, Location B, Lines, Tokens, Similarity and a Difference note.
  - **Dead Code**: Unused Exports (with "Possible dynamic use" warnings), Unreferenced Files (with last-changed age) and Unused Functions Within a File.
  - **Type Safety**: tiles (type coverage, `any`, `@ts-ignore`, `eslint-disable`, non-null `!`), a per-folder table, and an "Other Language Signals" list for languages not detected. That list covers Python type hints, bare `except:` and mutable defaults; Rust `.unwrap()` and `unsafe`; Go ignored errors; and Java/C# generic catch and empty catch.
  - **Docs & TODOs**: JSDoc coverage per folder, lowest comment density, and a TODO/FIXME/HACK list sorted oldest-first. Age comes from git blame; ≥2 years is amber.
  - **Tests**: tiles (ratio, test functions, assertions per test, skipped tests, untested files), Source Files Without Tests sorted by churn (with severity), and a Skipped Tests list with age.

### 8. Dependencies
- **Header** counts: Critical / Warning / Major Behind.
- **Toolbar:** search input, filter pills (All, Vulnerable, Major Behind, License Issues, Deprecated, each with a count) and the shown count.
- **Table:**
  - min-width 1000px, sticky header, sortable columns (click to toggle the arrow);
  - columns: Package, Current, Latest, Status badge, Vulnerabilities (badge and description), License (amber note for non-OSI or a license change), Size, Last Release ("stale" if ≤2022), Used In;
  - empty state: "No packages match this filter."

### 9. Hotspots
- **Header:** metric segmented control (Churn × Complexity, Churn, Complexity, Code Age, Ownership, Bug Fixes) and a period select.
- **Treemap:**
  - squarified layout; area = LOC; colour ramp per metric;
  - heat ramp, dark theme: #2a3038 → #4d4429 → #8a6420 → #b8553c → #e06060;
  - age ramp, dark theme: #1f6b57 → … → #22262c;
  - folder frames are labelled in mono uppercase;
  - the selected tile has a 2px mint inset ring;
  - hover brightens to 1.18;
  - legend below.
- **Right inspector** (340px):
  - file name, path, severity badge, and Open File / Ask buttons;
  - a 9-metric grid: Churn, Complexity, Lines, Code age, Authors, Top owner, Fix commits, Bus factor, Fix ratio;
  - a 26-week change timeline;
  - Top Authors bars;
  - "Changes Together With", with a coupling score. Pairs that don't import each other get a yellow **NO IMPORT** tag (hidden change coupling);
  - "Explain This Hotspot" (dashed AI button, ⌘E). Its states are idle → loading (1.4s) → AI explanation plus a 💡 suggestion line (render with `mdi-lightbulb-on-outline`).

### 10. Commit History
- **Header:** All Branches | First-Parent · main toggle, plus author and period selects.
- **Stat strip:** Commits 90d, Active Authors, Merged PRs, Reverts, Avg Size, Off-Hours.
- **Row:**
  - a 26-week × 7-day activity heatmap (10px cells, 3px gap, mint ramp #232a31 → #6dd4a0);
  - three insight cards: reverts, long-lived branch, review concentration.
- **Git Graph card:**
  - SVG lanes; lane colours are main = mint, then blue, yellow and orange;
  - commits are 4px dots; merges are 5px hollow dots;
  - forks and merges are drawn as bezier curves;
  - rows are 34px with refs (branch / tag / HEAD pills in lane colour), a REVERT badge, message, author, time, +/− and hash;
  - the selected row has a mint tint and a ring around its dot.
- **Right inspector** (340px):
  - hash, branch, message, author and +/−;
  - auto-notes (revert, hotspot touched without tests, large change);
  - files changed, with +/− split bars and hotspot dots;
  - AI "What changed".

### 11. Ask the Codebase
- **Layout:** chat at 1.15fr, plus a code preview pane (1fr, `--om-inset`).
- **Header:** model pill (mint), e.g. "llama3.1:8b · local".
- **Empty state:** six starter questions in a 2-column grid.
- **Messages:**
  - user messages are right-aligned bubbles (12/12/3/12 radius);
  - AI answers are paragraphs, each followed by citation chips ("session.ts:14–23"). Clicking a chip loads those lines in the preview (highlight `rgba(109,212,160,.09)` with a 2px mint left bar);
  - the footer reads "Grounded in N files · M lines read · verify cited lines".
- **Thinking state:** dashed AI box with step list (✓ / spinner).
- **Error state:** red card "Ollama isn't responding." with Retry / LLM Settings.
- **Composer:** textarea (⏎ send, ⇧⏎ newline), primary Ask button, follow-up chips, and the hint "Only cited snippets are read by the model".

### 12. Diagrams
- **Left gallery** (260px): cards with icon preview, title, type, and Computed vs AI-assisted label.
- **Main area:**
  - header with title, type pill and source;
  - Canvas | Mermaid Source toggle;
  - an Export dropdown (Mermaid .mmd, PlantUML, SVG, PNG 2×, Copy Mermaid); each item shows a toast;
  - AI-assisted diagrams show an indigo notice strip.
- **Renderers:**
  - ERD / class / infra diagrams are box tables (230px wide, 30px header, 24px rows, PK amber, FK blue) with orthogonal connectors;
  - sequence / request-flow diagrams have participants, dashed lifelines, numbered messages, dashed returns and self-calls.

### 13. Files
- **Left Explorer** (250px):
  - filter input and collapse-all;
  - tree rows 24px, indent 14px per level;
  - folder chevrons; file icons by type;
  - hotspot (red) and watch (amber) dots;
  - the selected row has a mint tint and a 2px mint left bar.
- **Header:**
  - breadcrumb;
  - HOTSPOT/WATCH and CYCLE badges;
  - a meta line;
  - Ask About File and Open in Editor buttons.
- **Code pane:**
  - line numbers;
  - a per-line complexity heat bar (28px gutter);
  - a 4px blame-age strip (new #6dd4a0 → old #2d333b);
  - syntax tokens: keywords blue-fg, types yellow-fg, strings green-fg, numbers orange-fg, comments muted;
  - a "N more lines" fold.
- **Right panel** (380px), with tabs:
  - **Metrics**: 6 tiles plus a function table;
  - **History**: monthly bars plus a commit list;
  - **Dependencies**: imports and importers, with CYCLE badges;
  - **Summary**: AI.

### 14. Share Report
- **Left panel** (340px):
  - section checkboxes;
  - README Badges with a Flat / Square / Large style toggle;
  - a live badge preview, the Markdown snippet and a copy button (check icon for 1.8s);
  - a note that badges are local SVG files written to `.insight/badges/`.
- **Right:** a light-themed A4-like report preview (max 720px, white, padding 40/44) that reflects the selected sections.
- **Header:** export buttons PDF / HTML / Markdown.

### 15. Settings
- **LLM Provider:**
  - four selectable cards / tabs: **Local · Ollama**, **OpenRouter**, **Direct API**, **Local CLI**;
  - per-provider config pane:
    - Ollama: endpoint, model and Test;
    - OpenRouter: key, model routing and allowed providers;
    - Direct API: provider, key and "Show exactly what will be sent and ask before each request";
    - Local CLI: detected CLIs with path, version and signed-in status. A missing CLI is greyed out and shows its install command. Also a command template (`claude -p --output-format json --allowedTools Read`), Test, and a yellow note that the CLI sends prompts to its own provider and is limited to read-only tools.
  - Two panels below: "Sent per request" (blue tone, with destination) and "Never sent" (mint tint).
- **Analysis card:**
  - Ignored Paths chips (removable; add a glob and press ⏎);
  - Languages Detected checkboxes;
  - toggle rows: git history (with a range select), secret scan, module summaries (LLM), auto-reanalyse on branch switch.
  - Toggles are 34×18 pills, on = `--om-teal-btn`, with a 14px white knob.
- **Appearance card:**
  - header with a 40px blue-tone icon tile, "Appearance" and "Customize the look and feel of the app";
  - **Theme** row with a joined Light | Dark segmented control (active = `--om-blue-action` #4a90e2, white text);
  - **Title Bar Color** row: a reset swatch (dashed) plus 20 swatches, 26px with 4px radius. The selected swatch has a double ring: `0 0 0 2px card, 0 0 0 4px text-strong`. Choosing one tints the title bar live.
- **Keyboard:** a two-column shortcut table, plus the note "Shown with ⌘ on macOS and Ctrl on Windows and Linux."

## Overlays
- **Command palette (⌘K):**
  - 600px wide, 84px from the top, 50% black scrim;
  - `--om-dialog` bg, 12px radius, `--shadow-modal`;
  - auto-focused input;
  - grouped results: Files (shown when typing), Actions, Navigate;
  - ↑↓ moves the active row (mint tint), ⏎ runs it, Esc closes;
  - footer hints.
- **Toast:** bottom-right, `--om-dialog`, mint check icon, auto-dismiss after 2.6s.

## Interactions & Shortcuts
- ⌘K palette · ⌘1–⌘9 first nine nav items · ⌘, Settings · ⌘B toggle sidebar · ⌘O Welcome/Open · ⌘R re-analyse · ⌘E explain hotspot · ⌘J Ask. Use Ctrl on Windows and Linux.
- Transitions: colour and background .12–.2s ease; treemap hover filter .12s; zoom transform .2s; toggle knob left .15s. No other motion.
- Deep links: risk rows, top hotspots, activity chips, complexity rows, commit files and untested files all route to the relevant screen with its selection pre-set.

## State (suggested store shape)
`screen, theme, titlebarColor, sidebarCollapsed, palette{open,query,index}, hotspots{metric,selectedPath,explainState}, complexity{thresholds,filter,selectedFn}, architecture{view,selectedNode,c4Selected,cycles,clusters,hideShared,zoom}, history{firstParentOnly,selectedHash}, files{selectedPath,treeOpen{},treeQuery,tab}, quality{tab}, inventory{unitLang}, deps{filter,query,sortKey,sortDir}, diagrams{selected,view,exportOpen}, ask{messages[],input,pending,activeCitation}, report{sections{},badgeStyle}, settings{llmProvider,providerTab,cli,toggles{},ignoredPaths[]}, toast`.

Data comes from the local analysis engine (tree-sitter parse, git log/numstat/blame, import graph, lockfile and advisories). LLM calls go only through the selected provider and only with cited snippets.

## Design Tokens
Use the Ombuto Code Design System CSS variables (see `prototype/_ds/.../tokens/*.css`). Key values (dark):
- **Surfaces:**
  - bg #161a1f · surface #1e2228 · card #21262d · card-raised #282d35 · inset #1a1e24;
  - sidebar #1a2030 · titlebar #1a2a3a · dialog #1e2535 · terminal #11151a.
- **Text:** text #d4d8dd · strong #e0e4e8 · muted #8b929a · label #b0b8c4 · value #c8cdd3 · placeholder #5a6270.
- **Border:** #373d45 · hover #5b9bd5.
- **Brand:** mint #6dd4a0 (tint .08 / .12, deep #4fa077) · teal #2dd4bf · teal-btn #0f8a7e · blue #5b9bd5 · blue-action #4a90e2 · indigo #818cf8.
- **Semantic:** success #3cc77a · warning #e5a830 · danger #e06060.
- **Tones (bg/fg):** blue #1e2a3a/#7eb8e5 · yellow #3a3520/#e5c46a · orange #3a2e1e/#e5a860 · red #3a2020/#f0a0a0 (border #5a3030) · green #1a3a24/#6ae08a · neutral #373d45/#b0b8c4.
- **Light theme:** overrides in `colors.css` under `[data-theme="light"]`.
- **Type:** Roboto 300–700 for UI; Roboto Mono for paths, numbers, hashes and code. Common sizes: .58–.62rem (labels and eyebrows, 600 uppercase .5px), .7–.8rem (body and table), .84rem (chat), .95–1.05rem (titles), 1–1.2rem mono (stats), 3.4rem/300 (health score).
- **Spacing:** 2/4/6/8/12/16/20/24px. Cards use 12–16px padding; grid gaps are 10–16px.
- **Radii:** 3–4px controls · 6px inputs/tiles · 8px cards · 12px modals · 999px pills.
- **Shadows:** card `0 1px 3px rgba(0,0,0,.4)` · modal `0 4px 20px rgba(0,0,0,.5)`.
- **Layout:** titlebar 32 · statusbar 24 · sidebar 250/50 · inspectors 320–380 · explorer 250.

## Assets
- `prototype/assets/logo.svg`: the Ombuto mark (from the design system).
- Icons: Material Design Icons webfont (`@mdi/font`, linked in `tokens/fonts.css`). Icon names appear as `mdi-*` in the prototype markup.
- No raster imagery. Charts and graphs are plain DOM/SVG and should be re-implemented (e.g. with d3-hierarchy for the treemap, or a small SVG layer for the git graph).

## Files
- `prototype/Codebase Insight.dc.html`: the full prototype. Markup per screen sits in `<sc-if value="{{ is.<screen> }}">` blocks. All sample data and view-model logic is in the `Component` class at the bottom of the file (constants such as `FILES`, `DEPS`, `MODS`, `EDGES`, `CXFN`, `GIT`, plus `renderVals()` / `more()`).
- `prototype/support.js`: the runtime needed to open the prototype in a browser. Not for production.
- `prototype/_ds/ombuto-code-design-system-…/`: the design-system tokens, component CSS and component bundle used by the prototype.

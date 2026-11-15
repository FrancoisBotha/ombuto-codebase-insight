# Ombuto Code Design System

Ombuto Code is an open-source agentic AI coding workflow manager, built as an Electron + Vue 3 desktop app. Coding agents (Claude, Codex, Kimi) pick up tickets and run them through an execute → test → evaluate → merge loop. A human then reviews the result: approve, or reject with a comment.

**Sources:** local codebase `.ombutocode/` (renderer: `src/src/renderer/assets/main.css`, `titlebar.css`, `App.vue`, `components/BoardList.vue`, `KanbanColumn.vue`, `StatusBar.vue`, `SettingsView.vue`), the repo https://github.com/FrancoisBotha/ombutocode, and seven marketing gallery screenshots (`assets/gallery/`). Explore the repo for more views than this system covers.

## Products
- **Desktop app**: title bar, a Plan / Build / Review sidebar, a seven-column kanban board (To Do, In Progress, Testing, EVAL, Merging, Review, Done), a workspace with git and terminals, specs tools, and logs.
- **Marketing gallery**: dark 1270-wide frames, each with a green mono eyebrow pill, a bold Roboto headline and a product screenshot.

## Content fundamentals
- Terse, plain and technical. Headlines are short declaratives that end in a period: "Code. Test. Fix. Repeat." / "One command. Free and open source."
- Second person is used sparingly ("ready for you"). The product talks about *agents* and *tickets*, never "AI magic".
- UI labels are Title Case ("Ticket Details", "Move to Review"). Column headers and detail labels are UPPERCASE with tracking. Ticket IDs are SCREAMING-KEBAB plus a number (QORG-002).
- Tooltips explain consequences: "Reject — move back to TODO with comment". Em dashes are common.
- No emoji. Unicode glyphs appear only in the status bar (✓ ↑ ↓ ⬆).

## Visual foundations
- **Dark-first.** Backgrounds are #161a1f, the board is #1e2228, cards are #21262d, tickets are #282d35, and the sidebar is navy-ink #1a2030. Borders are #373d45, with 6% white for chrome dividers.
- **Accent:** mint #6dd4a0 marks active nav (tab text, a 3px left border, and an 8–12% tint). Marketing uses #3cc77a. Teal #2dd4bf is for focus, info and live states. Primary buttons are #0f8a7e.
- **Badges** are tonal: a deep tinted background with pastel text (running = #3a3520/#e5c46a, completed = #1a3a24/#6ae08a, failed = #3a2020/#f0a0a0, queued = #1e2a3a/#7eb8e5). They are uppercase, 0.7rem/600, in 999px pills.
- **Type:** Roboto 300–700. Text is dense: tickets are 0.875rem/600, IDs 0.75rem muted, nav 0.72–0.85rem at weight 300. Mono (SFMono/Consolas, substituted by Roboto Mono) is used for paths, branches and marketing eyebrows.
- **Radii:** 3–4px for controls, 6px for tickets and inputs, 8px for columns and the window, 12px for modals, 999px for pills and round icon buttons.
- **Shadows:** small and dark (0 1px 2–3px rgba(0,0,0,.3–.4)). Modals use 0 4px 20px rgba(0,0,0,.5). There are no glows.
- **Motion:** 0.12–0.3s ease, used for colour and background transitions only. Modals use fadeIn (translateY 10px, 0.2s). Only the state badge scales on hover (1.05).
- **Hover:** surfaces step one shade lighter (#2d333b → #373d45 → #444c56). Ticket borders turn blue #5b9bd5. Outline icons fill with their own colour.
- **Imagery** is product screenshots only. No illustrations, gradients or textures, apart from the logo's mint gradient and one amber warning dialog.
- **Layout:** fixed 32px title bar, fixed 24px status bar, and a 250px sidebar that collapses to 50px. The board scrolls horizontally with 1.5rem gaps.

## Iconography
The app uses Material Design Icons (`@mdi/font` webfont from CDN, `<span class="mdi mdi-…">`), linked in `tokens/fonts.css`. Common icons include map-outline, hammer-wrench, clipboard-check-outline, view-column, source-branch, archive-arrow-down, clock-outline, stethoscope and lightning-bolt. The info button is a custom italic Georgia "i" in a teal ring. Logos are in `assets/` (`logo.svg` for the title bar, plus solid, hollow and no-background variants and PNG icons). The mark is a mint droplet / quarter-circle shape.

## Fonts
Roboto comes from Google Fonts, as in the app. **Substitution:** Roboto Mono stands in for the system mono stack and the marketing eyebrow face. No font binaries were in the repo.

## Components
- core: Button, ChipButton, IconButton, Badge, CountPill
- forms: Input, Select
- board: TaskCard, KanbanColumn
- navigation: TitleBar, Sidebar, StatusBar
- feedback: Modal, DetailRow, EvalCheck
- marketing: Eyebrow

**Intentional addition:** Eyebrow, extracted from the marketing screenshots (it has no source component).

## Index
`styles.css` (imports `tokens/*.css`) · `components/` · `assets/` · `SKILL.md`. **Not yet built:** foundation specimen cards, UI kits (`ui_kits/desktop-app`, gallery), `thumbnail.html`, `github.md`.

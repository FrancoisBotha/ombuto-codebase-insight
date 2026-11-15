# PRD: Ombuto Codebase Insight

## 1. What It Is
A desktop app that analyses a local git repository. It shows where the risk,
complexity and knowledge gaps are, and why. It combines the code's structure
with its git history to give a short list of priorities rather than raw
totals. You can then ask questions about the code and get answers that cite
the lines they come from. All analysis runs on your machine and doesn't need
AI. AI answers and explanations are optional, and they're always shown
separately from computed facts. It is a sibling product to Ombuto Code.

## 2. Who Will Use It
A working developer or tech lead who has just joined, inherited or been asked
to review an existing codebase. Typically it's tens to hundreds of thousands of
lines, several years of git history, and authors who may have left. They're
comfortable with git and the terminal, and they use the app at a desk in the
first days or weeks with the code. Their problem is that line counts and
linters don't tell them where to look first. They need to know which files are
risky, which parts only one person understands, and how the modules actually
depend on each other. They also can't, or won't, upload company code to a
cloud service to find out.

## 3. Must-Have Features
- Open and analyse a repo — pick a local folder or a recent repo; see
  progress, explore partial results early; results are cached so reopening is
  instant.
- Overview — a health score, the top hotspots and a short list of key risks,
  each linking to its detail.
- Hotspots and history — a churn × complexity map, ownership and bus factor,
  files that change together without importing each other, and a commit
  history view.
- Structure — a module dependency graph with cycles, fan-in/fan-out and
  instability per module.
- Complexity and quality — per-function complexity with a long-tail view, size
  distribution, duplication, dead code, language-specific smells, doc/TODO
  gaps and missing tests.
- Dependencies and secrets — outdated, vulnerable, deprecated or oddly
  licensed packages, and a local scan for committed secrets.
- Ask the codebase — questions answered with citations to specific lines;
  explanations of hotspots and commits on request; all clearly labelled AI.

Every feature drills down to a per-file view showing that file's code,
metrics, history and dependencies.

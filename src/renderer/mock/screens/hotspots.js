// Screen-local sample data for the "hotspots" screen (inline values from the prototype's more()).
// Export names must be prefixed with the screen id in caps, e.g. HOTSPOTS_ROWS, to avoid collisions.

/** Co-change coupling scores for the three "Changes Together With" rows. */
export const HOTSPOTS_COCHANGE_SCORES = ['0.71', '0.44', '0.29'];
export const HOTSPOTS_COCHANGE_WIDTHS = ['71%', '44%', '29%'];

/** Canned AI explanation for src/billing/invoice.ts. */
export const HOTSPOTS_INVOICE_EXPLAIN = 'invoice.ts is the riskiest file in the repo: 48 changes in 90 days on a function with cyclomatic complexity 61. Nine of the last twelve commits edit the same loop in buildInvoice — the proration and bundle branches — and those branches have no direct tests. Changes also ripple: tax.ts changes in the same commit 71% of the time, so the two behave like one module split across files.';
export const HOTSPOTS_INVOICE_SUGGESTION = 'Split line-item construction from tax computation, and add tests for plan changes and bundles first.';
export const HOTSPOTS_DEFAULT_SUGGESTION = 'Assign a reviewing owner and cover the most-edited function with tests.';

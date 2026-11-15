// Screen-local sample data for the "complexity" screen (inline arrays from the prototype's more()).
// Export names must be prefixed with the screen id in caps, e.g. COMPLEXITY_ROWS, to avoid collisions.

/** Histogram buckets: [label, lower bound, function count]. */
export const COMPLEXITY_BUCKETS = [['1–2', 1, 612], ['3–5', 3, 401], ['6–10', 6, 179], ['11–15', 11, 18], ['16–20', 16, 9], ['21–30', 21, 10], ['31+', 31, 4]];
/** Functions over a given threshold. */
export const COMPLEXITY_OVER = { 10: 41, 15: 23, 20: 14, 30: 4 };
/** Total complexity above 10 across all functions. */
export const COMPLEXITY_EXCESS_TOTAL = 356;
export const COMPLEXITY_TAIL_OTHERS = '29 other functions';
/** Summary strip: [label, value, sub]. Labels starting "Over" get the current threshold appended. */
export const COMPLEXITY_STATS = [['Functions', '1,284', '612 files'], ['Median CC', '3', 'unchanged'], ['P90 CC', '9', '▲ 1 this quarter'], ['Over W', null, 'warning'], ['Over C', null, 'critical'], ['Avg MI', '68', 'maintainability index']];
/** Functions over 20, monthly for 12 months. */
export const COMPLEXITY_TREND = [9, 9, 10, 10, 11, 11, 12, 12, 12, 13, 13, 14];

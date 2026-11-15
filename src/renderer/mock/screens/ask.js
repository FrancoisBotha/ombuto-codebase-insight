// Screen-local sample data for the "ask" screen (inline arrays from the prototype's more()).
// Export names are prefixed ASK_ to avoid collisions.

// Opening question shown in the seeded conversation.
export const ASK_Q0 = 'Where is auth handled?';
// Thinking-state step list: [label, icon].
export const ASK_THINKING_STEPS = [['Searched symbol index for “auth”, “session”','mdi-check'],['Read 4 files · 41 lines','mdi-check'],['Writing answer','mdi-loading mdi-spin']];
// Follow-up chips under the conversation.
export const ASK_FOLLOWUPS = ['Is there CSRF protection?','Show every route without requireAuth','Who owns auth?'];

<script setup>
// Shared "Prototype" banner (Epic 1, FR-010). Shown on every screen, and every
// Settings section, whose data still comes from src/renderer/mock/. The epic
// that wires a screen to insight.db removes the banner from that screen.
//
// A slim, full-width strip that sits directly under the screen header. It uses
// the info tone tokens (--om-tone-blue-*), which are defined for both themes,
// and adds nothing to the layout beyond its own height.
</script>

<template>
  <div class="om-prototype-banner" role="note" style="display:flex;align-items:center;gap:8px;padding:5px 20px;font-size:.72rem;line-height:1.4;background:var(--om-tone-blue-bg);color:var(--om-tone-blue-fg);border-bottom:1px solid var(--om-border);flex-shrink:0">
    <span class="mdi mdi-flask-outline" aria-hidden="true" style="font-size:.9rem"></span>
    <span>Prototype — this screen shows sample data, not your repository</span>
  </div>
</template>

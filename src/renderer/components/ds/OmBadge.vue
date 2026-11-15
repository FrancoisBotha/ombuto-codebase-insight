<script setup>
// Ombuto Code Design System Badge (port of the DS bundle's React Badge).
// The prototype only uses kind="flag" with an explicit tone.
defineProps({
  kind: { type: String, default: 'state' },
  tone: { type: String, default: 'neutral' },
  icon: { type: String, default: '' },
});
</script>

<template>
  <span :class="['om-badge', 'om-badge--' + kind, 'om-tone-' + (tone || 'neutral')]">
    <span v-if="icon" :class="'mdi mdi-' + icon"></span><slot />
  </span>
</template>

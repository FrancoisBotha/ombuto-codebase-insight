<script setup>
// Ombuto Code Design System Button (port of the DS bundle's React Button).
defineProps({
  variant: { type: String, default: 'primary' },
  size: { type: String, default: 'md' },
  icon: { type: String, default: '' },
});
</script>

<template>
  <button :class="['om-btn', 'om-btn--' + variant, size === 'dialog' && 'om-btn--dialog']">
    <span v-if="icon" :class="'mdi mdi-' + icon"></span><slot />
  </button>
</template>

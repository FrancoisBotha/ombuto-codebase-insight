<script setup>
import { onMounted } from 'vue';
import { useAppStore } from './stores/appStore.js';

const appStore = useAppStore();
onMounted(() => appStore.loadAppInfo());
</script>

<template>
  <main class="app">
    <h1>Ombuto Codebase Insight</h1>
    <p v-if="appStore.version" class="version">v{{ appStore.version }}</p>
  </main>
</template>

<style scoped>
.app {
  padding: 24px;
}
.version {
  opacity: 0.6;
}
</style>

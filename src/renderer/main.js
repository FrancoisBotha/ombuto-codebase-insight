import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';
import { hoverStyle } from './lib/hoverStyle.js';
// Fonts and icons bundled locally (the prototype loaded them from Google Fonts / jsDelivr).
import '@fontsource/roboto/300.css';
import '@fontsource/roboto/400.css';
import '@fontsource/roboto/500.css';
import '@fontsource/roboto/600.css';
import '@fontsource/roboto/700.css';
import '@fontsource/roboto-mono/400.css';
import '@fontsource/roboto-mono/500.css';
import '@fontsource/roboto-mono/700.css';
import '@mdi/font/css/materialdesignicons.css';
import './assets/main.css';

createApp(App).use(createPinia()).directive('hover', hoverStyle).mount('#app');

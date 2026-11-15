import { defineStore } from 'pinia';

export const useAppStore = defineStore('app', {
  state: () => ({ name: '', version: '' }),
  actions: {
    async loadAppInfo() {
      const info = await window.insight?.getAppInfo();
      if (info) {
        this.name = info.name;
        this.version = info.version;
      }
    },
  },
});

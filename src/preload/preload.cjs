// Preload bridge. Must be CommonJS: sandboxed preloads cannot be ES modules.
// Exposes a narrow, read-only API to the renderer.
const { contextBridge, ipcRenderer } = require('electron');

// Keep in sync with src/shared/ipcChannels.js (a sandboxed preload cannot import ESM).
const IPC = { APP_INFO: 'app:info' };

contextBridge.exposeInMainWorld('insight', {
  getAppInfo: () => ipcRenderer.invoke(IPC.APP_INFO),
});

// Preload bridge. Must be CommonJS: sandboxed preloads cannot be ES modules.
// Exposes a narrow, read-only API to the renderer, plus window controls for
// the custom title bar.
const { contextBridge, ipcRenderer } = require('electron');

// Keep in sync with src/shared/ipcChannels.js (a sandboxed preload cannot import ESM).
const IPC = {
  APP_INFO: 'app:info',
  WINDOW_MINIMIZE: 'window:minimize',
  WINDOW_TOGGLE_MAXIMIZE: 'window:toggle-maximize',
  WINDOW_CLOSE: 'window:close',
};

contextBridge.exposeInMainWorld('insight', {
  getAppInfo: () => ipcRenderer.invoke(IPC.APP_INFO),
  window: {
    minimize: () => ipcRenderer.send(IPC.WINDOW_MINIMIZE),
    toggleMaximize: () => ipcRenderer.send(IPC.WINDOW_TOGGLE_MAXIMIZE),
    close: () => ipcRenderer.send(IPC.WINDOW_CLOSE),
  },
});

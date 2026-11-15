// Electron main process: owns the window, settings, recent repos,
// starts pipeline runs and serves read-only IPC queries.
import { app, BrowserWindow, ipcMain, utilityProcess } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC } from '../shared/ipcChannels.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL;

let pipelineWorker = null;

function startPipelineWorker() {
  pipelineWorker = utilityProcess.fork(path.join(__dirname, '../worker/pipeline.js'), [], {
    serviceName: 'insight-pipeline',
  });
  pipelineWorker.on('exit', () => {
    pipelineWorker = null;
  });
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.cjs'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  win.once('ready-to-show', () => win.show());

  if (devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(path.join(__dirname, '../../dist/renderer/index.html'));
  }
}

ipcMain.handle(IPC.APP_INFO, () => ({
  name: app.getName(),
  version: app.getVersion(),
}));

app.whenReady().then(() => {
  startPipelineWorker();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  pipelineWorker?.kill();
});

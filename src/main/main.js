// Electron main process: owns the window, settings, recent repos,
// starts pipeline runs and serves read-only IPC queries (Architecture §3).
//
// The logic lives in Electron-free modules so it can be unit tested:
//   src/main/repo/openRepo.js            validate → HEAD → recents → run or ready
//   src/main/pipeline/workerManager.js   fork, forward events, fail runs on crash
//   src/main/queries/*.js                read-only SQL over insight.db
// This file only wires them to Electron: dialog, windows, ipcMain, utilityProcess.
import { app, BrowserWindow, dialog, ipcMain, utilityProcess } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { IPC, WORKER_MSG } from '../shared/ipcChannels.js';
import { checkGit } from '../shared/git/checkGit.js';
import { configureInsightDb, openInsightDb, removeRepoData } from '../shared/db/insightDb.js';
import { openRecentsStore } from './repo/recentsStore.js';
import { createRepoOpener } from './repo/openRepo.js';
import { createWorkerManager } from './pipeline/workerManager.js';
import { getRepoInfo, getRunStatus } from './queries/repoQueries.js';
import { getInventory } from './queries/inventoryQueries.js';
import { getFileTree, getFileContent, searchFilePaths } from './queries/fileQueries.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const devServerUrl = process.env.VITE_DEV_SERVER_URL;

let recents = null;
let opener = null;
let workerManager = null;

// --- current repo session ------------------------------------------------------
// One readonly connection to the open repo's insight.db, opened lazily (the
// worker creates the file on the first run) and closed when the repo changes.

let session = { repoId: null, db: null };

function closeSessionDb() {
  if (session.db?.open) session.db.close();
  session = { repoId: null, db: null };
}

/** Readonly db for the current repo, or null when there is no repo or no database yet. */
function sessionDb() {
  const repo = opener?.current();
  if (!repo) {
    closeSessionDb();
    return null;
  }
  if (session.db?.open && session.repoId === repo.repoId) return session.db;
  closeSessionDb();
  try {
    session = { repoId: repo.repoId, db: openInsightDb(repo.path, { readonly: true }) };
    return session.db;
  } catch {
    return null; // not created yet (first run still starting) or unreadable
  }
}

/** Runs a query against the current repo's database at its HEAD; null when not available. */
function query(fn) {
  const repo = opener?.current();
  const db = sessionDb();
  if (!repo || !db) return null;
  return fn(db, repo);
}

function broadcast(channel, payload) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, payload);
  }
}

function onWorkerEvent(event) {
  if (event.type === WORKER_MSG.RUN_COMPLETED && event.repoId) recents?.touch(event.repoId);
  broadcast(IPC.RUN_EVENT, event);
}

// --- argument guards (the renderer is on the other side of a trust boundary) --

function requireString(value, name) {
  if (typeof value !== 'string' || value === '') throw new TypeError(`${name} must be a non-empty string`);
  return value;
}

function optionalLimit(value) {
  return value === undefined ? undefined : Number(value);
}

// --- window --------------------------------------------------------------------

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    show: false,
    // Frameless: the renderer draws the prototype's own title bar and window buttons.
    frame: false,
    backgroundColor: '#161a1f',
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
  return win;
}

// Window controls for the custom title bar.
ipcMain.on(IPC.WINDOW_MINIMIZE, (e) => BrowserWindow.fromWebContents(e.sender)?.minimize());
ipcMain.on(IPC.WINDOW_TOGGLE_MAXIMIZE, (e) => {
  const win = BrowserWindow.fromWebContents(e.sender);
  if (win) win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on(IPC.WINDOW_CLOSE, (e) => BrowserWindow.fromWebContents(e.sender)?.close());

ipcMain.handle(IPC.APP_INFO, () => ({
  name: app.getName(),
  version: app.getVersion(),
}));

// --- Welcome: git check, open, recents -----------------------------------------

ipcMain.handle(IPC.GIT_CHECK, () => checkGit());

ipcMain.handle(IPC.REPO_OPEN_DIALOG, async (e) => {
  const win = BrowserWindow.fromWebContents(e.sender) ?? undefined;
  const picked = await dialog.showOpenDialog(win, {
    title: 'Open a git repository',
    properties: ['openDirectory'],
  });
  if (picked.canceled || picked.filePaths.length === 0) return { ok: false, reason: 'cancelled', message: '' };
  return openRepo(picked.filePaths[0]);
});

ipcMain.handle(IPC.REPO_OPEN_PATH, (_e, folderPath) => openRepo(requireString(folderPath, 'path')));

async function openRepo(folderPath) {
  const result = await opener.open(folderPath);
  // The session follows the opener: a new repo gets a fresh readonly connection.
  if (result.ok && session.repoId !== result.repo.repoId) closeSessionDb();
  return result;
}

ipcMain.handle(IPC.RECENTS_LIST, () => recents.list());

ipcMain.handle(IPC.RECENTS_REMOVE, async (_e, repoId) => {
  requireString(repoId, 'repoId');
  if (workerManager.isRunning(repoId)) {
    return { ok: false, message: 'This repository is being analysed. Wait for the run to finish, then remove it.', recents: recents.list() };
  }
  // Close any handle main holds before deleting the folder (Windows won't
  // delete an open database file).
  if (session.repoId === repoId) closeSessionDb();
  if (opener.current()?.repoId === repoId) opener.close();
  try {
    await recents.remove(repoId, (entry) => removeRepoData(entry.repoId));
    return { ok: true, recents: recents.list() };
  } catch (err) {
    return { ok: false, message: `Could not delete the repository data: ${err?.message ?? err}`, recents: recents.list() };
  }
});

// --- Indexing: run status, events, refresh -------------------------------------

ipcMain.handle(IPC.RUN_STATUS, () => query((db) => getRunStatus(db)));

ipcMain.handle(IPC.REPO_REFRESH, () => opener.refresh());

// --- Title bar / sidebar / status bar ------------------------------------------

ipcMain.handle(IPC.REPO_INFO, () => {
  const repo = opener.current();
  if (!repo) return null;
  const fromDb = query((db) => getRepoInfo(db, repo.headSha));
  return {
    ...repo,
    analysedAt: fromDb?.analysedAt ?? null,
    fileCount: fromDb?.fileCount ?? 0,
    lastRun: fromDb?.lastRun ?? null,
  };
});

// --- Size & Inventory, Files, palette search -----------------------------------

ipcMain.handle(IPC.INVENTORY, (_e, options) =>
  query((db, repo) =>
    getInventory(db, repo.headSha, {
      largestLimit: optionalLimit(options?.largestLimit),
      folderDepth: optionalLimit(options?.folderDepth),
      folderLimit: optionalLimit(options?.folderLimit),
    }),
  ),
);

ipcMain.handle(IPC.FILE_TREE, () => query((db, repo) => getFileTree(db, repo.headSha)));

ipcMain.handle(IPC.FILE_CONTENT, (_e, filePath) => {
  requireString(filePath, 'path');
  return query((db, repo) => getFileContent(db, repo.headSha, filePath));
});

ipcMain.handle(IPC.FILE_SEARCH, (_e, q, limit) => {
  if (typeof q !== 'string') throw new TypeError('query must be a string');
  return query((db, repo) => searchFilePaths(db, repo.headSha, q, { limit: optionalLimit(limit) })) ?? [];
});

// --- lifecycle -------------------------------------------------------------------

app.whenReady().then(async () => {
  const userDataPath = app.getPath('userData');
  configureInsightDb({ userDataPath });
  recents = await openRecentsStore();
  workerManager = createWorkerManager({
    fork: () =>
      utilityProcess.fork(path.join(__dirname, '../worker/pipeline.js'), [], {
        serviceName: 'insight-pipeline',
      }),
    userDataPath,
    onEvent: onWorkerEvent,
  });
  opener = createRepoOpener({
    recents,
    userDataPath,
    startRun: (msg) => workerManager.startRun(msg),
  });

  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  closeSessionDb();
  workerManager?.dispose();
});

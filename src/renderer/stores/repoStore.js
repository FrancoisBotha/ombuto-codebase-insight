// The open repository and its pipeline run, as seen by the renderer (epic 1
// FR-001..FR-004, FR-006, UI notes §6). Every fact comes through the data seam
// (src/renderer/data/insightData.js → window.insight); this store only keeps
// the latest answer and folds worker events into the run model
// (src/renderer/lib/indexingModel.js). Welcome, Indexing, the title bar, the
// sidebar and the status bar all read from here.
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { WORKER_MSG } from '../../shared/ipcChannels.js';
import { useInsightStore } from './insightStore.js';
import {
  checkGit, listRecents, removeRecent, openRepoDialog, openRepoPath, openDroppedFolder,
  refreshRepo, getRepoInfo, getRunStatus, onRunEvent,
} from '../data/insightData.js';
import { emptyRun, runFromStatus, applyRunEvent, overallProgress, canExplore, readyItems } from '../lib/indexingModel.js';

export const useRepoStore = defineStore('repo', () => {
  const insight = useInsightStore();

  /** RepoSummary of the open repo (path, repoId, name, headSha, branch, …) or null. */
  const repo = ref(null);
  /** REPO_INFO answer: analysedAt, fileCount, lastRun (plus the summary) or null. */
  const info = ref(null);
  /** The run model for the Indexing screen. */
  const run = ref(emptyRun());
  /** GIT_CHECK answer, null until checked. */
  const git = ref(null);
  /** Recent repositories, most recently opened first. */
  const recents = ref([]);
  /** Message from the last failed open/remove, shown on Welcome. */
  const openError = ref(null);
  /** True while an open/refresh call is in flight. */
  const busy = ref(false);

  const gitMissing = computed(() => git.value !== null && !git.value.available);
  const canOpen = computed(() => !gitMissing.value && !busy.value);
  const progress = computed(() => overallProgress(run.value));
  const exploring = computed(() => canExplore(run.value));
  const ready = computed(() => readyItems(run.value));
  const indexing = computed(() => run.value.status === 'running');

  let unsubscribe = null;

  function handleEvent(event) {
    if (!event || typeof event.type !== 'string') return;
    if (repo.value && event.repoId && event.repoId !== repo.value.repoId) return;
    run.value = applyRunEvent(run.value, event);
    if (event.type === WORKER_MSG.RUN_COMPLETED) {
      loadInfo();
      loadRecents();
      // The end of a run lands on Size & Inventory (UI notes §6).
      if (insight.scr === 'indexing') insight.go('inventory');
    } else if (event.type === WORKER_MSG.RUN_FAILED) {
      loadInfo();
    }
  }

  /** Subscribe to worker events (once, from the app shell). */
  function start() {
    if (unsubscribe) return;
    unsubscribe = onRunEvent(handleEvent);
  }

  function stop() {
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  }

  async function loadInfo() {
    if (!repo.value) {
      info.value = null;
      return null;
    }
    info.value = await getRepoInfo();
    return info.value;
  }

  async function loadRecents() {
    recents.value = (await listRecents()) || [];
    return recents.value;
  }

  /** Welcome screen data: git availability and the recents list. */
  async function loadWelcome() {
    const [g] = await Promise.all([checkGit(), loadRecents()]);
    git.value = g;
    return g;
  }

  /**
   * Seeds the run model from pipeline:status when the Indexing screen mounts
   * without a run in memory (app restart, mid-run navigation). A RUN_STARTED
   * event that arrived meanwhile wins.
   */
  async function ensureRun() {
    if (run.value.runId !== null) return run.value;
    const status = await getRunStatus();
    if (run.value.runId === null && status) run.value = runFromStatus(status);
    return run.value;
  }

  /**
   * Applies an OpenResult: records the repo, resets the run model and
   * navigates (ready → Size & Inventory, indexing → Indexing). Errors other
   * than a cancelled dialog are kept in `openError` (Welcome) or toasted.
   */
  async function setOpened(result) {
    if (!result || !result.ok) {
      if (result?.reason !== 'cancelled') {
        const message = result?.message || 'Could not open the repository.';
        if (insight.scr === 'welcome') openError.value = message;
        else insight.toast(message);
      }
      return result;
    }
    openError.value = null;
    repo.value = result.repo;
    run.value = result.status === 'ready' ? runFromStatus(result.run) : emptyRun();
    await loadInfo();
    insight.go(result.status === 'ready' ? 'inventory' : 'indexing');
    return result;
  }

  async function guardedOpen(call) {
    if (!canOpen.value) return null;
    busy.value = true;
    try {
      return await setOpened(await call());
    } finally {
      busy.value = false;
    }
  }

  /** FR-001: Open Folder… button and ⌘O. */
  const openDialog = () => guardedOpen(openRepoDialog);
  /** FR-003: a recent row. */
  const openPath = (folderPath) => guardedOpen(() => openRepoPath(folderPath));
  /** FR-001: a folder dropped on the Welcome drop zone. */
  const openDropped = (file) => guardedOpen(() => openDroppedFolder(file));

  /** Sidebar footer refresh and ⌘R: full re-run of the open repo. */
  async function refresh() {
    if (!repo.value || busy.value) return null;
    busy.value = true;
    try {
      const result = await refreshRepo();
      if (!result?.ok) {
        insight.toast(result?.message || 'Could not re-analyse the repository.');
        return result;
      }
      repo.value = result.repo;
      run.value = emptyRun();
      insight.go('indexing');
      await loadInfo();
      return result;
    } finally {
      busy.value = false;
    }
  }

  /** FR-003: Remove from recents (deletes that repo's insight.db folder). */
  async function remove(repoId) {
    const result = await removeRecent(repoId);
    if (Array.isArray(result?.recents)) recents.value = result.recents;
    else recents.value = recents.value.filter((r) => r.repoId !== repoId);
    if (result?.ok) {
      openError.value = null;
      if (repo.value?.repoId === repoId) {
        repo.value = null;
        info.value = null;
        run.value = emptyRun();
      }
    } else {
      openError.value = result?.message || 'Could not remove the repository.';
    }
    return result;
  }

  return {
    repo, info, run, git, recents, openError, busy,
    gitMissing, canOpen, progress, exploring, ready, indexing,
    start, stop, loadWelcome, loadInfo, loadRecents, ensureRun, setOpened,
    openDialog, openPath, openDropped, refresh, remove,
  };
});

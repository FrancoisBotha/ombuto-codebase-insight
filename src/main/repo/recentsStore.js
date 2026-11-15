// Recent repositories (epic 1 FR-003), persisted with electron-store.
//
// Each entry: { path, repoId, displayName, lastAnalysedAt, lastOpenedAt }
// (times are ISO-8601 strings; lastAnalysedAt is null until the first run).
// Entries are keyed by repoId, the stable id of the checkout (see the
// database module). `createRecentsStore` takes any object with `get`/`set`
// so unit tests can use an in-memory store; `openRecentsStore` wires the real
// electron-store.

export const MAX_RECENTS = 20;
const KEY = 'recents';

function basename(p) {
  const trimmed = String(p).replace(/[\\/]+$/, '');
  const i = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return i >= 0 ? trimmed.slice(i + 1) : trimmed;
}

function byMostRecentlyOpened(a, b) {
  return String(b.lastOpenedAt ?? '').localeCompare(String(a.lastOpenedAt ?? ''));
}

/**
 * @param {object} options
 * @param {{get: Function, set: Function}} options.store  electron-store or any get/set object
 * @param {() => string} [options.now]                    ISO timestamp source (tests)
 */
export function createRecentsStore({ store, now = () => new Date().toISOString() }) {
  if (!store || typeof store.get !== 'function' || typeof store.set !== 'function') {
    throw new TypeError('createRecentsStore needs a store with get(key, default) and set(key, value)');
  }

  const read = () => {
    const value = store.get(KEY, []);
    return Array.isArray(value) ? value.map((e) => ({ ...e })) : [];
  };
  const write = (entries) => {
    const sorted = [...entries].sort(byMostRecentlyOpened).slice(0, MAX_RECENTS);
    store.set(KEY, sorted);
    return sorted;
  };

  return {
    /** All entries, most recently opened first. */
    list() {
      return read().sort(byMostRecentlyOpened);
    },

    /** One entry by repoId, or null. */
    get(repoId) {
      return read().find((e) => e.repoId === repoId) ?? null;
    },

    /**
     * Adds or updates the entry for `repoId` and marks it opened now.
     * `lastAnalysedAt` is kept from the existing entry when not given.
     */
    upsert({ path: repoPath, repoId, displayName, lastAnalysedAt }) {
      if (typeof repoPath !== 'string' || repoPath === '') throw new TypeError('upsert requires a path');
      if (typeof repoId !== 'string' || repoId === '') throw new TypeError('upsert requires a repoId');

      const entries = read();
      const existing = entries.find((e) => e.repoId === repoId);
      const entry = {
        path: repoPath,
        repoId,
        displayName: displayName || basename(repoPath) || repoPath,
        lastAnalysedAt: lastAnalysedAt ?? existing?.lastAnalysedAt ?? null,
        lastOpenedAt: now(),
      };
      const rest = entries.filter((e) => e.repoId !== repoId);
      write([entry, ...rest]);
      return entry;
    },

    /**
     * Marks the repo opened now and records its last-analysed time
     * (defaults to now). Returns the updated entry, or null if unknown.
     */
    touch(repoId, { lastAnalysedAt } = {}) {
      const entries = read();
      const entry = entries.find((e) => e.repoId === repoId);
      if (!entry) return null;
      const stamp = now();
      entry.lastOpenedAt = stamp;
      entry.lastAnalysedAt = lastAnalysedAt ?? stamp;
      write(entries);
      return { ...entry };
    },

    /**
     * Removes the entry. If `onRemove(entry)` is given it runs first (the
     * caller uses it to delete the repo's data folder); if it throws, the
     * entry is kept so the user can retry, and the error is rethrown.
     * Returns the removed entry, or null if unknown.
     */
    async remove(repoId, onRemove) {
      const entries = read();
      const entry = entries.find((e) => e.repoId === repoId);
      if (!entry) return null;
      if (typeof onRemove === 'function') {
        await onRemove({ ...entry });
      }
      write(entries.filter((e) => e.repoId !== repoId));
      return { ...entry };
    },
  };
}

/**
 * Opens the persistent recents store backed by electron-store. In the Electron
 * main process `cwd` may be omitted (defaults to userData); outside Electron
 * (tests) pass an absolute `cwd`.
 *
 * @param {object} [options]
 * @param {string} [options.cwd]
 * @param {string} [options.name]  file name without extension (default 'recents')
 * @param {() => string} [options.now]
 */
export async function openRecentsStore({ cwd, name = 'recents', now } = {}) {
  const { default: ElectronStore } = await import('electron-store');
  const store = new ElectronStore({
    name,
    ...(cwd ? { cwd } : {}),
    defaults: { [KEY]: [] },
  });
  return createRecentsStore({ store, now });
}

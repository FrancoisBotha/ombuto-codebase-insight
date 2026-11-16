// Read-only file queries for the Files view and the command palette (FR-008):
// the explorer tree, one file's content and path search, all over
// raw_tree_entry / raw_blob / raw_blob_content for one commit. Nothing writes.

export const DEFAULT_SEARCH_LIMIT = 50;
const SEARCH_CANDIDATES = 2000;

const FILE_COLUMNS = `
  t.path, t.blob_sha, b.language, b.line_count, b.size_bytes, b.is_binary, b.is_generated`;

function fileFromRow(r) {
  return {
    path: r.path,
    blobSha: r.blob_sha,
    language: r.language,
    lines: r.line_count,
    bytes: r.size_bytes,
    isBinary: r.is_binary === 1,
    isGenerated: r.is_generated === 1,
  };
}

function assertPath(p, what = 'path') {
  if (typeof p !== 'string') throw new TypeError(`fileQueries: ${what} must be a string`);
}

/** Code-point order, like `git ls-tree`: 'App.vue' sorts before 'app.js'. */
function byName(a, b) {
  if (a.type !== b.type) return a.type === 'dir' ? -1 : 1;
  return a.name < b.name ? -1 : a.name > b.name ? 1 : 0;
}

/**
 * Builds a nested explorer tree from flat file rows. Pure. Folders come first
 * at each level, then files, both in code-point order. Every folder carries
 * the file count, lines and bytes of everything beneath it.
 *
 * @param {Array<{path: string, blobSha?: string, language: string|null, lines: number, bytes: number,
 *                isBinary: boolean, isGenerated: boolean}>} files
 */
export function buildFileTree(files) {
  const root = { type: 'dir', name: '', path: '', children: [], fileCount: 0, lines: 0, bytes: 0 };
  const dirs = new Map([['', root]]);

  const dirFor = (dirPath) => {
    let dir = dirs.get(dirPath);
    if (dir) return dir;
    const slash = dirPath.lastIndexOf('/');
    const parent = dirFor(slash === -1 ? '' : dirPath.slice(0, slash));
    dir = { type: 'dir', name: dirPath.slice(slash + 1), path: dirPath, children: [], fileCount: 0, lines: 0, bytes: 0 };
    parent.children.push(dir);
    dirs.set(dirPath, dir);
    return dir;
  };

  for (const f of files) {
    const slash = f.path.lastIndexOf('/');
    const dirPath = slash === -1 ? '' : f.path.slice(0, slash);
    const dir = dirFor(dirPath);
    dir.children.push({
      type: 'file',
      name: f.path.slice(slash + 1),
      path: f.path,
      language: f.language ?? null,
      lines: f.lines,
      bytes: f.bytes,
      isBinary: Boolean(f.isBinary),
      isGenerated: Boolean(f.isGenerated),
    });
    // Roll the file up into every ancestor folder, ending at the root.
    let d = dirPath;
    for (;;) {
      const node = dirs.get(d);
      node.fileCount += 1;
      node.lines += f.lines;
      node.bytes += f.bytes;
      if (d === '') break;
      const up = d.lastIndexOf('/');
      d = up === -1 ? '' : d.slice(0, up);
    }
  }

  for (const dir of dirs.values()) dir.children.sort(byName);
  return root;
}

/**
 * The explorer tree for a commit.
 * @returns {{commitSha: string, fileCount: number, children: Array<object>}}
 */
export function getFileTree(db, commitSha) {
  const rows = db
    .prepare(
      `SELECT ${FILE_COLUMNS}
       FROM raw_tree_entry t JOIN raw_blob b ON b.blob_sha = t.blob_sha
       WHERE t.commit_sha = ? ORDER BY t.path`,
    )
    .all(commitSha);
  const tree = buildFileTree(rows.map(fileFromRow));
  return { commitSha, fileCount: tree.fileCount, lines: tree.lines, bytes: tree.bytes, children: tree.children };
}

/**
 * One file at a commit with its content (null for binary files), or null when
 * the path is not tracked at that commit.
 *
 * @returns {{path: string, blobSha: string, language: string|null, lines: number, bytes: number,
 *            isBinary: boolean, isGenerated: boolean, content: string|null} | null}
 */
export function getFileContent(db, commitSha, filePath) {
  assertPath(filePath);
  const row = db
    .prepare(
      `SELECT ${FILE_COLUMNS}, c.content
       FROM raw_tree_entry t
       JOIN raw_blob b ON b.blob_sha = t.blob_sha
       LEFT JOIN raw_blob_content c ON c.blob_sha = b.blob_sha
       WHERE t.commit_sha = ? AND t.path = ?`,
    )
    .get(commitSha, filePath);
  if (!row) return null;
  return { ...fileFromRow(row), content: row.is_binary === 1 ? null : row.content ?? null };
}

function escapeLike(s) {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

/**
 * Case-insensitive substring search over tracked paths for the command
 * palette. Ranked: file name starts with the query, then file name contains
 * it, then only the folder part matches; ties go to shorter paths. A blank
 * query returns nothing. `%` and `_` are matched literally.
 *
 * @returns {Array<{path: string, blobSha: string, language: string|null, lines: number, bytes: number,
 *                  isBinary: boolean, isGenerated: boolean}>}
 */
export function searchFilePaths(db, commitSha, query, { limit = DEFAULT_SEARCH_LIMIT } = {}) {
  assertPath(query, 'query');
  const q = query.trim().toLowerCase();
  if (q === '' || /^[%_\\\s]+$/.test(q)) return [];
  const max = Number.isFinite(Number(limit)) && Number(limit) > 0 ? Math.min(Math.floor(Number(limit)), 500) : DEFAULT_SEARCH_LIMIT;

  const rows = db
    .prepare(
      `SELECT ${FILE_COLUMNS}
       FROM raw_tree_entry t JOIN raw_blob b ON b.blob_sha = t.blob_sha
       WHERE t.commit_sha = ? AND lower(t.path) LIKE ? ESCAPE '\\'
       ORDER BY length(t.path), t.path
       LIMIT ?`,
    )
    .all(commitSha, `%${escapeLike(q)}%`, SEARCH_CANDIDATES);

  const scored = rows.map((r) => {
    const name = r.path.slice(r.path.lastIndexOf('/') + 1).toLowerCase();
    const rank = name.startsWith(q) ? 0 : name.includes(q) ? 1 : 2;
    return { rank, row: r };
  });
  scored.sort((a, b) => a.rank - b.rank || a.row.path.length - b.row.path.length || (a.row.path < b.row.path ? -1 : 1));
  return scored.slice(0, max).map((s) => fileFromRow(s.row));
}

// Language by file extension (FR-005). Pure data, no I/O.
//
// Language ids for parseable languages match the grammar ids in
// resources/grammars/grammars.json and the raw_blob.language values in
// docs/Data Model/Schema.ddl (javascript | typescript | tsx | python | java |
// c_sharp | go | rust | sql). The other ids are common text formats that the
// inventory reports on but nothing parses. Unknown extensions map to null.

/** Grammar ids vendored in resources/grammars/ (kept in step with grammars.json). */
export const GRAMMAR_LANGUAGES = Object.freeze([
  'c_sharp',
  'go',
  'java',
  'javascript',
  'python',
  'rust',
  'sql',
  'tsx',
  'typescript',
]);

/** Lower-case extension (with the dot) → language id. */
export const LANGUAGE_BY_EXTENSION = Object.freeze({
  // --- grammars ---------------------------------------------------------------
  '.cs': 'c_sharp',
  '.csx': 'c_sharp',
  '.go': 'go',
  '.java': 'java',
  '.js': 'javascript',
  '.mjs': 'javascript',
  '.cjs': 'javascript',
  '.jsx': 'javascript',
  '.py': 'python',
  '.pyi': 'python',
  '.pyw': 'python',
  '.rs': 'rust',
  '.sql': 'sql',
  '.ddl': 'sql',
  '.dml': 'sql',
  '.psql': 'sql',
  '.tsx': 'tsx',
  '.ts': 'typescript',
  '.mts': 'typescript',
  '.cts': 'typescript',
  // --- common text formats ----------------------------------------------------
  '.json': 'json',
  '.jsonc': 'json',
  '.json5': 'json',
  '.yml': 'yaml',
  '.yaml': 'yaml',
  '.md': 'markdown',
  '.markdown': 'markdown',
  '.mdx': 'markdown',
  '.html': 'html',
  '.htm': 'html',
  '.xhtml': 'html',
  '.css': 'css',
  '.scss': 'scss',
  '.sass': 'scss',
  '.less': 'less',
  '.xml': 'xml',
  '.xsd': 'xml',
  '.xsl': 'xml',
  '.xslt': 'xml',
  '.svg': 'xml',
  '.csproj': 'xml',
  '.vbproj': 'xml',
  '.fsproj': 'xml',
  '.props': 'xml',
  '.targets': 'xml',
  '.sln': 'text',
  '.sh': 'shell',
  '.bash': 'shell',
  '.zsh': 'shell',
  '.ksh': 'shell',
  '.ps1': 'powershell',
  '.psm1': 'powershell',
  '.psd1': 'powershell',
  '.bat': 'batch',
  '.cmd': 'batch',
  '.toml': 'toml',
  '.ini': 'ini',
  '.cfg': 'ini',
  '.conf': 'ini',
  '.properties': 'properties',
  '.env': 'dotenv',
  '.txt': 'text',
  '.text': 'text',
  '.log': 'text',
  '.csv': 'csv',
  '.tsv': 'csv',
  '.vue': 'vue',
  '.svelte': 'svelte',
  '.graphql': 'graphql',
  '.gql': 'graphql',
  '.proto': 'protobuf',
  '.tf': 'terraform',
  '.hcl': 'terraform',
  '.dockerfile': 'dockerfile',
  '.mk': 'makefile',
  '.gradle': 'groovy',
  '.groovy': 'groovy',
  '.kt': 'kotlin',
  '.kts': 'kotlin',
  '.scala': 'scala',
  '.rb': 'ruby',
  '.php': 'php',
  '.swift': 'swift',
  '.m': 'objective_c',
  '.c': 'c',
  '.h': 'c',
  '.cc': 'cpp',
  '.cpp': 'cpp',
  '.cxx': 'cpp',
  '.hpp': 'cpp',
  '.hh': 'cpp',
  '.lua': 'lua',
  '.r': 'r',
  '.dart': 'dart',
  '.ex': 'elixir',
  '.exs': 'elixir',
  '.erl': 'erlang',
  '.hs': 'haskell',
  '.clj': 'clojure',
  '.pl': 'perl',
  '.pm': 'perl',
  '.vb': 'visual_basic',
  '.fs': 'fsharp',
  '.fsx': 'fsharp',
  '.tex': 'latex',
  '.rst': 'restructuredtext',
  '.adoc': 'asciidoc',
  '.org': 'org',
  '.nix': 'nix',
  '.cmake': 'cmake',
  '.editorconfig': 'ini',
  '.gitignore': 'gitignore',
  '.gitattributes': 'gitattributes',
  '.npmrc': 'ini',
  '.nvmrc': 'text',
  '.prettierrc': 'json',
  '.eslintrc': 'json',
  '.babelrc': 'json',
});

/** Exact file name (case-sensitive) → language id, for extensionless files. */
export const LANGUAGE_BY_FILENAME = Object.freeze({
  Dockerfile: 'dockerfile',
  Containerfile: 'dockerfile',
  Makefile: 'makefile',
  GNUmakefile: 'makefile',
  makefile: 'makefile',
  'CMakeLists.txt': 'cmake',
  Jenkinsfile: 'groovy',
  Vagrantfile: 'ruby',
  Gemfile: 'ruby',
  Rakefile: 'ruby',
  Brewfile: 'ruby',
  Procfile: 'text',
  LICENSE: 'text',
  LICENCE: 'text',
  COPYING: 'text',
  NOTICE: 'text',
  README: 'text',
  CHANGELOG: 'text',
  AUTHORS: 'text',
  CONTRIBUTORS: 'text',
  CODEOWNERS: 'text',
  '.gitignore': 'gitignore',
  '.gitattributes': 'gitattributes',
  '.gitmodules': 'ini',
  '.dockerignore': 'gitignore',
  '.npmignore': 'gitignore',
  '.eslintignore': 'gitignore',
  '.prettierignore': 'gitignore',
  '.editorconfig': 'ini',
  '.npmrc': 'ini',
  '.nvmrc': 'text',
  '.env': 'dotenv',
  '.babelrc': 'json',
  '.eslintrc': 'json',
  '.prettierrc': 'json',
});

/**
 * Language id for a repo-relative path, or null when the extension and file
 * name are both unknown. Looks at the exact base name first (Dockerfile,
 * .gitignore), then the extension, case-insensitively.
 *
 * @param {string} filePath  forward- or backslash-separated path
 * @returns {string|null}
 */
export function languageForPath(filePath) {
  if (typeof filePath !== 'string' || filePath === '') return null;
  const slash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'));
  const base = slash === -1 ? filePath : filePath.slice(slash + 1);
  if (base === '') return null;

  if (Object.prototype.hasOwnProperty.call(LANGUAGE_BY_FILENAME, base)) return LANGUAGE_BY_FILENAME[base];

  const dot = base.lastIndexOf('.');
  if (dot <= 0) return null; // no extension, or a dot-file with no further extension
  const ext = base.slice(dot).toLowerCase();
  return Object.prototype.hasOwnProperty.call(LANGUAGE_BY_EXTENSION, ext) ? LANGUAGE_BY_EXTENSION[ext] : null;
}

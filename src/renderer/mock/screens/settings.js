// Screen-local sample data for the "settings" screen (inline arrays from the prototype's renderVals/more).
// Export names must be prefixed with the screen id in caps, e.g. SETTINGS_ROWS, to avoid collisions.

/** Default toggle values (prototype: S.tg || {...}). */
export const SETTINGS_TOGGLES = { history: true, secrets: true, summaries: true, branch: false, confirm: true, redact: true };

/** [id, label, bin, version, path] */
export const SETTINGS_CLIS = [['claude','Claude Code','claude','2.0.14','~/.local/bin/claude'],['codex','Codex CLI','codex','0.46.0','/opt/homebrew/bin/codex'],['gemini','Gemini CLI','gemini','','']];

/** [id, title, description, icon] */
export const SETTINGS_PROVIDERS = [['local','Local · Ollama','Runs on this machine. Nothing is sent over the network.','laptop'],['openrouter','OpenRouter','One key for Anthropic, OpenAI, Google and open models. Snippets are sent via openrouter.ai.','router-network'],['cloud','Direct API','Use one provider’s API key directly. Snippets are sent to that provider.','cloud-outline'],['cli','Local CLI','Reuse a coding CLI already signed in here — Claude Code, Codex or Gemini CLI.','console']];

export const SETTINGS_ACTIVE_NAMES = { local: 'Local · Ollama', openrouter: 'OpenRouter', cloud: 'Direct API', cli: 'Local CLI' };

export const SETTINGS_SENT_LOCAL = ['Your question','Retrieved snippets (≤ 40 lines each)','File paths and computed metrics'];
export const SETTINGS_SENT_REMOTE = ['Your question','Up to 12 retrieved snippets, ≤ 40 lines each','File paths and computed metrics','Commit messages, when you ask about history'];
export const SETTINGS_NEVER = ['The full repository or any file not cited','Files matching ignored paths','Detected secrets — redacted as ••••','.env files and author email addresses'];

/** [language, files, detected] */
export const SETTINGS_LANGS = [['TypeScript','481 files',true],['SQL','38 files',true],['YAML','44 files',true],['Shell','21 files',true],['Markdown','28 files',false]];

/** [id, label, icon] */
export const SETTINGS_THEMES = [['light','Light','white-balance-sunny'],['dark','Dark','weather-night']];

export const SETTINGS_SWATCHES = ['#d32f2f','#c2185b','#7b1fa2','#303f9f','#1976d2','#0097a7','#00796b','#388e3c','#e64a19','#5d4037','#880e4f','#512da8','#1a237e','#0288d1','#1b5e20','#827717','#f57c00','#455a64','#263238','#616161'];

export const SETTINGS_KEYS = [['Command palette','⌘K'],['Go to section','⌘1 – ⌘9'],['Ask the codebase','⌘J'],['Re-analyse','⌘R'],['Toggle drawer','⌘B'],['Open repository','⌘O'],['Settings','⌘,']];

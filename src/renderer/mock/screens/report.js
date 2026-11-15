// Screen-local sample data for the "report" screen (inline arrays from the prototype's renderVals/more).
// Export names must be prefixed with the screen id in caps, e.g. REPORT_ROWS, to avoid collisions.

/** [id, label, value, colour] */
export const REPORT_BADGES = [['health','health','72 / 100','#e5a830'],['hotspots','hotspots','3 critical','#e06060'],['cycles','cycles','3','#e06060'],['coverage','coverage','68%','#3cc77a']];

/** [section key, label] */
export const REPORT_SECTIONS = [['summary','Executive summary'],['health','Health breakdown'],['hotspots','Top hotspots'],['risks','Key risks'],['deps','Dependency health'],['ai','AI narrative']];

export const REPORT_SUBSCORES = [['Maintainability',68],['Modularity',61],['Test coverage',68],['Dependency risk',54],['Knowledge spread',76]];

/** [label, icon] */
export const REPORT_EXPORTS = [['PDF','file-pdf-box'],['HTML','language-html5'],['Markdown','language-markdown-outline']];

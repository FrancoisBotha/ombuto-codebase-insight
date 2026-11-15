// Screen-local sample data, copied verbatim from the prototype's renderVals().
export const OVERVIEW_LANGS=[['TypeScript',78,'#5b9bd5'],['SQL',9,'#e5c46a'],['YAML',6,'#6dd4a0'],['Shell',4,'#818cf8'],['Other',3,'#5a6270']];
export const OVERVIEW_SUMMARY=[['Lines','48,212','612 files'],['Contributors','23','7 active · 90d'],['Age','4y 2m','since Aug 2022'],['Commits','8,412','63 last 14d'],['Coverage','68%','▼ 3% this month'],['Cycles','3','14 import sites']];
export const OVERVIEW_SUBSCORES=[['Maintainability',68],['Modularity',61],['Test coverage',68],['Dependency risk',54],['Knowledge spread',76]];
// [severity, title, detail, screen, deep-link state]
export const OVERVIEW_RISKS=[['critical','2 critical vulnerabilities','node-forge 1.3.0 · crypto-js 4.1.1','deps',{depFilter:'vuln'}],['critical','Cycle: billing ↔ orders','14 import sites · blocks independent deploys','architecture',{node:'billing',arch:'module'}],['warning','Bus factor 1 in 2 files','auth/oauth.ts 93% · infra/db/client.ts 90%','hotspots',{metric:'own',sel:'src/auth/oauth.ts'}],['warning','2 more cycles','auth ↔ users · config ↔ utils','architecture',{node:'auth'}],['warning','Possible secret in fixtures','test/fixtures/stripe.json:4 — sk_test_…','file'],['info','12 unused exports','dead code across 7 files','file']];
// [label, screen, deep-link state]
export const OVERVIEW_ACTIVITY_CHIPS=[['#412 proration rewrite','file'],['invoice.ts','file'],['session.ts','hotspots',{sel:'src/auth/session.ts'}]];

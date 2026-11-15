// Screen-local sample data for the "file" screen (inline arrays from the prototype's more()).
// Export names are prefixed FILE_ to avoid collisions.

// Blame age (days) per line for invoice.ts, and for every other previewed file.
export const FILE_BLAME_INVOICE = (n) => (n <= 5 ? 700 : n >= 19 && n <= 24 ? 3 : n >= 13 && n <= 16 ? 48 : n >= 33 && n <= 39 ? 12 : 410);
export const FILE_BLAME_DEFAULT = (n) => [3, 48, 120, 410][(n * 7) % 4];

// Folders that sit in an import cycle.
export const FILE_CYC = {'src/billing':'CYCLE · orders','src/orders':'CYCLE · billing','src/auth':'CYCLE · users','src/users':'CYCLE · auth'};

// Metric tiles for invoice.ts (and unknown files): [label, value, sub, sub colour].
export const FILE_INVOICE_TILES = [['Cyclomatic','61','▲ 13 in 30d','var(--om-danger)'],['Cognitive','88','high','var(--om-warning)'],['Lines','812','12 functions','var(--om-text-muted)'],['Coverage','54%','▼ 9% in 30d','var(--om-danger)'],['Churn · 90d','48','commits','var(--om-text-muted)'],['Duplication','6%','2 blocks','var(--om-text-muted)']];

// Function table: [name, lines, cyclomatic, cognitive].
export const FILE_FNS = [['buildInvoice','13–42',14,22],['applyCredits','118–171',11,17],['finalizeInvoice','190–236',9,12],['voidInvoice','244–270',6,7],['renderLineItems','301–352',5,6],['toStripePayload','360–402',4,4]];

// Commits per month, Nov ’25 → Oct ’26.
export const FILE_MONTHS = [3,1,4,2,5,2,6,3,4,7,9,12];

// Imports: [specifier, path, inCycle]; importers: [path, inCycle].
export const FILE_IMPORTS = [['../shared/money','src/shared/money.ts',false],['./tax','src/billing/tax.ts',false],['./proration','src/billing/proration.ts',false],['../infra/db/client','src/infra/db/client.ts',false],['../shared/logger','src/shared/logger.ts',false]];
export const FILE_IMPORTERS = [['src/orders/checkout.ts',true],['src/api/routes.ts',false],['src/graphql/resolvers.ts',false],['src/infra/queue/jobs.ts',false],['test/billing/invoice.test.ts',false]];

// Files shown in the explorer that are not part of the hotspot sample.
export const FILE_EXTRA = ['package.json','tsconfig.json','docker-compose.yml','README.md','test/billing/invoice.test.ts','test/billing/tax.test.ts','test/auth/session.test.ts','migrations/0001_init.sql','migrations/0007_payments.sql'];

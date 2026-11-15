// Sample data for the fictional repository "harbor-api".
// Temporary: replaced by read-only IPC queries against insight.db in later tickets.
// Views must import it through src/renderer/data/insightData.js, never directly.
// Extracted verbatim from the prototype (docs/References/Ombuto Codebase Insight prototype,
// "Codebase Insight.dc.html"). See docs/Architecture/prototype-port.md.
import { hash } from '../lib/random.js';

export const AUTHORS=['m.okafor','j.lindqvist','a.reyes','p.nair','s.cho','t.becker','l.dubois','r.haddad','k.osei','e.varga','d.kim','h.moreau'];
export const RAW=[
['src/billing','invoice.ts',812,48,61,4,82,7],['src/billing','tax.ts',420,31,38,9,91,3],['src/billing','proration.ts',360,22,44,14,95,2],['src/billing','currency.ts',140,6,9,30,60,4],['src/billing','webhooks.ts',290,27,29,6,70,5],
['src/orders','checkout.ts',690,41,52,3,55,9],['src/orders','cart.ts',380,18,24,11,48,6],['src/orders','fulfilment.ts',450,12,31,22,88,2],['src/orders','refunds.ts',260,15,27,8,76,3],['src/orders','status.ts',120,4,8,26,50,4],
['src/auth','session.ts',540,36,47,5,64,6],['src/auth','oauth.ts',410,19,33,13,93,1],['src/auth','tokens.ts',220,14,18,10,71,4],['src/auth','permissions.ts',330,9,21,28,85,2],
['src/users','profile.ts',300,11,15,17,45,7],['src/users','preferences.ts',150,5,7,34,52,5],['src/users','invites.ts',210,8,13,19,80,2],
['src/api','routes.ts',480,29,22,2,38,11],['src/api','middleware.ts',260,17,19,7,47,8],['src/api','validators.ts',340,13,16,12,44,9],['src/api','errors.ts',110,6,5,25,40,6],
['src/graphql','schema.ts',520,21,12,6,42,8],['src/graphql','resolvers.ts',610,24,35,5,58,7],
['src/infra/db','client.ts',230,7,14,31,90,1],['src/infra/db','migrations.ts',390,16,6,2,35,10],['src/infra/db','repo.ts',470,12,28,15,66,4],
['src/infra/queue','worker.ts',350,14,30,9,83,2],['src/infra/queue','jobs.ts',280,10,17,16,77,3],
['src/shared','utils.ts',260,20,14,20,33,12],['src/shared','logger.ts',120,5,6,36,41,7],['src/shared','config.ts',180,23,11,4,30,10]];
export const FILES=RAW.map(([dir,name,loc,churn,cx,age,own,authors])=>({dir,name,path:dir+'/'+name,loc,churn,cx,age,own,authors}));
FILES.forEach(f=>{f.bugs=Math.max(0,Math.round(f.churn*(.08+(hash(f.path)%25)/100)))});
export const INVOICE=`import { Money, Currency } from '../shared/money';
import { TaxRegion, resolveTaxRate } from './tax';
import { prorate } from './proration';
import { db } from '../infra/db/client';
import { logger } from '../shared/logger';

export interface InvoiceLine {
  sku: string;
  qty: number;
  unit: Money;
}

export async function buildInvoice(orderId: string, region: TaxRegion) {
  const order = await db.orders.findById(orderId);
  if (!order) throw new Error(\`order \${orderId} not found\`);
  const lines: InvoiceLine[] = [];
  for (const item of order.items) {
    if (item.qty <= 0) continue;
    const unit = item.override ?? item.price;
    if (order.plan && order.plan.changedAt) {
      // mid-cycle plan change: split into two prorated lines
      const [before, after] = prorate(unit, order.plan.changedAt, order.periodEnd);
      lines.push({ sku: item.sku, qty: item.qty, unit: before });
      lines.push({ sku: item.sku + ':new', qty: item.qty, unit: after });
    } else if (item.bundle) {
      for (const child of item.bundle.children) {
        lines.push({ sku: child.sku, qty: item.qty * child.qty, unit: child.price });
      }
    } else {
      lines.push({ sku: item.sku, qty: item.qty, unit });
    }
  }
  const rate = resolveTaxRate(region, order.shipping?.country);
  const subtotal = lines.reduce((sum, l) => sum + l.unit.cents * l.qty, 0);
  const tax = Math.round(subtotal * rate);
  if (tax < 0 || Number.isNaN(tax)) {
    logger.warn('invoice.tax.invalid', { orderId, rate });
    return { lines, subtotal, tax: 0, total: subtotal };
  }
  return { lines, subtotal, tax, total: subtotal + tax };
}`;
export const SNIPS={
 session:{path:'src/auth/session.ts',start:1,code:`import { randomBytes, timingSafeEqual } from 'crypto';
import { redis } from '../infra/cache';
import { config } from '../shared/config';
import { users } from '../users/profile';

export const TTL = config.session.ttlSeconds;

export async function createSession(userId: string, ip: string) {
  const id = randomBytes(32).toString('base64url');
  await redis.set(\`sess:\${id}\`, JSON.stringify({ userId, ip }), 'EX', TTL);
  return id;
}

export async function readSession(token?: string) {
  if (!token) return null;
  const raw = await redis.get(\`sess:\${token}\`);
  if (!raw) return null;
  const session = JSON.parse(raw);
  const user = await users.findById(session.userId);
  if (!user || user.disabled) return null;
  await redis.expire(\`sess:\${token}\`, TTL); // sliding expiry
  return { ...session, user };
}

export function sameToken(a: string, b: string) {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}`},
 middleware:{path:'src/api/middleware.ts',start:1,code:`import type { Request, Response, NextFunction } from 'express';
import { readSession } from '../auth/session';
import { can } from '../auth/permissions';

export function requireAuth(scope?: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const token = req.cookies['hb_session'] ?? req.header('x-session');
    const session = await readSession(token);
    if (!session) return res.status(401).json({ error: 'unauthenticated' });
    if (scope && !can(session.user, scope)) {
      return res.status(403).json({ error: 'forbidden', scope });
    }
    req.session = session;
    next();
  };
}`},
 permissions:{path:'src/auth/permissions.ts',start:36,code:`type Role = 'owner' | 'admin' | 'support';

export const ROLE_SCOPES: Record<Role, string[]> = {
  owner: ['*'],
  admin: ['orders:*', 'billing:*', 'users:read'],
  support: ['orders:read', 'users:read'],
};

export function can(user: User, scope: string) {
  const granted = ROLE_SCOPES[user.role] ?? [];
  return granted.some((g) =>
    g === '*' || g === scope || (g.endsWith(':*') && scope.startsWith(g.slice(0, -1))));
}`}};
export const CITES=[{snip:'session',a:8,b:11},{snip:'session',a:14,b:23},{snip:'middleware',a:5,b:15},{snip:'permissions',a:38,b:48}];
export const ANSWER=[
 {text:'Authentication is session-based. createSession issues a random 32-byte token stored in Redis with a TTL; readSession resolves the token to a user, rejects disabled accounts and slides the expiry on every read.',cites:[0,1]},
 {text:'Every protected route passes through requireAuth in the API middleware. It reads the hb_session cookie (falling back to an x-session header) and returns 401 when no session exists.',cites:[2]},
 {text:'Authorisation is a separate step: can() matches the user’s role against a static scope table. There is no per-resource ownership check here — that happens inside individual resolvers, which is worth verifying.',cites:[3]}];
SNIPS.invoice={path:'src/billing/invoice.ts',start:1,code:INVOICE};
CITES.push({snip:'invoice',a:13,b:31},{snip:'invoice',a:33,b:41});
export const ANSWER2=[
 {text:'Checkout calls buildInvoice(orderId, region) after the payment intent is created. It loads the order, then walks each item: a mid-cycle plan change is split into two prorated lines, and bundles expand into their child SKUs.',cites:[4]},
 {text:'Tax is resolved per region (falling back to the shipping country), applied to the subtotal and rounded. A negative or NaN tax is logged and silently zeroed — that path has no test and is worth covering.',cites:[5]}];
export const STARTERS=['Where is auth handled?','How does an order become an invoice?','Which modules talk to Stripe?','What changed in billing this month?','Where are environment variables read?','Give me an onboarding tour of the API layer'];
export const DEPS=[
 ['express','4.18.2','5.1.0','major',null,'MIT',208,'2025-03-31',14],['lodash','4.17.20','4.17.21','patch',['high','Prototype pollution in zipObjectDeep'],'MIT',1400,'2021-02-20',22],
 ['jsonwebtoken','8.5.1','9.0.2','major',['high','Insecure key type acceptance'],'MIT',43,'2023-08-30',6],['axios','1.6.0','1.7.9','minor',['high','SSRF via path-relative URLs'],'MIT',1900,'2024-12-11',9],
 ['pg','8.11.3','8.13.1','minor',null,'MIT',92,'2024-10-22',5],['zod','3.22.4','3.24.1','minor',null,'MIT',610,'2024-12-10',31],
 ['stripe','12.18.0','17.5.0','major',null,'MIT',3100,'2024-12-19',4],['bullmq','4.12.0','5.34.2','major',null,'MIT',1900,'2024-12-20',3],
 ['ioredis','5.3.2','5.4.2','minor',null,'MIT',410,'2024-12-12',4],['pino','8.16.0','9.6.0','major',null,'MIT',620,'2024-12-17',18],
 ['graphql','16.8.1','16.10.0','minor',null,'MIT',1300,'2024-12-15',7],['dayjs','1.11.13','1.11.13','current',null,'MIT',670,'2024-08-20',12],
 ['sharp','0.32.6','0.33.5','minor',['medium','Heap overflow in libvips (bundled)'],'Apache-2.0',7400,'2024-08-16',2],['node-forge','1.3.0','1.3.1','patch',['critical','RSA signature verification bypass'],'BSD-3-Clause',1600,'2022-03-17',1],
 ['ua-parser-js','0.7.31','2.0.0','major',null,'MIT',220,'2024-12-01',2,'Latest is AGPL-3.0'],['crypto-js','4.1.1','4.2.0','patch',['critical','Weak PBKDF2 defaults (1 iteration, SHA-1)'],'MIT',480,'2023-10-24',3],
 ['uuid','9.0.1','11.0.5','major',null,'MIT',130,'2025-01-09',16],['left-pad','1.3.0','1.3.0','deprecated',null,'WTFPL',3,'2018-04-09',1]];
export const MODS=[
 {id:'routes',c:'api',x:170,y:130,files:4,loc:'1.2k'},{id:'middleware',c:'api',x:170,y:270,files:3,loc:'0.6k'},{id:'graphql',c:'api',x:170,y:410,files:2,loc:'1.1k'},
 {id:'billing',c:'domain',x:420,y:130,files:5,loc:'2.0k'},{id:'orders',c:'domain',x:580,y:210,files:5,loc:'1.9k'},{id:'auth',c:'domain',x:420,y:330,files:4,loc:'1.5k'},{id:'users',c:'domain',x:580,y:410,files:3,loc:'0.7k'},
 {id:'db',c:'infra',x:840,y:130,files:3,loc:'1.1k'},{id:'queue',c:'infra',x:840,y:260,files:2,loc:'0.6k'},{id:'cache',c:'infra',x:840,y:390,files:1,loc:'0.2k'},{id:'config',c:'infra',x:840,y:520,files:1,loc:'0.2k'},
 {id:'errors',c:'shared',x:370,y:545,files:1,loc:'0.1k'},{id:'utils',c:'shared',x:500,y:545,files:1,loc:'0.3k'},{id:'logger',c:'shared',x:630,y:545,files:1,loc:'0.1k'}];
export const CLUSTERS=[{id:'api',x:80,y:70,w:180,h:410},{id:'domain',x:320,y:70,w:370,h:410},{id:'infra',x:750,y:70,w:180,h:510},{id:'shared',x:300,y:500,w:410,h:80}];
export const EDGES='routes>orders routes>billing routes>auth middleware>auth graphql>orders graphql>users orders>billing billing>orders billing>db orders>db orders>queue auth>users users>auth auth>cache users>db queue>config db>config billing>utils orders>logger utils>logger auth>config billing>errors routes>errors config>utils utils>config middleware>logger'.split(' ').map(s=>s.split('>'));
export const MODSUM={billing:'Builds invoices, computes tax and prorates plan changes. Receives Stripe events through webhooks.ts. Imports orders to read order state — the source of the billing ↔ orders cycle.',orders:'Cart, checkout and fulfilment. Calls billing to price an order, then enqueues fulfilment jobs on the queue.',auth:'Redis-backed sessions, OAuth login and role-based scopes. Most API routes depend on it through requireAuth.',users:'Profiles, preferences and invites. Imports auth to check permissions, which closes the auth ↔ users cycle.',config:'Reads environment variables once at startup and exposes a typed config object. Depends on utils for parsing, and utils reads config — a small cycle.'};
export const CLS={billing:[['InvoiceBuilder',1,0,.72],['TaxCalculator',2,1,.21],['ProrationPolicy',1,2,.35],['WebhookHandler',3,0,.64]],orders:[['CheckoutService',1,0,.81],['Cart',1,0,.12],['RefundPolicy',2,0,.3]],auth:[['SessionStore',1,0,.18],['OAuthClient',2,0,.44]],users:[['UserProfile',1,0,.1]],db:[['Repository',1,6,.25]],queue:[['Worker',2,0,.4]]};
export const C4=[{id:'customer',kind:'person',x:500,y:70,t:'Customer',s:'Person',d:'Buys and manages subscriptions'},{id:'web',kind:'ext-sys',x:260,y:210,t:'Storefront',s:'Container · Next.js',d:'Separate repo: ledger-web'},{id:'api',kind:'sys',x:500,y:330,t:'Harbor API',s:'Container · Node.js / TypeScript',d:'REST + GraphQL, this repo'},{id:'worker',kind:'sys',x:800,y:450,t:'Job Worker',s:'Container · BullMQ',d:'Fulfilment, emails, retries'},{id:'pg',kind:'db',x:260,y:500,t:'PostgreSQL',s:'Database',d:'Orders, users, billing'},{id:'redis',kind:'db',x:540,y:520,t:'Redis',s:'Cache / Queue',d:'Sessions and job queue'},{id:'stripe',kind:'ext',x:830,y:210,t:'Stripe',s:'External System',d:'Payments and invoices'}];
export const C4E=[['customer','web','Uses','HTTPS'],['web','api','Calls','GraphQL'],['api','pg','Reads / writes','SQL'],['api','redis','Sessions, enqueues',''],['worker','redis','Consumes jobs',''],['worker','pg','Writes',''],['api','stripe','Charges','HTTPS'],['stripe','api','Webhooks','']];
export const DIAGRAMS=[
 {id:'erd',title:'Database schema',type:'ERD',icon:'database-outline',kind:'computed',src:'migrations/*.sql',meta:'6 tables · 5 relations',r:'boxes'},
 {id:'class',title:'Billing domain',type:'Class diagram',icon:'family-tree',kind:'computed',src:'src/billing/**',meta:'5 classes · 5 links',r:'boxes'},
 {id:'seq',title:'Checkout → payment',type:'Sequence',icon:'swap-horizontal',kind:'ai',src:'traced from POST /checkout',meta:'5 participants · 10 messages',r:'seq'},
 {id:'flow',title:'POST /orders',type:'Request flow',icon:'transit-connection-variant',kind:'computed',src:'src/api/routes.ts:88',meta:'5 hops',r:'seq'},
 {id:'infra',title:'Runtime infrastructure',type:'Infrastructure',icon:'server-network',kind:'ai',src:'docker-compose.yml, k8s/',meta:'5 services',r:'boxes'}];
export const BOXES={
 erd:{w:230,boxes:[{id:'users',x:60,y:40,rows:[['id','uuid','PK'],['email','text','UQ'],['name','text',''],['role','role_t',''],['created_at','timestamptz','']]},{id:'sessions',x:60,y:300,rows:[['id','text','PK'],['user_id','uuid','FK'],['ip','inet',''],['expires_at','timestamptz','']]},{id:'orders',x:380,y:40,rows:[['id','uuid','PK'],['user_id','uuid','FK'],['status','order_status',''],['total_cents','int',''],['created_at','timestamptz','']]},{id:'order_items',x:380,y:300,rows:[['id','uuid','PK'],['order_id','uuid','FK'],['product_id','uuid','FK'],['qty','int',''],['price_cents','int','']]},{id:'payments',x:700,y:40,rows:[['id','uuid','PK'],['order_id','uuid','FK'],['provider_ref','text',''],['amount_cents','int',''],['status','pay_status','']]},{id:'products',x:700,y:300,rows:[['id','uuid','PK'],['sku','text','UQ'],['name','text',''],['price_cents','int',''],['stock','int','']]}],
  links:[['sessions',1,'users',0],['orders',1,'users',0],['order_items',1,'orders',0],['order_items',2,'products',0],['payments',1,'orders',0]]},
 class:{w:230,boxes:[{id:'Invoice',x:60,y:40,rows:[['lines','InvoiceLine[]','-'],['subtotal','number','-'],['build()','Promise<Invoice>','+'],['finalize()','void','+']]},{id:'InvoiceLine',x:380,y:40,rows:[['sku','string','-'],['qty','number','-'],['unit','Money','-']]},{id:'Money',x:700,y:40,rows:[['cents','number','-'],['currency','Currency','-'],['add(m)','Money','+']]},{id:'TaxCalculator',x:60,y:300,rows:[['region','TaxRegion','-'],['rateFor(c)','number','+']]},{id:'Proration',x:380,y:300,rows:[['split(unit, at, end)','[Money, Money]','+']]}],
  links:[['Invoice',0,'InvoiceLine',0],['InvoiceLine',2,'Money',0],['Invoice',2,'TaxCalculator',0],['Invoice',2,'Proration',0],['Proration',0,'Money',2]]},
 infra:{w:230,boxes:[{id:'ingress',x:60,y:40,rows:[['nginx','1.25','svc'],['tls','cert-manager','']]},{id:'harbor-api',x:380,y:40,rows:[['replicas','3','k8s'],['port','8080',''],['env','14 vars','']]},{id:'worker',x:380,y:300,rows:[['replicas','2','k8s'],['queue','bullmq:jobs','']]},{id:'postgres',x:700,y:40,rows:[['version','15','db'],['volume','pg-data','']]},{id:'redis',x:700,y:300,rows:[['version','7','db'],['maxmemory','512mb','']]}],
  links:[['ingress',0,'harbor-api',1],['harbor-api',0,'postgres',0],['harbor-api',0,'redis',0],['worker',1,'redis',0],['worker',0,'postgres',0]]}};
export const SEQS={
 seq:{parts:['Storefront','API','Billing','Stripe','Queue'],msgs:[[0,1,'POST /checkout'],[1,2,'buildInvoice(orderId)'],[2,2,'resolveTaxRate()'],[2,1,'Invoice',1],[1,3,'paymentIntents.create'],[3,1,'requires_action',1],[1,0,'202 { clientSecret }',1],[3,1,'webhook: payment_succeeded'],[1,4,'enqueue fulfilment'],[1,3,'200 OK',1]]},
 flow:{parts:['Client','routes.ts','validators.ts','checkout.ts','db/repo.ts'],msgs:[[0,1,'POST /orders'],[1,1,'requireAuth("orders:write")'],[1,2,'orderSchema.parse(body)'],[2,1,'OrderInput',1],[1,3,'placeOrder(input)'],[3,4,'insert orders, order_items'],[4,3,'order.id',1],[3,1,'Order',1],[1,0,'201 Created',1]]}};
export const OR_MODELS=[
['anthropic/claude-sonnet-4.5','Anthropic: Claude Sonnet 4.5','Anthropic','1M',3,15,0,1],['openai/gpt-5','OpenAI: GPT-5','OpenAI','400K',1.25,10,0,1],['openai/gpt-5-mini','OpenAI: GPT-5 Mini','OpenAI','400K',.25,2,0,0],
['google/gemini-2.5-pro','Google: Gemini 2.5 Pro','Google','1M',1.25,10,0,1],['google/gemini-2.5-flash','Google: Gemini 2.5 Flash','Google','1M',.3,2.5,0,0],['x-ai/grok-4','xAI: Grok 4','xAI','256K',3,15,0,1],
['qwen/qwen3-coder','Qwen: Qwen3 Coder 480B','Qwen','262K',.22,.95,0,0],['moonshotai/kimi-k2','MoonshotAI: Kimi K2','MoonshotAI','131K',.5,2.4,0,0],['deepseek/deepseek-chat-v3.1','DeepSeek: DeepSeek V3.1','DeepSeek','164K',.2,.8,0,0],
['z-ai/glm-4.6','Z.AI: GLM 4.6','Z.AI','203K',.4,1.75,0,0],['mistralai/codestral-2508','Mistral: Codestral 2508','Mistral','256K',.3,.9,0,0],['qwen/qwen3-coder:free','Qwen: Qwen3 Coder (free)','Qwen','262K',0,0,1,0],
['deepseek/deepseek-r1:free','DeepSeek: R1 (free)','DeepSeek','164K',0,0,1,0],['meta-llama/llama-3.3-70b-instruct:free','Meta: Llama 3.3 70B Instruct (free)','Meta','131K',0,0,1,0]].map(([slug,name,vendor,ctx,pin,pout,free,sota],i)=>({slug,name,vendor,ctx,pin,pout,free:!!free,sota:!!sota,rank:i,ctxN:parseFloat(ctx)*(ctx.endsWith('M')?1000:1)}));
export const OR_DEF=['anthropic/claude-sonnet-4.5','openai/gpt-5-mini','google/gemini-2.5-flash','qwen/qwen3-coder','deepseek/deepseek-chat-v3.1'];
export const CXFN_OLD=[['placeOrder','src/orders/checkout.ts','44–212',38,61,6,41],['resolveTaxRate','src/billing/tax.ts','18–131',33,47,4,58],['handleStripeEvent','src/billing/webhooks.ts','22–160',31,40,0,62],['split','src/billing/proration.ts','30–118',29,44,2,35],['resolveOrder','src/graphql/resolvers.ts','140–233',27,36,1,66],['oauthCallback','src/auth/oauth.ts','51–148',24,31,0,22],['runJob','src/infra/queue/worker.ts','12–96',22,28,-3,70],['applyRefund','src/orders/refunds.ts','20–104',21,25,0,48],['fulfil','src/orders/fulfilment.ts','33–120',19,23,0,39],['findWithFilters','src/infra/db/repo.ts','60–140',18,24,0,81],['validateOrder','src/api/validators.ts','10–88',16,18,-2,90],['buildInvoice','src/billing/invoice.ts','13–42',14,22,5,54]];
export const CXFN=[['placeOrder','src/orders/checkout.ts','44–212',38,61,6,3,9,31,6,41],['resolveTaxRate','src/billing/tax.ts','18–131',33,47,5,2,7,38,4,58],['handleStripeEvent','src/billing/webhooks.ts','22–160',31,40,4,1,12,42,0,62],['split','src/billing/proration.ts','30–118',31,44,5,3,4,40,2,35],['resolveOrder','src/graphql/resolvers.ts','140–233',29,36,4,4,6,45,1,66],['oauthCallback','src/auth/oauth.ts','51–148',27,31,4,2,8,47,0,22],['runJob','src/infra/queue/worker.ts','12–96',26,28,3,1,5,51,-3,70],['applyRefund','src/orders/refunds.ts','20–104',24,25,3,3,6,52,0,48],['fulfil','src/orders/fulfilment.ts','33–120',24,23,3,2,3,54,0,39],['findWithFilters','src/infra/db/repo.ts','60–140',22,24,4,5,3,55,0,81],['validateOrder','src/api/validators.ts','10–88',22,20,3,1,11,58,-2,90],['mapStripeError','src/billing/webhooks.ts','170–228',21,18,2,1,14,60,0,75]];
export const CXMOD=[['billing',7.8,4,212],['orders',6.9,3,188],['auth',5.2,1,141],['infra/queue',5.5,1,64],['graphql',4.8,1,97],['infra/db',4.1,0,118],['api',3.2,0,203],['users',2.6,0,86],['shared',2.1,0,175]];
export const GIT=[['e4b7a10',1,'Proration: handle annual → monthly downgrade','m.okafor','2 hours ago',41,9,['feature/proration-v2'],''],['a91f3c2',0,'Bump zod to 3.24.1','d.kim','5 hours ago',3,3,['main','HEAD'],''],['8f01b6c',0,'Merge #418 fix/session-cookie','j.lindqvist','1 day ago',18,8,[],'merge'],['c0d4e9b',2,'Revert "Rename session cookie to hb_sid"','j.lindqvist','1 day ago',6,6,['fix/session-cookie'],'revert'],['71aa2e3',2,'Rename session cookie to hb_sid','j.lindqvist','2 days ago',6,6,[],''],['5f3d0c8',2,'Add sameToken timing-safe compare','a.reyes','2 days ago',12,2,[],''],['f18c6d0',0,'Log invalid tax computations','a.reyes','3 days ago',5,1,[],''],['a12e7f4',1,'Proration: split mid-cycle plan changes (#412)','m.okafor','3 days ago',47,15,[],''],['77be014',0,'Fix rounding on bundled items','m.okafor','4 days ago',6,4,['v2.14.0'],''],['3e6b2a9',0,'Merge #409 feature/graphql-pagination','p.nair','5 days ago',141,19,[],'merge'],['9c4e1d7',3,'Cursor pagination for orders query','p.nair','6 days ago',88,14,['feature/graphql-pagination'],''],['2a7f5e0',3,'Add pageInfo to schema','p.nair','6 days ago',22,0,[],''],['b83d9c4',3,'Extract cursor helpers','s.cho','1 week ago',31,5,[],''],['c0d4e9a',0,'Revert "Use region default when shipping missing"','j.lindqvist','1 week ago',3,9,[],'revert'],['5e2a1b7',0,'Use region default when shipping missing','j.lindqvist','1 week ago',9,3,[],''],['1d0e8f3',0,'Release 2.13.2','ci-bot','2 weeks ago',2,2,['v2.13.2'],'']].map(([h,lane,msg,author,when,add,del,refs,kind])=>({h,lane,msg,author,when,add,del,refs,kind}));
export const GFORK=[['77be014','a12e7f4'],['f18c6d0','5f3d0c8'],['c0d4e9a','b83d9c4']],GMERGE=[['8f01b6c','c0d4e9b'],['3e6b2a9','9c4e1d7']];
export const GFILES={a12e7f4:[['src/billing/invoice.ts',38,12],['src/billing/proration.ts',9,3]],e4b7a10:[['src/billing/proration.ts',29,6],['src/billing/invoice.ts',12,3]],c0d4e9b:[['src/auth/session.ts',3,3],['src/api/middleware.ts',3,3]],'71aa2e3':[['src/auth/session.ts',3,3],['src/api/middleware.ts',3,3]],'5f3d0c8':[['src/auth/session.ts',8,1],['test/auth/session.test.ts',4,1]],'8f01b6c':[['src/auth/session.ts',14,7],['src/api/middleware.ts',0,0],['test/auth/session.test.ts',4,1]],'3e6b2a9':[['src/graphql/resolvers.ts',54,10],['src/graphql/schema.ts',22,0],['src/shared/utils.ts',43,9],['test/graphql/orders.test.ts',22,0]],'9c4e1d7':[['src/graphql/resolvers.ts',54,10],['src/shared/utils.ts',12,4],['test/graphql/orders.test.ts',22,0]],f18c6d0:[['src/billing/invoice.ts',5,1]],'77be014':[['src/billing/invoice.ts',6,4]],c0d4e9a:[['src/billing/tax.ts',3,9]],'5e2a1b7':[['src/billing/tax.ts',9,3]],a91f3c2:[['package.json',1,1],['package-lock.json',2,2]]};
export const GAI={a12e7f4:'Splits a plan change in the middle of a billing period into two invoice lines, priced before and after the change. The logic sits inside buildInvoice’s main loop rather than in proration.ts, which is why invoice.ts complexity rose from 48 to 61.',c0d4e9b:'Undoes the cookie rename from the day before. Clients that already received the new hb_sid cookie would be logged out again — check whether the rename shipped before this revert.','8f01b6c':'Brings the session-cookie branch into main. The rename was reverted inside the branch, so the net effect on main is the new timing-safe sameToken helper and its test.','3e6b2a9':'Adds cursor-based pagination to the orders GraphQL query, with pageInfo on the schema and shared cursor helpers. Tests cover the happy path only.',c0d4e9a:'Reverts a fallback to the region’s default tax rate when shipping country is missing. Second revert in tax logic this month — the underlying decision looks unresolved.'};
export const COMMITS=[['a91f3c2','m.okafor','2 days ago','Proration: split mid-cycle plan changes into two lines (#412)','+38','−12'],['77be014','m.okafor','3 days ago','Fix rounding on bundled items','+6','−4'],['c0d4e9a','j.lindqvist','6 days ago','Revert "Use region default when shipping missing"','+3','−9'],['5e2a1b7','j.lindqvist','6 days ago','Use region default when shipping missing','+9','−3'],['f18c6d0','a.reyes','2 weeks ago','Log invalid tax computations','+5','−1'],['2bd90e4','m.okafor','5 weeks ago','Extract InvoiceLine type','+14','−22'],['9ae7710','p.nair','2 months ago','Support bundles in invoices','+27','−2']];

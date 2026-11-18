import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { BadRequest, Brain, NotFound } from './brain/store.ts';
import { loadConfig } from './config.ts';

const { values } = parseArgs({ options: { config: { type: 'string', default: 'config.yaml' } } });
const config = loadConfig(values.config!);

const brain = new Brain(config.brainRoot);
brain.watch();

type Env = { Variables: { user: string | null } };
const app = new Hono<Env>();

app.onError((err, c) => {
  const status = err instanceof NotFound ? 404 : err instanceof BadRequest ? 400 : 500;
  if (status === 500) console.error(err);
  return c.json({ error: err.message }, status);
});

// Accès réservé au tailnet : `tailscale serve` ajoute l'identité de l'appelant.
app.use('*', async (c, next) => {
  let user: string | null = null;
  if (config.auth.mode === 'tailscale') {
    user = c.req.header('tailscale-user-login') ?? null;
    const allowed = config.auth.allowedLogins;
    if (!user || (allowed.length && !allowed.includes(user))) return c.json({ error: 'accès refusé' }, 403);
  }
  c.set('user', user);
  await next();
});

const api = new Hono<Env>();
api.get('/me', (c) => c.json({ user: c.get('user') }));
api.get('/overview', async (c) => c.json(await brain.overview()));
api.get('/notes', async (c) => c.json(await brain.summaries()));
api.get('/note', async (c) => c.json(await brain.get(c.req.query('path') ?? '')));
api.get('/search', async (c) => {
  const q = c.req.query();
  return c.json(await brain.search(q.q ?? '', { domain: q.domain || undefined, type: q.type || undefined, status: q.status || undefined, limit: 50 }));
});
api.get('/graph', async (c) => c.json(await brain.graph()));
api.get('/commits', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 500);
  const p = c.req.query('path');
  return c.json(await brain.git.log({ limit, path: p ? brain.normalize(p) : undefined }));
});
api.get('/commit', async (c) => c.json(await brain.git.show(c.req.query('hash') ?? '')));
app.route('/api', api);
// Route d'API inconnue : erreur JSON, pas la page du dashboard.
app.all('/api/*', (c) => c.json({ error: 'route inconnue' }, 404));

// ---- Fichiers du dashboard ----
const webRoot = path.relative(process.cwd(), path.join(import.meta.dirname, '../../../web'));
app.use('/*', serveStatic({ root: webRoot }));
app.get('*', serveStatic({ root: webRoot, path: 'index.html' }));

serve({ fetch: app.fetch, hostname: config.server.host, port: config.server.port }, (info) => {
  console.log(`[ezbrain] http://${info.address}:${info.port} — mémoire ${config.brainRoot} (auth: ${config.auth.mode})`);
});

for (const sig of ['SIGINT', 'SIGTERM'] as const) {
  process.on(sig, () => {
    brain.close();
    process.exit(0);
  });
}

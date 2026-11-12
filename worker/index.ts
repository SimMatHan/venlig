import { OAuthProvider, type OAuthHelpers } from '@cloudflare/workers-oauth-provider';
import { createMcpHandler } from '@modelcontextprotocol/server';
import { Hono } from 'hono';
import { bearerAuth } from 'hono/bearer-auth';
import { timingSafeEqual } from 'hono/utils/buffer';
import { handleAuthorize, SCOPE } from './auth';
import { buildServer } from './mcp';
import { applySync, parseSyncPayload, readMeta } from './records';
import { isDue, isValidTime, isValidTimeZone } from './schedule';
import { publicKeyFromJwk, sendEmptyPush, type VapidKeys } from './webpush';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** Tokens og klienter til MCP-forbindelsens OAuth. */
  OAUTH_KV: KVNamespace;
  /** Sættes af OAuthProvider på requests til defaultHandler. */
  OAUTH_PROVIDER: OAuthHelpers;
  /** JWK-streng. Sættes med `wrangler secret put VAPID_PRIVATE_KEY`. Uden den er påmindelser slået fra. */
  VAPID_PRIVATE_KEY?: string;
  /** fx 'mailto:dig@example.com'. Sættes med `wrangler secret put VAPID_SUBJECT`. */
  VAPID_SUBJECT?: string;
  /** Langt tilfældigt token, som appen bruger til sync. Uden det er sync slået fra. */
  SYNC_TOKEN?: string;
  /** Adgangskode, når Claude forbindes til /mcp. Uden den kan MCP ikke forbindes. */
  MCP_PASSWORD?: string;
}

interface SubscriptionRow {
  endpoint: string;
  reminder_time: string;
  timezone: string;
  last_sent_date: string | null;
}

function vapidKeys(env: Env): VapidKeys | null {
  if (!env.VAPID_PRIVATE_KEY) return null;
  try {
    return { privateJwk: JSON.parse(env.VAPID_PRIVATE_KEY), subject: env.VAPID_SUBJECT ?? 'mailto:venlig@example.com' };
  } catch {
    return null;
  }
}

const app = new Hono<{ Bindings: Env }>().basePath('/api');

app.get('/health', (c) => c.json({ ok: true }));

app.get('/push/public-key', (c) => {
  const keys = vapidKeys(c.env);
  if (!keys) return c.json({ error: 'not_configured' }, 503);
  return c.json({ publicKey: publicKeyFromJwk(keys.privateJwk) });
});

app.post('/push/subscribe', async (c) => {
  const body = await c.req.json().catch(() => null);
  const sub = body?.subscription;
  const endpoint = sub?.endpoint;
  const p256dh = sub?.keys?.p256dh;
  const auth = sub?.keys?.auth;
  if (
    typeof endpoint !== 'string' ||
    !endpoint.startsWith('https://') ||
    endpoint.length > 1024 ||
    typeof p256dh !== 'string' ||
    typeof auth !== 'string' ||
    !isValidTime(body?.time) ||
    !isValidTimeZone(body?.timezone)
  ) {
    return c.json({ error: 'invalid' }, 400);
  }
  await c.env.DB.prepare(
    `INSERT INTO push_subscriptions (endpoint, p256dh, auth, reminder_time, timezone, created_at)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(endpoint) DO UPDATE SET p256dh = ?2, auth = ?3, reminder_time = ?4, timezone = ?5`,
  )
    .bind(endpoint, p256dh, auth, body.time, body.timezone, Date.now())
    .run();
  return c.json({ ok: true });
});

app.post('/push/unsubscribe', async (c) => {
  const body = await c.req.json().catch(() => null);
  if (typeof body?.endpoint !== 'string') return c.json({ error: 'invalid' }, 400);
  await c.env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1').bind(body.endpoint).run();
  return c.json({ ok: true });
});

app.use('/sync', async (c, next) => {
  if (!c.env.SYNC_TOKEN) return c.json({ error: 'not_configured' }, 503);
  await next();
});
app.use(
  '/sync',
  bearerAuth({ verifyToken: (token, c) => timingSafeEqual(token, (c.env as Env).SYNC_TOKEN ?? '') }),
);

app.get('/sync', async (c) => c.json(await readMeta(c.env.DB)));

app.post('/sync', async (c) => {
  const payload = parseSyncPayload(await c.req.json().catch(() => null));
  if (!payload) return c.json({ error: 'invalid' }, 400);
  await applySync(c.env.DB, payload);
  return c.json({ ok: true, syncedAt: Date.now() });
});

app.all('*', (c) => c.json({ error: 'not_found' }, 404));

/** MCP-endpointet. OAuthProvider har allerede tjekket tokenet, før vi kommer hertil. */
const mcpHandler = {
  async fetch(request: Request, env: Env): Promise<Response> {
    const handler = createMcpHandler(() => buildServer(env.DB));
    return handler.fetch(request);
  },
};

const defaultHandler = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const { pathname } = new URL(request.url);
    if (pathname === '/authorize') return handleAuthorize(request, env.OAUTH_PROVIDER, env.MCP_PASSWORD);
    if (pathname.startsWith('/api/')) return app.fetch(request, env, ctx);
    return env.ASSETS.fetch(request);
  },
};

// OAuth-ressourcen skal kende sin egen fulde adresse. Den kendes først ved
// første request (workers.dev, eget domæne eller localhost), så providers
// oprettes pr. origin og genbruges.
const providers = new Map<string, OAuthProvider<Env>>();
function providerFor(origin: string): OAuthProvider<Env> {
  let p = providers.get(origin);
  if (!p) {
    p = new OAuthProvider<Env>({
      apiRoute: '/mcp',
      apiHandler: mcpHandler,
      defaultHandler,
      authorizeEndpoint: '/authorize',
      tokenEndpoint: '/token',
      clientRegistrationEndpoint: '/register',
      clientIdMetadataDocumentEnabled: true,
      scopesSupported: [SCOPE],
      requiredScopes: [SCOPE],
      resourceMetadata: { resource: `${origin}/mcp`, authorization_servers: [origin] },
    });
    providers.set(origin, p);
  }
  return p;
}

async function sendDueReminders(env: Env): Promise<void> {
  const keys = vapidKeys(env);
  if (!keys) return;
  const now = new Date();
  const { results } = await env.DB.prepare(
    'SELECT endpoint, reminder_time, timezone, last_sent_date FROM push_subscriptions',
  ).all<SubscriptionRow>();

  for (const row of results) {
    if (!isDue(now, row.timezone, row.reminder_time, row.last_sent_date)) continue;
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: row.timezone }).format(now);
    try {
      const status = await sendEmptyPush(row.endpoint, keys);
      if (status === 404 || status === 410) {
        // Abonnementet findes ikke længere (appen er slettet eller tilladelsen fjernet).
        await env.DB.prepare('DELETE FROM push_subscriptions WHERE endpoint = ?1').bind(row.endpoint).run();
      } else if (status < 300) {
        await env.DB.prepare('UPDATE push_subscriptions SET last_sent_date = ?1 WHERE endpoint = ?2')
          .bind(today, row.endpoint)
          .run();
      } else {
        console.warn('push fejlede', status, new URL(row.endpoint).host);
      }
    } catch (err) {
      console.warn('push fejlede', err);
    }
  }
}

export default {
  fetch(request, env, ctx) {
    return providerFor(new URL(request.url).origin).fetch(request, env, ctx);
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(sendDueReminders(env));
  },
} satisfies ExportedHandler<Env>;

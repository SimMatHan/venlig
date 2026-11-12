import { Hono } from 'hono';
import { isDue, isValidTime, isValidTimeZone } from './schedule';
import { publicKeyFromJwk, sendEmptyPush, type VapidKeys } from './webpush';

export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  /** JWK-streng. Sættes med `wrangler secret put VAPID_PRIVATE_KEY`. Uden den er påmindelser slået fra. */
  VAPID_PRIVATE_KEY?: string;
  /** fx 'mailto:dig@example.com'. Sættes med `wrangler secret put VAPID_SUBJECT`. */
  VAPID_SUBJECT?: string;
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

app.all('*', (c) => c.json({ error: 'not_found' }, 404));

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
  fetch: app.fetch,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(sendDueReminders(env));
  },
} satisfies ExportedHandler<Env>;

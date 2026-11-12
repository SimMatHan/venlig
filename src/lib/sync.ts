import { useEffect, useState } from 'react';
import { db, TABLES, type VenligDB } from './db';

// Valgfri envejs-sync: telefonen sender en kopi af sine data til serveren, så
// Claude kan læse dem via MCP. Serveren skriver aldrig tilbage. Kun ændrede
// poster sendes; hvad der sidst blev sendt huskes som en hash pr. post.

const TOKEN_KEY = 'venlig-sync-token';
const STATE_KEY = 'venlig-sync-state';
const LAST_KEY = 'venlig-sync-last';
const DEBOUNCE_MS = 3000;

export type SyncStatus =
  | { kind: 'off' }
  | { kind: 'idle'; lastSyncedAt: number | null }
  | { kind: 'syncing' }
  | { kind: 'offline' }
  | { kind: 'error'; message: string };

type Collection = (typeof TABLES)[number];
interface Change {
  collection: Collection;
  id: string;
}
export interface SyncPlan {
  replace: boolean;
  upserts: (Change & { data: unknown })[];
  deletes: Change[];
  next: Record<string, string>;
}

function read(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function write(key: string, value: string | null): void {
  try {
    if (value == null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    // Privat tilstand: sync virker stadig, men sender alt hver gang.
  }
}

/** FNV-1a – kort og hurtig; bruges kun til at se, om en post har ændret sig. */
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

/** Finder forskellen mellem appens data og det, serveren sidst fik. Tom `previous` = send alt og erstat. */
export async function planSync(previous: Record<string, string>, database: VenligDB = db): Promise<SyncPlan> {
  const next: Record<string, string> = {};
  const upserts: SyncPlan['upserts'] = [];
  for (const collection of TABLES) {
    const table = database.table(collection);
    const keyPath = table.schema.primKey.keyPath as string;
    for (const row of await table.toArray()) {
      const id = String(row[keyPath]);
      const key = `${collection}/${id}`;
      const h = hash(JSON.stringify(row));
      next[key] = h;
      if (previous[key] !== h) upserts.push({ collection, id, data: row });
    }
  }
  const deletes = Object.keys(previous)
    .filter((key) => !(key in next))
    .map((key) => {
      const i = key.indexOf('/');
      return { collection: key.slice(0, i) as Collection, id: key.slice(i + 1) };
    });
  return { replace: Object.keys(previous).length === 0, upserts, deletes, next };
}

let status: SyncStatus = getToken() ? { kind: 'idle', lastSyncedAt: Number(read(LAST_KEY)) || null } : { kind: 'off' };
const listeners = new Set<(s: SyncStatus) => void>();
function setStatus(s: SyncStatus) {
  status = s;
  for (const l of listeners) l(s);
}

export function useSyncStatus(): SyncStatus {
  const [s, set] = useState(status);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return s;
}

export function getToken(): string | null {
  return read(TOKEN_KEY);
}

export class SyncError extends Error {}

let running: Promise<void> | null = null;
let again = false;

/** Sender ændringer nu. Kører kun én ad gangen; ændringer undervejs sendes bagefter. */
export async function syncNow(): Promise<void> {
  if (running) {
    again = true;
    return running;
  }
  running = (async () => {
    try {
      do {
        again = false;
        await syncOnce();
      } while (again);
    } finally {
      running = null;
    }
  })();
  return running;
}

async function syncOnce(): Promise<void> {
  const token = getToken();
  if (!token) return setStatus({ kind: 'off' });
  if (!navigator.onLine) return setStatus({ kind: 'offline' });
  setStatus({ kind: 'syncing' });

  const previous = JSON.parse(read(STATE_KEY) ?? '{}') as Record<string, string>;
  const plan = await planSync(previous);
  if (!plan.replace && plan.upserts.length === 0 && plan.deletes.length === 0) {
    return setStatus({ kind: 'idle', lastSyncedAt: Number(read(LAST_KEY)) || null });
  }

  let res: Response;
  try {
    res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        replace: plan.replace,
        upserts: plan.upserts,
        deletes: plan.deletes,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      }),
    });
  } catch {
    return setStatus({ kind: 'offline' });
  }
  if (!res.ok) {
    const message =
      res.status === 401
        ? 'Sync-nøglen passer ikke. Den skal være den samme som SYNC_TOKEN på serveren.'
        : res.status === 503
          ? 'Sync er ikke sat op på serveren endnu.'
          : 'Serveren svarede ikke. Prøver igen senere.';
    setStatus({ kind: 'error', message });
    throw new SyncError(message);
  }
  const now = Date.now();
  write(STATE_KEY, JSON.stringify(plan.next));
  write(LAST_KEY, String(now));
  setStatus({ kind: 'idle', lastSyncedAt: now });
}

/** Gemmer nøglen og sender alt. Kaster SyncError, hvis serveren afviser den. */
export async function enableSync(token: string): Promise<void> {
  write(TOKEN_KEY, token.trim());
  write(STATE_KEY, null);
  try {
    await syncNow();
  } catch (e) {
    write(TOKEN_KEY, null);
    setStatus({ kind: 'off' });
    throw e;
  }
}

/** Slår sync fra på telefonen. Med `wipe` slettes kopien på serveren også. */
export async function disableSync(wipe: boolean): Promise<void> {
  const token = getToken();
  if (wipe && token) {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ replace: true, upserts: [], deletes: [] }),
    }).catch(() => null);
    if (!res?.ok) throw new SyncError('Kunne ikke slette kopien på serveren. Er du online?');
  }
  write(TOKEN_KEY, null);
  write(STATE_KEY, null);
  write(LAST_KEY, null);
  setStatus({ kind: 'off' });
}

let timer: ReturnType<typeof setTimeout> | undefined;
function schedule() {
  if (!getToken()) return;
  clearTimeout(timer);
  timer = setTimeout(() => void syncNow().catch(() => {}), DEBOUNCE_MS);
}

/** Starter automatisk sync: ved opstart, ved hver ændring, når nettet kommer tilbage, og når appen lukkes. */
export function startAutoSync(database: VenligDB = db): void {
  for (const t of TABLES) {
    const table = database.table(t);
    table.hook('creating', schedule);
    table.hook('updating', schedule);
    table.hook('deleting', schedule);
  }
  window.addEventListener('online', schedule);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && timer) {
      clearTimeout(timer);
      void syncNow().catch(() => {});
    }
  });
  schedule();
}

// Læser og skriver sync-kopien i D1. Formatet er appens egne poster (src/lib/db.ts).

export const COLLECTIONS = ['checkins', 'habits', 'entries', 'books', 'settings', 'valueReflections'] as const;
export type Collection = (typeof COLLECTIONS)[number];

export interface SyncPayload {
  /** Sand når telefonen sender alt: alt andet på serveren slettes først. */
  replace: boolean;
  upserts: { collection: Collection; id: string; data: unknown }[];
  deletes: { collection: Collection; id: string }[];
  /** Telefonens tidszone, så "i dag" betyder det samme i MCP som i appen. */
  timezone?: string;
}

const MAX_RECORDS = 10_000;
/** D1 tillader højst 100 bundne parametre pr. forespørgsel. */
const ROWS_PER_INSERT = 25;

export function parseSyncPayload(body: unknown): SyncPayload | null {
  const b = body as Partial<SyncPayload> | null;
  if (!b || typeof b.replace !== 'boolean' || !Array.isArray(b.upserts) || !Array.isArray(b.deletes)) return null;
  if (b.upserts.length + b.deletes.length > MAX_RECORDS) return null;
  const okKey = (r: { collection?: unknown; id?: unknown }) =>
    COLLECTIONS.includes(r?.collection as Collection) && typeof r.id === 'string' && r.id.length > 0 && r.id.length <= 200;
  if (!b.upserts.every((u) => okKey(u) && u.data !== undefined) || !b.deletes.every(okKey)) return null;
  return {
    replace: b.replace,
    upserts: b.upserts,
    deletes: b.deletes,
    timezone: typeof b.timezone === 'string' && b.timezone.length <= 64 ? b.timezone : undefined,
  };
}

/** Anvender ændringerne i én atomisk batch. */
export async function applySync(db: D1Database, p: SyncPayload): Promise<void> {
  const now = Date.now();
  const stmts: D1PreparedStatement[] = [];
  if (p.replace) stmts.push(db.prepare('DELETE FROM records'));
  for (const d of p.deletes) {
    stmts.push(db.prepare('DELETE FROM records WHERE collection = ?1 AND id = ?2').bind(d.collection, d.id));
  }
  for (let i = 0; i < p.upserts.length; i += ROWS_PER_INSERT) {
    const chunk = p.upserts.slice(i, i + ROWS_PER_INSERT);
    const values = chunk.map(() => '(?, ?, ?, ?)').join(', ');
    const params = chunk.flatMap((u) => [u.collection, u.id, JSON.stringify(u.data), now]);
    stmts.push(db.prepare(`INSERT OR REPLACE INTO records (collection, id, data, updated_at) VALUES ${values}`).bind(...params));
  }
  stmts.push(db.prepare(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('last_sync', ?1)`).bind(String(now)));
  if (p.timezone) stmts.push(db.prepare(`INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('timezone', ?1)`).bind(p.timezone));
  await db.batch(stmts);
}

export async function readCollection<T>(db: D1Database, collection: Collection): Promise<T[]> {
  const { results } = await db.prepare('SELECT data FROM records WHERE collection = ?1').bind(collection).all<{ data: string }>();
  return results.map((r) => JSON.parse(r.data) as T);
}

export async function readMeta(db: D1Database): Promise<{ lastSync: number | null; timezone: string }> {
  const { results } = await db.prepare('SELECT key, value FROM sync_meta').all<{ key: string; value: string }>();
  const m = new Map(results.map((r) => [r.key, r.value]));
  return { lastSync: m.has('last_sync') ? Number(m.get('last_sync')) : null, timezone: m.get('timezone') ?? 'Europe/Copenhagen' };
}

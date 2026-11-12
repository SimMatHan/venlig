import { db, ensureSeed, TABLES, type VenligDB } from './db';

export const BACKUP_FORMAT = 'venlig-backup';
export const BACKUP_VERSION = 1;

export interface Backup {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  data: Record<(typeof TABLES)[number], unknown[]>;
}

export async function exportAll(database: VenligDB = db): Promise<Backup> {
  const data = {} as Backup['data'];
  await database.transaction('r', TABLES.map((t) => database.table(t)), async () => {
    for (const t of TABLES) data[t] = await database.table(t).toArray();
  });
  return { format: BACKUP_FORMAT, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data };
}

export function parseBackup(text: string): Backup {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('Filen kunne ikke læses som JSON.');
  }
  const b = parsed as Partial<Backup>;
  if (b?.format !== BACKUP_FORMAT || typeof b.data !== 'object' || b.data == null) {
    throw new Error('Filen ligner ikke en backup fra Venlig.');
  }
  if ((b.version ?? 0) > BACKUP_VERSION) {
    throw new Error('Backuppen er fra en nyere version af appen. Opdater appen og prøv igen.');
  }
  for (const t of TABLES) {
    const rows = (b.data as Record<string, unknown>)[t];
    if (rows !== undefined && !Array.isArray(rows)) throw new Error(`Backuppen er ugyldig (${t}).`);
  }
  return b as Backup;
}

/** Erstatter alle data med backuppens indhold. */
export async function importAll(backup: Backup, database: VenligDB = db): Promise<void> {
  await database.transaction('rw', TABLES.map((t) => database.table(t)), async () => {
    for (const t of TABLES) {
      await database.table(t).clear();
      const rows = backup.data[t] ?? [];
      if (rows.length) await database.table(t).bulkAdd(rows);
    }
  });
  await ensureSeed(database);
}

export async function deleteAll(database: VenligDB = db): Promise<void> {
  await database.transaction('rw', TABLES.map((t) => database.table(t)), async () => {
    for (const t of TABLES) await database.table(t).clear();
  });
  await ensureSeed(database);
}

export function downloadBackup(backup: Backup): void {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `venlig-backup-${backup.exportedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

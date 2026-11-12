import type { CheckIn, JournalEntry } from './db';

/** Hvor meget brugeren har givet sig selv en dag (0–4) – til kalenderen. Aldrig baseret på humør. */
export function careLevel(c: CheckIn | undefined, entries: number): number {
  if (!c && !entries) return 0;
  let n = entries ? 2 : 0;
  if (c) {
    if (c.mood != null) n++;
    if (c.energy != null) n++;
    n += c.goodThings.filter((g) => g.trim()).length;
    if (c.didWell.trim()) n++;
    n += Object.values(c.habits).filter((h) => h.done).length;
  }
  if (n === 0) return 0;
  if (n <= 2) return 1;
  if (n <= 4) return 2;
  if (n <= 7) return 3;
  return 4;
}

export interface Memory {
  date: string;
  kind: 'good' | 'didWell';
  text: string;
}

/** Alle tidligere "gode ting" og "det gjorde jeg godt" – til Tilbageblik. */
export function memories(checkIns: CheckIn[], before: string): Memory[] {
  const out: Memory[] = [];
  for (const c of checkIns) {
    if (c.date >= before) continue;
    for (const g of c.goodThings) if (g.trim()) out.push({ date: c.date, kind: 'good', text: g.trim() });
    if (c.didWell.trim()) out.push({ date: c.date, kind: 'didWell', text: c.didWell.trim() });
  }
  return out;
}

export function entriesByDate(entries: JournalEntry[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const e of entries) m.set(e.date, (m.get(e.date) ?? 0) + 1);
  return m;
}

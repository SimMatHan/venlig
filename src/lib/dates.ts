/** Datoer gemmes som 'YYYY-MM-DD' i lokal tid. */
export type DateKey = string;

export function toKey(d: Date): DateKey {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayKey(): DateKey {
  return toKey(new Date());
}

export function fromKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: DateKey, days: number): DateKey {
  const d = fromKey(key);
  d.setDate(d.getDate() + days);
  return toKey(d);
}

/** Mandagen i ugen, som datoen ligger i. */
export function weekStart(key: DateKey): DateKey {
  const d = fromKey(key);
  const offset = (d.getDay() + 6) % 7;
  return addDays(key, -offset);
}

/** Søndagen i ugen, som datoen ligger i (bruges til ugens værdi-refleksion). */
export function weekSunday(key: DateKey): DateKey {
  return addDays(weekStart(key), 6);
}

export function isSunday(key: DateKey): boolean {
  return fromKey(key).getDay() === 0;
}

export function monthKey(key: DateKey): string {
  return key.slice(0, 7);
}

const longFmt = new Intl.DateTimeFormat('da-DK', { weekday: 'long', day: 'numeric', month: 'long' });
const shortFmt = new Intl.DateTimeFormat('da-DK', { day: 'numeric', month: 'short' });
const monthFmt = new Intl.DateTimeFormat('da-DK', { month: 'long', year: 'numeric' });

export function formatLong(key: DateKey): string {
  const s = longFmt.format(fromKey(key));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatShort(key: DateKey): string {
  return shortFmt.format(fromKey(key)).replace('.', '');
}

export function formatMonth(year: number, month: number): string {
  const s = monthFmt.format(new Date(year, month, 1));
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function relativeDay(key: DateKey, today = todayKey()): string {
  if (key === today) return 'I dag';
  if (key === addDays(today, -1)) return 'I går';
  return formatLong(key);
}

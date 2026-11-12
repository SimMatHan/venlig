/** Lokal dato og klokkeslæt i en given tidszone. */
export function localParts(now: Date, timeZone: string): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    date: `${get('year')}-${get('month')}-${get('day')}`,
    minutes: Number(get('hour')) * 60 + Number(get('minute')),
  };
}

/** Hvor længe efter det valgte tidspunkt en forsinket påmindelse stadig sendes. */
const GRACE_MINUTES = 60;

/**
 * Skal der sendes en påmindelse nu? Højst én pr. lokal dag, og kun i timen
 * efter det valgte tidspunkt (så en forsinket cron ikke vækker nogen kl. 3).
 */
export function isDue(now: Date, timeZone: string, reminderTime: string, lastSentDate: string | null): boolean {
  const [h, m] = reminderTime.split(':').map(Number);
  const target = h * 60 + m;
  const local = localParts(now, timeZone);
  if (lastSentDate === local.date) return false;
  const since = local.minutes - target;
  return since >= 0 && since < GRACE_MINUTES;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

export function isValidTimeZone(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 64) return false;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

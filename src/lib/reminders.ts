// Daglig påmindelse via web push. Serveren kender kun et anonymt
// push-abonnement, et klokkeslæt og en tidszone – aldrig dagbogsdata.

export type ReminderSupport =
  | { ok: true }
  | { ok: false; reason: 'ios-not-installed' | 'ios-too-old' | 'unsupported' | 'denied' };

export function isIOS(): boolean {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  );
}

export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function iosVersion(): number | null {
  const m = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  return m ? Number(m[1]) + Number(m[2]) / 10 : null;
}

export function reminderSupport(): ReminderSupport {
  const hasPush = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  if (isIOS()) {
    const v = iosVersion();
    if (v != null && v < 16.4) return { ok: false, reason: 'ios-too-old' };
    // På iPhone findes push kun i appen fra hjemmeskærmen.
    if (!isStandalone() || !hasPush) return { ok: false, reason: 'ios-not-installed' };
  }
  if (!hasPush) return { ok: false, reason: 'unsupported' };
  if (Notification.permission === 'denied') return { ok: false, reason: 'denied' };
  return { ok: true };
}

function keyToBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const b64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(base64url.length / 4) * 4, '=');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

export class ReminderError extends Error {}

/** Beder om tilladelse (skal kaldes fra et tryk) og registrerer påmindelsen. */
export async function enableReminder(time: string): Promise<void> {
  const keyRes = await fetch('/api/push/public-key').catch(() => null);
  if (!keyRes) throw new ReminderError('Du skal være online for at slå påmindelser til.');
  if (keyRes.status === 503) throw new ReminderError('Påmindelser er ikke sat op på serveren endnu (se README).');
  if (!keyRes.ok) throw new ReminderError('Serveren svarede ikke. Prøv igen om lidt.');
  const { publicKey } = (await keyRes.json()) as { publicKey: string };

  const permission = await Notification.requestPermission();
  if (permission !== 'granted') throw new ReminderError('Notifikationer blev ikke tilladt.');

  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyToBytes(publicKey) });
  }
  await saveSubscription(sub, time);
}

export async function updateReminderTime(time: string): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager.getSubscription();
  if (!sub) throw new ReminderError('Påmindelsen er ikke aktiv på denne enhed. Slå den til igen.');
  await saveSubscription(sub, time);
}

async function saveSubscription(sub: PushSubscription, time: string): Promise<void> {
  const res = await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      time,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    }),
  }).catch(() => null);
  if (!res?.ok) throw new ReminderError('Kunne ikke gemme påmindelsen. Er du online?');
}

export async function disableReminder(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.ready;
  const sub = await reg.pushManager?.getSubscription();
  if (!sub) return;
  await fetch('/api/push/unsubscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: sub.endpoint }),
  }).catch(() => {});
  await sub.unsubscribe();
}

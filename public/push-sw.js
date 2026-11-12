// Indlæses af den genererede service worker (workbox importScripts).
// Serveren sender tomme push-beskeder – teksten bestemmes her, så intet
// personligt nogensinde går gennem serveren.
const REMINDERS = [
  'Har du et par minutter til dig selv? Dit tjek-in venter.',
  'Hvad gik godt i dag? Skriv det ned, mens du husker det.',
  'Et lille øjeblik med venlighed – også mod dig selv.',
];

self.addEventListener('push', (event) => {
  const body = REMINDERS[new Date().getDate() % REMINDERS.length];
  event.waitUntil(
    self.registration.showNotification('Venlig', {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-64x64.png',
      tag: 'venlig-daily',
      lang: 'da',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) return client.focus();
      }
      return self.clients.openWindow('/');
    }),
  );
});

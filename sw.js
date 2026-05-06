// iOS requires showNotification() to be called inside event.waitUntil()
// before the push event terminates, or the subscription is revoked
// after a few notifications. Do not refactor away.

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    if (event.data) data = event.data.json();
  } catch (_) {
    data = { title: 'Awareness', body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'Notice';
  const options = {
    body: data.body || 'Where is your attention right now?',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'awareness-bell',
    renotify: false,
    data: { url: data.url || '/' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientsList) {
      if (client.url.includes(self.location.origin)) {
        await client.focus();
        return;
      }
    }
    if (self.clients.openWindow) {
      await self.clients.openWindow(url);
    }
  })());
});

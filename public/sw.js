// Service worker: exists mainly so /admin, /staff and /superadmin pass the
// browser's "installable PWA" checks (a manifest + a registered SW with a
// fetch handler). It does NOT try to cache or serve API/data requests —
// orders/menu data must always come from the network — it only caches the
// icons so the install prompt/home-screen icon works offline.
//
// push/notificationclick below (v4) are the second half of that PWA
// investment: StaffApp.jsx subscribes a device via pushManager.subscribe()
// (see lib/services/pushService.js), and supabase/functions/notify-push
// (0030_push_notifications.sql) sends the actual push on a new order/
// waiter-call/bill-request — this file is what turns that push into a
// visible OS notification while the tab is closed or backgrounded.
const CACHE_NAME = 'menuflow-shell-v4';
const SHELL_ASSETS = [
  '/icons/admin/icon-192.png',
  '/icons/admin/icon-512.png',
  '/icons/staff/icon-192.png',
  '/icons/staff/icon-512.png',
  '/icons/superadmin/icon-192.png',
  '/icons/superadmin/icon-512.png',
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS)).catch(() => {})
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  // Only intercept same-origin icon requests; everything else (pages, the
  // Supabase API, etc.) goes straight to the network untouched.
  const url = new URL(request.url);
  if (url.origin === self.location.origin && url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
  }
});

// notify-push's payload is `{ title, body, tag }` (see its own header
// comment) — tag is 'order-<id>'/'alert-<id>' so a second push for the SAME
// order/alert (there shouldn't be one, but belt-and-suspenders) replaces
// the existing notification instead of stacking a duplicate.
self.addEventListener('push', (event) => {
  let payload = { title: 'MenuFlow', body: '', tag: 'menuflow' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch {
    // Non-JSON push body (shouldn't happen — notify-push always sends
    // JSON.stringify'd JSON) — fall back to the generic title/body above
    // rather than letting showNotification() throw and silently drop it.
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      tag: payload.tag,
      icon: '/icons/staff/icon-192.png',
      badge: '/icons/staff/icon-192.png',
      // `renotify` only matters when `tag` collides — it re-alerts (sound/
      // vibration) instead of silently updating the existing bubble. Wanted
      // here: a second order landing right after the first should still
      // buzz the device even if the OS happened to reuse the same tag slot.
      renotify: true,
    })
  );
});

// Focuses an already-open /staff tab if one exists, otherwise opens one —
// mirrors the "go to staff panel" link pattern already used elsewhere in
// this app (AdminApp.jsx's UsersTab / SubscriptionLockedScreen) rather than
// inventing a new destination just for this handler.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes('/staff') && 'focus' in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow('/staff');
    })
  );
});

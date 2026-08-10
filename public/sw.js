// Minimal service worker: exists mainly so /admin, /staff and /superadmin
// pass the browser's "installable PWA" checks (a manifest + a registered
// SW with a fetch handler). It does NOT try to cache or serve API/data
// requests — orders/menu data must always come from the network — it only
// caches the icons so the install prompt/home-screen icon works offline.
const CACHE_NAME = 'menuflow-shell-v3';
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

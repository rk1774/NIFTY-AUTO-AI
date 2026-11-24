const CACHE = 'nifty-auto-ai-v7-gold';

const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './gold-bull-192.png',
  './gold-bull-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key =>
          key.startsWith('nifty-auto-ai-') &&
          key !== CACHE
        ).map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .catch(async () => {
        const cached = await caches.match(event.request);
        if (cached) return cached;

        if (event.request.mode === 'navigate') {
          const page = await caches.match('./index.html');
          if (page) return page;
        }

        return Response.error();
      })
  );
});

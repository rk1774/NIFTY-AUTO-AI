const CACHE = 'nifty-auto-ai-v8-pro';

const FILES = [
  './v8-pro.html',
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

  if (new URL(event.request.url).origin !==
      self.location.origin) return;

  event.respondWith(
    fetch(event.request, { cache: 'no-cache' })
      .catch(async () => {
        if (event.request.mode === 'navigate') {
          const page = await caches.match(
            './v8-pro.html'
          );
          if (page) return page;
        }

        const cached = await caches.match(event.request);
        return cached || Response.error();
      })
  );
});

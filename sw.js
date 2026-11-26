
const CACHE = 'nse-auto-ai-v8-pro-v1';

const FILES = [
  './v8-pro.html',
  './manifest.webmanifest',
  './gold-bull-192.png',
  './gold-bull-512.png',
  './options-ai.js',
  './options-ui.js',
  './market-ui.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(
        FILES.map(file =>
          new Request(file, {
            cache: 'reload'
          })
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(key =>
          (
            key.startsWith('nifty-auto-ai-') ||
            key.startsWith('nse-auto-ai-')
          ) &&
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
        const cache = await caches.open(CACHE);

        if (event.request.mode === 'navigate') {
          const page = await cache.match(
            './v8-pro.html'
          );
          if (page) return page;
        }

        const cached = await cache.match(
          event.request
        );

        return cached || Response.error();
      })
  );
});

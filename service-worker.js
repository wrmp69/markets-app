const CACHE_NAME = 'gymlog-pwa-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './css/app.css',
  './js/app.js',
  './js/machines.js',
  './js/storage.js',
  './js/timer.js',
  './js/utils.js',
  './assets/icon-192.png',
  './assets/icon-512.png',
  './assets/maskable-icon-512.png',
  './assets/body-map-base.png',
  './assets/body-map-fitness-clickable.svg',
  './assets/body-map-fitness-overlay-only.svg',
  './assets/body-map-premium.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL.map(url => new Request(url, { cache: 'reload' }))).catch(() => cache.addAll(['./index.html', './manifest.json'])))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  event.respondWith(
    caches.match(request).then(cached => {
      const fetchAndCache = fetch(request).then(response => {
        const copy = response.clone();
        const url = new URL(request.url);
        const cacheable = response.ok || response.type === 'opaque';
        const allowed = url.origin === self.location.origin ||
          ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com'].includes(url.hostname);
        if (cacheable && allowed) caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
        return response;
      });
      return cached || fetchAndCache.catch(() => {
        if (request.mode === 'navigate') return caches.match('./index.html');
        return cached;
      });
    })
  );
});

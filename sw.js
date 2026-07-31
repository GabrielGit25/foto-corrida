const CACHE_NAME = 'foto-corrida-v16';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css?v=15',
  '/app.js?v=15',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/assets/hero-julho-amarelo.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    fetch(event.request)
      .then(function (response) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(function (cache) {
          if (event.request.method === 'GET') cache.put(event.request, copy);
        });
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});

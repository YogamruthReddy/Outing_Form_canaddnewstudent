const CACHE_NAME = 'outing-app-v7';
const OFFLINE_URL = './offline.html';

const PRECACHE_ASSETS = [
  './',
  './index.html',
  './script.js',
  './data.js',
  './pdf.js',
  './manifest.json',
  './offline.html',
  './icon-192.png',
  './icon-512.png',
];

// Install: pre-cache all assets
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => {
      self.clients.claim();
      // Notify all clients that a new version is available
      self.clients.matchAll().then(clients =>
        clients.forEach(client => client.postMessage({ type: 'SW_UPDATED' }))
      );
    })
  );
});

// Fetch: stale-while-revalidate + offline fallback
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);
      const networkFetch = fetch(event.request).then(response => {
        if (response && response.status === 200) {
          cache.put(event.request, response.clone());
        }
        return response;
      }).catch(async () => {
        // Network failed — serve offline page for navigation requests
        if (event.request.mode === 'navigate') {
          return cache.match(OFFLINE_URL);
        }
        return null;
      });

      return cached || networkFetch;
    })
  );
});

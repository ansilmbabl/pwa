const CACHE_NAME = 'ledger-v4';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './db.js',
  './manifest.json',
  'https://cdn-icons-png.flaticon.com/512/2454/2454269.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting(); 
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.map((key) => {
        if (key !== CACHE_NAME) return caches.delete(key);
      })
    ))
  );
  return self.clients.claim(); 
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse; 
      }
      return fetch(e.request).catch(() => {
        console.log('Offline asset fallback request execution failed.');
      });
    })
  );
});
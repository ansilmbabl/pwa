const CACHE_NAME = "ledger-v8-spotlight-tour";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./sw.js",
  "./icons/icon.svg",
  "./js/dates.js",
  "./js/db.js",
  "./js/ui.js",
  "./js/tabs.js",
  "./js/tour.js",
  "./js/files.js",
  "./js/share.js",
  "./js/import.js",
  "./js/wallets.js",
  "./js/rules.js",
  "./js/lock.js",
  "./js/theme.js",
  "./js/mileage.js",
  "./js/transactions.js",
  "./js/budget.js",
  "./js/bills.js",
  "./js/goals.js",
  "./js/reports.js",
  "./js/settings.js",
  "./js/app.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

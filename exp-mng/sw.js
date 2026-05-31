const CACHE_NAME = "ledger-v17-icon-square";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./sw.js",
  "./icons/icon.svg",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./js/dates.js",
  "./js/db.js",
  "./js/ui.js",
  "./js/tabs.js",
  "./js/tour.js",
  "./js/update.js",
  "./js/files.js",
  "./js/share.js",
  "./js/import.js",
  "./js/wallets.js",
  "./js/rules.js",
  "./js/lock.js",
  "./js/theme.js",
  "./js/mileage.js",
  "./js/tax-india.js",
  "./js/tax-ui.js",
  "./js/advice.js",
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
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
    // skipWaiting only when client sends SKIP_WAITING (update button)
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const isAppShell =
    url.pathname.endsWith(".js") ||
    url.pathname.endsWith(".html") ||
    url.pathname.endsWith(".css") ||
    url.pathname.endsWith("/sw.js");

  if (isAppShell) {
    event.respondWith(
      fetch(event.request)
        .then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((c) => c.put(event.request, clone));
          }
          return res;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

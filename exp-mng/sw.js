const CACHE_NAME = "ledger-v33-due-panel-add-popup";
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
  "./js/share-image.js",
  "./js/import.js",
  "./js/wallets.js",
  "./js/rules.js",
  "./js/lock.js",
  "./js/theme.js",
  "./js/mileage.js",
  "./js/tax-india.js",
  "./js/tax-ui.js",
  "./js/advice.js",
  "./js/notifications.js",
  "./js/export-brand.js",
  "./js/category-filter.js",
  "./js/category-picker.js",
  "./js/calendar.js",
  "./js/about.js",
  "./js/transactions.js",
  "./js/budget.js",
  "./js/bills.js",
  "./js/due.js",
  "./js/goals.js",
  "./js/reports.js",
  "./js/settings.js",
  "./js/settings-nav.js",
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
  if (event.data?.type === "SHOW_NOTIFICATION") {
    const { title, body, tag, icon } = event.data;
    const scope = self.registration.scope;
    const iconUrl = (() => {
      try {
        return new URL(icon || "icons/icon-192.png", scope).href;
      } catch {
        return icon || `${scope}icons/icon-192.png`;
      }
    })();
    event.waitUntil(
      self.registration.showNotification(title, {
        body,
        icon: iconUrl,
        badge: iconUrl,
        tag: tag || "ledger-core",
        vibrate: [120, 80, 120],
      }),
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      if (list.length) return list[0].focus();
      return clients.openWindow("./index.html");
    }),
  );
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

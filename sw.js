// ═══════════════════════════════════════════════════════════════════════════
// Daily Stewardship — Service Worker
// Handles: install, activate, push notifications, scheduled reminders
// ═══════════════════════════════════════════════════════════════════════════

const CACHE_NAME = "stewardship-v1";
const ASSETS = ["./StewardshipApp.html", "./manifest.json"];

// ── Install: cache app files ──────────────────────────────────────────────
self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// ── Activate: clean up old caches ────────────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ── Fetch: serve from cache when offline ─────────────────────────────────
self.addEventListener("fetch", event => {
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request))
  );
});

// ── Message from app: schedule notifications ─────────────────────────────
self.addEventListener("message", event => {
  if (event.data?.type === "SCHEDULE") {
    scheduleAll(event.data.notifications);
  }
  if (event.data?.type === "CANCEL_ALL") {
    cancelAll();
  }
});

// ── Notification click: open the app ────────────────────────────────────
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      if (list.length > 0) return list[0].focus();
      return clients.openWindow("./StewardshipApp.html");
    })
  );
});

// ── Scheduling engine ────────────────────────────────────────────────────
const scheduled = new Map(); // tag → timeoutId

function scheduleAll(notifications) {
  // Cancel all existing timers first
  cancelAll();
  const now = Date.now();
  notifications.forEach(n => {
    const delay = n.time - now;
    if (delay > 0 && delay < 86400000) { // within next 24 hours
      const id = setTimeout(() => fire(n), delay);
      scheduled.set(n.tag, id);
    }
  });
  console.log(`[SW] Scheduled ${scheduled.size} notifications`);
}

function cancelAll() {
  scheduled.forEach(id => clearTimeout(id));
  scheduled.clear();
}

function fire(n) {
  self.registration.showNotification(n.title, {
    body: n.body,
    icon: n.icon || "https://via.placeholder.com/192x192/060B14/00D4FF?text=S",
    badge: "https://via.placeholder.com/72x72/060B14/00D4FF?text=S",
    tag: n.tag,
    requireInteraction: n.urgent === true,
    vibrate: n.urgent ? [300, 100, 300, 100, 300] : [200, 100, 200],
    silent: false,
    data: { url: "./StewardshipApp.html" },
    actions: [
      { action: "open", title: "Open App" },
      { action: "dismiss", title: "Dismiss" }
    ]
  });
  scheduled.delete(n.tag);
}

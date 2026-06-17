// Service Worker — BasketballRPE-Web
// Bump CACHE_VERSION whenever you deploy new code to invalidate stale caches.
const CACHE_VERSION = 'v26i';
const CACHE_NAME = `rpe-basketball-${CACHE_VERSION}`;

const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/app.js',
  '/anamnesis.js',
  '/auth.js',
  '/backup.js',
  '/calendar.js',
  '/chart.js',
  '/store.js',
  '/security.js',
  '/firebase-config.js',
  '/firebase-sync.js',
  '/ewma-calculator.js',
  '/dashboard-renderer.js',
  '/dashboard-comparison.js',
  '/injury-management.js',
  '/injury-management-2.js',
  '/injury-prediction.js',
  '/pdf-reports.js',
  '/player-view.js',
  '/strength.js',
  '/team-load.js',
  '/team-status.js',
  '/ui-helpers.js',
  '/weekplan-medical.js',
  '/wellness.js',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  );
});

// Delete old cache versions on activation
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key.startsWith('rpe-basketball-') && key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);
    const isLocal = url.origin === self.location.origin;
    const ext = url.pathname.split('.').pop();

    // Network-first para HTML, JS y CSS — garantiza código fresco tras deploy
    if (isLocal && ['html', 'js', 'css'].includes(ext) || url.pathname === '/') {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    return response;
                })
                .catch(() => caches.match(event.request))
        );
        return;
    }

    // Cache-first para el resto (imágenes, fuentes, etc.)
    event.respondWith(
        caches.match(event.request)
            .then(response => response || fetch(event.request))
    );
});

// ========== PUSH NOTIFICATIONS ==========
self.addEventListener('push', event => {
    if (!event.data) return;
    let payload;
    try { payload = event.data.json(); } catch(e) { payload = { title: 'RPE Basketball', body: event.data.text() }; }
    event.waitUntil(
        self.registration.showNotification(payload.title || 'RPE Basketball', {
            body: payload.body || '',
            icon: '/icon-192.png',
            badge: '/icon-192.png',
            tag: payload.tag || 'rpe-alert',
            renotify: true,
            data: payload.data || {}
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            if (list.length > 0) return list[0].focus();
            return clients.openWindow('/');
        })
    );
});

// ========== MESSAGE CHANNEL — trigger notification from main thread ==========
// Usage: navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag })
self.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.type !== 'SHOW_NOTIFICATION') return;
    self.registration.showNotification(data.title || 'RPE Basketball', {
        body: data.body || '',
        icon: '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag || 'rpe-alert',
        renotify: true
    });
});

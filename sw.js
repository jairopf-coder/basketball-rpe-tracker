// Service Worker — BasketballRPE-Web
// Bump CACHE_VERSION whenever you deploy new code to invalidate stale caches.
const CACHE_VERSION = 'v2';
const CACHE_NAME = `rpe-basketball-${CACHE_VERSION}`;

const urlsToCache = [
  '/',
  '/index.html',
  '/styles.css',
  '/manifest.json',
  '/app.js',
  '/auth.js',
  '/backup.js',
  '/batch4-modules.js',
  '/calendar.js',
  '/chart.js',
  '/firebase-config.js',
  '/firebase-sync.js',
  '/improvements.js',
  '/injury-management.js',
  '/injury-management-2.js',
  '/injury-prediction.js',
  '/pdf-reports.js',
  '/strength.js',
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

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

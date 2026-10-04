// Service Worker — BasketballRPE-Web
// Bump CACHE_VERSION whenever you deploy new code to invalidate stale caches.
const CACHE_VERSION = 'v132';
const CACHE_NAME = `rpe-basketball-${CACHE_VERSION}`;

// Rutas RELATIVAS al scope del service worker (la app vive en /basketball-rpe-tracker/,
// no en la raíz del dominio). '' = la propia página de inicio de la app.
const urlsToCache = [
  '',
  'index.html',
  'styles.css',
  'manifest.json',
  'icon-192.png',
  'icon-512.png',
  'favicon.ico',
  'apple-touch-icon.png',
  'app.js',
  'app-sessions.js',
  'app-players.js',
  'app-presession.js',
  'app-comparisons.js',
  'app-analytics.js',
  'anamnesis.js',
  'auth.js',
  'backup.js',
  'calendar.js',
  'chart.js',
  'store.js',
  'security.js',
  'firebase-config.js',
  'firebase-sync.js',
  'push-client.js',
  'ewma-calculator.js',
  'dashboard-renderer.js',
  'dashboard-comparison.js',
  'injury-management.js',
  'injury-management-2.js',
  'gps-injury-signal.js',
  'injury-prediction.js',
  'gps-intensity-index.js',
  'gps-tracking.js',
  'gps-tracking-analytics.js',
  'pdf-reports.js',
  'player-view.js',
  'player-i18n.js',
  'strength.js',
  'team-load.js',
  'team-status.js',
  'objectives.js',
  'ui-helpers.js',
  'weekplan-medical.js',
  'wellness.js',
  'export-fisio.js',
  'xlsx.mini.min.js',
];

// Convierte una ruta relativa en URL absoluta dentro del scope de la app.
const scopeUrl = path => new URL(path, self.registration.scope).href;
const ICON_URL = scopeUrl('icon-192.png');

self.addEventListener('install', event => {
  // Cada archivo se cachea por separado: si uno falla, la instalación NO se cancela
  // (con cache.addAll un solo 404 impedía instalar el service worker y, sin él, no hay avisos).
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => Promise.all(urlsToCache.map(path =>
        cache.add(scopeUrl(path)).catch(err => console.warn('SW: no se pudo cachear', path, err && err.message))
      )))
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

    // Network-first para navegación, HTML, JS y CSS — garantiza código fresco tras deploy
    const isNavigation = event.request.mode === 'navigate';
    if (isLocal && (isNavigation || ['html', 'js', 'css'].includes(ext))) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    // Solo se guardan respuestas correctas (un 404 en caché estropearía el modo sin conexión)
                    if (response.ok && event.request.method === 'GET') {
                        const clone = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                    }
                    return response;
                })
                .catch(() => caches.match(event.request)
                    .then(cached => cached || (isNavigation ? caches.match(scopeUrl('index.html')) : undefined)))
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
    // IMPORTANTE: cada aviso recibido DEBE mostrar una notificación. En iPhone, si un push llega
    // sin mostrar nada, Apple puede cancelar la suscripción. Por eso nunca se hace "return" antes.
    let payload = {};
    if (event.data) {
        try { payload = event.data.json() || {}; }
        catch (e) { payload = { body: event.data.text() }; }
    }
    const extra = payload.data && typeof payload.data === 'object' ? payload.data : {};
    event.waitUntil(
        self.registration.showNotification(payload.title || 'Load Ctrl', {
            body: payload.body || '',
            icon: ICON_URL,
            badge: ICON_URL,
            tag: payload.tag || 'rpe-alert',
            renotify: true,
            data: Object.assign({}, extra, { url: payload.url || extra.url || '' })
        })
    );
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    // Solo se abren direcciones DENTRO de la app; cualquier otra cosa lleva al inicio de la app.
    const requested = event.notification.data && event.notification.data.url;
    let target = scopeUrl('');
    try {
        const u = new URL(requested || '', self.registration.scope).href;
        if (u.startsWith(self.registration.scope)) target = u;
    } catch (e) { /* URL no válida: se usa el inicio */ }
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
            const open = list.find(c => c.url && c.url.startsWith(self.registration.scope));
            if (open && 'focus' in open) return open.focus();
            return clients.openWindow(target);
        })
    );
});

// ========== MESSAGE CHANNEL — trigger notification from main thread ==========
// Usage: navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag })
self.addEventListener('message', event => {
    const data = event.data;
    if (!data || data.type !== 'SHOW_NOTIFICATION') return;
    self.registration.showNotification(data.title || 'Load Ctrl', {
        body: data.body || '',
        icon: ICON_URL,
        badge: ICON_URL,
        tag: data.tag || 'rpe-alert',
        renotify: true
    });
});

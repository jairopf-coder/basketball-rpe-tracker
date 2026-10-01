// ======================================================================
// BasketballRPE-Web — push-client.js
// Avisos push en el móvil de la jugadora (Web Push estándar con claves VAPID).
//
// FASE 2: solo la SUSCRIPCIÓN. Aquí se pide el permiso, se crea la suscripción
// del móvil y se guarda en Firebase. El ENVÍO de avisos llega en la Fase 3.
//
// Qué se guarda en Firebase (ver firebase-rules.json):
//   /pushSubscriptions/{uid}  → { endpoint, keys:{p256dh,auth}, updatedAt }
//        Es la "dirección" del móvil. SOLO la puede leer/escribir su dueña
//        (el envío lo hará un proceso con permisos de administrador).
//   /pushStatus/{uid}         → { active:true, updatedAt }
//        Solo indica "tiene avisos activados". El staff lo lee para mostrar 🔔.
//
// Para activar la función hay que pegar la clave PÚBLICA VAPID abajo.
// Mientras esté vacía NO se muestra nada a nadie (la app funciona como siempre).
// ======================================================================

const PushClient = (() => {
    'use strict';

    // ⬇️ PEGA AQUÍ LA CLAVE PÚBLICA VAPID (no es secreta; la privada NUNCA va en la app).
    const VAPID_PUBLIC_KEY = 'BPdrPonA1q19e1QRaMfKQASzIsW-Ofyws7lwGakJ81j8GwIfpNwZ52kOkRI9Ih-v2UD6yFBhKN2KCLT3RTgnjng';

    const LS_ACTIVE = 'pv_push_active';   // recuerda que este móvil dejó los avisos activos en la nube
    let _key = VAPID_PUBLIC_KEY;
    let _swTimeoutMs = 5000;
    let _syncedThisSession = false;

    // Solo para pruebas / ajustes puntuales.
    function configure(opts) {
        if (!opts) return;
        if (typeof opts.vapidPublicKey === 'string') _key = opts.vapidPublicKey;
        if (typeof opts.swTimeoutMs === 'number') _swTimeoutMs = opts.swTimeoutMs;
        _syncedThisSession = false;
    }

    function isConfigured() {
        return typeof _key === 'string' && _key.length > 0;
    }

    // Safari en iPhone solo expone PushManager dentro de la app instalada (iOS 16.4+).
    function isSupported() {
        return typeof navigator !== 'undefined' && 'serviceWorker' in navigator
            && typeof window !== 'undefined' && 'PushManager' in window
            && typeof Notification !== 'undefined';
    }

    // La clave VAPID viaja en base64url; subscribe() la necesita como bytes.
    function urlBase64ToUint8Array(b64) {
        const padding = '='.repeat((4 - (b64.length % 4)) % 4);
        const base64 = (b64 + padding).replace(/-/g, '+').replace(/_/g, '/');
        const raw = atob(base64);
        const out = new Uint8Array(raw.length);
        for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
        return out;
    }

    // El service worker puede tardar o no llegar a activarse: no esperamos para siempre.
    function _swReady() {
        return Promise.race([
            navigator.serviceWorker.ready,
            new Promise(resolve => setTimeout(() => resolve(null), _swTimeoutMs)),
        ]);
    }

    async function _getSubscription() {
        const reg = await navigator.serviceWorker.getRegistration();
        if (!reg || !reg.pushManager) return null;
        return reg.pushManager.getSubscription();
    }

    function _sameKey(sub, keyBytes) {
        const k = sub && sub.options && sub.options.applicationServerKey;
        if (!k) return false;
        const a = new Uint8Array(k);
        if (a.length !== keyBytes.length) return false;
        for (let i = 0; i < a.length; i++) if (a[i] !== keyBytes[i]) return false;
        return true;
    }

    async function _save(uid, sub, db) {
        if (!uid || !db) throw new Error('Sin conexión con la base de datos');
        const json = sub.toJSON();
        const now = new Date().toISOString();
        await Promise.all([
            db.ref('pushSubscriptions/' + uid).set({
                endpoint: json.endpoint,
                keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
                updatedAt: now,
            }),
            db.ref('pushStatus/' + uid).set({ active: true, updatedAt: now }),
        ]);
        try { localStorage.setItem(LS_ACTIVE, '1'); } catch (_) { /* sin almacenamiento local */ }
    }

    async function _clearRemote(uid, db) {
        if (!uid || !db) throw new Error('Sin conexión con la base de datos');
        await Promise.all([
            db.ref('pushSubscriptions/' + uid).remove(),
            db.ref('pushStatus/' + uid).remove(),
        ]);
    }

    // Estado para pintar la tarjeta:
    //   'unconfigured' → falta la clave VAPID: no se muestra nada
    //   'preview'      → vista previa del staff: no se puede activar
    //   'unsupported'  → este móvil/navegador no admite avisos
    //   'denied'       → la jugadora bloqueó las notificaciones
    //   'active'       → permiso concedido y suscripción creada
    //   'ready'        → se puede activar
    async function getState(opts) {
        if (!isConfigured()) return 'unconfigured';
        if (opts && opts.preview) return 'preview';
        if (!isSupported()) return 'unsupported';
        if (Notification.permission === 'denied') return 'denied';
        try {
            const sub = await _getSubscription();
            if (sub && Notification.permission === 'granted') return 'active';
        } catch (_) { /* si falla la consulta, se ofrece activar */ }
        return 'ready';
    }

    // Activa los avisos. Resultado: { ok:true } | { ok:false, reason }
    //   reason: 'unsupported' | 'denied' | 'dismissed' | 'sw' | 'error' | 'save'
    //
    // IMPORTANTE: debe llamarse DIRECTAMENTE desde el toque de la jugadora y
    // requestPermission() tiene que ser lo primero que se ejecuta (sin ningún
    // "await" antes), porque iOS solo muestra el permiso dentro de un gesto.
    async function enable(uid, db) {
        if (!isConfigured() || !isSupported()) return { ok: false, reason: 'unsupported' };

        let perm = Notification.permission;
        if (perm === 'default') perm = await Notification.requestPermission();
        if (perm === 'denied') return { ok: false, reason: 'denied' };
        if (perm !== 'granted') return { ok: false, reason: 'dismissed' };

        const reg = await _swReady();
        if (!reg || !reg.pushManager) return { ok: false, reason: 'sw' };

        let sub;
        try {
            const keyBytes = urlBase64ToUint8Array(_key);
            sub = await reg.pushManager.getSubscription();
            // Si cambió la clave VAPID, la suscripción vieja ya no sirve
            if (sub && !_sameKey(sub, keyBytes)) { await sub.unsubscribe(); sub = null; }
            if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keyBytes });
        } catch (e) {
            return { ok: false, reason: 'error', error: e };
        }

        try {
            await _save(uid, sub, db);
        } catch (e) {
            // El móvil ya está suscrito: se reintentará el guardado al abrir la app (syncOnOpen)
            return { ok: false, reason: 'save', error: e };
        }
        return { ok: true };
    }

    // Desactiva los avisos de este móvil y borra su suscripción de Firebase.
    async function disable(uid, db) {
        let sub = null;
        try { sub = await _getSubscription(); } catch (_) { /* ignorar */ }
        if (sub) { try { await sub.unsubscribe(); } catch (_) { /* ya estaba dada de baja */ } }
        try {
            await _clearRemote(uid, db);
        } catch (e) {
            return { ok: false, reason: 'save', error: e };
        }
        try { localStorage.removeItem(LS_ACTIVE); } catch (_) { /* ignorar */ }
        return { ok: true };
    }

    // Se llama una vez por sesión al abrir la pantalla de la jugadora (no en vista previa):
    //  - si hay suscripción válida, la vuelve a guardar (el navegador puede renovar la dirección);
    //  - si ya no hay (retiró el permiso o caducó) y la nube la daba por activa, limpia el 🔔.
    // NUNCA crea una suscripción nueva por su cuenta: eso solo lo hace enable().
    async function syncOnOpen(uid, db) {
        if (_syncedThisSession || !isConfigured() || !isSupported() || !uid || !db) return 'skip';
        _syncedThisSession = true;
        try {
            const sub = Notification.permission === 'granted' ? await _getSubscription() : null;
            if (sub) { await _save(uid, sub, db); return 'saved'; }
            if (localStorage.getItem(LS_ACTIVE) === '1') {
                await _clearRemote(uid, db);
                localStorage.removeItem(LS_ACTIVE);
                return 'cleared';
            }
        } catch (_) { /* sin conexión: se reintenta la próxima vez */ }
        return 'noop';
    }

    return { configure, isConfigured, isSupported, getState, enable, disable, syncOnOpen, urlBase64ToUint8Array };
})();

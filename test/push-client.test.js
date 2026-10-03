// test/push-client.test.js
// FASE 2 de los avisos push: suscripción en el móvil de la jugadora.
//   A) push-client.js   — permiso, suscripción y guardado en Firebase
//   B) player-view.js   — la tarjeta "Avisos" de la pantalla de la jugadora
//   C) sw.js            — rutas dentro de la subruta, instalación tolerante, avisos siempre visibles
//   D) lado staff       — 🔔 en "Faltan hoy"
//   E) comprobaciones de estructura (reglas, index.html, clave pegada)
// Ejecutar con:  node test/push-client.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
const tick = () => new Promise(r => setImmediate(r));
const wait = ms => new Promise(r => setTimeout(r, ms));
// Los objetos creados DENTRO del sandbox (vm) pertenecen a otro "realm": se normalizan antes de compararlos
const J = x => JSON.parse(JSON.stringify(x));

// Una clave VAPID pública "de verdad" (65 bytes, empieza por 0x04) para las pruebas
const ecdh = crypto.createECDH('prime256v1'); ecdh.generateKeys();
const KEY_BYTES = ecdh.getPublicKey();
const KEY = KEY_BYTES.toString('base64url');

// ════════════════════════════════════════════════════════════════════
// A) push-client.js
// ════════════════════════════════════════════════════════════════════
function loadPush(opts) {
    const o = Object.assign({ perm: 'default', prompt: 'granted', hasSub: false, subKey: null, subscribeFails: false,
        noPushManager: false, noSW: false, noNotification: false, swNever: false, swNeedsRegister: false, registerFails: false, dbFails: false, noDb: false, key: KEY, ls: {} }, opts || {});
    const calls = [], ops = [], regCalls = [], ls = Object.assign({}, o.ls);
    const state = { perm: o.perm };
    const mkSub = keyBytes => ({
        endpoint: 'https://web.push.apple.com/ABC123',
        options: { applicationServerKey: keyBytes ? new Uint8Array(keyBytes).buffer : undefined },
        toJSON() { return { endpoint: this.endpoint, expirationTime: null, keys: { p256dh: 'P256DH_KEY', auth: 'AUTH_KEY' } }; },
        unsubscribe: async () => { calls.push('sub.unsubscribe'); current = null; return true; },
    });
    let current = o.hasSub ? mkSub(o.subKey || KEY_BYTES) : null;
    const reg = { update: async () => { regCalls.push('update'); }, pushManager: {
        getSubscription: async () => { calls.push('getSubscription'); return current; },
        subscribe: async opt => { calls.push('subscribe'); reg.subscribeOpts = opt; if (o.subscribeFails) throw new Error('boom'); current = mkSub(opt.applicationServerKey); return current; },
    } };
    const navigator = {};
    // swNeedsRegister: igual que en el móvil de una jugadora, el service worker NO existe hasta que alguien llama a register()
    let registered = !o.swNeedsRegister, resolveReady = () => {};
    const readyP = o.swNever ? new Promise(() => {}) : o.swNeedsRegister ? new Promise(r => { resolveReady = r; }) : Promise.resolve(reg);
    if (!o.noSW) navigator.serviceWorker = { ready: readyP, getRegistration: async () => (registered ? reg : undefined),
        register: async url => { regCalls.push('register:' + url); if (o.registerFails) throw new Error('sw boom'); registered = true; resolveReady(reg); return reg; } };
    const window = {}; if (!o.noPushManager) window.PushManager = function PushManager() {};
    const ctx = vm.createContext({ navigator, window, atob, Uint8Array, String, Promise, setTimeout, console: { log: console.log, warn() {} },
        localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } } });
    if (!o.noNotification) ctx.Notification = { get permission() { return state.perm; }, requestPermission: async () => { calls.push('requestPermission'); state.perm = o.prompt; return o.prompt; } };
    vm.runInContext(read('push-client.js') + ';this.PC = PushClient;', ctx);
    const PC = ctx.PC;
    if (o.key !== null) PC.configure({ vapidPublicKey: o.key, swTimeoutMs: 30 });
    const db = o.noDb ? null : { ref: p => ({
        set: async v => { if (o.dbFails) throw new Error('offline'); calls.push('db.set'); ops.push({ op: 'set', path: p, value: JSON.parse(JSON.stringify(v)) }); },
        remove: async () => { if (o.dbFails) throw new Error('offline'); calls.push('db.remove'); ops.push({ op: 'remove', path: p }); },
    }) };
    return { PC, db, calls, ops, regCalls, ls, reg, state, o, getSub: () => current };
}

console.log('\nA) push-client.js');
test('sin clave VAPID: "unconfigured" y no hace nada', async () => {
    const e = loadPush({ key: '' });
    assert.strictEqual(e.PC.isConfigured(), false);
    assert.strictEqual(await e.PC.getState(), 'unconfigured');
    assert.deepStrictEqual(J(await e.PC.enable('u1', e.db)), { ok: false, reason: 'unsupported' });
    assert.deepStrictEqual(e.calls, []);
});
test('la clave que viene VACÍA por defecto en el archivo desactiva la función', () => {
    const e = loadPush({ key: null });
    assert.strictEqual(e.PC.isConfigured(), /const VAPID_PUBLIC_KEY = '[^']+'/.test(read('push-client.js')));
});
test('vista previa → "preview"; sin soporte → "unsupported"', async () => {
    assert.strictEqual(await loadPush().PC.getState({ preview: true }), 'preview');
    assert.strictEqual(await loadPush({ noPushManager: true }).PC.getState(), 'unsupported');
    assert.strictEqual(await loadPush({ noSW: true }).PC.getState(), 'unsupported');
    assert.strictEqual(await loadPush({ noNotification: true }).PC.getState(), 'unsupported');
});
test('estados: bloqueado → denied · sin suscripción → ready · con suscripción y permiso → active', async () => {
    assert.strictEqual(await loadPush({ perm: 'denied' }).PC.getState(), 'denied');
    assert.strictEqual(await loadPush({ perm: 'default' }).PC.getState(), 'ready');
    assert.strictEqual(await loadPush({ perm: 'granted' }).PC.getState(), 'ready');
    assert.strictEqual(await loadPush({ perm: 'granted', hasSub: true }).PC.getState(), 'active');
    assert.strictEqual(await loadPush({ perm: 'default', hasSub: true }).PC.getState(), 'ready', 'sin permiso no cuenta como activa');
});
test('urlBase64ToUint8Array: vector conocido y relleno', () => {
    const { PC } = loadPush();
    assert.deepStrictEqual(Array.from(PC.urlBase64ToUint8Array('-_8')), [0xfb, 0xff]);
    assert.deepStrictEqual(Array.from(PC.urlBase64ToUint8Array('AQID')), [1, 2, 3]);
    const b = PC.urlBase64ToUint8Array(KEY);
    assert.strictEqual(b.length, 65); assert.strictEqual(b[0], 4);
    assert.deepStrictEqual(Buffer.from(b), KEY_BYTES);
});
test('enable: pide el permiso LO PRIMERO y de forma síncrona (requisito de iOS)', async () => {
    const e = loadPush();
    const p = e.PC.enable('u1', e.db);          // sin await
    assert.deepStrictEqual(e.calls, ['requestPermission'], 'requestPermission debe ejecutarse ya, antes de cualquier await');
    await p;
});
test('enable (camino feliz): orden, opciones de subscribe y datos guardados', async () => {
    const e = loadPush();
    const r = await e.PC.enable('u1', e.db);
    assert.deepStrictEqual(J(r), { ok: true });
    assert.deepStrictEqual(e.calls.slice(0, 3), ['requestPermission', 'getSubscription', 'subscribe']);
    assert.strictEqual(e.reg.subscribeOpts.userVisibleOnly, true);
    assert.ok(e.reg.subscribeOpts.applicationServerKey instanceof Uint8Array);
    assert.deepStrictEqual(Buffer.from(e.reg.subscribeOpts.applicationServerKey), KEY_BYTES);
    const sub = e.ops.find(o => o.path === 'pushSubscriptions/u1').value;
    assert.deepStrictEqual(J(Object.keys(sub).sort()), ['endpoint', 'keys', 'updatedAt']);
    assert.strictEqual(sub.endpoint, 'https://web.push.apple.com/ABC123');
    assert.deepStrictEqual(J(sub.keys), { p256dh: 'P256DH_KEY', auth: 'AUTH_KEY' });
    assert.ok(!Number.isNaN(Date.parse(sub.updatedAt)));
    const st = e.ops.find(o => o.path === 'pushStatus/u1').value;
    assert.deepStrictEqual(J(Object.keys(st).sort()), ['active', 'updatedAt']); assert.strictEqual(st.active, true);
    assert.strictEqual(e.ls.pv_push_active, '1');
});
test('enable: los datos cumplen las reglas de Firebase (sin expirationTime ni campos extra)', async () => {
    const e = loadPush(); await e.PC.enable('u1', e.db);
    const sub = e.ops.find(o => o.path === 'pushSubscriptions/u1').value;
    assert.ok(!('expirationTime' in sub)); assert.ok(sub.endpoint.startsWith('https://')); assert.ok(sub.endpoint.length < 1000);
});
test('enable con el permiso ya concedido no vuelve a preguntar', async () => {
    const e = loadPush({ perm: 'granted' }); await e.PC.enable('u1', e.db);
    assert.ok(!e.calls.includes('requestPermission'));
});
test('enable: la jugadora rechaza el permiso → "denied", sin suscribir ni guardar', async () => {
    const e = loadPush({ prompt: 'denied' });
    assert.deepStrictEqual(J(await e.PC.enable('u1', e.db)), { ok: false, reason: 'denied' });
    assert.ok(!e.calls.includes('subscribe')); assert.strictEqual(e.ops.length, 0);
});
test('enable: cierra el aviso sin decidir → "dismissed"', async () => {
    const e = loadPush({ prompt: 'default' });
    assert.deepStrictEqual(J(await e.PC.enable('u1', e.db)), { ok: false, reason: 'dismissed' });
    assert.strictEqual(e.ops.length, 0);
});
test('enable: permiso ya bloqueado en Ajustes → "denied" sin preguntar', async () => {
    const e = loadPush({ perm: 'denied' });
    assert.strictEqual((await e.PC.enable('u1', e.db)).reason, 'denied');
    assert.ok(!e.calls.includes('requestPermission'));
});
test('enable: el service worker no llega a estar listo → "sw" (no se queda colgado)', async () => {
    const e = loadPush({ swNever: true });
    assert.strictEqual((await e.PC.enable('u1', e.db)).reason, 'sw');
    assert.ok(!e.calls.includes('subscribe')); assert.strictEqual(e.ops.length, 0);
});
test('enable: si subscribe() falla → "error" y no se guarda nada', async () => {
    const e = loadPush({ subscribeFails: true });
    assert.strictEqual((await e.PC.enable('u1', e.db)).reason, 'error'); assert.strictEqual(e.ops.length, 0);
});
test('enable: si Firebase falla → "save" (el móvil queda suscrito y se reintentará)', async () => {
    const e = loadPush({ dbFails: true });
    assert.strictEqual((await e.PC.enable('u1', e.db)).reason, 'save');
    assert.ok(e.getSub(), 'la suscripción del móvil debe seguir ahí');
    assert.ok(!e.ls.pv_push_active, 'no debe marcarse como guardada en la nube');
});
test('enable sin base de datos / sin uid → "save"', async () => {
    assert.strictEqual((await loadPush({ noDb: true }).PC.enable('u1', null)).reason, 'save');
    const e = loadPush(); assert.strictEqual((await e.PC.enable(undefined, e.db)).reason, 'save');
});
test('enable: suscripción existente con la MISMA clave se reutiliza', async () => {
    const e = loadPush({ perm: 'granted', hasSub: true });
    assert.deepStrictEqual(J(await e.PC.enable('u1', e.db)), { ok: true });
    assert.ok(!e.calls.includes('subscribe') && !e.calls.includes('sub.unsubscribe'));
});
test('enable: suscripción con OTRA clave (clave rotada) se da de baja y se crea de nuevo', async () => {
    const other = crypto.createECDH('prime256v1'); other.generateKeys();
    const e = loadPush({ perm: 'granted', hasSub: true, subKey: other.getPublicKey() });
    assert.deepStrictEqual(J(await e.PC.enable('u1', e.db)), { ok: true });
    assert.ok(e.calls.indexOf('sub.unsubscribe') < e.calls.indexOf('subscribe'));
    assert.deepStrictEqual(Buffer.from(e.reg.subscribeOpts.applicationServerKey), KEY_BYTES);
});
test('disable: da de baja el móvil y borra las dos entradas de Firebase', async () => {
    const e = loadPush({ perm: 'granted', hasSub: true, ls: { pv_push_active: '1' } });
    assert.deepStrictEqual(J(await e.PC.disable('u1', e.db)), { ok: true });
    assert.ok(e.calls.includes('sub.unsubscribe'));
    assert.deepStrictEqual(e.ops.map(o => `${o.op}:${o.path}`).sort(), ['remove:pushStatus/u1', 'remove:pushSubscriptions/u1']);
    assert.ok(!e.ls.pv_push_active);
});
test('disable: si Firebase falla → "save" y no se borra la marca local', async () => {
    const e = loadPush({ perm: 'granted', hasSub: true, dbFails: true, ls: { pv_push_active: '1' } });
    assert.strictEqual((await e.PC.disable('u1', e.db)).reason, 'save'); assert.strictEqual(e.ls.pv_push_active, '1');
});
test('syncOnOpen: con suscripción vuelve a guardarla UNA vez por sesión', async () => {
    const e = loadPush({ perm: 'granted', hasSub: true });
    assert.strictEqual(await e.PC.syncOnOpen('u1', e.db), 'saved'); assert.strictEqual(e.ops.length, 2);
    assert.strictEqual(await e.PC.syncOnOpen('u1', e.db), 'skip'); assert.strictEqual(e.ops.length, 2);
});
test('syncOnOpen: NUNCA crea una suscripción nueva por su cuenta', async () => {
    const e = loadPush({ perm: 'granted', hasSub: false });
    assert.strictEqual(await e.PC.syncOnOpen('u1', e.db), 'noop');
    assert.ok(!e.calls.includes('subscribe') && !e.calls.includes('requestPermission')); assert.strictEqual(e.ops.length, 0);
});
test('syncOnOpen: retiró el permiso (o caducó) y la nube la daba por activa → limpia el 🔔', async () => {
    const e = loadPush({ perm: 'denied', ls: { pv_push_active: '1' } });
    assert.strictEqual(await e.PC.syncOnOpen('u1', e.db), 'cleared');
    assert.deepStrictEqual(e.ops.map(o => o.op), ['remove', 'remove']); assert.ok(!e.ls.pv_push_active);
});
test('syncOnOpen: sin marca local no borra nada de la nube', async () => {
    const e = loadPush({ perm: 'denied' });
    assert.strictEqual(await e.PC.syncOnOpen('u1', e.db), 'noop'); assert.strictEqual(e.ops.length, 0);
});
test('syncOnOpen: sin conexión no lanza error', async () => {
    const e = loadPush({ perm: 'granted', hasSub: true, dbFails: true });
    assert.strictEqual(await e.PC.syncOnOpen('u1', e.db), 'noop');
});
test('syncOnOpen: sin clave / sin uid / sin base de datos → "skip"', async () => {
    assert.strictEqual(await loadPush({ key: '' }).PC.syncOnOpen('u1', {}), 'skip');
    const e = loadPush({ perm: 'granted', hasSub: true });
    assert.strictEqual(await e.PC.syncOnOpen(null, e.db), 'skip');
    assert.strictEqual(await loadPush({ perm: 'granted', hasSub: true }).PC.syncOnOpen('u1', null), 'skip');
});

// ── Registro del service worker en el móvil de la jugadora ──────────
// La jugadora entra por PlayerView.show() y NUNCA crea RPETracker (que es quien registra sw.js en staff/fisio).
test('registerServiceWorker: instala sw.js UNA sola vez y pide buscar actualizaciones', async () => {
    const e = loadPush({ swNeedsRegister: true });
    const r1 = await e.PC.registerServiceWorker(), r2 = await e.PC.registerServiceWorker();
    assert.deepStrictEqual(J(e.regCalls.filter(c => c.startsWith('register'))), ['register:sw.js']);
    assert.ok(e.regCalls.includes('update'));
    assert.strictEqual(r1, e.reg); assert.strictEqual(r2, e.reg);
});
test('registerServiceWorker: sin clave VAPID no toca nada (la función sigue desactivada)', async () => {
    const e = loadPush({ key: '', swNeedsRegister: true });
    assert.strictEqual(await e.PC.registerServiceWorker(), null); assert.deepStrictEqual(J(e.regCalls), []);
});
test('registerServiceWorker: navegador sin service workers → null, sin error', async () => {
    assert.strictEqual(await loadPush({ noSW: true }).PC.registerServiceWorker(), null);
});
test('registerServiceWorker: si el registro falla devuelve null (no lanza) y se puede reintentar', async () => {
    const e = loadPush({ swNeedsRegister: true, registerFails: true });
    assert.strictEqual(await e.PC.registerServiceWorker(), null);
    e.o.registerFails = false;
    assert.strictEqual(await e.PC.registerServiceWorker(), e.reg, 'el fallo no debe quedar memorizado');
});
test('REGRESIÓN jugadora: con el service worker sin registrar, enable() lo registra y activa los avisos', async () => {
    const e = loadPush({ swNeedsRegister: true });
    assert.deepStrictEqual(J(await e.PC.enable('u1', e.db)), { ok: true }, 'antes del arreglo devolvía {ok:false, reason:"sw"}');
    assert.ok(e.regCalls.includes('register:sw.js'));
    assert.ok(e.getSub(), 'debe quedar una suscripción en el móvil');
    assert.ok(e.ops.some(o => o.path === 'pushSubscriptions/u1') && e.ops.some(o => o.path === 'pushStatus/u1'));
});
test('REGRESIÓN jugadora: tras activar, getState() dice \"active\" (ya no vuelve a ofrecer activar)', async () => {
    const e = loadPush({ swNeedsRegister: true });
    assert.strictEqual(await e.PC.getState(), 'ready', 'antes de activar se ofrece activar');
    await e.PC.enable('u1', e.db);
    assert.strictEqual(await e.PC.getState(), 'active');
});
test('enable: permiso pedido LO PRIMERO aunque el service worker aún no esté registrado (iOS)', async () => {
    const e = loadPush({ swNeedsRegister: true });
    const p = e.PC.enable('u1', e.db);
    assert.deepStrictEqual(J(e.calls), ['requestPermission']); assert.deepStrictEqual(J(e.regCalls), [], 'el registro va DESPUÉS del permiso');
    await p;
});

// ════════════════════════════════════════════════════════════════════
// B) player-view.js — tarjeta "Avisos"
// ════════════════════════════════════════════════════════════════════
function loadPlayerView(pushStub, lang) {
    const els = [], ls = { bk_playerLang: lang || 'es' };
    const appEl = { style: {} };
    const ctx = vm.createContext({ console, Date, Math, JSON, Promise, setTimeout, Set, Object, Array, String, Number, parseInt,
        toLocalISODate: d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`,
        AppAuth: { _currentUser: { uid: 'u1', displayName: 'Ana' }, logout() {} },
        localStorage: { getItem: k => (k in ls ? ls[k] : null), setItem: (k, v) => { ls[k] = String(v); }, removeItem: k => { delete ls[k]; } },
        window: {}, navigator: {},
        document: {
            getElementById: id => id === 'app' ? appEl : null,
            createElement: () => { const el = { innerHTML: '', remove() {}, style: {} }; els.push(el); return el; },
            body: { appendChild() {} }, querySelectorAll: () => [],
        } });
    if (pushStub) ctx.PushClient = pushStub;
    vm.runInContext(read('player-i18n.js') + ';' + read('player-view.js') + ';this.PV = PlayerView; this.I18N = PlayerI18n;', ctx);
    return { PV: ctx.PV, I18N: ctx.I18N, html: () => els[els.length - 1].innerHTML, ctx };
}
function pushStub(state, extra) {
    const s = { states: [], enableCalls: [], disableCalls: [], syncCalls: [], registerCalls: [], order: [], _state: state,
        registerServiceWorker: async () => { s.registerCalls.push(1); s.order.push('register'); return {}; },
        getState: async opts => { s.order.push('getState'); s.states.push(opts); return s._state; },
        enable: (uid, db) => { s.enableCalls.push([uid, db]); return s._enableResult || Promise.resolve({ ok: true }); },
        disable: async (uid, db) => { s.disableCalls.push([uid, db]); return s._disableResult || { ok: true }; },
        syncOnOpen: async (uid, db) => { s.syncCalls.push([uid, db]); return 'saved'; } };
    return Object.assign(s, extra || {});
}

console.log('\nB) Pantalla de la jugadora');
test('sin clave VAPID no se pinta nada (la app queda como siempre)', async () => {
    const v = loadPlayerView(pushStub('unconfigured')); v.PV.show(); await tick();
    assert.ok(!v.html().includes('pv-push-card'));
});
test('si push-client.js no está cargado, la pantalla sigue funcionando', async () => {
    const v = loadPlayerView(null); v.PV.show(); await tick();
    assert.ok(v.html().includes('pv-menu-btn') && !v.html().includes('pv-push-card'));
});
test('estado "ready": botón Activar avisos y se sincroniza al abrir (con su uid)', async () => {
    const stub = pushStub('ready'); const v = loadPlayerView(stub); v.PV.show(); await tick(); await tick();
    assert.ok(v.html().includes('pv-push-card') && v.html().includes('Activar avisos') && v.html().includes('PlayerView._onEnablePush()'));
    assert.deepStrictEqual(J(stub.states[0]), { preview: false });
    assert.strictEqual(stub.syncCalls.length, 1); assert.strictEqual(stub.syncCalls[0][0], 'u1');
});
test('al abrir la pantalla de la jugadora se registra el service worker ANTES de consultar el estado', async () => {
    const stub = pushStub('ready'); const v = loadPlayerView(stub); v.PV.show(); await tick(); await tick();
    assert.deepStrictEqual(J(stub.order), ['register', 'getState']);
});
test('vista previa del staff: no registra nada (el staff ya lo tiene por RPETracker)', async () => {
    const stub = pushStub('preview'); const v = loadPlayerView(stub); v.PV.showPreview(); await tick(); await tick();
    assert.strictEqual(stub.registerCalls.length, 0);
});
test('la tarjeta explica para qué se usa y que se puede desactivar', async () => {
    const v = loadPlayerView(pushStub('ready')); v.PV.show(); await tick();
    assert.ok(v.html().includes('recordatorio') && v.html().includes('Puedes desactivarlos cuando quieras'));
});
test('vista previa del staff: texto informativo, SIN botón y SIN sincronizar nada real', async () => {
    const stub = pushStub('preview'); const v = loadPlayerView(stub); v.PV.showPreview(); await tick(); await tick();
    assert.deepStrictEqual(J(stub.states[0]), { preview: true });
    assert.ok(v.html().includes('Vista previa: los avisos solo se activan') && !v.html().includes('_onEnablePush'));
    assert.strictEqual(stub.syncCalls.length, 0);
    v.PV._onEnablePush(); assert.strictEqual(stub.enableCalls.length, 0, 'en vista previa no se puede activar');
});
test('pulsar Activar: llama a enable() DE INMEDIATO (gesto), muestra "Activando…" y luego "activados"', async () => {
    const stub = pushStub('ready'); let finish;
    stub._enableResult = new Promise(r => { finish = r; });
    const v = loadPlayerView(stub); v.PV.show(); await tick(); await tick();
    v.PV._onEnablePush();
    assert.strictEqual(stub.enableCalls.length, 1, 'enable() debe llamarse de forma síncrona dentro del toque');
    assert.deepStrictEqual(stub.enableCalls[0][0], 'u1');
    assert.ok(v.html().includes('Activando…') && !v.html().includes('_onEnablePush'));
    finish({ ok: true }); await tick(); await tick();
    assert.ok(v.html().includes('✅ Avisos activados en este móvil') && v.html().includes('Desactivar avisos'));
});
test('doble toque mientras se activa → una sola llamada', async () => {
    const stub = pushStub('ready'); stub._enableResult = new Promise(() => {});
    const v = loadPlayerView(stub); v.PV.show(); await tick(); await tick();
    v.PV._onEnablePush(); v.PV._onEnablePush(); v.PV._onEnablePush();
    assert.strictEqual(stub.enableCalls.length, 1);
});
const failCase = (reason, expectText, expectBtn) => async () => {
    const stub = pushStub('ready'); stub._enableResult = Promise.resolve({ ok: false, reason });
    const v = loadPlayerView(stub); v.PV.show(); await tick(); await tick();
    v.PV._onEnablePush(); await tick(); await tick();
    assert.ok(v.html().includes(expectText), `falta "${expectText}" para ${reason}`);
    assert.strictEqual(v.html().includes('_onEnablePush'), expectBtn, `botón de activar tras ${reason}`);
};
test('permiso rechazado → explica cómo desbloquear en Ajustes', failCase('denied', 'Ajustes → Notificaciones', false));
test('cierra el aviso sin decidir → mensaje y puede reintentar', failCase('dismissed', 'No se han activado', true));
test('el service worker no está listo → pide cerrar y abrir la app', failCase('sw', 'Ciérrala del todo', true));
test('error al suscribir → mensaje genérico y puede reintentar', failCase('error', 'No se pudo completar', true));
test('no se pudo guardar en la nube → queda activo con aviso de reintento', failCase('save', 'Se reintentará al abrir la app', false));
test('móvil sin soporte → mensaje sobre iOS 16.4', failCase('unsupported', 'iOS 16.4', false));
test('si enable() lanza una excepción no rompe la pantalla', async () => {
    const stub = pushStub('ready'); stub.enable = () => Promise.reject(new Error('x'));
    const v = loadPlayerView(stub); v.PV.show(); await tick(); await tick();
    v.PV._onEnablePush(); await tick(); await tick();
    assert.ok(v.html().includes('No se pudo completar') && v.html().includes('pv-menu-btn'));
});
test('estado "denied" desde el principio y "unsupported" se explican sin botón', async () => {
    let v = loadPlayerView(pushStub('denied')); v.PV.show(); await tick(); await tick();
    assert.ok(v.html().includes('Ajustes → Notificaciones') && !v.html().includes('_onEnablePush'));
    v = loadPlayerView(pushStub('unsupported')); v.PV.show(); await tick(); await tick();
    assert.ok(v.html().includes('iOS 16.4') && !v.html().includes('_onEnablePush'));
});
test('Desactivar: llama a disable(), vuelve a "Activar avisos"', async () => {
    const stub = pushStub('active'); const v = loadPlayerView(stub); v.PV.show(); await tick(); await tick();
    assert.ok(v.html().includes('Desactivar avisos'));
    await v.PV._onDisablePush();
    assert.strictEqual(stub.disableCalls.length, 1);
    assert.ok(v.html().includes('Activar avisos') && !v.html().includes('Desactivar avisos'));
});
test('Desactivar falla → mensaje y sigue activo', async () => {
    const stub = pushStub('active'); stub._disableResult = { ok: false, reason: 'save' };
    const v = loadPlayerView(stub); v.PV.show(); await tick(); await tick();
    await v.PV._onDisablePush();
    assert.ok(v.html().includes('No se pudo completar') && v.html().includes('Desactivar avisos'));
});
test('en inglés se ve en inglés', async () => {
    const v = loadPlayerView(pushStub('ready'), 'en'); v.PV.show(); await tick(); await tick();
    assert.ok(v.html().includes('Turn on reminders') && !v.html().includes('Activar avisos'));
});
test('todos los textos pvPush* existen en español Y en inglés (distintos entre sí)', () => {
    const keys = [...read('player-i18n.js').matchAll(/^\s*(pvPush\w+):/gm)].map(m => m[1]);
    const uniq = [...new Set(keys)];
    assert.ok(uniq.length >= 14, 'faltan textos: ' + uniq.length);
    assert.strictEqual(keys.length, uniq.length * 2, 'cada texto debe estar exactamente en ES y en EN');
    const es = loadPlayerView(null, 'es').I18N, en = loadPlayerView(null, 'en').I18N;
    uniq.forEach(k => { assert.ok(es.t(k) && en.t(k), 'falta ' + k); assert.notStrictEqual(es.t(k), en.t(k), k + ' sin traducir'); });
});
test('los textos con comillas o HTML no rompen la tarjeta (se escapan)', async () => {
    const v = loadPlayerView(pushStub('ready'), 'en'); v.PV.show(); await tick(); await tick();
    assert.ok(!/<script/i.test(v.html()));
});

// ════════════════════════════════════════════════════════════════════
// C) sw.js
// ════════════════════════════════════════════════════════════════════
const SCOPE = 'https://jairopf-coder.github.io/basketball-rpe-tracker/';
function loadSw(opts) {
    const o = Object.assign({ failOn: null, windows: [], cached: {} }, opts || {});
    const L = {}, shown = [], added = [], opened = [], puts = [], fetched = [];
    const st = { skipped: false, claimed: false };
    const self = { registration: { scope: SCOPE, showNotification: (t, op) => { shown.push({ t, op }); return Promise.resolve(); } },
        addEventListener: (n, f) => { L[n] = f; }, skipWaiting: () => { st.skipped = true; return Promise.resolve(); },
        clients: { claim: async () => { st.claimed = true; } }, location: { origin: 'https://jairopf-coder.github.io' } };
    const cache = { add: async u => { if (o.failOn && o.failOn(u)) throw new Error('404 ' + u); added.push(u); }, put: async (r, res) => { puts.push(r.url); } };
    const caches = { open: async () => cache, keys: async () => [], delete: async () => true, match: async r => o.cached[typeof r === 'string' ? r : r.url] };
    const clients = { matchAll: async () => o.windows, openWindow: async u => { opened.push(u); } };
    const ctx = vm.createContext({ self, caches, clients, URL, console: { warn() {}, log() {} }, Promise, Object, JSON,
        fetch: async req => { fetched.push(req.url); if (o.fetchFails) throw new Error('offline'); return o.response || { ok: true, status: 200, clone() { return this; } }; } });
    vm.runInContext(read('sw.js'), ctx);
    const fire = async (name, ev) => { let p; ev.waitUntil = x => { p = x; }; L[name](ev); await p; };
    return { L, ctx, shown, added, opened, puts, fetched, st, fire, list: () => vm.runInContext('urlsToCache', ctx) };
}
const pushEv = data => ({ data });
const jsonData = obj => ({ json: () => obj, text: () => JSON.stringify(obj) });

console.log('\nC) sw.js');
test('instalación: todo se cachea DENTRO de /basketball-rpe-tracker/ (nada en la raíz del dominio)', async () => {
    const s = loadSw(); await s.fire('install', {});
    assert.strictEqual(s.added.length, s.list().length);
    s.added.forEach(u => assert.ok(u.startsWith(SCOPE), 'fuera del scope: ' + u));
    assert.ok(s.added.includes(SCOPE) && s.added.includes(SCOPE + 'index.html') && s.added.includes(SCOPE + 'push-client.js'));
    assert.ok(!s.added.some(u => u === 'https://jairopf-coder.github.io/' || u === 'https://jairopf-coder.github.io/index.html'));
    assert.ok(s.st.skipped);
});
test('instalación TOLERANTE: un archivo que da error no impide instalar el service worker', async () => {
    const s = loadSw({ failOn: u => u.endsWith('index.html') || u.endsWith('wellness.js') }); await s.fire('install', {});
    assert.ok(s.st.skipped, 'la instalación debe completarse');
    assert.strictEqual(s.added.length, s.list().length - 2);
});
test('todos los archivos de la lista de caché EXISTEN en el proyecto (ninguno daría 404)', () => {
    const missing = loadSw().list().filter(p => p !== '' && !fs.existsSync(path.join(ROOT, p)));
    assert.deepStrictEqual(J(missing), [], 'archivos inexistentes: ' + missing.join(', '));
});
test('ninguna ruta de la lista empieza por "/" (se rompería fuera de la raíz del dominio)', () => {
    assert.deepStrictEqual(J(loadSw().list().filter(p => p.startsWith('/'))), []);
});
test('todos los .js que carga index.html están en la lista de caché', () => {
    const inHtml = [...read('index.html').matchAll(/<script src="([^"]+\.js)"/g)].map(m => m[1]).filter(s => !/^https?:/.test(s));
    const list = loadSw().list();
    assert.deepStrictEqual(J(inHtml.filter(f => !list.includes(f))), []);
});
test('push con JSON: título, texto, etiqueta e iconos dentro de la app', async () => {
    const s = loadSw(); await s.fire('push', pushEv(jsonData({ title: 'Recuerda', body: 'Rellena tu wellness', tag: 'wellness' })));
    assert.strictEqual(s.shown.length, 1);
    const { t, op } = s.shown[0];
    assert.strictEqual(t, 'Recuerda'); assert.strictEqual(op.body, 'Rellena tu wellness'); assert.strictEqual(op.tag, 'wellness');
    assert.strictEqual(op.icon, SCOPE + 'icon-192.png'); assert.strictEqual(op.badge, SCOPE + 'icon-192.png');
    assert.ok(!op.icon.startsWith('/icon'), 'el icono no puede apuntar a la raíz del dominio');
});
test('push SIN contenido: MUESTRA igualmente una notificación (si no, iOS puede cancelar la suscripción)', async () => {
    const s = loadSw(); await s.fire('push', pushEv(null));
    assert.strictEqual(s.shown.length, 1); assert.strictEqual(s.shown[0].t, 'Load Ctrl');
    const s2 = loadSw(); await s2.fire('push', {});
    assert.strictEqual(s2.shown.length, 1);
});
test('push con texto plano o JSON roto: se muestra el texto', async () => {
    const s = loadSw(); await s.fire('push', pushEv({ json: () => { throw new SyntaxError('x'); }, text: () => 'Hola equipo' }));
    assert.strictEqual(s.shown[0].op.body, 'Hola equipo');
});
test('push con url: se guarda en los datos de la notificación', async () => {
    const s = loadSw(); await s.fire('push', pushEv(jsonData({ title: 'x', url: 'index.html#wellness' })));
    assert.strictEqual(s.shown[0].op.data.url, 'index.html#wellness');
});
const clickEv = data => { const ev = { notification: { data, close() { ev.closed = true; } } }; return ev; };
test('clic sin ventanas abiertas → abre el inicio de la app (no la raíz del dominio)', async () => {
    const s = loadSw(); const ev = clickEv({}); await s.fire('notificationclick', ev);
    assert.ok(ev.closed); assert.deepStrictEqual(J(s.opened), [SCOPE]);
});
test('clic con url relativa → se abre dentro de la app', async () => {
    const s = loadSw(); await s.fire('notificationclick', clickEv({ url: 'index.html#wellness' }));
    assert.deepStrictEqual(J(s.opened), [SCOPE + 'index.html#wellness']);
});
test('clic con url de OTRO sitio o peligrosa → se ignora y va al inicio de la app', async () => {
    for (const bad of ['https://evil.example/phish', '//evil.example/x', 'javascript:alert(1)', 'https://jairopf-coder.github.io/otra-app/']) {
        const s = loadSw(); await s.fire('notificationclick', clickEv({ url: bad }));
        assert.deepStrictEqual(J(s.opened), [SCOPE], 'no debe abrir ' + bad);
    }
});
test('clic con la app ya abierta → la enfoca y no abre otra', async () => {
    let focused = 0; const win = { url: SCOPE + 'index.html', focus: () => { focused++; return Promise.resolve(); } };
    const s = loadSw({ windows: [win] }); await s.fire('notificationclick', clickEv({}));
    assert.strictEqual(focused, 1); assert.strictEqual(s.opened.length, 0);
});
test('clic con una pestaña de OTRA ruta del mismo dominio abierta → abre la app (no la enfoca)', async () => {
    let focused = 0; const win = { url: 'https://jairopf-coder.github.io/otra-app/', focus: () => { focused++; } };
    const s = loadSw({ windows: [win] }); await s.fire('notificationclick', clickEv({}));
    assert.strictEqual(focused, 0); assert.deepStrictEqual(J(s.opened), [SCOPE]);
});
test('navegación: red primero (código fresco) y respuesta guardada solo si es correcta', async () => {
    const s = loadSw(); let resp; s.L.fetch({ request: { url: SCOPE, mode: 'navigate', method: 'GET' }, respondWith: p => { resp = p; } });
    await resp; await tick(); assert.deepStrictEqual(J(s.fetched), [SCOPE]); assert.deepStrictEqual(J(s.puts), [SCOPE]);
});
test('una respuesta 404 NO se guarda en la caché', async () => {
    const s = loadSw({ response: { ok: false, status: 404, clone() { return this; } } });
    let resp; s.L.fetch({ request: { url: SCOPE + 'x.js', mode: 'no-cors', method: 'GET' }, respondWith: p => { resp = p; } });
    await resp; await tick(); assert.strictEqual(s.puts.length, 0);
});
test('sin conexión: la navegación se atiende con index.html guardado', async () => {
    const cached = { ok: true, marker: 'INDEX' };
    const s = loadSw({ fetchFails: true, cached: { [SCOPE + 'index.html']: cached } });
    let resp; s.L.fetch({ request: { url: SCOPE, mode: 'navigate', method: 'GET' }, respondWith: p => { resp = p; } });
    assert.strictEqual(await resp, cached);
});
test('mensaje SHOW_NOTIFICATION (avisos locales del staff) usa los iconos de la app', async () => {
    const s = loadSw(); s.L.message({ data: { type: 'SHOW_NOTIFICATION', title: 'A:C alto', body: 'Revisar' } });
    assert.strictEqual(s.shown[0].op.icon, SCOPE + 'icon-192.png');
});

// ════════════════════════════════════════════════════════════════════
// D) Lado staff: 🔔 en "Faltan hoy"
// ════════════════════════════════════════════════════════════════════
const dom = { widgets: { innerHTML: '' } };
function loadStaff(pushOn, withDb) {
    const ctx = vm.createContext({ console: { warn() {}, log() {} }, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise,
        esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
        document: { head: { appendChild() {} }, getElementById: id => id === 'dbRightWidgets' ? dom.widgets : null, createElement: () => ({ style: {} }), body: {} },
        window: {}, navigator: {} });
    vm.runInContext(`function RPETracker(){}; function toLocalISODate(d){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}`, ctx);
    vm.runInContext(read('dashboard-renderer.js'), ctx);
    if (pushOn !== null) ctx.PushClient = { isConfigured: () => pushOn };
    const refs = [];
    if (withDb) ctx.window.firebaseDB = { ref: p => ({ on: (ev, cb, errCb) => { refs.push({ p, ev, cb, errCb }); } }) };
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = [{ id: 'p1', name: 'Ana Pérez', authUid: 'uA' }, { id: 'p2', name: 'Bea Ruiz', authUid: 'uB' }, { id: 'p3', name: 'Carla Gil' }];
    t.wellnessData = []; t.sessions = []; t.injuries = []; t._playerRpeRaw = [];
    t.toasts = []; t.showToast = (m, ty) => t.toasts.push([m, ty]);
    t.renders = 0; t.currentView = 'dashboard'; t.renderDashboard = () => { t.renders++; };
    return { t, refs, ctx };
}
console.log('\nD) Lado staff');
test('sin la función activada (sin clave): ni 🔔 ni leyenda', () => {
    const { t } = loadStaff(null); t._pushStatus = { uA: { active: true } };
    t._renderRightWidgets(); assert.ok(!dom.widgets.innerHTML.includes('🔔'));
});
test('con la función activada: 🔔 solo junto a quien tiene los avisos activos', () => {
    const { t } = loadStaff(true); t._pushStatus = { uA: { active: true }, uB: { active: false } };
    t._renderRightWidgets(); const h = dom.widgets.innerHTML;
    assert.ok(h.includes('Ana 🔔') && h.includes('Bea,') && !h.includes('Bea 🔔') && !h.includes('Carla 🔔'));
    assert.ok(h.includes('🔔 = tiene los avisos activados en su móvil'));
});
test('la leyenda aparece con la función activada aunque nadie tenga 🔔', () => {
    const { t } = loadStaff(true); t._pushStatus = {};
    t._renderRightWidgets(); assert.ok(dom.widgets.innerHTML.includes('🔔 = tiene'));
});
test('el mensaje de WhatsApp NO lleva 🔔', () => {
    const { t } = loadStaff(true); t._pushStatus = { uA: { active: true } };
    assert.ok(!t._pendingNoticeText().includes('🔔'));
});
test('jugadora sin cuenta vinculada (sin authUid) nunca lleva 🔔', () => {
    const { t } = loadStaff(true); t._pushStatus = { undefined: { active: true } };
    assert.strictEqual(t._hasPushActive(t.players[2]), false);
});
test('listener: no se registra sin clave o sin Firebase', () => {
    let s = loadStaff(false, true); s.t._registerPushStatusListener(); assert.strictEqual(s.refs.length, 0);
    s = loadStaff(true, false); s.t._registerPushStatusListener(); assert.strictEqual(s.refs.length, 0);
    s = loadStaff(null, true); s.t._registerPushStatusListener(); assert.strictEqual(s.refs.length, 0);
});
test('listener: se registra UNA vez en /pushStatus, actualiza el estado y repinta Inicio', () => {
    const { t, refs } = loadStaff(true, true);
    t._registerPushStatusListener(); t._registerPushStatusListener();
    assert.strictEqual(refs.length, 1); assert.strictEqual(refs[0].p, 'pushStatus'); assert.strictEqual(refs[0].ev, 'value');
    refs[0].cb({ val: () => ({ uA: { active: true } }) });
    assert.deepStrictEqual(J(t._pushStatus), { uA: { active: true } }); assert.strictEqual(t.renders, 1);
    t.currentView = 'sessions'; refs[0].cb({ val: () => null });
    assert.deepStrictEqual(J(t._pushStatus), {}); assert.strictEqual(t.renders, 1, 'solo repinta si estás en Inicio');
});
test('listener: sin permisos (reglas sin publicar) no rompe nada y no muestra 🔔', () => {
    const { t, refs } = loadStaff(true, true); t._registerPushStatusListener();
    t._pushStatus = { uA: { active: true } };
    assert.doesNotThrow(() => refs[0].errCb({ code: 'PERMISSION_DENIED' }));
    assert.deepStrictEqual(J(t._pushStatus), {});
});

// ════════════════════════════════════════════════════════════════════
// E) Estructura: reglas, index.html y clave pegada
// ════════════════════════════════════════════════════════════════════
console.log('\nE) Estructura');
test('index.html carga push-client.js, antes de player-view.js y de app.js', () => {
    const h = read('index.html');
    const i = h.indexOf('<script src="push-client.js">');
    assert.ok(i > 0);
    assert.ok(i < h.indexOf('<script src="player-view.js">') && i < h.indexOf('<script src="app.js">'));
});
test('app.js registra el listener de /pushStatus junto al de RPE', () => {
    assert.ok(/_registerPushStatusListener\(\)/.test(read('app.js')));
});
test('reglas: suscripciones solo de su dueña (sin acceso del staff); estado legible por staff', () => {
    const r = JSON.parse(read('firebase-rules.json')).rules;
    const subs = r.pushSubscriptions.$uid;
    assert.strictEqual(subs['.read'], 'auth != null && auth.uid === $uid');
    assert.strictEqual(subs['.write'], 'auth != null && auth.uid === $uid');
    assert.ok(!/role/.test(JSON.stringify(r.pushSubscriptions)), 'las suscripciones no deben depender del rol (el staff no las lee)');
    assert.ok(!r.pushSubscriptions['.read'] && !r.pushSubscriptions['.write'], 'sin permisos a nivel de nodo');
    assert.ok(/role'\)\.val\(\) !== 'player'/.test(r.pushStatus['.read']), 'staff y fisio leen pushStatus');
    assert.strictEqual(r.pushStatus.$uid['.write'], 'auth != null && auth.uid === $uid');
    assert.strictEqual(subs.$other['.validate'], false); assert.strictEqual(r.pushStatus.$uid.$other['.validate'], false);
    assert.ok(r.$other, 'el comodín $other sigue ahí (no se ha tocado lo demás)');
});
test('la clave VAPID pegada en push-client.js (si hay) es válida: 65 bytes que empiezan por 0x04', () => {
    const m = read('push-client.js').match(/const VAPID_PUBLIC_KEY = '([^']*)';/);
    assert.ok(m, 'no se encuentra la constante VAPID_PUBLIC_KEY');
    if (m[1] === '') return;   // función aún desactivada: correcto
    assert.ok(/^[A-Za-z0-9_-]+$/.test(m[1]), 'la clave tiene espacios o caracteres no válidos');
    const b = Buffer.from(m[1], 'base64url');
    assert.strictEqual(b.length, 65, `la clave pública debe decodificar a 65 bytes (tiene ${b.length}); ¿has pegado la privada o la has cortado?`);
    assert.strictEqual(b[0], 4);
});
test('push-client.js y app.js registran el MISMO archivo (sw.js): un solo service worker para todos', () => {
    assert.ok(/register\('sw\.js'\)/.test(read('push-client.js')), 'push-client.js debe registrar sw.js');
    assert.ok(/register\('sw\.js'\)/.test(read('app.js')), 'app.js debe registrar sw.js');
});
test('la clave PRIVADA nunca está en el código', () => {
    // Una clave privada VAPID son 32 bytes en base64url = 43 caracteres sin relleno
    ['push-client.js', 'sw.js', 'player-view.js', 'dashboard-renderer.js', 'app.js'].forEach(f => {
        assert.ok(!/['"`][A-Za-z0-9_-]{43}['"`]/.test(read(f)), `posible clave privada en ${f}`);
    });
});

(async () => {
    for (const q of queue) {
        try { await q.fn(); console.log(`  ✅ ${q.name}`); passed++; }
        catch (e) { console.log(`  ❌ ${q.name}\n     ${String(e.message).split('\n')[0]}`); failed++; }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

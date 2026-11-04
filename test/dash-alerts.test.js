// test/dash-alerts.test.js
// Avisos de Inicio en una línea plegable (dashboard-alerts.js):
//  · qué avisos hay y su identificador · estados (nuevos / vistos hoy / algunos nuevos)
//  · «Marcar como visto por hoy»: se guarda en el dispositivo y en Firebase, y se puede volver a ver la lista
//  · sincronización: lo marcado en otro dispositivo llega sin recargar; sin conexión no rompe nada
//  · escape de nombres y de ids · recordatorio de planificación (solo domingos)
// Ejecutar con:  node test/dash-alerts.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
const ROOT = path.join(__dirname, '..');
const same = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);

// Reloj controlable: miércoles 4-nov-2026 por defecto
let NOW = new Date(2026, 10, 4, 10, 0);
class FakeDate extends Date {
    constructor(...a) { if (a.length) super(...a); else super(NOW.getTime()); }
    static now() { return NOW.getTime(); }
}

// Base de datos simulada: on() dispara al registrarse, set() dispara el listener
function makeDB(opts = {}) {
    const data = {}, listeners = {}, writes = [], ons = [];
    return {
        data, writes, ons, listeners,
        ref: p => ({
            on(ev, cb, errCb) { ons.push(p); listeners[p] = { cb, errCb }; cb({ val: () => (data[p] === undefined ? null : data[p]) }); },
            set(v) { writes.push([p, JSON.parse(JSON.stringify(v))]); if (opts.failWrites) return Promise.reject(new Error('sin red')); data[p] = v; if (listeners[p]) listeners[p].cb({ val: () => v }); return Promise.resolve(); },
        }),
        emit(p, v) { data[p] = v; listeners[p].cb({ val: () => v }); },
    };
}

function makeEnv({ uid = 'u1', db = makeDB(), ls = {} } = {}) {
    const store = Object.assign({}, ls);
    const el = { cls: new Set(), attrs: {}, classList: { toggle(c, on) { on ? el.cls.add(c) : el.cls.delete(c); } },
        querySelector: () => ({ setAttribute(k, v) { el.attrs[k] = v; } }) };
    const ctx = vm.createContext({
        console: { log() {}, warn() {}, error() {} }, Date: FakeDate, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, isFinite, Promise, Map,
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
        document: { getElementById: id => (id === 'dashAlerts' ? el : null), addEventListener() {}, createElement: () => ({ style: {} }), head: { appendChild() {} } },
        window: { firebaseAuth: uid ? { currentUser: { uid } } : { currentUser: null }, firebaseDB: db },
    });
    const sec = fs.readFileSync(path.join(ROOT, 'security.js'), 'utf8');
    vm.runInContext(sec + '\n;globalThis.esc = esc;', ctx);       // esc() REAL
    vm.runInContext(`function RPETracker() {}
        function toLocalISODate(d){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}`, ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'dashboard-alerts.js'), 'utf8'), ctx, { filename: 'dashboard-alerts.js' });
    const t = vm.runInContext('new RPETracker()', ctx);
    t.renders = 0; t.currentView = 'dashboard';
    t.renderDashboard = function() { this.renders++; };
    return { t, db, store, el, ctx };
}

const P = (id, name) => ({ player: { id, name } });
const DATA = () => ({
    dangerPlayers: [P('p1', 'Marta Ruiz'), P('p2', 'Lucía'), P('p3', 'Alba')],
    warnPlayers: [P('p4', 'Sofía')],
    trendAlerts: [{ type: 'trend', kind: 'sleep', playerId: 'p5', name: 'Ana Pérez', message: 'Sueño deficiente 3+ días consecutivos (≤2/5)' }],
    rpeDiscrepancies: [{ sessionId: 's1', playerName: 'Irene', staffRpe: 6, playerRpe: 8, date: '2026-11-02' }],
    teamThreshold: 3,
});
const KEYS = ['ac:d:p1', 'ac:d:p2', 'ac:d:p3', 'ac:w:p4', 'wt:p5:sleep', 'rpe:s1'];

console.log('\nQué avisos hay');
test('cada aviso lleva un identificador estable y no se cuenta el aviso de equipo', () => {
    const a = makeEnv().t._collectDashAlerts(DATA());
    same(a.keys, KEYS); assert.strictEqual(a.total, 6); assert.strictEqual(a.team, true);
    assert.strictEqual(a.danger[0].name, 'Marta');   // primer nombre
});
test('con menos de 3 en peligro no hay aviso de equipo', () => {
    const d = DATA(); d.dangerPlayers = d.dangerPlayers.slice(0, 2);
    assert.strictEqual(makeEnv().t._collectDashAlerts(d).team, false);
});
test('sin avisos no se pinta nada, y datos raros (no-listas) no rompen', () => {
    const { t } = makeEnv();
    assert.strictEqual(t._renderDashAlerts({ dangerPlayers: [], warnPlayers: [], trendAlerts: [], rpeDiscrepancies: [] }), '');
    assert.doesNotThrow(() => t._renderDashAlerts({ dangerPlayers: null, warnPlayers: undefined, trendAlerts: [], rpeDiscrepancies: () => [] }));
    assert.strictEqual(t._renderDashAlerts({ rpeDiscrepancies: () => [] }), '');
});

console.log('\nLínea plegable');
test('por defecto: plegada, «N avisos» con chips por tipo y botón «Marcar como visto por hoy»', () => {
    const html = makeEnv().t._renderDashAlerts(DATA());
    assert.ok(html.includes('6 avisos'));
    assert.ok(html.includes('A:C 4') && html.includes('Wellness 1') && html.includes('RPE 1'));
    assert.ok(html.includes('aria-expanded="false"') && !html.includes('is-open'));
    assert.ok(html.includes('Marcar como visto por hoy') && !html.includes('db-alerts--seen'));
});
test('un solo aviso dice «1 aviso»', () => {
    const html = makeEnv().t._renderDashAlerts({ dangerPlayers: [], warnPlayers: [P('p4', 'Sofía')], trendAlerts: [], rpeDiscrepancies: [] });
    assert.ok(html.includes('>1 aviso<'));
});
test('la lista desplegable contiene todos los avisos con sus botones', () => {
    const html = makeEnv().t._renderDashAlerts(DATA());
    ['Marta, Lucía, Alba', 'Sofía', 'Ana', 'Sueño deficiente', 'Irene', 'tú: 6, ella: 8', 'Ver detalle', 'Revisar'].forEach(x => assert.ok(html.includes(x), 'falta ' + x));
});
test('desplegar/plegar cambia la clase y aria-expanded sin repintar Inicio, y el estado se recuerda al repintar', () => {
    const { t, el } = makeEnv();
    t.toggleDashAlerts();
    assert.ok(el.cls.has('is-open')); assert.strictEqual(el.attrs['aria-expanded'], 'true'); assert.strictEqual(t.renders, 0);
    assert.ok(t._renderDashAlerts(DATA()).includes('is-open'), 'abierta tras repintar');
    t.toggleDashAlerts();
    assert.ok(!el.cls.has('is-open')); assert.ok(!t._renderDashAlerts(DATA()).includes('is-open'));
});

console.log('\n«Marcar como visto por hoy»');
test('guarda hoy + los identificadores ordenados en el dispositivo y en Firebase, y repinta', () => {
    const { t, db, store } = makeEnv();
    t._renderDashAlerts(DATA());
    t.markDashAlertsSeen();
    const rec = { date: '2026-11-04', keys: [...KEYS].sort().join(',') };
    same(JSON.parse(store['basketballDashAlertsSeen_u1']), rec);
    same(db.writes.find(w => w[0] === 'staffAlertsSeen/u1')[1], rec);
    assert.strictEqual(t.renders, 1);
});
test('lo guardado no contiene nombres ni datos de wellness, solo identificadores', () => {
    const { t, store } = makeEnv();
    t._renderDashAlerts(DATA()); t.markDashAlertsSeen();
    const raw = store['basketballDashAlertsSeen_u1'];
    ['Marta', 'Lucía', 'Sofía', 'Sueño', 'Irene'].forEach(n => assert.ok(!raw.includes(n), 'no debe guardar ' + n));
});
test('después: «Avisos vistos hoy: N», en gris, SIN botón, y la lista sigue disponible', () => {
    const { t } = makeEnv();
    t._renderDashAlerts(DATA()); t.markDashAlertsSeen();
    const html = t._renderDashAlerts(DATA());
    assert.ok(html.includes('Avisos vistos hoy: 6') && html.includes('db-alerts--seen'));
    assert.ok(!html.includes('Marcar como visto'));
    ['Marta, Lucía, Alba', 'Sueño deficiente', 'Revisar'].forEach(x => assert.ok(html.includes(x), 'la lista debe poder verse: ' + x));
});
test('no desaparece «para siempre»: los avisos se recalculan, solo la marca se guarda', () => {
    const { t } = makeEnv();
    t._renderDashAlerts(DATA()); t.markDashAlertsSeen();
    t._dashAlertsOpen = true;
    assert.ok(t._renderDashAlerts(DATA()).includes('Sueño deficiente'));
});
test('si aparece un aviso NUEVO vuelve a destacarse: «7 avisos · 1 nuevo» y con botón', () => {
    const { t } = makeEnv();
    t._renderDashAlerts(DATA()); t.markDashAlertsSeen();
    const d = DATA(); d.warnPlayers.push(P('p9', 'Noa'));
    const html = t._renderDashAlerts(d);
    assert.ok(html.includes('7 avisos · 1 nuevo') && !html.includes('db-alerts--seen') && html.includes('Marcar como visto'));
});
test('si un aviso se resuelve (desaparece) NO se destaca de nuevo', () => {
    const { t } = makeEnv();
    t._renderDashAlerts(DATA()); t.markDashAlertsSeen();
    const d = DATA(); d.dangerPlayers = d.dangerPlayers.slice(0, 1); d.rpeDiscrepancies = [];
    assert.ok(t._renderDashAlerts(d).includes('Avisos vistos hoy: 3'));
});
test('al día siguiente vuelve a destacarse aunque sean los mismos avisos', () => {
    const { t } = makeEnv();
    t._renderDashAlerts(DATA()); t.markDashAlertsSeen();
    NOW = new Date(2026, 10, 5, 9, 0);
    try {
        const html = t._renderDashAlerts(DATA());
        assert.ok(html.includes('6 avisos') && !html.includes('db-alerts--seen'));
    } finally { NOW = new Date(2026, 10, 4, 10, 0); }
});
test('marcar sin avisos no hace nada', () => {
    const { t, db } = makeEnv();
    t._renderDashAlerts({ dangerPlayers: [], warnPlayers: [], trendAlerts: [], rpeDiscrepancies: [] });
    t.markDashAlertsSeen();
    assert.strictEqual(db.writes.length, 0); assert.strictEqual(t.renders, 0);
});

console.log('\nSincronización entre dispositivos');
test('la primera vez carga la marca guardada en el dispositivo y registra UN solo listener', () => {
    const rec = { date: '2026-11-04', keys: [...KEYS].sort().join(',') };
    const { t, db } = makeEnv({ ls: { basketballDashAlertsSeen_u1: JSON.stringify(rec) } });
    assert.ok(t._renderDashAlerts(DATA()).includes('Avisos vistos hoy: 6'));
    t._renderDashAlerts(DATA()); t._renderDashAlerts(DATA());
    assert.deepStrictEqual(db.ons, ['staffAlertsSeen/u1']);
});
test('lo marcado en otro dispositivo llega sin recargar: se actualiza y Inicio se repinta', () => {
    const { t, db, store } = makeEnv();
    t._renderDashAlerts(DATA());
    const rec = { date: '2026-11-04', keys: [...KEYS].sort().join(',') };
    db.emit('staffAlertsSeen/u1', rec);
    assert.ok(t._renderDashAlerts(DATA()).includes('Avisos vistos hoy: 6'));
    assert.strictEqual(t.renders, 1);
    same(JSON.parse(store['basketballDashAlertsSeen_u1']), rec);
});
test('el eco de la propia escritura no provoca un repintado extra', () => {
    const { t } = makeEnv();
    t._renderDashAlerts(DATA()); t.markDashAlertsSeen();
    assert.strictEqual(t.renders, 1);   // solo el de markDashAlertsSeen, no uno más por el listener
});
test('si Inicio no está abierto, el cambio remoto no repinta pero sí se guarda', () => {
    const { t, db } = makeEnv();
    t._renderDashAlerts(DATA()); t.currentView = 'wellness';
    db.emit('staffAlertsSeen/u1', { date: '2026-11-04', keys: 'a' });
    assert.strictEqual(t.renders, 0); assert.strictEqual(t._dashAlertsSeen.keys, 'a');
});
test('datos corruptos en la nube se ignoran', () => {
    const { t, db } = makeEnv();
    t._renderDashAlerts(DATA());
    [{ date: 5, keys: 'a' }, { date: '2026-11-04' }, 'texto', { date: '2026-11-04', keys: 'x'.repeat(4001) }].forEach(v => db.emit('staffAlertsSeen/u1', v));
    assert.ok(!t._dashAlertsSeen);
});
test('si la nube aún no tiene marca pero este dispositivo sí, se sube', () => {
    const rec = { date: '2026-11-04', keys: 'a,b' };
    const { t, db } = makeEnv({ ls: { basketballDashAlertsSeen_u1: JSON.stringify(rec) } });
    t._renderDashAlerts(DATA());
    same(db.writes.find(w => w[0] === 'staffAlertsSeen/u1')[1], rec);
});
test('cada usuario tiene su propia marca (ruta con su uid)', () => {
    const a = makeEnv({ uid: 'uA' }), b = makeEnv({ uid: 'uB' });
    a.t._renderDashAlerts(DATA()); a.t.markDashAlertsSeen();
    b.t._renderDashAlerts(DATA());
    assert.ok(a.db.writes.every(w => w[0] === 'staffAlertsSeen/uA'));
    assert.ok(b.t._renderDashAlerts(DATA()).includes('6 avisos'), 'la marca de uA no afecta a uB');
});
test('sin conexión o con la escritura rechazada no rompe nada y la marca queda en el dispositivo', async () => {
    const { t, store } = makeEnv({ db: makeDB({ failWrites: true }) });
    t._renderDashAlerts(DATA());
    assert.doesNotThrow(() => t.markDashAlertsSeen());
    await new Promise(r => setTimeout(r, 5));
    assert.ok(store['basketballDashAlertsSeen_u1']);
    assert.ok(t._renderDashAlerts(DATA()).includes('Avisos vistos hoy'));
});
test('si Firebase deniega el permiso se sigue funcionando solo con el dispositivo', () => {
    const { t, db } = makeEnv();
    t._renderDashAlerts(DATA());
    assert.doesNotThrow(() => db.listeners['staffAlertsSeen/u1'].errCb(new Error('permission_denied')));
    t.markDashAlertsSeen();
    assert.ok(t._renderDashAlerts(DATA()).includes('Avisos vistos hoy'));
});
test('sin usuario identificado (o sin Firebase) la línea se pinta y marcar no lanza errores', () => {
    const noUser = makeEnv({ uid: null });
    assert.ok(noUser.t._renderDashAlerts(DATA()).includes('6 avisos'));
    assert.doesNotThrow(() => noUser.t.markDashAlertsSeen());
    assert.strictEqual(noUser.db.writes.length, 0);
    const noDb = makeEnv({ db: null });
    assert.doesNotThrow(() => { noDb.t._renderDashAlerts(DATA()); noDb.t.markDashAlertsSeen(); });
});

console.log('\nSeguridad: escape de nombres e ids');
test('nombres, mensajes e ids con HTML o comillas no producen código ejecutable', () => {
    const EVIL = '<img src=x onerror=alert(1)>';
    const { t } = makeEnv();
    const html = t._renderDashAlerts({
        dangerPlayers: [P('p1', EVIL)], warnPlayers: [P('p2', '"><script>alert(2)</script>')],
        trendAlerts: [{ kind: 'sleep', playerId: 'p3', name: EVIL, message: EVIL }],
        rpeDiscrepancies: [{ sessionId: `s1"');alert(3);('`, playerName: EVIL, staffRpe: EVIL, playerRpe: 8, date: EVIL }],
    });
    assert.ok(!/<img|<script/i.test(html), 'sin etiquetas inyectadas');
    assert.ok(!/onclick="[^"]*alert/.test(html), 'el id de sesión no llega a ningún onclick');
    const attr = /data-session-id="([^"]*)"/.exec(html);
    assert.ok(attr && !/['"<>]/.test(attr[1]), 'el id va escapado dentro de su atributo (sin comillas ni < >)');
    const onclicks = html.match(/onclick="[^"]*"/g) || [];
    onclicks.forEach(o => assert.ok(/^onclick="window\.rpeTracker\?\.\w+\((this\.dataset\.sessionId)?\)"$/.test(o), 'onclick inesperado: ' + o));
    assert.ok(html.includes('data-session-id="s1&quot;'), 'el id va en un atributo escapado');
});

console.log('\nRecordatorio de planificación (solo domingos)');
test('el domingo aparece como línea fina aparte; el resto de días no', () => {
    const { t } = makeEnv();
    assert.strictEqual(t._renderDashPlanningReminder(), '');            // miércoles
    NOW = new Date(2026, 10, 8, 18, 0);                                  // domingo
    try {
        const html = t._renderDashPlanningReminder();
        assert.ok(html.includes('db-alerts-plan') && html.includes('Planificación pendiente') && html.includes("switchView('weekplan')"));
        assert.ok(!html.includes('db-alerts"') , 'no es una franja de avisos');
        t.isWeekPlanSaved = () => true;
        assert.strictEqual(t._renderDashPlanningReminder(), '', 'desaparece al guardar la semana');
    } finally { NOW = new Date(2026, 10, 4, 10, 0); }
});
test('el recordatorio no cuenta como aviso ni entra en la marca de «visto»', () => {
    NOW = new Date(2026, 10, 8, 18, 0);
    try {
        const { t } = makeEnv();
        const a = t._collectDashAlerts({ dangerPlayers: [], warnPlayers: [], trendAlerts: [], rpeDiscrepancies: [] });
        assert.strictEqual(a.total, 0);
    } finally { NOW = new Date(2026, 10, 4, 10, 0); }
});

console.log('\nCableado');
test('las franjas antiguas ya no existen en el renderer y el módulo está en index.html y sw.js', () => {
    const r = fs.readFileSync(path.join(ROOT, 'dashboard-renderer.js'), 'utf8');
    assert.ok(!r.includes('db-alert-banner') && r.includes('_renderDashAlerts') && r.includes('_renderDashPlanningReminder'));
    assert.ok(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('<script src="dashboard-alerts.js"></script>'));
    assert.ok(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes("'dashboard-alerts.js'"));
});

(async () => {
    for (const q of queue) {
        try { await q.fn(); passed++; console.log('  ✅ ' + q.name); }
        catch (e) { failed++; console.log('  ❌ ' + q.name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

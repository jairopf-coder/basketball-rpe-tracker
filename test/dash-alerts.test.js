// test/dash-alerts.test.js
// Alertas de Inicio: KPI de dos líneas (total + «alerta/alertas») y panel al pulsarlo (dashboard-alerts.js):
//  · qué alertas hay y su identificador · estados (nuevas / vistas hoy / algunas nuevas)
//  · KPI: total, singular/plural, color por gravedad, punto de «sin ver», accesible con teclado
//  · panel: lista (nombres unidos con «y»), abrir/cerrar, Esc, hoja en móvil
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

function makeEnv({ uid = 'u1', db = makeDB(), ls = {}, kpi = true, vw = 1280, vh = 800 } = {}) {
    const store = Object.assign({}, ls);
    // DOM mínimo: elementos «en pantalla» por id, con foco, estilos, atributos y su rectángulo
    const mkEl = id => ({ id, style: {}, attrs: {}, innerHTML: '', focused: 0, rect: { left: 300, right: 500, top: 100, bottom: 180 },
        setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused++; }, getBoundingClientRect() { return this.rect; } });
    const els = {};
    if (kpi) els.dashAlertsKpi = mkEl('dashAlertsKpi');
    const pop = mkEl('dashAlertsPop');            // el panel va dentro de #dashAlertsLayer: existe mientras esa capa exista
    const handlers = { document: {}, window: {} };
    const add = (bag, ev, cb) => { (bag[ev] = bag[ev] || []).push(cb); };
    const win = { innerWidth: vw, innerHeight: vh, firebaseAuth: uid ? { currentUser: { uid } } : { currentUser: null }, firebaseDB: db,
        addEventListener: (ev, cb) => add(handlers.window, ev, cb) };
    const doc = {
        getElementById: id => (id === 'dashAlertsPop' ? (els.dashAlertsLayer ? pop : null) : (els[id] || null)),
        addEventListener: (ev, cb) => add(handlers.document, ev, cb),
        createElement: () => { const e = mkEl(''); e.remove = function() { delete els[this.id]; }; return e; },
        body: { appendChild(e) { els[e.id] = e; } },
        head: { appendChild() {} },
    };
    const ctx = vm.createContext({
        console: { log() {}, warn() {}, error() {} }, Date: FakeDate, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, isFinite, Promise, Map,
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
        document: doc, window: win,
    });
    const sec = fs.readFileSync(path.join(ROOT, 'security.js'), 'utf8');
    vm.runInContext(sec + '\n;globalThis.esc = esc;', ctx);       // esc() REAL
    vm.runInContext(`function RPETracker() {}
        function toLocalISODate(d){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}`, ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'dashboard-alerts.js'), 'utf8'), ctx, { filename: 'dashboard-alerts.js' });
    const t = vm.runInContext('new RPETracker()', ctx);
    t.renders = 0; t.currentView = 'dashboard';
    t.renderDashboard = function() { this.renders++; };
    // Lo que se ve al abrir el panel (resumen y panel salen de la misma cuenta)
    t._viewDashAlerts = function(d) { this._dashAlertsSummary(d); return this._dashAlertsPanelHtml(); };
    const emit = (where, ev, arg) => (handlers[where][ev] || []).forEach(cb => cb(arg));
    return { t, db, store, ctx, els, pop, win, handlers, emit, kpi: els.dashAlertsKpi };
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
test('sin alertas el total es 0, y datos raros (no-listas) no rompen', () => {
    const { t } = makeEnv();
    const s0 = t._dashAlertsSummary({ dangerPlayers: [], warnPlayers: [], trendAlerts: [], rpeDiscrepancies: [] });
    assert.strictEqual(s0.a.total, 0);
    assert.doesNotThrow(() => t._dashAlertsSummary({ dangerPlayers: null, warnPlayers: undefined, trendAlerts: [], rpeDiscrepancies: () => [] }));
    assert.strictEqual(t._dashAlertsSummary({ rpeDiscrepancies: () => [] }).a.total, 0);
    assert.doesNotThrow(() => t._dashAlertsSummary());
});

console.log('\nKPI de dos líneas: total, singular/plural, color y teclado');
const only = (t, o) => t._dashAlertsSummary(Object.assign({ dangerPlayers: [], warnPlayers: [], trendAlerts: [], rpeDiscrepancies: [] }, o));
test('el número del KPI es el TOTAL de alertas (peligro + precaución + wellness + RPE), no solo las de peligro', () => {
    const { t } = makeEnv();
    const s1 = t._dashAlertsSummary(DATA());
    assert.strictEqual(s1.a.total, 6); assert.strictEqual(s1.a.danger.length, 3);
});
test('la etiqueta de abajo es solo «alerta» o «alertas» (0 y 2+ en plural), sin especificar tipo', () => {
    const { t } = makeEnv();
    const word = o => t._dashAlertsKpiWord(only(t, o).a);
    assert.strictEqual(word({}), 'alertas');
    assert.strictEqual(word({ warnPlayers: [P('p4', 'Sofía')] }), 'alerta');
    assert.strictEqual(word({ dangerPlayers: [P('p1', 'Marta')], warnPlayers: [P('p4', 'Sofía')] }), 'alertas');
    assert.strictEqual(word(DATA()), 'alertas');
});
test('el color sigue la gravedad: rojo si hay alguien en peligro, naranja si solo hay otras alertas, verde si no hay ninguna', () => {
    const { t } = makeEnv();
    const sev = o => t._dashAlertsKpiSeverity(only(t, o).a);
    assert.strictEqual(sev({}), 'ok');
    assert.strictEqual(sev({ warnPlayers: [P('p4', 'Sofía')] }), 'warn');
    assert.strictEqual(sev({ trendAlerts: DATA().trendAlerts }), 'warn');
    assert.strictEqual(sev({ rpeDiscrepancies: DATA().rpeDiscrepancies }), 'warn');
    assert.strictEqual(sev({ dangerPlayers: [P('p1', 'Marta')], warnPlayers: [P('p4', 'Sofía')] }), 'danger');
});
test('desglose por tipo (tooltip y lector de pantalla): «3 en peligro · 1 en precaución · 1 de wellness · 1 RPE distinto»', () => {
    const { t } = makeEnv();
    assert.strictEqual(t._dashAlertsBreakdown(t._dashAlertsSummary(DATA()).a), '3 en peligro · 1 en precaución · 1 de wellness · 1 RPE distinto');
    assert.strictEqual(t._dashAlertsBreakdown(only(t, { rpeDiscrepancies: [DATA().rpeDiscrepancies[0], { sessionId: 's2', playerName: 'Eva', staffRpe: 5, playerRpe: 7, date: '2026-11-03' }] }).a), '2 RPE distintos');
    assert.strictEqual(t._dashAlertsBreakdown(only(t, {}).a), '');
});
test('atributos del KPI: foco, rol de botón, panel asociado, tooltip con el desglose y nombre accesible', () => {
    const { t } = makeEnv();
    const at = t._dashAlertsKpiAttrs(t._dashAlertsSummary(DATA()));
    ['id="dashAlertsKpi"', 'role="button"', 'tabindex="0"', 'aria-haspopup="dialog"', 'aria-expanded="false"',
     'aria-label="6 alertas hoy: 3 en peligro · 1 en precaución · 1 de wellness · 1 RPE distinto. Abrir las alertas"',
     'title="3 en peligro · 1 en precaución · 1 de wellness · 1 RPE distinto"',
     'onclick="window.rpeTracker?.toggleDashAlerts()"', 'onkeydown="window.rpeTracker?.dashAlertsKpiKey(event)"'].forEach(x => assert.ok(at.includes(x), 'falta ' + x + ' en ' + at));
    assert.ok(t._dashAlertsKpiAttrs(only(t, { warnPlayers: [P('p4', 'Sofía')] })).includes('aria-label="1 alerta hoy: 1 en precaución. Abrir las alertas"'));
    const none = t._dashAlertsKpiAttrs(only(t, {}));
    assert.ok(none.includes('aria-label="Sin alertas hoy. Abrir las alertas"') && none.includes('title="Sin alertas hoy"'));
    t._dashAlertsOpen = true; assert.ok(t._dashAlertsKpiAttrs(only(t, {})).includes('aria-expanded="true"'));
    t._dashAlertsOpen = false; t._dashAlertsSummary(DATA()); t.markDashAlertsSeen();
    assert.ok(t._dashAlertsKpiAttrs(t._dashAlertsSummary(DATA())).includes('(vistas)'));
});
test('Enter y espacio abren y cierran el panel (y no hacen scroll); otras teclas, nada', () => {
    const { t } = makeEnv(); t._dashAlertsSummary(DATA());
    let prevented = 0; const ev = k => ({ key: k, preventDefault() { prevented++; } });
    t.dashAlertsKpiKey(ev('Enter')); assert.strictEqual(t._dashAlertsOpen, true);
    t.dashAlertsKpiKey(ev(' ')); assert.strictEqual(t._dashAlertsOpen, false);
    t.dashAlertsKpiKey(ev('a')); t.dashAlertsKpiKey(ev('Tab')); t.dashAlertsKpiKey(null);
    assert.strictEqual(t._dashAlertsOpen, false); assert.strictEqual(prevented, 2);
});

console.log('\nPanel de alertas: contenido');
test('título: «N alertas», «1 alerta», «Alertas de hoy» (sin alertas) y «· N nuevas» cuando solo algunas son nuevas', () => {
    const { t } = makeEnv();
    const title = d => { t._dashAlertsSummary(d); return /db-alerts-title">([^<]*)</.exec(t._dashAlertsPanelHtml())[1]; };
    assert.strictEqual(title(DATA()), '6 alertas');
    assert.strictEqual(title({ warnPlayers: [P('p4', 'Sofía')] }), '1 alerta');
    assert.strictEqual(title({}), 'Alertas de hoy');
    t._dashAlertsSummary(DATA()); t.markDashAlertsSeen();
    const d = DATA(); d.warnPlayers.push(P('p9', 'Noa'));
    assert.strictEqual(title(d), '7 alertas · 1 nueva');
    d.warnPlayers.push(P('p8', 'Eva')); assert.strictEqual(title(d), '8 alertas · 2 nuevas');
});
test('el panel es un diálogo con todas las alertas, sus botones, «Marcar como visto por hoy» y «Ver analítica»', () => {
    const { t } = makeEnv();
    const html = t._viewDashAlerts(DATA());
    assert.ok(html.includes('role="dialog"') && html.includes('aria-label="Alertas de hoy"') && html.includes('id="dashAlertsPop"'));
    ['Marta, Lucía y Alba', '— zona de peligro (ratio A:C)', 'Sofía', '— en precaución (ratio A:C)', 'Ana', 'Sueño deficiente', 'Irene', 'tú: 6, ella: 8', 'Ver detalle', 'Revisar', 'Marcar como visto por hoy', 'Ver analítica', 'aria-label="Cerrar"'].forEach(x =>
        assert.ok(html.includes(x), 'falta ' + x));
});
test('los nombres se unen en español: «Marta», «Marta y Lucía», «Marta, Lucía y Alba» y «e» ante i-/hi- («Marta e Irene»)', () => {
    const { t, ctx } = makeEnv();
    const J = vm.runInContext('_dashAlertsJoinNames', ctx);
    assert.strictEqual(J(['Marta']), 'Marta'); assert.strictEqual(J([]), '');
    assert.strictEqual(J(['Marta', 'Lucía']), 'Marta y Lucía');
    assert.strictEqual(J(['Marta', 'Lucía', 'Alba']), 'Marta, Lucía y Alba');
    assert.strictEqual(J(['Marta', 'Irene']), 'Marta e Irene');
    assert.strictEqual(J(['Marta', 'Íñigo']), 'Marta e Íñigo');
    assert.strictEqual(J(['Marta', 'Hilda']), 'Marta e Hilda');
    assert.strictEqual(J(['Marta', 'Hiedra']), 'Marta y Hiedra', 'hie- sigue con «y»');
    assert.strictEqual(J(['Marta', '<b>']), 'Marta y &lt;b&gt;', 'escapa HTML');
});
test('los botones de una fila cierran el panel antes de actuar; la × cierra devolviendo el foco', () => {
    const { t } = makeEnv();
    const html = t._viewDashAlerts(DATA());
    assert.ok(html.includes('onclick="window.rpeTracker?.closeDashAlerts();window.rpeTracker?.openPreSessionModal()"'));
    assert.ok(html.includes('onclick="window.rpeTracker?.closeDashAlerts();window.rpeTracker?.showSessionDetail(this.dataset.sessionId)"'));
    assert.ok(html.includes("onclick=\"window.rpeTracker?.closeDashAlerts();window.rpeTracker?.switchView('analytics')\""));
    assert.ok(html.includes('class="db-alerts-x" aria-label="Cerrar" onclick="window.rpeTracker?.closeDashAlerts(true)"'));
});
test('sin alertas: «Sin alertas hoy ✓», sin botón de visto y con «Ver analítica»', () => {
    const { t } = makeEnv(); t._dashAlertsSummary({});
    const html = t._dashAlertsPanelHtml();
    assert.ok(html.includes('Sin alertas hoy ✓') && html.includes('Ver analítica') && !html.includes('Marcar como visto'));
});

console.log('\nPanel de alertas: abrir, cerrar y colocar');
test('pulsar el KPI abre el panel en <body> (con fondo para cerrar al tocar fuera), marca aria-expanded y da el foco; Inicio no se repinta', () => {
    const { t, els, kpi, pop } = makeEnv(); t._dashAlertsSummary(DATA());
    t.toggleDashAlerts();
    assert.strictEqual(t._dashAlertsOpen, true);
    const layer = els.dashAlertsLayer;
    assert.ok(layer && layer.innerHTML.includes('db-alerts-backdrop') && layer.innerHTML.includes('id="dashAlertsPop"'));
    assert.ok(layer.innerHTML.includes('onclick="window.rpeTracker?.closeDashAlerts()"'), 'el fondo cierra');
    assert.strictEqual(kpi.attrs['aria-expanded'], 'true'); assert.strictEqual(pop.focused, 1); assert.strictEqual(t.renders, 0);
});
test('pulsarlo otra vez lo cierra: se quita la capa y NO se roba el foco', () => {
    const { t, els, kpi } = makeEnv(); t._dashAlertsSummary(DATA());
    t.toggleDashAlerts(); t.toggleDashAlerts();
    assert.strictEqual(t._dashAlertsOpen, false); assert.ok(!els.dashAlertsLayer);
    assert.strictEqual(kpi.attrs['aria-expanded'], 'false'); assert.strictEqual(kpi.focused, 0);
});
test('abrir dos veces no duplica la capa (se reutiliza)', () => {
    const { t, els } = makeEnv(); t._dashAlertsSummary(DATA());
    t.openDashAlerts(); const first = els.dashAlertsLayer; t.openDashAlerts();
    assert.strictEqual(els.dashAlertsLayer, first);
});
test('Esc cierra y devuelve el foco al KPI; con el panel cerrado o con otra tecla no hace nada', () => {
    const { t, kpi, emit, els } = makeEnv(); t._dashAlertsSummary(DATA());
    emit('document', 'keydown', { key: 'Escape' });            // aún no hay oyente: no rompe
    t.openDashAlerts();
    emit('document', 'keydown', { key: 'Enter' }); assert.strictEqual(t._dashAlertsOpen, true);
    emit('document', 'keydown', { key: 'Escape' });
    assert.strictEqual(t._dashAlertsOpen, false); assert.ok(!els.dashAlertsLayer); assert.strictEqual(kpi.focused, 1);
    emit('document', 'keydown', { key: 'Escape' }); assert.strictEqual(kpi.focused, 1);
});
test('los oyentes de teclado y ventana se registran UNA sola vez aunque se abra muchas veces', () => {
    const { t, handlers } = makeEnv(); t._dashAlertsSummary(DATA());
    for (let i = 0; i < 4; i++) { t.openDashAlerts(); t.closeDashAlerts(); }
    assert.strictEqual(handlers.document.keydown.length, 1);
    assert.strictEqual(handlers.window.resize.length, 1); assert.strictEqual(handlers.window.scroll.length, 1);
});
test('PC: el panel se ancla bajo el KPI; al hacer scroll o redimensionar se recoloca y con el panel cerrado no se toca nada', () => {
    const { t, pop, kpi, emit } = makeEnv({ vw: 1280, vh: 800 }); t._dashAlertsSummary(DATA());
    t.openDashAlerts();
    assert.strictEqual(pop.style.left, '300px'); assert.strictEqual(pop.style.top, '188px');
    assert.strictEqual(pop.style.width, '440px'); assert.strictEqual(pop.style.maxHeight, '596px');
    kpi.rect = { left: 300, right: 500, top: 40, bottom: 120 }; emit('window', 'scroll');
    assert.strictEqual(pop.style.top, '128px');
    t.closeDashAlerts(); kpi.rect = { left: 10, right: 210, top: 0, bottom: 80 }; emit('window', 'resize');
    assert.strictEqual(pop.style.top, '128px', 'cerrado: no se recoloca');
});
test('móvil (≤768px): es una hoja desde abajo; los estilos en línea de PC se limpian (los pone el CSS)', () => {
    const { t, pop, win, emit } = makeEnv({ vw: 390, vh: 800 }); t._dashAlertsSummary(DATA());
    pop.style.left = '300px'; pop.style.top = '9px'; pop.style.width = '440px'; pop.style.maxHeight = '5px';
    t.openDashAlerts();
    ['left', 'top', 'width', 'maxHeight'].forEach(k => assert.strictEqual(pop.style[k], '', k));
    win.innerWidth = 1280; emit('window', 'resize');                 // girar el dispositivo: vuelve a anclarse
    assert.strictEqual(pop.style.left, '300px');
});
test('colocación (función pura): borde derecho, borde inferior y límite entre móvil y PC', () => {
    const { ctx } = makeEnv(); const place = vm.runInContext('_dashAlertsPlacement', ctx);
    const r = (left, bottom) => ({ left, right: left + 200, top: bottom - 80, bottom });
    same(place(r(300, 180), 390, 800), { sheet: true });
    same(place(r(300, 180), 768, 800), { sheet: true });
    same(place(r(300, 180), 769, 800).sheet, false);
    same(place(r(300, 180), 1280, 800), { sheet: false, left: 300, top: 188, width: 440, maxHeight: 596 });
    assert.strictEqual(place(r(1200, 180), 1280, 800).left, 832, 'no se sale por la derecha');
    assert.strictEqual(place(r(-50, 180), 1280, 800).left, 8, 'ni por la izquierda');
    const lowKpi = place(r(300, 590), 1280, 600);
    assert.strictEqual(lowKpi.top, 440, 'si el KPI queda abajo, sube para tener sitio'); assert.strictEqual(lowKpi.maxHeight, 160);
    assert.strictEqual(place(r(300, 180), 500 + 300, 800).width, 440);
});
test('repintar Inicio con el panel abierto: se refresca con los datos nuevos y se recoloca; cerrado no hace nada; sin KPI se cierra', () => {
    const { t, els, pop, kpi } = makeEnv(); t._dashAlertsSummary(DATA());
    t._syncDashAlertsPanel(); assert.ok(!els.dashAlertsLayer, 'cerrado: no crea nada');
    t.openDashAlerts();
    const d = DATA(); d.warnPlayers.push(P('p9', 'Noa')); t._dashAlertsSummary(d);
    kpi.rect = { left: 600, right: 800, top: 100, bottom: 180 };
    t._syncDashAlertsPanel();
    assert.ok(els.dashAlertsLayer.innerHTML.includes('7 alertas') && els.dashAlertsLayer.innerHTML.includes('Sofía y Noa'));
    assert.strictEqual(pop.style.left, '600px'); assert.strictEqual(t._dashAlertsOpen, true);
    delete els.dashAlertsKpi; t._syncDashAlertsPanel();
    assert.strictEqual(t._dashAlertsOpen, false); assert.ok(!els.dashAlertsLayer);
});
test('«Marcar como visto por hoy» cierra el panel y repinta Inicio', () => {
    const { t, els } = makeEnv(); t._dashAlertsSummary(DATA());
    t.openDashAlerts(); t.markDashAlertsSeen();
    assert.strictEqual(t._dashAlertsOpen, false); assert.ok(!els.dashAlertsLayer); assert.strictEqual(t.renders, 1);
});
test('un KPI que aún no está en pantalla no rompe nada al abrir', () => {
    const { t } = makeEnv({ kpi: false }); t._dashAlertsSummary(DATA());
    assert.doesNotThrow(() => { t.openDashAlerts(); t.closeDashAlerts(true); });
});

console.log('\n«Marcar como visto por hoy»');
test('guarda hoy + los identificadores ordenados en el dispositivo y en Firebase, y repinta', () => {
    const { t, db, store } = makeEnv();
    t._viewDashAlerts(DATA());
    t.markDashAlertsSeen();
    const rec = { date: '2026-11-04', keys: [...KEYS].sort().join(',') };
    same(JSON.parse(store['basketballDashAlertsSeen_u1']), rec);
    same(db.writes.find(w => w[0] === 'staffAlertsSeen/u1')[1], rec);
    assert.strictEqual(t.renders, 1);
});
test('lo guardado no contiene nombres ni datos de wellness, solo identificadores', () => {
    const { t, store } = makeEnv();
    t._viewDashAlerts(DATA()); t.markDashAlertsSeen();
    const raw = store['basketballDashAlertsSeen_u1'];
    ['Marta', 'Lucía', 'Sofía', 'Sueño', 'Irene'].forEach(n => assert.ok(!raw.includes(n), 'no debe guardar ' + n));
});
test('después: «Alertas vistas hoy: N», en gris, SIN botón, y la lista sigue disponible', () => {
    const { t } = makeEnv();
    t._viewDashAlerts(DATA()); t.markDashAlertsSeen();
    const html = t._viewDashAlerts(DATA());
    assert.ok(html.includes('Alertas vistas hoy: 6') && html.includes('db-alerts-pop--seen'));
    assert.ok(!html.includes('Marcar como visto'));
    ['Marta, Lucía y Alba', 'Sueño deficiente', 'Revisar'].forEach(x => assert.ok(html.includes(x), 'la lista debe poder verse: ' + x));
});
test('no desaparece «para siempre»: los avisos se recalculan, solo la marca se guarda', () => {
    const { t } = makeEnv();
    t._viewDashAlerts(DATA()); t.markDashAlertsSeen();
    t._dashAlertsOpen = true;
    assert.ok(t._viewDashAlerts(DATA()).includes('Sueño deficiente'));
});
test('si aparece una alerta NUEVA vuelve a destacarse: «7 alertas · 1 nueva» y con botón', () => {
    const { t } = makeEnv();
    t._viewDashAlerts(DATA()); t.markDashAlertsSeen();
    const d = DATA(); d.warnPlayers.push(P('p9', 'Noa'));
    const html = t._viewDashAlerts(d);
    assert.ok(html.includes('7 alertas · 1 nueva') && !html.includes('db-alerts-pop--seen') && html.includes('Marcar como visto'));
});
test('si una alerta se resuelve (desaparece) NO se destaca de nuevo', () => {
    const { t } = makeEnv();
    t._viewDashAlerts(DATA()); t.markDashAlertsSeen();
    const d = DATA(); d.dangerPlayers = d.dangerPlayers.slice(0, 1); d.rpeDiscrepancies = [];
    assert.ok(t._viewDashAlerts(d).includes('Alertas vistas hoy: 3'));
});
test('al día siguiente vuelve a destacarse aunque sean las mismas alertas', () => {
    const { t } = makeEnv();
    t._viewDashAlerts(DATA()); t.markDashAlertsSeen();
    NOW = new Date(2026, 10, 5, 9, 0);
    try {
        const html = t._viewDashAlerts(DATA());
        assert.ok(html.includes('6 alertas') && !html.includes('db-alerts-pop--seen'));
    } finally { NOW = new Date(2026, 10, 4, 10, 0); }
});
test('marcar sin avisos no hace nada', () => {
    const { t, db } = makeEnv();
    t._viewDashAlerts({ dangerPlayers: [], warnPlayers: [], trendAlerts: [], rpeDiscrepancies: [] });
    t.markDashAlertsSeen();
    assert.strictEqual(db.writes.length, 0); assert.strictEqual(t.renders, 0);
});

console.log('\nSincronización entre dispositivos');
test('la primera vez carga la marca guardada en el dispositivo y registra UN solo listener', () => {
    const rec = { date: '2026-11-04', keys: [...KEYS].sort().join(',') };
    const { t, db } = makeEnv({ ls: { basketballDashAlertsSeen_u1: JSON.stringify(rec) } });
    assert.ok(t._viewDashAlerts(DATA()).includes('Alertas vistas hoy: 6'));
    t._viewDashAlerts(DATA()); t._viewDashAlerts(DATA());
    assert.deepStrictEqual(db.ons, ['staffAlertsSeen/u1']);
});
test('lo marcado en otro dispositivo llega sin recargar: se actualiza y Inicio se repinta', () => {
    const { t, db, store } = makeEnv();
    t._viewDashAlerts(DATA());
    const rec = { date: '2026-11-04', keys: [...KEYS].sort().join(',') };
    db.emit('staffAlertsSeen/u1', rec);
    assert.ok(t._viewDashAlerts(DATA()).includes('Alertas vistas hoy: 6'));
    assert.strictEqual(t.renders, 1);
    same(JSON.parse(store['basketballDashAlertsSeen_u1']), rec);
});
test('el eco de la propia escritura no provoca un repintado extra', () => {
    const { t } = makeEnv();
    t._viewDashAlerts(DATA()); t.markDashAlertsSeen();
    assert.strictEqual(t.renders, 1);   // solo el de markDashAlertsSeen, no uno más por el listener
});
test('si Inicio no está abierto, el cambio remoto no repinta pero sí se guarda', () => {
    const { t, db } = makeEnv();
    t._viewDashAlerts(DATA()); t.currentView = 'wellness';
    db.emit('staffAlertsSeen/u1', { date: '2026-11-04', keys: 'a' });
    assert.strictEqual(t.renders, 0); assert.strictEqual(t._dashAlertsSeen.keys, 'a');
});
test('datos corruptos en la nube se ignoran', () => {
    const { t, db } = makeEnv();
    t._viewDashAlerts(DATA());
    [{ date: 5, keys: 'a' }, { date: '2026-11-04' }, 'texto', { date: '2026-11-04', keys: 'x'.repeat(4001) }].forEach(v => db.emit('staffAlertsSeen/u1', v));
    assert.ok(!t._dashAlertsSeen);
});
test('si la nube aún no tiene marca pero este dispositivo sí, se sube', () => {
    const rec = { date: '2026-11-04', keys: 'a,b' };
    const { t, db } = makeEnv({ ls: { basketballDashAlertsSeen_u1: JSON.stringify(rec) } });
    t._viewDashAlerts(DATA());
    same(db.writes.find(w => w[0] === 'staffAlertsSeen/u1')[1], rec);
});
test('cada usuario tiene su propia marca (ruta con su uid)', () => {
    const a = makeEnv({ uid: 'uA' }), b = makeEnv({ uid: 'uB' });
    a.t._viewDashAlerts(DATA()); a.t.markDashAlertsSeen();
    b.t._viewDashAlerts(DATA());
    assert.ok(a.db.writes.every(w => w[0] === 'staffAlertsSeen/uA'));
    assert.ok(b.t._viewDashAlerts(DATA()).includes('6 alertas'), 'la marca de uA no afecta a uB');
});
test('sin conexión o con la escritura rechazada no rompe nada y la marca queda en el dispositivo', async () => {
    const { t, store } = makeEnv({ db: makeDB({ failWrites: true }) });
    t._viewDashAlerts(DATA());
    assert.doesNotThrow(() => t.markDashAlertsSeen());
    await new Promise(r => setTimeout(r, 5));
    assert.ok(store['basketballDashAlertsSeen_u1']);
    assert.ok(t._viewDashAlerts(DATA()).includes('Alertas vistas hoy'));
});
test('si Firebase deniega el permiso se sigue funcionando solo con el dispositivo', () => {
    const { t, db } = makeEnv();
    t._viewDashAlerts(DATA());
    assert.doesNotThrow(() => db.listeners['staffAlertsSeen/u1'].errCb(new Error('permission_denied')));
    t.markDashAlertsSeen();
    assert.ok(t._viewDashAlerts(DATA()).includes('Alertas vistas hoy'));
});
test('sin usuario identificado (o sin Firebase) la línea se pinta y marcar no lanza errores', () => {
    const noUser = makeEnv({ uid: null });
    assert.ok(noUser.t._viewDashAlerts(DATA()).includes('6 alertas'));
    assert.doesNotThrow(() => noUser.t.markDashAlertsSeen());
    assert.strictEqual(noUser.db.writes.length, 0);
    const noDb = makeEnv({ db: null });
    assert.doesNotThrow(() => { noDb.t._viewDashAlerts(DATA()); noDb.t.markDashAlertsSeen(); });
});

console.log('\nSeguridad: escape de nombres e ids');
test('nombres, mensajes e ids con HTML o comillas no producen código ejecutable', () => {
    const EVIL = '<img src=x onerror=alert(1)>';
    const { t } = makeEnv();
    const html = t._viewDashAlerts({
        dangerPlayers: [P('p1', EVIL)], warnPlayers: [P('p2', '"><script>alert(2)</script>')],
        trendAlerts: [{ kind: 'sleep', playerId: 'p3', name: EVIL, message: EVIL }],
        rpeDiscrepancies: [{ sessionId: `s1"');alert(3);('`, playerName: EVIL, staffRpe: EVIL, playerRpe: 8, date: EVIL }],
    });
    assert.ok(!/<img|<script/i.test(html), 'sin etiquetas inyectadas');
    assert.ok(!/onclick="[^"]*alert/.test(html), 'el id de sesión no llega a ningún onclick');
    const attr = /data-session-id="([^"]*)"/.exec(html);
    assert.ok(attr && !/['"<>]/.test(attr[1]), 'el id va escapado dentro de su atributo (sin comillas ni < >)');
    const onclicks = html.match(/onclick="[^"]*"/g) || [];
    onclicks.forEach(o => assert.ok(/^onclick="(window\.rpeTracker\?\.\w+\((this\.dataset\.sessionId|'analytics'|true)?\);?)+"$/.test(o), 'onclick inesperado: ' + o));
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

console.log('\nRegla única de peligro A:C (insignia, icono y notificación; el KPI cuenta el total de alertas)');
const TH = { low: 0.8, opt: 1.3, high: 1.5 };
function acEnv(ratios, { thresholds = {}, out = [], players } = {}) {
    const { t } = makeEnv();
    t.getPlayerThresholds = id => thresholds[id] || TH;
    t.calculateAcuteChronicRatio = id => ratios[id];
    t.activePlayers = (players || Object.keys(ratios)).map(id => ({ id }));
    t.getPlayerParticipation = (id) => (out.includes(id) ? 'out' : 'in');
    return t;
}
const R = (v, confidence = 'high') => ({ ratio: String(v), confidence });
test('niveles: peligro solo por ENCIMA del umbral alto; precaución por encima del óptimo; el borde exacto no sube de nivel', () => {
    const t = acEnv({});
    const lv = v => t._acLevel(R(v), 'x');
    assert.deepStrictEqual([1.51, 1.5, 1.31, 1.3, 1.0, 0.8, 0.79].map(lv), ['danger', 'warn', 'warn', 'ok', 'ok', 'ok', 'low']);
});
test('sin ratio fiable ("Insuf.", N/A o vacío) no es ningún nivel de alerta, aunque el número sea alto', () => {
    const t = acEnv({});
    assert.strictEqual(t._acLevel(R(2.4, 'low'), 'x'), 'na');
    assert.strictEqual(t._acLevel(R('N/A'), 'x'), 'na');
    assert.strictEqual(t._acLevel(undefined, 'x'), 'na');
});
test('usa los umbrales individuales de cada jugadora', () => {
    const t = acEnv({ a: R(1.6), b: R(1.6) }, { thresholds: { b: { low: 0.8, opt: 1.4, high: 1.8 } } });
    assert.strictEqual(t._acLevel(R(1.6), 'a'), 'danger');
    assert.strictEqual(t._acLevel(R(1.6), 'b'), 'warn');
});
test('_acDangerCount cuenta solo peligro: no precaución, ni lesionadas, ni "Insuf.", ni jugadoras que no son activas', () => {
    const t = acEnv(
        { p1: R(1.8), p2: R(1.4), p3: R(1.9), p4: R(2.2, 'low'), p5: R(1.7), p6: R(2.0) },
        { out: ['p3'], players: ['p1', 'p2', 'p3', 'p4', 'p5'] });   // p6 no es activa
    assert.strictEqual(t._acDangerCount(), 2);   // p1 y p5
});
test('la insignia de Análisis, el icono de la app y la notificación usan la regla única de peligro; el KPI muestra el TOTAL de alertas', () => {
    const rend = fs.readFileSync(path.join(ROOT, 'dashboard-renderer.js'), 'utf8');
    const app = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
    assert.ok(/alertPlayers = players\.filter\([^;]*_acLevel\([^;]*'danger'/.test(rend), 'el peligro del Inicio sale de _acLevel');
    assert.ok(/warnPlayers\s*= players\.filter\([^;]*_acLevel\([^;]*'warn'/.test(rend), 'la precaución del Inicio sale de _acLevel');
    assert.ok(/dangerPlayers: alertPlayers, warnPlayers/.test(rend), 'el KPI cuenta esas mismas listas');
    assert.ok(/<span class="db-kpi-val">\$\{alertsSum\.a\.total\}<\/span>/.test(rend), 'el número del KPI es el total de alertas');
    assert.ok(!/acAlertCount/.test(rend), 'ya no hay un número aparte de peligro en el KPI');
    assert.ok(app.includes('const alertCount = this._acDangerCount()'), 'insignia de Análisis');
    assert.ok(app.includes('const count = tracker._acDangerCount()'), 'icono de la app');
    assert.ok(/tracker\._acLevel\(ratio, pid\) === 'danger'/.test(app), 'notificación al guardar sesión');
    assert.ok(!/r > this\.getPlayerThresholds\(player\.id\)\.opt/.test(app), 'la insignia no cuenta la precaución');
});

console.log('\nCableado');
test('la barra de avisos ya no existe: el renderer usa el KPI + panel y el recordatorio; el módulo está en index.html y sw.js', () => {
    const r = fs.readFileSync(path.join(ROOT, 'dashboard-renderer.js'), 'utf8');
    assert.ok(!r.includes('db-alert-banner') && !r.includes('_renderDashAlerts('), 'no debe quedar la barra');
    assert.ok(r.includes('_dashAlertsSummary(') && r.includes('_renderDashPlanningReminder') && r.includes('_syncDashAlertsPanel()'));
    assert.ok(!r.includes('_dashAlertsKpiExtra'), 'el KPI no lleva línea extra de chips');
    // El KPI son DOS líneas, como el de wellness: número arriba y «alerta/alertas» abajo (nada más)
    assert.ok(/<div class="db-kpi db-kpi--alerts db-kpi--\$\{this\._dashAlertsKpiSeverity\(alertsSum\.a\)\}[^`]*\$\{this\._dashAlertsKpiAttrs\(alertsSum\)\}>\s*<span class="db-kpi-val">\$\{alertsSum\.a\.total\}<\/span>\s*<span class="db-kpi-lbl">\$\{this\._dashAlertsKpiWord\(alertsSum\.a\)\}<\/span>\s*<\/div>/.test(r),
        'el KPI debe ser: total + «alerta/alertas» y nada más');
    const css = fs.readFileSync(path.join(ROOT, 'styles.css'), 'utf8');
    ['.db-alerts-bar', '.db-alerts-toggle', '.db-alerts-panel', '.db-alerts.is-open', '.db-alerts-chips'].forEach(c => assert.ok(!css.includes(c), 'CSS de la barra sin borrar: ' + c));
    ['.db-kpi-chips', '.db-kpi-seen', '.db-alerts-chip'].forEach(c => assert.ok(!css.includes(c), 'CSS de los chips sin borrar: ' + c));
    ['.db-kpi--unseen::after', '.db-alerts-pop', '.db-alerts-backdrop'].forEach(c => assert.ok(css.includes(c), 'falta ' + c));
    assert.ok(/@media \(max-width: 768px\) \{\s*\.db-alerts-backdrop \{ background: rgba\(0, 0, 0, 0\.4\); \}\s*\.db-alerts-pop \{[^}]*bottom: 0;/.test(css), 'la hoja de móvil');
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

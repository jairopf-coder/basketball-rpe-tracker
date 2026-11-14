// test/tests-alerts.test.js
// Avisos por jugadora en la lista de Tests (tests-team.js) — NO hay avisos en Inicio
//  • 🦵 asimetría alta (≥15 %) en el último test de dos piernas
//  • ⏱ toca repetir un test según la frecuencia (semanas) que fija el usuario (⚙️)
//  • explicación al pulsar el aviso y botones para ir al problema
//  • ajustes de frecuencia: valores propuestos, validación, guardado local y en Firebase
// Ejecutar con:  node test/tests-alerts.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = x => JSON.parse(JSON.stringify(x));
const iso = off => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const NOW = iso(0);

const els = {};
const store = {};
const mkNode = () => {
    const set = new Set();
    return { style: {}, innerHTML: '', textContent: '', id: '', className: '',
        classList: { add: c => set.add(c), remove: c => set.delete(c), toggle: (c, on) => (on ? set.add(c) : set.delete(c)), contains: c => set.has(c) },
        querySelectorAll() { return []; }, closest() { return null; }, remove() {} };
};
const win = { firebaseSync: null, firebaseDB: null };
const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, setTimeout, clearTimeout,
    document: {
        getElementById: id => els[id] || null, addEventListener() {}, head: { appendChild() {} },
        createElement: () => mkNode(), body: { appendChild(n) { if (n.id) els[n.id] = n; } },
        documentElement: { getAttribute: () => null },
    },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    window: win,
    AppConfirm: { show: () => Promise.resolve(true) }, AppAlert: { show() {} },
    PlayerTokens: { get: () => '#111111' },
    toLocalISODate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    getCurrentSeasonWindowStart: () => '2026-08-01',
    requestAnimationFrame: fn => fn(),
    sessionStorage: { getItem() { return null; }, setItem() {} },
});
vm.runInContext(read('security.js') + '\n;globalThis.esc = esc;', ctx);   // esc() REAL
vm.runInContext('function RPETracker() {}', ctx);
['gps-tracking.js', 'app-players.js', 'injury-management.js', 'strength.js', 'tests-wizard.js', 'tests-team.js']
    .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const TT = vm.runInContext('TestTeamLogic', ctx);

const P = (id, name, extra) => ({ id, name, lastName: 'X', ...(extra || {}) });
const S = (id, playerId, date, results, createdAt) => ({ id, playerId, date, results, createdAt: createdAt || date });
const tri = (l, r) => ({ triple: { left: l, right: r } });
const cmj = v => ({ cmj: { value: v } });
const FREQ = { cmj: 4, triple: 8 };    // el resto, sin aviso

function makeTracker(players, sessions) {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = players; T.testSessions = sessions;
    T.injuries = []; T.availability = {}; T.currentView = 'tests';
    T.toasts = []; T.renders = 0;
    T.showToast = (m, t) => T.toasts.push([m, t]);
    T.testSettings = { freqWeeks: { ...FREQ } };
    return T;
}
function reset() { Object.keys(els).forEach(k => delete els[k]); Object.keys(store).forEach(k => delete store[k]); win.firebaseDB = null; }
const mountTests = () => (els.testsView = mkNode());

console.log('\nLógica: ajustes');
test('normalizeSettings: valores propuestos si no hay nada, y lo válido se respeta', () => {
    const d = J(TT.normalizeSettings(null).freqWeeks);
    assert.deepStrictEqual(Object.keys(d).sort(), ['cmj', 'dj', 'five0five', 'ift3015', 'sj', 'slcmj', 'sprint10', 'sprint20', 'sts', 'triple']);
    assert.strictEqual(d.cmj, 4);
    const n = J(TT.normalizeSettings({ freqWeeks: { cmj: 3, sj: 0, dj: '6', triple: -2, sprint10: 1.5, sprint20: 99, ift3015: 'abc' } }).freqWeeks);
    assert.strictEqual(n.cmj, 3);
    assert.strictEqual(n.sj, 0, '0 = sin aviso, se respeta');
    assert.strictEqual(n.dj, 6, 'texto numérico válido');
    assert.strictEqual(n.triple, 8, 'negativo → valor propuesto');
    assert.strictEqual(n.sprint10, 6, 'decimal → valor propuesto');
    assert.strictEqual(n.sprint20, 6, 'más de 52 → valor propuesto');
    assert.strictEqual(n.ift3015, 8, 'no numérico → valor propuesto');
    assert.deepStrictEqual(J(TT.normalizeSettings('basura').freqWeeks), d);
});
test('parseFreqInputs: en blanco = sin aviso; entero 0–52; el primer error se señala', () => {
    const ok = J(TT.parseFreqInputs({ cmj: '4', sj: '', dj: ' 8 ' }));
    assert.strictEqual(ok.ok, true);
    assert.strictEqual(ok.freqWeeks.cmj, 4);
    assert.strictEqual(ok.freqWeeks.sj, 0);
    assert.strictEqual(ok.freqWeeks.dj, 8);
    assert.strictEqual(ok.freqWeeks.triple, 0, 'lo que no viene = sin aviso');
    ['abc', '1.5', '-1', '53'].forEach(bad => {
        const r = J(TT.parseFreqInputs({ cmj: '4', sj: bad }));
        assert.deepStrictEqual(r, { ok: false, testId: 'sj' }, bad);
    });
});

console.log('\nLógica: toca repetir');
test('avisa cuando pasa más tiempo que la frecuencia (justo en el límite todavía no)', () => {
    const sess = [S('1', 'a', iso(-29), cmj(30)), S('2', 'b', iso(-28), cmj(30)), S('3', 'c', iso(-5), cmj(30))];
    const r = J(TT.repeatAlerts(sess, [P('a', 'A'), P('b', 'B'), P('c', 'C')], FREQ, NOW, null));
    assert.deepStrictEqual(r.map(x => x.playerId), ['a']);
    assert.strictEqual(r[0].kind, 'repeat');
    assert.strictEqual(r[0].weeks, 4);
    assert.strictEqual(r[0].freq, 4);
    assert.strictEqual(r[0].lastDate, iso(-29));
});
test('cuenta el último test de la jugadora, no el primero', () => {
    const sess = [S('1', 'a', iso(-60), cmj(28)), S('2', 'a', iso(-3), cmj(30))];
    assert.strictEqual(TT.repeatAlerts(sess, [P('a', 'A')], FREQ, NOW, null).length, 0);
});
test('frecuencia 0 o ausente = sin aviso; tests que el equipo nunca ha hecho = sin aviso', () => {
    const sess = [S('1', 'a', iso(-90), cmj(30))];
    assert.strictEqual(TT.repeatAlerts(sess, [P('a', 'A')], { cmj: 0 }, NOW, null).length, 0);
    assert.strictEqual(TT.repeatAlerts(sess, [P('a', 'A')], {}, NOW, null).length, 0);
    assert.strictEqual(TT.repeatAlerts(sess, [P('a', 'A')], { sj: 4 }, NOW, null).length, 0, 'nadie ha hecho SJ');
    assert.strictEqual(TT.repeatAlerts([], [P('a', 'A')], FREQ, NOW, null).length, 0);
});
test('"nunca": sin registros pero el equipo lo hizo dentro del periodo; si el equipo lleva más tiempo, no', () => {
    const reciente = [S('1', 'a', iso(-10), cmj(30))];
    const r = J(TT.repeatAlerts(reciente, [P('a', 'A'), P('b', 'B')], FREQ, NOW, null));
    assert.deepStrictEqual(r.map(x => [x.playerId, x.kind]), [['b', 'never']]);
    assert.strictEqual(r[0].teamLast, iso(-10));
    const antiguo = [S('1', 'a', iso(-40), cmj(30))];
    const r2 = J(TT.repeatAlerts(antiguo, [P('a', 'A'), P('b', 'B')], FREQ, NOW, null));
    assert.deepStrictEqual(r2.map(x => [x.playerId, x.kind]), [['a', 'repeat']]);
});
test('las jugadoras fuera del grupo ese día no avisan', () => {
    const sess = [S('1', 'a', iso(-60), cmj(30))];
    assert.strictEqual(TT.repeatAlerts(sess, [P('a', 'A')], FREQ, NOW, pid => pid === 'a').length, 0);
});
test('playerAlerts agrupa por jugadora; los "nunca" van detrás de los demás; la asimetría no depende de la frecuencia', () => {
    const sess = [S('1', 'a', iso(-50), { ...cmj(30), ...tri(400, 500) }), S('2', 'z', iso(-2), cmj(30)), S('3', 'a', iso(-2), tri(400, 500))];
    const by = J(TT.playerAlerts(sess, [P('a', 'A'), P('z', 'Z'), P('q', 'Q')], FREQ, NOW, null));
    // a: CMJ sin repetir hace 50 días + asimetría en Triple Hop · z: no hizo el Triple Hop que el equipo hizo hace 2 días
    // q: no tiene ningún test, y el equipo hizo CMJ y Triple Hop hace 2 días
    assert.deepStrictEqual(Object.keys(by).sort(), ['a', 'q', 'z']);
    assert.strictEqual(by.a.asym.length, 1);
    assert.deepStrictEqual(by.a.repeat.map(x => [x.testId, x.kind]), [['cmj', 'repeat']]);
    assert.deepStrictEqual(by.z.repeat.map(x => [x.testId, x.kind]), [['triple', 'never']]);
    assert.deepStrictEqual(by.q.repeat.map(x => x.kind), ['never', 'never']);
    const mix = J(TT.playerAlerts([S('1', 'a', iso(-3), cmj(30)), S('2', 'b', iso(-45), cmj(30)), S('3', 'b', iso(-45), tri(400, 410)), S('4', 'a', iso(-9), tri(400, 410))],
        [P('a', 'A'), P('b', 'B'), P('c', 'C')], { cmj: 4, triple: 4 }, NOW, null));
    assert.deepStrictEqual(mix.b.repeat.map(x => x.testId).sort(), ['cmj', 'triple']);
    assert.deepStrictEqual(mix.c.repeat.map(x => x.kind), ['never', 'never'], 'c no tiene ni CMJ ni Triple Hop y el equipo los hizo hace poco');
    assert.ok(!mix.a, 'a está al día en todo');
    const only = J(TT.playerAlerts([S('1', 'a', iso(-2), tri(400, 500))], [P('a', 'A')], {}, NOW, null));
    assert.strictEqual(only.a.asym.length, 1);
    assert.strictEqual(only.a.repeat.length, 0);
});

console.log('\nLista de jugadoras (Tests → Por jugadora)');
test('los avisos salen junto al nombre; quien no tiene ninguno no lleva insignia', () => {
    reset();
    const T = makeTracker([P('a', 'Ana'), P('b', 'Bea')], [
        S('1', 'a', iso(-40), cmj(30)), S('2', 'a', iso(-2), tri(400, 500)),
        S('3', 'b', iso(-2), { ...cmj(30), ...tri(400, 410) }),
    ]);
    const el = mountTests(); T._testSub = 'list';
    T.renderTestsView();
    const h = el.innerHTML;
    const ana = h.slice(h.indexOf('Ana'), h.indexOf('Bea'));
    const bea = h.slice(h.indexOf('Bea'));
    assert.ok(ana.includes('tt-alert--asym') && ana.includes('tt-alert--repeat'));
    assert.ok(!bea.includes('tt-alert'));
    assert.ok(h.includes("event.stopPropagation(); window.rpeTracker._openTestAlerts('a')"), 'pulsar el aviso no abre la ficha');
});
test('con frecuencia 0 en todos los tests no hay avisos de repetir', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], [S('1', 'a', iso(-90), cmj(30))]);
    T.testSettings = { freqWeeks: { cmj: 0 } };
    assert.deepStrictEqual(J(T._testAlertsByPlayer()), {});
});
test('el botón ⚙️ está en la cabecera de las dos pestañas', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], [S('1', 'a', iso(-2), cmj(30))]);
    const el = mountTests();
    T._testSub = 'list'; T.renderTestsView();
    assert.ok(el.innerHTML.includes('_openTestFreqSettings()'));
    T._testSub = 'byTest'; T.renderTestsView();
    assert.ok(el.innerHTML.includes('_openTestFreqSettings()'));
});
test('las jugadoras de baja no llevan avisos', () => {
    reset();
    const baja = P('b', 'Bea', { archived: true, archivedAt: iso(-30) });
    const T = makeTracker([P('a', 'Ana'), baja], [S('1', 'b', iso(-2), tri(400, 500)), S('2', 'a', iso(-2), tri(400, 410))]);
    assert.deepStrictEqual(J(T._testAlertsByPlayer()), {}, 'la baja no avisa y Ana no tiene nada pendiente');
});

console.log('\nExplicación y botones');
test('la explicación de la asimetría dice qué pierna rinde peor, los valores y el umbral', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], [S('1', 'a', iso(-2), tri(400, 500))]);
    T._openTestAlerts('a');
    const h = els.testAlertsModal.innerHTML;
    assert.ok(els.testAlertsModal.classList.contains('active'));
    assert.ok(h.includes('Triple Hop') && h.includes('20.0%'));
    assert.ok(h.includes('La pierna izquierda rinde peor'));
    assert.ok(h.includes('desde el 15 %'));
    assert.ok(h.includes("_testAlertGo('view'") && h.includes("_testAlertGo('register'"));
});
test('en un test donde menos es mejor (5-0-5) la pierna débil es la de mayor tiempo', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], [S('1', 'a', iso(-2), { five0five: { left: 2.5, right: 2.0 } })]);
    T._openTestAlerts('a');
    assert.ok(els.testAlertsModal.innerHTML.includes('La pierna izquierda rinde peor'));
});
test('la explicación de "toca repetir" dice cuándo fue y la frecuencia que fijaste; y la de "nunca" cuándo lo hizo el equipo', () => {
    reset();
    const T = makeTracker([P('a', 'Ana'), P('b', 'Bea')], [S('1', 'a', iso(-43), cmj(30)), S('2', 'b', iso(-43), cmj(30)), S('3', 'c', iso(-6), cmj(30))]);
    T.players.push(P('c', 'Cris'));
    T._openTestAlerts('a');
    let h = els.testAlertsModal.innerHTML;
    assert.ok(h.includes('hace 6 semanas') && h.includes('cada 4 semanas'));
    assert.ok(h.includes('Registrar CMJ'));
    assert.ok(!h.includes('Asimetría entre piernas'), 'sin asimetría no hay esa sección');
    T.players.push(P('d', 'Dana'));
    T._openTestAlerts('d');
    h = els.testAlertsModal.innerHTML;
    assert.ok(h.includes('Todavía no tiene ningún registro de este test'));
});
test('los nombres se escapan en la lista y en la explicación', () => {
    reset();
    const T = makeTracker([P('a', '<img src=x onerror=alert(1)>')], [S('1', 'a', iso(-2), tri(400, 500))]);
    const el = mountTests(); T._testSub = 'list'; T.renderTestsView();
    T._openTestAlerts('a');
    assert.ok(!el.innerHTML.includes('<img') && !els.testAlertsModal.innerHTML.includes('<img'));
});
test('sin avisos no se abre nada', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], [S('1', 'a', iso(-2), tri(400, 410))]);
    T._openTestAlerts('a');
    assert.strictEqual(els.testAlertsModal, undefined);
});
test('"Ver evolución" abre la ficha de tests de la jugadora en ese test', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], [S('1', 'a', iso(-2), tri(400, 500))]);
    const el = mountTests();
    T._openTestAlerts('a');
    let rendered = 0; T.renderTestsView = () => { rendered++; };
    T._testAlertGo('view', 'a', 'triple');
    assert.strictEqual(T._testSub, 'player');
    assert.strictEqual(T._testPlayerId, 'a');
    assert.strictEqual(T._testChartTab, 'triple');
    assert.strictEqual(rendered, 1);
    assert.ok(!els.testAlertsModal.classList.contains('active'), 'cierra la explicación');
});
test('"Registrar…" abre el asistente con la jugadora y el test ya elegidos', () => {
    reset();
    const T = makeTracker([P('a', 'Ana'), P('b', 'Bea')], [S('1', 'a', iso(-43), cmj(30))]);
    T._openTestAlerts('a');
    T._testAlertGo('register', 'a', 'cmj');
    assert.strictEqual(T._tw.testId, 'cmj');
    assert.deepStrictEqual([...T._tw.playerIds], ['a']);
    assert.ok(!els.testAlertsModal.classList.contains('active'));
    assert.ok(els.testWizardModal.classList.contains('active'));
});

console.log('\nPantalla de frecuencias');
test('muestra los 10 tests con sus valores y avisa de que son propuestos', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], []);
    T.testSettings = TT.normalizeSettings(null);
    T._openTestFreqSettings();
    const h = els.testFreqModal.innerHTML;
    assert.strictEqual((h.match(/data-test="/g) || []).length, 10);
    assert.ok(h.includes('data-test="cmj" value="4"'));
    assert.ok(h.includes('Valores propuestos'));
});
test('guardar: valida, guarda en el dispositivo y en Firebase, y repinta la lista', () => {
    reset();
    const writes = [];
    win.firebaseDB = { ref: p => ({ set: v => { writes.push([p, J(v)]); return Promise.resolve(); }, on() {} }) };
    const T = makeTracker([P('a', 'Ana')], []);
    T.renderTestsView = () => { T.renders++; };
    T._openTestFreqSettings();
    const inputs = ['cmj', 'sj', 'triple'].map((id, i) => ({ dataset: { test: id }, value: ['3', '', '10'][i] }));
    els.testFreqModal.querySelectorAll = () => inputs;
    T._submitTestFreqSettings();
    assert.strictEqual(T.testSettings.freqWeeks.cmj, 3);
    assert.strictEqual(T.testSettings.freqWeeks.sj, 0);
    assert.strictEqual(T.testSettings.freqWeeks.triple, 10);
    assert.strictEqual(J(JSON.parse(store.bk_test_settings)).freqWeeks.cmj, 3);
    assert.strictEqual(writes.length, 1);
    assert.strictEqual(writes[0][0], 'testSettings');
    assert.strictEqual(writes[0][1].freqWeeks.cmj, 3);
    assert.ok(writes[0][1].updatedAt);
    assert.strictEqual(T.renders, 1);
    assert.ok(!els.testFreqModal.classList.contains('active'));
});
test('guardar con un valor inválido avisa y no guarda nada', () => {
    reset();
    const writes = [];
    win.firebaseDB = { ref: () => ({ set: v => { writes.push(v); return Promise.resolve(); }, on() {} }) };
    const T = makeTracker([P('a', 'Ana')], []);
    T._openTestFreqSettings();
    els.testFreqModal.querySelectorAll = () => [{ dataset: { test: 'cmj' }, value: '2.5' }];
    T._submitTestFreqSettings();
    assert.strictEqual(T.toasts[T.toasts.length - 1][1], 'error');
    assert.strictEqual(writes.length, 0);
    assert.strictEqual(store.bk_test_settings, undefined);
    assert.ok(els.testFreqModal.classList.contains('active'), 'la pantalla sigue abierta');
});
test('"Valores propuestos" rellena los campos con los valores por defecto (sin guardar)', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], []);
    T._openTestFreqSettings();
    const inputs = [{ dataset: { test: 'cmj' }, value: '1' }, { dataset: { test: 'sj' }, value: '' }];
    els.testFreqModal.querySelectorAll = () => inputs;
    T._resetTestFreqInputs();
    assert.deepStrictEqual(inputs.map(i => i.value), ['4', '8']);
    assert.strictEqual(store.bk_test_settings, undefined);
});
test('los ajustes se leen del dispositivo y se sincronizan con Firebase (un solo listener)', () => {
    reset();
    store.bk_test_settings = JSON.stringify({ freqWeeks: { cmj: 2 } });
    let listeners = 0, cb = null;
    win.firebaseDB = { ref: p => ({ on(ev, fn) { listeners++; cb = fn; } }) };
    const T = vm.runInContext('new RPETracker()', ctx);
    T.currentView = 'dashboard';
    T._ensureTestSettings(); T._ensureTestSettings();
    assert.strictEqual(T.testSettings.freqWeeks.cmj, 2);
    assert.strictEqual(T.testSettings.freqWeeks.sj, 8, 'lo que falta se rellena');
    assert.strictEqual(listeners, 1);
    cb({ val: () => null });
    assert.strictEqual(T.testSettings.freqWeeks.cmj, 2, 'sin ajustes en la nube se conservan los locales');
    cb({ val: () => ({ freqWeeks: { cmj: 6 } }) });
    assert.strictEqual(T.testSettings.freqWeeks.cmj, 6);
    assert.strictEqual(JSON.parse(store.bk_test_settings).freqWeeks.cmj, 6);
});
test('sin Firebase todo sigue funcionando con los valores propuestos', () => {
    reset();
    const T = vm.runInContext('new RPETracker()', ctx);
    T._ensureTestSettings();
    assert.strictEqual(T.testSettings.freqWeeks.cmj, 4);
});

console.log('\nInicio queda como estaba');
test('dashboard-alerts.js no sabe nada de asimetrías y strength.js no repinta Inicio al llegar tests', () => {
    assert.ok(!/asym|_testAsymAlerts|_openTestAsym/i.test(read('dashboard-alerts.js')));
    assert.ok(!read('strength.js').includes("this.currentView === 'dashboard'"));
    assert.ok(!read('tests-team.js').includes('_testAsymAlerts'));
});

(async () => {
    let passed = 0, failed = 0;
    for (const t of pending) {
        try { await t.fn(); passed++; console.log('  ✅ ' + t.name); }
        catch (e) { failed++; console.log('  ❌ ' + t.name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

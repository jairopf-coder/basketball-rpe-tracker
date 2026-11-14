// test/tests-team.test.js
// Tests de rendimiento · vista "Por test" (tests-team.js)
//  • Lógica pura: tests usados, días con datos, serie del equipo, mejor marca, barras.
//  • Pantalla simulada: KPIs, ranking, selector de día, jugadoras en el gráfico, estado vacío.
//  • Cableado: pestañas en strength.js, "+" y botón del asistente, index.html y sw.js.
// Solo LEE los datos: este test también comprueba que no se modifican.
// Ejecutar con:  node test/tests-team.test.js
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

const els = {};
const charts = [];
const mkNode = () => ({
    style: {}, innerHTML: '', textContent: '',
    classList: { add() {}, remove() {}, toggle() {} },
    querySelectorAll() { return []; }, closest() { return null; }, remove() {}
});
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, setTimeout, clearTimeout,
    document: {
        getElementById: id => els[id] || null,
        createElement: () => mkNode(),
        body: { appendChild(n) { if (n.id) els[n.id] = n; } },
        documentElement: { getAttribute: () => null },
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    window: { firebaseSync: null },
    AppConfirm: { show: () => Promise.resolve(true) },
    AppAlert: { show() {} },
    PlayerTokens: { get: () => '#111111' },
    esc: s => String(s == null ? '' : s),
    toLocalISODate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    getCurrentSeasonWindowStart: () => '2026-08-01',
    requestAnimationFrame: fn => fn(),
    sessionStorage: { getItem() { return null; }, setItem() {} },
    Chart: function(canvas, config) { charts.push(config); this.destroy = () => {}; },
});
vm.runInContext('function RPETracker() {}', ctx);
['gps-tracking.js', 'app-players.js', 'injury-management.js', 'strength.js', 'tests-wizard.js', 'tests-team.js']
    .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const L = vm.runInContext('TestWizardLogic', ctx);
const TT = vm.runInContext('TestTeamLogic', ctx);
const def = id => L.defById(id);

const P = (id, name, lastName) => ({ id, name, lastName });
const S = (id, playerId, date, results, createdAt) => ({ id, playerId, date, results, createdAt: createdAt || date });
function makeTracker(players, sessions) {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = players; T.testSessions = sessions;
    T.injuries = []; T.availability = {}; T.currentView = 'tests';
    T.toasts = []; T.renders = 0;
    T.showToast = (m, t) => T.toasts.push([m, t]);
    T.renderTestsView = function() { T.renders++; const el = els.testsView; if (this._testSub === 'byTest') this._renderTestByTest(el); };
    return T;
}
const mount = () => (els.testsView = mkNode());

const DATA = [
    S('1', 'a', '2026-10-01', { sprint10: { value: 1.9 }, cmj: { value: 28 } }),
    S('2', 'b', '2026-10-01', { sprint10: { value: 2.0 } }),
    S('3', 'a', '2026-11-01', { sprint10: { value: 1.8 }, cmj: { value: 30 } }),
    S('4', 'b', '2026-11-01', { sprint10: { value: 2.1 } }),
    S('5', 'c', '2026-11-01', { sprint10: { value: 1.95 } }),
    S('6', 'c', '2026-11-01', { triple: { left: 400, right: 500 } }, '2026-11-01T10'),
];
const PLAYERS = [P('a', 'Ana', 'Pérez'), P('b', 'Bea', 'Ruiz'), P('c', 'Cris', 'Gil')];

console.log('\nLógica');
test('usage: solo tests con datos, de más a menos usados', () => {
    const u = TT.usage(DATA);
    assert.deepStrictEqual(J(u.map(x => x.def.id)), ['sprint10', 'cmj', 'triple']);
    assert.strictEqual(u[0].count, 5);
    assert.strictEqual(u[0].last, '2026-11-01');
    assert.deepStrictEqual(J(TT.usage([])), []);
});
test('datesWithTest: del más reciente al más antiguo, con nº de jugadoras', () => {
    assert.deepStrictEqual(J(TT.datesWithTest(def('sprint10'), DATA)), [{ date: '2026-11-01', count: 3 }, { date: '2026-10-01', count: 2 }]);
    assert.deepStrictEqual(J(TT.datesWithTest(def('cmj'), DATA)).map(d => d.count), [1, 1]);
});
test('series: fechas de antigua a reciente, media del equipo y null si no lo hizo', () => {
    const s = TT.series(def('sprint10'), DATA);
    assert.deepStrictEqual(J(s.dates), ['2026-10-01', '2026-11-01']);
    assert.deepStrictEqual(J(s.mean), [1.95, 1.95]);
    assert.deepStrictEqual(J(s.counts), [2, 3]);
    assert.deepStrictEqual(J(s.perPlayer.c), [null, 1.95]);
    assert.deepStrictEqual(J(s.perPlayer.a), [1.9, 1.8]);
});
test('series con bilateral: usa la media de I y D', () => {
    const s = TT.series(def('triple'), DATA);
    assert.deepStrictEqual(J(s.mean), [450]);
});
test('best: sprint = el más rápido, CMJ = el más alto', () => {
    assert.deepStrictEqual(J(TT.best(def('sprint10'), DATA)), { playerId: 'a', value: 1.8, date: '2026-11-01' });
    assert.strictEqual(TT.best(def('cmj'), DATA).value, 30);
    assert.strictEqual(TT.best(def('dj'), DATA), null);
});
test('barPct: la mejor marca llena la barra (también donde menos es mejor)', () => {
    assert.strictEqual(TT.barPct(def('cmj'), 30, [30, 15]), 100);
    assert.strictEqual(TT.barPct(def('cmj'), 15, [30, 15]), 50);
    assert.strictEqual(TT.barPct(def('sprint10'), 1.8, [1.8, 3.6]), 100);
    assert.strictEqual(TT.barPct(def('sprint10'), 3.6, [1.8, 3.6]), 50);
    assert.strictEqual(TT.barPct(def('cmj'), 0, [0]), 0);
});

console.log('\nPantalla');
test('estado vacío: sin datos invita a registrar el primero', () => {
    const T = makeTracker(PLAYERS, []); const el = mount();
    T._renderTestByTest(el);
    assert.ok(el.innerHTML.includes('Aún no hay datos'));
});
test('por defecto: el test más usado y el último día, con ranking del más rápido al más lento', () => {
    const T = makeTracker(PLAYERS, DATA); const el = mount();
    T._renderTestByTest(el);
    assert.strictEqual(T._tt.testId, 'sprint10');
    assert.strictEqual(T._tt.date, '2026-11-01');
    const h = el.innerHTML;
    assert.ok(h.indexOf('Ana') < h.indexOf('Cris') && h.indexOf('Cris') < h.indexOf('Bea'), 'orden: Ana 1,8 · Cris 1,95 · Bea 2,1');
    assert.ok(h.includes('Media del equipo · 01/11/2026'));
    assert.ok(h.includes('Mejor marca del equipo'));
    assert.ok(h.includes('En este test menos es mejor'));
    assert.ok(h.includes('01/11/2026 · 3 jugadora(s)') && h.includes('01/10/2026 · 2 jugadora(s)'));
});
test('la variación sale respecto al test anterior de cada jugadora y la mejor marca lleva 🏅', () => {
    const T = makeTracker(PLAYERS, DATA); const el = mount();
    T._renderTestByTest(el);
    assert.ok(el.innerHTML.includes('tw-delta--good'), 'Ana mejora');
    assert.ok(el.innerHTML.includes('tw-delta--bad'), 'Bea empeora');
    assert.ok(el.innerHTML.includes('🏅'));
});
test('cambiar de test y de día repinta y reinicia lo que toca', () => {
    const T = makeTracker(PLAYERS, DATA); const el = mount();
    T._testSub = 'byTest';
    T._renderTestByTest(el);
    T._ttTogglePlayer('a');
    assert.ok(T._tt.players.has('a'));
    T._ttSetDate('2026-10-01');
    assert.ok(el.innerHTML.includes('Media del equipo · 01/10/2026'));
    assert.strictEqual((el.innerHTML.match(/class="tt-rank-row"/g) || []).length, 2, 'ese día solo lo hicieron Ana y Bea');
    T._ttSelectTest('cmj');
    assert.strictEqual(T._tt.testId, 'cmj');
    assert.strictEqual(T._tt.players.size, 0, 'al cambiar de test se limpian las jugadoras superpuestas');
    assert.strictEqual(T._tt.date, '2026-11-01', 'al cambiar de test vuelve al último día de ese test');
    assert.ok(el.innerHTML.includes('En este test más es mejor'));
});
test('el gráfico dibuja la media del equipo y suma las jugadoras elegidas, con fechas dd/mm', () => {
    const T = makeTracker(PLAYERS, DATA); const el = mount();
    els.testTeamChart = { getContext: () => ({}) };
    T._testSub = 'byTest';
    charts.length = 0;
    T._renderTestByTest(el);
    assert.strictEqual(charts.length, 1);
    assert.deepStrictEqual(J(charts[0].data.labels), ['01/10', '01/11']);
    assert.strictEqual(charts[0].data.datasets.length, 1);
    assert.strictEqual(charts[0].data.datasets[0].label, 'Media del equipo');
    T._ttTogglePlayer('a'); T._ttTogglePlayer('c');
    assert.strictEqual(charts[charts.length - 1].data.datasets.length, 3);
    delete els.testTeamChart;
});
test('con un solo día de datos no hay gráfico y se explica', () => {
    const T = makeTracker(PLAYERS, [S('1', 'a', '2026-11-01', { cmj: { value: 30 } })]); const el = mount();
    charts.length = 0;
    T._renderTestByTest(el);
    assert.ok(el.innerHTML.includes('al menos dos días'));
    assert.strictEqual(charts.length, 0);
});
test('tests con dos piernas: muestra I y D y la asimetría', () => {
    const T = makeTracker(PLAYERS, DATA); const el = mount();
    T._tt = { testId: 'triple', date: null, players: new Set() };
    T._renderTestByTest(el);
    assert.ok(el.innerHTML.includes('I 400 · D 500'));
    assert.ok(el.innerHTML.includes('Δ 20.0%'));
});
test('una jugadora de baja sigue en el ranking con su marca "(baja)"', () => {
    const baja = { ...P('c', 'Cris', 'Gil'), archived: true, archivedAt: '2026-10-15' };
    const T = makeTracker([P('a', 'Ana', 'Pérez'), P('b', 'Bea', 'Ruiz'), baja], DATA); const el = mount();
    T._renderTestByTest(el);
    assert.ok(el.innerHTML.includes('(baja)'));
});
test('es solo lectura: no modifica las sesiones ni guarda nada', () => {
    const before = J(DATA);
    const T = makeTracker(PLAYERS, J(DATA)); const el = mount();
    T._saveTestSessions = () => { throw new Error('no debe guardar'); };
    T._renderTestByTest(el); T._ttSetDate('2026-10-01'); T._ttTogglePlayer('b');
    assert.deepStrictEqual(J(T.testSessions), before);
});

console.log('\nNavegación y cableado');
test('las pestañas cambian entre "Por jugadora" y "Por test"', () => {
    const T = makeTracker(PLAYERS, DATA); mount();
    assert.ok(T._testsTabsHtml('byTest').includes('tt-tab--active'));
    T._testsSwitchTab('byTest');
    assert.strictEqual(T._testSub, 'byTest');
    T._testsSwitchTab('list');
    assert.strictEqual(T._testSub, 'list');
    assert.strictEqual(T.renders, 2);
});
test('el "+" de la vista Por test abre el asistente con ese test ya elegido', () => {
    const T = makeTracker(PLAYERS, DATA);
    T._openTestWizard(null, 'cmj');
    assert.strictEqual(T._tw.testId, 'cmj');
    T._openTestWizard(null, 'inventado');
    assert.strictEqual(T._tw.testId, null);
});
test('desde el resumen del asistente se salta a la vista Por test con ese test y día', () => {
    const T = makeTracker(PLAYERS, DATA); mount();
    T._openTestWizard(); T._tw.testId = 'sprint10'; T._tw.date = '2026-10-01';
    T._twShowTeamView();
    assert.strictEqual(T._testSub, 'byTest');
    assert.strictEqual(T._tt.testId, 'sprint10');
    assert.strictEqual(T._tt.date, '2026-10-01');
    assert.ok(T.renders >= 1);
});
test('strength.js enruta a la vista Por test y pinta las pestañas en la lista de jugadoras', () => {
    const src = read('strength.js');
    assert.ok(src.includes("if (sub === 'byTest' && typeof this._renderTestByTest === 'function')"));
    assert.ok(src.includes("this._testsTabsHtml('list')"));
});
test('tests-team.js se carga tras tests-wizard.js (index.html) y está en la caché offline (sw.js)', () => {
    const html = read('index.html');
    assert.ok(html.indexOf('tests-team.js') > html.indexOf('tests-wizard.js'));
    assert.ok(read('sw.js').includes("'tests-team.js'"));
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

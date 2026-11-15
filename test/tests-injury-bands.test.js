// test/tests-injury-bands.test.js
// Franja roja de lesión en las gráficas de evolución de los tests (tests-team.js)
//  • Periodo de lesión = de la fecha de inicio al alta (o hasta hoy si sigue lesionada).
//  • Posición de la franja sobre el eje del gráfico, plugin que la dibuja y su uso en la gráfica
//    de la jugadora y en la del equipo (jugadoras superpuestas).
//  • Solo lectura: no toca las lesiones ni los tests.
// Ejecutar con:  node test/tests-injury-bands.test.js
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
const charts = [];
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
    Chart: function(canvas, config) { charts.push(config); this.destroy = () => {}; },
});
vm.runInContext(read('security.js') + '\n;globalThis.esc = esc;', ctx);   // esc() REAL
vm.runInContext('function RPETracker() {}', ctx);
['gps-tracking.js', 'app-players.js', 'injury-management.js', 'strength.js', 'tests-wizard.js', 'tests-team.js']
    .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const TT = vm.runInContext('TestTeamLogic', ctx);
const Plugin = vm.runInContext('InjuryBandsPlugin', ctx);

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


const canvas = () => ({ getContext: () => ({}), _chartInstance: null });
const inj = (id, playerId, status, startDate, endDate) => ({ id, playerId, status, startDate, endDate: endDate || null });
const DATES = ['2026-10-01', '2026-10-11', '2026-10-21'];

console.log('\nPeriodo de lesión');
test('activa: de la fecha de inicio a hoy; recuperada: de inicio a alta', () => {
    const l = [inj('1', 'a', 'active', '2026-11-01'), inj('2', 'a', 'recovered', '2026-09-01', '2026-09-20')];
    const b = J(TT.injuryBands(l, 'a', '2026-11-14'));
    assert.deepStrictEqual(b, [
        { start: '2026-09-01', end: '2026-09-20', ongoing: false, injuryId: '2' },
        { start: '2026-11-01', end: '2026-11-14', ongoing: true, injuryId: '1' },
    ]);
});
test('ignora otras jugadoras, otros estados, fechas inválidas, altas sin fecha y periodos al revés', () => {
    const l = [inj('1', 'b', 'active', '2026-11-01'), inj('2', 'a', 'recurring', '2026-11-01'),
        inj('3', 'a', 'recovered', '2026-09-01', null), inj('4', 'a', 'active', 'no-fecha'),
        inj('5', 'a', 'recovered', '2026-09-20', '2026-09-01'), inj('6', 'a', 'active', '2026-12-01'), null, undefined];
    assert.deepStrictEqual(J(TT.injuryBands(l, 'a', '2026-11-14')), [], 'una lesión que empieza mañana aún no tiene periodo');
    assert.deepStrictEqual(J(TT.injuryBands(null, 'a', '2026-11-14')), []);
});
test('acepta fechas con hora y ordena por inicio', () => {
    const l = [inj('1', 'a', 'recovered', '2026-10-05T10:00:00', '2026-10-09T08:00:00'), inj('2', 'a', 'recovered', '2026-09-05', '2026-09-09')];
    const b = J(TT.injuryBands(l, 'a', '2026-11-14'));
    assert.deepStrictEqual(b.map(x => x.start), ['2026-09-05', '2026-10-05']);
    assert.strictEqual(b[1].end, '2026-10-09');
});

console.log('\nDónde cae sobre el eje');
test('interpola entre puntos: del día 6 al 16 → de 0,5 a 1,5', () => {
    assert.deepStrictEqual(J(TT.bandEdges(DATES, '2026-10-06', '2026-10-16')), { from: 0.5, to: 1.5 });
});
test('lo que sobresale se recorta a los extremos y lo que no toca el rango se descarta', () => {
    assert.deepStrictEqual(J(TT.bandEdges(DATES, '2026-09-01', '2026-10-06')), { from: 0, to: 0.5 });
    assert.deepStrictEqual(J(TT.bandEdges(DATES, '2026-10-16', '2026-12-31')), { from: 1.5, to: 2 });
    assert.deepStrictEqual(J(TT.bandEdges(DATES, '2026-01-01', '2026-12-31')), { from: 0, to: 2 });
    assert.strictEqual(TT.bandEdges(DATES, '2026-08-01', '2026-09-30'), null);
    assert.strictEqual(TT.bandEdges(DATES, '2026-10-22', '2026-11-30'), null);
});
test('los extremos exactos cuentan; una lesión entre dos tests sí se ve', () => {
    assert.deepStrictEqual(J(TT.bandEdges(DATES, '2026-09-01', '2026-10-01')), { from: 0, to: 0 });
    assert.deepStrictEqual(J(TT.bandEdges(DATES, '2026-10-12', '2026-10-14')), { from: 1.1, to: 1.3 });
});
test('fechas repetidas en el eje no dividen por cero; con menos de 2 puntos no hay franja', () => {
    const e = J(TT.bandEdges(['2026-10-01', '2026-10-01', '2026-10-11'], '2026-10-01', '2026-10-06'));
    assert.ok(Number.isFinite(e.from) && Number.isFinite(e.to));
    assert.strictEqual(TT.bandEdges(['2026-10-01'], '2026-10-01', '2026-10-05'), null);
    assert.strictEqual(TT.bandEdges([], '2026-10-01', '2026-10-05'), null);
    assert.strictEqual(TT.bandEdges(null, '2026-10-01', '2026-10-05'), null);
});

console.log('\nPlugin que dibuja');
function fakeChart(left, right) {
    const calls = [];
    const c = {
        ctx: { save() { calls.push(['save']); }, restore() { calls.push(['restore']); }, fillRect(...a) { calls.push(['rect', ...a]); },
            fillText(...a) { calls.push(['text', ...a]); }, set fillStyle(v) {}, set font(v) {}, set textBaseline(v) {} },
        chartArea: { left: 100, right: 300, top: 10, bottom: 110 },
        scales: { x: { getPixelForValue: i => 100 + i * 100 } },
    };
    return { chart: c, calls };
}
test('pinta un rectángulo del alto de la gráfica entre los dos extremos, con su etiqueta', () => {
    const { chart, calls } = fakeChart();
    Plugin.beforeDatasetsDraw(chart, {}, { dates: DATES, bands: [{ start: '2026-10-06', end: '2026-10-16', label: 'Lesión' }] });
    assert.deepStrictEqual(calls.find(c => c[0] === 'rect'), ['rect', 150, 10, 100, 100]);
    assert.ok(calls.some(c => c[0] === 'text' && c[1] === 'Lesión'));
    assert.strictEqual(calls[0][0], 'save');
    assert.strictEqual(calls[calls.length - 1][0], 'restore');
});
test('una franja muy estrecha siempre se ve (mínimo 3 px) y sin sitio no pone etiqueta', () => {
    const { chart, calls } = fakeChart();
    Plugin.beforeDatasetsDraw(chart, {}, { dates: DATES, bands: [{ start: '2026-10-12', end: '2026-10-12', label: 'Lesión' }] });
    const r = calls.find(c => c[0] === 'rect');
    assert.ok(r[3] >= 3);
    assert.ok(!calls.some(c => c[0] === 'text'));
});
test('no dibuja nada sin franjas, sin opciones o con franjas fuera del rango', () => {
    const a = fakeChart(); Plugin.beforeDatasetsDraw(a.chart, {}, undefined);
    const b = fakeChart(); Plugin.beforeDatasetsDraw(b.chart, {}, { dates: DATES, bands: [] });
    const c = fakeChart(); Plugin.beforeDatasetsDraw(c.chart, {}, { dates: DATES, bands: [{ start: '2025-01-01', end: '2025-02-01' }] });
    [a, b, c].forEach(x => assert.ok(!x.calls.some(k => k[0] === 'rect')));
});
test('la franja no se sale del área de la gráfica', () => {
    const { chart, calls } = fakeChart();
    Plugin.beforeDatasetsDraw(chart, {}, { dates: DATES, bands: [{ start: '2026-09-01', end: '2026-12-31' }] });
    const r = calls.find(c => c[0] === 'rect');
    assert.strictEqual(r[1], 100);
    assert.strictEqual(r[1] + r[3], 300);
});

console.log('\nGráfica de la jugadora');
const SPR = (id, date, v) => S(id, 'a', date, { sprint10: { value: v } });
const SESS = [SPR('1', '2026-09-01', 1.9), SPR('2', '2026-10-01', 2.0), SPR('3', '2026-11-01', 1.85)];
function makeTracker(players, sessions, injuries) {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = players; T.testSessions = sessions; T.injuries = injuries || []; T.availability = {};
    T.currentView = 'tests'; T.toasts = [];
    T.showToast = (m, t) => T.toasts.push([m, t]);
    return T;
}
function playerPage(T) {
    ['testChartV', 'testChartL', 'testChartR', 'testChartA', 'testTeamChart'].forEach(id => { els[id] = canvas(); });
    charts.length = 0;
    const el = (els.testsView = { innerHTML: '' });
    T._testSub = 'player'; T._testPlayerId = 'a';
    T.renderTestsView();
    return el;
}
test('con una lesión que toca la gráfica: franja en la gráfica y explicación debajo', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], SESS, [inj('1', 'a', 'recovered', '2026-09-20', '2026-10-10')]);
    const el = playerPage(T);
    assert.strictEqual(charts.length, 1);
    assert.ok(charts[0].plugins.includes(Plugin));
    const o = charts[0].options.plugins.injuryBands;
    assert.strictEqual(o.bands.length, 1);
    assert.deepStrictEqual(J(o.dates), ['2026-09-01', '2026-10-01', '2026-11-01']);
    assert.strictEqual(o.bands[0].label, 'Lesión');
    assert.ok(el.innerHTML.includes('La franja roja marca un periodo de lesión'));
});
test('una lesión activa llega hasta hoy', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], SESS, [inj('1', 'a', 'active', '2026-10-20')]);
    playerPage(T);
    const b = charts[0].options.plugins.injuryBands.bands[0];
    assert.strictEqual(b.ongoing, true);
    assert.strictEqual(b.end, NOW);
});
test('sin lesiones, o con lesiones fuera del periodo del gráfico, no hay franja ni explicación', () => {
    reset();
    let T = makeTracker([P('a', 'Ana')], SESS, []);
    let el = playerPage(T);
    assert.deepStrictEqual(J(charts[0].plugins), []);
    assert.ok(!charts[0].options.plugins.injuryBands);
    assert.ok(!el.innerHTML.includes('franja roja'));
    reset();
    T = makeTracker([P('a', 'Ana')], SESS, [inj('1', 'a', 'recovered', '2025-01-01', '2025-02-01'), inj('2', 'b', 'active', '2026-10-01')]);
    el = playerPage(T);
    assert.ok(!charts[0].options.plugins.injuryBands);
    assert.ok(!el.innerHTML.includes('franja roja'));
});
test('en tests de dos piernas llevan franja las tres gráficas (izquierda, derecha y asimetría)', () => {
    reset();
    const ses = [S('1', 'a', '2026-09-01', { triple: { left: 400, right: 410 } }), S('2', 'a', '2026-10-01', { triple: { left: 420, right: 500 } }), S('3', 'a', '2026-11-01', { triple: { left: 430, right: 440 } })];
    const T = makeTracker([P('a', 'Ana')], ses, [inj('1', 'a', 'recovered', '2026-09-20', '2026-10-10')]);
    T._testChartTab = 'triple';
    playerPage(T);
    assert.strictEqual(charts.length, 3);
    charts.forEach(c => {
        assert.ok(c.plugins.includes(Plugin));
        assert.strictEqual(c.options.plugins.injuryBands.bands.length, 1);
    });
    assert.ok(charts[2].plugins.length === 2, 'la de asimetría conserva sus zonas de color');
});
test('solo lectura: no modifica las lesiones ni los tests', () => {
    reset();
    const injuries = [inj('1', 'a', 'recovered', '2026-09-20', '2026-10-10'), inj('2', 'a', 'active', '2026-11-05')];
    const before = J({ injuries, SESS });
    const T = makeTracker([P('a', 'Ana')], J(SESS), J(injuries));
    playerPage(T);
    assert.deepStrictEqual(J({ injuries: T.injuries, SESS: T.testSessions }), before);
});

console.log('\nGráfica del equipo (Por test)');
function teamPage(T, selected) {
    els.testTeamChart = canvas(); charts.length = 0;
    const el = (els.testsView = { innerHTML: '' });
    T._testSub = 'byTest'; T._tt = { testId: 'sprint10', date: null, players: new Set(selected || []) };
    T.renderTestsView();
    return el;
}
const TEAM = [SPR('1', '2026-09-01', 1.9), SPR('2', '2026-10-01', 2.0), SPR('3', '2026-11-01', 1.85),
    S('4', 'b', '2026-09-01', { sprint10: { value: 2.1 } }), S('5', 'b', '2026-11-01', { sprint10: { value: 2.0 } })];
test('con jugadoras superpuestas, sale la franja de cada una con su nombre; sin elegir ninguna, no hay franjas', () => {
    reset();
    const T = makeTracker([P('a', 'Ana'), P('b', 'Bea')], TEAM, [inj('1', 'a', 'recovered', '2026-09-20', '2026-10-10'), inj('2', 'b', 'recovered', '2026-10-05', '2026-10-25')]);
    let el = teamPage(T, ['a', 'b']);
    const o = charts[0].options.plugins.injuryBands;
    assert.deepStrictEqual(J(o.bands.map(b => b.label)), ['Ana', 'Bea']);
    assert.ok(charts[0].plugins.includes(Plugin));
    assert.ok(el.innerHTML.includes('La franja roja marca un periodo de lesión'));
    el = teamPage(T, []);
    assert.ok(!charts[0].options.plugins.injuryBands);
    assert.ok(!el.innerHTML.includes('franja roja'));
    teamPage(T, ['b']);
    assert.deepStrictEqual(J(charts[0].options.plugins.injuryBands.bands.map(b => b.label)), ['Bea']);
});

(async () => {
    let passed = 0, failed = 0;
    for (const t of pending) {
        try { await t.fn(); passed++; console.log('  ✅ ' + t.name); }
        catch (e) { failed++; console.log('  ❌ ' + t.name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 6).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

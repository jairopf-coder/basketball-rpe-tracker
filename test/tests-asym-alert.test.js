// test/tests-asym-alert.test.js
// Aviso de asimetría alta en Inicio (tests-team.js + dashboard-alerts.js)
//  • Lógica: solo el ÚLTIMO test de cada jugadora y test de dos piernas, ≥15 %, de los últimos 60 días,
//    solo jugadoras de la plantilla actual.
//  • Integración: identificador del aviso, chip y fila en la línea de avisos, escape de nombres,
//    botón que abre los tests de esa jugadora, carga de datos al primer uso.
// Ejecutar con:  node test/tests-asym-alert.test.js
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

const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, setTimeout, clearTimeout,
    document: { getElementById: () => null, addEventListener() {}, createElement: () => ({ style: {} }), head: { appendChild() {} }, body: { appendChild() {} }, documentElement: { getAttribute: () => null } },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    window: { firebaseSync: null, firebaseAuth: { currentUser: null }, firebaseDB: null },
    AppConfirm: { show: () => Promise.resolve(true) }, AppAlert: { show() {} },
    PlayerTokens: { get: () => '#111111' },
    toLocalISODate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    getCurrentSeasonWindowStart: () => '2026-08-01',
    requestAnimationFrame: fn => fn(),
    sessionStorage: { getItem() { return null; }, setItem() {} },
});
vm.runInContext(read('security.js') + '\n;globalThis.esc = esc;', ctx);   // esc() REAL
vm.runInContext('function RPETracker() {}', ctx);
['gps-tracking.js', 'app-players.js', 'injury-management.js', 'strength.js', 'tests-wizard.js', 'tests-team.js', 'dashboard-alerts.js']
    .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const TT = vm.runInContext('TestTeamLogic', ctx);

const P = (id, name, extra) => ({ id, name, lastName: 'X', ...(extra || {}) });
const S = (id, playerId, date, results, createdAt) => ({ id, playerId, date, results, createdAt: createdAt || date });
const tri = (l, r) => ({ triple: { left: l, right: r } });
const NOW = iso(0);

function makeTracker(players, sessions) {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = players; T.testSessions = sessions;
    T.injuries = []; T.availability = {};
    return T;
}
const EMPTY = { dangerPlayers: [], warnPlayers: [], trendAlerts: [], rpeDiscrepancies: [] };

console.log('\nLógica');
test('solo ≥15 %, de mayor a menor', () => {
    const sess = [S('1', 'a', iso(-5), tri(400, 500)),        // 20 %
                  S('2', 'b', iso(-5), tri(400, 450)),        // 11,1 %
                  S('3', 'c', iso(-5), tri(400, 470))];       // 14,9 %
    const r = J(TT.asymAlerts(sess, [P('a', 'Ana'), P('b', 'Bea'), P('c', 'Cris')], NOW));
    assert.deepStrictEqual(r.map(x => x.playerId), ['a']);
    assert.strictEqual(r[0].asym, 20);
    const r2 = J(TT.asymAlerts([S('1', 'a', iso(-5), tri(400, 500)), S('2', 'b', iso(-5), tri(400, 480))], [P('a', 'A'), P('b', 'B')], NOW));
    assert.deepStrictEqual(r2.map(x => x.playerId), ['a', 'b'], 'orden: 20 % antes que 16,7 %');
});
test('límite exacto: 15,0 % ya es alerta', () => {
    const r = TT.asymAlerts([S('1', 'a', iso(-1), tri(85, 100))], [P('a', 'A')], NOW);
    assert.strictEqual(r.length, 1);
});
test('solo cuenta el último test: si luego mejora, la alerta desaparece; si empeora, aparece', () => {
    const mejora = [S('1', 'a', iso(-20), tri(400, 500)), S('2', 'a', iso(-3), tri(400, 410))];
    assert.strictEqual(TT.asymAlerts(mejora, [P('a', 'A')], NOW).length, 0);
    const empeora = [S('1', 'a', iso(-20), tri(400, 410)), S('2', 'a', iso(-3), tri(400, 500))];
    const r = J(TT.asymAlerts(empeora, [P('a', 'A')], NOW));
    assert.strictEqual(r.length, 1);
    assert.strictEqual(r[0].date, iso(-3));
});
test('cada test de dos piernas va por separado', () => {
    const sess = [S('1', 'a', iso(-5), { triple: { left: 400, right: 500 }, slcmj: { left: 20, right: 21 } })];
    const r = J(TT.asymAlerts(sess, [P('a', 'A')], NOW));
    assert.deepStrictEqual(r.map(x => x.testId), ['triple']);
});
test('más de 60 días: ya no es una alerta de hoy (a los 60 todavía sí)', () => {
    assert.strictEqual(TT.asymAlerts([S('1', 'a', iso(-61), tri(400, 500))], [P('a', 'A')], NOW).length, 0);
    assert.strictEqual(TT.asymAlerts([S('1', 'a', iso(-60), tri(400, 500))], [P('a', 'A')], NOW).length, 1);
});
test('ignora jugadoras que no están en la lista, tests de una sola pierna y resultados con un solo lado', () => {
    const sess = [S('1', 'x', iso(-2), tri(400, 500)),
                  S('2', 'a', iso(-2), { cmj: { value: 30 } }),
                  S('3', 'a', iso(-2), { triple: { left: 400, right: null } })];
    assert.strictEqual(TT.asymAlerts(sess, [P('a', 'A')], NOW).length, 0);
    assert.deepStrictEqual(J(TT.asymAlerts([], [P('a', 'A')], NOW)), []);
    assert.deepStrictEqual(J(TT.asymAlerts(null, null, NOW)), []);
});
test('el umbral y la antigüedad se pueden cambiar', () => {
    const sess = [S('1', 'a', iso(-5), tri(400, 450))];                       // 11,1 %
    assert.strictEqual(TT.asymAlerts(sess, [P('a', 'A')], NOW).length, 0);
    assert.strictEqual(TT.asymAlerts(sess, [P('a', 'A')], NOW, { threshold: 10 }).length, 1);
    assert.strictEqual(TT.asymAlerts(sess, [P('a', 'A')], NOW, { threshold: 10, maxAgeDays: 2 }).length, 0);
});

console.log('\nIntegración con los avisos de Inicio');
test('aparece en la línea de avisos con su identificador, chip, fila y botón', () => {
    const T = makeTracker([P('a', 'Ana')], [S('1', 'a', iso(-5), tri(400, 500))]);
    const c = T._collectDashAlerts(EMPTY);
    assert.deepStrictEqual(J(c.keys), [`as:a:triple:${iso(-5)}`]);
    assert.strictEqual(c.total, 1);
    const html = T._renderDashAlerts(EMPTY);
    assert.ok(html.includes('Asimetría 1'));
    assert.ok(html.includes('Ana') && html.includes('20%') && html.includes('I 400 · D 500'));
    assert.ok(html.includes('data-player-id="a"') && html.includes('data-test-id="triple"'));
    assert.deepStrictEqual(J(T._lastDashAlertKeys), [`as:a:triple:${iso(-5)}`], '«Marcar como visto» la incluye');
});
test('suma al resto de avisos sin tocarlos', () => {
    const T = makeTracker([P('a', 'Ana')], [S('1', 'a', iso(-5), tri(400, 500))]);
    const c = T._collectDashAlerts({ ...EMPTY, dangerPlayers: [{ player: { id: 'a', name: 'Ana' } }] });
    assert.strictEqual(c.total, 2);
    assert.strictEqual(c.danger.length, 1);
    assert.strictEqual(c.asym.length, 1);
});
test('sin asimetrías altas no cambia nada', () => {
    const T = makeTracker([P('a', 'Ana')], [S('1', 'a', iso(-5), tri(400, 410))]);
    assert.strictEqual(T._collectDashAlerts(EMPTY).total, 0);
    assert.strictEqual(T._renderDashAlerts(EMPTY), '');
});
test('los nombres se escapan (no se cuela HTML)', () => {
    const T = makeTracker([P('a', '<img src=x onerror=alert(1)>')], [S('1', 'a', iso(-5), tri(400, 500))]);
    const html = T._renderDashAlerts(EMPTY);
    assert.ok(!html.includes('<img'), 'el nombre no puede salir como etiqueta');
    assert.ok(html.includes('&lt;img'));
});
test('las jugadoras dadas de baja no avisan', () => {
    const baja = P('b', 'Bea', { archived: true, archivedAt: iso(-30) });
    const T = makeTracker([P('a', 'Ana'), baja], [S('1', 'b', iso(-5), tri(400, 500))]);
    assert.strictEqual(T._collectDashAlerts(EMPTY).total, 0);
});
test('los tests se cargan al primer uso y sin datos no hay aviso', () => {
    const T = makeTracker([P('a', 'Ana')], undefined);
    let loads = 0;
    T._loadStrengthData = () => { loads++; T.testSessions = [S('1', 'a', iso(-5), tri(400, 500))]; };
    assert.strictEqual(T._testAsymAlerts().length, 1);
    T._testAsymAlerts(); T._testAsymAlerts();
    assert.strictEqual(loads, 1, 'solo carga una vez');
    const T2 = makeTracker([P('a', 'Ana')], undefined);
    T2._loadStrengthData = () => { T2.testSessions = []; };
    assert.deepStrictEqual(J(T2._testAsymAlerts()), []);
});
test('el botón abre los tests de esa jugadora, en ese test', () => {
    const T = makeTracker([P('a', 'Ana')], []);
    const calls = [];
    T.switchView = v => calls.push(v);
    T._openTestAsym('a', 'triple');
    assert.strictEqual(T._testSub, 'player');
    assert.strictEqual(T._testPlayerId, 'a');
    assert.strictEqual(T._testChartTab, 'triple');
    assert.deepStrictEqual(calls, ['tests']);
});
test('al llegar los tests de Firebase se repinta Inicio (para que salga el aviso)', () => {
    const src = read('strength.js');
    assert.ok(src.includes("else if (this.currentView === 'dashboard' && typeof this.renderDashboard === 'function') this.renderDashboard();"));
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

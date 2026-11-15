// test/tests-export.test.js
// Exportar los tests de rendimiento a Excel (tests-export.js)
//  • Hoja Resultados (una fila por jugadora, test y día), Resumen equipo y LEEME.
//  • Filtros del modal de informe: alcance, fechas y tests.
//  • Se genera un .xlsx REAL con la librería de la app y se vuelve a leer para comprobar fechas, números y hojas.
// Ejecutar con:  node test/tests-export.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('../xlsx.mini.min.js');

const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const J = x => JSON.parse(JSON.stringify(x));

const els = {};
let checks = [];
const clicks = [];
const mkNode = () => ({ style: {}, innerHTML: '', classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, setAttribute(k, v) { this[k] = v; }, click() { clicks.push(this); }, querySelectorAll: () => [], closest: () => null, remove() {} });
const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, setTimeout, clearTimeout, Uint8Array,
    document: {
        getElementById: id => els[id] || null, addEventListener() {}, head: { appendChild() {} },
        createElement: () => mkNode(), querySelectorAll: () => checks,
        body: { appendChild() {}, removeChild() {} }, documentElement: { getAttribute: () => null },
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    window: { firebaseSync: null, XLSX },
    Blob: function(parts, opts) { this.parts = parts; this.type = opts && opts.type; },
    URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
    AppConfirm: { show: () => Promise.resolve(true) }, AppAlert: { show() {} },
    PlayerTokens: { get: () => '#111111' }, esc: s => String(s == null ? '' : s),
    toLocalISODate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    getCurrentSeasonWindowStart: () => '2026-08-01', requestAnimationFrame: fn => fn(),
    sessionStorage: { getItem() { return null; }, setItem() {} },
});
vm.runInContext('function RPETracker() {}', ctx);
['gps-tracking.js', 'app-players.js', 'injury-management.js', 'strength.js', 'tests-wizard.js', 'tests-export.js']
    .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const TE = vm.runInContext('TestsExport', ctx);

const P = (id, name, lastName, extra) => ({ id, name, lastName, ...(extra || {}) });
const S = (id, playerId, date, results, extra) => ({ id, playerId, date, results, createdAt: date + 'T10:00:00', ...(extra || {}) });
const PLAYERS = [P('a', 'Ana', 'Pérez'), P('b', 'Bea', 'Ruiz'), P('c', 'Cris', 'Gil', { archived: true })];
const DATA = [
    S('1', 'a', '2026-10-01', { cmj: { value: 28, trials: [27, 28, 29], power: 900, powerPerKg: 15 }, sprint10: { value: 1.9, raw: 1.9 } }, { bodyWeight: 60 }),
    S('2', 'b', '2026-10-01', { sprint10: { value: 2.0, raw: 2.0 } }),
    S('3', 'a', '2026-11-01', { sprint10: { value: 1.8, raw: 1.8, note: 'pista mojada' }, triple: { left: 400, right: 500, note: 'rodilla' } }),
    S('4', 'b', '2026-11-01', { sprint10: { value: 2.1, raw: 2.1, note: 'pista mojada' } }),
    S('5', 'c', '2026-11-01', { sprint10: { value: 1.95, raw: 1.95 } }),
    S('6', 'a', '2026-11-01', { slcmj: { left: 20, right: 22, trials_left: [19, 21], trials_right: [22] } }),
];
const run = (o) => TE.construir({ sessions: DATA, players: PLAYERS, hoy: '2026-11-14', ...(o || {}) });
const sheet = (wb, name) => XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true });

console.log('\nHoja Resultados');
test('una fila por jugadora, test y día; ordenadas por fecha, test y jugadora', () => {
    const r = run();
    assert.strictEqual(r.stats.filasResultados, 8);
    assert.deepStrictEqual(J(r.resultados.map(x => [x.Fecha, x.Test, x.Jugadora])), [
        ['2026-10-01', 'CMJ', 'Ana Pérez'], ['2026-10-01', 'Sprint 10m', 'Ana Pérez'], ['2026-10-01', 'Sprint 10m', 'Bea Ruiz'],
        ['2026-11-01', 'Single Leg CMJ', 'Ana Pérez'], ['2026-11-01', 'Triple Hop', 'Ana Pérez'],
        ['2026-11-01', 'Sprint 10m', 'Ana Pérez'], ['2026-11-01', 'Sprint 10m', 'Bea Ruiz'], ['2026-11-01', 'Sprint 10m', 'Cris Gil'],
    ]);
    assert.strictEqual(r.stats.jugadoras, 3);
    assert.strictEqual(r.stats.tests, 4);
    assert.strictEqual(r.stats.desde, '2026-10-01');
    assert.strictEqual(r.stats.hasta, '2026-11-01');
});
test('valores, unidad, potencia, peso, intentos y nota de un CMJ', () => {
    const f = run().resultados.find(x => x.Test === 'CMJ');
    assert.strictEqual(f.Valor, 28);
    assert.strictEqual(f.Unidad, 'cm');
    assert.strictEqual(f['Potencia (W)'], 900);
    assert.strictEqual(f['Potencia (W/kg)'], 15);
    assert.strictEqual(f['Peso (kg)'], 60);
    assert.strictEqual(f.Intentos, '27 / 28 / 29');
    assert.strictEqual(f.Izquierda, '');
    assert.strictEqual(f['Asimetría (%)'], '');
});
test('tests de dos piernas: media, izquierda, derecha, asimetría e intentos por lado', () => {
    const t = run().resultados.find(x => x.Test === 'Triple Hop');
    assert.strictEqual(t.Valor, 450);
    assert.strictEqual(t.Izquierda, 400); assert.strictEqual(t.Derecha, 500);
    assert.strictEqual(t['Asimetría (%)'], 20);
    assert.strictEqual(t.Nota, 'rodilla');
    const s = run().resultados.find(x => x.Test === 'Single Leg CMJ');
    assert.strictEqual(s.Intentos, 'I: 19 / 21 · D: 22');
});
test('estado de la jugadora: Activa, Baja y jugadora eliminada', () => {
    const r = run({ sessions: DATA.concat([S('9', 'zzz', '2026-11-01', { cmj: { value: 30 } })]) });
    assert.strictEqual(r.resultados.find(x => x.Jugadora === 'Ana Pérez').Estado, 'Activa');
    assert.strictEqual(r.resultados.find(x => x.Jugadora === 'Cris Gil').Estado, 'Baja');
    const el = r.resultados.find(x => x.Jugadora === '(jugadora eliminada)');
    assert.ok(el && el.Estado === '');
});
test('las filas no llevan campos internos', () => {
    const f = run().resultados[0];
    assert.deepStrictEqual(Object.keys(f), J(TE.COLS_RESULTADOS));
});
test('filtros: una jugadora, rango de fechas y tests elegidos', () => {
    assert.ok(run({ scope: 'b' }).resultados.every(x => x.Jugadora === 'Bea Ruiz'));
    assert.strictEqual(run({ desde: '2026-11-01', hasta: '2026-11-30' }).stats.desde, '2026-11-01');
    assert.strictEqual(run({ desde: '2026-10-15' }).resultados.some(x => x.Fecha === '2026-10-01'), false);
    assert.strictEqual(run({ hasta: '2026-10-15' }).resultados.some(x => x.Fecha === '2026-11-01'), false);
    const solo = run({ testIds: ['sprint10'] });
    assert.ok(solo.resultados.every(x => x.Test === 'Sprint 10m'));
    assert.strictEqual(solo.stats.tests, 1);
    assert.strictEqual(run({ testIds: ['dj'] }).stats.filasResultados, 0);
});
test('los dos registros del mismo test y día salen los dos en Resultados', () => {
    const dup = DATA.concat([S('7', 'a', '2026-11-01', { sprint10: { value: 1.7 } }, { createdAt: '2026-11-01T18:00:00' })]);
    const r = run({ sessions: dup, testIds: ['sprint10'], scope: 'a' });
    assert.strictEqual(r.resultados.filter(x => x.Fecha === '2026-11-01').length, 2);
});

console.log('\nHoja Resumen equipo');
test('media, mejor y peor (en sprint, menos es mejor) y mejor jugadora', () => {
    const r = run({ testIds: ['sprint10'] });
    const nov = r.resumen.find(x => x.Fecha === '2026-11-01');
    assert.strictEqual(nov['Nº jugadoras'], 3);
    assert.strictEqual(nov.Media, 1.95);
    assert.strictEqual(nov.Mejor, 1.8);
    assert.strictEqual(nov.Peor, 2.1);
    assert.strictEqual(nov['Mejor jugadora'], 'Ana Pérez');
    const oct = r.resumen.find(x => x.Fecha === '2026-10-01');
    assert.strictEqual(oct['Cambio de la media (%)'], '', 'primer registro: sin cambio');
    assert.strictEqual(nov['Cambio de la media (%)'], 0, '1,95 → 1,95');
});
test('CMJ: mejor = el más alto; cambio de la media frente al test anterior', () => {
    const d = DATA.concat([S('8', 'a', '2026-11-01', { cmj: { value: 30 } })]);
    const r = run({ sessions: d, testIds: ['cmj'] });
    assert.strictEqual(r.resumen.length, 2);
    assert.strictEqual(r.resumen[1].Mejor, 30);
    assert.strictEqual(r.resumen[1]['Cambio de la media (%)'], 7.1);
});
test('en el Resumen una jugadora cuenta una vez por día (el último registro)', () => {
    const dup = DATA.concat([S('7', 'a', '2026-11-01', { sprint10: { value: 1.6 } }, { createdAt: '2026-11-01T18:00:00' })]);
    const nov = run({ sessions: dup, testIds: ['sprint10'] }).resumen.find(x => x.Fecha === '2026-11-01');
    assert.strictEqual(nov['Nº jugadoras'], 3);
    assert.strictEqual(nov.Mejor, 1.6);
});
test('tests de dos piernas: se resume la media de I y D', () => {
    const t = run({ testIds: ['triple'] }).resumen[0];
    assert.strictEqual(t.Media, 450);
    assert.strictEqual(t.Unidad, 'cm');
});

console.log('\nArchivo');
test('nombre del archivo: equipo o una jugadora, con la fecha de hoy', () => {
    assert.strictEqual(run().nombreArchivo, 'BasketballRPE-tests_2026-11-14.xlsx');
    assert.strictEqual(run({ scope: 'a' }).nombreArchivo, 'BasketballRPE-tests_Ana-Perez_2026-11-14.xlsx');
});
test('serialExcel: fechas de Excel correctas', () => {
    assert.strictEqual(TE.serialExcel('2026-11-14'), 46340);
    assert.strictEqual(TE.serialExcel('2000-01-01'), 36526);
    assert.strictEqual(TE.serialExcel('no es fecha'), null);
});
test('se genera un .xlsx real y al leerlo las fechas son fechas y los valores son números', () => {
    const r = run();
    const wb = XLSX.read(XLSX.write(TE.crearLibro(XLSX, r), { bookType: 'xlsx', type: 'array' }), { type: 'array' });
    assert.deepStrictEqual(wb.SheetNames, ['Resultados', 'Resumen equipo', 'LEEME']);
    const rows = sheet(wb, 'Resultados');
    assert.deepStrictEqual(rows[0], J(TE.COLS_RESULTADOS));
    assert.strictEqual(rows.length, 1 + r.resultados.length);
    const f = wb.Sheets['Resultados'];
    assert.strictEqual(f.A2.t, 'n');
    assert.strictEqual(f.A2.w, '01/10/2026');
    assert.strictEqual(XLSX.SSF.format('yyyy-mm-dd', f.A2.v), '2026-10-01');
    assert.strictEqual(typeof f.F2.v, 'number');
    assert.ok(f['!autofilter'] || wb.Sheets['Resultados']['!ref']);
    assert.strictEqual(sheet(wb, 'Resumen equipo')[0].length, TE.COLS_RESUMEN.length);
    assert.strictEqual(wb.Sheets['Resumen equipo'].A2.w.length, 10);
});
test('LEEME explica las columnas y recuerda los filtros aplicados', () => {
    const r = run({ scope: 'a', desde: '2026-10-01', hasta: '2026-11-30', testIds: ['cmj', 'sprint10'] });
    const wb = XLSX.read(XLSX.write(TE.crearLibro(XLSX, r), { bookType: 'xlsx', type: 'array' }), { type: 'array' });
    const l = sheet(wb, 'LEEME');
    assert.deepStrictEqual(l[0], ['Campo', 'Descripción']);
    assert.ok(String(l[1][1]).includes('Ana Pérez') && String(l[1][1]).includes('2026-10-01') && String(l[1][1]).includes('CMJ, Sprint 10m'));
    assert.ok(l.some(x => x[0] === 'Asimetría (%)') && l.some(x => x[0] === 'Nota'));
});
test('con datos vacíos el libro se genera igualmente (sin romper)', () => {
    const r = run({ sessions: [] });
    assert.strictEqual(r.stats.filasResultados, 0);
    const wb = XLSX.read(XLSX.write(TE.crearLibro(XLSX, r), { bookType: 'xlsx', type: 'array' }), { type: 'array' });
    assert.strictEqual(sheet(wb, 'Resultados').length, 1);
});
test('exportar es solo lectura: no modifica las sesiones', () => {
    const before = J(DATA);
    run();
    assert.deepStrictEqual(J(DATA), before);
});

console.log('\nBotón del modal de informe');
function makeTracker(sessions) {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = PLAYERS; T.testSessions = sessions; T.toasts = [];
    T.showToast = (m, t) => T.toasts.push([m, t]);
    T._exportFisioLoadLib = () => Promise.resolve();
    return T;
}
function modal(scope, from, to, ids) {
    els.testsReportScope = { value: scope }; els.testsReportFrom = { value: from }; els.testsReportTo = { value: to };
    checks = ids.map(v => ({ value: v }));
    els.testsReportModal = { classList: { remove() { els.testsReportModal.closed = true; }, add() {} } };
}
test('valida fechas y tests como el informe PDF', async () => {
    const T = makeTracker(DATA);
    modal('team', '', '2026-11-30', ['cmj']);          await T.generateTestsExcel();
    modal('team', '2026-11-30', '2026-10-01', ['cmj']); await T.generateTestsExcel();
    modal('team', '2026-10-01', '2026-11-30', []);      await T.generateTestsExcel();
    assert.deepStrictEqual(T.toasts.map(t => t[1]), ['error', 'error', 'error']);
    assert.strictEqual(clicks.length, 0);
});
test('sin datos con esos filtros: avisa y no descarga', async () => {
    const T = makeTracker(DATA); clicks.length = 0;
    modal('team', '2026-12-01', '2026-12-31', ['cmj']);
    await T.generateTestsExcel();
    assert.strictEqual(T.toasts[0][1], 'warning');
    assert.strictEqual(clicks.length, 0);
});
test('con datos descarga el archivo con el nombre esperado, cierra el modal y avisa', async () => {
    const T = makeTracker(DATA); clicks.length = 0;
    modal('team', '2026-10-01', '2026-11-30', ['cmj', 'sprint10', 'triple']);
    await T.generateTestsExcel();
    assert.strictEqual(clicks.length, 1);
    assert.ok(/^BasketballRPE-tests_\d{4}-\d{2}-\d{2}\.xlsx$/.test(clicks[0].download));
    assert.strictEqual(els.testsReportModal.closed, true);
    assert.ok(T.toasts[T.toasts.length - 1][0].includes('Excel de tests generado'));
});
test('si la librería de Excel no carga, avisa sin romper', async () => {
    const T = makeTracker(DATA); clicks.length = 0;
    T._exportFisioLoadLib = () => Promise.reject(new Error('No se pudo cargar la librería de Excel'));
    modal('team', '2026-10-01', '2026-11-30', ['cmj']);
    await T.generateTestsExcel();
    assert.strictEqual(clicks.length, 0);
    assert.ok(T.toasts[T.toasts.length - 1][0].includes('No se pudo generar el Excel'));
});

console.log('\nCableado');
test('el botón está en el modal de informe, el script se carga y está en la caché offline', () => {
    const pdf = read('pdf-reports.js');
    assert.ok(pdf.includes('window.rpeTracker.generateTestsExcel()'));
    assert.ok(pdf.includes('📥 Excel'));
    const html = read('index.html');
    assert.ok(html.indexOf('tests-export.js') > html.indexOf('tests-wizard.js'));
    assert.ok(read('sw.js').includes("'tests-export.js'"));
    assert.ok(read('strength.js').includes('📄 Informe / Excel') && read('tests-team.js').includes('📄 Informe / Excel'));
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

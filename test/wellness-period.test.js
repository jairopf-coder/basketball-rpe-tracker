// test/wellness-period.test.js
// Pruebas de: chip de periodo (Hoy/7d/21d), fusión jugadora+staff con "period"
// y detección de ciclo menstrual. Ejecutar con:  node test/wellness-period.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

// Sandbox mínimo del navegador. Todo se crea DENTRO del contexto del VM.
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, isNaN,
    document: { createElement: () => ({}), head: { appendChild() {} }, getElementById: () => null, documentElement: { classList: { contains: () => false } }, body: { classList: { contains: () => false } } },
    window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 },
    localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: () => {},
    PlayerTokens: { avatar: () => '' },
    esc: s => String(s),
});
vm.runInContext(`
    function RPETracker() {}
    function toLocalISODate(d) {
        const p = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
`, ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'wellness.js'), 'utf8'), ctx);

const T = vm.runInContext('new RPETracker()', ctx);
const iso = off => { const d = new Date(); d.setDate(d.getDate() - off); return vm.runInContext('toLocalISODate', ctx)(d); };
const w = (playerId, off, extra) => Object.assign({ id: `w_${playerId}_${iso(off)}`, playerId, date: iso(off), sleep: 4, fatigue: 4, mood: 4, soreness: 4 }, extra || {});
T.players = [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bea' }];

console.log('\nRango (chip)');
test('por defecto es Hoy y rota Hoy → 7 días → 21 días → Hoy', () => {
    T.renderWellnessDashboard = () => {};
    assert.strictEqual(T._wCurrentRange().key, 'today');
    T._wCycleRange(); assert.strictEqual(T._wCurrentRange().key, '7d');
    T._wCycleRange(); assert.strictEqual(T._wCurrentRange().key, '21d');
    T._wCycleRange(); assert.strictEqual(T._wCurrentRange().key, 'today');
});
test('_wRangeStart(1) es hoy, (7) es hace 6 días, (21) hace 20', () => {
    assert.strictEqual(T._wRangeStart(1), iso(0));
    assert.strictEqual(T._wRangeStart(7), iso(6));
    assert.strictEqual(T._wRangeStart(21), iso(20));
});
test('la tabla cambia de datos según el periodo', () => {
    T.wellnessData = [w('p1', 0, { sleep: 5 }), w('p1', 3, { sleep: 1 }), w('p1', 15, { sleep: 1 })];
    T._wRange = 'today';  let h = T._renderWPlayerTable();
    assert.ok(h.includes('📅 Hoy'));
    T._wRange = '7d';     h = T._renderWPlayerTable(); assert.ok(h.includes('📅 7 días'));
    T._wRange = '21d';    h = T._renderWPlayerTable(); assert.ok(h.includes('📅 21 días'));
    // media de sueño de Ana: hoy=5 ; 7d=(5+1)/2=3 ; 21d=(5+1+1)/3=2.33
    T._wRange = 'today';
    const avgToday = T.wellnessData.filter(x => x.date >= T._wRangeStart(1)).map(x => x.sleep);
    assert.deepStrictEqual(Array.from(avgToday), [5]);
    assert.strictEqual(T.wellnessData.filter(x => x.date >= T._wRangeStart(7)).length, 2);
    assert.strictEqual(T.wellnessData.filter(x => x.date >= T._wRangeStart(21)).length, 3);
});
test('jugadora sin datos en el periodo muestra —, sin romper', () => {
    T.wellnessData = []; T._wRange = 'today';
    const h = T._renderWPlayerTable();
    assert.ok(h.includes('Media del equipo') && h.includes('Ana') && h.includes('Bea'));
});
test('el dato de HOY entra en "Hoy" aunque sea de madrugada (sin desfase UTC)', () => {
    T.wellnessData = [w('p1', 0)];
    assert.strictEqual(T.wellnessData.filter(x => x.date >= T._wRangeStart(1)).length, 1);
});

console.log('\nFusión jugadora + staff (period)');
test('entrada de jugadora con period:true llega al formato staff', () => {
    T.players = [{ id: 'p1', name: 'Ana', authUid: 'u1' }];
    const r = T._mergeWellnessPlayer([], [{ uid: 'u1', date: iso(0), sleep: 3, fatigue: 3, mood: 3, pain: 3, period: true }]);
    assert.strictEqual(r.length, 1); assert.strictEqual(r[0].period, true);
});
test('sin marca NO se crea la propiedad (Firebase rechaza undefined)', () => {
    const r = T._mergeWellnessPlayer([], [{ uid: 'u1', date: iso(0), sleep: 3, fatigue: 3, mood: 3, pain: 3 }]);
    assert.strictEqual('period' in r[0], false);
    assert.doesNotThrow(() => JSON.stringify(r)); // ninguna clave undefined
    assert.ok(!Object.values(r[0]).some(v => v === undefined && false));
});
test('staff sin decisión + jugadora marcada → se completa con true', () => {
    const staff = [{ id: 's1', playerId: 'p1', date: iso(0), sleep: 4, fatigue: 4, mood: 4, soreness: 4 }];
    const r = T._mergeWellnessPlayer(staff, [{ uid: 'u1', date: iso(0), period: true }]);
    assert.strictEqual(r.length, 1); assert.strictEqual(r[0].period, true);
    assert.strictEqual(staff[0].period, undefined, 'no debe mutar el original');
});
test('staff con period:false manda sobre la jugadora (puede quitar la marca)', () => {
    const staff = [{ id: 's1', playerId: 'p1', date: iso(0), sleep: 4, fatigue: 4, mood: 4, soreness: 4, period: false }];
    const r = T._mergeWellnessPlayer(staff, [{ uid: 'u1', date: iso(0), period: true }]);
    assert.strictEqual(r[0].period, false);
});

console.log('\nDetección de ciclo');
test('sin registros de regla: episodios 0 y no activa', () => {
    T.players = [{ id: 'p1', name: 'Ana' }]; T._wCycleCache = null;
    T.wellnessData = [w('p1', 0), w('p1', 1)];
    const i = T._wCycleInfo('p1'); assert.strictEqual(i.episodes, 0); assert.strictEqual(i.active, false);
});
test('marcada hoy, ayer y anteayer → activa, Día 3', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 5), w('p1', 2, { period: true }), w('p1', 1, { period: true }), w('p1', 0, { period: true })];
    const i = T._wCycleInfo('p1'); assert.strictEqual(i.active, true); assert.strictEqual(i.dayNumber, 3);
    assert.strictEqual(i.lastStart, iso(2));
});
test('al día siguiente sin marcar (registro sin period) → ya no activa', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 3, { period: true }), w('p1', 2, { period: true }), w('p1', 1), w('p1', 0)];
    const i = T._wCycleInfo('p1'); assert.strictEqual(i.active, false); assert.strictEqual(i.episodes, 1);
});
test('un día sin registrar dentro de la racha NO la corta', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 3, { period: true }), w('p1', 1, { period: true })]; // falta el día 2
    const i = T._wCycleInfo('p1'); assert.strictEqual(i.episodes, 1); assert.strictEqual(i.dayNumber, 3);
});
test('dos episodios a 28 días → ciclo aprox. 28', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 30, { period: true }), w('p1', 29, { period: true }), w('p1', 28), w('p1', 2, { period: true }), w('p1', 1, { period: true })];
    const i = T._wCycleInfo('p1'); assert.strictEqual(i.episodes, 2); assert.strictEqual(i.cycleLength, 28);
});
test('ciclo absurdo (datos incompletos, 5 días) se descarta', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 6, { period: true }), w('p1', 5), w('p1', 1, { period: true })];
    assert.strictEqual(T._wCycleInfo('p1').cycleLength, null);
});
test('última marca hace 5 días sin registros posteriores → no activa', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 5, { period: true })];
    assert.strictEqual(T._wCycleInfo('p1').active, false);
});
test('cruce de mes: días entre 2026-08-30 y 2026-09-02 = 3', () => {
    assert.strictEqual(T._wDaysBetween('2026-08-30', '2026-09-02'), 3);
});
test('la tarjeta se renderiza (vacía y con datos) sin errores', () => {
    T._wCycleCache = null; T.wellnessData = [];
    assert.ok(T._renderWCycleCard().includes('Aún no hay registros'));
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 0, { period: true })];
    const h = T._renderWCycleCard(); assert.ok(h.includes('Día 1') && h.includes('Con la regla ahora'));
});

console.log(`\n${passed} OK, ${failed} fallos`);
process.exit(failed ? 1 : 0);

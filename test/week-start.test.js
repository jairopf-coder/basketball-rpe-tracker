// test/week-start.test.js
// ============================================================
// El lunes de cada semana debe calcularse igual en toda la app, también los
// DOMINGOS (getDay() vale 0 y la fórmula antigua "getDate() - getDay() + 1"
// saltaba a la semana SIGUIENTE).
//
//   - _wpWeekStartForOffset()  (weekplan-medical.js): fechas que pinta Planificación
//   - _wpMondayForOffset()     (weekplan-medical.js): semana cuyo plan se lee/guarda
//   - getWeekKey()             (app-comparisons.js)
//
// Ejecutar con:  node test/week-start.test.js
// ============================================================

'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (err) { console.log(`  ❌ ${name}`); console.log(`     ${err.message}`); failed++; }
}

// Crea un contexto donde "hoy" es la fecha indicada (mediodía local por defecto).
function loadAt(y, m, d, h = 12) {
    const sandbox = { console, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
    sandbox.window = sandbox;
    // Stub mínimo de DOM: los archivos de la app lo tocan al cargarse
    sandbox.document = {
        addEventListener() {}, getElementById() { return null; }, querySelector() { return null; },
        createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
        head: { appendChild() {} }, body: { appendChild() {} }
    };
    const ctx = vm.createContext(sandbox);
    const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

    vm.runInContext(`
        const RealDate = Date;
        class FixedDate extends RealDate {
            constructor(...a) { if (a.length === 0) super(${new Date(y, m - 1, d, h).getTime()}); else super(...a); }
            static now() { return ${new Date(y, m - 1, d, h).getTime()}; }
        }
        Date = FixedDate;
        class RPETracker {}
        window.RPETracker = RPETracker;
    `, ctx);
    vm.runInContext(read('store.js'), ctx, { filename: 'store.js' });
    vm.runInContext(read('weekplan-medical.js'), ctx, { filename: 'weekplan-medical.js' });
    vm.runInContext(read('app-comparisons.js'), ctx, { filename: 'app-comparisons.js' });
    ctx.t = vm.runInContext('new RPETracker()', ctx);
    return ctx;
}

const pad = n => String(n).padStart(2, '0');
const iso = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

console.log('\nLunes de la semana (también en domingo)');

// Domingo 18/10/2026 → su lunes es el 12/10
test('domingo 18/10: semana actual empieza el lunes 12/10 (antes saltaba al 19/10)', () => {
    const { t } = loadAt(2026, 10, 18);
    assert.strictEqual(iso(t._wpWeekStartForOffset(0)), '2026-10-12');
    assert.strictEqual(t._wpMondayForOffset(0), '2026-10-12');
});

test('domingo 18/10: semana anterior = 5/10 y siguiente = 19/10', () => {
    const { t } = loadAt(2026, 10, 18);
    assert.strictEqual(iso(t._wpWeekStartForOffset(-1)), '2026-10-05');
    assert.strictEqual(iso(t._wpWeekStartForOffset(1)), '2026-10-19');
});

test('fechas pintadas y plan leído son SIEMPRE de la misma semana (todos los días, 3 posiciones)', () => {
    for (let day = 5; day <= 25; day++) {          // 3 semanas completas, con 3 domingos
        const { t } = loadAt(2026, 10, day);
        for (const off of [-2, -1, 0, 1, 2]) {
            const ws = t._wpWeekStartForOffset(off);
            assert.strictEqual(ws.getDay(), 1, `día ${day}, offset ${off}: no es lunes`);
            assert.strictEqual(iso(ws), t._wpMondayForOffset(off), `día ${day}, offset ${off}: fechas y plan difieren`);
        }
    }
});

test('el lunes devuelto es medianoche local (sin hora arrastrada)', () => {
    const { t } = loadAt(2026, 10, 18, 23);
    const ws = t._wpWeekStartForOffset(0);
    assert.strictEqual(ws.getHours(), 0);
    assert.strictEqual(ws.getMinutes(), 0);
});

test('la semana actual siempre contiene a "hoy" (lunes a domingo)', () => {
    for (let day = 5; day <= 25; day++) {
        const { t } = loadAt(2026, 10, day);
        const ws = t._wpWeekStartForOffset(0);
        const hoy = new Date(2026, 9, day);
        const diff = Math.round((hoy - ws) / 86400000);
        assert.ok(diff >= 0 && diff <= 6, `día ${day}: hoy queda a ${diff} días del lunes`);
    }
});

test('cruce de mes y de año: domingo 1/2/2026 → lunes 26/1/2026', () => {
    const { t } = loadAt(2026, 2, 1);
    assert.strictEqual(iso(t._wpWeekStartForOffset(0)), '2026-01-26');
});

console.log('\ngetWeekKey (app-comparisons.js)');

test('domingo 18/10 pertenece a la semana del lunes 12/10 (antes: 19/10)', () => {
    const { t } = loadAt(2026, 10, 18);
    assert.strictEqual(t.getWeekKey(new Date(2026, 9, 18)), '2026-10-12');
});

test('lunes a domingo de una misma semana dan la misma clave', () => {
    const { t } = loadAt(2026, 10, 18);
    for (let day = 12; day <= 18; day++) {
        assert.strictEqual(t.getWeekKey(new Date(2026, 9, day)), '2026-10-12', `día ${day}`);
    }
    assert.strictEqual(t.getWeekKey(new Date(2026, 9, 19)), '2026-10-19');
    assert.strictEqual(t.getWeekKey(new Date(2026, 9, 11)), '2026-10-05');
});

// ============================================================
console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} pasados, ${failed} fallidos`);
if (failed > 0) process.exit(1);

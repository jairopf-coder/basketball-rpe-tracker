// test/date-format.test.js
// ============================================================
// Formato de fechas día/mes de la app (store.js):
//   formatDM("15/10"), formatDMY("15/10/2026"), formatWeekdayDM("jue 15/10"),
//   formatDMRange("12/10 – 18/10")
// y guarda para que las pantallas migradas no vuelvan a escribir el mes en letra.
//
// Ejecutar con:  node test/date-format.test.js
// ============================================================

'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

let passed = 0;
let failed = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`  ✅ ${name}`);
        passed++;
    } catch (err) {
        console.log(`  ❌ ${name}`);
        console.log(`     ${err.message}`);
        failed++;
    }
}

function section(title) {
    console.log(`\n${title}`);
}

const ROOT = path.join(__dirname, '..');

// ── Cargar store.js (mismo método que ewma-and-dates.test.js) ──────────────
function loadStore() {
    const sandbox = { console, localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} } };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    const code = fs.readFileSync(path.join(ROOT, 'store.js'), 'utf8');
    vm.runInContext(code, context, { filename: 'store.js' });
    return context;
}

const S = loadStore();
const D = vm.runInContext('Date', S);                 // Date del contexto donde viven las funciones
const day = (y, m, d) => new D(y, m - 1, d, 12);      // m en 1..12; mediodía para no depender de la zona

// ============================================================
section('formatDM — día/mes sin ceros a la izquierda');

test('Date: 5 de octubre → "5/10"', () => assert.strictEqual(S.formatDM(day(2026, 10, 5)), '5/10'));
test('Date: 31 de enero → "31/1"', () => assert.strictEqual(S.formatDM(day(2026, 1, 31)), '31/1'));
test('texto AAAA-MM-DD → "15/10"', () => assert.strictEqual(S.formatDM('2026-10-15'), '15/10'));
test('texto con hora local no se desplaza de día (23:30)', () => assert.strictEqual(S.formatDM('2026-10-15T23:30:00'), '15/10'));
test('texto con hora local no se desplaza de día (00:10)', () => assert.strictEqual(S.formatDM('2026-10-15T00:10:00'), '15/10'));
test('texto UTC con Z (mediodía) → "15/10"', () => assert.strictEqual(S.formatDM('2026-10-15T12:00:00Z'), '15/10'));
test('fechas no válidas → cadena vacía', () => {
    [null, undefined, '', 'abc', 42, {}, new D('x')].forEach(v =>
        assert.strictEqual(S.formatDM(v), '', `debería ser "" para ${String(v)}`));
});

// ============================================================
section('formatDMY — con año');

test('texto → "5/10/2026"', () => assert.strictEqual(S.formatDMY('2026-10-05'), '5/10/2026'));
test('Date de fin de año → "31/12/2025"', () => assert.strictEqual(S.formatDMY(day(2025, 12, 31)), '31/12/2025'));
test('fecha no válida → ""', () => assert.strictEqual(S.formatDMY('nada'), ''));

// ============================================================
section('formatWeekdayDM — día de la semana + día/mes');

const weekdayOf = (y, m, d) => day(y, m, d).toLocaleDateString('es-ES', { weekday: 'short' });
test('"jue 15/10" (el día de la semana sale del propio navegador)', () => {
    assert.strictEqual(S.formatWeekdayDM('2026-10-15'), `${weekdayOf(2026, 10, 15)} 15/10`);
    assert.ok(/^\S+ 15\/10$/.test(S.formatWeekdayDM('2026-10-15')));
});
test('con año: "jue 15/10/2026"', () => {
    assert.strictEqual(S.formatWeekdayDM(day(2026, 10, 15), true), `${weekdayOf(2026, 10, 15)} 15/10/2026`);
});
test('fecha no válida → ""', () => assert.strictEqual(S.formatWeekdayDM(undefined), ''));

// ============================================================
section('formatDMRange — rangos de semana');

test('misma semana, textos', () => assert.strictEqual(S.formatDMRange('2026-10-12', '2026-10-18'), '12/10 – 18/10'));
test('misma semana, Date', () => assert.strictEqual(S.formatDMRange(day(2026, 10, 12), day(2026, 10, 18)), '12/10 – 18/10'));
test('cruza de mes', () => assert.strictEqual(S.formatDMRange('2026-09-28', '2026-10-04'), '28/9 – 4/10'));

// ============================================================
section('Guardas de código');

// Pantallas ya migradas: ninguna debe volver a pedir el mes en letra junto al día
const MIGRATED = [
    'app.js', 'app-analytics.js', 'app-sessions.js', 'dashboard-renderer.js', 'gps-tracking-analytics.js',
    'injury-management-2.js', 'microciclo.js', 'team-load.js', 'weekplan-medical.js', 'wellness.js'
];
const DAY_WITH_SHORT_MONTH =
    /\{[^{}]*\bday\b[^{}]*\bmonth\s*:\s*['"]short['"][^{}]*\}|\{[^{}]*\bmonth\s*:\s*['"]short['"][^{}]*\bday\b[^{}]*\}/;

MIGRATED.forEach(f => {
    test(`${f}: sin fechas "día + mes corto en letra"`, () => {
        assert.ok(!DAY_WITH_SHORT_MONTH.test(fs.readFileSync(path.join(ROOT, f), 'utf8')),
            'usa toLocaleDateString con day + month:"short"; usa formatDM/formatDMY de store.js');
    });
});

test('dashboard-renderer.js: la fecha del próximo partido ya no usa una lista de meses en letra', () => {
    assert.ok(!/\['Ene',\s*'Feb'/.test(fs.readFileSync(path.join(ROOT, 'dashboard-renderer.js'), 'utf8')));
});

test('formatDM y compañía se definen solo en store.js (sin copias locales)', () => {
    const copies = fs.readdirSync(ROOT)
        .filter(f => f.endsWith('.js') && f !== 'store.js' && !f.endsWith('.min.js'))
        .filter(f => /(function|const|let|var)\s+(formatDM|formatDMY|formatWeekdayDM|formatDMRange)\b/.test(
            fs.readFileSync(path.join(ROOT, f), 'utf8')));
    assert.deepStrictEqual(copies, []);
});

// ============================================================
console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} pasados, ${failed} fallidos`);
if (failed > 0) process.exit(1);

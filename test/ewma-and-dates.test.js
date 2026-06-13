// test/ewma-and-dates.test.js
// ============================================================
// Tests unitarios para lógica pura sin dependencias de DOM/Firebase:
//   - toLocalISODate()        (store.js)
//   - calculateAcuteChronicRatio()  (ewma-calculator.js)
//
// Ejecutar con:  node test/ewma-and-dates.test.js
// Sin frameworks externos: usa assert de Node.
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

// ── Cargar store.js para obtener toLocalISODate ────────────────────────────
function loadStore() {
    const sandbox = { console, localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} } };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);
    const code = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
    vm.runInContext(code, context, { filename: 'store.js' });
    return context;
}

// ── Cargar ewma-calculator.js con un stub mínimo de RPETracker ─────────────
function loadEwma() {
    const sandbox = { console, localStorage: { getItem(){return null;}, setItem(){}, removeItem(){} } };
    sandbox.window = sandbox;
    const context = vm.createContext(sandbox);

    // Stub mínimo: ewma-calculator.js solo necesita
    // RPETracker.prototype.* y RPETracker.MATCH_LOAD_MULTIPLIER
    vm.runInContext(`
        class RPETracker {
            constructor(sessions, players) {
                this.sessions = sessions || [];
                this.players = players || [];
            }
            static get MATCH_LOAD_MULTIPLIER() { return 1.5; }
        }
        window.RPETracker = RPETracker;
    `, context, { filename: 'rpetracker-stub.js' });

    const code = fs.readFileSync(path.join(__dirname, '..', 'ewma-calculator.js'), 'utf8');
    vm.runInContext(code, context, { filename: 'ewma-calculator.js' });
    return context;
}

// Helper: genera una fecha ISO (YYYY-MM-DD) hace N días
function daysAgo(n) {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return d.toISOString().slice(0, 10);
}

// ============================================================
section('toLocalISODate (store.js)');
// ============================================================
{
    const ctx = loadStore();
    const { toLocalISODate } = ctx;

    test('string YYYY-MM-DD se devuelve igual (sin parsear como UTC)', () => {
        assert.strictEqual(toLocalISODate('2026-06-12'), '2026-06-12');
    });

    test('string con hora se recorta a los 10 primeros caracteres', () => {
        assert.strictEqual(toLocalISODate('2026-06-12T23:59:59Z'), '2026-06-12');
    });

    test('objeto Date usa componentes locales (no UTC)', () => {
        // 31 de diciembre 2026 a las 23:00 hora local
        const d = new Date(2026, 11, 31, 23, 0, 0);
        assert.strictEqual(toLocalISODate(d), '2026-12-31');
    });

    test('objeto Date con día de un solo dígito añade cero (mes y día)', () => {
        const d = new Date(2026, 0, 5); // 5 de enero 2026
        assert.strictEqual(toLocalISODate(d), '2026-01-05');
    });

    test('no sufre el bug de "un día atrás" típico de toISOString en UTC-X', () => {
        // Simula medianoche local: con new Date('2026-06-12') + toISOString().slice(0,10)
        // en zonas UTC negativas esto daría '2026-06-11'. toLocalISODate sobre el
        // STRING original debe conservar el día correcto.
        const original = '2026-06-12';
        assert.strictEqual(toLocalISODate(original), '2026-06-12');
    });
}

// ============================================================
section('calculateAcuteChronicRatio (ewma-calculator.js)');
// ============================================================
{
    const ctx = loadEwma();
    const { RPETracker } = ctx;

    test('sin sesiones devuelve N/A con confidence "low"', () => {
        const tracker = new RPETracker([], []);
        const result = tracker.calculateAcuteChronicRatio('player1');
        assert.strictEqual(result.ratio, 'N/A');
        assert.strictEqual(result.confidence, 'low');
        assert.strictEqual(result.message, 'Datos insuficientes');
    });

    test('con menos de 7 sesiones en 28 días devuelve confidence "low" (BUG fix Conv B)', () => {
        // Solo 3 sesiones recientes -> por debajo del umbral minSessions=7
        const sessions = [
            { playerId: 'player1', date: daysAgo(1), rpe: 6, duration: 60 },
            { playerId: 'player1', date: daysAgo(3), rpe: 7, duration: 60 },
            { playerId: 'player1', date: daysAgo(5), rpe: 5, duration: 60 },
        ];
        const tracker = new RPETracker(sessions, []);
        const result = tracker.calculateAcuteChronicRatio('player1');
        assert.strictEqual(result.confidence, 'low');
        assert.strictEqual(result.ratio, 'N/A');
        assert.strictEqual(result.sessions21d, 3);
    });

    test('con 7+ sesiones en 28 días devuelve confidence "high" y ratio numérico', () => {
        // 8 sesiones recientes (>= minSessions de 7) repartidas en las últimas 4 semanas
        const sessions = [];
        for (let i = 0; i < 8; i++) {
            sessions.push({ playerId: 'player1', date: daysAgo(i * 3), rpe: 6, duration: 60 });
        }
        const tracker = new RPETracker(sessions, []);
        const result = tracker.calculateAcuteChronicRatio('player1');
        assert.strictEqual(result.confidence, 'high');
        assert.notStrictEqual(result.ratio, 'N/A');
        assert.ok(!isNaN(parseFloat(result.ratio)), `ratio debería ser numérico, recibido: ${result.ratio}`);
    });

    test('sesiones con load/rpe inválido (NaN, 0, negativo) se descartan sin romper el cálculo', () => {
        const sessions = [
            // 8 sesiones válidas (cumplen minSessions)
            ...Array.from({ length: 8 }, (_, i) => ({
                playerId: 'player1', date: daysAgo(i * 3), rpe: 6, duration: 60
            })),
            // sesiones corruptas que NO deben contar ni romper el cálculo
            { playerId: 'player1', date: daysAgo(2), rpe: null, duration: 60, load: NaN },
            { playerId: 'player1', date: daysAgo(4), rpe: 0, duration: 60, load: 0 },
            { playerId: 'player1', date: daysAgo(6), rpe: 5, duration: 60, load: -10 },
        ];
        const tracker = new RPETracker(sessions, []);
        const result = tracker.calculateAcuteChronicRatio('player1');
        assert.ok(!isNaN(parseFloat(result.ratio)), `ratio no debería ser NaN, recibido: ${result.ratio}`);
        assert.strictEqual(result.confidence, 'high');
    });

    test('multiplicador de partido (1.5x) se aplica a sesiones type=match', () => {
        // Dos jugadoras con la misma carga base, una con sesiones de tipo "match"
        const baseSessions = (type) => Array.from({ length: 8 }, (_, i) => ({
            playerId: type === 'match' ? 'matchPlayer' : 'trainPlayer',
            date: daysAgo(i * 3),
            rpe: 6,
            duration: 60,
            type
        }));
        const tracker = new RPETracker([...baseSessions('match'), ...baseSessions('training')], []);
        const matchResult = tracker.calculateAcuteChronicRatio('matchPlayer');
        const trainResult = tracker.calculateAcuteChronicRatio('trainPlayer');
        // La carga acumulada de la jugadora "match" debe ser mayor (1.5x)
        assert.ok(matchResult.totalLoad7d > trainResult.totalLoad7d,
            `carga de partido (${matchResult.totalLoad7d}) debería ser mayor que entreno (${trainResult.totalLoad7d})`);
    });

    test('readinessLabel devuelve colores/iconos correctos por rango', () => {
        const tracker = new RPETracker([], []);
        assert.strictEqual(tracker.readinessLabel(null).cls, 'rdy-none');
        assert.strictEqual(tracker.readinessLabel(80).cls, 'rdy-green');
        assert.strictEqual(tracker.readinessLabel(50).cls, 'rdy-yellow');
        assert.strictEqual(tracker.readinessLabel(20).cls, 'rdy-red');
    });

    test('getPlayerThresholds devuelve valores por defecto si la jugadora no tiene umbrales propios', () => {
        const tracker = new RPETracker([], [{ id: 'p1', name: 'Test' }]);
        const t = tracker.getPlayerThresholds('p1');
        assert.strictEqual(t.low, 0.8);
        assert.strictEqual(t.opt, 1.3);
        assert.strictEqual(t.high, 1.5);
    });

    test('getPlayerThresholds respeta umbrales personalizados de la jugadora', () => {
        const tracker = new RPETracker([], [{ id: 'p1', acThresholdLow: 0.6, acThresholdOpt: 1.1, acThresholdHigh: 1.4 }]);
        const t = tracker.getPlayerThresholds('p1');
        assert.strictEqual(t.low, 0.6);
        assert.strictEqual(t.opt, 1.1);
        assert.strictEqual(t.high, 1.4);
    });
}

// ============================================================
console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} pasados, ${failed} fallidos`);
if (failed > 0) process.exit(1);

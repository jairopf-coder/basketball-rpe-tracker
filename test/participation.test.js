// test/participation.test.js
// ============================================================
// Fase 1 — jugadoras lesionadas / no disponibles y medias de equipo.
//
// Una jugadora que no entrena con el grupo ("out") NO debe contar en:
//   - la carga planificada del equipo (Microciclo y Planificación)
//   - la comparación real vs plan
//   - la "Media del equipo" de Comparar
//   - el ratio A:C medio del equipo
// El wellness sigue contando para todas (no usa estas funciones).
//
//   getPlayerParticipation(playerId, fecha) → 'full' | 'partial' | 'out'
//     - lesión activa fases 1-4 → out · fase 5 → partial · fase 6 → full
//     - disponibilidad marcada: 'unavailable' → out · 'limited' → partial
//     - se evalúa con las fechas de la lesión y la fase de ESE día
//
// Ejecutar con:  node test/participation.test.js
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

// "Hoy" fijo: domingo 18/10/2026 (la semana actual es lun 12/10 – dom 18/10)
function load() {
    const FIXED = new Date(2026, 9, 18, 12).getTime();
    const sandbox = { console, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
    sandbox.window = sandbox;
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
            constructor(...a) { if (a.length === 0) super(${FIXED}); else super(...a); }
            static now() { return ${FIXED}; }
        }
        Date = FixedDate;
        class RPETracker {}
        window.RPETracker = RPETracker;
        window.esc = s => String(s);
        window.PlayerTokens = { avatar: () => '', get: () => '#999' };
        window.requestAnimationFrame = () => 0;   // el gráfico se dibuja después de pintar la tabla
    `, ctx);
    ['store.js', 'injury-management.js', 'weekplan-medical.js', 'microciclo.js', 'app-comparisons.js']
        .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
    return ctx;
}

// Crea el tracker con objetos construidos DENTRO del contexto del VM
function makeTracker(ctx, { players, injuries = [], availability = {}, sessions = [], plan = null }) {
    ctx.__in = { players, injuries, availability, sessions, plan };
    return vm.runInContext(`
        (() => {
            const t = new RPETracker();
            const i = JSON.parse(JSON.stringify(window.__in));
            t.players = i.players; t.injuries = i.injuries; t.availability = i.availability;
            t.sessions = i.sessions;
            t.weekPlan = { weekOffset: 0, weeks: i.plan ? { '2026-10-12': { days: i.plan, savedAt: 'x' } } : {} };
            return t;
        })()
    `, ctx);
}

const slot = (type, intensity, duration) => ({ type, intensity, duration, focus: '', enabled: true });
const rest = () => ({ type: 'rest', intensity: 'none', duration: 0, focus: '', enabled: false });
const day = (morning, afternoon) => ({ morning: morning || rest(), afternoon: afternoon || rest() });

const ctx = load();
const P = (id) => ({ id, name: id });

// ============================================================
console.log('\ngetPlayerParticipation');

test('sin lesión ni marcas: full', () => {
    const t = makeTracker(ctx, { players: [P('a')] });
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-14'), 'full');
});

test('lesión activa en fases 1-4: out; fase 5: partial; fase 6: full', () => {
    const res = [1, 2, 3, 4, 5, 6].map(ph => {
        const t = makeTracker(ctx, { players: [P('a')], injuries: [{ playerId: 'a', startDate: '2026-10-01', status: 'active', rtpPhase: ph, history: [] }] });
        return t.getPlayerParticipation('a', '2026-10-14');
    });
    assert.deepStrictEqual(res, ['out', 'out', 'out', 'out', 'partial', 'full']);
});

test('antes de la fecha de inicio de la lesión: full', () => {
    const t = makeTracker(ctx, { players: [P('a')], injuries: [{ playerId: 'a', startDate: '2026-10-14', status: 'active', rtpPhase: 1, history: [] }] });
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-13'), 'full');
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-14'), 'out');
});

test('usa la fase de ESE día según el historial', () => {
    const inj = { playerId: 'a', startDate: '2026-10-01', status: 'active', rtpPhase: 5,
        history: [{ date: '2026-10-08T10:00:00.000Z', phase: 3 }, { date: '2026-10-15T10:00:00.000Z', phase: 5 }] };
    const t = makeTracker(ctx, { players: [P('a')], injuries: [inj] });
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-05'), 'out');      // antes de la 1ª actualización: fase 1
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-10'), 'out');      // fase 3
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-15'), 'partial');  // fase 5
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-18'), 'partial');
});

test('lesión recuperada: fuera hasta el día anterior a la recuperación; después, full', () => {
    const inj = { playerId: 'a', startDate: '2026-10-01', endDate: '2026-10-10', status: 'recovered', rtpPhase: 6,
        history: [{ date: '2026-10-10T08:00:00.000Z', phase: 6 }] };
    const t = makeTracker(ctx, { players: [P('a')], injuries: [inj] });
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-09'), 'out');
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-10'), 'full');
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-14'), 'full');
});

test('recuperada sin fecha de fin o estado "recurring": no cambia nada (full)', () => {
    const t1 = makeTracker(ctx, { players: [P('a')], injuries: [{ playerId: 'a', startDate: '2026-10-01', status: 'recovered', rtpPhase: 6, history: [] }] });
    const t2 = makeTracker(ctx, { players: [P('a')], injuries: [{ playerId: 'a', startDate: '2026-10-01', status: 'recurring', rtpPhase: 1, history: [] }] });
    assert.strictEqual(t1.getPlayerParticipation('a', '2026-10-14'), 'full');
    assert.strictEqual(t2.getPlayerParticipation('a', '2026-10-14'), 'full');
});

test('disponibilidad: unavailable → out, limited → partial; otro día no afecta', () => {
    const t = makeTracker(ctx, { players: [P('a')], availability: { a: { '2026-10-14': 'unavailable', '2026-10-15': 'limited' } } });
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-14'), 'out');
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-15'), 'partial');
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-16'), 'full');
});

test('si hay varias señales gana la más restrictiva (out > partial)', () => {
    const inj = { playerId: 'a', startDate: '2026-10-01', status: 'active', rtpPhase: 5, history: [] };   // partial
    const t = makeTracker(ctx, { players: [P('a')], injuries: [inj], availability: { a: { '2026-10-14': 'unavailable' } } });
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-14'), 'out');
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-15'), 'partial');
});

test('una lesión de otra jugadora no afecta; sin datos de lesiones/disponibilidad no falla', () => {
    const t = makeTracker(ctx, { players: [P('a'), P('b')], injuries: [{ playerId: 'b', startDate: '2026-10-01', status: 'active', rtpPhase: 1, history: [] }] });
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-14'), 'full');
    t.injuries = undefined; t.availability = undefined;
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-14'), 'full');
});

// ============================================================
console.log('\nPlanificación (weekplan-medical.js)');

const PLAN = {
    lun: day(), mar: day(slot('training', 'medium', 90)), mie: day(), jue: day(),
    vie: day(null, slot('training', 'medium', 60)), sab: day(), dom: day()
};
const OUT_ALL_WEEK = { playerId: 'p4', startDate: '2026-10-10', status: 'active', rtpPhase: 2, history: [] };
const weekStart = () => vm.runInContext('new Date(2026, 9, 12)', ctx);

test('sin lesionadas, con y sin weekStart dan lo mismo (la ruta antigua no cambia)', () => {
    const t = makeTracker(ctx, { players: [P('p1'), P('p2'), P('p3'), P('p4')], plan: PLAN });
    assert.strictEqual(t._plannedWeekLoad(t.weekPlan.weeks['2026-10-12'].days),
                       t._plannedWeekLoad(t.weekPlan.weeks['2026-10-12'].days, weekStart()));
    assert.strictEqual(t._plannedWeekSessions(t.weekPlan.weeks['2026-10-12'].days),
                       t._plannedWeekSessions(t.weekPlan.weeks['2026-10-12'].days, weekStart()));
    // (495 + 330) × 4 jugadoras
    assert.strictEqual(t._plannedWeekLoad(t.weekPlan.weeks['2026-10-12'].days), 3300);
});

test('una lesionada fuera toda la semana no cuenta en la carga ni en las sesiones planificadas', () => {
    const t = makeTracker(ctx, { players: [P('p1'), P('p2'), P('p3'), P('p4')], injuries: [OUT_ALL_WEEK], plan: PLAN });
    const days = t.weekPlan.weeks['2026-10-12'].days;
    assert.strictEqual(t._plannedWeekLoad(days, weekStart()), 2475);    // (495 + 330) × 3
    assert.strictEqual(t._plannedWeekSessions(days, weekStart()), 6);   // 2 turnos × 3
});

test('lesionada solo parte de la semana: cuenta los días en que sí participa', () => {
    const inj = { playerId: 'p4', startDate: '2026-10-14', status: 'active', rtpPhase: 1, history: [] };  // desde el miércoles
    const t = makeTracker(ctx, { players: [P('p1'), P('p2'), P('p3'), P('p4')], injuries: [inj], plan: PLAN });
    const days = t.weekPlan.weeks['2026-10-12'].days;
    // martes (antes de lesionarse): 4 jugadoras · viernes: 3
    assert.strictEqual(t._plannedWeekLoad(days, weekStart()), 495 * 4 + 330 * 3);
});

test('las sesiones reales de una jugadora fuera ese día no cuentan en la semana', () => {
    const sessions = [
        { playerId: 'p1', date: '2026-10-13T10:00:00', load: 495, rpe: 5.5 },
        { playerId: 'p4', date: '2026-10-13T10:00:00', load: 100, rpe: 3 }     // readaptación
    ];
    const t = makeTracker(ctx, { players: [P('p1'), P('p4')], injuries: [OUT_ALL_WEEK], sessions, plan: PLAN });
    const real = t._getWeekRealSessions(weekStart());
    assert.strictEqual(real.totalLoad, 495);
    assert.strictEqual(real.sessions, 1);
});

test('A:C proyectado: no se pintan badges de jugadoras fuera ese día', () => {
    const t = makeTracker(ctx, { players: [P('p1'), P('p4')], injuries: [OUT_ALL_WEEK], plan: PLAN });
    t._projectedACRatio = () => 1.0;
    t.getPlayerThresholds = () => ({ low: 0.8, opt: 1.3, high: 1.5 });
    const conFecha = t._renderProjectedACRow(495, '2026-10-13');
    const sinFecha = t._renderProjectedACRow(495);
    const n = html => (html.match(/pac-badge--green/g) || []).length;
    assert.strictEqual(n(conFecha), 1);
    assert.strictEqual(n(sinFecha), 2);   // sin fecha, comportamiento de siempre
});

// ============================================================
console.log('\nMedia del equipo (app-comparisons.js)');

test('la media del equipo no cuenta a la lesionada ni mete ceros por falta de datos', () => {
    const t = makeTracker(ctx, { players: [P('p1'), P('p2'), P('p3')], injuries: [{ playerId: 'p3', startDate: '2026-10-10', status: 'active', rtpPhase: 1, history: [] }] });
    const stats = {
        p1: { sessions: 10, sessions28: 8, avgRPE: 6, rpe7: 6, ratio: 1.0, totalLoad: 4000, load28: 3000, load7: 1000, avgLoad: 400, avgDuration: 70, trend: 5 },
        p2: { sessions: 10, sessions28: 8, avgRPE: 4, rpe7: 4, ratio: 0.8, totalLoad: 2000, load28: 1500, load7: 0,    avgLoad: 200, avgDuration: 50, trend: 0 },
        p3: { sessions: 0,  sessions28: 0, avgRPE: 0, rpe7: 0, ratio: 0,   totalLoad: 0,    load28: 0,    load7: 0,    avgLoad: 0,   avgDuration: 0,  trend: 0 }
    };
    t.getCompStats = id => stats[id];
    const team = t.getTeamAvgStats();
    assert.strictEqual(team.avgRPE, 5);          // (6+4)/2; antes (6+4+0)/3 = 3.33
    assert.strictEqual(team.ratio, 0.9);         // (1.0+0.8)/2
    assert.strictEqual(team.sessions, 10);
    assert.strictEqual(team.load7, 500);         // la sana con 0 de carga reciente sí es un 0 real
    assert.strictEqual(team.trend, 5);           // trend 0 = sin datos: se omite
});

test('sin lesionadas ni ceros el resultado es la media de siempre', () => {
    const t = makeTracker(ctx, { players: [P('p1'), P('p2')] });
    const s = { sessions: 6, sessions28: 5, avgRPE: 5, rpe7: 5, ratio: 1, totalLoad: 100, load28: 80, load7: 40, avgLoad: 20, avgDuration: 60, trend: 2 };
    t.getCompStats = () => s;
    const team = t.getTeamAvgStats();
    Object.keys(s).forEach(k => assert.strictEqual(team[k], s[k], k));
});

// ============================================================
console.log('\nMicrociclo — tabla Jugadora × Día (render real)');

function renderMicrociclo(opts) {
    const t = makeTracker(ctx, opts);
    const container = { innerHTML: '' };
    ctx.__container = container;
    vm.runInContext(`
        document.getElementById = id => id === 'microcicloContent' ? window.__container : null;
    `, ctx);
    t._mcEnsureSeasonHistory = () => {};
    t.renderMicrociclo.call(t);
    return container.innerHTML;
}
// Celdas (texto) de la fila de la tabla que contiene el texto indicado
const cellsOfRow = (html, marker) => {
    const row = html.split('<tr').find(r => r.includes(marker) && r.includes('<td class="mc-cell'));
    return row ? [...row.matchAll(/<td class="mc-cell[^>]*>([\s\S]*?)<\/td>/g)].map(x => x[1].replace(/<[^>]+>/g, '').trim()) : null;
};
const rowOf = (html, name) => cellsOfRow(html, `mc-player-name">${name}<`);
const teamRow = html => cellsOfRow(html, 'mc-team-total-row');

let html = null;
try {
    const sessions = ['p1', 'p2', 'p3'].map(id => ({ playerId: id, date: '2026-10-13T10:00:00', load: 495, rpe: 5.5, duration: 90 }))
        .concat([{ playerId: 'p4', date: '2026-10-13T10:00:00', load: 100, rpe: 3, duration: 30 }]);   // readaptación de la lesionada
    html = renderMicrociclo({ players: [P('p1'), P('p2'), P('p3'), P('p4')], injuries: [OUT_ALL_WEEK], sessions, plan: PLAN });
} catch (e) { console.log('  ⚠️  no se pudo renderizar Microciclo en el test:', e.message); }

test('la fila de la lesionada no muestra −100% ni nada: todo "–"', () => {
    assert.ok(html, 'sin HTML');
    assert.deepStrictEqual(rowOf(html, 'p4'), ['–', '–', '–', '–', '–', '–', '–', '–']);
});

test('el martes de las sanas da 0% (real 495 = plan 495), no el −100% de antes', () => {
    assert.deepStrictEqual(rowOf(html, 'p1').slice(0, 3), ['–', '0%', '–']);
});

test('fila Equipo: martes 0% (la readaptación no cuenta), viernes −100% (planificado y no hecho)', () => {
    const t = teamRow(html);
    assert.strictEqual(t[1], '0%');       // martes: 1485 real / 1485 plan (3 jugadoras)
    assert.strictEqual(t[4], '−100%');    // viernes: había plan y nadie entrenó
    assert.strictEqual(t[0], '–');        // lunes: sin plan ni sesión
    assert.strictEqual(t[7], '−40%');     // total: (1485 − 2475) / 2475
});

test('la leyenda explica la celda "fuera del grupo"', () => {
    assert.ok(html.includes('fuera del grupo (lesión)'));
});

// ============================================================
console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} pasados, ${failed} fallidos`);
if (failed > 0) process.exit(1);

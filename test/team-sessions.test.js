// test/team-sessions.test.js
// ============================================================
// Fase 3 — las sesiones de jugadoras fuera del grupo ese día (lesión en fases 1-4 o
// marcadas "no disponible") son readaptación / trabajo individual: se guardan y se ven
// en su ficha, pero NO entran en medias ni totales de EQUIPO.
//
//   isTeamSession(s) / getTeamSessions(lista)   (injury-management.js)
//   Calendario: RPE medio, nº de jugadoras y ratio del día (rejilla y agenda móvil),
//               detalle del día (medias sin ellas, fila marcada 🏥, aviso)
//   Inicio:     RPE medio 7d, última sesión, global y carga de equipo 7 días
//   Microciclo: comparador de semanas (mismas sesiones que la tabla Jugadora × Día)
//
// Ejecutar con:  node test/team-sessions.test.js
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

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// "Hoy" fijo: domingo 18/10/2026
function load(files, { dashboard = false } = {}) {
    const FIXED = new Date(2026, 9, 18, 12).getTime();
    const els = { container: { innerHTML: '', children: { length: 1 }, querySelector() { return null; }, querySelectorAll() { return []; }, classList: { add() {}, remove() {}, toggle() {} }, style: {}, addEventListener() {}, appendChild() {}, setAttribute() {} } };
    const created = [];
    const sandbox = {
        console, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
        setTimeout: () => 0, clearTimeout() {}, requestAnimationFrame: () => 0, navigator: {},
    };
    sandbox.window = sandbox;
    sandbox.matchMedia = () => ({ matches: false });
    sandbox.addEventListener = () => {};
    sandbox.document = {
        addEventListener() {}, querySelector: () => null, querySelectorAll: () => [],
        getElementById: id => (id === 'daySessionsModal' ? null : els.container),
        createElement() { const e = { style: {}, setAttribute() {}, appendChild() {}, remove() {}, addEventListener() {}, classList: { add() {}, remove() {} } }; created.push(e); return e; },
        head: { appendChild() {} }, body: { appendChild() {}, classList: { add() {}, remove() {} } },
        documentElement: { setAttribute() {}, getAttribute() { return null; } },
    };
    const ctx = vm.createContext(sandbox);
    vm.runInContext(`
        const RealDate = Date;
        class FixedDate extends RealDate {
            constructor(...a) { if (a.length === 0) super(${FIXED}); else super(...a); }
            static now() { return ${FIXED}; }
        }
        Date = FixedDate;
        class RPETracker { static get MATCH_LOAD_MULTIPLIER() { return 1.5; } }
        window.RPETracker = RPETracker;
        window.esc = s => String(s == null ? '' : s);
        window.PlayerTokens = { avatar: () => '', get: () => '#999', PALETTE: ['#111'] };
        window.trapFocus = () => () => {};
        window.AppAlert = { show() {} };
    `, ctx);
    files.forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
    return { ctx, els, created };
}

// Escenario (todo se crea DENTRO del contexto del vm):
//   p1, p2, p3 sanas · p4 lesionada desde el 10/10 en fase 2 (fuera del grupo)
//   mar 13/10 mañana: p1-p3 RPE 6 (90 min) + p4 RPE 2 (30 min, readaptación)
//   mié 14/10:        SOLO p4 (readaptación)
//   jue 15/10:        mañana p1-p3 RPE 6 · tarde p1-p3 RPE 4 · mañana p4 RPE 2
function buildTracker(ctx, { injured = true, history = false } = {}) {
    ctx.__injured = injured; ctx.__history = history;
    return vm.runInContext(`
        (() => {
            const t = new RPETracker();
            t.players = ['p1', 'p2', 'p3', 'p4'].map(id => ({ id, name: 'Jug ' + id, number: id.slice(1) }));
            t.injuries = window.__injured ? [{ id: 'i1', playerId: 'p4', status: 'active', startDate: '2026-10-10', rtpPhase: 2, history: [] }] : [];
            t.availability = {}; t.weekPlan = { weekOffset: 0, weeks: {} };
            t.wellnessData = []; t._playerRpeRaw = []; t.matches = [];
            let n = 0;
            const add = (pid, date, tod, rpe, dur) => t.sessions.push({ id: 's' + (n++), playerId: pid, date, timeOfDay: tod, type: 'training', rpe, duration: dur, load: rpe * dur, season: '2026-27' });
            t.sessions = [];
            ['p1', 'p2', 'p3'].forEach(p => add(p, '2026-10-13', 'morning', 6, 90));
            add('p4', '2026-10-13', 'morning', 2, 30);
            add('p4', '2026-10-14', 'morning', 2, 30);
            ['p1', 'p2', 'p3'].forEach(p => { add(p, '2026-10-15', 'morning', 6, 90); add(p, '2026-10-15', 'afternoon', 4, 60); });
            add('p4', '2026-10-15', 'morning', 2, 30);
            // Historial previo (L-V desde el 21/09) para que exista ratio A:C: hacen falta >= 7 sesiones en 28 días
            if (window.__history) {
                for (let d = new Date(2026, 8, 21); d <= new Date(2026, 9, 9); d.setDate(d.getDate() + 1)) {
                    if (d.getDay() === 0 || d.getDay() === 6) continue;
                    const iso = window.toLocalISODate(d);
                    ['p1', 'p2', 'p3', 'p4'].forEach(p => add(p, iso, 'morning', 6, 75));
                }
            }
            t.getRPEColor = () => '#000';
            return t;
        })()
    `, ctx);
}

const FILES = ['store.js', 'security.js', 'ewma-calculator.js', 'app-analytics.js', 'app-sessions.js',
    'calendar.js', 'injury-management.js', 'weekplan-medical.js', 'microciclo.js'];
const { ctx, els, created } = load(FILES);
// Celda de un día de la rejilla (corta por <div class="calendar-day ..."> y no por calendar-day-number)
const dayCell = (html, day) => (html.split(/<div class="calendar-day(?= |")/).find(c => new RegExp(`calendar-day-number">${day}</div>`).test(c)) || '');

// ============================================================
console.log('\nisTeamSession / getTeamSessions');

test('sin lesiones ni marcas devuelve la misma lista (nada cambia)', () => {
    const t = buildTracker(ctx, { injured: false });
    assert.strictEqual(t.getTeamSessions(t.sessions), t.sessions);
});

test('quita solo las sesiones de la jugadora fuera ese día', () => {
    const t = buildTracker(ctx);
    const team = t.getTeamSessions(t.sessions);
    assert.strictEqual(t.sessions.length, 12);
    assert.strictEqual(team.length, 9);                                    // 3 sesiones de p4 fuera
    assert.ok(team.every(s => s.playerId !== 'p4'));
});

test('el día ANTES de lesionarse, la misma jugadora sí cuenta (se mira la fecha de la sesión)', () => {
    const t = buildTracker(ctx);
    const antes = { playerId: 'p4', date: '2026-10-09', rpe: 6, duration: 60, load: 360 };
    assert.strictEqual(t.isTeamSession(antes), true);
    assert.strictEqual(t.isTeamSession({ playerId: 'p4', date: '2026-10-10', rpe: 2, duration: 30 }), false);
});

test('en fase 5 (entrena con el grupo) sus sesiones SÍ cuentan', () => {
    const t = buildTracker(ctx);
    t.injuries[0].rtpPhase = 5;
    assert.strictEqual(t.getTeamSessions(t.sessions).length, 12);
});

test('marcada "no disponible" ese día: su sesión no cuenta; "limitada": sí', () => {
    const t = buildTracker(ctx, { injured: false });
    t.availability = { p1: { '2026-10-13': 'unavailable' }, p2: { '2026-10-13': 'limited' } };
    const team = t.getTeamSessions(t.sessions);
    assert.ok(!team.some(s => s.playerId === 'p1' && s.date === '2026-10-13'));
    assert.ok(team.some(s => s.playerId === 'p2' && s.date === '2026-10-13'));
    assert.ok(team.some(s => s.playerId === 'p1' && s.date === '2026-10-15'));
});

test('no modifica la lista original y tolera datos incompletos', () => {
    const t = buildTracker(ctx);
    const before = t.sessions.length;
    t.getTeamSessions(t.sessions);
    assert.strictEqual(t.sessions.length, before);
    assert.strictEqual(t.isTeamSession(null), true);
    assert.strictEqual(t.isTeamSession({ rpe: 5 }), true);
    assert.strictEqual(t.getTeamSessions([]).length, 0);
});

// ============================================================
console.log('\nCalendario — rejilla de escritorio');

function renderGrid(t, mobile) {
    ctx.matchMedia = () => ({ matches: !!mobile });
    els.container.innerHTML = '';
    t.renderCalendar(2026, 9);
    return els.container.innerHTML;
}

test('el martes: RPE y nº de jugadoras SOLO de equipo (antes 4 jugadoras y RPE 5.0)', () => {
    const t = buildTracker(ctx);
    const cell = dayCell(renderGrid(t), 13);
    assert.ok(cell.includes('🏀 3'), cell);
    assert.ok(cell.includes('RPE 6.0'), cell);
    assert.ok(cell.includes('cal-individual') && cell.includes('🏥 1'));
});

test('con la misma sesión pero sin lesión, la fila de la lesionada sí cuenta (comparación)', () => {
    const t = buildTracker(ctx, { injured: false });
    const cell = dayCell(renderGrid(t), 13);
    assert.ok(cell.includes('🏀 4') && cell.includes('RPE 5.0'));
    assert.ok(!cell.includes('cal-individual'));
});

test('día con SOLO una sesión individual: sin RPE ni etiquetas de equipo, pero con la marca 🏥', () => {
    const t = buildTracker(ctx);
    const cell = dayCell(renderGrid(t), 14);
    assert.ok(!cell.includes('has-sessions'));
    assert.ok(!cell.includes('RPE '));
    assert.ok(!cell.includes('ratio-badge'));
    assert.ok(cell.includes('🏥 1'));
    assert.ok(cell.includes('showDaySessions(2026,9,14)'), 'el día sigue siendo pulsable');
});

test('dos turnos el jueves: cada uno con su RPE de equipo (6.0 y 4.0)', () => {
    const t = buildTracker(ctx);
    const cell = dayCell(renderGrid(t), 15);
    assert.ok(cell.includes('Mañana · RPE 6.0'), cell);
    assert.ok(cell.includes('Tarde · RPE 4.0'), cell);
});

test('el ratio A:C del día no incluye a la lesionada (mismo valor que sin ella)', () => {
    const conLesionada = buildTracker(ctx, { history: true });
    const badge = html => (/ratio-badge[^>]*>([\d.]+)</.exec(dayCell(html, 15)) || [])[1];
    const b1 = badge(renderGrid(conLesionada));
    // misma plantilla pero sin las sesiones de p4: debe dar el mismo ratio
    const sinSesiones = buildTracker(ctx, { history: true });
    // (solo se quitan sus sesiones de DESPUÉS de lesionarse; el historial previo es de equipo)
    sinSesiones.sessions = sinSesiones.sessions.filter(s => !(s.playerId === 'p4' && s.date >= '2026-10-10'));
    const b2 = badge(renderGrid(sinSesiones));
    assert.ok(b1, 'sin badge de ratio');
    assert.strictEqual(b1, b2);
});

// ============================================================
console.log('\nCalendario — agenda móvil');

test('agenda móvil: mismos datos de equipo y la marca individual', () => {
    const t = buildTracker(ctx);
    const html = renderGrid(t, true);
    const row = n => html.split('<div class="cal-agenda-row').find(r => new RegExp(`cal-agenda-daynum">${n}</span>`).test(r)) || '';
    assert.ok(row(13).includes('RPE 6.0') && row(13).includes('🏥 1'));
    assert.ok(!row(14).includes('cal-agenda-empty'), 'un día con sesión individual no es "—"');
    assert.ok(row(14).includes('🏥 1'));
    assert.ok(row(16).includes('cal-agenda-empty'), 'un día sin nada sigue siendo "—"');
});

// ============================================================
console.log('\nCalendario — detalle del día');

function openDay(t, day) {
    created.length = 0;
    t.showDaySessions(2026, 9, day);
    return created.map(c => c.innerHTML || '').join('');
}

test('detalle del martes: media del turno sin la lesionada; su fila sigue, marcada 🏥 y atenuada', () => {
    const t = buildTracker(ctx);
    const html = openDay(t, 13);
    assert.ok(html.includes('RPE medio <strong>6.0</strong>'), html);
    const rowP4 = html.split('<tr onclick').find(r => r.includes('Jug p4')) || '';
    assert.ok(rowP4.includes('🏥') && rowP4.includes('opacity:0.6'));
    const rowP1 = html.split('<tr onclick').find(r => r.includes('Jug p1')) || '';
    assert.ok(!rowP1.includes('🏥') && !rowP1.includes('opacity:0.6'));
    assert.ok(html.includes('no cuenta en las medias del equipo'));
});

test('detalle de un día solo con sesión individual: lista a la jugadora y la media queda en "—"', () => {
    const t = buildTracker(ctx);
    const html = openDay(t, 14);
    assert.ok(html.includes('Jug p4'));
    assert.ok(html.includes('RPE medio <strong>—</strong>'));
    assert.ok(!html.includes('NaN'));
});

test('media global del día (2 turnos) solo con trabajo de equipo: (3×6 + 3×4) / 6 = 5.0', () => {
    const t = buildTracker(ctx);
    const html = openDay(t, 15);
    assert.ok(/Media del día[\s\S]*?RPE <strong>5\.0<\/strong>/.test(html), html);
});

test('sin lesionadas el detalle del día no cambia: sin marcas ni aviso', () => {
    const t = buildTracker(ctx, { injured: false });
    const html = openDay(t, 13);
    assert.ok(!html.includes('🏥'));
    assert.ok(html.includes('RPE medio <strong>5.0</strong>'));
});

test('la tarjeta de ayuda explica la marca 🏥', () => {
    const t = buildTracker(ctx);
    assert.ok(renderGrid(t).includes('sesiones individuales de jugadoras lesionadas'));
});

// ============================================================
console.log('\nMicrociclo — comparador de semanas');

test('el comparador usa solo trabajo de equipo (misma base que la tabla Jugadora × Día)', () => {
    const t = buildTracker(ctx);
    const weeks = t._mcSessionsByWeek();
    assert.strictEqual(weeks.get('2026-10-12').length, 9);        // 3 (mar) + 6 (jue); sin las 3 de p4
    const sin = buildTracker(ctx, { injured: false });
    assert.strictEqual(sin._mcSessionsByWeek().get('2026-10-12').length, 12);
});

// ============================================================
console.log('\nInicio — KPIs de equipo (renderDashboard real)');

function dashboardKpis(injured) {
    const { ctx: c, els: e } = load(['store.js', 'security.js', 'ewma-calculator.js', 'wellness.js', 'app-sessions.js',
        'app-comparisons.js', 'weekplan-medical.js', 'injury-management.js', 'dashboard-comparison.js', 'dashboard-renderer.js']);
    const t = buildTracker(c, { injured });
    // Los métodos que no son de este test se sustituyen por huecos para poder pintar la pantalla
    const DATA = { _playerRpeRaw: [], _wellnessPlayerCache: {}, _dashSort: 'risk', _matchDayMode: false };
    c.__t = t; c.__DATA = DATA;
    vm.runInContext(`
        (() => {
            const DATA = window.__DATA, base = window.__t;
            window.__p = new Proxy(base, {
                get: (o, k) => (k in o) ? o[k] : (k in DATA ? DATA[k] : (typeof k === 'string' ? (() => '') : undefined)),
                set: (o, k, v) => { o[k] = v; return true; }
            });
        })()
    `, c);
    vm.runInContext('__p.renderDashboard()', c);
    const html = e.container.innerHTML;
    const kpi = lbl => (new RegExp(`db-kpi-val">([^<]*)</span>\\s*<span class="db-kpi-lbl">${lbl}`).exec(html) || [])[1];
    return { kpi7: kpi('RPE medio 7d'), html };
}

test('RPE medio 7d de Inicio: solo trabajo de equipo (5.3) en vez de arrastrar la readaptación (4.5)', () => {
    const con = dashboardKpis(true);
    const sin = dashboardKpis(false);
    assert.strictEqual(con.kpi7, '5.3', `con lesionada: ${con.kpi7}`);   // (3×6 + 3×6 + 3×4) / 9
    assert.strictEqual(sin.kpi7, '4.5', `sin marcar lesión: ${sin.kpi7}`); // (…+ 3×2) / 12
});

// ============================================================
console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} pasados, ${failed} fallidos`);
if (failed > 0) process.exit(1);

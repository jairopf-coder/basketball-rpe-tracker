// test/absent.test.js
// ============================================================
// Estado "Ausente": la jugadora no entrena ese día sin estar lesionada
// (selección, acto del club, examen, día libre…).
//
//   - Se guarda en `availability` como 'absent' o 'absent:<motivo>'.
//   - Para la carga y el RPE cuenta como "fuera" (igual que "no disponible").
//   - El WELLNESS NO cambia: las ausentes siguen contando (pueden estar con la selección).
//   - Se marca desde el Paso 1 de Nueva sesión, con motivo y fecha de vuelta ("Hasta").
//   - Si entrena un día marcado como ausente, se quita la marca de ESE día.
//   - La regla de la app y la del script de avisos push (isOutOn) dan siempre lo mismo.
//
// Ejecutar con:  node test/absent.test.js
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

// Los tests que esperan una promesa se ponen en cola y se ejecutan al final (en orden)
const asyncQueue = [];
function atest(name, fn) { asyncQueue.push({ name, fn }); }

const ROOT = path.join(__dirname, '..');
const R = require(path.join(ROOT, 'scripts', 'lib', 'reminders.js'));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// "Hoy" = lunes 12/10/2026 y un DOM mínimo para el modal de Nueva sesión
function load() {
    const FIXED = new Date(2026, 9, 12, 12).getTime();
    const els = {
        playerButtons: { innerHTML: '' },
        sessionDate: { value: '2026-10-14' },
        selectedCount: { textContent: '', classList: { toggle() {}, add() {}, remove() {} } },
        selectAllBtn: { textContent: '', classList: { toggle() {}, add() {}, remove() {} } },
    };
    const sandbox = { console, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
    sandbox.window = sandbox;
    sandbox.document = {
        addEventListener() {}, getElementById: id => els[id] || null, querySelector: () => null,
        querySelectorAll: () => [], createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
        head: { appendChild() {} }, body: { appendChild() {} }
    };
    const ctx = vm.createContext(sandbox);
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
        window.trapFocus = () => () => {};
    `, ctx);
    vm.runInContext(require('./active-players-helper')(), ctx);
    ['store.js', 'injury-management.js', 'injury-management-2.js', 'app-sessions.js']
        .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
    return { ctx, els };
}

const { ctx, els } = load();

// Crea el tracker con datos construidos DENTRO del contexto (cada vm tiene sus propias clases)
function make({ players, injuries = [], availability = {}, sessions = [], date = '2026-10-14' }) {
    ctx.__in = { players, injuries, availability, sessions };
    els.sessionDate.value = date;
    els.playerButtons.innerHTML = '';
    return vm.runInContext(`
        (() => {
            const t = new RPETracker();
            const i = JSON.parse(JSON.stringify(window.__in));
            t.players = i.players; t.injuries = i.injuries; t.availability = i.availability; t.sessions = i.sessions;
            t.selectedPlayerIds = [];
            t.toasts = [];
            t.saves = 0;
            t.showToast = (m, ty) => t.toasts.push([m, ty]);
            t.saveAvailability = () => { t.saves++; };
            return t;
        })()
    `, ctx);
}
const P = id => ({ id, name: `Jug ${id}` });
const inj = (playerId, extra) => Object.assign({ playerId, status: 'active', startDate: '2026-10-01', rtpPhase: 2, history: [] }, extra || {});
const btnOf = (html, id) => (html.split('<button').find(b => b.includes(`data-player-id="${id}"`)) || '');
const plain = o => JSON.parse(JSON.stringify(o));
const isAbsentMark = vm.runInContext('isAbsentMark', ctx);

// ============================================================
console.log('\nMarca de ausente');

test('"absent" y "absent:<motivo>" son ausencia; el resto no', () => {
    assert.strictEqual(isAbsentMark('absent'), true);
    assert.strictEqual(isAbsentMark('absent:seleccion'), true);
    assert.strictEqual(isAbsentMark('absent:'), true);
    ['unavailable', 'limited', 'absentee', 'Absent', '', null, undefined, 5, {}].forEach(m =>
        assert.strictEqual(isAbsentMark(m), false, String(m)));
});

test('getAbsenceOn: motivo conocido, motivo desconocido, sin motivo y sin marca', () => {
    const t = make({ players: [P('a')], availability: { a: { '2026-10-14': 'absent:seleccion', '2026-10-15': 'absent', '2026-10-16': 'absent:marte' } } });
    assert.deepStrictEqual(plain(t.getAbsenceOn('a', '2026-10-14')), { reason: 'seleccion', label: 'Selección' });
    assert.deepStrictEqual(plain(t.getAbsenceOn('a', '2026-10-15')), { reason: null, label: 'Ausente' });
    assert.strictEqual(t.getAbsenceOn('a', '2026-10-16').label, 'Ausente');
    assert.strictEqual(t.getAbsenceOn('a', '2026-10-17'), null);
    assert.strictEqual(t.getAbsenceOn('b', '2026-10-14'), null);
});

// ============================================================
console.log('\nParticipación: ausente cuenta como "fuera"');

test('ausente → out ese día; el día anterior y el siguiente, full', () => {
    const t = make({ players: [P('a')], availability: { a: { '2026-10-14': 'absent:club' } } });
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-13'), 'full');
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-14'), 'out');
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-15'), 'full');
});

test('ausente + lesión en fase 5 (parcial) → out; "limitada" sigue siendo partial', () => {
    const t = make({ players: [P('a'), P('b')], injuries: [inj('a', { rtpPhase: 5 })],
        availability: { a: { '2026-10-14': 'absent' }, b: { '2026-10-14': 'limited' } } });
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-14'), 'out');
    assert.strictEqual(t.getPlayerParticipation('b', '2026-10-14'), 'partial');
});

test('la sesión de una ausente no cuenta como trabajo de equipo (se conserva en su ficha)', () => {
    const sessions = [{ id: 's1', playerId: 'a', date: '2026-10-14T10:00:00' }, { id: 's2', playerId: 'b', date: '2026-10-14T10:00:00' }];
    const t = make({ players: [P('a'), P('b')], sessions, availability: { a: { '2026-10-14': 'absent:estudios' } } });
    assert.deepStrictEqual(Array.from(t.getTeamSessions(t.sessions), s => s.id), ['s2']);
    assert.deepStrictEqual(Array.from(t.getParticipatingPlayers('2026-10-14'), p => p.id), ['b']);
});

test('una jugadora de baja en el equipo sigue siendo out aunque no tenga marca (nada cambia)', () => {
    const t = make({ players: [{ id: 'a', name: 'a', archived: true, archivedAt: '2026-10-01' }] });
    assert.strictEqual(t.getPlayerParticipation('a', '2026-10-14'), 'out');
});

// ============================================================
console.log('\nsetAbsence (marcar un rango)');

test('un día: solo marca ese día, con el motivo', () => {
    const t = make({ players: [P('a')] });
    const r = t.setAbsence('a', '2026-10-14', '2026-10-14', 'estudios');
    assert.deepStrictEqual(plain(r), { ok: true, marked: 1, skipped: 0 });
    assert.deepStrictEqual(plain(t.availability), { a: { '2026-10-14': 'absent:estudios' } });
    assert.strictEqual(t.saves, 1);
});

test('rango que cruza de mes: marca todos los días incluidos los dos extremos', () => {
    const t = make({ players: [P('a')] });
    const r = t.setAbsence('a', '2026-10-30', '2026-11-02', 'seleccion');
    assert.strictEqual(r.marked, 4);
    assert.deepStrictEqual(Object.keys(t.availability.a), ['2026-10-30', '2026-10-31', '2026-11-01', '2026-11-02']);
});

test('motivo desconocido o vacío → "absent" a secas', () => {
    const t = make({ players: [P('a')] });
    t.setAbsence('a', '2026-10-14', '2026-10-14', 'marte');
    t.setAbsence('a', '2026-10-15', '2026-10-15', '');
    assert.deepStrictEqual(plain(t.availability.a), { '2026-10-14': 'absent', '2026-10-15': 'absent' });
});

test('los días en que ya tiene una sesión no se marcan (ese día sí hay datos)', () => {
    const t = make({ players: [P('a')], sessions: [{ id: 's1', playerId: 'a', date: '2026-10-15T18:00:00' }] });
    const r = t.setAbsence('a', '2026-10-14', '2026-10-16', 'club');
    assert.deepStrictEqual(plain(r), { ok: true, marked: 2, skipped: 1 });
    assert.deepStrictEqual(Object.keys(t.availability.a), ['2026-10-14', '2026-10-16']);
});

test('si todos los días tienen sesión no se marca ni se guarda nada', () => {
    const t = make({ players: [P('a')], sessions: [{ id: 's1', playerId: 'a', date: '2026-10-14T18:00:00' }] });
    const r = t.setAbsence('a', '2026-10-14', '2026-10-14', 'club');
    assert.deepStrictEqual(plain(r), { ok: true, marked: 0, skipped: 1 });
    assert.strictEqual(t.saves, 0);
});

test('sustituye una marca anterior (limitada / no disponible) y no toca a otras jugadoras ni otros días', () => {
    const t = make({ players: [P('a'), P('b')], availability: { a: { '2026-10-14': 'limited', '2026-10-20': 'unavailable' }, b: { '2026-10-14': 'unavailable' } } });
    t.setAbsence('a', '2026-10-14', '2026-10-14', 'libre');
    assert.deepStrictEqual(plain(t.availability), { a: { '2026-10-14': 'absent:libre', '2026-10-20': 'unavailable' }, b: { '2026-10-14': 'unavailable' } });
});

test('entradas no válidas: error claro y NO se escribe nada', () => {
    const t = make({ players: [P('a')] });
    const bad = [
        ['a', '2026-10-15', '2026-10-14', 'club'],     // vuelta antes de la ida
        ['a', '2026-02-31', '2026-03-02', 'club'],     // fecha imposible
        ['a', 'abc', '2026-10-14', 'club'],
        ['a', '2026-10-14', '', 'club'],
        ['a', '2026-10-14', undefined, 'club'],
        ['zzz', '2026-10-14', '2026-10-14', 'club'],   // jugadora que no existe
        ['a', '2026-10-14', '2027-01-20', 'club'],     // 99 días: pasa del tope de 90
    ];
    bad.forEach(args => {
        const r = t.setAbsence(...args);
        assert.strictEqual(r.ok, false, args.join(' | '));
        assert.ok(r.error && r.error.length > 5);
    });
    assert.deepStrictEqual(plain(t.availability), {});
    assert.strictEqual(t.saves, 0);
});

test('justo 90 días sí; 91 no', () => {
    const t = make({ players: [P('a')] });
    assert.strictEqual(t.setAbsence('a', '2026-10-01', '2026-12-29', 'otro').marked, 90);
    const t2 = make({ players: [P('a')] });
    assert.strictEqual(t2.setAbsence('a', '2026-10-01', '2026-12-30', 'otro').ok, false);
});

// ============================================================
console.log('\nQuitar la ausencia');

test('clearAbsenceFrom: quita ese día y los seguidos; se para en el primer hueco', () => {
    const t = make({ players: [P('a')], availability: { a: {
        '2026-10-13': 'absent:club', '2026-10-14': 'absent:club', '2026-10-15': 'absent', '2026-10-17': 'absent' } } });
    assert.strictEqual(t.clearAbsenceFrom('a', '2026-10-14'), 2);
    assert.deepStrictEqual(Object.keys(t.availability.a), ['2026-10-13', '2026-10-17']);
    assert.strictEqual(t.saves, 1);
});

test('clearAbsenceFrom: no toca marcas que no son ausencia y devuelve 0 sin guardar', () => {
    const t = make({ players: [P('a')], availability: { a: { '2026-10-14': 'unavailable' } } });
    assert.strictEqual(t.clearAbsenceFrom('a', '2026-10-14'), 0);
    assert.strictEqual(t.clearAbsenceFrom('b', '2026-10-14'), 0);
    assert.strictEqual(t.clearAbsenceFrom('a', 'basura'), 0);
    assert.deepStrictEqual(plain(t.availability), { a: { '2026-10-14': 'unavailable' } });
    assert.strictEqual(t.saves, 0);
});

test('clearAbsenceOn (al guardar una sesión): solo ese día, solo las que han entrenado', () => {
    const t = make({ players: [P('a'), P('b'), P('c')], availability: {
        a: { '2026-10-14': 'absent:seleccion', '2026-10-15': 'absent:seleccion' },
        b: { '2026-10-14': 'absent:club' },
        c: { '2026-10-14': 'unavailable' } } });
    assert.strictEqual(t.clearAbsenceOn(['a', 'c', 'zzz'], '2026-10-14T10:00:00'), 1);
    assert.deepStrictEqual(plain(t.availability), {
        a: { '2026-10-15': 'absent:seleccion' },            // la ausencia futura ya anunciada se mantiene
        b: { '2026-10-14': 'absent:club' },                 // no ha entrenado
        c: { '2026-10-14': 'unavailable' } });              // no era una ausencia
    assert.strictEqual(t.saves, 1);
});

test('clearAbsenceOn sin nada que quitar no guarda', () => {
    const t = make({ players: [P('a')] });
    assert.strictEqual(t.clearAbsenceOn(['a'], '2026-10-14'), 0);
    assert.strictEqual(t.clearAbsenceOn(null, '2026-10-14'), 0);
    assert.strictEqual(t.saves, 0);
});

// ============================================================
console.log('\nNueva sesión (Paso 1)');

test('chip de ausente: 🚫, clase "fuera" y control ✏️; chip normal: control 🚫 "Marcar ausente"', () => {
    const t = make({ players: [P('a'), P('b')], availability: { a: { '2026-10-14': 'absent:seleccion' } } });
    t.renderPlayerButtonsMulti();
    const html = els.playerButtons.innerHTML;
    const a = btnOf(html, 'a'), b = btnOf(html, 'b');
    assert.ok(a.includes('player-btn--out') && a.includes('Ausente: Selección') && a.includes('✏️'));
    assert.ok(!a.includes('🏥'));
    assert.ok(a.includes('data-absent-player="a"'));
    assert.ok(b.includes('data-absent-player="b"') && b.includes('Marcar ausente') && !b.includes('player-btn--out'));
    assert.ok(!b.includes('player-btn-flag'));
});

test('la ausencia depende de la fecha de la sesión (al cambiarla se vuelve a evaluar)', () => {
    const t = make({ players: [P('a')], availability: { a: { '2026-10-14': 'absent' } }, date: '2026-10-15' });
    t.renderPlayerButtonsMulti();
    assert.ok(!btnOf(els.playerButtons.innerHTML, 'a').includes('player-btn--out'));
    els.sessionDate.value = '2026-10-14';
    t.renderPlayerButtonsMulti();
    assert.ok(btnOf(els.playerButtons.innerHTML, 'a').includes('player-btn--out'));
});

test('lesionada sigue con 🏥 (no se confunde con ausente)', () => {
    const t = make({ players: [P('a')], injuries: [inj('a')] });
    t.renderPlayerButtonsMulti();
    const a = btnOf(els.playerButtons.innerHTML, 'a');
    assert.ok(a.includes('🏥') && !a.includes('Ausente:'));
});

test('"Seleccionar todas" salta a las ausentes y el aviso las menciona', () => {
    const t = make({ players: [P('a'), P('b'), P('c')], availability: { a: { '2026-10-14': 'absent:club' } } });
    t.selectAllPlayers();
    assert.deepStrictEqual(Array.from(t.selectedPlayerIds), ['b', 'c']);
    assert.ok(t.toasts[0][0].includes('1 jugadora no se ha seleccionado') && t.toasts[0][0].includes('ausente'));
});

test('añadir a mano a una ausente avisa (no bloquea) y dice que se quitará su ausencia ese día', () => {
    const t = make({ players: [P('a')], availability: { a: { '2026-10-14': 'absent:seleccion' } } });
    t.togglePlayerSelection('a');
    assert.deepStrictEqual(Array.from(t.selectedPlayerIds), ['a']);
    assert.ok(t.toasts[0][0].includes('ausente (Selección)') && t.toasts[0][0].includes('se quitará'));
    assert.strictEqual(t.toasts[0][1], 'warning');
});

// ============================================================
console.log('\nTabla de Disponibilidad');

test('el ciclo es libre → limitada → no disponible → ausente → libre', () => {
    const t = make({ players: [P('a')] });
    t.renderInjuryHub = () => {};
    const seen = [];
    for (let i = 0; i < 4; i++) { t.toggleAvailability('a', '2026-10-14'); seen.push(t.availability.a['2026-10-14']); }
    assert.deepStrictEqual(seen, ['limited', 'unavailable', 'absent', undefined]);
});

test('desde la tabla también se quita una ausencia con motivo (absent:club → libre)', () => {
    const t = make({ players: [P('a')], availability: { a: { '2026-10-14': 'absent:club' } } });
    t.renderInjuryHub = () => {};
    t.toggleAvailability('a', '2026-10-14');
    assert.strictEqual(t.availability.a['2026-10-14'], undefined);
});

test('la fila muestra 🚫 con el motivo', () => {
    const t = make({ players: [P('a')], availability: { a: { '2026-10-14': 'absent:estudios' } } });
    const row = t.renderAvailabilityRow(t.players[0], [new Date(2026, 9, 14), new Date(2026, 9, 15)]);
    assert.ok(row.includes('🚫') && row.includes('Ausente · Estudios'));
    assert.strictEqual((row.match(/🚫/g) || []).length, 1);   // el día 15 sigue disponible
});

// ============================================================
console.log('\nEl wellness NO cambia');

test('wellness.js no usa la participación ni la ausencia: cuentan todas', () => {
    const src = read('wellness.js');
    ['getPlayerParticipation', 'getAbsenceOn', 'isAbsentMark', 'getParticipatingPlayers'].forEach(n =>
        assert.ok(!src.includes(n), `wellness.js no debe usar ${n}`));
});

test('"Faltan hoy → Wellness" (Inicio) no excluye a nadie por ausencia', () => {
    const src = read('dashboard-renderer.js');
    const fn = src.slice(src.indexOf('RPETracker.prototype._pendingToday'), src.indexOf('RPETracker.prototype._pendingNoticeText'));
    const wellnessLine = fn.split('\n').find(l => l.includes('const wellness ='));
    assert.ok(wellnessLine && !/Participation|Absence|isAbsent/.test(wellnessLine), wellnessLine);
});

// ============================================================
console.log('\nAvisos push (scripts/lib/reminders.js)');

const turno = Object.keys(R.TURNOS)[0];
const fakeDb = data => ({ get: async p => (data[p] === undefined ? null : data[p]), sessionsOnDate: async () => data.__sessions || [] });
const D = '2026-10-14';
const players = [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }];

test('isOutOn: ausente (con o sin motivo) está fuera; la regla de la app y la del script coinciden', () => {
    const marks = [undefined, 'limited', 'unavailable', 'absent', 'absent:seleccion', 'absent:'];
    const injuries = [[], [inj('a', { rtpPhase: 2 })], [inj('a', { rtpPhase: 5 })], [inj('a', { rtpPhase: 6 })]];
    injuries.forEach(list => marks.forEach(m => {
        const availability = m ? { a: { [D]: m } } : {};
        const t = make({ players: [P('a')], injuries: list, availability });
        const app = t.getPlayerParticipation('a', D) === 'out';
        const script = R.isOutOn(JSON.parse(JSON.stringify(list)), availability, 'a', D);
        assert.strictEqual(script, app, `marca=${m} lesiones=${list.length ? list[0].rtpPhase : '-'}`);
    }));
});

atest('RPE: a una ausente no se le avisa (queda como excluida)', async () => {
    const db = fakeDb({ injuries: null, availability: { a: { [D]: 'absent:seleccion' } }, __sessions: [] });
    const r = await R.findPending({ db, players, tipo: 'rpe', turno, date: D });
    assert.deepStrictEqual(r.pending.map(p => p.id), ['b']);
    assert.strictEqual(r.excluded, 1);
});

atest('wellness: a una ausente SÍ se le avisa (cuenta como pendiente igual que a las demás)', async () => {
    const db = fakeDb({ wellness: null, availability: { a: { [D]: 'absent:seleccion' } } });
    const r = await R.findPending({ db, players, tipo: 'wellness', turno, date: D });
    assert.deepStrictEqual(r.pending.map(p => p.id), ['a', 'b']);
    assert.strictEqual(r.excluded, 0);
});

// ============================================================
(async () => {
    for (const { name, fn } of asyncQueue) {
        try { await fn(); console.log(`  ✅ ${name}`); passed++; }
        catch (err) { console.log(`  ❌ ${name}`); console.log(`     ${err.message}`); failed++; }
    }
    console.log(`\n${passed} pasados, ${failed} fallados`);
    process.exit(failed ? 1 : 0);
})();

// test/session-participation.test.js
// ============================================================
// Fase 2 — entrada de datos: lesionadas y no disponibles en "Nueva sesión".
//
//   - Las chips llevan 🏥 (fuera) o 🩹 (con limitaciones) según la fecha de la sesión.
//   - "Seleccionar todas" salta a las que están fuera (el RPE es obligatorio para cada
//     seleccionada: habría que inventárselo) y avisa de cuántas ha saltado.
//   - Añadir a mano a una que está fuera es posible, pero avisa (no bloquea).
//   - Al cambiar la fecha de la sesión se vuelve a evaluar quién está fuera.
//   - La regla de la app (getPlayerParticipation) y la del script de avisos push
//     (scripts/lib/reminders.js → isOutOn) dan SIEMPRE el mismo resultado.
//
// Ejecutar con:  node test/session-participation.test.js
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
const R = require(path.join(ROOT, 'scripts', 'lib', 'reminders.js'));

// Contexto con "hoy" = lunes 12/10/2026 y un DOM mínimo para el modal de Nueva sesión
function load() {
    const FIXED = new Date(2026, 9, 12, 12).getTime();
    const els = {
        playerButtons: { innerHTML: '' },
        sessionDate: { value: '2026-10-14' },
        selectedCount: { textContent: '', classList: { toggle() {}, add() {}, remove() {} } },
        selectAllBtn: { textContent: '', classList: { toggle() {}, add() {}, remove() {} } },
        newSessionModal: { classList: { add() {}, remove() {} } },
        sessionDuration: { value: '' },
    };
    const sandbox = { console, localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} } };
    sandbox.window = sandbox;
    sandbox.document = {
        addEventListener() {}, getElementById: id => els[id] || null, querySelector: () => null,
        querySelectorAll: () => [], createElement() { return { style: {}, setAttribute() {}, appendChild() {} }; },
        head: { appendChild() {} }, body: { appendChild() {} }
    };
    const ctx = vm.createContext(sandbox);
    const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
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
    ['store.js', 'injury-management.js', 'app-sessions.js'].forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
    return { ctx, els };
}

const { ctx, els } = load();

// Crea el tracker con datos construidos DENTRO del contexto (cada vm tiene sus propias clases)
function make({ players, injuries = [], availability = {}, date = '2026-10-14' }) {
    ctx.__in = { players, injuries, availability };
    els.sessionDate.value = date;
    els.playerButtons.innerHTML = '';
    const t = vm.runInContext(`
        (() => {
            const t = new RPETracker();
            const i = JSON.parse(JSON.stringify(window.__in));
            t.players = i.players; t.injuries = i.injuries; t.availability = i.availability;
            t.selectedPlayerIds = [];
            t.toasts = [];
            t.showToast = (m, ty) => t.toasts.push([m, ty]);
            return t;
        })()
    `, ctx);
    return t;
}
const P = id => ({ id, name: `Jug ${id}` });
const inj = (playerId, extra) => Object.assign({ playerId, status: 'active', startDate: '2026-10-01', rtpPhase: 2, history: [] }, extra || {});
const btnOf = (html, id) => (html.split('<button').find(b => b.includes(`data-player-id="${id}"`)) || '');

// ============================================================
console.log('\nChips de jugadoras (Nueva sesión)');

test('lesionada → 🏥 y clase "fuera"; con limitaciones → 🩹; sana → sin marca', () => {
    const t = make({ players: [P('a'), P('b'), P('c')], injuries: [inj('a', { rtpPhase: 2 }), inj('b', { rtpPhase: 5 })] });
    t.renderPlayerButtonsMulti();
    const html = els.playerButtons.innerHTML;
    assert.ok(btnOf(html, 'a').includes('🏥') && btnOf(html, 'a').includes('player-btn--out'));
    assert.ok(btnOf(html, 'b').includes('🩹') && !btnOf(html, 'b').includes('player-btn--out'));
    assert.ok(!btnOf(html, 'c').includes('🏥') && !btnOf(html, 'c').includes('🩹'));
});

test('al volver a pintar se conserva la selección', () => {
    const t = make({ players: [P('a'), P('b')] });
    t.selectedPlayerIds = ['b'];
    t.renderPlayerButtonsMulti();
    assert.ok(btnOf(els.playerButtons.innerHTML, 'b').includes('multi-selected'));
    assert.ok(!btnOf(els.playerButtons.innerHTML, 'a').includes('multi-selected'));
});

test('sin lesiones ni marcas no se pinta ninguna marca (aspecto de siempre)', () => {
    const t = make({ players: [P('a'), P('b')] });
    t.renderPlayerButtonsMulti();
    assert.ok(!els.playerButtons.innerHTML.includes('player-btn-flag'));
});

// ============================================================
console.log('\n"Seleccionar todas"');

test('salta a las que están fuera y avisa de cuántas', () => {
    const t = make({ players: [P('a'), P('b'), P('c'), P('d')], injuries: [inj('a'), inj('b')], availability: { c: { '2026-10-14': 'unavailable' } } });
    t.selectAllPlayers();
    assert.deepStrictEqual(Array.from(t.selectedPlayerIds), ['d']);
    assert.strictEqual(t.toasts.length, 1);
    assert.strictEqual(t.toasts[0][1], 'info');
    assert.ok(t.toasts[0][0].includes('3 jugadoras'));
});

test('con una sola fuera el aviso va en singular', () => {
    const t = make({ players: [P('a'), P('b')], injuries: [inj('a')] });
    t.selectAllPlayers();
    assert.ok(t.toasts[0][0].includes('1 jugadora no se ha seleccionado'));
});

test('el botón pasa a "Deseleccionar todas" y un segundo clic vacía la selección', () => {
    const t = make({ players: [P('a'), P('b'), P('c')], injuries: [inj('a')] });
    t.selectAllPlayers();
    assert.strictEqual(els.selectAllBtn.textContent, 'Deseleccionar todas');
    t.selectAllPlayers();
    assert.deepStrictEqual(Array.from(t.selectedPlayerIds), []);
    assert.strictEqual(els.selectAllBtn.textContent, 'Seleccionar todas');
});

test('sin lesionadas: selecciona a todas y NO avisa (comportamiento de siempre)', () => {
    const t = make({ players: [P('a'), P('b'), P('c')] });
    t.selectAllPlayers();
    assert.deepStrictEqual(Array.from(t.selectedPlayerIds), ['a', 'b', 'c']);
    assert.strictEqual(t.toasts.length, 0);
});

test('una jugadora fuera añadida a mano no impide que el botón diga "Deseleccionar"', () => {
    const t = make({ players: [P('a'), P('b')], injuries: [inj('a')] });
    t.selectedPlayerIds = ['a', 'b'];
    t.updateSelectedCount();
    assert.strictEqual(els.selectAllBtn.textContent, 'Deseleccionar todas');
});

test('si todas están fuera no se selecciona a nadie ni falla', () => {
    const t = make({ players: [P('a'), P('b')], injuries: [inj('a'), inj('b')] });
    t.selectAllPlayers();
    assert.deepStrictEqual(Array.from(t.selectedPlayerIds), []);
});

// ============================================================
console.log('\nSelección manual');

test('añadir a mano a una que está fuera: se añade y avisa (sin bloquear)', () => {
    const t = make({ players: [P('a'), P('b')], injuries: [inj('a')] });
    t.togglePlayerSelection('a');
    assert.deepStrictEqual(Array.from(t.selectedPlayerIds), ['a']);
    assert.strictEqual(t.toasts.length, 1);
    assert.strictEqual(t.toasts[0][1], 'warning');
    assert.ok(t.toasts[0][0].includes('Jug a'));
});

test('quitarla, o añadir a una sana o con limitaciones, no avisa', () => {
    const t = make({ players: [P('a'), P('b'), P('c')], injuries: [inj('a'), inj('b', { rtpPhase: 5 })] });
    t.togglePlayerSelection('c');
    t.togglePlayerSelection('b');
    t.togglePlayerSelection('a'); t.toasts.length = 0;
    t.togglePlayerSelection('a');                              // la quita
    assert.strictEqual(t.toasts.length, 0);
});

// ============================================================
console.log('\nCambio de fecha de la sesión');

test('se evalúa con la fecha del formulario: lesión que empieza el 15/10', () => {
    const t = make({ players: [P('a'), P('b')], injuries: [inj('a', { startDate: '2026-10-15' })], date: '2026-10-14' });
    assert.deepStrictEqual(Array.from(t._eligiblePlayerIds()), ['a', 'b']);
    els.sessionDate.value = '2026-10-16';
    assert.deepStrictEqual(Array.from(t._eligiblePlayerIds()), ['b']);
});

test('abrir el modal engancha el cambio de fecha y vuelve a pintar las chips', () => {
    const t = make({ players: [P('a'), P('b')], injuries: [inj('a', { startDate: '2026-10-15' })], date: '2026-10-14' });
    t.setDefaultDateTime = () => {};
    t._populateSeasonSelector = () => {};
    t.goToStep1 = () => {};
    t.openNewSessionModal();
    assert.strictEqual(typeof els.sessionDate.onchange, 'function');
    assert.ok(!btnOf(els.playerButtons.innerHTML, 'a').includes('🏥'));          // el 14/10 aún no estaba lesionada
    els.sessionDate.value = '2026-10-16';
    els.sessionDate.onchange();
    assert.ok(btnOf(els.playerButtons.innerHTML, 'a').includes('🏥'));           // el 16/10 sí
});

test('si el módulo de lesiones no estuviera cargado, Nueva sesión sigue funcionando (todas aptas)', () => {
    const t = make({ players: [P('a'), P('b')], injuries: [inj('a')] });
    t.getPlayerParticipation = undefined;
    t.selectAllPlayers();
    assert.deepStrictEqual(Array.from(t.selectedPlayerIds), ['a', 'b']);
});

// ============================================================
console.log('\nLa app y el script de avisos push aplican la MISMA regla');

test('matriz de casos: getPlayerParticipation === "out" ⇔ isOutOn', () => {
    const dates = ['2026-09-30', '2026-10-01', '2026-10-07', '2026-10-08', '2026-10-09', '2026-10-15'];
    const histories = [
        [],
        [{ date: '2026-10-08T10:00:00.000Z', phase: 3 }],
        [{ date: '2026-10-08T10:00:00.000Z', phase: 5 }, { date: '2026-10-12T10:00:00.000Z', phase: 6 }],
    ];
    const injuries = [];
    ['active', 'recovered', 'recurring'].forEach(status => {
        [1, 3, 4, 5, 6].forEach(rtpPhase => {
            histories.forEach(history => {
                [undefined, '2026-10-01'].forEach(startDate => {
                    [undefined, '2026-10-09'].forEach(endDate => {
                        injuries.push({ playerId: 'a', status, rtpPhase, history, startDate, endDate });
                    });
                });
            });
        });
    });
    const marks = [undefined, 'limited', 'unavailable'];
    let checked = 0;
    injuries.forEach(i => {
        marks.forEach(mark => {
            dates.forEach(date => {
                const availability = mark ? { a: { [date]: mark } } : {};
                const t = make({ players: [P('a')], injuries: [i], availability });
                const app = t.getPlayerParticipation('a', date) === 'out';
                const script = R.isOutOn([i], availability, 'a', date);
                assert.strictEqual(app, script, `status=${i.status} fase=${i.rtpPhase} hist=${i.history.length} inicio=${i.startDate} fin=${i.endDate} marca=${mark} fecha=${date}`);
                checked++;
            });
        });
    });
    assert.ok(checked > 1000, `solo ${checked} casos`);
});

// ============================================================
console.log(`\n${'─'.repeat(50)}`);
console.log(`Resultado: ${passed} pasados, ${failed} fallidos`);
if (failed > 0) process.exit(1);

// test/tests-notes.test.js
// Notas en los tests de rendimiento (pista mojada, jugadora con fatiga, intento nulo…)
//  • Se escriben en Tests → "+": una nota para todas y/o una por jugadora; se guardan en results[test].note.
//  • Se ven en el resumen, en el ranking de "Por test" y en el historial de la jugadora.
//  • El modal antiguo de editar NO las pierde. Todo el texto se escapa.
// Ejecutar con:  node test/tests-notes.test.js
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
const NOW = iso(0);

const els = {};
const store = {};
const mkNode = () => {
    const set = new Set();
    return { style: {}, innerHTML: '', textContent: '', id: '', className: '',
        classList: { add: c => set.add(c), remove: c => set.delete(c), toggle: (c, on) => (on ? set.add(c) : set.delete(c)), contains: c => set.has(c) },
        querySelectorAll() { return []; }, closest() { return null; }, remove() {} };
};
const win = { firebaseSync: null, firebaseDB: null };
const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, setTimeout, clearTimeout,
    document: {
        getElementById: id => els[id] || null, addEventListener() {}, head: { appendChild() {} },
        createElement: () => mkNode(), body: { appendChild(n) { if (n.id) els[n.id] = n; } },
        documentElement: { getAttribute: () => null },
    },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; } },
    window: win,
    AppConfirm: { show: () => Promise.resolve(true) }, AppAlert: { show() {} },
    PlayerTokens: { get: () => '#111111' },
    toLocalISODate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    getCurrentSeasonWindowStart: () => '2026-08-01',
    requestAnimationFrame: fn => fn(),
    sessionStorage: { getItem() { return null; }, setItem() {} },
});
vm.runInContext(read('security.js') + '\n;globalThis.esc = esc;\nAppConfirm.show = () => Promise.resolve(true);', ctx);   // esc() REAL; confirmar siempre sí
vm.runInContext('function RPETracker() {}', ctx);
['gps-tracking.js', 'app-players.js', 'injury-management.js', 'strength.js', 'tests-wizard.js', 'tests-team.js']
    .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const TT = vm.runInContext('TestTeamLogic', ctx);
const TW = vm.runInContext('TestWizardLogic', ctx);

const P = (id, name, extra) => ({ id, name, lastName: 'X', ...(extra || {}) });
const S = (id, playerId, date, results, createdAt) => ({ id, playerId, date, results, createdAt: createdAt || date });
const tri = (l, r) => ({ triple: { left: l, right: r } });
const cmj = v => ({ cmj: { value: v } });
const FREQ = { cmj: 4, triple: 8 };    // el resto, sin aviso

function makeTracker(players, sessions) {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = players; T.testSessions = sessions;
    T.injuries = []; T.availability = {}; T.currentView = 'tests';
    T.toasts = []; T.renders = 0;
    T.showToast = (m, t) => T.toasts.push([m, t]);
    T.testSettings = { freqWeeks: { ...FREQ } };
    return T;
}
function reset() { Object.keys(els).forEach(k => delete els[k]); Object.keys(store).forEach(k => delete store[k]); win.firebaseDB = null; }
const mountTests = () => (els.testsView = mkNode());


const sprint = v => ({ sprint10: { value: v, raw: v } });
function startWizard(T, testId, vals) {
    T._openTestWizard(); T._twSelectTest(testId); T._twContinue();
    Object.entries(vals || {}).forEach(([pid, v]) => T._twOnInput({ value: v, dataset: { pid, f: 'v' } }));
}
const flush = () => new Promise(r => setTimeout(r, 0));

console.log('\nLógica');
test('cleanNote: colapsa espacios y saltos de línea, recorta y limita a 200 caracteres', () => {
    assert.strictEqual(TW.cleanNote('  pista \n  mojada  '), 'pista mojada');
    assert.strictEqual(TW.cleanNote(null), '');
    assert.strictEqual(TW.cleanNote(undefined), '');
    assert.strictEqual(TW.cleanNote('x'.repeat(500)).length, 200);
    assert.strictEqual(TW.cleanNote('   '), '');
});
test('combineNote: nota general + nota de la jugadora, unidas con " · "', () => {
    assert.strictEqual(TW.combineNote('pista mojada', 'fatiga'), 'pista mojada · fatiga');
    assert.strictEqual(TW.combineNote('pista mojada', ''), 'pista mojada');
    assert.strictEqual(TW.combineNote('', ' fatiga '), 'fatiga');
    assert.strictEqual(TW.combineNote('', ''), '');
    assert.strictEqual(TW.combineNote(undefined, undefined), '');
    assert.ok(TW.combineNote('a'.repeat(150), 'b'.repeat(150)).length <= 200);
});

console.log('\nAsistente');
test('la nota general se aplica a todas y la de cada jugadora se suma; sin nota no hay campo note', async () => {
    reset();
    const T = makeTracker([P('a', 'Ana'), P('b', 'Bea'), P('c', 'Cris')], []);
    startWizard(T, 'sprint10', { a: '1.9', b: '2.0', c: '2.1' });
    T._twOnNote({ dataset: { scope: 'all' }, value: '  pista   mojada ' });
    T._twOnNote({ dataset: { scope: 'row', pid: 'b' }, value: 'intento 1 nulo' });
    T._twSave(); await flush();
    const by = pid => T.testSessions.find(s => s.playerId === pid).results.sprint10;
    assert.strictEqual(by('a').note, 'pista mojada');
    assert.strictEqual(by('b').note, 'pista mojada · intento 1 nulo');
    assert.strictEqual(by('c').note, 'pista mojada');
});
test('solo nota de jugadora: las demás no llevan nota', async () => {
    reset();
    const T = makeTracker([P('a', 'Ana'), P('b', 'Bea')], []);
    startWizard(T, 'sprint10', { a: '1.9', b: '2.0' });
    T._twOnNote({ dataset: { scope: 'row', pid: 'a' }, value: 'fatiga' });
    T._twSave(); await flush();
    assert.strictEqual(T.testSessions.find(s => s.playerId === 'a').results.sprint10.note, 'fatiga');
    assert.ok(!('note' in T.testSessions.find(s => s.playerId === 'b').results.sprint10));
});
test('la nota va dentro del resultado del test y no toca los demás tests de la sesión', async () => {
    reset();
    const old = [S('s1', 'a', NOW, { cmj: { value: 30, note: 'antigua' } }, 'T0')];
    const T = makeTracker([P('a', 'Ana')], old);
    startWizard(T, 'sprint10', { a: '1.9' });
    T._twOnNote({ dataset: { scope: 'all' }, value: 'viento' });
    T._twSave(); await flush();
    assert.strictEqual(T.testSessions.length, 1);
    assert.strictEqual(T.testSessions[0].results.sprint10.note, 'viento');
    assert.strictEqual(T.testSessions[0].results.cmj.note, 'antigua');
});
test('al abrir una fila ya registrada sale su nota; sin tocar nada no se reescribe; cambiar solo la nota sí guarda', async () => {
    reset();
    const old = [S('s1', 'a', NOW, sprint(1.9), 'T0')];
    old[0].results.sprint10.note = 'pista mojada';
    const T = makeTracker([P('a', 'Ana')], old);
    let saves = 0; T._saveTestSessions = () => { saves++; };
    startWizard(T, 'sprint10');
    assert.strictEqual(T._tw.notes.a, 'pista mojada');
    assert.ok(els.testWizardModal.innerHTML.includes('value="pista mojada"'));
    T._twSave(); await flush();
    assert.strictEqual(saves, 0, 'sin cambios no se guarda');
    T._twOnNote({ dataset: { scope: 'row', pid: 'a' }, value: 'pista seca' });
    T._twSave(); await flush();
    assert.strictEqual(saves, 1);
    assert.strictEqual(T.testSessions[0].results.sprint10.note, 'pista seca');
    assert.strictEqual(T.testSessions[0].results.sprint10.value, 1.9, 'el valor no se toca');
});
test('quitar la nota de una fila ya registrada la borra', async () => {
    reset();
    const old = [S('s1', 'a', NOW, sprint(1.9), 'T0')];
    old[0].results.sprint10.note = 'viento';
    const T = makeTracker([P('a', 'Ana')], old);
    startWizard(T, 'sprint10');
    T._twOnNote({ dataset: { scope: 'row', pid: 'a' }, value: '   ' });
    T._twSave(); await flush();
    assert.ok(!('note' in T.testSessions[0].results.sprint10));
});
test('el borrador conserva las notas y se recuperan', () => {
    reset();
    const T = makeTracker([P('a', 'Ana'), P('b', 'Bea')], []);
    startWizard(T, 'sprint10', { a: '1.9' });
    T._twOnNote({ dataset: { scope: 'all' }, value: 'calor' });
    T._twOnNote({ dataset: { scope: 'row', pid: 'a' }, value: 'fatiga' });
    T._twClose();
    const T2 = makeTracker([P('a', 'Ana'), P('b', 'Bea')], []);
    T2._openTestWizard(); T2._twResumeDraft();
    assert.strictEqual(T2._tw.generalNote, 'calor');
    assert.strictEqual(T2._tw.notes.a, 'fatiga');
    assert.ok(els.testWizardModal.innerHTML.includes('value="calor"'));
});
test('"Registrar otro test" no arrastra las notas', () => {
    reset();
    const T = makeTracker([P('a', 'Ana')], []);
    startWizard(T, 'sprint10', { a: '1.9' });
    T._twOnNote({ dataset: { scope: 'all' }, value: 'calor' });
    T._twAnother();
    assert.strictEqual(T._tw.generalNote, '');
    assert.deepStrictEqual(J(T._tw.notes), {});
});
test('la caja de nota de cada jugadora está oculta salvo que ya tenga nota; el 📝 la muestra', () => {
    reset();
    const old = [S('s1', 'a', NOW, sprint(1.9), 'T0')];
    old[0].results.sprint10.note = 'viento';
    const T = makeTracker([P('a', 'Ana'), P('b', 'Bea')], old);
    startWizard(T, 'sprint10');
    const h = els.testWizardModal.innerHTML;
    assert.ok(h.includes('data-note-box="a" >') || h.includes('data-note-box="a"  >') || /data-note-box="a"\s*>/.test(h), 'Ana: visible');
    assert.ok(/data-note-box="b"\s+hidden>/.test(h), 'Bea: oculta');
    const box = { dataset: { noteBox: 'b' }, hidden: true, querySelector: () => ({ focus() { box.focused = true; } }) };
    els.testWizardModal.querySelectorAll = () => [box];
    T._twToggleNote('b');
    assert.strictEqual(box.hidden, false);
    assert.strictEqual(box.focused, true);
    T._twToggleNote('b');
    assert.strictEqual(box.hidden, true);
});

console.log('\nDónde se ven');
test('resumen del asistente y ranking de "Por test" muestran la nota', async () => {
    reset();
    const T = makeTracker([P('a', 'Ana'), P('b', 'Bea')], []);
    startWizard(T, 'sprint10', { a: '1.9', b: '2.0' });
    T._twOnNote({ dataset: { scope: 'all' }, value: 'pista mojada' });
    T._twSave(); await flush();
    assert.ok(els.testWizardModal.innerHTML.includes('📝 pista mojada'));
    const el = mountTests(); T._tt = { testId: 'sprint10', date: null, players: new Set() };
    T._renderTestByTest(el);
    assert.ok(el.innerHTML.includes('📝 pista mojada'));
});
test('el historial de la jugadora muestra la nota de cada test', () => {
    reset();
    const ses = [S('s1', 'a', iso(-3), { sprint10: { value: 1.9, note: 'viento fuerte' }, triple: { left: 400, right: 410, note: 'rodilla cargada' } })];
    const T = makeTracker([P('a', 'Ana')], ses);
    const el = mountTests(); T._testSub = 'player'; T._testPlayerId = 'a';
    T.renderTestsView();
    assert.ok(el.innerHTML.includes('📝 viento fuerte'));
    assert.ok(el.innerHTML.includes('📝 rodilla cargada'));
});
test('todo el texto de las notas se escapa (no se cuela HTML)', async () => {
    reset();
    const bad = '<img src=x onerror=alert(1)>';
    const old = [S('s1', 'a', iso(-3), { sprint10: { value: 1.9, note: bad } })];
    const T = makeTracker([P('a', 'Ana')], old);
    const el = mountTests();
    T._testSub = 'player'; T._testPlayerId = 'a'; T.renderTestsView();
    assert.ok(!el.innerHTML.includes('<img'), 'historial');
    T._tt = { testId: 'sprint10', date: null, players: new Set() }; T._renderTestByTest(el);
    assert.ok(!el.innerHTML.includes('<img'), 'ranking');
    startWizard(T, 'sprint10', { a: '1.8' });
    T._twOnNote({ dataset: { scope: 'all' }, value: bad });
    assert.ok(!els.testWizardModal.innerHTML.includes('<img'), 'tabla del asistente');
    T._twRender();
    assert.ok(!els.testWizardModal.innerHTML.includes('<img'), 'tabla repintada');
    T._twSave(); await flush();
    assert.ok(!els.testWizardModal.innerHTML.includes('<img'), 'resumen');
});

console.log('\nModal antiguo de editar');
test('editar un test con el modal antiguo conserva la nota de los tests que siguen', () => {
    reset();
    const old = [S('s1', 'a', NOW, { sprint10: { value: 1.9, raw: 1.9, note: 'viento' }, sprint20: { value: 3.4, raw: 3.4, note: 'pista mojada' } }, 'T0')];
    const T = makeTracker([P('a', 'Ana')], old);
    T._saveTestSessions = () => {};
    T.renderTestsView = () => {};
    els.testPlayerSel = { value: 'a' }; els.testDate = { value: NOW }; els.testBodyWeight = { value: '' };
    els.test_sprint10_value = { value: '1.8' };        // cambia el valor
    els.test_sprint20_value = { value: '3.4' };
    T._saveTestSession('s1');
    const r = T.testSessions[0].results;
    assert.strictEqual(r.sprint10.value, 1.8);
    assert.strictEqual(r.sprint10.note, 'viento');
    assert.strictEqual(r.sprint20.note, 'pista mojada');
});
test('un test nuevo añadido con el modal antiguo no lleva nota; uno quitado se va con su nota', () => {
    reset();
    const old = [S('s1', 'a', NOW, { sprint10: { value: 1.9, raw: 1.9, note: 'viento' } }, 'T0')];
    const T = makeTracker([P('a', 'Ana')], old);
    T._saveTestSessions = () => {}; T.renderTestsView = () => {};
    els.testPlayerSel = { value: 'a' }; els.testDate = { value: NOW }; els.testBodyWeight = { value: '' };
    els.test_sprint20_value = { value: '3.4' };         // sprint10 vacío: se quita
    T._saveTestSession('s1');
    const r = T.testSessions[0].results;
    assert.ok(!r.sprint10);
    assert.ok(!('note' in r.sprint20));
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

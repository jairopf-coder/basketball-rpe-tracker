// test/tests-wizard.test.js
// Registro de tests por equipo (Rendimiento → Tests → "+"): tests-wizard.js
//  • Lógica pura: convertir lo escrito en resultado (mismo formato que siempre), fusionar con las sesiones
//    existentes (una por jugadora y día), ids únicos, variación, mejor marca, ranking, borrador.
//  • Flujo completo simulado: test → día → jugadoras → datos → guardar → resumen.
//  • Cableado: los "+" abren el flujo nuevo, el script está en index.html y sw.js.
// Ejecutar con:  node test/tests-wizard.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const iso = off => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const HOY = iso(0);

const els = {};
const mkNode = () => ({
    style: {}, innerHTML: '', textContent: '', _cls: new Set(),
    classList: { add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, toggle(c, on) { on ? this._s.add(c) : this._s.delete(c); }, contains(c) { return this._s.has(c); }, _s: null },
    querySelectorAll() { return []; }, closest() { return null; }, remove() {}
});
const store = {};
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, setTimeout, clearTimeout,
    document: {
        getElementById: id => els[id] || null,
        createElement: () => { const n = mkNode(); n.classList._s = n._cls; return n; },
        body: { appendChild(n) { if (n.id) els[n.id] = n; } },
    },
    localStorage: {
        getItem: k => (k in store ? store[k] : null),
        setItem: (k, v) => { store[k] = String(v); },
        removeItem: k => { delete store[k]; },
    },
    window: { firebaseSync: null },
    AppConfirm: { answer: true, calls: [], show(o) { this.calls.push(o); return Promise.resolve(this.answer); } },
    PlayerTokens: { get: () => '#111111' },
    AppAlert: { show() {} },
    getCurrentSeasonWindowStart: () => '2026-08-01',
    requestAnimationFrame: fn => fn(),
    sessionStorage: { getItem() { return null; }, setItem() {} },
    esc: s => String(s == null ? '' : s),
    toLocalISODate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
});
vm.runInContext('function RPETracker() {}', ctx);
['gps-tracking.js', 'app-players.js', 'injury-management.js', 'strength.js', 'tests-wizard.js']
    .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));
const L = vm.runInContext('TestWizardLogic', ctx);
const J = x => JSON.parse(JSON.stringify(x));
const def = id => L.defById(id);
const flush = () => new Promise(r => setTimeout(r, 0));

function makeTracker(players, sessions) {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = players;
    T.testSessions = sessions || [];
    T.injuries = []; T.availability = {};
    T.toasts = []; T.saves = 0; T.renders = 0; T.currentView = 'tests';
    T.showToast = (m, t) => T.toasts.push([m, t]);
    T._saveTestSessions = () => { T.saves++; };
    T.renderTestsView = () => { T.renders++; };
    return T;
}
const P = (id, name, lastName) => ({ id, name, lastName });
const type = (T, pid, f, value) => T._twOnInput({ value, dataset: { pid, f } });

console.log('\nLógica: convertir lo escrito en resultado');
test('fieldsFor: campos según el tipo de test', () => {
    assert.deepStrictEqual(J(L.fieldsFor(def('cmj'))), ['t1', 't2', 't3']);
    assert.deepStrictEqual(J(L.fieldsFor(def('slcmj'))), ['l1', 'l2', 'l3', 'r1', 'r2', 'r3']);
    assert.deepStrictEqual(J(L.fieldsFor(def('triple'))), ['l', 'r']);
    assert.deepStrictEqual(J(L.fieldsFor(def('sprint10'))), ['v']);
});
test('CMJ: 3 saltos en ms → media de altura en cm, intentos y potencia con el peso', () => {
    const e = L.buildEntry(def('cmj'), { t1: '500', t2: '520', t3: '540' }, 60);
    const hs = [500, 520, 540].map(ms => parseFloat((9.81 * (ms / 1000) ** 2 / 8 * 100).toFixed(1)));
    assert.deepStrictEqual(J(e.trials), hs);
    assert.strictEqual(e.value, parseFloat((hs.reduce((a, b) => a + b) / 3).toFixed(1)));
    assert.ok(e.power > 0 && e.powerPerKg > 0);
    assert.ok(!('power' in L.buildEntry(def('cmj'), { t1: '500' }, null)), 'sin peso no hay potencia');
});
test('acepta coma decimal y deja en blanco lo vacío; sin datos → null', () => {
    assert.strictEqual(L.buildEntry(def('sprint10'), { v: '1,85' }).value, 1.85);
    assert.strictEqual(L.buildEntry(def('sprint10'), { v: '' }), null);
    assert.strictEqual(L.buildEntry(def('sprint10'), { v: 'abc' }), null);
    assert.strictEqual(L.buildEntry(def('cmj'), { t1: '', t2: ' ', t3: '' }), null);
});
test('sprint: guarda value y raw; bilateral sin multiintento: left/right y raw_*', () => {
    assert.deepStrictEqual(J(L.buildEntry(def('sprint10'), { v: '1.9' })), { value: 1.9, raw: 1.9 });
    assert.deepStrictEqual(J(L.buildEntry(def('triple'), { l: '480', r: '470' })), { left: 480, right: 470, raw_left: 480, raw_right: 470 });
});
test('Single Leg CMJ con solo una pierna: la otra queda en null', () => {
    const e = L.buildEntry(def('slcmj'), { l1: '400', l2: '410' });
    assert.ok(e.left > 0 && e.right === null && e.trials_left.length === 2 && !('trials_right' in e));
});
test('valuesFromResult → buildEntry reproduce el valor (±0,1 cm) y no pierde campos', () => {
    const e = L.buildEntry(def('cmj'), { t1: '500', t2: '520', t3: '540' }, 60);
    const back = L.buildEntry(def('cmj'), L.valuesFromResult(def('cmj'), e), 60);
    assert.ok(Math.abs(back.value - e.value) <= 0.1);
    const s = L.buildEntry(def('sprint20'), { v: '3.4' });
    assert.strictEqual(L.valuesFromResult(def('sprint20'), s).v, '3.4');
    const b = L.buildEntry(def('slcmj'), { l1: '400', r1: '420' });
    const vb = L.valuesFromResult(def('slcmj'), b);
    assert.ok(vb.l1 && vb.r1 && !vb.l2);
});

console.log('\nLógica: comparar');
test('mainValue / isBetter / pctChange / isOutlier', () => {
    assert.strictEqual(L.mainValue(def('triple'), { left: 400, right: 500 }), 450);
    assert.strictEqual(L.mainValue(def('triple'), { left: 400, right: null }), 400);
    assert.strictEqual(L.mainValue(def('cmj'), { value: 30 }), 30);
    assert.ok(L.isBetter(def('sprint10'), 1.8, 1.9));
    assert.ok(L.isBetter(def('cmj'), 32, 30));
    assert.strictEqual(L.pctChange(30, 33), 10);
    assert.strictEqual(L.pctChange(0, 5), null);
    assert.strictEqual(L.pctChange(null, 5), null);
    assert.ok(L.isOutlier(30, 45) && !L.isOutlier(30, 33));
});
test('previousResult toma el test anterior MÁS RECIENTE (no el de la misma fecha ni posteriores)', () => {
    const S = [
        { id: '1', playerId: 'a', date: '2026-09-01', results: { cmj: { value: 28 } } },
        { id: '2', playerId: 'a', date: '2026-10-01', results: { cmj: { value: 30 } } },
        { id: '3', playerId: 'a', date: '2026-11-01', results: { cmj: { value: 33 } } },
        { id: '4', playerId: 'b', date: '2026-10-15', results: { cmj: { value: 99 } } },
    ];
    const prev = L.previousResult(def('cmj'), S, 'a', '2026-11-01');
    assert.strictEqual(prev.date, '2026-10-01');
    assert.strictEqual(prev.main, 30);
    assert.strictEqual(L.previousResult(def('cmj'), S, 'a', '2026-09-01'), null);
    assert.strictEqual(L.bestBefore(def('cmj'), S, 'a', '2026-11-01'), 30);
});
test('bestBefore en sprint (menos es mejor) y lastBodyWeight', () => {
    const S = [
        { id: '1', playerId: 'a', date: '2026-09-01', bodyWeight: 60, results: { sprint10: { value: 1.9 } } },
        { id: '2', playerId: 'a', date: '2026-10-01', bodyWeight: 62, results: { sprint10: { value: 1.8 } } },
        { id: '3', playerId: 'a', date: '2026-10-20', results: { sprint10: { value: 1.85 } } },
    ];
    assert.strictEqual(L.bestBefore(def('sprint10'), S, 'a', '2026-11-01'), 1.8);
    assert.strictEqual(L.lastBodyWeight(S, 'a', '2026-11-01'), 62);
    assert.strictEqual(L.lastBodyWeight(S, 'x', '2026-11-01'), null);
});

console.log('\nLógica: guardar sin perder nada');
test('12 jugadoras seguidas → 12 sesiones con ids DISTINTOS', () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ playerId: 'p' + i, entry: { value: 30 + i }, bodyWeight: null }));
    const r = L.mergeResults([], items, 'cmj', '2026-11-13', 'NOW', () => L.newId());
    assert.strictEqual(r.created, 12);
    assert.strictEqual(new Set(r.sessions.map(s => s.id)).size, 12);
    assert.ok(r.sessions.every(s => /^[A-Za-z0-9_-]+$/.test(s.id)), 'ids seguros para usar en onclick');
});
test('si la jugadora ya tiene sesión ese día, se AÑADE el test y se conservan los demás', () => {
    const S = [{ id: 'x1', playerId: 'a', date: '2026-11-13', bodyWeight: 60, createdAt: 'T0', results: { sprint10: { value: 1.9 } } }];
    const snapshot = J(S);
    const r = L.mergeResults(S, [{ playerId: 'a', entry: { value: 31 }, bodyWeight: null }], 'cmj', '2026-11-13', 'NOW', () => 'NEW');
    assert.strictEqual(r.sessions.length, 1);
    assert.deepStrictEqual(J(r.sessions[0].results), { sprint10: { value: 1.9 }, cmj: { value: 31 } });
    assert.strictEqual(r.sessions[0].id, 'x1');
    assert.strictEqual(r.sessions[0].bodyWeight, 60, 'sin peso nuevo se conserva el anterior');
    assert.strictEqual(r.sessions[0].updatedAt, 'NOW');
    assert.deepStrictEqual(J(S), snapshot, 'no modifica el array original');
    assert.deepStrictEqual(J(r.overwritten), []);
});
test('sobrescribir un test ya registrado se avisa en overwritten; otro día crea sesión nueva', () => {
    const S = [{ id: 'x1', playerId: 'a', date: '2026-11-13', results: { cmj: { value: 30 } } }];
    const r = L.mergeResults(S, [{ playerId: 'a', entry: { value: 32 }, bodyWeight: 65 }], 'cmj', '2026-11-13', 'N', () => 'NEW');
    assert.deepStrictEqual(J(r.overwritten), ['a']);
    assert.strictEqual(r.sessions[0].results.cmj.value, 32);
    assert.strictEqual(r.sessions[0].bodyWeight, 65);
    const r2 = L.mergeResults(S, [{ playerId: 'a', entry: { value: 32 } }], 'cmj', '2026-11-14', 'N', () => 'NEW');
    assert.strictEqual(r2.created, 1);
    assert.strictEqual(r2.sessions.length, 2);
});

console.log('\nLógica: resumen');
test('ranking (sprint: el más rápido primero), variación, mejor marca y media del equipo', () => {
    const S = [
        { id: '1', playerId: 'a', date: '2026-10-01', results: { sprint10: { value: 1.9 } } },
        { id: '2', playerId: 'b', date: '2026-10-01', results: { sprint10: { value: 2.0 } } },
        { id: '3', playerId: 'a', date: '2026-11-01', results: { sprint10: { value: 1.8 } } },
        { id: '4', playerId: 'b', date: '2026-11-01', results: { sprint10: { value: 2.1 } } },
        { id: '5', playerId: 'c', date: '2026-11-01', results: { sprint10: { value: 1.95 } } },
    ];
    const sm = L.buildSummary(def('sprint10'), S, '2026-11-01', ['a', 'b', 'c']);
    assert.deepStrictEqual(J(sm.rows.map(r => r.playerId)), ['a', 'c', 'b']);
    const a = sm.rows[0], b = sm.rows[2], c = sm.rows[1];
    assert.strictEqual(a.pct, -5.3); assert.strictEqual(a.improved, true); assert.strictEqual(a.isPB, true);
    assert.strictEqual(b.pct, 5); assert.strictEqual(b.improved, false); assert.strictEqual(b.isPB, false);
    assert.strictEqual(c.pct, null); assert.strictEqual(c.isPB, false, 'sin test anterior no hay mejor marca');
    assert.strictEqual(sm.prevTeamDate, '2026-10-01');
    assert.ok(Math.abs(sm.prevTeamMean - 1.95) < 1e-9);
    assert.ok(Math.abs(sm.teamMean - (1.8 + 2.1 + 1.95) / 3) < 1e-9);
    assert.strictEqual(typeof sm.teamPct, 'number');
});
test('bilateral: usa la media de los dos lados y calcula la asimetría', () => {
    const S = [{ id: '1', playerId: 'a', date: '2026-11-01', results: { triple: { left: 400, right: 500 } } }];
    const sm = L.buildSummary(def('triple'), S, '2026-11-01', ['a']);
    assert.strictEqual(sm.rows[0].main, 450);
    assert.strictEqual(String(sm.rows[0].asym), '20.0');
});

console.log('\nLógica: borrador');
test('guarda, recupera y caduca a las 48 h; ignora datos corruptos', () => {
    const mem = {};
    const st = { getItem: k => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = v; }, removeItem: k => { delete mem[k]; } };
    const now = Date.now();
    L.saveDraft(st, { testId: 'cmj', date: '2026-11-13', playerIds: ['a'], vals: {}, weights: {}, savedAt: new Date(now).toISOString() });
    assert.strictEqual(L.loadDraft(st, now + 3600e3).testId, 'cmj');
    assert.strictEqual(L.loadDraft(st, now + 49 * 3600e3), null);
    mem[L.DRAFT_KEY] = '{no es json';
    assert.strictEqual(L.loadDraft(st, now), null);
    mem[L.DRAFT_KEY] = JSON.stringify({ testId: 'inventado', date: 'x', playerIds: [], savedAt: new Date(now).toISOString() });
    assert.strictEqual(L.loadDraft(st, now), null);
    L.saveDraft(st, { testId: 'cmj' }); L.clearDraft(st);
    assert.strictEqual(L.loadDraft(st, now), null);
});

console.log('\nFlujo completo');
test('test → día → jugadoras → datos → guardar → resumen', async () => {
    const T = makeTracker([P('a', 'Ana', 'Pérez'), P('b', 'Bea', 'Ruiz'), P('c', 'Cris', 'Gil')]);
    T._openTestWizard();
    assert.strictEqual(T._tw.step, 1);
    assert.deepStrictEqual([...T._tw.playerIds].sort(), ['a', 'b', 'c'], 'por defecto, todas las del grupo');
    assert.ok(els.testWizardModal.innerHTML.includes('1. ¿Qué test has hecho?'));
    T._twTogglePlayer('c');                       // Cris no lo hizo
    T._twSelectTest('sprint10');
    T._twContinue();
    assert.strictEqual(T._tw.step, 2);
    assert.ok(els.testWizardModal.innerHTML.includes('Ana') && els.testWizardModal.innerHTML.includes('Bea') && !els.testWizardModal.innerHTML.includes('Cris'));
    type(T, 'a', 'v', '1,85');
    type(T, 'b', 'v', '2.01');
    assert.ok(JSON.parse(store[L.DRAFT_KEY] || 'null') === null, 'el borrador se guarda con un pequeño retraso');
    T._twPersistDraft();
    assert.deepStrictEqual(JSON.parse(store[L.DRAFT_KEY]).playerIds.sort(), ['a', 'b']);
    T._twSave();
    await flush();
    assert.strictEqual(T.testSessions.length, 2);
    assert.strictEqual(T.saves, 1, 'una sola operación de guardado para todas');
    assert.ok(!(L.DRAFT_KEY in store), 'al guardar se borra el borrador');
    assert.strictEqual(T._tw.step, 3);
    assert.ok(els.testWizardModal.innerHTML.includes('Media del equipo'));
    assert.strictEqual(T.renders, 1, 'se repinta la lista de tests');
    assert.deepStrictEqual(T.testSessions.map(s => s.results.sprint10.value).sort(), [1.85, 2.01]);
    T._twAnother();
    assert.strictEqual(T._tw.step, 1);
    assert.strictEqual(T._tw.testId, null);
    assert.deepStrictEqual([...T._tw.playerIds].sort(), ['a', 'b'], 'conserva las jugadoras');
});
test('guardar sin ningún dato avisa y no escribe nada', () => {
    const T = makeTracker([P('a', 'Ana', 'P')]);
    T._openTestWizard(); T._twSelectTest('cmj'); T._twContinue();
    T._twSave();
    assert.strictEqual(T.testSessions.length, 0);
    assert.strictEqual(T.toasts[T.toasts.length - 1][1], 'error');
});
test('un valor raro (cambio >30%) o sobrescribir pide confirmar; si se cancela no se guarda', async () => {
    const S = [{ id: 's1', playerId: 'a', date: iso(-7), results: { sprint10: { value: 1.9 } } }];
    const T = makeTracker([P('a', 'Ana', 'P')], S);
    ctx.AppConfirm.answer = false; ctx.AppConfirm.calls.length = 0;
    T._openTestWizard(); T._twSelectTest('sprint10'); T._twContinue();
    type(T, 'a', 'v', '3.9');                      // +105 % respecto a 1.9
    T._twSave(); await flush();
    assert.strictEqual(ctx.AppConfirm.calls.length, 1);
    assert.ok(ctx.AppConfirm.calls[0].message.includes('más de 30%'));
    assert.strictEqual(T.testSessions.length, 1, 'cancelado: no se guarda');
    ctx.AppConfirm.answer = true;
    T._twSave(); await flush();
    assert.strictEqual(T.testSessions.length, 2, 'confirmado: se guarda');
});
test('si ya tenía el test ese día, la fila sale rellena y sin tocar no se reescribe', () => {
    const S = [{ id: 's1', playerId: 'a', date: HOY, createdAt: 'T0', results: { sprint10: { value: 1.9, raw: 1.9 } } }];
    const T = makeTracker([P('a', 'Ana', 'P'), P('b', 'Bea', 'R')], S);
    T._openTestWizard(); T._twSelectTest('sprint10'); T._twContinue();
    assert.strictEqual(T._tw.vals.a.v, '1.9');
    assert.ok(els.testWizardModal.innerHTML.includes('ya registrado'));
    T._twSave();
    assert.strictEqual(T.saves, 0, 'sin cambios no se guarda');
    assert.strictEqual(T.toasts[T.toasts.length - 1][0], 'No hay cambios que guardar');
});
test('CMJ: el peso se sugiere con el último registrado y calcula la potencia al guardar', async () => {
    const S = [{ id: 's1', playerId: 'a', date: iso(-30), bodyWeight: 61, results: { cmj: { value: 28 } } }];
    const T = makeTracker([P('a', 'Ana', 'P')], S);
    T._openTestWizard(); T._twSelectTest('cmj'); T._twContinue();
    assert.strictEqual(T._tw.weights.a, '61');
    type(T, 'a', 't1', '500'); type(T, 'a', 't2', '510'); type(T, 'a', 't3', '520');
    T._twSave(); await flush();
    const saved = T.testSessions.find(s => s.id !== 's1');
    assert.strictEqual(saved.bodyWeight, 61);
    assert.ok(saved.results.cmj.power > 0);
});
test('una jugadora fuera del grupo ese día (🏥) viene desmarcada por defecto', () => {
    const T = makeTracker([P('a', 'Ana', 'P'), P('b', 'Bea', 'R')]);
    T.availability = { b: { [HOY]: 'unavailable' } };
    T._openTestWizard();
    assert.deepStrictEqual([...T._tw.playerIds], ['a']);
    assert.ok(els.testWizardModal.innerHTML.includes('🏥'));
});
test('desde la ficha de una jugadora, solo ella viene marcada', () => {
    const T = makeTracker([P('a', 'Ana', 'P'), P('b', 'Bea', 'R')]);
    T._openTestWizard('b');
    assert.deepStrictEqual([...T._tw.playerIds], ['b']);
});
test('el borrador se recupera: mismas jugadoras y valores', () => {
    const T = makeTracker([P('a', 'Ana', 'P'), P('b', 'Bea', 'R')]);
    T._openTestWizard(); T._twSelectTest('sprint20'); T._twContinue();
    type(T, 'a', 'v', '3.3'); T._twClose();
    const T2 = makeTracker([P('a', 'Ana', 'P'), P('b', 'Bea', 'R')]);
    T2._openTestWizard();
    assert.ok(els.testWizardModal.innerHTML.includes('borrador sin guardar'));
    T2._twResumeDraft();
    assert.strictEqual(T2._tw.step, 2);
    assert.strictEqual(T2._tw.testId, 'sprint20');
    assert.strictEqual(T2._tw.vals.a.v, '3.3');
    L.clearDraft(ctx.localStorage);
});

console.log('\nCableado');
test('los "+" de Tests abren el flujo nuevo y el modal antiguo sigue para editar', () => {
    const src = read('strength.js');
    assert.ok(src.includes(`onclick="window.rpeTracker._openTestWizard()" title="Nuevo test"`));
    assert.ok(src.includes(`onclick="window.rpeTracker._openTestWizard('\${player.id}')" title="Nuevo test"`));
    assert.ok(!src.includes(`_openNewTest()" title="Nuevo test"`));
    assert.ok(src.includes(`_openNewTest(null, '\${ts.id}')`), 'el ✏️ de editar sigue usando el modal antiguo');
});
test('tests-wizard.js se carga después de strength.js (index.html) y está en la caché offline (sw.js)', () => {
    const html = read('index.html');
    assert.ok(html.indexOf('tests-wizard.js') > html.indexOf('strength.js'));
    assert.ok(read('sw.js').includes("'tests-wizard.js'"));
});

(async () => {
    let passed = 0, failed = 0;
    for (const t of pending) {
        try { await t.fn(); passed++; console.log('  ✅ ' + t.name); }
        catch (e) { failed++; console.log('  ❌ ' + t.name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

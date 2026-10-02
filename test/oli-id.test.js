// test/oli-id.test.js
// ID de Oli por jugadora: campo manual en la ficha + aprendizaje automático al importar GPS.
// Fuente única: gpsPlayerMap { [oliPlayerId]: playerId }.
// Ejecutar con:  node test/oli-id.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pending = [];
function test(name, fn) { pending.push({ name, fn }); }

const inputs = {};   // id -> { value, textContent }
const fbCalls = [];  // llamadas a updateGpsPlayerMapEntries
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, setTimeout,
    document: { getElementById: id => inputs[id] || null },
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } },
    window: { firebaseSync: null, _devMode: false },
    AppConfirm: { answer: true, calls: [], show(o) { this.calls.push(o); return Promise.resolve(this.answer); } },
    AppAlert: { show() {} },
    esc: s => String(s),
});
vm.runInContext('function RPETracker() {}', ctx);
['gps-tracking.js', 'app-players.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx));

function makeTracker(map) {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = [
        { id: 'p1', name: 'Kristin Williams', number: '5' },
        { id: 'p2', name: 'Matilda Ekh', number: '9' },
    ];
    T.sessions = [];
    T.gpsPlayerMap = Object.assign({}, map || {});
    T.toasts = [];
    T.showToast = (m, t) => T.toasts.push([m, t]);
    T.savePlayers = () => { T.playersSaved = (T.playersSaved || 0) + 1; };
    T.renderPlayers = T.renderSessions = T.populatePlayerSelects = () => {};
    T.closeModal = id => { T.closed = id; };
    return T;
}
function setupFirebase() {
    fbCalls.length = 0;
    ctx.window.firebaseSync = {
        updateGpsPlayerMapEntries(entries, full) { fbCalls.push({ entries, full: Object.assign({}, full) }); return Promise.resolve(); },
    };
}
function setupForm(values) {
    Object.keys(inputs).forEach(k => delete inputs[k]);
    Object.entries(values).forEach(([k, v]) => { inputs[k] = { value: v, textContent: '' }; });
}
const flush = () => new Promise(r => setTimeout(r, 0));
const baseForm = (extra) => Object.assign({
    editPlayerId: 'p1', editPlayerName: 'Kristin Williams', editPlayerNumber: '5',
    editPlayerColor: '#123456', editAcThresholdLow: '', editAcThresholdOpt: '', editAcThresholdHigh: '',
}, extra || {});

console.log('\nLectura del ID');
test('getOliIdForPlayer devuelve el ID de la jugadora (búsqueda inversa)', () => {
    const T = makeTracker({ '47162': 'p1', '47164': 'p2' });
    assert.strictEqual(T.getOliIdForPlayer('p1'), '47162');
    assert.strictEqual(T.getOliIdForPlayer('p2'), '47164');
});
test('sin ID devuelve cadena vacía', () => {
    const T = makeTracker({});
    assert.strictEqual(T.getOliIdForPlayer('p1'), '');
    assert.deepStrictEqual(T.getOliIdsForPlayer('p1'), []);
});
test('con varios ID asociados los devuelve todos, ordenados', () => {
    const T = makeTracker({ '50': 'p1', '47162': 'p1' });
    assert.deepStrictEqual(T.getOliIdsForPlayer('p1'), ['47162', '50']);
});

console.log('\nValidación');
test('vacío es válido (quitar el ID)', () => {
    const T = makeTracker();
    assert.deepStrictEqual(JSON.parse(JSON.stringify(T.validateOliId('   '))), { ok: true, value: '' });
});
test('acepta números y recorta espacios', () => {
    assert.strictEqual(makeTracker().validateOliId(' 47162 ').value, '47162');
});
test('rechaza caracteres que Firebase no admite en una clave', () => {
    const T = makeTracker();
    ['47.162', 'a/b', 'a$b', 'a#b', 'a[1]', 'x'.repeat(31), 'con espacio'].forEach(bad =>
        assert.strictEqual(T.validateOliId(bad).ok, false, bad));
});

console.log('\nAsignar / quitar / reasignar');
test('asignar un ID nuevo escribe solo esa clave (update, no set del nodo)', () => {
    setupFirebase();
    const T = makeTracker({ '47164': 'p2' });
    assert.strictEqual(T.setOliIdForPlayer('p1', '47162'), true);
    assert.strictEqual(T.gpsPlayerMap['47162'], 'p1');
    assert.strictEqual(fbCalls.length, 1);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(fbCalls[0].entries)), { '47162': 'p1' });
    assert.strictEqual(fbCalls[0].full['47164'], 'p2', 'no debe perder el de otra jugadora');
});
test('cambiar el ID borra el anterior (queda uno solo)', () => {
    setupFirebase();
    const T = makeTracker({ '111': 'p1' });
    T.setOliIdForPlayer('p1', '222');
    assert.deepStrictEqual(Object.keys(T.gpsPlayerMap), ['222']);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(fbCalls[0].entries)), { '111': null, '222': 'p1' });
});
test('vaciar el campo quita el ID', () => {
    setupFirebase();
    const T = makeTracker({ '111': 'p1', '47164': 'p2' });
    T.setOliIdForPlayer('p1', '');
    assert.deepStrictEqual(Object.keys(T.gpsPlayerMap), ['47164']);
    assert.deepStrictEqual(JSON.parse(JSON.stringify(fbCalls[0].entries)), { '111': null });
});
test('asignar el mismo ID que ya tiene no escribe nada', () => {
    setupFirebase();
    const T = makeTracker({ '111': 'p1' });
    assert.strictEqual(T.setOliIdForPlayer('p1', '111'), false);
    assert.strictEqual(fbCalls.length, 0);
});
test('findOliIdOwner detecta que el ID es de otra jugadora', () => {
    const T = makeTracker({ '47164': 'p2' });
    assert.strictEqual(T.findOliIdOwner('47164', 'p1').name, 'Matilda Ekh');
    assert.strictEqual(T.findOliIdOwner('47164', 'p2'), null);
    assert.strictEqual(T.findOliIdOwner('999', 'p1'), null);
});
test('sin Firebase se guarda en localStorage', () => {
    ctx.window.firebaseSync = null;
    const T = makeTracker({});
    T.setOliIdForPlayer('p1', '47162');
    assert.deepStrictEqual(JSON.parse(ctx.localStorage.getItem('basketballGpsPlayerMap')), { '47162': 'p1' });
});

console.log('\nFormulario de edición');
test('editPlayer rellena el campo con el ID actual', () => {
    const T = makeTracker({ '47162': 'p1' });
    setupForm({ editPlayerId: '', editPlayerName: '', editPlayerNumber: '', editAcThresholdLow: '', editAcThresholdOpt: '',
        editAcThresholdHigh: '', editPlayerOliId: '', editPlayerOliIdHint: '', editPlayerColor: '' });
    inputs.editPlayerModal = { classList: { add() {} } };
    ctx.trapFocus = () => () => {};
    ctx.PlayerTokens = { get: () => '#abc', PALETTE: ['#abc'] };
    T._renderColorPicker = () => {};
    T.editPlayer('p1');
    assert.strictEqual(inputs.editPlayerOliId.value, '47162');
});
test('guardar sin tocar el campo NO cambia el mapeo', () => {
    setupFirebase();
    const T = makeTracker({ '47162': 'p1', '50': 'p1' });   // dos ID: no debe borrar ninguno
    T._editOliInitial = '47162';
    setupForm(baseForm({ editPlayerOliId: '47162' }));
    T.handleEditPlayerSubmit({ preventDefault() {} });
    assert.strictEqual(fbCalls.length, 0);
    assert.deepStrictEqual(T.getOliIdsForPlayer('p1'), ['47162', '50']);
    assert.strictEqual(T.playersSaved, 1);
});
test('escribir un ID a mano lo guarda con la jugadora', () => {
    setupFirebase();
    const T = makeTracker({});
    T._editOliInitial = '';
    setupForm(baseForm({ editPlayerOliId: ' 47162 ' }));
    T.handleEditPlayerSubmit({ preventDefault() {} });
    assert.strictEqual(T.getOliIdForPlayer('p1'), '47162');
    assert.strictEqual(T.closed, 'editPlayerModal');
});
test('un ID inválido avisa y NO guarda nada (ni nombre ni mapeo)', () => {
    setupFirebase();
    const T = makeTracker({});
    T._editOliInitial = '';
    setupForm(baseForm({ editPlayerName: 'Nombre cambiado', editPlayerOliId: '47.162' }));
    T.handleEditPlayerSubmit({ preventDefault() {} });
    assert.strictEqual(T.toasts[0][1], 'error');
    assert.strictEqual(T.playersSaved, undefined);
    assert.strictEqual(T.players[0].name, 'Kristin Williams');
    assert.strictEqual(fbCalls.length, 0);
});
test('ID de otra jugadora: pide confirmación y, si acepta, lo reasigna', async () => {
    setupFirebase();
    ctx.AppConfirm.answer = true; ctx.AppConfirm.calls.length = 0;
    const T = makeTracker({ '47164': 'p2' });
    T._editOliInitial = '';
    setupForm(baseForm({ editPlayerOliId: '47164' }));
    T.handleEditPlayerSubmit({ preventDefault() {} });
    assert.strictEqual(ctx.AppConfirm.calls.length, 1);
    assert.strictEqual(T.playersSaved, undefined, 'no debe guardar antes de confirmar');
    await flush();
    assert.strictEqual(T.getOliIdForPlayer('p1'), '47164');
    assert.strictEqual(T.getOliIdForPlayer('p2'), '');
    assert.strictEqual(T.playersSaved, 1);
});
test('ID de otra jugadora: si cancela no cambia nada', async () => {
    setupFirebase();
    ctx.AppConfirm.answer = false;
    const T = makeTracker({ '47164': 'p2' });
    T._editOliInitial = '';
    setupForm(baseForm({ editPlayerOliId: '47164' }));
    T.handleEditPlayerSubmit({ preventDefault() {} });
    await flush();
    assert.strictEqual(T.getOliIdForPlayer('p2'), '47164');
    assert.strictEqual(T.playersSaved, undefined);
    ctx.AppConfirm.answer = true;
});
test('si el campo no existe en el HTML (caché antigua) no se toca el mapeo', () => {
    setupFirebase();
    const T = makeTracker({ '47162': 'p1' });
    setupForm(baseForm());   // sin editPlayerOliId
    T.handleEditPlayerSubmit({ preventDefault() {} });
    assert.strictEqual(T.getOliIdForPlayer('p1'), '47162');
    assert.strictEqual(fbCalls.length, 0);
});

console.log('\nAprendizaje automático al importar GPS');
test('el ID se aprende al confirmar, aunque la jugadora no tenga sesión ese día', () => {
    ctx.window.firebaseSync = { saveGpsPlayerMap() { return Promise.resolve(); } };
    const T = makeTracker({});
    T.gpsData = {};
    T.saveGpsData = () => {};
    T.currentSessionId = null;
    // p1 tiene sesión ese día; p2 no
    T.sessions = [{ id: 's1', playerId: 'p1', date: '2026-09-26T10:00:00', timeOfDay: 'morning', type: 'training' }];
    T._pendingGpsImport = {
        sessionGroupId: 's1',
        matched: [
            { player: T.players[0], record: { oliPlayerId: '47162', oliPlayerName: 'Kristin Williams' } },
            { player: T.players[1], record: { oliPlayerId: '47164', oliPlayerName: 'Matilda Ekh' } },
        ],
        unmatched: [],
    };
    setupForm({});
    inputs.gpsImportModal = { classList: { remove() {} } };
    inputs['gpsMatchSelect-0'] = { value: 'p1' };
    inputs['gpsMatchSelect-1'] = { value: 'p2' };
    T._confirmGpsImport('s1');
    assert.strictEqual(T.gpsPlayerMap['47162'], 'p1');
    assert.strictEqual(T.gpsPlayerMap['47164'], 'p2', 'ID de la jugadora sin sesión también aprendido');
    assert.ok(T.gpsData['s1'] && T.gpsData['s1']['p1'], 'el GPS de p1 sí se guarda');
    assert.ok(!(T.gpsData['s1'] && T.gpsData['s1']['p2']), 'el GPS de p2 NO se guarda (no tiene sesión)');
});
test('una fila ignorada en el desplegable no aprende ningún ID', () => {
    ctx.window.firebaseSync = { saveGpsPlayerMap() { return Promise.resolve(); } };
    const T = makeTracker({});
    T.gpsData = {}; T.saveGpsData = () => {};
    T.sessions = [{ id: 's1', playerId: 'p1', date: '2026-09-26T10:00:00', timeOfDay: 'morning', type: 'training' }];
    T._pendingGpsImport = { sessionGroupId: 's1',
        matched: [{ player: T.players[0], record: { oliPlayerId: '47162', oliPlayerName: 'K' } }], unmatched: [] };
    setupForm({});
    inputs.gpsImportModal = { classList: { remove() {} } };
    inputs['gpsMatchSelect-0'] = { value: '' };
    T._confirmGpsImport('s1');
    assert.deepStrictEqual(Object.keys(T.gpsPlayerMap), []);
});

(async () => {
    let passed = 0, failed = 0;
    for (const { name, fn } of pending) {
        try { await fn(); passed++; console.log('  ✓ ' + name); }
        catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
    }
    console.log(`\n${passed} pasan, ${failed} fallan`);
    process.exit(failed ? 1 : 0);
})();

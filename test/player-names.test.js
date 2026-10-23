// test/player-names.test.js
// Nombre + apellido de las jugadoras (fase 1): campo `lastName` en la ficha, nombre completo como
// identificador externo (CSV de Oli y export al fisio) y revisión de nombres de las fichas existentes.
// Ejecutar con:  node test/player-names.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pending = [];
function test(name, fn) { pending.push({ name, fn }); }

const inputs = {};   // id -> { value, textContent, remove }
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, setTimeout,
    document: { getElementById: id => inputs[id] || null },
    localStorage: { _d: {}, getItem(k) { return this._d[k] || null; }, setItem(k, v) { this._d[k] = v; } },
    window: { firebaseSync: null, _devMode: false },
    AppConfirm: { answer: true, calls: [], show(o) { this.calls.push(o); return Promise.resolve(this.answer); } },
    AppAlert: { show() {} },
    PlayerTokens: { PALETTE: ['#111111', '#222222', '#333333', '#444444'], get: p => p.color || '#111111' },
    esc: s => String(s),
    toLocalISODate: d => d.toISOString().slice(0, 10),
    getCurrentSeasonWindowStart: () => '2026-08-01',
});
vm.runInContext('function RPETracker() {}', ctx);
['gps-tracking.js', 'app-players.js', 'export-fisio.js'].forEach(f =>
    vm.runInContext(fs.readFileSync(path.join(__dirname, '..', f), 'utf8'), ctx));
const EF = ctx.window.ExportFisio;
const J = x => JSON.parse(JSON.stringify(x));

function makeTracker(players) {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = players || [];
    T.sessions = [];
    T.toasts = [];
    T.saved = 0;
    T.showToast = (m, t) => T.toasts.push([m, t]);
    T.savePlayers = () => { T.saved++; };
    T.renderPlayers = T.renderSessions = T.populatePlayerSelects = () => {};
    T.closeModal = id => { T.closed = id; };
    return T;
}
function setupForm(values) {
    Object.keys(inputs).forEach(k => delete inputs[k]);
    Object.entries(values).forEach(([k, v]) => { inputs[k] = { value: v, textContent: '', remove() {} }; });
}
const flush = () => new Promise(r => setTimeout(r, 0));

console.log('\nNombre completo y propuesta de separación');
test('playerFullName junta nombre y apellido, sin espacios de más', () => {
    const T = makeTracker();
    assert.strictEqual(T.playerFullName({ name: 'Carla', lastName: 'Mendes Rocha' }), 'Carla Mendes Rocha');
    assert.strictEqual(T.playerFullName({ name: ' Carla ', lastName: '  Mendes   Rocha ' }), 'Carla Mendes Rocha');
});
test('playerFullName sin apellido devuelve solo el nombre (fichas antiguas)', () => {
    const T = makeTracker();
    assert.strictEqual(T.playerFullName({ name: 'Carla Mendes Rocha' }), 'Carla Mendes Rocha');
    assert.strictEqual(T.playerFullName({ name: 'Carla', lastName: '' }), 'Carla');
    assert.strictEqual(T.playerFullName(null), '');
});
test('_splitFullName: primera palabra = nombre, el resto = apellido', () => {
    const T = makeTracker();
    assert.deepStrictEqual(J(T._splitFullName('Carla Mendes Rocha')), { name: 'Carla', lastName: 'Mendes Rocha' });
    assert.deepStrictEqual(J(T._splitFullName('Ingrid Van Dijk')), { name: 'Ingrid', lastName: 'Van Dijk' });
    assert.deepStrictEqual(J(T._splitFullName('  Sara   López ')), { name: 'Sara', lastName: 'López' });
    assert.deepStrictEqual(J(T._splitFullName('Ana')), { name: 'Ana', lastName: '' });
    assert.deepStrictEqual(J(T._splitFullName('')), { name: '', lastName: '' });
});
test('separar y volver a juntar da el mismo texto (no se pierde nada)', () => {
    const T = makeTracker();
    ['Carla Mendes Rocha', 'Ingrid Van Dijk', 'Sara López', 'Ana'].forEach(full => {
        assert.strictEqual(T.playerFullName(T._splitFullName(full)), full);
    });
});
test('_findPlayerByFullName ignora mayúsculas y acentos, y puede excluir a una jugadora', () => {
    const T = makeTracker([{ id: 'p1', name: 'Sara', lastName: 'López' }, { id: 'p2', name: 'Sara', lastName: 'Marín' }]);
    assert.strictEqual(T._findPlayerByFullName('sara LOPEZ').id, 'p1');
    assert.strictEqual(T._findPlayerByFullName('Sara López', 'p1'), null);
    assert.strictEqual(T._findPlayerByFullName('Sara Pérez'), null);
    assert.strictEqual(T._findPlayerByFullName(''), null);
});

console.log('\nAlta de jugadora');
test('guarda el apellido en la ficha', () => {
    const T = makeTracker();
    setupForm({ playerName: 'Carla', playerLastName: ' Mendes Rocha ', playerNumber: '7', playerColor: '#111111' });
    T.handlePlayerSubmit({ preventDefault() {} });
    assert.strictEqual(T.players.length, 1);
    assert.strictEqual(T.players[0].name, 'Carla');
    assert.strictEqual(T.players[0].lastName, 'Mendes Rocha');
    assert.strictEqual(T.saved, 1);
});
test('el apellido es opcional (queda vacío)', () => {
    const T = makeTracker();
    setupForm({ playerName: 'Carla', playerLastName: '', playerNumber: '', playerColor: '#111111' });
    T.handlePlayerSubmit({ preventDefault() {} });
    assert.strictEqual(T.players[0].lastName, '');
});
test('dos jugadoras con el mismo nombre pero distinto apellido NO son duplicado', () => {
    const T = makeTracker([{ id: 'p1', name: 'Sara', lastName: 'López' }]);
    ctx.AppConfirm.calls.length = 0;
    setupForm({ playerName: 'Sara', playerLastName: 'Marín', playerNumber: '', playerColor: '#111111' });
    T.handlePlayerSubmit({ preventDefault() {} });
    assert.strictEqual(T.players.length, 2);
    assert.strictEqual(ctx.AppConfirm.calls.length, 0, 'no debe preguntar por duplicado');
});
test('mismo nombre y apellido sí avisa de duplicado y respeta la respuesta', async () => {
    const T = makeTracker([{ id: 'p1', name: 'Sara', lastName: 'López' }]);
    ctx.AppConfirm.calls.length = 0;
    ctx.AppConfirm.answer = false;
    setupForm({ playerName: 'sara', playerLastName: 'LOPEZ', playerNumber: '', playerColor: '#111111' });
    T.handlePlayerSubmit({ preventDefault() {} });
    await flush();
    assert.strictEqual(ctx.AppConfirm.calls.length, 1);
    assert.ok(ctx.AppConfirm.calls[0].message.includes('Sara López'));
    assert.strictEqual(T.players.length, 1, 'cancelado: no se añade');
    ctx.AppConfirm.answer = true;
});

console.log('\nEdición de jugadora');
const editForm = (extra) => Object.assign({
    editPlayerId: 'p1', editPlayerName: 'Sara', editPlayerLastName: 'López', editPlayerNumber: '5',
    editPlayerColor: '#123456', editAcThresholdLow: '', editAcThresholdOpt: '', editAcThresholdHigh: '',
}, extra || {});
test('editPlayer carga el apellido en el formulario', () => {
    const T = makeTracker([{ id: 'p1', name: 'Sara', lastName: 'López', number: '5' }]);
    setupForm({ editPlayerId: '', editPlayerName: '', editPlayerLastName: '', editPlayerNumber: '',
        editAcThresholdLow: '', editAcThresholdOpt: '', editAcThresholdHigh: '' });
    inputs.editPlayerModal = { classList: { add() {} } };
    T._renderColorPicker = () => {};
    ctx.trapFocus = () => () => {};
    T.editPlayer('p1');
    assert.strictEqual(inputs.editPlayerLastName.value, 'López');
});
test('guardar la edición actualiza el apellido', () => {
    const T = makeTracker([{ id: 'p1', name: 'Sara', lastName: '', number: '5' }]);
    setupForm(editForm({ editPlayerLastName: '  López Ruiz ' }));
    T.handleEditPlayerSubmit({ preventDefault() {} });
    assert.strictEqual(T.players[0].lastName, 'López Ruiz');
    assert.strictEqual(T.saved, 1);
});
test('no deja guardar si el nombre completo coincide con otra jugadora', () => {
    const T = makeTracker([
        { id: 'p1', name: 'Sara', lastName: 'Marín', number: '5' },
        { id: 'p2', name: 'Sara', lastName: 'López', number: '8' },
    ]);
    setupForm(editForm({ editPlayerLastName: 'Lopez' }));
    T.handleEditPlayerSubmit({ preventDefault() {} });
    assert.strictEqual(T.players[0].lastName, 'Marín', 'no cambia nada');
    assert.strictEqual(T.saved, 0);
    assert.ok(T.toasts.some(([m, t]) => t === 'error' && m.includes('Sara López')));
});
test('misma persona con su propio nombre completo no cuenta como duplicado', () => {
    const T = makeTracker([{ id: 'p1', name: 'Sara', lastName: 'López', number: '5' }]);
    setupForm(editForm({ editPlayerNumber: '9' }));
    T.handleEditPlayerSubmit({ preventDefault() {} });
    assert.strictEqual(T.players[0].number, '9');
    assert.strictEqual(T.saved, 1);
});

console.log('\nImportar lista en bloque');
test('separa nombre y apellido, guarda dorsal y omite duplicados por nombre completo', () => {
    const T = makeTracker([{ id: 'p0', name: 'Laura', lastName: 'Gómez' }]);
    setupForm({ bulkImportTextarea: 'Carla Mendes Rocha, 7\nIngrid Van Dijk\nlaura gomez, 3\nAna' });
    T._confirmBulkImportPlayers();
    assert.strictEqual(T.players.length, 4, 'Laura existente + 3 nuevas (la repetida se omite)');
    const carla = T.players.find(p => p.name === 'Carla');
    assert.strictEqual(carla.lastName, 'Mendes Rocha');
    assert.strictEqual(carla.number, '7');
    assert.strictEqual(T.players.find(p => p.name === 'Ingrid').lastName, 'Van Dijk');
    assert.strictEqual(T.players.find(p => p.name === 'Ana').lastName, '');
    assert.ok(T.toasts.some(([m]) => m.includes('omitida') && m.includes('laura gomez')));
});

console.log('\nRevisión de nombres (fichas existentes)');
test('detecta las jugadoras sin apellido', () => {
    const T = makeTracker([{ id: 'p1', name: 'Carla Mendes Rocha' }, { id: 'p2', name: 'Sara', lastName: 'López' }, { id: 'p3', name: 'Ana', lastName: '  ' }]);
    assert.deepStrictEqual(J(T._playersMissingLastName().map(p => p.id)), ['p1', 'p3']);
});
test('aplica la separación y conserva el nombre completo', () => {
    const T = makeTracker([{ id: 'p1', name: 'Carla Mendes Rocha' }, { id: 'p2', name: 'Ingrid Van Dijk' }]);
    const before = T.players.map(p => T.playerFullName(p));
    const r = T._applyPlayerNameReview([
        { id: 'p1', name: 'Carla', lastName: 'Mendes Rocha' },
        { id: 'p2', name: 'Ingrid', lastName: 'Van Dijk' },
    ]);
    assert.deepStrictEqual(J(r), { ok: true, changed: 2 });
    assert.deepStrictEqual(J(T.players.map(p => T.playerFullName(p))), before);
    assert.strictEqual(T.players[0].name, 'Carla');
});
test('permite corregir un nombre compuesto', () => {
    const T = makeTracker([{ id: 'p1', name: 'María José García' }]);
    const r = T._applyPlayerNameReview([{ id: 'p1', name: 'María José', lastName: 'García' }]);
    assert.strictEqual(r.ok, true);
    assert.strictEqual(T.players[0].name, 'María José');
    assert.strictEqual(T.players[0].lastName, 'García');
});
test('sin cambios no cuenta nada', () => {
    const T = makeTracker([{ id: 'p1', name: 'Ana' }]);
    assert.deepStrictEqual(J(T._applyPlayerNameReview([{ id: 'p1', name: 'Ana', lastName: '' }])), { ok: true, changed: 0 });
});
test('rechaza un nombre vacío y no toca nada', () => {
    const T = makeTracker([{ id: 'p1', name: 'Carla Mendes' }]);
    const r = T._applyPlayerNameReview([{ id: 'p1', name: '', lastName: 'Mendes' }]);
    assert.strictEqual(r.ok, false);
    assert.strictEqual(T.players[0].name, 'Carla Mendes');
    assert.strictEqual(T.players[0].lastName, undefined);
});
test('rechaza dos jugadoras con el mismo nombre completo (también contra las ya revisadas)', () => {
    const T = makeTracker([{ id: 'p1', name: 'Sara López' }, { id: 'p2', name: 'Sara', lastName: 'Lopez' }]);
    const r = T._applyPlayerNameReview([{ id: 'p1', name: 'Sara', lastName: 'López' }]);
    assert.strictEqual(r.ok, false);
    assert.ok(r.error.includes('mismo nombre'));
    assert.strictEqual(T.players[0].name, 'Sara López', 'no cambia nada');
});

console.log('\nCSV de Oli: emparejado por nombre completo');
test('Oli escribe el nombre completo y la ficha tiene nombre + apellido → exacto', () => {
    const T = makeTracker([{ id: 'p1', name: 'Carla', lastName: 'Mendes Rocha' }, { id: 'p2', name: 'Ingrid', lastName: 'Van Dijk' }]);
    assert.deepStrictEqual(J(T._matchGpsPlayerByName('Carla Mendes Rocha')).confidence, 'exact');
    assert.strictEqual(T._matchGpsPlayerByName('Carla Mendes Rocha').player.id, 'p1');
    assert.strictEqual(T._matchGpsPlayerByName('INGRID VAN DIJK').player.id, 'p2');
});
test('mismo apellido, distinto nombre: cada una con la suya', () => {
    const T = makeTracker([{ id: 'p1', name: 'Marta', lastName: 'Ferrer' }, { id: 'p2', name: 'Lucía', lastName: 'Ferrer' }]);
    assert.strictEqual(T._matchGpsPlayerByName('Lucía Ferrer').player.id, 'p2');
    assert.strictEqual(T._matchGpsPlayerByName('Marta Ferrer').player.id, 'p1');
});
test('fichas antiguas con el nombre completo en `name` siguen emparejando igual que antes', () => {
    const T = makeTracker([{ id: 'p1', name: 'Carla Mendes Rocha' }]);
    assert.strictEqual(T._matchGpsPlayerByName('Carla Mendes Rocha').confidence, 'exact');
});
test('ficha dividida o sin dividir da el mismo resultado de emparejado', () => {
    const joined = makeTracker([{ id: 'p1', name: 'Carla Mendes Rocha' }]);
    const split = makeTracker([{ id: 'p1', name: 'Carla', lastName: 'Mendes Rocha' }]);
    ['Carla Mendes Rocha', 'Carla Mendes', 'Otra Persona'].forEach(oli => {
        const a = joined._matchGpsPlayerByName(oli), b = split._matchGpsPlayerByName(oli);
        assert.strictEqual(a.confidence, b.confidence, oli);
        assert.strictEqual(a.player && a.player.id, b.player && b.player.id, oli);
    });
});

console.log('\nExport al fisio: la columna Jugadora no cambia al separar el nombre');
const ses = (playerId) => ({ id: playerId + 'a', playerId, date: '2026-09-29T10:00:00', timeOfDay: 'morning', type: 'training', rpe: 6 });
const runExport = (players) => EF.construir({
    players, sessions: [ses('p1'), ses('p2')], wellness: [], gpsPlayerMap: { '47162': 'p1' },
    desde: '2026-09-28', hasta: '2026-10-04',
});
test('nombre completo en `name` o dividido en name + lastName → misma Jugadora', () => {
    const joined = runExport([{ id: 'p1', name: 'Carla Mendes Rocha' }, { id: 'p2', name: 'Ana Sin Id' }]);
    const split = runExport([{ id: 'p1', name: 'Carla', lastName: 'Mendes Rocha' }, { id: 'p2', name: 'Ana', lastName: 'Sin Id' }]);
    assert.deepStrictEqual(J(split.rpe.map(r => r.Jugadora)), J(joined.rpe.map(r => r.Jugadora)));
    assert.deepStrictEqual(J(split.rpe.map(r => r.Jugadora)), ['Ana Sin Id', 'Carla Mendes Rocha']);
});
test('el ID Oliver sigue saliendo igual (se retira en una fase posterior)', () => {
    const r = runExport([{ id: 'p1', name: 'Carla', lastName: 'Mendes Rocha' }, { id: 'p2', name: 'Ana', lastName: 'Sin Id' }]);
    assert.strictEqual(r.rpe.find(x => x.Jugadora === 'Carla Mendes Rocha')['ID Oliver'], '47162');
    assert.strictEqual(r.rpe.find(x => x.Jugadora === 'Ana Sin Id')['ID Oliver'], '');
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

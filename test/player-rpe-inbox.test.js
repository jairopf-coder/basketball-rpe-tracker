// test/player-rpe-inbox.test.js
// Bandeja de "RPE de jugadoras pendientes": los RPE que envían las jugadoras
// NO crean sesiones solos; el staff los añade (con minutos) o los descarta.
// Ejecutar con:  node test/player-rpe-inbox.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }

const inputs = {};            // id -> { value }
const fbWrites = [];          // { path, data }
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, isNaN, Promise, setTimeout,
    document: { getElementById: id => inputs[id] || null },
    window: { firebaseDB: { ref: p => ({ update: d => { fbWrites.push({ path: p, data: d }); return Promise.resolve(); }, on() {} }) }, _devMode: false },
    Store: { getActiveSeason: () => '2026-27' },
    esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    AppConfirm: { answer: true, show() { return Promise.resolve(this.answer); } },
    getCurrentSeasonWindowStart: () => '2026-08-01',
});
vm.runInContext('function RPETracker() {}', ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'app-sessions.js'), 'utf8'), ctx);

function makeTracker() {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = [
        { id: 'p1', name: 'Ana', authUid: 'uA' },
        { id: 'p2', name: 'Bea', authUid: 'uB' },
    ];
    T.sessions = [];
    T.currentView = 'other';
    T.toasts = [];
    T.showToast = (m, t) => T.toasts.push([m, t]);
    T.saveSessions = () => { T.saved = (T.saved || 0) + 1; };
    T.renderSessions = () => {};
    T.getRPEColor = v => '#c' + v;
    return T;
}
const entry = (uid, date, sessionType, rpe, extra) => Object.assign(
    { uid, date, sessionType, rpe, _path: `playerRpeReports/${uid}/${date}/${sessionType}` }, extra || {});

console.log('\nClasificación (sin crear sesiones)');
test('un RPE de jugadora NO crea ninguna sesión: queda pendiente', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7)]);
    assert.strictEqual(T.sessions.length, 0, 'se ha creado una sesión sola');
    const a = T._analyzePlayerRpe();
    assert.strictEqual(a.pending.length, 1);
    assert.strictEqual(a.pending[0].playerName, 'Ana');
    assert.strictEqual(a.pending[0].type, 'match');
    assert.ok(!T.sessions.some(s => String(s.id).startsWith('wpr_')));
});
test('si el staff ya registró esa sesión, NO está pendiente', () => {
    const T = makeTracker();
    T.sessions = [{ id: 's1', playerId: 'p1', date: '2026-09-27T10:00:00', timeOfDay: 'morning', type: 'match', rpe: 7, duration: 20, load: 140 }];
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7)]);
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 0);
    assert.strictEqual(T._rpeDiscrepancies.length, 0);
});
test('RPE distinto al del staff → aviso de discrepancia, sin pendiente ni cambios', () => {
    const T = makeTracker();
    T.sessions = [{ id: 's1', playerId: 'p1', date: '2026-09-27T10:00:00', timeOfDay: 'morning', type: 'match', rpe: 5, duration: 20, load: 100 }];
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 8)]);
    assert.strictEqual(T._rpeDiscrepancies.length, 1);
    assert.strictEqual(T._rpeDiscrepancies[0].staffRpe, 5);
    assert.strictEqual(T._rpeDiscrepancies[0].playerRpe, 8);
    assert.strictEqual(T.sessions[0].rpe, 5, 'no debe sobrescribir la sesión del staff');
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 0);
});
test('RPE marcado como revisado no vuelve a salir', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7, { reviewed: true })]);
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 0);
});
test('cuenta sin vincular → lista aparte (antes se perdía en silencio)', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uZ', '2026-09-27', 'morning', 6)]);
    const a = T._analyzePlayerRpe();
    assert.strictEqual(a.pending.length, 0); assert.strictEqual(a.unlinked.length, 1);
    assert.ok(T._renderPlayerRpeInbox().includes('sin vincular'));
});
test('RPE anteriores al inicio de temporada se ignoran', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-03-10', 'morning', 6)]);
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 0);
});
test('el orden de llegada no importa: si las sesiones llegan después, deja de estar pendiente', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'morning', 6)]);
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 1);
    T.sessions = [{ id: 's9', playerId: 'p1', date: '2026-09-27T10:00:00', timeOfDay: 'morning', type: 'training', rpe: 6, duration: 60, load: 360 }];
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 0);
});
test('lista vacía de RPE no rompe (y limpia lo anterior)', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'morning', 6)]);
    T._applyPlayerRpeEntries([]);
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 0);
    assert.strictEqual(T._renderPlayerRpeInbox(), '');
});

console.log('\nAñadir con minutos personalizados');
test('cada jugadora con SUS minutos: 2 sesiones, carga = RPE × minutos de cada una', () => {
    const T = makeTracker(); fbWrites.length = 0;
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7), entry('uB', '2026-09-27', 'match', 5)]);
    const [a, b] = T._analyzePlayerRpe().pending; // ordenadas por nombre: Ana, Bea
    inputs[T._priInputId(a.key)] = { value: '32' };
    inputs[T._priInputId(b.key)] = { value: '8' };
    T.addPendingPlayerRpe(a.key); T.addPendingPlayerRpe(b.key);
    assert.strictEqual(T.sessions.length, 2);
    const sa = T.sessions.find(s => s.playerId === 'p1'), sb = T.sessions.find(s => s.playerId === 'p2');
    assert.strictEqual(sa.duration, 32); assert.strictEqual(sa.load, 7 * 32);
    assert.strictEqual(sb.duration, 8);  assert.strictEqual(sb.load, 5 * 8);
    assert.strictEqual(sa.type, 'match'); assert.strictEqual(sa.date, '2026-09-27T10:00:00');
    assert.strictEqual(sa.season, '2026-27'); assert.strictEqual(sa.notes, '');
    assert.notStrictEqual(sa.id, sb.id, 'ids repetidos');
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 0);
});
test('la sesión creada tiene el mismo formato que las del staff (mismos campos)', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-09-28', 'afternoon', 6)]);
    const it = T._analyzePlayerRpe().pending[0];
    inputs[T._priInputId(it.key)] = { value: '75' };
    T.addPendingPlayerRpe(it.key);
    const s = T.sessions[0];
    assert.deepStrictEqual(Object.keys(s).sort(), ['date','duration','id','load','notes','playerId','rpe','season','timeOfDay','type']);
    assert.strictEqual(s.date, '2026-09-28T18:00:00'); assert.strictEqual(s.timeOfDay, 'afternoon'); assert.strictEqual(s.type, 'training');
    assert.ok(!('source' in s));
});
test('marca el RPE como revisado en Firebase al añadirlo', () => {
    const T = makeTracker(); fbWrites.length = 0;
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7)]);
    const it = T._analyzePlayerRpe().pending[0];
    inputs[T._priInputId(it.key)] = { value: '20' };
    T.addPendingPlayerRpe(it.key);
    assert.strictEqual(fbWrites.length, 1);
    assert.strictEqual(fbWrites[0].path, 'playerRpeReports/uA/2026-09-27/match');
    assert.strictEqual(fbWrites[0].data.reviewed, true);
});
test('si luego editas la sesión (cambia el turno) el RPE NO reaparece', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7)]);
    const it = T._analyzePlayerRpe().pending[0];
    inputs[T._priInputId(it.key)] = { value: '20' };
    T.addPendingPlayerRpe(it.key);
    T.sessions[0].timeOfDay = 'afternoon'; // el staff la edita
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 0);
});
test('sin minutos, o minutos absurdos → no crea sesión y avisa', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7)]);
    const it = T._analyzePlayerRpe().pending[0];
    for (const bad of ['', '0', '-5', '301', 'abc']) {
        inputs[T._priInputId(it.key)] = { value: bad, focus() {} };
        T.addPendingPlayerRpe(it.key);
    }
    assert.strictEqual(T.sessions.length, 0);
    assert.strictEqual(T.toasts.length, 5);
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 1, 'debe seguir pendiente');
});
test('pulsar Añadir dos veces no duplica la sesión', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7)]);
    const it = T._analyzePlayerRpe().pending[0];
    inputs[T._priInputId(it.key)] = { value: '20' };
    T.addPendingPlayerRpe(it.key); T.addPendingPlayerRpe(it.key);
    assert.strictEqual(T.sessions.length, 1);
});
test('los minutos escritos se conservan si Inicio se repinta', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7)]);
    const it = T._analyzePlayerRpe().pending[0];
    T._priSetMinutes(it.key, '25');
    assert.ok(T._renderPlayerRpeInbox().includes('value="25"'));
});

console.log('\nDescartar');
test('descartar (confirmado) no crea sesión y lo marca revisado', async () => {
    const T = makeTracker(); fbWrites.length = 0; ctx.AppConfirm.answer = true;
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7)]);
    const it = T._analyzePlayerRpe().pending[0];
    T.dismissPendingPlayerRpe(it.key);
    await new Promise(r => setTimeout(r, 0));
    assert.strictEqual(T.sessions.length, 0);
    assert.strictEqual(fbWrites.length, 1);
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 0);
});
test('descartar cancelado no hace nada', async () => {
    const T = makeTracker(); fbWrites.length = 0; ctx.AppConfirm.answer = false;
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7)]);
    T.dismissPendingPlayerRpe(T._analyzePlayerRpe().pending[0].key);
    await new Promise(r => setTimeout(r, 0));
    assert.strictEqual(fbWrites.length, 0);
    assert.strictEqual(T._analyzePlayerRpe().pending.length, 1);
    ctx.AppConfirm.answer = true;
});

console.log('\nTarjeta');
test('la tarjeta agrupa por día/turno y muestra nombre, RPE, minutos y botones', () => {
    const T = makeTracker();
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7), entry('uB', '2026-09-27', 'match', 5)]);
    const h = T._renderPlayerRpeInbox();
    assert.ok(h.includes('RPE de jugadoras pendientes'));
    assert.ok(h.includes('Ana') && h.includes('Bea') && h.includes('RPE 7') && h.includes('RPE 5'));
    assert.ok(h.includes('Partido') && h.includes('class="pri-min"') && h.includes('Añadir'));
    assert.strictEqual((h.match(/class="pri-group"/g) || []).length, 1, 'un solo grupo (mismo día y turno)');
});
test('un nombre con HTML se escapa (no se inyecta código)', () => {
    const T = makeTracker(); T.players[0].name = '<img src=x onerror=alert(1)>';
    T._applyPlayerRpeEntries([entry('uA', '2026-09-27', 'match', 7)]);
    assert.ok(!T._renderPlayerRpeInbox().includes('<img'));
});

(async () => {
    for (const t of pending) {
        try { await t.fn(); console.log(`  ✅ ${t.name}`); passed++; }
        catch (e) { console.log(`  ❌ ${t.name}\n     ${e.message}`); failed++; }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

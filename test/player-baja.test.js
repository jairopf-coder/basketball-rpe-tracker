// test/player-baja.test.js
// Baja de jugadoras (fase 1): `archived` + `archivedAt` (último día con el equipo).
//  • Sigue activa hasta ese día INCLUIDO y desaparece desde el siguiente; las fechas anteriores la siguen contando.
//  • Sus datos no se tocan.
//  • Fuera de los formularios de RPE/sesiones, wellness, «Faltan hoy» y los resúmenes de Inicio.
// Ejecutar con:  node test/player-baja.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const pending = [];
function test(name, fn) { pending.push({ name, fn }); }
const J = x => JSON.parse(JSON.stringify(x));
const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

// Fechas relativas a hoy (el criterio de «activa» depende del día)
const iso = off => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const HOY = iso(0), AYER = iso(-1), MANANA = iso(1), HACE10 = iso(-10);

const els = {};   // id -> elemento simulado
const el = (id, extra) => (els[id] = Object.assign({ value: '', innerHTML: '', textContent: '', style: {}, remove() { delete els[id]; }, querySelector() { return null; } }, extra || {}));
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, setTimeout,
    document: {
        getElementById: id => els[id] || null,
        createElement: () => { const n = { style: {}, setAttribute() {}, appendChild() {}, remove() { if (n.id) delete els[n.id]; } }; return n; },
        head: { appendChild() {} },
        body: { appendChild(n) { if (n.id) els[n.id] = n; } },
    },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    window: { firebaseSync: null },
    AppConfirm: { answer: true, calls: [], show(o) { this.calls.push(o); return Promise.resolve(this.answer); } },
    AppAlert: { show() {} },
    PlayerTokens: { PALETTE: ['#111111'], get: () => '#111111', avatar: () => '<span class="avatar"></span>' },
    esc: s => String(s),
    toLocalISODate: d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'),
    getCurrentSeasonWindowStart: () => '2026-08-01',
});
vm.runInContext('function RPETracker() {}', ctx);
['gps-tracking.js', 'app-players.js', 'injury-management.js', 'app-sessions.js', 'wellness.js', 'dashboard-renderer.js']
    .forEach(f => vm.runInContext(read(f), ctx, { filename: f }));

function makeTracker(players) {
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = players || [];
    T.sessions = []; T.wellnessData = []; T.injuries = [];
    T.toasts = []; T.saved = 0; T.rendered = 0;
    T.showToast = (m, t) => T.toasts.push([m, t]);
    T.savePlayers = () => { T.saved++; };
    T.renderPlayers = T.renderSessions = T.populatePlayerSelects = () => { T.rendered++; };
    return T;
}
const flush = () => new Promise(r => setTimeout(r, 0));
const baja = (id, name, lastName, archivedAt) => ({ id, name, lastName, archived: true, archivedAt });
const alta = (id, name, lastName) => ({ id, name, lastName });
const nombres = list => list.map(p => p.name);

console.log('\nCriterio «activa» por fecha');
test('una jugadora que no está de baja siempre es activa', () => {
    const T = makeTracker([alta('a', 'Carla', 'Mendes')]);
    assert.strictEqual(T.isPlayerActiveOn(T.players[0], HOY), true);
    assert.strictEqual(T.isPlayerActiveOn(T.players[0], '1999-01-01'), true);
});
test('de baja: activa hasta su último día INCLUIDO y fuera desde el siguiente', () => {
    const T = makeTracker([baja('b', 'Ingrid', 'Van Dijk', '2026-10-24')]);
    const b = T.players[0];
    assert.strictEqual(T.isPlayerActiveOn(b, '2026-10-23'), true);
    assert.strictEqual(T.isPlayerActiveOn(b, '2026-10-24'), true, 'su último día todavía cuenta');
    assert.strictEqual(T.isPlayerActiveOn(b, '2026-10-25'), false);
    assert.strictEqual(T.isPlayerActiveOn(b, '2027-01-01'), false);
});
test('acepta fechas con hora (las sesiones guardan AAAA-MM-DDTHH:mm)', () => {
    const T = makeTracker([baja('b', 'Ingrid', 'Van Dijk', '2026-10-24')]);
    assert.strictEqual(T.isPlayerActiveOn(T.players[0], '2026-10-24T18:30:00'), true);
    assert.strictEqual(T.isPlayerActiveOn(T.players[0], '2026-10-25T08:00:00'), false);
});
test('de baja sin fecha (marca puesta a mano): fuera siempre', () => {
    const T = makeTracker([{ id: 'b', name: 'Ingrid', archived: true }]);
    assert.strictEqual(T.isPlayerActiveOn(T.players[0], HACE10), false);
});
test('sin fecha de consulta se usa hoy', () => {
    const T = makeTracker([baja('h', 'Hoy', '', HOY), baja('y', 'Ayer', '', AYER), baja('m', 'Mañana', '', MANANA)]);
    assert.deepStrictEqual(J(nombres(T.activePlayers)), ['Hoy', 'Mañana']);
});
test('activePlayers excluye a las que ya pasaron su último día y no toca this.players', () => {
    const T = makeTracker([alta('a', 'Carla', 'M'), baja('b', 'Ingrid', 'V', AYER), alta('c', 'Marta', 'F')]);
    assert.deepStrictEqual(J(nombres(T.activePlayers)), ['Carla', 'Marta']);
    assert.strictEqual(T.players.length, 3, 'la lista completa (historial) no cambia');
});
test('para fechas anteriores a la baja sigue contándola (el historial no cambia)', () => {
    const T = makeTracker([alta('a', 'Carla', 'M'), baja('b', 'Ingrid', 'V', AYER)]);
    assert.deepStrictEqual(J(nombres(T.getPlayersActiveOn(HACE10))), ['Carla', 'Ingrid']);
    assert.deepStrictEqual(J(nombres(T.getPlayersActiveOn(HOY))), ['Carla']);
});

console.log('\nDar de baja y reactivar');
const abrirFormBaja = (valor) => { el('playerBajaDate', { value: valor }); el('playerBajaError'); el('playerBajaOverlay'); };
test('dar de baja guarda la marca y la fecha, y no toca el resto de la ficha', () => {
    const T = makeTracker([{ id: 'a', name: 'Carla', lastName: 'Mendes', number: '7', color: '#f00', authUid: 'u1' }]);
    abrirFormBaja(AYER);
    T._playerFilterSelected = new Set(['a']);
    T._confirmPlayerBaja('a');
    assert.deepStrictEqual(J(T.players[0]), { id: 'a', name: 'Carla', lastName: 'Mendes', number: '7', color: '#f00', authUid: 'u1', archived: true, archivedAt: AYER });
    assert.strictEqual(T.saved, 1);
    assert.strictEqual(T._playerFilterSelected.has('a'), false, 'se quita del filtro de chips');
    assert.ok(T.toasts.some(([m]) => m.includes('dada de baja') && m.includes('Carla Mendes')));
    assert.ok(!els.playerBajaOverlay, 'el modal se cierra');
});
test('la fecha es obligatoria y no cambia nada si falta', () => {
    const T = makeTracker([alta('a', 'Carla', 'Mendes')]);
    abrirFormBaja('');
    T._confirmPlayerBaja('a');
    assert.strictEqual(T.players[0].archived, undefined);
    assert.strictEqual(T.saved, 0);
    assert.ok(els.playerBajaError.textContent.length > 0 && els.playerBajaError.style.display === 'block');
});
test('dar de baja una jugadora que no existe no hace nada', () => {
    const T = makeTracker([alta('a', 'Carla', 'Mendes')]);
    abrirFormBaja(AYER);
    T._confirmPlayerBaja('zzz');
    assert.strictEqual(T.saved, 0);
});
test('reactivar quita la marca y la fecha', async () => {
    const T = makeTracker([baja('b', 'Ingrid', 'Van Dijk', AYER)]);
    ctx.AppConfirm.answer = true;
    T.reactivatePlayer('b');
    await flush();
    assert.deepStrictEqual(J(T.players[0]), { id: 'b', name: 'Ingrid', lastName: 'Van Dijk', archived: false });
    assert.strictEqual(T.saved, 1);
    assert.deepStrictEqual(J(nombres(T.activePlayers)), ['Ingrid']);
});
test('reactivar cancelado no cambia nada', async () => {
    const T = makeTracker([baja('b', 'Ingrid', 'Van Dijk', AYER)]);
    ctx.AppConfirm.answer = false;
    T.reactivatePlayer('b');
    await flush();
    ctx.AppConfirm.answer = true;
    assert.strictEqual(T.players[0].archived, true);
    assert.strictEqual(T.saved, 0);
});
test('el modal ofrece hoy como fecha por defecto y explica que sus datos se conservan', () => {
    const T = makeTracker([alta('a', 'Carla', 'Mendes')]);
    T.openPlayerBajaModal('a');
    const html = els.playerBajaOverlay.innerHTML;
    assert.ok(html.includes(`value="${HOY}"`));
    assert.ok(html.includes('Carla Mendes') && html.includes('se conservan') && html.includes('Último día con el equipo'));
});

console.log('\nSección «Bajas»');
test('lista las bajas con su último día y un botón Reactivar', () => {
    const T = makeTracker([alta('a', 'Carla', 'Mendes'), baja('b', 'Ingrid', 'Van Dijk', '2026-10-24')]);
    el('playersBajas');
    T._renderPlayersBajas();
    const h = els.playersBajas.innerHTML;
    assert.ok(h.includes('Bajas (1)'));
    assert.ok(h.includes('Ingrid Van Dijk') && !h.includes('Carla'));
    assert.ok(h.includes('Último día: 24/10/2026'));
    assert.ok(h.includes("reactivatePlayer('b')"));
});
test('sin bajas la sección queda vacía', () => {
    const T = makeTracker([alta('a', 'Carla', 'Mendes')]);
    el('playersBajas', { innerHTML: 'basura' });
    T._renderPlayersBajas();
    assert.strictEqual(els.playersBajas.innerHTML, '');
});
test('las bajas más recientes salen primero', () => {
    const T = makeTracker([baja('b1', 'Antigua', 'X', '2026-01-10'), baja('b2', 'Reciente', 'Y', '2026-10-10')]);
    el('playersBajas');
    T._renderPlayersBajas();
    const h = els.playersBajas.innerHTML;
    assert.ok(h.indexOf('Reciente') < h.indexOf('Antigua'));
});
test('la revisión de nombres no pide apellido a quien ya está de baja', () => {
    const T = makeTracker([{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Bea', archived: true, archivedAt: AYER }]);
    assert.deepStrictEqual(J(T._playersMissingLastName().map(p => p.id)), ['a']);
});

console.log('\nRegistro de RPE y sesiones');
test('la fecha de la sesión decide quién aparece: su último día sí, el siguiente no', () => {
    const T = makeTracker([alta('a', 'Carla', 'M'), baja('b', 'Ingrid', 'V', '2026-10-24')]);
    T._sessionParticipation = () => 'in';
    T._newSessionDate = () => '2026-10-24';
    assert.deepStrictEqual(J(T._eligiblePlayerIds()), ['a', 'b']);
    T._newSessionDate = () => '2026-10-25';
    assert.deepStrictEqual(J(T._eligiblePlayerIds()), ['a']);
});
test('se puede registrar una sesión con fecha anterior a la baja y sale ella', () => {
    const T = makeTracker([alta('a', 'Carla', 'M'), baja('b', 'Ingrid', 'V', AYER)]);
    T._sessionParticipation = () => 'in';
    T._newSessionDate = () => HACE10;
    assert.deepStrictEqual(J(T._eligiblePlayerIds()), ['a', 'b']);
});
test('los botones de jugadora de «Nueva sesión» no muestran a quien ya se fue', () => {
    const T = makeTracker([alta('a', 'Carla', 'M'), baja('b', 'Ingrid', 'V', AYER)]);
    T._sessionParticipation = () => 'in';
    T._newSessionDate = () => HOY;
    T.selectedPlayerIds = [];
    el('playerButtons');
    T.renderPlayerButtonsMulti();
    assert.ok(els.playerButtons.innerHTML.includes('Carla'));
    assert.ok(!els.playerButtons.innerHTML.includes('Ingrid'));
});
test('getParticipatingPlayers (medias y planificación) también respeta la fecha', () => {
    const T = makeTracker([alta('a', 'Carla', 'M'), baja('b', 'Ingrid', 'V', '2026-10-24')]);
    T.getPlayerParticipation = () => 'in';
    assert.deepStrictEqual(J(T.getParticipatingPlayers('2026-10-20').map(p => p.id)), ['a', 'b']);
    assert.deepStrictEqual(J(T.getParticipatingPlayers('2026-10-25').map(p => p.id)), ['a']);
});

console.log('\nWellness y «Faltan hoy»');
test('«Faltan hoy»: no se le pide wellness a quien ya no está', () => {
    const T = makeTracker([alta('a', 'Carla', 'M'), baja('b', 'Ingrid', 'V', AYER), baja('c', 'Marta', 'F', HOY)]);
    T.wellnessData = [];
    T.sessions = []; T._playerRpeRaw = {}; T.getPlayerParticipation = () => 'in';
    const r = T._pendingToday();
    assert.deepStrictEqual(J(r.wellness.map(p => p.name)), ['Carla', 'Marta'], 'Marta aún está en su último día; Ingrid no');
});
test('registros de hoy de wellness: solo las activas', () => {
    const T = makeTracker([alta('a', 'Carla', 'M'), baja('b', 'Ingrid', 'V', AYER)]);
    T._wOverall = () => 3; T._wScoreClass = () => ''; T._wScoreColor = () => '#000';
    const html = T._renderWTodayStatus(new Set(), HOY);
    assert.ok(html.includes('Carla'));
    assert.ok(!html.includes('Ingrid'));
    assert.ok(html.includes('1 pendientes'));
});
console.log('\nFase 2: participación, desplegables, planificación e informes');
test('getPlayerParticipation: de baja cuenta como «fuera» desde el día siguiente a su último día', () => {
    const T = makeTracker([baja('b', 'Ingrid', 'V', '2026-10-24'), alta('a', 'Carla', 'M')]);
    T.injuries = []; T.availability = {};
    assert.strictEqual(T.getPlayerParticipation('b', '2026-10-20'), 'full');
    assert.strictEqual(T.getPlayerParticipation('b', '2026-10-24'), 'full', 'su último día participa');
    assert.strictEqual(T.getPlayerParticipation('b', '2026-10-25'), 'out');
    assert.strictEqual(T.getPlayerParticipation('a', '2030-01-01'), 'full');
    assert.strictEqual(T.getPlayerParticipation('desconocida', '2030-01-01'), 'full');
});
test('una lesión de antes de la baja sigue contando como «fuera» ese día (el historial no cambia)', () => {
    const T = makeTracker([baja('b', 'Ingrid', 'V', '2026-10-24')]);
    T.availability = {};
    T.injuries = [{ playerId: 'b', status: 'active', startDate: '2026-10-01', rtpPhase: 2 }];
    assert.strictEqual(T.getPlayerParticipation('b', '2026-10-10'), 'out');
});
test('hasActiveDaysFrom: la semana de su último día la incluye y la siguiente ya no', () => {
    const T = makeTracker([baja('b', 'Ingrid', 'V', '2026-10-24'), alta('a', 'Carla', 'M'), { id: 'x', name: 'X', archived: true }]);
    assert.strictEqual(T.hasActiveDaysFrom(T.players[0], '2026-10-19'), true, 'lunes de su semana (su último día es el sábado)');
    assert.strictEqual(T.hasActiveDaysFrom(T.players[0], '2026-10-24'), true);
    assert.strictEqual(T.hasActiveDaysFrom(T.players[0], '2026-10-26'), false, 'lunes siguiente');
    assert.strictEqual(T.hasActiveDaysFrom(T.players[1], '2099-01-01'), true);
    assert.strictEqual(T.hasActiveDaysFrom(T.players[2], '2026-01-01'), false, 'de baja sin fecha');
});
test('playerOptionsHtml: las activas primero y las de baja en su propio grupo', () => {
    const T = makeTracker([alta('a', 'Carla', 'M'), baja('b', 'Ingrid', 'V', AYER), alta('c', 'Marta', 'F')]);
    const html = T.playerOptionsHtml(p => `<option value="${p.id}">${p.name}</option>`);
    assert.strictEqual(html, '<option value="a">Carla</option><option value="c">Marta</option><optgroup label="De baja"><option value="b">Ingrid</option></optgroup>');
});
test('playerOptionsHtml: sin bajas no hay grupo', () => {
    const T = makeTracker([alta('a', 'Carla', 'M')]);
    assert.strictEqual(T.playerOptionsHtml(p => `<option>${p.name}</option>`), '<option>Carla</option>');
});
test('una baja con el último día de hoy sigue entre las activas del desplegable', () => {
    const T = makeTracker([baja('b', 'Ingrid', 'V', HOY)]);
    assert.ok(!T.playerOptionsHtml(p => p.name).includes('optgroup'));
});
test('los desplegables donde se ELIGE jugadora (lesiones, tests de fuerza, GPS) usan playerOptionsHtml', () => {
    [['injury-management.js', 2], ['strength.js', 1], ['gps-tracking.js', 2]].forEach(([f, n]) => {
        const hits = (read(f).match(/this\.playerOptionsHtml\(/g) || []).length;
        assert.strictEqual(hits, n, `${f} debería usar playerOptionsHtml ${n} veces`);
    });
});
test('Microciclo: la tabla de la semana solo incluye a quien tuvo algún día activo esa semana', () => {
    const src = read('microciclo.js');
    assert.ok(src.includes('const roster = this.players.filter(p => this.hasActiveDaysFrom(p, dayDateStrs[0]));'));
    assert.ok(src.includes('roster.forEach(p => {') && src.includes('roster.filter(p => !outMap[p.id][i])') && src.includes('const tableRows = roster.map('));
});
test('el informe semanal del equipo usa la plantilla de ESA semana (una baja a mitad de semana sale)', () => {
    const body = cuerpo('team-status.js', 'generateWeeklyTeamPDF');
    assert.ok(body.includes('const rosterWeek = this.players.filter(p => this.hasActiveDaysFrom(p, toLocalISODate(monday)));'));
    assert.ok(!/this\.(players|activePlayers)\b/.test(body.replace(/this\.players\.filter\(p => this\.hasActiveDaysFrom[^;]*;/, '').replace(/this\.players\.find\(/g, '')));
});
test('la sección Bajas avisa de que su cuenta de jugadora sigue activa', () => {
    const T = makeTracker([{ id: 'b', name: 'Ingrid', lastName: 'V', archived: true, archivedAt: AYER, authUid: 'u1' }, baja('c', 'Marta', 'F', AYER)]);
    el('playersBajas');
    T._renderPlayersBajas();
    const h = els.playersBajas.innerHTML;
    assert.strictEqual((h.match(/cuenta de jugadora sigue activa/g) || []).length, 1, 'solo la que tiene cuenta');
});
test('el modal de baja avisa de la cuenta de jugadora solo si la tiene', () => {
    const T = makeTracker([{ id: 'a', name: 'Carla', lastName: 'M', authUid: 'u1' }, alta('b', 'Marta', 'F')]);
    T.openPlayerBajaModal('a');
    assert.ok(els.playerBajaOverlay.innerHTML.includes('cuenta de jugadora'));
    T.openPlayerBajaModal('b');
    assert.ok(!els.playerBajaOverlay.innerHTML.includes('cuenta de jugadora'));
});

console.log('\nLo que NO debe cambiar');
test('buscar a una jugadora por id (historial, informes) sigue viendo a las de baja', () => {
    const T = makeTracker([baja('b', 'Ingrid', 'V', HACE10)]);
    assert.strictEqual(T.players.find(p => p.id === 'b').name, 'Ingrid');
    assert.strictEqual(T.activePlayers.length, 0);
});
test('la baja no borra ninguna sesión ni wellness', () => {
    const T = makeTracker([alta('b', 'Ingrid', 'V')]);
    T.sessions = [{ id: 's', playerId: 'b', date: HACE10 + 'T10:00:00', rpe: 6 }];
    T.wellnessData = [{ playerId: 'b', date: HACE10, sleep: 4 }];
    abrirFormBaja(AYER);
    T._confirmPlayerBaja('b');
    assert.strictEqual(T.sessions.length, 1);
    assert.strictEqual(T.wellnessData.length, 1);
});
// Cuerpo de una función `RPETracker.prototype.NOMBRE = function` o de un método de clase `NOMBRE() {`
function cuerpo(file, nombre) {
    const L = read(file).split('\n');
    const ini = L.findIndex(l => l.startsWith(`RPETracker.prototype.${nombre} = function`) || new RegExp(`^    ${nombre}\\(.*\\) \\{$`).test(l));
    assert.ok(ini >= 0, `no se encuentra ${nombre} en ${file}`);
    const cierre = L[ini].startsWith('RPETracker') ? '};' : '    }';
    let fin = ini + 1;
    while (fin < L.length && L[fin] !== cierre) fin++;
    return L.slice(ini, fin + 1).join('\n');
}
test('las pantallas de registro y los resúmenes de Inicio solo listan jugadoras activas', () => {
    // Estas funciones listan o cuentan jugadoras «de hoy». Si alguien vuelve a escribir this.players aquí,
    // la jugadora de baja reaparecería. Buscar por id (this.players.find) sí está permitido.
    const funciones = [
        ['wellness.js', '_renderWTodayStatus'], ['wellness.js', '_renderWModal'], ['wellness.js', 'openWellnessBulk'],
        ['wellness.js', 'openWellnessQuick'], ['wellness.js', 'saveWellnessQuick'],
        ['dashboard-renderer.js', 'renderDashboard'], ['dashboard-renderer.js', '_pendingToday'],
        ['dashboard-renderer.js', '_renderRightWidgets'], ['dashboard-renderer.js', 'renderTeamRatios'],
        ['dashboard-comparison.js', '_renderPlayerComparisonSection'],
        ['app-sessions.js', 'openNewSessionModal'], ['app-sessions.js', '_eligiblePlayerIds'], ['app-sessions.js', 'renderPlayerButtonsMulti'],
        ['app.js', 'checkAndShowAlerts'], ['app.js', '_updateNavAlertBadge'],
        // Fase 2
        ['team-status.js', 'renderTeamStatus'],
        ['weekplan-medical.js', '_renderProjectedACRow'], ['weekplan-medical.js', '_plannedWeekLoad'],
        ['weekplan-medical.js', '_plannedWeekSessions'], ['weekplan-medical.js', '_getRehabLoadData'],
        ['strength.js', 'renderGymView'], ['strength.js', '_openNewGymSession'], ['strength.js', 'renderTestsView'],
        ['app-presession.js', '_renderPreSessionModal'], ['app-presession.js', '_renderSemaphoreBar'],
        ['injury-management-2.js', 'renderAvailabilityTable'],
        ['injury-prediction.js', 'renderInjuryPredictionDashboard'], ['injury-prediction.js', '_predSelectAll'],
        ['calendar.js', 'getWeeklySummary'],
    ];
    funciones.forEach(([f, n]) => {
        const sinBusquedas = cuerpo(f, n).replace(/this\.players\.find\(/g, '');
        assert.ok(!/this\.players\b/.test(sinBusquedas), `${f} → ${n} lista this.players: debe usar this.activePlayers o getPlayersActiveOn(fecha)`);
    });
});
test('el historial y las exportaciones siguen usando todas las jugadoras', () => {
    // Datos históricos: la jugadora de baja debe seguir en ellos
    assert.ok(/this\.players\.forEach\(player => \{\s*\n\s*const playerSessions/.test(read('app.js')), 'el CSV de resumen por jugadora lista this.players');
    assert.ok(/_renderWPlayerTable = function\(\) \{\s*\n\s*if \(!this\.players\.length\)/.test(read('wellness.js')), 'la tabla de wellness por rango usa this.players');
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

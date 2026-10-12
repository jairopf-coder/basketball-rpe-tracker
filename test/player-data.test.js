// ============================================================
//  test/player-data.test.js
//  Eliminación completa de los datos de una jugadora (player-data.js):
//   inventario, copia JSON, borrado (solo staff), no tocar a otras jugadoras,
//   fallos parciales con reintento, limpieza de memoria local y flujo de confirmaciones.
//  También: AppConfirm.matches (confirmar escribiendo el nombre) y la corrección de la
//  fusión del histórico de sesiones en app.js.
//  Uso:  node test/player-data.test.js
// ============================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
const plano = clone;   // normaliza arrays/objetos creados dentro de vm antes de compararlos

// ---------- Firebase falso (un solo árbol) ----------
function prune(v) {
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v)) return v.length ? v : undefined;
    if (typeof v === 'object') { const o = {}; let any = false; Object.keys(v).forEach(k => { const p = prune(v[k]); if (p !== undefined) { o[k] = p; any = true; } }); return any ? o : undefined; }
    return v;
}
function makeDb(seed) {
    const db = { tree: prune(clone(seed)), log: [], failOn: null };
    const segs = p => String(p).split('/').filter(Boolean);
    const getAt = p => segs(p).reduce((c, k) => (c == null ? undefined : c[k]), db.tree);
    const setAt = (p, val) => {
        const s = segs(p); val = prune(clone(val));
        let cur = db.tree;
        for (let i = 0; i < s.length - 1; i++) { if (cur[s[i]] == null || typeof cur[s[i]] !== 'object') cur[s[i]] = {}; cur = cur[s[i]]; }
        if (val === undefined) delete cur[s[s.length - 1]]; else cur[s[s.length - 1]] = val;
        db.tree = prune(db.tree) || {};
    };
    const write = (op, p, v) => {
        if (db.failOn && db.failOn(op, p, v)) return Promise.reject(new Error('fallo simulado en ' + op + ' ' + p));
        if (op === 'update') Object.keys(v).forEach(k => setAt(p + '/' + k, v[k])); else setAt(p, op === 'remove' ? null : v);
        db.log.push({ op, path: p, value: clone(v) });
        return Promise.resolve();
    };
    db.ref = p => ({
        once: () => Promise.resolve({ val: () => { const v = getAt(p); return v === undefined ? null : clone(v); } }),
        update: v => write('update', p, v), remove: () => write('remove', p), set: v => write('set', p, v),
    });
    db.get = p => clone(getAt(p));
    db.writes = () => db.log;
    return db;
}

const rec = (x) => Object.assign({ distance: 5000 }, x);
function datos() {
    return {
        players: { p1: { id: 'p1', name: 'Ana López', authUid: 'uA' }, p2: { id: 'p2', name: 'Bea', authUid: 'uB' } },
        sessions: { s1: { id: 's1', playerId: 'p1', date: '2026-09-01' }, s2: { id: 's2', playerId: 'p1', date: '2025-03-01' }, s3: { id: 's3', playerId: 'p2', date: '2026-09-01' } },
        wellness: { w1: { id: 'w1', playerId: 'p1', date: '2026-10-01', sleep: 3 }, wp_uA_2026_10_01: { id: 'wp_uA_2026_10_01', playerId: 'p1', source: 'player' }, w2: { id: 'w2', playerId: 'p2' } },
        injuries: { i1: { id: 'i1', playerId: 'p1', type: 'Esguince' }, i2: { id: 'i2', playerId: 'p2', type: 'Rotura' } },
        clinicalNotes: { n1: { id: 'n1', playerId: 'p1', text: 'nota' }, n2: { id: 'n2', playerId: 'p2', text: 'otra' } },
        gymSessions: { g1: { id: 'g1', playerId: 'p1' }, g2: { id: 'g2', playerId: 'p2' } },
        testSessions: { t1: { id: 't1', playerId: 'p1', results: {} }, t2: { id: 't2', playerId: 'p2', results: {} } },
        availability: { p1: { '2026-10-01': 'limited' }, p2: { '2026-10-01': 'unavailable' } },
        gpsData: { gs1: { p1: rec(), p2: rec() }, gs2: { p1: rec() }, gs3: { p2: rec() } },
        gpsPlayerMap: { oli1: 'p1', oli2: 'p2' },
        anamnesis: { p1: { zones: ['knee'] }, p2: { zones: ['ankle'] } },
        wellnessPlayer: { uA: { '2026-10-01': { uid: 'uA', date: '2026-10-01', sleep: 4 } }, uB: { '2026-10-01': { uid: 'uB', date: '2026-10-01', sleep: 2 } } },
        playerRpeReports: { uA: { '2026-10-01': { match: { rpe: 7 }, morning: { rpe: 5 } } }, uB: { '2026-10-01': { match: { rpe: 6 } } } },
        pushStatus: { uA: { active: true }, uB: { active: true } },
        pushSubscriptions: { uA: { endpoint: 'https://p/a' }, uB: { endpoint: 'https://p/b' } },
        users: {
            staff1: { role: 'staff' },
            uA: { role: 'player', playerId: 'p1', email: 'ana@rpe.app' },
            uX: { role: 'player', playerId: 'p1', email: 'ana2@rpe.app' },       // segunda cuenta vinculada solo por /users
            uB: { role: 'player', playerId: 'p2', email: 'bea@rpe.app' },
        },
    };
}

// ---------- Entorno: RPETracker + player-data.js ----------
function boot(opts = {}) {
    const db = makeDb(datos());
    const store = {}, toasts = [], confirms = [], alerts = [], descargas = [], renders = [];
    const respuestas = (opts.respuestas || []).slice();
    const ctx = vm.createContext({
        console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Object, Array, Set, Promise, String, Number, setTimeout,
        Store: {
            set: (k, v) => { store[k] = JSON.stringify(v); }, getString: (k) => (store[k] === undefined ? null : store[k]),
        },
        localStorage: { removeItem: (k) => { store['LS:' + k] = 'borrado'; }, setItem() {}, getItem: () => null },
        navigator: { onLine: opts.offline ? false : true },
        AppAuth: { isStaff: () => opts.staff !== false },
        AppConfirm: { show: async (o) => { confirms.push(o); return respuestas.length ? respuestas.shift() : true; } },
        AppAlert: { show: async (m, t) => { alerts.push([m, t]); } },
        Blob: function (parts, o) { this.contenido = parts.join(''); this.tipo = o && o.type; },
        URL: { createObjectURL: (b) => { descargas.push(b); return 'blob:x'; }, revokeObjectURL() {} },
        document: { createElement: () => ({ click() {} }), body: { appendChild() {} } },
    });
    // el <a> descargado: guardamos su nombre
    ctx.document.createElement = () => { const a = { click() { descargas.push({ nombreArchivo: a.download }); }, remove() {} }; return a; };
    ctx.window = ctx;
    ctx.window.firebaseSync = opts.sinFirebase ? undefined : { db };
    vm.runInContext('function RPETracker() {}', ctx);
    vm.runInContext(read('player-data.js'), ctx, { filename: 'player-data.js' });
    const T = vm.runInContext('new RPETracker()', ctx);
    T.showToast = (m, t) => toasts.push([m, t]);
    T.players = [{ id: 'p1', name: 'Ana López' }, { id: 'p2', name: 'Bea' }];
    T.sessions = [{ id: 's1', playerId: 'p1', date: '2026-09-01' }, { id: 's2', playerId: 'p1', date: '2025-03-01' }, { id: 's3', playerId: 'p2', date: '2026-09-01' }];
    T.wellnessData = [{ id: 'w1', playerId: 'p1' }, { id: 'w2', playerId: 'p2' }];
    T.injuries = [{ id: 'i1', playerId: 'p1' }, { id: 'i2', playerId: 'p2' }];
    T.clinicalNotes = [{ id: 'n1', playerId: 'p1' }, { id: 'n2', playerId: 'p2' }];
    T.gymSessions = [{ id: 'g1', playerId: 'p1' }, { id: 'g2', playerId: 'p2' }];
    T.testSessions = [{ id: 't1', playerId: 'p1' }, { id: 't2', playerId: 'p2' }];
    T.availability = { p1: { d: 'limited' }, p2: { d: 'limited' } };
    T.gpsData = { gs1: { p1: rec(), p2: rec() }, gs2: { p1: rec() }, gs3: { p2: rec() } };
    T.gpsPlayerMap = { oli1: 'p1', oli2: 'p2' };
    T._wellnessPlayerCache = [{ uid: 'uA' }, { uid: 'uB' }];
    T._playerRpeRaw = [{ uid: 'uA', rpe: 7 }, { uid: 'uB', rpe: 6 }];
    ['renderPlayers', 'renderSessions', 'populatePlayerSelects'].forEach(f => { T[f] = () => renders.push(f); });
    T._deletePlayerBasic = (id) => { T.__basico = id; };
    return { T, db, store, toasts, confirms, alerts, descargas, renders, ctx };
}
const sinP1 = (db) => !/"p1"|"uA"|"uX"|oli1/.test(JSON.stringify(db.tree)) || (() => { throw new Error('quedan restos: ' + JSON.stringify(db.tree).match(/.{0,40}("p1"|"uA"|"uX"|oli1).{0,40}/)); })();

let passed = 0, failed = 0;
const queue = [];
const test = (n, f) => queue.push({ n, f });

console.log('\nInventario y copia');
test('el recuento incluye todo lo de ella (también la segunda cuenta vinculada solo por /users)', async () => {
    const { T } = boot();
    const inv = await T.getPlayerDataInventory('p1');
    const r = Object.fromEntries(inv.lineas);
    assert.deepStrictEqual(r, {
        'sesiones de entrenamiento': 2, 'registros de wellness del staff': 2, 'lesiones': 1, 'notas clínicas': 1,
        'sesiones de gimnasio': 1, 'tests físicos': 1, 'días de disponibilidad': 1, 'registros GPS': 2,
        'emparejamientos GPS': 1, 'ficha de anamnesis': 1, 'wellness enviados por ella': 1, 'RPE enviados por ella': 2, 'cuenta(s) de acceso': 2,
    });
});
test('la copia JSON trae solo sus datos (y los que envió desde su cuenta), con nombre de archivo ordenado', async () => {
    const { T, descargas } = boot();
    const { nombre, salida } = await T.exportPlayerData('p1');
    assert.ok(/^datos-ana-lopez-\d{4}-\d{2}-\d{2}\.json$/.test(nombre), nombre);
    assert.strictEqual(salida.sesiones.length, 2); assert.strictEqual(salida.lesiones[0].id, 'i1');
    assert.strictEqual(salida.cuentas.length, 2);
    const txt = JSON.stringify(salida);
    assert.ok(!/Bea|"p2"|"uB"/.test(txt), 'nada de otras jugadoras');
    assert.ok(/EnviadoPorElla/.test(txt) && salida.cuentas.find(c => c.uid === 'uA').wellnessEnviadoPorElla);
    assert.ok(descargas.some(d => d.nombreArchivo === nombre), 'se descargó el archivo');
});

console.log('\nEliminación');
test('borra TODO lo de ella en Firebase y no toca nada de las demás jugadoras', async () => {
    const { T, db } = boot();
    const antesP2 = JSON.stringify({ s: db.get('sessions/s3'), w: db.get('wellness/w2'), i: db.get('injuries/i2'), n: db.get('clinicalNotes/n2'), g: db.get('gymSessions/g2'), t: db.get('testSessions/t2'), a: db.get('availability/p2'), gs1: db.get('gpsData/gs1/p2'), gs3: db.get('gpsData/gs3'), m: db.get('gpsPlayerMap/oli2'), an: db.get('anamnesis/p2'), wp: db.get('wellnessPlayer/uB'), rp: db.get('playerRpeReports/uB'), ps: db.get('pushStatus/uB'), pu: db.get('pushSubscriptions/uB'), u: db.get('users/uB'), p: db.get('players/p2') });
    const r = await T.eraseAllPlayerData('p1');
    assert.strictEqual(r.ok, true, JSON.stringify(r));
    sinP1(db);
    const despuesP2 = JSON.stringify({ s: db.get('sessions/s3'), w: db.get('wellness/w2'), i: db.get('injuries/i2'), n: db.get('clinicalNotes/n2'), g: db.get('gymSessions/g2'), t: db.get('testSessions/t2'), a: db.get('availability/p2'), gs1: db.get('gpsData/gs1/p2'), gs3: db.get('gpsData/gs3'), m: db.get('gpsPlayerMap/oli2'), an: db.get('anamnesis/p2'), wp: db.get('wellnessPlayer/uB'), rp: db.get('playerRpeReports/uB'), ps: db.get('pushStatus/uB'), pu: db.get('pushSubscriptions/uB'), u: db.get('users/uB'), p: db.get('players/p2') });
    assert.strictEqual(despuesP2, antesP2, 'los datos de Bea quedan idénticos');
    assert.deepStrictEqual(plano(r.correos).sort(), ['ana2@rpe.app', 'ana@rpe.app']);
    assert.strictEqual(db.get('staff1'), undefined); assert.deepStrictEqual(db.get('users/staff1'), { role: 'staff' });
});
test('la ficha de la jugadora y sus cuentas se borran los ÚLTIMOS', async () => {
    const { T, db } = boot();
    await T.eraseAllPlayerData('p1');
    const ops = db.writes().map(w => w.op + ':' + w.path);
    const idxFicha = ops.indexOf('remove:players/p1');
    assert.strictEqual(idxFicha, ops.length - 1, 'la ficha es lo último: ' + ops.join(' | '));
    assert.ok(ops.indexOf('remove:users/uA') > ops.indexOf('remove:pushStatus/uA'));
    assert.ok(ops.indexOf('update:sessions') < ops.indexOf('remove:users/uA'));
});
test('SOLO el staff: sin permiso no se lee ni se escribe nada', async () => {
    const { T, db } = boot({ staff: false });
    const r = await T.eraseAllPlayerData('p1');
    assert.strictEqual(r.ok, false); assert.ok(/Solo el staff/.test(r.rechazado));
    assert.strictEqual(db.writes().length, 0); assert.ok(db.get('players/p1'));
});
test('sin conexión o sin Firebase: se rechaza y no se toca nada', async () => {
    const off = boot({ offline: true }); const r1 = await off.T.eraseAllPlayerData('p1');
    assert.ok(r1.rechazado && off.db.writes().length === 0);
    const sin = boot({ sinFirebase: true }); const r2 = await sin.T.eraseAllPlayerData('p1');
    assert.ok(r2.rechazado);
});
test('fallo a medias: se informa, la jugadora SIGUE en la lista y al reintentar se completa', async () => {
    const { T, db } = boot();
    db.failOn = (op, p) => p === 'injuries';
    const r1 = await T.eraseAllPlayerData('p1');
    assert.strictEqual(r1.ok, false); assert.deepStrictEqual(plano(r1.fallos), ['lesiones']);
    assert.ok(db.get('players/p1'), 'la ficha no se borró'); assert.ok(db.get('users/uA'), 'ni las cuentas');
    assert.ok(db.get('injuries/i1'), 'lo que falló sigue ahí'); assert.strictEqual(db.get('sessions/s1'), undefined, 'lo demás sí se borró');
    assert.ok(T.players.some(p => p.id === 'p1'), 'sigue en la lista de la app');
    db.failOn = null;
    const r2 = await T.eraseAllPlayerData('p1');
    assert.strictEqual(r2.ok, true); sinP1(db);
});
test('dos eliminaciones a la vez: la segunda se rechaza', async () => {
    const { T } = boot();
    const a = T.eraseAllPlayerData('p1'); const b = await T.eraseAllPlayerData('p1');
    assert.ok(b.rechazado && /en curso/.test(b.rechazado)); await a;
});
test('memoria y copias locales: la jugadora desaparece también de la pantalla y de localStorage', async () => {
    const { T, store, renders } = boot();
    store.sessions = JSON.stringify([{ id: 's1', playerId: 'p1' }, { id: 's2', playerId: 'p1', date: '2025-03-01' }, { id: 's3', playerId: 'p2' }]);
    store.injuries = JSON.stringify([{ id: 'i1', playerId: 'p1' }]);
    await T.eraseAllPlayerData('p1');
    assert.deepStrictEqual(plano(T.sessions.map(s => s.id)), ['s3']);
    assert.deepStrictEqual(plano(T.players.map(p => p.id)), ['p2']);
    ['wellnessData', 'injuries', 'clinicalNotes', 'gymSessions', 'testSessions'].forEach(k => assert.ok(!T[k].some(x => x.playerId === 'p1'), k));
    assert.deepStrictEqual(plano(Object.keys(T.availability)), ['p2']);
    assert.deepStrictEqual(plano(Object.keys(T.gpsData).sort()), ['gs1', 'gs3']); assert.deepStrictEqual(plano(Object.keys(T.gpsData.gs1)), ['p2']);
    assert.deepStrictEqual(plano(Object.keys(T.gpsPlayerMap)), ['oli2']);
    assert.deepStrictEqual(plano(T._wellnessPlayerCache.map(e => e.uid)), ['uB']); assert.deepStrictEqual(plano(T._playerRpeRaw.map(e => e.uid)), ['uB']);
    assert.deepStrictEqual(JSON.parse(store.sessions).map(s => s.id), ['s3'], 'espejo local de sesiones limpio, incluidas las antiguas');
    assert.deepStrictEqual(JSON.parse(store.injuries), [], 'espejo local de lesiones limpio');
    assert.strictEqual(store['LS:anamnesis_p1'], 'borrado');
    ['renderPlayers', 'renderSessions', 'populatePlayerSelects'].forEach(f => assert.ok(renders.includes(f), f + ' se refresca'));
});

console.log('\nFlujo que ve el usuario');
test('flujo completo: copia → confirmación escribiendo el nombre (con el recuento) → borrado → aviso del paso manual', async () => {
    const { T, db, confirms, alerts, descargas } = boot({ respuestas: [true, true] });
    await T._pdDeleteFlow('p1');
    assert.strictEqual(confirms.length, 2);
    assert.ok(/copia/i.test(confirms[0].title));
    assert.strictEqual(confirms[1].requireText, 'Ana López'); assert.strictEqual(confirms[1].danger, true);
    assert.ok(/2 sesiones de entrenamiento/.test(confirms[1].message) && /1 lesiones/.test(confirms[1].message) && /2 cuenta/.test(confirms[1].message));
    assert.ok(descargas.some(d => d.nombreArchivo && /^datos-ana-lopez-/.test(d.nombreArchivo)), 'se descargó la copia');
    sinP1(db);
    assert.ok(/Authentication/.test(alerts[0][0]) && /ana@rpe\.app/.test(alerts[0][0]) && /ana2@rpe\.app/.test(alerts[0][0]), 'indica el paso manual con los correos');
});
test('sin copia pero confirmando: borra igual; cancelando la confirmación fuerte: NO se borra nada', async () => {
    const a = boot({ respuestas: [false, true] }); await a.T._pdDeleteFlow('p1');
    assert.ok(!a.descargas.some(d => d.nombreArchivo)); sinP1(a.db);
    const b = boot({ respuestas: [false, false] }); await b.T._pdDeleteFlow('p1');
    assert.strictEqual(b.db.writes().length, 0); assert.ok(b.db.get('players/p1'));
});
test('un usuario que no es staff ve un aviso y no se le pregunta nada', async () => {
    const { T, toasts, confirms, db } = boot({ staff: false });
    await T._pdDeleteFlow('p1');
    assert.strictEqual(confirms.length, 0); assert.ok(toasts.some(t => /Solo el staff/.test(t[0]))); assert.strictEqual(db.writes().length, 0);
});
test('modo local (sin Firebase): se usa el borrado básico de siempre', async () => {
    const { T } = boot({ sinFirebase: true }); await T._pdDeleteFlow('p1');
    assert.strictEqual(T.__basico, 'p1');
});
test('eliminación incompleta: aviso con lo que queda y la jugadora sigue en la lista', async () => {
    const { T, db, alerts } = boot({ respuestas: [false, true] });
    db.failOn = (op, p) => p === 'clinicalNotes';
    await T._pdDeleteFlow('p1');
    assert.ok(/notas clínicas/.test(alerts[0][0]) && /reintentarlo/.test(alerts[0][0]) && alerts[0][1] === 'Eliminación incompleta');
    assert.ok(db.get('players/p1'));
});
test('el botón Eliminar de app-players.js delega en player-data.js', async () => {
    const src = read('app-players.js');
    assert.ok(/deletePlayer = function\(playerId\) \{\s*if \(typeof this\._pdDeleteFlow === 'function'\) return this\._pdDeleteFlow\(playerId\);/.test(src));
    assert.ok(/<script src="player-data\.js"><\/script>/.test(read('index.html')), 'player-data.js está en index.html');
    assert.ok(/'player-data\.js'/.test(read('sw.js')), 'y en la lista del service worker');
});

console.log('\nConfirmar escribiendo el nombre (AppConfirm.matches)');
test('ignora mayúsculas, tildes y espacios de más; exige el texto entero', async () => {
    const ctx = vm.createContext({ window: {}, console, document: {} });
    vm.runInContext(read('security.js').split('window.AppConfirm = AppConfirm;')[0] + ';globalThis.__C = AppConfirm;', ctx);
    const m = ctx.__C.matches.bind(ctx.__C);
    assert.strictEqual(m('ana lopez', 'Ana López'), true); assert.strictEqual(m('  ANA   LÓPEZ ', 'Ana López'), true);
    assert.strictEqual(m('ana', 'Ana López'), false); assert.strictEqual(m('ana lopez!', 'Ana López'), false);
    assert.strictEqual(m('', ''), false, 'sin texto exigido no hay coincidencia vacía');
    assert.strictEqual(m('x', ''), false);
});

console.log('\nSesiones: la ventana manda sobre lo borrado en otro dispositivo (app.js)');
function loadSessionsDeApp(fullHistory, windowStart) {
    const fuente = read('app.js');
    const extraer = (nombre) => {
        const ini = fuente.indexOf(`    ${nombre}(`);
        let i = fuente.indexOf('{', fuente.indexOf(')', ini)), depth = 0;
        for (; i < fuente.length; i++) { if (fuente[i] === '{') depth++; else if (fuente[i] === '}' && --depth === 0) break; }
        return fuente.slice(ini, i + 1);
    };
    let cb = null;
    const ctx = vm.createContext({ console, Store: { getString: () => null }, getCurrentSeasonWindowStart: () => windowStart, setTimeout, Promise,
        window: { firebaseSync: { onSessionsChange: (f) => { cb = f; } } } });
    const obj = vm.runInContext('({' + extraer('loadSessions') + ',' + extraer('_mergeSessionsById') + '})', ctx);
    obj.renderSessions = () => {}; obj.renderDashboard = () => {}; obj.currentView = 'x';
    obj._fullHistoryLoaded = fullHistory;
    obj.loadSessions();
    return { obj, emitir: (s) => cb(s) };
}
const ses = (id, date) => ({ id, date, playerId: 'p1' });
test('con histórico completo: una sesión de la ventana borrada en otro dispositivo desaparece; las antiguas se conservan', () => {
    const { obj, emitir } = loadSessionsDeApp(true, '2026-08-01');
    obj.sessions = [ses('vieja', '2025-03-01'), ses('en-ventana', '2026-09-01'), ses('borrada-fuera', '2026-09-02')];
    emitir([ses('en-ventana', '2026-09-01')]);
    assert.deepStrictEqual(plano(obj.sessions.map(s => s.id)).sort(), ['en-ventana', 'vieja']);
});
test('con histórico completo: una sesión nueva llegada del servidor entra, y la edición remota gana', () => {
    const { obj, emitir } = loadSessionsDeApp(true, '2026-08-01');
    obj.sessions = [ses('vieja', '2025-03-01'), Object.assign(ses('x', '2026-09-01'), { rpe: 1 })];
    emitir([Object.assign(ses('x', '2026-09-01'), { rpe: 9 }), ses('nueva', '2026-09-05')]);
    assert.deepStrictEqual(plano(obj.sessions.map(s => s.id)).sort(), ['nueva', 'vieja', 'x']);
    assert.strictEqual(obj.sessions.find(s => s.id === 'x').rpe, 9);
});
test('sin histórico completo: la lectura reemplaza (como siempre)', () => {
    const { obj, emitir } = loadSessionsDeApp(false, '2026-08-01');
    obj.sessions = [ses('a', '2026-09-01'), ses('b', '2026-09-02')];
    emitir([ses('a', '2026-09-01')]);
    assert.deepStrictEqual(plano(obj.sessions.map(s => s.id)), ['a']);
});

(async () => {
    for (const t of queue) {
        try { await t.f(); passed++; console.log('  ✅ ' + t.n); }
        catch (e) { failed++; console.log('  ❌ ' + t.n + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

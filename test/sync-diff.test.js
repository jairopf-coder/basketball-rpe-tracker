// ============================================================
//  test/sync-diff.test.js  (Fase 3a)
//  Prueba la escritura por diferencias de firebase-sync.js (lesiones y notas clínicas)
//  con un Firebase FALSO compartido por varios "dispositivos".
//  Uso:  node test/sync-diff.test.js
// ============================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'firebase-sync.js'), 'utf8');

// ---------- Firebase falso ----------
const clone = v => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));
// Como Firebase: no guarda null/undefined/[]/{} y devuelve las claves ordenadas
function prune(v) {
    if (v === null || v === undefined) return undefined;
    if (Array.isArray(v)) { const a = v.map(prune).map(x => (x === undefined ? null : x)); return a.length ? a : undefined; }
    if (typeof v === 'object') {
        const o = {}; let any = false;
        Object.keys(v).sort().forEach(k => { const p = prune(v[k]); if (p !== undefined) { o[k] = p; any = true; } });
        return any ? o : undefined;
    }
    return v;
}
const segs = p => String(p).split('/').filter(Boolean);

function makeNet() {
    const net = { server: {}, log: [], devices: {} };
    const getAt = (p) => segs(p).reduce((cur, k) => (cur == null ? undefined : cur[k]), net.server);
    function setAt(p, val) {
        const s = segs(p); val = prune(clone(val));
        if (!s.length) { net.server = val || {}; return; }
        let cur = net.server;
        for (let i = 0; i < s.length - 1; i++) { if (cur[s[i]] == null || typeof cur[s[i]] !== 'object') cur[s[i]] = {}; cur = cur[s[i]]; }
        if (val === undefined) delete cur[s[s.length - 1]]; else cur[s[s.length - 1]] = val;
        net.server = prune(net.server) || {};   // como Firebase: un nodo que se queda vacío desaparece
    }
    const related = (a, b) => { const A = segs(a), B = segs(b), n = Math.min(A.length, B.length); return A.slice(0, n).join('/') === B.slice(0, n).join('/'); };
    const snap = p => ({ val: () => { const v = getAt(p); return v === undefined ? null : clone(v); }, exists: () => getAt(p) !== undefined });

    net.seed = (p, v) => setAt(p, v);
    net.deliver = () => { Object.values(net.devices).forEach(d => { const q = d.inbox.splice(0); q.forEach(f => f()); }); };

    net.newDevice = (name) => {
        const dev = { name, listeners: [], inbox: [], hold: false, held: [], failNext: false };
        net.devices[name] = dev;
        const fire = (writtenPath, own) => Object.values(net.devices).forEach(d => d.listeners.forEach(l => {
            if (!related(l.path, writtenPath)) return;
            const f = () => l.cb(snap(l.path));
            if (d === dev && own) f(); else d.inbox.push(f);          // el propio dispositivo ve su eco al instante; los demás, al "llegar"
        }));
        const clavesInvalidas = (v) => v && typeof v === 'object' && Object.keys(v).some(k => /[.$#\[\]\/]/.test(k) || clavesInvalidas(v[k]));
        function write(op, p, v) {
            // En update() las claves de primer nivel son RUTAS (pueden llevar "/"); en set() son claves normales
            const invalida = op === 'update'
                ? Object.keys(v || {}).some(k => k.split('/').some(seg => /[.$#\[\]]/.test(seg)) || clavesInvalidas(v[k]))
                : clavesInvalidas(v);
            if (invalida) throw new Error('Invalid key (simulado, como Firebase)');
            if (dev.failNext) { dev.failNext = false; return Promise.reject(new Error('sin permisos (simulado)')); }
            if (op === 'set') { setAt(p, v); }
            else { Object.keys(v).forEach(k => setAt(p + '/' + k, v[k])); }
            net.log.push({ device: name, op, path: p, value: clone(v) });
            fire(p, true);
            return new Promise(res => { if (dev.hold) dev.held.push(res); else res(); });
        }
        dev.release = () => { dev.hold = false; dev.held.splice(0).forEach(r => r()); };
        dev.db = {
            ref: (p) => ({
                on: (ev, cb) => { const l = { path: p, cb }; dev.listeners.push(l); dev.inbox.push(() => cb(snap(p))); },
                off() {}, once: (ev, cb) => { const sn = snap(p); if (typeof cb === 'function') { dev.inbox.push(() => cb(sn)); } return Promise.resolve(sn); },
                set: v => write('set', p, v), update: v => write('update', p, v),
            }),
        };
        return dev;
    };
    return net;
}

// ---------- Un "dispositivo": contexto con firebase-sync.js real + una mini app ----------
function boot(net, name, opts = {}) {
    const dev = net.newDevice(name);
    const stored = {}, toasts = [];
    const ctx = vm.createContext({
        console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Object, Array, Promise, Number, String, isFinite, setTimeout, queueMicrotask,
        Store: { set: (k, v) => { stored[k] = v; }, getString: () => null },
        document: { getElementById: () => null }, localStorage: { getItem: () => null, setItem() {} },
    });
    ctx.window = ctx; ctx.firebaseDB = dev.db;
    ctx.rpeTracker = { showToast: (m, t) => toasts.push([m, t]) };
    const code = opts.diffOff ? SRC.replace('const DIFF_WRITES_ENABLED = true;', 'const DIFF_WRITES_ENABLED = false;') : SRC;
    vm.runInContext(code + '\n;globalThis.__SyncDiff = (typeof SyncDiff !== "undefined") ? SyncDiff : undefined;', ctx, { filename: 'firebase-sync.js' });
    const fs_ = ctx.firebaseSync;
    const enq = []; fs_._enqueueWrite = async (ref, data, mode) => { enq.push({ ref, data: clone(data), mode }); };
    const app = { name, injuries: [], clinicalNotes: [], savingInj: false, stored, toasts, enq, dev, fs: fs_, ctx, SyncDiff: ctx.__SyncDiff };
    // La app real: ignora lecturas mientras guarda (_savingInjuries) y adopta siempre las de notas
    fs_.onInjuriesChange(items => { if (app.savingInj) return; app.injuries = items.map(x => Object.assign({}, x)); });
    fs_.onClinicalNotesChange(items => { app.clinicalNotes = items.map(x => Object.assign({}, x)); });
    app.players = []; app.gymSessions = []; app.testSessions = []; app.seasonBlocks = []; app.matches = []; app.availability = {};
    fs_.onGymSessionsChange(items => { app.gymSessions = items.map(x => Object.assign({}, x)); });
    fs_.onTestSessionsChange(items => { app.testSessions = items.map(x => Object.assign({}, x)); });
    fs_.onSeasonBlocksChange(items => { app.seasonBlocks = items.map(x => Object.assign({}, x)); });
    fs_.onMatchesChange(items => { app.matches = items.map(x => Object.assign({}, x)); });
    fs_.onPlayersChange(items => { if (app.savingPlayers) return; app.players = items.map(x => Object.assign({}, x)); });
    fs_.onAvailabilityChange(av => { if (app.savingAv) return; app.availNull = av === null; app.availability = av === null ? {} : JSON.parse(JSON.stringify(av)); });
    app.savePlayers = () => { app.savingPlayers = true; return fs_.savePlayers(app.players).finally(() => { app.savingPlayers = false; }); };
    app.saveGym = () => fs_.saveGymSessions(app.gymSessions);
    app.saveTests = () => fs_.saveTestSessions(app.testSessions);
    app.saveBlocks = () => fs_.saveSeasonBlocks(app.seasonBlocks);
    app.saveMatches = () => fs_.saveMatches(app.matches);
    app.saveAvail = () => { app.savingAv = true; return fs_.saveAvailability(app.availability).finally(() => { app.savingAv = false; }); };
    app.saveInjuries = () => { app.savingInj = true; return fs_.saveInjuries(app.injuries).finally(() => { app.savingInj = false; }); };
    app.saveNotes = () => fs_.saveClinicalNotes(app.clinicalNotes);
    app.writes = () => net.log.filter(l => l.device === name);
    return app;
}
const sync = async (net) => { await Promise.resolve(); net.deliver(); await Promise.resolve(); };

let passed = 0, failed = 0;
const queue = [];
const test = (n, f) => queue.push({ n, f });

const inj = (id, extra) => Object.assign({ id, playerId: 'p1', type: 'Esguince', notes: 'v1', tags: [] }, extra);

console.log('\nMotor (SyncDiff)');
test('canon: mismo contenido con claves en otro orden y con [] / null / {} sobrantes = igual', () => {
    const { SyncDiff } = boot(makeNet(), 'X');
    const a = SyncDiff.canon({ id: '1', b: 2, a: [1, 2], z: [], y: null, w: {}, v: undefined });
    const b = SyncDiff.canon({ a: [1, 2], b: 2, id: '1' });
    assert.strictEqual(a, b);
    assert.notStrictEqual(SyncDiff.canon({ id: '1', a: [1, 2] }), SyncDiff.canon({ id: '1', a: [1, 3] }));
    assert.notStrictEqual(SyncDiff.canon({ id: '1', n: 'x' }), SyncDiff.canon({ id: '1', n: 'y' }));
});
test('validKey: rechaza . $ # [ ] / y vacío', () => {
    const { SyncDiff } = boot(makeNet(), 'X');
    ['a.b', 'a$b', 'a#b', 'a[b', 'a]b', 'a/b', '', null, undefined, {}].forEach(k => assert.strictEqual(SyncDiff.validKey(k), false, String(k)));
    ['abc', '1727890000000', 'Xk3_9-a', 12345].forEach(k => assert.strictEqual(SyncDiff.validKey(k), true, String(k)));
});

console.log('\nLesiones: lo básico');
test('sin cambios → CERO escrituras', async () => {
    const net = makeNet(); net.seed('injuries', { a: inj('a'), b: inj('b') });
    const A = boot(net, 'A'); await sync(net);
    assert.strictEqual(A.injuries.length, 2);
    const ok = await A.saveInjuries();
    assert.strictEqual(ok, true); assert.strictEqual(A.writes().length, 0);
    assert.strictEqual(A.stored.injuries.length, 2, 'el espejo local se actualiza igualmente');
});
test('añadir / editar / borrar → un update con SOLO esas claves', async () => {
    const net = makeNet(); net.seed('injuries', { a: inj('a'), b: inj('b') });
    const A = boot(net, 'A'); await sync(net);
    A.injuries.push(inj('c')); await A.saveInjuries();
    assert.deepStrictEqual(Object.keys(A.writes()[0].value), ['c']); assert.strictEqual(A.writes()[0].op, 'update');
    A.injuries.find(i => i.id === 'a').notes = 'v2'; await A.saveInjuries();
    assert.deepStrictEqual(Object.keys(A.writes()[1].value), ['a']);
    A.injuries = A.injuries.filter(i => i.id !== 'b'); await A.saveInjuries();
    assert.deepStrictEqual(A.writes()[2].value, { b: null });
    assert.deepStrictEqual(Object.keys(net.server.injuries).sort(), ['a', 'c']);
    assert.strictEqual(net.server.injuries.a.notes, 'v2');
});
test('el servidor devuelve claves ordenadas y sin [] ni {}: no provoca escrituras de más', async () => {
    const net = makeNet(); net.seed('injuries', { a: inj('a', { extra: [], vacio: {} }) });
    const A = boot(net, 'A'); await sync(net);
    A.injuries[0].tags = []; A.injuries[0].otra = [];                 // la app añade vacíos
    await A.saveInjuries(); assert.strictEqual(A.writes().length, 0);
    A.injuries[0].notes = 'cambio real'; await A.saveInjuries();
    assert.strictEqual(A.writes().length, 1);
});
test('instancias de clase con métodos y campos undefined se guardan como JSON plano', async () => {
    const net = makeNet(); const A = boot(net, 'A'); await sync(net);
    class Injury { constructor(d) { Object.assign(this, d); this.fantasma = undefined; } getDays() { return 3; } }
    A.injuries = [new Injury(inj('n1'))]; await A.saveInjuries();
    assert.deepStrictEqual(Object.keys(A.writes()[0].value.n1).includes('fantasma'), false);
    assert.strictEqual(typeof net.server.injuries.n1.getDays, 'undefined');
});

console.log('\nLesiones: varios dispositivos (lo que antes se perdía)');
test('dos dispositivos añaden a la vez: SE CONSERVAN LAS DOS (con set() una se perdía)', async () => {
    const net = makeNet(); net.seed('injuries', { x: inj('x') });
    const A = boot(net, 'A'), B = boot(net, 'B'); await sync(net);
    A.injuries.push(inj('delA')); await A.saveInjuries();             // B aún no ha recibido nada
    B.injuries.push(inj('delB')); await B.saveInjuries();
    assert.deepStrictEqual(Object.keys(net.server.injuries).sort(), ['delA', 'delB', 'x']);
    await sync(net);
    assert.deepStrictEqual(A.injuries.map(i => i.id).sort(), ['delA', 'delB', 'x']);
    assert.deepStrictEqual(B.injuries.map(i => i.id).sort(), ['delA', 'delB', 'x']);
});
test('dispositivo DESFASADO no revierte lo ajeno ni borra lo que no vio', async () => {
    const net = makeNet(); net.seed('injuries', { x: inj('x'), y: inj('y') });
    const A = boot(net, 'A'), B = boot(net, 'B'); await sync(net);
    A.injuries.find(i => i.id === 'x').notes = 'EDITADO EN A'; A.injuries.push(inj('nuevaA')); await A.saveInjuries();
    // B no ha recibido nada (desfasado) y cambia otra cosa
    B.injuries.find(i => i.id === 'y').notes = 'editado en B'; await B.saveInjuries();
    assert.strictEqual(net.server.injuries.x.notes, 'EDITADO EN A', 'lo de A no se revierte');
    assert.ok(net.server.injuries.nuevaA, 'lo que B no vio no se borra');
    assert.strictEqual(net.server.injuries.y.notes, 'editado en B');
    assert.deepStrictEqual(Object.keys(B.writes()[0].value), ['y'], 'B solo escribió lo suyo');
});
test('mismo elemento editado en los dos: gana el último (por elemento), el resto intacto', async () => {
    const net = makeNet(); net.seed('injuries', { x: inj('x'), y: inj('y') });
    const A = boot(net, 'A'), B = boot(net, 'B'); await sync(net);
    A.injuries[0].notes = 'A'; await A.saveInjuries();
    B.injuries[0].notes = 'B'; await B.saveInjuries();
    assert.strictEqual(net.server.injuries.x.notes, 'B'); assert.strictEqual(net.server.injuries.y.notes, 'v1');
});
test('un borrado en A no resucita ni borra de más desde B', async () => {
    const net = makeNet(); net.seed('injuries', { x: inj('x'), y: inj('y') });
    const A = boot(net, 'A'), B = boot(net, 'B'); await sync(net);
    A.injuries = A.injuries.filter(i => i.id !== 'x'); await A.saveInjuries();
    B.injuries.find(i => i.id === 'y').notes = 'b'; await B.saveInjuries();
    assert.deepStrictEqual(Object.keys(net.server.injuries), ['y']);
});

console.log('\nLesiones: primera lectura, guardado en vuelo y fallos');
test('antes de la primera lectura NO se escribe nada y se avisa', async () => {
    const net = makeNet(); net.seed('injuries', { a: inj('a'), b: inj('b'), c: inj('c') });
    const A = boot(net, 'A');                                         // sin sync(): el primer snapshot aún no ha llegado
    A.injuries = [inj('solo-esta')];                                  // memoria vacía/antigua
    const ok = await A.saveInjuries();
    assert.strictEqual(ok, false); assert.strictEqual(A.writes().length, 0);
    assert.deepStrictEqual(Object.keys(net.server.injuries).sort(), ['a', 'b', 'c'], 'el servidor intacto');
    assert.strictEqual(A.toasts.length, 1);
    await sync(net);                                                  // llega la lectura real
    assert.strictEqual(A.injuries.length, 3);
});
test('lecturas que llegan con un guardado en vuelo no se toman como cambios del usuario', async () => {
    const net = makeNet(); net.seed('injuries', { x: inj('x') });
    const A = boot(net, 'A'), B = boot(net, 'B'); await sync(net);
    A.dev.hold = true;                                                // el guardado de A queda "en vuelo"
    A.injuries.push(inj('a1'));
    const p = A.saveInjuries();
    B.injuries.push(inj('b9')); await B.saveInjuries();               // B añade b9 mientras tanto
    net.deliver();                                                    // A recibe b9, pero la app lo ignora (está guardando)
    assert.ok(!A.injuries.some(i => i.id === 'b9'));
    A.dev.release(); await p;
    await A.saveInjuries();                                           // siguiente guardado de A
    assert.ok(net.server.injuries.b9, 'b9 NO se borra (con set() desaparecía)');
    assert.ok(net.server.injuries.a1);
});
test('fallo de escritura: el cambio va a la cola offline como parche y no se repite', async () => {
    const net = makeNet(); net.seed('injuries', { x: inj('x') });
    const A = boot(net, 'A'); await sync(net);
    A.injuries.push(inj('n')); A.dev.failNext = true;
    const ok = await A.saveInjuries();
    assert.strictEqual(ok, false);
    assert.strictEqual(A.enq.length, 1); assert.strictEqual(A.enq[0].mode, 'patch'); assert.deepStrictEqual(Object.keys(A.enq[0].data), ['n']);
    await A.saveInjuries(); assert.strictEqual(A.enq.length, 1, 'sin cambios nuevos no se vuelve a encolar');
});
test('ids no válidos para Firebase: camino de siempre (set de la colección) y, si falla, a la cola', async () => {
    const net = makeNet(); net.seed('injuries', { a: inj('a') });
    const A = boot(net, 'A'); await sync(net);
    A.injuries.push(inj('con.punto'));
    const ok = await A.saveInjuries();
    assert.strictEqual(ok, false, 'Firebase rechaza la clave');
    assert.strictEqual(A.enq.length, 1); assert.strictEqual(A.enq[0].mode, undefined, 'se encola como colección completa, como antes');
    assert.deepStrictEqual(Object.keys(net.server.injuries), ['a'], 'el servidor no se toca');
    // con ids válidos en una colección sin primera lectura problemática, el camino normal sigue siendo update
    A.injuries = A.injuries.filter(i => i.id !== 'con.punto'); A.injuries.push(inj('ok2'));
    await A.saveInjuries();
    assert.strictEqual(A.writes().pop().op, 'update');
});

console.log('\nInterruptor y cola');
test('DIFF_WRITES_ENABLED = false → vuelve al set() de la colección completa', async () => {
    const net = makeNet(); net.seed('injuries', { a: inj('a'), b: inj('b') });
    const A = boot(net, 'A', { diffOff: true }); await sync(net);
    A.injuries.push(inj('c')); await A.saveInjuries();
    assert.strictEqual(A.writes()[0].op, 'set'); assert.strictEqual(A.writes()[0].path, 'injuries');
});
test('cola offline: un parche se reenvía con update, una entrada antigua (sin modo) con set', async () => {
    const net = makeNet(); net.seed('injuries', { a: inj('a'), b: inj('b') });
    const A = boot(net, 'A'); await sync(net);
    const entradas = [
        { id: 1, ref: 'injuries', mode: 'patch', data: { c: inj('c'), a: null }, timestamp: 1 },
        { id: 2, ref: 'matches', data: { m1: { id: 'm1' } }, timestamp: 2 },
    ];
    const borradas = [];
    A.fs._openIDB = async () => ({
        transaction: () => ({ objectStore: () => ({
            getAll: () => { const r = {}; setTimeout(() => r.onsuccess({ target: { result: entradas } }), 0); return r; },
            delete: (id) => { const r = {}; borradas.push(id); setTimeout(() => r.onsuccess(), 0); return r; },
            count: () => { const r = {}; setTimeout(() => r.onsuccess({ target: { result: 0 } }), 0); return r; },
        }) }),
    });
    await A.fs._drainQueue();
    assert.deepStrictEqual(Object.keys(net.server.injuries).sort(), ['b', 'c'], 'el parche añadió c y borró a, sin tocar b');
    assert.deepStrictEqual(A.writes().map(w => w.op), ['update', 'set']);
    assert.deepStrictEqual(borradas, [1, 2]);
});

console.log('\nNotas clínicas (staff y fisio)');
test('staff y fisio escriben notas a la vez: se conservan las dos', async () => {
    const net = makeNet(); net.seed('clinicalNotes', { n1: { id: 'n1', playerId: 'p1', text: 'vieja', date: '2026-10-01' } });
    const S = boot(net, 'staff'), F = boot(net, 'fisio'); await sync(net);
    S.clinicalNotes.push({ id: 'n2', playerId: 'p1', text: 'del staff', date: '2026-10-05' }); await S.saveNotes();
    F.clinicalNotes.push({ id: 'n3', playerId: 'p2', text: 'del fisio', date: '2026-10-05' }); await F.saveNotes();
    assert.deepStrictEqual(Object.keys(net.server.clinicalNotes).sort(), ['n1', 'n2', 'n3']);
    assert.deepStrictEqual(Object.keys(S.writes()[0].value), ['n2']);
});
test('editar una nota escribe solo esa nota; borrarla, solo su null', async () => {
    const net = makeNet(); net.seed('clinicalNotes', { n1: { id: 'n1', text: 'a' }, n2: { id: 'n2', text: 'b' } });
    const S = boot(net, 'staff'); await sync(net);
    S.clinicalNotes.find(n => n.id === 'n1').text = 'a editada'; await S.saveNotes();
    S.clinicalNotes = S.clinicalNotes.filter(n => n.id !== 'n2'); await S.saveNotes();
    assert.deepStrictEqual(S.writes().map(w => Object.keys(w.value)), [['n1'], ['n2']]);
    assert.deepStrictEqual(Object.keys(net.server.clinicalNotes), ['n1']);
    assert.strictEqual(net.server.clinicalNotes.n1.text, 'a editada');
});
test('notas: tampoco se escribe antes de la primera lectura', async () => {
    const net = makeNet(); net.seed('clinicalNotes', { n1: { id: 'n1', text: 'a' } });
    const S = boot(net, 'staff'); S.clinicalNotes = [{ id: 'n9', text: 'x' }];
    assert.strictEqual(await S.saveNotes(), false); assert.strictEqual(S.writes().length, 0);
});


console.log('\nFase 3b: jugadoras');
const pl = (id, extra) => Object.assign({ id, name: 'Ana ' + id, number: '7', color: '#336699' }, extra);
test('jugadoras: añadir / editar / borrar escriben solo esa clave', async () => {
    const net = makeNet(); net.seed('players', { p1: pl('p1'), p2: pl('p2') });
    const A = boot(net, 'A'); await sync(net);
    A.players.push(pl('p3')); await A.savePlayers();
    A.players.find(p => p.id === 'p1').color = '#ff0000'; await A.savePlayers();
    A.players = A.players.filter(p => p.id !== 'p2'); await A.savePlayers();
    assert.deepStrictEqual(A.writes().map(w => Object.keys(w.value)), [['p3'], ['p1'], ['p2']]);
    assert.strictEqual(A.writes()[2].value.p2, null);
    assert.deepStrictEqual(Object.keys(net.server.players).sort(), ['p1', 'p3']);
    assert.strictEqual(A.stored.players.length, 2);
});
test('jugadoras: sin cambios no escribe (antes reescribía todas, con fotos incluidas)', async () => {
    const net = makeNet(); net.seed('players', { p1: pl('p1', { photoURL: 'data:image/jpeg;base64,' + 'A'.repeat(5000) }) });
    const A = boot(net, 'A'); await sync(net);
    await A.savePlayers(); assert.strictEqual(A.writes().length, 0);
});
test('jugadoras: el authUid puesto a mano en la consola NO se borra desde un dispositivo desfasado', async () => {
    const net = makeNet(); net.seed('players', { p1: pl('p1'), p2: pl('p2') });
    const A = boot(net, 'A'); await sync(net);
    net.server.players.p1.authUid = 'uidDeLaJugadora';                // edición manual en Firebase Console (A no se entera)
    A.players.find(p => p.id === 'p2').number = '9'; await A.savePlayers();
    assert.strictEqual(net.server.players.p1.authUid, 'uidDeLaJugadora', 'con set() esto se perdía');
    assert.strictEqual(net.server.players.p2.number, '9');
});
test('jugadoras: dos dispositivos añaden a la vez y se conservan las dos', async () => {
    const net = makeNet(); net.seed('players', { p1: pl('p1') });
    const A = boot(net, 'A'), B = boot(net, 'B'); await sync(net);
    A.players.push(pl('pA')); await A.savePlayers();
    B.players.push(pl('pB')); await B.savePlayers();
    assert.deepStrictEqual(Object.keys(net.server.players).sort(), ['p1', 'pA', 'pB']);
});
test('jugadoras: antes de la primera lectura no escribe; si falla la red, cola de parches y aviso offline', async () => {
    const net = makeNet(); net.seed('players', { p1: pl('p1') });
    const A = boot(net, 'A');
    A.players = [pl('solo')]; assert.strictEqual(await A.savePlayers(), false); assert.strictEqual(A.writes().length, 0);
    await sync(net);
    A.players.push(pl('n')); A.dev.failNext = true;
    assert.strictEqual(await A.savePlayers(), false);
    assert.strictEqual(A.enq[0].mode, 'patch'); assert.deepStrictEqual(Object.keys(A.enq[0].data), ['n']);
    assert.ok(A.toasts.some(t => /sin conexión/.test(t[0])), 'avisa de guardado local');
});

console.log('\nFase 3b: gimnasio, tests, bloques de temporada y partidos');
test('gymSessions y testSessions: dos dispositivos, las dos se conservan y solo se escribe lo cambiado', async () => {
    const net = makeNet(); net.seed('gymSessions', { g1: { id: 'g1', date: '2026-10-01', rows: [{ exId: 'e1', kg: 50 }] } });
    net.seed('testSessions', { t1: { id: 't1', date: '2026-10-01', results: { p1: 10 } } });
    const A = boot(net, 'A'), B = boot(net, 'B'); await sync(net);
    A.gymSessions.push({ id: 'gA', date: '2026-10-02', rows: [] }); await A.saveGym();
    B.gymSessions.push({ id: 'gB', date: '2026-10-02', rows: [{ exId: 'e2', kg: 80 }] }); await B.saveGym();
    A.testSessions.push({ id: 'tA', date: '2026-10-03', results: { p2: 12 } }); await A.saveTests();
    B.testSessions.push({ id: 'tB', date: '2026-10-03', results: { p3: 14 } }); await B.saveTests();
    assert.deepStrictEqual(Object.keys(net.server.gymSessions).sort(), ['g1', 'gA', 'gB']);
    assert.deepStrictEqual(Object.keys(net.server.testSessions).sort(), ['t1', 'tA', 'tB']);
    assert.deepStrictEqual(Object.keys(A.writes()[0].value), ['gA']);
});
test('gymSessions: editar las filas de una sesión escribe solo esa sesión', async () => {
    const net = makeNet(); net.seed('gymSessions', { g1: { id: 'g1', rows: [{ exId: 'e1', kg: 50 }] }, g2: { id: 'g2', rows: [{ exId: 'e1', kg: 60 }] } });
    const A = boot(net, 'A'); await sync(net);
    A.gymSessions.find(g => g.id === 'g1').rows[0].kg = 55; await A.saveGym();
    assert.deepStrictEqual(Object.keys(A.writes()[0].value), ['g1']);
    assert.strictEqual(net.server.gymSessions.g1.rows[0].kg, 55);
});
test('seasonBlocks: la lectura puntual (loadSeasonBlocks) también habilita el guardado', async () => {
    const net = makeNet(); net.seed('seasonBlocks', { b1: { id: 'b1', start: '2026-09-01', end: '2026-10-01', name: 'Pretemporada' } });
    const A = boot(net, 'A');
    A.fs.loadSeasonBlocks(() => {}); await sync(net);
    A.seasonBlocks = A.seasonBlocks.concat([{ id: 'b2', start: '2026-10-02', end: '2026-11-01', name: 'Liga' }]);
    assert.strictEqual(await A.saveBlocks(), true);
    assert.deepStrictEqual(Object.keys(net.server.seasonBlocks).sort(), ['b1', 'b2']);
    assert.deepStrictEqual(Object.keys(A.writes()[0].value), ['b2']);
});
test('matches: añadir, editar y borrar un partido escribe solo ese partido; dos dispositivos se conservan', async () => {
    const net = makeNet(); net.seed('matches', { m1: { id: 'm1', date: '2026-10-10', rival: 'X' }, m2: { id: 'm2', date: '2026-10-17', rival: 'Y' } });
    const A = boot(net, 'A'), B = boot(net, 'B'); await sync(net);
    A.matches.find(m => m.id === 'm1').rival = 'X (editado)'; await A.saveMatches();
    B.matches.push({ id: 'm3', date: '2026-10-24', rival: 'Z' }); await B.saveMatches();
    B.matches = B.matches.filter(m => m.id !== 'm2'); await B.saveMatches();
    assert.deepStrictEqual(Object.keys(net.server.matches).sort(), ['m1', 'm3']);
    assert.strictEqual(net.server.matches.m1.rival, 'X (editado)');
});

console.log('\nFase 3b: disponibilidad (por rutas jugadora/fecha)');
test('disponibilidad: cambiar una fecha escribe solo "jugadora/fecha"', async () => {
    const net = makeNet(); net.seed('availability', { p1: { '2026-10-01': 'limited' }, p2: { '2026-10-01': 'unavailable' } });
    const A = boot(net, 'A'); await sync(net);
    A.availability.p1['2026-10-02'] = 'unavailable'; await A.saveAvail();
    assert.deepStrictEqual(A.writes()[0].value, { 'p1/2026-10-02': 'unavailable' });
    delete A.availability.p2['2026-10-01']; await A.saveAvail();
    assert.deepStrictEqual(A.writes()[1].value, { 'p2/2026-10-01': null });
    assert.deepStrictEqual(net.server.availability, { p1: { '2026-10-01': 'limited', '2026-10-02': 'unavailable' } });
});
test('disponibilidad: dos dispositivos editan fechas distintas de la MISMA jugadora y se conservan las dos', async () => {
    const net = makeNet(); net.seed('availability', { p1: { '2026-10-01': 'limited' } });
    const A = boot(net, 'A'), B = boot(net, 'B'); await sync(net);
    A.availability.p1['2026-10-05'] = 'unavailable'; await A.saveAvail();
    B.availability.p1['2026-10-06'] = 'limited'; await B.saveAvail();
    assert.deepStrictEqual(Object.keys(net.server.availability.p1).sort(), ['2026-10-01', '2026-10-05', '2026-10-06']);
});
test('disponibilidad: sin cambios no escribe; vaciar una jugadora borra solo sus fechas', async () => {
    const net = makeNet(); net.seed('availability', { p1: { a1: 'limited', a2: 'limited' }, p2: { a1: 'unavailable' } });
    const A = boot(net, 'A'); await sync(net);
    await A.saveAvail(); assert.strictEqual(A.writes().length, 0);
    A.availability.p1 = {}; await A.saveAvail();
    assert.deepStrictEqual(A.writes()[0].value, { 'p1/a1': null, 'p1/a2': null });
    assert.deepStrictEqual(net.server.availability, { p2: { a1: 'unavailable' } });
});
test('disponibilidad: primer arranque con el nodo sin crear: se sube lo local y no antes', async () => {
    const net = makeNet();                                              // availability no existe en el servidor
    const A = boot(net, 'A');
    A.availability = { p1: { '2026-10-01': 'limited' } };
    assert.strictEqual(await A.saveAvail(), false, 'antes de la primera lectura no escribe');
    await sync(net);
    assert.strictEqual(A.availNull, true);
    A.availability = { p1: { '2026-10-01': 'limited' } };               // lo que hace la app al ver null
    assert.strictEqual(await A.saveAvail(), true);
    assert.deepStrictEqual(net.server.availability, { p1: { '2026-10-01': 'limited' } });
});
test('disponibilidad: fecha con un carácter no válido → camino de siempre (set) y, si falla, cola', async () => {
    const net = makeNet(); net.seed('availability', { p1: { '2026-10-01': 'limited' } });
    const A = boot(net, 'A'); await sync(net);
    A.availability.p1['2026.10.02'] = 'limited';
    assert.strictEqual(await A.saveAvail(), false);
    assert.strictEqual(A.enq.length, 1); assert.strictEqual(A.enq[0].mode, undefined);
    assert.deepStrictEqual(net.server.availability, { p1: { '2026-10-01': 'limited' } });
});
test('con DIFF_WRITES_ENABLED = false todas vuelven al set() completo', async () => {
    const net = makeNet(); net.seed('players', { p1: pl('p1') }); net.seed('availability', { p1: { a: 'limited' } });
    const A = boot(net, 'A', { diffOff: true }); await sync(net);
    A.players.push(pl('p2')); await A.savePlayers();
    A.availability.p1.b = 'limited'; await A.saveAvail();
    assert.deepStrictEqual(A.writes().map(w => [w.op, w.path]), [['set', 'players'], ['set', 'availability']]);
});

(async () => {
    for (const t of queue) {
        try { await t.f(); passed++; console.log('  ✅ ' + t.n); }
        catch (e) { failed++; console.log('  ❌ ' + t.n + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

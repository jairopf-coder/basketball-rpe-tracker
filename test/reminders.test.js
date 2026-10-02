// test/reminders.test.js
// FASE 3 de los avisos: envío manual desde GitHub Actions.
// No necesita instalar nada: usa solo la lógica pura de scripts/lib/reminders.js
// y un Firebase y un web-push FALSOS.
// Ejecutar con:  node test/reminders.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const R = require(path.join(ROOT, 'scripts', 'lib', 'reminders.js'));
const { main } = require(path.join(ROOT, 'scripts', 'send-reminders.js'));
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }

// ── Mundo de pruebas ─────────────────────────────────────────────────────
const D = '2026-10-05';                       // lunes
const NOW = new Date('2026-10-05T16:00:00Z'); // 18:00 en Madrid → "hoy" = D
const sub = uid => ({ endpoint: `https://web.push.apple.com/endpoint-${uid}`, keys: { p256dh: `p256dh-${uid}`, auth: `auth-${uid}` }, updatedAt: '2026-10-01T10:00:00Z' });
function world(extra) {
    const data = {
        players: {
            p1: { id: 'p1', name: 'Ana Pérez',  authUid: 'uA' },
            p2: { id: 'p2', name: 'Bea Ruiz',   authUid: 'uB' },
            p3: { id: 'p3', name: 'Carla Gil',  authUid: 'uC' },   // cuenta vinculada, SIN avisos activados
            p4: { id: 'p4', name: 'Dani Mora' },                   // sin cuenta vinculada
            p5: { id: 'p5', name: 'Eva Sanz',   authUid: 'uE' },   // con lesión activa
            p6: { id: 'p6', name: 'Fran Lima',  authUid: 'uF' },
        },
        pushSubscriptions: { uA: sub('uA'), uB: sub('uB'), uE: sub('uE'), uF: sub('uF') },
        pushStatus: { uA: { active: true }, uB: { active: true }, uE: { active: true }, uF: { active: true } },
        wellness: {}, wellnessPlayer: {}, sessions: {}, playerRpeReports: {},
        injuries: { i1: { id: 'i1', playerId: 'p5', status: 'active' }, i2: { id: 'i2', playerId: 'p6', status: 'resolved' } },
    };
    return Object.assign(data, extra || {});
}
const at = (o, p) => p.split('/').reduce((a, k) => (a == null ? undefined : a[k]), o);
function fakeDb(data) {
    const removed = [];
    return { removed,
        get: async p => { const v = at(data, p); return v === undefined ? null : v; },
        remove: async p => { removed.push(p); },
        sessionsOnDate: async date => Object.values(data.sessions || {}).filter(s => String(s.date).startsWith(date)) };
}
function fakeSender(behaviour) {
    const calls = [];
    const fn = async (s, body, opts) => {
        calls.push({ s, body: JSON.parse(body), opts });
        const b = behaviour && behaviour[s.endpoint.split('endpoint-')[1]];
        if (b) throw b;
        return { statusCode: 201 };
    };
    fn.calls = calls; return fn;
}
const session = (id, playerId, over) => Object.assign({ id, playerId, date: D + 'T10:00:00', timeOfDay: 'morning', type: 'training', rpe: 6, duration: 60, load: 360 }, over || {});
// Ana y Bea ya han rellenado el wellness de hoy → faltan Carla, Dani, Eva y Fran → solo Eva y Fran pueden recibir el aviso
const w12 = () => world({ wellness: { a: { playerId: 'p1', date: D }, b: { playerId: 'p2', date: D } } });
async function go(input, data, behaviour) {
    const db = fakeDb(data || world()), sender = fakeSender(behaviour), logs = [];
    const summary = await R.run({ db, sender, input, now: NOW, log: m => logs.push(m) });
    return { summary, db, sender, logs };
}

// ═════════ Utilidades ═════════
console.log('\nUtilidades');
test('"hoy" se calcula en hora de MADRID (no en UTC), también cerca de medianoche y en cambio de hora', () => {
    assert.strictEqual(R.todayMadrid(new Date('2026-10-31T22:30:00Z')), '2026-10-31');   // 23:30 CET
    assert.strictEqual(R.todayMadrid(new Date('2026-10-31T23:30:00Z')), '2026-11-01');   // 00:30 CET
    assert.strictEqual(R.todayMadrid(new Date('2026-06-30T22:30:00Z')), '2026-07-01');   // 00:30 CEST (verano)
    assert.strictEqual(R.todayMadrid(new Date('2026-01-15T12:00:00Z')), '2026-01-15');
});
test('fechas: formato y existencia', () => {
    assert.ok(R.isValidDate('2026-10-05') && R.isValidDate('2028-02-29'));
    ['2026-02-30', '2026-13-01', '05/10/2026', 'hoy', '', '2026-1-5'].forEach(s => assert.ok(!R.isValidDate(s), s));
});
test('la clave pública se lee de push-client.js (vacía → null)', () => {
    assert.strictEqual(R.extractVapidPublicKey("const VAPID_PUBLIC_KEY = '';"), null);
    assert.strictEqual(R.extractVapidPublicKey("const VAPID_PUBLIC_KEY = 'BAbc_-123';"), 'BAbc_-123');
    assert.strictEqual(R.extractVapidPublicKey('nada'), null);
    const real = R.extractVapidPublicKey(read('push-client.js'));
    assert.ok(real === null || real.length === 87, 'la clave del repo debe estar vacía o tener 87 caracteres');
});
test('la dirección de la base de datos se saca del secreto FIREBASE_CONFIG (con o sin comillas en las claves)', () => {
    const url = 'https://mi-proyecto-default-rtdb.europe-west1.firebasedatabase.app';
    assert.strictEqual(R.parseDatabaseUrl(`{ apiKey: "x", databaseURL: "${url}", projectId: "p" }`), url);
    assert.strictEqual(R.parseDatabaseUrl(`{ "apiKey": "x", "databaseURL": "${url}" }`), url);
    assert.strictEqual(R.parseDatabaseUrl(`{\n  apiKey: 'x',\n  databaseURL: '${url}',\n}`), url);
    assert.strictEqual(R.parseDatabaseUrl('{ apiKey: "x" }'), null);
    assert.strictEqual(R.parseDatabaseUrl(undefined), null);
});
function newPair() {
    const e = crypto.createECDH('prime256v1'); e.generateKeys();
    return { pub: e.getPublicKey().toString('base64url'), priv: e.getPrivateKey().toString('base64url') };
}
test('claves VAPID: un par correcto pasa; uno cruzado, uno con la privada en la pública y viceversa fallan con mensaje claro', () => {
    const a = newPair(), b = newPair();
    assert.doesNotThrow(() => R.checkVapidPair(a.pub, a.priv));
    assert.throws(() => R.checkVapidPair(a.pub, b.priv), /NO corresponde/);
    assert.throws(() => R.checkVapidPair(a.priv, a.priv), /65 bytes/);
    assert.throws(() => R.checkVapidPair(a.pub, a.pub), /32 bytes/);
    assert.throws(() => R.checkVapidPair(a.pub, a.priv + '\n'), /caracteres no válidos/);
    assert.throws(() => R.checkVapidPair(a.pub, ''), /caracteres no válidos/);
    assert.throws(() => R.checkVapidPair('', a.priv), /caracteres no válidos/);
});

// ═════════ Entrada ═════════
console.log('\nEntrada del formulario');
test('valores por defecto: wellness, enviar, hoy', () => {
    const v = R.validateInput({}, D);
    assert.deepStrictEqual({ ...v }, { tipo: 'wellness', turno: null, modo: 'enviar', jugadora: '', fecha: D });
});
test('RPE exige un turno válido; "manana" sin ñ también vale', () => {
    assert.strictEqual(R.validateInput({ tipo: 'rpe', turno: 'tarde' }, D).turno, 'tarde');
    assert.strictEqual(R.validateInput({ tipo: 'rpe', turno: 'manana' }, D).turno, 'mañana');
    assert.strictEqual(R.validateInput({ tipo: 'rpe', turno: 'Partido' }, D).turno, 'partido');
    assert.throws(() => R.validateInput({ tipo: 'rpe', turno: 'noche' }, D), /mañana, tarde o partido/);
});
test('entradas no válidas se rechazan con un mensaje comprensible', () => {
    assert.throws(() => R.validateInput({ tipo: 'lesion' }, D), /Tipo no válido/);
    assert.throws(() => R.validateInput({ modo: 'borrar' }, D), /Modo no válido/);
    assert.throws(() => R.validateInput({ fecha: '2026-02-30' }, D), /AAAA-MM-DD/);
    assert.throws(() => R.validateInput({ fecha: 'hoy' }, D), /AAAA-MM-DD/);
    assert.throws(() => R.validateInput({ modo: 'prueba' }, D), /nombre de la jugadora/);
});
test('el turno se ignora en wellness; la fecha opcional se respeta', () => {
    const v = R.validateInput({ tipo: 'wellness', turno: 'tarde', fecha: '2026-09-28' }, D);
    assert.strictEqual(v.turno, null); assert.strictEqual(v.fecha, '2026-09-28');
});

// ═════════ Quién falta: wellness ═════════
console.log('\nWellness: quién recibe el aviso');
test('wellness: se avisa solo a quien falta, tiene cuenta vinculada y avisos activados', async () => {
    const data = world({
        wellness: { w1: { id: 'w1', playerId: 'p1', date: D },            // registrado por el staff
                    w2: { id: 'w2', playerId: 'p6', date: '2026-10-04' } }, // de AYER: no cuenta
        wellnessPlayer: { uB: { [D]: { sleep: 4 } } },                     // enviado por la propia jugadora
    });
    const { summary, sender } = await go({ tipo: 'wellness' }, data);
    assert.strictEqual(summary.done, 2);          // p1 (staff) y p2 (ella)
    assert.strictEqual(summary.pending, 4);       // p3, p4, p5, p6
    assert.strictEqual(summary.noAccount, 1);     // p4
    assert.strictEqual(summary.noPush, 1);        // p3
    assert.strictEqual(summary.toSend, 2);        // p5, p6
    assert.strictEqual(summary.sent, 2);
    assert.deepStrictEqual(sender.calls.map(c => c.s.endpoint).sort(), ['https://web.push.apple.com/endpoint-uE', 'https://web.push.apple.com/endpoint-uF']);
});
test('wellness: una lesión activa NO excluye del aviso de wellness', async () => {
    const { sender } = await go({ tipo: 'wellness' });
    assert.ok(sender.calls.some(c => c.s.endpoint.endsWith('endpoint-uE')));
});
test('wellness: si todas lo han rellenado no se envía nada', async () => {
    const wellness = {}; Object.keys(world().players).forEach(id => { wellness[id] = { playerId: id, date: D }; });
    const { summary, sender } = await go({ tipo: 'wellness' }, world({ wellness }));
    assert.strictEqual(summary.pending, 0); assert.strictEqual(sender.calls.length, 0);
});
test('wellness de otra fecha (parámetro "fecha")', async () => {
    const { summary } = await go({ tipo: 'wellness', fecha: '2026-10-04' }, world({ wellness: { w: { playerId: 'p1', date: '2026-10-04' } } }));
    assert.strictEqual(summary.date, '2026-10-04'); assert.strictEqual(summary.done, 1);
});

// ═════════ Quién falta: RPE ═════════
console.log('\nRPE: quién recibe el aviso');
test('RPE mañana: sesión del staff o RPE enviado por ella = hecho; lesionadas excluidas', async () => {
    const data = world({
        sessions: { s1: session('s1', 'p1') },
        playerRpeReports: { uB: { [D]: { morning: { rpe: 7 } } } },
    });
    const { summary, sender } = await go({ tipo: 'rpe', turno: 'mañana' }, data);
    assert.strictEqual(summary.done, 2); assert.strictEqual(summary.excluded, 1);   // p5 lesionada
    assert.strictEqual(summary.pending, 3);                                          // p3, p4, p6
    assert.strictEqual(summary.noAccount, 1); assert.strictEqual(summary.noPush, 1);
    assert.deepStrictEqual(sender.calls.map(c => c.s.endpoint), ['https://web.push.apple.com/endpoint-uF']);
});
test('RPE: una lesión YA RESUELTA no excluye a la jugadora', async () => {
    const { sender } = await go({ tipo: 'rpe', turno: 'mañana' });
    assert.ok(sender.calls.some(c => c.s.endpoint.endsWith('endpoint-uF')));
});
test('RPE mañana: el RPE de la TARDE, o una sesión de la tarde, no cuentan', async () => {
    const data = world({
        sessions: { s1: session('s1', 'p6', { timeOfDay: 'afternoon' }) },
        playerRpeReports: { uF: { [D]: { afternoon: { rpe: 5 } } } },
    });
    const { sender } = await go({ tipo: 'rpe', turno: 'mañana' }, data);
    assert.ok(sender.calls.some(c => c.s.endpoint.endsWith('endpoint-uF')), 'p6 sigue pendiente de la mañana');
});
test('RPE tarde: la sesión de la tarde sí cuenta', async () => {
    const data = world({ sessions: { s1: session('s1', 'p6', { timeOfDay: 'afternoon' }) } });
    const { sender } = await go({ tipo: 'rpe', turno: 'tarde' }, data);
    assert.ok(!sender.calls.some(c => c.s.endpoint.endsWith('endpoint-uF')));
});
test('RPE partido: cuenta una sesión de tipo partido (a cualquier hora) y no un entrenamiento', async () => {
    const data = world({ sessions: { s1: session('s1', 'p1', { type: 'match', timeOfDay: 'afternoon' }), s2: session('s2', 'p2') },
        playerRpeReports: { uF: { [D]: { match: { rpe: 8 } } } } });
    const { summary, sender } = await go({ tipo: 'rpe', turno: 'partido' }, data);
    assert.strictEqual(summary.done, 2);   // p1 (partido del staff) y p6 (RPE de partido enviado)
    assert.ok(sender.calls.some(c => c.s.endpoint.endsWith('endpoint-uB')), 'p2 solo tiene un entrenamiento: sigue pendiente del partido');
});
test('RPE: cualquier tipo de sesión no-partido de esa hora cuenta (recuperación, tiro…) y el descanso no', async () => {
    let d = world({ sessions: { s1: session('s1', 'p6', { type: 'recovery' }) } });
    assert.ok(!(await go({ tipo: 'rpe', turno: 'mañana' }, d)).sender.calls.some(c => c.s.endpoint.endsWith('uF')));
    d = world({ sessions: { s1: session('s1', 'p6', { type: 'rest' }) } });
    assert.ok((await go({ tipo: 'rpe', turno: 'mañana' }, d)).sender.calls.some(c => c.s.endpoint.endsWith('uF')));
});
test('RPE: una sesión de OTRO día no cuenta', async () => {
    const d = world({ sessions: { s1: session('s1', 'p6', { date: '2026-10-04T10:00:00' }) } });
    assert.ok((await go({ tipo: 'rpe', turno: 'mañana' }, d)).sender.calls.some(c => c.s.endpoint.endsWith('uF')));
});
test('RPE: un RPE ya descartado/revisado por el staff sigue contando como "enviado"', async () => {
    const d = world({ playerRpeReports: { uF: { [D]: { morning: { rpe: 5, reviewed: true } } } } });
    assert.ok(!(await go({ tipo: 'rpe', turno: 'mañana' }, d)).sender.calls.some(c => c.s.endpoint.endsWith('uF')));
});

// ═════════ Contenido ═════════
console.log('\nContenido del aviso');
test('wellness: texto genérico, etiqueta del día, TTL de 3 horas, sin datos personales', async () => {
    const { sender } = await go({ tipo: 'wellness' });
    const c = sender.calls[0];
    assert.strictEqual(c.body.title, '⏰ Wellness pendiente');
    assert.strictEqual(c.body.body, 'Recuerda rellenar tu wellness de hoy. Solo te llevará un minuto.');
    assert.strictEqual(c.body.tag, `wellness-${D}`); assert.strictEqual(c.body.url, '');
    assert.deepStrictEqual(c.opts, { TTL: 10800, urgency: 'normal' });
    assert.deepStrictEqual(Object.keys(c.body).sort(), ['body', 'tag', 'title', 'url']);
});
test('RPE: el texto menciona el turno', async () => {
    const m = await go({ tipo: 'rpe', turno: 'mañana' });  assert.ok(m.sender.calls[0].body.body.includes('entrenamiento de la mañana'));
    const t = await go({ tipo: 'rpe', turno: 'tarde' });   assert.ok(t.sender.calls[0].body.body.includes('entrenamiento de la tarde'));
    const p = await go({ tipo: 'rpe', turno: 'partido' }); assert.ok(p.sender.calls[0].body.body.includes('partido'));
    assert.strictEqual(m.sender.calls[0].body.tag, `rpe-${D}-morning`);
});
test('si la fecha no es hoy, el texto dice "del 04/10" en vez de "de hoy"', async () => {
    const { sender } = await go({ tipo: 'wellness', fecha: '2026-10-04' });
    assert.ok(sender.calls[0].body.body.includes('del 04/10') && !sender.calls[0].body.body.includes('hoy'));
});
test('el contenido NUNCA lleva nombres, uids ni direcciones', async () => {
    const { sender } = await go({ tipo: 'wellness' });
    const all = JSON.stringify(sender.calls.map(c => c.body));
    ['Ana', 'Bea', 'Carla', 'Dani', 'Eva', 'Fran', 'uA', 'uE', 'endpoint', 'apple'].forEach(s => assert.ok(!all.includes(s), 'aparece ' + s));
});

// ═════════ Modos ═════════
console.log('\nModos: simulacro y prueba');
test('simulacro: calcula y cuenta, pero NO envía nada ni toca la base de datos', async () => {
    const { summary, sender, db, logs } = await go({ tipo: 'wellness', modo: 'simulacro' }, w12());
    assert.strictEqual(summary.toSend, 2); assert.strictEqual(summary.sent, 0);
    assert.strictEqual(sender.calls.length, 0); assert.strictEqual(db.removed.length, 0);
    assert.ok(logs.some(l => l.includes('SIMULACRO') && l.includes('2 avisos')));
});
test('prueba: un aviso de prueba a UNA jugadora, aunque ya haya rellenado todo (nombre sin acentos y parcial)', async () => {
    const wellness = { w: { playerId: 'p1', date: D } };
    const { summary, sender } = await go({ modo: 'prueba', jugadora: 'perez' }, world({ wellness }));
    assert.strictEqual(sender.calls.length, 1); assert.strictEqual(summary.sent, 1);
    assert.ok(sender.calls[0].s.endpoint.endsWith('endpoint-uA'));
    assert.strictEqual(sender.calls[0].body.title, '🔔 Prueba de avisos'); assert.strictEqual(sender.calls[0].body.tag, 'prueba-avisos');
});
test('prueba: nombre ambiguo, inexistente, sin cuenta o sin avisos → error SIN revelar nombres', async () => {
    await assert.rejects(go({ modo: 'prueba', jugadora: 'a' }), e => /coincide con \d+ jugadoras/.test(e.message) && !/Ana|Bea|Carla/.test(e.message));
    await assert.rejects(go({ modo: 'prueba', jugadora: 'zzz' }), /Ninguna jugadora coincide/);
    await assert.rejects(go({ modo: 'prueba', jugadora: 'dani' }), /cuenta vinculada/);
    await assert.rejects(go({ modo: 'prueba', jugadora: 'carla' }), /avisos activados/);
});
test('prueba: una suscripción con datos incompletos o http:// se rechaza', async () => {
    const d = world(); d.pushSubscriptions.uA = { endpoint: 'http://insegura/x', keys: { p256dh: 'a', auth: 'b' } };
    await assert.rejects(go({ modo: 'prueba', jugadora: 'ana' }, d), /avisos activados/);
    const d2 = world(); d2.pushSubscriptions.uA = { endpoint: 'https://x/y' };
    await assert.rejects(go({ modo: 'prueba', jugadora: 'ana' }, d2), /avisos activados/);
});

// ═════════ Resultado del envío ═════════
console.log('\nResultado del envío');
test('410 y 404: el móvil ya no existe → se limpian su suscripción y su 🔔', async () => {
    const { summary, db } = await go({ tipo: 'wellness' }, w12(), { uE: { statusCode: 410 }, uF: { statusCode: 404 } });
    assert.strictEqual(summary.gone, 2); assert.strictEqual(summary.sent, 0); assert.strictEqual(summary.failed, 0);
    assert.deepStrictEqual(db.removed.sort(), ['pushStatus/uE', 'pushStatus/uF', 'pushSubscriptions/uE', 'pushSubscriptions/uF']);
});
test('429, 500 y errores de red: fallan pero NO se borra nada (se podrá reintentar)', async () => {
    const { summary, db } = await go({ tipo: 'wellness' }, w12(), { uE: { statusCode: 429 }, uF: new Error('ECONNRESET') });
    assert.strictEqual(summary.failed, 2); assert.strictEqual(summary.gone, 0); assert.strictEqual(db.removed.length, 0);
    assert.deepStrictEqual(summary.statusCodes, { 429: 1, red: 1 });
});
test('resultado mixto: uno entregado, otro caducado', async () => {
    const { summary, db } = await go({ tipo: 'wellness' }, w12(), { uF: { statusCode: 410 } });
    assert.deepStrictEqual([summary.sent, summary.gone, summary.failed], [1, 1, 0]);
    assert.deepStrictEqual(db.removed.sort(), ['pushStatus/uF', 'pushSubscriptions/uF']);
});
test('si falla la limpieza de la base de datos, el envío continúa', async () => {
    const db = fakeDb(w12()); db.remove = async () => { throw new Error('sin permisos'); };
    const sender = fakeSender({ uE: { statusCode: 410 } });
    const s = await R.run({ db, sender, input: { tipo: 'wellness' }, now: NOW });
    assert.strictEqual(s.gone, 1); assert.strictEqual(s.sent, 1);
});

// ═════════ Privacidad del registro ═════════
console.log('\nPrivacidad: el registro de GitHub puede ser público');
test('ninguna línea del registro ni del resumen contiene nombres, uids ni direcciones', async () => {
    const { summary, logs } = await go({ tipo: 'rpe', turno: 'mañana' }, world({ sessions: { s1: session('s1', 'p1') } }), { uF: { statusCode: 410 } });
    const text = logs.join('\n') + '\n' + R.summaryMarkdown(summary);
    ['Ana', 'Bea', 'Carla', 'Dani', 'Eva', 'Fran', 'Pérez', 'uA', 'uB', 'uE', 'uF', 'endpoint', 'apple.com', 'p256dh'].forEach(s => assert.ok(!text.includes(s), 'se ha filtrado: ' + s));
    assert.ok(/Pendientes: \d+/.test(text));
});
test('en modo prueba el registro tampoco incluye el nombre buscado', async () => {
    const { logs, summary } = await go({ modo: 'prueba', jugadora: 'Ana Pérez' });
    assert.ok(!(logs.join('\n') + R.summaryMarkdown(summary)).includes('Ana'));
});
test('el código no escribe nunca nombres, uids ni direcciones en el registro (revisión del código fuente)', () => {
    const forbidden = /\bp\.name\b|\.authUid\b|\buid\b|\.endpoint\b|\.sub\b|\.keys\.|\.jugadora\b|player\.name/;
    let revisadas = 0;
    [read('scripts/lib/reminders.js'), read('scripts/send-reminders.js')].forEach(src => {
        src.split('\n').filter(l => /\b(log|error|console\.(log|error|warn))\(/.test(l) && !/^\s*\/\//.test(l)).forEach(l => {
            revisadas++; assert.ok(!forbidden.test(l), 'línea sospechosa: ' + l.trim());
        });
    });
    assert.ok(revisadas >= 6, 'la revisión no encontró líneas de registro: ' + revisadas);
});

// ═════════ main(): configuración y orquestación ═════════
console.log('\nmain(): configuración y errores');
const PAIR = newPair();
const PUSH_CLIENT_OK = `const VAPID_PUBLIC_KEY = '${PAIR.pub}';`;
function fakeAdmin(data, spy) {
    const removed = spy.removed;
    const refFor = p => ({
        once: async () => ({ val: () => { const v = at(data, p); return v === undefined ? null : v; } }),
        remove: async () => { removed.push(p); },
        orderByChild: () => ({ startAt: d => ({ endAt: () => ({ once: async () => ({ val: () => {
            const m = Object.fromEntries(Object.entries(data.sessions || {}).filter(([, s]) => String(s.date).startsWith(d))); return Object.keys(m).length ? m : null; } }) }) }) }),
    });
    return {
        initializeApp: o => { spy.init = o; }, credential: { cert: c => ({ cert: c }) },
        database: () => ({ ref: refFor }), app: () => ({ delete: async () => { spy.closed = true; } }),
    };
}
function fakeWebpush(spy, behaviour) {
    return { setVapidDetails: (...a) => { spy.vapid = a; },
        sendNotification: async (s, body, opts) => { spy.sent.push({ s, body: JSON.parse(body), opts }); const b = behaviour && behaviour[s.endpoint.split('endpoint-')[1]]; if (b) throw b; return { statusCode: 201 }; } };
}
async function runMain(envOver, opts) {
    const o = Object.assign({ data: w12(), behaviour: null, pushClient: PUSH_CLIENT_OK }, opts || {});
    const spy = { removed: [], sent: [], summaries: [] }, out = [], err = [];
    const env = Object.assign({ TIPO: 'wellness', MODO: 'enviar', VAPID_PRIVATE_KEY: PAIR.priv,
        FIREBASE_SERVICE_ACCOUNT: JSON.stringify({ type: 'service_account', project_id: 'demo', private_key: 'SECRETO-PRIVADO' }),
        FIREBASE_CONFIG: '{ apiKey: "k", databaseURL: "https://demo-default-rtdb.firebaseio.com" }', GITHUB_REPOSITORY: 'JairoPF-Coder/basketball-rpe-tracker',
        GITHUB_STEP_SUMMARY: '/tmp/summary.md' }, envOver || {});
    const code = await main(env, { admin: fakeAdmin(o.data, spy), webpush: fakeWebpush(spy, o.behaviour), now: NOW,
        readFile: () => o.pushClient, appendFile: (f, t) => spy.summaries.push([f, t]), log: m => out.push(m), error: m => err.push(m) });
    return { code, spy, out, err };
}
test('camino feliz: envía, resume y CIERRA la conexión con Firebase', async () => {
    const r = await runMain();
    assert.strictEqual(r.code, 0); assert.strictEqual(r.spy.sent.length, 2); assert.strictEqual(r.spy.closed, true);
    assert.strictEqual(r.spy.init.databaseURL, 'https://demo-default-rtdb.firebaseio.com');
    assert.strictEqual(r.spy.summaries.length, 1); assert.strictEqual(r.spy.summaries[0][0], '/tmp/summary.md');
    assert.ok(r.spy.summaries[0][1].includes('Recordatorio de wellness'));
});
test('el "subject" VAPID se deduce del repositorio (en minúsculas) o del secreto VAPID_SUBJECT', async () => {
    assert.strictEqual((await runMain()).spy.vapid[0], 'https://jairopf-coder.github.io/basketball-rpe-tracker/');
    assert.strictEqual((await runMain({ VAPID_SUBJECT: 'mailto:yo@example.com' })).spy.vapid[0], 'mailto:yo@example.com');
    assert.strictEqual((await runMain()).spy.vapid[1], PAIR.pub); assert.strictEqual((await runMain()).spy.vapid[2], PAIR.priv);
});
test('FIREBASE_DATABASE_URL tiene prioridad sobre FIREBASE_CONFIG', async () => {
    const r = await runMain({ FIREBASE_DATABASE_URL: 'https://otra.firebaseio.com' });
    assert.strictEqual(r.spy.init.databaseURL, 'https://otra.firebaseio.com');
});
const failCase = (name, envOver, opts, re) => test(name, async () => {
    const r = await runMain(envOver, opts);
    assert.strictEqual(r.code, 1); assert.ok(re.test(r.err.join('\n')), 'mensaje: ' + r.err.join(' | '));
    assert.strictEqual(r.spy.sent.length, 0);
});
failCase('sin clave pública en push-client.js → error claro', {}, { pushClient: "const VAPID_PUBLIC_KEY = '';" }, /VAPID_PUBLIC_KEY.*vacía/);
failCase('sin secreto VAPID_PRIVATE_KEY → error claro', { VAPID_PRIVATE_KEY: '' }, null, /VAPID_PRIVATE_KEY/);
failCase('clave privada de otro par → error claro', { VAPID_PRIVATE_KEY: newPair().priv }, null, /NO corresponde/);
failCase('sin cuenta de servicio → error claro', { FIREBASE_SERVICE_ACCOUNT: '' }, null, /FIREBASE_SERVICE_ACCOUNT/);
failCase('cuenta de servicio que no es JSON → error claro', { FIREBASE_SERVICE_ACCOUNT: 'esto no es json' }, null, /no es un JSON válido/);
failCase('sin dirección de base de datos → error claro', { FIREBASE_CONFIG: '', FIREBASE_DATABASE_URL: '' }, null, /dirección de la base de datos/);
failCase('sin repositorio ni VAPID_SUBJECT → error claro', { GITHUB_REPOSITORY: '' }, null, /subject/);
failCase('tipo no válido → error claro', { TIPO: 'lesion' }, null, /Tipo no válido/);
test('los mensajes de error NUNCA contienen el valor de un secreto', async () => {
    const all = [];
    for (const over of [{ FIREBASE_SERVICE_ACCOUNT: 'SECRETO-PRIVADO{' }, { VAPID_PRIVATE_KEY: 'SECRETO-PRIVADO ' }, { VAPID_PRIVATE_KEY: newPair().priv }]) {
        const r = await runMain(over); all.push(...r.err, ...r.out);
    }
    all.forEach(m => assert.ok(!m.includes('SECRETO-PRIVADO') && !m.includes(PAIR.priv), 'filtra un secreto: ' + m));
});
test('si falla algo DESPUÉS de conectar, la conexión se cierra igualmente', async () => {
    const r = await runMain({ TIPO: 'rpe', TURNO: 'noche' });
    assert.strictEqual(r.code, 1); assert.strictEqual(r.spy.closed, true);
});
test('simulacro: código 0, nada enviado, resumen escrito', async () => {
    const r = await runMain({ MODO: 'simulacro' });
    assert.strictEqual(r.code, 0); assert.strictEqual(r.spy.sent.length, 0); assert.strictEqual(r.spy.summaries.length, 1);
});
test('nadie a quien enviar → código 0 (no es un error)', async () => {
    const wellness = {}; Object.keys(world().players).forEach(id => { wellness[id] = { playerId: id, date: D }; });
    assert.strictEqual((await runMain({}, { data: world({ wellness }) })).code, 0);
});
test('se avisa (sin nombres) de las jugadoras que NO pueden recibir el aviso', async () => {
    const r = await runMain();
    const notice = r.out.find(l => l.startsWith('::notice::'));
    assert.ok(notice && /2 jugadora\(s\)/.test(notice) && !/Carla|Dani/.test(notice));
});
test('si fallan TODOS los envíos → error (rojo en GitHub); si falla solo uno → aviso (amarillo)', async () => {
    const all = await runMain({}, { behaviour: { uE: { statusCode: 500 }, uF: { statusCode: 500 } } });
    assert.strictEqual(all.code, 1); assert.ok(all.err.some(l => l.includes('No se pudo enviar ningún aviso')));
    const some = await runMain({}, { behaviour: { uE: { statusCode: 500 } } });
    assert.strictEqual(some.code, 0); assert.ok(some.out.some(l => l.startsWith('::warning::')));
});
test('si no existe GITHUB_STEP_SUMMARY no falla', async () => {
    const r = await runMain({ GITHUB_STEP_SUMMARY: '' }); assert.strictEqual(r.code, 0); assert.strictEqual(r.spy.summaries.length, 0);
});
test('el adaptador de sesiones consulta la fecha correcta', async () => {
    const data = world({ sessions: { s1: session('s1', 'p6'), s2: session('s2', 'p1', { date: '2026-10-04T10:00:00' }) } });
    const r = await runMain({ TIPO: 'rpe', TURNO: 'mañana' }, { data });
    assert.ok(!r.spy.sent.some(s => s.s.endpoint.endsWith('endpoint-uF')), 'p6 tiene sesión hoy');
});

// ═════════ Estructura: workflow, dependencias, despliegue ═════════
console.log('\nEstructura del repositorio');
const wf = read('.github/workflows/enviar-recordatorio.yml');
test('workflow: SOLO se lanza a mano (sin schedule, push ni pull_request)', () => {
    assert.ok(/^on:\s*\n\s+workflow_dispatch:/m.test(wf));
    ['schedule:', 'push:', 'pull_request', 'workflow_run', 'repository_dispatch'].forEach(t => assert.ok(!wf.includes(t), 'no debería tener ' + t));
});
test('workflow: permisos mínimos y sin repetir envíos si se pulsa dos veces', () => {
    assert.ok(/^permissions:\s*\n\s+contents: read\s*$/m.test(wf));
    assert.ok(/concurrency:[\s\S]*cancel-in-progress: false/.test(wf));
    assert.ok(/timeout-minutes: \d/.test(wf));
});
test('workflow: los valores del formulario y los secretos van SOLO en "env:", nunca dentro de un comando (evita inyección)', () => {
    wf.split('\n').filter(l => /\$\{\{\s*(inputs|secrets|github\.event)/.test(l)).forEach(l =>
        assert.ok(/^\s+[A-Z_]+: \$\{\{ (inputs|secrets)\.\w+ \}\}\s*$/.test(l), 'uso inseguro: ' + l.trim()));
    assert.ok(!/run:.*\$\{\{/.test(wf));
});
test('workflow: usa los secretos que el script espera', () => {
    ['FIREBASE_SERVICE_ACCOUNT', 'FIREBASE_CONFIG', 'VAPID_PRIVATE_KEY'].forEach(s => assert.ok(wf.includes(`secrets.${s}`), s));
    ['TIPO', 'TURNO', 'MODO', 'JUGADORA', 'FECHA'].forEach(v => assert.ok(new RegExp(`${v}: \\$\\{\\{ inputs\\.${v.toLowerCase()} \\}\\}`).test(wf), v));
});
test('workflow: las opciones del formulario coinciden EXACTAMENTE con las que entiende el script', () => {
    const opts = name => { const m = wf.match(new RegExp(`      ${name}:\\n[\\s\\S]*?options:\\n((?:\\s+- .+\\n)+)`)); return m[1].trim().split('\n').map(l => l.replace(/^\s*- /, '').trim()); };
    assert.deepStrictEqual(opts('tipo'), R.TIPOS);
    assert.deepStrictEqual(opts('turno'), Object.keys(R.TURNOS));
    assert.deepStrictEqual(opts('modo'), R.MODOS);
    assert.ok(/default: enviar/.test(wf));
});
test('workflow: Node 22 (lo que exige firebase-admin) y dependencias fijadas con package-lock', () => {
    const pkg = JSON.parse(read('scripts/package.json')), lock = JSON.parse(read('scripts/package-lock.json'));
    assert.ok(/node-version: 22/.test(wf)); assert.strictEqual(pkg.engines.node, '>=22');
    assert.deepStrictEqual(Object.keys(pkg.dependencies).sort(), ['firebase-admin', 'web-push']);
    assert.ok(lock.packages['node_modules/firebase-admin'] && lock.packages['node_modules/web-push']);
    assert.ok(/npm ci --omit=dev/.test(wf));
});
test('el despliegue a GitHub Pages ya no publica scripts/ ni test/', () => {
    const d = read('.github/workflows/deploy.yml');
    assert.ok(/exclude_assets: '[^']*,scripts,test'/.test(d));
    assert.ok(d.includes('\r\n'), 'deploy.yml debe conservar sus saltos de línea de Windows');
});
test('node_modules no se sube a git', () => assert.ok(/^node_modules\/\s*$/m.test(read('.gitignore'))));
test('el service worker NO precachea los scripts del servidor', () => assert.ok(!/scripts\/|send-reminders/.test(read('sw.js'))));

(async () => {
    for (const q of queue) {
        try { await q.fn(); console.log(`  ✅ ${q.name}`); passed++; }
        catch (e) { console.log(`  ❌ ${q.name}\n     ${String(e.message).split('\n')[0]}`); failed++; }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

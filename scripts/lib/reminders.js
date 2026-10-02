// ======================================================================
// BasketballRPE-Web — scripts/lib/reminders.js
// Lógica del envío manual de recordatorios push. SIN dependencias: se puede
// probar entera con `node test/reminders.test.js`, sin instalar nada.
//
// Quién recibe el aviso:
//   - wellness: jugadoras sin wellness ese día (ni enviado por ellas ni registrado por el staff).
//   - rpe:      jugadoras sin RPE de la sesión elegida (ni enviado por ellas ni sesión registrada
//               por el staff). Se excluyen las que tienen una lesión activa.
//   En ambos casos hace falta que tengan la cuenta vinculada Y los avisos activados.
//
// PRIVACIDAD: el repositorio puede ser público y los registros de GitHub Actions también.
// Por eso NUNCA se escribe en el registro ningún nombre, uid ni dirección de móvil: solo cifras.
// ======================================================================
'use strict';

const crypto = require('crypto');

// Turnos del RPE (mismos valores que usa la app: ver player-view.js y app-sessions.js)
const TURNOS = {
    'mañana':  { sessionType: 'morning',   timeOfDay: 'morning',   match: false, label: 'entrenamiento de la mañana' },
    'tarde':   { sessionType: 'afternoon', timeOfDay: 'afternoon', match: false, label: 'entrenamiento de la tarde' },
    'partido': { sessionType: 'match',     timeOfDay: 'morning',   match: true,  label: 'partido' },
};
const TIPOS = ['wellness', 'rpe'];
const MODOS = ['enviar', 'simulacro', 'prueba'];

// ── Utilidades ────────────────────────────────────────────────────────

// Fecha de hoy (AAAA-MM-DD) en hora de Madrid, que es la que usa el equipo.
function todayMadrid(now = new Date()) {
    return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(now);
}

function normalize(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Firebase guarda las listas como objetos {id: elemento}; esto devuelve siempre un array.
function values(o) {
    if (!o) return [];
    return (Array.isArray(o) ? o : Object.values(o)).filter(Boolean);
}

function isValidDate(s) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const d = new Date(s + 'T12:00:00Z');
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

// Clave pública VAPID: se lee del propio push-client.js, para que haya una única fuente de verdad.
function extractVapidPublicKey(source) {
    const m = String(source || '').match(/const VAPID_PUBLIC_KEY = '([^']*)'/);
    return m && m[1] ? m[1] : null;
}

// La dirección de la base de datos sale del secreto FIREBASE_CONFIG que ya usa tu despliegue
// (es un objeto JavaScript pegado tal cual desde Firebase, con o sin comillas en las claves).
function parseDatabaseUrl(text) {
    const m = String(text || '').match(/databaseURL["']?\s*:\s*["']([^"']+)["']/);
    return m ? m[1] : null;
}

// Comprueba que la clave privada (secreto de GitHub) corresponde a la pública de la app.
function checkVapidPair(publicKey, privateKey) {
    const b64 = /^[A-Za-z0-9_-]+$/;
    if (!b64.test(publicKey || '')) throw new Error('La clave pública VAPID de push-client.js tiene caracteres no válidos.');
    if (!b64.test(privateKey || '')) throw new Error('El secreto VAPID_PRIVATE_KEY tiene caracteres no válidos (¿espacios o saltos de línea?).');
    const pub = Buffer.from(publicKey, 'base64url');
    const priv = Buffer.from(privateKey, 'base64url');
    if (pub.length !== 65 || pub[0] !== 4) throw new Error('La clave pública VAPID debe decodificar a 65 bytes. ¿Pegaste la privada en la app?');
    if (priv.length !== 32) throw new Error('El secreto VAPID_PRIVATE_KEY debe decodificar a 32 bytes. ¿Pegaste la pública en el secreto?');
    const ecdh = crypto.createECDH('prime256v1');
    ecdh.setPrivateKey(priv);
    if (!ecdh.getPublicKey().equals(pub)) {
        throw new Error('El secreto VAPID_PRIVATE_KEY NO corresponde a la clave pública de push-client.js (son de pares distintos).');
    }
}

// ── Entrada ───────────────────────────────────────────────────────────

function validateInput(raw, today) {
    const input = raw || {};
    const tipo = (input.tipo || 'wellness').trim();
    if (!TIPOS.includes(tipo)) throw new Error(`Tipo no válido: usa ${TIPOS.join(' o ')}.`);

    let turno = normalize(input.turno || 'mañana').replace('manana', 'mañana');
    if (tipo === 'rpe' && !TURNOS[turno]) throw new Error('Para el RPE elige turno: mañana, tarde o partido.');

    const modo = (input.modo || 'enviar').trim();
    if (!MODOS.includes(modo)) throw new Error(`Modo no válido: usa ${MODOS.join(', ')}.`);

    const jugadora = String(input.jugadora || '').trim();
    if (modo === 'prueba' && !jugadora) throw new Error('En modo prueba hay que escribir el nombre de la jugadora.');

    const fecha = String(input.fecha || '').trim() || today;
    if (!isValidDate(fecha)) throw new Error('La fecha debe tener el formato AAAA-MM-DD (por ejemplo 2026-10-05).');

    return { tipo, turno: tipo === 'rpe' ? turno : null, modo, jugadora, fecha };
}

// ── Contenido del aviso ───────────────────────────────────────────────
// Genérico a propósito: nunca lleva nombres ni datos de salud.
function buildPayload({ tipo, turno, date, today }) {
    const dd = `${date.slice(8, 10)}/${date.slice(5, 7)}`;
    const esHoy = date === today;
    if (tipo === 'wellness') {
        return { title: '⏰ Wellness pendiente', body: `Recuerda rellenar tu wellness${esHoy ? ' de hoy' : ' del ' + dd}. Solo te llevará un minuto.`, tag: `wellness-${date}`, url: '' };
    }
    const t = TURNOS[turno];
    return { title: '⏰ RPE pendiente', body: `Recuerda indicar tu RPE del ${t.label}${esHoy ? '' : ' del ' + dd}.`, tag: `rpe-${date}-${t.sessionType}`, url: '' };
}

function buildTestPayload() {
    return { title: '🔔 Prueba de avisos', body: 'Si ves esto, los recordatorios funcionan correctamente.', tag: 'prueba-avisos', url: '' };
}

// ── Quién falta ───────────────────────────────────────────────────────

async function findPending({ db, players, tipo, turno, date }) {
    const out = { pending: [], excluded: 0, done: 0 };

    if (tipo === 'wellness') {
        const staffDone = new Set(values(await db.get('wellness')).filter(w => w.date === date).map(w => w.playerId));
        for (const p of players) {
            let done = staffDone.has(p.id);
            if (!done && p.authUid) done = (await db.get(`wellnessPlayer/${p.authUid}/${date}`)) != null;
            if (done) out.done++; else out.pending.push(p);
        }
        return out;
    }

    // RPE
    const t = TURNOS[turno];
    const sessions = (await db.sessionsOnDate(date)).filter(s => s && String(s.date || '').slice(0, 10) === date);
    // Sesión del staff que cuenta como "ya registrado": partido → tipo partido; si no, mismo momento del día
    const staffDone = new Set(sessions.filter(s => t.match
        ? s.type === 'match'
        : s.type !== 'match' && s.type !== 'rest' && s.timeOfDay === t.timeOfDay).map(s => s.playerId));
    const injured = new Set(values(await db.get('injuries')).filter(i => i.status === 'active').map(i => i.playerId));
    for (const p of players) {
        let done = staffDone.has(p.id);
        if (!done && p.authUid) done = (await db.get(`playerRpeReports/${p.authUid}/${date}/${t.sessionType}`)) != null;
        if (done) { out.done++; continue; }
        if (injured.has(p.id)) { out.excluded++; continue; }
        out.pending.push(p);
    }
    return out;
}

function validSubscription(sub) {
    return !!(sub && typeof sub.endpoint === 'string' && sub.endpoint.startsWith('https://')
        && sub.keys && sub.keys.p256dh && sub.keys.auth);
}

// ── Orquestación ──────────────────────────────────────────────────────
//   db     : { get(path), remove(path), sessionsOnDate(date) }   (Firebase real o falso en las pruebas)
//   sender : (subscription, payloadString, options) => Promise   (web-push real o falso)
async function run({ db, sender, input, now = new Date(), log = () => {}, ttl = 10800 }) {
    const today = todayMadrid(now);
    const { tipo, turno, modo, jugadora, fecha } = validateInput(input, today);
    const date = fecha;
    const players = values(await db.get('players')).filter(p => p.id);

    const summary = { date, tipo, turno, modo, pending: 0, noAccount: 0, noPush: 0, excluded: 0, done: 0, toSend: 0, sent: 0, gone: 0, failed: 0, statusCodes: {} };
    let targets = [];   // { uid, sub }
    let payload;

    if (modo === 'prueba') {
        const q = normalize(jugadora);
        const matches = players.filter(p => normalize(p.name).includes(q));
        if (matches.length === 0) throw new Error('Ninguna jugadora coincide con ese nombre.');
        if (matches.length > 1) throw new Error(`El nombre coincide con ${matches.length} jugadoras: escribe nombre y apellido.`);
        const p = matches[0];
        if (!p.authUid) throw new Error('Esa jugadora no tiene la cuenta vinculada en la app.');
        const sub = await db.get(`pushSubscriptions/${p.authUid}`);
        if (!validSubscription(sub)) throw new Error('Esa jugadora no tiene los avisos activados (o su suscripción no es válida).');
        targets = [{ uid: p.authUid, sub }];
        payload = buildTestPayload();
        summary.pending = 1;
    } else {
        const found = await findPending({ db, players, tipo, turno, date });
        summary.pending = found.pending.length; summary.excluded = found.excluded; summary.done = found.done;
        for (const p of found.pending) {
            if (!p.authUid) { summary.noAccount++; continue; }
            const sub = await db.get(`pushSubscriptions/${p.authUid}`);
            if (!validSubscription(sub)) { summary.noPush++; continue; }
            targets.push({ uid: p.authUid, sub });
        }
        payload = buildPayload({ tipo, turno, date, today });
    }
    summary.toSend = targets.length;

    log(`Fecha ${date} · ${modo === 'prueba' ? 'prueba' : tipo + (turno ? ' (' + turno + ')' : '')} · modo ${modo}`);
    log(`Con ${tipo === 'rpe' ? 'RPE' : 'wellness'} ya registrado: ${summary.done} · Pendientes: ${summary.pending} · Sin cuenta vinculada: ${summary.noAccount} · Sin avisos activados: ${summary.noPush} · Excluidas por lesión: ${summary.excluded}`);

    if (modo === 'simulacro') { log(`SIMULACRO: se enviarían ${summary.toSend} avisos. No se ha enviado nada.`); return summary; }

    const body = JSON.stringify(payload);
    for (const t of targets) {   // pocas jugadoras: de una en una
        try {
            await sender({ endpoint: t.sub.endpoint, keys: { p256dh: t.sub.keys.p256dh, auth: t.sub.keys.auth } }, body, { TTL: ttl, urgency: 'normal' });
            summary.sent++;
        } catch (e) {
            const code = e && e.statusCode ? String(e.statusCode) : 'red';
            summary.statusCodes[code] = (summary.statusCodes[code] || 0) + 1;
            if (code === '404' || code === '410') {
                // El móvil ya no existe (app borrada o permiso retirado): se limpia para no insistir
                summary.gone++;
                try { await db.remove(`pushSubscriptions/${t.uid}`); await db.remove(`pushStatus/${t.uid}`); } catch (_) { /* se limpiará otro día */ }
            } else {
                summary.failed++;
            }
        }
    }
    log(`Enviados: ${summary.sent} · Móviles que ya no existen (limpiados): ${summary.gone} · Fallidos: ${summary.failed}`);
    if (Object.keys(summary.statusCodes).length) log(`Códigos de error: ${JSON.stringify(summary.statusCodes)}`);
    return summary;
}

// Resumen en Markdown para la página de la ejecución en GitHub. Solo cifras.
function summaryMarkdown(s) {
    const titulo = s.modo === 'prueba' ? 'Aviso de prueba' : `Recordatorio de ${s.tipo}${s.turno ? ' · ' + s.turno : ''}`;
    const filas = [
        ['Fecha', s.date], ['Modo', s.modo],
        ['Ya lo tenían registrado', s.done], ['Pendientes', s.pending],
        ['… sin cuenta vinculada', s.noAccount], ['… sin avisos activados (escríbeles por WhatsApp)', s.noPush],
        ['Excluidas por lesión activa', s.excluded],
        [s.modo === 'simulacro' ? 'Se enviarían' : 'Avisos enviados', s.modo === 'simulacro' ? s.toSend : s.sent],
        ['Móviles que ya no existen (limpiados)', s.gone], ['Fallidos', s.failed],
    ];
    return `### ${titulo}\n\n| | |\n|---|---|\n${filas.map(([a, b]) => `| ${a} | ${b} |`).join('\n')}\n\n_Por privacidad, aquí solo aparecen cifras: los nombres se ven en tu app, en «Faltan hoy»._\n`;
}

module.exports = { TURNOS, TIPOS, MODOS, todayMadrid, normalize, values, isValidDate, extractVapidPublicKey, parseDatabaseUrl,
    checkVapidPair, validateInput, buildPayload, buildTestPayload, findPending, validSubscription, run, summaryMarkdown };

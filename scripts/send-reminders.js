#!/usr/bin/env node
// ======================================================================
// BasketballRPE-Web — scripts/send-reminders.js
// Envía los recordatorios push a las jugadoras. Lo lanza a mano el staff desde
// GitHub → Actions → «Enviar recordatorio a jugadoras» (ver .github/workflows).
//
// Secretos de GitHub necesarios (Settings → Secrets and variables → Actions):
//   FIREBASE_SERVICE_ACCOUNT  JSON de la cuenta de servicio de Firebase (para leer la base de datos)
//   VAPID_PRIVATE_KEY         clave privada VAPID (la de generar-claves-vapid.html)
//   FIREBASE_CONFIG           (ya lo tienes, lo usa el despliegue) de ahí sale la dirección de la base de datos
//   FIREBASE_DATABASE_URL     (opcional) solo si prefieres indicarla a mano
//
// La clave pública VAPID se lee de push-client.js, para que haya una única fuente.
// ======================================================================
'use strict';

const fs = require('fs');
const path = require('path');
const R = require('./lib/reminders');

// Adaptador mínimo entre la lógica y Firebase (la lógica no conoce firebase-admin)
function makeAdminDb(admin) {
    const db = admin.database();
    return {
        get: async p => (await db.ref(p).once('value')).val(),
        remove: async p => { await db.ref(p).remove(); },
        sessionsOnDate: async date => {
            const snap = await db.ref('sessions').orderByChild('date').startAt(date).endAt(date + '\uf8ff').once('value');
            const v = snap.val();
            return v ? Object.values(v) : [];
        },
    };
}

// Devuelve el código de salida (0 = bien, 1 = error). `deps` permite inyectar piezas en las pruebas.
async function main(env = process.env, deps = {}) {
    const log = deps.log || console.log;
    const error = deps.error || console.error;
    const readFile = deps.readFile || (f => fs.readFileSync(f, 'utf8'));
    const appendFile = deps.appendFile || ((f, t) => fs.appendFileSync(f, t));
    let admin = null;
    try {
        // 1) Configuración (los mensajes de error nunca incluyen el valor de un secreto)
        const publicKey = R.extractVapidPublicKey(readFile(path.join(__dirname, '..', 'push-client.js')));
        if (!publicKey) throw new Error('Falta la clave pública VAPID: la constante VAPID_PUBLIC_KEY de push-client.js está vacía.');
        const privateKey = (env.VAPID_PRIVATE_KEY || '').trim();
        if (!privateKey) throw new Error('Falta el secreto VAPID_PRIVATE_KEY en GitHub.');
        R.checkVapidPair(publicKey, privateKey);

        if (!env.FIREBASE_SERVICE_ACCOUNT) throw new Error('Falta el secreto FIREBASE_SERVICE_ACCOUNT en GitHub.');
        let credentials;
        try { credentials = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT); }
        catch (_) { throw new Error('El secreto FIREBASE_SERVICE_ACCOUNT no es un JSON válido: pega el contenido completo del archivo descargado de Firebase.'); }

        const databaseURL = (env.FIREBASE_DATABASE_URL || '').trim() || R.parseDatabaseUrl(env.FIREBASE_CONFIG);
        if (!databaseURL) throw new Error('No se encuentra la dirección de la base de datos: añade el secreto FIREBASE_DATABASE_URL.');

        const repo = String(env.GITHUB_REPOSITORY || '');
        const subject = (env.VAPID_SUBJECT || '').trim()
            || (repo.includes('/') ? `https://${repo.split('/')[0].toLowerCase()}.github.io/${repo.split('/')[1]}/` : '');
        if (!subject) throw new Error('No se puede determinar el "subject" VAPID: define el secreto VAPID_SUBJECT (https://… o mailto:…).');

        // 2) Dependencias (instaladas por el workflow con npm ci)
        admin = deps.admin || require('firebase-admin');
        const webpush = deps.webpush || require('web-push');
        webpush.setVapidDetails(subject, publicKey, privateKey);
        admin.initializeApp({ credential: admin.credential.cert(credentials), databaseURL });

        // 3) Envío
        const summary = await R.run({
            db: makeAdminDb(admin),
            sender: (sub, body, opts) => webpush.sendNotification(sub, body, opts),
            input: { tipo: env.TIPO, turno: env.TURNO, modo: env.MODO, jugadora: env.JUGADORA, fecha: env.FECHA },
            now: deps.now || new Date(),
            log,
        });

        if (env.GITHUB_STEP_SUMMARY) appendFile(env.GITHUB_STEP_SUMMARY, R.summaryMarkdown(summary));

        // Aviso visible (sin nombres) si alguna jugadora no puede recibirlo
        if (summary.modo !== 'prueba' && (summary.noPush > 0 || summary.noAccount > 0)) {
            log(`::notice::${summary.noPush + summary.noAccount} jugadora(s) pendientes NO pueden recibir el aviso (sin avisos activados o sin cuenta vinculada). Escríbeles por WhatsApp.`);
        }
        if (summary.failed > 0) log(`::warning::${summary.failed} aviso(s) no se pudieron entregar. Mira los códigos de error arriba.`);
        // Error solo si había a quién enviar y NO se entregó ninguno
        if (summary.modo !== 'simulacro' && summary.toSend > 0 && summary.sent === 0) {
            error('::error::No se pudo enviar ningún aviso.');
            return 1;
        }
        return 0;
    } catch (e) {
        error(`::error::${e.message}`);
        return 1;
    } finally {
        // Sin esto, la conexión abierta con Firebase mantiene el proceso vivo y la ejecución no termina
        if (admin) { try { await admin.app().delete(); } catch (_) { /* ya cerrada */ } }
    }
}

module.exports = { main, makeAdminDb };

if (require.main === module) {
    main().then(code => process.exit(code));
}

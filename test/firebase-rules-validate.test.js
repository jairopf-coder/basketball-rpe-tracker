// ============================================================
//  test/firebase-rules-validate.test.js
//  Prueba las reglas .validate de firebase-rules.json con "targaryen", un
//  simulador de reglas de Realtime Database (evalúa .read, .write y .validate
//  con los datos nuevos). Complementa a test/firebase-rules.test.js, que no
//  necesita instalar nada pero no entiende .validate.
//
//  targaryen es opcional: si no está instalado, este test se salta sin fallar.
//  Para instalarlo FUERA del proyecto (así no ensucia el repositorio):
//      npm install --prefix ~/.rpe-tools targaryen
//  y ejecutar:
//      node test/firebase-rules-validate.test.js
//
//  La prueba definitiva sigue siendo el Simulador de reglas de la consola.
// ============================================================
'use strict';
const fs = require('fs');
const path = require('path');
const os = require('os');

let targaryen = null;
for (const p of ['targaryen', path.join(os.homedir(), '.rpe-tools', 'node_modules', 'targaryen')]) {
    try { targaryen = require(p); break; } catch (e) { /* probar el siguiente */ }
}
if (!targaryen) {
    console.log('SALTADO — targaryen no está instalado (ver instrucciones al principio de este fichero)');
    process.exit(0);
}
const file = process.argv[2] || path.join(__dirname, '..', 'firebase-rules.json');
const rules = JSON.parse(fs.readFileSync(file, 'utf8'));
const NOW = Date.now();
const base = {
  users: {
    staff1: { role: 'staff', email: 's@x.es', displayName: 'Staff' },
    fisio1: { role: 'fisio' },
    uA: { role: 'player', playerId: 'p1', displayName: 'Ana', email: 'a@x.es' },
    uB: { role: 'player', playerId: 'p2' },
    uC: { role: 'player', playerId: 'p9' },          // relinked: sus entradas antiguas llevan otro playerId
    uD: { role: 'player' },                          // sin vincular
  },
  playerRpeReports: { uA: { '2026-10-05': { match: { uid: 'uA', date: '2026-10-05', sessionType: 'match', rpe: 6, playerId: 'p1', ts: '2026-10-05T09:00:00.000Z' } } }, uC: { '2026-10-04': { match: { uid: 'uC', date: '2026-10-04', sessionType: 'match', rpe: 7, playerId: 'p1', ts: '2026-10-04T10:00:00.000Z' } } } },
  wellnessPlayer: { uC: { '2026-10-04': { uid: 'uC', date: '2026-10-04', sleep: 3, fatigue: 3, mood: 3, pain: 2, playerId: 'p1', ts: '2026-10-04T08:00:00.000Z' } } },
};
const db = () => targaryen.database(rules, base, NOW);
const as = (uid) => db().as(uid ? { uid } : null);
let fails = 0, n = 0;
function check(desc, res, esperado) {
  n++;
  if (res.allowed !== esperado) { fails++; console.log(`✗ ${desc}  (esperado ${esperado ? 'PERMITIDO' : 'DENEGADO'}, fue ${res.allowed ? 'PERMITIDO' : 'DENEGADO'})`); }
}
const W = (extra, del = []) => { const e = { uid: 'uA', date: '2026-10-05', sleep: 4, fatigue: 3, mood: 5, pain: 2, playerId: 'p1', ts: '2026-10-05T08:00:00.000Z', ...extra }; del.forEach(k => delete e[k]); return e; };
const R = (extra, del = []) => { const e = { uid: 'uA', date: '2026-10-05', sessionType: 'match', rpe: 7, playerId: 'p1', ts: '2026-10-05T10:00:00.000Z', ...extra }; del.forEach(k => delete e[k]); return e; };

// ===== LEGÍTIMO (no debe romper nada) =====
check('jugadora guarda su wellness completo', as('uA').write('/wellnessPlayer/uA/2026-10-05', W()), true);
check('wellness con regla (period:true)', as('uA').write('/wellnessPlayer/uA/2026-10-05', W({ period: true })), true);
check('wellness sin playerId (cuenta sin vincular)', as('uD').write('/wellnessPlayer/uD/2026-10-05', W({ uid: 'uD' }, ['playerId'])), true);
check('wellness con valores 1 y 5', as('uA').write('/wellnessPlayer/uA/2026-10-05', W({ sleep: 1, fatigue: 5, mood: 1, pain: 5 })), true);
for (const t of ['morning', 'afternoon', 'match']) {
  check('jugadora envía RPE ' + t, as('uA').write(`/playerRpeReports/uA/2026-10-05/${t}`, R({ sessionType: t })), true);
}
check('RPE 1 y 10', as('uA').write('/playerRpeReports/uA/2026-10-05/match', R({ rpe: 10 })), true);
check('RPE sin playerId', as('uD').write('/playerRpeReports/uD/2026-10-05/match', R({ uid: 'uD' }, ['playerId'])), true);
check('la cola offline reenvía una entrada idéntica', as('uA').write('/wellnessPlayer/uA/2026-10-05', W()), true);
check('staff marca RPE como revisado (update)', as('staff1').update('/playerRpeReports/uA/2026-10-05/match', { reviewed: true, reviewedAt: '2026-10-05T11:00:00.000Z' }), true);
check('staff marca revisado una entrada ANTIGUA con playerId de una cuenta re-vinculada', as('staff1').update('/playerRpeReports/uC/2026-10-04/match', { reviewed: true, reviewedAt: '2026-10-05T11:00:00.000Z' }), true);
check('fisio marca revisado', as('fisio1').update('/playerRpeReports/uC/2026-10-04/match', { reviewed: true, reviewedAt: '2026-10-05T11:00:00.000Z' }), true);
check('staff borra wellnessPlayer/uC (restaurar copia)', as('staff1').write('/wellnessPlayer/uC', null), true);
check('staff borra una entrada de RPE', as('staff1').write('/playerRpeReports/uC/2026-10-04/match', null), true);
check('staff crea un usuario (set con role)', as('staff1').write('/users/uNew', { email: 'n@x.es', role: 'player', displayName: 'Nueva', createdAt: 1727890000000 }), true);
check('staff cambia role a fisio', as('staff1').write('/users/uA/role', 'fisio'), true);
check('staff vincula playerId', as('staff1').write('/users/uA/playerId', '1727890000000_ab12c'), true);
check('staff actualiza displayName (update)', as('staff1').update('/users/uA', { displayName: 'Ana López' }), true);
check('jugadora cambia su propio displayName', as('uA').write('/users/uA/displayName', 'Ana L.'), true);
check('jugadora lee su rol', as('uA').read('/users/uA/role'), true);
check('staff lee todo wellnessPlayer', as('staff1').read('/wellnessPlayer'), true);
check('fisio lee playerRpeReports', as('fisio1').read('/playerRpeReports'), true);

// ===== ATAQUES (deben seguir denegados) =====
check('playerId de OTRA jugadora en wellness', as('uA').write('/wellnessPlayer/uA/2026-10-05', W({ playerId: 'p2' })), false);
check('playerId de OTRA jugadora en RPE', as('uA').write('/playerRpeReports/uA/2026-10-05/match', R({ playerId: 'p2' })), false);
check('cuenta sin vincular intenta poner un playerId', as('uD').write('/wellnessPlayer/uD/2026-10-05', W({ uid: 'uD', playerId: 'p1' })), false);
check('sleep con HTML', as('uA').write('/wellnessPlayer/uA/2026-10-05', W({ sleep: '<img src=x onerror=alert(1)>' })), false);
check('sleep fuera de rango', as('uA').write('/wellnessPlayer/uA/2026-10-05', W({ sleep: 99 })), false);
check('mood negativo', as('uA').write('/wellnessPlayer/uA/2026-10-05', W({ mood: -1 })), false);
check('ts con HTML largo', as('uA').write('/wellnessPlayer/uA/2026-10-05', W({ ts: 'x'.repeat(100) })), false);
check('period no booleano', as('uA').write('/wellnessPlayer/uA/2026-10-05', W({ period: 'sí' })), false);
check('clave de fecha basura', as('uA').write("/wellnessPlayer/uA/x');alert(1);('", W()), false);
check('fecha dentro ≠ clave', as('uA').write('/wellnessPlayer/uA/2026-10-05', W({ date: '2026-10-06' })), false);
check('uid falsificado dentro de la entrada', as('uA').write('/wellnessPlayer/uA/2026-10-05', W({ uid: 'uB' })), false);
check('nodo del uid como texto', as('uA').write('/wellnessPlayer/uA', 'hola'), false);
check('entrada como número', as('uA').write('/wellnessPlayer/uA/2026-10-05', 5), false);
check('RPE 0', as('uA').write('/playerRpeReports/uA/2026-10-05/match', R({ rpe: 0 })), false);
check('RPE 11', as('uA').write('/playerRpeReports/uA/2026-10-05/match', R({ rpe: 11 })), false);
check('RPE con HTML', as('uA').write('/playerRpeReports/uA/2026-10-05/match', R({ rpe: '<img src=x>' })), false);
check('turno inventado', as('uA').write('/playerRpeReports/uA/2026-10-05/rest', R({ sessionType: 'rest' })), false);
check('turno con código', as('uA').write("/playerRpeReports/uA/2026-10-05/x');alert(1);('", R()), false);
check('sessionType ≠ clave', as('uA').write('/playerRpeReports/uA/2026-10-05/match', R({ sessionType: 'morning' })), false);
check('fecha basura en RPE', as('uA').write('/playerRpeReports/uA/hoy/match', R({ date: 'hoy' })), false);
check('RPE sin campo rpe', as('uA').write('/playerRpeReports/uA/2026-10-05/match', R({}, ['rpe'])), false);
check('jugadora se marca reviewed con valor no booleano', as('uA').update('/playerRpeReports/uA/2026-10-05/match', { reviewed: 'x' }), false);
check('una jugadora no escribe en el nodo de otra', as('uA').write('/wellnessPlayer/uB/2026-10-05', W({ uid: 'uB', playerId: 'p2' })), false);
check('jugadora cambia su role', as('uA').write('/users/uA/role', 'staff'), false);
check('jugadora cambia su playerId', as('uA').write('/users/uA/playerId', 'p2'), false);
check('staff vincula un playerId válido', as('staff1').write('/users/uA/playerId', 'p1'), true);
check('playerId de usuario enorme', as('staff1').write('/users/uA/playerId', 'x'.repeat(200)), false);
check('playerId de usuario no es texto', as('staff1').write('/users/uA/playerId', { a: 1 }), false);
check('staff escribe role mal escrito', as('staff1').write('/users/uA/role', 'Player'), false);
check('displayName enorme', as('uA').write('/users/uA/displayName', 'x'.repeat(5000)), false);
check('displayName no texto', as('uA').write('/users/uA/displayName', { a: 1 }), false);
check('email enorme', as('uA').write('/users/uA/email', 'x'.repeat(500)), false);
check('cuenta sin sesión escribe wellness', as(null).write('/wellnessPlayer/uA/2026-10-05', W()), false);
check('cuenta sin rol lee players', as('ghost').read('/players'), false);
check('cuenta sin rol escribe sessions', as('ghost').write('/sessions/x', { a: 1 }), false);

if (fails) { console.log(`\n${fails} de ${n} comprobaciones FALLAN (${file})`); process.exit(1); }
console.log(`OK — ${n} comprobaciones superadas (${file})`);

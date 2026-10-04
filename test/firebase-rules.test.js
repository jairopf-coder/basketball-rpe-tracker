// ============================================================
//  test/firebase-rules.test.js
//  Simula las reglas de firebase-rules.json (sin Firebase, sin npm).
//  Uso:  node test/firebase-rules.test.js
//
//  Es una simulación sencilla: evalúa las expresiones .read/.write de
//  cada nivel y aplica la cascada (si un nivel superior concede el
//  acceso, también vale para los hijos). NO valida .validate ni .indexOn.
//  La prueba definitiva sigue siendo el Simulador de reglas de la consola.
// ============================================================
const fs = require('fs');
const path = require('path');

const rulesFile = process.argv[2] || path.join(__dirname, '..', 'firebase-rules.json');
const RULES = JSON.parse(fs.readFileSync(rulesFile, 'utf8')).rules;

// Usuarios de prueba: "ghost" tiene cuenta en Auth pero NO nodo /users (el caso peligroso)
const DB_USERS = {
    staff1: { role: 'staff' },
    fisio1: { role: 'fisio' },
    player1: { role: 'player' },
    player2: { role: 'player' },
    typo1: { role: 'Player' }          // rol mal escrito
};

function makeRoot() {
    const node = (p) => ({
        child: (k) => node(p.concat(String(k))),
        val: () => {
            let cur = { users: DB_USERS };
            for (const k of p) { cur = cur == null ? null : cur[k]; }
            return cur === undefined ? null : cur;
        }
    });
    return node([]);
}

// ¿Permite la regla `op` (".read" o ".write") sobre `segments` al usuario `uid`?
function allowed(op, segments, uid) {
    const auth = uid ? { uid } : null;
    const root = makeRoot();
    const vars = {};
    let node = RULES;
    for (let i = 0; ; i++) {
        if (typeof node[op] === 'boolean' && node[op]) return true;
        if (typeof node[op] === 'string') {
            const names = Object.keys(vars);
            const fn = new Function('auth', 'root', ...names, 'return (' + node[op] + ');');
            let ok = false;
            try { ok = !!fn(auth, root, ...names.map(n => vars[n])); } catch (e) { ok = false; }
            if (ok) return true;
        }
        if (i >= segments.length) return false;
        const seg = segments[i];
        if (Object.prototype.hasOwnProperty.call(node, seg) && !seg.startsWith('.')) {
            node = node[seg];
        } else {
            const wild = Object.keys(node).find(k => k.startsWith('$'));
            if (!wild) return false;
            vars[wild] = seg;
            node = node[wild];
        }
    }
}

let fallos = 0, total = 0;
function esperar(descripcion, valor, esperado) {
    total++;
    if (valor !== esperado) {
        fallos++;
        console.error(`✗ ${descripcion}  (esperado ${esperado}, obtenido ${valor})`);
    }
}

// --- Nodos "de datos": solo staff y fisio, nadie más ---
const NODOS_DATOS = ['players', 'sessions', 'wellness', 'injuries', 'availability', 'gpsData',
    'gpsPlayerMap', 'exerciseLibrary', 'gymTemplates', 'templates', 'strength', 'gymSessions',
    'testSessions', 'weekPlan', 'clinicalNotes', 'seasonBlocks', 'matches', 'nodoInventado'];
for (const nodo of NODOS_DATOS) {
    for (const op of ['.read', '.write']) {
        esperar(`staff ${op} /${nodo}`, allowed(op, [nodo, 'x'], 'staff1'), true);
        esperar(`fisio ${op} /${nodo}`, allowed(op, [nodo, 'x'], 'fisio1'), true);
        esperar(`jugadora ${op} /${nodo}`, allowed(op, [nodo, 'x'], 'player1'), false);
        esperar(`cuenta SIN rol ${op} /${nodo}`, allowed(op, [nodo, 'x'], 'ghost'), false);
        esperar(`rol mal escrito ${op} /${nodo}`, allowed(op, [nodo, 'x'], 'typo1'), false);
        esperar(`sin sesión ${op} /${nodo}`, allowed(op, [nodo, 'x'], null), false);
    }
}
esperar('cuenta SIN rol lee /anamnesis/p1', allowed('.read', ['anamnesis', 'p1'], 'ghost'), false);
esperar('jugadora lee /anamnesis/p1', allowed('.read', ['anamnesis', 'p1'], 'player1'), false);
esperar('fisio escribe /anamnesis/p1', allowed('.write', ['anamnesis', 'p1'], 'fisio1'), true);

// --- /users ---
esperar('staff lee /users', allowed('.read', ['users'], 'staff1'), true);
esperar('fisio NO lee /users', allowed('.read', ['users'], 'fisio1'), false);
esperar('cuenta SIN rol NO lee /users', allowed('.read', ['users'], 'ghost'), false);
esperar('fisio lee su propio /users/fisio1', allowed('.read', ['users', 'fisio1'], 'fisio1'), true);
esperar('fisio lee su propio rol', allowed('.read', ['users', 'fisio1', 'role'], 'fisio1'), true);
esperar('jugadora lee su propio rol', allowed('.read', ['users', 'player1', 'role'], 'player1'), true);
esperar('jugadora NO lee el usuario de otra', allowed('.read', ['users', 'player2'], 'player1'), false);
esperar('jugadora NO se cambia el rol', allowed('.write', ['users', 'player1', 'role'], 'player1'), false);
esperar('cuenta SIN rol NO se da rol', allowed('.write', ['users', 'ghost', 'role'], 'ghost'), false);
esperar('staff cambia roles', allowed('.write', ['users', 'player1', 'role'], 'staff1'), true);
esperar('fisio NO cambia roles', allowed('.write', ['users', 'player1', 'role'], 'fisio1'), false);

// --- Datos de las propias jugadoras ---
for (const nodo of ['wellnessPlayer', 'playerRpeReports']) {
    esperar(`jugadora escribe su /${nodo}`, allowed('.write', [nodo, 'player1', '2026-10-04'], 'player1'), true);
    esperar(`jugadora NO escribe /${nodo} de otra`, allowed('.write', [nodo, 'player2', '2026-10-04'], 'player1'), false);
    esperar(`jugadora NO lee /${nodo} entero`, allowed('.read', [nodo], 'player1'), false);
    esperar(`staff lee /${nodo} entero`, allowed('.read', [nodo], 'staff1'), true);
    esperar(`fisio lee /${nodo} entero`, allowed('.read', [nodo], 'fisio1'), true);
    esperar(`cuenta SIN rol NO lee /${nodo} entero`, allowed('.read', [nodo], 'ghost'), false);
}

// --- Push (solo la dueña; el staff y el fisio leen el estado) ---
esperar('staff NO lee /pushSubscriptions de una jugadora', allowed('.read', ['pushSubscriptions', 'player1'], 'staff1'), false);
esperar('jugadora lee su /pushSubscriptions', allowed('.read', ['pushSubscriptions', 'player1'], 'player1'), true);
esperar('staff lee /pushStatus', allowed('.read', ['pushStatus'], 'staff1'), true);
esperar('fisio lee /pushStatus', allowed('.read', ['pushStatus'], 'fisio1'), true);
esperar('cuenta SIN rol NO lee /pushStatus', allowed('.read', ['pushStatus'], 'ghost'), false);

// --- Raíz cerrada ---
esperar('nadie lee la raíz sin rol', allowed('.read', [], 'ghost'), false);

if (fallos) {
    console.error(`\n${fallos} de ${total} comprobaciones FALLAN`);
    process.exit(1);
}
console.log(`OK — ${total} comprobaciones de reglas superadas (${path.basename(rulesFile)})`);

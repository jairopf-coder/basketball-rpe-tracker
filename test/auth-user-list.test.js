// ============================================================
//  test/auth-user-list.test.js
//  Comprueba que la lista de usuarios (AppAuth._loadUserList) escapa
//  nombres/emails con HTML y que los botones solo llevan el uid.
//  Uso:  node test/auth-user-list.test.js
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ATAQUE = '<img src=x onerror=alert(1)>';
const NOMBRE_COMILLAS = `Ana" onmouseover="alert(2)`;

const container = { innerHTML: '' };
const toastCalls = [];
const sandbox = {
    console,
    sessionStorage: { getItem() { return null; }, setItem() {} },
    setTimeout, clearTimeout,
    document: {
        addEventListener() {},
        getElementById: (id) => (id === 'um-user-list' ? container : null),
        // Igual que el navegador: textContent -> innerHTML escapa & < >
        createElement: () => {
            let txt = '';
            return {
                set textContent(v) { txt = String(v); },
                get innerHTML() { return txt.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
            };
        }
    },
    firebase: {},
    addEventListener() {},
    window: {}
};
sandbox.window = sandbox;
sandbox.firebaseDB = {
    ref: () => ({
        once: async () => ({
            val: () => ({
                uidAAA: { displayName: ATAQUE, email: 'a@rpe.app', role: 'player', playerId: 'p1' },
                uidBBB: { displayName: NOMBRE_COMILLAS, email: `b"@rpe.app`, role: 'staff' }
            })
        })
    })
};
sandbox.rpeTracker = { players: [{ id: 'p1', name: ATAQUE }] };
vm.createContext(sandbox);

const codigo = fs.readFileSync(path.join(__dirname, '..', 'auth.js'), 'utf8');
vm.runInContext(codigo + '\n;globalThis.__AppAuth = AppAuth;', sandbox);
// esc() vive en security.js
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'security.js'), 'utf8').split('// ── 2.')[0], sandbox);
const AppAuth = sandbox.__AppAuth;

let fallos = 0;
const ok = (cond, msg) => { if (!cond) { fallos++; console.error('✗ ' + msg); } };

(async () => {
    await AppAuth._loadUserList();
    const html = container.innerHTML;

    ok(!html.includes('<img'), 'el HTML del nombre NO debe llegar sin escapar');
    ok(html.includes('&lt;img'), 'el nombre debe verse como texto escapado');
    ok(!/onclick="[^"]*alert/.test(html), 'ningún onclick debe contener texto de usuario');
    ok(html.includes(`onclick="AppAuth._umEdit('uidAAA')"`), 'el botón editar solo lleva el uid');
    ok(html.includes(`onclick="AppAuth._umDelete('uidBBB')"`), 'el botón borrar solo lleva el uid');
    ok(html.includes(`onclick="AppAuth._umReset('uidBBB')"`), 'el botón reset solo lleva el uid');

    // Los wrappers deben pasar el nombre/email correctos a las funciones originales
    const llamadas = [];
    AppAuth.editUser = (uid, name) => llamadas.push(['edit', uid, name]);
    AppAuth.openFirebaseUserReset = (email) => llamadas.push(['reset', email]);
    AppAuth.deleteUser = (uid, name) => llamadas.push(['delete', uid, name]);
    AppAuth._umEdit('uidBBB');
    AppAuth._umReset('uidBBB');
    AppAuth._umDelete('uidBBB');
    ok(JSON.stringify(llamadas[0]) === JSON.stringify(['edit', 'uidBBB', NOMBRE_COMILLAS]), 'editUser recibe el nombre exacto (con comillas)');
    ok(JSON.stringify(llamadas[1]) === JSON.stringify(['reset', 'b"@rpe.app']), 'reset recibe el email exacto');
    ok(JSON.stringify(llamadas[2]) === JSON.stringify(['delete', 'uidBBB', NOMBRE_COMILLAS]), 'deleteUser recibe el nombre exacto');
    // uid desconocido: no debe romper
    AppAuth._umDelete('uid-inexistente');
    ok(llamadas[3] && llamadas[3][2] === 'uid-inexistente', 'uid desconocido cae al propio uid sin error');

    if (fallos) { console.error(`\n${fallos} comprobaciones FALLAN`); process.exit(1); }
    console.log('OK — lista de usuarios escapada y botones solo con uid');
})().catch(e => { console.error('Error en el test:', e); process.exit(1); });

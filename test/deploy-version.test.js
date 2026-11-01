// ============================================================
//  test/deploy-version.test.js
//  El despliegue sella CACHE_VERSION de sw.js con un sufijo único (-bNN):
//   · el paso existe, en el orden correcto, y deploy.yml no mezcla saltos de línea (CRLF y LF)
//   · se EJECUTA el script real del paso sobre una copia de sw.js
//   · si sw.js cambia de formato avisa (::warning::) sin romper el despliegue
//   · el service worker sellado sigue funcionando (nombre de caché y limpieza de las viejas)
//  Uso:  node test/deploy-version.test.js      (necesita bash y sed; si no hay, se salta)
// ============================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const vm = require('vm');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const swRepo = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const wfRaw = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'deploy.yml'), 'utf8');
const wf = wfRaw.replace(/\r\n/g, '\n');

const hayBash = spawnSync('bash', ['-c', 'sed --version >/dev/null 2>&1 || sed -E "" </dev/null'], { encoding: 'utf8' }).status === 0;
if (!hayBash) { console.log('SALTADO — hace falta bash y sed'); process.exit(0); }

let passed = 0, failed = 0;
const queue = [];
const test = (n, f) => queue.push({ n, f });

// Script del paso "Stamp service worker version"
function scriptDelPaso() {
    const ini = wf.indexOf('      - name: Stamp service worker version');
    assert.ok(ini >= 0, 'no existe el paso de sellado');
    const bloque = wf.slice(ini).split(/\n      - name: /)[0];
    const m = /run: \|\n([\s\S]*)$/.exec(bloque);
    assert.ok(m, 'el paso no tiene bloque run');
    return m[1].split('\n').map(l => l.replace(/^ {10}/, '')).join('\n');
}
function ejecutar(swTexto, runNumber) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rpe-deploy-'));
    fs.writeFileSync(path.join(dir, 'sw.js'), swTexto);
    const r = spawnSync('bash', ['-e', '-c', scriptDelPaso()], { cwd: dir, env: Object.assign({}, process.env, { GITHUB_RUN_NUMBER: String(runNumber) }), encoding: 'utf8' });
    const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
    fs.rmSync(dir, { recursive: true, force: true });
    return { status: r.status, out: r.stdout + r.stderr, sw };
}
const versionBase = /^const CACHE_VERSION = '([^']*)';/m.exec(swRepo)[1];

console.log('\nDefinición del paso');
test('existe, va después de generar firebase-config.js y antes de publicar', () => {
    const iCheckout = wf.indexOf('actions/checkout'), iInject = wf.indexOf('- name: Inject Firebase config');
    const iSello = wf.indexOf('- name: Stamp service worker version'), iDeploy = wf.indexOf('- name: Deploy to GitHub Pages');
    assert.ok(iCheckout >= 0 && iCheckout < iInject && iInject < iSello && iSello < iDeploy, [iCheckout, iInject, iSello, iDeploy].join(','));
});
// .gitattributes lleva «* text=auto»: git guarda los archivos de texto con LF y en un checkout limpio
// (GitHub Actions) llegan con LF, mientras que en un ordenador con Windows o heredado de él pueden estar en
// CRLF. Las dos cosas son válidas; lo que NO debe haber es un archivo con ambos tipos mezclados.
test('deploy.yml tiene saltos de línea homogéneos (todo CRLF o todo LF, sin mezclar)', () => {
    const crlf = wfRaw.split('\r\n').length - 1;
    const lfSueltos = (wfRaw.split('\n').length - 1) - crlf;
    assert.ok(crlf === 0 || lfSueltos === 0, `mezcla de saltos: ${crlf} CRLF y ${lfSueltos} LF sueltos`);
});
test('la versión del repositorio es una base limpia (sin sufijo -b) y mantiene el formato vNNN', () => {
    assert.ok(/^v\d+$/.test(versionBase), versionBase);
    assert.ok(/^const CACHE_VERSION = 'v\d+';/m.test(swRepo), 'la línea de la versión del repositorio no lleva sufijo');
});

console.log('\nEjecución real del paso sobre una copia de sw.js');
test('sella CACHE_VERSION con el nº de ejecución y no toca nada más', () => {
    const r = ejecutar(swRepo, 87);
    assert.strictEqual(r.status, 0, r.out);
    assert.strictEqual(r.sw, swRepo.replace(`const CACHE_VERSION = '${versionBase}';`, `const CACHE_VERSION = '${versionBase}-b87';`));
    assert.ok(r.out.includes(`const CACHE_VERSION = '${versionBase}-b87';`), 'lo muestra en el registro');
    assert.ok(!r.out.includes('::warning::'));
});
test('cada ejecución da una versión distinta', () => {
    const a = ejecutar(swRepo, 88).sw, b = ejecutar(swRepo, 89).sw;
    assert.notStrictEqual(a, b);
    assert.ok(/-b88';/.test(a) && /-b89';/.test(b));
});
test('si sw.js cambia de formato: aviso (::warning::), fichero intacto y el despliegue NO se rompe', () => {
    const raro = swRepo.replace("const CACHE_VERSION = '" + versionBase + "';", "const VERSION_DE_CACHE = '" + versionBase + "';");
    const r = ejecutar(raro, 90);
    assert.strictEqual(r.status, 0, 'el paso no debe fallar: ' + r.out);
    assert.ok(r.out.includes('::warning::'), r.out);
    assert.strictEqual(r.sw, raro);
});

console.log('\nEl service worker sellado sigue funcionando');
function cargarSw(texto, cachesExistentes) {
    const handlers = {}, borradas = [];
    const ctx = vm.createContext({
        console: { log() {}, warn() {}, error() {} }, URL, Promise,
        caches: { keys: () => Promise.resolve(cachesExistentes), delete: (k) => { borradas.push(k); return Promise.resolve(true); }, open: () => Promise.resolve({ add: () => Promise.resolve(), put() {} }), match: () => Promise.resolve(undefined) },
        fetch: () => Promise.reject(new Error('sin red')),
    });
    ctx.self = ctx;
    ctx.registration = { scope: 'https://usuario.github.io/basketball-rpe-tracker/' };
    ctx.location = { href: 'https://usuario.github.io/basketball-rpe-tracker/sw.js' };
    ctx.addEventListener = (tipo, fn) => { handlers[tipo] = fn; };
    ctx.clients = { claim: () => Promise.resolve() };
    vm.runInContext(texto + '\n;globalThis.__nombre = CACHE_NAME;', ctx, { filename: 'sw.js' });
    return { handlers, borradas, nombre: ctx.__nombre };
}
test('el nombre de la caché lleva la versión sellada y al activarse borra las anteriores (también las selladas)', async () => {
    const sellado = ejecutar(swRepo, 87).sw;
    const actuales = [`rpe-basketball-${versionBase}-b87`, `rpe-basketball-${versionBase}-b86`, 'rpe-basketball-v100', 'otra-app-cache'];
    const { handlers, borradas, nombre } = cargarSw(sellado, actuales);
    assert.strictEqual(nombre, `rpe-basketball-${versionBase}-b87`);
    let espera; await handlers.activate({ waitUntil: (p) => { espera = p; } }); await espera;
    assert.deepStrictEqual(borradas.sort(), [`rpe-basketball-${versionBase}-b86`, 'rpe-basketball-v100'].sort(), 'borra las viejas y respeta la actual y las ajenas');
});
test('el nombre de caché sellado solo usa caracteres seguros', () => {
    assert.ok(/^rpe-basketball-[A-Za-z0-9._-]+$/.test(cargarSw(ejecutar(swRepo, 123456).sw, []).nombre));
});

(async () => {
    for (const t of queue) {
        try { await t.f(); passed++; console.log('  ✅ ' + t.n); }
        catch (e) { failed++; console.log('  ❌ ' + t.n + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

// ============================================================
//  test/xss-lote3.test.js  (Fase 2b, lote 3 — último)
//  1) csvCell(): comillas duplicadas y neutralización de fórmulas
//  2) _doExportCSV() real: el CSV exportado no puede ejecutar fórmulas
//     y los datos normales salen EXACTAMENTE igual que antes
//  3) Partidos (objectives.js), botones de jugadoras (app-sessions.js)
//     y selector de jugadora (auth.js): sin HTML ni código
//  Uso:  node test/xss-lote3.test.js
// ============================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const secSrc = read('security.js').split('// ── 2.')[0];
const EVIL = '<img src=x onerror=alert(1)>';
const QUOTE = `O'Brien "la Flecha" & Co`;
const noCode = (html, donde) => {
    assert.ok(!html.includes('<img'), donde + ': hay un <img sin escapar');
    assert.ok(!/onerror=[^&]*>/.test(html.replace(/&lt;img[^&]*&gt;/g, '')), donde + ': onerror activo');
};

let passed = 0, failed = 0;
const queue = [];
const test = (n, f) => queue.push({ n, f });

// ---------- entorno común ----------
function baseCtx(extra) {
    const ctx = vm.createContext(Object.assign({
        console, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, parseFloat, isNaN, isFinite, Promise, setTimeout,
        localStorage: { getItem: () => null, setItem() {} },
        document: {
            getElementById: () => null, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, click() {} }),
            head: { appendChild() {} }, body: { appendChild() {}, removeChild() {} }, addEventListener() {},
        },
        window: {}, PlayerTokens: { get: () => '#123', avatar: () => '' },
    }, extra || {}));
    ctx.window = ctx;
    vm.runInContext(secSrc + '\n;globalThis.esc = esc; globalThis.csvCell = typeof csvCell === "function" ? csvCell : undefined;', ctx);
    vm.runInContext('function RPETracker() {}', ctx);
    return ctx;
}

// ---------- 1) csvCell ----------
console.log('\ncsvCell()');
test('comillas duplicadas, vacío/null → "", números sin cambios', () => {
    const c = baseCtx().csvCell;
    assert.strictEqual(c('Ana'), '"Ana"');
    assert.strictEqual(c(QUOTE), '"O\'Brien ""la Flecha"" & Co"');
    assert.strictEqual(c(''), '""'); assert.strictEqual(c(null), '""'); assert.strictEqual(c(undefined), '""');
    assert.strictEqual(c(7), '"7"');
    assert.strictEqual(c('línea1\nlínea2'), '"línea1\nlínea2"');
});
test('neutraliza fórmulas: = + - @ tabulador y retorno de carro', () => {
    const c = baseCtx().csvCell;
    for (const v of ['=1+1', '+34 600', '-5', '@SUM(A1)', '\tcmd', '\rcmd', `=HYPERLINK("http://x","clic")`]) {
        assert.ok(c(v).startsWith('"\''), v + ' → ' + c(v));
    }
    assert.strictEqual(c('a=b'), '"a=b"');          // solo importa el primer carácter
});

// ---------- 2) exportación CSV real ----------
console.log('\nExportación CSV (app.js → _doExportCSV)');
function extraerMetodo(src, nombre) {
    const ini = src.indexOf(`    ${nombre}() {`);
    assert.ok(ini >= 0, 'no encuentro ' + nombre);
    let i = src.indexOf('{', ini), depth = 0;
    for (; i < src.length; i++) {
        if (src[i] === '{') depth++;
        else if (src[i] === '}' && --depth === 0) break;
    }
    return src.slice(ini, i + 1);
}
function exportar(players, sessions) {
    let csv = null;
    const ctx = baseCtx({
        Blob: function (parts) { csv = parts.join(''); }, URL: { createObjectURL: () => 'blob:x' },
    });
    ctx.document.getElementById = id => ({ csvFrom: { value: '' }, csvTo: { value: '' }, csvIncludeEWMA: { checked: false } })[id] || null;
    const obj = vm.runInContext('({' + extraerMetodo(read('app.js'), '_doExportCSV') + '})', ctx);
    obj.players = players; obj.sessions = sessions; obj.showToast = () => {};
    obj.calculateAcuteChronicRatio = () => ({ acute: 1, chronic: 1, ratio: '1.00' }); obj.getRatioStatus = () => 'Óptimo';
    obj._doExportCSV();
    return csv;
}
const sesion = (o) => Object.assign({ id: 's1', playerId: 'p1', date: '2026-10-01T10:00:00', timeOfDay: 'morning', type: 'training', rpe: 5, duration: 60, load: 300 }, o);
test('datos normales: la fila sale en el MISMO formato que antes', () => {
    const csv = exportar([{ id: 'p1', name: 'Ana López', number: '7' }], [sesion({ notes: 'ok' })]);
    const fila = csv.split('\n').find(l => l.startsWith('"Ana López"'));
    const fecha = new Date('2026-10-01T10:00:00').toLocaleDateString('es-ES');   // depende del idioma de Node
    assert.strictEqual(fila, `"Ana López","7","${fecha}","Mañana","Entrenamiento",5,60,300,"ok"`);
    assert.ok(csv.includes('"Ana López","7",1,5.0,300'), 'fila del resumen por jugadora');
});
test('nombre, dorsal y notas con fórmulas o comillas quedan inertes', () => {
    const csv = exportar([{ id: 'p1', name: '=cmd|\' /C calc\'!A0', number: '+1' }], [sesion({ notes: '"hola", =1+1\nlínea' })]);
    assert.ok(csv.includes(`"'=cmd|' /C calc'!A0","'+1"`), 'nombre y dorsal con apóstrofo delante');
    assert.ok(csv.includes('"""hola"", =1+1\nlínea"'), 'comillas duplicadas en notas');
    csv.split('\n').forEach(l => assert.ok(!/^[=+\-@]/.test(l), 'ninguna línea empieza por un carácter de fórmula: ' + l.slice(0, 30)));
});
test('jugadora con comillas en el nombre: el CSV no se rompe', () => {
    const csv = exportar([{ id: 'p1', name: QUOTE, number: '' }], [sesion({})]);
    assert.ok(csv.includes('"O\'Brien ""la Flecha"" & Co","",'), csv.split('\n')[1]);
});

// ---------- 3) pantallas ----------
console.log('\nPantallas');
test('partidos: la tarjeta escapa rival, sede, hora, competición y equipos', () => {
    const ctx = baseCtx();
    vm.runInContext(`function _formatDate(){return {day:'01',month:'oct',weekday:'jue'};}`, ctx);
    vm.runInContext(read('objectives.js'), ctx, { filename: 'objectives.js' });
    const T = vm.runInContext('new RPETracker()', ctx);
    const html = T._objMatchCard({ id: 'm1', date: '2026-10-01', venue: EVIL, rival: EVIL, time: EVIL, competition: EVIL, localTeam: EVIL, visitorTeam: QUOTE, localScore: 70, visitorScore: 65 }, true, false);
    noCode(html, 'tarjeta de partido');
    assert.ok(html.includes('O&#39;Brien &quot;la Flecha&quot; &amp; Co'), 'equipo legítimo visible');
    assert.ok(html.includes('70 – 65') || html.includes('70') && html.includes('65'), 'marcador visible');
});
test('partidos: el formulario de edición no se rompe con comillas ni HTML', () => {
    const ctx = baseCtx();
    const wrap = { style: {}, innerHTML: '', scrollIntoView() {} };
    ctx.document.getElementById = id => (id === 'objFormWrap' ? wrap : null);
    vm.runInContext(`function _todayStr(){return '2026-10-05';} function _formatDate(){return {};}`, ctx);
    vm.runInContext(read('objectives.js'), ctx, { filename: 'objectives.js' });
    const T = vm.runInContext('new RPETracker()', ctx);
    T.matches = [{ id: 'm1', date: '2026-10-01', venue: QUOTE, rival: `Ana" onfocus="alert(1)`, time: '10:00', competition: 'Liga', localTeam: EVIL, visitorTeam: QUOTE }];
    T._objShowForm('m1');
    assert.ok(wrap.innerHTML.length > 300, 'el formulario se pintó');
    noCode(wrap.innerHTML, 'formulario de partido');
    assert.ok(!/id="objRival"[^>]*value="[^"]*"\s+onfocus/.test(wrap.innerHTML), 'el rival no se sale del value="…"');
    assert.ok(wrap.innerHTML.includes('value="O&#39;Brien &quot;la Flecha&quot; &amp; Co"'), 'valor legítimo íntegro');
});
test('sesiones: botones de jugadora escapan nombre y dorsal', () => {
    const ctx = baseCtx();
    const cont = { innerHTML: '' };
    ctx.document.getElementById = id => (id === 'playerButtons' ? cont : null);
    vm.runInContext(read('app-sessions.js'), ctx, { filename: 'app-sessions.js' });
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = [{ id: 'p1', name: EVIL, number: EVIL }, { id: 'p2', name: QUOTE, number: '7' }];
    T.selectedPlayerIds = []; T._attachPlayerButtonListeners = () => {}; T._updateSelectAllBtn = () => {};
    T.renderPlayerButtonsMulti();
    noCode(cont.innerHTML, 'botones de jugadora');
    assert.ok(cont.innerHTML.includes('O&#39;Brien &quot;la Flecha&quot; &amp; Co'), 'nombre legítimo visible');
});
test('auth: el selector de jugadora escapa nombre y dorsal', () => {
    const ctx = baseCtx({ firebase: {}, addEventListener() {}, sessionStorage: { getItem: () => null, setItem() {} } });
    ctx.window.rpeTracker = { players: [{ id: 'p1', name: EVIL, number: EVIL }, { id: 'p2', name: QUOTE, number: '7' }] };
    vm.runInContext(read('auth.js') + '\n;globalThis.__A = AppAuth;', ctx, { filename: 'auth.js' });
    const html = ctx.__A._playerOptionsHtml('p2');
    noCode(html, 'selector');
    assert.ok(html.includes('O&#39;Brien &quot;la Flecha&quot; &amp; Co #7'), 'nombre legítimo y dorsal visibles');
    assert.ok(html.includes('selected'), 'la jugadora seleccionada se mantiene');
});

(async () => {
    for (const q of queue) {
        try { await q.f(); passed++; console.log('  ✅ ' + q.n); }
        catch (e) { failed++; console.log('  ❌ ' + q.n + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

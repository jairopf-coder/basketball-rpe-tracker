// ============================================================
//  test/xss-lote1.test.js  (Fase 2b, lote 1)
//  Renderiza con datos maliciosos las pantallas de lesiones y notas clínicas
//  y comprueba que no se cuela HTML ni código, y que lo legítimo se sigue viendo.
//  Uso:  node test/xss-lote1.test.js
// ============================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const secSrc = fs.readFileSync(path.join(ROOT, 'security.js'), 'utf8').split('// ── 2.')[0];

const EVIL = '<img src=x onerror=alert(1)>';
const QUOTE = `O'Brien "la Flecha" & <b>`;

function load(files) {
    const els = {};
    const ctx = vm.createContext({
        console, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, parseFloat, isNaN, isFinite, Promise, setTimeout,
        localStorage: { getItem: () => null, setItem() {} },
        document: {
            getElementById: id => els[id] || null, querySelector: () => null, querySelectorAll: () => [],
            createElement: () => ({ style: {}, setAttribute() {}, appendChild() {}, classList: { add() {}, remove() {} } }),
            head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {},
        },
        window: {},
    });
    ctx.window = ctx;
    vm.runInContext(secSrc + '\n;globalThis.esc = esc;', ctx);
    vm.runInContext('function RPETracker() {}', ctx);
    files.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
    const T = vm.runInContext('new RPETracker()', ctx);
    T.showToast = () => {};
    return { T, ctx, els };
}
const noCode = (html, msg) => {
    assert.ok(!html.includes('<img'), (msg || '') + ' — hay un <img sin escapar');
    assert.ok(!/<b>/.test(html), (msg || '') + ' — hay un <b> sin escapar');
    assert.ok(!/onerror=/.test(html.replace(/&lt;img[^&]*onerror=[^&]*&gt;/g, '')), (msg || '') + ' — onerror activo');
};

let passed = 0, failed = 0;
const pending = [];
const test = (n, f) => pending.push({ n, f });

console.log('\nNotas clínicas (injury-management-2.js)');
function notesSetup() {
    const { T, ctx } = load(['injury-management-2.js']);
    T.players = [{ id: 'p1', name: EVIL, number: QUOTE }, { id: 'p2', name: QUOTE }];
    T.clinicalNotes = [
        { id: 'n1', playerId: 'p1', date: '2026-10-01', text: `Dolor <script>alert(1)</script>\nsegunda línea ${EVIL}` },
        { id: 'n2', playerId: 'p2', date: '2026-10-02', text: `Ana's "nota" & más\nlínea 2` },
    ];
    T.initClinicalNotes = () => {};
    return { T, ctx };
}
test('el panel de notas escapa nombre y texto, pero conserva los saltos de línea (<br>)', () => {
    const { T } = notesSetup();
    const c = { innerHTML: '' };
    T._renderClinicalNotesPanel(c);
    noCode(c.innerHTML, 'panel');
    assert.ok(!c.innerHTML.includes('<script>alert'), 'sin <script>');
    assert.ok(c.innerHTML.includes('<br>'), 'los saltos de línea de la nota siguen siendo <br>');
    assert.ok(c.innerHTML.includes('Ana&#39;s &quot;nota&quot; &amp; más'), 'el texto legítimo con comillas y & se ve bien');
    // el desplegable de jugadoras
    assert.ok(c.innerHTML.includes('&lt;img src=x onerror=alert(1)&gt;'), 'el nombre se muestra como texto');
});
test('editar nota: el textarea lleva el texto escapado y Cancelar solo lleva el id', () => {
    const { T, ctx } = notesSetup();
    const div = { innerHTML: '' };
    ctx.document.getElementById = id => (id === 'cn-text-n2' ? div : null);
    T._editClinicalNoteInline('n2');
    assert.ok(/<textarea[^>]*>Ana&#39;s &quot;nota&quot; &amp; más\nlínea 2<\/textarea>/.test(div.innerHTML), div.innerHTML.slice(0, 300));
    assert.ok(div.innerHTML.includes(`_cancelEditNote('n2')`), 'Cancelar solo lleva el id');
    assert.ok(!/_cancelEditNote\('n2','/.test(div.innerHTML), 'ya no viaja el texto dentro del onclick');
    // con texto malicioso: no se puede salir de textarea ni del onclick
    const div1 = { innerHTML: '' };
    ctx.document.getElementById = id => (id === 'cn-text-n1' ? div1 : null);
    T._editClinicalNoteInline('n1');
    noCode(div1.innerHTML, 'editar');
    assert.ok(!div1.innerHTML.includes('</textarea><'), 'no se cierra el textarea desde dentro');
});
test('cancelar edición: restaura la nota desde memoria, escapada y con <br>', () => {
    const { T, ctx } = notesSetup();
    const div = { innerHTML: '' };
    ctx.document.getElementById = id => (id === 'cn-text-n1' ? div : null);
    T._cancelEditNote('n1');
    noCode(div.innerHTML, 'cancelar');
    assert.ok(div.innerHTML.includes('<br>'));
    ctx.document.getElementById = () => null;
    T._cancelEditNote('inexistente');          // no debe lanzar
});

console.log('\nDisponibilidad y lesiones (injury-management*.js)');
test('fila de disponibilidad: nombre y dorsal escapados', () => {
    const { T } = load(['injury-management.js', 'injury-management-2.js']);
    T.injuries = [];
    T.availability = {};
    const html = T.renderAvailabilityRow({ id: 'p1', name: EVIL, number: QUOTE }, [new Date(2026, 9, 1)]);
    noCode(html, 'fila');
    assert.ok(html.includes('&lt;img'), 'se ve como texto');
});
test('tarjeta de lesión: nombre, dorsal, mecanismo y tratamiento inicial escapados', () => {
    const { T } = load(['injury-management.js']);
    T.players = [{ id: 'p1', name: EVIL, number: QUOTE }];
    const injury = {
        id: 'i1', playerId: 'p1', status: 'active', severity: 'moderate', rtpPhase: 2, rtpProgress: 40,
        type: 'Esguince', mechanism: EVIL, initialTreatment: `Hielo "ya" ${EVIL}`, injuryDate: '2026-10-01',
        getDaysInjured: () => 3, getExpectedReturn: () => null, rtpCriteria: {},
    };
    T.getLocationName = v => String(v || ''); T.getTypeName = v => String(v || ''); T.getSeverityName = v => String(v || '');
    let html;
    try { html = T.renderInjuryCard(injury); }
    catch (e) { throw new Error('renderInjuryCard lanzó: ' + e.message); }
    noCode(html, 'tarjeta');
    assert.ok(html.includes('Hielo &quot;ya&quot;'), 'el tratamiento legítimo se ve');
});

(async () => {
    for (const t of pending) {
        try { await t.f(); passed++; console.log('  ✅ ' + t.n); }
        catch (e) { failed++; console.log('  ❌ ' + t.n + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

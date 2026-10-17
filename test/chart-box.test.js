// ============================================================
//  test/chart-box.test.js
//  Guarda contra gráficos Chart.js "aplastados".
//
//  Con maintainAspectRatio:false Chart.js dibuja con el alto de la CAJA que
//  contiene al <canvas>. Si esa caja lleva más contenido (título, métricas,
//  botones…) o el CSS fuerza otra altura con !important, el gráfico se dibuja
//  más alto de lo que se muestra y los textos salen achatados.
//  Regla: el <canvas> va SOLO dentro de una caja con position:relative y
//  altura fija propia.
//
//  Uso:  node test/chart-box.test.js
// ============================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let passed = 0, failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }

// Devuelve el cuerpo de una regla CSS ".selector { ... }" (la primera que haya)
function cssRule(css, selector) {
    const esc = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const m = new RegExp('(^|\\n)' + esc + '\\s*\\{([^}]*)\\}').exec(css);
    return m ? m[2] : null;
}

const css = read('styles.css');

console.log('\nCajas de gráfico (CSS)');
[
    ['.chart-box', 'Análisis (carga por jugadora y temporada)'],
    ['.detail-rpe-hist-box', 'histograma de RPE del detalle de sesión']
].forEach(([sel, what]) => {
    test(`${sel} (${what}): position:relative y altura fija sin !important`, () => {
        const body = cssRule(css, sel);
        assert.ok(body, `no existe la regla ${sel}`);
        assert.ok(/position:\s*relative/.test(body), 'falta position: relative');
        assert.ok(/(^|[;\s])height:\s*\d+(\.\d+)?(px|rem)\s*;/.test(body), 'falta una altura fija');
        assert.ok(!/!important/.test(body), 'no debe usar !important');
    });
});
test('ya no existe la regla antigua que forzaba el alto del lienzo (.chart-canvas / .detail-rpe-hist-canvas)', () => {
    assert.strictEqual(cssRule(css, '.chart-canvas'), null);
    assert.strictEqual(cssRule(css, '.detail-rpe-hist-canvas'), null);
});

console.log('\nPlantillas: el canvas va solo dentro de su caja');
test('Análisis: gráfico por jugadora y de temporada', () => {
    const src = read('app-analytics.js');
    assert.ok(src.includes('<div class="chart-box"><canvas id="chart-${p.id}"></canvas></div>'));
    assert.ok(src.includes('<div class="chart-box"><canvas id="season-chart-${p.id}"></canvas></div>'));
    assert.ok(!/class="chart-canvas"/.test(src), 'queda un canvas con la clase antigua');
});
test('Detalle de sesión: histograma de RPE', () => {
    const src = read('app-sessions.js');
    assert.ok(src.includes('<div class="detail-rpe-hist-box"><canvas id="rpeHistogramCanvas"></canvas></div>'));
    assert.ok(!/detail-rpe-hist-canvas/.test(src));
});
test('Microciclo: gráfico de comparación', () => {
    const src = read('microciclo.js');
    assert.ok(src.includes('<div class="mc-chart-box"><canvas id="mcWeekCompareChart"></canvas></div>'));
    assert.ok(/\.mc-chart-box\{position:relative;width:100%;height:300px\}/.test(src), 'caja de Microciclo sin altura fija');
});
test('ningún canvas lleva la clase antigua en ningún archivo', () => {
    const offenders = fs.readdirSync(ROOT)
        .filter(f => f.endsWith('.js') || f.endsWith('.html'))
        .filter(f => /class="chart-canvas"|detail-rpe-hist-canvas/.test(read(f)));
    assert.deepStrictEqual(offenders, []);
});

// ---------- ejecutor ----------
(async () => {
    for (const { name, fn } of pending) {
        try { await fn(); passed++; console.log('  ✅', name); }
        catch (e) { failed++; console.log('  ❌', name, '\n     ', e.message); }
    }
    console.log(`\n${passed} OK, ${failed} fallos\n`);
    process.exit(failed ? 1 : 0);
})();

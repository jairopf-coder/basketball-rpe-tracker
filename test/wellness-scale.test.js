// test/wellness-scale.test.js
// Escala del wellness: en TODOS los formularios las cuatro dimensiones se guardan
// igual (1 = peor, 5 = mejor). Energía: 1 agotada … 5 descansada. Muscular: 1 mucho
// dolor … 5 sin dolor. Ninguna pantalla debe invertirlas (6 - valor).
// Ejecutar con:  node test/wellness-scale.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
const ROOT = path.join(__dirname, '..');

// ── Sandbox de navegador ────────────────────────────────────────────────
const dom = { widgets: { innerHTML: '' }, written: [], styles: [] };
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, Map,
    esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    PlayerTokens: { avatar: () => '' },
    Store: { get: () => null, getActiveSeason: () => '2026-27' },
    Blob: function Blob() {}, File: function File() {},
    setTimeout: () => 0,
    navigator: {},
    document: {
        createElement: () => ({ style: {}, setAttribute() {} }),
        head: { appendChild(el) { dom.styles.push(el); } },
        getElementById: id => id === 'dbRightWidgets' ? dom.widgets : null,
        documentElement: { classList: { contains: () => false } },
        body: { classList: { contains: () => false } },
    },
    window: {
        matchMedia: () => ({ matches: false }), devicePixelRatio: 1,
        open: () => ({ document: { write: h => dom.written.push(h), close() {} }, print() {} }),
    },
    localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: () => {},
    AppAlert: { show() {} },
});
vm.runInContext(`
    function RPETracker() {}
    function toLocalISODate(d) {
        const p = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
`, ctx);
['wellness.js', 'dashboard-renderer.js', 'dashboard-comparison.js', 'app-presession.js', 'team-status.js']
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx));

const today = vm.runInContext('toLocalISODate', ctx)(new Date());
const entry = (playerId, sleep, fatigue, mood, soreness) => ({ id: 'w_' + playerId, playerId, date: today, sleep, fatigue, mood, soreness });

function make(wellness) {
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = [{ id: 'p1', name: 'Ana Pérez' }, { id: 'p2', name: 'Bea Ruiz' }, { id: 'p3', name: 'Carla Gil' }];
    t.wellnessData = wellness || []; t.sessions = []; t.injuries = []; t._playerRpeRaw = [];
    t.calculateAcuteChronicRatio = () => ({ ratio: '1.00', confidence: 'high' });
    t.getRatioColor = () => '#2e7d32'; // uno de los 4 colores reales de getRatioColor
    t.getPlayerThresholds = () => ({ low: 0.8, opt: 1.3, high: 1.5 });
    t.showToast = () => {};
    t.weekPlan = {}; t.loadWeekPlan = () => {}; t.getLocationName = () => '';
    return t;
}
const GREEN = 'wh-good', AMBER = 'wh-warn', RED = 'wh-bad';   // el color es una clase, no un fondo
// Celdas de una fila de la tabla: [{val, color}] en orden Sueño, Energía, Humor, Muscular, Ø
// (color = clase de color del número: wh-good / wh-warn / wh-bad)
function heatRow(html, name) {
    const row = html.split('<tr>').find(r => r.includes(`<span>${name}</span>`));
    assert.ok(row, 'no se encontró la fila de ' + name);
    return [...row.matchAll(/<td class="wh-cell(?: wh-overall)? (wh-(?:good|warn|bad|nodata))"[^>]*>([^<]+)</g)]
        .map(m => ({ color: m[1], val: m[2] }));
}

console.log('\nTabla "Carga y wellness — 7 días" (la que reportaste)');
test('4.0 en Energía y 4.0 en Humor tienen el MISMO color (verde)', () => {
    const t = make([entry('p1', 4, 4, 4, 4)]);
    const cells = heatRow(t._renderPlayerComparisonSection(), 'Ana');
    assert.strictEqual(cells.length, 5);
    cells.forEach(c => { assert.strictEqual(c.val, '4.0'); assert.strictEqual(c.color, GREEN, `4.0 debería ser verde y es ${c.color}`); });
});
test('1 = rojo y 5 = verde en TODAS las columnas, Energía y Muscular incluidas', () => {
    const t = make([entry('p1', 5, 5, 5, 5), entry('p2', 1, 1, 1, 1)]);
    const html = t._renderPlayerComparisonSection();
    heatRow(html, 'Ana').forEach(c => { assert.strictEqual(c.val, '5.0'); assert.strictEqual(c.color, GREEN); });
    heatRow(html, 'Bea').forEach(c => { assert.strictEqual(c.val, '1.0'); assert.strictEqual(c.color, RED); });
});
test('energía y muscular bajas (2) salen en rojo, sueño y humor altos (5) en verde', () => {
    const t = make([entry('p1', 5, 2, 5, 2)]);
    const [sleep, energy, mood, muscle, overall] = heatRow(t._renderPlayerComparisonSection(), 'Ana');
    assert.deepStrictEqual([sleep.val, energy.val, mood.val, muscle.val], ['5.0', '2.0', '5.0', '2.0']);
    assert.deepStrictEqual([sleep.color, energy.color, mood.color, muscle.color], [GREEN, RED, GREEN, RED]);
    assert.strictEqual(overall.val, '3.5'); // media simple de los cuatro valores guardados
    assert.strictEqual(overall.color, AMBER);
});
test('la media de 7 días promedia los valores tal cual (sin invertir)', () => {
    const d = n => { const x = new Date(); x.setDate(x.getDate() - n); return vm.runInContext('toLocalISODate', ctx)(x); };
    const t = make([
        Object.assign(entry('p1', 4, 2, 4, 2), { id: 'a', date: d(0) }),
        Object.assign(entry('p1', 4, 4, 4, 4), { id: 'b', date: d(1) }),
    ]);
    const [, energy, , muscle] = heatRow(t._renderPlayerComparisonSection(), 'Ana');
    assert.strictEqual(energy.val, '3.0'); assert.strictEqual(muscle.val, '3.0');
});

console.log('\nRediseño: un solo fondo, color solo en el número');
const tableStyle = () => {
    const el = dom.styles.find(e => e.id === 'dashboard-comparison-style');
    assert.ok(el && el.textContent, 'no se inyectó el CSS de la tabla');
    return el.textContent;
};
test('ninguna celda ni fila lleva fondo propio (no hay style="background")', () => {
    const t = make([entry('p1', 5, 5, 5, 5), entry('p2', 1, 1, 1, 1), entry('p3', 3, 3, 3, 3)]);
    const html = t._renderPlayerComparisonSection();
    assert.ok(!/background/i.test(html), 'la tabla no debe pintar fondos');
    const table = html.slice(html.indexOf('<table'), html.indexOf('</table>'));
    assert.ok(!/style=/.test(table), 'el color de las celdas debe ir en clases, no en style');
});
test('el CSS de la tabla no define ningún fondo de color (solo transparent)', () => {
    const css = tableStyle();
    const heat = css.slice(css.indexOf('Tabla de wellness'));
    const bgs = [...heat.matchAll(/background:\s*([^;]+);/g)].map(m => m[1].trim());
    assert.ok(bgs.length > 0);
    bgs.forEach(v => assert.strictEqual(v, 'transparent', 'fondo distinto de transparent: ' + v));
    assert.ok(!/2e7d3220|f9a82520|c6282820/.test(css), 'quedan los fondos teñidos antiguos');
});
test('hay variante para el tema oscuro en verde, naranja, rojo y azul', () => {
    const css = tableStyle();
    ['wh-good', 'wh-warn', 'wh-bad', 'wh-blue'].forEach(c =>
        assert.ok(css.includes(`[data-theme="dark"] .${c}`), 'falta la variante oscura de ' + c));
});
test('umbrales: 5.0 y 4.0 verde · 3.5 y 3.0 naranja · 2.5 y 1.0 rojo', () => {
    const cls = v => heatRow(make([entry('p1', v, v, v, v)])._renderPlayerComparisonSection(), 'Ana')[0].color;
    assert.deepStrictEqual([5, 4, 3.5, 3, 2.5, 1].map(cls), [GREEN, GREEN, AMBER, AMBER, RED, RED]);
});
test('el color sigue al número que se VE: un 3,96 se muestra "4.0" y sale verde; un 2,96 se muestra "3.0" y sale naranja', () => {
    const d = n => { const z = new Date(); z.setDate(z.getDate() - n); return vm.runInContext('toLocalISODate', ctx)(z); };
    // 7 días: sueño/energía/humor = 4 siempre; muscular = 4 seis días y 3 uno → media 3,857 → Ø = 3,964
    const mk = (pid, muscleLastDay) => [0, 1, 2, 3, 4, 5, 6].map(i => ({ id: `${pid}${i}`, playerId: pid, date: d(i), sleep: 4, fatigue: 4, mood: 4, soreness: i === 6 ? muscleLastDay : 4 }));
    const t = make(mk('p1', 3));
    const cells = heatRow(t._renderPlayerComparisonSection(), 'Ana');
    const overall = cells[4];
    assert.strictEqual(overall.val, '4.0'); assert.strictEqual(overall.color, GREEN, 'un "4.0" visible no puede ser naranja');
    assert.strictEqual(cells[3].val, '3.9'); assert.strictEqual(cells[3].color, AMBER);
    // y al otro lado: 2,964 → "3.0" naranja (no rojo)
    const t2 = make([0, 1, 2, 3, 4, 5, 6].map(i => ({ id: `q${i}`, playerId: 'p1', date: d(i), sleep: 3, fatigue: 3, mood: 3, soreness: i === 6 ? 2 : 3 })));
    const o2 = heatRow(t2._renderPlayerComparisonSection(), 'Ana')[4];
    assert.strictEqual(o2.val, '3.0'); assert.strictEqual(o2.color, AMBER, 'un "3.0" visible no puede ser rojo');
});
test('sin datos: celdas "—" sin color de estado, todas iguales', () => {
    const cells = heatRow(make([])._renderPlayerComparisonSection(), 'Ana');
    assert.strictEqual(cells.length, 5);
    cells.forEach(c => { assert.strictEqual(c.color, 'wh-nodata'); assert.strictEqual(c.val, '—'); });
});
test('la columna A:C también colorea solo el número (clase), sin fondo', () => {
    const t = make([entry('p1', 4, 4, 4, 4)]);
    t.getRatioColor = () => '#c62828';
    let html = t._renderPlayerComparisonSection();
    assert.ok(html.includes('<span class="wh-bad">1.00</span>'));
    t.getRatioColor = () => '#2e7d32';
    assert.ok(t._renderPlayerComparisonSection().includes('<span class="wh-good">1.00</span>'));
    t.getRatioColor = () => '#1565c0';
    assert.ok(t._renderPlayerComparisonSection().includes('<span class="wh-blue">1.00</span>'));
});
test('la leyenda usa puntos de color (texto) y describe bien los tramos', () => {
    const html = make([entry('p1', 4, 4, 4, 4)])._renderPlayerComparisonSection();
    assert.ok(html.includes('<b class="wh-good">●</b>') && html.includes('<b class="wh-warn">●</b>') && html.includes('<b class="wh-bad">●</b>'));
    assert.ok(html.includes('≥4 bueno') && html.includes('3–3,9 normal') && html.includes('&lt;3 atención'));
});
test('el subtítulo ya no dice "mayor = mejor" (no vale para el A:C)', () => {
    const html = make([entry('p1', 4, 4, 4, 4)])._renderPlayerComparisonSection();
    assert.ok(!html.includes('mayor = mejor'));
    assert.ok(html.includes('1 (peor) a 5 (mejor)'));
});
test('el nombre va en su propio contenedor recortable (no rompe la celda)', () => {
    const html = make([entry('p1', 4, 4, 4, 4)])._renderPlayerComparisonSection();
    assert.ok(html.includes('<td class="wh-name">') && html.includes('class="wh-name-in"'));
});

console.log('\nBarras "Wellness hoy" de Inicio');
test('Energía 4.0 en verde, Energía 2.0 en rojo; la etiqueta ya no dice "Agujetas"', () => {
    const t = make([entry('p1', 4, 4, 4, 4)]);
    t._renderRightWidgets();
    let h = dom.widgets.innerHTML;
    assert.ok(h.includes('⚡ Energía') && h.includes('💪 Muscular') && !h.includes('Agujetas'));
    const energyRow = h.split('db-rw-bar-row').find(r => r.includes('Energía'));
    assert.ok(energyRow.includes('#4caf50') && !energyRow.includes('#f44336'), 'Energía 4.0 debería ser verde');
    const t2 = make([entry('p1', 4, 2, 4, 2)]); t2._renderRightWidgets(); h = dom.widgets.innerHTML;
    assert.ok(h.split('db-rw-bar-row').find(r => r.includes('Energía')).includes('#f44336'), 'Energía 2.0 debería ser roja');
    assert.ok(h.split('db-rw-bar-row').find(r => r.includes('Muscular')).includes('#f44336'), 'Muscular 2.0 debería ser rojo');
    assert.ok(h.split('db-rw-bar-row').find(r => r.includes('Sueño')).includes('#4caf50'));
});

console.log('\nReadiness / pre-sesión');
test('energía y muscular SUMAN: 5/5/5/5 = 100, 1/1/1/1 = 20 (solo el bonus A:C), 3/3/3/3 = 60', () => {
    const score = w => make([entry('p1', ...w)]).calculateReadiness('p1');
    assert.strictEqual(score([5, 5, 5, 5]), 100);
    assert.strictEqual(score([1, 1, 1, 1]), 20);
    assert.strictEqual(score([3, 3, 3, 3]), 60);
});
test('mejorar la energía o el estado muscular SUBE el readiness (antes lo bajaba)', () => {
    const score = (f, s) => make([entry('p1', 4, f, 4, s)]).calculateReadiness('p1');
    assert.ok(score(4, 3) > score(2, 3), 'más energía debería dar más readiness');
    assert.ok(score(3, 5) > score(3, 2), 'menos dolor muscular debería dar más readiness');
});
test('una jugadora con wellness perfecto llega a zona verde (≥ 70)', () => {
    assert.ok(make([entry('p1', 5, 5, 5, 5)]).calculateReadiness('p1') >= 70);
});

console.log('\nInformes (PDF / estado del equipo)');
// Celdas (fondo, color) de la fila de una jugadora dentro de la tabla de WELLNESS del informe
function weeklyWellnessCells(html, name) {
    const from = html.indexOf('💪 Muscular');
    assert.ok(from > 0, 'no se encontró la tabla de wellness del informe');
    const start = html.indexOf(name, from);
    assert.ok(start > 0, 'no se encontró la fila de ' + name);
    const row = html.slice(start, html.indexOf('</tr>', start));
    return [...row.matchAll(/background:(#[0-9a-f]{6});color:(#[0-9a-f]{6});font-weight:700/g)].map(m => ({ bg: m[1], color: m[2] }));
}
test('informe semanal del equipo: 4/4/4/4 → las 4 celdas verdes', () => {
    const t = make([entry('p1', 4, 4, 4, 4)]);
    dom.written.length = 0; t.generateWeeklyTeamPDF();
    const html = dom.written.join('');
    assert.ok(html.includes('⚡ Energía') && html.includes('💪 Muscular') && !html.includes('Agujetas') && !html.includes('⚡ Fatiga'));
    const cells = weeklyWellnessCells(html, 'Ana Pérez');
    assert.strictEqual(cells.length, 4);
    cells.forEach(c => assert.deepStrictEqual(c, { bg: '#e8f5e9', color: '#2e7d32' }));
});
test('informe semanal del equipo: 2/2/2/2 → las 4 celdas rojas', () => {
    const t = make([entry('p1', 2, 2, 2, 2)]);
    dom.written.length = 0; t.generateWeeklyTeamPDF();
    const cells = weeklyWellnessCells(dom.written.join(''), 'Ana Pérez');
    assert.strictEqual(cells.length, 4);
    cells.forEach(c => assert.deepStrictEqual(c, { bg: '#ffebee', color: '#c62828' }));
});
test('informe semanal del equipo: sueño/humor 5 y energía/muscular 2 → verde, rojo, verde, rojo', () => {
    const t = make([entry('p1', 5, 2, 5, 2)]);
    dom.written.length = 0; t.generateWeeklyTeamPDF();
    const c = weeklyWellnessCells(dom.written.join(''), 'Ana Pérez').map(x => x.color);
    assert.deepStrictEqual(c, ['#2e7d32', '#c62828', '#2e7d32', '#c62828']);
});
test('informe de equipo: la media wellness del TOTAL es la media simple (4/4/4/4 → 4.0)', () => {
    const t = make([entry('p1', 4, 4, 4, 4)]);
    dom.written.length = 0;
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'pdf-reports.js'), 'utf8'), ctx);
    t.generateTeamWeeklyReport();
    const html = dom.written.join('');
    const total = html.slice(html.indexOf('TOTAL EQUIPO'));
    assert.ok(total.includes('<td class="td-num">4.0</td>'), 'la media del total debería ser 4.0');
});

console.log('\nRegresión');
test('ningún archivo del proyecto vuelve a invertir fatigue o soreness (6 - valor)', () => {
    const offenders = [];
    fs.readdirSync(ROOT).filter(f => f.endsWith('.js') && f !== 'sw.js').forEach(f => {
        fs.readFileSync(path.join(ROOT, f), 'utf8').split('\n').forEach((line, i) => {
            if (/6\s*-\s*\(?\s*[\w.]*(?:fatigue|soreness)/.test(line) && !/^\s*(\/\/|\*)/.test(line)) offenders.push(`${f}:${i + 1}`);
        });
    });
    assert.deepStrictEqual(offenders, [], 'escala invertida en: ' + offenders.join(', '));
});

(async () => {
    for (const q of queue) {
        try { await q.fn(); console.log(`  ✅ ${q.name}`); passed++; }
        catch (e) { console.log(`  ❌ ${q.name}\n     ${e.message.split('\n')[0]}`); failed++; }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

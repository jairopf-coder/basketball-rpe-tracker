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
vm.runInContext(require('./active-players-helper')(), ctx);   // activePlayers / getPlayersActiveOn / isPlayerActiveOn… reales de app-players.js
['ewma-calculator.js', 'wellness.js', 'dashboard-renderer.js', 'dashboard-comparison.js', 'app-presession.js', 'team-status.js']
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
    t.playerFullName = p => [p.name, p.lastName].filter(Boolean).join(' ');   // en la app real: app-players.js
    t._shortPlayerName = p => String(p.name || '').split(' ')[0];
    t.weekPlan = {}; t.loadWeekPlan = () => {}; t.getLocationName = () => '';
    return t;
}
const GREEN = 'wh-good', AMBER = 'wh-warn', RED = 'wh-bad';   // el color es una clase, no un fondo
const dayStr = n => { const x = new Date(); x.setDate(x.getDate() - n); return vm.runInContext('toLocalISODate', ctx)(x); };

// Tabla única «Ratio A:C — jugadoras» de Inicio: entradas como las prepara renderDashboard
const ratioEntry = (player, over) => Object.assign(
    { player, ratio: { ratio: '1.00', confidence: 'high' }, st: { color: '#4caf50', cls: 'wh-good', risk: 2 }, out: false, r: 1 }, over || {});
const tableOf = (t, over) => t._renderPlayersTable(t.players.map(p => ratioEntry(p, over)));
// Celdas de la fila de una jugadora: { ac, w, r } con { val, cls }
function rowCells(html, name) {
    const row = html.split('<div class="db-player-row">').find(r => r.includes(`<div class="db-player-name">${name}`));
    assert.ok(row, 'no se encontró la fila de ' + name);
    const cell = col => {
        const m = new RegExp(`<div class="db-player-${col} (wh-[a-z]+)"[^>]*>(.*?)</div>`).exec(row);
        assert.ok(m, `falta la celda ${col} de ${name}`);
        return { cls: m[1], val: m[2] };
    };
    return { ac: cell('ratio'), w: cell('wellness'), r: cell('readiness') };
}
const wOf = (wellness, name = 'Ana') => rowCells(tableOf(make(wellness)), name).w;

console.log('\nTabla única de Inicio: Ø = bienestar, media de 7 días');
test('4.0 en las cuatro dimensiones → Ø 4.0 en verde', () => {
    const c = wOf([entry('p1', 4, 4, 4, 4)]);
    assert.strictEqual(c.val, '4.0'); assert.strictEqual(c.cls, GREEN);
});
test('1 = rojo y 5 = verde (sin invertir ninguna dimensión)', () => {
    const t = make([entry('p1', 5, 5, 5, 5), entry('p2', 1, 1, 1, 1)]);
    const html = tableOf(t);
    assert.deepStrictEqual([rowCells(html, 'Ana').w.val, rowCells(html, 'Ana').w.cls], ['5.0', GREEN]);
    assert.deepStrictEqual([rowCells(html, 'Bea').w.val, rowCells(html, 'Bea').w.cls], ['1.0', RED]);
});
test('sueño/humor 5 y energía/muscular 2 → Ø 3.5 (media simple de los cuatro valores guardados), naranja', () => {
    const c = wOf([entry('p1', 5, 2, 5, 2)]);
    assert.strictEqual(c.val, '3.5'); assert.strictEqual(c.cls, AMBER);
});
test('la media de 7 días promedia los registros tal cual', () => {
    const c = wOf([Object.assign(entry('p1', 4, 2, 4, 2), { id: 'a', date: dayStr(0) }),
                   Object.assign(entry('p1', 4, 4, 4, 4), { id: 'b', date: dayStr(1) })]);
    assert.strictEqual(c.val, '3.5');   // (3,0 + 4,0) / 2
});
test('la ventana son 7 días como en Salud → Wellness: hoy y los 6 anteriores (el día 7 atrás ya no cuenta)', () => {
    const c = wOf([Object.assign(entry('p1', 5, 5, 5, 5), { id: 'a', date: dayStr(6) }),
                   Object.assign(entry('p1', 1, 1, 1, 1), { id: 'b', date: dayStr(7) })]);
    assert.strictEqual(c.val, '5.0');
});
test('los registros incompletos no cuentan', () => {
    const c = wOf([entry('p1', 4, 4, 4, 4), Object.assign(entry('p1', 1, null, 1, 1), { id: 'x', date: dayStr(1) })]);
    assert.strictEqual(c.val, '4.0');
});
test('umbrales: 5.0 y 4.0 verde · 3.5 y 3.0 naranja · 2.5 y 1.0 rojo', () => {
    const cls = v => wOf([entry('p1', v, v, v, v)]).cls;
    assert.deepStrictEqual([5, 4, 3.5, 3, 2.5, 1].map(cls), [GREEN, GREEN, AMBER, AMBER, RED, RED]);
});
test('el color sigue al número que se VE: 3,96 se muestra "4.0" y sale verde; 2,96 se muestra "3.0" y sale naranja', () => {
    // 7 días: tres dimensiones a 4 siempre; muscular a 4 seis días y a 3 uno → Ø = 3,964
    const mk = (base, last) => [0, 1, 2, 3, 4, 5, 6].map(i => ({ id: `w${base}${i}`, playerId: 'p1', date: dayStr(i), sleep: base, fatigue: base, mood: base, soreness: i === 6 ? last : base }));
    const hi = wOf(mk(4, 3));
    assert.strictEqual(hi.val, '4.0'); assert.strictEqual(hi.cls, GREEN, 'un "4.0" visible no puede ser naranja');
    const lo = wOf(mk(3, 2));
    assert.strictEqual(lo.val, '3.0'); assert.strictEqual(lo.cls, AMBER, 'un "3.0" visible no puede ser rojo');
});
test('sin registros en 7 días: "—" sin color de estado', () => {
    const c = wOf([]);
    assert.strictEqual(c.val, '—'); assert.strictEqual(c.cls, 'wh-nodata');
});

console.log('\nTabla única de Inicio: R = readiness y A:C');
test('readiness: 100 verde · 60 naranja · 20 rojo · sin datos "—"', () => {
    const r = ws => rowCells(tableOf(make(ws)), 'Ana').r;
    assert.deepStrictEqual([r([entry('p1', 5, 5, 5, 5)]).val, r([entry('p1', 5, 5, 5, 5)]).cls], ['100', GREEN]);
    assert.deepStrictEqual([r([entry('p1', 3, 3, 3, 3)]).val, r([entry('p1', 3, 3, 3, 3)]).cls], ['60', AMBER]);
    assert.deepStrictEqual([r([entry('p1', 1, 1, 1, 1)]).val, r([entry('p1', 1, 1, 1, 1)]).cls], ['20', RED]);
    const none = r([]);
    assert.strictEqual(none.cls, 'wh-nodata'); assert.strictEqual(none.val, '—');
});
test('A:C colorea solo el número con la clase del estado de cada jugadora (umbrales individuales)', () => {
    const t = make([entry('p1', 4, 4, 4, 4)]);
    const cls = c => rowCells(t._renderPlayersTable([ratioEntry(t.players[0], { st: { color: '#000', cls: c, risk: 1 } })]), 'Ana').ac;
    ['wh-bad', 'wh-warn', 'wh-good', 'wh-blue'].forEach(c => { assert.strictEqual(cls(c).cls, c); assert.strictEqual(cls(c).val, '1.00'); });
});
test('una jugadora que no entrena muestra 🏥 en A:C pero conserva su bienestar y su readiness', () => {
    const t = make([entry('p1', 5, 5, 5, 5)]);
    const html = t._renderPlayersTable([ratioEntry(t.players[0], { out: true, r: 0, st: { color: 'var(--text-faint)', cls: 'wh-nodata', risk: -1 } })]);
    const c = rowCells(html, 'Ana');
    assert.ok(c.ac.val.includes('🏥'));
    assert.strictEqual(c.w.val, '5.0'); assert.strictEqual(c.r.val, '100');
});

console.log('\nRediseño: color solo en el texto, sin círculos ni fondos; cabeceras A:C, Ø y R');
test('ni el ratio, ni el bienestar ni el readiness llevan fondo ni style, y no hay columna de círculo', () => {
    const html = tableOf(make([entry('p1', 5, 5, 5, 5), entry('p2', 1, 1, 1, 1), entry('p3', 3, 3, 3, 3)]));
    assert.ok(!/class="db-player-(ratio|wellness|readiness)[^"]*"\s+style=/.test(html), 'el color de las celdas debe ir en clases');
    assert.ok(!html.includes('db-player-icon'), 'ya no hay columna de círculo');
    const sinBarra = html.replace(/<div class="db-bar-fill"[^>]*>/g, '');
    assert.ok(!/background/i.test(sinBarra), 'solo la barra de A:C lleva color de fondo');
    assert.ok(!/[🟢🟡🔴🔵🟠]/u.test(html), 'no quedan círculos de colores en la tabla');
});
test('cabecera: A:C, Ø y R son botones clicables con su texto al pasar el ratón', () => {
    const html = tableOf(make([entry('p1', 4, 4, 4, 4)]));
    const head = html.slice(0, html.indexOf('db-player-row'));
    [['ac', 'A:C', 'Ratio agudo:crónico'], ['w', 'Ø', 'Bienestar'], ['r', 'R', 'Readiness']].forEach(([k, label, title]) => {
        assert.ok(head.includes(`sortDashBy('${k}')`), 'falta el clic de ' + k);
        assert.ok(new RegExp(`title="${title}[^"]*"[^>]*>${label}`).test(head), `falta el texto ${label} / ${title}`);
    });
});
test('el nombre va en su propio contenedor recortable', () => {
    assert.ok(tableOf(make([entry('p1', 4, 4, 4, 4)])).includes('<div class="db-player-name">Ana'));
});
test('el CSS de colores no define fondos y tiene variante para el tema oscuro en verde, naranja, rojo y azul', () => {
    const el = dom.styles.find(e => e.id === 'dashboard-comparison-style');
    assert.ok(el && el.textContent, 'no se inyectó el CSS de colores');
    assert.ok(!/background/i.test(el.textContent));
    ['wh-good', 'wh-warn', 'wh-bad', 'wh-blue'].forEach(c =>
        assert.ok(el.textContent.includes(`[data-theme="dark"] .${c}`), 'falta la variante oscura de ' + c));
});
test('la tarjeta antigua «Carga y wellness — 7 días» ya no se pinta', () => {
    assert.strictEqual(make([entry('p1', 4, 4, 4, 4)])._renderPlayerComparisonSection(), '');
});

console.log('\nTendencia de wellness: identificador estable para los avisos de Inicio');
test('_wTrendAlerts indica la jugadora (playerId) y el tipo (sueño / dolor muscular) de cada aviso', () => {
    const mk = (id, sleep, soreness) => [0, 1, 2].map(i => ({ id: `${id}${i}`, playerId: id, date: dayStr(i), sleep, fatigue: 4, mood: 4, soreness }));
    const t = make([...mk('p1', 2, 5), ...mk('p2', 5, 2)]);
    const alerts = Array.from(t._wTrendAlerts().map(a => `${a.playerId}:${a.kind}`)).sort();
    assert.deepStrictEqual(alerts, ['p1:sleep', 'p2:soreness']);
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

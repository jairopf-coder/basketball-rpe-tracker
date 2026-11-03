// test/dash-sort.test.js
// Orden de la tabla «Ratio A:C — jugadoras» de Inicio con las cabeceras A:C, Ø y R:
// primer clic = de mayor a menor, segundo clic = de menor a mayor; las que no entrenan (🏥)
// van siempre al final; las que no tienen dato en la columna elegida van tras las que sí.
// Ejecutar con:  node test/dash-sort.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
const ROOT = path.join(__dirname, '..');
// Los objetos creados dentro del VM tienen su propio Object: se comparan como datos planos
const same = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);

const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, isFinite, Promise, Map,
    esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    PlayerTokens: { avatar: () => '' },
    document: { createElement: () => ({ style: {} }), head: { appendChild() {} }, getElementById: () => null },
    window: {},
});
vm.runInContext(`
    function RPETracker() {}
    function toLocalISODate(d) {
        const p = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
`, ctx);
['ewma-calculator.js', 'dashboard-comparison.js'].forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx));
const today = vm.runInContext('toLocalISODate', ctx)(new Date());

// Cinco jugadoras con casos distintos:
//   Ana  A:C 1.4  Ø 3.0  R 50      Bea  A:C 0.9  Ø 4.5  R 80
//   Cris A:C 1.1  sin bienestar, sin readiness
//   Dani A:C con pocos datos ("Insuf.")  Ø 2.0  R 30
//   Eva  no entrena (🏥)  Ø 5.0  R 90
const DATA = [
    { id: 'p1', name: 'Ana',  ratio: { ratio: '1.40', confidence: 'high' }, w: 3.0, r: 50 },
    { id: 'p2', name: 'Bea',  ratio: { ratio: '0.90', confidence: 'high' }, w: 4.5, r: 80 },
    { id: 'p3', name: 'Cris', ratio: { ratio: '1.10', confidence: 'high' }, w: null, r: null },
    { id: 'p4', name: 'Dani', ratio: { ratio: '1.20', confidence: 'low' },  w: 2.0, r: 30 },
    { id: 'p5', name: 'Eva',  ratio: { ratio: 'N/A',  confidence: 'low' },  w: 5.0, r: 90, out: true },
];
function make(data = DATA) {
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = data.map(d => ({ id: d.id, name: d.name }));
    t.wellnessData = data.filter(d => d.w !== null).map(d => ({ id: 'w' + d.id, playerId: d.id, date: today, sleep: d.w, fatigue: d.w, mood: d.w, soreness: d.w }));
    t.calculateReadiness = id => data.find(d => d.id === id).r;
    t.renders = 0; t.renderDashboard = function() { this.renders++; };
    t.entries = data.map(d => ({
        player: { id: d.id, name: d.name }, ratio: d.ratio, out: !!d.out, r: parseFloat(d.ratio.ratio) || 0,
        st: { color: '#4caf50', cls: 'wh-good', risk: 2 },
    }));
    return t;
}
const order = (t, sort) => {
    if (sort) t._dashSort = sort;
    return [...t._renderPlayersTable(t.entries).matchAll(/<div class="db-player-name">([A-Za-z]+)/g)].map(m => m[1]);
};

console.log('\nEstado del orden');
test('por defecto: A:C de mayor a menor', () => {
    same(make()._dashSortState(), { key: 'ac', dir: 'desc' });
});
test('el valor antiguo ("risk", "safe", "name") o uno corrupto se trata como el orden por defecto', () => {
    const t = make();
    ['risk', 'safe', 'name', null, 42, { key: 'zzz', dir: 'desc' }, { key: 'w', dir: 'sideways' }].forEach(v => {
        t._dashSort = v;
        same(t._dashSortState(), { key: 'ac', dir: 'desc' }, 'valor: ' + JSON.stringify(v));
        assert.doesNotThrow(() => t._renderPlayersTable(t.entries));
    });
});
test('primer clic en otra cabecera: de mayor a menor; segundo clic: de menor a mayor; tercero: otra vez de mayor a menor', () => {
    const t = make();
    t.sortDashBy('w'); same(t._dashSort, { key: 'w', dir: 'desc' });
    t.sortDashBy('w'); same(t._dashSort, { key: 'w', dir: 'asc' });
    t.sortDashBy('w'); same(t._dashSort, { key: 'w', dir: 'desc' });
    assert.strictEqual(t.renders, 3);
});
test('cambiar de cabecera empieza siempre de mayor a menor', () => {
    const t = make();
    t.sortDashBy('w'); t.sortDashBy('w');            // Ø ascendente
    t.sortDashBy('r'); same(t._dashSort, { key: 'r', dir: 'desc' });
});
test('desde el orden por defecto, un clic en A:C lo pasa a menor a mayor', () => {
    const t = make();
    t.sortDashBy('ac'); same(t._dashSort, { key: 'ac', dir: 'asc' });
});
test('una cabecera desconocida no cambia nada ni repinta', () => {
    const t = make();
    t.sortDashBy('name'); t.sortDashBy(undefined);
    assert.strictEqual(t._dashSort, undefined); assert.strictEqual(t.renders, 0);
});

console.log('\nOrden de las filas');
test('A:C de mayor a menor: sin dato fiable ("Insuf.") después, y la que no entrena la última', () => {
    assert.deepStrictEqual(order(make(), { key: 'ac', dir: 'desc' }), ['Ana', 'Cris', 'Bea', 'Dani', 'Eva']);
});
test('A:C de menor a mayor: las "Insuf." siguen detrás y la lesionada al final', () => {
    assert.deepStrictEqual(order(make(), { key: 'ac', dir: 'asc' }), ['Bea', 'Cris', 'Ana', 'Dani', 'Eva']);
});
test('Ø de mayor a menor: sin bienestar detrás; Eva (5.0) sigue la última por no entrenar', () => {
    assert.deepStrictEqual(order(make(), { key: 'w', dir: 'desc' }), ['Bea', 'Ana', 'Dani', 'Cris', 'Eva']);
});
test('Ø de menor a mayor: sin bienestar sigue detrás', () => {
    assert.deepStrictEqual(order(make(), { key: 'w', dir: 'asc' }), ['Dani', 'Ana', 'Bea', 'Cris', 'Eva']);
});
test('R de mayor a menor y de menor a mayor', () => {
    assert.deepStrictEqual(order(make(), { key: 'r', dir: 'desc' }), ['Bea', 'Ana', 'Dani', 'Cris', 'Eva']);
    assert.deepStrictEqual(order(make(), { key: 'r', dir: 'asc' }), ['Dani', 'Ana', 'Bea', 'Cris', 'Eva']);
});
test('los empates se ordenan por nombre, en ambas direcciones', () => {
    const data = [
        { id: 'p1', name: 'Zoe', ratio: { ratio: '1.00', confidence: 'high' }, w: 4, r: 70 },
        { id: 'p2', name: 'Ada', ratio: { ratio: '1.00', confidence: 'high' }, w: 4, r: 70 },
        { id: 'p3', name: 'Ema', ratio: { ratio: '1.00', confidence: 'high' }, w: 4, r: 70 },
    ];
    ['desc', 'asc'].forEach(dir => ['ac', 'w', 'r'].forEach(key =>
        assert.deepStrictEqual(order(make(data), { key, dir }), ['Ada', 'Ema', 'Zoe'], `${key} ${dir}`)));
});
test('el orden no modifica la lista de entrada', () => {
    const t = make(); const antes = t.entries.map(e => e.player.name).join();
    order(t, { key: 'w', dir: 'asc' });
    assert.strictEqual(t.entries.map(e => e.player.name).join(), antes);
});

console.log('\nCabecera');
test('la cabecera activa muestra la flecha (▼ mayor a menor, ▲ menor a mayor) y solo ella', () => {
    const t = make();
    t._dashSort = { key: 'w', dir: 'desc' };
    let head = t._renderPlayersTable(t.entries).split('db-player-row')[0];
    assert.strictEqual((head.match(/db-th-arrow/g) || []).length, 1);
    assert.ok(/Ø<span class="db-th-arrow" aria-hidden="true">▼/.test(head));
    t._dashSort = { key: 'w', dir: 'asc' };
    head = t._renderPlayersTable(t.entries).split('db-player-row')[0];
    assert.ok(/Ø<span class="db-th-arrow" aria-hidden="true">▲/.test(head));
    assert.ok(head.includes('ahora de menor a mayor'));
});
test('el botón de orden antiguo (↓ / ↑ / A–Z) ya no existe en el código', () => {
    const src = fs.readFileSync(path.join(ROOT, 'dashboard-renderer.js'), 'utf8');
    assert.ok(!src.includes('cycleDashSort') && !src.includes("'A–Z'"));
});

(async () => {
    for (const q of queue) {
        try { await q.fn(); passed++; console.log('  ✅ ' + q.name); }
        catch (e) { failed++; console.log('  ❌ ' + q.name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

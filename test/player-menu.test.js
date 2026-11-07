// test/player-menu.test.js
// Menú ⋮ de la ficha de jugadora (app-players.js): un solo botón que agrupa informes, editar,
// anamnesis, dar de baja y eliminar, con el mismo desplegable (gear-*) que la rueda de Inicio.
//  · estructura y orden del menú · cada acción llama a lo mismo que antes su botón
//  · se cierra antes de actuar (síncrono, para conservar el gesto del usuario) · clic fuera / Esc / flechas
//  · posición dentro de la pantalla · un solo menú a la vez · sin ids dentro de onclick
// Ejecutar con:  node test/player-menu.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
const ROOT = path.join(__dirname, '..');
const SRC = fs.readFileSync(path.join(ROOT, 'app-players.js'), 'utf8');
const MENU_SRC = SRC.slice(SRC.indexOf('// ── Menú de acciones de la ficha de jugadora'));

// DOM mínimo: lo justo para abrir el menú, pulsar y cerrarlo
function makeEnv({ viewport = { w: 400, h: 800 }, menu = { w: 230, h: 300 } } = {}) {
    const byId = {}, log = [], docListeners = {};
    let active = null;
    const mkItem = action => ({ dataset: { action }, focus() { active = this; log.push('focus:' + action); } });
    const document = {
        getElementById: id => byId[id] || null,
        createElement: () => {
            const el = {
                style: {}, _l: {}, _html: '', attrs: {},
                addEventListener(t, f) { this._l[t] = f; },
                remove() { delete byId[this.id]; log.push('overlay-removed'); },
                get innerHTML() { return this._html; },
                set innerHTML(h) { this._html = h; },
                get firstElementChild() { return this._dd = this._dd || { style: {}, offsetWidth: menu.w, offsetHeight: menu.h }; },
                querySelector(sel) { const a = [...this._html.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]); return a.length ? mkItem(a[0]) : null; },
                querySelectorAll() { this._items = this._items || [...this._html.matchAll(/data-action="([^"]+)"/g)].map(m => mkItem(m[1])); return this._items; },
            };
            return el;
        },
        body: { appendChild(el) { byId[el.id] = el; } },
        addEventListener(t, f) { (docListeners[t] = docListeners[t] || []).push(f); },
        removeEventListener(t, f) { docListeners[t] = (docListeners[t] || []).filter(x => x !== f); },
        get activeElement() { return active; },
    };
    const ctx = vm.createContext({
        console, JSON, Set, Object, Array, Number, String, Math, Promise, document,
        window: { innerWidth: viewport.w, innerHeight: viewport.h, AnamnesisModule: { open: id => log.push('anamnesis:' + id) } },
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'security.js'), 'utf8') + '\n;globalThis.esc = esc;', ctx);
    vm.runInContext('function RPETracker() {}', ctx);
    vm.runInContext(MENU_SRC, ctx, { filename: 'app-players.js (menú)' });
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = [{ id: 'p1', name: 'Hennie', lastName: 'X' }, { id: 'p2', name: '<img src=x onerror=alert(1)>', lastName: '' }];
    t.playerDisplayName = p => p.name;
    t.generatePlayerReport = id => log.push('report-individual:' + id);
    t.showPlayerReportMenu = id => log.push('report-menu:' + id);
    t.editPlayer = id => log.push('edit:' + id);
    t.openPlayerBajaModal = id => log.push('baja:' + id);
    t.deletePlayer = id => log.push('delete:' + id);
    const btn = { attrs: {}, setAttribute(k, v) { this.attrs[k] = v; log.push(`btn.${k}=${v}`); }, focus() { log.push('btn-focus'); },
                  getBoundingClientRect: () => ({ top: 100, bottom: 140, left: 340, right: 380 }) };
    return { t, byId, log, docListeners, btn, setActive: x => { active = x; } };
}
const click = (env, target) => env.byId.playerActionsOverlay._l.click({ target });
const itemEl = action => ({ closest: () => ({ dataset: { action } }) });

console.log('\nEstructura del menú');
test('secciones y acciones en el orden pensado, con «Eliminar» al final, separada y en rojo', () => {
    const e = makeEnv(); e.t.showPlayerActionsMenu('p1', e.btn);
    const h = e.byId.playerActionsOverlay.innerHTML;
    const actions = [...h.matchAll(/data-action="([^"]+)"/g)].map(m => m[1]);
    assert.deepStrictEqual(actions, ['report-individual', 'report-menu', 'edit', 'anamnesis', 'baja', 'delete']);
    const labels = [...h.matchAll(/class="gear-section-label">([^<]+)</g)].map(m => m[1]);
    assert.deepStrictEqual(labels, ['Informes', 'Ficha', 'Estado']);
    assert.ok(/gear-item gear-item--danger" role="menuitem" data-action="delete"/.test(h), 'Eliminar en rojo');
    assert.ok(/<div class="gear-divider"><\/div>\s*<button[^>]*data-action="delete"/.test(h), 'Eliminar separada del resto');
    assert.ok(h.includes('role="menu"') && h.includes('class="gear-dropdown"'));
    ['Informe individual (A4)', 'Informe PDF…', 'Editar jugadora', 'Anamnesis', 'Dar de baja', 'Eliminar jugadora'].forEach(x => assert.ok(h.includes(x), 'falta ' + x));
});
test('ningún id ni nombre va dentro de un onclick y el nombre de la jugadora se escapa', () => {
    const e = makeEnv(); e.t.showPlayerActionsMenu('p2', e.btn);
    const h = e.byId.playerActionsOverlay.innerHTML;
    assert.ok(!/onclick/i.test(h), 'sin onclick en el menú');
    assert.ok(!h.includes('<img src=x') && h.includes('&lt;img'));
});
test('la tarjeta de jugadora tiene UN botón ⋮ y ya no los 6 botones de colores', () => {
    assert.strictEqual((SRC.match(/class="player-menu-btn"/g) || []).length, 1);
    assert.ok(/showPlayerActionsMenu\('\$\{player\.id\}', this, event\)/.test(SRC));
    assert.ok(/aria-haspopup="menu"/.test(SRC) && /aria-expanded="false"/.test(SRC));
    ['showPlayerReportMenu', 'generatePlayerReport', 'AnamnesisModule?.open', 'editPlayer', 'openPlayerBajaModal', 'deletePlayer'].forEach(f =>
        assert.ok(!new RegExp(`onclick="[^"]*${f.replace('?', '\\?')}\\('\\$\\{player\\.id\\}'\\)`).test(SRC), `el botón directo de ${f} debe haber desaparecido de la tarjeta`));
    assert.ok(!SRC.includes('class="btn-icon"'));
});

console.log('\nAcciones');
test('cada opción llama a lo mismo que antes su botón, con el id de la jugadora', () => {
    const expected = { 'report-individual': 'report-individual:p1', 'report-menu': 'report-menu:p1', edit: 'edit:p1', anamnesis: 'anamnesis:p1', baja: 'baja:p1', delete: 'delete:p1' };
    Object.entries(expected).forEach(([action, call]) => {
        const e = makeEnv(); e.t.showPlayerActionsMenu('p1', e.btn);
        click(e, itemEl(action));
        assert.ok(e.log.includes(call), `${action} debe llamar a ${call}`);
    });
});
test('el menú se cierra ANTES de actuar y todo es síncrono (los informes necesitan el gesto del usuario para window.open)', () => {
    const e = makeEnv(); e.t.showPlayerActionsMenu('p1', e.btn); e.log.length = 0;
    click(e, itemEl('report-individual'));
    assert.ok(e.log.indexOf('overlay-removed') >= 0 && e.log.indexOf('overlay-removed') < e.log.indexOf('report-individual:p1'));
    assert.ok(!e.byId.playerActionsOverlay, 'menú cerrado');
});
test('eliminar y dar de baja pasan por deletePlayer / openPlayerBajaModal, que mantienen sus confirmaciones', () => {
    const pl = fs.readFileSync(path.join(ROOT, 'app-players.js'), 'utf8');
    assert.ok(/prototype\.deletePlayer = function\(playerId\) \{\s*if \(typeof this\._pdDeleteFlow === 'function'\) return this\._pdDeleteFlow/.test(pl));
    assert.ok(/_deletePlayerBasic = function[\s\S]{0,900}AppConfirm\.show\(\{[\s\S]{0,400}danger: true/.test(pl), 'el borrado básico sigue pidiendo confirmación (AppConfirm, en rojo)');
    assert.ok(/case 'delete':\s+return this\.deletePlayer\(playerId\)/.test(MENU_SRC) && /case 'baja':\s+return this\.openPlayerBajaModal\(playerId\)/.test(MENU_SRC));
});
test('una acción desconocida no hace nada', () => {
    const e = makeEnv(); e.t.showPlayerActionsMenu('p1', e.btn); e.log.length = 0;
    click(e, itemEl('lo-que-sea'));
    assert.ok(!e.log.some(x => /:p1$/.test(x)));
});

console.log('\nCerrar y teclado');
test('clic fuera cierra sin actuar; clic en una etiqueta o separador no cierra ni actúa', () => {
    const e = makeEnv(); e.t.showPlayerActionsMenu('p1', e.btn); e.log.length = 0;
    click(e, { closest: () => null });
    assert.ok(e.byId.playerActionsOverlay && e.log.length === 0, 'sigue abierto');
    click(e, e.byId.playerActionsOverlay);
    assert.ok(!e.byId.playerActionsOverlay); assert.ok(!e.log.some(x => /:p1$/.test(x)));
});
test('Esc cierra, quita el listener del teclado y devuelve el foco al botón ⋮', () => {
    const e = makeEnv(); e.t.showPlayerActionsMenu('p1', e.btn);
    assert.strictEqual(e.docListeners.keydown.length, 1);
    e.docListeners.keydown[0]({ key: 'Escape' });
    assert.ok(!e.byId.playerActionsOverlay); assert.strictEqual(e.docListeners.keydown.length, 0);
    assert.ok(e.log.includes('btn-focus') && e.log.includes('btn.aria-expanded=false'));
});
test('las flechas recorren las opciones (también dando la vuelta)', () => {
    const e = makeEnv(); e.t.showPlayerActionsMenu('p1', e.btn, { detail: 0 });   // abierto con el teclado
    const key = e.docListeners.keydown[0];
    assert.strictEqual(e.log.filter(x => x.startsWith('focus:'))[0], 'focus:report-individual', 'enfoca la primera al abrir');
    const items = e.byId.playerActionsOverlay.querySelectorAll();
    e.setActive(items[0]); e.log.length = 0;
    key({ key: 'ArrowDown', preventDefault() {} });
    assert.strictEqual(e.log[0], 'focus:report-menu');
    e.setActive(items[0]); e.log.length = 0;
    key({ key: 'ArrowUp', preventDefault() {} });
    assert.strictEqual(e.log[0], 'focus:delete', 'desde la primera, hacia arriba va a la última');
});
test('abierto con ratón o dedo NO enfoca la primera opción (sin aro de foco); con teclado, sí', () => {
    const mouse = makeEnv(); mouse.t.showPlayerActionsMenu('p1', mouse.btn, { detail: 1 });
    assert.ok(!mouse.log.some(x => x.startsWith('focus:')));
    const kb = makeEnv(); kb.t.showPlayerActionsMenu('p1', kb.btn, { detail: 0 });
    assert.ok(kb.log.includes('focus:report-individual'));
});
test('solo hay un menú a la vez y un único listener de teclado, aunque se abra varias veces', () => {
    const e = makeEnv();
    e.t.showPlayerActionsMenu('p1', e.btn); e.t.showPlayerActionsMenu('p1', e.btn); e.t.showPlayerActionsMenu('p2', e.btn);
    assert.strictEqual(e.docListeners.keydown.length, 1);
    assert.ok(e.byId.playerActionsOverlay);
});
test('una jugadora que no existe no abre nada', () => {
    const e = makeEnv(); e.t.showPlayerActionsMenu('nadie', e.btn);
    assert.ok(!e.byId.playerActionsOverlay); assert.strictEqual(e.docListeners.keydown, undefined);
});
test('el botón marca aria-expanded mientras el menú está abierto', () => {
    const e = makeEnv(); e.t.showPlayerActionsMenu('p1', e.btn);
    assert.strictEqual(e.btn.attrs['aria-expanded'], 'true');
    e.t.closePlayerActionsMenu();
    assert.strictEqual(e.btn.attrs['aria-expanded'], 'false');
});

console.log('\nPosición');
const dropdownOf = e => e.byId.playerActionsOverlay.firstElementChild.style;
test('debajo del botón y alineado a su derecha cuando cabe', () => {
    const e = makeEnv({ viewport: { w: 400, h: 800 } });
    e.btn.getBoundingClientRect = () => ({ top: 100, bottom: 140, right: 380 });
    e.t.showPlayerActionsMenu('p1', e.btn);
    assert.deepStrictEqual([dropdownOf(e).top, dropdownOf(e).left], ['146px', '150px']);   // 140+6 · 380-230
});
test('si no cabe debajo, se abre ENCIMA del botón', () => {
    const e = makeEnv({ viewport: { w: 400, h: 800 } });
    e.btn.getBoundingClientRect = () => ({ top: 700, bottom: 740, right: 380 });
    e.t.showPlayerActionsMenu('p1', e.btn);
    assert.strictEqual(dropdownOf(e).top, '394px');                                         // 700-300-6
});
test('nunca se sale de la pantalla por los lados (botón muy a la izquierda o a la derecha)', () => {
    const a = makeEnv({ viewport: { w: 400, h: 800 } });
    a.btn.getBoundingClientRect = () => ({ top: 100, bottom: 140, right: 100 });
    a.t.showPlayerActionsMenu('p1', a.btn);
    assert.strictEqual(dropdownOf(a).left, '8px');
    const b = makeEnv({ viewport: { w: 400, h: 800 } });
    b.btn.getBoundingClientRect = () => ({ top: 100, bottom: 140, right: 500 });
    b.t.showPlayerActionsMenu('p1', b.btn);
    assert.strictEqual(dropdownOf(b).left, '162px');                                         // 400-230-8
});
test('si no cabe ni debajo ni encima (pantalla muy baja) se queda arriba del todo', () => {
    const e = makeEnv({ viewport: { w: 400, h: 200 } });
    e.btn.getBoundingClientRect = () => ({ top: 10, bottom: 50, right: 395 });
    e.t.showPlayerActionsMenu('p1', e.btn);
    assert.strictEqual(dropdownOf(e).top, '8px');
});
test('sin botón de origen el menú se abre igualmente (sin colocar) y no falla', () => {
    const e = makeEnv();
    assert.doesNotThrow(() => e.t.showPlayerActionsMenu('p1', undefined));
    assert.ok(e.byId.playerActionsOverlay);
});

(async () => {
    for (const q of queue) {
        try { await q.fn(); passed++; console.log('  ✅ ' + q.name); }
        catch (e) { failed++; console.log('  ❌ ' + q.name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

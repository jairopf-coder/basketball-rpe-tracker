// test/bottom-nav.test.js
// Navegación inferior del iPhone: barra Inicio · Carga · Salud · Más.
//   A) Lógica     — el NavMenu REAL (app.js) y el BottomNav REAL (index.html) sobre un DOM mínimo
//   B) Estructura — app.js, index.html y styles.css (geometría de la barra, fondo del cajón, solo móvil)
// Ejecutar con:  node test/bottom-nav.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
// Los objetos creados DENTRO del sandbox (vm) pertenecen a otro "realm": se normalizan antes de compararlos
const J = x => JSON.parse(JSON.stringify(x));

const html = read('index.html');
const appJs = read('app.js');
const css = read('styles.css');

// ── Código real extraído de los archivos ─────────────────────────────
const bnStart = html.lastIndexOf('<script>', html.indexOf('const BN_TAB_GROUPS')) + '<script>'.length;
const BN_CODE = html.slice(bnStart, html.indexOf('</script>', bnStart));
const navStart = appJs.indexOf('const NavMenu = {');
const NAV_CODE = appJs.slice(navStart, appJs.indexOf('\n};', navStart) + 3);

// ── DOM mínimo: solo lo que usa BottomNav ────────────────────────────
function makeEl(init = {}) {
    const cls = new Set(init.cls || []);
    return {
        dataset: init.dataset || {}, attrs: Object.assign({}, init.attrs), style: {}, innerHTML: '',
        classList: {
            add: c => cls.add(c), remove: c => cls.delete(c), contains: c => cls.has(c),
            toggle: (c, f) => { const on = f === undefined ? !cls.has(c) : !!f; if (on) cls.add(c); else cls.delete(c); return on; },
        },
        setAttribute(k, v) { this.attrs[k] = String(v); },
        removeAttribute(k) { delete this.attrs[k]; },
        addEventListener() {},
    };
}

function loadBottomNav() {
    const els = {
        bnMoreMenu: makeEl({ attrs: { 'aria-hidden': 'true' } }), bnMoreOverlay: makeEl(), bottomNav: makeEl(),
        bnMoreBody: makeEl(), dashboardFab: makeEl(),
        bnMoreBtn: makeEl({ dataset: { bnGroup: 'more' }, attrs: { 'aria-expanded': 'false' } }),
    };
    const btns = [
        makeEl({ dataset: { bnGroup: 'dashboard' }, cls: ['active'], attrs: { 'aria-current': 'page' } }),
        makeEl({ dataset: { bnGroup: 'carga' } }),
        makeEl({ dataset: { bnGroup: 'salud' } }),
        els.bnMoreBtn,
    ];
    const document = {
        getElementById: id => els[id] || null,
        querySelectorAll: sel => (sel === '.bottom-nav-btn' ? btns : []),
        querySelector: () => null,
        addEventListener() {},
        documentElement: { style: { setProperty() {} } },
    };
    const visited = [];
    // Igual que app.js: switchView() termina avisando a BottomNav.syncToView()
    const window = { rpeTracker: { switchView: v => { visited.push(v); ctx.__BN.syncToView(v); } } };
    const ctx = vm.createContext({ document, window, console });
    vm.runInContext(
        NAV_CODE + '\n' + BN_CODE + '\nglobalThis.__BN = BottomNav; globalThis.__NM = NavMenu; globalThis.__TABS = BN_TAB_GROUPS;', ctx);
    const BN = ctx.__BN, NM = ctx.__NM;
    const activeGroups = () => btns.filter(b => b.classList.contains('active')).map(b => b.dataset.bnGroup);
    const ariaCurrent = () => btns.filter(b => b.attrs['aria-current'] === 'page').map(b => b.dataset.bnGroup);
    const tap = group => BN.select(btns.find(b => b.dataset.bnGroup === group));
    return { BN, NM, els, btns, visited, activeGroups, ariaCurrent, tap, tabs: J(ctx.__TABS) };
}

const allViews = NM => Object.values(NM.groups).flatMap(g => g.direct ? [g.direct] : g.items.map(i => i.view));

// ════════════════════════════════════════════════════════════════════
// A) Lógica
// ════════════════════════════════════════════════════════════════════
console.log('\nA) Lógica (NavMenu de app.js + BottomNav de index.html)');

test('las pestañas de la barra son Inicio + Carga + Salud (y "Más")', () => {
    const e = loadBottomNav();
    assert.deepStrictEqual(e.tabs, ['carga', 'salud']);
    assert.deepStrictEqual(e.btns.map(b => b.dataset.bnGroup), ['dashboard', 'carga', 'salud', 'more']);
});

test('TODAS las pantallas de NavMenu son alcanzables: pestaña/subsecciones o cajón "Más"', () => {
    const e = loadBottomNav(); e.BN.renderMore();
    const drawer = e.els.bnMoreBody.innerHTML;
    for (const view of allViews(e.NM)) {
        const tab = e.BN.tabOf(view);
        assert.ok(['dashboard', 'carga', 'salud', 'more'].includes(tab), `${view}: sin pestaña (${tab})`);
        if (tab === 'more') assert.ok(drawer.includes(`BottomNav.selectMore('${view}')`), `${view} no está en el cajón Más`);
    }
});

test('las pantallas de Carga y Salud NO se repiten en el cajón', () => {
    const e = loadBottomNav(); e.BN.renderMore();
    for (const g of ['carga', 'salud']) for (const i of e.NM.groups[g].items) {
        assert.ok(!e.els.bnMoreBody.innerHTML.includes(`'${i.view}'`), `${i.view} duplicada en Más`);
    }
});

test('"Más" pasa de 14 a solo Equipo y Rendimiento, cada uno con su título', () => {
    const e = loadBottomNav(); e.BN.renderMore();
    assert.deepStrictEqual(J(e.BN.moreGroups()), ['equipo', 'rendimiento']);
    const h = e.els.bnMoreBody.innerHTML;
    assert.ok(/bn-more-title">Equipo</.test(h) && /bn-more-title">Rendimiento</.test(h));
    assert.strictEqual((h.match(/class="bn-more-item"/g) || []).length, 5);
    assert.ok(/bn-more-icon" aria-hidden="true">🏋️</.test(h) && />Gimnasio</.test(h), 'icono y texto separados del label');
});

test('un grupo nuevo en NavMenu.groups aparece solo en "Más" (ya no hay lista a mano)', () => {
    const e = loadBottomNav();
    e.NM.groups.nuevo = { label: '🧪 Laboratorio', items: [{ view: 'probando', label: '🔬 Probando' }], default: 'probando' };
    e.BN.renderMore();
    assert.ok(e.els.bnMoreBody.innerHTML.includes("BottomNav.selectMore('probando')"));
    assert.ok(/bn-more-title">Laboratorio</.test(e.els.bnMoreBody.innerHTML));
    assert.strictEqual(e.BN.tabOf('probando'), 'more');
});

test('para CADA pantalla se resalta exactamente UN botón, y el correcto', () => {
    const e = loadBottomNav();
    for (const view of allViews(e.NM)) {
        e.BN.syncToView(view);
        const expected = e.BN.tabOf(view);
        assert.deepStrictEqual(J(e.activeGroups()), [expected], `${view}: debería resaltar ${expected}`);
        assert.deepStrictEqual(J(e.ariaCurrent()), [expected], `${view}: aria-current`);
    }
});

test('Equipo y Rendimiento resaltan "Más"; Carga y Salud resaltan su propia pestaña', () => {
    const e = loadBottomNav();
    const expect = { players: 'more', teamstatus: 'more', objectives: 'more', gym: 'more', tests: 'more',
                     microciclo: 'carga', calendar: 'carga', wellness: 'salud', rehab: 'salud', dashboard: 'dashboard' };
    for (const [view, tab] of Object.entries(expect)) { e.BN.syncToView(view); assert.deepStrictEqual(J(e.activeGroups()), [tab], view); }
});

test('una pantalla suelta que no está en el menú ("medical") no cambia el resaltado', () => {
    const e = loadBottomNav();
    e.BN.syncToView('wellness'); e.BN.syncToView('medical');
    assert.deepStrictEqual(J(e.activeGroups()), ['salud']);
});

test('pestañas: la primera vez van a la pantalla por defecto (Carga→Microciclo, Salud→Wellness, Inicio→dashboard)', () => {
    const e = loadBottomNav();
    e.tap('carga'); e.tap('salud'); e.tap('dashboard');
    assert.deepStrictEqual(J(e.visited), ['microciclo', 'wellness', 'dashboard']);
});

test('cada pestaña recuerda la última pantalla de SU grupo', () => {
    const e = loadBottomNav();
    e.tap('salud'); e.BN._go('injury');      // en Salud, elige Lesiones desde la fila de subsecciones
    e.tap('carga'); e.BN._go('sessions');    // en Carga, elige Historial
    e.visited.length = 0;
    e.tap('salud'); e.tap('carga');
    assert.deepStrictEqual(J(e.visited), ['injury', 'sessions']);
});

test('la memoria también sirve si se navega sin la barra (widget, notificación…)', () => {
    const e = loadBottomNav();
    e.BN.syncToView('rehab'); e.BN.syncToView('dashboard'); e.visited.length = 0;
    e.tap('salud');
    assert.deepStrictEqual(J(e.visited), ['rehab']);
});

test('cajón: abrir y cerrar actualiza menú, fondo, barra y aria del botón', () => {
    const e = loadBottomNav();
    e.BN.toggleMore();
    for (const k of ['bnMoreMenu', 'bnMoreOverlay', 'bottomNav']) assert.ok(e.els[k].classList.contains('bn-more-open'), `${k} abierto`);
    assert.strictEqual(e.els.bnMoreBtn.attrs['aria-expanded'], 'true');
    assert.strictEqual(e.els.bnMoreMenu.attrs['aria-hidden'], 'false');
    e.BN.toggleMore();
    for (const k of ['bnMoreMenu', 'bnMoreOverlay', 'bottomNav']) assert.ok(!e.els[k].classList.contains('bn-more-open'), `${k} cerrado`);
    assert.strictEqual(e.els.bnMoreBtn.attrs['aria-expanded'], 'false');
    assert.strictEqual(e.els.bnMoreMenu.attrs['aria-hidden'], 'true');
});

test('abrir "Más" NO deja dos botones activos a la vez', () => {
    const e = loadBottomNav();
    e.BN.toggleMore();
    assert.deepStrictEqual(J(e.activeGroups()), ['dashboard'], 'la clase .active sigue en una sola pestaña (el CSS atenúa la otra)');
});

test('con el cajón abierto, tocar una pestaña lo cierra y navega a la vez', () => {
    const e = loadBottomNav();
    e.BN.toggleMore(); e.tap('salud');
    assert.ok(!e.els.bnMoreMenu.classList.contains('bn-more-open'));
    assert.deepStrictEqual(J(e.visited), ['wellness']);
    assert.deepStrictEqual(J(e.activeGroups()), ['salud']);
});

test('elegir una pantalla de "Más" navega, cierra el cajón y deja resaltado "Más"', () => {
    const e = loadBottomNav();
    e.BN.toggleMore(); e.BN.selectMore('gym');
    assert.ok(!e.els.bnMoreMenu.classList.contains('bn-more-open'));
    assert.deepStrictEqual(J(e.visited), ['gym']);
    assert.deepStrictEqual(J(e.activeGroups()), ['more']);
});

test('pulsar "Más" dos veces seguidas lo deja cerrado (sin estados intermedios)', () => {
    const e = loadBottomNav();
    e.BN.toggleMore(); e.BN.toggleMore();
    assert.ok(!e.els.bnMoreMenu.classList.contains('bn-more-open') && !e.els.bnMoreOverlay.classList.contains('bn-more-open'));
});

test('init(): dibuja el cajón y deja "Inicio" activo', () => {
    const e = loadBottomNav(); e.BN.init();
    assert.ok(e.els.bnMoreBody.innerHTML.includes('selectMore('));
    assert.deepStrictEqual(J(e.activeGroups()), ['dashboard']);
});

// ════════════════════════════════════════════════════════════════════
// B) Estructura
// ════════════════════════════════════════════════════════════════════
console.log('\nB) Estructura (app.js, index.html, styles.css)');

// CSS sin comentarios + utilidad para saber dentro de qué @media está una regla
const clean = css.replace(/\/\*[\s\S]*?\*\//g, '');
function enclosingAtRules(idx) {
    const stack = []; let buf = '';
    for (let i = 0; i < idx; i++) {
        const c = clean[i];
        if (c === '{') { stack.push(buf.trim()); buf = ''; }
        else if (c === '}') { stack.pop(); buf = ''; }
        else if (c === ';') buf = '';
        else buf += c;
    }
    return stack.filter(h => h.startsWith('@'));
}
function rule(selector) {   // une los cuerpos de TODAS las reglas CSS con exactamente este selector
    const re = new RegExp('(?:^|[}{;])\\s*' + selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{([^}]*)\\}', 'g');
    let m, body = ''; while ((m = re.exec(clean))) body += m[1] + ';';
    assert.ok(body, `no encuentro la regla ${selector}`);
    return { body };
}
const px = (body, prop) => { const m = new RegExp('(?:^|[;\\s])' + prop + ':\\s*([\\d.]+)(px|rem)').exec(body); assert.ok(m, `falta ${prop}`); return parseFloat(m[1]) * (m[2] === 'rem' ? 16 : 1); };

test('app.js: switchView avisa a la barra inferior justo después de NavMenu.syncToView', () => {
    assert.ok(/NavMenu\.syncToView\(viewName\);\s*\n\s*if \(typeof BottomNav !== 'undefined'\) BottomNav\.syncToView\(viewName\);/.test(appJs));
});

test('app.js: la fila de subsecciones centra el chip activo tras redibujarse', () => {
    const fn = appJs.slice(appJs.indexOf('renderSubBar(groupKey) {'), appJs.indexOf('hideSubBar() {'));
    assert.ok(/nav-sub-btn\.active/.test(fn) && /scrollLeft/.test(fn));
});

test('index.html: las insignias siguen con el mismo id (app.js las actualiza): alertas en Carga, lesiones en Salud', () => {
    const btn = g => (html.match(new RegExp('<button[^>]*data-bn-group="' + g + '"[\\s\\S]*?</button>')) || [''])[0];
    assert.ok(btn('carga').includes('id="bnAlertBadge"'));
    assert.ok(btn('salud').includes('id="bnInjuryBadge"'));
    assert.ok(appJs.includes("getElementById('bnAlertBadge')") && appJs.includes("getElementById('bnInjuryBadge')"));
});

test('index.html: ya no hay lista de pantallas a mano en el cajón ni espera a "transitionend"', () => {
    const htmlSinScript = html.replace(BN_CODE, '');   // la plantilla del script SÍ lleva class="bn-more-item": es la que genera el cajón
    assert.ok(!htmlSinScript.includes('class="bn-more-item"'), 'items escritos a mano');
    assert.ok(!htmlSinScript.includes('selectMore('), 'llamadas a selectMore escritas a mano');
    assert.ok(!/transitionend/.test(BN_CODE));
    assert.ok(!/window\.NavMenu/.test(BN_CODE), 'NavMenu es un const: window.NavMenu no existe');
});

test('index.html: el cajón nace cerrado y accesible; el botón "Más" declara aria-expanded', () => {
    assert.ok(/id="bnMoreMenu"[^>]*role="dialog"[^>]*aria-hidden="true"/.test(html));
    assert.ok(/id="bnMoreBtn"[^>]*aria-expanded="false"/.test(html));
    assert.ok(!/id="bnMoreMenu"[^>]*style="display:none"/.test(html), 'ya no depende de style inline');
});

test('CSS: la zona de botones mide ≥44px y la zona segura es un margen APARTE (no se resta a los botones)', () => {
    const root = /--bn-h:\s*(\d+)px/.exec(clean); assert.ok(root);
    assert.ok(+root[1] >= 44, `--bn-h=${root[1]}px < 44px (mínimo recomendado para pulsar en iOS)`);
    assert.ok(/--bn-total:\s*calc\(var\(--bn-h\)\s*\+\s*env\(safe-area-inset-bottom/.test(clean));
    const bar = rule('.bottom-nav').body;
    assert.ok(/height:\s*var\(--bn-total\)/.test(bar) && /padding-bottom:\s*env\(safe-area-inset-bottom/.test(bar));
});

test('CSS: icono + gap + etiqueta CABEN dentro del botón (antes sobresalían de la barra)', () => {
    const h = +/--bn-h:\s*(\d+)px/.exec(clean)[1];
    const icon = px(rule('.bottom-nav-btn .bn-icon').body, 'height');
    const btn = rule('.bottom-nav-btn').body;
    const gap = px(btn, 'gap'), labelLine = px(btn, 'font-size') * 1.1;
    const content = icon + gap + labelLine, available = h - 1;   // 1px = borde superior de la barra
    assert.ok(content + 8 <= available, `contenido ${content.toFixed(1)}px no cabe con margen en ${available}px`);
});

test('CSS: el fondo oscuro NO cubre la barra y el cajón queda pegado a ella (sin hueco)', () => {
    const ov = rule('.bn-more-overlay').body, menu = rule('.bn-more-menu').body;
    assert.ok(/bottom:\s*var\(--bn-total/.test(ov), 'el fondo debe terminar donde empieza la barra');
    assert.ok(!/inset:\s*0/.test(ov));
    assert.ok(/bottom:\s*var\(--bn-total/.test(menu), 'el cajón debe apoyarse en la barra');
});

test('CSS: cajón y fondo CERRADOS no recogen toques (visibility + pointer-events, sin esperar a ninguna animación)', () => {
    for (const sel of ['.bn-more-overlay', '.bn-more-menu']) {
        const b = rule(sel).body;
        assert.ok(/visibility:\s*hidden/.test(b) && /pointer-events:\s*none/.test(b), `${sel} cerrado debe ser inerte`);
        const open = rule(sel + '.bn-more-open').body;
        assert.ok(/visibility:\s*visible/.test(open) && /pointer-events:\s*auto/.test(open), `${sel} abierto`);
    }
    assert.ok(/touch-action:\s*none/.test(rule('.bn-more-overlay').body));
});

test('CSS: con el cajón abierto solo "Más" aparece resaltado', () => {
    assert.ok(/\.bottom-nav\.bn-more-open \.bottom-nav-btn\.active:not\(\[aria-expanded="true"\]\)\s*\{[^}]*color:\s*var\(--text-muted\)/.test(clean));
});

test('CSS: PC e iPad (≥641px) intactos — las reglas nuevas de barra y subsecciones viven SOLO en @media (max-width: 640px)', () => {
    for (const needle of ['.nav-group-bar { display: none; }', '.bottom-nav {', '--bn-h: 56px', '.nav-groups { display: block;']) {
        const idx = clean.lastIndexOf(needle); assert.ok(idx >= 0, needle);
        assert.ok(enclosingAtRules(idx).some(h => /^@media\s*\(max-width:\s*640px\)/.test(h)), `${needle} fuera de @media (max-width: 640px)`);
    }
    // y en escritorio el cajón sigue oculto
    const hide = clean.indexOf('#bnMoreBtn, #bnMoreMenu, #bnMoreOverlay');
    assert.ok(hide >= 0 && enclosingAtRules(hide).some(h => /min-width:\s*641px/.test(h)));
    const ov = clean.lastIndexOf('.bn-more-overlay { display: none !important; }');
    assert.ok(ov >= 0 && enclosingAtRules(ov).some(h => /min-width:\s*641px/.test(h)));
});

test('CSS: llaves equilibradas', () => {
    assert.strictEqual(clean.split('{').length, clean.split('}').length);
});

test('sw.js: CACHE_VERSION subida (los móviles descargan el nuevo index.html y styles.css)', () => {
    const v = +/CACHE_VERSION = 'v(\d+)'/.exec(read('sw.js'))[1];
    assert.ok(v >= 132, `v${v}`);
});

(async () => {
    for (const q of queue) {
        try { await q.fn(); console.log(`  ✅ ${q.name}`); passed++; }
        catch (e) { console.log(`  ❌ ${q.name}\n     ${String(e.message).split('\n')[0]}`); failed++; }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

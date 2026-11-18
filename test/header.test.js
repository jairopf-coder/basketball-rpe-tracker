// test/header.test.js
// ============================================================
// Header «Tipográfico con latido» y navegación sin emojis en PC.
//
//   - Header: logo de línea + «Load Ctrl» (con «Ctrl» en naranja) + línea de ECG.
//   - Estado de conexión: SOLO un punto de color; el texto sigue en el HTML (lectores de pantalla)
//     y como tooltip (title), pero no se ve.
//   - Navegación en PC (≥641px): sin emojis, ni en las 5 pestañas ni en la fila de subsecciones.
//     En MÓVIL se mantienen, y NavMenu.groups conserva el formato «<emoji> <texto>» que lee BottomNav.
//   - La tipografía va incluida en el repositorio (la app es una PWA y debe verse sin conexión).
//
// Ejecutar con:  node test/header.test.js
// ============================================================

'use strict';
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const vm = require('vm');

let passed = 0;
let failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (err) { console.log(`  ❌ ${name}`); console.log(`     ${err.message}`); failed++; }
}

const ROOT = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(ROOT, f), 'utf8');
const html = read('index.html');
const appJs = read('app.js');
const css = read('styles.css');
const sw = read('sw.js');
const headerHtml = html.slice(html.indexOf('<header>'), html.indexOf('</header>'));

// Cuerpo de un bloque @media (min-width: N) { ... } buscado por su cabecera, con llaves balanceadas
function mediaBlock(header) {
    const start = css.lastIndexOf(header);
    assert.ok(start >= 0, 'no existe: ' + header);
    let i = css.indexOf('{', start), depth = 0;
    for (let j = i; j < css.length; j++) {
        if (css[j] === '{') depth++;
        else if (css[j] === '}' && --depth === 0) return css.slice(i + 1, j);
    }
    throw new Error('llaves sin cerrar');
}

// ============================================================
console.log('\nHeader (index.html)');

test('el nombre es «Load Ctrl» con «Ctrl» en un span de acento', () => {
    assert.ok(/<h1>[\s\S]*<span class="header-name">Load <span class="header-name-accent">Ctrl<\/span><\/span><\/h1>/.test(headerHtml));
    const text = headerHtml.match(/<span class="header-name">([\s\S]*?)<\/span><\/span>/)[1].replace(/<[^>]+>/g, '');
    assert.strictEqual(text, 'Load Ctrl');
});

test('la línea de ECG está dentro del header, es decorativa y no se puede enfocar', () => {
    const m = headerHtml.match(/<svg class="header-ecg"[^>]*>/);
    assert.ok(m, 'falta <svg class="header-ecg">');
    assert.ok(/aria-hidden="true"/.test(m[0]) && /focusable="false"/.test(m[0]));
});

test('el indicador de conexión sigue teniendo su texto (oculto) y un title; sus ids no cambian', () => {
    assert.ok(/<div id="connectionIndicator" class="connection-indicator connecting" title="Conectando\.\.\.">/.test(headerHtml));
    assert.ok(/<span class="connection-dot"><\/span>/.test(headerHtml));
    assert.ok(/<span class="connection-label">Conectando\.\.\.<\/span>/.test(headerHtml));
});

test('firebase-sync.js actualiza el title al cambiar entre «En línea» y «Sin conexión»', () => {
    const fn = read('firebase-sync.js');
    const body = fn.slice(fn.indexOf('updateConnectionIndicator(online) {'));
    assert.ok(/label\.textContent = online \? 'En línea' : 'Sin conexión';\s*\n\s*indicator\.title = label\.textContent;/.test(body));
});

test('los botones de acción del header (Pre-sesión, Nueva sesión, Opciones) no se han tocado', () => {
    ['headerActions', 'headerPreSessionBtn', 'addBtn', 'gearBtn'].forEach(id =>
        assert.ok(headerHtml.includes(`id="${id}"`), id));
    assert.ok(html.includes('id="headerActionsSlot"'));
});

// ============================================================
console.log('\nHeader (styles.css)');

test('el bloque del header va al final del archivo (sustituye a las reglas anteriores)', () => {
    const at = css.indexOf('HEADER — «Tipográfico con latido»');
    assert.ok(at > 0);
    assert.ok(css.length - at < 6000, 'el bloque debe ser lo último del archivo');
    ['header {', 'header h1 {', '.header-logo {', '.header-left {'].forEach(sel =>
        assert.ok(css.indexOf(sel, at) > at, `falta ${sel} en el bloque final`));
});

test('sin tarjeta: header sin sombra ni esquinas redondeadas, y en los dos temas', () => {
    const at = css.indexOf('HEADER — «Tipográfico con latido»');
    const blk = css.slice(at);
    const rule = blk.match(/\nheader \{([^}]*)\}/)[1];
    assert.ok(/box-shadow:\s*none/.test(rule) && /border-radius:\s*0/.test(rule));
    assert.ok(/\[data-theme="dark"\] header \{ box-shadow: none; \}/.test(blk));
});

test('el texto del estado de conexión se oculta visualmente pero no con display:none (accesible)', () => {
    const blk = css.slice(css.indexOf('HEADER — «Tipográfico con latido»'));
    const rule = blk.match(/header \.connection-label \{([^}]*)\}/)[1];
    assert.ok(/position:\s*absolute/.test(rule) && /clip:\s*rect\(0, 0, 0, 0\)/.test(rule));
    assert.ok(!/display:\s*none/.test(rule) && !/visibility:\s*hidden/.test(rule));
});

test('los cuatro estados tienen color de punto (en oscuro también) y «conectando/pendiente» laten', () => {
    const blk = css.slice(css.indexOf('HEADER — «Tipográfico con latido»'));
    ['online', 'offline', 'connecting'].forEach(s =>
        assert.ok(new RegExp(`header \\.connection-indicator\\.${s} \\.connection-dot`).test(blk), s));
    assert.ok(/\[data-theme="dark"\] header \.connection-indicator\.online \.connection-dot/.test(blk));
    assert.ok(/\.connection-indicator\.connecting \.connection-dot \{[^}]*animation: pulse-dot/.test(css));
    assert.ok(/\.connection-indicator\.pending \.connection-dot \{[^}]*animation: pulse-dot/.test(css));
});

test('la navegación se pega bajo el header con su altura real (--header-h), no con 53px fijos', () => {
    const blk = css.slice(css.indexOf('HEADER — «Tipográfico con latido»'));
    assert.ok(/\.nav-groups \{ top: var\(--header-h, 98px\); \}/.test(blk));
    assert.ok(/header\.offsetHeight/.test(html) && /--header-h/.test(html), 'BottomNav.init debe seguir midiendo el header');
});

test('en pantallas estrechas el nombre y la línea se reducen', () => {
    const blk = css.slice(css.indexOf('HEADER — «Tipográfico con latido»'));
    const m = mediaBlock.call(null, '@media (max-width: 768px) {\n    header h1 { font-size: 1.6rem; }');
    assert.ok(/header h1 \{ font-size: 1\.6rem; \}/.test(m) && /header \.header-ecg \{ height: 14px; \}/.test(m));
    assert.ok(blk.includes('@media (max-width: 768px)'));
});

// ============================================================
console.log('\nTipografía (PWA sin conexión)');

test('la fuente existe en el repositorio, es un WOFF2 real y su licencia (OFL) va con ella', () => {
    const f = fs.readFileSync(path.join(ROOT, 'fonts', 'space-grotesk-700.woff2'));
    assert.strictEqual(f.slice(0, 4).toString('latin1'), 'wOF2');
    assert.ok(f.length > 5000 && f.length < 60000, 'tamaño inesperado: ' + f.length);
    assert.ok(/SIL Open Font License/.test(read('fonts/OFL-SpaceGrotesk.txt')));
});

test('@font-face apunta a esa ruta (relativa, para GitHub Pages) con font-display: swap', () => {
    const m = css.match(/@font-face \{[^}]*Space Grotesk[^}]*\}/);
    assert.ok(m, 'falta @font-face');
    assert.ok(/url\('fonts\/space-grotesk-700\.woff2'\)/.test(m[0]) && /font-display:\s*swap/.test(m[0]));
});

test('el service worker la precachea (ruta relativa, sin barra inicial)', () => {
    const list = sw.slice(sw.indexOf('const urlsToCache = ['), sw.indexOf('];', sw.indexOf('const urlsToCache = [')));
    assert.ok(list.includes("'fonts/space-grotesk-700.woff2'"));
    assert.ok(!list.includes("'/fonts"));
});

// ============================================================
console.log('\nNavegación sin emojis en PC');

test('las 5 pestañas llevan el emoji en <span class="nav-ico"> y el texto fuera (aria-label intacto)', () => {
    const btns = html.match(/<button class="nav-group-btn[^>]*>[\s\S]*?<\/button>/g);
    assert.strictEqual(btns.length, 5);
    const names = btns.map(b => {
        assert.ok(/<span class="nav-ico" aria-hidden="true">\S+ <\/span>[A-Za-zñ]+<\/button>/.test(b), b);
        assert.ok(/aria-label="[^"]+"/.test(b));
        return b.replace(/<span class="nav-ico"[^>]*>[^<]*<\/span>/, '').replace(/<[^>]+>/g, '').trim();
    });
    assert.deepStrictEqual(names, ['Inicio', 'Carga', 'Salud', 'Rendimiento', 'Equipo']);
});

test('el CSS oculta .nav-ico SOLO a partir de 641px (en móvil se ven como antes)', () => {
    const inPc = mediaBlock('@media (min-width: 641px) {\n    .nav-group-btn .nav-ico');
    assert.ok(/\.nav-group-btn \.nav-ico,\s*\n\s*\.nav-sub-btn \.nav-ico \{ display: none; \}/.test(inPc));
    // fuera de ese @media no hay ninguna regla que oculte .nav-ico
    const outside = css.replace(inPc, '');
    assert.ok(!/\.nav-ico[^{]*\{[^}]*display:\s*none/.test(outside), 'hay una regla que oculta .nav-ico también en móvil');
});

// NavMenu REAL de app.js sobre un DOM mínimo
const navStart = appJs.indexOf('const NavMenu = {');
const NAV_CODE = appJs.slice(navStart, appJs.indexOf('\n};', navStart) + 3);
const bar = { style: {}, innerHTML: '', querySelector: () => null, getBoundingClientRect: () => ({ left: 0, width: 0 }), scrollLeft: 0 };
const ctx = vm.createContext({ document: { getElementById: id => (id === 'navSubBar' ? bar : null), querySelectorAll: () => [] }, window: {}, console });
vm.runInContext(NAV_CODE + '\nglobalThis.__NM = NavMenu;', ctx);
const NM = ctx.__NM;

test('la fila de subsecciones envuelve cada emoji en .nav-ico y conserva el texto', () => {
    Object.entries(NM.groups).filter(([, g]) => g.items).forEach(([key, g]) => {
        NM.renderSubBar(key);
        const spans = bar.innerHTML.match(/<span class="nav-ico" aria-hidden="true">[^<]+<\/span>/g) || [];
        assert.strictEqual(spans.length, g.items.length, key);
        g.items.forEach(item => {
            const text = item.label.slice(item.label.indexOf(' ') + 1);
            assert.ok(bar.innerHTML.includes('</span>' + text), `${key}: falta «${text}»`);
        });
    });
});

test('NavMenu.groups NO pierde los emojis: BottomNav (móvil) los lee con «<emoji> <texto>»', () => {
    const labels = Object.values(NM.groups).flatMap(g => [g.label, ...(g.items || []).map(i => i.label)]);
    assert.ok(labels.length >= 15);
    labels.forEach(l => assert.ok(/^\S+ \S/.test(l) && !/^[A-Za-zÁÉÍÓÚñ]/.test(l), 'sin emoji: ' + l));
});

test('un label sin emoji ni espacio no se rompe', () => {
    assert.strictEqual(NM._labelHtml('Resumen'), 'Resumen');
});

// ============================================================
console.log(`\n${passed} pasados, ${failed} fallados`);
process.exit(failed ? 1 : 0);

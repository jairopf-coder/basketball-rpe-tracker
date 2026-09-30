// test/pending-today.test.js
// Sección "Faltan hoy" de Inicio: quién no ha cubierto wellness / RPE hoy,
// mensaje para WhatsApp y botones de copiar / WhatsApp.
// Ejecutar con:  node test/pending-today.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }

const dom = { widgets: { innerHTML: '' }, appended: [], copied: null, opened: [] };
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, isNaN, Promise,
    esc: s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    document: {
        head: { appendChild() {} },
        getElementById: id => id === 'dbRightWidgets' ? dom.widgets : null,
        createElement: () => ({ style: {}, setAttribute() {}, select() {} }),
        body: { appendChild(e) { dom.appended.push(e); }, removeChild() {} },
        execCommand: () => (dom.execOk !== false),
    },
    navigator: {},
    window: { open: (...a) => dom.opened.push(a) },
});
vm.runInContext(`
    function RPETracker() {}
    function toLocalISODate(d) {
        const p = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
`, ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'dashboard-renderer.js'), 'utf8'), ctx);

const iso = off => { const d = new Date(); d.setDate(d.getDate() - off); return vm.runInContext('toLocalISODate', ctx)(d); };
function make() {
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = [
        { id: 'p1', name: 'Ana Pérez', authUid: 'uA' },
        { id: 'p2', name: 'Bea Ruiz', authUid: 'uB' },
        { id: 'p3', name: 'Carla Gil', authUid: 'uC' },
    ];
    t.wellnessData = []; t.sessions = []; t.injuries = []; t._playerRpeRaw = [];
    t.toasts = []; t.showToast = (m, ty) => t.toasts.push([m, ty]);
    return t;
}
const names = list => list.map(p => p.id);
const w = (pid, off) => ({ id: `w_${pid}_${iso(off || 0)}`, playerId: pid, date: iso(off || 0), sleep: 4, fatigue: 4, mood: 4, soreness: 4 });
const s = (pid, extra) => Object.assign({ id: 's_' + pid + Math.random(), playerId: pid, date: iso(0) + 'T10:00:00', timeOfDay: 'morning', type: 'training', rpe: 6, duration: 60, load: 360 }, extra || {});

console.log('\nWellness');
test('faltan las que no tienen wellness HOY (uno de ayer no cuenta)', () => {
    const t = make(); t.wellnessData = [w('p1', 0), w('p2', 1)];
    assert.deepStrictEqual(names(t._pendingToday().wellness), ['p2', 'p3']);
});
test('todas al día → lista vacía', () => {
    const t = make(); t.wellnessData = [w('p1'), w('p2'), w('p3')];
    assert.strictEqual(t._pendingToday().wellness.length, 0);
});

console.log('\nRPE');
test('sin ninguna sesión hoy → no se marca RPE a nadie (día de descanso)', () => {
    const t = make();
    const p = t._pendingToday();
    assert.strictEqual(p.hasSessionToday, false); assert.strictEqual(p.rpe.length, 0);
});
test('una sesión de tipo descanso no cuenta como sesión', () => {
    const t = make(); t.sessions = [s('p1', { type: 'rest' })];
    assert.strictEqual(t._pendingToday().rpe.length, 0);
});
test('con sesión hoy: faltan las que no tienen sesión ni han enviado RPE', () => {
    const t = make(); t.sessions = [s('p1')];
    assert.deepStrictEqual(names(t._pendingToday().rpe), ['p2', 'p3']);
});
test('quien envió su RPE (por cuenta vinculada) ya no falta, aunque no esté registrado', () => {
    const t = make(); t.sessions = [s('p1')];
    t._playerRpeRaw = [{ uid: 'uB', date: iso(0), sessionType: 'morning', rpe: 7 }];
    assert.deepStrictEqual(names(t._pendingToday().rpe), ['p3']);
});
test('quien envió su RPE con playerId explícito tampoco falta', () => {
    const t = make(); t.sessions = [s('p1')];
    t._playerRpeRaw = [{ uid: 'zzz', playerId: 'p3', date: iso(0), rpe: 5 }];
    assert.deepStrictEqual(names(t._pendingToday().rpe), ['p2']);
});
test('un RPE de ayer no cuenta para hoy', () => {
    const t = make(); t.sessions = [s('p1')];
    t._playerRpeRaw = [{ uid: 'uB', date: iso(1), rpe: 7 }];
    assert.deepStrictEqual(names(t._pendingToday().rpe), ['p2', 'p3']);
});
test('un RPE descartado por el staff (reviewed) cuenta como enviado', () => {
    const t = make(); t.sessions = [s('p1')];
    t._playerRpeRaw = [{ uid: 'uB', date: iso(0), rpe: 7, reviewed: true }];
    assert.ok(!names(t._pendingToday().rpe).includes('p2'));
});
test('las lesionadas (lesión activa) no salen en la línea de RPE', () => {
    const t = make(); t.sessions = [s('p1')];
    t.injuries = [{ playerId: 'p2', status: 'active' }, { playerId: 'p3', status: 'resolved' }];
    assert.deepStrictEqual(names(t._pendingToday().rpe), ['p3']);
});
test('el wellness pendiente NO excluye a las lesionadas', () => {
    const t = make(); t.injuries = [{ playerId: 'p2', status: 'active' }];
    assert.ok(names(t._pendingToday().wellness).includes('p2'));
});

console.log('\nNombres y mensaje');
test('nombres repetidos → inicial del primer apellido', () => {
    const t = make(); t.players.push({ id: 'p4', name: 'Ana Gómez' });
    assert.strictEqual(t._shortPlayerName(t.players[0]), 'Ana P.');
    assert.strictEqual(t._shortPlayerName(t.players[3]), 'Ana G.');
    assert.strictEqual(t._shortPlayerName(t.players[1]), 'Bea');
});
test('mensaje con wellness y RPE', () => {
    const t = make(); t.sessions = [s('p1')]; t.wellnessData = [w('p1')];
    const txt = t._pendingNoticeText();
    assert.strictEqual(txt, '¡Hola! Recordad rellenar hoy en la app:\n• Wellness: Bea, Carla\n• RPE: Bea, Carla\n¡Gracias! 🏀');
});
test('mensaje solo con la línea que corresponde', () => {
    const t = make(); t.wellnessData = [w('p1')];
    const txt = t._pendingNoticeText();
    assert.ok(txt.includes('• Wellness: Bea, Carla') && !txt.includes('RPE'));
});
test('si no falta nadie el mensaje está vacío', () => {
    const t = make(); t.wellnessData = [w('p1'), w('p2'), w('p3')];
    assert.strictEqual(t._pendingNoticeText(), '');
});

console.log('\nTarjeta');
test('muestra "Faltan hoy", las dos acciones y ya no "Sin wellness hoy"', () => {
    const t = make(); t.wellnessData = [w('p1')];
    t._renderRightWidgets();
    const h = dom.widgets.innerHTML;
    assert.ok(h.includes('Faltan hoy') && h.includes('Copiar aviso') && h.includes('WhatsApp'));
    assert.ok(!h.includes('Sin wellness hoy'));
    assert.ok(h.includes('Bea, Carla'));
});
test('sin nadie pendiente → "Todas al día" y sin botones', () => {
    const t = make(); t.wellnessData = [w('p1'), w('p2'), w('p3')];
    t._renderRightWidgets();
    const h = dom.widgets.innerHTML;
    assert.ok(h.includes('Todas al día') && !h.includes('Copiar aviso') && !h.includes('Faltan hoy'));
});
test('un nombre con HTML se escapa', () => {
    const t = make(); t.players[1].name = '<img src=x onerror=alert(1)>';
    t._renderRightWidgets();
    assert.ok(!dom.widgets.innerHTML.includes('<img'));
});

console.log('\nAcciones');
test('copiar con portapapeles moderno', async () => {
    const t = make(); t.wellnessData = [w('p1')];
    ctx.navigator.clipboard = { writeText: txt => { dom.copied = txt; return Promise.resolve(); } };
    t.copyPendingNotice(); await new Promise(r => setTimeout(r, 0));
    assert.strictEqual(dom.copied, t._pendingNoticeText());
    assert.strictEqual(t.toasts[0][1], 'success');
});
test('copiar cuando falla el portapapeles usa el respaldo', async () => {
    const t = make(); t.wellnessData = [w('p1')]; dom.appended.length = 0; dom.execOk = true;
    ctx.navigator.clipboard = { writeText: () => Promise.reject(new Error('denegado')) };
    t.copyPendingNotice(); await new Promise(r => setTimeout(r, 0));
    assert.strictEqual(dom.appended.length, 1); assert.strictEqual(dom.appended[0].value, t._pendingNoticeText());
    assert.strictEqual(t.toasts[0][1], 'success');
});
test('si tampoco funciona el respaldo, avisa sin decir que copió', async () => {
    const t = make(); t.wellnessData = [w('p1')]; dom.execOk = false;
    delete ctx.navigator.clipboard;
    t.copyPendingNotice(); await new Promise(r => setTimeout(r, 0));
    assert.strictEqual(t.toasts[0][1], 'warning'); dom.execOk = true;
});
test('WhatsApp abre wa.me con el mensaje codificado', () => {
    const t = make(); t.wellnessData = [w('p1')]; dom.opened.length = 0;
    t.sendPendingNoticeWhatsApp();
    const url = dom.opened[0][0];
    assert.ok(url.startsWith('https://wa.me/?text='));
    assert.strictEqual(decodeURIComponent(url.split('text=')[1]), t._pendingNoticeText());
});
test('sin nadie pendiente no copia ni abre WhatsApp', () => {
    const t = make(); t.wellnessData = [w('p1'), w('p2'), w('p3')]; dom.opened.length = 0; dom.copied = null;
    t.copyPendingNotice(); t.sendPendingNoticeWhatsApp();
    assert.strictEqual(dom.opened.length, 0); assert.strictEqual(dom.copied, null);
    assert.strictEqual(t.toasts.length, 2);
});

(async () => {
    for (const q of queue) {
        try { await q.fn(); console.log(`  ✅ ${q.name}`); passed++; }
        catch (e) { console.log(`  ❌ ${q.name}\n     ${e.message}`); failed++; }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

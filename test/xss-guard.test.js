// ============================================================
//  test/xss-guard.test.js
//  Protección contra XSS desde cuentas de jugadora:
//   1) esc() escapa también comillas (atributos entre comillas)
//   2) SafeData valida lo que escriben las jugadoras en Firebase
//   3) Los listeners de /wellnessPlayer y /playerRpeReports descartan
//      lo manipulado y la bandeja de RPE no deja pasar código
//   4) Храповик: el nº de ${x.name} / ${x.displayName} / ${x.email} sin esc()
//      no puede AUMENTAR (la Fase 2b lo irá bajando a 0)
//  Uso:  node test/xss-guard.test.js
// ============================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
let passed = 0, failed = 0;
const pending = [];
function test(name, fn) { pending.push({ name, fn }); }

// ---------- esc() y SafeData (solo la parte 1 y 1b de security.js) ----------
const secSrc = fs.readFileSync(path.join(ROOT, 'security.js'), 'utf8').split('// ── 2.')[0];
const baseCtx = vm.createContext({ window: {}, console });
vm.runInContext(secSrc + '\n;globalThis.__esc = esc; globalThis.__SafeData = SafeData;', baseCtx);
const esc = baseCtx.__esc;
const SafeData = baseCtx.__SafeData;

console.log('\nesc()');
test('escapa & < > " \' y tolera null/números', () => {
    assert.strictEqual(esc(`<a href="x" onclick='y'>&`), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;');
    assert.strictEqual(esc(null), '');
    assert.strictEqual(esc(undefined), '');
    assert.strictEqual(esc(0), '0');
});
test('un nombre con comillas no puede salirse de value="..."', () => {
    const html = `<input value="${esc('Ana" autofocus onfocus="alert(1)')}">`;
    assert.ok(!/value="[^"]*"\s+autofocus/.test(html), html);
});

console.log('\nSafeData');
test('num(): acepta números y "7"; rechaza HTML, booleanos, objetos, NaN y fuera de rango', () => {
    assert.strictEqual(SafeData.num(7, 1, 10), 7);
    assert.strictEqual(SafeData.num('7', 1, 10), 7);
    assert.strictEqual(SafeData.num(3.5, 1, 10), 3.5);
    for (const bad of ['<img src=x onerror=alert(1)>', true, {}, [], NaN, Infinity, 0, 11, '', null, undefined, '7<b>']) {
        assert.strictEqual(SafeData.num(bad, 1, 10), null, String(bad));
    }
});
test('date/id/ts/sessionType: solo formatos legítimos', () => {
    assert.strictEqual(SafeData.date('2026-10-04'), '2026-10-04');
    assert.strictEqual(SafeData.date('2026-10-04<script>'), null);
    assert.strictEqual(SafeData.id('Xk3_9-a'), 'Xk3_9-a');
    assert.strictEqual(SafeData.id("a');alert(1);('"), null);
    assert.strictEqual(SafeData.id('1727890000000_ab12c'), '1727890000000_ab12c');
    const ahora = new Date().toISOString();
    assert.strictEqual(SafeData.ts(ahora), ahora);
    assert.strictEqual(SafeData.ts('<x>'), null);
    assert.strictEqual(SafeData.sessionType('match'), 'match');
    assert.strictEqual(SafeData.sessionType('rest'), null);
});
test('rpeEntry: entrada legítima pasa; trae su _path seguro', () => {
    const e = SafeData.rpeEntry({ uid: 'uA', date: '2026-10-04', sessionType: 'match', rpe: 8, playerId: '1727_ab', ts: '2026-10-04T10:00:00.000Z' }, 'uA', '2026-10-04', 'match');
    assert.deepStrictEqual({ ...e }, { uid: 'uA', date: '2026-10-04', sessionType: 'match', rpe: 8, ts: '2026-10-04T10:00:00.000Z', reviewed: false, _path: 'playerRpeReports/uA/2026-10-04/match', playerId: '1727_ab' });
});
test('rpeEntry: uid de dentro de la entrada se ignora (manda el de la ruta); RPE no numérico se descarta', () => {
    const e = SafeData.rpeEntry({ uid: 'uVICTIMA', rpe: 5 }, 'uMAL', '2026-10-04', 'morning');
    assert.strictEqual(e.uid, 'uMAL');
    assert.strictEqual(SafeData.rpeEntry({ rpe: '<img src=x onerror=alert(1)>' }, 'uA', '2026-10-04', 'morning'), null);
    assert.strictEqual(SafeData.rpeEntry({ rpe: 5 }, 'uA', "x');alert(1);('", 'morning'), null);
    assert.strictEqual(SafeData.rpeEntry({ rpe: 5 }, 'uA', '2026-10-04', "x');alert(1);('"), null);
});
test('wellnessEntry: legítima pasa; strings con HTML en los números quedan en null', () => {
    const ok = SafeData.wellnessEntry({ uid: 'uA', date: '2026-10-04', sleep: 4, fatigue: 3, mood: 5, pain: 2, period: true, playerId: 'p1', ts: '2026-10-04T08:00:00.000Z' }, 'uA', '2026-10-04');
    assert.deepStrictEqual({ ...ok }, { uid: 'uA', date: '2026-10-04', sleep: 4, fatigue: 3, mood: 5, pain: 2, rpe: null, ts: '2026-10-04T08:00:00.000Z', playerId: 'p1', period: true });
    const bad = SafeData.wellnessEntry({ date: '2026-10-04', sleep: '<img src=x onerror=alert(1)>', mood: {}, ts: '<b>', playerId: '"><script>', period: 'true' }, 'uA', '2026-10-04');
    assert.strictEqual(bad.sleep, null); assert.strictEqual(bad.mood, null); assert.strictEqual(bad.ts, null);
    assert.ok(!('playerId' in bad)); assert.ok(!('period' in bad));
    assert.strictEqual(SafeData.wellnessEntry({ date: 'no-es-fecha' }, 'uA', 'tampoco'), null);
});

// ---------- Listeners reales (wellness.js y app-sessions.js) ----------
function loadTracker(file, ctxExtra) {
    const cbs = {};
    const ctx = vm.createContext(Object.assign({
        console, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, isNaN, isFinite, Promise, setTimeout,
        document: {
            getElementById: () => null, getElementsByTagName: () => [],
            createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }),
            head: { appendChild() {} }, body: { appendChild() {} }, addEventListener() {},
        },
        localStorage: { getItem: () => null, setItem() {} },
        window: { firebaseSync: {}, firebaseDB: { ref: p => ({ on: (ev, cb) => { cbs[p] = cb; }, update: () => Promise.resolve() }) }, _devMode: false },
        Store: { getActiveSeason: () => '2026-27' },
        AppConfirm: { show: () => Promise.resolve(true) },
        getCurrentSeasonWindowStart: () => '2026-08-01',
    }, ctxExtra || {}));
    vm.runInContext(secSrc + '\n;globalThis.esc = esc; globalThis.SafeData = SafeData;', ctx);
    vm.runInContext('function RPETracker() {}', ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx);
    const T = vm.runInContext('new RPETracker()', ctx);
    T.players = [{ id: 'p1', name: 'Ana', authUid: 'uA' }];
    T.sessions = []; T.currentView = 'other';
    T.getRPEColor = v => '#c' + v;
    T.renderDashboard = () => {}; T.renderWellnessDashboard = () => {};
    return { T, cbs, ctx };
}
const snap = (obj) => ({ val: () => obj });
const XSS = '<img src=x onerror=alert(1)>';
const BREAK = "');alert(1);('";

console.log('\nListener de /wellnessPlayer (wellness.js)');
test('descarta fechas raras, limpia valores con HTML y usa el uid de la ruta', () => {
    const { T, cbs } = loadTracker('wellness.js');
    T._registerWellnessPlayerListeners();
    cbs['wellnessPlayer'](snap({
        uA: {
            '2026-10-04': { uid: 'uVICTIMA', date: '2026-10-04', sleep: XSS, fatigue: 4, mood: 3, pain: 2, playerId: 'p1', ts: '2026-10-04T08:00:00.000Z' },
            [BREAK]: { date: BREAK, sleep: 3 },
        },
        uB: 'no soy un objeto',
    }));
    const c = T._wellnessPlayerCache;
    assert.strictEqual(c.length, 1, 'solo la entrada válida');
    assert.strictEqual(c[0].uid, 'uA', 'el uid sale de la ruta, no de la entrada');
    assert.strictEqual(c[0].sleep, null, 'el HTML en un número se anula');
    assert.strictEqual(c[0].fatigue, 4);
    const merged = T.wellnessData;
    assert.ok(!JSON.stringify(merged).includes('<img'), 'nada de HTML llega a wellnessData');
});

console.log('\nListener de /playerRpeReports y bandeja (app-sessions.js)');
test('claves y RPE manipulados no entran; la bandeja no contiene código ejecutable', () => {
    const { T, cbs } = loadTracker('app-sessions.js');
    T._registerPlayerRpeListener();
    cbs['playerRpeReports'](snap({
        uA: {
            '2026-10-04': {
                match: { rpe: 7, playerId: 'p1' },
                [BREAK]: { rpe: 5 },
                morning: { rpe: XSS },
            },
            [BREAK]: { morning: { rpe: 5 } },
        },
    }));
    const raw = T._playerRpeRaw;
    assert.strictEqual(raw.length, 1, 'solo el RPE legítimo');
    assert.strictEqual(raw[0]._path, 'playerRpeReports/uA/2026-10-04/match');
    const html = T._renderPlayerRpeInbox();
    assert.ok(html.includes('Ana'));
    assert.ok(!html.includes('alert('), 'sin alert(');
    assert.ok(!html.includes('<img'), 'sin <img');
    // todos los onclick de la bandeja llevan solo la ruta segura
    const onclicks = html.match(/on(click|input|keydown)="[^"]*"/g) || [];
    assert.ok(onclicks.length > 0);
    onclicks.forEach(o => assert.ok(!/[;]\s*alert|\)\s*;\s*\w+\(/.test(o.replace(/\{window[^}]*\}/g, '')), o));
});
test('un RPE legítimo como string "7" se normaliza a número 7', () => {
    const { T, cbs } = loadTracker('app-sessions.js');
    T._registerPlayerRpeListener();
    cbs['playerRpeReports'](snap({ uA: { '2026-10-04': { match: { rpe: '7' } } } }));
    assert.strictEqual(T._playerRpeRaw[0].rpe, 7);
});

// ---------- Храповик: nombres sin esc() ----------
console.log('\nХраповик (interpolaciones de name/displayName/email sin esc)');
// Bajar estos números a medida que se corrijan (Fase 2b). Subirlos = introducir XSS.
const BASELINE = { 'app-analytics.js': 3, 'app-comparisons.js': 1, 'app-players.js': 4, 'app-presession.js': 3, 'app-sessions.js': 3, 'app.js': 2, 'auth.js': 3, 'dashboard-renderer.js': 1, 'injury-management-2.js': 9, 'injury-management.js': 3, 'injury-prediction.js': 1, 'pdf-reports.js': 6, 'strength.js': 15, 'team-status.js': 2, 'weekplan-medical.js': 3, 'wellness.js': 3 };
const PAT = /\$\{\s*[A-Za-z_][\w.?\[\]']*\.(?:name|displayName|email)\s*\}/g;
test('ningún fichero tiene MÁS interpolaciones sin escapar que la línea base', () => {
    const over = [];
    for (const f of fs.readdirSync(ROOT).filter(n => n.endsWith('.js') && n !== 'sw.js' && !n.startsWith('firebase-config'))) {
        const n = (fs.readFileSync(path.join(ROOT, f), 'utf8').match(PAT) || []).length;
        if (n > (BASELINE[f] || 0)) over.push(`${f}: ${n} > ${BASELINE[f] || 0}`);
    }
    assert.deepStrictEqual(over, [], 'nuevas interpolaciones sin esc(): ' + over.join(', '));
});

(async () => {
    for (const t of pending) {
        try { await t.fn(); passed++; console.log('  ✅ ' + t.name); }
        catch (e) { failed++; console.log('  ❌ ' + t.name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

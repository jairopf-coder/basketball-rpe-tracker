// ============================================================
//  test/xss-lote2.test.js  (Fase 2b, lote 2)
//  Renderiza con nombres/dorsales/rivales maliciosos las pantallas de wellness,
//  dashboard, estado del equipo y PDF semanal, y comprueba que no se cuela código
//  y que los nombres legítimos (con ' " & ) se siguen viendo bien.
//  Uso:  node test/xss-lote2.test.js
// ============================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const secSrc = fs.readFileSync(path.join(ROOT, 'security.js'), 'utf8').split('// ── 2.')[0];
const EVIL = '<img src=x onerror=alert(1)>';
const QUOTE = `O'Brien "la Flecha" & Co`;

const dom = { widgets: { innerHTML: '' }, status: { innerHTML: '' }, dash: { innerHTML: '', children: [], querySelector: () => null }, written: [] };
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, Map,
    PlayerTokens: { avatar: () => '' },
    Store: { get: () => null, getActiveSeason: () => '2026-27' },
    Blob: function Blob() {}, File: function File() {}, setTimeout: () => 0, navigator: {},
    document: {
        createElement: () => ({ style: {}, setAttribute() {} }), head: { appendChild() {} },
        getElementById: id => ({ dbRightWidgets: dom.widgets, teamStatusView: dom.status, dashboardContent: dom.dash })[id] || null,
        documentElement: { classList: { contains: () => false } }, body: { classList: { contains: () => false } },
    },
    window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1, open: () => ({ document: { write: h => dom.written.push(h), close() {} }, print() {} }) },
    localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame: () => {}, AppAlert: { show() {} },
});
vm.runInContext(secSrc + '\n;globalThis.esc = esc;', ctx);       // esc() REAL de security.js
vm.runInContext(`function RPETracker() {}
function toLocalISODate(d){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}`, ctx);
['wellness.js', 'dashboard-renderer.js', 'dashboard-comparison.js', 'app-presession.js', 'team-status.js', 'injury-prediction.js']
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const today = vm.runInContext('toLocalISODate', ctx)(new Date());

function make() {
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = [{ id: 'p1', name: EVIL, number: EVIL }, { id: 'p2', name: QUOTE, number: '7' }];
    t.wellnessData = [{ id: 'w_p1', playerId: 'p1', date: today, sleep: 3, fatigue: 3, mood: 3, soreness: 3 }];
    t.sessions = []; t.injuries = []; t._playerRpeRaw = []; t.matches = [];
    t.calculateAcuteChronicRatio = () => ({ ratio: '1.00', confidence: 'high' });
    t.getRatioColor = () => '#2e7d32';
    t.getPlayerThresholds = () => ({ low: 0.8, opt: 1.3, high: 1.5 });
    t.showToast = () => {}; t.weekPlan = {}; t.loadWeekPlan = () => {}; t.getLocationName = () => '';
    return t;
}
const sinCodigo = (html, donde) => {
    assert.ok(!html.includes('<img'), donde + ': hay un <img sin escapar');
    assert.ok(!/onerror=[^&]*>/.test(html.replace(/&lt;img[^&]*&gt;/g, '')), donde + ': onerror activo');
};

let passed = 0, failed = 0;
const queue = [];
const test = (n, f) => queue.push({ n, f });

test('wellness: estado de hoy (_renderWTodayStatus) escapa nombre y dorsal', () => {
    const html = make()._renderWTodayStatus(vm.runInContext('new Set()', ctx), today);
    sinCodigo(html, 'estado de hoy');
    assert.ok(html.includes('&lt;img'), 'se ve como texto');
    assert.ok(html.includes('O&#39;Brien &quot;la Flecha&quot; &amp; Co'), 'el nombre legítimo se ve bien');
});
test('dashboard: tarjetas de ratio por jugadora (renderTeamRatios) escapan nombre, inicial y dorsal', () => {
    const html = make().renderTeamRatios();
    sinCodigo(html, 'ratios');
    assert.ok(html.includes('O&#39;Brien'), 'nombre legítimo visible');
    assert.ok(html.includes('#7'), 'dorsal normal visible');
});
test('estado del equipo (renderTeamStatus) escapa nombre e inicial', () => {
    const t = make();
    dom.status.innerHTML = '';
    t.renderTeamStatus();
    assert.ok(dom.status.innerHTML.length > 200, 'la pantalla se pintó');
    assert.ok(dom.status.innerHTML.includes('ts-card-avatar">&lt;</div>'), 'la inicial de la tarjeta se escapa');
    sinCodigo(dom.status.innerHTML, 'estado del equipo');
});
test('PDF semanal del equipo (generateWeeklyTeamPDF) escapa nombre, dorsal y lesión', () => {
    const t = make();
    t.injuries = [{ id: 'i1', playerId: 'p1', status: 'active', location: 'knee', severity: 'moderate', injuryDate: today }];
    dom.written.length = 0;
    t.generateWeeklyTeamPDF();
    const html = dom.written.join('');
    assert.ok(html.length > 100, 'se generó el informe');
    sinCodigo(html, 'PDF semanal');
});
test('dashboard: el rival del próximo partido se escapa (KPI "vs …")', () => {
    const t = make();
    t.matches = [{ id: 'm1', date: today, rival: EVIL, type: 'match' }];
    t.sessions = [{ id: 's1', playerId: 'p1', date: today, type: 'match', rival: EVIL, rpe: 5, duration: 60 }];
    t.getNextMatch = () => ({ rival: EVIL, date: today });
    Object.assign(t, {
        countUniqueSessions: ss => (ss || []).length, isWeekPlanSaved: () => true, getWeekPlanDays: () => [],
        _wpMondayKey: () => today, _dashSort: 'risk', _matchDayMode: false, _renderPlayerRpeInbox: () => '',
        _rpeDiscrepancies: () => [], readinessLabel: () => '', calculateReadiness: () => ({ score: 80 }),
        _wOverall: () => 3, _renderMatchDayView: () => '',
    });
    dom.dash.innerHTML = '';
    let err = null;
    try { t.renderDashboard(); } catch (e) { err = e; }
    assert.ok(!err, 'renderDashboard lanzó: ' + (err && err.stack.split('\n').slice(0,3).join(' | ')));
    assert.ok(dom.dash.innerHTML.includes('vs &lt;img'), 'el KPI del próximo partido se pintó con el rival escapado');
    sinCodigo(dom.dash.innerHTML, 'dashboard');
});

(async () => {
    for (const q of queue) {
        try { await q.f(); passed++; console.log('  ✅ ' + q.n); }
        catch (e) { failed++; console.log('  ❌ ' + q.n + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 4).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

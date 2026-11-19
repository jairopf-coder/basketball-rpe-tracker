// test/dash-kpi.test.js
// ============================================================
// Integración: renderDashboard() REAL pinta el KPI «alertas A:C» con los avisos dentro
// (número de peligro + chips + punto de «sin ver») y YA NO pinta la barra de avisos.
// El panel que se abre al pulsar el KPI sale de la misma cuenta que el KPI.
//
// Ejecutar con:  node test/dash-kpi.test.js
// ============================================================
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const secSrc = fs.readFileSync(path.join(ROOT, 'security.js'), 'utf8').split('// ── 2.')[0];

// DOM de mentira: el contenedor de Inicio y los elementos que se crean/consultan por id
const els = {};
const mkEl = id => ({ id, style: {}, attrs: {}, innerHTML: '', focused: 0, rect: { left: 400, right: 600, top: 120, bottom: 200 },
    setAttribute(k, v) { this.attrs[k] = v; }, focus() { this.focused++; }, getBoundingClientRect() { return this.rect; },
    remove() { delete els[this.id]; } });
const dash = Object.assign(mkEl('dashboardContent'), { children: [], querySelector: () => null });
els.dashboardContent = dash;
const store = {};
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, Promise, Map,
    PlayerTokens: { avatar: () => '' }, Store: { get: () => null, getActiveSeason: () => '2026-27' },
    Blob: function Blob() {}, File: function File() {}, setTimeout: () => 0, navigator: {},
    document: {
        createElement: () => mkEl(''), head: { appendChild() {} }, body: { appendChild(e) { els[e.id] = e; }, classList: { contains: () => false } },
        getElementById: id => (id === 'dashAlertsPop' ? (els.dashAlertsLayer ? (els.__pop = els.__pop || mkEl('dashAlertsPop')) : null) : (els[id] || null)),
        addEventListener() {}, documentElement: { classList: { contains: () => false } },
    },
    window: { innerWidth: 1280, innerHeight: 800, addEventListener() {}, matchMedia: () => ({ matches: false }), devicePixelRatio: 1,
        firebaseAuth: { currentUser: { uid: 'u1' } }, firebaseDB: null },
    localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
    requestAnimationFrame: () => {}, AppAlert: { show() {} },
});
vm.runInContext(secSrc + '\n;globalThis.esc = esc;', ctx);
vm.runInContext(`function RPETracker() {}
function toLocalISODate(d){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}`, ctx);
vm.runInContext(require('./active-players-helper')(), ctx);
require('./store-dates')(vm, ctx);
['wellness.js', 'dashboard-renderer.js', 'dashboard-comparison.js', 'dashboard-alerts.js', 'app-presession.js', 'team-status.js', 'injury-prediction.js']
    .forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
const today = vm.runInContext('toLocalISODate', ctx)(new Date());

// Ratios por jugadora: p1 peligro (>1.5), p2 precaución (>1.3), p3 y p4 bien
const RATIOS = { p1: '1.80', p2: '1.40', p3: '1.00', p4: '1.10' };
function make({ ratios = RATIOS, trend = true, rpe = true } = {}) {
    Object.keys(store).forEach(k => delete store[k]);       // cada test empieza sin «visto» guardado
    delete els.dashAlertsLayer; delete els.__pop;
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = [{ id: 'p1', name: 'Marta Ruiz', number: '4' }, { id: 'p2', name: 'Sofía', number: '5' },
                 { id: 'p3', name: 'Cris', number: '6' }, { id: 'p4', name: 'Noa', number: '7' }];
    t.wellnessData = []; t.sessions = []; t.injuries = []; t._playerRpeRaw = []; t.matches = [];
    t.calculateAcuteChronicRatio = id => ({ ratio: ratios[id], confidence: 'high' });
    t.getRatioColor = () => '#2e7d32';
    t.getPlayerThresholds = () => ({ low: 0.8, opt: 1.3, high: 1.5 });
    t.showToast = () => {}; t.weekPlan = {}; t.loadWeekPlan = () => {}; t.getLocationName = () => '';
    t.matches = []; t.getNextMatch = () => null;
    Object.assign(t, {
        countUniqueSessions: ss => (ss || []).length, isWeekPlanSaved: () => true, getWeekPlanDays: () => [],
        _wpMondayKey: () => today, _dashSort: 'risk', _matchDayMode: false, _renderPlayerRpeInbox: () => '',
        readinessLabel: () => '', calculateReadiness: () => ({ score: 80 }), _wOverall: () => 3, _renderMatchDayView: () => '',
        _wTrendAlerts: () => (trend ? [{ type: 'trend', kind: 'sleep', playerId: 'p3', name: 'Cris', message: 'Sueño deficiente 3+ días consecutivos (≤2/5)' }] : []),
        _rpeDiscrepancies: rpe ? [{ sessionId: 's1', playerName: 'Noa', staffRpe: 6, playerRpe: 8, date: today }] : [],
    });
    t.saveSeen = null;
    return t;
}
const paint = t => { dash.innerHTML = ''; t.renderDashboard(); return dash.innerHTML; };
const kpiTile = html => (/<div class="db-kpi db-kpi--alerts[\s\S]*?<span class="db-kpi-lbl">alertas A:C<\/span>[\s\S]*?<\/div>/.exec(html) || [''])[0];

let passed = 0, failed = 0;
const queue = [];
const test = (n, f) => queue.push({ n, f });

test('Inicio ya NO pinta la barra de avisos (ni su contenedor, ni la flecha, ni «is-open»)', () => {
    const html = paint(make());
    ['db-alerts-bar', 'db-alerts-toggle', 'db-alerts-panel', 'is-open', 'id="dashAlerts"', 'class="db-alerts"'].forEach(x =>
        assert.ok(!html.includes(x), 'no debe quedar ' + x));
});

test('el KPI es un botón accesible con id propio, y el número grande es el de jugadoras en PELIGRO', () => {
    const t = make();
    const html = paint(t);
    assert.strictEqual((html.match(/id="dashAlertsKpi"/g) || []).length, 1);
    const tile = kpiTile(html);
    assert.ok(/class="db-kpi db-kpi--alerts db-kpi--danger db-kpi--unseen" id="dashAlertsKpi" role="button" tabindex="0"/.test(tile), tile);
    assert.ok(tile.includes('onclick="window.rpeTracker?.toggleDashAlerts()"'));
    assert.ok(tile.includes('<span class="db-kpi-val">1</span>'), 'p1 es la única en peligro');
    assert.strictEqual(t._acDangerCount(), 1, 'misma cuenta que la insignia y el icono');
    assert.ok(!html.includes("switchView('analytics')\" title=\"Ver analítica\""), 'el clic ya no lleva a Analítica');
});

test('debajo del número salen los chips de lo demás: Prec. 1, Well. 1, RPE 1 (y ninguno de peligro)', () => {
    const tile = kpiTile(paint(make()));
    assert.ok(/Prec\. <\/span>1/.test(tile) && /Well\. <\/span>1/.test(tile) && /RPE <\/span>1/.test(tile), tile);
    assert.ok(!/Peligro/.test(tile));
    assert.ok(tile.includes('aria-label="1 alerta A:C, 4 avisos hoy. Abrir los avisos"'), tile);
});

test('sin ningún aviso: KPI verde con 0, sin chips ni punto, y el panel dirá «Sin avisos hoy»', () => {
    const t = make({ ratios: { p1: '1.00', p2: '1.00', p3: '1.00', p4: '1.00' }, trend: false, rpe: false });
    const tile = kpiTile(paint(t));
    assert.ok(tile.includes('db-kpi--ok') && !tile.includes('db-kpi--unseen') && tile.includes('<span class="db-kpi-val">0</span>'), tile);
    assert.ok(!tile.includes('db-kpi-chips') && !tile.includes('vistos'));
    assert.ok(tile.includes('sin avisos hoy'));
    t.openDashAlerts();
    assert.ok(els.dashAlertsLayer.innerHTML.includes('Sin avisos hoy ✓'));
    t.closeDashAlerts();
});

test('al marcar «visto» y repintar: el punto desaparece y los chips pasan a «✓ vistos hoy»; el número no cambia', () => {
    const t = make();
    paint(t);
    t.renderDashboard = function() {};            // markDashAlertsSeen repinta: lo hacemos nosotros abajo
    t.markDashAlertsSeen();
    delete t.renderDashboard;
    const tile = kpiTile(paint(t));
    assert.ok(!tile.includes('db-kpi--unseen') && tile.includes('✓ vistos hoy') && !tile.includes('db-kpi-chips'), tile);
    assert.ok(tile.includes('<span class="db-kpi-val">1</span>') && tile.includes('(vistos)'));
});

test('el panel que se abre sale de los mismos datos que el KPI (nombres, tipos y botones)', () => {
    const t = make();
    paint(t);
    t.openDashAlerts();
    const p = els.dashAlertsLayer.innerHTML;
    ['4 avisos', 'Marta', 'Sofía', 'Cris', 'Sueño deficiente', 'Noa', 'tú: 6, ella: 8', 'Revisar →', 'Marcar como visto por hoy', 'Ver analítica →'].forEach(x =>
        assert.ok(p.includes(x), 'falta ' + x));
    assert.strictEqual(t._dashAlertsOpen, true);
    t.closeDashAlerts();
});

test('repintar Inicio no deja el estado de «abierto» a medias: el KPI refleja aria-expanded', () => {
    const t = make();
    t.openDashAlerts();
    assert.ok(kpiTile(paint(t)).includes('aria-expanded="true"'));
    t.closeDashAlerts();
    assert.ok(kpiTile(paint(t)).includes('aria-expanded="false"'));
});

test('el recordatorio de planificación sigue siendo un bloque aparte (no es un aviso ni forma parte del KPI)', () => {
    const html = paint(make());
    assert.ok(!kpiTile(html).includes('db-alerts-plan'));
    const t = make(); t.isWeekPlanSaved = () => false;
    const sunday = vm.runInContext('new Date(2026, 10, 8, 10, 0)', ctx);   // domingo
    assert.strictEqual(sunday.getDay(), 0);
    const src = fs.readFileSync(path.join(ROOT, 'dashboard-alerts.js'), 'utf8');
    assert.ok(src.includes('db-alerts-plan') && src.includes('getDay() !== 0'));
});

(async () => {
    for (const q of queue) {
        try { await q.f(); passed++; console.log('  ✅ ' + q.n); }
        catch (e) { failed++; console.log('  ❌ ' + q.n + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

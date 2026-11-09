// test/custom-report.test.js
// «Informe personalizado» de carga (custom-report.js), fase 1:
//  · bloques de fechas (semanas / meses, también con el cambio de hora) · atajos de periodo
//  · sumas por bloque, entrenamiento frente a partido, el gimnasio NUNCA cuenta
//  · avisos de minutos no individualizados · validación
//  · el PDF: idioma, secciones, escape de textos, sin datos de salud
//  · el diálogo y el flujo de generación (la ventana se abre antes de cargar el histórico)
// Ejecutar con:  node test/custom-report.test.js
'use strict';
process.env.TZ = 'Europe/Madrid';          // el cambio de hora (25-oct-2026) no debe saltarse ni repetir días
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
const ROOT = path.join(__dirname, '..');
const same = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);

// ── Entorno: DOM mínimo para el diálogo y la ventana de impresión ───────────────────────────────────────
function makeEnv({ popupBlocked = false } = {}) {
    const els = {};                                   // elementos por id
    const log = [];                                   // orden de las operaciones
    const toasts = [], alerts = [];
    const printWindow = { html: '', document: { write(h) { printWindow.html += h; log.push('write'); }, open() { printWindow.html = ''; log.push('docopen'); }, close() { log.push('docclose'); } }, print() { log.push('print'); } };
    const document = {
        getElementById: id => els[id] || null,
        querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({ classList: { add() {}, remove() {} }, innerHTML: '' }),
        body: { appendChild(el) { els[el.id] = el; } },
        addEventListener() {}, head: { appendChild() {} },
    };
    const store = {};
    const ctx = vm.createContext({
        console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, isFinite, Promise, Map, setTimeout: fn => fn(),
        document, alert: m => alerts.push(m),
        localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
        window: { open: () => { log.push('open'); return popupBlocked ? null : printWindow; } },
        Store: { getActiveSeason: () => '2026-27' },
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'security.js'), 'utf8') + '\n;globalThis.esc = esc;', ctx);
    vm.runInContext(`function RPETracker() {}
        function toLocalISODate(d){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}`, ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'custom-report.js'), 'utf8'), ctx, { filename: 'custom-report.js' });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'dashboard-alerts.js'), 'utf8'), ctx, { filename: 'dashboard-alerts.js' });   // _acLevel: la regla única de nivel A:C
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = [{ id: 'p1', name: 'Hennie', lastName: 'Van Test' }, { id: 'p2', name: 'Ana', lastName: '' }, { id: 'p3', name: 'Bea', lastName: '' }];
    t.sessions = [];
    t.playerFullName = p => [p.name, p.lastName].filter(Boolean).join(' ');
    t.playerDisplayName = p => p.name;
    t.buildLoadingPlaceholderHTML = () => '<html>loading</html>';
    t.showToast = (m, type) => toasts.push([m, type || 'ok']);
    t.ensureFullSessionHistory = async () => { log.push('history'); };
    return { t, ctx, els, log, toasts, alerts, printWindow, store };
}
const fn = (ctx, name) => vm.runInContext(name, ctx);
const S = (date, type, rpe, duration, playerId = 'p1', extra = {}) => Object.assign({ id: `${playerId}${date}${type}`, playerId, date, type, rpe, duration, load: rpe * duration }, extra);

console.log('\nFechas y bloques');
test('semanas: 28 días desde el 12-oct dan 4 bloques exactos aunque haya cambio de hora (25-oct)', () => {
    const { ctx } = makeEnv();
    const b = fn(ctx, '_crBuildBlocks')('2026-10-12', '2026-11-08', 'weeks');
    same(b.map(x => [x.from, x.to]), [['2026-10-12', '2026-10-18'], ['2026-10-19', '2026-10-25'], ['2026-10-26', '2026-11-01'], ['2026-11-02', '2026-11-08']]);
});
test('semanas: el último bloque es más corto y llega exactamente a la fecha final', () => {
    const { ctx } = makeEnv();
    same(fn(ctx, '_crBuildBlocks')('2026-11-01', '2026-11-10', 'weeks').map(x => [x.from, x.to]), [['2026-11-01', '2026-11-07'], ['2026-11-08', '2026-11-10']]);
    same(fn(ctx, '_crBuildBlocks')('2026-11-06', '2026-11-06', 'weeks').map(x => [x.from, x.to]), [['2026-11-06', '2026-11-06']]);
});
test('meses naturales: el primero y el último parciales, también al cruzar de año', () => {
    const { ctx } = makeEnv();
    same(fn(ctx, '_crBuildBlocks')('2026-10-10', '2026-11-06', 'months').map(x => [x.from, x.to]), [['2026-10-10', '2026-10-31'], ['2026-11-01', '2026-11-06']]);
    same(fn(ctx, '_crBuildBlocks')('2026-12-20', '2027-02-03', 'months').map(x => [x.from, x.to]), [['2026-12-20', '2026-12-31'], ['2027-01-01', '2027-01-31'], ['2027-02-01', '2027-02-03']]);
});
test('los bloques cubren todos los días sin huecos ni solapes', () => {
    const { ctx } = makeEnv();
    ['weeks', 'months'].forEach(g => {
        const b = fn(ctx, '_crBuildBlocks')('2026-03-01', '2026-11-30', g);
        for (let i = 1; i < b.length; i++) assert.strictEqual(fn(ctx, '_crAddDays')(b[i - 1].to, 1), b[i].from);
        assert.strictEqual(b[0].from, '2026-03-01'); assert.strictEqual(b[b.length - 1].to, '2026-11-30');
    });
});
test('atajos de periodo: 3 semanas = 21 días y 4 semanas = 28 días contando el día final; un mes hacia atrás', () => {
    const { ctx } = makeEnv();
    const r = fn(ctx, '_crPeriodRange');
    same(r('3w', '2026-11-06'), { from: '2026-10-17', to: '2026-11-06' });
    same(r('4w', '2026-11-06'), { from: '2026-10-10', to: '2026-11-06' });
    same(r('month', '2026-11-06'), { from: '2026-10-07', to: '2026-11-06' });
    same(r('season', '2026-11-06', '2026-09-01'), { from: '2026-09-01', to: '2026-11-06' });
    assert.strictEqual(r('custom', '2026-11-06'), null);
    assert.strictEqual(fn(ctx, '_crDiffDays')('2026-10-10', '2026-11-06') + 1, 28);
});

console.log('\nDatos: sumas, tipos y filtros');
test('entrenamiento = training + tiro; partido aparte; el gimnasio y otros tipos NO cuentan', () => {
    const { t } = makeEnv();
    t.sessions = [S('2026-10-12', 'training', 6, 90), S('2026-10-13', 'shooting', 4, 30), S('2026-10-14', 'match', 8, 32),
                  S('2026-10-15', 'gym', 9, 60), S('2026-10-16', 'otro', 9, 60)];
    const d = t.buildCustomReportData('p1', { from: '2026-10-12', to: '2026-11-08', group: 'weeks' });
    assert.strictEqual(d.totals.training.sessions, 2); assert.strictEqual(d.totals.game.sessions, 1);
    assert.strictEqual(d.totals.training.minutes, 120); assert.strictEqual(d.totals.game.minutes, 32);
    assert.strictEqual(d.totals.training.load, 6 * 90 + 4 * 30); assert.strictEqual(d.totals.game.load, 8 * 32);
    assert.strictEqual(d.totals.all.sessions, 3); assert.strictEqual(d.sessions.length, 3);
    assert.ok(!d.sessions.some(s => s.type === 'gym'));
});
test('solo cuenta la jugadora elegida y las fechas del periodo, con los dos extremos incluidos', () => {
    const { t } = makeEnv();
    t.sessions = [S('2026-10-09', 'training', 5, 60), S('2026-10-10', 'training', 5, 60), S('2026-11-06', 'match', 7, 30),
                  S('2026-11-07', 'training', 5, 60), S('2026-10-20', 'training', 5, 60, 'p2')];
    const d = t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-11-06', group: 'weeks' });
    same(d.sessions.map(s => s.date), ['2026-10-10', '2026-11-06']);
});
test('cada sesión cae en su bloque: el día 7 en el primero y el día 8 en el segundo; las semanas vacías salen a cero', () => {
    const { t } = makeEnv();
    t.sessions = [S('2026-10-16', 'training', 5, 60), S('2026-10-17', 'training', 6, 60), S('2026-11-08', 'match', 8, 20)];
    const d = t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-11-06', group: 'weeks' });
    same(d.blocks.map(b => b.training.sessions), [1, 1, 0, 0]);
    assert.strictEqual(d.blocks[2].training.load, 0);
    assert.strictEqual(d.totals.game.sessions, 0, 'el partido del 8-nov queda fuera del periodo');
});
test('la carga usa la guardada; sin ella, RPE × minutos; sin minutos se asumen 60 (como el resto de la app)', () => {
    const { t } = makeEnv();
    t.sessions = [S('2026-10-12', 'training', 5, 60, 'p1', { load: 777 }),
                  { id: 'a', playerId: 'p1', date: '2026-10-13', type: 'training', rpe: 4, duration: 50 },
                  { id: 'b', playerId: 'p1', date: '2026-10-14', type: 'training', rpe: 3 }];
    const d = t.buildCustomReportData('p1', { from: '2026-10-12', to: '2026-10-18', group: 'weeks' });
    same(d.sessions.map(s => s.load), [777, 200, 180]);
    same(d.sessions.map(s => s.minutes), [60, 50, 60]);
});
test('las sesiones sin RPE válido se ignoran (no se cuentan como cero)', () => {
    const { t } = makeEnv();
    t.sessions = [S('2026-10-12', 'training', null, 60), S('2026-10-13', 'training', undefined, 60), S('2026-10-14', 'training', '', 60), S('2026-10-15', 'training', 'x', 60), S('2026-10-16', 'training', 6, 60)];
    assert.strictEqual(t.buildCustomReportData('p1', { from: '2026-10-12', to: '2026-10-18', group: 'weeks' }).totals.all.sessions, 1);
});
test('RPE medio = media de los RPE de las sesiones; media por 7 días = total × 7 / días del periodo', () => {
    const { t } = makeEnv();
    t.sessions = [S('2026-10-12', 'training', 4, 60), S('2026-10-13', 'match', 8, 30)];
    const d = t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-11-06', group: 'weeks' });    // 28 días
    assert.strictEqual(d.totals.all.rpeSum / d.totals.all.sessions, 6);
    assert.strictEqual(d.avgPer7.load, (4 * 60 + 8 * 30) / 4);
    const d10 = t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-10-19', group: 'weeks' });  // 10 días
    assert.strictEqual(d10.avgPer7.load, (4 * 60 + 8 * 30) * 7 / 10);
});

console.log('\nAvisos de minutos no individualizados');
test('avisa si todas las jugadoras tienen los mismos minutos en un partido (3 o más)', () => {
    const { t } = makeEnv();
    t.sessions = ['p1', 'p2', 'p3'].map(p => S('2026-10-24', 'match', 7, 40, p));
    same(t.buildCustomReportWarnings('p1', '2026-10-10', '2026-11-06'), [{ date: '2026-10-24', minutes: 40, players: 3 }]);
});
test('no avisa si los minutos son individuales, si hay menos de 3 jugadoras o si ella no jugó ese partido', () => {
    const { t } = makeEnv();
    t.sessions = [S('2026-10-24', 'match', 7, 40, 'p1'), S('2026-10-24', 'match', 7, 22, 'p2'), S('2026-10-24', 'match', 7, 40, 'p3'),
                  S('2026-10-31', 'match', 7, 40, 'p2'), S('2026-10-31', 'match', 7, 40, 'p1'),
                  S('2026-11-03', 'match', 7, 40, 'p2'), S('2026-11-03', 'match', 7, 40, 'p3'), S('2026-11-03', 'match', 7, 40, 'p1', { playerId: 'p9' })];
    same(t.buildCustomReportWarnings('p1', '2026-10-10', '2026-11-06'), []);
});
test('los entrenamientos con la misma duración para todas no generan aviso', () => {
    const { t } = makeEnv();
    t.sessions = ['p1', 'p2', 'p3'].map(p => S('2026-10-24', 'training', 5, 90, p));
    same(t.buildCustomReportWarnings('p1', '2026-10-10', '2026-11-06'), []);
});

console.log('\nValidación');
test('rechaza fechas vacías o mal formadas, desde > hasta, rangos de más de ~2 años y sin secciones', () => {
    const { ctx } = makeEnv();
    const v = fn(ctx, '_crValidate'); const ok = { from: '2026-10-10', to: '2026-11-06', sections: { table: true } };
    assert.strictEqual(v(ok), '');
    assert.ok(v({ ...ok, from: '' })); assert.ok(v({ ...ok, to: '6/11/2026' })); assert.ok(v(undefined));
    assert.ok(v({ ...ok, from: '2026-11-07' }));
    assert.ok(v({ ...ok, from: '2024-01-01' }));
    assert.ok(v({ ...ok, sections: {} }));
    assert.strictEqual(v({ ...ok, from: '2026-11-06' }), '', 'un solo día es válido');
});

console.log('\nEl PDF');
const DATA = t => {
    t.sessions = [S('2026-10-12', 'training', 6, 90), S('2026-10-14', 'shooting', 4, 30), S('2026-10-24', 'match', 8, 32),
                  S('2026-10-20', 'gym', 9, 60), S('2026-11-02', 'training', 5, 1200)];
    return t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-11-06', group: 'weeks' });
};
const OPTS = (o = {}) => Object.assign({ lang: 'en', sections: { table: true, chart: true, sessions: false }, note: '' }, o);
test('en inglés: título, cabeceras, totales y media por 7 días; con separador de miles', () => {
    const { t } = makeEnv(); const d = DATA(t);
    const html = t.buildCustomReportHTML(t.players[0], d, OPTS());
    ['Workload overview', 'Hennie Van Test', '10 Oct 2026 – 6 Nov 2026', 'Week 1', 'Week 4', 'Training', 'Games', 'Load (AU)', 'Avg RPE', 'Average per 7 days', 'Load (AU, arbitrary units) = session RPE × minutes'].forEach(x => assert.ok(html.includes(x), 'falta: ' + x));
    assert.ok(html.includes('6,000'), 'carga 5×1200 con separador de miles (inglés)');
    assert.ok(html.includes('lang="en"'));
});
test('en español: textos, formato de fechas y decimales con coma', () => {
    const { t } = makeEnv(); const d = DATA(t);
    const html = t.buildCustomReportHTML(t.players[0], d, OPTS({ lang: 'es' }));
    ['Resumen de carga', '10 oct 2026 – 6 nov 2026', 'Semana 1', 'Entrenamiento', 'Partidos', 'Carga (UA)', 'RPE medio', 'Media por 7 días'].forEach(x => assert.ok(html.includes(x), 'falta: ' + x));
    assert.ok(html.includes('6.000'), 'separador de miles en español');
    assert.ok(/>\d,\d</.test(html), 'RPE medio con coma decimal');
    assert.ok(html.includes('lang="es"'));
});
test('las secciones se incluyen solo si se marcan (la lista de sesiones empieza en página aparte)', () => {
    const { t } = makeEnv(); const d = DATA(t);
    const base = t.buildCustomReportHTML(t.players[0], d, OPTS());
    assert.ok(base.includes('<table>') && base.includes('Load by period') && !base.includes('Session list'));
    const all = t.buildCustomReportHTML(t.players[0], d, OPTS({ sections: { table: true, chart: true, sessions: true } }));
    assert.ok(all.includes('Session list') && all.includes('class="section sessions-page"'));
    const only = t.buildCustomReportHTML(t.players[0], d, OPTS({ sections: { table: false, chart: false, sessions: true } }));
    assert.ok(only.includes('Session list') && !only.includes('Load by period') && !only.includes('<table>'));
    assert.ok(!only.includes('class="section sessions-page"'), 'sin tabla ni gráfico antes no se fuerza un salto de página');
    assert.ok(all.indexOf('footnote') > 0 && all.indexOf('class="footnote"') < all.indexOf('Session list'), 'las definiciones van en la primera página, antes de la lista');
});
test('por meses: filas «Oct 2026» / «Nov 2026»', () => {
    const { t } = makeEnv(); t.sessions = [S('2026-10-12', 'training', 6, 90)];
    const d = t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-11-06', group: 'months' });
    const html = t.buildCustomReportHTML(t.players[0], d, OPTS());
    assert.ok(html.includes('Oct 2026') && html.includes('Nov 2026') && html.includes('>Month<'));
});
test('el PDF no contiene gimnasio ni datos de salud, y la lista de sesiones no trae el entrenamiento de gimnasio', () => {
    const { t } = makeEnv(); const d = DATA(t);
    const html = t.buildCustomReportHTML(t.players[0], d, OPTS({ sections: { table: true, chart: true, sessions: true } }));
    assert.ok(!/gym|gimnasio|strength|fuerza|wellness|bienestar|lesi|injur|anamnesis/i.test(html), 'sin gimnasio ni salud');
    assert.strictEqual(d.sessions.length, 4);
});
test('sin sesiones en el periodo se explica en vez de pintar tablas vacías', () => {
    const { t } = makeEnv(); t.sessions = [];
    const html = t.buildCustomReportHTML(t.players[0], t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-11-06', group: 'weeks' }), OPTS());
    assert.ok(html.includes('No sessions recorded in this period.') && !html.includes('<table>'));
});
test('la nota de contexto sale arriba y se conserva escrita tal cual (escapada)', () => {
    const { t } = makeEnv(); const d = DATA(t);
    const html = t.buildCustomReportHTML(t.players[0], d, OPTS({ note: 'Back from the national team camp.\n<b>1–9 Nov</b>' }));
    assert.ok(html.includes('Context') && html.includes('Back from the national team camp.'));
    assert.ok(!html.includes('<b>1–9 Nov</b>') && html.includes('&lt;b&gt;'));
    assert.ok(html.indexOf('Context') < html.indexOf('<table>'));
});
test('nombres con HTML o comillas no producen código ejecutable en el PDF ni en el diálogo', () => {
    const { t, els } = makeEnv(); const d = DATA(t);
    t.players[0].name = '<img src=x onerror=alert(1)>'; t.players[0].lastName = '"><script>alert(2)</script>';
    const html = t.buildCustomReportHTML(t.players[0], d, OPTS({ note: '<script>alert(3)</script>' }));
    assert.ok(!html.includes('<img src=x') && !html.includes('<script>alert('));
    t.showCustomReportDialog('p1');
    assert.ok(!els.customReportModal.innerHTML.includes('<img src=x'));
});
test('el gráfico dibuja con colores de fondo que sí se imprimen y la barra más alta llena el 100%', () => {
    const { t } = makeEnv(); const d = DATA(t);
    const html = t.buildCustomReportHTML(t.players[0], d, OPTS());
    assert.ok(html.includes('print-color-adjust: exact'));
    const sums = [...html.matchAll(/class="seg train" style="width:([\d.]+)%"><\/span><span class="seg game" style="width:([\d.]+)%"/g)].map(m => parseFloat(m[1]) + parseFloat(m[2]));
    assert.strictEqual(sums.length, 4, 'una barra por semana');
    assert.ok(Math.abs(Math.max(...sums) - 100) < 0.2, 'la semana con más carga ocupa todo el ancho');
    assert.ok(sums.every(x => x <= 100.2));
});

console.log('\nDiálogo y generación');
test('el diálogo se construye con todos los controles y la jugadora preseleccionada', () => {
    const { t, els } = makeEnv();
    t.showCustomReportDialog('p2');
    const h = els.customReportModal.innerHTML;
    ['crPlayer', 'crFrom', 'crTo', 'crGroup', 'crLang', 'crSecTable', 'crSecChart', 'crSecSessions', 'crNote', 'crInfo', 'crWarnings', 'Selección', 'Nuevo equipo', 'Para la jugadora', 'Últimas 3 semanas', 'Toda la temporada'].forEach(x => assert.ok(h.includes(x), 'falta: ' + x));
    assert.ok(/<option value="p2" selected>/.test(h));
    assert.ok(!/gimnasio\s*<\/label>/i.test(h) && /No incluye gimnasio/.test(h));
});
test('los atajos de «para quién es» fijan idioma y secciones (las de salud solo en «Para la jugadora» y «Cuerpo técnico»)', () => {
    const { ctx } = makeEnv();
    const P = fn(ctx, 'CR_PRESETS');
    const on = k => Object.entries(P[k].sections).filter(([, v]) => v).map(([x]) => x);
    assert.strictEqual(P.selection.lang, 'en'); assert.deepStrictEqual(on('selection'), ['table', 'chart']);
    assert.deepStrictEqual(on('newteam'), ['table', 'chart', 'sessions']); assert.strictEqual(P.newteam.lang, 'en');
    assert.deepStrictEqual(on('player'), ['table', 'chart', 'ac', 'wellness']); assert.strictEqual(P.player.lang, 'es');
    assert.deepStrictEqual(on('staff'), ['table', 'chart', 'sessions', 'ac', 'gps', 'wellness', 'injuries']);
    ['selection', 'newteam'].forEach(k => assert.ok(!P[k].sections.wellness && !P[k].sections.injuries, k + ' (externo) sin datos de salud'));
});
test('el inicio de «toda la temporada» es la primera sesión de la jugadora en la temporada activa (o el 1 de septiembre)', () => {
    const { t } = makeEnv();
    t.sessions = [S('2026-09-14', 'training', 5, 60, 'p1', { season: '2026-27' }), S('2026-05-02', 'training', 5, 60, 'p1', { season: '2025-26' }), S('2026-09-01', 'training', 5, 60, 'p2', { season: '2026-27' })];
    assert.strictEqual(t._crSeasonStart('p1'), '2026-09-14');
    t.sessions = [];
    assert.strictEqual(t._crSeasonStart('p1'), '2026-09-01');
});
function setForm(els, v) {
    Object.entries({ crPlayer: { value: v.player || 'p1' }, crFrom: { value: v.from || '2026-10-10' }, crTo: { value: v.to || '2026-11-06' }, crGroup: { value: v.group || 'weeks' }, crLang: { value: v.lang || 'en' },
        crSecTable: { checked: v.table !== false }, crSecChart: { checked: v.chart !== false }, crSecSessions: { checked: !!v.sessions },
        crSecAc: { checked: !!v.ac }, crSecGps: { checked: !!v.gps }, crSecWellness: { checked: !!v.wellness }, crSecInjuries: { checked: !!v.injuries }, crNote: { value: v.note || '' } }).forEach(([k, o]) => { els[k] = o; });
}
test('generar: la ventana se abre ANTES de cargar el histórico (iOS bloquea window.open tras un await) y luego escribe el PDF e imprime', async () => {
    const { t, els, log, toasts, printWindow } = makeEnv();
    DATA(t); setForm(els, {});
    const pending = t.generateCustomReport();
    assert.deepStrictEqual(log, ['open', 'write', 'history'], 'la ventana se abre y se rellena de forma SÍNCRONA, antes de esperar nada');
    await pending;
    assert.ok(log.includes('docopen') && log.includes('docclose') && log.includes('print'));
    assert.ok(printWindow.html.includes('Workload overview') && printWindow.html.includes('Hennie Van Test'));
    assert.ok(toasts.some(x => /generado/.test(x[0])));
});
test('generar con datos inválidos avisa y NO abre ninguna ventana', async () => {
    const { t, els, log, toasts } = makeEnv();
    setForm(els, { from: '2026-11-07', to: '2026-11-06' });
    await t.generateCustomReport();
    assert.ok(!log.includes('open')); assert.strictEqual(toasts[0][1], 'error');
    setForm(els, { table: false, chart: false, sessions: false });
    await t.generateCustomReport();
    assert.ok(!log.includes('open')); assert.strictEqual(toasts.length, 2);
});
test('si el navegador bloquea la ventana se avisa y no se sigue', async () => {
    const { t, els, log, alerts } = makeEnv({ popupBlocked: true });
    setForm(els, {});
    await t.generateCustomReport();
    assert.strictEqual(alerts.length, 1); assert.ok(!log.includes('history'));
});

console.log('\nFase 2: ratio A:C al final de cada periodo');
const BLOCKS = [{ index: 1, from: '2026-10-10', to: '2026-10-16' }, { index: 2, from: '2026-10-17', to: '2026-10-23' }, { index: 3, from: '2026-10-24', to: '2026-10-30' }, { index: 4, from: '2026-10-31', to: '2026-11-06' }];
const TH = { low: 0.8, opt: 1.3, high: 1.5 };
function acTracker(table) {
    const e = makeEnv(); const calls = [];
    e.t.getPlayerThresholds = () => TH;
    e.t.calculateAcuteChronicRatio = (id, min, asOf) => { const iso = fn(e.ctx, 'toLocalISODate')(asOf); calls.push([id, min, iso]); return table[iso] || { ratio: 'N/A', confidence: 'low' }; };
    return { ...e, calls };
}
test('pide a la app el A:C «tal como estaba» el último día de cada bloque, con 7 sesiones mínimas', () => {
    const { t, calls } = acTracker({});
    t._crBuildAc('p1', BLOCKS);
    assert.deepStrictEqual(calls, BLOCKS.map(b => ['p1', 7, b.to]));
});
test('el nivel sale de la regla única de la app con los umbrales de la jugadora; sin ratio fiable → «sin datos»', () => {
    const { t } = acTracker({ '2026-10-16': { ratio: '1.62', confidence: 'high' }, '2026-10-23': { ratio: '1.40', confidence: 'high' }, '2026-10-30': { ratio: '1.10', confidence: 'high' }, '2026-11-06': { ratio: '2.40', confidence: 'low' } });
    const r = t._crBuildAc('p1', BLOCKS);
    assert.deepStrictEqual(r.rows.map(x => x.level), ['danger', 'warn', 'ok', 'na']);
    assert.deepStrictEqual(r.rows.map(x => x.ratio), [1.62, 1.4, 1.1, null]);
    same(r.thresholds, TH);
});
test('un periodo que acaba en el futuro se calcula a fecha de hoy', () => {
    const { t, calls } = acTracker({});
    t._crBuildAc('p1', [{ index: 1, from: '2026-10-10', to: '2099-01-01' }]);
    assert.strictEqual(calls[0][2], fn(makeEnv().ctx, 'toLocalISODate')(new Date()));
});

console.log('\nFase 2: bienestar');
test('media por bloque solo de esa jugadora, con registros completos; sin registros → 0 registros', () => {
    const { t } = makeEnv();
    const W = (playerId, date, a, b, c, d) => ({ id: playerId + date, playerId, date, sleep: a, fatigue: b, mood: c, soreness: d });
    t.wellnessData = [W('p1', '2026-10-11', 4, 2, 4, 2), W('p1', '2026-10-12', 2, 4, 2, 4), W('p2', '2026-10-12', 1, 1, 1, 1),
                      W('p1', '2026-10-13', 5, null, 5, 5), W('p1', '2026-10-24', 5, 5, 5, 5), W('p1', '2026-12-01', 1, 1, 1, 1)];
    const w = t._crBuildWellness('p1', BLOCKS);
    assert.strictEqual(w[0].entries, 2); assert.strictEqual(w[0].sleep, 3); assert.strictEqual(w[0].energy, 3); assert.strictEqual(w[0].overall, 3);
    assert.strictEqual(w[1].entries, 0); assert.strictEqual(w[2].overall, 5); assert.strictEqual(w[3].entries, 0);
});

console.log('\nFase 2: disponibilidad y lesiones');
function availEnv() {
    const e = makeEnv();
    e.t.isPlayerActiveOn = (p, day) => day >= '2026-10-14';                       // se incorpora a la plantilla el 14-oct
    e.t.getPlayerParticipation = (id, day) => (day >= '2026-10-20' && day <= '2026-10-22' ? 'out' : day === '2026-10-23' ? 'partial' : 'full');
    e.t.injuries = [
        { id: 'i1', playerId: 'p1', location: 'ankle', type: 'joint', severity: 'moderate', startDate: '2026-10-20', endDate: '2026-11-02', status: 'recovered', description: 'SECRETO-descripción', mechanism: 'SECRETO-mecanismo', initialTreatment: 'SECRETO-tratamiento', notes: 'SECRETO-notas', painLevel: 8 },
        { id: 'i2', playerId: 'p1', location: 'knee', type: 'muscle', severity: 'minor', startDate: '2026-11-04', endDate: null, status: 'active', notes: 'SECRETO-notas2' },
        { id: 'i3', playerId: 'p1', location: 'back', type: 'muscle', severity: 'minor', startDate: '2026-08-01', endDate: '2026-08-10', status: 'recovered' },
        { id: 'i4', playerId: 'p1', location: 'wrist', type: 'bone', severity: 'severe', startDate: '2026-12-15', endDate: null, status: 'active' },
        { id: 'i5', playerId: 'p2', location: 'ankle', type: 'joint', severity: 'minor', startDate: '2026-10-20', endDate: null, status: 'active' },
        { id: 'i6', playerId: 'p1', location: 'groin', type: 'muscle', severity: 'minor', startDate: '2026-09-20', endDate: null, status: 'active' }];
    return e;
}
test('cuenta los días por estado SOLO mientras estaba en la plantilla (no cuenta como «no disponible» lo anterior a su fichaje)', () => {
    const { t } = availEnv();
    const a = t._crBuildAvailability('p1', '2026-10-10', '2026-11-06', BLOCKS);
    assert.deepStrictEqual(a.rows.map(r => r.days), [3, 7, 7, 7], 'del 14 al 16 de oct: 3 días');
    same(a.rows[1], { days: 7, full: 3, partial: 1, out: 3 });
    assert.ok(a.rows.every(r => r.days === r.full + r.partial + r.out));
});
test('lesiones: las que tocan el periodo (también las en curso), de esa jugadora y ordenadas; sin las anteriores ni las posteriores', () => {
    const { t } = availEnv();
    const inj = t._crBuildAvailability('p1', '2026-10-10', '2026-11-06', BLOCKS).injuries;
    assert.deepStrictEqual(inj.map(x => x.location), ['groin', 'ankle', 'knee']);   // groin en curso desde sept, ankle desde 20-oct, knee desde 4-nov
    assert.deepStrictEqual(inj.map(x => x.ongoing), [true, false, true]);
});
test('de cada lesión solo salen zona, tipo, gravedad, fechas y estado: nunca texto libre, dolor ni notas', () => {
    const { t } = availEnv();
    const inj = t._crBuildAvailability('p1', '2026-10-10', '2026-11-06', BLOCKS).injuries;
    inj.forEach(x => assert.deepStrictEqual(Object.keys(x).sort(), ['end', 'location', 'ongoing', 'severity', 'start', 'type']));
    assert.ok(!JSON.stringify(inj).includes('SECRETO'));
});

console.log('\nFase 2: GPS');
test('suma por bloque las sesiones de pista y partido con GPS; velocidad máxima = la mayor; sin gimnasio ni otras jugadoras', () => {
    const { t } = makeEnv();
    t.sessions = [S('2026-10-12', 'training', 5, 60), S('2026-10-14', 'match', 8, 30), S('2026-10-15', 'gym', 9, 60), S('2026-10-16', 'training', 5, 60, 'p2'), S('2026-10-17', 'training', 5, 60), S('2026-10-18', 'training', 5, 60)];
    const gps = { [t.sessions[0].id]: { distanceM: 4200, maxSpeedKmh: 24.5, highIntensityRunsM: 150, maxIntensityRunsM: 30, highAccelerations: 12, highDecelerations: 9 },
                  [t.sessions[1].id]: { distanceM: 3000.5, maxSpeedKmh: 27.1, highIntensityRunsM: 100, maxIntensityRunsM: 45, highAccelerations: 8, highDecelerations: null },
                  [t.sessions[2].id]: { distanceM: 9999, maxSpeedKmh: 40 }, [t.sessions[3].id]: { distanceM: 8888 },
                  [t.sessions[4].id]: { distanceM: 5000, maxSpeedKmh: null, highIntensityRunsM: undefined } };
    t._getGpsForSession = s => gps[s.id] || null;
    const g = t._crBuildGps('p1', BLOCKS);
    same(g[0], { sessions: 2, distanceM: 7200.5, maxSpeed: 27.1, hsrM: 250, sprintM: 75, accel: 20, decel: 9 });
    assert.deepStrictEqual([g[1].sessions, g[1].distanceM, g[1].maxSpeed], [1, 5000, null]);
    assert.strictEqual(g[2].sessions, 0);
});

console.log('\nFase 2: el PDF');
function fullPdf(opts = {}) {
    const e = availEnv(); const t = e.t;
    t.getPlayerThresholds = () => TH;
    t.calculateAcuteChronicRatio = (id, min, asOf) => ({ ratio: { '2026-10-16': '1.62', '2026-10-23': '1.40', '2026-10-30': '1.05' }[fn(e.ctx, 'toLocalISODate')(asOf)] || 'N/A', confidence: 'high' });
    t.wellnessData = [{ playerId: 'p1', date: '2026-10-12', sleep: 4, fatigue: 4, mood: 4, soreness: 4 }, { playerId: 'p1', date: '2026-10-25', sleep: 2, fatigue: 2, mood: 3, soreness: 2 }];
    t.sessions = [S('2026-10-12', 'training', 6, 90), S('2026-10-24', 'match', 8, 32), S('2026-10-20', 'gym', 9, 60)];
    t._getGpsForSession = s => (s.type === 'training' ? { distanceM: 4200, maxSpeedKmh: 24.5, highIntensityRunsM: 150, maxIntensityRunsM: 30, highAccelerations: 12, highDecelerations: 9 } : null);
    const sections = Object.assign({ table: true, chart: false, sessions: false, ac: false, gps: false, wellness: false, injuries: false }, opts.sections || {});
    const data = t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-11-06', group: 'weeks' });
    data.extras = t.buildCustomReportExtras('p1', data, sections);
    return { html: t.buildCustomReportHTML(t.players[0], data, { lang: opts.lang || 'en', sections, note: opts.note || '' }), t, data };
}
test('cada sección nueva aparece solo si se marca', () => {
    const none = fullPdf().html;
    ['Acute:chronic workload ratio', 'GPS (external load)', 'Wellness (average per period)', 'Availability', 'Injuries in the period'].forEach(x => assert.ok(!none.includes(x), 'no debería salir: ' + x));
    const all = fullPdf({ sections: { ac: true, gps: true, wellness: true, injuries: true } }).html;
    ['Acute:chronic workload ratio', 'GPS (external load)', 'Wellness (average per period)', 'Availability', 'Injuries in the period', 'Days in squad'].forEach(x => assert.ok(all.includes(x), 'falta: ' + x));
    assert.ok(fullPdf({ sections: { gps: true } }).html.includes('GPS (external load)') && !fullPdf({ sections: { gps: true } }).html.includes('Wellness (average'));
});
test('la marca «Confidencial» sale solo con bienestar o lesiones (no con A:C ni GPS)', () => {
    assert.ok(!fullPdf({ sections: { ac: true, gps: true } }).html.includes('class="confidential"'));
    assert.ok(fullPdf({ sections: { wellness: true } }).html.includes('Confidential — contains health information'));
    assert.ok(fullPdf({ sections: { injuries: true }, lang: 'es' }).html.includes('Confidencial — contiene información de salud'));
});
test('A:C: ratio con 2 decimales, estado con su color y umbrales de la jugadora en la nota (sin marcadores sin sustituir)', () => {
    const { html } = fullPdf({ sections: { ac: true } });
    assert.ok(/1\.62<\/td>\s*<td class="c-bad"><strong>Danger/.test(html));
    assert.ok(/1\.40<\/td>\s*<td class="c-warn"><strong>Caution/.test(html));
    assert.ok(/1\.05<\/td>\s*<td class="c-good"><strong>Optimal/.test(html));
    assert.ok(/<td class="c-na"><strong>Insufficient data/.test(html));
    assert.ok(html.includes('low &lt; 0.80') && html.includes('optimal up to 1.30') && html.includes('caution up to 1.50') && html.includes('danger above 1.50'));
    assert.ok(!/\{(low|opt|high)\}/.test(html));
    assert.ok(/1,62<\/td>/.test(fullPdf({ sections: { ac: true }, lang: 'es' }).html), 'coma decimal en español');
});
test('bienestar: colores por el valor redondeado que se ve, y semanas sin registros con guion', () => {
    const { html } = fullPdf({ sections: { wellness: true } });
    assert.ok(/<td class="c-good">4\.0<\/td>/.test(html) && /<td class="c-bad">2\.0<\/td>/.test(html));
    assert.ok(/<td>0<\/td><td colspan="5">–<\/td>/.test(html));
    assert.ok(html.includes('Wellness scale 1–5, higher is better'));
});
test('lesiones: etiquetas traducidas, estado en curso / recuperada y NINGÚN texto libre', () => {
    const en = fullPdf({ sections: { injuries: true } }).html;
    ['Groin', 'Ankle', 'Knee', 'Joint', 'Muscle', 'Moderate', 'Minor', 'Ongoing', 'Recovered', 'Unavailable', 'Limited'].forEach(x => assert.ok(en.includes(x), 'falta ' + x));
    assert.ok(!en.includes('SECRETO') && !/wrist|Wrist/.test(en), 'ni texto libre ni lesiones posteriores al periodo');
    const es = fullPdf({ sections: { injuries: true }, lang: 'es' }).html;
    ['Ingle', 'Tobillo', 'Rodilla', 'Articular', 'En curso', 'Recuperada', 'No disponible'].forEach(x => assert.ok(es.includes(x), 'falta ' + x));
});
test('una zona o tipo desconocido se muestra tal cual pero escapado', () => {
    const { t, data } = fullPdf({ sections: { injuries: true } });
    t.injuries.push({ id: 'x', playerId: 'p1', location: '<img src=x onerror=alert(1)>', type: 'raro', severity: 'minor', startDate: '2026-10-20', endDate: null, status: 'active' });
    data.extras = t.buildCustomReportExtras('p1', data, { injuries: true });
    const html = t.buildCustomReportHTML(t.players[0], data, { lang: 'en', sections: { injuries: true } });
    assert.ok(!html.includes('<img src=x') && html.includes('&lt;img') && html.includes('raro'));
});
test('con todas las secciones el PDF sigue sin gimnasio, y las de carga se pintan aunque no haya sesiones si solo se piden las nuevas', () => {
    const all = fullPdf({ sections: { sessions: true, chart: true, ac: true, gps: true, wellness: true, injuries: true } }).html;
    assert.ok(!/gym|gimnasio|strength|fuerza/i.test(all));
    const { t, data } = fullPdf({ sections: { wellness: true } });
    t.sessions = []; const d2 = t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-11-06', group: 'weeks' }); d2.extras = t.buildCustomReportExtras('p1', d2, { wellness: true });
    const only = t.buildCustomReportHTML(t.players[0], d2, { lang: 'en', sections: { wellness: true } });
    assert.ok(only.includes('Wellness (average per period)') && !only.includes('No sessions recorded'));
    const withTable = t.buildCustomReportHTML(t.players[0], d2, { lang: 'en', sections: { table: true, wellness: true } });
    assert.ok(withTable.includes('No sessions recorded in this period.') && withTable.includes('Wellness (average per period)'));
});
test('la lista de sesiones pasa a página aparte si hay cualquier sección antes', () => {
    assert.ok(fullPdf({ sections: { table: false, sessions: true, gps: true } }).html.includes('class="section sessions-page"'));
    assert.ok(!fullPdf({ sections: { table: false, sessions: true } }).html.includes('class="section sessions-page"'));
});

console.log('\nFase 2: última selección y diálogo');
test('lo recordado NO incluye secciones de salud, ni jugadora, ni fechas, ni la nota', () => {
    const { t, store } = makeEnv();
    t._crSavePrefs({ lang: 'en', group: 'months', periodKind: '3w', playerId: 'p1', from: '2026-10-01', to: '2026-11-01', note: 'NOTA-PRIVADA',
        sections: { table: true, chart: false, sessions: true, ac: true, gps: true, wellness: true, injuries: true } });
    const raw = store.basketballCustomReportPrefs;
    ['wellness', 'injuries', 'p1', '2026-10', 'NOTA-PRIVADA', 'playerId'].forEach(x => assert.ok(!raw.includes(x), 'no debe guardarse: ' + x));
    same(JSON.parse(raw), { lang: 'en', group: 'months', period: '3w', sections: { table: true, chart: false, sessions: true, ac: true, gps: true } });
});
test('al cargar, las de salud salen SIEMPRE desmarcadas aunque alguien manipule el almacenamiento', () => {
    const { t, store } = makeEnv();
    store.basketballCustomReportPrefs = JSON.stringify({ lang: 'en', group: 'weeks', period: '4w', sections: { table: true, wellness: true, injuries: true } });
    const p = t._crLoadPrefs();
    assert.strictEqual(p.sections.wellness, false); assert.strictEqual(p.sections.injuries, false); assert.strictEqual(p.sections.table, true);
});
test('lo corrupto o raro se ignora o se normaliza (periodo «personalizado» no se recuerda)', () => {
    const { t, store } = makeEnv();
    store.basketballCustomReportPrefs = '{no es json';
    assert.strictEqual(t._crLoadPrefs(), null);
    store.basketballCustomReportPrefs = JSON.stringify({ lang: 'fr', group: 'x', period: 'custom', sections: { table: true } });
    same(t._crLoadPrefs().period, null); assert.strictEqual(t._crLoadPrefs().lang, 'es'); assert.strictEqual(t._crLoadPrefs().group, 'weeks');
    t._crSavePrefs({ lang: 'es', group: 'weeks', periodKind: 'custom', sections: {} });
    assert.strictEqual(JSON.parse(store.basketballCustomReportPrefs).period, null);
});
test('abrir el diálogo aplica lo recordado (idioma, agrupación, secciones y atajo de periodo)', () => {
    const { t, els, store } = makeEnv();
    setForm(els, { lang: 'es', group: 'weeks', table: true, chart: true });
    store.basketballCustomReportPrefs = JSON.stringify({ lang: 'en', group: 'months', period: '3w', sections: { table: false, chart: true, sessions: true, ac: true, gps: false } });
    t.showCustomReportDialog('p1');
    assert.strictEqual(els.crLang.value, 'en'); assert.strictEqual(els.crGroup.value, 'months');
    assert.deepStrictEqual([els.crSecTable.checked, els.crSecChart.checked, els.crSecSessions.checked, els.crSecAc.checked, els.crSecGps.checked, els.crSecWellness.checked, els.crSecInjuries.checked],
        [false, true, true, true, false, false, false]);
    assert.strictEqual(t._crPeriodKind, '3w');
    const days = fn(makeEnv().ctx, '_crDiffDays')(els.crFrom.value, els.crTo.value) + 1;
    assert.strictEqual(days, 21);
});
test('el diálogo tiene las casillas nuevas, el aviso de datos sensibles y el atajo «Cuerpo técnico»', () => {
    const { t, els } = makeEnv(); t.showCustomReportDialog('p1');
    const h = els.customReportModal.innerHTML;
    ['crSecAc', 'crSecGps', 'crSecWellness', 'crSecInjuries', 'crSensWarn', 'Cuerpo técnico', 'Salud (datos sensibles)', 'Ratio A:C', 'Lesiones y disponibilidad', 'siempre salen desmarcadas'].forEach(x => assert.ok(h.includes(x), 'falta: ' + x));
    assert.ok(/crDatesEdited/.test(h));
});
test('editar las fechas a mano convierte el periodo en «personalizado» y deja de recordarse', () => {
    const { t, els } = makeEnv(); setForm(els, {});
    t.showCustomReportDialog('p1'); t._crDatesEdited();
    assert.strictEqual(t._crPeriodKind, 'custom');
    assert.strictEqual(t._crReadForm().periodKind, 'custom');
});
test('el aviso de datos sensibles se muestra solo si hay bienestar o lesiones marcados', () => {
    const { t, els } = makeEnv(); setForm(els, { wellness: true }); els.crSensWarn = { style: {} }; els.crInfo = { textContent: '' }; els.crWarnings = { innerHTML: '' };
    t._crRefreshInfo(); assert.strictEqual(els.crSensWarn.style.display, 'block');
    setForm(els, { ac: true, gps: true }); t._crRefreshInfo(); assert.strictEqual(els.crSensWarn.style.display, 'none');
});
test('validar: basta cualquier sección nueva; sin ninguna, no', () => {
    const { ctx } = makeEnv(); const v = fn(ctx, '_crValidate'); const ok = { from: '2026-10-10', to: '2026-11-06' };
    ['ac', 'gps', 'wellness', 'injuries'].forEach(k => assert.strictEqual(v({ ...ok, sections: { [k]: true } }), '', k));
    assert.ok(v({ ...ok, sections: { table: false, chart: false, sessions: false, ac: false, gps: false, wellness: false, injuries: false } }));
});
test('generar con secciones de salud las incluye en el PDF pero NO las recuerda; sí recuerda las demás', async () => {
    const { t, els, store, printWindow } = makeEnv();
    t.getPlayerThresholds = () => TH; t.calculateAcuteChronicRatio = () => ({ ratio: '1.10', confidence: 'high' });
    t.wellnessData = [{ playerId: 'p1', date: '2026-10-12', sleep: 4, fatigue: 4, mood: 4, soreness: 4 }]; t.injuries = []; t.sessions = [S('2026-10-12', 'training', 6, 90)];
    setForm(els, { wellness: true, injuries: true, ac: true, sessions: true, lang: 'en' });
    t._crPeriodKind = '4w';
    await t.generateCustomReport();
    assert.ok(printWindow.html.includes('Wellness (average per period)') && printWindow.html.includes('Confidential') && printWindow.html.includes('Acute:chronic workload ratio'));
    const saved = JSON.parse(store.basketballCustomReportPrefs);
    assert.deepStrictEqual(saved.sections, { table: true, chart: true, sessions: true, ac: true, gps: false });
    assert.ok(!('wellness' in saved.sections) && !('injuries' in saved.sections));
});
test('si no se llega a generar (datos inválidos) no se guarda nada', async () => {
    const { t, els, store } = makeEnv();
    setForm(els, { from: '2026-11-07', to: '2026-11-06' });
    await t.generateCustomReport();
    assert.strictEqual(store.basketballCustomReportPrefs, undefined);
});

console.log('\nPaginación del PDF (las tablas no se parten entre hojas)');
test('el CSS evita partir filas, repite la cabecera de las tablas largas y no deja un título solo al final de la hoja', () => {
    const { html } = fullPdf({ sections: { ac: true, gps: true } });
    assert.ok(/thead \{ display: table-header-group; \}/.test(html), 'cabecera repetida');
    assert.ok(/tr, \.bar-row \{ break-inside: avoid; page-break-inside: avoid; \}/.test(html), 'filas enteras');
    assert.ok(/\.section h2 \{ break-after: avoid; page-break-after: avoid; \}/.test(html), 'título pegado a su tabla');
    assert.ok(/\.section \{[^}]*page-break-inside: avoid/.test(html), 'una sección que cabe en una hoja se mantiene entera');
});
function manyBlocks(n) {
    const e = makeEnv(); const t = e.t;
    t.sessions = [S('2026-10-12', 'training', 6, 90)];
    const to = '2026-11-06', from = fn(e.ctx, '_crAddDays')(to, -(n * 7 - 1));
    const data = t.buildCustomReportData('p1', { from, to, group: 'weeks' });
    data.extras = {};
    return { t, data, html: t.buildCustomReportHTML(t.players[0], data, { lang: 'es', sections: { table: true, chart: true } }) };
}
test('hasta 10 periodos el formato es el normal (periodo y fechas en dos líneas); a partir de 11 pasa a compacto', () => {
    const normal = manyBlocks(10), compact = manyBlocks(11);
    assert.strictEqual(normal.data.blocks.length, 10); assert.strictEqual(compact.data.blocks.length, 11);
    assert.ok(!normal.html.includes('<body class="compact">') && /<strong>Semana 1<\/strong><br><span class="dates">/.test(normal.html));
    assert.ok(compact.html.includes('<body class="compact">') && /<strong>Semana 1<\/strong> <span class="dates">/.test(compact.html));
    assert.ok(!/<strong>Semana 1<\/strong><br>/.test(compact.html), 'sin salto de línea en las filas compactas');
    assert.ok(/class="bar-label">Semana 1 <span class="dates">/.test(compact.html), 'también en el gráfico');
});
test('el formato compacto también se aplica a las secciones nuevas (A:C, GPS, bienestar, disponibilidad)', () => {
    const e = availEnv(); const t = e.t;
    t.getPlayerThresholds = () => TH; t.calculateAcuteChronicRatio = () => ({ ratio: '1.10', confidence: 'high' });
    t.sessions = [S('2026-10-12', 'training', 6, 90)]; t.wellnessData = []; t._getGpsForSession = () => null;
    const sections = { ac: true, gps: true, wellness: true, injuries: true };
    const data = t.buildCustomReportData('p1', { from: '2026-05-01', to: '2026-11-06', group: 'weeks' });
    data.extras = t.buildCustomReportExtras('p1', data, sections);
    const html = t.buildCustomReportHTML(t.players[0], data, { lang: 'es', sections });
    assert.ok(data.blocks.length > 10 && html.includes('<body class="compact">'));
    assert.ok(!/<strong>Semana \d+<\/strong><br>/.test(html), 'ninguna tabla usa filas de dos líneas');
    assert.ok((html.match(/<td class="left nowrap">/g) || []).length >= data.blocks.length * 4);
});
test('la cabecera de fila del periodo es la misma en todas las tablas (sin duplicar el marcado)', () => {
    const src = fs.readFileSync(path.join(ROOT, 'custom-report.js'), 'utf8');
    assert.ok(!/<td class="left"><strong>\$\{esc\(blockLabel\(b\)\)\}/.test(src), 'la tabla principal usa _crRowHead como las demás');
});

console.log('\nCableado');
test('el botón está en el menú de informes de la jugadora, y el módulo en index.html y sw.js', () => {
    const pdf = fs.readFileSync(path.join(ROOT, 'pdf-reports.js'), 'utf8');
    assert.ok(/showCustomReportDialog\('\$\{playerId\}'\)/.test(pdf) && pdf.includes('Informe personalizado'));
    assert.ok(/generatePDFReport\('\$\{playerId\}','weekly'\)/.test(pdf), 'los informes anteriores siguen');
    assert.ok(fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').includes('<script src="custom-report.js"></script>'));
    assert.ok(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes("'custom-report.js'"));
});

(async () => {
    for (const q of queue) {
        try { await q.fn(); passed++; console.log('  ✅ ' + q.name); }
        catch (e) { failed++; console.log('  ❌ ' + q.name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

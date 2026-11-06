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
        querySelector: () => null,
        createElement: () => ({ classList: { add() {}, remove() {} }, innerHTML: '' }),
        body: { appendChild(el) { els[el.id] = el; } },
        addEventListener() {}, head: { appendChild() {} },
    };
    const ctx = vm.createContext({
        console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, isFinite, Promise, Map, setTimeout: fn => fn(),
        document, alert: m => alerts.push(m),
        window: { open: () => { log.push('open'); return popupBlocked ? null : printWindow; } },
        Store: { getActiveSeason: () => '2026-27' },
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'security.js'), 'utf8') + '\n;globalThis.esc = esc;', ctx);
    vm.runInContext(`function RPETracker() {}
        function toLocalISODate(d){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}`, ctx);
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'custom-report.js'), 'utf8'), ctx, { filename: 'custom-report.js' });
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = [{ id: 'p1', name: 'Hennie', lastName: 'Van Test' }, { id: 'p2', name: 'Ana', lastName: '' }, { id: 'p3', name: 'Bea', lastName: '' }];
    t.sessions = [];
    t.playerFullName = p => [p.name, p.lastName].filter(Boolean).join(' ');
    t.playerDisplayName = p => p.name;
    t.buildLoadingPlaceholderHTML = () => '<html>loading</html>';
    t.showToast = (m, type) => toasts.push([m, type || 'ok']);
    t.ensureFullSessionHistory = async () => { log.push('history'); };
    return { t, ctx, els, log, toasts, alerts, printWindow };
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
test('los atajos de «para quién es» fijan idioma y secciones', () => {
    assert.strictEqual(fn(makeEnv().ctx, 'CR_PRESETS').selection.lang, 'en');
    same(fn(makeEnv().ctx, 'CR_PRESETS').selection.sections, { table: true, chart: true, sessions: false });
    assert.strictEqual(fn(makeEnv().ctx, 'CR_PRESETS').newteam.sections.sessions, true);
    assert.strictEqual(fn(makeEnv().ctx, 'CR_PRESETS').player.lang, 'es');
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
        crSecTable: { checked: v.table !== false }, crSecChart: { checked: v.chart !== false }, crSecSessions: { checked: !!v.sessions }, crNote: { value: v.note || '' } }).forEach(([k, o]) => { els[k] = o; });
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

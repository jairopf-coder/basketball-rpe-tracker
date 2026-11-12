// test/report-styles.test.js
// Estilos del PDF del informe personalizado (report-styles.js): 3 de documento y 3 de presentación,
// además del clásico. Comprueba:
//  · el registro de estilos, su cableado y el selector del diálogo (que recuerda el estilo)
//  · los puntos clave y las cifras que se calculan solas
//  · cada documento (minimalista, moderno, informe de club)
//  · las presentaciones: tamaño 16:9, una idea por diapositiva, tablas repartidas sin pasar del máximo de filas
//    (con el total solo en la última), menú lateral y puntos clave del tema de cuerpo técnico
//  · privacidad (marca «Confidencial» en todas las diapositivas), escape de textos y que el gimnasio no sale nunca
// Ejecutar con:  node test/report-styles.test.js
'use strict';
process.env.TZ = 'Europe/Madrid';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
const queue = [];
function test(name, fn) { queue.push({ name, fn }); }
const ROOT = path.join(__dirname, '..');
const same = (actual, expected, msg) => assert.deepStrictEqual(JSON.parse(JSON.stringify(actual)), expected, msg);

// ── Entorno (como el de custom-report.test.js, con report-styles.js cargado) ───────────────────────────
function makeEnv({ withStyles = true } = {}) {
    const els = {}, log = [], toasts = [], store = {};
    const printWindow = { html: '', document: { write(h) { printWindow.html += h; log.push('write'); }, open() { printWindow.html = ''; }, close() {} }, print() { log.push('print'); } };
    const document = {
        getElementById: id => els[id] || null, querySelector: () => null, querySelectorAll: () => [],
        createElement: () => ({ style: {}, _l: {}, addEventListener() {}, classList: { add() {}, remove() {} }, innerHTML: '' }),
        body: { appendChild(el) { els[el.id] = el; } }, addEventListener() {}, head: { appendChild() {} },
    };
    const ctx = vm.createContext({
        console: { log() {}, warn() {}, error() {} }, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, parseFloat, isNaN, isFinite, Promise, Map, setTimeout: fn => fn(),
        document, alert() {}, localStorage: { getItem: k => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); } },
        window: { open: () => printWindow }, Store: { getActiveSeason: () => '2026-27' },
    });
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'security.js'), 'utf8') + '\n;globalThis.esc = esc;', ctx);
    vm.runInContext(`function RPETracker() {}
        function toLocalISODate(d){const p=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());}`, ctx);
    const files = ['custom-report.js', 'dashboard-alerts.js'].concat(withStyles ? ['report-styles.js'] : []);
    files.forEach(f => vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = [{ id: 'p1', name: 'Hennie', lastName: 'Van Test' }];
    t.playerFullName = p => [p.name, p.lastName].filter(Boolean).join(' ');
    t.playerDisplayName = p => p.name;
    t.buildLoadingPlaceholderHTML = () => '<html>loading</html>';
    t.showToast = m => toasts.push(m);
    t.ensureFullSessionHistory = async () => {};
    return { t, ctx, els, log, toasts, store, printWindow };
}
const fn = (ctx, code) => vm.runInContext(code, ctx);

// Informe con datos sintéticos: `weeks` semanas hasta el 6-nov, una sesión por día (el sábado, partido)
const TH = { low: 0.8, opt: 1.3, high: 1.5 };
const ALL = { table: true, chart: true, sessions: true, ac: true, gps: true, wellness: true, injuries: true };
function build({ weeks = 4, sections = ALL, lang = 'en', style = 'classic', note = '', name, group = 'weeks', env } = {}) {
    const e = env || makeEnv(); const { t, ctx } = e;
    if (name) { t.players[0].name = name; t.players[0].lastName = ''; }
    const add = fn(ctx, '_crAddDays'), iso = fn(ctx, 'toLocalISODate');
    const to = '2026-11-06', from = add(to, -(weeks * 7 - 1));
    const sessions = [];
    for (let d = from; d <= to; d = add(d, 1)) {
        const dow = fn(ctx, `_crParseISO('${d}')`).getDay(); if (dow === 0) continue;
        const match = dow === 6, w = Math.floor(fn(ctx, `_crDiffDays('${from}', '${d}')`) / 7);
        const rpe = 4 + (dow % 3) + (w === 2 ? 3 : 0);          // la semana 3 es la de mayor carga; las demás son más bajas
        sessions.push({ id: d + 's', playerId: 'p1', date: d, type: match ? 'match' : 'training', rpe, duration: match ? 38 : 95, load: rpe * (match ? 38 : 95) });
        if (dow === 3) sessions.push({ id: d + 'g', playerId: 'p1', date: d, type: 'gym', rpe: 9, duration: 60, load: 540 });   // el gimnasio no debe salir nunca
    }
    t.sessions = sessions;
    t.getPlayerThresholds = () => TH;
    t.calculateAcuteChronicRatio = (id, min, asOf) => ({ ratio: (0.9 + ((asOf.getDate() * 7) % 9) / 10).toFixed(2), confidence: 'high' });
    t.wellnessData = []; for (let d = from; d <= to; d = add(d, 2)) t.wellnessData.push({ playerId: 'p1', date: d, sleep: 2 + (+d.slice(8) % 4), fatigue: 3, mood: 4, soreness: 2 + (+d.slice(8) % 3) });
    t.isPlayerActiveOn = () => true; t.getPlayerParticipation = (id, d) => (d.slice(8) === '15' ? 'out' : 'full');
    t.injuries = [{ id: 'i1', playerId: 'p1', location: 'ankle', type: 'joint', severity: 'minor', startDate: add(to, -10), endDate: null, status: 'active', description: 'SECRETO' }];
    t._getGpsForSession = s => (s.type === 'gym' ? { distanceM: 99999 } : { distanceM: 4300, maxSpeedKmh: 25.5, highIntensityRunsM: 140, maxIntensityRunsM: 30, highAccelerations: 11, highDecelerations: 9 });
    const data = t.buildCustomReportData('p1', { from, to, group });
    data.extras = t.buildCustomReportExtras('p1', data, sections);
    const opts = { lang, sections, note, style };
    return { e, t, data, opts, html: t.buildCustomReportHTML(t.players[0], data, opts), parts: t._crParts(t.players[0], data, opts) };
}
const slidesOf = html => html.split('<section class="slide').slice(1).map(x => '<section class="slide' + x.split('</section>')[0] + '</section>');
const titleOf = sl => (/<h2>([^<]*)<\/h2>/.exec(sl) || [])[1];
const bodyRows = sl => { const m = /<tbody>([\s\S]*?)<\/tbody>/.exec(sl); return m ? (m[1].match(/<tr/g) || []).length : 0; };
const DOCS = ['minimal', 'modern', 'club'], SLIDES = ['slides-minimal', 'slides-modern', 'slides-staff'];

console.log('\nRegistro y cableado');
test('hay 7 estilos: el clásico, 3 de documento y 3 de presentación, con sus nombres', () => {
    const S = fn(makeEnv().ctx, 'CR_STYLES');
    assert.deepStrictEqual(Object.keys(S), ['classic', 'minimal', 'modern', 'club', 'slides-minimal', 'slides-modern', 'slides-staff']);
    assert.deepStrictEqual(Object.values(S).map(x => x.kind), ['doc', 'doc', 'doc', 'doc', 'slides', 'slides', 'slides']);
    ['Clásico', 'minimalista', 'moderno', 'Informe de club', 'Presentación minimalista', 'Presentación moderna', 'cuerpo técnico'].forEach(x => assert.ok(Object.values(S).some(v => v.label.includes(x)), 'falta ' + x));
});
test('report-styles.js está en index.html (después de custom-report.js) y en sw.js', () => {
    const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    assert.ok(idx.includes('<script src="report-styles.js"></script>') && idx.indexOf('custom-report.js') < idx.indexOf('report-styles.js'));
    assert.ok(fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8').includes("'report-styles.js'"));
});
test('sin estilo, con «classic» o con un estilo desconocido sale el clásico; si falta el módulo de estilos también', () => {
    const base = build({ style: undefined }).html;
    assert.ok(!base.includes('theme-') && base.includes('class="header"'));
    ['classic', 'no-existe', null, 42].forEach(s => assert.strictEqual(build({ style: s }).html, base));
    const sinModulo = build({ style: 'club', env: makeEnv({ withStyles: false }) }).html;
    assert.ok(sinModulo.includes('class="header"'), 'cae al clásico sin report-styles.js');
});
test('el diálogo tiene el selector «Estilo del PDF» con los 7 estilos agrupados en documento y presentación', () => {
    const { t, els } = makeEnv(); t.showCustomReportDialog('p1');
    const h = els.customReportModal.innerHTML;
    assert.ok(h.includes('id="crStyle"') && h.includes('Documento (hojas A4 verticales)') && h.includes('Presentación (diapositivas 16:9'));
    ['classic', 'minimal', 'modern', 'club', 'slides-minimal', 'slides-modern', 'slides-staff'].forEach(k => assert.ok(h.includes(`<option value="${k}">`), 'falta ' + k));
});

console.log('\nPuntos clave y cifras');
test('mayor carga con su variación respecto a la semana anterior; igual si no cambia; sin comparación en la primera', () => {
    const { t, parts, data } = build({ sections: { table: true } });
    const I = t._crInsights(parts, data);
    assert.ok(/^Peak load: Week \d+ \([\d,]+ AU\)/.test(I.load[0]));
    // semanas con cargas conocidas
    const mk = loads => ({ blocks: loads.map((l, i) => ({ index: i + 1, from: '2026-10-0' + (i + 1), to: '2026-10-0' + (i + 1), training: { sessions: 1, minutes: 60, load: l, rpeSum: 5 }, game: { sessions: 0, minutes: 0, load: 0, rpeSum: 0 } })),
        totals: { all: { sessions: loads.length, load: loads.reduce((a, b) => a + b, 0), rpeSum: 5 }, game: { sessions: 0, load: 0 } }, avgPer7: { load: 100 } });
    const run = loads => { const d = mk(loads); return t._crInsights(Object.assign({}, parts, { hasLoad: true, lab: fn(makeEnv().ctx, '_crLabeler')(parts.L, 'en', false, false) }), d).load[0]; };
    assert.ok(run([1000, 1270, 900]).includes('+27% vs Week 1'));
    assert.ok(run([1000, 1003]).includes('same as Week 1'), 'un +0,3% se redondea a 0 y se dice «igual»');
    assert.ok(run([1000, 1000]).endsWith('(1,000 AU)'), 'con empate gana la primera y no hay comparación');
    assert.ok(run([2000, 1500]).endsWith('(2,000 AU)'), 'si el pico es la primera semana no hay comparación');
    assert.ok(run([0, 500]).endsWith('(500 AU)'), 'no se divide por una carga anterior de cero');
});
test('partidos, A:C, GPS, bienestar y lesiones: frases con los números correctos', () => {
    const { t, parts, data } = build({ weeks: 4 });
    const I = t._crInsights(parts, data);
    assert.ok(/^4 games · [\d,]+ AU \(\d+% of total load\)$/.test(I.load[1]));
    assert.ok(/^Average load: [\d,]+ AU per 7 days$/.test(I.load[2]));
    assert.ok(/^Latest A:C: \d\.\d\d \((Optimal|Caution|Danger|Low)\)$/.test(I.ac[0]));
    assert.ok(/^Total distance: [\d,.]+ km over 24 GPS sessions · top speed 25\.5 km\/h$/.test(I.gps[0]), I.gps[0]);
    assert.ok(/^Lowest wellness: Week \d+ \([\d.]+\) · average [\d.]+$/.test(I.wellness[0]));
    assert.ok(/^Unavailable \d+ of 28 days in the squad$/.test(I.injuries[0]) && I.injuries[1] === '1 injury in the period (1 ongoing)');
});
test('en español y sin datos: los textos se traducen y no se inventa nada', () => {
    const es = build({ lang: 'es' }); const I = es.t._crInsights(es.parts, es.data);
    assert.ok(I.load[0].startsWith('Mayor carga: Semana') && I.load[1].includes('partidos') && I.ac[0].startsWith('Último A:C') && I.injuries[1].includes('lesión'));
    const e = makeEnv(); const t = e.t; t.sessions = [];
    const data = t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-11-06', group: 'weeks' }); data.extras = {};
    const parts = t._crParts(t.players[0], data, { lang: 'en', sections: { table: true } });
    same(t._crInsights(parts, data), { load: [], ac: [], gps: [], wellness: [], injuries: [], peakIndex: null });
});
test('las cifras grandes: carga total, sesiones, partidos y RPE medio', () => {
    const { t, parts, data } = build({ weeks: 4, sections: { table: true } });
    const k = t._crKpis(parts, data);
    same(k.map(x => x.label), ['Total load (AU)', 'Sessions', 'Games', 'Avg RPE']);
    assert.strictEqual(k[1].value, '24'); assert.strictEqual(k[2].value, '4');   // 6 sesiones a la semana (4 semanas); el gimnasio no cuenta assert.strictEqual(k[0].hl, true);
});

console.log('\nDocumentos');
test('cada documento lleva su identidad: minimalista (cifras sin cajas), moderno (banda y tarjetas), club (puntos clave y secciones numeradas)', () => {
    const mi = build({ style: 'minimal' }).html, mo = build({ style: 'modern' }).html, cl = build({ style: 'club' }).html;
    assert.ok(mi.includes('theme-minimal') && mi.includes('class="kp"') && !mi.includes('class="band"') && !mi.includes('class="key"'));
    assert.ok(mo.includes('theme-modern') && mo.includes('class="band"') && (mo.match(/class="card(?: hl)?"/g) || []).length === 4 && mo.includes('>HV<'));
    assert.ok(cl.includes('theme-club') && cl.includes('class="key"') && cl.includes('Key points') && cl.includes('counter-increment: sec') && cl.includes('class="lg">HV<'));
});
test('los tres documentos mantienen las secciones y ponen título a la tabla principal', () => {
    DOCS.forEach(s => {
        const h = build({ style: s }).html;
        ['Load by period</h2>', 'Acute:chronic workload ratio', 'GPS (external load)', 'Wellness (average per period)', 'Availability', 'Session list', 'class="footnote"'].forEach(x => assert.ok(h.includes(x), `${s}: falta ${x}`));
        assert.ok(h.includes('@page { size: A4;'), s + ': hoja A4');
    });
});
test('«club» resalta la semana pico en la tabla y lleva pie con nombre, periodo y página', () => {
    const { html, parts, t, data } = build({ style: 'club', sections: { table: true } });
    const peak = t._crInsights(parts, data).peakIndex;
    assert.strictEqual((html.match(/<tr class="peak">/g) || []).length, 1);
    assert.ok(new RegExp(`<tr class="peak">\\s*<td class="left"><strong>Week ${peak}</strong>`).test(html));
    assert.ok(/@bottom-left \{ content: "Hennie Van Test · 10 Oct 2026 – 6 Nov 2026"/.test(html));
    assert.ok(/@bottom-right \{ content: "Page " counter\(page\) " \/ " counter\(pages\)/.test(html));
    assert.ok(/"Página " counter\(page\)/.test(build({ style: 'club', lang: 'es' }).html));
});
test('los documentos con muchos periodos usan el formato compacto en todos los estilos', () => {
    DOCS.forEach(s => assert.ok(build({ style: s, weeks: 12 }).html.includes('<body class="theme-' + s + ' compact">'), s));
    DOCS.forEach(s => assert.ok(!build({ style: s, weeks: 4 }).html.includes(' compact">'), s));
});
test('sin sesiones los documentos lo explican; con otras secciones marcadas siguen saliendo', () => {
    DOCS.forEach(s => {
        const e = makeEnv(); e.t.sessions = [];
        const data = e.t.buildCustomReportData('p1', { from: '2026-10-10', to: '2026-11-06', group: 'weeks' }); data.extras = {};
        const h = e.t.buildCustomReportHTML(e.t.players[0], data, { lang: 'en', sections: { table: true, chart: true }, style: s });
        assert.ok(h.includes('No sessions recorded in this period.') && !h.includes('class="kp"') && !h.includes('class="cards"'), s);
    });
});

console.log('\nPresentaciones: formato y reparto de diapositivas');
test('páginas de 1280×720 (16:9) sin márgenes, portada primera, notas al final y número de página en cada una', () => {
    SLIDES.forEach(s => {
        const { html } = build({ style: s });
        assert.ok(html.includes('@page { size: 1280px 720px; margin: 0; }'), s);
        const sl = slidesOf(html);
        assert.ok(sl[0].includes('class="slide cover'), s + ': portada');
        assert.strictEqual(titleOf(sl[sl.length - 1]), 'Notes and definitions');
        sl.slice(1).forEach((x, i) => assert.ok(x.includes(`${i + 2} / ${sl.length}`), `${s}: nº de página de la diapositiva ${i + 2}`));
        assert.ok(html.includes('--z') && html.includes('break-after: page'), 'vista en pantalla ajustada y salto entre diapositivas');
    });
});
test('una diapositiva por idea: resumen, tabla, gráfico, A:C, GPS, bienestar, disponibilidad, lesiones, sesiones y notas', () => {
    const titles = slidesOf(build({ style: 'slides-minimal', weeks: 4 }).html).slice(1).map(titleOf).filter(x => !/^Session list/.test(x));
    assert.deepStrictEqual(titles, ['Summary', 'Load by period', 'Load by period (AU)', 'Acute:chronic workload ratio (end of each period)', 'GPS (external load)',
        'Wellness (average per period)', 'Availability', 'Injuries in the period', 'Notes and definitions']);
});
test('solo salen las diapositivas de las secciones marcadas', () => {
    const t = slidesOf(build({ style: 'slides-modern', sections: { table: true } }).html).slice(1).map(titleOf);
    assert.deepStrictEqual(t, ['Summary', 'Load by period', 'Notes and definitions']);
    const w = slidesOf(build({ style: 'slides-modern', sections: { wellness: true } }).html).slice(1).map(titleOf);
    assert.deepStrictEqual(w, ['Wellness (average per period)', 'Notes and definitions'], 'sin carga marcada no hay resumen ni tablas de carga');
});
test('una tabla larga se reparte en varias diapositivas sin pasar del máximo de filas, con el total solo en la última', () => {
    SLIDES.forEach(s => {
        const sl = slidesOf(build({ style: s, weeks: 20 }).html);
        const load = sl.filter(x => /^Load by period \(\d\/\d\)$/.test(titleOf(x)));
        assert.deepStrictEqual(load.map(titleOf), ['Load by period (1/3)', 'Load by period (2/3)', 'Load by period (3/3)'], s);
        assert.deepStrictEqual(load.map(bodyRows), [7, 7, 6 + 2], s + ': 7 filas por diapositiva (+ total y media en la última)');
        assert.deepStrictEqual(load.map(x => (x.match(/<tr class="sum">/g) || []).length), [0, 0, 1], s + ': total solo en la última');
        assert.deepStrictEqual(load.map(x => (x.match(/<thead>/g) || []).length), [1, 1, 1], s + ': cabecera en cada una');
        const gps = sl.filter(x => /^GPS/.test(titleOf(x)));
        assert.deepStrictEqual(gps.map(x => (x.match(/<tr class="sum">/g) || []).length), [0, 0, 1], s + ': total GPS solo en la última');
        const caps = { 'Acute': 9, 'GPS': 8, 'Wellness': 9, 'Availability': 8, 'Session': 10 };
        sl.forEach(x => Object.entries(caps).forEach(([k, cap]) => { if (new RegExp('^' + k).test(titleOf(x) || '')) assert.ok(bodyRows(x) <= cap + 1, `${s}: ${titleOf(x)} tiene ${bodyRows(x)} filas`); }));
    });
});
test('el gráfico de barras se reparte con la MISMA escala en todas sus diapositivas', () => {
    const sl = slidesOf(build({ style: 'slides-minimal', weeks: 20, sections: { chart: true } }).html).filter(x => /^Load by period \(AU\)/.test(titleOf(x)));
    assert.strictEqual(sl.length, 3);
    const widths = sl.map(x => [...x.matchAll(/class="seg train" style="width:([\d.]+)%"><\/span><span class="seg game" style="width:([\d.]+)%"/g)].map(m => +m[1] + +m[2]));
    const all = widths.flat();
    assert.ok(all.every(w => w <= 100.2) && Math.abs(Math.max(...all) - 100) < 0.2);
    assert.deepStrictEqual(widths.map(w => w.length), [9, 9, 2]);
    assert.ok(Math.abs(Math.max(...widths[0]) - 100) < 0.2, 'la semana más cargada (en la 1.ª diapositiva) ocupa todo el ancho');
    assert.ok(Math.max(...widths[1]) < 90 && Math.max(...widths[2]) < 90, 'las otras diapositivas usan esa misma escala: sus barras son más cortas');
});
test('la lista de sesiones se reparte de 10 en 10, la disponibilidad no repite la tabla de lesiones y las lesiones se trocean aparte', () => {
    const sl = slidesOf(build({ style: 'slides-staff', weeks: 4 }).html);
    const ses = sl.filter(x => /^Session list/.test(titleOf(x)));
    assert.deepStrictEqual(ses.map(bodyRows), [10, 10, 4]);
    const av = sl.find(x => titleOf(x) === 'Availability');
    assert.ok(av.includes('Days in squad') && !av.includes('Severity'));
    assert.ok(sl.find(x => titleOf(x) === 'Injuries in the period').includes('Severity'));
});
test('las diapositivas no repiten el título de la sección dentro del cuerpo (ya va en la cabecera)', () => {
    SLIDES.forEach(s => slidesOf(build({ style: s }).html).slice(1).forEach(x => assert.strictEqual((x.match(/<h2>/g) || []).length, 1, `${s}: ${titleOf(x)}`)));
});
test('cada tema tiene su carácter: minimalista (sin menú), moderno (portada con formas y tarjetas), cuerpo técnico (menú lateral, franja de puntos clave y portada con el nº de semanas)', () => {
    const mi = build({ style: 'slides-minimal' }).html, mo = build({ style: 'slides-modern' }).html, st = build({ style: 'slides-staff' }).html;
    assert.ok(!mi.includes('class="side"') && mi.includes('class="kpi') && mi.includes('class="ln"'));
    assert.ok(mo.includes('class="circ"') && mo.includes('class="pill"') && mo.includes('class="kpi hl"'));
    assert.ok(st.includes('class="pan"') && /<b>4<\/b><span>WEEKS<\/span>/.test(st) && st.includes('class="side"') && st.includes('class="strip"'));
    const data = slidesOf(st)[2];
    assert.ok(data.includes('class="it on">Load<') && data.includes('class="it">A:C ratio<') && data.includes('Key points'));
    const ac = slidesOf(st).find(x => /^Acute/.test(titleOf(x)));
    assert.ok(ac.includes('class="it on">A:C ratio<') && !ac.includes('class="it on">Load<'));
});
test('el menú lateral solo muestra las secciones incluidas', () => {
    const st = slidesOf(build({ style: 'slides-staff', sections: { table: true, gps: true } }).html)[1];
    assert.ok(st.includes('>Load<') && st.includes('>GPS<') && !st.includes('>Wellness<') && !st.includes('>Injuries<') && !st.includes('>A:C ratio<'));
});
test('los nombres largos hacen la portada más pequeña (para que quepa) y el periodo se cuenta en semanas o meses', () => {
    const cls = nm => /<div class="big([^"]*)">/.exec(slidesOf(build({ style: 'slides-minimal', name: nm }).html)[0])[1];
    assert.strictEqual(cls('Ana Pérez'), ''); assert.strictEqual(cls('María del Carmen Fernández'), ' lg'); assert.strictEqual(cls('María del Carmen Fernández-Villaverde de la Torre'), ' xl');
    assert.ok(/4 weeks/.test(slidesOf(build({ style: 'slides-minimal' }).html)[0]));
    assert.ok(/\d months/.test(slidesOf(build({ style: 'slides-minimal', weeks: 13, group: 'months' }).html)[0]));
    assert.ok(/4 semanas/.test(slidesOf(build({ style: 'slides-minimal', lang: 'es' }).html)[0]));
});
test('en español: títulos, menú y puntos clave traducidos', () => {
    const sl = slidesOf(build({ style: 'slides-staff', lang: 'es' }).html);
    assert.ok(sl.map(titleOf).includes('Resumen') && sl.map(titleOf).includes('Carga por periodo') && sl.map(titleOf).includes('Notas y definiciones'));
    assert.ok(sl[2].includes('Carga<') && sl[2].includes('Puntos clave'));
    assert.ok(/Mayor carga: Semana \d/.test(sl[2]));
});

console.log('\nPrivacidad y seguridad');
test('con datos de salud, TODAS las diapositivas llevan «Confidencial» (y la portada la línea completa); sin ellos, ninguna', () => {
    SLIDES.forEach(s => {
        const conf = slidesOf(build({ style: s, lang: 'es', sections: Object.assign({}, ALL) }).html);
        conf.slice(1).forEach(x => assert.ok(x.includes('conf-tag">Confidencial<'), `${s}: ${titleOf(x)}`));
        assert.ok(conf[0].includes('Confidencial — contiene información de salud'));
        const noConf = slidesOf(build({ style: s, sections: { table: true, ac: true, gps: true } }).html);
        noConf.forEach(x => assert.ok(!/Confidential/.test(x), s));
    });
    DOCS.forEach(st => {
        assert.ok(build({ style: st, sections: { wellness: true } }).html.includes('Confidential — contains health information'), st);
        assert.ok(!build({ style: st, sections: { table: true, ac: true, gps: true } }).html.includes('Confidential'), st);
    });
});
test('nombre, nota y datos con HTML no producen código ejecutable en ningún estilo (ni en el CSS del pie)', () => {
    const evil = '</style><img src=x onerror=alert(1)>"\\{};';
    ['classic', ...DOCS, ...SLIDES].forEach(s => {
        const e = makeEnv(); e.t.injuries = [];
        const { html, t, data } = build({ style: s, name: evil, note: '<script>alert(2)</script><img src=y onerror=alert(3)>', env: e });
        assert.ok(!html.includes('<img src=x') && !html.includes('<img src=y') && !html.includes('<script>alert('), s);
        assert.ok(!/<\/style><img/.test(html), s + ': no se escapa del bloque de estilos');
    });
    const club = build({ style: 'club', name: evil }).html;
    const foot = /@bottom-left \{ content: ([^;]*);/.exec(club)[1];
    assert.ok(!/[<>\\{}]/.test(foot.slice(1, -1)) && foot.startsWith('"') && foot.endsWith('"'), 'el texto del pie queda limpio: ' + foot);
});
test('el gimnasio no aparece en ningún estilo ni sección (ni su GPS)', () => {
    ['classic', ...DOCS, ...SLIDES].forEach(s => {
        const h = build({ style: s }).html;
        assert.ok(!/gym|gimnasio|strength|fuerza/i.test(h), s);
        assert.ok(!h.includes('99,999') && !h.includes('99.999'), s + ': ni el GPS del gimnasio');
    });
});
test('los datos de lesión de texto libre no llegan a ningún estilo', () => {
    ['classic', ...DOCS, ...SLIDES].forEach(s => assert.ok(!build({ style: s }).html.includes('SECRETO'), s));
});

console.log('\nDiálogo y generación');
function setForm(els, v) {
    Object.entries({ crPlayer: { value: 'p1' }, crFrom: { value: '2026-10-10' }, crTo: { value: '2026-11-06' }, crGroup: { value: 'weeks' }, crLang: { value: v.lang || 'en' },
        crStyle: { value: v.style || 'classic' }, crSecTable: { checked: true }, crSecChart: { checked: true }, crSecSessions: { checked: false }, crSecAc: { checked: false }, crSecGps: { checked: false },
        crSecWellness: { checked: !!v.wellness }, crSecInjuries: { checked: false }, crNote: { value: '' } }).forEach(([k, o]) => { els[k] = o; });
}
test('generar con un estilo de presentación escribe diapositivas; con uno de documento, un documento; con el clásico, lo de siempre', async () => {
    for (const [style, marker] of [['slides-staff', 'class="slide cover'], ['slides-modern', 'class="slide cover'], ['club', 'theme-club'], ['minimal', 'theme-minimal'], ['classic', 'class="header"']]) {
        const e = makeEnv(); DEMO(e); setForm(e.els, { style });
        await e.t.generateCustomReport();
        assert.ok(e.printWindow.html.includes(marker), `${style}: ${marker}`);
        assert.ok(e.log.includes('print'));
    }
});
function DEMO(e) { const t = e.t; t.sessions = [{ id: 'a', playerId: 'p1', date: '2026-10-12', type: 'training', rpe: 6, duration: 90, load: 540 }]; t.wellnessData = []; t.injuries = []; }
test('el estilo elegido se recuerda con el resto de lo no sensible (y no activa nada sensible)', async () => {
    const e = makeEnv(); DEMO(e); setForm(e.els, { style: 'slides-staff', wellness: true });
    await e.t.generateCustomReport();
    const saved = JSON.parse(e.store.basketballCustomReportPrefs);
    assert.strictEqual(saved.style, 'slides-staff'); assert.ok(!('wellness' in saved.sections));
    const p = e.t._crLoadPrefs(); assert.strictEqual(p.style, 'slides-staff'); assert.strictEqual(p.sections.wellness, false);
});
test('un estilo guardado que ya no existe o está manipulado vuelve al clásico', () => {
    const e = makeEnv();
    e.store.basketballCustomReportPrefs = JSON.stringify({ style: '<script>', lang: 'en', group: 'weeks', sections: {} });
    assert.strictEqual(e.t._crLoadPrefs().style, 'classic');
    e.t._crSavePrefs({ lang: 'es', group: 'weeks', style: 'nope', sections: {} });
    assert.strictEqual(JSON.parse(e.store.basketballCustomReportPrefs).style, 'classic');
});
test('abrir el diálogo aplica el estilo recordado', () => {
    const e = makeEnv(); setForm(e.els, { style: 'classic' });
    e.store.basketballCustomReportPrefs = JSON.stringify({ style: 'club', lang: 'es', group: 'weeks', period: '4w', sections: { table: true } });
    e.t.showCustomReportDialog('p1');
    assert.strictEqual(e.els.crStyle.value, 'club');
});
test('el formulario devuelve «classic» si el valor del selector no es un estilo conocido', () => {
    const e = makeEnv(); setForm(e.els, { style: 'inventado' });
    assert.strictEqual(e.t._crReadForm().style, 'classic');
});

(async () => {
    for (const q of queue) {
        try { await q.fn(); passed++; console.log('  ✅ ' + q.name); }
        catch (e) { failed++; console.log('  ❌ ' + q.name + '\n     ' + String(e.stack || e.message).split('\n').slice(0, 5).join('\n     ')); }
    }
    console.log(`\n${passed} OK, ${failed} fallos`);
    process.exit(failed ? 1 : 0);
})();

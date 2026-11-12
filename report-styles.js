// BasketballRPE-Web — report-styles.js
// Estilos del PDF del «Informe personalizado» (custom-report.js). Todos usan los MISMOS datos y las mismas
// piezas (tablas, barras…); solo cambia cómo se presentan:
//
//   Documento (hojas A4 verticales)         Presentación (diapositivas 16:9, una idea por diapositiva)
//   · minimal  — minimalista                · slides-minimal — minimalista
//   · modern   — moderno                    · slides-modern  — moderna (fondo oscuro)
//   · club     — informe de club            · slides-staff   — cuerpo técnico (menú lateral y puntos clave)
//
// El estilo «classic» (el de siempre) vive en custom-report.js y no se toca.
//
// Presentaciones: son PDF con páginas de 1280×720 px (16:9), no archivos .pptx. Cada diapositiva tiene tamaño
// fijo y una tabla larga se reparte sola en varias diapositivas (con el total en la última), por lo que nunca
// se corta. Los «puntos clave» se calculan solos a partir de los datos.
//
// Expone: RPETracker.prototype._crRenderStyled(style, player, data, opts, parts)
//          RPETracker.prototype._crInsights / _crKpis / _crSlideList
// Depende de: custom-report.js (piezas _cr*, CR_STYLES, CR_CSS_TABLES, _crParts) y security.js (esc)

'use strict';

// ── Textos de los estilos (los de las tablas están en CR_I18N, de custom-report.js) ─────────────────────
const CR_ST_I18N = {
    en: {
        loadTitle: 'Load by period', summary: 'Summary', keyPoints: 'Key points', notesTitle: 'Notes and definitions',
        kpiLoad: 'Total load (AU)', kpiSessions: 'Sessions', kpiGames: 'Games', kpiRpe: 'Avg RPE', cont: 'cont.', confidentialShort: 'Confidential',
        periods: { week: ['week', 'weeks'], month: ['month', 'months'] },
        nav: { load: 'Load', ac: 'A:C ratio', gps: 'GPS', wellness: 'Wellness', injuries: 'Injuries', sessions: 'Sessions' },
        page: 'Page {n} of {m}',
        ins: {
            peak: 'Peak load: {label} ({load} AU)', peakVs: 'Peak load: {label} ({load} AU), {pct} vs {prev}', peakSame: 'Peak load: {label} ({load} AU), same as {prev}',
            games0: 'No games in this period', games1: '1 game · {load} AU ({pct}% of total load)', gamesN: '{n} games · {load} AU ({pct}% of total load)',
            avg: 'Average load: {load} AU per 7 days',
            ac: 'Latest A:C: {ratio} ({level})', acRisk: '{n} of {m} periods in caution or danger',
            gps: 'Total distance: {km} km over {s} GPS sessions · top speed {v} km/h',
            wellLow: 'Lowest wellness: {label} ({v}) · average {avg}',
            avail: 'Unavailable {x} of {d} days in the squad', injNone: 'No injuries in this period', inj1: '1 injury in the period ({o} ongoing)', injN: '{n} injuries in the period ({o} ongoing)'
        }
    },
    es: {
        loadTitle: 'Carga por periodo', summary: 'Resumen', keyPoints: 'Puntos clave', notesTitle: 'Notas y definiciones',
        kpiLoad: 'Carga total (UA)', kpiSessions: 'Sesiones', kpiGames: 'Partidos', kpiRpe: 'RPE medio', cont: 'cont.', confidentialShort: 'Confidencial',
        periods: { week: ['semana', 'semanas'], month: ['mes', 'meses'] },
        nav: { load: 'Carga', ac: 'Ratio A:C', gps: 'GPS', wellness: 'Bienestar', injuries: 'Lesiones', sessions: 'Sesiones' },
        page: 'Página {n} de {m}',
        ins: {
            peak: 'Mayor carga: {label} ({load} UA)', peakVs: 'Mayor carga: {label} ({load} UA), {pct} respecto a {prev}', peakSame: 'Mayor carga: {label} ({load} UA), igual que {prev}',
            games0: 'Sin partidos en este periodo', games1: '1 partido · {load} UA ({pct}% de la carga total)', gamesN: '{n} partidos · {load} UA ({pct}% de la carga total)',
            avg: 'Carga media: {load} UA por cada 7 días',
            ac: 'Último A:C: {ratio} ({level})', acRisk: '{n} de {m} periodos en precaución o peligro',
            gps: 'Distancia total: {km} km en {s} sesiones con GPS · velocidad máxima {v} km/h',
            wellLow: 'Bienestar más bajo: {label} ({v}) · media {avg}',
            avail: 'No disponible {x} de {d} días en plantilla', injNone: 'Sin lesiones en este periodo', inj1: '1 lesión en el periodo ({o} en curso)', injN: '{n} lesiones en el periodo ({o} en curso)'
        }
    }
};

// Cuántas filas caben en una diapositiva (con margen de seguridad; se comprueba midiendo en el navegador)
const CR_SLIDE_ROWS = { load: 7, ac: 9, gps: 8, wellness: 9, avail: 8, inj: 7, bars: 9, sessions: 10 };

function _crFill(tpl, vars) { return String(tpl).replace(/\{(\w+)\}/g, (m, k) => (vars[k] !== undefined ? vars[k] : m)); }
function _crSigned(pct) { const r = Math.round(pct); return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r) + '%'; }

// ── Puntos clave y cifras destacadas, calculados a partir de los datos ───────────────────────────────────
// Devuelve textos SIN escapar (se escapan al pintarlos), agrupados por sección.
RPETracker.prototype._crInsights = function(parts, data) {
    const { lang, lab, sec, ex } = parts;
    const S = CR_ST_I18N[lang].ins, L = parts.L;
    const out = { load: [], ac: [], gps: [], wellness: [], injuries: [], peakIndex: null };

    if (parts.hasLoad) {
        const loads = data.blocks.map(b => b.training.load + b.game.load);
        let pi = 0; loads.forEach((v, i) => { if (v > loads[pi]) pi = i; });
        out.peakIndex = data.blocks[pi].index;
        const prev = pi > 0 && loads[pi - 1] > 0 ? pi - 1 : -1;
        const pctVsPrev = prev >= 0 ? Math.round((loads[pi] - loads[prev]) / loads[prev] * 100) : null;
        out.load.push(prev < 0
            ? _crFill(S.peak, { label: lab.label(data.blocks[pi]), load: _crNum(loads[pi], lang) })
            : _crFill(pctVsPrev === 0 ? S.peakSame : S.peakVs, { label: lab.label(data.blocks[pi]), load: _crNum(loads[pi], lang), pct: _crSigned(pctVsPrev), prev: lab.label(data.blocks[prev]) }));
        const T = data.totals, g = T.game;
        out.load.push(g.sessions === 0 ? S.games0
            : _crFill(g.sessions === 1 ? S.games1 : S.gamesN, { n: g.sessions, load: _crNum(g.load, lang), pct: Math.round(T.all.load ? g.load / T.all.load * 100 : 0) }));
        out.load.push(_crFill(S.avg, { load: _crNum(data.avgPer7.load, lang) }));
    }

    if (sec.ac && ex.ac) {
        const rows = ex.ac.rows;
        const last = [...rows].reverse().find(r => r.ratio !== null);
        if (last) out.ac.push(_crFill(S.ac, { ratio: _crDec2(last.ratio, lang), level: L.acLevel[last.level] || L.acLevel.na }));
        const risk = rows.filter(r => r.level === 'warn' || r.level === 'danger').length;
        if (risk) out.ac.push(_crFill(S.acRisk, { n: risk, m: rows.length }));
    }
    if (sec.gps && ex.gps) {
        const t = ex.gps.reduce((a, r) => ({ s: a.s + r.sessions, d: a.d + r.distanceM, v: r.maxSpeed === null ? a.v : Math.max(a.v, r.maxSpeed) }), { s: 0, d: 0, v: 0 });
        if (t.s) out.gps.push(_crFill(S.gps, { km: _crDec(t.d / 1000, lang), s: t.s, v: _crDec(t.v, lang) }));
    }
    if (sec.wellness && ex.wellness) {
        const rows = ex.wellness.map((w, i) => ({ w, b: data.blocks[i] })).filter(x => x.w.entries);
        if (rows.length) {
            const low = rows.reduce((a, x) => (x.w.overall < a.w.overall ? x : a));
            const avg = rows.reduce((a, x) => a + x.w.overall, 0) / rows.length;
            out.wellness.push(_crFill(S.wellLow, { label: lab.label(low.b), v: _crDec(low.w.overall, lang), avg: _crDec(avg, lang) }));
        }
    }
    if (sec.injuries && ex.availability) {
        const days = ex.availability.reduce((a, r) => a + r.days, 0), out_ = ex.availability.reduce((a, r) => a + r.out, 0);
        if (days) out.injuries.push(_crFill(S.avail, { x: _crNum(out_, lang), d: _crNum(days, lang) }));
        const inj = ex.injuries || [];
        out.injuries.push(!inj.length ? S.injNone : _crFill(inj.length === 1 ? S.inj1 : S.injN, { n: inj.length, o: inj.filter(x => x.ongoing).length }));
    }
    return out;
};

// Cifras grandes del resumen
RPETracker.prototype._crKpis = function(parts, data) {
    const { lang } = parts, S = CR_ST_I18N[lang], T = data.totals;
    return [
        { value: _crNum(T.all.load, lang), label: S.kpiLoad, hl: true },
        { value: _crNum(T.all.sessions, lang), label: S.kpiSessions },
        { value: _crNum(T.game.sessions, lang), label: S.kpiGames },
        { value: T.all.sessions ? _crDec(T.all.rpeSum / T.all.sessions, lang) : '–', label: S.kpiRpe }
    ];
};

// Número de periodos con su unidad: «4 semanas», «3 months»
function _crPeriodsLabel(parts, data) {
    const S = CR_ST_I18N[parts.lang].periods[parts.isMonths ? 'month' : 'week'];
    const n = data.blocks.length;
    return { n, word: n === 1 ? S[0] : S[1] };
}

function _crInitials(name) {
    return String(name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
}

// Troceado de datos para repartir una tabla en varias diapositivas (mismo índice en todos los extras)
function _crSlice(data, ex, a, b) {
    const d = Object.assign({}, data, { blocks: data.blocks.slice(a, b) });
    const e = Object.assign({}, ex);
    if (ex.ac) e.ac = Object.assign({}, ex.ac, { rows: ex.ac.rows.slice(a, b) });
    if (ex.gps) e.gps = ex.gps.slice(a, b);
    if (ex.wellness) e.wellness = ex.wellness.slice(a, b);
    if (ex.availability) e.availability = ex.availability.slice(a, b);
    return { d, e };
}
// En las diapositivas el título de la sección ya va en la cabecera: se quita el que traen las tablas
function _crNoH2(html) { return html.replace(/<h2>[\s\S]*?<\/h2>/, ''); }
function _crChunks(n, size) {
    const out = [];
    for (let a = 0; a < n; a += size) out.push([a, Math.min(n, a + size)]);
    return out.length ? out : [[0, 0]];
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  DOCUMENTOS (A4 vertical): minimal · modern · club
// ═══════════════════════════════════════════════════════════════════════════════════════════════
const CR_DOC_BASE_CSS = `
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    @media print { .no-print { display: none !important; } body { padding: 0 !important; } }
    body { margin: 0 auto; max-width: 800px; padding: 20px; line-height: 1.45; font-size: 13px; }
    .report-toolbar { position: sticky; top: 0; background: #fff; display: flex; gap: 10px; justify-content: center; padding: 12px 0; margin: -20px -20px 20px; border-bottom: 1px solid #eee; z-index: 10; }
    .report-toolbar button { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .print-btn { background: #ff6600; color: #fff; } .close-btn { background: #eee; color: #333; }
    .section { margin-bottom: 22px; page-break-inside: avoid; }
    .sessions-page { page-break-before: always; page-break-inside: auto; }
    .empty { text-align: center; color: #888; padding: 30px 0; }
    .note { white-space: pre-wrap; }
`;

const CR_THEME_CSS = {
    // ── Minimalista: blanco, tipografía ligera, líneas finísimas, sin cajas ──
    minimal: `
    @media print { @page { size: A4; margin: 1.8cm 1.8cm; } }
    body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; font-weight: 300; color: #222; }
    .hd .k { font-size: 10px; letter-spacing: 3px; color: #999; text-transform: uppercase; }
    .hd .nm { font-size: 34px; font-weight: 200; color: #111; margin: 6px 0 2px; line-height: 1.15; }
    .hd .sb { font-size: 13px; color: #888; }
    .conf { display: inline-block; margin-top: 10px; font-size: 10px; letter-spacing: 1.5px; text-transform: uppercase; color: #c62828; }
    hr.thin { border: 0; border-top: 1px solid #e6e6e6; margin: 20px 0; }
    .kp { display: flex; gap: 38px; margin: 0 0 24px; }
    .kp b { display: block; font-size: 30px; font-weight: 200; color: #111; }
    .kp span { font-size: 9.5px; letter-spacing: 1px; text-transform: uppercase; color: #999; }
    .note { border-left: 2px solid #ddd; padding: 2px 0 2px 14px; color: #666; margin-bottom: 20px; }
    .section h2 { font-size: 10px; letter-spacing: 2.5px; text-transform: uppercase; color: #999; font-weight: 400; border: 0; margin: 0 0 10px; }
    th, td { border: 0; border-bottom: 1px solid #efefef; text-align: right; padding: 7px 4px; }
    th { background: none; color: #999; font-weight: 400; font-size: 9.5px; letter-spacing: .8px; text-transform: uppercase; border-bottom: 1px solid #ddd; }
    th.left, td.left { text-align: left; }
    td.tot { background: none; font-weight: 500; }
    tr.sum td { background: none; font-weight: 500; border-top: 1px solid #ddd; }
    .bar-track { height: 4px; background: #eee; border-radius: 0; }
    .seg.train { background: #111; } .seg.game { background: #b5b5b5; }
    .bar-val { font-weight: 400; }
    .footnote { border-top: 1px solid #eee; color: #999; font-size: 10px; margin-top: 22px; padding-top: 10px; }
    `,
    // ── Moderno: banda de color, tarjetas con cifras, tabla redondeada con filas cebra ──
    modern: `
    @media print { @page { size: A4; margin: 1.3cm; } }
    body { font-family: "Segoe UI", Helvetica, Arial, sans-serif; color: #1f2a44; }
    .band { background: #1f2a44; color: #fff; padding: 26px 28px 54px; border-radius: 14px; position: relative; }
    .band .k { font-size: 10px; letter-spacing: 2px; color: #ff8a3d; font-weight: 700; text-transform: uppercase; }
    .band .nm { font-size: 28px; font-weight: 800; margin: 5px 0 2px; }
    .band .sb { font-size: 12.5px; color: #b8c2d9; }
    .band .lg { position: absolute; right: 26px; top: 24px; width: 42px; height: 42px; border-radius: 50%; background: linear-gradient(135deg, #ff6600, #ff9a4d); color: #fff; font-weight: 800; display: flex; align-items: center; justify-content: center; font-size: 14px; }
    .conf { display: inline-block; margin-top: 8px; background: #fde2e2; color: #c62828; padding: 2px 10px; border-radius: 10px; font-size: 10.5px; font-weight: 700; }
    .cards { display: flex; gap: 10px; margin: -34px 18px 20px; position: relative; }
    .card { flex: 1; background: #fff; border-radius: 12px; padding: 11px 14px; box-shadow: 0 2px 10px rgba(31,42,68,.16); }
    .card b { display: block; font-size: 22px; font-weight: 800; color: #1f2a44; } .card span { font-size: 9.5px; color: #6b7280; }
    .card.hl b { color: #ff6600; }
    .note { background: #f1f4fa; border-radius: 10px; padding: 10px 14px; margin-bottom: 18px; }
    .section h2 { font-size: 14px; color: #1f2a44; margin: 0 0 10px; border: 0; }
    .section h2::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #ff6600; margin-right: 8px; }
    table { border-collapse: separate; border-spacing: 0; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden; }
    th { background: #f1f4fa; color: #1f2a44; border: 0; font-size: 9.5px; text-transform: uppercase; letter-spacing: .4px; padding: 7px 6px; }
    td { border: 0; border-top: 1px solid #eef0f4; padding: 6px; }
    tbody tr:nth-child(even) td { background: #fafbfe; }
    td.tot { background: #fff1e6 !important; color: #c64f00; }
    tr.sum td { background: #eef1f8 !important; }
    td.c-good > strong, td.c-warn > strong, td.c-bad > strong, td.c-blue > strong, td.c-na > strong { display: inline-block; padding: 1px 9px; border-radius: 10px; }
    td.c-good > strong { background: #e3f4e6; } td.c-warn > strong { background: #ffe9d6; } td.c-bad > strong { background: #fde2e2; } td.c-blue > strong { background: #e0edff; } td.c-na > strong { background: #eceff3; }
    .bar-track { height: 14px; border-radius: 7px; background: #eef0f4; }
    .seg.train { background: linear-gradient(90deg, #ff6600, #ff9a4d); } .seg.game { background: #1f2a44; }
    .footnote { background: #f6f7fb; border-radius: 10px; padding: 10px 14px; color: #6b7280; font-size: 10px; margin-top: 18px; }
    `,
    // ── Informe de club: las tablas de siempre, más cuidadas, con puntos clave y secciones numeradas ──
    club: `
    @media print { @page { size: A4; margin: 1.5cm 1.5cm 1.9cm; @bottom-left { content: %FOOT_LEFT%; font-size: 8.5px; color: #999; } @bottom-right { content: %FOOT_PAGE%; font-size: 8.5px; color: #999; } } }
    body { font-family: Arial, sans-serif; color: #333; counter-reset: sec; }
    .hd { display: flex; align-items: center; gap: 14px; border-bottom: 3px solid #ff6600; padding-bottom: 14px; margin-bottom: 16px; }
    .hd .lg { width: 46px; height: 46px; border-radius: 50%; background: #ff6600; color: #fff; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 14px; flex: none; }
    .hd h1 { margin: 0; color: #ff6600; font-size: 22px; } .hd .nm { font-size: 15px; font-weight: 700; margin-top: 2px; }
    .hd .meta { margin-left: auto; text-align: right; font-size: 10.5px; color: #777; line-height: 1.5; }
    .conf { display: inline-block; margin-top: 4px; padding: 1px 9px; border: 1px solid #c62828; color: #c62828; border-radius: 4px; font-size: 10px; font-weight: 700; }
    .key { background: #fff4ec; border-left: 4px solid #ff6600; padding: 10px 14px; margin: 0 0 18px; font-size: 12px; line-height: 1.6; page-break-inside: avoid; }
    .key b.t { display: block; color: #c64f00; margin-bottom: 2px; }
    .note { background: #f7f7f7; border-left: 4px solid #999; padding: 10px 14px; margin-bottom: 16px; }
    .section h2 { color: #ff6600; border-bottom: 2px solid #eee; padding-bottom: 6px; font-size: 15px; margin: 0 0 11px; }
    .section h2::before { counter-increment: sec; content: counter(sec); display: inline-block; background: #ff6600; color: #fff; border-radius: 50%; width: 20px; height: 20px; line-height: 20px; text-align: center; font-size: 11px; margin-right: 8px; vertical-align: 1px; }
    tbody tr:nth-child(even) td { background: #fafafa; }
    td.left:first-child { font-weight: 600; }
    tr.peak td { background: #fff4ec !important; } tr.peak td.tot { color: #c64f00; font-size: 1.05em; }
    .footnote { border-top: 1px solid #eee; color: #777; font-size: 10.5px; margin-top: 18px; padding-top: 10px; }
    `
};

// Título de la tabla principal (en el clásico no lleva): se inserta en los estilos nuevos
function _crTitledTable(L, lang, tableHTML, S) {
    return tableHTML.replace('<div class="section"><table>', `<div class="section"><h2>${esc(S.loadTitle)}</h2><table>`);
}

// Texto seguro para un «content: "…"» de CSS (sin comillas, barras, llaves ni etiquetas)
function _crCssText(s) { return String(s).replace(/[<>"'\\{};\r\n]/g, ' '); }

function _crDocHtml(style, player, data, opts, parts, ins, kpis) {
    const { L, lang, name, range, sec, sensitive, compact, hasLoad } = parts;
    const S = CR_ST_I18N[lang];
    const flatPoints = [...ins.load, ...ins.ac, ...ins.gps, ...ins.wellness, ...ins.injuries];
    const per = _crPeriodsLabel(parts, data);

    // Carga: la tabla principal lleva título y (en «club») la semana pico resaltada
    let loadBlock;
    if (!hasLoad) loadBlock = parts.loadHTML;                      // mensaje «sin sesiones» o nada
    else {
        const table = sec.table ? _crTitledTable(L, lang, _crHtmlLoadTable(L, lang, parts.lab, data, true, ins.peakIndex), S) : '';
        loadBlock = table + (sec.chart ? parts.chartHTML : '');
    }
    const sessions = sec.sessions && hasLoad ? parts.sessionsHTML : '';
    const conf = sensitive ? `<div class="conf">${esc(L.confidential)}</div>` : '';
    const kpBlock = hasLoad && (sec.table || sec.chart) ? kpis : [];

    let head;
    if (style === 'minimal') {
        head = `<div class="hd"><div class="k">${esc(L.title)}</div><div class="nm">${esc(name)}</div><div class="sb">${esc(range)}</div>${conf}</div><hr class="thin">
            ${kpBlock.length ? `<div class="kp">${kpBlock.map(k => `<div><b>${esc(k.value)}</b><span>${esc(k.label)}</span></div>`).join('')}</div>` : ''}`;
    } else if (style === 'modern') {
        head = `<div class="band"><div class="k">${esc(L.title)}</div><div class="nm">${esc(name)}</div><div class="sb">${esc(range)} · ${per.n} ${esc(per.word)}</div>${conf}<div class="lg">${esc(_crInitials(name))}</div></div>
            ${kpBlock.length ? `<div class="cards">${kpBlock.map(k => `<div class="card${k.hl ? ' hl' : ''}"><b>${esc(k.value)}</b><span>${esc(k.label)}</span></div>`).join('')}</div>` : '<div style="height:16px"></div>'}`;
    } else {   // club
        head = `<div class="hd"><div class="lg">${esc(_crInitials(name))}</div><div><h1>${esc(L.title)}</h1><div class="nm">${esc(name)}</div>${conf}</div>
            <div class="meta">${esc(L.period)}<br><b>${esc(range)}</b><br>${esc(L.generated)}: ${esc(parts.todayLabel)}</div></div>
            ${flatPoints.length ? `<div class="key"><b class="t">${esc(S.keyPoints)}</b>${flatPoints.slice(0, 6).map(p => `• ${esc(p)}`).join('<br>')}</div>` : ''}`;
    }

    // Pie con nombre, periodo y página (cajas de margen de @page: se ignoran en navegadores que no las soportan)
    const css = CR_THEME_CSS[style]
        .replace('%FOOT_LEFT%', `"${_crCssText(name)} · ${_crCssText(range)}"`)
        .replace('%FOOT_PAGE%', `"${lang === 'es' ? 'Página ' : 'Page '}" counter(page) " / " counter(pages)`);

    return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head>
<meta charset="UTF-8">
<title>${esc(L.title)} - ${esc(name)}</title>
<style>${CR_DOC_BASE_CSS}${CR_CSS_TABLES}${css}</style>
</head>
<body class="theme-${style}${compact ? ' compact' : ''}">
${_crToolbar(L)}
${head}
${parts.noteHTML}
${loadBlock}${parts.acHTML}${parts.gpsHTML}${parts.wellHTML}${parts.injHTML}
${parts.footnoteHTML}${sessions}
</body>
</html>`;
}

// ═══════════════════════════════════════════════════════════════════════════════════════════════
//  PRESENTACIONES (16:9, 1280×720 px): slides-minimal · slides-modern · slides-staff
// ═══════════════════════════════════════════════════════════════════════════════════════════════

// Lista de diapositivas (independiente del tema): { key, title, points, body, cover? }
RPETracker.prototype._crSlideList = function(parts, data, opts, ins, kpis) {
    const { L, lang, sec, ex, hasLoad } = parts;
    const S = CR_ST_I18N[lang];
    const lab = _crLabeler(L, lang, parts.isMonths, true);        // en diapositivas, periodo y fechas siempre en una línea
    const n = data.blocks.length;
    const slides = [];
    const titled = (title, i, total) => (total > 1 ? `${title} (${i + 1}/${total})` : title);

    slides.push({ key: 'cover', cover: true });

    const wantsLoad = sec.table || sec.chart || sec.sessions;
    if (wantsLoad && !hasLoad) slides.push({ key: 'load', title: S.loadTitle, points: [], body: `<div class="empty">${esc(L.noData)}</div>` });
    if (hasLoad && (sec.table || sec.chart)) {
        slides.push({ key: 'load', title: S.summary, points: ins.load, kpis, body: '' });
    }
    if (hasLoad && sec.table) {
        const chunks = _crChunks(n, CR_SLIDE_ROWS.load);
        chunks.forEach(([a, b], i) => {
            const { d } = _crSlice(data, ex, a, b);
            slides.push({ key: 'load', title: titled(S.loadTitle, i, chunks.length), points: i === 0 ? ins.load.slice(0, 2) : [],
                body: _crHtmlLoadTable(L, lang, lab, d, i === chunks.length - 1, ins.peakIndex) });
        });
    }
    if (hasLoad && sec.chart) {
        const maxLoad = Math.max(1, ...data.blocks.map(b => b.training.load + b.game.load));
        const chunks = _crChunks(n, CR_SLIDE_ROWS.bars);
        chunks.forEach(([a, b], i) => {
            const { d } = _crSlice(data, ex, a, b);
            slides.push({ key: 'load', title: titled(L.chartTitle, i, chunks.length), points: i === 0 ? ins.load.slice(0, 2) : [],
                body: `<div class="section">${_crHtmlBars(L, lang, lab, d, maxLoad)}${_crHtmlLegend(L)}</div>` });
        });
    }
    if (sec.ac && ex.ac) {
        const chunks = _crChunks(n, CR_SLIDE_ROWS.ac);
        chunks.forEach(([a, b], i) => {
            const { d, e } = _crSlice(data, ex, a, b);
            slides.push({ key: 'ac', title: titled(L.acTitle, i, chunks.length), points: i === 0 ? ins.ac : [], body: _crNoH2(_crHtmlAc(L, lang, lab, d, e.ac)) });
        });
    }
    if (sec.gps && ex.gps) {
        const chunks = _crChunks(n, CR_SLIDE_ROWS.gps);
        chunks.forEach(([a, b], i) => {
            const { d, e } = _crSlice(data, ex, a, b);
            slides.push({ key: 'gps', title: titled(L.gpsTitle, i, chunks.length), points: i === 0 ? ins.gps : [], body: _crNoH2(_crHtmlGps(L, lang, lab, d, e.gps, i === chunks.length - 1)) });
        });
    }
    if (sec.wellness && ex.wellness) {
        const chunks = _crChunks(n, CR_SLIDE_ROWS.wellness);
        chunks.forEach(([a, b], i) => {
            const { d, e } = _crSlice(data, ex, a, b);
            slides.push({ key: 'wellness', title: titled(L.wellnessTitle, i, chunks.length), points: i === 0 ? ins.wellness : [], body: _crNoH2(_crHtmlWellness(L, lang, lab, d, e.wellness)) });
        });
    }
    if (sec.injuries && ex.availability) {
        const chunks = _crChunks(n, CR_SLIDE_ROWS.avail);
        chunks.forEach(([a, b], i) => {
            const { d, e } = _crSlice(data, ex, a, b);
            slides.push({ key: 'injuries', title: titled(L.availTitle, i, chunks.length), points: i === 0 ? ins.injuries : [],
                body: `<div class="section">${_crHtmlAvailTable(L, lang, lab, d, e.availability)}</div>` });
        });
        const inj = ex.injuries || [];
        const ichunks = _crChunks(inj.length, CR_SLIDE_ROWS.inj);
        ichunks.forEach(([a, b], i) => {
            slides.push({ key: 'injuries', title: titled(L.injuriesTitle, i, ichunks.length), points: [],
                body: `<div class="section">${_crHtmlInjuryTable(L, lang, inj.slice(a, b))}</div>` });
        });
    }
    if (sec.sessions && hasLoad) {
        const chunks = _crChunks(data.sessions.length, CR_SLIDE_ROWS.sessions);
        chunks.forEach(([a, b], i) => {
            slides.push({ key: 'sessions', title: titled(L.sessionsTitle, i, chunks.length), points: [],
                body: `<div class="section"><table class="list">${_crHtmlSessionsHead(L)}<tbody>${_crHtmlSessionRows(L, lang, data.sessions.slice(a, b))}</tbody></table></div>` });
        });
    }
    // Notas y definiciones al final
    const notes = _crFootnoteLines(L, lang, sec, ex);
    slides.push({ key: 'notes', title: S.notesTitle, points: [], body: `<div class="notes">${notes.map(x => `<p>${esc(x)}</p>`).join('')}<p>${esc(L.generated)}: ${esc(parts.todayLabel)}</p></div>` });
    return slides;
};

const CR_SLIDE_BASE_CSS = `
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    @page { size: 1280px 720px; margin: 0; }
    html, body { margin: 0; padding: 0; }
    body { font-family: "Helvetica Neue", Helvetica, Arial, sans-serif; background: #8a8f98; }
    .report-toolbar { position: sticky; top: 0; background: #fff; display: flex; gap: 10px; justify-content: center; padding: 12px 0; border-bottom: 1px solid #eee; z-index: 10; }
    .report-toolbar button { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .print-btn { background: #ff6600; color: #fff; } .close-btn { background: #eee; color: #333; }
    .slide { width: 1280px; height: 720px; position: relative; overflow: hidden; background: #fff; margin: 18px auto; box-shadow: 0 4px 18px rgba(0,0,0,.35); zoom: var(--z, 1); break-after: page; page-break-after: always; }
    @media print { body { background: #fff; } .no-print { display: none !important; } .slide { margin: 0; box-shadow: none; zoom: 1 !important; } .slide:last-child { break-after: auto; page-break-after: auto; } }
    .sl-body { position: absolute; left: 0; right: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 18px; }
    th, td { padding: 8px 9px; text-align: center; border: 1px solid #ddd; }
    td.left, th.left { text-align: left; }
    td.nowrap { white-space: nowrap; } .dates { font-size: 14px; color: #888; }
    thead { display: table-header-group; } tr { break-inside: avoid; }
    .c-good { color: #2e7d32; } .c-warn { color: #e65100; } .c-bad { color: #c62828; } .c-blue { color: #1565c0; } .c-na { color: #888; }
    .muted { color: #777; font-style: italic; } .empty { text-align: center; color: #888; padding: 120px 0; font-size: 24px; }
    .bar-row { display: flex; align-items: center; gap: 16px; margin: 12px 0; } .bar-label { width: 250px; font-size: 16px; white-space: nowrap; } .bar-val { width: 90px; text-align: right; font-weight: 700; font-size: 17px; }
    .bar-track { flex: 1; height: 26px; border-radius: 6px; display: flex; overflow: hidden; } .seg { display: block; height: 100%; }
    .legend { display: flex; gap: 26px; margin-top: 16px; font-size: 15px; } .legend i { display: inline-block; width: 15px; height: 15px; margin-right: 8px; vertical-align: -2px; border-radius: 3px; }
    .notes p { font-size: 18px; line-height: 1.55; margin: 0 0 14px; }
    .kpis { display: flex; gap: 22px; } .kpi b { display: block; line-height: 1.05; } .kpi span { display: block; }
    .conf-tag { font-weight: 700; letter-spacing: 1px; }
    .cover-note { white-space: pre-wrap; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
`;

const CR_SLIDE_THEME_CSS = {
    // ── Presentación minimalista ──
    'slides-minimal': `
    .slide { background: #fff; color: #222; font-weight: 300; }
    .cover { padding: 120px 120px; }
    .cover .k { font-size: 20px; letter-spacing: 7px; color: #999; }
    .cover .big { font-size: 96px; font-weight: 200; color: #111; margin: 20px 0 10px; line-height: 1.08; } .cover .big.lg { font-size: 70px; } .cover .big.xl { font-size: 54px; }
    .cover .sub { font-size: 30px; color: #777; }
    .cover .ln { width: 90px; height: 5px; background: #ff6600; margin: 44px 0; }
    .cover .meta { font-size: 18px; color: #aaa; }
    .cover .cover-note { margin-top: 24px; font-size: 20px; color: #777; max-width: 900px; }
    .sl-h { position: absolute; left: 90px; right: 90px; top: 56px; }
    .sl-h h2 { margin: 0; font-size: 46px; font-weight: 300; color: #111; }
    .sl-h p { margin: 10px 0 0; font-size: 22px; color: #888; }
    .sl-body { left: 90px; right: 90px; top: 170px; bottom: 80px; }
    th { border: 0; border-bottom: 1px solid #ccc; background: none; color: #999; font-weight: 400; font-size: 13px; letter-spacing: 1.2px; text-transform: uppercase; text-align: right; }
    td { border: 0; border-bottom: 1px solid #eee; text-align: right; font-weight: 300; font-size: 17px; }
    th.left, td.left { text-align: left; }
    td.tot { font-weight: 600; background: none; } tr.sum td { font-weight: 600; border-top: 1px solid #ccc; } tr.avg td { color: #999; font-style: italic; }
    tr.peak td.tot { color: #ff6600; }
    .bar-track { background: #eee; height: 8px; border-radius: 4px; } .seg.train { background: #111; } .seg.game { background: #b5b5b5; }
    .kpis { gap: 70px; margin-top: 30px; } .kpi b { font-size: 76px; font-weight: 200; color: #111; } .kpi span { font-size: 15px; letter-spacing: 1.5px; text-transform: uppercase; color: #999; margin-top: 8px; }
    .pts { margin-top: 44px; font-size: 22px; color: #555; line-height: 1.7; } .pts li { margin-bottom: 4px; }
    .sl-f { position: absolute; left: 90px; right: 90px; bottom: 28px; display: flex; justify-content: space-between; font-size: 14px; color: #bbb; }
    .sl-f .conf-tag { color: #c62828; }
    .notes p { color: #666; font-weight: 300; }
    `,
    // ── Presentación moderna (fondo oscuro) ──
    'slides-modern': `
    .slide { background: #14213d; color: #fff; }
    .slide.cover-s { background: linear-gradient(135deg, #14213d, #1f2a44); }
    .cover .circ { position: absolute; right: -140px; top: -140px; width: 560px; height: 560px; border-radius: 50%; background: linear-gradient(135deg, #ff6600, #ff9a4d); }
    .cover .circ2 { position: absolute; right: 120px; bottom: -180px; width: 360px; height: 360px; border-radius: 50%; background: #2a3a5e; }
    .cover .inner { position: absolute; left: 100px; top: 0; bottom: 0; max-width: 720px; display: flex; flex-direction: column; justify-content: center; }
    .cover .k { font-size: 20px; letter-spacing: 6px; color: #ff8a3d; font-weight: 700; }
    .cover .big { font-size: 88px; font-weight: 800; margin: 22px 0 22px; line-height: 1.03; } .cover .big.lg { font-size: 64px; } .cover .big.xl { font-size: 50px; }
    .cover .pill { display: inline-block; align-self: flex-start; background: #ff6600; border-radius: 30px; padding: 10px 30px; font-size: 26px; font-weight: 700; }
    .cover .meta { margin-top: 28px; font-size: 18px; color: #9fb0d3; }
    .cover .cover-note { margin-top: 20px; font-size: 20px; color: #b8c2d9; max-width: 700px; }
    .sl-h { position: absolute; left: 80px; right: 80px; top: 48px; }
    .sl-h h2 { margin: 0; font-size: 44px; font-weight: 800; } .sl-h p { margin: 8px 0 0; font-size: 21px; color: #9fb0d3; }
    .sl-body { left: 80px; right: 80px; top: 160px; bottom: 80px; }
    th { background: #2a3a5e; color: #c9d4ee; border: 0; font-size: 13px; text-transform: uppercase; letter-spacing: .8px; }
    td { border: 0; border-bottom: 1px solid rgba(255,255,255,.12); color: #fff; }
    td.tot { background: rgba(255,102,0,.18); color: #ffb27a; font-weight: 700; } tr.sum td { background: #2a3a5e; font-weight: 700; } tr.avg td { color: #9fb0d3; font-style: italic; }
    tr.peak td.tot { background: #ff6600; color: #fff; }
    .dates { color: #9fb0d3; }
    .c-good { color: #6fdc8c; } .c-warn { color: #ffb454; } .c-bad { color: #ff8a8a; } .c-blue { color: #8fc0ff; } .c-na { color: #9fb0d3; }
    .bar-track { background: #2a3a5e; height: 28px; border-radius: 14px; } .seg.train { background: linear-gradient(90deg, #ff6600, #ff9a4d); } .seg.game { background: #7f93c4; }
    .legend { color: #c9d4ee; }
    .kpis { gap: 20px; margin-top: 10px; } .kpi { flex: 1; background: #2a3a5e; border-radius: 22px; padding: 26px 28px; } .kpi b { font-size: 64px; font-weight: 800; } .kpi.hl b { color: #ff9a4d; } .kpi span { font-size: 17px; color: #9fb0d3; margin-top: 8px; }
    .pts { margin-top: 34px; font-size: 22px; color: #d6def2; line-height: 1.7; } .pts li { margin-bottom: 4px; }
    .sl-f { position: absolute; left: 80px; right: 80px; bottom: 26px; display: flex; justify-content: space-between; font-size: 14px; color: #7f93c4; }
    .sl-f .conf-tag { color: #ff8a8a; }
    .empty, .notes p { color: #c9d4ee; } .muted { color: #9fb0d3; }
    `,
    // ── Presentación cuerpo técnico: menú lateral, tabla/gráfico y franja de puntos clave ──
    'slides-staff': `
    .slide { background: #fff; color: #2c3e50; }
    .cover .pan { position: absolute; left: 0; top: 0; bottom: 0; width: 38%; background: #ff6600; color: #fff; display: flex; flex-direction: column; justify-content: center; padding: 0 70px; }
    .cover .pan b { font-size: 230px; font-weight: 800; line-height: .85; } .cover .pan span { font-size: 40px; letter-spacing: 12px; font-weight: 700; margin-top: 18px; }
    .cover .rt { position: absolute; left: 38%; top: 0; right: 0; bottom: 0; padding: 0 90px; display: flex; flex-direction: column; justify-content: center; }
    .cover .k { font-size: 20px; letter-spacing: 6px; color: #ff6600; font-weight: 700; }
    .cover .big { font-size: 72px; font-weight: 800; color: #2c3e50; margin: 16px 0 10px; line-height: 1.08; } .cover .big.lg { font-size: 56px; } .cover .big.xl { font-size: 46px; }
    .cover .sub { font-size: 28px; color: #777; } .cover .meta { margin-top: 26px; font-size: 18px; color: #999; }
    .cover .cover-note { margin-top: 22px; font-size: 20px; color: #666; }
    .side { position: absolute; left: 0; top: 0; bottom: 0; width: 230px; background: #2c3e50; color: #9fb0c3; padding: 44px 22px; }
    .side .who { color: #fff; font-weight: 800; font-size: 19px; line-height: 1.25; margin-bottom: 4px; } .side .per { font-size: 13px; color: #8fa1b5; margin-bottom: 34px; }
    .side .it { padding: 12px 14px; border-radius: 9px; margin-bottom: 7px; font-size: 18px; } .side .it.on { background: #ff6600; color: #fff; font-weight: 700; }
    .sl-h { position: absolute; left: 280px; right: 60px; top: 38px; } .sl-h h2 { margin: 0; font-size: 38px; color: #2c3e50; font-weight: 800; }
    .sl-body { left: 280px; right: 60px; top: 112px; bottom: 150px; }
    th { background: #f4f4f4; color: #2c3e50; } tbody tr:nth-child(even) td { background: #fafafa; } td.left:first-child { font-weight: 700; }
    td.tot { background: #fff4ec; font-weight: 700; } tr.sum td { background: #f4f4f4; font-weight: 800; } tr.avg td { color: #777; font-style: italic; }
    tr.peak td { background: #fff4ec !important; } tr.peak td.tot { color: #c64f00; }
    .bar-track { background: #f0f0f0; height: 24px; border-radius: 5px; } .seg.train { background: #ff6600; } .seg.game { background: #2c3e50; }
    .kpis { gap: 18px; } .kpi { flex: 1; background: #fff4ec; border-left: 6px solid #ff6600; padding: 22px 24px; border-radius: 6px; } .kpi b { font-size: 58px; font-weight: 800; color: #2c3e50; } .kpi span { font-size: 16px; color: #777; margin-top: 6px; }
    .strip { position: absolute; left: 280px; right: 60px; bottom: 56px; min-height: 76px; background: #fff4ec; border-left: 6px solid #ff6600; padding: 12px 20px; font-size: 18px; line-height: 1.5; border-radius: 4px; }
    .strip b { color: #c64f00; }
    .sl-f { position: absolute; left: 280px; right: 60px; bottom: 20px; display: flex; justify-content: space-between; font-size: 13px; color: #aaa; }
    .sl-f .conf-tag { color: #c62828; }
    `
};

function _crSlideHtml(style, parts, data, desc, idx, total, ctx) {
    const { L, lang, name, range, sensitive } = parts;
    const S = CR_ST_I18N[lang];
    const conf = sensitive ? `<span class="conf-tag">${esc(S.confidentialShort)}</span>` : '<span></span>';
    const pageNo = `${idx} / ${total}`;
    const per = _crPeriodsLabel(parts, data);
    const nameCls = name.length > 34 ? ' xl' : name.length > 22 ? ' lg' : '';

    if (desc.cover) {
        const noteHTML = parts.noteText ? `<div class="cover-note">${esc(parts.noteText)}</div>` : '';
        const confHTML = sensitive ? `<div class="conf-tag" style="margin-top:18px;font-size:16px;color:#e53935">${esc(L.confidential)}</div>` : '';
        if (style === 'slides-minimal') {
            return `<section class="slide cover"><div class="k">${esc(L.title.toUpperCase())}</div><div class="big${nameCls}">${esc(name)}</div><div class="sub">${esc(range)} · ${per.n} ${esc(per.word)}</div><div class="ln"></div><div class="meta">${esc(L.generated)}: ${esc(parts.todayLabel)}</div>${noteHTML}${confHTML}</section>`;
        }
        if (style === 'slides-modern') {
            return `<section class="slide cover cover-s"><div class="circ"></div><div class="circ2"></div><div class="inner"><div class="k">${esc(L.title.toUpperCase())}</div><div class="big${nameCls}">${esc(name)}</div><span class="pill">${esc(range)}</span><div class="meta">${per.n} ${esc(per.word)} · ${esc(L.generated)}: ${esc(parts.todayLabel)}</div>${noteHTML}${confHTML}</div></section>`;
        }
        return `<section class="slide cover"><div class="pan"><b>${per.n}</b><span>${esc(per.word.toUpperCase())}</span></div><div class="rt"><div class="k">${esc(L.title.toUpperCase())}</div><div class="big${nameCls}">${esc(name)}</div><div class="sub">${esc(range)}</div><div class="meta">${esc(L.generated)}: ${esc(parts.todayLabel)}</div>${noteHTML}${confHTML}</div></section>`;
    }

    const pts = (desc.points || []).filter(Boolean);
    let inner;
    if (desc.kpis) {
        const cards = `<div class="kpis">${desc.kpis.map(k => `<div class="kpi${k.hl ? ' hl' : ''}"><b>${esc(k.value)}</b><span>${esc(k.label)}</span></div>`).join('')}</div>`;
        inner = `${cards}${style === 'slides-staff' ? '' : `<ul class="pts">${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>`}`;
    } else inner = desc.body;

    if (style === 'slides-staff') {
        const keys = ['load', 'ac', 'gps', 'wellness', 'injuries', 'sessions'].filter(k => ctx.keys.has(k));
        const side = `<div class="side"><div class="who">${esc(name)}</div><div class="per">${esc(range)}</div>${keys.map(k => `<div class="it${k === desc.key ? ' on' : ''}">${esc(S.nav[k])}</div>`).join('')}</div>`;
        const strip = pts.length ? `<div class="strip"><b>${esc(S.keyPoints)}</b> · ${pts.slice(0, 3).map(esc).join(' · ')}</div>` : '';
        const withKpiPts = desc.kpis ? `<ul class="pts" style="margin-top:34px;font-size:20px;line-height:1.7;color:#555">${pts.map(p => `<li>${esc(p)}</li>`).join('')}</ul>` : '';
        return `<section class="slide data">${side}<div class="sl-h"><h2>${esc(desc.title)}</h2></div><div class="sl-body">${inner}${withKpiPts}</div>${desc.kpis ? '' : strip}<div class="sl-f">${conf}<span>${pageNo}</span></div></section>`;
    }
    const sub = !desc.kpis && pts.length ? `<p>${esc(pts[0])}</p>` : '';
    return `<section class="slide data"><div class="sl-h"><h2>${esc(desc.title)}</h2>${sub}</div><div class="sl-body">${inner}</div><div class="sl-f"><span>${esc(name)} · ${esc(range)}</span>${conf}<span>${pageNo}</span></div></section>`;
}

function _crSlidesDoc(style, player, data, opts, parts, ins, kpis, self) {
    const { L } = parts;
    const list = self._crSlideList(parts, data, opts, ins, kpis);
    const ctx = { keys: new Set(list.map(s => s.key)) };
    const slides = list.map((d, i) => _crSlideHtml(style, parts, data, d, i + 1, list.length, ctx)).join('\n');
    return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head>
<meta charset="UTF-8">
<title>${esc(L.title)} - ${esc(parts.name)}</title>
<style>${CR_SLIDE_BASE_CSS}${CR_SLIDE_THEME_CSS[style]}</style>
</head>
<body class="theme-${style}">
${_crToolbar(L)}
${slides}
<script>(function(){function f(){document.documentElement.style.setProperty('--z',Math.min(1,(window.innerWidth-32)/1280));}f();window.addEventListener('resize',f);}());</script>
</body>
</html>`;
}

// ── Entrada única desde custom-report.js ─────────────────────────────────────────────────────────────
RPETracker.prototype._crRenderStyled = function(style, player, data, opts, parts) {
    const ins = this._crInsights(parts, data);
    const kpis = this._crKpis(parts, data);
    if (CR_STYLES[style] && CR_STYLES[style].kind === 'slides') return _crSlidesDoc(style, player, data, opts, parts, ins, kpis, this);
    return _crDocHtml(style, player, data, opts, parts, ins, kpis);
};

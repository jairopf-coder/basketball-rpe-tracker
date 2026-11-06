// BasketballRPE-Web — custom-report.js
// «Informe personalizado» de carga de una jugadora: cualquier periodo, agrupado por semanas o meses,
// en español o inglés, con las secciones que se elijan (tabla resumen, gráfico, lista de sesiones).
//
//  · Solo CARGA de entrenamiento y de partido. El gimnasio no entra nunca. No incluye wellness,
//    lesiones ni notas de sesión (la fase 2 añadirá esas secciones como opcionales y marcadas como sensibles).
//  · «Entrenamiento» = sesiones de tipo training + shooting. «Partido» = match.
//  · Carga (AU) = RPE × minutos de esa jugadora en esa sesión (igual que en el resto de la app).
//  · Semanas = bloques de 7 días contados desde la fecha inicial; el último puede ser más corto y
//    se imprime con sus fechas reales. Meses = meses naturales (el primero y el último pueden ser parciales).
//
// Se abre desde el menú de informes de la jugadora (pdf-reports.js → showPlayerReportMenu).
// Expone: RPETracker.prototype.showCustomReportDialog / generateCustomReport
//          RPETracker.prototype.buildCustomReportData / buildCustomReportWarnings / buildCustomReportHTML
//          (y los auxiliares _cr*)
// Depende de: security.js (esc), app-players.js (playerFullName, playerDisplayName),
//             app.js (ensureFullSessionHistory, showToast, Store.getActiveSeason)

'use strict';

const CR_TRAINING_TYPES = ['training', 'shooting'];
const CR_GAME_TYPE      = 'match';
const CR_MAX_RANGE_DAYS = 800;     // ~2 años: evita informes interminables por un error al teclear una fecha

// Qué se marca y en qué idioma según para quién es el informe (fase 1: solo secciones de carga)
const CR_PRESETS = {
    selection: { lang: 'en', period: '4w', group: 'weeks', sections: { table: true, chart: true, sessions: false } },
    newteam:   { lang: 'en', period: 'season', group: 'weeks', sections: { table: true, chart: true, sessions: true } },
    player:    { lang: 'es', period: '4w', group: 'weeks', sections: { table: true, chart: true, sessions: false } }
};

const CR_I18N = {
    en: {
        htmlLang: 'en', title: 'Workload overview', player: 'Player', period: 'Period', generated: 'Generated',
        week: 'Week', month: 'Month', training: 'Training', games: 'Games', total: 'Total',
        sessions: 'Sessions', gamesN: 'Games', minutes: 'Minutes', load: 'Load (AU)', avgRpe: 'Avg RPE',
        totalRow: 'Total', avgRow: 'Average per 7 days',
        chartTitle: 'Load by period (AU)', legendTraining: 'Training', legendGame: 'Games',
        sessionsTitle: 'Session list', date: 'Date', type: 'Type', rpe: 'RPE',
        typeTraining: 'Training', typeShooting: 'Shooting', typeMatch: 'Game',
        noData: 'No sessions recorded in this period.', contextTitle: 'Context',
        definitions: 'Load (AU, arbitrary units) = session RPE × minutes. "Training" includes court training and shooting sessions; "Games" are the sessions recorded as matches. Minutes are those recorded for the player in each session. Average RPE is the mean of the session RPE values.',
        print: 'Print / Save as PDF', close: 'Close',
        months: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
        thousands: ',', decimal: '.'
    },
    es: {
        htmlLang: 'es', title: 'Resumen de carga', player: 'Jugadora', period: 'Periodo', generated: 'Generado',
        week: 'Semana', month: 'Mes', training: 'Entrenamiento', games: 'Partidos', total: 'Total',
        sessions: 'Sesiones', gamesN: 'Partidos', minutes: 'Minutos', load: 'Carga (UA)', avgRpe: 'RPE medio',
        totalRow: 'Total', avgRow: 'Media por 7 días',
        chartTitle: 'Carga por periodo (UA)', legendTraining: 'Entrenamiento', legendGame: 'Partidos',
        sessionsTitle: 'Lista de sesiones', date: 'Fecha', type: 'Tipo', rpe: 'RPE',
        typeTraining: 'Entrenamiento', typeShooting: 'Tiro', typeMatch: 'Partido',
        noData: 'No hay sesiones registradas en este periodo.', contextTitle: 'Contexto',
        definitions: 'Carga (UA, unidades arbitrarias) = RPE de la sesión × minutos. «Entrenamiento» incluye las sesiones de pista y de tiro; «Partidos» son las sesiones registradas como partido. Los minutos son los registrados para la jugadora en cada sesión. El RPE medio es la media de los RPE de las sesiones.',
        print: 'Imprimir / Guardar como PDF', close: 'Cerrar',
        months: ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'],
        thousands: '.', decimal: ','
    }
};

// ── Fechas (todo en texto ISO «AAAA-MM-DD» y en hora local, sin saltos por el cambio de hora) ──────────
function _crParseISO(iso) {
    const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
}
function _crAddDays(iso, n) {
    const d = _crParseISO(iso);
    d.setDate(d.getDate() + n);
    return toLocalISODate(d);
}
function _crDiffDays(a, b) { return Math.round((_crParseISO(b) - _crParseISO(a)) / 86400000); }
function _crIsISO(s) { return /^\d{4}-\d{2}-\d{2}$/.test(String(s || '')); }

function _crFmtDay(iso, lang) {   // «10 Oct»
    const L = CR_I18N[lang] || CR_I18N.en, d = _crParseISO(iso);
    return `${d.getDate()} ${L.months[d.getMonth()]}`;
}
function _crFmtDate(iso, lang) {  // «10 Oct 2026»
    return `${_crFmtDay(iso, lang)} ${_crParseISO(iso).getFullYear()}`;
}
function _crNum(n, lang) {
    const L = CR_I18N[lang] || CR_I18N.en;
    return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, L.thousands);
}
function _crDec(n, lang) {
    const L = CR_I18N[lang] || CR_I18N.en;
    return (Math.round(n * 10) / 10).toFixed(1).replace('.', L.decimal);
}

// Rango de fechas de cada atajo de periodo, terminando en `to` (inclusive)
// @returns { from, to } | null cuando el periodo es libre o no tiene sentido
function _crPeriodRange(kind, to, seasonStart) {
    if (kind === '3w') return { from: _crAddDays(to, -20), to };
    if (kind === '4w') return { from: _crAddDays(to, -27), to };
    if (kind === 'month') {
        const d = _crParseISO(to);
        d.setMonth(d.getMonth() - 1);
        return { from: _crAddDays(toLocalISODate(d), 1), to };
    }
    if (kind === 'season' && seasonStart) return { from: seasonStart, to };
    return null;
}

// Bloques consecutivos que cubren exactamente [from, to]
function _crBuildBlocks(from, to, group) {
    const blocks = [];
    let cur = from;
    while (cur <= to) {
        let end;
        if (group === 'months') {
            const d = _crParseISO(cur);
            const lastOfMonth = toLocalISODate(new Date(d.getFullYear(), d.getMonth() + 1, 0));
            end = lastOfMonth < to ? lastOfMonth : to;
        } else {
            const e = _crAddDays(cur, 6);
            end = e < to ? e : to;
        }
        blocks.push({ from: cur, to: end });
        cur = _crAddDays(end, 1);
    }
    return blocks;
}

// ── Validación de lo elegido en el diálogo (pura, para poder probarla) ───────────────────────────────
// @returns '' si todo está bien, o el texto del problema
function _crValidate(opts) {
    if (!opts || !_crIsISO(opts.from) || !_crIsISO(opts.to)) return 'Selecciona un rango de fechas';
    if (opts.from > opts.to) return 'La fecha «desde» no puede ser posterior a «hasta»';
    if (_crDiffDays(opts.from, opts.to) + 1 > CR_MAX_RANGE_DAYS) return 'El rango máximo es de unos 2 años';
    const s = opts.sections || {};
    if (!s.table && !s.chart && !s.sessions) return 'Selecciona al menos una sección';
    return '';
}

// ── Datos del informe ─────────────────────────────────────────────────────────────────────────────────
function _crBucket() { return { sessions: 0, minutes: 0, load: 0, rpeSum: 0 }; }
function _crAdd(b, minutes, load, rpe) { b.sessions += 1; b.minutes += minutes; b.load += load; b.rpeSum += rpe; }
function _crSumBuckets(a, b) {
    return { sessions: a.sessions + b.sessions, minutes: a.minutes + b.minutes, load: a.load + b.load, rpeSum: a.rpeSum + b.rpeSum };
}

// @param opts { from, to, group: 'weeks'|'months' }
RPETracker.prototype.buildCustomReportData = function(playerId, opts) {
    const { from, to } = opts;
    const group = opts.group === 'months' ? 'months' : 'weeks';
    const blocks = _crBuildBlocks(from, to, group).map((b, i) => ({
        index: i + 1, from: b.from, to: b.to, training: _crBucket(), game: _crBucket()
    }));
    const list = [];

    (this.sessions || []).forEach(s => {
        if (s.playerId !== playerId) return;
        const date = String(s.date || '').slice(0, 10);
        if (date < from || date > to) return;
        const isGame = s.type === CR_GAME_TYPE;
        if (!isGame && !CR_TRAINING_TYPES.includes(s.type)) return;   // el gimnasio y cualquier otro tipo quedan fuera
        const rpe = Number(s.rpe);
        if (s.rpe === null || s.rpe === undefined || s.rpe === '' || !Number.isFinite(rpe)) return;
        // Misma convención que el resto de la app: sin minutos se asumen 60; sin carga guardada, RPE × minutos
        const minutes = Number(s.duration) > 0 ? Number(s.duration) : 60;
        const load = Number(s.load) > 0 ? Number(s.load) : rpe * minutes;
        const block = blocks.find(b => date >= b.from && date <= b.to);
        _crAdd(isGame ? block.game : block.training, minutes, load, rpe);
        list.push({ date, type: s.type, minutes, rpe, load });
    });

    const trainingTotal = blocks.reduce((acc, b) => _crSumBuckets(acc, b.training), _crBucket());
    const gameTotal     = blocks.reduce((acc, b) => _crSumBuckets(acc, b.game), _crBucket());
    const all = _crSumBuckets(trainingTotal, gameTotal);
    const days = _crDiffDays(from, to) + 1;

    return {
        from, to, days, group, blocks,
        totals: { training: trainingTotal, game: gameTotal, all },
        // Media por cada 7 días del periodo (no por bloque: el último bloque puede ser más corto)
        avgPer7: { sessions: all.sessions * 7 / days, minutes: all.minutes * 7 / days, load: all.load * 7 / days },
        sessions: list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    };
};

// Partidos del periodo en los que TODAS las jugadoras tienen los mismos minutos (3 o más jugadoras):
// señal de que no se individualizaron los minutos y la carga de esta jugadora puede estar inflada.
RPETracker.prototype.buildCustomReportWarnings = function(playerId, from, to) {
    const byDate = {};
    (this.sessions || []).forEach(s => {
        if (s.type !== CR_GAME_TYPE) return;
        const date = String(s.date || '').slice(0, 10);
        if (date < from || date > to) return;
        (byDate[date] = byDate[date] || []).push(s);
    });
    const out = [];
    Object.keys(byDate).sort().forEach(date => {
        const list = byDate[date];
        if (!list.some(s => s.playerId === playerId)) return;
        const mins = list.map(s => Number(s.duration));
        if (list.length >= 3 && mins.every(m => m === mins[0])) out.push({ date, minutes: mins[0], players: list.length });
    });
    return out;
};

// ── PDF (HTML que se abre en una ventana para imprimir / guardar como PDF) ────────────────────────────
// @param opts { lang, group, sections: {table, chart, sessions}, note }
RPETracker.prototype.buildCustomReportHTML = function(player, data, opts) {
    const lang = CR_I18N[opts.lang] ? opts.lang : 'en';
    const L = CR_I18N[lang];
    const sec = opts.sections || {};
    const name = this.playerFullName(player);
    const isMonths = data.group === 'months';
    const range = `${_crFmtDate(data.from, lang)} – ${_crFmtDate(data.to, lang)}`;
    const todayLabel = _crFmtDate(toLocalISODate(new Date()), lang);
    const hasData = data.totals.all.sessions > 0;

    const blockLabel = b => isMonths
        ? `${L.months[_crParseISO(b.from).getMonth()]} ${_crParseISO(b.from).getFullYear()}`
        : `${L.week} ${b.index}`;
    const blockDates = b => (b.from === b.to ? _crFmtDay(b.from, lang) : `${_crFmtDay(b.from, lang)} – ${_crFmtDay(b.to, lang)}`);
    const rpeAvg = bucket => (bucket.sessions ? _crDec(bucket.rpeSum / bucket.sessions, lang) : '–');
    const cell = (n, bucketSessions) => (bucketSessions ? _crNum(n, lang) : '–');

    const rows = data.blocks.map(b => {
        const t = b.training, g = b.game, all = _crSumBuckets(t, g);
        return `<tr>
            <td class="left"><strong>${esc(blockLabel(b))}</strong><br><span class="dates">${esc(blockDates(b))}</span></td>
            <td>${cell(t.sessions, t.sessions)}</td><td>${cell(t.minutes, t.sessions)}</td><td>${cell(t.load, t.sessions)}</td>
            <td>${cell(g.sessions, g.sessions)}</td><td>${cell(g.minutes, g.sessions)}</td><td>${cell(g.load, g.sessions)}</td>
            <td class="tot">${cell(all.load, all.sessions)}</td><td>${rpeAvg(all)}</td>
        </tr>`;
    }).join('');

    const T = data.totals;
    const totalRow = `<tr class="sum">
        <td class="left">${esc(L.totalRow)}</td>
        <td>${_crNum(T.training.sessions, lang)}</td><td>${_crNum(T.training.minutes, lang)}</td><td>${_crNum(T.training.load, lang)}</td>
        <td>${_crNum(T.game.sessions, lang)}</td><td>${_crNum(T.game.minutes, lang)}</td><td>${_crNum(T.game.load, lang)}</td>
        <td class="tot">${_crNum(T.all.load, lang)}</td><td>${rpeAvg(T.all)}</td></tr>`;
    const avgRow = `<tr class="avg">
        <td class="left">${esc(L.avgRow)}</td>
        <td colspan="2"></td><td></td><td colspan="2"></td><td></td>
        <td class="tot">${_crNum(data.avgPer7.load, lang)}</td><td></td></tr>`;

    const tableHTML = `<div class="section"><table>
        <thead>
            <tr><th rowspan="2" class="left">${esc(isMonths ? L.month : L.week)}</th>
                <th colspan="3">${esc(L.training)}</th><th colspan="3">${esc(L.games)}</th><th colspan="2">${esc(L.total)}</th></tr>
            <tr><th>${esc(L.sessions)}</th><th>${esc(L.minutes)}</th><th>${esc(L.load)}</th>
                <th>${esc(L.gamesN)}</th><th>${esc(L.minutes)}</th><th>${esc(L.load)}</th>
                <th>${esc(L.load)}</th><th>${esc(L.avgRpe)}</th></tr>
        </thead>
        <tbody>${rows}${totalRow}${avgRow}</tbody></table></div>`;

    const maxLoad = Math.max(1, ...data.blocks.map(b => b.training.load + b.game.load));
    const bars = data.blocks.map(b => {
        const tw = (b.training.load / maxLoad * 100).toFixed(1), gw = (b.game.load / maxLoad * 100).toFixed(1);
        return `<div class="bar-row">
            <div class="bar-label">${esc(blockLabel(b))}<br><span class="dates">${esc(blockDates(b))}</span></div>
            <div class="bar-track"><span class="seg train" style="width:${tw}%"></span><span class="seg game" style="width:${gw}%"></span></div>
            <div class="bar-val">${_crNum(b.training.load + b.game.load, lang)}</div></div>`;
    }).join('');
    const chartHTML = `<div class="section"><h2>${esc(L.chartTitle)}</h2>${bars}
        <div class="legend"><span><i class="seg train"></i>${esc(L.legendTraining)}</span><span><i class="seg game"></i>${esc(L.legendGame)}</span></div></div>`;

    const typeLabel = t => (t === CR_GAME_TYPE ? L.typeMatch : t === 'shooting' ? L.typeShooting : L.typeTraining);
    // La lista de sesiones empieza en página aparte solo si hay tabla o gráfico antes
    const sessionsHTML = `<div class="section${sec.table || sec.chart ? ' sessions-page' : ''}"><h2>${esc(L.sessionsTitle)}</h2>
        <table class="list"><thead><tr><th class="left">${esc(L.date)}</th><th class="left">${esc(L.type)}</th>
            <th>${esc(L.minutes)}</th><th>${esc(L.rpe)}</th><th>${esc(L.load)}</th></tr></thead><tbody>
        ${data.sessions.map(s => `<tr><td class="left">${esc(_crFmtDate(s.date, lang))}</td><td class="left">${esc(typeLabel(s.type))}</td>
            <td>${_crNum(s.minutes, lang)}</td><td>${_crDec(s.rpe, lang)}</td><td>${_crNum(s.load, lang)}</td></tr>`).join('')}
        </tbody></table></div>`;

    // Definiciones y fecha: van en la primera página, debajo de la tabla y el gráfico
    const footnoteHTML = `<div class="footnote">${esc(L.definitions)}<br>${esc(L.generated)}: ${esc(todayLabel)}</div>`;

    const noteText = String(opts.note || '').trim();
    const noteHTML = noteText ? `<div class="note"><strong>${esc(L.contextTitle)}</strong><br>${esc(noteText)}</div>` : '';

    return `<!DOCTYPE html>
<html lang="${L.htmlLang}">
<head>
<meta charset="UTF-8">
<title>${esc(L.title)} - ${esc(name)}</title>
<style>
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; box-sizing: border-box; }
    @media print { @page { size: A4; margin: 1.5cm; } .no-print { display: none !important; } body { padding: 0 !important; } }
    body { font-family: Arial, sans-serif; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; line-height: 1.45; font-size: 13px; }
    .report-toolbar { position: sticky; top: 0; background: #fff; display: flex; gap: 10px; justify-content: center; padding: 12px 0; margin: -20px -20px 20px; border-bottom: 1px solid #eee; z-index: 10; }
    .report-toolbar button { padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
    .print-btn { background: #ff6600; color: #fff; } .close-btn { background: #eee; color: #333; }
    .header { text-align: center; border-bottom: 3px solid #ff6600; padding-bottom: 14px; margin-bottom: 20px; }
    .header h1 { color: #ff6600; margin: 0; font-size: 24px; }
    .header .player { font-size: 18px; margin-top: 8px; font-weight: bold; }
    .header .range { color: #666; margin-top: 4px; }
    .note { background: #f7f7f7; border-left: 4px solid #ff6600; padding: 10px 14px; margin-bottom: 18px; white-space: pre-wrap; }
    .section { margin-bottom: 22px; page-break-inside: avoid; }
    .section h2 { color: #ff6600; border-bottom: 2px solid #eee; padding-bottom: 6px; font-size: 16px; margin: 0 0 12px; }
    table { width: 100%; border-collapse: collapse; font-size: 11.5px; }
    th, td { border: 1px solid #ddd; padding: 5px 6px; text-align: center; }
    th { background: #f4f4f4; font-weight: bold; }
    td.left, th.left { text-align: left; }
    .dates { color: #888; font-size: 10.5px; }
    td.tot { font-weight: bold; background: #fff4ec; }
    tr.sum td { font-weight: bold; background: #f4f4f4; }
    tr.avg td { color: #666; font-style: italic; }
    .bar-row { display: flex; align-items: center; gap: 10px; margin: 6px 0; }
    .bar-label { width: 120px; font-size: 11.5px; } .bar-val { width: 60px; text-align: right; font-weight: bold; font-size: 12px; }
    .bar-track { flex: 1; height: 20px; background: #f0f0f0; border-radius: 4px; display: flex; overflow: hidden; }
    .seg { display: block; height: 100%; } .seg.train { background: #ff6600; } .seg.game { background: #2c3e50; }
    .legend { display: flex; gap: 18px; margin-top: 8px; font-size: 11.5px; color: #555; }
    .legend i { display: inline-block; width: 12px; height: 12px; margin-right: 5px; vertical-align: -2px; border-radius: 2px; }
    .sessions-page { page-break-before: always; page-break-inside: auto; }
    table.list tr { page-break-inside: avoid; }
    .footnote { margin-top: 18px; padding-top: 10px; border-top: 1px solid #eee; color: #777; font-size: 10.5px; }
    .empty { text-align: center; color: #888; padding: 30px 0; }
</style>
</head>
<body>
<div class="report-toolbar no-print">
    <button class="print-btn" onclick="window.print()">${esc(L.print)}</button>
    <button class="close-btn" onclick="window.close()">${esc(L.close)}</button>
</div>
<div class="header">
    <h1>${esc(L.title)}</h1>
    <div class="player">${esc(name)}</div>
    <div class="range">${esc(L.period)}: ${esc(range)}</div>
</div>
${noteHTML}
${hasData ? `${sec.table ? tableHTML : ''}${sec.chart ? chartHTML : ''}${footnoteHTML}${sec.sessions ? sessionsHTML : ''}` : `<div class="empty">${esc(L.noData)}</div>${footnoteHTML}`}
</body>
</html>`;
};

// ── Diálogo ──────────────────────────────────────────────────────────────────────────────────────────────
RPETracker.prototype._crSeasonStart = function(playerId) {
    const active = typeof Store !== 'undefined' && Store.getActiveSeason ? Store.getActiveSeason() : null;
    const dates = (this.sessions || [])
        .filter(s => s.playerId === playerId && (!active || (s.season || active) === active))
        .map(s => String(s.date || '').slice(0, 10)).filter(_crIsISO).sort();
    if (dates.length) return dates[0];
    const y = parseInt(String(active || '').slice(0, 4), 10);
    return Number.isFinite(y) ? `${y}-09-01` : null;
};

RPETracker.prototype.showCustomReportDialog = function(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    const today = toLocalISODate(new Date());
    const range = _crPeriodRange('4w', today);
    const playerOpts = this.players.map(p =>
        `<option value="${esc(p.id)}"${p.id === playerId ? ' selected' : ''}>${esc(this.playerDisplayName(p))}${p.number ? ' #' + esc(p.number) : ''}</option>`
    ).join('');
    const chip = (key, label, handler) =>
        `<button type="button" class="btn-secondary crChip" data-key="${key}" style="font-size:0.8rem;padding:0.4rem 0.8rem" onclick="window.rpeTracker.${handler}('${key}')">${label}</button>`;
    const check = (id, label, on) =>
        `<label style="display:flex;align-items:center;gap:0.5rem;padding:0.45rem 0;border-bottom:1px solid var(--border);cursor:pointer">
            <input type="checkbox" id="${id}" ${on ? 'checked' : ''} onchange="window.rpeTracker._crRefreshInfo()"><span>${label}</span></label>`;

    let modal = document.getElementById('customReportModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'customReportModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    modal.innerHTML = `
        <div class="modal-content modal-content--wide">
            <div class="modal-header">
                <div class="modal-header-inner"><h2>📊 Informe personalizado</h2></div>
                <button class="modal-close" onclick="document.getElementById('customReportModal').classList.remove('active')">✕</button>
            </div>
            <div class="modal-body" style="padding:1.25rem">
                <div style="margin-bottom:1.1rem">
                    <label class="form-label">Atajos según para quién es</label>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
                        ${chip('selection', 'Selección', '_crApplyPreset')}${chip('newteam', 'Nuevo equipo', '_crApplyPreset')}${chip('player', 'Para la jugadora', '_crApplyPreset')}
                    </div>
                </div>
                <div style="margin-bottom:1.1rem">
                    <label class="form-label">Jugadora</label>
                    <select id="crPlayer" class="form-select" onchange="window.rpeTracker._crRefreshInfo()">${playerOpts}</select>
                </div>
                <div style="margin-bottom:1.1rem">
                    <label class="form-label">Periodo</label>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.6rem">
                        ${chip('3w', 'Últimas 3 semanas', '_crSetPeriod')}${chip('4w', 'Últimas 4 semanas', '_crSetPeriod')}${chip('month', 'Último mes', '_crSetPeriod')}${chip('season', 'Toda la temporada', '_crSetPeriod')}
                    </div>
                    <div style="display:flex;gap:0.75rem;align-items:center;flex-wrap:wrap">
                        <input type="date" id="crFrom" class="form-input" value="${range.from}" style="flex:1;min-width:130px" onchange="window.rpeTracker._crRefreshInfo()">
                        <span style="color:var(--text-muted)">→</span>
                        <input type="date" id="crTo" class="form-input" value="${range.to}" style="flex:1;min-width:130px" onchange="window.rpeTracker._crRefreshInfo()">
                    </div>
                </div>
                <div style="display:flex;gap:0.75rem;flex-wrap:wrap;margin-bottom:1.1rem">
                    <div style="flex:1;min-width:150px">
                        <label class="form-label">Agrupar por</label>
                        <select id="crGroup" class="form-select" onchange="window.rpeTracker._crRefreshInfo()">
                            <option value="weeks">Semanas (bloques de 7 días)</option><option value="months">Meses</option>
                        </select>
                    </div>
                    <div style="flex:1;min-width:150px">
                        <label class="form-label">Idioma del informe</label>
                        <select id="crLang" class="form-select"><option value="es">Español</option><option value="en">English</option></select>
                    </div>
                </div>
                <div style="margin-bottom:1.1rem">
                    <label class="form-label">Qué incluir</label>
                    <div style="border:1px solid var(--border);border-radius:8px;padding:0 0.75rem">
                        ${check('crSecTable', 'Tabla resumen (entrenamiento y partidos)', true)}
                        ${check('crSecChart', 'Gráfico de carga por periodo', true)}
                        ${check('crSecSessions', 'Lista de sesiones (fecha, tipo, minutos, RPE)', false)}
                    </div>
                    <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.4rem">Solo carga de entrenamiento y partido. No incluye gimnasio, bienestar, lesiones ni notas.</div>
                </div>
                <div style="margin-bottom:1.1rem">
                    <label class="form-label">Nota de contexto (opcional, sale al principio del PDF)</label>
                    <textarea id="crNote" class="form-input" rows="2" maxlength="500" placeholder="Ej.: Vuelve de la concentración con la selección del 1 al 9 de noviembre."></textarea>
                </div>
                <div id="crInfo" style="font-size:0.85rem;color:var(--text-secondary)"></div>
                <div id="crWarnings"></div>
                <div style="margin-top:1.25rem;text-align:right">
                    <button class="btn-secondary" onclick="document.getElementById('customReportModal').classList.remove('active')" style="margin-right:0.5rem">Cancelar</button>
                    <button class="btn-primary" onclick="window.rpeTracker.generateCustomReport()">📄 Generar PDF</button>
                </div>
            </div>
        </div>`;
    modal.classList.add('active');
    this._crMarkChip('.crChip[data-key="4w"]');
    this._crRefreshInfo();
    // Los minutos y el recuento pueden depender de histórico aún sin cargar
    if (typeof this.ensureFullSessionHistory === 'function') {
        Promise.resolve(this.ensureFullSessionHistory()).then(() => this._crRefreshInfo()).catch(() => {});
    }
};

// Resalta el atajo activo (btn-primary) y apaga el resto del mismo grupo de atajos
RPETracker.prototype._crMarkChip = function(selector) {
    const el = document.querySelector(selector);
    if (!el) return;
    el.parentElement.querySelectorAll('.crChip').forEach(c => { c.classList.remove('btn-primary'); c.classList.add('btn-secondary'); });
    el.classList.remove('btn-secondary'); el.classList.add('btn-primary');
};

RPETracker.prototype._crSetPeriod = function(kind) {
    const playerId = document.getElementById('crPlayer')?.value;
    const to = toLocalISODate(new Date());
    const r = _crPeriodRange(kind, to, kind === 'season' ? this._crSeasonStart(playerId) : null);
    if (!r) return;
    document.getElementById('crFrom').value = r.from;
    document.getElementById('crTo').value = r.to;
    this._crMarkChip(`#customReportModal .crChip[data-key="${kind}"]`);
    this._crRefreshInfo();
};

RPETracker.prototype._crApplyPreset = function(key) {
    const p = CR_PRESETS[key];
    if (!p) return;
    document.getElementById('crLang').value = p.lang;
    document.getElementById('crGroup').value = p.group;
    document.getElementById('crSecTable').checked = !!p.sections.table;
    document.getElementById('crSecChart').checked = !!p.sections.chart;
    document.getElementById('crSecSessions').checked = !!p.sections.sessions;
    this._crSetPeriod(p.period);
    this._crMarkChip(`#customReportModal .crChip[data-key="${key}"]`);
    this._crRefreshInfo();
};

// Lo elegido en el diálogo
RPETracker.prototype._crReadForm = function() {
    const v = id => document.getElementById(id);
    return {
        playerId: v('crPlayer')?.value, from: v('crFrom')?.value, to: v('crTo')?.value,
        group: v('crGroup')?.value === 'months' ? 'months' : 'weeks',
        lang: v('crLang')?.value === 'en' ? 'en' : 'es',
        sections: { table: !!v('crSecTable')?.checked, chart: !!v('crSecChart')?.checked, sessions: !!v('crSecSessions')?.checked },
        note: v('crNote')?.value || ''
    };
};

// Recuento del periodo y avisos de calidad de datos (se actualiza con cada cambio del diálogo)
RPETracker.prototype._crRefreshInfo = function() {
    const info = document.getElementById('crInfo'), warn = document.getElementById('crWarnings');
    if (!info || !warn) return;
    const f = this._crReadForm();
    const problem = _crValidate({ from: f.from, to: f.to, sections: { table: true } });
    if (problem) { info.textContent = problem; warn.innerHTML = ''; return; }

    const d = this.buildCustomReportData(f.playerId, { from: f.from, to: f.to, group: f.group });
    const t = d.totals;
    info.textContent = `${d.days} días · ${t.all.sessions} sesiones (${t.training.sessions} de entrenamiento y ${t.game.sessions} partidos) · ${d.blocks.length} ${f.group === 'months' ? 'meses' : 'bloques'}`;

    const w = this.buildCustomReportWarnings(f.playerId, f.from, f.to);
    warn.innerHTML = w.length ? `
        <div style="margin-top:0.75rem;padding:0.6rem 0.8rem;border-radius:8px;border-left:4px solid var(--warning);background:var(--bg-subtle);font-size:0.82rem">
            <strong>Revisa los minutos de estos partidos:</strong> todas las jugadoras tienen los mismos minutos, así que puede que no se individualizaran y la carga salga inflada.
            <ul style="margin:0.3rem 0 0 1.1rem;padding:0">${w.map(x => `<li>${esc(_crFmtDate(x.date, 'es'))}: ${esc(x.minutes)} min para las ${esc(x.players)} jugadoras</li>`).join('')}</ul>
        </div>` : '';
};

RPETracker.prototype.generateCustomReport = async function() {
    const f = this._crReadForm();
    const problem = _crValidate(f);
    if (problem) { this.showToast(problem, 'error'); return; }
    const player = this.players.find(p => p.id === f.playerId);
    if (!player) { this.showToast('Jugadora no encontrada', 'error'); return; }

    // La ventana se abre YA, de forma síncrona dentro del gesto de tap/click (iOS Safari bloquea window.open tras un await)
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert('⚠️ El navegador ha bloqueado la ventana del informe. Permite las ventanas emergentes para esta web e inténtalo de nuevo.');
        return;
    }
    printWindow.document.write(this.buildLoadingPlaceholderHTML());

    // El periodo puede ser anterior a la ventana de ~4 meses cargada al iniciar
    await this.ensureFullSessionHistory();

    const data = this.buildCustomReportData(f.playerId, { from: f.from, to: f.to, group: f.group });
    const html = this.buildCustomReportHTML(player, data, { lang: f.lang, sections: f.sections, note: f.note });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);

    document.getElementById('customReportModal')?.classList.remove('active');
    this.showToast(`✅ Informe de ${this.playerFullName(player)} generado`);
};

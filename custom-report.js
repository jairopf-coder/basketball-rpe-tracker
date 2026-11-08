// BasketballRPE-Web — custom-report.js
// «Informe personalizado» de carga de una jugadora: cualquier periodo, agrupado por semanas o meses,
// en español o inglés, con las secciones que se elijan (tabla resumen, gráfico, lista de sesiones).
//
//  · Carga de entrenamiento y de partido: el gimnasio no entra nunca en las tablas, el gráfico ni la lista.
//  · Secciones opcionales (fase 2): ratio A:C al final de cada periodo, GPS, y —como datos SENSIBLES—
//    bienestar y lesiones/disponibilidad. Las sensibles salen desmarcadas, el PDF las avisa como confidenciales
//    y la «última selección» recordada nunca las guarda. Nunca se incluyen notas de sesión ni texto libre de lesiones.
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
const CR_SECTION_KEYS   = ['table', 'chart', 'sessions', 'ac', 'gps', 'wellness', 'injuries'];
const CR_SENSITIVE_KEYS = ['wellness', 'injuries'];                // datos de salud
const CR_PREFS_KEY      = 'basketballCustomReportPrefs';
const CR_PERIOD_KINDS   = ['3w', '4w', 'month', 'season'];
const CR_SECTION_IDS    = { table: 'crSecTable', chart: 'crSecChart', sessions: 'crSecSessions', ac: 'crSecAc', gps: 'crSecGps', wellness: 'crSecWellness', injuries: 'crSecInjuries' };

// Qué se marca y en qué idioma según para quién es el informe
const _crSec = (...on) => CR_SECTION_KEYS.reduce((o, k) => { o[k] = on.includes(k); return o; }, {});
const CR_PRESETS = {
    selection: { lang: 'en', period: '4w',     group: 'weeks', sections: _crSec('table', 'chart') },
    newteam:   { lang: 'en', period: 'season', group: 'weeks', sections: _crSec('table', 'chart', 'sessions') },
    player:    { lang: 'es', period: '4w',     group: 'weeks', sections: _crSec('table', 'chart', 'ac', 'wellness') },
    staff:     { lang: 'es', period: '4w',     group: 'weeks', sections: _crSec(...CR_SECTION_KEYS) }
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
        confidential: 'Confidential — contains health information',
        acTitle: 'Acute:chronic workload ratio (end of each period)', acAsOf: 'As of', acRatio: 'A:C ratio', acStatus: 'Status',
        acLevel: { danger: 'Danger', warn: 'Caution', ok: 'Optimal', low: 'Low', na: 'Insufficient data' },
        acNote: 'A:C = acute:chronic workload ratio as calculated by the club monitoring app (acute = recent 7 days; matches are weighted in its calculation). Thresholds for this player: low < {low}; optimal up to {opt}; caution up to {high}; danger above {high}.',
        gpsTitle: 'GPS (external load)', gpsSessions: 'GPS sessions', distance: 'Distance (km)', maxSpeed: 'Max speed (km/h)',
        hsr: 'High-speed running (m)', sprint: 'Sprint (m)', accel: 'High-int. accelerations (#)', decel: 'High-int. decelerations (#)',
        gpsNote: 'GPS values are the sum over the GPS-tracked court sessions of each period (max speed: highest value).',
        wellnessTitle: 'Wellness (average per period)', entries: 'Entries', sleep: 'Sleep', energy: 'Energy', mood: 'Mood', muscle: 'Muscle', overall: 'Overall',
        wellnessNote: 'Wellness scale 1–5, higher is better (energy: 5 = rested; muscle: 5 = no soreness). Overall = mean of the four items.',
        availTitle: 'Availability', daysInSquad: 'Days in squad', full: 'Full', limited: 'Limited', out: 'Unavailable',
        injuriesTitle: 'Injuries in the period', zone: 'Zone', injType: 'Type', severity: 'Severity', start: 'Start', endStatus: 'End / status',
        ongoing: 'Ongoing', recovered: 'Recovered', noInjuries: 'No injuries recorded in this period.',
        locations: { ankle: 'Ankle', knee: 'Knee', hamstring: 'Hamstring', quadriceps: 'Quadriceps', calf: 'Calf', groin: 'Groin', back: 'Back', shoulder: 'Shoulder', wrist: 'Wrist', finger: 'Fingers', other: 'Other' },
        injTypes: { muscle: 'Muscle', joint: 'Joint', bone: 'Bone', tendon: 'Tendon/ligament', other: 'Other' },
        severities: { minor: 'Minor', moderate: 'Moderate', severe: 'Severe', very_severe: 'Very severe' },
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
        confidential: 'Confidencial — contiene información de salud',
        acTitle: 'Ratio de carga aguda:crónica (al final de cada periodo)', acAsOf: 'A fecha', acRatio: 'Ratio A:C', acStatus: 'Estado',
        acLevel: { danger: 'Peligro', warn: 'Precaución', ok: 'Óptimo', low: 'Bajo', na: 'Datos insuficientes' },
        acNote: 'A:C = ratio de carga aguda:crónica calculado por la app de monitorización del club (aguda = últimos 7 días; los partidos se ponderan en su cálculo). Umbrales de esta jugadora: bajo < {low}; óptimo hasta {opt}; precaución hasta {high}; peligro por encima de {high}.',
        gpsTitle: 'GPS (carga externa)', gpsSessions: 'Sesiones con GPS', distance: 'Distancia (km)', maxSpeed: 'Vel. máx. (km/h)',
        hsr: 'Carrera de alta velocidad (m)', sprint: 'Sprint (m)', accel: 'Aceleraciones alta int. (#)', decel: 'Deceleraciones alta int. (#)',
        gpsNote: 'Los valores de GPS son la suma de las sesiones de pista con GPS de cada periodo (velocidad máxima: el valor más alto).',
        wellnessTitle: 'Bienestar (media por periodo)', entries: 'Registros', sleep: 'Sueño', energy: 'Energía', mood: 'Ánimo', muscle: 'Muscular', overall: 'Global',
        wellnessNote: 'Escala de bienestar 1–5, más alto es mejor (energía: 5 = descansada; muscular: 5 = sin dolor). Global = media de los cuatro ítems.',
        availTitle: 'Disponibilidad', daysInSquad: 'Días en plantilla', full: 'Completa', limited: 'Limitada', out: 'No disponible',
        injuriesTitle: 'Lesiones en el periodo', zone: 'Zona', injType: 'Tipo', severity: 'Gravedad', start: 'Inicio', endStatus: 'Fin / estado',
        ongoing: 'En curso', recovered: 'Recuperada', noInjuries: 'No hay lesiones registradas en este periodo.',
        locations: { ankle: 'Tobillo', knee: 'Rodilla', hamstring: 'Isquiotibiales', quadriceps: 'Cuádriceps', calf: 'Gemelos', groin: 'Ingle', back: 'Espalda', shoulder: 'Hombro', wrist: 'Muñeca', finger: 'Dedos', other: 'Otra' },
        injTypes: { muscle: 'Muscular', joint: 'Articular', bone: 'Ósea', tendon: 'Tendón/ligamento', other: 'Otra' },
        severities: { minor: 'Leve', moderate: 'Moderada', severe: 'Grave', very_severe: 'Muy grave' },
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
    if (!CR_SECTION_KEYS.some(k => s[k])) return 'Selecciona al menos una sección';
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

// ── Secciones opcionales (fase 2): cada una se calcula solo si se ha marcado ────────────────────────
function _crBlockIndex(blocks, date) { return blocks.findIndex(b => date >= b.from && date <= b.to); }
function _crIsCourtOrGame(type) { return type === CR_GAME_TYPE || CR_TRAINING_TYPES.includes(type); }

// A:C al final de cada bloque: el cálculo oficial de la app «tal como estaba» ese día, con el MISMO nivel
// (peligro / precaución / óptimo / bajo) que usa el resto de la app (_acLevel, umbrales individuales).
// NOTA: es el ratio de la app, que se calcula con todas las sesiones registradas de la jugadora.
RPETracker.prototype._crBuildAc = function(playerId, blocks) {
    const today = toLocalISODate(new Date());
    const rows = blocks.map(b => {
        const asOf = b.to > today ? today : b.to;                  // un periodo que acaba en el futuro se calcula a hoy
        const r = this.calculateAcuteChronicRatio(playerId, 7, _crParseISO(asOf));
        const n = r && r.confidence !== 'low' ? parseFloat(r.ratio) : NaN;
        return { asOf, ratio: Number.isFinite(n) ? n : null, level: typeof this._acLevel === 'function' ? this._acLevel(r, playerId) : 'na' };
    });
    const th = typeof this.getPlayerThresholds === 'function' ? this.getPlayerThresholds(playerId) : null;
    return { rows, thresholds: th ? { low: th.low, opt: th.opt, high: th.high } : null };
};

// Bienestar medio por bloque (solo registros completos; sin registros → entries 0)
RPETracker.prototype._crBuildWellness = function(playerId, blocks) {
    const acc = blocks.map(() => ({ n: 0, sleep: 0, fatigue: 0, mood: 0, soreness: 0 }));
    (this.wellnessData || []).forEach(e => {
        if (!e || e.playerId !== playerId) return;
        const i = _crBlockIndex(blocks, String(e.date || '').slice(0, 10));
        if (i < 0) return;
        const v = [e.sleep, e.fatigue, e.mood, e.soreness];
        if (v.some(x => x === null || x === undefined || x === '' || !Number.isFinite(Number(x)))) return;
        const a = acc[i]; a.n++; a.sleep += Number(e.sleep); a.fatigue += Number(e.fatigue); a.mood += Number(e.mood); a.soreness += Number(e.soreness);
    });
    return acc.map(a => a.n ? {
        entries: a.n, sleep: a.sleep / a.n, energy: a.fatigue / a.n, mood: a.mood / a.n, muscle: a.soreness / a.n,
        overall: (a.sleep + a.fatigue + a.mood + a.soreness) / (4 * a.n)
    } : { entries: 0 });
};

// Disponibilidad día a día (solo los días en que estaba en la plantilla) + lesiones que tocan el periodo.
// De cada lesión solo salen zona, tipo, gravedad, fechas y estado: nunca descripción, mecanismo, tratamiento ni notas.
RPETracker.prototype._crBuildAvailability = function(playerId, from, to, blocks) {
    const player = (this.players || []).find(p => p.id === playerId);
    const checkSquad = player && typeof this.isPlayerActiveOn === 'function';
    const rows = blocks.map(() => ({ days: 0, full: 0, partial: 0, out: 0 }));
    for (let day = from, i = 0; day <= to; day = _crAddDays(day, 1)) {
        while (i < blocks.length - 1 && day > blocks[i].to) i++;
        if (checkSquad && !this.isPlayerActiveOn(player, day)) continue;
        const state = typeof this.getPlayerParticipation === 'function' ? this.getPlayerParticipation(playerId, day) : 'full';
        const r = rows[i]; r.days++;
        if (state === 'out') r.out++; else if (state === 'partial') r.partial++; else r.full++;
    }
    const injuries = (this.injuries || [])
        .filter(x => x && x.playerId === playerId)
        .map(x => {
            const start = String(x.startDate || '').slice(0, 10);
            const closed = x.status === 'recovered' || x.endDate;
            return { location: x.location, type: x.type, severity: x.severity, start, end: closed && x.endDate ? String(x.endDate).slice(0, 10) : null, ongoing: !closed };
        })
        .filter(x => _crIsISO(x.start) && x.start <= to && (x.end || '9999-12-31') >= from)
        .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : 0));
    return { rows, injuries };
};

// GPS por bloque: suma de las sesiones de pista y partido con GPS importado (el gimnasio nunca entra)
RPETracker.prototype._crBuildGps = function(playerId, blocks) {
    const rows = blocks.map(() => ({ sessions: 0, distanceM: 0, maxSpeed: null, hsrM: 0, sprintM: 0, accel: 0, decel: 0 }));
    const num = v => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? 0 : Number(v));
    (this.sessions || []).forEach(s => {
        if (s.playerId !== playerId || !_crIsCourtOrGame(s.type)) return;
        const i = _crBlockIndex(blocks, String(s.date || '').slice(0, 10));
        if (i < 0) return;
        const g = typeof this._getGpsForSession === 'function' ? this._getGpsForSession(s) : null;
        if (!g) return;
        const r = rows[i];
        r.sessions++; r.distanceM += num(g.distanceM); r.hsrM += num(g.highIntensityRunsM); r.sprintM += num(g.maxIntensityRunsM);
        r.accel += num(g.highAccelerations); r.decel += num(g.highDecelerations);
        const sp = Number(g.maxSpeedKmh);
        if (g.maxSpeedKmh !== null && g.maxSpeedKmh !== undefined && Number.isFinite(sp)) r.maxSpeed = r.maxSpeed === null ? sp : Math.max(r.maxSpeed, sp);
    });
    return rows;
};

// Todo lo opcional que se haya marcado, listo para el PDF
RPETracker.prototype.buildCustomReportExtras = function(playerId, data, sections) {
    const sec = sections || {}, ex = {};
    if (sec.ac)       ex.ac = this._crBuildAc(playerId, data.blocks);
    if (sec.gps)      ex.gps = this._crBuildGps(playerId, data.blocks);
    if (sec.wellness) ex.wellness = this._crBuildWellness(playerId, data.blocks);
    if (sec.injuries) { const a = this._crBuildAvailability(playerId, data.from, data.to, data.blocks); ex.availability = a.rows; ex.injuries = a.injuries; }
    return ex;
};

// ── PDF (HTML que se abre en una ventana para imprimir / guardar como PDF) ────────────────────────────
// Etiquetas de cada bloque (semana / mes) y sus fechas
function _crLabeler(L, lang, isMonths) {
    return {
        label: b => (isMonths ? `${L.months[_crParseISO(b.from).getMonth()]} ${_crParseISO(b.from).getFullYear()}` : `${L.week} ${b.index}`),
        dates: b => (b.from === b.to ? _crFmtDay(b.from, lang) : `${_crFmtDay(b.from, lang)} – ${_crFmtDay(b.to, lang)}`)
    };
}
function _crRowHead(lab, b) { return `<td class="left"><strong>${esc(lab.label(b))}</strong><br><span class="dates">${esc(lab.dates(b))}</span></td>`; }
const _crDash = '–';

// Color del texto según el nivel (imprime en color; con el texto del estado al lado no depende solo del color)
function _crWellClass(v) { const x = Math.round(v * 10) / 10; return x >= 4 ? 'c-good' : x >= 3 ? 'c-warn' : 'c-bad'; }
const CR_LEVEL_CLASS = { danger: 'c-bad', warn: 'c-warn', ok: 'c-good', low: 'c-blue', na: 'c-na' };

function _crHtmlAc(L, lang, lab, data, ac) {
    const rows = data.blocks.map((b, i) => {
        const r = ac.rows[i];
        return `<tr>${_crRowHead(lab, b)}<td>${esc(_crFmtDate(r.asOf, lang))}</td>
            <td class="tot">${r.ratio === null ? _crDash : esc(_crDec2(r.ratio, lang))}</td>
            <td class="${CR_LEVEL_CLASS[r.level] || 'c-na'}"><strong>${esc(L.acLevel[r.level] || L.acLevel.na)}</strong></td></tr>`;
    }).join('');
    return `<div class="section"><h2>${esc(L.acTitle)}</h2><table><thead><tr>
        <th class="left">${esc(data.group === 'months' ? L.month : L.week)}</th><th>${esc(L.acAsOf)}</th><th>${esc(L.acRatio)}</th><th>${esc(L.acStatus)}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
}
function _crDec2(n, lang) { return (Math.round(n * 100) / 100).toFixed(2).replace('.', (CR_I18N[lang] || CR_I18N.en).decimal); }

function _crHtmlGps(L, lang, lab, data, gps) {
    const has = r => r.sessions > 0;
    const rows = data.blocks.map((b, i) => {
        const r = gps[i];
        if (!has(r)) return `<tr>${_crRowHead(lab, b)}<td colspan="7">${_crDash}</td></tr>`;
        return `<tr>${_crRowHead(lab, b)}<td>${_crNum(r.sessions, lang)}</td><td class="tot">${_crDec(r.distanceM / 1000, lang)}</td>
            <td>${r.maxSpeed === null ? _crDash : _crDec(r.maxSpeed, lang)}</td><td>${_crNum(r.hsrM, lang)}</td><td>${_crNum(r.sprintM, lang)}</td>
            <td>${_crNum(r.accel, lang)}</td><td>${_crNum(r.decel, lang)}</td></tr>`;
    }).join('');
    const sum = gps.reduce((t, r) => ({ sessions: t.sessions + r.sessions, distanceM: t.distanceM + r.distanceM, hsrM: t.hsrM + r.hsrM, sprintM: t.sprintM + r.sprintM,
        accel: t.accel + r.accel, decel: t.decel + r.decel, maxSpeed: r.maxSpeed === null ? t.maxSpeed : (t.maxSpeed === null ? r.maxSpeed : Math.max(t.maxSpeed, r.maxSpeed)) }),
        { sessions: 0, distanceM: 0, hsrM: 0, sprintM: 0, accel: 0, decel: 0, maxSpeed: null });
    const total = sum.sessions ? `<tr class="sum"><td class="left">${esc(L.totalRow)}</td><td>${_crNum(sum.sessions, lang)}</td><td class="tot">${_crDec(sum.distanceM / 1000, lang)}</td>
        <td>${sum.maxSpeed === null ? _crDash : _crDec(sum.maxSpeed, lang)}</td><td>${_crNum(sum.hsrM, lang)}</td><td>${_crNum(sum.sprintM, lang)}</td>
        <td>${_crNum(sum.accel, lang)}</td><td>${_crNum(sum.decel, lang)}</td></tr>` : '';
    return `<div class="section"><h2>${esc(L.gpsTitle)}</h2><table><thead><tr>
        <th class="left">${esc(data.group === 'months' ? L.month : L.week)}</th><th>${esc(L.gpsSessions)}</th><th>${esc(L.distance)}</th><th>${esc(L.maxSpeed)}</th>
        <th>${esc(L.hsr)}</th><th>${esc(L.sprint)}</th><th>${esc(L.accel)}</th><th>${esc(L.decel)}</th></tr></thead>
        <tbody>${rows}${total}</tbody></table></div>`;
}

function _crHtmlWellness(L, lang, lab, data, wellness) {
    const v = x => `<td class="${_crWellClass(x)}">${esc(_crDec(x, lang))}</td>`;
    const rows = data.blocks.map((b, i) => {
        const w = wellness[i];
        if (!w.entries) return `<tr>${_crRowHead(lab, b)}<td>0</td><td colspan="5">${_crDash}</td></tr>`;
        return `<tr>${_crRowHead(lab, b)}<td>${_crNum(w.entries, lang)}</td>${v(w.sleep)}${v(w.energy)}${v(w.mood)}${v(w.muscle)}<td class="${_crWellClass(w.overall)} tot"><strong>${esc(_crDec(w.overall, lang))}</strong></td></tr>`;
    }).join('');
    return `<div class="section"><h2>${esc(L.wellnessTitle)}</h2><table><thead><tr>
        <th class="left">${esc(data.group === 'months' ? L.month : L.week)}</th><th>${esc(L.entries)}</th><th>${esc(L.sleep)}</th><th>${esc(L.energy)}</th>
        <th>${esc(L.mood)}</th><th>${esc(L.muscle)}</th><th>${esc(L.overall)}</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}

function _crHtmlInjuries(L, lang, lab, data, availability, injuries) {
    const rows = data.blocks.map((b, i) => {
        const r = availability[i];
        return `<tr>${_crRowHead(lab, b)}<td>${_crNum(r.days, lang)}</td><td class="c-good">${_crNum(r.full, lang)}</td>
            <td class="c-warn">${_crNum(r.partial, lang)}</td><td class="c-bad">${_crNum(r.out, lang)}</td></tr>`;
    }).join('');
    const label = (dict, key) => esc((dict && dict[key]) || key || _crDash);
    const inj = injuries.length ? `<table style="margin-top:12px"><thead><tr><th class="left">${esc(L.zone)}</th><th class="left">${esc(L.injType)}</th>
        <th class="left">${esc(L.severity)}</th><th>${esc(L.start)}</th><th>${esc(L.endStatus)}</th></tr></thead><tbody>
        ${injuries.map(x => `<tr><td class="left">${label(L.locations, x.location)}</td><td class="left">${label(L.injTypes, x.type)}</td><td class="left">${label(L.severities, x.severity)}</td>
            <td>${esc(_crFmtDate(x.start, lang))}</td><td>${x.ongoing ? `<strong>${esc(L.ongoing)}</strong>` : esc(_crFmtDate(x.end, lang)) + ' · ' + esc(L.recovered)}</td></tr>`).join('')}
        </tbody></table>` : `<p class="muted">${esc(L.noInjuries)}</p>`;
    return `<div class="section"><h2>${esc(L.availTitle)} · ${esc(L.injuriesTitle)}</h2><table><thead><tr>
        <th class="left">${esc(data.group === 'months' ? L.month : L.week)}</th><th>${esc(L.daysInSquad)}</th><th>${esc(L.full)}</th><th>${esc(L.limited)}</th><th>${esc(L.out)}</th></tr></thead>
        <tbody>${rows}</tbody></table>${inj}</div>`;
}

// @param opts { lang, sections: {table, chart, sessions, ac, gps, wellness, injuries}, note }
// Los datos opcionales vienen en data.extras (buildCustomReportExtras)
RPETracker.prototype.buildCustomReportHTML = function(player, data, opts) {
    const lang = CR_I18N[opts.lang] ? opts.lang : 'en';
    const L = CR_I18N[lang];
    const sec = opts.sections || {};
    const ex = data.extras || {};
    const name = this.playerFullName(player);
    const isMonths = data.group === 'months';
    const lab = _crLabeler(L, lang, isMonths);
    const range = `${_crFmtDate(data.from, lang)} – ${_crFmtDate(data.to, lang)}`;
    const todayLabel = _crFmtDate(toLocalISODate(new Date()), lang);
    const hasLoad = data.totals.all.sessions > 0;
    const sensitive = CR_SENSITIVE_KEYS.some(k => sec[k]);

    const blockLabel = lab.label, blockDates = lab.dates;
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
    // La lista de sesiones empieza en página aparte solo si hay algo antes
    const sessionsHTML = `<div class="section${sec.table || sec.chart || sec.ac || sec.gps || sec.wellness || sec.injuries ? ' sessions-page' : ''}"><h2>${esc(L.sessionsTitle)}</h2>
        <table class="list"><thead><tr><th class="left">${esc(L.date)}</th><th class="left">${esc(L.type)}</th>
            <th>${esc(L.minutes)}</th><th>${esc(L.rpe)}</th><th>${esc(L.load)}</th></tr></thead><tbody>
        ${data.sessions.map(s => `<tr><td class="left">${esc(_crFmtDate(s.date, lang))}</td><td class="left">${esc(typeLabel(s.type))}</td>
            <td>${_crNum(s.minutes, lang)}</td><td>${_crDec(s.rpe, lang)}</td><td>${_crNum(s.load, lang)}</td></tr>`).join('')}
        </tbody></table></div>`;

    const noteText = String(opts.note || '').trim();
    const noteHTML = noteText ? `<div class="note"><strong>${esc(L.contextTitle)}</strong><br>${esc(noteText)}</div>` : '';

    // Definiciones y fecha: van en la primera página, debajo de las secciones de carga
    const th = ex.ac && ex.ac.thresholds;
    const extraNotes = [
        sec.ac && th ? L.acNote.replace('{low}', _crDec2(th.low, lang)).replace(/\{opt\}/g, _crDec2(th.opt, lang)).replace(/\{high\}/g, _crDec2(th.high, lang)) : '',
        sec.gps ? L.gpsNote : '',
        sec.wellness ? L.wellnessNote : ''
    ].filter(Boolean).map(x => `<br>${esc(x)}`).join('');
    const footnoteHTML = `<div class="footnote">${esc(L.definitions)}${extraNotes}<br>${esc(L.generated)}: ${esc(todayLabel)}</div>`;

    const loadSections = sec.table || sec.chart || sec.sessions;
    const loadHTML = hasLoad
        ? `${sec.table ? tableHTML : ''}${sec.chart ? chartHTML : ''}`
        : (loadSections ? `<div class="empty">${esc(L.noData)}</div>` : '');
    const acHTML = sec.ac && ex.ac ? _crHtmlAc(L, lang, lab, data, ex.ac) : '';
    const gpsHTML = sec.gps && ex.gps ? _crHtmlGps(L, lang, lab, data, ex.gps) : '';
    const wellHTML = sec.wellness && ex.wellness ? _crHtmlWellness(L, lang, lab, data, ex.wellness) : '';
    const injHTML = sec.injuries && ex.availability ? _crHtmlInjuries(L, lang, lab, data, ex.availability, ex.injuries || []) : '';

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
    .confidential { display: inline-block; margin-top: 8px; padding: 2px 10px; border: 1px solid #c62828; color: #c62828; border-radius: 4px; font-size: 11px; font-weight: bold; letter-spacing: .03em; }
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
    .c-good { color: #2e7d32; } .c-warn { color: #e65100; } .c-bad { color: #c62828; } .c-blue { color: #1565c0; } .c-na { color: #888; }
    .muted { color: #777; font-style: italic; margin: 10px 0 0; }
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
    ${sensitive ? `<div class="confidential">${esc(L.confidential)}</div>` : ''}
</div>
${noteHTML}
${loadHTML}${acHTML}${gpsHTML}${wellHTML}${injHTML}${footnoteHTML}${sec.sessions && hasLoad ? sessionsHTML : ''}
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

// ── Última selección recordada ──────────────────────────────────────────────────────────────────────────
// Se guarda en este dispositivo SOLO lo no sensible: idioma, agrupación, atajo de periodo y las secciones de
// carga y rendimiento. Nunca las de salud (bienestar, lesiones), ni la jugadora, ni las fechas, ni la nota:
// así un informe externo no puede arrastrar datos de salud de un informe interno anterior.
RPETracker.prototype._crLoadPrefs = function() {
    try {
        const p = JSON.parse(localStorage.getItem(CR_PREFS_KEY) || 'null');
        if (!p || typeof p !== 'object') return null;
        const sections = {};
        CR_SECTION_KEYS.forEach(k => { sections[k] = CR_SENSITIVE_KEYS.includes(k) ? false : !!(p.sections && p.sections[k]); });
        return { lang: p.lang === 'en' ? 'en' : 'es', group: p.group === 'months' ? 'months' : 'weeks', period: CR_PERIOD_KINDS.includes(p.period) ? p.period : null, sections };
    } catch (_) { return null; }
};

RPETracker.prototype._crSavePrefs = function(f) {
    try {
        const sections = {};
        CR_SECTION_KEYS.forEach(k => { if (!CR_SENSITIVE_KEYS.includes(k)) sections[k] = !!(f.sections && f.sections[k]); });
        localStorage.setItem(CR_PREFS_KEY, JSON.stringify({
            lang: f.lang === 'en' ? 'en' : 'es', group: f.group === 'months' ? 'months' : 'weeks',
            period: CR_PERIOD_KINDS.includes(f.periodKind) ? f.periodKind : null, sections
        }));
    } catch (_) { /* sin almacenamiento local: simplemente no se recuerda */ }
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
                        ${chip('selection', 'Selección', '_crApplyPreset')}${chip('newteam', 'Nuevo equipo', '_crApplyPreset')}${chip('player', 'Para la jugadora', '_crApplyPreset')}${chip('staff', 'Cuerpo técnico', '_crApplyPreset')}
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
                        <input type="date" id="crFrom" class="form-input" value="${range.from}" style="flex:1;min-width:130px" onchange="window.rpeTracker._crDatesEdited()">
                        <span style="color:var(--text-muted)">→</span>
                        <input type="date" id="crTo" class="form-input" value="${range.to}" style="flex:1;min-width:130px" onchange="window.rpeTracker._crDatesEdited()">
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
                    <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin:0.2rem 0 0.3rem">Carga y rendimiento</div>
                    <div style="border:1px solid var(--border);border-radius:8px;padding:0 0.75rem">
                        ${check('crSecTable', 'Tabla resumen (entrenamiento y partidos)', true)}
                        ${check('crSecChart', 'Gráfico de carga por periodo', true)}
                        ${check('crSecAc', 'Ratio A:C al final de cada periodo', false)}
                        ${check('crSecGps', 'Datos GPS (distancia, velocidad máxima…)', false)}
                        ${check('crSecSessions', 'Lista de sesiones (fecha, tipo, minutos, RPE)', false)}
                    </div>
                    <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);margin:0.8rem 0 0.3rem">Salud (datos sensibles)</div>
                    <div style="border:1px solid var(--border);border-radius:8px;padding:0 0.75rem">
                        ${check('crSecWellness', 'Bienestar medio por periodo', false)}
                        ${check('crSecInjuries', 'Lesiones y disponibilidad', false)}
                    </div>
                    <div id="crSensWarn" style="display:none;margin-top:0.5rem;padding:0.5rem 0.75rem;border-radius:8px;border-left:4px solid var(--warning);background:var(--bg-subtle);font-size:0.82rem">
                        Son datos de salud: inclúyelos solo en informes internos o con el consentimiento de la jugadora. El PDF llevará la marca «Confidencial».
                    </div>
                    <div style="font-size:0.78rem;color:var(--text-muted);margin-top:0.4rem">No incluye gimnasio, notas de sesión ni texto libre de lesiones. Las secciones de salud siempre salen desmarcadas y no se recuerdan.</div>
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
    this._crPeriodKind = '4w';
    this._crMarkChip('.crChip[data-key="4w"]');
    const prefs = this._crLoadPrefs();
    if (prefs) {
        document.getElementById('crLang').value = prefs.lang;
        document.getElementById('crGroup').value = prefs.group;
        CR_SECTION_KEYS.forEach(k => { const el = document.getElementById(CR_SECTION_IDS[k]); if (el) el.checked = !!prefs.sections[k]; });
        if (prefs.period) this._crSetPeriod(prefs.period);
    }
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
    this._crPeriodKind = kind;
    this._crMarkChip(`#customReportModal .crChip[data-key="${kind}"]`);
    this._crRefreshInfo();
};

// Si se tocan las fechas a mano el periodo deja de ser un atajo (y se apaga el atajo marcado)
RPETracker.prototype._crDatesEdited = function() {
    this._crPeriodKind = 'custom';
    document.querySelectorAll('#customReportModal .crChip').forEach(c => {
        if (CR_PERIOD_KINDS.includes(c.dataset.key)) { c.classList.remove('btn-primary'); c.classList.add('btn-secondary'); }
    });
    this._crRefreshInfo();
};

RPETracker.prototype._crApplyPreset = function(key) {
    const p = CR_PRESETS[key];
    if (!p) return;
    document.getElementById('crLang').value = p.lang;
    document.getElementById('crGroup').value = p.group;
    CR_SECTION_KEYS.forEach(k => { const el = document.getElementById(CR_SECTION_IDS[k]); if (el) el.checked = !!p.sections[k]; });
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
        sections: CR_SECTION_KEYS.reduce((o, k) => { o[k] = !!v(CR_SECTION_IDS[k])?.checked; return o; }, {}),
        periodKind: this._crPeriodKind || 'custom',
        note: v('crNote')?.value || ''
    };
};

// Recuento del periodo y avisos de calidad de datos (se actualiza con cada cambio del diálogo)
RPETracker.prototype._crRefreshInfo = function() {
    const info = document.getElementById('crInfo'), warn = document.getElementById('crWarnings');
    if (!info || !warn) return;
    const f = this._crReadForm();
    const sensWarn = document.getElementById('crSensWarn');
    if (sensWarn) sensWarn.style.display = CR_SENSITIVE_KEYS.some(k => f.sections[k]) ? 'block' : 'none';
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
    data.extras = this.buildCustomReportExtras(f.playerId, data, f.sections);
    const html = this.buildCustomReportHTML(player, data, { lang: f.lang, sections: f.sections, note: f.note });

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);

    this._crSavePrefs(f);
    document.getElementById('customReportModal')?.classList.remove('active');
    this.showToast(`✅ Informe de ${this.playerFullName(player)} generado`);
};

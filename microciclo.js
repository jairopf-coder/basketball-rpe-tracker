// ========== MICROCICLO (microciclo.js) ==========
// Vista Carga → Microciclo  (#microcicloView → #microcicloContent)
//   1. Gráfico que compara DOS semanas a elegir (por defecto: la actual frente
//      a la anterior), en Carga UA o en RPE medio, con el detalle de cada sesión
//      (turno, tipo, RPE, UA) al pulsar una barra.
//   1b. Tabla "Comparación día a día": valor de cada semana, diferencia A − B y
//       resumen semanal (UA, RPE medio, sesiones).
//   2. Tabla Jugadora × Día de la semana actual (UA real frente al plan).
// Esta vista solo LEE datos (sesiones y plan semanal): no guarda nada.
// La selección de semanas se recuerda mientras la app está abierta y
// no se persiste (al recargar vuelve a "actual vs anterior").
// El selector solo ofrece semanas de la temporada activa (Store.getActiveSeason()).

(function () {
    'use strict';

    const DAY_KEYS   = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
    const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const ISO_DATE   = /^\d{4}-\d{2}-\d{2}/;

    // Mismos iconos que el Historial de sesiones
    const TYPE_ICONS = { training: '🏀', match: '🏟️', shooting: '🎯', gym: '🏋️', recovery: '💪' };
    const TYPE_ORDER = ['training', 'match', 'shooting', 'gym', 'recovery'];
    const TIME_ICONS = { morning: '☀️', afternoon: '🌙' };

    // ── Fechas (siempre en hora local, nunca toISOString) ──────────────
    function dateFromISO(iso) {
        const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function addDays(iso, n) {
        const d = dateFromISO(iso);
        d.setDate(d.getDate() + n);
        return toLocalISODate(d);
    }

    // Lunes (AAAA-MM-DD) de la semana a la que pertenece una fecha
    function mondayOf(iso) {
        const d = dateFromISO(iso);
        d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
        return toLocalISODate(d);
    }

    // formatDM / formatDMRange vienen de store.js (formato día/mes común a toda la app)
    function formatRange(mondayKey) {
        return formatDMRange(mondayKey, addDays(mondayKey, 6));
    }

    // RPE con una decimal y coma ("6,5"); "—" si no hay dato
    function fmtRpe(v) {
        return v === null || v === undefined ? '—' : v.toFixed(1).replace('.', ',');
    }

    // Redondeo a 1 decimal para dibujar (null = día sin RPE, no se pinta barra)
    function roundRpe(v) {
        return v === null ? null : Math.round(v * 10) / 10;
    }

    // Diferencia A − B con flecha neutra (sin rojo/verde: más carga no es buena ni mala por sí sola).
    //   kind 'ua'    → número entero y % respecto a B (si B = 0 no hay %)
    //   kind 'rpe'   → puntos de RPE con 1 decimal, sin %
    //   kind 'count' → número entero (nº de sesiones)
    // Si falta alguno de los dos datos (null) devuelve "–".
    function deltaHTML(a, b, kind) {
        if (a === null || b === null) return '–';
        const diff = a - b;
        const isRpe = kind === 'rpe';
        if (Math.abs(diff) < (isRpe ? 0.05 : 0.5)) return '<span class="mc-delta mc-delta-eq">=</span>';
        const up = diff > 0;
        const amount = isRpe ? fmtRpe(Math.abs(diff)) : String(Math.round(Math.abs(diff)));
        let pct = '';
        if (kind === 'ua' && b > 0) {
            const p = Math.round(diff / b * 100);
            pct = ` <span class="mc-delta-pct">(${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%)</span>`;
        }
        return `<span class="mc-delta ${up ? 'mc-delta-up' : 'mc-delta-down'}">${up ? '▲' : '▼'} ${amount}${pct}</span>`;
    }

    // Composición de una semana solo con iconos: "🏀 4 + 🏟️ 1"
    function compositionText(counts) {
        const parts = TYPE_ORDER.filter(t => counts[t]).map(t => `${TYPE_ICONS[t]} ${counts[t]}`);
        return parts.length ? parts.join(' + ') : 'sin sesiones';
    }

    // Texto corto con el que se reconoce una semana (para los desplegables):
    // icono del bloque de temporada, sesiones, carga total y RPE medio.
    // Ej.: "🏗️ · 🏀 4 + 🏟️ 1 · 3200 UA · RPE 6,5"
    function describeWeek(s) {
        const bits = [];
        if (s.block) bits.push(s.block.icon);
        bits.push(compositionText(s.counts));
        bits.push(`${s.totalUA} UA`);
        if (s.rpeMean !== null) bits.push(`RPE ${fmtRpe(s.rpeMean)}`);
        return bits.join(' · ');
    }

    // ── Datos para comparar semanas ────────────────────────────────────

    // Agrupa todas las sesiones cargadas por semana (clave = lunes)
    RPETracker.prototype._mcSessionsByWeek = function () {
        const weeks = new Map();
        (this.sessions || []).forEach(s => {
            if (!s || typeof s.date !== 'string' || !ISO_DATE.test(s.date)) return;
            const key = mondayOf(s.date);
            if (!weeks.has(key)) weeks.set(key, []);
            weeks.get(key).push(s);
        });
        return weeks;
    };

    // Bloque de temporada (Pretemporada, Competición…) que cubre esa semana
    RPETracker.prototype._mcBlockForWeek = function (mondayKey) {
        const sunday = addDays(mondayKey, 6);
        const blocks = (this.seasonBlocks || []).filter(b =>
            b && b.start && b.end && b.start <= sunday && b.end >= mondayKey);
        if (!blocks.length) return null;
        const block = blocks.find(b => b.start <= mondayKey) || blocks[0];
        const meta = (this._seasonBlockTypes || []).find(t => t.key === block.type);
        return meta ? { icon: meta.icon, label: meta.label } : null;
    };

    // Resumen de una semana: UA y RPE por día, sesiones de equipo, totales y composición.
    // RPE medio = media simple de los RPE registrados (por sesión, por día y por semana).
    RPETracker.prototype._mcWeekSummary = function (mondayKey, sessionsOfWeek) {
        const uaByDate = {};
        const rpeByDate = {};                 // fecha → { sum, n }
        const teamSessions = new Map();       // fecha + turno + tipo (criterio del Historial)
        const weekRpe = { sum: 0, n: 0 };

        sessionsOfWeek.forEach(s => {
            const date = s.date.slice(0, 10);
            const type = TYPE_ICONS[s.type] ? s.type : 'training';
            const load = s.load || 0;
            uaByDate[date] = (uaByDate[date] || 0) + load;

            const key = `${date}_${s.timeOfDay || 'unknown'}_${type}`;
            let g = teamSessions.get(key);
            if (!g) {
                g = { date, timeOfDay: s.timeOfDay || null, type, ua: 0, rpeSum: 0, rpeN: 0 };
                teamSessions.set(key, g);
            }
            g.ua += load;

            const rpe = Number(s.rpe);
            if (rpe > 0) {
                g.rpeSum += rpe; g.rpeN++;
                weekRpe.sum += rpe; weekRpe.n++;
                const d = rpeByDate[date] || (rpeByDate[date] = { sum: 0, n: 0 });
                d.sum += rpe; d.n++;
            }
        });

        const counts = {};
        const sessionsPerDay = DAY_KEYS.map(() => []);
        teamSessions.forEach(g => {
            counts[g.type] = (counts[g.type] || 0) + 1;
            const dayIdx = DAY_KEYS.findIndex((_, i) => addDays(mondayKey, i) === g.date);
            if (dayIdx >= 0) {
                sessionsPerDay[dayIdx].push({
                    timeOfDay: g.timeOfDay,
                    type: g.type,
                    ua: Math.round(g.ua),
                    rpe: g.rpeN ? g.rpeSum / g.rpeN : null
                });
            }
        });
        const turn = { morning: 0, afternoon: 1 };
        sessionsPerDay.forEach(arr => arr.sort((x, y) =>
            ((turn[x.timeOfDay] ?? 2) - (turn[y.timeOfDay] ?? 2)) ||
            (TYPE_ORDER.indexOf(x.type) - TYPE_ORDER.indexOf(y.type))));

        const dates = DAY_KEYS.map((_, i) => addDays(mondayKey, i));
        const uaPerDay  = dates.map(ds => Math.round(uaByDate[ds] || 0));
        const rpePerDay = dates.map(ds => rpeByDate[ds] ? rpeByDate[ds].sum / rpeByDate[ds].n : null);
        return {
            mondayKey,
            label: formatRange(mondayKey),
            uaPerDay,
            rpePerDay,
            sessionsPerDay,
            totalUA: uaPerDay.reduce((a, b) => a + b, 0),
            rpeMean: weekRpe.n ? weekRpe.sum / weekRpe.n : null,
            counts,
            totalSessions: teamSessions.size,
            block: this._mcBlockForWeek(mondayKey)
        };
    };

    // Todo lo que necesita el gráfico: semana A, semana B y lista de semanas elegibles
    RPETracker.prototype._mcComparisonModel = function () {
        const byWeek      = this._mcSessionsByWeek();
        const currentKey  = this._wpMondayForOffset(0);
        const previousKey = addDays(currentKey, -7);
        const sel   = this._mcCompare || {};
        const keyA  = sel.a || currentKey;
        const keyB  = sel.b || previousKey;

        // Solo semanas de la temporada activa (que terminan a partir de su inicio), más la
        // actual y la anterior (aunque estén vacías) y las elegidas.
        const seasonStart = this._mcSeasonStart();
        const inSeason = key => !seasonStart || addDays(key, 6) >= seasonStart;
        const keys = new Set([...[...byWeek.keys()].filter(inSeason), currentKey, previousKey, keyA, keyB]);
        const summaries = new Map();
        [...keys].forEach(key => {
            const s = this._mcWeekSummary(key, byWeek.get(key) || []);
            const tag = key === currentKey ? ' (actual)' : key === previousKey ? ' (anterior)' : '';
            s.optionText = `${s.label}${tag} · ${describeWeek(s)}`;
            summaries.set(key, s);
        });

        return {
            a: summaries.get(keyA),
            b: summaries.get(keyB),
            weeks: [...keys].sort().reverse().map(k => summaries.get(k)), // más reciente primero
            isCustom: !!(sel.a || sel.b),
            metric: this._mcMetric === 'rpe' ? 'rpe' : 'ua'
        };
    };

    // ── Temporada activa ───────────────────────────────────────────────

    // Primer día de la temporada activa de la app (p. ej. "2026-27" → "2026-08-01").
    // null si no se puede determinar (entonces no se filtra ni se carga nada extra).
    RPETracker.prototype._mcSeasonStart = function () {
        const label = (typeof Store !== 'undefined' && Store.getActiveSeason) ? Store.getActiveSeason() : '';
        const m = /^(\d{4})/.exec(label || '');
        return m ? `${m[1]}-08-01` : null;
    };

    // La app solo carga las sesiones desde el inicio de una ventana (1/8 de agosto a
    // diciembre, 1/1 de enero a julio). A partir de enero la pretemporada de la temporada
    // activa queda fuera, así que se trae el histórico en segundo plano (mismo patrón que
    // Predicción de lesiones) y se redibuja al terminar. En agosto-diciembre no hace nada.
    RPETracker.prototype._mcEnsureSeasonHistory = function () {
        const seasonStart = this._mcSeasonStart();
        if (!seasonStart || this._fullHistoryLoaded || this._mcHistoryRequested) return;
        if (!window.firebaseSync || !this._sessionsWindowStart) return;
        if (seasonStart >= this._sessionsWindowStart) return;   // la ventana ya cubre la temporada

        this._mcHistoryRequested = true;                        // un solo intento por sesión de uso
        this.ensureFullSessionHistory()
            .then(() => { if (this.currentView === 'microciclo') this.renderMicrociclo(); })
            .catch(e => console.error('Microciclo: no se pudo cargar el histórico', e));
    };

    // ── Acciones de los controles ──────────────────────────────────────

    // slot: 'a' | 'b'. Si se elige el valor por defecto se vuelve a "automático",
    // así la semana actual sigue siendo la actual cuando pase el tiempo.
    RPETracker.prototype._mcSetWeek = function (slot, mondayKey) {
        if ((slot !== 'a' && slot !== 'b') || !ISO_DATE.test(String(mondayKey))) return;
        if (!this._mcCompare) this._mcCompare = { a: null, b: null };
        const currentKey = this._wpMondayForOffset(0);
        const defaultKey = slot === 'a' ? currentKey : addDays(currentKey, -7);
        this._mcCompare[slot] = mondayKey === defaultKey ? null : mondayKey;
        this.renderMicrociclo();
    };

    RPETracker.prototype._mcResetCompare = function () {
        this._mcCompare = { a: null, b: null };
        this.renderMicrociclo();
    };

    // metric: 'ua' (carga) | 'rpe' (RPE medio). Solo se recuerda mientras la app está abierta.
    RPETracker.prototype._mcSetMetric = function (metric) {
        if (metric !== 'ua' && metric !== 'rpe') return;
        this._mcMetric = metric;
        this.renderMicrociclo();
    };

    // ── Vista ──────────────────────────────────────────────────────────

    RPETracker.prototype.renderMicrociclo = function () {
        const container = document.getElementById('microcicloContent');
        if (!container) return;

        if (!this.weekPlan) this.loadWeekPlan();
        this._mcEnsureSeasonHistory();

        // Liberar el gráfico anterior antes de sustituir el HTML
        const oldCanvas = document.getElementById('mcWeekCompareChart');
        if (oldCanvas && oldCanvas._chartInstance) {
            oldCanvas._chartInstance.destroy();
            oldCanvas._chartInstance = null;
        }

        // ── Semana actual (la tabla siempre muestra esta) ─────────
        const currentMonday = this._wpMondayForOffset(0);
        const weekStart = dateFromISO(currentMonday);

        const dayDates = DAY_KEYS.map((_, i) => {
            const d = new Date(weekStart);
            d.setDate(d.getDate() + i);
            return d;
        });
        const dayDateStrs = dayDates.map(d => toLocalISODate(d));

        // ── Planificado ───────────────────────────────────────────
        const intensityRPE = { none: 0, low: 4.5, medium: 5.5, high: 7.5, max: 9.5 };
        const plan = this.getWeekPlanDays(weekStart);
        const playerCount = Math.max(this.players.length, 1);

        const plannedUAPerDay = DAY_KEYS.map(dk => {
            const d = plan[dk] || {};
            let load = 0;
            ['morning', 'afternoon'].forEach(sl => {
                const s = d[sl];
                if (s && s.enabled) load += (intensityRPE[s.intensity || 'none'] || 0) * (s.duration || 0);
            });
            return Math.round(load * playerCount);
        });

        const totalPlannedUA = plannedUAPerDay.reduce((a, b) => a + b, 0);

        // ── Real ─────────────────────────────────────────────────
        const realSessByDay = dayDateStrs.map(ds =>
            this.sessions.filter(s => s.date && s.date.slice(0, 10) === ds)
        );
        const realUAPerDay = realSessByDay.map(sArr =>
            Math.round(sArr.reduce((sum, s) => sum + (s.load || 0), 0))
        );
        const totalRealUA = realUAPerDay.reduce((a, b) => a + b, 0);

        // ── Semáforo helper ───────────────────────────────────────
        const trafficLight = (real, planned) => {
            if (planned === 0 && real === 0) return 'mc-cell-neutral';
            if (planned === 0 && real > 0)   return 'mc-cell-extra';
            const pct = real / planned;
            if (pct >= 0.85 && pct <= 1.15) return 'mc-cell-ok';
            if (pct >= 0.6  && pct <= 1.4)  return 'mc-cell-warn';
            return 'mc-cell-bad';
        };

        // Variación de la carga real respecto al plan: (real − plan) / plan, en %.
        // Sin plan no hay base para calcularla: "extra" si hubo sesión, "–" si no.
        const variationText = (real, plan) => {
            if (plan === 0) return real === 0 ? '–' : 'extra';
            const p = Math.round((real - plan) / plan * 100);
            return `${p > 0 ? '+' : p < 0 ? '−' : ''}${Math.abs(p)}%`;
        };
        // Los valores absolutos quedan en el tooltip de cada celda
        const cellTitle = (real, plan) => `Real ${real} UA · Plan ${plan} UA`;

        // ── Tabla jugadora × día ──────────────────────────────────
        // For each player, for each day: real UA vs planned (per-player share of daily plan)
        const plannedUAPerDayPerPlayer = plannedUAPerDay.map(ua => Math.round(ua / playerCount));

        const tableHead = `
    <thead>
        <tr>
            <th class="mc-th-player">Jugadora</th>
            ${DAY_LABELS.map((lbl, i) => {
                const d = dayDates[i];
                const isToday = toLocalISODate(d) === toLocalISODate(new Date());
                return `<th class="mc-th-day${isToday ? ' mc-th-today' : ''}">${lbl}<br><span class="mc-th-date">${d.getDate()}/${d.getMonth()+1}</span></th>`;
            }).join('')}
            <th class="mc-th-total">Total</th>
        </tr>
    </thead>`;

        const tableRows = this.players.map(player => {
            const cells = dayDateStrs.map((ds, i) => {
                const daySessions = this.sessions.filter(s => s.playerId === player.id && s.date && s.date.slice(0, 10) === ds);
                const realUA  = Math.round(daySessions.reduce((sum, s) => sum + (s.load || 0), 0));
                const planUA  = plannedUAPerDayPerPlayer[i];
                const cls     = trafficLight(realUA, planUA);
                return `<td class="mc-cell ${cls}" title="${cellTitle(realUA, planUA)}">${variationText(realUA, planUA)}</td>`;
            }).join('');

            const playerTotal = dayDateStrs.reduce((sum, ds) => {
                return sum + Math.round(this.sessions
                    .filter(s => s.playerId === player.id && s.date && s.date.slice(0, 10) === ds)
                    .reduce((a, s) => a + (s.load || 0), 0));
            }, 0);
            const playerPlannedTotal = plannedUAPerDayPerPlayer.reduce((a, b) => a + b, 0);
            const totalCls = trafficLight(playerTotal, playerPlannedTotal);

            return `
        <tr>
            <td class="mc-td-player">
                <div style="display:flex;align-items:center;gap:.4rem">
                    ${PlayerTokens.avatar(player, 20, '.45rem')}
                    <span class="mc-player-name">${esc(player.name)}</span>
                </div>
            </td>
            ${cells}
            <td class="mc-cell mc-cell-total ${totalCls}" title="${cellTitle(playerTotal, playerPlannedTotal)}">${variationText(playerTotal, playerPlannedTotal)}</td>
        </tr>`;
        }).join('');

        // Team totals row
        const teamTotalCells = dayDateStrs.map((ds, i) => {
            const ua  = realUAPerDay[i];
            const pua = plannedUAPerDay[i];
            const cls = trafficLight(ua, pua);
            return `<td class="mc-cell mc-cell-team ${cls}" title="${cellTitle(ua, pua)}">${variationText(ua, pua)}</td>`;
        }).join('');
        const teamTotalCls = trafficLight(totalRealUA, totalPlannedUA);
        const teamTotalRow = `
    <tr class="mc-team-total-row">
        <td class="mc-td-player"><strong>Equipo</strong></td>
        ${teamTotalCells}
        <td class="mc-cell mc-cell-total mc-cell-team ${teamTotalCls}" title="${cellTitle(totalRealUA, totalPlannedUA)}"><strong>${variationText(totalRealUA, totalPlannedUA)}</strong></td>
    </tr>`;

        const table = `
    <div class="wellness-card" style="overflow-x:auto">
        <h3 class="wellness-section-title">📋 Jugadora × Día — UA real vs planificada (% de variación)</h3>
        <div style="font-size:.72rem;color:var(--text-secondary);margin-bottom:.6rem;display:flex;gap:1rem;flex-wrap:wrap">
            <span><span class="mc-legend mc-cell-ok"></span> ±15% del plan</span>
            <span><span class="mc-legend mc-cell-warn"></span> ±15–40%</span>
            <span><span class="mc-legend mc-cell-bad"></span> &gt;40% de desviación</span>
            <span><span class="mc-legend mc-cell-extra"></span> Extra (sin plan)</span>
            <span><span class="mc-legend mc-cell-neutral"></span> Sin sesión</span>
        </div>
        <table class="mc-table">
            ${tableHead}
            <tbody>
                ${tableRows}
                ${teamTotalRow}
            </tbody>
        </table>
    </div>`;

        // ── Comparador de semanas (gráfico) ───────────────────────
        const model = this._mcComparisonModel();

        const pickers = ['a', 'b'].map(slot => {
            const chosen = slot === 'a' ? model.a : model.b;
            const options = model.weeks.map(w =>
                `<option value="${w.mondayKey}"${w.mondayKey === chosen.mondayKey ? ' selected' : ''}>${esc(w.optionText)}</option>`
            ).join('');
            return `
            <label class="mc-compare-picker">
                <span><span class="mc-swatch mc-swatch-${slot}"></span> Semana ${slot.toUpperCase()}</span>
                <select class="comp-select" onchange="window.rpeTracker?._mcSetWeek('${slot}', this.value)">${options}</select>
            </label>`;
        }).join('');

        const resetButton = model.isCustom
            ? `<div class="mc-compare-actions"><button class="btn-secondary mc-compare-btn" onclick="window.rpeTracker?._mcResetCompare()">↺ Actual vs anterior</button></div>`
            : '';

        const isRpe = model.metric === 'rpe';
        const chartTitle = (isRpe ? 'RPE medio diario' : 'Carga diaria') + (model.isCustom
            ? ': comparación de semanas'
            : ': semana actual vs anterior');

        const metricChips = [['ua', 'Carga UA'], ['rpe', 'RPE medio']].map(([key, text]) => {
            const active = model.metric === key;
            return `<button type="button" class="player-filter-chip ${active ? 'player-filter-chip--selected' : ''}"
                style="--chip-color:var(--primary)"
                onclick="window.rpeTracker?._mcSetMetric('${key}')">
                ${text}
                ${active ? '<span class="player-filter-chip-check">✓</span>' : ''}
            </button>`;
        }).join('');

        // Cabecera de columna de una semana: color, rango y (si hay) icono del bloque de temporada
        const weekHead = (slot, w) => {
            const blockIcon = w.block
                ? ` <span title="${esc(w.block.label)}" aria-label="${esc(w.block.label)}">${w.block.icon}</span>`
                : '';
            return `<span class="mc-swatch mc-swatch-${slot}"></span> ${esc(w.label)}${blockIcon}`;
        };

        // Celda de un día: valor del día en grande.
        //  · 1 sesión  → iconos (☀️/🌙 + tipo) al lado del valor; nada más (no se repite el número)
        //  · 2+ sesiones → debajo, el reparto por sesión (icono + valor), que sí aporta información
        const dayCell = (w, i) => {
            const sessions = w.sessionsPerDay[i];
            if (!sessions.length) return '<span class="mc-cmp-empty">–</span>';
            const main = isRpe ? fmtRpe(w.rpePerDay[i]) : w.uaPerDay[i];
            const icons = x => `${TIME_ICONS[x.timeOfDay] || ''}${TYPE_ICONS[x.type]}`;
            if (sessions.length === 1) {
                return `<span class="mc-cmp-main">${main}</span> <span class="mc-cmp-icons">${icons(sessions[0])}</span>`;
            }
            const detail = sessions.map(x => `${icons(x)} ${isRpe ? fmtRpe(x.rpe) : x.ua}`).join(' · ');
            return `<span class="mc-cmp-main">${main}</span><span class="mc-cmp-sub">${detail}</span>`;
        };

        const dayRows = DAY_LABELS.map((lbl, i) => {
            const hasA = model.a.sessionsPerDay[i].length > 0;
            const hasB = model.b.sessionsPerDay[i].length > 0;
            let delta = '–';
            if (hasA || hasB) {
                delta = isRpe
                    ? deltaHTML(hasA ? model.a.rpePerDay[i] : null, hasB ? model.b.rpePerDay[i] : null, 'rpe')
                    : deltaHTML(model.a.uaPerDay[i], model.b.uaPerDay[i], 'ua');
            }
            return `
            <tr>
                <td class="mc-cmp-day"><strong>${lbl}</strong><span class="mc-cmp-sub">${formatDM(addDays(model.a.mondayKey, i))} · ${formatDM(addDays(model.b.mondayKey, i))}</span></td>
                <td class="mc-cell">${dayCell(model.a, i)}</td>
                <td class="mc-cell">${dayCell(model.b, i)}</td>
                <td class="mc-cell mc-cmp-delta">${delta}</td>
            </tr>`;
        }).join('');

        // Resumen de la semana: siempre las tres cifras, sea cual sea la métrica de arriba
        const footRow = (label, a, b, delta) => `
            <tr class="mc-cmp-foot-row">
                <td class="mc-cmp-day"><strong>${label}</strong></td>
                <td class="mc-cell">${a}</td>
                <td class="mc-cell">${b}</td>
                <td class="mc-cell mc-cmp-delta">${delta}</td>
            </tr>`;
        const footRows =
            footRow('Total UA', model.a.totalUA, model.b.totalUA, deltaHTML(model.a.totalUA, model.b.totalUA, 'ua')) +
            footRow('RPE medio', fmtRpe(model.a.rpeMean), fmtRpe(model.b.rpeMean), deltaHTML(model.a.rpeMean, model.b.rpeMean, 'rpe')) +
            footRow('Sesiones', esc(compositionText(model.a.counts)), esc(compositionText(model.b.counts)),
                deltaHTML(model.a.totalSessions, model.b.totalSessions, 'count'));

        const comparisonTable = `
        <div class="wellness-card" style="margin-bottom:1.5rem;overflow-x:auto">
            <h3 class="wellness-section-title">🔁 Comparación día a día — ${isRpe ? 'RPE medio' : 'carga UA'}</h3>
            <table class="mc-cmp-table">
                <thead>
                    <tr>
                        <th class="mc-th-player">Día</th>
                        <th class="mc-th-day">${weekHead('a', model.a)}</th>
                        <th class="mc-th-day">${weekHead('b', model.b)}</th>
                        <th class="mc-th-day">Diferencia<br><span class="mc-th-date">A − B</span></th>
                    </tr>
                </thead>
                <tbody>${dayRows}</tbody>
                <tbody class="mc-cmp-foot">${footRows}</tbody>
            </table>
        </div>`;

        // ── Styles ────────────────────────────────────────────────
        const styles = `
    <style>
    /* ── Comparador de semanas ─────────────────────────── */
    .mc-compare-pickers{display:grid;grid-template-columns:repeat(auto-fit,minmax(250px,1fr));gap:.6rem;margin-bottom:.7rem}
    .mc-compare-picker{display:flex;flex-direction:column;gap:.25rem;font-size:.74rem;font-weight:600;color:var(--text-secondary);min-width:0}
    .mc-compare-picker .comp-select{width:100%;max-width:100%;text-overflow:ellipsis}
    .mc-compare-actions{display:flex;gap:.5rem;flex-wrap:wrap;margin-bottom:.7rem}
    .mc-compare-btn{font-size:.78rem;padding:.4rem .8rem}
    .mc-swatch{display:inline-block;width:14px;height:10px;border-radius:3px;vertical-align:middle;flex-shrink:0}
    .mc-swatch-a{background:var(--primary-color,#ff9800)}
    .mc-swatch-b{background:rgba(160,160,160,.5);border:1px solid rgba(120,120,120,.5)}
    .mc-metric-chips{margin-bottom:.7rem}
    /* Caja propia del gráfico: Chart.js dibuja con el alto de ESTA caja (no de toda la tarjeta) */
    .mc-chart-box{position:relative;width:100%;height:300px}
    @media (max-width:640px){.mc-chart-box{height:260px}}

    /* Tabla comparativa día a día */
    .mc-cmp-table{width:100%;border-collapse:separate;border-spacing:3px;font-size:.8rem}
    .mc-cmp-table .mc-th-day{white-space:normal}
    .mc-cmp-day{padding:.4rem .4rem;background:var(--bg-surface);border-radius:.4rem;white-space:nowrap;color:var(--text-primary)}
    .mc-cmp-day strong{display:block;font-size:.78rem}
    .mc-cmp-main{font-weight:700;color:var(--text-primary);font-size:.85rem}
    .mc-cmp-icons{font-size:.78rem;margin-left:.15rem;white-space:nowrap}
    .mc-cmp-sub{display:block;font-size:.66rem;font-weight:400;color:var(--text-secondary);line-height:1.25}
    .mc-cmp-empty{color:var(--text-secondary);font-weight:400}
    .mc-cmp-table .mc-cell{background:var(--bg-subtle);vertical-align:middle}
    .mc-cmp-delta{white-space:nowrap}
    .mc-delta{font-weight:700;color:var(--text-primary)}
    .mc-delta-up,.mc-delta-down{color:var(--text-primary)}
    .mc-delta-eq{color:var(--text-secondary)}
    .mc-delta-pct{font-weight:400;font-size:.72rem;color:var(--text-secondary)}
    .mc-cmp-foot-row td{background:color-mix(in srgb,var(--border-color) 30%,transparent) !important}
    .mc-cmp-foot-row .mc-cmp-day{background:color-mix(in srgb,var(--border-color) 30%,transparent)}

    /* ── Table (mismo patrón visual que Carga-Equipo: celdas
       separadas con aire, cada una con su propio radio) ──── */
    .mc-table{width:100%;border-collapse:separate;border-spacing:3px;font-size:.78rem;min-width:560px}
    .mc-th-player,.mc-th-day,.mc-th-total{padding:.4rem .4rem;text-align:center;font-weight:600;color:var(--text-secondary);font-size:.7rem;text-transform:uppercase;letter-spacing:.03em;white-space:nowrap;background:var(--bg-subtle);border-radius:.4rem}
    .mc-th-player{text-align:left;min-width:110px}
    .mc-th-today{color:var(--accent-color,#2196f3);outline:2px solid var(--accent-color,#2196f3);outline-offset:-2px}
    .mc-th-date{font-weight:400;font-size:.65rem}
    .mc-td-player{padding:.4rem .4rem;white-space:nowrap;background:var(--bg-surface);border-radius:.4rem}
    .mc-player-name{font-size:.78rem;font-weight:500;color:var(--text-primary)}
    .mc-cell{text-align:center;padding:.4rem .3rem;font-size:.75rem;font-weight:600;border-radius:.4rem;color:var(--text-primary)}
    .mc-cell-ok     {background:color-mix(in srgb,var(--success-color,#4caf50) 18%,transparent)}
    .mc-cell-warn   {background:color-mix(in srgb,var(--warning-color,#ff9800) 18%,transparent)}
    .mc-cell-bad    {background:color-mix(in srgb,var(--danger-color,#f44336) 18%,transparent)}
    .mc-cell-neutral{color:var(--text-secondary);background:var(--bg-subtle)}
    .mc-cell-extra  {background:color-mix(in srgb,var(--accent-color,#2196f3) 15%,transparent)}
    .mc-cell-total  {font-weight:700}
    .mc-cell-team   {opacity:.85}
    .mc-team-total-row td{background:color-mix(in srgb,var(--border-color) 30%,transparent)}

    /* ── Legend swatches ───────────────────────────────── */
    .mc-legend{display:inline-block;width:12px;height:12px;border-radius:.2rem;vertical-align:middle;margin-right:.2rem}
    .mc-legend.mc-cell-ok     {background:color-mix(in srgb,var(--success-color,#4caf50) 40%,transparent);border:1px solid var(--success-color,#4caf50)}
    .mc-legend.mc-cell-warn   {background:color-mix(in srgb,var(--warning-color,#ff9800) 40%,transparent);border:1px solid var(--warning-color,#ff9800)}
    .mc-legend.mc-cell-bad    {background:color-mix(in srgb,var(--danger-color,#f44336) 40%,transparent);border:1px solid var(--danger-color,#f44336)}
    .mc-legend.mc-cell-extra  {background:color-mix(in srgb,var(--accent-color,#2196f3) 40%,transparent);border:1px solid var(--accent-color,#2196f3)}
    .mc-legend.mc-cell-neutral{background:var(--border-color);border:1px solid var(--text-secondary)}
    </style>`;

        container.innerHTML = `
        ${styles}
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;flex-wrap:wrap;gap:.4rem">
            <h2 class="view-title" style="margin:0">📆 Dashboard Microciclo</h2>
            <div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">
                <span style="font-size:.78rem;color:var(--text-secondary)">${formatRange(currentMonday)}</span>
                <button class="btn-secondary" style="font-size:.8rem;padding:.4rem .85rem" onclick="window.rpeTracker?.generateTeamWeeklyReport()" title="Informe de equipo" aria-label="Informe de equipo">📊</button>
            </div>
        </div>
        <div class="wellness-card" style="margin-bottom:1.5rem">
            <h3 class="wellness-section-title">📊 ${chartTitle}</h3>
            <div class="player-filter-chips mc-metric-chips">${metricChips}</div>
            <div class="mc-compare-pickers">${pickers}</div>
            ${resetButton}
            <div class="mc-chart-box"><canvas id="mcWeekCompareChart"></canvas></div>
        </div>
        ${comparisonTable}
        ${table}`;

        // Draw bar chart after DOM is ready
        requestAnimationFrame(() => {
            const canvas = document.getElementById('mcWeekCompareChart');
            if (!canvas || typeof Chart === 'undefined') return;
            if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }

            const isDark = document.documentElement.getAttribute('data-theme') === 'dark'
                || document.body.classList.contains('dark-mode')
                || window.matchMedia('(prefers-color-scheme:dark)').matches;
            const gridColor = isDark ? 'rgba(255,255,255,.08)' : 'rgba(0,0,0,.07)';
            const textColor = isDark ? 'rgba(255,255,255,.55)' : 'rgba(0,0,0,.45)';
            const primaryColor = getComputedStyle(document.documentElement)
                .getPropertyValue('--primary-color').trim() || '#ff9800';
            const prevColor = isDark ? 'rgba(180,180,180,.35)' : 'rgba(140,140,140,.35)';
            const prevBorder = isDark ? 'rgba(200,200,200,.5)' : 'rgba(100,100,100,.4)';

            canvas._chartInstance = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: DAY_LABELS,
                    datasets: [
                        {
                            label: model.a.label,
                            data: isRpe ? model.a.rpePerDay.map(roundRpe) : model.a.uaPerDay,
                            backgroundColor: primaryColor,
                            borderRadius: 4,
                            borderSkipped: false
                        },
                        {
                            label: model.b.label,
                            data: isRpe ? model.b.rpePerDay.map(roundRpe) : model.b.uaPerDay,
                            backgroundColor: prevColor,
                            borderColor: prevBorder,
                            borderWidth: 1,
                            borderRadius: 4,
                            borderSkipped: false
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            padding: 10,
                            titleFont: { size: 13 },
                            bodyFont: { size: 13 },
                            callbacks: {
                                // Línea principal + una línea por sesión de ese día
                                label: ctx => {
                                    const w = ctx.datasetIndex === 0 ? model.a : model.b;
                                    const head = isRpe
                                        ? ` ${ctx.dataset.label}: RPE ${fmtRpe(ctx.parsed.y)}`
                                        : ` ${ctx.dataset.label}: ${ctx.parsed.y} UA`;
                                    const lines = (w.sessionsPerDay[ctx.dataIndex] || []).map(x =>
                                        `   ${TIME_ICONS[x.timeOfDay] || ''} ${TYPE_ICONS[x.type]} RPE ${fmtRpe(x.rpe)} · ${x.ua} UA`);
                                    return [head, ...lines];
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 12 } }
                        },
                        y: isRpe
                            ? {
                                min: 0, max: 10,
                                grid: { color: gridColor },
                                title: { display: true, text: 'RPE', color: textColor, font: { size: 12 } },
                                ticks: { color: textColor, font: { size: 12 }, stepSize: 2 }
                            }
                            : {
                                beginAtZero: true,
                                grid: { color: gridColor },
                                title: { display: true, text: 'UA', color: textColor, font: { size: 12 } },
                                ticks: { color: textColor, font: { size: 12 } }
                            }
                    }
                }
            });
        });
    };
})();

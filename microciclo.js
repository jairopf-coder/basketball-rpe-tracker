// ========== MICROCICLO (microciclo.js) ==========
// Vista Carga → Microciclo  (#microcicloView → #microcicloContent)
//   1. Gráfico "Carga diaria" que compara DOS semanas a elegir.
//      Por defecto: la semana actual frente a la anterior.
//   2. Tabla Jugadora × Día de la semana actual (UA real frente al plan).
// Esta vista solo LEE datos (sesiones y plan semanal): no guarda nada.
// La selección de semanas se recuerda mientras la app está abierta y
// no se persiste (al recargar vuelve a "actual vs anterior").

(function () {
    'use strict';

    const DAY_KEYS   = ['lun', 'mar', 'mie', 'jue', 'vie', 'sab', 'dom'];
    const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
    const ISO_DATE   = /^\d{4}-\d{2}-\d{2}/;

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

    function formatRange(mondayKey) {
        const fmt = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
        return `${fmt(dateFromISO(mondayKey))} – ${fmt(dateFromISO(addDays(mondayKey, 6)))}`;
    }

    // Texto corto con el que se reconoce una semana: bloque de temporada,
    // nº de entrenos/partidos y carga total. Ej.: "🏗️ Pretemporada · 4 ent + 1 part · 3200 UA"
    function describeWeek(s) {
        const parts = [];
        if (s.trainings) parts.push(`${s.trainings} ent`);
        if (s.matches)   parts.push(`${s.matches} part`);
        if (s.others)    parts.push(`${s.others} otras`); // tiro, gimnasio, recuperación
        const bits = [];
        if (s.block) bits.push(`${s.block.icon} ${s.block.label}`);
        bits.push(parts.length ? parts.join(' + ') : 'sin sesiones');
        bits.push(`${s.totalUA} UA`);
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

    // Resumen de una semana: UA por día, totales y composición
    RPETracker.prototype._mcWeekSummary = function (mondayKey, sessionsOfWeek) {
        const uaByDate = {};
        // Una "sesión de equipo" = fecha + turno + tipo (mismo criterio que el Historial)
        const teamSessions = new Set();
        let trainings = 0, matches = 0, others = 0;

        sessionsOfWeek.forEach(s => {
            const date = s.date.slice(0, 10);
            uaByDate[date] = (uaByDate[date] || 0) + (s.load || 0);

            const type = s.type || 'training';
            const key = `${date}_${s.timeOfDay || 'unknown'}_${type}`;
            if (teamSessions.has(key)) return;
            teamSessions.add(key);
            if (type === 'match') matches++;
            else if (type === 'training') trainings++;
            else others++;
        });

        const uaPerDay = DAY_KEYS.map((_, i) => Math.round(uaByDate[addDays(mondayKey, i)] || 0));
        return {
            mondayKey,
            label: formatRange(mondayKey),
            uaPerDay,
            totalUA: uaPerDay.reduce((a, b) => a + b, 0),
            trainings, matches, others,
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

        // Semanas con sesiones + la actual y la anterior (aunque estén vacías) + las elegidas
        const keys = new Set([...byWeek.keys(), currentKey, previousKey, keyA, keyB]);
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
            // Solo se ofrece si hay Firebase y aún no se ha traído todo el histórico
            canLoadOlder: !!window.firebaseSync && !this._fullHistoryLoaded
        };
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

    // Trae el histórico completo (mismo mecanismo que el botón del dashboard)
    // para poder elegir semanas de temporadas anteriores.
    RPETracker.prototype._mcLoadOlderWeeks = async function () {
        if (this._mcLoadingHistory) return;
        this._mcLoadingHistory = true;
        try {
            await this.ensureFullSessionHistory();
            this.showToast(`📜 Histórico cargado (${this.sessions.length} sesiones)`);
        } catch (e) {
            console.error('Microciclo: no se pudo cargar el histórico', e);
            this.showToast('❌ No se pudo cargar el histórico');
        } finally {
            this._mcLoadingHistory = false;
            this.renderMicrociclo();
        }
    };

    // ── Vista ──────────────────────────────────────────────────────────

    RPETracker.prototype.renderMicrociclo = function () {
        const container = document.getElementById('microcicloContent');
        if (!container) return;

        if (!this.weekPlan) this.loadWeekPlan();

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
                const symbol  = planUA === 0 && realUA === 0 ? '–' :
                                planUA === 0 ? `${realUA}` :
                                `${realUA}<span class="mc-plan-of">/${planUA}</span>`;
                return `<td class="mc-cell ${cls}">${symbol}</td>`;
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
            <td class="mc-cell mc-cell-total ${totalCls}">${playerTotal}<span class="mc-plan-of">/${playerPlannedTotal}</span></td>
        </tr>`;
        }).join('');

        // Team totals row
        const teamTotalCells = dayDateStrs.map((ds, i) => {
            const ua  = realUAPerDay[i];
            const pua = plannedUAPerDay[i];
            const cls = trafficLight(ua, pua);
            const sym = pua === 0 && ua === 0 ? '–' : `${ua}<span class="mc-plan-of">/${pua}</span>`;
            return `<td class="mc-cell mc-cell-team ${cls}">${sym}</td>`;
        }).join('');
        const teamTotalCls = trafficLight(totalRealUA, totalPlannedUA);
        const teamTotalRow = `
    <tr class="mc-team-total-row">
        <td class="mc-td-player"><strong>Equipo</strong></td>
        ${teamTotalCells}
        <td class="mc-cell mc-cell-total mc-cell-team ${teamTotalCls}"><strong>${totalRealUA}<span class="mc-plan-of">/${totalPlannedUA}</span></strong></td>
    </tr>`;

        const table = `
    <div class="wellness-card" style="overflow-x:auto">
        <h3 class="wellness-section-title">📋 Jugadora × Día — UA real / planificada</h3>
        <div style="font-size:.72rem;color:var(--text-secondary);margin-bottom:.6rem;display:flex;gap:1rem;flex-wrap:wrap">
            <span><span class="mc-legend mc-cell-ok"></span> ±15% del plan</span>
            <span><span class="mc-legend mc-cell-warn"></span> ±15–40%</span>
            <span><span class="mc-legend mc-cell-bad"></span> &gt;40% desviación</span>
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

        const actions = [];
        if (model.isCustom) {
            actions.push(`<button class="btn-secondary mc-compare-btn" onclick="window.rpeTracker?._mcResetCompare()">↺ Actual vs anterior</button>`);
        }
        if (model.canLoadOlder) {
            actions.push(`<button class="btn-secondary mc-compare-btn" onclick="window.rpeTracker?._mcLoadOlderWeeks()" title="Trae las sesiones de temporadas anteriores para poder compararlas">📜 Cargar temporadas anteriores</button>`);
        }

        const chartTitle = model.isCustom
            ? 'Carga diaria: comparación de semanas'
            : 'Carga diaria: semana actual vs anterior';

        const chartLegend = [model.a, model.b].map((s, i) => `
            <span class="mc-legend-item">
                <span class="mc-swatch mc-swatch-${i === 0 ? 'a' : 'b'}"></span>
                <span><strong>${esc(s.label)}</strong> · ${esc(describeWeek(s))}</span>
            </span>`).join('');

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
    .mc-chart-legend{display:flex;flex-direction:column;gap:.35rem;margin-top:.65rem;font-size:.76rem;color:var(--text-secondary)}
    .mc-legend-item{display:flex;align-items:center;gap:.4rem}

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
    .mc-plan-of{font-weight:400;font-size:.68rem;color:var(--text-secondary)}
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
            <div class="mc-compare-pickers">${pickers}</div>
            ${actions.length ? `<div class="mc-compare-actions">${actions.join('')}</div>` : ''}
            <canvas id="mcWeekCompareChart" class="chart-canvas"></canvas>
            <div class="mc-chart-legend">${chartLegend}</div>
        </div>
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
                            data: model.a.uaPerDay,
                            backgroundColor: primaryColor,
                            borderRadius: 4,
                            borderSkipped: false
                        },
                        {
                            label: model.b.label,
                            data: model.b.uaPerDay,
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
                            callbacks: {
                                label: ctx => ` ${ctx.dataset.label}: ${ctx.parsed.y} UA`
                            }
                        }
                    },
                    scales: {
                        x: {
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 11 } }
                        },
                        y: {
                            beginAtZero: true,
                            grid: { color: gridColor },
                            ticks: { color: textColor, font: { size: 11 },
                                callback: v => v + ' UA' }
                        }
                    }
                }
            });
        });
    };
})();

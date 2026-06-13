// app-analytics.js — Módulo de analíticas: evolución, A:C, Foster, RPE plan vs real (extraído de app.js V24)
RPETracker.prototype._setAnalyticsTab = function(tab) {
    // Legacy: tab switching removed, single scrollable view
    this.renderAnalytics();
};

RPETracker.prototype._renderACCurveTab = function() {
    // Player selector checkboxes
    const checks = this.players.map((p, i) => {
        const color = PlayerTokens.get(p);
        const checked = !this._acExcluded?.has(p.id);
        return `<label class="ac-curve-check" style="--chk-color:${color}">
            <input type="checkbox" value="${p.id}" ${checked?'checked':''}
                onchange="window.rpeTracker?._acTogglePlayer('${p.id}',this.checked)">
            <span class="ac-chk-dot" style="background:${color}"></span>
            ${p.name}${p.number?` <small>#${p.number}</small>`:''}
        </label>`;
    }).join('');

    // Window selector
    const win = this._acWindow || 28;

    // Season comparison selectors
    const allSeasons = Store.getSeasonsFromSessions(this.sessions);
    const activeSeason = Store.getActiveSeason();
    const selA = this._acSeasonA || activeSeason;
    const selB = this._acSeasonB || '';

    const seasonOpts = (current, allowEmpty) =>
        (allowEmpty ? `<option value="">— sin comparar —</option>` : '') +
        allSeasons.map(s =>
            `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`
        ).join('');

    return `<div class="ac-curve-wrap">
        <div class="ac-curve-controls">
            <div class="ac-curve-players">${checks}</div>
            <div class="ac-curve-right">
                <label class="ac-win-label">Ventana</label>
                <select class="ac-win-sel" onchange="window.rpeTracker?._acSetWindow(+this.value)">
                    <option value="14" ${win===14?'selected':''}>14 días</option>
                    <option value="28" ${win===28?'selected':''}>28 días</option>
                    <option value="56" ${win===56?'selected':''}>56 días</option>
                </select>
            </div>
        </div>
        <div class="ac-season-compare-row">
            <span class="ac-season-label">🗓️ Temporada A</span>
            <select class="ac-season-sel" id="acSeasonSelA"
                onchange="window.rpeTracker?._acSetSeasonA(this.value)">
                ${seasonOpts(selA, false)}
            </select>
            <span class="ac-season-sep">vs</span>
            <span class="ac-season-label">Temporada B</span>
            <select class="ac-season-sel" id="acSeasonSelB"
                onchange="window.rpeTracker?._acSetSeasonB(this.value)">
                ${seasonOpts(selB, true)}
            </select>
        </div>
        <div class="ac-curve-chart-wrap">
            <canvas id="acCurveCanvas" style="width:100%;height:300px"></canvas>
        </div>
        <div class="ac-curve-legend">
            <span class="ac-legend-line" style="background:#e53935;opacity:.25;height:2px;width:20px;display:inline-block;vertical-align:middle"></span>
            <span style="font-size:.72rem;color:var(--text-faint)">Zona peligro &gt;1.5</span>
            <span class="ac-legend-line" style="background:#fb8c00;opacity:.25;height:2px;width:20px;display:inline-block;vertical-align:middle;margin-left:.75rem"></span>
            <span style="font-size:.72rem;color:var(--text-faint)">Zona precaución 1.3–1.5</span>
            <span style="font-size:.72rem;color:var(--text-faint);margin-left:.75rem">— línea sólida: Temporada A &nbsp;· · · discontinua: Temporada B</span>
        </div>
    </div>`;
};

RPETracker.prototype._drawACCurveChart = function() {
    const canvas = document.getElementById('acCurveCanvas');
    if (!canvas || typeof Chart === 'undefined') return;
    if (canvas._ci) { canvas._ci.destroy(); canvas._ci = null; }

    const days    = this._acWindow || 28;
    const now     = new Date();
    const labels  = [];
    for (let d = days - 1; d >= 0; d--) {
        const dt = new Date(now);
        dt.setDate(now.getDate() - d);
        labels.push(dt.toLocaleDateString('es-ES', { day:'numeric', month:'short' }));
    }

    const excluded = this._acExcluded || new Set();
    const lambdaA  = 2 / (7 + 1);
    const lambdaC  = 2 / (28 + 1);
    const seasonA  = this._acSeasonA || Store.getActiveSeason();
    const seasonB  = this._acSeasonB || '';

    // Helper: construye serie de ratio EWMA filtrada por temporada
    const buildRatioSeries = (player, seasonFilter) => {
        const psess = this.sessions
            .filter(s => s.playerId === player.id &&
                (seasonFilter ? (s.season || Store.getActiveSeason()) === seasonFilter : true))
            .map(s => ({ date: new Date(s.date), load: s.load || s.rpe * (s.duration || 60) }))
            .sort((a,b) => a.date - b.date);
        const seed = psess.length ? psess.reduce((acc,x) => acc + x.load, 0) / psess.length : 0;
        let ewA = seed, ewC = seed;
        const ratiosByDay = {};
        for (let i = 84; i >= 0; i--) {
            const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0,0,0,0);
            const load = psess.filter(s => {
                const sd = new Date(s.date); sd.setHours(0,0,0,0);
                return sd.getTime() === d.getTime();
            }).reduce((acc,x) => acc + x.load, 0);
            ewA = lambdaA * load + (1 - lambdaA) * ewA;
            ewC = lambdaC * load + (1 - lambdaC) * ewC;
            if (i < days) {
                ratiosByDay[days - 1 - i] = ewC > 0 ? parseFloat((ewA / ewC).toFixed(3)) : null;
            }
        }
        return Array.from({length: days}, (_, i) => ratiosByDay[i] ?? null);
    };

    const datasets = [];
    const activePlayers = this.players.filter(p => !excluded.has(p.id));

    activePlayers.forEach(p => {
        const color = PlayerTokens.get(p);
        const label = p.name + (p.number ? ` #${p.number}` : '');

        // Serie A — línea sólida
        datasets.push({
            label: `${label} (${seasonA})`,
            data: buildRatioSeries(p, seasonA),
            borderColor: color,
            backgroundColor: color + '18',
            borderWidth: 2,
            borderDash: [],
            pointRadius: 2,
            tension: 0.35,
            spanGaps: true
        });

        // Serie B — línea discontinua, mismo color, sin relleno
        if (seasonB) {
            datasets.push({
                label: `${label} (${seasonB})`,
                data: buildRatioSeries(p, seasonB),
                borderColor: color,
                backgroundColor: 'transparent',
                borderWidth: 2,
                borderDash: [6, 4],
                pointRadius: 2,
                pointStyle: 'triangle',
                tension: 0.35,
                spanGaps: true
            });
        }
    });

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridC  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const textC  = isDark ? '#888' : '#999';

    canvas._ci = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        boxWidth: 12, font: { size: 11 }, color: textC,
                        generateLabels: chart => chart.data.datasets.map((ds, i) => ({
                            text: ds.label,
                            fillStyle: ds.borderColor,
                            strokeStyle: ds.borderColor,
                            lineDash: ds.borderDash || [],
                            lineWidth: 2,
                            hidden: !chart.isDatasetVisible(i),
                            datasetIndex: i
                        }))
                    }
                },
                tooltip: { mode: 'index', intersect: false,
                    callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw?.toFixed(2) ?? '—'}` }
                },
                annotation: { annotations: {
                    danger:  { type:'line', yMin:1.5, yMax:1.5, borderColor:'rgba(229,57,53,.4)',  borderWidth:1.5, borderDash:[4,4] },
                    caution: { type:'line', yMin:1.3, yMax:1.3, borderColor:'rgba(251,140,0,.35)', borderWidth:1.5, borderDash:[4,4] },
                    low:     { type:'line', yMin:0.8, yMax:0.8, borderColor:'rgba(30,136,229,.35)',borderWidth:1.5, borderDash:[4,4] }
                }}
            },
            scales: {
                x: { ticks: { color: textC, maxTicksLimit: 7, font: { size: 10 } }, grid: { color: gridC } },
                y: { min: 0, max: 2.2, ticks: { color: textC, font: { size: 10 } }, grid: { color: gridC } }
            }
        }
    });
};

RPETracker.prototype._acTogglePlayer = function(id, checked) {
    if (!this._acExcluded) this._acExcluded = new Set();
    if (checked) this._acExcluded.delete(id); else this._acExcluded.add(id);
    requestAnimationFrame(() => this._drawACCurveChart());
};

RPETracker.prototype._acSetWindow = function(days) {
    this._acWindow = days;
    this.renderAnalytics();
};

RPETracker.prototype._acSetSeasonA = function(season) {
    this._acSeasonA = season;
    requestAnimationFrame(() => this._drawACCurveChart());
};

RPETracker.prototype._acSetSeasonB = function(season) {
    this._acSeasonB = season;
    requestAnimationFrame(() => this._drawACCurveChart());
};

RPETracker.prototype._renderInjuryTrendTab = function() {
    const injuries = this.injuries || [];
    if (!injuries.length) return `<div class="an-empty">🦴 Sin lesiones registradas</div>`;

    const zones = {};
    injuries.forEach(inj => {
        const loc = this.getLocationName?.(inj.location) || inj.location || 'Desconocida';
        if (!zones[loc]) zones[loc] = { active: 0, resolved: 0, total: 0 };
        zones[loc].total++;
        if (inj.status === 'active') zones[loc].active++;
        else zones[loc].resolved++;
    });

    const sorted = Object.entries(zones).sort((a,b) => b[1].total - a[1].total);
    const maxVal = Math.max(...sorted.map(([,v]) => v.total), 1);

    const bars = sorted.map(([loc, v]) => `
        <div class="inj-trend-row">
            <div class="inj-trend-loc">${loc}</div>
            <div class="inj-trend-bar-wrap">
                <div class="inj-trend-bar-resolved" style="width:${(v.resolved/maxVal*100).toFixed(0)}%"></div>
                <div class="inj-trend-bar-active"   style="width:${(v.active/maxVal*100).toFixed(0)}%"></div>
            </div>
            <div class="inj-trend-count">${v.total}</div>
        </div>`).join('');

    // Monthly trend
    const byMonth = {};
    injuries.forEach(inj => {
        if (!inj.date) return;
        const key = inj.date.slice(0, 7);
        if (!byMonth[key]) byMonth[key] = 0;
        byMonth[key]++;
    });
    const monthKeys = Object.keys(byMonth).sort().slice(-12);
    const monthBars = monthKeys.map(k => {
        const n = byMonth[k];
        const h = Math.min(n * 20, 80);
        const [y, m] = k.split('-');
        const lbl = new Date(+y, +m-1, 1).toLocaleDateString('es-ES',{month:'short'});
        return `<div class="inj-month-col">
            <div class="inj-month-bar" style="height:${h}px" title="${n} lesiones"></div>
            <div class="inj-month-val">${n}</div>
            <div class="inj-month-lbl">${lbl}</div>
        </div>`;
    }).join('');

    return `<div class="inj-trend-wrap">
        <h4 class="an-section-title">Lesiones por zona corporal</h4>
        <div class="inj-trend-legend">
            <span class="inj-leg-dot inj-leg-resolved"></span>Resueltas
            <span class="inj-leg-dot inj-leg-active" style="margin-left:.75rem"></span>Activas
        </div>
        <div class="inj-trend-chart">${bars}</div>
        ${monthKeys.length > 1 ? `
        <h4 class="an-section-title" style="margin-top:1.5rem">Frecuencia mensual</h4>
        <div class="inj-month-chart">${monthBars}</div>` : ''}
    </div>`;
};

RPETracker.prototype.renderAnalytics = function() {
    const container = document.getElementById('analyticsContent');
    if (!container) return;

    if (this.players.length === 0) {
        container.innerHTML = `
            <div class="empty-state active">
                <div class="empty-icon">📈</div>
                <h3>No hay datos para analizar</h3>
                <p>Añade jugadoras y registra sesiones para ver el análisis</p>
            </div>
        `;
        return;
    }

    this._renderSemaphoreBar();
    const ewmaOpen = Store.getString('ewmaOpen') === 'true';

    container.innerHTML = `
        <!-- 1. Curvas A:C — protagonista -->
        <div class="an-section-block">
            ${this._renderACCurveTab()}
            <details class="ewma-info-box" id="ewmaDetails" ${ewmaOpen?'open':''}>
                <summary class="ewma-summary">
                    <span>ℹ️ Método EWMA — ¿Cómo se calcula el ratio A:C?</span>
                    <span class="ewma-toggle-hint">ver más</span>
                </summary>
                <div class="ewma-body">
                    <p style="margin-bottom:0.5rem"><strong>Carga = RPE × Duración</strong> (método sRPE)</p>
                    <p style="margin-bottom:0.5rem">Esta app usa el <strong>método EWMA</strong>, el estándar científico usado por equipos profesionales para calcular el ratio Agudo:Crónico.</p>
                    <p style="margin-bottom:0.5rem"><strong>Interpretación del Ratio:</strong></p>
                    <ul style="margin-left:1.5rem;color:var(--gray)">
                        <li><strong style="color:#2e7d32">0.8–1.3 (Verde):</strong> 🟢 Zona óptima</li>
                        <li><strong style="color:#ef6c00">1.3–1.5 (Naranja):</strong> 🟠 Precaución</li>
                        <li><strong style="color:#c62828">&gt;1.5 (Rojo):</strong> 🔴 Peligro</li>
                        <li><strong style="color:#1565c0">&lt;0.8 (Azul):</strong> 🔵 Descarga</li>
                    </ul>
                </div>
            </details>
        </div>

        <!-- 2. Tabla comparativa -->
        <div class="an-section-block">
            ${this.renderPlayerComparison()}
        </div>

        <!-- 3. RPE Plan vs Real -->
        <div class="an-section-block" id="rpePlanVsRealBlock">
            ${this._renderRpePlanVsReal()}
        </div>

        <!-- 4. Evolución individual -->
        <div id="evolutionCharts"></div>

        <!-- 5. Comparador -->
        <div id="comparisonModule"></div>
    `;

    requestAnimationFrame(() => this._drawACCurveChart());
    this.renderEvolutionCharts();
    setTimeout(() => this.renderComparisonModule(), 50);
};

RPETracker.prototype._renderRpePlanVsReal = function() {
    const INTENSITY_RPE = { none: 0, low: 4, medium: 6, high: 7.5, max: 9 };
    const INTENSITY_LABEL = { none: 'Descanso', low: 'Baja', medium: 'Media', high: 'Alta', max: 'Máx.' };
    const DAY_KEYS = ['dom','lun','mar','mie','jue','vie','sab'];

    // Build lookup: { "YYYY-MM-DD_morning": { intensity, rpe, type, focus, duration }, ... }
    // Covering last 8 weeks with a sliding weekOffset per-week
    const planLookup = {};
    const plan = this.weekPlan?.days || {};

    // Reconstruct each week for the last 8 weeks by re-applying weekOffset logic
    // weekPlan.days is keyed by DAY_KEY (lun, mar…) — same plan repeats each week
    // We map sessions to the plan by day-of-week + timeOfDay slot
    // (The weekPlan is a template, not date-specific — same pattern each week)
    const planByDaySlot = {}; // { "lun_morning": {...}, "lun_afternoon": {...}, ... }
    DAY_KEYS.forEach(dk => {
        const d = plan[dk] || {};
        ['morning', 'afternoon'].forEach(slot => {
            const s = d[slot];
            if (s && s.enabled && s.type !== 'rest') {
                planByDaySlot[`${dk}_${slot}`] = {
                    intensity: s.intensity || 'none',
                    plannedRpe: INTENSITY_RPE[s.intensity] || 0,
                    intensityLabel: INTENSITY_LABEL[s.intensity] || '—',
                    type: s.type || 'training',
                    focus: s.focus || '',
                    duration: s.duration || 0
                };
            }
        });
    });

    // If no plan at all, show empty state
    const hasPlan = Object.keys(planByDaySlot).length > 0;

    // Build rows: for each session in last 8 weeks, try to match to plan slot
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 56); // 8 weeks back
    const recentSessions = this.sessions.filter(s => {
        if (!s.date || !s.rpe) return false;
        return new Date(s.date) >= cutoff;
    });

    const rows = [];
    recentSessions.forEach(s => {
        const dateObj = new Date(s.date);
        const dayKey  = DAY_KEYS[dateObj.getDay()];
        const slot    = s.timeOfDay || 'morning';
        const lookupKey = `${dayKey}_${slot}`;
        const planSlot = planByDaySlot[lookupKey];
        if (!planSlot) return; // no plan for this slot — skip
        if (planSlot.plannedRpe === 0) return; // rest day — skip

        const player = this.players.find(p => p.id === s.playerId);
        if (!player) return;

        const delta = parseFloat((s.rpe - planSlot.plannedRpe).toFixed(1));
        const absDelta = Math.abs(delta);
        const isMismatch = absDelta >= 2;
        const isHighMismatch = absDelta >= 3;
        let deltaIcon = '', deltaColor = 'var(--text-secondary)';
        if (isMismatch) {
            deltaIcon = delta > 0 ? '▲' : '▼';
            deltaColor = isHighMismatch ? '#f44336' : '#ff9800';
        } else {
            deltaIcon = '✓';
            deltaColor = '#4caf50';
        }

        rows.push({
            date: s.date,
            dateObj,
            player,
            planSlot,
            rpe: s.rpe,
            delta,
            absDelta,
            isMismatch,
            isHighMismatch,
            deltaIcon,
            deltaColor,
            slot
        });
    });

    rows.sort((a, b) => b.dateObj - a.dateObj);

    const mismatches = rows.filter(r => r.isMismatch).length;
    const highMismatches = rows.filter(r => r.isHighMismatch).length;

    const fmtDate = d => {
        const dateOnly = String(d).slice(0, 10);
        const obj = new Date(dateOnly + 'T12:00:00');
        if (isNaN(obj.getTime())) return d;
        return obj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    };
    const fmtSlot = s => s === 'morning' ? '🌅 Mañana' : '🌆 Tarde';

    // Player filter state (stored on instance)
    const filterPlayer = this._pvr_playerFilter || 'all';

    const filteredRows = filterPlayer === 'all'
        ? rows
        : rows.filter(r => r.player.id === filterPlayer);

    const playerOptions = this.players
        .filter(p => rows.some(r => r.player.id === p.id))
        .map(p => `<option value="${p.id}"${filterPlayer === p.id ? ' selected' : ''}>${esc(p.name)}</option>`)
        .join('');

    const tableRows = filteredRows.length === 0
        ? `<tr><td colspan="6" class="pvr-empty">Sin sesiones con plan asignado en el período seleccionado</td></tr>`
        : filteredRows.map(r => `
        <tr class="pvr-row${r.isMismatch ? ' pvr-row--mismatch' : ''}${r.isHighMismatch ? ' pvr-row--high' : ''}">
            <td class="pvr-date">${fmtDate(r.date)}</td>
            <td class="pvr-player">
                ${PlayerTokens.avatar(r.player, 20, '0.6rem')}
                <span>${r.player.name.split(' ')[0]}</span>
            </td>
            <td class="pvr-slot">${fmtSlot(r.slot)}</td>
            <td class="pvr-plan">
                <span class="pvr-intensity pvr-intensity--${r.planSlot.intensity}">${r.planSlot.intensityLabel}</span>
                <span class="pvr-rpe-val">${r.planSlot.plannedRpe}</span>
            </td>
            <td class="pvr-real">
                <span class="pvr-rpe-val pvr-rpe-real">${r.rpe}</span>
            </td>
            <td class="pvr-delta" style="color:${r.deltaColor}">
                <span class="pvr-delta-icon">${r.deltaIcon}</span>
                <span class="pvr-delta-val">${r.delta > 0 ? '+' : ''}${r.delta}</span>
            </td>
        </tr>`).join('');

    return `
    <div class="an-section-title-row">
        <h4 class="an-section-title">📋 RPE Planificado vs. Percibido</h4>
        ${mismatches > 0 ? `<span class="pvr-summary-badge pvr-summary-badge--warn">⚠️ ${mismatches} desajuste${mismatches !== 1 ? 's' : ''} ≥2 pts</span>` : ''}
        ${highMismatches > 0 ? `<span class="pvr-summary-badge pvr-summary-badge--crit">🔴 ${highMismatches} crítico${highMismatches !== 1 ? 's' : ''} ≥3 pts</span>` : ''}
        ${mismatches === 0 && rows.length > 0 ? `<span class="pvr-summary-badge pvr-summary-badge--ok">✅ Sin desajustes</span>` : ''}
    </div>
    ${!hasPlan ? `
    <div class="pvr-no-plan">
        <span>📅</span> No hay plan semanal configurado. Actívalo en la pestaña <strong>Planificación</strong> para cruzar los datos.
    </div>` : rows.length === 0 ? `
    <div class="pvr-no-plan">
        <span>📋</span> No hay sesiones recientes que coincidan con el plan semanal (últimas 8 semanas).
    </div>` : `
    <div class="pvr-controls">
        <label class="pvr-filter-label">Jugadora:
            <select class="pvr-player-select" onchange="window.rpeTracker?._pvrSetFilter(this.value)">
                <option value="all"${filterPlayer === 'all' ? ' selected' : ''}>Todas</option>
                ${playerOptions}
            </select>
        </label>
        <span class="pvr-legend">
            <span style="color:#4caf50">✓ OK</span>
            <span style="color:#ff9800">▲▼ ≥2 pts</span>
            <span style="color:#f44336">▲▼ ≥3 pts (crítico)</span>
        </span>
    </div>
    <div class="pvr-table-wrap">
        <table class="pvr-table">
            <thead>
                <tr>
                    <th>Fecha</th>
                    <th>Jugadora</th>
                    <th>Sesión</th>
                    <th>RPE Plan</th>
                    <th>RPE Real</th>
                    <th>Δ</th>
                </tr>
            </thead>
            <tbody>${tableRows}</tbody>
        </table>
    </div>`}`;
};

RPETracker.prototype._pvrSetFilter = function(playerId) {
    this._pvr_playerFilter = playerId;
    const block = document.getElementById('rpePlanVsRealBlock');
    if (block) block.innerHTML = this._renderRpePlanVsReal();
};

RPETracker.prototype._calcFosterMetrics = function(playerId) {
    const MATCH_MULT = RPETracker.MATCH_LOAD_MULTIPLIER;
    const now = new Date();
    const dailyLoads = [];
    for (let i = 6; i >= 0; i--) {
        const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - i); dayStart.setHours(0,0,0,0);
        const dayEnd   = new Date(dayStart); dayEnd.setHours(23,59,59,999);
        const load = this.sessions
            .filter(s => s.playerId === playerId)
            .filter(s => { const sd = new Date(s.date); return sd >= dayStart && sd <= dayEnd; })
            .reduce((sum, s) => sum + (s.load || (s.rpe * (s.duration || 60))) * (s.type === 'match' ? MATCH_MULT : 1), 0);
        dailyLoads.push(load);
    }
    const total7d = dailyLoads.reduce((a, b) => a + b, 0);
    const mean7d  = total7d / 7;
    const variance = dailyLoads.reduce((acc, v) => acc + Math.pow(v - mean7d, 2), 0) / 7;
    const sd7d    = Math.sqrt(variance);
    const monotony = sd7d > 0 ? mean7d / sd7d : null;
    const strain   = monotony !== null ? total7d * monotony : null;
    return { dailyLoads, total7d: Math.round(total7d), mean7d: Math.round(mean7d), sd7d: Math.round(sd7d), monotony, strain };
};

RPETracker.prototype._renderFosterBlock = function(player) {
    const m = this._calcFosterMetrics(player.id);
    if (m.total7d === 0) return `<div class="foster-block foster-block--empty">Sin carga en los últimos 7 días</div>`;

    const monoVal  = m.monotony !== null ? m.monotony.toFixed(2) : '—';
    const strainVal = m.strain !== null ? Math.round(m.strain).toLocaleString('es-ES') : '—';

    // Semáforo monotonía
    const monoCls = m.monotony === null ? 'foster-pill--neutral'
        : m.monotony > 2   ? 'foster-pill--danger'
        : m.monotony > 1.5 ? 'foster-pill--warning'
        : 'foster-pill--ok';
    const monoIcon = m.monotony === null ? '—' : m.monotony > 2 ? '🔴' : m.monotony > 1.5 ? '🟠' : '🟢';

    // Semáforo strain
    const strainCls = m.strain === null ? 'foster-pill--neutral'
        : m.strain > 6000 ? 'foster-pill--danger'
        : m.strain > 4500 ? 'foster-pill--warning'
        : 'foster-pill--ok';
    const strainIcon = m.strain === null ? '—' : m.strain > 6000 ? '🔴' : m.strain > 4500 ? '🟠' : '🟢';

    return `<div class="foster-block">
        <div class="foster-row">
            <div class="foster-metric">
                <span class="foster-label">Monotonía</span>
                <span class="foster-pill ${monoCls}">${monoIcon} ${monoVal}</span>
                <span class="foster-hint">umbral &gt;2</span>
            </div>
            <div class="foster-metric">
                <span class="foster-label">Strain</span>
                <span class="foster-pill ${strainCls}">${strainIcon} ${strainVal} UA</span>
                <span class="foster-hint">umbral &gt;6000</span>
            </div>
            <div class="foster-metric foster-metric--load">
                <span class="foster-label">Carga 7d</span>
                <span class="foster-value">${m.total7d.toLocaleString('es-ES')} UA</span>
                <span class="foster-hint">media ${m.mean7d} · SD ${m.sd7d}</span>
            </div>
        </div>
    </div>`;
};

RPETracker.prototype.renderEvolutionCharts = function() {
    const container = document.getElementById('evolutionCharts');
    if (!container) return;

    if (this.players.length === 0) {
        container.innerHTML = '';
        return;
    }

    // Restore previously selected players from sessionStorage
    let selected = (() => {
        try { return JSON.parse(sessionStorage.getItem('rpe_chart_players') || 'null'); } catch(e) { return null; }
    })();
    if (!selected) selected = this.players.map(p => p.id); // default: all

    // Build chip selector
    const chipsHTML = this.players.map(p => {
        const ratio = this.calculateAcuteChronicRatio(p.id);
        const r = parseFloat(ratio.ratio);
        const _tDot = this.getPlayerThresholds(p.id); const dot = isNaN(r) ? '#999' : r > _tDot.high ? '#e53935' : r > _tDot.opt ? '#fb8c00' : r < _tDot.low ? '#1e88e5' : '#43a047';
        const ratioDisplay = ratio.ratio === 'N/A' ? '—' : ratio.ratio;
        const active = selected.includes(p.id) ? 'chart-chip--active' : '';
        const avatar = PlayerTokens.avatar(p, 20, '0.55rem');
        return `<button class="chart-chip ${active}" data-pid="${p.id}" onclick="window.rpeTracker?.toggleChartPlayer('${p.id}')">
            ${avatar}
            <span class="chart-chip-name">${p.name}${p.number ? ' <span class="chip-num">#'+p.number+'</span>' : ''}</span>
            <span class="chart-chip-ratio" style="color:${dot}">${ratioDisplay}</span>
        </button>`;
    }).join('');

    const chartsHTML = this.players
        .filter(p => selected.includes(p.id))
        .map(p => `
            <div class="chart-container">
                <div class="chart-header">
                    <h4>${p.name}${p.number ? ` #${p.number}` : ''}</h4>
                    <div class="chart-period-btns">
                        ${[7,14,30,90].map(d => `<button class="chart-period-btn${(this._chartPeriods?.[p.id]||30)===d?' active':''}" onclick="window.rpeTracker?.setChartPeriod('${p.id}',${d})">${d}d</button>`).join('')}
                    </div>
                </div>
                <canvas id="chart-${p.id}" class="chart-canvas"></canvas>
                ${this._renderFosterBlock(p)}
            </div>
        `).join('');

    // Build season chart section for each selected player
    const seasonChartsHTML = this.players
        .filter(p => selected.includes(p.id))
        .map(p => `
            <div class="chart-container">
                <div class="chart-header">
                    <h4>${p.name}${p.number ? ` #${p.number}` : ''} — Temporada</h4>
                </div>
                <canvas id="season-chart-${p.id}" class="chart-canvas"></canvas>
            </div>
        `).join('');

    container.innerHTML = `
        <div class="evolution-section-header">
            <h3>📈 Evolución del Ratio A:C</h3>
            <div class="chart-chips-wrap">${chipsHTML}</div>
        </div>
        <div class="charts-grid">${chartsHTML}</div>
        <div class="evolution-section-header" style="margin-top:1.5rem">
            <h3>📅 Temporada — UA Semanal Acumulada</h3>
            <p style="margin:0;font-size:.8rem;color:var(--text-secondary)">
                <span style="color:#e53935">●</span> Lesión &nbsp;
                <span style="color:#fb8c00">●</span> Partido
            </p>
        </div>
        <div class="charts-grid" id="seasonChartsGrid">${seasonChartsHTML}</div>
    `;

    setTimeout(() => {
        this.players.filter(p => selected.includes(p.id)).forEach(p => {
            this.renderPlayerEvolutionChart(p.id, this._chartPeriods?.[p.id] || 30);
            this.renderPlayerSeasonChart(p.id);
        });
    }, 100);
};

RPETracker.prototype.toggleChartPlayer = function(pid) {
    let selected = (() => {
        try { return JSON.parse(sessionStorage.getItem('rpe_chart_players') || 'null'); } catch(e) { return null; }
    })();
    if (!selected) selected = this.players.map(p => p.id);
    if (selected.includes(pid)) {
        if (selected.length > 1) selected = selected.filter(id => id !== pid);
    } else {
        selected.push(pid);
    }
    sessionStorage.setItem('rpe_chart_players', JSON.stringify(selected));
    this.renderEvolutionCharts();
};

RPETracker.prototype.setChartPeriod = function(pid, days) {
    if (!this._chartPeriods) this._chartPeriods = {};
    this._chartPeriods[pid] = days;
    this.renderPlayerEvolutionChart(pid, days);
    // Update period button active states for this player's chart
    const container = document.getElementById(`chart-${pid}`)?.closest('.chart-container');
    if (container) {
        container.querySelectorAll('.chart-period-btn').forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.textContent) === days);
        });
    }
};

RPETracker.prototype.renderPlayerEvolutionChart = function(playerId, daysBack = 30) {
    const canvasId = `chart-${playerId}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Destroy previous Chart.js instance if it exists
    if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
        canvas._chartInstance = null;
    }

    const MATCH_MULT = RPETracker.MATCH_LOAD_MULTIPLIER;
    const playerSessions = this.sessions
        .filter(s => s.playerId === playerId)
        .map(s => ({ ...s, date: new Date(s.date), load: (s.load || (s.rpe * (s.duration || 60))) * (s.type === 'match' ? MATCH_MULT : 1) }))
        .sort((a, b) => a.date - b.date);

    if (playerSessions.length === 0) return;

    const now = new Date();
    const labels = [];
    const ratioData = [];
    const loadData = [];

    const lambdaAcute = 2 / (7 + 1);
    const lambdaChronic = 2 / (28 + 1);
    let ewmaAcute = 0;
    let ewmaChronic = 0;

    for (let i = daysBack; i >= 0; i--) {
        const currentDate = new Date(now);
        currentDate.setDate(currentDate.getDate() - i);
        currentDate.setHours(0, 0, 0, 0);

        const dailySessions = playerSessions.filter(s => {
            const sd = new Date(s.date); sd.setHours(0, 0, 0, 0);
            return sd.getTime() === currentDate.getTime();
        });
        const dailyLoad = dailySessions.reduce((sum, s) => sum + s.load, 0);

        ewmaAcute   = (lambdaAcute   * dailyLoad) + ((1 - lambdaAcute)   * ewmaAcute);
        ewmaChronic = (lambdaChronic * dailyLoad) + ((1 - lambdaChronic) * ewmaChronic);

        const ratio = ewmaChronic > 0 ? (ewmaAcute / ewmaChronic) : 0;
        labels.push(`${currentDate.getDate()}/${currentDate.getMonth() + 1}`);
        ratioData.push(parseFloat(ratio.toFixed(3)));
        loadData.push(dailyLoad);
    }

    // Zone annotation plugin — draw as background gradient segments
    const zonePlugin = {
        id: 'ratioZones',
        beforeDraw(chart) {
            const { ctx, chartArea: ca, scales: { y } } = chart;
            if (!ca) return;
            const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
            const zones = [
                { min: 0,   max: 0.8,  color: isDarkMode ? 'rgba(30,120,220,0.22)'  : 'rgba(21,101,192,0.13)',  label: 'Baja carga',   labelColor: isDarkMode ? 'rgba(100,170,255,0.70)' : 'rgba(21,101,192,0.55)'  },
                { min: 0.8, max: 1.3,  color: isDarkMode ? 'rgba(34,168,97,0.22)'   : 'rgba(76,175,80,0.16)',   label: 'Óptimo',       labelColor: isDarkMode ? 'rgba(80,210,130,0.75)'  : 'rgba(34,130,70,0.55)'   },
                { min: 1.3, max: 1.5,  color: isDarkMode ? 'rgba(245,166,35,0.28)'  : 'rgba(255,152,0,0.20)',   label: 'Precaución',   labelColor: isDarkMode ? 'rgba(255,190,60,0.80)'  : 'rgba(200,100,0,0.60)'   },
                { min: 1.5, max: 3.0,  color: isDarkMode ? 'rgba(229,57,53,0.25)'   : 'rgba(244,67,54,0.15)',   label: 'Alto riesgo',  labelColor: isDarkMode ? 'rgba(255,110,100,0.80)' : 'rgba(200,40,40,0.60)'   },
            ];
            ctx.save();
            zones.forEach(z => {
                const yTop    = y.getPixelForValue(z.max);
                const yBottom = y.getPixelForValue(z.min);
                const top     = Math.max(yTop, ca.top);
                const bottom  = Math.min(yBottom, ca.bottom);
                if (bottom <= top) return;
                // Fill zone
                ctx.fillStyle = z.color;
                ctx.fillRect(ca.left, top, ca.width, bottom - top);
                // Label — centrado verticalmente en la zona, alineado a la derecha
                const midY = (top + bottom) / 2;
                if (bottom - top > 12) { // solo si la zona tiene altura suficiente
                    ctx.font = 'bold 10px system-ui, sans-serif';
                    ctx.fillStyle = z.labelColor;
                    ctx.textAlign = 'right';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(z.label, ca.right - 6, midY);
                }
            });
            // Zone threshold lines — más visibles
            const thresholds = [
                { v: 0.8, label: '0.8' },
                { v: 1.3, label: '1.3' },
                { v: 1.5, label: '1.5' },
            ];
            thresholds.forEach(({ v, label }) => {
                const yLine = y.getPixelForValue(v);
                if (yLine < ca.top || yLine > ca.bottom) return;
                ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                ctx.moveTo(ca.left, yLine);
                ctx.lineTo(ca.right, yLine);
                ctx.stroke();
                ctx.setLineDash([]);
                // Valor numérico en el eje izquierdo
                ctx.font = '10px system-ui, sans-serif';
                ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'bottom';
                ctx.fillText(label, ca.left + 3, yLine - 2);
            });
            ctx.restore();
        }
    };

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor  = isDark ? '#aaa' : '#666';

    const instance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        plugins: [zonePlugin],
        data: {
            labels,
            datasets: [
                {
                    label: 'Ratio A:C',
                    data: ratioData,
                    borderColor: '#ff6600',
                    backgroundColor: 'rgba(255,102,0,0.08)',
                    fill: false,
                    tension: 0.35,
                    pointRadius: (ctx) => (ratioData[ctx.dataIndex] > 0 ? 3 : 0),
                    pointHoverRadius: 6,
                    pointBackgroundColor: (ctx) => {
                        const v = ratioData[ctx.dataIndex];
                        if (v <= 0) return 'transparent';
                        const _tPt = this.getPlayerThresholds(playerId);
                        if (v < _tPt.low)   return '#1565c0';
                        if (v <= _tPt.opt)  return '#2e7d32';
                        if (v <= _tPt.high) return '#ef6c00';
                        return '#c62828';
                    },
                    borderWidth: 2,
                    yAxisID: 'y',
                },
                {
                    label: 'Carga diaria',
                    data: loadData,
                    type: 'bar',
                    backgroundColor: 'rgba(33,150,243,0.18)',
                    borderColor: 'rgba(33,150,243,0.4)',
                    borderWidth: 1,
                    borderRadius: 2,
                    yAxisID: 'y2',
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeOutQuart' },
            interaction: { mode: 'index', intersect: false },
            plugins: {
                legend: {
                    labels: { color: textColor, font: { size: 11, family: 'system-ui, -apple-system, sans-serif' }, boxWidth: 14 }
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.96)',
                    titleColor: isDark ? '#fff' : '#111',
                    bodyColor: isDark ? '#ccc' : '#444',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        afterBody: (items) => {
                            const ratio = items.find(i => i.dataset.label === 'Ratio A:C');
                            if (!ratio) return [];
                            const v = ratio.raw;
                            if (v <= 0) return ['Estado: Sin datos'];
                            const _tTt = this.getPlayerThresholds(playerId);
                            if (v < _tTt.low)   return [`Estado: ⬇️ Descarga (${v.toFixed(2)})`];
                            if (v <= _tTt.opt)  return [`Estado: ✅ Óptimo (${v.toFixed(2)})`];
                            if (v <= _tTt.high) return [`Estado: ⚠️ Precaución (${v.toFixed(2)})`];
                            return [`Estado: 🚨 Peligro (${v.toFixed(2)})`];
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor, font: { size: 10, family: 'system-ui, sans-serif' }, maxTicksLimit: 10 },
                    grid: { color: gridColor }
                },
                y: {
                    position: 'left',
                    min: 0,
                    max: 2.5,
                    ticks: {
                        color: textColor, font: { size: 10, family: 'system-ui, sans-serif' },
                        callback: v => v.toFixed(1)
                    },
                    grid: { color: gridColor },
                    title: { display: true, text: 'Ratio A:C', color: textColor, font: { size: 10 } }
                },
                y2: {
                    position: 'right',
                    min: 0,
                    grid: { drawOnChartArea: false },
                    ticks: { color: textColor, font: { size: 10, family: 'system-ui, sans-serif' } },
                    title: { display: true, text: 'Carga', color: textColor, font: { size: 10 } }
                }
            }
        }
    });

    canvas._chartInstance = instance;
};

RPETracker.prototype.renderPlayerSeasonChart = function(playerId) {
    const canvasId = `season-chart-${playerId}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }

    const MATCH_MULT = RPETracker.MATCH_LOAD_MULTIPLIER;
    const playerSessions = this.sessions
        .filter(s => s.playerId === playerId)
        .map(s => ({
            ...s,
            date: s.date.slice(0, 10),
            load: (s.load || (s.rpe * (s.duration || 60))) * (s.type === 'match' ? MATCH_MULT : 1)
        }))
        .sort((a, b) => a.date.localeCompare(b.date));

    if (playerSessions.length === 0) return;

    // Bucket by ISO week string YYYY-Www
    const toISOWeek = (dateStr) => {
        const d = new Date(dateStr + 'T00:00:00');
        const day = d.getDay() || 7;
        d.setDate(d.getDate() + 4 - day);
        const yearStart = new Date(d.getFullYear(), 0, 1);
        const wk = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
        return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
    };

    const weekMap = {};
    const weekMatches = {};
    playerSessions.forEach(s => {
        const w = toISOWeek(s.date);
        weekMap[w] = (weekMap[w] || 0) + s.load;
        if (s.type === 'match') weekMatches[w] = true;
    });

    const weeks = Object.keys(weekMap).sort();
    const loads = weeks.map(w => Math.round(weekMap[w]));
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#ccc' : '#555';
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

    // Injury markers as vertical lines
    const playerInjuries = (this.injuries || []).filter(i => i.playerId === playerId && i.startDate);
    const injuryWeeks = playerInjuries.map(i => toISOWeek(i.startDate.slice(0, 10)));

    const injuryLinePlugin = {
        id: 'injuryLines',
        afterDraw(chart) {
            const { ctx, chartArea: ca, scales: { x } } = chart;
            if (!ca) return;
            ctx.save();
            weeks.forEach((w, i) => {
                if (injuryWeeks.includes(w)) {
                    const xPos = x.getPixelForValue(i);
                    ctx.beginPath();
                    ctx.strokeStyle = 'rgba(229,57,53,0.85)';
                    ctx.lineWidth = 2;
                    ctx.setLineDash([4, 3]);
                    ctx.moveTo(xPos, ca.top);
                    ctx.lineTo(xPos, ca.bottom);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }
            });
            ctx.restore();
        }
    };

    // Match point colors
    const pointColors = weeks.map(w => weekMatches[w] ? '#fb8c00' : (isDark ? 'rgba(100,160,255,0.8)' : 'rgba(33,150,243,0.8)'));
    const pointRadius = weeks.map(w => weekMatches[w] ? 6 : 3);

    const instance = new Chart(canvas, {
        type: 'bar',
        plugins: [injuryLinePlugin],
        data: {
            labels: weeks.map(w => w.replace('-W', ' S')),
            datasets: [{
                label: 'UA semanal',
                data: loads,
                backgroundColor: isDark ? 'rgba(100,160,255,0.55)' : 'rgba(33,150,243,0.45)',
                borderColor:     isDark ? 'rgba(100,160,255,0.85)' : 'rgba(33,150,243,0.85)',
                borderWidth: 1,
                borderRadius: 3,
                pointBackgroundColor: pointColors,
                pointRadius: pointRadius
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.96)',
                    titleColor: isDark ? '#fff' : '#111',
                    bodyColor: isDark ? '#ccc' : '#444',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    callbacks: {
                        afterLabel: (item) => {
                            const w = weeks[item.dataIndex];
                            const parts = [];
                            if (weekMatches[w]) parts.push('🏟️ Partido esta semana');
                            if (injuryWeeks.includes(w)) parts.push('🔴 Lesión registrada');
                            return parts;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        color: textColor,
                        font: { size: 10 },
                        maxRotation: 45,
                        autoSkip: true,
                        maxTicksLimit: 20
                    },
                    grid: { color: gridColor }
                },
                y: {
                    min: 0,
                    ticks: { color: textColor, font: { size: 10 } },
                    grid: { color: gridColor },
                    title: { display: true, text: 'UA', color: textColor, font: { size: 10 } }
                }
            }
        }
    });

    canvas._chartInstance = instance;
};

RPETracker.prototype.getRatioColor = function(ratio, playerId) {
    if (ratio === 'N/A') return '#999';
    const r = parseFloat(ratio);
    const t = this.getPlayerThresholds(playerId);
    if (r < t.low)   return '#1565c0'; // Blue - Detraining
    if (r <= t.opt)  return '#2e7d32'; // Green - Optimal
    if (r <= t.high) return '#ef6c00'; // Orange - Caution
    return '#c62828'; // Red - Danger
};

RPETracker.prototype.getRatioClass = function(ratio) {
    if (ratio === 'N/A') return 'ratio-safe';
    const r = parseFloat(ratio);
    const _tRC = this.getPlayerThresholds(null);
    if (r >= _tRC.low && r <= _tRC.opt) return 'ratio-safe';
    if (r > _tRC.opt && r <= _tRC.high) return 'ratio-caution';
    return 'ratio-danger';
};

RPETracker.prototype.getRatioStatus = function(ratio) {
    if (ratio === 'N/A') return 'Sin datos';
    const r = parseFloat(ratio);
    const _tRS = this.getPlayerThresholds(null); if (r < _tRS.low) return '⬇️ Descarga';
    if (r <= 1.3) return '✅ Óptimo';
    if (r <= 1.5) return '⚠️ Precaución';
    return '🚨 Peligro';
};


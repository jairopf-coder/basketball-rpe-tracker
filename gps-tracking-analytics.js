// ============================================================
//  gps-analytics.js — Fase 2: Pantalla dedicada de analítica GPS
//
//  Qué hace este módulo:
//   1. Nueva vista "📡 GPS" dentro del grupo "Carga" del menú.
//   2. Pestaña "Evolución jugadora": selector de jugadora + rango,
//      gráfico con dos series paralelas (carga interna vs externa)
//      y tabla histórica con detalle GPS ampliado.
//   3. Pestaña "Comparativa equipo": ranking de barras horizontal
//      de todas las jugadoras para la métrica GPS elegida, en una
//      sesión concreta o en un rango de fechas (media/acumulado),
//      con línea de referencia de la media del equipo.
//
//  Qué NO hace (a propósito):
//   - No modifica ewma-calculator.js ni injury-prediction.js.
//   - No cambia cómo se calcula `session.load`.
//   - No escribe en `sessions`, solo lee de `this.sessions` y
//     `this.gpsData` (ya guardados por gps-tracking.js, Fase 1).
// ============================================================

// Métricas GPS comparables en el ranking de equipo: clave interna
// (igual que en OLI_FIELD_MAP de gps-tracking.js), etiqueta legible,
// unidad para el eje, y si al acumular varias sesiones se debe sumar
// o promediar (los conteos tiene más sentido sumarlos; velocidades
// y similares, promediarlas).
const GPS_COMPARISON_METRICS = [
    { key: 'distanceM',            label: 'Distancia recorrida', unit: 'm',      agg: 'sum' },
    { key: 'maxSpeedKmh',          label: 'Velocidad máxima',    unit: 'km/h',   agg: 'avg' },
    { key: 'highIntensityRuns',    label: 'Sprints (alta int.)', unit: '',       agg: 'sum' },
    { key: 'maxIntensityRuns',     label: 'Sprints (máx. int.)', unit: '',       agg: 'sum' },
    { key: 'jumps',                label: 'Saltos',              unit: '',       agg: 'sum' },
    { key: 'directionChanges',     label: 'Cambios de dirección',unit: '',       agg: 'sum' },
    { key: 'highAccelerations',    label: 'Aceleraciones (alta)',unit: '',       agg: 'sum' },
    { key: 'highDecelerations',    label: 'Deceleraciones (alta)',unit: '',      agg: 'sum' },
    { key: 'impactsHigh',          label: 'Impactos alta int.',  unit: '',       agg: 'sum' },
    { key: 'impactsMax',           label: 'Impactos máx. int.',  unit: '',       agg: 'sum' },
    { key: 'caloriesTotal',        label: 'Calorías totales',    unit: 'kcal',   agg: 'sum' },
    { key: 'playTimeMin',          label: 'Tiempo de juego',     unit: 'min',    agg: 'sum' },
];

RPETracker.prototype.renderGpsAnalyticsView = function() {
    const container = document.getElementById('gpsAnalyticsView');
    if (!container) return;

    if (!this._gpsAnalyticsPlayerId && this.players.length > 0) {
        this._gpsAnalyticsPlayerId = this.players[0].id;
    }
    if (!this._gpsAnTab) this._gpsAnTab = 'player';

    container.innerHTML = `
        <div class="an-header" style="margin-bottom:0;">
            <h2 style="margin:0 0 4px 0;">📡 Analítica GPS (Oli Sports)</h2>
            <p style="margin:0 0 12px 0;color:var(--text-secondary);font-size:0.9rem;">
                Compara la carga interna (RPE × duración) con la carga externa objetiva del GPS.
            </p>
        </div>
        <div class="an-tabs">
            <button class="an-tab ${this._gpsAnTab === 'player' ? 'active' : ''}" onclick="window.rpeTracker._gpsAnSwitchTab('player')">👤 Evolución jugadora</button>
            <button class="an-tab ${this._gpsAnTab === 'team' ? 'active' : ''}" onclick="window.rpeTracker._gpsAnSwitchTab('team')">👥 Comparativa equipo</button>
        </div>
        <div id="gpsAnTabContent" style="padding-top:16px;"></div>
    `;

    this._renderGpsAnTabContent();
};

RPETracker.prototype._gpsAnSwitchTab = function(tab) {
    this._gpsAnTab = tab;
    this.renderGpsAnalyticsView();
};

RPETracker.prototype._renderGpsAnTabContent = function() {
    const el = document.getElementById('gpsAnTabContent');
    if (!el) return;
    if (this._gpsAnTab === 'team') {
        this._renderGpsTeamComparisonTab(el);
    } else {
        this._renderGpsPlayerEvolutionTab(el);
    }
};

// ========== PESTAÑA 1: Evolución individual (ya existente, Fase 2) ==========

RPETracker.prototype._renderGpsPlayerEvolutionTab = function(container) {
    const activePlayers = this.players.filter(p => !p.archived);

    container.innerHTML = `
        <div class="gps-an-controls" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;">
            <select id="gpsAnPlayerSelect" onchange="window.rpeTracker._gpsAnSetPlayer(this.value)" style="min-width:200px;">
                ${activePlayers.map(p => `<option value="${p.id}" ${p.id === this._gpsAnalyticsPlayerId ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
            </select>
            <select id="gpsAnRangeSelect" onchange="window.rpeTracker._gpsAnSetRange(this.value)">
                <option value="30" ${this._gpsAnalyticsRange === '30' ? 'selected' : ''}>Últimos 30 días</option>
                <option value="90" ${this._gpsAnalyticsRange === '90' || !this._gpsAnalyticsRange ? 'selected' : ''}>Últimos 90 días</option>
                <option value="all" ${this._gpsAnalyticsRange === 'all' ? 'selected' : ''}>Toda la temporada</option>
            </select>
        </div>

        <div class="gps-an-chart-card" style="background:var(--bg-surface);border-radius:12px;padding:16px;margin-bottom:20px;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
            <div style="height:320px;">
                <canvas id="gpsAnComparisonCanvas"></canvas>
            </div>
        </div>

        <div id="gpsAnTableContainer"></div>
    `;

    requestAnimationFrame(() => {
        this._drawGpsComparisonChart();
        this._renderGpsSessionsTable();
    });
};

RPETracker.prototype._gpsAnSetPlayer = function(playerId) {
    this._gpsAnalyticsPlayerId = playerId;
    this._drawGpsComparisonChart();
    this._renderGpsSessionsTable();
};

RPETracker.prototype._gpsAnSetRange = function(range) {
    this._gpsAnalyticsRange = range;
    this._drawGpsComparisonChart();
    this._renderGpsSessionsTable();
};

// Devuelve las sesiones de la jugadora seleccionada, dentro del rango
// elegido, ordenadas por fecha ascendente, con su dato GPS si existe.
RPETracker.prototype._getGpsAnalyticsData = function() {
    const playerId = this._gpsAnalyticsPlayerId;
    if (!playerId) return [];

    const range = this._gpsAnalyticsRange || '90';
    const cutoff = range === 'all' ? null : new Date(Date.now() - parseInt(range, 10) * 86400000);

    return (this.sessions || [])
        .filter(s => s.playerId === playerId)
        .filter(s => !cutoff || new Date(s.date) >= cutoff)
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(s => {
            const gpsGroup = this.gpsData ? this.gpsData[s.id] : null;
            const gps = gpsGroup ? gpsGroup[playerId] : null;
            return { session: s, gps };
        });
};

RPETracker.prototype._drawGpsComparisonChart = function() {
    const canvas = document.getElementById('gpsAnComparisonCanvas');
    if (!canvas || typeof Chart === 'undefined') return;

    if (canvas._ci) { canvas._ci.destroy(); canvas._ci = null; }

    const data = this._getGpsAnalyticsData();
    const player = this.players.find(p => p.id === this._gpsAnalyticsPlayerId);
    const color = player ? PlayerTokens.get(player) : '#ff6600';

    if (data.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const labels = data.map(d => new Date(d.session.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
    const internalLoad = data.map(d => d.session.load ?? null);
    const externalLoad = data.map(d => d.gps && d.gps.distanceM != null ? d.gps.distanceM : null);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridC = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const textC = isDark ? '#888' : '#999';

    canvas._ci = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: {
            labels,
            datasets: [
                {
                    label: 'Carga interna (RPE × duración)',
                    data: internalLoad,
                    borderColor: color,
                    backgroundColor: color + '18',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.3,
                    spanGaps: true,
                    yAxisID: 'yInternal'
                },
                {
                    label: 'Carga externa GPS (distancia m)',
                    data: externalLoad,
                    borderColor: color,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 3,
                    pointStyle: 'triangle',
                    tension: 0.3,
                    spanGaps: true,
                    yAxisID: 'yExternal'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: textC } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { ticks: { color: textC, maxTicksLimit: 8, font: { size: 10 } }, grid: { color: gridC } },
                yInternal: {
                    type: 'linear', position: 'left',
                    title: { display: true, text: 'Carga interna (UA)', color: textC, font: { size: 10 } },
                    ticks: { color: textC, font: { size: 10 } }, grid: { color: gridC }
                },
                yExternal: {
                    type: 'linear', position: 'right',
                    title: { display: true, text: 'Distancia GPS (m)', color: textC, font: { size: 10 } },
                    ticks: { color: textC, font: { size: 10 } }, grid: { drawOnChartArea: false }
                }
            }
        }
    });
};

RPETracker.prototype._renderGpsSessionsTable = function() {
    const container = document.getElementById('gpsAnTableContainer');
    if (!container) return;

    const data = this._getGpsAnalyticsData().slice().reverse(); // más reciente primero

    if (data.length === 0) {
        container.innerHTML = `<div class="an-empty">📭 No hay sesiones en este rango para esta jugadora</div>`;
        return;
    }

    const rows = data.map(({ session, gps }) => {
        const dateStr = new Date(session.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const rpeDiff = gps && gps.oliRpe != null ? Math.abs(session.rpe - gps.oliRpe) : null;
        const warn = rpeDiff !== null && rpeDiff >= 2;

        return `
        <tr onclick="window.rpeTracker.showSessionDetail('${session.id}')" style="cursor:pointer;">
            <td>${dateStr}</td>
            <td>${session.type || '—'}</td>
            <td>${session.rpe ?? '—'}</td>
            <td>${gps && gps.oliRpe != null ? gps.oliRpe : '—'} ${warn ? '⚠️' : ''}</td>
            <td>${gps && gps.distanceM != null ? Math.round(gps.distanceM) + ' m' : '—'}</td>
            <td>${gps && gps.maxSpeedKmh != null ? gps.maxSpeedKmh + ' km/h' : '—'}</td>
            <td>${gps && gps.highIntensityRuns != null ? gps.highIntensityRuns : '—'}</td>
        </tr>`;
    }).join('');

    container.innerHTML = `
        <div class="gps-an-table-card" style="background:var(--bg-surface);border-radius:12px;padding:16px;overflow-x:auto;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
            <table class="data-table" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="text-align:left;font-size:0.8rem;color:var(--text-secondary);">
                        <th>Fecha</th><th>Tipo</th><th>RPE app</th><th>RPE Oli</th><th>Distancia</th><th>Vel. máx</th><th>Sprints</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
};

// ========== PESTAÑA 2: Comparativa de equipo (ranking por métrica) ==========

RPETracker.prototype._renderGpsTeamComparisonTab = function(container) {
    if (!this._gpsTeamMetric) this._gpsTeamMetric = GPS_COMPARISON_METRICS[0].key;
    if (!this._gpsTeamMode) this._gpsTeamMode = 'session';   // 'session' | 'range'
    if (!this._gpsTeamSortDesc) this._gpsTeamSortDesc = true; // true = mayor a menor

    const teamSessions = this._getTeamSessionOptions();

    if (!this._gpsTeamSessionId && teamSessions.length > 0) {
        this._gpsTeamSessionId = teamSessions[0].id;
    }
    if (!this._gpsTeamRange) this._gpsTeamRange = '30';

    container.innerHTML = `
        <div class="gps-an-controls" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:16px;align-items:center;">
            <select id="gpsTeamMetricSelect" onchange="window.rpeTracker._gpsTeamSetMetric(this.value)" style="min-width:200px;">
                ${GPS_COMPARISON_METRICS.map(m => `<option value="${m.key}" ${m.key === this._gpsTeamMetric ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}
            </select>

            <select id="gpsTeamModeSelect" onchange="window.rpeTracker._gpsTeamSetMode(this.value)">
                <option value="session" ${this._gpsTeamMode === 'session' ? 'selected' : ''}>Una sesión</option>
                <option value="range" ${this._gpsTeamMode === 'range' ? 'selected' : ''}>Rango de fechas</option>
            </select>

            ${this._gpsTeamMode === 'session' ? `
                <select id="gpsTeamSessionSelect" onchange="window.rpeTracker._gpsTeamSetSession(this.value)" style="min-width:200px;">
                    ${teamSessions.map(s => `<option value="${s.id}" ${s.id === this._gpsTeamSessionId ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
                </select>
            ` : `
                <select id="gpsTeamRangeSelect" onchange="window.rpeTracker._gpsTeamSetRange(this.value)">
                    <option value="7" ${this._gpsTeamRange === '7' ? 'selected' : ''}>Últimos 7 días</option>
                    <option value="30" ${this._gpsTeamRange === '30' ? 'selected' : ''}>Últimos 30 días</option>
                    <option value="90" ${this._gpsTeamRange === '90' ? 'selected' : ''}>Últimos 90 días</option>
                    <option value="all" ${this._gpsTeamRange === 'all' ? 'selected' : ''}>Toda la temporada</option>
                </select>
            `}

            <button class="btn-secondary" style="font-size:0.85rem;" onclick="window.rpeTracker._gpsTeamToggleSort()">
                ${this._gpsTeamSortDesc ? '⬇️ Mayor a menor' : '⬆️ Menor a mayor'}
            </button>
        </div>

        <div class="gps-an-chart-card" style="background:var(--bg-surface);border-radius:12px;padding:16px;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
            <div id="gpsTeamChartWrap" style="position:relative;">
                <canvas id="gpsTeamComparisonCanvas"></canvas>
            </div>
        </div>
    `;

    requestAnimationFrame(() => this._drawGpsTeamComparisonChart());
};

// Sesiones de equipo disponibles para el selector "Una sesión": se
// agrupan por fecha+tipo (todas las jugadoras de la misma sesión
// comparten fecha), mostrando la más reciente primero.
RPETracker.prototype._getTeamSessionOptions = function() {
    const seen = new Map();
    (this.sessions || []).forEach(s => {
        const key = s.date + '|' + (s.type || '');
        if (!seen.has(key)) {
            seen.set(key, {
                id: s.id, // usamos el id de la primera sesión de ese grupo como referencia
                date: s.date,
                type: s.type,
                label: `${new Date(s.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' })} — ${s.type || 'Sesión'}`
            });
        }
    });
    return Array.from(seen.values()).sort((a, b) => new Date(b.date) - new Date(a.date));
};

RPETracker.prototype._gpsTeamSetMetric = function(key) { this._gpsTeamMetric = key; this._drawGpsTeamComparisonChart(); };
RPETracker.prototype._gpsTeamSetSession = function(id) { this._gpsTeamSessionId = id; this._drawGpsTeamComparisonChart(); };
RPETracker.prototype._gpsTeamSetRange = function(range) { this._gpsTeamRange = range; this._drawGpsTeamComparisonChart(); };
RPETracker.prototype._gpsTeamToggleSort = function() { this._gpsTeamSortDesc = !this._gpsTeamSortDesc; this._renderGpsTeamComparisonTab(document.getElementById('gpsAnTabContent')); };

RPETracker.prototype._gpsTeamSetMode = function(mode) {
    this._gpsTeamMode = mode;
    this._renderGpsTeamComparisonTab(document.getElementById('gpsAnTabContent'));
};

// Calcula, para cada jugadora activa, el valor de la métrica elegida:
// - modo 'session': el valor de esa jugadora en esa sesión concreta (fecha+tipo).
// - modo 'range': suma o media (según la métrica) de sus sesiones con GPS en el rango.
// Jugadoras sin dato GPS para ese contexto se excluyen del gráfico
// (no se muestran como 0, para no dar una imagen falsa de "no corrió nada").
RPETracker.prototype._getGpsTeamComparisonData = function() {
    const metricDef = GPS_COMPARISON_METRICS.find(m => m.key === this._gpsTeamMetric) || GPS_COMPARISON_METRICS[0];
    const activePlayers = this.players.filter(p => !p.archived);
    const results = [];

    activePlayers.forEach(player => {
        let value = null;

        if (this._gpsTeamMode === 'session') {
            const selected = this._getTeamSessionOptions().find(s => s.id === this._gpsTeamSessionId);
            if (!selected) return;
            const sessionForPlayer = (this.sessions || []).find(s =>
                s.playerId === player.id && s.date === selected.date && (s.type || '') === (selected.type || '')
            );
            if (sessionForPlayer && this.gpsData && this.gpsData[sessionForPlayer.id]) {
                const gps = this.gpsData[sessionForPlayer.id][player.id];
                if (gps && gps[metricDef.key] != null) value = gps[metricDef.key];
            }
        } else {
            const range = this._gpsTeamRange || '30';
            const cutoff = range === 'all' ? null : new Date(Date.now() - parseInt(range, 10) * 86400000);
            const playerSessions = (this.sessions || [])
                .filter(s => s.playerId === player.id)
                .filter(s => !cutoff || new Date(s.date) >= cutoff);

            const values = [];
            playerSessions.forEach(s => {
                const gps = this.gpsData && this.gpsData[s.id] ? this.gpsData[s.id][player.id] : null;
                if (gps && gps[metricDef.key] != null) values.push(gps[metricDef.key]);
            });

            if (values.length > 0) {
                value = metricDef.agg === 'avg'
                    ? values.reduce((a, b) => a + b, 0) / values.length
                    : values.reduce((a, b) => a + b, 0);
            }
        }

        if (value !== null) results.push({ player, value });
    });

    results.sort((a, b) => this._gpsTeamSortDesc ? b.value - a.value : a.value - b.value);
    return { data: results, metricDef };
};

RPETracker.prototype._drawGpsTeamComparisonChart = function() {
    const canvas = document.getElementById('gpsTeamComparisonCanvas');
    if (!canvas || typeof Chart === 'undefined') return;
    if (canvas._ci) { canvas._ci.destroy(); canvas._ci = null; }

    const { data, metricDef } = this._getGpsTeamComparisonData();
    const wrap = document.getElementById('gpsTeamChartWrap');

    if (data.length === 0) {
        if (wrap) wrap.innerHTML = `<canvas id="gpsTeamComparisonCanvas"></canvas><div class="an-empty" style="padding:24px 0;">📭 No hay datos GPS para esta selección</div>`;
        return;
    }

    // Altura dinámica: cada jugadora necesita su fila, para que las
    // barras no queden apretadas con plantillas grandes.
    if (wrap) wrap.style.height = Math.max(280, data.length * 34 + 60) + 'px';
    canvas.style.height = '100%';

    const labels = data.map(d => d.player.name);
    const values = data.map(d => d.value);
    const colors = data.map(d => PlayerTokens.get(d.player));
    const teamAvg = values.reduce((a, b) => a + b, 0) / values.length;

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textC = isDark ? '#aaa' : '#555';
    const gridC = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';

    canvas._ci = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [
                {
                    label: metricDef.label,
                    data: values,
                    backgroundColor: colors,
                    borderRadius: 4,
                    barPercentage: 0.7,
                },
                {
                    label: `Media del equipo (${teamAvg.toFixed(1)}${metricDef.unit ? ' ' + metricDef.unit : ''})`,
                    type: 'line',
                    data: labels.map(() => teamAvg),
                    borderColor: isDark ? '#f0f0f4' : '#18181b',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 0,
                    fill: false,
                }
            ]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: textC } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.x?.toFixed ? ctx.parsed.x.toFixed(1) : ctx.parsed.x}${metricDef.unit ? ' ' + metricDef.unit : ''}`
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: { display: true, text: metricDef.unit ? `${metricDef.label} (${metricDef.unit})` : metricDef.label, color: textC, font: { size: 11 } },
                    ticks: { color: textC, font: { size: 10 } },
                    grid: { color: gridC }
                },
                y: {
                    ticks: { color: textC, font: { size: 11 } },
                    grid: { display: false }
                }
            }
        }
    });
};

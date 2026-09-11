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

// Tipos de unidad reconocidos, tal como aparecen en las cabeceras del
// CSV de Oli: (#) conteo, (m) distancia, (%) porcentaje, (km/h)
// velocidad, (min) tiempo. `kcal` y `kJ/kg` se tratan como su propio
// tipo porque no tiene sentido mezclarlas en el mismo eje que nada más.
// Esta clasificación es la que usa la gráfica de barras verticales
// para decidir si varias métricas elegidas a la vez pueden compartir
// eje Y (mismo unitType) o si hay que avisar de que no son comparables.
const GPS_UNIT_TYPES = {
    COUNT: 'count',       // (#)
    DISTANCE: 'distance',  // (m)
    PERCENT: 'percent',    // (%)
    SPEED: 'speed',        // (km/h)
    TIME: 'time',          // (min)
    ENERGY: 'energy',       // kcal / kJ/kg
    INDEX: 'index',        // IIO (0-100, escala propia)
};

// Métricas GPS comparables en el ranking de equipo y en la comparativa
// de barras: clave interna (igual que en OLI_FIELD_MAP / bloque de
// zonas de velocidad de gps-tracking.js), etiqueta legible, unidad
// para el eje (texto), tipo de unidad (para agrupar/adaptar ejes) y
// si al acumular varias sesiones se debe sumar o promediar (los
// conteos tiene más sentido sumarlos; velocidades y similares,
// promediarlas).
const GPS_COMPARISON_METRICS = [
    { key: 'iio',                   label: '📐 Intensidad Objetiva (IIO)', unit: '',      unitType: GPS_UNIT_TYPES.INDEX,    agg: 'avg', special: 'iio' },
    { key: 'distanceM',            label: 'Distancia recorrida',  unit: 'm',      unitType: GPS_UNIT_TYPES.DISTANCE, agg: 'sum' },
    { key: 'maxSpeedKmh',          label: 'Velocidad máxima',     unit: 'km/h',   unitType: GPS_UNIT_TYPES.SPEED,    agg: 'avg' },
    { key: 'walkM',                label: 'Caminata (distancia)', unit: 'm',      unitType: GPS_UNIT_TYPES.DISTANCE, agg: 'sum' },
    { key: 'walkCount',            label: 'Caminata (episodios)', unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'jogM',                 label: 'Trote (distancia)',    unit: 'm',      unitType: GPS_UNIT_TYPES.DISTANCE, agg: 'sum' },
    { key: 'jogCount',             label: 'Trote (episodios)',    unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'moderateRunM',         label: 'Carrera moderada (distancia)', unit: 'm', unitType: GPS_UNIT_TYPES.DISTANCE, agg: 'sum' },
    { key: 'moderateRunCount',     label: 'Carrera moderada (episodios)', unit: '',  unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'highIntensityRunsM',   label: 'Carrera alta int. (distancia)', unit: 'm', unitType: GPS_UNIT_TYPES.DISTANCE, agg: 'sum' },
    { key: 'highIntensityRuns',    label: 'Carrera alta int. (episodios)', unit: '',  unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'maxIntensityRunsM',    label: 'Sprint (distancia)',   unit: 'm',      unitType: GPS_UNIT_TYPES.DISTANCE, agg: 'sum' },
    { key: 'maxIntensityRuns',     label: 'Sprint (episodios)',   unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'jumps',                label: 'Saltos',               unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'directionChanges',     label: 'Cambios de dirección', unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'highAccelerations',    label: 'Aceleraciones (alta)', unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'highDecelerations',    label: 'Deceleraciones (alta)',unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'impactsHigh',          label: 'Impactos alta int.',   unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'impactsMax',           label: 'Impactos máx. int.',   unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'caloriesTotal',        label: 'Calorías totales',     unit: 'kcal',   unitType: GPS_UNIT_TYPES.ENERGY,   agg: 'sum' },
    { key: 'playTimeMin',          label: 'Tiempo de juego',      unit: 'min',    unitType: GPS_UNIT_TYPES.TIME,     agg: 'sum' },
];

// Detecta jugadoras con señales de carga inusual, reutilizando la
// lógica de divergencia RPE/GPS ya validada (Fase 3, gps-injury-signal.js)
// más un chequeo simple de IIO muy alto en la sesión más reciente
// (cerca de su propio máximo histórico = esfuerzo puntual elevado).
// Es solo informativo aquí — no toca injury-prediction.js.
RPETracker.prototype._getGpsAlertPlayers = function() {
    if (!this.gpsData) return [];
    const alerts = [];
    const activePlayers = this.players.filter(p => !p.archived);

    activePlayers.forEach(player => {
        const reasons = [];

        if (typeof this.calculateGpsDivergenceSignal === 'function') {
            const signal = this.calculateGpsDivergenceSignal(player.id);
            if (signal.applied) reasons.push('divergencia RPE/GPS sostenida');
        }

        if (typeof this.calculateGpsIntensityIndex === 'function') {
            const lastSession = (this.sessions || [])
                .filter(s => s.playerId === player.id)
                .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
            if (lastSession) {
                const iio = this.calculateGpsIntensityIndex(player.id, lastSession.id);
                if (iio && iio.confidence === 'normal' && iio.score >= 90) {
                    reasons.push(`IIO ${iio.score}/100 en su última sesión`);
                }
            }
        }

        if (reasons.length > 0) alerts.push({ player, reasons });
    });

    return alerts;
};

RPETracker.prototype._renderGpsAlertBanner = function() {
    const alerts = this._getGpsAlertPlayers();
    if (alerts.length === 0) return '';

    const shown = alerts.slice(0, 3);
    const extra = alerts.length - shown.length;

    return `
        <div style="background:var(--warning-soft);border:1px solid var(--warning);border-radius:10px;padding:10px 14px;margin-bottom:12px;font-size:0.88rem;color:var(--text-primary);">
            <div style="font-weight:600;margin-bottom:4px;color:var(--warning);">⚠️ ${alerts.length} jugadora${alerts.length > 1 ? 's' : ''} con carga a revisar</div>
            ${shown.map(a => `
                <div style="cursor:pointer;text-decoration:underline;" onclick="window.rpeTracker._gpsAnSwitchTab('player'); window.rpeTracker._gpsAnSetPlayer('${a.player.id}');">
                    ${esc(a.player.name)} — ${esc(a.reasons.join(', '))}
                </div>`).join('')}
            ${extra > 0 ? `<div style="margin-top:2px;">y ${extra} más…</div>` : ''}
        </div>`;
};

// Descarga el gráfico Chart.js activo en el canvas indicado como PNG.
// Genérica: funciona con cualquier gráfico ya dibujado (usa su propio
// fondo, que Chart.js deja transparente por defecto, así que se
// compone sobre blanco para que se vea bien al abrir la imagen).
RPETracker.prototype._downloadGpsChart = function(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || !canvas._ci) {
        this.showToast('⚠️ No hay gráfico para descargar todavía', 'warning');
        return;
    }
    const composed = document.createElement('canvas');
    composed.width = canvas.width;
    composed.height = canvas.height;
    const ctx = composed.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, composed.width, composed.height);
    ctx.drawImage(canvas, 0, 0);

    const link = document.createElement('a');
    link.download = filename + '.png';
    link.href = composed.toDataURL('image/png');
    link.click();
};

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
        ${this._renderGpsAlertBanner()}
        <div class="an-tabs">
            <button class="an-tab ${this._gpsAnTab === 'player' ? 'active' : ''}" onclick="window.rpeTracker._gpsAnSwitchTab('player')">👤 Evolución jugadora</button>
            <button class="an-tab ${this._gpsAnTab === 'team' ? 'active' : ''}" onclick="window.rpeTracker._gpsAnSwitchTab('team')">👥 Comparativa equipo</button>
            <button class="an-tab ${this._gpsAnTab === 'radar' ? 'active' : ''}" onclick="window.rpeTracker._gpsAnSwitchTab('radar')">📊 Comparar jugadoras</button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;padding-top:10px;flex-wrap:wrap;gap:8px;">
            <button class="btn-primary" style="font-size:0.85rem;" onclick="window.rpeTracker.openGpsImportFromTab()">
                📤 Importar CSV
            </button>
            ${this._renderGpsTypeFilterSelect()}
        </div>
        <div id="gpsAnTabContent" style="padding-top:10px;"></div>
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
    } else if (this._gpsAnTab === 'radar') {
        this._renderGpsRadarTab(el);
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
            <div style="display:flex;justify-content:flex-end;margin-bottom:4px;">
                <button class="btn-secondary" style="font-size:0.78rem;padding:4px 10px;" onclick="window.rpeTracker._downloadGpsChart('gpsAnComparisonCanvas', 'evolucion-gps')">📥 Descargar</button>
            </div>
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

    return this._applyGpsTypeFilter(this.sessions || [])
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

// Columnas seleccionables de la tabla de evolución: mismas métricas
// que en "Comparar jugadoras" (sin el IIO, que ya es una columna fija).
const GPS_TABLE_SELECTABLE_METRICS = GPS_COMPARISON_METRICS.filter(m => m.key !== 'iio');
const GPS_TABLE_DEFAULT_COLUMNS = ['distanceM', 'maxSpeedKmh', 'highIntensityRuns'];
const GPS_TABLE_MAX_COLUMNS = 3;

// T/P/O: Training, Partido (match), Otro (shooting/gym/recovery/etc).
RPETracker.prototype._gpsSessionTypeLetter = function(type) {
    if (type === 'training') return 'T';
    if (type === 'match') return 'P';
    return 'O';
};

RPETracker.prototype._renderGpsSessionsTable = function() {
    const container = document.getElementById('gpsAnTableContainer');
    if (!container) return;

    if (!this._gpsTableColumns) {
        const saved = typeof Store !== 'undefined' ? Store.get('gpsTableColumns', null) : null;
        this._gpsTableColumns = (Array.isArray(saved) && saved.length > 0)
            ? saved.filter(k => GPS_TABLE_SELECTABLE_METRICS.some(m => m.key === k)).slice(0, GPS_TABLE_MAX_COLUMNS)
            : [...GPS_TABLE_DEFAULT_COLUMNS];
        if (this._gpsTableColumns.length === 0) this._gpsTableColumns = [...GPS_TABLE_DEFAULT_COLUMNS];
    }

    const data = this._getGpsAnalyticsData().slice().reverse(); // más reciente primero
    const columns = this._gpsTableColumns.map(key => GPS_TABLE_SELECTABLE_METRICS.find(m => m.key === key)).filter(Boolean);

    const columnsPicker = `
        <div style="display:flex;justify-content:flex-end;margin-bottom:8px;">
            <button class="btn-secondary" style="font-size:0.78rem;padding:4px 10px;" onclick="window.rpeTracker._gpsTableToggleColumnsPanel()">
                ⚙️ Columnas (${columns.length}/${GPS_TABLE_MAX_COLUMNS})
            </button>
        </div>
        <div id="gpsTableColumnsPanel" style="display:none;margin-bottom:12px;padding:12px;border-radius:10px;background:var(--bg-subtle);border:1px solid var(--border);">
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">
                Elige hasta ${GPS_TABLE_MAX_COLUMNS} columnas para la tabla:
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;">
                ${GPS_TABLE_SELECTABLE_METRICS.map(m => `
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;">
                        <input type="checkbox" value="${m.key}" ${this._gpsTableColumns.includes(m.key) ? 'checked' : ''}
                            onchange="window.rpeTracker._gpsTableToggleColumn('${m.key}', this.checked)">
                        ${esc(m.label)}
                    </label>
                `).join('')}
            </div>
        </div>`;

    if (data.length === 0) {
        container.innerHTML = columnsPicker + `<div class="an-empty">📭 No hay sesiones en este rango para esta jugadora</div>`;
        return;
    }

    const rows = data.map(({ session, gps }) => {
        const dateStr = new Date(session.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const iio = typeof this.calculateGpsIntensityIndex === 'function'
            ? this.calculateGpsIntensityIndex(session.playerId, session.id)
            : null;

        const dynamicCells = columns.map(m => {
            const val = gps && gps[m.key] != null ? gps[m.key] : null;
            if (val == null) return '<td>—</td>';
            const display = m.key.endsWith('M') || m.key === 'distanceM' ? Math.round(val) : val;
            return `<td>${display}${m.unit ? ' ' + m.unit : ''}</td>`;
        }).join('');

        return `
        <tr onclick="window.rpeTracker.showSessionDetail('${session.id}')" style="cursor:pointer;">
            <td>${dateStr}</td>
            <td style="text-align:center;font-weight:600;" title="${esc(session.type || '')}">${this._gpsSessionTypeLetter(session.type)}</td>
            <td>${session.rpe ?? '—'}</td>
            <td>${iio ? iio.score + '/100' : '—'}</td>
            ${dynamicCells}
        </tr>`;
    }).join('');

    container.innerHTML = columnsPicker + `
        <div class="gps-an-table-card" style="background:var(--bg-surface);border-radius:12px;padding:16px;overflow-x:auto;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
            <table class="data-table" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="text-align:left;font-size:0.8rem;color:var(--text-secondary);">
                        <th>Fecha</th><th style="text-align:center;">Tipo</th><th>RPE app</th><th>IIO</th>
                        ${columns.map(m => `<th>${esc(m.label)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
};

RPETracker.prototype._gpsTableToggleColumnsPanel = function() {
    const panel = document.getElementById('gpsTableColumnsPanel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};

RPETracker.prototype._gpsTableToggleColumn = function(key, checked) {
    if (checked) {
        if (this._gpsTableColumns.length >= GPS_TABLE_MAX_COLUMNS) {
            this.showToast(`⚠️ Máximo ${GPS_TABLE_MAX_COLUMNS} columnas en la tabla`, 'warning');
            const cb = document.querySelector(`#gpsTableColumnsPanel input[value="${key}"]`);
            if (cb) cb.checked = false;
            return;
        }
        this._gpsTableColumns.push(key);
    } else {
        if (this._gpsTableColumns.length <= 1) {
            this.showToast('⚠️ Debe quedar al menos 1 columna seleccionada', 'warning');
            const cb = document.querySelector(`#gpsTableColumnsPanel input[value="${key}"]`);
            if (cb) cb.checked = true;
            return;
        }
        this._gpsTableColumns = this._gpsTableColumns.filter(k => k !== key);
    }
    if (typeof Store !== 'undefined') Store.set('gpsTableColumns', this._gpsTableColumns);
    this._renderGpsSessionsTable();
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

            <button class="btn-secondary" style="font-size:0.78rem;padding:4px 10px;" onclick="window.rpeTracker._downloadGpsChart('gpsTeamComparisonCanvas', 'comparativa-equipo-gps')">📥 Descargar</button>
        </div>

        <div class="gps-an-chart-card" style="background:var(--bg-surface);border-radius:12px;padding:16px;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
            <div id="gpsTeamChartWrap" style="position:relative;">
                <canvas id="gpsTeamComparisonCanvas"></canvas>
            </div>
            <div id="gpsTeamScrollHint" style="display:none;text-align:center;font-size:0.78rem;color:var(--text-secondary);margin-top:6px;">↔ Desliza para ver a todas las jugadoras</div>
        </div>
    `;

    requestAnimationFrame(() => this._drawGpsTeamComparisonChart());
};

// Sesiones de equipo disponibles para el selector "Una sesión": se
// agrupan por fecha+tipo (todas las jugadoras de la misma sesión
// comparten fecha), mostrando la más reciente primero.
RPETracker.prototype._getTeamSessionOptions = function() {
    const seen = new Map();
    this._applyGpsTypeFilter(this.sessions || [])
        .forEach(s => {
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

RPETracker.prototype._gpsSetTypeFilter = function(val) {
    this._gpsTypeFilter = val;
    // Reset de selección de sesión: la lista disponible puede cambiar.
    this._gpsTeamSessionId = null;
    this._gpsRadarSessionId = null;
    this._renderGpsAnTabContent();
};

// Filtro de tipo de sesión (Todos/Partidos/Entrenos), compartido por
// las 3 pestañas de la vista GPS. Se aplica sobre CUALQUIER lista de
// sesiones antes de calcular rangos, medias o el ranking de equipo.
RPETracker.prototype._applyGpsTypeFilter = function(sessionsArr) {
    const typeFilter = this._gpsTypeFilter || 'all';
    if (typeFilter === 'all') return sessionsArr;
    return sessionsArr.filter(s => typeFilter === 'match' ? s.type === 'match' : s.type !== 'match');
};

// HTML del selector de filtro de tipo, para insertar en cada pestaña.
RPETracker.prototype._renderGpsTypeFilterSelect = function() {
    const val = this._gpsTypeFilter || 'all';
    return `
        <select id="gpsTypeFilterSelect" onchange="window.rpeTracker._gpsSetTypeFilter(this.value)">
            <option value="all" ${val === 'all' ? 'selected' : ''}>Todas las sesiones</option>
            <option value="match" ${val === 'match' ? 'selected' : ''}>🏀 Solo partidos</option>
            <option value="training" ${val === 'training' ? 'selected' : ''}>💪 Solo entrenos</option>
        </select>`;
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

        if (metricDef.special === 'iio') {
            if (this._gpsTeamMode === 'session') {
                const selected = this._getTeamSessionOptions().find(s => s.id === this._gpsTeamSessionId);
                if (!selected) return;
                const sessionForPlayer = (this.sessions || []).find(s =>
                    s.playerId === player.id && s.date === selected.date && (s.type || '') === (selected.type || '')
                );
                if (sessionForPlayer && typeof this.calculateGpsIntensityIndex === 'function') {
                    const iio = this.calculateGpsIntensityIndex(player.id, sessionForPlayer.id);
                    if (iio) value = iio.score;
                }
            } else {
                const range = this._gpsTeamRange || '30';
                const cutoff = range === 'all' ? null : new Date(Date.now() - parseInt(range, 10) * 86400000);
                const playerSessions = this._applyGpsTypeFilter(this.sessions || [])
                    .filter(s => s.playerId === player.id)
                    .filter(s => !cutoff || new Date(s.date) >= cutoff);

                const values = [];
                playerSessions.forEach(s => {
                    if (typeof this.calculateGpsIntensityIndex === 'function') {
                        const iio = this.calculateGpsIntensityIndex(player.id, s.id);
                        if (iio) values.push(iio.score);
                    }
                });
                if (values.length > 0) value = values.reduce((a, b) => a + b, 0) / values.length;
            }
            if (value !== null) results.push({ player, value });
            return;
        }

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
            const playerSessions = this._applyGpsTypeFilter(this.sessions || [])
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

    // Ancho dinámico: cada jugadora necesita su columna, para que las
    // barras no queden apretadas con plantillas grandes. Con barras
    // verticales el contenedor scrollea horizontalmente si hace falta.
    const minWidth = Math.max(320, data.length * 70);
    if (wrap) {
        wrap.style.height = '360px';
        wrap.style.overflowX = data.length > 8 ? 'auto' : 'visible';
    }
    canvas.style.height = '100%';
    canvas.style.minWidth = minWidth + 'px';

    const scrollHint = document.getElementById('gpsTeamScrollHint');
    if (scrollHint) scrollHint.style.display = data.length > 8 ? 'block' : 'none';

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
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: textC } },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.dataset.label}: ${ctx.parsed.y?.toFixed ? ctx.parsed.y.toFixed(1) : ctx.parsed.y}${metricDef.unit ? ' ' + metricDef.unit : ''}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textC, font: { size: 10 }, maxRotation: 45, minRotation: 45 },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: metricDef.unit ? `${metricDef.label} (${metricDef.unit})` : metricDef.label, color: textC, font: { size: 11 } },
                    ticks: { color: textC, font: { size: 10 } },
                    grid: { color: gridC }
                }
            }
        }
    });
};

// ========== PESTAÑA 3: Comparativa de barras (varias jugadoras a la vez) ==========
//
// Sustituye a la antigua gráfica de araña (radar). Se elige UNA
// métrica a la vez (para que el eje Y siempre tenga una unidad clara:
// metros, conteos, km/h...) y se comparan varias jugadoras en barras
// verticales agrupadas. "Media del equipo" se puede añadir como una
// barra de referencia más, junto a las jugadoras elegidas.

const GPS_BARS_DEFAULT_METRIC = 'distanceM';
const GPS_BARS_MAX_PLAYERS = 8; // límite razonable para que las barras no se aplasten

RPETracker.prototype._renderGpsRadarTab = function(container) {
    if (!this._gpsBarsMetric) this._gpsBarsMetric = GPS_BARS_DEFAULT_METRIC;
    if (!this._gpsBarsModeCtx) this._gpsBarsModeCtx = 'session'; // 'session' | 'range'
    if (!this._gpsBarsRange) this._gpsBarsRange = '30';
    if (!Array.isArray(this._gpsBarsPlayerIds)) this._gpsBarsPlayerIds = [];
    if (this._gpsBarsShowTeamAvg === undefined) this._gpsBarsShowTeamAvg = true;

    const activePlayers = this.players.filter(p => !p.archived);
    const teamSessions = this._getTeamSessionOptions();

    // Selección inicial: si no hay ninguna jugadora elegida aún,
    // arrancamos con las 3 primeras del roster activo para que la
    // gráfica no aparezca vacía la primera vez que se abre la pestaña.
    if (this._gpsBarsPlayerIds.length === 0 && activePlayers.length > 0) {
        this._gpsBarsPlayerIds = activePlayers.slice(0, 3).map(p => p.id);
    }
    if (!this._gpsBarsSessionId && teamSessions.length > 0) this._gpsBarsSessionId = teamSessions[0].id;

    const metricDef = GPS_COMPARISON_METRICS.find(m => m.key === this._gpsBarsMetric) || GPS_COMPARISON_METRICS[0];

    container.innerHTML = `
        <div class="gps-an-controls" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
            <select id="gpsBarsMetricSelect" onchange="window.rpeTracker._gpsBarsSetMetric(this.value)" style="min-width:220px;">
                ${GPS_COMPARISON_METRICS.map(m => `<option value="${m.key}" ${m.key === this._gpsBarsMetric ? 'selected' : ''}>${esc(m.label)}</option>`).join('')}
            </select>

            <select id="gpsBarsModeCtxSelect" onchange="window.rpeTracker._gpsBarsSetModeCtx(this.value)">
                <option value="session" ${this._gpsBarsModeCtx === 'session' ? 'selected' : ''}>Una sesión</option>
                <option value="range" ${this._gpsBarsModeCtx === 'range' ? 'selected' : ''}>Rango de fechas</option>
            </select>

            ${this._gpsBarsModeCtx === 'session' ? `
                <select id="gpsBarsSessionSelect" onchange="window.rpeTracker._gpsBarsSetSession(this.value)" style="min-width:200px;">
                    ${teamSessions.map(s => `<option value="${s.id}" ${s.id === this._gpsBarsSessionId ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
                </select>
            ` : `
                <select id="gpsBarsRangeSelect" onchange="window.rpeTracker._gpsBarsSetRange(this.value)">
                    <option value="7" ${this._gpsBarsRange === '7' ? 'selected' : ''}>Últimos 7 días</option>
                    <option value="30" ${this._gpsBarsRange === '30' ? 'selected' : ''}>Últimos 30 días</option>
                    <option value="90" ${this._gpsBarsRange === '90' ? 'selected' : ''}>Últimos 90 días</option>
                    <option value="all" ${this._gpsBarsRange === 'all' ? 'selected' : ''}>Toda la temporada</option>
                </select>
            `}
        </div>

        <div class="gps-an-controls" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
            <button class="btn-secondary" style="font-size:0.85rem;" onclick="window.rpeTracker._gpsBarsTogglePlayersPanel()">
                👥 Jugadoras (${this._gpsBarsPlayerIds.length})
            </button>
            <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;color:var(--text-secondary);">
                <input type="checkbox" ${this._gpsBarsShowTeamAvg ? 'checked' : ''} onchange="window.rpeTracker._gpsBarsToggleTeamAvg(this.checked)">
                Añadir media del equipo
            </label>
        </div>

        <div id="gpsBarsPlayersPanel" style="display:none;margin-bottom:16px;padding:12px;border-radius:10px;background:var(--bg-subtle);border:1px solid var(--border);">
            <div style="font-size:0.85rem;color:var(--text-secondary);margin-bottom:8px;">
                Elige hasta ${GPS_BARS_MAX_PLAYERS} jugadoras a comparar:
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:6px;">
                ${activePlayers.map(p => `
                    <label style="display:flex;align-items:center;gap:6px;font-size:0.85rem;cursor:pointer;">
                        <input type="checkbox" value="${p.id}" ${this._gpsBarsPlayerIds.includes(p.id) ? 'checked' : ''}
                            onchange="window.rpeTracker._gpsBarsTogglePlayer('${p.id}', this.checked)">
                        ${esc(p.name)}
                    </label>
                `).join('')}
            </div>
        </div>

        <div class="gps-an-chart-card" style="background:var(--bg-surface);border-radius:12px;padding:16px;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
            <div style="display:flex;justify-content:flex-end;margin-bottom:4px;">
                <button class="btn-secondary" style="font-size:0.78rem;padding:4px 10px;" onclick="window.rpeTracker._downloadGpsChart('gpsBarsCanvas', 'comparativa-jugadoras-gps')">📥 Descargar</button>
            </div>
            <div style="height:400px;">
                <canvas id="gpsBarsCanvas"></canvas>
            </div>
            ${this._gpsBarsPlayerIds.length === 0 ? `
                <p style="text-align:center;color:var(--text-secondary);font-size:0.85rem;margin-top:12px;">
                    Elige al menos una jugadora para ver la comparativa.
                </p>
            ` : ''}
        </div>
    `;

    requestAnimationFrame(() => this._drawGpsBarsChart());
};

RPETracker.prototype._gpsBarsSetMetric = function(key) {
    this._gpsBarsMetric = key;
    this._drawGpsBarsChart();
};
RPETracker.prototype._gpsBarsSetModeCtx = function(ctx) {
    this._gpsBarsModeCtx = ctx;
    this._renderGpsRadarTab(document.getElementById('gpsAnTabContent'));
};
RPETracker.prototype._gpsBarsSetSession = function(id) { this._gpsBarsSessionId = id; this._drawGpsBarsChart(); };
RPETracker.prototype._gpsBarsSetRange = function(range) { this._gpsBarsRange = range; this._drawGpsBarsChart(); };
RPETracker.prototype._gpsBarsTogglePlayersPanel = function() {
    const panel = document.getElementById('gpsBarsPlayersPanel');
    if (panel) panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
};
RPETracker.prototype._gpsBarsTogglePlayer = function(id, checked) {
    if (checked) {
        if (this._gpsBarsPlayerIds.length >= GPS_BARS_MAX_PLAYERS) {
            this.showToast(`⚠️ Máximo ${GPS_BARS_MAX_PLAYERS} jugadoras en la comparativa`, 'warning');
            const cb = document.querySelector(`#gpsBarsPlayersPanel input[value="${id}"]`);
            if (cb) cb.checked = false;
            return;
        }
        this._gpsBarsPlayerIds.push(id);
    } else {
        this._gpsBarsPlayerIds = this._gpsBarsPlayerIds.filter(pid => pid !== id);
    }
    const btn = document.querySelector('[onclick="window.rpeTracker._gpsBarsTogglePlayersPanel()"]');
    if (btn) btn.textContent = `👥 Jugadoras (${this._gpsBarsPlayerIds.length})`;
    this._drawGpsBarsChart();
};
RPETracker.prototype._gpsBarsToggleTeamAvg = function(checked) {
    this._gpsBarsShowTeamAvg = checked;
    this._drawGpsBarsChart();
};

// Calcula el valor de UNA métrica para UNA jugadora (o la media del
// equipo si playerId es null), en el contexto elegido (sesión o
// rango). Reutiliza calculateGpsIntensityIndex para el caso especial
// IIO, e igual lógica sum/avg que la pestaña de barras horizontales
// (Comparativa equipo) para el resto.
RPETracker.prototype._getGpsBarsValue = function(metricDef, playerId) {
    const targetPlayers = playerId ? [playerId] : this.players.filter(p => !p.archived).map(p => p.id);
    const perPlayerValues = [];

    targetPlayers.forEach(pid => {
        let value = null;

        if (this._gpsBarsModeCtx === 'session') {
            const selected = this._getTeamSessionOptions().find(s => s.id === this._gpsBarsSessionId);
            if (!selected) return;
            const sessionForPlayer = (this.sessions || []).find(s =>
                s.playerId === pid && s.date === selected.date && (s.type || '') === (selected.type || '')
            );
            if (!sessionForPlayer) return;

            if (metricDef.special === 'iio') {
                if (typeof this.calculateGpsIntensityIndex === 'function') {
                    const iio = this.calculateGpsIntensityIndex(pid, sessionForPlayer.id);
                    if (iio) value = iio.score;
                }
            } else if (this.gpsData && this.gpsData[sessionForPlayer.id]) {
                const gps = this.gpsData[sessionForPlayer.id][pid];
                if (gps && gps[metricDef.key] != null) value = gps[metricDef.key];
            }
        } else {
            const range = this._gpsBarsRange || '30';
            const cutoff = range === 'all' ? null : new Date(Date.now() - parseInt(range, 10) * 86400000);
            const playerSessions = this._applyGpsTypeFilter(this.sessions || [])
                .filter(s => s.playerId === pid)
                .filter(s => !cutoff || new Date(s.date) >= cutoff);

            const values = [];
            playerSessions.forEach(s => {
                if (metricDef.special === 'iio') {
                    if (typeof this.calculateGpsIntensityIndex === 'function') {
                        const iio = this.calculateGpsIntensityIndex(pid, s.id);
                        if (iio) values.push(iio.score);
                    }
                } else {
                    const gps = this.gpsData && this.gpsData[s.id] ? this.gpsData[s.id][pid] : null;
                    if (gps && gps[metricDef.key] != null) values.push(gps[metricDef.key]);
                }
            });
            if (values.length > 0) {
                value = metricDef.agg === 'avg'
                    ? values.reduce((a, b) => a + b, 0) / values.length
                    : values.reduce((a, b) => a + b, 0);
            }
        }

        if (value !== null) perPlayerValues.push(value);
    });

    if (perPlayerValues.length === 0) return null;
    return perPlayerValues.reduce((a, b) => a + b, 0) / perPlayerValues.length;
};

// Dibuja las barras verticales agrupadas: una barra por jugadora
// elegida (+ una barra extra de "Media del equipo" si está activada),
// para la métrica seleccionada. El eje Y se adapta automáticamente al
// tipo de unidad de esa métrica (metros, conteos, km/h, etc.) porque
// solo se representa una métrica a la vez.
RPETracker.prototype._drawGpsBarsChart = function() {
    const canvas = document.getElementById('gpsBarsCanvas');
    if (!canvas || typeof Chart === 'undefined') return;
    if (canvas._ci) { canvas._ci.destroy(); canvas._ci = null; }

    const metricDef = GPS_COMPARISON_METRICS.find(m => m.key === this._gpsBarsMetric) || GPS_COMPARISON_METRICS[0];
    const selectedPlayers = this._gpsBarsPlayerIds
        .map(id => this.players.find(p => p.id === id))
        .filter(Boolean);

    if (selectedPlayers.length === 0) return;

    const labels = selectedPlayers.map(p => p.name);
    const values = selectedPlayers.map(p => this._getGpsBarsValue(metricDef, p.id));
    const colors = selectedPlayers.map(p => PlayerTokens.get(p));

    if (this._gpsBarsShowTeamAvg) {
        const teamAvg = this._getGpsBarsValue(metricDef, null);
        labels.push('Media del equipo');
        values.push(teamAvg);
        colors.push('#888');
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textC = isDark ? '#aaa' : '#555';
    const gridC = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';

    canvas._ci = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: metricDef.label,
                data: values.map(v => v == null ? 0 : Math.round(v * 10) / 10),
                backgroundColor: colors.map(c => c + 'cc'),
                borderColor: colors,
                borderWidth: 1.5,
                borderRadius: 6,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `${ctx.parsed.y?.toFixed ? ctx.parsed.y.toFixed(1) : ctx.parsed.y}${metricDef.unit ? ' ' + metricDef.unit : ''}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textC, font: { size: 10 }, maxRotation: 45, minRotation: 0 },
                    grid: { display: false }
                },
                y: {
                    beginAtZero: true,
                    title: { display: true, text: metricDef.unit ? `${metricDef.label} (${metricDef.unit})` : metricDef.label, color: textC, font: { size: 11 } },
                    ticks: { color: textC, font: { size: 10 } },
                    grid: { color: gridC }
                }
            }
        }
    });
};

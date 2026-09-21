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
    { key: 'maxAccelerations',     label: 'Aceleraciones (máx.)', unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
    { key: 'maxDecelerations',     label: 'Deceleraciones (máx.)',unit: '',       unitType: GPS_UNIT_TYPES.COUNT,    agg: 'sum' },
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

    const alertOpen = typeof Store !== 'undefined' && Store.getString('gpsAlertOpen') === 'true';

    return `
        <details class="ewma-info-box gps-alert-box" id="gpsAlertDetails" ${alertOpen ? 'open' : ''}
            ontoggle="if(typeof Store!=='undefined') Store.set('gpsAlertOpen', this.open)">
            <summary class="ewma-summary">
                <span>⚠️ ${alerts.length} jugadora${alerts.length > 1 ? 's' : ''} con carga a revisar</span>
                <span class="ewma-toggle-hint">ver quiénes</span>
            </summary>
            <div class="ewma-body gps-alert-list">
                ${alerts.map(a => `
                    <div class="gps-alert-row" onclick="window.rpeTracker._gpsAnSwitchTab('player'); window.rpeTracker._gpsAnSetPlayer('${a.player.id}');">
                        <span class="gps-alert-name">${esc(a.player.name)}</span>
                        <span class="gps-alert-reason">${esc(a.reasons.join(', '))}</span>
                    </div>`).join('')}
            </div>
        </details>`;
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
        <div class="an-header" style="margin-bottom:0;display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap;">
            <div>
                <h2 class="view-title" style="margin:0 0 4px 0;">📡 Analítica GPS (Oli Sports)</h2>
                <p style="margin:0 0 12px 0;color:var(--text-secondary);font-size:0.9rem;">
                    Compara la carga interna (RPE × duración) con la carga externa objetiva del GPS.
                </p>
            </div>
            <button class="btn-primary" style="font-size:0.85rem;white-space:nowrap;" onclick="window.rpeTracker.openGpsImportFromTab()">
                📤 Importar CSV
            </button>
        </div>
        ${this._renderGpsAlertBanner()}
        <div class="an-tabs">
            <button class="an-tab ${this._gpsAnTab === 'player' ? 'active' : ''}" onclick="window.rpeTracker._gpsAnSwitchTab('player')">👤 Evolución jugadora</button>
            <button class="an-tab ${this._gpsAnTab === 'team' ? 'active' : ''}" onclick="window.rpeTracker._gpsAnSwitchTab('team')">👥 Comparativa equipo</button>
            <button class="an-tab ${this._gpsAnTab === 'radar' ? 'active' : ''}" onclick="window.rpeTracker._gpsAnSwitchTab('radar')">📊 Comparar jugadoras</button>
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

    // Estado inicial: ninguna jugadora seleccionada, métrica externa
    // en distancia (m), rango 30 días. La selección múltiple es
    // siempre directa (tocar un chip la añade/quita), sin modo previo
    // que activar — igual que el filtro de chips de Equipo > Jugadoras.
    if (!(this._gpsAnPlayerIds instanceof Set)) this._gpsAnPlayerIds = new Set();
    if (!this._gpsAnExternalMetric) this._gpsAnExternalMetric = 'm';
    if (!this._gpsAnalyticsRange) this._gpsAnalyticsRange = '30';

    const selectedCount = this._gpsAnPlayerIds.size;
    const allSelected = selectedCount > 0 && selectedCount === activePlayers.length;

    const chips = activePlayers.map(p => {
        const color = PlayerTokens.get(p);
        const checked = this._gpsAnPlayerIds.has(p.id);
        return `<button type="button" class="player-filter-chip ${checked ? 'player-filter-chip--selected' : ''}"
                style="--chip-color:${color}"
                title="${esc(p.name)}"
                onclick="window.rpeTracker._gpsAnTogglePlayer('${p.id}', ${!checked})">
                ${esc(p.name.split(' ')[0])}
                ${checked ? '<span class="player-filter-chip-check">✓</span>' : ''}
            </button>`;
    }).join('');

    container.innerHTML = `
        <div class="ac-curve-controls" style="margin-bottom:10px;">
            <div class="player-filter-chips" style="margin:0;">
                <button type="button" class="player-filter-all-btn ${allSelected ? 'player-filter-all-btn--active' : ''}"
                    title="${allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}"
                    onclick="window.rpeTracker._gpsAnSelectAllPlayers()">
                    ${allSelected ? '✓ Todas' : 'Todas'}
                </button>
                ${chips}
            </div>
        </div>

        <div class="gps-an-controls" style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:16px;">
            <select id="gpsAnRangeSelect" onchange="window.rpeTracker._gpsAnSetRange(this.value)">
                <option value="30" ${this._gpsAnalyticsRange === '30' ? 'selected' : ''}>Últimos 30 días</option>
                <option value="90" ${this._gpsAnalyticsRange === '90' ? 'selected' : ''}>Últimos 90 días</option>
                <option value="all" ${this._gpsAnalyticsRange === 'all' ? 'selected' : ''}>Toda la temporada</option>
            </select>
            <div style="margin-left:auto;display:flex;gap:12px;flex-wrap:wrap;align-items:center;">
                ${this._renderGpsTypeFilterSelect()}
                ${selectedCount > 1 ? `
                    <div class="gps-metric-toggle">
                        <button class="gps-metric-chip ${this._gpsAnExternalMetric === 'm' ? 'active' : ''}" onclick="window.rpeTracker._gpsAnSetExternalMetric('m')">m</button>
                        <button class="gps-metric-chip ${this._gpsAnExternalMetric === 'iio' ? 'active' : ''}" onclick="window.rpeTracker._gpsAnSetExternalMetric('iio')">IIO</button>
                    </div>
                ` : ''}
            </div>
        </div>

        <div class="gps-an-chart-card" style="background:var(--bg-surface);border-radius:12px;padding:16px;margin-bottom:20px;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
            <div style="display:flex;justify-content:flex-end;margin-bottom:4px;">
                <button class="btn-secondary" style="font-size:0.78rem;padding:4px 10px;" onclick="window.rpeTracker._downloadGpsChart('gpsAnComparisonCanvas', 'evolucion-gps')">📥 Descargar</button>
            </div>
            <div style="height:320px;">
                <canvas id="gpsAnComparisonCanvas"></canvas>
            </div>
            ${selectedCount === 0 ? `
                <p style="text-align:center;color:var(--text-secondary);font-size:0.85rem;margin-top:12px;">
                    Elige al menos una jugadora para ver su evolución.
                </p>
            ` : ''}
        </div>

        <div id="gpsAnTableContainer"></div>
        <div id="gpsIioInfoContainer" style="margin-top:12px;">${this._renderGpsIioInfoBox()}</div>
    `;

    requestAnimationFrame(() => {
        this._drawGpsComparisonChart();
        this._renderGpsSessionsTable();
    });
};

RPETracker.prototype._gpsAnTogglePlayer = function(playerId, checked) {
    if (!(this._gpsAnPlayerIds instanceof Set)) this._gpsAnPlayerIds = new Set();

    // Selección múltiple directa: cada chip es independiente, sin
    // necesidad de activar antes ningún "modo" (igual que el filtro
    // de chips de Equipo > Jugadoras).
    if (checked) this._gpsAnPlayerIds.add(playerId);
    else this._gpsAnPlayerIds.delete(playerId);

    // Mantenemos _gpsAnalyticsPlayerId (usado por la tabla) apuntando a
    // la única jugadora seleccionada cuando hay exactamente una; si hay
    // varias o ninguna, la tabla se oculta y este valor deja de usarse
    // para pintar pero lo dejamos con la última tocada por si vuelve a 1.
    if (this._gpsAnPlayerIds.size === 1) {
        this._gpsAnalyticsPlayerId = [...this._gpsAnPlayerIds][0];
    }

    // El selector de métrica externa (m / IIO) solo tiene sentido con
    // 2+ jugadoras; re-renderizamos los controles para mostrarlo/ocultarlo.
    const container = document.getElementById('gpsAnTabContent');
    if (container) this._renderGpsPlayerEvolutionTab(container);
};

// Selecciona todas las jugadoras activas, o ninguna si ya estaban
// todas seleccionadas. Botón "Todas" siempre visible junto a los chips.
RPETracker.prototype._gpsAnSelectAllPlayers = function() {
    const activePlayers = this.players.filter(p => !p.archived);
    const allSelected = this._gpsAnPlayerIds instanceof Set && this._gpsAnPlayerIds.size === activePlayers.length;

    this._gpsAnPlayerIds = allSelected ? new Set() : new Set(activePlayers.map(p => p.id));

    const container = document.getElementById('gpsAnTabContent');
    if (container) this._renderGpsPlayerEvolutionTab(container);
};

RPETracker.prototype._gpsAnSetExternalMetric = function(metric) {
    this._gpsAnExternalMetric = metric;
    this._drawGpsComparisonChart();
};

// Selecciona UNA jugadora en exclusiva (usado desde el aviso de
// "carga a revisar" y otros enlaces directos): deja el gráfico en
// modo 1 jugadora, ignorando cualquier selección previa.
RPETracker.prototype._gpsAnSetPlayer = function(playerId) {
    this._gpsAnalyticsPlayerId = playerId;
    this._gpsAnPlayerIds = new Set([playerId]);
    const container = document.getElementById('gpsAnTabContent');
    if (container) {
        this._renderGpsPlayerEvolutionTab(container);
    } else {
        this._drawGpsComparisonChart();
        this._renderGpsSessionsTable();
    }
};

RPETracker.prototype._gpsAnSetRange = function(range) {
    this._gpsAnalyticsRange = range;
    this._drawGpsComparisonChart();
    this._renderGpsSessionsTable();
};

// Devuelve las sesiones de la jugadora seleccionada para la TABLA
// (this._gpsAnalyticsPlayerId), dentro del rango elegido, ordenadas
// por fecha ascendente, con su dato GPS si existe. Comportamiento
// original sin cambios — la tabla solo se muestra con 1 jugadora.
RPETracker.prototype._getGpsAnalyticsData = function() {
    const playerId = this._gpsAnalyticsPlayerId;
    if (!playerId) return [];

    const range = this._gpsAnalyticsRange || '30';
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

// Devuelve las sesiones de UNA jugadora concreta (parámetro explícito),
// dentro del rango elegido, ordenadas por fecha, con su dato GPS si
// existe. Usada por el modo multi-jugadora del gráfico.
RPETracker.prototype._getGpsAnalyticsDataForPlayer = function(playerId) {
    if (!playerId) return [];
    const range = this._gpsAnalyticsRange || '30';
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

    const selectedIds = this._gpsAnPlayerIds instanceof Set ? [...this._gpsAnPlayerIds] : [];
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridC = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
    const textC = isDark ? '#888' : '#999';

    if (selectedIds.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    // ----- Modo 1 jugadora: comportamiento original (interna vs externa en m) -----
    if (selectedIds.length === 1) {
        this._gpsAnalyticsPlayerId = selectedIds[0];
        const data = this._getGpsAnalyticsDataForPlayer(selectedIds[0]);
        const player = this.players.find(p => p.id === selectedIds[0]);
        const color = player ? PlayerTokens.get(player) : '#ff6600';

        if (data.length === 0) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            return;
        }

        const labels = data.map(d => new Date(d.session.date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));
        const internalLoad = data.map(d => d.session.load ?? null);
        const externalLoad = data.map(d => d.gps && d.gps.distanceM != null ? d.gps.distanceM : null);

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
        return;
    }

    // ----- Modo 2+ jugadoras: una línea por jugadora, métrica externa elegida (m / IIO) -----
    const metric = this._gpsAnExternalMetric === 'iio' ? 'iio' : 'm';
    const perPlayerData = selectedIds.map(id => ({
        player: this.players.find(p => p.id === id),
        data: this._getGpsAnalyticsDataForPlayer(id)
    })).filter(p => p.player);

    // Eje X común: todas las fechas de sesión de cualquiera de las
    // jugadoras seleccionadas, en orden cronológico, sin duplicados.
    const allDatesSet = new Set();
    perPlayerData.forEach(p => p.data.forEach(d => allDatesSet.add(d.session.date)));
    const allDates = [...allDatesSet].sort((a, b) => new Date(a) - new Date(b));

    if (allDates.length === 0) {
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        return;
    }

    const labels = allDates.map(d => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }));

    const datasets = perPlayerData.map(({ player, data }) => {
        const color = PlayerTokens.get(player);
        const byDate = {};
        data.forEach(d => { byDate[d.session.date] = d; });

        const values = allDates.map(date => {
            const d = byDate[date];
            if (!d) return null;
            if (metric === 'iio') {
                if (typeof this.calculateGpsIntensityIndex !== 'function') return null;
                const iio = this.calculateGpsIntensityIndex(d.session.playerId, d.session.id);
                return iio ? iio.score : null;
            }
            return d.gps && d.gps.distanceM != null ? d.gps.distanceM : null;
        });

        return {
            label: player.name,
            data: values,
            borderColor: color,
            backgroundColor: 'transparent',
            borderWidth: 2,
            pointRadius: 2,
            tension: 0.3,
            spanGaps: true
        };
    });

    const yTitle = metric === 'iio' ? 'IIO (0-100)' : 'Distancia GPS (m)';

    canvas._ci = new Chart(canvas.getContext('2d'), {
        type: 'line',
        data: { labels, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 10 }, color: textC } },
                tooltip: { mode: 'index', intersect: false }
            },
            scales: {
                x: { ticks: { color: textC, maxTicksLimit: 8, font: { size: 10 } }, grid: { color: gridC } },
                y: {
                    type: 'linear',
                    title: { display: true, text: yTitle, color: textC, font: { size: 10 } },
                    ticks: { color: textC, font: { size: 10 } }, grid: { color: gridC }
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

// Desplegable explicativo del IIO (Índice de Intensidad Objetiva),
// mismo patrón visual que el de EWMA en Análisis A:C.
RPETracker.prototype._renderGpsIioInfoBox = function() {
    const iioOpen = typeof Store !== 'undefined' && Store.getString('gpsIioOpen') === 'true';

    return `
        <details class="ewma-info-box" id="gpsIioDetails" ${iioOpen ? 'open' : ''}
            ontoggle="if(typeof Store!=='undefined') Store.set('gpsIioOpen', this.open)">
            <summary class="ewma-summary">
                <span>ℹ️ ¿Qué es el IIO y cómo se calcula?</span>
                <span class="ewma-toggle-hint">ver más</span>
            </summary>
            <div class="ewma-body">
                <p style="margin-bottom:0.5rem"><strong>IIO = Índice de Intensidad Objetiva</strong> (0-100%)</p>
                <p style="margin-bottom:0.5rem">
                    Resume el esfuerzo físico <strong>objetivo</strong> de una jugadora en una sesión, medido por el GPS,
                    en una única escala comparable con el RPE (esfuerzo <strong>percibido</strong>). Así puedes ver de un
                    vistazo si ambos coinciden o divergen.
                </p>
                <p style="margin-bottom:0.5rem"><strong>Se calcula combinando 4 bloques:</strong></p>
                <ul style="margin-left:1.5rem;color:var(--gray)">
                    <li><strong>Volumen (25%):</strong> distancia total ×1 y minutos jugados ×1</li>
                    <li><strong>Intensidad de carrera (30%):</strong> caminata ×1, trote ×2, carrera moderada ×3, carrera de alta intensidad ×4, sprint ×5</li>
                    <li><strong>Esfuerzos explosivos (30%):</strong> cambios de dirección ×2, saltos ×2, aceleración/deceleración alta ×3, aceleración/deceleración máxima ×4</li>
                    <li><strong>Impacto/contacto (15%):</strong> impacto bajo ×1, medio ×2, alto ×3, máximo ×4</li>
                </ul>
                <p style="margin:0.25rem 0 0.5rem;color:var(--text-secondary);font-size:0.85em">
                    Dentro de cada bloque, ese multiplicador (×1 a ×5) determina cuánto pesa esa métrica frente a las
                    demás del mismo bloque — a mayor exigencia física de la banda, mayor multiplicador.
                </p>
                <p style="margin:0.5rem 0">
                    Cada métrica se normaliza sobre el <strong>máximo histórico de esa misma jugadora</strong> en la temporada
                    (su valor más alto registrado = 100%), no se compara entre jugadoras. Es el mismo criterio que usa el
                    RPE: una escala individual, para que la comparación entre "lo que siente" y "lo que hizo" tenga sentido.
                </p>
                <p style="margin:0.5rem 0;color:var(--text-secondary);font-size:0.85em">
                    Con pocas sesiones registradas todavía, ese máximo histórico es menos fiable (puede ser un único día
                    atípico) — el IIO se muestra igual, pero conviene interpretarlo con cautela hasta tener más datos.
                </p>
                <p style="margin:0.5rem 0;color:var(--text-secondary);font-size:0.85em">
                    <strong>Nota:</strong> los pesos de cada bloque (25/30/30/15%) y los multiplicadores de cada banda son
                    una aproximación razonable basada en la exigencia fisiológica de cada tipo de esfuerzo, no una fórmula
                    científica exacta — es una entre varias formas defendibles de ponderar estos datos. Además, el máximo
                    histórico no "olvida" sesiones antiguas con el tiempo, así que una marca muy atípica de hace meses
                    puede seguir marcando el 100% de referencia hoy.
                </p>
            </div>
        </details>`;
};

// Máximo histórico ABSOLUTO de una jugadora para una métrica GPS,
// recorriendo TODAS sus sesiones con dato GPS (sin límite de rango de
// fechas). No se cachea ni se guarda en ningún sitio: se recalcula cada
// vez que se llama, así que si aparece una marca nueva más alta, el
// resto de la tabla se recalcula sola la próxima vez que se pinte —
// nunca queda un máximo "congelado" desactualizado.
RPETracker.prototype._getGpsPlayerMaxEver = function(playerId, metricKey) {
    let max = 0;
    (this.sessions || []).forEach(s => {
        if (s.playerId !== playerId) return;
        const gpsGroup = this.gpsData ? this.gpsData[s.id] : null;
        const gps = gpsGroup ? gpsGroup[playerId] : null;
        const val = gps && gps[metricKey] != null ? gps[metricKey] : null;
        if (val != null && val > max) max = val;
    });
    return max;
};

// Color según el % de la marca histórica máxima de la jugadora. >100%
// (nueva mejor marca) se distingue con negrita, aplicada aparte en el HTML.
RPETracker.prototype._getGpsIntensityColor = function(pct) {
    if (pct > 100) return '#c0392b';  // rojo intenso — nueva mejor marca
    if (pct >= 90)  return '#e74c3c'; // rojo
    if (pct >= 75)  return '#e67e22'; // naranja fuerte
    if (pct >= 50)  return '#f5a623'; // naranja/amarillo
    if (pct >= 20)  return 'var(--text-primary)'; // color normal de texto
    return '#27ae60'; // verde — sesión suave para esa jugadora
};

RPETracker.prototype._renderGpsSessionsTable = function() {
    const container = document.getElementById('gpsAnTableContainer');
    if (!container) return;

    // La tabla de detalle solo tiene sentido para UNA jugadora a la
    // vez; con 2+ seleccionadas en el gráfico, se oculta para no
    // mezclar sesiones de varias jugadoras en las mismas filas.
    const selectedCount = this._gpsAnPlayerIds instanceof Set ? this._gpsAnPlayerIds.size : 1;
    if (selectedCount > 1) {
        container.innerHTML = `
            <div class="an-empty" style="text-align:center;color:var(--text-secondary);font-size:0.85rem;padding:16px;">
                📊 Selecciona una sola jugadora en el gráfico para ver su tabla de detalle sesión a sesión.
            </div>`;
        return;
    }

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
        const dateStr = new Date(session.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
        const iio = typeof this.calculateGpsIntensityIndex === 'function'
            ? this.calculateGpsIntensityIndex(session.playerId, session.id)
            : null;

        const dynamicCells = columns.map(m => {
            const val = gps && gps[m.key] != null ? gps[m.key] : null;
            if (val == null) return '<td>—</td>';
            const display = m.key.endsWith('M') || m.key === 'distanceM' ? Math.round(val) : val;

            const maxEver = this._getGpsPlayerMaxEver(session.playerId, m.key);
            if (maxEver <= 0) return `<td>${display}${m.unit ? ' ' + m.unit : ''}</td>`;

            const pct = Math.round((val / maxEver) * 100);
            const color = this._getGpsIntensityColor(pct);
            const bold = pct > 100 ? 'font-weight:700;' : '';
            const cellId = `gpsCell_${session.id}_${m.key}`;
            return `<td>
                <span id="${cellId}" class="gps-intensity-cell" style="color:${color};${bold}cursor:pointer;"
                    data-raw="${display}${m.unit ? ' ' + m.unit : ''}" data-pct="${pct}%" data-showing="raw"
                    onclick="event.stopPropagation();window.rpeTracker._gpsToggleCellDisplay('${cellId}')"
                    title="Toca para ver el % sobre su máximo histórico">${display}${m.unit ? ' ' + m.unit : ''}</span>
            </td>`;
        }).join('');

        return `
        <tr onclick="window.rpeTracker.showSessionDetail('${session.id}')" style="cursor:pointer;">
            <td>${dateStr}</td>
            <td style="font-weight:600;" title="${esc(session.type || '')}">${this._gpsSessionTypeLetter(session.type)}</td>
            <td>${session.rpe ?? '—'}</td>
            <td>${iio ? iio.score + '%' : '—'}</td>
            ${dynamicCells}
        </tr>`;
    }).join('');

    const intensityLegend = `
        <div class="gps-intensity-legend" style="display:flex;flex-wrap:wrap;gap:10px;align-items:center;margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:0.72rem;color:var(--text-secondary);">
            <span>Color = % sobre su máximo histórico personal en esa métrica (toca un dato para ver el % exacto):</span>
            <span style="color:#27ae60;">● 0–20%</span>
            <span style="color:var(--text-primary);">● 20–50%</span>
            <span style="color:#f5a623;">● 50–75%</span>
            <span style="color:#e67e22;">● 75–90%</span>
            <span style="color:#e74c3c;">● 90–100%</span>
            <span style="color:#c0392b;font-weight:700;">● &gt;100% (nueva mejor marca)</span>
        </div>`;

    container.innerHTML = columnsPicker + `
        <div class="gps-an-table-card" style="background:var(--bg-surface);border-radius:12px;padding:16px;overflow-x:auto;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
            <table class="data-table">
                <thead>
                    <tr style="font-size:0.8rem;color:var(--text-secondary);">
                        <th>Fecha</th><th>Tipo</th><th>RPE app</th><th>IIO</th>
                        ${columns.map(m => `<th>${esc(m.label)}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
            ${intensityLegend}
        </div>`;
};

// Alterna una celda de la tabla entre su valor bruto (p.ej. "35") y su
// porcentaje sobre el máximo histórico de esa jugadora (p.ej. "93%").
RPETracker.prototype._gpsToggleCellDisplay = function(cellId) {
    const el = document.getElementById(cellId);
    if (!el) return;
    const showingPct = el.dataset.showing === 'pct';
    el.textContent = showingPct ? el.dataset.raw : el.dataset.pct;
    el.dataset.showing = showingPct ? 'raw' : 'pct';
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

            <div style="margin-left:auto;">${this._renderGpsTypeFilterSelect()}</div>
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
// agrupan por fecha+franja horaria+tipo (todas las jugadoras de la
// misma sesión comparten fecha), mostrando la más reciente primero.
//
// IMPORTANTE: si hay dos entrenos el mismo día (mañana y tarde), hay
// que distinguirlos en la etiqueta — si no, aparecerían dos opciones
// idénticas en el selector y sería imposible saber cuál es cuál al
// importar un CSV. Por eso se agrupa por `timeOfDay` (campo explícito
// que ya guarda cada sesión) y se muestra en la etiqueta.
RPETracker.prototype._getTeamSessionOptions = function() {
    const seen = new Map();
    this._applyGpsTypeFilter(this.sessions || [])
        .forEach(s => {
            const key = s.date + '|' + (s.timeOfDay || '') + '|' + (s.type || '');
            if (!seen.has(key)) {
                const dateLabel = new Date(s.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: 'numeric' });
                const timeLabel = s.timeOfDay === 'morning' ? '☀️ Mañana'
                    : s.timeOfDay === 'evening' ? '🌙 Tarde'
                    : ''; // sesiones antiguas sin timeOfDay: no se añade nada
                seen.set(key, {
                    id: s.id, // usamos el id de la primera sesión de ese grupo como referencia
                    date: s.date,
                    type: s.type,
                    label: `${dateLabel}${timeLabel ? ' ' + timeLabel : ''} — ${s.type || 'Sesión'}`
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

const GPS_BARS_MAX_PLAYERS = 2; // comparativa cara a cara: jugadora o media del equipo, máximo 2

// Los 6 ejes del radar son siempre los mismos (no elegibles). Cada uno usa
// una o varias métricas de GPS_COMPARISON_METRICS ya existentes, sumadas
// cuando el eje combina "alta + máxima intensidad" en un único valor.
const GPS_RADAR_AXES = [
    { label: 'Distancia Recorrida',   keys: ['distanceM'] },
    { label: 'Velocidad Máxima',      keys: ['maxSpeedKmh'] },
    { label: 'Carreras de Alta y Máx. Intensidad', keys: ['highIntensityRunsM', 'maxIntensityRunsM'] },
    { label: 'Cambios de Dirección',  keys: ['directionChanges'] },
    { label: 'Acel. de Alta y Máx. Intensidad', keys: ['highAccelerations', 'maxAccelerations'] },
    { label: 'Desac. de Alta y Máx. Intensidad', keys: ['highDecelerations', 'maxDecelerations'] },
];

// Tarjetas de comparación numérica (debajo del radar): TODOS los datos
// disponibles, siempre visibles, sin selección — 'calc' señala una
// métrica derivada (no es una columna directa del CSV); se calcula
// aparte en _getGpsCompareCardValue.
const GPS_COMPARE_CARDS = [
    { key: 'playTimeMin',   label: 'Tiempo de actividad', unit: 'min',   decimals: 1 },
    { key: 'distPerMin',    label: 'Dist. por minuto de actividad', unit: 'm/min', decimals: 1, calc: true },
    { key: 'distanceM',     label: 'Distancia recorrida', unit: 'm',    decimals: 0 },
    { key: 'maxSpeedKmh',   label: 'Velocidad máxima',    unit: 'km/h', decimals: 1 },
    { key: 'iio',           label: 'Intensidad Objetiva (IIO)', unit: '%', decimals: 0, special: 'iio' },
    { key: 'walkM',              label: 'Caminata (distancia)', unit: 'm', decimals: 0 },
    { key: 'walkCount',          label: 'Caminata (episodios)', unit: '',  decimals: 0 },
    { key: 'jogM',                label: 'Trote (distancia)',   unit: 'm', decimals: 0 },
    { key: 'jogCount',            label: 'Trote (episodios)',   unit: '',  decimals: 0 },
    { key: 'moderateRunM',        label: 'Carrera moderada (distancia)', unit: 'm', decimals: 0 },
    { key: 'moderateRunCount',    label: 'Carrera moderada (episodios)', unit: '',  decimals: 0 },
    { key: 'highIntensityRunsM',  label: 'Carrera alta int. (distancia)', unit: 'm', decimals: 0 },
    { key: 'highIntensityRuns',   label: 'Carrera alta int. (episodios)', unit: '',  decimals: 0 },
    { key: 'maxIntensityRunsM',   label: 'Sprint (distancia)',  unit: 'm', decimals: 0 },
    { key: 'maxIntensityRuns',    label: 'Sprints (episodios)', unit: '',  decimals: 0 },
    { key: 'jumps',               label: 'Saltos',              unit: '',  decimals: 0 },
    { key: 'directionChanges',    label: 'Cambios de dirección', unit: '', decimals: 0 },
    { key: 'highAccelerations',   label: 'Aceleraciones (alta)', unit: '', decimals: 0 },
    { key: 'maxAccelerations',    label: 'Aceleraciones (máx.)', unit: '', decimals: 0 },
    { key: 'highDecelerations',   label: 'Deceleraciones (alta)', unit: '', decimals: 0 },
    { key: 'maxDecelerations',    label: 'Deceleraciones (máx.)', unit: '', decimals: 0 },
    { key: 'impactsHigh',         label: 'Impactos alta int.',  unit: '',  decimals: 0 },
    { key: 'impactsMax',          label: 'Impactos máx. int.',  unit: '',  decimals: 0 },
    { key: 'caloriesTotal',       label: 'Calorías totales',    unit: 'kcal', decimals: 0 },
];

RPETracker.prototype._renderGpsRadarTab = function(container) {
    if (!this._gpsBarsModeCtx) this._gpsBarsModeCtx = 'session'; // 'session' | 'range'
    if (!this._gpsBarsRange) this._gpsBarsRange = '30';
    if (!Array.isArray(this._gpsBarsPlayerIds)) this._gpsBarsPlayerIds = [];
    if (this._gpsBarsShowTeamAvg === undefined) this._gpsBarsShowTeamAvg = false;

    const activePlayers = this.players.filter(p => !p.archived);
    const teamSessions = this._getTeamSessionOptions();

    // Selección inicial: si no hay nadie elegido, arrancamos con las 2
    // primeras del roster activo para que la comparativa no aparezca
    // vacía la primera vez que se abre la pestaña.
    if (this._gpsBarsPlayerIds.length === 0 && !this._gpsBarsShowTeamAvg && activePlayers.length > 0) {
        this._gpsBarsPlayerIds = activePlayers.slice(0, 2).map(p => p.id);
    }
    if (!this._gpsBarsSessionId && teamSessions.length > 0) this._gpsBarsSessionId = teamSessions[0].id;

    const selectedPlayers = this._gpsBarsPlayerIds.map(id => this.players.find(p => p.id === id)).filter(Boolean);
    const sides = [...selectedPlayers.map(p => ({ id: p.id, name: p.name, position: p.position || '', color: PlayerTokens.get(p) }))];
    if (this._gpsBarsShowTeamAvg) sides.push({ id: null, name: 'Media del equipo', position: '', color: '#888' });

    container.innerHTML = `
        <div class="gps-an-controls" style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;align-items:center;">
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

            <div style="margin-left:auto;">${this._renderGpsTypeFilterSelect()}</div>
        </div>

        <div class="gps-an-controls" style="margin-bottom:16px;">
            <div class="player-filter-chips" style="margin:0;">
                ${activePlayers.map(p => {
                    const color = PlayerTokens.get(p);
                    const checked = this._gpsBarsPlayerIds.includes(p.id);
                    return `<button type="button" class="player-filter-chip ${checked ? 'player-filter-chip--selected' : ''}"
                            style="--chip-color:${color}"
                            title="${esc(p.name)}"
                            onclick="window.rpeTracker._gpsBarsTogglePlayer('${p.id}', ${!checked})">
                            ${esc(p.name.split(' ')[0])}
                            ${checked ? '<span class="player-filter-chip-check">✓</span>' : ''}
                        </button>`;
                }).join('')}
                <button type="button" class="player-filter-chip ${this._gpsBarsShowTeamAvg ? 'player-filter-chip--selected' : ''}"
                    style="--chip-color:#888"
                    title="Media del equipo"
                    onclick="window.rpeTracker._gpsBarsToggleTeamAvg(${!this._gpsBarsShowTeamAvg})">
                    📊 Media del equipo
                    ${this._gpsBarsShowTeamAvg ? '<span class="player-filter-chip-check">✓</span>' : ''}
                </button>
            </div>
        </div>

        ${sides.length < 1 ? `
            <div class="gps-an-chart-card" style="background:var(--bg-surface);border-radius:12px;padding:24px;text-align:center;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
                <p style="color:var(--text-secondary);font-size:0.9rem;margin:0;">
                    Elige una jugadora para ver sus datos, o dos (o una y la media del equipo) para compararlas.
                </p>
            </div>
        ` : this._renderGpsCompareHead(sides) + this._renderGpsCompareCards(sides)}
    `;

    if (sides.length >= 1) requestAnimationFrame(() => this._drawGpsRadarChart(sides));
};

RPETracker.prototype._gpsBarsSetModeCtx = function(ctx) {
    this._gpsBarsModeCtx = ctx;
    this._renderGpsRadarTab(document.getElementById('gpsAnTabContent'));
};
RPETracker.prototype._gpsBarsSetSession = function(id) {
    this._gpsBarsSessionId = id;
    this._renderGpsRadarTab(document.getElementById('gpsAnTabContent'));
};
RPETracker.prototype._gpsBarsSetRange = function(range) {
    this._gpsBarsRange = range;
    this._renderGpsRadarTab(document.getElementById('gpsAnTabContent'));
};

// Cuenta cuántos "lados" hay elegidos ahora mismo (jugadoras + media del
// equipo si está activada), para respetar el máximo de 2 (comparativa
// siempre cara a cara).
RPETracker.prototype._gpsCompareSelectedCount = function() {
    return this._gpsBarsPlayerIds.length + (this._gpsBarsShowTeamAvg ? 1 : 0);
};

RPETracker.prototype._gpsBarsTogglePlayer = function(id, checked) {
    if (checked) {
        if (this._gpsCompareSelectedCount() >= GPS_BARS_MAX_PLAYERS) {
            this.showToast(`⚠️ Máximo ${GPS_BARS_MAX_PLAYERS} elementos en la comparativa — quita uno antes de añadir otro`, 'warning');
            return;
        }
        this._gpsBarsPlayerIds.push(id);
    } else {
        this._gpsBarsPlayerIds = this._gpsBarsPlayerIds.filter(pid => pid !== id);
    }
    const container = document.getElementById('gpsAnTabContent');
    if (container) this._renderGpsRadarTab(container);
};
RPETracker.prototype._gpsBarsToggleTeamAvg = function(checked) {
    if (checked && this._gpsCompareSelectedCount() >= GPS_BARS_MAX_PLAYERS) {
        this.showToast(`⚠️ Máximo ${GPS_BARS_MAX_PLAYERS} elementos en la comparativa — quita uno antes de añadir otro`, 'warning');
        return;
    }
    this._gpsBarsShowTeamAvg = checked;
    const container = document.getElementById('gpsAnTabContent');
    if (container) this._renderGpsRadarTab(container);
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

// Cabecera de la comparativa: nombre + posición de cada lado, con su
// color propio (PlayerTokens, o gris para "Media del equipo").
RPETracker.prototype._renderGpsCompareHead = function(sides) {
    // Con 1 solo lado (vista individual, sin comparar), el nombre se
    // centra en vez de quedar pegado a la izquierda.
    const single = sides.length === 1;
    return `
        <div class="gps-compare-head" style="display:flex;justify-content:${single ? 'center' : 'space-between'};align-items:center;gap:16px;margin-bottom:16px;">
            ${sides.map((side, i) => `
                <div style="flex:${single ? '0 1 auto' : '1'};text-align:${single ? 'center' : (i === 0 ? 'left' : 'right')};min-width:0;">
                    <div style="font-weight:700;font-size:1rem;color:${side.color};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${esc(side.name)}</div>
                    ${side.position ? `<div style="font-size:0.8rem;color:var(--text-secondary);">${esc(side.position)}</div>` : ''}
                </div>
            `).join('')}
        </div>`;
};

// Suma los valores de una o varias claves de GPS_COMPARISON_METRICS para
// un "lado" (jugadora o media del equipo), en el contexto sesión/rango
// ya elegido. Se apoya en _getGpsBarsValue (misma lógica de siempre).
RPETracker.prototype._getGpsRadarAxisValue = function(axisKeys, playerId) {
    let total = 0, any = false;
    axisKeys.forEach(key => {
        const metricDef = GPS_COMPARISON_METRICS.find(m => m.key === key);
        if (!metricDef) return;
        const v = this._getGpsBarsValue(metricDef, playerId);
        if (v != null) { total += v; any = true; }
    });
    return any ? total : null;
};

// Dibuja el radar de 6 ejes fijos, con 1 o 2 "lados" (jugadora o media
// del equipo). Con 2 lados, cada eje se normaliza 0-100% sobre el mayor
// de los dos valores comparados. Con 1 solo lado (vista individual, sin
// comparar), cada eje se normaliza sobre el máximo histórico de esa
// jugadora — mismo criterio que los colores de la tabla de Evolución
// jugadora — para responder "qué % de su techo habitual hizo aquí".
RPETracker.prototype._drawGpsRadarChart = function(sides) {
    const canvas = document.getElementById('gpsRadarCanvas');
    if (!canvas || typeof Chart === 'undefined') return;
    if (canvas._ci) { canvas._ci.destroy(); canvas._ci = null; }

    // La "Media del equipo" (si está presente) se dibuja siempre primero
    // (al fondo), para que el área de la jugadora comparada quede por
    // encima y no quede tapada por el relleno de la media.
    sides = [...sides].sort((a, b) => (a.id == null ? -1 : 0) - (b.id == null ? -1 : 0));

    const rawValues = sides.map(side => GPS_RADAR_AXES.map(axis => this._getGpsRadarAxisValue(axis.keys, side.id)));

    let axisMax;
    if (sides.length === 1) {
        const side = sides[0];
        axisMax = GPS_RADAR_AXES.map(axis => {
            if (side.id == null) {
                // "Media del equipo" en solitario: no hay un "máximo histórico
                // de la media" con sentido individual, así que se normaliza
                // sobre su propio valor actual (siempre se vería al 100%,
                // pero este caso solo ocurre si se elige únicamente la media).
                return Math.max(rawValues[0][GPS_RADAR_AXES.indexOf(axis)] || 0, 0.0001);
            }
            const maxes = axis.keys.map(key => this._getGpsPlayerMaxEver(side.id, key));
            return Math.max(maxes.reduce((a, b) => a + b, 0), 0.0001);
        });
    } else {
        axisMax = GPS_RADAR_AXES.map((axis, i) => Math.max(...rawValues.map(vals => vals[i] || 0), 0.0001));
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textC = isDark ? '#aaa' : '#555';
    const gridC = isDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.10)';

    const datasets = sides.map((side, i) => {
        // "Media del equipo" se dibuja SIN relleno (solo su contorno
        // discontinuo) — con relleno, cuando la jugadora domina en los
        // 6 ejes a la vez (su área ocupa el 100% del radar), el área de
        // la media queda completamente tapada por dentro, sea cual sea
        // el orden de dibujo o la opacidad. Sin relleno, su línea
        // siempre es visible por encima del área de la jugadora.
        const isTeamAvg = side.id == null;
        return {
            label: side.name,
            data: rawValues[i].map((v, ax) => v == null ? 0 : Math.round((v / axisMax[ax]) * 100)),
            backgroundColor: isTeamAvg ? 'transparent' : side.color + '33',
            borderColor: side.color,
            borderWidth: isTeamAvg ? 2.5 : 2,
            borderDash: isTeamAvg ? [6, 4] : [],
            pointBackgroundColor: side.color,
            pointRadius: 3,
        };
    });

    canvas._ci = new Chart(canvas.getContext('2d'), {
        type: 'radar',
        data: { labels: GPS_RADAR_AXES.map(a => a.label), datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 300 },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => {
                            const raw = rawValues[ctx.datasetIndex][ctx.dataIndex];
                            const refLabel = sides.length === 1 ? 'de su máx. histórico' : 'del máx. comparado';
                            return `${ctx.dataset.label}: ${raw != null ? Math.round(raw * 10) / 10 : '—'} (${ctx.parsed.r}% ${refLabel})`;
                        }
                    }
                }
            },
            scales: {
                r: {
                    beginAtZero: true,
                    max: 100,
                    ticks: { display: false, stepSize: 25 },
                    grid: { color: gridC },
                    angleLines: { color: gridC },
                    pointLabels: { color: textC, font: { size: 10.5 } }
                }
            }
        }
    });
};

// Valor de una tarjeta de comparación para un "lado". Las claves 'calc'
// (como distPerMin) no son una columna directa del CSV, se derivan de
// otras dos métricas ya calculables con _getGpsBarsValue.
RPETracker.prototype._getGpsCompareCardValue = function(cardDef, playerId) {
    if (cardDef.key === 'distPerMin') {
        const dist = this._getGpsBarsValue(GPS_COMPARISON_METRICS.find(m => m.key === 'distanceM'), playerId);
        const min = this._getGpsBarsValue(GPS_COMPARISON_METRICS.find(m => m.key === 'playTimeMin'), playerId);
        return (dist != null && min > 0) ? dist / min : null;
    }
    // El resto de tarjetas (incluido IIO) usan directamente la definición
    // ya existente en GPS_COMPARISON_METRICS, que ya trae special:'iio'
    // cuando corresponde.
    const metricDef = GPS_COMPARISON_METRICS.find(m => m.key === cardDef.key);
    return metricDef ? this._getGpsBarsValue(metricDef, playerId) : null;
};

// Tarjetas de comparación cara a cara: valor grande a cada lado y un
// círculo dual en el centro con el % de diferencia (lado derecho vs
// izquierdo), igual patrón visual para las 2-6 tarjetas elegidas.
// Todas las tarjetas de comparación (GPS_COMPARE_CARDS completo, sin
// selección) en un grid de 2 columnas en escritorio; se colapsa a 1
// columna en móvil vía CSS (.gps-compare-cards-grid, ver styles.css).
RPETracker.prototype._renderGpsCompareCards = function(sides) {
    const single = sides.length === 1;

    const cardsHTML = GPS_COMPARE_CARDS.map(cardDef => {
        const values = sides.map(side => this._getGpsCompareCardValue(cardDef, side.id));
        const fmt = v => v == null ? '—' : v.toFixed(cardDef.decimals).replace(/\.0+$/, cardDef.decimals > 0 ? '' : '');

        if (single) {
            const [intOnly, decOnly] = fmt(values[0]).split('.');
            return `
                <div class="gps-compare-card-cell" style="background:var(--bg-subtle);border-radius:10px;padding:14px 10px;">
                    <div style="text-align:center;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-secondary);margin-bottom:0.6rem;">
                        ${esc(cardDef.label)}
                    </div>
                    <div style="text-align:center;font-size:1.4rem;font-weight:800;color:var(--text-primary);">
                        ${intOnly}${decOnly ? `<span style="font-size:0.85rem;font-weight:600;">.${decOnly}</span>` : ''}
                        ${cardDef.unit ? `<div style="font-size:0.64rem;font-weight:600;color:var(--text-secondary);">${esc(cardDef.unit)}</div>` : ''}
                    </div>
                </div>`;
        }

        const [vLeft, vRight] = values;
        const [intLeft, decLeft] = fmt(vLeft).split('.');
        const [intRight, decRight] = fmt(vRight).split('.');

        let diffLabel = '—';
        if (vLeft != null && vRight != null && vLeft !== 0) {
            const diffPct = Math.round(((vRight - vLeft) / Math.abs(vLeft)) * 100);
            diffLabel = (diffPct > 0 ? '+' : '') + diffPct + '%';
        }

        return `
            <div class="gps-compare-card-cell" style="background:var(--bg-subtle);border-radius:10px;padding:14px 10px;">
                <div style="text-align:center;font-size:0.72rem;font-weight:700;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-secondary);margin-bottom:0.6rem;">
                    ${esc(cardDef.label)}
                </div>
                <div style="display:flex;align-items:center;justify-content:center;gap:14px;">
                    <div style="text-align:right;font-size:1.4rem;font-weight:800;color:var(--text-primary);min-width:58px;">
                        ${intLeft}${decLeft ? `<span style="font-size:0.85rem;font-weight:600;">.${decLeft}</span>` : ''}
                        ${cardDef.unit ? `<div style="font-size:0.64rem;font-weight:600;color:var(--text-secondary);">${esc(cardDef.unit)}</div>` : ''}
                    </div>
                    <div style="width:54px;height:54px;flex-shrink:0;border-radius:50%;border:4px solid ${sides[0].color};border-right-color:${sides[1].color};border-bottom-color:${sides[1].color};display:flex;align-items:center;justify-content:center;font-size:0.68rem;font-weight:700;color:var(--text-primary);">
                        ${diffLabel}
                    </div>
                    <div style="text-align:left;font-size:1.4rem;font-weight:800;color:var(--text-primary);min-width:58px;">
                        ${intRight}${decRight ? `<span style="font-size:0.85rem;font-weight:600;">.${decRight}</span>` : ''}
                        ${cardDef.unit ? `<div style="font-size:0.64rem;font-weight:600;color:var(--text-secondary);">${esc(cardDef.unit)}</div>` : ''}
                    </div>
                </div>
            </div>`;
    }).join('');

    return `
        <div class="gps-an-chart-card" style="background:var(--bg-surface);border-radius:12px;padding:16px;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));margin-bottom:16px;">
            <div style="display:flex;justify-content:flex-end;margin-bottom:4px;">
                <button class="btn-secondary" style="font-size:0.78rem;padding:4px 10px;" onclick="window.rpeTracker._printGpsCompareReport()">🖨️ Imprimir informe</button>
            </div>
            <div style="height:340px;">
                <canvas id="gpsRadarCanvas"></canvas>
            </div>
        </div>
        <div class="gps-an-chart-card" style="background:var(--bg-surface);border-radius:12px;padding:16px;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
            <div class="gps-compare-cards-grid">
                ${cardsHTML}
            </div>
        </div>`;
};

// Genera un informe imprimible (misma ventana + botón "Imprimir / Guardar
// PDF" que el resto de informes del proyecto, ver pdf-reports.js) de la
// comparativa GPS actual — 1 jugadora sola, o 2 (jugadora vs jugadora,
// o jugadora vs media del equipo). Reutiliza el radar ya dibujado en
// pantalla (capturado como imagen) y las mismas 24 métricas de las
// tarjetas, para no tener que redibujar nada dentro del documento nuevo.
RPETracker.prototype._printGpsCompareReport = function() {
    // La ventana se abre YA, de forma síncrona dentro del clic del
    // usuario — en iOS/Safari, abrirla tras cualquier operación async
    // hace que el navegador la bloquee en silencio (mismo criterio que
    // el resto de informes de pdf-reports.js).
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        this.showToast('⚠️ El navegador ha bloqueado la ventana del informe. Permite las ventanas emergentes e inténtalo de nuevo.', 'warning');
        return;
    }

    const selectedPlayers = this._gpsBarsPlayerIds.map(id => this.players.find(p => p.id === id)).filter(Boolean);
    const sides = selectedPlayers.map(p => ({ id: p.id, name: p.name, position: p.position || '', color: PlayerTokens.get(p) }));
    if (this._gpsBarsShowTeamAvg) sides.push({ id: null, name: 'Media del equipo', position: '', color: '#888' });

    if (sides.length === 0) {
        printWindow.close();
        this.showToast('⚠️ Elige al menos una jugadora antes de imprimir', 'warning');
        return;
    }

    const canvas = document.getElementById('gpsRadarCanvas');
    let radarImg = '';
    if (canvas && canvas._ci) {
        const composed = document.createElement('canvas');
        composed.width = canvas.width;
        composed.height = canvas.height;
        const ctx = composed.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, composed.width, composed.height);
        ctx.drawImage(canvas, 0, 0);
        radarImg = composed.toDataURL('image/png');
    }

    const contextLabel = this._gpsBarsModeCtx === 'session'
        ? (this._getTeamSessionOptions().find(s => s.id === this._gpsBarsSessionId)?.label || 'Sesión')
        : ({ '7': 'Últimos 7 días', '30': 'Últimos 30 días', '90': 'Últimos 90 días', 'all': 'Toda la temporada' }[this._gpsBarsRange] || 'Rango de fechas');

    const titleNames = sides.map(s => s.name).join(sides.length === 2 ? ' vs ' : '');

    const rowsHTML = GPS_COMPARE_CARDS.map(cardDef => {
        const values = sides.map(side => this._getGpsCompareCardValue(cardDef, side.id));
        const fmt = v => v == null ? '—' : v.toFixed(cardDef.decimals).replace(/\.0+$/, cardDef.decimals > 0 ? '' : '') + (cardDef.unit ? ' ' + cardDef.unit : '');
        if (sides.length === 1) {
            return `<tr><td>${esc(cardDef.label)}</td><td style="text-align:right;font-weight:700;">${fmt(values[0])}</td></tr>`;
        }
        return `<tr><td>${esc(cardDef.label)}</td><td style="text-align:right;font-weight:700;">${fmt(values[0])}</td><td style="text-align:right;font-weight:700;">${fmt(values[1])}</td></tr>`;
    }).join('');

    const tableHead = sides.length === 1
        ? `<tr><th>Dato</th><th style="text-align:right;">${esc(sides[0].name)}</th></tr>`
        : `<tr><th>Dato</th><th style="text-align:right;color:${sides[0].color};">${esc(sides[0].name)}</th><th style="text-align:right;color:${sides[1].color};">${esc(sides[1].name)}</th></tr>`;

    const html = `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Informe GPS - ${esc(titleNames)}</title>
    <style>
        @media print {
            @page { margin: 2cm; }
            .no-print { display: none !important; }
        }
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 800px; margin: 0 auto; padding: 20px; }
        .report-toolbar { position: sticky; top: 0; background: #fff; display: flex; gap: 10px; justify-content: center; padding: 12px 0; margin: -20px -20px 20px; border-bottom: 1px solid #eee; z-index: 10; }
        .print-btn, .close-btn { display: inline-flex; align-items: center; gap: 6px; padding: 10px 20px; border: none; border-radius: 8px; font-size: 14px; font-weight: 600; cursor: pointer; }
        .print-btn { background: #ff6600; color: #fff; }
        .close-btn { background: #eee; color: #333; }
        .header { text-align: center; border-bottom: 3px solid #ff6600; padding-bottom: 20px; margin-bottom: 30px; }
        .header h1 { color: #ff6600; margin: 0; font-size: 1.5em; }
        .header .subtitle { color: #666; font-size: 1.1em; margin-top: 10px; }
        .header .date-range { color: #999; font-size: 0.9em; margin-top: 5px; }
        .radar-img { display: block; max-width: 100%; margin: 20px auto; }
        .compare-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        .compare-table th, .compare-table td { padding: 8px 10px; text-align: left; border-bottom: 1px solid #eee; font-size: 0.9em; }
        .compare-table th { background: #f5f5f5; font-weight: bold; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 2px solid #eee; text-align: center; color: #999; font-size: 0.85em; }
    </style>
</head>
<body>
    <div class="report-toolbar no-print">
        <button class="print-btn" onclick="window.print()">🖨️ Imprimir / Guardar PDF</button>
        <button class="close-btn" onclick="window.close()">✕ Cerrar informe</button>
    </div>
    <div class="header">
        <h1>📡 Informe GPS ${esc(sides.length === 1 ? 'individual' : 'comparativo')}</h1>
        <div class="subtitle">${esc(titleNames)}</div>
        <div class="date-range">${esc(contextLabel)}</div>
    </div>
    ${radarImg ? `<img class="radar-img" src="${radarImg}" alt="Radar GPS">` : ''}
    <table class="compare-table">
        <thead>${tableHead}</thead>
        <tbody>${rowsHTML}</tbody>
    </table>
    <div class="footer">Generado el ${new Date().toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })} — Load Ctrl</div>
</body>
</html>`;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();

    setTimeout(() => printWindow.print(), 500);
};

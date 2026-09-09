// ============================================================
//  gps-analytics.js — Fase 2: Pantalla dedicada de analítica GPS
//
//  Qué hace este módulo:
//   1. Nueva vista "📡 GPS" dentro del grupo "Carga" del menú.
//   2. Selector de jugadora + rango de sesiones.
//   3. Gráfico de evolución con dos series paralelas:
//        - Carga interna (RPE × duración), la que ya usáis hoy.
//        - Carga externa GPS (distancia total de cada sesión).
//      Se muestran juntas para que el entrenador vea si divergen,
//      NO se fusionan en un único número ni tocan el EWMA/ratio A:C.
//   4. Tabla histórica de sesiones con detalle GPS ampliado.
//
//  Qué NO hace (a propósito):
//   - No modifica ewma-calculator.js ni injury-prediction.js.
//   - No cambia cómo se calcula `session.load`.
//   - No escribe en `sessions`, solo lee de `this.sessions` y
//     `this.gpsData` (ya guardados por gps-tracking.js, Fase 1).
// ============================================================

RPETracker.prototype.renderGpsAnalyticsView = function() {
    const container = document.getElementById('gpsAnalyticsView');
    if (!container) return;

    if (!this._gpsAnalyticsPlayerId && this.players.length > 0) {
        this._gpsAnalyticsPlayerId = this.players[0].id;
    }

    const activePlayers = this.players.filter(p => !p.archived);

    container.innerHTML = `
        <div class="an-header" style="margin-bottom:16px;">
            <h2 style="margin:0 0 4px 0;">📡 Analítica GPS (Oli Sports)</h2>
            <p style="margin:0;color:var(--text-secondary,#666);font-size:0.9rem;">
                Compara la carga interna (RPE × duración) con la carga externa objetiva del GPS, sesión a sesión.
            </p>
        </div>

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

        <div class="gps-an-chart-card" style="background:var(--card-bg,#fff);border-radius:12px;padding:16px;margin-bottom:20px;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
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
        <div class="gps-an-table-card" style="background:var(--card-bg,#fff);border-radius:12px;padding:16px;overflow-x:auto;box-shadow:var(--shadow-sm,0 1px 3px rgba(0,0,0,0.08));">
            <table class="data-table" style="width:100%;border-collapse:collapse;">
                <thead>
                    <tr style="text-align:left;font-size:0.8rem;color:var(--text-secondary,#666);">
                        <th>Fecha</th><th>Tipo</th><th>RPE app</th><th>RPE Oli</th><th>Distancia</th><th>Vel. máx</th><th>Sprints</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
};

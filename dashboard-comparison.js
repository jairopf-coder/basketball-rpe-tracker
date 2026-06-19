// BasketballRPE-Web — dashboard-comparison.js
// Comparativa entre jugadoras: tabla A:C ratio + Wellness (Propuesta 3) y
// radar chart de wellness medio (Propuesta 1).
// Expone: RPETracker.prototype._renderPlayerComparisonSection
//          RPETracker.prototype._renderComparisonRadar
//          RPETracker.prototype._bindComparisonEvents
// Depende de: ewma-calculator.js (calculateAcuteChronicRatio, getPlayerThresholds)
//             wellness.js (_wOverall, _wColor, this.wellnessData)
//             ui-helpers.js / security.js (esc, PlayerTokens)
//             Chart.js 4.4.1 (cargado en index.html)

'use strict';

const MAX_RADAR_PLAYERS = 5;
const WELLNESS_DIMENSIONS = ['sleep', 'fatigue', 'mood', 'soreness'];
const WELLNESS_LABELS = { sleep: 'Sueño', fatigue: 'Energía', mood: 'Humor', soreness: 'Muscular' };

// ── Helpers internos ─────────────────────────────────────────────────────

/**
 * Devuelve la media de los últimos `days` días de wellness para una jugadora.
 * Para 'fatigue' y 'soreness' invierte la escala (6 - valor) para que
 * "más alto = mejor estado" en todas las dimensiones del radar, igual que
 * el cálculo de overall usado en el resto del dashboard.
 * @returns {{values: Object, count: number}}
 */
function _avgWellness(wellnessData, playerId, days) {
    const since = new Date();
    since.setDate(since.getDate() - days);
    const sinceStr = (typeof toLocalISODate === 'function') ? toLocalISODate(since) : since.toISOString().slice(0, 10);

    const entries = (wellnessData || []).filter(e => e.playerId === playerId && e.date >= sinceStr);

    const sums = { sleep: 0, fatigue: 0, mood: 0, soreness: 0 };
    let count = 0;
    entries.forEach(e => {
        if (e.sleep == null || e.fatigue == null || e.mood == null || e.soreness == null) return;
        sums.sleep    += e.sleep;
        sums.fatigue  += e.fatigue;
        sums.mood     += e.mood;
        sums.soreness += e.soreness;
        count++;
    });

    if (count === 0) return { values: null, count: 0 };

    return {
        values: {
            sleep:    sums.sleep    / count,
            fatigue:  6 - (sums.fatigue  / count), // invertido: más = mejor
            mood:     sums.mood     / count,
            soreness: 6 - (sums.soreness / count), // invertido: más = mejor
        },
        count
    };
}

// ── Sección principal (tabla + controles del radar) ───────────────────────
RPETracker.prototype._renderPlayerComparisonSection = function() {
    if (this.players.length === 0) return '';

    const wData = this.wellnessData || [];

    // Construir filas: ratio + wellness medio 7d
    const rows = this.players.map(player => {
        const ratio = this.calculateAcuteChronicRatio(player.id);
        const w = _avgWellness(wData, player.id, 7);
        return { player, ratio, wellness: w };
    });

    // Orden por riesgo (ratio descendente), igual que dashboard principal
    rows.sort((a, b) => {
        const ra = a.ratio.confidence === 'low' ? -1 : parseFloat(a.ratio.ratio) || 0;
        const rb = b.ratio.confidence === 'low' ? -1 : parseFloat(b.ratio.ratio) || 0;
        return rb - ra;
    });

    const ratioCell = (ratio, playerId) => {
        if (ratio.confidence === 'low') {
            return `<span class="badge-insuf" title="${esc(ratio.message || 'Datos insuficientes')}">⚠️ Insuf.</span>`;
        }
        if (ratio.ratio === 'N/A') return '—';
        const color = this.getRatioColor(ratio.ratio);
        return `<span style="color:${color};font-weight:600">${ratio.ratio}</span>`;
    };

    const wellnessCell = (w, dim) => {
        if (!w.values) return '<span class="cmp-nodata">—</span>';
        // Para mostrar al usuario, deshacemos la inversión de fatigue/soreness
        let raw = w.values[dim];
        if (dim === 'fatigue' || dim === 'soreness') raw = 6 - raw;
        return raw.toFixed(1);
    };

    const tableRows = rows.map(({ player, ratio, wellness }) => `
        <tr class="cmp-row">
            <td class="cmp-td-player">
                ${PlayerTokens.avatar(player, 22, '0.6rem')}
                <span class="cmp-player-name">${esc(player.name)}</span>
            </td>
            <td class="cmp-td-ratio">${ratioCell(ratio, player.id)}</td>
            <td class="cmp-td-w">${wellnessCell(wellness, 'sleep')}</td>
            <td class="cmp-td-w">${wellnessCell(wellness, 'fatigue')}</td>
            <td class="cmp-td-w">${wellnessCell(wellness, 'mood')}</td>
            <td class="cmp-td-w">${wellnessCell(wellness, 'soreness')}</td>
            ${wellness.count === 0 ? '<td class="cmp-td-flag"><span class="cmp-flag" title="Sin registros de wellness en 7 días">⚠️</span></td>' : '<td class="cmp-td-flag"></td>'}
        </tr>`).join('');

    // Checkboxes para el radar (limitar a MAX_RADAR_PLAYERS seleccionadas inicialmente)
    if (!this._radarSelectedIds) {
        this._radarSelectedIds = this.players.slice(0, MAX_RADAR_PLAYERS).map(p => p.id);
    }
    const selected = new Set(this._radarSelectedIds);

    const checkboxes = this.players.map(p => `
        <label class="cmp-check">
            <input type="checkbox" class="cmp-radar-checkbox" data-player-id="${esc(p.id)}" ${selected.has(p.id) ? 'checked' : ''}>
            <span class="cmp-check-dot" style="background:${PlayerTokens.get(p)}"></span>
            <span class="cmp-check-name">${esc(p.name.split(' ')[0])}</span>
        </label>`).join('');

    return `
    <div class="db-comparison">
        <div class="db-comparison-header">
            <span class="db-left-label">📊 Comparativa de jugadoras</span>
            <span class="cmp-subtitle">A:C ratio + Wellness medio (7 días)</span>
        </div>

        <div class="cmp-table-wrap">
            <table class="cmp-table">
                <thead>
                    <tr>
                        <th class="cmp-th-player">Jugadora</th>
                        <th>A:C</th>
                        <th title="Sueño">😴</th>
                        <th title="Energía (5=descansada)">⚡</th>
                        <th title="Humor">😊</th>
                        <th title="Dolor muscular (5=sin dolor)">💪</th>
                        <th></th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
            <div class="cmp-table-hint">Ordenado por mayor riesgo (A:C). 😴⚡😊💪 en escala 1–5 (mayor = mejor).</div>
        </div>
    </div>

    <div class="db-comparison-radar">
        <div class="cmp-radar-header">
            <span class="db-left-label">🕸️ Radar de wellness (7 días)</span>
            <span class="cmp-subtitle">Selecciona hasta ${MAX_RADAR_PLAYERS} jugadoras</span>
        </div>
        <div class="cmp-checks">${checkboxes}</div>
        <div class="cmp-radar-canvas-wrap">
            <canvas id="comparisonRadarCanvas" height="280"></canvas>
        </div>
        <div id="comparisonRadarEmpty" class="cmp-radar-empty" style="display:none">
            Selecciona al menos una jugadora con datos de wellness.
        </div>
    </div>`;
};

// ── Radar chart ─────────────────────────────────────────────────────────
RPETracker.prototype._renderComparisonRadar = function() {
    const canvas = document.getElementById('comparisonRadarCanvas');
    if (!canvas) return; // sección no presente (sin jugadoras)

    if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
        canvas._chartInstance = null;
    }

    const wData = this.wellnessData || [];
    const selectedIds = this._radarSelectedIds || [];

    const datasets = [];
    const insufficientNames = [];

    selectedIds.forEach(playerId => {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return;

        const w = _avgWellness(wData, playerId, 7);
        if (!w.values) {
            insufficientNames.push(player.name.split(' ')[0]);
            return;
        }

        const color = PlayerTokens.get(player);
        datasets.push({
            label: player.name.split(' ')[0],
            data: WELLNESS_DIMENSIONS.map(dim => w.values[dim]),
            borderColor: color,
            backgroundColor: color + '33',
            pointBackgroundColor: color,
            borderWidth: 2,
        });
    });

    const emptyEl = document.getElementById('comparisonRadarEmpty');

    if (datasets.length === 0) {
        canvas.style.display = 'none';
        if (emptyEl) {
            emptyEl.style.display = '';
            emptyEl.textContent = insufficientNames.length > 0
                ? `⚠️ Sin datos suficientes de wellness para: ${insufficientNames.join(', ')}`
                : 'Selecciona al menos una jugadora con datos de wellness.';
        }
        return;
    }

    canvas.style.display = '';
    if (emptyEl) {
        emptyEl.style.display = insufficientNames.length > 0 ? '' : 'none';
        emptyEl.textContent = `⚠️ Sin datos suficientes de wellness para: ${insufficientNames.join(', ')}`;
    }

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor  = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.08)';
    const labelColor = isDark ? '#ccc' : '#555';

    canvas._chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'radar',
        data: {
            labels: WELLNESS_DIMENSIONS.map(d => WELLNESS_LABELS[d]),
            datasets,
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            scales: {
                r: {
                    min: 0,
                    max: 5,
                    ticks: { stepSize: 1, color: labelColor, backdropColor: 'transparent' },
                    grid: { color: gridColor },
                    angleLines: { color: gridColor },
                    pointLabels: { color: labelColor, font: { size: 11 } },
                }
            },
            plugins: {
                legend: { position: 'bottom', labels: { color: labelColor, boxWidth: 12, font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => `${ctx.dataset.label}: ${ctx.formattedValue} / 5`
                    }
                }
            }
        }
    });
};

// ── Eventos: checkboxes de selección de jugadoras para el radar ──────────
RPETracker.prototype._bindComparisonEvents = function() {
    const checkboxes = document.querySelectorAll('.cmp-radar-checkbox');
    checkboxes.forEach(cb => {
        cb.addEventListener('change', () => {
            const id = cb.getAttribute('data-player-id');
            this._radarSelectedIds = this._radarSelectedIds || [];

            if (cb.checked) {
                if (this._radarSelectedIds.length >= MAX_RADAR_PLAYERS) {
                    cb.checked = false;
                    if (typeof this.showToast === 'function') {
                        this.showToast(`Máximo ${MAX_RADAR_PLAYERS} jugadoras en el radar`, 'warning');
                    }
                    return;
                }
                this._radarSelectedIds.push(id);
            } else {
                this._radarSelectedIds = this._radarSelectedIds.filter(pid => pid !== id);
            }

            this._renderComparisonRadar();
        });
    });
};

// ── Estilos del módulo (inyectados una vez) ────────────────────────────────
(function() {
    if (document.getElementById('dashboard-comparison-style')) return;
    const s = document.createElement('style');
    s.id = 'dashboard-comparison-style';
    s.textContent = `
        .db-comparison {
            margin-top: 1rem;
            padding-top: 1rem;
            border-top: 1px solid var(--border);
        }
        .db-comparison-header, .cmp-radar-header {
            display: flex;
            align-items: baseline;
            justify-content: space-between;
            gap: 8px;
            flex-wrap: wrap;
            margin-bottom: 8px;
        }
        .cmp-subtitle {
            font-size: 11px;
            color: var(--text-muted);
        }
        .cmp-table-wrap {
            overflow-x: auto;
        }
        .cmp-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 13px;
        }
        .cmp-table th {
            text-align: center;
            padding: 4px 6px;
            color: var(--text-muted);
            font-weight: 500;
            font-size: 12px;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
        }
        .cmp-th-player {
            text-align: left !important;
        }
        .cmp-table td {
            padding: 5px 6px;
            text-align: center;
            border-bottom: 1px solid var(--border);
            white-space: nowrap;
        }
        .cmp-td-player {
            display: flex;
            align-items: center;
            gap: 6px;
            text-align: left;
        }
        .cmp-player-name {
            font-weight: 500;
            color: var(--text-primary);
        }
        .cmp-nodata {
            color: var(--text-faint);
        }
        .cmp-flag {
            cursor: default;
        }
        .cmp-table-hint {
            margin-top: 6px;
            font-size: 11px;
            color: var(--text-faint);
        }
        .db-comparison-radar {
            margin-top: 1.25rem;
        }
        .cmp-checks {
            display: flex;
            flex-wrap: wrap;
            gap: 6px 12px;
            margin-bottom: 10px;
        }
        .cmp-check {
            display: inline-flex;
            align-items: center;
            gap: 5px;
            font-size: 12px;
            color: var(--text-secondary);
            cursor: pointer;
            user-select: none;
        }
        .cmp-check input {
            cursor: pointer;
        }
        .cmp-check-dot {
            width: 9px;
            height: 9px;
            border-radius: 50%;
            display: inline-block;
        }
        .cmp-radar-canvas-wrap {
            position: relative;
            height: 280px;
            max-width: 480px;
            margin: 0 auto;
        }
        .cmp-radar-empty {
            text-align: center;
            color: var(--text-muted);
            font-size: 12px;
            padding: 1rem;
        }
    `;
    document.head.appendChild(s);
}());

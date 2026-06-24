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
                <div class="cmp-td-player-inner">
                    ${PlayerTokens.avatar(player, 22, '0.6rem')}
                    <span class="cmp-player-name">${esc(player.name)}</span>
                </div>
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

    ${_renderWellnessHeatmap(rows)}`;
};

// ── Heatmap de wellness ───────────────────────────────────────────────────
/**
 * Renderiza una tabla de calor jugadora × dimensión wellness.
 * Sin límite de jugadoras. Celdas coloreadas por valor (1-5).
 * @param {Array} rows — mismo array usado en la comparativa (player, ratio, wellness)
 */
function _renderWellnessHeatmap(rows) {
    const dims = ['sleep', 'fatigue', 'mood', 'soreness'];
    const labels = { sleep: '😴 Sueño', fatigue: '⚡ Energía', mood: '😊 Humor', soreness: '💪 Muscular' };
    // Inverted dims: higher display value = better (already inverted in _avgWellness)
    const invertedDims = new Set(['fatigue', 'soreness']);

    // Color for a 1–5 value (higher = greener)
    const heatColor = (val) => {
        if (val === null) return 'var(--bg-subtle)';
        // val already on "higher = better" scale (fatigue/soreness inverted in _avgWellness)
        if (val >= 4.0) return '#2e7d3220';  // green tint
        if (val >= 3.0) return '#f9a82520';  // amber tint
        return '#c6282820';                   // red tint
    };
    const heatText = (val) => {
        if (val >= 4.0) return '#2e7d32';
        if (val >= 3.0) return '#e65100';
        return '#c62828';
    };

    const rowsHtml = rows.map(({ player, wellness }) => {
        const cells = dims.map(dim => {
            if (!wellness.values) {
                return `<td class="wh-cell wh-nodata" title="Sin datos">—</td>`;
            }
            const val = wellness.values[dim]; // already "higher = better"
            const displayVal = invertedDims.has(dim) ? (6 - val).toFixed(1) : val.toFixed(1);
            return `<td class="wh-cell" style="background:${heatColor(val)};color:${heatText(val)}" title="${labels[dim]}: ${displayVal}/5">${displayVal}</td>`;
        }).join('');

        // Overall score: mean of all dims (all already "higher = better")
        let overall = null;
        if (wellness.values) {
            const sum = dims.reduce((s, d) => s + wellness.values[d], 0);
            overall = sum / dims.length;
        }
        const overallHtml = overall !== null
            ? `<td class="wh-cell wh-overall" style="background:${heatColor(overall)};color:${heatText(overall)}">${overall.toFixed(1)}</td>`
            : `<td class="wh-cell wh-nodata">—</td>`;

        return `<tr>
            <td class="wh-name">
                ${PlayerTokens.avatar(player, 20, '0.58rem')}
                <span>${esc(player.name.split(' ')[0])}</span>
            </td>
            ${cells}
            ${overallHtml}
        </tr>`;
    }).join('');

    if (rows.length === 0) return '';

    return `
    <div class="db-comparison-radar">
        <div class="cmp-radar-header">
            <span class="db-left-label">🌡️ Heatmap de wellness (7 días)</span>
            <span class="cmp-subtitle">Media por dimensión — mayor = mejor</span>
        </div>
        <div class="wh-wrap">
            <table class="wh-table">
                <thead>
                    <tr>
                        <th class="wh-th-name">Jugadora</th>
                        <th title="Sueño">😴</th>
                        <th title="Energía">⚡</th>
                        <th title="Humor">😊</th>
                        <th title="Muscular">💪</th>
                        <th class="wh-th-overall" title="Media global">Ø</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
        <div class="wh-legend">
            <span class="wh-leg-item wh-leg-good">≥4 bueno</span>
            <span class="wh-leg-item wh-leg-warn">3–4 normal</span>
            <span class="wh-leg-item wh-leg-bad">≤3 atención</span>
        </div>
    </div>`;
}

// ── _renderComparisonRadar — mantenida vacía para no romper llamadas externas ──
RPETracker.prototype._renderComparisonRadar = function() {
    // Sustituido por heatmap. No-op para compatibilidad.
};

// ── Eventos: ya no hay checkboxes de radar — mantenida para compatibilidad ──
RPETracker.prototype._bindComparisonEvents = function() {
    // Los checkboxes del radar fueron sustituidos por el heatmap. No-op.
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

        /* ── Heatmap de wellness ── */
        .wh-wrap {
            overflow-x: hidden;
            border-radius: 8px;
            border: 1px solid var(--border);
        }
        .wh-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
        }
        .wh-table thead tr {
            background: var(--bg-subtle);
            border-bottom: 1px solid var(--border);
        }
        .wh-table th {
            padding: 4px 5px;
            text-align: center;
            font-weight: 600;
            font-size: 11px;
            color: var(--text-muted);
            white-space: nowrap;
        }
        .wh-th-name { text-align: left !important; padding-left: 8px; }
        .wh-th-overall { font-style: italic; }
        .wh-table tr { border-bottom: 1px solid var(--border); }
        .wh-table tr:last-child { border-bottom: none; }
        .wh-name {
            display: flex;
            align-items: center;
            gap: 5px;
            padding: 4px 5px 4px 8px;
            font-weight: 500;
            color: var(--text-primary);
            white-space: nowrap;
        }
        .wh-cell {
            padding: 5px 4px;
            text-align: center;
            font-variant-numeric: tabular-nums;
            font-size: 12px;
            font-weight: 600;
            border-left: 1px solid var(--border);
        }
        .wh-overall { border-left: 2px solid var(--border); }
        .wh-nodata { color: var(--text-faint); font-weight: 400; background: var(--bg-subtle) !important; }
        .wh-legend {
            display: flex;
            gap: 10px;
            padding: 5px 8px;
            font-size: 10px;
            border-top: 1px solid var(--border);
            background: var(--bg-subtle);
            border-radius: 0 0 8px 8px;
        }
        .wh-leg-item { display: flex; align-items: center; gap: 4px; color: var(--text-muted); }
        .wh-leg-good::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: #2e7d3220; border: 1px solid #2e7d32; }
        .wh-leg-warn::before { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: #f9a82520; border: 1px solid #e65100; }
        .wh-leg-bad::before  { content: ''; display: inline-block; width: 8px; height: 8px; border-radius: 2px; background: #c6282820; border: 1px solid #c62828; }
    `;
    document.head.appendChild(s);
}());

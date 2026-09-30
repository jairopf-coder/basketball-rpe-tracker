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
 * Las cuatro dimensiones se guardan con la MISMA escala en todos los formularios:
 * 1 = peor, 5 = mejor (Energía: 1 agotada … 5 descansada; Muscular: 1 mucho dolor
 * … 5 sin dolor). Por eso NO se invierte nada: más alto = mejor en todas.
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
            fatigue:  sums.fatigue  / count,
            mood:     sums.mood     / count,
            soreness: sums.soreness / count,
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

    // Orden por riesgo (ratio descendente)
    rows.sort((a, b) => {
        const ra = a.ratio.confidence === 'low' ? -1 : parseFloat(a.ratio.ratio) || 0;
        const rb = b.ratio.confidence === 'low' ? -1 : parseFloat(b.ratio.ratio) || 0;
        return rb - ra;
    });

    return _renderWellnessHeatmap(rows, this);
};

// ── Tabla unificada: jugadora × A:C + dimensiones wellness ───────────────
// Diseño: UN solo fondo para toda la tabla (el de la tarjeta). El color va
// únicamente en el número, mediante clases (wh-good / wh-warn / wh-bad / wh-blue),
// para que tenga variante clara y oscura y se lea bien con ambos temas.
function _renderWellnessHeatmap(rows, tracker) {
    const dims = ['sleep', 'fatigue', 'mood', 'soreness'];
    const labels = { sleep: '😴 Sueño', fatigue: '⚡ Energía', mood: '😊 Humor', soreness: '💪 Muscular' };

    // Wellness (1 = peor, 5 = mejor): ≥4 verde · 3–3,9 naranja · <3 rojo.
    // Se clasifica el valor YA REDONDEADO a un decimal, que es el que se ve: así un
    // 3,96 (que se muestra como "4.0") sale verde y dos "4.0" nunca tienen colores distintos.
    const heatClass = (val) => {
        if (val === null || val === undefined) return 'wh-nodata';
        const shown = Math.round(val * 10) / 10;
        if (shown >= 4.0) return 'wh-good';
        if (shown >= 3.0) return 'wh-warn';
        return 'wh-bad';
    };

    // A:C: se reutiliza getRatioColor del tracker (no se duplican los umbrales) y
    // su color se traduce a clase para poder tener variante oscura.
    const AC_CLASS = { '#1565c0': 'wh-blue', '#2e7d32': 'wh-good', '#ef6c00': 'wh-warn', '#c62828': 'wh-bad' };
    const acDisplay = (ratio) => {
        if (ratio.confidence === 'low') return `<span title="${esc(ratio.message || 'Datos insuf.')}">⚠️</span>`;
        if (ratio.ratio === 'N/A') return '—';
        const color = tracker ? tracker.getRatioColor(ratio.ratio) : null;
        const cls = AC_CLASS[color];
        return cls
            ? `<span class="${cls}">${ratio.ratio}</span>`
            : `<span${color ? ` style="color:${color}"` : ''}>${ratio.ratio}</span>`;
    };

    const rowsHtml = rows.map(({ player, ratio, wellness }) => {
        const cells = dims.map(dim => {
            if (!wellness.values) {
                return `<td class="wh-cell wh-nodata" title="Sin datos">—</td>`;
            }
            const val = wellness.values[dim];
            const displayVal = val.toFixed(1);
            return `<td class="wh-cell ${heatClass(val)}" title="${labels[dim]}: ${displayVal}/5">${displayVal}</td>`;
        }).join('');

        let overall = null;
        if (wellness.values) {
            const sum = dims.reduce((s, d) => s + wellness.values[d], 0);
            overall = sum / dims.length;
        }
        const overallHtml = overall !== null
            ? `<td class="wh-cell wh-overall ${heatClass(overall)}" title="Media global: ${overall.toFixed(1)}/5">${overall.toFixed(1)}</td>`
            : `<td class="wh-cell wh-overall wh-nodata">—</td>`;

        return `<tr>
            <td class="wh-name">
                <div class="wh-name-in">
                    ${PlayerTokens.avatar(player, 20, '0.58rem')}
                    <span>${esc(player.name.split(' ')[0])}</span>
                </div>
            </td>
            <td class="wh-cell wh-ac">${acDisplay(ratio)}</td>
            ${cells}
            ${overallHtml}
        </tr>`;
    }).join('');

    if (rows.length === 0) return '';

    return `
    <div class="db-comparison-radar">
        <div class="cmp-radar-header">
            <span class="db-left-label">🌡️ Carga y wellness — 7 días</span>
            <span class="cmp-subtitle">A:C = carga · bienestar de 1 (peor) a 5 (mejor)</span>
        </div>
        <div class="wh-wrap">
            <table class="wh-table">
                <thead>
                    <tr>
                        <th class="wh-th-name">Jugadora</th>
                        <th title="Ratio Agudo:Crónico">A:C</th>
                        <th title="Sueño">😴</th>
                        <th title="Energía">⚡</th>
                        <th title="Humor">😊</th>
                        <th title="Muscular">💪</th>
                        <th class="wh-th-overall" title="Media wellness global">Ø</th>
                    </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
            </table>
        </div>
        <div class="wh-legend">
            <span class="wh-leg-item"><b class="wh-good">●</b> ≥4 bueno</span>
            <span class="wh-leg-item"><b class="wh-warn">●</b> 3–3,9 normal</span>
            <span class="wh-leg-item"><b class="wh-bad">●</b> &lt;3 atención</span>
            <span style="margin-left:auto;font-size:10px;color:var(--text-faint)">Ordenado por mayor A:C</span>
        </div>
    </div>`;
};

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

        /* ── Tabla de wellness: un solo fondo (el de la tarjeta); color SOLO en los números ── */
        .wh-wrap {
            overflow-x: hidden;
            border-radius: 12px;
            border: 1px solid var(--border);
            background: transparent;
        }
        .wh-table {
            width: 100%;
            border-collapse: collapse;
            font-size: 12px;
            background: transparent;
        }
        .wh-table thead tr { background: transparent; border-bottom: 1px solid var(--border); }
        .wh-table th, .wh-table td { background: transparent; }
        .wh-table th {
            padding: 6px 5px;
            text-align: center;
            font-weight: 600;
            font-size: 12px;
            color: var(--text-muted);
            white-space: nowrap;
        }
        .wh-th-name { text-align: left !important; padding-left: 10px !important; }
        .wh-table tbody tr { border-bottom: 1px solid var(--border); }
        .wh-table tbody tr:last-child { border-bottom: none; }
        .wh-name {
            padding: 6px 5px 6px 10px;
            font-weight: 500;
            color: var(--text-primary);
            white-space: nowrap;
        }
        .wh-name-in { display: flex; align-items: center; gap: 6px; min-width: 0; }
        .wh-name-in span { overflow: hidden; text-overflow: ellipsis; max-width: 110px; }
        .wh-cell {
            padding: 6px 4px;
            text-align: center;
            font-variant-numeric: tabular-nums;
            font-size: 13px;
            font-weight: 700;
            color: var(--text-primary);
        }
        .wh-ac, .wh-overall { border-left: 1px solid var(--border); }
        .wh-overall { font-size: 14px; font-weight: 800; }
        .wh-nodata { color: var(--text-faint); font-weight: 400; }

        /* Colores: solo texto. Tono oscuro para fondo claro y tono claro para fondo oscuro */
        .wh-good { color: #2e7d32; }
        .wh-warn { color: #e65100; }
        .wh-bad  { color: #c62828; }
        .wh-blue { color: #1565c0; }
        [data-theme="dark"] .wh-good { color: #66bb6a; }
        [data-theme="dark"] .wh-warn { color: #ffa726; }
        [data-theme="dark"] .wh-bad  { color: #ef5350; }
        [data-theme="dark"] .wh-blue { color: #64b5f6; }

        .wh-legend {
            display: flex;
            flex-wrap: wrap;
            gap: 4px 14px;
            padding: 8px 4px 0;
            font-size: 11px;
            background: transparent;
        }
        .wh-leg-item { display: flex; align-items: center; gap: 4px; color: var(--text-muted); }
    `;
    document.head.appendChild(s);
}());

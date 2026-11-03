// BasketballRPE-Web — dashboard-comparison.js
// Tabla única de Inicio «Ratio A:C — jugadoras». Sustituye a las dos tarjetas
// anteriores («Ratio A:C — jugadoras» y «Carga y wellness — 7 días»).
// Por jugadora: avatar, nombre, barra, A:C, Ø (bienestar, media de 7 días) y
// R (readiness de hoy). El color va SOLO en el texto (clases wh-good / wh-warn /
// wh-bad / wh-blue, con variante oscura) y las cabeceras A:C, Ø y R ordenan la
// lista al pulsarlas.
// Expone: RPETracker.prototype._renderPlayersTable(entries)
//          RPETracker.prototype.sortDashBy(key)
//          RPETracker.prototype._dashSortState / _sortDashEntries / _wellness7d / _dashReadiness
//          (_renderPlayerComparisonSection, _renderComparisonRadar y _bindComparisonEvents
//           se mantienen vacías para no romper llamadas antiguas)
// Depende de: wellness.js (_wRangeStart), ewma-calculator.js (readinessLabel),
//             app-presession.js (calculateReadiness), security.js / app.js (esc, PlayerTokens)

'use strict';

const DASH_SORT_KEYS    = ['ac', 'w', 'r'];
const DASH_SORT_DEFAULT = { key: 'ac', dir: 'desc' };
// readinessLabel (ewma-calculator.js) es la única que conoce los umbrales del readiness;
// aquí solo se traduce su clase a la clase de color del texto.
const DASH_RDY_CLASS    = { 'rdy-green': 'wh-good', 'rdy-yellow': 'wh-warn', 'rdy-red': 'wh-bad' };

// ── Bienestar: media de las entradas completas desde `sinceStr` ──────────
// Las cuatro dimensiones se guardan con la MISMA escala en todos los formularios:
// 1 = peor, 5 = mejor (Energía: 1 agotada … 5 descansada; Muscular: 1 mucho dolor
// … 5 sin dolor). Por eso NO se invierte nada: más alto = mejor en todas.
// @returns {{avg: number|null, count: number}}
function _wellnessAverage(wellnessData, playerId, sinceStr) {
    let sum = 0, count = 0;
    (wellnessData || []).forEach(e => {
        if (e.playerId !== playerId || e.date < sinceStr) return;
        if (e.sleep == null || e.fatigue == null || e.mood == null || e.soreness == null) return;
        sum += (e.sleep + e.fatigue + e.mood + e.soreness) / 4;
        count++;
    });
    return count ? { avg: sum / count, count } : { avg: null, count: 0 };
}

// Wellness (1 = peor, 5 = mejor): ≥4 verde · 3–3,9 naranja · <3 rojo.
// Se clasifica el valor YA REDONDEADO a un decimal, que es el que se ve: así un
// 3,96 (que se muestra como "4.0") sale verde y dos "4.0" nunca tienen colores distintos.
function _dashWellnessClass(avg) {
    if (avg === null || avg === undefined) return 'wh-nodata';
    const shown = Math.round(avg * 10) / 10;
    if (shown >= 4) return 'wh-good';
    if (shown >= 3) return 'wh-warn';
    return 'wh-bad';
}

// Media de bienestar de los últimos 7 días (hoy y los 6 anteriores, igual que el
// chip "7 días" de Salud → Wellness, que usa _wRangeStart).
RPETracker.prototype._wellness7d = function(playerId) {
    let since;
    if (typeof this._wRangeStart === 'function') {
        since = this._wRangeStart(7);
    } else {
        const d = new Date();
        d.setDate(d.getDate() - 6);
        since = toLocalISODate(d);
    }
    return _wellnessAverage(this.wellnessData, playerId, since);
};

// Readiness de hoy: { score: número|null, cls: clase de color }
RPETracker.prototype._dashReadiness = function(playerId) {
    const s = this.calculateReadiness(playerId);
    const score = (typeof s === 'number' && isFinite(s)) ? s : null;
    const lbl = score === null ? null : this.readinessLabel(score);
    return { score, cls: (lbl && DASH_RDY_CLASS[lbl.cls]) || 'wh-nodata' };
};

// ── Orden: se guarda como { key: 'ac'|'w'|'r', dir: 'desc'|'asc' } ──────
// Acepta también el valor antiguo (texto 'risk' / 'safe' / 'name') y lo trata como el orden por defecto.
RPETracker.prototype._dashSortState = function() {
    const s = this._dashSort;
    if (s && typeof s === 'object' && DASH_SORT_KEYS.includes(s.key) && (s.dir === 'desc' || s.dir === 'asc')) return s;
    return { key: DASH_SORT_DEFAULT.key, dir: DASH_SORT_DEFAULT.dir };
};

// Primer toque en una cabecera: de mayor a menor. Segundo toque: de menor a mayor.
RPETracker.prototype.sortDashBy = function(key) {
    if (!DASH_SORT_KEYS.includes(key)) return;
    const cur = this._dashSortState();
    this._dashSort = (cur.key === key)
        ? { key, dir: cur.dir === 'desc' ? 'asc' : 'desc' }
        : { key, dir: 'desc' };
    this.renderDashboard();
};

function _dashSortValue(row, key) {
    if (key === 'ac') {
        if (row.out || !row.ratio || row.ratio.confidence === 'low') return null;
        const n = parseFloat(row.ratio.ratio);
        return isNaN(n) ? null : n;
    }
    if (key === 'w') return row.w.avg;
    return row.rdy.score;
}

// Reglas: las que no entrenan (🏥) van siempre al final; dentro de cada grupo, las que
// no tienen dato en la columna elegida van detrás de las que sí lo tienen (con cualquier
// dirección); los empates se ordenan por nombre.
RPETracker.prototype._sortDashEntries = function(rows, sort) {
    const dir = sort.dir === 'asc' ? 1 : -1;
    const name = r => String((r.player && r.player.name) || '');
    return rows.slice().sort((a, b) => {
        if (!!a.out !== !!b.out) return a.out ? 1 : -1;
        const va = _dashSortValue(a, sort.key);
        const vb = _dashSortValue(b, sort.key);
        if (va === null && vb !== null) return 1;
        if (vb === null && va !== null) return -1;
        if (va !== null && va !== vb) return (va - vb) * dir;
        return name(a).localeCompare(name(b), 'es');
    });
};

// ── Tabla: cabecera clicable + una fila por jugadora ─────────────────────
// entries: [{ player, ratio, st: {color, cls, risk}, out, r }] (lo prepara renderDashboard)
RPETracker.prototype._renderPlayersTable = function(entries) {
    const sort = this._dashSortState();
    const rows = this._sortDashEntries(entries.map(e => Object.assign({}, e, {
        w:   this._wellness7d(e.player.id),
        rdy: this._dashReadiness(e.player.id)
    })), sort);

    const th = (key, label, title, align) => {
        const active = sort.key === key;
        const state  = active ? (sort.dir === 'desc' ? 'de mayor a menor' : 'de menor a mayor') : '';
        const arrow  = active ? `<span class="db-th-arrow" aria-hidden="true">${sort.dir === 'desc' ? '▼' : '▲'}</span>` : '';
        return `<button type="button" class="db-th${active ? ' db-th--active' : ''}${align ? ' db-th--' + align : ''}"`
            + ` onclick="window.rpeTracker?.sortDashBy('${key}')"`
            + ` title="${title}${state ? ' · ' + state : ''} · toca para ordenar"`
            + ` aria-label="Ordenar por ${title}${state ? ', ahora ' + state : ''}">${label}${arrow}</button>`;
    };

    const head = `<div class="db-players-head">
        <span aria-hidden="true"></span><span aria-hidden="true"></span><span aria-hidden="true"></span>
        ${th('ac', 'A:C', 'Ratio agudo:crónico', 'end')}
        ${th('w', 'Ø', 'Bienestar (media de 7 días)')}
        ${th('r', 'R', 'Readiness')}
    </div>`;

    const body = rows.map(({ player, ratio, st, out, r, w, rdy }) => {
        const barW = Math.min(r / 2 * 100, 100).toFixed(0);
        const acHtml = out
            ? '<span title="No entrena con el grupo: no se calcula el ratio A:C">🏥</span>'
            : ratio.confidence === 'low'
                ? `<span class="badge-insuf" title="${esc(ratio.message || 'Datos insuficientes')}" aria-label="Datos insuficientes">⚠️</span>`
                : ratio.ratio === 'N/A' ? '—' : esc(String(ratio.ratio));
        const wTxt = w.avg === null ? '—' : w.avg.toFixed(1);
        const wTitle = w.avg === null
            ? 'Bienestar: sin registros en los últimos 7 días'
            : `Bienestar medio 7 días: ${wTxt}/5 (${w.count} ${w.count === 1 ? 'registro' : 'registros'})`;
        const rTxt = rdy.score === null ? '—' : rdy.score;
        const rTitle = rdy.score === null ? 'Readiness: sin datos' : `Readiness: ${rdy.score}/100`;

        return `
            <div class="db-player-row">
                ${PlayerTokens.avatar(player, 20, '0.6rem')}
                <div class="db-player-name">${esc(player.name)}${player.number ? `<span class="db-num">#${esc(player.number)}</span>` : ''}</div>
                <div class="db-player-bar">
                    <div class="db-bar-fill" style="width:${barW}%;background:${st.color}"></div>
                    <div class="db-bar-lo"></div>
                    <div class="db-bar-hi"></div>
                </div>
                <div class="db-player-ratio ${st.cls || 'wh-nodata'}">${acHtml}</div>
                <div class="db-player-wellness ${_dashWellnessClass(w.avg)}" title="${wTitle}">${wTxt}</div>
                <div class="db-player-readiness ${rdy.cls}" title="${rTitle}">${rTxt}</div>
            </div>`;
    }).join('');

    return head + body;
};

// ── Compatibilidad: la tabla "Carga y wellness — 7 días" ya no existe ───────
RPETracker.prototype._renderPlayerComparisonSection = function() { return ''; };
RPETracker.prototype._renderComparisonRadar = function() {};
RPETracker.prototype._bindComparisonEvents = function() {};

// ── Colores del texto (inyectados una vez) ────────────────────────────────
// Tono oscuro para fondo claro y tono claro para fondo oscuro. Solo color: sin fondos.
(function() {
    if (document.getElementById('dashboard-comparison-style')) return;
    const s = document.createElement('style');
    s.id = 'dashboard-comparison-style';
    s.textContent = `
        .wh-good { color: #2e7d32; }
        .wh-warn { color: #e65100; }
        .wh-bad  { color: #c62828; }
        .wh-blue { color: #1565c0; }
        [data-theme="dark"] .wh-good { color: #66bb6a; }
        [data-theme="dark"] .wh-warn { color: #ffa726; }
        [data-theme="dark"] .wh-bad  { color: #ef5350; }
        [data-theme="dark"] .wh-blue { color: #64b5f6; }
        .wh-nodata { color: var(--text-faint); font-weight: 400; }
    `;
    document.head.appendChild(s);
}());

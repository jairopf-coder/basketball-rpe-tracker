// ========== TEAM LOAD HEATMAP (team-load.js) ==========
// Heatmap: semanas × jugadoras con UA real por día
// Colores: 0=gris, <200=azul, 200-400=verde, 400-600=naranja, >600=rojo

(function () {
    'use strict';

    // ── Constantes de color (CSS variables, sin hardcoded hex) ──────────────
    const ZONE = {
        rest:   { varBg: '--tl-zone-rest-bg',   varText: '--tl-zone-rest-text',   label: '0',       title: 'Descanso' },
        low:    { varBg: '--tl-zone-low-bg',    varText: '--tl-zone-low-text',    label: '<200',    title: 'Baja'     },
        medium: { varBg: '--tl-zone-medium-bg', varText: '--tl-zone-medium-text', label: '200-400', title: 'Media'    },
        high:   { varBg: '--tl-zone-high-bg',   varText: '--tl-zone-high-text',   label: '400-600', title: 'Alta'     },
        vhigh:  { varBg: '--tl-zone-vhigh-bg',  varText: '--tl-zone-vhigh-text',  label: '>600',    title: 'Muy alta' },
    };

    function getZone(ua) {
        if (ua === 0)        return ZONE.rest;
        if (ua < 200)        return ZONE.low;
        if (ua < 400)        return ZONE.medium;
        if (ua < 600)        return ZONE.high;
        return ZONE.vhigh;
    }

    // ── Utilidades de fecha ──────────────────────────────────────────────────
    function getMondayOf(date) {
        const d = new Date(date);
        const day = d.getDay(); // 0=Sun
        const diff = (day === 0) ? -6 : 1 - day;
        d.setDate(d.getDate() + diff);
        d.setHours(0, 0, 0, 0);
        return d;
    }

    function addDays(date, n) {
        const d = new Date(date);
        d.setDate(d.getDate() + n);
        return d;
    }

    function toYMD(date) {
        return date.toISOString().slice(0, 10);
    }

    function formatWeekLabel(monday) {
        const sunday = addDays(monday, 6);
        const opts = { day: 'numeric', month: 'short' };
        return `${monday.toLocaleDateString('es-ES', opts)} – ${sunday.toLocaleDateString('es-ES', opts)}`;
    }

    const DAY_LABELS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    // ── Estado del módulo ────────────────────────────────────────────────────
    let _currentMonday = getMondayOf(new Date());

    // ── Cálculo de UA por jugadora×día ───────────────────────────────────────
    function computeWeekMatrix(sessions, players, monday) {
        // Returns: { [playerId]: [ua_lun, ua_mar, ..., ua_dom] }
        const weekDates = Array.from({ length: 7 }, (_, i) => toYMD(addDays(monday, i)));
        const matrix = {};

        players.forEach(p => {
            matrix[p.id] = weekDates.map(dateStr => {
                const daySessions = sessions.filter(s => {
                    const sd = (s.date || '').slice(0, 10);
                    return s.playerId === p.id && sd === dateStr;
                });
                return daySessions.reduce((sum, s) => {
                    return sum + (s.load || (s.rpe * (s.duration || 60)));
                }, 0);
            });
        });

        return { matrix, weekDates };
    }

    // ── Render principal ─────────────────────────────────────────────────────
    function renderTeamLoad() {
        const container = document.getElementById('teamLoadView');
        if (!container) return;

        const tracker = window.rpeTracker;
        if (!tracker) {
            container.innerHTML = '<p class="tl-empty">Cargando datos…</p>';
            return;
        }

        const players  = (tracker.players  || []).filter(p => p && p.id);
        const sessions = tracker.sessions  || [];

        const monday = _currentMonday;
        const { matrix, weekDates } = computeWeekMatrix(sessions, players, monday);

        // ── Totales por día (suma de todos los jugadores) ────────────────────
        const teamTotals = weekDates.map((_, di) =>
            players.reduce((sum, p) => sum + (matrix[p.id]?.[di] || 0), 0)
        );

        // ── Totales por jugadora (suma de la semana) ────────────────────────
        const playerTotals = {};
        players.forEach(p => {
            playerTotals[p.id] = (matrix[p.id] || []).reduce((a, b) => a + b, 0);
        });

        const weekLabel  = formatWeekLabel(monday);
        const teamTotal  = teamTotals.reduce((a, b) => a + b, 0);

        // ── HTML ────────────────────────────────────────────────────────────
        container.innerHTML = `
        <div class="tl-header">
            <div class="tl-nav">
                <button class="tl-nav-btn" id="tlPrevWeek" aria-label="Semana anterior">‹</button>
                <span class="tl-week-label">${weekLabel}</span>
                <button class="tl-nav-btn" id="tlNextWeek" aria-label="Semana siguiente">›</button>
            </div>
            <div class="tl-legend">
                ${Object.values(ZONE).map(z => `
                    <span class="tl-legend-item">
                        <span class="tl-legend-dot" style="background:var(${z.varBg})"></span>
                        <span>${z.title} (${z.label})</span>
                    </span>
                `).join('')}
            </div>
        </div>

        ${players.length === 0 ? `
            <div class="tl-empty">
                <div class="tl-empty-icon">🏀</div>
                <p>No hay jugadoras registradas.</p>
            </div>
        ` : `
        <div class="tl-scroll-wrap">
            <table class="tl-table" role="grid">
                <thead>
                    <tr>
                        <th class="tl-th-player">Jugadora</th>
                        ${DAY_LABELS.map((d, i) => {
                            const isToday = weekDates[i] === toYMD(new Date());
                            return `<th class="tl-th-day ${isToday ? 'tl-today' : ''}">${d}<br><span class="tl-th-date">${weekDates[i].slice(5)}</span></th>`;
                        }).join('')}
                        <th class="tl-th-total">Total</th>
                    </tr>
                </thead>
                <tbody>
                    ${players.map(p => {
                        const dayLoads = matrix[p.id] || Array(7).fill(0);
                        const total    = playerTotals[p.id] || 0;
                        return `
                        <tr class="tl-row">
                            <td class="tl-td-player">
                                <span class="tl-player-dot" style="background:${p.color || 'var(--text-muted)'}"></span>
                                <span class="tl-player-name">${escapeHtml(p.name)}</span>
                            </td>
                            ${dayLoads.map((ua, di) => {
                                const zone    = getZone(ua);
                                const isToday = weekDates[di] === toYMD(new Date());
                                return `<td class="tl-td-cell ${isToday ? 'tl-today' : ''}"
                                    style="background:var(${zone.varBg});color:var(${zone.varText})"
                                    title="${DAY_LABELS[di]} ${weekDates[di]}: ${ua} UA — ${zone.title}"
                                    aria-label="${ua} UA">
                                    ${ua > 0 ? ua : '<span class="tl-zero">—</span>'}
                                </td>`;
                            }).join('')}
                            <td class="tl-td-total">${total > 0 ? total : '—'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr class="tl-team-row">
                        <td class="tl-td-player tl-team-label">🏀 Equipo</td>
                        ${teamTotals.map((ua, di) => {
                            const zone    = getZone(ua);
                            const isToday = weekDates[di] === toYMD(new Date());
                            return `<td class="tl-td-cell tl-team-cell ${isToday ? 'tl-today' : ''}"
                                style="background:var(${zone.varBg});color:var(${zone.varText})"
                                title="Total equipo ${DAY_LABELS[di]}: ${ua} UA">
                                <strong>${ua > 0 ? ua : '—'}</strong>
                            </td>`;
                        }).join('')}
                        <td class="tl-td-total tl-team-grand">${teamTotal > 0 ? teamTotal : '—'}</td>
                    </tr>
                </tfoot>
            </table>
        </div>
        `}
        `;

        // ── Eventos de navegación ────────────────────────────────────────────
        document.getElementById('tlPrevWeek')?.addEventListener('click', () => {
            _currentMonday = addDays(_currentMonday, -7);
            renderTeamLoad();
        });
        document.getElementById('tlNextWeek')?.addEventListener('click', () => {
            _currentMonday = addDays(_currentMonday, 7);
            renderTeamLoad();
        });
    }

    // ── Escape HTML util ─────────────────────────────────────────────────────
    function escapeHtml(str) {
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ── Exponer en rpeTracker ────────────────────────────────────────────────
    document.addEventListener('DOMContentLoaded', () => {
        if (window.rpeTracker) {
            window.rpeTracker.renderTeamLoad = renderTeamLoad;
        } else {
            // rpeTracker may not be ready yet; wait for it
            const iv = setInterval(() => {
                if (window.rpeTracker) {
                    window.rpeTracker.renderTeamLoad = renderTeamLoad;
                    clearInterval(iv);
                }
            }, 100);
        }
    });

})();

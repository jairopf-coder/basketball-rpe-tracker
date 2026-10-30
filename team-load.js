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
        return toLocalISODate(date);
    }

    function formatWeekLabel(monday) {
        const sunday = addDays(monday, 6);
        return formatDMRange(monday, sunday);
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

        const sessions = tracker.sessions  || [];
        const monday = _currentMonday;

        // Plantilla de ESTA semana: la jugadora de baja sale cuando ya no queda ningún día de la semana
        // en que estuviera en el equipo (misma regla que la tabla de Microciclo).
        const mondayISO = toYMD(monday);
        const roster = (tracker.players || []).filter(p => p && p.id
            && (typeof tracker.hasActiveDaysFrom !== 'function' || tracker.hasActiveDaysFrom(p, mondayISO)));

        const { matrix, weekDates } = computeWeekMatrix(sessions, roster, monday);

        // Estado de cada jugadora cada día: 'in' (participa con el grupo, también en fase 5 "parcial"),
        // 'out' (lesión en fases 1-4 o no disponible: no entrena con el grupo) o 'gone' (ya no estaba
        // en el equipo ese día, por una baja a mitad de semana).
        const dayState = {};
        roster.forEach(p => {
            dayState[p.id] = weekDates.map(ds => {
                if (typeof tracker.isPlayerActiveOn === 'function' && !tracker.isPlayerActiveOn(p, ds)) return 'gone';
                if (typeof tracker.getPlayerParticipation === 'function'
                    && tracker.getPlayerParticipation(p.id, ds) === 'out') return 'out';
                return 'in';
            });
        });

        // Las que han estado fuera algún día de la semana van al final (conservando su orden entre ellas)
        const hasOutDay = p => dayState[p.id].includes('out');
        const players = [...roster.filter(p => !hasOutDay(p)), ...roster.filter(hasOutDay)];
        const firstOutId = players.find(hasOutDay)?.id;
        const anyOut = firstOutId !== undefined;

        const minMonday = getMondayOf(addDays(new Date(), -730));
        const maxMonday = getMondayOf(addDays(new Date(), 183));
        const atMin = toYMD(monday) <= toYMD(minMonday);
        const atMax = toYMD(monday) >= toYMD(maxMonday);

        // ── Totales por día: suma de quienes participaron con el grupo ese día ──
        // La carga de una jugadora fuera del grupo (readaptación, trabajo individual) se ve en su fila,
        // pero no entra en el total del equipo (igual que en Microciclo y en las medias).
        const teamTotals = weekDates.map((_, di) =>
            players.reduce((sum, p) => sum + (dayState[p.id][di] === 'in' ? (matrix[p.id]?.[di] || 0) : 0), 0)
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
                <button class="tl-nav-btn" id="tlPrevWeek" aria-label="Semana anterior" ${atMin ? 'disabled' : ''}>‹</button>
                <span class="tl-week-label">${weekLabel}</span>
                <button class="tl-nav-btn" id="tlNextWeek" aria-label="Semana siguiente" ${atMax ? 'disabled' : ''}>›</button>
            </div>
            <div class="tl-legend">
                ${Object.values(ZONE).map(z => `
                    <span class="tl-legend-item">
                        <span class="tl-legend-dot" style="background:var(${z.varBg})"></span>
                        <span>${z.title} (${z.label})</span>
                    </span>
                `).join('')}
                ${anyOut ? `<span class="tl-legend-item"><span>🏥 Fuera del grupo (lesión / no disponible)</span></span>` : ''}
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
                        const isOutRow = hasOutDay(p);
                        return `
                        <tr class="tl-row ${p.id === firstOutId ? 'tl-row-sep' : ''}">
                            <td class="tl-td-player">
                                <span class="tl-player-dot" style="background:${p.color || 'var(--text-muted)'}"></span>
                                <span class="tl-player-name">${escapeHtml(p.name)}</span>${isOutRow ? ' <span title="Ha estado fuera del grupo esta semana (lesión / no disponible)">🏥</span>' : ''}
                            </td>
                            ${dayLoads.map((ua, di) => {
                                const state   = dayState[p.id][di];
                                const isToday = weekDates[di] === toYMD(new Date());
                                const todayCls = isToday ? 'tl-today' : '';
                                const when    = `${DAY_LABELS[di]} ${weekDates[di]}`;
                                if (ua === 0 && state === 'out') {
                                    return `<td class="tl-td-cell tl-cell-out ${todayCls}"
                                        title="${when}: fuera del grupo (lesión / no disponible)"
                                        aria-label="Fuera del grupo">🏥</td>`;
                                }
                                if (ua === 0 && state === 'gone') {
                                    return `<td class="tl-td-cell tl-cell-gone ${todayCls}"
                                        title="${when}: ya no estaba en el equipo"
                                        aria-label="Ya no estaba en el equipo">·</td>`;
                                }
                                const zone = getZone(ua);
                                const note = state === 'out' ? ' — fuera del grupo: no cuenta en el total del equipo' : '';
                                return `<td class="tl-td-cell ${todayCls}"
                                    style="background:var(${zone.varBg});color:var(${zone.varText})"
                                    title="${when}: ${ua} UA — ${zone.title}${note}"
                                    aria-label="${ua} UA">
                                    ${ua > 0 ? ua : '<span class="tl-zero">—</span>'}${state === 'out' ? '<span class="tl-out-mark">🏥</span>' : ''}
                                </td>`;
                            }).join('')}
                            <td class="tl-td-total">${total > 0 ? total : '—'}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
                <tfoot>
                    <tr class="tl-team-row">
                        <td class="tl-td-player tl-team-label" title="Suma de la carga de quienes participaron con el grupo cada día">🏀 Equipo</td>
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
            const prev = addDays(_currentMonday, -7);
            if (toYMD(prev) >= toYMD(minMonday)) {
                _currentMonday = prev;
                renderTeamLoad();
            }
        });
        document.getElementById('tlNextWeek')?.addEventListener('click', () => {
            const next = addDays(_currentMonday, 7);
            if (toYMD(next) <= toYMD(maxMonday)) {
                _currentMonday = next;
                renderTeamLoad();
            }
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

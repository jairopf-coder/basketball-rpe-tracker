// Basketball RPE Tracker - Calendar View & Advanced Features

// ========== HELPERS ==========

// Agrupa las entradas individuales en sesiones reales (por fecha + timeOfDay)
RPETracker.prototype.groupSessionsBySlot = function(entries) {
    const map = {};
    entries.forEach(s => {
        const key = `${s.date}__${s.timeOfDay || 'morning'}`;
        if (!map[key]) map[key] = { timeOfDay: s.timeOfDay || 'morning', type: s.type, entries: [] };
        map[key].entries.push(s);
    });
    return Object.values(map);
};

// ========== CALENDAR VIEW ==========

RPETracker.prototype.renderCalendar = function(year, month) {
    const container = document.getElementById('calendarView');
    if (!container) return;

    const firstDay           = new Date(year, month, 1);
    const lastDay            = new Date(year, month + 1, 0);
    const daysInMonth        = lastDay.getDate();
    const startingDayOfWeek  = firstDay.getDay();

    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    let html = `
        <div class="calendar-header">
            <button onclick="window.rpeTracker?.previousMonth()" class="btn-secondary">← Anterior</button>
            <h2>${monthNames[month]} ${year}</h2>
            <button onclick="window.rpeTracker?.nextMonth()" class="btn-secondary">Siguiente →</button>
        </div>
        <div class="calendar-grid">
            <div class="calendar-day-header">Dom</div>
            <div class="calendar-day-header">Lun</div>
            <div class="calendar-day-header">Mar</div>
            <div class="calendar-day-header">Mié</div>
            <div class="calendar-day-header">Jue</div>
            <div class="calendar-day-header">Vie</div>
            <div class="calendar-day-header">Sáb</div>
    `;

    for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const dayEntries  = this.sessions.filter(s => {
            const d = new Date(s.date);
            return d.getFullYear() === year && d.getMonth() === month && d.getDate() === day;
        });

        const isToday  = new Date().toDateString() === currentDate.toDateString();
        let dayClass   = 'calendar-day' + (isToday ? ' today' : '') + (dayEntries.length > 0 ? ' has-sessions' : '');

        const slots = this.groupSessionsBySlot(dayEntries);

        // Color ratio medio del día
        let avgRatio = 0, ratioColor = '#eee';
        if (dayEntries.length > 0) {
            const ratios = dayEntries.map(s => {
                const r = this.calculateAcuteChronicRatio(s.playerId);
                return parseFloat(r.ratio) || 0;
            }).filter(r => r > 0);
            if (ratios.length) {
                avgRatio   = ratios.reduce((a, b) => a + b, 0) / ratios.length;
                ratioColor = this.getRatioColor(avgRatio.toFixed(2));
            }
        }

        const slotLabel = { morning: 'Mañana', afternoon: 'Tarde', evening: 'Noche' };
        let sessionHTML = '';

        if (slots.length === 1) {
            const slot   = slots[0];
            const avgRPE = (slot.entries.reduce((s, x) => s + x.rpe, 0) / slot.entries.length).toFixed(1);
            const icon   = slot.type === 'match' ? '🏟️' : '🏀';
            sessionHTML  = `
                <span class="session-count">${icon} ${slot.entries.length} jugadora${slot.entries.length !== 1 ? 's' : ''}</span>
                <span class="cal-rpe-avg">RPE ${avgRPE}</span>
            `;
        } else if (slots.length > 1) {
            sessionHTML = `<span class="session-count">${slots.length} sesiones</span>`;
            slots.forEach(slot => {
                const avgRPE = (slot.entries.reduce((s, x) => s + x.rpe, 0) / slot.entries.length).toFixed(1);
                const icon   = slot.type === 'match' ? '🏟️' : '🏀';
                const label  = slotLabel[slot.timeOfDay] || slot.timeOfDay;
                sessionHTML += `<span class="cal-slot-line">${icon} ${label} · RPE ${avgRPE}</span>`;
            });
        }

        if (avgRatio > 0 && slots.length > 0) {
            sessionHTML += `<span class="ratio-badge" style="background:${ratioColor};color:white;">${avgRatio.toFixed(1)}</span>`;
        }

        html += `
            <div class="${dayClass}" onclick="window.rpeTracker?.showDaySessions(${year},${month},${day})"
                 style="background:${avgRatio > 0 ? ratioColor + '18' : 'transparent'};">
                <div class="calendar-day-number">${day}</div>
                <div class="calendar-day-sessions">${sessionHTML}</div>
            </div>
        `;
    }

    html += '</div>';
    container.innerHTML = html;
};

// ========== DAY MODAL ==========

RPETracker.prototype.showDaySessions = function(year, month, day) {
    const date    = new Date(year, month, day);
    const entries = this.sessions.filter(s => new Date(s.date).toDateString() === date.toDateString());

    if (entries.length === 0) { alert('No hay sesiones en este día'); return; }

    const slots     = this.groupSessionsBySlot(entries);
    const slotLabel = { morning: 'Mañana', afternoon: 'Tarde', evening: 'Noche' };
    const slotOrder = { morning: 0, afternoon: 1, evening: 2 };
    slots.sort((a, b) => (slotOrder[a.timeOfDay] ?? 9) - (slotOrder[b.timeOfDay] ?? 9));

    let html = '';

    slots.forEach(slot => {
        const label    = slotLabel[slot.timeOfDay] || slot.timeOfDay;
        const icon     = slot.type === 'match' ? '🏟️' : '🏀';
        const typeName = slot.type === 'match' ? 'Partido' : 'Entrenamiento';
        const avgRPE   = (slot.entries.reduce((s, x) => s + x.rpe, 0) / slot.entries.length).toFixed(1);
        const avgLoad  = Math.round(slot.entries.reduce((s, x) => s + (x.load || x.rpe * (x.duration || 60)), 0) / slot.entries.length);
        const dur      = slot.entries[0].duration || 60;
        const hasNotes = slot.entries.some(e => e.notes);

        html += `
            <div class="cal-modal-slot">
                <div class="cal-modal-slot-header">
                    <span class="cal-modal-slot-title">${icon} ${label} · ${typeName}</span>
                    <span class="cal-modal-slot-meta">${dur}min &nbsp;·&nbsp; RPE medio <strong>${avgRPE}</strong> &nbsp;·&nbsp; Carga media <strong>${avgLoad}</strong></span>
                </div>
                <table class="cal-modal-table">
                    <thead>
                        <tr>
                            <th>Jugadora</th>
                            <th>RPE</th>
                            <th>Carga</th>
                            <th>Ratio A:C</th>
                            ${hasNotes ? '<th>Notas</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
        `;

        slot.entries
            .sort((a, b) => {
                const pa = this.players.find(p => p.id === a.playerId);
                const pb = this.players.find(p => p.id === b.playerId);
                return (pa?.name || '').localeCompare(pb?.name || '');
            })
            .forEach(entry => {
                const player = this.players.find(p => p.id === entry.playerId);
                const name   = player
                    ? `${player.name}${player.number ? ' <span class="db-num">#' + player.number + '</span>' : ''}`
                    : 'Desconocida';
                const ratio  = this.calculateAcuteChronicRatio(entry.playerId);
                const rColor = this.getRatioColor(ratio.ratio);
                const load   = entry.load || entry.rpe * (entry.duration || 60);

                html += `
                    <tr onclick="window.rpeTracker?.showSessionDetail('${entry.id}')" style="cursor:pointer;">
                        <td>${name}</td>
                        <td><span style="color:${this.getRPEColor(entry.rpe)};font-weight:700;">${entry.rpe}</span></td>
                        <td>${load}</td>
                        <td><span style="color:${rColor};font-weight:600;">${ratio.ratio}</span></td>
                        ${hasNotes ? `<td class="cal-modal-notes">${entry.notes || '—'}</td>` : ''}
                    </tr>
                `;
            });

        html += `</tbody></table></div>`;
    });

    // Media global del día si hay más de una sesión
    if (slots.length > 1) {
        const dayAvgRPE  = (entries.reduce((s, x) => s + x.rpe, 0) / entries.length).toFixed(1);
        const dayAvgLoad = Math.round(entries.reduce((s, x) => s + (x.load || x.rpe * (x.duration || 60)), 0) / entries.length);
        html += `
            <div class="cal-modal-day-avg">
                Media del día &nbsp;·&nbsp; RPE <strong>${dayAvgRPE}</strong> &nbsp;·&nbsp; Carga <strong>${dayAvgLoad}</strong>
            </div>
        `;
    }

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content cal-modal-content">
            <div class="modal-header">
                <h2>Sesiones del ${day}/${month + 1}/${year}</h2>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
            <div class="cal-modal-body">${html}</div>
        </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
};

// ========== NAV ==========

RPETracker.prototype.initializeCalendar = function() {
    this.calendarYear  = new Date().getFullYear();
    this.calendarMonth = new Date().getMonth();
};

RPETracker.prototype.previousMonth = function() {
    this.calendarMonth--;
    if (this.calendarMonth < 0) { this.calendarMonth = 11; this.calendarYear--; }
    this.renderCalendar(this.calendarYear, this.calendarMonth);
};

RPETracker.prototype.nextMonth = function() {
    this.calendarMonth++;
    if (this.calendarMonth > 11) { this.calendarMonth = 0; this.calendarYear++; }
    this.renderCalendar(this.calendarYear, this.calendarMonth);
};

// ========== TEMPORAL COMPARISON ==========

RPETracker.prototype.renderTemporalComparison = function(playerId) {
    const now = new Date();
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const playerSessions   = this.sessions.filter(s => s.playerId === playerId);
    const thisWeekSessions = playerSessions.filter(s => new Date(s.date) >= thisWeekStart);
    const lastWeekSessions = playerSessions.filter(s => { const d = new Date(s.date); return d >= lastWeekStart && d < thisWeekStart; });

    const sumLoad = arr => arr.reduce((sum, s) => sum + (s.load || s.rpe * (s.duration || 60)), 0);
    const avgRPE  = arr => arr.length ? arr.reduce((sum, s) => sum + s.rpe, 0) / arr.length : 0;

    const thisLoad = sumLoad(thisWeekSessions), lastLoad = sumLoad(lastWeekSessions);
    const thisAvg  = avgRPE(thisWeekSessions),  lastAvg  = avgRPE(lastWeekSessions);

    return {
        thisWeek: { sessions: thisWeekSessions.length, load: Math.round(thisLoad), avgRPE: thisAvg.toFixed(1) },
        lastWeek: { sessions: lastWeekSessions.length, load: Math.round(lastLoad), avgRPE: lastAvg.toFixed(1) },
        changes:  {
            load:     lastLoad > 0 ? ((thisLoad - lastLoad) / lastLoad * 100).toFixed(1) : 0,
            rpe:      lastAvg  > 0 ? ((thisAvg  - lastAvg)  / lastAvg  * 100).toFixed(1) : 0,
            sessions: thisWeekSessions.length - lastWeekSessions.length
        }
    };
};

// ========== WEEKLY SUMMARY ==========

RPETracker.prototype.getWeeklySummary = function() {
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    weekStart.setHours(0, 0, 0, 0);

    const weekSessions  = this.sessions.filter(s => new Date(s.date) >= weekStart);
    const totalLoad     = weekSessions.reduce((sum, s) => sum + (s.load || s.rpe * (s.duration || 60)), 0);
    const avgRPE        = weekSessions.length ? weekSessions.reduce((sum, s) => sum + s.rpe, 0) / weekSessions.length : 0;
    const playersAtRisk = this.players.filter(p => parseFloat(this.calculateAcuteChronicRatio(p.id).ratio) > 1.5);

    return {
        sessions:      weekSessions.length,
        totalLoad:     Math.round(totalLoad),
        avgRPE:        avgRPE.toFixed(1),
        training:      weekSessions.filter(s => s.type === 'training').length,
        matches:       weekSessions.filter(s => s.type === 'match').length,
        playersAtRisk: playersAtRisk.length,
        riskPlayers:   playersAtRisk.map(p => ({ name: p.name, number: p.number, ratio: this.calculateAcuteChronicRatio(p.id).ratio }))
    };
};

document.addEventListener('DOMContentLoaded', () => {
    if (typeof rpeTracker !== 'undefined') rpeTracker.initializeCalendar();
});

// ========== SEASON BLOCKS ==========

RPETracker.prototype._seasonBlockTypes = [
    { key: 'preseason',    label: 'Pretemporada',  color: '#1e88e5', icon: '🏗️' },
    { key: 'competition',  label: 'Competición',   color: '#e53935', icon: '🏆' },
    { key: 'taper',        label: 'Taper',         color: '#8e24aa', icon: '⬇️' },
    { key: 'rest',         label: 'Descanso',      color: '#43a047', icon: '💤' },
];

RPETracker.prototype.loadSeasonBlocks = function() {
    if (window.firebaseSync) {
        window.firebaseSync.onSeasonBlocksChange(blocks => {
            this.seasonBlocks = blocks || [];
            // Refresh badge if weekplan is visible
            if (this.currentView === 'weekplan' && typeof this.renderWeeklyPlanning === 'function') {
                this.renderWeeklyPlanning();
            }
            if (this.currentView === 'seasonblocks' && typeof this.renderSeasonBlocksManager === 'function') {
                this.renderSeasonBlocksManager();
            }
        });
    } else {
        try {
            this.seasonBlocks = JSON.parse(localStorage.getItem('rpe_seasonBlocks') || '[]');
        } catch(e) { this.seasonBlocks = []; }
    }
};

RPETracker.prototype.saveSeasonBlocks = function() {
    if (window.firebaseSync) {
        window.firebaseSync.saveSeasonBlocks(this.seasonBlocks || []);
    } else {
        localStorage.setItem('rpe_seasonBlocks', JSON.stringify(this.seasonBlocks || []));
    }
};

RPETracker.prototype.getActiveSeasonBlock = function() {
    if (!this.seasonBlocks) return null;
    const today = new Date().toISOString().slice(0, 10);
    return this.seasonBlocks.find(b => b.start <= today && b.end >= today) || null;
};

RPETracker.prototype.renderSeasonBlocksManager = function() {
    const container = document.getElementById('seasonBlocksView');
    if (!container) return;
    if (!this.seasonBlocks) this.loadSeasonBlocks();

    const types = this._seasonBlockTypes;
    const blocks = (this.seasonBlocks || []).slice().sort((a, b) => a.start.localeCompare(b.start));

    const today = new Date().toISOString().slice(0, 10);

    const blocksHTML = blocks.length === 0
        ? `<div class="an-empty" style="padding:2rem;text-align:center;color:var(--text-secondary)">Sin bloques de temporada definidos</div>`
        : blocks.map(b => {
            const t = types.find(t => t.key === b.type) || types[0];
            const isActive = b.start <= today && b.end >= today;
            const isPast   = b.end < today;
            return `
                <div class="season-block-row${isActive ? ' season-block-active' : isPast ? ' season-block-past' : ''}">
                    <span class="season-block-icon">${t.icon}</span>
                    <span class="season-block-label" style="color:${t.color}">${t.label}</span>
                    <span class="season-block-dates">${b.start} → ${b.end}</span>
                    ${b.note ? `<span class="season-block-note">${b.note}</span>` : ''}
                    ${isActive ? `<span class="season-active-badge">● Activo</span>` : ''}
                    <button class="btn-icon-sm" onclick="window.rpeTracker?.deleteSeasonBlock('${b.id}')" title="Eliminar">🗑️</button>
                </div>
            `;
        }).join('');

    container.innerHTML = `
        <div class="weekplan-header">
            <div>
                <h2 style="margin:0 0 .25rem">📆 Bloques de Temporada</h2>
                <p style="margin:0;color:var(--text-secondary);font-size:.85rem">Gestión de fases: pretemporada, competición, taper</p>
            </div>
            <button class="btn-primary btn-sm" onclick="window.rpeTracker?.openSeasonBlockModal()">+ Nuevo bloque</button>
        </div>
        <div class="season-blocks-list">${blocksHTML}</div>
    `;
};

RPETracker.prototype.openSeasonBlockModal = function(blockId) {
    const existing = blockId ? (this.seasonBlocks || []).find(b => b.id === blockId) : null;
    const types = this._seasonBlockTypes;

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width:420px">
            <div class="modal-header">
                <h2>${existing ? 'Editar bloque' : 'Nuevo bloque de temporada'}</h2>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
            <div class="modal-body" style="padding:1.25rem;display:flex;flex-direction:column;gap:1rem">
                <div>
                    <label class="form-label">Tipo de bloque</label>
                    <select id="sbType" class="form-control">
                        ${types.map(t => `<option value="${t.key}" ${existing?.type === t.key ? 'selected' : ''}>${t.icon} ${t.label}</option>`).join('')}
                    </select>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
                    <div>
                        <label class="form-label">Fecha inicio</label>
                        <input type="date" id="sbStart" class="form-control" value="${existing?.start || ''}">
                    </div>
                    <div>
                        <label class="form-label">Fecha fin</label>
                        <input type="date" id="sbEnd" class="form-control" value="${existing?.end || ''}">
                    </div>
                </div>
                <div>
                    <label class="form-label">Nota (opcional)</label>
                    <input type="text" id="sbNote" class="form-control" placeholder="Ej: Liga ACB" value="${existing?.note || ''}">
                </div>
                <div style="display:flex;gap:.5rem;justify-content:flex-end">
                    <button class="btn-secondary" onclick="this.closest('.modal').remove()">Cancelar</button>
                    <button class="btn-primary" id="sbSaveBtn">Guardar</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelector('#sbSaveBtn').addEventListener('click', () => {
        const type  = modal.querySelector('#sbType').value;
        const start = modal.querySelector('#sbStart').value;
        const end   = modal.querySelector('#sbEnd').value;
        const note  = modal.querySelector('#sbNote').value.trim();

        if (!start || !end) { alert('Introduce fechas de inicio y fin'); return; }
        if (end < start)    { alert('La fecha fin debe ser posterior al inicio'); return; }

        if (!this.seasonBlocks) this.seasonBlocks = [];

        if (existing) {
            Object.assign(existing, { type, start, end, note });
        } else {
            this.seasonBlocks.push({ id: `sb_${Date.now()}`, type, start, end, note });
        }

        this.saveSeasonBlocks();
        modal.remove();
        this.renderSeasonBlocksManager();
        // Refresh weekplan header badge if visible
        const wpView = document.getElementById('weeklyPlanView');
        if (wpView && wpView.style.display !== 'none') this.renderWeeklyPlanning();
    });
};

RPETracker.prototype.deleteSeasonBlock = function(id) {
    if (!confirm('¿Eliminar este bloque?')) return;
    this.seasonBlocks = (this.seasonBlocks || []).filter(b => b.id !== id);
    this.saveSeasonBlocks();
    this.renderSeasonBlocksManager();
    const wpView = document.getElementById('weeklyPlanView');
    if (wpView && wpView.style.display !== 'none') this.renderWeeklyPlanning();
};

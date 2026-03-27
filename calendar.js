// Basketball RPE Tracker - Calendar View & Advanced Features

// ========== CALENDAR VIEW ==========

RPETracker.prototype.renderCalendar = function(year, month) {
    const container = document.getElementById('calendarView');
    if (!container) return;
    
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
                        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    
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
    
    // Empty cells before first day
    for (let i = 0; i < startingDayOfWeek; i++) {
        html += '<div class="calendar-day empty"></div>';
    }
    
    // Days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const currentDate = new Date(year, month, day);
        const sessionsOnDay = this.sessions.filter(s => {
            const sessionDate = new Date(s.date);
            return sessionDate.getFullYear() === year &&
                   sessionDate.getMonth() === month &&
                   sessionDate.getDate() === day;
        });
        
        const isToday = new Date().toDateString() === currentDate.toDateString();
        
        let dayClass = 'calendar-day';
        if (isToday) dayClass += ' today';
        if (sessionsOnDay.length > 0) dayClass += ' has-sessions';
        
        // Calculate average ratio for this day
        let avgRatio = 0;
        let ratioColor = '#eee';
        
        if (sessionsOnDay.length > 0) {
            const ratios = sessionsOnDay.map(s => {
                const player = this.players.find(p => p.id === s.playerId);
                if (!player) return 0;
                const ratio = this.calculateAcuteChronicRatio(player.id);
                return parseFloat(ratio.ratio) || 0;
            });
            
            avgRatio = ratios.reduce((sum, r) => sum + r, 0) / ratios.length;
            ratioColor = this.getRatioColor(avgRatio.toFixed(2));
        }
        
        html += `
            <div class="${dayClass}" onclick="window.rpeTracker?.showDaySessions(${year}, ${month}, ${day})" style="background: ${avgRatio > 0 ? ratioColor + '18' : 'transparent'};">
                <div class="calendar-day-number">${day}</div>
                <div class="calendar-day-sessions">
                    ${sessionsOnDay.length > 0 ? `
                        <span class="session-count">${sessionsOnDay.length} sesión${sessionsOnDay.length > 1 ? 'es' : ''}</span>
                        ${avgRatio > 0 ? `<span class="ratio-badge" style="background: ${ratioColor}; color: white;">${avgRatio.toFixed(1)}</span>` : ''}
                    ` : ''}
                </div>
            </div>
        `;
    }
    
    html += '</div>';
    container.innerHTML = html;
};

RPETracker.prototype.showDaySessions = function(year, month, day) {
    const date = new Date(year, month, day);
    const sessions = this.sessions.filter(s => {
        const sessionDate = new Date(s.date);
        return sessionDate.toDateString() === date.toDateString();
    });
    
    if (sessions.length === 0) {
        alert('No hay sesiones en este día');
        return;
    }
    
    let html = `<h3>Sesiones del ${day}/${month + 1}/${year}</h3><div class="day-sessions-list">`;
    
    sessions.forEach(session => {
        const player = this.players.find(p => p.id === session.playerId);
        const playerName = player ? player.name : 'Desconocida';
        
        html += `
            <div class="session-card" onclick="window.rpeTracker?.showSessionDetail('${session.id}')">
                <div class="session-icon ${session.type}">
                    ${session.type === 'training' ? '🏀' : '🏟️'}
                </div>
                <div class="session-info">
                    <div class="session-type">${playerName} - ${this.getSessionTypeName(session.type)}</div>
                    <div class="session-date">RPE: ${session.rpe} | Duración: ${session.duration || 60}min</div>
                </div>
                <div class="session-rpe">
                    <span class="session-rpe-number" style="color: ${this.getRPEColor(session.rpe)}">${session.rpe}</span>
                    <span class="session-rpe-label">RPE</span>
                </div>
            </div>
        `;
    });
    
    html += '</div>';
    
    // Show in modal or dedicated area
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>Sesiones del día</h2>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
            <div style="padding: 1rem;">
                ${html}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.remove();
        }
    });
};

RPETracker.prototype.initializeCalendar = function() {
    this.calendarYear = new Date().getFullYear();
    this.calendarMonth = new Date().getMonth();
};

RPETracker.prototype.previousMonth = function() {
    this.calendarMonth--;
    if (this.calendarMonth < 0) {
        this.calendarMonth = 11;
        this.calendarYear--;
    }
    this.renderCalendar(this.calendarYear, this.calendarMonth);
};

RPETracker.prototype.nextMonth = function() {
    this.calendarMonth++;
    if (this.calendarMonth > 11) {
        this.calendarMonth = 0;
        this.calendarYear++;
    }
    this.renderCalendar(this.calendarYear, this.calendarMonth);
};

// ========== TEMPORAL COMPARISON ==========

RPETracker.prototype.renderTemporalComparison = function(playerId) {
    const now = new Date();
    
    // This week vs last week
    const thisWeekStart = new Date(now);
    thisWeekStart.setDate(now.getDate() - now.getDay());
    thisWeekStart.setHours(0, 0, 0, 0);
    
    const lastWeekStart = new Date(thisWeekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);
    
    const lastWeekEnd = new Date(thisWeekStart);
    lastWeekEnd.setHours(23, 59, 59);
    
    const playerSessions = this.sessions.filter(s => s.playerId === playerId);
    
    const thisWeekSessions = playerSessions.filter(s => {
        const date = new Date(s.date);
        return date >= thisWeekStart;
    });
    
    const lastWeekSessions = playerSessions.filter(s => {
        const date = new Date(s.date);
        return date >= lastWeekStart && date < thisWeekStart;
    });
    
    const thisWeekLoad = thisWeekSessions.reduce((sum, s) => sum + (s.load || (s.rpe * (s.duration || 60))), 0);
    const lastWeekLoad = lastWeekSessions.reduce((sum, s) => sum + (s.load || (s.rpe * (s.duration || 60))), 0);
    
    const thisWeekAvgRPE = thisWeekSessions.length > 0
        ? thisWeekSessions.reduce((sum, s) => sum + s.rpe, 0) / thisWeekSessions.length
        : 0;
    
    const lastWeekAvgRPE = lastWeekSessions.length > 0
        ? lastWeekSessions.reduce((sum, s) => sum + s.rpe, 0) / lastWeekSessions.length
        : 0;
    
    const loadChange = lastWeekLoad > 0 ? ((thisWeekLoad - lastWeekLoad) / lastWeekLoad * 100) : 0;
    const rpeChange = lastWeekAvgRPE > 0 ? ((thisWeekAvgRPE - lastWeekAvgRPE) / lastWeekAvgRPE * 100) : 0;
    
    return {
        thisWeek: {
            sessions: thisWeekSessions.length,
            load: Math.round(thisWeekLoad),
            avgRPE: thisWeekAvgRPE.toFixed(1)
        },
        lastWeek: {
            sessions: lastWeekSessions.length,
            load: Math.round(lastWeekLoad),
            avgRPE: lastWeekAvgRPE.toFixed(1)
        },
        changes: {
            load: loadChange.toFixed(1),
            rpe: rpeChange.toFixed(1),
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
    
    const weekSessions = this.sessions.filter(s => new Date(s.date) >= weekStart);
    
    const totalLoad = weekSessions.reduce((sum, s) => sum + (s.load || (s.rpe * (s.duration || 60))), 0);
    const avgRPE = weekSessions.length > 0
        ? weekSessions.reduce((sum, s) => sum + s.rpe, 0) / weekSessions.length
        : 0;
    
    const trainingCount = weekSessions.filter(s => s.type === 'training').length;
    const matchCount = weekSessions.filter(s => s.type === 'match').length;
    
    // Players at risk this week
    const playersAtRisk = this.players.filter(p => {
        const ratio = this.calculateAcuteChronicRatio(p.id);
        const r = parseFloat(ratio.ratio);
        return r > 1.5;
    });
    
    return {
        sessions: weekSessions.length,
        totalLoad: Math.round(totalLoad),
        avgRPE: avgRPE.toFixed(1),
        training: trainingCount,
        matches: matchCount,
        playersAtRisk: playersAtRisk.length,
        riskPlayers: playersAtRisk.map(p => ({
            name: p.name,
            number: p.number,
            ratio: this.calculateAcuteChronicRatio(p.id).ratio
        }))
    };
};

// Initialize calendar on load
document.addEventListener('DOMContentLoaded', () => {
    if (typeof rpeTracker !== 'undefined') {
        rpeTracker.initializeCalendar();
    }
});

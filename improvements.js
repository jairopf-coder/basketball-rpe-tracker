// Basketball RPE Tracker - Improvements v3.0
// New features: Edit sessions, Edit players, Search, Sort, Templates, Calendar, etc.

// ========== EDIT SESSIONS ==========

RPETracker.prototype.editSession = function(sessionId) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    // Populate edit form
    document.getElementById('editSessionId').value = session.id;
    document.getElementById('editSessionPlayer').value = session.playerId;
    
    const date = new Date(session.date);
    const dateStr = date.toISOString().slice(0, 10);
    document.getElementById('editSessionDate').value = dateStr;
    
    // Set time of day
    if (session.timeOfDay === 'morning') {
        document.getElementById('editTimeMorning').checked = true;
    } else {
        document.getElementById('editTimeAfternoon').checked = true;
    }
    
    // Set duration
    document.getElementById('editSessionDuration').value = session.duration || 60;
    
    // Set type
    if (session.type === 'training') {
        document.getElementById('editTypeTraining').checked = true;
    } else {
        document.getElementById('editTypeMatch').checked = true;
    }
    
    // Set RPE
    document.getElementById('editRpeSlider').value = session.rpe;
    this.updateEditRPEDisplay(session.rpe);
    
    // Set notes
    document.getElementById('editSessionNotes').value = session.notes || '';
    
    // Populate player select
    const playerSelect = document.getElementById('editSessionPlayer');
    playerSelect.innerHTML = this.players.map(p => 
        `<option value="${p.id}" ${p.id === session.playerId ? 'selected' : ''}>${p.name}${p.number ? ` #${p.number}` : ''}</option>`
    ).join('');
    
    // Open modal
    document.getElementById('editSessionModal').classList.add('active');
    this.closeModal('detailModal');
};

RPETracker.prototype.handleEditSessionSubmit = function(e) {
    e.preventDefault();
    
    const sessionId = document.getElementById('editSessionId').value;
    const session = this.sessions.find(s => s.id === sessionId);
    
    if (!session) {
        alert('❌ Sesión no encontrada');
        return;
    }
    
    const dateValue = document.getElementById('editSessionDate').value;
    const timeOfDay = document.querySelector('input[name="editSessionTime"]:checked').value;
    const timeString = timeOfDay === 'morning' ? 'T10:00:00' : 'T18:00:00';
    const fullDateTime = dateValue + timeString;
    
    const rpe = parseInt(document.getElementById('editRpeSlider').value);
    const duration = parseInt(document.getElementById('editSessionDuration').value);
    const load = rpe * duration;
    
    // Update session
    session.date = fullDateTime;
    session.timeOfDay = timeOfDay;
    session.type = document.querySelector('input[name="editSessionType"]:checked').value;
    session.rpe = rpe;
    session.duration = duration;
    session.load = load;
    session.notes = document.getElementById('editSessionNotes').value;
    
    this.saveSessions();
    this.renderSessions();
    this.closeModal('editSessionModal');
    this.showToast('✅ Sesión actualizada correctamente');
};

RPETracker.prototype.updateEditRPEDisplay = function(value) {
    const rpeValue = parseInt(value);
    const color = this.getRPEColor(rpeValue);
    const label = this.getRPELabel(rpeValue);
    
    document.getElementById('editRpeValue').textContent = rpeValue;
    document.getElementById('editRpeValue').style.color = color;
    document.getElementById('editRpeLabel').textContent = label;
    
    const slider = document.getElementById('editRpeSlider');
    slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${rpeValue * 10}%, #ddd ${rpeValue * 10}%, #ddd 100%)`;
    
    // Update scale
    const rpeBar = document.getElementById('editRpeBar');
    let html = '';
    for (let i = 1; i <= 10; i++) {
        const barColor = i <= rpeValue ? this.getRPEColor(i) : '#e0e0e0';
        html += `<div style="flex: 1; height: 30px; background: ${barColor}; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: ${i <= rpeValue ? 'white' : '#999'};">${i}</div>`;
    }
    rpeBar.innerHTML = html;
};

// ========== EDIT PLAYERS ==========

RPETracker.prototype.editPlayer = function(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    
    document.getElementById('editPlayerId').value = player.id;
    document.getElementById('editPlayerName').value = player.name;
    document.getElementById('editPlayerNumber').value = player.number || '';
    
    document.getElementById('editPlayerModal').classList.add('active');
};

RPETracker.prototype.handleEditPlayerSubmit = function(e) {
    e.preventDefault();
    
    const playerId = document.getElementById('editPlayerId').value;
    const player = this.players.find(p => p.id === playerId);
    
    if (!player) {
        alert('❌ Jugadora no encontrada');
        return;
    }
    
    player.name = document.getElementById('editPlayerName').value;
    player.number = document.getElementById('editPlayerNumber').value || null;
    
    this.savePlayers();
    this.renderPlayers();
    this.renderSessions();
    this.populatePlayerSelects();
    this.closeModal('editPlayerModal');
    this.showToast('✅ Jugadora actualizada correctamente');
};

// ========== IMPROVED DELETE WITH CONFIRMATION ==========

RPETracker.prototype.deletePlayer = function(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;
    
    const playerSessions = this.sessions.filter(s => s.playerId === playerId);
    const sessionCount = playerSessions.length;
    
    const message = sessionCount > 0
        ? `¿Eliminar a ${player.name}${player.number ? ` #${player.number}` : ''}?\n\n⚠️ SE ELIMINARÁN ${sessionCount} SESIONES REGISTRADAS.\n\nEsta acción no se puede deshacer.`
        : `¿Eliminar a ${player.name}${player.number ? ` #${player.number}` : ''}?`;
    
    if (!confirm(message)) {
        return;
    }
    
    // Double confirmation if has sessions
    if (sessionCount > 0) {
        if (!confirm(`⚠️ ÚLTIMA CONFIRMACIÓN\n\n¿Estás SEGURA de eliminar ${sessionCount} sesiones de ${player.name}?`)) {
            return;
        }
    }
    
    this.players = this.players.filter(p => p.id !== playerId);
    this.sessions = this.sessions.filter(s => s.playerId !== playerId);
    
    this.savePlayers();
    this.saveSessions();
    this.renderPlayers();
    this.renderSessions();
    this.populatePlayerSelects();
    this.showToast(`🗑️ ${player.name} eliminada (${sessionCount} sesiones)`);
};

// ========== SEARCH AND FILTER ==========

RPETracker.prototype.setupSearchAndFilters = function() {
    const searchInput = document.getElementById('searchSessions');
    const sortSelect = document.getElementById('sortSessions');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const rpeMinInput = document.getElementById('rpeMin');
    const rpeMaxInput = document.getElementById('rpeMax');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => this.renderSessions());
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', () => this.renderSessions());
    }
    
    if (dateFromInput) dateFromInput.addEventListener('change', () => this.renderSessions());
    if (dateToInput) dateToInput.addEventListener('change', () => this.renderSessions());
    if (rpeMinInput) rpeMinInput.addEventListener('change', () => this.renderSessions());
    if (rpeMaxInput) rpeMaxInput.addEventListener('change', () => this.renderSessions());
};

RPETracker.prototype.getFilteredAndSortedSessions = function() {
    let filtered = [...this.sessions];
    
    // Player filter
    if (this.currentPlayerFilter !== 'all') {
        filtered = filtered.filter(s => s.playerId === this.currentPlayerFilter);
    }
    
    // Type filter
    if (this.currentTypeFilter !== 'all') {
        filtered = filtered.filter(s => s.type === this.currentTypeFilter);
    }
    
    // Search text
    const searchText = document.getElementById('searchSessions')?.value.toLowerCase();
    if (searchText) {
        filtered = filtered.filter(s => {
            const player = this.players.find(p => p.id === s.playerId);
            const playerName = player ? player.name.toLowerCase() : '';
            const notes = (s.notes || '').toLowerCase();
            return playerName.includes(searchText) || notes.includes(searchText);
        });
    }
    
    // Date range
    const dateFrom = document.getElementById('dateFrom')?.value;
    const dateTo = document.getElementById('dateTo')?.value;
    
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        filtered = filtered.filter(s => new Date(s.date) >= fromDate);
    }
    
    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59);
        filtered = filtered.filter(s => new Date(s.date) <= toDate);
    }
    
    // RPE range
    const rpeMin = document.getElementById('rpeMin')?.value;
    const rpeMax = document.getElementById('rpeMax')?.value;
    
    if (rpeMin) {
        filtered = filtered.filter(s => s.rpe >= parseInt(rpeMin));
    }
    
    if (rpeMax) {
        filtered = filtered.filter(s => s.rpe <= parseInt(rpeMax));
    }
    
    // Sort
    const sortBy = document.getElementById('sortSessions')?.value || 'date-desc';
    
    switch(sortBy) {
        case 'date-asc':
            filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'date-desc':
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'rpe-asc':
            filtered.sort((a, b) => a.rpe - b.rpe);
            break;
        case 'rpe-desc':
            filtered.sort((a, b) => b.rpe - a.rpe);
            break;
        case 'player':
            filtered.sort((a, b) => {
                const playerA = this.players.find(p => p.id === a.playerId);
                const playerB = this.players.find(p => p.id === b.playerId);
                const nameA = playerA ? playerA.name : '';
                const nameB = playerB ? playerB.name : '';
                return nameA.localeCompare(nameB);
            });
            break;
    }
    
    return filtered;
};

// ========== SESSION TEMPLATES ==========

RPETracker.prototype.loadTemplates = function() {
    const stored = localStorage.getItem('basketballTemplates');
    return stored ? JSON.parse(stored) : [];
};

RPETracker.prototype.saveTemplates = function() {
    localStorage.setItem('basketballTemplates', JSON.stringify(this.templates || []));
};

RPETracker.prototype.createTemplate = function() {
    const name = prompt('Nombre de la plantilla:\n(ej: "Entrenamiento técnico estándar")');
    if (!name) return;
    
    const rpe = parseInt(prompt('RPE típico (1-10):', '6'));
    const duration = parseInt(prompt('Duración en minutos:', '60'));
    const type = confirm('¿Es un PARTIDO?\n\nOK = Partido\nCancelar = Entrenamiento') ? 'match' : 'training';
    const timeOfDay = confirm('¿Cuándo suele ser?\n\nOK = Tarde\nCancelar = Mañana') ? 'afternoon' : 'morning';
    
    const template = {
        id: Date.now().toString(),
        name,
        rpe,
        duration,
        type,
        timeOfDay
    };
    
    if (!this.templates) this.templates = [];
    this.templates.push(template);
    this.saveTemplates();
    this.showToast(`✅ Plantilla "${name}" creada`);
};

RPETracker.prototype.applyTemplate = function(templateId) {
    const template = this.templates?.find(t => t.id === templateId);
    if (!template) return;
    
    document.getElementById('rpeSlider').value = template.rpe;
    this.updateRPEDisplay(template.rpe);
    
    document.getElementById('sessionDuration').value = template.duration;
    
    if (template.timeOfDay === 'morning') {
        document.getElementById('timeMorning').checked = true;
    } else {
        document.getElementById('timeAfternoon').checked = true;
    }
    
    if (template.type === 'training') {
        document.getElementById('typeTraining').checked = true;
    } else {
        document.getElementById('typeMatch').checked = true;
    }
    
    this.showToast(`📋 Plantilla "${template.name}" aplicada`);
};

// ========== ADVANCED STATISTICS ==========

RPETracker.prototype.calculateAdvancedStats = function(playerId) {
    const playerSessions = this.sessions
        .filter(s => s.playerId === playerId)
        .map(s => ({
            ...s,
            date: new Date(s.date),
            load: s.load || (s.rpe * (s.duration || 60))
        }))
        .sort((a, b) => a.date - b.date);
    
    if (playerSessions.length < 2) {
        return {
            monotony: 0,
            strain: 0,
            trainingImpulse: 0,
            variance: 0
        };
    }
    
    // Get last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const lastWeekSessions = playerSessions.filter(s => s.date >= sevenDaysAgo);
    
    if (lastWeekSessions.length === 0) {
        return {
            monotony: 0,
            strain: 0,
            trainingImpulse: 0,
            variance: 0
        };
    }
    
    // Calculate weekly load
    const weeklyLoad = lastWeekSessions.reduce((sum, s) => sum + s.load, 0);
    
    // Calculate mean load
    const meanLoad = weeklyLoad / lastWeekSessions.length;
    
    // Calculate standard deviation
    const variance = lastWeekSessions.reduce((sum, s) => {
        return sum + Math.pow(s.load - meanLoad, 2);
    }, 0) / lastWeekSessions.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Monotony = mean / stdDev (lower is better, means more variety)
    const monotony = stdDev > 0 ? meanLoad / stdDev : 0;
    
    // Strain = weekly load × monotony
    const strain = weeklyLoad * monotony;
    
    // Training Impulse (TRIMP approximation)
    const trainingImpulse = lastWeekSessions.reduce((sum, s) => {
        // Simplified TRIMP = duration × RPE
        return sum + (s.duration * s.rpe);
    }, 0);
    
    return {
        monotony: monotony.toFixed(2),
        strain: Math.round(strain),
        trainingImpulse: Math.round(trainingImpulse),
        variance: Math.round(variance),
        weeklyLoad: Math.round(weeklyLoad),
        meanLoad: Math.round(meanLoad),
        stdDev: Math.round(stdDev)
    };
};

// Initialize templates
document.addEventListener('DOMContentLoaded', () => {
    if (typeof rpeTracker !== 'undefined') {
        rpeTracker.templates = rpeTracker.loadTemplates();
    }
});

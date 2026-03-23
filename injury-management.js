// Basketball RPE Tracker - Injury Management & Return to Play

// ========== INJURY DATA MODEL ==========

class Injury {
    constructor(data) {
        this.id = data.id || Date.now().toString();
        this.playerId = data.playerId;
        this.type = data.type; // 'muscle', 'joint', 'bone', 'other'
        this.location = data.location; // 'ankle', 'knee', 'hamstring', etc.
        this.severity = data.severity; // 'minor', 'moderate', 'severe'
        this.startDate = data.startDate;
        this.endDate = data.endDate || null; // null if still injured
        this.description = data.description || '';
        this.rtpPhase = data.rtpPhase || 1; // Return to Play phase (1-6)
        this.rtpProgress = data.rtpProgress || 0; // 0-100%
        this.notes = data.notes || '';
        this.missedSessions = data.missedSessions || 0;
        this.status = data.status || 'active'; // 'active', 'recovered', 'recurring'
        this.timeline = data.timeline || this.calculateTimeline(data.severity);
        this.history = data.history || []; // Progress updates
    }
    
    calculateTimeline(severity) {
        // Estimated recovery days by severity
        const timelines = {
            'minor': { min: 3, max: 7 },
            'moderate': { min: 7, max: 21 },
            'severe': { min: 21, max: 90 }
        };
        return timelines[severity] || timelines['moderate'];
    }
    
    getDaysInjured() {
        const start = new Date(this.startDate);
        const end = this.endDate ? new Date(this.endDate) : new Date();
        return Math.ceil((end - start) / (1000 * 60 * 60 * 24));
    }
    
    getExpectedReturn() {
        if (this.endDate) return null;
        
        const start = new Date(this.startDate);
        const expectedDays = this.timeline.max;
        const returnDate = new Date(start);
        returnDate.setDate(returnDate.getDate() + expectedDays);
        return returnDate;
    }
}

// ========== RETURN TO PLAY PHASES ==========

const RTP_PHASES = {
    1: {
        name: 'Descanso y Recuperación',
        description: 'Sin actividad. Tratamiento médico y fisioterapia.',
        activities: ['Reposo', 'Fisioterapia', 'Movilidad pasiva'],
        loadRecommendation: { rpe: 0, duration: 0 },
        criteria: 'Sin dolor en reposo'
    },
    2: {
        name: 'Movilidad Activa',
        description: 'Ejercicios de movilidad sin carga.',
        activities: ['Movilidad activa', 'Ejercicios isométricos', 'Bicicleta estática'],
        loadRecommendation: { rpe: 2, duration: 20 },
        criteria: 'Movilidad completa sin dolor'
    },
    3: {
        name: 'Ejercicios con Carga Progresiva',
        description: 'Introducción de ejercicios con peso corporal.',
        activities: ['Sentadillas', 'Estocadas', 'Trabajo de fuerza básico'],
        loadRecommendation: { rpe: 3, duration: 30 },
        criteria: 'Fuerza >70% de la pierna sana'
    },
    4: {
        name: 'Ejercicios Específicos del Deporte',
        description: 'Movimientos propios del baloncesto sin contacto.',
        activities: ['Dribling', 'Tiro estático', 'Pases', 'Desplazamientos laterales'],
        loadRecommendation: { rpe: 4, duration: 45 },
        criteria: 'Sin dolor en movimientos específicos'
    },
    5: {
        name: 'Entrenamiento Modificado',
        description: 'Participación parcial en entrenamientos del equipo.',
        activities: ['Entrenamiento técnico', 'Juegos reducidos', 'Sin contacto'],
        loadRecommendation: { rpe: 5, duration: 60 },
        criteria: 'Completa ejercicios sin limitaciones'
    },
    6: {
        name: 'Retorno Completo',
        description: 'Participación completa sin restricciones.',
        activities: ['Entrenamiento completo', 'Contacto', 'Competición'],
        loadRecommendation: { rpe: 7, duration: 75 },
        criteria: 'Sin dolor, fuerza 100%, confianza total'
    }
};

// ========== INJURY MANAGEMENT SYSTEM ==========

RPETracker.prototype.initializeInjuryManagement = function() {
    this.injuries = this.loadInjuries();
    this.availability = this.loadAvailability();
};

RPETracker.prototype.loadInjuries = function() {
    const stored = localStorage.getItem('basketballInjuries');
    if (!stored) return [];
    
    const data = JSON.parse(stored);
    return data.map(d => new Injury(d));
};

RPETracker.prototype.saveInjuries = function() {
    localStorage.setItem('basketballInjuries', JSON.stringify(this.injuries));
};

RPETracker.prototype.loadAvailability = function() {
    const stored = localStorage.getItem('basketballAvailability');
    return stored ? JSON.parse(stored) : {};
};

RPETracker.prototype.saveAvailability = function() {
    localStorage.setItem('basketballAvailability', JSON.stringify(this.availability));
};

// ========== ADD/EDIT INJURY ==========

RPETracker.prototype.openAddInjuryModal = function(playerId = null) {
    const modal = document.createElement('div');
    modal.className = 'modal active';
    
    const playerOptions = this.players.map(p => 
        `<option value="${p.id}" ${p.id === playerId ? 'selected' : ''}>${p.name}${p.number ? ` #${p.number}` : ''}</option>`
    ).join('');
    
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>🏥 Registrar Lesión</h2>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
            <form id="injuryForm" style="padding: 1.5rem;">
                <div class="form-group">
                    <label>👤 Jugadora</label>
                    <select id="injuryPlayerId" required>
                        <option value="">Selecciona jugadora</option>
                        ${playerOptions}
                    </select>
                </div>
                
                <div class="form-group">
                    <label>🩹 Tipo de Lesión</label>
                    <select id="injuryType" required>
                        <option value="muscle">Muscular</option>
                        <option value="joint">Articular</option>
                        <option value="bone">Ósea</option>
                        <option value="tendon">Tendón/Ligamento</option>
                        <option value="other">Otra</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>📍 Localización</label>
                    <select id="injuryLocation" required>
                        <option value="ankle">Tobillo</option>
                        <option value="knee">Rodilla</option>
                        <option value="hamstring">Isquiotibiales</option>
                        <option value="quadriceps">Cuádriceps</option>
                        <option value="calf">Gemelos</option>
                        <option value="groin">Ingle</option>
                        <option value="back">Espalda</option>
                        <option value="shoulder">Hombro</option>
                        <option value="wrist">Muñeca</option>
                        <option value="finger">Dedos</option>
                        <option value="other">Otra</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>⚠️ Severidad</label>
                    <select id="injurySeverity" required onchange="rpeTracker.updateInjuryTimeline()">
                        <option value="minor">Leve (3-7 días)</option>
                        <option value="moderate">Moderada (1-3 semanas)</option>
                        <option value="severe">Grave (3+ semanas)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>📅 Fecha de Lesión</label>
                    <input type="date" id="injuryStartDate" required>
                </div>
                
                <div class="form-group">
                    <label>📝 Descripción</label>
                    <textarea id="injuryDescription" rows="3" placeholder="Describe cómo ocurrió la lesión..."></textarea>
                </div>
                
                <div id="injuryTimeline" style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                    <strong>Tiempo estimado de recuperación:</strong>
                    <p id="timelineText">3-7 días</p>
                </div>
                
                <div class="modal-footer">
                    <button type="button" onclick="this.closest('.modal').remove()" class="btn-secondary">Cancelar</button>
                    <button type="submit" class="btn-primary">💾 Guardar Lesión</button>
                </div>
            </form>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Set today as default
    document.getElementById('injuryStartDate').valueAsDate = new Date();
    
    // Form submit
    document.getElementById('injuryForm').addEventListener('submit', (e) => {
        e.preventDefault();
        this.saveNewInjury();
        modal.remove();
    });
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
};

RPETracker.prototype.updateInjuryTimeline = function() {
    const severity = document.getElementById('injurySeverity').value;
    const timelines = {
        'minor': '3-7 días',
        'moderate': '1-3 semanas (7-21 días)',
        'severe': '3+ semanas (21-90 días)'
    };
    
    document.getElementById('timelineText').textContent = timelines[severity] || '1-3 semanas';
};

RPETracker.prototype.saveNewInjury = function() {
    const injury = new Injury({
        playerId: document.getElementById('injuryPlayerId').value,
        type: document.getElementById('injuryType').value,
        location: document.getElementById('injuryLocation').value,
        severity: document.getElementById('injurySeverity').value,
        startDate: document.getElementById('injuryStartDate').value,
        description: document.getElementById('injuryDescription').value
    });
    
    this.injuries.push(injury);
    this.saveInjuries();
    this.renderInjuryManagement();
    this.showToast('🏥 Lesión registrada');
};

// ========== INJURY DASHBOARD ==========

RPETracker.prototype.renderInjuryManagement = function() {
    const container = document.getElementById('injuryManagementView');
    if (!container) return;
    
    const activeInjuries = this.injuries.filter(i => i.status === 'active');
    const recoveredInjuries = this.injuries.filter(i => i.status === 'recovered');
    
    // Calculate stats
    const totalMissedSessions = this.injuries.reduce((sum, i) => sum + i.missedSessions, 0);
    const currentlyInjured = activeInjuries.length;
    
    let html = `
        <div class="injury-header">
            <h2>🏥 Gestión de Lesiones</h2>
            <button onclick="rpeTracker.openAddInjuryModal()" class="btn-primary">+ Registrar Lesión</button>
        </div>
        
        <div class="stats-grid" style="margin: 2rem 0;">
            <div class="stat-card">
                <span class="stat-value" style="color: #f44336;">${currentlyInjured}</span>
                <span class="stat-label">Jugadoras Lesionadas</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" style="color: #ff9800;">${totalMissedSessions}</span>
                <span class="stat-label">Sesiones Perdidas Total</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" style="color: #4caf50;">${recoveredInjuries.length}</span>
                <span class="stat-label">Recuperaciones</span>
            </div>
            <div class="stat-card">
                <span class="stat-value" style="color: var(--primary);">${this.injuries.length}</span>
                <span class="stat-label">Total Lesiones</span>
            </div>
        </div>
    `;
    
    // Availability table
    html += this.renderAvailabilityTable();
    
    // Active injuries
    if (activeInjuries.length > 0) {
        html += '<h3 style="margin-top: 2rem;">🏥 Lesiones Activas</h3>';
        activeInjuries.forEach(injury => {
            html += this.renderInjuryCard(injury);
        });
    }
    
    // Recovered injuries
    if (recoveredInjuries.length > 0) {
        html += '<h3 style="margin-top: 2rem;">✅ Recuperadas</h3>';
        html += '<div style="display: grid; gap: 1rem;">';
        recoveredInjuries.slice(0, 5).forEach(injury => {
            html += this.renderCompactInjuryCard(injury);
        });
        html += '</div>';
    }
    
    container.innerHTML = html;
};

// ========== RENDER INJURY CARD ==========

RPETracker.prototype.renderInjuryCard = function(injury) {
    const player = this.players.find(p => p.id === injury.playerId);
    if (!player) return '';
    
    const daysInjured = injury.getDaysInjured();
    const expectedReturn = injury.getExpectedReturn();
    const daysRemaining = expectedReturn ? Math.ceil((expectedReturn - new Date()) / (1000 * 60 * 60 * 24)) : 0;
    
    const phase = RTP_PHASES[injury.rtpPhase];
    const progressPercent = injury.rtpProgress;
    
    const severityColors = {
        'minor': '#4caf50',
        'moderate': '#ff9800',
        'severe': '#f44336'
    };
    
    return `
        <div class="injury-card" style="background: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1); border-left: 5px solid ${severityColors[injury.severity]};">
            <div style="display: flex; justify-content: between; align-items: start; margin-bottom: 1rem;">
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 0.5rem 0;">${player.name}${player.number ? ` #${player.number}` : ''}</h3>
                    <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                        <span class="badge" style="background: ${severityColors[injury.severity]}; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
                            ${injury.severity === 'minor' ? 'Leve' : injury.severity === 'moderate' ? 'Moderada' : 'Grave'}
                        </span>
                        <span class="badge" style="background: #2196f3; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
                            ${this.getLocationName(injury.location)}
                        </span>
                        <span class="badge" style="background: #9c27b0; color: white; padding: 0.25rem 0.75rem; border-radius: 12px; font-size: 0.85rem;">
                            ${this.getTypeName(injury.type)}
                        </span>
                    </div>
                </div>
                <div style="text-align: right;">
                    <div style="font-size: 2rem; font-weight: bold; color: ${severityColors[injury.severity]};">
                        ${daysInjured}
                    </div>
                    <div style="font-size: 0.85rem; color: #666;">días lesionada</div>
                </div>
            </div>
            
            <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
                    <strong>Fase ${injury.rtpPhase}: ${phase.name}</strong>
                    <span style="color: var(--primary); font-weight: bold;">${progressPercent}%</span>
                </div>
                <div style="background: #ddd; height: 10px; border-radius: 5px; overflow: hidden;">
                    <div style="background: var(--primary); height: 100%; width: ${progressPercent}%; transition: width 0.3s;"></div>
                </div>
                <p style="margin-top: 0.5rem; font-size: 0.9rem; color: #666;">${phase.description}</p>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
                <div>
                    <strong style="font-size: 0.9rem; color: #666;">Sesiones perdidas:</strong>
                    <div style="font-size: 1.5rem; font-weight: bold;">${injury.missedSessions}</div>
                </div>
                <div>
                    <strong style="font-size: 0.9rem; color: #666;">Retorno estimado:</strong>
                    <div style="font-size: 1rem; font-weight: bold;">
                        ${expectedReturn ? `${daysRemaining > 0 ? daysRemaining + ' días' : 'Próximamente'}` : 'Recuperada'}
                    </div>
                </div>
            </div>
            
            ${injury.description ? `
                <div style="background: #fff9e6; padding: 0.75rem; border-radius: 6px; margin-bottom: 1rem;">
                    <strong style="font-size: 0.85rem;">📝 Descripción:</strong>
                    <p style="margin: 0.25rem 0 0 0; font-size: 0.9rem;">${injury.description}</p>
                </div>
            ` : ''}
            
            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button onclick="rpeTracker.updateRTPPhase('${injury.id}')" class="btn-primary" style="flex: 1;">
                    🔄 Actualizar Fase RTP
                </button>
                <button onclick="rpeTracker.showRTPProgram('${injury.id}')" class="btn-secondary" style="flex: 1;">
                    📋 Programa RTP
                </button>
                <button onclick="rpeTracker.markAsRecovered('${injury.id}')" class="btn-secondary" style="background: #4caf50; color: white;">
                    ✅ Marcar Recuperada
                </button>
            </div>
        </div>
    `;
};

// ========== RENDER COMPACT INJURY CARD ==========

RPETracker.prototype.renderCompactInjuryCard = function(injury) {
    const player = this.players.find(p => p.id === injury.playerId);
    if (!player) return '';
    
    const daysInjured = injury.getDaysInjured();
    
    return `
        <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
            <div>
                <strong>${player.name}</strong> - ${this.getLocationName(injury.location)}
                <br>
                <small style="color: #666;">
                    ${new Date(injury.startDate).toLocaleDateString('es-ES')} - 
                    ${injury.endDate ? new Date(injury.endDate).toLocaleDateString('es-ES') : 'Activa'}
                    (${daysInjured} días)
                </small>
            </div>
            <div style="text-align: right;">
                <div>${injury.missedSessions} sesiones</div>
                <small style="color: #666;">perdidas</small>
            </div>
        </div>
    `;
};

// Continue in next file...

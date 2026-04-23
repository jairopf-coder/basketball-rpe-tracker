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
    if (window.firebaseSync) {
        window.firebaseSync.saveInjuries(this.injuries);
    } else {
        localStorage.setItem('basketballInjuries', JSON.stringify(this.injuries));
    }
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
                    <select id="injurySeverity" required onchange="window.rpeTracker?.updateInjuryTimeline()">
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
                    <textarea id="injuryDescription" rows="2" placeholder="Describe cómo ocurrió la lesión..."></textarea>
                </div>

                <div class="form-group">
                    <label>⚡ Mecanismo lesional</label>
                    <select id="injuryMechanism">
                        <option value="">Sin especificar</option>
                        <option value="Contacto">Contacto (choque/caída)</option>
                        <option value="Sobreuso">Sobreuso / carga acumulada</option>
                        <option value="Fatiga">Fatiga muscular</option>
                        <option value="Reglamentario">Falta reglamentaria</option>
                        <option value="Gesto técnico">Gesto técnico / torsión</option>
                        <option value="Otro">Otro</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>🩹 Tratamiento inicial aplicado</label>
                    <input type="text" id="injuryInitialTreatment" placeholder="p.ej. Hielo 20min, vendaje funcional...">
                </div>

                <div class="form-group">
                    <label>😣 Dolor inicial (EVA): <strong id="injuryPainDisplay">5</strong>/10</label>
                    <input type="range" id="injuryPainLevel" min="0" max="10" value="5"
                           oninput="document.getElementById('injuryPainDisplay').textContent=this.value"
                           style="width:100%;margin-top:0.25rem">
                    <div style="display:flex;justify-content:space-between;font-size:0.72rem;color:var(--text-muted)">
                        <span>Sin dolor</span><span>Máximo</span>
                    </div>
                </div>

                <div id="injuryTimeline" style="background:var(--bg-subtle);padding:0.6rem 1rem;border-radius:8px;margin-top:0.5rem;font-size:0.88rem">
                    <strong>Tiempo estimado:</strong> <span id="timelineText">3-7 días</span>
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
        description: document.getElementById('injuryDescription').value,
        mechanism: document.getElementById('injuryMechanism')?.value || '',
        initialTreatment: document.getElementById('injuryInitialTreatment')?.value || '',
        painLevel: parseInt(document.getElementById('injuryPainLevel')?.value) || null
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

    const activeInjuries    = this.injuries.filter(i => i.status === 'active');
    const recoveredInjuries = this.injuries.filter(i => i.status === 'recovered');
    const totalMissed = this.injuries.reduce((s, i) => s + (i.missedSessions || 0), 0);
    const tab = this._injuryTab || 'activas';

    const statsBar = `
        <div class="inj-stats-bar">
            <div class="inj-stat"><span class="inj-stat-val" style="color:#f44336">${activeInjuries.length}</span><span class="inj-stat-lbl">Activas</span></div>
            <div class="inj-stat"><span class="inj-stat-val" style="color:#ff9800">${totalMissed}</span><span class="inj-stat-lbl">Sesiones perdidas</span></div>
            <div class="inj-stat"><span class="inj-stat-val" style="color:#4caf50">${recoveredInjuries.length}</span><span class="inj-stat-lbl">Recuperadas</span></div>
            <div class="inj-stat"><span class="inj-stat-val" style="color:var(--primary)">${this.injuries.length}</span><span class="inj-stat-lbl">Total</span></div>
        </div>`;

    const tabBar = `
        <div class="inj-tabs">
            <button class="inj-tab${tab==='activas'?' active':''}" onclick="window.rpeTracker?._setInjuryTab('activas')">
                🏥 Activas${activeInjuries.length ? ` <span class="inj-tab-badge">${activeInjuries.length}</span>` : ''}
            </button>
            <button class="inj-tab${tab==='historial'?' active':''}" onclick="window.rpeTracker?._setInjuryTab('historial')">
                📋 Historial
            </button>
            <button class="inj-tab${tab==='disponibilidad'?' active':''}" onclick="window.rpeTracker?._setInjuryTab('disponibilidad')">
                📅 Disponibilidad
            </button>
        </div>`;

    let tabContent = '';
    if (tab === 'activas') {
        tabContent = activeInjuries.length === 0
            ? '<div class="inj-empty">✅ Ninguna jugadora lesionada actualmente</div>'
            : activeInjuries.map(inj => this.renderInjuryCard(inj)).join('');
    } else if (tab === 'historial') {
        tabContent = recoveredInjuries.length === 0
            ? '<div class="inj-empty">Sin lesiones recuperadas registradas</div>'
            : `<div class="inj-history-grid">${recoveredInjuries.map(inj => this.renderCompactInjuryCard(inj)).join('')}</div>`;
    } else if (tab === 'disponibilidad') {
        tabContent = this.renderAvailabilityTable();
    }

    container.innerHTML = `
        <div class="inj-wrap">
            <div class="inj-header">
                <h2>🏥 Lesiones</h2>
                <button onclick="window.rpeTracker?.openAddInjuryModal()" class="btn-primary">+ Registrar</button>
            </div>
            ${statsBar}${tabBar}
            <div class="inj-tab-content">${tabContent}</div>
        </div>`;
};

RPETracker.prototype._setInjuryTab = function(tab) {
    this._injuryTab = tab;
    this.renderInjuryManagement();
};

// ========== RENDER INJURY CARD ==========

RPETracker.prototype.renderInjuryCard = function(injury) {
    const player = this.players.find(p => p.id === injury.playerId);
    if (!player) return '';

    const daysInjured     = injury.getDaysInjured();
    const expectedReturn  = injury.getExpectedReturn();
    const daysRemaining   = expectedReturn ? Math.ceil((expectedReturn - new Date()) / 86400000) : 0;
    const phase           = RTP_PHASES ? RTP_PHASES[injury.rtpPhase] : null;
    const progressPercent = injury.rtpProgress || 0;

    const sevColor = { minor:'#4caf50', moderate:'#ff9800', severe:'#f44336' };
    const sevLabel = { minor:'Leve', moderate:'Moderada', severe:'Grave' };
    const col = sevColor[injury.severity] || '#999';

    // RTP phase stepper
    const totalPhases = RTP_PHASES ? Object.keys(RTP_PHASES).length : 5;
    const curPhase = parseInt(injury.rtpPhase) || 1;
    const stepperHTML = Array.from({length: totalPhases}, (_, i) => {
        const n = i + 1;
        const isDone   = n < curPhase;
        const isActive = n === curPhase;
        const pName    = RTP_PHASES?.[n]?.name || '';
        return `<div class="rtp-step${isDone?' rtp-done':''}${isActive?' rtp-active':''}" title="Fase ${n}${pName?' — '+pName:''}">${isDone?'✓':n}</div>${n<totalPhases?'<div class="rtp-conn"></div>':''}`;
    }).join('');

    const painColor = injury.painLevel > 6 ? '#f44336' : injury.painLevel > 3 ? '#ff9800' : '#4caf50';

    return `
        <div class="inj-card" style="border-left:4px solid ${col}">
            <div class="inj-card-top">
                <div class="inj-card-player">
                    ${typeof PlayerTokens !== 'undefined' ? PlayerTokens.avatar(player, 28, '0.75rem') : `<div style="width:28px;height:28px;border-radius:50%;background:${player.color||col};display:flex;align-items:center;justify-content:center;font-size:0.75rem;color:#fff;font-weight:600">${player.name.charAt(0)}</div>`}
                    <div>
                        <div class="inj-card-name">${player.name}${player.number ? ` <span class="inj-num">#${player.number}</span>` : ''}</div>
                        <div class="inj-card-badges">
                            <span class="inj-badge" style="background:${col}">${sevLabel[injury.severity]||'—'}</span>
                            <span class="inj-badge inj-badge-blue">${this.getLocationName(injury.location)}</span>
                            <span class="inj-badge inj-badge-purple">${this.getTypeName(injury.type)}</span>
                            ${injury.mechanism ? `<span class="inj-badge inj-badge-gray">${injury.mechanism}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div class="inj-card-days">
                    <span class="inj-days-num" style="color:${col}">${daysInjured}</span>
                    <span class="inj-days-lbl">días</span>
                </div>
            </div>

            <div class="rtp-stepper-wrap">
                <div class="rtp-stepper">${stepperHTML}</div>
                <div class="rtp-phase-label">Fase ${curPhase}${phase ? ' — ' + phase.name : ''} · <strong>${progressPercent}%</strong></div>
                <div class="rtp-track"><div class="rtp-fill" style="width:${progressPercent}%;background:${col}"></div></div>
            </div>

            <div class="inj-card-meta">
                <div><span class="inj-meta-lbl">Sesiones perdidas</span><span class="inj-meta-val">${injury.missedSessions||0}</span></div>
                <div><span class="inj-meta-lbl">Retorno estimado</span><span class="inj-meta-val">${expectedReturn ? (daysRemaining > 0 ? daysRemaining + ' días' : 'Próximamente') : '—'}</span></div>
                ${injury.painLevel != null ? `<div><span class="inj-meta-lbl">Dolor EVA</span><span class="inj-meta-val" style="color:${painColor}">${injury.painLevel}/10</span></div>` : ''}
            </div>

            ${injury.description ? `<div class="inj-desc">📝 ${injury.description}</div>` : ''}
            ${injury.initialTreatment ? `<div class="inj-desc" style="background:var(--bg-subtle)">🩹 ${injury.initialTreatment}</div>` : ''}

            <div class="inj-card-actions">
                <button onclick="window.rpeTracker?.updateRTPPhase('${injury.id}')" class="btn-primary" style="flex:1">🔄 Actualizar Fase</button>
                <button onclick="window.rpeTracker?.showRTPProgram('${injury.id}')" class="btn-secondary" style="flex:1">📋 Programa</button>
                <button onclick="window.rpeTracker?.markAsRecovered('${injury.id}')" class="btn-secondary" style="color:#4caf50;border-color:#4caf50">✅ Alta</button>
            </div>
        </div>`;
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

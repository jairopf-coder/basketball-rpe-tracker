// Basketball RPE Tracker - Injury Management Part 2
// RTP Program, Availability, Progress Tracking

// ========== AVAILABILITY TABLE ==========

RPETracker.prototype.renderAvailabilityTable = function() {
    const today = new Date();
    const next7Days = [];
    
    for (let i = 0; i < 7; i++) {
        const date = new Date(today);
        date.setDate(today.getDate() + i);
        next7Days.push(date);
    }
    
    let html = `
        <div class="availability-section" style="background: white; padding: 1.5rem; border-radius: 12px; margin: 2rem 0; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
            <h3>📅 Disponibilidad Próximos 7 Días</h3>
            <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; margin-top: 1rem;">
                    <thead>
                        <tr style="background: #f5f5f5;">
                            <th style="padding: 0.75rem; text-align: left; border-bottom: 2px solid #ddd;">Jugadora</th>
                            ${next7Days.map(date => `
                                <th style="padding: 0.75rem; text-align: center; border-bottom: 2px solid #ddd;">
                                    <div>${date.toLocaleDateString('es-ES', { weekday: 'short' })}</div>
                                    <div style="font-size: 0.85rem; color: #666;">${date.getDate()}/${date.getMonth() + 1}</div>
                                </th>
                            `).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${this.players.map(player => this.renderAvailabilityRow(player, next7Days)).join('')}
                    </tbody>
                </table>
            </div>
            <div style="display: flex; gap: 1rem; margin-top: 1rem; font-size: 0.85rem;">
                <span>✅ Disponible</span>
                <span style="color: #ff9800;">⚠️ Limitada</span>
                <span style="color: #f44336;">🏥 Lesionada</span>
                <span style="color: #2196f3;">📋 RTP</span>
            </div>
        </div>
    `;
    
    return html;
};

RPETracker.prototype.renderAvailabilityRow = function(player, dates) {
    const activeInjury = this.injuries.find(i => i.playerId === player.id && i.status === 'active');
    
    let row = `
        <tr style="border-bottom: 1px solid #eee;">
            <td style="padding: 0.75rem; font-weight: 600;">
                ${player.name}${player.number ? ` #${player.number}` : ''}
            </td>
    `;
    
    dates.forEach(date => {
        const dateKey = date.toISOString().split('T')[0];
        const availability = this.availability[player.id]?.[dateKey];
        
        let icon = '✅';
        let color = '#4caf50';
        let title = 'Disponible';
        
        if (activeInjury) {
            if (activeInjury.rtpPhase >= 5) {
                icon = '📋';
                color = '#2196f3';
                title = `RTP Fase ${activeInjury.rtpPhase}`;
            } else {
                icon = '🏥';
                color = '#f44336';
                title = 'Lesionada';
            }
        } else if (availability === 'limited') {
            icon = '⚠️';
            color = '#ff9800';
            title = 'Disponibilidad limitada';
        } else if (availability === 'unavailable') {
            icon = '❌';
            color = '#f44336';
            title = 'No disponible';
        }
        
        row += `
            <td style="padding: 0.75rem; text-align: center; cursor: pointer;" 
                onclick="window.rpeTracker?.toggleAvailability('${player.id}', '${dateKey}')"
                title="${title}">
                <span style="font-size: 1.5rem; color: ${color};">${icon}</span>
            </td>
        `;
    });
    
    row += '</tr>';
    return row;
};

RPETracker.prototype.toggleAvailability = function(playerId, dateKey) {
    if (!this.availability[playerId]) {
        this.availability[playerId] = {};
    }
    
    const current = this.availability[playerId][dateKey];
    
    // Cycle through: null (available) → limited → unavailable → available
    if (!current) {
        this.availability[playerId][dateKey] = 'limited';
    } else if (current === 'limited') {
        this.availability[playerId][dateKey] = 'unavailable';
    } else {
        delete this.availability[playerId][dateKey];
    }
    
    this.saveAvailability();
    this.renderInjuryManagement();
};

// ========== UPDATE RTP PHASE ==========

RPETracker.prototype.updateRTPPhase = function(injuryId) {
    const injury = this.injuries.find(i => i.id === injuryId);
    if (!injury) return;

    const player = this.players.find(p => p.id === injury.playerId);
    const currentPhase = RTP_PHASES[injury.rtpPhase];

    // Retrieve last saved criteriaChecks for current phase
    const lastChecks = (injury.history || []).slice().reverse()
        .find(h => h.criteriaChecks && Array.isArray(h.criteriaChecks))?.criteriaChecks || [];
    const checkedSet = new Set(lastChecks);

    const buildCriteriaHTML = (phaseNum) => {
        const ph = RTP_PHASES[phaseNum];
        if (!ph?.criteria?.conditions) return '';
        const minReq = ph.criteria.minConditions || ph.criteria.conditions.length;
        return `
        <div class="form-group" id="criteriaBlock">
            <label style="margin-bottom:0.5rem;display:block">📋 Criterios para avanzar a Fase ${parseInt(phaseNum)+1} <span style="font-weight:400;color:var(--text-muted)">(mín. ${minReq} de ${ph.criteria.conditions.length})</span></label>
            <div class="inj-criteria-checklist" id="criteriaChecklist">
                ${ph.criteria.conditions.map(c => `
                <label class="inj-criteria-check-row ${checkedSet.has(c.id) ? 'checked' : ''}">
                    <input type="checkbox" name="rtpCriteria" value="${c.id}" ${checkedSet.has(c.id) ? 'checked' : ''} onchange="window.rpeTracker?._onCriteriaChange('${phaseNum}')">
                    <span>${c.label}</span>
                </label>`).join('')}
            </div>
            <div id="criteriaStatus" class="inj-criteria-status"></div>
        </div>`;
    };

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2>🔄 Actualizar Fase RTP — ${player.name}</h2>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
            <div style="padding:1.5rem">
                <div style="background:var(--bg-subtle);padding:1rem;border-radius:8px;margin-bottom:1rem">
                    <strong>Fase Actual: ${injury.rtpPhase} — ${currentPhase.name}</strong>
                    <p style="margin-top:0.5rem;color:var(--text-muted)">${currentPhase.description}</p>
                </div>

                <div class="form-group">
                    <label>Nueva Fase</label>
                    <select id="newRTPPhase" class="filter-select">
                        ${Object.keys(RTP_PHASES).map(phaseNum => `
                            <option value="${phaseNum}" ${phaseNum == injury.rtpPhase ? 'selected' : ''}>
                                Fase ${phaseNum}: ${RTP_PHASES[phaseNum].name}
                            </option>`).join('')}
                    </select>
                </div>

                <div class="form-group">
                    <label>Progreso en esta Fase (%)</label>
                    <div style="display:flex;align-items:center;gap:1rem">
                        <input type="range" id="rtpProgress" min="0" max="100" value="${injury.rtpProgress}"
                               style="flex:1" oninput="document.getElementById('progressValue').textContent=this.value+'%'">
                        <span id="progressValue" style="font-weight:bold;min-width:50px">${injury.rtpProgress}%</span>
                    </div>
                </div>

                ${buildCriteriaHTML(injury.rtpPhase)}

                <div class="form-group">
                    <label>Notas de Progreso</label>
                    <textarea id="rtpNotes" rows="3" placeholder="Estado actual, pruebas superadas, próximos pasos..."></textarea>
                </div>

                <div id="phaseInfo" style="background:var(--bg-subtle);padding:1rem;border-radius:8px;margin-top:1rem"></div>

                <div class="modal-footer">
                    <button onclick="this.closest('.modal').remove()" class="btn-secondary">Cancelar</button>
                    <button id="saveRTPBtn" onclick="window.rpeTracker?.saveRTPUpdate('${injuryId}');this.closest('.modal').remove();"
                            class="btn-primary">💾 Guardar Actualización</button>
                </div>
            </div>
        </div>`;

    document.body.appendChild(modal);

    const updatePhaseInfo = () => {
        const phaseNum = document.getElementById('newRTPPhase').value;
        const ph = RTP_PHASES[phaseNum];
        // Rebuild criteria when phase selector changes
        const criteriaBlock = document.getElementById('criteriaBlock');
        if (criteriaBlock) {
            criteriaBlock.outerHTML = buildCriteriaHTML(phaseNum) || '';
        }
        document.getElementById('phaseInfo').innerHTML = `
            <strong>Actividades recomendadas:</strong>
            <ul style="margin:0.5rem 0 0 1.5rem">${ph.activities.map(a => `<li>${a}</li>`).join('')}</ul>
            <p style="margin-top:0.5rem"><strong>Carga recomendada:</strong> RPE ${ph.loadRecommendation.rpe} × ${ph.loadRecommendation.duration} min</p>`;
        this._onCriteriaChange(phaseNum);
    };

    document.getElementById('newRTPPhase').addEventListener('change', updatePhaseInfo);
    updatePhaseInfo();

    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
};

RPETracker.prototype._onCriteriaChange = function(phaseNum) {
    const ph = RTP_PHASES[phaseNum];
    if (!ph?.criteria?.conditions) return;
    const checkboxes = document.querySelectorAll('#criteriaChecklist input[type=checkbox]');
    const checkedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
    const total   = ph.criteria.conditions.length;
    const minReq  = ph.criteria.minConditions || total;
    const ready   = checkedCount >= minReq;
    const status  = document.getElementById('criteriaStatus');
    const saveBtn = document.getElementById('saveRTPBtn');
    if (status) {
        status.textContent = ready
            ? `✅ ${checkedCount}/${total} criterios cumplidos — listo para avanzar`
            : `⬜ ${checkedCount}/${total} criterios — se necesitan ${minReq} para avanzar (puedes guardar igualmente)`;
        status.style.color = ready ? '#4caf50' : '#ff9800';
    }
    // Visually highlight save button when ready but never disable it
    if (saveBtn) {
        saveBtn.style.background = ready ? '#4caf50' : '';
    }
    // Update row styling
    document.querySelectorAll('.inj-criteria-check-row').forEach(row => {
        const cb = row.querySelector('input');
        row.classList.toggle('checked', cb?.checked || false);
    });
};

RPETracker.prototype.saveRTPUpdate = function(injuryId) {
    const injury = this.injuries.find(i => i.id === injuryId);
    if (!injury) return;

    const newPhase    = parseInt(document.getElementById('newRTPPhase').value);
    const newProgress = parseInt(document.getElementById('rtpProgress').value);
    const notes       = document.getElementById('rtpNotes').value;

    // Collect criteria checks
    const criteriaChecks = Array.from(
        document.querySelectorAll('#criteriaChecklist input[type=checkbox]:checked')
    ).map(cb => cb.value);

    injury.history.push({
        date: new Date().toISOString(),
        phase: newPhase,
        progress: newProgress,
        notes,
        criteriaChecks
    });

    injury.rtpPhase    = newPhase;
    injury.rtpProgress = newProgress;

    if (notes) {
        injury.notes = (injury.notes ? injury.notes + '\n\n' : '') +
                       `[${new Date().toLocaleDateString('es-ES')}] ${notes}`;
    }

    this.saveInjuries();
    this.renderInjuryManagement();
    this.showToast('🔄 Fase RTP actualizada');
};

// ========== RTP PROGRAM VIEW ==========

RPETracker.prototype.showRTPProgram = function(injuryId) {
    const injury = this.injuries.find(i => i.id === injuryId);
    if (!injury) return;
    
    const player = this.players.find(p => p.id === injury.playerId);
    
    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 900px;">
            <div class="modal-header">
                <h2>📋 Programa Return to Play - ${player.name}</h2>
                <button onclick="this.closest('.modal').remove()" class="btn-close">&times;</button>
            </div>
            <div style="padding: 1.5rem; max-height: 70vh; overflow-y: auto;">
                <div style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-bottom: 1.5rem;">
                    <strong>Lesión:</strong> ${this.getTypeName(injury.type)} - ${this.getLocationName(injury.location)}<br>
                    <strong>Severidad:</strong> ${injury.severity === 'minor' ? 'Leve' : injury.severity === 'moderate' ? 'Moderada' : 'Grave'}<br>
                    <strong>Fase Actual:</strong> ${injury.rtpPhase} de 6<br>
                    <strong>Días desde lesión:</strong> ${injury.getDaysInjured()}
                </div>
                
                ${this.renderRTPPhases(injury)}
                
                ${this.renderWeeklyRTPPlan(injury)}
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.addEventListener('click', (e) => {
        if (e.target === modal) modal.remove();
    });
};

RPETracker.prototype.renderRTPPhases = function(injury) {
    let html = '<h3>Fases del Return to Play</h3>';
    
    Object.keys(RTP_PHASES).forEach(phaseNum => {
        const phase = RTP_PHASES[phaseNum];
        const isCurrent = phaseNum == injury.rtpPhase;
        const isCompleted = phaseNum < injury.rtpPhase;
        
        let statusColor = '#ddd';
        let statusIcon = '⭕';
        
        if (isCompleted) {
            statusColor = '#4caf50';
            statusIcon = '✅';
        } else if (isCurrent) {
            statusColor = '#ff9800';
            statusIcon = '🔄';
        }
        
        html += `
            <div style="background: ${isCurrent ? '#fff9e6' : 'white'}; border: 2px solid ${statusColor}; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <div style="display: flex; align-items: start; gap: 1rem;">
                    <div style="font-size: 2rem;">${statusIcon}</div>
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 0.5rem 0;">Fase ${phaseNum}: ${phase.name}</h4>
                        <p style="color: #666; margin: 0 0 0.5rem 0;">${phase.description}</p>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-top: 0.75rem;">
                            <div>
                                <strong style="font-size: 0.85rem;">Actividades:</strong>
                                <ul style="margin: 0.25rem 0 0 1.25rem; font-size: 0.9rem;">
                                    ${phase.activities.map(a => `<li>${a}</li>`).join('')}
                                </ul>
                            </div>
                            <div>
                                <strong style="font-size: 0.85rem;">Carga recomendada:</strong>
                                <div style="background: var(--primary); color: white; padding: 0.5rem; border-radius: 4px; margin-top: 0.25rem; text-align: center;">
                                    RPE ${phase.loadRecommendation.rpe} × ${phase.loadRecommendation.duration}min
                                </div>
                                <div style="margin-top: 0.5rem; font-size: 0.85rem;">
                                    <strong>Criterio:</strong> ${phase.criteria}
                                </div>
                            </div>
                        </div>
                        
                        ${isCurrent ? `
                            <div style="background: white; padding: 0.75rem; border-radius: 4px; margin-top: 0.75rem;">
                                <div style="display: flex; justify-content: space-between; margin-bottom: 0.25rem;">
                                    <strong>Progreso:</strong>
                                    <span>${injury.rtpProgress}%</span>
                                </div>
                                <div style="background: #ddd; height: 8px; border-radius: 4px; overflow: hidden;">
                                    <div style="background: ${statusColor}; height: 100%; width: ${injury.rtpProgress}%;"></div>
                                </div>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        `;
    });
    
    return html;
};

RPETracker.prototype.renderWeeklyRTPPlan = function(injury) {
    const currentPhase = RTP_PHASES[injury.rtpPhase];
    const weeksInPhase = {1: 0.5, 2: 1, 3: 2, 4: 2, 5: 2, 6: 1};
    const totalWeeks = weeksInPhase[injury.rtpPhase] || 2;
    
    let html = `
        <h3 style="margin-top: 2rem;">📅 Planificación Semanal - Fase ${injury.rtpPhase}</h3>
        <p style="color: #666;">Duración estimada: ${totalWeeks} ${totalWeeks === 1 ? 'semana' : 'semanas'}</p>
    `;
    
    for (let week = 1; week <= Math.ceil(totalWeeks); week++) {
        const baseRPE = currentPhase.loadRecommendation.rpe;
        const baseDuration = currentPhase.loadRecommendation.duration;
        
        // Progressive load increase within phase
        const weekMultiplier = 0.7 + (week / totalWeeks) * 0.3; // Start at 70%, end at 100%
        const weekRPE = Math.round(baseRPE * weekMultiplier);
        const weekDuration = Math.round(baseDuration * weekMultiplier);
        
        html += `
            <div style="background: white; border: 1px solid #ddd; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
                <h4>Semana ${week}</h4>
                <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; margin-top: 0.75rem;">
        `;
        
        ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].forEach((day, index) => {
            const isRestDay = index === 6 || index === 3; // Sunday and Thursday rest
            
            html += `
                <div style="background: ${isRestDay ? '#f5f5f5' : '#e8f5e9'}; padding: 0.5rem; border-radius: 4px; text-align: center; font-size: 0.85rem;">
                    <strong>${day}</strong><br>
                    ${isRestDay ? '😴 Descanso' : `
                        <div style="margin-top: 0.25rem;">
                            RPE ${weekRPE}<br>
                            ${weekDuration}min
                        </div>
                    `}
                </div>
            `;
        });
        
        html += `
                </div>
                <div style="margin-top: 0.75rem; padding: 0.75rem; background: #f5f5f5; border-radius: 4px; font-size: 0.9rem;">
                    <strong>Enfoque:</strong> ${currentPhase.activities.join(', ')}<br>
                    <strong>Carga semanal estimada:</strong> ~${weekRPE * weekDuration * 5} unidades (5 sesiones)
                </div>
            </div>
        `;
    }
    
    return html;
};

// ========== MARK AS RECOVERED ==========

RPETracker.prototype.markAsRecovered = function(injuryId) {
    const injury = this.injuries.find(i => i.id === injuryId);
    if (!injury) return;
    
    if (!confirm('¿Marcar como recuperada?\n\nEsto cerrará el proceso de RTP.')) return;
    
    injury.status = 'recovered';
    injury.endDate = new Date().toISOString().split('T')[0];
    injury.rtpPhase = 6;
    injury.rtpProgress = 100;
    
    injury.history.push({
        date: new Date().toISOString(),
        phase: 6,
        progress: 100,
        notes: 'Recuperación completa - Return to Play exitoso'
    });
    
    this.saveInjuries();
    this.renderInjuryManagement();
    this.showToast('✅ Jugadora marcada como recuperada');
};

// ========== HELPER FUNCTIONS ==========

RPETracker.prototype.getTypeName = function(type) {
    const types = {
        'muscle': 'Muscular',
        'joint': 'Articular',
        'bone': 'Ósea',
        'tendon': 'Tendón/Ligamento',
        'other': 'Otra'
    };
    return types[type] || type;
};

RPETracker.prototype.getLocationName = function(location) {
    const locations = {
        'ankle': 'Tobillo',
        'knee': 'Rodilla',
        'hamstring': 'Isquiotibiales',
        'quadriceps': 'Cuádriceps',
        'calf': 'Gemelos',
        'groin': 'Ingle',
        'back': 'Espalda',
        'shoulder': 'Hombro',
        'wrist': 'Muñeca',
        'finger': 'Dedos',
        'other': 'Otra'
    };
    return locations[location] || location;
};

// Auto-calculate missed sessions
RPETracker.prototype.updateMissedSessions = function() {
    if (!this.injuries || !this.sessions) return;
    
    this.injuries.forEach(injury => {
        if (injury.status !== 'active') return;
        
        const startDate = new Date(injury.startDate);
        const endDate = injury.endDate ? new Date(injury.endDate) : new Date();
        
        // Count sessions of other players in this period
        const totalSessionsInPeriod = this.sessions.filter(s => {
            const sessionDate = new Date(s.date);
            return sessionDate >= startDate && sessionDate <= endDate && s.playerId !== injury.playerId;
        }).length;
        
        // Estimate missed sessions (assuming similar attendance)
        const avgSessionsPerPlayer = totalSessionsInPeriod / Math.max(this.players.length - 1, 1);
        injury.missedSessions = Math.round(avgSessionsPerPlayer > 0 ? avgSessionsPerPlayer : 0);
    });
    
    this.saveInjuries();
};

// Initialize on load
document.addEventListener('DOMContentLoaded', () => {
    if (typeof rpeTracker !== 'undefined' && rpeTracker.initializeInjuryManagement) {
        rpeTracker.initializeInjuryManagement();
    }
});

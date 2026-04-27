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
        criteria: {
            summary: 'Sin dolor en reposo',
            minConditions: 2,
            conditions: [
                { id: 'p1c1', label: 'Sin dolor en reposo (EVA = 0)' },
                { id: 'p1c2', label: 'Inflamación/edema controlado' },
                { id: 'p1c3', label: 'Aprobación médica para iniciar movilidad' }
            ]
        }
    },
    2: {
        name: 'Movilidad Activa',
        description: 'Ejercicios de movilidad sin carga.',
        activities: ['Movilidad activa', 'Ejercicios isométricos', 'Bicicleta estática'],
        loadRecommendation: { rpe: 2, duration: 20 },
        criteria: {
            summary: 'Movilidad completa sin dolor',
            minConditions: 3,
            conditions: [
                { id: 'p2c1', label: 'Rango de movimiento completo (ROM ≥ 90% contralateral)' },
                { id: 'p2c2', label: 'Sin dolor en movilidad activa (EVA ≤ 1)' },
                { id: 'p2c3', label: 'Isométricos sin compensación ni dolor' },
                { id: 'p2c4', label: 'Marcha normal sin cojera' }
            ]
        }
    },
    3: {
        name: 'Ejercicios con Carga Progresiva',
        description: 'Introducción de ejercicios con peso corporal.',
        activities: ['Sentadillas', 'Estocadas', 'Trabajo de fuerza básico'],
        loadRecommendation: { rpe: 3, duration: 30 },
        criteria: {
            summary: 'Fuerza >70% miembro sano',
            minConditions: 3,
            conditions: [
                { id: 'p3c1', label: 'Fuerza muscular >70% del miembro contralateral (dinamómetro o test manual)' },
                { id: 'p3c2', label: 'Sentadilla monopodal sin dolor ni compensación' },
                { id: 'p3c3', label: 'Sin dolor durante ni 24h post-ejercicio (EVA ≤ 2)' },
                { id: 'p3c4', label: 'Equilibrio monopodal ≥ 20 segundos' }
            ]
        }
    },
    4: {
        name: 'Ejercicios Específicos del Deporte',
        description: 'Movimientos propios del baloncesto sin contacto.',
        activities: ['Dribling', 'Tiro estático', 'Pases', 'Desplazamientos laterales'],
        loadRecommendation: { rpe: 4, duration: 45 },
        criteria: {
            summary: 'Sin dolor en gestos específicos de baloncesto',
            minConditions: 3,
            conditions: [
                { id: 'p4c1', label: 'Carrera continua 10 min sin dolor ni cojera' },
                { id: 'p4c2', label: 'Cambios de dirección y pivotes sin dolor (EVA = 0)' },
                { id: 'p4c3', label: 'Salto y aterrizaje bilateral sin asimetría visible' },
                { id: 'p4c4', label: 'Dribling y gestos técnicos a velocidad moderada sin molestias' }
            ]
        }
    },
    5: {
        name: 'Entrenamiento Modificado',
        description: 'Participación parcial en entrenamientos del equipo.',
        activities: ['Entrenamiento técnico', 'Juegos reducidos', 'Sin contacto'],
        loadRecommendation: { rpe: 5, duration: 60 },
        criteria: {
            summary: 'Completa sesiones de equipo sin limitaciones funcionales',
            minConditions: 4,
            conditions: [
                { id: 'p5c1', label: 'Completa entrenamiento completo sin restricciones de carga' },
                { id: 'p5c2', label: 'Confianza plena de la jugadora en el gesto lesionado' },
                { id: 'p5c3', label: 'Ratio A:C en zona óptima (0.8–1.3) durante 7 días' },
                { id: 'p5c4', label: 'Sin dolor ni inflamación post-entrenamiento' },
                { id: 'p5c5', label: 'Aval del cuerpo médico para competición' }
            ]
        }
    },
    6: {
        name: 'Retorno Completo',
        description: 'Participación completa sin restricciones.',
        activities: ['Entrenamiento completo', 'Contacto', 'Competición'],
        loadRecommendation: { rpe: 7, duration: 75 },
        criteria: {
            summary: 'Sin dolor, fuerza 100%, confianza total',
            minConditions: 3,
            conditions: [
                { id: 'p6c1', label: 'Sin dolor en ningún gesto deportivo (EVA = 0)' },
                { id: 'p6c2', label: 'Fuerza ≥ 90% miembro contralateral' },
                { id: 'p6c3', label: 'La jugadora se siente lista para competir' }
            ]
        }
    }
};

// ========== INJURY MANAGEMENT SYSTEM ==========

// ---- A:C chart data for 4 weeks prior to injury date ----
RPETracker.prototype._getACDataForInjury = function(injury) {
    const MATCH_MULT = RPETracker.MATCH_LOAD_MULTIPLIER || 1.5;
    const injuryDate = new Date(injury.startDate);
    injuryDate.setHours(0, 0, 0, 0);

    const playerSessions = (this.sessions || [])
        .filter(s => s.playerId === injury.playerId)
        .map(s => ({
            ...s,
            date: new Date(s.date),
            load: (s.load || (s.rpe * (s.duration || 60))) * (s.type === 'match' ? MATCH_MULT : 1)
        }))
        .filter(s => s.date <= injuryDate);

    const lambdaAcute   = 2 / (7 + 1);
    const lambdaChronic = 2 / (28 + 1);

    // Seed from all available history before injury
    const allLoads = playerSessions.map(s => s.load);
    const seedLoad = allLoads.length > 0 ? allLoads.reduce((a, b) => a + b, 0) / allLoads.length : 0;
    let ewmaAcute   = seedLoad;
    let ewmaChronic = seedLoad;

    // Walk day by day over the 28 days before injury (+ seed 28 more days for chronic warmup)
    const WARMUP_DAYS = 28;
    const WINDOW_DAYS = 28; // 4 weeks to display
    const labels = [];
    const ratioData = [];
    const sessionDays = []; // indices with real sessions

    for (let i = WARMUP_DAYS + WINDOW_DAYS; i >= 0; i--) {
        const d = new Date(injuryDate);
        d.setDate(injuryDate.getDate() - i);
        d.setHours(0, 0, 0, 0);

        const dailySessions = playerSessions.filter(s => {
            const sd = new Date(s.date); sd.setHours(0, 0, 0, 0);
            return sd.getTime() === d.getTime();
        });
        const dailyLoad = dailySessions.reduce((sum, s) => sum + s.load, 0);

        ewmaAcute   = (lambdaAcute   * dailyLoad) + ((1 - lambdaAcute)   * ewmaAcute);
        ewmaChronic = (lambdaChronic * dailyLoad) + ((1 - lambdaChronic) * ewmaChronic);
        const ratio = ewmaChronic > 0 ? ewmaAcute / ewmaChronic : 0;

        // Only collect display window (last WINDOW_DAYS)
        if (i <= WINDOW_DAYS) {
            labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
            ratioData.push(parseFloat(ratio.toFixed(3)));
            if (dailySessions.length > 0) sessionDays.push(labels.length - 1);
        }
    }

    // Check minimum data requirement
    const sessionsInWindow = playerSessions.filter(s => {
        const sd = new Date(s.date); sd.setHours(0, 0, 0, 0);
        const windowStart = new Date(injuryDate); windowStart.setDate(injuryDate.getDate() - WINDOW_DAYS);
        return sd >= windowStart && sd <= injuryDate;
    });

    return { labels, ratioData, sessionDays, sessionsInWindow: sessionsInWindow.length };
};

RPETracker.prototype._renderInjuryACChart = function(injury) {
    const canvasId = `acInjuryChart_${injury.id}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    const { labels, ratioData, sessionDays, sessionsInWindow } = this._getACDataForInjury(injury);
    if (sessionsInWindow < 3) return; // not enough data — placeholder already shown

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#aaa' : '#666';
    const sevColors = { minor: '#4caf50', moderate: '#ff9800', severe: '#f44336' };
    const lineColor = sevColors[injury.severity] || '#ff6600';

    const zonePlugin = {
        id: 'injuryACZones',
        beforeDraw(chart) {
            const { ctx, chartArea: ca, scales: { y } } = chart;
            if (!ca) return;
            const dark = document.documentElement.getAttribute('data-theme') === 'dark';
            const zones = [
                { min: 0,   max: 0.8, color: dark ? 'rgba(30,120,220,0.18)' : 'rgba(21,101,192,0.10)' },
                { min: 0.8, max: 1.3, color: dark ? 'rgba(34,168,97,0.18)'  : 'rgba(76,175,80,0.12)'  },
                { min: 1.3, max: 1.5, color: dark ? 'rgba(245,166,35,0.22)' : 'rgba(255,152,0,0.16)'  },
                { min: 1.5, max: 3.0, color: dark ? 'rgba(229,57,53,0.20)'  : 'rgba(244,67,54,0.12)'  },
            ];
            ctx.save();
            zones.forEach(z => {
                const yTop    = y.getPixelForValue(z.max);
                const yBottom = y.getPixelForValue(z.min);
                const top    = Math.max(yTop, ca.top);
                const bottom = Math.min(yBottom, ca.bottom);
                if (bottom <= top) return;
                ctx.fillStyle = z.color;
                ctx.fillRect(ca.left, top, ca.width, bottom - top);
            });
            // Threshold lines
            [0.8, 1.3, 1.5].forEach(v => {
                const yLine = y.getPixelForValue(v);
                if (yLine < ca.top || yLine > ca.bottom) return;
                ctx.strokeStyle = dark ? 'rgba(255,255,255,0.20)' : 'rgba(0,0,0,0.18)';
                ctx.lineWidth = 1;
                ctx.setLineDash([4, 3]);
                ctx.beginPath(); ctx.moveTo(ca.left, yLine); ctx.lineTo(ca.right, yLine); ctx.stroke();
                ctx.setLineDash([]);
            });
            // Injury marker — last day vertical line
            const lastX = ca.right;
            ctx.strokeStyle = dark ? 'rgba(244,67,54,0.70)' : 'rgba(244,67,54,0.60)';
            ctx.lineWidth = 2;
            ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(lastX, ca.top); ctx.lineTo(lastX, ca.bottom); ctx.stroke();
            ctx.setLineDash([]);
            ctx.font = 'bold 9px system-ui';
            ctx.fillStyle = dark ? 'rgba(255,100,100,0.85)' : 'rgba(200,30,30,0.75)';
            ctx.textAlign = 'right';
            ctx.fillText('🏥 lesión', lastX - 3, ca.top + 11);
            ctx.restore();
        }
    };

    if (canvas._chartInstance) canvas._chartInstance.destroy();
    canvas._chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'line',
        plugins: [zonePlugin],
        data: {
            labels,
            datasets: [{
                label: 'Ratio A:C',
                data: ratioData,
                borderColor: lineColor,
                backgroundColor: 'transparent',
                fill: false,
                tension: 0.35,
                pointRadius: (ctx) => sessionDays.includes(ctx.dataIndex) ? 3 : 0,
                pointHoverRadius: 5,
                pointBackgroundColor: lineColor,
                borderWidth: 2,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: (ctx) => `A:C ${ctx.parsed.y.toFixed(2)}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor, font: { size: 9 }, maxTicksLimit: 7 },
                    grid: { color: gridColor }
                },
                y: {
                    min: 0,
                    max: 2.2,
                    ticks: { color: textColor, font: { size: 9 }, stepSize: 0.5 },
                    grid: { color: gridColor }
                }
            }
        }
    });
};

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

    // Init A:C charts for active injury cards after DOM paint
    if (tab === 'activas') {
        setTimeout(() => {
            activeInjuries.forEach(inj => {
                if (typeof this._renderInjuryACChart === 'function') {
                    this._renderInjuryACChart(inj);
                }
            });
        }, 0);
    }
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

            ${(() => {
                // ── Criterios de progresión de fase actual ──────────────────
                if (!phase || !phase.criteria || !phase.criteria.conditions) return '';
                const savedChecks = (injury.history || []).slice().reverse()
                    .find(h => h.criteriaChecks && Array.isArray(h.criteriaChecks))?.criteriaChecks || [];
                const checkedIds  = new Set(savedChecks);
                const total       = phase.criteria.conditions.length;
                const checked     = phase.criteria.conditions.filter(c => checkedIds.has(c.id)).length;
                const minReq      = phase.criteria.minConditions || total;
                const ready       = checked >= minReq;
                const pct         = Math.round((checked / total) * 100);
                const barColor    = ready ? '#4caf50' : checked > 0 ? '#ff9800' : '#ccc';
                const criteriaRows = phase.criteria.conditions.map(c => {
                    const isChecked = checkedIds.has(c.id);
                    return `<div class="inj-criteria-row ${isChecked ? 'inj-criteria-met' : ''}">
                        <span class="inj-criteria-icon">${isChecked ? '✅' : '⬜'}</span>
                        <span class="inj-criteria-label">${c.label}</span>
                    </div>`;
                }).join('');
                return `
                <div class="inj-criteria-section">
                    <div class="inj-criteria-header">
                        <span class="inj-criteria-title">📋 Criterios para avanzar a Fase ${curPhase + 1}</span>
                        <span class="inj-criteria-badge" style="background:${barColor === '#4caf50' ? '#e8f5e9' : barColor === '#ff9800' ? '#fff8e1' : 'var(--bg-subtle)'};color:${barColor}">${checked}/${total} · mín ${minReq}${ready ? ' ✓' : ''}</span>
                    </div>
                    <div class="inj-criteria-bar-wrap">
                        <div class="inj-criteria-bar-fill" style="width:${pct}%;background:${barColor}"></div>
                    </div>
                    <div class="inj-criteria-list">${criteriaRows}</div>
                </div>`;
            })()}

            ${(() => {
                // ── Gráfico A:C 4 semanas previas ──────────────────────────
                const acData = typeof this._getACDataForInjury === 'function'
                    ? this._getACDataForInjury(injury) : null;
                const hasData = acData && acData.sessionsInWindow >= 3;
                return `
                <div class="inj-ac-section">
                    <div class="inj-ac-header">📈 Ratio A:C — 4 semanas previas a la lesión</div>
                    ${hasData
                        ? `<div class="inj-ac-canvas-wrap"><canvas id="acInjuryChart_${injury.id}"></canvas></div>`
                        : `<div class="inj-ac-nodata">Sin datos de carga suficientes (mín. 3 sesiones en las 4 semanas previas)</div>`
                    }
                </div>`;
            })()}

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

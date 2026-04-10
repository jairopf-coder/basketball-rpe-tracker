// Basketball RPE Tracker - Batch 4
// Módulos: Planificación Semanal, Historial Médico, Carga Readaptación, Correlación Carga-Lesión

// ============================================================
// 1. PLANIFICACIÓN SEMANAL
// ============================================================

RPETracker.prototype.loadWeekPlan = function() {
    try {
        const raw = localStorage.getItem('basketballWeekPlan');
        if (raw) {
            const parsed = JSON.parse(raw);
            const defaultPlan = this._defaultWeekPlan();
            const emptySession = () => ({ type: 'rest', intensity: 'none', duration: 0, focus: '', enabled: false });
            if (!parsed || typeof parsed !== 'object' || !parsed.days || typeof parsed.days !== 'object') {
                this.weekPlan = defaultPlan;
            } else {
                // Migrar formato legacy (días sin morning/afternoon) al nuevo formato
                const expectedDays = ['lun','mar','mie','jue','vie','sab','dom'];
                expectedDays.forEach(day => {
                    if (!parsed.days[day] || typeof parsed.days[day] !== 'object') {
                        parsed.days[day] = defaultPlan.days[day];
                    } else if (!parsed.days[day].morning) {
                        // Migración: formato antiguo con type/intensity directo -> mañana
                        const old = parsed.days[day];
                        parsed.days[day] = {
                            morning: { type: old.type||'rest', intensity: old.intensity||'none', duration: old.duration||0, focus: old.focus||'', enabled: (old.type&&old.type!=='rest') },
                            afternoon: emptySession()
                        };
                    }
                });
                this.weekPlan = parsed;
            }
        } else {
            this.weekPlan = this._defaultWeekPlan();
        }
    } catch(e) {
        this.weekPlan = this._defaultWeekPlan();
    }
};

RPETracker.prototype.saveWeekPlan = function() {
    localStorage.setItem('basketballWeekPlan', JSON.stringify(this.weekPlan));
};

RPETracker.prototype._defaultWeekPlan = function() {
    const emptySession = () => ({ type: 'rest', intensity: 'none', duration: 0, focus: '', enabled: false });
    const trainingSession = (intensity, duration, focus) => ({ type: 'training', intensity, duration, focus, enabled: true });
    return {
        weekOffset: 0,
        days: {
            lun: { morning: trainingSession('medium', 90, 'Técnica-táctica'),   afternoon: emptySession() },
            mar: { morning: trainingSession('high',   90, 'Físico / Condición'), afternoon: emptySession() },
            mie: { morning: emptySession(),                                       afternoon: emptySession() },
            jue: { morning: trainingSession('medium', 75, 'Táctica'),            afternoon: emptySession() },
            vie: { morning: trainingSession('low',    60, 'Activación previa'),  afternoon: emptySession() },
            sab: { morning: { type: 'match', intensity: 'max', duration: 90, focus: 'PARTIDO', enabled: true }, afternoon: emptySession() },
            dom: { morning: emptySession(),                                       afternoon: emptySession() }
        }
    };
};

RPETracker.prototype.renderWeeklyPlanning = function() {
    const container = document.getElementById('weeklyPlanView');
    if (!container) return;
    if (!this.weekPlan) this.loadWeekPlan();
    // Guardia extra: si days sigue sin existir, recargar desde defaults
    if (!this.weekPlan || !this.weekPlan.days) {
        this.weekPlan = this._defaultWeekPlan();
    }

    const offset = this.weekPlan.weekOffset || 0;
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1 + offset * 7);

    const days = ['lun','mar','mie','jue','vie','sab','dom'];
    const dayLabels = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];

    // Compute week real sessions summary
    const weekRealSessions = this._getWeekRealSessions(weekStart);
    const plannedLoad = this._plannedWeekLoad();

    container.innerHTML = `
        <div class="weekplan-wrap">
            <div class="weekplan-header">
                <div>
                    <h2 style="margin:0 0 .25rem">📅 Planificación Semanal</h2>
                    <p style="margin:0;color:var(--text-secondary);font-size:.85rem">
                        Semana del ${this._wpFmtDate(weekStart)}
                    </p>
                </div>
                <div style="display:flex;gap:.5rem;align-items:center">
                    <button class="btn-secondary btn-sm" onclick="window.rpeTracker?._wpChangeWeek(-1)">← Anterior</button>
                    <button class="btn-secondary btn-sm" onclick="window.rpeTracker?._wpResetWeek()">Hoy</button>
                    <button class="btn-secondary btn-sm" onclick="window.rpeTracker?._wpChangeWeek(1)">Siguiente →</button>
                    <button class="btn-primary btn-sm" onclick="window.rpeTracker?._wpSaveCurrentPlan()">💾 Guardar</button>
                </div>
            </div>

            <!-- Summary cards -->
            <div class="weekplan-summary-row">
                <div class="wp-sum-card">
                    <span class="wp-sum-val">${plannedLoad}</span>
                    <span class="wp-sum-label">Carga planificada</span>
                </div>
                <div class="wp-sum-card">
                    <span class="wp-sum-val">${weekRealSessions.totalLoad}</span>
                    <span class="wp-sum-label">Carga real (equipo)</span>
                </div>
                <div class="wp-sum-card">
                    <span class="wp-sum-val">${weekRealSessions.sessions}</span>
                    <span class="wp-sum-label">Sesiones registradas</span>
                </div>
                <div class="wp-sum-card">
                    <span class="wp-sum-val" style="color:${this._wpDiffColor(plannedLoad, weekRealSessions.totalLoad)}">${weekRealSessions.totalLoad > 0 ? (weekRealSessions.totalLoad / (plannedLoad||1) * 100).toFixed(0) + '%' : '—'}</span>
                    <span class="wp-sum-label">Cumplimiento</span>
                </div>
            </div>

            <!-- Day cards grid -->
            <div class="weekplan-grid">
                ${days.map((day, i) => {
                    const dayData = this.weekPlan.days[day] || {};
                    const morning   = dayData.morning   || { type:'rest', intensity:'none', duration:0, focus:'', enabled:false };
                    const afternoon = dayData.afternoon || { type:'rest', intensity:'none', duration:0, focus:'', enabled:false };
                    const date = new Date(weekStart); date.setDate(date.getDate() + i);
                    const dateStr = date.toISOString().slice(0,10);
                    const isToday = dateStr === new Date().toISOString().slice(0,10);
                    const realSessions = weekRealSessions.byDay[dateStr] || [];
                    const realLoad = realSessions.reduce((s,x) => s + (x.load||0), 0);

                    const typeColors = {training:'#2196f3', match:'#f44336', rest:'#9e9e9e', recovery:'#4caf50', shooting:'#9c27b0', gym:'#795548'};
                    const topColor = morning.enabled ? (typeColors[morning.type]||'#ccc') : (afternoon.enabled ? (typeColors[afternoon.type]||'#ccc') : '#9e9e9e');

                    const sessionBlock = (slot, label, emoji) => {
                        const s = slot === 'morning' ? morning : afternoon;
                        const isRest = !s.enabled;
                        const blockClass = 'wp-session-block' + (isRest ? ' wp-session-rest' : '');
                        const d = day, sl = slot;

                        const onchangeSession = function(field) {
                            return 'window.rpeTracker?._wpUpdateSession(' +
                                JSON.stringify(d) + ',' + JSON.stringify(sl) + ',' +
                                JSON.stringify(field) + ',this.value)';
                        };
                        const onchangeCheck = 'window.rpeTracker?._wpUpdateSession(' +
                            JSON.stringify(d) + ',' + JSON.stringify(sl) + ',"enabled",this.checked)';
                        const onchangeDur = 'window.rpeTracker?._wpUpdateSession(' +
                            JSON.stringify(d) + ',' + JSON.stringify(sl) + ',"duration",parseInt(this.value))';
                        const onchangeFocus = 'window.rpeTracker?._wpUpdateSession(' +
                            JSON.stringify(d) + ',' + JSON.stringify(sl) + ',"focus",this.value)';

                        let inner = '';
                        if (s.enabled) {
                            inner =
                                '<select class="wp-select wp-select-xs" onchange="' + onchangeSession('type') + '">' +
                                    '<option value="training"'  + (s.type==='training' ?' selected':'') + '>🏀 Entreno</option>' +
                                    '<option value="shooting"'  + (s.type==='shooting' ?' selected':'') + '>🎯 Tiro</option>' +
                                    '<option value="gym"'       + (s.type==='gym'      ?' selected':'') + '>🏋️ Gym</option>' +
                                    '<option value="match"'     + (s.type==='match'    ?' selected':'') + '>🏟️ Partido</option>' +
                                    '<option value="recovery"'  + (s.type==='recovery' ?' selected':'') + '>💪 Recuperación</option>' +
                                '</select>' +
                                '<select class="wp-select wp-select-xs" onchange="' + onchangeSession('intensity') + '">' +
                                    '<option value="none"'   + (s.intensity==='none'  ?' selected':'') + '>— Sin carga</option>' +
                                    '<option value="low"'    + (s.intensity==='low'   ?' selected':'') + '>🟢 Baja</option>' +
                                    '<option value="medium"' + (s.intensity==='medium'?' selected':'') + '>🟡 Media</option>' +
                                    '<option value="high"'   + (s.intensity==='high'  ?' selected':'') + '>🟠 Alta</option>' +
                                    '<option value="max"'    + (s.intensity==='max'   ?' selected':'') + '>🔴 Máxima</option>' +
                                '</select>' +
                                '<div style="display:flex;align-items:center;gap:.3rem;margin-top:.25rem">' +
                                    '<span style="color:var(--text-secondary);font-size:.8rem">⏱</span>' +
                                    '<input type="number" class="wp-input-sm" min="0" max="240" step="5"' +
                                    ' value="' + (s.duration||0) + '"' +
                                    ' onchange="' + onchangeDur + '">' +
                                    '<span style="color:var(--text-secondary);font-size:.72rem">min</span>' +
                                '</div>' +
                                '<input type="text" class="wp-input-focus" placeholder="Foco..."' +
                                ' value="' + (s.focus||'').replace(/"/g,'&quot;') + '"' +
                                ' onchange="' + onchangeFocus + '">';
                        } else {
                            inner = '<span class="wp-session-off">Sin sesión</span>';
                        }

                        return '<div class="' + blockClass + '">' +
                            '<div class="wp-session-header">' +
                                '<span class="wp-session-label">' + emoji + ' ' + label + '</span>' +
                                '<label class="wp-toggle-mini">' +
                                    '<input type="checkbox"' + (s.enabled ? ' checked' : '') +
                                    ' onchange="' + onchangeCheck + '">' +
                                    '<span class="wp-toggle-mini-slider"></span>' +
                                '</label>' +
                            '</div>' +
                            inner +
                        '</div>';
                    };

                    let realHtml = '';
                    if (realSessions.length > 0) {
                        const chips = realSessions.slice(0,3).map(s => {
                            const p = this.players.find(x => x.id === s.playerId);
                            return p ? '<span class="wp-real-chip">' + PlayerTokens.avatar(p,14,'.45rem') + ' RPE ' + s.rpe + '</span>' : '';
                        }).join('');
                        const more = realSessions.length > 3 ? '<span style="font-size:.72rem;color:var(--text-secondary)">+' + (realSessions.length-3) + '</span>' : '';
                        realHtml = '<div class="wp-real-sessions">' +
                            '<span style="font-size:.72rem;color:var(--text-secondary);font-weight:600">REAL:</span>' +
                            chips + more +
                            '<span style="font-size:.72rem;color:var(--text-secondary);margin-left:auto">Carga: ' + realLoad + '</span>' +
                        '</div>';
                    }

                    return '<div class="wp-day-card' + (isToday ? ' today' : '') + '" style="border-top:3px solid ' + topColor + '">' +
                        '<div class="wp-day-head">' +
                            '<span class="wp-day-name">' + dayLabels[i] + '</span>' +
                            '<span class="wp-day-date">' + date.getDate() + '/' + (date.getMonth()+1) + '</span>' +
                            (isToday ? '<span class="wp-today-badge">HOY</span>' : '') +
                        '</div>' +
                        sessionBlock('morning',   'Mañana', '🌅') +
                        sessionBlock('afternoon', 'Tarde',  '🌆') +
                        realHtml +
                    '</div>';
                }).join('')}
            </div>

            <!-- Load distribution chart -->
            ${this._renderWpLoadChart(days, dayLabels, weekStart)}

            <!-- Instructions -->
            <div class="wellness-card" style="font-size:.84rem;color:var(--text-secondary)">
                <p style="margin:0 0 .5rem"><strong>💡 Cómo usar:</strong></p>
                <ul style="margin:0;padding-left:1.2rem;line-height:1.8">
                    <li>Configura el tipo y la intensidad de cada día de la semana</li>
                    <li>Pulsa <strong>💾 Guardar</strong> para que la plantilla se aplique cada semana</li>
                    <li>Los datos <strong>REAL</strong> muestran las sesiones ya registradas ese día</li>
                    <li>El % de cumplimiento compara carga planificada vs registrada en el equipo</li>
                </ul>
            </div>
        </div>`;

    this._drawWpLoadChart(days, dayLabels, weekStart);
};

RPETracker.prototype._getWeekRealSessions = function(weekStart) {
    const byDay = {};
    let totalLoad = 0, sessions = 0;
    for (let i=0;i<7;i++) {
        const d = new Date(weekStart); d.setDate(d.getDate()+i);
        const dateStr = d.toISOString().slice(0,10);
        byDay[dateStr] = this.sessions.filter(s => s.date && s.date.slice(0,10)===dateStr);
        const dayLoad = byDay[dateStr].reduce((sum,s)=>sum+(s.load||0),0);
        totalLoad += dayLoad;
        sessions += byDay[dateStr].length;
    }
    return { byDay, totalLoad: Math.round(totalLoad), sessions };
};

RPETracker.prototype._plannedWeekLoad = function() {
    const intensityRPE = {none:0,low:4,medium:6,high:7.5,max:9};
    const plan = this.weekPlan?.days || {};
    let total = 0;
    Object.values(plan).forEach(d => {
        // Nuevo formato: morning/afternoon
        if (d.morning || d.afternoon) {
            ['morning','afternoon'].forEach(slot => {
                const s = d[slot];
                if (s && s.enabled) {
                    const rpe = intensityRPE[s.intensity||'none'] || 0;
                    total += rpe * (s.duration||0);
                }
            });
        } else {
            // Formato legacy
            const rpe = intensityRPE[d.intensity||'none'] || 0;
            total += rpe * (d.duration||0);
        }
    });
    const playerCount = Math.max(this.players.length, 1);
    return Math.round(total * playerCount);
};

RPETracker.prototype._wpDiffColor = function(planned, real) {
    if (!real) return 'var(--text-secondary)';
    const pct = real / (planned||1);
    if (pct >= 0.85 && pct <= 1.15) return '#4caf50';
    if (pct >= 0.7 && pct <= 1.3) return '#ff9800';
    return '#f44336';
};

RPETracker.prototype._wpUpdateField = function(day, field, value) {
    if (!this.weekPlan) this.loadWeekPlan();
    if (!this.weekPlan.days[day]) this.weekPlan.days[day] = {};
    this.weekPlan.days[day][field] = value;
};

RPETracker.prototype._wpUpdateSession = function(day, slot, field, value) {
    if (!this.weekPlan) this.loadWeekPlan();
    if (!this.weekPlan.days[day]) this.weekPlan.days[day] = {};
    if (!this.weekPlan.days[day][slot]) this.weekPlan.days[day][slot] = { type:'rest', intensity:'none', duration:0, focus:'', enabled:false };
    this.weekPlan.days[day][slot][field] = value;
    // Si se activa/desactiva, re-renderizar para mostrar/ocultar controles
    if (field === 'enabled') this.renderWeeklyPlanning();
};

RPETracker.prototype._wpSaveCurrentPlan = function() {
    this.saveWeekPlan();
    this.showToast('✅ Planificación guardada','success');
};

RPETracker.prototype._wpChangeWeek = function(delta) {
    if (!this.weekPlan) this.loadWeekPlan();
    this.weekPlan.weekOffset = (this.weekPlan.weekOffset||0) + delta;
    this.renderWeeklyPlanning();
};

RPETracker.prototype._wpResetWeek = function() {
    if (!this.weekPlan) this.loadWeekPlan();
    this.weekPlan.weekOffset = 0;
    this.renderWeeklyPlanning();
};

RPETracker.prototype._wpFmtDate = function(date) {
    return date.toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'});
};

RPETracker.prototype._renderWpLoadChart = function(days, dayLabels, weekStart) {
    return `<div class="wellness-card">
        <h3 class="wellness-section-title">📊 Carga de la semana</h3>
        <canvas id="wpLoadCanvas" height="120" style="width:100%;display:block"></canvas>
        <div style="display:flex;gap:1rem;margin-top:.6rem;font-size:.75rem">
            <span><span style="display:inline-block;width:14px;height:10px;background:#2196f3;border-radius:2px;vertical-align:middle"></span> Planificada</span>
            <span><span style="display:inline-block;width:14px;height:10px;background:#4caf50;border-radius:2px;vertical-align:middle"></span> Real</span>
        </div>
    </div>`;
};

RPETracker.prototype._drawWpLoadChart = function(days, dayLabels, weekStart) {
    const canvas = document.getElementById('wpLoadCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio||1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width*dpr;
    canvas.height = 120*dpr;
    ctx.scale(dpr,dpr);
    const W=rect.width, H=120;
    const pad={t:8,r:12,b:22,l:10};
    const iW=W-pad.l-pad.r, iH=H-pad.t-pad.b;
    const n=7, bw=iW/n, gap=bw*0.15;

    const intensityRPE={none:0,low:4,medium:6,high:7.5,max:9};
    const plan=this.weekPlan?.days||{};
    const planLoads=days.map(d=>{
        const dayPlan=plan[d]||{};
        return (intensityRPE[dayPlan.intensity||'none']||0)*(dayPlan.duration||0);
    });

    const realLoads=days.map((_,i)=>{
        const d=new Date(weekStart); d.setDate(d.getDate()+i);
        const dateStr=d.toISOString().slice(0,10);
        return this.sessions.filter(s=>s.date?.slice(0,10)===dateStr).reduce((sum,s)=>sum+(s.load||0),0);
    });

    const maxLoad=Math.max(...planLoads,...realLoads,1);

    // Grid lines
    ctx.strokeStyle='rgba(128,128,128,.1)';ctx.lineWidth=1;
    [0.25,0.5,0.75,1].forEach(f=>{
        const y=pad.t+iH-(f*iH);
        ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+iW,y);ctx.stroke();
    });

    days.forEach((day,i)=>{
        const x=pad.l+i*bw;
        const bwInner=(bw-gap*2)/2;

        // Planned bar
        const ph=planLoads[i]/maxLoad*iH;
        ctx.fillStyle='rgba(33,150,243,.7)';
        ctx.fillRect(x+gap, pad.t+iH-ph, bwInner, ph);

        // Real bar
        const rh=realLoads[i]/maxLoad*iH;
        ctx.fillStyle='rgba(76,175,80,.85)';
        ctx.fillRect(x+gap+bwInner+2, pad.t+iH-rh, bwInner, rh);

        // Day label
        ctx.fillStyle='rgba(128,128,128,.8)';
        ctx.font=`${9}px system-ui`;ctx.textAlign='center';
        ctx.fillText(dayLabels[i].slice(0,3), x+bw/2, H-5);
    });
};

// ============================================================
// 2. HISTORIAL MÉDICO
// ============================================================

RPETracker.prototype.renderMedicalHistory = function() {
    const container = document.getElementById('medicalHistoryView');
    if (!container) return;

    const injuries = this.injuries || [];
    const allInjuries = [...injuries].sort((a,b) => new Date(b.startDate) - new Date(a.startDate));

    // Player filter
    if (!this._medPlayerFilter) this._medPlayerFilter = 'all';

    const filtered = this._medPlayerFilter === 'all'
        ? allInjuries
        : allInjuries.filter(inj => inj.playerId === this._medPlayerFilter);

    const stats = this._calcMedStats(allInjuries);

    container.innerHTML = `
        <div class="weekplan-wrap">
            <div class="weekplan-header">
                <div>
                    <h2 style="margin:0 0 .25rem">📋 Historial Médico</h2>
                    <p style="margin:0;color:var(--text-secondary);font-size:.85rem">${allInjuries.length} lesiones registradas</p>
                </div>
                <button class="btn-primary" onclick="window.rpeTracker?.switchView('injury')">➕ Nueva lesión</button>
            </div>

            <!-- Stats cards -->
            <div class="weekplan-summary-row">
                <div class="wp-sum-card">
                    <span class="wp-sum-val">${stats.total}</span>
                    <span class="wp-sum-label">Total lesiones</span>
                </div>
                <div class="wp-sum-card">
                    <span class="wp-sum-val" style="color:#f44336">${stats.active}</span>
                    <span class="wp-sum-label">Activas ahora</span>
                </div>
                <div class="wp-sum-card">
                    <span class="wp-sum-val">${stats.avgDays}</span>
                    <span class="wp-sum-label">Días baja promedio</span>
                </div>
                <div class="wp-sum-card">
                    <span class="wp-sum-val">${stats.missedSessions}</span>
                    <span class="wp-sum-label">Sesiones perdidas</span>
                </div>
            </div>

            <!-- Player filter -->
            <div class="wellness-card" style="padding:.75rem 1.25rem">
                <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
                    <span style="font-weight:600;font-size:.85rem;color:var(--text-secondary)">Filtrar por jugadora:</span>
                    <button class="wp-filter-btn ${this._medPlayerFilter==='all'?'active':''}"
                        onclick="window.rpeTracker?._medSetFilter('all')">Todas</button>
                    ${this.players.map(p=>`
                        <button class="wp-filter-btn ${this._medPlayerFilter===p.id?'active':''}"
                            onclick="window.rpeTracker?._medSetFilter('${p.id}')">
                            ${PlayerTokens.avatar(p,16,'.5rem')} ${p.name}
                        </button>`).join('')}
                </div>
            </div>

            <!-- Injury cards -->
            ${filtered.length === 0
                ? `<div class="wellness-card" style="text-align:center;padding:2rem;color:var(--text-secondary)">
                    <p style="font-size:2rem">🏥</p>
                    <p>No hay lesiones registradas${this._medPlayerFilter!=='all'?' para esta jugadora':''}.</p>
                    <button class="btn-primary" onclick="window.rpeTracker?.switchView('injury')">Registrar primera lesión</button>
                  </div>`
                : `<div style="display:flex;flex-direction:column;gap:.75rem">
                    ${filtered.map(inj => this._renderMedCard(inj)).join('')}
                   </div>`
            }

            <!-- Injury type breakdown -->
            ${this._renderMedTypeChart(allInjuries)}
        </div>`;
};

RPETracker.prototype._medSetFilter = function(playerId) {
    this._medPlayerFilter = playerId;
    this.renderMedicalHistory();
};

RPETracker.prototype._calcMedStats = function(injuries) {
    const active = injuries.filter(i=>i.status==='active').length;
    const recovered = injuries.filter(i=>i.endDate);
    const avgDays = recovered.length
        ? Math.round(recovered.map(i=>{
            const d=(new Date(i.endDate)-new Date(i.startDate))/(1000*60*60*24);
            return d>0?d:0;
          }).reduce((a,b)=>a+b,0)/recovered.length)
        : '—';
    const missedSessions = injuries.reduce((s,i)=>s+(i.missedSessions||0),0);
    return { total:injuries.length, active, avgDays, missedSessions };
};

RPETracker.prototype._renderMedCard = function(inj) {
    const player = this.players.find(p=>p.id===inj.playerId);
    if (!player) return '';
    const startDate = new Date(inj.startDate).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'});
    const endDate = inj.endDate ? new Date(inj.endDate).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'}) : null;
    const days = inj.endDate
        ? Math.ceil((new Date(inj.endDate)-new Date(inj.startDate))/(1000*60*60*24))
        : Math.ceil((new Date()-new Date(inj.startDate))/(1000*60*60*24));

    const statusColors={active:'#f44336',recovered:'#4caf50',recurring:'#ff9800'};
    const statusLabel={active:'🔴 Activa',recovered:'🟢 Recuperada',recurring:'🟠 Recurrente'};
    const severityColors={minor:'#4caf50',moderate:'#ff9800',severe:'#f44336'};
    const severityLabel={minor:'Leve',moderate:'Moderada',severe:'Grave'};
    const typeLabel=typeof this.getTypeName==='function'?this.getTypeName(inj.type):(inj.type||'Desconocido');
    const locLabel=typeof this.getLocationName==='function'?this.getLocationName(inj.location):(inj.location||'—');

    return `<div class="wellness-card med-injury-card" style="border-left:4px solid ${statusColors[inj.status]||'#ccc'}">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:.75rem;flex-wrap:wrap">
            <div style="display:flex;align-items:center;gap:.6rem">
                ${PlayerTokens.avatar(player,28,'.7rem')}
                <div>
                    <div style="font-weight:700;font-size:1rem">${player.name}${player.number?` <span style="opacity:.5;font-size:.8rem">#${player.number}</span>`:''}</div>
                    <div style="font-size:.82rem;color:var(--text-secondary)">${typeLabel} — ${locLabel}</div>
                </div>
            </div>
            <div style="display:flex;gap:.5rem;align-items:center">
                <span style="padding:.2rem .6rem;border-radius:12px;font-size:.75rem;font-weight:700;background:${severityColors[inj.severity]||'#ccc'};color:white">${severityLabel[inj.severity]||inj.severity}</span>
                <span style="padding:.2rem .6rem;border-radius:12px;font-size:.75rem;font-weight:700;background:${statusColors[inj.status]||'#ccc'};color:white">${statusLabel[inj.status]||inj.status}</span>
            </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:.5rem;margin-top:.75rem">
            <div class="med-info-cell"><span class="mic-label">📅 Inicio</span><span class="mic-val">${startDate}</span></div>
            <div class="med-info-cell"><span class="mic-label">📅 Alta</span><span class="mic-val">${endDate||'Pendiente'}</span></div>
            <div class="med-info-cell"><span class="mic-label">⏱ Días baja</span><span class="mic-val" style="font-weight:700;color:${statusColors[inj.status]}">${days}d</span></div>
            <div class="med-info-cell"><span class="mic-label">🏀 Sesiones</span><span class="mic-val">${inj.missedSessions||0} perdidas</span></div>
            <div class="med-info-cell"><span class="mic-label">🔄 Fase RTP</span><span class="mic-val">${inj.rtpPhase||1}/6</span></div>
            <div class="med-info-cell"><span class="mic-label">📈 Progreso</span><span class="mic-val">${inj.rtpProgress||0}%</span></div>
        </div>
        ${inj.description ? `<p style="margin:.6rem 0 0;font-size:.83rem;color:var(--text-secondary)">${inj.description}</p>` : ''}
    </div>`;
};

RPETracker.prototype._renderMedTypeChart = function(injuries) {
    if (!injuries.length) return '';
    const types={};
    injuries.forEach(i=>{const t=i.type||'other';types[t]=(types[t]||0)+1;});
    const labels={muscle:'Muscular',joint:'Articular',bone:'Ósea',other:'Otra'};
    const colors={muscle:'#ff9800',joint:'#2196f3',bone:'#9e9e9e',other:'#9c27b0'};
    const total=injuries.length;

    return `<div class="wellness-card">
        <h3 class="wellness-section-title">📊 Distribución por tipo</h3>
        <div style="display:flex;flex-direction:column;gap:.5rem">
            ${Object.entries(types).sort((a,b)=>b[1]-a[1]).map(([type,count])=>`
            <div style="display:flex;align-items:center;gap:.75rem">
                <span style="width:90px;font-size:.83rem;color:var(--text-secondary)">${labels[type]||type}</span>
                <div style="flex:1;height:10px;background:var(--border-color);border-radius:5px;overflow:hidden">
                    <div style="width:${(count/total*100).toFixed(0)}%;height:100%;background:${colors[type]||'#607d8b'};border-radius:5px"></div>
                </div>
                <span style="width:40px;text-align:right;font-weight:700;font-size:.85rem">${count}</span>
            </div>`).join('')}
        </div>
    </div>`;
};

// ============================================================
// 3. CARGA DURANTE READAPTACIÓN
// ============================================================

RPETracker.prototype.renderRehabLoad = function() {
    const container = document.getElementById('rehabLoadView');
    if (!container) return;

    const activeInjuries = (this.injuries||[]).filter(i=>i.status==='active');

    if (!activeInjuries.length) {
        container.innerHTML = `<div class="weekplan-wrap">
            <div class="weekplan-header"><h2 style="margin:0">💪 Carga de Readaptación</h2></div>
            <div class="wellness-card" style="text-align:center;padding:3rem;color:var(--text-secondary)">
                <p style="font-size:3rem">💪</p>
                <h3 style="margin:.5rem 0">No hay jugadoras en readaptación</h3>
                <p style="margin:.5rem 0 1rem">Cuando haya una lesión activa, aquí verás el seguimiento de carga.</p>
                <button class="btn-primary" onclick="window.rpeTracker?.switchView('injury')">Ver gestión de lesiones</button>
            </div>
        </div>`;
        return;
    }

    const cards = activeInjuries.map(inj => {
        const player = this.players.find(p=>p.id===inj.playerId);
        if (!player) return '';

        // Get player's recent load vs team average
        const playerLoad = this._getRehabLoadData(inj, player);

        const rtpPhases = [
            {n:1, label:'Control del dolor/inflamación'},
            {n:2, label:'Movilidad y propiocepción'},
            {n:3, label:'Fortalecimiento básico'},
            {n:4, label:'Carga específica'},
            {n:5, label:'Integración al grupo'},
            {n:6, label:'Alta deportiva'}
        ];

        return `<div class="wellness-card" style="border-left:4px solid ${PlayerTokens.get(player)}">
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
                <div style="display:flex;align-items:center;gap:.6rem">
                    ${PlayerTokens.avatar(player,32,'.75rem')}
                    <div>
                        <div style="font-weight:700;font-size:1rem">${player.name}</div>
                        <div style="font-size:.8rem;color:var(--text-secondary)">${inj.type||'Lesión'} — Día ${playerLoad.daysInjured} de baja</div>
                    </div>
                </div>
                <button class="btn-secondary btn-sm" onclick="window.rpeTracker?.switchView('injury')">Ver RTP</button>
            </div>

            <!-- RTP Phase -->
            <div style="margin-bottom:1rem">
                <div style="font-size:.78rem;color:var(--text-secondary);font-weight:600;margin-bottom:.4rem">FASE ACTUAL: ${inj.rtpPhase||1}/6</div>
                <div style="display:flex;gap:3px">
                    ${rtpPhases.map(ph=>`
                    <div style="flex:1;padding:.25rem .1rem;text-align:center;border-radius:4px;font-size:.65rem;font-weight:600;
                         background:${(inj.rtpPhase||1)>=ph.n?PlayerTokens.get(player):'var(--border-color)'};
                         color:${(inj.rtpPhase||1)>=ph.n?'white':'var(--text-secondary)'}">
                        ${ph.n}
                    </div>`).join('')}
                </div>
                <div style="font-size:.78rem;color:var(--text-secondary);margin-top:.35rem">
                    📍 ${rtpPhases[(inj.rtpPhase||1)-1]?.label||''}
                </div>
                <!-- Progress bar -->
                <div style="margin-top:.5rem;height:8px;background:var(--border-color);border-radius:4px;overflow:hidden">
                    <div style="width:${inj.rtpProgress||0}%;height:100%;background:${PlayerTokens.get(player)};transition:width .4s"></div>
                </div>
                <div style="font-size:.75rem;color:var(--text-secondary);margin-top:.25rem">Progreso: ${inj.rtpProgress||0}%</div>
            </div>

            <!-- Load comparison -->
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:.5rem;margin-bottom:.75rem">
                <div class="med-info-cell">
                    <span class="mic-label">Carga 7d (jugadora)</span>
                    <span class="mic-val" style="font-weight:700;color:${PlayerTokens.get(player)}">${playerLoad.load7d}</span>
                </div>
                <div class="med-info-cell">
                    <span class="mic-label">Media equipo 7d</span>
                    <span class="mic-val" style="font-weight:700">${playerLoad.teamLoad7d}</span>
                </div>
                <div class="med-info-cell">
                    <span class="mic-label">% vs equipo</span>
                    <span class="mic-val" style="font-weight:700;color:${playerLoad.pct>80?'#4caf50':playerLoad.pct>50?'#ff9800':'#f44336'}">${playerLoad.pct}%</span>
                </div>
            </div>

            <!-- Rehab load bar -->
            <div>
                <div style="font-size:.78rem;color:var(--text-secondary);margin-bottom:.3rem">Integración de carga progresiva</div>
                <div style="position:relative;height:20px;background:var(--border-color);border-radius:10px;overflow:hidden">
                    <div style="position:absolute;left:0;top:0;bottom:0;width:${Math.min(playerLoad.pct,100)}%;
                         background:linear-gradient(to right,${PlayerTokens.get(player)},${PlayerTokens.get(player)}aa);
                         border-radius:10px;transition:width .6s"></div>
                    <div style="position:absolute;right:0;top:0;bottom:0;width:2px;background:#4caf50" title="100% = carga equipo"></div>
                </div>
                <div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-secondary);margin-top:.2rem">
                    <span>0%</span><span>50%</span><span>100% (equipo)</span>
                </div>
            </div>

            ${inj.notes ? `<p style="margin:.6rem 0 0;font-size:.82rem;color:var(--text-secondary);border-top:1px solid var(--border-color);padding-top:.6rem">${inj.notes}</p>` : ''}
        </div>`;
    }).join('');

    container.innerHTML = `<div class="weekplan-wrap">
        <div class="weekplan-header">
            <div>
                <h2 style="margin:0 0 .25rem">💪 Carga de Readaptación</h2>
                <p style="margin:0;color:var(--text-secondary);font-size:.85rem">${activeInjuries.length} jugadora${activeInjuries.length!==1?'s':''} en readaptación</p>
            </div>
        </div>
        ${cards}
        <div class="wellness-card" style="font-size:.82rem;color:var(--text-secondary)">
            <p style="margin:0 0 .4rem"><strong>💡 Recomendaciones de carga en readaptación:</strong></p>
            <ul style="margin:0;padding-left:1.2rem;line-height:1.8">
                <li>Fase 1-2: 0-20% de la carga del equipo (trabajo individualizado sin balón)</li>
                <li>Fase 3: 20-40% (ejercicios específicos sin contacto)</li>
                <li>Fase 4: 40-70% (trabajo con balón, sin oposición)</li>
                <li>Fase 5: 70-90% (integración parcial al grupo)</li>
                <li>Fase 6: 100% (entrenamiento completo, alta deportiva)</li>
            </ul>
        </div>
    </div>`;
};

RPETracker.prototype._getRehabLoadData = function(inj, player) {
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate()-7);
    const playerSessions7d = this.sessions.filter(s=>s.playerId===player.id && new Date(s.date)>=sevenDaysAgo);
    const load7d = Math.round(playerSessions7d.reduce((s,x)=>s+(x.load||0),0));

    // Team average (excluding injured player)
    const teamSessions7d = this.sessions.filter(s=>s.playerId!==player.id && new Date(s.date)>=sevenDaysAgo);
    const teamPlayerCount = Math.max(this.players.filter(p=>p.id!==player.id).length, 1);
    const teamLoad7d = teamSessions7d.length
        ? Math.round(teamSessions7d.reduce((s,x)=>s+(x.load||0),0) / teamPlayerCount)
        : 0;

    const pct = teamLoad7d > 0 ? Math.round(load7d/teamLoad7d*100) : 0;
    const daysInjured = Math.ceil((new Date()-new Date(inj.startDate))/(1000*60*60*24));

    return { load7d, teamLoad7d, pct, daysInjured };
};

// ============================================================
// 4. CORRELACIÓN CARGA-LESIÓN
// ============================================================

RPETracker.prototype.renderLoadInjuryCorrelation = function() {
    const el = document.getElementById('correlationView');
    if (!el) return;

    const injuries = this.injuries || [];

    if (!injuries.length) {
        el.innerHTML = `<div class="weekplan-wrap">
            <div class="weekplan-header"><h2 style="margin:0">🔗 Correlación Carga-Lesión</h2></div>
            <div class="wellness-card" style="text-align:center;padding:3rem;color:var(--text-secondary)">
                <p style="font-size:3rem">🔗</p>
                <h3 style="margin:.5rem 0">Sin datos suficientes</h3>
                <p>Registra sesiones y lesiones para ver el análisis de correlación.</p>
            </div>
        </div>`;
        return;
    }

    // Build timeline: for each injury, get load in the 4 weeks before
    const correlationData = this._buildCorrelationData(injuries);

    el.innerHTML = `<div class="weekplan-wrap">
        <div class="weekplan-header">
            <div>
                <h2 style="margin:0 0 .25rem">🔗 Correlación Carga-Lesión</h2>
                <p style="margin:0;color:var(--text-secondary);font-size:.85rem">Análisis de carga previa a lesiones</p>
            </div>
        </div>

        <!-- Key insight -->
        <div class="wellness-card" style="background:linear-gradient(135deg,rgba(33,150,243,.1),rgba(156,39,176,.08));border-color:rgba(33,150,243,.3)">
            <h3 class="wellness-section-title">💡 Insight clave</h3>
            <p style="margin:0;font-size:.9rem;line-height:1.6">${correlationData.insight}</p>
        </div>

        <!-- Timeline chart -->
        <div class="wellness-card">
            <h3 class="wellness-section-title">📈 Carga semanal del equipo (últimas 16 semanas)</h3>
            <canvas id="corrCanvas" height="180" style="width:100%;display:block"></canvas>
            <div style="font-size:.75rem;color:var(--text-secondary);margin-top:.5rem">
                Las marcas rojas indican semanas con lesiones registradas.
            </div>
        </div>

        <!-- Injury-to-load table -->
        <div class="wellness-card">
            <h3 class="wellness-section-title">📋 Carga previa por lesión</h3>
            ${correlationData.rows.length === 0
                ? '<p style="color:var(--text-secondary)">No hay datos suficientes para el análisis.</p>'
                : `<div style="overflow-x:auto">
                    <table class="wellness-player-table">
                        <thead><tr>
                            <th>Jugadora</th><th>Lesión</th><th>Fecha</th>
                            <th>Carga semana -1</th><th>Carga semana -2</th><th>Ratio A:C previo</th><th>Riesgo</th>
                        </tr></thead>
                        <tbody>
                            ${correlationData.rows.map(row=>`<tr>
                                <td><div style="display:flex;align-items:center;gap:.35rem">
                                    ${PlayerTokens.avatar(row.player,18,'.5rem')}<span>${row.player.name}</span>
                                </div></td>
                                <td style="font-size:.82rem">${row.type}</td>
                                <td style="font-size:.82rem;white-space:nowrap">${row.date}</td>
                                <td style="font-weight:600;color:${row.load1>row.avgLoad?'#f44336':'#4caf50'}">${row.load1}</td>
                                <td style="font-weight:600">${row.load2}</td>
                                <td style="font-weight:700;color:${row.ratioPrev>1.3?'#f44336':row.ratioPrev>0.8?'#4caf50':'#2196f3'}">${row.ratioPrev||'—'}</td>
                                <td>${row.ratioPrev>1.5?'🔴 Alto':row.ratioPrev>1.3?'🟠 Moderado':row.ratioPrev<0.8?'🔵 Bajo':'🟢 Normal'}</td>
                            </tr>`).join('')}
                        </tbody>
                    </table>
                  </div>`
            }
        </div>

        <!-- Recommendations -->
        <div class="wellness-card">
            <h3 class="wellness-section-title">📌 Recomendaciones basadas en tus datos</h3>
            <ul style="margin:0;padding-left:1.2rem;line-height:2;font-size:.86rem;color:var(--text-secondary)">
                <li>Mantén el ratio A:C entre <strong>0.8 y 1.3</strong> para minimizar el riesgo de lesión</li>
                <li>Evita aumentos bruscos de carga superiores al <strong>10-15% semanal</strong></li>
                <li>Tras una semana de alta carga, programa recuperación activa</li>
                <li>Monitoriza especialmente jugadoras con historial de lesiones</li>
                <li>Combina datos de wellness (sueño, fatiga) con RPE para una gestión completa</li>
            </ul>
        </div>
    </div>`;

    requestAnimationFrame(() => this._drawCorrChart(correlationData));
};

RPETracker.prototype._buildCorrelationData = function(injuries) {
    // Weekly team loads last 16 weeks
    const weeks = 16;
    const weeklyLoads = [];
    const injuryWeeks = new Set();

    for (let i=weeks-1; i>=0; i--) {
        const wStart = new Date(); wStart.setDate(wStart.getDate() - wStart.getDay() + 1 - i*7);
        const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate()+7);
        const wSessions = this.sessions.filter(s => {
            const d=new Date(s.date); return d>=wStart && d<wEnd;
        });
        const load = Math.round(wSessions.reduce((s,x)=>s+(x.load||0),0));
        weeklyLoads.push({ week:weeks-1-i, startDate:wStart, load });

        // Check injuries this week
        injuries.forEach(inj => {
            const injDate = new Date(inj.startDate);
            if (injDate>=wStart && injDate<wEnd) injuryWeeks.add(weeks-1-i);
        });
    }

    // Rows: load before each injury
    const rows = [];
    const avgLoad = weeklyLoads.length ? weeklyLoads.reduce((s,w)=>s+w.load,0)/weeklyLoads.length : 0;

    injuries.forEach(inj => {
        const player = this.players.find(p=>p.id===inj.playerId);
        if (!player) return;

        const injDate = new Date(inj.startDate);
        const week1Start = new Date(injDate); week1Start.setDate(week1Start.getDate()-7);
        const week2Start = new Date(injDate); week2Start.setDate(week2Start.getDate()-14);

        const getLoad = (from, to) => Math.round(
            this.sessions.filter(s=>s.playerId===inj.playerId&&new Date(s.date)>=from&&new Date(s.date)<to)
                .reduce((s,x)=>s+(x.load||0),0));

        const load1 = getLoad(week1Start, injDate);
        const load2 = getLoad(week2Start, week1Start);

        // Ratio approximate: acute (week-1 avg per day) / chronic (4-week avg per day)
        const week4Start = new Date(injDate); week4Start.setDate(week4Start.getDate()-28);
        const load4w = getLoad(week4Start, injDate);
        const ratioPrev = load4w > 0 ? (load1 / (load4w/4)).toFixed(2) : null;

        const typeLabel=typeof this.getTypeName==='function'?this.getTypeName(inj.type):(inj.type||'—');
        rows.push({
            player,
            type: typeLabel,
            date: injDate.toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'}),
            load1, load2, ratioPrev: ratioPrev ? parseFloat(ratioPrev) : null, avgLoad
        });
    });

    // Insight
    const highRatioInjuries = rows.filter(r=>r.ratioPrev!==null && r.ratioPrev>1.3).length;
    const pctHigh = rows.length ? Math.round(highRatioInjuries/rows.length*100) : 0;
    let insight;
    if (injuries.length < 2) {
        insight = 'Con más datos de lesiones y sesiones se generarán correlaciones estadísticas automáticamente. Sigue registrando sesiones para obtener análisis más precisos.';
    } else if (pctHigh >= 60) {
        insight = `⚠️ El ${pctHigh}% de las lesiones ocurrieron cuando el ratio A:C estaba por encima de 1.3 (zona de riesgo). La gestión de carga es clave para prevenir lesiones en tu equipo.`;
    } else if (pctHigh >= 30) {
        insight = `📊 El ${pctHigh}% de las lesiones ocurrieron en semanas de alta carga. Existe una tendencia moderada entre picos de carga y lesiones.`;
    } else {
        insight = '✅ No se detecta una correlación clara entre picos de carga y lesiones. Esto puede indicar una buena gestión de cargas o que las lesiones tienen origen diferente (contacto, técnica).';
    }

    return { weeklyLoads, injuryWeeks, rows, insight, avgLoad };
};

RPETracker.prototype._drawCorrChart = function(data) {
    const canvas = document.getElementById('corrCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio||1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width*dpr;
    canvas.height = 180*dpr;
    ctx.scale(dpr,dpr);
    const W=rect.width, H=180;
    const pad={t:12,r:16,b:28,l:44};
    const iW=W-pad.l-pad.r, iH=H-pad.t-pad.b;
    const n=data.weeklyLoads.length;
    const maxLoad=Math.max(...data.weeklyLoads.map(w=>w.load),1);

    // Grid
    ctx.strokeStyle='rgba(128,128,128,.1)';ctx.lineWidth=1;
    [0.25,0.5,0.75,1].forEach(f=>{
        const y=pad.t+iH-f*iH;
        ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+iW,y);ctx.stroke();
        ctx.fillStyle='rgba(128,128,128,.6)';ctx.font=`${9}px system-ui`;ctx.textAlign='right';
        ctx.fillText(Math.round(maxLoad*f),pad.l-4,y+3);
    });

    const xStep=iW/(n-1||1);

    // Area under line
    ctx.beginPath();
    data.weeklyLoads.forEach((w,i)=>{
        const x=pad.l+i*xStep, y=pad.t+iH-(w.load/maxLoad)*iH;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.lineTo(pad.l+(n-1)*xStep, pad.t+iH);
    ctx.lineTo(pad.l, pad.t+iH);
    ctx.closePath();
    ctx.fillStyle='rgba(33,150,243,.1)';ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle='#2196f3';ctx.lineWidth=2.5;ctx.lineJoin='round';
    data.weeklyLoads.forEach((w,i)=>{
        const x=pad.l+i*xStep, y=pad.t+iH-(w.load/maxLoad)*iH;
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    });
    ctx.stroke();

    // Average line
    const avgY=pad.t+iH-(data.avgLoad/maxLoad)*iH;
    ctx.setLineDash([4,3]);ctx.strokeStyle='rgba(76,175,80,.6)';ctx.lineWidth=1.5;
    ctx.beginPath();ctx.moveTo(pad.l,avgY);ctx.lineTo(pad.l+iW,avgY);ctx.stroke();
    ctx.setLineDash([]);

    // Injury markers
    data.weeklyLoads.forEach((w,i)=>{
        if(!data.injuryWeeks.has(w.week)) return;
        const x=pad.l+i*xStep;
        ctx.fillStyle='rgba(244,67,54,.15)';
        ctx.fillRect(x-xStep/2,pad.t,xStep,iH);
        ctx.fillStyle='#f44336';
        ctx.font=`bold ${11}px system-ui`;ctx.textAlign='center';
        ctx.fillText('🔴',x,pad.t+14);
    });

    // Dots
    data.weeklyLoads.forEach((w,i)=>{
        const x=pad.l+i*xStep, y=pad.t+iH-(w.load/maxLoad)*iH;
        ctx.beginPath();ctx.arc(x,y,4,0,Math.PI*2);
        ctx.fillStyle=data.injuryWeeks.has(w.week)?'#f44336':'#2196f3';
        ctx.fill();
    });

    // X axis labels
    ctx.fillStyle='rgba(128,128,128,.7)';ctx.font=`${9}px system-ui`;ctx.textAlign='center';
    data.weeklyLoads.forEach((w,i)=>{
        if(i%2===0){
            const x=pad.l+i*xStep;
            const label=`S${i+1}`;
            ctx.fillText(label,x,H-5);
        }
    });
};

// ============================================================
// SHARED STYLES (weekplan + medical + rehab + correlation)
// ============================================================

(function injectBatch4Styles(){
    if(document.getElementById('batch4-styles')) return;
    const s=document.createElement('style');s.id='batch4-styles';
    s.textContent=`
.weekplan-wrap{max-width:1000px;margin:0 auto;display:flex;flex-direction:column;gap:1rem;padding:1rem}
.weekplan-header{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}
.weekplan-summary-row{display:grid;grid-template-columns:repeat(4,1fr);gap:.75rem}
.wp-sum-card{background:var(--card-bg);border:1px solid var(--border-color);border-radius:10px;padding:.85rem 1rem;text-align:center;display:flex;flex-direction:column;gap:.25rem}
.wp-sum-val{font-size:1.6rem;font-weight:800;line-height:1}
.wp-sum-label{font-size:.72rem;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em}
.weekplan-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:.5rem}
.wp-day-card{background:var(--card-bg);border:1px solid var(--border-color);border-radius:10px;padding:.75rem .6rem;font-size:.82rem}
.wp-day-card.today{box-shadow:0 0 0 2px var(--primary-color)}
.wp-day-head{display:flex;align-items:center;justify-content:space-between;gap:.25rem;margin-bottom:.35rem}
.wp-day-name{font-weight:700;font-size:.85rem}
.wp-day-date{font-size:.72rem;color:var(--text-secondary)}
.wp-today-badge{font-size:.6rem;font-weight:700;background:var(--primary-color);color:white;padding:.1rem .3rem;border-radius:4px}
.wp-select{width:100%;padding:.3rem .35rem;border-radius:6px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);font-size:.78rem;cursor:pointer}
.wp-select-sm{font-size:.72rem}
.wp-input-sm{width:52px;padding:.25rem .35rem;border:1px solid var(--border-color);border-radius:5px;background:var(--card-bg);color:var(--text-color);font-size:.78rem;text-align:center}
.wp-input-focus{width:100%;padding:.25rem .35rem;border:1px solid var(--border-color);border-radius:5px;background:var(--card-bg);color:var(--text-color);font-size:.75rem;box-sizing:border-box}
.wp-real-sessions{display:flex;align-items:center;gap:.3rem;flex-wrap:wrap;margin-top:.4rem;padding-top:.4rem;border-top:1px solid var(--border-color)}
.wp-real-chip{display:flex;align-items:center;gap:.2rem;font-size:.7rem;background:var(--border-color);border-radius:10px;padding:.1rem .35rem}
.wp-filter-btn{padding:.3rem .7rem;border-radius:16px;border:1px solid var(--border-color);background:var(--card-bg);color:var(--text-color);cursor:pointer;font-size:.78rem;display:flex;align-items:center;gap:.3rem;transition:all .15s}
.wp-filter-btn.active{background:var(--primary-color);color:white;border-color:var(--primary-color)}
.btn-sm{padding:.35rem .75rem;font-size:.82rem}
.med-injury-card{margin-bottom:0}
.med-info-cell{display:flex;flex-direction:column;gap:.15rem;background:var(--border-color);border-radius:7px;padding:.45rem .6rem}
.mic-label{font-size:.7rem;color:var(--text-secondary);font-weight:600;text-transform:uppercase;letter-spacing:.03em}
.mic-val{font-size:.88rem;font-weight:600}
@media(max-width:900px){.weekplan-grid{grid-template-columns:repeat(4,1fr)}}
@media(max-width:640px){.weekplan-grid{grid-template-columns:repeat(2,1fr)}.weekplan-summary-row{grid-template-columns:repeat(2,1fr)}.weekplan-wrap{padding:.5rem}}
`;
    document.head.appendChild(s);
})();

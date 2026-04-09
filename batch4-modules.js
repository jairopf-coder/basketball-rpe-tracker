// ============================================================
//  Basketball RPE Tracker — Batch 4
//  batch4-modules.js
//  Contiene:
//    1. renderWeeklyPlanning    — Planificador semanal de carga
//    2. renderMedicalHistory    — Historial médico por jugadora
//    3. renderRehabLoad         — Carga durante readaptación
//    4. renderLoadInjuryCorrelation — Correlación carga-lesión
// ============================================================


// ============================================================
//  1. PLANIFICADOR SEMANAL DE CARGA
// ============================================================
//  Permite al técnico asignar sesiones planificadas para la
//  semana (tipo, RPE objetivo, duración, notas) y comparar
//  con lo realmente ejecutado.
// ============================================================

RPETracker.prototype.loadWeekPlan = function() {
    try {
        this.weekPlan = JSON.parse(localStorage.getItem('basketballWeekPlan') || '{}');
    } catch { this.weekPlan = {}; }
};

RPETracker.prototype.saveWeekPlan = function() {
    localStorage.setItem('basketballWeekPlan', JSON.stringify(this.weekPlan || {}));
};

RPETracker.prototype._wpCurrentMonday = function(offset) {
    const d = new Date();
    const day = d.getDay();
    const diff = (day === 0 ? -6 : 1 - day);
    d.setDate(d.getDate() + diff + (offset || 0) * 7);
    d.setHours(0,0,0,0);
    return d;
};

RPETracker.prototype._wpWeekKey = function(mondayDate) {
    return mondayDate.toISOString().slice(0,10);
};

RPETracker.prototype.renderWeeklyPlanning = function() {
    const container = document.getElementById('weeklyPlanView');
    if (!container) return;
    if (!this.weekPlan) this.loadWeekPlan();
    if (this._wpOffset === undefined) this._wpOffset = 0;

    const monday    = this._wpCurrentMonday(this._wpOffset);
    const weekKey   = this._wpWeekKey(monday);
    const weekData  = (this.weekPlan[weekKey] || {});

    const days = ['Lunes','Martes','Miércoles','Jueves','Viernes','Sábado','Domingo'];
    const dayKeys = days.map((_, i) => {
        const d = new Date(monday);
        d.setDate(d.getDate() + i);
        return d.toISOString().slice(0,10);
    });

    const mondayLabel = monday.toLocaleDateString('es-ES', {day:'2-digit', month:'long', year:'numeric'});
    const sundayLabel = new Date(monday.getTime() + 6*86400000).toLocaleDateString('es-ES', {day:'2-digit', month:'long'});

    // Build planned vs actual for each day
    const dayCards = days.map((dayName, i) => {
        const dk    = dayKeys[i];
        const plan  = weekData[dk] || null;
        const d     = new Date(dk);
        const dPlus = new Date(dk);
        dPlus.setDate(dPlus.getDate()+1);

        // Actual sessions on this day
        const actual = this.sessions.filter(s => {
            const sd = new Date(s.date);
            return sd >= d && sd < dPlus;
        });
        const isToday = dk === new Date().toISOString().slice(0,10);

        const planCard = plan ? `
            <div style="background:rgba(255,102,0,.08);border-radius:8px;padding:.6rem .8rem;font-size:.8rem;margin-bottom:.5rem;">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.3rem;">
                    <strong style="color:#ff6600;">${plan.type === 'match' ? '🏟️ Partido' : '🏀 Entrenamiento'}</strong>
                    <span style="color:#888;">${plan.duration} min</span>
                </div>
                <div>RPE objetivo: <strong style="color:${this.getRPEColor(plan.rpe)};">${plan.rpe}</strong> — ${this.getRPELabel(plan.rpe)}</div>
                ${plan.notes ? `<div style="color:#888;margin-top:.25rem;font-style:italic;">${plan.notes}</div>` : ''}
                <div style="margin-top:.4rem;display:flex;gap:.4rem;">
                    <button class="btn-secondary" style="font-size:.7rem;padding:.25rem .5rem;"
                        onclick="window.rpeTracker._wpEditSlot('${weekKey}','${dk}')">✏️ Editar</button>
                    <button class="btn-secondary" style="font-size:.7rem;padding:.25rem .5rem;color:#e74c3c;"
                        onclick="window.rpeTracker._wpDeleteSlot('${weekKey}','${dk}')">🗑️</button>
                </div>
            </div>` : `
            <div style="text-align:center;padding:.5rem;font-size:.78rem;color:#bbb;">
                <button class="btn-secondary" style="font-size:.75rem;"
                    onclick="window.rpeTracker._wpAddSlot('${weekKey}','${dk}')">+ Planificar</button>
            </div>`;

        const actualCards = actual.length ? actual.map(s => {
            const p = this.players.find(x=>x.id===s.playerId);
            const color = p ? PlayerTokens.get(p) : '#ccc';
            return `<div style="display:flex;align-items:center;gap:.4rem;font-size:.75rem;padding:.3rem .5rem;background:rgba(0,0,0,.04);border-radius:6px;margin-bottom:.25rem;">
                <div style="width:8px;height:8px;border-radius:50%;background:${color};flex-shrink:0;"></div>
                <span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${p?p.name:'?'}</span>
                <strong style="color:${this.getRPEColor(s.rpe)}">${s.rpe}</strong>
                <span style="color:#888;">${s.duration}m</span>
            </div>`;
        }).join('') : `<div style="font-size:.75rem;color:#ccc;text-align:center;">Sin sesiones</div>`;

        // Deviation indicator
        let deviationHtml = '';
        if (plan && actual.length) {
            const avgRpe = actual.reduce((s,x)=>s+x.rpe,0)/actual.length;
            const diff   = (avgRpe - plan.rpe).toFixed(1);
            const diffColor = Math.abs(diff) <= 1 ? '#4caf50' : Math.abs(diff) <= 2 ? '#ffc107' : '#f44336';
            deviationHtml = `<div style="font-size:.7rem;text-align:center;margin-top:.3rem;color:${diffColor};">
                RPE real: ${avgRpe.toFixed(1)} (${diff>0?'+':''}${diff})
            </div>`;
        }

        return `
        <div style="background:var(--bg-secondary,#f8f9fa);border-radius:12px;padding:.9rem;
            ${isToday?'border:2px solid #ff6600;':'border:1px solid transparent;'}">
            <div style="font-weight:700;font-size:.85rem;margin-bottom:.5rem;
                ${isToday?'color:#ff6600;':''}">
                ${dayName}
                <span style="font-weight:400;color:#888;font-size:.75rem;"> ${dk.slice(5)}</span>
                ${isToday?'<span style="background:#ff6600;color:#fff;border-radius:4px;padding:1px 5px;font-size:.65rem;margin-left:.3rem;">HOY</span>':''}
            </div>
            <div style="font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.3rem;">Planificado</div>
            ${planCard}
            <div style="font-size:.72rem;color:#888;text-transform:uppercase;letter-spacing:.04em;margin-bottom:.3rem;margin-top:.5rem;">Ejecutado (${actual.length})</div>
            ${actualCards}
            ${deviationHtml}
        </div>`;
    }).join('');

    // Week summary bar
    const totalPlanned = Object.values(weekData).filter(v=>v).length;
    const totalActual  = dayKeys.reduce((s,dk)=>{
        const d=new Date(dk), dp=new Date(dk); dp.setDate(dp.getDate()+1);
        return s + this.sessions.filter(x=>{const sd=new Date(x.date);return sd>=d&&sd<dp;}).length;
    },0);

    container.innerHTML = `
    <div style="max-width:1300px;margin:0 auto;padding:0 1rem 3rem;">

        <!-- Header -->
        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1rem;margin-bottom:1.5rem;">
            <div>
                <h2 style="margin:0;">📅 Planificación Semanal</h2>
                <div style="color:#888;font-size:.85rem;">${mondayLabel} — ${sundayLabel}</div>
            </div>
            <div style="display:flex;gap:.5rem;">
                <button class="btn-secondary" onclick="window.rpeTracker._wpNavigate(-1)">← Semana anterior</button>
                <button class="btn-secondary" onclick="window.rpeTracker._wpNavigate(0)">Hoy</button>
                <button class="btn-secondary" onclick="window.rpeTracker._wpNavigate(1)">Semana siguiente →</button>
            </div>
        </div>

        <!-- Summary bar -->
        <div style="display:flex;gap:1rem;margin-bottom:1.25rem;flex-wrap:wrap;">
            <div style="background:rgba(255,102,0,.1);border-radius:10px;padding:.6rem 1rem;font-size:.85rem;">
                📋 Sesiones planificadas: <strong>${totalPlanned}/7</strong>
            </div>
            <div style="background:rgba(76,175,80,.1);border-radius:10px;padding:.6rem 1rem;font-size:.85rem;">
                ✅ Sesiones ejecutadas: <strong>${totalActual}</strong>
            </div>
        </div>

        <!-- Week grid -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(175px,1fr));gap:.75rem;">
            ${dayCards}
        </div>
    </div>
    `;
};

RPETracker.prototype._wpNavigate = function(dirOrZero) {
    if (dirOrZero === 0) { this._wpOffset = 0; }
    else { this._wpOffset = (this._wpOffset||0) + dirOrZero; }
    this.renderWeeklyPlanning();
};

RPETracker.prototype._wpAddSlot = function(weekKey, dayKey) {
    this._wpOpenSlotModal(weekKey, dayKey, null);
};

RPETracker.prototype._wpEditSlot = function(weekKey, dayKey) {
    const plan = (this.weekPlan[weekKey]||{})[dayKey] || null;
    this._wpOpenSlotModal(weekKey, dayKey, plan);
};

RPETracker.prototype._wpDeleteSlot = function(weekKey, dayKey) {
    if (!confirm('¿Eliminar esta sesión planificada?')) return;
    if (this.weekPlan[weekKey]) {
        delete this.weekPlan[weekKey][dayKey];
        this.saveWeekPlan();
        this.renderWeeklyPlanning();
    }
};

RPETracker.prototype._wpOpenSlotModal = function(weekKey, dayKey, existing) {
    document.getElementById('wpSlotModal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'wpSlotModal';
    modal.className = 'modal active';
    modal.innerHTML = `
    <div class="modal-content modal-small" style="max-width:400px;">
        <div class="modal-header">
            <h2>${existing ? '✏️ Editar' : '+ Planificar'} sesión — ${dayKey}</h2>
            <button class="btn-close" onclick="document.getElementById('wpSlotModal').remove()">&times;</button>
        </div>
        <div style="padding:1.25rem 1.5rem;display:flex;flex-direction:column;gap:1rem;">
            <div class="form-group">
                <label>Tipo de sesión</label>
                <div style="display:flex;gap:.5rem;">
                    <label style="flex:1;display:flex;align-items:center;gap:.4rem;cursor:pointer;">
                        <input type="radio" name="wpType" value="training" ${(!existing||existing.type==='training')?'checked':''}> 🏀 Entrenamiento
                    </label>
                    <label style="flex:1;display:flex;align-items:center;gap:.4rem;cursor:pointer;">
                        <input type="radio" name="wpType" value="match" ${existing?.type==='match'?'checked':''}> 🏟️ Partido
                    </label>
                </div>
            </div>
            <div class="form-group">
                <label>RPE objetivo (1-10): <strong id="wpRpeVal">${existing?.rpe||6}</strong></label>
                <input type="range" id="wpRpe" min="1" max="10" value="${existing?.rpe||6}"
                    oninput="document.getElementById('wpRpeVal').textContent=this.value">
            </div>
            <div class="form-group">
                <label>Duración (minutos)</label>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap;">
                    ${[30,45,60,90,120].map(d=>`
                    <button type="button" class="btn-secondary" style="padding:.3rem .6rem;font-size:.8rem;"
                        onclick="document.getElementById('wpDuration').value=${d};this.parentNode.querySelectorAll('button').forEach(b=>b.classList.remove('selected'));this.classList.add('selected');"
                        >${d}</button>`).join('')}
                </div>
                <input type="number" id="wpDuration" value="${existing?.duration||60}" min="10" max="300"
                    style="width:100%;margin-top:.4rem;padding:.4rem;border-radius:8px;border:1px solid #ddd;">
            </div>
            <div class="form-group">
                <label>Notas</label>
                <input type="text" id="wpNotes" value="${existing?.notes||''}" placeholder="Ej: Trabajo táctico, tiros libres..."
                    style="width:100%;padding:.4rem;border-radius:8px;border:1px solid #ddd;">
            </div>
        </div>
        <div class="modal-footer">
            <button class="btn-secondary" onclick="document.getElementById('wpSlotModal').remove()">Cancelar</button>
            <button class="btn-primary" onclick="window.rpeTracker._wpSaveSlot('${weekKey}','${dayKey}')">💾 Guardar</button>
        </div>
    </div>`;
    document.body.appendChild(modal);
};

RPETracker.prototype._wpSaveSlot = function(weekKey, dayKey) {
    if (!this.weekPlan[weekKey]) this.weekPlan[weekKey] = {};
    this.weekPlan[weekKey][dayKey] = {
        type:     document.querySelector('input[name="wpType"]:checked')?.value || 'training',
        rpe:      parseInt(document.getElementById('wpRpe')?.value || 6),
        duration: parseInt(document.getElementById('wpDuration')?.value || 60),
        notes:    document.getElementById('wpNotes')?.value || '',
    };
    this.saveWeekPlan();
    document.getElementById('wpSlotModal')?.remove();
    this.showToast('📅 Sesión planificada guardada', 'success');
    this.renderWeeklyPlanning();
};


// ============================================================
//  2. HISTORIAL MÉDICO
// ============================================================

RPETracker.prototype.renderMedicalHistory = function() {
    const container = document.getElementById('medicalHistoryView');
    if (!container) return;

    if (this._medFilterPlayer === undefined) this._medFilterPlayer = 'all';

    const injuries = (this.injuries || []);

    const playerOpts = `<option value="all">Todas las jugadoras</option>` +
        this.players.map(p=>`<option value="${p.id}" ${this._medFilterPlayer===p.id?'selected':''}>${p.name}</option>`).join('');
    const statusOpts = `
        <option value="all" ${this._medFilterStatus==='all'?'selected':''}>Todos los estados</option>
        <option value="active" ${this._medFilterStatus==='active'?'selected':''}>Activa (lesionada)</option>
        <option value="recovered" ${this._medFilterStatus==='recovered'?'selected':''}>Recuperada</option>
        <option value="recurring" ${this._medFilterStatus==='recurring'?'selected':''}>Recaída</option>`;

    let filtered = injuries;
    if (this._medFilterPlayer !== 'all') filtered = filtered.filter(i=>i.playerId===this._medFilterPlayer);
    if (this._medFilterStatus && this._medFilterStatus !== 'all') filtered = filtered.filter(i=>i.status===this._medFilterStatus);

    filtered = [...filtered].sort((a,b)=>new Date(b.startDate)-new Date(a.startDate));

    const totalDays = injuries.reduce((s,inj)=>{
        const start=new Date(inj.startDate), end=inj.endDate?new Date(inj.endDate):new Date();
        return s+Math.ceil((end-start)/86400000);
    },0);
    const activeCount = injuries.filter(i=>i.status==='active').length;
    const recoveredCount = injuries.filter(i=>i.status==='recovered').length;

    const typeIcon = { muscle:'💪', joint:'🦵', bone:'🦴', other:'❓' };
    const sevColor = { minor:'#4caf50', moderate:'#ffc107', severe:'#f44336' };
    const sevLabel = { minor:'Leve', moderate:'Moderada', severe:'Grave' };
    const stLabel  = { active:'🔴 Lesionada', recovered:'✅ Recuperada', recurring:'🔁 Recaída' };

    const rows = filtered.map(inj => {
        const player = this.players.find(p=>p.id===inj.playerId);
        const color  = player ? PlayerTokens.get(player) : '#ccc';
        const days   = inj.getDaysInjured ? inj.getDaysInjured() : Math.ceil((new Date()-(new Date(inj.startDate)))/86400000);
        const missed = inj.missedSessions || 0;
        const retDate = inj.endDate
            ? new Date(inj.endDate).toLocaleDateString('es-ES')
            : (inj.getExpectedReturn ? (inj.getExpectedReturn()?.toLocaleDateString('es-ES') || '—') : '—');

        return `
        <tr onclick="window.rpeTracker._medShowDetail('${inj.id}')" style="cursor:pointer;">
            <td>
                <div style="display:flex;align-items:center;gap:.5rem;">
                    <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;"></div>
                    <span>${player?.name||'Desconocida'}</span>
                </div>
            </td>
            <td>${typeIcon[inj.type]||'❓'} ${inj.getTypeName?inj.getTypeName():inj.type}</td>
            <td>${inj.getLocationName?inj.getLocationName():inj.location}</td>
            <td><span style="background:${sevColor[inj.severity]}22;color:${sevColor[inj.severity]};border-radius:4px;padding:2px 6px;font-size:.75rem;">${sevLabel[inj.severity]||inj.severity}</span></td>
            <td>${new Date(inj.startDate).toLocaleDateString('es-ES')}</td>
            <td>${retDate}</td>
            <td style="font-weight:600;">${days} días</td>
            <td>${missed}</td>
            <td>${stLabel[inj.status]||inj.status}</td>
        </tr>`;
    }).join('');

    // Timeline chart per player
    const timelineHtml = this._medBuildTimeline(injuries);

    container.innerHTML = `
    <div style="max-width:1300px;margin:0 auto;padding:0 1rem 3rem;">
        <h2 style="margin-bottom:1.25rem;">📋 Historial Médico</h2>

        <!-- KPIs -->
        <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-bottom:1.5rem;">
            ${[
                ['🏥 Total lesiones', injuries.length, '#5c6bc0'],
                ['🔴 Activas',        activeCount,      '#f44336'],
                ['✅ Recuperadas',    recoveredCount,   '#4caf50'],
                ['📅 Días de baja',   totalDays,        '#ff9800'],
            ].map(([label,val,color])=>`
            <div style="background:${color}15;border-radius:12px;padding:.75rem 1.25rem;flex:1;min-width:130px;">
                <div style="font-size:.75rem;color:#888;">${label}</div>
                <div style="font-size:1.8rem;font-weight:800;color:${color};">${val}</div>
            </div>`).join('')}
        </div>

        <!-- Filters -->
        <div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:1rem;">
            <select class="filter-select" onchange="window.rpeTracker._medFilterPlayer=this.value;window.rpeTracker.renderMedicalHistory();">
                ${playerOpts}
            </select>
            <select class="filter-select" onchange="window.rpeTracker._medFilterStatus=this.value;window.rpeTracker.renderMedicalHistory();">
                ${statusOpts}
            </select>
        </div>

        <!-- Timeline visual -->
        ${timelineHtml}

        <!-- Table -->
        <div style="overflow-x:auto;background:var(--bg-secondary,#f8f9fa);border-radius:16px;padding:1rem;">
            ${filtered.length ? `
            <table class="wellness-table" style="min-width:800px;">
                <thead><tr>
                    <th>Jugadora</th><th>Tipo</th><th>Zona</th><th>Gravedad</th>
                    <th>Inicio</th><th>Alta / Prevista</th><th>Duración</th><th>Sesiones perdidas</th><th>Estado</th>
                </tr></thead>
                <tbody>${rows}</tbody>
            </table>` : `
            <div style="text-align:center;padding:2rem;color:#aaa;">
                <div style="font-size:2rem;margin-bottom:.5rem;">📋</div>
                No hay lesiones registradas con los filtros actuales.
            </div>`}
        </div>

        <!-- Detail panel -->
        <div id="medDetailPanel" style="margin-top:1.5rem;"></div>
    </div>`;
};

RPETracker.prototype._medBuildTimeline = function(injuries) {
    if (!injuries.length) return '';

    const months = 6;
    const now = new Date();
    const start = new Date(now); start.setMonth(start.getMonth()-months); start.setDate(1);
    const totalDays = Math.ceil((now-start)/86400000);

    const bars = this.players.map(player => {
        const playerInjuries = injuries.filter(i=>i.playerId===player.id);
        if (!playerInjuries.length) return null;

        const color = PlayerTokens.get(player);
        const injBars = playerInjuries.map(inj => {
            const s = new Date(inj.startDate);
            const e = inj.endDate ? new Date(inj.endDate) : now;
            if (e < start) return '';
            const ss = Math.max(0, Math.ceil((s-start)/86400000));
            const ee = Math.min(totalDays, Math.ceil((e-start)/86400000));
            const left  = (ss/totalDays*100).toFixed(1);
            const width = Math.max(.5, ((ee-ss)/totalDays*100)).toFixed(1);
            const sevColor = {minor:'#4caf50',moderate:'#ffc107',severe:'#f44336'}[inj.severity]||'#999';
            return `<div style="position:absolute;left:${left}%;width:${width}%;height:16px;background:${sevColor};border-radius:3px;top:2px;opacity:.85;" title="${inj.getTypeName?inj.getTypeName():inj.type} — ${inj.getLocationName?inj.getLocationName():inj.location}"></div>`;
        }).join('');

        return `
        <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:.35rem;">
            <div style="width:110px;font-size:.75rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;color:${color};font-weight:600;">${player.name}</div>
            <div style="flex:1;position:relative;height:20px;background:#e0e0e055;border-radius:4px;">${injBars}</div>
        </div>`;
    }).filter(Boolean).join('');

    if (!bars) return '';

    // Month labels
    const monthLabels = Array.from({length:months+1},(_,i)=>{
        const d=new Date(start); d.setMonth(d.getMonth()+i);
        const left=(Math.ceil((d-start)/86400000)/totalDays*100).toFixed(1);
        return `<div style="position:absolute;left:${left}%;font-size:.7rem;color:#888;white-space:nowrap;">${d.toLocaleDateString('es-ES',{month:'short'})}</div>`;
    }).join('');

    return `
    <div style="background:var(--bg-secondary,#f8f9fa);border-radius:16px;padding:1.25rem;margin-bottom:1.25rem;">
        <h3 style="margin:0 0 1rem;font-size:.9rem;">📅 Cronología de lesiones — últimos ${months} meses</h3>
        ${bars}
        <div style="position:relative;height:16px;margin-top:.25rem;margin-left:110px;">${monthLabels}</div>
        <div style="display:flex;gap:.75rem;margin-top:.5rem;font-size:.72rem;color:#888;">
            <span><span style="display:inline-block;width:10px;height:10px;background:#4caf50;border-radius:2px;margin-right:.3rem;"></span>Leve</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:#ffc107;border-radius:2px;margin-right:.3rem;"></span>Moderada</span>
            <span><span style="display:inline-block;width:10px;height:10px;background:#f44336;border-radius:2px;margin-right:.3rem;"></span>Grave</span>
        </div>
    </div>`;
};

RPETracker.prototype._medShowDetail = function(injuryId) {
    const inj = (this.injuries||[]).find(i=>i.id===injuryId);
    const panel = document.getElementById('medDetailPanel');
    if (!inj||!panel) return;

    const player = this.players.find(p=>p.id===inj.playerId);
    const color  = player ? PlayerTokens.get(player) : '#ccc';
    const days   = inj.getDaysInjured ? inj.getDaysInjured() : '?';
    const sevLabel = {minor:'Leve 🟢', moderate:'Moderada 🟡', severe:'Grave 🔴'};
    const stLabel  = {active:'🔴 Lesionada', recovered:'✅ Recuperada', recurring:'🔁 Recaída'};
    const phase    = inj.rtpPhase || 1;

    const histRows = (inj.history||[]).slice(-8).reverse().map(h=>`
        <tr>
            <td>${new Date(h.date).toLocaleDateString('es-ES')}</td>
            <td>Fase ${h.phase||'—'}</td>
            <td>${h.progress||0}%</td>
            <td>${h.notes||'—'}</td>
        </tr>`).join('');

    panel.innerHTML = `
    <div style="background:var(--bg-secondary,#f8f9fa);border-radius:16px;padding:1.5rem;border-top:4px solid ${color};">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1rem;flex-wrap:wrap;gap:.5rem;">
            <div style="display:flex;align-items:center;gap:.75rem;">
                ${player ? PlayerTokens.avatar(player,42,'1rem','') : ''}
                <div>
                    <h3 style="margin:0;">${player?.name||'?'} — ${inj.getLocationName?inj.getLocationName():inj.location}</h3>
                    <div style="font-size:.8rem;color:#888;">${inj.getTypeName?inj.getTypeName():inj.type} · ${sevLabel[inj.severity]||inj.severity}</div>
                </div>
            </div>
            <button class="btn-secondary" onclick="document.getElementById('medDetailPanel').innerHTML=''">✕ Cerrar</button>
        </div>
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:.75rem;margin-bottom:1rem;">
            ${[
                ['Estado',           stLabel[inj.status]||inj.status],
                ['Inicio',           new Date(inj.startDate).toLocaleDateString('es-ES')],
                ['Días de baja',     days],
                ['Sesiones perdidas',inj.missedSessions||0],
                ['Fase RTP',         `${phase}/6`],
                ['Progreso RTP',     `${inj.rtpProgress||0}%`],
            ].map(([l,v])=>`
            <div style="background:var(--bg-primary,#fff);border-radius:10px;padding:.6rem .9rem;">
                <div style="font-size:.72rem;color:#888;">${l}</div>
                <div style="font-weight:700;">${v}</div>
            </div>`).join('')}
        </div>
        ${inj.description ? `<div style="background:rgba(255,102,0,.06);border-radius:8px;padding:.75rem;margin-bottom:.75rem;font-size:.85rem;">${inj.description}</div>` : ''}
        ${inj.notes ? `<div style="background:rgba(0,0,0,.04);border-radius:8px;padding:.75rem;font-size:.85rem;color:#555;">${inj.notes}</div>` : ''}
        ${(inj.history||[]).length ? `
        <h4 style="margin:1rem 0 .5rem;">Actualizaciones RTP</h4>
        <div style="overflow-x:auto;">
            <table class="wellness-table">
                <thead><tr><th>Fecha</th><th>Fase</th><th>Progreso</th><th>Notas</th></tr></thead>
                <tbody>${histRows}</tbody>
            </table>
        </div>` : ''}
    </div>`;
};


// ============================================================
//  3. CARGA DURANTE READAPTACIÓN
// ============================================================

RPETracker.prototype.renderRehabLoad = function() {
    const container = document.getElementById('rehabLoadView');
    if (!container) return;

    const activeInjuries = (this.injuries||[]).filter(i=>i.status==='active');

    if (!activeInjuries.length) {
        container.innerHTML = `
        <div style="max-width:900px;margin:0 auto;padding:1rem;">
            <h2 style="margin-bottom:1rem;">💪 Carga en Readaptación</h2>
            <div class="empty-state">
                <div class="empty-icon">💪</div>
                <h3>No hay jugadoras lesionadas</h3>
                <p>Cuando haya lesiones activas aparecerá aquí el seguimiento de readaptación.</p>
            </div>
        </div>`;
        return;
    }

    const cards = activeInjuries.map(inj => {
        const player  = this.players.find(p=>p.id===inj.playerId);
        if (!player) return '';
        const color   = PlayerTokens.get(player);
        const days    = inj.getDaysInjured ? inj.getDaysInjured() : '?';
        const phase   = inj.rtpPhase || 1;
        const prog    = inj.rtpProgress || 0;

        // Get sessions during injury for this player
        const injStart = new Date(inj.startDate);
        const injSessions = this.sessions.filter(s => {
            return s.playerId === player.id && new Date(s.date) >= injStart;
        }).sort((a,b)=>new Date(a.date)-new Date(b.date));

        // Phase descriptions
        const phaseDesc = [
            'Protección y reposo',
            'Movilidad y propiocepción',
            'Fuerza y control neuromuscular',
            'Entrenamiento específico sin contacto',
            'Entrenamiento con contacto controlado',
            'Retorno completo al equipo',
        ];

        const phaseProgress = `
        <div style="display:flex;gap:3px;margin:0.6rem 0;">
            ${Array.from({length:6},(_,i)=>`
            <div style="flex:1;height:8px;border-radius:4px;background:${i<phase?color:'#e0e0e0'};"
                title="Fase ${i+1}: ${phaseDesc[i]}"></div>`).join('')}
        </div>
        <div style="display:flex;justify-content:space-between;font-size:.7rem;color:#888;margin-bottom:.5rem;">
            <span>Fase ${phase}/6: ${phaseDesc[phase-1]}</span>
            <span>RTP ${prog}%</span>
        </div>`;

        // Rehab session chart (last 21 days)
        const chartId = `rehabChart_${inj.id}`;
        const last21 = Array.from({length:21},(_,i)=>{
            const d=new Date(); d.setDate(d.getDate()-(20-i)); return d.toISOString().slice(0,10);
        });

        const sessRows = injSessions.slice(-6).reverse().map(s=>`
        <tr>
            <td>${new Date(s.date).toLocaleDateString('es-ES',{day:'2-digit',month:'short'})}</td>
            <td>${s.type==='match'?'🏟️ Partido':'🏀 Entrenamiento'}</td>
            <td><strong style="color:${this.getRPEColor(s.rpe)}">${s.rpe}</strong></td>
            <td>${s.duration} min</td>
            <td>${s.rpe*s.duration}</td>
            <td>${s.notes||'—'}</td>
        </tr>`).join('');

        const ratio = this.calculateAcuteChronicRatio(player.id);
        const ratioColor = ratio.ratio==='N/A'?'#888':
            parseFloat(ratio.ratio)>=1.5?'#f44336':parseFloat(ratio.ratio)>=1.3?'#ffc107':'#4caf50';

        return `
        <div style="background:var(--bg-secondary,#f8f9fa);border-radius:16px;padding:1.25rem;border-top:4px solid ${color};margin-bottom:1.25rem;">
            <div style="display:flex;align-items:center;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap;">
                ${PlayerTokens.avatar(player,44,'1.1rem','')}
                <div style="flex:1;min-width:0;">
                    <h3 style="margin:0;">${player.name}${player.number?` <span style="color:#888;">#${player.number}</span>`:''}</h3>
                    <div style="font-size:.8rem;color:#888;">${inj.getTypeName?inj.getTypeName():inj.type} — ${inj.getLocationName?inj.getLocationName():inj.location} · ${days} días de baja</div>
                </div>
                <div style="text-align:right;">
                    <div style="font-size:.7rem;color:#888;">Ratio A:C</div>
                    <div style="font-size:1.4rem;font-weight:800;color:${ratioColor};">${ratio.ratio}</div>
                </div>
            </div>

            ${phaseProgress}

            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;">
                <!-- Chart -->
                <div>
                    <div style="font-size:.78rem;color:#888;font-weight:600;margin-bottom:.4rem;">Carga diaria — últimas 3 semanas</div>
                    <canvas id="${chartId}" height="90"></canvas>
                </div>
                <!-- Table -->
                <div>
                    <div style="font-size:.78rem;color:#888;font-weight:600;margin-bottom:.4rem;">Últimas sesiones de readaptación</div>
                    ${sessRows ? `
                    <table class="wellness-table">
                        <thead><tr><th>Fecha</th><th>Tipo</th><th>RPE</th><th>Min</th><th>Carga</th><th>Notas</th></tr></thead>
                        <tbody>${sessRows}</tbody>
                    </table>` : '<p style="font-size:.8rem;color:#aaa;">Sin sesiones registradas.</p>'}
                </div>
            </div>

            <div style="margin-top:.75rem;">
                <button class="btn-secondary" style="font-size:.8rem;"
                    onclick="window.rpeTracker.switchView('injury')">🏥 Ver ficha completa</button>
            </div>
        </div>`;
    }).join('');

    container.innerHTML = `
    <div style="max-width:1100px;margin:0 auto;padding:0 1rem 3rem;">
        <h2 style="margin-bottom:1.25rem;">💪 Carga en Readaptación</h2>
        ${cards}
    </div>`;

    // Draw charts
    requestAnimationFrame(() => {
        activeInjuries.forEach(inj => {
            const player = this.players.find(p=>p.id===inj.playerId);
            if (!player) return;
            this._rehabDrawChart(inj, player);
        });
    });
};

RPETracker.prototype._rehabDrawChart = function(inj, player) {
    const canvas = document.getElementById(`rehabChart_${inj.id}`);
    if (!canvas) return;

    const last21 = Array.from({length:21},(_,i)=>{
        const d=new Date(); d.setDate(d.getDate()-(20-i)); return d.toISOString().slice(0,10);
    });
    const injStart = new Date(inj.startDate);
    const color    = PlayerTokens.get(player);

    const loads = last21.map(dk => {
        const d=new Date(dk), dp=new Date(dk); dp.setDate(dp.getDate()+1);
        if (d < injStart) return { v:0, before:true };
        const sess = this.sessions.filter(s=>s.playerId===player.id&&new Date(s.date)>=d&&new Date(s.date)<dp);
        return { v: sess.reduce((s,x)=>s+(x.rpe*(x.duration||60)),0), before:false };
    });

    const maxLoad = Math.max(...loads.map(l=>l.v), 1);
    const W = canvas.offsetWidth||400, H=90;
    canvas.width=W; canvas.height=H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);

    const pad={l:8,r:8,t:6,b:18};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
    const barW = Math.max(2, cW/last21.length - 2);

    loads.forEach((item,i)=>{
        if (item.before) return;
        const h = item.v>0 ? Math.max(3, (item.v/maxLoad)*cH) : 2;
        const x = pad.l + i*(cW/last21.length);
        const y = pad.t+cH-h;
        ctx.fillStyle = item.v>0 ? color : '#e0e0e0';
        ctx.beginPath();
        ctx.roundRect(x, y, barW, h, 2);
        ctx.fill();
    });

    ctx.font='8px system-ui'; ctx.fillStyle='rgba(0,0,0,.4)'; ctx.textAlign='center';
    [0,10,20].forEach(i=>{ ctx.fillText(last21[i].slice(5), pad.l+i*(cW/last21.length)+barW/2, H-3); });
};


// ============================================================
//  4. CORRELACIÓN CARGA–LESIÓN
// ============================================================

RPETracker.prototype.renderLoadInjuryCorrelation = function() {
    const corrContainer = document.getElementById('correlationContentView') || document.getElementById('correlationView');
    if (!corrContainer) return;

    const injuries = this.injuries || [];

    if (!injuries.length || !this.sessions.length) {
        corrContainer.innerHTML = `
        <div style="max-width:900px;margin:0 auto;padding:1rem;">
            <h2>🔗 Correlación Carga-Lesión</h2>
            <div class="empty-state">
                <div class="empty-icon">🔗</div>
                <h3>Sin datos suficientes</h3>
                <p>Necesitas tener sesiones y al menos una lesión registrada.</p>
            </div>
        </div>`;
        return;
    }

    // Build per-player scatter data: ratio A:C 7 days before each injury
    const scatterPoints = injuries.map(inj => {
        const player = this.players.find(p=>p.id===inj.playerId);
        if (!player) return null;

        const injDate = new Date(inj.startDate);
        const weekBefore = new Date(injDate); weekBefore.setDate(weekBefore.getDate()-7);

        // Temporarily filter sessions to before injury
        const snapSessions = this.sessions.filter(s => s.playerId===player.id && new Date(s.date)<injDate);

        // Calculate EWMA ratio at injury date
        const lambdaA = 2/(7+1), lambdaC = 2/(28+1);
        let ewmaA=0, ewmaC=0;
        for (let i=42; i>=0; i--) {
            const d=new Date(injDate); d.setDate(d.getDate()-i); d.setHours(0,0,0,0);
            const nxt=new Date(d); nxt.setDate(nxt.getDate()+1);
            const dayLoad = snapSessions
                .filter(s=>{ const sd=new Date(s.date); sd.setHours(0,0,0,0); return sd.getTime()===d.getTime(); })
                .reduce((s,x)=>s+(x.rpe*(x.duration||60)),0);
            ewmaA = ewmaA*(1-lambdaA)+dayLoad*lambdaA;
            ewmaC = ewmaC*(1-lambdaC)+dayLoad*lambdaC;
        }
        const ratio = ewmaC>0 ? ewmaA/ewmaC : null;

        return {
            player, inj, ratio,
            severity: inj.severity,
            color: PlayerTokens.get(player),
        };
    }).filter(v=>v!==null&&v.ratio!==null);

    // Injury type distribution
    const byType = {};
    injuries.forEach(i=>{ byType[i.type]=(byType[i.type]||0)+1; });
    const byZone = {};
    injuries.forEach(i=>{ byZone[i.location]=(byZone[i.location]||0)+1; });
    const bySeverity = { minor:0, moderate:0, severe:0 };
    injuries.forEach(i=>{ bySeverity[i.severity]=(bySeverity[i.severity]||0)+1; });
    const byMonth = {};
    injuries.forEach(i=>{
        const mk = new Date(i.startDate).toLocaleDateString('es-ES',{month:'short',year:'2-digit'});
        byMonth[mk]=(byMonth[mk]||0)+1;
    });

    // Avg ratio by severity
    const avgRatio = {};
    ['minor','moderate','severe'].forEach(sev=>{
        const pts=scatterPoints.filter(p=>p.severity===sev).map(p=>p.ratio).filter(Boolean);
        avgRatio[sev]=pts.length ? (pts.reduce((s,v)=>s+v,0)/pts.length).toFixed(2) : '—';
    });

    // Zone table
    const zoneRows = Object.entries(byZone).sort((a,b)=>b[1]-a[1]).slice(0,8).map(([z,n])=>{
        const pct=(n/injuries.length*100).toFixed(0);
        return `<tr>
            <td>${z}</td>
            <td>${n}</td>
            <td>
                <div style="background:#e0e0e0;border-radius:4px;height:8px;overflow:hidden;">
                    <div style="height:100%;width:${pct}%;background:#ff6600;border-radius:4px;"></div>
                </div>
            </td>
        </tr>`;
    }).join('');

    corrContainer.innerHTML = `
    <div style="max-width:1200px;margin:0 auto;padding:0 1rem 3rem;">
        <h2 style="margin-bottom:1.25rem;">🔗 Correlación Carga-Lesión</h2>

        <!-- Severity by ratio -->
        <div class="wellness-chart-card">
            <h3 style="margin:0 0 .75rem;">Ratio A:C medio previo a la lesión por gravedad</h3>
            <div style="display:flex;gap:1rem;flex-wrap:wrap;">
                ${[['minor','🟢 Leve','#4caf50'],['moderate','🟡 Moderada','#ffc107'],['severe','🔴 Grave','#f44336']].map(([sev,label,color])=>`
                <div style="flex:1;min-width:130px;background:${color}15;border-radius:12px;padding:.75rem 1rem;text-align:center;">
                    <div style="font-size:.8rem;color:#888;">${label}</div>
                    <div style="font-size:2rem;font-weight:800;color:${color};">${avgRatio[sev]}</div>
                    <div style="font-size:.7rem;color:#888;">${injuries.filter(i=>i.severity===sev).length} lesiones</div>
                </div>`).join('')}
            </div>
            <div style="font-size:.75rem;color:#888;margin-top:.75rem;padding:.5rem;background:rgba(255,102,0,.06);border-radius:8px;">
                💡 Un ratio A:C &gt;1.3 las semanas previas a la lesión indica sobrecarga. Valores &lt;0.8 pueden indicar desentrenamiento y fragilidad.
            </div>
        </div>

        <!-- Charts row -->
        <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(340px,1fr));gap:1rem;margin-bottom:1rem;">

            <!-- Scatter ratio vs severity -->
            <div class="wellness-chart-card">
                <h3 style="margin:0 0 .75rem;font-size:.9rem;">Ratio A:C al inicio de lesión</h3>
                <canvas id="corrScatterChart" height="160"></canvas>
            </div>

            <!-- Zona corporal -->
            <div class="wellness-chart-card">
                <h3 style="margin:0 0 .75rem;font-size:.9rem;">Lesiones por zona corporal</h3>
                <table class="wellness-table">
                    <thead><tr><th>Zona</th><th>N</th><th>Frecuencia</th></tr></thead>
                    <tbody>${zoneRows}</tbody>
                </table>
            </div>
        </div>

        <!-- Monthly trend -->
        <div class="wellness-chart-card">
            <h3 style="margin:0 0 .75rem;font-size:.9rem;">📅 Lesiones por mes</h3>
            <canvas id="corrMonthChart" height="100"></canvas>
        </div>

        <!-- Player summary -->
        <div class="wellness-chart-card" style="margin-top:0;">
            <h3 style="margin:0 0 .75rem;font-size:.9rem;">Resumen por jugadora</h3>
            <div style="overflow-x:auto;">
                <table class="wellness-table">
                    <thead><tr><th>Jugadora</th><th>Total lesiones</th><th>Días de baja</th><th>Sesiones perdidas</th><th>Última lesión</th></tr></thead>
                    <tbody>
                    ${this.players.map(p=>{
                        const pi=injuries.filter(i=>i.playerId===p.id);
                        if(!pi.length) return '';
                        const totalDays=pi.reduce((s,i)=>{
                            const st=new Date(i.startDate),en=i.endDate?new Date(i.endDate):new Date();
                            return s+Math.ceil((en-st)/86400000);
                        },0);
                        const missed=pi.reduce((s,i)=>s+(i.missedSessions||0),0);
                        const last=[...pi].sort((a,b)=>new Date(b.startDate)-new Date(a.startDate))[0];
                        const color=PlayerTokens.get(p);
                        return `<tr>
                            <td><div style="display:flex;align-items:center;gap:.5rem;">
                                <div style="width:8px;height:8px;border-radius:50%;background:${color};"></div>
                                ${p.name}
                            </div></td>
                            <td>${pi.length}</td>
                            <td>${totalDays}</td>
                            <td>${missed}</td>
                            <td>${new Date(last.startDate).toLocaleDateString('es-ES')}</td>
                        </tr>`;
                    }).join('')}
                    </tbody>
                </table>
            </div>
        </div>
    </div>`;

    requestAnimationFrame(() => {
        this._corrDrawScatter(scatterPoints);
        this._corrDrawMonthly(byMonth);
    });
};

RPETracker.prototype._corrDrawScatter = function(points) {
    const canvas = document.getElementById('corrScatterChart');
    if (!canvas||!points.length) return;

    const W=canvas.offsetWidth||400, H=160;
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);

    const pad={l:36,r:12,t:10,b:28};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;

    const sevX = {minor: cW*0.2, moderate: cW*0.5, severe: cW*0.8};
    const maxRatio = Math.max(...points.map(p=>p.ratio), 2);

    // Grid
    ctx.strokeStyle='rgba(0,0,0,.07)'; ctx.lineWidth=1;
    [0.5,1,1.3,1.5,2].forEach(v=>{
        const y=pad.t+cH*(1-v/maxRatio);
        ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cW,y); ctx.stroke();
        ctx.fillStyle='rgba(0,0,0,.4)'; ctx.font='9px system-ui'; ctx.textAlign='right';
        ctx.fillText(v,pad.l-3,y+3);
    });

    // Danger zone
    ctx.fillStyle='rgba(244,67,54,.07)';
    const dY=pad.t+cH*(1-1.5/maxRatio);
    ctx.fillRect(pad.l,pad.t,cW,dY-pad.t);

    // X labels
    ctx.font='9px system-ui'; ctx.textAlign='center'; ctx.fillStyle='rgba(0,0,0,.5)';
    ['Leve','Moderada','Grave'].forEach((l,i)=>{
        ctx.fillText(l, pad.l+[sevX.minor,sevX.moderate,sevX.severe][i], H-5);
    });

    // Y label
    ctx.save(); ctx.rotate(-Math.PI/2); ctx.font='9px system-ui'; ctx.fillStyle='rgba(0,0,0,.4)'; ctx.textAlign='center';
    ctx.fillText('Ratio A:C', -(pad.t+cH/2), 10);
    ctx.restore();

    // Dots with jitter
    points.forEach(p=>{
        const bx = pad.l + sevX[p.severity];
        const jitter = (Math.random()-0.5)*30;
        const x = bx + jitter;
        const y = pad.t+cH*(1-Math.min(p.ratio,maxRatio)/maxRatio);
        ctx.beginPath();
        ctx.arc(x,y,5,0,Math.PI*2);
        ctx.fillStyle = p.color+'cc';
        ctx.fill();
        ctx.strokeStyle='rgba(0,0,0,.2)'; ctx.lineWidth=1; ctx.stroke();
    });

    // 1.3 danger line label
    const dangerY=pad.t+cH*(1-1.3/maxRatio);
    ctx.strokeStyle='rgba(255,152,0,.6)'; ctx.lineWidth=1; ctx.setLineDash([4,3]);
    ctx.beginPath(); ctx.moveTo(pad.l,dangerY); ctx.lineTo(pad.l+cW,dangerY); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font='8px system-ui'; ctx.fillStyle='rgba(255,152,0,.9)'; ctx.textAlign='left';
    ctx.fillText('1.3 riesgo', pad.l+3, dangerY-2);
};

RPETracker.prototype._corrDrawMonthly = function(byMonth) {
    const canvas = document.getElementById('corrMonthChart');
    if (!canvas) return;

    const entries = Object.entries(byMonth);
    if (!entries.length) return;

    const W=canvas.offsetWidth||700, H=100;
    canvas.width=W; canvas.height=H;
    const ctx=canvas.getContext('2d');
    ctx.clearRect(0,0,W,H);

    const pad={l:28,r:8,t:8,b:22};
    const cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
    const maxN=Math.max(...entries.map(e=>e[1]),1);
    const barW=Math.max(10,(cW/entries.length)-4);

    entries.forEach(([month,n],i)=>{
        const h=Math.max(4,(n/maxN)*cH);
        const x=pad.l+i*(cW/entries.length);
        const y=pad.t+cH-h;
        ctx.fillStyle='#ff6600cc';
        ctx.beginPath();
        ctx.roundRect(x+1,y,barW,h,2);
        ctx.fill();
        ctx.fillStyle='rgba(0,0,0,.5)'; ctx.font='8px system-ui'; ctx.textAlign='center';
        ctx.fillText(month, x+barW/2+1, H-4);
        if(n>0){
            ctx.fillStyle='rgba(0,0,0,.6)'; ctx.fillText(n, x+barW/2+1, y-2);
        }
    });
};

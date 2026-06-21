// Basketball RPE Tracker - Wellness Dashboard (Batch 4)
// Seguimiento de bienestar subjetivo: sueño, energía, humor, dolor muscular

// ========== WELLNESS DATA ==========

RPETracker.prototype.loadWellnessData = function() {
    try {
        const raw = localStorage.getItem('basketballWellness');
        const data = raw ? JSON.parse(raw) : [];
        // fix P-04: registrar listener UNA sola vez para evitar acumulación
        // fix P-15: console.log eliminado en producción
        if (window.firebaseSync && !this._wellnessListenerSet) {
            this._wellnessListenerSet = true;
            window.firebaseSync.onWellnessChange(updated => {
                this.wellnessData = this._mergeWellnessPlayer(updated, this._wellnessPlayerCache || []);
                if (this.currentView === 'wellness') this.renderWellnessDashboard();
                if (this.currentView === 'dashboard') this.renderDashboard();
                if (window._devMode) console.log('🔄 Wellness actualizado desde Firebase');
            });
        }
        // Registrar listener para wellnessPlayer de todas las jugadoras vinculadas
        this._registerWellnessPlayerListeners();
        return data;
    } catch(e) { return []; }
};

/**
 * Registra listeners en /wellnessPlayer/{uid} para cada jugadora que tenga
 * authUid definido en su registro de player. Se llama una sola vez gracias
 * al flag _wellnessPlayerListenersSet.
 */
RPETracker.prototype._registerWellnessPlayerListeners = function() {
    if (this._wellnessPlayerListenersSet) return;
    if (!window.firebaseSync || !window.firebaseDB) return;
    this._wellnessPlayerListenersSet = true;
    this._wellnessPlayerCache = this._wellnessPlayerCache || [];

    // Escuchar el nodo completo /wellnessPlayer una sola vez.
    // Cada clave de primer nivel es un uid; dentro, {date: entry}.
    window.firebaseDB.ref('wellnessPlayer').on('value', snapshot => {
        const val = snapshot.val() || {};
        // Construir array plano con todos los entries, añadiendo uid si no está
        const allEntries = [];
        Object.keys(val).forEach(uid => {
            const dateMap = val[uid] || {};
            Object.values(dateMap).forEach(entry => {
                if (entry && typeof entry === 'object') {
                    allEntries.push(Object.assign({}, entry, { uid: entry.uid || uid }));
                }
            });
        });
        this._wellnessPlayerCache = allEntries;
        // Mezclar con wellness staff sin duplicados
        this.wellnessData = this._mergeWellnessPlayer(
            this.wellnessData || [],
            allEntries
        );
        if (this.currentView === 'wellness') this.renderWellnessDashboard();
        if (this.currentView === 'dashboard') this.renderDashboard();
        if (window._devMode) console.log('🔄 WellnessPlayer actualizado desde Firebase', allEntries.length, 'entries');
    });
};

/**
 * Mezcla entries del nodo staff (wellnessData) con entries del nodo jugadoras
 * (wellnessPlayer), resolviendo duplicados por (playerId, date).
 *
 * Estrategia:
 *  1. Los entries de staff (guardados manualmente) tienen prioridad.
 *  2. Un entry de wellnessPlayer se convierte a formato staff:
 *     - playerId: entry.playerId si existe, o se resuelve buscando en
 *       this.players el jugador cuyo authUid === entry.uid.
 *     - id generado: "wp_{uid}_{date}" para evitar colisiones con IDs staff.
 *  3. Solo se añade si no existe ya un entry staff con mismo playerId+date.
 *
 * @param {Array} staffEntries  Entries del nodo /wellness (fuente staff).
 * @param {Array} playerEntries Entries del nodo /wellnessPlayer (fuente jugadoras).
 * @returns {Array} Array fusionado sin duplicados.
 */
RPETracker.prototype._mergeWellnessPlayer = function(staffEntries, playerEntries) {
    if (!playerEntries || !playerEntries.length) return staffEntries;

    // Construir un Set de claves "playerId|date" ya presentes en staffEntries
    const staffKeys = new Set(
        (staffEntries || [])
            .filter(w => w.playerId && w.date)
            .map(w => w.playerId + '|' + w.date)
    );

    const extras = [];
    playerEntries.forEach(entry => {
        if (!entry || !entry.date) return;

        // Resolver playerId: campo explícito o búsqueda por authUid en this.players
        let playerId = entry.playerId || null;
        if (!playerId && entry.uid) {
            const linked = (this.players || []).find(p => p.authUid === entry.uid);
            if (linked) playerId = linked.id;
        }
        if (!playerId) return; // No se puede vincular — descartar silenciosamente

        const key = playerId + '|' + entry.date;
        if (staffKeys.has(key)) return; // Ya existe entrada staff — prioridad staff

        // Convertir a formato wellness staff
        extras.push({
            id:       'wp_' + entry.uid + '_' + entry.date,
            playerId: playerId,
            date:     entry.date,
            rpe:      entry.rpe  != null ? entry.rpe  : null,
            sleep:    entry.sleep   != null ? entry.sleep   : null,
            fatigue:  entry.fatigue != null ? entry.fatigue : null,
            mood:     entry.mood    != null ? entry.mood    : null,
            pain:     entry.pain    != null ? entry.pain    : null,
            ts:       entry.ts || null,
            source:   'player', // marca de origen para depuración
        });
        staffKeys.add(key); // evitar duplicados dentro de playerEntries
    });

    return (staffEntries || []).concat(extras);
};

RPETracker.prototype.saveWellnessData = function() {
    if (window.firebaseSync) {
        window.firebaseSync.saveWellnessData(this.wellnessData || []);
    } else {
        localStorage.setItem('basketballWellness', JSON.stringify(this.wellnessData || []));
    }
};

// ========== MAIN RENDER ==========

RPETracker.prototype.renderWellnessDashboard = function() {
    if (!this.wellnessData) this.wellnessData = this.loadWellnessData();
    const container = document.getElementById('wellnessDashboardView');
    if (!container) return;

    const today = new Date().toISOString().slice(0,10);
    const filledIds = new Set((this.wellnessData||[]).filter(w=>w.date===today).map(w=>w.playerId));
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate()-6);

    container.innerHTML = `
        <div class="wellness-wrap">
            <div class="wellness-header">
                <div>
                    <h2 style="margin:0 0 .25rem">❤️ Wellness del Equipo</h2>
                    <p style="margin:0;color:var(--text-secondary);font-size:.85rem">${this._wFmtDate(today)}</p>
                </div>
                <div style="display:flex;gap:.5rem;flex-wrap:wrap">
                    <button class="btn-secondary" onclick="window.rpeTracker?.openWellnessQuick()">⚡ Wellness rápido</button>
                    <button class="btn-primary" onclick="window.rpeTracker?.openWellnessForm()">➕ Registrar bienestar</button>
                </div>
            </div>
            ${this._renderWTodayStatus(filledIds, today)}
            ${this._renderWTeamSummary(sevenDaysAgo)}
            ${this._renderWPlayerTable(sevenDaysAgo)}
            ${this._renderWTrendChart()}
            ${this._renderWHistory()}
        </div>
        ${this._renderWModal(today)}`;

    requestAnimationFrame(() => this._drawWellnessTrendChart());

    const modal = document.getElementById('wellnessModal');
    if (modal) modal.addEventListener('click', e => { if(e.target===modal) this.closeWellnessModal(); });
};

// ========== TODAY STATUS ==========

RPETracker.prototype._renderWTodayStatus = function(filledIds, today) {
    if (!this.players.length) return `<div class="wellness-card" style="text-align:center;padding:2rem;color:var(--text-secondary)">
        <p style="font-size:2rem">👥</p><p>Añade jugadoras para registrar wellness.</p></div>`;

    const done = this.players.filter(p=>filledIds.has(p.id)).length;
    return `<div class="wellness-card">
        <h3 class="wellness-section-title">📋 Registros de hoy</h3>
        <div class="wellness-today-grid">
            ${this.players.map(p => {
                const entry = (this.wellnessData||[]).find(w=>w.playerId===p.id && w.date===today);
                const score = entry ? this._wOverall(entry) : null;
                return `<div class="wellness-today-chip ${entry?'filled':'pending'}"
                    onclick="window.rpeTracker?.openWellnessForm('${p.id}')"
                    title="${entry?'Editar':'Registrar'}">
                    ${PlayerTokens.avatar(p,26,'.65rem')}
                    <span class="wt-name">${p.name}${p.number?` <span style="opacity:.6">#${p.number}</span>`:''}</span>
                    ${entry
                        ? `<span class="wt-score" style="background:${this._wColor(score)}">${score.toFixed(1)}</span>`
                        : `<span class="wt-pending">—</span>`}
                </div>`;
            }).join('')}
        </div>
        <p style="margin:.75rem 0 0;font-size:.78rem;color:var(--text-secondary)">
            ✅ ${done} registradas &nbsp;|&nbsp; ⏳ ${this.players.length-done} pendientes — clic para registrar
        </p>
    </div>`;
};

// ========== TEAM SUMMARY ==========

RPETracker.prototype._renderWTeamSummary = function(sevenDaysAgo) {
    if (!this.players.length) return '';
    const recent = (this.wellnessData||[]).filter(w=>new Date(w.date)>=sevenDaysAgo);
    const metrics = ['sleep','fatigue','mood','soreness'];
    const labels  = {sleep:'😴 Sueño',fatigue:'⚡ Energía',mood:'😊 Humor',soreness:'💪 Muscular'};

    const avgs = metrics.map(m => {
        const vals = recent.filter(w=>w[m]!=null).map(w=>w[m]);
        return { m, label:labels[m], avg: vals.length ? vals.reduce((a,b)=>a+b,0)/vals.length : null };
    });

    const overallVals = avgs.filter(a=>a.avg!==null).map(a=>a.avg);
    const teamScore = overallVals.length ? overallVals.reduce((a,b)=>a+b,0)/overallVals.length : null;
    const alerts = this._wAlerts(recent);

    return `<div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:.5rem">
        <div class="wellness-card">
            <h3 class="wellness-section-title">📊 Media del equipo (7 días)</h3>
            ${avgs.map(a=>`<div class="wellness-metric-row">
                <span class="wm-label">${a.label}</span>
                <div class="wm-bar-wrap"><div class="wm-bar-fill" style="width:${a.avg?(a.avg/5*100).toFixed(0):0}%;background:${a.avg?this._wColor(a.avg):'#ddd'}"></div></div>
                <span class="wm-val" style="color:${a.avg?this._wColor(a.avg):'var(--text-secondary)'}">
                    ${a.avg!==null?a.avg.toFixed(1):'—'}</span>
            </div>`).join('')}
            <div style="margin-top:.75rem;padding-top:.75rem;border-top:1px solid var(--border-color);display:flex;align-items:center;gap:.5rem">
                <span style="font-weight:600;color:var(--text-secondary);font-size:.85rem">Global:</span>
                <span style="font-size:1.4rem;font-weight:700;color:${teamScore?this._wColor(teamScore):'var(--text-secondary)'}">
                    ${teamScore!==null?teamScore.toFixed(1):'—'} / 5</span>
            </div>
        </div>
        <div class="wellness-card">
            <h3 class="wellness-section-title">⚠️ Alertas de bienestar</h3>
            ${alerts.length===0
                ? `<div style="text-align:center;padding:1.5rem 0;color:var(--text-secondary)">
                    <div style="font-size:2rem">🟢</div>
                    <p style="margin:.5rem 0 0;font-size:.88rem">Todo el equipo en buen estado</p></div>`
                : alerts.map(a=>`<div class="wellness-alert-row">
                    <span class="wa-icon">${a.icon}</span>
                    <div class="wa-text"><strong>${a.name}</strong><span>${a.message}</span></div>
                  </div>`).join('')
            }
        </div>
    </div>`;
};

RPETracker.prototype._wTrendAlerts = function() {
    const alerts = [];
    const today = new Date(); today.setHours(0,0,0,0);

    this.players.forEach(p => {
        // Get last 7 days of data for this player, sorted ascending
        const pData = (this.wellnessData || [])
            .filter(w => w.playerId === p.id)
            .map(w => ({ ...w, _d: new Date(w.date) }))
            .filter(w => { const d = new Date(w._d); d.setHours(0,0,0,0); return (today - d) <= 7 * 86400000; })
            .sort((a, b) => a._d - b._d);

        if (pData.length < 3) return;

        // Check consecutive streak for a condition over last N days
        const checkStreak = (fieldFn, minRun) => {
            let run = 0, maxRun = 0;
            pData.forEach(w => {
                if (fieldFn(w)) { run++; maxRun = Math.max(maxRun, run); }
                else run = 0;
            });
            return maxRun >= minRun;
        };

        // Sueño ≤ 2 (raw value: 1 or 2 on 1-5 scale)
        if (checkStreak(w => w.sleep != null && w.sleep <= 2, 3)) {
            alerts.push({
                icon: '🔁',
                type: 'trend',
                name: p.name,
                message: 'Sueño deficiente 3+ días consecutivos (≤2/5)'
            });
        }

        // Agujetas ≥ 4 en escala inversa: soreness raw ≤ 2 significa mucho dolor
        if (checkStreak(w => w.soreness != null && w.soreness <= 2, 3)) {
            alerts.push({
                icon: '🔁',
                type: 'trend',
                name: p.name,
                message: 'Dolor muscular acumulado 3+ días consecutivos'
            });
        }
    });
    return alerts;
};

RPETracker.prototype._wAlerts = function(recentData) {
    const alerts = [];
    this.players.forEach(p => {
        const pData = recentData.filter(w=>w.playerId===p.id);
        if (!pData.length) return;
        const avg = m => { const v=pData.map(w=>w[m]).filter(x=>x!=null); return v.length?v.reduce((a,b)=>a+b,0)/v.length:null; };
        const sleep=avg('sleep'), fatigue=avg('fatigue'), mood=avg('mood'), soreness=avg('soreness');
        const overall = this._wOverall({sleep,fatigue,mood,soreness});
        if (overall < 2.5) alerts.push({icon:'🔴',name:p.name,message:`Bienestar muy bajo (${overall.toFixed(1)}/5)`});
        else if (sleep!==null && sleep<2.5) alerts.push({icon:'😴',name:p.name,message:`Sueño deficiente (${sleep.toFixed(1)}/5)`});
        else if (fatigue!==null && fatigue<2) alerts.push({icon:'⚡',name:p.name,message:`Fatiga elevada (energía ${fatigue.toFixed(1)}/5)`});
        else if (soreness!==null && soreness<2) alerts.push({icon:'💪',name:p.name,message:`Dolor muscular elevado (${soreness.toFixed(1)}/5)`});
    });

    // Add trend alerts (3-day streaks)
    const trendAlerts = typeof this._wTrendAlerts === 'function' ? this._wTrendAlerts() : [];
    trendAlerts.forEach(ta => {
        // Avoid duplicate if player already has a snapshot alert
        if (!alerts.some(a => a.name === ta.name && a.icon === ta.icon)) {
            alerts.push(ta);
        }
    });

    return alerts;
};

// ========== PLAYER TABLE ==========

RPETracker.prototype._renderWPlayerTable = function(sevenDaysAgo) {
    if (!this.players.length) return '';
    const recent = (this.wellnessData||[]).filter(w=>new Date(w.date)>=sevenDaysAgo);
    return `<div class="wellness-card">
        <h3 class="wellness-section-title">👥 Estado por jugadora (últimos 7 días)</h3>
        <div style="overflow-x:auto">
            <table class="wellness-player-table">
                <thead><tr>
                    <th>Jugadora</th><th>😴 Sueño</th><th>⚡ Energía</th>
                    <th>😊 Humor</th><th>💪 Muscular</th><th>Global</th><th>Tendencia</th>
                </tr></thead>
                <tbody>
                    ${this.players.map(p=>{
                        const pData=recent.filter(w=>w.playerId===p.id);
                        const avg=m=>{const v=pData.map(w=>w[m]).filter(x=>x!=null);return v.length?v.reduce((a,b)=>a+b,0)/v.length:null;};
                        const s=avg('sleep'),f=avg('fatigue'),m=avg('mood'),so=avg('soreness');
                        const overall=(s!==null||f!==null||m!==null||so!==null)?this._wOverall({sleep:s,fatigue:f,mood:m,soreness:so}):null;
                        const cell=v=>v!==null
                            ?`<td><span class="wt-badge" style="background:${this._wColor(v)}">${'★'.repeat(Math.round(v))}${'☆'.repeat(5-Math.round(v))}</span></td>`
                            :`<td style="color:var(--text-secondary)">—</td>`;
                        const trend=this._wTrend(p.id);
                        return `<tr>
                            <td><div style="display:flex;align-items:center;gap:.5rem">
                                ${PlayerTokens.avatar(p,22,'.6rem')}<span style="font-weight:600">${p.name}</span>
                            </div></td>
                            ${cell(s)}${cell(f)}${cell(m)}${cell(so)}
                            <td style="font-weight:700;color:${overall!==null?this._wColor(overall):'var(--text-secondary)'}">
                                ${overall!==null?overall.toFixed(1):'—'}</td>
                            <td style="font-size:1.1rem">${trend}</td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
        <p style="margin:.5rem 0 0;font-size:.75rem;color:var(--text-secondary)">
            ★★★★★ 5 = óptimo &nbsp;|&nbsp; ★★★ 3 = aceptable &nbsp;|&nbsp; ★ 1 = muy bajo
        </p>
    </div>`;
};

// ========== TREND CHART ==========

RPETracker.prototype._renderWTrendChart = function() {
    return `<div class="wellness-card">
        <h3 class="wellness-section-title">📈 Tendencia del equipo (últimos 14 días)</h3>
        <canvas id="wellnessTrendCanvas" height="160" style="width:100%;display:block"></canvas>
        <div style="display:flex;gap:1rem;flex-wrap:wrap;margin-top:.75rem;font-size:.78rem">
            <span><span style="display:inline-block;width:20px;height:3px;background:#2196f3;border-radius:2px;vertical-align:middle"></span> Sueño</span>
            <span><span style="display:inline-block;width:20px;height:3px;background:#ff9800;border-radius:2px;vertical-align:middle"></span> Energía</span>
            <span><span style="display:inline-block;width:20px;height:3px;background:#9c27b0;border-radius:2px;vertical-align:middle"></span> Humor</span>
            <span><span style="display:inline-block;width:20px;height:3px;background:#f44336;border-radius:2px;vertical-align:middle"></span> Muscular</span>
        </div>
    </div>`;
};

RPETracker.prototype._drawWellnessTrendChart = function() {
    const canvas = document.getElementById('wellnessTrendCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio||1;
    const rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width*dpr;
    canvas.height = 160*dpr;
    ctx.scale(dpr,dpr);
    const W=rect.width, H=160;
    const pad={t:10,r:20,b:28,l:32};
    const iW=W-pad.l-pad.r, iH=H-pad.t-pad.b;
    const days=14, dates=[];
    for(let i=days-1;i>=0;i--){const d=new Date();d.setDate(d.getDate()-i);dates.push(d.toISOString().slice(0,10));}

    // fix P-08: leer colores adaptativos según tema activo
    const isDark = document.documentElement.classList.contains('dark') ||
                   document.body.classList.contains('dark-mode') ||
                   window.matchMedia('(prefers-color-scheme: dark)').matches;
    const gridColor  = isDark ? 'rgba(255,255,255,.1)'  : 'rgba(128,128,128,.12)';
    const labelColor = isDark ? 'rgba(255,255,255,.5)'  : 'rgba(80,80,80,.8)';
    const colors=['#2196f3','#ff9800','#9c27b0','#f44336'];
    const metrics=['sleep','fatigue','mood','soreness'];
    const seriesData=metrics.map(m=>dates.map(date=>{
        const vals=(this.wellnessData||[]).filter(w=>w.date===date&&w[m]!=null).map(w=>w[m]);
        return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
    }));

    // Grid
    ctx.strokeStyle=gridColor; ctx.lineWidth=1;
    for(let i=1;i<=5;i++){
        const y=pad.t+iH-(i/5)*iH;
        ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+iW,y);ctx.stroke();
        ctx.fillStyle=labelColor;ctx.font=`${10}px system-ui`;ctx.textAlign='right';
        ctx.fillText(i,pad.l-4,y+3);
    }
    ctx.fillStyle=labelColor;ctx.textAlign='center';
    dates.forEach((date,i)=>{if(i%2===0){ctx.fillText(date.slice(5),pad.l+i*(iW/(days-1)),H-5);}});

    seriesData.forEach((series,si)=>{
        ctx.beginPath();ctx.strokeStyle=colors[si];ctx.lineWidth=2;ctx.lineJoin='round';
        let moved=false;
        series.forEach((val,i)=>{
            if(val===null)return;
            const x=pad.l+i*(iW/(days-1)), y=pad.t+iH-(val/5)*iH;
            if(!moved){ctx.moveTo(x,y);moved=true;}else ctx.lineTo(x,y);
        });
        ctx.stroke();
        series.forEach((val,i)=>{
            if(val===null)return;
            const x=pad.l+i*(iW/(days-1)), y=pad.t+iH-(val/5)*iH;
            ctx.beginPath();ctx.arc(x,y,3,0,Math.PI*2);ctx.fillStyle=colors[si];ctx.fill();
        });
    });
};

// ========== HISTORY ==========

RPETracker.prototype._renderWHistory = function() {
    const all=[...(this.wellnessData||[])].sort((a,b)=>b.date.localeCompare(a.date)).slice(0,30);
    if(!all.length) return `<div class="wellness-card" style="text-align:center;padding:2rem;color:var(--text-secondary)">
        <p style="font-size:2rem">📋</p><p>Sin registros aún. ¡Empieza hoy!</p></div>`;

    return `<div class="wellness-card">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:.75rem">
            <h3 class="wellness-section-title" style="margin:0">📋 Historial reciente</h3>
            <button class="btn-danger-sm" onclick="window.rpeTracker?._clearWellness()">🗑️ Limpiar todo</button>
        </div>
        <div style="overflow-x:auto">
            <table class="wellness-history-table">
                <thead><tr><th>Fecha</th><th>Jugadora</th><th>😴</th><th>⚡</th><th>😊</th><th>💪</th><th>Global</th><th>Notas</th><th></th></tr></thead>
                <tbody>
                    ${all.map(w=>{
                        const p=this.players.find(x=>x.id===w.playerId);
                        if(!p)return'';
                        const o=this._wOverall(w);
                        const dot=v=>v!=null?`<span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${this._wColor(v)}" title="${v}/5"></span> ${v}`:'—';
                        return `<tr>
                            <td style="white-space:nowrap;font-size:.8rem">${this._wFmtDate(w.date)}</td>
                            <td><div style="display:flex;align-items:center;gap:.35rem">${PlayerTokens.avatar(p,17,'.5rem')}<span style="font-size:.83rem">${p.name}</span></div></td>
                            <td style="font-size:.82rem">${dot(w.sleep)}</td>
                            <td style="font-size:.82rem">${dot(w.fatigue)}</td>
                            <td style="font-size:.82rem">${dot(w.mood)}</td>
                            <td style="font-size:.82rem">${dot(w.soreness)}</td>
                            <td><strong style="color:${this._wColor(o)}">${o.toFixed(1)}</strong></td>
                            <td style="font-size:.78rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w.notes||'—')}</td>
                            <td><button class="btn-icon-sm" onclick="window.rpeTracker?._deleteWellness('${w.id}')">🗑️</button></td>
                        </tr>`;
                    }).join('')}
                </tbody>
            </table>
        </div>
    </div>`;
};

// ========== MODAL ==========

RPETracker.prototype._renderWModal = function(today) {
    if(!this.players.length) return '';
    return `<div id="wellnessModal" class="modal modal--top" style="display:none">
        <div class="modal-content" style="max-width:480px">
            <div class="modal-header">
                <div class="modal-header-inner">
                    <h2 class="modal-title">❤️ Registrar Bienestar</h2>
                    <button class="close-btn" onclick="window.rpeTracker?.closeWellnessModal()">✕</button>
                </div>
            </div>
            <div class="modal-body" style="padding:1.25rem">
                <div class="form-group">
                    <label class="form-label">Jugadora</label>
                    <select id="wFormPlayer" class="form-select">
                        ${this.players.map(p=>`<option value="${p.id}">${esc(p.name)}${p.number?` #${p.number}`:''}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Fecha</label>
                    <input type="date" id="wFormDate" class="form-input" value="${today}" max="${today}">
                </div>
                ${['sleep','fatigue','mood','soreness'].map(m=>{
                    const config={
                        sleep:   {label:'😴 Calidad del sueño',   emojis:['😫','😞','😐','🙂','😄']},
                        fatigue: {label:'⚡ Nivel de energía',    emojis:['😴','🥱','😐','💪','⚡']},
                        mood:    {label:'😊 Estado de ánimo',     emojis:['😭','😟','😐','😊','😁']},
                        soreness:{label:'💪 Dolor muscular',      emojis:['🤕','😣','😐','🙂','✅']}
                    }[m];
                    const cap=m.charAt(0).toUpperCase()+m.slice(1);
                    const btns=[1,2,3,4,5].map(n=>`<button type="button"
                        class="wem-btn" data-metric="${m}" data-val="${n}"
                        title="${n}/5"
                        onclick="window.rpeTracker?._wSelectEmoji('${m}',${n},this)">
                        ${config.emojis[n-1]}
                    </button>`).join('');
                    return `<div class="form-group">
                        <label class="form-label">${config.label}</label>
                        <div class="wem-row" id="wEmRow${cap}">
                            <input type="hidden" id="wForm${cap}" data-metric="${m}" value="">
                            ${btns}
                            <span class="wem-hint" id="wVal${cap}"></span>
                        </div>
                    </div>`;
                }).join('')}
                <div class="form-group">
                    <label class="form-label">📝 Notas (opcional)</label>
                    <textarea id="wFormNotes" class="form-textarea" rows="2" placeholder="Estrés, viaje, enfermedad..."></textarea>
                </div>
            </div>
            <div class="modal-footer" style="flex-direction:column;gap:.6rem;align-items:stretch">
                <div id="wOverallPreview" class="wellness-overall-preview" style="margin:0">
                    <span style="color:var(--text-secondary);font-size:.88rem;font-weight:600">Puntuación global estimada:</span>
                    <strong id="wOverallScore" style="font-size:1.4rem">— / 5</strong>
                </div>
                <div style="display:flex;gap:.75rem">
                    <button class="btn-secondary" style="flex:1" onclick="window.rpeTracker?.closeWellnessModal()">Cancelar</button>
                    <button class="btn-primary" style="flex:1" onclick="window.rpeTracker?.saveWellnessEntry()">💾 Guardar</button>
                </div>
            </div>
        </div>
    </div>`;
};

// ========== FORM ACTIONS ==========

RPETracker.prototype.openWellnessForm = function(presetPlayerId) {
    const modal = document.getElementById('wellnessModal');
    if (!modal) { this.renderWellnessDashboard(); return; }
    modal.style.display = 'flex';

    // Event delegation for sliders (avoids inline rpeTracker ref timing issue)
    if (!modal._sliderDelegated) {
        modal._sliderDelegated = true;
        modal.addEventListener('input', e => {
            if (!e.target.classList.contains('wellness-slider')) return;
            const metric = e.target.dataset.metric;
            if (metric && window.rpeTracker) window.rpeTracker._wUpdateSlider(metric, e.target.value);
        });
    }

    if (presetPlayerId) {
        const sel = document.getElementById('wFormPlayer');
        if (sel) sel.value = presetPlayerId;
    }

    const playerId = document.getElementById('wFormPlayer')?.value;
    const date = document.getElementById('wFormDate')?.value;
    const existing = (this.wellnessData||[]).find(w=>w.playerId===playerId && w.date===date);

    ['sleep','fatigue','mood','soreness'].forEach(m=>{
        const cap=m.charAt(0).toUpperCase()+m.slice(1);
        const hidden=document.getElementById(`wForm${cap}`);
        if(hidden){
            const val = existing ? (existing[m] || null) : null;
            hidden.value = val || '';
            // Activate matching emoji button, or none if no existing entry
            const row=document.getElementById(`wEmRow${cap}`);
            if(row){
                row.querySelectorAll('.wem-btn').forEach(b=>{
                    const active = val && parseInt(b.dataset.val)===val;
                    b.classList.toggle('wem-btn--active', !!active);
                });
            }
            const hint=document.getElementById(`wVal${cap}`);
            if(hint){ hint.textContent=val?this._wEmojiLabel(val):''; hint.style.color=val?this._wColor(val):''; }
        }
    });
    if (existing) { const n=document.getElementById('wFormNotes'); if(n) n.value=existing.notes||''; }
    this._wUpdateOverallPreview();

    const sel = document.getElementById('wFormPlayer');
    if (sel) sel.onchange = () => {
        const pid=sel.value, dt=document.getElementById('wFormDate')?.value;
        const ex=(this.wellnessData||[]).find(w=>w.playerId===pid&&w.date===dt);
        ['sleep','fatigue','mood','soreness'].forEach(m=>{
            const cap=m.charAt(0).toUpperCase()+m.slice(1);
            const hidden=document.getElementById(`wForm${cap}`);
            const val = ex ? (ex[m] || null) : null;
            if(hidden){ hidden.value = val || ''; }
            const row=document.getElementById(`wEmRow${cap}`);
            if(row){ row.querySelectorAll('.wem-btn').forEach(b=>{ b.classList.toggle('wem-btn--active', val&&parseInt(b.dataset.val)===val); }); }
            const hint=document.getElementById(`wVal${cap}`);
            if(hint){ hint.textContent=val?this._wEmojiLabel(val):''; hint.style.color=val?this._wColor(val):''; }
        });
        const notes=document.getElementById('wFormNotes');
        if(notes) notes.value=ex?.notes||'';
        this._wUpdateOverallPreview();
    };
};

RPETracker.prototype.closeWellnessModal = function() {
    const m=document.getElementById('wellnessModal');
    if(m) m.style.display='none';
};

RPETracker.prototype._wUpdateSlider = function(metric, value) {
    const v=parseInt(value);
    const labels={1:'Muy malo / Muy bajo',2:'Malo / Bajo',3:'Aceptable',4:'Bueno',5:'Excelente'};
    const cap=metric.charAt(0).toUpperCase()+metric.slice(1);
    const disp=document.getElementById(`wVal${cap}`);
    if(disp){disp.textContent=`${v} — ${labels[v]}`;disp.style.color=this._wColor(v);}
    const pips=document.getElementById(`wPips${cap}`);
    if(pips){pips.innerHTML=[1,2,3,4,5].map(i=>
        `<span class="ws-pip ${i<=v?'active':''}" style="${i<=v?`background:${this._wColor(v)}`:''}" ></span>`).join('');}
    this._wUpdateOverallPreview();
};

RPETracker.prototype._wSelectEmoji = function(metric, val, btn) {
    const cap = metric.charAt(0).toUpperCase() + metric.slice(1);
    // Update hidden input
    const hidden = document.getElementById(`wForm${cap}`);
    if (hidden) hidden.value = val;
    // Toggle active class
    const row = document.getElementById(`wEmRow${cap}`);
    if (row) row.querySelectorAll('.wem-btn').forEach(b => {
        b.classList.toggle('wem-btn--active', parseInt(b.dataset.val) === val);
    });
    // Update hint
    const hint = document.getElementById(`wVal${cap}`);
    if (hint) { hint.textContent = this._wEmojiLabel(val); hint.style.color = this._wColor(val); }
    this._wUpdateOverallPreview();
};

RPETracker.prototype._wEmojiLabel = function(val) {
    return {1:'Muy malo',2:'Malo',3:'Aceptable',4:'Bueno',5:'Excelente'}[val] || '';
};

RPETracker.prototype._wUpdateOverallPreview = function() {
    const g=id=>{ const v=document.getElementById(id)?.value; return v?parseInt(v):null; };
    const s=g('wFormSleep'),f=g('wFormFatigue'),m=g('wFormMood'),so=g('wFormSoreness');
    const el=document.getElementById('wOverallScore');
    const wrap=document.getElementById('wOverallPreview');
    const filled=[s,f,m,so].filter(v=>v!==null);
    if(!filled.length){
        if(el){el.textContent='— / 5';el.style.color='var(--text-secondary)';}
        if(wrap) wrap.style.borderColor='var(--border-color)';
        return;
    }
    const overall=filled.reduce((a,b)=>a+b,0)/filled.length;
    if(el){el.textContent=`${overall.toFixed(1)} / 5`;el.style.color=this._wColor(overall);}
    if(wrap) wrap.style.borderColor=this._wColor(overall);
};

RPETracker.prototype.saveWellnessEntry = function() {
    if(!this.wellnessData) this.wellnessData=this.loadWellnessData();
    const playerId=document.getElementById('wFormPlayer')?.value;
    const date=document.getElementById('wFormDate')?.value;
    if(!playerId||!date){this.showToast('⚠️ Selecciona jugadora y fecha','warning');return;}
    const getMetric = m => { const v=document.getElementById(`wForm${m.charAt(0).toUpperCase()+m.slice(1)}`)?.value; return v?parseInt(v):null; };
    const sleepVal=getMetric('sleep'), fatigueVal=getMetric('fatigue'), moodVal=getMetric('mood'), sorenessVal=getMetric('soreness');
    if([sleepVal,fatigueVal,moodVal,sorenessVal].some(v=>v===null)){
        this.showToast('⚠️ Selecciona un valor para cada métrica','warning'); return;
    }
    const entry={
        id:`w_${playerId}_${date}`,playerId,date,
        sleep:sleepVal, fatigue:fatigueVal, mood:moodVal, soreness:sorenessVal,
        notes:document.getElementById('wFormNotes')?.value||'',
        savedAt:new Date().toISOString()
    };
    const idx=this.wellnessData.findIndex(w=>w.playerId===playerId&&w.date===date);
    if(idx>=0) this.wellnessData[idx]=entry; else this.wellnessData.push(entry);
    this.saveWellnessData();
    this.closeWellnessModal();
    this.showToast('✅ Bienestar registrado','success');
    this.renderWellnessDashboard();
};

RPETracker.prototype._deleteWellness = function(id) {
    AppConfirm.show({title:'¿Eliminar registro?',message:'Esta acción no se puede deshacer.',confirmText:'Eliminar',danger:true}).then(ok=>{ if(!ok) return;
    this.wellnessData=(this.wellnessData||[]).filter(w=>w.id!==id);
    this.saveWellnessData();
    this.showToast('🗑️ Registro eliminado','info');
    this.renderWellnessDashboard();
    });
};

RPETracker.prototype._clearWellness = function() {
    AppConfirm.show({title:'¿Eliminar TODOS los registros de bienestar?',message:'Esta acción no se puede deshacer.',confirmText:'Eliminar todo',danger:true}).then(ok=>{ if(!ok) return;
    this.wellnessData=[];this.saveWellnessData();
    this.showToast('🗑️ Historial eliminado','info');
    this.renderWellnessDashboard();
    });
};

// ========== HELPERS ==========

RPETracker.prototype._wOverall = function(w) {
    const vals=['sleep','fatigue','mood','soreness'].map(m=>w[m]).filter(v=>v!=null&&!isNaN(v));
    return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:0;
};

RPETracker.prototype._wColor = function(score) {
    if(score>=4.5) return '#4caf50';
    if(score>=3.5) return '#8bc34a';
    if(score>=2.5) return '#ff9800';
    if(score>=1.5) return '#ff5722';
    return '#f44336';
};

RPETracker.prototype._wTrend = function(playerId) {
    const data=[...(this.wellnessData||[])].filter(w=>w.playerId===playerId).sort((a,b)=>a.date.localeCompare(b.date));
    if(data.length<2) return '—';
    const last=this._wOverall(data[data.length-1]), prev=this._wOverall(data[data.length-2]);
    if(last>prev+0.3) return '📈';
    if(last<prev-0.3) return '📉';
    return '➡️';
};

RPETracker.prototype._wFmtDate = function(dateStr) {
    const d=new Date(dateStr+'T12:00:00');
    return d.toLocaleDateString('es-ES',{weekday:'short',day:'numeric',month:'short'});
};

// ========== INJECT STYLES ==========

(function injectWellnessStyles(){
    if(document.getElementById('wellness-styles')) return;
    const s=document.createElement('style');s.id='wellness-styles';
    s.textContent=`
.wellness-wrap{display:flex;flex-direction:column;gap:1.5rem}
.wellness-header{display:flex;justify-content:space-between;align-items:flex-start;gap:1rem;flex-wrap:wrap}
.wellness-card{background:var(--card-bg);border:1px solid var(--border-color);border-radius:12px;padding:1.1rem 1.25rem}
.wellness-section-title{font-size:.9rem;font-weight:700;color:var(--text-secondary);text-transform:uppercase;letter-spacing:.04em;margin:0 0 .85rem}
.wellness-today-grid{display:flex;flex-wrap:wrap;gap:.5rem}
.wellness-today-chip{display:flex;align-items:center;gap:.4rem;padding:.4rem .75rem .4rem .4rem;border-radius:24px;cursor:pointer;border:2px solid var(--border-color);transition:box-shadow .15s;font-size:.82rem}
.wellness-today-chip:hover{box-shadow:0 2px 8px rgba(0,0,0,.12)}
.wellness-today-chip.filled{border-color:#4caf50;background:rgba(76,175,80,.07)}
.wellness-today-chip.pending{opacity:.7}
.wt-name{font-weight:600}
.wt-score{margin-left:auto;padding:.1rem .45rem;border-radius:10px;font-size:.78rem;font-weight:700;color:white}
.wt-pending{margin-left:auto;color:var(--text-secondary);font-size:.75rem}
.wellness-metric-row{display:flex;align-items:center;gap:.75rem;margin-bottom:.5rem}
.wm-label{width:100px;font-size:.82rem;flex-shrink:0}
.wm-bar-wrap{flex:1;height:8px;background:var(--border-color);border-radius:4px;overflow:hidden}
.wm-bar-fill{height:100%;border-radius:4px;transition:width .4s ease}
.wm-val{width:32px;text-align:right;font-weight:700;font-size:.88rem;flex-shrink:0}
.wellness-alert-row{display:flex;align-items:flex-start;gap:.6rem;padding:.5rem 0;border-bottom:1px solid var(--border-color)}
.wellness-alert-row:last-child{border-bottom:none}
.wa-icon{font-size:1.2rem;flex-shrink:0}
.wa-text{display:flex;flex-direction:column;font-size:.85rem}
.wa-text strong{margin-bottom:.1rem}
.wa-text span{color:var(--text-secondary)}
.wellness-player-table{width:100%;border-collapse:collapse;font-size:.84rem}
.wellness-player-table th{text-align:left;padding:.4rem .6rem;color:var(--text-secondary);font-size:.75rem;border-bottom:2px solid var(--border-color)}
.wellness-player-table td{padding:.45rem .6rem;border-bottom:1px solid var(--border-color)}
.wellness-player-table tr:last-child td{border-bottom:none}
.wt-badge{display:inline-block;padding:.1rem .5rem;border-radius:10px;color:white;font-size:.72rem;font-weight:600;letter-spacing:.5px}
/* slider styles kept for legacy compat but hidden */
.wellness-slider-row{display:flex;align-items:center;gap:.5rem}
.ws-label-lo,.ws-label-hi{font-size:.72rem;color:var(--text-secondary);width:80px;flex-shrink:0}
.ws-label-hi{text-align:right}
.ws-pips{display:none}
.ws-val-display{display:none}
/* ── Emoji buttons ── */
.wem-row{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;margin-top:.2rem}
.wem-btn{font-size:1.6rem;background:none;border:2px solid var(--border-color);border-radius:10px;padding:.25rem .45rem;cursor:pointer;transition:transform .12s,border-color .15s,background .15s;line-height:1;flex-shrink:0}
.wem-btn:hover{transform:scale(1.15);border-color:var(--text-secondary)}
.wem-btn--active{border-color:var(--primary-color);background:rgba(255,152,0,.12);transform:scale(1.18)}
.wem-hint{font-size:.8rem;font-weight:600;margin-left:.4rem;transition:color .2s;min-width:70px}
.wellness-overall-preview{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-radius:10px;border:2px solid var(--border-color);background:var(--card-bg);margin-top:.5rem;transition:border-color .3s}
.wellness-history-table{width:100%;border-collapse:collapse;font-size:.82rem}
.wellness-history-table th{text-align:left;padding:.35rem .5rem;color:var(--text-secondary);font-size:.75rem;border-bottom:2px solid var(--border-color)}
.wellness-history-table td{padding:.4rem .5rem;border-bottom:1px solid var(--border-color)}
.wellness-history-table tr:last-child td{border-bottom:none}
.btn-icon-sm{background:none;border:none;cursor:pointer;font-size:.9rem;padding:.15rem .3rem;border-radius:4px;opacity:.6;transition:opacity .15s}
.btn-icon-sm:hover{opacity:1;background:rgba(244,67,54,.1)}
.btn-danger-sm{background:none;border:1px solid #f44336;color:#f44336;padding:.25rem .6rem;border-radius:6px;font-size:.78rem;cursor:pointer;transition:background .15s}
.btn-danger-sm:hover{background:rgba(244,67,54,.1)}
@media(max-width:640px){.wellness-header{flex-direction:column}.ws-label-lo,.ws-label-hi{width:55px;font-size:.65rem}.ws-pips{margin:.35rem 55px 0}}
`;
    document.head.appendChild(s);
})();

// ========== PASE RÁPIDO DE WELLNESS (BULK) ==========

RPETracker.prototype.openWellnessBulk = function() {
    if (!this.players.length) { this.showToast('Sin jugadoras registradas', 'warning'); return; }
    if (!this.wellnessData) this.wellnessData = this.loadWellnessData();

    const today = new Date().toISOString().slice(0, 10);
    // Order: pending first, then already filled
    const pending = this.players.filter(p => !this.wellnessData.some(w => w.playerId === p.id && w.date === today));
    const done    = this.players.filter(p =>  this.wellnessData.some(w => w.playerId === p.id && w.date === today));
    this._bulkQueue   = [...pending, ...done];
    this._bulkIndex   = 0;
    this._bulkDate    = today;

    // Create overlay
    const overlay = document.createElement('div');
    overlay.id = 'wellnessBulkOverlay';
    overlay.className = 'wb-overlay';
    document.body.appendChild(overlay);

    this._renderBulkStep();
};

RPETracker.prototype._renderBulkStep = function() {
    const overlay = document.getElementById('wellnessBulkOverlay');
    if (!overlay) return;

    const total  = this._bulkQueue.length;
    const idx    = this._bulkIndex;
    const player = this._bulkQueue[idx];
    const today  = this._bulkDate;

    if (!player) { this._closeBulk(true); return; }

    const existing = (this.wellnessData||[]).find(w => w.playerId === player.id && w.date === today);
    const cfg = {
        sleep:    { label:'😴 Sueño',    lo:'Pésimo', hi:'Excelente', id:'wbBtnSleep'    },
        fatigue:  { label:'⚡ Energía',  lo:'Agotada', hi:'Descansada', id:'wbBtnFatigue' },
        mood:     { label:'😊 Ánimo',    lo:'Muy bajo', hi:'Excelente', id:'wbBtnMood'    },
        soreness: { label:'💪 Muscular', lo:'Mucho dolor', hi:'Sin dolor', id:'wbBtnSoreness' }
    };
    const btnColors = ['#f44336','#ff9800','#ffc107','#8bc34a','#4caf50'];
    const btnLabels = ['1','2','3','4','5'];

    const metrics = Object.keys(cfg);
    const btnGroups = metrics.map(m => {
        const val = existing ? (existing[m] || 3) : 3;
        const buttons = [1,2,3,4,5].map(n => {
            const active = n === val;
            const col = btnColors[n-1];
            return `<button class="wb-val-btn ${active?'wb-val-btn--active':''}"
                style="${active?`background:${col};color:#fff;border-color:${col}`:`border-color:${col};color:${col}`}"
                data-metric="${m}" data-val="${n}"
                onclick="window.rpeTracker?._wbSelectBtn('${m}',${n},this)">${btnLabels[n-1]}</button>`;
        }).join('');
        return `<div class="wb-btn-group">
            <div class="wb-slider-header">
                <span class="wb-slider-label">${cfg[m].label}</span>
                <span class="wb-slider-val" id="wbVal${m.charAt(0).toUpperCase()+m.slice(1)}" style="color:${btnColors[val-1]}">${val}</span>
            </div>
            <div class="wb-val-row">
                <span class="wb-lo">${cfg[m].lo}</span>
                <div class="wb-val-btns" id="${cfg[m].id}">${buttons}</div>
                <span class="wb-hi">${cfg[m].hi}</span>
            </div>
        </div>`;
    }).join('');

    const pct = Math.round((idx / total) * 100);
    const isDone = this.wellnessData.some(w => w.playerId === player.id && w.date === today);
    const score = this._wbCurrentScore();
    const scoreColor = this._wColor(score);

    overlay.innerHTML = `
        <div class="wb-modal">
            <div class="wb-header">
                <div class="wb-progress-bar"><div class="wb-progress-fill" style="width:${pct}%"></div></div>
                <div class="wb-header-row">
                    <span class="wb-counter">${idx + 1} / ${total}</span>
                    <span class="wb-title">Pase rápido</span>
                    <button class="wb-close" onclick="window.rpeTracker?._closeBulk(false)">✕</button>
                </div>
            </div>
            <div class="wb-player-bar">
                ${PlayerTokens.avatar(player, 38, '0.9rem')}
                <div class="wb-player-info">
                    <div class="wb-player-name">${player.name}${player.number ? ` <span class="db-num">#${player.number}</span>` : ''}</div>
                    ${isDone ? '<div class="wb-already-done">✅ Ya registrado — editando</div>' : ''}
                </div>
                <div class="wb-overall-badge" id="wbBadge" style="color:${scoreColor}">${score.toFixed(1)}</div>
            </div>
            <div class="wb-body">${btnGroups}
                <div class="wb-notes-row">
                    <label class="wb-notes-label">📝 Notas</label>
                    <input type="text" class="wb-notes-input" id="wbNotes"
                        placeholder="Estrés, dolor, viaje..." value="${existing?.notes || ''}">
                </div>
            </div>
            <div class="wb-footer">
                ${idx > 0 ? `<button class="btn-secondary wb-btn-back" onclick="window.rpeTracker?._wbNav(-1)">← Anterior</button>` : '<div></div>'}
                <button class="btn-primary wb-btn-next" onclick="window.rpeTracker?._wbSaveAndNav(1)">
                    ${idx < total - 1 ? 'Guardar y siguiente →' : '✅ Finalizar'}
                </button>
            </div>
        </div>
    `;
};

RPETracker.prototype._wbSelectBtn = function(metric, val, btn) {
    const cap = metric.charAt(0).toUpperCase() + metric.slice(1);
    const btnColors = ['#f44336','#ff9800','#ffc107','#8bc34a','#4caf50'];
    const col = btnColors[val-1];
    // Update all buttons in this group
    btn.closest('.wb-val-btns').querySelectorAll('.wb-val-btn').forEach((b, i) => {
        const n = i + 1;
        const isActive = n === val;
        const c = btnColors[i];
        b.className = 'wb-val-btn' + (isActive ? ' wb-val-btn--active' : '');
        b.style.cssText = isActive ? `background:${c};color:#fff;border-color:${c}` : `border-color:${c};color:${c}`;
    });
    // Update display val
    const valEl = document.getElementById(`wbVal${cap}`);
    if (valEl) { valEl.textContent = val; valEl.style.color = col; }
    // Refresh badge
    const score = this._wbCurrentScore();
    const badge = document.getElementById('wbBadge');
    if (badge) { badge.textContent = score.toFixed(1); badge.style.color = this._wColor(score); }
};

RPETracker.prototype._wbCurrentScore = function() {
    const getVal = (metric) => {
        const grp = document.querySelector(`[data-metric="${metric}"].wb-val-btn--active`);
        return grp ? parseInt(grp.dataset.val) : 3;
    };
    return this._wOverall({ sleep: getVal('sleep'), fatigue: getVal('fatigue'), mood: getVal('mood'), soreness: getVal('soreness') });
};

RPETracker.prototype._wbUpdateSlider = function() {}; // kept for compat
RPETracker.prototype._wbRefreshBadge = function() {};  // kept for compat

RPETracker.prototype._wbSaveAndNav = function(dir) {
    if (!this.wellnessData) this.wellnessData = [];
    const player = this._bulkQueue[this._bulkIndex];
    const date   = this._bulkDate;
    const getBtn = m => {
        const el = document.querySelector(`[data-metric="${m}"].wb-val-btn--active`);
        return el ? parseInt(el.dataset.val) : 3;
    };
    const entry  = {
        id: `w_${player.id}_${date}`,
        playerId: player.id, date,
        sleep:    getBtn('sleep'),
        fatigue:  getBtn('fatigue'),
        mood:     getBtn('mood'),
        soreness: getBtn('soreness'),
        notes:    document.getElementById('wbNotes')?.value || '',
        savedAt:  new Date().toISOString()
    };
    const idx = this.wellnessData.findIndex(w => w.playerId === player.id && w.date === date);
    if (idx >= 0) this.wellnessData[idx] = entry; else this.wellnessData.push(entry);
    this.saveWellnessData();

    this._bulkIndex += dir;
    if (this._bulkIndex >= this._bulkQueue.length) { this._closeBulk(true); return; }
    this._renderBulkStep();
};

RPETracker.prototype._wbNav = function(dir) {
    this._bulkIndex = Math.max(0, this._bulkIndex + dir);
    this._renderBulkStep();
};

RPETracker.prototype._closeBulk = function(completed) {
    const overlay = document.getElementById('wellnessBulkOverlay');
    if (overlay) overlay.remove();
    if (completed) {
        this.showToast('✅ Wellness del equipo guardado', 'success');
        if (this.currentView === 'wellness') this.renderWellnessDashboard();
        if (this.currentView === 'dashboard') this.renderDashboard();
    }
};

// ========== WELLNESS QUICK MODAL (grid: todas las jugadoras, 4 sliders por fila) ==========

RPETracker.prototype.openWellnessQuick = function() {
    if (!this.players.length) { this.showToast('Sin jugadoras registradas', 'warning'); return; }
    if (!this.wellnessData) this.wellnessData = this.loadWellnessData();

    const today = new Date().toISOString().slice(0, 10);

    // Remove any existing instance
    const existing = document.getElementById('wellnessQuickOverlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'wellnessQuickOverlay';
    overlay.className = 'wq-overlay';

    const metrics = ['sleep', 'fatigue', 'mood', 'soreness'];
    const metaConfig = {
        sleep:    { icon: '😴', label: 'Sueño'    },
        fatigue:  { icon: '⚡', label: 'Energía'  },
        mood:     { icon: '😊', label: 'Ánimo'    },
        soreness: { icon: '💪', label: 'Muscular' }
    };

    // Build rows – one per player (buttons 1-5 instead of sliders)
    const buildRows = () => this.players.map(player => {
        const existing = (this.wellnessData||[]).find(w => w.playerId === player.id && w.date === today);
        const initials = metrics.map(m => existing ? (existing[m] || null) : null);

        const btnCells = metrics.map((m, mi) => {
            const val = initials[mi];
            const cfg = metaConfig[m];
            const btns = [1,2,3,4,5].map(n => {
                const active = val === n;
                const color = active ? `background:${this._wColor(n)};border-color:${this._wColor(n)};color:#fff` : '';
                return `<button type="button" class="wq-val-btn${active ? ' wq-val-btn--active' : ''}"
                    style="${color}"
                    data-player="${player.id}" data-metric="${m}" data-val="${n}"
                    id="wqBtn_${player.id}_${m}_${n}">${n}</button>`;
            }).join('');
            return `<div class="wq-btn-cell">
                <div class="wq-btn-cell-header">
                    <span class="wq-metric-icon">${cfg.icon}</span>
                    <span class="wq-metric-lbl">${cfg.label}</span>
                </div>
                <div class="wq-btn-row" id="wqBtnRow_${player.id}_${m}">${btns}</div>
            </div>`;
        }).join('');

        const alreadyFilled = !!existing;
        return `<div class="wq-row" id="wqRow_${player.id}">
            <div class="wq-player-cell">
                ${PlayerTokens.avatar(player, 28, '.7rem')}
                <span class="wq-player-name">${player.name}${player.number ? `<span class="wq-num"> #${player.number}</span>` : ''}</span>
                ${alreadyFilled ? '<span class="wq-done-badge">✓</span>' : ''}
            </div>
            <div class="wq-sliders-wrap">${btnCells}</div>
        </div>`;
    }).join('');

    overlay.innerHTML = `
        <div class="wq-modal">
            <div class="wq-modal-header">
                <div>
                    <span class="wq-modal-title">⚡ Wellness rápido del equipo</span>
                    <span class="wq-modal-date">${this._wFmtDate(today)}</span>
                </div>
                <button class="wb-close" onclick="document.getElementById('wellnessQuickOverlay')?.remove()">✕</button>
            </div>
            <div class="wq-modal-body">
                <div class="wq-table-header wq-row wq-row--header">
                    <div class="wq-player-cell"><span style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.04em;color:var(--text-secondary)">Jugadora</span></div>
                    <div class="wq-sliders-wrap">
                        ${metrics.map(m => `<div class="wq-slider-cell wq-col-header">
                            <span>${metaConfig[m].icon} ${metaConfig[m].label}</span>
                        </div>`).join('')}
                    </div>
                </div>
                <div id="wqRowsContainer">${buildRows()}</div>
            </div>
            <div class="wq-modal-footer">
                <button class="btn-secondary" onclick="document.getElementById('wellnessQuickOverlay')?.remove()">Cancelar</button>
                <button class="btn-primary" onclick="window.rpeTracker?.saveWellnessQuick()">💾 Guardar todo el equipo</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);

    // Attach events via delegation — button click
    overlay.addEventListener('click', e => {
        const btn = e.target.closest('.wq-val-btn');
        if (!btn) return;
        const { player: pid, metric: m, val: valStr } = btn.dataset;
        const val = parseInt(valStr);
        const row = document.getElementById(`wqBtnRow_${pid}_${m}`);
        if (row) {
            row.querySelectorAll('.wq-val-btn').forEach(b => {
                const bv = parseInt(b.dataset.val);
                const active = bv === val;
                b.classList.toggle('wq-val-btn--active', active);
                if (active) {
                    b.style.background = this._wColor(val);
                    b.style.borderColor = this._wColor(val);
                    b.style.color = '#fff';
                } else {
                    b.style.background = '';
                    b.style.borderColor = '';
                    b.style.color = '';
                }
            });
        }
    });

    // Close on overlay click
    overlay.addEventListener('click', e => {
        if (e.target === overlay) overlay.remove();
    });
};

RPETracker.prototype.saveWellnessQuick = function() {
    if (!this.wellnessData) this.wellnessData = [];
    const today = new Date().toISOString().slice(0, 10);
    const overlay = document.getElementById('wellnessQuickOverlay');
    if (!overlay) return;

    let count = 0;
    this.players.forEach(player => {
        const get = m => {
            const active = overlay.querySelector(`#wqBtnRow_${player.id}_${m} .wq-val-btn--active`);
            return active ? parseInt(active.dataset.val) : null;
        };
        const s=get('sleep'), fa=get('fatigue'), mo=get('mood'), so=get('soreness');
        // Skip players with no values set at all
        if ([s,fa,mo,so].every(v=>v===null)) return;
        const entry = {
            id: `w_${player.id}_${today}`,
            playerId: player.id, date: today,
            sleep:    s ?? 3,
            fatigue:  fa ?? 3,
            mood:     mo ?? 3,
            soreness: so ?? 3,
            notes: '',
            savedAt: new Date().toISOString()
        };
        const idx = this.wellnessData.findIndex(w => w.playerId === player.id && w.date === today);
        if (idx >= 0) this.wellnessData[idx] = entry; else this.wellnessData.push(entry);
        count++;
    });

    this.saveWellnessData();
    overlay.remove();
    this.showToast(`✅ Wellness guardado para ${count} jugadoras`, 'success');
    this.renderWellnessDashboard();
};

// ── Quick Modal Styles ──────────────────────────────────────
(function injectWellnessQuickStyles() {
    if (document.getElementById('wellness-quick-styles')) return;
    const s = document.createElement('style');
    s.id = 'wellness-quick-styles';
    s.textContent = `
.wq-overlay{position:fixed;inset:0;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.65);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:1.5rem 1rem;overflow-y:auto;-webkit-overflow-scrolling:touch}
.wq-modal{background:var(--bg-card,#fff);border:1px solid var(--border-color);border-radius:14px;width:100%;max-width:860px;display:flex;flex-direction:column;max-height:calc(100vh - 3rem);margin:0 auto;box-shadow:0 8px 40px rgba(0,0,0,.35)}
.wq-modal-header{display:flex;justify-content:space-between;align-items:center;padding:1rem 1.25rem;border-bottom:1px solid var(--border-color);flex-shrink:0;background:var(--bg-card,#fff);border-radius:14px 14px 0 0}
.wq-modal-title{font-size:1rem;font-weight:700;color:var(--text-primary);margin-right:.75rem}
.wq-modal-date{font-size:.8rem;color:var(--text-secondary)}
.wq-modal-body{overflow-y:auto;padding:.75rem 1rem;flex:1;background:var(--bg-card,#fff)}
.wq-modal-footer{display:flex;justify-content:flex-end;gap:.75rem;padding:.85rem 1.25rem;border-top:1px solid var(--border-color);flex-shrink:0;background:var(--bg-card,#fff);border-radius:0 0 14px 14px}

/* Row layout */
.wq-row{display:grid;grid-template-columns:160px 1fr;align-items:center;gap:.75rem;padding:.55rem 0;border-bottom:1px solid var(--border-color)}
.wq-row:last-child{border-bottom:none}
.wq-row--header{padding:.3rem 0;border-bottom:2px solid var(--border-color)}
.wq-player-cell{display:flex;align-items:center;gap:.45rem;min-width:0}
.wq-player-name{font-weight:600;font-size:.82rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.wq-num{opacity:.55;font-weight:400}
.wq-done-badge{background:var(--success-color,#4caf50);color:#fff;font-size:.65rem;padding:.05rem .35rem;border-radius:8px;flex-shrink:0}

/* Button grid */
.wq-sliders-wrap{display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem}
.wq-btn-cell{display:flex;flex-direction:column;gap:.3rem}
.wq-col-header{justify-content:center;align-items:center;font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-secondary);letter-spacing:.04em;text-align:center}
.wq-btn-cell-header{display:flex;align-items:center;gap:.3rem;font-size:.72rem}
.wq-metric-icon{flex-shrink:0}
.wq-metric-lbl{flex:1;color:var(--text-secondary);font-size:.7rem}
.wq-btn-row{display:flex;gap:3px}
.wq-val-btn{flex:1;border:1.5px solid var(--border-color);border-radius:6px;background:var(--bg-surface,#fff);font-size:.78rem;font-weight:700;cursor:pointer;padding:.25rem 0;text-align:center;transition:background .12s,border-color .12s,color .12s;touch-action:manipulation;line-height:1.2;color:var(--text-secondary)}
.wq-val-btn:hover{border-color:var(--text-secondary);color:var(--text-primary)}
.wq-val-btn--active{color:#fff}

/* Mobile: card scroll */
@media(max-width:767px){
    .wq-modal{max-height:95vh}
    .wq-row{grid-template-columns:1fr;gap:.4rem}
    .wq-row--header{display:none}
    .wq-sliders-wrap{grid-template-columns:repeat(2,1fr)}
    .wq-player-cell{padding-bottom:.15rem}
}
@media(max-width:420px){
    .wq-sliders-wrap{grid-template-columns:1fr 1fr}
}
`;
    document.head.appendChild(s);
})();

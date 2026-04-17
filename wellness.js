// Basketball RPE Tracker - Wellness Dashboard (Batch 4)
// Seguimiento de bienestar subjetivo: sueño, energía, humor, dolor muscular

// ========== WELLNESS DATA ==========

RPETracker.prototype.loadWellnessData = function() {
    try {
        const raw = localStorage.getItem('basketballWellness');
        const data = raw ? JSON.parse(raw) : [];
        // Subscribe to Firebase realtime updates if available
        if (window.firebaseSync) {
            window.firebaseSync.onWellnessChange(updated => {
                this.wellnessData = updated;
                if (this.currentView === 'wellness') this.renderWellnessDashboard();
                if (this.currentView === 'dashboard') this.renderDashboard();
                console.log('🔄 Wellness actualizado desde Firebase');
            });
        }
        return data;
    } catch(e) { return []; }
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
                <button class="btn-primary" onclick="window.rpeTracker?.openWellnessForm()">➕ Registrar bienestar</button>
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

    const colors=['#2196f3','#ff9800','#9c27b0','#f44336'];
    const metrics=['sleep','fatigue','mood','soreness'];
    const seriesData=metrics.map(m=>dates.map(date=>{
        const vals=(this.wellnessData||[]).filter(w=>w.date===date&&w[m]!=null).map(w=>w[m]);
        return vals.length?vals.reduce((a,b)=>a+b,0)/vals.length:null;
    }));

    // Grid
    ctx.strokeStyle='rgba(128,128,128,.12)'; ctx.lineWidth=1;
    for(let i=1;i<=5;i++){
        const y=pad.t+iH-(i/5)*iH;
        ctx.beginPath();ctx.moveTo(pad.l,y);ctx.lineTo(pad.l+iW,y);ctx.stroke();
        ctx.fillStyle='rgba(128,128,128,.6)';ctx.font=`${10}px system-ui`;ctx.textAlign='right';
        ctx.fillText(i,pad.l-4,y+3);
    }
    ctx.fillStyle='rgba(128,128,128,.6)';ctx.textAlign='center';
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
                            <td style="font-size:.78rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${w.notes||'—'}</td>
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
    return `<div id="wellnessModal" class="modal" style="display:none">
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
                        ${this.players.map(p=>`<option value="${p.id}">${p.name}${p.number?` #${p.number}`:''}</option>`).join('')}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Fecha</label>
                    <input type="date" id="wFormDate" class="form-input" value="${today}" max="${today}">
                </div>
                ${['sleep','fatigue','mood','soreness'].map(m=>{
                    const config={
                        sleep:{label:'😴 Calidad del sueño',lo:'Muy malo',hi:'Excelente'},
                        fatigue:{label:'⚡ Nivel de energía',lo:'Muy cansada',hi:'Descansada'},
                        mood:{label:'😊 Estado de ánimo',lo:'Muy bajo',hi:'Excelente'},
                        soreness:{label:'💪 Dolor muscular',lo:'Mucho dolor',hi:'Sin dolor'}
                    }[m];
                    const cap=m.charAt(0).toUpperCase()+m.slice(1);
                    return `<div class="form-group">
                        <label class="form-label">${config.label}</label>
                        <div class="wellness-slider-row">
                            <span class="ws-label-lo">${config.lo}</span>
                            <input type="range" id="wForm${cap}" min="1" max="5" step="1" value="3"
                                class="wellness-slider" oninput="rpeTracker._wUpdateSlider('${m}',this.value)">
                            <span class="ws-label-hi">${config.hi}</span>
                        </div>
                        <div class="ws-pips" id="wPips${cap}"></div>
                        <div class="ws-val-display" id="wVal${cap}">3 — Aceptable</div>
                    </div>`;
                }).join('')}
                <div class="form-group">
                    <label class="form-label">📝 Notas (opcional)</label>
                    <textarea id="wFormNotes" class="form-textarea" rows="2" placeholder="Estrés, viaje, enfermedad..."></textarea>
                </div>
                <div id="wOverallPreview" class="wellness-overall-preview">
                    <span style="color:var(--text-secondary);font-size:.88rem;font-weight:600">Puntuación global estimada:</span>
                    <strong id="wOverallScore" style="font-size:1.4rem">3.0 / 5</strong>
                </div>
                <div style="display:flex;gap:.75rem;margin-top:1rem">
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

    if (presetPlayerId) {
        const sel = document.getElementById('wFormPlayer');
        if (sel) sel.value = presetPlayerId;
    }

    const playerId = document.getElementById('wFormPlayer')?.value;
    const date = document.getElementById('wFormDate')?.value;
    const existing = (this.wellnessData||[]).find(w=>w.playerId===playerId && w.date===date);

    ['sleep','fatigue','mood','soreness'].forEach(m=>{
        const cap=m.charAt(0).toUpperCase()+m.slice(1);
        const slider=document.getElementById(`wForm${cap}`);
        if(slider){ slider.value=existing?(existing[m]||3):3; this._wUpdateSlider(m,slider.value); }
    });
    if (existing) { const n=document.getElementById('wFormNotes'); if(n) n.value=existing.notes||''; }
    this._wUpdateOverallPreview();

    const sel = document.getElementById('wFormPlayer');
    if (sel) sel.onchange = () => {
        const pid=sel.value, dt=document.getElementById('wFormDate')?.value;
        const ex=(this.wellnessData||[]).find(w=>w.playerId===pid&&w.date===dt);
        ['sleep','fatigue','mood','soreness'].forEach(m=>{
            const cap=m.charAt(0).toUpperCase()+m.slice(1);
            const s=document.getElementById(`wForm${cap}`);
            if(s){s.value=ex?(ex[m]||3):3;this._wUpdateSlider(m,s.value);}
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

RPETracker.prototype._wUpdateOverallPreview = function() {
    const g=id=>parseInt(document.getElementById(id)?.value||3);
    const overall=this._wOverall({sleep:g('wFormSleep'),fatigue:g('wFormFatigue'),mood:g('wFormMood'),soreness:g('wFormSoreness')});
    const el=document.getElementById('wOverallScore');
    const wrap=document.getElementById('wOverallPreview');
    if(el){el.textContent=`${overall.toFixed(1)} / 5`;el.style.color=this._wColor(overall);}
    if(wrap) wrap.style.borderColor=this._wColor(overall);
};

RPETracker.prototype.saveWellnessEntry = function() {
    if(!this.wellnessData) this.wellnessData=this.loadWellnessData();
    const playerId=document.getElementById('wFormPlayer')?.value;
    const date=document.getElementById('wFormDate')?.value;
    if(!playerId||!date){this.showToast('⚠️ Selecciona jugadora y fecha','warning');return;}
    const entry={
        id:`w_${playerId}_${date}`,playerId,date,
        sleep:parseInt(document.getElementById('wFormSleep')?.value||3),
        fatigue:parseInt(document.getElementById('wFormFatigue')?.value||3),
        mood:parseInt(document.getElementById('wFormMood')?.value||3),
        soreness:parseInt(document.getElementById('wFormSoreness')?.value||3),
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
    if(!confirm('¿Eliminar este registro?')) return;
    this.wellnessData=(this.wellnessData||[]).filter(w=>w.id!==id);
    this.saveWellnessData();
    this.showToast('🗑️ Registro eliminado','info');
    this.renderWellnessDashboard();
};

RPETracker.prototype._clearWellness = function() {
    if(!confirm('¿Eliminar TODOS los registros de bienestar?\n\nEsta acción no se puede deshacer.')) return;
    this.wellnessData=[];this.saveWellnessData();
    this.showToast('🗑️ Historial eliminado','info');
    this.renderWellnessDashboard();
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
.wellness-wrap{max-width:900px;margin:0 auto;display:flex;flex-direction:column;gap:1rem;padding:1rem}
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
.wellness-slider-row{display:flex;align-items:center;gap:.5rem}
.ws-label-lo,.ws-label-hi{font-size:.72rem;color:var(--text-secondary);width:80px;flex-shrink:0}
.ws-label-hi{text-align:right}
.wellness-slider{flex:1;-webkit-appearance:none;appearance:none;height:6px;border-radius:3px;background:var(--border-color);outline:none;cursor:pointer}
.wellness-slider::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:20px;height:20px;border-radius:50%;background:var(--primary-color);cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.ws-pips{display:flex;gap:4px;margin:.35rem 80px 0}
.ws-pip{flex:1;height:4px;border-radius:2px;background:var(--border-color);transition:background .2s}
.ws-val-display{text-align:center;font-weight:600;font-size:.85rem;margin-top:.35rem;transition:color .2s}
.wellness-overall-preview{display:flex;align-items:center;justify-content:space-between;padding:.75rem 1rem;border-radius:10px;border:2px solid var(--border-color);background:var(--card-bg);margin-top:.5rem;transition:border-color .3s}
.wellness-history-table{width:100%;border-collapse:collapse;font-size:.82rem}
.wellness-history-table th{text-align:left;padding:.35rem .5rem;color:var(--text-secondary);font-size:.75rem;border-bottom:2px solid var(--border-color)}
.wellness-history-table td{padding:.4rem .5rem;border-bottom:1px solid var(--border-color)}
.wellness-history-table tr:last-child td{border-bottom:none}
.btn-icon-sm{background:none;border:none;cursor:pointer;font-size:.9rem;padding:.15rem .3rem;border-radius:4px;opacity:.6;transition:opacity .15s}
.btn-icon-sm:hover{opacity:1;background:rgba(244,67,54,.1)}
.btn-danger-sm{background:none;border:1px solid #f44336;color:#f44336;padding:.25rem .6rem;border-radius:6px;font-size:.78rem;cursor:pointer;transition:background .15s}
.btn-danger-sm:hover{background:rgba(244,67,54,.1)}
@media(max-width:640px){.wellness-wrap{padding:.5rem}.wellness-header{flex-direction:column}.ws-label-lo,.ws-label-hi{width:55px;font-size:.65rem}.ws-pips{margin:.35rem 55px 0}}
`;
    document.head.appendChild(s);
})();

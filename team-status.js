// ========== VISTA DE DISPONIBILIDAD PARA PARTIDO ==========

RPETracker.prototype.renderTeamStatus = function() {
    const container = document.getElementById('teamStatusView');
    if (!container) return;

    if (this.players.length === 0) {
        container.innerHTML = `<div class="empty-state active"><div class="empty-icon">📋</div><h3>No hay jugadoras registradas</h3></div>`;
        return;
    }

    const groups = { ok: [], caution: [], out: [] };

    this.players.forEach(player => {
        const ratio = this.calculateAcuteChronicRatio(player.id);
        const r = parseFloat(ratio.ratio);
        const activeInjury = (this.injuries || []).find(i => i.playerId === player.id && i.status === 'active');
        const playerSessions = this.sessions.filter(s => s.playerId === player.id);
        const last7 = playerSessions.filter(s => {
            const diff = (new Date() - new Date(s.date)) / 86400000;
            return diff <= 7;
        });
        const avgRPE7 = last7.length ? (last7.reduce((s, x) => s + x.rpe, 0) / last7.length).toFixed(1) : null;

        const entry = { player, ratio, r, activeInjury, avgRPE7, sessions7: last7.length };

        if (activeInjury) {
            groups.out.push(entry);
        } else if ((() => { const _t=this.getPlayerThresholds(player.id); return r > _t.high || (r > 0 && r < _t.low); })()) {
            groups.caution.push(entry);
        } else {
            groups.ok.push(entry);
        }
    });

    const renderCard = ({ player, ratio, r, activeInjury, avgRPE7, sessions7 }) => {
        let statusBadge, borderClass, statusText;
        if (activeInjury) {
            statusBadge = 'ts-badge-out';
            borderClass = 'ts-card-out';
            statusText = `Lesionada · ${activeInjury.location ? this.getLocationName(activeInjury.location) : 'lesión activa'}`;
        } else { const _tC = this.getPlayerThresholds(player.id); if (r > _tC.high) {
            statusBadge = 'ts-badge-danger';
            borderClass = 'ts-card-danger';
            statusText = `Ratio ${ratio.ratio} — Reducir carga`;
        } else if (r > 0 && r < _tC.low) {
            statusBadge = 'ts-badge-low';
            borderClass = 'ts-card-low';
            statusText = `Ratio ${ratio.ratio} — Por debajo`;
        } else {
            statusBadge = 'ts-badge-ok';
            borderClass = 'ts-card-ok';
            statusText = ratio.ratio !== 'N/A' ? `Ratio ${ratio.ratio} — Óptimo` : 'Sin datos suficientes';
        } }

        return `
            <div class="ts-card ${borderClass}">
                <div class="ts-card-avatar">${player.name.charAt(0).toUpperCase()}</div>
                <div class="ts-card-info">
                    <div class="ts-card-name">${player.name}${player.number ? ` <span class="ts-num">#${player.number}</span>` : ''}</div>
                    <div class="ts-card-status">${statusText}</div>
                </div>
                <div class="ts-card-meta">
                    ${avgRPE7 ? `<div class="ts-meta-val">${avgRPE7}</div><div class="ts-meta-label">RPE 7d</div>` : '<div class="ts-meta-label">Sin datos</div>'}
                </div>
            </div>`;
    };

    const section = (title, icon, entries, emptyMsg) => `
        <div class="ts-section">
            <div class="ts-section-header">
                <span class="ts-section-icon">${icon}</span>
                <span class="ts-section-title">${title}</span>
                <span class="ts-section-count">${entries.length}</span>
            </div>
            ${entries.length ? entries.map(renderCard).join('') : `<div class="ts-empty">${emptyMsg}</div>`}
        </div>`;

    // weekPlan = { weekOffset, days: { lun/mar/…: { morning: {type,…}, afternoon: {type,…} } } }
    const _wpDays = this.weekPlan?.days ? Object.values(this.weekPlan.days) : [];
    const _wpSlots = _wpDays.flatMap(d => [d?.morning, d?.afternoon].filter(Boolean));
    const nextMatch = _wpSlots.find(s => s.type === 'match' && s.enabled) || null;

    container.innerHTML = `
        <div class="ts-header">
            <div>
                <h2 class="ts-title">Estado del equipo</h2>
                <div class="ts-subtitle">Disponibilidad para el próximo partido</div>
            </div>
            <button class="btn-secondary" onclick="window.rpeTracker?.generateTeamStatusPDF()" style="font-size:0.85rem;padding:0.5rem 1rem;">
                📄 Informe PDF
            </button>
        </div>

        <div class="ts-summary">
            <div class="ts-summary-item ts-sum-ok">
                <div class="ts-sum-num">${groups.ok.length}</div>
                <div class="ts-sum-label">Disponibles</div>
            </div>
            <div class="ts-summary-item ts-sum-caution">
                <div class="ts-sum-num">${groups.caution.length}</div>
                <div class="ts-sum-label">Precaución</div>
            </div>
            <div class="ts-summary-item ts-sum-out">
                <div class="ts-sum-num">${groups.out.length}</div>
                <div class="ts-sum-label">No disponibles</div>
            </div>
        </div>

        ${section('Disponibles', '🟢', groups.ok, 'Todas las jugadoras en precaución o baja')}
        ${section('Precaución', '🟠', groups.caution, 'Ninguna jugadora en precaución')}
        ${section('No disponibles', '🔴', groups.out, 'Ninguna jugadora lesionada')}
    `;
};


// ========== HISTORIAL MÉDICO POR JUGADORA ==========


// NOTE: renderMedicalHistory, renderRehabLoad, saveRehabSession, renderLoadInjuryCorrelation → batch4-modules.js

RPETracker.prototype.generateWeeklyTeamPDF = function() {
    if (!this.weekPlan) this.loadWeekPlan();

    const now      = new Date();
    const monday   = new Date(now); monday.setDate(now.getDate() - ((now.getDay() + 6) % 7)); monday.setHours(0,0,0,0);
    const sunday   = new Date(monday); sunday.setDate(monday.getDate() + 6);
    const todayKey = now.toISOString().slice(0,10);
    const dateRange = `${monday.toLocaleDateString('es-ES',{day:'numeric',month:'long'})} – ${sunday.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}`;

    const wData    = this.wellnessData || [];
    const wToday   = wData.filter(e => e.date === todayKey);

    const wScore = (playerId) => {
        const e = wToday.find(x => x.playerId === playerId);
        if (!e) return null;
        return (e.sleep + (6 - e.fatigue) + e.mood + (6 - e.soreness)) / 4;
    };
    const wBar = (val) => {
        if (val === null) return '<span style="color:var(--text-faint);font-size:11px">—</span>';
        const pct = ((val - 1) / 4) * 100;
        const col = val >= 4 ? '#4caf50' : val >= 2.5 ? '#ff9800' : '#f44336';
        return `<div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:6px;border-radius:3px;background:#eee;overflow:hidden">
                <div style="width:${pct.toFixed(0)}%;height:100%;background:${col};border-radius:3px"></div>
            </div>
            <span style="font-weight:700;color:${col};min-width:24px;text-align:right">${val.toFixed(1)}</span>
        </div>`;
    };
    const ratioBar = (r, ratioStr) => {
        if (isNaN(r) || ratioStr === 'N/A') return '<span style="color:var(--text-faint)">—</span>';
        const pct = Math.min(r / 2 * 100, 100).toFixed(0);
        const _tBar = this.getPlayerThresholds(player.id); const col = r > _tBar.high ? '#f44336' : r > _tBar.opt ? '#ff9800' : r < _tBar.low ? '#2196f3' : '#4caf50';
        return `<div style="display:flex;align-items:center;gap:6px">
            <div style="flex:1;height:6px;border-radius:3px;background:#eee;overflow:hidden;position:relative">
                <div style="width:${pct}%;height:100%;background:${col};border-radius:3px"></div>
                <div style="position:absolute;top:-2px;left:40%;width:1.5px;height:10px;background:#bbb"></div>
                <div style="position:absolute;top:-2px;left:65%;width:1.5px;height:10px;background:#bbb"></div>
            </div>
            <span style="font-weight:700;color:${col};min-width:28px;text-align:right">${ratioStr}</span>
        </div>`;
    };

    // ── Player data ──
    const playerData = this.players.map(player => {
        const ratio  = this.calculateAcuteChronicRatio(player.id);
        const r      = parseFloat(ratio.ratio);
        const injury = (this.injuries || []).find(i => i.playerId === player.id && i.status === 'active');
        const week   = this.sessions.filter(s => { const d = new Date(s.date); return d >= monday && d <= sunday && s.playerId === player.id; });
        const weekLoad = week.reduce((s,x) => s + (x.load || x.rpe*(x.duration||60)), 0);
        const avgRPE   = week.length ? (week.reduce((s,x)=>s+x.rpe,0)/week.length).toFixed(1) : '—';
        const ws = wScore(player.id);
        let statusTxt, statusCol, statusBg;
        if (injury)       { statusTxt='Lesionada';   statusCol='#c62828'; statusBg='#ffebee'; }
        const _tSt = this.getPlayerThresholds(player.id);
        if      (r > _tSt.high)          { statusTxt='Peligro';     statusCol='#e65100'; statusBg='#fff3e0'; }
        else if (r > _tSt.opt)           { statusTxt='Precaución';  statusCol='#f57f17'; statusBg='#fffde7'; }
        else if (r < _tSt.low && r > 0)  { statusTxt='Descarga';    statusCol='#1565c0'; statusBg='#e3f2fd'; }
        else if (r >= _tSt.low)          { statusTxt='Óptima';      statusCol='#2e7d32'; statusBg='#e8f5e9'; }
        else               { statusTxt='Sin datos';   statusCol='#999';    statusBg='#f5f5f5'; }
        return { player, ratio, r, injury, week, weekLoad, avgRPE, ws, statusTxt, statusCol, statusBg };
    });

    const ok      = playerData.filter(d => { const _t=this.getPlayerThresholds(d.player.id); return !d.injury && d.r >= _t.low && d.r <= _t.opt; });
    const caution = playerData.filter(d => { const _t=this.getPlayerThresholds(d.player.id); return !d.injury && (d.r > _t.opt || (d.r > 0 && d.r < _t.low)); });
    const out     = playerData.filter(d =>  d.injury);
    const weekSessions = this.sessions.filter(s => { const d = new Date(s.date); return d >= monday && d <= sunday; });
    const activeInj = (this.injuries||[]).filter(i => i.status==='active');
    const wCoverage = wToday.length;

    const playerRow = ({player, ratio, r, injury, weekLoad, avgRPE, ws, statusTxt, statusCol, statusBg}) => {
        const initials = player.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        const bd = 'border-bottom:1px solid var(--border,#e8e8e8)';
        return `<tr>
            <td style="padding:10px 14px;${bd}">
                <div style="display:flex;align-items:center;gap:10px">
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--primary,#ff6600);color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:700;flex-shrink:0">${initials}</div>
                    <div>
                        <div style="font-weight:600;font-size:13px;color:var(--text-primary)">${player.name}</div>
                        ${player.number ? `<div style="font-size:11px;color:var(--text-muted)">#${player.number}</div>` : ''}
                    </div>
                </div>
            </td>
            <td style="padding:10px 14px;${bd};min-width:120px">${ratioBar(r, ratio.ratio)}</td>
            <td style="padding:10px 14px;${bd};min-width:120px">${wBar(ws)}</td>
            <td style="padding:10px 14px;${bd};text-align:center;font-weight:600;color:var(--text-secondary)">${avgRPE}</td>
            <td style="padding:10px 14px;${bd};text-align:center;font-weight:600;color:var(--text-secondary)">${weekLoad ? weekLoad.toLocaleString('es-ES') : '—'}</td>
            <td style="padding:10px 14px;${bd}">
                <span style="display:inline-block;padding:3px 10px;border-radius:20px;font-size:11px;font-weight:600;background:${statusBg};color:${statusCol}">${statusTxt}</span>
                ${injury ? `<div style="font-size:10px;color:var(--text-muted);margin-top:2px">${injury.location ? this.getLocationName(injury.location) : 'lesión activa'}</div>` : ''}
            </td>
        </tr>`;
    };

    const injuryRows = activeInj.map(inj => {
        const p = this.players.find(x => x.id === inj.playerId);
        return `<tr>
            <td style="padding:8px 14px;border-bottom:1px solid var(--border,#e8e8e8);font-weight:600">${p?.name || '?'}</td>
            <td style="padding:8px 14px;border-bottom:1px solid var(--border,#e8e8e8)">${inj.location ? this.getLocationName(inj.location) : '—'}</td>
            <td style="padding:8px 14px;border-bottom:1px solid var(--border,#e8e8e8);text-align:center">${typeof inj.getDaysInjured === 'function' ? inj.getDaysInjured() : '?'} días</td>
            <td style="padding:8px 14px;border-bottom:1px solid var(--border,#e8e8e8)">Fase RTP ${inj.rtpPhase || 1}/6</td>
        </tr>`;
    }).join('') || `<tr><td colspan="4" style="padding:14px;color:var(--text-faint);text-align:center;font-style:italic">Ninguna jugadora lesionada</td></tr>`;

    const wTeamRows = this.players.map(player => {
        const e7 = wData.filter(x => x.playerId === player.id).slice(-7);
        const avg = f => e7.length ? (e7.reduce((s,x)=>s+(x[f]||0),0)/e7.length).toFixed(1) : '—';
        const todayE = wToday.find(x => x.playerId === player.id);
        const cells = [
            { f:'sleep',    inv:false, label:'Sueño' },
            { f:'fatigue',  inv:true,  label:'Fatiga' },
            { f:'mood',     inv:false, label:'Humor' },
            { f:'soreness', inv:true,  label:'Agujetas' },
        ].map(({f, inv}) => {
            const val = todayE ? todayE[f] : null;
            if (val === null) return `<td style="padding:8px 14px;border-bottom:1px solid var(--border,#e8e8e8);text-align:center;color:var(--text-faint)">—</td>`;
            const good = inv ? val <= 2 : val >= 4;
            const bad  = inv ? val >= 4 : val <= 2;
            const col  = good ? '#2e7d32' : bad ? '#c62828' : '#e65100';
            const bg   = good ? '#e8f5e9' : bad ? '#ffebee' : '#fff3e0';
            return `<td style="padding:8px 14px;border-bottom:1px solid var(--border,#e8e8e8);text-align:center"><span style="display:inline-block;width:24px;height:24px;border-radius:50%;background:${bg};color:${col};font-weight:700;font-size:12px;line-height:24px">${val}</span></td>`;
        }).join('');
        const initials = player.name.split(' ').map(w=>w[0]).join('').slice(0,2).toUpperCase();
        return `<tr>
            <td style="padding:8px 14px;border-bottom:1px solid var(--border,#e8e8e8)">
                <div style="display:flex;align-items:center;gap:8px">
                    <div style="width:26px;height:26px;border-radius:50%;background:var(--primary,#ff6600);color:#fff;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0">${initials}</div>
                    <span style="font-weight:500;font-size:12px">${player.name}</span>
                </div>
            </td>
            ${cells}
            <td style="padding:8px 14px;border-bottom:1px solid var(--border,#e8e8e8);text-align:center;font-size:11px;color:var(--text-muted)">${avg('sleep')} / ${avg('mood')}</td>
        </tr>`;
    }).join('');

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Informe Semanal — ${dateRange}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif; color: #1a1a1a; background: #fff; padding: 40px; font-size: 13px; }
        @media print { body { padding: 20px; } .no-print { display: none; } @page { margin: 1.5cm; } }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #ff6600; }
        .header-left h1 { font-size: 22px; color: #ff6600; font-weight: 700; margin-bottom: 4px; }
        .header-left .sub { color: #888; font-size: 12px; }
        .header-right { text-align: right; }
        .header-right .team-name { font-size: 14px; font-weight: 600; color: #333; }
        .header-right .gen-date { font-size: 11px; color: #aaa; margin-top: 2px; }
        .kpi-row { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 32px; }
        .kpi { border: 1px solid #eee; border-radius: 10px; padding: 14px 16px; text-align: center; }
        .kpi-num { font-size: 26px; font-weight: 700; color: #ff6600; line-height: 1; }
        .kpi-lbl { font-size: 10px; color: #aaa; margin-top: 4px; text-transform: uppercase; letter-spacing: .05em; }
        .kpi.ok  { border-color: #a5d6a7; } .kpi.ok .kpi-num  { color: #2e7d32; }
        .kpi.warn{ border-color: #ffcc80; } .kpi.warn .kpi-num{ color: #e65100; }
        .kpi.out { border-color: #ef9a9a; } .kpi.out .kpi-num { color: '#c62828'; }
        .section-title { font-size: 12px; font-weight: 700; color: #444; text-transform: uppercase; letter-spacing: .06em; margin: 28px 0 10px; padding-bottom: 6px; border-bottom: 1.5px solid #eee; display: flex; align-items: center; gap: 8px; }
        .section-title span { background: #ff6600; color: #fff; border-radius: 4px; padding: 1px 7px; font-size: 10px; }
        table { width: 100%; border-collapse: collapse; }
        th { background: #fafafa; padding: 8px 14px; text-align: left; font-size: 10px; font-weight: 700; color: #888; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1.5px solid #eee; }
        .legend { display: flex; gap: 16px; font-size: 10px; color: #888; margin: 8px 0 0; }
        .legend-item { display: flex; align-items: center; gap: 4px; }
        .legend-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
        .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #eee; display: flex; justify-content: space-between; font-size: 10px; color: #bbb; }
    </style></head><body>

    <div class="header">
        <div class="header-left">
            <h1>🏀 Informe Semanal del Equipo</h1>
            <div class="sub">${dateRange}</div>
        </div>
        <div class="header-right">
            <div class="team-name">Basketball RPE Tracker</div>
            <div class="gen-date">Generado el ${now.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'})}</div>
        </div>
    </div>

    <div class="kpi-row">
        <div class="kpi"><div class="kpi-num">${this.players.length}</div><div class="kpi-lbl">Jugadoras</div></div>
        <div class="kpi ok"><div class="kpi-num">${ok.length}</div><div class="kpi-lbl">Zona óptima</div></div>
        <div class="kpi warn"><div class="kpi-num">${caution.length}</div><div class="kpi-lbl">Precaución</div></div>
        <div class="kpi out"><div class="kpi-num">${out.length}</div><div class="kpi-lbl">Lesionadas</div></div>
        <div class="kpi"><div class="kpi-num">${wCoverage}/${this.players.length}</div><div class="kpi-lbl">Wellness hoy</div></div>
    </div>

    <div class="section-title">Carga y Wellness <span>${playerData.length}</span></div>
    <div class="legend">
        <div class="legend-item"><div class="legend-dot" style="background:#4caf50"></div> Óptimo (0.8–1.3)</div>
        <div class="legend-item"><div class="legend-dot" style="background:#ff9800"></div> Precaución (1.3–1.5)</div>
        <div class="legend-item"><div class="legend-dot" style="background:#f44336"></div> Peligro (>1.5)</div>
        <div class="legend-item"><div class="legend-dot" style="background:#2196f3"></div> Bajo (<0.8)</div>
        <div class="legend-item" style="margin-left:8px">Wellness hoy: barra sueño/humor/fatiga/agujetas (1–5)</div>
    </div>
    <table style="margin-top:10px">
        <thead><tr>
            <th style="width:180px">Jugadora</th>
            <th>Ratio A:C</th>
            <th>Wellness hoy</th>
            <th style="text-align:center">RPE medio</th>
            <th style="text-align:center">Carga semana</th>
            <th>Estado</th>
        </tr></thead>
        <tbody>${playerData.map(playerRow).join('')}</tbody>
    </table>

    <div class="section-title">Wellness detalle hoy <span>${wCoverage}/${this.players.length}</span></div>
    <table>
        <thead><tr>
            <th style="width:180px">Jugadora</th>
            <th style="text-align:center">😴 Sueño</th>
            <th style="text-align:center">⚡ Fatiga</th>
            <th style="text-align:center">😊 Humor</th>
            <th style="text-align:center">💪 Agujetas</th>
            <th style="text-align:center">Avg 7d (sueño/humor)</th>
        </tr></thead>
        <tbody>${wTeamRows}</tbody>
    </table>

    <div class="section-title">Lesiones activas <span>${activeInj.length}</span></div>
    <table>
        <thead><tr><th>Jugadora</th><th>Zona</th><th style="text-align:center">Días baja</th><th>Fase RTP</th></tr></thead>
        <tbody>${injuryRows}</tbody>
    </table>

    <div class="footer">
        <span>Basketball RPE Tracker · Metodología EWMA · Ratio A:C zona óptima 0.8–1.3</span>
        <span>Generado ${now.toLocaleString('es-ES')}</span>
    </div>

    </body></html>`;

    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    setTimeout(() => w.print(), 500);
    this.showToast('📄 Informe semanal generado', 'success');
};

RPETracker.prototype.generateTeamStatusPDF = function() {
    this.generateWeeklyTeamPDF();
};

// ========== VISTA DE WELLNESS PARA EL ENTRENADOR ==========


// NOTE: renderWellnessDashboard → wellness.js

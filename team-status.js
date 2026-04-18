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
        } else if (r > 1.5 || (r > 0 && r < 0.8)) {
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
        } else if (r > 1.5) {
            statusBadge = 'ts-badge-danger';
            borderClass = 'ts-card-danger';
            statusText = `Ratio ${ratio.ratio} — Reducir carga`;
        } else if (r > 0 && r < 0.8) {
            statusBadge = 'ts-badge-low';
            borderClass = 'ts-card-low';
            statusText = `Ratio ${ratio.ratio} — Por debajo`;
        } else {
            statusBadge = 'ts-badge-ok';
            borderClass = 'ts-card-ok';
            statusText = ratio.ratio !== 'N/A' ? `Ratio ${ratio.ratio} — Óptimo` : 'Sin datos suficientes';
        }

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

    const now = new Date();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((now.getDay() + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);

    const dateRange = `${monday.toLocaleDateString('es-ES', {day:'numeric',month:'long'})} – ${sunday.toLocaleDateString('es-ES', {day:'numeric',month:'long',year:'numeric'})}`;

    // Build player status table
    const playerRows = this.players.map(player => {
        const ratio = this.calculateAcuteChronicRatio(player.id);
        const r = parseFloat(ratio.ratio);
        const activeInjury = (this.injuries || []).find(i => i.playerId === player.id && i.status === 'active');
        const thisWeekSessions = this.sessions.filter(s => {
            const d = new Date(s.date);
            return d >= monday && d <= sunday && s.playerId === player.id;
        });
        const weekLoad = thisWeekSessions.reduce((s, x) => s + (x.load || x.rpe * (x.duration || 60)), 0);
        const avgRPE = thisWeekSessions.length ? (thisWeekSessions.reduce((s, x) => s + x.rpe, 0) / thisWeekSessions.length).toFixed(1) : '—';

        let status, statusColor;
        if (activeInjury) { status = '🔴 Lesionada'; statusColor = '#c62828'; }
        else if (r > 1.5) { status = '🟠 Peligro A:C'; statusColor = '#e65100'; }
        else if (r > 1.3) { status = '🟡 Precaución'; statusColor = '#f57f17'; }
        else if (r > 0 && r < 0.8) { status = '🔵 Descarga'; statusColor = '#1565c0'; }
        else if (r >= 0.8) { status = '🟢 Óptima'; statusColor = '#2e7d32'; }
        else { status = '⚪ Sin datos'; statusColor = '#999'; }

        return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;font-weight:600">${player.name}${player.number ? ` #${player.number}` : ''}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${ratio.ratio}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${avgRPE}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${weekLoad || '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;color:${statusColor};font-weight:600">${status}</td>
        </tr>`;
    }).join('');

    const activeInjuries = (this.injuries || []).filter(i => i.status === 'active');
    const injuryRows = activeInjuries.length ? activeInjuries.map(injury => {
        const player = this.players.find(p => p.id === injury.playerId);
        const days = injury.getDaysInjured ? injury.getDaysInjured() : '?';
        return `<tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${player?.name || '?'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">${injury.location ? this.getLocationName(injury.location) : '—'}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center">${days} días</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee">Fase RTP ${injury.rtpPhase || 1}/6</td>
        </tr>`;
    }).join('') : `<tr><td colspan="4" style="padding:12px;color:#999;text-align:center">Ninguna jugadora lesionada</td></tr>`;

    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8">
    <title>Informe Semanal — ${dateRange}</title>
    <style>
        body { font-family: Arial, sans-serif; color: #1a1a1a; margin: 0; padding: 40px; }
        h1 { color: #ff6600; font-size: 22px; margin-bottom: 4px; }
        h2 { font-size: 15px; color: #444; margin: 28px 0 10px; border-bottom: 2px solid #ff6600; padding-bottom: 4px; }
        .subtitle { color: #666; font-size: 13px; margin-bottom: 32px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f5f5f5; padding: 8px 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #ddd; }
        .summary { display: flex; gap: 24px; margin-bottom: 28px; }
        .sum-box { background: #f9f9f9; border: 1px solid #eee; border-radius: 8px; padding: 12px 20px; text-align: center; }
        .sum-num { font-size: 28px; font-weight: 700; color: #ff6600; }
        .sum-lbl { font-size: 11px; color: #888; margin-top: 2px; }
        @media print { body { padding: 20px; } }
    </style></head><body>
    <h1>🏀 Informe Semanal del Equipo</h1>
    <div class="subtitle">${dateRange} · Generado el ${now.toLocaleDateString('es-ES', {day:'numeric',month:'long',year:'numeric'})}</div>

    <div class="summary">
        <div class="sum-box"><div class="sum-num">${this.players.length}</div><div class="sum-lbl">Jugadoras</div></div>
        <div class="sum-box"><div class="sum-num">${activeInjuries.length}</div><div class="sum-lbl">Lesionadas</div></div>
        <div class="sum-box"><div class="sum-num">${this.countUniqueSessions(this.sessions.filter(s => new Date(s.date) >= monday && new Date(s.date) <= sunday))}</div><div class="sum-lbl">Sesiones semana</div></div>
        <div class="sum-box"><div class="sum-num">${this.players.filter(p => { const r = parseFloat(this.calculateAcuteChronicRatio(p.id).ratio); return r >= 0.8 && r <= 1.3; }).length}</div><div class="sum-lbl">En zona óptima</div></div>
    </div>

    <h2>Estado de carga por jugadora</h2>
    <table><thead><tr>
        <th>Jugadora</th><th>Ratio A:C</th><th>RPE medio semana</th><th>Carga semana (UA)</th><th>Estado</th>
    </tr></thead><tbody>${playerRows}</tbody></table>

    <h2>Lesiones activas</h2>
    <table><thead><tr>
        <th>Jugadora</th><th>Lesión</th><th>Días de baja</th><th>Fase RTP</th>
    </tr></thead><tbody>${injuryRows}</tbody></table>

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

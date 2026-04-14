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

    const nextMatch = this.weekPlan ? this.weekPlan.find(d => d.type === 'match') : null;

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

RPETracker.prototype.renderMedicalHistory = function() {
    const container = document.getElementById('medicalHistoryView');
    if (!container) return;

    if (this.players.length === 0) {
        container.innerHTML = `<div class="empty-state active"><div class="empty-icon">🏥</div><h3>No hay jugadoras registradas</h3></div>`;
        return;
    }

    const playerCards = this.players.map(player => {
        const playerInjuries = (this.injuries || []).filter(i => i.playerId === player.id);
        const active = playerInjuries.filter(i => i.status === 'active');
        const recovered = playerInjuries.filter(i => i.status === 'recovered');
        const totalDays = playerInjuries.reduce((s, i) => s + (i.getDaysInjured ? i.getDaysInjured() : 0), 0);

        // Zone frequency
        const zones = {};
        playerInjuries.forEach(i => {
            if (i.location) zones[i.location] = (zones[i.location] || 0) + 1;
        });
        const topZone = Object.entries(zones).sort((a, b) => b[1] - a[1])[0];

        return `
            <div class="mh-card">
                <div class="mh-card-header">
                    <div class="mh-avatar">${player.name.charAt(0).toUpperCase()}</div>
                    <div class="mh-player-info">
                        <div class="mh-player-name">${player.name}${player.number ? ` <span class="mh-num">#${player.number}</span>` : ''}</div>
                        <div class="mh-player-sub">${playerInjuries.length} lesión${playerInjuries.length !== 1 ? 'es' : ''} registrada${playerInjuries.length !== 1 ? 's' : ''}</div>
                    </div>
                    ${active.length ? `<span class="mh-active-badge">Lesionada</span>` : ''}
                </div>

                <div class="mh-stats">
                    <div class="mh-stat"><div class="mh-stat-val">${playerInjuries.length}</div><div class="mh-stat-lbl">Total</div></div>
                    <div class="mh-stat"><div class="mh-stat-val">${totalDays}</div><div class="mh-stat-lbl">Días baja</div></div>
                    <div class="mh-stat"><div class="mh-stat-val">${recovered.length}</div><div class="mh-stat-lbl">Recuperadas</div></div>
                    <div class="mh-stat"><div class="mh-stat-val">${topZone ? this.getLocationName(topZone[0]).split(' ')[0] : '—'}</div><div class="mh-stat-lbl">Zona frecuente</div></div>
                </div>

                ${playerInjuries.length > 0 ? `
                <div class="mh-timeline">
                    ${playerInjuries.slice().reverse().map(injury => {
                        const days = injury.getDaysInjured ? injury.getDaysInjured() : '?';
                        const statusCls = injury.status === 'active' ? 'mh-inj-active' : 'mh-inj-recovered';
                        const start = new Date(injury.startDate).toLocaleDateString('es-ES', {day:'numeric', month:'short', year:'numeric'});
                        return `
                            <div class="mh-injury-item ${statusCls}">
                                <div class="mh-inj-dot"></div>
                                <div class="mh-inj-content">
                                    <div class="mh-inj-title">${this.getTypeName ? this.getTypeName(injury.type) : injury.type} — ${injury.location ? this.getLocationName(injury.location) : 'Sin zona'}</div>
                                    <div class="mh-inj-meta">${start} · ${days} días · ${injury.severity || 'sin clasificar'}</div>
                                    ${injury.description ? `<div class="mh-inj-desc">${injury.description}</div>` : ''}
                                </div>
                                <div class="mh-inj-status">${injury.status === 'active' ? '🔴 Activa' : '✅ Recuperada'}</div>
                            </div>`;
                    }).join('')}
                </div>
                ` : `<div class="mh-no-injuries">Sin lesiones registradas</div>`}
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="mh-header">
            <h2>Historial médico del equipo</h2>
            <div class="mh-team-stats">
                <span>${(this.injuries||[]).filter(i=>i.status==='active').length} lesiones activas</span>
                <span>·</span>
                <span>${(this.injuries||[]).length} total temporada</span>
            </div>
        </div>
        <div class="mh-grid">${playerCards}</div>
    `;
};


// ========== CARGA EN READAPTACIÓN ==========

RPETracker.prototype.renderRehabLoad = function() {
    const container = document.getElementById('rehabLoadView');
    if (!container) return;

    const activeInjuries = (this.injuries || []).filter(i => i.status === 'active');

    if (activeInjuries.length === 0) {
        container.innerHTML = `
            <div class="rl-header"><h2>Carga en readaptación</h2></div>
            <div class="empty-state active" style="margin-top:2rem;">
                <div class="empty-icon">💪</div>
                <h3>Ninguna jugadora en readaptación</h3>
                <p>Cuando haya lesiones activas aparecerán aquí</p>
            </div>`;
        return;
    }

    const rehabKey = (injuryId, date) => `rehab_${injuryId}_${date}`;

    const injuryPanels = activeInjuries.map(injury => {
        const player = this.players.find(p => p.id === injury.playerId);
        if (!player) return '';

        // Load existing rehab sessions from localStorage
        const rehabData = JSON.parse(localStorage.getItem(`rehab_${injury.id}`) || '[]');
        const totalRehabLoad = rehabData.reduce((s, r) => s + r.rpe * r.duration, 0);

        const phaseLabels = ['Fase 1: Control del dolor', 'Fase 2: Movilidad', 'Fase 3: Fuerza', 'Fase 4: Carrera', 'Fase 5: Técnica', 'Fase 6: Retorno'];
        const currentPhase = injury.rtpPhase || 1;

        return `
            <div class="rl-card">
                <div class="rl-card-header">
                    <div class="rl-player-info">
                        <div class="rl-avatar">${player.name.charAt(0).toUpperCase()}</div>
                        <div>
                            <div class="rl-player-name">${player.name}${player.number ? ` #${player.number}` : ''}</div>
                            <div class="rl-injury-info">${injury.location ? this.getLocationName(injury.location) : 'lesión'} · Día ${injury.getDaysInjured ? injury.getDaysInjured() : '?'}</div>
                        </div>
                    </div>
                    <div class="rl-phase-badge">RTP ${currentPhase}/6</div>
                </div>

                <div class="rl-phase-info">${phaseLabels[currentPhase - 1] || 'Fase desconocida'}</div>

                <div class="rl-add-session">
                    <div class="rl-add-title">Registrar sesión de readaptación</div>
                    <div class="rl-controls">
                        <div class="rl-control">
                            <label>RPE fisio</label>
                            <input type="range" min="1" max="10" value="3" id="rehab-rpe-${injury.id}" step="1"
                                oninput="document.getElementById('rehab-rpe-val-${injury.id}').textContent=this.value">
                            <span id="rehab-rpe-val-${injury.id}" class="rl-val">3</span>
                        </div>
                        <div class="rl-control">
                            <label>Duración (min)</label>
                            <select id="rehab-dur-${injury.id}">
                                ${[15,20,30,45,60,90].map(v=>`<option value="${v}" ${v===30?'selected':''}>${v}'</option>`).join('')}
                            </select>
                        </div>
                        <div class="rl-control">
                            <label>Tipo</label>
                            <select id="rehab-type-${injury.id}">
                                <option value="fisio">Fisioterapia</option>
                                <option value="movilidad">Movilidad</option>
                                <option value="fuerza">Fuerza</option>
                                <option value="carrera">Carrera</option>
                                <option value="especifico">Específico</option>
                            </select>
                        </div>
                    </div>
                    <button class="btn-primary" style="width:100%;margin-top:0.75rem;font-size:0.9rem;"
                        onclick="window.rpeTracker?.saveRehabSession('${injury.id}')">
                        + Registrar sesión
                    </button>
                </div>

                <div class="rl-history">
                    <div class="rl-history-title">Historial readaptación · Carga total: <strong>${totalRehabLoad} UA</strong></div>
                    ${rehabData.length === 0 ? '<div class="rl-no-data">Sin sesiones registradas</div>' :
                        rehabData.slice().reverse().slice(0, 5).map(r => `
                            <div class="rl-session-row">
                                <span class="rl-session-date">${new Date(r.date).toLocaleDateString('es-ES', {day:'numeric',month:'short'})}</span>
                                <span class="rl-session-type">${r.typeLabel || r.type}</span>
                                <span class="rl-session-data">RPE ${r.rpe} × ${r.duration}' = ${r.rpe * r.duration} UA</span>
                            </div>`).join('')
                    }
                </div>
            </div>`;
    }).join('');

    container.innerHTML = `
        <div class="rl-header"><h2>Carga en readaptación</h2><p>${activeInjuries.length} jugadora${activeInjuries.length !== 1 ? 's' : ''} en readaptación</p></div>
        ${injuryPanels}`;
};

RPETracker.prototype.saveRehabSession = function(injuryId) {
    const rpe = parseInt(document.getElementById(`rehab-rpe-${injuryId}`)?.value || 3);
    const duration = parseInt(document.getElementById(`rehab-dur-${injuryId}`)?.value || 30);
    const type = document.getElementById(`rehab-type-${injuryId}`)?.value || 'fisio';
    const typeLabels = { fisio: 'Fisioterapia', movilidad: 'Movilidad', fuerza: 'Fuerza', carrera: 'Carrera', especifico: 'Específico' };

    const existing = JSON.parse(localStorage.getItem(`rehab_${injuryId}`) || '[]');
    existing.push({ date: new Date().toISOString(), rpe, duration, type, typeLabel: typeLabels[type] });
    localStorage.setItem(`rehab_${injuryId}`, JSON.stringify(existing));

    this.showToast('✅ Sesión de readaptación registrada', 'success');
    this.renderRehabLoad();
};


// ========== CORRELACIÓN CARGA → LESIÓN ==========

RPETracker.prototype.renderLoadInjuryCorrelation = function() {
    const container = document.getElementById('correlationView');
    if (!container) return;

    const injuries = (this.injuries || []);

    if (injuries.length === 0) {
        container.innerHTML = `
            <div class="corr-header"><h2>Correlación carga → lesión</h2></div>
            <div class="empty-state active" style="margin-top:2rem;">
                <div class="empty-icon">🔗</div>
                <h3>Sin lesiones registradas</h3>
                <p>Cuando registres lesiones, aquí verás qué pasó con la carga en los 14 días previos</p>
            </div>`;
        return;
    }

    const analysisCards = injuries.map(injury => {
        const player = this.players.find(p => p.id === injury.playerId);
        if (!player) return '';

        const injuryDate = new Date(injury.startDate);
        const d14before = new Date(injuryDate); d14before.setDate(d14before.getDate() - 14);
        const d7before = new Date(injuryDate); d7before.setDate(d7before.getDate() - 7);

        const playerSessions = this.sessions.filter(s => s.playerId === player.id);
        const prev14 = playerSessions.filter(s => new Date(s.date) >= d14before && new Date(s.date) < injuryDate);
        const prev7  = playerSessions.filter(s => new Date(s.date) >= d7before  && new Date(s.date) < injuryDate);
        const prev7to14 = playerSessions.filter(s => new Date(s.date) >= d14before && new Date(s.date) < d7before);

        const load7  = prev7.reduce((s, x) => s + (x.load || x.rpe * (x.duration || 60)), 0);
        const load14 = prev14.reduce((s, x) => s + (x.load || x.rpe * (x.duration || 60)), 0);
        const load7to14 = prev7to14.reduce((s, x) => s + (x.load || x.rpe * (x.duration || 60)), 0);
        const avgRPE14 = prev14.length ? (prev14.reduce((s, x) => s + x.rpe, 0) / prev14.length).toFixed(1) : 'N/A';

        // Spike detection: last 7d vs previous 7d
        const spike = load7to14 > 0 ? ((load7 - load7to14) / load7to14 * 100).toFixed(0) : null;
        let spikeAlert = '';
        if (spike !== null && parseFloat(spike) > 20) {
            spikeAlert = `<div class="corr-alert corr-alert-danger">⚠️ Pico de carga del +${spike}% en los 7 días previos a la lesión</div>`;
        } else if (spike !== null && parseFloat(spike) > 10) {
            spikeAlert = `<div class="corr-alert corr-alert-warning">📈 Incremento moderado de carga (+${spike}%) la semana previa</div>`;
        } else if (prev14.length === 0) {
            spikeAlert = `<div class="corr-alert corr-alert-info">ℹ️ Sin sesiones registradas en los 14 días previos</div>`;
        } else {
            spikeAlert = `<div class="corr-alert corr-alert-ok">✅ Carga sin picos detectables en los 14 días previos</div>`;
        }

        // Week by week bars
        const bar = (load, maxLoad, label) => {
            const pct = maxLoad > 0 ? Math.min(Math.round(load / maxLoad * 100), 100) : 0;
            return `<div class="corr-bar-row">
                <div class="corr-bar-label">${label}</div>
                <div class="corr-bar-track"><div class="corr-bar-fill" style="width:${pct}%"></div></div>
                <div class="corr-bar-val">${load} UA</div>
            </div>`;
        };
        const maxLoad = Math.max(load7, load7to14, 1);

        return `
            <div class="corr-card">
                <div class="corr-card-header">
                    <div class="corr-player">${player.name}${player.number ? ` #${player.number}` : ''}</div>
                    <div class="corr-injury-info">
                        ${injury.location ? this.getLocationName(injury.location) : 'Lesión'} ·
                        ${new Date(injury.startDate).toLocaleDateString('es-ES', {day:'numeric',month:'long',year:'numeric'})} ·
                        <span style="color:${injury.status==='active'?'#f44336':'#4caf50'}">${injury.status === 'active' ? 'Activa' : 'Recuperada'}</span>
                    </div>
                </div>

                ${spikeAlert}

                <div class="corr-bars">
                    ${bar(load7to14, maxLoad, 'Días 8–14 antes')}
                    ${bar(load7, maxLoad, 'Días 1–7 antes')}
                </div>

                <div class="corr-stats">
                    <div class="corr-stat"><div class="corr-stat-val">${prev14.length}</div><div class="corr-stat-lbl">Sesiones en 14d previos</div></div>
                    <div class="corr-stat"><div class="corr-stat-val">${avgRPE14}</div><div class="corr-stat-lbl">RPE medio previo</div></div>
                    <div class="corr-stat"><div class="corr-stat-val">${load14}</div><div class="corr-stat-lbl">Carga total 14d</div></div>
                </div>
            </div>`;
    }).join('');

    // Team pattern summary
    const injuriesWithSpike = injuries.filter(injury => {
        const player = this.players.find(p => p.id === injury.playerId);
        if (!player) return false;
        const injuryDate = new Date(injury.startDate);
        const d14before = new Date(injuryDate); d14before.setDate(d14before.getDate() - 14);
        const d7before = new Date(injuryDate); d7before.setDate(d7before.getDate() - 7);
        const playerSessions = this.sessions.filter(s => s.playerId === player.id);
        const load7 = playerSessions.filter(s => new Date(s.date) >= d7before && new Date(s.date) < injuryDate).reduce((s, x) => s + (x.load || x.rpe * (x.duration || 60)), 0);
        const load7to14 = playerSessions.filter(s => new Date(s.date) >= d14before && new Date(s.date) < d7before).reduce((s, x) => s + (x.load || x.rpe * (x.duration || 60)), 0);
        return load7to14 > 0 && (load7 - load7to14) / load7to14 > 0.2;
    }).length;

    container.innerHTML = `
        <div class="corr-header">
            <h2>Correlación carga → lesión</h2>
            <p>Análisis de carga en los 14 días previos a cada lesión</p>
        </div>
        ${injuries.length > 1 ? `
        <div class="corr-summary">
            <strong>${injuriesWithSpike} de ${injuries.length} lesiones</strong> tuvieron un pico de carga (&gt;+20%) en la semana previa.
            ${injuriesWithSpike > injuries.length / 2 ? ' El patrón sugiere que los picos de carga son un factor de riesgo relevante en este equipo.' : ''}
        </div>` : ''}
        ${analysisCards}`;
};


// ========== INFORME PDF SEMANAL DEL EQUIPO ==========

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

RPETracker.prototype.renderWellnessDashboard = function() {
    const container = document.getElementById('wellnessDashboardView');
    if (!container) return;

    const allData = AppAuth.loadWellnessData();
    const today = new Date().toISOString().slice(0, 10);
    const todayData = allData.filter(w => w.date === today);

    const label = (q, v) => {
        const labels = {
            sleep:   ['','Muy mal','Mal','Regular','Bien','Muy bien'],
            fatigue: ['','Agotada','Muy cansada','Cansada','Bien','Fresca'],
            pain:    ['','Mucho dolor','Dolor','Algo','Leve','Sin dolor']
        };
        return labels[q][v] || v;
    };

    const color = v => ['','#f44336','#ff5722','#ff9800','#8bc34a','#4caf50'][v] || '#ccc';

    const playerCards = this.players.map(player => {
        const response = todayData.find(w => w.playerId === player.id);
        const hasInjury = (this.injuries || []).some(i => i.playerId === player.id && i.status === 'active');

        if (!response) {
            return `
                <div class="wc-card wc-pending">
                    <div class="wc-avatar">${player.name.charAt(0).toUpperCase()}</div>
                    <div class="wc-info">
                        <div class="wc-name">${player.name}${player.number ? ` <span class="wc-num">#${player.number}</span>` : ''}</div>
                        <div class="wc-status-text">Sin respuesta hoy</div>
                    </div>
                    ${hasInjury ? '<span class="wc-injury-badge">Lesionada</span>' : '<span class="wc-pending-badge">Pendiente</span>'}
                </div>`;
        }

        const avg = Math.round((response.sleep + response.fatigue + response.pain) / 3);
        const overall = color(avg);

        return `
            <div class="wc-card wc-answered" style="border-left:3px solid ${overall}">
                <div class="wc-avatar" style="background:${overall}">${player.name.charAt(0).toUpperCase()}</div>
                <div class="wc-info">
                    <div class="wc-name">${player.name}${player.number ? ` <span class="wc-num">#${player.number}</span>` : ''}</div>
                    <div class="wc-scores">
                        <span title="Sueño">😴 ${response.sleep}</span>
                        <span title="Fatiga">💪 ${response.fatigue}</span>
                        <span title="Dolor">🦵 ${response.pain}</span>
                    </div>
                </div>
                <div class="wc-avg" style="color:${overall}">${avg}/5</div>
            </div>`;
    }).join('');

    const answered = todayData.filter(w => this.players.some(p => p.id === w.playerId)).length;

    container.innerHTML = `
        <div class="wc-header">
            <div>
                <h2>Wellness del equipo</h2>
                <div class="wc-subtitle">${new Date().toLocaleDateString('es-ES',{weekday:'long',day:'numeric',month:'long'})}</div>
            </div>
            <div class="wc-summary">
                <span class="wc-sum-num">${answered}</span>/<span>${this.players.length}</span>
                <div class="wc-sum-lbl">respondidas</div>
            </div>
        </div>
        <div class="wc-cards">${playerCards || '<div style="color:#bbb;padding:1rem">No hay jugadoras registradas</div>'}</div>
    `;
};

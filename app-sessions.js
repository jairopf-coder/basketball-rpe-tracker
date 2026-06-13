// app-sessions.js — Módulo de sesiones de equipo: creación, listado, detalle, edición (extraído de app.js V25)

RPETracker.prototype.openNewSessionModal = function() {
    if (this.players.length === 0) {
        AppAlert.show('⚠️ Primero debes añadir jugadoras en la sección "Jugadoras"');
        return;
    }
    this.selectedPlayerIds = [];
    const _modal1 = document.getElementById('newSessionModal');
    _modal1.classList.add('active');
    this._ftRelease = trapFocus(_modal1);
    this.setDefaultDateTime();
    this._populateSeasonSelector();
    this.renderPlayerButtonsMulti();
    document.getElementById('sessionDuration').value = 60;
    // Reset duration buttons
    document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('selected'));
    const d60 = document.querySelector('[data-duration="60"]');
    if (d60) d60.classList.add('selected');
    this.goToStep1();
};

RPETracker.prototype.renderPlayerButtons = function() {
    this.renderPlayerButtonsMulti();
};

RPETracker.prototype.renderPlayerButtonsMulti = function() {
    const container = document.getElementById('playerButtons');
    if (!container) return;
    container.innerHTML = this.players.map(player => {
        const color = PlayerTokens.get(player);
        return `
        <button type="button" class="player-btn" data-player-id="${player.id}" style="--player-token:${color}">
            ${PlayerTokens.avatar(player, 50, '1.3rem', 'player-btn-avatar')}
            <div class="player-btn-name">${player.name}</div>
            ${player.number ? `<div class="player-btn-number">#${player.number}</div>` : ''}
        </button>`;
    }).join('');
    this.updateSelectedCount();
};

RPETracker.prototype._populateSeasonSelector = function() {
    const sel = document.getElementById('sessionSeason');
    if (!sel) return;
    const seasons = Store.getSeasonsFromSessions(this.sessions);
    sel.innerHTML = seasons.map(s =>
        `<option value="${s}"${s === Store.getActiveSeason() ? ' selected' : ''}>${s}</option>`
    ).join('') + `<option value="__new__">+ Nueva temporada…</option>`;

    // Mostrar/ocultar input de temporada nueva
    sel.onchange = () => {
        const wrap = document.getElementById('newSeasonInputWrap');
        if (wrap) wrap.style.display = sel.value === '__new__' ? 'flex' : 'none';
    };

    const wrap = document.getElementById('newSeasonInputWrap');
    if (wrap) wrap.style.display = 'none';
};

RPETracker.prototype._getSelectedSeason = function() {
    const sel = document.getElementById('sessionSeason');
    if (!sel) return Store.getActiveSeason();
    if (sel.value === '__new__') {
        const input = document.getElementById('newSeasonInput');
        const val   = (input ? input.value : '').trim();
        if (!val) {
            this.showToast('⚠️ Escribe el nombre de la nueva temporada', 'warning');
            return null; // señal de error
        }
        return val;
    }
    return sel.value || Store.getActiveSeason();
};

RPETracker.prototype.togglePlayerSelection = function(playerId) {
    if (!this.selectedPlayerIds) this.selectedPlayerIds = [];
    const idx = this.selectedPlayerIds.indexOf(playerId);
    if (idx === -1) {
        this.selectedPlayerIds.push(playerId);
    } else {
        this.selectedPlayerIds.splice(idx, 1);
    }
    // Update button styles
    document.querySelectorAll('.player-btn').forEach(btn => {
        const id = btn.dataset.playerId;
        btn.classList.toggle('multi-selected', this.selectedPlayerIds.includes(id));
    });
    this.updateSelectedCount();
};

RPETracker.prototype.updateSelectedCount = function() {
    const el = document.getElementById('selectedCount');
    if (!el) return;
    const n = (this.selectedPlayerIds || []).length;
    const total = this.players.length;
    el.textContent = n === 0 ? '0 jugadoras seleccionadas'
        : n === 1 ? '1 jugadora seleccionada'
        : `${n} jugadoras seleccionadas`;
    el.classList.toggle('has-selection', n > 0);

    // Update select-all button
    const btn = document.getElementById('selectAllBtn');
    if (!btn) return;
    if (n === total) {
        btn.textContent = 'Deseleccionar todas';
        btn.classList.add('active');
    } else {
        btn.textContent = 'Seleccionar todas';
        btn.classList.remove('active');
    }
};

RPETracker.prototype.selectAllPlayers = function() {
    if (!this.selectedPlayerIds) this.selectedPlayerIds = [];
    const allSelected = this.selectedPlayerIds.length === this.players.length;
    if (allSelected) {
        this.selectedPlayerIds = [];
    } else {
        this.selectedPlayerIds = this.players.map(p => p.id);
    }
    document.querySelectorAll('.player-btn').forEach(btn => {
        btn.classList.toggle('multi-selected', this.selectedPlayerIds.includes(btn.dataset.playerId));
    });
    this.updateSelectedCount();
};

RPETracker.prototype.selectPlayer = function(playerId) {
    this.togglePlayerSelection(playerId);
};

RPETracker.prototype.goToStep1 = function() {
    document.getElementById('sessionStep1').style.display = '';
    document.getElementById('sessionStep2').style.display = 'none';
    document.getElementById('modalTitle').textContent = 'Nueva Sesión — Paso 1';
    document.getElementById('dot1').classList.add('active');
    document.getElementById('dot1').classList.remove('done');
    document.getElementById('dot2').classList.remove('active');
};

RPETracker.prototype.goToStep2 = function() {
    if (!this.selectedPlayerIds || this.selectedPlayerIds.length === 0) {
        this.showToast('⚠️ Selecciona al menos una jugadora', 'warning');
        return;
    }
    const date = document.getElementById('sessionDate').value;
    if (!date) {
        this.showToast('⚠️ Selecciona una fecha', 'warning');
        return;
    }
    this.renderPlayerRpeList();
    document.getElementById('sessionStep1').style.display = 'none';
    document.getElementById('sessionStep2').style.display = '';
    document.getElementById('modalTitle').textContent = 'Nueva Sesión — Paso 2';
    document.getElementById('dot1').classList.remove('active');
    document.getElementById('dot1').classList.add('done');
    document.getElementById('dot2').classList.add('active');
};

RPETracker.prototype.renderPlayerRpeList = function() {
    const container = document.getElementById('playerRpeList');
    if (!container) return;
    container.innerHTML = this.selectedPlayerIds.map(playerId => {
        const player = this.players.find(p => p.id === playerId);
        if (!player) return '';
        const color = PlayerTokens.get(player);
        return `
            <div class="player-rpe-item" id="rpe-item-${player.id}" style="border-left:3px solid ${color}">
                <div class="player-rpe-header">
                    ${PlayerTokens.avatar(player, 36, '0.9rem', 'player-rpe-avatar')}
                    <div class="player-rpe-name">${player.name}${player.number ? ` <span style="opacity:0.6;font-size:0.85rem">#${player.number}</span>` : ''}</div>
                    <div style="display:flex;align-items:center;gap:6px;">
                        <div class="player-rpe-label-text" id="rpeLbl-${player.id}" style="text-align:right">${this.getRPELabel(5)}</div>
                    </div>
                </div>
                <div class="rpe-btn-grid" id="rpeBtns-${player.id}">
                    ${[1,2,3,4,5,6,7,8,9,10].map(v => `
                        <button type="button" class="rpe-num-btn ${v===5?'selected':''}"
                            data-player="${player.id}" data-val="${v}"
                            ${v===5?`style="background:${this.getRPEColor(v)};color:white;border-color:${this.getRPEColor(v)};"` : ''}
                            onclick="window.rpeTracker?.selectRPEButton('${player.id}',${v})">
                            ${v}
                        </button>`).join('')}
                </div>
                <input type="hidden" id="rpeHidden-${player.id}" value="5">
                <textarea class="player-rpe-notes" id="notes-${player.id}" rows="2"
                    placeholder="Incidencias de ${player.name} (opcional)..."></textarea>
            </div>`;
    }).join('');
};

RPETracker.prototype.updateIndividualRPE = function(playerId, value) {
    const val = parseInt(value);
    const valEl = document.getElementById(`rpeVal-${playerId}`);
    const lblEl = document.getElementById(`rpeLbl-${playerId}`);
    if (valEl) { valEl.textContent = val; valEl.style.color = this.getRPEColor(val); }
    if (lblEl) lblEl.textContent = this.getRPELabel(val);
};

RPETracker.prototype.selectRPEButton = function(playerId, value) {
    const val = parseInt(value);
    // Update hidden input
    const hidden = document.getElementById(`rpeHidden-${playerId}`);
    if (hidden) hidden.value = val;
    // Update label
    const lbl = document.getElementById(`rpeLbl-${playerId}`);
    if (lbl) lbl.textContent = this.getRPELabel(val);
    // Update button styles
    document.querySelectorAll(`#rpeBtns-${playerId} .rpe-num-btn`).forEach(btn => {
        const v = parseInt(btn.dataset.val);
        const active = v === val;
        const color = this.getRPEColor(v);
        btn.classList.toggle('selected', active);
        if (active) {
            btn.style.background = color;
            btn.style.color = 'white';
            btn.style.borderColor = color;
        } else {
            btn.style.removeProperty('background');
            btn.style.removeProperty('color');
            btn.style.removeProperty('border-color');
        }
    });
};

RPETracker.prototype.saveTeamSession = function() {
    if (this._savingTeamSession) return;
    this._savingTeamSession = true;
    const saveBtn = document.querySelector('#newSessionModal .btn-primary');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = '⏳ Guardando…'; }
    try {
    const dateValue = document.getElementById('sessionDate').value;
    const timeOfDay = document.querySelector('input[name="sessionTime"]:checked').value;
    const timeString = timeOfDay === 'morning' ? 'T10:00:00' : 'T18:00:00';
    const fullDateTime = dateValue + timeString;
    const duration = parseInt(document.getElementById('sessionDuration').value) || 60;
    const type = document.querySelector('input[name="sessionType"]:checked').value;
    const season = this._getSelectedSeason();
    if (season === null) return; // error ya mostrado
    const baseId = Date.now();

    this.selectedPlayerIds.forEach((playerId, i) => {
        const hidden = document.getElementById(`rpeHidden-${playerId}`);
        const notesEl = document.getElementById(`notes-${playerId}`);
        const rpe = hidden ? parseInt(hidden.value) : 5;
        const notes = notesEl ? notesEl.value : '';
        const session = {
            id: (baseId + i).toString(),
            playerId,
            date: fullDateTime,
            timeOfDay,
            type,
            rpe,
            duration,
            load: rpe * duration,
            notes,
            season
        };
        this.sessions.push(session);
    });

    this.saveSessions();
    this.renderSessions();
    this.closeModal('newSessionModal');
    const n = this.selectedPlayerIds.length;

    // Batch 3: show ratio in toast for single-player saves
    if (n === 1) {
        const pid = this.selectedPlayerIds[0];
        const p = this.players.find(pl => pl.id === pid);
        const ratio = this.calculateAcuteChronicRatio(pid);
        const r = parseFloat(ratio.ratio);
        const _t1 = this.getPlayerThresholds(playerId); const icon = isNaN(r) ? '' : r > _t1.high ? '🔴' : r > _t1.opt ? '🟠' : r < _t1.low ? '🔵' : '🟢';
        const rLabel = ratio.ratio === 'N/A' ? '' : ` · Ratio A:C: ${ratio.ratio} ${icon}`;
        this.showToast(`✅ Sesión guardada${rLabel}`, 'success');
    } else {
        this.showToast(`✅ ${n} sesiones guardadas`, 'success');
    }

    // Fire A:C push notifications for any player above critical threshold
    const _savedIds = [...this.selectedPlayerIds];
    setTimeout(() => PushNotifications.checkACAlerts(this, _savedIds), 300);

    this.selectedPlayerIds = [];
    } finally {
        this._savingTeamSession = false;
        const saveBtn = document.querySelector('#newSessionModal .btn-primary');
        if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = '💾 Guardar sesión'; }
    }
};

RPETracker.prototype.selectDuration = function(duration) {
    // Remove previous selection
    document.querySelectorAll('.duration-btn').forEach(btn => {
        btn.classList.remove('selected');
    });
    
    // Select new duration button if it exists
    const selectedBtn = document.querySelector(`[data-duration="${duration}"]`);
    if (selectedBtn) {
        selectedBtn.classList.add('selected');
        document.getElementById('customDuration').value = '';
    }
    
    // Set hidden input value
    document.getElementById('sessionDuration').value = duration;
};

RPETracker.prototype.getBasicFilteredSessions = function() {
    let filtered = [...this.sessions];
    
    if (this.currentPlayerFilter !== 'all') {
        filtered = filtered.filter(s => s.playerId === this.currentPlayerFilter);
    }
    
    if (this.currentTypeFilter !== 'all') {
        filtered = filtered.filter(s => s.type === this.currentTypeFilter);
    }
    
    return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
};

RPETracker.prototype.renderSessions = function() {
    const listContainer = document.getElementById('sessionList');
    const emptyState = document.getElementById('emptyState');
    
    // Use advanced filtering if available
    const filteredSessions = typeof this.getFilteredAndSortedSessions === 'function' 
        ? this.getFilteredAndSortedSessions()
        : this.getBasicFilteredSessions();
    
    if (filteredSessions.length === 0) {
        listContainer.innerHTML = '';
        emptyState.classList.add('active');
        return;
    }
    
    emptyState.classList.remove('active');
    
    const sorted = filteredSessions;
    
    listContainer.innerHTML = sorted.map(session => {
        const player = this.players.find(p => p.id === session.playerId);
        const playerName = player ? player.name : 'Desconocida';

        // Batch 2: time badge
        const sessionDate = new Date(session.date);
        const today = new Date(); today.setHours(0,0,0,0);
        const yesterday = new Date(today); yesterday.setDate(yesterday.getDate() - 1);
        sessionDate.setHours(0,0,0,0);
        let timeBadge = '';
        if (sessionDate.getTime() === today.getTime()) {
            timeBadge = '<span class="session-time-badge badge-today">HOY</span>';
        } else if (sessionDate.getTime() === yesterday.getTime()) {
            timeBadge = '<span class="session-time-badge badge-yesterday">AYER</span>';
        } else {
            const diffDays = Math.floor((today - sessionDate) / 86400000);
            if (diffDays <= 6) timeBadge = `<span class="session-time-badge badge-recent">hace ${diffDays}d</span>`;
        }

        return `
            <div class="session-card" onclick="window.rpeTracker?.showSessionDetail('${session.id}')">
                <div class="session-icon ${session.type}">
                    ${{training:'🏀',match:'🏟️',shooting:'🎯',gym:'🏋️',recovery:'💪'}[session.type] || '🏀'}
                </div>
                <div class="session-info">
                    <div class="session-type">
                        ${player ? PlayerTokens.avatar(player, 18, '0.55rem', 'session-player-token') : ''}
                        ${playerName} - ${this.getSessionTypeName(session.type)}
                        ${timeBadge}
                    </div>
                    <div class="session-date">${this.formatDate(session.date)}</div>
                </div>
                <div class="session-rpe">
                    <span class="session-rpe-number" style="color: ${this.getRPEColor(session.rpe)}">${session.rpe}</span>
                    <span class="session-rpe-label">RPE</span>
                </div>
            </div>
        `;
    }).join('');

    // Batch 3: keep nav badge in sync
    if (typeof this._updateNavAlertBadge === 'function') this._updateNavAlertBadge();
};

RPETracker.prototype.showSessionDetail = function(id) {
    const session = this.sessions.find(s => s.id === id);
    if (!session) return;
    
    this.currentSessionId = id;
    const player = this.players.find(p => p.id === session.playerId);
    const playerName = player ? player.name : 'Desconocida';
    
    const timeOfDay = session.timeOfDay === 'morning' ? '☀️ Mañana' : '🌙 Tarde';

    // Batch 3: calculate A:C ratio context
    const ratio = player ? this.calculateAcuteChronicRatio(player.id) : null;
    const ratioVal  = ratio ? ratio.ratio : 'N/A';
    const ratioColor = ratio ? this.getRatioColor(ratioVal) : '#999';
    const ratioIcon = (() => {
        const r = parseFloat(ratioVal);
        if (isNaN(r)) return '—';
        const _t2 = this.getPlayerThresholds(null);
        if (r > _t2.high) return '🔴';
        if (r > _t2.opt)  return '🟠';
        if (r < _t2.low)  return '🔵';
        return '🟢';
    })();

    // Batch 3: session position in player history
    const playerSessions = this.sessions
        .filter(s => s.playerId === session.playerId)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    const sessionIdx = playerSessions.findIndex(s => s.id === session.id) + 1;
    const totalSessions = playerSessions.length;
    
    const content = document.getElementById('detailContent');
    content.innerHTML = `
        ${player ? `
        <div class="sd-player-header">
            ${PlayerTokens.avatar(player, 44, '1.1rem')}
            <div class="sd-player-info">
                <div class="sd-player-name">${playerName}${player.number ? ` <span class="sd-player-number">#${player.number}</span>` : ''}</div>
                <div class="sd-player-meta">Sesión ${sessionIdx} de ${totalSessions}</div>
            </div>
            <div class="sd-ratio-badge" style="color:${ratioColor};border-color:${ratioColor}20;background:${ratioColor}12">
                <span class="sd-ratio-icon">${ratioIcon}</span>
                <span class="sd-ratio-val">${ratioVal}</span>
                <span class="sd-ratio-lbl">Ratio A:C</span>
            </div>
        </div>` : ''}
        <div class="detail-row">
            <span class="detail-label">Tipo</span>
            <span>${{training:'🏀 Entrenamiento',match:'🏟️ Partido',shooting:'🎯 Tiro',gym:'🏋️ Gym',recovery:'💪 Recuperación'}[session.type] || '🏀 Entrenamiento'}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Fecha</span>
            <span>${this.formatDate(session.date)}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Momento</span>
            <span>${timeOfDay}</span>
        </div>
        <div class="detail-row">
            <span class="detail-label">Duración</span>
            <span>⏱️ ${session.duration || 60} minutos</span>
        </div>
        <div class="detail-rpe-display">
            <span class="detail-rpe-number" style="color: ${this.getRPEColor(session.rpe)}">${session.rpe}</span>
            <div>${this.getRPELabel(session.rpe)}</div>
        </div>
        <div class="detail-row sd-load-row">
            <span class="detail-label">Carga Total (sRPE)</span>
            <span style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${session.load || (session.rpe * (session.duration || 60))}</span>
        </div>
        ${session.notes ? `
            <div class="detail-row">
                <span class="detail-label">Incidencias</span>
            </div>
            <div class="detail-notes">${esc(session.notes)}</div>
        ` : '<div class="detail-notes" style="font-style: italic; color: var(--text-faint);">Sin incidencias registradas</div>'}
        ${playerSessions.length >= 2 ? `
        <div class="detail-rpe-hist-section">
            <div class="detail-rpe-hist-title">📊 Distribución RPE — historial de ${playerName}</div>
            <canvas id="rpeHistogramCanvas" class="detail-rpe-hist-canvas"></canvas>
        </div>` : ''}
    `;
    
    const _dModal = document.getElementById('detailModal');
    _dModal.classList.add('active');
    this._ftRelease3 = trapFocus(_dModal);

    // Render RPE histogram after modal is in DOM
    if (playerSessions.length >= 2) {
        requestAnimationFrame(() => this._renderRPEHistogram(playerSessions, session.rpe));
    }
};

RPETracker.prototype._renderRPEHistogram = function(playerSessions, currentRpe) {
    const canvas = document.getElementById('rpeHistogramCanvas');
    if (!canvas) return;
    if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }

    // Build counts for RPE 1-10
    const counts = Array(10).fill(0);
    playerSessions.forEach(s => { if (s.rpe >= 1 && s.rpe <= 10) counts[s.rpe - 1]++; });
    const labels = ['1','2','3','4','5','6','7','8','9','10'];

    const rpeColors = [
        '#43a047','#66bb6a','#9ccc65','#d4e157',
        '#ffee58','#ffa726','#ef6c00','#e53935','#b71c1c','#7b1fa2'
    ];

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#aaa' : '#666';
    const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)';

    const barColors = rpeColors.map((c, i) => {
        const isActive = (i + 1) === currentRpe;
        return isActive ? c : (isDark ? c + '55' : c + '77');
    });

    canvas._chartInstance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: 'Sesiones',
                data: counts,
                backgroundColor: barColors,
                borderColor: rpeColors,
                borderWidth: (ctx) => (ctx.dataIndex + 1 === currentRpe ? 2 : 0),
                borderRadius: 4,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 500, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        title: (items) => `RPE ${items[0].label}`,
                        label: (ctx) => `${ctx.raw} sesión${ctx.raw !== 1 ? 'es' : ''}`
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor, font: { size: 10 } },
                    grid: { display: false },
                    title: { display: true, text: 'RPE', color: textColor, font: { size: 10 } }
                },
                y: {
                    ticks: { color: textColor, font: { size: 10 }, precision: 0 },
                    grid: { color: gridColor },
                    beginAtZero: true,
                    title: { display: true, text: 'Sesiones', color: textColor, font: { size: 10 } }
                }
            }
        }
    });
};

RPETracker.prototype.deleteCurrentSession = function() {
    if (!this.currentSessionId) return;
    AppConfirm.show({
        title: '¿Eliminar esta sesión?',
        message: 'Esta acción no se puede deshacer.',
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        danger: true
    }).then(ok => {
        if (!ok) return;
        this.sessions = this.sessions.filter(s => s.id !== this.currentSessionId);
        this.saveSessions();
        this.renderSessions();
        this.closeModal('detailModal');
        this.showToast('🗑️ Sesión eliminada', 'info');
    });
};

RPETracker.prototype.countUniqueSessions = function(sessions) {
    const keys = new Set(sessions.map(s => {
        const dateKey = s.date.slice(0, 10);
        return `${dateKey}_${s.timeOfDay || 'unknown'}_${s.type || 'training'}`;
    }));
    return keys.size;
};

RPETracker.prototype.getUniqueSessions = function(sessions) {
    const seen = new Set();
    return sessions.filter(s => {
        const key = `${s.date.slice(0,10)}_${s.timeOfDay||'unknown'}_${s.type||'training'}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    });
};

RPETracker.prototype.getSessionTypeName = function(type) {
    const names = {training:'Entrenamiento', match:'Partido', shooting:'Tiro', gym:'Gym', recovery:'Recuperación'};
    return names[type] || 'Entrenamiento';
};

RPETracker.prototype.editSession = function(sessionId) {
    const session = this.sessions.find(s => s.id === sessionId);
    if (!session) return;
    
    // Populate edit form
    document.getElementById('editSessionId').value = session.id;
    document.getElementById('editSessionPlayer').value = session.playerId;
    
    const date = new Date(session.date);
    const dateStr = date.toISOString().slice(0, 10);
    document.getElementById('editSessionDate').value = dateStr;
    
    // Set time of day
    if (session.timeOfDay === 'morning') {
        document.getElementById('editTimeMorning').checked = true;
    } else {
        document.getElementById('editTimeAfternoon').checked = true;
    }
    
    // Set duration
    document.getElementById('editSessionDuration').value = session.duration || 60;
    
    // Set type
    if (session.type === 'training') {
        document.getElementById('editTypeTraining').checked = true;
    } else {
        document.getElementById('editTypeMatch').checked = true;
    }
    
    // Set RPE
    document.getElementById('editRpeSlider').value = session.rpe;
    this.updateEditRPEDisplay(session.rpe);
    
    // Set notes
    document.getElementById('editSessionNotes').value = session.notes || '';
    
    // Populate player select
    const playerSelect = document.getElementById('editSessionPlayer');
    playerSelect.innerHTML = this.players.map(p => 
        `<option value="${p.id}" ${p.id === session.playerId ? 'selected' : ''}>${esc(p.name)}${p.number ? ` #${p.number}` : ''}</option>`
    ).join('');
    
    // Open modal
    const _esModal = document.getElementById('editSessionModal');
    _esModal.classList.add('active');
    if (this._ftRelease4) { this._ftRelease4(); }
    this._ftRelease4 = trapFocus(_esModal);
    this.closeModal('detailModal');
};

RPETracker.prototype.handleEditSessionSubmit = function(e) {
    e.preventDefault();
    
    const sessionId = document.getElementById('editSessionId').value;
    const session = this.sessions.find(s => s.id === sessionId);
    
    if (!session) {
        AppAlert.show('❌ Sesión no encontrada');
        return;
    }
    
    const dateValue = document.getElementById('editSessionDate').value;
    const timeOfDay = document.querySelector('input[name="editSessionTime"]:checked').value;
    const timeString = timeOfDay === 'morning' ? 'T10:00:00' : 'T18:00:00';
    const fullDateTime = dateValue + timeString;
    
    const rpe = parseInt(document.getElementById('editRpeSlider').value);
    const duration = parseInt(document.getElementById('editSessionDuration').value);
    const load = rpe * duration;
    
    // Update session
    session.date = fullDateTime;
    session.timeOfDay = timeOfDay;
    session.type = document.querySelector('input[name="editSessionType"]:checked').value;
    session.rpe = rpe;
    session.duration = duration;
    session.load = load;
    session.notes = document.getElementById('editSessionNotes').value;
    
    this.saveSessions();
    this.renderSessions();
    this.closeModal('editSessionModal');
    this.showToast('✅ Sesión actualizada correctamente');
};

RPETracker.prototype.updateEditRPEDisplay = function(value) {
    const rpeValue = parseInt(value);
    const color = this.getRPEColor(rpeValue);
    const label = this.getRPELabel(rpeValue);
    
    document.getElementById('editRpeValue').textContent = rpeValue;
    document.getElementById('editRpeValue').style.color = color;
    document.getElementById('editRpeLabel').textContent = label;
    
    const slider = document.getElementById('editRpeSlider');
    slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${rpeValue * 10}%, #ddd ${rpeValue * 10}%, #ddd 100%)`;
    
    // Update scale
    const rpeBar = document.getElementById('editRpeBar');
    let html = '';
    for (let i = 1; i <= 10; i++) {
        const barColor = i <= rpeValue ? this.getRPEColor(i) : '#e0e0e0';
        html += `<div style="flex: 1; height: 30px; background: ${barColor}; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: ${i <= rpeValue ? 'white' : '#999'};">${i}</div>`;
    }
    rpeBar.innerHTML = html;
};

RPETracker.prototype.setupSearchAndFilters = function() {
    const searchInput = document.getElementById('searchSessions');
    const sortSelect = document.getElementById('sortSessions');
    const dateFromInput = document.getElementById('dateFrom');
    const dateToInput = document.getElementById('dateTo');
    const rpeMinInput = document.getElementById('rpeMin');
    const rpeMaxInput = document.getElementById('rpeMax');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => this.renderSessions());
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', () => this.renderSessions());
    }
    
    if (dateFromInput) dateFromInput.addEventListener('change', () => this.renderSessions());
    if (dateToInput) dateToInput.addEventListener('change', () => this.renderSessions());
    if (rpeMinInput) rpeMinInput.addEventListener('change', () => this.renderSessions());
    if (rpeMaxInput) rpeMaxInput.addEventListener('change', () => this.renderSessions());
};

RPETracker.prototype.getFilteredAndSortedSessions = function() {
    let filtered = [...this.sessions];
    
    // Player filter
    if (this.currentPlayerFilter !== 'all') {
        filtered = filtered.filter(s => s.playerId === this.currentPlayerFilter);
    }
    
    // Type filter
    if (this.currentTypeFilter !== 'all') {
        filtered = filtered.filter(s => s.type === this.currentTypeFilter);
    }
    
    // Search text
    const searchText = document.getElementById('searchSessions')?.value.toLowerCase();
    if (searchText) {
        filtered = filtered.filter(s => {
            const player = this.players.find(p => p.id === s.playerId);
            const playerName = player ? player.name.toLowerCase() : '';
            const notes = (s.notes || '').toLowerCase();
            return playerName.includes(searchText) || notes.includes(searchText);
        });
    }
    
    // Date range
    const dateFrom = document.getElementById('dateFrom')?.value;
    const dateTo = document.getElementById('dateTo')?.value;
    
    if (dateFrom) {
        const fromDate = new Date(dateFrom);
        filtered = filtered.filter(s => new Date(s.date) >= fromDate);
    }
    
    if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setHours(23, 59, 59);
        filtered = filtered.filter(s => new Date(s.date) <= toDate);
    }
    
    // RPE range
    const rpeMin = document.getElementById('rpeMin')?.value;
    const rpeMax = document.getElementById('rpeMax')?.value;
    
    if (rpeMin) {
        filtered = filtered.filter(s => s.rpe >= parseInt(rpeMin));
    }
    
    if (rpeMax) {
        filtered = filtered.filter(s => s.rpe <= parseInt(rpeMax));
    }
    
    // Sort
    const sortBy = document.getElementById('sortSessions')?.value || 'date-desc';
    
    switch(sortBy) {
        case 'date-asc':
            filtered.sort((a, b) => new Date(a.date) - new Date(b.date));
            break;
        case 'date-desc':
            filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
            break;
        case 'rpe-asc':
            filtered.sort((a, b) => a.rpe - b.rpe);
            break;
        case 'rpe-desc':
            filtered.sort((a, b) => b.rpe - a.rpe);
            break;
        case 'player':
            filtered.sort((a, b) => {
                const playerA = this.players.find(p => p.id === a.playerId);
                const playerB = this.players.find(p => p.id === b.playerId);
                const nameA = playerA ? playerA.name : '';
                const nameB = playerB ? playerB.name : '';
                return nameA.localeCompare(nameB);
            });
            break;
    }
    
    return filtered;
};


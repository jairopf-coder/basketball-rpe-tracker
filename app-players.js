// app-players.js — Módulo de gestión de jugadoras: alta, edición, borrado, listado (extraído de app.js V25)

RPETracker.prototype.openAddPlayerModal = function() {
    const _modal2 = document.getElementById('addPlayerModal');
    _modal2.classList.add('active');
    this._ftRelease2 = trapFocus(_modal2);
    document.getElementById('playerForm').reset();
    // Pre-select next available color
    const usedColors = this.players.map(p => p.color).filter(Boolean);
    const defaultColor = PlayerTokens.PALETTE.find(c => !usedColors.includes(c)) || PlayerTokens.PALETTE[0];
    this._renderColorPicker('playerColorPicker', 'playerColor', defaultColor);
};

RPETracker.prototype.handlePlayerSubmit = function(e) {
    e.preventDefault();

    // Validar nombre
    const rawName = document.getElementById('playerName').value;
    const trimmedName = rawName.trim().slice(0, 60);
    if (!trimmedName) {
        this.showToast('❌ El nombre no puede estar vacío', 'error');
        return;
    }

    // Validar dorsal (0–99 si se introduce)
    const rawNumber = document.getElementById('playerNumber').value;
    let playerNumber = null;
    if (rawNumber !== '' && rawNumber !== null && rawNumber !== undefined) {
        const num = parseInt(rawNumber, 10);
        if (isNaN(num) || num < 0 || num > 99) {
            this.showToast('❌ El dorsal debe estar entre 0 y 99', 'error');
            return;
        }
        playerNumber = String(num);
    }

    // Detectar nombre duplicado (case-insensitive)
    const duplicate = this.players.find(p => p.name.trim().toLowerCase() === trimmedName.toLowerCase());
    if (duplicate) {
        AppConfirm.show({
            title: 'Nombre duplicado',
            message: `Ya existe una jugadora llamada "${duplicate.name}". ¿Deseas añadir igualmente?`,
            confirmText: 'Añadir',
            cancelText: 'Cancelar'
        }).then(ok => {
            if (!ok) return;
            this._doAddPlayer(trimmedName, playerNumber);
        });
        return;
    }

    this._doAddPlayer(trimmedName, playerNumber);
};

RPETracker.prototype._doAddPlayer = function(name, number) {
    const chosenColor = document.getElementById('playerColor').value;
    const usedColors = this.players.map(p => p.color).filter(Boolean);
    const fallback = PlayerTokens.PALETTE.find(c => !usedColors.includes(c)) || PlayerTokens.PALETTE[this.players.length % PlayerTokens.PALETTE.length];

    const player = {
        id: Date.now().toString(),
        name: name,
        number: number,
        color: chosenColor || fallback,
        createdAt: new Date().toISOString()
    };

    this.players.push(player);
    this.savePlayers();
    this.renderPlayers();
    this.populatePlayerSelects();
    this.closeModal('addPlayerModal');
    this.showToast('✅ Jugadora añadida correctamente', 'success');
};

RPETracker.prototype._ensurePlayerColors = function() {
    let changed = false;
    this.players.forEach((player, idx) => {
        if (!player.color) {
            player.color = PlayerTokens.PALETTE[idx % PlayerTokens.PALETTE.length];
            changed = true;
        }
    });
    if (changed) this.savePlayers();
};

RPETracker.prototype._renderColorPicker = function(containerId, hiddenInputId, selectedColor) {
    const container = document.getElementById(containerId);
    const hidden    = document.getElementById(hiddenInputId);
    if (!container || !hidden) return;

    hidden.value = selectedColor || PlayerTokens.PALETTE[0];

    container.innerHTML = PlayerTokens.PALETTE.map(color => `
        <div class="token-color-swatch ${color === hidden.value ? 'selected' : ''}"
             style="background:${color}"
             data-color="${color}"
             title="${color}"
             onclick="(function(el){
                 el.closest('.token-color-picker').querySelectorAll('.token-color-swatch').forEach(s=>s.classList.remove('selected'));
                 el.classList.add('selected');
                 document.getElementById('${hiddenInputId}').value = '${color}';
             })(this)">
        </div>`).join('');
};

RPETracker.prototype.deletePlayer = function(playerId) {
    const player = this.players.find(p => p.id === playerId);
    const name = player ? player.name : 'esta jugadora';
    const sessionCount = this.sessions.filter(s => s.playerId === playerId).length;
    AppConfirm.show({
        title: `¿Eliminar ${name}?`,
        message: `Se eliminarán también ${sessionCount} sesión(es) registrada(s). Esta acción no se puede deshacer.`,
        confirmText: 'Eliminar',
        cancelText: 'Cancelar',
        danger: true
    }).then(ok => {
        if (!ok) return;
        this.players = this.players.filter(p => p.id !== playerId);
        this.sessions = this.sessions.filter(s => s.playerId !== playerId);
        this.savePlayers();
        this.saveSessions();
        this.renderPlayers();
        this.renderSessions();
        this.populatePlayerSelects();
        this.showToast('🗑️ Jugadora eliminada', 'info');
    });
};

RPETracker.prototype.renderPlayers = function() {
    const container = document.getElementById('playersList');
    if (!container) return;

    if (this.players.length === 0) {
        container.innerHTML = `
            <div class="empty-state active">
                <div class="empty-icon">👥</div>
                <h3>No hay jugadoras registradas</h3>
                <p>Añade jugadoras para empezar a registrar sesiones</p>
            </div>
        `;
        return;
    }

    // Batch 2: apply search filter
    const searchTerm = (document.getElementById('playerSearchInput')?.value || '').toLowerCase().trim();
    const playersToShow = searchTerm
        ? this.players.filter(p => p.name.toLowerCase().includes(searchTerm) || (p.number && String(p.number).includes(searchTerm)))
        : this.players;

    if (playersToShow.length === 0 && searchTerm) {
        container.innerHTML = `<div class="empty-state active"><div class="empty-icon">🔍</div><h3>Sin resultados</h3><p>No hay jugadoras que coincidan con "${searchTerm}"</p></div>`;
        return;
    }

    container.innerHTML = playersToShow.map((player, idx) => {
        const playerSessions = this.sessions.filter(s => s.playerId === player.id);
        const avgRPE = playerSessions.length > 0
            ? (playerSessions.reduce((sum, s) => sum + s.rpe, 0) / playerSessions.length).toFixed(1)
            : 0;

        const totalLoad = playerSessions.reduce((sum, s) => {
            return sum + (s.load || (s.rpe * (s.duration || 60)));
        }, 0);

        const ratio = this.calculateAcuteChronicRatio(player.id);
        const color = PlayerTokens.get(player);

        // Batch 2: load trend (this week vs last week)
        const now = new Date();
        const weekAgo = new Date(now); weekAgo.setDate(weekAgo.getDate() - 7);
        const twoWeeksAgo = new Date(now); twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);
        const thisWeekLoad = playerSessions.filter(s => new Date(s.date) >= weekAgo).reduce((sum, s) => sum + (s.load || s.rpe * (s.duration || 60)), 0);
        const lastWeekLoad = playerSessions.filter(s => new Date(s.date) >= twoWeeksAgo && new Date(s.date) < weekAgo).reduce((sum, s) => sum + (s.load || s.rpe * (s.duration || 60)), 0);
        let trendHTML = '';
        if (lastWeekLoad > 0 && thisWeekLoad > 0) {
            const pct = Math.round(((thisWeekLoad - lastWeekLoad) / lastWeekLoad) * 100);
            const up = pct >= 0;
            trendHTML = `<span class="player-trend ${up ? 'trend-up' : 'trend-down'}">${up ? '↑' : '↓'} ${Math.abs(pct)}%</span>`;
        } else if (thisWeekLoad > 0) {
            trendHTML = `<span class="player-trend trend-new">● nueva</span>`;
        }

        // Batch 2: 7-day sparkline data (daily load)
        const sparkData = [];
        for (let d = 6; d >= 0; d--) {
            const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - d); dayStart.setHours(0,0,0,0);
            const dayEnd   = new Date(dayStart); dayEnd.setHours(23,59,59,999);
            const dayLoad  = playerSessions.filter(s => { const sd = new Date(s.date); return sd >= dayStart && sd <= dayEnd; }).reduce((sum, s) => sum + (s.load || s.rpe * (s.duration || 60)), 0);
            sparkData.push(dayLoad);
        }
        const sparkMax = Math.max(...sparkData, 1);
        const sparkId = `spark-${player.id}`;

        // Batch 3: last session date
        const lastSession = playerSessions.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        let lastSessionLabel = '';
        if (lastSession) {
            const diffDays = Math.floor((new Date() - new Date(lastSession.date)) / 86400000);
            lastSessionLabel = diffDays === 0 ? ' · Hoy' : diffDays === 1 ? ' · Ayer' : ` · hace ${diffDays}d`;
        } else {
            lastSessionLabel = ' · Sin sesiones';
        }

        return `
            <div class="player-card" style="border-left: 4px solid ${color}" data-player-id="${player.id}" draggable="true">
                <div class="player-card-drag-handle" title="Arrastrar para reordenar">⠿</div>
                <div class="player-info">
                    ${PlayerTokens.avatar(player, 56, '1.4rem')}
                    <div class="player-details">
                        <h3>${player.name}${player.number ? ` <span style="opacity:0.5;font-size:0.85em">#${player.number}</span>` : ''}${trendHTML}</h3>
                        <p class="player-meta">${playerSessions.length} registros · ${rpeTracker ? rpeTracker.countUniqueSessions(playerSessions) : playerSessions.length} sesiones<span class="player-meta-last">${lastSessionLabel}</span></p>
                    </div>
                </div>
                <div class="player-stats">
                    <div class="player-stat-item">
                        <span class="player-stat-value">${avgRPE}</span>
                        <span class="player-stat-label">RPE Medio</span>
                    </div>
                    <div class="player-stat-item">
                        <span class="player-stat-value">${totalLoad}</span>
                        <span class="player-stat-label">Carga Total</span>
                    </div>
                    <div class="player-stat-item">
                        <span class="player-stat-value" style="color: ${this.getRatioColor(ratio.ratio)}">${ratio.ratio}</span>
                        <span class="player-stat-label">Ratio A:C</span>
                    </div>
                </div>
                <!-- Batch 2: sparkline -->
                <div class="player-sparkline-row">
                    <span class="player-sparkline-label">Carga 7d</span>
                    <canvas id="${sparkId}" class="player-sparkline" width="120" height="28"></canvas>
                </div>
                <div class="player-actions">
                    <button class="btn-icon" style="background: #2196f3; color: white;" onclick="window.rpeTracker?.showPlayerReportMenu('${player.id}')" title="Informe PDF">📄</button>
                    <button class="btn-icon" style="background: #7b1fa2; color: white;" onclick="window.rpeTracker?.generatePlayerReport('${player.id}')" title="Informe individual">📋</button>
                    <button class="btn-icon" style="background: #00897b; color: white;" onclick="window.AnamnesisModule?.open('${player.id}')" title="Anamnesis">🩺</button>
                    <button class="btn-icon" style="background: var(--primary); color: white;" onclick="window.rpeTracker?.editPlayer('${player.id}')" title="Editar">✏️</button>
                    <button class="btn-icon" style="background: #f44336; color: white;" onclick="window.rpeTracker?.deletePlayer('${player.id}')" title="Eliminar">🗑️</button>
                </div>
            </div>
        `;
    }).join('');

    // Batch 2: draw sparklines after DOM is updated
    requestAnimationFrame(() => {
        playersToShow.forEach(player => {
            const canvas = document.getElementById(`spark-${player.id}`);
            if (!canvas) return;
            const playerSessions = this.sessions.filter(s => s.playerId === player.id);
            const now = new Date();
            const sparkData = [];
            for (let d = 6; d >= 0; d--) {
                const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - d); dayStart.setHours(0,0,0,0);
                const dayEnd   = new Date(dayStart); dayEnd.setHours(23,59,59,999);
                const dayLoad  = playerSessions.filter(s => { const sd = new Date(s.date); return sd >= dayStart && sd <= dayEnd; }).reduce((sum, s) => sum + (s.load || s.rpe * (s.duration || 60)), 0);
                sparkData.push(dayLoad);
            }
            this._drawSparkline(canvas, sparkData, PlayerTokens.get(player));
        });
    });

    // Batch 2: init drag-and-drop on roster
    if (!searchTerm) this._initRosterDragAndDrop(container);
};

RPETracker.prototype.populatePlayerSelects = function() {
    const filterSelect = document.getElementById('playerFilter');
    
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="all">Todas las jugadoras</option>' +
            this.players.map(p => `<option value="${p.id}">${esc(p.name)}${p.number ? ` #${p.number}` : ''}</option>`).join('');
    }
};

RPETracker.prototype.filterPlayersList = function(value) {
    const clearBtn = document.getElementById('playerSearchClear');
    if (clearBtn) clearBtn.style.display = value ? 'flex' : 'none';
    this.renderPlayers();
};

RPETracker.prototype.clearPlayerSearch = function() {
    const input = document.getElementById('playerSearchInput');
    if (input) { input.value = ''; input.focus(); }
    const clearBtn = document.getElementById('playerSearchClear');
    if (clearBtn) clearBtn.style.display = 'none';
    this.renderPlayers();
};

RPETracker.prototype.editPlayer = function(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    document.getElementById('editPlayerId').value = player.id;
    document.getElementById('editPlayerName').value = player.name;
    document.getElementById('editPlayerNumber').value = player.number || '';

    // Individual A:C thresholds (empty = use global defaults)
    document.getElementById('editAcThresholdLow').value  = player.acThresholdLow  != null ? player.acThresholdLow  : '';
    document.getElementById('editAcThresholdOpt').value  = player.acThresholdOpt  != null ? player.acThresholdOpt  : '';
    document.getElementById('editAcThresholdHigh').value = player.acThresholdHigh != null ? player.acThresholdHigh : '';

    // Render color picker with current color preselected
    const currentColor = PlayerTokens.get(player);
    this._renderColorPicker('editPlayerColorPicker', 'editPlayerColor', currentColor);

    const _epModal = document.getElementById('editPlayerModal');
    _epModal.classList.add('active');
    if (this._ftRelease5) { this._ftRelease5(); }
    this._ftRelease5 = trapFocus(_epModal);
};

RPETracker.prototype.handleEditPlayerSubmit = function(e) {
    e.preventDefault();

    const playerId = document.getElementById('editPlayerId').value;
    const player = this.players.find(p => p.id === playerId);

    if (!player) {
        AppAlert.show('❌ Jugadora no encontrada');
        return;
    }

    player.name = document.getElementById('editPlayerName').value;
    player.number = document.getElementById('editPlayerNumber').value || null;
    const chosenColor = document.getElementById('editPlayerColor').value;
    if (chosenColor) player.color = chosenColor;

    // Individual A:C thresholds — null if empty (means "use global")
    const _low  = document.getElementById('editAcThresholdLow').value.trim();
    const _opt  = document.getElementById('editAcThresholdOpt').value.trim();
    const _high = document.getElementById('editAcThresholdHigh').value.trim();
    player.acThresholdLow  = _low  !== '' ? parseFloat(_low)  : null;
    player.acThresholdOpt  = _opt  !== '' ? parseFloat(_opt)  : null;
    player.acThresholdHigh = _high !== '' ? parseFloat(_high) : null;

    this.savePlayers();
    this.renderPlayers();
    this.renderSessions();
    this.populatePlayerSelects();
    this.closeModal('editPlayerModal');
    this.showToast('✅ Jugadora actualizada correctamente');
};


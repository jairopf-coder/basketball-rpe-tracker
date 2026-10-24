// app-players.js — Módulo de gestión de jugadoras: alta, edición, borrado, listado (extraído de app.js V25)

// ─── Nombre y apellido ─────────────────────────────────────────────────────────
// `name` es el nombre (lo único que se ve en la app) y `lastName` el apellido o apellidos,
// en un campo libre. Para identificar a la jugadora en datos externos (CSV de Oli, export al
// fisio) se usa el nombre completo: nombre + apellido, escrito como lo escribe Oli.

RPETracker.prototype.playerFullName = function(player) {
    if (!player) return '';
    return [player.name, player.lastName]
        .map(s => String(s || '').trim())
        .filter(Boolean)
        .join(' ')
        .replace(/\s+/g, ' ');
};

// Propuesta para separar un texto completo: primera palabra = nombre, el resto = apellido.
// Es solo una propuesta (no sirve con nombres compuestos como "María José"): el staff la revisa.
RPETracker.prototype._splitFullName = function(fullName) {
    const clean = String(fullName || '').trim().replace(/\s+/g, ' ');
    const i = clean.indexOf(' ');
    return i === -1 ? { name: clean, lastName: '' } : { name: clean.slice(0, i), lastName: clean.slice(i + 1) };
};

RPETracker.prototype._playersMissingLastName = function() {
    return this.players.filter(p => !String(p.lastName || '').trim());
};

// Busca otra jugadora con el mismo nombre completo (sin distinguir mayúsculas ni acentos).
// _normalizePlayerName vive en gps-tracking.js.
RPETracker.prototype._findPlayerByFullName = function(fullName, exceptId) {
    const key = this._normalizePlayerName(fullName);
    if (!key) return null;
    return this.players.find(p => p.id !== exceptId
        && this._normalizePlayerName(this.playerFullName(p)) === key) || null;
};

// Nombre para mostrar en la app: el nombre de la ficha. Si otra jugadora tiene el mismo nombre, se le
// añade el principio de su apellido ("Sara L."), con las letras justas para distinguirlas ("Sara Lóp.").
// Las fichas sin apellido se muestran tal cual, como hasta ahora.
RPETracker.prototype.playerDisplayName = function(player) {
    if (!player) return '';
    const name = String(player.name || '').trim().replace(/\s+/g, ' ');
    const firstSurname = String(player.lastName || '').trim().split(/\s+/)[0];
    if (!firstSurname) return name;

    const key = this._normalizePlayerName(name);
    const sameName = (this.players || []).filter(p => p.id !== player.id && this._normalizePlayerName(p.name) === key);
    if (!sameName.length) return name;

    const others = sameName.map(p => this._normalizePlayerName(String(p.lastName || '').trim().split(/\s+/)[0]));
    const mine = this._normalizePlayerName(firstSurname);
    let n = 1;
    while (n < firstSurname.length && others.some(o => o.slice(0, n) === mine.slice(0, n))) n++;
    return n >= firstSurname.length ? `${name} ${firstSurname}` : `${name} ${firstSurname.slice(0, n)}.`;
};

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

    const trimmedLastName = (document.getElementById('playerLastName')?.value || '').trim().slice(0, 60);

    // Detectar jugadora duplicada: mismo nombre y apellido (sin distinguir mayúsculas ni acentos)
    const duplicate = this._findPlayerByFullName(this.playerFullName({ name: trimmedName, lastName: trimmedLastName }));
    if (duplicate) {
        AppConfirm.show({
            title: 'Nombre duplicado',
            message: `Ya existe una jugadora llamada "${this.playerFullName(duplicate)}". ¿Deseas añadir igualmente?`,
            confirmText: 'Añadir',
            cancelText: 'Cancelar'
        }).then(ok => {
            if (!ok) return;
            this._doAddPlayer(trimmedName, playerNumber, trimmedLastName);
        });
        return;
    }

    this._doAddPlayer(trimmedName, playerNumber, trimmedLastName);
};

RPETracker.prototype._doAddPlayer = function(name, number, lastName) {
    const chosenColor = document.getElementById('playerColor').value;
    const usedColors = this.players.map(p => p.color).filter(Boolean);
    const fallback = PlayerTokens.PALETTE.find(c => !usedColors.includes(c)) || PlayerTokens.PALETTE[this.players.length % PlayerTokens.PALETTE.length];

    const player = {
        id: Date.now().toString(),
        name: name,
        lastName: lastName || '',
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

// La eliminación completa (jugadora + TODOS sus datos, solo staff) vive en player-data.js.
RPETracker.prototype.deletePlayer = function(playerId) {
    if (typeof this._pdDeleteFlow === 'function') return this._pdDeleteFlow(playerId);
    return this._deletePlayerBasic(playerId);
};

// Modo local (sin Firebase): solo la ficha y sus sesiones, como siempre.
RPETracker.prototype._deletePlayerBasic = function(playerId) {
    const player = this.players.find(p => p.id === playerId);
    const name = player ? this.playerFullName(player) : 'esta jugadora';
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

    this._renderPlayersNamesBanner();

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

    // Batch 2 (legacy, ahora sin input visible pero se mantiene por compatibilidad
    // si el buscador de texto se restaura en el futuro): filtro por texto
    const searchTerm = (document.getElementById('playerSearchInput')?.value || '').toLowerCase().trim();

    // Filtro por chips de jugadora (sustituye al buscador de texto en la UI)
    this._renderPlayerFilterChips();
    const chipFilterActive = this._playerFilterSelected && this._playerFilterSelected.size > 0;

    let playersToShow = this.players;
    if (chipFilterActive) {
        playersToShow = this.players.filter(p => this._playerFilterSelected.has(p.id));
    } else if (searchTerm) {
        playersToShow = this.players.filter(p => this._normalizePlayerName(this.playerFullName(p)).includes(this._normalizePlayerName(searchTerm)) || (p.number && String(p.number).includes(searchTerm)));
    }

    if (playersToShow.length === 0 && searchTerm) {
        container.innerHTML = `<div class="empty-state active"><div class="empty-icon">🔍</div><h3>Sin resultados</h3><p>No hay jugadoras que coincidan con "${searchTerm}"</p></div>`;
        return;
    }
    if (playersToShow.length === 0 && chipFilterActive) {
        container.innerHTML = `<div class="empty-state active"><div class="empty-icon">🔍</div><h3>Sin resultados</h3><p>No hay jugadoras seleccionadas</p></div>`;
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
                        <h3>${esc(this.playerDisplayName(player))}${player.number ? ` <span style="opacity:0.5;font-size:0.85em">#${esc(player.number)}</span>` : ''}${trendHTML}</h3>
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

    // Batch 2: init drag-and-drop on roster (desactivado si hay un filtro activo,
    // por texto o por chips, igual que antes)
    if (!searchTerm && !chipFilterActive) this._initRosterDragAndDrop(container);
};

// ── Filtro de jugadoras por chips (sustituye al buscador de texto) ───────────
// Estado: this._playerFilterSelected es un Set<playerId>. Vacío = "Todas".
RPETracker.prototype._renderPlayerFilterChips = function() {
    const wrap = document.getElementById('playerFilterChips');
    if (!wrap) return; // si el contenedor no existe en el HTML, no hacemos nada (seguro)

    if (!this._playerFilterSelected) this._playerFilterSelected = new Set();

    const allSelected = this._playerFilterSelected.size === 0;

    wrap.innerHTML = `
        <button type="button" class="player-filter-all-btn ${allSelected ? 'player-filter-all-btn--active' : ''}"
            onclick="window.rpeTracker?._playerFilterSelectAll()"
            title="Mostrar todas las jugadoras">
            ${allSelected ? '✓ Todas' : 'Todas'}
        </button>
        ${this.players.map(player => {
            const isSel = this._playerFilterSelected.has(player.id);
            const color = PlayerTokens.get(player);
            return `
            <button type="button" class="player-filter-chip ${isSel ? 'player-filter-chip--selected' : ''}"
                style="--chip-color:${color}"
                title="${esc(this.playerFullName(player))}${player.number ? ' #' + esc(player.number) : ''}"
                onclick="window.rpeTracker?._playerFilterToggle('${player.id}')">
                ${esc(this._shortPlayerName(player))}
                ${isSel ? '<span class="player-filter-chip-check">✓</span>' : ''}
            </button>`;
        }).join('')}
    `;
};

RPETracker.prototype._playerFilterToggle = function(playerId) {
    if (!this._playerFilterSelected) this._playerFilterSelected = new Set();
    if (this._playerFilterSelected.has(playerId)) {
        this._playerFilterSelected.delete(playerId);
    } else {
        this._playerFilterSelected.add(playerId);
    }
    this.renderPlayers();
};

RPETracker.prototype._playerFilterSelectAll = function() {
    if (!this._playerFilterSelected) this._playerFilterSelected = new Set();
    this._playerFilterSelected.clear();
    this.renderPlayers();
};

RPETracker.prototype.populatePlayerSelects = function() {
    const filterSelect = document.getElementById('playerFilter');
    
    if (filterSelect) {
        filterSelect.innerHTML = '<option value="all">Todas las jugadoras</option>' +
            this.players.map(p => `<option value="${p.id}">${esc(this.playerDisplayName(p))}${p.number ? ` #${esc(p.number)}` : ''}</option>`).join('');
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
    const lastNameInput = document.getElementById('editPlayerLastName');
    if (lastNameInput) lastNameInput.value = player.lastName || '';
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

    // El nombre completo (nombre + apellido) identifica a la jugadora al importar y exportar datos,
    // así que no puede coincidir con el de otra jugadora.
    const sameName = this._findPlayerByFullName(this.playerFullName({
        name: document.getElementById('editPlayerName').value,
        lastName: document.getElementById('editPlayerLastName')?.value
    }), playerId);
    if (sameName) {
        this.showToast(`❌ Ya existe otra jugadora llamada "${this.playerFullName(sameName)}"`, 'error');
        return;
    }

    this._applyEditPlayer(player);
};

RPETracker.prototype._applyEditPlayer = function(player) {
    player.name = document.getElementById('editPlayerName').value;
    const lastNameField = document.getElementById('editPlayerLastName');
    if (lastNameField) player.lastName = lastNameField.value.trim().slice(0, 60);
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

// ─── Importar jugadoras en lote ────────────────────────────────────────────────
// Permite pegar una lista (una jugadora por línea, dorsal opcional separado por
// coma) y crearlas todas de una vez, en vez de una a una desde el formulario.

RPETracker.prototype.showBulkImportPlayersModal = function() {
    document.getElementById('bulkImportOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'bulkImportOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:3000;display:flex;align-items:center;justify-content:center;padding:1rem';

    overlay.innerHTML = `
        <div class="clear-confirm-modal" style="text-align:left;max-width:480px">
            <h2 class="clear-confirm-title" style="text-align:center">📋 Importar lista de jugadoras</h2>
            <p class="clear-confirm-desc" style="text-align:center">
                Pega una jugadora por línea, con nombre y apellidos. El dorsal es opcional, sepáralo con una coma.
                La primera palabra será el nombre y el resto el apellido; si algún nombre es compuesto
                (por ejemplo María José), corrígelo después en su ficha.
            </p>
            <div class="form-group">
                <textarea id="bulkImportTextarea" class="form-input" rows="8"
                    style="font-family:monospace;resize:vertical"
                    placeholder="Laura Gómez, 7
Ana Pérez, 10
Marta Ruiz"></textarea>
            </div>
            <div id="bulkImportError" class="login-error" style="display:none"></div>
            <div class="clear-confirm-actions">
                <button class="btn-secondary" onclick="document.getElementById('bulkImportOverlay').remove()">Cancelar</button>
                <button class="btn-primary" id="bulkImportConfirmBtn" onclick="window.rpeTracker?._confirmBulkImportPlayers()">
                    Importar
                </button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('bulkImportTextarea')?.focus(), 100);
};

RPETracker.prototype._confirmBulkImportPlayers = function() {
    const textarea = document.getElementById('bulkImportTextarea');
    const errorEl   = document.getElementById('bulkImportError');
    const lines = (textarea?.value || '').split('\n').map(l => l.trim()).filter(Boolean);

    if (!lines.length) {
        if (errorEl) { errorEl.textContent = 'Pega al menos una jugadora.'; errorEl.style.display = 'block'; }
        return;
    }

    const usedColors = this.players.map(p => p.color).filter(Boolean);
    let colorPtr = 0;
    const nextColor = () => {
        for (let i = 0; i < PlayerTokens.PALETTE.length; i++) {
            const c = PlayerTokens.PALETTE[(colorPtr + i) % PlayerTokens.PALETTE.length];
            if (!usedColors.includes(c)) { usedColors.push(c); colorPtr += i + 1; return c; }
        }
        const c = PlayerTokens.PALETTE[colorPtr % PlayerTokens.PALETTE.length];
        colorPtr++;
        return c;
    };

    const added = [];
    const skipped = [];

    lines.forEach(line => {
        const parts = line.split(',').map(p => p.trim());
        const split = this._splitFullName(parts[0]);
        const name = split.name.slice(0, 60);
        const lastName = split.lastName.slice(0, 60);
        if (!name) return;

        let number = null;
        if (parts[1]) {
            const num = parseInt(parts[1], 10);
            if (!isNaN(num) && num >= 0 && num <= 99) number = String(num);
        }

        const fullName = this.playerFullName({ name, lastName });
        if (this._findPlayerByFullName(fullName)) { skipped.push(fullName); return; }

        const player = {
            id: Date.now().toString() + '_' + Math.random().toString(36).slice(2, 7),
            name: name,
            lastName: lastName,
            number: number,
            color: nextColor(),
            createdAt: new Date().toISOString()
        };
        this.players.push(player);
        added.push(name);
    });

    if (added.length) {
        this.savePlayers();
        this.renderPlayers();
        this.populatePlayerSelects();
    }

    document.getElementById('bulkImportOverlay')?.remove();

    if (skipped.length) {
        this.showToast(`✅ ${added.length} jugadora(s) añadida(s). ⚠️ ${skipped.length} omitida(s) por nombre duplicado: ${skipped.join(', ')}`, 'warning');
    } else {
        this.showToast(`✅ ${added.length} jugadora(s) añadida(s) correctamente`, 'success');
    }
};

// ─── Revisar nombres: separar nombre y apellido de las jugadoras que aún no tienen apellido ───

RPETracker.prototype._renderPlayersNamesBanner = function() {
    const el = document.getElementById('playersNamesBanner');
    if (!el) return;
    const n = this._playersMissingLastName().length;
    el.innerHTML = n === 0 ? '' : `
        <div role="status" style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem;
            padding:.6rem .8rem;margin-bottom:.75rem;border:1px solid var(--border);border-radius:8px;background:var(--bg-subtle)">
            <span>⚠️ ${n} jugadora${n === 1 ? '' : 's'} sin apellido</span>
            <button type="button" class="btn-secondary" onclick="window.rpeTracker?.showReviewPlayerNamesModal()">Revisar nombres</button>
        </div>`;
};

// Aplica la revisión. updates = [{ id, name, lastName }]. Si hay un error no cambia nada:
// nombre vacío, o dos jugadoras que quedarían con el mismo nombre completo.
RPETracker.prototype._applyPlayerNameReview = function(updates) {
    const byId = new Map(updates.map(u => [u.id, u]));
    const result = this.players.map(p => byId.has(p.id)
        ? { name: byId.get(p.id).name, lastName: byId.get(p.id).lastName }
        : p);

    if (result.some(p => !String(p.name || '').trim())) {
        return { ok: false, error: 'Todas las jugadoras necesitan un nombre.' };
    }
    const seen = new Set();
    for (const p of result) {
        const key = this._normalizePlayerName(this.playerFullName(p));
        if (seen.has(key)) {
            return { ok: false, error: `Hay dos jugadoras con el mismo nombre y apellido: ${this.playerFullName(p)}.` };
        }
        seen.add(key);
    }

    let changed = 0;
    this.players.forEach(p => {
        const u = byId.get(p.id);
        if (!u) return;
        if (p.name !== u.name || (p.lastName || '') !== u.lastName) {
            p.name = u.name;
            p.lastName = u.lastName;
            changed++;
        }
    });
    return { ok: true, changed };
};

RPETracker.prototype.showReviewPlayerNamesModal = function() {
    const pending = this._playersMissingLastName();
    if (!pending.length) {
        this.showToast('✅ Todas las jugadoras ya tienen apellido', 'success');
        return;
    }

    document.getElementById('reviewNamesOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'reviewNamesOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:3000;display:flex;align-items:center;justify-content:center;padding:1rem';

    const cols = 'display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.4fr);gap:.5rem';
    const inputStyle = 'width:100%;box-sizing:border-box;padding:.5rem .6rem;border:2px solid var(--border-input);border-radius:8px;font:inherit;background:var(--bg-input);color:var(--text-primary)';
    const rows = pending.map(p => {
        const s = this._splitFullName(p.name);
        return `
            <div class="review-names-row" data-player-id="${esc(p.id)}" style="padding:.4rem 0">
                <div style="${cols}">
                    <input type="text" style="${inputStyle}" data-field="name" value="${esc(s.name)}" maxlength="60" aria-label="Nombre de ${esc(p.name)}">
                    <input type="text" style="${inputStyle}" data-field="lastName" value="${esc(s.lastName)}" maxlength="60" placeholder="Apellido(s)" aria-label="Apellido de ${esc(p.name)}">
                </div>
            </div>`;
    }).join('');

    overlay.innerHTML = `
        <div class="clear-confirm-modal" style="text-align:left;max-width:520px;width:100%;max-height:90vh;display:flex;flex-direction:column">
            <h2 class="clear-confirm-title" style="text-align:center">✏️ Revisar nombres</h2>
            <p class="clear-confirm-desc" style="text-align:center">
                Separa el nombre del apellido de cada jugadora. En la app solo se verá el nombre; el apellido sirve para identificarla al importar el GPS y exportar al fisio.
                Escríbelos igual que en el CSV de Oli.
            </p>
            <div style="${cols};font-size:.8rem;opacity:.7;padding-bottom:.25rem"><span>Nombre</span><span>Apellido(s)</span></div>
            <div style="overflow-y:auto;min-height:0;flex:1">${rows}</div>
            <div id="reviewNamesError" class="login-error" style="display:none"></div>
            <div class="clear-confirm-actions">
                <button class="btn-secondary" onclick="document.getElementById('reviewNamesOverlay').remove()">Cancelar</button>
                <button class="btn-primary" onclick="window.rpeTracker?._confirmReviewPlayerNames()">Guardar</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
};

RPETracker.prototype._confirmReviewPlayerNames = function() {
    const rows = document.querySelectorAll('#reviewNamesOverlay .review-names-row');
    const updates = Array.from(rows).map(row => ({
        id: row.getAttribute('data-player-id'),
        name: row.querySelector('[data-field="name"]').value.trim().slice(0, 60),
        lastName: row.querySelector('[data-field="lastName"]').value.trim().slice(0, 60)
    }));

    const result = this._applyPlayerNameReview(updates);
    if (!result.ok) {
        const errorEl = document.getElementById('reviewNamesError');
        if (errorEl) { errorEl.textContent = result.error; errorEl.style.display = 'block'; }
        return;
    }

    document.getElementById('reviewNamesOverlay')?.remove();
    if (result.changed) {
        this.savePlayers();
        this.renderPlayers();
        this.renderSessions();
        this.populatePlayerSelects();
        this.showToast(`✅ ${result.changed} jugadora(s) actualizada(s)`, 'success');
    } else {
        this.showToast('No había cambios que guardar', 'info');
    }
};

// Basketball RPE Tracker - Progressive Web App with Advanced Analytics

class RPETracker {
    constructor() {
        this.sessions = this.loadSessions();
        this.players = this.loadPlayers();
        this.currentSessionId = null;
        this.currentView = 'sessions';
        this.currentPlayerFilter = 'all';
        this.currentTypeFilter = 'all';
        this.calendarYear = new Date().getFullYear();
        this.calendarMonth = new Date().getMonth();
        this.injuries = [];
        this.availability = {};
        this.weekPlan = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderPlayers();
        this.renderSessions();
        this.setDefaultDateTime();
        if (document.getElementById('rpeValue')) this.updateRPEDisplay(5);
        this.populatePlayerSelects();

        // Inicializar módulo de lesiones
        if (typeof this.initializeInjuryManagement === 'function') {
            this.initializeInjuryManagement();
        }

        // Inicializar planificación semanal
        if (typeof this.loadWeekPlan === 'function') {
            this.loadWeekPlan();
        }

        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js');
        }

        // Show skeleton while Firebase loads
        this.showSkeletonLoader();
    }

    setupEventListeners() {
        // Navigation tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', (e) => this.switchView(e.target.dataset.view));
        });

        // Header buttons
        document.getElementById('addBtn').addEventListener('click', () => this.openNewSessionModal());
        document.getElementById('dashboardBtn')?.addEventListener('click', () => this.switchView('dashboard'));
        document.getElementById('playersBtn')?.addEventListener('click', () => this.switchView('players'));
        document.getElementById('exportBtn')?.addEventListener('click', () => this.exportData());
        document.getElementById('backupBtn')?.addEventListener('click', () => this.showBackupMenu());
        document.getElementById('restoreFile')?.addEventListener('change', (e) => this.restoreBackup(e));
        
        // Session modal controls
        document.getElementById('closeModal')?.addEventListener('click', () => this.closeModal('newSessionModal'));
        document.getElementById('cancelBtn')?.addEventListener('click', () => this.closeModal('newSessionModal'));
        document.getElementById('closeDetailModal').addEventListener('click', () => this.closeModal('detailModal'));
        document.getElementById('closeDetailBtn').addEventListener('click', () => this.closeModal('detailModal'));
        
        // Player modal controls
        document.getElementById('addPlayerBtn').addEventListener('click', () => this.openAddPlayerModal());
        document.getElementById('closePlayerModal').addEventListener('click', () => this.closeModal('addPlayerModal'));
        document.getElementById('cancelPlayerBtn').addEventListener('click', () => this.closeModal('addPlayerModal'));
        
        // Forms
        document.getElementById('sessionForm')?.addEventListener('submit', (e) => this.handleSessionSubmit(e));
        document.getElementById('playerForm').addEventListener('submit', (e) => this.handlePlayerSubmit(e));
        
        // RPE slider
        document.getElementById('rpeSlider')?.addEventListener('input', (e) => this.updateRPEDisplay(e.target.value));
        
        // Duration buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('duration-btn')) {
                this.selectDuration(e.target.dataset.duration);
            }
        });

        // Player selection buttons (event delegation)
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.player-btn');
            if (btn && btn.dataset.playerId) {
                this.togglePlayerSelection(btn.dataset.playerId);
            }
        });
        
        // Custom duration input
        const customDurationInput = document.getElementById('customDuration');
        if (customDurationInput) {
            customDurationInput.addEventListener('input', (e) => {
                if (e.target.value) {
                    this.selectDuration(e.target.value);
                }
            });
        }
        
        // Delete session
        document.getElementById('deleteSessionBtn').addEventListener('click', () => this.deleteCurrentSession());
        
        // Filters
        document.getElementById('playerFilter').addEventListener('change', (e) => {
            this.currentPlayerFilter = e.target.value;
            this.renderSessions();
        });
        
        document.getElementById('typeFilter').addEventListener('change', (e) => {
            this.currentTypeFilter = e.target.value;
            this.renderSessions();
        });
        
        // Close modal on background click
        document.querySelectorAll('.modal').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                }
            });
        });
        
        // Edit session modal
        document.getElementById('editSessionBtn')?.addEventListener('click', () => {
            if (this.currentSessionId) {
                this.editSession(this.currentSessionId);
            }
        });
        document.getElementById('closeEditSessionModal')?.addEventListener('click', () => this.closeModal('editSessionModal'));
        document.getElementById('cancelEditSessionBtn')?.addEventListener('click', () => this.closeModal('editSessionModal'));
        document.getElementById('editSessionForm')?.addEventListener('submit', (e) => this.handleEditSessionSubmit(e));
        document.getElementById('editRpeSlider')?.addEventListener('input', (e) => this.updateEditRPEDisplay(e.target.value));
        
        // Edit player modal
        document.getElementById('closeEditPlayerModal')?.addEventListener('click', () => this.closeModal('editPlayerModal'));
        document.getElementById('cancelEditPlayerBtn')?.addEventListener('click', () => this.closeModal('editPlayerModal'));
        document.getElementById('editPlayerForm')?.addEventListener('submit', (e) => this.handleEditPlayerSubmit(e));
        
        // Search and filters
        document.getElementById('clearFilters')?.addEventListener('click', () => {
            document.getElementById('searchSessions').value = '';
            document.getElementById('dateFrom').value = '';
            document.getElementById('dateTo').value = '';
            document.getElementById('rpeMin').value = '';
            document.getElementById('rpeMax').value = '';
            this.currentPlayerFilter = 'all';
            this.currentTypeFilter = 'all';
            document.getElementById('playerFilter').value = 'all';
            document.getElementById('typeFilter').value = 'all';
            this.renderSessions();
        });
        
        this.setupSearchAndFilters();
    }

    switchView(viewName) {
        this.currentView = viewName;
        
        // Update tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.toggle('active', tab.dataset.view === viewName);
        });
        
        // Update views
        document.querySelectorAll('.view').forEach(view => {
            view.classList.remove('active');
        });
        
        const targetView = document.getElementById(`${viewName}View`);
        if (targetView) {
            targetView.classList.add('active');
            targetView.classList.remove('fade-in');
            void targetView.offsetWidth; // force reflow
            targetView.classList.add('fade-in');
        }
        
        // Render content based on view
        switch(viewName) {
            case 'dashboard':
                this.renderDashboard();
                this.checkAndShowAlerts();
                break;
            case 'players':
                this.renderPlayers();
                break;
            case 'analytics':
                this.renderAnalytics();
                this.renderEvolutionCharts();
                this.checkAndShowAlerts();
                break;
            case 'calendar':
                if (typeof this.renderCalendar === 'function') {
                    this.renderCalendar(this.calendarYear, this.calendarMonth);
                }
                break;
            case 'injury':
                if (typeof this.renderInjuryManagement === 'function') {
                    this.updateMissedSessions();
                    this.renderInjuryManagement();
                }
                break;
            case 'prediction':
                if (typeof this.renderInjuryPredictionDashboard === 'function') {
                    this.renderInjuryPredictionDashboard();
                }
                break;
            case 'teamstatus':
                if (typeof this.renderTeamStatus === 'function') this.renderTeamStatus();
                break;
            case 'wellness':
                if (typeof this.renderWellnessDashboard === 'function') this.renderWellnessDashboard();
                break;
            case 'weekplan':
                if (typeof this.renderWeeklyPlanning === 'function') this.renderWeeklyPlanning();
                break;
            case 'medical':
                if (typeof this.renderMedicalHistory === 'function') this.renderMedicalHistory();
                break;
            case 'rehab':
                if (typeof this.renderRehabLoad === 'function') this.renderRehabLoad();
                break;
            case 'correlation':
                if (typeof this.renderLoadInjuryCorrelation === 'function') this.renderLoadInjuryCorrelation();
                break;
        }
    }

    // ========== PLAYERS MANAGEMENT ==========
    
    openAddPlayerModal() {
        document.getElementById('addPlayerModal').classList.add('active');
        document.getElementById('playerForm').reset();
    }

    handlePlayerSubmit(e) {
        e.preventDefault();
        
        const player = {
            id: Date.now().toString(),
            name: document.getElementById('playerName').value,
            number: document.getElementById('playerNumber').value || null,
            createdAt: new Date().toISOString()
        };
        
        this.players.push(player);
        this.savePlayers();
        this.renderPlayers();
        this.populatePlayerSelects();
        this.closeModal('addPlayerModal');
        this.showToast('✅ Jugadora añadida correctamente', 'success');
    }

    deletePlayer(playerId) {
        if (!confirm('¿Eliminar esta jugadora? También se eliminarán todas sus sesiones.')) {
            return;
        }
        
        this.players = this.players.filter(p => p.id !== playerId);
        this.sessions = this.sessions.filter(s => s.playerId !== playerId);
        
        this.savePlayers();
        this.saveSessions();
        this.renderPlayers();
        this.renderSessions();
        this.populatePlayerSelects();
        this.showToast('🗑️ Jugadora eliminada', 'info');
    }

    renderPlayers() {
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
        
        container.innerHTML = this.players.map(player => {
            const playerSessions = this.sessions.filter(s => s.playerId === player.id);
            const avgRPE = playerSessions.length > 0
                ? (playerSessions.reduce((sum, s) => sum + s.rpe, 0) / playerSessions.length).toFixed(1)
                : 0;
            
            const totalLoad = playerSessions.reduce((sum, s) => {
                return sum + (s.load || (s.rpe * (s.duration || 60)));
            }, 0);
            
            const ratio = this.calculateAcuteChronicRatio(player.id);
            
            return `
                <div class="player-card">
                    <div class="player-info">
                        <div class="player-avatar">${player.name.charAt(0).toUpperCase()}</div>
                        <div class="player-details">
                            <h3>${player.name}${player.number ? ` #${player.number}` : ''}</h3>
                            <p class="player-meta">${playerSessions.length} registros · ${rpeTracker ? rpeTracker.countUniqueSessions(playerSessions) : playerSessions.length} sesiones</p>
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
                    <div class="player-actions">
                        <button class="btn-icon" style="background: #2196f3; color: white;" onclick="rpeTracker.showPlayerReportMenu('${player.id}')" title="Informe PDF">📄</button>
                        <button class="btn-icon" style="background: var(--primary); color: white;" onclick="rpeTracker.editPlayer('${player.id}')" title="Editar">✏️</button>
                        <button class="btn-icon" style="background: #f44336; color: white;" onclick="rpeTracker.deletePlayer('${player.id}')" title="Eliminar">🗑️</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    populatePlayerSelects() {
        const filterSelect = document.getElementById('playerFilter');
        
        if (filterSelect) {
            filterSelect.innerHTML = '<option value="all">Todas las jugadoras</option>' +
                this.players.map(p => `<option value="${p.id}">${p.name}${p.number ? ` #${p.number}` : ''}</option>`).join('');
        }
    }

    // ========== SESSIONS MANAGEMENT ==========
    
    setDefaultDateTime() {
        const now = new Date();
        const offset = now.getTimezoneOffset() * 60000;
        const localISODate = new Date(now - offset).toISOString().slice(0, 10);
        document.getElementById('sessionDate').value = localISODate;
        
        // Set default time based on current hour
        const hour = now.getHours();
        if (hour < 14) {
            document.getElementById('timeMorning').checked = true;
        } else {
            document.getElementById('timeAfternoon').checked = true;
        }
    }

    updateRPEDisplay(value) {
        const rpeValue = parseInt(value);
        const color = this.getRPEColor(rpeValue);
        const label = this.getRPELabel(rpeValue);

        const rpeValueEl = document.getElementById('rpeValue');
        const rpeLabelEl = document.getElementById('rpeLabel');
        const slider = document.getElementById('rpeSlider');

        if (rpeValueEl) { rpeValueEl.textContent = rpeValue; rpeValueEl.style.color = color; }
        if (rpeLabelEl) rpeLabelEl.textContent = label;
        if (slider) slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${rpeValue * 10}%, #ddd ${rpeValue * 10}%, #ddd 100%)`;

        this.updateRPEScale(rpeValue);
    }

    updateRPEScale(value) {
        const rpeBar = document.getElementById('rpeBar');
        if (!rpeBar) return;
        let html = '';
        
        for (let i = 1; i <= 10; i++) {
            const color = i <= value ? this.getRPEColor(i) : '#e0e0e0';
            html += `<div style="flex: 1; height: 30px; background: ${color}; border-radius: 4px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; color: ${i <= value ? 'white' : '#999'};">${i}</div>`;
        }
        
        rpeBar.innerHTML = html;
    }

    getRPEColor(rpe) {
        const colors = {
            1: '#4caf50', 2: '#8bc34a', 3: '#cddc39', 4: '#ffeb3b', 5: '#ffc107',
            6: '#ff9800', 7: '#ff5722', 8: '#f44336', 9: '#e91e63', 10: '#9c27b0'
        };
        return colors[rpe] || '#666';
    }

    getRPELabel(rpe) {
        if (rpe <= 2) return 'Muy ligero';
        if (rpe <= 4) return 'Ligero';
        if (rpe <= 6) return 'Moderado';
        if (rpe <= 8) return 'Intenso';
        return 'Muy intenso';
    }

    openNewSessionModal() {
        if (this.players.length === 0) {
            alert('⚠️ Primero debes añadir jugadoras en la sección "Jugadoras"');
            return;
        }
        this.selectedPlayerIds = [];
        document.getElementById('newSessionModal').classList.add('active');
        this.setDefaultDateTime();
        this.renderPlayerButtonsMulti();
        document.getElementById('sessionDuration').value = 60;
        // Reset duration buttons
        document.querySelectorAll('.duration-btn').forEach(b => b.classList.remove('selected'));
        const d60 = document.querySelector('[data-duration="60"]');
        if (d60) d60.classList.add('selected');
        this.goToStep1();
    }
    
    renderPlayerButtons() {
        this.renderPlayerButtonsMulti();
    }

    renderPlayerButtonsMulti() {
        const container = document.getElementById('playerButtons');
        if (!container) return;
        container.innerHTML = this.players.map(player => `
            <button type="button" class="player-btn" data-player-id="${player.id}">
                <div class="player-btn-avatar">${player.name.charAt(0).toUpperCase()}</div>
                <div class="player-btn-name">${player.name}</div>
                ${player.number ? `<div class="player-btn-number">#${player.number}</div>` : ''}
            </button>
        `).join('');
        this.updateSelectedCount();
    }

    togglePlayerSelection(playerId) {
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
    }

    updateSelectedCount() {
        const el = document.getElementById('selectedCount');
        if (!el) return;
        const n = (this.selectedPlayerIds || []).length;
        el.textContent = n === 0 ? '0 jugadoras seleccionadas'
            : n === 1 ? '1 jugadora seleccionada'
            : `${n} jugadoras seleccionadas`;
        el.classList.toggle('has-selection', n > 0);
    }

    selectPlayer(playerId) {
        this.togglePlayerSelection(playerId);
    }

    goToStep1() {
        document.getElementById('sessionStep1').style.display = '';
        document.getElementById('sessionStep2').style.display = 'none';
        document.getElementById('modalTitle').textContent = 'Nueva Sesión — Paso 1';
        document.getElementById('dot1').classList.add('active');
        document.getElementById('dot1').classList.remove('done');
        document.getElementById('dot2').classList.remove('active');
    }

    goToStep2() {
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
    }

    renderPlayerRpeList() {
        const container = document.getElementById('playerRpeList');
        if (!container) return;
        container.innerHTML = this.selectedPlayerIds.map(playerId => {
            const player = this.players.find(p => p.id === playerId);
            if (!player) return '';
            return `
                <div class="player-rpe-item" id="rpe-item-${player.id}">
                    <div class="player-rpe-header">
                        <div class="player-rpe-avatar">${player.name.charAt(0).toUpperCase()}</div>
                        <div class="player-rpe-name">${player.name}${player.number ? ` <span style="opacity:0.6;font-size:0.85rem">#${player.number}</span>` : ''}</div>
                        <div>
                            <div class="player-rpe-value" id="rpeVal-${player.id}" style="color:${this.getRPEColor(5)}">5</div>
                            <div class="player-rpe-label-text" id="rpeLbl-${player.id}">${this.getRPELabel(5)}</div>
                        </div>
                    </div>
                    <input type="range" class="rpe-slider player-rpe-slider" min="1" max="10" value="5"
                        oninput="rpeTracker.updateIndividualRPE('${player.id}', this.value)">
                    <textarea class="player-rpe-notes" id="notes-${player.id}" rows="2"
                        placeholder="Incidencias de ${player.name} (opcional)..."></textarea>
                </div>`;
        }).join('');
    }

    updateIndividualRPE(playerId, value) {
        const val = parseInt(value);
        const valEl = document.getElementById(`rpeVal-${playerId}`);
        const lblEl = document.getElementById(`rpeLbl-${playerId}`);
        if (valEl) { valEl.textContent = val; valEl.style.color = this.getRPEColor(val); }
        if (lblEl) lblEl.textContent = this.getRPELabel(val);
    }

    saveTeamSession() {
        const dateValue = document.getElementById('sessionDate').value;
        const timeOfDay = document.querySelector('input[name="sessionTime"]:checked').value;
        const timeString = timeOfDay === 'morning' ? 'T10:00:00' : 'T18:00:00';
        const fullDateTime = dateValue + timeString;
        const duration = parseInt(document.getElementById('sessionDuration').value) || 60;
        const type = document.querySelector('input[name="sessionType"]:checked').value;
        const baseId = Date.now();

        this.selectedPlayerIds.forEach((playerId, i) => {
            const slider = document.querySelector(`#rpe-item-${playerId} .player-rpe-slider`);
            const notesEl = document.getElementById(`notes-${playerId}`);
            const rpe = slider ? parseInt(slider.value) : 5;
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
                notes
            };
            this.sessions.push(session);
        });

        this.saveSessions();
        this.renderSessions();
        this.closeModal('newSessionModal');
        const n = this.selectedPlayerIds.length;
        this.showToast(`✅ ${n} sesión${n > 1 ? 'es guardadas' : ' guardada'} correctamente`, 'success');
        this.selectedPlayerIds = [];
    }
    
    selectDuration(duration) {
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
    }

    closeModal(modalId) {
        document.getElementById(modalId).classList.remove('active');
    }
    
    getBasicFilteredSessions() {
        let filtered = [...this.sessions];
        
        if (this.currentPlayerFilter !== 'all') {
            filtered = filtered.filter(s => s.playerId === this.currentPlayerFilter);
        }
        
        if (this.currentTypeFilter !== 'all') {
            filtered = filtered.filter(s => s.type === this.currentTypeFilter);
        }
        
        return filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
    }

    handleSessionSubmit(e) {
        e.preventDefault();
        // El guardado ahora se gestiona desde saveTeamSession()
        const playerId = document.getElementById('sessionPlayer').value;
        if (!playerId) {
            return;
        }
        
        const dateValue = document.getElementById('sessionDate').value;
        const timeOfDay = document.querySelector('input[name="sessionTime"]:checked').value;
        
        // Create datetime string based on time of day
        const timeString = timeOfDay === 'morning' ? 'T10:00:00' : 'T18:00:00';
        const fullDateTime = dateValue + timeString;
        
        const rpe = parseInt(document.getElementById('rpeSlider').value);
        const duration = parseInt(document.getElementById('sessionDuration').value);
        const load = rpe * duration; // sRPE calculation
        
        const session = {
            id: Date.now().toString(),
            playerId: playerId,
            date: fullDateTime,
            timeOfDay: timeOfDay,
            type: document.querySelector('input[name="sessionType"]:checked').value,
            rpe: rpe,
            duration: duration,
            load: load,
            notes: document.getElementById('sessionNotes').value
        };
        
        this.sessions.push(session);
        this.saveSessions();
        this.renderSessions();
        this.closeModal('newSessionModal');
        
        this.showToast('✅ Sesión guardada correctamente', 'success');
    }

    showSkeletonLoader() {
        const list = document.getElementById('sessionList');
        const empty = document.getElementById('emptyState');
        if (!list) return;
        if (empty) empty.style.display = 'none';
        list.innerHTML = `
            <div class="skeleton-list">
                ${[1,2,3].map(() => `
                <div class="skeleton-card">
                    <div class="skeleton-line title"></div>
                    <div class="skeleton-line sub"></div>
                    <div class="skeleton-line badge"></div>
                </div>`).join('')}
            </div>`;
    }

    renderSessions() {
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
            
            return `
                <div class="session-card" onclick="rpeTracker.showSessionDetail('${session.id}')">
                    <div class="session-icon ${session.type}">
                        ${session.type === 'training' ? '🏀' : '🏟️'}
                    </div>
                    <div class="session-info">
                        <div class="session-type">${playerName} - ${this.getSessionTypeName(session.type)}</div>
                        <div class="session-date">${this.formatDate(session.date)}</div>
                    </div>
                    <div class="session-rpe">
                        <span class="session-rpe-number" style="color: ${this.getRPEColor(session.rpe)}">${session.rpe}</span>
                        <span class="session-rpe-label">RPE</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    showSessionDetail(id) {
        const session = this.sessions.find(s => s.id === id);
        if (!session) return;
        
        this.currentSessionId = id;
        const player = this.players.find(p => p.id === session.playerId);
        const playerName = player ? player.name : 'Desconocida';
        
        const timeOfDay = session.timeOfDay === 'morning' ? '☀️ Mañana' : '🌙 Tarde';
        
        const content = document.getElementById('detailContent');
        content.innerHTML = `
            <div class="detail-row">
                <span class="detail-label">Jugadora</span>
                <span>${playerName}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Tipo</span>
                <span>${session.type === 'training' ? '🏀 Entrenamiento' : '🏟️ Partido'}</span>
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
            <div class="detail-row" style="background: #f5f5f5; padding: 1rem; border-radius: 8px; margin-top: 1rem;">
                <span class="detail-label">Carga Total (sRPE)</span>
                <span style="font-size: 1.5rem; font-weight: 700; color: var(--primary);">${session.load || (session.rpe * (session.duration || 60))}</span>
            </div>
            ${session.notes ? `
                <div class="detail-row">
                    <span class="detail-label">Incidencias</span>
                </div>
                <div class="detail-notes">${session.notes || 'Sin incidencias'}</div>
            ` : '<div class="detail-notes" style="font-style: italic; color: #999;">Sin incidencias registradas</div>'}
        `;
        
        document.getElementById('detailModal').classList.add('active');
    }

    deleteCurrentSession() {
        if (!this.currentSessionId) return;
        
        if (confirm('¿Seguro que quieres eliminar esta sesión?')) {
            this.sessions = this.sessions.filter(s => s.id !== this.currentSessionId);
            this.saveSessions();
            this.renderSessions();
            this.closeModal('detailModal');
            this.showToast('🗑️ Sesión eliminada', 'info');
        }
    }

    // ========== DASHBOARD ==========
    
    // Cuenta sesiones únicas de equipo (fecha + momento + tipo = 1 evento)
    countUniqueSessions(sessions) {
        const keys = new Set(sessions.map(s => {
            const d = new Date(s.date);
            const dateKey = d.toISOString().slice(0, 10);
            return `${dateKey}_${s.timeOfDay || 'unknown'}_${s.type || 'training'}`;
        }));
        return keys.size;
    }

    getUniqueSessions(sessions) {
        const seen = new Set();
        return sessions.filter(s => {
            const d = new Date(s.date);
            const key = `${d.toISOString().slice(0,10)}_${s.timeOfDay||'unknown'}_${s.type||'training'}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    renderDashboard() {
        const container = document.getElementById('dashboardContent');
        if (!container) return;
        
        const totalPlayers = this.players.length;

        // Conteos de eventos únicos de equipo (fecha + momento + tipo = 1 sesión)
        const totalSessions = this.countUniqueSessions(this.sessions);
        const trainingCount = this.countUniqueSessions(this.sessions.filter(s => s.type === 'training'));
        const matchCount    = this.countUniqueSessions(this.sessions.filter(s => s.type === 'match'));

        // RPE medio sigue siendo por registro individual (métrica de carga)
        const avgRPE = this.sessions.length > 0
            ? (this.sessions.reduce((sum, s) => sum + s.rpe, 0) / this.sessions.length).toFixed(1)
            : 0;

        // Últimos 7 días: eventos únicos
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentSessions = this.sessions.filter(s => new Date(s.date) >= sevenDaysAgo);
        const recentUnique = this.countUniqueSessions(recentSessions);
        
        container.innerHTML = `
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-value" style="color: var(--primary);">${totalPlayers}</span>
                    <span class="stat-label">👥 Jugadoras</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value" style="color: var(--secondary);">${totalSessions}</span>
                    <span class="stat-label">📋 Total Sesiones</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value" style="color: var(--warning);">${avgRPE}</span>
                    <span class="stat-label">💪 RPE Medio Global</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value" style="color: var(--success);">${recentUnique}</span>
                    <span class="stat-label">📅 Últimos 7 días</span>
                </div>
            </div>
            
            <div class="stats-grid">
                <div class="stat-card">
                    <span class="stat-value" style="color: #0066ff;">${trainingCount}</span>
                    <span class="stat-label">🏀 Entrenamientos</span>
                </div>
                <div class="stat-card">
                    <span class="stat-value" style="color: #ff6600;">${matchCount}</span>
                    <span class="stat-label">🏟️ Partidos</span>
                </div>
            </div>
            
            <h3 style="margin-top: 2rem; margin-bottom: 1rem;">Ratio Agudo:Crónico por Jugadora</h3>
            ${this.renderTeamRatios()}
        `;
    }

    renderTeamRatios() {
        if (this.players.length === 0) {
            return '<p style="color: var(--gray); text-align: center;">No hay jugadoras registradas</p>';
        }

        const getStatus = (r) => {
            const n = parseFloat(r);
            if (isNaN(n) || r === 'N/A') return { label: 'Sin datos', cls: 'status-nodata', icon: '—' };
            if (n > 1.5)  return { label: 'Peligro',   cls: 'status-danger',  icon: '🔴' };
            if (n > 1.3)  return { label: 'Precaución', cls: 'status-caution', icon: '🟠' };
            if (n < 0.8)  return { label: 'Por debajo', cls: 'status-low',     icon: '🔵' };
            return           { label: 'Óptimo',    cls: 'status-ok',      icon: '🟢' };
        };

        const cards = this.players.map(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const st = getStatus(ratio.ratio);
            const num = player.number ? `<span class="rcard-number">#${player.number}</span>` : '';
            return `
                <div class="rcard ${st.cls}">
                    <div class="rcard-top">
                        <div class="rcard-avatar">${player.name.charAt(0).toUpperCase()}</div>
                        <div class="rcard-info">
                            <div class="rcard-name">${player.name}${num}</div>
                            <div class="rcard-status-label">${st.icon} ${st.label}</div>
                        </div>
                    </div>
                    <div class="rcard-ratio">${ratio.ratio === 'N/A' ? '—' : ratio.ratio}</div>
                    <div class="rcard-bar-wrap">
                        <div class="rcard-bar">
                            <div class="rcard-bar-fill" style="width:${Math.min((parseFloat(ratio.ratio)||0)/2*100, 100)}%; background:${this.getRatioColor(ratio.ratio)};"></div>
                            <div class="rcard-bar-marker safe-lo"></div>
                            <div class="rcard-bar-marker safe-hi"></div>
                        </div>
                    </div>
                </div>`;
        }).join('');

        return `
            <h3 style="margin: 2rem 0 1rem; font-size: 1rem; color: #555; font-weight: 600;">
                📊 Ratio Agudo:Crónico — Vista rápida del equipo
            </h3>
            <div class="rcard-legend">
                <span class="rleg rleg-ok">🟢 Óptimo (0.8–1.3)</span>
                <span class="rleg rleg-caution">🟠 Precaución (1.3–1.5)</span>
                <span class="rleg rleg-danger">🔴 Peligro (&gt;1.5)</span>
                <span class="rleg rleg-low">🔵 Por debajo (&lt;0.8)</span>
            </div>
            <div class="rcard-grid">${cards}</div>`;
    }

    // ========== ANALYTICS ==========
    
    renderAnalytics() {
        const container = document.getElementById('analyticsContent');
        if (!container) return;
        
        if (this.players.length === 0) {
            container.innerHTML = `
                <div class="empty-state active">
                    <div class="empty-icon">📈</div>
                    <h3>No hay datos para analizar</h3>
                    <p>Añade jugadoras y registra sesiones para ver el análisis</p>
                </div>
            `;
            return;
        }
        
        container.innerHTML = `
            <div class="info-box" style="background: #e3f2fd; padding: 1.5rem; border-radius: 12px; margin-bottom: 2rem;">
                <h3 style="margin-bottom: 0.5rem;">ℹ️ Método EWMA (Exponentially Weighted Moving Average)</h3>
                <p style="margin-bottom: 0.5rem;"><strong>Carga = RPE × Duración</strong> (método sRPE)</p>
                <p style="margin-bottom: 0.5rem;">Esta app usa el <strong>método EWMA</strong>, el estándar científico usado por equipos profesionales para calcular el ratio Agudo:Crónico.</p>
                
                <div style="background: white; padding: 1rem; border-radius: 8px; margin: 1rem 0;">
                    <strong>¿Por qué EWMA es mejor?</strong>
                    <ul style="margin: 0.5rem 0 0 1.5rem; font-size: 0.9rem;">
                        <li>✅ Pondera más los entrenamientos recientes</li>
                        <li>✅ Se adapta más rápido a cambios de carga</li>
                        <li>✅ Más sensible a picos de carga (mejor prevención)</li>
                        <li>✅ Método validado científicamente</li>
                    </ul>
                </div>
                
                <p style="margin-bottom: 0.5rem;"><strong>Interpretación del Ratio:</strong></p>
                <ul style="margin-left: 1.5rem; color: var(--gray);">
                    <li><strong style="color: #2e7d32;">0.8 - 1.3 (Verde):</strong> 🟢 Zona óptima - Adaptación positiva</li>
                    <li><strong style="color: #ef6c00;">1.3 - 1.5 (Naranja):</strong> 🟠 Precaución - Riesgo moderado de lesión</li>
                    <li><strong style="color: #c62828;">> 1.5 (Rojo):</strong> 🔴 Peligro - Alto riesgo de lesión</li>
                    <li><strong style="color: #1565c0;">< 0.8 (Azul):</strong> 🔵 Descarga - Puede perder condición</li>
                </ul>
                
                <p style="margin-top: 1rem; font-size: 0.85rem; color: var(--gray); font-style: italic;">
                    Nota: EWMA Aguda usa ventana de 7 días (λ=0.25), EWMA Crónica usa 28 días (λ=0.069)
                </p>
            </div>
            
            ${this.renderPlayerComparison()}
            
            ${this.renderTeamRatios()}
        `;
        
        // Render comparison module first (top of page)
        setTimeout(() => {
            this.renderComparisonModule();
            this.renderComparisonChart();
        }, 50);
    }

    // ========== ACUTE:CHRONIC RATIO CALCULATION (EWMA METHOD) ==========
    
    calculateAcuteChronicRatio(playerId) {
        const playerSessions = this.sessions
            .filter(s => s.playerId === playerId)
            .map(s => ({
                ...s,
                date: new Date(s.date),
                load: s.load || (s.rpe * (s.duration || 60))
            }))
            .sort((a, b) => a.date - b.date); // Sort chronologically
        
        if (playerSessions.length === 0) {
            return {
                acute: 0,
                chronic: 0,
                ratio: 'N/A',
                sessions7d: 0,
                sessions21d: 0,
                totalLoad7d: 0,
                totalLoad21d: 0
            };
        }
        
        // EWMA parameters (based on scientific literature)
        // Acute: lambda = 2/(7+1) = 0.25 (7-day window)
        // Chronic: lambda = 2/(28+1) = 0.069 (28-day window)
        const lambdaAcute = 2 / (7 + 1);
        const lambdaChronic = 2 / (28 + 1);
        
        let ewmaAcute = 0;
        let ewmaChronic = 0;
        
        // Calculate EWMA for each day
        const now = new Date();
        const maxDaysBack = 42; // Look back 42 days to ensure enough data
        
        for (let i = maxDaysBack; i >= 0; i--) {
            const currentDate = new Date(now);
            currentDate.setDate(currentDate.getDate() - i);
            currentDate.setHours(0, 0, 0, 0);
            
            const nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 1);
            
            // Find sessions on this day
            const dailySessions = playerSessions.filter(s => {
                const sessionDate = new Date(s.date);
                sessionDate.setHours(0, 0, 0, 0);
                return sessionDate.getTime() === currentDate.getTime();
            });
            
            // Sum load for this day
            const dailyLoad = dailySessions.reduce((sum, s) => sum + s.load, 0);
            
            // Update EWMA
            // EWMA formula: EWMA_today = lambda × load_today + (1 - lambda) × EWMA_yesterday
            ewmaAcute = (lambdaAcute * dailyLoad) + ((1 - lambdaAcute) * ewmaAcute);
            ewmaChronic = (lambdaChronic * dailyLoad) + ((1 - lambdaChronic) * ewmaChronic);
        }
        
        // Calculate ACWR (Acute:Chronic Workload Ratio)
        const ratio = ewmaChronic > 0 ? (ewmaAcute / ewmaChronic) : 0;
        
        // Get session counts for display
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const twentyEightDaysAgo = new Date(now);
        twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
        
        const acuteSessions = playerSessions.filter(s => s.date >= sevenDaysAgo);
        const chronicSessions = playerSessions.filter(s => s.date >= twentyEightDaysAgo);
        
        const totalLoad7d = acuteSessions.reduce((sum, s) => sum + s.load, 0);
        const totalLoad28d = chronicSessions.reduce((sum, s) => sum + s.load, 0);
        
        return {
            acute: ewmaAcute,
            chronic: ewmaChronic,
            ratio: ratio > 0 ? ratio.toFixed(2) : 'N/A',
            sessions7d: acuteSessions.length,
            sessions21d: chronicSessions.length,
            totalLoad7d: Math.round(totalLoad7d),
            totalLoad21d: Math.round(totalLoad28d)
        };
    }

    getRatioColor(ratio) {
        if (ratio === 'N/A') return '#999';
        const r = parseFloat(ratio);
        if (r < 0.8) return '#1565c0'; // Blue - Detraining
        if (r <= 1.3) return '#2e7d32'; // Green - Optimal
        if (r <= 1.5) return '#ef6c00'; // Orange - Caution
        return '#c62828'; // Red - Danger
    }

    getRatioClass(ratio) {
        if (ratio === 'N/A') return 'ratio-safe';
        const r = parseFloat(ratio);
        if (r >= 0.8 && r <= 1.3) return 'ratio-safe';
        if (r > 1.3 && r <= 1.5) return 'ratio-caution';
        return 'ratio-danger';
    }

    getRatioStatus(ratio) {
        if (ratio === 'N/A') return 'Sin datos';
        const r = parseFloat(ratio);
        if (r < 0.8) return '⬇️ Descarga';
        if (r <= 1.3) return '✅ Óptimo';
        if (r <= 1.5) return '⚠️ Precaución';
        return '🚨 Peligro';
    }

    // ========== UTILITIES ==========
    
    getSessionTypeName(type) {
        return type === 'training' ? 'Entrenamiento' : 'Partido';
    }

    formatDate(dateString) {
        const date = new Date(dateString);
        const options = { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric'
        };
        const dateStr = date.toLocaleDateString('es-ES', options);
        
        // Extract time of day from the date or session data
        const hour = date.getHours();
        const timeOfDay = hour < 14 ? '☀️ Mañana' : '🌙 Tarde';
        
        return `${dateStr} - ${timeOfDay}`;
    }

    loadSessions() {
        // Firebase es la fuente de verdad — escuchar cambios en tiempo real
        if (window.firebaseSync) {
            window.firebaseSync.onSessionsChange((updatedSessions) => {
                this.sessions = updatedSessions;
                this.renderSessions();
                console.log('🔄 Sesiones actualizadas desde Firebase');
            });
        } else {
            console.warn('⚠️ Firebase no disponible, usando localStorage');
            const stored = localStorage.getItem('basketballSessions');
            return stored ? JSON.parse(stored) : [];
        }
        return [];
    }

    saveSessions() {
        // Guardar en Firebase (que también guardará en localStorage como backup)
        if (window.firebaseSync) {
            window.firebaseSync.saveSessions(this.sessions);
        } else {
            // Fallback si Firebase no está disponible
            localStorage.setItem('basketballSessions', JSON.stringify(this.sessions));
        }
    }

    loadPlayers() {
        // Firebase es la fuente de verdad — escuchar cambios en tiempo real
        if (window.firebaseSync) {
            window.firebaseSync.onPlayersChange((updatedPlayers) => {
                this.players = updatedPlayers;
                this.renderPlayers();
                this.populatePlayerSelects();
                this.renderSessions(); // re-renderizar para mostrar nombres correctos
                console.log('🔄 Jugadores actualizados desde Firebase');
            });
        } else {
            console.warn('⚠️ Firebase no disponible, usando localStorage');
            const stored = localStorage.getItem('basketballPlayers');
            return stored ? JSON.parse(stored) : [];
        }
        return [];
    }

    savePlayers() {
        // Guardar en Firebase (que también guardará en localStorage como backup)
        if (window.firebaseSync) {
            window.firebaseSync.savePlayers(this.players);
        } else {
            // Fallback si Firebase no está disponible
            localStorage.setItem('basketballPlayers', JSON.stringify(this.players));
        }
    }

    showToast(message, type = 'success') {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 280);
        }, 2500);
    }

    // ========== FEATURE 1: EVOLUTION CHARTS ==========
    
    renderEvolutionCharts() {
        const container = document.getElementById('evolutionCharts');
        if (!container) return;
        
        if (this.players.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        // Create charts for each player
        let chartsHTML = '<h3 style="margin: 2rem 0 1rem 0;">📈 Evolución del Ratio A:C</h3>';
        
        this.players.forEach(player => {
            chartsHTML += `
                <div class="chart-container">
                    <h4>${player.name}${player.number ? ` #${player.number}` : ''}</h4>
                    <canvas id="chart-${player.id}" class="chart-canvas" width="800" height="300"></canvas>
                </div>
            `;
        });
        
        container.innerHTML = chartsHTML;
        
        // Render each chart
        setTimeout(() => {
            this.players.forEach(player => {
                this.renderPlayerEvolutionChart(player.id);
            });
        }, 100);
    }
    
    renderPlayerEvolutionChart(playerId) {
        const canvasId = `chart-${playerId}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        
        // Get player sessions sorted by date
        const playerSessions = this.sessions
            .filter(s => s.playerId === playerId)
            .map(s => ({
                ...s,
                date: new Date(s.date),
                load: s.load || (s.rpe * (s.duration || 60))
            }))
            .sort((a, b) => a.date - b.date);
        
        if (playerSessions.length === 0) return;
        
        // Calculate EWMA for each day
        const now = new Date();
        const daysBack = 30;
        const labels = [];
        const ratioData = [];
        
        const lambdaAcute = 2 / (7 + 1);
        const lambdaChronic = 2 / (28 + 1);
        
        let ewmaAcute = 0;
        let ewmaChronic = 0;
        
        for (let i = daysBack; i >= 0; i--) {
            const currentDate = new Date(now);
            currentDate.setDate(currentDate.getDate() - i);
            currentDate.setHours(0, 0, 0, 0);
            
            // Find sessions on this day
            const dailySessions = playerSessions.filter(s => {
                const sessionDate = new Date(s.date);
                sessionDate.setHours(0, 0, 0, 0);
                return sessionDate.getTime() === currentDate.getTime();
            });
            
            const dailyLoad = dailySessions.reduce((sum, s) => sum + s.load, 0);
            
            ewmaAcute = (lambdaAcute * dailyLoad) + ((1 - lambdaAcute) * ewmaAcute);
            ewmaChronic = (lambdaChronic * dailyLoad) + ((1 - lambdaChronic) * ewmaChronic);
            
            const ratio = ewmaChronic > 0 ? (ewmaAcute / ewmaChronic) : 0;
            
            labels.push(`${currentDate.getDate()}/${currentDate.getMonth() + 1}`);
            ratioData.push(ratio);
        }
        
        // Create chart with zones
        const chart = new SimpleChart(canvasId, {
            type: 'line',
            data: [{
                label: 'Ratio A:C',
                values: ratioData,
                color: '#ff6600'
            }],
            labels: labels,
            title: 'Evolución Ratio Agudo:Crónico (30 días)',
            zones: [
                { min: 0, max: 0.8, color: 'rgba(21, 101, 192, 0.1)' },     // Blue
                { min: 0.8, max: 1.3, color: 'rgba(76, 175, 80, 0.1)' },    // Green
                { min: 1.3, max: 1.5, color: 'rgba(255, 152, 0, 0.1)' },    // Orange
                { min: 1.5, max: 3, color: 'rgba(244, 67, 54, 0.1)' }       // Red
            ]
        });
        
        chart.render();
    }

    // ========== FEATURE 2: ALERTS ==========
    
    checkAndShowAlerts() {
        const container = document.getElementById('alertsContainer');
        if (!container) return;
        
        const alerts = [];
        
        this.players.forEach(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const r = parseFloat(ratio.ratio);
            
            if (ratio.ratio === 'N/A') return;
            
            if (r > 1.5) {
                alerts.push({
                    type: 'danger',
                    icon: '🚨',
                    title: `ALERTA: ${player.name}`,
                    message: `Ratio A:C de ${ratio.ratio} - Alto riesgo de lesión. Reducir carga inmediatamente.`
                });
            } else if (r > 1.3) {
                alerts.push({
                    type: 'warning',
                    icon: '⚠️',
                    title: `Precaución: ${player.name}`,
                    message: `Ratio A:C de ${ratio.ratio} - Riesgo moderado. Monitorizar carga de cerca.`
                });
            } else if (r < 0.8 && ratio.sessions7d > 0) {
                alerts.push({
                    type: 'info',
                    icon: 'ℹ️',
                    title: `Descarga: ${player.name}`,
                    message: `Ratio A:C de ${ratio.ratio} - Puede estar perdiendo condición.`
                });
            }
        });
        
        if (alerts.length === 0) {
            container.innerHTML = '';
            return;
        }
        
        container.innerHTML = alerts.map(alert => `
            <div class="alert-banner alert-${alert.type}">
                <div class="alert-icon">${alert.icon}</div>
                <div class="alert-content">
                    <div class="alert-title">${alert.title}</div>
                    <div class="alert-message">${alert.message}</div>
                </div>
            </div>
        `).join('');
    }

    // ========== FEATURE 3: EXPORT TO CSV ==========
    
    exportData() {
        // Prepare CSV data
        let csv = 'Jugadora,Dorsal,Fecha,Hora del Día,Tipo,RPE,Duración (min),Carga (sRPE),Incidencias\n';
        
        // Sort sessions by date
        const sortedSessions = [...this.sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
        
        sortedSessions.forEach(session => {
            const player = this.players.find(p => p.id === session.playerId);
            const playerName = player ? player.name : 'Desconocida';
            const playerNumber = player && player.number ? player.number : '';
            
            const date = new Date(session.date);
            const dateStr = date.toLocaleDateString('es-ES');
            const timeOfDay = session.timeOfDay === 'morning' ? 'Mañana' : 'Tarde';
            const type = session.type === 'training' ? 'Entrenamiento' : 'Partido';
            const load = session.load || (session.rpe * (session.duration || 60));
            const notes = (session.notes || '').replace(/"/g, '""'); // Escape quotes
            
            csv += `"${playerName}","${playerNumber}","${dateStr}","${timeOfDay}","${type}",${session.rpe},${session.duration || 60},${load},"${notes}"\n`;
        });
        
        // Add summary sheet
        csv += '\n\nRESUMEN POR JUGADORA\n';
        csv += 'Jugadora,Dorsal,Total Sesiones,RPE Medio,Carga Total,Ratio A:C,Estado\n';
        
        this.players.forEach(player => {
            const playerSessions = this.sessions.filter(s => s.playerId === player.playerId);
            const avgRPE = playerSessions.length > 0
                ? (playerSessions.reduce((sum, s) => sum + s.rpe, 0) / playerSessions.length).toFixed(1)
                : 0;
            
            const totalLoad = playerSessions.reduce((sum, s) => {
                return sum + (s.load || (s.rpe * (s.duration || 60)));
            }, 0);
            
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const status = this.getRatioStatus(ratio.ratio);
            
            csv += `"${player.name}","${player.number || ''}",${playerSessions.length},${avgRPE},${totalLoad},"${ratio.ratio}","${status}"\n`;
        });
        
        // Download CSV
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        const now = new Date();
        const filename = `RPE_Basketball_${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}.csv`;
        
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showToast('📥 Datos exportados a CSV', 'info');
    }

    // ========== FEATURE 4: LOAD RECOMMENDATIONS ==========
    
    getLoadRecommendation(playerId) {
        const ratio = this.calculateAcuteChronicRatio(playerId);
        const r = parseFloat(ratio.ratio);
        
        if (ratio.ratio === 'N/A' || ratio.sessions7d === 0) {
            return {
                type: 'info',
                message: 'Sin datos suficientes para recomendar carga.',
                suggestedRPE: '5-7',
                suggestedDuration: '60',
                suggestedLoad: '300-420'
            };
        }
        
        const avgRecentLoad = ratio.totalLoad7d / Math.max(ratio.sessions7d, 1);
        
        if (r > 1.5) {
            // DANGER - Reduce load significantly
            const targetLoad = avgRecentLoad * 0.5;
            return {
                type: 'danger',
                message: '🚨 REDUCIR CARGA - Alto riesgo de lesión',
                suggestedRPE: '3-5',
                suggestedDuration: '45-60',
                suggestedLoad: Math.round(targetLoad).toString(),
                advice: 'Sesión de recuperación activa. Evitar alta intensidad.'
            };
        } else if (r > 1.3) {
            // CAUTION - Reduce load moderately
            const targetLoad = avgRecentLoad * 0.7;
            return {
                type: 'warning',
                message: '⚠️ Moderar carga - Precaución',
                suggestedRPE: '4-6',
                suggestedDuration: '60',
                suggestedLoad: Math.round(targetLoad).toString(),
                advice: 'Reducir intensidad pero mantener volumen técnico.'
            };
        } else if (r < 0.8) {
            // DETRAINING - Increase load
            const targetLoad = avgRecentLoad * 1.3;
            return {
                type: 'info',
                message: 'ℹ️ Aumentar carga - Puede perder condición',
                suggestedRPE: '7-8',
                suggestedDuration: '75-90',
                suggestedLoad: Math.round(targetLoad).toString(),
                advice: 'Incrementar gradualmente intensidad y volumen.'
            };
        } else {
            // OPTIMAL - Maintain or slight increase
            const targetLoad = avgRecentLoad * 1.05;
            return {
                type: 'success',
                message: '✅ Zona óptima - Continuar progresión',
                suggestedRPE: '6-8',
                suggestedDuration: '60-75',
                suggestedLoad: Math.round(targetLoad).toString(),
                advice: 'Mantener carga actual con pequeñas progresiones.'
            };
        }
    }

    renderComparisonChart() {
        const canvas = document.getElementById('comparisonChart');
        if (!canvas || this.players.length < 2) return;
        
        const comparisonData = this.players.map(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            return {
                name: player.name + (player.number ? ` #${player.number}` : ''),
                ratio: parseFloat(ratio.ratio) || 0
            };
        }).sort((a, b) => b.ratio - a.ratio);
        
        const colors = comparisonData.map(player => this.getRatioColor(player.ratio));
        
        const chart = new SimpleChart('comparisonChart', {
            type: 'bar',
            data: [{
                label: 'Ratio A:C',
                values: comparisonData.map(p => p.ratio),
                colors: colors
            }],
            labels: comparisonData.map(p => p.name),
            title: 'Comparativa Ratio A:C por Jugadora'
        });
        
        chart.render();
    }

    // ========== FEATURE 5: PLAYER COMPARISON ==========
    
    renderPlayerComparison() {
        if (this.players.length < 2) return '';
        
        const comparisonData = this.players.map(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const playerSessions = this.sessions.filter(s => s.playerId === player.id);
            const avgRPE = playerSessions.length > 0
                ? (playerSessions.reduce((sum, s) => sum + s.rpe, 0) / playerSessions.length)
                : 0;
            
            return {
                name: player.name,
                number: player.number,
                ratio: parseFloat(ratio.ratio) || 0,
                avgRPE: avgRPE,
                totalSessions: playerSessions.length,
                acute: ratio.acute,
                chronic: ratio.chronic
            };
        }).sort((a, b) => b.ratio - a.ratio); // Sort by ratio descending
        
        return `
            <h3 style="margin: 2rem 0 1rem 0;">👥 Comparativa de Jugadoras</h3>
            <div class="chart-container">
                <canvas id="comparisonChart" class="chart-canvas" width="800" height="300"></canvas>
            </div>
            
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-top: 1rem;">
                ${comparisonData.map(player => {
                    const recommendation = this.getLoadRecommendation(
                        this.players.find(p => p.name === player.name).id
                    );
                    
                    return `
                        <div class="recommendation-card" style="border-left-color: ${this.getRatioColor(player.ratio)};">
                            <div class="recommendation-title">
                                ${player.name}${player.number ? ` #${player.number}` : ''}
                                <span style="margin-left: auto; color: ${this.getRatioColor(player.ratio)}; font-size: 1.5rem;">
                                    ${player.ratio > 0 ? player.ratio.toFixed(2) : 'N/A'}
                                </span>
                            </div>
                            <div class="recommendation-content">
                                <p><strong>${recommendation.message}</strong></p>
                                <p style="margin-top: 0.5rem;">${recommendation.advice || ''}</p>
                                <div class="load-suggestion">
                                    📊 Próxima sesión: RPE ${recommendation.suggestedRPE} × ${recommendation.suggestedDuration}min = ~${recommendation.suggestedLoad} unidades
                                </div>
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    // ========== MÓDULO DE COMPARACIÓN ==========

    renderComparisonModule() {
        const container = document.getElementById('comparisonModule');
        if (!container || this.players.length < 2) {
            if (container) container.innerHTML = '';
            return;
        }

        const playerOptions = this.players.map(p =>
            `<option value="${p.id}">${p.name}${p.number ? ' #'+p.number : ''}</option>`
        ).join('');

        container.innerHTML = `
            <div class="comp-card">
                <div class="comp-header">
                    <h3 class="comp-title">🔍 Comparador</h3>
                    <div class="comp-mode-toggle">
                        <button class="comp-mode-btn active" id="modePvP" onclick="rpeTracker.setCompMode('pvp')">
                            Jugadora vs Jugadora
                        </button>
                        <button class="comp-mode-btn" id="modePvT" onclick="rpeTracker.setCompMode('pvt')">
                            Jugadora vs Media equipo
                        </button>
                    </div>
                </div>

                <div class="comp-selectors">
                    <div class="comp-selector-group">
                        <label class="comp-label" id="labelA">Jugadora A</label>
                        <select class="comp-select" id="compPlayerA" onchange="rpeTracker.updateComparison()">
                            ${playerOptions}
                        </select>
                    </div>
                    <div class="comp-vs">VS</div>
                    <div class="comp-selector-group" id="selectorB">
                        <label class="comp-label" id="labelB">Jugadora B</label>
                        <select class="comp-select" id="compPlayerB" onchange="rpeTracker.updateComparison()">
                            ${this.players.map((p, i) =>
                                `<option value="${p.id}" ${i===1?'selected':''}>${p.name}${p.number ? ' #'+p.number : ''}</option>`
                            ).join('')}
                        </select>
                    </div>
                    <div class="comp-selector-group" id="selectorTeam" style="display:none;">
                        <label class="comp-label">Referencia</label>
                        <div class="comp-team-badge">📊 Media del equipo</div>
                    </div>
                </div>

                <div id="compMetrics" class="comp-metrics"></div>
                <div class="comp-chart-wrap">
                    <canvas id="compChart" width="800" height="260"></canvas>
                </div>
            </div>
        `;

        this._compMode = 'pvp';
        this.updateComparison();
    }

    setCompMode(mode) {
        this._compMode = mode;
        document.getElementById('modePvP')?.classList.toggle('active', mode === 'pvp');
        document.getElementById('modePvT')?.classList.toggle('active', mode === 'pvt');
        const selectorB = document.getElementById('selectorB');
        const selectorTeam = document.getElementById('selectorTeam');
        const labelA = document.getElementById('labelA');
        if (selectorB) selectorB.style.display = mode === 'pvp' ? '' : 'none';
        if (selectorTeam) selectorTeam.style.display = mode === 'pvt' ? '' : 'none';
        if (labelA) labelA.textContent = mode === 'pvt' ? 'Jugadora' : 'Jugadora A';
        this.updateComparison();
    }

    updateComparison() {
        const idA = document.getElementById('compPlayerA')?.value;
        if (!idA) return;

        const playerA = this.players.find(p => p.id === idA);
        if (!playerA) return;

        const mode = this._compMode || 'pvp';
        const metricsEl = document.getElementById('compMetrics');
        const canvas = document.getElementById('compChart');
        if (!metricsEl || !canvas) return;

        const statsA = this.getCompStats(idA);

        let statsB, labelB, colorB;
        if (mode === 'pvp') {
            const idB = document.getElementById('compPlayerB')?.value;
            const playerB = this.players.find(p => p.id === idB);
            if (!playerB || idB === idA) { metricsEl.innerHTML = '<p style="color:#999;padding:1rem">Selecciona dos jugadoras distintas</p>'; return; }
            statsB = this.getCompStats(idB);
            labelB = playerB.name + (playerB.number ? ' #'+playerB.number : '');
            colorB = '#0066ff';
        } else {
            statsB = this.getTeamAvgStats();
            labelB = 'Media equipo';
            colorB = '#9c27b0';
        }

        const labelA = playerA.name + (playerA.number ? ' #'+playerA.number : '');
        const colorA = '#ff6600';

        // Metrics grid
        const metrics = [
            { key: 'ratio',       label: 'Ratio A:C',          fmt: v => v > 0 ? v.toFixed(2) : 'N/A' },
            { key: 'avgRPE',      label: 'RPE medio global',   fmt: v => v > 0 ? v.toFixed(1) : 'N/A' },
            { key: 'rpe7',        label: 'RPE últimos 7 días', fmt: v => v > 0 ? v.toFixed(1) : 'N/A' },
            { key: 'trend',       label: 'Tendencia RPE',      fmt: v => v === 0 ? '—' : (v > 0 ? '↑ +'+Math.abs(v).toFixed(0)+'%' : '↓ -'+Math.abs(v).toFixed(0)+'%') },
            { key: 'load7',       label: 'Carga últimos 7d',   fmt: v => v > 0 ? Math.round(v) : 'N/A' },
            { key: 'load28',      label: 'Carga últimos 28d',  fmt: v => v > 0 ? Math.round(v) : 'N/A' },
            { key: 'sessions28',  label: 'Sesiones (28 días)', fmt: v => v },
            { key: 'avgDuration', label: 'Duración media',     fmt: v => v > 0 ? Math.round(v)+"'" : 'N/A' },
        ];

        metricsEl.innerHTML = `
            <div class="comp-metrics-header">
                <div class="comp-metrics-label"></div>
                <div class="comp-metrics-col" style="color:${colorA}">${labelA}</div>
                <div class="comp-metrics-col" style="color:${colorB}">${labelB}</div>
            </div>
            ${metrics.map(m => {
                const vA = statsA[m.key], vB = statsB[m.key];
                const fA = m.fmt(vA), fB = m.fmt(vB);
                // Highlight better value (lower ratio=better if >1.3, more sessions=better)
                const aWins = m.key === 'ratio'
                    ? (parseFloat(vA)||0) <= (parseFloat(vB)||0)
                    : m.key === 'sessions' || m.key === 'totalLoad'
                        ? (vA||0) >= (vB||0)
                        : false;
                return `
                <div class="comp-metrics-row">
                    <div class="comp-metrics-label">${m.label}</div>
                    <div class="comp-metrics-col ${m.key==='ratio' && aWins ? 'comp-winner':''}" style="color:${colorA}">${fA}</div>
                    <div class="comp-metrics-col ${m.key==='ratio' && !aWins ? 'comp-winner':''}" style="color:${colorB}">${fB}</div>
                </div>`;
            }).join('')}
        `;

        // Line chart: RPE evolution last 8 weeks
        const seriesA = this.getWeeklyRPESeries(idA);
        const seriesB = mode === 'pvp'
            ? this.getWeeklyRPESeries(document.getElementById('compPlayerB')?.value)
            : this.getTeamWeeklyRPESeries();

        const allWeeks = [...new Set([...seriesA.map(d=>d.week), ...seriesB.map(d=>d.week)])].sort();
        const valA = allWeeks.map(w => seriesA.find(d=>d.week===w)?.rpe ?? null);
        const valB = allWeeks.map(w => seriesB.find(d=>d.week===w)?.rpe ?? null);
        const labels = allWeeks.map(w => 'S'+w.slice(-2));

        const chart = new SimpleChart('compChart', {
            type: 'line',
            data: [
                { label: labelA,  values: valA.map(v=>v??0), color: colorA },
                { label: labelB,  values: valB.map(v=>v??0), color: colorB }
            ],
            labels,
            title: 'RPE medio semanal',
            yAxisLabel: 'RPE'
        });
        chart.render();
    }

    getCompStats(playerId) {
        const sessions = this.sessions.filter(s => s.playerId === playerId);
        const ratio = this.calculateAcuteChronicRatio(playerId);
        const totalLoad = sessions.reduce((s, x) => s + (x.load || x.rpe*(x.duration||60)), 0);

        // Last 28 days sessions
        const now = new Date();
        const d28 = new Date(now); d28.setDate(d28.getDate() - 28);
        const d7  = new Date(now); d7.setDate(d7.getDate() - 7);
        const recent28 = sessions.filter(s => new Date(s.date) >= d28);
        const recent7  = sessions.filter(s => new Date(s.date) >= d7);
        const load28 = recent28.reduce((s,x) => s + (x.load || x.rpe*(x.duration||60)), 0);
        const load7  = recent7.reduce((s,x) => s + (x.load || x.rpe*(x.duration||60)), 0);

        // Trend: compare last 7d avg RPE vs previous 7d
        const d14 = new Date(now); d14.setDate(d14.getDate() - 14);
        const prev7 = sessions.filter(s => new Date(s.date) >= d14 && new Date(s.date) < d7);
        const rpe7  = recent7.length  ? recent7.reduce((s,x)=>s+x.rpe,0)/recent7.length   : 0;
        const rpePrev = prev7.length  ? prev7.reduce((s,x)=>s+x.rpe,0)/prev7.length        : 0;
        const trend = rpe7 > 0 && rpePrev > 0 ? ((rpe7 - rpePrev) / rpePrev * 100) : 0;

        return {
            sessions:    sessions.length,
            sessions28:  recent28.length,
            avgRPE:      sessions.length ? sessions.reduce((s,x)=>s+x.rpe,0)/sessions.length : 0,
            rpe7,
            ratio:       parseFloat(ratio.ratio) || 0,
            totalLoad,
            load28,
            load7,
            avgLoad:     sessions.length ? totalLoad/sessions.length : 0,
            avgDuration: sessions.length ? sessions.reduce((s,x)=>s+(x.duration||60),0)/sessions.length : 0,
            trend,
        };
    }

    getTeamAvgStats() {
        if (!this.players.length) return { sessions:0, sessions28:0, avgRPE:0, rpe7:0, ratio:0, totalLoad:0, load28:0, load7:0, avgLoad:0, avgDuration:0, trend:0 };
        const all = this.players.map(p => this.getCompStats(p.id));
        const avg = key => all.reduce((s,x)=>s+(x[key]||0),0) / all.length;
        return {
            sessions:    Math.round(avg('sessions')),
            sessions28:  Math.round(avg('sessions28')),
            avgRPE:      avg('avgRPE'),
            rpe7:        avg('rpe7'),
            ratio:       avg('ratio'),
            totalLoad:   avg('totalLoad'),
            load28:      avg('load28'),
            load7:       avg('load7'),
            avgLoad:     avg('avgLoad'),
            avgDuration: avg('avgDuration'),
            trend:       avg('trend'),
        };
    }

    getWeeklyRPESeries(playerId) {
        const sessions = this.sessions.filter(s => s.playerId === playerId);
        const byWeek = {};
        sessions.forEach(s => {
            const d = new Date(s.date);
            const week = this.getWeekKey(d);
            if (!byWeek[week]) byWeek[week] = [];
            byWeek[week].push(s.rpe);
        });
        return Object.entries(byWeek)
            .map(([week, rpes]) => ({ week, rpe: rpes.reduce((a,b)=>a+b,0)/rpes.length }))
            .sort((a,b) => a.week.localeCompare(b.week))
            .slice(-10);
    }

    getTeamWeeklyRPESeries() {
        const byWeek = {};
        this.sessions.forEach(s => {
            const week = this.getWeekKey(new Date(s.date));
            if (!byWeek[week]) byWeek[week] = [];
            byWeek[week].push(s.rpe);
        });
        return Object.entries(byWeek)
            .map(([week, rpes]) => ({ week, rpe: rpes.reduce((a,b)=>a+b,0)/rpes.length }))
            .sort((a,b) => a.week.localeCompare(b.week))
            .slice(-10);
    }

    getWeekKey(date) {
        const d = new Date(date);
        d.setHours(0,0,0,0);
        d.setDate(d.getDate() - d.getDay() + 1); // Monday
        return d.toISOString().slice(0,10);
    }
}

// Initialize app — managed by auth.js
let rpeTracker;

// Basketball RPE Tracker - Progressive Web App with Advanced Analytics

class RPETracker {
    constructor() {
        this.sessions = this.loadSessions();
        this.players = this.loadPlayers();
        this.currentSessionId = null;
        this.currentView = 'sessions';
        this.currentPlayerFilter = 'all';
        this.currentTypeFilter = 'all';
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.renderPlayers();
        this.renderSessions();
        this.setDefaultDateTime();
        this.updateRPEDisplay(5);
        this.populatePlayerSelects();
        
        // Register service worker
        if ('serviceWorker' in navigator) {
            navigator.serviceWorker.register('sw.js');
        }
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
        document.getElementById('closeModal').addEventListener('click', () => this.closeModal('newSessionModal'));
        document.getElementById('cancelBtn').addEventListener('click', () => this.closeModal('newSessionModal'));
        document.getElementById('closeDetailModal').addEventListener('click', () => this.closeModal('detailModal'));
        document.getElementById('closeDetailBtn').addEventListener('click', () => this.closeModal('detailModal'));
        
        // Player modal controls
        document.getElementById('addPlayerBtn').addEventListener('click', () => this.openAddPlayerModal());
        document.getElementById('closePlayerModal').addEventListener('click', () => this.closeModal('addPlayerModal'));
        document.getElementById('cancelPlayerBtn').addEventListener('click', () => this.closeModal('addPlayerModal'));
        
        // Forms
        document.getElementById('sessionForm').addEventListener('submit', (e) => this.handleSessionSubmit(e));
        document.getElementById('playerForm').addEventListener('submit', (e) => this.handlePlayerSubmit(e));
        
        // RPE slider
        document.getElementById('rpeSlider').addEventListener('input', (e) => this.updateRPEDisplay(e.target.value));
        
        // Duration buttons
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('duration-btn')) {
                this.selectDuration(e.target.dataset.duration);
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
        this.showToast('✅ Jugadora añadida correctamente');
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
        this.showToast('🗑️ Jugadora eliminada');
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
                            <p class="player-meta">${playerSessions.length} sesiones registradas</p>
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
        
        document.getElementById('rpeValue').textContent = rpeValue;
        document.getElementById('rpeValue').style.color = color;
        document.getElementById('rpeLabel').textContent = label;
        
        const slider = document.getElementById('rpeSlider');
        slider.style.background = `linear-gradient(to right, ${color} 0%, ${color} ${rpeValue * 10}%, #ddd ${rpeValue * 10}%, #ddd 100%)`;
        
        this.updateRPEScale(rpeValue);
    }

    updateRPEScale(value) {
        const rpeBar = document.getElementById('rpeBar');
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
        
        document.getElementById('newSessionModal').classList.add('active');
        document.getElementById('sessionForm').reset();
        this.setDefaultDateTime();
        this.renderPlayerButtons();
        document.getElementById('rpeSlider').value = 5;
        this.updateRPEDisplay(5);
    }
    
    renderPlayerButtons() {
        const container = document.getElementById('playerButtons');
        if (!container) return;
        
        container.innerHTML = this.players.map(player => `
            <button type="button" class="player-btn" data-player-id="${player.id}" onclick="rpeTracker.selectPlayer('${player.id}')">
                <div class="player-btn-avatar">${player.name.charAt(0).toUpperCase()}</div>
                <div class="player-btn-name">${player.name}</div>
                ${player.number ? `<div class="player-btn-number">#${player.number}</div>` : ''}
            </button>
        `).join('');
    }
    
    selectPlayer(playerId) {
        // Remove previous selection
        document.querySelectorAll('.player-btn').forEach(btn => {
            btn.classList.remove('selected');
        });
        
        // Select new player
        const selectedBtn = document.querySelector(`[data-player-id="${playerId}"]`);
        if (selectedBtn) {
            selectedBtn.classList.add('selected');
        }
        
        // Set hidden input value
        document.getElementById('sessionPlayer').value = playerId;
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
        
        const playerId = document.getElementById('sessionPlayer').value;
        if (!playerId) {
            alert('⚠️ Debes seleccionar una jugadora');
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
        
        this.showToast('✅ Sesión guardada correctamente');
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
            this.showToast('🗑️ Sesión eliminada');
        }
    }

    // ========== DASHBOARD ==========
    
    renderDashboard() {
        const container = document.getElementById('dashboardContent');
        if (!container) return;
        
        const totalSessions = this.sessions.length;
        const totalPlayers = this.players.length;
        const avgRPE = totalSessions > 0 
            ? (this.sessions.reduce((sum, s) => sum + s.rpe, 0) / totalSessions).toFixed(1)
            : 0;
        
        const trainingCount = this.sessions.filter(s => s.type === 'training').length;
        const matchCount = this.sessions.filter(s => s.type === 'match').length;
        
        // Get last 7 days sessions
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recentSessions = this.sessions.filter(s => new Date(s.date) >= sevenDaysAgo);
        
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
                    <span class="stat-value" style="color: var(--success);">${recentSessions.length}</span>
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
        
        return this.players.map(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            
            return `
                <div class="ratio-card">
                    <div class="ratio-header">
                        <div>
                            <h3>${player.name}${player.number ? ` #${player.number}` : ''}</h3>
                        </div>
                        <div style="display: flex; align-items: center; gap: 1rem;">
                            <span class="ratio-value" style="color: ${this.getRatioColor(ratio.ratio)}">${ratio.ratio}</span>
                            <span class="ratio-indicator ${this.getRatioClass(ratio.ratio)}">${this.getRatioStatus(ratio.ratio)}</span>
                        </div>
                    </div>
                    <div class="ratio-details">
                        <div class="ratio-detail-item">
                            <span class="ratio-detail-value" style="color: var(--primary);">${ratio.acute.toFixed(0)}</span>
                            <span class="ratio-detail-label">EWMA Aguda (7d)</span>
                        </div>
                        <div class="ratio-detail-item">
                            <span class="ratio-detail-value" style="color: var(--secondary);">${ratio.chronic.toFixed(0)}</span>
                            <span class="ratio-detail-label">EWMA Crónica (28d)</span>
                        </div>
                        <div class="ratio-detail-item">
                            <span class="ratio-detail-value">${ratio.totalLoad7d}</span>
                            <span class="ratio-detail-label">Carga Total (7d)</span>
                        </div>
                        <div class="ratio-detail-item">
                            <span class="ratio-detail-value">${ratio.totalLoad21d}</span>
                            <span class="ratio-detail-label">Carga Total (28d)</span>
                        </div>
                        <div class="ratio-detail-item">
                            <span class="ratio-detail-value">${ratio.sessions7d}</span>
                            <span class="ratio-detail-label">Sesiones (7d)</span>
                        </div>
                        <div class="ratio-detail-item">
                            <span class="ratio-detail-value">${ratio.sessions21d}</span>
                            <span class="ratio-detail-label">Sesiones (28d)</span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
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
        
        // Render comparison chart after DOM update
        setTimeout(() => {
            this.renderComparisonChart();
        }, 100);
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
        // Carga inicial síncrona desde localStorage
        const stored = localStorage.getItem('basketballSessions');
        const sessions = stored ? JSON.parse(stored) : [];
        
        // Carga asíncrona desde Firebase
        if (window.firebaseSync) {
            window.firebaseSync.loadSessions().then(firebaseSessions => {
                if (firebaseSessions.length > 0) {
                    this.sessions = firebaseSessions;
                    this.renderSessions();
                }
            });
            
            // Escuchar cambios en tiempo real
            window.firebaseSync.onSessionsChange((updatedSessions) => {
                this.sessions = updatedSessions;
                this.renderSessions();
                console.log('🔄 Sesiones actualizadas desde Firebase');
            });
        }
        
        return sessions;
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
        // Carga inicial síncrona desde localStorage
        const stored = localStorage.getItem('basketballPlayers');
        const players = stored ? JSON.parse(stored) : [];
        
        // Carga asíncrona desde Firebase
        if (window.firebaseSync) {
            window.firebaseSync.loadPlayers().then(firebasePlayers => {
                if (firebasePlayers.length > 0) {
                    this.players = firebasePlayers;
                    this.renderPlayers();
                    this.populatePlayerSelects();
                }
            });
            
            // Escuchar cambios en tiempo real
            window.firebaseSync.onPlayersChange((updatedPlayers) => {
                this.players = updatedPlayers;
                this.renderPlayers();
                this.populatePlayerSelects();
                console.log('🔄 Jugadores actualizados desde Firebase');
            });
        }
        
        return players;
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

    showToast(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            bottom: 2rem;
            left: 50%;
            transform: translateX(-50%);
            background: #333;
            color: white;
            padding: 1rem 2rem;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 9999;
            animation: slideUp 0.3s;
        `;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
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
        
        this.showToast('📥 Datos exportados a CSV');
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
}

// Initialize app
let rpeTracker;
document.addEventListener('DOMContentLoaded', () => {
    rpeTracker = new RPETracker();
});

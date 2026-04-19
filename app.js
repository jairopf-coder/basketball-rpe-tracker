// ========== NAVEGACIÓN POR GRUPOS ==========

const NavMenu = {
    groups: {
        dashboard: { label: '📊 Inicio', direct: 'dashboard' },
        carga: {
            label: '🏋️ Carga',
            items: [
                { view: 'analytics', label: '📈 Análisis A:C' },
                { view: 'weekplan',  label: '📅 Planificación' },
                { view: 'sessions',  label: '📋 Historial' },
            ],
            default: 'analytics'
        },
        salud: {
            label: '❤️ Salud',
            items: [
                { view: 'wellness',    label: '❤️ Wellness' },
                { view: 'injury',      label: '🏥 Lesiones' },
                { view: 'rehab',       label: '💪 Readaptación' },
                { view: 'medical',     label: '📋 Historial médico' },
                { view: 'correlation', label: '📉 Correlación carga' },
                { view: 'prediction',  label: '🔮 Predicción lesiones' },
            ],
            default: 'wellness'
        },
        equipo: {
            label: '👥 Equipo',
            items: [
                { view: 'players',    label: '👥 Jugadoras' },
                { view: 'teamstatus', label: '🚦 Estado equipo' },
            ],
            default: 'players'
        },
        rendimiento: {
            label: '💪 Rendimiento',
            items: [
                { view: 'gym',   label: '🏋️ Gimnasio' },
                { view: 'tests', label: '📊 Tests' },
            ],
            default: 'gym'
        }
    },

    activeGroup: 'carga',
    activeView: 'dashboard',

    selectGroup(groupKey) {
        const group = this.groups[groupKey];
        if (!group) return;

        this.activeGroup = groupKey;

        // Update group buttons
        document.querySelectorAll('.nav-group-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.group === groupKey);
        });

        // Direct view (no submenu)
        if (group.direct) {
            this.hideSubBar();
            if (window.rpeTracker) window.rpeTracker.switchView(group.direct);
            this.activeView = group.direct;
            return;
        }

        // Show submenu
        this.renderSubBar(groupKey);

        // Navigate to last active view in this group, or default
        const target = group.items.find(i => i.view === this.activeView)
            ? this.activeView
            : group.default;
        this.selectView(target);
    },

    selectView(viewKey) {
        this.activeView = viewKey;

        // Update sub buttons
        document.querySelectorAll('.nav-sub-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === viewKey);
        });

        if (window.rpeTracker) window.rpeTracker.switchView(viewKey);
    },

    renderSubBar(groupKey) {
        const group = this.groups[groupKey];
        const bar = document.getElementById('navSubBar');
        if (!bar || !group.items) return;

        bar.style.display = 'flex';
        bar.innerHTML = group.items.map(item => `
            <button class="nav-sub-btn ${item.view === this.activeView ? 'active' : ''}"
                data-view="${item.view}"
                onclick="NavMenu.selectView('${item.view}')">
                ${item.label}
            </button>`).join('');
    },

    hideSubBar() {
        const bar = document.getElementById('navSubBar');
        if (bar) bar.style.display = 'none';
    },

    // Call this to highlight the correct group/sub when switchView is called programmatically
    syncToView(viewKey) {
        for (const [groupKey, group] of Object.entries(this.groups)) {
            if (group.direct === viewKey) {
                this.activeGroup = groupKey;
                this.activeView = viewKey;
                document.querySelectorAll('.nav-group-btn').forEach(b =>
                    b.classList.toggle('active', b.dataset.group === groupKey));
                this.hideSubBar();
                return;
            }
            if (group.items?.find(i => i.view === viewKey)) {
                this.activeGroup = groupKey;
                this.activeView = viewKey;
                document.querySelectorAll('.nav-group-btn').forEach(b =>
                    b.classList.toggle('active', b.dataset.group === groupKey));
                this.renderSubBar(groupKey);
                document.querySelectorAll('.nav-sub-btn').forEach(b =>
                    b.classList.toggle('active', b.dataset.view === viewKey));
                return;
            }
        }
    }
};

// ========== PLAYER TOKEN COLOR SYSTEM ==========

const PlayerTokens = {
    PALETTE: [
        '#ff6600', // orange  (primary)
        '#0066ff', // blue    (secondary)
        '#9c27b0', // purple
        '#00bcd4', // cyan
        '#e91e63', // pink
        '#4caf50', // green
        '#ff9800', // amber
        '#795548', // brown
        '#607d8b', // blue-grey
        '#f44336', // red
        '#009688', // teal
        '#673ab7', // deep-purple
    ],

    /** Return a color for a player, assigning one if they don't have one yet */
    get(player) {
        if (player.color) return player.color;
        // fallback: derive from index in global player list
        const tracker = window.rpeTracker;
        if (tracker) {
            const idx = tracker.players.findIndex(p => p.id === player.id);
            return this.PALETTE[(idx >= 0 ? idx : 0) % this.PALETTE.length];
        }
        return this.PALETTE[0];
    },

    /** Assign a color to a player if they don't have one (mutates player object) */
    assign(player, allPlayers) {
        if (!player.color) {
            const idx = allPlayers ? allPlayers.findIndex(p => p.id === player.id) : 0;
            player.color = this.PALETTE[(idx >= 0 ? idx : 0) % this.PALETTE.length];
        }
        return player.color;
    },

    /** Render an avatar div with the correct token color inline style */
    avatar(player, sizePx = 40, fontSize = '1rem', extraClass = '') {
        const color = this.get(player);
        const initials = this._initials(player.name);
        return `<div class="player-token-avatar ${extraClass}" style="width:${sizePx}px;height:${sizePx}px;font-size:${fontSize};background:${color}" title="${player.name}">${initials}</div>`;
    },

    /** CSS inline style string to set --player-token on a parent element */
    tokenStyle(player) {
        return `--player-token: ${this.get(player)}`;
    },

    _initials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
        return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
    }
};

// ========== DARK MODE ==========

const DarkMode = {
    KEY: 'rpe_dark_mode',

    init() {
        const saved = localStorage.getItem(this.KEY);
        const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches;
        const enabled = saved !== null ? saved === 'true' : prefersDark;
        this.apply(enabled);
    },

    toggle() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        this.apply(!isDark);
    },

    apply(dark) {
        document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
        localStorage.setItem(this.KEY, String(dark));
        // Update button icon
        const btn = document.getElementById('darkModeBtn');
        if (btn) btn.textContent = dark ? '☀️' : '🌙';
    },

    isDark() {
        return document.documentElement.getAttribute('data-theme') === 'dark';
    }
};

// ========== GLOBAL AVATAR HELPER ==========
// Exposed so other modules (team-status, injury, etc.) can use it
window.PlayerTokens = PlayerTokens;

// Basketball RPE Tracker - Progressive Web App with Advanced Analytics

class RPETracker {
    constructor() {
        this.sessions = this.loadSessions();
        this.players = this.loadPlayers();
        this.currentSessionId = null;
        this.currentView = 'dashboard';
        this.currentPlayerFilter = 'all';
        this.currentTypeFilter = 'all';
        this.calendarYear = new Date().getFullYear();
        this.calendarMonth = new Date().getMonth();
        this.injuries = [];
        this.availability = {};
        this.weekPlan = null;
        this.exerciseLibrary = null; // se carga lazy en strength.js
        this.gymSessions     = null;
        this.testSessions    = null;
        this.init();
    }

    init() {
        // Init dark mode first (before any render)
        DarkMode.init();

        // Ensure every player has a token color assigned
        this._ensurePlayerColors();

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
            navigator.serviceWorker.register('sw.js').then(reg => {
                // Check for updates on every page load
                reg.update().catch(() => {});
            }).catch(err => {
                console.warn('SW registration failed:', err);
            });
        }

        // Show skeleton while Firebase loads
        this.showSkeletonLoader();

        // Activate dashboard on init
        NavMenu.selectGroup('dashboard');
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
        document.getElementById('exportPDFBtn')?.addEventListener('click', () => this.exportSessionsHistoryPDF());
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

        // Weekly planning — toggle slot checkbox
        document.addEventListener('change', (e) => {
            const el = e.target;
            if (el.dataset.action === 'toggleSlot') {
                if (typeof this.togglePlanSlot === 'function') {
                    this.togglePlanSlot(+el.dataset.day, +el.dataset.slot, el.checked);
                }
            }
            if (el.dataset.action === 'updateSlot') {
                if (typeof this.updatePlanSlot === 'function') {
                    const val = el.dataset.field === 'targetDuration' || el.dataset.field === 'targetRPE'
                        ? +el.value : el.value;
                    this.updatePlanSlot(+el.dataset.day, +el.dataset.slot, el.dataset.field, val);
                }
            }
        });

        // Weekly planning — range input (fires oninput, not onchange)
        document.addEventListener('input', (e) => {
            const el = e.target;
            if (el.dataset.action === 'updateSlot' && el.type === 'range') {
                if (typeof this.updatePlanSlot === 'function') {
                    this.updatePlanSlot(+el.dataset.day, +el.dataset.slot, el.dataset.field, +el.value);
                }
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
                    this.closeModal(modal.id);
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

        // Sync grouped nav
        if (typeof NavMenu !== 'undefined') NavMenu.syncToView(viewName);
        
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
                setTimeout(() => this.renderComparisonModule(), 50);
                // checkAndShowAlerts se mantiene pero el contenedor está oculto
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
            case 'gym':
                if (typeof this.renderGymView === 'function') this.renderGymView();
                break;
            case 'tests':
                if (typeof this.renderTestsView === 'function') this.renderTestsView();
                break;
        }
    }

    // ========== PLAYERS MANAGEMENT ==========
    
    openAddPlayerModal() {
        document.getElementById('addPlayerModal').classList.add('active');
        document.getElementById('playerForm').reset();
        // Pre-select next available color
        const usedColors = this.players.map(p => p.color).filter(Boolean);
        const defaultColor = PlayerTokens.PALETTE.find(c => !usedColors.includes(c)) || PlayerTokens.PALETTE[0];
        this._renderColorPicker('playerColorPicker', 'playerColor', defaultColor);
    }

    handlePlayerSubmit(e) {
        e.preventDefault();

        const chosenColor = document.getElementById('playerColor').value;
        const usedColors = this.players.map(p => p.color).filter(Boolean);
        const fallback = PlayerTokens.PALETTE.find(c => !usedColors.includes(c)) || PlayerTokens.PALETTE[this.players.length % PlayerTokens.PALETTE.length];

        const player = {
            id: Date.now().toString(),
            name: document.getElementById('playerName').value,
            number: document.getElementById('playerNumber').value || null,
            color: chosenColor || fallback,
            createdAt: new Date().toISOString()
        };

        this.players.push(player);
        this.savePlayers();
        this.renderPlayers();
        this.populatePlayerSelects();
        this.closeModal('addPlayerModal');
        this.showToast('✅ Jugadora añadida correctamente', 'success');
    }

    /** Ensure every existing player has a color token (migration for old data) */
    _ensurePlayerColors() {
        let changed = false;
        this.players.forEach((player, idx) => {
            if (!player.color) {
                player.color = PlayerTokens.PALETTE[idx % PlayerTokens.PALETTE.length];
                changed = true;
            }
        });
        if (changed) this.savePlayers();
    }

    /** Render an interactive color picker into a container element.
     *  @param {string} containerId  - id of the .token-color-picker div
     *  @param {string} hiddenInputId - id of the <input type="hidden"> that stores the value
     *  @param {string} selectedColor - color to pre-select
     */
    _renderColorPicker(containerId, hiddenInputId, selectedColor) {
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
    }

    selectAllPlayers() {
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
    }

    updateIndividualRPE(playerId, value) {
        const val = parseInt(value);
        const valEl = document.getElementById(`rpeVal-${playerId}`);
        const lblEl = document.getElementById(`rpeLbl-${playerId}`);
        if (valEl) { valEl.textContent = val; valEl.style.color = this.getRPEColor(val); }
        if (lblEl) lblEl.textContent = this.getRPELabel(val);
    }

    selectRPEButton(playerId, value) {
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
                notes
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
            const icon = isNaN(r) ? '' : r > 1.5 ? '🔴' : r > 1.3 ? '🟠' : r < 0.8 ? '🔵' : '🟢';
            const rLabel = ratio.ratio === 'N/A' ? '' : ` · Ratio A:C: ${ratio.ratio} ${icon}`;
            this.showToast(`✅ Sesión guardada${rLabel}`, 'success');
        } else {
            this.showToast(`✅ ${n} sesiones guardadas`, 'success');
        }

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
        // Guard: confirm if the new-session modal has players selected or step 2 is active
        if (modalId === 'newSessionModal') {
            const step2 = document.getElementById('sessionStep2');
            const hasPlayers = (this.selectedPlayerIds || []).length > 0;
            const inStep2 = step2 && step2.style.display !== 'none';
            if (hasPlayers || inStep2) {
                if (!confirm('¿Salir sin guardar la sesión?')) return;
            }
            this.selectedPlayerIds = [];
        }
        document.getElementById(modalId)?.classList.remove('active');
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
    }

    showSessionDetail(id) {
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
            if (r > 1.5) return '🔴';
            if (r > 1.3) return '🟠';
            if (r < 0.8) return '🔵';
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
                <div class="detail-notes">${session.notes}</div>
            ` : '<div class="detail-notes" style="font-style: italic; color: var(--text-faint);">Sin incidencias registradas</div>'}
            ${playerSessions.length >= 2 ? `
            <div class="detail-rpe-hist-section">
                <div class="detail-rpe-hist-title">📊 Distribución RPE — historial de ${playerName}</div>
                <canvas id="rpeHistogramCanvas" class="detail-rpe-hist-canvas"></canvas>
            </div>` : ''}
        `;
        
        document.getElementById('detailModal').classList.add('active');

        // Render RPE histogram after modal is in DOM
        if (playerSessions.length >= 2) {
            requestAnimationFrame(() => this._renderRPEHistogram(playerSessions, session.rpe));
        }
    }

    _renderRPEHistogram(playerSessions, currentRpe) {
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

        // Stats
        const totalSessions = this.countUniqueSessions(this.sessions);
        const trainingCount = this.countUniqueSessions(this.sessions.filter(s => s.type === 'training'));
        const matchCount    = this.countUniqueSessions(this.sessions.filter(s => s.type === 'match'));
        const avgRPE = this.sessions.length > 0
            ? (this.sessions.reduce((sum, s) => sum + s.rpe, 0) / this.sessions.length).toFixed(1) : '—';
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const recent7 = this.sessions.filter(s => new Date(s.date) >= sevenDaysAgo);
        const recentUnique = this.countUniqueSessions(recent7);
        const avgRPE7 = recent7.length > 0
            ? (recent7.reduce((s, x) => s + x.rpe, 0) / recent7.length).toFixed(1) : '—';

        // Active injuries
        const activeInjuries = (this.injuries || []).filter(i => i.status === 'active').length;

        // Wellness chips — jugadoras sin registro hoy
        const _wToday = new Date().toISOString().slice(0, 10);
        const _wData  = this.wellnessData || [];
        const _pendingW = this.players.filter(p => !(_wData).some(e => e.playerId === p.id && e.date === _wToday));
        const wellnessChips = this.players.length === 0 ? '' :
            _pendingW.length === 0
                ? `<div class="db-w-all-ok">✅ Todas registradas hoy</div>`
                : _pendingW.map(p => `<button class="db-w-chip" onclick="NavMenu.selectGroup('salud')" title="${p.name}">${PlayerTokens.avatar(p,16,'0.5rem')}<span>${p.name.split(' ')[0]}</span></button>`).join('');

        // Sort order — persisted on instance
        if (!this._dashSort) this._dashSort = 'risk'; // 'risk' | 'safe' | 'name'

        // Build player data
        const getStatus = (r) => {
            const n = parseFloat(r);
            if (isNaN(n) || r === 'N/A') return { icon: '—', color: '#ccc', risk: -1 };
            if (n > 1.5)  return { icon: '🔴', color: '#f44336', risk: 4 };
            if (n > 1.3)  return { icon: '🟠', color: '#ff9800', risk: 3 };
            if (n < 0.8)  return { icon: '🔵', color: '#2196f3', risk: 1 };
            return           { icon: '🟢', color: '#4caf50', risk: 2 };
        };

        let players = this.players.map(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const st = getStatus(ratio.ratio);
            return { player, ratio, st, r: parseFloat(ratio.ratio) || 0 };
        });

        if (this._dashSort === 'risk')  players.sort((a, b) => b.st.risk - a.st.risk || b.r - a.r);
        if (this._dashSort === 'safe')  players.sort((a, b) => a.st.risk - b.st.risk || a.r - b.r);
        if (this._dashSort === 'name')  players.sort((a, b) => a.player.name.localeCompare(b.player.name));

        const sortLabel = { risk: '↓ Mayor riesgo', safe: '↑ Menor riesgo', name: 'A–Z' };
        const nextSort  = { risk: 'safe', safe: 'name', name: 'risk' };

        const playerRows = players.map(({ player, ratio, st, r }) => {
            const barW = Math.min(r / 2 * 100, 100).toFixed(0);
            return `
                <div class="db-player-row">
                    ${PlayerTokens.avatar(player, 20, '0.6rem')}
                    <div class="db-player-name">${player.name}${player.number ? `<span class="db-num">#${player.number}</span>` : ''}</div>
                    <div class="db-player-bar">
                        <div class="db-bar-fill" style="width:${barW}%;background:${st.color}"></div>
                        <div class="db-bar-lo"></div>
                        <div class="db-bar-hi"></div>
                    </div>
                    <div class="db-player-ratio" style="color:${st.color}">${ratio.ratio === 'N/A' ? '—' : ratio.ratio}</div>
                    <div class="db-player-icon">${st.icon}</div>
                </div>`;
        }).join('');

        // Availability groups (same logic as renderTeamStatus)
        const availGroups = { ok: [], caution: [], out: [] };
        this.players.forEach(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const r = parseFloat(ratio.ratio);
            const activeInjury = (this.injuries || []).find(i => i.playerId === player.id && i.status === 'active');
            const playerSessions = this.sessions.filter(s => s.playerId === player.id);
            const last7 = playerSessions.filter(s => (new Date() - new Date(s.date)) / 86400000 <= 7);
            const avgRPE7 = last7.length ? (last7.reduce((s, x) => s + x.rpe, 0) / last7.length).toFixed(1) : null;
            const entry = { player, ratio, r, activeInjury, avgRPE7 };
            if (activeInjury)                        availGroups.out.push(entry);
            else if (r > 1.5 || (r > 0 && r < 0.8)) availGroups.caution.push(entry);
            else                                      availGroups.ok.push(entry);
        });

        const availRow = ({ player, activeInjury, avgRPE7, r, ratio }) => {
            let icon, color, detail;
            if (activeInjury) {
                icon = '🔴'; color = '#f44336';
                detail = activeInjury.location ? this.getLocationName(activeInjury.location) : 'lesión activa';
            } else if (r > 1.5) {
                icon = '🟠'; color = '#ff9800'; detail = `Ratio ${ratio.ratio}`;
            } else if (r > 0 && r < 0.8) {
                icon = '🔵'; color = '#2196f3'; detail = `Ratio ${ratio.ratio}`;
            } else {
                icon = '🟢'; color = '#4caf50'; detail = avgRPE7 ? `RPE 7d: ${avgRPE7}` : 'Sin datos';
            }
            return `
                <div class="db-avail-row">
                    <span class="db-avail-icon">${icon}</span>
                    ${PlayerTokens.avatar(player, 22, '0.65rem')}
                    <span class="db-avail-name">${player.name}${player.number ? `<span class="db-num">#${player.number}</span>` : ''}</span>
                    <span class="db-avail-detail" style="color:${color}">${detail}</span>
                </div>`;
        };

        const availSection = (title, entries, emptyMsg) =>
            entries.length === 0 ? '' : `
                <div class="db-avail-section">
                    <div class="db-avail-section-title">${title} <span class="db-avail-count">${entries.length}</span></div>
                    ${entries.map(availRow).join('')}
                </div>`;

        // ── Alert banner data ──────────────────────────────────────
        const alertPlayers = players.filter(p => parseFloat(p.ratio.ratio) > 1.5);
        const warnPlayers  = players.filter(p => { const r = parseFloat(p.ratio.ratio); return r >= 1.3 && r <= 1.5; });
        const pendingWellness = _pendingW.length;

        let bannerHTML = '';
        if (alertPlayers.length > 0 || warnPlayers.length > 0 || pendingWellness > 0) {
            const items = [];
            if (alertPlayers.length)  items.push(`🔴 <strong>${alertPlayers.map(p=>p.player.name.split(' ')[0]).join(', ')}</strong> con ratio en zona de peligro`);
            if (warnPlayers.length)   items.push(`🟠 <strong>${warnPlayers.map(p=>p.player.name.split(' ')[0]).join(', ')}</strong> en precaución`);
            if (pendingWellness > 0)  items.push(`📋 <strong>${pendingWellness} jugadora${pendingWellness>1?'s':''}</strong> sin wellness hoy`);
            bannerHTML = `<div class="db-alert-banner">
                ${items.map(i=>`<div class="db-alert-item">${i}</div>`).join('<div class="db-alert-sep">·</div>')}
                ${pendingWellness > 0 ? `<button class="db-alert-btn" onclick="window.rpeTracker?.openWellnessBulk()">✏️ Pase rápido</button>` : ''}
            </div>`;
        }

        // ── Match-day mode ─────────────────────────────────────────
        const todayKey = ['dom','lun','mar','mie','jue','vie','sab'][new Date().getDay()];
        const todayPlan = this.weekPlan?.days?.[todayKey] || {};
        const isMatchDay = ['morning','afternoon'].some(s => todayPlan[s]?.type === 'match' && todayPlan[s]?.enabled);
        const matchDayBtnLabel = this._matchDayMode ? '← Vista normal' : '🏟️ Modo partido';

        container.innerHTML = `
            ${bannerHTML}
            ${isMatchDay || this._matchDayMode ? `
            <div class="db-matchday-bar">
                <span class="db-matchday-badge">🏟️ DÍA DE PARTIDO</span>
                <button class="db-matchday-toggle" onclick="window.rpeTracker?._toggleMatchDayMode()">${matchDayBtnLabel}</button>
            </div>` : ''}
            ${this._matchDayMode ? this._renderMatchDayView(availGroups, players) : `
            <div class="db-split">

                <!-- Columna izquierda: métricas -->
                <div class="db-left">
                    <!-- Wellness rápido -->
                    ${this.players.length > 0 ? `<div class="db-left-section">
                        <div class="db-left-label">Wellness hoy <button class="db-w-link" onclick="NavMenu.selectGroup('salud')">ver →</button></div>
                        <div class="db-w-chips">${wellnessChips}</div>
                    </div>` : ''}
                    <!-- Batch 3: team load sparkline -->
                    <div class="db-left-section">
                        <div class="db-left-label">Carga equipo 7d</div>
                        <canvas id="teamSparklineCanvas" class="db-team-sparkline" width="200" height="70"></canvas>
                    </div>
                    <div class="db-left-section">
                        <div class="db-left-label">Esta semana</div>
                        <div class="db-metric-row">
                            <span class="db-metric-lbl">Sesiones</span>
                            <span class="db-metric-val">${recentUnique}</span>
                        </div>
                        <div class="db-metric-row">
                            <span class="db-metric-lbl">RPE medio</span>
                            <span class="db-metric-val" style="color:#ff9800">${avgRPE7}</span>
                        </div>
                        <div class="db-metric-row">
                            <span class="db-metric-lbl">Entrenos</span>
                            <span class="db-metric-val">${trainingCount}</span>
                        </div>
                        <div class="db-metric-row">
                            <span class="db-metric-lbl">Partidos</span>
                            <span class="db-metric-val">${matchCount}</span>
                        </div>
                    </div>
                    <div class="db-left-section">
                        <div class="db-left-label">Temporada</div>
                        <div class="db-metric-row">
                            <span class="db-metric-lbl">Total sesiones</span>
                            <span class="db-metric-val">${totalSessions}</span>
                        </div>
                        <div class="db-metric-row">
                            <span class="db-metric-lbl">RPE medio global</span>
                            <span class="db-metric-val">${avgRPE}</span>
                        </div>
                        <div class="db-metric-row">
                            <span class="db-metric-lbl">Jugadoras</span>
                            <span class="db-metric-val">${this.players.length}</span>
                        </div>
                        ${activeInjuries > 0 ? `
                        <div class="db-metric-row">
                            <span class="db-metric-lbl">Lesionadas</span>
                            <span class="db-metric-val" style="color:#f44336">${activeInjuries}</span>
                        </div>` : ''}
                    </div>
                </div>

                <!-- Columna derecha: ratio jugadoras -->
                <div class="db-right">
                    <div class="db-right-header">
                        <span class="db-right-label">Ratio A:C</span>
                        <button class="db-sort-btn" onclick="window.rpeTracker?.cycleDashSort()">
                            ${sortLabel[this._dashSort]}
                        </button>
                    </div>
                    <div class="db-right-legend">
                        <span style="color:#4caf50">● óptimo</span>
                        <span style="color:#ff9800">● precaución</span>
                        <span style="color:#f44336">● peligro</span>
                        <span style="color:#2196f3">● bajo</span>
                    </div>
                    <div class="db-players">
                        ${this.players.length > 0 ? playerRows : '<div class="db-empty">Sin jugadoras</div>'}
                    </div>
                </div>

                <!-- Columna disponibilidad -->
                <div class="db-cal" id="dbCalColumn">
                    <!-- filled by renderDashboardCalendar() -->
                </div>

                <!-- Columna disponibilidad -->
                <div class="db-avail">
                    <div class="db-right-header">
                        <span class="db-right-label">Disponibilidad</span>
                        <button class="db-sort-btn" onclick="window.rpeTracker?.generateTeamStatusPDF()" title="Generar informe PDF">
                            📄 Informe PDF
                        </button>
                    </div>
                    <div class="db-avail-summary">
                        <div class="db-avail-pill db-avail-ok">${availGroups.ok.length} <span>aptas</span></div>
                        <div class="db-avail-pill db-avail-caution">${availGroups.caution.length} <span>precaución</span></div>
                        <div class="db-avail-pill db-avail-out">${availGroups.out.length} <span>no disp.</span></div>
                    </div>
                    <div class="db-avail-list">
                        ${this.players.length === 0
                            ? '<div class="db-empty">Sin jugadoras</div>'
                            : availSection('Precaución', availGroups.caution, '') +
                              availSection('No disponibles', availGroups.out, '') +
                              availSection('Disponibles', availGroups.ok, '')}
                    </div>
                </div>

            </div>
            `}
        `;

        // Draw team load 7d chart with day labels
        requestAnimationFrame(() => {
            const canvas = document.getElementById('teamSparklineCanvas');
            if (canvas) {
                if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }
                const now = new Date();
                const teamData = [];
                const dayLabels = [];
                const DAY_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
                for (let d = 6; d >= 0; d--) {
                    const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - d); dayStart.setHours(0,0,0,0);
                    const dayEnd   = new Date(dayStart); dayEnd.setHours(23,59,59,999);
                    const dayLoad  = this.sessions
                        .filter(s => { const sd = new Date(s.date); return sd >= dayStart && sd <= dayEnd; })
                        .reduce((sum, s) => sum + (s.load || s.rpe * (s.duration || 60)), 0);
                    teamData.push(dayLoad);
                    const isToday = d === 0;
                    dayLabels.push(isToday ? 'Hoy' : DAY_SHORT[dayStart.getDay()]);
                }
                const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
                const textCol = isDark ? '#888' : '#999';
                const gridCol = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                canvas._chartInstance = new Chart(canvas.getContext('2d'), {
                    type: 'bar',
                    data: {
                        labels: dayLabels,
                        datasets: [{
                            data: teamData,
                            backgroundColor: teamData.map((_, i) =>
                                i === 6 ? '#ff6600' : 'rgba(255,102,0,0.35)'),
                            borderRadius: 3,
                            borderSkipped: false,
                        }]
                    },
                    options: {
                        responsive: false,
                        animation: false,
                        plugins: { legend: { display: false }, tooltip: {
                            callbacks: { label: ctx => `Carga: ${ctx.raw}` }
                        }},
                        scales: {
                            x: { ticks: { color: textCol, font: { size: 9 } }, grid: { display: false } },
                            y: { display: false, beginAtZero: true }
                        }
                    }
                });
            }
            // nav alert badge
            this._updateNavAlertBadge();
            // Render mini calendar column
            this.renderDashboardCalendar();
        });
    }

    _toggleMatchDayMode() {
        this._matchDayMode = !this._matchDayMode;
        this.renderDashboard();
    }

    _renderMatchDayView(availGroups, players) {
        const today  = new Date().toISOString().slice(0, 10);
        const wData  = this.wellnessData || [];

        const playerCard = ({ player, ratio, icon, r }) => {
            const w      = wData.find(e => e.playerId === player.id && e.date === today);
            const wScore = w ? this._wOverall(w) : null;
            const wColor = wScore ? this._wColor(wScore) : '#aaa';
            const rColor = this.getRatioColor(ratio.ratio);
            const inj    = (this.injuries||[]).find(i => i.playerId === player.id && i.status === 'active');
            return `<div class="md-card ${inj ? 'md-card--out' : r > 1.5 ? 'md-card--danger' : r >= 1.3 ? 'md-card--warn' : ''}">
                <div class="md-card-top">
                    ${PlayerTokens.avatar(player, 30, '0.75rem')}
                    <div class="md-card-name">${player.name}${player.number ? `<span class="db-num"> #${player.number}</span>` : ''}</div>
                    <span class="md-card-icon">${icon}</span>
                </div>
                <div class="md-card-row">
                    <span class="md-lbl">Ratio</span>
                    <span class="md-val" style="color:${rColor}">${ratio.ratio === 'N/A' ? '—' : ratio.ratio}</span>
                </div>
                <div class="md-card-row">
                    <span class="md-lbl">Wellness</span>
                    <span class="md-val" style="color:${wColor}">${wScore !== null ? wScore.toFixed(1) : '—'}</span>
                </div>
                ${inj ? `<div class="md-card-inj">🚑 ${this.getLocationName?.(inj.location)||'Lesión activa'}</div>` : ''}
            </div>`;
        };

        const okCards  = availGroups.ok.map(e =>
            playerCard({ player: e.player, ratio: e.ratio, icon: '🟢', r: e.r })).join('');
        const warnCards = availGroups.caution.map(e =>
            playerCard({ player: e.player, ratio: e.ratio, icon: e.r > 1.5 ? '🔴' : '🔵', r: e.r })).join('');
        const outCards = availGroups.out.map(e =>
            playerCard({ player: e.player, ratio: e.ratio, icon: '🔴', r: e.r })).join('');

        const todayW = wData.filter(e => e.date === today);
        const avgW   = todayW.length
            ? (todayW.reduce((s,e) => s + this._wOverall(e), 0) / todayW.length).toFixed(1) : '—';
        const atRisk = players.filter(p => parseFloat(p.ratio.ratio) > 1.5).length;

        return `<div class="md-wrap">
            <div class="md-summary">
                <div class="md-pill"><span class="md-pill-val">${availGroups.ok.length}</span><span class="md-pill-lbl">Disponibles</span></div>
                <div class="md-pill md-pill--warn"><span class="md-pill-val">${availGroups.caution.length}</span><span class="md-pill-lbl">Precaución</span></div>
                <div class="md-pill md-pill--out"><span class="md-pill-val">${availGroups.out.length}</span><span class="md-pill-lbl">No disp.</span></div>
                <div class="md-pill"><span class="md-pill-val">${avgW}</span><span class="md-pill-lbl">Wellness</span></div>
                <div class="md-pill ${atRisk > 0 ? 'md-pill--danger' : ''}"><span class="md-pill-val">${atRisk}</span><span class="md-pill-lbl">Riesgo alto</span></div>
            </div>
            ${warnCards || outCards ? `
                <div class="md-section">⚠️ Requieren atención</div>
                <div class="md-grid">${warnCards}${outCards}</div>` : ''}
            <div class="md-section">✅ Disponibles para el partido</div>
            <div class="md-grid">${okCards || '<p class="db-empty">Sin jugadoras disponibles</p>'}</div>
        </div>`;
    }

    cycleDashSort() {
        const next = { risk: 'safe', safe: 'name', name: 'risk' };
        this._dashSort = next[this._dashSort] || 'risk';
        this.renderDashboard();
    }

    // ── Dashboard Mini Calendar ────────────────────────────────────────────
    renderDashboardCalendar() {
        const col = document.getElementById('dbCalColumn');
        if (!col) return;

        // Init state
        if (!this._dbCal) {
            const now = new Date();
            this._dbCal = { mode: 'month', year: now.getFullYear(), month: now.getMonth(), weekOffset: 0 };
        }

        const { mode, year, month, weekOffset } = this._dbCal;

        // Color map by session type
        const typeColor = {
            training: '#2196f3',
            match:    '#f44336',
            recovery: '#4caf50',
            shooting: '#9c27b0',
            gym:      '#795548',
            rest:     '#bdbdbd'
        };
        const typeIcon = {
            training: '🏀',
            match:    '🏟️',
            recovery: '💪',
            shooting: '🎯',
            gym:      '🏋️',
            rest:     '—'
        };
        const typeLabel = {
            training: 'Entreno',
            match:    'Partido',
            recovery: 'Recuperación',
            shooting: 'Tiro',
            gym:      'Gym',
            rest:     'Descanso'
        };

        // Build a map: dateStr → [{type, source:'real'|'plan'}]
        const eventMap = {};

        const addEvent = (dateStr, type, source) => {
            if (!eventMap[dateStr]) eventMap[dateStr] = [];
            eventMap[dateStr].push({ type, source });
        };

        // Real sessions (unique dates with dominant type)
        this.sessions.forEach(s => {
            if (s.date) addEvent(s.date, s.type || 'training', 'real');
        });

        // WeekPlan events — expand the current plan across ±8 weeks from today
        if (this.weekPlan && this.weekPlan.days) {
            const dayKeys   = ['lun','mar','mie','jue','vie','sab','dom'];
            // JS getDay(): 0=Sun,1=Mon... we want Mon=0
            const now = new Date();
            const todayDow = (now.getDay() + 6) % 7; // 0=Mon
            // Find Monday of this week
            const monday = new Date(now);
            monday.setDate(now.getDate() - todayDow);
            monday.setHours(0,0,0,0);

            for (let wOff = -4; wOff <= 8; wOff++) {
                dayKeys.forEach((key, idx) => {
                    const dayData = this.weekPlan.days[key];
                    if (!dayData) return;
                    const d = new Date(monday);
                    d.setDate(monday.getDate() + wOff * 7 + idx);
                    const dateStr = d.toISOString().slice(0, 10);
                    // Only add planned events if no real sessions exist for that date
                    ['morning','afternoon'].forEach(slot => {
                        const s = dayData[slot];
                        if (s && s.enabled && s.type && s.type !== 'rest') {
                            addEvent(dateStr, s.type, 'plan');
                        }
                    });
                });
            }
        }

        // Nav label
        const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                            'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

        let navLabel = '';
        if (mode === 'month') {
            navLabel = `${monthNames[month]} ${year}`;
        } else {
            // Weekly: find Mon of offset week
            const now2 = new Date();
            const todayDow2 = (now2.getDay() + 6) % 7;
            const mon = new Date(now2);
            mon.setDate(now2.getDate() - todayDow2 + weekOffset * 7);
            const sun = new Date(mon);
            sun.setDate(mon.getDate() + 6);
            navLabel = `${mon.getDate()} – ${sun.getDate()} ${monthNames[sun.getMonth()]}`;
        }

        // Build content
        let bodyHTML = '';

        if (mode === 'month') {
            const firstDay = new Date(year, month, 1);
            const daysInMonth = new Date(year, month + 1, 0).getDate();
            // start on Monday: JS getDay 0=Sun → convert to Mon-based
            let startDow = (firstDay.getDay() + 6) % 7; // 0=Mon
            const today = new Date().toISOString().slice(0, 10);

            bodyHTML += `<div class="db-mini-cal">
                <div class="db-mini-cal-grid">
                    <div class="db-mini-cal-dow">L</div>
                    <div class="db-mini-cal-dow">M</div>
                    <div class="db-mini-cal-dow">X</div>
                    <div class="db-mini-cal-dow">J</div>
                    <div class="db-mini-cal-dow">V</div>
                    <div class="db-mini-cal-dow">S</div>
                    <div class="db-mini-cal-dow">D</div>`;

            // Empty cells before first day
            for (let i = 0; i < startDow; i++) {
                bodyHTML += `<div class="db-mini-day empty"></div>`;
            }

            for (let d = 1; d <= daysInMonth; d++) {
                const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const isToday = dateStr === today;
                const events  = eventMap[dateStr] || [];

                // Dominant event for this day (real > plan, match > training > rest)
                const realEvents = events.filter(e => e.source === 'real');
                const planEvents = events.filter(e => e.source === 'plan');
                const dominant  = realEvents.length ? realEvents : planEvents;
                const hasMatch  = dominant.some(e => e.type === 'match');
                const topType   = hasMatch ? 'match' : (dominant[0]?.type || null);

                let dotHTML = '';
                if (topType) {
                    const isReal = realEvents.length > 0;
                    const color  = typeColor[topType] || '#ccc';
                    dotHTML = `<div class="db-mini-day-dot" style="background:${color};opacity:${isReal ? 1 : 0.45};"></div>`;
                    // Second dot if two different types on same day
                    const types = [...new Set(dominant.map(e => e.type))];
                    if (types.length > 1) {
                        const second = types.find(t => t !== topType);
                        if (second) dotHTML += `<div class="db-mini-day-dot" style="background:${typeColor[second]||'#ccc'};opacity:${isReal?1:0.45};"></div>`;
                    }
                }

                const hasBg   = topType && topType !== 'rest';
                const bgStyle = hasBg ? `background:${typeColor[topType]}12;` : '';
                const hasEvt  = events.length > 0;

                bodyHTML += `<div class="db-mini-day${isToday ? ' today' : ''}${hasEvt ? ' has-event' : ''}"
                    style="${bgStyle}"
                    title="${topType ? typeLabel[topType] : 'Sin actividad'}">
                    <div class="db-mini-day-num">${d}</div>
                    <div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center;margin-top:1px;">${dotHTML}</div>
                </div>`;
            }

            bodyHTML += `</div></div>`; // close grid + mini-cal

            // Legend
            bodyHTML += `<div class="db-cal-legend">
                <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#2196f3"></div>Entreno</div>
                <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#f44336"></div>Partido</div>
                <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#4caf50"></div>Rec.</div>
                <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#795548"></div>Gym</div>
                <div class="db-cal-legend-item" style="opacity:0.55">● plan &nbsp; <span style="opacity:1">●</span> real</div>
            </div>`;

        } else {
            // Weekly view
            const now3  = new Date();
            const dow3  = (now3.getDay() + 6) % 7;
            const mon   = new Date(now3);
            mon.setDate(now3.getDate() - dow3 + weekOffset * 7);
            mon.setHours(0,0,0,0);
            const today3 = new Date().toISOString().slice(0,10);
            const dayShort = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

            for (let i = 0; i < 7; i++) {
                const d = new Date(mon);
                d.setDate(mon.getDate() + i);
                const dateStr = d.toISOString().slice(0,10);
                const isToday = dateStr === today3;
                const events  = eventMap[dateStr] || [];

                // Deduplicate by type+source
                const seen = new Set();
                const uniq = events.filter(e => {
                    const k = e.type + e.source;
                    if (seen.has(k)) return false;
                    seen.add(k); return true;
                });

                let sessHTML = '';
                if (uniq.length === 0) {
                    sessHTML = `<span class="db-week-rest">Descanso</span>`;
                } else {
                    sessHTML = `<div class="db-week-sessions">` +
                        uniq.map(e => `
                            <div class="db-week-session-chip">
                                <div class="db-week-session-dot" style="background:${typeColor[e.type]||'#ccc'};opacity:${e.source==='plan'?0.45:1};"></div>
                                <span>${typeIcon[e.type]} ${typeLabel[e.type]}${e.source==='plan'?' <span style="font-size:0.6rem;opacity:0.6">(plan)</span>':''}</span>
                            </div>`).join('') +
                        `</div>`;
                }

                bodyHTML += `<div class="db-week-day-row${isToday ? ' today-row' : ''}">
                    <div class="db-week-day-label">
                        <div class="db-week-day-name">${dayShort[i]}</div>
                        <div class="db-week-day-num">${d.getDate()}</div>
                    </div>
                    ${uniq.length === 0
                        ? `<span class="db-week-rest">Descanso</span>`
                        : `<div class="db-week-sessions">${
                            uniq.map(e => `
                                <div class="db-week-session-chip">
                                    <div class="db-week-session-dot" style="background:${typeColor[e.type]||'#ccc'};opacity:${e.source==='plan'?0.45:1};"></div>
                                    <span>${typeIcon[e.type]} ${typeLabel[e.type]}${e.source==='plan'?' <span style="font-size:0.6rem;opacity:0.55">(plan)</span>':''}</span>
                                </div>`).join('')
                        }</div>`
                    }
                </div>`;
            }

            bodyHTML = `<div class="db-week-view">${bodyHTML}</div>`;

            // Legend
            bodyHTML += `<div class="db-cal-legend">
                <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#2196f3"></div>Entreno</div>
                <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#f44336"></div>Partido</div>
                <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#4caf50"></div>Rec.</div>
                <div class="db-cal-legend-item" style="opacity:0.55">● plan &nbsp; <span style="opacity:1">●</span> real</div>
            </div>`;
        }

        col.innerHTML = `
            <div class="db-cal-header">
                <span class="db-cal-title">Calendario</span>
                <div class="db-cal-tabs">
                    <button class="db-cal-tab${mode==='week'?' active':''}"
                        onclick="window.rpeTracker?._dbCalSetMode('week')">Sem</button>
                    <button class="db-cal-tab${mode==='month'?' active':''}"
                        onclick="window.rpeTracker?._dbCalSetMode('month')">Mes</button>
                </div>
            </div>
            <div class="db-cal-nav">
                <button class="db-cal-nav-btn" onclick="window.rpeTracker?._dbCalNav(-1)">‹</button>
                <span class="db-cal-nav-label">${navLabel}</span>
                <button class="db-cal-nav-btn" onclick="window.rpeTracker?._dbCalNav(1)">›</button>
            </div>
            <div class="db-cal-body">
                ${bodyHTML}
            </div>
        `;
    }

    _dbCalSetMode(mode) {
        if (!this._dbCal) {
            const now = new Date();
            this._dbCal = { mode, year: now.getFullYear(), month: now.getMonth(), weekOffset: 0 };
        }
        this._dbCal.mode = mode;
        this.renderDashboardCalendar();
    }

    _dbCalNav(dir) {
        if (!this._dbCal) return;
        if (this._dbCal.mode === 'month') {
            this._dbCal.month += dir;
            if (this._dbCal.month > 11) { this._dbCal.month = 0;  this._dbCal.year++; }
            if (this._dbCal.month < 0)  { this._dbCal.month = 11; this._dbCal.year--; }
        } else {
            this._dbCal.weekOffset = (this._dbCal.weekOffset || 0) + dir;
        }
        this.renderDashboardCalendar();
    }
    // ── End Dashboard Mini Calendar ────────────────────────────────────────

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

    // ========== STICKY SEMAPHORE BAR ==========

    _renderSemaphoreBar() {
        let bar = document.getElementById('semaphoreBar');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'semaphoreBar';
            bar.className = 'semaphore-bar';
            // Insert inside analytics-container, before comparisonModule
            const anchor = document.getElementById('comparisonModule');
            if (anchor) anchor.parentNode.insertBefore(bar, anchor);
            else return;
        }

        const getStatus = (r) => {
            const n = parseFloat(r);
            if (isNaN(n) || r === 'N/A') return { color: '#9e9e9e', icon: '⚪', label: 'Sin datos' };
            if (n > 1.5)  return { color: '#e53935', icon: '🔴', label: 'Peligro' };
            if (n > 1.3)  return { color: '#fb8c00', icon: '🟠', label: 'Precaución' };
            if (n < 0.8)  return { color: '#1e88e5', icon: '🔵', label: 'Por debajo' };
            return           { color: '#43a047', icon: '🟢', label: 'Óptimo' };
        };

        const pills = this.players.map(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const st = getStatus(ratio.ratio);
            const ratioDisplay = ratio.ratio === 'N/A' ? '—' : ratio.ratio;
            const avatar = PlayerTokens.avatar(player, 22, '0.6rem');
            return `<div class="sema-pill" style="--sema-color:${st.color}" title="${player.name} · Ratio A:C ${ratioDisplay} · ${st.label}"
                onclick="window.rpeTracker?.scrollToPlayerChart('${player.id}')">
                ${avatar}
                <span class="sema-name">${player.name}${player.number ? ' <span class="sema-num">#'+player.number+'</span>' : ''}</span>
                <span class="sema-ratio">${ratioDisplay}</span>
                <span class="sema-dot" style="background:${st.color}"></span>
            </div>`;
        }).join('');

        bar.innerHTML = `
            <div class="sema-label">Estado equipo</div>
            <div class="sema-pills">${pills}</div>
        `;
    }

    scrollToPlayerChart(playerId) {
        const canvas = document.getElementById(`chart-${playerId}`);
        if (canvas) {
            canvas.closest('.chart-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    scrollToPlayerChart(playerId) {
        const canvas = document.getElementById(`chart-${playerId}`);
        if (canvas) {
            canvas.closest('.chart-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    _setAnalyticsTab(tab) {
        this._analyticsTab = tab;
        this.renderAnalytics();
    }

    _renderACCurveTab() {
        // Player selector checkboxes
        const checks = this.players.map((p, i) => {
            const color = PlayerTokens.get(p);
            const checked = !this._acExcluded?.has(p.id);
            return `<label class="ac-curve-check" style="--chk-color:${color}">
                <input type="checkbox" value="${p.id}" ${checked?'checked':''}
                    onchange="window.rpeTracker?._acTogglePlayer('${p.id}',this.checked)">
                <span class="ac-chk-dot" style="background:${color}"></span>
                ${p.name}${p.number?` <small>#${p.number}</small>`:''}
            </label>`;
        }).join('');

        // Window selector
        const win = this._acWindow || 28;

        return `<div class="ac-curve-wrap">
            <div class="ac-curve-controls">
                <div class="ac-curve-players">${checks}</div>
                <div class="ac-curve-right">
                    <label class="ac-win-label">Ventana</label>
                    <select class="ac-win-sel" onchange="window.rpeTracker?._acSetWindow(+this.value)">
                        <option value="14" ${win===14?'selected':''}>14 días</option>
                        <option value="28" ${win===28?'selected':''}>28 días</option>
                        <option value="56" ${win===56?'selected':''}>56 días</option>
                    </select>
                </div>
            </div>
            <div class="ac-curve-chart-wrap">
                <canvas id="acCurveCanvas" style="width:100%;height:300px"></canvas>
            </div>
            <div class="ac-curve-legend">
                <span class="ac-legend-line" style="background:#e53935;opacity:.25;height:2px;width:20px;display:inline-block;vertical-align:middle"></span>
                <span style="font-size:.72rem;color:var(--text-faint)">Zona peligro &gt;1.5</span>
                <span class="ac-legend-line" style="background:#fb8c00;opacity:.25;height:2px;width:20px;display:inline-block;vertical-align:middle;margin-left:.75rem"></span>
                <span style="font-size:.72rem;color:var(--text-faint)">Zona precaución 1.3–1.5</span>
            </div>
        </div>`;
    }

    _drawACCurveChart() {
        const canvas = document.getElementById('acCurveCanvas');
        if (!canvas || typeof Chart === 'undefined') return;
        if (canvas._ci) { canvas._ci.destroy(); canvas._ci = null; }

        const days  = this._acWindow || 28;
        const now   = new Date();
        const labels = [];
        for (let d = days - 1; d >= 0; d--) {
            const dt = new Date(now);
            dt.setDate(now.getDate() - d);
            labels.push(dt.toLocaleDateString('es-ES', { day:'numeric', month:'short' }));
        }

        const excluded = this._acExcluded || new Set();
        const lambdaA  = 2 / (7 + 1);
        const lambdaC  = 2 / (28 + 1);

        const datasets = this.players
            .filter(p => !excluded.has(p.id))
            .map(p => {
                const color  = PlayerTokens.get(p);
                const psess  = this.sessions
                    .filter(s => s.playerId === p.id)
                    .map(s => ({ date: new Date(s.date), load: s.load || s.rpe * (s.duration || 60) }))
                    .sort((a,b) => a.date - b.date);
                const seed   = psess.length ? psess.reduce((s,x)=>s+x.load,0)/psess.length : 0;
                let ewA = seed, ewC = seed;

                // walk back far enough to stabilise
                for (let i = 84; i >= 0; i--) {
                    const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0,0,0,0);
                    const load = psess.filter(s => { const sd=new Date(s.date); sd.setHours(0,0,0,0); return sd.getTime()===d.getTime(); }).reduce((s,x)=>s+x.load,0);
                    ewA = lambdaA * load + (1-lambdaA) * ewA;
                    ewC = lambdaC * load + (1-lambdaC) * ewC;
                    if (i <= days) { /* we'll collect below */ }
                }

                // Now collect last `days` ratios
                ewA = seed; ewC = seed;
                const startFrom = 84;
                const ratiosByDay = {};
                for (let i = startFrom; i >= 0; i--) {
                    const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0,0,0,0);
                    const load = psess.filter(s => { const sd=new Date(s.date); sd.setHours(0,0,0,0); return sd.getTime()===d.getTime(); }).reduce((s,x)=>s+x.load,0);
                    ewA = lambdaA * load + (1-lambdaA) * ewA;
                    ewC = lambdaC * load + (1-lambdaC) * ewC;
                    if (i < days) {
                        ratiosByDay[days-1-i] = ewC > 0 ? parseFloat((ewA/ewC).toFixed(3)) : null;
                    }
                }
                const data = Array.from({length: days}, (_, i) => ratiosByDay[i] ?? null);

                return {
                    label: p.name + (p.number ? ` #${p.number}` : ''),
                    data,
                    borderColor: color,
                    backgroundColor: color + '18',
                    borderWidth: 2,
                    pointRadius: 2,
                    tension: 0.35,
                    spanGaps: true
                };
            });

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridC  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
        const textC  = isDark ? '#888' : '#999';

        canvas._ci = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 300 },
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 }, color: textC } },
                    tooltip: { mode: 'index', intersect: false,
                        callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw?.toFixed(2) ?? '—'}` }
                    },
                    annotation: { annotations: {
                        danger: { type:'line', yMin:1.5, yMax:1.5, borderColor:'rgba(229,57,53,.4)', borderWidth:1.5, borderDash:[4,4] },
                        caution:{ type:'line', yMin:1.3, yMax:1.3, borderColor:'rgba(251,140,0,.35)', borderWidth:1.5, borderDash:[4,4] },
                        low:    { type:'line', yMin:0.8, yMax:0.8, borderColor:'rgba(30,136,229,.35)', borderWidth:1.5, borderDash:[4,4] }
                    }}
                },
                scales: {
                    x: { ticks: { color: textC, maxTicksLimit: 7, font: { size: 10 } }, grid: { color: gridC } },
                    y: { min: 0, max: 2.2, ticks: { color: textC, font: { size: 10 } }, grid: { color: gridC } }
                }
            }
        });
    }

    _acTogglePlayer(id, checked) {
        if (!this._acExcluded) this._acExcluded = new Set();
        if (checked) this._acExcluded.delete(id); else this._acExcluded.add(id);
        requestAnimationFrame(() => this._drawACCurveChart());
    }

    _acSetWindow(days) {
        this._acWindow = days;
        this.renderAnalytics();
    }

    _renderInjuryTrendTab() {
        const injuries = this.injuries || [];
        if (!injuries.length) return `<div class="an-empty">🦴 Sin lesiones registradas</div>`;

        const zones = {};
        injuries.forEach(inj => {
            const loc = this.getLocationName?.(inj.location) || inj.location || 'Desconocida';
            if (!zones[loc]) zones[loc] = { active: 0, resolved: 0, total: 0 };
            zones[loc].total++;
            if (inj.status === 'active') zones[loc].active++;
            else zones[loc].resolved++;
        });

        const sorted = Object.entries(zones).sort((a,b) => b[1].total - a[1].total);
        const maxVal = Math.max(...sorted.map(([,v]) => v.total), 1);

        const bars = sorted.map(([loc, v]) => `
            <div class="inj-trend-row">
                <div class="inj-trend-loc">${loc}</div>
                <div class="inj-trend-bar-wrap">
                    <div class="inj-trend-bar-resolved" style="width:${(v.resolved/maxVal*100).toFixed(0)}%"></div>
                    <div class="inj-trend-bar-active"   style="width:${(v.active/maxVal*100).toFixed(0)}%"></div>
                </div>
                <div class="inj-trend-count">${v.total}</div>
            </div>`).join('');

        // Monthly trend
        const byMonth = {};
        injuries.forEach(inj => {
            if (!inj.date) return;
            const key = inj.date.slice(0, 7);
            if (!byMonth[key]) byMonth[key] = 0;
            byMonth[key]++;
        });
        const monthKeys = Object.keys(byMonth).sort().slice(-12);
        const monthBars = monthKeys.map(k => {
            const n = byMonth[k];
            const h = Math.min(n * 20, 80);
            const [y, m] = k.split('-');
            const lbl = new Date(+y, +m-1, 1).toLocaleDateString('es-ES',{month:'short'});
            return `<div class="inj-month-col">
                <div class="inj-month-bar" style="height:${h}px" title="${n} lesiones"></div>
                <div class="inj-month-val">${n}</div>
                <div class="inj-month-lbl">${lbl}</div>
            </div>`;
        }).join('');

        return `<div class="inj-trend-wrap">
            <h4 class="an-section-title">Lesiones por zona corporal</h4>
            <div class="inj-trend-legend">
                <span class="inj-leg-dot inj-leg-resolved"></span>Resueltas
                <span class="inj-leg-dot inj-leg-active" style="margin-left:.75rem"></span>Activas
            </div>
            <div class="inj-trend-chart">${bars}</div>
            ${monthKeys.length > 1 ? `
            <h4 class="an-section-title" style="margin-top:1.5rem">Frecuencia mensual</h4>
            <div class="inj-month-chart">${monthBars}</div>` : ''}
        </div>`;
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
        
        // Build sticky semaphore bar
        this._renderSemaphoreBar();

        if (!this._analyticsTab) this._analyticsTab = 'tabla';
        const ewmaOpen = localStorage.getItem('rpe_ewma_open') === 'true';

        container.innerHTML = `
            <div class="an-tabs">
                <button class="an-tab ${this._analyticsTab==='tabla'?'active':''}"
                    onclick="window.rpeTracker?._setAnalyticsTab('tabla')">📊 Comparativa</button>
                <button class="an-tab ${this._analyticsTab==='curvas'?'active':''}"
                    onclick="window.rpeTracker?._setAnalyticsTab('curvas')">📈 Curvas A:C</button>
                <button class="an-tab ${this._analyticsTab==='lesiones'?'active':''}"
                    onclick="window.rpeTracker?._setAnalyticsTab('lesiones')">🦴 Lesiones</button>
            </div>

            <div id="anTabContent">
                ${this._analyticsTab === 'tabla' ? `
                    ${this.renderPlayerComparison()}
                    <details class="ewma-info-box" id="ewmaDetails" ${ewmaOpen?'open':''}>
                        <summary class="ewma-summary">
                            <span>ℹ️ Método EWMA — ¿Cómo se calcula el ratio A:C?</span>
                            <span class="ewma-toggle-hint">ver más</span>
                        </summary>
                        <div class="ewma-body">
                            <p style="margin-bottom:0.5rem"><strong>Carga = RPE × Duración</strong> (método sRPE)</p>
                            <p style="margin-bottom:0.5rem">Esta app usa el <strong>método EWMA</strong>, el estándar científico usado por equipos profesionales para calcular el ratio Agudo:Crónico.</p>
                            <p style="margin-bottom:0.5rem"><strong>Interpretación del Ratio:</strong></p>
                            <ul style="margin-left:1.5rem;color:var(--gray)">
                                <li><strong style="color:#2e7d32">0.8–1.3 (Verde):</strong> 🟢 Zona óptima</li>
                                <li><strong style="color:#ef6c00">1.3–1.5 (Naranja):</strong> 🟠 Precaución</li>
                                <li><strong style="color:#c62828">&gt;1.5 (Rojo):</strong> 🔴 Peligro</li>
                                <li><strong style="color:#1565c0">&lt;0.8 (Azul):</strong> 🔵 Descarga</li>
                            </ul>
                        </div>
                    </details>` :
                this._analyticsTab === 'curvas' ? this._renderACCurveTab() :
                this._renderInjuryTrendTab()}
            </div>
        `;
        // Render chart after DOM is ready
        if (this._analyticsTab === 'curvas') {
            requestAnimationFrame(() => this._drawACCurveChart());
        }

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

        // Seed EWMA with average daily load from all historical sessions,
        // so it converges immediately instead of starting cold from 0.
        const allLoads = playerSessions.map(s => s.load);
        const seedLoad = allLoads.length > 0
            ? allLoads.reduce((a, b) => a + b, 0) / allLoads.length
            : 0;

        let ewmaAcute = seedLoad;
        let ewmaChronic = seedLoad;

        // Calculate EWMA for each day
        const now = new Date();
        const maxDaysBack = 56; // Look back 56 days (8 weeks) for better chronic baseline
        
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
        const names = {training:'Entrenamiento', match:'Partido', shooting:'Tiro', gym:'Gym', recovery:'Recuperación'};
        return names[type] || 'Entrenamiento';
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
                if (this.currentView === 'dashboard') this.renderDashboard();
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
                this._ensurePlayerColors(); // migrate old players that lack color
                this.renderPlayers();
                this.populatePlayerSelects();
                this.renderSessions(); // re-renderizar para mostrar nombres correctos
                if (this.currentView === 'dashboard') this.renderDashboard();
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

        // Restore previously selected players from sessionStorage
        let selected = (() => {
            try { return JSON.parse(sessionStorage.getItem('rpe_chart_players') || 'null'); } catch(e) { return null; }
        })();
        if (!selected) selected = this.players.map(p => p.id); // default: all

        // Build chip selector
        const chipsHTML = this.players.map(p => {
            const ratio = this.calculateAcuteChronicRatio(p.id);
            const r = parseFloat(ratio.ratio);
            const dot = isNaN(r) ? '#999' : r > 1.5 ? '#e53935' : r > 1.3 ? '#fb8c00' : r < 0.8 ? '#1e88e5' : '#43a047';
            const ratioDisplay = ratio.ratio === 'N/A' ? '—' : ratio.ratio;
            const active = selected.includes(p.id) ? 'chart-chip--active' : '';
            const avatar = PlayerTokens.avatar(p, 20, '0.55rem');
            return `<button class="chart-chip ${active}" data-pid="${p.id}" onclick="window.rpeTracker?.toggleChartPlayer('${p.id}')">
                ${avatar}
                <span class="chart-chip-name">${p.name}${p.number ? ' <span class="chip-num">#'+p.number+'</span>' : ''}</span>
                <span class="chart-chip-ratio" style="color:${dot}">${ratioDisplay}</span>
            </button>`;
        }).join('');

        const chartsHTML = this.players
            .filter(p => selected.includes(p.id))
            .map(p => `
                <div class="chart-container">
                    <div class="chart-header">
                        <h4>${p.name}${p.number ? ` #${p.number}` : ''}</h4>
                        <div class="chart-period-btns">
                            ${[7,14,30,90].map(d => `<button class="chart-period-btn${(this._chartPeriods?.[p.id]||30)===d?' active':''}" onclick="window.rpeTracker?.setChartPeriod('${p.id}',${d})">${d}d</button>`).join('')}
                        </div>
                    </div>
                    <canvas id="chart-${p.id}" class="chart-canvas"></canvas>
                </div>
            `).join('');

        container.innerHTML = `
            <div class="evolution-section-header">
                <h3>📈 Evolución del Ratio A:C</h3>
                <div class="chart-chips-wrap">${chipsHTML}</div>
            </div>
            <div class="charts-grid">${chartsHTML}</div>
        `;

        setTimeout(() => {
            this.players.filter(p => selected.includes(p.id)).forEach(p => {
                this.renderPlayerEvolutionChart(p.id, this._chartPeriods?.[p.id] || 30);
            });
        }, 100);
    }

    toggleChartPlayer(pid) {
        let selected = (() => {
            try { return JSON.parse(sessionStorage.getItem('rpe_chart_players') || 'null'); } catch(e) { return null; }
        })();
        if (!selected) selected = this.players.map(p => p.id);
        if (selected.includes(pid)) {
            if (selected.length > 1) selected = selected.filter(id => id !== pid);
        } else {
            selected.push(pid);
        }
        sessionStorage.setItem('rpe_chart_players', JSON.stringify(selected));
        this.renderEvolutionCharts();
    }

    setChartPeriod(pid, days) {
        if (!this._chartPeriods) this._chartPeriods = {};
        this._chartPeriods[pid] = days;
        this.renderPlayerEvolutionChart(pid, days);
        // Update period button active states for this player's chart
        const container = document.getElementById(`chart-${pid}`)?.closest('.chart-container');
        if (container) {
            container.querySelectorAll('.chart-period-btn').forEach(btn => {
                btn.classList.toggle('active', parseInt(btn.textContent) === days);
            });
        }
    }
    
    renderPlayerEvolutionChart(playerId, daysBack = 30) {
        const canvasId = `chart-${playerId}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        // Destroy previous Chart.js instance if it exists
        if (canvas._chartInstance) {
            canvas._chartInstance.destroy();
            canvas._chartInstance = null;
        }

        const playerSessions = this.sessions
            .filter(s => s.playerId === playerId)
            .map(s => ({ ...s, date: new Date(s.date), load: s.load || (s.rpe * (s.duration || 60)) }))
            .sort((a, b) => a.date - b.date);

        if (playerSessions.length === 0) return;

        const now = new Date();
        const labels = [];
        const ratioData = [];
        const loadData = [];

        const lambdaAcute = 2 / (7 + 1);
        const lambdaChronic = 2 / (28 + 1);
        let ewmaAcute = 0;
        let ewmaChronic = 0;

        for (let i = daysBack; i >= 0; i--) {
            const currentDate = new Date(now);
            currentDate.setDate(currentDate.getDate() - i);
            currentDate.setHours(0, 0, 0, 0);

            const dailySessions = playerSessions.filter(s => {
                const sd = new Date(s.date); sd.setHours(0, 0, 0, 0);
                return sd.getTime() === currentDate.getTime();
            });
            const dailyLoad = dailySessions.reduce((sum, s) => sum + s.load, 0);

            ewmaAcute   = (lambdaAcute   * dailyLoad) + ((1 - lambdaAcute)   * ewmaAcute);
            ewmaChronic = (lambdaChronic * dailyLoad) + ((1 - lambdaChronic) * ewmaChronic);

            const ratio = ewmaChronic > 0 ? (ewmaAcute / ewmaChronic) : 0;
            labels.push(`${currentDate.getDate()}/${currentDate.getMonth() + 1}`);
            ratioData.push(parseFloat(ratio.toFixed(3)));
            loadData.push(dailyLoad);
        }

        // Zone annotation plugin — draw as background gradient segments
        const zonePlugin = {
            id: 'ratioZones',
            beforeDraw(chart) {
                const { ctx, chartArea: ca, scales: { y } } = chart;
                if (!ca) return;
                const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
                const zones = [
                    { min: 0,   max: 0.8,  color: isDarkMode ? 'rgba(30,120,220,0.22)'  : 'rgba(21,101,192,0.13)',  label: 'Baja carga',   labelColor: isDarkMode ? 'rgba(100,170,255,0.70)' : 'rgba(21,101,192,0.55)'  },
                    { min: 0.8, max: 1.3,  color: isDarkMode ? 'rgba(34,168,97,0.22)'   : 'rgba(76,175,80,0.16)',   label: 'Óptimo',       labelColor: isDarkMode ? 'rgba(80,210,130,0.75)'  : 'rgba(34,130,70,0.55)'   },
                    { min: 1.3, max: 1.5,  color: isDarkMode ? 'rgba(245,166,35,0.28)'  : 'rgba(255,152,0,0.20)',   label: 'Precaución',   labelColor: isDarkMode ? 'rgba(255,190,60,0.80)'  : 'rgba(200,100,0,0.60)'   },
                    { min: 1.5, max: 3.0,  color: isDarkMode ? 'rgba(229,57,53,0.25)'   : 'rgba(244,67,54,0.15)',   label: 'Alto riesgo',  labelColor: isDarkMode ? 'rgba(255,110,100,0.80)' : 'rgba(200,40,40,0.60)'   },
                ];
                ctx.save();
                zones.forEach(z => {
                    const yTop    = y.getPixelForValue(z.max);
                    const yBottom = y.getPixelForValue(z.min);
                    const top     = Math.max(yTop, ca.top);
                    const bottom  = Math.min(yBottom, ca.bottom);
                    if (bottom <= top) return;
                    // Fill zone
                    ctx.fillStyle = z.color;
                    ctx.fillRect(ca.left, top, ca.width, bottom - top);
                    // Label — centrado verticalmente en la zona, alineado a la derecha
                    const midY = (top + bottom) / 2;
                    if (bottom - top > 12) { // solo si la zona tiene altura suficiente
                        ctx.font = 'bold 10px system-ui, sans-serif';
                        ctx.fillStyle = z.labelColor;
                        ctx.textAlign = 'right';
                        ctx.textBaseline = 'middle';
                        ctx.fillText(z.label, ca.right - 6, midY);
                    }
                });
                // Zone threshold lines — más visibles
                const thresholds = [
                    { v: 0.8, label: '0.8' },
                    { v: 1.3, label: '1.3' },
                    { v: 1.5, label: '1.5' },
                ];
                thresholds.forEach(({ v, label }) => {
                    const yLine = y.getPixelForValue(v);
                    if (yLine < ca.top || yLine > ca.bottom) return;
                    ctx.strokeStyle = isDarkMode ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.22)';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 4]);
                    ctx.beginPath();
                    ctx.moveTo(ca.left, yLine);
                    ctx.lineTo(ca.right, yLine);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    // Valor numérico en el eje izquierdo
                    ctx.font = '10px system-ui, sans-serif';
                    ctx.fillStyle = isDarkMode ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.40)';
                    ctx.textAlign = 'left';
                    ctx.textBaseline = 'bottom';
                    ctx.fillText(label, ca.left + 3, yLine - 2);
                });
                ctx.restore();
            }
        };

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        const textColor  = isDark ? '#aaa' : '#666';

        const instance = new Chart(canvas.getContext('2d'), {
            type: 'line',
            plugins: [zonePlugin],
            data: {
                labels,
                datasets: [
                    {
                        label: 'Ratio A:C',
                        data: ratioData,
                        borderColor: '#ff6600',
                        backgroundColor: 'rgba(255,102,0,0.08)',
                        fill: false,
                        tension: 0.35,
                        pointRadius: (ctx) => (ratioData[ctx.dataIndex] > 0 ? 3 : 0),
                        pointHoverRadius: 6,
                        pointBackgroundColor: (ctx) => {
                            const v = ratioData[ctx.dataIndex];
                            if (v <= 0) return 'transparent';
                            if (v < 0.8) return '#1565c0';
                            if (v <= 1.3) return '#2e7d32';
                            if (v <= 1.5) return '#ef6c00';
                            return '#c62828';
                        },
                        borderWidth: 2,
                        yAxisID: 'y',
                    },
                    {
                        label: 'Carga diaria',
                        data: loadData,
                        type: 'bar',
                        backgroundColor: 'rgba(33,150,243,0.18)',
                        borderColor: 'rgba(33,150,243,0.4)',
                        borderWidth: 1,
                        borderRadius: 2,
                        yAxisID: 'y2',
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 600, easing: 'easeOutQuart' },
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: {
                        labels: { color: textColor, font: { size: 11, family: 'system-ui, -apple-system, sans-serif' }, boxWidth: 14 }
                    },
                    tooltip: {
                        backgroundColor: isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.96)',
                        titleColor: isDark ? '#fff' : '#111',
                        bodyColor: isDark ? '#ccc' : '#444',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            afterBody(items) {
                                const ratio = items.find(i => i.dataset.label === 'Ratio A:C');
                                if (!ratio) return [];
                                const v = ratio.raw;
                                if (v <= 0) return ['Estado: Sin datos'];
                                if (v < 0.8)  return [`Estado: ⬇️ Descarga (${v.toFixed(2)})`];
                                if (v <= 1.3) return [`Estado: ✅ Óptimo (${v.toFixed(2)})`];
                                if (v <= 1.5) return [`Estado: ⚠️ Precaución (${v.toFixed(2)})`];
                                return [`Estado: 🚨 Peligro (${v.toFixed(2)})`];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, font: { size: 10, family: 'system-ui, sans-serif' }, maxTicksLimit: 10 },
                        grid: { color: gridColor }
                    },
                    y: {
                        position: 'left',
                        min: 0,
                        max: 2.5,
                        ticks: {
                            color: textColor, font: { size: 10, family: 'system-ui, sans-serif' },
                            callback: v => v.toFixed(1)
                        },
                        grid: { color: gridColor },
                        title: { display: true, text: 'Ratio A:C', color: textColor, font: { size: 10 } }
                    },
                    y2: {
                        position: 'right',
                        min: 0,
                        grid: { drawOnChartArea: false },
                        ticks: { color: textColor, font: { size: 10, family: 'system-ui, sans-serif' } },
                        title: { display: true, text: 'Carga', color: textColor, font: { size: 10 } }
                    }
                }
            }
        });

        canvas._chartInstance = instance;
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
            const type = {training:'Entrenamiento',match:'Partido',shooting:'Tiro',gym:'Gym',recovery:'Recuperación'}[session.type] || 'Entrenamiento';
            const load = session.load || (session.rpe * (session.duration || 60));
            const notes = (session.notes || '').replace(/"/g, '""'); // Escape quotes
            
            csv += `"${playerName}","${playerNumber}","${dateStr}","${timeOfDay}","${type}",${session.rpe},${session.duration || 60},${load},"${notes}"\n`;
        });
        
        // Add summary sheet
        csv += '\n\nRESUMEN POR JUGADORA\n';
        csv += 'Jugadora,Dorsal,Total Sesiones,RPE Medio,Carga Total,Ratio A:C,Estado\n';
        
        this.players.forEach(player => {
            const playerSessions = this.sessions.filter(s => s.playerId === player.id);
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
                suggestedLoad: null,
                targetLoad: null
            };
        }

        // EWMA-based optimal load calculation
        // We want the next session load such that the resulting acute EWMA
        // keeps the ratio within the target range [0.8, 1.3].
        // Formula: EWMA_acute_new = λ × load + (1-λ) × EWMA_acute_current
        // Ratio_new = EWMA_acute_new / EWMA_chronic
        // Solving for load: load = (ratio_target × EWMA_chronic - (1-λ) × EWMA_acute) / λ
        const lambdaAcute = 2 / (7 + 1); // 0.25
        const ewmaAcute   = ratio.acute;
        const ewmaChronic = ratio.chronic;

        // Target: centre of optimal zone (ratio 1.05)
        const ratioTarget  = 1.05;
        const loadOptimal  = Math.max(0, Math.round(
            (ratioTarget * ewmaChronic - (1 - lambdaAcute) * ewmaAcute) / lambdaAcute
        ));

        // Also compute min/max load for the safe zone boundaries (0.8 and 1.3)
        const loadMin = Math.max(0, Math.round(
            (0.8  * ewmaChronic - (1 - lambdaAcute) * ewmaAcute) / lambdaAcute
        ));
        const loadMax = Math.max(0, Math.round(
            (1.3  * ewmaChronic - (1 - lambdaAcute) * ewmaAcute) / lambdaAcute
        ));

        // Suggest RPE × duration combos that approximate targetLoad
        const suggestCombo = (load) => {
            if (!load || load <= 0) return null;
            // Try common durations: 45, 60, 75, 90 min
            const durations = [45, 60, 75, 90];
            const combos = durations.map(d => {
                const rpe = load / d;
                return { d, rpe: Math.round(rpe * 10) / 10 };
            }).filter(c => c.rpe >= 1 && c.rpe <= 10);
            // Pick the one closest to RPE 6-7
            const best = combos.reduce((a, b) =>
                Math.abs(a.rpe - 6.5) < Math.abs(b.rpe - 6.5) ? a : b, combos[0]);
            return best ? `RPE ${best.rpe.toFixed(1)} × ${best.d}'` : null;
        };

        const combo = suggestCombo(loadOptimal);

        if (r > 1.5) {
            const loadSafe = loadMax > 0 ? loadMax : Math.round(loadOptimal * 0.5);
            const safeCombo = suggestCombo(loadSafe);
            return {
                type: 'danger',
                message: '🚨 Reducir carga',
                targetLoad: loadSafe,
                combo: safeCombo,
                loadMin, loadMax,
                advice: `Máx. recomendado: ~${loadSafe.toLocaleString('es-ES')} UA${safeCombo ? ' (ej: ' + safeCombo + ')' : ''}. Sesión de recuperación activa.`
            };
        } else if (r > 1.3) {
            const loadSafe = loadMax > 0 ? Math.round((loadOptimal + loadMax) / 2) : Math.round(loadOptimal * 0.8);
            const safeCombo = suggestCombo(loadSafe);
            return {
                type: 'warning',
                message: '⚠️ Moderar carga',
                targetLoad: loadSafe,
                combo: safeCombo,
                loadMin, loadMax,
                advice: `Recomendado: ~${loadSafe.toLocaleString('es-ES')} UA${safeCombo ? ' (ej: ' + safeCombo + ')' : ''}. Reducir intensidad.`
            };
        } else if (r < 0.8) {
            const loadSafe = loadMin > 0 ? Math.round((loadOptimal + loadMin) / 2) : Math.round(loadOptimal * 1.1);
            const safeCombo = suggestCombo(loadSafe);
            return {
                type: 'info',
                message: '🔵 Aumentar carga',
                targetLoad: loadSafe,
                combo: safeCombo,
                loadMin, loadMax,
                advice: `Recomendado: ~${loadSafe.toLocaleString('es-ES')} UA${safeCombo ? ' (ej: ' + safeCombo + ')' : ''}. Incrementar gradualmente.`
            };
        } else {
            return {
                type: 'success',
                message: '✅ Mantener',
                targetLoad: loadOptimal,
                combo,
                loadMin, loadMax,
                advice: `Óptimo: ~${loadOptimal.toLocaleString('es-ES')} UA${combo ? ' (ej: ' + combo + ')' : ''}. Rango seguro: ${loadMin.toLocaleString('es-ES')}–${loadMax.toLocaleString('es-ES')} UA.`
            };
        }
    }

    renderComparisonChart() {
        const canvas = document.getElementById('comparisonChart');
        if (!canvas || this.players.length < 2) return;

        if (canvas._chartInstance) {
            canvas._chartInstance.destroy();
            canvas._chartInstance = null;
        }

        const comparisonData = this.players.map(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            return {
                name: player.name + (player.number ? ` #${player.number}` : ''),
                ratio: parseFloat(ratio.ratio) || 0
            };
        }).sort((a, b) => b.ratio - a.ratio);

        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        const textColor = isDark ? '#aaa' : '#666';

        const barColors     = comparisonData.map(p => this.getRatioColor(p.ratio));
        const barColorsFade = barColors.map(c => c + '55');

        // Zone reference lines plugin
        const zoneLines = {
            id: 'compZoneLines',
            afterDraw(chart) {
                const { ctx, chartArea: ca, scales: { y } } = chart;
                if (!ca) return;
                const thresholds = [
                    { v: 0.8, label: '0.8', color: '#1565c0' },
                    { v: 1.3, label: '1.3', color: '#2e7d32' },
                    { v: 1.5, label: '1.5', color: '#ef6c00' },
                ];
                ctx.save();
                thresholds.forEach(({ v, label, color }) => {
                    const yPx = y.getPixelForValue(v);
                    if (yPx < ca.top || yPx > ca.bottom) return;
                    ctx.strokeStyle = color + 'aa';
                    ctx.lineWidth = 1.5;
                    ctx.setLineDash([5, 4]);
                    ctx.beginPath();
                    ctx.moveTo(ca.left, yPx);
                    ctx.lineTo(ca.right, yPx);
                    ctx.stroke();
                    ctx.setLineDash([]);
                    ctx.fillStyle = color;
                    ctx.font = '10px system-ui, sans-serif';
                    ctx.fillText(label, ca.right + 4, yPx + 3);
                });
                ctx.restore();
            }
        };

        const instance = new Chart(canvas.getContext('2d'), {
            type: 'bar',
            plugins: [zoneLines],
            data: {
                labels: comparisonData.map(p => p.name),
                datasets: [{
                    label: 'Ratio A:C',
                    data: comparisonData.map(p => p.ratio),
                    backgroundColor: barColorsFade,
                    borderColor: barColors,
                    borderWidth: 2,
                    borderRadius: 6,
                    borderSkipped: false,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 600, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.96)',
                        titleColor: isDark ? '#fff' : '#111',
                        bodyColor: isDark ? '#ccc' : '#444',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        padding: 10,
                        callbacks: {
                            label(ctx) {
                                const v = ctx.raw;
                                const estado = v <= 0 ? 'Sin datos'
                                    : v < 0.8  ? '⬇️ Descarga'
                                    : v <= 1.3 ? '✅ Óptimo'
                                    : v <= 1.5 ? '⚠️ Precaución'
                                    : '🚨 Peligro';
                                return `Ratio A:C: ${v.toFixed(2)}  •  ${estado}`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: { color: textColor, font: { size: 11, family: 'system-ui, sans-serif' } },
                        grid: { display: false }
                    },
                    y: {
                        min: 0,
                        suggestedMax: 2.0,
                        ticks: {
                            color: textColor,
                            font: { size: 10, family: 'system-ui, sans-serif' },
                            callback: v => v.toFixed(1)
                        },
                        grid: { color: gridColor },
                        title: { display: true, text: 'Ratio A:C', color: textColor, font: { size: 10 } }
                    }
                }
            }
        });

        canvas._chartInstance = instance;
    }

    // ========== HELPER: SVG SPARKLINE INLINE ==========

    renderSparklineSVG(data, color = '#ff6600', width = 80, height = 28) {
        const n = data.length;
        if (n === 0) return `<svg width="${width}" height="${height}"></svg>`;
        const max = Math.max(...data, 1);
        const pad = 2;
        const xStep = (width - pad * 2) / Math.max(n - 1, 1);

        const pts = data.map((v, i) => {
            const x = pad + i * xStep;
            const y = pad + (height - pad * 2) * (1 - v / max);
            return [parseFloat(x.toFixed(1)), parseFloat(y.toFixed(1))];
        });

        const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');
        const area = [
            `${pts[0][0]},${height - pad}`,
            ...pts.map(([x, y]) => `${x},${y}`),
            `${pts[n - 1][0]},${height - pad}`
        ].join(' ');

        return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;overflow:visible">
            <polygon points="${area}" fill="${color}" fill-opacity="0.18"/>
            <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
            <circle cx="${pts[n-1][0]}" cy="${pts[n-1][1]}" r="2.5" fill="${color}"/>
        </svg>`;
    }

    // ========== FEATURE 5: PLAYER COMPARISON ==========

    renderPlayerComparison() {
        if (this.players.length < 2) return '';

        const now = new Date();

        const comparisonData = this.players.map(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const playerSessions = this.sessions.filter(s => s.playerId === player.id);
            const avgRPE = playerSessions.length > 0
                ? (playerSessions.reduce((sum, s) => sum + s.rpe, 0) / playerSessions.length).toFixed(1)
                : '—';

            // 7-day daily load for sparkline
            const sparkData = [];
            for (let d = 6; d >= 0; d--) {
                const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - d); dayStart.setHours(0,0,0,0);
                const dayEnd   = new Date(dayStart); dayEnd.setHours(23,59,59,999);
                const dayLoad  = playerSessions
                    .filter(s => { const sd = new Date(s.date); return sd >= dayStart && sd <= dayEnd; })
                    .reduce((sum, s) => sum + (s.load || s.rpe * (s.duration || 60)), 0);
                sparkData.push(dayLoad);
            }

            const totalLoad7d  = ratio.totalLoad7d  || 0;
            const totalLoad21d = ratio.totalLoad21d || 0;
            const rec = this.getLoadRecommendation(player.id);
            const color = PlayerTokens.get(player);

            return {
                player, ratio, avgRPE, sparkData, totalLoad7d, totalLoad21d, rec, color
            };
        }).sort((a, b) => (parseFloat(b.ratio.ratio) || 0) - (parseFloat(a.ratio.ratio) || 0));

        const rows = comparisonData.map(({ player, ratio, avgRPE, sparkData, totalLoad7d, rec, color }) => {
            const rVal      = parseFloat(ratio.ratio) || 0;
            const ratioCol  = this.getRatioColor(ratio.ratio);
            const statusBadge = ratio.ratio === 'N/A'
                ? `<span class="cmp-badge cmp-badge--grey">N/A</span>`
                : rVal < 0.8
                    ? `<span class="cmp-badge cmp-badge--blue">⬇ Descarga</span>`
                    : rVal <= 1.3
                        ? `<span class="cmp-badge cmp-badge--green">✅ Óptimo</span>`
                        : rVal <= 1.5
                            ? `<span class="cmp-badge cmp-badge--orange">⚠ Precaución</span>`
                            : `<span class="cmp-badge cmp-badge--red">🚨 Peligro</span>`;

            const spark = this.renderSparklineSVG(sparkData, color, 84, 28);

            return `<tr class="cmp-row">
                <td class="cmp-td cmp-td--player">
                    <div class="cmp-player-cell">
                        <div class="cmp-token" style="background:${color}">
                            ${player.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <div class="cmp-name">${player.name}</div>
                            ${player.number ? `<div class="cmp-num">#${player.number}</div>` : ''}
                        </div>
                    </div>
                </td>
                <td class="cmp-td cmp-td--ratio" style="color:${ratioCol}; font-weight:700">
                    ${ratio.ratio !== 'N/A' ? rVal.toFixed(2) : '—'}
                </td>
                <td class="cmp-td">${statusBadge}</td>
                <td class="cmp-td cmp-td--num">${avgRPE}</td>
                <td class="cmp-td cmp-td--num">${totalLoad7d > 0 ? totalLoad7d.toLocaleString('es-ES') : '—'}</td>
                <td class="cmp-td cmp-td--spark">${spark}</td>
                <td class="cmp-td cmp-td--rec">
                    <div class="cmp-rec-wrap">
                        <span class="cmp-rec-label">${rec.message}</span>
                        ${rec.targetLoad != null ? `<span class="cmp-rec-load" title="${rec.advice || ''}">${rec.targetLoad.toLocaleString('es-ES')} UA${rec.combo ? '<br><span class=\'cmp-rec-combo\'>' + rec.combo + '</span>' : ''}</span>` : '<span class="cmp-rec-nodata">—</span>'}
                    </div>
                </td>
            </tr>`;
        }).join('');

        return `
            <h3 style="margin: 0 0 0.75rem 0;">👥 Comparativa de Jugadoras</h3>
            <div class="cmp-table-wrap">
                <table class="cmp-table">
                    <thead>
                        <tr class="cmp-thead-row">
                            <th class="cmp-th">Jugadora</th>
                            <th class="cmp-th">Ratio A:C</th>
                            <th class="cmp-th">Estado</th>
                            <th class="cmp-th">RPE Medio</th>
                            <th class="cmp-th">Carga 7d</th>
                            <th class="cmp-th">7 días</th>
                            <th class="cmp-th">Recomendación</th>
                        </tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
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
                        <button class="comp-mode-btn active" id="modePvP" onclick="window.rpeTracker?.setCompMode('pvp')">
                            Jugadora vs Jugadora
                        </button>
                        <button class="comp-mode-btn" id="modePvT" onclick="window.rpeTracker?.setCompMode('pvt')">
                            Jugadora vs Media equipo
                        </button>
                    </div>
                </div>

                <div class="comp-selectors">
                    <div class="comp-selector-group">
                        <label class="comp-label" id="labelA">Jugadora A</label>
                        <select class="comp-select" id="compPlayerA" onchange="window.rpeTracker?.updateComparison()">
                            ${playerOptions}
                        </select>
                    </div>
                    <div class="comp-vs">VS</div>
                    <div class="comp-selector-group" id="selectorB">
                        <label class="comp-label" id="labelB">Jugadora B</label>
                        <select class="comp-select" id="compPlayerB" onchange="window.rpeTracker?.updateComparison()">
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

                <div class="comp-body-grid">
                    <div id="compMetrics" class="comp-metrics"></div>
                    <div class="comp-chart-wrap">
                        <canvas id="compChart" width="600" height="300"></canvas>
                    </div>
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

        // Line chart: RPE evolution last 8 weeks (Chart.js)
        const seriesA = this.getWeeklyRPESeries(idA);
        const seriesB = mode === 'pvp'
            ? this.getWeeklyRPESeries(document.getElementById('compPlayerB')?.value)
            : this.getTeamWeeklyRPESeries();

        const allWeeks = [...new Set([...seriesA.map(d=>d.week), ...seriesB.map(d=>d.week)])].sort();
        const valA = allWeeks.map(w => seriesA.find(d=>d.week===w)?.rpe ?? null);
        const valB = allWeeks.map(w => seriesB.find(d=>d.week===w)?.rpe ?? null);
        const labels = allWeeks.map(w => 'S'+w.slice(-2));

        const compCanvas = document.getElementById('compChart');
        if (compCanvas) {
            if (compCanvas._chartInstance) { compCanvas._chartInstance.destroy(); compCanvas._chartInstance = null; }
            const isDark   = document.documentElement.getAttribute('data-theme') === 'dark';
            const gridCol  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
            const textCol  = isDark ? '#aaa' : '#666';
            compCanvas._chartInstance = new Chart(compCanvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels,
                    datasets: [
                        {
                            label: labelA,
                            data: valA,
                            borderColor: colorA,
                            backgroundColor: colorA + '22',
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            borderWidth: 2,
                            spanGaps: true
                        },
                        {
                            label: labelB,
                            data: valB,
                            borderColor: colorB,
                            backgroundColor: colorB + '22',
                            fill: true,
                            tension: 0.35,
                            pointRadius: 4,
                            pointHoverRadius: 6,
                            borderWidth: 2,
                            spanGaps: true
                        }
                    ]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: 'index', intersect: false },
                    plugins: {
                        legend: { labels: { color: textCol, font: { size: 11 }, boxWidth: 14 } },
                        tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: RPE ${ctx.raw?.toFixed(1) ?? '—'}` } }
                    },
                    scales: {
                        x: { ticks: { color: textCol, font: { size: 10 } }, grid: { color: gridCol } },
                        y: {
                            min: 0, max: 10,
                            ticks: { color: textCol, font: { size: 10 }, stepSize: 2 },
                            grid: { color: gridCol },
                            title: { display: true, text: 'RPE medio', color: textCol, font: { size: 10 } }
                        }
                    }
                }
            });
        }
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

    // ========== BATCH 2: SPARKLINE ==========

    _drawSparkline(canvas, data, color) {
        const ctx = canvas.getContext('2d');
        const w = canvas.width;
        const h = canvas.height;
        ctx.clearRect(0, 0, w, h);

        const max = Math.max(...data, 1);
        const n = data.length;
        const pad = 2;
        const xStep = (w - pad * 2) / (n - 1);

        // Fill area
        ctx.beginPath();
        ctx.moveTo(pad, h - pad);
        data.forEach((v, i) => {
            const x = pad + i * xStep;
            const y = h - pad - ((v / max) * (h - pad * 2));
            ctx.lineTo(x, y);
        });
        ctx.lineTo(pad + (n - 1) * xStep, h - pad);
        ctx.closePath();
        ctx.fillStyle = color + '33';
        ctx.fill();

        // Line
        ctx.beginPath();
        data.forEach((v, i) => {
            const x = pad + i * xStep;
            const y = h - pad - ((v / max) * (h - pad * 2));
            i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        });
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.lineJoin = 'round';
        ctx.stroke();

        // Last point dot
        const lastX = pad + (n - 1) * xStep;
        const lastY = h - pad - ((data[n - 1] / max) * (h - pad * 2));
        ctx.beginPath();
        ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
    }

    // ========== BATCH 2: ROSTER DRAG-AND-DROP ==========

    _initRosterDragAndDrop(container) {
        let dragging = null;

        container.querySelectorAll('.player-card[draggable]').forEach(card => {
            card.addEventListener('dragstart', e => {
                dragging = card;
                card.classList.add('dragging');
                e.dataTransfer.effectAllowed = 'move';
            });
            card.addEventListener('dragend', () => {
                card.classList.remove('dragging');
                container.querySelectorAll('.player-card').forEach(c => c.classList.remove('drag-over'));
                dragging = null;
            });
            card.addEventListener('dragover', e => {
                e.preventDefault();
                if (!dragging || dragging === card) return;
                container.querySelectorAll('.player-card').forEach(c => c.classList.remove('drag-over'));
                card.classList.add('drag-over');
            });
            card.addEventListener('drop', e => {
                e.preventDefault();
                if (!dragging || dragging === card) return;
                const dragId = dragging.dataset.playerId;
                const dropId = card.dataset.playerId;
                const dragIdx = this.players.findIndex(p => p.id === dragId);
                const dropIdx = this.players.findIndex(p => p.id === dropId);
                if (dragIdx < 0 || dropIdx < 0) return;
                const [moved] = this.players.splice(dragIdx, 1);
                this.players.splice(dropIdx, 0, moved);
                this.savePlayers();
                this.renderPlayers();
                this.showToast('↕️ Orden del equipo actualizado', 'success');
            });
        });
    }

    // ========== BATCH 2: PLAYER SEARCH ==========

    filterPlayersList(value) {
        const clearBtn = document.getElementById('playerSearchClear');
        if (clearBtn) clearBtn.style.display = value ? 'flex' : 'none';
        this.renderPlayers();
    }

    clearPlayerSearch() {
        const input = document.getElementById('playerSearchInput');
        if (input) { input.value = ''; input.focus(); }
        const clearBtn = document.getElementById('playerSearchClear');
        if (clearBtn) clearBtn.style.display = 'none';
        this.renderPlayers();
    }

    // ========== BATCH 3: NAV ALERT BADGE ==========

    _updateNavAlertBadge() {
        const alertCount = this.players.filter(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const r = parseFloat(ratio.ratio);
            return !isNaN(r) && r > 1.3;
        }).length;

        // Find the "Carga" nav group button
        const cargaBtn = document.querySelector('.nav-group-btn[data-group="carga"]');
        if (!cargaBtn) return;

        // Remove existing badge
        const existing = cargaBtn.querySelector('.nav-alert-badge');
        if (existing) existing.remove();

        if (alertCount > 0) {
            const badge = document.createElement('span');
            badge.className = 'nav-alert-badge';
            badge.textContent = alertCount;
            cargaBtn.appendChild(badge);
        }
    }
}

// Initialize app — managed by auth.js
let rpeTracker;

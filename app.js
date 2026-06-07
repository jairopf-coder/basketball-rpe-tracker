// ========== NAVEGACIÓN POR GRUPOS ==========

const NavMenu = {
    groups: {
        dashboard: { label: '📊 Inicio', direct: 'dashboard' },
        carga: {
            label: '🏋️ Carga',
            items: [
                { view: 'microciclo', label: '📆 Microciclo' },
                { view: 'analytics', label: '📈 Análisis A:C' },
                { view: 'teamload',  label: '🔥 Carga equipo' },
                { view: 'weekplan',  label: '📅 Planificación' },
                { view: 'sessions',  label: '📋 Historial' },
            ],
            default: 'microciclo'
        },
        salud: {
            label: '❤️ Salud',
            items: [
                { view: 'wellness',    label: '❤️ Wellness' },
                { view: 'injury',      label: '🏥 Lesiones' },
                { view: 'rehab',       label: '💪 Readaptación' },
                { view: 'prediction',  label: '🔮 Predicción' },
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

        // Update group buttons (desktop nav bar)
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
        return `<div class="player-token-avatar ${extraClass}" style="width:${sizePx}px;height:${sizePx}px;font-size:${fontSize};background:${color}" title="${esc(player.name)}">${esc(initials)}</div>`;
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
        const saved = Store.getString('darkMode');
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
        Store.setString('darkMode', String(dark));
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

        // Cargar bloques de temporada
        if (typeof this.loadSeasonBlocks === 'function') {
            this.loadSeasonBlocks();
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

        // Render dashboard con datos de localStorage inmediatamente.
        // setTimeout(0) garantiza que window.rpeTracker ya existe cuando
        // switchView se ejecuta (el constructor termina de asignarse primero).
        setTimeout(() => {
            this.switchView('dashboard');
        }, 0);
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
        document.getElementById('restoreFile')?.addEventListener('change', (e) => this.restoreBackup(e));
        document.getElementById('seasonFileInput')?.addEventListener('change', (e) => this.loadSeasonArchive(e));
        
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
        
        setTimeout(() => { if (typeof this.setupSearchAndFilters === "function") this.setupSearchAndFilters(); }, 0);
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
                break;
            case 'calendar':
                if (typeof this.renderCalendar === 'function') {
                    this.renderCalendar(this.calendarYear, this.calendarMonth);
                }
                break;
            case 'injury':
                if (typeof this.renderInjuryHub === 'function') {
                    this.updateMissedSessions();
                    this.renderInjuryHub();
                }
                break;
            case 'medical':      // legacy redirect
            case 'correlation':  // legacy redirect
                if (typeof NavMenu !== 'undefined') NavMenu.selectView('injury');
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
            case 'teamload':
                if (typeof this.renderTeamLoad === 'function') this.renderTeamLoad();
                break;
            case 'weekplan':
                if (typeof this.renderWeeklyPlanning === 'function') this.renderWeeklyPlanning();
                break;
            case 'seasonblocks':
                if (typeof this.renderSeasonBlocksManager === 'function') this.renderSeasonBlocksManager();
                break;
            case 'microciclo':
                if (typeof this.renderMicrociclo === 'function') this.renderMicrociclo();
                break;
            case 'rehab':
                if (typeof this.renderRehabLoad === 'function') this.renderRehabLoad();
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
        const _modal2 = document.getElementById('addPlayerModal');
        _modal2.classList.add('active');
        this._ftRelease2 = trapFocus(_modal2);
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
    }
    
    renderPlayerButtons() {
        this.renderPlayerButtonsMulti();
    }

    _populateSeasonSelector() {
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
    }

    _getSelectedSeason() {
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
        if (modalId === 'newSessionModal') {
            this.selectedPlayerIds = [];
            if (this._ftRelease) { this._ftRelease(); this._ftRelease = null; }
        }
        if (modalId === 'addPlayerModal' && this._ftRelease2) { this._ftRelease2(); this._ftRelease2 = null; }
        if (modalId === 'detailModal'    && this._ftRelease3) { this._ftRelease3(); this._ftRelease3 = null; }
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

    // ========== READINESS SCORE ==========
    // Composite 0-100 score: sleep + mood - fatigue - soreness + A:C zone bonus
    // Returns null if no wellness data for today.
    calculateReadiness(playerId) {
        const today = new Date().toISOString().slice(0, 10);
        const wellnessKey = `wellness_${playerId}_${today}`;

        // Try localStorage first (wellness.js stores here before Firebase sync)
        let w = null;
        try { w = Store.get(wellnessKey); } catch(_) {}

        // Also check in-memory wellness array if present
        if (!w && this.wellnessData) {
            w = this.wellnessData.find(x => x.playerId === playerId && x.date === today);
        }

        if (!w) return null;

        // Wellness fields: sleep, mood, fatigue, soreness — each 1-5
        const sleep    = Number(w.sleep    || w.sueno    || 0);
        const mood     = Number(w.mood     || w.humor    || 0);
        const fatigue  = Number(w.fatigue  || w.cansancio|| 0);
        const soreness = Number(w.soreness || w.agujetas || 0);

        if (!sleep && !mood && !fatigue && !soreness) return null;

        // Normalise to 0-1 (1→0, 5→1)
        const norm = v => Math.max(0, Math.min(1, (v - 1) / 4));

        // A:C zone bonus (0, 5, 10, 20)
        const ratio = this.calculateAcuteChronicRatio(playerId);
        const r = parseFloat(ratio.ratio);
        const t = this.getPlayerThresholds(playerId);
        let acBonus = 10; // neutral when no data
        if (!isNaN(r)) {
            if      (r >= t.low && r <= t.opt) acBonus = 20;
            else if (r > t.opt && r <= t.high) acBonus = 10;
            else if (r < t.low && r > 0)       acBonus = 5;
            else if (r > t.high)               acBonus = 0;
        }

        const score = Math.round(
            norm(sleep)    * 25 +
            norm(mood)     * 20 -
            norm(fatigue)  * 20 -
            norm(soreness) * 15 +
            acBonus
        );

        return Math.max(0, Math.min(100, score));
    }








    // ── A) Pre-session Modal ───────────────────────────────────────────────
    openPreSessionModal() {
        const existing = document.getElementById('preSessionModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.id = 'preSessionModal';
        modal.className = 'modal active presession-modal';
        modal.innerHTML = this._renderPreSessionModal();
        document.body.appendChild(modal);

        // Close on backdrop click
        modal.addEventListener('click', e => {
            if (e.target === modal) modal.remove();
        });
    }

    _renderPreSessionModal() {
        const today = new Date().toISOString().slice(0, 10);
        const dateLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
        const wData = this.wellnessData || [];
        const trendAlerts = typeof this._wTrendAlerts === 'function' ? this._wTrendAlerts() : [];

        // Section 1: Low readiness (<60)
        const lowReadiness = this.players.map(p => ({
            player: p,
            score: this.calculateReadiness(p.id)
        })).filter(d => d.score !== null && d.score < 60)
          .sort((a, b) => a.score - b.score);

        // Section 2: A:C out of individual threshold
        const acOutOfRange = this.players.map(p => {
            const ratio = this.calculateAcuteChronicRatio(p.id);
            const r = parseFloat(ratio.ratio);
            const t = this.getPlayerThresholds(p.id);
            if (isNaN(r)) return null;
            let status = null, icon = '', color = '';
            if (r > t.high)            { status = 'danger';   icon = '🔴'; color = '#f44336'; }
            else if (r > t.opt)        { status = 'caution';  icon = '🟠'; color = '#ff9800'; }
            else if (r > 0 && r < t.low) { status = 'low';   icon = '🔵'; color = '#2196f3'; }
            if (!status) return null;
            return { player: p, ratio: ratio.ratio, icon, color, status };
        }).filter(Boolean).sort((a, b) => {
            const order = { danger: 0, caution: 1, low: 2 };
            return order[a.status] - order[b.status];
        });

        // Section 3: Injured / in rehab
        const injured = this.players.map(p => {
            const inj = (this.injuries || []).find(i => i.playerId === p.id && i.status === 'active');
            if (!inj) return null;
            const loc = this.getLocationName ? this.getLocationName(inj.location) : (inj.location || 'lesión activa');
            const phase = inj.rtpPhase ? `Fase ${inj.rtpPhase} RTP` : 'En baja';
            return { player: p, injury: inj, loc, phase };
        }).filter(Boolean);

        // Section 4: 3+ day low wellness trend (from _wTrendAlerts)
        const wellnessTrend = trendAlerts.reduce((acc, a) => {
            const existing = acc.find(x => x.name === a.name);
            if (existing) { existing.messages.push(a.message); }
            else acc.push({ name: a.name, messages: [a.message] });
            return acc;
        }, []);

        // Players clear (no alerts in any section)
        const alertedIds = new Set([
            ...lowReadiness.map(d => d.player.id),
            ...acOutOfRange.map(d => d.player.id),
            ...injured.map(d => d.player.id),
            ...trendAlerts.map(a => {
                const p = this.players.find(pl => pl.name === a.name);
                return p ? p.id : null;
            }).filter(Boolean)
        ]);
        const clearPlayers = this.players.filter(p => !alertedIds.has(p.id));

        const allClear = lowReadiness.length === 0 && acOutOfRange.length === 0 &&
                         injured.length === 0 && wellnessTrend.length === 0;

        const renderSection = (title, count, colorClass, items, emptyMsg) => {
            const isEmpty = items.length === 0;
            return `<div class="pss-section ${isEmpty ? 'pss-section--ok' : ''}">
                <div class="pss-section-header">
                    <span class="pss-section-title">${title}</span>
                    <span class="pss-section-badge ${colorClass}">${count}</span>
                </div>
                ${isEmpty
                    ? `<div class="pss-empty">✅ ${emptyMsg}</div>`
                    : `<div class="pss-rows">${items}</div>`
                }
            </div>`;
        };

        const rdyRows = lowReadiness.map(d => {
            const lbl = this.readinessLabel(d.score);
            return `<div class="pss-row">
                ${PlayerTokens.avatar(d.player, 22, '0.65rem')}
                <span class="pss-name">${d.player.name}</span>
                <span class="pss-tag" style="color:${lbl.color};background:${lbl.bg}">${lbl.icon} ${d.score}/100</span>
            </div>`;
        }).join('');

        const acRows = acOutOfRange.map(d => `<div class="pss-row">
            ${PlayerTokens.avatar(d.player, 22, '0.65rem')}
            <span class="pss-name">${d.player.name}</span>
            <span class="pss-tag" style="color:${d.color}">${d.icon} Ratio ${d.ratio}</span>
        </div>`).join('');

        const injRows = injured.map(d => `<div class="pss-row">
            ${PlayerTokens.avatar(d.player, 22, '0.65rem')}
            <span class="pss-name">${d.player.name}</span>
            <span class="pss-tag pss-tag--inj">🏥 ${d.loc} — ${d.phase}</span>
        </div>`).join('');

        const trendRows = wellnessTrend.map(d => `<div class="pss-row pss-row--trend">
            <span class="pss-trend-name">${d.name.split(' ')[0]}</span>
            <span class="pss-trend-msgs">${d.messages.join(' · ')}</span>
        </div>`).join('');

        return `
        <div class="modal-content presession-content">
            <div class="modal-header presession-header">
                <div class="presession-title-wrap">
                    <span class="presession-icon">▶</span>
                    <div>
                        <div class="presession-title">Resumen Pre-sesión</div>
                        <div class="presession-date">${dateLabel}</div>
                    </div>
                </div>
                <button class="btn-close" onclick="document.getElementById('preSessionModal')?.remove()">&times;</button>
            </div>
            <div class="presession-body">
                ${allClear ? `
                <div class="pss-all-clear">
                    <div class="pss-all-clear-icon">✅</div>
                    <div class="pss-all-clear-title">Equipo listo para entrenar</div>
                    <div class="pss-all-clear-sub">Sin alertas activas hoy — todas las jugadoras en estado óptimo</div>
                </div>` : `
                ${renderSection(
                    '🔴 Readiness bajo (&lt;60)',
                    lowReadiness.length,
                    lowReadiness.length ? 'pss-badge--red' : 'pss-badge--ok',
                    rdyRows,
                    'Todas con readiness adecuado'
                )}
                ${renderSection(
                    '⚠️ A:C fuera de umbral individual',
                    acOutOfRange.length,
                    acOutOfRange.length ? 'pss-badge--orange' : 'pss-badge--ok',
                    acRows,
                    'Todas dentro de su umbral individual'
                )}
                ${renderSection(
                    '🏥 Lesionadas / Rehab',
                    injured.length,
                    injured.length ? 'pss-badge--red' : 'pss-badge--ok',
                    injRows,
                    'Sin lesiones activas'
                )}
                ${renderSection(
                    '📉 Wellness bajo 3+ días consecutivos',
                    wellnessTrend.length,
                    wellnessTrend.length ? 'pss-badge--purple' : 'pss-badge--ok',
                    trendRows,
                    'Sin tendencias negativas'
                )}
                `}
                ${clearPlayers.length > 0 && !allClear ? `
                <div class="pss-clear-row">
                    ✅ <strong>${clearPlayers.length} jugadora${clearPlayers.length !== 1 ? 's' : ''}</strong> sin alertas:
                    ${clearPlayers.map(p => `<span class="pss-clear-chip">${p.name.split(' ')[0]}</span>`).join('')}
                </div>` : ''}
            </div>
        </div>`;
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

        const getStatus = (r, playerId) => {
            const n = parseFloat(r);
            if (isNaN(n) || r === 'N/A') return { color: '#9e9e9e', icon: '⚪', label: 'Sin datos' };
            const _tP = this.getPlayerThresholds(playerId || null);
            if (n > _tP.high) return { color: '#e53935', icon: '🔴', label: 'Peligro' };
            if (n > _tP.opt)  return { color: '#fb8c00', icon: '🟠', label: 'Precaución' };
            if (n < _tP.low)  return { color: '#1e88e5', icon: '🔵', label: 'Por debajo' };
            return           { color: '#43a047', icon: '🟢', label: 'Óptimo' };
        };

        const pills = this.players.map(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const st = getStatus(ratio.ratio, player.id);
            const ratioDisplay = ratio.ratio === 'N/A' ? '—' : ratio.ratio;
            const avatar = PlayerTokens.avatar(player, 22, '0.6rem');
            return `<div class="sema-pill" style="--sema-color:${st.color}" title="${esc(player.name)} · Ratio A:C ${ratioDisplay} · ${st.label}"
                onclick="window.rpeTracker?.scrollToPlayerChart('${player.id}')">
                ${avatar}
                <span class="sema-name">${esc(player.name)}${player.number ? ' <span class="sema-num">#'+esc(player.number)+'</span>' : ''}</span>
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
        // Legacy: tab switching removed, single scrollable view
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

        // Season comparison selectors
        const allSeasons = Store.getSeasonsFromSessions(this.sessions);
        const activeSeason = Store.getActiveSeason();
        const selA = this._acSeasonA || activeSeason;
        const selB = this._acSeasonB || '';

        const seasonOpts = (current, allowEmpty) =>
            (allowEmpty ? `<option value="">— sin comparar —</option>` : '') +
            allSeasons.map(s =>
                `<option value="${s}" ${s === current ? 'selected' : ''}>${s}</option>`
            ).join('');

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
            <div class="ac-season-compare-row">
                <span class="ac-season-label">🗓️ Temporada A</span>
                <select class="ac-season-sel" id="acSeasonSelA"
                    onchange="window.rpeTracker?._acSetSeasonA(this.value)">
                    ${seasonOpts(selA, false)}
                </select>
                <span class="ac-season-sep">vs</span>
                <span class="ac-season-label">Temporada B</span>
                <select class="ac-season-sel" id="acSeasonSelB"
                    onchange="window.rpeTracker?._acSetSeasonB(this.value)">
                    ${seasonOpts(selB, true)}
                </select>
            </div>
            <div class="ac-curve-chart-wrap">
                <canvas id="acCurveCanvas" style="width:100%;height:300px"></canvas>
            </div>
            <div class="ac-curve-legend">
                <span class="ac-legend-line" style="background:#e53935;opacity:.25;height:2px;width:20px;display:inline-block;vertical-align:middle"></span>
                <span style="font-size:.72rem;color:var(--text-faint)">Zona peligro &gt;1.5</span>
                <span class="ac-legend-line" style="background:#fb8c00;opacity:.25;height:2px;width:20px;display:inline-block;vertical-align:middle;margin-left:.75rem"></span>
                <span style="font-size:.72rem;color:var(--text-faint)">Zona precaución 1.3–1.5</span>
                <span style="font-size:.72rem;color:var(--text-faint);margin-left:.75rem">— línea sólida: Temporada A &nbsp;· · · discontinua: Temporada B</span>
            </div>
        </div>`;
    }

    _drawACCurveChart() {
        const canvas = document.getElementById('acCurveCanvas');
        if (!canvas || typeof Chart === 'undefined') return;
        if (canvas._ci) { canvas._ci.destroy(); canvas._ci = null; }

        const days    = this._acWindow || 28;
        const now     = new Date();
        const labels  = [];
        for (let d = days - 1; d >= 0; d--) {
            const dt = new Date(now);
            dt.setDate(now.getDate() - d);
            labels.push(dt.toLocaleDateString('es-ES', { day:'numeric', month:'short' }));
        }

        const excluded = this._acExcluded || new Set();
        const lambdaA  = 2 / (7 + 1);
        const lambdaC  = 2 / (28 + 1);
        const seasonA  = this._acSeasonA || Store.getActiveSeason();
        const seasonB  = this._acSeasonB || '';

        // Helper: construye serie de ratio EWMA filtrada por temporada
        const buildRatioSeries = (player, seasonFilter) => {
            const psess = this.sessions
                .filter(s => s.playerId === player.id &&
                    (seasonFilter ? (s.season || Store.getActiveSeason()) === seasonFilter : true))
                .map(s => ({ date: new Date(s.date), load: s.load || s.rpe * (s.duration || 60) }))
                .sort((a,b) => a.date - b.date);
            const seed = psess.length ? psess.reduce((acc,x) => acc + x.load, 0) / psess.length : 0;
            let ewA = seed, ewC = seed;
            const ratiosByDay = {};
            for (let i = 84; i >= 0; i--) {
                const d = new Date(now); d.setDate(now.getDate() - i); d.setHours(0,0,0,0);
                const load = psess.filter(s => {
                    const sd = new Date(s.date); sd.setHours(0,0,0,0);
                    return sd.getTime() === d.getTime();
                }).reduce((acc,x) => acc + x.load, 0);
                ewA = lambdaA * load + (1 - lambdaA) * ewA;
                ewC = lambdaC * load + (1 - lambdaC) * ewC;
                if (i < days) {
                    ratiosByDay[days - 1 - i] = ewC > 0 ? parseFloat((ewA / ewC).toFixed(3)) : null;
                }
            }
            return Array.from({length: days}, (_, i) => ratiosByDay[i] ?? null);
        };

        const datasets = [];
        const activePlayers = this.players.filter(p => !excluded.has(p.id));

        activePlayers.forEach(p => {
            const color = PlayerTokens.get(p);
            const label = p.name + (p.number ? ` #${p.number}` : '');

            // Serie A — línea sólida
            datasets.push({
                label: `${label} (${seasonA})`,
                data: buildRatioSeries(p, seasonA),
                borderColor: color,
                backgroundColor: color + '18',
                borderWidth: 2,
                borderDash: [],
                pointRadius: 2,
                tension: 0.35,
                spanGaps: true
            });

            // Serie B — línea discontinua, mismo color, sin relleno
            if (seasonB) {
                datasets.push({
                    label: `${label} (${seasonB})`,
                    data: buildRatioSeries(p, seasonB),
                    borderColor: color,
                    backgroundColor: 'transparent',
                    borderWidth: 2,
                    borderDash: [6, 4],
                    pointRadius: 2,
                    pointStyle: 'triangle',
                    tension: 0.35,
                    spanGaps: true
                });
            }
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
                    legend: {
                        position: 'bottom',
                        labels: {
                            boxWidth: 12, font: { size: 11 }, color: textC,
                            generateLabels: chart => chart.data.datasets.map((ds, i) => ({
                                text: ds.label,
                                fillStyle: ds.borderColor,
                                strokeStyle: ds.borderColor,
                                lineDash: ds.borderDash || [],
                                lineWidth: 2,
                                hidden: !chart.isDatasetVisible(i),
                                datasetIndex: i
                            }))
                        }
                    },
                    tooltip: { mode: 'index', intersect: false,
                        callbacks: { label: ctx => `${ctx.dataset.label}: ${ctx.raw?.toFixed(2) ?? '—'}` }
                    },
                    annotation: { annotations: {
                        danger:  { type:'line', yMin:1.5, yMax:1.5, borderColor:'rgba(229,57,53,.4)',  borderWidth:1.5, borderDash:[4,4] },
                        caution: { type:'line', yMin:1.3, yMax:1.3, borderColor:'rgba(251,140,0,.35)', borderWidth:1.5, borderDash:[4,4] },
                        low:     { type:'line', yMin:0.8, yMax:0.8, borderColor:'rgba(30,136,229,.35)',borderWidth:1.5, borderDash:[4,4] }
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

    _acSetSeasonA(season) {
        this._acSeasonA = season;
        requestAnimationFrame(() => this._drawACCurveChart());
    }

    _acSetSeasonB(season) {
        this._acSeasonB = season;
        requestAnimationFrame(() => this._drawACCurveChart());
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

        this._renderSemaphoreBar();
        const ewmaOpen = Store.getString('ewmaOpen') === 'true';

        container.innerHTML = `
            <!-- 1. Curvas A:C — protagonista -->
            <div class="an-section-block">
                ${this._renderACCurveTab()}
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
                </details>
            </div>

            <!-- 2. Tabla comparativa -->
            <div class="an-section-block">
                ${this.renderPlayerComparison()}
            </div>

            <!-- 3. RPE Plan vs Real -->
            <div class="an-section-block" id="rpePlanVsRealBlock">
                ${this._renderRpePlanVsReal()}
            </div>

            <!-- 4. Evolución individual -->
            <div id="evolutionCharts"></div>

            <!-- 5. Comparador -->
            <div id="comparisonModule"></div>
        `;

        requestAnimationFrame(() => this._drawACCurveChart());
        this.renderEvolutionCharts();
        setTimeout(() => this.renderComparisonModule(), 50);
    }

    // ========== ACUTE:CHRONIC RATIO CALCULATION (EWMA METHOD) ==========

    // Match load multiplier: partidos generan mayor estrés fisiológico que
    // entrenamientos equivalentes en RPE×duración. Factor 1.5 basado en
    // literatura (Gabbett 2016, Hulin et al. 2016). Ajustar si es necesario.
    static get MATCH_LOAD_MULTIPLIER() { return 1.5; }


    // ========== INDIVIDUAL A:C THRESHOLDS ==========
    // Returns thresholds for a player, falling back to global defaults if not set.

    // getRatioColor accepts optional playerId for individual thresholds
    getRatioColor(ratio, playerId) {
        if (ratio === 'N/A') return '#999';
        const r = parseFloat(ratio);
        const t = this.getPlayerThresholds(playerId);
        if (r < t.low)   return '#1565c0'; // Blue - Detraining
        if (r <= t.opt)  return '#2e7d32'; // Green - Optimal
        if (r <= t.high) return '#ef6c00'; // Orange - Caution
        return '#c62828'; // Red - Danger
    }

    getRatioClass(ratio) {
        if (ratio === 'N/A') return 'ratio-safe';
        const r = parseFloat(ratio);
        const _tRC = this.getPlayerThresholds(null);
        if (r >= _tRC.low && r <= _tRC.opt) return 'ratio-safe';
        if (r > _tRC.opt && r <= _tRC.high) return 'ratio-caution';
        return 'ratio-danger';
    }

    getRatioStatus(ratio) {
        if (ratio === 'N/A') return 'Sin datos';
        const r = parseFloat(ratio);
        const _tRS = this.getPlayerThresholds(null); if (r < _tRS.low) return '⬇️ Descarga';
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
        // Seed inmediato desde localStorage para render inicial sin esperar Firebase
        const localStored = Store.getString('sessions');
        const localSessions = localStored ? JSON.parse(localStored) : [];

        // Guard: registrar listener UNA sola vez para evitar acumulación y sobreescritura
        if (window.firebaseSync && !this._sessionsListenerSet) {
            this._sessionsListenerSet = true;
            window.firebaseSync.onSessionsChange((updatedSessions) => {
                // Ignorar el snapshot reactivo inmediato cuando somos nosotros quienes
                // acabamos de hacer el write (evita que el listener machaque el push local)
                if (this._savingSessions) return;
                this.sessions = updatedSessions;
                this.renderSessions();
                if (this.currentView === 'dashboard') this.renderDashboard();
                if (window._devMode) console.log('🔄 Sesiones actualizadas desde Firebase');
            });
        } else if (!window.firebaseSync) {
            console.warn('⚠️ Firebase no disponible, usando localStorage');
        }
        return localSessions;
    }

    saveSessions() {
        // Invalidar caché de cálculos EWMA/AC al guardar sesiones
        if (typeof ACCache !== 'undefined') ACCache.invalidate();
        if (window.firebaseSync) {
            // Activar flag para que el listener reactivo no sobreescriba el estado local
            // mientras el write está en vuelo. Se desactiva al resolverse la promesa.
            this._savingSessions = true;
            window.firebaseSync.saveSessions(this.sessions).finally(() => {
                this._savingSessions = false;
            });
        } else {
            Store.set('sessions', this.sessions);
        }
    }

    loadPlayers() {
        // Seed inmediato desde localStorage para render inicial sin esperar Firebase
        const localStored = Store.getString('players');
        const localPlayers = localStored ? JSON.parse(localStored) : [];

        if (window.firebaseSync && !this._playersListenerSet) {
            this._playersListenerSet = true;
            window.firebaseSync.onPlayersChange((updatedPlayers) => {
                if (this._savingPlayers) return;
                this.players = updatedPlayers;
                this._ensurePlayerColors();
                this.renderPlayers();
                this.populatePlayerSelects();
                this.renderSessions();
                if (this.currentView === 'dashboard') this.renderDashboard();
                if (window._devMode) console.log('🔄 Jugadores actualizados desde Firebase');
            });
        } else if (!window.firebaseSync) {
            console.warn('⚠️ Firebase no disponible, usando localStorage');
        }
        return localPlayers;
    }

    savePlayers() {
        if (window.firebaseSync) {
            this._savingPlayers = true;
            window.firebaseSync.savePlayers(this.players).finally(() => {
                this._savingPlayers = false;
            });
        } else {
            Store.set('players', this.players);
        }
    }

    showToast(message, type = 'success') {
        // Remove existing toasts
        document.querySelectorAll('.toast').forEach(t => t.remove());

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);
        // Announce for screen readers
        if (typeof announceA11y === 'function') announceA11y(message);

        setTimeout(() => {
            toast.classList.add('hiding');
            setTimeout(() => toast.remove(), 280);
        }, 2500);
    }

    // ========== B) RPE PLAN VS REAL ==========

    _renderRpePlanVsReal() {
        const INTENSITY_RPE = { none: 0, low: 4, medium: 6, high: 7.5, max: 9 };
        const INTENSITY_LABEL = { none: 'Descanso', low: 'Baja', medium: 'Media', high: 'Alta', max: 'Máx.' };
        const DAY_KEYS = ['dom','lun','mar','mie','jue','vie','sab'];

        // Build lookup: { "YYYY-MM-DD_morning": { intensity, rpe, type, focus, duration }, ... }
        // Covering last 8 weeks with a sliding weekOffset per-week
        const planLookup = {};
        const plan = this.weekPlan?.days || {};

        // Reconstruct each week for the last 8 weeks by re-applying weekOffset logic
        // weekPlan.days is keyed by DAY_KEY (lun, mar…) — same plan repeats each week
        // We map sessions to the plan by day-of-week + timeOfDay slot
        // (The weekPlan is a template, not date-specific — same pattern each week)
        const planByDaySlot = {}; // { "lun_morning": {...}, "lun_afternoon": {...}, ... }
        DAY_KEYS.forEach(dk => {
            const d = plan[dk] || {};
            ['morning', 'afternoon'].forEach(slot => {
                const s = d[slot];
                if (s && s.enabled && s.type !== 'rest') {
                    planByDaySlot[`${dk}_${slot}`] = {
                        intensity: s.intensity || 'none',
                        plannedRpe: INTENSITY_RPE[s.intensity] || 0,
                        intensityLabel: INTENSITY_LABEL[s.intensity] || '—',
                        type: s.type || 'training',
                        focus: s.focus || '',
                        duration: s.duration || 0
                    };
                }
            });
        });

        // If no plan at all, show empty state
        const hasPlan = Object.keys(planByDaySlot).length > 0;

        // Build rows: for each session in last 8 weeks, try to match to plan slot
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - 56); // 8 weeks back
        const recentSessions = this.sessions.filter(s => {
            if (!s.date || !s.rpe) return false;
            return new Date(s.date) >= cutoff;
        });

        const rows = [];
        recentSessions.forEach(s => {
            const dateObj = new Date(s.date);
            const dayKey  = DAY_KEYS[dateObj.getDay()];
            const slot    = s.timeOfDay || 'morning';
            const lookupKey = `${dayKey}_${slot}`;
            const planSlot = planByDaySlot[lookupKey];
            if (!planSlot) return; // no plan for this slot — skip
            if (planSlot.plannedRpe === 0) return; // rest day — skip

            const player = this.players.find(p => p.id === s.playerId);
            if (!player) return;

            const delta = parseFloat((s.rpe - planSlot.plannedRpe).toFixed(1));
            const absDelta = Math.abs(delta);
            const isMismatch = absDelta >= 2;
            const isHighMismatch = absDelta >= 3;
            let deltaIcon = '', deltaColor = 'var(--text-secondary)';
            if (isMismatch) {
                deltaIcon = delta > 0 ? '▲' : '▼';
                deltaColor = isHighMismatch ? '#f44336' : '#ff9800';
            } else {
                deltaIcon = '✓';
                deltaColor = '#4caf50';
            }

            rows.push({
                date: s.date,
                dateObj,
                player,
                planSlot,
                rpe: s.rpe,
                delta,
                absDelta,
                isMismatch,
                isHighMismatch,
                deltaIcon,
                deltaColor,
                slot
            });
        });

        rows.sort((a, b) => b.dateObj - a.dateObj);

        const mismatches = rows.filter(r => r.isMismatch).length;
        const highMismatches = rows.filter(r => r.isHighMismatch).length;

        const fmtDate = d => {
            const dateOnly = String(d).slice(0, 10);
            const obj = new Date(dateOnly + 'T12:00:00');
            if (isNaN(obj.getTime())) return d;
            return obj.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
        };
        const fmtSlot = s => s === 'morning' ? '🌅 Mañana' : '🌆 Tarde';

        // Player filter state (stored on instance)
        const filterPlayer = this._pvr_playerFilter || 'all';

        const filteredRows = filterPlayer === 'all'
            ? rows
            : rows.filter(r => r.player.id === filterPlayer);

        const playerOptions = this.players
            .filter(p => rows.some(r => r.player.id === p.id))
            .map(p => `<option value="${p.id}"${filterPlayer === p.id ? ' selected' : ''}>${p.name}</option>`)
            .join('');

        const tableRows = filteredRows.length === 0
            ? `<tr><td colspan="6" class="pvr-empty">Sin sesiones con plan asignado en el período seleccionado</td></tr>`
            : filteredRows.map(r => `
            <tr class="pvr-row${r.isMismatch ? ' pvr-row--mismatch' : ''}${r.isHighMismatch ? ' pvr-row--high' : ''}">
                <td class="pvr-date">${fmtDate(r.date)}</td>
                <td class="pvr-player">
                    ${PlayerTokens.avatar(r.player, 20, '0.6rem')}
                    <span>${r.player.name.split(' ')[0]}</span>
                </td>
                <td class="pvr-slot">${fmtSlot(r.slot)}</td>
                <td class="pvr-plan">
                    <span class="pvr-intensity pvr-intensity--${r.planSlot.intensity}">${r.planSlot.intensityLabel}</span>
                    <span class="pvr-rpe-val">${r.planSlot.plannedRpe}</span>
                </td>
                <td class="pvr-real">
                    <span class="pvr-rpe-val pvr-rpe-real">${r.rpe}</span>
                </td>
                <td class="pvr-delta" style="color:${r.deltaColor}">
                    <span class="pvr-delta-icon">${r.deltaIcon}</span>
                    <span class="pvr-delta-val">${r.delta > 0 ? '+' : ''}${r.delta}</span>
                </td>
            </tr>`).join('');

        return `
        <div class="an-section-title-row">
            <h4 class="an-section-title">📋 RPE Planificado vs. Percibido</h4>
            ${mismatches > 0 ? `<span class="pvr-summary-badge pvr-summary-badge--warn">⚠️ ${mismatches} desajuste${mismatches !== 1 ? 's' : ''} ≥2 pts</span>` : ''}
            ${highMismatches > 0 ? `<span class="pvr-summary-badge pvr-summary-badge--crit">🔴 ${highMismatches} crítico${highMismatches !== 1 ? 's' : ''} ≥3 pts</span>` : ''}
            ${mismatches === 0 && rows.length > 0 ? `<span class="pvr-summary-badge pvr-summary-badge--ok">✅ Sin desajustes</span>` : ''}
        </div>
        ${!hasPlan ? `
        <div class="pvr-no-plan">
            <span>📅</span> No hay plan semanal configurado. Actívalo en la pestaña <strong>Planificación</strong> para cruzar los datos.
        </div>` : rows.length === 0 ? `
        <div class="pvr-no-plan">
            <span>📋</span> No hay sesiones recientes que coincidan con el plan semanal (últimas 8 semanas).
        </div>` : `
        <div class="pvr-controls">
            <label class="pvr-filter-label">Jugadora:
                <select class="pvr-player-select" onchange="window.rpeTracker?._pvrSetFilter(this.value)">
                    <option value="all"${filterPlayer === 'all' ? ' selected' : ''}>Todas</option>
                    ${playerOptions}
                </select>
            </label>
            <span class="pvr-legend">
                <span style="color:#4caf50">✓ OK</span>
                <span style="color:#ff9800">▲▼ ≥2 pts</span>
                <span style="color:#f44336">▲▼ ≥3 pts (crítico)</span>
            </span>
        </div>
        <div class="pvr-table-wrap">
            <table class="pvr-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Jugadora</th>
                        <th>Sesión</th>
                        <th>RPE Plan</th>
                        <th>RPE Real</th>
                        <th>Δ</th>
                    </tr>
                </thead>
                <tbody>${tableRows}</tbody>
            </table>
        </div>`}`;
    }

    _pvrSetFilter(playerId) {
        this._pvr_playerFilter = playerId;
        const block = document.getElementById('rpePlanVsRealBlock');
        if (block) block.innerHTML = this._renderRpePlanVsReal();
    }

    // ========== FEATURE 1: EVOLUTION CHARTS ==========
    
    // ========== FOSTER MONOTONY & STRAIN ==========

    /**
     * Calcula monotonía y strain de Foster para los últimos 7 días.
     * monotonía = media7d / SD7d  (SD poblacional)
     * strain    = carga_total_7d × monotonía
     * Requiere al menos 2 días con carga > 0 para SD significativa.
     */
    _calcFosterMetrics(playerId) {
        const MATCH_MULT = RPETracker.MATCH_LOAD_MULTIPLIER;
        const now = new Date();
        const dailyLoads = [];
        for (let i = 6; i >= 0; i--) {
            const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - i); dayStart.setHours(0,0,0,0);
            const dayEnd   = new Date(dayStart); dayEnd.setHours(23,59,59,999);
            const load = this.sessions
                .filter(s => s.playerId === playerId)
                .filter(s => { const sd = new Date(s.date); return sd >= dayStart && sd <= dayEnd; })
                .reduce((sum, s) => sum + (s.load || (s.rpe * (s.duration || 60))) * (s.type === 'match' ? MATCH_MULT : 1), 0);
            dailyLoads.push(load);
        }
        const total7d = dailyLoads.reduce((a, b) => a + b, 0);
        const mean7d  = total7d / 7;
        const variance = dailyLoads.reduce((acc, v) => acc + Math.pow(v - mean7d, 2), 0) / 7;
        const sd7d    = Math.sqrt(variance);
        const monotony = sd7d > 0 ? mean7d / sd7d : null;
        const strain   = monotony !== null ? total7d * monotony : null;
        return { dailyLoads, total7d: Math.round(total7d), mean7d: Math.round(mean7d), sd7d: Math.round(sd7d), monotony, strain };
    }

    /**
     * Renderiza el panel Foster (monotonía + strain) para una jugadora.
     * Semáforo: monotonía > 2 → alerta; strain > 6000 → alerta.
     */
    _renderFosterBlock(player) {
        const m = this._calcFosterMetrics(player.id);
        if (m.total7d === 0) return `<div class="foster-block foster-block--empty">Sin carga en los últimos 7 días</div>`;

        const monoVal  = m.monotony !== null ? m.monotony.toFixed(2) : '—';
        const strainVal = m.strain !== null ? Math.round(m.strain).toLocaleString('es-ES') : '—';

        // Semáforo monotonía
        const monoCls = m.monotony === null ? 'foster-pill--neutral'
            : m.monotony > 2   ? 'foster-pill--danger'
            : m.monotony > 1.5 ? 'foster-pill--warning'
            : 'foster-pill--ok';
        const monoIcon = m.monotony === null ? '—' : m.monotony > 2 ? '🔴' : m.monotony > 1.5 ? '🟠' : '🟢';

        // Semáforo strain
        const strainCls = m.strain === null ? 'foster-pill--neutral'
            : m.strain > 6000 ? 'foster-pill--danger'
            : m.strain > 4500 ? 'foster-pill--warning'
            : 'foster-pill--ok';
        const strainIcon = m.strain === null ? '—' : m.strain > 6000 ? '🔴' : m.strain > 4500 ? '🟠' : '🟢';

        return `<div class="foster-block">
            <div class="foster-row">
                <div class="foster-metric">
                    <span class="foster-label">Monotonía</span>
                    <span class="foster-pill ${monoCls}">${monoIcon} ${monoVal}</span>
                    <span class="foster-hint">umbral &gt;2</span>
                </div>
                <div class="foster-metric">
                    <span class="foster-label">Strain</span>
                    <span class="foster-pill ${strainCls}">${strainIcon} ${strainVal} UA</span>
                    <span class="foster-hint">umbral &gt;6000</span>
                </div>
                <div class="foster-metric foster-metric--load">
                    <span class="foster-label">Carga 7d</span>
                    <span class="foster-value">${m.total7d.toLocaleString('es-ES')} UA</span>
                    <span class="foster-hint">media ${m.mean7d} · SD ${m.sd7d}</span>
                </div>
            </div>
        </div>`;
    }

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
            const _tDot = this.getPlayerThresholds(p.id); const dot = isNaN(r) ? '#999' : r > _tDot.high ? '#e53935' : r > _tDot.opt ? '#fb8c00' : r < _tDot.low ? '#1e88e5' : '#43a047';
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
                    ${this._renderFosterBlock(p)}
                </div>
            `).join('');

        // Build season chart section for each selected player
        const seasonChartsHTML = this.players
            .filter(p => selected.includes(p.id))
            .map(p => `
                <div class="chart-container">
                    <div class="chart-header">
                        <h4>${p.name}${p.number ? ` #${p.number}` : ''} — Temporada</h4>
                    </div>
                    <canvas id="season-chart-${p.id}" class="chart-canvas"></canvas>
                </div>
            `).join('');

        container.innerHTML = `
            <div class="evolution-section-header">
                <h3>📈 Evolución del Ratio A:C</h3>
                <div class="chart-chips-wrap">${chipsHTML}</div>
            </div>
            <div class="charts-grid">${chartsHTML}</div>
            <div class="evolution-section-header" style="margin-top:1.5rem">
                <h3>📅 Temporada — UA Semanal Acumulada</h3>
                <p style="margin:0;font-size:.8rem;color:var(--text-secondary)">
                    <span style="color:#e53935">●</span> Lesión &nbsp;
                    <span style="color:#fb8c00">●</span> Partido
                </p>
            </div>
            <div class="charts-grid" id="seasonChartsGrid">${seasonChartsHTML}</div>
        `;

        setTimeout(() => {
            this.players.filter(p => selected.includes(p.id)).forEach(p => {
                this.renderPlayerEvolutionChart(p.id, this._chartPeriods?.[p.id] || 30);
                this.renderPlayerSeasonChart(p.id);
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

        const MATCH_MULT = RPETracker.MATCH_LOAD_MULTIPLIER;
        const playerSessions = this.sessions
            .filter(s => s.playerId === playerId)
            .map(s => ({ ...s, date: new Date(s.date), load: (s.load || (s.rpe * (s.duration || 60))) * (s.type === 'match' ? MATCH_MULT : 1) }))
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
                            const _tPt = this.getPlayerThresholds(playerId);
                            if (v < _tPt.low)   return '#1565c0';
                            if (v <= _tPt.opt)  return '#2e7d32';
                            if (v <= _tPt.high) return '#ef6c00';
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
                            afterBody: (items) => {
                                const ratio = items.find(i => i.dataset.label === 'Ratio A:C');
                                if (!ratio) return [];
                                const v = ratio.raw;
                                if (v <= 0) return ['Estado: Sin datos'];
                                const _tTt = this.getPlayerThresholds(playerId);
                                if (v < _tTt.low)   return [`Estado: ⬇️ Descarga (${v.toFixed(2)})`];
                                if (v <= _tTt.opt)  return [`Estado: ✅ Óptimo (${v.toFixed(2)})`];
                                if (v <= _tTt.high) return [`Estado: ⚠️ Precaución (${v.toFixed(2)})`];
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

    // ========== SEASON CHART — UA semanal acumulada + lesiones + partidos ==========

    renderPlayerSeasonChart(playerId) {
        const canvasId = `season-chart-${playerId}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }

        const MATCH_MULT = RPETracker.MATCH_LOAD_MULTIPLIER;
        const playerSessions = this.sessions
            .filter(s => s.playerId === playerId)
            .map(s => ({
                ...s,
                date: s.date.slice(0, 10),
                load: (s.load || (s.rpe * (s.duration || 60))) * (s.type === 'match' ? MATCH_MULT : 1)
            }))
            .sort((a, b) => a.date.localeCompare(b.date));

        if (playerSessions.length === 0) return;

        // Bucket by ISO week string YYYY-Www
        const toISOWeek = (dateStr) => {
            const d = new Date(dateStr + 'T00:00:00');
            const day = d.getDay() || 7;
            d.setDate(d.getDate() + 4 - day);
            const yearStart = new Date(d.getFullYear(), 0, 1);
            const wk = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
            return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
        };

        const weekMap = {};
        const weekMatches = {};
        playerSessions.forEach(s => {
            const w = toISOWeek(s.date);
            weekMap[w] = (weekMap[w] || 0) + s.load;
            if (s.type === 'match') weekMatches[w] = true;
        });

        const weeks = Object.keys(weekMap).sort();
        const loads = weeks.map(w => Math.round(weekMap[w]));
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#ccc' : '#555';
        const gridColor = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';

        // Injury markers as vertical lines
        const playerInjuries = (this.injuries || []).filter(i => i.playerId === playerId && i.startDate);
        const injuryWeeks = playerInjuries.map(i => toISOWeek(i.startDate.slice(0, 10)));

        const injuryLinePlugin = {
            id: 'injuryLines',
            afterDraw(chart) {
                const { ctx, chartArea: ca, scales: { x } } = chart;
                if (!ca) return;
                ctx.save();
                weeks.forEach((w, i) => {
                    if (injuryWeeks.includes(w)) {
                        const xPos = x.getPixelForValue(i);
                        ctx.beginPath();
                        ctx.strokeStyle = 'rgba(229,57,53,0.85)';
                        ctx.lineWidth = 2;
                        ctx.setLineDash([4, 3]);
                        ctx.moveTo(xPos, ca.top);
                        ctx.lineTo(xPos, ca.bottom);
                        ctx.stroke();
                        ctx.setLineDash([]);
                    }
                });
                ctx.restore();
            }
        };

        // Match point colors
        const pointColors = weeks.map(w => weekMatches[w] ? '#fb8c00' : (isDark ? 'rgba(100,160,255,0.8)' : 'rgba(33,150,243,0.8)'));
        const pointRadius = weeks.map(w => weekMatches[w] ? 6 : 3);

        const instance = new Chart(canvas, {
            type: 'bar',
            plugins: [injuryLinePlugin],
            data: {
                labels: weeks.map(w => w.replace('-W', ' S')),
                datasets: [{
                    label: 'UA semanal',
                    data: loads,
                    backgroundColor: isDark ? 'rgba(100,160,255,0.55)' : 'rgba(33,150,243,0.45)',
                    borderColor:     isDark ? 'rgba(100,160,255,0.85)' : 'rgba(33,150,243,0.85)',
                    borderWidth: 1,
                    borderRadius: 3,
                    pointBackgroundColor: pointColors,
                    pointRadius: pointRadius
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 500 },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.96)',
                        titleColor: isDark ? '#fff' : '#111',
                        bodyColor: isDark ? '#ccc' : '#444',
                        borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        borderWidth: 1,
                        callbacks: {
                            afterLabel: (item) => {
                                const w = weeks[item.dataIndex];
                                const parts = [];
                                if (weekMatches[w]) parts.push('🏟️ Partido esta semana');
                                if (injuryWeeks.includes(w)) parts.push('🔴 Lesión registrada');
                                return parts;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        ticks: {
                            color: textColor,
                            font: { size: 10 },
                            maxRotation: 45,
                            autoSkip: true,
                            maxTicksLimit: 20
                        },
                        grid: { color: gridColor }
                    },
                    y: {
                        min: 0,
                        ticks: { color: textColor, font: { size: 10 } },
                        grid: { color: gridColor },
                        title: { display: true, text: 'UA', color: textColor, font: { size: 10 } }
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
            
            const _tAl = this.getPlayerThresholds(player.id);
            if (r > _tAl.high) {
                alerts.push({
                    type: 'danger',
                    icon: '🚨',
                    title: `ALERTA: ${esc(player.name)}`,
                    message: `Ratio A:C de ${ratio.ratio} - Alto riesgo de lesión. Reducir carga inmediatamente.`
                });
            } else if (r > _tAl.opt) {
                alerts.push({
                    type: 'warning',
                    icon: '⚠️',
                    title: `Precaución: ${esc(player.name)}`,
                    message: `Ratio A:C de ${ratio.ratio} - Riesgo moderado. Monitorizar carga de cerca.`
                });
            } else if (r < _tAl.low && ratio.sessions7d > 0) {
                alerts.push({
                    type: 'info',
                    icon: 'ℹ️',
                    title: `Descarga: ${esc(player.name)}`,
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
        // Show date range picker modal before exporting
        const existing = document.getElementById('csvExportModal');
        if (existing) existing.remove();

        const today = new Date().toISOString().slice(0, 10);
        const thirtyDaysAgo = new Date(); thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const thirtyAgo = thirtyDaysAgo.toISOString().slice(0, 10);

        const modal = document.createElement('div');
        modal.id = 'csvExportModal';
        modal.className = 'modal active';
        modal.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2>📥 Exportar CSV</h2>
                    <button class="btn-close" onclick="document.getElementById('csvExportModal').remove()">&times;</button>
                </div>
                <div class="form-group">
                    <label>Rango de fechas</label>
                    <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;">
                        <button class="btn-secondary csv-preset" data-days="7">Últimos 7d</button>
                        <button class="btn-secondary csv-preset" data-days="28">Últimas 4 sem</button>
                        <button class="btn-secondary csv-preset" data-days="90">3 meses</button>
                        <button class="btn-secondary csv-preset" data-days="0">Todo</button>
                    </div>
                    <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
                        <div class="filter-group">
                            <label>Desde:</label>
                            <input type="date" id="csvFrom" class="date-input" value="${thirtyAgo}">
                        </div>
                        <div class="filter-group">
                            <label>Hasta:</label>
                            <input type="date" id="csvTo" class="date-input" value="${today}">
                        </div>
                    </div>
                </div>
                <div class="form-group">
                    <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;">
                        <input type="checkbox" id="csvIncludeEWMA" checked> Incluir columnas EWMA (aguda, crónica, ratio A:C)
                    </label>
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('csvExportModal').remove()">Cancelar</button>
                    <button class="btn-primary" onclick="window.rpeTracker?._doExportCSV()">📥 Descargar CSV</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        // Preset buttons
        modal.querySelectorAll('.csv-preset').forEach(btn => {
            btn.addEventListener('click', () => {
                const days = parseInt(btn.dataset.days);
                const toDate = new Date().toISOString().slice(0, 10);
                if (days === 0) {
                    document.getElementById('csvFrom').value = '';
                    document.getElementById('csvTo').value = toDate;
                } else {
                    const from = new Date(); from.setDate(from.getDate() - days);
                    document.getElementById('csvFrom').value = from.toISOString().slice(0, 10);
                    document.getElementById('csvTo').value = toDate;
                }
            });
        });

        modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
    }

    _doExportCSV() {
        const fromVal = document.getElementById('csvFrom')?.value;
        const toVal   = document.getElementById('csvTo')?.value;
        const includeEWMA = document.getElementById('csvIncludeEWMA')?.checked !== false;
        document.getElementById('csvExportModal')?.remove();

        const fromDate = fromVal ? new Date(fromVal + 'T00:00:00') : null;
        const toDate   = toVal   ? new Date(toVal   + 'T23:59:59') : null;

        // Filter sessions by range
        let sessions = [...this.sessions].sort((a, b) => new Date(a.date) - new Date(b.date));
        if (fromDate) sessions = sessions.filter(s => new Date(s.date) >= fromDate);
        if (toDate)   sessions = sessions.filter(s => new Date(s.date) <= toDate);

        // Pre-compute EWMA per player (full history, not range-filtered — ratio is cumulative)
        const ewmaCache = {};
        if (includeEWMA) {
            this.players.forEach(p => {
                ewmaCache[p.id] = this.calculateAcuteChronicRatio(p.id);
            });
        }

        const ewmaHeader = includeEWMA ? ',EWMA Aguda,EWMA Crónica,Ratio A:C,Estado A:C' : '';
        let csv = `Jugadora,Dorsal,Fecha,Hora del Día,Tipo,RPE,Duración (min),Carga (sRPE),Incidencias${ewmaHeader}\n`;

        sessions.forEach(session => {
            const player = this.players.find(p => p.id === session.playerId);
            const playerName   = player ? player.name : 'Desconocida';
            const playerNumber = player?.number || '';
            const date    = new Date(session.date);
            const dateStr = date.toLocaleDateString('es-ES');
            const timeOfDay = session.timeOfDay === 'morning' ? 'Mañana' : 'Tarde';
            const type  = {training:'Entrenamiento',match:'Partido',shooting:'Tiro',gym:'Gym',recovery:'Recuperación'}[session.type] || 'Entrenamiento';
            const load  = session.load || (session.rpe * (session.duration || 60));
            const notes = (session.notes || '').replace(/"/g, '""');

            let ewmaCols = '';
            if (includeEWMA && player) {
                const r = ewmaCache[player.id];
                const acute   = r ? r.acute.toFixed(1)   : 'N/A';
                const chronic = r ? r.chronic.toFixed(1) : 'N/A';
                const ratio   = r ? r.ratio              : 'N/A';
                const status  = r ? this.getRatioStatus(r.ratio) : 'Sin datos';
                ewmaCols = `,"${acute}","${chronic}","${ratio}","${status}"`;
            }

            csv += `"${playerName}","${playerNumber}","${dateStr}","${timeOfDay}","${type}",${session.rpe},${session.duration || 60},${load},"${notes}"${ewmaCols}\n`;
        });

        // Summary per player
        csv += '\n\nRESUMEN POR JUGADORA\n';
        const summaryEWMAHeader = includeEWMA ? ',EWMA Aguda,EWMA Crónica,Ratio A:C,Estado' : '';
        csv += `Jugadora,Dorsal,Total Sesiones,RPE Medio,Carga Total${summaryEWMAHeader}\n`;

        this.players.forEach(player => {
            const playerSessions = sessions.filter(s => s.playerId === player.id);
            const avgRPE = playerSessions.length > 0
                ? (playerSessions.reduce((sum, s) => sum + s.rpe, 0) / playerSessions.length).toFixed(1) : 0;
            const totalLoad = playerSessions.reduce((sum, s) => sum + (s.load || (s.rpe * (s.duration || 60))), 0);

            let ewmaSumCols = '';
            if (includeEWMA) {
                const r = ewmaCache[player.id];
                ewmaSumCols = r
                    ? `,"${r.acute.toFixed(1)}","${r.chronic.toFixed(1)}","${r.ratio}","${this.getRatioStatus(r.ratio)}"`
                    : ',"N/A","N/A","N/A","Sin datos"';
            }

            csv += `"${player.name}","${player.number || ''}",${playerSessions.length},${avgRPE},${totalLoad}${ewmaSumCols}\n`;
        });

        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        const now  = new Date();
        const rangeSuffix = fromVal ? `_${fromVal}_${toVal || 'hoy'}` : '_completo';
        link.setAttribute('href', url);
        link.setAttribute('download', `RPE_Basketball${rangeSuffix}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        this.showToast('📥 CSV exportado correctamente', 'info');
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

        const _tRec = this.getPlayerThresholds(playerId);
        if (r > _tRec.high) {
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
        } else if (r > _tRec.opt) {
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
        } else if (r < _tRec.low) {
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
                            label: (ctx) => {
                                const v = ctx.raw;
                                const _tChart = this.getPlayerThresholds(null);
                                const estado = v <= 0 ? 'Sin datos'
                                    : v < _tChart.low  ? '⬇️ Descarga'
                                    : v <= _tChart.opt ? '✅ Óptimo'
                                    : v <= _tChart.high? '⚠️ Precaución'
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
            const _tBadge = this.getPlayerThresholds(player.id);
            const statusBadge = ratio.ratio === 'N/A'
                ? `<span class="cmp-badge cmp-badge--grey">N/A</span>`
                : rVal < _tBadge.low
                    ? `<span class="cmp-badge cmp-badge--blue">⬇ Descarga</span>`
                    : rVal <= _tBadge.opt
                        ? `<span class="cmp-badge cmp-badge--green">✅ Óptimo</span>`
                        : rVal <= _tBadge.high
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
        // Initialise date range to last 4 weeks
        this._compRangeStart = (() => { const d = new Date(); d.setDate(d.getDate() - 28); return d.toISOString().slice(0,10); })();
        this._compRangeEnd   = new Date().toISOString().slice(0,10);
        this._injectCompDatePicker();
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

    _injectCompDatePicker() {
        const card = document.querySelector('#comparisonModule .comp-card');
        if (!card) return;

        const now = new Date();
        // Season start: 1 Sep of current or prior year
        const seasonYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
        const seasonStart = `${seasonYear}-09-01`;

        // Month start
        const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

        const pickerHTML = `
            <div class="comp-daterange" id="compDateRange">
                <div class="comp-dr-presets">
                    <button class="comp-dr-preset active" id="drPreset4w" onclick="window.rpeTracker?.setCompDatePreset('4w')">Últimas 4 semanas</button>
                    <button class="comp-dr-preset" id="drPresetMonth" onclick="window.rpeTracker?.setCompDatePreset('month')">Este mes</button>
                    <button class="comp-dr-preset" id="drPresetSeason" onclick="window.rpeTracker?.setCompDatePreset('season')">Temporada completa</button>
                </div>
                <div class="comp-dr-inputs">
                    <input type="date" id="compDateFrom" class="comp-dr-input" value="${this._compRangeStart}"
                           onchange="window.rpeTracker?._onCompDateChange()">
                    <span class="comp-dr-sep">→</span>
                    <input type="date" id="compDateTo" class="comp-dr-input" value="${this._compRangeEnd}"
                           onchange="window.rpeTracker?._onCompDateChange()">
                </div>
            </div>`;

        // Insert before comp-body-grid
        const bodyGrid = card.querySelector('.comp-body-grid');
        if (bodyGrid) bodyGrid.insertAdjacentHTML('beforebegin', pickerHTML);
    }

    setCompDatePreset(preset) {
        const now = new Date();
        let start;
        if (preset === '4w') {
            start = new Date(now); start.setDate(start.getDate() - 28);
        } else if (preset === 'month') {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
        } else { // season
            const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
            start = new Date(y, 8, 1); // 1 Sep
        }
        this._compRangeStart = start.toISOString().slice(0,10);
        this._compRangeEnd   = now.toISOString().slice(0,10);

        const fromEl = document.getElementById('compDateFrom');
        const toEl   = document.getElementById('compDateTo');
        if (fromEl) fromEl.value = this._compRangeStart;
        if (toEl)   toEl.value   = this._compRangeEnd;

        // Update active preset button
        ['4w','month','season'].forEach(p => {
            document.getElementById(`drPreset${p === '4w' ? '4w' : p === 'month' ? 'Month' : 'Season'}`)
                ?.classList.toggle('active', p === preset);
        });

        this.updateComparison();
    }

    _onCompDateChange() {
        const fromEl = document.getElementById('compDateFrom');
        const toEl   = document.getElementById('compDateTo');
        if (!fromEl || !toEl) return;
        this._compRangeStart = fromEl.value;
        this._compRangeEnd   = toEl.value;
        // Deactivate all presets when manually changed
        ['drPreset4w','drPresetMonth','drPresetSeason'].forEach(id => {
            document.getElementById(id)?.classList.remove('active');
        });
        this.updateComparison();
    }

    getCompStats(playerId) {
        const rangeStart = this._compRangeStart ? new Date(this._compRangeStart) : null;
        const rangeEnd   = this._compRangeEnd   ? new Date(this._compRangeEnd + 'T23:59:59') : null;

        const allSessions = this.sessions.filter(s => s.playerId === playerId);
        const sessions = (rangeStart && rangeEnd)
            ? allSessions.filter(s => { const d = new Date(s.date); return d >= rangeStart && d <= rangeEnd; })
            : allSessions;
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
        const rangeStart = this._compRangeStart ? new Date(this._compRangeStart) : null;
        const rangeEnd   = this._compRangeEnd   ? new Date(this._compRangeEnd + 'T23:59:59') : null;
        let sessions = this.sessions.filter(s => s.playerId === playerId);
        if (rangeStart && rangeEnd) {
            sessions = sessions.filter(s => { const d = new Date(s.date); return d >= rangeStart && d <= rangeEnd; });
        }
        const byWeek = {};
        sessions.forEach(s => {
            const d = new Date(s.date);
            const week = this.getWeekKey(d);
            if (!byWeek[week]) byWeek[week] = [];
            byWeek[week].push(s.rpe);
        });
        return Object.entries(byWeek)
            .map(([week, rpes]) => ({ week, rpe: rpes.reduce((a,b)=>a+b,0)/rpes.length }))
            .sort((a,b) => a.week.localeCompare(b.week));
    }

    getTeamWeeklyRPESeries() {
        const rangeStart = this._compRangeStart ? new Date(this._compRangeStart) : null;
        const rangeEnd   = this._compRangeEnd   ? new Date(this._compRangeEnd + 'T23:59:59') : null;
        let sessions = this.sessions;
        if (rangeStart && rangeEnd) {
            sessions = sessions.filter(s => { const d = new Date(s.date); return d >= rangeStart && d <= rangeEnd; });
        }
        const byWeek = {};
        sessions.forEach(s => {
            const week = this.getWeekKey(new Date(s.date));
            if (!byWeek[week]) byWeek[week] = [];
            byWeek[week].push(s.rpe);
        });
        return Object.entries(byWeek)
            .map(([week, rpes]) => ({ week, rpe: rpes.reduce((a,b)=>a+b,0)/rpes.length }))
            .sort((a,b) => a.week.localeCompare(b.week));
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
            return !isNaN(r) && r > this.getPlayerThresholds(player.id).opt;
        }).length;

        // Bottom-nav "Análisis" badge (A:C alerts)
        const alertBadge = document.getElementById('bnAlertBadge');
        if (alertBadge) {
            alertBadge.textContent = alertCount;
            alertBadge.style.display = alertCount > 0 ? '' : 'none';
        }

        // Drawer "Lesiones" badge (injury / wellness trend)
        const injBadge = document.getElementById('bnInjuryBadge');
        if (injBadge) {
            const trendAlerts = typeof this._wTrendAlerts === 'function' ? this._wTrendAlerts() : [];
            const total = trendAlerts.length;
            injBadge.textContent = total;
            injBadge.style.display = total > 0 ? '' : 'none';
        }

        // Update PWA app icon badge with count of critical A:C players
        PushNotifications.updateBadge(this);
    }
}

// Initialize app — managed by auth.js
let rpeTracker;

// ========== PUSH NOTIFICATIONS HELPER ==========
const PushNotifications = {

    // Send notification via SW message channel (no server needed)
    async send(title, body, tag) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        if (!navigator.serviceWorker?.controller) return;
        navigator.serviceWorker.controller.postMessage({ type: 'SHOW_NOTIFICATION', title, body, tag });
    },

    // Check all players for critical A:C after session save
    // Called with the tracker instance and array of playerIds that just got a session
    async checkACAlerts(tracker, playerIds) {
        if (!tracker || !playerIds?.length) return;
        let alertCount = 0;
        for (const pid of playerIds) {
            const player = tracker.players.find(p => p.id === pid);
            if (!player) continue;
            const ratio = tracker.calculateAcuteChronicRatio(pid);
            const r = parseFloat(ratio.ratio);
            if (isNaN(r)) continue;
            const thresh = tracker.getPlayerThresholds(pid);
            if (r > thresh.high) {
                alertCount++;
                await this.send(
                    `🔴 Alerta carga — ${esc(player.name)}`,
                    `Ratio A:C: ${ratio.ratio} — revisar carga`,
                    `ac-alert-${pid}`
                );
            }
        }
        return alertCount;
    },

    // Update PWA badge with count of players currently above critical threshold
    updateBadge(tracker) {
        if (!tracker) return;
        let count = 0;
        for (const player of tracker.players) {
            const ratio = tracker.calculateAcuteChronicRatio(player.id);
            const r = parseFloat(ratio.ratio);
            if (!isNaN(r)) {
                const thresh = tracker.getPlayerThresholds(player.id);
                if (r > thresh.high) count++;
            }
        }
        try {
            if ('setAppBadge' in navigator) {
                if (count > 0) navigator.setAppBadge(count);
                else navigator.clearAppBadge();
            }
        } catch(e) { /* silently ignore — not all browsers support setAppBadge */ }

        // Also update bottom-nav badge if present
        const badge = document.getElementById('bnAlertBadge');
        if (badge) { badge.textContent = count; badge.style.display = count > 0 ? '' : 'none'; }

        return count;
    }
};

// ========== WELLNESS DAILY REMINDER ==========
const WellnessReminder = {
    _intervalId: null,

    stop() {
        if (this._intervalId) { clearInterval(this._intervalId); this._intervalId = null; }
    },

    start() {
        if (this._intervalId) return; // already running
        this._intervalId = setInterval(() => this._check(), 60_000);
        this._check(); // immediate check on start
    },

    _check() {
        if (!AppAuth.isStaff()) return;
        if (Notification.permission !== 'granted') return;

        const reminderTime = Store.getString('reminderTime') || '08:30';
        const now = new Date();
        const [rHour, rMin] = reminderTime.split(':').map(Number);
        if (now.getHours() !== rHour || now.getMinutes() !== rMin) return;

        const today = now.toISOString().slice(0, 10);
        const lastSent = Store.getString('reminderSent');
        if (lastSent === today) return; // already sent today

        // Find players without wellness today
        const stored = Store.get('wellnessData') || [];
        const respondedToday = new Set(stored.filter(w => w.date === today).map(w => w.playerId));
        const allPlayers = Store.get('players') || [];
        const pending = allPlayers.filter(p => !respondedToday.has(p.id));

        if (!pending.length) return;

        const names = pending.slice(0, 5).map(p => p.name).join(', ');
        const extra = pending.length > 5 ? ` y ${pending.length - 5} más` : '';

        PushNotifications.send(
            '❤️ Recordatorio wellness',
            `Sin respuesta hoy: ${names}${extra}`,
            'wellness-reminder'
        );
        Store.setString('reminderSent', today);
    }
};

// Start wellness reminder when staff is logged in
window.addEventListener('load', () => {
    setTimeout(() => {
        if (AppAuth.isStaff()) WellnessReminder.start();
    }, 2000);
});

// ============================================================
//  migrateSessionSeasons()
//  Etiqueta con la temporada activa todas las sesiones sin
//  campo "season". Ejecutar desde la consola del navegador:
//
//      migrateSessionSeasons()
//      migrateSessionSeasons('2024-25')   // temporada específica
//
// ============================================================
window.migrateSessionSeasons = function(targetSeason) {
    const season = targetSeason || Store.getActiveSeason();
    if (!window.rpeTracker) {
        console.error('[migrate] rpeTracker no está inicializado.');
        return;
    }
    const sessions = window.rpeTracker.sessions;
    let count = 0;
    sessions.forEach(s => {
        if (!s.season) {
            s.season = season;
            count++;
        }
    });
    if (count === 0) {
        console.info('[migrate] Todas las sesiones ya tienen temporada asignada. Nada que hacer.');
        return;
    }
    window.rpeTracker.saveSessions();
    if (window.firebaseSync && typeof window.firebaseSync.saveSessions === 'function') {
        window.firebaseSync.saveSessions(sessions);
    }
    console.info(`[migrate] ✅ ${count} sesión(es) etiquetadas como temporada "${season}".`);
    // Actualizar la temporada activa en Store si no había ninguna guardada
    if (!Store.getString('currentSeason', '')) {
        Store.setString('currentSeason', season);
    }
};

// ─── Merged from improvements.js (V21) ───────────────────────────────────
// ========== EDIT SESSIONS ==========

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
        `<option value="${p.id}" ${p.id === session.playerId ? 'selected' : ''}>${p.name}${p.number ? ` #${p.number}` : ''}</option>`
    ).join('');
    
    // Open modal
    document.getElementById('editSessionModal').classList.add('active');
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

// ========== EDIT PLAYERS ==========

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

    document.getElementById('editPlayerModal').classList.add('active');
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


// ========== SEARCH AND FILTER ==========

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

// ========== SESSION TEMPLATES ==========

RPETracker.prototype.loadTemplates = function() {
    const stored = localStorage.getItem('basketballTemplates');
    return stored ? JSON.parse(stored) : [];
};

RPETracker.prototype.saveTemplates = function() {
    localStorage.setItem('basketballTemplates', JSON.stringify(this.templates || []));
};

RPETracker.prototype.createTemplate = async function() {
    const name = await AppPrompt.show('Nombre de la plantilla:', 'Entrenamiento técnico estándar', 'Nueva plantilla');
    if (!name) return;
    
    const rpeRaw = await AppPrompt.show('RPE típico (1-10):', '6', 'Nueva plantilla');
    const rpe = parseInt(rpeRaw);
    if (isNaN(rpe) || rpe < 1 || rpe > 10) { this.showToast('RPE debe ser entre 1 y 10'); return; }
    const durRaw = await AppPrompt.show('Duración en minutos:', '60', 'Nueva plantilla');
    const duration = parseInt(durRaw);
    if (isNaN(duration) || duration < 1 || duration > 300) { this.showToast('Duración inválida (1-300 min)'); return; }
    const type = 'training'; // Template type now set in session form
    const timeOfDay = 'afternoon'; // Template timeOfDay now set in session form
    
    const template = {
        id: Date.now().toString(),
        name,
        rpe,
        duration,
        type,
        timeOfDay
    };
    
    if (!this.templates) this.templates = [];
    this.templates.push(template);
    this.saveTemplates();
    this.showToast(`✅ Plantilla "${name}" creada`);
};

RPETracker.prototype.applyTemplate = function(templateId) {
    const template = this.templates?.find(t => t.id === templateId);
    if (!template) return;
    
    document.getElementById('rpeSlider').value = template.rpe;
    this.updateRPEDisplay(template.rpe);
    
    document.getElementById('sessionDuration').value = template.duration;
    
    if (template.timeOfDay === 'morning') {
        document.getElementById('timeMorning').checked = true;
    } else {
        document.getElementById('timeAfternoon').checked = true;
    }
    
    if (template.type === 'training') {
        document.getElementById('typeTraining').checked = true;
    } else {
        document.getElementById('typeMatch').checked = true;
    }
    
    this.showToast(`📋 Plantilla "${template.name}" aplicada`);
};

// ========== ADVANCED STATISTICS ==========

RPETracker.prototype.calculateAdvancedStats = function(playerId) {
    const playerSessions = this.sessions
        .filter(s => s.playerId === playerId)
        .map(s => ({
            ...s,
            date: new Date(s.date),
            load: s.load || (s.rpe * (s.duration || 60))
        }))
        .sort((a, b) => a.date - b.date);
    
    if (playerSessions.length < 2) {
        return {
            monotony: 0,
            strain: 0,
            trainingImpulse: 0,
            variance: 0
        };
    }
    
    // Get last 7 days
    const now = new Date();
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const lastWeekSessions = playerSessions.filter(s => s.date >= sevenDaysAgo);
    
    if (lastWeekSessions.length === 0) {
        return {
            monotony: 0,
            strain: 0,
            trainingImpulse: 0,
            variance: 0
        };
    }
    
    // Calculate weekly load
    const weeklyLoad = lastWeekSessions.reduce((sum, s) => sum + s.load, 0);
    
    // Calculate mean load
    const meanLoad = weeklyLoad / lastWeekSessions.length;
    
    // Calculate standard deviation
    const variance = lastWeekSessions.reduce((sum, s) => {
        return sum + Math.pow(s.load - meanLoad, 2);
    }, 0) / lastWeekSessions.length;
    
    const stdDev = Math.sqrt(variance);
    
    // Monotony = mean / stdDev (lower is better, means more variety)
    const monotony = stdDev > 0 ? meanLoad / stdDev : 0;
    
    // Strain = weekly load × monotony
    const strain = weeklyLoad * monotony;
    
    // Training Impulse (TRIMP approximation)
    const trainingImpulse = lastWeekSessions.reduce((sum, s) => {
        // Simplified TRIMP = duration × RPE
        return sum + (s.duration * s.rpe);
    }, 0);
    
    return {
        monotony: monotony.toFixed(2),
        strain: Math.round(strain),
        trainingImpulse: Math.round(trainingImpulse),
        variance: Math.round(variance),
        weeklyLoad: Math.round(weeklyLoad),
        meanLoad: Math.round(meanLoad),
        stdDev: Math.round(stdDev)
    };
};

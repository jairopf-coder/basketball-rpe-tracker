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

        // Cerrar modal activo con tecla Escape (WCAG 2.1 AA – criterio 2.1.2)
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            const staticIds = [
                'newSessionModal', 'detailModal', 'editSessionModal',
                'addPlayerModal', 'editPlayerModal'
            ];
            for (const id of staticIds) {
                const el = document.getElementById(id);
                if (el && el.classList.contains('active')) {
                    this.closeModal(id);
                    return;
                }
            }
            // Modales dinámicos (creados con createElement y class="modal active")
            const dynModal = document.querySelector('.modal.active:not([id])');
            if (dynModal) { dynModal.remove(); }
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
        // Limpiar estado de vista 'gym' al navegar fuera
        if (this.currentView === 'gym' && viewName !== 'gym') {
            if (this._gymSub || this._gymPlayerId) {
                this._gymSub = null; this._gymFilter = 'all';
                const p = this.players.find(p => p.id === this._gymPlayerId);
                if (!p) this._gymPlayerId = null;
            }
        }

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
    }

    _doAddPlayer(name, number) {
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
                this.players.map(p => `<option value="${p.id}">${esc(p.name)}${p.number ? ` #${p.number}` : ''}</option>`).join('');
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
        if (modalId === 'addPlayerModal'    && this._ftRelease2) { this._ftRelease2(); this._ftRelease2 = null; }
        if (modalId === 'detailModal'       && this._ftRelease3) { this._ftRelease3(); this._ftRelease3 = null; }
        if (modalId === 'editSessionModal'  && this._ftRelease4) { this._ftRelease4(); this._ftRelease4 = null; }
        if (modalId === 'editPlayerModal'   && this._ftRelease5) { this._ftRelease5(); this._ftRelease5 = null; }
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
            const dateKey = s.date.slice(0, 10);
            return `${dateKey}_${s.timeOfDay || 'unknown'}_${s.type || 'training'}`;
        }));
        return keys.size;
    }

    getUniqueSessions(sessions) {
        const seen = new Set();
        return sessions.filter(s => {
            const key = `${s.date.slice(0,10)}_${s.timeOfDay||'unknown'}_${s.type||'training'}`;
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









    // ========== ANALYTICS ==========


    // ========== ACUTE:CHRONIC RATIO CALCULATION (EWMA METHOD) ==========

    // Match load multiplier: partidos generan mayor estrés fisiológico que
    // entrenamientos equivalentes en RPE×duración. Factor 1.5 basado en
    // literatura (Gabbett 2016, Hulin et al. 2016). Ajustar si es necesario.
    static get MATCH_LOAD_MULTIPLIER() { return 1.5; }


    // ========== INDIVIDUAL A:C THRESHOLDS ==========
    // Returns thresholds for a player, falling back to global defaults if not set.

    // getRatioColor accepts optional playerId for individual thresholds



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



    // ========== FEATURE 1: EVOLUTION CHARTS ==========
    
    // ========== FOSTER MONOTONY & STRAIN ==========

    /**
     * Calcula monotonía y strain de Foster para los últimos 7 días.
     * monotonía = media7d / SD7d  (SD poblacional)
     * strain    = carga_total_7d × monotonía
     * Requiere al menos 2 días con carga > 0 para SD significativa.
     */

    /**
     * Renderiza el panel Foster (monotonía + strain) para una jugadora.
     * Semáforo: monotonía > 2 → alerta; strain > 6000 → alerta.
     */



    

    // ========== SEASON CHART — UA semanal acumulada + lesiones + partidos ==========


    // ========== FEATURE 2: ALERTS ==========
    
    checkAndShowAlerts() {
        const container = document.getElementById('alertsContainer');
        if (!container) return;
        
        const alerts = [];
        
        this.players.forEach(player => {
            const ratio = this.calculateAcuteChronicRatio(player.id);
            const r = parseFloat(ratio.ratio);
            
            if (ratio.ratio === 'N/A' || ratio.confidence === 'low') return;
            
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


    // ========== HELPER: SVG SPARKLINE INLINE ==========


    // ========== FEATURE 5: PLAYER COMPARISON ==========


    // ========== MÓDULO DE COMPARACIÓN ==========












    // ========== BATCH 2: SPARKLINE ==========


    // ========== BATCH 2: ROSTER DRAG-AND-DROP ==========


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

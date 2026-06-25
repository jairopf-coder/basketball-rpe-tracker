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
                { view: 'objectives', label: '🎯 Próximos objetivos' },
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
        this.wellnessData = this.loadWellnessData();
        this.currentSessionId = null;
        this.currentView = 'dashboard';
        this.currentPlayerFilter = 'all';
        this.currentTypeFilter = 'all';
        this.calendarYear = new Date().getFullYear();
        this.calendarMonth = new Date().getMonth();
        this.injuries = [];
        this.availability = {};
        this.weekPlan = null;
        this.matches = this.loadMatches(); // próximos objetivos / partidos
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

        // Show header action buttons only on dashboard view
        const _hpBtn = document.getElementById('headerPreSessionBtn');
        const _hwBtn = document.getElementById('headerWellnessBtn');
        if (_hpBtn) _hpBtn.style.display = viewName === 'dashboard' ? '' : 'none';
        if (_hwBtn) _hwBtn.style.display = viewName === 'dashboard' ? '' : 'none';

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
            case 'objectives':
                if (typeof this.renderObjectives === 'function') this.renderObjectives();
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
    



    /** Ensure every existing player has a color token (migration for old data) */

    /** Render an interactive color picker into a container element.
     *  @param {string} containerId  - id of the .token-color-picker div
     *  @param {string} hiddenInputId - id of the <input type="hidden"> that stores the value
     *  @param {string} selectedColor - color to pre-select
     */




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





    // ========== DASHBOARD ==========
    
    // Cuenta sesiones únicas de equipo (fecha + momento + tipo = 1 evento)


    // ========== READINESS SCORE ==========
    // Composite 0-100 score: sleep + mood - fatigue - soreness + A:C zone bonus
    // Returns null if no wellness data for today.








    // ── A) Pre-session Modal ───────────────────────────────────────────────





    // ── End Dashboard Mini Calendar ────────────────────────────────────────


    // ========== STICKY SEMAPHORE BAR ==========












    // Match load multiplier: partidos generan mayor estrés fisiológico que
    // entrenamientos equivalentes en RPE×duración. Factor 1.5 basado en
    // literatura (Gabbett 2016, Hulin et al. 2016). Ajustar si es necesario.
    static get MATCH_LOAD_MULTIPLIER() { return 1.5; }

    // ========== UTILITIES ==========

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
            // Ventana inicial: bloque de ~4 meses de la temporada actual
            // (ver getCurrentSeasonWindowStart en store.js). Reduce la carga
            // inicial de /sessions cuando hay varios años de histórico.
            this._sessionsWindowStart = getCurrentSeasonWindowStart();
            window.firebaseSync.onSessionsChange((updatedSessions) => {
                // Ignorar el snapshot reactivo inmediato cuando somos nosotros quienes
                // acabamos de hacer el write (evita que el listener machaque el push local)
                if (this._savingSessions) return;
                // Si ya se cargó el histórico completo, fusionar para no perder
                // sesiones antiguas que el listener filtrado no incluye.
                if (this._fullHistoryLoaded) {
                    this.sessions = this._mergeSessionsById(updatedSessions, this.sessions);
                } else {
                    this.sessions = updatedSessions;
                }
                this.renderSessions();
                if (this.currentView === 'dashboard') this.renderDashboard();
                if (window._devMode) console.log('🔄 Sesiones actualizadas desde Firebase');
            }, this._sessionsWindowStart);
        } else if (!window.firebaseSync) {
            console.warn('⚠️ Firebase no disponible, usando localStorage');
        }
        return localSessions;
    }

    // Fusiona dos arrays de sesiones por "id", sin duplicados.
    // `primary` tiene prioridad (sus versiones ganan en caso de colisión).
    _mergeSessionsById(primary, secondary) {
        const map = new Map();
        (secondary || []).forEach(s => map.set(s.id, s));
        (primary || []).forEach(s => map.set(s.id, s));
        return Array.from(map.values());
    }

    // Asegura que this.sessions contiene el histórico completo (todas las
    // temporadas), no solo la ventana de ~4 meses cargada al iniciar.
    // Usado por pdf-reports.js, app-comparisons.js e injury-prediction.js
    // antes de calcular sobre rangos largos. Idempotente: si ya se cargó,
    // resuelve inmediatamente.
    async ensureFullSessionHistory() {
        if (this._fullHistoryLoaded) return this.sessions;
        if (!window.firebaseSync) {
            this._fullHistoryLoaded = true; // sin Firebase, localStorage ya es "todo"
            return this.sessions;
        }
        const all = await window.firebaseSync.loadAllSessions();
        this.sessions = this._mergeSessionsById(all, this.sessions);
        this._fullHistoryLoaded = true;
        return this.sessions;
    }

    // Handler del botón "Cargar histórico" del dashboard.
    async loadFullHistoryFromButton() {
        const btn = document.getElementById('loadFullHistoryBtn');
        if (this._fullHistoryLoaded) {
            this.showToast('✅ El histórico completo ya está cargado');
            if (btn) btn.style.display = 'none';
            return;
        }
        if (btn) {
            btn.disabled = true;
            btn.querySelector('.dqa-label').textContent = 'Cargando…';
        }
        await this.ensureFullSessionHistory();
        this.renderSessions();
        if (this.currentView === 'dashboard') this.renderDashboard();
        this.showToast(`📜 Histórico completo cargado (${this.sessions.length} sesiones)`);
        if (btn) btn.style.display = 'none';
    }

    async saveSessions() {
        // Invalidar caché de cálculos EWMA/AC al guardar sesiones
        if (typeof ACCache !== 'undefined') ACCache.invalidate();
        if (window.firebaseSync) {
            // IMPORTANTE: saveSessions hace set() sobre /sessions completo.
            // Si solo tenemos cargada la ventana de ~4 meses, debemos traer
            // el histórico completo ANTES de guardar, o se borrarían las
            // sesiones de meses anteriores fuera de la ventana actual.
            await this.ensureFullSessionHistory();
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

    saveMatches() {
        if (window.firebaseSync) {
            window.firebaseSync.saveMatches(this.matches);
        } else {
            Store.set('matches', this.matches);
        }
    }

    loadMatches() {
        const local = Store.get('matches');
        if (window.firebaseSync && !this._matchesListenerSet) {
            this._matchesListenerSet = true;
            window.firebaseSync.onMatchesChange((updated) => {
                this.matches = updated.sort((a, b) => a.date.localeCompare(b.date));
                if (this.currentView === 'objectives') this.renderObjectives();
                if (this.currentView === 'dashboard') this.renderDashboard();
            });
        }
        return Array.isArray(local) ? local.sort((a, b) => a.date.localeCompare(b.date)) : [];
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




// ========== EDIT PLAYERS ==========




// ========== SEARCH AND FILTER ==========



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

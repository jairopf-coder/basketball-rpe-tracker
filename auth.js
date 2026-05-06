// ========== SISTEMA DE ACCESO CON PIN ==========
// Roles: 'trainer' (preparador físico), 'physio' (fisio),
//        'coach' (entrenador jefe), 'player' (jugadoras)

const AppAuth = {

    // ---- PINs por defecto ----
    defaults: { trainer: '1111', physio: '2222', coach: '3333', player: '0000' },

    getPin(role) {
        // Retrocompatibilidad: 'coachPin' antiguo → trainer
        if (role === 'trainer') {
            return localStorage.getItem('trainerPin')
                || localStorage.getItem('coachPin')   // legacy mapping
                || this.defaults.trainer;
        }
        return localStorage.getItem(role + 'Pin') || this.defaults[role] || '0000';
    },

    // Legacy helpers usados por código existente
    getCoachPin()  { return this.getPin('trainer'); },
    getPlayerPin() { return this.getPin('player'); },

    getRole() {
        return sessionStorage.getItem('appRole'); // 'trainer'|'physio'|'coach'|'player'|null
    },

    isStaff() {
        return ['trainer','physio','coach'].includes(this.getRole());
    },

    setRole(role) {
        sessionStorage.setItem('appRole', role);
    },

    logout() {
        sessionStorage.removeItem('appRole');
        location.reload();
    },

    // ---- Guardar wellness ----
    async saveWellness(playerId, answers) {
        const entry = {
            playerId,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().slice(0, 10),
            sleep: answers.sleep,
            fatigue: answers.fatigue,
            pain: answers.pain,
        };
        try {
            if (window.firebaseDB) {
                const ref = window.firebaseDB.ref('wellness').push();
                await ref.set(entry);
            }
            const stored = JSON.parse(localStorage.getItem('wellnessData') || '[]');
            stored.push(entry);
            localStorage.setItem('wellnessData', JSON.stringify(stored));
            return true;
        } catch (e) {
            console.error('Error saving wellness:', e);
            const stored = JSON.parse(localStorage.getItem('wellnessData') || '[]');
            stored.push(entry);
            localStorage.setItem('wellnessData', JSON.stringify(stored));
            return true;
        }
    },

    loadWellnessData() {
        return JSON.parse(localStorage.getItem('wellnessData') || '[]');
    },

    hasAnsweredToday(playerId) {
        const today = new Date().toISOString().slice(0, 10);
        return this.loadWellnessData().some(w => w.playerId === playerId && w.date === today);
    },

    // ---- Pantalla PIN ----
    showPinScreen() {
        document.getElementById('app').style.display = 'none';

        const screen = document.createElement('div');
        screen.id = 'pin-screen';
        screen.innerHTML = `
            <div class="pin-container">
                <div class="pin-logo">🏀</div>
                <h1 class="pin-title">RPE Baloncesto</h1>
                <p class="pin-subtitle">Introduce tu PIN para acceder</p>

                <div class="pin-dots" id="pinDots">
                    <span class="pin-dot" id="d0"></span>
                    <span class="pin-dot" id="d1"></span>
                    <span class="pin-dot" id="d2"></span>
                    <span class="pin-dot" id="d3"></span>
                </div>

                <div id="pinError" class="pin-error" style="display:none">PIN incorrecto</div>

                <div class="pin-pad">
                    ${[1,2,3,4,5,6,7,8,9,'','0','⌫'].map(k => `
                        <button class="pin-key ${k===''?'pin-key-empty':''}"
                            onclick="AppAuth.handleKey('${k}')">${k}</button>
                    `).join('')}
                </div>

                <p class="pin-hint">Jugadoras: <strong>${this.getPin('player')}</strong> &nbsp;·&nbsp; Staff: PIN de cada rol</p>
            </div>
        `;
        document.body.insertBefore(screen, document.getElementById('app'));
        this._pin = '';
    },

    _pin: '',

    handleKey(key) {
        if (key === '⌫') {
            this._pin = this._pin.slice(0, -1);
        } else if (key !== '' && this._pin.length < 4) {
            this._pin += key;
        }
        for (let i = 0; i < 4; i++) {
            const dot = document.getElementById(`d${i}`);
            if (dot) dot.classList.toggle('filled', i < this._pin.length);
        }
        if (this._pin.length === 4) {
            setTimeout(() => this.checkPin(), 150);
        }
    },

    checkPin() {
        const errorEl = document.getElementById('pinError');
        const pin = this._pin;

        const staffRoles = ['trainer','physio','coach'];
        const matchedRole = staffRoles.find(r => pin === this.getPin(r));

        if (matchedRole) {
            this.setRole(matchedRole);
            document.getElementById('pin-screen').remove();
            document.getElementById('app').style.display = '';
            this._applyRoleNav(matchedRole);
            AppAuth.requestNotificationPermission();
            window.rpeTracker = new RPETracker();

        } else if (pin === this.getPin('player')) {
            this.setRole('player');
            document.getElementById('pin-screen').remove();
            this.showWellnessScreen();

        } else {
            if (errorEl) errorEl.style.display = 'block';
            const dots = document.getElementById('pinDots');
            if (dots) { dots.classList.add('shake'); setTimeout(() => dots.classList.remove('shake'), 400); }
            this._pin = '';
            for (let i = 0; i < 4; i++) {
                const dot = document.getElementById(`d${i}`);
                if (dot) dot.classList.remove('filled');
            }
            setTimeout(() => { if (errorEl) errorEl.style.display = 'none'; }, 2000);
        }
    },

    // ---- Aplicar nav reducida según rol ----
    _roleNavConfig: {
        trainer: [
            { group:'carga',       view:'microciclo', icon:'🏋️', label:'Carga' },
            { group:'carga',       view:'weekplan',   icon:'📅', label:'Microciclo' },
            { group:'rendimiento', view:'gym',        icon:'💪', label:'Gym' },
            { group:'rendimiento', view:'tests',      icon:'📊', label:'Tests' },
            { group:'carga',       view:'analytics',  icon:'📈', label:'Analytics' },
        ],
        physio: [
            { group:'salud', view:'injury',     icon:'🏥', label:'Lesiones' },
            { group:'salud', view:'rehab',      icon:'💪', label:'Rehab' },
            { group:'salud', view:'wellness',   icon:'❤️', label:'Wellness' },
            { group:'salud', view:'medical',    icon:'📋', label:'Notas' },
            { group:'salud', view:'prediction', icon:'🔮', label:'Predicción' },
        ],
        coach: [
            { group:'dashboard', view:'dashboard',    icon:'🏠', label:'Dashboard' },
            { group:'equipo',    view:'teamstatus',   icon:'🚦', label:'Estado' },
            { group:'carga',     view:'weekplan',     icon:'📅', label:'Planif.' },
            { group:'equipo',    view:'players',      icon:'👥', label:'Equipo' },
        ],
    },

    _applyRoleNav(role) {
        const config = this._roleNavConfig[role];
        if (!config) return; // fallback: no change

        // Replace bottom nav with role-specific tabs (keep ⚙️ accessible via gear btn)
        const bottomNav = document.getElementById('bottomNav');
        if (!bottomNav) return;

        // Build 3 primary tabs + ⚙️ gear (always last)
        const primary = config.slice(0, 3);
        const secondary = config.slice(3);

        bottomNav.innerHTML = primary.map(item => `
            <button class="bottom-nav-btn" data-bn-group="${item.group}" data-bn-view="${item.view}"
                    onclick="BottomNav.select(this)" aria-label="${item.label}">
                <span class="bn-icon">${item.icon}</span>
                <span class="bn-label">${item.label}</span>
            </button>
        `).join('') + `
            <button class="bottom-nav-btn" id="bnMoreBtn" onclick="BottomNav.toggleMore()" aria-label="Más opciones">
                <span class="bn-icon">⋯</span>
                <span class="bn-label">Más</span>
            </button>
        `;

        // Rebuild the "Más" drawer with secondary items
        const moreGrid = document.querySelector('#bnMoreMenu .bn-more-grid');
        if (moreGrid && secondary.length) {
            moreGrid.innerHTML = secondary.map(item => `
                <button class="bn-more-item" onclick="BottomNav.selectMore('${item.group}','${item.view}')" aria-label="${item.label}">
                    <span class="bn-more-icon">${item.icon}</span>
                    <span class="bn-more-label">${item.label}</span>
                </button>
            `).join('');
        }

        // Activate first tab
        const firstBtn = bottomNav.querySelector('.bottom-nav-btn');
        if (firstBtn) {
            firstBtn.classList.add('active');
            // Navigate to first view after rpeTracker is ready
            setTimeout(() => {
                if (window.rpeTracker) window.rpeTracker.switchView(primary[0].view);
            }, 200);
        }
    },

    addLogoutButton() {
        // Logout handled via gear menu — no-op kept for compatibility
    },

    // ---- Ajustes de PINs ----
    showPinSettings() {
        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'pinSettingsModal';
        modal.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2>⚙️ Gestión de PINs</h2>
                    <button class="btn-close" onclick="document.getElementById('pinSettingsModal').remove()">&times;</button>
                </div>

                ${['trainer','physio','coach','player'].map(role => {
                    const labels = { trainer:'Preparador físico', physio:'Fisioterapeuta', coach:'Entrenador jefe', player:'Jugadoras' };
                    return `
                    <div class="form-group">
                        <label>${labels[role]}</label>
                        <input type="number" id="newPin_${role}" placeholder="4 dígitos"
                            maxlength="4" style="width:100%;padding:0.75rem;border:2px solid var(--border-color,#ddd);border-radius:8px;font-size:1.2rem;letter-spacing:0.3em;text-align:center;"
                            value="${this.getPin(role)}">
                    </div>`;
                }).join('')}

                <div class="form-group" style="margin-top:1rem;">
                    <label>⏰ Recordatorio wellness</label>
                    <input type="time" id="wellnessReminderTime"
                        style="width:100%;padding:0.75rem;border:2px solid var(--border-color,#ddd);border-radius:8px;font-size:1rem;"
                        value="${localStorage.getItem('rpe_wellness_reminder_time') || '08:30'}">
                </div>

                <div style="margin-top:0.75rem;">
                    <button class="btn-secondary" style="width:100%;" onclick="AppAuth.showIOSInstallModal()">📲 Instalar en iPhone</button>
                </div>

                <div class="modal-footer" style="margin-top:1rem;">
                    <button class="btn-secondary" onclick="document.getElementById('pinSettingsModal').remove()">Cancelar</button>
                    <button class="btn-primary" onclick="AppAuth.savePins()">💾 Guardar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    savePins() {
        const roles = ['trainer','physio','coach','player'];
        const values = {};

        for (const role of roles) {
            const val = document.getElementById(`newPin_${role}`)?.value?.trim();
            if (!val || val.length !== 4 || !/^\d{4}$/.test(val)) {
                alert(`El PIN de ${role} debe tener exactamente 4 dígitos`);
                return;
            }
            values[role] = val;
        }

        // Check all PINs distinct
        const unique = new Set(Object.values(values));
        if (unique.size !== roles.length) {
            alert('Todos los PINs deben ser distintos entre sí');
            return;
        }

        for (const role of roles) {
            localStorage.setItem(role + 'Pin', values[role]);
        }
        // Clear legacy key to avoid retrocompat confusion after explicit save
        localStorage.removeItem('coachPin');

        // Save wellness reminder time
        const timeVal = document.getElementById('wellnessReminderTime')?.value;
        if (timeVal) localStorage.setItem('rpe_wellness_reminder_time', timeVal);

        document.getElementById('pinSettingsModal')?.remove();

        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.textContent = '✅ Ajustes guardados correctamente';
        document.body.appendChild(toast);
        setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 280); }, 2500);
    },

    // ---- iOS Install modal ----
    showIOSInstallModal() {
        const existing = document.getElementById('iosInstallModal');
        if (existing) { existing.remove(); return; }

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'iosInstallModal';
        modal.innerHTML = `
            <div class="modal-content modal-small">
                <div class="modal-header">
                    <h2>📲 Instalar en iPhone / iPad</h2>
                    <button class="btn-close" onclick="document.getElementById('iosInstallModal').remove()">&times;</button>
                </div>
                <p style="margin:0.5rem 0 1rem;color:var(--text-secondary,#666);font-size:0.9rem;">
                    Para añadir la app a tu pantalla de inicio sigue estos 3 pasos:
                </p>
                <div style="display:flex;flex-direction:column;gap:1.25rem;">

                    <div style="display:flex;align-items:center;gap:1rem;">
                        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="44" height="44" rx="10" fill="#007AFF"/>
                            <text x="22" y="29" text-anchor="middle" font-size="20" fill="white">1</text>
                        </svg>
                        <div>
                            <strong>Abre esta página en Safari</strong>
                            <p style="margin:0.2rem 0 0;font-size:0.85rem;color:var(--text-secondary,#666);">Debe ser el navegador Safari de Apple, no Chrome ni Firefox.</p>
                        </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:1rem;">
                        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="44" height="44" rx="10" fill="#34C759"/>
                            <!-- Share icon -->
                            <rect x="19" y="16" width="6" height="14" rx="1" fill="white"/>
                            <polygon points="22,10 17,17 27,17" fill="white"/>
                            <rect x="14" y="26" width="16" height="9" rx="2" fill="none" stroke="white" stroke-width="1.5"/>
                        </svg>
                        <div>
                            <strong>Pulsa el botón Compartir ⬆</strong>
                            <p style="margin:0.2rem 0 0;font-size:0.85rem;color:var(--text-secondary,#666);">El icono de caja con flecha en la barra inferior de Safari.</p>
                        </div>
                    </div>

                    <div style="display:flex;align-items:center;gap:1rem;">
                        <svg width="44" height="44" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <rect width="44" height="44" rx="10" fill="#FF9500"/>
                            <!-- Home screen icon -->
                            <rect x="13" y="14" width="18" height="18" rx="4" fill="none" stroke="white" stroke-width="1.8"/>
                            <line x1="22" y1="19" x2="22" y2="27" stroke="white" stroke-width="1.8"/>
                            <line x1="18" y1="23" x2="26" y2="23" stroke="white" stroke-width="1.8"/>
                        </svg>
                        <div>
                            <strong>Selecciona "Añadir a inicio"</strong>
                            <p style="margin:0.2rem 0 0;font-size:0.85rem;color:var(--text-secondary,#666);">Desplázate en el menú y toca "Añadir a pantalla de inicio". Pulsa Añadir.</p>
                        </div>
                    </div>

                </div>
                <div class="modal-footer" style="margin-top:1.5rem;">
                    <button class="btn-primary" style="width:100%;" onclick="document.getElementById('iosInstallModal').remove()">Entendido ✓</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    // ---- Notificaciones ----
    async requestNotificationPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    },

    // ========== PANTALLA DE WELLNESS PARA JUGADORAS ==========

    showWellnessScreen() {
        document.getElementById('app').style.display = 'none';

        const screen = document.createElement('div');
        screen.id = 'wellness-screen';
        screen.innerHTML = `
            <div class="wl-container">
                <div class="wl-header">
                    <div class="wl-logo">🏀</div>
                    <h1 class="wl-title">¿Cómo estás hoy?</h1>
                    <p class="wl-subtitle">Cuestionario de bienestar · ${new Date().toLocaleDateString('es-ES', {weekday:'long', day:'numeric', month:'long'})}</p>
                </div>

                <div id="wl-step-select" class="wl-step">
                    <p class="wl-label">Selecciona tu nombre</p>
                    <div id="wl-player-list" class="wl-player-list">
                        <div class="wl-loading">Cargando jugadoras...</div>
                    </div>
                </div>

                <div id="wl-step-questions" class="wl-step" style="display:none">
                    <div class="wl-player-selected" id="wl-selected-name"></div>

                    <div class="wl-question">
                        <div class="wl-q-label">😴 Calidad del sueño</div>
                        <div class="wl-q-sub">¿Cómo has dormido esta noche?</div>
                        <div class="wl-scale">
                            ${[1,2,3,4,5].map(v => `
                                <button class="wl-scale-btn" data-q="sleep" data-v="${v}" onclick="AppAuth.selectScale('sleep',${v})">
                                    <div class="wl-scale-num">${v}</div>
                                    <div class="wl-scale-lbl">${['Muy mal','Mal','Regular','Bien','Muy bien'][v-1]}</div>
                                </button>`).join('')}
                        </div>
                    </div>

                    <div class="wl-question">
                        <div class="wl-q-label">💪 Nivel de fatiga</div>
                        <div class="wl-q-sub">¿Cómo te sientes físicamente?</div>
                        <div class="wl-scale">
                            ${[1,2,3,4,5].map(v => `
                                <button class="wl-scale-btn" data-q="fatigue" data-v="${v}" onclick="AppAuth.selectScale('fatigue',${v})">
                                    <div class="wl-scale-num">${v}</div>
                                    <div class="wl-scale-lbl">${['Agotada','Muy cansada','Cansada','Bien','Fresca'][v-1]}</div>
                                </button>`).join('')}
                        </div>
                    </div>

                    <div class="wl-question">
                        <div class="wl-q-label">🦵 Dolor muscular</div>
                        <div class="wl-q-sub">¿Tienes molestias o dolor?</div>
                        <div class="wl-scale">
                            ${[1,2,3,4,5].map(v => `
                                <button class="wl-scale-btn" data-q="pain" data-v="${v}" onclick="AppAuth.selectScale('pain',${v})">
                                    <div class="wl-scale-num">${v}</div>
                                    <div class="wl-scale-lbl">${['Mucho dolor','Dolor','Algo','Leve','Sin dolor'][v-1]}</div>
                                </button>`).join('')}
                        </div>
                    </div>

                    <button class="wl-submit" id="wl-submit-btn" onclick="AppAuth.submitWellness()" disabled>
                        Enviar respuestas
                    </button>
                </div>

                <div id="wl-step-done" class="wl-step" style="display:none">
                    <div class="wl-done-icon">✅</div>
                    <h2 class="wl-done-title">¡Gracias!</h2>
                    <p class="wl-done-sub">Tus respuestas han sido enviadas al cuerpo técnico.</p>
                    <button class="wl-btn-secondary" onclick="AppAuth.resetWellness()">Responder de nuevo</button>
                </div>

                <button class="wl-logout" onclick="AppAuth.logout()">🔒 Salir</button>
            </div>
        `;
        document.body.appendChild(screen);

        this._wellness = { sleep: 0, fatigue: 0, pain: 0 };
        this._selectedPlayerId = null;
        this.loadPlayersForWellness();
    },

    loadPlayersForWellness() {
        const render = (players) => {
            const list = document.getElementById('wl-player-list');
            if (!list) return;
            if (!players.length) {
                list.innerHTML = '<div class="wl-loading">No hay jugadoras registradas</div>';
                return;
            }
            list.innerHTML = players.map(p => `
                <button class="wl-player-btn" onclick="AppAuth.selectPlayer('${p.id}', '${p.name.replace(/'/g,"\\'")}')">
                    <span class="wl-player-avatar">${p.name.charAt(0).toUpperCase()}</span>
                    <span class="wl-player-name">${p.name}${p.number ? ` #${p.number}` : ''}</span>
                </button>`).join('');
        };

        if (window.firebaseDB) {
            window.firebaseDB.ref('players').once('value').then(snap => {
                const data = snap.val();
                render(data ? Object.values(data) : []);
            }).catch(() => render(JSON.parse(localStorage.getItem('basketballPlayers') || '[]')));
        } else {
            render(JSON.parse(localStorage.getItem('basketballPlayers') || '[]'));
        }
    },

    selectPlayer(id, name) {
        this._selectedPlayerId = id;
        this._selectedPlayerName = name;

        if (this.hasAnsweredToday(id)) {
            document.getElementById('wl-step-select').style.display = 'none';
            document.getElementById('wl-step-done').style.display = '';
            document.querySelector('.wl-done-title').textContent = '¡Ya respondiste hoy!';
            document.querySelector('.wl-done-sub').textContent = 'Ya has enviado tu cuestionario de hoy. ¡Hasta mañana!';
            return;
        }

        document.getElementById('wl-step-select').style.display = 'none';
        document.getElementById('wl-step-questions').style.display = '';
        document.getElementById('wl-selected-name').textContent = `👤 ${name}`;
    },

    selectScale(question, value) {
        this._wellness[question] = value;
        document.querySelectorAll(`[data-q="${question}"]`).forEach(btn => {
            btn.classList.toggle('selected', parseInt(btn.dataset.v) === value);
        });
        const allAnswered = this._wellness.sleep > 0 && this._wellness.fatigue > 0 && this._wellness.pain > 0;
        const submitBtn = document.getElementById('wl-submit-btn');
        if (submitBtn) submitBtn.disabled = !allAnswered;
    },

    async submitWellness() {
        const btn = document.getElementById('wl-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }
        await this.saveWellness(this._selectedPlayerId, this._wellness);
        document.getElementById('wl-step-questions').style.display = 'none';
        document.getElementById('wl-step-done').style.display = '';
    },

    resetWellness() {
        this._wellness = { sleep: 0, fatigue: 0, pain: 0 };
        this._selectedPlayerId = null;
        document.getElementById('wl-step-done').style.display = 'none';
        document.getElementById('wl-step-select').style.display = '';
        this.loadPlayersForWellness();
    }
};

// ========== INICIALIZACIÓN ==========
window.addEventListener('load', () => {
    setTimeout(() => {
        const role = AppAuth.getRole();
        if (role === 'trainer' || role === 'physio' || role === 'coach') {
            document.getElementById('app').style.display = '';
            AppAuth._applyRoleNav(role);
            window.rpeTracker = new RPETracker();
        } else if (role === 'player') {
            AppAuth.showWellnessScreen();
        } else {
            AppAuth.showPinScreen();
        }
    }, 150);
});

// ========== SISTEMA DE ACCESO CON PIN ==========
// Roles: 'staff' (cuerpo técnico — ve todo), 'player' (jugadoras — solo wellness)

const AppAuth = {

    // ---- PINs ----
    defaults: { staff: '1234', player: '0000' },

    getPin(role) {
        // Retrocompatibilidad: legados coachPin / trainerPin → staff
        if (role === 'staff') {
            return localStorage.getItem('staffPin')
                || localStorage.getItem('trainerPin')
                || localStorage.getItem('coachPin')
                || this.defaults.staff;
        }
        return localStorage.getItem('playerPin') || this.defaults.player;
    },

    // Legacy helpers usados por código existente
    getCoachPin()  { return this.getPin('staff'); },
    getPlayerPin() { return this.getPin('player'); },

    getRole() { return sessionStorage.getItem('appRole'); }, // 'staff' | 'player' | null
    isStaff()  { return this.getRole() === 'staff'; },

    setRole(role) { sessionStorage.setItem('appRole', role); },

    logout() {
        sessionStorage.removeItem('appRole');
        location.reload();
    },

    // ---- Wellness persistence ----
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

    // ---- Detección de plataforma ----
    _platform() {
        const ua = navigator.userAgent;
        if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
        if (/android/i.test(ua)) return 'android';
        return 'desktop';
    },

    _isInstalledPWA() {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true; // iOS Safari
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
        if (this._pin.length === 4) setTimeout(() => this.checkPin(), 150);
    },

    checkPin() {
        const errorEl = document.getElementById('pinError');
        const pin = this._pin;

        if (pin === this.getPin('staff')) {
            this.setRole('staff');
            document.getElementById('pin-screen').remove();
            document.getElementById('app').style.display = '';
            AppAuth.requestNotificationPermission();
            window.rpeTracker = new RPETracker();

        } else if (pin === this.getPin('player')) {
            this.setRole('player');
            document.getElementById('pin-screen').remove();
            // Jugadoras deben tener la PWA instalada antes de continuar
            if (this._isInstalledPWA()) {
                this.showWellnessScreen();
            } else {
                this.showInstallGate();
            }

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

    addLogoutButton() { /* logout via gear menu — no-op */ },

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
                <div class="form-group">
                    <label>🏋️ Cuerpo técnico (PIN de acceso completo)</label>
                    <input type="number" id="newPin_staff" placeholder="4 dígitos"
                        maxlength="4" style="width:100%;padding:0.75rem;border:2px solid var(--border-color,#ddd);border-radius:8px;font-size:1.2rem;letter-spacing:0.3em;text-align:center;"
                        value="${this.getPin('staff')}">
                </div>
                <div class="form-group">
                    <label>👤 Jugadoras (PIN de wellness)</label>
                    <input type="number" id="newPin_player" placeholder="4 dígitos"
                        maxlength="4" style="width:100%;padding:0.75rem;border:2px solid var(--border-color,#ddd);border-radius:8px;font-size:1.2rem;letter-spacing:0.3em;text-align:center;"
                        value="${this.getPin('player')}">
                </div>
                <div class="form-group" style="margin-top:1rem;">
                    <label>⏰ Recordatorio wellness</label>
                    <input type="time" id="wellnessReminderTime"
                        style="width:100%;padding:0.75rem;border:2px solid var(--border-color,#ddd);border-radius:8px;font-size:1rem;"
                        value="${localStorage.getItem('rpe_wellness_reminder_time') || '08:30'}">
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
        const staffVal  = document.getElementById('newPin_staff')?.value?.trim();
        const playerVal = document.getElementById('newPin_player')?.value?.trim();

        if (!staffVal  || staffVal.length  !== 4 || !/^\d{4}$/.test(staffVal))  { alert('El PIN del cuerpo técnico debe tener 4 dígitos'); return; }
        if (!playerVal || playerVal.length !== 4 || !/^\d{4}$/.test(playerVal)) { alert('El PIN de las jugadoras debe tener 4 dígitos'); return; }
        if (staffVal === playerVal) { alert('Los dos PINs no pueden ser iguales'); return; }

        localStorage.setItem('staffPin',  staffVal);
        localStorage.setItem('playerPin', playerVal);
        // Limpiar keys legacy
        localStorage.removeItem('coachPin');
        localStorage.removeItem('trainerPin');

        const timeVal = document.getElementById('wellnessReminderTime')?.value;
        if (timeVal) localStorage.setItem('rpe_wellness_reminder_time', timeVal);

        document.getElementById('pinSettingsModal')?.remove();
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.textContent = '✅ Ajustes guardados correctamente';
        document.body.appendChild(toast);
        setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 280); }, 2500);
    },

    // ---- Notificaciones ----
    async requestNotificationPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') await Notification.requestPermission();
    },

    // ========== INSTALL GATE — jugadoras deben instalar PWA primero ==========
    showInstallGate() {
        const platform = this._platform();
        const existing = document.getElementById('install-gate');
        if (existing) existing.remove();

        const isIOS     = platform === 'ios';
        const isAndroid = platform === 'android';

        // Instrucciones según plataforma
        const steps = isIOS ? `
            <div class="ig-step">
                <div class="ig-step-num">1</div>
                <div class="ig-step-text">
                    <strong>Abre esta página en Safari</strong>
                    <span>Debe ser Safari de Apple, no Chrome ni otro navegador.</span>
                </div>
                ${this._svgSafari()}
            </div>
            <div class="ig-step">
                <div class="ig-step-num">2</div>
                <div class="ig-step-text">
                    <strong>Pulsa el botón Compartir</strong>
                    <span>El icono ⬆ en la barra inferior de Safari.</span>
                </div>
                ${this._svgShare()}
            </div>
            <div class="ig-step">
                <div class="ig-step-num">3</div>
                <div class="ig-step-text">
                    <strong>Toca "Añadir a pantalla de inicio"</strong>
                    <span>Desplázate en el menú y pulsa ese botón. Luego toca <em>Añadir</em>.</span>
                </div>
                ${this._svgAddHome()}
            </div>
        ` : isAndroid ? `
            <div class="ig-step">
                <div class="ig-step-num">1</div>
                <div class="ig-step-text">
                    <strong>Abre esta página en Chrome</strong>
                    <span>Usa Google Chrome para Android.</span>
                </div>
                ${this._svgChrome()}
            </div>
            <div class="ig-step">
                <div class="ig-step-num">2</div>
                <div class="ig-step-text">
                    <strong>Pulsa el menú ⋮ (tres puntos)</strong>
                    <span>En la esquina superior derecha de Chrome.</span>
                </div>
                ${this._svgMenuDots()}
            </div>
            <div class="ig-step">
                <div class="ig-step-num">3</div>
                <div class="ig-step-text">
                    <strong>Selecciona "Añadir a pantalla de inicio"</strong>
                    <span>O si aparece el banner de instalación, pulsa <em>Instalar</em>.</span>
                </div>
                ${this._svgAddHome()}
            </div>
        ` : `
            <div class="ig-step">
                <div class="ig-step-num">ℹ️</div>
                <div class="ig-step-text">
                    <strong>Abre esta página desde un móvil</strong>
                    <span>La app de wellness está pensada para iPhone o Android. Pide al cuerpo técnico la URL y ábrela desde tu teléfono.</span>
                </div>
            </div>
        `;

        const screen = document.createElement('div');
        screen.id = 'install-gate';
        screen.innerHTML = `
            <div class="ig-container">
                <div class="ig-logo">🏀</div>
                <h1 class="ig-title">Instala la app primero</h1>
                <p class="ig-subtitle">Para registrar tu wellness necesitas tener la app guardada en tu pantalla de inicio. Solo tarda 30 segundos.</p>

                <div class="ig-steps">
                    ${steps}
                </div>

                <div class="ig-confirm">
                    <p class="ig-confirm-label">Cuando la tengas instalada, ábrela desde tu pantalla de inicio y vuelve a entrar con tu PIN.</p>
                    <button class="ig-btn-already" onclick="AppAuth._checkInstallAndProceed()">
                        ✅ Ya la tengo instalada
                    </button>
                </div>

                <button class="wl-logout" onclick="AppAuth.logout()">🔒 Volver al inicio</button>
            </div>
        `;
        document.body.appendChild(screen);
    },

    _checkInstallAndProceed() {
        if (this._isInstalledPWA()) {
            document.getElementById('install-gate')?.remove();
            this.showWellnessScreen();
        } else {
            // Breve feedback de que aún no está instalada
            const btn = document.querySelector('.ig-btn-already');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = '⚠️ No detectada como instalada — ábrela desde inicio';
                btn.style.background = 'var(--danger, #c62828)';
                setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 3000);
            }
        }
    },

    // ---- SVG helpers para el install gate ----
    _svgSafari() {
        return `<svg class="ig-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="20" stroke="#007AFF" stroke-width="2.5" fill="none"/>
            <line x1="24" y1="8" x2="24" y2="11" stroke="#007AFF" stroke-width="2" stroke-linecap="round"/>
            <line x1="24" y1="37" x2="24" y2="40" stroke="#007AFF" stroke-width="2" stroke-linecap="round"/>
            <line x1="8" y1="24" x2="11" y2="24" stroke="#007AFF" stroke-width="2" stroke-linecap="round"/>
            <line x1="37" y1="24" x2="40" y2="24" stroke="#007AFF" stroke-width="2" stroke-linecap="round"/>
            <polygon points="24,14 27,28 24,26 21,28" fill="#007AFF"/>
        </svg>`;
    },
    _svgShare() {
        return `<svg class="ig-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="20" width="28" height="22" rx="4" stroke="#34C759" stroke-width="2.5" fill="none"/>
            <line x1="24" y1="6" x2="24" y2="28" stroke="#34C759" stroke-width="2.5" stroke-linecap="round"/>
            <polyline points="17,13 24,6 31,13" stroke="#34C759" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>`;
    },
    _svgAddHome() {
        return `<svg class="ig-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="8" y="12" width="32" height="28" rx="5" stroke="#FF9500" stroke-width="2.5" fill="none"/>
            <line x1="24" y1="21" x2="24" y2="32" stroke="#FF9500" stroke-width="2.5" stroke-linecap="round"/>
            <line x1="18" y1="26.5" x2="30" y2="26.5" stroke="#FF9500" stroke-width="2.5" stroke-linecap="round"/>
            <path d="M16 12 L16 9 Q16 7 18 7 L30 7 Q32 7 32 9 L32 12" stroke="#FF9500" stroke-width="2" fill="none"/>
        </svg>`;
    },
    _svgChrome() {
        return `<svg class="ig-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="24" cy="24" r="18" stroke="#4285F4" stroke-width="2.5" fill="none"/>
            <circle cx="24" cy="24" r="7" fill="#4285F4"/>
            <line x1="24" y1="6" x2="24" y2="17" stroke="#EA4335" stroke-width="5" stroke-linecap="round"/>
            <line x1="6" y1="33" x2="15.5" y2="17" stroke="#FBBC05" stroke-width="5" stroke-linecap="round"/>
            <line x1="42" y1="33" x2="32.5" y2="17" stroke="#34A853" stroke-width="5" stroke-linecap="round"/>
        </svg>`;
    },
    _svgMenuDots() {
        return `<svg class="ig-icon" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="10" y="6" width="28" height="36" rx="5" stroke="#666" stroke-width="2.5" fill="none"/>
            <circle cx="24" cy="16" r="2.5" fill="#666"/>
            <circle cx="24" cy="24" r="2.5" fill="#666"/>
            <circle cx="24" cy="32" r="2.5" fill="#666"/>
        </svg>`;
    },

    // ========== PANTALLA DE WELLNESS ==========

    showWellnessScreen() {
        const existing = document.getElementById('wellness-screen');
        if (existing) existing.remove();

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
            window.firebaseDB.ref('players').once('value')
                .then(snap => render(snap.val() ? Object.values(snap.val()) : []))
                .catch(() => render(JSON.parse(localStorage.getItem('basketballPlayers') || '[]')));
        } else {
            render(JSON.parse(localStorage.getItem('basketballPlayers') || '[]'));
        }
    },

    selectPlayer(id, name) {
        this._selectedPlayerId = id;
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
        if (role === 'staff') {
            document.getElementById('app').style.display = '';
            window.rpeTracker = new RPETracker();
        } else if (role === 'player') {
            if (AppAuth._isInstalledPWA()) {
                AppAuth.showWellnessScreen();
            } else {
                AppAuth.showInstallGate();
            }
        } else {
            AppAuth.showPinScreen();
        }
    }, 150);
});

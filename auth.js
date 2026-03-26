// ========== SISTEMA DE ACCESO CON PIN ==========

const AppAuth = {

    // PINs por defecto — el entrenador puede cambiarlos desde ajustes
    defaultCoachPin: '1234',
    defaultPlayerPin: '0000',

    getCoachPin() {
        return localStorage.getItem('coachPin') || this.defaultCoachPin;
    },

    getPlayerPin() {
        return localStorage.getItem('playerPin') || this.defaultPlayerPin;
    },

    getRole() {
        return sessionStorage.getItem('appRole'); // 'coach' | 'player' | null
    },

    setRole(role) {
        sessionStorage.setItem('appRole', role);
    },

    logout() {
        sessionStorage.removeItem('appRole');
        location.reload();
    },

    // Guardar respuesta de wellness en Firebase
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
            // Always save locally as backup
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

    // Load wellness data for coach view
    loadWellnessData() {
        return JSON.parse(localStorage.getItem('wellnessData') || '[]');
    },

    // Check if player already answered today
    hasAnsweredToday(playerId) {
        const today = new Date().toISOString().slice(0, 10);
        const stored = this.loadWellnessData();
        return stored.some(w => w.playerId === playerId && w.date === today);
    },

    // Render PIN screen
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

                <p class="pin-hint">Jugadoras: PIN <strong>${this.getPlayerPin()}</strong> &nbsp;·&nbsp; Cuerpo técnico: PIN personalizado</p>
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

        // Update dots
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

        if (this._pin === this.getCoachPin()) {
            this.setRole('coach');
            document.getElementById('pin-screen').remove();
            document.getElementById('app').style.display = '';
            this.addLogoutButton();
            // Init app
            window.rpeTracker = new RPETracker();

        } else if (this._pin === this.getPlayerPin()) {
            this.setRole('player');
            document.getElementById('pin-screen').remove();
            this.showWellnessScreen();

        } else {
            if (errorEl) { errorEl.style.display = 'block'; }
            // Shake and clear
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

    addLogoutButton() {
        const header = document.querySelector('.header-actions');
        if (!header) return;
        const btn = document.createElement('button');
        btn.className = 'btn-secondary';
        btn.style.cssText = 'font-size:0.8rem;padding:0.4rem 0.75rem;';
        btn.textContent = '🔒 Salir';
        btn.onclick = () => AppAuth.logout();
        header.appendChild(btn);

        // Add settings button for PIN management
        const settingsBtn = document.createElement('button');
        settingsBtn.className = 'btn-secondary';
        settingsBtn.style.cssText = 'font-size:0.8rem;padding:0.4rem 0.75rem;';
        settingsBtn.textContent = '⚙️ PINs';
        settingsBtn.onclick = () => AppAuth.showPinSettings();
        header.appendChild(settingsBtn);
    },

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
                    <label>PIN del cuerpo técnico (admin)</label>
                    <input type="number" id="newCoachPin" placeholder="4 dígitos"
                        maxlength="4" style="width:100%;padding:0.75rem;border:2px solid #ddd;border-radius:8px;font-size:1.2rem;letter-spacing:0.3em;text-align:center;"
                        value="${this.getCoachPin()}">
                </div>
                <div class="form-group">
                    <label>PIN de las jugadoras</label>
                    <input type="number" id="newPlayerPin" placeholder="4 dígitos"
                        maxlength="4" style="width:100%;padding:0.75rem;border:2px solid #ddd;border-radius:8px;font-size:1.2rem;letter-spacing:0.3em;text-align:center;"
                        value="${this.getPlayerPin()}">
                </div>
                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('pinSettingsModal').remove()">Cancelar</button>
                    <button class="btn-primary" onclick="AppAuth.savePins()">💾 Guardar PINs</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    },

    savePins() {
        const coachPin = document.getElementById('newCoachPin')?.value?.trim();
        const playerPin = document.getElementById('newPlayerPin')?.value?.trim();

        if (!coachPin || coachPin.length !== 4 || !/^\d{4}$/.test(coachPin)) {
            alert('El PIN del entrenador debe tener exactamente 4 dígitos');
            return;
        }
        if (!playerPin || playerPin.length !== 4 || !/^\d{4}$/.test(playerPin)) {
            alert('El PIN de las jugadoras debe tener exactamente 4 dígitos');
            return;
        }
        if (coachPin === playerPin) {
            alert('Los dos PINs no pueden ser iguales');
            return;
        }

        localStorage.setItem('coachPin', coachPin);
        localStorage.setItem('playerPin', playerPin);
        document.getElementById('pinSettingsModal')?.remove();

        // Show confirmation
        const toast = document.createElement('div');
        toast.className = 'toast success';
        toast.textContent = '✅ PINs actualizados correctamente';
        document.body.appendChild(toast);
        setTimeout(() => { toast.classList.add('hiding'); setTimeout(() => toast.remove(), 280); }, 2500);
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

        // Load players from Firebase or localStorage
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

        // Try Firebase first
        if (window.firebaseDB) {
            window.firebaseDB.ref('players').once('value').then(snap => {
                const data = snap.val();
                const players = data ? Object.values(data) : [];
                render(players);
            }).catch(() => {
                const stored = JSON.parse(localStorage.getItem('basketballPlayers') || '[]');
                render(stored);
            });
        } else {
            const stored = JSON.parse(localStorage.getItem('basketballPlayers') || '[]');
            render(stored);
        }
    },

    selectPlayer(id, name) {
        this._selectedPlayerId = id;
        this._selectedPlayerName = name;

        // Check if already answered today
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

        // Update button styles for this question
        document.querySelectorAll(`[data-q="${question}"]`).forEach(btn => {
            btn.classList.toggle('selected', parseInt(btn.dataset.v) === value);
        });

        // Enable submit if all answered
        const allAnswered = this._wellness.sleep > 0 && this._wellness.fatigue > 0 && this._wellness.pain > 0;
        const submitBtn = document.getElementById('wl-submit-btn');
        if (submitBtn) submitBtn.disabled = !allAnswered;
    },

    async submitWellness() {
        const btn = document.getElementById('wl-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

        const ok = await this.saveWellness(this._selectedPlayerId, this._wellness);

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
        if (role === 'coach') {
            // Already logged in as coach this session
            document.getElementById('app').style.display = '';
            AppAuth.addLogoutButton();
            window.rpeTracker = new RPETracker();
        } else if (role === 'player') {
            // Already logged in as player
            AppAuth.showWellnessScreen();
        } else {
            // Show PIN screen
            AppAuth.showPinScreen();
        }
    }, 150);
});

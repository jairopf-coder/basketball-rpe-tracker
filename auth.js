// ========== SISTEMA DE AUTENTICACIÓN — Firebase Auth ==========
// Roles: 'staff' (cuerpo técnico), 'fisio' (fisioterapeuta), 'player' (jugadora)
// Los roles se almacenan en /users/{uid}/role en Realtime Database.
// sessionStorage.appRole se sincroniza tras login para compatibilidad con el resto del código.

const AppAuth = {

    // ---- Estado interno ----
    _currentUser: null,   // firebase.User
    _currentRole: null,   // 'staff' | 'fisio' | 'player'

    // ---- API pública (compatibilidad con código existente) ----
    getRole()   { return this._currentRole || sessionStorage.getItem('appRole'); },
    isStaff()   { return this.getRole() === 'staff'; },
    isFisio()   { return this.getRole() === 'fisio'; },
    isPlayer()  { return this.getRole() === 'player'; },
    isStaffOrFisio() { return this.isStaff() || this.isFisio(); },

    logout() {
        // Detener reminder antes de limpiar sesión
        if (window.WellnessReminder) WellnessReminder.stop();
        const auth = window.firebaseAuth;
        if (auth) {
            auth.signOut().catch(() => {});
        }
        sessionStorage.removeItem('appRole');
        this._currentUser = null;
        this._currentRole = null;
        location.reload();
    },

    // ---- Leer rol desde /users/{uid}/role ----
    async _fetchRole(uid) {
        try {
            const snap = await window.firebaseDB.ref(`users/${uid}/role`).once('value');
            return snap.val(); // 'staff' | 'fisio' | 'player' | null
        } catch (e) {
            console.error('Error fetching role:', e);
            return null;
        }
    },

    // ---- Guardar rol en /users/{uid} (solo staff puede hacer esto) ----
    async _writeUserRecord(uid, email, role, displayName) {
        await window.firebaseDB.ref(`users/${uid}`).set({ email, role, displayName, createdAt: Date.now() });
    },

    // ---- Plataforma / PWA ----
    _platform() {
        const ua = navigator.userAgent;
        if (/iphone|ipad|ipod/i.test(ua)) return 'ios';
        if (/android/i.test(ua)) return 'android';
        return 'desktop';
    },

    _isInstalledPWA() {
        return window.matchMedia('(display-mode: standalone)').matches
            || window.navigator.standalone === true;
    },

    // ---- Notificaciones ----
    async requestNotificationPermission() {
        if (!('Notification' in window)) return;
        if (Notification.permission === 'default') await Notification.requestPermission();
    },

    // ==========================================
    //  PANTALLA DE LOGIN
    // ==========================================
    showLoginScreen(errorMsg) {
        document.getElementById('app').style.display = 'none';

        const existing = document.getElementById('login-screen');
        if (existing) existing.remove();

        const screen = document.createElement('div');
        screen.id = 'login-screen';
        screen.innerHTML = `
            <div class="login-container">
                <div class="login-logo">🏀</div>
                <h1 class="login-title">RPE Baloncesto</h1>
                <p class="login-subtitle">Accede con tu cuenta</p>

                <div class="login-form">
                    <div class="login-field">
                        <label class="login-label">Email</label>
                        <input
                            type="email"
                            id="login-email"
                            class="login-input"
                            placeholder="usuario@rpe.app"
                            autocomplete="email"
                            autocapitalize="none"
                            inputmode="email"
                        >
                    </div>
                    <div class="login-field">
                        <label class="login-label">Contraseña</label>
                        <div class="login-input-wrap">
                            <input
                                type="password"
                                id="login-password"
                                class="login-input"
                                placeholder="••••••••"
                                autocomplete="current-password"
                            >
                            <button class="login-eye" type="button" onclick="AppAuth._togglePassword()" aria-label="Mostrar contraseña" tabindex="-1">👁</button>
                        </div>
                    </div>

                    <div id="login-error" class="login-error" style="display:${errorMsg ? 'block' : 'none'}">${errorMsg ? esc(errorMsg) : ''}</div>

                    <button class="login-btn" id="login-btn" onclick="AppAuth.handleLogin()">
                        Entrar
                    </button>
                </div>

                <p class="login-version">BasketballRPE v22</p>
            </div>
        `;
        document.body.insertBefore(screen, document.getElementById('app'));

        // Enter en cualquier campo lanza el login
        screen.querySelectorAll('input').forEach(input => {
            input.addEventListener('keydown', e => { if (e.key === 'Enter') AppAuth.handleLogin(); });
        });

        // Auto-focus email
        setTimeout(() => document.getElementById('login-email')?.focus(), 100);
    },

    _togglePassword() {
        const input = document.getElementById('login-password');
        if (!input) return;
        input.type = input.type === 'password' ? 'text' : 'password';
    },

    async handleLogin() {
        const email    = document.getElementById('login-email')?.value?.trim();
        const password = document.getElementById('login-password')?.value;
        const btn      = document.getElementById('login-btn');
        const errorEl  = document.getElementById('login-error');

        if (!email || !password) {
            this._showLoginError('Introduce email y contraseña.');
            return;
        }

        btn.disabled    = true;
        btn.textContent = 'Entrando…';
        if (errorEl) errorEl.style.display = 'none';

        try {
            const cred = await window.firebaseAuth.signInWithEmailAndPassword(email, password);
            // onAuthStateChanged se dispara automáticamente y gestiona el resto
        } catch (e) {
            btn.disabled    = false;
            btn.textContent = 'Entrar';
            this._showLoginError(this._authErrorMsg(e.code));
        }
    },

    _showLoginError(msg) {
        const el = document.getElementById('login-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    },

    _authErrorMsg(code) {
        const map = {
            'auth/user-not-found':      'No existe ninguna cuenta con ese email.',
            'auth/wrong-password':      'Contraseña incorrecta.',
            'auth/invalid-email':       'El formato del email no es válido.',
            'auth/too-many-requests':   'Demasiados intentos. Espera unos minutos.',
            'auth/network-request-failed': 'Sin conexión. Comprueba tu red.',
            'auth/invalid-credential':  'Email o contraseña incorrectos.',
        };
        return map[code] || `Error de acceso (${code})`;
    },

    // ==========================================
    //  INICIALIZACIÓN — onAuthStateChanged
    // ==========================================
    init() {
        if (!window.firebaseAuth) {
            console.error('firebaseAuth no disponible. Revisa firebase-config.js');
            this.showLoginScreen('Error de configuración. Recarga la página.');
            return;
        }

        window.firebaseAuth.onAuthStateChanged(async (user) => {
            if (!user) {
                // No autenticado → mostrar login
                this._currentUser = null;
                this._currentRole = null;
                sessionStorage.removeItem('appRole');
                this.showLoginScreen();
                return;
            }

            // Autenticado → leer rol
            this._currentUser = user;
            const role = await this._fetchRole(user.uid);

            if (!role) {
                // UID existe en Auth pero no tiene registro en /users → logout
                await window.firebaseAuth.signOut();
                this.showLoginScreen('Tu cuenta no tiene rol asignado. Contacta al cuerpo técnico.');
                return;
            }

            this._currentRole = role;
            sessionStorage.setItem('appRole', role);

            // Eliminar pantalla de login si existe
            document.getElementById('login-screen')?.remove();

            // Encaminar según rol
            if (role === 'staff' || role === 'fisio') {
                document.getElementById('app').style.display = '';
                if (role === 'staff') AppAuth.requestNotificationPermission();
                if (!window.rpeTracker) window.rpeTracker = new RPETracker();
                if (role === 'staff' && window.WellnessReminder) WellnessReminder.start();
            } else if (role === 'player') {
                document.getElementById('app').style.display = 'none';
                if (this._isInstalledPWA()) {
                    PlayerView.show();
                } else {
                    this.showInstallGate();
                }
            } else {
                await window.firebaseAuth.signOut();
                this.showLoginScreen('Rol desconocido. Contacta al cuerpo técnico.');
            }
        });
    },

    // ==========================================
    //  GESTIÓN DE USUARIOS (solo para staff)
    // ==========================================

    // Modal de gestión de usuarios: crear / listar
    showUserManagement() {
        if (!this.isStaff()) return;

        const existing = document.getElementById('userMgmtModal');
        if (existing) existing.remove();

        const modal = document.createElement('div');
        modal.className = 'modal active';
        modal.id = 'userMgmtModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width:520px">
                <div class="modal-header">
                    <h2>👥 Gestión de usuarios</h2>
                    <button class="btn-close" onclick="document.getElementById('userMgmtModal').remove()">&times;</button>
                </div>

                <div class="um-section">
                    <h3 class="um-section-title">➕ Crear nueva cuenta</h3>
                    <div class="form-group">
                        <label>Nombre completo</label>
                        <input type="text" id="um-displayName" placeholder="Ej: Ana García" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Email</label>
                        <div style="display:flex;gap:0.5rem;align-items:center;">
                            <input type="text" id="um-emailUser" placeholder="ana.garcia" class="form-input" style="flex:1">
                            <span style="color:var(--text-secondary);white-space:nowrap;">@rpe.app</span>
                        </div>
                        <small style="color:var(--text-secondary)">O escribe un email completo en el campo de arriba</small>
                    </div>
                    <div class="form-group">
                        <label>Contraseña inicial</label>
                        <input type="text" id="um-password" placeholder="Mín. 6 caracteres" class="form-input">
                    </div>
                    <div class="form-group">
                        <label>Rol</label>
                        <select id="um-role" class="form-input">
                            <option value="player">👤 Jugadora</option>
                            <option value="fisio">🩺 Fisioterapeuta</option>
                            <option value="staff">🏋️ Cuerpo técnico</option>
                        </select>
                    </div>
                    <div id="um-create-error" class="login-error" style="display:none"></div>
                    <button class="btn-primary" id="um-create-btn" onclick="AppAuth.createUser()">Crear cuenta</button>
                </div>

                <div class="um-section" style="margin-top:1.5rem">
                    <h3 class="um-section-title">📋 Usuarios registrados</h3>
                    <div id="um-user-list" class="um-user-list">
                        <div style="color:var(--text-secondary)">Cargando…</div>
                    </div>
                </div>

                <div class="modal-footer">
                    <button class="btn-secondary" onclick="document.getElementById('userMgmtModal').remove()">Cerrar</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this._loadUserList();
    },

    async createUser() {
        const displayName = document.getElementById('um-displayName')?.value?.trim();
        const emailRaw    = document.getElementById('um-emailUser')?.value?.trim();
        const password    = document.getElementById('um-password')?.value?.trim();
        const role        = document.getElementById('um-role')?.value;
        const errEl       = document.getElementById('um-create-error');
        const btn         = document.getElementById('um-create-btn');

        // Email: si contiene @ se usa tal cual, si no se añade @rpe.app
        const email = emailRaw.includes('@') ? emailRaw : `${emailRaw}@rpe.app`;

        if (!displayName) { this._umError('Escribe el nombre completo.'); return; }
        if (!emailRaw)    { this._umError('Escribe el email o nombre de usuario.'); return; }
        if (!password || password.length < 8) { this._umError('La contraseña debe tener al menos 8 caracteres.'); return; }

        btn.disabled    = true;
        btn.textContent = 'Creando…';
        if (errEl) errEl.style.display = 'none';

        try {
            // Crear usuario en Firebase Auth usando un Auth secundario para no perder la sesión del staff
            const secondaryApp = firebase.initializeApp(firebase.app().options, `tmp_${Date.now()}`);
            const secondaryAuth = secondaryApp.auth();

            const cred = await secondaryAuth.createUserWithEmailAndPassword(email, password);
            const uid  = cred.user.uid;

            // Actualizar displayName
            await cred.user.updateProfile({ displayName });

            // Guardar rol en Realtime Database (usando el auth PRINCIPAL del staff, que sí tiene permisos de escritura)
            await window.firebaseDB.ref(`users/${uid}`).set({
                email,
                role,
                displayName,
                createdAt: Date.now()
            });

            // Cerrar la app secundaria
            await secondaryApp.delete();

            this._umSuccess(`✅ Cuenta creada: ${email}`);
            this._loadUserList();

            // Limpiar formulario
            document.getElementById('um-displayName').value = '';
            document.getElementById('um-emailUser').value   = '';
            document.getElementById('um-password').value    = '';

        } catch (e) {
            const msgs = {
                'auth/email-already-in-use': 'Ese email ya está registrado.',
                'auth/invalid-email':        'El formato del email no es válido.',
                'auth/weak-password':        'La contraseña es demasiado débil (mín. 6 caracteres).',
            };
            this._umError(msgs[e.code] || `Error: ${e.message}`);
        } finally {
            btn.disabled    = false;
            btn.textContent = 'Crear cuenta';
        }
    },

    _umError(msg) {
        const el = document.getElementById('um-create-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; }
    },

    _umSuccess(msg) {
        const el = document.getElementById('um-create-error');
        if (el) { el.textContent = msg; el.style.display = 'block'; el.style.color = 'var(--success, #4caf50)'; }
        setTimeout(() => { if (el) { el.style.display = 'none'; el.style.color = ''; } }, 3000);
    },

    async _loadUserList() {
        const container = document.getElementById('um-user-list');
        if (!container) return;

        try {
            const snap = await window.firebaseDB.ref('users').once('value');
            const users = snap.val();

            if (!users) {
                container.innerHTML = '<div style="color:var(--text-secondary)">No hay usuarios registrados.</div>';
                return;
            }

            const roleLabel = { staff: '🏋️ Staff', fisio: '🩺 Fisio', player: '👤 Jugadora' };
            const rows = Object.entries(users).map(([uid, u]) => `
                <div class="um-user-row">
                    <div class="um-user-info">
                        <span class="um-user-name">${u.displayName || '—'}</span>
                        <span class="um-user-email">${u.email || '—'}</span>
                    </div>
                    <span class="um-user-role um-role-${u.role}">${roleLabel[u.role] || u.role}</span>
                    <button class="um-edit-btn" onclick="AppAuth.editUser('${uid}', '${(u.displayName || '').replace(/'/g, "\\'")}')" title="Editar usuario">✏️</button>
                    <button class="um-delete-btn" onclick="AppAuth.deleteUser('${uid}', '${(u.displayName || u.email || uid).replace(/'/g, "\\'")}')" title="Eliminar usuario">🗑</button>
                </div>
            `).join('');

            container.innerHTML = rows;
        } catch (e) {
            container.innerHTML = `<div style="color:var(--danger)">Error cargando usuarios: ${esc(e.message)}</div>`;
        }
    },

    async deleteUser(uid, name) {
        // fix P-03: firma correcta de AppConfirm.show + precedencia de operador corregida
        let ok;
        if (window.AppConfirm) {
            ok = await AppConfirm.show({
                title: `¿Eliminar la cuenta de ${name}?`,
                message: 'Esta acción elimina solo el registro de rol. La cuenta de Auth debe borrarse manualmente en Firebase Console si es necesario.',
                confirmText: 'Eliminar',
                danger: true,
            });
        } else {
            ok = confirm(`¿Eliminar la cuenta de ${name}?`);
        }

        if (!ok) return;

        try {
            await window.firebaseDB.ref(`users/${uid}`).remove();
            this._loadUserList();
        } catch (e) {
            AppAlert.show(`Error al eliminar: ${esc(e.message)}`);
        }
    },

    editUser(uid, currentName) {
        const existing = document.getElementById('um-edit-modal');
        if (existing) existing.remove();

        // Lee el nodo actual para tener email y role frescos
        window.firebaseDB.ref(`users/${uid}`).once('value').then(snap => {
            const u = snap.val() || {};
            const modal = document.createElement('div');
            modal.className = 'modal active';
            modal.id = 'um-edit-modal';
            modal.innerHTML = `
                <div class="modal-content" style="max-width:420px">
                    <div class="modal-header">
                        <h2>✏️ Editar usuario</h2>
                        <button class="btn-close" onclick="document.getElementById('um-edit-modal').remove()">&times;</button>
                    </div>
                    <div class="um-section">
                        <div class="form-group">
                            <label>Nombre completo</label>
                            <input type="text" id="ue-displayName" class="form-input" value="${(u.displayName || '').replace(/"/g, '&quot;')}">
                        </div>
                        <div class="form-group">
                            <label>Email</label>
                            <input type="text" id="ue-email" class="form-input" value="${(u.email || '').replace(/"/g, '&quot;')}">
                        </div>
                        <div class="form-group">
                            <label>Rol</label>
                            <select id="ue-role" class="form-input">
                                <option value="player"  ${u.role === 'player'  ? 'selected' : ''}>👤 Jugadora</option>
                                <option value="fisio"   ${u.role === 'fisio'   ? 'selected' : ''}>🩺 Fisioterapeuta</option>
                                <option value="staff"   ${u.role === 'staff'   ? 'selected' : ''}>🏋️ Cuerpo técnico</option>
                            </select>
                        </div>
                        <div id="ue-error" class="login-error" style="display:none"></div>
                    </div>
                    <div class="modal-footer" style="gap:0.75rem">
                        <button class="btn-secondary" onclick="document.getElementById('um-edit-modal').remove()">Cancelar</button>
                        <button class="btn-primary" onclick="AppAuth.saveEditUser('${uid}')">Guardar</button>
                    </div>
                </div>
            `;
            document.body.appendChild(modal);
        });
    },

    async saveEditUser(uid) {
        const displayName = document.getElementById('ue-displayName')?.value?.trim();
        const email       = document.getElementById('ue-email')?.value?.trim();
        const role        = document.getElementById('ue-role')?.value;
        const errEl       = document.getElementById('ue-error');

        if (!displayName) {
            if (errEl) { errEl.textContent = 'El nombre no puede estar vacío.'; errEl.style.display = 'block'; }
            return;
        }

        try {
            await window.firebaseDB.ref(`users/${uid}`).update({ displayName, email, role });
            document.getElementById('um-edit-modal')?.remove();
            this._loadUserList();
        } catch (e) {
            if (errEl) { errEl.textContent = `Error: ${e.message}`; errEl.style.display = 'block'; }
        }
    },

    // ==========================================
    //  PANTALLA WELLNESS (jugadoras)
    // ==========================================

    // ---- Wellness persistence ----
    async saveWellness(playerId, answers) {
        const entry = {
            playerId,
            userId: this._currentUser?.uid || null,
            timestamp: new Date().toISOString(),
            date: new Date().toISOString().slice(0, 10),
            sleep:   answers.sleep,
            fatigue: answers.fatigue,
            pain:    answers.pain,
        };
        try {
            if (window.firebaseDB) {
                await window.firebaseDB.ref('wellness').push(entry);
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
            document.querySelector('.wl-done-sub').textContent   = 'Ya has enviado tu cuestionario de hoy. ¡Hasta mañana!';
            return;
        }
        document.getElementById('wl-step-select').style.display   = 'none';
        document.getElementById('wl-step-questions').style.display = '';
        document.getElementById('wl-selected-name').textContent    = `👤 ${name}`;
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
        document.getElementById('wl-step-done').style.display    = 'none';
        document.getElementById('wl-step-select').style.display  = '';
        this.loadPlayersForWellness();
    },

    // ==========================================
    //  INSTALL GATE (jugadoras sin PWA)
    // ==========================================
    showInstallGate() {
        const platform = this._platform();
        const existing = document.getElementById('install-gate');
        if (existing) existing.remove();

        const isIOS     = platform === 'ios';
        const isAndroid = platform === 'android';

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
                    <span>La app de wellness está pensada para iPhone o Android.</span>
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
                <div class="ig-steps">${steps}</div>
                <div class="ig-confirm">
                    <p class="ig-confirm-label">Cuando la tengas instalada, ábrela desde tu pantalla de inicio y vuelve a entrar.</p>
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
            PlayerView.show();
        } else {
            const btn = document.querySelector('.ig-btn-already');
            if (btn) {
                const orig = btn.textContent;
                btn.textContent = '⚠️ No detectada como instalada — ábrela desde inicio';
                btn.style.background = 'var(--danger, #c62828)';
                setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 3000);
            }
        }
    },

    // ---- SVG helpers install gate (sin cambios) ----
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

    // ---- Legacy stubs (por si algún módulo viejo los llama) ----
    addLogoutButton() {},
    showPinSettings()  { this.showUserManagement(); },
    showPinScreen()    { this.showLoginScreen(); },
    getPin()           { return ''; },
    getCoachPin()      { return ''; },
    getPlayerPin()     { return ''; },
    savePins()         {},
};

// ========== ARRANQUE ==========
window.addEventListener('load', () => {
    setTimeout(() => AppAuth.init(), 150);
});

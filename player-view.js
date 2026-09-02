// ======================================================================
// PLAYER VIEW — Vista exclusiva para rol 'player' en modo PWA instalada
// Menú principal: Wellness diario | RPE de sesión
//   - Wellness: sueño/fatiga/ánimo/dolor → /wellnessPlayer/{uid}/{date}
//   - RPE: jugadora elige Mañana/Tarde/Partido y valora 1-10 con botones
//          de color → /playerRpeReports/{uid}/{date}/{sessionType}
//     (nodo separado de /sessions del staff: no conocemos la duración,
//      así que no se mezcla con el cálculo de carga de entrenamiento)
// ======================================================================
// Requiere: AppAuth, PlayerI18n, window.firebaseDB (opcional — funciona offline)
// ======================================================================

const PlayerView = (() => {

    // ---- Colores fijos de la escala RPE (no dependen del idioma) ----
    const RPE_COLORS = [
        '', '#22c55e','#4ade80','#86efac','#fde047',
        '#fb923c','#f97316','#ef4444','#dc2626','#b91c1c','#7f1d1d',
    ];

    const RPE_TYPES = [
        { key: 'morning',   icon: '☀️', labelKey: 'rpeTypeMorning' },
        { key: 'afternoon', icon: '🌙', labelKey: 'rpeTypeAfternoon' },
        { key: 'match',     icon: '🏟️', labelKey: 'rpeTypeMatch' },
    ];

    // ---- Estado interno ----
    let _view = 'menu'; // 'menu' | 'wellness' | 'wellnessDone' | 'rpeType' | 'rpeValue' | 'rpeDone'
    let _screenEl = null;
    let _wellnessState = { date: _today(), sleep: 0, fatigue: 0, mood: 0, pain: 0 };
    let _rpeState = { date: _today(), sessionType: null, value: 0 };

    // ---- Helpers ----
    function _today() {
        return new Date().toISOString().slice(0, 10);
    }

    function _esc(str) {
        return String(str)
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#39;');
    }

    function _allWellnessAnswered() {
        return _wellnessState.sleep > 0
            && _wellnessState.fatigue > 0
            && _wellnessState.mood > 0
            && _wellnessState.pain > 0;
    }

    function _fmtDate(iso) {
        const [y, m, d] = iso.split('-');
        return new Date(y, m - 1, d).toLocaleDateString(PlayerI18n.t('dateLocale'), {
            weekday: 'long', day: 'numeric', month: 'long',
        });
    }

    // ---- Persistencia ----
    async function _getLinkedPlayerId(uid) {
        if (!window.firebaseDB) return null;
        try {
            const snap = await window.firebaseDB.ref('users/' + uid + '/playerId').once('value');
            return snap.val() || null;
        } catch (_) { return null; /* offline — continuar sin playerId */ }
    }

    function _queueOffline(path, data) {
        const q = JSON.parse(localStorage.getItem('pv_offline_q') || '[]');
        q.push({ path, data, queued: Date.now() });
        localStorage.setItem('pv_offline_q', JSON.stringify(q));
    }

    async function _writeToFirebase(path, entry) {
        if (window.firebaseDB) {
            try { await window.firebaseDB.ref(path).set(entry); return; }
            catch (e) { /* cae a offline */ }
        }
        _queueOffline(path, entry);
    }

    // Intenta re-sincronizar entradas pendientes (llamado al abrir la vista)
    async function _drainQueue() {
        if (!window.firebaseDB) return;
        const q = JSON.parse(localStorage.getItem('pv_offline_q') || '[]');
        if (!q.length) return;
        const remaining = [];
        for (const item of q) {
            try { await window.firebaseDB.ref(item.path).set(item.data); }
            catch (_) { remaining.push(item); }
        }
        localStorage.setItem('pv_offline_q', JSON.stringify(remaining));
    }

    async function _saveWellness() {
        const uid = AppAuth._currentUser?.uid;
        if (!uid) throw new Error('Usuario no autenticado');
        const playerId = await _getLinkedPlayerId(uid);

        const entry = {
            uid, date: _wellnessState.date,
            sleep: _wellnessState.sleep, fatigue: _wellnessState.fatigue,
            mood: _wellnessState.mood, pain: _wellnessState.pain,
            ts: new Date().toISOString(),
        };
        if (playerId) entry.playerId = playerId;

        await _writeToFirebase(`wellnessPlayer/${uid}/${_wellnessState.date}`, entry);

        const stored = JSON.parse(localStorage.getItem('pv_wellness') || '{}');
        if (!stored[uid]) stored[uid] = {};
        stored[uid][_wellnessState.date] = entry;
        localStorage.setItem('pv_wellness', JSON.stringify(stored));
    }

    async function _saveRpe() {
        const uid = AppAuth._currentUser?.uid;
        if (!uid) throw new Error('Usuario no autenticado');
        const playerId = await _getLinkedPlayerId(uid);
        const date = _rpeState.date;
        const sessionType = _rpeState.sessionType;

        const entry = {
            uid, date, sessionType, rpe: _rpeState.value,
            ts: new Date().toISOString(),
        };
        if (playerId) entry.playerId = playerId;

        await _writeToFirebase(`playerRpeReports/${uid}/${date}/${sessionType}`, entry);

        const stored = JSON.parse(localStorage.getItem('pv_rpe') || '{}');
        if (!stored[uid]) stored[uid] = {};
        if (!stored[uid][date]) stored[uid][date] = {};
        stored[uid][date][sessionType] = entry;
        localStorage.setItem('pv_rpe', JSON.stringify(stored));
    }

    function _hasAnsweredWellnessToday() {
        const uid = AppAuth._currentUser?.uid;
        if (!uid) return false;
        const stored = JSON.parse(localStorage.getItem('pv_wellness') || '{}');
        return !!(stored[uid] && stored[uid][_today()]);
    }

    function _hasAnsweredRpeToday(sessionType) {
        const uid = AppAuth._currentUser?.uid;
        if (!uid) return false;
        const stored = JSON.parse(localStorage.getItem('pv_rpe') || '{}');
        return !!(stored[uid] && stored[uid][_today()] && stored[uid][_today()][sessionType]);
    }

    function _showInlineError(anchorBtn, msg) {
        const errEl = document.getElementById('pv-error-msg');
        if (errEl) { errEl.textContent = msg; return; }
        const p = document.createElement('p');
        p.id = 'pv-error-msg';
        p.className = 'pv-error';
        p.textContent = msg;
        if (anchorBtn && anchorBtn.parentNode) anchorBtn.parentNode.insertBefore(p, anchorBtn);
    }

    // ---- Render: piezas reutilizables ----
    function _shell(inner) {
        const name = AppAuth._currentUser?.displayName || PlayerI18n.t('pvDefaultName');
        return `
        <div class="pv-container">
            <div class="pv-lang-row">${PlayerI18n.toggleHTML('PlayerView._onLangChange')}</div>
            <div class="pv-header">
                <div class="pv-logo">🏀</div>
                <h1 class="pv-title">${_esc(PlayerI18n.t('pvGreeting'))} ${_esc(name)}!</h1>
                <p class="pv-subtitle">${_fmtDate(_today())}</p>
            </div>
            ${inner}
            <button class="pv-logout" onclick="AppAuth.logout()">${_esc(PlayerI18n.t('pvLogout'))}</button>
        </div>`;
    }

    function _renderWellnessButtons() {
        const meta = PlayerI18n.wellnessMeta();
        return Object.entries(meta).map(([key, m]) => {
            const selected = _wellnessState[key];
            return `
            <div class="pv-question">
                <div class="pv-q-label">${m.icon} ${_esc(m.label)}</div>
                <div class="pv-scale">
                    ${[1,2,3,4,5].map(v => `
                        <button
                            class="pv-scale-btn${selected === v ? ' selected' : ''}"
                            onclick="PlayerView._onWellness('${key}', ${v})"
                            aria-label="${_esc(m.subs[v-1])}, ${v}"
                            aria-pressed="${selected === v}"
                        >
                            <span class="pv-scale-num">${v}</span>
                            <span class="pv-scale-lbl">${_esc(m.subs[v-1])}</span>
                        </button>`).join('')}
                </div>
            </div>`;
        }).join('');
    }

    function _renderDateField() {
        return `
        <div class="pv-date-row">
            <label class="pv-date-label" for="pv-date-input">${_esc(PlayerI18n.t('pvDateLabel'))}</label>
            <input
                type="date"
                id="pv-date-input"
                class="pv-date-input"
                value="${_esc(_wellnessState.date)}"
                max="${_esc(_today())}"
                onchange="PlayerView._onDate(this.value)"
                aria-label="Fecha / Date"
            >
        </div>`;
    }

    // ---- Render: pantallas ----
    function _render() {
        if (!_screenEl) return;
        switch (_view) {
            case 'wellness':    return _renderWellnessForm();
            case 'wellnessDone': return _renderWellnessDone(false);
            case 'rpeType':     return _renderRpeTypeSelect();
            case 'rpeValue':    return _renderRpeValueSelect();
            case 'rpeDone':     return _renderRpeDone();
            case 'menu':
            default:            return _renderMenu();
        }
    }

    function _renderMenu() {
        const wellnessDone = _hasAnsweredWellnessToday();
        _screenEl.innerHTML = _shell(`
            <button class="pv-menu-btn${wellnessDone ? ' done' : ''}" onclick="PlayerView._goWellness()">
                <span><span class="pv-menu-btn-icon">🧘</span>${_esc(PlayerI18n.t('menuWellnessBtn'))}</span>
                ${wellnessDone ? `<span class="pv-menu-btn-check">✅</span>` : ''}
            </button>
            <button class="pv-menu-btn" onclick="PlayerView._goRpeType()">
                <span><span class="pv-menu-btn-icon">🏃</span>${_esc(PlayerI18n.t('menuRpeBtn'))}</span>
            </button>
        `);
    }

    function _renderWellnessForm() {
        if (_hasAnsweredWellnessToday()) { _view = 'wellnessDone'; return _renderWellnessDone(false); }
        _screenEl.innerHTML = _shell(`
            <button class="pv-back-btn" onclick="PlayerView._goMenu()">${_esc(PlayerI18n.t('backBtn'))}</button>
            <div id="pv-step-form">
                ${_renderWellnessButtons()}
                ${_renderDateField()}
                <button
                    class="pv-submit"
                    id="pv-submit-btn"
                    onclick="PlayerView._onSubmitWellness()"
                    ${_allWellnessAnswered() ? '' : 'disabled'}
                >
                    ${_esc(PlayerI18n.t('pvSubmit'))}
                </button>
            </div>
        `);
    }

    function _renderWellnessDone(justSubmitted) {
        _screenEl.innerHTML = _shell(`
            <button class="pv-back-btn" onclick="PlayerView._goMenu()">${_esc(PlayerI18n.t('backBtn'))}</button>
            <div class="pv-done-icon">✅</div>
            <h2 class="pv-done-title">${_esc(PlayerI18n.t(justSubmitted ? 'pvDoneTitle' : 'pvAlreadyTitle'))}</h2>
            <p class="pv-done-sub">${PlayerI18n.t(justSubmitted ? 'pvDoneSub' : 'pvAlreadySub')}</p>
        `);
    }

    function _renderRpeTypeSelect() {
        const rows = RPE_TYPES.map(t => {
            const done = _hasAnsweredRpeToday(t.key);
            return `
            <button class="pv-type-btn${done ? ' done' : ''}" ${done ? 'disabled' : ''} onclick="PlayerView._selectRpeType('${t.key}')">
                <span>${t.icon} ${_esc(PlayerI18n.t(t.labelKey))}</span>
                ${done ? `<span class="pv-menu-btn-check">✅</span>` : ''}
            </button>`;
        }).join('');
        _screenEl.innerHTML = _shell(`
            <button class="pv-back-btn" onclick="PlayerView._goMenu()">${_esc(PlayerI18n.t('backBtn'))}</button>
            <div class="pv-question">
                <div class="pv-q-label">${_esc(PlayerI18n.t('rpeSelectTypeTitle'))}</div>
                <div class="pv-type-row">${rows}</div>
            </div>
        `);
    }

    function _renderRpeValueSelect() {
        const v = _rpeState.value;
        const labels = PlayerI18n.rpeLabels();
        const desc = v > 0 ? `${v} — ${labels[v]}` : PlayerI18n.t('pvRpeMove');
        const descColor = v > 0 ? RPE_COLORS[v] : 'var(--text-faint)';
        const grid = [1,2,3,4,5,6,7,8,9,10].map(n => {
            const c = RPE_COLORS[n];
            const style = n === v
                ? `background:${c};border-color:${c};color:#fff`
                : `color:${c};border-color:${c}`;
            return `<button class="pv-rpe-btn${n === v ? ' selected' : ''}" style="${style}" onclick="PlayerView._onRpeValue(${n})">${n}</button>`;
        }).join('');
        _screenEl.innerHTML = _shell(`
            <button class="pv-back-btn" onclick="PlayerView._goRpeType()">${_esc(PlayerI18n.t('backBtn'))}</button>
            <div class="pv-question">
                <div class="pv-q-label">${_esc(PlayerI18n.t('pvRpeLabel'))}</div>
                <div class="pv-q-sub">${_esc(PlayerI18n.t('rpeSelectValueSub'))}</div>
                <div class="pv-rpe-grid">${grid}</div>
                <div class="pv-rpe-desc" style="color:${descColor}">${_esc(desc)}</div>
            </div>
            <button
                class="pv-submit"
                id="pv-rpe-submit-btn"
                onclick="PlayerView._onSubmitRpe()"
                ${v > 0 ? '' : 'disabled'}
            >
                ${_esc(PlayerI18n.t('rpeSubmit'))}
            </button>
        `);
    }

    function _renderRpeDone() {
        _screenEl.innerHTML = _shell(`
            <div class="pv-done-icon">✅</div>
            <h2 class="pv-done-title">${_esc(PlayerI18n.t('pvDoneTitle'))}</h2>
            <p class="pv-done-sub">${PlayerI18n.t('pvDoneSub')}</p>
            <button class="pv-menu-btn" style="margin-top:1rem" onclick="PlayerView._goMenu()">
                ${_esc(PlayerI18n.t('backToMenuBtn'))}
            </button>
        `);
    }

    // ---- Pantalla principal ----
    function show() {
        document.getElementById('app').style.display = 'none';

        const existing = document.getElementById('player-view-screen');
        if (existing) existing.remove();

        _wellnessState = { date: _today(), sleep: 0, fatigue: 0, mood: 0, pain: 0 };
        _rpeState = { date: _today(), sessionType: null, value: 0 };
        _view = 'menu';

        _screenEl = document.createElement('div');
        _screenEl.id = 'player-view-screen';
        document.body.appendChild(_screenEl);

        _render();
        _drainQueue();
    }

    // ---- Navegación ----
    function _goMenu() {
        _view = 'menu';
        _rpeState = { date: _today(), sessionType: null, value: 0 };
        _render();
    }
    function _goWellness() { _view = 'wellness'; _render(); }
    function _goRpeType()  { _view = 'rpeType'; _render(); }
    function _selectRpeType(type) {
        _rpeState.sessionType = type;
        _rpeState.value = 0;
        _view = 'rpeValue';
        _render();
    }

    // ---- Handlers de formulario ----
    function _onWellness(key, val) {
        _wellnessState[key] = val;
        document.querySelectorAll(`.pv-scale-btn[onclick*="'${key}'"]`).forEach(btn => {
            const btnVal = parseInt(btn.querySelector('.pv-scale-num').textContent, 10);
            btn.classList.toggle('selected', btnVal === val);
            btn.setAttribute('aria-pressed', btnVal === val ? 'true' : 'false');
        });
        const btn = document.getElementById('pv-submit-btn');
        if (btn) btn.disabled = !_allWellnessAnswered();
    }

    function _onDate(val) {
        _wellnessState.date = val || _today();
    }

    function _onRpeValue(n) {
        _rpeState.value = n;
        _renderRpeValueSelect();
    }

    /** Cambia el idioma y vuelve a pintar la pantalla actual conservando las respuestas ya dadas */
    function _onLangChange(lang) {
        PlayerI18n.setLang(lang);
        _render();
    }

    async function _onSubmitWellness() {
        if (!_allWellnessAnswered()) return;
        const btn = document.getElementById('pv-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = PlayerI18n.t('pvSaving'); }
        try {
            await _saveWellness();
            _view = 'wellnessDone';
            _renderWellnessDone(true);
        } catch (e) {
            if (btn) { btn.disabled = false; btn.textContent = PlayerI18n.t('pvSubmit'); }
            _showInlineError(btn, PlayerI18n.t('pvErrorSave'));
        }
    }

    async function _onSubmitRpe() {
        if (!_rpeState.value) return;
        const btn = document.getElementById('pv-rpe-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = PlayerI18n.t('pvSaving'); }
        try {
            await _saveRpe();
            _view = 'rpeDone';
            _renderRpeDone();
        } catch (e) {
            if (btn) { btn.disabled = false; btn.textContent = PlayerI18n.t('rpeSubmit'); }
            _showInlineError(btn, PlayerI18n.t('pvErrorSave'));
        }
    }

    // ---- API pública ----
    return {
        show,
        _onWellness,
        _onDate,
        _onRpeValue,
        _onSubmitWellness,
        _onSubmitRpe,
        _onLangChange,
        _goMenu,
        _goWellness,
        _goRpeType,
        _selectRpeType,
        _drainQueue,
    };

})();

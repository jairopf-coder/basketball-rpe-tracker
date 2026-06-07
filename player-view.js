// ======================================================================
// PLAYER VIEW — Vista exclusiva para rol 'player' en modo PWA instalada
// Guarda en Firebase: /wellness/{uid}/{date}
// ======================================================================
// Requiere: AppAuth, window.firebaseDB (opcional — funciona offline)
// ======================================================================

const PlayerView = (() => {

    // ---- Etiquetas de RPE (Borg CR-10 adaptada) ----
    const RPE_LABELS = [
        '',                             // 0 — no usado
        'Reposo absoluto',              // 1
        'Muy, muy suave',               // 2
        'Suave',                        // 3
        'Moderado',                     // 4
        'Algo duro',                    // 5
        'Duro',                         // 6
        'Muy duro',                     // 7
        'Muy, muy duro',                // 8
        'Casi máximo',                  // 9
        'Esfuerzo máximo',              // 10
    ];

    const RPE_COLORS = [
        '', '#22c55e','#4ade80','#86efac','#fde047',
        '#fb923c','#f97316','#ef4444','#dc2626','#b91c1c','#7f1d1d',
    ];

    // ---- Etiquetas de escala wellness 1-5 ----
    const WELLNESS_META = {
        sleep:  { icon: '😴', label: 'Calidad del sueño',     subs: ['Muy mal','Mal','Regular','Bien','Muy bien'] },
        fatigue:{ icon: '💪', label: 'Nivel de fatiga',        subs: ['Agotada','Muy cansada','Cansada','Bien','Fresca'] },
        mood:   { icon: '😊', label: 'Estado de ánimo',        subs: ['Muy bajo','Bajo','Normal','Bueno','Excelente'] },
        pain:   { icon: '🦵', label: 'Dolor muscular',         subs: ['Mucho dolor','Dolor','Algo','Leve','Sin dolor'] },
    };

    // ---- Estado interno ----
    let _state = {
        rpe:     0,
        date:    _today(),
        sleep:   0,
        fatigue: 0,
        mood:    0,
        pain:    0,
    };

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

    function _allAnswered() {
        return _state.rpe > 0
            && _state.sleep > 0
            && _state.fatigue > 0
            && _state.mood > 0
            && _state.pain > 0;
    }

    function _fmtDate(iso) {
        const [y, m, d] = iso.split('-');
        return new Date(y, m - 1, d).toLocaleDateString('es-ES', {
            weekday: 'long', day: 'numeric', month: 'long',
        });
    }

    // ---- Persistencia ----
    async function _save() {
        const uid  = AppAuth._currentUser?.uid;
        if (!uid) throw new Error('Usuario no autenticado');

        const entry = {
            uid,
            date:    _state.date,
            rpe:     _state.rpe,
            sleep:   _state.sleep,
            fatigue: _state.fatigue,
            mood:    _state.mood,
            pain:    _state.pain,
            ts:      new Date().toISOString(),
        };

        // Nodo principal: /wellness/{uid}/{date}
        const fbPath = `wellness/${uid}/${_state.date}`;

        if (window.firebaseDB) {
            try {
                await window.firebaseDB.ref(fbPath).set(entry);
            } catch (e) {
                // Offline: encolar en localStorage para re-sync posterior
                _queueOffline(fbPath, entry);
            }
        } else {
            _queueOffline(fbPath, entry);
        }

        // Siempre guardar copia local para hasAnsweredToday
        const stored = JSON.parse(localStorage.getItem('pv_wellness') || '{}');
        if (!stored[uid]) stored[uid] = {};
        stored[uid][_state.date] = entry;
        localStorage.setItem('pv_wellness', JSON.stringify(stored));
    }

    function _queueOffline(path, data) {
        const q = JSON.parse(localStorage.getItem('pv_offline_q') || '[]');
        q.push({ path, data, queued: Date.now() });
        localStorage.setItem('pv_offline_q', JSON.stringify(q));
    }

    // Intenta re-sincronizar entradas pendientes (llamado tras login exitoso)
    async function _drainQueue() {
        if (!window.firebaseDB) return;
        const q = JSON.parse(localStorage.getItem('pv_offline_q') || '[]');
        if (!q.length) return;
        const remaining = [];
        for (const item of q) {
            try {
                await window.firebaseDB.ref(item.path).set(item.data);
            } catch (_) {
                remaining.push(item);
            }
        }
        localStorage.setItem('pv_offline_q', JSON.stringify(remaining));
    }

    function _hasAnsweredToday() {
        const uid = AppAuth._currentUser?.uid;
        if (!uid) return false;
        const stored = JSON.parse(localStorage.getItem('pv_wellness') || '{}');
        return !!(stored[uid] && stored[uid][_today()]);
    }

    // ---- Render ----
    function _renderRPESlider() {
        const v = _state.rpe;
        const color = v > 0 ? RPE_COLORS[v] : 'var(--border)';
        const label = v > 0 ? `${v} — ${RPE_LABELS[v]}` : 'Mueve el slider';
        return `
        <div class="pv-question">
            <div class="pv-q-label">🏃 RPE — Percepción del esfuerzo</div>
            <div class="pv-q-sub">¿Cómo fue de duro el último entrenamiento?</div>
            <div class="pv-rpe-wrap">
                <input
                    type="range"
                    min="1" max="10" step="1"
                    value="${v > 0 ? v : 5}"
                    id="pv-rpe-slider"
                    class="pv-rpe-slider"
                    style="--rpe-color:${color}"
                    oninput="PlayerView._onRpe(this.value)"
                    aria-label="RPE del 1 al 10"
                >
                <div class="pv-rpe-badge" id="pv-rpe-badge"
                     style="background:${color};color:${v > 0 ? '#fff' : 'var(--text-faint)'}">
                    ${v > 0 ? v : '—'}
                </div>
            </div>
            <div class="pv-rpe-desc" id="pv-rpe-desc"
                 style="color:${v > 0 ? color : 'var(--text-faint)'}">
                ${_esc(label)}
            </div>
            <div class="pv-rpe-ticks" aria-hidden="true">
                ${[1,2,3,4,5,6,7,8,9,10].map(n =>
                    `<span style="color:${RPE_COLORS[n]}">${n}</span>`
                ).join('')}
            </div>
        </div>`;
    }

    function _renderWellnessButtons() {
        return Object.entries(WELLNESS_META).map(([key, meta]) => {
            const selected = _state[key];
            return `
            <div class="pv-question">
                <div class="pv-q-label">${meta.icon} ${_esc(meta.label)}</div>
                <div class="pv-scale">
                    ${[1,2,3,4,5].map(v => `
                        <button
                            class="pv-scale-btn${selected === v ? ' selected' : ''}"
                            onclick="PlayerView._onWellness('${key}', ${v})"
                            aria-label="${_esc(meta.subs[v-1])}, valor ${v}"
                            aria-pressed="${selected === v}"
                        >
                            <span class="pv-scale-num">${v}</span>
                            <span class="pv-scale-lbl">${_esc(meta.subs[v-1])}</span>
                        </button>`).join('')}
                </div>
            </div>`;
        }).join('');
    }

    function _renderDateField() {
        return `
        <div class="pv-date-row">
            <label class="pv-date-label" for="pv-date-input">📅 Fecha</label>
            <input
                type="date"
                id="pv-date-input"
                class="pv-date-input"
                value="${_esc(_state.date)}"
                max="${_esc(_today())}"
                onchange="PlayerView._onDate(this.value)"
                aria-label="Fecha del registro"
            >
        </div>`;
    }

    // ---- Pantalla principal ----
    function show() {
        document.getElementById('app').style.display = 'none';

        const existing = document.getElementById('player-view-screen');
        if (existing) existing.remove();

        _state = {
            rpe: 0, date: _today(),
            sleep: 0, fatigue: 0, mood: 0, pain: 0,
        };

        const name = AppAuth._currentUser?.displayName || 'Jugadora';

        const screen = document.createElement('div');
        screen.id = 'player-view-screen';

        if (_hasAnsweredToday()) {
            _renderDone(screen, name, true);
        } else {
            _renderForm(screen, name);
        }

        document.body.appendChild(screen);
        _drainQueue();
    }

    function _renderForm(screen, name) {
        screen.innerHTML = `
        <div class="pv-container">
            <div class="pv-header">
                <div class="pv-logo">🏀</div>
                <h1 class="pv-title">¡Hola, ${_esc(name)}!</h1>
                <p class="pv-subtitle">${_fmtDate(_today())}</p>
            </div>

            <div id="pv-step-form">
                ${_renderRPESlider()}
                ${_renderWellnessButtons()}
                ${_renderDateField()}

                <button
                    class="pv-submit"
                    id="pv-submit-btn"
                    onclick="PlayerView._onSubmit()"
                    disabled
                    aria-label="Registrar respuestas"
                >
                    Registrar
                </button>
            </div>

            <div id="pv-step-done" style="display:none">
                ${_doneHTML()}
            </div>

            <button class="pv-logout" onclick="AppAuth.logout()">🔒 Salir</button>
        </div>`;
    }

    function _renderDone(screen, name, alreadyDone) {
        screen.innerHTML = `
        <div class="pv-container">
            <div class="pv-header">
                <div class="pv-logo">🏀</div>
                <h1 class="pv-title">¡Hola, ${_esc(name)}!</h1>
                <p class="pv-subtitle">${_fmtDate(_today())}</p>
            </div>
            <div id="pv-step-done">
                ${alreadyDone ? _alreadyDoneHTML() : _doneHTML()}
            </div>
            <button class="pv-logout" onclick="AppAuth.logout()">🔒 Salir</button>
        </div>`;
    }

    function _doneHTML() {
        return `
        <div class="pv-done-icon">✅</div>
        <h2 class="pv-done-title">¡Registrado!</h2>
        <p class="pv-done-sub">Tus datos han sido enviados al cuerpo técnico.<br>¡Hasta mañana!</p>`;
    }

    function _alreadyDoneHTML() {
        return `
        <div class="pv-done-icon">✅</div>
        <h2 class="pv-done-title">¡Ya respondiste hoy!</h2>
        <p class="pv-done-sub">Ya has enviado tu cuestionario de hoy.<br>¡Hasta mañana!</p>`;
    }

    // ---- Handlers (expuestos globalmente a través del objeto) ----
    function _onRpe(val) {
        _state.rpe = parseInt(val, 10);
        const color  = RPE_COLORS[_state.rpe];
        const badge  = document.getElementById('pv-rpe-badge');
        const desc   = document.getElementById('pv-rpe-desc');
        const slider = document.getElementById('pv-rpe-slider');
        if (badge)  { badge.textContent = _state.rpe; badge.style.background = color; badge.style.color = '#fff'; }
        if (desc)   { desc.textContent  = `${_state.rpe} — ${RPE_LABELS[_state.rpe]}`; desc.style.color = color; }
        if (slider) { slider.style.setProperty('--rpe-color', color); }
        _updateSubmitBtn();
    }

    function _onWellness(key, val) {
        _state[key] = val;
        // Actualizar botones de esa dimensión
        document.querySelectorAll(`.pv-scale-btn[onclick*="'${key}'"]`).forEach(btn => {
            const btnVal = parseInt(btn.querySelector('.pv-scale-num').textContent, 10);
            btn.classList.toggle('selected', btnVal === val);
            btn.setAttribute('aria-pressed', btnVal === val ? 'true' : 'false');
        });
        _updateSubmitBtn();
    }

    function _onDate(val) {
        _state.date = val || _today();
    }

    function _updateSubmitBtn() {
        const btn = document.getElementById('pv-submit-btn');
        if (btn) btn.disabled = !_allAnswered();
    }

    async function _onSubmit() {
        if (!_allAnswered()) return;
        const btn = document.getElementById('pv-submit-btn');
        if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

        try {
            await _save();
            const form = document.getElementById('pv-step-form');
            const done = document.getElementById('pv-step-done');
            if (form) form.style.display = 'none';
            if (done) { done.innerHTML = _doneHTML(); done.style.display = ''; }
        } catch (e) {
            if (btn) { btn.disabled = false; btn.textContent = 'Registrar'; }
            const errEl = document.getElementById('pv-error-msg');
            if (errEl) errEl.textContent = 'Error al guardar. Inténtalo de nuevo.';
            else {
                const msg = document.createElement('p');
                msg.id = 'pv-error-msg';
                msg.className = 'pv-error';
                msg.textContent = 'Error al guardar. Inténtalo de nuevo.';
                btn && btn.parentNode && btn.parentNode.insertBefore(msg, btn);
            }
        }
    }

    // ---- API pública ----
    return {
        show,
        _onRpe,
        _onWellness,
        _onDate,
        _onSubmit,
        _drainQueue,
    };

})();

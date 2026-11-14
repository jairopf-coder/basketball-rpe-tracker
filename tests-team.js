// ============================================================
//  tests-team.js — Tests de rendimiento · vista "Por test"
//  Rendimiento → Tests → pestaña "📈 Por test"
//
//  Elegir un test y ver el equipo entero:
//    • Media del equipo (y su cambio frente al test anterior), mejor marca y nº de jugadoras
//    • Ranking del día elegido, con barra, variación por jugadora, 🏅 y asimetría
//    • Evolución de la media del equipo, con las jugadoras que quieras superpuestas
//
//  También los AVISOS por jugadora de la lista de Tests (junto al nombre):
//    • 🦵 asimetría alta (≥15 %) en el último test de dos piernas
//    • ⏱ toca repetir un test, según la frecuencia (en semanas) que fijas por test (⚙️)
//  Al pulsar el aviso se explica qué pasa y hay botones para ir al problema. No hay avisos en Inicio.
//
//  Solo LEE this.testSessions: no escribe nada ni cambia el formato de los datos.
//  Depende de strength.js (TEST_DEFINITIONS, asymmetry, asymColor) y de tests-wizard.js
//  (TestWizardLogic). Cargar DESPUÉS de tests-wizard.js.
// ============================================================

// ─────────────────────────────────────────
//  LÓGICA PURA (sin DOM, probada en test/tests-team.test.js)
// ─────────────────────────────────────────
const TestTeamLogic = {
    /** Tests con al menos un registro, de más a menos usados (empate: orden de la lista de tests) */
    usage(sessions) {
        return TEST_DEFINITIONS.map((def, i) => {
            const withTest = (sessions || []).filter(s => s.results && s.results[def.id]
                && TestWizardLogic.mainValue(def, s.results[def.id]) !== null);
            const last = withTest.reduce((m, s) => (s.date > m ? s.date : m), '');
            return { def, i, count: withTest.length, last };
        }).filter(u => u.count > 0).sort((a, b) => b.count - a.count || a.i - b.i);
    },

    /** Días en que se hizo el test y cuántas jugadoras, del más reciente al más antiguo */
    datesWithTest(def, sessions) {
        const byDate = {};
        (sessions || []).forEach(s => {
            if (!s.results || !s.results[def.id] || TestWizardLogic.mainValue(def, s.results[def.id]) === null) return;
            (byDate[s.date] = byDate[s.date] || new Set()).add(s.playerId);
        });
        return Object.keys(byDate).sort().reverse().map(date => ({ date, count: byDate[date].size }));
    },

    /** Ids de las jugadoras con datos de ese test (en cualquier fecha) */
    playersWithTest(def, sessions) {
        const ids = new Set();
        (sessions || []).forEach(s => {
            if (s.results && s.results[def.id] && TestWizardLogic.mainValue(def, s.results[def.id]) !== null) ids.add(s.playerId);
        });
        return ids;
    },

    /** Serie para el gráfico: media del equipo y valor de cada jugadora en cada fecha (null si no lo hizo) */
    series(def, sessions) {
        const dates = this.datesWithTest(def, sessions).map(d => d.date).reverse(); // de antigua a reciente
        const players = [...this.playersWithTest(def, sessions)];
        const perPlayer = {};
        players.forEach(pid => { perPlayer[pid] = []; });
        const mean = [], counts = [];
        dates.forEach(date => {
            const vals = [];
            players.forEach(pid => {
                const r = TestWizardLogic.resultOn(sessions, pid, def.id, date);
                const v = r ? TestWizardLogic.mainValue(def, r.result) : null;
                perPlayer[pid].push(v === null ? null : parseFloat(v.toFixed(2)));
                if (v !== null) vals.push(v);
            });
            counts.push(vals.length);
            mean.push(vals.length ? parseFloat((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(2)) : null);
        });
        return { dates, mean, counts, perPlayer };
    },

    /** Mejor marca de todo el equipo en ese test */
    best(def, sessions) {
        let best = null;
        (sessions || []).forEach(s => {
            if (!s.results || !s.results[def.id]) return;
            const v = TestWizardLogic.mainValue(def, s.results[def.id]);
            if (v === null) return;
            if (best === null || TestWizardLogic.isBetter(def, v, best.value)) best = { playerId: s.playerId, value: v, date: s.date };
        });
        return best;
    },

    ASYM_ALERT_PCT: 15,          // mismo umbral que el rojo de asymColor (≥15 %)
    ASYM_ALERT_MAX_AGE_DAYS: 60, // un test más antiguo ya no es una alerta de hoy

    /**
     * Asimetrías altas en el ÚLTIMO test de cada jugadora y test con dos piernas.
     * Solo cuenta el test más reciente (si después mejora, la alerta desaparece sola) y solo si es
     * de los últimos 60 días. Devuelve [{ playerId, testId, date, left, right, asym }], de mayor a menor.
     */
    asymAlerts(sessions, players, todayIso, opts) {
        const threshold = opts && opts.threshold != null ? opts.threshold : this.ASYM_ALERT_PCT;
        const maxAge = opts && opts.maxAgeDays != null ? opts.maxAgeDays : this.ASYM_ALERT_MAX_AGE_DAYS;
        const ids = new Set((players || []).map(p => p.id));
        const toUtc = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
        const latest = {};
        (sessions || []).forEach(s => {
            if (!s.results || !ids.has(s.playerId)) return;
            TEST_DEFINITIONS.forEach(def => {
                if (!def.bilateral) return;
                const r = s.results[def.id];
                if (!r || r.left == null || r.right == null) return;
                const k = s.playerId + '|' + def.id;
                const cur = latest[k];
                if (!cur || s.date > cur.date || (s.date === cur.date && String(s.createdAt || '') >= String(cur.createdAt || ''))) {
                    latest[k] = { playerId: s.playerId, testId: def.id, date: s.date, createdAt: s.createdAt, left: r.left, right: r.right };
                }
            });
        });
        const today = toUtc(todayIso);
        return Object.values(latest)
            .map(x => ({ playerId: x.playerId, testId: x.testId, date: x.date, left: x.left, right: x.right, asym: parseFloat(asymmetry(x.left, x.right)) }))
            .filter(x => x.asym >= threshold && (today - toUtc(x.date)) / 86400000 <= maxAge)
            .sort((a, b) => b.asym - a.asym || a.playerId.localeCompare(b.playerId));
    },

    // Cada cuántas semanas conviene repetir cada test (0 = sin aviso). Son valores propuestos: se ajustan en ⚙️.
    DEFAULT_FREQ_WEEKS: { cmj: 4, sj: 8, slcmj: 6, dj: 8, sts: 8, triple: 8, sprint10: 6, sprint20: 6, ift3015: 8, five0five: 8 },
    MAX_FREQ_WEEKS: 52,

    /** Ajustes válidos: para cada test, un entero de 0 a 52; lo que falte o no valga se rellena con el valor propuesto */
    normalizeSettings(raw) {
        const src = raw && typeof raw === 'object' && raw.freqWeeks && typeof raw.freqWeeks === 'object' ? raw.freqWeeks : {};
        const freqWeeks = {};
        TEST_DEFINITIONS.forEach(def => {
            const v = src[def.id];
            const n = v === '' || v === null || v === undefined ? NaN : Number(v);
            freqWeeks[def.id] = Number.isInteger(n) && n >= 0 && n <= this.MAX_FREQ_WEEKS ? n : (this.DEFAULT_FREQ_WEEKS[def.id] || 0);
        });
        return { freqWeeks };
    },

    /** Lee lo escrito en la pantalla de frecuencias: { testId: texto } → { ok, freqWeeks } o { ok:false, testId } */
    parseFreqInputs(raw) {
        const freqWeeks = {};
        for (const def of TEST_DEFINITIONS) {
            const t = String(raw && raw[def.id] !== undefined ? raw[def.id] : '').trim();
            if (t === '') { freqWeeks[def.id] = 0; continue; }   // en blanco = sin aviso
            const n = Number(t);
            if (!Number.isInteger(n) || n < 0 || n > this.MAX_FREQ_WEEKS) return { ok: false, testId: def.id };
            freqWeeks[def.id] = n;
        }
        return { ok: true, freqWeeks };
    },

    /**
     * Tests que "tocan repetir" por jugadora.
     *  • repeat: su último test es más antiguo que la frecuencia fijada.
     *  • never:  no tiene ningún registro, pero el equipo hizo ese test dentro del periodo de la frecuencia
     *            (se quedó fuera de la última sesión).
     * Solo cuenta si la frecuencia es > 0 y el equipo ha hecho alguna vez ese test.
     * isOut(playerId): las jugadoras fuera del grupo ese día no se testan, así que no avisan.
     * Devuelve [{ playerId, testId, kind, lastDate, weeks, freq, teamLast }].
     */
    repeatAlerts(sessions, players, freqWeeks, todayIso, isOut) {
        const toUtc = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN; };
        const today = toUtc(todayIso);
        const teamLast = {}, playerLast = {};
        (sessions || []).forEach(s => {
            if (!s.results) return;
            TEST_DEFINITIONS.forEach(def => {
                const r = s.results[def.id];
                if (!r || TestWizardLogic.mainValue(def, r) === null) return;
                if (!teamLast[def.id] || s.date > teamLast[def.id]) teamLast[def.id] = s.date;
                const k = s.playerId + '|' + def.id;
                if (!playerLast[k] || s.date > playerLast[k]) playerLast[k] = s.date;
            });
        });
        const out = [];
        (players || []).forEach(p => {
            if (isOut && isOut(p.id)) return;
            TEST_DEFINITIONS.forEach(def => {
                const freq = freqWeeks ? Number(freqWeeks[def.id]) : 0;
                const team = teamLast[def.id];
                if (!(freq > 0) || !team) return;
                const last = playerLast[p.id + '|' + def.id];
                if (last) {
                    const days = Math.floor((today - toUtc(last)) / 86400000);
                    if (days > freq * 7) out.push({ playerId: p.id, testId: def.id, kind: 'repeat', lastDate: last, weeks: Math.floor(days / 7), freq, teamLast: team });
                } else if (Math.floor((today - toUtc(team)) / 86400000) <= freq * 7) {
                    out.push({ playerId: p.id, testId: def.id, kind: 'never', lastDate: null, weeks: null, freq, teamLast: team });
                }
            });
        });
        return out;
    },

    /** Todos los avisos agrupados por jugadora: { playerId: { asym:[…], repeat:[…] } } (solo las que tienen alguno) */
    playerAlerts(sessions, players, freqWeeks, todayIso, isOut) {
        const by = {};
        const slot = pid => (by[pid] = by[pid] || { asym: [], repeat: [] });
        this.asymAlerts(sessions, players, todayIso).forEach(a => slot(a.playerId).asym.push(a));
        this.repeatAlerts(sessions, players, freqWeeks, todayIso, isOut)
            .sort((a, b) => (b.weeks === null ? -1 : 0) - (a.weeks === null ? -1 : 0) || (b.weeks || 0) - (a.weeks || 0))
            .forEach(a => slot(a.playerId).repeat.push(a));
        return by;
    },

    /** Largo de la barra (0–100): la mejor marca del día llena la barra entera */
    barPct(def, value, values) {
        if (!values.length || value === null || value <= 0) return 0;
        const pct = def.lowerIsBetter ? (Math.min(...values) / value) * 100 : (value / Math.max(...values)) * 100;
        return Math.max(4, Math.min(100, Math.round(pct)));
    }
};
window.TestTeamLogic = TestTeamLogic;

// ─────────────────────────────────────────
//  AJUSTES: frecuencia de repetición de cada test
// ─────────────────────────────────────────
const TEST_SETTINGS_LS_KEY = 'bk_test_settings';

/** Carga los ajustes (de este dispositivo) y escucha los de Firebase una sola vez, para que móvil y ordenador coincidan */
RPETracker.prototype._ensureTestSettings = function() {
    if (!this.testSettings) {
        let raw = null;
        try { raw = JSON.parse(localStorage.getItem(TEST_SETTINGS_LS_KEY) || 'null'); } catch (e) { raw = null; }
        this.testSettings = TestTeamLogic.normalizeSettings(raw);
    }
    if (this._testSettingsListener || !window.firebaseDB) return;
    this._testSettingsListener = true;
    try {
        window.firebaseDB.ref('testSettings').on('value', snap => {
            const v = snap.val();
            if (!v) return;                       // aún no hay ajustes en la nube: se usan los de aquí
            this.testSettings = TestTeamLogic.normalizeSettings(v);
            try { localStorage.setItem(TEST_SETTINGS_LS_KEY, JSON.stringify(this.testSettings)); } catch (e) { /* sin almacenamiento local */ }
            const editing = document.getElementById('testFreqModal');
            if (this.currentView === 'tests' && !(editing && editing.classList.contains('active'))) this.renderTestsView();
        }, err => console.warn('Ajustes de tests: sin acceso a la nube, se usan los de este dispositivo:', err && err.message));
    } catch (e) { console.warn('Ajustes de tests: no se pudo escuchar la nube:', e && e.message); }
};

RPETracker.prototype._saveTestSettings = function(freqWeeks) {
    this.testSettings = TestTeamLogic.normalizeSettings({ freqWeeks });
    try { localStorage.setItem(TEST_SETTINGS_LS_KEY, JSON.stringify(this.testSettings)); } catch (e) { /* sin almacenamiento local */ }
    try {
        if (window.firebaseDB) {
            const p = window.firebaseDB.ref('testSettings').set({ freqWeeks: this.testSettings.freqWeeks, updatedAt: new Date().toISOString() });
            if (p && typeof p.catch === 'function') p.catch(e => console.warn('No se pudieron sincronizar los ajustes de tests:', e && e.message));
        }
    } catch (e) { console.warn('No se pudieron sincronizar los ajustes de tests:', e && e.message); }
};

RPETracker.prototype._mountTestModal = function(id) {
    let modal = document.getElementById(id);
    if (!modal) {
        modal = document.createElement('div');
        modal.id = id;
        modal.className = 'modal';
        document.body.appendChild(modal);   // en <body>, como el resto de modales
    }
    modal.classList.add('active');
    return modal;
};

RPETracker.prototype._openTestFreqSettings = function() {
    this._ensureTestSettings();
    const modal = this._mountTestModal('testFreqModal');
    const weeks = this.testSettings.freqWeeks;
    const rows = TEST_DEFINITIONS.map(def => `
        <div class="tt-freq-row">
            <label for="ttFreq_${esc(def.id)}">${esc(def.name)}</label>
            <span class="tt-freq-field">cada
                <input type="number" min="0" max="${TestTeamLogic.MAX_FREQ_WEEKS}" step="1" inputmode="numeric" class="form-input tt-freq-input"
                    id="ttFreq_${esc(def.id)}" data-test="${esc(def.id)}" value="${esc(weeks[def.id] || '')}" placeholder="—">
                semanas</span>
        </div>`).join('');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-header-inner"><h2>⚙️ Cada cuánto repetir cada test</h2></div>
                <button class="modal-close" onclick="window.rpeTracker._closeTestModal('testFreqModal')" aria-label="Cerrar">✕</button>
            </div>
            <div class="modal-body tw-body">
                <p class="tw-hint" style="margin-top:0">Si una jugadora pasa más tiempo sin repetir un test, aparece un aviso ⏱ junto a su nombre en Tests. Deja el campo vacío (o 0) para no recibir avisos de ese test. Son valores propuestos: cámbialos a tu gusto.</p>
                <div class="tt-freq-list">${rows}</div>
            </div>
            <div class="tw-footer">
                <button type="button" class="btn-secondary" onclick="window.rpeTracker._resetTestFreqInputs()">Valores propuestos</button>
                <button type="button" class="btn-secondary" onclick="window.rpeTracker._closeTestModal('testFreqModal')">Cancelar</button>
                <button type="button" class="btn-primary" onclick="window.rpeTracker._submitTestFreqSettings()">Guardar</button>
            </div>
        </div>`;
};

RPETracker.prototype._closeTestModal = function(id) {
    const m = document.getElementById(id);
    if (m) m.classList.remove('active');
};

RPETracker.prototype._testFreqInputs = function() {
    const modal = document.getElementById('testFreqModal');
    return modal ? [...modal.querySelectorAll('input[data-test]')] : [];
};

RPETracker.prototype._resetTestFreqInputs = function() {
    this._testFreqInputs().forEach(inp => {
        const d = TestTeamLogic.DEFAULT_FREQ_WEEKS[inp.dataset.test];
        inp.value = d ? String(d) : '';
    });
};

RPETracker.prototype._submitTestFreqSettings = function() {
    const raw = {};
    this._testFreqInputs().forEach(inp => { raw[inp.dataset.test] = inp.value; });
    const res = TestTeamLogic.parseFreqInputs(raw);
    if (!res.ok) {
        const def = TestWizardLogic.defById(res.testId);
        const testName = def ? def.name : res.testId;
        this.showToast(`${testName}: escribe un número entero de semanas entre 0 y ${TestTeamLogic.MAX_FREQ_WEEKS}`, 'error');
        return;
    }
    this._saveTestSettings(res.freqWeeks);
    this._closeTestModal('testFreqModal');
    this.showToast('Frecuencias guardadas', 'success');
    if (this.currentView === 'tests') this.renderTestsView();
};

// ─────────────────────────────────────────
//  AVISOS POR JUGADORA (lista de Tests)
// ─────────────────────────────────────────

/** Avisos de cada jugadora de la plantilla actual: { playerId: { asym:[…], repeat:[…] } } */
RPETracker.prototype._testAlertsByPlayer = function() {
    this._ensureTestSettings();
    const sessions = this.testSessions || [];
    if (!sessions.length) return {};
    const today = toLocalISODate(new Date());
    const isOut = pid => typeof this.getPlayerParticipation === 'function' && this.getPlayerParticipation(pid, today) === 'out';
    return TestTeamLogic.playerAlerts(sessions, this.activePlayers || [], this.testSettings.freqWeeks, today, isOut);
};

/** Insignias junto al nombre: 🦵 asimetría y ⏱ toca repetir (con cuántos). Pulsarlas abre la explicación */
RPETracker.prototype._testAlertBadgesHtml = function(playerId, alerts) {
    if (!alerts || (!alerts.asym.length && !alerts.repeat.length)) return '';
    const pid = esc(playerId);
    const btn = (cls, icon, n, title) => `<button type="button" class="tt-alert tt-alert--${cls}" title="${esc(title)}" aria-label="${esc(title)}"
        onclick="event.stopPropagation(); window.rpeTracker._openTestAlerts('${pid}')">${icon} ${n}</button>`;
    return (alerts.asym.length ? btn('asym', '🦵', alerts.asym.length, 'Asimetría alta entre piernas: pulsa para ver el detalle') : '')
         + (alerts.repeat.length ? btn('repeat', '⏱', alerts.repeat.length, 'Toca repetir tests: pulsa para ver el detalle') : '');
};

/** Explica qué pasa con esa jugadora y ofrece ir al problema */
RPETracker.prototype._openTestAlerts = function(playerId) {
    const p = (this.players || []).find(x => x.id === playerId);
    const al = this._testAlertsByPlayer()[playerId];
    if (!p || !al) return;
    const f = v => TestWizardLogic.fmt(v);
    const dm = iso => this._ttFmtDate(iso);
    const pid = esc(playerId);
    const actions = (testId, registerLabel) => `
        <div class="tt-alert-actions">
            <button type="button" class="btn-secondary" data-pid="${pid}" data-test="${esc(testId)}"
                onclick="window.rpeTracker._testAlertGo('view', this.dataset.pid, this.dataset.test)">📈 Ver evolución</button>
            <button type="button" class="btn-primary" data-pid="${pid}" data-test="${esc(testId)}"
                onclick="window.rpeTracker._testAlertGo('register', this.dataset.pid, this.dataset.test)">${registerLabel}</button>
        </div>`;

    const asymHtml = al.asym.map(a => {
        const d = TestWizardLogic.defById(a.testId);
        if (!d) return '';
        const weaker = (d.lowerIsBetter ? a.left > a.right : a.left < a.right) ? 'izquierda' : 'derecha';
        return `
        <div class="tt-alert-item tt-alert-item--asym">
            <div class="tt-alert-item-title">🦵 ${esc(d.name)} · ${esc(dm(a.date))}</div>
            <div>I <strong>${esc(f(a.left))}</strong> · D <strong>${esc(f(a.right))}</strong> ${esc(d.unit)} → asimetría <strong style="color:var(--color-danger,#f44336)">${esc(a.asym.toFixed(1))}%</strong></div>
            <p class="tw-hint">La pierna ${weaker} rinde peor. Una diferencia de este tamaño entre piernas (la app la marca en rojo desde el ${TestTeamLogic.ASYM_ALERT_PCT} %) conviene vigilarla: compárala con sus tests anteriores y valora trabajar la pierna más débil. El aviso desaparece cuando un test posterior baje de ese umbral.</p>
            ${actions(a.testId, '🔁 Repetir este test')}
        </div>`;
    }).join('');

    const repeatHtml = al.repeat.map(a => {
        const d = TestWizardLogic.defById(a.testId);
        if (!d) return '';
        const why = a.kind === 'never'
            ? `Todavía no tiene ningún registro de este test. El equipo lo hizo por última vez el ${esc(dm(a.teamLast))}.`
            : `Su último test fue el ${esc(dm(a.lastDate))} (hace ${a.weeks} ${a.weeks === 1 ? 'semana' : 'semanas'}). Has fijado repetirlo cada ${a.freq} ${a.freq === 1 ? 'semana' : 'semanas'}.`;
        return `
        <div class="tt-alert-item tt-alert-item--repeat">
            <div class="tt-alert-item-title">⏱ ${esc(d.name)}</div>
            <div>${why}</div>
            ${actions(a.testId, `➕ Registrar ${esc(d.name)}`)}
        </div>`;
    }).join('');

    const modal = this._mountTestModal('testAlertsModal');
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-header-inner"><h2>⚠️ Avisos de tests · ${esc(this.playerDisplayName(p))}</h2></div>
                <button class="modal-close" onclick="window.rpeTracker._closeTestModal('testAlertsModal')" aria-label="Cerrar">✕</button>
            </div>
            <div class="modal-body tw-body">
                ${asymHtml ? `<div class="tw-section-title">Asimetría entre piernas</div>${asymHtml}` : ''}
                ${repeatHtml ? `<div class="tw-section-title">Toca repetir</div>${repeatHtml}` : ''}
            </div>
            <div class="tw-footer">
                <button type="button" class="btn-secondary" onclick="window.rpeTracker._closeTestModal('testAlertsModal'); window.rpeTracker._openTestFreqSettings()">⚙️ Ajustar frecuencias</button>
                <button type="button" class="btn-primary" onclick="window.rpeTracker._closeTestModal('testAlertsModal')">Cerrar</button>
            </div>
        </div>`;
};

/** Botones de un aviso: 'view' abre la ficha de tests de la jugadora en ese test; 'register' abre el asistente listo para registrarlo */
RPETracker.prototype._testAlertGo = function(action, playerId, testId) {
    this._closeTestModal('testAlertsModal');
    if (action === 'register') {
        this._openTestWizard(playerId, testId);
        return;
    }
    this._testSub = 'player';
    this._testPlayerId = playerId;
    if (testId) this._testChartTab = testId;
    this.renderTestsView();
};

// ─────────────────────────────────────────
//  PANTALLA
// ─────────────────────────────────────────

/** Pestañas "Por jugadora" / "Por test" (las usa también la lista de jugadoras de strength.js) */
RPETracker.prototype._testsTabsHtml = function(active) {
    const tab = (id, label) => `<button type="button" class="tt-tab ${active === id ? 'tt-tab--active' : ''}"
        onclick="window.rpeTracker._testsSwitchTab('${id}')">${label}</button>`;
    return `<div class="tt-tabs">${tab('list', '👤 Por jugadora')}${tab('byTest', '📈 Por test')}</div>`;
};

RPETracker.prototype._testsSwitchTab = function(id) {
    this._testSub = id === 'byTest' ? 'byTest' : 'list';
    this.renderTestsView();
};

RPETracker.prototype._ttFmtDate = function(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso || '');
};

RPETracker.prototype._ttSelectTest = function(id) {
    this._tt = { testId: id, date: null, players: new Set() };
    this.renderTestsView();
};
RPETracker.prototype._ttSetDate = function(date) {
    this._tt.date = date;
    this.renderTestsView();
};
RPETracker.prototype._ttTogglePlayer = function(id) {
    const s = this._tt.players;
    if (s.has(id)) s.delete(id); else s.add(id);
    this.renderTestsView();
};
RPETracker.prototype._ttClearPlayers = function() {
    this._tt.players = new Set();
    this.renderTestsView();
};

RPETracker.prototype._renderTestByTest = function(el) {
    const sessions = this.testSessions || [];
    const L = TestWizardLogic, T = TestTeamLogic;
    const f = v => L.fmt(v);

    const header = `
        <div class="str-header">
            <h2>📊 Tests de Rendimiento</h2>
            <div class="str-header-actions">
                <button class="btn-secondary" onclick="window.rpeTracker.showTestsReportMenu()">📄 Informe</button>
                <button class="btn-secondary" onclick="window.rpeTracker._openTestFreqSettings()" title="Cada cuánto repetir cada test" aria-label="Frecuencias de repetición">⚙️</button>
                <button class="btn-primary" onclick="window.rpeTracker._openTestWizard(null, window.rpeTracker._tt && window.rpeTracker._tt.testId)" title="Nuevo test" aria-label="Nuevo test">+</button>
            </div>
        </div>
        ${this._testsTabsHtml('byTest')}`;

    const usage = T.usage(sessions);
    if (usage.length === 0) {
        el.innerHTML = `<div class="str-container">${header}
            <p class="str-empty">Aún no hay datos de ningún test. Pulsa <strong>+</strong> para registrar el primero.</p></div>`;
        return;
    }

    // Estado: test, día y jugadoras superpuestas en el gráfico
    if (!this._tt || !usage.find(u => u.def.id === this._tt.testId)) {
        this._tt = { testId: usage[0].def.id, date: null, players: new Set() };
    }
    const def = L.defById(this._tt.testId);
    const dates = T.datesWithTest(def, sessions);
    if (!this._tt.date || !dates.find(d => d.date === this._tt.date)) this._tt.date = dates[0].date;
    const date = this._tt.date;

    const testTabs = usage.map(u => `
        <button type="button" class="test-tab-btn ${u.def.id === def.id ? 'active' : ''}"
            onclick="window.rpeTracker._ttSelectTest('${u.def.id}')">${esc(u.def.name)}</button>`).join('');

    // Ranking del día elegido
    const idsThatDay = [...new Set(sessions.filter(s => s.date === date && s.results && s.results[def.id]).map(s => s.playerId))];
    const sm = L.buildSummary(def, sessions, date, idsThatDay);
    const values = sm.rows.map(r => r.main);
    const best = T.best(def, sessions);
    const bestPlayer = best ? (this.players || []).find(p => p.id === best.playerId) : null;

    const kpis = `
        <div class="tt-kpis">
            <div class="tt-kpi">
                <div class="tt-kpi-label">Media del equipo · ${esc(this._ttFmtDate(date))}</div>
                <div class="tt-kpi-value">${esc(f(sm.teamMean))} <span class="tt-kpi-unit">${esc(def.unit)}</span></div>
                <div class="tt-kpi-sub">${this._twDeltaHtml(sm.teamPct, sm.teamImproved)}
                    ${sm.prevTeamDate ? `frente al ${esc(this._ttFmtDate(sm.prevTeamDate))}` : 'primer registro'}</div>
            </div>
            <div class="tt-kpi">
                <div class="tt-kpi-label">Mejor marca del equipo</div>
                <div class="tt-kpi-value">${best ? esc(f(best.value)) : '—'} <span class="tt-kpi-unit">${esc(def.unit)}</span></div>
                <div class="tt-kpi-sub">${best ? `${esc(bestPlayer ? this.playerDisplayName(bestPlayer) : '—')} · ${esc(this._ttFmtDate(best.date))}` : ''}</div>
            </div>
            <div class="tt-kpi">
                <div class="tt-kpi-label">Jugadoras evaluadas</div>
                <div class="tt-kpi-value">${sm.rows.length}</div>
                <div class="tt-kpi-sub">${def.lowerIsBetter ? 'En este test menos es mejor' : 'En este test más es mejor'}</div>
            </div>
        </div>`;

    const dateOptions = dates.map(d => `<option value="${esc(d.date)}" ${d.date === date ? 'selected' : ''}>${esc(this._ttFmtDate(d.date))} · ${d.count} jugadora(s)</option>`).join('');

    const rows = sm.rows.map((r, i) => {
        const p = (this.players || []).find(x => x.id === r.playerId);
        if (!p) return '';
        const shown = def.bilateral
            ? `I ${esc(f(r.result.left))} · D ${esc(f(r.result.right))}`
            : esc(f(r.main));
        return `
            <div class="tt-rank-row">
                <span class="tw-rank">${i + 1}</span>
                <span class="tw-row-avatar" style="background:${PlayerTokens.get(p)}">${esc(p.name.charAt(0).toUpperCase())}</span>
                <span class="tt-rank-name">${esc(this.playerLabel(p))}</span>
                <span class="tt-bar"><span class="tt-bar-fill" style="width:${T.barPct(def, r.main, values)}%"></span></span>
                <span class="tt-rank-value">${shown} <span class="tt-kpi-unit">${esc(def.unit)}</span></span>
                ${r.asym !== null ? `<span style="color:${asymColor(r.asym)};font-weight:700;font-size:0.75rem">Δ ${esc(r.asym)}%</span>` : ''}
                ${this._twDeltaHtml(r.pct, r.improved)}
                ${r.isPB ? '<span class="tw-pb" title="Mejor marca personal">🏅</span>' : ''}
            </div>`;
    }).join('');

    // Jugadoras que se pueden superponer en el gráfico (las que tienen datos de este test)
    const withData = T.playersWithTest(def, sessions);
    const roster = this.playersForHistory().filter(p => withData.has(p.id));
    const chips = roster.map(p => {
        const on = this._tt.players.has(p.id);
        return `<button type="button" class="player-filter-chip ${on ? 'player-filter-chip--selected' : ''}"
            style="--chip-color:${PlayerTokens.get(p)}" title="${esc(this.playerLabel(p))}"
            onclick="window.rpeTracker._ttTogglePlayer('${esc(p.id)}')">
            ${esc(this.playerChipLabel(p))}${on ? '<span class="player-filter-chip-check">✓</span>' : ''}
        </button>`;
    }).join('');

    const ser = T.series(def, sessions);
    const chartHtml = ser.dates.length >= 2
        ? `<div class="tt-chart-box"><canvas id="testTeamChart" height="170"></canvas></div>`
        : `<p class="str-empty">Hacen falta al menos dos días con este test para ver la evolución.</p>`;

    el.innerHTML = `
        <div class="str-container">
            ${header}
            <div class="test-tabs">${testTabs}</div>
            ${kpis}
            <div class="str-section">
                <div class="tt-section-head">
                    <h3 class="str-section-title" style="margin:0">🏆 Ranking</h3>
                    <select class="form-select tt-date-select" onchange="window.rpeTracker._ttSetDate(this.value)" aria-label="Día del test">${dateOptions}</select>
                </div>
                <div class="tt-rank-list">${rows || '<p class="str-empty">Sin datos ese día</p>'}</div>
                <p class="tw-hint">▲▼ = cambio frente al test anterior de cada jugadora (verde = mejora) · 🏅 = mejor marca personal${def.bilateral ? ' · en tests con dos piernas se compara la media de I y D' : ''}.</p>
            </div>
            <div class="str-section">
                <h3 class="str-section-title">📈 Evolución del equipo — ${esc(def.name)}</h3>
                <div class="player-filter-chips" style="margin:0 0 0.75rem;justify-content:flex-start">
                    <button type="button" class="player-filter-all-btn ${this._tt.players.size === 0 ? 'player-filter-all-btn--active' : ''}"
                        onclick="window.rpeTracker._ttClearPlayers()">Solo media</button>
                    ${chips}
                </div>
                ${chartHtml}
            </div>
        </div>`;

    this._ttDrawChart(def, ser);
};

RPETracker.prototype._ttDrawChart = function(def, ser) {
    if (ser.dates.length < 2 || typeof Chart === 'undefined') return;
    requestAnimationFrame(() => {
        const canvas = document.getElementById('testTeamChart');
        if (!canvas) return;
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        const textCol = isDark ? '#aaa' : '#666';
        const labels = ser.dates.map(d => this._ttFmtDate(d).slice(0, 5)); // dd/mm
        const datasets = [{
            label: 'Media del equipo', data: ser.mean,
            borderColor: '#ff6600', backgroundColor: '#ff660022', fill: true,
            borderWidth: 3, tension: 0.3, pointRadius: 5, pointBackgroundColor: '#ff6600', spanGaps: true
        }];
        [...this._tt.players].forEach(pid => {
            const p = (this.players || []).find(x => x.id === pid);
            if (!p || !ser.perPlayer[pid]) return;
            const color = PlayerTokens.get(p);
            datasets.push({
                label: this.playerChipLabel(p), data: ser.perPlayer[pid],
                borderColor: color, backgroundColor: color, fill: false,
                borderWidth: 1.5, tension: 0.2, pointRadius: 3, pointBackgroundColor: color, spanGaps: true
            });
        });
        if (canvas._chartInstance) canvas._chartInstance.destroy();
        canvas._chartInstance = new Chart(canvas.getContext('2d'), {
            type: 'line',
            data: { labels, datasets },
            options: {
                responsive: true,
                animation: { duration: 400 },
                plugins: {
                    legend: { display: datasets.length > 1, labels: { color: textCol, boxWidth: 12, font: { size: 10 } } },
                    tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.raw} ${def.unit}` } }
                },
                scales: {
                    x: { ticks: { color: textCol, font: { size: 10 } }, grid: { color: gridCol } },
                    y: {
                        ticks: { color: textCol, font: { size: 10 } }, grid: { color: gridCol },
                        title: { display: true, text: def.unit, color: textCol, font: { size: 10 } }
                    }
                }
            }
        });
    });
};

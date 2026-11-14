// ============================================================
//  tests-wizard.js — Registro de tests por equipo
//  Rendimiento → Tests → "+"
//
//  Flujo en 3 pasos:
//    1) Qué test, qué día y qué jugadoras lo hicieron
//    2) Tabla para meter los datos de esas jugadoras
//    3) Resumen: ranking, variación frente al test anterior y mejor marca
//
//  Los datos se guardan en el mismo formato de siempre (this.testSessions):
//  una sesión por jugadora y día, con los resultados de cada test dentro.
//  Si la jugadora ya tiene sesión ese día, el resultado se AÑADE a ella;
//  si no, se crea una sesión nueva. Así las gráficas, la ficha de cada
//  jugadora y los informes siguen funcionando sin migrar nada.
//
//  Depende de strength.js (TEST_DEFINITIONS, flightToHeight, heightToFlight,
//  sayersPeakPower, asymmetry, asymColor). Cargar DESPUÉS de strength.js.
//  El modal antiguo (_openNewTest) se conserva solo para EDITAR un test.
// ============================================================

// ─────────────────────────────────────────
//  LÓGICA PURA (sin DOM, probada en test/tests-wizard.test.js)
// ─────────────────────────────────────────
const TestWizardLogic = {
    DRAFT_KEY: 'bk_test_wizard_draft',
    DRAFT_MAX_AGE_MS: 48 * 3600 * 1000,
    OUTLIER_PCT: 30,

    defById(id) {
        return TEST_DEFINITIONS.find(d => d.id === id) || null;
    },

    /** Id único por sesión: si se guardan 12 jugadoras seguidas, Date.now() solo podría repetirse. */
    newId() {
        return Date.now().toString() + '_' + Math.random().toString(36).slice(2, 7);
    },

    /** Campos de la tabla según el tipo de test */
    fieldsFor(def) {
        const multiFlight = def.inputType === 'flight' && !!def.multiTrial;
        if (def.bilateral) return multiFlight ? ['l1', 'l2', 'l3', 'r1', 'r2', 'r3'] : ['l', 'r'];
        return multiFlight ? ['t1', 't2', 't3'] : ['v'];
    },

    /** Número escrito por la usuaria ("12,5" o "12.5"); null si está vacío o no es válido */
    parseNum(raw) {
        if (raw === null || raw === undefined) return null;
        const s = String(raw).trim().replace(',', '.');
        if (s === '') return null;
        const x = parseFloat(s);
        return isNaN(x) ? null : x;
    },

    /**
     * Convierte lo escrito en la fila en el resultado que se guarda.
     * Mismo formato que _saveTestSession de strength.js.
     * vals: { campo: texto }. Devuelve null si la fila no tiene ningún dato.
     */
    buildEntry(def, vals, bodyWeight) {
        const num = k => this.parseNum(vals ? vals[k] : null);
        const avg = arr => parseFloat((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1));
        const toHeight = ms => parseFloat(flightToHeight(ms));
        const multiFlight = def.inputType === 'flight' && !!def.multiTrial;

        if (def.bilateral) {
            let left = null, right = null, rawL, rawR, trialsL, trialsR;
            if (multiFlight) {
                const lh = [1, 2, 3].map(n => num('l' + n)).filter(v => v !== null).map(toHeight);
                const rh = [1, 2, 3].map(n => num('r' + n)).filter(v => v !== null).map(toHeight);
                if (lh.length) { left = avg(lh); trialsL = lh; }
                if (rh.length) { right = avg(rh); trialsR = rh; }
            } else {
                const lv = num('l'), rv = num('r');
                if (lv !== null) { left = def.inputType === 'flight' ? toHeight(lv) : lv; rawL = lv; }
                if (rv !== null) { right = def.inputType === 'flight' ? toHeight(rv) : rv; rawR = rv; }
            }
            if (left === null && right === null) return null;
            const entry = { left, right };
            if (rawL !== undefined) entry.raw_left = rawL;
            if (rawR !== undefined) entry.raw_right = rawR;
            if (trialsL !== undefined) entry.trials_left = trialsL;
            if (trialsR !== undefined) entry.trials_right = trialsR;
            return entry;
        }

        let value = null, raw, trials;
        if (multiFlight) {
            const hs = [1, 2, 3].map(n => num('t' + n)).filter(v => v !== null).map(toHeight);
            if (hs.length) { value = avg(hs); trials = hs; }
        } else {
            const v = num('v');
            if (v !== null) { value = def.inputType === 'flight' ? toHeight(v) : v; raw = v; }
        }
        if (value === null) return null;
        const entry = { value };
        if (raw !== undefined) entry.raw = raw;
        if (trials !== undefined) entry.trials = trials;
        if (def.powerCalc && bodyWeight > 0) {
            const power = sayersPeakPower(value, bodyWeight);
            if (power !== null) {
                entry.power = parseFloat(power.toFixed(0));
                entry.powerPerKg = parseFloat((power / bodyWeight).toFixed(1));
            }
        }
        return entry;
    },

    /** Inversa de buildEntry: rellena la fila con un resultado ya guardado (en ms / unidades de entrada) */
    valuesFromResult(def, r) {
        const out = {};
        if (!r) return out;
        const flight = def.inputType === 'flight';
        const multiFlight = flight && !!def.multiTrial;
        if (def.bilateral) {
            if (multiFlight) {
                (r.trials_left || []).slice(0, 3).forEach((h, i) => { if (h != null) out['l' + (i + 1)] = heightToFlight(h); });
                (r.trials_right || []).slice(0, 3).forEach((h, i) => { if (h != null) out['r' + (i + 1)] = heightToFlight(h); });
            } else {
                const l = r.raw_left != null ? r.raw_left : (r.left != null ? (flight ? heightToFlight(r.left) : r.left) : null);
                const d = r.raw_right != null ? r.raw_right : (r.right != null ? (flight ? heightToFlight(r.right) : r.right) : null);
                if (l != null) out.l = String(l);
                if (d != null) out.r = String(d);
            }
        } else if (multiFlight) {
            (r.trials || []).slice(0, 3).forEach((h, i) => { if (h != null) out['t' + (i + 1)] = heightToFlight(h); });
        } else {
            const v = r.raw != null ? r.raw : (r.value != null ? (flight ? heightToFlight(r.value) : r.value) : null);
            if (v != null) out.v = String(v);
        }
        return out;
    },

    /** Valor con el que se compara y ordena un resultado (en bilaterales, la media de los dos lados) */
    mainValue(def, r) {
        if (!r) return null;
        if (def.bilateral) {
            const vs = [r.left, r.right].filter(v => v != null);
            return vs.length ? vs.reduce((a, b) => a + b, 0) / vs.length : null;
        }
        return r.value != null ? r.value : null;
    },

    /** ¿a es mejor que b? (en sprints y agilidad, menos es mejor) */
    isBetter(def, a, b) {
        return def.lowerIsBetter ? a < b : a > b;
    },

    /** % de cambio de cur respecto a prev; null si no hay base */
    pctChange(prev, cur) {
        if (prev == null || cur == null || prev === 0) return null;
        return parseFloat((((cur - prev) / prev) * 100).toFixed(1));
    },

    fmt(v) {
        return v == null || isNaN(v) ? '—' : String(Number(Number(v).toFixed(2)));
    },

    /** Resultado de ese test que tiene la jugadora en ese día (el de la sesión creada más tarde) */
    resultOn(sessions, playerId, testId, date) {
        let best = null;
        (sessions || []).forEach(s => {
            if (s.playerId !== playerId || s.date !== date || !s.results || !s.results[testId]) return;
            if (!best || String(s.createdAt || '') >= String(best.createdAt || '')) best = s;
        });
        return best ? { session: best, result: best.results[testId] } : null;
    },

    /** Último resultado de ese test ANTERIOR a la fecha dada */
    previousResult(def, sessions, playerId, date) {
        const list = (sessions || [])
            .filter(s => s.playerId === playerId && s.date < date && s.results && s.results[def.id])
            .sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
        if (!list.length) return null;
        const r = list[0].results[def.id];
        return { date: list[0].date, result: r, main: this.mainValue(def, r) };
    },

    /** Mejor valor de la jugadora en ese test antes de la fecha dada */
    bestBefore(def, sessions, playerId, date) {
        let best = null;
        (sessions || []).forEach(s => {
            if (s.playerId !== playerId || s.date >= date || !s.results || !s.results[def.id]) return;
            const v = this.mainValue(def, s.results[def.id]);
            if (v != null && (best === null || this.isBetter(def, v, best))) best = v;
        });
        return best;
    },

    /** Último peso registrado de la jugadora (para sugerirlo en CMJ/SJ); el de ese mismo día tiene prioridad */
    lastBodyWeight(sessions, playerId, date) {
        const list = (sessions || [])
            .filter(s => s.playerId === playerId && s.bodyWeight > 0)
            .sort((a, b) => (b.date === date) - (a.date === date) || b.date.localeCompare(a.date));
        return list.length ? list[0].bodyWeight : null;
    },

    /** ¿El cambio respecto al test anterior es tan grande que parece un error al teclear? */
    isOutlier(prevMain, curMain) {
        const pct = this.pctChange(prevMain, curMain);
        return pct !== null && Math.abs(pct) > this.OUTLIER_PCT;
    },

    /**
     * Añade los resultados a las sesiones: una por jugadora y día.
     * items: [{ playerId, entry, bodyWeight }]. No modifica el array original.
     * Devuelve { sessions, created, updated, overwritten:[playerId] }.
     */
    mergeResults(sessions, items, testId, date, nowIso, idFn) {
        const out = (sessions || []).slice();
        let created = 0, updated = 0;
        const overwritten = [];
        items.forEach(({ playerId, entry, bodyWeight }) => {
            let idx = -1;
            out.forEach((s, i) => {
                if (s.playerId !== playerId || s.date !== date) return;
                if (idx === -1 || String(s.createdAt || '') >= String(out[idx].createdAt || '')) idx = i;
            });
            if (idx >= 0) {
                const s = out[idx];
                if (s.results && s.results[testId]) overwritten.push(playerId);
                const upd = { ...s, results: { ...(s.results || {}), [testId]: entry }, updatedAt: nowIso };
                if (bodyWeight > 0) upd.bodyWeight = bodyWeight;
                out[idx] = upd;
                updated++;
            } else {
                const s = { id: idFn(), playerId, date, results: { [testId]: entry }, createdAt: nowIso };
                if (bodyWeight > 0) s.bodyWeight = bodyWeight;
                out.push(s);
                created++;
            }
        });
        return { sessions: out, created, updated, overwritten };
    },

    /** Datos del resumen final: ranking, variaciones, mejores marcas y media del equipo */
    buildSummary(def, sessions, date, playerIds) {
        const rows = [];
        playerIds.forEach(pid => {
            const cur = this.resultOn(sessions, pid, def.id, date);
            if (!cur) return;
            const main = this.mainValue(def, cur.result);
            if (main === null) return;
            const prev = this.previousResult(def, sessions, pid, date);
            const best = this.bestBefore(def, sessions, pid, date);
            const pct = prev ? this.pctChange(prev.main, main) : null;
            rows.push({
                playerId: pid,
                result: cur.result,
                main,
                prevMain: prev ? prev.main : null,
                prevDate: prev ? prev.date : null,
                pct,
                improved: pct === null ? null : (def.lowerIsBetter ? pct < 0 : pct > 0),
                isPB: best !== null && this.isBetter(def, main, best),
                asym: def.bilateral && cur.result.left != null && cur.result.right != null
                    ? asymmetry(cur.result.left, cur.result.right) : null
            });
        });
        rows.sort((a, b) => (this.isBetter(def, a.main, b.main) ? -1 : this.isBetter(def, b.main, a.main) ? 1 : 0));

        const mean = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null;
        const teamMean = mean(rows.map(r => r.main));

        // Media del equipo en la fecha anterior en que se hizo este test
        let prevTeamDate = null;
        (sessions || []).forEach(s => {
            if (s.date < date && s.results && s.results[def.id] && (prevTeamDate === null || s.date > prevTeamDate)) prevTeamDate = s.date;
        });
        let prevTeamMean = null;
        if (prevTeamDate) {
            const ids = new Set((sessions || []).filter(s => s.date === prevTeamDate && s.results && s.results[def.id]).map(s => s.playerId));
            const vals = [...ids].map(pid => {
                const r = this.resultOn(sessions, pid, def.id, prevTeamDate);
                return r ? this.mainValue(def, r.result) : null;
            }).filter(v => v !== null);
            prevTeamMean = mean(vals);
        }
        const teamPct = this.pctChange(prevTeamMean, teamMean);
        return {
            rows, teamMean, prevTeamMean, prevTeamDate, teamPct,
            teamImproved: teamPct === null ? null : (def.lowerIsBetter ? teamPct < 0 : teamPct > 0)
        };
    },

    // ── Borrador (para no perder lo escrito si se cierra la pantalla o se corta la conexión) ──
    loadDraft(storage, nowMs) {
        try {
            const d = JSON.parse(storage.getItem(this.DRAFT_KEY) || 'null');
            if (!d || typeof d !== 'object' || !this.defById(d.testId) || typeof d.date !== 'string' || !Array.isArray(d.playerIds)) return null;
            if (!d.savedAt || nowMs - new Date(d.savedAt).getTime() > this.DRAFT_MAX_AGE_MS) return null;
            return d;
        } catch (e) { return null; }
    },
    saveDraft(storage, draft) {
        try { storage.setItem(this.DRAFT_KEY, JSON.stringify(draft)); } catch (e) { /* sin espacio: no pasa nada */ }
    },
    clearDraft(storage) {
        try { storage.removeItem(this.DRAFT_KEY); } catch (e) { /* nada */ }
    }
};
window.TestWizardLogic = TestWizardLogic;

// ─────────────────────────────────────────
//  PANTALLAS
// ─────────────────────────────────────────

RPETracker.prototype._twShortDate = function(iso) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ''));
    return m ? `${m[3]}/${m[2]}` : String(iso || '');
};

/** Texto de ayuda sobre qué escribir en los campos de cada tipo de test */
RPETracker.prototype._twInputHint = function(def) {
    const sides = def.bilateral ? ' · I = pierna izquierda, D = derecha' : '';
    switch (def.inputType) {
        case 'flight':   return `Tiempo de vuelo en ms de cada salto: la app calcula la altura en cm y la media${sides}`;
        case 'count':    return `Número de repeticiones${sides}`;
        case 'distance': return `Distancia en cm${sides}`;
        case 'time':     return `Tiempo en segundos${sides}`;
        case 'speed':    return `Velocidad en km/h`;
        default:         return `Valor en ${def.unit}${sides}`;
    }
};

RPETracker.prototype._openTestWizard = function(preselectedPlayerId, preselectedTestId) {
    if (!this.testSessions) this._loadStrengthData();
    const date = toLocalISODate(new Date());
    this._tw = {
        step: 1, testId: null, date,
        playerIds: new Set(), touched: false,
        vals: {}, weights: {}, prefill: {}, summary: null
    };
    // Desde la vista "Por test" el test ya viene elegido
    if (preselectedTestId && TestWizardLogic.defById(preselectedTestId)) this._tw.testId = preselectedTestId;
    if (preselectedPlayerId) {
        this._tw.playerIds.add(preselectedPlayerId);
        this._tw.touched = true;
    } else {
        this._twApplyDefaultSelection();
    }

    let modal = document.getElementById('testWizardModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'testWizardModal';
        modal.className = 'modal';
        document.body.appendChild(modal); // en <body>: igual que el resto de modales (ver transform de .view.active)
    }
    modal.classList.add('active');
    this._twRender();
};

RPETracker.prototype._twRoster = function() {
    return this.getPlayersActiveOn(this._tw.date);
};

/** Por defecto: todas las que están en el grupo ese día (las lesionadas fuera del grupo vienen desmarcadas) */
RPETracker.prototype._twApplyDefaultSelection = function() {
    const date = this._tw.date;
    this._tw.playerIds = new Set(this._twRoster()
        .filter(p => typeof this.getPlayerParticipation !== 'function' || this.getPlayerParticipation(p.id, date) !== 'out')
        .map(p => p.id));
};

RPETracker.prototype._twRender = function() {
    const modal = document.getElementById('testWizardModal');
    if (!modal) return;
    const step = this._tw.step;
    const titles = {
        1: '📊 Nuevo test · 1/3 Test y jugadoras',
        2: '📊 Nuevo test · 2/3 Datos',
        3: '✅ Test guardado · 3/3 Resumen'
    };
    const body = step === 1 ? this._twStep1Html() : step === 2 ? this._twStep2Html() : this._twStep3Html();
    // Al repintar dentro del mismo paso (marcar una jugadora, cambiar de test) se conserva el scroll
    const oldBody = modal.querySelector ? modal.querySelector('.modal-body') : null;
    const keepScroll = oldBody && this._twLastStep === step ? oldBody.scrollTop : 0;
    modal.innerHTML = `
        <div class="modal-content modal-content--wide">
            <div class="modal-header">
                <div class="modal-header-inner"><h2>${titles[step]}</h2></div>
                <button class="modal-close" onclick="window.rpeTracker._twClose()" aria-label="Cerrar">✕</button>
            </div>
            ${body}
        </div>`;
    const newBody = modal.querySelector ? modal.querySelector('.modal-body') : null;
    if (newBody) newBody.scrollTop = keepScroll;
    this._twLastStep = step;
    if (step === 2) this._twRefreshAllRows();
};

RPETracker.prototype._twClose = function() {
    clearTimeout(this._twDraftTimer);
    if (this._tw && this._tw.step === 2) this._twPersistDraft(); // lo escrito queda como borrador
    document.getElementById('testWizardModal')?.classList.remove('active');
};

// ── Paso 1: test, día y jugadoras ─────────────────────────────────────────────
RPETracker.prototype._twStep1Html = function() {
    const tw = this._tw;
    const sessions = this.testSessions || [];

    // Los tests que más se hacen, primero
    const usage = TEST_DEFINITIONS.map((def, i) => {
        const withTest = sessions.filter(s => s.results && s.results[def.id]);
        const last = withTest.reduce((m, s) => (s.date > m ? s.date : m), '');
        return { def, i, count: withTest.length, last };
    }).sort((a, b) => b.count - a.count || a.i - b.i);

    const testButtons = usage.map(u => `
        <button type="button" class="tw-test-btn ${tw.testId === u.def.id ? 'tw-test-btn--selected' : ''}"
            onclick="window.rpeTracker._twSelectTest('${u.def.id}')">
            <span class="tw-test-btn-name">${esc(u.def.name)}</span>
            <span class="tw-test-btn-meta">${u.count ? `último: ${esc(this._twShortDate(u.last))}` : 'sin registros'}</span>
        </button>`).join('');

    const roster = this._twRoster();
    const allSelected = roster.length > 0 && roster.every(p => tw.playerIds.has(p.id));
    const chips = roster.map(p => {
        const checked = tw.playerIds.has(p.id);
        const out = typeof this.getPlayerParticipation === 'function' && this.getPlayerParticipation(p.id, tw.date) === 'out';
        return `<button type="button" class="player-filter-chip ${checked ? 'player-filter-chip--selected' : ''}"
                style="--chip-color:${PlayerTokens.get(p)}"
                title="${esc(this.playerLabel(p))}${out ? ' · fuera del grupo' : ''}"
                onclick="window.rpeTracker._twTogglePlayer('${esc(p.id)}')">
                ${esc(this.playerChipLabel(p))}${out ? ' 🏥' : ''}
                ${checked ? '<span class="player-filter-chip-check">✓</span>' : ''}
            </button>`;
    }).join('');

    const draft = TestWizardLogic.loadDraft(localStorage, Date.now());
    const draftDef = draft ? TestWizardLogic.defById(draft.testId) : null;
    const draftHtml = draftDef ? `
        <div class="tw-banner">
            <div>📝 Tienes un borrador sin guardar: <strong>${esc(draftDef.name)}</strong> · ${esc(this._twShortDate(draft.date))} · ${draft.playerIds.length} jugadora(s)</div>
            <div class="tw-banner-actions">
                <button type="button" class="btn-primary" onclick="window.rpeTracker._twResumeDraft()">Continuar</button>
                <button type="button" class="btn-secondary" onclick="window.rpeTracker._twDiscardDraft()">Descartar</button>
            </div>
        </div>` : '';

    const ready = !!tw.testId && tw.playerIds.size > 0;
    return `
        <div class="modal-body tw-body">
            ${draftHtml}
            <div class="tw-section-title">1. ¿Qué test has hecho?</div>
            <div class="tw-test-grid">${testButtons}</div>

            <div class="tw-section-title">2. ¿Qué día?</div>
            <input type="date" class="form-input tw-date" value="${esc(tw.date)}" max="${esc(toLocalISODate(new Date()))}"
                onchange="window.rpeTracker._twSetDate(this.value)">

            <div class="tw-section-title">3. ¿Qué jugadoras lo hicieron?</div>
            <div class="player-filter-chips" style="margin:0;justify-content:flex-start">
                <button type="button" class="player-filter-all-btn ${allSelected ? 'player-filter-all-btn--active' : ''}"
                    onclick="window.rpeTracker._twSelectAll()">${allSelected ? '✓ Todas' : 'Todas'}</button>
                ${chips}
            </div>
            <p class="tw-hint">🏥 = fuera del grupo ese día (viene desmarcada, pero puedes marcarla).</p>
        </div>
        <div class="tw-footer">
            <button type="button" class="btn-secondary" onclick="window.rpeTracker._twClose()">Cancelar</button>
            <button type="button" class="btn-primary" ${ready ? '' : 'disabled'} onclick="window.rpeTracker._twContinue()">
                Continuar${ready ? ` (${tw.playerIds.size})` : ''} →
            </button>
        </div>`;
};

RPETracker.prototype._twSelectTest = function(id) {
    this._tw.testId = id;
    this._twRender();
};
RPETracker.prototype._twSetDate = function(v) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return;
    this._tw.date = v;
    if (this._tw.touched) {
        const ids = new Set(this._twRoster().map(p => p.id));
        this._tw.playerIds = new Set([...this._tw.playerIds].filter(id => ids.has(id)));
    } else {
        this._twApplyDefaultSelection();
    }
    this._twRender();
};
RPETracker.prototype._twTogglePlayer = function(id) {
    const s = this._tw.playerIds;
    if (s.has(id)) s.delete(id); else s.add(id);
    this._tw.touched = true;
    this._twRender();
};
RPETracker.prototype._twSelectAll = function() {
    const roster = this._twRoster();
    const all = roster.length > 0 && roster.every(p => this._tw.playerIds.has(p.id));
    this._tw.playerIds = all ? new Set() : new Set(roster.map(p => p.id));
    this._tw.touched = true;
    this._twRender();
};

RPETracker.prototype._twContinue = function() {
    const tw = this._tw;
    if (!tw.testId || tw.playerIds.size === 0) return;
    const def = TestWizardLogic.defById(tw.testId);
    const sessions = this.testSessions || [];

    // Prepara los valores de cada jugadora: lo ya escrito (borrador) o, si ya tenía ese test ese día, lo guardado
    tw.playerIds.forEach(pid => {
        const existing = TestWizardLogic.resultOn(sessions, pid, def.id, tw.date);
        const stored = existing ? TestWizardLogic.valuesFromResult(def, existing.result) : null;
        tw.prefill[pid] = stored ? JSON.stringify(stored) : null;
        if (!tw.vals[pid]) tw.vals[pid] = stored ? { ...stored } : {};
        if (def.powerCalc && tw.weights[pid] === undefined) {
            const w = existing && existing.session.bodyWeight > 0
                ? existing.session.bodyWeight
                : TestWizardLogic.lastBodyWeight(sessions, pid, tw.date);
            tw.weights[pid] = w ? String(w) : '';
        }
    });
    tw.step = 2;
    this._twRender();
    this._twPersistDraft();
};

RPETracker.prototype._twBack = function() {
    this._twPersistDraft();
    this._tw.step = 1;
    this._twRender();
};

// ── Borrador ──────────────────────────────────────────────────────────────────
RPETracker.prototype._twPersistDraft = function() {
    const tw = this._tw;
    if (!tw || !tw.testId) return;
    const hasData = [...tw.playerIds].some(pid => Object.values(tw.vals[pid] || {}).some(v => String(v).trim() !== ''));
    if (!hasData) { TestWizardLogic.clearDraft(localStorage); return; }
    TestWizardLogic.saveDraft(localStorage, {
        testId: tw.testId, date: tw.date, playerIds: [...tw.playerIds],
        vals: tw.vals, weights: tw.weights, savedAt: new Date().toISOString()
    });
};
RPETracker.prototype._twResumeDraft = function() {
    const d = TestWizardLogic.loadDraft(localStorage, Date.now());
    if (!d) { this._twRender(); return; }
    const tw = this._tw;
    tw.testId = d.testId;
    tw.date = d.date;
    tw.playerIds = new Set(d.playerIds);
    tw.touched = true;
    tw.vals = d.vals && typeof d.vals === 'object' ? d.vals : {};
    tw.weights = d.weights && typeof d.weights === 'object' ? d.weights : {};
    this._twContinue();
};
RPETracker.prototype._twDiscardDraft = function() {
    TestWizardLogic.clearDraft(localStorage);
    this._twRender();
};

// ── Paso 2: tabla de datos ────────────────────────────────────────────────────
RPETracker.prototype._twPlayersInTable = function() {
    return this._twRoster().filter(p => this._tw.playerIds.has(p.id));
};

RPETracker.prototype._twInputHtml = function(pid, f, placeholder, value) {
    return `<input type="text" inputmode="decimal" autocomplete="off" class="form-input tw-input"
        data-pid="${esc(pid)}" data-f="${f}" placeholder="${esc(placeholder)}" value="${esc(value)}"
        oninput="window.rpeTracker._twOnInput(this)" onkeydown="window.rpeTracker._twKey(event, this)">`;
};

RPETracker.prototype._twRowHtml = function(def, p) {
    const tw = this._tw;
    const sessions = this.testSessions || [];
    const pid = p.id;
    const vals = tw.vals[pid] || {};
    const prev = TestWizardLogic.previousResult(def, sessions, pid, tw.date);
    const prevText = prev && prev.main !== null
        ? `Último (${esc(this._twShortDate(prev.date))}): ${esc(TestWizardLogic.fmt(prev.main))} ${esc(def.unit)}`
        : 'Sin test anterior';
    const out = typeof this.getPlayerParticipation === 'function' && this.getPlayerParticipation(pid, tw.date) === 'out';
    const existingTag = tw.prefill[pid] ? '<span class="tw-tag">✎ ya registrado</span>' : '';
    const inp = (f, ph) => this._twInputHtml(pid, f, ph, vals[f] === undefined ? '' : vals[f]);

    let fields;
    if (def.bilateral) {
        const n = def.inputType === 'flight' && def.multiTrial;
        fields = `
            <div class="tw-group"><span class="tw-side">I</span>${n ? inp('l1', 'S1') + inp('l2', 'S2') + inp('l3', 'S3') : inp('l', 'Izq')}</div>
            <div class="tw-group"><span class="tw-side">D</span>${n ? inp('r1', 'S1') + inp('r2', 'S2') + inp('r3', 'S3') : inp('r', 'Der')}</div>`;
    } else if (def.inputType === 'flight' && def.multiTrial) {
        fields = `<div class="tw-group">${inp('t1', 'Salto 1') + inp('t2', 'Salto 2') + inp('t3', 'Salto 3')}</div>`;
    } else {
        fields = `<div class="tw-group">${inp('v', def.unit)}</div>`;
    }
    const weight = def.powerCalc ? `
        <div class="tw-group tw-group--weight">
            <span class="tw-side">kg</span>
            <input type="text" inputmode="decimal" autocomplete="off" class="form-input tw-input" data-pid="${esc(pid)}" data-f="w"
                placeholder="Peso" value="${esc(tw.weights[pid] === undefined ? '' : tw.weights[pid])}"
                oninput="window.rpeTracker._twOnInput(this)" onkeydown="window.rpeTracker._twKey(event, this)">
        </div>` : '';

    return `
        <div class="tw-row" data-row="${esc(pid)}">
            <div class="tw-row-head">
                <span class="tw-row-avatar" style="background:${PlayerTokens.get(p)}">${esc(p.name.charAt(0).toUpperCase())}</span>
                <span class="tw-row-name">${esc(this.playerDisplayName(p))}${out ? ' 🏥' : ''}</span>
                ${existingTag}
                <span class="tw-row-last">${prevText}</span>
            </div>
            <div class="tw-row-fields">${fields}${weight}</div>
            <div class="tw-calc" data-calc="${esc(pid)}"></div>
        </div>`;
};

RPETracker.prototype._twStep2Html = function() {
    const tw = this._tw;
    const def = TestWizardLogic.defById(tw.testId);
    const rows = this._twPlayersInTable().map(p => this._twRowHtml(def, p)).join('');
    return `
        <div class="modal-body tw-body">
            <div class="tw-test-title"><strong>${esc(def.name)}</strong> · ${esc(this._twShortDate(tw.date))} · ${this._twPlayersInTable().length} jugadora(s)</div>
            <p class="tw-hint">${esc(this._twInputHint(def))}. Deja en blanco a quien no lo hizo. Con Intro pasas al siguiente campo.</p>
            <div class="tw-rows">${rows}</div>
        </div>
        <div class="tw-footer">
            <button type="button" class="btn-secondary" onclick="window.rpeTracker._twBack()">← Atrás</button>
            <button type="button" class="btn-primary" id="twSaveBtn" onclick="window.rpeTracker._twSave()">💾 Guardar</button>
        </div>`;
};

/** Datos de cada fila a partir de lo escrito: resultado, aviso de valor raro y si hay cambios */
RPETracker.prototype._twItems = function() {
    const tw = this._tw;
    const def = TestWizardLogic.defById(tw.testId);
    const sessions = this.testSessions || [];
    const items = [];
    this._twPlayersInTable().forEach(p => {
        const vals = tw.vals[p.id] || {};
        const weight = def.powerCalc ? TestWizardLogic.parseNum(tw.weights[p.id]) : null;
        const entry = TestWizardLogic.buildEntry(def, vals, weight);
        if (!entry) return;
        const prev = TestWizardLogic.previousResult(def, sessions, p.id, tw.date);
        const main = TestWizardLogic.mainValue(def, entry);
        const existing = !!tw.prefill[p.id];
        // Si la fila ya estaba guardada y no se ha tocado, no se reescribe (evita redondeos al convertir ms ↔ cm)
        const unchanged = existing && JSON.stringify(vals) === tw.prefill[p.id]
            && (!def.powerCalc || String(weight || '') === String(TestWizardLogic.resultOn(sessions, p.id, def.id, tw.date).session.bodyWeight || ''));
        items.push({
            playerId: p.id, entry, bodyWeight: weight, main,
            prev, pct: prev ? TestWizardLogic.pctChange(prev.main, main) : null,
            outlier: !!prev && TestWizardLogic.isOutlier(prev.main, main),
            existing, changed: !unchanged
        });
    });
    return items;
};

RPETracker.prototype._twOnInput = function(el) {
    const clean = el.value.replace(/[^0-9.,]/g, '');
    if (clean !== el.value) el.value = clean;
    const pid = el.dataset.pid, f = el.dataset.f;
    const tw = this._tw;
    if (f === 'w') tw.weights[pid] = clean;
    else { if (!tw.vals[pid]) tw.vals[pid] = {}; tw.vals[pid][f] = clean; }
    this._twUpdateRow(pid);
    this._twUpdateSaveBtn();
    clearTimeout(this._twDraftTimer);
    this._twDraftTimer = setTimeout(() => this._twPersistDraft(), 400);
};

RPETracker.prototype._twKey = function(e, el) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    const modal = document.getElementById('testWizardModal');
    const inputs = [...modal.querySelectorAll('.tw-input')];
    const next = inputs[inputs.indexOf(el) + 1];
    if (next) { next.focus(); if (next.select) next.select(); }
    else document.getElementById('twSaveBtn')?.focus();
};

RPETracker.prototype._twRefreshAllRows = function() {
    this._twPlayersInTable().forEach(p => this._twUpdateRow(p.id));
    this._twUpdateSaveBtn();
};

RPETracker.prototype._twUpdateSaveBtn = function() {
    const btn = document.getElementById('twSaveBtn');
    if (!btn) return;
    const n = this._twItems().length;
    btn.textContent = n ? `💾 Guardar (${n})` : '💾 Guardar';
};

/** Variación respecto al test anterior, con flecha según suba o baje el valor y color según mejore o empeore */
RPETracker.prototype._twDeltaHtml = function(pct, improved) {
    if (pct === null) return '';
    const arrow = pct > 0 ? '▲' : pct < 0 ? '▼' : '=';
    const cls = pct === 0 || improved === null ? 'flat' : improved ? 'good' : 'bad';
    return `<span class="tw-delta tw-delta--${cls}">${arrow} ${pct > 0 ? '+' : ''}${pct}%</span>`;
};

RPETracker.prototype._twUpdateRow = function(pid) {
    const modal = document.getElementById('testWizardModal');
    if (!modal) return;
    const box = [...modal.querySelectorAll('[data-calc]')].find(e => e.dataset.calc === pid);
    if (!box) return;
    const tw = this._tw;
    const def = TestWizardLogic.defById(tw.testId);
    const item = this._twItems().find(i => i.playerId === pid);
    const rowEl = box.closest('.tw-row');
    if (rowEl) rowEl.classList.toggle('tw-row--has-data', !!item);
    if (!item) { box.innerHTML = ''; return; }

    const e = item.entry;
    const improved = item.pct === null ? null : (def.lowerIsBetter ? item.pct < 0 : item.pct > 0);
    let text;
    if (def.bilateral) {
        const asym = e.left != null && e.right != null ? asymmetry(e.left, e.right) : null;
        text = `I: <strong>${esc(TestWizardLogic.fmt(e.left))}</strong> · D: <strong>${esc(TestWizardLogic.fmt(e.right))}</strong> ${esc(def.unit)}`
            + (asym !== null ? ` · <span style="color:${asymColor(asym)};font-weight:700">Δ ${esc(asym)}%</span>` : '');
    } else {
        text = `<strong>${esc(TestWizardLogic.fmt(e.value))} ${esc(def.unit)}</strong>`
            + (e.power != null ? ` · ⚡ ${esc(e.power)} W · ${esc(e.powerPerKg)} W/kg` : '');
    }
    const warn = item.outlier
        ? `<span class="tw-warn">⚠️ Cambia más de ${TestWizardLogic.OUTLIER_PCT}% respecto al anterior: revisa el dato</span>` : '';
    box.innerHTML = `${text} ${this._twDeltaHtml(item.pct, improved)} ${warn}`;
};

// ── Guardado ──────────────────────────────────────────────────────────────────
RPETracker.prototype._twSave = function() {
    const items = this._twItems();
    if (items.length === 0) { this.showToast('Introduce al menos un resultado', 'error'); return; }
    const changed = items.filter(i => i.changed);
    if (changed.length === 0) { this.showToast('No hay cambios que guardar', 'info'); return; }

    const warn = changed.filter(i => i.outlier).length;
    const over = changed.filter(i => i.existing).length;
    if (warn || over) {
        const parts = [];
        if (warn) parts.push(`${warn} valor(es) cambian más de ${TestWizardLogic.OUTLIER_PCT}% respecto al test anterior (marcados con ⚠️)`);
        if (over) parts.push(`${over} sustituyen datos ya guardados de ese día`);
        AppConfirm.show({
            title: 'Revisa antes de guardar',
            message: parts.join(' y ') + '. ¿Guardar igualmente?',
            confirmText: 'Guardar'
        }).then(ok => { if (ok) this._twCommit(items, changed); });
        return;
    }
    this._twCommit(items, changed);
};

RPETracker.prototype._twCommit = function(items, changed) {
    const tw = this._tw;
    const def = TestWizardLogic.defById(tw.testId);
    const res = TestWizardLogic.mergeResults(
        this.testSessions || [],
        changed.map(i => ({ playerId: i.playerId, entry: i.entry, bodyWeight: i.bodyWeight })),
        def.id, tw.date, new Date().toISOString(), () => TestWizardLogic.newId()
    );
    this.testSessions = res.sessions;
    this._saveTestSessions();
    TestWizardLogic.clearDraft(localStorage);
    clearTimeout(this._twDraftTimer);

    tw.summary = TestWizardLogic.buildSummary(def, this.testSessions, tw.date, items.map(i => i.playerId));
    tw.step = 3;
    this._twRender();
    const testName = def.name;
    this.showToast(`✅ ${testName}: ${changed.length} jugadora(s) guardada(s)`, 'success');
    if (this.currentView === 'tests') this.renderTestsView();
};

// ── Paso 3: resumen ───────────────────────────────────────────────────────────
RPETracker.prototype._twStep3Html = function() {
    const tw = this._tw;
    const def = TestWizardLogic.defById(tw.testId);
    const sm = tw.summary;
    const f = v => TestWizardLogic.fmt(v);

    const teamLine = sm.teamMean !== null ? `
        <div class="tw-team">
            <div>Media del equipo: <strong>${esc(f(sm.teamMean))} ${esc(def.unit)}</strong> ${this._twDeltaHtml(sm.teamPct, sm.teamImproved)}</div>
            ${sm.prevTeamDate ? `<div class="tw-hint" style="margin:0">frente a ${esc(f(sm.prevTeamMean))} ${esc(def.unit)} del ${esc(this._twShortDate(sm.prevTeamDate))}</div>` : ''}
        </div>` : '';

    const rows = sm.rows.map((r, i) => {
        const p = this.players.find(x => x.id === r.playerId);
        if (!p) return '';
        const value = def.bilateral
            ? `I ${esc(f(r.result.left))} · D ${esc(f(r.result.right))} ${esc(def.unit)}`
            : `${esc(f(r.main))} ${esc(def.unit)}`;
        return `
            <div class="tw-sum-row">
                <span class="tw-rank">${i + 1}</span>
                <span class="tw-row-avatar" style="background:${PlayerTokens.get(p)}">${esc(p.name.charAt(0).toUpperCase())}</span>
                <span class="tw-sum-name">${esc(this.playerDisplayName(p))}</span>
                <span class="tw-sum-value">${value}</span>
                ${r.asym !== null ? `<span style="color:${asymColor(r.asym)};font-weight:700;font-size:0.78rem">Δ ${esc(r.asym)}%</span>` : ''}
                ${this._twDeltaHtml(r.pct, r.improved)}
                ${r.isPB ? '<span class="tw-pb" title="Mejor marca personal">🏅</span>' : ''}
            </div>`;
    }).join('');

    return `
        <div class="modal-body tw-body">
            <div class="tw-test-title"><strong>${esc(def.name)}</strong> · ${esc(this._twShortDate(tw.date))}</div>
            ${teamLine}
            <div class="tw-sum-list">${rows || '<p class="str-empty">Sin datos</p>'}</div>
            <p class="tw-hint">▲▼ = cambio frente al test anterior de cada jugadora (verde = mejora, rojo = empeora) · 🏅 = mejor marca personal.</p>
        </div>
        <div class="tw-footer">
            <button type="button" class="btn-secondary" onclick="window.rpeTracker._twClose()">Cerrar</button>
            <button type="button" class="btn-secondary" onclick="window.rpeTracker._twShowTeamView()">📈 Ver evolución del equipo</button>
            <button type="button" class="btn-primary" onclick="window.rpeTracker._twAnother()">➕ Registrar otro test</button>
        </div>`;
};

/** Cierra el asistente y abre la vista "Por test" con este test y este día */
RPETracker.prototype._twShowTeamView = function() {
    const tw = this._tw;
    this._tt = { testId: tw.testId, date: tw.date, players: new Set() };
    this._testSub = 'byTest';
    this._twClose();
    if (this.currentView === 'tests') this.renderTestsView();
};

/** Vuelve al paso 1 conservando día y jugadoras, para registrar otro test del mismo día */
RPETracker.prototype._twAnother = function() {
    const tw = this._tw;
    tw.step = 1;
    tw.testId = null;
    tw.vals = {};
    tw.weights = {};
    tw.prefill = {};
    tw.summary = null;
    this._twRender();
};

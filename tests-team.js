// ============================================================
//  tests-team.js — Tests de rendimiento · vista "Por test"
//  Rendimiento → Tests → pestaña "📈 Por test"
//
//  Elegir un test y ver el equipo entero:
//    • Media del equipo (y su cambio frente al test anterior), mejor marca y nº de jugadoras
//    • Ranking del día elegido, con barra, variación por jugadora, 🏅 y asimetría
//    • Evolución de la media del equipo, con las jugadoras que quieras superpuestas
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

    /** Largo de la barra (0–100): la mejor marca del día llena la barra entera */
    barPct(def, value, values) {
        if (!values.length || value === null || value <= 0) return 0;
        const pct = def.lowerIsBetter ? (Math.min(...values) / value) * 100 : (value / Math.max(...values)) * 100;
        return Math.max(4, Math.min(100, Math.round(pct)));
    }
};
window.TestTeamLogic = TestTeamLogic;

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

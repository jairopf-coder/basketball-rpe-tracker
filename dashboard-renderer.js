// BasketballRPE-Web — dashboard-renderer.js
// Extracted from app.js (V21 refactor)
// Expone métodos renderDashboard y helpers asociados como RPETracker.prototype.*
// Depende de: ewma-calculator.js (readinessLabel, calculateAcuteChronicRatio, getPlayerThresholds)
//             security.js (ACCache, calcTeamFatigueIndex)
//             Skeleton (ui-helpers.js)

'use strict';

// ── renderDashboard ──────────────────────────────────────────────────
RPETracker.prototype.renderDashboard = function() {
    const container = document.getElementById('dashboardContent');
    if (!container) return;

    // Ocultar botón "Cargar histórico" si ya se cargó todo
    const histBtn = document.getElementById('loadFullHistoryBtn');
    if (histBtn) histBtn.style.display = this._fullHistoryLoaded ? 'none' : '';

    // Show skeleton while computing (clears automatically when we set innerHTML)
    if (container.children.length === 0 || container.querySelector('.skeleton-card')) {
        if (typeof Skeleton !== 'undefined') Skeleton.show(container, 4, '72px');
    }

    // Stats
    const totalSessions = this.countUniqueSessions(this.sessions);
    const trainingCount = this.countUniqueSessions(this.sessions.filter(s => s.type === 'training'));
    const matchCount    = this.countUniqueSessions(this.sessions.filter(s => s.type === 'match'));
    const avgRPE = this.sessions.length > 0
        ? (this.sessions.reduce((sum, s) => sum + s.rpe, 0) / this.sessions.length).toFixed(1) : '—';
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recent7 = this.sessions.filter(s => new Date(s.date) >= sevenDaysAgo);
    const recentUnique = this.countUniqueSessions(recent7);
    const avgRPE7 = recent7.length > 0
        ? (recent7.reduce((s, x) => s + x.rpe, 0) / recent7.length).toFixed(1) : '—';

    // Active injuries
    const activeInjuries = (this.injuries || []).filter(i => i.status === 'active').length;

    // Wellness data — hoy
    const _wToday = new Date().toISOString().slice(0, 10);
    const _wData  = this.wellnessData || [];
    const _pendingW = this.players.filter(p => !_wData.some(e => e.playerId === p.id && e.date === _wToday));

    // Chips de wellness expandidas con color por estado
    const wellnessChipsExpanded = this.players.length === 0 ? '' : (() => {
        const chipColor = (p) => {
            const todayEntry = _wData.find(e => e.playerId === p.id && e.date === _wToday);
            if (!todayEntry) return { bg: 'var(--bg-subtle)', border: 'var(--border)', dot: '#bbb', label: '—' };
            const overall = (todayEntry.sleep + (6 - todayEntry.fatigue) + todayEntry.mood + (6 - todayEntry.soreness)) / 4;
            if (overall >= 4)   return { bg: '#e8f5e9', border: '#a5d6a7', dot: '#4caf50', label: overall.toFixed(1) };
            if (overall >= 2.5) return { bg: '#fff8e1', border: '#ffe082', dot: '#ff9800', label: overall.toFixed(1) };
            return { bg: '#ffebee', border: '#ef9a9a', dot: '#f44336', label: overall.toFixed(1) };
        };
        return this.players.map(p => {
            const c = chipColor(p);
            return `<div class="db-w-chip-full" style="background:${c.bg};border-color:${c.border}" onclick="window.rpeTracker?.switchView('wellness')" title="${esc(p.name)}">
                ${PlayerTokens.avatar(p, 18, '0.55rem')}
                <span class="db-w-chip-name">${esc(p.name.split(' ')[0])}</span>
                <span class="db-w-chip-val" style="color:${c.dot}">${c.label}</span>
            </div>`;
        }).join('');
    })();

    // Mini resumen wellness equipo para columna Ratio
    const wellnessMiniSummary = (() => {
        if (!this.players.length) return '';
        const todayEntries = _wData.filter(e => e.date === _wToday);
        if (!todayEntries.length) return '';
        const avg = (field) => {
            const vals = todayEntries.map(e => e[field]).filter(v => v != null);
            return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : '—';
        };
        const sleep = avg('sleep'), fatigue = avg('fatigue'), mood = avg('mood'), soreness = avg('soreness');
        const dot = (val, invert = false) => {
            const n = parseFloat(val);
            if (isNaN(n)) return '#ccc';
            const good = invert ? n <= 2.5 : n >= 3.5;
            const bad  = invert ? n >= 3.5 : n <= 2.5;
            return good ? '#4caf50' : bad ? '#f44336' : '#ff9800';
        };
        const covered = todayEntries.length;
        const total   = this.players.length;
        return `<div class="db-wsum">
            <div class="db-wsum-header">
                <span class="db-wsum-label">Wellness hoy</span>
                <span class="db-wsum-coverage">${covered}/${total}</span>
            </div>
            <div class="db-wsum-row"><span class="db-wsum-metric">😴 Sueño</span><span class="db-wsum-val" style="color:${dot(sleep)}">${sleep}</span></div>
            <div class="db-wsum-row"><span class="db-wsum-metric">⚡ Fatiga</span><span class="db-wsum-val" style="color:${dot(fatigue,true)}">${fatigue}</span></div>
            <div class="db-wsum-row"><span class="db-wsum-metric">😊 Humor</span><span class="db-wsum-val" style="color:${dot(mood)}">${mood}</span></div>
            <div class="db-wsum-row"><span class="db-wsum-metric">💪 Agujetas</span><span class="db-wsum-val" style="color:${dot(soreness,true)}">${soreness}</span></div>
        </div>`;
    })();

    // Sort order — persisted on instance
    if (!this._dashSort) this._dashSort = 'risk'; // 'risk' | 'safe' | 'name'

    // Build player data
    const getStatus = (r, playerId) => {
        const n = parseFloat(r);
        if (isNaN(n) || r === 'N/A') return { icon: '—', color: '#ccc', risk: -1 };
        const _tS = this.getPlayerThresholds(playerId || null);
        if (n > _tS.high) return { icon: '🔴', color: '#f44336', risk: 4 };
        if (n > _tS.opt)  return { icon: '🟠', color: '#ff9800', risk: 3 };
        if (n < _tS.low)  return { icon: '🔵', color: '#2196f3', risk: 1 };
        return           { icon: '🟢', color: '#4caf50', risk: 2 };
    };

    let players = this.players.map(player => {
        const ratio = this.calculateAcuteChronicRatio(player.id);
        const st = getStatus(ratio.ratio, player.id);
        return { player, ratio, st, r: parseFloat(ratio.ratio) || 0 };
    });

    if (this._dashSort === 'risk')  players.sort((a, b) => b.st.risk - a.st.risk || b.r - a.r);
    if (this._dashSort === 'safe')  players.sort((a, b) => a.st.risk - b.st.risk || a.r - b.r);
    if (this._dashSort === 'name')  players.sort((a, b) => a.player.name.localeCompare(b.player.name));

    const sortLabel = { risk: '↓ Mayor riesgo', safe: '↑ Menor riesgo', name: 'A–Z' };
    const nextSort  = { risk: 'safe', safe: 'name', name: 'risk' };

    const playerRows = players.map(({ player, ratio, st, r }) => {
        const barW = Math.min(r / 2 * 100, 100).toFixed(0);
        // Wellness de hoy para esta jugadora
        const wEntry = _wData.find(e => e.playerId === player.id && e.date === _wToday);
        let wScore = '—', wColor = 'var(--text-faint)', wBg = 'var(--bg-subtle)';
        if (wEntry) {
            const overall = (wEntry.sleep + (6 - wEntry.fatigue) + wEntry.mood + (6 - wEntry.soreness)) / 4;
            wScore = overall.toFixed(1);
            if (overall >= 4)        { wColor = '#2e7d32'; wBg = '#e8f5e9'; }
            else if (overall >= 2.5) { wColor = '#e65100'; wBg = '#fff3e0'; }
            else                     { wColor = '#c62828'; wBg = '#ffebee'; }
        }
        // Readiness Score
        const rdyScore = this.calculateReadiness(player.id);
        const rdyLbl   = this.readinessLabel(rdyScore);
        const rdyTxt   = rdyScore !== null ? rdyScore : '—';

        return `
            <div class="db-player-row">
                ${PlayerTokens.avatar(player, 20, '0.6rem')}
                <div class="db-player-name">${esc(player.name)}${player.number ? `<span class="db-num">#${esc(player.number)}</span>` : ''}</div>
                <div class="db-player-bar">
                    <div class="db-bar-fill" style="width:${barW}%;background:${st.color}"></div>
                    <div class="db-bar-lo"></div>
                    <div class="db-bar-hi"></div>
                </div>
                <div class="db-player-ratio" style="color:${st.color}">${ratio.confidence === 'low' ? '<span class="badge-insuf" title="' + (ratio.message||'Datos insuficientes') + '">⚠️ Insuf.</span>' : ratio.ratio === 'N/A' ? '—' : ratio.ratio}</div>
                <div class="db-player-icon">${st.icon}</div>
                <div class="db-player-wellness" style="color:${wColor};background:${wBg}">${wScore}</div>
                <div class="db-player-readiness ${rdyLbl.cls}" title="Readiness: ${rdyTxt}/100" style="color:${rdyLbl.color};background:${rdyLbl.bg}">${rdyLbl.icon} ${rdyTxt}</div>
            </div>`;
    }).join('');

    // Availability groups (same logic as renderTeamStatus)
    const availGroups = { ok: [], caution: [], out: [] };
    this.players.forEach(player => {
        const ratio = this.calculateAcuteChronicRatio(player.id);
        const r = parseFloat(ratio.ratio);
        const activeInjury = (this.injuries || []).find(i => i.playerId === player.id && i.status === 'active');
        const playerSessions = this.sessions.filter(s => s.playerId === player.id);
        const last7 = playerSessions.filter(s => (new Date() - new Date(s.date)) / 86400000 <= 7);
        const avgRPE7 = last7.length ? (last7.reduce((s, x) => s + x.rpe, 0) / last7.length).toFixed(1) : null;
        const entry = { player, ratio, r, activeInjury, avgRPE7 };
        const _tAv = this.getPlayerThresholds(player.id);
        if (activeInjury)                                       availGroups.out.push(entry);
        else if (r > _tAv.high || (r > 0 && r < _tAv.low))    availGroups.caution.push(entry);
        else                                                     availGroups.ok.push(entry);
    });

    const availRow = ({ player, activeInjury, avgRPE7, r, ratio }) => {
        let icon, color, detail;
        const _tAR = this.getPlayerThresholds(player.id);
        if (activeInjury) {
            icon = '🔴'; color = '#f44336';
            detail = activeInjury.location ? this.getLocationName(activeInjury.location) : 'lesión activa';
        } else if (r > _tAR.high) {
            icon = '🟠'; color = '#ff9800'; detail = `Ratio ${ratio.ratio}`;
        } else if (r > 0 && r < _tAR.low) {
            icon = '🔵'; color = '#2196f3'; detail = `Ratio ${ratio.ratio}`;
        } else {
            icon = '🟢'; color = '#4caf50'; detail = avgRPE7 ? `RPE 7d: ${avgRPE7}` : 'Sin datos';
        }
        return `
            <div class="db-avail-row">
                <span class="db-avail-icon">${icon}</span>
                ${PlayerTokens.avatar(player, 22, '0.65rem')}
                <span class="db-avail-name">${esc(player.name)}${player.number ? `<span class="db-num">#${esc(player.number)}</span>` : ''}</span>
                <span class="db-avail-detail" style="color:${color}">${detail}</span>
            </div>`;
    };

    const availSection = (title, entries, emptyMsg) =>
        entries.length === 0 ? '' : `
            <div class="db-avail-section">
                <div class="db-avail-section-title">${title} <span class="db-avail-count">${entries.length}</span></div>
                ${entries.map(availRow).join('')}
            </div>`;

    // ── Alert banner data ──────────────────────────────────────
    const alertPlayers = players.filter(p => { if (p.ratio.confidence === 'low') return false; const _t=this.getPlayerThresholds(p.player.id); return parseFloat(p.ratio.ratio) > _t.high; });
    const warnPlayers  = players.filter(p => { if (p.ratio.confidence === 'low') return false; const _t=this.getPlayerThresholds(p.player.id); const r=parseFloat(p.ratio.ratio); return r >= _t.opt && r <= _t.high; });
    const pendingWellness = _pendingW.length;

    // ── C) Team-level A:C alert (3+ players simultaneously over individual threshold) ──
    const TEAM_ALERT_THRESHOLD = 3;
    let bannerHTML = '';
    if (alertPlayers.length >= TEAM_ALERT_THRESHOLD) {
        const combinedAtRisk = alertPlayers.length + warnPlayers.length;
        const teamMsg = alertPlayers.length >= TEAM_ALERT_THRESHOLD
            ? `⚠️ <strong>${alertPlayers.length} jugadoras en zona de riesgo A:C simultáneamente</strong> — revisar carga de equipo hoy`
            : '';
        const teamSecondary = combinedAtRisk >= TEAM_ALERT_THRESHOLD + 1 && warnPlayers.length > 0
            ? `<div class="db-alert-sep">·</div><div class="db-alert-item">🟠 <strong>${warnPlayers.length} más</strong> en precaución</div>`
            : '';
        bannerHTML = `<div class="db-alert-banner db-alert-banner--team">
            <div class="db-alert-item">${teamMsg}</div>${teamSecondary}
            <button class="db-alert-btn-team" onclick="window.rpeTracker?.openPreSessionModal()">Ver detalle →</button>
        </div>`;
    }

    if (alertPlayers.length > 0 || warnPlayers.length > 0) {
        const items = [];
        if (alertPlayers.length) items.push(`🔴 <strong>${alertPlayers.map(p=>esc(p.player.name.split(' ')[0])).join(', ')}</strong> ratio en zona de peligro`);
        if (warnPlayers.length)  items.push(`🟠 <strong>${warnPlayers.map(p=>esc(p.player.name.split(' ')[0])).join(', ')}</strong> en precaución`);
        bannerHTML += `<div class="db-alert-banner">
            ${items.map(i=>`<div class="db-alert-item">${i}</div>`).join('<div class="db-alert-sep">·</div>')}
        </div>`;
    }

    // Wellness trend alerts in dashboard banner
    const trendAlerts = typeof this._wTrendAlerts === 'function' ? this._wTrendAlerts() : [];
    if (trendAlerts.length > 0) {
        const trendItems = trendAlerts.map(a =>
            `🔁 <strong>${a.name.split(' ')[0]}</strong> — ${a.message}`
        );
        bannerHTML += `<div class="db-alert-banner db-alert-banner--trend">
            ${trendItems.map(i=>`<div class="db-alert-item">${i}</div>`).join('<div class="db-alert-sep">·</div>')}
        </div>`;
    }

    // ── Match-day mode ─────────────────────────────────────────
    const todayKey = ['dom','lun','mar','mie','jue','vie','sab'][new Date().getDay()];
    const todayPlan = this.weekPlan?.days?.[todayKey] || {};
    const isMatchDay = ['morning','afternoon'].some(s => todayPlan[s]?.type === 'match' && todayPlan[s]?.enabled);
    const matchDayBtnLabel = this._matchDayMode ? '← Vista normal' : '🏟️ Modo partido';

    // ---- Team Readiness Widget ----
    const rdyPlayerData = this.players.map(player => ({
        player,
        score: this.calculateReadiness(player.id)
    })).sort((a, b) => (b.score ?? -1) - (a.score ?? -1));

    const withData = rdyPlayerData.filter(d => d.score !== null);
    const teamAvg  = withData.length
        ? Math.round(withData.reduce((s, d) => s + d.score, 0) / withData.length)
        : null;
    const teamLbl  = this.readinessLabel(teamAvg);

    const rdyRows = rdyPlayerData.map(({ player, score }) => {
        const lbl = this.readinessLabel(score);
        const txt = score !== null ? score : '—';
        return `<div class="rdy-row">
            ${PlayerTokens.avatar(player, 18, '0.55rem')}
            <span class="rdy-name">${player.name}</span>
            <div class="rdy-bar-wrap"><div class="rdy-bar-fill ${lbl.cls}" style="width:${score !== null ? score : 0}%"></div></div>
            <span class="rdy-val" style="color:${lbl.color}">${lbl.icon} ${txt}</span>
        </div>`;
    }).join('');

    const teamReadinessWidget = withData.length === 0 ? '' : `
        <div class="db-readiness-widget">
            <div class="db-readiness-header">
                <span class="db-readiness-title">⚡ Readiness del Equipo</span>
                <span class="db-readiness-avg ${teamLbl.cls}" style="color:${teamLbl.color};background:${teamLbl.bg}">
                    ${teamLbl.icon} ${teamAvg !== null ? teamAvg + '/100' : '—'}
                </span>
            </div>
            <div class="rdy-rows">${rdyRows}</div>
        </div>`;
    // ---- End Team Readiness Widget ----

    // ── "Hoy" panel ────────────────────────────────────────────
    const todaySessions = this.sessions.filter(s => s.date && s.date.slice(0, 10) === _wToday);
    const todayPlayerIds = [...new Set(todaySessions.map(s => s.playerId))];
    const todaySessionCount = todayPlayerIds.length;

    const acAlertCount  = players.filter(p => {
        const t = this.getPlayerThresholds(p.player.id);
        return parseFloat(p.ratio.ratio) > t.high;
    }).length;
    const activeInjCount = (this.injuries || []).filter(i => i.status === 'active').length;
    const pendingCount   = _pendingW.length;

    // Pending wellness names for WhatsApp message
    const pendingNames = _pendingW.map(p => esc(p.name.split(' ')[0])).join(', ');

    const todayPanelHTML = `
        <div class="db-today-panel">
            <div class="db-today-header">
                <span class="db-today-title">Hoy — ${new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}</span>
            </div>
            <div class="db-today-kpis">
                <div class="db-today-kpi" onclick="window.rpeTracker?.switchView('sessions')" title="Ver sesiones de hoy">
                    <span class="db-today-kpi-val">${todaySessionCount}</span>
                    <span class="db-today-kpi-lbl">sesiones hoy</span>
                </div>
                <div class="db-today-kpi db-today-kpi--${pendingCount === 0 ? 'ok' : 'warn'}" onclick="window.rpeTracker?.switchView('wellness')" title="Wellness pendiente">
                    <span class="db-today-kpi-val">${pendingCount}</span>
                    <span class="db-today-kpi-lbl">sin wellness</span>
                </div>
                <div class="db-today-kpi db-today-kpi--${acAlertCount > 0 ? 'danger' : 'ok'}" onclick="window.rpeTracker?.switchView('analytics')" title="Alertas A:C">
                    <span class="db-today-kpi-val">${acAlertCount}</span>
                    <span class="db-today-kpi-lbl">alertas A:C</span>
                </div>
                <div class="db-today-kpi db-today-kpi--${activeInjCount > 0 ? 'danger' : 'ok'}" onclick="window.rpeTracker?.switchView('injury')" title="Lesiones activas">
                    <span class="db-today-kpi-val">${activeInjCount}</span>
                    <span class="db-today-kpi-lbl">lesionadas</span>
                </div>
            </div>
            ${pendingCount > 0 ? `
            <div class="db-today-pending">
                <span class="db-today-pending-label">Sin wellness hoy:</span>
                <span class="db-today-pending-names">${pendingNames}</span>
                <button class="db-today-wa-btn" onclick="window.rpeTracker?.copyWellnessPendingWA()" title="Copiar mensaje para WhatsApp">
                    📋 Copiar aviso
                </button>
            </div>` : `
            <div class="db-today-pending db-today-pending--ok">
                <span class="db-today-pending-label">✅ Todas han rellenado el wellness hoy</span>
            </div>`}
        </div>`;

    // ---- Team Fatigue Index Widget ----
    const _tfResult = (typeof calcTeamFatigueIndex === 'function' && this.players.length > 0)
        ? calcTeamFatigueIndex(this.players, (pid) => this.calculateAcuteChronicRatio(pid), this.wellnessData || [])
        : null;
    const teamFatigueWidget = _tfResult ? `
        <div class="db-fatigue-widget">
            <div class="db-fatigue-header">
                <span class="db-fatigue-title">🔥 Fatiga del Equipo</span>
                <span class="db-fatigue-badge" style="color:${_tfResult.color};background:${_tfResult.color}18;border:1px solid ${_tfResult.color}44;padding:2px 8px;border-radius:12px;font-size:11px;font-weight:500">${_tfResult.label}</span>
            </div>
            <div class="db-fatigue-bar-wrap" style="background:var(--color-background-secondary);border-radius:6px;height:8px;margin:8px 0;overflow:hidden">
                <div style="width:${_tfResult.index}%;height:100%;background:${_tfResult.color};border-radius:6px;transition:width 0.6s ease"></div>
            </div>
            <div style="display:flex;justify-content:space-between;font-size:11px;color:var(--color-text-secondary)">
                <span>Descansado</span><span style="font-weight:500;color:${_tfResult.color}">${_tfResult.index}/100</span><span>Fatiga alta</span>
            </div>
        </div>` : '';
    // ---- End Team Fatigue Index Widget ----

    container.innerHTML = `
        ${bannerHTML}
        ${isMatchDay || this._matchDayMode ? `
        <div class="db-matchday-bar">
            <span class="db-matchday-badge">🏟️ DÍA DE PARTIDO</span>
            <button class="db-matchday-toggle" onclick="window.rpeTracker?._toggleMatchDayMode()">${matchDayBtnLabel}</button>
        </div>` : ''}
        ${this._matchDayMode ? this._renderMatchDayView(availGroups, players) : `

        <!-- KPI bar: siempre visible arriba -->
        <div class="db-kpi-bar">
            <div class="db-kpi db-kpi--${todaySessionCount > 0 ? 'ok' : 'neutral'}" onclick="window.rpeTracker?.switchView('sessions')" title="Ver sesiones de hoy">
                <span class="db-kpi-val">${todaySessionCount}</span>
                <span class="db-kpi-lbl">sesiones hoy</span>
            </div>
            <div class="db-kpi db-kpi--${avgRPE7 !== '—' && parseFloat(avgRPE7) > 7 ? 'warn' : avgRPE7 !== '—' && parseFloat(avgRPE7) < 4 ? 'low' : 'neutral'}">
                <span class="db-kpi-val">${avgRPE7}</span>
                <span class="db-kpi-lbl">RPE medio 7d</span>
            </div>
            <div class="db-kpi db-kpi--${acAlertCount > 0 ? 'danger' : 'ok'}" onclick="window.rpeTracker?.switchView('analytics')" title="Ver analítica">
                <span class="db-kpi-val">${acAlertCount}</span>
                <span class="db-kpi-lbl">alertas A:C</span>
            </div>
            <div class="db-kpi db-kpi--${availGroups.out.length > 0 ? 'warn' : 'ok'}" onclick="window.rpeTracker?.switchView('injury')" title="Ver lesiones">
                <span class="db-kpi-val">${availGroups.ok.length}/${this.players.length}</span>
                <span class="db-kpi-lbl">aptas hoy</span>
            </div>
            ${pendingCount > 0 ? `
            <div class="db-kpi db-kpi--warn db-kpi--pending" onclick="window.rpeTracker?.openWellnessBulk()" title="Wellness pendiente">
                <span class="db-kpi-val">${pendingCount}</span>
                <span class="db-kpi-lbl">sin wellness</span>
            </div>` : ''}
        </div>

        <div class="db-split">

            <!-- Columna izquierda: métricas de carga -->
            <div class="db-left">
                <div class="db-left-section">
                    <div class="db-left-label">Carga equipo 7d</div>
                    <canvas id="teamSparklineCanvas" class="db-team-sparkline" width="200" height="70"></canvas>
                </div>
                <div class="db-left-section">
                    <div class="db-left-label">Esta semana</div>
                    <div class="db-metric-row">
                        <span class="db-metric-lbl">Sesiones</span>
                        <span class="db-metric-val">${recentUnique}</span>
                    </div>
                    <div class="db-metric-row">
                        <span class="db-metric-lbl">RPE medio</span>
                        <span class="db-metric-val" style="color:#ff9800">${avgRPE7}</span>
                    </div>
                    <div class="db-metric-row">
                        <span class="db-metric-lbl">Entrenamientos</span>
                        <span class="db-metric-val">${trainingCount}</span>
                    </div>
                    <div class="db-metric-row">
                        <span class="db-metric-lbl">Partidos</span>
                        <span class="db-metric-val">${matchCount}</span>
                    </div>
                </div>
                <div class="db-left-section">
                    <div class="db-left-label">Temporada</div>
                    <div class="db-metric-row">
                        <span class="db-metric-lbl">Total sesiones</span>
                        <span class="db-metric-val">${totalSessions}</span>
                    </div>
                    <div class="db-metric-row">
                        <span class="db-metric-lbl">RPE medio global</span>
                        <span class="db-metric-val">${avgRPE}</span>
                    </div>
                    <div class="db-metric-row">
                        <span class="db-metric-lbl">Jugadoras</span>
                        <span class="db-metric-val">${this.players.length}</span>
                    </div>
                    ${activeInjuries > 0 ? `
                    <div class="db-metric-row">
                        <span class="db-metric-lbl">Lesionadas</span>
                        <span class="db-metric-val" style="color:#f44336">${activeInjuries}</span>
                    </div>` : ''}
                </div>
            </div>

            <!-- Columna central: ratio A:C + comparativa -->
            <div class="db-right">
                <div class="db-right-sticky">
                <div class="db-right-header">
                    <div class="db-right-header-left">
                        <span class="db-right-title">Ratio A:C — jugadoras</span>
                        <div class="db-avail-pills-inline">
                            <span class="db-avail-pill db-avail-ok">${availGroups.ok.length} <span>aptas</span></span>
                            <span class="db-avail-pill db-avail-caution">${availGroups.caution.length} <span>precaución</span></span>
                            <span class="db-avail-pill db-avail-out">${availGroups.out.length} <span>no disp.</span></span>
                        </div>
                    </div>
                    <div class="db-right-header-btns">
                        <button class="db-sort-btn" onclick="window.rpeTracker?.cycleDashSort()">
                            ${sortLabel[this._dashSort]}
                        </button>
                        <button class="db-sort-btn db-sort-btn--icon" onclick="window.rpeTracker?.generateTeamStatusPDF()" title="Informe PDF">
                            📄
                        </button>
                    </div>
                </div>
                <div class="db-right-legend">
                    <span style="color:#4caf50">● óptimo</span>
                    <span style="color:#ff9800">● precaución</span>
                    <span style="color:#f44336">● peligro</span>
                    <span style="color:#2196f3">● bajo</span>
                    <span style="margin-left:auto;font-size:0.65rem;color:var(--text-faint)">😴⚡😊💪 = wellness 7d</span>
                </div>
                </div><!-- /db-right-sticky -->
                <div class="db-players">
                    ${this.players.length > 0 ? playerRows : '<div class="db-empty">Sin jugadoras</div>'}
                </div>
                ${this._renderPlayerComparisonSection()}
            </div>

            <!-- Columna derecha: calendario + wellness + fatiga + pending -->
            <div class="db-cal" id="dbCalColumn">
                <!-- filled by renderDashboardCalendar() + _renderRightWidgets() -->
            </div>

        </div>
        `}
    `;

    // Draw team load 7d chart with day labels
    requestAnimationFrame(() => {
        const canvas = document.getElementById('teamSparklineCanvas');
        if (canvas) {
            if (canvas._chartInstance) { canvas._chartInstance.destroy(); canvas._chartInstance = null; }
            const now = new Date();
            const teamData = [];
            const dayLabels = [];
            const DAY_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
            for (let d = 6; d >= 0; d--) {
                const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - d); dayStart.setHours(0,0,0,0);
                const dayEnd   = new Date(dayStart); dayEnd.setHours(23,59,59,999);
                const dayLoad  = this.sessions
                    .filter(s => { const sd = new Date(s.date); return sd >= dayStart && sd <= dayEnd; })
                    .reduce((sum, s) => sum + (s.load || s.rpe * (s.duration || 60)), 0);
                teamData.push(dayLoad);
                const isToday = d === 0;
                dayLabels.push(isToday ? 'Hoy' : DAY_SHORT[dayStart.getDay()]);
            }
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const textCol = isDark ? '#888' : '#999';
            const gridCol = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
            canvas._chartInstance = new Chart(canvas.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: dayLabels,
                    datasets: [{
                        data: teamData,
                        backgroundColor: teamData.map((_, i) =>
                            i === 6 ? '#ff6600' : 'rgba(255,102,0,0.35)'),
                        borderRadius: 3,
                        borderSkipped: false,
                    }]
                },
                options: {
                    responsive: false,
                    animation: false,
                    plugins: { legend: { display: false }, tooltip: {
                        callbacks: { label: ctx => `Carga: ${ctx.raw}` }
                    }},
                    scales: {
                        x: { ticks: { color: textCol, font: { size: 9 } }, grid: { display: false } },
                        y: { display: false, beginAtZero: true }
                    }
                }
            });
        }
        // nav alert badge
        this._updateNavAlertBadge();
        // Render mini calendar column
        this.renderDashboardCalendar();
        this._renderRightWidgets();
        // Update wellness badge in global header
        const _hBadge = document.getElementById('headerWellnessBadge');
        if (_hBadge) {
            if (_pendingW.length > 0) { _hBadge.textContent = _pendingW.length; _hBadge.style.display = 'inline'; }
            else { _hBadge.style.display = 'none'; }
        }
        // Render comparativa de jugadoras (radar wellness)
        this._renderComparisonRadar();
        this._bindComparisonEvents();
    });
};

// ── _toggleMatchDayMode ──────────────────────────────────────────────
RPETracker.prototype._toggleMatchDayMode = function() {
    this._matchDayMode = !this._matchDayMode;
    this.renderDashboard();
};

// ── _renderMatchDayView ──────────────────────────────────────────────
RPETracker.prototype._renderMatchDayView = function(availGroups, players) {
    const today  = new Date().toISOString().slice(0, 10);
    const wData  = this.wellnessData || [];

    const playerCard = ({ player, ratio, icon, r }) => {
        const w      = wData.find(e => e.playerId === player.id && e.date === today);
        const wScore = w ? this._wOverall(w) : null;
        const wColor = wScore ? this._wColor(wScore) : '#aaa';
        const rColor = this.getRatioColor(ratio.ratio);
        const inj    = (this.injuries||[]).find(i => i.playerId === player.id && i.status === 'active');
        const _tMD = this.getPlayerThresholds(player?.id); return `<div class="md-card ${inj ? 'md-card--out' : r > _tMD.high ? 'md-card--danger' : r >= _tMD.opt ? 'md-card--warn' : ''}">
            <div class="md-card-top">
                ${PlayerTokens.avatar(player, 30, '0.75rem')}
                <div class="md-card-name">${esc(player.name)}${player.number ? `<span class="db-num"> #${esc(player.number)}</span>` : ''}</div>
                <span class="md-card-icon">${icon}</span>
            </div>
            <div class="md-card-row">
                <span class="md-lbl">Ratio</span>
                <span class="md-val" style="color:${rColor}">${ratio.confidence === 'low' ? '<span class="badge-insuf" title="' + (ratio.message||'Datos insuficientes') + '">⚠️ Insuf.</span>' : ratio.ratio === 'N/A' ? '—' : ratio.ratio}</span>
            </div>
            <div class="md-card-row">
                <span class="md-lbl">Wellness</span>
                <span class="md-val" style="color:${wColor}">${wScore !== null ? wScore.toFixed(1) : '—'}</span>
            </div>
            ${inj ? `<div class="md-card-inj">🚑 ${this.getLocationName?.(inj.location)||'Lesión activa'}</div>` : ''}
        </div>`;
    };

    const okCards  = availGroups.ok.map(e =>
        playerCard({ player: e.player, ratio: e.ratio, icon: '🟢', r: e.r })).join('');
    const warnCards = availGroups.caution.map(e =>
        playerCard({ player: e.player, ratio: e.ratio, icon: e.r > (this.getPlayerThresholds(e.player.id).high) ? '🔴' : '🔵', r: e.r })).join('');
    const outCards = availGroups.out.map(e =>
        playerCard({ player: e.player, ratio: e.ratio, icon: '🔴', r: e.r })).join('');

    const todayW = wData.filter(e => e.date === today);
    const avgW   = todayW.length
        ? (todayW.reduce((s,e) => s + this._wOverall(e), 0) / todayW.length).toFixed(1) : '—';
    const atRisk = players.filter(p => p.ratio.confidence !== 'low' && parseFloat(p.ratio.ratio) > this.getPlayerThresholds(p.player.id).high).length;

    return `<div class="md-wrap">
        <div class="md-summary">
            <div class="md-pill"><span class="md-pill-val">${availGroups.ok.length}</span><span class="md-pill-lbl">Disponibles</span></div>
            <div class="md-pill md-pill--warn"><span class="md-pill-val">${availGroups.caution.length}</span><span class="md-pill-lbl">Precaución</span></div>
            <div class="md-pill md-pill--out"><span class="md-pill-val">${availGroups.out.length}</span><span class="md-pill-lbl">No disp.</span></div>
            <div class="md-pill"><span class="md-pill-val">${avgW}</span><span class="md-pill-lbl">Wellness</span></div>
            <div class="md-pill ${atRisk > 0 ? 'md-pill--danger' : ''}"><span class="md-pill-val">${atRisk}</span><span class="md-pill-lbl">Riesgo alto</span></div>
        </div>
        ${warnCards || outCards ? `
            <div class="md-section">⚠️ Requieren atención</div>
            <div class="md-grid">${warnCards}${outCards}</div>` : ''}
        <div class="md-section">✅ Disponibles para el partido</div>
        <div class="md-grid">${okCards || '<p class="db-empty">Sin jugadoras disponibles</p>'}</div>
    </div>`;
};

// ── cycleDashSort ────────────────────────────────────────────────────
RPETracker.prototype.cycleDashSort = function() {
    const next = { risk: 'safe', safe: 'name', name: 'risk' };
    this._dashSort = next[this._dashSort] || 'risk';
    this.renderDashboard();
};

// ── copyWellnessPendingWA ────────────────────────────────────────────
RPETracker.prototype.copyWellnessPendingWA = function() {
    const today = new Date().toISOString().slice(0, 10);
    const wData = this.wellnessData || [];
    const pending = this.players.filter(p => !wData.some(e => e.playerId === p.id && e.date === today));
    if (!pending.length) { this.showToast('✅ Todas han rellenado el wellness hoy', 'info'); return; }
    const names = pending.map(p => esc(p.name.split(' ')[0])).join(', ');
    const dateLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const msg = `🏀 Recordatorio wellness — ${dateLabel}\n\nPor favor, rellenad el cuestionario de bienestar de hoy en la app.\n\nPendientes: ${names}\n\n¡Gracias! 💪`;
    if (navigator.clipboard) {
        navigator.clipboard.writeText(msg).then(() => {
            this.showToast('📋 Mensaje copiado — pégalo en WhatsApp', 'success');
        }).catch(() => this._fallbackCopy(msg));
    } else {
        this._fallbackCopy(msg);
    }
};

// ── _fallbackCopy ────────────────────────────────────────────────────
RPETracker.prototype._fallbackCopy = function(text) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    try { document.execCommand('copy'); this.showToast('📋 Mensaje copiado — pégalo en WhatsApp', 'success'); }
    catch (e) { this.showToast('No se pudo copiar. Copia manualmente.', 'error'); }
    document.body.removeChild(ta);
};

// ── _renderRightWidgets — wellness + fatiga + pending en columna derecha ──
RPETracker.prototype._renderRightWidgets = function() {
    const col = document.getElementById('dbCalColumn');
    if (!col) return;

    const _wToday = new Date().toISOString().slice(0, 10);
    const _wData  = this.wellnessData || [];
    const _pendingW = this.players.filter(p => !_wData.some(e => e.playerId === p.id && e.date === _wToday));

    // Wellness summary
    const wsum = (() => {
        const todayEntries = _wData.filter(e => e.date === _wToday);
        if (!todayEntries.length) return '';
        const avg = (field) => {
            const vals = todayEntries.map(e => e[field]).filter(v => v != null);
            return vals.length ? (vals.reduce((s, v) => s + v, 0) / vals.length).toFixed(1) : '—';
        };
        const sleep = avg('sleep'), fatigue = avg('fatigue'), mood = avg('mood'), soreness = avg('soreness');
        const col = (val, invert=false) => {
            const n = parseFloat(val);
            if (isNaN(n)) return 'var(--text-faint)';
            const good = invert ? n <= 2.5 : n >= 3.5;
            const bad  = invert ? n >= 3.5 : n <= 2.5;
            return good ? '#4caf50' : bad ? '#f44336' : '#ff9800';
        };
        const pct = (val) => Math.round((parseFloat(val)||0) / 5 * 100);
        return `<div class="db-rw-section">
            <div class="db-rw-label">Wellness hoy
                <span class="db-rw-coverage">${todayEntries.length}/${this.players.length}</span>
            </div>
            <div class="db-rw-bars">
                ${[['😴 Sueño', sleep, false],['⚡ Energía', fatigue, true],['😊 Humor', mood, false],['💪 Agujetas', soreness, true]]
                    .map(([lbl, val, inv]) => `
                <div class="db-rw-bar-row">
                    <span class="db-rw-bar-lbl">${lbl}</span>
                    <div class="db-rw-bar-track"><div class="db-rw-bar-fill" style="width:${pct(val)}%;background:${col(val,inv)}"></div></div>
                    <span class="db-rw-bar-num" style="color:${col(val,inv)}">${val}</span>
                </div>`).join('')}
            </div>
        </div>`;
    })();

    // Fatigue index
    const _tfResult = (typeof calcTeamFatigueIndex === 'function' && this.players.length > 0)
        ? calcTeamFatigueIndex(this.players, (pid) => this.calculateAcuteChronicRatio(pid), _wData)
        : null;
    const fatigueHTML = _tfResult ? `<div class="db-rw-section">
        <div class="db-rw-label">Fatiga del equipo</div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:0.75rem;color:var(--text-secondary)">${_tfResult.label}</span>
            <span style="font-size:0.82rem;font-weight:600;color:${_tfResult.color}">${_tfResult.index}/100</span>
        </div>
        <div style="height:6px;background:var(--bg-subtle);border-radius:3px;overflow:hidden">
            <div style="width:${_tfResult.index}%;height:100%;background:${_tfResult.color};border-radius:3px"></div>
        </div>
        <div style="display:flex;justify-content:space-between;font-size:0.65rem;color:var(--text-faint);margin-top:3px">
            <span>Descansado</span><span>Fatiga alta</span>
        </div>
    </div>` : '';

    // Pending wellness info (action buttons live in the global header now)
    const pendingHTML = _pendingW.length > 0 ? `<div class="db-rw-section">
        <div class="db-rw-label">Sin wellness hoy</div>
        <div class="db-rw-pending">
            <span class="db-rw-pending-names">${_pendingW.map(p => esc(p.name.split(' ')[0])).join(', ')}</span>
        </div>
    </div>` : `<div class="db-rw-section"><div class="db-rw-pending db-rw-pending--ok">✅ Todas al día</div></div>`;

    // Inject after calendar content
    const existing = col.querySelector('.db-rw-widgets');
    if (existing) existing.remove();
    const wrap = document.createElement('div');
    wrap.className = 'db-rw-widgets';
    wrap.innerHTML = wsum + fatigueHTML + pendingHTML;
    col.appendChild(wrap);
};

// ── renderDashboardCalendar ──────────────────────────────────────────
RPETracker.prototype.renderDashboardCalendar = function() {
    const col = document.getElementById('dbCalColumn');
    if (!col) return;

    // Init state
    if (!this._dbCal) {
        const now = new Date();
        this._dbCal = { mode: 'month', year: now.getFullYear(), month: now.getMonth(), weekOffset: 0 };
    }

    const { mode, year, month, weekOffset } = this._dbCal;

    // Color map by session type
    const typeColor = {
        training: '#2196f3',
        match:    '#f44336',
        recovery: '#4caf50',
        shooting: '#9c27b0',
        gym:      '#795548',
        rest:     '#bdbdbd'
    };
    const typeIcon = {
        training: '🏀',
        match:    '🏟️',
        recovery: '💪',
        shooting: '🎯',
        gym:      '🏋️',
        rest:     '—'
    };
    const typeLabel = {
        training: 'Entreno',
        match:    'Partido',
        recovery: 'Recuperación',
        shooting: 'Tiro',
        gym:      'Gym',
        rest:     'Descanso'
    };

    // Build a map: dateStr → [{type, source:'real'|'plan'}]
    const eventMap = {};

    const addEvent = (dateStr, type, source) => {
        if (!eventMap[dateStr]) eventMap[dateStr] = [];
        eventMap[dateStr].push({ type, source });
    };

    // Real sessions (unique dates with dominant type)
    this.sessions.forEach(s => {
        if (s.date) addEvent(s.date, s.type || 'training', 'real');
    });

    // WeekPlan events — expand the current plan across ±8 weeks from today
    if (this.weekPlan && this.weekPlan.days) {
        const dayKeys   = ['lun','mar','mie','jue','vie','sab','dom'];
        // JS getDay(): 0=Sun,1=Mon... we want Mon=0
        const now = new Date();
        const todayDow = (now.getDay() + 6) % 7; // 0=Mon
        // Find Monday of this week
        const monday = new Date(now);
        monday.setDate(now.getDate() - todayDow);
        monday.setHours(0,0,0,0);

        for (let wOff = -4; wOff <= 8; wOff++) {
            dayKeys.forEach((key, idx) => {
                const dayData = this.weekPlan.days[key];
                if (!dayData) return;
                const d = new Date(monday);
                d.setDate(monday.getDate() + wOff * 7 + idx);
                const dateStr = d.toISOString().slice(0, 10);
                // Only add planned events if no real sessions exist for that date
                ['morning','afternoon'].forEach(slot => {
                    const s = dayData[slot];
                    if (s && s.enabled && s.type && s.type !== 'rest') {
                        addEvent(dateStr, s.type, 'plan');
                    }
                });
            });
        }
    }

    // Nav label
    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                        'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

    let navLabel = '';
    if (mode === 'month') {
        navLabel = `${monthNames[month]} ${year}`;
    } else {
        // Weekly: find Mon of offset week
        const now2 = new Date();
        const todayDow2 = (now2.getDay() + 6) % 7;
        const mon = new Date(now2);
        mon.setDate(now2.getDate() - todayDow2 + weekOffset * 7);
        const sun = new Date(mon);
        sun.setDate(mon.getDate() + 6);
        navLabel = `${mon.getDate()} – ${sun.getDate()} ${monthNames[sun.getMonth()]}`;
    }

    // Build content
    let bodyHTML = '';

    if (mode === 'month') {
        const firstDay = new Date(year, month, 1);
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        // start on Monday: JS getDay 0=Sun → convert to Mon-based
        let startDow = (firstDay.getDay() + 6) % 7; // 0=Mon
        const today = new Date().toISOString().slice(0, 10);

        bodyHTML += `<div class="db-mini-cal">
            <div class="db-mini-cal-grid">
                <div class="db-mini-cal-dow">L</div>
                <div class="db-mini-cal-dow">M</div>
                <div class="db-mini-cal-dow">X</div>
                <div class="db-mini-cal-dow">J</div>
                <div class="db-mini-cal-dow">V</div>
                <div class="db-mini-cal-dow">S</div>
                <div class="db-mini-cal-dow">D</div>`;

        // Empty cells before first day
        for (let i = 0; i < startDow; i++) {
            bodyHTML += `<div class="db-mini-day empty"></div>`;
        }

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
            const isToday = dateStr === today;
            const events  = eventMap[dateStr] || [];

            // Dominant event for this day (real > plan, match > training > rest)
            const realEvents = events.filter(e => e.source === 'real');
            const planEvents = events.filter(e => e.source === 'plan');
            const dominant  = realEvents.length ? realEvents : planEvents;
            const hasMatch  = dominant.some(e => e.type === 'match');
            const topType   = hasMatch ? 'match' : (dominant[0]?.type || null);

            let dotHTML = '';
            if (topType) {
                const isReal = realEvents.length > 0;
                const color  = typeColor[topType] || '#ccc';
                dotHTML = `<div class="db-mini-day-dot" style="background:${color};opacity:${isReal ? 1 : 0.45};"></div>`;
                // Second dot if two different types on same day
                const types = [...new Set(dominant.map(e => e.type))];
                if (types.length > 1) {
                    const second = types.find(t => t !== topType);
                    if (second) dotHTML += `<div class="db-mini-day-dot" style="background:${typeColor[second]||'#ccc'};opacity:${isReal?1:0.45};"></div>`;
                }
            }

            const hasBg   = topType && topType !== 'rest';
            const bgStyle = hasBg ? `background:${typeColor[topType]}12;` : '';
            const hasEvt  = events.length > 0;

            bodyHTML += `<div class="db-mini-day${isToday ? ' today' : ''}${hasEvt ? ' has-event' : ''}"
                style="${bgStyle}"
                title="${topType ? typeLabel[topType] : 'Sin actividad'}">
                <div class="db-mini-day-num">${d}</div>
                <div style="display:flex;gap:2px;flex-wrap:wrap;justify-content:center;margin-top:1px;">${dotHTML}</div>
            </div>`;
        }

        bodyHTML += `</div></div>`; // close grid + mini-cal

        // Legend
        bodyHTML += `<div class="db-cal-legend">
            <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#2196f3"></div>Entreno</div>
            <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#f44336"></div>Partido</div>
            <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#4caf50"></div>Rec.</div>
            <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#795548"></div>Gym</div>
            <div class="db-cal-legend-item" style="opacity:0.55">● plan &nbsp; <span style="opacity:1">●</span> real</div>
        </div>`;

    } else {
        // Weekly view
        const now3  = new Date();
        const dow3  = (now3.getDay() + 6) % 7;
        const mon   = new Date(now3);
        mon.setDate(now3.getDate() - dow3 + weekOffset * 7);
        mon.setHours(0,0,0,0);
        const today3 = new Date().toISOString().slice(0,10);
        const dayShort = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'];

        for (let i = 0; i < 7; i++) {
            const d = new Date(mon);
            d.setDate(mon.getDate() + i);
            const dateStr = d.toISOString().slice(0,10);
            const isToday = dateStr === today3;
            const events  = eventMap[dateStr] || [];

            // Deduplicate by type+source
            const seen = new Set();
            const uniq = events.filter(e => {
                const k = e.type + e.source;
                if (seen.has(k)) return false;
                seen.add(k); return true;
            });

            let sessHTML = '';
            if (uniq.length === 0) {
                sessHTML = `<span class="db-week-rest">Descanso</span>`;
            } else {
                sessHTML = `<div class="db-week-sessions">` +
                    uniq.map(e => `
                        <div class="db-week-session-chip">
                            <div class="db-week-session-dot" style="background:${typeColor[e.type]||'#ccc'};opacity:${e.source==='plan'?0.45:1};"></div>
                            <span>${typeIcon[e.type]} ${typeLabel[e.type]}${e.source==='plan'?' <span style="font-size:0.6rem;opacity:0.6">(plan)</span>':''}</span>
                        </div>`).join('') +
                    `</div>`;
            }

            bodyHTML += `<div class="db-week-day-row${isToday ? ' today-row' : ''}">
                <div class="db-week-day-label">
                    <div class="db-week-day-name">${dayShort[i]}</div>
                    <div class="db-week-day-num">${d.getDate()}</div>
                </div>
                ${uniq.length === 0
                    ? `<span class="db-week-rest">Descanso</span>`
                    : `<div class="db-week-sessions">${
                        uniq.map(e => `
                            <div class="db-week-session-chip">
                                <div class="db-week-session-dot" style="background:${typeColor[e.type]||'#ccc'};opacity:${e.source==='plan'?0.45:1};"></div>
                                <span>${typeIcon[e.type]} ${typeLabel[e.type]}${e.source==='plan'?' <span style="font-size:0.6rem;opacity:0.55">(plan)</span>':''}</span>
                            </div>`).join('')
                    }</div>`
                }
            </div>`;
        }

        bodyHTML = `<div class="db-week-view">${bodyHTML}</div>`;

        // Legend
        bodyHTML += `<div class="db-cal-legend">
            <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#2196f3"></div>Entreno</div>
            <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#f44336"></div>Partido</div>
            <div class="db-cal-legend-item"><div class="db-cal-legend-dot" style="background:#4caf50"></div>Rec.</div>
            <div class="db-cal-legend-item" style="opacity:0.55">● plan &nbsp; <span style="opacity:1">●</span> real</div>
        </div>`;
    }

    col.innerHTML = `
        <div class="db-cal-header">
            <span class="db-cal-title">Calendario</span>
            <div class="db-cal-tabs">
                <button class="db-cal-tab${mode==='week'?' active':''}"
                    onclick="window.rpeTracker?._dbCalSetMode('week')">Sem</button>
                <button class="db-cal-tab${mode==='month'?' active':''}"
                    onclick="window.rpeTracker?._dbCalSetMode('month')">Mes</button>
            </div>
        </div>
        <div class="db-cal-nav">
            <button class="db-cal-nav-btn" onclick="window.rpeTracker?._dbCalNav(-1)">‹</button>
            <span class="db-cal-nav-label">${navLabel}</span>
            <button class="db-cal-nav-btn" onclick="window.rpeTracker?._dbCalNav(1)">›</button>
        </div>
        <div class="db-cal-body">
            ${bodyHTML}
        </div>
    `;
};

// ── renderTeamRatios ─────────────────────────────────────────────────
RPETracker.prototype.renderTeamRatios = function() {
    if (this.players.length === 0) {
        return '<p style="color: var(--gray); text-align: center;">No hay jugadoras registradas</p>';
    }

    const getStatus = (r, playerId) => {
        const n = parseFloat(r);
        if (isNaN(n) || r === 'N/A') return { label: 'Sin datos', cls: 'status-nodata', icon: '—' };
        const _tL = this.getPlayerThresholds(playerId || null);
        if (n > _tL.high) return { label: 'Peligro',   cls: 'status-danger',  icon: '🔴' };
        if (n > _tL.opt)  return { label: 'Precaución', cls: 'status-caution', icon: '🟠' };
        if (n < _tL.low)  return { label: 'Por debajo', cls: 'status-low',     icon: '🔵' };
        return           { label: 'Óptimo',    cls: 'status-ok',      icon: '🟢' };
    };

    const cards = this.players.map(player => {
        const ratio = this.calculateAcuteChronicRatio(player.id);
        const st = getStatus(ratio.ratio, player.id);
        const num = player.number ? `<span class="rcard-number">#${player.number}</span>` : '';
        return `
            <div class="rcard ${st.cls}">
                <div class="rcard-top">
                    <div class="rcard-avatar">${player.name.charAt(0).toUpperCase()}</div>
                    <div class="rcard-info">
                        <div class="rcard-name">${player.name}${num}</div>
                        <div class="rcard-status-label">${st.icon} ${st.label}</div>
                    </div>
                </div>
                <div class="rcard-ratio">${ratio.confidence === 'low' ? '<span class="badge-insuf" title="' + (ratio.message||'Datos insuficientes') + '">⚠️ Datos insuficientes</span>' : ratio.ratio === 'N/A' ? '—' : ratio.ratio}</div>
                <div class="rcard-bar-wrap">
                    <div class="rcard-bar">
                        <div class="rcard-bar-fill" style="width:${Math.min((parseFloat(ratio.ratio)||0)/2*100, 100)}%; background:${this.getRatioColor(ratio.ratio)};"></div>
                        <div class="rcard-bar-marker safe-lo"></div>
                        <div class="rcard-bar-marker safe-hi"></div>
                    </div>
                </div>
            </div>`;
    }).join('');

    return `
        <h3 style="margin: 2rem 0 1rem; font-size: 1rem; color: #555; font-weight: 600;">
            📊 Ratio Agudo:Crónico — Vista rápida del equipo
        </h3>
        <div class="rcard-legend">
            <span class="rleg rleg-ok">🟢 Óptimo (0.8–1.3)</span>
            <span class="rleg rleg-caution">🟠 Precaución (1.3–1.5)</span>
            <span class="rleg rleg-danger">🔴 Peligro (&gt;1.5)</span>
            <span class="rleg rleg-low">🔵 Por debajo (&lt;0.8)</span>
        </div>
        <div class="rcard-grid">${cards}</div>`;
};


// ── badge-insuf styles (inyectado una vez al cargar el módulo) ─────────────
(function() {
    if (document.getElementById('badge-insuf-style')) return;
    var s = document.createElement('style');
    s.id = 'badge-insuf-style';
    s.textContent = [
        '.badge-insuf {',
        '  display: inline-flex; align-items: center; gap: 3px;',
        '  font-size: 11px; font-weight: 600;',
        '  color: var(--color-warning, #f9a825);',
        '  background: var(--color-warning-bg, #fffde7);',
        '  border: 1px solid var(--color-warning, #f9a825);',
        '  border-radius: 10px; padding: 1px 6px;',
        '  cursor: default; white-space: nowrap;',
        '}',
        '[data-theme="dark"] .badge-insuf {',
        '  color: #ffd54f; background: #3e3000; border-color: #ffd54f;',
        '}'
    ].join(' ');
    document.head.appendChild(s);
}());

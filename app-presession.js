// app-presession.js — Módulo de pre-sesión: readiness, calendario, semáforo (extraído de app.js V26)

RPETracker.prototype.calculateReadiness = function(playerId) {
    const today = new Date().toISOString().slice(0, 10);
    const wellnessKey = `wellness_${playerId}_${today}`;

    // Try localStorage first (wellness.js stores here before Firebase sync)
    let w = null;
    try { w = Store.get(wellnessKey); } catch(_) {}

    // Also check in-memory wellness array if present
    if (!w && this.wellnessData) {
        w = this.wellnessData.find(x => x.playerId === playerId && x.date === today);
    }

    if (!w) return null;

    // Wellness fields: sleep, mood, fatigue, soreness — each 1-5
    const sleep    = Number(w.sleep    || w.sueno    || 0);
    const mood     = Number(w.mood     || w.humor    || 0);
    const fatigue  = Number(w.fatigue  || w.cansancio|| 0);
    const soreness = Number(w.soreness || w.agujetas || 0);

    if (!sleep && !mood && !fatigue && !soreness) return null;

    // Normalise to 0-1 (1→0, 5→1)
    const norm = v => Math.max(0, Math.min(1, (v - 1) / 4));

    // A:C zone bonus (0, 5, 10, 20)
    const ratio = this.calculateAcuteChronicRatio(playerId);
    const r = parseFloat(ratio.ratio);
    const t = this.getPlayerThresholds(playerId);
    let acBonus = 10; // neutral when no data
    if (!isNaN(r)) {
        if      (r >= t.low && r <= t.opt) acBonus = 20;
        else if (r > t.opt && r <= t.high) acBonus = 10;
        else if (r < t.low && r > 0)       acBonus = 5;
        else if (r > t.high)               acBonus = 0;
    }

    const score = Math.round(
        norm(sleep)    * 25 +
        norm(mood)     * 20 -
        norm(fatigue)  * 20 -
        norm(soreness) * 15 +
        acBonus
    );

    return Math.max(0, Math.min(100, score));
};

RPETracker.prototype.openPreSessionModal = function() {
    const existing = document.getElementById('preSessionModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'preSessionModal';
    modal.className = 'modal active presession-modal';
    modal.innerHTML = this._renderPreSessionModal();
    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', e => {
        if (e.target === modal) modal.remove();
    });
};

RPETracker.prototype._renderPreSessionModal = function() {
    const today = new Date().toISOString().slice(0, 10);
    const dateLabel = new Date().toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const wData = this.wellnessData || [];
    const trendAlerts = typeof this._wTrendAlerts === 'function' ? this._wTrendAlerts() : [];

    // Section 1: Low readiness (<60)
    const lowReadiness = this.players.map(p => ({
        player: p,
        score: this.calculateReadiness(p.id)
    })).filter(d => d.score !== null && d.score < 60)
      .sort((a, b) => a.score - b.score);

    // Section 2: A:C out of individual threshold
    const acOutOfRange = this.players.map(p => {
        const ratio = this.calculateAcuteChronicRatio(p.id);
        const r = parseFloat(ratio.ratio);
        const t = this.getPlayerThresholds(p.id);
        if (isNaN(r)) return null;
        let status = null, icon = '', color = '';
        if (r > t.high)            { status = 'danger';   icon = '🔴'; color = '#f44336'; }
        else if (r > t.opt)        { status = 'caution';  icon = '🟠'; color = '#ff9800'; }
        else if (r > 0 && r < t.low) { status = 'low';   icon = '🔵'; color = '#2196f3'; }
        if (!status) return null;
        return { player: p, ratio: ratio.ratio, icon, color, status };
    }).filter(Boolean).sort((a, b) => {
        const order = { danger: 0, caution: 1, low: 2 };
        return order[a.status] - order[b.status];
    });

    // Section 3: Injured / in rehab
    const injured = this.players.map(p => {
        const inj = (this.injuries || []).find(i => i.playerId === p.id && i.status === 'active');
        if (!inj) return null;
        const loc = this.getLocationName ? this.getLocationName(inj.location) : (inj.location || 'lesión activa');
        const phase = inj.rtpPhase ? `Fase ${inj.rtpPhase} RTP` : 'En baja';
        return { player: p, injury: inj, loc, phase };
    }).filter(Boolean);

    // Section 4: 3+ day low wellness trend (from _wTrendAlerts)
    const wellnessTrend = trendAlerts.reduce((acc, a) => {
        const existing = acc.find(x => x.name === a.name);
        if (existing) { existing.messages.push(a.message); }
        else acc.push({ name: a.name, messages: [a.message] });
        return acc;
    }, []);

    // Players clear (no alerts in any section)
    const alertedIds = new Set([
        ...lowReadiness.map(d => d.player.id),
        ...acOutOfRange.map(d => d.player.id),
        ...injured.map(d => d.player.id),
        ...trendAlerts.map(a => {
            const p = this.players.find(pl => pl.name === a.name);
            return p ? p.id : null;
        }).filter(Boolean)
    ]);
    const clearPlayers = this.players.filter(p => !alertedIds.has(p.id));

    const allClear = lowReadiness.length === 0 && acOutOfRange.length === 0 &&
                     injured.length === 0 && wellnessTrend.length === 0;

    const renderSection = (title, count, colorClass, items, emptyMsg) => {
        const isEmpty = items.length === 0;
        return `<div class="pss-section ${isEmpty ? 'pss-section--ok' : ''}">
            <div class="pss-section-header">
                <span class="pss-section-title">${title}</span>
                <span class="pss-section-badge ${colorClass}">${count}</span>
            </div>
            ${isEmpty
                ? `<div class="pss-empty">✅ ${emptyMsg}</div>`
                : `<div class="pss-rows">${items}</div>`
            }
        </div>`;
    };

    const rdyRows = lowReadiness.map(d => {
        const lbl = this.readinessLabel(d.score);
        return `<div class="pss-row">
            ${PlayerTokens.avatar(d.player, 22, '0.65rem')}
            <span class="pss-name">${d.player.name}</span>
            <span class="pss-tag" style="color:${lbl.color};background:${lbl.bg}">${lbl.icon} ${d.score}/100</span>
        </div>`;
    }).join('');

    const acRows = acOutOfRange.map(d => `<div class="pss-row">
        ${PlayerTokens.avatar(d.player, 22, '0.65rem')}
        <span class="pss-name">${d.player.name}</span>
        <span class="pss-tag" style="color:${d.color}">${d.icon} Ratio ${d.ratio}</span>
    </div>`).join('');

    const injRows = injured.map(d => `<div class="pss-row">
        ${PlayerTokens.avatar(d.player, 22, '0.65rem')}
        <span class="pss-name">${d.player.name}</span>
        <span class="pss-tag pss-tag--inj">🏥 ${d.loc} — ${d.phase}</span>
    </div>`).join('');

    const trendRows = wellnessTrend.map(d => `<div class="pss-row pss-row--trend">
        <span class="pss-trend-name">${d.name.split(' ')[0]}</span>
        <span class="pss-trend-msgs">${d.messages.join(' · ')}</span>
    </div>`).join('');

    return `
    <div class="modal-content presession-content">
        <div class="modal-header presession-header">
            <div class="presession-title-wrap">
                <span class="presession-icon">▶</span>
                <div>
                    <div class="presession-title">Resumen Pre-sesión</div>
                    <div class="presession-date">${dateLabel}</div>
                </div>
            </div>
            <button class="btn-close" onclick="document.getElementById('preSessionModal')?.remove()">&times;</button>
        </div>
        <div class="presession-body">
            ${allClear ? `
            <div class="pss-all-clear">
                <div class="pss-all-clear-icon">✅</div>
                <div class="pss-all-clear-title">Equipo listo para entrenar</div>
                <div class="pss-all-clear-sub">Sin alertas activas hoy — todas las jugadoras en estado óptimo</div>
            </div>` : `
            ${renderSection(
                '🔴 Readiness bajo (&lt;60)',
                lowReadiness.length,
                lowReadiness.length ? 'pss-badge--red' : 'pss-badge--ok',
                rdyRows,
                'Todas con readiness adecuado'
            )}
            ${renderSection(
                '⚠️ A:C fuera de umbral individual',
                acOutOfRange.length,
                acOutOfRange.length ? 'pss-badge--orange' : 'pss-badge--ok',
                acRows,
                'Todas dentro de su umbral individual'
            )}
            ${renderSection(
                '🏥 Lesionadas / Rehab',
                injured.length,
                injured.length ? 'pss-badge--red' : 'pss-badge--ok',
                injRows,
                'Sin lesiones activas'
            )}
            ${renderSection(
                '📉 Wellness bajo 3+ días consecutivos',
                wellnessTrend.length,
                wellnessTrend.length ? 'pss-badge--purple' : 'pss-badge--ok',
                trendRows,
                'Sin tendencias negativas'
            )}
            `}
            ${clearPlayers.length > 0 && !allClear ? `
            <div class="pss-clear-row">
                ✅ <strong>${clearPlayers.length} jugadora${clearPlayers.length !== 1 ? 's' : ''}</strong> sin alertas:
                ${clearPlayers.map(p => `<span class="pss-clear-chip">${p.name.split(' ')[0]}</span>`).join('')}
            </div>` : ''}
        </div>
    </div>`;
};

RPETracker.prototype._dbCalSetMode = function(mode) {
    if (!this._dbCal) {
        const now = new Date();
        this._dbCal = { mode, year: now.getFullYear(), month: now.getMonth(), weekOffset: 0 };
    }
    this._dbCal.mode = mode;
    this.renderDashboardCalendar();
};

RPETracker.prototype._dbCalNav = function(dir) {
    if (!this._dbCal) return;
    if (this._dbCal.mode === 'month') {
        this._dbCal.month += dir;
        if (this._dbCal.month > 11) { this._dbCal.month = 0;  this._dbCal.year++; }
        if (this._dbCal.month < 0)  { this._dbCal.month = 11; this._dbCal.year--; }
    } else {
        this._dbCal.weekOffset = (this._dbCal.weekOffset || 0) + dir;
    }
    this.renderDashboardCalendar();
};

RPETracker.prototype._renderSemaphoreBar = function() {
    let bar = document.getElementById('semaphoreBar');
    if (!bar) {
        bar = document.createElement('div');
        bar.id = 'semaphoreBar';
        bar.className = 'semaphore-bar';
        // Insert inside analytics-container, before comparisonModule
        const anchor = document.getElementById('comparisonModule');
        if (anchor) anchor.parentNode.insertBefore(bar, anchor);
        else return;
    }

    const getStatus = (r, playerId) => {
        const n = parseFloat(r);
        if (isNaN(n) || r === 'N/A') return { color: '#9e9e9e', icon: '⚪', label: 'Sin datos' };
        const _tP = this.getPlayerThresholds(playerId || null);
        if (n > _tP.high) return { color: '#e53935', icon: '🔴', label: 'Peligro' };
        if (n > _tP.opt)  return { color: '#fb8c00', icon: '🟠', label: 'Precaución' };
        if (n < _tP.low)  return { color: '#1e88e5', icon: '🔵', label: 'Por debajo' };
        return           { color: '#43a047', icon: '🟢', label: 'Óptimo' };
    };

    const pills = this.players.map(player => {
        const ratio = this.calculateAcuteChronicRatio(player.id);
        const st = getStatus(ratio.ratio, player.id);
        const ratioDisplay = ratio.ratio === 'N/A' ? '—' : ratio.ratio;
        const avatar = PlayerTokens.avatar(player, 22, '0.6rem');
        return `<div class="sema-pill" style="--sema-color:${st.color}" title="${esc(player.name)} · Ratio A:C ${ratioDisplay} · ${st.label}"
            onclick="window.rpeTracker?.scrollToPlayerChart('${player.id}')">
            ${avatar}
            <span class="sema-name">${esc(player.name)}${player.number ? ' <span class="sema-num">#'+esc(player.number)+'</span>' : ''}</span>
            <span class="sema-ratio">${ratioDisplay}</span>
            <span class="sema-dot" style="background:${st.color}"></span>
        </div>`;
    }).join('');

    bar.innerHTML = `
        <div class="sema-label">Estado equipo</div>
        <div class="sema-pills">${pills}</div>
    `;
};

RPETracker.prototype.scrollToPlayerChart = function(playerId) {
    const canvas = document.getElementById(`chart-${playerId}`);
    if (canvas) {
        canvas.closest('.chart-container')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
};


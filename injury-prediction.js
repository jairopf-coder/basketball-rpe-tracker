// Basketball RPE Tracker - Injury Risk Prediction (ML-based)

// ========== INJURY RISK PREDICTION ==========

RPETracker.prototype.predictInjuryRisk = function(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return null;

    const playerSessions = this.sessions
        .filter(s => s.playerId === playerId)
        .map(s => ({
            ...s,
            date: new Date(s.date),
            load: s.load || (s.rpe * (s.duration || 60))
        }))
        .sort((a, b) => a.date - b.date);

    if (playerSessions.length < 14) {
        return {
            riskLevel: 'unknown',
            probability: 0,
            confidence: 'low',
            color: '#9e9e9e',
            colorHex: '#9e9e9e',
            message: `Datos insuficientes (${playerSessions.length}/14 sesiones). Se necesitan al menos 14 sesiones para predicción confiable.`,
            factors: [],
            recommendations: ['Registra más sesiones para activar la predicción de riesgo.']
        };
    }

    const factors = this.calculateRiskFactors(playerId, playerSessions);

    let riskScore = 0;
    const weights = {
        ratioAC:    0.30,
        spikeLoad:  0.25,
        monotony:   0.15,
        strain:     0.15,
        recentLoad: 0.10,
        recovery:   0.05
    };

    const ratio = this.calculateAcuteChronicRatio(playerId);
    const r = parseFloat(ratio.ratio) || 0;

    if (r > 1.5)      riskScore += weights.ratioAC * 100;
    else if (r > 1.3) riskScore += weights.ratioAC * 70;
    else if (r < 0.8) riskScore += weights.ratioAC * 40;
    else              riskScore += weights.ratioAC * 20;

    const spikeRisk = factors.spikeLoad;
    riskScore += weights.spikeLoad * spikeRisk;

    const advancedStats = this.calculateAdvancedStats ? this.calculateAdvancedStats(playerId) : {};
    const monotony = parseFloat(advancedStats.monotony) || 0;

    if (monotony > 3)      riskScore += weights.monotony * 80;
    else if (monotony > 2) riskScore += weights.monotony * 50;
    else                   riskScore += weights.monotony * 20;

    const strain = parseFloat(advancedStats.strain) || 0;
    if (strain > 8000)      riskScore += weights.strain * 90;
    else if (strain > 5000) riskScore += weights.strain * 60;
    else                    riskScore += weights.strain * 30;

    riskScore += weights.recentLoad * factors.recentHighLoad;
    riskScore += weights.recovery * factors.insufficientRecovery;

    let riskLevel, confidence, message, colorHex;

    if (riskScore >= 70) {
        riskLevel  = 'high';
        confidence = 'high';
        message    = '🚨 ALTO RIESGO de lesión en los próximos 7 días. Reducir carga inmediatamente y considerar descanso.';
        colorHex   = '#f44336';
    } else if (riskScore >= 50) {
        riskLevel  = 'moderate';
        confidence = 'medium';
        message    = '⚠️ RIESGO MODERADO. Monitorizar de cerca, reducir intensidad y aumentar recuperación.';
        colorHex   = '#ff9800';
    } else if (riskScore >= 30) {
        riskLevel  = 'low';
        confidence = 'medium';
        message    = 'ℹ️ Riesgo bajo-moderado. Mantener monitorización y evitar picos de carga.';
        colorHex   = '#2196f3';
    } else {
        riskLevel  = 'minimal';
        confidence = 'high';
        message    = '✅ Riesgo mínimo. Condiciones óptimas para continuar entrenamiento.';
        colorHex   = '#4caf50';
    }

    return {
        riskLevel,
        probability: Math.round(riskScore),
        confidence,
        message,
        color: colorHex,
        colorHex,
        factors: [
            {
                name: 'Ratio A:C',
                value: ratio.ratio,
                impact: r > 1.5 ? 'Alto' : r > 1.3 ? 'Moderado' : r < 0.8 ? 'Bajo-Mod' : 'Mínimo',
                status: r > 1.5 ? 'danger' : r > 1.3 ? 'warning' : 'ok'
            },
            {
                name: 'Picos de Carga',
                value: spikeRisk > 50 ? 'Detectados' : 'Normales',
                impact: spikeRisk > 50 ? 'Alto' : 'Bajo',
                status: spikeRisk > 50 ? 'warning' : 'ok'
            },
            {
                name: 'Monotonía',
                value: monotony.toFixed(1),
                impact: monotony > 3 ? 'Alto' : monotony > 2 ? 'Moderado' : 'Bajo',
                status: monotony > 3 ? 'warning' : 'ok'
            },
            {
                name: 'Strain',
                value: strain > 0 ? Math.round(strain) : '—',
                impact: strain > 8000 ? 'Alto' : strain > 5000 ? 'Moderado' : 'Bajo',
                status: strain > 8000 ? 'danger' : strain > 5000 ? 'warning' : 'ok'
            },
            {
                name: 'Recuperación',
                value: factors.insufficientRecovery > 50 ? 'Insuficiente' : 'Adecuada',
                impact: factors.insufficientRecovery > 50 ? 'Moderado' : 'Bajo',
                status: factors.insufficientRecovery > 50 ? 'warning' : 'ok'
            }
        ],
        recommendations: this.getInjuryPreventionRecommendations(riskLevel, factors, ratio)
    };
};

RPETracker.prototype.calculateRiskFactors = function(playerId, playerSessions) {
    const now = new Date();

    let spikeRisk = 0;
    const last7Days = playerSessions.filter(s => {
        const diff = (now - s.date) / (1000 * 60 * 60 * 24);
        return diff <= 7;
    });

    const previous7Days = playerSessions.filter(s => {
        const diff = (now - s.date) / (1000 * 60 * 60 * 24);
        return diff > 7 && diff <= 14;
    });

    const lastWeekAvg = last7Days.length > 0
        ? last7Days.reduce((sum, s) => sum + s.load, 0) / last7Days.length : 0;

    const prevWeekAvg = previous7Days.length > 0
        ? previous7Days.reduce((sum, s) => sum + s.load, 0) / previous7Days.length : 0;

    if (prevWeekAvg > 0) {
        const increase = ((lastWeekAvg - prevWeekAvg) / prevWeekAvg) * 100;
        if (increase > 30) spikeRisk = Math.min(100, increase * 1.5);
    }

    const last3Days = playerSessions.filter(s => {
        const diff = (now - s.date) / (1000 * 60 * 60 * 24);
        return diff <= 3;
    });

    const highRPECount = last3Days.filter(s => s.rpe >= 8).length;
    const recentHighLoad = highRPECount >= 2 ? 80 : highRPECount >= 1 ? 40 : 10;

    let shortRecoveryCount = 0;
    for (let i = 1; i < last7Days.length; i++) {
        const gap = (last7Days[i].date - last7Days[i - 1].date) / (1000 * 60 * 60);
        if (gap < 24) shortRecoveryCount++;
    }

    const insufficientRecovery = last7Days.length > 0
        ? (shortRecoveryCount / last7Days.length) * 100 : 0;

    return { spikeLoad: spikeRisk, recentHighLoad, insufficientRecovery };
};

RPETracker.prototype.getInjuryPreventionRecommendations = function(riskLevel, factors, ratio) {
    const recommendations = [];

    switch (riskLevel) {
        case 'high':
            recommendations.push('🛑 Descanso activo durante 2-3 días');
            recommendations.push('🧘 Sesiones de recuperación: estiramientos, movilidad, masajes');
            recommendations.push('💧 Priorizar hidratación y nutrición');
            recommendations.push('😴 Asegurar 8+ horas de sueño');
            recommendations.push('📉 Reducir carga 40-50% en próximas sesiones');
            break;
        case 'moderate':
            recommendations.push('⚠️ Reducir intensidad 20-30% en próxima sesión');
            recommendations.push('🔄 Alternar días intensos con recuperación');
            recommendations.push('🎯 Evitar ejercicios de alto impacto temporalmente');
            recommendations.push('💆 Incluir sesiones de recuperación activa');
            break;
        case 'low':
            recommendations.push('👁️ Monitorizar síntomas de fatiga');
            recommendations.push('⚖️ Mantener balance entre carga y recuperación');
            recommendations.push('📊 Continuar registrando RPE consistentemente');
            break;
        case 'minimal':
            recommendations.push('✅ Condiciones óptimas para progresión');
            recommendations.push('📈 Puede aumentar carga gradualmente (5-10%)');
            recommendations.push('💪 Mantener variedad en entrenamientos');
            break;
    }

    const r = parseFloat(ratio.ratio) || 0;
    if (r > 1.5)                           recommendations.push('🚨 Ratio A:C crítico: reducir carga ya');
    if (factors.spikeLoad > 50)            recommendations.push('📊 Detectado pico de carga: evitar aumentos bruscos');
    if (factors.insufficientRecovery > 50) recommendations.push('⏰ Aumentar tiempo entre sesiones (48h mínimo)');

    return recommendations;
};

// ========== RENDER INJURY PREDICTION UI ==========

// State for prediction dashboard
RPETracker.prototype._predState = {
    sortOrder: 'desc',      // 'desc' = mayor riesgo primero, 'asc' = menor
    selected: new Set(),    // Set of player IDs selected via mini-chips
    expanded: new Set()     // Set of player IDs whose cards are expanded
};

RPETracker.prototype.renderInjuryPredictionDashboard = function() {
    const container = document.getElementById('injuryPredictionView');
    if (!container) return;

    // Ensure state object exists (in case of first load)
    if (!this._predState) {
        this._predState = { sortOrder: 'desc', selected: new Set(), expanded: new Set() };
    }

    // ── 1. Compute all predictions ───────────────────────────────────────
    let predictions = this.players.map(player => ({
        player,
        prediction: this.predictInjuryRisk(player.id)
    }));

    // ── 2. Sort by risk ──────────────────────────────────────────────────
    const riskOrder = { high: 4, moderate: 3, low: 2, minimal: 1, unknown: 0 };
    predictions.sort((a, b) => {
        const ra = riskOrder[a.prediction.riskLevel] ?? 0;
        const rb = riskOrder[b.prediction.riskLevel] ?? 0;
        const byLevel = rb - ra;
        if (byLevel !== 0) return this._predState.sortOrder === 'desc' ? byLevel : -byLevel;
        // Secondary sort: probability
        return this._predState.sortOrder === 'desc'
            ? b.prediction.probability - a.prediction.probability
            : a.prediction.probability - b.prediction.probability;
    });

    // ── 3. Team summary banner ───────────────────────────────────────────
    const counts = { high: 0, moderate: 0, low: 0, minimal: 0, unknown: 0 };
    predictions.forEach(({ prediction: p }) => {
        if (counts[p.riskLevel] !== undefined) counts[p.riskLevel]++;
    });

    const total  = predictions.length;
    const atRisk = counts.high + counts.moderate;

    const summaryChips = [
        { level: 'high',     label: 'Alto',      color: '#f44336', count: counts.high     },
        { level: 'moderate', label: 'Moderado',  color: '#ff9800', count: counts.moderate },
        { level: 'low',      label: 'Bajo',      color: '#2196f3', count: counts.low      },
        { level: 'minimal',  label: 'Mínimo',    color: '#4caf50', count: counts.minimal  },
        { level: 'unknown',  label: 'Sin datos', color: '#9e9e9e', count: counts.unknown  },
    ].filter(c => c.count > 0);

    const allSelected = total > 0 && this._predState.selected.size === total;

    const summaryHtml = total === 0 ? '' : `
        <div class="pred-team-summary">
            <div class="pred-summary-left">
                <div class="pred-summary-icon">${atRisk > 0 ? '⚠️' : '✅'}</div>
                <div>
                    <div class="pred-summary-title">Resumen del equipo</div>
                    <div class="pred-summary-sub">${total} jugadoras · ${atRisk > 0 ? `${atRisk} requieren atención` : 'Sin alertas activas'}</div>
                </div>
            </div>
            <div class="pred-summary-chips">
                ${summaryChips.map(c => `
                    <div class="pred-summary-chip" style="--chip-color:${c.color}">
                        <span class="pred-chip-dot"></span>
                        <span class="pred-chip-count">${c.count}</span>
                        <span class="pred-chip-label">${c.label}</span>
                    </div>
                `).join('')}
            </div>
            <div class="pred-summary-minichips">
                <button class="pred-select-all-btn ${allSelected ? 'pred-select-all-btn--active' : ''}"
                    onclick="window._rpeTracker._predSelectAll()"
                    title="${allSelected ? 'Deseleccionar todas' : 'Seleccionar todas'}">
                    ${allSelected ? '✓ Todas' : 'Todas'}
                </button>
                ${predictions.map(({ player, prediction: p }) => {
                    const isSel = this._predState.selected.has(player.id);
                    return `
                    <div class="pred-mini-chip ${isSel ? 'pred-mini-chip--selected' : ''}"
                        style="--chip-color:${p.colorHex}"
                        title="${player.name}${player.number ? ' #' + player.number : ''} · ${p.riskLevel === 'unknown' ? 'Sin datos' : p.probability + '% riesgo'}"
                        onclick="window._rpeTracker._predToggleSelect('${player.id}')">
                        ${player.name.split(' ')[0]}
                        ${isSel ? '<span class="pred-mini-check">✓</span>' : ''}
                    </div>`;
                }).join('')}
                ${this._predState.selected.size > 0 ? `
                    <span class="pred-selected-count">${this._predState.selected.size} sel.</span>
                ` : ''}
            </div>
        </div>
    `;

    // ── 4. Sort controls ─────────────────────────────────────────────────
    const sortBarHtml = predictions.length === 0 ? '' : `
        <div class="pred-sort-bar">
            <span class="pred-sort-label">Ordenar por riesgo:</span>
            <button class="pred-sort-btn ${this._predState.sortOrder === 'desc' ? 'pred-sort-btn--active' : ''}"
                onclick="window._rpeTracker._predSetSort('desc')">
                ↓ Mayor primero
            </button>
            <button class="pred-sort-btn ${this._predState.sortOrder === 'asc' ? 'pred-sort-btn--active' : ''}"
                onclick="window._rpeTracker._predSetSort('asc')">
                ↑ Menor primero
            </button>
        </div>
    `;

    // ── 5. Player cards – collapsible two-column grid ────────────────────
    const cardsHtml = predictions.length === 0
        ? `<div class="pred-empty">No hay jugadoras registradas. Añade jugadoras para activar la predicción.</div>`
        : `<div class="pred-grid">
            ${predictions.map(({ player, prediction: pred }) => {
                const isUnknown = pred.riskLevel === 'unknown';
                const hex       = pred.colorHex;
                const isExpanded = this._predState.expanded.has(player.id);
                const isSelected = this._predState.selected.has(player.id);

                // Compact ring values (smaller for collapsed header)
                const R    = 20;
                const circ = Math.round(2 * Math.PI * R);
                const dash = Math.round((pred.probability / 100) * circ);

                const levelLabel = {
                    high: '🚨 Alto', moderate: '⚠️ Moderado',
                    low: 'ℹ️ Bajo', minimal: '✅ Mínimo', unknown: '— Sin datos'
                }[pred.riskLevel] || '—';

                const factorsHtml = pred.factors.length > 0 ? `
                    <div class="pred-factors">
                        <div class="pred-factors-title">Factores de riesgo</div>
                        ${pred.factors.map(f => `
                            <div class="pred-factor-row pred-factor--${f.status}">
                                <span class="pred-factor-name">${f.name}</span>
                                <span class="pred-factor-value">${f.value}</span>
                                <span class="pred-factor-impact">${f.impact}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : '';

                const recsHtml = pred.recommendations.length > 0 ? `
                    <div class="pred-recs-title">Recomendaciones</div>
                    <ul class="pred-recs">
                        ${pred.recommendations.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                ` : '';

                // Compact inline ring for the collapsed header
                const compactRingHtml = !isUnknown ? `
                    <div class="pred-compact-ring" style="--ring-color:${hex}">
                        <svg viewBox="0 0 46 46" width="46" height="46">
                            <circle cx="23" cy="23" r="${R}" fill="none" stroke-width="4" class="pred-ring-track"/>
                            <circle cx="23" cy="23" r="${R}" fill="none" stroke-width="4"
                                stroke="${hex}" stroke-linecap="round"
                                stroke-dasharray="${dash} ${circ - dash}"
                                transform="rotate(-90 23 23)"/>
                        </svg>
                        <div class="pred-compact-ring-label">
                            <span style="color:${hex};font-weight:800;font-size:0.75rem;line-height:1">${pred.probability}%</span>
                        </div>
                    </div>
                ` : `<div class="pred-compact-ring-unknown">—</div>`;

                // Full ring for expanded view (larger)
                const R2 = 28, circ2 = Math.round(2 * Math.PI * R2), dash2 = Math.round((pred.probability / 100) * circ2);
                const fullRingHtml = !isUnknown ? `
                    <div class="pred-ring-wrap">
                        <svg class="pred-ring" viewBox="0 0 70 70" width="64" height="64">
                            <circle cx="35" cy="35" r="${R2}" fill="none" stroke-width="6" class="pred-ring-track"/>
                            <circle cx="35" cy="35" r="${R2}" fill="none" stroke-width="6"
                                stroke="${hex}" stroke-linecap="round"
                                stroke-dasharray="${dash2} ${circ2 - dash2}"
                                transform="rotate(-90 35 35)"/>
                        </svg>
                        <div class="pred-ring-label">
                            <span class="pred-ring-pct" style="color:${hex}">${pred.probability}%</span>
                            <span class="pred-ring-sub">riesgo</span>
                        </div>
                    </div>
                ` : `<div class="pred-ring-unknown">—</div>`;

                return `
                    <div class="pred-card pred-card--${pred.riskLevel} ${isExpanded ? 'pred-card--expanded' : ''} ${isSelected ? 'pred-card--selected' : ''}"
                         id="pred-card-${player.id}">

                        <!-- Collapsed header (always visible) -->
                        <div class="pred-card-collapsed"
                             onclick="window._rpeTracker._predToggleExpand('${player.id}')">
                            <div class="pred-collapsed-left">
                                <div class="pred-player-name">
                                    ${player.name}
                                    ${player.number ? `<span class="pred-player-num">#${player.number}</span>` : ''}
                                </div>
                                <div class="pred-level-badge pred-level-badge--${pred.riskLevel}">${levelLabel}</div>
                            </div>
                            <div class="pred-collapsed-right">
                                ${compactRingHtml}
                                <span class="pred-expand-chevron">${isExpanded ? '▲' : '▼'}</span>
                            </div>
                        </div>

                        <!-- Expanded content -->
                        ${isExpanded ? `
                        <div class="pred-card-expanded-body">
                            <div class="pred-card-header">
                                <div class="pred-player-info">
                                    <div class="pred-player-name">
                                        ${player.name}
                                        ${player.number ? `<span class="pred-player-num">#${player.number}</span>` : ''}
                                    </div>
                                    <div class="pred-level-badge pred-level-badge--${pred.riskLevel}">${levelLabel}</div>
                                </div>
                                ${fullRingHtml}
                            </div>
                            <div class="pred-message pred-message--${pred.riskLevel}" style="border-left-color:${hex}; background:${hex}18">
                                ${pred.message}
                            </div>
                            ${factorsHtml}
                            ${recsHtml}
                        </div>
                        ` : ''}
                    </div>
                `;
            }).join('')}
        </div>`;

    // ── 6. "Cómo funciona" collapsible at bottom ─────────────────────────
    const howItWorksHtml = `
        <details class="pred-how-details">
            <summary class="pred-how-summary">
                <span>ℹ️ Cómo funciona la predicción</span>
                <span class="pred-how-chevron">›</span>
            </summary>
            <div class="pred-how-body">
                <p>El sistema combina <strong>6 factores ponderados</strong> para estimar el riesgo de lesión en los próximos 7 días:</p>
                <div class="pred-how-grid">
                    <div class="pred-how-item"><strong>30%</strong> Ratio Agudo:Crónico (A:C) — compara la carga reciente vs. la habitual</div>
                    <div class="pred-how-item"><strong>25%</strong> Picos de carga — detecta aumentos bruscos semana a semana (&gt;30%)</div>
                    <div class="pred-how-item"><strong>15%</strong> Monotonía — variabilidad de las cargas de entrenamiento</div>
                    <div class="pred-how-item"><strong>15%</strong> Strain — producto de carga semanal × monotonía</div>
                    <div class="pred-how-item"><strong>10%</strong> Carga reciente — sesiones con RPE ≥ 8 en los últimos 3 días</div>
                    <div class="pred-how-item"><strong>5%</strong> Recuperación — sesiones con menos de 24h de descanso entre sí</div>
                </div>
                <p class="pred-how-note">Requiere <strong>mínimo 14 sesiones</strong> por jugadora. Metodología basada en ACWR (Hulin et al., 2016) y Strain de Foster.</p>
            </div>
        </details>
    `;

    // ── 7. Final assembly ────────────────────────────────────────────────
    container.innerHTML = `
        <div class="pred-page-header">
            <h2>🔮 Predicción de Riesgo de Lesión</h2>
        </div>
        ${summaryHtml}
        ${sortBarHtml}
        ${cardsHtml}
        ${howItWorksHtml}
    `;

    // Expose tracker reference for onclick handlers
    window._rpeTracker = this;
};

// ── Toggle expand/collapse of a player card ──────────────────────────────────
RPETracker.prototype._predToggleExpand = function(playerId) {
    if (!this._predState) this._predState = { sortOrder: 'desc', selected: new Set(), expanded: new Set() };
    if (this._predState.expanded.has(playerId)) {
        this._predState.expanded.delete(playerId);
    } else {
        this._predState.expanded.add(playerId);
    }
    this.renderInjuryPredictionDashboard();
};

// ── Toggle selection of a player from the summary mini-chips ─────────────────
RPETracker.prototype._predToggleSelect = function(playerId) {
    if (!this._predState) this._predState = { sortOrder: 'desc', selected: new Set(), expanded: new Set() };
    if (this._predState.selected.has(playerId)) {
        this._predState.selected.delete(playerId);
    } else {
        this._predState.selected.add(playerId);
    }
    // Also scroll/expand the selected card if selecting
    this.renderInjuryPredictionDashboard();
};

// ── Select / deselect all players ────────────────────────────────────────────
RPETracker.prototype._predSelectAll = function() {
    if (!this._predState) this._predState = { sortOrder: 'desc', selected: new Set(), expanded: new Set() };
    const allIds = this.players.map(p => p.id);
    if (this._predState.selected.size === allIds.length) {
        this._predState.selected.clear();
    } else {
        this._predState.selected = new Set(allIds);
    }
    this.renderInjuryPredictionDashboard();
};

// ── Change sort order ─────────────────────────────────────────────────────────
RPETracker.prototype._predSetSort = function(order) {
    if (!this._predState) this._predState = { sortOrder: 'desc', selected: new Set(), expanded: new Set() };
    this._predState.sortOrder = order;
    this.renderInjuryPredictionDashboard();
};

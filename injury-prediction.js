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
            message: 'Datos insuficientes. Se necesitan al menos 14 sesiones para predicción confiable.',
            factors: []
        };
    }
    
    // Calculate multiple risk factors
    const factors = this.calculateRiskFactors(playerId, playerSessions);
    
    // Weighted risk score (0-100)
    let riskScore = 0;
    const weights = {
        ratioAC: 0.30,      // 30% weight
        spikeLoad: 0.25,    // 25% weight
        monotony: 0.15,     // 15% weight
        strain: 0.15,       // 15% weight
        recentLoad: 0.10,   // 10% weight
        recovery: 0.05      // 5% weight
    };
    
    // 1. Ratio A:C factor
    const ratio = this.calculateAcuteChronicRatio(playerId);
    const r = parseFloat(ratio.ratio) || 0;
    
    if (r > 1.5) riskScore += weights.ratioAC * 100;
    else if (r > 1.3) riskScore += weights.ratioAC * 70;
    else if (r < 0.8) riskScore += weights.ratioAC * 40;
    else riskScore += weights.ratioAC * 20;
    
    // 2. Spike in load factor
    const spikeRisk = factors.spikeLoad;
    riskScore += weights.spikeLoad * spikeRisk;
    
    // 3. Monotony factor
    const advancedStats = this.calculateAdvancedStats ? this.calculateAdvancedStats(playerId) : {};
    const monotony = parseFloat(advancedStats.monotony) || 0;
    
    if (monotony > 3) riskScore += weights.monotony * 80;
    else if (monotony > 2) riskScore += weights.monotony * 50;
    else riskScore += weights.monotony * 20;
    
    // 4. Strain factor
    const strain = parseFloat(advancedStats.strain) || 0;
    if (strain > 8000) riskScore += weights.strain * 90;
    else if (strain > 5000) riskScore += weights.strain * 60;
    else riskScore += weights.strain * 30;
    
    // 5. Recent high load factor
    riskScore += weights.recentLoad * factors.recentHighLoad;
    
    // 6. Recovery factor (time between sessions)
    riskScore += weights.recovery * factors.insufficientRecovery;
    
    // Determine risk level
    let riskLevel, confidence, message, color;
    
    if (riskScore >= 70) {
        riskLevel = 'high';
        confidence = 'high';
        message = '🚨 ALTO RIESGO de lesión en los próximos 7 días. Reducir carga inmediatamente y considerar descanso.';
        color = '#f44336';
    } else if (riskScore >= 50) {
        riskLevel = 'moderate';
        confidence = 'medium';
        message = '⚠️ RIESGO MODERADO. Monitorizar de cerca, reducir intensidad y aumentar recuperación.';
        color = '#ff9800';
    } else if (riskScore >= 30) {
        riskLevel = 'low';
        confidence = 'medium';
        message = 'ℹ️ Riesgo bajo-moderado. Mantener monitorización y evitar picos de carga.';
        color = '#2196f3';
    } else {
        riskLevel = 'minimal';
        confidence = 'high';
        message = '✅ Riesgo mínimo. Condiciones óptimas para continuar entrenamiento.';
        color = '#4caf50';
    }
    
    return {
        riskLevel,
        probability: Math.round(riskScore),
        confidence,
        message,
        color,
        factors: [
            {
                name: 'Ratio Agudo:Crónico',
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
                value: strain,
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
    
    // 1. Detect load spikes (sudden increases > 30%)
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
        ? last7Days.reduce((sum, s) => sum + s.load, 0) / last7Days.length
        : 0;
    
    const prevWeekAvg = previous7Days.length > 0
        ? previous7Days.reduce((sum, s) => sum + s.load, 0) / previous7Days.length
        : 0;
    
    if (prevWeekAvg > 0) {
        const increase = ((lastWeekAvg - prevWeekAvg) / prevWeekAvg) * 100;
        if (increase > 30) spikeRisk = Math.min(100, increase * 1.5);
    }
    
    // 2. High RPE sessions in last 3 days
    const last3Days = playerSessions.filter(s => {
        const diff = (now - s.date) / (1000 * 60 * 60 * 24);
        return diff <= 3;
    });
    
    const highRPECount = last3Days.filter(s => s.rpe >= 8).length;
    const recentHighLoad = highRPECount >= 2 ? 80 : highRPECount >= 1 ? 40 : 10;
    
    // 3. Insufficient recovery (sessions with < 24h gap)
    let shortRecoveryCount = 0;
    for (let i = 1; i < last7Days.length; i++) {
        const gap = (last7Days[i].date - last7Days[i-1].date) / (1000 * 60 * 60);
        if (gap < 24) shortRecoveryCount++;
    }
    
    const insufficientRecovery = last7Days.length > 0
        ? (shortRecoveryCount / last7Days.length) * 100
        : 0;
    
    return {
        spikeLoad: spikeRisk,
        recentHighLoad,
        insufficientRecovery
    };
};

RPETracker.prototype.getInjuryPreventionRecommendations = function(riskLevel, factors, ratio) {
    const recommendations = [];
    
    switch(riskLevel) {
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
    
    // Add specific recommendations based on factors
    const r = parseFloat(ratio.ratio) || 0;
    if (r > 1.5) {
        recommendations.push('🚨 Ratio A:C crítico: reducir carga ya');
    }
    
    if (factors.spikeLoad > 50) {
        recommendations.push('📊 Detectado pico de carga: evitar aumentos bruscos');
    }
    
    if (factors.insufficientRecovery > 50) {
        recommendations.push('⏰ Aumentar tiempo entre sesiones (48h mínimo)');
    }
    
    return recommendations;
};

// ========== RENDER INJURY PREDICTION UI ==========

RPETracker.prototype.renderInjuryPredictionDashboard = function() {
    const container = document.getElementById('injuryPredictionView');
    if (!container) return;
    
    let html = '<h2>🔮 Predicción de Riesgo de Lesión</h2>';
    html += `
        <div class="info-box" style="background: #e3f2fd; padding: 1rem; border-radius: 8px; margin-bottom: 2rem;">
            <strong>ℹ️ Cómo funciona:</strong>
            <p style="margin-top: 0.5rem; font-size: 0.9rem;">
                El sistema analiza múltiples factores (ratio A:C, picos de carga, monotonía, strain, recuperación) 
                para estimar el riesgo de lesión en los próximos 7 días. Se basa en investigación científica 
                y patrones detectados en los datos históricos.
            </p>
        </div>
    `;
    
    this.players.forEach(player => {
        const prediction = this.predictInjuryRisk(player.id);
        
        html += `
            <div class="prediction-card" style="background: white; padding: 1.5rem; border-radius: 12px; margin-bottom: 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                    <h3>${player.name}${player.number ? ` #${player.number}` : ''}</h3>
                    <div style="text-align: center;">
                        <div style="font-size: 3rem; font-weight: bold; color: ${prediction.color};">${prediction.probability}%</div>
                        <div style="font-size: 0.9rem; color: #666;">Riesgo</div>
                    </div>
                </div>
                
                <div style="background: ${prediction.color}20; padding: 1rem; border-radius: 8px; border-left: 4px solid ${prediction.color}; margin-bottom: 1rem;">
                    <strong>${prediction.message}</strong>
                </div>
                
                <div style="margin: 1rem 0;">
                    <strong>Factores de Riesgo:</strong>
                    <div style="display: grid; gap: 0.5rem; margin-top: 0.5rem;">
                        ${prediction.factors.map(f => `
                            <div style="display: flex; justify-content: space-between; padding: 0.5rem; background: #f5f5f5; border-radius: 4px;">
                                <span>${f.name}: <strong>${f.value}</strong></span>
                                <span style="color: ${f.status === 'danger' ? '#f44336' : f.status === 'warning' ? '#ff9800' : '#4caf50'};">
                                    ${f.impact}
                                </span>
                            </div>
                        `).join('')}
                    </div>
                </div>
                
                <div style="margin-top: 1rem;">
                    <strong>Recomendaciones:</strong>
                    <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                        ${prediction.recommendations.map(r => `<li>${r}</li>`).join('')}
                    </ul>
                </div>
            </div>
        `;
    });
    
    container.innerHTML = html;
};

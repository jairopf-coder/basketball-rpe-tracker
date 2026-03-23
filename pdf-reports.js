// Basketball RPE Tracker - PDF Reports & Export Graphics

// ========== EXPORT CHART AS IMAGE ==========

RPETracker.prototype.exportChartAsImage = function(canvasId, filename) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        alert('❌ Gráfico no encontrado');
        return;
    }
    
    try {
        // Convert canvas to blob
        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename || `grafico_${Date.now()}.png`;
            link.click();
            URL.revokeObjectURL(url);
            this.showToast('📸 Gráfico descargado');
        });
    } catch (error) {
        alert('❌ Error al exportar gráfico: ' + error.message);
    }
};

RPETracker.prototype.exportAllCharts = function() {
    this.players.forEach((player, index) => {
        setTimeout(() => {
            const canvasId = `chart-${player.id}`;
            const filename = `grafico_${player.name.replace(/\s+/g, '_')}_${Date.now()}.png`;
            this.exportChartAsImage(canvasId, filename);
        }, index * 500); // Stagger downloads
    });
};

// ========== PDF REPORT GENERATION ==========

RPETracker.prototype.generatePDFReport = function(playerId, reportType = 'weekly') {
    const player = this.players.find(p => p.id === playerId);
    if (!player) {
        alert('❌ Jugadora no encontrada');
        return;
    }
    
    const report = this.buildReportData(playerId, reportType);
    const html = this.buildReportHTML(player, report, reportType);
    
    // Create printable window
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    
    // Auto print
    setTimeout(() => {
        printWindow.print();
    }, 500);
    
    this.showToast(`📄 Informe ${reportType} de ${player.name} generado`);
};

RPETracker.prototype.buildReportData = function(playerId, reportType) {
    const now = new Date();
    let startDate;
    
    switch(reportType) {
        case 'weekly':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
            break;
        case 'monthly':
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 30);
            break;
        case 'seasonal':
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 3);
            break;
        default:
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 7);
    }
    
    const playerSessions = this.sessions
        .filter(s => s.playerId === playerId && new Date(s.date) >= startDate)
        .sort((a, b) => new Date(a.date) - new Date(b.date));
    
    const ratio = this.calculateAcuteChronicRatio(playerId);
    const advancedStats = this.calculateAdvancedStats ? this.calculateAdvancedStats(playerId) : {};
    const temporal = this.renderTemporalComparison ? this.renderTemporalComparison(playerId) : {};
    
    const totalLoad = playerSessions.reduce((sum, s) => sum + (s.load || (s.rpe * (s.duration || 60))), 0);
    const avgRPE = playerSessions.length > 0
        ? playerSessions.reduce((sum, s) => sum + s.rpe, 0) / playerSessions.length
        : 0;
    
    const trainingCount = playerSessions.filter(s => s.type === 'training').length;
    const matchCount = playerSessions.filter(s => s.type === 'match').length;
    
    return {
        sessions: playerSessions,
        totalSessions: playerSessions.length,
        totalLoad,
        avgRPE: avgRPE.toFixed(1),
        trainingCount,
        matchCount,
        ratio,
        advancedStats,
        temporal,
        startDate,
        endDate: now
    };
};

RPETracker.prototype.buildReportHTML = function(player, report, reportType) {
    const reportTitle = {
        'weekly': 'Semanal',
        'monthly': 'Mensual',
        'seasonal': 'Trimestral'
    }[reportType] || 'Semanal';
    
    return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Informe ${reportTitle} - ${player.name}</title>
    <style>
        @media print {
            @page { margin: 2cm; }
        }
        body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
        }
        .header {
            text-align: center;
            border-bottom: 3px solid #ff6600;
            padding-bottom: 20px;
            margin-bottom: 30px;
        }
        .header h1 {
            color: #ff6600;
            margin: 0;
        }
        .header .subtitle {
            color: #666;
            font-size: 1.2em;
            margin-top: 10px;
        }
        .header .date-range {
            color: #999;
            font-size: 0.9em;
            margin-top: 5px;
        }
        .section {
            margin-bottom: 30px;
            page-break-inside: avoid;
        }
        .section h2 {
            color: #ff6600;
            border-bottom: 2px solid #eee;
            padding-bottom: 10px;
        }
        .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-box {
            padding: 15px;
            border: 2px solid #eee;
            border-radius: 8px;
            text-align: center;
        }
        .stat-value {
            font-size: 2em;
            font-weight: bold;
            color: #ff6600;
        }
        .stat-label {
            color: #666;
            font-size: 0.9em;
            margin-top: 5px;
        }
        .alert-box {
            padding: 15px;
            border-radius: 8px;
            margin: 15px 0;
        }
        .alert-danger {
            background: #ffebee;
            border: 2px solid #f44336;
            color: #c62828;
        }
        .alert-warning {
            background: #fff3e0;
            border: 2px solid #ff9800;
            color: #ef6c00;
        }
        .alert-success {
            background: #e8f5e9;
            border: 2px solid #4caf50;
            color: #2e7d32;
        }
        .alert-info {
            background: #e3f2fd;
            border: 2px solid #2196f3;
            color: #1565c0;
        }
        .sessions-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
        }
        .sessions-table th,
        .sessions-table td {
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #eee;
        }
        .sessions-table th {
            background: #f5f5f5;
            font-weight: bold;
        }
        .footer {
            margin-top: 50px;
            padding-top: 20px;
            border-top: 2px solid #eee;
            text-align: center;
            color: #999;
            font-size: 0.9em;
        }
        .recommendation {
            background: #fff9e6;
            border-left: 4px solid #ff9800;
            padding: 15px;
            margin: 15px 0;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🏀 Informe ${reportTitle}</h1>
        <div class="subtitle">${player.name}${player.number ? ` #${player.number}` : ''}</div>
        <div class="date-range">
            ${report.startDate.toLocaleDateString('es-ES')} - ${report.endDate.toLocaleDateString('es-ES')}
        </div>
    </div>

    <div class="section">
        <h2>📊 Resumen General</h2>
        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-value">${report.totalSessions}</div>
                <div class="stat-label">Total Sesiones</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${report.avgRPE}</div>
                <div class="stat-label">RPE Medio</div>
            </div>
            <div class="stat-box">
                <div class="stat-value">${report.totalLoad}</div>
                <div class="stat-label">Carga Total</div>
            </div>
            <div class="stat-box">
                <div class="stat-value" style="color: ${this.getRatioColor(report.ratio.ratio)}">${report.ratio.ratio}</div>
                <div class="stat-label">Ratio A:C</div>
            </div>
        </div>
        
        <div class="stats-grid">
            <div class="stat-box">
                <div class="stat-value" style="color: #0066ff">${report.trainingCount}</div>
                <div class="stat-label">Entrenamientos</div>
            </div>
            <div class="stat-box">
                <div class="stat-value" style="color: #ff6600">${report.matchCount}</div>
                <div class="stat-label">Partidos</div>
            </div>
        </div>
    </div>

    ${this.buildRatioAlert(report.ratio)}
    ${this.buildRecommendationsSection(report)}
    ${this.buildAdvancedStatsSection(report.advancedStats)}
    ${this.buildSessionsTable(report.sessions)}

    <div class="footer">
        <p>Generado el ${new Date().toLocaleString('es-ES')}</p>
        <p>Basketball RPE Tracker - Método EWMA Científico</p>
    </div>
</body>
</html>
    `;
};

RPETracker.prototype.buildRatioAlert = function(ratio) {
    if (ratio.ratio === 'N/A') {
        return `<div class="alert-box alert-info">ℹ️ Sin datos suficientes para calcular ratio A:C</div>`;
    }
    
    const r = parseFloat(ratio.ratio);
    let alertClass, icon, message;
    
    if (r > 1.5) {
        alertClass = 'alert-danger';
        icon = '🚨';
        message = `ALERTA ALTA - Ratio A:C de ${ratio.ratio} indica alto riesgo de lesión. Se recomienda reducir carga inmediatamente.`;
    } else if (r > 1.3) {
        alertClass = 'alert-warning';
        icon = '⚠️';
        message = `PRECAUCIÓN - Ratio A:C de ${ratio.ratio}. Monitorizar de cerca y considerar reducción de carga.`;
    } else if (r < 0.8) {
        alertClass = 'alert-info';
        icon = 'ℹ️';
        message = `DESCARGA - Ratio A:C de ${ratio.ratio}. Puede estar perdiendo condición. Considerar aumento progresivo de carga.`;
    } else {
        alertClass = 'alert-success';
        icon = '✅';
        message = `ÓPTIMO - Ratio A:C de ${ratio.ratio}. Zona de adaptación positiva. Continuar con planificación actual.`;
    }
    
    return `
        <div class="section">
            <h2>⚡ Estado Actual</h2>
            <div class="alert-box ${alertClass}">
                <strong>${icon} ${message}</strong>
            </div>
        </div>
    `;
};

RPETracker.prototype.buildRecommendationsSection = function(report) {
    const recommendation = this.getLoadRecommendation ? 
        this.getLoadRecommendation(report.ratio.playerId) : null;
    
    if (!recommendation) return '';
    
    return `
        <div class="section">
            <h2>💡 Recomendaciones</h2>
            <div class="recommendation">
                <p><strong>${recommendation.message}</strong></p>
                <p>${recommendation.advice || ''}</p>
                <p style="margin-top: 10px;">
                    <strong>Próxima sesión sugerida:</strong><br>
                    RPE: ${recommendation.suggestedRPE} | 
                    Duración: ${recommendation.suggestedDuration} min | 
                    Carga objetivo: ~${recommendation.suggestedLoad} unidades
                </p>
            </div>
        </div>
    `;
};

RPETracker.prototype.buildAdvancedStatsSection = function(stats) {
    if (!stats || Object.keys(stats).length === 0) return '';
    
    return `
        <div class="section">
            <h2>📈 Estadísticas Avanzadas</h2>
            <div class="stats-grid">
                ${stats.monotony ? `
                    <div class="stat-box">
                        <div class="stat-value">${stats.monotony}</div>
                        <div class="stat-label">Monotonía</div>
                    </div>
                ` : ''}
                ${stats.strain ? `
                    <div class="stat-box">
                        <div class="stat-value">${stats.strain}</div>
                        <div class="stat-label">Strain</div>
                    </div>
                ` : ''}
                ${stats.weeklyLoad ? `
                    <div class="stat-box">
                        <div class="stat-value">${stats.weeklyLoad}</div>
                        <div class="stat-label">Carga Semanal</div>
                    </div>
                ` : ''}
            </div>
            <p style="color: #666; font-size: 0.9em; margin-top: 10px;">
                <strong>Monotonía:</strong> Relación entre carga media y variabilidad. Valores bajos (&lt;2) indican buena variedad de entrenamientos.<br>
                <strong>Strain:</strong> Carga semanal × monotonía. Valores muy altos pueden indicar riesgo.
            </p>
        </div>
    `;
};

RPETracker.prototype.buildSessionsTable = function(sessions) {
    if (sessions.length === 0) return '';
    
    const rows = sessions.map(s => `
        <tr>
            <td>${new Date(s.date).toLocaleDateString('es-ES')}</td>
            <td>${s.type === 'training' ? '🏀 Entrenamiento' : '🏟️ Partido'}</td>
            <td>${s.timeOfDay === 'morning' ? '☀️ Mañana' : '🌙 Tarde'}</td>
            <td style="text-align: center; font-weight: bold; color: ${this.getRPEColor(s.rpe)}">${s.rpe}</td>
            <td style="text-align: center;">${s.duration || 60}</td>
            <td style="text-align: center; font-weight: bold;">${s.load || (s.rpe * (s.duration || 60))}</td>
            <td style="max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${s.notes || '-'}</td>
        </tr>
    `).join('');
    
    return `
        <div class="section">
            <h2>📋 Detalle de Sesiones</h2>
            <table class="sessions-table">
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th>Momento</th>
                        <th style="text-align: center;">RPE</th>
                        <th style="text-align: center;">Duración</th>
                        <th style="text-align: center;">Carga</th>
                        <th>Incidencias</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
        </div>
    `;
};

// ========== TEAM PDF REPORT ==========

RPETracker.prototype.generateTeamPDFReport = function(reportType = 'weekly') {
    const summary = this.getWeeklySummary ? this.getWeeklySummary() : {};
    const html = this.buildTeamReportHTML(summary, reportType);
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(html);
    printWindow.document.close();
    
    setTimeout(() => {
        printWindow.print();
    }, 500);
    
    this.showToast(`📄 Informe de equipo generado`);
};

RPETracker.prototype.buildTeamReportHTML = function(summary, reportType) {
    // Similar structure but for all team
    // Implementation continues...
    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <title>Informe de Equipo</title>
    <style>
        /* Same styles as individual report */
    </style>
</head>
<body>
    <h1>Informe del Equipo - Basketball RPE Tracker</h1>
    <p>Total sesiones: ${summary.sessions || 0}</p>
    <p>Jugadoras en riesgo: ${summary.playersAtRisk || 0}</p>
    <!-- More team data -->
</body>
</html>`;
};

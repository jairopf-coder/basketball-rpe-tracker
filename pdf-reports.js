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

// ========== HISTORIAL COMPLETO — PDF (fix #16) ==========

RPETracker.prototype.exportSessionsHistoryPDF = function() {
    const sorted = [...this.sessions].sort((a, b) => new Date(b.date) - new Date(a.date));
    if (sorted.length === 0) {
        this.showToast('No hay sesiones que exportar', 'warning');
        return;
    }

    const typeLabel = { training:'Entrenamiento', match:'Partido', shooting:'Tiro', gym:'Gym', recovery:'Recuperación' };
    const rpeColor  = rpe => {
        const c = { 1:'#4caf50',2:'#8bc34a',3:'#cddc39',4:'#ffeb3b',5:'#ffc107',
                    6:'#ff9800',7:'#ff5722',8:'#f44336',9:'#e91e63',10:'#9c27b0' };
        return c[rpe] || '#666';
    };

    // Group by player for summary at top
    const summaryRows = this.players.map(p => {
        const ps = sorted.filter(s => s.playerId === p.id);
        if (!ps.length) return null;
        const avgRPE = (ps.reduce((s,x)=>s+x.rpe,0)/ps.length).toFixed(1);
        const totalLoad = ps.reduce((s,x)=>s+(x.load||x.rpe*(x.duration||60)),0);
        const ratio = this.calculateAcuteChronicRatio(p.id);
        const ratioCol = this.getRatioColor(ratio.ratio);
        return `<tr>
            <td><strong>${p.name}</strong>${p.number?` #${p.number}`:''}</td>
            <td style="text-align:center">${ps.length}</td>
            <td style="text-align:center">${avgRPE}</td>
            <td style="text-align:center">${totalLoad.toLocaleString('es-ES')}</td>
            <td style="text-align:center;color:${ratioCol};font-weight:700">${ratio.ratio}</td>
        </tr>`;
    }).filter(Boolean).join('');

    const sessionRows = sorted.map(s => {
        const player = this.players.find(p => p.id === s.playerId);
        const pName = player ? player.name + (player.number ? ` #${player.number}` : '') : '—';
        const load = s.load || (s.rpe * (s.duration || 60));
        const date = new Date(s.date).toLocaleDateString('es-ES', { day:'2-digit', month:'short', year:'numeric' });
        const time = s.timeOfDay === 'morning' ? 'Mañana' : 'Tarde';
        return `<tr>
            <td>${date}</td>
            <td>${time}</td>
            <td><strong>${pName}</strong></td>
            <td>${typeLabel[s.type]||s.type}</td>
            <td style="text-align:center;font-weight:700;color:${rpeColor(s.rpe)}">${s.rpe}</td>
            <td style="text-align:center">${s.duration||60}</td>
            <td style="text-align:center;font-weight:600">${load.toLocaleString('es-ES')}</td>
            <td style="font-size:0.85em;color:#555">${s.notes||''}</td>
        </tr>`;
    }).join('');

    const now = new Date();
    const html = `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<title>Historial de Sesiones — ${now.toLocaleDateString('es-ES')}</title>
<style>
  @media print { @page { margin: 1.5cm; size: A4 landscape; } }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #222; margin: 0; padding: 16px; }
  h1 { color: #ff6600; margin: 0 0 4px; font-size: 18px; }
  .subtitle { color: #666; font-size: 12px; margin-bottom: 20px; }
  h2 { color: #ff6600; border-bottom: 2px solid #eee; padding-bottom: 4px; font-size: 13px; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
  th { background: #f5f5f5; font-weight: 700; padding: 6px 8px; text-align: left; border-bottom: 2px solid #ddd; font-size: 10px; text-transform: uppercase; }
  td { padding: 5px 8px; border-bottom: 1px solid #eee; vertical-align: top; }
  tr:hover { background: #fafafa; }
  .footer { margin-top: 30px; border-top: 1px solid #ddd; padding-top: 10px; color: #999; font-size: 10px; text-align: center; }
</style>
</head>
<body>
  <h1>🏀 Historial de Sesiones</h1>
  <div class="subtitle">Exportado el ${now.toLocaleString('es-ES')} · ${sorted.length} sesiones · ${this.players.length} jugadoras</div>

  <h2>📊 Resumen por jugadora</h2>
  <table>
    <thead><tr>
      <th>Jugadora</th><th style="text-align:center">Sesiones</th>
      <th style="text-align:center">RPE medio</th><th style="text-align:center">Carga total</th>
      <th style="text-align:center">Ratio A:C</th>
    </tr></thead>
    <tbody>${summaryRows}</tbody>
  </table>

  <h2>📋 Todas las sesiones</h2>
  <table>
    <thead><tr>
      <th>Fecha</th><th>Momento</th><th>Jugadora</th><th>Tipo</th>
      <th style="text-align:center">RPE</th><th style="text-align:center">Min</th>
      <th style="text-align:center">Carga</th><th>Incidencias</th>
    </tr></thead>
    <tbody>${sessionRows}</tbody>
  </table>

  <div class="footer">Basketball RPE Tracker · Método EWMA · Generado ${now.toLocaleString('es-ES')}</div>
</body>
</html>`;

    const win = window.open('', '_blank');
    win.document.write(html);
    win.document.close();
    setTimeout(() => win.print(), 400);
    this.showToast('📄 Historial exportado a PDF', 'success');
};

// Menú de exportación del jugador (añade opción historial)
RPETracker.prototype.showPlayerReportMenu = function(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    // Remove existing menu
    document.getElementById('reportMenuOverlay')?.remove();

    const overlay = document.createElement('div');
    overlay.id = 'reportMenuOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.4);z-index:1000;display:flex;align-items:center;justify-content:center';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div style="background:var(--bg-card);border-radius:16px;padding:1.5rem;min-width:280px;box-shadow:0 8px 32px rgba(0,0,0,0.25)">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
                <h3 style="margin:0;font-size:1rem">📄 Informe — ${player.name}</h3>
                <button onclick="document.getElementById('reportMenuOverlay').remove()"
                    style="background:none;border:none;font-size:1.25rem;cursor:pointer;color:var(--text-secondary)">✕</button>
            </div>
            <div style="display:flex;flex-direction:column;gap:0.6rem">
                <button onclick="window.rpeTracker.generatePDFReport('${playerId}','weekly');document.getElementById('reportMenuOverlay').remove()"
                    style="padding:0.7rem 1rem;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-subtle);cursor:pointer;text-align:left;font-size:0.9rem">
                    📅 Informe semanal
                </button>
                <button onclick="window.rpeTracker.generatePDFReport('${playerId}','monthly');document.getElementById('reportMenuOverlay').remove()"
                    style="padding:0.7rem 1rem;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-subtle);cursor:pointer;text-align:left;font-size:0.9rem">
                    📆 Informe mensual
                </button>
                <button onclick="window.rpeTracker.generatePDFReport('${playerId}','seasonal');document.getElementById('reportMenuOverlay').remove()"
                    style="padding:0.7rem 1rem;border-radius:10px;border:1.5px solid var(--border);background:var(--bg-subtle);cursor:pointer;text-align:left;font-size:0.9rem">
                    📊 Informe trimestral
                </button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
};

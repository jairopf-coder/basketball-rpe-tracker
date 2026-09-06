// Basketball RPE Tracker - UI Helpers & Utilities

// NOTE: showPlayerReportMenu → superseded by pdf-reports.js (better implementation)

// ========== TEMPLATE MANAGEMENT UI ==========

RPETracker.prototype.showTemplateManager = function() {
    if (!this.templates) this.templates = [];

    // Evitar duplicados en DOM
    const MODAL_ID = 'templateManagerModal';
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    const labelId = 'templateManagerTitle';

    let templatesHTML = this.templates.length > 0
        ? this.templates.map(t => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f5f5f5; border-radius: 8px; margin-bottom: 0.5rem;">
                <div>
                    <strong>${esc(t.name)}</strong><br>
                    <small style="color: var(--gray);">
                        RPE ${t.rpe} | ${t.duration}min | ${t.type === 'training' ? '🏀 Entrenamiento' : '🏟️ Partido'} |
                        ${t.timeOfDay === 'morning' ? '☀️ Mañana' : '🌙 Tarde'}
                    </small>
                </div>
                <div style="display: flex; gap: 0.5rem;">
                    <button onclick="window.rpeTracker?.applyTemplate('${t.id}'); document.getElementById('${MODAL_ID}')?.remove();"
                            class="btn-secondary" style="padding: 0.5rem 1rem;">
                        ✅ Usar
                    </button>
                    <button onclick="window.rpeTracker?.deleteTemplate('${t.id}'); window.rpeTracker?.showTemplateManager();"
                            class="btn-danger" style="padding: 0.5rem 1rem;">
                        🗑️
                    </button>
                </div>
            </div>
        `).join('')
        : '<p style="text-align: center; color: var(--gray);">No hay plantillas guardadas</p>';

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', labelId);
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="${labelId}">📋 Plantillas de Sesión</h2>
                <button onclick="document.getElementById('${MODAL_ID}')?.remove()" class="btn-close" aria-label="Cerrar">&times;</button>
            </div>
            <div style="padding: 1.5rem;">
                ${templatesHTML}
                <button onclick="window.rpeTracker?.createTemplate(); window.rpeTracker?.showTemplateManager();"
                        class="btn-primary" style="width: 100%; margin-top: 1rem;">
                    + Crear Nueva Plantilla
                </button>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const ftRelease = trapFocus(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) { ftRelease(); modal.remove(); }
    });

    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { ftRelease(); modal.remove(); }
    });
};

RPETracker.prototype.deleteTemplate = function(templateId) {
    AppConfirm.show({title:'¿Eliminar plantilla?',message:'Esta acción no se puede deshacer.',confirmText:'Eliminar',danger:true}).then(ok=>{ if(!ok) return;
    
    this.templates = this.templates.filter(t => t.id !== templateId);
    this.saveTemplates();
    this.showToast('🗑️ Plantilla eliminada');
    });
};

// ========== ADVANCED STATS PANEL ==========

RPETracker.prototype.showAdvancedStatsPanel = function(playerId) {
    const player = this.players.find(p => p.id === playerId);
    if (!player) return;

    const stats      = this.calculateAdvancedStats ? this.calculateAdvancedStats(playerId) : {};
    const temporal   = this.renderTemporalComparison ? this.renderTemporalComparison(playerId) : {};
    const prediction = this.predictInjuryRisk ? this.predictInjuryRisk(playerId) : null;

    // Evitar duplicados en DOM
    const MODAL_ID = 'advancedStatsPanelModal';
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    const labelId = 'advancedStatsPanelTitle';

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', labelId);
    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <h2 id="${labelId}">📊 Estadísticas Avanzadas - ${esc(player.name)}</h2>
                <button onclick="document.getElementById('${MODAL_ID}')?.remove()" class="btn-close" aria-label="Cerrar">&times;</button>
            </div>
            <div style="padding: 1.5rem; max-height: 70vh; overflow-y: auto;">
                
                ${stats.monotony ? `
                    <div class="section">
                        <h3>📈 Métricas Avanzadas (Última Semana)</h3>
                        <div class="stats-grid">
                            <div class="stat-card">
                                <span class="stat-value">${stats.monotony}</span>
                                <span class="stat-label">Monotonía</span>
                                <small style="display: block; color: var(--gray); margin-top: 0.5rem;">
                                    ${parseFloat(stats.monotony) > 2 ? '⚠️ Alta variabilidad necesaria' : '✅ Buena variedad'}
                                </small>
                            </div>
                            <div class="stat-card">
                                <span class="stat-value">${stats.strain}</span>
                                <span class="stat-label">Strain</span>
                            </div>
                            <div class="stat-card">
                                <span class="stat-value">${stats.weeklyLoad}</span>
                                <span class="stat-label">Carga Semanal</span>
                            </div>
                        </div>
                    </div>
                ` : ''}
                
                ${temporal.thisWeek ? `
                    <div class="section">
                        <h3>📊 Comparación Temporal</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
                            <div style="padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                                <h4>Esta Semana</h4>
                                <p>Sesiones: ${temporal.thisWeek.sessions}</p>
                                <p>Carga: ${temporal.thisWeek.load}</p>
                                <p>RPE medio: ${temporal.thisWeek.avgRPE}</p>
                            </div>
                            <div style="padding: 1rem; background: #f5f5f5; border-radius: 8px;">
                                <h4>Semana Anterior</h4>
                                <p>Sesiones: ${temporal.lastWeek.sessions}</p>
                                <p>Carga: ${temporal.lastWeek.load}</p>
                                <p>RPE medio: ${temporal.lastWeek.avgRPE}</p>
                            </div>
                        </div>
                        <div style="margin-top: 1rem; padding: 1rem; background: ${parseFloat(temporal.changes.load) > 0 ? '#fff3e0' : '#e8f5e9'}; border-radius: 8px;">
                            <strong>Cambios:</strong><br>
                            Carga: ${temporal.changes.load > 0 ? '↑' : '↓'} ${Math.abs(temporal.changes.load)}%<br>
                            RPE: ${temporal.changes.rpe > 0 ? '↑' : '↓'} ${Math.abs(temporal.changes.rpe)}%<br>
                            Sesiones: ${temporal.changes.sessions > 0 ? '+' : ''}${temporal.changes.sessions}
                        </div>
                    </div>
                ` : ''}
                
                ${prediction ? `
                    <div class="section">
                        <h3>🔮 Predicción de Lesión</h3>
                        <div style="background: ${prediction.color}20; padding: 1rem; border-radius: 8px; border-left: 4px solid ${prediction.color};">
                            <div style="font-size: 2rem; font-weight: bold; color: ${prediction.color}; margin-bottom: 0.5rem;">
                                ${prediction.probability}% Riesgo
                            </div>
                            <p><strong>${prediction.message}</strong></p>
                        </div>
                    </div>
                ` : ''}
                
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const ftRelease = trapFocus(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) { ftRelease(); modal.remove(); }
    });

    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { ftRelease(); modal.remove(); }
    });
};

// ========== QUICK ACTIONS ==========

RPETracker.prototype.showQuickActions = function() {
    const MODAL_ID = 'quickActionsModal';
    const existing = document.getElementById(MODAL_ID);
    if (existing) existing.remove();

    const labelId = 'quickActionsTitle';

    const modal = document.createElement('div');
    modal.className = 'modal active';
    modal.id = MODAL_ID;
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', labelId);
    modal.innerHTML = `
        <div class="modal-content modal-small">
            <div class="modal-header">
                <h2 id="${labelId}">⚡ Acciones Rápidas</h2>
                <button onclick="document.getElementById('${MODAL_ID}')?.remove()" class="btn-close" aria-label="Cerrar">&times;</button>
            </div>
            <div style="padding: 1.5rem;">
                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                    <button onclick="window.rpeTracker?.showTemplateManager(); document.getElementById('${MODAL_ID}')?.remove();"
                            class="btn-primary" style="width: 100%;">
                        📋 Gestionar Plantillas
                    </button>
                    <button onclick="window.rpeTracker?.exportAllCharts(); document.getElementById('${MODAL_ID}')?.remove();"
                            class="btn-primary" style="width: 100%;">
                        📸 Exportar Todos los Gráficos
                    </button>
                    <button onclick="window.rpeTracker?.generateTeamPDFReport('weekly'); document.getElementById('${MODAL_ID}')?.remove();"
                            class="btn-primary" style="width: 100%;">
                        📄 Informe Semanal del Equipo
                    </button>
                    <button onclick="window.rpeTracker?.showTestsReportMenu(); document.getElementById('${MODAL_ID}')?.remove();"
                            class="btn-primary" style="width: 100%;">
                        📊 Informe de Tests Físicos
                    </button>
                    <button onclick="window.rpeTracker?.downloadBackup(); document.getElementById('${MODAL_ID}')?.remove();"
                            class="btn-primary" style="width: 100%;">
                        💾 Descargar Backup
                    </button>
                    <button onclick="document.getElementById('restoreFile').click(); document.getElementById('${MODAL_ID}')?.remove();"
                            class="btn-secondary" style="width: 100%;">
                        📂 Restaurar Backup
                    </button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);

    const ftRelease = trapFocus(modal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) { ftRelease(); modal.remove(); }
    });

    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { ftRelease(); modal.remove(); }
    });
};

// Add template button to new session modal
document.addEventListener('DOMContentLoaded', () => {
    const sessionForm = document.getElementById('sessionForm');
    if (sessionForm && typeof rpeTracker !== 'undefined') {
        const templateBtn = document.createElement('button');
        templateBtn.type = 'button';
        templateBtn.className = 'btn-secondary';
        templateBtn.textContent = '📋 Usar Plantilla';
        templateBtn.style.marginTop = '1rem';
        templateBtn.onclick = () => {
            if (rpeTracker.showTemplateManager) {
                rpeTracker.showTemplateManager();
            }
        };
        
        // Find form and add button before submit buttons
        const formGroups = sessionForm.querySelectorAll('.form-group');
        if (formGroups.length > 0) {
            const lastGroup = formGroups[formGroups.length - 1];
            const templateBtnContainer = document.createElement('div');
            templateBtnContainer.style.textAlign = 'center';
            templateBtnContainer.appendChild(templateBtn);
            lastGroup.parentNode.insertBefore(templateBtnContainer, lastGroup.nextSibling);
        }
    }
});

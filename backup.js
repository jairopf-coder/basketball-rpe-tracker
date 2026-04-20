// Backup, Restore & Season Management

// ─── Gear menu (replaces scattered header buttons) ───────────────────────────

RPETracker.prototype.showGearMenu = function() {
    document.getElementById('gearMenuOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'gearMenuOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;z-index:2000';
    overlay.onclick = e => { if (e.target === overlay) overlay.remove(); };

    overlay.innerHTML = `
        <div class="gear-dropdown" id="gearDropdown">
            <div class="gear-section-label">Datos</div>
            <button class="gear-item" onclick="window.rpeTracker?.downloadBackup();document.getElementById('gearMenuOverlay').remove()">
                <span class="gear-icon">💾</span><span>Backup completo</span>
            </button>
            <button class="gear-item" onclick="document.getElementById('restoreFile').click();document.getElementById('gearMenuOverlay').remove()">
                <span class="gear-icon">📂</span><span>Restaurar backup</span>
            </button>
            <button class="gear-item" onclick="window.rpeTracker?.exportData();document.getElementById('gearMenuOverlay').remove()">
                <span class="gear-icon">📥</span><span>Exportar CSV</span>
            </button>
            <button class="gear-item" onclick="window.rpeTracker?.exportSessionsHistoryPDF();document.getElementById('gearMenuOverlay').remove()">
                <span class="gear-icon">📄</span><span>PDF sesiones</span>
            </button>
            <div class="gear-divider"></div>
            <div class="gear-section-label">Temporada</div>
            <button class="gear-item" onclick="document.getElementById('gearMenuOverlay').remove();window.rpeTracker?.exportSeasonAndClear()">
                <span class="gear-icon">🗂️</span><span>Exportar temporada y borrar datos</span>
            </button>
            <button class="gear-item" onclick="document.getElementById('seasonFileInput').click();document.getElementById('gearMenuOverlay').remove()">
                <span class="gear-icon">📅</span><span>Ver temporada anterior</span>
            </button>
            <div class="gear-divider"></div>
            <div class="gear-section-label">Acceso</div>
            <button class="gear-item" onclick="AppAuth.showPinSettings();document.getElementById('gearMenuOverlay').remove()">
                <span class="gear-icon">🔑</span><span>Gestionar PINs</span>
            </button>
            <button class="gear-item gear-item--danger" onclick="AppAuth.logout();document.getElementById('gearMenuOverlay').remove()">
                <span class="gear-icon">🔒</span><span>Salir / Bloquear</span>
            </button>
        </div>`;

    document.body.appendChild(overlay);

    // Position dropdown below gear button
    requestAnimationFrame(() => {
        const btn = document.getElementById('gearBtn');
        const dd  = document.getElementById('gearDropdown');
        if (btn && dd) {
            const r = btn.getBoundingClientRect();
            dd.style.top  = (r.bottom + 6) + 'px';
            dd.style.right = (window.innerWidth - r.right) + 'px';
        }
    });
};

// ─── Backup ──────────────────────────────────────────────────────────────────

RPETracker.prototype.showBackupMenu = function() { this.showGearMenu(); };

RPETracker.prototype.downloadBackup = function() {
    const backup = {
        version: '3.0',
        exportDate: new Date().toISOString(),
        players:     this.players     || [],
        sessions:    this.sessions    || [],
        wellnessData: this.wellnessData || [],
        injuries:    this.injuries    || [],
        weekPlan:    this.weekPlan    || null
    };
    const now = new Date();
    const fn = `RPE_Backup_${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}.json`;
    this._downloadJSON(backup, fn);
    this.showToast('💾 Backup descargado');
};

RPETracker.prototype.restoreBackup = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.players || !backup.sessions) { alert('❌ Archivo de backup inválido'); return; }
            if (confirm(`¿Restaurar backup del ${new Date(backup.exportDate).toLocaleDateString('es-ES')}?\n\n⚠️ Esto REEMPLAZARÁ todos los datos actuales.`)) {
                this.players      = backup.players;
                this.sessions     = backup.sessions;
                this.wellnessData = backup.wellnessData || [];
                this.injuries     = backup.injuries     || [];
                if (backup.weekPlan) this.weekPlan = backup.weekPlan;
                this.savePlayers(); this.saveSessions(); this.saveWellnessData(); this.saveInjuries();
                this.showToast('✅ Datos restaurados correctamente');
                setTimeout(() => location.reload(), 1500);
            }
        } catch (err) { alert('❌ Error al leer el archivo: ' + err.message); }
    };
    reader.readAsText(file);
    event.target.value = '';
};

// ─── Export Season + Clear (with math challenge) ─────────────────────────────

RPETracker.prototype.exportSeasonAndClear = function() {
    const a = Math.floor(Math.random() * 20) + 5;
    const b = Math.floor(Math.random() * 20) + 5;
    const answer = a + b;

    const overlay = document.createElement('div');
    overlay.id = 'clearConfirmOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.6);z-index:3000;display:flex;align-items:center;justify-content:center';

    overlay.innerHTML = `
        <div class="clear-confirm-modal">
            <div class="clear-confirm-icon">⚠️</div>
            <h2 class="clear-confirm-title">Nueva temporada</h2>
            <p class="clear-confirm-desc">
                Se descargará un backup completo con todos los datos de esta temporada.<br>
                Después se borrarán <strong>sesiones, wellness y lesiones</strong>.<br>
                Las jugadoras del roster se mantienen.
            </p>
            <div class="clear-confirm-challenge">
                <span class="clear-challenge-label">Para confirmar, resuelve:</span>
                <span class="clear-challenge-sum">${a} + ${b} = ?</span>
                <input type="number" id="clearChallengeInput" class="clear-challenge-input"
                    placeholder="Resultado" autocomplete="off" inputmode="numeric">
                <span id="clearChallengeError" class="clear-challenge-error" style="display:none">Resultado incorrecto</span>
            </div>
            <div class="clear-confirm-actions">
                <button class="btn-secondary" onclick="document.getElementById('clearConfirmOverlay').remove()">Cancelar</button>
                <button class="btn-danger" onclick="window.rpeTracker?._confirmSeasonClear(${answer})">
                    🗂️ Exportar y borrar
                </button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
    setTimeout(() => document.getElementById('clearChallengeInput')?.focus(), 100);
};

RPETracker.prototype._confirmSeasonClear = function(expectedAnswer) {
    const input = document.getElementById('clearChallengeInput');
    const errorEl = document.getElementById('clearChallengeError');
    const given = parseInt(input?.value);

    if (given !== expectedAnswer) {
        if (errorEl) { errorEl.style.display = 'block'; }
        if (input)   { input.style.borderColor = '#f44336'; input.focus(); }
        return;
    }

    // Download full season backup first
    const now = new Date();
    const season = `${now.getFullYear()-1}-${now.getFullYear()}`;
    const backup = {
        version: '3.0',
        type: 'season-archive',
        season,
        exportDate: now.toISOString(),
        players:      this.players      || [],
        sessions:     this.sessions     || [],
        wellnessData: this.wellnessData || [],
        injuries:     this.injuries     || [],
        weekPlan:     this.weekPlan     || null
    };
    const fn = `RPE_Temporada_${season}_${String(now.getMonth()+1).padStart(2,'0')}${now.getDate()}.json`;
    this._downloadJSON(backup, fn);

    // Clear operational data
    this.sessions     = [];
    this.wellnessData = [];
    this.injuries     = [];
    this.weekPlan     = null;
    this.saveSessions();
    this.saveWellnessData();
    this.saveInjuries();
    localStorage.removeItem('basketballWeekPlan');

    document.getElementById('clearConfirmOverlay')?.remove();
    this.showToast('✅ Temporada archivada y datos borrados', 'success');
    setTimeout(() => location.reload(), 1500);
};

// ─── View past season ─────────────────────────────────────────────────────────

RPETracker.prototype.loadSeasonArchive = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.players || !data.sessions) { alert('❌ Archivo no reconocido'); return; }
            this._showSeasonViewer(data, file.name);
        } catch (err) { alert('❌ Error al leer: ' + err.message); }
    };
    reader.readAsText(file);
    event.target.value = '';
};

RPETracker.prototype._showSeasonViewer = function(data, filename) {
    document.getElementById('seasonViewerOverlay')?.remove();
    const overlay = document.createElement('div');
    overlay.id = 'seasonViewerOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:3000;display:flex;align-items:center;justify-content:center;padding:1rem';

    const exportDate = data.exportDate ? new Date(data.exportDate).toLocaleDateString('es-ES', {day:'numeric',month:'long',year:'numeric'}) : '—';
    const season = data.season || filename.replace('.json','');

    // Stats
    const totalSessions = data.sessions.length;
    const totalPlayers  = data.players.length;
    const avgRPE = totalSessions ? (data.sessions.reduce((s,x)=>s+x.rpe,0)/totalSessions).toFixed(1) : '—';
    const activeInj = (data.injuries||[]).filter(i=>i.status==='active').length;
    const wEntries = (data.wellnessData||[]).length;

    // Per-player summary
    const playerRows = data.players.map(p => {
        const ps = data.sessions.filter(s=>s.playerId===p.id);
        const load = ps.reduce((s,x)=>s+(x.load||x.rpe*(x.duration||60)),0);
        const rpe7 = ps.length ? (ps.reduce((s,x)=>s+x.rpe,0)/ps.length).toFixed(1) : '—';
        const inj = (data.injuries||[]).filter(i=>i.playerId===p.id).length;
        const wCount = (data.wellnessData||[]).filter(w=>w.playerId===p.id).length;
        return `<tr>
            <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;font-weight:500">${p.name}${p.number?` <span style="color:#aaa;font-size:11px">#${p.number}</span>`:''}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${ps.length}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;text-align:center;font-weight:600;color:#ff6600">${rpe7}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${load.toLocaleString('es-ES')}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${wCount}</td>
            <td style="padding:7px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:${inj>0?'#f44336':'#4caf50'}">${inj>0?inj:'—'}</td>
        </tr>`;
    }).join('');

    overlay.innerHTML = `
        <div class="sv-modal">
            <div class="sv-header">
                <div>
                    <div class="sv-title">📅 Temporada archivada</div>
                    <div class="sv-subtitle">${season} · Exportado ${exportDate}</div>
                </div>
                <button class="wb-close" onclick="document.getElementById('seasonViewerOverlay').remove()">✕</button>
            </div>
            <div class="sv-kpis">
                <div class="sv-kpi"><div class="sv-kpi-num">${totalPlayers}</div><div class="sv-kpi-lbl">Jugadoras</div></div>
                <div class="sv-kpi"><div class="sv-kpi-num">${totalSessions}</div><div class="sv-kpi-lbl">Sesiones</div></div>
                <div class="sv-kpi"><div class="sv-kpi-num">${avgRPE}</div><div class="sv-kpi-lbl">RPE medio</div></div>
                <div class="sv-kpi"><div class="sv-kpi-num">${wEntries}</div><div class="sv-kpi-lbl">Registros wellness</div></div>
                <div class="sv-kpi" style="border-color:${activeInj>0?'#ef9a9a':'#a5d6a7'}"><div class="sv-kpi-num" style="color:${activeInj>0?'#c62828':'#2e7d32'}">${activeInj}</div><div class="sv-kpi-lbl">Lesiones activas</div></div>
            </div>
            <div class="sv-body">
                <table style="width:100%;border-collapse:collapse;font-size:13px">
                    <thead><tr style="background:#fafafa">
                        <th style="padding:8px 12px;text-align:left;font-size:11px;color:#888;text-transform:uppercase;border-bottom:1.5px solid #eee">Jugadora</th>
                        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#888;text-transform:uppercase;border-bottom:1.5px solid #eee">Sesiones</th>
                        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#888;text-transform:uppercase;border-bottom:1.5px solid #eee">RPE med.</th>
                        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#888;text-transform:uppercase;border-bottom:1.5px solid #eee">Carga UA</th>
                        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#888;text-transform:uppercase;border-bottom:1.5px solid #eee">Wellness</th>
                        <th style="padding:8px 12px;text-align:center;font-size:11px;color:#888;text-transform:uppercase;border-bottom:1.5px solid #eee">Lesiones</th>
                    </tr></thead>
                    <tbody>${playerRows}</tbody>
                </table>
            </div>
            <div class="sv-footer">
                <span style="font-size:11px;color:#aaa">${filename}</span>
                <button class="btn-secondary" onclick="document.getElementById('seasonViewerOverlay').remove()">Cerrar</button>
            </div>
        </div>`;

    document.body.appendChild(overlay);
};

// ─── Helper ───────────────────────────────────────────────────────────────────

RPETracker.prototype._downloadJSON = function(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
};

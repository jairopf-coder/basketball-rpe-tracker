// BasketballRPE-Web — dashboard-alerts.js
// Avisos de Inicio en UNA línea plegable (antes eran hasta cinco franjas a todo el ancho).
//
//   · Plegada por defecto: «4 avisos · Peligro 2 · Precaución 1 · Wellness 1». Al tocarla se despliega la lista.
//   · «Marcar como visto por hoy»: la línea pasa a gris («Avisos vistos hoy: 4») y la lista sigue
//     disponible al tocarla. Vuelve a destacarse si aparece un aviso NUEVO o al día siguiente.
//   · La marca de «visto» se sincroniza entre dispositivos (nodo /staffAlertsSeen/{uid}, solo la
//     dueña lo lee y lo escribe) y se guarda también en el dispositivo por si no hay conexión.
//   · Los avisos NO se guardan: se calculan cada vez a partir de los datos. Solo se guarda qué
//     avisos (sus identificadores, sin nombres ni datos de wellness) estaban cuando se marcó «visto».
//
// Expone: RPETracker.prototype._renderDashAlerts / _renderDashPlanningReminder
//          RPETracker.prototype.toggleDashAlerts / markDashAlertsSeen
//          (y los auxiliares _collectDashAlerts, _dashAlertsSeenInfo, _ensureDashAlertsSync…)
// Depende de: dashboard-renderer.js (renderDashboard), security.js (esc), firebase-config.js
//             (window.firebaseDB / window.firebaseAuth), wellness.js (_wTrendAlerts)

'use strict';

const DASH_ALERTS_LS_PREFIX = 'basketballDashAlertsSeen_';
const DASH_ALERTS_MAX_KEYS_LEN = 4000;   // mismo límite que la regla de firebase-rules.json

function _dashAlertsToday() { return toLocalISODate(new Date()); }

// Un registro de «visto» válido: { date: 'YYYY-MM-DD', keys: 'id1,id2,…' }
function _dashAlertsValid(rec) {
    return !!rec && typeof rec === 'object'
        && typeof rec.date === 'string' && rec.date.length === 10
        && typeof rec.keys === 'string' && rec.keys.length <= DASH_ALERTS_MAX_KEYS_LEN;
}

// Primer nombre, SIN escapar: el escape (esc) se aplica al construir el HTML, en _renderDashAlerts
function _dashAlertsFirstName(name) { return String(name || '').split(' ')[0]; }

// ── 0. Regla ÚNICA de «alerta A:C» ───────────────────────────────────────────
// La usan la línea de avisos, el KPI «alertas A:C», la insignia de Análisis, el icono de la app y
// la notificación al guardar una sesión, para que el número sea el mismo en todas partes:
//   · alerta = jugadora en PELIGRO (ratio por encima de su umbral «alto»); la precaución se ve en
//     la tabla y en la lista de avisos, pero no cuenta como alerta;
//   · se usan los umbrales individuales de cada jugadora (getPlayerThresholds);
//   · no cuentan las que hoy no entrenan con el grupo (🏥) ni las de «datos insuficientes» (⚠️),
//     porque en la tabla no muestran ratio.
// @returns 'danger' | 'warn' | 'low' | 'ok' | 'na' (sin ratio fiable)
RPETracker.prototype._acLevel = function(ratio, playerId) {
    if (!ratio || ratio.confidence === 'low') return 'na';
    const n = parseFloat(ratio.ratio);
    if (isNaN(n)) return 'na';
    const t = this.getPlayerThresholds(playerId || null);
    if (n > t.high) return 'danger';
    if (n > t.opt)  return 'warn';
    if (n < t.low)  return 'low';
    return 'ok';
};

// ¿La jugadora hoy NO entrena con el grupo (lesión en fases 1-4 o «no disponible»)?
RPETracker.prototype._acIsOutToday = function(playerId, dateStr) {
    return typeof this.getPlayerParticipation === 'function'
        && this.getPlayerParticipation(playerId, dateStr || _dashAlertsToday()) === 'out';
};

// Número de jugadoras en peligro A:C (el mismo en KPI, insignia, icono de la app y notificación)
RPETracker.prototype._acDangerCount = function() {
    const today = _dashAlertsToday();
    return this.activePlayers.filter(p =>
        !this._acIsOutToday(p.id, today) && this._acLevel(this.calculateAcuteChronicRatio(p.id), p.id) === 'danger'
    ).length;
};

// ── 1. Reunir los avisos y darle un identificador estable a cada uno ─────────
// Identificadores: ac:d:<jugadora> (peligro), ac:w:<jugadora> (precaución),
// wt:<jugadora>:<tipo> (tendencia de wellness) y rpe:<sesión> (RPE distinto).
RPETracker.prototype._collectDashAlerts = function(data) {
    const asList = v => Array.isArray(v) ? v : [];
    const danger = asList(data.dangerPlayers).map(p => ({ key: `ac:d:${p.player.id}`, name: _dashAlertsFirstName(p.player.name) }));
    const warn   = asList(data.warnPlayers).map(p => ({ key: `ac:w:${p.player.id}`, name: _dashAlertsFirstName(p.player.name) }));
    const trend  = asList(data.trendAlerts).map(a => ({
        key: 'wt:' + (a.playerId || a.name) + ':' + (a.kind || 'x'),
        name: _dashAlertsFirstName(a.name),
        message: String(a.message || '')
    }));
    const rpe = asList(data.rpeDiscrepancies).map(d => ({
        key: `rpe:${d.sessionId}`,
        name: _dashAlertsFirstName(d.playerName),
        staffRpe: String(d.staffRpe), playerRpe: String(d.playerRpe),
        date: String(d.date || ''), sessionId: String(d.sessionId)
    }));
    const keys = [...danger, ...warn, ...trend, ...rpe].map(a => a.key);
    return {
        danger, warn, trend, rpe, keys,
        team: danger.length >= (data.teamThreshold || 3),   // 3+ jugadoras en peligro a la vez
        total: keys.length
    };
};

// ── 2. ¿Ya estaban vistos? ────────────────────────────────────────────────────
// seen: todos los avisos actuales estaban cuando se marcó «visto» (hoy).
// Si uno desaparece (se resuelve) no cuenta como nuevo; si aparece uno distinto, sí.
RPETracker.prototype._dashAlertsSeenInfo = function(keys) {
    const rec = this._dashAlertsSeen;
    if (!_dashAlertsValid(rec) || rec.date !== _dashAlertsToday()) {
        return { seen: false, newCount: keys.length, partial: false };
    }
    const before = new Set(rec.keys.split(',').filter(Boolean));
    const fresh = keys.filter(k => !before.has(k));
    return { seen: fresh.length === 0, newCount: fresh.length, partial: fresh.length > 0 && fresh.length < keys.length };
};

// ── 3. Pintar la línea plegable ───────────────────────────────────────────────
RPETracker.prototype._renderDashAlerts = function(data) {
    this._ensureDashAlertsSync();
    const a = this._collectDashAlerts(data || {});
    this._lastDashAlertKeys = a.keys;          // los usa «Marcar como visto»
    if (a.total === 0) return '';

    const info = this._dashAlertsSeenInfo(a.keys);
    const open = !!this._dashAlertsOpen;

    let title;
    if (info.seen) title = `Avisos vistos hoy: ${a.total}`;
    else {
        title = a.total === 1 ? '1 aviso' : `${a.total} avisos`;
        if (info.partial) title += ` · ${info.newCount} ${info.newCount === 1 ? 'nuevo' : 'nuevos'}`;
    }

    const chips = [
        a.danger.length ? `<span class="db-alerts-chip" title="Jugadoras en peligro A:C"><span class="wh-bad" aria-hidden="true">●</span> <span class="db-alerts-chip-txt">Peligro </span>${a.danger.length}</span>` : '',
        a.warn.length   ? `<span class="db-alerts-chip" title="Jugadoras en precaución A:C"><span class="wh-warn" aria-hidden="true">●</span> <span class="db-alerts-chip-txt">Precaución </span>${a.warn.length}</span>` : '',
        a.trend.length ? `<span class="db-alerts-chip">Wellness ${a.trend.length}</span>` : '',
        a.rpe.length   ? `<span class="db-alerts-chip">RPE ${a.rpe.length}</span>` : ''
    ].join('');

    const names = list => list.map(x => esc(x.name)).join(', ');
    const rows = [];
    if (a.team) {
        rows.push(`<div class="db-alerts-row"><span>⚠️ <strong>${a.danger.length} jugadoras en zona de riesgo A:C simultáneamente</strong> — revisar carga de equipo hoy</span>`
            + `<button type="button" class="db-alerts-btn" onclick="window.rpeTracker?.openPreSessionModal()">Ver detalle →</button></div>`);
    }
    if (a.danger.length) rows.push(`<div class="db-alerts-row"><span><span class="wh-bad" aria-hidden="true">●</span> <strong>${names(a.danger)}</strong> ratio en zona de peligro</span></div>`);
    if (a.warn.length)   rows.push(`<div class="db-alerts-row"><span><span class="wh-warn" aria-hidden="true">●</span> <strong>${names(a.warn)}</strong> en precaución</span></div>`);
    a.trend.forEach(t => rows.push(`<div class="db-alerts-row"><span>🔁 <strong>${esc(t.name)}</strong> — ${esc(t.message)}</span></div>`));
    a.rpe.forEach(d => rows.push(`<div class="db-alerts-row"><span>⚠️ <strong>${esc(d.name)}</strong> RPE distinto (tú: ${esc(d.staffRpe)}, ella: ${esc(d.playerRpe)}) — ${esc(d.date)}</span>`
        + `<button type="button" class="db-alerts-btn" data-session-id="${esc(d.sessionId)}" onclick="window.rpeTracker?.showSessionDetail(this.dataset.sessionId)">Revisar →</button></div>`));

    const foot = info.seen ? '' :
        `<div class="db-alerts-foot"><button type="button" class="db-alerts-btn db-alerts-btn--seen" onclick="window.rpeTracker?.markDashAlertsSeen()">Marcar como visto por hoy</button></div>`;

    return `<div class="db-alerts${info.seen ? ' db-alerts--seen' : ''}${open ? ' is-open' : ''}" id="dashAlerts">
        <button type="button" class="db-alerts-bar" onclick="window.rpeTracker?.toggleDashAlerts()" aria-expanded="${open}" aria-controls="dashAlertsPanel">
            <span class="db-alerts-title">${title}</span>
            <span class="db-alerts-chips">${chips}</span>
            <span class="db-alerts-toggle" aria-hidden="true">▾</span>
        </button>
        <div class="db-alerts-panel" id="dashAlertsPanel">${rows.join('')}${foot}</div>
    </div>`;
};

// Despliega o pliega la lista sin repintar todo Inicio (y recuerda el estado entre repintados)
RPETracker.prototype.toggleDashAlerts = function() {
    this._dashAlertsOpen = !this._dashAlertsOpen;
    const el = document.getElementById('dashAlerts');
    if (!el) return;
    el.classList.toggle('is-open', this._dashAlertsOpen);
    const bar = el.querySelector('.db-alerts-bar');
    if (bar) bar.setAttribute('aria-expanded', String(this._dashAlertsOpen));
};

// ── 4. «Marcar como visto por hoy» ────────────────────────────────────────────
RPETracker.prototype.markDashAlertsSeen = function() {
    const keys = (this._lastDashAlertKeys || []).slice().sort();
    if (!keys.length) return;
    let joined = keys.join(',');
    if (joined.length > DASH_ALERTS_MAX_KEYS_LEN) joined = joined.slice(0, Math.max(0, joined.lastIndexOf(',', DASH_ALERTS_MAX_KEYS_LEN)));
    const rec = { date: _dashAlertsToday(), keys: joined };
    this._dashAlertsSeen = rec;
    this._dashAlertsOpen = false;
    this._saveDashAlertsSeen(rec);
    if (typeof this.renderDashboard === 'function') this.renderDashboard();
};

// ── 5. Guardar y sincronizar ──────────────────────────────────────────────────
RPETracker.prototype._dashAlertsUid = function() {
    return (window.firebaseAuth && window.firebaseAuth.currentUser && window.firebaseAuth.currentUser.uid) || null;
};

RPETracker.prototype._readLocalDashAlertsSeen = function(uid) {
    try {
        const rec = JSON.parse(localStorage.getItem(DASH_ALERTS_LS_PREFIX + uid) || 'null');
        return _dashAlertsValid(rec) ? rec : null;
    } catch (_) { return null; }
};

// Guarda en el dispositivo (siempre) y en Firebase (si hay base de datos). Un fallo de red no rompe nada.
RPETracker.prototype._saveDashAlertsSeen = function(rec) {
    const uid = this._dashAlertsUid();
    if (!uid) return;
    try { localStorage.setItem(DASH_ALERTS_LS_PREFIX + uid, JSON.stringify(rec)); } catch (_) { /* sin almacenamiento local */ }
    try {
        if (window.firebaseDB) {
            const p = window.firebaseDB.ref('staffAlertsSeen/' + uid).set({ date: rec.date, keys: rec.keys });
            if (p && typeof p.catch === 'function') p.catch(e => console.warn('No se pudo sincronizar «avisos vistos»:', e && e.message));
        }
    } catch (e) { console.warn('No se pudo sincronizar «avisos vistos»:', e && e.message); }
};

// Carga la marca local la primera vez y registra UNA sola vez el listener en tiempo real:
// si marcas «visto» en el móvil, el ordenador lo recibe al momento.
RPETracker.prototype._ensureDashAlertsSync = function() {
    const uid = this._dashAlertsUid();
    if (!uid) return;
    if (this._dashAlertsUidLoaded !== uid) {
        this._dashAlertsUidLoaded = uid;
        this._dashAlertsSeen = this._readLocalDashAlertsSeen(uid);
    }
    if (this._dashAlertsListenerUid === uid || !window.firebaseDB) return;
    this._dashAlertsListenerUid = uid;
    try {
        window.firebaseDB.ref('staffAlertsSeen/' + uid).on('value', snap => {
            const v = snap.val();
            if (!_dashAlertsValid(v)) {
                // Aún no hay marca en la nube: si ya había una en este dispositivo, se sube
                if (_dashAlertsValid(this._dashAlertsSeen)) this._saveDashAlertsSeen(this._dashAlertsSeen);
                return;
            }
            const cur = this._dashAlertsSeen;
            const same = _dashAlertsValid(cur) && cur.date === v.date && cur.keys === v.keys;
            this._dashAlertsSeen = { date: v.date, keys: v.keys };
            try { localStorage.setItem(DASH_ALERTS_LS_PREFIX + uid, JSON.stringify(this._dashAlertsSeen)); } catch (_) { /* sin almacenamiento local */ }
            if (!same && this.currentView === 'dashboard' && typeof this.renderDashboard === 'function') this.renderDashboard();
        }, err => console.warn('Avisos vistos: sin acceso a la nube, se usa solo este dispositivo:', err && err.message));
    } catch (e) { console.warn('Avisos vistos: no se pudo escuchar la nube:', e && e.message); }
};

// ── 6. Recordatorio de planificación (solo domingos) ─────────────────────────
// Es una tarea, no un aviso: queda aparte, en una línea fina, y desaparece al guardar la semana.
RPETracker.prototype._renderDashPlanningReminder = function() {
    if (new Date().getDay() !== 0) return '';
    const tomorrow = new Date(); tomorrow.setDate(tomorrow.getDate() + 1);
    const nextMonday = this._wpMondayKey ? this._wpMondayKey(tomorrow) : toLocalISODate(tomorrow);
    if (this.isWeekPlanSaved && this.isWeekPlanSaved(nextMonday)) return '';
    return `<div class="db-alerts-plan">
        <span>📅 <strong>Planificación pendiente</strong> — revisa la semana que empieza mañana</span>
        <button type="button" class="db-alerts-btn" onclick="window.rpeTracker?.switchView('weekplan')">Planificar →</button>
    </div>`;
};

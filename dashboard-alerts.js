// BasketballRPE-Web — dashboard-alerts.js
// Avisos de Inicio dentro del KPI «alertas A:C» (antes eran una barra plegable aparte).
//
//   · El KPI muestra en grande el nº de jugadoras en PELIGRO A:C (la regla única de _acLevel) y, debajo,
//     chips con las demás alertas que existan: «Prec. 1 · Well. 1 · RPE 1». Un punto en la esquina indica
//     que hay avisos sin ver; si ya están vistos hoy, los chips se sustituyen por «✓ vistos hoy».
//   · Al pulsar el KPI se abre un PANEL con la lista completa de avisos de hoy y sus botones. En PC es un panel
//     anclado bajo el KPI; en móvil (≤768px) una hoja desde abajo. Se cierra con Esc, tocando fuera, con la × o
//     al marcar «visto». El panel vive en <body>: la fila de KPIs recorta lo que sobresale (overflow: hidden).
//   · «Marcar como visto por hoy»: el KPI pasa a «✓ vistos hoy» y la lista sigue disponible al abrirlo. Vuelve a
//     destacarse si aparece un aviso NUEVO o al día siguiente.
//   · La marca de «visto» se sincroniza entre dispositivos (nodo /staffAlertsSeen/{uid}, solo la
//     dueña lo lee y lo escribe) y se guarda también en el dispositivo por si no hay conexión.
//   · Los avisos NO se guardan: se calculan cada vez a partir de los datos. Solo se guarda qué
//     avisos (sus identificadores, sin nombres ni datos de wellness) estaban cuando se marcó «visto».
//
// Expone: RPETracker.prototype._dashAlertsSummary / _dashAlertsKpiExtra / _dashAlertsKpiAttrs / _dashAlertsPanelHtml
//          RPETracker.prototype.toggleDashAlerts / openDashAlerts / closeDashAlerts / markDashAlertsSeen
//          RPETracker.prototype._renderDashPlanningReminder (recordatorio de los domingos)
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
// La usan el panel de avisos, el KPI «alertas A:C», la insignia de Análisis, el icono de la app y
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

// ── 3. Resumen para el KPI y panel de avisos ────────────────────────────────
// Reúne los avisos y su estado (vistos / nuevos). Lo llama renderDashboard() una vez por repintado; el
// panel se construye con este mismo resumen, así que KPI y panel nunca se contradicen.
RPETracker.prototype._dashAlertsSummary = function(data) {
    this._ensureDashAlertsSync();
    const a = this._collectDashAlerts(data || {});
    const info = a.total ? this._dashAlertsSeenInfo(a.keys) : { seen: false, newCount: 0, partial: false };
    this._lastDashAlertKeys = a.keys;          // los usa «Marcar como visto»
    this._lastDashAlerts = a;                  // los usa el panel
    this._lastDashAlertsInfo = info;
    return { a, info };
};

// Chips bajo el número del KPI: solo los tipos que existen (el peligro es el número grande).
// Ya vistos hoy: una sola línea gris «✓ vistos hoy».
RPETracker.prototype._dashAlertsKpiExtra = function(sum) {
    const { a, info } = sum;
    if (!a.total) return '';
    if (info.seen) return '<span class="db-kpi-seen">✓ vistos hoy</span>';
    const chip = (n, dotClass, txt, title) => n
        ? `<span class="db-alerts-chip" title="${title}">${dotClass ? `<span class="${dotClass}" aria-hidden="true">●</span> ` : ''}<span class="db-alerts-chip-txt">${txt} </span>${n}</span>`
        : '';
    const chips = [
        chip(a.warn.length,  'wh-warn', 'Prec.', 'Jugadoras en precaución A:C'),
        chip(a.trend.length, '',        'Well.', 'Tendencias de wellness'),
        chip(a.rpe.length,   '',        'RPE',   'RPE distinto entre tú y la jugadora')
    ].join('');
    return chips ? `<span class="db-kpi-chips">${chips}</span>` : '';
};

// Atributos del KPI: accesible con teclado y lector de pantalla, y abre el panel
RPETracker.prototype._dashAlertsKpiAttrs = function(sum, dangerCount) {
    const { a, info } = sum;
    const label = `${dangerCount} ${dangerCount === 1 ? 'alerta' : 'alertas'} A:C`
        + (a.total ? `, ${a.total} ${a.total === 1 ? 'aviso' : 'avisos'} hoy${info.seen ? ' (vistos)' : ''}` : ', sin avisos hoy')
        + '. Abrir los avisos';
    return `id="dashAlertsKpi" role="button" tabindex="0" aria-haspopup="dialog" aria-expanded="${!!this._dashAlertsOpen}"`
        + ` aria-label="${esc(label)}" title="Ver los avisos de hoy"`
        + ` onclick="window.rpeTracker?.toggleDashAlerts()" onkeydown="window.rpeTracker?.dashAlertsKpiKey(event)"`;
};

// Enter o espacio sobre el KPI (no es un <button>, es un tile) abren/cierran el panel
RPETracker.prototype.dashAlertsKpiKey = function(e) {
    if (!e || (e.key !== 'Enter' && e.key !== ' ')) return;
    if (typeof e.preventDefault === 'function') e.preventDefault();
    this.toggleDashAlerts();
};

RPETracker.prototype._dashAlertsTitle = function(a, info) {
    if (!a.total) return 'Avisos de hoy';
    if (info.seen) return `Avisos vistos hoy: ${a.total}`;
    let t = a.total === 1 ? '1 aviso' : `${a.total} avisos`;
    if (info.partial) t += ` · ${info.newCount} ${info.newCount === 1 ? 'nuevo' : 'nuevos'}`;
    return t;
};

// Contenido del panel: filas de avisos + pie con «Marcar como visto» y «Ver analítica»
RPETracker.prototype._dashAlertsPanelHtml = function() {
    const a = this._lastDashAlerts || this._collectDashAlerts({});
    const info = this._lastDashAlertsInfo || { seen: false, newCount: 0, partial: false };
    const close = 'window.rpeTracker?.closeDashAlerts();';

    const names = list => list.map(x => esc(x.name)).join(', ');
    const rows = [];
    if (a.team) {
        rows.push(`<div class="db-alerts-row"><span>⚠️ <strong>${a.danger.length} jugadoras en zona de riesgo A:C simultáneamente</strong> — revisar carga de equipo hoy</span>`
            + `<button type="button" class="db-alerts-btn" onclick="${close}window.rpeTracker?.openPreSessionModal()">Ver detalle →</button></div>`);
    }
    if (a.danger.length) rows.push(`<div class="db-alerts-row"><span><span class="wh-bad" aria-hidden="true">●</span> <strong>${names(a.danger)}</strong> ratio en zona de peligro</span></div>`);
    if (a.warn.length)   rows.push(`<div class="db-alerts-row"><span><span class="wh-warn" aria-hidden="true">●</span> <strong>${names(a.warn)}</strong> en precaución</span></div>`);
    a.trend.forEach(t => rows.push(`<div class="db-alerts-row"><span>🔁 <strong>${esc(t.name)}</strong> — ${esc(t.message)}</span></div>`));
    a.rpe.forEach(d => rows.push(`<div class="db-alerts-row"><span>⚠️ <strong>${esc(d.name)}</strong> RPE distinto (tú: ${esc(d.staffRpe)}, ella: ${esc(d.playerRpe)}) — ${esc(d.date)}</span>`
        + `<button type="button" class="db-alerts-btn" data-session-id="${esc(d.sessionId)}" onclick="${close}window.rpeTracker?.showSessionDetail(this.dataset.sessionId)">Revisar →</button></div>`));

    const body = rows.length ? rows.join('') : '<div class="db-alerts-empty">Sin avisos hoy ✓</div>';
    const seenBtn = (a.total && !info.seen)
        ? '<button type="button" class="db-alerts-btn db-alerts-btn--seen" onclick="window.rpeTracker?.markDashAlertsSeen()">Marcar como visto por hoy</button>' : '';
    const analyticsBtn = `<button type="button" class="db-alerts-btn" onclick="${close}window.rpeTracker?.switchView('analytics')">Ver analítica →</button>`;

    return `<div class="db-alerts-pop${info.seen ? ' db-alerts-pop--seen' : ''}" id="dashAlertsPop" role="dialog" aria-label="Avisos de hoy" tabindex="-1">
        <div class="db-alerts-head"><span class="db-alerts-title">${this._dashAlertsTitle(a, info)}</span>`
        + `<button type="button" class="db-alerts-x" aria-label="Cerrar" onclick="window.rpeTracker?.closeDashAlerts(true)">×</button></div>
        <div class="db-alerts-body">${body}</div>
        <div class="db-alerts-foot">${seenBtn}${analyticsBtn}</div>
    </div>`;
};

// Dónde va el panel. Función pura (se prueba sin navegador):
//  · ≤768px → hoja desde abajo (la fija el CSS) · PC → anclado bajo el KPI, sin salirse de la pantalla
function _dashAlertsPlacement(rect, vw, vh) {
    if (vw <= 768) return { sheet: true };
    const width = Math.min(440, vw - 16);
    const left = Math.max(8, Math.min(rect.left, vw - 8 - width));
    const top = Math.min(rect.bottom + 8, Math.max(8, vh - 160));
    return { sheet: false, left, top, width, maxHeight: Math.max(160, vh - top - 16) };
}

// Abre (o repinta, si ya estaba abierto) el panel en <body>
RPETracker.prototype._mountDashAlerts = function() {
    let layer = document.getElementById('dashAlertsLayer');
    if (!layer) {
        layer = document.createElement('div');
        layer.id = 'dashAlertsLayer';
        document.body.appendChild(layer);
    }
    layer.innerHTML = '<div class="db-alerts-backdrop" onclick="window.rpeTracker?.closeDashAlerts()"></div>' + this._dashAlertsPanelHtml();
    this._positionDashAlerts();
    const kpi = document.getElementById('dashAlertsKpi');
    if (kpi) kpi.setAttribute('aria-expanded', 'true');
    this._bindDashAlertsEvents();
};

RPETracker.prototype._positionDashAlerts = function() {
    const pop = document.getElementById('dashAlertsPop');
    const kpi = document.getElementById('dashAlertsKpi');
    if (!pop || !kpi || typeof kpi.getBoundingClientRect !== 'function') return;
    const pl = _dashAlertsPlacement(kpi.getBoundingClientRect(), window.innerWidth, window.innerHeight);
    if (pl.sheet) {
        pop.style.left = pop.style.top = pop.style.width = pop.style.maxHeight = '';
    } else {
        pop.style.left = pl.left + 'px';
        pop.style.top = pl.top + 'px';
        pop.style.width = pl.width + 'px';
        pop.style.maxHeight = pl.maxHeight + 'px';
    }
};

// Esc cierra; al girar/redimensionar o hacer scroll se recoloca. Se registra UNA sola vez.
RPETracker.prototype._bindDashAlertsEvents = function() {
    if (this._dashAlertsEventsBound) return;
    this._dashAlertsEventsBound = true;
    const self = this;
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && self._dashAlertsOpen) self.closeDashAlerts(true); });
    if (typeof window.addEventListener === 'function') {
        const reposition = () => { if (self._dashAlertsOpen) self._positionDashAlerts(); };
        window.addEventListener('resize', reposition);
        window.addEventListener('scroll', reposition, { passive: true });
    }
};

RPETracker.prototype.openDashAlerts = function() {
    this._dashAlertsOpen = true;
    this._mountDashAlerts();
    const pop = document.getElementById('dashAlertsPop');
    if (pop && typeof pop.focus === 'function') pop.focus();
};

// restoreFocus: solo con Esc o la ×, para que quien navega con teclado vuelva al KPI
RPETracker.prototype.closeDashAlerts = function(restoreFocus) {
    this._dashAlertsOpen = false;
    const layer = document.getElementById('dashAlertsLayer');
    if (layer && typeof layer.remove === 'function') layer.remove();
    const kpi = document.getElementById('dashAlertsKpi');
    if (kpi) {
        kpi.setAttribute('aria-expanded', 'false');
        if (restoreFocus === true && typeof kpi.focus === 'function') kpi.focus();
    }
};

RPETracker.prototype.toggleDashAlerts = function() {
    if (this._dashAlertsOpen) this.closeDashAlerts(); else this.openDashAlerts();
};

// Tras repintar Inicio con el panel abierto: se refresca su contenido y se recoloca bajo el KPI nuevo
// (si el KPI ya no existe, p. ej. se cambió de pestaña, se cierra)
RPETracker.prototype._syncDashAlertsPanel = function() {
    if (!this._dashAlertsOpen) return;
    if (!document.getElementById('dashAlertsKpi')) { this.closeDashAlerts(); return; }
    this._mountDashAlerts();
};

// ── 4. «Marcar como visto por hoy» ────────────────────────────────────────────
RPETracker.prototype.markDashAlertsSeen = function() {
    const keys = (this._lastDashAlertKeys || []).slice().sort();
    if (!keys.length) return;
    let joined = keys.join(',');
    if (joined.length > DASH_ALERTS_MAX_KEYS_LEN) joined = joined.slice(0, Math.max(0, joined.lastIndexOf(',', DASH_ALERTS_MAX_KEYS_LEN)));
    const rec = { date: _dashAlertsToday(), keys: joined };
    this._dashAlertsSeen = rec;
    this.closeDashAlerts();                      // el panel se cierra al marcar «visto»
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

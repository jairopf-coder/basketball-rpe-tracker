// ============================================================
//  gps-tracking.js — Fase 1: Integración de datos GPS (Oli Sports)
//
//  Qué hace este módulo:
//   1. Importa el CSV que exporta Oli por sesión.
//   2. Empareja cada fila (jugadora de Oli) con una jugadora del
//      roster interno, recordando el mapeo para no repetirlo.
//   3. Guarda los datos GPS vinculados a una sesión interna
//      concreta (sessionGroupId, ver más abajo) en Firebase.
//   4. Muestra un resumen compacto en la ficha de sesión ya
//      existente (showSessionDetail, en app-sessions.js).
//
//  Qué NO hace (a propósito, por seguridad):
//   - No modifica `this.sessions`, ni `rpe`, ni `load`.
//   - No toca ewma-calculator.js ni injury-prediction.js.
//   - No cambia el flujo de creación/guardado de sesiones.
//
//  Estructura en Firebase:
//   gpsData/{sessionGroupId}/{playerId} = { ...métricas... }
//   gpsPlayerMap/{oliPlayerId} = playerId interno (mapeo recordado)
//
//  sessionGroupId: todas las filas guardadas por RPETracker al
//  pulsar "Guardar sesión" comparten el mismo `baseId` como prefijo
//  de su id (id = baseId + índice). Usamos ese baseId como el
//  identificador de "sesión de equipo" para agrupar el GPS de
//  todas las jugadoras de esa sesión.
// ============================================================

RPETracker.prototype.initializeGpsTracking = function() {
    this.gpsData = this.loadGpsData();
    this.gpsPlayerMap = this.loadGpsPlayerMap();

    // Mismo patrón que initializeInjuryManagement(): seed local +
    // listener en tiempo real + anti-eco mientras hay un write en vuelo.
    if (window.firebaseSync && !this._gpsDataListenerSet) {
        this._gpsDataListenerSet = true;
        window.firebaseSync.onGpsDataChange((updated) => {
            if (this._savingGpsData) return;

            if (updated === null) {
                // Nodo no existe aún en Firebase: si había datos locales
                // previos (no debería en Fase 1, pero por consistencia
                // con el resto de módulos), los empujamos.
                if (this.gpsData && Object.keys(this.gpsData).length > 0) {
                    this.saveGpsData();
                }
                return;
            }

            this.gpsData = updated || {};
            if (window._devMode) console.log('🔄 Datos GPS actualizados desde Firebase');
        });
    }

    if (window.firebaseSync && !this._gpsPlayerMapListenerSet) {
        this._gpsPlayerMapListenerSet = true;
        window.firebaseSync.onGpsPlayerMapChange((updated) => {
            if (this._savingGpsPlayerMap) return;
            if (updated === null) {
                if (this.gpsPlayerMap && Object.keys(this.gpsPlayerMap).length > 0) {
                    this.saveGpsPlayerMap();
                }
                return;
            }
            this.gpsPlayerMap = updated || {};
        });
    }
};

RPETracker.prototype.loadGpsData = function() {
    const stored = localStorage.getItem('basketballGpsData');
    return stored ? JSON.parse(stored) : {};
};

RPETracker.prototype.saveGpsData = function() {
    if (window.firebaseSync) {
        this._savingGpsData = true;
        window.firebaseSync.saveGpsData(this.gpsData).finally(() => {
            this._savingGpsData = false;
        });
    } else {
        localStorage.setItem('basketballGpsData', JSON.stringify(this.gpsData));
    }
};

RPETracker.prototype.loadGpsPlayerMap = function() {
    const stored = localStorage.getItem('basketballGpsPlayerMap');
    return stored ? JSON.parse(stored) : {};
};

RPETracker.prototype.saveGpsPlayerMap = function() {
    if (window.firebaseSync) {
        this._savingGpsPlayerMap = true;
        window.firebaseSync.saveGpsPlayerMap(this.gpsPlayerMap).finally(() => {
            this._savingGpsPlayerMap = false;
        });
    } else {
        localStorage.setItem('basketballGpsPlayerMap', JSON.stringify(this.gpsPlayerMap));
    }
};

// ========== Utilidades de emparejamiento de jugadoras ==========

// Normaliza un nombre para comparar sin acentos, mayúsculas ni espacios extra.
RPETracker.prototype._normalizePlayerName = function(name) {
    return (name || '')
        .toString()
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, ''); // quita acentos
};

// Intenta encontrar la jugadora interna que corresponde a un nombre de Oli.
// Devuelve { player, confidence } donde confidence es 'exact' | 'partial' | null.
RPETracker.prototype._matchGpsPlayerByName = function(oliName) {
    const normalized = this._normalizePlayerName(oliName);
    if (!normalized) return { player: null, confidence: null };

    // Coincidencia exacta de nombre completo
    let match = this.players.find(p => this._normalizePlayerName(p.name) === normalized);
    if (match) return { player: match, confidence: 'exact' };

    // Coincidencia parcial: todas las palabras del nombre de Oli están
    // contenidas en el nombre interno, o viceversa (cubre casos como
    // "Elba Garfella Béjar" vs "Elba Garfella").
    const oliWords = normalized.split(/\s+/).filter(Boolean);
    match = this.players.find(p => {
        const internal = this._normalizePlayerName(p.name);
        return oliWords.every(w => internal.includes(w)) || internal.split(/\s+/).every(w => normalized.includes(w));
    });
    if (match) return { player: match, confidence: 'partial' };

    return { player: null, confidence: null };
};

// ========== Parseo del CSV de Oli ==========

// Parser CSV simple pero robusto a comillas y comas dentro de campos
// (el export de Oli envuelve todos los campos en comillas dobles).
RPETracker.prototype._parseCsvText = function(text) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    // Normaliza saltos de línea de Windows
    const clean = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

    for (let i = 0; i < clean.length; i++) {
        const c = clean[i];
        if (inQuotes) {
            if (c === '"') {
                if (clean[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else {
                field += c;
            }
        } else {
            if (c === '"') inQuotes = true;
            else if (c === ',') { row.push(field); field = ''; }
            else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
            else field += c;
        }
    }
    if (field.length > 0 || row.length > 0) { row.push(field); rows.push(row); }

    return rows.filter(r => r.length > 1 || (r.length === 1 && r[0] !== ''));
};

// Columnas del CSV de Oli que nos interesa guardar. El resto del CSV
// se ignora a propósito (Fase 1: solo lo necesario para el resumen
// y el detalle ampliado, ver README de la conversación de diseño).
//
// IMPORTANTE (a partir del CSV del 10/09/2026): Oli añadió un nuevo
// bloque de "zonas de velocidad" (Caminata/Trote/MSR/HSR/Sprint, cada
// una con conteo (#) y distancia (m)) que sustituye a las columnas
// antiguas de trote/caminata y a "Carreras de Alta/Máx. Int.".
//
// Estas columnas nuevas tienen EXACTAMENTE EL MISMO NOMBRE que las
// viejas que sustituyen ('Trote (m)', 'Caminata (m)'), así que un CSV
// con ambos bloques a la vez tiene columnas de cabecera duplicadas.
// Por eso este mapeo va por POSICIÓN (índice) para esas columnas
// concretas en vez de por nombre — ver `OLI_FIELD_MAP_BY_POSITION`
// más abajo y `_resolveOliColumnIndexes()`.
const OLI_FIELD_MAP = {
    'Nombre del Jugador':                    'oliPlayerName',
    'ID del Jugador':                        'oliPlayerId',
    'Fecha':                                  'oliDate',
    'Tipo de Sesión':                         'oliSessionType',
    'Etiqueta MD':                            'oliMdTag',
    'Tiempo de Juego (min)':                 'playTimeMin',
    'Vel. Max. (km/h)':                      'maxSpeedKmh',
    'Dist. Recorrida (m)':                   'distanceM',
    'Saltos (#)':                            'jumps',
    'Cambios de Dirección (#)':              'directionChanges',
    'Ace. Máx. Int. (#)':                    'maxAccelerations',
    'Ace. Máx. Int. (m)':                    'maxAccelerationsM',
    'Desac. Máx. Int. (#)':                  'maxDecelerations',
    'Desac. Máx. Int. (m)':                  'maxDecelerationsM',
    'Ace. Alta Int. (#)':                    'highAccelerations',
    'Ace. Alta Int. (m)':                    'highAccelerationsM',
    'Desac. Alta Int. (#)':                  'highDecelerations',
    'Desac. Alta Int. (m)':                  'highDecelerationsM',
    'Impactos baja intensidad (#)':          'impactsLow',
    'Impactos media intensidad (#)':         'impactsMedium',
    'Impactos alta intensidad (#)':          'impactsHigh',
    'Impactos máxima intensidad (#)':        'impactsMax',
    'Energía Metabólica Total (kJ/kg)':      'metabolicEnergyKjKg',
    'Calorías Totales Quemadas (kcal)':      'caloriesTotal',
    'Vol. de la sesión':                     'sessionVolume',
    'Int. de la sesión':                     'sessionIntensity',
    'RPE':                                    'oliRpe',
    's-RPE':                                  'oliSrpe',
};

// Columnas del nuevo bloque de "zonas de velocidad" (# y m). Estas
// SUSTITUYEN a las columnas antiguas 'Trote (m)' / 'Caminata (m)' (que
// ya no se usan) y a 'Carreras de Alta Int.' / 'Carreras de Máx. Int.'
// (High Speed Running sustituye a "Alta Int.", Sprint sustituye a
// "Máx. Int."). Si el CSV NO trae este bloque (formato viejo, antes
// del 10/09/2026), estos campos simplemente quedan a null y la UI
// los muestra como "—", sin romper nada.
const OLI_SPEED_ZONE_COLUMNS = [
    { name: 'Caminata(#)',                   key: 'walkCount' },
    { name: 'Caminata (m)',                  key: 'walkM' },
    { name: 'Trote(#)',                      key: 'jogCount' },
    { name: 'Trote (m)',                     key: 'jogM' },
    { name: 'Moderate Speed Running(#)',     key: 'moderateRunCount' },
    { name: 'Moderate Speed Running (m)',    key: 'moderateRunM' },
    { name: 'High Speed Running(#)',         key: 'highIntensityRuns' },
    { name: 'High Speed Running (m)',        key: 'highIntensityRunsM' },
    { name: 'Sprint(#)',                     key: 'maxIntensityRuns' },
    { name: 'Sprint (m)',                    key: 'maxIntensityRunsM' },
];

// Nombres de columna que además de existir en OLI_SPEED_ZONE_COLUMNS
// pueden aparecer DUPLICADOS en la cabecera (por el bloque viejo).
// Cuando busquemos estas columnas del bloque nuevo, tenemos que coger
// la ÚLTIMA aparición (el bloque nuevo va siempre al final del CSV,
// después del bloque viejo de aceleraciones/desaceleraciones).
const OLI_DUPLICATE_COLUMN_NAMES = new Set(['Trote (m)', 'Caminata (m)']);

// Localiza, para cada columna del bloque de zonas de velocidad, su
// índice correcto en la cabecera — usando la ÚLTIMA aparición del
// nombre cuando hay duplicados, y la única aparición en caso
// contrario. Devuelve { key: index|undefined }.
function _resolveSpeedZoneIndexes(header) {
    const indexes = {};
    OLI_SPEED_ZONE_COLUMNS.forEach(col => {
        let idx;
        if (OLI_DUPLICATE_COLUMN_NAMES.has(col.name)) {
            idx = header.lastIndexOf(col.name); // última aparición = bloque nuevo
        } else {
            idx = header.indexOf(col.name);
        }
        indexes[col.key] = idx >= 0 ? idx : undefined;
    });
    return indexes;
}

// Convierte el texto crudo del CSV en un array de objetos con las
// columnas relevantes ya traducidas a nombres internos y números.
RPETracker.prototype.parseOliGpsCsv = function(text) {
    const rows = this._parseCsvText(text);
    if (rows.length < 2) return [];

    const header = rows[0].map(h => h.trim());

    // Columnas "normales" (sin duplicados): por nombre, primera aparición.
    const colIndex = {};
    header.forEach((h, i) => { if (colIndex[h] === undefined) colIndex[h] = i; });

    // Columnas del bloque de zonas de velocidad: resueltas aparte,
    // por posición, para no chocar con nombres duplicados.
    const speedZoneIndex = _resolveSpeedZoneIndexes(header);

    const records = [];
    for (let r = 1; r < rows.length; r++) {
        const raw = rows[r];
        if (!raw || raw.every(v => v === '')) continue; // fila vacía

        const record = {};
        Object.keys(OLI_FIELD_MAP).forEach(oliCol => {
            const idx = colIndex[oliCol];
            if (idx === undefined) return;
            const internalKey = OLI_FIELD_MAP[oliCol];
            const value = raw[idx] !== undefined ? raw[idx].trim() : '';
            const isNumeric = !['oliPlayerName', 'oliPlayerId', 'oliDate', 'oliSessionType', 'oliMdTag'].includes(internalKey);
            record[internalKey] = isNumeric ? (value === '' ? null : parseFloat(value)) : value;
        });

        OLI_SPEED_ZONE_COLUMNS.forEach(col => {
            const idx = speedZoneIndex[col.key];
            if (idx === undefined) { record[col.key] = null; return; }
            const value = raw[idx] !== undefined ? raw[idx].trim() : '';
            record[col.key] = value === '' ? null : parseFloat(value);
        });

        if (record.oliPlayerName) records.push(record);
    }
    return records;
};

// ========== Flujo de importación (UI) ==========

// Punto de entrada: botón "Importar datos GPS" en la ficha de sesión.
RPETracker.prototype.openGpsImportForSession = function(sessionGroupId) {
    this._gpsImportSessionGroupId = sessionGroupId;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.csv';
    input.style.display = 'none';
    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => this._handleGpsCsvLoaded(evt.target.result, sessionGroupId);
        reader.onerror = () => this.showToast('⚠️ No se pudo leer el archivo CSV', 'warning');
        reader.readAsText(file, 'UTF-8');
        input.remove();
    };
    document.body.appendChild(input);
    input.click();
};

RPETracker.prototype._handleGpsCsvLoaded = function(csvText, sessionGroupId) {
    let records;
    try {
        records = this.parseOliGpsCsv(csvText);
    } catch (e) {
        console.error('Error parseando CSV de Oli:', e);
        this.showToast('⚠️ El archivo no tiene el formato esperado', 'warning');
        return;
    }

    if (records.length === 0) {
        this.showToast('⚠️ No se encontraron filas de jugadoras en el CSV', 'warning');
        return;
    }

    // Emparejar cada fila con una jugadora interna, usando primero el
    // mapeo ya recordado (por oliPlayerId), y si no existe, por nombre.
    const matched = [];
    const unmatched = [];

    records.forEach(rec => {
        const mappedPlayerId = this.gpsPlayerMap[rec.oliPlayerId];
        if (mappedPlayerId) {
            const player = this.players.find(p => p.id === mappedPlayerId);
            if (player) {
                matched.push({ record: rec, player, confidence: 'remembered' });
                return;
            }
        }
        const { player, confidence } = this._matchGpsPlayerByName(rec.oliPlayerName);
        if (player) {
            matched.push({ record: rec, player, confidence });
        } else {
            unmatched.push(rec);
        }
    });

    this._showGpsImportConfirmModal(sessionGroupId, matched, unmatched);
};

// Modal de confirmación: permite corregir el emparejamiento antes de guardar.
RPETracker.prototype._showGpsImportConfirmModal = function(sessionGroupId, matched, unmatched) {
    let modal = document.getElementById('gpsImportModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gpsImportModal';
        modal.className = 'modal modal--top';
        document.body.appendChild(modal);
    }

    const playerOptions = (selectedId) => this.players.map(p =>
        `<option value="${p.id}" ${p.id === selectedId ? 'selected' : ''}>${esc(p.name)}</option>`
    ).join('') + `<option value="">— Ignorar esta fila —</option>`;

    const rowHtml = (item, idx) => {
        const badge = item.confidence === 'exact' ? '✅ Coincidencia exacta'
            : item.confidence === 'remembered' ? '🔁 Recordado de antes'
            : '❓ Verifica esta jugadora';
        return `
        <div class="gps-match-row" data-oli-id="${esc(item.record.oliPlayerId)}" data-idx="${idx}">
            <div class="gps-match-oli-name">${esc(item.record.oliPlayerName)}</div>
            <div class="gps-match-badge">${badge}</div>
            <select class="gps-match-select" id="gpsMatchSelect-${idx}">
                ${playerOptions(item.player.id)}
            </select>
        </div>`;
    };

    const unmatchedHtml = unmatched.length > 0 ? `
        <div class="gps-unmatched-section">
            <div class="gps-unmatched-title">⚠️ Filas sin jugadora identificada (${unmatched.length})</div>
            ${unmatched.map((rec, idx) => `
                <div class="gps-match-row" data-oli-id="${esc(rec.oliPlayerId)}" data-idx="u${idx}">
                    <div class="gps-match-oli-name">${esc(rec.oliPlayerName)}</div>
                    <select class="gps-match-select" id="gpsMatchSelect-u${idx}">
                        <option value="">— Ignorar esta fila —</option>
                        ${this.players.map(p => `<option value="${p.id}">${esc(p.name)}</option>`).join('')}
                    </select>
                </div>
            `).join('')}
        </div>` : '';

    modal.innerHTML = `
        <div class="modal-content" style="max-width:560px;max-height:85vh;max-height:85dvh;">
            <div class="modal-header">
                <h2>📡 Confirmar datos GPS importados</h2>
                <button class="modal-close" onclick="document.getElementById('gpsImportModal').classList.remove('active')">✕</button>
            </div>
            <div class="modal-body">
                <p style="font-size:0.9rem;color:var(--text-secondary,#666);margin-bottom:12px;">
                    Revisa que cada jugadora del archivo de Oli esté bien asociada a tu plantilla. Puedes corregirlo con el desplegable.
                    ${(matched.length + unmatched.length) > 6 ? '<br><strong>⬇ Desplázate para ver todas las jugadoras</strong>' : ''}
                </p>
                ${matched.map((item, idx) => rowHtml(item, idx)).join('')}
                ${unmatchedHtml}
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" onclick="document.getElementById('gpsImportModal').classList.remove('active')">Cancelar</button>
                <button class="btn-primary" onclick="window.rpeTracker._confirmGpsImport('${sessionGroupId}')">💾 Guardar datos GPS</button>
            </div>
        </div>`;

    this._pendingGpsImport = { sessionGroupId, matched, unmatched };
    modal.classList.add('active');
};

RPETracker.prototype._confirmGpsImport = function(sessionGroupId) {
    const pending = this._pendingGpsImport;
    if (!pending) return;

    const toSave = {};
    const newMappings = {};

    pending.matched.forEach((item, idx) => {
        const sel = document.getElementById(`gpsMatchSelect-${idx}`);
        const playerId = sel ? sel.value : item.player.id;
        if (!playerId) return; // ignorada
        toSave[playerId] = item.record;
        newMappings[item.record.oliPlayerId] = playerId;
    });

    pending.unmatched.forEach((rec, idx) => {
        const sel = document.getElementById(`gpsMatchSelect-u${idx}`);
        const playerId = sel ? sel.value : '';
        if (!playerId) return;
        toSave[playerId] = rec;
        newMappings[rec.oliPlayerId] = playerId;
    });

    if (Object.keys(toSave).length === 0) {
        this.showToast('⚠️ No se guardó ninguna fila', 'warning');
        return;
    }

    if (!this.gpsData) this.gpsData = {};
    this.gpsData[sessionGroupId] = { ...(this.gpsData[sessionGroupId] || {}), ...toSave };
    this.saveGpsData();

    if (!this.gpsPlayerMap) this.gpsPlayerMap = {};
    Object.assign(this.gpsPlayerMap, newMappings);
    this.saveGpsPlayerMap();

    const modal = document.getElementById('gpsImportModal');
    if (modal) modal.classList.remove('active');
    this._pendingGpsImport = null;

    this.showToast(`✅ Datos GPS guardados para ${Object.keys(toSave).length} jugadora(s)`, 'success');

    // Refrescar la ficha de sesión si sigue abierta
    if (this.currentSessionId && typeof this.showSessionDetail === 'function') {
        this.showSessionDetail(this.currentSessionId);
    }
};

// ========== Renderizado del resumen en la ficha de sesión ==========

// Deriva el "sessionGroupId" de un id de sesión individual. Todas las
// filas guardadas juntas por saveTeamSession() comparten el mismo
// baseId como prefijo (ver app-sessions.js: id = baseId + índice).
// Aquí usamos directamente el id de la sesión como agrupador simple:
// como el GPS se importa desde dentro de la ficha de una sesión
// concreta, basta con usar ese mismo id de sesión como sessionGroupId.
RPETracker.prototype._getGpsForSession = function(session) {
    if (!this.gpsData || !session) return null;
    const group = this.gpsData[session.id];
    if (!group) return null;
    return group[session.playerId] || null;
};

// Genera el HTML del bloque resumen GPS para insertar en showSessionDetail.
// Devuelve '' si no hay datos (no se muestra nada, no rompe el layout).
RPETracker.prototype.renderGpsSummaryBlock = function(session) {
    const gps = this._getGpsForSession(session);
    const importButton = `
        <button class="btn-secondary" style="margin-top:8px;font-size:0.85rem;"
            onclick="window.rpeTracker.openGpsImportForSession('${session.id}')">
            📡 ${gps ? 'Reimportar' : 'Importar'} datos GPS (Oli)
        </button>`;

    if (!gps) {
        return `
        <div class="detail-row gps-summary-empty">
            <span class="detail-label">Datos GPS</span>
            <span style="font-style:italic;color:var(--text-faint);">Sin datos importados</span>
        </div>
        ${importButton}`;
    }

    const rpeDiff = (gps.oliRpe !== null && gps.oliRpe !== undefined && session.rpe)
        ? Math.abs(session.rpe - gps.oliRpe)
        : null;
    const rpeWarning = rpeDiff !== null && rpeDiff >= 2;

    return `
        <div class="gps-summary-card" style="margin-top:14px;padding:12px;border-radius:10px;background:var(--bg-subtle);border:1px solid var(--border);">
            <div style="font-weight:600;margin-bottom:8px;color:var(--text-primary);">📡 Datos GPS (Oli Sports)</div>
            <div class="gps-summary-grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px 16px;font-size:0.9rem;color:var(--text-primary);">
                <div>🏃 Distancia: <strong>${gps.distanceM != null ? Math.round(gps.distanceM) + ' m' : '—'}</strong></div>
                <div>⚡ Vel. máx: <strong>${gps.maxSpeedKmh != null ? gps.maxSpeedKmh + ' km/h' : '—'}</strong></div>
                <div>🔼 Sprints: <strong>${gps.highIntensityRuns != null ? gps.highIntensityRuns : '—'}</strong></div>
                <div>🦘 Saltos: <strong>${gps.jumps != null ? gps.jumps : '—'}</strong></div>
            </div>
            ${gps.oliRpe !== null && gps.oliRpe !== undefined ? `
            <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:0.9rem;color:var(--text-primary);">
                RPE app: <strong>${session.rpe}</strong> &nbsp;·&nbsp; RPE Oli: <strong>${gps.oliRpe}</strong>
                ${rpeWarning ? ' <span style="color:#e67e22;">⚠️ Discrepancia notable</span>' : ''}
            </div>` : ''}
            ${this._renderIioBlock(session)}
        </div>
        ${importButton}`;
};

// Bloque del Índice de Intensidad Objetiva (IIO), comparado con el
// s-RPE que reporta la propia Oli (esfuerzo percibido × duración,
// calculado por ellos). Se muestra solo si hay datos suficientes;
// nunca bloquea ni sustituye el resto del resumen GPS.
RPETracker.prototype._renderIioBlock = function(session) {
    if (typeof this.calculateGpsIntensityIndex !== 'function') return '';
    const iio = this.calculateGpsIntensityIndex(session.playerId, session.id);
    if (!iio) return '';

    const gps = this._getGpsForSession(session);
    const srpe = gps && gps.oliSrpe != null ? gps.oliSrpe : null;

    // El IIO es 0-100, el s-RPE de Oli suele ser RPE(0-10) × duración,
    // en una escala distinta. Se muestran ambos valores, no se
    // fusionan — el objetivo es ver si divergen, no crear un tercer
    // número. Como referencia rápida se normaliza el s-RPE contra el
    // máximo histórico de s-RPE de la jugadora, igual criterio que el IIO.
    let srpeNormalized = null;
    if (srpe != null) {
        const history = (this.sessions || [])
            .filter(s => s.playerId === session.playerId)
            .filter(s => new Date(s.date) <= new Date(session.date))
            .map(s => this.gpsData && this.gpsData[s.id] && this.gpsData[s.id][session.playerId] ? this.gpsData[s.id][session.playerId].oliSrpe : null)
            .filter(v => v != null);
        const maxSrpe = history.length > 0 ? Math.max(...history) : srpe;
        srpeNormalized = maxSrpe > 0 ? Math.min(100, Math.round((srpe / maxSrpe) * 100)) : null;
    }

    const diff = srpeNormalized != null ? Math.abs(iio.score - srpeNormalized) : null;
    const warn = diff !== null && diff >= 25; // divergencia notable en escala 0-100

    return `
        <div style="margin-top:10px;padding-top:10px;border-top:1px solid var(--border);font-size:0.9rem;color:var(--text-primary);">
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <span>📐 Intensidad objetiva (IIO): <strong>${iio.score}/100</strong> ${iio.confidence === 'preliminar' ? '<span style="font-size:0.75rem;color:var(--text-secondary);">(preliminar, pocas sesiones aún)</span>' : ''}</span>
            </div>
            ${srpeNormalized != null ? `
            <div style="margin-top:4px;">
                vs. s-RPE percibido (normalizado): <strong>${srpeNormalized}/100</strong>
                ${warn ? ' <span style="color:#e67e22;">⚠️ Divergencia notable entre esfuerzo objetivo y percibido</span>' : ''}
            </div>` : ''}
        </div>`;
};

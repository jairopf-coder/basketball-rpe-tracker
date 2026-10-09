// Firebase Sync Manager
// Maneja la sincronización de datos entre Firebase y la app

// Debug logger — only emits in dev mode (window._devMode = true)
const _dbg = (...a) => { if (window._devMode) console.log(...a); };

// ========== ESCRITURA POR DIFERENCIAS (Fase 3) ==========
// En vez de reescribir una colección entera con set() (lo que borra lo que otro
// dispositivo haya añadido mientras tanto), se envían SOLO los elementos que este
// dispositivo ha cambiado desde la última vez que sincronizó. Los borrados van como null.
// Interruptor de emergencia: false = vuelve al set() de la colección completa de siempre.
const DIFF_WRITES_ENABLED = true;

const SyncDiff = {
    // Firebase no guarda null/undefined/[]/{}. Se quitan aquí también para que "lo local" y
    // "lo que devuelve el servidor" tengan la misma forma al compararlos. Dentro de un array
    // nunca se quita nada: preferimos una escritura de más a perder un cambio.
    _norm(v) {
        if (v === null || v === undefined) return undefined;
        if (Array.isArray(v)) {
            if (!v.length) return undefined;
            return v.map(x => { const n = this._norm(x); return n === undefined ? null : n; });
        }
        if (typeof v === 'object') {
            const out = {}; let any = false;
            Object.keys(v).sort().forEach(k => {
                const n = this._norm(v[k]);
                if (n !== undefined) { out[k] = n; any = true; }
            });
            return any ? out : undefined;
        }
        return v;
    },

    /** Forma canónica (texto) de un elemento, independiente del orden de las claves. */
    canon(item) {
        const plain = JSON.parse(JSON.stringify(item));   // quita funciones/undefined y aplica toJSON
        const n = this._norm(plain);
        return n === undefined ? '' : JSON.stringify(n);
    },

    validKey(id) {
        if (typeof id === 'number') return isFinite(id);
        return typeof id === 'string' && id.length > 0 && !/[.$#\[\]\/]/.test(id);
    },

    /** Mapa { id: forma canónica } a partir del objeto crudo que devuelve Firebase. */
    fromRemote(obj) {
        const m = {};
        if (obj && typeof obj === 'object') Object.keys(obj).forEach(k => { m[k] = this.canon(obj[k]); });
        return m;
    },

    /**
     * Qué hay que escribir: elementos nuevos o modificados respecto a `synced`, y null
     * para los que estaban en `synced` y ya no están. Si algún elemento no tiene un id
     * válido como clave de Firebase devuelve { ok: false } (se usará el camino de siempre).
     */
    plan(items, synced) {
        const next = {}, plain = {}, patch = {};
        let count = 0;
        for (const it of items) {
            if (!it || typeof it !== 'object' || !this.validKey(it.id)) return { ok: false };
            const key = String(it.id);
            next[key] = this.canon(it);
            plain[key] = it;
        }
        Object.keys(next).forEach(key => {
            if (synced[key] !== next[key]) { patch[key] = JSON.parse(JSON.stringify(plain[key])); count++; }
        });
        Object.keys(synced).forEach(key => {
            if (!Object.prototype.hasOwnProperty.call(next, key)) { patch[key] = null; count++; }
        });
        return { ok: true, patch, count, next };
    },

    // ----- Variante por RUTAS, para objetos anidados { clave1: { clave2: valor } } -----
    // (availability: { [jugadora]: { [fecha]: 'limited' | 'unavailable' } }). La unidad de
    // cambio es "clave1/clave2", así dos dispositivos que editan fechas distintas de la
    // misma jugadora no se pisan.
    _leaves(obj) {
        const out = {};
        if (!obj || typeof obj !== 'object') return out;
        Object.keys(obj).forEach(k1 => {
            const v1 = obj[k1];
            if (v1 && typeof v1 === 'object' && !Array.isArray(v1)) {
                Object.keys(v1).forEach(k2 => { if (v1[k2] !== null && v1[k2] !== undefined) out[k1 + '/' + k2] = v1[k2]; });
            } else if (v1 !== null && v1 !== undefined) {
                out[k1] = v1;
            }
        });
        return out;
    },

    fromRemotePaths(raw) {
        const m = {}, leaves = this._leaves(raw);
        Object.keys(leaves).forEach(p => { m[p] = this.canon(leaves[p]); });
        return m;
    },

    planPaths(obj, synced) {
        const leaves = this._leaves(obj || {});
        const next = {}, patch = {};
        let count = 0;
        for (const p of Object.keys(leaves)) {
            if (!p.split('/').every(seg => this.validKey(seg))) return { ok: false };
            next[p] = this.canon(leaves[p]);
        }
        Object.keys(next).forEach(p => {
            if (synced[p] !== next[p]) { patch[p] = JSON.parse(JSON.stringify(leaves[p])); count++; }
        });
        Object.keys(synced).forEach(p => {
            if (!Object.prototype.hasOwnProperty.call(next, p)) { patch[p] = null; count++; }
        });
        return { ok: true, patch, count, next };
    },
};

// Colecciones que no son "lista de elementos con id" sino objetos anidados
const DIFF_PATH_NODES = { availability: true };


class FirebaseSync {
    constructor() {
        // Defensive init: firebase-config.js may not have finished or may have failed
        this.db = window.firebaseDB || null;
        if (!this.db) {
            console.warn('[FirebaseSync] firebaseDB no disponible en construcción — modo offline');
            this.sessionsRef = null;
            this.playersRef  = null;
        } else {
            this.sessionsRef = this.db.ref('sessions');
            this.playersRef  = this.db.ref('players');
        }
        this.listeners = {
            sessions: [],
            players: []
        };
    }

    // ========== SESSIONS ==========
    
    // Cargar todas las sesiones
    async loadSessions() {
        try {
            const snapshot = await this.sessionsRef.once('value');
            const data = snapshot.val();
            return data ? Object.values(data) : [];
        } catch (error) {
            console.error('Error loading sessions:', error);
            // Fallback a localStorage si Firebase falla
            const stored = Store.getString('sessions');
            return stored ? JSON.parse(stored) : [];
        }
    }

    // Guardar todas las sesiones
    async saveSessions(sessions) {
        if (DIFF_WRITES_ENABLED) return this._saveByDiff('sessions', sessions, 'sesiones', { offlineLabel: 'sesiones' });
        try {
            // Convertir array a objeto con IDs como keys
            const sessionsObj = {};
            sessions.forEach(session => {
                sessionsObj[session.id] = session;
            });
            await this.sessionsRef.set(sessionsObj);
            // También guardar en localStorage como backup
            Store.set('sessions', sessions);
        } catch (error) {
            console.error('Error saving sessions:', error);
            Store.set('sessions', sessions);
            await this._enqueueWrite('sessions', Object.fromEntries(sessions.map(s => [s.id, s])));
            this._notifyOffline('sesiones');
        }
    }

    // Escuchar cambios en sesiones en tiempo real
    // startDate (opcional, 'YYYY-MM-DD'): si se indica, solo se escuchan
    // sesiones con date >= startDate (requiere índice .indexOn "date" en
    // las reglas de Firebase para rendimiento óptimo con mucho histórico).
    onSessionsChange(callback, startDate) {
        let ref = this.sessionsRef;
        if (startDate) {
            ref = ref.orderByChild('date').startAt(startDate);
        }
        ref.on('value', (snapshot) => {
            const data = snapshot.val();
            this._diffObserve('sessions', data, startDate ? { windowStart: startDate } : undefined);
            const sessions = data ? Object.values(data) : [];
            callback(sessions);
        });
        this.listeners.sessions.push(callback);
    }

    // Carga puntual (once) de TODAS las sesiones, sin filtrar por fecha.
    // Usada para informes PDF, comparaciones e injury-prediction que
    // necesitan histórico completo bajo demanda.
    async loadAllSessions() {
        try {
            const snapshot = await this.sessionsRef.once('value');
            const data = snapshot.val();
            this._diffAdoptFull('sessions', data);
            return data ? Object.values(data) : [];
        } catch (error) {
            console.error('Error loading full session history:', error);
            return [];
        }
    }

    // ========== PLAYERS ==========
    
    // Cargar todos los jugadores
    async loadPlayers() {
        try {
            const snapshot = await this.playersRef.once('value');
            const data = snapshot.val();
            return data ? Object.values(data) : [];
        } catch (error) {
            console.error('Error loading players:', error);
            // Fallback a localStorage
            const stored = Store.getString('players');
            return stored ? JSON.parse(stored) : [];
        }
    }

    // Guardar todos los jugadores
    async savePlayers(players) {
        if (DIFF_WRITES_ENABLED) return this._saveByDiff('players', players, 'jugadoras', { offlineLabel: 'jugadoras' });
        try {
            // Convertir array a objeto con IDs como keys
            const playersObj = {};
            players.forEach(player => {
                playersObj[player.id] = player;
            });
            await this.playersRef.set(playersObj);
            // También guardar en localStorage como backup
            Store.set('players', players);
        } catch (error) {
            console.error('Error saving players:', error);
            Store.set('players', players);
            await this._enqueueWrite('players', Object.fromEntries(players.map(p => [p.id, p])));
            this._notifyOffline('jugadoras');
        }
    }

    // Escuchar cambios en jugadores en tiempo real
    onPlayersChange(callback) {
        this.playersRef.on('value', (snapshot) => {
            const data = snapshot.val();
            this._diffObserve('players', data);
            const players = data ? Object.values(data) : [];
            callback(players);
        });
        this.listeners.players.push(callback);
    }

    // ========== UTILITIES ==========
    
    // Detener todos los listeners
    cleanup() {
        this.sessionsRef.off();
        this.playersRef.off();
        this.listeners = { sessions: [], players: [] };
    }

    // Migrar datos de localStorage a Firebase (usar una sola vez)
    async migrateFromLocalStorage() {
        const localSessions = Store.getString('sessions');
        const localPlayers = Store.getString('players');
        
        if (localSessions) {
            const sessions = JSON.parse(localSessions);
            await this.saveSessions(sessions);
            _dbg('✅ Sesiones migradas a Firebase');
        }
        
        if (localPlayers) {
            const players = JSON.parse(localPlayers);
            await this.savePlayers(players);
            _dbg('✅ Jugadores migrados a Firebase');
        }
    }

    // Verificar estado de conexión y actualizar indicador visual
    checkConnection() {
        if (!this.db) return;
        const connectedRef = this.db.ref('.info/connected');
        let wasOnline = null;
        connectedRef.on('value', (snapshot) => {
            const online = snapshot.val() === true;
            _dbg(online ? '🟢 Conectado a Firebase' : '🔴 Desconectado de Firebase');
            this.updateConnectionIndicator(online);
            if (online && wasOnline === false) {
                // Reconnect event: drain pending writes
                this._drainQueue();
            }
            wasOnline = online;
        });
        // Show initial pending count badge if any writes are queued
        this._updatePendingCount();
    }

    updateConnectionIndicator(online) {
        const indicator = document.getElementById('connectionIndicator');
        const label = indicator?.querySelector('.connection-label');
        if (!indicator || !label) return;

        indicator.className = `connection-indicator ${online ? 'online' : 'offline'}`;
        label.textContent = online ? 'En línea' : 'Sin conexión';
    }
}

// ========== GYM SESSIONS (Firebase sync) ==========

FirebaseSync.prototype.saveGymSessions = async function(gymSessions) {
    if (DIFF_WRITES_ENABLED) return this._saveByDiff('gymSessions', gymSessions, 'sesiones de gimnasio');
    try {
        const obj = {};
        if (!this.db) { Store.set('gymSessions', gymSessions); return; }
        gymSessions.forEach(s => { obj[s.id] = s; });
        await this.db.ref('gymSessions').set(obj);
        Store.set('gymSessions', gymSessions);
    } catch (e) {
        console.error('Error saving gymSessions to Firebase:', e);
        Store.set('gymSessions', gymSessions);
        await this._enqueueWrite('gymSessions', Object.fromEntries(gymSessions.map(s => [s.id, s])));
    }
};

FirebaseSync.prototype.onGymSessionsChange = function(callback) {
    if (!this.db) return;
    this.db.ref('gymSessions').on('value', snapshot => {
        const data = snapshot.val();
        this._diffObserve('gymSessions', data);
        const sessions = data ? Object.values(data) : [];
        callback(sessions);
    });
};

// ========== TEST SESSIONS (Firebase sync) ==========

FirebaseSync.prototype.saveTestSessions = async function(testSessions) {
    if (DIFF_WRITES_ENABLED) return this._saveByDiff('testSessions', testSessions, 'tests físicos');
    try {
        const obj = {};
        if (!this.db) { Store.set('testSessions', testSessions); return; }
        testSessions.forEach(s => { obj[s.id] = s; });
        await this.db.ref('testSessions').set(obj);
        Store.set('testSessions', testSessions);
    } catch (e) {
        console.error('Error saving testSessions to Firebase:', e);
        Store.set('testSessions', testSessions);
        await this._enqueueWrite('testSessions', Object.fromEntries(testSessions.map(s => [s.id, s])));
    }
};

FirebaseSync.prototype.onTestSessionsChange = function(callback) {
    if (!this.db) return;
    this.db.ref('testSessions').on('value', snapshot => {
        const data = snapshot.val();
        this._diffObserve('testSessions', data);
        const sessions = data ? Object.values(data) : [];
        callback(sessions);
    });
};

// ========== WELLNESS (Firebase sync) ==========

FirebaseSync.prototype.saveWellnessData = async function(wellnessData) {
    if (DIFF_WRITES_ENABLED) return this._saveByDiff('wellness', wellnessData, 'wellness');
    try {
        const obj = {};
        if (!this.db) { Store.set('wellnessData', wellnessData); return; }
        wellnessData.forEach(w => { obj[w.id] = w; });
        await this.db.ref('wellness').set(obj);
        Store.set('wellness', wellnessData);
    } catch (e) {
        console.error('Error saving wellness to Firebase:', e);
        Store.set('wellness', wellnessData);
        await this._enqueueWrite('wellness', Object.fromEntries(wellnessData.map(w => [w.id, w])));
    }
};

FirebaseSync.prototype.onWellnessChange = function(callback) {
    if (!this.db) return;
    this.db.ref('wellness').on('value', snapshot => {
        const data = snapshot.val();
        this._diffObserve('wellness', data);
        const entries = data ? Object.values(data) : [];
        callback(entries);
    });
};

// ========== GYM/TEST/WELLNESS MIGRATION ==========

FirebaseSync.prototype.migrateStrengthData = async function() {
    const gymRaw  = Store.getString('gymSessions');
    const testRaw = Store.getString('testSessions');
    const wellRaw = Store.getString('wellness');
    const injRaw  = Store.getString('injuries');
    const planRaw = Store.getString('weekPlan');
    if (gymRaw)  { await this.saveGymSessions(JSON.parse(gymRaw));   _dbg('✅ GymSessions migradas a Firebase'); }
    if (testRaw) { await this.saveTestSessions(JSON.parse(testRaw)); _dbg('✅ TestSessions migradas a Firebase'); }
    if (wellRaw) { await this.saveWellnessData(JSON.parse(wellRaw)); _dbg('✅ Wellness migrado a Firebase'); }
    if (injRaw)  { await this.saveInjuries(JSON.parse(injRaw));      _dbg('✅ Lesiones migradas a Firebase'); }
    if (planRaw) { await this.saveWeekPlan(JSON.parse(planRaw));     _dbg('✅ Plan semanal migrado a Firebase'); }
};

// ========== INJURIES (Firebase sync) ==========

FirebaseSync.prototype.saveInjuries = async function(injuries) {
    if (DIFF_WRITES_ENABLED) return this._saveByDiff('injuries', injuries, 'lesiones');
    try {
        const obj = {};
        if (!this.db) { Store.set('injuries', injuries); return; }
        injuries.forEach(inj => { obj[inj.id] = inj; });
        await this.db.ref('injuries').set(obj);
        Store.set('injuries', injuries);
    } catch (e) {
        console.error('Error saving injuries to Firebase:', e);
        Store.set('injuries', injuries);
        await this._enqueueWrite('injuries', Object.fromEntries(injuries.map(i => [i.id, i])));
    }
};

FirebaseSync.prototype.onInjuriesChange = function(callback) {
    if (!this.db) return;
    this.db.ref('injuries').on('value', snapshot => {
        const data = snapshot.val();
        this._diffObserve('injuries', data);
        const injuries = data ? Object.values(data) : [];
        callback(injuries);
    });
};

// ========== AVAILABILITY (Firebase sync) ==========
// Estructura: { [playerId]: { [fecha YYYY-MM-DD]: 'limited' | 'unavailable' } }

FirebaseSync.prototype.saveAvailability = async function(availability) {
    if (DIFF_WRITES_ENABLED) return this._saveByDiff('availability', availability || {}, 'disponibilidad');
    try {
        if (!this.db) { Store.set('availability', availability || {}); return; }
        await this.db.ref('availability').set(availability || {});
        Store.set('availability', availability || {});
    } catch (e) {
        console.error('Error saving availability to Firebase:', e);
        Store.set('availability', availability || {});
        await this._enqueueWrite('availability', availability || {});
    }
};

FirebaseSync.prototype.onAvailabilityChange = function(callback) {
    if (!this.db) return;
    this.db.ref('availability').on('value', snapshot => {
        this._diffObserve('availability', snapshot.val());
        // null explícito = el nodo no existe aún en Firebase (primer arranque),
        // a diferencia de {} que significa "existe pero está vacío".
        callback(snapshot.exists() ? (snapshot.val() || {}) : null);
    });
};

// ========== EXERCISE LIBRARY (Firebase sync) ==========
// Estructura: array de ejercicios { id, name, category, bilateral }

FirebaseSync.prototype.saveExerciseLibrary = async function(exerciseLibrary) {
    try {
        if (!this.db) { Store.set('exerciseLibrary', exerciseLibrary || []); return; }
        await this.db.ref('exerciseLibrary').set(exerciseLibrary || []);
        Store.set('exerciseLibrary', exerciseLibrary || []);
    } catch (e) {
        console.error('Error saving exercise library to Firebase:', e);
        Store.set('exerciseLibrary', exerciseLibrary || []);
        await this._enqueueWrite('exerciseLibrary', exerciseLibrary || []);
    }
};

FirebaseSync.prototype.onExerciseLibraryChange = function(callback) {
    if (!this.db) return;
    this.db.ref('exerciseLibrary').on('value', snapshot => {
        const val = snapshot.val();
        callback(Array.isArray(val) ? val : (val ? Object.values(val) : null));
    });
};

// ========== GYM TEMPLATES (Firebase sync) ==========
// Estructura: array de plantillas { name, exercises, createdAt }

FirebaseSync.prototype.saveGymTemplates = async function(gymTemplates) {
    try {
        if (!this.db) { Store.set('gymTemplates', gymTemplates || []); return; }
        await this.db.ref('gymTemplates').set(gymTemplates || []);
        Store.set('gymTemplates', gymTemplates || []);
    } catch (e) {
        console.error('Error saving gym templates to Firebase:', e);
        Store.set('gymTemplates', gymTemplates || []);
        await this._enqueueWrite('gymTemplates', gymTemplates || []);
    }
};

FirebaseSync.prototype.onGymTemplatesChange = function(callback) {
    if (!this.db) return;
    this.db.ref('gymTemplates').on('value', snapshot => {
        if (!snapshot.exists()) { callback(null); return; }
        const val = snapshot.val();
        callback(Array.isArray(val) ? val : Object.values(val));
    });
};

// ========== SESSION TEMPLATES / RPE (Firebase sync) ==========
// Estructura: array de plantillas de entrenamiento reutilizables

FirebaseSync.prototype.saveTemplates = async function(templates) {
    try {
        if (!this.db) { Store.set('templates', templates || []); return; }
        await this.db.ref('templates').set(templates || []);
        Store.set('templates', templates || []);
    } catch (e) {
        console.error('Error saving templates to Firebase:', e);
        Store.set('templates', templates || []);
        await this._enqueueWrite('templates', templates || []);
    }
};

FirebaseSync.prototype.onTemplatesChange = function(callback) {
    if (!this.db) return;
    this.db.ref('templates').on('value', snapshot => {
        if (!snapshot.exists()) { callback(null); return; }
        const val = snapshot.val();
        callback(Array.isArray(val) ? val : Object.values(val));
    });
};


// ========== WEEK PLAN (Firebase sync) ==========

FirebaseSync.prototype.saveWeekPlan = async function(weekPlan) {
    // Guardar primero en localStorage: si el usuario recarga la página
    // antes de que la escritura remota termine, el respaldo local ya
    // ha quedado hecho y no se pierden cambios.
    Store.set('weekPlan', weekPlan);
    try {
        if (!this.db) return;
        await this.db.ref('weekPlan').set(weekPlan);
    } catch (e) {
        console.error('Error saving weekPlan to Firebase:', e);
        await this._enqueueWrite('weekPlan', weekPlan);
    }
};

// Escucha cambios en tiempo real del plan semanal (equivalente a
// onSessionsChange/onPlayersChange). Sin esto, un dispositivo nunca
// se entera de los cambios guardados desde otro.
FirebaseSync.prototype.onWeekPlanChange = function(callback) {
    if (!this.db) return;
    this.db.ref('weekPlan').on('value', snapshot => {
        const data = snapshot.val();
        if (data) callback(data);
    });
};

FirebaseSync.prototype.saveClinicalNotes = async function(notes) {
    if (DIFF_WRITES_ENABLED) return this._saveByDiff('clinicalNotes', notes, 'notas clínicas');
    try {
        const obj = {};
        if (!this.db) { Store.set('clinicalNotes', notes); return; }
        notes.forEach(n => { obj[n.id] = n; });
        await this.db.ref('clinicalNotes').set(obj);
        Store.set('clinicalNotes', notes);
    } catch (e) {
        console.error('Error saving clinicalNotes to Firebase:', e);
        Store.set('clinicalNotes', notes);
        await this._enqueueWrite('clinicalNotes', Object.fromEntries(notes.map(n => [n.id, n])));
    }
};

FirebaseSync.prototype.onClinicalNotesChange = function(callback) {
    if (!this.db) return;
    this.db.ref('clinicalNotes').on('value', snapshot => {
        const data = snapshot.val();
        this._diffObserve('clinicalNotes', data);
        const notes = data ? Object.values(data) : [];
        callback(notes);
    });
};

FirebaseSync.prototype.saveSeasonBlocks = async function(blocks) {
    if (DIFF_WRITES_ENABLED) return this._saveByDiff('seasonBlocks', blocks || [], 'bloques de temporada');
    try {
        const obj = {};
        if (!this.db) { Store.set('seasonBlocks', blocks || []); return; }
        (blocks || []).forEach(b => { obj[b.id] = b; });
        await this.db.ref('seasonBlocks').set(obj);
        Store.set('seasonBlocks', blocks || []);
    } catch (e) {
        console.error('Error saving seasonBlocks to Firebase:', e);
        Store.set('seasonBlocks', blocks || []);
        await this._enqueueWrite('seasonBlocks', Object.fromEntries((blocks||[]).map(b => [b.id, b])));
    }
};

FirebaseSync.prototype.loadSeasonBlocks = function(callback) {
    if (!this.db) { if (callback) callback([]); return; }
    this.db.ref('seasonBlocks').once('value', snapshot => {
        const data = snapshot.val();
        this._diffObserve('seasonBlocks', data);
        const blocks = data ? Object.values(data) : [];
        Store.set('seasonBlocks', blocks);
        if (callback) callback(blocks);
    });
};

// ========== OFFLINE WRITE QUEUE (IndexedDB) ==========

FirebaseSync.prototype._idbReady = null; // Promise<IDBDatabase>

FirebaseSync.prototype._openIDB = function() {
    if (this._idbReady) return this._idbReady;
    this._idbReady = new Promise((resolve, reject) => {
        const req = indexedDB.open('rpe_offline', 1);
        req.onupgradeneeded = e => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains('rpe_pendingWrites')) {
                const store = db.createObjectStore('rpe_pendingWrites', { keyPath: 'id', autoIncrement: true });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        req.onsuccess = e => resolve(e.target.result);
        req.onerror   = e => reject(e.target.error);
    });
    return this._idbReady;
};

FirebaseSync.prototype._enqueueWrite = async function(ref, data, mode) {
    try {
        const db = await this._openIDB();
        return new Promise((resolve, reject) => {
            const tx    = db.transaction('rpe_pendingWrites', 'readwrite');
            const store = tx.objectStore('rpe_pendingWrites');
            const req   = store.add({ ref, data, mode: mode || 'set', timestamp: Date.now() });
            req.onsuccess = () => {
                resolve();
                this._updatePendingCount();
            };
            req.onerror = e => reject(e.target.error);
        });
    } catch (err) {
        console.warn('[offline-queue] Error enqueueing write:', err);
    }
};

FirebaseSync.prototype._drainQueue = async function() {
    try {
        const db = await this._openIDB();
        const all = await new Promise((resolve, reject) => {
            const tx    = db.transaction('rpe_pendingWrites', 'readonly');
            const store = tx.objectStore('rpe_pendingWrites');
            const req   = store.getAll();
            req.onsuccess = e => resolve(e.target.result);
            req.onerror   = e => reject(e.target.error);
        });

        if (!all.length) return;
        _dbg(`[offline-queue] Drenando ${all.length} escritura(s) pendiente(s)…`);

        // FIFO: sort by timestamp just in case
        all.sort((a, b) => a.timestamp - b.timestamp);

        for (const entry of all) {
            try {
                // 'patch' = solo los elementos que cambiaron (update); sin modo = colección completa (set)
                if (entry.mode === 'patch') await this.db.ref(entry.ref).update(entry.data);
                else await this.db.ref(entry.ref).set(entry.data);
                // Remove from queue on success
                await new Promise((resolve, reject) => {
                    const tx    = db.transaction('rpe_pendingWrites', 'readwrite');
                    const store = tx.objectStore('rpe_pendingWrites');
                    const req   = store.delete(entry.id);
                    req.onsuccess = resolve;
                    req.onerror   = e => reject(e.target.error);
                });
            } catch (err) {
                console.warn(`[offline-queue] Reintento fallido para ${entry.ref}:`, err);
                // Leave in queue for next reconnect
            }
        }

        this._updatePendingCount();
        this.showToast && this.showToast('☁️ Datos sincronizados con Firebase', 'success');
    } catch (err) {
        console.warn('[offline-queue] Error drenando cola:', err);
    }
};

FirebaseSync.prototype._updatePendingCount = async function() {
    try {
        const db    = await this._openIDB();
        const count = await new Promise((resolve, reject) => {
            const tx  = db.transaction('rpe_pendingWrites', 'readonly');
            const req = tx.objectStore('rpe_pendingWrites').count();
            req.onsuccess = e => resolve(e.target.result);
            req.onerror   = e => reject(e.target.error);
        });
        this._setPendingIndicator(count);
    } catch (_) { /* ignore */ }
};

FirebaseSync.prototype._setPendingIndicator = function(count) {
    const indicator = document.getElementById('connectionIndicator');
    if (!indicator) return;
    if (count > 0) {
        indicator.className = 'connection-indicator pending';
        const label = indicator.querySelector('.connection-label');
        if (label) label.textContent = `${count} pendiente${count !== 1 ? 's' : ''}`;
        indicator.title = `${count} escritura${count !== 1 ? 's' : ''} en cola`;
    } else {
        // Revert to current online/offline state — read it from the dot class
        const wasOnline = !indicator.classList.contains('offline');
        this.updateConnectionIndicator(wasOnline);
    }
};

// ========== SEASON BLOCKS — change listener (missing in prior versions) ==========

FirebaseSync.prototype.onSeasonBlocksChange = function(callback) {
    if (!this.db) return;
    this.db.ref('seasonBlocks').on('value', snapshot => {
        const data = snapshot.val();
        this._diffObserve('seasonBlocks', data);
        const blocks = data ? Object.values(data) : [];
        Store.set('seasonBlocks', blocks);
        if (callback) callback(blocks);
    });
};

// ========== INSTANTIATION (must come after all prototype methods) ==========

// Crear instancia global
// Notify user when data is saved locally only (offline/error state)
// ¿Está activa la escritura por diferencias? (la app lo consulta, p. ej. para no descargar el histórico al guardar)
FirebaseSync.prototype.diffWrites = DIFF_WRITES_ENABLED;

// Estado de sincronización por colección: lo último que este dispositivo sabe del servidor.
//   synced  = { id: forma canónica } de lo último recibido o escrito
//   loaded  = ya llegó la primera lectura (sin ella no se sabe qué ha cambiado)
//   saving  = nº de escrituras en vuelo (mientras haya, se ignoran las lecturas, igual que la app)
FirebaseSync.prototype._diffState = function(node) {
    this._ds = this._ds || {};
    return this._ds[node] || (this._ds[node] = { synced: {}, loaded: false, saving: 0, paths: !!DIFF_PATH_NODES[node], dates: {}, windowStart: '', fullAdopted: false });
};

// Llamar desde el listener de cada colección con el objeto crudo (snapshot.val()).
// opts.windowStart ('YYYY-MM-DD'): la lectura está FILTRADA (solo elementos con date >= windowStart,
// como el listener de sesiones por temporada). Lo anterior a esa fecha no aparece en la lectura,
// así que lo que ya se sabía de ahí se conserva en lugar de darlo por borrado.
FirebaseSync.prototype._diffObserve = function(node, rawObj, opts) {
    const st = this._diffState(node);
    if (st.saving > 0) return;
    const fresh = st.paths ? SyncDiff.fromRemotePaths(rawObj) : SyncDiff.fromRemote(rawObj);
    if (opts && opts.windowStart) {
        const dates = {};
        Object.keys(rawObj || {}).forEach(k => { dates[k] = rawObj[k] && rawObj[k].date; });
        const keep = {}, keepDates = {};
        Object.keys(st.synced).forEach(id => {
            const d = st.dates[id];
            if (!Object.prototype.hasOwnProperty.call(fresh, id) && typeof d === 'string' && d < opts.windowStart) {
                keep[id] = st.synced[id]; keepDates[id] = d;
            }
        });
        st.synced = Object.assign(keep, fresh);
        st.dates = Object.assign(keepDates, dates);
        st.windowStart = opts.windowStart;
    } else {
        st.synced = fresh;
        st.dates = {};
    }
    st.loaded = true;
};

// Llamar tras cargar TODO el histórico (sin filtro): la app ya tiene todos los elementos en memoria.
FirebaseSync.prototype._diffAdoptFull = function(node, rawObj) {
    const st = this._diffState(node);
    st.fullAdopted = true;
    if (st.saving > 0) return;
    const dates = {};
    Object.keys(rawObj || {}).forEach(k => { dates[k] = rawObj[k] && rawObj[k].date; });
    st.synced = SyncDiff.fromRemote(rawObj);
    st.dates = dates;
};

// Copia local (localStorage) de la colección. En colecciones leídas por ventana, si el histórico
// completo no está en memoria, se conservan las entradas anteriores a la ventana que ya estaban
// en la copia, para que sigan viéndose si la app arranca sin conexión.
FirebaseSync.prototype._storeMirror = function(node, value, st) {
    let out = value;
    if (st.windowStart && !st.fullAdopted && Array.isArray(value)) {
        try {
            const prev = JSON.parse(Store.getString(node) || '[]');
            const ids = new Set(value.map(i => String(i && i.id)));
            const older = prev.filter(i => i && typeof i.date === 'string' && i.date < st.windowStart && !ids.has(String(i.id)));
            out = value.concat(older);
        } catch (e) { /* si la copia no se puede leer, se guarda lo que hay */ }
    }
    Store.set(node, out);
};

FirebaseSync.prototype._saveLegacySetById = async function(node, list) {
    const obj = {};
    list.forEach(it => { obj[it.id] = it; });
    await this.db.ref(node).set(obj);
    this._diffState(node).synced = SyncDiff.fromRemote(obj);
};

/**
 * Guarda una colección (array de elementos con id) enviando solo lo que cambió.
 * Devuelve true si quedó guardada (o no había nada que guardar) y false si no se pudo
 * (primera lectura pendiente, o fallo de red/permisos con el cambio en la cola offline).
 */
FirebaseSync.prototype._saveByDiff = async function(node, items, label, opts) {
    opts = opts || {};
    const st = this._diffState(node);
    const value = st.paths ? (items || {}) : (Array.isArray(items) ? items : []);
    if (!this.db) { Store.set(node, value); return true; }
    if (!st.loaded) {
        // Sin la primera lectura no sabemos qué ha cambiado: no se escribe nada (misma idea
        // que el bloqueo de wellness). La lectura que llegue repondrá el estado correcto.
        console.warn(`[sync] ${node}: guardado pospuesto, aún no ha llegado la primera lectura de Firebase`);
        this._notifyNotSynced(label || node);
        return false;
    }
    const plan = st.paths ? SyncDiff.planPaths(value, st.synced) : SyncDiff.plan(value, st.synced);
    if (!plan.ok) {
        // Alguna clave no sirve en Firebase: camino de siempre (colección completa)
        this._storeMirror(node, value, st);
        try {
            if (st.paths) { await this.db.ref(node).set(value); st.synced = SyncDiff.fromRemotePaths(value); }
            else await this._saveLegacySetById(node, value);
            return true;
        } catch (e) {
            console.error(`Error saving ${node} to Firebase:`, e);
            await this._enqueueWrite(node, st.paths ? value : Object.fromEntries(value.map(it => [it.id, it])));
            if (opts.offlineLabel) this._notifyOffline(opts.offlineLabel);
            return false;
        }
    }
    this._storeMirror(node, value, st);
    if (!plan.count) return true;
    st.synced = plan.next;
    st.saving++;
    try {
        await this.db.ref(node).update(plan.patch);
        return true;
    } catch (e) {
        console.error(`Error saving ${node} to Firebase:`, e);
        await this._enqueueWrite(node, plan.patch, 'patch');
        if (opts.offlineLabel) this._notifyOffline(opts.offlineLabel);
        return false;
    } finally {
        st.saving--;
    }
};

FirebaseSync.prototype._notifyNotSynced = function(tipo) {
    const tracker = window.rpeTracker;
    if (tracker && typeof tracker.showToast === 'function') {
        tracker.showToast(`⏳ Aún sincronizando ${tipo} con Firebase. Espera unos segundos y repite el cambio.`, 'warning');
    }
};

FirebaseSync.prototype._notifyOffline = function(tipo) {
    if (typeof announceA11y === 'function') {
        announceA11y(`Guardado localmente (sin conexión a Firebase): ${tipo}`);
    }
    // Show subtle warning toast if rpeTracker available
    const tracker = window.rpeTracker;
    if (tracker && typeof tracker.showToast === 'function') {
        tracker.showToast(`⚠️ Guardado local (sin conexión). Los datos de ${tipo} se sincronizarán al reconectar.`, 'warning');
    }
};


window.firebaseSync = new FirebaseSync();

// ── Anamnesis ──────────────────────────────────────────────
FirebaseSync.prototype.saveAnamnesis = async function(playerId, data) {
    try {
        if (!this.db) { return; }
    await this.db.ref(`anamnesis/${playerId}`).set(data);
        Store.set(`anamnesis_${playerId}`, data);
    } catch (e) {
        console.error('Error saving anamnesis:', e);
        Store.set(`anamnesis_${playerId}`, data);
    }
};

FirebaseSync.prototype.loadAnamnesis = function(playerId, callback) {
    if (!this.db) { callback(null); return; }
    this.db.ref(`anamnesis/${playerId}`).once('value', snapshot => {
        const val = snapshot.val();
        if (val) { callback(val); return; }
        try {
            const local = Store.get(`anamnesis_${playerId}`);
            callback(local !== null ? local : null);
        } catch(e) { callback(null); }
    });
};

// ── Partidos / Próximos objetivos ─────────────────────────
FirebaseSync.prototype.saveMatches = async function(matches) {
    if (DIFF_WRITES_ENABLED) return this._saveByDiff('matches', matches, 'partidos');
    try {
        const obj = {};
        matches.forEach(m => { obj[m.id] = m; });
        if (!this.db) { Store.set('matches', matches); return; }
        await this.db.ref('matches').set(obj);
        Store.set('matches', matches);
    } catch (e) {
        console.error('Error saving matches:', e);
        Store.set('matches', matches);
        await this._enqueueWrite('matches', Object.fromEntries(matches.map(m => [m.id, m])));
    }
};

FirebaseSync.prototype.onMatchesChange = function(callback) {
    if (!this.db) {
        const local = Store.get('matches');
        callback(Array.isArray(local) ? local : []);
        return;
    }
    this.db.ref('matches').on('value', snapshot => {
        const val = snapshot.val();
        this._diffObserve('matches', val);
        callback(val ? Object.values(val) : []);
    });
};

// ========== GPS DATA — Oli Sports (Firebase sync) ==========
// Estructura: { [sessionGroupId]: { [playerId]: { ...métricas GPS... } } }
// sessionGroupId es el id de la sesión interna a la que se vincula el CSV.

FirebaseSync.prototype.saveGpsData = async function(gpsData) {
    try {
        if (!this.db) { Store.set('gpsData', gpsData || {}); return; }
        await this.db.ref('gpsData').set(gpsData || {});
        Store.set('gpsData', gpsData || {});
    } catch (e) {
        console.error('Error saving gpsData to Firebase:', e);
        Store.set('gpsData', gpsData || {});
        await this._enqueueWrite('gpsData', gpsData || {});
    }
};

FirebaseSync.prototype.onGpsDataChange = function(callback) {
    if (!this.db) return;
    this.db.ref('gpsData').on('value', snapshot => {
        callback(snapshot.exists() ? (snapshot.val() || {}) : null);
    });
};

// ========== GPS PLAYER MAP — mapeo ID Oli -> playerId interno ==========
// Estructura: { [oliPlayerId]: playerId }
// Se recuerda una vez confirmado el emparejamiento para no repetirlo
// en futuros imports de la misma jugadora.

FirebaseSync.prototype.saveGpsPlayerMap = async function(gpsPlayerMap) {
    try {
        if (!this.db) { Store.set('gpsPlayerMap', gpsPlayerMap || {}); return; }
        await this.db.ref('gpsPlayerMap').set(gpsPlayerMap || {});
        Store.set('gpsPlayerMap', gpsPlayerMap || {});
    } catch (e) {
        console.error('Error saving gpsPlayerMap to Firebase:', e);
        Store.set('gpsPlayerMap', gpsPlayerMap || {});
        await this._enqueueWrite('gpsPlayerMap', gpsPlayerMap || {});
    }
};

// Cambios puntuales del mapeo (edición manual del ID Oli en la ficha de la jugadora).
// A diferencia de saveGpsPlayerMap (que hace set() de TODO el nodo), update() solo toca
// las claves indicadas: { [oliPlayerId]: playerId | null } — null borra esa clave.
// Así no se pisan mapeos que otro dispositivo haya añadido mientras tanto.
// Si falla (sin conexión), cae al guardado completo con cola offline de siempre.
FirebaseSync.prototype.updateGpsPlayerMapEntries = async function(entries, fullMap) {
    try {
        if (!this.db) { Store.set('gpsPlayerMap', fullMap || {}); return; }
        await this.db.ref('gpsPlayerMap').update(entries);
        Store.set('gpsPlayerMap', fullMap || {});
    } catch (e) {
        console.error('Error updating gpsPlayerMap in Firebase:', e);
        Store.set('gpsPlayerMap', fullMap || {});
        await this._enqueueWrite('gpsPlayerMap', fullMap || {});
    }
};

FirebaseSync.prototype.onGpsPlayerMapChange = function(callback) {
    if (!this.db) return;
    this.db.ref('gpsPlayerMap').on('value', snapshot => {
        callback(snapshot.exists() ? (snapshot.val() || {}) : null);
    });
};

// Verificar conexión — se llama aquí para garantizar que todos los
// FirebaseSync.prototype.* estén definidos antes de que checkConnection
// acceda a _drainQueue y _updatePendingCount.
window.firebaseSync.checkConnection();

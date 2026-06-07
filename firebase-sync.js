// Firebase Sync Manager
// Maneja la sincronización de datos entre Firebase y la app

// Debug logger — only emits in dev mode (window._devMode = true)
const _dbg = (...a) => { if (window._devMode) console.log(...a); };


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
    onSessionsChange(callback) {
        this.sessionsRef.on('value', (snapshot) => {
            const data = snapshot.val();
            const sessions = data ? Object.values(data) : [];
            callback(sessions);
        });
        this.listeners.sessions.push(callback);
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
        const sessions = data ? Object.values(data) : [];
        callback(sessions);
    });
};

// ========== TEST SESSIONS (Firebase sync) ==========

FirebaseSync.prototype.saveTestSessions = async function(testSessions) {
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
        const sessions = data ? Object.values(data) : [];
        callback(sessions);
    });
};

// ========== WELLNESS (Firebase sync) ==========

FirebaseSync.prototype.saveWellnessData = async function(wellnessData) {
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
        const injuries = data ? Object.values(data) : [];
        callback(injuries);
    });
};

// ========== WEEK PLAN (Firebase sync) ==========

FirebaseSync.prototype.saveWeekPlan = async function(weekPlan) {
    try {
        if (!this.db) { Store.set('weekPlan', weekPlan); return; }
        await this.db.ref('weekPlan').set(weekPlan);
        Store.set('weekPlan', weekPlan);
    } catch (e) {
        console.error('Error saving weekPlan to Firebase:', e);
        Store.set('weekPlan', weekPlan);
        await this._enqueueWrite('weekPlan', weekPlan);
    }
};

FirebaseSync.prototype.saveClinicalNotes = async function(notes) {
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
        const notes = data ? Object.values(data) : [];
        callback(notes);
    });
};

FirebaseSync.prototype.saveSeasonBlocks = async function(blocks) {
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

FirebaseSync.prototype._enqueueWrite = async function(ref, data) {
    try {
        const db = await this._openIDB();
        return new Promise((resolve, reject) => {
            const tx    = db.transaction('rpe_pendingWrites', 'readwrite');
            const store = tx.objectStore('rpe_pendingWrites');
            const req   = store.add({ ref, data, timestamp: Date.now() });
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
                await this.db.ref(entry.ref).set(entry.data);
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
        const blocks = data ? Object.values(data) : [];
        Store.set('seasonBlocks', blocks);
        if (callback) callback(blocks);
    });
};

// ========== INSTANTIATION (must come after all prototype methods) ==========

// Crear instancia global
// Notify user when data is saved locally only (offline/error state)
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

// Verificar conexión — se llama aquí para garantizar que todos los
// FirebaseSync.prototype.* estén definidos antes de que checkConnection
// acceda a _drainQueue y _updatePendingCount.
window.firebaseSync.checkConnection();

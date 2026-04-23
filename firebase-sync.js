// Firebase Sync Manager
// Maneja la sincronización de datos entre Firebase y la app

class FirebaseSync {
    constructor() {
        this.db = window.firebaseDB;
        this.sessionsRef = this.db.ref('sessions');
        this.playersRef = this.db.ref('players');
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
            const stored = localStorage.getItem('basketballSessions');
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
            localStorage.setItem('basketballSessions', JSON.stringify(sessions));
        } catch (error) {
            console.error('Error saving sessions:', error);
            // Fallback a localStorage
            localStorage.setItem('basketballSessions', JSON.stringify(sessions));
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
            const stored = localStorage.getItem('basketballPlayers');
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
            localStorage.setItem('basketballPlayers', JSON.stringify(players));
        } catch (error) {
            console.error('Error saving players:', error);
            // Fallback a localStorage
            localStorage.setItem('basketballPlayers', JSON.stringify(players));
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
        const localSessions = localStorage.getItem('basketballSessions');
        const localPlayers = localStorage.getItem('basketballPlayers');
        
        if (localSessions) {
            const sessions = JSON.parse(localSessions);
            await this.saveSessions(sessions);
            console.log('✅ Sesiones migradas a Firebase');
        }
        
        if (localPlayers) {
            const players = JSON.parse(localPlayers);
            await this.savePlayers(players);
            console.log('✅ Jugadores migrados a Firebase');
        }
    }

    // Verificar estado de conexión y actualizar indicador visual
    checkConnection() {
        const connectedRef = this.db.ref('.info/connected');
        connectedRef.on('value', (snapshot) => {
            const online = snapshot.val() === true;
            console.log(online ? '🟢 Conectado a Firebase' : '🔴 Desconectado de Firebase');
            this.updateConnectionIndicator(online);
        });
    }

    updateConnectionIndicator(online) {
        const indicator = document.getElementById('connectionIndicator');
        const label = indicator?.querySelector('.connection-label');
        if (!indicator || !label) return;

        indicator.className = `connection-indicator ${online ? 'online' : 'offline'}`;
        label.textContent = online ? 'En línea' : 'Sin conexión';
    }
}

// Crear instancia global
window.firebaseSync = new FirebaseSync();

// Verificar conexión
window.firebaseSync.checkConnection();


// ========== GYM SESSIONS (Firebase sync) ==========

FirebaseSync.prototype.saveGymSessions = async function(gymSessions) {
    try {
        const obj = {};
        gymSessions.forEach(s => { obj[s.id] = s; });
        await this.db.ref('gymSessions').set(obj);
        localStorage.setItem('bk_gym_sessions', JSON.stringify(gymSessions));
    } catch (e) {
        console.error('Error saving gymSessions to Firebase:', e);
        localStorage.setItem('bk_gym_sessions', JSON.stringify(gymSessions));
    }
};

FirebaseSync.prototype.onGymSessionsChange = function(callback) {
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
        testSessions.forEach(s => { obj[s.id] = s; });
        await this.db.ref('testSessions').set(obj);
        localStorage.setItem('bk_test_sessions', JSON.stringify(testSessions));
    } catch (e) {
        console.error('Error saving testSessions to Firebase:', e);
        localStorage.setItem('bk_test_sessions', JSON.stringify(testSessions));
    }
};

FirebaseSync.prototype.onTestSessionsChange = function(callback) {
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
        wellnessData.forEach(w => { obj[w.id] = w; });
        await this.db.ref('wellness').set(obj);
        localStorage.setItem('basketballWellness', JSON.stringify(wellnessData));
    } catch (e) {
        console.error('Error saving wellness to Firebase:', e);
        localStorage.setItem('basketballWellness', JSON.stringify(wellnessData));
    }
};

FirebaseSync.prototype.onWellnessChange = function(callback) {
    this.db.ref('wellness').on('value', snapshot => {
        const data = snapshot.val();
        const entries = data ? Object.values(data) : [];
        callback(entries);
    });
};

// ========== GYM/TEST/WELLNESS MIGRATION ==========

FirebaseSync.prototype.migrateStrengthData = async function() {
    const gymRaw  = localStorage.getItem('bk_gym_sessions');
    const testRaw = localStorage.getItem('bk_test_sessions');
    const wellRaw = localStorage.getItem('basketballWellness');
    const injRaw  = localStorage.getItem('basketballInjuries');
    const planRaw = localStorage.getItem('basketballWeekPlan');
    if (gymRaw)  { await this.saveGymSessions(JSON.parse(gymRaw));   console.log('✅ GymSessions migradas a Firebase'); }
    if (testRaw) { await this.saveTestSessions(JSON.parse(testRaw)); console.log('✅ TestSessions migradas a Firebase'); }
    if (wellRaw) { await this.saveWellnessData(JSON.parse(wellRaw)); console.log('✅ Wellness migrado a Firebase'); }
    if (injRaw)  { await this.saveInjuries(JSON.parse(injRaw));      console.log('✅ Lesiones migradas a Firebase'); }
    if (planRaw) { await this.saveWeekPlan(JSON.parse(planRaw));     console.log('✅ Plan semanal migrado a Firebase'); }
};

// ========== INJURIES (Firebase sync) ==========

FirebaseSync.prototype.saveInjuries = async function(injuries) {
    try {
        const obj = {};
        injuries.forEach(inj => { obj[inj.id] = inj; });
        await this.db.ref('injuries').set(obj);
        localStorage.setItem('basketballInjuries', JSON.stringify(injuries));
    } catch (e) {
        console.error('Error saving injuries to Firebase:', e);
        localStorage.setItem('basketballInjuries', JSON.stringify(injuries));
    }
};

FirebaseSync.prototype.onInjuriesChange = function(callback) {
    this.db.ref('injuries').on('value', snapshot => {
        const data = snapshot.val();
        const injuries = data ? Object.values(data) : [];
        callback(injuries);
    });
};

// ========== WEEK PLAN (Firebase sync) ==========

FirebaseSync.prototype.saveWeekPlan = async function(weekPlan) {
    try {
        await this.db.ref('weekPlan').set(weekPlan);
        localStorage.setItem('basketballWeekPlan', JSON.stringify(weekPlan));
    } catch (e) {
        console.error('Error saving weekPlan to Firebase:', e);
        localStorage.setItem('basketballWeekPlan', JSON.stringify(weekPlan));
    }
};

FirebaseSync.prototype.onWeekPlanChange = function(callback) {
    this.db.ref('weekPlan').on('value', snapshot => {
        const data = snapshot.val();
        callback(data || null);
    });
};

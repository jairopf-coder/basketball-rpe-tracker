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

// ============================================================
//  store.js — Capa centralizada de persistencia localStorage
//  Sustituye los 84 accesos directos dispersos por un API
//  única con manejo de errores y claves tipadas.
// ============================================================

const Store = {
    KEYS: {
        sessions:         'basketballSessions',
        players:          'basketballPlayers',
        injuries:         'basketballInjuries',
        wellness:         'basketballWellness',
        wellnessData:     'wellnessData',
        availability:     'basketballAvailability',
        clinicalNotes:    'basketballClinicalNotes',
        weekPlan:         'basketballWeekPlan',
        seasonBlocks:     'rpe_seasonBlocks',
        templates:        'basketballTemplates',
        exercises:        'bk_exercises',
        gymSessions:      'bk_gym_sessions',
        gymTemplates:     'bk_gym_templates',
        testSessions:     'bk_test_sessions',
        darkMode:         'rpe_dark_mode',
        ewmaOpen:         'rpe_ewma_open',
        reminderTime:     'rpe_wellness_reminder_time',
        reminderSent:     'rpe_wellness_reminder_sent',
        currentSeason:    'rpe_current_season',
    },

    // Devuelve la temporada activa. Infiere una razonable si no hay ninguna guardada.
    getActiveSeason() {
        const stored = this.getString('currentSeason', '');
        if (stored) return stored;
        const now = new Date();
        const y   = now.getFullYear();
        const m   = now.getMonth(); // 0-based
        // Temporada empieza en septiembre (mes 8)
        const start = m >= 8 ? y : y - 1;
        return `${start}-${String(start + 1).slice(-2)}`;
    },

    // Devuelve lista única de temporadas presentes en las sesiones,
    // más la temporada activa aunque no haya sesiones aún.
    getSeasonsFromSessions(sessions) {
        const active = this.getActiveSeason();
        const set = new Set([active]);
        (sessions || []).forEach(s => { if (s.season) set.add(s.season); });
        return [...set].sort().reverse(); // más reciente primero
    },

    get(key, fallback = null) {
        try {
            const k = this.KEYS[key] || key;
            const raw = localStorage.getItem(k);
            if (raw === null) return fallback;
            return JSON.parse(raw);
        } catch (e) {
            console.warn('[Store] get error', key, e);
            return fallback;
        }
    },

    set(key, value) {
        try {
            const k = this.KEYS[key] || key;
            localStorage.setItem(k, JSON.stringify(value));
            return true;
        } catch (e) {
            console.warn('[Store] set error', key, e);
            return false;
        }
    },

    remove(key) {
        try {
            const k = this.KEYS[key] || key;
            localStorage.removeItem(k);
            return true;
        } catch (e) {
            return false;
        }
    },

    getString(key, fallback = '') {
        try {
            const k = this.KEYS[key] || key;
            return localStorage.getItem(k) ?? fallback;
        } catch (e) {
            return fallback;
        }
    },

    setString(key, value) {
        try {
            const k = this.KEYS[key] || key;
            localStorage.setItem(k, value);
            return true;
        } catch (e) {
            return false;
        }
    },
};

window.Store = Store;

// ── Timezone-safe date utility ────────────────────────────────────────────────
// new Date('YYYY-MM-DD') parses as UTC midnight, which shifts to the previous
// day in negative-offset zones (UTC-1 … UTC-12).  Always use this function
// instead of .toISOString().slice(0,10) when working with local calendar dates.
function toLocalISODate(d) {
    if (typeof d === 'string') return d.slice(0, 10);
    var y   = d.getFullYear();
    var m   = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
}
window.toLocalISODate = toLocalISODate;

// ── Ventanas de carga inicial de sesiones (paginación por temporada) ──────────
// La temporada va de finales de agosto a mediados de mayo. Se divide en dos
// bloques de ~4 meses para limitar la carga inicial de /sessions:
//   Bloque A: pretemporada + 1ª vuelta  → 1 ago  .. 31 dic
//   Bloque B: 2ª vuelta + playoffs      → 1 ene  .. 31 jul
// Devuelve la fecha de inicio (YYYY-MM-DD) del bloque al que pertenece "hoy".
function getCurrentSeasonWindowStart(now) {
    now = now || new Date();
    const year  = now.getFullYear();
    const month = now.getMonth(); // 0 = enero ... 11 = diciembre
    // Agosto (7) a diciembre (11) → bloque A, empieza el 1 de agosto de este año
    if (month >= 7) {
        return year + '-08-01';
    }
    // Enero (0) a julio (6) → bloque B, empieza el 1 de enero de este año
    return year + '-01-01';
}
window.getCurrentSeasonWindowStart = getCurrentSeasonWindowStart;

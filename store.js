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
        staffPin:         'staffPin',
        playerPin:        'playerPin',
        darkMode:         'rpe_dark_mode',
        ewmaOpen:         'rpe_ewma_open',
        reminderTime:     'rpe_wellness_reminder_time',
        reminderSent:     'rpe_wellness_reminder_sent',
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

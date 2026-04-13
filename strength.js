// ============================================================
//  MÓDULO DE RENDIMIENTO FÍSICO — strength.js
//  Gimnasio · Tests · Sugerencias
// ============================================================

// ─────────────────────────────────────────
//  BIBLIOTECA DE EJERCICIOS POR DEFECTO
// ─────────────────────────────────────────
const DEFAULT_EXERCISES = [
    // MIEMBRO INFERIOR
    { id: 'sq',    name: 'Sentadilla',              category: 'lower', bilateral: true  },
    { id: 'bs',    name: 'Back Squat',              category: 'lower', bilateral: true  },
    { id: 'fs',    name: 'Front Squat',             category: 'lower', bilateral: true  },
    { id: 'rdl',   name: 'Romanian Deadlift',       category: 'lower', bilateral: true  },
    { id: 'dl',    name: 'Peso Muerto',             category: 'lower', bilateral: true  },
    { id: 'hip',   name: 'Hip Thrust',              category: 'lower', bilateral: true  },
    { id: 'lunge', name: 'Zancada',                 category: 'lower', bilateral: false },
    { id: 'bss',   name: 'Bulgarian Split Squat',   category: 'lower', bilateral: false },
    { id: 'sldl',  name: 'Single Leg Deadlift',     category: 'lower', bilateral: false },
    { id: 'legp',  name: 'Prensa de Pierna',        category: 'lower', bilateral: true  },
    { id: 'legc',  name: 'Curl Femoral',            category: 'lower', bilateral: true  },
    { id: 'calf',  name: 'Gemelos',                 category: 'lower', bilateral: true  },
    { id: 'nham',  name: 'Nordic Hamstring',        category: 'lower', bilateral: true  },

    // MIEMBRO SUPERIOR
    { id: 'bp',    name: 'Press Banca',             category: 'upper', bilateral: true  },
    { id: 'ohp',   name: 'Press Militar',           category: 'upper', bilateral: true  },
    { id: 'row',   name: 'Remo con Barra',          category: 'upper', bilateral: true  },
    { id: 'pu',    name: 'Pull-up / Dominadas',     category: 'upper', bilateral: true  },
    { id: 'dip',   name: 'Fondos',                  category: 'upper', bilateral: true  },
    { id: 'dbrow', name: 'Remo Mancuerna',          category: 'upper', bilateral: false },
    { id: 'dbp',   name: 'Press Mancuerna',         category: 'upper', bilateral: false },
    { id: 'lat',   name: 'Jalón al Pecho',          category: 'upper', bilateral: true  },

    // COMPUESTOS / OLÍMPICOS
    { id: 'burpee',   name: 'Burpee',                   category: 'compound', bilateral: true  },
    { id: 'lunpal',   name: 'Zancada Pallof',            category: 'compound', bilateral: false },
    { id: 'lunpre',   name: 'Lunge Press',               category: 'compound', bilateral: false },
    { id: 'jumppre',  name: 'Jump Press',                category: 'compound', bilateral: true  },
    { id: 'clean',    name: 'Barbell Clean',             category: 'compound', bilateral: true  },
    { id: 'cleanp',   name: 'Barbell Clean & Press',     category: 'compound', bilateral: true  },
    { id: 'snatch',   name: 'Snatch (Arrancada)',         category: 'compound', bilateral: true  },
    { id: 'thruster', name: 'Thruster',                  category: 'compound', bilateral: true  },
    { id: 'kbswing',  name: 'Kettlebell Swing',          category: 'compound', bilateral: true  },
    { id: 'kbsnatch', name: 'Kettlebell Snatch',         category: 'compound', bilateral: false },
    { id: 'tgu',      name: 'Turkish Get-Up',            category: 'compound', bilateral: false },
    { id: 'medball',  name: 'Med Ball Slam',             category: 'compound', bilateral: true  },
    { id: 'medrot',   name: 'Med Ball Rotational Throw', category: 'compound', bilateral: false },
    { id: 'boxjump',  name: 'Box Jump',                  category: 'compound', bilateral: true  },
    { id: 'sboxjump', name: 'Single Leg Box Jump',       category: 'compound', bilateral: false },
    { id: 'steppre',  name: 'Step-up Press',             category: 'compound', bilateral: false },
    { id: 'deadbur',  name: 'Deadlift Burpee',           category: 'compound', bilateral: true  },
    { id: 'sqtrow',   name: 'Squat to Row',              category: 'compound', bilateral: true  },

    // CORE
    { id: 'plank', name: 'Plancha',                 category: 'core',  bilateral: true  },
    { id: 'siplk', name: 'Plancha Lateral',         category: 'core',  bilateral: false },
    { id: 'pallof',name: 'Pallof Press',            category: 'core',  bilateral: false },
    { id: 'deads', name: 'Dead Bug',                category: 'core',  bilateral: true  },
    { id: 'bird',  name: 'Bird Dog',                category: 'core',  bilateral: false },
    { id: 'ab',    name: 'Rueda Abdominal',         category: 'core',  bilateral: true  },
    { id: 'ghd',   name: 'GHD Sit-up',             category: 'core',  bilateral: true  },
];

const TEST_DEFINITIONS = [
    { id: 'cmj',       name: 'CMJ',                    unit: 'cm',   bilateral: false, inputType: 'flight',   description: 'Counter Movement Jump' },
    { id: 'sj',        name: 'SJ',                     unit: 'cm',   bilateral: false, inputType: 'flight',   description: 'Squat Jump' },
    { id: 'slcmj',     name: 'Single Leg CMJ',         unit: 'cm',   bilateral: true,  inputType: 'flight',   description: 'CMJ unilateral' },
    { id: 'dj',        name: 'Drop Jump',              unit: 'cm',   bilateral: false, inputType: 'flight',   description: 'Drop Jump + RSI' },
    { id: 'sts',       name: 'Side to Side Hop',       unit: 'reps', bilateral: true,  inputType: 'count',    description: 'Saltos laterales 30s' },
    { id: 'triple',    name: 'Triple Hop',             unit: 'cm',   bilateral: true,  inputType: 'distance', description: 'Triple salto unilateral' },
    { id: 'sprint10',  name: 'Sprint 10m',             unit: 's',    bilateral: false, inputType: 'time',     description: 'Tiempo en segundos' },
    { id: 'sprint20',  name: 'Sprint 20m',             unit: 's',    bilateral: false, inputType: 'time',     description: 'Tiempo en segundos' },
    { id: 'ift3015',   name: '30-15 IFT',              unit: 'km/h', bilateral: false, inputType: 'speed',    description: 'Velocidad última etapa completada (VIFT)' },
];

// ─────────────────────────────────────────
//  HELPERS
// ─────────────────────────────────────────

/** Altura de salto desde tiempo de vuelo (ms) */
function flightToHeight(ms) {
    const t = ms / 1000;
    return ((9.81 * t * t) / 8 * 100).toFixed(1); // cm
}

/** Epley 1RM estimado */
function epley1RM(weight, reps) {
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
}

/** % de asimetría entre der e izq */
function asymmetry(left, right) {
    const max = Math.max(left, right);
    if (max === 0) return 0;
    return (Math.abs(left - right) / max * 100).toFixed(1);
}

/** Color según asimetría */
function asymColor(pct) {
    const v = parseFloat(pct);
    if (v < 10)  return '#4caf50';
    if (v < 15)  return '#ff9800';
    return '#f44336';
}

// ─────────────────────────────────────────
//  CARGA / GUARDADO
// ─────────────────────────────────────────

RPETracker.prototype._loadStrengthData = function() {
    try {
        const ex  = localStorage.getItem('bk_exercises');
        const gs  = localStorage.getItem('bk_gym_sessions');
        const ts  = localStorage.getItem('bk_test_sessions');
        this.exerciseLibrary  = ex  ? JSON.parse(ex)  : DEFAULT_EXERCISES.map(e => ({...e}));
        this.gymSessions      = gs  ? JSON.parse(gs)  : [];
        this.testSessions     = ts  ? JSON.parse(ts)  : [];
    } catch(e) {
        this.exerciseLibrary  = DEFAULT_EXERCISES.map(e => ({...e}));
        this.gymSessions      = [];
        this.testSessions     = [];
    }
};

RPETracker.prototype._saveExercises    = function() { localStorage.setItem('bk_exercises',    JSON.stringify(this.exerciseLibrary)); };
RPETracker.prototype._saveGymSessions  = function() { localStorage.setItem('bk_gym_sessions', JSON.stringify(this.gymSessions)); };
RPETracker.prototype._saveTestSessions = function() { localStorage.setItem('bk_test_sessions',JSON.stringify(this.testSessions)); };

// ─────────────────────────────────────────
//  NAVEGACIÓN PRINCIPAL: GIMNASIO
// ─────────────────────────────────────────

RPETracker.prototype.renderGymView = function() {
    const el = document.getElementById('gymView');
    if (!el) return;
    if (!this.exerciseLibrary) this._loadStrengthData();

    const cats = { lower: 'Miembro Inferior', upper: 'Miembro Superior', core: 'Core', compound: 'Compuestos / Olímpicos' };

    // Sub-router: gymSubView puede ser 'list' | 'player' | 'exercise'
    const sub = this._gymSub || 'list';

    if (sub === 'player' && this._gymPlayerId) {
        this._renderGymPlayer(el);
        return;
    }
    if (sub === 'exercise' && this._gymExId) {
        this._renderGymExercise(el);
        return;
    }

    // ── Vista principal: lista de jugadoras ──
    const playerCards = this.players.length === 0
        ? '<p class="str-empty">Sin jugadoras registradas</p>'
        : this.players.map(p => {
            const sessions = (this.gymSessions || []).filter(s => s.playerId === p.id);
            const last = sessions.sort((a,b) => b.date.localeCompare(a.date))[0];
            const color = PlayerTokens.get(p);
            return `
            <div class="str-player-card" onclick="window.rpeTracker._openGymPlayer('${p.id}')">
                <div class="str-player-avatar" style="background:${color}">${p.name.charAt(0).toUpperCase()}</div>
                <div class="str-player-info">
                    <div class="str-player-name">${p.name}${p.number ? ` <span class="str-num">#${p.number}</span>` : ''}</div>
                    <div class="str-player-meta">${last ? `Última sesión: ${last.date}` : 'Sin sesiones de gimnasio'}</div>
                </div>
                <div class="str-player-arrow">›</div>
            </div>`;
        }).join('');

    el.innerHTML = `
        <div class="str-container">
            <div class="str-header">
                <h2>🏋️ Gimnasio</h2>
                <div class="str-header-actions">
                    <button class="btn-secondary" onclick="window.rpeTracker._openExerciseLibrary()">📚 Biblioteca</button>
                    <button class="btn-primary" onclick="window.rpeTracker._openNewGymSession()">+ Nueva Sesión</button>
                </div>
            </div>
            <div class="str-player-list">${playerCards}</div>
        </div>
    `;
};

RPETracker.prototype._openGymPlayer = function(playerId) {
    this._gymSub = 'player';
    this._gymPlayerId = playerId;
    this.renderGymView();
};

// ─── Vista de jugadora en gimnasio ───
RPETracker.prototype._renderGymPlayer = function(el) {
    const player = this.players.find(p => p.id === this._gymPlayerId);
    if (!player) { this._gymSub = 'list'; this.renderGymView(); return; }

    const sessions = (this.gymSessions || [])
        .filter(s => s.playerId === player.id)
        .sort((a, b) => b.date.localeCompare(a.date));

    const color = PlayerTokens.get(player);

    // ── Sugerencias ──
    const suggestions = this._buildGymSuggestions(player.id);
    const suggHTML = suggestions.length === 0 ? '' : `
        <div class="str-section">
            <h3 class="str-section-title">💡 Sugerencias para próxima sesión</h3>
            <div class="str-suggestions">
                ${suggestions.map(s => `
                <div class="str-suggestion str-suggestion--${s.type}">
                    <span class="str-sug-icon">${s.icon}</span>
                    <div>
                        <div class="str-sug-title">${s.title}</div>
                        <div class="str-sug-body">${s.body}</div>
                    </div>
                </div>`).join('')}
            </div>
        </div>`;

    // ── Historial de sesiones ──
    const sessHTML = sessions.length === 0
        ? '<p class="str-empty">Sin sesiones registradas</p>'
        : sessions.map(gs => {
            const exCount = (gs.exercises || []).length;
            return `
            <div class="str-session-row" onclick="window.rpeTracker._openGymSessionDetail('${gs.id}')">
                <div class="str-session-date">${gs.date}</div>
                <div class="str-session-info">${exCount} ejercicio${exCount !== 1 ? 's' : ''}</div>
                <div class="str-session-preview">${(gs.exercises||[]).slice(0,3).map(e => {
                    const ex = (this.exerciseLibrary||[]).find(x => x.id === e.exerciseId);
                    return ex ? ex.name : '';
                }).filter(Boolean).join(', ')}${exCount > 3 ? '...' : ''}</div>
                <button class="str-del-btn" onclick="event.stopPropagation();window.rpeTracker._deleteGymSession('${gs.id}')" title="Eliminar">🗑</button>
            </div>`;
        }).join('');

    el.innerHTML = `
        <div class="str-container">
            <div class="str-header">
                <button class="str-back-btn" onclick="window.rpeTracker._gymSub='list';window.rpeTracker.renderGymView()">← Volver</button>
                <div class="str-player-pill" style="background:${color}20;border-color:${color}40">
                    <div class="str-player-avatar str-player-avatar--sm" style="background:${color}">${player.name.charAt(0)}</div>
                    <span style="color:${color};font-weight:600">${player.name}</span>
                </div>
                <button class="btn-primary" onclick="window.rpeTracker._openNewGymSession('${player.id}')">+ Nueva Sesión</button>
            </div>

            ${suggHTML}

            <div class="str-section">
                <h3 class="str-section-title">📋 Historial de Gimnasio</h3>
                <div class="str-session-list">${sessHTML}</div>
            </div>
        </div>
    `;
};

// ─── Sugerencias de peso ───
RPETracker.prototype._buildGymSuggestions = function(playerId) {
    const suggestions = [];
    const sessions = (this.gymSessions || [])
        .filter(s => s.playerId === playerId)
        .sort((a, b) => b.date.localeCompare(a.date));

    if (sessions.length < 2) return suggestions;

    // Agrupar por ejercicio
    const byEx = {};
    sessions.forEach(gs => {
        (gs.exercises || []).forEach(e => {
            if (!byEx[e.exerciseId]) byEx[e.exerciseId] = [];
            byEx[e.exerciseId].push({ date: gs.date, sets: e.sets });
        });
    });

    Object.entries(byEx).forEach(([exId, records]) => {
        const ex = (this.exerciseLibrary || []).find(x => x.id === exId);
        if (!ex || records.length < 2) return;

        const last = records[0];
        const prev = records[1];

        // Calcular 1RM estimado de la última sesión
        const bestSet = (last.sets || []).reduce((best, s) => {
            const rm = epley1RM(s.weight || 0, s.reps || 0);
            return rm > (epley1RM(best.weight || 0, best.reps || 0)) ? s : best;
        }, last.sets?.[0] || {});

        if (!bestSet.weight || !bestSet.reps) return;

        const rm1 = epley1RM(bestSet.weight, bestSet.reps);
        const prevBest = (prev.sets || []).reduce((best, s) => {
            const rm = epley1RM(s.weight || 0, s.reps || 0);
            return rm > (epley1RM(best.weight || 0, best.reps || 0)) ? s : best;
        }, prev.sets?.[0] || {});
        const prevRm1 = epley1RM(prevBest.weight || 0, prevBest.reps || 0);

        // Estancamiento: sin progreso en 2+ sesiones
        const stagnant = records.length >= 3 && (() => {
            const rms = records.slice(0, 3).map(r => {
                const b = (r.sets||[]).reduce((best, s) => epley1RM(s.weight||0,s.reps||0) > epley1RM(best.weight||0,best.reps||0) ? s : best, r.sets?.[0]||{});
                return epley1RM(b.weight||0, b.reps||0);
            });
            return rms[0] <= rms[1] && rms[1] <= rms[2];
        })();

        if (stagnant) {
            suggestions.push({
                type: 'warning',
                icon: '⚠️',
                title: `Estancamiento en ${ex.name}`,
                body: `Sin progresión en las últimas 3 sesiones. Considera cambiar el estímulo (más intensidad, cambio de variante o deload).`
            });
        }

        // Sugerencia de peso para próxima sesión (RPE objetivo 7 → ~75% 1RM)
        const sugWeight = Math.round(rm1 * 0.75 / 2.5) * 2.5; // redondear a 2.5kg
        const progress = rm1 > prevRm1 ? `↑ +${(rm1 - prevRm1).toFixed(0)} 1RM estimado` : '';
        suggestions.push({
            type: 'info',
            icon: '🎯',
            title: `${ex.name} — peso sugerido`,
            body: `~${sugWeight} kg para RPE 7 (1RM est. ${rm1.toFixed(0)} kg). ${progress}`
        });
    });

    // RPE general alto → avisar
    const acRatio = this.calculateAcuteChronicRatio(playerId);
    const r = parseFloat(acRatio.ratio);
    if (r > 1.4) {
        suggestions.unshift({
            type: 'danger',
            icon: '🔴',
            title: 'Ratio A:C elevado',
            body: `Ratio actual ${acRatio.ratio}. Considera una sesión de gimnasio más ligera o de mantenimiento.`
        });
    }

    return suggestions.slice(0, 6); // máximo 6 sugerencias
};

// ─────────────────────────────────────────
//  MODAL NUEVA SESIÓN DE GIMNASIO
// ─────────────────────────────────────────



// ─────────────────────────────────────────
//  MIGRACIÓN: añade ejercicios que falten en biblioteca guardada
// ─────────────────────────────────────────
RPETracker.prototype._migrateExerciseLibrary = function() {
    let changed = false;
    DEFAULT_EXERCISES.forEach(def => {
        if (!this.exerciseLibrary.find(e => e.id === def.id)) {
            this.exerciseLibrary.push({...def});
            changed = true;
        }
    });
    if (changed) this._saveExercises();
};

// ─────────────────────────────────────────
//  MODAL NUEVA SESIÓN — flujo 2 pasos
//  Paso 1: seleccionar ejercicios (chips)
//  Paso 2: introducir series/reps/kg/RPE
// ─────────────────────────────────────────

RPETracker.prototype._openNewGymSession = function(preselectedPlayerId) {
    if (!this.exerciseLibrary) this._loadStrengthData();
    this._migrateExerciseLibrary();

    // Estado interno
    this._gymDate          = new Date().toISOString().slice(0, 10);
    this._gymExFilter      = 'all';
    this._gymStep          = 1;          // 1 = selección, 2 = series
    this._gymSharedRows    = [];         // ejercicios compartidos {exId, sets:[]}
    this._gymModalPlayers  = this.players.map(p => ({
        ...p,
        selected: p.id === preselectedPlayerId,
        rows: []
    }));
    // Si sólo hay una jugadora, seleccionarla
    if (this.players.length === 1) this._gymModalPlayers[0].selected = true;
    this._gymActiveTab = preselectedPlayerId || (this.players[0]?.id || null);

    let modal = document.getElementById('gymSessionModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gymSessionModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    this._renderGymModal(modal);
    modal.classList.add('active');
};

// ── Renderizado principal del modal ──
RPETracker.prototype._renderGymModal = function(modal) {
    if (!modal) modal = document.getElementById('gymSessionModal');
    if (!modal) return;

    const selectedPlayers = this._gymModalPlayers.filter(p => p.selected);
    const multiPlayer = selectedPlayers.length > 1;

    // Header con jugadoras + fecha (siempre visible)
    const playerChips = this._gymModalPlayers.map(p => {
        const active = p.selected;
        const color  = PlayerTokens.get(p);
        return `<button class="gym-player-chip ${active ? 'gym-player-chip--active' : ''}"
            style="${active
                ? `background:${color};color:#fff;border-color:${color}`
                : `border-color:${color}50;color:${color}`}"
            onclick="window.rpeTracker._toggleGymPlayer('${p.id}')">
            ${p.name.split(' ')[0]}${p.number ? ' #'+p.number : ''}
        </button>`;
    }).join('');

    // Tabs (sólo si hay >1 jugadora y estamos en paso 2)
    const tabsHTML = multiPlayer && this._gymStep === 2 ? `
        <div class="gym-tabs">
            <button class="gym-tab ${this._gymActiveTab === '__shared__' ? 'gym-tab--active' : ''}"
                onclick="window.rpeTracker._setGymTab('__shared__')">
                👥 Compartido
                <span class="gym-tab-count">${this._gymSharedRows.length}</span>
            </button>
            ${selectedPlayers.map(p => {
                const mp = this._gymModalPlayers.find(x => x.id === p.id);
                const color = PlayerTokens.get(p);
                const isActive = this._gymActiveTab === p.id;
                return `<button class="gym-tab ${isActive ? 'gym-tab--active' : ''}"
                    style="${isActive ? `border-bottom-color:${color};color:${color}` : ''}"
                    onclick="window.rpeTracker._setGymTab('${p.id}')">
                    ${p.name.split(' ')[0]}
                    <span class="gym-tab-count">${(mp?.rows||[]).length}</span>
                </button>`;
            }).join('')}
        </div>` : '';

    const stepContent = this._gymStep === 1
        ? this._renderStep1()
        : this._renderStep2();

    const footerHTML = this._gymStep === 1 ? `
        <div class="gym-modal-footer">
            <button class="btn-secondary"
                onclick="document.getElementById('gymSessionModal').classList.remove('active')">
                Cancelar
            </button>
            <button class="btn-primary" onclick="window.rpeTracker._goToStep2()">
                Siguiente →
            </button>
        </div>` : `
        <div class="gym-modal-footer">
            <button class="btn-secondary" onclick="window.rpeTracker._goToStep1()">
                ← Volver
            </button>
            <button class="btn-primary" onclick="window.rpeTracker._saveGymSession()">
                💾 Guardar sesión
            </button>
        </div>`;

    modal.innerHTML = `
        <div class="modal-content modal-content--wide">
            <div class="modal-header">
                <div class="modal-header-inner">
                    <h2>🏋️ Nueva Sesión de Gimnasio</h2>
                    <div class="gym-step-indicator">
                        <span class="gym-step-dot ${this._gymStep === 1 ? 'active' : 'done'}">1</span>
                        <span class="gym-step-line"></span>
                        <span class="gym-step-dot ${this._gymStep === 2 ? 'active' : ''}">2</span>
                    </div>
                </div>
                <button class="modal-close"
                    onclick="document.getElementById('gymSessionModal').classList.remove('active')">✕</button>
            </div>

            <div class="modal-body gym-modal-body">
                <!-- Jugadoras + fecha: siempre visible -->
                <div class="gym-modal-top">
                    <div class="gym-modal-top-players">
                        <label class="form-label">
                            ${this.players.length > 1 ? 'Jugadoras' : 'Jugadora'}
                        </label>
                        <div class="gym-player-chips">${playerChips}</div>
                    </div>
                    <div class="gym-modal-top-date">
                        <label class="form-label">Fecha</label>
                        <input type="date" id="gymDate" class="form-input"
                            value="${this._gymDate}"
                            onchange="window.rpeTracker._gymDate=this.value">
                    </div>
                </div>

                ${tabsHTML}

                ${selectedPlayers.length === 0
                    ? '<p class="str-empty">Selecciona al menos una jugadora</p>'
                    : stepContent}
            </div>

            ${footerHTML}
        </div>`;
};

// ── PASO 1: selección de ejercicios con chips ──
RPETracker.prototype._renderStep1 = function() {
    const selectedPlayers = this._gymModalPlayers.filter(p => p.selected);
    const multiPlayer = selectedPlayers.length > 1;

    // Qué ejercicios están ya seleccionados en el tab activo
    const activeSet = this._gymActiveTab === '__shared__' || !multiPlayer
        ? this._gymSharedRows.map(r => r.exId)
        : (this._gymModalPlayers.find(p => p.id === this._gymActiveTab)?.rows || []).map(r => r.exId);

    // Filtros
    const cats = [
        { key: 'all',      label: 'Todos' },
        { key: 'lower',    label: '🦵 Inf.' },
        { key: 'upper',    label: '💪 Sup.' },
        { key: 'core',     label: '🔘 Core' },
        { key: 'compound', label: '⚡ Comp.' },
    ];
    const filtersHTML = cats.map(c => `
        <button class="gym-filter-btn ${(this._gymExFilter||'all') === c.key ? 'gym-filter-btn--active' : ''}"
            onclick="window.rpeTracker._setExFilter('${c.key}')">
            ${c.label}
        </button>`).join('');

    // Chips de ejercicios
    const filtered = (this._gymExFilter && this._gymExFilter !== 'all')
        ? (this.exerciseLibrary||[]).filter(e => e.category === this._gymExFilter)
        : (this.exerciseLibrary||[]);

    const exChips = filtered.map(ex => {
        const sel = activeSet.includes(ex.id);
        return `<button class="gym-ex-chip ${sel ? 'gym-ex-chip--active' : ''}"
            onclick="window.rpeTracker._toggleExercise('${ex.id}')">
            ${sel ? '✓ ' : ''}${ex.name}
        </button>`;
    }).join('');

    const tabInfo = multiPlayer ? `
        <div class="gym-tab-info">
            ${this._gymActiveTab === '__shared__'
                ? '👥 Ejercicios que harán <strong>todas</strong> las jugadoras seleccionadas'
                : `Ejercicios exclusivos de <strong>${this.players.find(p=>p.id===this._gymActiveTab)?.name}</strong>`}
        </div>` : '';

    // Tabs en paso 1 también si hay varias jugadoras
    const tabsStep1 = multiPlayer ? `
        <div class="gym-tabs">
            <button class="gym-tab ${this._gymActiveTab === '__shared__' ? 'gym-tab--active' : ''}"
                onclick="window.rpeTracker._setGymTab('__shared__')">
                👥 Compartido
                <span class="gym-tab-count">${this._gymSharedRows.length}</span>
            </button>
            ${selectedPlayers.map(p => {
                const mp = this._gymModalPlayers.find(x => x.id === p.id);
                const color = PlayerTokens.get(p);
                const isActive = this._gymActiveTab === p.id;
                return `<button class="gym-tab ${isActive ? 'gym-tab--active' : ''}"
                    style="${isActive ? `border-bottom-color:${color};color:${color}` : ''}"
                    onclick="window.rpeTracker._setGymTab('${p.id}')">
                    ${p.name.split(' ')[0]}
                    <span class="gym-tab-count">${(mp?.rows||[]).length}</span>
                </button>`;
            }).join('')}
        </div>` : '';

    // Resumen de seleccionados
    const allSelected = [
        ...this._gymSharedRows.map(r => ({r, label: '👥'})),
        ...(multiPlayer
            ? selectedPlayers.flatMap(p =>
                (this._gymModalPlayers.find(x=>x.id===p.id)?.rows||[]).map(r => ({
                    r, label: p.name.split(' ')[0]
                })))
            : [])
    ];

    const summaryHTML = allSelected.length === 0 ? '' : `
        <div class="gym-selection-summary">
            <span class="gym-summary-label">Seleccionados (${allSelected.length}):</span>
            ${allSelected.map(({r, label}) => {
                const ex = (this.exerciseLibrary||[]).find(e => e.id === r.exId);
                return `<span class="gym-summary-chip">
                    ${ex?.name || r.exId}
                    ${multiPlayer ? `<span class="gym-summary-owner">${label}</span>` : ''}
                    <button onclick="window.rpeTracker._removeExerciseFromSelection('${r.exId}')">✕</button>
                </span>`;
            }).join('')}
        </div>`;

    return `
        <div class="gym-step1">
            <h3 class="gym-step-title">Paso 1 — Selecciona los ejercicios</h3>
            ${tabsStep1}
            ${tabInfo}
            <div class="gym-ex-filters">${filtersHTML}</div>
            <div class="gym-ex-chips-grid">${exChips || '<p class="str-empty">Sin ejercicios en esta categoría</p>'}</div>
            ${summaryHTML}
        </div>`;
};

// ── PASO 2: introducir series ──
RPETracker.prototype._renderStep2 = function() {
    const selectedPlayers = this._gymModalPlayers.filter(p => p.selected);
    const multiPlayer = selectedPlayers.length > 1;

    const currentRows = !multiPlayer || this._gymActiveTab === '__shared__'
        ? this._gymSharedRows
        : (this._gymModalPlayers.find(p => p.id === this._gymActiveTab)?.rows || []);

    if (currentRows.length === 0) {
        return '<p class="str-empty">Sin ejercicios seleccionados en esta pestaña.</p>';
    }

    const rowsHTML = currentRows.map(row => {
        const ex = (this.exerciseLibrary||[]).find(e => e.id === row.exId);
        // Defaults si primera vez
        if (!row.defaultSets)  row.defaultSets  = 3;
        if (!row.defaultReps)  row.defaultReps  = 8;
        if (!row.defaultKg)    row.defaultKg    = '';
        if (!row.defaultRpe)   row.defaultRpe   = 7;
        if (!row.sets)         row.sets = this._buildSets(row);
        if (!row.expanded)     row.expanded = false;

        const setsPreview = row.sets.map((s, i) =>
            `<div class="gym-set-detail-row">
                <span class="gym-set-num">${i+1}</span>
                <input type="number" class="gym-set-input" placeholder="Reps" value="${s.reps||''}" min="1" max="50"
                    oninput="window.rpeTracker._updateSet2('${row.exId}',${i},'reps',this.value)">
                <span class="gym-set-sep">×</span>
                <input type="number" class="gym-set-input" placeholder="kg" value="${s.weight||''}" min="0" step="0.5"
                    oninput="window.rpeTracker._updateSet2('${row.exId}',${i},'weight',this.value)">
                <span class="gym-set-sep">kg RPE</span>
                <input type="number" class="gym-set-input gym-set-input--rpe" placeholder="1-10" value="${s.rpe||''}" min="1" max="10"
                    oninput="window.rpeTracker._updateSet2('${row.exId}',${i},'rpe',this.value)">
                ${row.sets.length > 1
                    ? `<button class="gym-del-set-btn" onclick="window.rpeTracker._removeSet2('${row.exId}',${i})">✕</button>`
                    : '<span style="width:20px"></span>'}
            </div>`
        ).join('');

        return `
        <div class="gym-ex-block" id="exblock_${row.exId}">
            <div class="gym-ex-block-header">
                <span class="gym-ex-block-name">${ex?.name || row.exId}</span>
                <div class="gym-ex-block-defaults">
                    <label class="gym-def-label">Series</label>
                    <input type="number" class="gym-def-input" value="${row.defaultSets}" min="1" max="20"
                        onchange="window.rpeTracker._updateDefault('${row.exId}','defaultSets',this.value)">
                    <label class="gym-def-label">Reps</label>
                    <input type="number" class="gym-def-input" value="${row.defaultReps}" min="1" max="50"
                        onchange="window.rpeTracker._updateDefault('${row.exId}','defaultReps',this.value)">
                    <label class="gym-def-label">kg</label>
                    <input type="number" class="gym-def-input gym-def-input--kg" placeholder="—" value="${row.defaultKg}" min="0" step="0.5"
                        onchange="window.rpeTracker._updateDefault('${row.exId}','defaultKg',this.value)">
                    <label class="gym-def-label">RPE</label>
                    <input type="number" class="gym-def-input gym-def-input--rpe" value="${row.defaultRpe}" min="1" max="10"
                        onchange="window.rpeTracker._updateDefault('${row.exId}','defaultRpe',this.value)">
                    <button class="gym-apply-btn" onclick="window.rpeTracker._applyDefaults('${row.exId}')">Aplicar</button>
                </div>
                <button class="gym-expand-btn" onclick="window.rpeTracker._toggleExpand('${row.exId}')">
                    ${row.expanded ? '▲ Ocultar series' : '▼ Ver/editar series'}
                </button>
            </div>
            <div class="gym-ex-sets-detail ${row.expanded ? '' : 'gym-ex-sets-detail--hidden'}"
                id="exsets_${row.exId}">
                ${setsPreview}
                <button class="gym-add-set-btn" onclick="window.rpeTracker._addSet2('${row.exId}')">+ Serie</button>
            </div>
        </div>`;
    }).join('');

    return `
        <div class="gym-step2">
            <h3 class="gym-step-title">Paso 2 — Series, repeticiones y carga</h3>
            <p class="gym-step2-hint">Define el esquema por defecto para cada ejercicio y pulsa <strong>Aplicar</strong>. Despliega para editar series individualmente.</p>
            <div class="gym-ex-blocks">${rowsHTML}</div>
        </div>`;
};

// ── Helpers paso 1 ──
RPETracker.prototype._toggleExercise = function(exId) {
    const multiPlayer = this._gymModalPlayers.filter(p=>p.selected).length > 1;
    const isShared    = !multiPlayer || this._gymActiveTab === '__shared__';
    const targetArr   = isShared
        ? this._gymSharedRows
        : (this._gymModalPlayers.find(p=>p.id===this._gymActiveTab)?.rows || []);

    const idx = targetArr.findIndex(r => r.exId === exId);
    if (idx >= 0) {
        targetArr.splice(idx, 1); // deseleccionar
    } else {
        targetArr.push({ exId, sets: null, defaultSets:3, defaultReps:8, defaultKg:'', defaultRpe:7, expanded:false });
    }
    // Re-render solo el paso 1 (sin reconstruir todo el modal)
    const body = document.querySelector('.gym-step1');
    if (body) body.outerHTML = this._renderStep1();
    else this._renderGymModal();
};

RPETracker.prototype._removeExerciseFromSelection = function(exId) {
    this._gymSharedRows = this._gymSharedRows.filter(r => r.exId !== exId);
    this._gymModalPlayers.forEach(p => { p.rows = (p.rows||[]).filter(r => r.exId !== exId); });
    this._renderGymModal();
};

RPETracker.prototype._setExFilter = function(cat) {
    this._gymExFilter = cat;
    // Solo actualizar el contenido del paso 1, sin tocar selecciones en memoria
    const step1El = document.querySelector('.gym-step1');
    if (step1El) step1El.outerHTML = this._renderStep1();
    else this._renderGymModal();
};

RPETracker.prototype._setGymTab = function(tabId) {
    this._gymActiveTab = tabId;
    this._renderGymModal();
};

RPETracker.prototype._toggleGymPlayer = function(playerId) {
    const dateEl = document.getElementById('gymDate');
    if (dateEl) this._gymDate = dateEl.value;
    const mp = this._gymModalPlayers.find(p => p.id === playerId);
    if (!mp) return;
    mp.selected = !mp.selected;
    const selected = this._gymModalPlayers.filter(p => p.selected);
    if (!selected.find(p => p.id === this._gymActiveTab) && this._gymActiveTab !== '__shared__') {
        this._gymActiveTab = selected.length > 1 ? '__shared__' : (selected[0]?.id || null);
    }
    if (selected.length <= 1) this._gymActiveTab = selected[0]?.id || null;
    this._renderGymModal();
};

RPETracker.prototype._goToStep2 = function() {
    const dateEl = document.getElementById('gymDate');
    if (dateEl) this._gymDate = dateEl.value;
    const totalSelected = this._gymSharedRows.length +
        this._gymModalPlayers.reduce((n,p) => n + (p.rows||[]).length, 0);
    if (totalSelected === 0) { this.showToast('Selecciona al menos un ejercicio', 'error'); return; }
    if (this._gymModalPlayers.filter(p=>p.selected).length === 0) { this.showToast('Selecciona al menos una jugadora', 'error'); return; }
    this._gymStep = 2;
    // Si multi-jugadora y tab sigue siendo de jugadora, ir a shared primero
    if (this._gymModalPlayers.filter(p=>p.selected).length > 1) {
        this._gymActiveTab = '__shared__';
    }
    this._renderGymModal();
};

RPETracker.prototype._goToStep1 = function() {
    this._gymStep = 1;
    this._renderGymModal();
};

// ── Helpers paso 2 ──
RPETracker.prototype._buildSets = function(row) {
    const n = parseInt(row.defaultSets) || 3;
    const arr = [];
    for (let i = 0; i < n; i++) {
        arr.push({ reps: row.defaultReps||8, weight: row.defaultKg||'', rpe: row.defaultRpe||7 });
    }
    return arr;
};

RPETracker.prototype._updateDefault = function(exId, field, val) {
    const allRows = [...this._gymSharedRows, ...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row = allRows.find(r => r.exId === exId);
    if (!row) return;
    row[field] = field === 'defaultKg' ? (val === '' ? '' : parseFloat(val)) : parseInt(val);
};

RPETracker.prototype._applyDefaults = function(exId) {
    const allRows = [...this._gymSharedRows, ...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row = allRows.find(r => r.exId === exId);
    if (!row) return;
    row.sets = this._buildSets(row);
    // Re-render solo el bloque de este ejercicio
    const block = document.getElementById(`exblock_${exId}`);
    if (block) {
        const ex = (this.exerciseLibrary||[]).find(e => e.id === exId);
        // Re-render bloque: regenerar desde _renderStep2 sería caro, hacemos DOM quirúrgico
        const setsContainer = document.getElementById(`exsets_${exId}`);
        if (setsContainer) {
            setsContainer.innerHTML = row.sets.map((s,i) => `
                <div class="gym-set-detail-row">
                    <span class="gym-set-num">${i+1}</span>
                    <input type="number" class="gym-set-input" value="${s.reps||''}" min="1" max="50"
                        oninput="window.rpeTracker._updateSet2('${exId}',${i},'reps',this.value)">
                    <span class="gym-set-sep">×</span>
                    <input type="number" class="gym-set-input" value="${s.weight||''}" min="0" step="0.5"
                        oninput="window.rpeTracker._updateSet2('${exId}',${i},'weight',this.value)">
                    <span class="gym-set-sep">kg RPE</span>
                    <input type="number" class="gym-set-input gym-set-input--rpe" value="${s.rpe||''}" min="1" max="10"
                        oninput="window.rpeTracker._updateSet2('${exId}',${i},'rpe',this.value)">
                    ${row.sets.length > 1
                        ? `<button class="gym-del-set-btn" onclick="window.rpeTracker._removeSet2('${exId}',${i})">✕</button>`
                        : '<span style="width:20px"></span>'}
                </div>`).join('') +
                `<button class="gym-add-set-btn" onclick="window.rpeTracker._addSet2('${exId}')">+ Serie</button>`;
        }
    }
    this.showToast('✅ Aplicado', 'success');
};

RPETracker.prototype._toggleExpand = function(exId) {
    const allRows = [...this._gymSharedRows, ...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row = allRows.find(r => r.exId === exId);
    if (!row) return;
    row.expanded = !row.expanded;
    // Si no tiene sets generados, generarlos ahora
    if (!row.sets || row.sets.length === 0) row.sets = this._buildSets(row);
    const detail = document.getElementById(`exsets_${exId}`);
    const btn    = document.querySelector(`#exblock_${exId} .gym-expand-btn`);
    if (detail) detail.classList.toggle('gym-ex-sets-detail--hidden', !row.expanded);
    if (btn)    btn.textContent = row.expanded ? '▲ Ocultar series' : '▼ Ver/editar series';
};

RPETracker.prototype._updateSet2 = function(exId, si, field, val) {
    const allRows = [...this._gymSharedRows, ...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row = allRows.find(r => r.exId === exId);
    if (!row || !row.sets || !row.sets[si]) return;
    row.sets[si][field] = field === 'rpe' ? parseInt(val) : parseFloat(val);
};

RPETracker.prototype._addSet2 = function(exId) {
    const allRows = [...this._gymSharedRows, ...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row = allRows.find(r => r.exId === exId);
    if (!row) return;
    if (!row.sets) row.sets = this._buildSets(row);
    const last = row.sets[row.sets.length-1] || {};
    row.sets.push({reps: last.reps||'', weight: last.weight||'', rpe: last.rpe||''});
    const detail = document.getElementById(`exsets_${exId}`);
    if (detail) {
        const btn = detail.querySelector('.gym-add-set-btn');
        const newRow = document.createElement('div');
        newRow.className = 'gym-set-detail-row';
        const si = row.sets.length - 1;
        const s  = row.sets[si];
        newRow.innerHTML = `
            <span class="gym-set-num">${si+1}</span>
            <input type="number" class="gym-set-input" value="${s.reps||''}" min="1" max="50"
                oninput="window.rpeTracker._updateSet2('${exId}',${si},'reps',this.value)">
            <span class="gym-set-sep">×</span>
            <input type="number" class="gym-set-input" value="${s.weight||''}" min="0" step="0.5"
                oninput="window.rpeTracker._updateSet2('${exId}',${si},'weight',this.value)">
            <span class="gym-set-sep">kg RPE</span>
            <input type="number" class="gym-set-input gym-set-input--rpe" value="${s.rpe||''}" min="1" max="10"
                oninput="window.rpeTracker._updateSet2('${exId}',${si},'rpe',this.value)">
            <button class="gym-del-set-btn" onclick="window.rpeTracker._removeSet2('${exId}',${si})">✕</button>`;
        detail.insertBefore(newRow, btn);
    }
};

RPETracker.prototype._removeSet2 = function(exId, si) {
    const allRows = [...this._gymSharedRows, ...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row = allRows.find(r => r.exId === exId);
    if (!row || !row.sets || row.sets.length <= 1) return;
    row.sets.splice(si, 1);
    const detail = document.getElementById(`exsets_${exId}`);
    if (detail) {
        const btn = detail.querySelector('.gym-add-set-btn');
        detail.innerHTML = row.sets.map((s,i) => `
            <div class="gym-set-detail-row">
                <span class="gym-set-num">${i+1}</span>
                <input type="number" class="gym-set-input" value="${s.reps||''}" min="1" max="50"
                    oninput="window.rpeTracker._updateSet2('${exId}',${i},'reps',this.value)">
                <span class="gym-set-sep">×</span>
                <input type="number" class="gym-set-input" value="${s.weight||''}" min="0" step="0.5"
                    oninput="window.rpeTracker._updateSet2('${exId}',${i},'weight',this.value)">
                <span class="gym-set-sep">kg RPE</span>
                <input type="number" class="gym-set-input gym-set-input--rpe" value="${s.rpe||''}" min="1" max="10"
                    oninput="window.rpeTracker._updateSet2('${exId}',${i},'rpe',this.value)">
                ${row.sets.length > 1
                    ? `<button class="gym-del-set-btn" onclick="window.rpeTracker._removeSet2('${exId}',${i})">✕</button>`
                    : '<span style="width:20px"></span>'}
            </div>`).join('') +
            `<button class="gym-add-set-btn" onclick="window.rpeTracker._addSet2('${exId}')">+ Serie</button>`;
    }
};

// ── Guardar sesión ──
RPETracker.prototype._saveGymSession = function() {
    const dateEl = document.getElementById('gymDate');
    const date = dateEl ? dateEl.value : this._gymDate;
    if (!date) { this.showToast('Selecciona la fecha', 'error'); return; }

    const selectedPlayers = (this._gymModalPlayers||[]).filter(p => p.selected);
    if (selectedPlayers.length === 0) { this.showToast('Selecciona al menos una jugadora', 'error'); return; }

    const toExercises = rows => rows
        .filter(r => r.exId)
        .map(r => ({
            exerciseId: r.exId,
            sets: (r.sets || this._buildSets(r)).filter(s => s.reps || s.weight)
        }))
        .filter(e => e.sets.length > 0);

    const sharedExercises = toExercises(this._gymSharedRows);
    let saved = 0;

    selectedPlayers.forEach(mp => {
        const playerEx  = toExercises(mp.rows||[]);
        const allEx     = [...sharedExercises, ...playerEx];
        if (allEx.length === 0) return;
        const session = {
            id: Date.now().toString() + '_' + mp.id,
            playerId: mp.id,
            date,
            exercises: allEx,
            createdAt: new Date().toISOString()
        };
        if (!this.gymSessions) this.gymSessions = [];
        this.gymSessions.push(session);
        saved++;
    });

    if (saved === 0) { this.showToast('Añade datos de carga antes de guardar', 'error'); return; }
    this._saveGymSessions();
    document.getElementById('gymSessionModal')?.classList.remove('active');
    this.showToast(`✅ ${saved} sesión${saved>1?'es':''} guardada${saved>1?'s':''}`, 'success');
    if (this.currentView === 'gym') this.renderGymView();
};

RPETracker.prototype._deleteGymSession = function(sessionId) {
    if (!confirm('¿Eliminar esta sesión de gimnasio?')) return;
    this.gymSessions = (this.gymSessions || []).filter(s => s.id !== sessionId);
    this._saveGymSessions();
    this.showToast('Sesión eliminada', 'success');
    if (this.currentView === 'gym') this._renderGymPlayer(document.getElementById('gymView'));
};

RPETracker.prototype._openGymSessionDetail = function(sessionId) {
    const gs = (this.gymSessions || []).find(s => s.id === sessionId);
    if (!gs) return;

    let modal = document.getElementById('gymDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gymDetailModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const rows = (gs.exercises || []).map(e => {
        const ex = (this.exerciseLibrary || []).find(x => x.id === e.exerciseId);
        const name = ex ? ex.name : e.exerciseId;
        const setsHTML = (e.sets || []).map((s, i) => `
            <span class="gym-detail-set">Serie ${i+1}: ${s.reps}×${s.weight}kg RPE ${s.rpe||'—'} <span class="gym-1rm">(1RM est. ${epley1RM(s.weight||0, s.reps||0).toFixed(0)}kg)</span></span>
        `).join('');
        return `<div class="gym-detail-ex"><div class="gym-detail-ex-name">${name}</div><div class="gym-detail-sets">${setsHTML}</div></div>`;
    }).join('');

    modal.innerHTML = `
        <div class="modal-content">
            <div class="modal-header">
                <div class="modal-header-inner"><h2>Sesión Gimnasio — ${gs.date}</h2></div>
                <button class="modal-close" onclick="document.getElementById('gymDetailModal').classList.remove('active')">✕</button>
            </div>
            <div class="modal-body" style="padding:1.25rem">${rows}</div>
        </div>`;
    modal.classList.add('active');
};

// ─────────────────────────────────────────
//  BIBLIOTECA DE EJERCICIOS
// ─────────────────────────────────────────

RPETracker.prototype._openExerciseLibrary = function() {
    let modal = document.getElementById('exerciseLibraryModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'exerciseLibraryModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    this._renderLibraryModal(modal);
    modal.classList.add('active');
};

RPETracker.prototype._renderLibraryModal = function(modal) {
    const cats = { lower: '🦵 Miembro Inferior', upper: '💪 Miembro Superior', core: '🔘 Core', compound: '⚡ Compuestos / Olímpicos' };
    const byCategory = {};
    (this.exerciseLibrary || []).forEach(ex => {
        if (!byCategory[ex.category]) byCategory[ex.category] = [];
        byCategory[ex.category].push(ex);
    });

    const sectionsHTML = Object.entries(cats).map(([cat, label]) => {
        const items = (byCategory[cat] || []).map(ex => `
            <div class="lib-row" id="librow_${ex.id}">
                <span class="lib-ex-name">${ex.name}</span>
                <span class="lib-ex-meta">${ex.bilateral ? 'Bilateral' : 'Unilateral'}</span>
                <div class="lib-row-actions">
                    <button class="lib-btn lib-btn--edit" onclick="window.rpeTracker._editExercise('${ex.id}')">✏️</button>
                    <button class="lib-btn lib-btn--del" onclick="window.rpeTracker._deleteExercise('${ex.id}')">🗑</button>
                </div>
            </div>`).join('');
        return `<div class="lib-section"><div class="lib-section-title">${label}</div>${items}</div>`;
    }).join('');

    modal.innerHTML = `
        <div class="modal-content modal-content--wide">
            <div class="modal-header">
                <div class="modal-header-inner"><h2>📚 Biblioteca de Ejercicios</h2></div>
                <button class="modal-close" onclick="document.getElementById('exerciseLibraryModal').classList.remove('active')">✕</button>
            </div>
            <div class="modal-body" style="padding:1.25rem">
                ${sectionsHTML}
                <div class="lib-add-form" id="libAddForm">
                    <h3 style="margin:1.5rem 0 0.75rem;font-size:0.9rem">Añadir ejercicio nuevo</h3>
                    <div style="display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:0.5rem;align-items:end">
                        <div>
                            <label class="form-label">Nombre</label>
                            <input type="text" id="newExName" class="form-input" placeholder="Ej: Split Squat">
                        </div>
                        <div>
                            <label class="form-label">Categoría</label>
                            <select id="newExCategory" class="form-select">
                                <option value="lower">Miembro Inferior</option>
                                <option value="upper">Miembro Superior</option>
                                <option value="core">Core</option>
                                <option value="compound">Compuestos / Olímpicos</option>
                            </select>
                        </div>
                        <div>
                            <label class="form-label">Tipo</label>
                            <select id="newExBilateral" class="form-select">
                                <option value="true">Bilateral</option>
                                <option value="false">Unilateral</option>
                            </select>
                        </div>
                        <button class="btn-primary" onclick="window.rpeTracker._addExercise()" style="margin-bottom:1px">Añadir</button>
                    </div>
                </div>
            </div>
        </div>`;
};

RPETracker.prototype._addExercise = function() {
    const name = document.getElementById('newExName')?.value.trim();
    const category = document.getElementById('newExCategory')?.value;
    const bilateral = document.getElementById('newExBilateral')?.value === 'true';
    if (!name) { this.showToast('Escribe el nombre del ejercicio', 'error'); return; }
    const newEx = { id: 'custom_' + Date.now(), name, category, bilateral };
    this.exerciseLibrary.push(newEx);
    this._saveExercises();
    const modal = document.getElementById('exerciseLibraryModal');
    if (modal) this._renderLibraryModal(modal);
    this.showToast('✅ Ejercicio añadido', 'success');
};

RPETracker.prototype._deleteExercise = function(exId) {
    const ex = (this.exerciseLibrary || []).find(e => e.id === exId);
    if (!ex) return;
    if (!confirm(`¿Eliminar "${ex.name}" de la biblioteca?`)) return;
    this.exerciseLibrary = this.exerciseLibrary.filter(e => e.id !== exId);
    this._saveExercises();
    const modal = document.getElementById('exerciseLibraryModal');
    if (modal) this._renderLibraryModal(modal);
    this.showToast('Ejercicio eliminado', 'success');
};

RPETracker.prototype._editExercise = function(exId) {
    const ex = (this.exerciseLibrary || []).find(e => e.id === exId);
    if (!ex) return;
    const newName = prompt('Nuevo nombre para el ejercicio:', ex.name);
    if (!newName || !newName.trim()) return;
    ex.name = newName.trim();
    this._saveExercises();
    const modal = document.getElementById('exerciseLibraryModal');
    if (modal) this._renderLibraryModal(modal);
    this.showToast('✅ Ejercicio actualizado', 'success');
};

// ─────────────────────────────────────────
//  MÓDULO DE TESTS
// ─────────────────────────────────────────

RPETracker.prototype.renderTestsView = function() {
    const el = document.getElementById('testsView');
    if (!el) return;
    if (!this.testSessions) this._loadStrengthData();

    const sub = this._testSub || 'list';
    if (sub === 'player' && this._testPlayerId) {
        this._renderTestPlayer(el);
        return;
    }

    const playerCards = this.players.length === 0
        ? '<p class="str-empty">Sin jugadoras registradas</p>'
        : this.players.map(p => {
            const tests = (this.testSessions || []).filter(s => s.playerId === p.id);
            const last = tests.sort((a,b) => b.date.localeCompare(a.date))[0];
            const color = PlayerTokens.get(p);
            const weeksSince = last ? Math.floor((new Date() - new Date(last.date)) / (7*86400000)) : null;
            const badge = weeksSince === null
                ? '<span class="str-badge str-badge--grey">Sin tests</span>'
                : weeksSince > 8
                    ? `<span class="str-badge str-badge--red">Hace ${weeksSince} sem.</span>`
                    : `<span class="str-badge str-badge--green">Hace ${weeksSince} sem.</span>`;
            return `
            <div class="str-player-card" onclick="window.rpeTracker._openTestPlayer('${p.id}')">
                <div class="str-player-avatar" style="background:${color}">${p.name.charAt(0).toUpperCase()}</div>
                <div class="str-player-info">
                    <div class="str-player-name">${p.name}${p.number ? ` <span class="str-num">#${p.number}</span>` : ''}</div>
                    <div class="str-player-meta">${last ? `Último test: ${last.date}` : 'Sin tests registrados'}</div>
                </div>
                ${badge}
                <div class="str-player-arrow">›</div>
            </div>`;
        }).join('');

    el.innerHTML = `
        <div class="str-container">
            <div class="str-header">
                <h2>📊 Tests de Rendimiento</h2>
                <button class="btn-primary" onclick="window.rpeTracker._openNewTest()">+ Nuevo Test</button>
            </div>
            <div class="str-player-list">${playerCards}</div>
        </div>
    `;
};

RPETracker.prototype._openTestPlayer = function(playerId) {
    this._testSub = 'player';
    this._testPlayerId = playerId;
    this.renderTestsView();
};

RPETracker.prototype._renderTestPlayer = function(el) {
    const player = this.players.find(p => p.id === this._testPlayerId);
    if (!player) { this._testSub = 'list'; this.renderTestsView(); return; }

    const sessions = (this.testSessions || [])
        .filter(s => s.playerId === player.id)
        .sort((a, b) => b.date.localeCompare(a.date));

    const color = PlayerTokens.get(player);

    // ── Tabla resumen de tests ──
    const testsHTML = sessions.length === 0
        ? '<p class="str-empty">Sin tests registrados</p>'
        : sessions.map(ts => {
            const resultsHTML = Object.entries(ts.results || {}).map(([testId, val]) => {
                const def = TEST_DEFINITIONS.find(t => t.id === testId);
                if (!def) return '';
                if (def.bilateral && val.left != null && val.right != null) {
                    const asym = asymmetry(val.left, val.right);
                    const col  = asymColor(asym);
                    return `<div class="test-result-row">
                        <span class="test-result-name">${def.name}</span>
                        <span>I: <strong>${val.left}${def.unit}</strong></span>
                        <span>D: <strong>${val.right}${def.unit}</strong></span>
                        <span class="test-asym" style="color:${col}">Δ ${asym}%</span>
                    </div>`;
                }
                const display = val.value != null ? `${val.value}${def.unit}` : '—';
                return `<div class="test-result-row">
                    <span class="test-result-name">${def.name}</span>
                    <span><strong>${display}</strong></span>
                </div>`;
            }).join('');

            return `
            <div class="str-session-row str-session-row--test">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.5rem">
                    <strong>${ts.date}</strong>
                    <button class="str-del-btn" onclick="window.rpeTracker._deleteTestSession('${ts.id}')">🗑</button>
                </div>
                ${resultsHTML}
            </div>`;
        }).join('');

    // ── Evolución CMJ (si hay datos) ──
    const cmjData = sessions.filter(s => s.results?.cmj?.value).map(s => ({
        date: s.date, val: s.results.cmj.value
    })).reverse();

    el.innerHTML = `
        <div class="str-container">
            <div class="str-header">
                <button class="str-back-btn" onclick="window.rpeTracker._testSub='list';window.rpeTracker.renderTestsView()">← Volver</button>
                <div class="str-player-pill" style="background:${color}20;border-color:${color}40">
                    <div class="str-player-avatar str-player-avatar--sm" style="background:${color}">${player.name.charAt(0)}</div>
                    <span style="color:${color};font-weight:600">${player.name}</span>
                </div>
                <button class="btn-primary" onclick="window.rpeTracker._openNewTest('${player.id}')">+ Nuevo Test</button>
            </div>

            ${cmjData.length >= 2 ? `
            <div class="str-section">
                <h3 class="str-section-title">📈 Evolución CMJ</h3>
                <canvas id="cmjChart" height="120" style="width:100%;max-width:600px"></canvas>
            </div>` : ''}

            <div class="str-section">
                <h3 class="str-section-title">📋 Historial de Tests</h3>
                <div class="str-session-list">${testsHTML}</div>
            </div>
        </div>
    `;

    // Draw CMJ chart
    if (cmjData.length >= 2) {
        requestAnimationFrame(() => {
            const canvas = document.getElementById('cmjChart');
            if (!canvas || typeof Chart === 'undefined') return;
            if (canvas._chartInstance) { canvas._chartInstance.destroy(); }
            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const gridCol = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
            const textCol = isDark ? '#aaa' : '#666';
            canvas._chartInstance = new Chart(canvas.getContext('2d'), {
                type: 'line',
                data: {
                    labels: cmjData.map(d => d.date),
                    datasets: [{
                        label: 'CMJ (cm)',
                        data: cmjData.map(d => d.val),
                        borderColor: color,
                        backgroundColor: color + '22',
                        fill: true,
                        tension: 0.3,
                        pointRadius: 5,
                        pointBackgroundColor: color,
                    }]
                },
                options: {
                    responsive: true,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { ticks: { color: textCol }, grid: { color: gridCol } },
                        y: { ticks: { color: textCol }, grid: { color: gridCol }, title: { display: true, text: 'cm', color: textCol } }
                    }
                }
            });
        });
    }
};

// ─────────────────────────────────────────
//  MODAL NUEVO TEST
// ─────────────────────────────────────────

RPETracker.prototype._openNewTest = function(preselectedPlayerId) {
    if (!this.testSessions) this._loadStrengthData();

    const playerOpts = this.players.map(p =>
        `<option value="${p.id}" ${p.id === preselectedPlayerId ? 'selected' : ''}>${p.name}${p.number ? ' #'+p.number : ''}</option>`
    ).join('');
    const today = new Date().toISOString().slice(0, 10);

    let modal = document.getElementById('testModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'testModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const testsHTML = TEST_DEFINITIONS.map(def => {
        if (def.bilateral) {
            // Campos izquierda + derecha + índice asimetría calculado
            const extraLabel = def.inputType === 'flight' ? 'Tiempo vuelo (ms)' : def.unit;
            return `
            <div class="test-input-row">
                <div class="test-input-name">${def.name} <span class="test-input-desc">${def.description}</span></div>
                <div class="test-input-fields test-input-fields--bilateral">
                    <div>
                        <label class="form-label">Izquierda (${extraLabel})</label>
                        <input type="number" class="form-input" id="test_${def.id}_left" placeholder="—" step="any"
                            oninput="window.rpeTracker._updateTestAsym('${def.id}')">
                        ${def.inputType === 'flight' ? `<div class="test-height-calc" id="testH_${def.id}_left">—</div>` : ''}
                    </div>
                    <div>
                        <label class="form-label">Derecha (${extraLabel})</label>
                        <input type="number" class="form-input" id="test_${def.id}_right" placeholder="—" step="any"
                            oninput="window.rpeTracker._updateTestAsym('${def.id}')">
                        ${def.inputType === 'flight' ? `<div class="test-height-calc" id="testH_${def.id}_right">—</div>` : ''}
                    </div>
                    <div class="test-asym-display" id="testAsym_${def.id}">
                        <span class="test-asym-label">Asimetría</span>
                        <span class="test-asym-value" id="testAsymVal_${def.id}">—</span>
                    </div>
                </div>
            </div>`;
        } else {
            const label = def.inputType === 'flight' ? 'Tiempo vuelo (ms)' : `Valor (${def.unit})`;
            return `
            <div class="test-input-row">
                <div class="test-input-name">${def.name} <span class="test-input-desc">${def.description}</span></div>
                <div class="test-input-fields">
                    <div>
                        <label class="form-label">${label}</label>
                        <input type="number" class="form-input" id="test_${def.id}_value" placeholder="—" step="any"
                            oninput="window.rpeTracker._updateTestSingle('${def.id}')">
                        ${def.inputType === 'flight' ? `<div class="test-height-calc" id="testH_${def.id}_value">—</div>` : ''}
                    </div>
                </div>
            </div>`;
        }
    }).join('');

    modal.innerHTML = `
        <div class="modal-content modal-content--wide">
            <div class="modal-header">
                <div class="modal-header-inner"><h2>📊 Nuevo Test de Rendimiento</h2></div>
                <button class="modal-close" onclick="document.getElementById('testModal').classList.remove('active')">✕</button>
            </div>
            <div class="modal-body" style="padding:1.25rem">
                <div class="form-row" style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:1.5rem">
                    <div>
                        <label class="form-label">Jugadora</label>
                        <select id="testPlayerSel" class="form-select">${playerOpts}</select>
                    </div>
                    <div>
                        <label class="form-label">Fecha</label>
                        <input type="date" id="testDate" class="form-input" value="${today}">
                    </div>
                </div>
                <p style="font-size:0.8rem;color:var(--text-muted);margin-bottom:1rem">Rellena solo los tests realizados hoy. Los campos vacíos no se guardan.</p>
                <div class="test-inputs-grid">${testsHTML}</div>
                <div style="margin-top:1.5rem;text-align:right">
                    <button class="btn-secondary" onclick="document.getElementById('testModal').classList.remove('active')" style="margin-right:0.5rem">Cancelar</button>
                    <button class="btn-primary" onclick="window.rpeTracker._saveTestSession()">💾 Guardar test</button>
                </div>
            </div>
        </div>`;
    modal.classList.add('active');
};

RPETracker.prototype._updateTestAsym = function(testId) {
    const def = TEST_DEFINITIONS.find(t => t.id === testId);
    if (!def) return;
    const lEl = document.getElementById(`test_${testId}_left`);
    const rEl = document.getElementById(`test_${testId}_right`);
    const lv = parseFloat(lEl?.value);
    const rv = parseFloat(rEl?.value);

    // Altura calculada si es flight
    if (def.inputType === 'flight') {
        const lhEl = document.getElementById(`testH_${testId}_left`);
        const rhEl = document.getElementById(`testH_${testId}_right`);
        if (lhEl) lhEl.textContent = !isNaN(lv) ? `↕ ${flightToHeight(lv)} cm` : '—';
        if (rhEl) rhEl.textContent = !isNaN(rv) ? `↕ ${flightToHeight(rv)} cm` : '—';
    }

    const asymEl = document.getElementById(`testAsymVal_${testId}`);
    if (!asymEl) return;
    if (!isNaN(lv) && !isNaN(rv) && (lv > 0 || rv > 0)) {
        const pct = asymmetry(lv, rv);
        asymEl.textContent = `${pct}%`;
        asymEl.style.color = asymColor(pct);
    } else {
        asymEl.textContent = '—';
        asymEl.style.color = '';
    }
};

RPETracker.prototype._updateTestSingle = function(testId) {
    const def = TEST_DEFINITIONS.find(t => t.id === testId);
    if (!def || def.inputType !== 'flight') return;
    const el  = document.getElementById(`test_${testId}_value`);
    const hEl = document.getElementById(`testH_${testId}_value`);
    const v   = parseFloat(el?.value);
    if (hEl) hEl.textContent = !isNaN(v) ? `↕ ${flightToHeight(v)} cm` : '—';
};

RPETracker.prototype._saveTestSession = function() {
    const playerId = document.getElementById('testPlayerSel')?.value;
    const date     = document.getElementById('testDate')?.value;
    if (!playerId || !date) { this.showToast('Selecciona jugadora y fecha', 'error'); return; }

    const results = {};
    TEST_DEFINITIONS.forEach(def => {
        if (def.bilateral) {
            const lv = parseFloat(document.getElementById(`test_${def.id}_left`)?.value);
            const rv = parseFloat(document.getElementById(`test_${def.id}_right`)?.value);
            if (!isNaN(lv) || !isNaN(rv)) {
                const leftVal  = !isNaN(lv) ? (def.inputType === 'flight' ? parseFloat(flightToHeight(lv)) : lv) : null;
                const rightVal = !isNaN(rv) ? (def.inputType === 'flight' ? parseFloat(flightToHeight(rv)) : rv) : null;
                results[def.id] = { left: leftVal, right: rightVal, raw_left: lv, raw_right: rv };
            }
        } else {
            const v = parseFloat(document.getElementById(`test_${def.id}_value`)?.value);
            if (!isNaN(v)) {
                const finalVal = def.inputType === 'flight' ? parseFloat(flightToHeight(v)) : v;
                results[def.id] = { value: finalVal, raw: v };
            }
        }
    });

    if (Object.keys(results).length === 0) { this.showToast('Introduce al menos un resultado', 'error'); return; }

    const session = { id: Date.now().toString(), playerId, date, results, createdAt: new Date().toISOString() };
    if (!this.testSessions) this.testSessions = [];
    this.testSessions.push(session);
    this._saveTestSessions();

    document.getElementById('testModal')?.classList.remove('active');
    this.showToast('✅ Test guardado', 'success');
    if (this.currentView === 'tests') this.renderTestsView();
};

RPETracker.prototype._deleteTestSession = function(sessionId) {
    if (!confirm('¿Eliminar este test?')) return;
    this.testSessions = (this.testSessions || []).filter(s => s.id !== sessionId);
    this._saveTestSessions();
    this.showToast('Test eliminado', 'success');
    const el = document.getElementById('testsView');
    if (el) this._renderTestPlayer(el);
};

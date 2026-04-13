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

// ─── Vista de jugadora ───
RPETracker.prototype._renderGymPlayer = function(el) {
    const player = this.players.find(p => p.id === this._gymPlayerId);
    if (!player) { this._gymSub = 'list'; this.renderGymView(); return; }

    const sessions = (this.gymSessions || [])
        .filter(s => s.playerId === player.id)
        .sort((a, b) => b.date.localeCompare(a.date));

    const color = PlayerTokens.get(player);

    // Sugerencias
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

    const sessHTML = sessions.length === 0
        ? '<p class="str-empty">Sin sesiones registradas</p>'
        : sessions.map(gs => {
            const isPlan     = gs.status === 'planned' || !gs.status;
            const isExecuted = gs.status === 'executed';
            const exCount    = (gs.exercises || []).length;
            const statusBadge = isPlan
                ? `<span class="gym-status-badge gym-status-badge--plan">📋 Plan</span>`
                : `<span class="gym-status-badge gym-status-badge--done">✅ Ejecutada</span>`;
            const actionBtn = isPlan
                ? `<button class="btn-primary gym-exec-btn"
                    onclick="event.stopPropagation();window.rpeTracker._openExecutionModal('${gs.id}')">
                    Registrar ejecución
                   </button>`
                : '';
            const preview = (gs.exercises||[]).slice(0,3).map(e => {
                const ex = (this.exerciseLibrary||[]).find(x => x.id === e.exerciseId);
                return ex ? ex.name : '';
            }).filter(Boolean).join(', ') + (exCount > 3 ? '…' : '');

            return `
            <div class="str-session-card" onclick="window.rpeTracker._openGymSessionDetail('${gs.id}')">
                <div class="str-session-card-top">
                    <div class="str-session-card-left">
                        <span class="str-session-date">${gs.date}</span>
                        ${statusBadge}
                    </div>
                    <div class="str-session-card-right">
                        ${actionBtn}
                        <button class="str-del-btn"
                            onclick="event.stopPropagation();window.rpeTracker._deleteGymSession('${gs.id}')"
                            title="Eliminar">🗑</button>
                    </div>
                </div>
                <div class="str-session-preview">${exCount} ejercicio${exCount!==1?'s':''}: ${preview}</div>
            </div>`;
        }).join('');

    el.innerHTML = `
        <div class="str-container">
            <div class="str-header">
                <button class="str-back-btn"
                    onclick="window.rpeTracker._gymSub='list';window.rpeTracker.renderGymView()">← Volver</button>
                <div class="str-player-pill" style="background:${color}20;border-color:${color}40">
                    <div class="str-player-avatar str-player-avatar--sm" style="background:${color}">${player.name.charAt(0)}</div>
                    <span style="color:${color};font-weight:600">${player.name}</span>
                </div>
                <button class="btn-primary" onclick="window.rpeTracker._openNewGymSession('${player.id}')">+ Nueva sesión</button>
            </div>
            ${suggHTML}
            <div class="str-section">
                <h3 class="str-section-title">📋 Historial de Gimnasio</h3>
                <div class="str-session-list">${sessHTML}</div>
            </div>
        </div>`;
};

// ─── Sugerencias ───
RPETracker.prototype._buildGymSuggestions = function(playerId) {
    const suggestions = [];
    const sessions = (this.gymSessions || [])
        .filter(s => s.playerId === playerId && s.status === 'executed')
        .sort((a, b) => b.date.localeCompare(a.date));

    if (sessions.length < 2) return suggestions;

    const byEx = {};
    sessions.forEach(gs => {
        (gs.exercises || []).forEach(e => {
            if (!byEx[e.exerciseId]) byEx[e.exerciseId] = [];
            byEx[e.exerciseId].push({ date: gs.date, sets: e.actual || e.sets });
        });
    });

    Object.entries(byEx).forEach(([exId, records]) => {
        const ex = (this.exerciseLibrary || []).find(x => x.id === exId);
        if (!ex || records.length < 2) return;

        const best = s => epley1RM(s.weight||0, s.reps||0);
        const rm1Last = Math.max(...(records[0].sets||[]).map(best));
        const rm1Prev = Math.max(...(records[1].sets||[]).map(best));

        if (rm1Last <= 0) return;

        const stagnant = records.length >= 3 && (() => {
            const rms = records.slice(0,3).map(r => Math.max(...(r.sets||[]).map(best)));
            return rms[0] <= rms[1] && rms[1] <= rms[2];
        })();

        if (stagnant) suggestions.push({
            type: 'warning', icon: '⚠️',
            title: `Estancamiento en ${ex.name}`,
            body: 'Sin progresión en las últimas 3 sesiones ejecutadas. Considera cambiar el estímulo.'
        });

        const sugWeight = Math.round(rm1Last * 0.75 / 2.5) * 2.5;
        const progress  = rm1Last > rm1Prev ? `↑ +${(rm1Last-rm1Prev).toFixed(0)} 1RM estimado` : '';
        suggestions.push({
            type: 'info', icon: '🎯',
            title: `${ex.name} — peso sugerido`,
            body: `~${sugWeight} kg para RPE 7 (1RM est. ${rm1Last.toFixed(0)} kg). ${progress}`
        });
    });

    const acRatio = this.calculateAcuteChronicRatio(playerId);
    const r = parseFloat(acRatio.ratio);
    if (r > 1.4) suggestions.unshift({
        type: 'danger', icon: '🔴',
        title: 'Ratio A:C elevado',
        body: `Ratio actual ${acRatio.ratio}. Considera una sesión más ligera.`
    });

    return suggestions.slice(0, 6);
};

// ─── Detalle de sesión: Plan vs Real ───
RPETracker.prototype._openGymSessionDetail = function(sessionId) {
    const gs = (this.gymSessions||[]).find(s => s.id === sessionId);
    if (!gs) return;

    let modal = document.getElementById('gymDetailModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'gymDetailModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }

    const isPlan = gs.status === 'planned' || !gs.status;

    const exRows = (gs.exercises||[]).map(e => {
        const ex      = (this.exerciseLibrary||[]).find(x => x.id === e.exerciseId);
        const name    = ex ? ex.name : e.exerciseId;
        const planned = e.sets || [];
        const actual  = e.actual || [];

        const planHTML = planned.map((s,i) =>
            `<div class="pvr-set">
                <span class="pvr-set-num">${i+1}</span>
                <span>${s.reps||'—'}×${s.weight||'—'}kg</span>
                <span class="pvr-rpe">RPE ${s.rpe||'—'}</span>
                <span class="pvr-1rm">${s.weight&&s.reps ? epley1RM(s.weight,s.reps).toFixed(0)+'kg 1RM' : ''}</span>
            </div>`
        ).join('');

        const actualHTML = !isPlan && actual.length > 0
            ? actual.map((s,i) => {
                const ps = planned[i] || {};
                const deltaKg  = s.weight && ps.weight ? s.weight - ps.weight : null;
                const deltaRpe = s.rpe    && ps.rpe    ? s.rpe    - ps.rpe    : null;
                const deltaCol = d => d > 0 ? '#4caf50' : d < 0 ? '#f44336' : '#999';
                return `<div class="pvr-set pvr-set--actual">
                    <span class="pvr-set-num">${i+1}</span>
                    <span>${s.reps||'—'}×${s.weight||'—'}kg</span>
                    <span class="pvr-rpe">RPE ${s.rpe||'—'}</span>
                    ${deltaKg  !== null ? `<span class="pvr-delta" style="color:${deltaCol(deltaKg)}">${deltaKg>0?'+':''}${deltaKg}kg</span>` : ''}
                    ${deltaRpe !== null ? `<span class="pvr-delta" style="color:${deltaCol(-deltaRpe)}">RPE${deltaRpe>0?'+':''}${deltaRpe}</span>` : ''}
                </div>`;
            }).join('')
            : isPlan ? '' : '<span class="pvr-empty">Sin ejecución registrada</span>';

        return `
        <div class="pvr-ex-block">
            <div class="pvr-ex-name">${name}</div>
            <div class="pvr-columns">
                <div class="pvr-col">
                    <div class="pvr-col-label">📋 Plan</div>
                    ${planHTML}
                </div>
                ${!isPlan ? `<div class="pvr-col">
                    <div class="pvr-col-label">✅ Real</div>
                    ${actualHTML}
                </div>` : ''}
            </div>
        </div>`;
    }).join('');

    const execBtn = isPlan
        ? `<button class="btn-primary" onclick="document.getElementById('gymDetailModal').classList.remove('active');window.rpeTracker._openExecutionModal('${gs.id}')">
               Registrar ejecución
           </button>` : '';

    modal.innerHTML = `
        <div class="modal-content modal-content--wide">
            <div class="modal-header">
                <div class="modal-header-inner">
                    <h2>${isPlan ? '📋 Plan' : '📊 Plan vs Real'} — ${gs.date}</h2>
                </div>
                <button class="modal-close"
                    onclick="document.getElementById('gymDetailModal').classList.remove('active')">✕</button>
            </div>
            <div class="modal-body" style="padding:1.25rem;max-height:70vh;overflow-y:auto">
                ${exRows}
            </div>
            ${execBtn ? `<div style="padding:1rem 1.25rem;border-top:1px solid var(--border);text-align:right">${execBtn}</div>` : ''}
        </div>`;
    modal.classList.add('active');
};

// ─── Modal de ejecución: jugadora por jugadora ───
RPETracker.prototype._openExecutionModal = function(sessionId) {
    // Encontrar todas las sesiones del mismo "grupo" (misma fecha + mismo plan)
    const gs = (this.gymSessions||[]).find(s => s.id === sessionId);
    if (!gs) return;

    // Sesiones hermanas = misma fecha, mismo plan (planGroupId si existe, sino solo esta)
    const groupId   = gs.planGroupId || gs.id;
    const siblings  = (this.gymSessions||[]).filter(s =>
        (s.planGroupId === groupId || s.id === groupId || s.id === sessionId) &&
        (s.status === 'planned' || !s.status)
    );

    this._execSessions  = siblings.length > 0 ? siblings : [gs];
    this._execIndex     = 0; // índice de jugadora actual
    this._execDraft     = {}; // {sessionId: {exId: [{reps,weight,rpe}]}}

    // Inicializar draft con copia del plan
    this._execSessions.forEach(s => {
        this._execDraft[s.id] = {};
        (s.exercises||[]).forEach(e => {
            this._execDraft[s.id][e.exerciseId] = (e.sets||[]).map(set => ({...set}));
        });
    });

    let modal = document.getElementById('execModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'execModal';
        modal.className = 'modal';
        document.body.appendChild(modal);
    }
    this._renderExecModal(modal);
    modal.classList.add('active');
};

RPETracker.prototype._renderExecModal = function(modal) {
    if (!modal) modal = document.getElementById('execModal');
    if (!modal) return;

    const sessions = this._execSessions || [];
    const idx      = this._execIndex || 0;
    const gs       = sessions[idx];
    if (!gs) return;

    const player  = this.players.find(p => p.id === gs.playerId);
    const color   = player ? PlayerTokens.get(player) : '#ff6600';
    const draft   = (this._execDraft||{})[gs.id] || {};

    // Navegación entre jugadoras
    const navHTML = sessions.length > 1 ? `
        <div class="exec-player-nav">
            ${sessions.map((s, i) => {
                const p = this.players.find(x => x.id === s.playerId);
                const c = p ? PlayerTokens.get(p) : '#ccc';
                const done = (this._execDone||{})[s.id];
                return `<button class="exec-player-tab ${i===idx?'exec-player-tab--active':''}"
                    style="${i===idx?`border-bottom-color:${c};color:${c}`:''}"
                    onclick="window.rpeTracker._execSaveCurrentAndGo(${i})">
                    ${done ? '✅ ' : ''}${p ? p.name.split(' ')[0] : 'Jugadora'}
                </button>`;
            }).join('')}
        </div>` : '';

    // Ejercicios
    const exRows = (gs.exercises||[]).map(e => {
        const ex      = (this.exerciseLibrary||[]).find(x => x.id === e.exerciseId);
        const name    = ex ? ex.name : e.exerciseId;
        const plan    = e.sets || [];
        const actual  = draft[e.exerciseId] || plan.map(s => ({...s}));

        const setsHTML = actual.map((s, i) => {
            const ps = plan[i] || {};
            return `<div class="exec-set-row">
                <span class="exec-set-num">${i+1}</span>
                <div class="exec-set-plan">
                    <span class="exec-plan-val">${ps.reps||'—'} reps</span>
                    <span class="exec-plan-val">${ps.weight||'—'} kg</span>
                    <span class="exec-plan-val">RPE ${ps.rpe||'—'}</span>
                </div>
                <span class="exec-arrow">→</span>
                <div class="exec-set-actual">
                    <input type="number" class="exec-input" value="${s.reps||''}" placeholder="${ps.reps||''}"
                        oninput="window.rpeTracker._execUpdate('${gs.id}','${e.exerciseId}',${i},'reps',this.value)">
                    <input type="number" class="exec-input exec-input--kg" value="${s.weight||''}" placeholder="${ps.weight||''}" step="0.5"
                        oninput="window.rpeTracker._execUpdate('${gs.id}','${e.exerciseId}',${i},'weight',this.value)">
                    <input type="number" class="exec-input exec-input--rpe" value="${s.rpe||''}" placeholder="${ps.rpe||''}" min="1" max="10"
                        oninput="window.rpeTracker._execUpdate('${gs.id}','${e.exerciseId}',${i},'rpe',this.value)">
                </div>
            </div>`;
        }).join('');

        return `
        <div class="exec-ex-block">
            <div class="exec-ex-header">
                <span class="exec-ex-name">${name}</span>
                <button class="exec-eq-btn"
                    onclick="window.rpeTracker._execEqualPlan('${gs.id}','${e.exerciseId}')">
                    = Igual al plan
                </button>
            </div>
            <div class="exec-set-labels">
                <span></span>
                <span class="exec-label">Plan</span>
                <span></span>
                <span class="exec-label">Real (edita si difiere)</span>
            </div>
            ${setsHTML}
        </div>`;
    }).join('');

    const isLast = idx === sessions.length - 1;

    modal.innerHTML = `
        <div class="modal-content modal-content--wide">
            <div class="modal-header">
                <div class="modal-header-inner">
                    <h2>✅ Registrar ejecución — ${gs.date}</h2>
                </div>
                <button class="modal-close"
                    onclick="document.getElementById('execModal').classList.remove('active')">✕</button>
            </div>
            <div class="modal-body" style="padding:0;overflow:hidden;display:flex;flex-direction:column;max-height:75vh">
                ${navHTML}
                <div style="padding:0.75rem 1.25rem;background:${color}10;border-bottom:1px solid ${color}30;display:flex;align-items:center;gap:0.75rem">
                    <div class="str-player-avatar str-player-avatar--sm" style="background:${color}">${player?.name?.charAt(0)||'?'}</div>
                    <strong style="color:${color}">${player?.name||'Jugadora'}</strong>
                    <span style="font-size:0.78rem;color:var(--text-muted)">${(gs.exercises||[]).length} ejercicios</span>
                </div>
                <div style="padding:1rem 1.25rem;overflow-y:auto;flex:1">
                    <p style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.75rem">
                        Los campos muestran el plan. Edita solo lo que difiera. Pulsa "= Igual al plan" si ejecutó exactamente lo planificado.
                    </p>
                    ${exRows}
                </div>
            </div>
            <div style="padding:0.85rem 1.25rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;background:var(--bg-surface)">
                <span style="font-size:0.8rem;color:var(--text-muted)">${idx+1} / ${sessions.length}</span>
                <div style="display:flex;gap:0.5rem">
                    ${idx > 0 ? `<button class="btn-secondary" onclick="window.rpeTracker._execSaveCurrentAndGo(${idx-1})">← Anterior</button>` : ''}
                    ${!isLast
                        ? `<button class="btn-primary" onclick="window.rpeTracker._execSaveCurrentAndGo(${idx+1})">Siguiente →</button>`
                        : `<button class="btn-primary" onclick="window.rpeTracker._execSaveAll()">💾 Guardar todo</button>`}
                </div>
            </div>
        </div>`;
};

RPETracker.prototype._execUpdate = function(sessionId, exId, si, field, val) {
    if (!this._execDraft[sessionId]) this._execDraft[sessionId] = {};
    if (!this._execDraft[sessionId][exId]) this._execDraft[sessionId][exId] = [];
    if (!this._execDraft[sessionId][exId][si]) this._execDraft[sessionId][exId][si] = {};
    this._execDraft[sessionId][exId][si][field] = field === 'rpe' ? parseInt(val) : parseFloat(val);
};

RPETracker.prototype._execEqualPlan = function(sessionId, exId) {
    const gs   = (this.gymSessions||[]).find(s => s.id === sessionId);
    const ex   = (gs?.exercises||[]).find(e => e.exerciseId === exId);
    if (!ex) return;
    if (!this._execDraft[sessionId]) this._execDraft[sessionId] = {};
    this._execDraft[sessionId][exId] = (ex.sets||[]).map(s => ({...s}));
    // Re-render solo el bloque de este ejercicio
    this._renderExecModal();
};

RPETracker.prototype._execSaveCurrentAndGo = function(nextIdx) {
    // Marcar jugadora actual como "vista"
    if (!this._execDone) this._execDone = {};
    const cur = this._execSessions[this._execIndex];
    if (cur) this._execDone[cur.id] = true;
    this._execIndex = nextIdx;
    this._renderExecModal();
};

RPETracker.prototype._execSaveAll = function() {
    // Guardar el draft de la jugadora actual
    if (!this._execDone) this._execDone = {};
    const cur = this._execSessions[this._execIndex];
    if (cur) this._execDone[cur.id] = true;

    // Aplicar draft a cada sesión
    this._execSessions.forEach(gs => {
        const draft = (this._execDraft||{})[gs.id] || {};
        gs.exercises = (gs.exercises||[]).map(e => ({
            ...e,
            actual: draft[e.exerciseId] || e.sets
        }));
        gs.status = 'executed';
        gs.executedAt = new Date().toISOString();
    });

    this._saveGymSessions();
    document.getElementById('execModal')?.classList.remove('active');

    const n = this._execSessions.length;
    this.showToast(`✅ Ejecución guardada para ${n} jugadora${n>1?'s':''}`, 'success');
    if (this.currentView === 'gym') this.renderGymView();
};


// ─────────────────────────────────────────
//  MIGRACIÓN + MODAL NUEVA SESIÓN (2 pasos)
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

RPETracker.prototype._openNewGymSession = function(preselectedPlayerId) {
    if (!this.exerciseLibrary) this._loadStrengthData();
    this._migrateExerciseLibrary();

    this._gymDate         = new Date().toISOString().slice(0, 10);
    this._gymExFilter     = 'all';
    this._gymStep         = 1;
    this._gymSharedRows   = [];
    this._gymModalPlayers = this.players.map(p => ({
        ...p, selected: p.id === preselectedPlayerId, rows: []
    }));
    if (this.players.length === 1) this._gymModalPlayers[0].selected = true;
    this._gymActiveTab = preselectedPlayerId || (this.players[0]?.id || null);

    let modal = document.getElementById('gymSessionModal');
    if (!modal) { modal = document.createElement('div'); modal.id = 'gymSessionModal'; modal.className = 'modal'; document.body.appendChild(modal); }
    this._renderGymModal(modal);
    modal.classList.add('active');
};

RPETracker.prototype._renderGymModal = function(modal) {
    if (!modal) modal = document.getElementById('gymSessionModal');
    if (!modal) return;

    const selected = this._gymModalPlayers.filter(p => p.selected);
    const multi    = selected.length > 1;

    const playerChips = this._gymModalPlayers.map(p => {
        const on = p.selected; const color = PlayerTokens.get(p);
        return `<button class="gym-player-chip ${on?'gym-player-chip--active':''}"
            style="${on?`background:${color};color:#fff;border-color:${color}`:`border-color:${color}50;color:${color}`}"
            onclick="window.rpeTracker._toggleGymPlayer('${p.id}')">
            ${p.name.split(' ')[0]}${p.number?' #'+p.number:''}
        </button>`;
    }).join('');

    const stepContent = this._gymStep === 1 ? this._renderStep1() : this._renderStep2();

    const footer = this._gymStep === 1
        ? `<div class="gym-modal-footer">
               <button class="btn-secondary" onclick="document.getElementById('gymSessionModal').classList.remove('active')">Cancelar</button>
               <button class="btn-primary" onclick="window.rpeTracker._goToStep2()">Siguiente →</button>
           </div>`
        : `<div class="gym-modal-footer">
               <button class="btn-secondary" onclick="window.rpeTracker._goToStep1()">← Volver</button>
               <button class="btn-primary" onclick="window.rpeTracker._saveGymSession()">💾 Guardar plan</button>
           </div>`;

    modal.innerHTML = `
        <div class="modal-content modal-content--wide">
            <div class="modal-header">
                <div class="modal-header-inner">
                    <h2>🏋️ Nueva Sesión</h2>
                    <div class="gym-step-indicator">
                        <span class="gym-step-dot ${this._gymStep===1?'active':'done'}">1</span>
                        <span class="gym-step-line"></span>
                        <span class="gym-step-dot ${this._gymStep===2?'active':''}">2</span>
                    </div>
                </div>
                <button class="modal-close" onclick="document.getElementById('gymSessionModal').classList.remove('active')">✕</button>
            </div>
            <div class="modal-body gym-modal-body">
                <div class="gym-modal-top">
                    <div class="gym-modal-top-players">
                        <label class="form-label">${this.players.length>1?'Jugadoras':'Jugadora'}</label>
                        <div class="gym-player-chips">${playerChips}</div>
                    </div>
                    <div class="gym-modal-top-date">
                        <label class="form-label">Fecha</label>
                        <input type="date" id="gymDate" class="form-input" value="${this._gymDate}"
                            onchange="window.rpeTracker._gymDate=this.value">
                    </div>
                </div>
                ${selected.length===0 ? '<p class="str-empty">Selecciona al menos una jugadora</p>' : stepContent}
            </div>
            ${footer}
        </div>`;
};

RPETracker.prototype._renderStep1 = function() {
    const selected = this._gymModalPlayers.filter(p => p.selected);
    const multi    = selected.length > 1;

    const tabsHTML = multi ? `<div class="gym-tabs">
        <button class="gym-tab ${this._gymActiveTab==='__shared__'?'gym-tab--active':''}"
            onclick="window.rpeTracker._setGymTab('__shared__')">
            👥 Compartido <span class="gym-tab-count">${this._gymSharedRows.length}</span>
        </button>
        ${selected.map(p => {
            const mp = this._gymModalPlayers.find(x=>x.id===p.id);
            const color = PlayerTokens.get(p); const isA = this._gymActiveTab===p.id;
            return `<button class="gym-tab ${isA?'gym-tab--active':''}"
                style="${isA?`border-bottom-color:${color};color:${color}`:''}"
                onclick="window.rpeTracker._setGymTab('${p.id}')">
                ${p.name.split(' ')[0]} <span class="gym-tab-count">${(mp?.rows||[]).length}</span>
            </button>`;
        }).join('')}
    </div>` : '';

    const activeSet = (!multi || this._gymActiveTab==='__shared__')
        ? this._gymSharedRows.map(r=>r.exId)
        : (this._gymModalPlayers.find(p=>p.id===this._gymActiveTab)?.rows||[]).map(r=>r.exId);

    const cats = [{key:'all',label:'Todos'},{key:'lower',label:'🦵 Inf.'},{key:'upper',label:'💪 Sup.'},{key:'core',label:'🔘 Core'},{key:'compound',label:'⚡ Comp.'}];
    const filters = cats.map(c=>`<button class="gym-filter-btn ${(this._gymExFilter||'all')===c.key?'gym-filter-btn--active':''}"
        onclick="window.rpeTracker._setExFilter('${c.key}')">${c.label}</button>`).join('');

    const lib = (this._gymExFilter&&this._gymExFilter!=='all')
        ? (this.exerciseLibrary||[]).filter(e=>e.category===this._gymExFilter)
        : (this.exerciseLibrary||[]);

    const chips = lib.map(ex => {
        const on = activeSet.includes(ex.id);
        return `<button class="gym-ex-chip ${on?'gym-ex-chip--active':''}"
            onclick="window.rpeTracker._toggleExercise('${ex.id}')">
            ${on?'✓ ':''}${ex.name}
        </button>`;
    }).join('');

    const allSelected = [
        ...this._gymSharedRows.map(r=>({r,label:'👥'})),
        ...(multi ? selected.flatMap(p=>(this._gymModalPlayers.find(x=>x.id===p.id)?.rows||[]).map(r=>({r,label:p.name.split(' ')[0]}))) : [])
    ];
    const summary = allSelected.length===0 ? '' : `
        <div class="gym-selection-summary">
            <span class="gym-summary-label">Seleccionados (${allSelected.length}):</span>
            ${allSelected.map(({r,label})=>{
                const ex=(this.exerciseLibrary||[]).find(e=>e.id===r.exId);
                return `<span class="gym-summary-chip">${ex?.name||r.exId}${multi?`<span class="gym-summary-owner">${label}</span>`:''}<button onclick="window.rpeTracker._removeExerciseFromSelection('${r.exId}')">✕</button></span>`;
            }).join('')}
        </div>`;

    const tabInfo = multi ? `<div class="gym-tab-info">${this._gymActiveTab==='__shared__'?'👥 Ejercicios para <strong>todas</strong>':`Exclusivos de <strong>${this.players.find(p=>p.id===this._gymActiveTab)?.name}</strong>`}</div>` : '';

    return `<div class="gym-step1">
        <h3 class="gym-step-title">Paso 1 — Selecciona los ejercicios</h3>
        ${tabsHTML}${tabInfo}
        <div class="gym-ex-filters">${filters}</div>
        <div class="gym-ex-chips-grid">${chips||'<p class="str-empty">Sin ejercicios en esta categoría</p>'}</div>
        ${summary}
    </div>`;
};

RPETracker.prototype._renderStep2 = function() {
    const selected = this._gymModalPlayers.filter(p=>p.selected);
    const multi    = selected.length > 1;

    const tabsHTML = multi ? `<div class="gym-tabs">
        <button class="gym-tab ${this._gymActiveTab==='__shared__'?'gym-tab--active':''}"
            onclick="window.rpeTracker._setGymTab('__shared__')">
            👥 Compartido <span class="gym-tab-count">${this._gymSharedRows.length}</span>
        </button>
        ${selected.map(p=>{
            const mp=this._gymModalPlayers.find(x=>x.id===p.id);
            const color=PlayerTokens.get(p); const isA=this._gymActiveTab===p.id;
            return `<button class="gym-tab ${isA?'gym-tab--active':''}"
                style="${isA?`border-bottom-color:${color};color:${color}`:''}"
                onclick="window.rpeTracker._setGymTab('${p.id}')">
                ${p.name.split(' ')[0]} <span class="gym-tab-count">${(mp?.rows||[]).length}</span>
            </button>`;
        }).join('')}
    </div>` : '';

    const currentRows = (!multi||this._gymActiveTab==='__shared__')
        ? this._gymSharedRows
        : (this._gymModalPlayers.find(p=>p.id===this._gymActiveTab)?.rows||[]);

    if (currentRows.length===0) return `${tabsHTML}<p class="str-empty">Sin ejercicios en esta pestaña.</p>`;

    const blocks = currentRows.map(row => {
        const ex=(this.exerciseLibrary||[]).find(e=>e.id===row.exId);
        if (!row.defaultSets)  row.defaultSets=3;
        if (!row.defaultReps)  row.defaultReps=8;
        if (row.defaultKg===undefined) row.defaultKg='';
        if (!row.defaultRpe)   row.defaultRpe=7;
        if (!row.sets)         row.sets=this._buildSets(row);
        if (!row.expanded)     row.expanded=false;

        const setsHTML = row.sets.map((s,i)=>`
            <div class="gym-set-detail-row">
                <span class="gym-set-num">${i+1}</span>
                <input type="number" class="gym-set-input" value="${s.reps||''}" placeholder="Reps" min="1" max="50"
                    oninput="window.rpeTracker._updateSet2('${row.exId}',${i},'reps',this.value)">
                <span class="gym-set-sep">×</span>
                <input type="number" class="gym-set-input" value="${s.weight||''}" placeholder="kg" min="0" step="0.5"
                    oninput="window.rpeTracker._updateSet2('${row.exId}',${i},'weight',this.value)">
                <span class="gym-set-sep">kg RPE</span>
                <input type="number" class="gym-set-input gym-set-input--rpe" value="${s.rpe||''}" placeholder="RPE" min="1" max="10"
                    oninput="window.rpeTracker._updateSet2('${row.exId}',${i},'rpe',this.value)">
                ${row.sets.length>1?`<button class="gym-del-set-btn" onclick="window.rpeTracker._removeSet2('${row.exId}',${i})">✕</button>`:'<span style="width:20px"></span>'}
            </div>`).join('');

        return `<div class="gym-ex-block" id="exblock_${row.exId}">
            <div class="gym-ex-block-header">
                <span class="gym-ex-block-name">${ex?.name||row.exId}</span>
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
                    ${row.expanded?'▲ Ocultar':'▼ Ver series'}
                </button>
            </div>
            <div class="gym-ex-sets-detail ${row.expanded?'':'gym-ex-sets-detail--hidden'}" id="exsets_${row.exId}">
                ${setsHTML}
                <button class="gym-add-set-btn" onclick="window.rpeTracker._addSet2('${row.exId}')">+ Serie</button>
            </div>
        </div>`;
    }).join('');

    return `<div class="gym-step2">
        ${tabsHTML}
        <h3 class="gym-step-title">Paso 2 — Series, repeticiones y carga</h3>
        <p class="gym-step2-hint">Define el esquema base y pulsa <strong>Aplicar</strong>. Despliega para editar serie a serie.</p>
        <div class="gym-ex-blocks">${blocks}</div>
    </div>`;
};

// ── Helpers paso 1 ──
RPETracker.prototype._toggleExercise = function(exId) {
    const multi = this._gymModalPlayers.filter(p=>p.selected).length > 1;
    const isShared = !multi || this._gymActiveTab==='__shared__';
    const arr = isShared ? this._gymSharedRows : (this._gymModalPlayers.find(p=>p.id===this._gymActiveTab)?.rows||[]);
    const idx = arr.findIndex(r=>r.exId===exId);
    if (idx>=0) arr.splice(idx,1);
    else arr.push({exId,sets:null,defaultSets:3,defaultReps:8,defaultKg:'',defaultRpe:7,expanded:false});
    const step1=document.querySelector('.gym-step1');
    if (step1) step1.outerHTML=this._renderStep1();
    else this._renderGymModal();
};

RPETracker.prototype._removeExerciseFromSelection = function(exId) {
    this._gymSharedRows=this._gymSharedRows.filter(r=>r.exId!==exId);
    this._gymModalPlayers.forEach(p=>{p.rows=(p.rows||[]).filter(r=>r.exId!==exId);});
    this._renderGymModal();
};

RPETracker.prototype._setExFilter = function(cat) {
    this._gymExFilter=cat;
    const step1=document.querySelector('.gym-step1');
    if (step1) step1.outerHTML=this._renderStep1();
    else this._renderGymModal();
};

RPETracker.prototype._setGymTab = function(tabId) {
    this._gymActiveTab=tabId; this._renderGymModal();
};

RPETracker.prototype._toggleGymPlayer = function(playerId) {
    const dateEl=document.getElementById('gymDate'); if(dateEl) this._gymDate=dateEl.value;
    const mp=this._gymModalPlayers.find(p=>p.id===playerId); if(!mp) return;
    mp.selected=!mp.selected;
    const sel=this._gymModalPlayers.filter(p=>p.selected);
    if (!sel.find(p=>p.id===this._gymActiveTab) && this._gymActiveTab!=='__shared__')
        this._gymActiveTab=sel.length>1?'__shared__':(sel[0]?.id||null);
    if (sel.length<=1) this._gymActiveTab=sel[0]?.id||null;
    this._renderGymModal();
};

RPETracker.prototype._goToStep2 = function() {
    const dateEl=document.getElementById('gymDate'); if(dateEl) this._gymDate=dateEl.value;
    const total=this._gymSharedRows.length+this._gymModalPlayers.reduce((n,p)=>n+(p.rows||[]).length,0);
    if (total===0) { this.showToast('Selecciona al menos un ejercicio','error'); return; }
    if (this._gymModalPlayers.filter(p=>p.selected).length===0) { this.showToast('Selecciona al menos una jugadora','error'); return; }
    this._gymStep=2;
    const sel=this._gymModalPlayers.filter(p=>p.selected);
    if (sel.length>1) this._gymActiveTab='__shared__';
    this._renderGymModal();
};

RPETracker.prototype._goToStep1 = function() { this._gymStep=1; this._renderGymModal(); };

// ── Helpers paso 2 ──
RPETracker.prototype._buildSets = function(row) {
    const n=parseInt(row.defaultSets)||3;
    return Array.from({length:n},()=>({reps:row.defaultReps||8,weight:row.defaultKg||'',rpe:row.defaultRpe||7}));
};

RPETracker.prototype._updateDefault = function(exId,field,val) {
    const all=[...this._gymSharedRows,...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row=all.find(r=>r.exId===exId); if(!row) return;
    row[field]=field==='defaultKg'?(val===''?'':parseFloat(val)):parseInt(val);
};

RPETracker.prototype._applyDefaults = function(exId) {
    const all=[...this._gymSharedRows,...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row=all.find(r=>r.exId===exId); if(!row) return;
    row.sets=this._buildSets(row);
    const container=document.getElementById(`exsets_${exId}`);
    if (container) {
        container.innerHTML=row.sets.map((s,i)=>`
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
                ${row.sets.length>1?`<button class="gym-del-set-btn" onclick="window.rpeTracker._removeSet2('${exId}',${i})">✕</button>`:'<span style="width:20px"></span>'}
            </div>`).join('') +
            `<button class="gym-add-set-btn" onclick="window.rpeTracker._addSet2('${exId}')">+ Serie</button>`;
        this.showToast('✅ Aplicado','success');
    }
};

RPETracker.prototype._toggleExpand = function(exId) {
    const all=[...this._gymSharedRows,...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row=all.find(r=>r.exId===exId); if(!row) return;
    row.expanded=!row.expanded;
    if (!row.sets||row.sets.length===0) row.sets=this._buildSets(row);
    const detail=document.getElementById(`exsets_${exId}`);
    const btn=document.querySelector(`#exblock_${exId} .gym-expand-btn`);
    if (detail) detail.classList.toggle('gym-ex-sets-detail--hidden',!row.expanded);
    if (btn)    btn.textContent=row.expanded?'▲ Ocultar':'▼ Ver series';
};

RPETracker.prototype._updateSet2 = function(exId,si,field,val) {
    const all=[...this._gymSharedRows,...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row=all.find(r=>r.exId===exId); if(!row||!row.sets||!row.sets[si]) return;
    row.sets[si][field]=field==='rpe'?parseInt(val):parseFloat(val);
};

RPETracker.prototype._addSet2 = function(exId) {
    const all=[...this._gymSharedRows,...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row=all.find(r=>r.exId===exId); if(!row) return;
    if(!row.sets) row.sets=this._buildSets(row);
    const last=row.sets[row.sets.length-1]||{};
    row.sets.push({reps:last.reps||'',weight:last.weight||'',rpe:last.rpe||''});
    const detail=document.getElementById(`exsets_${exId}`);
    if (detail) {
        const si=row.sets.length-1; const s=row.sets[si];
        const div=document.createElement('div'); div.className='gym-set-detail-row';
        div.innerHTML=`<span class="gym-set-num">${si+1}</span>
            <input type="number" class="gym-set-input" value="${s.reps||''}" min="1" max="50"
                oninput="window.rpeTracker._updateSet2('${exId}',${si},'reps',this.value)">
            <span class="gym-set-sep">×</span>
            <input type="number" class="gym-set-input" value="${s.weight||''}" min="0" step="0.5"
                oninput="window.rpeTracker._updateSet2('${exId}',${si},'weight',this.value)">
            <span class="gym-set-sep">kg RPE</span>
            <input type="number" class="gym-set-input gym-set-input--rpe" value="${s.rpe||''}" min="1" max="10"
                oninput="window.rpeTracker._updateSet2('${exId}',${si},'rpe',this.value)">
            <button class="gym-del-set-btn" onclick="window.rpeTracker._removeSet2('${exId}',${si})">✕</button>`;
        const btn=detail.querySelector('.gym-add-set-btn'); detail.insertBefore(div,btn);
    }
};

RPETracker.prototype._removeSet2 = function(exId,si) {
    const all=[...this._gymSharedRows,...this._gymModalPlayers.flatMap(p=>p.rows||[])];
    const row=all.find(r=>r.exId===exId); if(!row||!row.sets||row.sets.length<=1) return;
    row.sets.splice(si,1);
    const detail=document.getElementById(`exsets_${exId}`);
    if (detail) {
        detail.innerHTML=row.sets.map((s,i)=>`
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
                ${row.sets.length>1?`<button class="gym-del-set-btn" onclick="window.rpeTracker._removeSet2('${exId}',${i})">✕</button>`:'<span style="width:20px"></span>'}
            </div>`).join('') +
            `<button class="gym-add-set-btn" onclick="window.rpeTracker._addSet2('${exId}')">+ Serie</button>`;
    }
};

// ── Guardar plan ──
RPETracker.prototype._saveGymSession = function() {
    const dateEl=document.getElementById('gymDate');
    const date=dateEl?dateEl.value:this._gymDate;
    if (!date) { this.showToast('Selecciona la fecha','error'); return; }

    const sel=this._gymModalPlayers.filter(p=>p.selected);
    if (sel.length===0) { this.showToast('Selecciona al menos una jugadora','error'); return; }

    const toEx = rows => rows.filter(r=>r.exId).map(r=>({
        exerciseId: r.exId,
        sets: (r.sets||this._buildSets(r)).filter(s=>s.reps||s.weight)
    })).filter(e=>e.sets.length>0);

    const sharedEx = toEx(this._gymSharedRows);
    const planGroupId = Date.now().toString();
    let saved=0;

    sel.forEach(mp => {
        const playerEx = toEx(mp.rows||[]);
        const allEx    = [...sharedEx,...playerEx];
        if (allEx.length===0) return;
        const session = {
            id: planGroupId+'_'+mp.id,
            planGroupId,
            playerId: mp.id,
            date,
            status: 'planned',
            exercises: allEx,
            createdAt: new Date().toISOString()
        };
        if (!this.gymSessions) this.gymSessions=[];
        this.gymSessions.push(session);
        saved++;
    });

    if (saved===0) { this.showToast('Añade ejercicios con datos','error'); return; }
    this._saveGymSessions();
    document.getElementById('gymSessionModal')?.classList.remove('active');
    this.showToast(`✅ Plan guardado para ${saved} jugadora${saved>1?'s':''}  — recuerda registrar la ejecución tras el entreno`,'success');
    if (this.currentView==='gym') this.renderGymView();
};

// ── Eliminar sesión ──
RPETracker.prototype._deleteGymSession = function(sessionId) {
    if (!confirm('¿Eliminar esta sesión?')) return;
    this.gymSessions=(this.gymSessions||[]).filter(s=>s.id!==sessionId);
    this._saveGymSessions();
    this.showToast('Sesión eliminada','success');
    if (this.currentView==='gym') this._renderGymPlayer(document.getElementById('gymView'));
};

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

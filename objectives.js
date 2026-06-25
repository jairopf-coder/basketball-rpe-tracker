// ============================================================
//  objectives.js — Próximos objetivos (partidos)
//  Módulo RPETracker: gestión de calendario de partidos
// ============================================================

(function () {
    if (document.getElementById('__objectivesStyles')) return;
    const s = document.createElement('style');
    s.id = '__objectivesStyles';
    s.textContent = `
        .obj-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
        }
        .obj-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            flex-wrap: wrap;
            gap: 0.75rem;
        }
        .obj-title {
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-primary);
        }
        /* ── Formulario ── */
        .obj-form-card {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 12px;
            padding: 1.25rem 1.5rem;
        }
        .obj-form-card h3 {
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--text-primary);
            margin: 0 0 1rem;
        }
        .obj-form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 0.75rem 1rem;
        }
        .obj-form-grid .obj-field-full {
            grid-column: 1 / -1;
        }
        .obj-field {
            display: flex;
            flex-direction: column;
            gap: 0.3rem;
        }
        .obj-field label {
            font-size: 0.75rem;
            font-weight: 500;
            color: var(--text-muted);
        }
        .obj-field input,
        .obj-field select,
        .obj-field textarea {
            padding: 0.45rem 0.7rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--bg-input, var(--bg-subtle));
            color: var(--text-primary);
            font-size: 0.85rem;
            font-family: inherit;
            outline: none;
            transition: border-color 0.15s;
        }
        .obj-field input:focus,
        .obj-field select:focus,
        .obj-field textarea:focus {
            border-color: var(--primary);
        }
        .obj-venue-wrap {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }
        .obj-venue-wrap input { flex: 1; }
        .obj-venue-home-btn {
            padding: 0.4rem 0.7rem;
            border: 1px solid var(--border);
            border-radius: 8px;
            background: var(--bg-subtle);
            color: var(--text-secondary);
            font-size: 0.78rem;
            cursor: pointer;
            white-space: nowrap;
            transition: background 0.15s;
        }
        .obj-venue-home-btn:hover { background: var(--bg-hover, var(--border)); }
        .obj-result-row {
            display: grid;
            grid-template-columns: 1fr auto 1fr;
            gap: 0.5rem;
            align-items: center;
        }
        .obj-result-vs {
            font-size: 0.8rem;
            color: var(--text-muted);
            text-align: center;
        }
        .obj-form-actions {
            display: flex;
            gap: 0.6rem;
            justify-content: flex-end;
            margin-top: 1rem;
            padding-top: 0.75rem;
            border-top: 1px solid var(--border);
        }
        .obj-btn {
            padding: 0.45rem 1.1rem;
            border-radius: 8px;
            font-size: 0.82rem;
            font-weight: 500;
            cursor: pointer;
            border: 1px solid var(--border);
            transition: background 0.15s;
        }
        .obj-btn-primary {
            background: var(--primary);
            color: #fff;
            border-color: var(--primary);
        }
        .obj-btn-primary:hover { opacity: 0.88; }
        .obj-btn-secondary {
            background: var(--bg-subtle);
            color: var(--text-secondary);
        }
        .obj-btn-secondary:hover { background: var(--bg-hover, var(--border)); }
        /* ── Lista de partidos ── */
        .obj-list { display: flex; flex-direction: column; gap: 0.6rem; }
        .obj-empty {
            text-align: center;
            color: var(--text-muted);
            font-size: 0.85rem;
            padding: 2rem;
            background: var(--bg-subtle);
            border: 1px dashed var(--border);
            border-radius: 12px;
        }
        .obj-match-card {
            background: var(--bg-surface);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 0.85rem 1.1rem;
            display: grid;
            grid-template-columns: auto 1fr auto;
            gap: 0.5rem 1rem;
            align-items: start;
        }
        .obj-match-card.obj-past {
            opacity: 0.65;
            background: var(--bg-subtle);
        }
        .obj-match-card.obj-next {
            border-color: var(--primary);
            box-shadow: 0 0 0 1px var(--primary)22;
        }
        .obj-match-date-col {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 48px;
            background: var(--bg-subtle);
            border-radius: 8px;
            padding: 0.4rem 0.5rem;
        }
        .obj-match-day { font-size: 1.3rem; font-weight: 700; line-height: 1; color: var(--text-primary); }
        .obj-match-mon { font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; }
        .obj-match-info { display: flex; flex-direction: column; gap: 0.25rem; }
        .obj-match-rival {
            font-size: 0.92rem;
            font-weight: 600;
            color: var(--text-primary);
        }
        .obj-match-meta {
            font-size: 0.75rem;
            color: var(--text-muted);
            display: flex;
            flex-wrap: wrap;
            gap: 0.4rem 0.75rem;
        }
        .obj-match-result {
            font-size: 0.88rem;
            font-weight: 600;
            color: var(--primary);
            white-space: nowrap;
        }
        .obj-match-actions {
            display: flex;
            flex-direction: column;
            gap: 0.35rem;
            align-items: flex-end;
        }
        .obj-icon-btn {
            background: none;
            border: 1px solid var(--border);
            border-radius: 6px;
            padding: 0.2rem 0.5rem;
            font-size: 0.75rem;
            cursor: pointer;
            color: var(--text-muted);
            transition: background 0.12s;
        }
        .obj-icon-btn:hover { background: var(--bg-subtle); }
        .obj-badge-comp {
            display: inline-block;
            padding: 0.1rem 0.45rem;
            border-radius: 99px;
            font-size: 0.68rem;
            font-weight: 500;
            background: var(--primary)22;
            color: var(--primary);
        }
        .obj-badge-friendly {
            background: var(--bg-subtle);
            color: var(--text-muted);
        }
        .obj-section-title {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--text-muted);
            text-transform: uppercase;
            letter-spacing: 0.06em;
            padding: 0.25rem 0;
            border-bottom: 1px solid var(--border);
            margin-bottom: 0.25rem;
        }
        @media (max-width: 600px) {
            .obj-container { padding: 0.75rem; }
            .obj-form-grid { grid-template-columns: 1fr; }
            .obj-form-grid .obj-field-full { grid-column: 1; }
        }
    `;
    document.head.appendChild(s);
}());

// ── Helpers ────────────────────────────────────────────────
function _toLocalDate(dateStr) {
    // Evita el bug UTC: 'YYYY-MM-DD' → mediodia local
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d);
}

function _formatDate(dateStr) {
    const d = _toLocalDate(dateStr);
    const days  = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return { day: d.getDate(), month: months[d.getMonth()], weekday: days[d.getDay()], year: d.getFullYear() };
}

function _todayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function _generateId() {
    return 'match_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

// ── Render principal ───────────────────────────────────────
RPETracker.prototype.renderObjectives = function () {
    const container = document.getElementById('objectivesContainer');
    if (!container) return;

    const today = _todayStr();
    const upcoming = this.matches.filter(m => m.date >= today).sort((a, b) => a.date.localeCompare(b.date));
    const past     = this.matches.filter(m => m.date <  today).sort((a, b) => b.date.localeCompare(a.date));

    container.innerHTML = `
    <div class="obj-container">
        <div class="obj-header">
            <span class="obj-title">🎯 Próximos objetivos</span>
            <button class="obj-btn obj-btn-primary" onclick="window.rpeTracker._objShowForm()">+ Añadir partido</button>
        </div>

        <div id="objFormWrap" style="display:none"></div>

        <div class="obj-list" id="objList">
            ${upcoming.length === 0 && past.length === 0
                ? '<div class="obj-empty">No hay partidos registrados.<br>Pulsa <strong>+ Añadir partido</strong> para empezar.</div>'
                : ''
            }
            ${upcoming.length > 0 ? `
                <div class="obj-section-title">Próximos</div>
                ${upcoming.map((m, i) => this._objMatchCard(m, i === 0)).join('')}
            ` : ''}
            ${past.length > 0 ? `
                <div class="obj-section-title" style="margin-top:0.75rem">Disputados</div>
                ${past.map(m => this._objMatchCard(m, false, true)).join('')}
            ` : ''}
        </div>
    </div>`;
};

// ── Tarjeta de partido ─────────────────────────────────────
RPETracker.prototype._objMatchCard = function (m, isNext, isPast) {
    const { day, month, weekday } = _formatDate(m.date);
    const isHome = m.venue === 'casa';
    const venueLabel = isHome ? '🏠 Casa' : `✈️ ${m.venue || '—'}`;
    const timeLabel  = m.time ? `🕐 ${m.time}` : '';
    const compBadge  = m.competition === 'friendly'
        ? '<span class="obj-badge-comp obj-badge-friendly">Amistoso</span>'
        : `<span class="obj-badge-comp">${m.competition || 'Liga'}</span>`;

    const resultHtml = (m.localScore !== '' && m.localScore !== undefined && m.visitorScore !== '' && m.visitorScore !== undefined)
        ? `<div class="obj-match-result">${m.localTeam} ${m.localScore} – ${m.visitorScore} ${m.visitorTeam}</div>`
        : (isPast ? '<div style="font-size:0.75rem;color:var(--text-faint)">Sin resultado</div>' : '');

    return `
    <div class="obj-match-card ${isNext ? 'obj-next' : ''} ${isPast ? 'obj-past' : ''}">
        <div class="obj-match-date-col">
            <span class="obj-match-day">${day}</span>
            <span class="obj-match-mon">${month}</span>
            <span class="obj-match-mon">${weekday}</span>
        </div>
        <div class="obj-match-info">
            <div class="obj-match-rival">vs ${m.rival || '—'}</div>
            <div class="obj-match-meta">
                ${venueLabel}
                ${timeLabel ? `<span>${timeLabel}</span>` : ''}
                ${compBadge}
            </div>
            ${resultHtml}
        </div>
        <div class="obj-match-actions">
            <button class="obj-icon-btn" onclick="window.rpeTracker._objShowForm('${m.id}')" title="Editar">✏️</button>
            <button class="obj-icon-btn" onclick="window.rpeTracker._objDelete('${m.id}')" title="Eliminar">🗑️</button>
        </div>
    </div>`;
};

// ── Mostrar formulario (crear o editar) ────────────────────
RPETracker.prototype._objShowForm = function (editId) {
    const wrap = document.getElementById('objFormWrap');
    if (!wrap) return;

    const m = editId ? this.matches.find(x => x.id === editId) : null;
    const today = _todayStr();

    wrap.style.display = 'block';
    wrap.innerHTML = `
    <div class="obj-form-card">
        <h3>${m ? '✏️ Editar partido' : '➕ Nuevo partido'}</h3>
        <div class="obj-form-grid">
            <div class="obj-field">
                <label>Fecha *</label>
                <input type="date" id="objDate" value="${m ? m.date : today}">
            </div>
            <div class="obj-field">
                <label>Hora</label>
                <input type="time" id="objTime" value="${m ? (m.time || '') : ''}">
            </div>
            <div class="obj-field">
                <label>Rival *</label>
                <input type="text" id="objRival" placeholder="Nombre del equipo rival" value="${m ? (m.rival || '') : ''}">
            </div>
            <div class="obj-field">
                <label>Competición</label>
                <select id="objCompetition">
                    <option value="Liga" ${(!m || m.competition === 'Liga') ? 'selected' : ''}>Liga</option>
                    <option value="Copa" ${m?.competition === 'Copa' ? 'selected' : ''}>Copa</option>
                    <option value="Playoff" ${m?.competition === 'Playoff' ? 'selected' : ''}>Playoff</option>
                    <option value="friendly" ${m?.competition === 'friendly' ? 'selected' : ''}>Amistoso</option>
                    <option value="Otro" ${m?.competition === 'Otro' ? 'selected' : ''}>Otro</option>
                </select>
            </div>
            <div class="obj-field obj-field-full">
                <label>Lugar</label>
                <div class="obj-venue-wrap">
                    <input type="text" id="objVenue" placeholder="Casa o nombre del pabellón" value="${m ? (m.venue || '') : ''}">
                    <button class="obj-venue-home-btn" type="button" onclick="document.getElementById('objVenue').value='casa'">🏠 Casa</button>
                </div>
            </div>
            <div class="obj-field">
                <label>Equipo local</label>
                <input type="text" id="objLocalTeam" placeholder="Nombre equipo local" value="${m ? (m.localTeam || '') : ''}">
            </div>
            <div class="obj-field">
                <label>Equipo visitante</label>
                <input type="text" id="objVisitorTeam" placeholder="Nombre equipo visitante" value="${m ? (m.visitorTeam || '') : ''}">
            </div>
            <div class="obj-field">
                <label>Puntos local (resultado)</label>
                <input type="number" id="objLocalScore" min="0" placeholder="—" value="${m && m.localScore !== undefined ? m.localScore : ''}">
            </div>
            <div class="obj-field">
                <label>Puntos visitante (resultado)</label>
                <input type="number" id="objVisitorScore" min="0" placeholder="—" value="${m && m.visitorScore !== undefined ? m.visitorScore : ''}">
            </div>
        </div>
        <div class="obj-form-actions">
            <button class="obj-btn obj-btn-secondary" onclick="window.rpeTracker._objCloseForm()">Cancelar</button>
            <button class="obj-btn obj-btn-primary" onclick="window.rpeTracker._objSave('${editId || ''}')">Guardar</button>
        </div>
    </div>`;

    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};

// ── Cerrar formulario ──────────────────────────────────────
RPETracker.prototype._objCloseForm = function () {
    const wrap = document.getElementById('objFormWrap');
    if (wrap) { wrap.style.display = 'none'; wrap.innerHTML = ''; }
};

// ── Guardar partido ────────────────────────────────────────
RPETracker.prototype._objSave = function (editId) {
    const date        = document.getElementById('objDate')?.value?.trim();
    const rival       = document.getElementById('objRival')?.value?.trim();
    const time        = document.getElementById('objTime')?.value?.trim();
    const competition = document.getElementById('objCompetition')?.value;
    const venue       = document.getElementById('objVenue')?.value?.trim();
    const localTeam   = document.getElementById('objLocalTeam')?.value?.trim();
    const visitorTeam = document.getElementById('objVisitorTeam')?.value?.trim();
    const localScore  = document.getElementById('objLocalScore')?.value;
    const visitorScore= document.getElementById('objVisitorScore')?.value;

    if (!date || !rival) {
        this.showToast('Fecha y rival son obligatorios', 'error');
        return;
    }

    if (editId) {
        const idx = this.matches.findIndex(m => m.id === editId);
        if (idx !== -1) {
            this.matches[idx] = { ...this.matches[idx], date, rival, time, competition, venue, localTeam, visitorTeam,
                localScore: localScore !== '' ? Number(localScore) : '',
                visitorScore: visitorScore !== '' ? Number(visitorScore) : '' };
        }
    } else {
        this.matches.push({ id: _generateId(), date, rival, time, competition, venue, localTeam, visitorTeam,
            localScore: localScore !== '' ? Number(localScore) : '',
            visitorScore: visitorScore !== '' ? Number(visitorScore) : '' });
    }

    this.matches.sort((a, b) => a.date.localeCompare(b.date));
    this.saveMatches();
    this._objCloseForm();
    this.renderObjectives();
    this.showToast(editId ? 'Partido actualizado' : 'Partido añadido', 'success');
};

// ── Eliminar partido ───────────────────────────────────────
RPETracker.prototype._objDelete = function (id) {
    if (!confirm('¿Eliminar este partido?')) return;
    this.matches = this.matches.filter(m => m.id !== id);
    this.saveMatches();
    this.renderObjectives();
    this.showToast('Partido eliminado', 'success');
};

// ── Utilidad pública: devuelve el próximo partido ─────────
RPETracker.prototype.getNextMatch = function () {
    const today = _todayStr();
    return this.matches
        .filter(m => m.date >= today)
        .sort((a, b) => a.date.localeCompare(b.date))[0] || null;
};

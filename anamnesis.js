// ============================================================
//  ANAMNESIS MODULE — BasketballRPE-Web
//  Historial médico-deportivo por jugadora con body map SVG
// ============================================================

'use strict';

/* ── Body-map zone definitions ───────────────────────────── */
const BODY_ZONES = [
  // FRONT — head & neck
  { id: 'head',          label: 'Cabeza',              side: 'front', cx: 100, cy: 28,  r: 18 },
  { id: 'neck_front',    label: 'Cuello',              side: 'front', cx: 100, cy: 56,  r: 10 },
  // FRONT — torso
  { id: 'shoulder_r',    label: 'Hombro derecho',      side: 'front', cx: 66,  cy: 78,  r: 13 },
  { id: 'shoulder_l',    label: 'Hombro izquierdo',    side: 'front', cx: 134, cy: 78,  r: 13 },
  { id: 'chest',         label: 'Pecho / Costillas',   side: 'front', cx: 100, cy: 95,  r: 18 },
  { id: 'abdomen',       label: 'Abdomen',             side: 'front', cx: 100, cy: 125, r: 16 },
  { id: 'elbow_r',       label: 'Codo derecho',        side: 'front', cx: 54,  cy: 118, r: 10 },
  { id: 'elbow_l',       label: 'Codo izquierdo',      side: 'front', cx: 146, cy: 118, r: 10 },
  { id: 'wrist_r',       label: 'Muñeca / Mano der.',  side: 'front', cx: 46,  cy: 152, r: 10 },
  { id: 'wrist_l',       label: 'Muñeca / Mano izq.',  side: 'front', cx: 154, cy: 152, r: 10 },
  { id: 'hip_r',         label: 'Cadera derecha',      side: 'front', cx: 80,  cy: 155, r: 13 },
  { id: 'hip_l',         label: 'Cadera izquierda',    side: 'front', cx: 120, cy: 155, r: 13 },
  // FRONT — lower
  { id: 'quad_r',        label: 'Cuádricep derecho',   side: 'front', cx: 82,  cy: 192, r: 14 },
  { id: 'quad_l',        label: 'Cuádricep izquierdo', side: 'front', cx: 118, cy: 192, r: 14 },
  { id: 'knee_r',        label: 'Rodilla derecha',     side: 'front', cx: 82,  cy: 225, r: 12 },
  { id: 'knee_l',        label: 'Rodilla izquierda',   side: 'front', cx: 118, cy: 225, r: 12 },
  { id: 'shin_r',        label: 'Tibia / Peroné der.', side: 'front', cx: 82,  cy: 258, r: 11 },
  { id: 'shin_l',        label: 'Tibia / Peroné izq.', side: 'front', cx: 118, cy: 258, r: 11 },
  { id: 'ankle_r',       label: 'Tobillo derecho',     side: 'front', cx: 82,  cy: 290, r: 11 },
  { id: 'ankle_l',       label: 'Tobillo izquierdo',   side: 'front', cx: 118, cy: 290, r: 11 },
  { id: 'foot_r',        label: 'Pie derecho',         side: 'front', cx: 80,  cy: 312, r: 10 },
  { id: 'foot_l',        label: 'Pie izquierdo',       side: 'front', cx: 120, cy: 312, r: 10 },
  // BACK
  { id: 'neck_back',     label: 'Cervical',            side: 'back',  cx: 100, cy: 56,  r: 10 },
  { id: 'trap_r',        label: 'Trapecio derecho',    side: 'back',  cx: 72,  cy: 72,  r: 12 },
  { id: 'trap_l',        label: 'Trapecio izquierdo',  side: 'back',  cx: 128, cy: 72,  r: 12 },
  { id: 'upper_back',    label: 'Dorsal alto',         side: 'back',  cx: 100, cy: 90,  r: 16 },
  { id: 'lower_back',    label: 'Lumbar',              side: 'back',  cx: 100, cy: 120, r: 16 },
  { id: 'glute_r',       label: 'Glúteo derecho',      side: 'back',  cx: 82,  cy: 152, r: 14 },
  { id: 'glute_l',       label: 'Glúteo izquierdo',    side: 'back',  cx: 118, cy: 152, r: 14 },
  { id: 'hamstring_r',   label: 'Isquio derecho',      side: 'back',  cx: 82,  cy: 192, r: 14 },
  { id: 'hamstring_l',   label: 'Isquio izquierdo',    side: 'back',  cx: 118, cy: 192, r: 14 },
  { id: 'calf_r',        label: 'Gemelo / Sóleo der.', side: 'back',  cx: 82,  cy: 258, r: 11 },
  { id: 'calf_l',        label: 'Gemelo / Sóleo izq.', side: 'back',  cx: 118, cy: 258, r: 11 },
  { id: 'achilles_r',    label: 'Aquiles derecho',     side: 'back',  cx: 82,  cy: 292, r: 10 },
  { id: 'achilles_l',    label: 'Aquiles izquierdo',   side: 'back',  cx: 118, cy: 292, r: 10 },
];

const MARK_TYPES = [
  { id: 'injury',   label: 'Lesión pasada',   color: '#f44336' },
  { id: 'chronic',  label: 'Dolor crónico',   color: '#ff9800' },
  { id: 'surgery',  label: 'Cirugía',         color: '#9c27b0' },
  { id: 'risk',     label: 'Zona de riesgo',  color: '#2196f3' },
];

function markColor(type) {
  return (MARK_TYPES.find(t => t.id === type) || MARK_TYPES[0]).color;
}

/* ── Firebase helpers ────────────────────────────────────── */
const AnamnesisDB = {
  save(playerId, data) {
    if (window.firebaseSync?.saveAnamnesis) {
      window.firebaseSync.saveAnamnesis(playerId, data);
    } else {
      try { localStorage.setItem(`anamnesis_${playerId}`, JSON.stringify(data)); } catch(e) {}
    }
  },
  load(playerId, cb) {
    if (window.firebaseSync?.loadAnamnesis) {
      window.firebaseSync.loadAnamnesis(playerId, cb);
    } else {
      try { const local = localStorage.getItem(`anamnesis_${playerId}`); cb(local ? JSON.parse(local) : null); } catch(e) { cb(null); }
    }
  }
};

/* ── SVG body silhouette (front & back) ──────────────────── */
function buildBodySVG(side, marks) {
  const w = 200, h = 340;
  // marks = array of {zoneId, type, description, date, downtime}

  const marksForSide = marks.filter(m => {
    const zone = BODY_ZONES.find(z => z.id === m.zoneId);
    return zone && zone.side === side;
  });

  // Build hotspot circles for zones that have marks
  const markCircles = marksForSide.map(m => {
    const zone = BODY_ZONES.find(z => z.id === m.zoneId);
    if (!zone) return '';
    const col = markColor(m.type);
    return `<circle
      class="bm-mark"
      cx="${zone.cx}" cy="${zone.cy}" r="${zone.r + 4}"
      fill="${col}" fill-opacity="0.35"
      stroke="${col}" stroke-width="2"
      data-mark-id="${m.id}"
      style="cursor:pointer"
    />
    <circle cx="${zone.cx}" cy="${zone.cy}" r="5" fill="${col}" style="pointer-events:none"/>`;
  }).join('');

  // Clickable transparent overlay circles for all zones on this side
  const zoneOverlays = BODY_ZONES.filter(z => z.side === side).map(z => `
    <circle class="bm-zone" cx="${z.cx}" cy="${z.cy}" r="${z.r}"
      fill="transparent" stroke="transparent" stroke-width="1"
      data-zone-id="${z.id}" style="cursor:pointer"/>
  `).join('');

  // Simple anatomical female silhouette path (front or back)
  const silhouette = side === 'front' ? frontSilhouette() : backSilhouette();

  return `<svg viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg"
    class="body-map-svg" data-side="${side}" style="width:100%;height:100%">
    <style>
      .bm-zone:hover { stroke: var(--primary,#1976d2); stroke-width:2; fill: var(--primary,#1976d2); fill-opacity:0.12; }
      .bm-mark { transition: r 0.15s; }
      .bm-mark:hover { r: ${'{'}var(--r, 18){'}'}; fill-opacity: 0.55; }
    </style>
    ${silhouette}
    ${markCircles}
    ${zoneOverlays}
  </svg>`;
}

function frontSilhouette() {
  return `
  <g fill="var(--bg-tertiary,#e0e0e0)" stroke="var(--text-secondary,#888)" stroke-width="1.2" opacity="0.7">
    <!-- head -->
    <ellipse cx="100" cy="28" rx="17" ry="20"/>
    <!-- neck -->
    <rect x="93" y="46" width="14" height="14" rx="3"/>
    <!-- torso -->
    <path d="M68 62 Q60 68 58 80 L54 145 Q65 155 100 158 Q135 155 146 145 L142 80 Q140 68 132 62 Z"/>
    <!-- upper arms -->
    <path d="M68 65 Q55 72 48 100 L44 130 Q50 138 58 135 L62 100 Q68 78 74 70 Z"/>
    <path d="M132 65 Q145 72 152 100 L156 130 Q150 138 142 135 L138 100 Q132 78 126 70 Z"/>
    <!-- forearms -->
    <path d="M44 130 Q40 140 40 160 L46 162 Q50 142 58 135 Z"/>
    <path d="M156 130 Q160 140 160 160 L154 162 Q150 142 142 135 Z"/>
    <!-- hands -->
    <ellipse cx="43" cy="165" rx="8" ry="6"/>
    <ellipse cx="157" cy="165" rx="8" ry="6"/>
    <!-- hips/pelvis -->
    <path d="M68 148 Q60 158 62 175 L138 175 Q140 158 132 148 Z"/>
    <!-- thighs -->
    <path d="M68 165 Q62 180 66 218 L90 220 Q92 185 85 165 Z"/>
    <path d="M132 165 Q138 180 134 218 L110 220 Q108 185 115 165 Z"/>
    <!-- knees -->
    <ellipse cx="78" cy="228" rx="14" ry="8"/>
    <ellipse cx="122" cy="228" rx="14" ry="8"/>
    <!-- shins -->
    <path d="M66 234 Q64 260 66 285 L90 285 Q92 260 90 234 Z"/>
    <path d="M110 234 Q108 260 110 285 L134 285 Q136 260 134 234 Z"/>
    <!-- feet -->
    <ellipse cx="78" cy="310" rx="16" ry="8"/>
    <ellipse cx="122" cy="310" rx="16" ry="8"/>
  </g>`;
}

function backSilhouette() {
  return `
  <g fill="var(--bg-tertiary,#e0e0e0)" stroke="var(--text-secondary,#888)" stroke-width="1.2" opacity="0.7">
    <!-- head -->
    <ellipse cx="100" cy="28" rx="17" ry="20"/>
    <!-- neck -->
    <rect x="93" y="46" width="14" height="14" rx="3"/>
    <!-- torso back -->
    <path d="M68 62 Q60 68 58 80 L54 145 Q65 155 100 158 Q135 155 146 145 L142 80 Q140 68 132 62 Z"/>
    <!-- upper arms -->
    <path d="M68 65 Q55 72 48 100 L44 130 Q50 138 58 135 L62 100 Q68 78 74 70 Z"/>
    <path d="M132 65 Q145 72 152 100 L156 130 Q150 138 142 135 L138 100 Q132 78 126 70 Z"/>
    <!-- forearms -->
    <path d="M44 130 Q40 140 40 160 L46 162 Q50 142 58 135 Z"/>
    <path d="M156 130 Q160 140 160 160 L154 162 Q150 142 142 135 Z"/>
    <!-- hands -->
    <ellipse cx="43" cy="165" rx="8" ry="6"/>
    <ellipse cx="157" cy="165" rx="8" ry="6"/>
    <!-- glutes -->
    <path d="M68 148 Q60 158 62 175 L138 175 Q140 158 132 148 Z"/>
    <!-- hamstrings -->
    <path d="M68 165 Q62 180 66 218 L90 220 Q92 185 85 165 Z"/>
    <path d="M132 165 Q138 180 134 218 L110 220 Q108 185 115 165 Z"/>
    <!-- knees back -->
    <ellipse cx="78" cy="228" rx="14" ry="8"/>
    <ellipse cx="122" cy="228" rx="14" ry="8"/>
    <!-- calves -->
    <path d="M66 234 Q64 260 66 285 L90 285 Q92 260 90 234 Z"/>
    <path d="M110 234 Q108 260 110 285 L134 285 Q136 260 134 234 Z"/>
    <!-- feet back -->
    <ellipse cx="78" cy="310" rx="16" ry="8"/>
    <ellipse cx="122" cy="310" rx="16" ry="8"/>
  </g>`;
}

/* ── Main modal render ───────────────────────────────────── */
window.AnamnesisModule = {

  _currentPlayerId: null,
  _data: null,          // { profile:{}, marks:[], injuryHistory:[], notes:'' }

  open(playerId) {
    this._currentPlayerId = playerId;
    const player = window.rpeTracker?.players?.find(p => p.id === playerId);
    if (!player) return;

    // Ensure modal container exists
    if (!document.getElementById('anamnesisModal')) {
      document.body.insertAdjacentHTML('beforeend', this._modalHTML());
      this._attachGlobalListeners();
    }

    // Show loading state
    document.getElementById('anamnesisModal').classList.add('active');
    document.getElementById('anamnesis-player-name').textContent = player.name;

    AnamnesisDB.load(playerId, data => {
      this._data = data || { profile: {}, marks: [], injuryHistory: [], notes: '' };
      this._render();
    });
  },

  close() {
    document.getElementById('anamnesisModal')?.classList.remove('active');
    this._currentPlayerId = null;
    this._hideMarkTooltip();
  },

  save() {
    if (!this._currentPlayerId || !this._data) return;
    // Read form fields back into _data.profile
    const f = id => document.getElementById(id)?.value?.trim() || '';
    this._data.profile = {
      dob:          f('ana-dob'),
      laterality:   f('ana-laterality'),
      position:     f('ana-position'),
      height:       f('ana-height'),
      weight:       f('ana-weight'),
      bloodType:    f('ana-bloodtype'),
      allergies:    f('ana-allergies'),
      medication:   f('ana-medication'),
      conditions:   f('ana-conditions'),
      sleepHours:   f('ana-sleep'),
      supplements:  f('ana-supplements'),
      menstrual:    f('ana-menstrual'),
    };
    this._data.notes = f('ana-notes');
    AnamnesisDB.save(this._currentPlayerId, this._data);
    this._showSavedFeedback();
  },

  _render() {
    const d = this._data;
    const p = d.profile || {};

    // Profile fields
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('ana-dob',        p.dob);
    setVal('ana-laterality', p.laterality);
    setVal('ana-position',   p.position);
    setVal('ana-height',     p.height);
    setVal('ana-weight',     p.weight);
    setVal('ana-bloodtype',  p.bloodType);
    setVal('ana-allergies',  p.allergies);
    setVal('ana-medication', p.medication);
    setVal('ana-conditions', p.conditions);
    setVal('ana-sleep',      p.sleepHours);
    setVal('ana-supplements',p.supplements);
    setVal('ana-menstrual',  p.menstrual);
    setVal('ana-notes',      d.notes);

    // Injury history table
    this._renderInjuryTable();

    // Body maps
    this._renderBodyMap('front');
    this._renderBodyMap('back');
  },

  _renderBodyMap(side) {
    const container = document.getElementById(`bm-container-${side}`);
    if (!container) return;
    container.innerHTML = buildBodySVG(side, this._data.marks || []);
    this._attachMapListeners(container, side);
  },

  _renderInjuryTable() {
    const tbody = document.getElementById('ana-injury-tbody');
    if (!tbody) return;
    const list = this._data.injuryHistory || [];
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;opacity:0.5;padding:1rem">Sin lesiones registradas</td></tr>`;
      return;
    }
    tbody.innerHTML = list.map((inj, i) => `
      <tr>
        <td>${esc(inj.zone || '—')}</td>
        <td><span class="ana-badge" style="background:${markColor(inj.type)}">${MARK_TYPES.find(t=>t.id===inj.type)?.label||inj.type}</span></td>
        <td>${esc(inj.date || '—')}</td>
        <td>${esc(inj.description || '—')}</td>
        <td>${inj.downtime ? inj.downtime + ' sem.' : '—'}</td>
        <td>
          <button class="btn-icon btn-icon--sm" style="background:#f44336;color:white" 
            data-action="del-injury" data-idx="${i}" title="Eliminar">🗑️</button>
        </td>
      </tr>
    `).join('');

    // delegate delete
    tbody.querySelectorAll('[data-action="del-injury"]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = parseInt(btn.dataset.idx);
        this._data.injuryHistory.splice(idx, 1);
        // also remove mark if linked
        const inj = this._data.injuryHistory; // already spliced
        this._renderInjuryTable();
      });
    });
  },

  /* ── Map interaction ──────────────────────────────────── */
  _attachMapListeners(container, side) {
    const svg = container.querySelector('svg');
    if (!svg) return;

    // Hover tooltip on existing marks
    svg.querySelectorAll('.bm-mark').forEach(el => {
      el.addEventListener('mouseenter', e => this._showMarkTooltip(e, el.dataset.markId));
      el.addEventListener('mouseleave', () => this._hideMarkTooltip());
      // touch support
      el.addEventListener('touchstart', e => { e.preventDefault(); this._showMarkTooltip(e, el.dataset.markId); }, { passive: false });
    });

    // Click on zone overlay → add mark
    svg.querySelectorAll('.bm-zone').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        this._openMarkForm(el.dataset.zoneId, side, e);
      });
    });
  },

  _showMarkTooltip(e, markId) {
    const mark = this._data.marks?.find(m => m.id === markId);
    if (!mark) return;
    const zone = BODY_ZONES.find(z => z.id === mark.zoneId);
    const typeLabel = MARK_TYPES.find(t => t.id === mark.type)?.label || mark.type;
    const col = markColor(mark.type);

    let tip = document.getElementById('bm-tooltip');
    if (!tip) {
      tip = document.createElement('div');
      tip.id = 'bm-tooltip';
      tip.className = 'bm-tooltip';
      document.body.appendChild(tip);
    }

    tip.innerHTML = `
      <div class="bmt-type" style="color:${esc(col)}">● ${esc(typeLabel)}</div>
      <div class="bmt-zone">${esc(zone?.label || mark.zoneId)}</div>
      ${mark.date ? `<div class="bmt-row"><span>Fecha:</span> ${esc(mark.date)}</div>` : ''}
      ${mark.downtime ? `<div class="bmt-row"><span>Baja:</span> ${esc(String(mark.downtime))} semanas</div>` : ''}
      ${mark.description ? `<div class="bmt-desc">${esc(mark.description)}</div>` : ''}
    `;
    tip.style.display = 'block';
    this._positionTooltip(tip, e);
  },

  _positionTooltip(tip, e) {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    tip.style.left = (clientX + 14) + 'px';
    tip.style.top  = (clientY - 10) + 'px';
    // keep inside viewport
    requestAnimationFrame(() => {
      const rect = tip.getBoundingClientRect();
      if (rect.right > window.innerWidth - 10)  tip.style.left = (clientX - rect.width - 14) + 'px';
      if (rect.bottom > window.innerHeight - 10) tip.style.top  = (clientY - rect.height + 10) + 'px';
    });
  },

  _hideMarkTooltip() {
    const tip = document.getElementById('bm-tooltip');
    if (tip) tip.style.display = 'none';
  },

  /* ── Mark form (mini popup) ───────────────────────────── */
  _openMarkForm(zoneId, side, e) {
    const zone = BODY_ZONES.find(z => z.id === zoneId);
    if (!zone) return;

    // remove previous
    document.getElementById('bm-mark-form')?.remove();

    const existing = (this._data.marks || []).filter(m => m.zoneId === zoneId);
    const existingHTML = existing.length ? `
      <div class="bmf-existing-title">Marcas en esta zona:</div>
      ${existing.map(m => `
        <div class="bmf-existing-item">
          <span style="color:${markColor(m.type)}">●</span>
          ${MARK_TYPES.find(t=>t.id===m.type)?.label||m.type}
          ${m.date ? `· ${esc(m.date)}` : ''}
          <button class="bmf-del" data-mid="${m.id}">✕</button>
        </div>`).join('')}
      <hr style="margin:0.5rem 0;border-color:var(--border)">
    ` : '';

    const form = document.createElement('div');
    form.id = 'bm-mark-form';
    form.className = 'bm-mark-form';
    form.innerHTML = `
      <div class="bmf-header">
        <strong>${zone.label}</strong>
        <button class="bmf-close">✕</button>
      </div>
      ${existingHTML}
      <div class="bmf-title">Añadir marca</div>
      <select id="bmf-type" class="ana-select">
        ${MARK_TYPES.map(t => `<option value="${t.id}">${t.label}</option>`).join('')}
      </select>
      <input id="bmf-date" type="date" class="ana-input" placeholder="Fecha (aprox.)">
      <input id="bmf-downtime" type="number" min="0" class="ana-input" placeholder="Semanas de baja (opcional)">
      <textarea id="bmf-desc" class="ana-textarea" rows="2" placeholder="Descripción breve…"></textarea>
      <button id="bmf-save" class="btn btn-primary" style="width:100%;margin-top:0.5rem">Guardar marca</button>
    `;

    document.body.appendChild(form);

    // Position near click
    const clientX = e.clientX || (e.touches?.[0]?.clientX) || window.innerWidth / 2;
    const clientY = e.clientY || (e.touches?.[0]?.clientY) || window.innerHeight / 2;
    form.style.left = Math.min(clientX + 10, window.innerWidth - 260) + 'px';
    form.style.top  = Math.min(clientY - 20, window.innerHeight - 380) + 'px';

    // Close
    form.querySelector('.bmf-close').addEventListener('click', () => form.remove());
    document.addEventListener('mousedown', function outsideClick(ev) {
      if (!form.contains(ev.target)) { form.remove(); document.removeEventListener('mousedown', outsideClick); }
    });

    // Delete existing marks
    form.querySelectorAll('.bmf-del').forEach(btn => {
      btn.addEventListener('click', () => {
        const mid = btn.dataset.mid;
        this._data.marks = (this._data.marks || []).filter(m => m.id !== mid);
        this._data.injuryHistory = (this._data.injuryHistory || []).filter(m => m.id !== mid);
        this._renderBodyMap(side);
        this._renderInjuryTable();
        form.remove();
      });
    });

    // Save new mark
    form.querySelector('#bmf-save').addEventListener('click', () => {
      const type     = document.getElementById('bmf-type').value;
      const date     = document.getElementById('bmf-date').value;
      const downtime = document.getElementById('bmf-downtime').value;
      const desc     = document.getElementById('bmf-desc').value.trim();
      const id       = 'mark_' + Date.now();

      const mark = { id, zoneId, type, date, downtime: downtime ? parseInt(downtime) : null, description: desc };
      if (!this._data.marks) this._data.marks = [];
      this._data.marks.push(mark);

      // Also add to injuryHistory for the table
      if (!this._data.injuryHistory) this._data.injuryHistory = [];
      this._data.injuryHistory.push({ ...mark, zone: zone.label });

      this._renderBodyMap(side);
      this._renderInjuryTable();
      form.remove();
    });
  },

  /* ── Global listeners ────────────────────────────────── */
  _attachGlobalListeners() {
    document.getElementById('anamnesisModalClose')?.addEventListener('click', () => this.close());
    document.getElementById('anamnesisModalCancel')?.addEventListener('click', () => this.close());
    document.getElementById('anamnesisModalSave')?.addEventListener('click', () => this.save());
    // background click
    document.getElementById('anamnesisModal')?.addEventListener('click', e => {
      if (e.target.id === 'anamnesisModal') this.close();
    });
    // hide tooltip on scroll
    document.addEventListener('scroll', () => this._hideMarkTooltip(), { passive: true });
  },

  _showSavedFeedback() {
    const btn = document.getElementById('anamnesisModalSave');
    if (!btn) return;
    const orig = btn.textContent;
    btn.textContent = '✓ Guardado';
    btn.style.background = '#4caf50';
    setTimeout(() => { btn.textContent = orig; btn.style.background = ''; }, 1800);
  },

  /* ── Modal HTML ───────────────────────────────────────── */
  _modalHTML() {
    return `
<div id="anamnesisModal" class="modal">
  <div class="modal-content modal-content--wide anamnesis-modal-content">

    <div class="modal-header">
      <div class="modal-header-inner">
        <h2 style="display:flex;align-items:center;gap:0.5rem">
          🩺 <span>Anamnesis — </span><span id="anamnesis-player-name" style="color:var(--primary)"></span>
        </h2>
      </div>
      <button class="modal-close" id="anamnesisModalClose">✕</button>
    </div>

    <div class="modal-body" style="padding:1.5rem;display:flex;flex-direction:column;gap:1.5rem">

      <!-- DATOS BÁSICOS -->
      <section class="ana-section">
        <h3 class="ana-section-title">📋 Datos básicos</h3>
        <div class="ana-grid-2">
          <label class="ana-label">Fecha de nacimiento
            <input id="ana-dob" type="date" class="ana-input">
          </label>
          <label class="ana-label">Lateralidad
            <select id="ana-laterality" class="ana-select">
              <option value="">—</option>
              <option value="diestra">Diestra</option>
              <option value="zurda">Zurda</option>
              <option value="ambidiestra">Ambidiestra</option>
            </select>
          </label>
          <label class="ana-label">Posición
            <select id="ana-position" class="ana-select">
              <option value="">—</option>
              <option value="base">Base</option>
              <option value="escolta">Escolta</option>
              <option value="alero">Alero</option>
              <option value="ala-pivot">Ala-Pívot</option>
              <option value="pivot">Pívot</option>
            </select>
          </label>
          <label class="ana-label">Grupo sanguíneo
            <select id="ana-bloodtype" class="ana-select">
              <option value="">—</option>
              ${['A+','A-','B+','B-','AB+','AB-','0+','0-'].map(t=>`<option value="${t}">${t}</option>`).join('')}
            </select>
          </label>
          <label class="ana-label">Altura (cm)
            <input id="ana-height" type="number" min="140" max="220" class="ana-input" placeholder="ej. 178">
          </label>
          <label class="ana-label">Peso (kg)
            <input id="ana-weight" type="number" min="40" max="120" class="ana-input" placeholder="ej. 72">
          </label>
        </div>
      </section>

      <!-- HISTORIAL MÉDICO -->
      <section class="ana-section">
        <h3 class="ana-section-title">💊 Historial médico</h3>
        <div class="ana-grid-1">
          <label class="ana-label">Alergias
            <input id="ana-allergies" type="text" class="ana-input" placeholder="ej. penicilina, AINEs…">
          </label>
          <label class="ana-label">Medicación habitual
            <input id="ana-medication" type="text" class="ana-input" placeholder="ej. anticonceptivos, tiroides…">
          </label>
          <label class="ana-label">Enfermedades / condiciones relevantes
            <input id="ana-conditions" type="text" class="ana-input" placeholder="ej. asma, diabetes tipo 1…">
          </label>
          <label class="ana-label">Ciclo menstrual
            <select id="ana-menstrual" class="ana-select">
              <option value="">—</option>
              <option value="regular">Regular</option>
              <option value="irregular">Irregular</option>
              <option value="amenorrea">Amenorrea</option>
              <option value="anticonceptivos">Con anticonceptivos</option>
              <option value="na">No aplica</option>
            </select>
          </label>
        </div>
      </section>

      <!-- HÁBITOS -->
      <section class="ana-section">
        <h3 class="ana-section-title">🛌 Hábitos</h3>
        <div class="ana-grid-2">
          <label class="ana-label">Horas de sueño habituales
            <select id="ana-sleep" class="ana-select">
              <option value="">—</option>
              <option value="<6">Menos de 6h</option>
              <option value="6-7">6–7h</option>
              <option value="7-8">7–8h</option>
              <option value="8-9">8–9h</option>
              <option value=">9">Más de 9h</option>
            </select>
          </label>
          <label class="ana-label">Suplementación
            <input id="ana-supplements" type="text" class="ana-input" placeholder="ej. creatina, omega-3, vitamina D…">
          </label>
        </div>
      </section>

      <!-- BODY MAP -->
      <section class="ana-section">
        <h3 class="ana-section-title">🗺️ Mapa corporal de lesiones</h3>
        <p class="ana-hint">Haz clic en cualquier zona para añadir un antecedente. Pasa el ratón por encima de una marca para ver el detalle.</p>
        <div class="ana-bodymap-legend">
          ${MARK_TYPES.map(t => `<span class="ana-legend-item"><span style="color:${t.color}">●</span> ${t.label}</span>`).join('')}
        </div>
        <div class="ana-bodymap-wrap">
          <div class="ana-bodymap-col">
            <div class="ana-bodymap-label">Vista anterior</div>
            <div id="bm-container-front" class="bm-container"></div>
          </div>
          <div class="ana-bodymap-col">
            <div class="ana-bodymap-label">Vista posterior</div>
            <div id="bm-container-back" class="bm-container"></div>
          </div>
        </div>
      </section>

      <!-- INJURY HISTORY TABLE -->
      <section class="ana-section">
        <h3 class="ana-section-title">📊 Historial de lesiones / marcas</h3>
        <div style="overflow-x:auto">
          <table class="ana-table">
            <thead>
              <tr>
                <th>Zona</th><th>Tipo</th><th>Fecha</th><th>Descripción</th><th>Baja</th><th></th>
              </tr>
            </thead>
            <tbody id="ana-injury-tbody">
              <tr><td colspan="6" style="text-align:center;opacity:0.5;padding:1rem">Sin lesiones registradas</td></tr>
            </tbody>
          </table>
        </div>
      </section>

      <!-- NOTAS CLÍNICAS -->
      <section class="ana-section">
        <h3 class="ana-section-title">📝 Observaciones del fisioterapeuta</h3>
        <textarea id="ana-notes" class="ana-textarea" rows="4"
          placeholder="Valoración subjetiva inicial, patrones de movimiento, observaciones posturales…"></textarea>
      </section>

    </div><!-- /modal-body -->

    <div class="modal-footer">
      <button id="anamnesisModalCancel" class="btn btn-secondary">Cerrar</button>
      <button id="anamnesisModalSave" class="btn btn-primary">💾 Guardar anamnesis</button>
    </div>

  </div>
</div>`;
  }
};

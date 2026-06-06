// ============================================================
//  security.js — Utilidades de seguridad centralizadas
//  - esc(): sanitización XSS para innerHTML
//  - AppConfirm: modal de confirmación (reemplaza confirm())
//  - LoadCalculator: caché de EWMA/AC para evitar recálculos
// ============================================================

// ── 1. SANITIZACIÓN XSS ────────────────────────────────────
/**
 * Escapa caracteres HTML para uso seguro en innerHTML.
 * Uso: element.innerHTML = `<h3>${esc(player.name)}</h3>`
 */
function esc(str) {
    if (str == null) return '';
    const d = document.createElement('div');
    d.textContent = String(str);
    return d.innerHTML;
}
window.esc = esc;

// ── 2. MODAL DE CONFIRMACIÓN (reemplaza confirm() nativo) ──
const AppConfirm = {
    _resolve: null,

    show({ title = '¿Confirmar acción?', message = '', confirmText = 'Confirmar',
           cancelText = 'Cancelar', danger = false } = {}) {
        return new Promise(resolve => {
            this._resolve = resolve;
            const existing = document.getElementById('appConfirmModal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'appConfirmModal';
            modal.className = 'modal active';
            modal.style.cssText = 'z-index:9999';
            // fix P-10: atributos ARIA para accesibilidad de diálogo modal
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'appConfirmTitle');
            modal.innerHTML = `
                <div class="modal-content modal-small" style="max-width:400px">
                    <div class="modal-header">
                        <h2 id="appConfirmTitle">${esc(title)}</h2>
                    </div>
                    <div style="padding:1rem 1.5rem">
                        <p style="color:var(--text-secondary);line-height:1.5">${esc(message)}</p>
                    </div>
                    <div class="modal-footer" style="gap:0.75rem">
                        <button class="btn-secondary" id="appConfirmCancel">${esc(cancelText)}</button>
                        <button class="${danger ? 'btn-danger' : 'btn-primary'}" id="appConfirmOk">${esc(confirmText)}</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            document.getElementById('appConfirmOk').addEventListener('click', () => this._done(true));
            document.getElementById('appConfirmCancel').addEventListener('click', () => this._done(false));
            modal.addEventListener('click', e => { if (e.target === modal) this._done(false); });
            // fix P-10: cerrar con tecla Escape
            this._escHandler = (e) => { if (e.key === 'Escape') this._done(false); };
            document.addEventListener('keydown', this._escHandler);
            // Focus en botón peligroso o en cancelar para seguridad
            setTimeout(() => {
                const btn = danger
                    ? document.getElementById('appConfirmOk')
                    : document.getElementById('appConfirmCancel');
                btn?.focus();
            }, 50);
        });
    },

    _done(result) {
        document.getElementById('appConfirmModal')?.remove();
        // fix P-10: limpiar listener Escape
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        if (this._resolve) { this._resolve(result); this._resolve = null; }
    }
};
window.AppConfirm = AppConfirm;

// ── 3. CACHÉ DE CÁLCULOS EWMA/AC ──────────────────────────
// Invalida cuando cambia el nº de sesiones del equipo.
// Se resetea manualmente al guardar/eliminar sesiones.
const ACCache = {
    _cache: new Map(),
    _tick: 0,

    key(playerId, sessionsLength) {
        return `${playerId}_${sessionsLength}_${this._tick}`;
    },

    get(playerId, sessions) {
        return this._cache.get(this.key(playerId, sessions.length)) ?? null;
    },

    set(playerId, sessions, value) {
        this._cache.set(this.key(playerId, sessions.length), value);
    },

    invalidate() {
        this._tick++;
        this._cache.clear();
    }
};
window.ACCache = ACCache;

// ── 4. ZONA ARIA-LIVE PARA LECTORES DE PANTALLA ──────────
// Inyectar en el body al cargar; los toasts lo alimentan.
document.addEventListener('DOMContentLoaded', () => {
    if (!document.getElementById('a11yLive')) {
        const el = document.createElement('div');
        el.id = 'a11yLive';
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        el.className = 'sr-only';
        document.body.appendChild(el);
    }
});

/**
 * Anuncia un mensaje para lectores de pantalla.
 * Llamar junto a cualquier toast o cambio dinámico de estado.
 */
function announceA11y(message) {
    const el = document.getElementById('a11yLive');
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = message; });
}
window.announceA11y = announceA11y;

// ── 5. FOCUS TRAP — accesibilidad WCAG 2.1 AA ──────────────
/**
 * Atrapa el foco dentro de un modal mientras esté abierto.
 * Uso: const release = trapFocus(modalElement);
 *      release(); // al cerrar el modal
 */
function trapFocus(el) {
    const focusable = 'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"]),a[href]';
    const first = () => el.querySelectorAll(focusable)[0];
    const last  = () => { const all = el.querySelectorAll(focusable); return all[all.length - 1]; };

    function handler(e) {
        if (e.key !== 'Tab') return;
        if (e.shiftKey) {
            if (document.activeElement === first()) { e.preventDefault(); last()?.focus(); }
        } else {
            if (document.activeElement === last())  { e.preventDefault(); first()?.focus(); }
        }
    }
    el.addEventListener('keydown', handler);
    // Move focus to first focusable inside modal
    setTimeout(() => first()?.focus(), 50);
    return () => el.removeEventListener('keydown', handler);
}
window.trapFocus = trapFocus;

// ── 6. SKELETON SCREENS ─────────────────────────────────────
const Skeleton = {
    /**
     * Inserta N tarjetas skeleton en el contenedor dado.
     * Se eliminan automáticamente en cuanto se llame a Skeleton.clear(container).
     */
    show(container, count = 3, height = '88px') {
        if (!container) return;
        container.innerHTML = Array.from({ length: count }, () =>
            `<div class="skeleton-card" style="height:${height};border-radius:var(--border-radius-md);background:var(--color-background-secondary);animation:skeleton-pulse 1.4s ease-in-out infinite;margin-bottom:0.5rem"></div>`
        ).join('');
        if (!document.getElementById('skeleton-styles')) {
            const s = document.createElement('style');
            s.id = 'skeleton-styles';
            s.textContent = `@keyframes skeleton-pulse{0%,100%{opacity:1}50%{opacity:.4}}`;
            document.head.appendChild(s);
        }
    },
    clear(container) {
        if (!container) return;
        const cards = container.querySelectorAll('.skeleton-card');
        cards.forEach(c => c.remove());
    }
};
window.Skeleton = Skeleton;

// ── 7. ÍNDICE DE FATIGA DEL EQUIPO ──────────────────────────
/**
 * Calcula un índice compuesto 0-100 de fatiga del equipo.
 * Combina: A:C ratio promedio, wellness media y días desde descanso.
 * 100 = máxima fatiga/riesgo, 0 = descansado.
 *
 * @param {Array} players
 * @param {Function} getACRatio  fn(playerId) => { ratio: string }
 * @param {Array}  wellnessData  array de registros wellness [{playerId, date, score}]
 * @returns {{ index: number, label: string, color: string, components: object }}
 */
function calcTeamFatigueIndex(players, getACRatio, wellnessData = []) {
    if (!players?.length) return { index: 0, label: 'Sin datos', color: 'var(--text-secondary)', components: {} };

    // Component 1: A:C ratio score (0-40 pts)
    let acSum = 0, acCount = 0;
    for (const p of players) {
        const r = parseFloat(getACRatio(p.id)?.ratio);
        if (!isNaN(r)) {
            // >1.5 = max risk, <0.8 = underload, 0.8-1.3 = optimal
            acSum += Math.min(r / 1.5, 1);
            acCount++;
        }
    }
    const acScore = acCount ? (acSum / acCount) * 40 : 20;

    // Component 2: Wellness inverse score (0-40 pts)
    // Lower wellness average = higher fatigue
    const today = new Date().toISOString().slice(0, 10);
    const recent = wellnessData.filter(w => w.date >= today.slice(0, 7)); // current month
    let wellScore = 20; // default mid
    if (recent.length) {
        const avg = recent.reduce((s, w) => s + (w.score || w.total || 50), 0) / recent.length;
        wellScore = Math.max(0, Math.min(40, ((100 - avg) / 100) * 40));
    }

    // Component 3: Days since last rest day  (0-20 pts)
    // Placeholder: 0-7 days → 0-20 pts. Actual logic needs session data.
    const restScore = 10; // neutral until session data is passed

    const index = Math.round(acScore + wellScore + restScore);
    const clamped = Math.min(100, Math.max(0, index));

    let label, color;
    if (clamped >= 75)      { label = 'Fatiga alta';    color = 'var(--color-danger, #E24B4A)'; }
    else if (clamped >= 50) { label = 'Fatiga moderada'; color = 'var(--color-warning, #EF9F27)'; }
    else if (clamped >= 25) { label = 'Normal';          color = 'var(--color-success, #639922)'; }
    else                    { label = 'Descansado';      color = 'var(--color-success, #639922)'; }

    return { index: clamped, label, color, components: { acScore: Math.round(acScore), wellScore: Math.round(wellScore), restScore } };
}
window.calcTeamFatigueIndex = calcTeamFatigueIndex;

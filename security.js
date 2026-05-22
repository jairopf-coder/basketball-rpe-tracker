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
            modal.innerHTML = `
                <div class="modal-content modal-small" style="max-width:400px">
                    <div class="modal-header">
                        <h2>${esc(title)}</h2>
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

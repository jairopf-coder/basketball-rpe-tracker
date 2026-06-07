// ============================================================
//  security.js — Utilidades de seguridad centralizadas
//  - esc(): sanitización XSS para innerHTML
//  - AppConfirm: modal de confirmación (reemplaza confirm())
//  - AppAlert: modal de alerta    (reemplaza alert())
//  - AppPrompt: modal de entrada  (reemplaza prompt())
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
            this._escHandler = (e) => { if (e.key === 'Escape') this._done(false); };
            document.addEventListener('keydown', this._escHandler);
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
        if (this._escHandler) {
            document.removeEventListener('keydown', this._escHandler);
            this._escHandler = null;
        }
        if (this._resolve) { this._resolve(result); this._resolve = null; }
    }
};
window.AppConfirm = AppConfirm;

// ── 3. MODAL DE ALERTA (reemplaza alert() nativo) ──────────
/**
 * Reemplaza window.alert(). Funciona en iOS PWA.
 * Uso: await AppAlert.show('Mensaje de error');
 *      AppAlert.show('Mensaje'); // sin await también funciona
 */
const AppAlert = {
    show(message, title = 'Aviso') {
        return new Promise(resolve => {
            const existing = document.getElementById('appAlertModal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'appAlertModal';
            modal.className = 'modal active';
            modal.style.cssText = 'z-index:9999';
            modal.setAttribute('role', 'alertdialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'appAlertTitle');
            modal.innerHTML = `
                <div class="modal-content modal-small" style="max-width:380px">
                    <div class="modal-header">
                        <h2 id="appAlertTitle">${esc(title)}</h2>
                    </div>
                    <div style="padding:1rem 1.5rem">
                        <p style="color:var(--text-secondary);line-height:1.5">${esc(message)}</p>
                    </div>
                    <div class="modal-footer">
                        <button class="btn-primary" id="appAlertOk">Aceptar</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            const close = () => {
                modal.remove();
                document.removeEventListener('keydown', escH);
                resolve();
            };
            const escH = (e) => { if (e.key === 'Escape' || e.key === 'Enter') close(); };
            document.getElementById('appAlertOk').addEventListener('click', close);
            document.addEventListener('keydown', escH);
            setTimeout(() => document.getElementById('appAlertOk')?.focus(), 50);
        });
    }
};
window.AppAlert = AppAlert;

// ── 4. MODAL DE ENTRADA (reemplaza prompt() nativo) ────────
/**
 * Reemplaza window.prompt(). Funciona en iOS PWA.
 * Devuelve el string introducido, o null si cancela.
 * Uso: const val = await AppPrompt.show('Nombre:', 'valor por defecto');
 */
const AppPrompt = {
    show(message, defaultValue = '', title = 'Introducir valor') {
        return new Promise(resolve => {
            const existing = document.getElementById('appPromptModal');
            if (existing) existing.remove();

            const modal = document.createElement('div');
            modal.id = 'appPromptModal';
            modal.className = 'modal active';
            modal.style.cssText = 'z-index:9999';
            modal.setAttribute('role', 'dialog');
            modal.setAttribute('aria-modal', 'true');
            modal.setAttribute('aria-labelledby', 'appPromptTitle');
            modal.innerHTML = `
                <div class="modal-content modal-small" style="max-width:380px">
                    <div class="modal-header">
                        <h2 id="appPromptTitle">${esc(title)}</h2>
                    </div>
                    <div style="padding:1rem 1.5rem;display:flex;flex-direction:column;gap:.75rem">
                        <label style="color:var(--text-secondary);font-size:.9rem">${esc(message)}</label>
                        <input id="appPromptInput" class="form-control" type="text"
                               value="${esc(defaultValue)}" style="font-size:1rem">
                    </div>
                    <div class="modal-footer" style="gap:.75rem">
                        <button class="btn-secondary" id="appPromptCancel">Cancelar</button>
                        <button class="btn-primary"   id="appPromptOk">Aceptar</button>
                    </div>
                </div>`;
            document.body.appendChild(modal);

            const ok = () => {
                const val = document.getElementById('appPromptInput').value;
                modal.remove();
                document.removeEventListener('keydown', escH);
                resolve(val);
            };
            const cancel = () => {
                modal.remove();
                document.removeEventListener('keydown', escH);
                resolve(null);
            };
            const escH = (e) => {
                if (e.key === 'Escape') cancel();
                if (e.key === 'Enter')  ok();
            };
            document.getElementById('appPromptOk').addEventListener('click', ok);
            document.getElementById('appPromptCancel').addEventListener('click', cancel);
            document.addEventListener('keydown', escH);
            setTimeout(() => {
                const inp = document.getElementById('appPromptInput');
                inp?.focus();
                inp?.select();
            }, 50);
        });
    }
};
window.AppPrompt = AppPrompt;

// ── 5. CACHÉ DE CÁLCULOS EWMA/AC ──────────────────────────
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

// ── 6. ZONA ARIA-LIVE PARA LECTORES DE PANTALLA ──────────
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

function announceA11y(message) {
    const el = document.getElementById('a11yLive');
    if (!el) return;
    el.textContent = '';
    requestAnimationFrame(() => { el.textContent = message; });
}
window.announceA11y = announceA11y;

// ── 7. FOCUS TRAP — accesibilidad WCAG 2.1 AA ──────────────
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
    setTimeout(() => first()?.focus(), 50);
    return () => el.removeEventListener('keydown', handler);
}
window.trapFocus = trapFocus;

// ── 8. SKELETON SCREENS ─────────────────────────────────────
const Skeleton = {
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

// ── 9. ÍNDICE DE FATIGA DEL EQUIPO ──────────────────────────
function calcTeamFatigueIndex(players, getACRatio, wellnessData = []) {
    if (!players?.length) return { index: 0, label: 'Sin datos', color: 'var(--text-secondary)', components: {} };

    let acSum = 0, acCount = 0;
    for (const p of players) {
        const r = parseFloat(getACRatio(p.id)?.ratio);
        if (!isNaN(r)) {
            acSum += Math.min(r / 1.5, 1);
            acCount++;
        }
    }
    const acScore = acCount ? (acSum / acCount) * 40 : 20;

    const today = new Date().toISOString().slice(0, 10);
    const recent = wellnessData.filter(w => w.date >= today.slice(0, 7));
    let wellScore = 20;
    if (recent.length) {
        const avg = recent.reduce((s, w) => s + (w.score || w.total || 50), 0) / recent.length;
        wellScore = Math.max(0, Math.min(40, ((100 - avg) / 100) * 40));
    }

    const restScore = 10;
    const index = Math.round(acScore + wellScore + restScore);
    const clamped = Math.min(100, Math.max(0, index));

    let label, color;
    if (clamped >= 75)      { label = 'Fatiga alta';     color = 'var(--color-danger, #E24B4A)'; }
    else if (clamped >= 50) { label = 'Fatiga moderada'; color = 'var(--color-warning, #EF9F27)'; }
    else if (clamped >= 25) { label = 'Normal';           color = 'var(--color-success, #639922)'; }
    else                    { label = 'Descansado';       color = 'var(--color-success, #639922)'; }

    return { index: clamped, label, color, components: { acScore: Math.round(acScore), wellScore: Math.round(wellScore), restScore } };
}
window.calcTeamFatigueIndex = calcTeamFatigueIndex;

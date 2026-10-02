// export-fisio.js — Exportación .xlsx para la app del fisio (Ensino Lugo).
// Hojas: Bienestar, RPE, Regla (+ LEEME informativa). Especificación: instrucciones-ia-export-prepa.md
// Solo LEE datos: no escribe nada en Firebase ni en localStorage.
//
// Convenciones propias de BasketballRPE-Web (acordadas con el fisio, ver GUIA-EXPORT-FISIO.md):
//  • Bienestar: "Estrés" lleva el ESTADO DE ÁNIMO (mood); la app no recoge estrés.
//  • RPE: una fila por jugadora y DÍA con la media (redondeada) de las sesiones de ese día.
//  • Regla: solo se exportan los días con la regla marcada (Activa = Sí). Sin fila = sin regla.

const ExportFisio = (function () {
    'use strict';

    const FORMATO_VERSION = 1;
    const INCLUIR_HOJA_LEEME = true;          // pon false si el importador del fisio rechaza hojas extra
    const MAX_DIAS_RANGO = 366;

    const COLS_BIENESTAR = ['Jugadora', 'ID Oliver', 'Fecha', 'Sueño', 'Estrés', 'Fatiga', 'Dolor muscular'];
    const COLS_RPE       = ['Jugadora', 'ID Oliver', 'Fecha', 'Sesión', 'RPE', 'Nº sesiones', 'Detalle'];
    const COLS_REGLA     = ['Jugadora', 'ID Oliver', 'Fecha', 'Activa'];
    const COLS_LEEME     = ['Clave', 'Valor'];

    const TURNO = { morning: 'Mañana', afternoon: 'Tarde' };
    const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

    const esEntero = (v, min, max) => typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
    const dia = (s) => String(s || '').slice(0, 10);

    // Media redondeada al entero (x,5 sube). Evita 6.5 → 6 por redondeo bancario/flotantes.
    function mediaRedondeada(valores) {
        const suma = valores.reduce((a, b) => a + b, 0);
        return Math.floor(suma / valores.length + 0.5 + 1e-9);
    }

    // De varias entradas del mismo día, la más reciente (por ts; si no hay, la última del array).
    function masReciente(entradas) {
        return entradas.reduce((best, e) => {
            if (!best) return e;
            const val = (t) => (typeof t === 'number' ? t : Date.parse(t)) || 0;
            return val(e.ts) >= val(best.ts) ? e : best;
        }, null);
    }

    function validarRango(desde, hasta) {
        if (!ISO_RE.test(desde || '') || !ISO_RE.test(hasta || '')) return 'Elige las dos fechas.';
        if (desde > hasta) return 'La fecha "desde" no puede ser posterior a "hasta".';
        const dias = Math.round((Date.parse(hasta + 'T00:00:00Z') - Date.parse(desde + 'T00:00:00Z')) / 86400000) + 1;
        if (dias > MAX_DIAS_RANGO) return `El rango es demasiado largo (${dias} días; máximo ${MAX_DIAS_RANGO}).`;
        return null;
    }

    // Construye las hojas. Pura: recibe los datos y devuelve filas + avisos.
    //   datos = { players, sessions, wellness, gpsPlayerMap, desde, hasta }
    function construir(datos) {
        const { players = [], sessions = [], wellness = [], gpsPlayerMap = {}, desde, hasta } = datos;
        const avisos = [];
        const errorRango = validarRango(desde, hasta);
        if (errorRango) return { error: errorRango };

        const enRango = (f) => ISO_RE.test(f) && f >= desde && f <= hasta;
        const porId = new Map(players.map(p => [p.id, p]));

        // ID de Oli por jugadora (búsqueda inversa en gpsPlayerMap; si hay varios, el menor).
        const oliId = new Map();
        Object.keys(gpsPlayerMap).sort().forEach(k => {
            const pid = gpsPlayerMap[k];
            if (pid && !oliId.has(pid)) oliId.set(pid, String(k));
        });
        const ident = (p) => ({ Jugadora: String(p.name || '').trim(), 'ID Oliver': oliId.get(p.id) || '' });
        const ordenar = (a, b) => a.Fecha.localeCompare(b.Fecha)
            || a.Jugadora.localeCompare(b.Jugadora, 'es') || String(a['ID Oliver']).localeCompare(String(b['ID Oliver']));

        // ---- Wellness: una entrada por jugadora y día (la más reciente) ----
        const grupos = new Map();
        wellness.forEach(w => {
            if (!w || !porId.has(w.playerId) || !enRango(w.date)) return;
            const k = w.playerId + '|' + w.date;
            if (!grupos.has(k)) grupos.set(k, []);
            grupos.get(k).push(w);
        });
        const diasWellness = Array.from(grupos.values()).map(masReciente);

        // ---- Hoja Bienestar ----
        const bienestar = [];
        let incompletas = 0;
        diasWellness.forEach(w => {
            const ok = esEntero(w.sleep, 1, 5) && esEntero(w.mood, 1, 5) && esEntero(w.fatigue, 1, 5) && esEntero(w.soreness, 1, 5);
            if (!ok) { incompletas++; return; }
            bienestar.push(Object.assign(ident(porId.get(w.playerId)), {
                Fecha: w.date, 'Sueño': w.sleep, 'Estrés': w.mood, Fatiga: w.fatigue, 'Dolor muscular': w.soreness,
            }));
        });
        bienestar.sort(ordenar);
        if (incompletas) avisos.push(`${incompletas} cuestionario(s) de bienestar incompletos o con valores fuera de 1–5: no se exportan.`);

        // ---- Hoja Regla: solo días marcados ----
        const regla = [];
        diasWellness.forEach(w => {
            if (w.period === true) regla.push(Object.assign(ident(porId.get(w.playerId)), { Fecha: w.date, Activa: 'Sí' }));
        });
        regla.sort(ordenar);

        // ---- Hoja RPE: media por jugadora y día ----
        const sesionesDia = new Map();
        let rpeInvalidos = 0;
        sessions.forEach(s => {
            const f = dia(s && s.date);
            if (!s || !porId.has(s.playerId) || !enRango(f)) return;
            if (!esEntero(s.rpe, 0, 10)) { rpeInvalidos++; return; }
            const k = s.playerId + '|' + f;
            if (!sesionesDia.has(k)) sesionesDia.set(k, []);
            sesionesDia.get(k).push(s);
        });
        if (rpeInvalidos) avisos.push(`${rpeInvalidos} sesión(es) con RPE no válido (no entero entre 0 y 10): no se exportan.`);
        const rpe = [];
        let diasDobles = 0;
        sesionesDia.forEach((lista, k) => {
            const [pid, f] = k.split('|');
            lista.sort((a, b) => (a.timeOfDay === b.timeOfDay ? 0 : a.timeOfDay === 'morning' ? -1 : 1));
            if (lista.length > 1) diasDobles++;
            rpe.push(Object.assign(ident(porId.get(pid)), {
                Fecha: f,
                'Sesión': '',
                RPE: mediaRedondeada(lista.map(s => s.rpe)),
                'Nº sesiones': lista.length,
                Detalle: lista.map(s => `${TURNO[s.timeOfDay] || 'Sesión'} ${s.rpe}`).join(' · '),
            }));
        });
        rpe.sort(ordenar);

        // ---- Avisos de identificación ----
        const conDatos = new Set([...bienestar, ...rpe, ...regla].map(r => r.Jugadora));
        const sinId = Array.from(new Set([...bienestar, ...rpe, ...regla].filter(r => !r['ID Oliver']).map(r => r.Jugadora))).sort();
        if (sinId.length) avisos.push(`${sinId.length} jugadora(s) sin ID de Oli (se identificarán solo por nombre): ${sinId.join(', ')}.`);
        const nombres = new Map();
        [...bienestar, ...rpe, ...regla].forEach(r => { nombres.set(r.Jugadora, (nombres.get(r.Jugadora) || new Set()).add(r['ID Oliver'])); });
        nombres.forEach((ids, n) => { if (ids.size > 1) avisos.push(`El ID de ${n} no es el mismo en todas las filas (revisa su ficha).`); });

        const stats = {
            filasBienestar: bienestar.length, filasRPE: rpe.length, filasRegla: regla.length,
            jugadoras: conDatos.size, diasDobles, desde, hasta,
        };
        const leeme = construirLeeme(stats);
        return { bienestar, rpe, regla, leeme, avisos, stats, nombreArchivo: `ensino-bienestar-rpe-regla-${desde}-a-${hasta}.xlsx` };
    }

    function construirLeeme(st) {
        const f = (clave, valor) => ({ Clave: clave, Valor: valor });
        return [
            f('Origen', 'BasketballRPE-Web (app del preparador físico, Ensino Lugo)'),
            f('Formato', `ensino-bienestar-rpe-regla · versión ${FORMATO_VERSION} · ver GUIA-EXPORT-FISIO.md`),
            f('Ventana desde', st.desde),
            f('Ventana hasta', st.hasta),
            f('Filas Bienestar', st.filasBienestar),
            f('Filas RPE', st.filasRPE),
            f('Filas Regla', st.filasRegla),
            f('Jugadoras con datos', st.jugadoras),
            f('Escala Bienestar', '1 = peor, 5 = mejor en los 4 ítems. Exportada SIN transformar (no se invierte).'),
            f('Estrés', 'La app NO recoge estrés: la columna Estrés lleva el ESTADO DE ÁNIMO (mood). 1 = muy bajo, 5 = excelente.'),
            f('RPE', 'Media aritmética de las sesiones del día de cada jugadora, redondeada al entero (x,5 sube). Una fila por jugadora y día; Sesión vacía. Las columnas Nº sesiones y Detalle (extra) traen el desglose por turno.'),
            f('Regla', 'Solo se exportan los días con la regla marcada (Activa = Sí). NO hay filas con No: un día de la ventana sin fila para una jugadora significa que no la tenía marcada.'),
            f('ID Oliver', 'Es el "ID del Jugador" del export de Oli. Vacío si la jugadora aún no tiene ID en la app.'),
        ];
    }

    function aHoja(XLSX, columnas, filas, anchos) {
        const aoa = [columnas].concat(filas.map(r => columnas.map(c => (r[c] === undefined ? '' : r[c]))));
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = anchos.map(w => ({ wch: w }));
        return ws;
    }

    function crearLibro(XLSX, r) {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, aHoja(XLSX, COLS_BIENESTAR, r.bienestar, [26, 12, 12, 8, 8, 8, 15]), 'Bienestar');
        XLSX.utils.book_append_sheet(wb, aHoja(XLSX, COLS_RPE, r.rpe, [26, 12, 12, 10, 6, 12, 26]), 'RPE');
        XLSX.utils.book_append_sheet(wb, aHoja(XLSX, COLS_REGLA, r.regla, [26, 12, 12, 8]), 'Regla');
        if (INCLUIR_HOJA_LEEME) XLSX.utils.book_append_sheet(wb, aHoja(XLSX, COLS_LEEME, r.leeme, [22, 120]), 'LEEME');
        return wb;
    }

    // Texto corto para pegar junto al archivo (el fisio exige declarar escala y días "No").
    function mensajeEntrega(r) {
        const s = r.stats;
        return [
            `Export BasketballRPE-Web · ${s.desde} a ${s.hasta}`,
            `Filas: Bienestar ${s.filasBienestar} · RPE ${s.filasRPE} · Regla ${s.filasRegla} · Jugadoras ${s.jugadoras}`,
            '1) Escala de bienestar: 1 = peor, 5 = mejor, sin transformar. La columna Estrés lleva el ESTADO DE ÁNIMO (no recogemos estrés).',
            '2) Regla: solo los días con la regla marcada (Activa = Sí); NO hay filas con No. Día sin fila = sin regla.',
            '3) RPE: media diaria por jugadora (redondeada), Sesión vacía; desglose en las columnas Nº sesiones y Detalle.',
            'Detalles: GUIA-EXPORT-FISIO.md',
        ].join('\n');
    }

    return { construir, crearLibro, mensajeEntrega, validarRango, mediaRedondeada, FORMATO_VERSION,
             COLS_BIENESTAR, COLS_RPE, COLS_REGLA, COLS_LEEME };
})();
window.ExportFisio = ExportFisio;

// ───────────────────────── Interfaz (modal) ─────────────────────────

RPETracker.prototype._exportFisioLoadLib = function() {
    if (window.XLSX) return Promise.resolve();
    if (this._exportFisioLibPromise) return this._exportFisioLibPromise;
    this._exportFisioLibPromise = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'xlsx.mini.min.js';
        s.onload = () => resolve();
        s.onerror = () => { this._exportFisioLibPromise = null; reject(new Error('No se pudo cargar la librería de Excel')); };
        document.head.appendChild(s);
    });
    return this._exportFisioLibPromise;
};

RPETracker.prototype.openExportFisioModal = function() {
    let modal = document.getElementById('exportFisioModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'exportFisioModal';
        modal.className = 'modal modal--top';
        document.body.appendChild(modal);
    }
    const hoy = new Date();
    const hace6 = new Date(hoy); hace6.setDate(hace6.getDate() - 6);
    modal.innerHTML = `
        <div class="modal-content" style="max-width:520px;max-height:85vh;max-height:85dvh;">
            <div class="modal-header">
                <h2>🩺 Exportar para el fisio</h2>
                <button class="modal-close" onclick="window.rpeTracker?.closeExportFisio()">✕</button>
            </div>
            <div class="modal-body">
                <p style="font-size:0.9rem;opacity:.8;margin-bottom:12px;">
                    Genera un Excel con bienestar, RPE y regla del periodo elegido. Solo lee datos: no cambia nada en la app.
                </p>
                <div style="display:flex;gap:12px;flex-wrap:wrap;margin-bottom:12px;">
                    <label style="flex:1;min-width:140px;">Desde
                        <input type="date" id="exportFisioDesde" value="${toLocalISODate(hace6)}" onchange="window.rpeTracker?._exportFisioRefresh()">
                    </label>
                    <label style="flex:1;min-width:140px;">Hasta
                        <input type="date" id="exportFisioHasta" value="${toLocalISODate(hoy)}" onchange="window.rpeTracker?._exportFisioRefresh()">
                    </label>
                </div>
                <div id="exportFisioResumen" style="font-size:0.9rem;"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-secondary" id="exportFisioCopyBtn" disabled onclick="window.rpeTracker?._exportFisioCopyMessage()">📋 Copiar mensaje</button>
                <button class="btn-primary" id="exportFisioDownloadBtn" disabled onclick="window.rpeTracker?._exportFisioDownload()">📥 Descargar .xlsx</button>
            </div>
        </div>`;
    modal.classList.add('active');
    this._exportFisioResult = null;
    this._exportFisioRefresh();
};

RPETracker.prototype.closeExportFisio = function() {
    const m = document.getElementById('exportFisioModal');
    if (m) m.classList.remove('active');
    this._exportFisioResult = null;
};

RPETracker.prototype._exportFisioRefresh = async function() {
    const box = document.getElementById('exportFisioResumen');
    const btnDl = document.getElementById('exportFisioDownloadBtn');
    const btnCp = document.getElementById('exportFisioCopyBtn');
    if (!box) return;
    const token = (this._exportFisioToken = (this._exportFisioToken || 0) + 1);
    const setBtns = (on) => { if (btnDl) btnDl.disabled = !on; if (btnCp) btnCp.disabled = !on; };
    setBtns(false);
    this._exportFisioResult = null;

    const desde = document.getElementById('exportFisioDesde')?.value;
    const hasta = document.getElementById('exportFisioHasta')?.value;
    const errRango = ExportFisio.validarRango(desde, hasta);
    if (errRango) { box.innerHTML = `<div class="login-error" style="display:block">${esc(errRango)}</div>`; return; }

    // Wellness: con Firebase activo, esperar al primer snapshot para no exportar datos a medias.
    const cloud = window.firebaseSync && window.firebaseSync.db;
    if (cloud && !this._wellnessCloudReady) {
        box.innerHTML = '<div class="login-error" style="display:block">Esperando a que carguen los datos de bienestar desde Firebase… Vuelve a abrir esta ventana en unos segundos.</div>';
        return;
    }
    box.textContent = 'Calculando…';

    // Las sesiones se cargan por bloques de temporada: si el rango empieza antes, cargar todo.
    try {
        const inicioVentana = typeof getCurrentSeasonWindowStart === 'function' ? getCurrentSeasonWindowStart() : '';
        if (inicioVentana && desde < inicioVentana && typeof this.ensureFullSessionHistory === 'function') {
            await this.ensureFullSessionHistory();
        }
    } catch (e) {
        box.innerHTML = '<div class="login-error" style="display:block">No se pudo cargar el histórico de sesiones. Revisa la conexión.</div>';
        return;
    }
    if (token !== this._exportFisioToken) return; // el usuario cambió las fechas mientras tanto

    const r = ExportFisio.construir({
        players: this.players, sessions: this.sessions, wellness: this.wellnessData || [],
        gpsPlayerMap: this.gpsPlayerMap || {}, desde, hasta,
    });
    if (r.error) { box.innerHTML = `<div class="login-error" style="display:block">${esc(r.error)}</div>`; return; }

    // RPE enviados por jugadoras que el staff aún no ha revisado (no entran en el export).
    const avisos = r.avisos.slice();
    try {
        if (typeof this._analyzePlayerRpe === 'function') {
            const pend = this._analyzePlayerRpe().pending.filter(p => p.date >= desde && p.date <= hasta).length;
            if (pend) avisos.push(`${pend} RPE de jugadoras pendiente(s) de revisar en Inicio: no se exportan hasta que los añadas.`);
        }
    } catch (e) { /* aviso opcional */ }

    const s = r.stats;
    const total = s.filasBienestar + s.filasRPE + s.filasRegla;
    box.innerHTML = `
        <table class="data-table" style="width:100%;margin-bottom:10px;">
            <tr><td>Bienestar</td><td><strong>${s.filasBienestar}</strong> filas</td></tr>
            <tr><td>RPE (media diaria)</td><td><strong>${s.filasRPE}</strong> filas${s.diasDobles ? ` · ${s.diasDobles} día(s) con doble sesión` : ''}</td></tr>
            <tr><td>Regla (días marcados)</td><td><strong>${s.filasRegla}</strong> filas</td></tr>
            <tr><td>Jugadoras con datos</td><td><strong>${s.jugadoras}</strong></td></tr>
        </table>
        ${avisos.length ? `<div style="background:var(--warning-soft);color:var(--warning);border:1px solid var(--warning);border-radius:8px;padding:10px 12px;font-size:0.85rem;">
            ${avisos.map(a => `⚠️ ${esc(a)}`).join('<br>')}</div>` : '<div>✅ Sin avisos.</div>'}
        ${total === 0 ? '<div class="login-error" style="display:block;margin-top:8px">No hay datos en ese rango.</div>' : ''}`;
    this._exportFisioResult = r;
    setBtns(total > 0);
};

RPETracker.prototype._exportFisioDownload = async function() {
    const r = this._exportFisioResult;
    if (!r) return;
    try {
        await this._exportFisioLoadLib();
        const wb = ExportFisio.crearLibro(window.XLSX, r);
        const bytes = window.XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', r.nombreArchivo);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(url), 10000);
        this.showToast('📥 Excel para el fisio generado', 'success');
    } catch (e) {
        console.error('Export fisio:', e);
        this.showToast('⚠️ No se pudo generar el Excel: ' + e.message, 'warning');
    }
};

RPETracker.prototype._exportFisioCopyMessage = function() {
    const r = this._exportFisioResult;
    if (!r) return;
    const texto = ExportFisio.mensajeEntrega(r);
    const ok = () => this.showToast('📋 Mensaje copiado', 'success');
    const fallo = () => AppAlert.show(texto);
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(texto).then(ok, fallo);
    else fallo();
};

// ============================================================
//  tests-export.js — Exportar los tests de rendimiento a Excel (.xlsx)
//  Rendimiento → Tests → "📄 Informe / Excel" → botón "📥 Excel"
//
//  Usa los mismos filtros del informe PDF: alcance (equipo o una jugadora), rango de fechas y tests.
//  El archivo lleva tres hojas:
//    • Resultados      una fila por jugadora, test y día (formato largo: sirve para filtros y tablas dinámicas)
//    • Resumen equipo  una fila por test y día: media, mejor y peor valor, mejor jugadora, cambio de la media
//    • LEEME           qué significa cada columna y qué filtros se aplicaron
//
//  Solo LEE this.testSessions: no escribe nada. Usa la librería xlsx.mini.min.js, que carga
//  export-fisio.js (_exportFisioLoadLib) la primera vez que se necesita.
//  Depende de strength.js (TEST_DEFINITIONS, asymmetry) y de tests-wizard.js (TestWizardLogic).
// ============================================================

const TestsExport = (function () {
    const COLS_RESULTADOS = ['Fecha', 'Jugadora', 'Estado', 'Test', 'Unidad', 'Valor', 'Izquierda', 'Derecha',
        'Asimetría (%)', 'Potencia (W)', 'Potencia (W/kg)', 'Peso (kg)', 'Intentos', 'Nota'];
    const COLS_RESUMEN = ['Fecha', 'Test', 'Unidad', 'Nº jugadoras', 'Media', 'Mejor', 'Peor', 'Mejor jugadora', 'Cambio de la media (%)'];
    const COLS_LEEME = ['Campo', 'Descripción'];
    const FORMATO_FECHA = 'dd/mm/yyyy';

    /** Número de serie de fecha de Excel (días desde 1899-12-30) para "AAAA-MM-DD"; null si no es una fecha */
    function serialExcel(iso) {
        const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || ''));
        if (!m) return null;
        return Math.round((Date.UTC(+m[1], +m[2] - 1, +m[3]) - Date.UTC(1899, 11, 30)) / 86400000);
    }

    const nombreCompleto = p => [p.name, p.lastName].map(s => String(s || '').trim()).filter(Boolean).join(' ');
    const redondear = (v, dec) => (v === null || v === undefined || isNaN(v) ? '' : Number(Number(v).toFixed(dec)));
    const slug = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

    /** Texto con los intentos de un resultado (alturas en cm) */
    function textoIntentos(def, r) {
        const lista = a => (a || []).join(' / ');
        if (def.bilateral) {
            const partes = [];
            if (r.trials_left && r.trials_left.length) partes.push('I: ' + lista(r.trials_left));
            if (r.trials_right && r.trials_right.length) partes.push('D: ' + lista(r.trials_right));
            return partes.join(' · ');
        }
        return lista(r.trials);
    }

    /**
     * Construye las filas del Excel.
     * o: { sessions, players, scope ('team' | id de jugadora), desde, hasta ('AAAA-MM-DD'), testIds, hoy }
     */
    function construir(o) {
        const sessions = o.sessions || [];
        const players = o.players || [];
        const byId = new Map(players.map(p => [p.id, p]));
        const scope = o.scope && o.scope !== 'team' ? o.scope : null;
        const defs = TEST_DEFINITIONS.filter(d => !o.testIds || o.testIds.includes(d.id));
        const L = TestWizardLogic;

        const quien = pid => {
            const p = byId.get(pid);
            return p ? { nombre: nombreCompleto(p), estado: p.archived ? 'Baja' : 'Activa' } : { nombre: '(jugadora eliminada)', estado: '' };
        };

        const filas = [];
        sessions.forEach(s => {
            if (!s || !s.results || !s.date) return;
            if (o.desde && s.date < o.desde) return;
            if (o.hasta && s.date > o.hasta) return;
            if (scope && s.playerId !== scope) return;
            defs.forEach(def => {
                const r = s.results[def.id];
                if (!r) return;
                const main = L.mainValue(def, r);
                if (main === null) return;
                const q = quien(s.playerId);
                const ambos = def.bilateral && r.left != null && r.right != null;
                filas.push({
                    Fecha: s.date.slice(0, 10), Jugadora: q.nombre, Estado: q.estado,
                    Test: def.name, Unidad: def.unit, Valor: redondear(main, 2),
                    Izquierda: def.bilateral ? redondear(r.left, 2) : '', Derecha: def.bilateral ? redondear(r.right, 2) : '',
                    'Asimetría (%)': ambos ? parseFloat(asymmetry(r.left, r.right)) : '',
                    'Potencia (W)': r.power != null ? r.power : '', 'Potencia (W/kg)': r.powerPerKg != null ? r.powerPerKg : '',
                    'Peso (kg)': s.bodyWeight > 0 ? s.bodyWeight : '',
                    Intentos: textoIntentos(def, r), Nota: r.note || '',
                    _playerId: s.playerId, _testId: def.id, _createdAt: s.createdAt || '', _main: main
                });
            });
        });

        const ordenTest = id => TEST_DEFINITIONS.findIndex(d => d.id === id);
        filas.sort((a, b) => a.Fecha.localeCompare(b.Fecha) || ordenTest(a._testId) - ordenTest(b._testId) || a.Jugadora.localeCompare(b.Jugadora, 'es'));

        // Resumen por test y día: una jugadora cuenta una sola vez (el último registro de ese día)
        const porClave = new Map();
        filas.forEach(f => {
            const k = f._testId + '|' + f.Fecha + '|' + f._playerId;
            const cur = porClave.get(k);
            if (!cur || String(f._createdAt) >= String(cur._createdAt)) porClave.set(k, f);
        });
        const grupos = new Map();
        porClave.forEach(f => {
            const k = f._testId + '|' + f.Fecha;
            if (!grupos.has(k)) grupos.set(k, { testId: f._testId, fecha: f.Fecha, filas: [] });
            grupos.get(k).filas.push(f);
        });
        const resumen = [];
        defs.forEach(def => {
            let mediaPrevia = null;
            [...grupos.values()].filter(g => g.testId === def.id).sort((a, b) => a.fecha.localeCompare(b.fecha)).forEach(g => {
                const vals = g.filas.map(f => f._main);
                const media = vals.reduce((a, b) => a + b, 0) / vals.length;
                const ordenados = g.filas.slice().sort((a, b) => (L.isBetter(def, a._main, b._main) ? -1 : L.isBetter(def, b._main, a._main) ? 1 : a.Jugadora.localeCompare(b.Jugadora, 'es')));
                const mejor = ordenados[0], peor = ordenados[ordenados.length - 1];
                const cambio = L.pctChange(mediaPrevia, media);
                resumen.push({
                    Fecha: g.fecha, Test: def.name, Unidad: def.unit, 'Nº jugadoras': g.filas.length,
                    Media: redondear(media, 2), Mejor: redondear(mejor._main, 2), Peor: redondear(peor._main, 2),
                    'Mejor jugadora': mejor.Jugadora, 'Cambio de la media (%)': cambio === null ? '' : cambio
                });
                mediaPrevia = media;
            });
        });

        const fechas = filas.map(f => f.Fecha);
        const limpias = filas.map(f => { const c = { ...f }; Object.keys(c).filter(k => k.startsWith('_')).forEach(k => delete c[k]); return c; });
        const alcance = scope ? (byId.get(scope) ? nombreCompleto(byId.get(scope)) : 'Una jugadora') : 'Equipo completo';
        const stats = {
            filasResultados: limpias.length, filasResumen: resumen.length,
            jugadoras: new Set(filas.map(f => f._playerId)).size, tests: new Set(filas.map(f => f._testId)).size,
            desde: fechas.length ? fechas[0] : '', hasta: fechas.length ? fechas[fechas.length - 1] : ''
        };
        const leeme = filasLeeme({ alcance, desde: o.desde, hasta: o.hasta, tests: defs.map(d => d.name) });
        const hoy = o.hoy || '';
        const nombreArchivo = `BasketballRPE-tests${scope ? '_' + slug(alcance) : ''}${hoy ? '_' + hoy : ''}.xlsx`;
        return { resultados: limpias, resumen, leeme, stats, alcance, nombreArchivo };
    }

    function filasLeeme(f) {
        const g = (campo, descripcion) => ({ Campo: campo, 'Descripción': descripcion });
        return [
            g('Filtros aplicados', `Alcance: ${f.alcance} · Fechas: ${f.desde || 'inicio'} a ${f.hasta || 'hoy'} · Tests: ${f.tests.join(', ')}`),
            g('Hoja Resultados', 'Una fila por jugadora, test y día (formato largo, pensado para filtros y tablas dinámicas). Si una jugadora tiene dos registros del mismo test el mismo día, salen los dos.'),
            g('Hoja Resumen equipo', 'Una fila por test y día con la media, el mejor y el peor valor del equipo. Ahí cada jugadora cuenta una vez por día (el último registro).'),
            g('Fecha', 'Día del test, como fecha de Excel.'),
            g('Jugadora', 'Nombre + apellido de la ficha.'),
            g('Estado', 'Activa o Baja (las jugadoras de baja conservan su histórico).'),
            g('Valor', 'Resultado del test en la unidad indicada. CMJ, SJ, Drop Jump y Single Leg CMJ: altura de salto en cm (media de los intentos, calculada desde el tiempo de vuelo). En los tests de dos piernas es la media de Izquierda y Derecha.'),
            g('Izquierda / Derecha', 'Solo en los tests de dos piernas (Single Leg CMJ, Side to Side Hop, Triple Hop, 5-0-5).'),
            g('Asimetría (%)', 'Diferencia entre piernas respecto a la mayor de las dos: |I − D| / máximo(I, D) × 100. En la app se marca en rojo desde el 15 %.'),
            g('Potencia (W) y (W/kg)', 'Pico de potencia estimado con la fórmula de Sayers (60,7 × altura en cm + 45,3 × peso en kg − 2055). Solo en CMJ y SJ cuando hay peso registrado.'),
            g('Peso (kg)', 'Peso corporal anotado en esa sesión de tests.'),
            g('Intentos', 'Alturas (cm) de cada salto. En tests de dos piernas: I = izquierda, D = derecha.'),
            g('Nota', 'Nota escrita al registrar el test (condiciones del día y/o de la jugadora).'),
            g('Mejor / Peor (Resumen)', 'Mejor = el valor más bajo en Sprint 10 m, Sprint 20 m y 5-0-5 (ahí menos es mejor) y el más alto en el resto.'),
            g('Cambio de la media (%)', 'Variación de la media del equipo respecto a la fecha anterior en que se hizo ese test.')
        ];
    }

    /** Hoja de Excel desde filas (objetos por nombre de columna); las columnas de fecha salen como fechas reales */
    function aHoja(XLSX, columnas, filas, anchos, colsFecha) {
        const aoa = [columnas].concat(filas.map(r => columnas.map(c => {
            const v = r[c];
            if (v === undefined || v === null) return '';
            if (colsFecha && colsFecha.includes(c)) {
                const n = serialExcel(v);
                return n === null ? '' : { t: 'n', v: n, z: FORMATO_FECHA };
            }
            return v;
        })));
        const ws = XLSX.utils.aoa_to_sheet(aoa);
        ws['!cols'] = anchos.map(w => ({ wch: w }));
        if (filas.length) ws['!autofilter'] = { ref: ws['!ref'] };
        return ws;
    }

    function crearLibro(XLSX, r) {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, aHoja(XLSX, COLS_RESULTADOS, r.resultados, [12, 26, 8, 18, 8, 9, 10, 10, 13, 13, 15, 10, 26, 40], ['Fecha']), 'Resultados');
        XLSX.utils.book_append_sheet(wb, aHoja(XLSX, COLS_RESUMEN, r.resumen, [12, 18, 8, 13, 9, 9, 9, 26, 20], ['Fecha']), 'Resumen equipo');
        const leeme = aHoja(XLSX, COLS_LEEME, r.leeme, [26, 130]);
        delete leeme['!autofilter'];
        XLSX.utils.book_append_sheet(wb, leeme, 'LEEME');
        return wb;
    }

    return { construir, crearLibro, serialExcel, COLS_RESULTADOS, COLS_RESUMEN, COLS_LEEME };
})();
window.TestsExport = TestsExport;

// ───────────────────────── Interfaz ─────────────────────────

/** Descarga el Excel con los filtros del modal de informe de Tests (alcance, fechas y tests) */
RPETracker.prototype.generateTestsExcel = async function() {
    const scope = document.getElementById('testsReportScope')?.value;
    const desde = document.getElementById('testsReportFrom')?.value;
    const hasta = document.getElementById('testsReportTo')?.value;
    const testIds = Array.from(document.querySelectorAll('.testsReportCheck:checked')).map(cb => cb.value);

    if (!desde || !hasta) { this.showToast('Selecciona un rango de fechas', 'error'); return; }
    if (desde > hasta) { this.showToast('La fecha "desde" no puede ser posterior a "hasta"', 'error'); return; }
    if (testIds.length === 0) { this.showToast('Selecciona al menos un test', 'error'); return; }
    if (!this.testSessions && typeof this._loadStrengthData === 'function') this._loadStrengthData();

    const r = TestsExport.construir({
        sessions: this.testSessions || [], players: this.players || [],
        scope, desde, hasta, testIds, hoy: toLocalISODate(new Date())
    });
    if (r.stats.filasResultados === 0) { this.showToast('No hay tests en ese rango y con esos filtros', 'warning'); return; }

    try {
        if (typeof this._exportFisioLoadLib !== 'function') throw new Error('no está disponible la librería de Excel');
        await this._exportFisioLoadLib();
        const wb = TestsExport.crearLibro(window.XLSX, r);
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
        document.getElementById('testsReportModal')?.classList.remove('active');
        this.showToast(`📥 Excel de tests generado (${r.stats.filasResultados} registros)`, 'success');
    } catch (e) {
        console.error('Export tests:', e);
        this.showToast('⚠️ No se pudo generar el Excel: ' + e.message, 'warning');
    }
};

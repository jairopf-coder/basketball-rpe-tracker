// test/export-fisio.test.js
// Exportación .xlsx para el fisio (formato 2): hojas Bienestar, RPE (media diaria) y Regla (solo días marcados).
// Las jugadoras se identifican por nombre y apellido (sin IDs).
// Ejecutar con:  node test/export-fisio.test.js
// Si se pasa una ruta como argumento, además escribe ahí un .xlsx de ejemplo (lo usa verificar_export.py).
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const XLSX = require('../xlsx.mini.min.js');

const pending = [];
function test(name, fn) { pending.push({ name, fn }); }

const els = {};
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Map, Object, Array, Number, String, parseInt, isNaN, Promise, setTimeout,
    window: { firebaseSync: null }, document: { getElementById: id => els[id] || null },
    esc: s => String(s), toLocalISODate: d => d.toISOString().slice(0, 10),
    getCurrentSeasonWindowStart: () => '2026-08-01',
});
vm.runInContext('function RPETracker() {}', ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'export-fisio.js'), 'utf8'), ctx);
const EF = ctx.window.ExportFisio;
const J = x => JSON.parse(JSON.stringify(x));

const players = [
    { id: 'p1', name: 'Carla', lastName: 'Mendes Rocha' }, { id: 'p2', name: 'Ingrid', lastName: 'Van Dijk' }, { id: 'p3', name: 'Ana' },
];
const w = (playerId, date, s, f, m, d, extra) => Object.assign({ playerId, date, sleep: s, fatigue: f, mood: m, soreness: d }, extra || {});
const ses = (playerId, date, timeOfDay, rpe) => ({ id: playerId + date + timeOfDay, playerId, date: date + (timeOfDay === 'morning' ? 'T10:00:00' : 'T18:00:00'), timeOfDay, type: 'training', rpe });
const run = (o) => EF.construir(Object.assign({ players, sessions: [], wellness: [], desde: '2026-09-28', hasta: '2026-10-04' }, o));

console.log('\nRango');
test('rango válido e inválido', () => {
    assert.strictEqual(EF.validarRango('2026-09-28', '2026-10-04'), null);
    assert.ok(EF.validarRango('2026-10-04', '2026-09-28'));
    assert.ok(EF.validarRango('', '2026-10-04'));
    assert.ok(EF.validarRango('2025-01-01', '2026-12-31'), 'más de 366 días');
    assert.ok(run({ desde: 'x' }).error);
});

console.log('\nBienestar');
test('mapea sin transformar: Ánimo→Estrés, Energía→Fatiga, Muscular→Dolor muscular', () => {
    const r = run({ wellness: [w('p1', '2026-09-29', 4, 2, 5, 1)] });
    assert.deepStrictEqual(J(r.bienestar), [{ Jugadora: 'Carla Mendes Rocha', Apellido: 'Mendes Rocha', Fecha: '2026-09-29',
        'Sueño': 4, 'Estrés': 5, Fatiga: 2, 'Dolor muscular': 1 }]);
});
test('descarta incompletos y fuera de 1–5, y avisa', () => {
    const r = run({ wellness: [w('p1', '2026-09-29', 4, 2, null, 1), w('p1', '2026-09-30', 6, 2, 3, 1), w('p1', '2026-10-01', 3.5, 2, 3, 1), w('p1', '2026-10-02', 3, 3, 3, 3)] });
    assert.strictEqual(r.bienestar.length, 1);
    assert.ok(r.avisos.some(a => a.includes('3 cuestionario')));
});
test('rango inclusivo y excluye fuera de rango', () => {
    const r = run({ wellness: [w('p1', '2026-09-27', 3, 3, 3, 3), w('p1', '2026-09-28', 3, 3, 3, 3), w('p1', '2026-10-04', 3, 3, 3, 3), w('p1', '2026-10-05', 3, 3, 3, 3)] });
    assert.deepStrictEqual(J(r.bienestar.map(x => x.Fecha)), ['2026-09-28', '2026-10-04']);
});
test('un duplicado el mismo día se queda con el más reciente', () => {
    const r = run({ wellness: [w('p1', '2026-09-29', 1, 1, 1, 1, { ts: 100 }), w('p1', '2026-09-29', 5, 5, 5, 5, { ts: 200 }), w('p1', '2026-09-29', 2, 2, 2, 2, { ts: 50 })] });
    assert.strictEqual(r.bienestar.length, 1);
    assert.strictEqual(r.bienestar[0]['Sueño'], 5);
});
test('jugadoras que no están en el plantel se ignoran', () => {
    assert.strictEqual(run({ wellness: [w('pX', '2026-09-29', 3, 3, 3, 3)] }).bienestar.length, 0);
});

console.log('\nRPE (media diaria)');
test('dos sesiones el mismo día → una fila con la media redondeada', () => {
    const r = run({ sessions: [ses('p1', '2026-09-29', 'morning', 6), ses('p1', '2026-09-29', 'afternoon', 8)] });
    assert.strictEqual(r.rpe.length, 1);
    assert.deepStrictEqual(J(r.rpe[0]), { Jugadora: 'Carla Mendes Rocha', Apellido: 'Mendes Rocha', Fecha: '2026-09-29', 'Sesión': '', RPE: 7,
        'Nº sesiones': 2, Detalle: 'Mañana 6 · Tarde 8' });
    assert.strictEqual(r.stats.diasDobles, 1);
});
test('redondeo: x,5 sube y el resultado siempre es entero', () => {
    [[[6, 7], 7], [[7, 8], 8], [[5, 5], 5], [[4, 7], 6], [[1, 2], 2], [[0, 1], 1], [[10, 9], 10], [[3, 4, 4], 4]].forEach(([v, esp]) =>
        assert.strictEqual(EF.mediaRedondeada(v), esp, v.join(',')));
});
test('el detalle pone la mañana antes que la tarde aunque lleguen al revés', () => {
    const r = run({ sessions: [ses('p1', '2026-09-29', 'afternoon', 8), ses('p1', '2026-09-29', 'morning', 6)] });
    assert.strictEqual(r.rpe[0].Detalle, 'Mañana 6 · Tarde 8');
});
test('sesión única: RPE tal cual, Sesión vacía, Nº sesiones 1', () => {
    const r = run({ sessions: [ses('p2', '2026-09-30', 'afternoon', 9)] });
    assert.strictEqual(r.rpe[0].RPE, 9);
    assert.strictEqual(r.rpe[0]['Sesión'], '');
    assert.strictEqual(r.rpe[0]['Nº sesiones'], 1);
    assert.strictEqual(r.rpe[0].Detalle, 'Tarde 9');
});
test('RPE no válido se descarta con aviso', () => {
    const r = run({ sessions: [ses('p1', '2026-09-29', 'morning', 11), ses('p1', '2026-09-30', 'morning', 5.5), ses('p1', '2026-10-01', 'morning', 4)] });
    assert.strictEqual(r.rpe.length, 1);
    assert.ok(r.avisos.some(a => a.includes('2 sesión')));
});
test('no se exportan s-RPE ni duración', () => {
    assert.ok(!EF.COLS_RPE.some(c => /s-?rpe|duraci/i.test(c)));
});

console.log('\nRegla (solo días marcados)');
test('solo Sí; period false/undefined no genera fila', () => {
    const r = run({ wellness: [w('p1', '2026-09-28', 3, 3, 3, 3, { period: true }), w('p1', '2026-09-29', 3, 3, 3, 3, { period: true }),
        w('p1', '2026-09-30', 3, 3, 3, 3), w('p1', '2026-10-01', 3, 3, 3, 3, { period: false }), w('p2', '2026-09-28', 3, 3, 3, 3)] });
    assert.deepStrictEqual(J(r.regla.map(x => [x.Jugadora, x.Fecha, x.Activa])),
        [['Carla Mendes Rocha', '2026-09-28', 'Sí'], ['Carla Mendes Rocha', '2026-09-29', 'Sí']]);
    assert.ok(!r.regla.some(x => x.Activa !== 'Sí'), 'nunca filas No');
});
test('una jugadora sin ninguna marca no aparece en la hoja', () => {
    const r = run({ wellness: [w('p2', '2026-09-28', 3, 3, 3, 3)] });
    assert.strictEqual(r.regla.length, 0);
});
test('la regla marcada en un cuestionario incompleto sí se exporta, pero el bienestar no', () => {
    const r = run({ wellness: [w('p1', '2026-09-28', 3, null, 3, 3, { period: true })] });
    assert.strictEqual(r.regla.length, 1);
    assert.strictEqual(r.bienestar.length, 0);
});

console.log('\nIdentificación (nombre + apellido, sin IDs)');
test('mismo nombre y apellido en las tres hojas', () => {
    const r = run({ wellness: [w('p1', '2026-09-28', 3, 3, 3, 3, { period: true })], sessions: [ses('p1', '2026-09-28', 'morning', 5)] });
    [r.bienestar[0], r.rpe[0], r.regla[0]].forEach(f => {
        assert.strictEqual(f.Jugadora, 'Carla Mendes Rocha');
        assert.strictEqual(f.Apellido, 'Mendes Rocha');
    });
});
test('Jugadora = nombre + apellido, y quitando Apellido del final queda el nombre', () => {
    const r = run({ players: [{ id: 'p1', name: 'María José', lastName: 'García' }], wellness: [w('p1', '2026-09-28', 3, 3, 3, 3)] });
    assert.strictEqual(r.bienestar[0].Jugadora, 'María José García');
    assert.strictEqual(r.bienestar[0].Apellido, 'García');
    assert.ok(r.bienestar[0].Jugadora.endsWith(' ' + r.bienestar[0].Apellido));
});
test('los espacios sobrantes no cuelan en el archivo', () => {
    const r = run({ players: [{ id: 'p1', name: ' Carla ', lastName: '  Mendes Rocha ' }], wellness: [w('p1', '2026-09-28', 3, 3, 3, 3)] });
    assert.strictEqual(r.bienestar[0].Jugadora, 'Carla Mendes Rocha');
    assert.strictEqual(r.bienestar[0].Apellido, 'Mendes Rocha');
});
test('ficha sin apellido: Apellido vacío, Jugadora solo el nombre, y se avisa', () => {
    const r = run({ wellness: [w('p3', '2026-09-28', 3, 3, 3, 3)] });
    assert.strictEqual(r.bienestar[0].Jugadora, 'Ana');
    assert.strictEqual(r.bienestar[0].Apellido, '');
    assert.ok(r.avisos.some(a => a.includes('sin apellido') && a.includes('Ana')));
});
test('ficha antigua con el nombre completo en `name`: sale igual y se avisa de que falta el apellido', () => {
    const r = run({ players: [{ id: 'p1', name: 'Carla Mendes Rocha' }], wellness: [w('p1', '2026-09-28', 3, 3, 3, 3)] });
    assert.strictEqual(r.bienestar[0].Jugadora, 'Carla Mendes Rocha');
    assert.strictEqual(r.bienestar[0].Apellido, '');
    assert.ok(r.avisos.some(a => a.includes('sin apellido')));
});
test('solo se avisa de las fichas sin apellido que SALEN en el archivo', () => {
    const r = run({ wellness: [w('p1', '2026-09-28', 3, 3, 3, 3)] });   // Ana (p3) no tiene datos
    assert.ok(!r.avisos.some(a => a.includes('sin apellido')));
});
test('dos jugadoras con el mismo nombre completo: se avisa y cuentan como dos', () => {
    const r = run({
        players: [{ id: 'p1', name: 'Sara', lastName: 'López' }, { id: 'p2', name: 'Sara', lastName: 'López' }],
        wellness: [w('p1', '2026-09-28', 3, 3, 3, 3), w('p2', '2026-09-28', 4, 4, 4, 4)],
    });
    assert.ok(r.avisos.some(a => a.includes('2 jugadoras') && a.includes('Sara López')));
    assert.strictEqual(r.stats.jugadoras, 2);
});
test('el formato ya no lleva ID de Oli: ni columna ni uso del mapa de IDs', () => {
    [EF.COLS_BIENESTAR, EF.COLS_RPE, EF.COLS_REGLA].forEach(cols => {
        assert.ok(!cols.includes('ID Oliver'));
        assert.deepStrictEqual(J(cols.slice(0, 2)), ['Jugadora', 'Apellido']);
    });
    const conMapa = run({ gpsPlayerMap: { '47162': 'p1' }, wellness: [w('p1', '2026-09-28', 3, 3, 3, 3)] });
    const sinMapa = run({ wellness: [w('p1', '2026-09-28', 3, 3, 3, 3)] });
    assert.deepStrictEqual(J(conMapa), J(sinMapa));
    assert.ok(!Object.keys(conMapa.bienestar[0]).includes('ID Oliver'));
});
test('no hay ninguna columna llamada «Nombre» (el importador del fisio la tomaría por Jugadora)', () => {
    [EF.COLS_BIENESTAR, EF.COLS_RPE, EF.COLS_REGLA].forEach(cols => assert.ok(!cols.some(c => /^nombre/i.test(c))));
});
test('el recuento de jugadoras cuenta personas, no nombres', () => {
    const r = run({ wellness: [w('p1', '2026-09-28', 3, 3, 3, 3), w('p2', '2026-09-28', 3, 3, 3, 3), w('p1', '2026-09-29', 3, 3, 3, 3)] });
    assert.strictEqual(r.stats.jugadoras, 2);
});

console.log('\nDeterminismo');
test('el mismo rango da el mismo resultado aunque los datos lleguen en otro orden', () => {
    const wl = [w('p2', '2026-09-30', 3, 4, 5, 2), w('p1', '2026-09-28', 1, 2, 3, 4, { period: true }), w('p1', '2026-09-29', 5, 5, 5, 5)];
    const sl = [ses('p2', '2026-09-30', 'afternoon', 7), ses('p1', '2026-09-28', 'morning', 3), ses('p1', '2026-09-28', 'afternoon', 4)];
    const a = run({ wellness: wl, sessions: sl });
    const b = run({ wellness: wl.slice().reverse(), sessions: sl.slice().reverse() });
    assert.deepStrictEqual(J(a), J(b));
});

console.log('\nArchivo .xlsx');
const demo = () => run({
    wellness: [w('p1', '2026-09-28', 4, 3, 5, 2, { period: true }), w('p1', '2026-09-29', 4, 3, 5, 2, { period: true }), w('p2', '2026-09-29', 3, 3, 3, 3)],
    sessions: [ses('p1', '2026-09-29', 'morning', 6), ses('p1', '2026-09-29', 'afternoon', 8), ses('p2', '2026-09-29', 'morning', 5)],
});
test('el libro tiene las 4 hojas, cabeceras exactas en la fila 1 y fechas como texto', () => {
    const r = demo();
    const wb = EF.crearLibro(XLSX, r);
    assert.deepStrictEqual(wb.SheetNames, ['Bienestar', 'RPE', 'Regla', 'LEEME']);
    const filas = n => XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 });
    assert.deepStrictEqual(filas('Bienestar')[0], ['Jugadora', 'Apellido', 'Fecha', 'Sueño', 'Estrés', 'Fatiga', 'Dolor muscular']);
    assert.deepStrictEqual(filas('RPE')[0], ['Jugadora', 'Apellido', 'Fecha', 'Sesión', 'RPE', 'Nº sesiones', 'Detalle']);
    assert.deepStrictEqual(filas('Regla')[0], ['Jugadora', 'Apellido', 'Fecha', 'Activa']);
    assert.strictEqual(filas('Bienestar')[1][2], '2026-09-28');
    assert.strictEqual(typeof filas('Bienestar')[1][3], 'number');
    assert.strictEqual(filas('Bienestar')[1][0], 'Carla Mendes Rocha');
    assert.strictEqual(filas('Bienestar')[1][1], 'Mendes Rocha');
    assert.strictEqual(filas('Bienestar').length, 1 + r.bienestar.length);
});
test('una hoja sin filas conserva sus cabeceras', () => {
    const r = run({ wellness: [], sessions: [] });
    const wb = EF.crearLibro(XLSX, r);
    assert.deepStrictEqual(XLSX.utils.sheet_to_json(wb.Sheets.Regla, { header: 1 }), [['Jugadora', 'Apellido', 'Fecha', 'Activa']]);
});
test('la hoja LEEME refleja los recuentos reales', () => {
    const r = demo();
    const get = k => r.leeme.find(x => x.Clave === k).Valor;
    assert.strictEqual(get('Filas Bienestar'), r.bienestar.length);
    assert.strictEqual(get('Filas RPE'), r.rpe.length);
    assert.strictEqual(get('Filas Regla'), r.regla.length);
    assert.ok(get('Estrés').includes('ESTADO DE ÁNIMO'));
    assert.ok(get('Regla').includes('NO hay filas con No'));
    assert.ok(get('Formato').includes('versión 2'));
    assert.ok(get('Identificación').includes('Sin IDs'));
    assert.ok(!r.leeme.some(x => x.Clave === 'ID Oliver'));
});
test('mensaje de entrega declara escala, Estrés=ánimo y que no hay días No', () => {
    const m = EF.mensajeEntrega(demo());
    assert.ok(m.includes('1 = peor, 5 = mejor'));
    assert.ok(m.includes('ESTADO DE ÁNIMO'));
    assert.ok(m.includes('NO hay filas con No'));
    assert.ok(m.includes('formato 2'));
    assert.ok(m.includes('sin ID') && m.includes('Apellido'));
});
test('nombre de archivo según la especificación', () => {
    assert.strictEqual(demo().nombreArchivo, 'ensino-bienestar-rpe-regla-2026-09-28-a-2026-10-04.xlsx');
});

console.log('\nModal');
function tracker(over) {
    const T = vm.runInContext('new RPETracker()', ctx);
    Object.assign(T, { players, sessions: [], wellnessData: [w('p1', '2026-09-29', 4, 3, 5, 2)], showToast() {} }, over || {});
    return T;
}
function dom() {
    ['exportFisioResumen', 'exportFisioDownloadBtn', 'exportFisioCopyBtn'].forEach(id => { els[id] = { innerHTML: '', textContent: '', disabled: true }; });
    els.exportFisioDesde = { value: '2026-09-28' }; els.exportFisioHasta = { value: '2026-10-04' };
}
test('con Firebase activo y sin primer snapshot, no deja exportar', async () => {
    dom();
    ctx.window.firebaseSync = { db: {} };
    const T = tracker({ _wellnessCloudReady: false });
    await T._exportFisioRefresh();
    assert.strictEqual(els.exportFisioDownloadBtn.disabled, true);
    assert.ok(els.exportFisioResumen.innerHTML.includes('Esperando'));
    ctx.window.firebaseSync = null;
});
test('con datos listos, calcula el resumen y activa los botones', async () => {
    dom();
    ctx.window.firebaseSync = { db: {} };
    const T = tracker({ _wellnessCloudReady: true });
    await T._exportFisioRefresh();
    assert.strictEqual(els.exportFisioDownloadBtn.disabled, false);
    assert.strictEqual(T._exportFisioResult.stats.filasBienestar, 1);
    ctx.window.firebaseSync = null;
});
test('un rango antes del inicio de temporada carga el histórico completo', async () => {
    dom(); els.exportFisioDesde.value = '2026-03-01';
    let cargado = 0;
    const T = tracker({ ensureFullSessionHistory: async () => { cargado++; } });
    await T._exportFisioRefresh();
    assert.strictEqual(cargado, 1);
});
test('avisa de los RPE de jugadoras pendientes dentro del rango', async () => {
    dom();
    const T = tracker({ _analyzePlayerRpe: () => ({ pending: [{ date: '2026-09-30' }, { date: '2026-01-01' }] }) });
    await T._exportFisioRefresh();
    assert.ok(els.exportFisioResumen.innerHTML.includes('1 RPE de jugadoras pendiente'));
});

(async () => {
    let passed = 0, failed = 0;
    for (const { name, fn } of pending) {
        try { await fn(); passed++; console.log('  ✓ ' + name); }
        catch (e) { failed++; console.log('  ✗ ' + name + '\n      ' + (e && e.message)); }
    }
    const out = process.argv[2];
    if (out) {
        const wb = EF.crearLibro(XLSX, demo());
        fs.writeFileSync(out, XLSX.write(wb, { bookType: 'xlsx', type: 'buffer' }));
        console.log('\nEjemplo escrito en ' + out);
    }
    console.log(`\n${passed} pasan, ${failed} fallan`);
    process.exit(failed ? 1 : 0);
})();

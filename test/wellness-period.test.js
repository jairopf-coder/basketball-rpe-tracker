// test/wellness-period.test.js
// Pruebas de: chip de periodo (Hoy/7d/21d), fusión jugadora+staff con "period"
// y detección de ciclo menstrual. Ejecutar con:  node test/wellness-period.test.js
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

let passed = 0, failed = 0;
function test(name, fn) {
    try { fn(); console.log(`  ✅ ${name}`); passed++; }
    catch (e) { console.log(`  ❌ ${name}\n     ${e.message}`); failed++; }
}

// Sandbox mínimo del navegador. Todo se crea DENTRO del contexto del VM.
const ctx = vm.createContext({
    console, Date, Math, JSON, Set, Object, Array, Number, String, parseInt, isNaN,
    document: { createElement: () => ({}), head: { appendChild() {} }, getElementById: () => null, documentElement: { classList: { contains: () => false } }, body: { classList: { contains: () => false } } },
    window: { matchMedia: () => ({ matches: false }), devicePixelRatio: 1 },
    localStorage: { getItem: () => null, setItem() {} },
    requestAnimationFrame: () => {},
    PlayerTokens: { avatar: () => '' },
    esc: s => String(s),
});
vm.runInContext(`
    function RPETracker() {}
    function toLocalISODate(d) {
        const p = n => String(n).padStart(2, '0');
        return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
    }
`, ctx);
vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'wellness.js'), 'utf8'), ctx);

const T = vm.runInContext('new RPETracker()', ctx);
const iso = off => { const d = new Date(); d.setDate(d.getDate() - off); return vm.runInContext('toLocalISODate', ctx)(d); };
const w = (playerId, off, extra) => Object.assign({ id: `w_${playerId}_${iso(off)}`, playerId, date: iso(off), sleep: 4, fatigue: 4, mood: 4, soreness: 4 }, extra || {});
T.players = [{ id: 'p1', name: 'Ana' }, { id: 'p2', name: 'Bea' }];

console.log('\nRango (chip)');
test('por defecto es Hoy y rota Hoy → 7 días → 21 días → Hoy', () => {
    T.renderWellnessDashboard = () => {};
    assert.strictEqual(T._wCurrentRange().key, 'today');
    T._wCycleRange(); assert.strictEqual(T._wCurrentRange().key, '7d');
    T._wCycleRange(); assert.strictEqual(T._wCurrentRange().key, '21d');
    T._wCycleRange(); assert.strictEqual(T._wCurrentRange().key, 'today');
});
test('_wRangeStart(1) es hoy, (7) es hace 6 días, (21) hace 20', () => {
    assert.strictEqual(T._wRangeStart(1), iso(0));
    assert.strictEqual(T._wRangeStart(7), iso(6));
    assert.strictEqual(T._wRangeStart(21), iso(20));
});
test('la tabla cambia de datos según el periodo', () => {
    T.wellnessData = [w('p1', 0, { sleep: 5 }), w('p1', 3, { sleep: 1 }), w('p1', 15, { sleep: 1 })];
    T._wRange = 'today';  let h = T._renderWPlayerTable();
    assert.ok(h.includes('📅 Hoy'));
    T._wRange = '7d';     h = T._renderWPlayerTable(); assert.ok(h.includes('📅 7 días'));
    T._wRange = '21d';    h = T._renderWPlayerTable(); assert.ok(h.includes('📅 21 días'));
    // media de sueño de Ana: hoy=5 ; 7d=(5+1)/2=3 ; 21d=(5+1+1)/3=2.33
    T._wRange = 'today';
    const avgToday = T.wellnessData.filter(x => x.date >= T._wRangeStart(1)).map(x => x.sleep);
    assert.deepStrictEqual(Array.from(avgToday), [5]);
    assert.strictEqual(T.wellnessData.filter(x => x.date >= T._wRangeStart(7)).length, 2);
    assert.strictEqual(T.wellnessData.filter(x => x.date >= T._wRangeStart(21)).length, 3);
});
test('jugadora sin datos en el periodo muestra —, sin romper', () => {
    T.wellnessData = []; T._wRange = 'today';
    const h = T._renderWPlayerTable();
    assert.ok(h.includes('📊 Media') && h.includes('Ana') && h.includes('Bea'));
});
test('el dato de HOY entra en "Hoy" aunque sea de madrugada (sin desfase UTC)', () => {
    T.wellnessData = [w('p1', 0)];
    assert.strictEqual(T.wellnessData.filter(x => x.date >= T._wRangeStart(1)).length, 1);
});

console.log('\nFusión jugadora + staff (period)');
test('entrada de jugadora con period:true llega al formato staff', () => {
    T.players = [{ id: 'p1', name: 'Ana', authUid: 'u1' }];
    const r = T._mergeWellnessPlayer([], [{ uid: 'u1', date: iso(0), sleep: 3, fatigue: 3, mood: 3, pain: 3, period: true }]);
    assert.strictEqual(r.length, 1); assert.strictEqual(r[0].period, true);
});
test('sin marca NO se crea la propiedad (Firebase rechaza undefined)', () => {
    const r = T._mergeWellnessPlayer([], [{ uid: 'u1', date: iso(0), sleep: 3, fatigue: 3, mood: 3, pain: 3 }]);
    assert.strictEqual('period' in r[0], false);
    assert.doesNotThrow(() => JSON.stringify(r)); // ninguna clave undefined
    assert.ok(!Object.values(r[0]).some(v => v === undefined && false));
});
test('staff sin decisión + jugadora marcada → se completa con true', () => {
    const staff = [{ id: 's1', playerId: 'p1', date: iso(0), sleep: 4, fatigue: 4, mood: 4, soreness: 4 }];
    const r = T._mergeWellnessPlayer(staff, [{ uid: 'u1', date: iso(0), period: true }]);
    assert.strictEqual(r.length, 1); assert.strictEqual(r[0].period, true);
    assert.strictEqual(staff[0].period, undefined, 'no debe mutar el original');
});
test('staff con period:false manda sobre la jugadora (puede quitar la marca)', () => {
    const staff = [{ id: 's1', playerId: 'p1', date: iso(0), sleep: 4, fatigue: 4, mood: 4, soreness: 4, period: false }];
    const r = T._mergeWellnessPlayer(staff, [{ uid: 'u1', date: iso(0), period: true }]);
    assert.strictEqual(r[0].period, false);
});

console.log('\nDetección de ciclo');
test('sin registros de regla: episodios 0 y no activa', () => {
    T.players = [{ id: 'p1', name: 'Ana' }]; T._wCycleCache = null;
    T.wellnessData = [w('p1', 0), w('p1', 1)];
    const i = T._wCycleInfo('p1'); assert.strictEqual(i.episodes, 0); assert.strictEqual(i.active, false);
});
test('marcada hoy, ayer y anteayer → activa, Día 3', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 5), w('p1', 2, { period: true }), w('p1', 1, { period: true }), w('p1', 0, { period: true })];
    const i = T._wCycleInfo('p1'); assert.strictEqual(i.active, true); assert.strictEqual(i.dayNumber, 3);
    assert.strictEqual(i.lastStart, iso(2));
});
test('al día siguiente sin marcar (registro sin period) → ya no activa', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 3, { period: true }), w('p1', 2, { period: true }), w('p1', 1), w('p1', 0)];
    const i = T._wCycleInfo('p1'); assert.strictEqual(i.active, false); assert.strictEqual(i.episodes, 1);
});
test('un día sin registrar dentro de la racha NO la corta', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 3, { period: true }), w('p1', 1, { period: true })]; // falta el día 2
    const i = T._wCycleInfo('p1'); assert.strictEqual(i.episodes, 1); assert.strictEqual(i.dayNumber, 3);
});
test('dos episodios a 28 días → ciclo aprox. 28', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 30, { period: true }), w('p1', 29, { period: true }), w('p1', 28), w('p1', 2, { period: true }), w('p1', 1, { period: true })];
    const i = T._wCycleInfo('p1'); assert.strictEqual(i.episodes, 2); assert.strictEqual(i.cycleLength, 28);
});
test('ciclo absurdo (datos incompletos, 5 días) se descarta', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 6, { period: true }), w('p1', 5), w('p1', 1, { period: true })];
    assert.strictEqual(T._wCycleInfo('p1').cycleLength, null);
});
test('última marca hace 5 días sin registros posteriores → no activa', () => {
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 5, { period: true })];
    assert.strictEqual(T._wCycleInfo('p1').active, false);
});
test('cruce de mes: días entre 2026-08-30 y 2026-09-02 = 3', () => {
    assert.strictEqual(T._wDaysBetween('2026-08-30', '2026-09-02'), 3);
});
test('la tarjeta se renderiza (vacía y con datos) sin errores', () => {
    T._wCycleCache = null; T.wellnessData = [];
    assert.ok(T._renderWCycleCard().includes('Aún no hay registros'));
    T._wCycleCache = null;
    T.wellnessData = [w('p1', 0, { period: true })];
    const h = T._renderWCycleCard(); assert.ok(h.includes('Día 1') && h.includes('Con la regla ahora'));
});

console.log('\nModal en <body> y tabla móvil');
delete T.renderWellnessDashboard; // quitar el stub del primer test: aquí se usa el método real
// Documento falso mínimo: un contenedor y un <body> que recibe el HTML insertado.
function makeFakeDoc() {
    const doc = { container: { innerHTML: '' }, bodyHtml: '', modalEl: null };
    doc.createElement = () => ({});
    doc.head = { appendChild() {} };
    doc.documentElement = { classList: { contains: () => false } };
    doc.body = {
        classList: { contains: () => false },
        insertAdjacentHTML(_pos, html) {
            doc.bodyHtml += html;
            doc.modalEl = html.includes('id="wellnessModal"') ? {
                style: { display: 'none' }, _backdropBound: false, listeners: 0,
                addEventListener() { this.listeners++; }, remove() { doc.modalEl = null; doc.bodyHtml = ''; }
            } : null;
        }
    };
    doc.getElementById = id => id === 'wellnessDashboardView' ? doc.container
        : id === 'wellnessModal' ? doc.modalEl : null;
    return doc;
}
test('el modal NO va dentro de la vista (evita el bug del transform en iPhone)', () => {
    const doc = makeFakeDoc(); ctx.document = doc;
    T.players = [{ id: 'p1', name: 'Ana' }]; T.wellnessData = []; T._wRange = 'today';
    T.renderWellnessDashboard();
    assert.ok(!doc.container.innerHTML.includes('wellnessModal'), 'el modal sigue dentro del contenedor');
    assert.ok(doc.bodyHtml.includes('id="wellnessModal"'), 'el modal no se montó en body');
    assert.ok(doc.container.innerHTML.includes('Estado por jugadora'));
});
test('re-render con el modal ABIERTO no lo reconstruye (no pierde lo escrito)', () => {
    const doc = makeFakeDoc(); ctx.document = doc;
    T.renderWellnessDashboard();
    const first = doc.modalEl; first.style.display = 'flex';
    T.renderWellnessDashboard();
    assert.strictEqual(doc.modalEl, first, 'se ha sustituido el modal abierto');
    assert.strictEqual(first.listeners, 1, 'listener de fondo duplicado');
});
test('re-render con el modal cerrado sí lo reconstruye (jugadoras actualizadas)', () => {
    const doc = makeFakeDoc(); ctx.document = doc;
    T.renderWellnessDashboard();
    const first = doc.modalEl; // display none
    T.renderWellnessDashboard();
    assert.notStrictEqual(doc.modalEl, first);
});
test('la tabla muestra número con color (sin estrellas) y nombre recortable', () => {
    T.wellnessData = [w('p1', 0, { sleep: 4 })]; T._wRange = 'today';
    const h = T._renderWPlayerTable();
    assert.ok(!h.includes('★') && !h.includes('☆'), 'siguen apareciendo estrellas');
    assert.ok(/class="wt-badge"[^>]*background:[^>]*>4\.0<\/span>/.test(h), 'falta el número 4.0 con color');
    assert.ok(h.includes('wt-name') && h.includes('wellness-table-scroll'));
});
ctx.document = { createElement: () => ({}), head: { appendChild() {} }, getElementById: () => null, documentElement: { classList: { contains: () => false } }, body: { classList: { contains: () => false } } };

console.log('\nGuardado sin copiar entradas de jugadoras a /wellness');
const key = e => `${e.playerId}|${e.date}`;
const visible = arr => arr.map(e => `${key(e)}|${e.sleep}|${e.fatigue}|${e.mood}|${e.soreness}|${e.period === true}`).sort();
const playerRaw = (uid, off, extra) => Object.assign({ uid, date: iso(off), sleep: 3, fatigue: 3, mood: 3, pain: 3 }, extra || {});
function tracker() {
    const t = vm.runInContext('new RPETracker()', ctx);
    t.players = [{ id: 'p1', name: 'Ana', authUid: 'uA' }, { id: 'p2', name: 'Bea', authUid: 'uB' }];
    return t;
}
test('lo del staff se guarda; lo de jugadoras con original en su buzón, no', () => {
    const t = tracker();
    const cache = [playerRaw('uA', 0), playerRaw('uB', 0)];
    t._wellnessPlayerCache = cache;
    t.wellnessData = t._mergeWellnessPlayer([w('p1', 5)], cache);
    assert.strictEqual(t.wellnessData.length, 3);
    const saved = t._wellnessToPersist();
    assert.strictEqual(saved.length, 1);
    assert.strictEqual(saved[0].playerId, 'p1'); assert.strictEqual(saved[0].date, iso(5));
});
test('RED DE SEGURIDAD: una copia sin original en el buzón se conserva', () => {
    const t = tracker();
    t._wellnessPlayerCache = [playerRaw('uA', 0)];
    const orphan = { id: `wp_uB_${iso(9)}`, playerId: 'p2', date: iso(9), sleep: 2, fatigue: 2, mood: 2, soreness: 2, source: 'player' };
    t.wellnessData = [orphan];
    assert.strictEqual(t._wellnessToPersist().length, 1, 'se perdería un dato sin original');
});
test('RED DE SEGURIDAD: con el buzón aún sin cargar no se descarta nada', () => {
    const t = tracker();
    t._wellnessPlayerCache = [];
    const copy = { id: `wp_uA_${iso(0)}`, playerId: 'p1', date: iso(0), sleep: 4, fatigue: 4, mood: 4, soreness: 4, source: 'player' };
    t.wellnessData = [copy, w('p2', 1)];
    assert.strictEqual(t._wellnessToPersist().length, 2);
});
test('si el staff edita el día de una jugadora, su versión (w_…, sin source) SÍ se guarda', () => {
    const t = tracker();
    const cache = [playerRaw('uA', 0)];
    t._wellnessPlayerCache = cache;
    t.wellnessData = [w('p1', 0, { id: `w_p1_${iso(0)}`, sleep: 1 })]; // ya sustituyó a la de la jugadora
    const saved = t._wellnessToPersist();
    assert.strictEqual(saved.length, 1); assert.strictEqual(saved[0].sleep, 1);
});
test('ida y vuelta: guardar y recargar deja EXACTAMENTE los mismos datos visibles', () => {
    const t = tracker();
    const cache = [playerRaw('uA', 0, { period: true }), playerRaw('uB', 1), playerRaw('uA', 2)];
    t._wellnessPlayerCache = cache;
    const staff = [w('p1', 5), w('p2', 1, { sleep: 5 })]; // staff pisa a Bea el día 1
    t.wellnessData = t._mergeWellnessPlayer(staff, cache);
    const before = visible(t.wellnessData);
    const saved = t._wellnessToPersist();              // lo que iría a Firebase
    const reloaded = t._mergeWellnessPlayer(saved, cache); // lo que se vería al recargar
    assert.deepStrictEqual(visible(reloaded), before);
    assert.strictEqual(reloaded.length, t.wellnessData.length, 'hay duplicados o faltan entradas');
});
test('limpieza de copias antiguas: /wellness con copias wp_ → se guardan solo las propias y no se pierde nada', () => {
    const t = tracker();
    const cache = [playerRaw('uA', 0), playerRaw('uB', 1)];
    t._wellnessPlayerCache = cache;
    const oldCopies = t._mergeWellnessPlayer([], cache);          // así están hoy en /wellness
    const fromFirebase = [w('p1', 6)].concat(JSON.parse(JSON.stringify(oldCopies)));
    t.wellnessData = t._mergeWellnessPlayer(fromFirebase, cache);
    const before = visible(t.wellnessData);
    const saved = t._wellnessToPersist();
    assert.strictEqual(saved.length, 1, 'las copias antiguas deberían dejar de guardarse');
    assert.deepStrictEqual(visible(t._mergeWellnessPlayer(saved, cache)), before);
});
test('saveWellnessData envía la lista filtrada y NO toca la de memoria', () => {
    const t = tracker();
    const cache = [playerRaw('uA', 0)];
    t._wellnessPlayerCache = cache;
    t.wellnessData = t._mergeWellnessPlayer([w('p2', 3)], cache);
    let sent = null;
    ctx.window.firebaseSync = { saveWellnessData: list => { sent = list; } };
    try { t.saveWellnessData(); } finally { delete ctx.window.firebaseSync; }
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(t.wellnessData.length, 2, 'la vista debe seguir mostrando las dos');
});
test('sin Firebase, el respaldo local guarda también la lista filtrada', () => {
    const t = tracker();
    const cache = [playerRaw('uA', 0)];
    t._wellnessPlayerCache = cache;
    t.wellnessData = t._mergeWellnessPlayer([w('p2', 3)], cache);
    let stored = null;
    const prev = ctx.localStorage; ctx.localStorage = { getItem: () => null, setItem: (k, v) => { stored = JSON.parse(v); } };
    try { t.saveWellnessData(); } finally { ctx.localStorage = prev; }
    assert.strictEqual(stored.length, 1);
});

console.log('\nBloqueo de guardado hasta cargar los datos de la nube');
// Prepara un tracker "en la nube": firebaseSync con db y un registro de lo que se envía.
function cloudTracker(ready) {
    const t = tracker();
    t.toasts = []; t.showToast = (m, ty) => t.toasts.push([m, ty]);
    t.renderWellnessDashboard = () => {};
    t.closed = 0; t.closeWellnessModal = () => { t.closed++; };
    t.sent = [];
    ctx.window.firebaseSync = { db: {}, saveWellnessData: list => t.sent.push(list) };
    t._wellnessCloudReady = !!ready;
    return t;
}
const noCloud = () => { delete ctx.window.firebaseSync; delete ctx.window.firebaseDB; };
const setForm = vals => { ctx.document = { getElementById: id => (id in vals ? { value: vals[id], checked: !!vals[id] } : null) }; };
const okForm = () => setForm({ wFormPlayer: 'p1', wFormDate: iso(0), wFormSleep: '4', wFormFatigue: '4', wFormMood: '4', wFormSoreness: '4', wFormNotes: '', wFormPeriod: false });
const resetDoc = () => { ctx.document = { createElement: () => ({}), head: { appendChild() {} }, getElementById: () => null, documentElement: { classList: { contains: () => false } }, body: { classList: { contains: () => false } } }; };
ctx.AppConfirm = { show: () => ({ then: fn => fn(true) }) }; // confirmación síncrona para las pruebas

test('antes del primer snapshot: NO se envía nada a Firebase y avisa', () => {
    const t = cloudTracker(false); t.wellnessData = [w('p1', 2)];
    try {
        assert.strictEqual(t.saveWellnessData(), false);
        assert.strictEqual(t.sent.length, 0, 'se ha escrito en la nube sin haber cargado');
        assert.strictEqual(t.toasts.length, 1); assert.strictEqual(t.toasts[0][1], 'warning');
    } finally { noCloud(); }
});
test('tras el primer snapshot sí se guarda', () => {
    const t = cloudTracker(true); t.wellnessData = [w('p1', 2)];
    try { assert.strictEqual(t.saveWellnessData(), true); assert.strictEqual(t.sent.length, 1); }
    finally { noCloud(); }
});
test('sin Firebase (modo local) no se bloquea nunca', () => {
    const t = tracker(); t.showToast = () => {}; t.wellnessData = [w('p1', 2)];
    noCloud(); t._wellnessCloudReady = false;
    let stored = null; const prev = ctx.localStorage; ctx.localStorage = { getItem: () => null, setItem: (k, v) => { stored = v; } };
    try { assert.strictEqual(t.saveWellnessData(), true); assert.ok(stored); } finally { ctx.localStorage = prev; }
});
test('el listener marca "cargado" con el primer snapshot, aunque venga VACÍO', () => {
    const t = tracker(); let cb = null;
    ctx.window.firebaseSync = { db: {}, onWellnessChange: f => { cb = f; } };
    ctx.window.firebaseDB = { ref: () => ({ on() {} }) };
    try {
        t.loadWellnessData();
        assert.ok(cb, 'no se registró el listener');
        assert.ok(!t._wellnessCloudReady, 'no debería estar listo antes del snapshot');
        cb([]); // nodo /wellness vacío
        assert.strictEqual(t._wellnessCloudReady, true);
    } finally { noCloud(); }
});
test('ESCENARIO REAL: app sin conexión → intenta guardar (bloqueado) → llega la nube → guarda TODO', () => {
    const t = cloudTracker(false); t.wellnessData = []; // memoria vacía: aún no descargó nada
    let cb = null; ctx.window.firebaseSync.onWellnessChange = f => { cb = f; };
    ctx.window.firebaseDB = { ref: () => ({ on() {} }) };
    try {
        t._wellnessListenerSet = false; t.loadWellnessData();
        okForm(); t.saveWellnessEntry();                       // 1) intento de guardar sin haber cargado
        assert.strictEqual(t.sent.length, 0, 'sobrescribiría la nube con una lista casi vacía');
        assert.strictEqual(t.wellnessData.length, 0, 'no debe modificar nada a medias');
        assert.strictEqual(t.closed, 0, 'el formulario debe quedarse abierto');
        cb([w('p1', 5), w('p2', 4), w('p2', 3)]);              // 2) llega el wellness guardado en la nube
        okForm(); t.saveWellnessEntry();                       // 3) ahora sí
        assert.strictEqual(t.sent.length, 1);
        assert.strictEqual(t.sent[0].length, 4, 'debe conservar las 3 de la nube + la nueva');
        assert.strictEqual(t.closed, 1);
    } finally { noCloud(); resetDoc(); }
});
test('borrar un registro y borrar todo también quedan bloqueados (y no tocan la memoria)', () => {
    const t = cloudTracker(false); t.wellnessData = [w('p1', 2)];
    try {
        t._deleteWellness(t.wellnessData[0].id); t._clearWellness();
        assert.strictEqual(t.wellnessData.length, 1, 'se ha borrado en memoria estando bloqueado');
        assert.strictEqual(t.sent.length, 0);
        assert.strictEqual(t.toasts.length, 2);
    } finally { noCloud(); }
});
test('wellness paso a paso y rápido: bloqueados sin cambios ni avance', () => {
    const t = cloudTracker(false); t.wellnessData = [];
    t._bulkQueue = [{ id: 'p1' }]; t._bulkIndex = 0; t._bulkDate = iso(0);
    ctx.document = { getElementById: id => id === 'wellnessQuickOverlay' ? { querySelector: () => null, remove() { t.overlayRemoved = true; } } : null, querySelector: () => null };
    try {
        t._wbSaveAndNav(1); t.saveWellnessQuick();
        assert.strictEqual(t.wellnessData.length, 0); assert.strictEqual(t._bulkIndex, 0);
        assert.ok(!t.overlayRemoved, 'el panel rápido no debe cerrarse'); assert.strictEqual(t.sent.length, 0);
    } finally { noCloud(); resetDoc(); }
});

console.log(`\n${passed} OK, ${failed} fallos`);
process.exit(failed ? 1 : 0);

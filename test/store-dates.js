// test/store-dates.js — ayudante COMPARTIDO de los tests (no es un test: no acaba en .test.js).
// Carga en un contexto de vm el bloque "FECHAS: formato día/mes" REAL de store.js
// (formatDM, formatDMY, formatWeekdayDM, formatDMRange), para que los tests que cargan
// módulos sueltos (wellness.js, dashboard-renderer.js…) usen el mismo código que la app
// y no una copia que pueda quedar desfasada.
//
//   require('./store-dates')(vm, ctx);
'use strict';
const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'store.js'), 'utf8');
const start = src.indexOf('/* ==== FECHAS: formato día/mes (inicio)');
const end = src.indexOf('/* ==== FECHAS: formato día/mes (fin) ==== */');
if (start < 0 || end < start) throw new Error('store.js: no se encuentra el bloque de fechas');
const block = src.slice(start, end);

module.exports = function loadDateHelpers(vm, ctx) {
    vm.runInContext(block, ctx, { filename: 'store.js (fechas)' });
};

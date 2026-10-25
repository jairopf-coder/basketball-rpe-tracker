// test/active-players-helper.js
// Los tests montan un RPETracker «de mentira» con solo algunos módulos. Los módulos que listan jugadoras
// usan this.activePlayers / getPlayersActiveOn / isPlayerActiveOn (app-players.js). Para no copiar esa
// lógica a mano en cada test, se extrae el bloque REAL de app-players.js:
//     vm.runInContext(require('./active-players-helper')(), ctx);     // tras definir RPETracker y toLocalISODate
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function activePlayersSource() {
    const src = fs.readFileSync(path.join(__dirname, '..', 'app-players.js'), 'utf8');
    const a = src.indexOf('// ─── Jugadoras activas y bajas');
    const b = src.indexOf('// Propuesta para separar un texto completo');
    if (a < 0 || b < 0 || b < a) throw new Error('No se encuentra el bloque «Jugadoras activas y bajas» en app-players.js');
    return src.slice(a, b);
};

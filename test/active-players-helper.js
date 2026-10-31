// test/active-players-helper.js
// Los tests montan un RPETracker «de mentira» con solo algunos módulos. Los módulos que listan jugadoras
// usan this.activePlayers / getPlayersActiveOn / isPlayerActiveOn (app-players.js). Para no copiar esa
// lógica a mano en cada test, se extrae el bloque REAL de app-players.js:
//     vm.runInContext(require('./active-players-helper')(), ctx);     // tras definir RPETracker y toLocalISODate
'use strict';
const fs = require('fs');
const path = require('path');

module.exports = function activePlayersSource(opts) {
    const src = fs.readFileSync(path.join(__dirname, '..', 'app-players.js'), 'utf8');
    const a = src.indexOf('// ─── Jugadoras activas y bajas');
    const b = src.indexOf('// Propuesta para separar un texto completo');
    if (a < 0 || b < 0 || b < a) throw new Error('No se encuentra el bloque «Jugadoras activas y bajas» en app-players.js');
    let out = src.slice(a, b);
    // { names: true } añade además los nombres: playerFullName, _splitFullName, playerDisplayName…
    if (opts && opts.names) {
        const n1 = src.indexOf('RPETracker.prototype.playerFullName');
        const n2 = src.indexOf('RPETracker.prototype.openAddPlayerModal');
        if (n1 < 0 || n2 < n1) throw new Error('No se encuentra el bloque de nombres en app-players.js');
        out = src.slice(n1, a) + '\n' + out + '\n' + src.slice(b, n2);
    }
    return out;
};

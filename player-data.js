// ============================================================
//  player-data.js — Exportar y eliminar TODOS los datos de una jugadora
//
//  Solo el staff puede eliminar (AppAuth.isStaff()). Las jugadoras no tienen ninguna
//  pantalla ni botón para esto, y las reglas de Firebase tampoco les dejan tocar nada
//  fuera de su propio buzón de wellness/RPE.
//
//  Cómo funciona (en este orden):
//   1. _pdCollect  → lee de Firebase TODO lo que hay de la jugadora (es la fuente única
//                    para el recuento, la copia y el borrado, así que lo que se cuenta
//                    y se descarga es exactamente lo que se borra).
//   2. exportPlayerData → copia en JSON (opcional, antes de borrar).
//   3. eraseAllPlayerData → borra colección a colección. La ficha de la jugadora y sus
//                    cuentas se borran AL FINAL y solo si todo lo anterior salió bien:
//                    si algo falla la jugadora sigue en la lista y se puede reintentar.
//   4. _pdDeleteFlow → lo que ve el usuario: copia opcional + confirmación escribiendo
//                    el nombre + resultado.
//
//  Lo que NO se puede borrar desde la app: la cuenta de acceso en Firebase Authentication
//  (solo se elimina en la consola de Firebase). Al terminar se indica el correo exacto.
// ============================================================

(function () {
    'use strict';

    // Colecciones de tipo { id: elemento } con un campo playerId dentro
    const COLECCIONES = [
        { node: 'sessions',      etiqueta: 'sesiones de entrenamiento',       mem: 'sessions',      espejos: ['sessions'] },
        { node: 'wellness',      etiqueta: 'registros de wellness del staff', mem: 'wellnessData',  espejos: ['wellness', 'wellnessData'] },
        { node: 'injuries',      etiqueta: 'lesiones',                        mem: 'injuries',      espejos: ['injuries'] },
        { node: 'clinicalNotes', etiqueta: 'notas clínicas',                  mem: 'clinicalNotes', espejos: ['clinicalNotes'] },
        { node: 'gymSessions',   etiqueta: 'sesiones de gimnasio',            mem: 'gymSessions',   espejos: ['gymSessions'] },
        { node: 'testSessions',  etiqueta: 'tests físicos',                   mem: 'testSessions',  espejos: ['testSessions'] },
    ];

    const cuenta = (obj) => (obj && typeof obj === 'object') ? Object.keys(obj).length : 0;
    const anidados = (obj) => Object.values(obj || {}).reduce((n, v) => n + cuenta(v), 0);

    function slug(texto) {
        return String(texto || 'jugadora').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'jugadora';
    }

    // ---------- 1) LEER todo lo de la jugadora ----------
    RPETracker.prototype._pdCollect = async function (playerId) {
        const db = window.firebaseSync && window.firebaseSync.db;
        if (!db) throw new Error('Firebase no disponible');
        const val = async (path) => (await db.ref(path).once('value')).val();
        const seguro = async (path) => { try { return await val(path); } catch (e) { return undefined; } };   // sin permiso → undefined

        const [playerRec, availability, anamnesis, gpsData, gpsMap, users] = await Promise.all([
            val('players/' + playerId), val('availability/' + playerId), val('anamnesis/' + playerId),
            val('gpsData'), val('gpsPlayerMap'), seguro('users'),
        ]);

        const cols = {};
        for (const c of COLECCIONES) {
            const todo = await val(c.node);
            cols[c.node] = Object.entries(todo || {})
                .filter(([, v]) => v && v.playerId === playerId)
                .map(([id, data]) => ({ id, data }));
        }

        const gps = Object.entries(gpsData || {})
            .filter(([, porJugadora]) => porJugadora && porJugadora[playerId] !== undefined && porJugadora[playerId] !== null)
            .map(([sessionId, porJugadora]) => ({ sessionId, record: porJugadora[playerId] }));
        const gpsMapa = Object.entries(gpsMap || {}).filter(([, v]) => v === playerId).map(([key, value]) => ({ key, value }));

        // Cuentas de acceso vinculadas: por el campo authUid de la ficha y por /users/{uid}.playerId
        const uids = new Set();
        if (playerRec && playerRec.authUid) uids.add(playerRec.authUid);
        Object.entries(users || {}).forEach(([uid, u]) => {
            if (u && (u.playerId === playerId || u.playerLink === playerId)) uids.add(uid);
        });

        const porUid = {};
        for (const uid of uids) {
            porUid[uid] = {
                usuario: (users && users[uid]) || null,
                wellnessEnviado: await seguro('wellnessPlayer/' + uid),
                rpeEnviado: await seguro('playerRpeReports/' + uid),
                avisosPush: await seguro('pushStatus/' + uid),
            };
        }

        return {
            playerId, playerRec, cols,
            availability: availability || null, anamnesis: anamnesis || null,
            gps, gpsMapa, uids: Array.from(uids), porUid,
        };
    };

    // ---------- Recuento para la confirmación ----------
    RPETracker.prototype.getPlayerDataInventory = async function (playerId) {
        const d = await this._pdCollect(playerId);
        const lineas = [];
        COLECCIONES.forEach(c => { const n = d.cols[c.node].length; if (n) lineas.push([c.etiqueta, n]); });
        if (cuenta(d.availability)) lineas.push(['días de disponibilidad', cuenta(d.availability)]);
        if (d.gps.length) lineas.push(['registros GPS', d.gps.length]);
        if (d.gpsMapa.length) lineas.push(['emparejamientos GPS', d.gpsMapa.length]);
        if (d.anamnesis) lineas.push(['ficha de anamnesis', 1]);
        const wellnessJ = d.uids.reduce((n, u) => n + cuenta(d.porUid[u].wellnessEnviado), 0);
        const rpeJ = d.uids.reduce((n, u) => n + anidados(d.porUid[u].rpeEnviado), 0);
        if (wellnessJ) lineas.push(['wellness enviados por ella', wellnessJ]);
        if (rpeJ) lineas.push(['RPE enviados por ella', rpeJ]);
        if (d.uids.length) lineas.push(['cuenta(s) de acceso', d.uids.length]);
        return { data: d, lineas, total: lineas.reduce((n, l) => n + l[1], 0) };
    };

    // ---------- 2) COPIA en JSON ----------
    RPETracker.prototype.exportPlayerData = async function (playerId, recogido) {
        const d = recogido || await this._pdCollect(playerId);
        const salida = {
            generado: new Date().toISOString(),
            aviso: 'Este archivo contiene datos de salud de una persona. Guárdalo en un sitio seguro y no lo compartas por canales no protegidos.',
            jugadora: d.playerRec,
            sesiones: d.cols.sessions.map(x => x.data),
            wellnessDelStaff: d.cols.wellness.map(x => x.data),
            lesiones: d.cols.injuries.map(x => x.data),
            notasClinicas: d.cols.clinicalNotes.map(x => x.data),
            anamnesis: d.anamnesis,
            disponibilidad: d.availability,
            gps: d.gps,
            emparejamientosGps: d.gpsMapa,
            gimnasio: d.cols.gymSessions.map(x => x.data),
            testsFisicos: d.cols.testSessions.map(x => x.data),
            cuentas: d.uids.map(uid => ({
                uid,
                usuario: d.porUid[uid].usuario,
                wellnessEnviadoPorElla: d.porUid[uid].wellnessEnviado || null,
                rpeEnviadoPorElla: d.porUid[uid].rpeEnviado || null,
                avisosPush: d.porUid[uid].avisosPush || null,
            })),
        };
        const nombre = `datos-${slug(d.playerRec && d.playerRec.name)}-${new Date().toISOString().slice(0, 10)}.json`;
        const blob = new Blob([JSON.stringify(salida, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = nombre;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        return { nombre, salida };
    };

    // ---------- 3) ELIMINAR ----------
    RPETracker.prototype.eraseAllPlayerData = async function (playerId) {
        if (!(window.AppAuth && window.AppAuth.isStaff && window.AppAuth.isStaff())) {
            return { ok: false, rechazado: 'Solo el staff puede eliminar los datos de una jugadora.' };
        }
        const db = window.firebaseSync && window.firebaseSync.db;
        if (!db) return { ok: false, rechazado: 'Hace falta conexión con Firebase para eliminar todos sus datos.' };
        if (typeof navigator !== 'undefined' && navigator.onLine === false) {
            return { ok: false, rechazado: 'Estás sin conexión. Conéctate para eliminar todos sus datos.' };
        }
        if (this._pdBusy) return { ok: false, rechazado: 'Ya hay una eliminación en curso.' };
        this._pdBusy = true;
        try {
            const d = await this._pdCollect(playerId);
            const fallos = [];
            const hechos = [];
            const run = async (etiqueta, fn, local) => {
                try { await fn(); hechos.push(etiqueta); if (local) local(); }
                catch (e) { console.error('[player-data] ' + etiqueta, e); fallos.push(etiqueta); }
            };
            const nulos = (ids) => Object.fromEntries(ids.map(id => [id, null]));
            const uids = new Set(d.uids);
            const quitarMem = (clave) => { if (Array.isArray(this[clave])) this[clave] = this[clave].filter(x => !(x && x.playerId === playerId)); };
            const quitarEspejo = (clave) => {
                try {
                    const raw = Store.getString(clave);
                    if (!raw) return;
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) Store.set(clave, arr.filter(x => !(x && x.playerId === playerId)));
                } catch (e) { /* espejo ilegible: no se toca */ }
            };

            // 3a) colecciones { id: elemento }
            for (const c of COLECCIONES) {
                const ids = d.cols[c.node].map(x => x.id);
                if (!ids.length) continue;
                await run(c.etiqueta, () => db.ref(c.node).update(nulos(ids)), () => {
                    quitarMem(c.mem); c.espejos.forEach(quitarEspejo);
                    if (c.node === 'wellness') this._wellnessPlayerCache = (this._wellnessPlayerCache || []).filter(e => !uids.has(e.uid));
                });
            }
            // 3b) disponibilidad, GPS, anamnesis
            if (cuenta(d.availability)) {
                await run('disponibilidad', () => db.ref('availability/' + playerId).remove(), () => {
                    if (this.availability) { delete this.availability[playerId]; Store.set('availability', this.availability); }
                });
            }
            if (d.gps.length) {
                await run('GPS', () => db.ref('gpsData').update(Object.fromEntries(d.gps.map(g => [g.sessionId + '/' + playerId, null]))), () => {
                    if (this.gpsData) {
                        d.gps.forEach(g => { if (this.gpsData[g.sessionId]) { delete this.gpsData[g.sessionId][playerId]; if (!cuenta(this.gpsData[g.sessionId])) delete this.gpsData[g.sessionId]; } });
                        Store.set('gpsData', this.gpsData);
                    }
                });
            }
            if (d.gpsMapa.length) {
                await run('emparejamientos GPS', () => db.ref('gpsPlayerMap').update(nulos(d.gpsMapa.map(m => m.key))), () => {
                    if (this.gpsPlayerMap) { d.gpsMapa.forEach(m => { delete this.gpsPlayerMap[m.key]; }); Store.set('gpsPlayerMap', this.gpsPlayerMap); }
                });
            }
            if (d.anamnesis) {
                await run('anamnesis', () => db.ref('anamnesis/' + playerId).remove(), () => {
                    try { localStorage.removeItem('anamnesis_' + playerId); } catch (e) { /* sin acceso a localStorage */ }
                });
            }
            // 3c) lo que cuelga de su cuenta de acceso
            for (const uid of d.uids) {
                const u = d.porUid[uid];
                if (u.wellnessEnviado) await run('wellness enviado por ella', () => db.ref('wellnessPlayer/' + uid).remove());
                if (u.rpeEnviado) await run('RPE enviado por ella', () => db.ref('playerRpeReports/' + uid).remove(), () => {
                    this._playerRpeRaw = (this._playerRpeRaw || []).filter(e => e.uid !== uid);
                });
                await run('avisos push', async () => {
                    await db.ref('pushSubscriptions/' + uid).remove();
                    await db.ref('pushStatus/' + uid).remove();
                });
            }

            // 3d) al final: cuentas y ficha, solo si todo lo anterior salió bien
            if (!fallos.length) {
                for (const uid of d.uids) await run('cuenta ' + uid, () => db.ref('users/' + uid).remove());
                await run('ficha de la jugadora', () => db.ref('players/' + playerId).remove(), () => {
                    this.players = (this.players || []).filter(p => p.id !== playerId);
                    Store.set('players', this.players);
                });
            }

            if (!fallos.length) this._pdRefrescarPantallas();
            const correos = d.uids.map(uid => (d.porUid[uid].usuario && d.porUid[uid].usuario.email) || uid);
            return { ok: fallos.length === 0, fallos, hechos, correos };
        } catch (e) {
            console.error('[player-data] eliminación interrumpida', e);
            return { ok: false, fallos: ['lectura inicial'], hechos: [], correos: [], error: String(e && e.message || e) };
        } finally {
            this._pdBusy = false;
        }
    };

    RPETracker.prototype._pdRefrescarPantallas = function () {
        ['renderPlayers', 'renderSessions', 'populatePlayerSelects'].forEach(f => {
            try { if (typeof this[f] === 'function') this[f](); } catch (e) { console.error('[player-data] ' + f, e); }
        });
        try { if (this.currentView === 'dashboard' && typeof this.renderDashboard === 'function') this.renderDashboard(); } catch (e) { /* pantalla no disponible */ }
    };

    // ---------- 4) LO QUE VE EL USUARIO ----------
    RPETracker.prototype._pdDeleteFlow = async function (playerId) {
        if (!(window.AppAuth && window.AppAuth.isStaff && window.AppAuth.isStaff())) {
            this.showToast('Solo el staff puede eliminar jugadoras y sus datos', 'error');
            return;
        }
        const player = (this.players || []).find(p => p.id === playerId);
        const nombre = player ? player.name : 'esta jugadora';
        if (!(window.firebaseSync && window.firebaseSync.db)) {
            // Modo local (sin nube): comportamiento de siempre
            return this._deletePlayerBasic(playerId);
        }

        this.showToast('Buscando todos los datos de ' + nombre + '…', 'info');
        let inventario;
        try { inventario = await this.getPlayerDataInventory(playerId); }
        catch (e) {
            console.error('[player-data] inventario', e);
            this.showToast('No se pudieron leer sus datos. Comprueba la conexión e inténtalo de nuevo.', 'error');
            return;
        }

        // 1) ¿copia antes de borrar?
        const quiereCopia = await AppConfirm.show({
            title: '¿Descargar una copia de sus datos?',
            message: `Antes de eliminar a ${nombre}, puedes guardar un archivo con todo lo que hay de ella. Contiene datos de salud: guárdalo en un sitio seguro.`,
            confirmText: 'Descargar copia',
            cancelText: 'No, continuar sin copia',
        });
        if (quiereCopia) {
            try { await this.exportPlayerData(playerId, inventario.data); }
            catch (e) { console.error('[player-data] copia', e); this.showToast('No se pudo generar la copia. No se ha borrado nada.', 'error'); return; }
        }

        // 2) confirmación fuerte: hay que escribir el nombre
        const detalle = inventario.lineas.length
            ? inventario.lineas.map(([etiqueta, n]) => `• ${n} ${etiqueta}`).join('\n')
            : '• (no se ha encontrado ningún otro dato)';
        const ok = await AppConfirm.show({
            title: `Eliminar a ${nombre} y todos sus datos`,
            message: `Se borrará para siempre, en todos los dispositivos:\n${detalle}\n\nNo se puede deshacer.`,
            confirmText: 'Eliminar para siempre',
            cancelText: 'Cancelar',
            danger: true,
            requireText: nombre,
        });
        if (!ok) return;

        this.showToast('Eliminando…', 'info');
        const r = await this.eraseAllPlayerData(playerId);
        if (r.rechazado) { this.showToast(r.rechazado, 'error'); return; }
        if (!r.ok) {
            await AppAlert.show(
                `No se ha podido borrar todo. Quedan por borrar: ${r.fallos.join(', ')}.\n\n` +
                `${nombre} sigue en la lista: comprueba la conexión y vuelve a pulsar Eliminar para reintentarlo (lo que ya se borró no vuelve a aparecer).`,
                'Eliminación incompleta');
            return;
        }
        const manual = r.correos.length
            ? `\n\nQueda un paso manual: elimina su cuenta de acceso en la consola de Firebase → Authentication → Users (${r.correos.join(', ')}). Hasta entonces esa cuenta podría volver a enviar wellness o RPE.`
            : '';
        await AppAlert.show(`Se han eliminado todos los datos de ${nombre}.` + manual, 'Jugadora eliminada');
    };

    window.PlayerData = { COLECCIONES, slug };
})();

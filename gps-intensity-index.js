// ============================================================
//  gps-intensity-index.js — Índice de Intensidad Objetiva (IIO)
//
//  Qué hace este módulo:
//   Calcula, para una jugadora y sesión concretas, un valor 0-100
//   que resume su esfuerzo físico OBJETIVO (medido por GPS), para
//   poder compararlo con su percepción subjetiva (sRPE).
//
//  Metodología (acordada con Jairo):
//   1. Cada métrica GPS se normaliza 0-100 respecto al PROPIO
//      historial de esa jugadora en la temporada (su valor más alto
//      registrado hasta la fecha = 100). Esto es intencionado: el
//      sRPE también es una escala individual, no comparada con las
//      compañeras, así que el IIO debe normalizarse igual para que
//      la comparación tenga sentido.
//   2. Las métricas se agrupan en 4 bloques con sentido fisiológico,
//      cada uno con un peso fijo sobre el total:
//        - Volumen                    25%
//        - Intensidad de carrera      30%  (caminata×1, trote×2,
//                                            moderada×3, alta×4, sprint×5)
//        - Esfuerzos explosivos       30%  (acel/decel alta×3 y
//                                            máx×4, cambios dir.×2,
//                                            saltos×2)
//        - Impacto/contacto           15%  (impactos baja×1,
//                                            media×2, alta×3, máx×4)
//   3. Con muy pocas sesiones históricas, el "máximo personal" es
//      poco fiable (puede ser una sola sesión atípica). Por eso el
//      IIO indica su nivel de confianza y se muestra igual, pero
//      marcado como preliminar, hasta que haya un mínimo de datos.
//
//  Qué NO hace (a propósito):
//   - No sustituye ni toca RPE, sRPE, load, EWMA o ratio A:C.
//   - No escribe nada en `sessions` ni en `gpsData`; solo LEE
//     `this.gpsData` (ya guardado por gps-tracking.js) y calcula
//     el IIO al vuelo cada vez que se necesita mostrar.
// ============================================================

const GPS_IIO_CONFIG = {
    MIN_SESSIONS_FOR_CONFIDENCE: 5, // por debajo de esto, se marca "preliminar"

    // Bloques: cada uno con su peso total y las métricas que lo
    // componen, con su ponderación interna (banda de intensidad).
    blocks: [
        {
            key: 'volume',
            label: 'Volumen',
            weight: 0.25,
            metrics: [
                { key: 'distanceM',  factor: 1 },
                { key: 'playTimeMin', factor: 1 },
            ]
        },
        {
            key: 'runIntensity',
            label: 'Intensidad de carrera',
            weight: 0.30,
            // A partir del CSV con las nuevas zonas de velocidad de Oli
            // (10/09/2026) hay 5 bandas en vez de 4: caminata, trote,
            // carrera moderada, carrera de alta intensidad y sprint.
            metrics: [
                { key: 'walkM',              factor: 1 }, // caminata = muy baja
                { key: 'jogM',               factor: 2 }, // trote = baja/media
                { key: 'moderateRunM',       factor: 3 }, // carrera moderada
                { key: 'highIntensityRunsM', factor: 4 }, // alta (antes "Carreras Alta Int.")
                { key: 'maxIntensityRunsM',  factor: 5 }, // sprint (antes "Carreras Máx. Int.")
            ]
        },
        {
            key: 'explosive',
            label: 'Esfuerzos explosivos',
            weight: 0.30,
            metrics: [
                { key: 'highAccelerationsM', factor: 3 },
                { key: 'highDecelerationsM', factor: 3 },
                { key: 'maxAccelerationsM',  factor: 4 },
                { key: 'maxDecelerationsM',  factor: 4 },
                { key: 'directionChanges',   factor: 2 },
                { key: 'jumps',              factor: 2 },
            ]
        },
        {
            key: 'impact',
            label: 'Impacto/contacto',
            weight: 0.15,
            metrics: [
                { key: 'impactsLow',    factor: 1 },
                { key: 'impactsMedium', factor: 2 },
                { key: 'impactsHigh',   factor: 3 },
                { key: 'impactsMax',    factor: 4 },
            ]
        },
    ]
};

// Devuelve, para una jugadora, el máximo histórico de cada métrica
// GPS registrado hasta (e incluyendo) la fecha dada. Se usa como
// base 100 de la normalización individual.
RPETracker.prototype._getPlayerGpsMaxHistory = function(playerId, upToDate) {
    const maxes = {};
    let sessionCount = 0;

    if (!this.gpsData) return { maxes, sessionCount };

    (this.sessions || [])
        .filter(s => s.playerId === playerId)
        .filter(s => !upToDate || new Date(s.date) <= new Date(upToDate))
        .forEach(s => {
            const gpsGroup = this.gpsData[s.id];
            const gps = gpsGroup ? gpsGroup[playerId] : null;
            if (!gps) return;
            sessionCount++;
            GPS_IIO_CONFIG.blocks.forEach(block => {
                block.metrics.forEach(m => {
                    const val = gps[m.key];
                    if (val == null) return;
                    if (maxes[m.key] == null || val > maxes[m.key]) maxes[m.key] = val;
                });
            });
        });

    return { maxes, sessionCount };
};

// Calcula el IIO (0-100) para una jugadora en una sesión concreta.
// Devuelve null si no hay datos GPS suficientes para esa sesión.
// Devuelve { score, confidence, sessionCount, blockScores } si se pudo calcular.
RPETracker.prototype.calculateGpsIntensityIndex = function(playerId, sessionId) {
    if (!this.gpsData || !this.gpsData[sessionId]) return null;
    const gps = this.gpsData[sessionId][playerId];
    if (!gps) return null;

    const session = (this.sessions || []).find(s => s.id === sessionId && s.playerId === playerId);
    const { maxes, sessionCount } = this._getPlayerGpsMaxHistory(playerId, session ? session.date : null);

    let totalScore = 0;
    let totalWeightUsed = 0;
    const blockScores = [];

    GPS_IIO_CONFIG.blocks.forEach(block => {
        let weightedSum = 0;
        let factorSum = 0;

        block.metrics.forEach(m => {
            const rawValue = gps[m.key];
            const max = maxes[m.key];
            if (rawValue == null || !max || max <= 0) return; // sin dato o sin histórico: se omite, no se cuenta como 0

            const normalized = Math.min(100, (rawValue / max) * 100);
            weightedSum += normalized * m.factor;
            factorSum += m.factor;
        });

        if (factorSum > 0) {
            const blockScore = weightedSum / factorSum;
            blockScores.push({ key: block.key, label: block.label, score: blockScore, weight: block.weight });
            totalScore += blockScore * block.weight;
            totalWeightUsed += block.weight;
        }
    });

    if (totalWeightUsed === 0) return null; // ningún bloque tuvo datos suficientes

    // Si algún bloque no pudo calcularse (columnas ausentes en esta
    // sesión), se re-escala sobre el peso realmente disponible para
    // no penalizar artificialmente por datos que Oli no envió.
    const finalScore = totalScore / totalWeightUsed;

    return {
        score: Math.round(finalScore * 10) / 10,
        confidence: sessionCount >= GPS_IIO_CONFIG.MIN_SESSIONS_FOR_CONFIDENCE ? 'normal' : 'preliminar',
        sessionCount,
        blockScores
    };
};

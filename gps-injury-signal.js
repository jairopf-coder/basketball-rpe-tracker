// ============================================================
//  gps-injury-signal.js — Fase 3: Señal de divergencia GPS/RPE
//  para el módulo de predicción de lesiones
//
//  Qué hace este módulo:
//   Calcula si una jugadora muestra un patrón sostenido de
//   discrepancia entre su RPE (percepción subjetiva) y el RPE/GPS
//   de Oli (dato más objetivo), en las últimas 2 semanas.
//
//   Si el patrón es sostenido (ver criterio abajo), devuelve un
//   pequeño ajuste ADITIVO que injury-prediction.js suma al final
//   de su cálculo ya existente — nunca sustituye ni recalibra los
//   6 factores/pesos que ya tiene predictInjuryRisk().
//
//  Criterio (conservador, definido junto con Jairo):
//   - Discrepancia por sesión: |RPE app - RPE Oli| >= 2 puntos.
//   - Se necesitan >= 3 sesiones con discrepancia en los últimos 14 días.
//   - Se necesitan >= 4 sesiones con dato GPS en esos 14 días para
//     poder hablar de "patrón" (si hay menos, no hay base suficiente
//     y no se aplica ningún ajuste).
//   - Ajuste aplicado si se cumple el patrón: +8 puntos.
//   - Si no hay GPS o no hay patrón sostenido: +0 puntos, es decir,
//     el resultado de predictInjuryRisk() es IDÉNTICO al actual.
//
//  Esto es intencionadamente conservador para evitar falsas alarmas
//  con pocos datos, y para no alterar el comportamiento ya validado
//  del predictor para jugadoras sin datos GPS.
// ============================================================

const GPS_INJURY_SIGNAL = {
    RPE_DIFF_THRESHOLD: 2,
    MIN_DISCREPANT_SESSIONS: 3,
    MIN_GPS_SESSIONS: 4,
    WINDOW_DAYS: 14,
    SCORE_ADJUSTMENT: 8
};

// Devuelve { adjustment, applied, discrepantCount, gpsSessionCount, detail }
// adjustment: puntos a sumar al riskScore (0 si no aplica).
RPETracker.prototype.calculateGpsDivergenceSignal = function(playerId) {
    const result = {
        adjustment: 0,
        applied: false,
        discrepantCount: 0,
        gpsSessionCount: 0,
        detail: null
    };

    if (!this.gpsData) return result;

    const now = new Date();
    const cutoff = new Date(now.getTime() - GPS_INJURY_SIGNAL.WINDOW_DAYS * 86400000);

    const recentSessions = (this.sessions || [])
        .filter(s => s.playerId === playerId)
        .filter(s => new Date(s.date) >= cutoff);

    let discrepantCount = 0;
    let gpsSessionCount = 0;

    recentSessions.forEach(s => {
        const gpsGroup = this.gpsData[s.id];
        const gps = gpsGroup ? gpsGroup[playerId] : null;
        if (!gps || gps.oliRpe === null || gps.oliRpe === undefined) return;

        gpsSessionCount++;
        const diff = Math.abs((s.rpe || 0) - gps.oliRpe);
        if (diff >= GPS_INJURY_SIGNAL.RPE_DIFF_THRESHOLD) discrepantCount++;
    });

    result.discrepantCount = discrepantCount;
    result.gpsSessionCount = gpsSessionCount;

    const hasEnoughData = gpsSessionCount >= GPS_INJURY_SIGNAL.MIN_GPS_SESSIONS;
    const hasPattern = discrepantCount >= GPS_INJURY_SIGNAL.MIN_DISCREPANT_SESSIONS;

    if (hasEnoughData && hasPattern) {
        result.adjustment = GPS_INJURY_SIGNAL.SCORE_ADJUSTMENT;
        result.applied = true;
        result.detail = `${discrepantCount} de ${gpsSessionCount} sesiones con GPS muestran discrepancia RPE ≥${GPS_INJURY_SIGNAL.RPE_DIFF_THRESHOLD} puntos en los últimos ${GPS_INJURY_SIGNAL.WINDOW_DAYS} días.`;
    }

    return result;
};

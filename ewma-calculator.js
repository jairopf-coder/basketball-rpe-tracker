// BasketballRPE-Web — ewma-calculator.js
// Extracted from app.js (V21 refactor)
// Expone: RPETracker.prototype.readinessLabel
//          RPETracker.prototype.calculateAcuteChronicRatio
//          RPETracker.prototype.getPlayerThresholds
// Depende de: ACCache (security.js), calcTeamFatigueIndex (security.js)

'use strict';

// ── readinessLabel ─────────────────────────────────────────────────────────
RPETracker.prototype.readinessLabel = function(score) {
    if (score === null) return { icon: '—', color: '#999', bg: 'transparent', cls: 'rdy-none' };
    if (score >= 70)    return { icon: '🟢', color: '#2e7d32', bg: '#e8f5e9', cls: 'rdy-green' };
    if (score >= 45)    return { icon: '🟡', color: '#f9a825', bg: '#fffde7', cls: 'rdy-yellow' };
    return               { icon: '🔴', color: '#c62828', bg: '#ffebee', cls: 'rdy-red' };
};

// ── calculateAcuteChronicRatio ─────────────────────────────────────────────
RPETracker.prototype.calculateAcuteChronicRatio = function(playerId) {
        // Memoize result (invalidated via ACCache.invalidate() on save/delete)
        if (typeof ACCache !== 'undefined') {
            const cached = ACCache.get(playerId, this.sessions);
            if (cached !== null) return cached;
        }
        const MATCH_MULT = RPETracker.MATCH_LOAD_MULTIPLIER;
        const playerSessions = this.sessions
            .filter(s => s.playerId === playerId)
            .map(s => ({
                ...s,
                date: new Date(s.date),
                load: (s.load || (s.rpe * (s.duration || 60))) * (s.type === 'match' ? MATCH_MULT : 1)
            }))
            .sort((a, b) => a.date - b.date); // Sort chronologically
        
        if (playerSessions.length === 0) {
            return {
                acute: 0,
                chronic: 0,
                ratio: 'N/A',
                sessions7d: 0,
                sessions21d: 0,
                totalLoad7d: 0,
                totalLoad21d: 0
            };
        }
        
        // EWMA parameters (based on scientific literature)
        // Acute: lambda = 2/(7+1) = 0.25 (7-day window)
        // Chronic: lambda = 2/(28+1) = 0.069 (28-day window)
        const lambdaAcute = 2 / (7 + 1);
        const lambdaChronic = 2 / (28 + 1);

        // Seed EWMA with average daily load from all historical sessions,
        // so it converges immediately instead of starting cold from 0.
        const allLoads = playerSessions.map(s => s.load);
        const seedLoad = allLoads.length > 0
            ? allLoads.reduce((a, b) => a + b, 0) / allLoads.length
            : 0;

        let ewmaAcute = seedLoad;
        let ewmaChronic = seedLoad;

        // Calculate EWMA for each day
        const now = new Date();
        const maxDaysBack = 56; // Look back 56 days (8 weeks) for better chronic baseline
        
        for (let i = maxDaysBack; i >= 0; i--) {
            const currentDate = new Date(now);
            currentDate.setDate(currentDate.getDate() - i);
            currentDate.setHours(0, 0, 0, 0);
            
            const nextDate = new Date(currentDate);
            nextDate.setDate(nextDate.getDate() + 1);
            
            // Find sessions on this day
            const dailySessions = playerSessions.filter(s => {
                const sessionDate = new Date(s.date);
                sessionDate.setHours(0, 0, 0, 0);
                return sessionDate.getTime() === currentDate.getTime();
            });
            
            // Sum load for this day
            const dailyLoad = dailySessions.reduce((sum, s) => sum + s.load, 0);
            
            // Update EWMA
            // EWMA formula: EWMA_today = lambda × load_today + (1 - lambda) × EWMA_yesterday
            ewmaAcute = (lambdaAcute * dailyLoad) + ((1 - lambdaAcute) * ewmaAcute);
            ewmaChronic = (lambdaChronic * dailyLoad) + ((1 - lambdaChronic) * ewmaChronic);
        }
        
        // Calculate ACWR (Acute:Chronic Workload Ratio)
        const ratio = ewmaChronic > 0 ? (ewmaAcute / ewmaChronic) : 0;
        
        // Get session counts for display
        const sevenDaysAgo = new Date(now);
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        const twentyEightDaysAgo = new Date(now);
        twentyEightDaysAgo.setDate(twentyEightDaysAgo.getDate() - 28);
        
        const acuteSessions = playerSessions.filter(s => s.date >= sevenDaysAgo);
        const chronicSessions = playerSessions.filter(s => s.date >= twentyEightDaysAgo);
        
        const totalLoad7d = acuteSessions.reduce((sum, s) => sum + s.load, 0);
        const totalLoad28d = chronicSessions.reduce((sum, s) => sum + s.load, 0);
        
        const result = {
            acute: ewmaAcute,
            chronic: ewmaChronic,
            ratio: ratio > 0 ? ratio.toFixed(2) : 'N/A',
            confidence: 'high',
            message: '',
            sessions7d: acuteSessions.length,
            sessions21d: chronicSessions.length,
            totalLoad7d: Math.round(totalLoad7d),
            totalLoad21d: Math.round(totalLoad28d)
        };
        // Store in cache for this render cycle
        if (typeof ACCache !== 'undefined') ACCache.set(playerId, this.sessions, result);
        return result;
    };

// ── getPlayerThresholds ───────────────────────────────────────────────────
RPETracker.prototype.getPlayerThresholds = function(playerId) {
        const player = playerId ? this.players.find(p => p.id === playerId) : null;
        return {
            low:  (player?.acThresholdLow  != null) ? Number(player.acThresholdLow)  : 0.8,
            opt:  (player?.acThresholdOpt  != null) ? Number(player.acThresholdOpt)  : 1.3,
            high: (player?.acThresholdHigh != null) ? Number(player.acThresholdHigh) : 1.5
        };
    };

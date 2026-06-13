// app-comparisons.js — Módulo de comparativas entre jugadoras (extraído de app.js V24)
RPETracker.prototype.renderComparisonChart = function() {
    const canvas = document.getElementById('comparisonChart');
    if (!canvas || this.players.length < 2) return;

    if (canvas._chartInstance) {
        canvas._chartInstance.destroy();
        canvas._chartInstance = null;
    }

    const comparisonData = this.players.map(player => {
        const ratio = this.calculateAcuteChronicRatio(player.id);
        return {
            name: player.name + (player.number ? ` #${player.number}` : ''),
            ratio: parseFloat(ratio.ratio) || 0
        };
    }).sort((a, b) => b.ratio - a.ratio);

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#aaa' : '#666';

    const barColors     = comparisonData.map(p => this.getRatioColor(p.ratio));
    const barColorsFade = barColors.map(c => c + '55');

    // Zone reference lines plugin
    const zoneLines = {
        id: 'compZoneLines',
        afterDraw(chart) {
            const { ctx, chartArea: ca, scales: { y } } = chart;
            if (!ca) return;
            const thresholds = [
                { v: 0.8, label: '0.8', color: '#1565c0' },
                { v: 1.3, label: '1.3', color: '#2e7d32' },
                { v: 1.5, label: '1.5', color: '#ef6c00' },
            ];
            ctx.save();
            thresholds.forEach(({ v, label, color }) => {
                const yPx = y.getPixelForValue(v);
                if (yPx < ca.top || yPx > ca.bottom) return;
                ctx.strokeStyle = color + 'aa';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([5, 4]);
                ctx.beginPath();
                ctx.moveTo(ca.left, yPx);
                ctx.lineTo(ca.right, yPx);
                ctx.stroke();
                ctx.setLineDash([]);
                ctx.fillStyle = color;
                ctx.font = '10px system-ui, sans-serif';
                ctx.fillText(label, ca.right + 4, yPx + 3);
            });
            ctx.restore();
        }
    };

    const instance = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        plugins: [zoneLines],
        data: {
            labels: comparisonData.map(p => p.name),
            datasets: [{
                label: 'Ratio A:C',
                data: comparisonData.map(p => p.ratio),
                backgroundColor: barColorsFade,
                borderColor: barColors,
                borderWidth: 2,
                borderRadius: 6,
                borderSkipped: false,
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            animation: { duration: 600, easing: 'easeOutQuart' },
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(30,30,30,0.92)' : 'rgba(255,255,255,0.96)',
                    titleColor: isDark ? '#fff' : '#111',
                    bodyColor: isDark ? '#ccc' : '#444',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                    borderWidth: 1,
                    padding: 10,
                    callbacks: {
                        label: (ctx) => {
                            const v = ctx.raw;
                            const _tChart = this.getPlayerThresholds(null);
                            const estado = v <= 0 ? 'Sin datos'
                                : v < _tChart.low  ? '⬇️ Descarga'
                                : v <= _tChart.opt ? '✅ Óptimo'
                                : v <= _tChart.high? '⚠️ Precaución'
                                : '🚨 Peligro';
                            return `Ratio A:C: ${v.toFixed(2)}  •  ${estado}`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: { color: textColor, font: { size: 11, family: 'system-ui, sans-serif' } },
                    grid: { display: false }
                },
                y: {
                    min: 0,
                    suggestedMax: 2.0,
                    ticks: {
                        color: textColor,
                        font: { size: 10, family: 'system-ui, sans-serif' },
                        callback: v => v.toFixed(1)
                    },
                    grid: { color: gridColor },
                    title: { display: true, text: 'Ratio A:C', color: textColor, font: { size: 10 } }
                }
            }
        }
    });

    canvas._chartInstance = instance;
};

RPETracker.prototype.renderSparklineSVG = function(data, color = '#ff6600', width = 80, height = 28) {
    const n = data.length;
    if (n === 0) return `<svg width="${width}" height="${height}"></svg>`;
    const max = Math.max(...data, 1);
    const pad = 2;
    const xStep = (width - pad * 2) / Math.max(n - 1, 1);

    const pts = data.map((v, i) => {
        const x = pad + i * xStep;
        const y = pad + (height - pad * 2) * (1 - v / max);
        return [parseFloat(x.toFixed(1)), parseFloat(y.toFixed(1))];
    });

    const polyline = pts.map(([x, y]) => `${x},${y}`).join(' ');
    const area = [
        `${pts[0][0]},${height - pad}`,
        ...pts.map(([x, y]) => `${x},${y}`),
        `${pts[n - 1][0]},${height - pad}`
    ].join(' ');

    return `<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" style="display:block;overflow:visible">
        <polygon points="${area}" fill="${color}" fill-opacity="0.18"/>
        <polyline points="${polyline}" fill="none" stroke="${color}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>
        <circle cx="${pts[n-1][0]}" cy="${pts[n-1][1]}" r="2.5" fill="${color}"/>
    </svg>`;
};

RPETracker.prototype.renderPlayerComparison = function() {
    if (this.players.length < 2) return '';

    const now = new Date();

    const comparisonData = this.players.map(player => {
        const ratio = this.calculateAcuteChronicRatio(player.id);
        const playerSessions = this.sessions.filter(s => s.playerId === player.id);
        const avgRPE = playerSessions.length > 0
            ? (playerSessions.reduce((sum, s) => sum + s.rpe, 0) / playerSessions.length).toFixed(1)
            : '—';

        // 7-day daily load for sparkline
        const sparkData = [];
        for (let d = 6; d >= 0; d--) {
            const dayStart = new Date(now); dayStart.setDate(dayStart.getDate() - d); dayStart.setHours(0,0,0,0);
            const dayEnd   = new Date(dayStart); dayEnd.setHours(23,59,59,999);
            const dayLoad  = playerSessions
                .filter(s => { const sd = new Date(s.date); return sd >= dayStart && sd <= dayEnd; })
                .reduce((sum, s) => sum + (s.load || s.rpe * (s.duration || 60)), 0);
            sparkData.push(dayLoad);
        }

        const totalLoad7d  = ratio.totalLoad7d  || 0;
        const totalLoad21d = ratio.totalLoad21d || 0;
        const rec = this.getLoadRecommendation(player.id);
        const color = PlayerTokens.get(player);

        return {
            player, ratio, avgRPE, sparkData, totalLoad7d, totalLoad21d, rec, color
        };
    }).sort((a, b) => (parseFloat(b.ratio.ratio) || 0) - (parseFloat(a.ratio.ratio) || 0));

    const rows = comparisonData.map(({ player, ratio, avgRPE, sparkData, totalLoad7d, rec, color }) => {
        const rVal      = parseFloat(ratio.ratio) || 0;
        const ratioCol  = this.getRatioColor(ratio.ratio);
        const _tBadge = this.getPlayerThresholds(player.id);
        const statusBadge = ratio.ratio === 'N/A'
            ? `<span class="cmp-badge cmp-badge--grey">N/A</span>`
            : rVal < _tBadge.low
                ? `<span class="cmp-badge cmp-badge--blue">⬇ Descarga</span>`
                : rVal <= _tBadge.opt
                    ? `<span class="cmp-badge cmp-badge--green">✅ Óptimo</span>`
                    : rVal <= _tBadge.high
                        ? `<span class="cmp-badge cmp-badge--orange">⚠ Precaución</span>`
                        : `<span class="cmp-badge cmp-badge--red">🚨 Peligro</span>`;

        const spark = this.renderSparklineSVG(sparkData, color, 84, 28);

        return `<tr class="cmp-row">
            <td class="cmp-td cmp-td--player">
                <div class="cmp-player-cell">
                    <div class="cmp-token" style="background:${color}">
                        ${player.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <div class="cmp-name">${player.name}</div>
                        ${player.number ? `<div class="cmp-num">#${player.number}</div>` : ''}
                    </div>
                </div>
            </td>
            <td class="cmp-td cmp-td--ratio" style="color:${ratioCol}; font-weight:700">
                ${ratio.ratio !== 'N/A' ? rVal.toFixed(2) : '—'}
            </td>
            <td class="cmp-td">${statusBadge}</td>
            <td class="cmp-td cmp-td--num">${avgRPE}</td>
            <td class="cmp-td cmp-td--num">${totalLoad7d > 0 ? totalLoad7d.toLocaleString('es-ES') : '—'}</td>
            <td class="cmp-td cmp-td--spark">${spark}</td>
            <td class="cmp-td cmp-td--rec">
                <div class="cmp-rec-wrap">
                    <span class="cmp-rec-label">${rec.message}</span>
                    ${rec.targetLoad != null ? `<span class="cmp-rec-load" title="${rec.advice || ''}">${rec.targetLoad.toLocaleString('es-ES')} UA${rec.combo ? '<br><span class=\'cmp-rec-combo\'>' + rec.combo + '</span>' : ''}</span>` : '<span class="cmp-rec-nodata">—</span>'}
                </div>
            </td>
        </tr>`;
    }).join('');

    return `
        <h3 style="margin: 0 0 0.75rem 0;">👥 Comparativa de Jugadoras</h3>
        <div class="cmp-table-wrap">
            <table class="cmp-table">
                <thead>
                    <tr class="cmp-thead-row">
                        <th class="cmp-th">Jugadora</th>
                        <th class="cmp-th">Ratio A:C</th>
                        <th class="cmp-th">Estado</th>
                        <th class="cmp-th">RPE Medio</th>
                        <th class="cmp-th">Carga 7d</th>
                        <th class="cmp-th">7 días</th>
                        <th class="cmp-th">Recomendación</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>
    `;
};

RPETracker.prototype.renderComparisonModule = function() {
    const container = document.getElementById('comparisonModule');
    if (!container || this.players.length < 2) {
        if (container) container.innerHTML = '';
        return;
    }

    const playerOptions = this.players.map(p =>
        `<option value="${p.id}">${esc(p.name)}${p.number ? ' #'+p.number : ''}</option>`
    ).join('');

    container.innerHTML = `
        <div class="comp-card">
            <div class="comp-header">
                <h3 class="comp-title">🔍 Comparador</h3>
                <div class="comp-mode-toggle">
                    <button class="comp-mode-btn active" id="modePvP" onclick="window.rpeTracker?.setCompMode('pvp')">
                        Jugadora vs Jugadora
                    </button>
                    <button class="comp-mode-btn" id="modePvT" onclick="window.rpeTracker?.setCompMode('pvt')">
                        Jugadora vs Media equipo
                    </button>
                </div>
            </div>

            <div class="comp-selectors">
                <div class="comp-selector-group">
                    <label class="comp-label" id="labelA">Jugadora A</label>
                    <select class="comp-select" id="compPlayerA" onchange="window.rpeTracker?.updateComparison()">
                        ${playerOptions}
                    </select>
                </div>
                <div class="comp-vs">VS</div>
                <div class="comp-selector-group" id="selectorB">
                    <label class="comp-label" id="labelB">Jugadora B</label>
                    <select class="comp-select" id="compPlayerB" onchange="window.rpeTracker?.updateComparison()">
                        ${this.players.map((p, i) =>
                            `<option value="${p.id}" ${i===1?'selected':''}>${esc(p.name)}${p.number ? ' #'+p.number : ''}</option>`
                        ).join('')}
                    </select>
                </div>
                <div class="comp-selector-group" id="selectorTeam" style="display:none;">
                    <label class="comp-label">Referencia</label>
                    <div class="comp-team-badge">📊 Media del equipo</div>
                </div>
            </div>

            <div class="comp-body-grid">
                <div id="compMetrics" class="comp-metrics"></div>
                <div class="comp-chart-wrap">
                    <canvas id="compChart" width="600" height="300"></canvas>
                </div>
            </div>
        </div>
    `;

    this._compMode = 'pvp';
    // Initialise date range to last 4 weeks
    this._compRangeStart = (() => { const d = new Date(); d.setDate(d.getDate() - 28); return d.toISOString().slice(0,10); })();
    this._compRangeEnd   = new Date().toISOString().slice(0,10);
    this._injectCompDatePicker();
    this.updateComparison();
};

RPETracker.prototype.setCompMode = function(mode) {
    this._compMode = mode;
    document.getElementById('modePvP')?.classList.toggle('active', mode === 'pvp');
    document.getElementById('modePvT')?.classList.toggle('active', mode === 'pvt');
    const selectorB = document.getElementById('selectorB');
    const selectorTeam = document.getElementById('selectorTeam');
    const labelA = document.getElementById('labelA');
    if (selectorB) selectorB.style.display = mode === 'pvp' ? '' : 'none';
    if (selectorTeam) selectorTeam.style.display = mode === 'pvt' ? '' : 'none';
    if (labelA) labelA.textContent = mode === 'pvt' ? 'Jugadora' : 'Jugadora A';
    this.updateComparison();
};

RPETracker.prototype.updateComparison = function() {
    const idA = document.getElementById('compPlayerA')?.value;
    if (!idA) return;

    const playerA = this.players.find(p => p.id === idA);
    if (!playerA) return;

    const mode = this._compMode || 'pvp';
    const metricsEl = document.getElementById('compMetrics');
    const canvas = document.getElementById('compChart');
    if (!metricsEl || !canvas) return;

    const statsA = this.getCompStats(idA);

    let statsB, labelB, colorB;
    if (mode === 'pvp') {
        const idB = document.getElementById('compPlayerB')?.value;
        const playerB = this.players.find(p => p.id === idB);
        if (!playerB || idB === idA) { metricsEl.innerHTML = '<p style="color:#999;padding:1rem">Selecciona dos jugadoras distintas</p>'; return; }
        statsB = this.getCompStats(idB);
        labelB = playerB.name + (playerB.number ? ' #'+playerB.number : '');
        colorB = '#0066ff';
    } else {
        statsB = this.getTeamAvgStats();
        labelB = 'Media equipo';
        colorB = '#9c27b0';
    }

    const labelA = playerA.name + (playerA.number ? ' #'+playerA.number : '');
    const colorA = '#ff6600';

    // Metrics grid
    const metrics = [
        { key: 'ratio',       label: 'Ratio A:C',          fmt: v => v > 0 ? v.toFixed(2) : 'N/A' },
        { key: 'avgRPE',      label: 'RPE medio global',   fmt: v => v > 0 ? v.toFixed(1) : 'N/A' },
        { key: 'rpe7',        label: 'RPE últimos 7 días', fmt: v => v > 0 ? v.toFixed(1) : 'N/A' },
        { key: 'trend',       label: 'Tendencia RPE',      fmt: v => v === 0 ? '—' : (v > 0 ? '↑ +'+Math.abs(v).toFixed(0)+'%' : '↓ -'+Math.abs(v).toFixed(0)+'%') },
        { key: 'load7',       label: 'Carga últimos 7d',   fmt: v => v > 0 ? Math.round(v) : 'N/A' },
        { key: 'load28',      label: 'Carga últimos 28d',  fmt: v => v > 0 ? Math.round(v) : 'N/A' },
        { key: 'sessions28',  label: 'Sesiones (28 días)', fmt: v => v },
        { key: 'avgDuration', label: 'Duración media',     fmt: v => v > 0 ? Math.round(v)+"'" : 'N/A' },
    ];

    metricsEl.innerHTML = `
        <div class="comp-metrics-header">
            <div class="comp-metrics-label"></div>
            <div class="comp-metrics-col" style="color:${colorA}">${labelA}</div>
            <div class="comp-metrics-col" style="color:${colorB}">${labelB}</div>
        </div>
        ${metrics.map(m => {
            const vA = statsA[m.key], vB = statsB[m.key];
            const fA = m.fmt(vA), fB = m.fmt(vB);
            // Highlight better value (lower ratio=better if >1.3, more sessions=better)
            const aWins = m.key === 'ratio'
                ? (parseFloat(vA)||0) <= (parseFloat(vB)||0)
                : m.key === 'sessions' || m.key === 'totalLoad'
                    ? (vA||0) >= (vB||0)
                    : false;
            return `
            <div class="comp-metrics-row">
                <div class="comp-metrics-label">${m.label}</div>
                <div class="comp-metrics-col ${m.key==='ratio' && aWins ? 'comp-winner':''}" style="color:${colorA}">${fA}</div>
                <div class="comp-metrics-col ${m.key==='ratio' && !aWins ? 'comp-winner':''}" style="color:${colorB}">${fB}</div>
            </div>`;
        }).join('')}
    `;

    // Line chart: RPE evolution last 8 weeks (Chart.js)
    const seriesA = this.getWeeklyRPESeries(idA);
    const seriesB = mode === 'pvp'
        ? this.getWeeklyRPESeries(document.getElementById('compPlayerB')?.value)
        : this.getTeamWeeklyRPESeries();

    const allWeeks = [...new Set([...seriesA.map(d=>d.week), ...seriesB.map(d=>d.week)])].sort();
    const valA = allWeeks.map(w => seriesA.find(d=>d.week===w)?.rpe ?? null);
    const valB = allWeeks.map(w => seriesB.find(d=>d.week===w)?.rpe ?? null);
    const labels = allWeeks.map(w => 'S'+w.slice(-2));

    const compCanvas = document.getElementById('compChart');
    if (compCanvas) {
        if (compCanvas._chartInstance) { compCanvas._chartInstance.destroy(); compCanvas._chartInstance = null; }
        const isDark   = document.documentElement.getAttribute('data-theme') === 'dark';
        const gridCol  = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
        const textCol  = isDark ? '#aaa' : '#666';
        compCanvas._chartInstance = new Chart(compCanvas.getContext('2d'), {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: labelA,
                        data: valA,
                        borderColor: colorA,
                        backgroundColor: colorA + '22',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        spanGaps: true
                    },
                    {
                        label: labelB,
                        data: valB,
                        borderColor: colorB,
                        backgroundColor: colorB + '22',
                        fill: true,
                        tension: 0.35,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        borderWidth: 2,
                        spanGaps: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                plugins: {
                    legend: { labels: { color: textCol, font: { size: 11 }, boxWidth: 14 } },
                    tooltip: { callbacks: { label: ctx => `${ctx.dataset.label}: RPE ${ctx.raw?.toFixed(1) ?? '—'}` } }
                },
                scales: {
                    x: { ticks: { color: textCol, font: { size: 10 } }, grid: { color: gridCol } },
                    y: {
                        min: 0, max: 10,
                        ticks: { color: textCol, font: { size: 10 }, stepSize: 2 },
                        grid: { color: gridCol },
                        title: { display: true, text: 'RPE medio', color: textCol, font: { size: 10 } }
                    }
                }
            }
        });
    }
};

RPETracker.prototype._injectCompDatePicker = function() {
    const card = document.querySelector('#comparisonModule .comp-card');
    if (!card) return;

    const now = new Date();
    // Season start: 1 Sep of current or prior year
    const seasonYear = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
    const seasonStart = `${seasonYear}-09-01`;

    // Month start
    const monthStart = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;

    const pickerHTML = `
        <div class="comp-daterange" id="compDateRange">
            <div class="comp-dr-presets">
                <button class="comp-dr-preset active" id="drPreset4w" onclick="window.rpeTracker?.setCompDatePreset('4w')">Últimas 4 semanas</button>
                <button class="comp-dr-preset" id="drPresetMonth" onclick="window.rpeTracker?.setCompDatePreset('month')">Este mes</button>
                <button class="comp-dr-preset" id="drPresetSeason" onclick="window.rpeTracker?.setCompDatePreset('season')">Temporada completa</button>
            </div>
            <div class="comp-dr-inputs">
                <input type="date" id="compDateFrom" class="comp-dr-input" value="${this._compRangeStart}"
                       onchange="window.rpeTracker?._onCompDateChange()">
                <span class="comp-dr-sep">→</span>
                <input type="date" id="compDateTo" class="comp-dr-input" value="${this._compRangeEnd}"
                       onchange="window.rpeTracker?._onCompDateChange()">
            </div>
        </div>`;

    // Insert before comp-body-grid
    const bodyGrid = card.querySelector('.comp-body-grid');
    if (bodyGrid) bodyGrid.insertAdjacentHTML('beforebegin', pickerHTML);
};

RPETracker.prototype.setCompDatePreset = function(preset) {
    const now = new Date();
    let start;
    if (preset === '4w') {
        start = new Date(now); start.setDate(start.getDate() - 28);
    } else if (preset === 'month') {
        start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else { // season
        const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
        start = new Date(y, 8, 1); // 1 Sep
    }
    this._compRangeStart = start.toISOString().slice(0,10);
    this._compRangeEnd   = now.toISOString().slice(0,10);

    const fromEl = document.getElementById('compDateFrom');
    const toEl   = document.getElementById('compDateTo');
    if (fromEl) fromEl.value = this._compRangeStart;
    if (toEl)   toEl.value   = this._compRangeEnd;

    // Update active preset button
    ['4w','month','season'].forEach(p => {
        document.getElementById(`drPreset${p === '4w' ? '4w' : p === 'month' ? 'Month' : 'Season'}`)
            ?.classList.toggle('active', p === preset);
    });

    this.updateComparison();
};

RPETracker.prototype._onCompDateChange = function() {
    const fromEl = document.getElementById('compDateFrom');
    const toEl   = document.getElementById('compDateTo');
    if (!fromEl || !toEl) return;
    this._compRangeStart = fromEl.value;
    this._compRangeEnd   = toEl.value;
    // Deactivate all presets when manually changed
    ['drPreset4w','drPresetMonth','drPresetSeason'].forEach(id => {
        document.getElementById(id)?.classList.remove('active');
    });
    this.updateComparison();
};

RPETracker.prototype.getCompStats = function(playerId) {
    const rangeStart = this._compRangeStart ? new Date(this._compRangeStart) : null;
    const rangeEnd   = this._compRangeEnd   ? new Date(this._compRangeEnd + 'T23:59:59') : null;

    const allSessions = this.sessions.filter(s => s.playerId === playerId);
    const sessions = (rangeStart && rangeEnd)
        ? allSessions.filter(s => { const d = new Date(s.date); return d >= rangeStart && d <= rangeEnd; })
        : allSessions;
    const ratio = this.calculateAcuteChronicRatio(playerId);
    const totalLoad = sessions.reduce((s, x) => s + (x.load || x.rpe*(x.duration||60)), 0);

    // Last 28 days sessions
    const now = new Date();
    const d28 = new Date(now); d28.setDate(d28.getDate() - 28);
    const d7  = new Date(now); d7.setDate(d7.getDate() - 7);
    const recent28 = sessions.filter(s => new Date(s.date) >= d28);
    const recent7  = sessions.filter(s => new Date(s.date) >= d7);
    const load28 = recent28.reduce((s,x) => s + (x.load || x.rpe*(x.duration||60)), 0);
    const load7  = recent7.reduce((s,x) => s + (x.load || x.rpe*(x.duration||60)), 0);

    // Trend: compare last 7d avg RPE vs previous 7d
    const d14 = new Date(now); d14.setDate(d14.getDate() - 14);
    const prev7 = sessions.filter(s => new Date(s.date) >= d14 && new Date(s.date) < d7);
    const rpe7  = recent7.length  ? recent7.reduce((s,x)=>s+x.rpe,0)/recent7.length   : 0;
    const rpePrev = prev7.length  ? prev7.reduce((s,x)=>s+x.rpe,0)/prev7.length        : 0;
    const trend = rpe7 > 0 && rpePrev > 0 ? ((rpe7 - rpePrev) / rpePrev * 100) : 0;

    return {
        sessions:    sessions.length,
        sessions28:  recent28.length,
        avgRPE:      sessions.length ? sessions.reduce((s,x)=>s+x.rpe,0)/sessions.length : 0,
        rpe7,
        ratio:       parseFloat(ratio.ratio) || 0,
        totalLoad,
        load28,
        load7,
        avgLoad:     sessions.length ? totalLoad/sessions.length : 0,
        avgDuration: sessions.length ? sessions.reduce((s,x)=>s+(x.duration||60),0)/sessions.length : 0,
        trend,
    };
};

RPETracker.prototype.getTeamAvgStats = function() {
    if (!this.players.length) return { sessions:0, sessions28:0, avgRPE:0, rpe7:0, ratio:0, totalLoad:0, load28:0, load7:0, avgLoad:0, avgDuration:0, trend:0 };
    const all = this.players.map(p => this.getCompStats(p.id));
    const avg = key => all.reduce((s,x)=>s+(x[key]||0),0) / all.length;
    return {
        sessions:    Math.round(avg('sessions')),
        sessions28:  Math.round(avg('sessions28')),
        avgRPE:      avg('avgRPE'),
        rpe7:        avg('rpe7'),
        ratio:       avg('ratio'),
        totalLoad:   avg('totalLoad'),
        load28:      avg('load28'),
        load7:       avg('load7'),
        avgLoad:     avg('avgLoad'),
        avgDuration: avg('avgDuration'),
        trend:       avg('trend'),
    };
};

RPETracker.prototype.getWeeklyRPESeries = function(playerId) {
    const rangeStart = this._compRangeStart ? new Date(this._compRangeStart) : null;
    const rangeEnd   = this._compRangeEnd   ? new Date(this._compRangeEnd + 'T23:59:59') : null;
    let sessions = this.sessions.filter(s => s.playerId === playerId);
    if (rangeStart && rangeEnd) {
        sessions = sessions.filter(s => { const d = new Date(s.date); return d >= rangeStart && d <= rangeEnd; });
    }
    const byWeek = {};
    sessions.forEach(s => {
        const d = new Date(s.date);
        const week = this.getWeekKey(d);
        if (!byWeek[week]) byWeek[week] = [];
        byWeek[week].push(s.rpe);
    });
    return Object.entries(byWeek)
        .map(([week, rpes]) => ({ week, rpe: rpes.reduce((a,b)=>a+b,0)/rpes.length }))
        .sort((a,b) => a.week.localeCompare(b.week));
};

RPETracker.prototype.getTeamWeeklyRPESeries = function() {
    const rangeStart = this._compRangeStart ? new Date(this._compRangeStart) : null;
    const rangeEnd   = this._compRangeEnd   ? new Date(this._compRangeEnd + 'T23:59:59') : null;
    let sessions = this.sessions;
    if (rangeStart && rangeEnd) {
        sessions = sessions.filter(s => { const d = new Date(s.date); return d >= rangeStart && d <= rangeEnd; });
    }
    const byWeek = {};
    sessions.forEach(s => {
        const week = this.getWeekKey(new Date(s.date));
        if (!byWeek[week]) byWeek[week] = [];
        byWeek[week].push(s.rpe);
    });
    return Object.entries(byWeek)
        .map(([week, rpes]) => ({ week, rpe: rpes.reduce((a,b)=>a+b,0)/rpes.length }))
        .sort((a,b) => a.week.localeCompare(b.week));
};

RPETracker.prototype.getWeekKey = function(date) {
    const d = new Date(date);
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() - d.getDay() + 1); // Monday
    return d.toISOString().slice(0,10);
};

RPETracker.prototype._drawSparkline = function(canvas, data, color) {
    const ctx = canvas.getContext('2d');
    const w = canvas.width;
    const h = canvas.height;
    ctx.clearRect(0, 0, w, h);

    const max = Math.max(...data, 1);
    const n = data.length;
    const pad = 2;
    const xStep = (w - pad * 2) / (n - 1);

    // Fill area
    ctx.beginPath();
    ctx.moveTo(pad, h - pad);
    data.forEach((v, i) => {
        const x = pad + i * xStep;
        const y = h - pad - ((v / max) * (h - pad * 2));
        ctx.lineTo(x, y);
    });
    ctx.lineTo(pad + (n - 1) * xStep, h - pad);
    ctx.closePath();
    ctx.fillStyle = color + '33';
    ctx.fill();

    // Line
    ctx.beginPath();
    data.forEach((v, i) => {
        const x = pad + i * xStep;
        const y = h - pad - ((v / max) * (h - pad * 2));
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Last point dot
    const lastX = pad + (n - 1) * xStep;
    const lastY = h - pad - ((data[n - 1] / max) * (h - pad * 2));
    ctx.beginPath();
    ctx.arc(lastX, lastY, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
};

RPETracker.prototype._initRosterDragAndDrop = function(container) {
    let dragging = null;

    container.querySelectorAll('.player-card[draggable]').forEach(card => {
        card.addEventListener('dragstart', e => {
            dragging = card;
            card.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
        });
        card.addEventListener('dragend', () => {
            card.classList.remove('dragging');
            container.querySelectorAll('.player-card').forEach(c => c.classList.remove('drag-over'));
            dragging = null;
        });
        card.addEventListener('dragover', e => {
            e.preventDefault();
            if (!dragging || dragging === card) return;
            container.querySelectorAll('.player-card').forEach(c => c.classList.remove('drag-over'));
            card.classList.add('drag-over');
        });
        card.addEventListener('drop', e => {
            e.preventDefault();
            if (!dragging || dragging === card) return;
            const dragId = dragging.dataset.playerId;
            const dropId = card.dataset.playerId;
            const dragIdx = this.players.findIndex(p => p.id === dragId);
            const dropIdx = this.players.findIndex(p => p.id === dropId);
            if (dragIdx < 0 || dropIdx < 0) return;
            const [moved] = this.players.splice(dragIdx, 1);
            this.players.splice(dropIdx, 0, moved);
            this.savePlayers();
            this.renderPlayers();
            this.showToast('↕️ Orden del equipo actualizado', 'success');
        });
    });
};


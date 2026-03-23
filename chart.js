// Simple Chart Library for RPE Tracker
// Lightweight canvas-based charts

class SimpleChart {
    constructor(canvasId, options = {}) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.width = this.canvas.width;
        this.height = this.canvas.height;
        this.padding = options.padding || 40;
        this.data = options.data || [];
        this.labels = options.labels || [];
        this.type = options.type || 'line';
        this.colors = options.colors || ['#ff6600', '#0066ff', '#4caf50'];
        this.title = options.title || '';
        this.yAxisLabel = options.yAxisLabel || '';
        this.showGrid = options.showGrid !== false;
        this.zones = options.zones || [];
    }

    clear() {
        this.ctx.clearRect(0, 0, this.width, this.height);
    }

    drawLineChart() {
        this.clear();
        
        if (this.data.length === 0) return;
        
        const chartWidth = this.width - 2 * this.padding;
        const chartHeight = this.height - 2 * this.padding;
        
        // Find min/max values
        let allValues = [];
        this.data.forEach(dataset => {
            allValues = allValues.concat(dataset.values);
        });
        
        const maxValue = Math.max(...allValues, 2.0); // At least 2.0 for ratio charts
        const minValue = Math.min(...allValues, 0);
        const valueRange = maxValue - minValue;
        
        // Draw title
        if (this.title) {
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.title, this.width / 2, 20);
        }
        
        // Draw zones (for ratio chart)
        if (this.zones.length > 0) {
            this.zones.forEach(zone => {
                const yStart = this.padding + chartHeight - ((zone.min - minValue) / valueRange * chartHeight);
                const yEnd = this.padding + chartHeight - ((zone.max - minValue) / valueRange * chartHeight);
                const zoneHeight = yStart - yEnd;
                
                this.ctx.fillStyle = zone.color;
                this.ctx.fillRect(this.padding, yEnd, chartWidth, zoneHeight);
            });
        }
        
        // Draw grid
        if (this.showGrid) {
            this.ctx.strokeStyle = '#e0e0e0';
            this.ctx.lineWidth = 1;
            
            // Horizontal lines
            for (let i = 0; i <= 5; i++) {
                const y = this.padding + (chartHeight / 5) * i;
                this.ctx.beginPath();
                this.ctx.moveTo(this.padding, y);
                this.ctx.lineTo(this.padding + chartWidth, y);
                this.ctx.stroke();
                
                // Y-axis labels
                const value = maxValue - (valueRange / 5) * i;
                this.ctx.fillStyle = '#666';
                this.ctx.font = '12px Arial';
                this.ctx.textAlign = 'right';
                this.ctx.fillText(value.toFixed(1), this.padding - 5, y + 4);
            }
        }
        
        // Draw axes
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding, this.padding);
        this.ctx.lineTo(this.padding, this.padding + chartHeight);
        this.ctx.lineTo(this.padding + chartWidth, this.padding + chartHeight);
        this.ctx.stroke();
        
        // Draw data
        const pointSpacing = chartWidth / Math.max(this.labels.length - 1, 1);
        
        this.data.forEach((dataset, datasetIndex) => {
            const color = dataset.color || this.colors[datasetIndex % this.colors.length];
            
            // Draw line
            this.ctx.strokeStyle = color;
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            
            dataset.values.forEach((value, index) => {
                const x = this.padding + index * pointSpacing;
                const y = this.padding + chartHeight - ((value - minValue) / valueRange * chartHeight);
                
                if (index === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            });
            
            this.ctx.stroke();
            
            // Draw points
            this.ctx.fillStyle = color;
            dataset.values.forEach((value, index) => {
                const x = this.padding + index * pointSpacing;
                const y = this.padding + chartHeight - ((value - minValue) / valueRange * chartHeight);
                
                this.ctx.beginPath();
                this.ctx.arc(x, y, 4, 0, 2 * Math.PI);
                this.ctx.fill();
            });
        });
        
        // Draw X-axis labels
        this.ctx.fillStyle = '#666';
        this.ctx.font = '11px Arial';
        this.ctx.textAlign = 'center';
        
        this.labels.forEach((label, index) => {
            if (index % Math.ceil(this.labels.length / 10) === 0 || index === this.labels.length - 1) {
                const x = this.padding + index * pointSpacing;
                this.ctx.fillText(label, x, this.padding + chartHeight + 20);
            }
        });
        
        // Draw legend
        let legendY = 50;
        this.data.forEach((dataset, index) => {
            const color = dataset.color || this.colors[index % this.colors.length];
            const legendX = this.width - this.padding - 100;
            
            this.ctx.fillStyle = color;
            this.ctx.fillRect(legendX, legendY, 15, 15);
            
            this.ctx.fillStyle = '#333';
            this.ctx.font = '12px Arial';
            this.ctx.textAlign = 'left';
            this.ctx.fillText(dataset.label, legendX + 20, legendY + 12);
            
            legendY += 25;
        });
    }

    drawBarChart() {
        this.clear();
        
        if (this.data.length === 0) return;
        
        const chartWidth = this.width - 2 * this.padding;
        const chartHeight = this.height - 2 * this.padding;
        
        const maxValue = Math.max(...this.data[0].values);
        const barWidth = chartWidth / (this.labels.length * 1.5);
        const spacing = barWidth * 0.5;
        
        // Draw title
        if (this.title) {
            this.ctx.fillStyle = '#1a1a1a';
            this.ctx.font = 'bold 16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.title, this.width / 2, 20);
        }
        
        // Draw axes
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(this.padding, this.padding);
        this.ctx.lineTo(this.padding, this.padding + chartHeight);
        this.ctx.lineTo(this.padding + chartWidth, this.padding + chartHeight);
        this.ctx.stroke();
        
        // Draw bars
        this.data[0].values.forEach((value, index) => {
            const x = this.padding + index * (barWidth + spacing);
            const barHeight = (value / maxValue) * chartHeight;
            const y = this.padding + chartHeight - barHeight;
            
            const color = this.data[0].colors ? this.data[0].colors[index] : this.colors[0];
            this.ctx.fillStyle = color;
            this.ctx.fillRect(x, y, barWidth, barHeight);
            
            // Draw value on top
            this.ctx.fillStyle = '#333';
            this.ctx.font = 'bold 12px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(value.toFixed(0), x + barWidth / 2, y - 5);
            
            // Draw label
            this.ctx.fillStyle = '#666';
            this.ctx.font = '11px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.fillText(this.labels[index], x + barWidth / 2, this.padding + chartHeight + 20);
        });
    }

    render() {
        if (this.type === 'line') {
            this.drawLineChart();
        } else if (this.type === 'bar') {
            this.drawBarChart();
        }
    }
}

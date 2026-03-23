// Backup & Restore functionality
// Add these methods to RPETracker class

RPETracker.prototype.showBackupMenu = function() {
    const options = confirm('¿Descargar backup de datos?\n\nOK = Descargar backup\nCancelar = Restaurar desde archivo');
    
    if (options) {
        this.downloadBackup();
    } else {
        document.getElementById('restoreFile').click();
    }
};

RPETracker.prototype.downloadBackup = function() {
    const backup = {
        version: '2.0',
        exportDate: new Date().toISOString(),
        players: this.players,
        sessions: this.sessions
    };
    
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const now = new Date();
    const filename = `RPE_Basketball_Backup_${now.getFullYear()}-${(now.getMonth()+1).toString().padStart(2,'0')}-${now.getDate().toString().padStart(2,'0')}.json`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showToast('💾 Backup descargado');
};

RPETracker.prototype.restoreBackup = function(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const backup = JSON.parse(e.target.result);
            
            if (!backup.players || !backup.sessions) {
                alert('❌ Archivo de backup inválido');
                return;
            }
            
            if (confirm(`¿Restaurar backup del ${new Date(backup.exportDate).toLocaleDateString('es-ES')}?\n\n⚠️ Esto REEMPLAZARÁ todos los datos actuales.`)) {
                this.players = backup.players;
                this.sessions = backup.sessions;
                this.savePlayers();
                this.saveSessions();
                
                this.renderPlayers();
                this.renderSessions();
                this.populatePlayerSelects();
                
                this.showToast('✅ Datos restaurados correctamente');
                
                // Reload page to refresh everything
                setTimeout(() => location.reload(), 1500);
            }
        } catch (error) {
            alert('❌ Error al leer el archivo: ' + error.message);
        }
    };
    
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
};

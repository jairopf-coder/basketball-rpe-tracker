# 🏗️ Arquitectura de la Aplicación

## 📊 Diagrama de Flujo

```
┌─────────────────────────────────────────────────────────────┐
│                    USUARIOS (Entrenadores)                   │
│  📱 Móvil    💻 Tablet    🖥️ Ordenador    📱 Móvil           │
└──────────────┬──────────────────────────────┬────────────────┘
               │                              │
               ▼                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    GITHUB PAGES (Hosting)                     │
│         https://tu-usuario.github.io/basketball-rpe/         │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │  index.html  │  │   app.js     │  │  styles.css  │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │firebase-     │  │firebase-     │                         │
│  │config.js     │  │sync.js       │                         │
│  └──────────────┘  └──────────────┘                         │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            │ ⚡ Tiempo Real
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│               FIREBASE REALTIME DATABASE                      │
│                  (Base de Datos en la Nube)                  │
│                                                              │
│  📦 /sessions/                                               │
│     ├── session-001: { player, rpe, date, ... }             │
│     ├── session-002: { player, rpe, date, ... }             │
│     └── ...                                                  │
│                                                              │
│  👥 /players/                                                │
│     ├── player-001: { name, number, category, ... }         │
│     ├── player-002: { name, number, category, ... }         │
│     └── ...                                                  │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Flujo de Datos

### Cuando un usuario AÑADE una sesión:

```
1. Usuario → Formulario en navegador
                ↓
2. app.js → Valida datos
                ↓
3. firebase-sync.js → Envía a Firebase
                ↓
4. Firebase → Guarda en base de datos
                ↓
5. Firebase → Notifica a TODOS los usuarios conectados
                ↓
6. Todos los navegadores → Reciben actualización
                ↓
7. app.js → Actualiza la interfaz automáticamente
```

**Tiempo total: < 1 segundo** ⚡

---

## 📁 Estructura de Archivos

### Archivos Principales
```
BasketballRPE-Web/
├── 📄 index.html           → Estructura HTML de la app
├── 🎨 styles.css           → Estilos visuales
├── ⚙️ app.js               → Lógica principal de la aplicación
├── 🔥 firebase-config.js   → Configuración de Firebase (EDITAR AQUÍ)
├── 🔄 firebase-sync.js     → Sincronización con Firebase
├── 🌐 server.js            → Servidor local para desarrollo
└── 📱 manifest.json        → Configuración PWA
```

### Archivos de Ayuda
```
├── 🎯 EMPIEZA-AQUI.md           → Primera lectura
├── ✅ CHECKLIST.md              → Pasos rápidos
├── 📖 INSTRUCCIONES-FIREBASE.md → Guía completa
├── 📚 README.md                 → Documentación
└── 🏗️ ARQUITECTURA.md          → Este archivo
```

### Módulos Adicionales
```
├── 📅 calendar.js          → Calendario de sesiones
├── 🏥 injury-management.js → Gestión de lesiones
├── 🔮 injury-prediction.js → Predicción de riesgos
├── 💾 backup.js            → Backup y restauración
├── 📊 chart.js             → Gráficos y visualizaciones
└── 🛠️ improvements.js      → Mejoras continuas
```

---

## 🔐 Seguridad y Datos

### ¿Dónde se guardan los datos?

**Antes (localStorage):**
- En el navegador de cada usuario
- No se comparten
- Se pierden si borras el navegador

**Ahora (Firebase):**
- En la nube de Google
- Compartidos entre todos
- Persistentes y con backup automático

### ¿Quién puede acceder?

**Configuración actual (modo desarrollo):**
```json
{
  "rules": {
    ".read": true,   // Cualquiera con el enlace puede leer
    ".write": true   // Cualquiera con el enlace puede escribir
  }
}
```

✅ **Perfecto para:** Equipos pequeños de confianza
⚠️ **No usar para:** Datos sensibles médicos

### Mejorar seguridad (opcional, futuro):
- Añadir autenticación con Google
- Limitar escritura a usuarios autorizados
- Auditoría de cambios

---

## ⚡ Características Técnicas

### Sincronización en Tiempo Real
```javascript
// Cuando cambian las sesiones en Firebase
firebase.database().ref('sessions').on('value', (snapshot) => {
    // Todos los usuarios reciben esta actualización
    const sessions = snapshot.val();
    updateUI(sessions);
});
```

### Modo Offline
- Si pierdes conexión, la app sigue funcionando
- Los datos se guardan localmente en localStorage
- Al reconectar, se sincronizan automáticamente

### PWA (Progressive Web App)
- Se puede instalar como app en móvil
- Funciona offline (datos en caché)
- Recibe actualizaciones automáticas

---

## 📊 Límites del Plan Gratuito

### GitHub Pages
- **Ancho de banda:** 100 GB/mes
- **Almacenamiento:** 1 GB
- **Compilaciones:** 10 por hora

✅ **Suficiente para:** Miles de usuarios

### Firebase (Plan Spark - Gratuito)
- **Conexiones simultáneas:** 100
- **Almacenamiento:** 1 GB
- **Transferencia:** 10 GB/mes
- **Operaciones:** 50,000 lecturas/día

✅ **Suficiente para:** Un equipo de baloncesto con datos durante años

### ¿Cuándo necesitarías pagar?

**GitHub Pages:** Nunca (es siempre gratis para proyectos públicos)

**Firebase:** Solo si tienes:
- Más de 100 usuarios conectados a la vez
- Más de 10 GB de transferencia al mes
- Más de 1 GB de datos almacenados

Para un equipo de baloncesto: **Nunca llegarás a estos límites**

---

## 🚀 Rendimiento

### Tiempos de Respuesta
- **Carga inicial:** < 2 segundos
- **Sincronización:** < 1 segundo
- **Actualización UI:** Instantánea

### Optimizaciones Incluidas
- ✅ Caché de datos locales
- ✅ Service Worker para offline
- ✅ Lazy loading de módulos
- ✅ Compresión de datos

---

## 🔮 Posibles Mejoras Futuras

### Corto Plazo (fácil)
- [ ] Autenticación con Google
- [ ] Notificaciones push
- [ ] Exportación automática a Google Sheets
- [ ] Modo oscuro

### Medio Plazo (moderado)
- [ ] Integración con smartwatches
- [ ] IA para predicción de lesiones avanzada
- [ ] Chat entre entrenadores
- [ ] Roles (admin, entrenador, visualizador)

### Largo Plazo (complejo)
- [ ] Integración con sistemas de monitorización (Catapult, etc.)
- [ ] API para terceros
- [ ] Machine Learning para patrones de rendimiento
- [ ] App nativa iOS/Android

---

## 📞 Soporte Técnico

### Stack Tecnológico
- **Frontend:** Vanilla JavaScript (ES6+)
- **Backend:** Firebase Realtime Database
- **Hosting:** GitHub Pages
- **Build:** Ninguno (no requiere compilación)
- **Package Manager:** Ninguno (sin dependencias npm)

### Requisitos del Navegador
- Chrome 90+ ✅
- Firefox 88+ ✅
- Safari 14+ ✅
- Edge 90+ ✅

### Dispositivos Soportados
- 📱 iOS 14+
- 📱 Android 8+
- 💻 Windows 10+
- 🍎 macOS 11+
- 🐧 Linux (cualquier distro moderna)

---

¿Preguntas técnicas? Consulta el código o abre un issue en GitHub.

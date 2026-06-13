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

## 📁 Estructura de Archivos (actualizada V25)

> Nota: las secciones siguientes describen la estructura tal como era en
> versiones anteriores. Esta sección refleja el estado real a fecha
> 12/06/2026 (25 archivos `.js`, ~19.400 líneas).

### Núcleo
```
BasketballRPE-Web/
├── 📄 index.html           → Estructura HTML, modales, carga de scripts
├── 🎨 styles.css           → Estilos, variables CSS (incluye dark mode)
├── ⚙️ app.js               → Núcleo: constructor RPETracker, sesiones,
│                              dashboard, navegación, modales, comparativas
├── 🔥 firebase-config.js   → Generado en deploy desde el secreto
│                              FIREBASE_CONFIG (no se commitea)
├── 🔥 firebase-config.TEMPLATE.js → Plantilla de referencia
├── 🔄 firebase-sync.js     → Acceso centralizado a Firebase
│                              (incluye loadWellnessPlayer,
│                              saveWellnessPlayer, onWellnessPlayerChange)
├── 🔐 security.js          → esc(), AppAlert, AppPrompt, AppConfirm,
│                              trapFocus()
├── 💾 store.js             → Utilidades de almacenamiento y fechas
│                              (toLocalISODate)
└── 📱 manifest.json + sw.js → PWA y Service Worker (caché v23+)
```

### Autenticación y roles
```
├── 🔑 auth.js              → Firebase Authentication, login, gestión
│                              de usuarios, roles staff/player
└── 👤 player-view.js       → Vista restringida para jugadoras
                               (wellness en /wellnessPlayer/{uid}/{date})
```

### Módulos funcionales
```
├── 📅 calendar.js              → Calendario de sesiones
├── 🏥 injury-management.js      → Gestión de lesiones
├── 🏥 injury-management-2.js    → Gestión de lesiones (parte 2)
├── 🔮 injury-prediction.js      → Predicción de riesgos
├── 📈 ewma-calculator.js        → Cálculo EWMA y ratio A:C
│                                   (con minSessions y confidence)
├── 📊 dashboard-renderer.js     → Renderizado del dashboard
├── 🩺 wellness.js               → Wellness staff + merge con
│                                   wellnessPlayer
├── 🗓️ weekplan-medical.js       → Planificación semanal (microciclo)
├── 🏋️ strength.js               → Gimnasio: plantillas, sesiones,
│                                   ejecución
├── 📋 anamnesis.js              → Anamnesis / historial médico
├── 📊 team-load.js              → Carga de equipo, comparativas
├── 🚦 team-status.js            → Estado general del equipo
├── 🎨 ui-helpers.js             → Modales dinámicos reutilizables
├── 📄 pdf-reports.js            → Generación de informes PDF (jsPDF)
├── 💾 backup.js                 → Backup y restauración (con
│                                   validación de estructura y tamaño)
└── 📊 chart.js                  → Wrapper de gráficos (Chart.js)
```

### Configuración y CI/CD
```
├── 🔥 firebase-rules.json   → Reglas de Firebase (incluye
│                               wellnessPlayer/$uid)
└── .github/workflows/
    └── deploy.yml           → Build + deploy a gh-pages, inyecta
                                firebase-config.js desde el secreto
                                FIREBASE_CONFIG (incluye firebaseAuth)
```

> `improvements.js` fue eliminado en V23 (módulo obsoleto).
> `sync-main.yml` fue eliminado (causaba bucle de sobrescritura de
> `firebase-config.js`).

---

## 🔐 Seguridad y Datos (actualizado V25)

### ¿Dónde se guardan los datos?

Todo en **Firebase Realtime Database**, en tiempo real y compartido
entre todos los usuarios conectados.

### ¿Quién puede acceder?

El proyecto usa **Firebase Authentication** (email/password) con dos
roles:

- **`staff`**: acceso completo (lectura/escritura de `sessions`,
  `players`, `wellness`, lesiones, planificación, gimnasio, etc.)
- **`player`**: acceso restringido vía la PWA. Solo puede leer/escribir
  su propio wellness en `/wellnessPlayer/{uid}/{date}`. No tiene acceso
  a `/sessions` ni `/players` en escritura.

Las reglas (`firebase-rules.json`) reflejan esta separación: `sessions`
y `players` restringidos a usuarios `staff`; `wellnessPlayer/$uid`
permite lectura/escritura solo al propio `$uid` (más lectura para
staff).

⚠️ **Importante**: la API key de Firebase es pública por diseño (no es
un secreto), pero `firebase-config.js` no se commitea — se genera en
cada deploy desde el secreto `FIREBASE_CONFIG` de GitHub Actions, lo
que facilita rotar la key si fuera necesario (ya se hizo una vez tras
detectarla en el historial de Git).

### Notas sobre el flujo de deploy

- La rama `main` contiene el código fuente y los workflows.
- El workflow `deploy.yml` (disparado por `push` a `main`) genera
  `firebase-config.js` con el secreto y publica el contenido en la
  rama `gh-pages` usando `peaceiris/actions-gh-pages`.
- **GitHub Pages debe estar configurado como "Deploy from a branch:
  gh-pages"** (no "GitHub Actions"), ya que el método de publicación
  usado es un push directo a esa rama, no el flujo nativo
  `actions/deploy-pages`.
- No debe existir ningún workflow que sincronice `gh-pages → main`:
  causaría que el `firebase-config.js` generado (un artefacto) se
  cuele en el código fuente y provoque deploys inconsistentes.

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

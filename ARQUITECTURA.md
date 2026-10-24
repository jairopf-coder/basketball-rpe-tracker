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

## 📁 Estructura de Archivos (actualizada 14/10/2026)

> Esta sección refleja el estado real a 14/10/2026: 38 archivos `.js`
> propios (~28.300 líneas), 20 ficheros de test y 2 workflows.
> Todos los `.js` se cargan como **scripts clásicos** desde `index.html` (sin
> módulos ni compilación): **el orden de las etiquetas `<script>` importa** y
> casi todo cuelga de `RPETracker.prototype` o de variables globales (`esc`,
> `Store`, `AppAuth`, `SafeData`...).

### Núcleo
```
BasketballRPE-Web/
├── 📄 index.html            → Estructura HTML, modales, carga de scripts
├── 🎨 styles.css            → Estilos, variables CSS (incluye dark mode)
├── ⚙️ app.js                → Núcleo: constructor RPETracker, navegación,
│                               carga de sesiones por ventana de temporada
├── 📅 app-sessions.js       → Sesiones de equipo: alta, listado, detalle
├── 👥 app-players.js        → Jugadoras: alta, edición, listado
├── 📈 app-analytics.js      → Analíticas: evolución, A:C, Foster, plan vs real
├── 🆚 app-comparisons.js    → Comparativas entre jugadoras
├── 🚦 app-presession.js     → Pre-sesión: readiness y semáforo
├── 🔄 firebase-sync.js      → Acceso centralizado a Firebase. Incluye el
│                               motor de escritura por diferencias (SyncDiff)
├── 🔐 security.js           → esc(), SafeData, csvCell(), AppAlert,
│                               AppPrompt, AppConfirm, trapFocus()
├── 💾 store.js              → Capa de localStorage y fechas
├── 🔥 firebase-config.js    → Generado en el deploy desde el secreto
│                               FIREBASE_CONFIG (no se commitea)
├── 🔥 firebase-config.TEMPLATE.js → Plantilla de referencia
└── 📱 manifest.json + sw.js → PWA y Service Worker (la versión de caché la
                                sella el deploy: v143 → v143-bNN)
```

### Autenticación, roles y vista de jugadora
```
├── 🔑 auth.js              → Firebase Authentication, login, gestión de
│                              usuarios, roles staff / fisio / player
├── 👤 player-view.js       → Vista restringida de la jugadora (wellness en
│                              /wellnessPlayer, RPE en /playerRpeReports)
├── 🌐 player-i18n.js       → Traducciones ES/EN de las pantallas de jugadora
└── 🔔 push-client.js       → Avisos push en el móvil de la jugadora
                               (permiso y suscripción)
```

### Módulos funcionales
```
Carga y analítica
├── 📈 ewma-calculator.js        → EWMA y ratio A:C (minSessions, confidence)
├── 📊 dashboard-renderer.js     → Dashboard
├── 🆚 dashboard-comparison.js   → Comparativa A:C + wellness, radar
├── 📊 team-load.js              → Mapa de calor de carga del equipo
├── 🚦 team-status.js            → Disponibilidad para el partido
├── 🔮 injury-prediction.js      → Predicción de riesgo
├── 📡 gps-tracking.js           → Importación de GPS (CSV de Oli Sports)
├── 📡 gps-tracking-analytics.js → Pantalla de analítica GPS
├── 📡 gps-intensity-index.js    → Índice de intensidad objetiva (0-100)
├── 📡 gps-injury-signal.js      → Señal de divergencia GPS/RPE
└── 📊 chart.js                  → Wrapper de gráficos

Salud
├── 🏥 injury-management.js      → Lesiones y retorno a la competición
├── 🏥 injury-management-2.js    → Lesiones (parte 2): disponibilidad, notas
├── 📋 anamnesis.js              → Anamnesis / historial médico
└── 🩺 wellness.js               → Wellness del staff + mezcla con lo que
                                    envían las jugadoras

Planificación y entrenamiento
├── 🗓️ weekplan-medical.js       → Planificación semanal
├── 📆 microciclo.js             → Carga-Microciclo: comparador de semanas y
│                                   tabla Jugadora × Día (solo lectura)
├── 📅 calendar.js               → Calendario y bloques de temporada
├── 🎯 objectives.js             → Próximos partidos
└── 🏋️ strength.js               → Gimnasio y tests físicos

Datos, informes y privacidad
├── 📄 pdf-reports.js            → Informes PDF
├── 📤 export-fisio.js           → Exportación .xlsx para la app del fisio
│                                   (usa xlsx.mini.min.js, solo lectura)
├── 💾 backup.js                 → Backup y restauración
├── 🗑️ player-data.js            → Copia JSON y eliminación completa de los
│                                   datos de una jugadora (solo staff)
└── 🎨 ui-helpers.js             → Modales dinámicos reutilizables
```

### Configuración, CI/CD y scripts
```
├── 🔥 firebase-rules.json   → Reglas de Firebase (se publican a mano en la
│                               consola: Realtime Database → Reglas)
├── .github/workflows/
│   ├── deploy.yml           → Genera firebase-config.js, sella la versión de
│   │                           sw.js y publica en gh-pages
│   └── enviar-recordatorio.yml → Aviso push a las jugadoras; se lanza a mano
│                                  desde la pestaña Actions de GitHub
└── scripts/                 → send-reminders.js (solo en CI; usa npm:
                                firebase-admin y web-push)
```

### Tests y documentación
```
├── test/                    → 20 ficheros `*.test.js` sin framework:
│                               node test/<nombre>.test.js
│     · reglas:      firebase-rules.test.js, firebase-rules-validate.test.js
│                    (este último usa targaryen si está instalado fuera del
│                    proyecto: npm install --prefix ~/.rpe-tools targaryen)
│     · seguridad:   xss-guard, xss-lote1/2/3, auth-user-list
│     · datos:       sync-diff, player-data, player-rpe-inbox
│     · despliegue:  deploy-version, reminders, push-client
│     · resto:       bottom-nav, ewma-and-dates, export-fisio, oli-id,
│                    pending-today, wellness-period, wellness-scale
└── 📚 README, CHANGELOG, CHECKLIST, INSTRUCCIONES-FIREBASE, deploy,
       GITHUB_GUIDE, GUIA-EXPORT-FISIO, INJURY_MODULE_GUIDE, CONTRIBUTING
```

> `improvements.js` fue eliminado en V23 (módulo obsoleto).
> `sync-main.yml` fue eliminado (causaba bucle de sobrescritura de
> `firebase-config.js`).

---

## 🔐 Seguridad y Datos (actualizado 14/10/2026)

### ¿Dónde se guardan los datos?

Todo en **Firebase Realtime Database**, en tiempo real y compartido entre
todos los dispositivos. Cada dispositivo guarda además una copia en
`localStorage` (para arrancar sin conexión), que se sustituye por lo que
llega de Firebase en cuanto sincroniza.

### ¿Quién puede acceder?

**Firebase Authentication** (email/contraseña) con tres roles, guardados en
`/users/{uid}/role`:

| Rol | Qué puede hacer |
|---|---|
| `staff` | Todo: datos del equipo, gestión de usuarios, eliminar jugadoras y sus datos |
| `fisio` | Lo mismo que el staff sobre los datos del equipo, pero no lee `/users` ni elimina jugadoras |
| `player` | Solo enviar su propio wellness (`/wellnessPlayer/{uid}`) y RPE (`/playerRpeReports/{uid}`) |

Una cuenta **sin rol no puede hacer nada**. Es importante porque la clave de
Firebase es pública y cualquiera puede crear una cuenta con ella: la
seguridad real está en las reglas.

### Reglas de Firebase (`firebase-rules.json`)

- **Lista blanca**: cada nodo (y el comodín `$other`) exige
  `role === 'staff' || role === 'fisio'`. Nunca se usa "distinto de player".
- **Validación (`.validate`)** en lo que pueden escribir las jugadoras:
  tipos y rangos, clave de fecha `AAAA-MM-DD`, turno `morning|afternoon|match`,
  `uid`/`date`/`sessionType` coherentes con la ruta y `playerId` igual al
  vinculado en `/users/{uid}` (staff y fisio exentos). En `users`, `role` solo
  admite `staff|fisio|player`.
- El staff puede **borrar** (no leer ni escribir) `pushSubscriptions` y
  `pushStatus`, para poder eliminar a una jugadora por completo.
- Las reglas **se publican a mano** en la consola (Realtime Database →
  Reglas) copiando el fichero entero. Antes de publicar, guarda una copia de
  las actuales. Se pueden probar en el Simulador de la consola y con
  `test/firebase-rules*.test.js`.
- ⚠️ Nunca publiques reglas abiertas (`".read": true`) ni el modo de prueba:
  son datos de salud.

### Reglas de oro al escribir HTML y exportar datos

1. Todo texto que venga de datos (nombres, dorsales, notas, rivales...) va con
   `esc()` al meterlo en HTML, en texto y en atributos entre comillas.
2. **Nunca `esc()` dentro de un `onclick="..."`**: se pasa solo un id y el
   dato se lee de memoria (ejemplo: `AppAuth._umEdit(uid)`).
3. No escapar dos veces: `showToast` usa `textContent`, `AppConfirm` ya
   escapa título y mensaje, y `getLocationName()` ya devuelve texto escapado.
4. Lo que escriben las jugadoras se trata como **no fiable**: se limpia con
   `SafeData` al leerlo, y el uid sale de la ruta, no del contenido.
5. En CSV, cada celda de texto pasa por `csvCell()` (evita fórmulas de Excel).
6. `test/xss-guard.test.js` lleva un contador de interpolaciones con
   `name`/`displayName`/`email` sin `esc()`: solo puede bajar.

### Eliminar una jugadora y todos sus datos

`player-data.js` (solo `staff`). Lee de Firebase todo lo que hay de ella (la
misma lectura sirve para el recuento, la copia JSON y el borrado), pide
confirmar escribiendo su nombre y borra colección a colección. La ficha y
las cuentas se borran las últimas y solo si todo salió bien (si algo falla se
puede reintentar). **Queda un paso manual**: eliminar su cuenta en Firebase
Authentication, porque el cliente no puede borrar cuentas ajenas.

⚠️ **Importante**: la API key de Firebase es pública por diseño (no es un
secreto), pero `firebase-config.js` no se commitea: se genera en cada deploy
desde el secreto `FIREBASE_CONFIG` de GitHub Actions, lo que facilita rotar la
key si fuera necesario (ya se hizo una vez tras detectarla en el historial de
Git).

### Notas sobre el flujo de deploy

- La rama `main` contiene el código fuente y los workflows.
- El workflow `deploy.yml` (disparado por `push` a `main`) genera
  `firebase-config.js` con el secreto, **sella la versión del service worker**
  (`CACHE_VERSION` de `sw.js`: `v143` se publica como `v143-bNN`, con NN el
  número de ejecución; ya no hay que subirla a mano) y publica el contenido en
  la rama `gh-pages` usando `peaceiris/actions-gh-pages`. Para comprobar un
  despliegue: `curl -s <url>/sw.js | grep CACHE_VERSION`.
- **GitHub Pages debe estar configurado como "Deploy from a branch:
  gh-pages"** (no "GitHub Actions"), ya que el método de publicación usado es
  un push directo a esa rama, no el flujo nativo `actions/deploy-pages`.
- No debe existir ningún workflow que sincronice `gh-pages → main`: causaría
  que el `firebase-config.js` generado (un artefacto) se cuele en el código
  fuente y provoque deploys inconsistentes.

---

## ⚡ Características Técnicas

### Sincronización en Tiempo Real
```javascript
// Cuando cambian las lesiones en Firebase (ejemplo)
firebaseSync.onInjuriesChange((injuries) => {
    // Todos los dispositivos reciben esta actualización
    updateUI(injuries);
});
```

### Escritura por diferencias (`firebase-sync.js`)

Al guardar, la app **no reescribe la colección entera**: compara con lo último
que sabe del servidor y envía solo lo que ha cambiado (`update()`, con `null`
para lo borrado). Así dos dispositivos que editan elementos distintos no se
pisan, y uno desfasado no revierte los cambios de otro.

| Tipo | Colecciones |
|---|---|
| Por elemento (`id`) | `injuries`, `clinicalNotes`, `players`, `gymSessions`, `testSessions`, `seasonBlocks`, `matches`, `sessions`, `wellness` |
| Por ruta anidada | `availability` (jugadora/fecha), `weekPlan` (`weeks/<lunes>`), `gpsData` (sesión/jugadora) |
| `set()` completo | `exerciseLibrary`, `gymTemplates`, `templates` (listas pequeñas), `anamnesis` (por jugadora) |

Cómo funciona por dentro (por colección, en `_diffState`):
- `synced`: lo último recibido o escrito (forma canónica, sin `null`/`[]`).
- `loaded`: llegó la primera lectura. **Sin ella no se guarda nada** (aviso
  "Aún sincronizando…"), para no sobrescribir con una memoria vacía o antigua.
- `saving`: mientras hay un guardado en vuelo se ignoran las lecturas (igual
  que hace la app).
- Las sesiones se leen por **ventana de temporada**: lo anterior a la ventana
  se conserva en `synced` y en la copia local, y guardar no necesita descargar
  el histórico.
- Interruptor de emergencia: `DIFF_WRITES_ENABLED` en `firebase-sync.js`
  (`false` = vuelve al `set()` completo de siempre).
- Si una clave no sirve en Firebase (`.`, `$`, `#`, `[`, `]`, `/`) o dos rutas
  se solaparían, usa el camino de siempre (`set()`).
- Los tests están en `test/sync-diff.test.js` (Firebase falso con varios
  dispositivos).

### Modo Offline
- Si pierdes conexión, la app sigue funcionando con la copia de `localStorage`
- Los guardados que fallan entran en una cola (IndexedDB) **como parches**, no
  como colecciones completas, y se reenvían al reconectar
- Si abres la app sin conexión y guardas antes de la primera lectura, el
  guardado se pospone con un aviso (no se pierde nada del servidor)

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

### Hecho
- [x] Notificaciones push (avisos a las jugadoras sin wellness/RPE)
- [x] Roles (`staff`, `fisio`, `player`)

### Pendientes conocidos
- [ ] **Contraseñas de las cuentas**: hoy el staff escribe la contraseña
  inicial a la vista y la lista de cuentas de la sesión la muestra y la copia.
  Se decidió no forzar el cambio en el primer acceso porque, con correos
  `@rpe.app` (que no reciben mensajes), una contraseña olvidada no se puede
  recuperar. Retomarlo exige antes un camino de recuperación.
- [ ] Reorganizar los `.js` en carpetas por área (sin cambiar su comportamiento)
- [ ] `exerciseLibrary`, `gymTemplates` y `templates` siguen con `set()`
  completo (se guardan como listas por posición)
- [ ] Una sesión **anterior a la ventana de temporada** eliminada en otro
  dispositivo puede seguir viéndose en uno que tenga el histórico completo
  cargado, hasta que recargue (no se vuelve a guardar)
- [ ] CSP, SRI y `defer` en los scripts de terceros: poco beneficio con las
  versiones fijadas que se usan y riesgo real de romper el orden de carga
- [ ] Reconstruir el `CHANGELOG.md` entre la 3.0.0 y la 3.1.0

### Descartado por ahora
- Modularización (ES modules / empaquetador): ~28.000 líneas, cientos de
  `onclick` en línea y scripts clásicos; el riesgo supera el beneficio

### Ideas sin empezar
- [ ] Autenticación con Google
- [ ] Exportación automática a Google Sheets
- [ ] Integración con smartwatches
- [ ] Chat entre entrenadores
- [ ] Integración con sistemas de monitorización (Catapult, etc.)
- [ ] API para terceros
- [ ] App nativa iOS/Android

---

## 📞 Soporte Técnico

### Stack Tecnológico
- **Frontend:** Vanilla JavaScript (ES6+)
- **Backend:** Firebase Realtime Database
- **Hosting:** GitHub Pages
- **Build:** Ninguno (no requiere compilación)
- **Package Manager:** Ninguno en la app (sin dependencias npm). Solo `scripts/` (avisos push, ejecutado en GitHub Actions) usa npm

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

# 📝 Changelog - Basketball RPE Tracker

## [3.1.0] - 2026-10-14 — Auditoría externa de octubre: seguridad, integridad de datos y privacidad

Una auditoría externa (informe del 2026-10-02: 4 hallazgos críticos, 7 altos,
9 medios y 6 bajos) se contrastó punto por punto con el código real. Se
corrigieron todos los que se confirmaron. Dos no se sostenían: la
configuración real de Firebase ya no se versiona (`.gitignore`) y `test/` ya
se excluía del despliegue. Se trabajó por fases, cada una confirmada en
producción antes de la siguiente.

> Nota: los cambios entre la 3.0.0 (junio) y esta versión (avisos push a las
> jugadoras, exportación para el fisio, vista de iPhone, GPS, etc.) no se
> registraron en este archivo.

### 🔐 Seguridad
- **Reglas de Firebase en lista blanca** (`firebase-rules.json`): todos los
  nodos, incluido el comodín `$other`, exigen explícitamente rol `staff` o
  `fisio`. Antes bastaba con *no ser* `player`, así que cualquier cuenta sin
  rol (la clave de Firebase es pública y cualquiera puede crear una cuenta)
  leía y escribía lesiones, notas clínicas y wellness. Nodo `matches` con
  regla explícita.
- **Reglas `.validate`** en `wellnessPlayer`, `playerRpeReports` y `users`:
  tipos y rangos, clave de fecha `AAAA-MM-DD`, turno `morning|afternoon|match`,
  `uid`/`date`/`sessionType` iguales a los de la ruta, `playerId` igual al
  vinculado en `/users` (staff y fisio exentos), `role` solo
  `staff|fisio|player` y longitudes máximas.
- **Datos que escriben las jugadoras** (`SafeData` en `security.js`): lo que
  llega de `/wellnessPlayer` y `/playerRpeReports` se valida al leerlo (números
  reales en rango, fechas y turnos válidos, el uid sale de la ruta y no de la
  entrada). Cerraba un XSS desde una cuenta de jugadora a la bandeja de RPE
  pendientes del staff.
- **XSS**: `esc()` escapa ahora también `"` y `'`. Barrido de nombres,
  dorsales y textos libres sin escapar en lesiones, notas clínicas, gimnasio,
  informes PDF, wellness, dashboard, estado del equipo, plan médico,
  partidos, selectores y gestión de usuarios. Regla de oro nueva: **nunca
  `esc()` dentro de un `onclick="..."`** (el navegador decodifica las
  entidades antes de ejecutarlo); se pasa solo un id y el dato se lee de
  memoria.
- **Exportación CSV**: `csvCell()` duplica comillas y antepone `'` a los
  valores que empiezan por `=`, `+`, `-`, `@` para que Excel no los ejecute
  como fórmula.
- `AppConfirm` admite `requireText` (confirmar escribiendo un texto) para
  acciones irreversibles.
- `INSTRUCCIONES-FIREBASE.md` (Parte 4) ya no manda publicar reglas abiertas ni
  usar el modo de prueba; `CHECKLIST.md` y `README.md` corregidos.

### 🧬 Integridad de datos (escritura por diferencias)
- `firebase-sync.js` deja de reescribir colecciones enteras con `set()`:
  compara con lo último sincronizado y envía solo lo que cambió (`update()`
  con `null` para los borrados). Dos dispositivos que editan elementos
  distintos ya no se pisan, y uno desfasado no revierte lo ajeno.
  - Por elemento (`id`): `injuries`, `clinicalNotes`, `players`,
    `gymSessions`, `testSessions`, `seasonBlocks`, `matches`, `sessions`,
    `wellness`.
  - Por ruta anidada: `availability` (jugadora/fecha), `weekPlan`
    (`weeks/<lunes>`), `gpsData` (sesión/jugadora) y `gpsPlayerMap`.
  - Siguen con `set()`: `exerciseLibrary`, `gymTemplates`, `templates`
    (listas pequeñas) y `anamnesis` (ya va por jugadora).
- **No se guarda nada antes de la primera lectura** de cada colección (aviso
  "Aún sincronizando…"), como ya hacía wellness desde la v124.
- Interruptor de emergencia `DIFF_WRITES_ENABLED` (`firebase-sync.js`): en
  `false` vuelve al `set()` completo de siempre.
- La cola offline guarda **parches** (`mode: 'patch'`) en lugar de fotos
  completas de la colección.
- **Sesiones**: guardar ya no descarga el histórico completo
  (`app.js` consulta `firebaseSync.diffWrites`). La copia local conserva lo
  anterior a la ventana de temporada. La fusión del histórico ya no mantiene
  sesiones de la ventana borradas en otro dispositivo (antes podían
  reaparecer al guardar).
- Eliminado código muerto que sobrescribiría Firebase con el almacenamiento
  local: `migrateFromLocalStorage` y `migrateStrengthData`. La guía de
  instalación indica ahora "Restaurar backup" para pasar datos antiguos.

### 🗑️ Privacidad
- **Eliminar una jugadora borra todos sus datos** (`player-data.js`, nuevo),
  solo para el rol `staff`: sesiones, wellness, lesiones, notas clínicas,
  gimnasio, tests, disponibilidad, GPS y su emparejamiento, anamnesis, lo que
  envió desde su cuenta, avisos push, cuentas (`/users`) y ficha.
  - Ofrece antes una **copia en JSON** de sus datos.
  - Pide **escribir su nombre** para confirmar y muestra el recuento de lo
    que se borrará.
  - La ficha y las cuentas se borran las últimas y solo si todo lo anterior
    salió bien: si algo falla, la jugadora sigue en la lista y se puede
    reintentar.
  - Las reglas dejan al staff **borrar** (no leer ni escribir)
    `pushSubscriptions` y `pushStatus`.
  - Queda un paso manual: eliminar su cuenta en Firebase Authentication.

### 🚀 Despliegue y mantenimiento
- `deploy.yml` **sella `CACHE_VERSION`** de `sw.js` con un sufijo único por
  despliegue (`v143` se publica como `v143-b215`): ya no hay que subir la
  versión a mano. Si el formato de `sw.js` cambia, avisa y no rompe el
  despliegue.
- Quitado el bloque de depuración "TEMPORAL" de `index.html`.
- Documentación actualizada (`ARQUITECTURA.md`, `INSTRUCCIONES-FIREBASE.md`,
  `CHECKLIST.md`, `README.md`).

### 🧪 Tests
- 20 ficheros de test en `test/` (se ejecutan con `node test/<nombre>.test.js`).
  Nuevos en esta versión: `firebase-rules.test.js` y
  `firebase-rules-validate.test.js` (reglas; el segundo usa `targaryen` si
  está instalado fuera del proyecto), `xss-guard.test.js` (contador que no
  deja aumentar los textos sin escapar), `xss-lote1/2/3.test.js`,
  `auth-user-list.test.js`, `sync-diff.test.js` (escritura por diferencias con
  un Firebase falso de varios dispositivos), `player-data.test.js` y
  `deploy-version.test.js`.

### ⏸️ Decisiones y pendientes
- **Contraseñas de las cuentas**: se deja como está. Las cuentas usan correos
  `@rpe.app` (no reciben mensajes), así que forzar un cambio de contraseña
  dejaría sin recuperación a quien la olvide.
- **Modularización** (ES modules / empaquetador): descartada por ahora; el
  coste y el riesgo superan el beneficio.
- El resto de pendientes de mantenimiento está en `ARQUITECTURA.md`
  (sección "Pendientes conocidos").

---

## [3.0.0] - 2026-06-12 — Auditoría V23-V25: seguridad, accesibilidad y estabilidad

Tras una auditoría completa que identificó 97 bugs (17 críticos, 31 altos,
49 medios/bajos), se ha cerrado el 100% de los hallazgos en esta serie de
entregas.

### 🔐 Seguridad
- Corregidos ~122 vectores XSS mediante `esc()` en `app.js`,
  `injury-management.js`, `injury-management-2.js`, `wellness.js`,
  `weekplan-medical.js`, `calendar.js`, `anamnesis.js`,
  `dashboard-renderer.js`, `ui-helpers.js`, `injury-prediction.js`,
  `strength.js`, `pdf-reports.js`, `team-status.js`, `auth.js`. Incluye
  nombres de jugadoras en tablas, modales, gráficos y elementos
  `<option>` de selects (BUG-086).
- `PlayerTokens.avatar()` y helpers `getTypeName()` / `getLocationName()`
  escapan su salida por defecto.
- Sustituidos `alert()` y `prompt()` nativos (incompatibles con PWA en
  iOS) por `AppAlert` y `AppPrompt` (nuevos componentes en `security.js`).
- Migración completa de `Authentication` basada en PIN a **Firebase
  Authentication** (email/password), con roles `staff` (acceso completo)
  y `player` (solo wellness, acceso restringido vía PWA).
- Contraseña mínima de 8 caracteres (BUG-027).
- Rotada la API key de Firebase expuesta en el historial público
  (BUG-005); el secreto `FIREBASE_CONFIG` de GitHub Actions actualizado.
- Reglas de Firebase (`firebase-rules.json`) endurecidas: `sessions` y
  `players` restringidos a usuarios `staff`; nuevo nodo
  `wellnessPlayer/$uid` con permisos de escritura propios para cada
  jugadora.

### ♿ Accesibilidad (WCAG 2.1 AA)
- Todos los modales (estáticos y dinámicos) incluyen
  `role="dialog"`, `aria-modal="true"` y `aria-labelledby`.
- Trampa de foco (`trapFocus`) y cierre con tecla `Escape` en todos los
  modales.
- Prevención de duplicados en el DOM al reabrir modales dinámicos
  (gestor de plantillas, panel de estadísticas avanzadas, modal de día
  del calendario, modal de ejecución de gimnasio).

### 🩺 Wellness de jugadoras — nuevo flujo de datos
- Las jugadoras ya no escriben en `/wellness/{uid}/{date}` (bloqueado
  por las nuevas reglas), sino en **`/wellnessPlayer/{uid}/{date}`**
  (`player-view.js`).
- `firebase-sync.js` añade `loadWellnessPlayer()`,
  `saveWellnessPlayer()` y `onWellnessPlayerChange()`.
- `wellness.js` mezcla en tiempo real los registros de
  `/wellnessPlayer` con los datos de wellness del staff, usando IDs
  sintéticos (`wp_{uid}_{date}`) y marca `source: 'player'`, evitando
  duplicados por fecha+jugadora.

### 📊 Cálculo de carga (EWMA / Ratio A:C)
- `calculateAcuteChronicRatio()` exige un mínimo de **7 sesiones** en
  los últimos 28 días (umbral conservador basado en Hulin et al. 2016)
  antes de calcular un ratio fiable.
- Si no se alcanza el mínimo, devuelve `{ ratio: 'N/A', confidence:
  'low', message: 'Datos insuficientes' }`.
- El dashboard muestra el badge **"⚠️ Insuf."** y suprime alertas de
  riesgo cuando `confidence === 'low'`.
- Filtrado de sesiones con `load` no numérico o ≤ 0 antes del cálculo
  de `seedLoad` y del bucle EWMA (evita `NaN` en el ratio).

### ✅ Tests unitarios (nuevo)
- `test/ewma-and-dates.test.js`: suite sin dependencias externas
  (solo `assert` de Node) que cubre `toLocalISODate()` y
  `calculateAcuteChronicRatio()` — incluyendo el guard de
  `minSessions=7`, el filtrado de cargas inválidas (NaN/0/negativas),
  el multiplicador de partido (1.5x) y los umbrales por jugadora.
  Ejecutar con `node test/ewma-and-dates.test.js`.

### 🕐 Zona horaria / fechas
- Nueva utilidad global `toLocalISODate()` en `store.js`, que evita el
  bug clásico de `new Date('YYYY-MM-DD')` (interpretado como medianoche
  UTC, lo que desplazaba un día en zonas horarias negativas).
- Aplicada en `calendar.js`, `app.js`, `weekplan-medical.js` y
  `strength.js`. Para cálculos aritméticos con fechas string se usa el
  sufijo `T12:00:00` como ancla segura.

### 🛡️ Validación y robustez de formularios
- Protección contra doble envío en "Sesión de equipo" (`app.js`,
  flag `_savingTeamSession`) y en "Sesión de gimnasio" (`strength.js`,
  flag `_savingGymSession`).
- `handlePlayerSubmit`: nombre obligatorio (trim, máx. 60 caracteres,
  `maxlength="60"` en `index.html`), aviso de nombre duplicado
  (case-insensitive) vía `AppConfirm`, y dorsal validado entre 0 y 99.
- Restauración de copia de seguridad (`backup.js`): valida extensión
  `.json`, tamaño máximo de 10 MB y estructura mínima de `players` y
  `sessions` antes de importar.

### 🧹 Limpieza de estado / navegación
- `weekOffset` del planificador semanal limitado a ±2 años / +1 año
  (`weekplan-medical.js`).
- Navegación de semanas en `team-load.js` acotada a un rango razonable.
- Al salir de la vista de gimnasio (`switchView`), se limpia
  `_gymSub`, `_gymFilter` y `_gymPlayerId` si la jugadora ya no existe.
- El modal de ejecución de gimnasio resetea `_execDraft` y
  `_execSessions` al cerrarse, evitando arrastrar datos de una sesión a
  otra.

### 🧰 Service Worker e infraestructura
- Eliminado `improvements.js` (módulo obsoleto) de la caché del SW;
  versión de caché incrementada a `v23`.
- Workflow de despliegue (`.github/workflows/deploy.yml`) corregido:
  genera `firebase-config.js` a partir del secreto `FIREBASE_CONFIG`
  incluyendo `window.firebaseAuth = firebase.auth();` (sin esto, el
  login fallaba con "firebaseAuth no disponible").
- Eliminado el workflow `sync-main.yml` (creaba un bucle
  `gh-pages → main → gh-pages` que sobrescribía `firebase-config.js`
  con versiones desactualizadas).
- GitHub Pages configurado para servir directamente desde la rama
  `gh-pages` (Source: "Deploy from a branch"), compatible con el
  método de publicación `peaceiris/actions-gh-pages` usado por el
  workflow.

---

## [2.0.0] - 2026-03-14

### 🎉 Funcionalidades Principales Añadidas

#### 1️⃣ **Selector Visual de Jugadoras**
- Reemplazado menú desplegable por botones grandes
- Avatar con inicial del nombre
- Selección con un solo clic
- Feedback visual de selección

#### 2️⃣ **Registro Optimizado de Sesiones**
- Fecha automática (modificable)
- Selector Mañana/Tarde en lugar de hora exacta
- Botones rápidos de duración (30', 45', 60', 75', 90', 120')
- Campo personalizado para otras duraciones
- Interfaz más rápida y eficiente

#### 3️⃣ **Método EWMA Científico**
- Implementación completa del método EWMA
- λ aguda = 0.25 (ventana de 7 días)
- λ crónica = 0.069 (ventana de 28 días)
- Cálculo correcto: Carga = RPE × Duración
- Más preciso que promedio simple

#### 4️⃣ **Gráficos de Evolución**
- Gráfico de línea temporal (30 días) por jugadora
- Zonas de color de fondo:
  - Azul: < 0.8 (descarga)
  - Verde: 0.8-1.3 (óptimo)
  - Naranja: 1.3-1.5 (precaución)
  - Rojo: > 1.5 (peligro)
- Canvas nativo (sin librerías externas)

#### 5️⃣ **Alertas Automáticas**
- Alerta Roja (🚨): Ratio > 1.5
- Alerta Naranja (⚠️): Ratio 1.3-1.5
- Alerta Azul (ℹ️): Ratio < 0.8
- Aparecen en Dashboard y Análisis

#### 6️⃣ **Recomendaciones Inteligentes**
- Sugerencias automáticas de carga para próxima sesión
- RPE y duración recomendados
- Consejos personalizados según ratio:
  - Reducción de carga (ratio alto)
  - Mantenimiento (ratio óptimo)
  - Incremento gradual (ratio bajo)

#### 7️⃣ **Comparativa Visual**
- Gráfico de barras comparando jugadoras
- Ranking automático por ratio
- Tarjetas individuales con recomendaciones
- Código de colores por nivel de riesgo

#### 8️⃣ **Backup & Restore**
- Descargar backup completo (JSON)
- Restaurar desde archivo
- Migración entre dispositivos
- Protección contra pérdida de datos

#### 9️⃣ **Exportar a CSV/Excel**
- Exportación completa de sesiones
- Hoja de resumen por jugadora
- Compatible con Excel, Google Sheets
- Archivo con fecha automática

---

## [1.0.0] - 2026-03-03

### ✨ Lanzamiento Inicial

#### Funcionalidades Base
- Registro de sesiones con RPE (1-10)
- Gestión de jugadoras
- Tipos de sesión (Entrenamiento/Partido)
- Campo de incidencias
- Cálculo básico de ratio Agudo:Crónico
- Dashboard del equipo
- Persistencia local (localStorage)
- PWA con funcionalidad offline

#### Características Técnicas
- HTML5 + CSS3 + JavaScript vanilla
- Sin dependencias externas
- Service Worker para offline
- Diseño responsive

---

## 🔮 Próximas Versiones

### [2.1.0] - Planificado
- [ ] Sincronización en la nube (Firebase/Supabase)
- [ ] Notificaciones push
- [ ] Modo oscuro
- [ ] Multi-idioma (EN, PT)

### [3.0.0] - Futuro
- [ ] Integración con wearables
- [ ] Predicción de lesiones con ML
- [ ] Informes PDF automáticos
- [ ] Calendario de planificación

---

## 📊 Estadísticas del Proyecto

- **Versión**: 3.1.0
- **Líneas de código JS**: ~28,300 (38 archivos `.js` propios)
- **Dependencias**: 0 (Chart.js y SDK de Firebase vía CDN)
- **Autenticación**: Firebase Authentication (roles `staff` / `fisio` / `player`)
- **Navegadores soportados**: Safari 14+, Chrome 90+, Firefox 88+, Edge 90+

---

## 🐛 Bugs Corregidos

### v2.0.0
- ✅ Cálculo incorrecto de ratio (ahora usa EWMA)
- ✅ Falta de duración en sesiones antiguas (asume 60 min)
- ✅ Selector de jugadoras lento (ahora visual)
- ✅ Interfaz de registro poco eficiente (optimizada)

### v1.0.0
- Versión inicial

---

## 📚 Referencias Científicas

### Método EWMA
- Gabbett, T. J. (2016). "The training-injury prevention paradox: should athletes be training smarter and harder?" *British Journal of Sports Medicine*
- Murray, N. B., et al. (2017). "Calculating acute:chronic workload ratios using exponentially weighted moving averages provides a more sensitive indicator of injury likelihood than rolling averages" *British Journal of Sports Medicine*

### sRPE
- Foster, C., et al. (2001). "A new approach to monitoring exercise training" *Journal of Strength and Conditioning Research*

---

## 👥 Contribuidores

- **Desarrollo Principal**: Creado para entrenadoras de baloncesto
- **Metodología**: Basada en investigación científica deportiva
- **Diseño**: Optimizado para uso en iPad

---

## 📄 Licencia

MIT License - Ver [LICENSE](LICENSE) para más detalles

---

**Última actualización**: 12 de Junio, 2026

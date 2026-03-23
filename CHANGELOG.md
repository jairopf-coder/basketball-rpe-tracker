# 📝 Changelog - Basketball RPE Tracker

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

- **Versión**: 2.0.0
- **Líneas de código**: ~3,500
- **Archivos**: 11
- **Tamaño**: ~50 KB (sin comprimir)
- **Dependencias**: 0
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

**Última actualización**: 14 de Marzo, 2026

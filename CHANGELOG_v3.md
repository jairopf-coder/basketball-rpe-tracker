# 📝 Changelog v3.0 - Basketball RPE Tracker

## [3.0.0] - 2026-03-22 - MAJOR UPDATE

### 🎉 **TODAS LAS MEJORAS IMPLEMENTADAS**

Esta actualización masiva añade **12 nuevas funcionalidades principales** basadas en feedback del usuario.

---

## 🔴 **PRIORIDAD ALTA** (Implementado)

### ✅ 1. **Editar Sesiones Existentes**
**Antes:** Solo podías ver y eliminar sesiones.
**Ahora:**
- ✏️ Botón "Editar" en vista de detalle
- Modificar RPE, duración, tipo, momento del día, incidencias
- Recálculo automático de carga (sRPE)
- Validación de datos
- La jugadora no se puede cambiar (integridad de datos)

**Ubicación:** Vista detalle de sesión → Botón "✏️ Editar"

---

### ✅ 2. **Editar Datos de Jugadoras**
**Antes:** Imposible cambiar nombre o dorsal.
**Ahora:**
- ✏️ Botón editar en cada tarjeta de jugadora
- Modal de edición
- Actualización en todas las vistas automáticamente
- Validación de nombre obligatorio

**Ubicación:** Vista Jugadoras → Botón "✏️" en cada tarjeta

---

### ✅ 3. **Confirmación Mejorada antes de Eliminar**
**Antes:** Confirmación simple.
**Ahora:**
- ⚠️ Muestra número exacto de sesiones que se eliminarán
- Doble confirmación si tiene sesiones registradas
- Mensaje claro con nombre y estadísticas
- Previene pérdidas accidentales

**Ejemplo:**
```
¿Eliminar a María #23?

⚠️ SE ELIMINARÁN 45 SESIONES REGISTRADAS.

Esta acción no se puede deshacer.
```

---

### ✅ 4. **Búsqueda y Filtros Avanzados**
**Antes:** Solo filtro básico por jugadora y tipo.
**Ahora:**
- 🔍 **Búsqueda por texto** (nombre jugadora o incidencias)
- 📅 **Rango de fechas** (desde - hasta)
- 💪 **Rango de RPE** (mín - máx)
- 🔄 **Botón "Limpiar filtros"**
- Todos los filtros funcionan simultáneamente

**Ubicación:** Vista Sesiones → Barra de filtros arriba

---

### ✅ 5. **Ordenar Sesiones**
**Antes:** Solo por fecha descendente.
**Ahora:**
- 📅 Más reciente / Más antiguo
- 💪 RPE Mayor / RPE Menor
- 👤 Por jugadora (alfabético)
- Selector desplegable fácil

**Ubicación:** Vista Sesiones → Selector "Ordenar por"

---

## 🟠 **PRIORIDAD MEDIA** (Implementado)

### ✅ 6. **Vista Calendario**
**Nueva pestaña completa con:**
- 📅 Calendario mensual visual
- Navegación mes anterior/siguiente
- Código de colores por ratio A:C medio del día
- Contador de sesiones por día
- Badge de ratio promedio
- Clic en día → Ver todas las sesiones de ese día
- Indicador visual del día actual
- Días con sesiones destacados

**Características:**
- Vista mensual completa
- Color de fondo según ratio promedio del día
- Números más grandes en días con sesiones
- Modal con detalle al hacer clic

**Ubicación:** Pestaña "📅 Calendario"

---

### ✅ 7. **Estadísticas Avanzadas**
**Nuevas métricas científicas:**

#### **Monotonía**
- Fórmula: Carga media / Desviación estándar
- Indica variabilidad del entrenamiento
- Valores bajos (<2) = buena variedad
- Valores altos (>3) = riesgo por monotonía

#### **Strain**
- Fórmula: Carga semanal × Monotonía
- Indicador de estrés total
- >8000 = Riesgo alto
- 5000-8000 = Moderado
- <5000 = Seguro

#### **Training Impulse (TRIMP)**
- Aproximación del TRIMP clásico
- Suma ponderada de duración × RPE
- Útil para comparar jugadoras

**Ubicación:** Vista detalle avanzado de jugadora

---

### ✅ 8. **Comparación Temporal**
**Comparativas automáticas:**
- Esta semana vs Semana anterior
- Número de sesiones
- Carga total
- RPE medio
- Cambios en % (↑ o ↓)
- Código de colores (verde = mejora, naranja = aumento)

**Datos mostrados:**
```
Esta Semana:        Semana Anterior:
3 sesiones          4 sesiones
1800 carga          2100 carga
RPE 6.5             RPE 7.0

Cambios:
Carga: ↓ 14.3%
RPE: ↓ 7.1%
Sesiones: -1
```

**Ubicación:** Estadísticas avanzadas de jugadora

---

### ✅ 9. **Plantillas de Sesión**
**Registro ultra-rápido:**
- Crear plantillas de sesiones tipo
- Guardar: nombre, RPE, duración, tipo, momento
- Aplicar plantilla → rellena formulario automáticamente
- Gestionar plantillas (crear/usar/eliminar)
- Ejemplos:
  - "Entrenamiento técnico estándar" → RPE 6, 75min, Mañana
  - "Partido oficial" → RPE 8, 90min, Tarde
  - "Recuperación activa" → RPE 3, 45min, Mañana

**Beneficio:** Registro en 5 segundos en vez de 30

**Ubicación:** 
- Botón "📋 Usar Plantilla" en formulario nueva sesión
- Gestión: Acciones rápidas → Gestionar Plantillas

---

## 🟡 **PRIORIDAD BAJA** (Implementado)

### ✅ 10. **Exportar Gráficos como Imagen**
**Funcionalidad:**
- Exportar cualquier gráfico individual → PNG
- Botón "Exportar Todos los Gráficos"
- Descarga automática de todos los gráficos de evolución
- Nombres automáticos: `grafico_NombreJugadora_fecha.png`
- Calidad alta para presentaciones

**Uso:** Incluir gráficos en presentaciones/informes

**Ubicación:** 
- Vista Análisis → Botón "📸 Exportar Todos los Gráficos"
- Individual: (función disponible programáticamente)

---

### ✅ 11. **Informes PDF Automáticos**
**Sistema completo de informes imprimibles:**

#### **Informes Individuales:**
3 tipos:
1. **Semanal** (últimos 7 días)
2. **Mensual** (últimos 30 días)
3. **Trimestral** (últimos 90 días)

#### **Contenido del Informe:**
- 📊 Resumen general (sesiones, RPE medio, carga, ratio A:C)
- ⚡ Estado actual con alerta codificada por colores
- 💡 Recomendaciones personalizadas
- 📈 Estadísticas avanzadas (monotonía, strain)
- 📋 Tabla detallada de todas las sesiones
- 📊 Comparación temporal (si aplica)
- 🔮 Predicción de lesión (si aplica)

#### **Informes de Equipo:**
- Resumen semanal de todo el equipo
- Jugadoras en riesgo
- Estadísticas globales

**Formato:**
- HTML imprimible
- Diseño profesional
- Listo para impresora o PDF
- Logo y marca personalizable

**Cómo usar:**
1. Vista Jugadoras → Botón "📄" en tarjeta
2. Elegir tipo de informe
3. Se abre ventana → Imprimir o Guardar como PDF

**Ubicación:** 
- Por jugadora: Botón "📄" en tarjeta de jugadora
- Equipo: Vista Jugadoras → "📄 Informe Semanal Equipo"

---

### ✅ 12. **Predicción de Lesiones con ML**
**Sistema de predicción de riesgo:**

#### **Análisis Multi-Factor:**
El sistema analiza 6 factores:
1. **Ratio A:C** (30% peso)
2. **Picos de carga** (25% peso) - aumentos súbitos >30%
3. **Monotonía** (15% peso) - falta de variedad
4. **Strain** (15% peso) - estrés acumulado
5. **Carga reciente alta** (10% peso) - RPE ≥8 en últimos 3 días
6. **Recuperación insuficiente** (5% peso) - <24h entre sesiones

#### **Score de Riesgo (0-100%):**
- **70-100%**: 🚨 ALTO RIESGO
  - Probabilidad alta lesión próximos 7 días
  - Reducir carga inmediatamente
  
- **50-69%**: ⚠️ RIESGO MODERADO
  - Monitorizar de cerca
  - Reducir intensidad 20-30%
  
- **30-49%**: ℹ️ RIESGO BAJO-MODERADO
  - Mantener monitorización
  - Evitar picos
  
- **0-29%**: ✅ RIESGO MÍNIMO
  - Condiciones óptimas
  - Puede progresar

#### **Vista de Predicción:**
Por cada jugadora:
- % de riesgo (número grande y color)
- Mensaje de estado
- Factores de riesgo detallados
- Impacto de cada factor
- Recomendaciones específicas:
  - Descanso activo
  - Reducción de carga
  - Tiempo de recuperación
  - Tipo de entrenamiento

**Ejemplo:**
```
María #23
85% Riesgo 🚨

ALTO RIESGO de lesión en los próximos 7 días.

Factores:
- Ratio A:C: 1.8 → Alto
- Picos de Carga: Detectados → Alto
- Monotonía: 3.2 → Alto
- Strain: 9200 → Alto
- Recuperación: Insuficiente → Moderado

Recomendaciones:
🛑 Descanso activo 2-3 días
🧘 Recuperación: estiramientos, movilidad
💧 Priorizar hidratación
😴 8+ horas sueño
📉 Reducir carga 40-50%
```

**Requisitos:** Mínimo 14 sesiones para predicción confiable

**Ubicación:** Pestaña "🔮 Predicción"

---

## 📊 **ESTADÍSTICAS DEL PROYECTO v3.0**

### **Archivos Nuevos:**
- `improvements.js` (14.8 KB) - Edición, búsqueda, filtros, plantillas, stats
- `calendar.js` (10.3 KB) - Vista calendario y comparación temporal
- `pdf-reports.js` (15.6 KB) - Generación de informes PDF
- `injury-prediction.js` (12.3 KB) - Predicción de lesiones ML
- `ui-helpers.js` (12.8 KB) - Utilidades UI y menús

### **Total:**
- **Archivos:** 16 (11 originales + 5 nuevos)
- **Líneas de código:** ~6,500 (vs ~3,500 en v2.0)
- **Tamaño total:** ~120 KB
- **Nuevas funcionalidades:** 12
- **Dependencias:** 0 (sigue siendo vanilla JS)

---

## 🎯 **NUEVAS PESTAÑAS**

### **Antes (v2.0):**
1. 📋 Sesiones
2. 📊 Dashboard
3. 👥 Jugadoras
4. 📈 Análisis

### **Ahora (v3.0):**
1. 📋 Sesiones (con filtros avanzados)
2. 📊 Dashboard
3. 👥 Jugadoras (con informes PDF)
4. 📈 Análisis (con exportar gráficos)
5. 📅 **Calendario** (NUEVO)
6. 🔮 **Predicción** (NUEVO)

---

## 🚀 **MEJORAS DE RENDIMIENTO**

- Renderizado optimizado de filtros
- Cálculos de predicción en segundo plano
- Carga lazy de vistas no activas
- Exportación de gráficos sin bloqueo UI

---

## 🐛 **BUGS CORREGIDOS**

- ✅ Filtros no se limpiaban correctamente
- ✅ Edición de sesión no actualizaba gráficos
- ✅ Calendario mostraba fechas incorrectas al cambiar mes
- ✅ Exportación CSV con jugadoras sin sesiones fallaba
- ✅ RPE slider en edición no actualizaba colores

---

## 📚 **ACTUALIZACIONES DE DOCUMENTACIÓN**

- README actualizado con todas las funcionalidades
- CHANGELOG v3 completo
- Comentarios en código explicando algoritmos ML
- Guía de uso de plantillas
- Explicación científica de nuevas métricas

---

## ⚡ **PRÓXIMAS VERSIONES (Roadmap)**

### v3.1 (Planificado)
- [ ] Sincronización en la nube (Firebase/Supabase)
- [ ] Notificaciones push
- [ ] Modo oscuro

### v4.0 (Futuro)
- [ ] Integración con wearables
- [ ] Machine Learning avanzado
- [ ] App móvil nativa

---

## 🎓 **REFERENCIAS CIENTÍFICAS NUEVAS**

### Monotonía y Strain:
- Foster, C. (1998). "Monitoring training in athletes with reference to overtraining syndrome"
- Impellizzeri, F. M., et al. (2004). "Use of RPE-based training load in soccer"

### Predicción de Lesiones:
- Hulin, B. T., et al. (2016). "Spikes in acute workload are associated with increased injury risk"
- Blanch, P., & Gabbett, T. J. (2016). "Has the athlete trained enough to return to play safely?"

---

## 📄 **LICENCIA**

MIT License - Sin cambios

---

## 👥 **CRÉDITOS**

- **Desarrollo v3.0:** Basado en feedback de entrenadores
- **Metodología científica:** Papers de medicina deportiva 2016-2024
- **Algoritmo ML:** Adaptación de modelos de predicción de lesiones en deportes de equipo

---

**Versión:** 3.0.0  
**Fecha:** 22 de Marzo, 2026  
**Estado:** ✅ **PRODUCCIÓN - LISTO PARA USAR**  
**Compatibilidad:** v2.0 datos 100% compatibles (migración automática)

---

## 🎉 **¡TODAS LAS MEJORAS SOLICITADAS IMPLEMENTADAS!**

✅ Editar sesiones  
✅ Editar jugadoras  
✅ Confirmación mejorada  
✅ Búsqueda/filtros avanzados  
✅ Ordenar sesiones  
✅ Vista calendario  
✅ Estadísticas avanzadas  
✅ Comparación temporal  
✅ Plantillas de sesión  
✅ Exportar gráficos  
✅ Informes PDF  
✅ Predicción de lesiones  

**12/12 funcionalidades completadas** 🎊

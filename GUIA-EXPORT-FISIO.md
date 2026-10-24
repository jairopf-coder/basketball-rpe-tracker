# Guía de integración — BasketballRPE-Web → app del fisio

**Para:** Lucas y su IA (la que mantiene la app del estudio).
**De:** Jairo, preparador físico del Ensino Lugo (app *BasketballRPE-Web*).
**Complementa a:** `instrucciones-ia-export-prepa.md` (la especificación de Lucas). Este documento explica cómo funciona mi app, qué datos salen, **en qué tres puntos me aparto de la especificación y por qué**, cómo se identifican las jugadoras y cómo comprobamos entre los dos que los datos viajan bien. **Para adaptar tu app al cambio de identificación del formato 2, empieza por `ADAPTACION-FISIO-FORMATO-2.md`.**

**Versión del formato:** 2 *(la 1 llevaba la columna `ID Oliver`; ver sección 11)*

---

## 1. Resumen en 30 segundos

- Genero **un único `.xlsx`** con las hojas `Bienestar`, `RPE` y `Regla`, más una hoja informativa `LEEME`.
- Lo genero con un botón de mi app (⚙️ → *Exportar para el fisio*), eligiendo un rango de fechas. Por defecto, los últimos 7 días. **La exportación solo lee datos; no modifica nada.**
- Las jugadoras se identifican por **nombre y apellido** (sin IDs, desde el formato 2): `Jugadora` = nombre + apellido, escrito como el «Nombre del Jugador» del CSV de Oli, y `Apellido` va aparte (sección 5).
- Hay **tres diferencias respecto a la especificación** (sección 4). Las he acordado a propósito; tu importador tiene que tratarlas así:
  1. La columna `Estrés` lleva el **estado de ánimo**, porque mi app no recoge estrés.
  2. El `RPE` es la **media diaria** por jugadora (no un RPE por sesión).
  3. La hoja `Regla` trae **solo los días marcados («Sí»)**; no hay filas «No». Un día sin fila = sin regla.
- Reenviar un rango ya enviado es seguro (mismas claves jugadora+día, idéntico resultado).

---

## 2. Cómo funciona mi app (lo mínimo que necesitas saber)

BasketballRPE-Web es una PWA con la que el staff y las jugadoras registran carga y bienestar del equipo.

| Dato | Quién lo introduce | Cómo se guarda |
| --- | --- | --- |
| Bienestar (cuestionario diario) | La jugadora desde su móvil, o el staff a mano | **Un registro por jugadora y día**. Si hay uno del staff y otro de la jugadora el mismo día, manda el del staff |
| RPE de sesión | El staff, por sesión y jugadora (el RPE que envían las jugadoras se revisa y se añade desde Inicio) | Una sesión por jugadora, fecha y turno (`Mañana` / `Tarde`), con RPE entero de 1 a 10 |
| Regla | La jugadora, con una casilla dentro del cuestionario de bienestar | Solo se guarda cuando está **marcada**; sin marca no hay dato |
| GPS | Importación del CSV de Oli | Fuera de este export (entra directamente en tu app desde Oliver Pro) |

Consecuencias que importan para ti:

- Solo hay bienestar y regla **los días que la jugadora responde el cuestionario**.
- Los RPE que las jugadoras envían y yo aún no he revisado **no salen** en el archivo hasta que los añado. La app me avisa de cuántos hay pendientes antes de descargar.
- Fechas: días de calendario en hora de Madrid, formato `aaaa-mm-dd` **como texto**.

---

## 3. Contenido del archivo

### Hoja `Bienestar` — una fila por jugadora y día con cuestionario completo

| Columna | Origen en mi app | Dominio |
| --- | --- | --- |
| `Jugadora` | Nombre + apellido de la ficha de la jugadora (sección 5) | texto |
| `Apellido` | Apellido(s) de la ficha; es el final de `Jugadora` | texto, puede ir vacío |
| `Fecha` | Día del cuestionario | `aaaa-mm-dd` |
| `Sueño` | Sueño | entero 1–5 |
| `Estrés` | **Estado de ánimo** (ver 4.1) | entero 1–5 |
| `Fatiga` | «Energía» | entero 1–5 |
| `Dolor muscular` | «Muscular» | entero 1–5 |

**Escala: 1 = peor, 5 = mejor en los cuatro ítems, exportada sin transformar** (no se invierte). Coincide con la que pide tu especificación. Cuestionarios incompletos o con valores fuera de 1–5 **no se exportan**.

### Hoja `RPE` — una fila por jugadora y **día** (ver 4.2)

| Columna | Contenido |
| --- | --- |
| `Jugadora`, `Apellido`, `Fecha` | Como arriba |
| `Sesión` | **Siempre vacía** |
| `RPE` | Media de los RPE de las sesiones de ese día, **redondeada al entero** (x,5 sube). Entero 0–10 |
| `Nº sesiones` | *(columna extra)* cuántas sesiones entran en la media: 1 o 2 |
| `Detalle` | *(columna extra)* el desglose, p. ej. `Mañana 6 · Tarde 8` |

No se envían ni el s-RPE ni la duración.

### Hoja `Regla` — solo los días marcados (ver 4.3)

| Columna | Contenido |
| --- | --- |
| `Jugadora`, `Apellido`, `Fecha` | Como arriba |
| `Activa` | Siempre `Sí` |

### Hoja `LEEME` — informativa (cabeceras `Clave` / `Valor`)

Repite en el propio archivo las convenciones de este documento y trae un **control**: la ventana de fechas (`Ventana desde` / `Ventana hasta`) y el número de filas de cada hoja. Sirve para detectar archivos truncados y, sobre todo, **para que sepas qué días cubre el envío** (clave para la regla).

> Si tu importador rechaza o se confunde con una hoja extra, dímelo: lo apago con un interruptor y el archivo sale con solo las tres hojas.

### Ejemplo (datos inventados)

`Bienestar`

| Jugadora | Apellido | Fecha | Sueño | Estrés | Fatiga | Dolor muscular |
| --- | --- | --- | --- | --- | --- | --- |
| María López | López | 2026-09-29 | 4 | 5 | 3 | 2 |

`RPE` (día con doble sesión: 6 por la mañana y 8 por la tarde)

| Jugadora | Apellido | Fecha | Sesión | RPE | Nº sesiones | Detalle |
| --- | --- | --- | --- | --- | --- | --- |
| María López | López | 2026-09-29 | | 7 | 2 | Mañana 6 · Tarde 8 |

`Regla`

| Jugadora | Apellido | Fecha | Activa |
| --- | --- | --- | --- |
| María López | López | 2026-09-28 | Sí |
| María López | López | 2026-09-29 | Sí |

---

## 4. Los tres puntos en que me aparto de la especificación

> Tu especificación pide que, si algo no encaja con cómo guarda los datos mi app, **no improvise una transformación, lo anote y lo diga**. Esto es ese aviso.

### 4.1 `Estrés` contiene el estado de ánimo

Mi cuestionario recoge sueño, energía, **ánimo** y dolor muscular. No recoge estrés. En lugar de dejar la columna vacía (el importador descartaría todas las filas por incompletas), exporto el ánimo en `Estrés`.

- El sentido de la escala coincide: **1 = peor, 5 = mejor** (ánimo 5 = excelente ↔ estrés 5 = muy bajo).
- **No es el mismo constructo.** El Hooper con ánimo en lugar de estrés no es estrictamente comparable con el Hooper original. Si vais a calcular el índice total o comparar con referencias, tenedlo en cuenta (por ejemplo, etiquetando internamente esa serie como «ánimo»).

### 4.2 `RPE` es la media diaria, no un RPE por sesión

Tú solo necesitas el RPE medio del día; yo guardo los dos de las dobles sesiones. Por eso:

- Se envía **una fila por jugadora y día**, con la media aritmética de las sesiones del día, redondeada al entero (6 y 7 → 7; 7 y 8 → 8).
- `Sesión` va **siempre vacía**, a propósito: la fila no pertenece a una sesión concreta, sino al día. En días con una sola sesión, tu importador debería poder asignarla a esa sesión. **En días de doble sesión quedará sin asignar según tu especificación (§3)**: necesito que decidáis cómo tratar ese RPE (por ejemplo, tomarlo como RPE del día y aplicarlo a las dos sesiones, o calcular el s-RPE diario con la duración total). Lo que decidas, documéntalo.
- No hay s-RPE ni duración en el archivo. Sigue siendo `RPE × duración` en tu app.
- **No se pierde información:** `Detalle` conserva el RPE de cada turno. Si más adelante queréis el RPE por sesión, puedo pasar a una fila por sesión con la columna `Sesión` rellena (`Mañana` / `Tarde`) sin cambiar nada más.

### 4.3 `Regla`: solo días marcados, sin filas «No»

Mi app solo guarda la regla cuando la jugadora la marca. Una jugadora no marca «No» cada día, y no quiero rellenar la hoja con cientos de filas «No» inventadas. Por eso:

- **`Activa` es siempre `Sí`.** No hay filas `No`.
- **Un día de la ventana sin fila para una jugadora significa que no tenía la regla marcada.**
- Una jugadora que nunca la marca **no aparece** en la hoja. En mi app no existe el concepto «jugadora sin seguimiento de regla»: no puedo distinguir «no la tiene» de «no usa esta parte». Se interpreta como no la tiene.

Cómo debería leerlo tu importador:

1. **Ventana de cobertura = `Ventana desde` a `Ventana hasta` de la hoja `LEEME`** (no el mínimo y máximo de fechas de la hoja `Regla`). Dentro de esa ventana, todo día sin fila es «No». Recalcula la regla de cada jugadora solo dentro de esa ventana, y es seguro si se solapan envíos.
2. **Períodos:** días `Sí` consecutivos forman un período. Cualquier día de calendario sin fila entre dos `Sí` separa dos períodos.
3. **Cierre:** un período cuyo último día `Sí` es anterior a `Ventana hasta` está **cerrado** (hubo al menos un día sin marca después). Si llega justo hasta `Ventana hasta`, queda **abierto** hasta el envío siguiente.
4. Aviso de límite: si una jugadora no responde el cuestionario un día en mitad de un período, ese día no tiene fila y el período aparecerá partido en dos. Es una limitación de no distinguir «no respondió» de «no la tiene».

---

## 5. Identificación de jugadoras: nombre y apellido (sin IDs)

Desde el formato 2 **no hay ningún ID** en el archivo. La jugadora se identifica por su nombre y apellido:

| Columna | Contenido |
| --- | --- |
| `Jugadora` | Nombre + apellido de la ficha, separados por un espacio y **escritos como los escribe Oli** en «Nombre del Jugador» (p. ej. `Carla Mendes Rocha`) |
| `Apellido` | Solo el apellido o apellidos de la ficha (p. ej. `Mendes Rocha`). El nombre es `Jugadora` sin el `Apellido` del final. Puede ir **vacío** si la ficha aún no lo tiene |

Cómo lo tiene mi app:

- Cada ficha tiene **Nombre** y **Apellido(s)** por separado (el apellido es un campo libre: admite uno o dos). En pantalla solo se ve el nombre; el apellido sirve para identificar a la jugadora al importar y exportar datos.
- Los mismos datos se usan para importar el CSV de Oli: se emparejan las filas por nombre y apellido, comparando **palabras enteras**, sin acentos ni mayúsculas.
- Me encargo de que no haya dos jugadoras con el mismo nombre. Si ocurriera, el modal de exportación lo avisa antes de descargar.
- Una ficha sin apellido sale con `Apellido` vacío y `Jugadora` solo con el nombre. La app me avisa antes de descargar.

Por qué dejo de usar el `ID Oliver`: un ID no distingue personas si el club reasigna el dispositivo (por ejemplo, cuando una jugadora se marcha y la que llega hereda su GPS), y solo existía para las jugadoras ya importadas por GPS. El nombre y el apellido sí son comunes a los dos lados.

Cómo debería usarlo tu app: **el algoritmo recomendado, con ejemplos y un archivo de prueba, está en `ADAPTACION-FISIO-FORMATO-2.md`.** En resumen:

1. Compara `Jugadora` con tus jugadoras sin acentos ni mayúsculas y **por palabras enteras**, no por trozos de texto.
2. Si coincide todo en el mismo orden, es esa jugadora. Si coincide solo en parte (un apellido de más o de menos), propónla y **pide confirmación**.
3. Si no encaja con nadie, **no crees una jugadora nueva sola**: avísame.
4. `Jugadora` es el nombre de **mi** ficha. Si lo corrijo, cambiará en los envíos siguientes: no dupliques a la jugadora por eso.

---

## 6. Cómo comprobamos que los datos viajan bien

Hay cuatro controles. Los dos primeros son míos; los dos últimos, tuyos.

### Control 1 — Antes de descargar (mi app)

El modal de exportación muestra, para el rango elegido: filas por hoja, jugadoras con datos, días de doble sesión y **avisos**: cuestionarios descartados por incompletos, fichas sin apellido, jugadoras con el mismo nombre, RPE pendientes de revisar. Si algo no cuadra, lo corrijo antes de enviarte nada.

### Control 2 — El mensaje de entrega

Junto al archivo te envío el texto que genera la app (botón «Copiar mensaje»): rango, filas por hoja y las tres convenciones. Es el «lo que te estoy dando».

### Control 3 — Verificador independiente (`verificar_export.py`)

Cada vez que recibas un archivo, **antes de importarlo**:

```bash
pip install openpyxl
python3 verificar_export.py ensino-bienestar-rpe-regla-2026-09-28-a-2026-10-04.xlsx
```

Comprueba la checklist de tu especificación (§8) y las convenciones de esta guía: tres hojas reconocidas por cabeceras, sin celdas combinadas, fórmulas ni filas en blanco, fechas ISO, dominios (bienestar 1–5, RPE 0–10), duplicados, mismo nombre y apellido en las tres hojas (con `Jugadora` terminada en `Apellido`), **coherencia de la media diaria con `Detalle`**, filas contra los recuentos de `LEEME` y fechas dentro de la ventana. Imprime también los **períodos de regla** que tu importador debería reconstruir y una línea `RESUMEN:` con los recuentos.

Códigos de salida: `0` correcto · `1` el archivo tiene errores (no importar y avisarme) · `2` el archivo está bien pero lo importado no coincide.

### Control 4 — Acuse de recibo (tu app)

Después de importar, tu IA me responde con este formato (sustituyendo los números):

```
ACUSE · archivo: ensino-bienestar-rpe-regla-2026-09-28-a-2026-10-04.xlsx
Importado: Bienestar=__ RPE=__ Regla=__
Descartadas / pendientes (con motivo): __
Períodos de regla creados o actualizados: __
Jugadoras nuevas o sin coincidencia por nombre y apellido: __
```

Y contrasta los recuentos con el archivo:

```bash
python3 verificar_export.py archivo.xlsx --importado-bienestar 42 --importado-rpe 30 --importado-regla 4
```

Si sale `2`, hay filas enviadas que no se importaron: el script indica la diferencia por hoja. Es la señal para revisar qué se descartó y por qué, **antes** de fiarse del dato.

### Prueba inicial (una sola vez)

En el primer envío, antes de automatizar nada:

- [ ] El verificador sale con código `0`.
- [ ] Lo importado coincide con lo enviado en las tres hojas (control 4).
- [ ] Elegid **2 o 3 jugadoras** y comparad a mano un día cada una: un bienestar (los cuatro valores), un RPE de día de doble sesión (la media y el `Detalle`) y un período de regla (primera y última fecha).
- [ ] Una jugadora con regla marcada tiene el período con las fechas correctas, y la que no la ha marcado nunca no tiene ninguno.
- [ ] Reenviar el mismo rango no duplica nada.
- [ ] Todas las jugadoras quedan vinculadas por nombre y apellido (ninguna duplicada).

### Si algo no cuadra

| Síntoma | Causa más probable |
| --- | --- |
| Faltan filas de `Bienestar` | Cuestionarios incompletos (la app ya los descarta y avisa) o la jugadora no respondió ese día |
| Faltan filas de `RPE` en días de doble sesión | `Sesión` vacía a propósito: es la decisión del punto 4.2 |
| Una jugadora duplicada | Su nombre o apellido en mi ficha no coincide con el de tu base (acentos, un apellido de más o de menos): corrígelo en una de las dos |
| Períodos de regla partidos o abiertos de más | No se está usando la ventana de `LEEME` para cerrar períodos, o la jugadora saltó un día de cuestionario (4.3.4) |
| El importador falla al abrir el archivo | Probablemente la hoja `LEEME`: avísame para desactivarla |
| Fechas desplazadas un día | No debería ocurrir (hora de Madrid); avísame con un ejemplo |

---

## 7. Qué no entra en el archivo

GPS y carga externa (los traes directamente de Oliver Pro), s-RPE y duraciones, fases del ciclo, lesiones, viajes y datos agregados (medias, z-scores, ACWR). Solo datos crudos por día, salvo el RPE diario descrito en 4.2.

---

## 8. Preguntas para Lucas (necesito una respuesta antes del primer envío real)

1. **¿Tu importador acepta la hoja `LEEME` y las columnas extra `Nº sesiones` y `Detalle`?** (Las columnas extra deberían ignorarse según tu especificación; la hoja extra no sé.)
2. **RPE diario:** ¿cómo tratas una fila con `Sesión` vacía en un día de doble sesión?
3. **Regla:** ¿puedes interpretar «día de la ventana sin fila = No» usando la ventana de `LEEME`? Sin eso, los períodos no se cierran bien.
4. **Estrés = ánimo:** ¿te vale así o prefieres que deje la columna vacía y no se importe esa serie?
5. **Identificación (formato 2):** ¿tu app puede cruzar a las jugadoras por `Jugadora` (nombre + apellido) y `Apellido`, en lugar de por ID? El algoritmo propuesto y las preguntas concretas están en `ADAPTACION-FISIO-FORMATO-2.md`.

---

## 9. Notas para tu IA (copiar y pegar)

```
Contexto: recibes un .xlsx generado por BasketballRPE-Web (app de Jairo, Ensino Lugo).
Reglas:
- Identifica a la jugadora por nombre y apellido (formato 2, sin IDs): «Jugadora» = nombre + apellido y
  «Apellido» va aparte. Compara sin acentos ni mayúsculas y por PALABRAS ENTERAS. Si no hay coincidencia
  exacta, propón y pide confirmación; no crees una jugadora nueva por tu cuenta. Ver ADAPTACION-FISIO-FORMATO-2.md.
- Bienestar: escala 1=peor, 5=mejor, sin invertir. La columna «Estrés» contiene el ESTADO DE ÁNIMO.
- RPE: es la MEDIA DIARIA por jugadora (entera, redondeada). «Sesión» va vacía a propósito.
  «Nº sesiones» y «Detalle» (p. ej. «Mañana 6 · Tarde 8») son columnas extra con el desglose.
- Regla: solo hay filas «Sí». Un día de la ventana sin fila = sin regla. La ventana de cobertura es
  «Ventana desde» – «Ventana hasta» de la hoja LEEME. Días «Sí» consecutivos = un período;
  un día sin fila entre dos «Sí» los separa; un período que llega a «Ventana hasta» queda abierto.
- La hoja LEEME es informativa (control de recuentos y ventana); no contiene datos de jugadoras.
- Antes de importar, ejecuta verificar_export.py. Si devuelve 1, no importes y avisa.
- Después de importar, responde con el ACUSE (recuentos importados, descartes con motivo, períodos).
- Reenviar un rango ya enviado es seguro: no dupliques, recalcula por clave.
- Si algo no encaja, no improvises una transformación: anótalo y dilo.
```

---

## 10. Privacidad

El archivo contiene **datos de salud de las jugadoras** (bienestar y regla). Por favor:

- Compártelo por un canal con acceso restringido, no por chats abiertos ni correos sin protección.
- No lo subas a ningún repositorio ni lo pegues en servicios externos que no estén contemplados para estos datos.
- Bórralo una vez importado y verificado.
- La exportación solo puede lanzarla personal con sesión iniciada en la app (nunca las jugadoras). El contenido de la hoja `Regla` conviene compartirlo solo con quien lo necesite en la parte médica del equipo.

---

## 11. Versionado y cambios

El formato lleva una versión (`LEEME` → `Formato`). Si cambio algo que afecte a tu importador (columnas, convenciones, una fila por sesión en el RPE…), subiré el número y te avisaré **antes** de enviarte un archivo nuevo.

### Historial

| Versión | Cambio |
| --- | --- |
| 2 | Se elimina la columna `ID Oliver` y se añade `Apellido` en las tres hojas. `Jugadora` pasa a ser nombre + apellido. LEEME: nueva clave `Identificación`, sin la clave `ID Oliver`. El verificador exige `Apellido` y comprueba que `Jugadora` termina en él. |
| 1 | Versión inicial: `Jugadora` + `ID Oliver` como identificador. |

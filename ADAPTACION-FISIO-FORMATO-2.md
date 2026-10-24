# Adaptación de tu app al formato 2 del export de BasketballRPE-Web

**Para:** Lucas y su IA (la que mantiene la app del estudio).
**De:** Jairo, preparador físico del Ensino Lugo (app *BasketballRPE-Web*).
**Completa a:** `GUIA-EXPORT-FISIO.md` (la guía general del export, ya actualizada al formato 2).
**Archivo de prueba:** `EJEMPLO-export-formato-2.xlsx` (datos inventados, con los casos de nombre que más importan).

---

## 1. Qué te pido y qué decides tú

El export deja de llevar el `ID Oliver`. **Las jugadoras se identifican por nombre y apellido.** Necesito que tu app reconozca a cada jugadora con eso.

**Cómo lo implementes lo decides tú**, de la forma que mejor encaje con tu app. Este documento te cuenta:

- qué cambia en el archivo (sección 2),
- cómo guarda y escribe los nombres mi app, y qué te garantizo y qué no (sección 3),
- el algoritmo de emparejamiento que uso yo con el CSV de Oli, ya probado, por si quieres reutilizarlo (sección 4),
- cómo tratar tu base actual (sección 5) y cómo comprobamos que todo viaja bien (sección 6).

> **No te enviaré ningún archivo del formato 2 hasta que me confirmes que tu importador está adaptado.**

---

## 2. Qué cambia respecto al formato 1

Solo cambia la identificación. **Todo lo demás es igual** (hojas, escalas, `Estrés` = ánimo, RPE como media diaria, `Regla` solo con días «Sí», hoja `LEEME`, nombre del archivo, ventana de fechas, reenvío seguro).

| | Formato 1 | **Formato 2** |
| --- | --- | --- |
| Columnas de identificación (en las 3 hojas) | `Jugadora`, `ID Oliver` | **`Jugadora`, `Apellido`** |
| `Jugadora` | Nombre de la ficha (a veces solo el nombre, a veces completo) | **Nombre + apellido** de la ficha, separados por un espacio |
| `Apellido` | no existía | **Solo el apellido o apellidos** de la ficha. Puede ir vacío |
| `ID Oliver` | identificador | **ya no existe** |
| `LEEME` → `Formato` | `versión 1` | **`versión 2`** |
| `LEEME` → clave `ID Oliver` | sí | **no**; hay una clave nueva `Identificación` |
| Aviso del modal de exportación | «jugadoras sin ID de Oli» | «jugadoras sin apellido» y «jugadoras con el mismo nombre» |
| `verificar_export.py` | comprobaba IDs | **exige `Apellido`** y comprueba que `Jugadora` termina en `Apellido` |

Orden de columnas (las dos primeras sustituyen a las antiguas):

- `Bienestar`: `Jugadora` · `Apellido` · `Fecha` · `Sueño` · `Estrés` · `Fatiga` · `Dolor muscular`
- `RPE`: `Jugadora` · `Apellido` · `Fecha` · `Sesión` · `RPE` · `Nº sesiones` · `Detalle`
- `Regla`: `Jugadora` · `Apellido` · `Fecha` · `Activa`

> ⚠️ **No hay ninguna columna llamada `Nombre`, a propósito.** En tu especificación `Nombre` es un alias de `Jugadora`, y habría confundido a tu importador. Si necesitas el nombre de pila: es `Jugadora` sin el `Apellido` del final.

---

## 3. Cómo funciona mi app con los nombres (y qué te garantizo)

**Por qué dejo el ID de Oli.** Un ID no distingue personas si el club reasigna el dispositivo (por ejemplo, cuando una jugadora se marcha y la que llega hereda su GPS): el mismo ID acabaría representando a dos personas. Además, el ID solo lo tenía rellenado cuando había importado el GPS de la jugadora (o lo escribía a mano). El nombre y el apellido, en cambio, existen siempre y los tenemos los dos.

**Cómo guardo yo a las jugadoras.** Cada ficha tiene dos campos: **Nombre** y **Apellido(s)**. El apellido es un campo libre: puede llevar uno o dos apellidos. En pantalla veo solo el nombre; el apellido lo uso para identificar a la jugadora cuando trato datos (importar el CSV de Oli, exportarte a ti).

**Lo que te garantizo:**

- `Jugadora` = `Nombre` + un espacio + `Apellido`, sin espacios sobrantes. Con acentos y mayúsculas tal como están en la ficha.
- `Apellido` es exactamente el final de `Jugadora`. El nombre es lo que queda al quitarlo.
- La misma jugadora lleva **el mismo nombre y apellido en las tres hojas** y en todas sus filas del archivo.
- Me encargo de que **no haya dos jugadoras con el mismo nombre completo**. Si ocurriera, el modal de exportación me avisa antes de descargar.
- Una ficha sin apellido sale con `Apellido` vacío y `Jugadora` solo con el nombre. La app me avisa, y lo arreglo.

**Lo que NO te garantizo:**

- Que mi escritura coincida letra a letra con la de tu base: acentos, un apellido de más o de menos, orden. Procuro escribir los nombres como los escribe Oli en «Nombre del Jugador» (el texto que tú también recibes en tu GPS), pero no es una garantía.
- Que el nombre no cambie con el tiempo: si corrijo una ficha (por ejemplo, añado un segundo apellido), cambiará en los envíos siguientes. **Tu app no debe crear una jugadora nueva por eso** (ver sección 4, paso 4).

**Casos de nombre que vas a ver** (todos están en el archivo de prueba, con datos inventados):

| `Jugadora` | `Apellido` | Qué ilustra |
| --- | --- | --- |
| Carla Mendes Rocha | Mendes Rocha | Dos apellidos |
| Ingrid Van Dijk | Van Dijk | Apellido con partícula: **no cortes por la última palabra** |
| María José García | García | Nombre compuesto: **no cortes por la primera palabra**; usa `Apellido` |
| Marta Ferrer / Lucía Ferrer | Ferrer | Mismo apellido, distinto nombre: **no identifiques solo por apellido** |
| Nora | *(vacío)* | Ficha sin apellido |

---

## 4. Algoritmo de emparejamiento recomendado

Es el que uso yo para emparejar el CSV de Oli con mi plantilla, probado con un CSV real de Oli. Úsalo tal cual o adáptalo.

**Normalizar:** pasar a minúsculas, quitar acentos (descomponer en NFD y quitar las marcas) y trocear por todo lo que no sea letra o número (guiones, puntos, apóstrofos separan). Cada trozo es una *palabra*. Ejemplo: `Ingrid VAN-Dijk` → `[ingrid, van, dijk]`.

**Para cada fila del archivo**, compara sus palabras (`Jugadora`) con las de cada jugadora de tu base:

1. **Exacta:** mismas palabras, mismo orden → es esa jugadora.
2. **Parcial:** todas las palabras de un nombre están, **enteras**, en el otro (uno trae un apellido de más o de menos), o son las mismas palabras en otro orden → es una **candidata a confirmar**.
3. Si hay **una sola** candidata, propónla y pide confirmación. Si hay **varias**, no elijas ninguna.
4. **Una vez confirmado el vínculo, guárdalo** (un alias: «texto del archivo → jugadora de tu base»). La próxima vez no hace falta preguntar, aunque yo cambie un apellido: el cambio caerá en «parcial» y se confirmará una sola vez.
5. Si dos filas distintas apuntan a la misma jugadora de tu base, **gana la exacta**; las demás quedan sin vincular.
6. Si no encaja con nadie, es una **jugadora nueva para tu app**: **no la crees sola**. Déjala pendiente y avísame en el acuse.

**Dos errores que hay que evitar:**

- **No compares «contiene texto».** `ana` está dentro de `tetiana`: con palabras enteras no hay confusión.
- **No identifiques solo por apellido ni solo por nombre** (hay dos Ferrer, y puede haber dos nombres iguales con otros apellidos).

**Implementación de referencia** (JavaScript; tradúcela a lo que uses):

```js
// Palabras de un nombre: sin acentos, mayúsculas ni signos.
const tokens = (s) => String(s || '').trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .split(/[^\p{L}\p{N}]+/u).filter(Boolean);

// Candidatas de tu base para un texto del archivo (Jugadora = nombre + apellido).
function candidatas(textoArchivo, tusJugadoras /* [{ id, nombreCompleto }] */) {
    const out = { exactas: [], parciales: [] };
    const a = tokens(textoArchivo);
    if (!a.length) return out;
    const setA = new Set(a);
    for (const j of tusJugadoras) {
        const b = tokens(j.nombreCompleto);
        if (!b.length) continue;
        if (b.length === a.length && b.every((w, i) => w === a[i])) { out.exactas.push(j); continue; }
        const setB = new Set(b);
        if (a.every(w => setB.has(w)) || b.every(w => setA.has(w))) out.parciales.push(j);
    }
    return out;
}

// Decisión: una exacta → vinculada; ninguna exacta y una sola parcial → proponer; en otro caso → sin vincular.
function decidir(c) {
    if (c.exactas.length === 1) return { jugadora: c.exactas[0], tipo: 'exacta' };
    if (!c.exactas.length && c.parciales.length === 1) return { jugadora: c.parciales[0], tipo: 'a confirmar' };
    return { jugadora: null, tipo: 'sin vincular' };
}
```

Si en tu base guardas nombre y apellido por separado, puedes comparar también `Apellido` con tu apellido (misma normalización) y el nombre con `Jugadora` sin ese apellido. Pero ten en cuenta que, si tu base no los separa, **no tienes que separarlos tú**: yo ya te doy el apellido aparte.

---

## 5. Tu base actual

Hasta ahora vinculabas a las jugadoras por `ID Oliver`. Al pasar al formato 2:

- **Conserva tus jugadoras y sus datos.** Lo único que cambia es cómo reconoces a cada una cuando llega un archivo.
- **No las dupliques.** La primera vez que llegue un archivo del formato 2, empareja **todas** las jugadoras por nombre y apellido y **confirma una a una** (aunque salgan como exactas), y guarda cada vínculo como alias.
- El `ID Oliver` sigue existiendo en tu GPS de Oliver Pro. Puedes seguir usándolo **por tu lado**; mi export ya no lo trae.
- Los archivos del formato 1 que ya importaste siguen siendo válidos. Reenviar un rango antiguo ya no es posible desde mi app, porque solo genera el formato 2: si quieres reimportar algo, dímelo y lo preparamos.

---

## 6. Cómo comprobamos que viaja bien

**Antes de importar**, con el verificador (`verificar_export.py`, ya actualizado):

```bash
pip install openpyxl
python3 verificar_export.py archivo.xlsx
```

Códigos de salida: `0` correcto · `1` el archivo tiene errores (no importar y avisarme) · `2` está bien pero lo importado no coincide con `--importado-bienestar/--importado-rpe/--importado-regla`.

Comprobaciones nuevas del formato 2:

| Resultado | Cuándo |
| --- | --- |
| ❌ error | Falta la columna `Apellido` |
| ❌ error | `Jugadora` no termina en `Apellido` (o es igual que `Apellido`, sin nombre) |
| ❌ error | La misma `Jugadora` aparece con apellidos distintos en el archivo |
| ❌ error | `LEEME` declara un formato distinto de 2 |
| ⚠️ aviso | Jugadoras con `Apellido` vacío (ficha incompleta; se identifican solo por el nombre) |

**Prueba con el archivo de ejemplo** (`EJEMPLO-export-formato-2.xlsx`, datos inventados; 6 jugadoras, 7 días, un día de doble sesión, una regla cerrada y otra abierta). El verificador debe dar código `0` con **un aviso** (Nora, sin apellido). Tu importador debería:

| Jugadora del archivo | Comportamiento esperado |
| --- | --- |
| Carla Mendes Rocha | Exacta si tu base la tiene igual. Si tu base solo tiene «Carla Mendes», parcial → confirmar |
| Ingrid Van Dijk | Igual. Comprueba que no la cortas por la última palabra |
| María José García | Nombre = «María José». Comprueba que no la parte por la primera palabra |
| Marta Ferrer y Lucía Ferrer | Cada una con la suya. Si comparas solo el apellido, serían ambiguas |
| Nora (sin apellido) | Exacta solo si tu base la tiene como «Nora». Si tu base tiene «Nora Soto», parcial → confirmar. Si tienes varias «Nora …», ninguna: pendiente |

**Después de importar**, responde con el acuse (cambia solo la línea de jugadoras):

```
ACUSE · archivo: ensino-bienestar-rpe-regla-2026-09-28-a-2026-10-04.xlsx
Importado: Bienestar=__ RPE=__ Regla=__
Jugadoras: vinculadas exactas=__ · vinculadas tras confirmar=__ · nuevas o sin coincidencia=__ (nombres: __)
Descartadas / pendientes (con motivo): __
Períodos de regla creados o actualizados: __
```

**Prueba inicial (una sola vez)**

- [ ] El verificador sale con código `0` en el archivo de ejemplo y en el primer archivo real.
- [ ] Las 6 jugadoras del ejemplo se comportan como indica la tabla de arriba.
- [ ] Todas tus jugadoras reales quedan vinculadas por nombre y apellido, sin duplicados.
- [ ] Reenviar el mismo rango no duplica nada.
- [ ] Una jugadora cuyo apellido corrijo en mi ficha **no** crea una jugadora nueva en tu app (cae en «parcial» y se confirma).

---

## 7. Lo que necesito que me respondas

Antes del primer envío real, tu IA me devuelve:

1. ¿Cómo guarda hoy tu app el nombre de las jugadoras: un solo campo o nombre y apellido por separado?
2. ¿Tu importador admite la columna `Apellido` y la ausencia de `ID Oliver` sin cambios, o necesita algo más?
3. ¿Cómo quieres que trate una jugadora con `Apellido` vacío? (Mi propuesta: si el nombre coincide con una sola jugadora de tu base, vincularla pidiendo confirmación.)
4. ¿Hay algo de cómo escribo los nombres que te complique el cruce (por ejemplo, prefieres «Apellidos, Nombre»)? Si es razonable, lo cambio de mi lado.
5. ¿Cómo vas a guardar los vínculos confirmados (alias) y qué haces cuando una jugadora desaparece de los archivos?

---

## 8. Bloque para pegar en tu IA

```
Contexto: recibes un .xlsx del formato 2 generado por BasketballRPE-Web (app de Jairo, Ensino Lugo).
Cambio respecto al formato 1: ya NO hay «ID Oliver». Las tres hojas llevan «Jugadora» y «Apellido».
- «Jugadora» = nombre + apellido (como el «Nombre del Jugador» del CSV de Oli). «Apellido» = solo el
  apellido o apellidos, y es el final de «Jugadora». Puede venir vacío (ficha incompleta).
- No existe ninguna columna «Nombre». Si necesitas el nombre de pila, es «Jugadora» sin el «Apellido».
- Identifica a la jugadora por nombre y apellido: sin acentos ni mayúsculas, por PALABRAS ENTERAS
  (no por trozos de texto). Una coincidencia exacta vincula. Una parcial (un apellido de más o de menos,
  o distinto orden) se propone y se CONFIRMA. Varias candidatas o ninguna: no vincules.
- No crees una jugadora nueva por tu cuenta: déjala pendiente y avisa en el acuse.
- Guarda cada vínculo confirmado como alias. Si Jairo corrige una ficha, no dupliques a la jugadora.
- No identifiques solo por apellido ni solo por nombre (hay jugadoras con el mismo apellido).
- No cortes los nombres por la primera ni la última palabra («María José», «Van Dijk»): usa «Apellido».
- Lo demás NO cambia: Estrés = ánimo, RPE = media diaria, Regla solo «Sí», hoja LEEME, ventana de fechas.
- Antes de importar ejecuta verificar_export.py (formato 2). Si devuelve 1, no importes y avisa.
- Después de importar responde con el ACUSE (incluida la línea de jugadoras vinculadas / pendientes).
- Prueba primero con EJEMPLO-export-formato-2.xlsx (datos inventados).
- Si algo no encaja, no improvises una transformación: anótalo y dilo.
```

---

## 9. Versionado

Este es el **formato 2**. Si cambio algo que afecte a tu importador, subiré el número y te avisaré **antes** de enviarte un archivo nuevo. El historial está al final de `GUIA-EXPORT-FISIO.md`.

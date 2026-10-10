# 🚀 Guía Completa: Basketball RPE Tracker con Firebase + GitHub Pages

## 📋 Resumen
Esta guía te llevará paso a paso para publicar tu aplicación Basketball RPE Tracker en internet de forma **GRATUITA** y **colaborativa**, donde múltiples personas podrán ver y modificar los mismos datos en tiempo real.

---

## 🎯 PARTE 1: Crear Proyecto Firebase (15 minutos)

### Paso 1.1: Crear cuenta Firebase
1. Ve a: https://firebase.google.com/
2. Haz clic en **"Comenzar"** o **"Get Started"**
3. Inicia sesión con tu cuenta de Google
4. Acepta los términos y condiciones

### Paso 1.2: Crear nuevo proyecto
1. Haz clic en **"Agregar proyecto"** o **"Add project"**
2. Nombre del proyecto: `basketball-rpe-tracker` (o el que prefieras)
3. Haz clic en **"Continuar"**
4. **Google Analytics**: Puedes desactivarlo (no lo necesitamos)
5. Haz clic en **"Crear proyecto"**
6. Espera a que se cree (tarda ~30 segundos)
7. Haz clic en **"Continuar"**

### Paso 1.3: Configurar Realtime Database
1. En el menú lateral, haz clic en **"Compilación"** → **"Realtime Database"**
   (En inglés: **"Build"** → **"Realtime Database"**)
2. Haz clic en **"Crear base de datos"**
3. Ubicación: Selecciona **"europe-west1"** (Bélgica - más cerca de España)
4. Haz clic en **"Siguiente"**
5. Reglas de seguridad: Selecciona **"Comenzar en modo bloqueado"**
   (el modo de prueba deja la base de datos abierta a todo internet; **no lo uses**).
   Las reglas de la app se publican en la **Parte 4**, que es obligatoria.
6. Haz clic en **"Habilitar"**

### Paso 1.4: Obtener configuración
1. En el menú lateral, haz clic en el ícono de ⚙️ (engranaje) → **"Configuración del proyecto"**
2. Baja hasta la sección **"Tus apps"**
3. Haz clic en el ícono `</>` (Web)
4. Nombre de la app: `Basketball RPE Web`
5. **NO marques** "Firebase Hosting"
6. Haz clic en **"Registrar app"**
7. Verás un código JavaScript como este:

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "basketball-rpe-tracker.firebaseapp.com",
  databaseURL: "https://basketball-rpe-tracker-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "basketball-rpe-tracker",
  storageBucket: "basketball-rpe-tracker.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:xxxxxxxxxxxxx"
};
```

8. **COPIA TODOS ESTOS VALORES** (los necesitarás en el siguiente paso)
9. Haz clic en **"Continuar a la consola"**

---

## 🔧 PARTE 2: Configurar el Código (5 minutos)

### Paso 2.1: Actualizar firebase-config.js
1. Abre el archivo `firebase-config.js` en tu editor
2. Reemplaza los valores de ejemplo con los que copiaste de Firebase:

```javascript
const firebaseConfig = {
    apiKey: "PEGA_AQUI_TU_apiKey",
    authDomain: "PEGA_AQUI_TU_authDomain",
    databaseURL: "PEGA_AQUI_TU_databaseURL",
    projectId: "PEGA_AQUI_TU_projectId",
    storageBucket: "PEGA_AQUI_TU_storageBucket",
    messagingSenderId: "PEGA_AQUI_TU_messagingSenderId",
    appId: "PEGA_AQUI_TU_appId"
};
```

3. Guarda el archivo

### Paso 2.2: Probar localmente
1. Abre una terminal en la carpeta `BasketballRPE-Web`
2. Ejecuta: `python3 -m http.server 3000` (en Windows: `python -m http.server 3000`)
3. Abre tu navegador en: http://localhost:3000
4. Abre la **Consola del navegador** (F12 → pestaña Console)
5. Deberías ver: `🟢 Conectado a Firebase`
6. Prueba a añadir un jugador o una sesión

---

## 📤 PARTE 3: Publicar en GitHub Pages (10 minutos)

### Paso 3.1: Crear repositorio GitHub
1. Ve a: https://github.com/
2. Inicia sesión (o crea una cuenta gratuita)
3. Haz clic en el botón **"+"** arriba a la derecha → **"New repository"**
4. Nombre del repositorio: `basketball-rpe-tracker`
5. Descripción: `Aplicación web para tracking de RPE en baloncesto`
6. Selecciona **"Public"** (público)
7. **NO marques** "Add a README file"
8. Haz clic en **"Create repository"**

### Paso 3.2: Subir el código
Opción A - **Usando GitHub Desktop** (más fácil):
1. Descarga GitHub Desktop: https://desktop.github.com/
2. Instálalo e inicia sesión
3. File → Add Local Repository
4. Selecciona la carpeta `BasketballRPE-Web`
5. Haz clic en "Publish repository"

Opción B - **Usando línea de comandos**:
```bash
cd BasketballRPE-Web
git init
git add .
git commit -m "Primera versión con Firebase"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/basketball-rpe-tracker.git
git push -u origin main
```

### Paso 3.3: Activar GitHub Pages
1. En GitHub, ve a tu repositorio
2. Haz clic en **"Settings"** (arriba a la derecha)
3. En el menú lateral, haz clic en **"Pages"**
4. En **"Source"**: selecciona **"main"** branch
5. Deja la carpeta en **"/ (root)"**
6. Haz clic en **"Save"**
7. Espera 1-2 minutos
8. **¡Tu app estará en línea en:** `https://TU_USUARIO.github.io/basketball-rpe-tracker/`

---

## 🔒 PARTE 4: Configurar la seguridad de Firebase (OBLIGATORIO)

La app guarda **datos de salud de deportistas** (lesiones, notas clínicas, bienestar).
La dirección de la base de datos y la clave de Firebase viajan dentro del JavaScript de la
web, así que cualquiera puede verlas. Lo único que protege los datos son las **reglas**.

⚠️ **NUNCA publiques reglas abiertas** (`".read": true, ".write": true`) ni dejes el
"modo de prueba": cualquier persona de internet podría leer y modificar todo.

Las reglas correctas ya están preparadas en el archivo `firebase-rules.json` del proyecto.
Hay tres tipos de cuenta (roles):

| Rol | Qué puede hacer |
|---|---|
| `staff` | Todo, incluida la gestión de usuarios |
| `fisio` | Todo lo de los datos del equipo, pero no ve la lista de usuarios |
| `player` | Solo enviar su propio bienestar y RPE |

Una cuenta **sin rol no puede hacer nada**. Por eso el orden de estos pasos importa.

### Paso 4.1: Activar el acceso con email y contraseña
1. Firebase Console → **"Compilación"** → **"Authentication"** → **"Comenzar"**
2. Pestaña **"Sign-in method"** → **"Correo electrónico/contraseña"** → actívalo → **"Guardar"**

### Paso 4.2: Crear tu cuenta de staff
1. Authentication → pestaña **"Usuarios"** → **"Añadir usuario"**
2. Escribe tu email y una contraseña larga → **"Añadir usuario"**
3. Copia el **UID** de la cuenta que aparece en la lista (una cadena larga de letras y números)

### Paso 4.3: Darte el rol de staff (hazlo ANTES de publicar las reglas)
1. Realtime Database → pestaña **"Datos"**
2. Crea esta estructura (usa el **"+"** junto a la raíz de la base de datos):

```
users
  └── (tu UID)
        ├── role: staff
        ├── displayName: tu nombre
        └── email: tu email
```

Escribe `staff` en minúsculas, exactamente así.

### Paso 4.4: Publicar las reglas
1. Realtime Database → pestaña **"Reglas"**
2. Abre el archivo `firebase-rules.json` del proyecto, copia **todo** su contenido
3. Reemplaza lo que haya en la consola y haz clic en **"Publicar"**

### Paso 4.5: Comprobar que son seguras
1. En la pestaña **"Reglas"** abre el **"Simulador"** (Rules Playground)
2. Tipo **"Lectura"**, ubicación `/players`, activa **"Autenticado"** con un UID inventado
   (por ejemplo `uid-que-no-existe`) → debe salir **denegado**
3. Repite con **tu UID** → debe salir **permitido**
4. Entra en la app con tu cuenta y comprueba que ves tus datos

### Crear el resto de cuentas (fisio y jugadoras)
Hazlo desde la propia app: ⚙️ → **"Gestionar PINs"** (abre la gestión de usuarios).
Ahí eliges el rol de cada cuenta. No hace falta tocar la consola.

---

## 🎉 PARTE 5: ¡Usar la App!

### Compartir con tu equipo
1. Comparte el enlace: `https://TU_USUARIO.github.io/basketball-rpe-tracker/`
2. Cada persona entra con su propia cuenta y ve solo lo que permite su rol
3. Los cambios aparecen en tiempo real para todos los usuarios

### Pasar datos existentes (si ya tenías datos de una versión anterior)
1. En la versión anterior, descarga una copia de seguridad desde el menú ⚙️
2. En la app nueva, entra con tu cuenta de staff
3. Abre ⚙️ → "Restaurar backup" y elige ese archivo
4. Los datos se subirán a Firebase y aparecerán en todos los dispositivos

### Verificar que funciona en tiempo real
1. Abre la app en dos pestañas diferentes (o dos dispositivos)
2. Añade una sesión en una pestaña
3. ¡Debería aparecer automáticamente en la otra!

---

## 🔧 Mantenimiento

### Actualizar la app después de cambios
```bash
cd BasketballRPE-Web
git add .
git commit -m "Descripción de los cambios"
git push
```

Espera 1-2 minutos y los cambios estarán en línea.

### Ver uso de Firebase
1. Firebase Console → Realtime Database → **"Uso"**
2. Plan gratuito incluye:
   - 1 GB de almacenamiento
   - 10 GB de transferencia/mes
   (Más que suficiente para un equipo)

### Backup manual
1. Firebase Console → Realtime Database
2. Menú **"⋮"** → **"Exportar JSON"**
3. Guarda el archivo como backup

---

## ❓ Solución de Problemas

### "No se conecta a Firebase"
- Verifica que copiaste bien todos los valores en `firebase-config.js`
- Revisa la consola del navegador (F12) para ver errores específicos

### "Permission denied"
- **No pongas las reglas en `true`**: dejaría los datos abiertos a todo internet
- Comprueba que tu cuenta tiene rol: Realtime Database → Datos → `users` → tu UID → `role`
  (debe ser `staff`, `fisio` o `player`, en minúsculas)
- Comprueba que las reglas publicadas son las de `firebase-rules.json` (Parte 4)

### "Los datos no se sincronizan"
- Abre la consola del navegador (F12)
- Debería decir "🟢 Conectado a Firebase"
- Si dice "🔴 Desconectado", revisa tu conexión a internet

### "GitHub Pages no se actualiza"
- Los cambios tardan 1-2 minutos en aparecer
- Prueba a limpiar la caché del navegador (Ctrl + Shift + R)

---

## 📞 Próximos Pasos Opcionales

Si quieres mejorar la seguridad o añadir funciones:
1. **Dominio personalizado** (ej: `rpe-baloncesto.com`)
2. **Notificaciones push** cuando se añaden sesiones

¡Dime si necesitas ayuda con alguno de estos pasos!

---

## 📝 Resumen de URLs Importantes

- **Firebase Console**: https://console.firebase.google.com/
- **GitHub**: https://github.com/
- **Tu App** (después de publicar): `https://TU_USUARIO.github.io/basketball-rpe-tracker/`

---

¡Listo! Tu app colaborativa está en marcha 🚀🏀

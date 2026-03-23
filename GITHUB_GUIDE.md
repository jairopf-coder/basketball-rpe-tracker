# 🚀 Guía para Subir a GitHub y Usar la App

## 📋 Paso 1: Preparar GitHub

### Crear Cuenta (si no tienes)
1. Ve a [github.com](https://github.com)
2. Haz clic en "Sign up"
3. Sigue los pasos de registro

### Crear Repositorio
1. Una vez logueado, haz clic en **"+"** (arriba derecha) → **"New repository"**
2. Configura:
   - **Repository name**: `basketball-rpe-tracker` (o el que prefieras)
   - **Description**: `Progressive Web App para monitorizar RPE y ratio agudo:crónico en baloncesto`
   - **Public** o **Private** (tu elección)
   - ✅ **Add a README** file
   - License: **MIT License**
3. Clic en **"Create repository"**

---

## 💻 Paso 2: Subir los Archivos

### Opción A: Desde la Web (Más Fácil)

1. En tu repositorio, clic en **"Add file"** → **"Upload files"**
2. Arrastra TODOS los archivos de la carpeta `BasketballRPE-Web`:
   ```
   ├── index.html
   ├── styles.css
   ├── app.js
   ├── chart.js
   ├── backup.js
   ├── manifest.json
   ├── sw.js
   ├── README.md
   ├── .gitignore
   ├── LICENSE
   └── CONTRIBUTING.md
   ```
3. Escribe un mensaje de commit: `Initial commit - Basketball RPE Tracker v2.0`
4. Clic en **"Commit changes"**

### Opción B: Usando Git (Terminal)

```bash
cd C:\Users\Jairo\.easyclaw\workspace\BasketballRPE-Web

# Inicializar repositorio
git init

# Añadir archivos
git add .

# Primer commit
git commit -m "Initial commit - Basketball RPE Tracker v2.0"

# Conectar con GitHub (sustituye TU_USUARIO y TU_REPO)
git remote add origin https://github.com/TU_USUARIO/TU_REPO.git

# Subir
git branch -M main
git push -u origin main
```

---

## 🌐 Paso 3: Activar GitHub Pages (App Online Gratis)

1. En tu repositorio, ve a **Settings** (⚙️)
2. En el menú izquierdo, clic en **Pages**
3. En **Source**, selecciona:
   - Branch: **main**
   - Folder: **/ (root)**
4. Clic en **Save**
5. Espera 1-2 minutos
6. ✅ Tu app estará en: `https://TU_USUARIO.github.io/TU_REPO/`

**Ejemplo**: `https://jairodoe.github.io/basketball-rpe-tracker/`

---

## 📱 Paso 4: Usar la App en iPad

### Acceder
1. Abre Safari en tu iPad
2. Ve a tu URL de GitHub Pages
3. ¡Listo! Ya funciona

### Instalar como App (PWA)
1. En Safari, pulsa el botón **Compartir** (cuadrado con flecha ↑)
2. Selecciona **"Añadir a pantalla de inicio"**
3. Dale un nombre: "RPE Basketball"
4. ¡Ya tienes la app en tu iPad! 🎉

### Ventajas
- ✅ Funciona **offline** (sin internet después de la primera carga)
- ✅ Datos guardados **localmente** en tu iPad
- ✅ Acceso desde cualquier lugar con internet
- ✅ **Gratis** para siempre
- ✅ Actualizaciones automáticas al actualizar GitHub

---

## 🔄 Paso 5: Actualizar la App

Cuando hagas cambios:

### Desde la Web
1. Ve a tu repositorio
2. Navega al archivo que quieras editar
3. Clic en el ícono del lápiz ✏️
4. Haz tus cambios
5. Scroll abajo → **"Commit changes"**
6. En 1-2 minutos estará actualizado en GitHub Pages

### Desde Terminal
```bash
cd C:\Users\Jairo\.easyclaw\workspace\BasketballRPE-Web

git add .
git commit -m "Descripción de los cambios"
git push
```

---

## 🎯 Mejoras Recomendadas

### 1. **Custom Domain** (Opcional)
- Compra un dominio: `rpe-baloncesto.com`
- Configuralo en GitHub Pages
- Más profesional

### 2. **Sincronización en la Nube**
```javascript
// Añadir en app.js
// Sincronizar con Firebase, Supabase, etc.
```

### 3. **Analytics** (Ver uso)
```javascript
// Google Analytics o Plausible
```

### 4. **Notificaciones Push**
```javascript
// Avisos cuando ratio > 1.5
```

---

## 📊 Estadísticas del Proyecto

Para ver quién usa tu app (GitHub Insights):
1. Ve a tu repositorio
2. Clic en **Insights** (gráfico 📈)
3. **Traffic** → Ver visitas

---

## 🆘 Problemas Comunes

### "404 - Page not found"
- Espera 5 minutos después de activar GitHub Pages
- Verifica que el archivo `index.html` esté en la raíz

### "La app no funciona offline"
- Limpia caché del navegador
- Verifica que `sw.js` esté correctamente subido

### "No se guardan los datos"
- Verifica que localStorage esté habilitado
- Prueba en modo incógnito

---

## 🎓 Recursos Útiles

- [GitHub Docs](https://docs.github.com)
- [GitHub Pages](https://pages.github.com)
- [PWA Guide](https://web.dev/progressive-web-apps/)
- [Git Cheat Sheet](https://education.github.com/git-cheat-sheet-education.pdf)

---

## ✨ Tu App en Vivo

Una vez configurado, tu app estará disponible en:
```
https://TU_USUARIO.github.io/basketball-rpe-tracker/
```

**Comparte este link** con:
- 👥 Otras entrenadoras
- 🏀 Tu equipo
- 📱 Instálala en todos los dispositivos

---

¿Necesitas ayuda? Abre un Issue en GitHub: `https://github.com/TU_USUARIO/TU_REPO/issues`

¡Disfruta tu app! 🏀📊

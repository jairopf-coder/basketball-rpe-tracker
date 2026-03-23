# 🚀 Guía Rápida de Despliegue

## Opción 1: GitHub Pages (Gratis, Más Fácil)

### Paso a Paso Completo:

1. **Crear repositorio en GitHub**
   - Ve a https://github.com/new
   - Nombre: `basketball-rpe-tracker`
   - Public
   - NO marques "Add a README"
   - Create repository

2. **Subir archivos**
   
   **Desde Windows (PowerShell):**
   ```powershell
   cd C:\Users\Jairo\.easyclaw\workspace\BasketballRPE-Web
   
   git init
   git add .
   git commit -m "Initial commit - Basketball RPE Tracker v2.0"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/basketball-rpe-tracker.git
   git push -u origin main
   ```

3. **Activar GitHub Pages**
   - En tu repositorio: Settings → Pages
   - Source: **main** branch, **/ (root)**
   - Save
   - Espera 2-3 minutos

4. **¡Listo!**
   - Tu app estará en: `https://TU_USUARIO.github.io/basketball-rpe-tracker/`

---

## Opción 2: Netlify (1-Click, También Gratis)

1. Ve a https://app.netlify.com/drop
2. Arrastra la carpeta `BasketballRPE-Web` completa
3. ¡Listo! Te da una URL: `https://random-name.netlify.app`

**Ventaja**: Actualización automática si conectas con GitHub

---

## Opción 3: Vercel (Profesional, Gratis)

1. Ve a https://vercel.com
2. Conecta con GitHub
3. Import repository
4. Deploy
5. URL: `https://basketball-rpe-tracker.vercel.app`

---

## Actualizar la App

Cuando hagas cambios en los archivos:

```powershell
cd C:\Users\Jairo\.easyclaw\workspace\BasketballRPE-Web

git add .
git commit -m "Descripción de cambios"
git push
```

GitHub Pages/Netlify/Vercel se actualizarán automáticamente en 1-2 minutos.

---

## Usar en iPad

1. Abre Safari
2. Ve a tu URL (GitHub Pages/Netlify/Vercel)
3. Botón Compartir → "Añadir a pantalla de inicio"
4. ¡App instalada! 🎉

**Funciona offline** después de la primera carga.

---

## Compartir con Otras Entrenadoras

Simplemente comparte tu URL:
```
https://TU_USUARIO.github.io/basketball-rpe-tracker/
```

Cualquiera puede usarla. Los datos de cada persona se guardan **localmente** en su dispositivo (privacidad total).

---

## Dominio Personalizado (Opcional)

Si compras un dominio (ej: `rpe-baloncesto.com`):

### En GitHub Pages:
1. Settings → Pages → Custom domain
2. Escribe tu dominio
3. En tu proveedor de dominio, configura DNS:
   ```
   CNAME: TU_USUARIO.github.io
   ```

### En Netlify/Vercel:
1. Project Settings → Domain Management
2. Add custom domain
3. Sigue las instrucciones DNS

---

## ¿Problemas?

### No funciona GitHub Pages
- Espera 5 minutos
- Verifica que `index.html` esté en la raíz
- Settings → Pages → Check source branch

### No funciona offline
- Limpia caché del navegador
- Vuelve a cargar la página
- Verifica que `sw.js` esté cargado (DevTools → Application → Service Workers)

### No se guardan los datos
- Verifica que cookies/localStorage estén habilitados
- Prueba en ventana normal (no incógnito para testing)

---

¡Eso es todo! 🎉

# ✅ CHECKLIST - Publicar Basketball RPE Tracker

Sigue estos pasos en orden. Marca cada uno cuando lo completes.

---

## 🔥 FIREBASE (15 min)

- [ ] 1. Ir a https://firebase.google.com/ y crear cuenta
- [ ] 2. Crear nuevo proyecto llamado `basketball-rpe-tracker`
- [ ] 3. Ir a "Realtime Database" y crear base de datos
- [ ] 4. Seleccionar ubicación: `europe-west1`
- [ ] 5. Seleccionar "Modo de prueba"
- [ ] 6. Ir a ⚙️ → Configuración del proyecto
- [ ] 7. Hacer clic en el ícono `</>` para añadir app web
- [ ] 8. Copiar los valores de `firebaseConfig`
- [ ] 9. Abrir `firebase-config.js` y pegar tus valores
- [ ] 10. Guardar el archivo

---

## 🧪 PROBAR LOCAL (5 min)

- [ ] 11. Abrir terminal en carpeta `BasketballRPE-Web`
- [ ] 12. Ejecutar: `python3 -m http.server 3000` (en Windows: `python -m http.server 3000`)
- [ ] 13. Abrir navegador en http://localhost:3000
- [ ] 14. Abrir consola del navegador (F12)
- [ ] 15. Verificar que aparece: "🟢 Conectado a Firebase"
- [ ] 16. Probar añadir un jugador o sesión

---

## 🌐 GITHUB (10 min)

- [ ] 17. Ir a https://github.com/ (crear cuenta si no tienes)
- [ ] 18. Crear nuevo repositorio público: `basketball-rpe-tracker`
- [ ] 19. Subir el código (usar GitHub Desktop o comandos)
- [ ] 20. Ir a Settings → Pages
- [ ] 21. Source: seleccionar branch `main`
- [ ] 22. Save
- [ ] 23. Esperar 2 minutos
- [ ] 24. Visitar: `https://TU_USUARIO.github.io/basketball-rpe-tracker/`

---

## 🔒 SEGURIDAD (10 min) — OBLIGATORIO antes de compartir el enlace

⚠️ Nunca uses el "modo de prueba" ni reglas con `".read": true`. Los datos son de salud.

- [ ] 25. Crear tu cuenta de staff (Authentication) y darle `role: staff` en Realtime Database → `users/TU_UID` (Parte 4 de INSTRUCCIONES-FIREBASE.md, pasos 4.1 a 4.3)
- [ ] 26. Realtime Database → Reglas
- [ ] 27. Copiar y pegar TODO el contenido del archivo `firebase-rules.json`
- [ ] 28. Publicar y comprobar con el Simulador que una cuenta sin rol queda denegada (paso 4.5)

---

## 🎉 COMPARTIR

- [ ] 29. Copiar el enlace: `https://TU_USUARIO.github.io/basketball-rpe-tracker/`
- [ ] 30. Compartirlo con tu equipo
- [ ] 31. Probar en dos dispositivos simultáneamente

---

## 📱 EXTRAS (opcional)

- [ ] Si tenías datos locales, migrarlos con: `firebaseSync.migrateFromLocalStorage()`
- [ ] Hacer backup: Firebase → Realtime Database → Exportar JSON
- [ ] Guardar el enlace en favoritos

---

**Tiempo total estimado: 30-35 minutos**

¿Problemas? Consulta `INSTRUCCIONES-FIREBASE.md` para detalles completos.

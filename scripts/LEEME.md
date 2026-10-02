# Envío de recordatorios a las jugadoras (GitHub Actions)

Envía un aviso push al móvil de las jugadoras que **no han rellenado el wellness o el RPE**.
Lo lanzas tú a mano; nunca se ejecuta solo.

## Cómo se usa

1. En GitHub (web o app **GitHub Mobile**): repositorio → **Actions** → **Enviar recordatorio a jugadoras** → **Run workflow**.
2. Elige:
   - **tipo**: `wellness` o `rpe`
   - **turno**: solo para RPE (`mañana`, `tarde`, `partido`)
   - **modo**: `enviar` (manda el aviso) · `simulacro` (solo cuenta, no envía nada) · `prueba` (un aviso de prueba a una jugadora)
   - **jugadora**: solo en modo prueba
   - **fecha**: opcional (AAAA-MM-DD); vacío = hoy en hora de Madrid
3. Pulsa **Run workflow**. En la página de la ejecución, apartado **Summary**, verás las cifras.

## A quién se avisa

- **wellness**: a quien no tenga wellness ese día (ni enviado por ella ni registrado por el staff).
- **rpe**: a quien no tenga RPE de ese turno (ni enviado por ella ni una sesión registrada por el staff). No se avisa a las que tienen una lesión activa.
- En ambos casos, solo si tienen la cuenta vinculada y los avisos activados en su móvil.
  Para el resto, el resumen indica cuántas son: escríbeles por WhatsApp (en la app, «Faltan hoy» te dice quiénes).

## Configuración (una sola vez): Settings → Secrets and variables → Actions → New repository secret

| Secreto | Qué es |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Contenido COMPLETO del archivo JSON de la cuenta de servicio (Firebase → Configuración del proyecto → Cuentas de servicio → Generar nueva clave privada) |
| `VAPID_PRIVATE_KEY` | La clave **privada** que dio `generar-claves-vapid.html` |
| `FIREBASE_CONFIG` | Ya existe: lo usa el despliegue. De ahí se saca la dirección de la base de datos |
| `FIREBASE_DATABASE_URL` | Opcional: solo si el anterior no la incluye |
| `VAPID_SUBJECT` | Opcional: `mailto:tu@correo` si quieres usar un correo en vez de la web de la app |

La clave **pública** no es un secreto: está en `push-client.js` (`VAPID_PUBLIC_KEY`) y el script la lee de allí.
El script comprueba que la privada y la pública son del mismo par y, si no, se detiene con un mensaje claro.

## Privacidad

Los registros de GitHub Actions pueden ser públicos si el repositorio lo es. Por eso el script **nunca**
escribe nombres, identificadores ni direcciones de móvil: solo cifras. Los avisos tampoco llevan datos de salud.

## Si algo falla

- El error aparece en rojo con una frase en español en la página de la ejecución.
- `410` / `404` al enviar: ese móvil ya no existe (app borrada o permiso retirado); el script limpia su suscripción
  y la jugadora tendrá que volver a pulsar «Activar avisos».
- Pruebas (sin instalar nada): `node test/reminders.test.js`

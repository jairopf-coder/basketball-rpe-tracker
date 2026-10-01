// ======================================================================
// PLAYER I18N — Traducciones ES/EN para las pantallas accesibles
// por jugadoras: login, ayuda de instalación y formulario wellness/RPE.
// Objeto de traducciones simple (sin librerías), preferencia guardada
// en localStorage bajo la clave 'bk_playerLang'.
// ======================================================================

const PlayerI18n = (() => {
    const STORAGE_KEY = 'bk_playerLang';

    const DICT = {
        es: {
            // Login
            loginTitle: 'Load Ctrl',
            loginSubtitle: 'Accede con tu cuenta',
            loginEmail: 'Email',
            loginPassword: 'Contraseña',
            loginBtn: 'Entrar',
            installHelpToggle: '¿No tienes la app instalada? Ver cómo añadirla',

            // Pantalla / ayuda de instalación
            installTitle: 'Instala la app primero',
            installSubtitle: 'Para registrar tu wellness necesitas tener la app guardada en tu pantalla de inicio. Solo tarda 30 segundos.',
            installConfirmLabel: 'Cuando la tengas instalada, ábrela desde tu pantalla de inicio y vuelve a entrar.',
            installConfirmBtn: '✅ Ya la tengo instalada',
            installNotDetected: '⚠️ No detectada como instalada — ábrela desde tu pantalla de inicio',
            installBackBtn: '🔒 Volver al inicio',
            iosStep1Title: 'Abre esta página en Safari',
            iosStep1Sub: 'Debe ser Safari de Apple, no Chrome ni otro navegador.',
            iosStep2Title: 'Pulsa el botón Compartir',
            iosStep2Sub: 'El icono ⬆ en la barra inferior de Safari.',
            iosStep3Title: 'Toca "Añadir a pantalla de inicio"',
            iosStep3Sub: 'Desplázate en el menú y pulsa ese botón. Luego toca Añadir.',
            androidStep1Title: 'Abre esta página en Chrome',
            androidStep1Sub: 'Usa Google Chrome para Android.',
            androidStep2Title: 'Pulsa el menú ⋮ (tres puntos)',
            androidStep2Sub: 'En la esquina superior derecha de Chrome.',
            androidStep3Title: 'Selecciona "Añadir a pantalla de inicio"',
            androidStep3Sub: 'O si aparece el banner de instalación, pulsa Instalar.',
            desktopStepTitle: 'Abre esta página desde un móvil',
            desktopStepSub: 'La app de wellness está pensada para iPhone o Android.',

            // PlayerView (RPE + wellness)
            pvGreeting: '¡Hola,',
            pvDefaultName: 'Jugadora',
            pvRpeLabel: '🏃 RPE — Percepción del esfuerzo',
            pvRpeMove: 'Elige un valor',
            pvDateLabel: '📅 Fecha',
            pvSubmit: 'Registrar',
            pvSaving: 'Guardando…',
            pvLogout: '🔒 Salir',
            pvErrorSave: 'Error al guardar. Inténtalo de nuevo.',
            pvDoneTitle: '¡Registrado!',
            pvDoneSub: 'Tus datos han sido enviados al cuerpo técnico.<br>¡Hasta mañana!',
            pvAlreadyTitle: '¡Ya respondiste hoy!',
            pvAlreadySub: 'Ya has enviado tu cuestionario de hoy.<br>¡Hasta mañana!',
            pvPeriodLabel: '🩸 Ciclo menstrual',
            pvPeriodYes: 'Sí, tengo la regla',
            pvPeriodHint: 'Márcalo solo mientras la tengas. Cuando termine, no selecciones nada.',
            pvPushTitle: '🔔 Avisos',
            pvPushDesc: 'Recibe un recordatorio en este móvil si te falta rellenar el wellness o el RPE.',
            pvPushEnable: 'Activar avisos',
            pvPushDisable: 'Desactivar avisos',
            pvPushWorking: 'Activando…',
            pvPushActive: '✅ Avisos activados en este móvil',
            pvPushDenied: 'Los avisos están bloqueados. Para activarlos, ve a Ajustes → Notificaciones → esta app y permite las notificaciones.',
            pvPushUnsupported: 'Este móvil no admite avisos. En iPhone hace falta iOS 16.4 o superior.',
            pvPushPreview: 'Vista previa: los avisos solo se activan desde el móvil de cada jugadora.',
            pvPushErrDismissed: 'No se han activado. Puedes intentarlo de nuevo cuando quieras.',
            pvPushErrSw: 'La app aún se está preparando. Ciérrala del todo, ábrela de nuevo e inténtalo otra vez.',
            pvPushErrSave: 'Activados en este móvil, pero no se pudo guardar. Se reintentará al abrir la app.',
            pvPushErrGeneric: 'No se pudo completar. Inténtalo de nuevo en unos segundos.',
            pvPushPrivacy: 'Solo se usan para estos recordatorios. Puedes desactivarlos cuando quieras.',
            dateLocale: 'es-ES',

            // Menú principal (Wellness / RPE)
            menuWellnessBtn: 'Wellness diario',
            menuRpeBtn: 'RPE de sesión',
            backBtn: '← Volver',
            backToMenuBtn: 'Volver al menú',

            // Selección de tipo de sesión para el RPE
            rpeSelectTypeTitle: '¿Qué sesión quieres valorar?',
            rpeTypeMorning: 'Mañana',
            rpeTypeAfternoon: 'Tarde',
            rpeTypeMatch: 'Partido',
            rpeSelectValueSub: 'Valora del 1 (mínimo esfuerzo) al 10 (máximo esfuerzo)',
            rpeSubmit: 'Registrar RPE',

            rpeLabels: ['', 'Reposo absoluto', 'Muy, muy suave', 'Suave', 'Moderado', 'Algo duro', 'Duro', 'Muy duro', 'Muy, muy duro', 'Casi máximo', 'Esfuerzo máximo'],
            wellness: {
                sleep:   { icon: '😴', label: 'Calidad del sueño', subs: ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'] },
                fatigue: { icon: '💪', label: 'Nivel de fatiga',   subs: ['Agotada', 'Muy cansada', 'Cansada', 'Bien', 'Fresca'] },
                mood:    { icon: '😊', label: 'Estado de ánimo',   subs: ['Muy bajo', 'Bajo', 'Normal', 'Bueno', 'Excelente'] },
                pain:    { icon: '🦵', label: 'Dolor muscular',    subs: ['Mucho dolor', 'Dolor', 'Algo', 'Leve', 'Sin dolor'] },
            },
        },
        en: {
            loginTitle: 'Load Ctrl',
            loginSubtitle: 'Sign in to your account',
            loginEmail: 'Email',
            loginPassword: 'Password',
            loginBtn: 'Sign in',
            installHelpToggle: "Don't have the app installed? See how to add it",

            installTitle: 'Install the app first',
            installSubtitle: 'To log your wellness you need the app saved to your home screen. It only takes 30 seconds.',
            installConfirmLabel: 'Once installed, open it from your home screen and log in again.',
            installConfirmBtn: '✅ I already installed it',
            installNotDetected: '⚠️ Not detected as installed — open it from your home screen',
            installBackBtn: '🔒 Back to start',
            iosStep1Title: 'Open this page in Safari',
            iosStep1Sub: 'It must be Apple Safari, not Chrome or another browser.',
            iosStep2Title: 'Tap the Share button',
            iosStep2Sub: "The ⬆ icon in Safari's bottom bar.",
            iosStep3Title: 'Tap "Add to Home Screen"',
            iosStep3Sub: 'Scroll the menu and tap that option. Then tap Add.',
            androidStep1Title: 'Open this page in Chrome',
            androidStep1Sub: 'Use Google Chrome for Android.',
            androidStep2Title: 'Tap the ⋮ menu (three dots)',
            androidStep2Sub: 'In the top-right corner of Chrome.',
            androidStep3Title: 'Select "Add to Home screen"',
            androidStep3Sub: 'Or if the install banner appears, tap Install.',
            desktopStepTitle: 'Open this page from a phone',
            desktopStepSub: 'The wellness app is designed for iPhone or Android.',

            pvGreeting: 'Hi,',
            pvDefaultName: 'Player',
            pvRpeLabel: '🏃 RPE — Perceived exertion',
            pvRpeMove: 'Choose a value',
            pvDateLabel: '📅 Date',
            pvSubmit: 'Submit',
            pvSaving: 'Saving…',
            pvLogout: '🔒 Log out',
            pvErrorSave: 'Error saving. Please try again.',
            pvDoneTitle: 'Submitted!',
            pvDoneSub: 'Your data has been sent to the coaching staff.<br>See you tomorrow!',
            pvAlreadyTitle: 'Already submitted today!',
            pvAlreadySub: "You've already sent today's questionnaire.<br>See you tomorrow!",
            pvPeriodLabel: '🩸 Menstrual cycle',
            pvPeriodYes: 'Yes, I have my period',
            pvPeriodHint: 'Select it only while you have it. When it ends, just leave it unselected.',
            pvPushTitle: '🔔 Reminders',
            pvPushDesc: "Get a reminder on this phone if you haven't filled in your wellness or RPE.",
            pvPushEnable: 'Turn on reminders',
            pvPushDisable: 'Turn off reminders',
            pvPushWorking: 'Turning on…',
            pvPushActive: '✅ Reminders are on for this phone',
            pvPushDenied: 'Reminders are blocked. To turn them on, go to Settings → Notifications → this app and allow notifications.',
            pvPushUnsupported: 'This phone does not support reminders. On iPhone you need iOS 16.4 or later.',
            pvPushPreview: "Preview: reminders can only be turned on from each player's own phone.",
            pvPushErrDismissed: "They weren't turned on. You can try again whenever you like.",
            pvPushErrSw: 'The app is still getting ready. Close it completely, open it again and try once more.',
            pvPushErrSave: "Turned on for this phone, but it couldn't be saved. It will be retried when you open the app.",
            pvPushErrGeneric: 'Something went wrong. Please try again in a few seconds.',
            pvPushPrivacy: 'They are only used for these reminders. You can turn them off at any time.',
            dateLocale: 'en-GB',

            // Main menu (Wellness / RPE)
            menuWellnessBtn: 'Daily wellness',
            menuRpeBtn: 'Session RPE',
            backBtn: '← Back',
            backToMenuBtn: 'Back to menu',

            // Session type selection for RPE
            rpeSelectTypeTitle: 'Which session do you want to rate?',
            rpeTypeMorning: 'Morning',
            rpeTypeAfternoon: 'Afternoon',
            rpeTypeMatch: 'Match',
            rpeSelectValueSub: 'Rate from 1 (minimum effort) to 10 (maximum effort)',
            rpeSubmit: 'Submit RPE',

            rpeLabels: ['', 'Complete rest', 'Very, very light', 'Light', 'Moderate', 'Somewhat hard', 'Hard', 'Very hard', 'Very, very hard', 'Near maximal', 'Maximal effort'],
            wellness: {
                sleep:   { icon: '😴', label: 'Sleep quality',   subs: ['Very poor', 'Poor', 'Fair', 'Good', 'Very good'] },
                fatigue: { icon: '💪', label: 'Fatigue level',   subs: ['Exhausted', 'Very tired', 'Tired', 'Good', 'Fresh'] },
                mood:    { icon: '😊', label: 'Mood',            subs: ['Very low', 'Low', 'Normal', 'Good', 'Excellent'] },
                pain:    { icon: '🦵', label: 'Muscle soreness', subs: ['A lot of pain', 'Pain', 'Some', 'Mild', 'No pain'] },
            },
        },
    };

    function getLang() {
        const stored = localStorage.getItem(STORAGE_KEY);
        return (stored === 'en' || stored === 'es') ? stored : 'es';
    }

    function setLang(lang) {
        localStorage.setItem(STORAGE_KEY, lang === 'en' ? 'en' : 'es');
    }

    function t(key) {
        const dict = DICT[getLang()];
        return (dict && dict[key] !== undefined) ? dict[key] : DICT.es[key];
    }

    function wellnessMeta() { return DICT[getLang()].wellness; }
    function rpeLabels()    { return DICT[getLang()].rpeLabels; }

    /** Botón compacto ES/EN. onToggleFnName es el nombre de la función global a llamar con el idioma elegido. */
    function toggleHTML(onToggleFnName) {
        const lang = getLang();
        return `
        <div class="pi18n-toggle" role="group" aria-label="Idioma / Language">
            <button type="button" class="pi18n-btn${lang === 'es' ? ' active' : ''}" onclick="${onToggleFnName}('es')">ES</button>
            <button type="button" class="pi18n-btn${lang === 'en' ? ' active' : ''}" onclick="${onToggleFnName}('en')">EN</button>
        </div>`;
    }

    return { getLang, setLang, t, wellnessMeta, rpeLabels, toggleHTML };
})();

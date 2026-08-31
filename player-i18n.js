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
            loginTitle: 'RPE Baloncesto',
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
            pvRpeSub: '¿Cómo fue de duro el último entrenamiento?',
            pvRpeMove: 'Mueve el slider',
            pvDateLabel: '📅 Fecha',
            pvSubmit: 'Registrar',
            pvSaving: 'Guardando…',
            pvLogout: '🔒 Salir',
            pvErrorSave: 'Error al guardar. Inténtalo de nuevo.',
            pvDoneTitle: '¡Registrado!',
            pvDoneSub: 'Tus datos han sido enviados al cuerpo técnico.<br>¡Hasta mañana!',
            pvAlreadyTitle: '¡Ya respondiste hoy!',
            pvAlreadySub: 'Ya has enviado tu cuestionario de hoy.<br>¡Hasta mañana!',
            dateLocale: 'es-ES',

            rpeLabels: ['', 'Reposo absoluto', 'Muy, muy suave', 'Suave', 'Moderado', 'Algo duro', 'Duro', 'Muy duro', 'Muy, muy duro', 'Casi máximo', 'Esfuerzo máximo'],
            wellness: {
                sleep:   { icon: '😴', label: 'Calidad del sueño', subs: ['Muy mal', 'Mal', 'Regular', 'Bien', 'Muy bien'] },
                fatigue: { icon: '💪', label: 'Nivel de fatiga',   subs: ['Agotada', 'Muy cansada', 'Cansada', 'Bien', 'Fresca'] },
                mood:    { icon: '😊', label: 'Estado de ánimo',   subs: ['Muy bajo', 'Bajo', 'Normal', 'Bueno', 'Excelente'] },
                pain:    { icon: '🦵', label: 'Dolor muscular',    subs: ['Mucho dolor', 'Dolor', 'Algo', 'Leve', 'Sin dolor'] },
            },
        },
        en: {
            loginTitle: 'RPE Basketball',
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
            pvRpeSub: 'How hard was your last training session?',
            pvRpeMove: 'Move the slider',
            pvDateLabel: '📅 Date',
            pvSubmit: 'Submit',
            pvSaving: 'Saving…',
            pvLogout: '🔒 Log out',
            pvErrorSave: 'Error saving. Please try again.',
            pvDoneTitle: 'Submitted!',
            pvDoneSub: 'Your data has been sent to the coaching staff.<br>See you tomorrow!',
            pvAlreadyTitle: 'Already submitted today!',
            pvAlreadySub: "You've already sent today's questionnaire.<br>See you tomorrow!",
            dateLocale: 'en-GB',

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

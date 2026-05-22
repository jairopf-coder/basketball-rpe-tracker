// ============================================================
//  firebase-config.js — INSTRUCCIONES DE SEGURIDAD
// ============================================================
//  ⚠️  NUNCA subas este archivo con credenciales reales a Git.
//  Añade firebase-config.js a tu .gitignore.
//
//  OPCIÓN A — GitHub Pages (recomendado para este proyecto):
//  1. Ve a Settings → Secrets and variables → Actions
//  2. Crea un secret: FIREBASE_CONFIG con el JSON completo
//  3. En tu workflow de deploy, genera este archivo:
//
//     - name: Inject Firebase config
//       run: |
//         echo "const firebaseConfig = ${{ secrets.FIREBASE_CONFIG }};" > firebase-config.js
//         echo "if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }" >> firebase-config.js
//         echo "firebase.database().goOnline();" >> firebase-config.js
//         echo "window.firebaseDB   = firebase.database();" >> firebase-config.js
//         echo "window.firebaseAuth = firebase.auth();" >> firebase-config.js
//
//  OPCIÓN B — Desarrollo local:
//  Copia este archivo como firebase-config.js y rellena los valores.
//  Asegúrate de que firebase-config.js está en .gitignore.
// ============================================================

const firebaseConfig = {
  apiKey:            "TU_API_KEY",
  authDomain:        "TU_PROJECT.firebaseapp.com",
  databaseURL:       "https://TU_PROJECT-default-rtdb.europe-west1.firebasedatabase.app",
  projectId:         "TU_PROJECT",
  storageBucket:     "TU_PROJECT.firebasestorage.app",
  messagingSenderId: "TU_SENDER_ID",
  appId:             "TU_APP_ID"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

firebase.database().goOnline();
firebase.database().ref('.info/connected').on('value', () => {});

window.firebaseDB   = firebase.database();
window.firebaseAuth = firebase.auth();

console.log("🟢 Firebase inicializado correctamente (Auth + Database)");

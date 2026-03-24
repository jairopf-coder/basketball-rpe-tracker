const firebaseConfig = {
  apiKey: "AIzaSyBWkam7e4k_hCaCtsyyA69bmweOI-IIfII",
  authDomain: "basketball-rpe-tracker.firebaseapp.com",
  databaseURL: "https://basketball-rpe-tracker-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "basketball-rpe-tracker",
  storageBucket: "basketball-rpe-tracker.firebasestorage.app",
  messagingSenderId: "511594144885",
  appId: "1:511594144885:web:956041749159b6d6ec843c"
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Persistencia offline: los cambios se guardan aunque no haya conexión
firebase.database().goOnline();
firebase.database().ref('.info/connected').on('value', () => {});

window.firebaseDB = firebase.database();
console.log("🟢 Firebase inicializado correctamente");

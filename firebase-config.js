const firebaseConfig = {"apiKey":"AIzaSyDQ9ywSyo5nt2zL0QH9KeHXyrMvnTjwmCA","authDomain":"basketball-rpe-tracker.firebaseapp.com","databaseURL":"https://basketball-rpe-tracker-default-rtdb.europe-west1.firebasedatabase.app","projectId":"basketball-rpe-tracker","storageBucket":"basketball-rpe-tracker.firebasestorage.app","messagingSenderId":"511594144885","appId":"1:511594144885:web:956041749159b6d6ec843c"};
if (!firebase.apps.length) { firebase.initializeApp(firebaseConfig); }
firebase.database().goOnline();
firebase.database().ref('.info/connected').on('value', function(){});
window.firebaseDB   = firebase.database();
window.firebaseAuth = firebase.auth();
if (window._devMode) console.log('🟢 Firebase inicializado correctamente (Auth + Database)');

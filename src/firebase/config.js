import { initializeApp, getApps } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Coloca aquí tus credenciales de Firebase cuando las tengas listas.
const firebaseConfig = {
  apiKey: "AIzaSyCFMYfRGiLPSQg5jr0SwWsF-oHnMwQZSok",
  authDomain: "meraki-aplicacion.firebaseapp.com",
  projectId: "meraki-aplicacion",
  storageBucket: "meraki-aplicacion.firebasestorage.app",
  messagingSenderId: "241299454474",
  appId: "1:241299454474:web:9776666f681f3de5afbdf3"
};

// Verificar si las credenciales son reales o son los placeholders
const isConfigured = 
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "REPLACE_WITH_YOUR_KEY" &&
  !firebaseConfig.apiKey.startsWith("REPLACE_");

let app = null;
let auth = null;
let db = null;

if (isConfigured) {
  try {
    if (!getApps().length) {
      app = initializeApp(firebaseConfig);
    } else {
      app = getApps()[0];
    }
    auth = getAuth(app);
    db = getFirestore(app);
    console.log("Firebase inicializado con éxito.");
  } catch (error) {
    console.error("Error al inicializar Firebase. Usando base de datos local simulada:", error);
    auth = null;
    db = null;
  }
} else {
  console.log("Credenciales de Firebase no configuradas. Corriendo en modo MOCK (Base de datos local en LocalStorage).");
}

export { auth, db, isConfigured };
export default app;

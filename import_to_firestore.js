import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import fs from "fs";
import path from "path";

const firebaseConfig = {
  apiKey: "AIzaSyCFMYfRGiLPSQg5jr0SwWsF-oHnMwQZSok",
  authDomain: "meraki-aplicacion.firebaseapp.com",
  projectId: "meraki-aplicacion",
  storageBucket: "meraki-aplicacion.firebasestorage.app",
  messagingSenderId: "241299454474",
  appId: "1:241299454474:web:9776666f681f3de5afbdf3"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

const initialDataPath = path.resolve("./src/db/initialData.json");
const data = JSON.parse(fs.readFileSync(initialDataPath, "utf-8"));

async function authenticateAndSetupUsers() {
  const adminEmail = "jeni@gmail.com";
  const adminPass = "jeni2026";
  const adminNombre = "Administradora Meraki (Jeni)";
  
  console.log("Autenticando script en Firebase...");
  try {
    const res = await createUserWithEmailAndPassword(auth, adminEmail, adminPass);
    console.log(`Usuario administrador creado con éxito en Firebase Auth (UID: ${res.user.uid})`);
    
    const userRef = doc(db, "usuarios", res.user.uid);
    await setDoc(userRef, {
      id: res.user.uid,
      nombre: adminNombre,
      rol: "administrador",
      correo: adminEmail
    });
    console.log("Detalles del administrador guardados en Firestore.");
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      const res = await signInWithEmailAndPassword(auth, adminEmail, adminPass);
      console.log(`El administrador ya existe. Sesión iniciada con éxito (UID: ${res.user.uid})`);
    } else {
      throw e;
    }
  }

  // Register receptionist while authenticated
  const recepEmail = "joshua@gmail.com";
  const recepPass = "joshua2026";
  const recepNombre = "Joshua (Recepción)";
  
  try {
    console.log("\nRegistrando cuenta de Recepción...");
    const res = await createUserWithEmailAndPassword(auth, recepEmail, recepPass);
    console.log(`Cuenta de Recepción creada con éxito en Firebase Auth (UID: ${res.user.uid})`);
    
    const userRef = doc(db, "usuarios", res.user.uid);
    await setDoc(userRef, {
      id: res.user.uid,
      nombre: recepNombre,
      rol: "recepcionista",
      correo: recepEmail
    });
    console.log("Detalles de Recepción guardados en Firestore.");
    
    // Log back in as admin to keep admin session active for the rest of imports
    await signInWithEmailAndPassword(auth, adminEmail, adminPass);
    console.log("Re-autenticado como Administrador.");
  } catch (e) {
    if (e.code === "auth/email-already-in-use") {
      console.log("La cuenta de Recepción ya existe en Firebase Auth.");
    } else {
      console.error("Error al registrar cuenta de Recepción:", e.message);
    }
  }
}

async function importData() {
  await authenticateAndSetupUsers();

  console.log("\nIniciando importación de colecciones a Firestore...");
  for (const collectionName of Object.keys(data)) {
    if (collectionName === "usuarios") continue;
    
    const list = data[collectionName];
    console.log(`Subiendo ${list.length} documentos a la colección '${collectionName}'...`);
    for (const item of list) {
      const docId = item.id;
      const docData = { ...item };
      delete docData.id;
      
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, docData);
    }
  }
  
  console.log("\n¡Importación completada con éxito!");
  process.exit(0);
}

importData().catch(err => {
  console.error("Error al importar datos:", err);
  process.exit(1);
});

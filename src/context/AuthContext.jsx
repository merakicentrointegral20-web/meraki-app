import React, { createContext, useContext, useState, useEffect } from "react";
import { auth, db, isConfigured } from "../firebase/config";
import { 
  signInWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  createUserWithEmailAndPassword 
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { getCollection, addDocument, setDocument } from "../db";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // --- MOCK USERS ---
  const mockUsers = [
    { email: "jeni@gmail.com", uid: "uid_admin", nombre: "Administradora Meraki (Jeni)", rol: "administrador" },
    { email: "joshua@gmail.com", uid: "uid_joshua", nombre: "Joshua (Recepción)", rol: "recepcionista" },
    { email: "toño@gmail.com", uid: "uid_tono", nombre: "Toño (Recursos Humanos)", rol: "administrador" }
  ];

  useEffect(() => {
    if (isConfigured && auth) {
      const unsubscribe = onAuthStateChanged(auth, async (user) => {
        if (user) {
          // Fetch user role from database
          try {
            const userDocSnap = await getDoc(doc(db, "usuarios", user.uid));
            const dbUser = userDocSnap.exists() ? userDocSnap.data() : null;
            if (dbUser) {
              setCurrentUser({
                uid: user.uid,
                email: user.email,
                nombre: dbUser.nombre || user.email,
                rol: dbUser.rol || "recepcionista"
              });
            } else {
              // Create user in DB if doesn't exist
              const newUserData = {
                id: user.uid,
                nombre: user.email.split("@")[0],
                rol: "recepcionista",
                correo: user.email
              };
              await setDocument("usuarios", user.uid, newUserData);
              setCurrentUser({
                uid: user.uid,
                email: user.email,
                nombre: newUserData.nombre,
                rol: newUserData.rol
              });
            }
          } catch (e) {
            console.error("Error fetching db user info:", e);
            setCurrentUser({
              uid: user.uid,
              email: user.email,
              nombre: user.email.split("@")[0],
              rol: "recepcionista"
            });
          }
        } else {
          setCurrentUser(null);
        }
        setLoading(false);
      });
      return unsubscribe;
    } else {
      // Mock mode auth persistence
      const savedUser = localStorage.getItem("meraki_logged_user");
      if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
      }
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    if (isConfigured && auth) {
      return signInWithEmailAndPassword(auth, email, password);
    } else {
      // Simulación de login en modo local
      return new Promise((resolve, reject) => {
        setTimeout(() => {
          let validated = false;
          const user = mockUsers.find(u => {
            if (u.email !== email) return false;
            if (email.includes("jeni")) return password === "jeni2026";
            if (email.includes("joshua")) return password === "joshua2026";
            if (email.includes("toño") || email.includes("tono")) return password === "toño2026" || password === "tono2026";
            return false;
          });
          if (user) {
            localStorage.setItem("meraki_logged_user", JSON.stringify(user));
            setCurrentUser(user);
            resolve(user);
          } else {
            reject(new Error("Usuario o contraseña incorrectos. Usa jeni@gmail.com (clave: jeni2026), toño@gmail.com (clave: toño2026) o joshua@gmail.com (clave: joshua2026)"));
          }
        }, 800);
      });
    }
  };

  const logout = async () => {
    if (isConfigured && auth) {
      return signOut(auth);
    } else {
      localStorage.removeItem("meraki_logged_user");
      setCurrentUser(null);
    }
  };

  const createNewUser = async (email, password, nombre, rol) => {
    if (isConfigured && auth) {
      // Create user in firebase auth
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      // Save details to Firestore
      await setDocument("usuarios", credential.user.uid, {
        id: credential.user.uid,
        nombre,
        rol,
        correo: email
      });
      return credential.user;
    } else {
      // Simular creación de usuario en modo local
      return new Promise((resolve) => {
        setTimeout(() => {
          const newMockUser = {
            id: Math.random().toString(36).substr(2, 9),
            nombre,
            rol,
            correo: email
          };
          // Add to local storage collection
          const usersList = JSON.parse(localStorage.getItem("meraki_usuarios") || "[]");
          usersList.push(newMockUser);
          localStorage.setItem("meraki_usuarios", JSON.stringify(usersList));
          resolve(newMockUser);
        }, 500);
      });
    }
  };

  const value = {
    currentUser,
    login,
    logout,
    createNewUser,
    isLocalDb: !isConfigured
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

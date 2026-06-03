import { db, isConfigured } from "../firebase/config";
import { 
  collection, 
  doc, 
  addDoc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  getDocs, 
  getDoc,
  onSnapshot, 
  query, 
  orderBy 
} from "firebase/firestore";

// --- MOCK DATABASE (LOCAL STORAGE WITH EVENTS) ---
const listeners = {}; // { collectionName: [callback1, callback2, ...] }

const triggerListeners = (collectionName) => {
  if (listeners[collectionName]) {
    const data = getMockCollection(collectionName);
    listeners[collectionName].forEach(cb => cb(data));
  }
};

import initialData from "./initialData.json";

// Default catalog data to populate on first load
const defaultMockData = initialData;


const getMockCollection = (collectionName) => {
  let data = localStorage.getItem(`meraki_${collectionName}`);
  if (!data) {
    const defaultData = defaultMockData[collectionName] || [];
    localStorage.setItem(`meraki_${collectionName}`, JSON.stringify(defaultData));
    return defaultData;
  }
  
  // Migration to reset or update therapist data if Thomas exists, Jeni has commission, or Joshua is missing
  if (collectionName === "terapeutas") {
    try {
      const parsed = JSON.parse(data);
      const hasThomas = parsed.some(t => t.nombre.includes("Thomas"));
      const hasJeniComision = parsed.some(t => t.nombre.includes("Jeniffer") && t.comisionActiva);
      const hasJoshua = parsed.some(t => t.nombre.includes("Joshua"));
      if (hasThomas || hasJeniComision || !hasJoshua) {
        console.log("Migrating therapist database to match new settings (Jeni fixed, Juan commission, Patricia fixed, Joshua added, Thomas deleted)...");
        const defaultData = defaultMockData["terapeutas"] || [];
        localStorage.setItem(`meraki_terapeutas`, JSON.stringify(defaultData));
        return defaultData;
      }
    } catch (e) {
      console.error("Migration error:", e);
    }
  }

  return JSON.parse(data);
};

const setMockCollection = (collectionName, data) => {
  localStorage.setItem(`meraki_${collectionName}`, JSON.stringify(data));
  triggerListeners(collectionName);
};

// --- UNIFIED EXPORTED DATABASE ACTIONS ---

export const getCollection = async (collectionName) => {
  if (isConfigured) {
    try {
      const q = query(collection(db, collectionName));
      const querySnapshot = await getDocs(q);
      const docs = [];
      querySnapshot.forEach((docSnap) => {
        docs.push({ id: docSnap.id, ...docSnap.data() });
      });
      return docs;
    } catch (e) {
      console.error("Firestore get error, fallback to mock:", e);
      return getMockCollection(collectionName);
    }
  } else {
    return getMockCollection(collectionName);
  }
};

export const addDocument = async (collectionName, data) => {
  if (isConfigured) {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: new Date().toISOString()
      });
      return { id: docRef.id, ...data };
    } catch (e) {
      console.error("Firestore add error, fallback to mock:", e);
      return addDocumentMock(collectionName, data);
    }
  } else {
    return addDocumentMock(collectionName, data);
  }
};

const addDocumentMock = (collectionName, data) => {
  const collectionData = getMockCollection(collectionName);
  const newDoc = { 
    id: data.id || Math.random().toString(36).substr(2, 9), 
    ...data,
    createdAt: new Date().toISOString()
  };
  collectionData.push(newDoc);
  setMockCollection(collectionName, collectionData);
  return newDoc;
};

export const setDocument = async (collectionName, docId, data) => {
  if (isConfigured) {
    try {
      const docRef = doc(db, collectionName, docId);
      await setDoc(docRef, data, { merge: true });
      return { id: docId, ...data };
    } catch (e) {
      console.error("Firestore set error, fallback to mock:", e);
      return setDocumentMock(collectionName, docId, data);
    }
  } else {
    return setDocumentMock(collectionName, docId, data);
  }
};

const setDocumentMock = (collectionName, docId, data) => {
  const collectionData = getMockCollection(collectionName);
  const idx = collectionData.findIndex(item => item.id === docId);
  if (idx !== -1) {
    collectionData[idx] = { ...collectionData[idx], ...data };
  } else {
    collectionData.push({ id: docId, ...data });
  }
  setMockCollection(collectionName, collectionData);
  return { id: docId, ...data };
};

export const updateDocument = async (collectionName, docId, data) => {
  if (isConfigured) {
    try {
      const docRef = doc(db, collectionName, docId);
      await updateDoc(docRef, data);
      return { id: docId, ...data };
    } catch (e) {
      console.error("Firestore update error, fallback to mock:", e);
      return updateDocumentMock(collectionName, docId, data);
    }
  } else {
    return updateDocumentMock(collectionName, docId, data);
  }
};

const updateDocumentMock = (collectionName, docId, data) => {
  const collectionData = getMockCollection(collectionName);
  const idx = collectionData.findIndex(item => item.id === docId);
  if (idx !== -1) {
    collectionData[idx] = { ...collectionData[idx], ...data };
    setMockCollection(collectionName, collectionData);
    return collectionData[idx];
  }
  throw new Error(`Document ${docId} not found in ${collectionName}`);
};

export const deleteDocument = async (collectionName, docId) => {
  if (isConfigured) {
    try {
      const docRef = doc(db, collectionName, docId);
      await deleteDoc(docRef);
      return docId;
    } catch (e) {
      console.error("Firestore delete error, fallback to mock:", e);
      return deleteDocumentMock(collectionName, docId);
    }
  } else {
    return deleteDocumentMock(collectionName, docId);
  }
};

const deleteDocumentMock = (collectionName, docId) => {
  let collectionData = getMockCollection(collectionName);
  collectionData = collectionData.filter(item => item.id !== docId);
  setMockCollection(collectionName, collectionData);
  return docId;
};

// --- REAL-TIME LISTENERS (SNAP SHOTS) ---

export const subscribeToCollection = (collectionName, callback) => {
  if (isConfigured) {
    try {
      const q = collection(db, collectionName);
      return onSnapshot(q, (snapshot) => {
        const docs = [];
        snapshot.forEach((docSnap) => {
          docs.push({ id: docSnap.id, ...docSnap.data() });
        });
        callback(docs);
      });
    } catch (e) {
      console.error("Firestore subscribe error, fallback to mock:", e);
      return subscribeToCollectionMock(collectionName, callback);
    }
  } else {
    return subscribeToCollectionMock(collectionName, callback);
  }
};

const subscribeToCollectionMock = (collectionName, callback) => {
  if (!listeners[collectionName]) {
    listeners[collectionName] = [];
  }
  listeners[collectionName].push(callback);
  
  // Send initial data immediately
  const initialData = getMockCollection(collectionName);
  callback(initialData);
  
  // Return unsubscribe function
  return () => {
    listeners[collectionName] = listeners[collectionName].filter(cb => cb !== callback);
  };
};

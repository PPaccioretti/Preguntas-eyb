// Conexión con Firebase (no hace falta editar este archivo)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  getFirestore, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);

export {
  onAuthStateChanged, signInAnonymously, signInWithEmailAndPassword,
  createUserWithEmailAndPassword, signOut, GoogleAuthProvider, signInWithPopup,
  doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch, serverTimestamp
};

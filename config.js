// ============================================================
//  CONFIGURACIÓN — lo único que hay que editar
// ============================================================

// 1) Pegá acá la configuración de tu app web de Firebase
//    (Consola Firebase > ⚙ Configuración del proyecto > General > Tus apps > Web > "Configuración del SDK")
export const firebaseConfig = {
  apiKey: "AIzaSyDMXbWp7620PZ1oyHkdyQWnyZ2LUpAu50s",
  authDomain: "eyb-preguntas.firebaseapp.com",
  projectId: "eyb-preguntas",
  storageBucket: "eyb-preguntas.firebasestorage.app",
  messagingSenderId: "532172461192",
  appId: "1:532172461192:web:a9ea5b87076cf37ad1fb3d"
};

// 2) Comisiones (salas). Cada una tiene su propio QR, fijo todo el cuatrimestre.
export const SALAS = [
  { id: "com1", nombre: "Comisión 1" },
  { id: "com2", nombre: "Comisión 2" },
  { id: "com3", nombre: "Comisión 3" },
  { id: "com4", nombre: "Comisión 4" },
  { id: "com5", nombre: "Comisión 5" },
  { id: "com6", nombre: "Comisión 6" },
  { id: "com7", nombre: "Comisión 7" }
];

export const MATERIA = "Estadística y Biometría";

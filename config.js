// ============================================================
//  CONFIGURACIÓN — lo único que hay que editar
// ============================================================

// 1) Pegá acá la configuración de tu app web de Firebase
//    (Consola Firebase > ⚙ Configuración del proyecto > General > Tus apps > Web > "Configuración del SDK")
export const firebaseConfig = {
  apiKey: "PEGAR_AQUI",
  authDomain: "PEGAR_AQUI.firebaseapp.com",
  projectId: "PEGAR_AQUI",
  storageBucket: "PEGAR_AQUI.appspot.com",
  messagingSenderId: "PEGAR_AQUI",
  appId: "PEGAR_AQUI"
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

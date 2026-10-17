export const LETRAS = "ABCDEF";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// Texto con saltos de línea
export function fmt(s) {
  return esc(s).replace(/\r?\n/g, "<br>");
}

export function hoy() {
  const d = new Date();
  const p = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function nuevoId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function lsGet(k, def = null) {
  try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch { return def; }
}
export function lsSet(k, v) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ }
}

// Lee un CSV de Excel: prueba UTF-8 y, si aparecen caracteres rotos, Windows-1252.
export async function leerArchivoTexto(file) {
  const buf = await file.arrayBuffer();
  let txt = new TextDecoder("utf-8").decode(buf);
  if (txt.includes("�")) txt = new TextDecoder("windows-1252").decode(buf);
  return txt.replace(/^﻿/, "");
}

// Parser CSV con comillas, saltos de línea dentro de celdas y separador , o ;
export function parseCSV(txt) {
  const primera = txt.split(/\r?\n/)[0] || "";
  const sep = (primera.split(";").length > primera.split(",").length) ? ";" : ",";
  const filas = [];
  let fila = [], celda = "", enComillas = false;
  for (let i = 0; i < txt.length; i++) {
    const c = txt[i];
    if (enComillas) {
      if (c === '"') {
        if (txt[i + 1] === '"') { celda += '"'; i++; } else enComillas = false;
      } else celda += c;
    } else if (c === '"') enComillas = true;
    else if (c === sep) { fila.push(celda); celda = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && txt[i + 1] === "\n") i++;
      fila.push(celda); filas.push(fila); fila = []; celda = "";
    } else celda += c;
  }
  if (celda !== "" || fila.length) { fila.push(celda); filas.push(fila); }
  return filas.filter(f => f.some(x => x.trim() !== ""));
}

export function toCSV(filas, sep = ";") {
  return filas.map(f => f.map(v => {
    const s = String(v ?? "");
    return /[";\n\r,]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  }).join(sep)).join("\r\n");
}

export function descargar(nombre, texto) {
  const blob = new Blob(["﻿" + texto], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = nombre;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// Convierte las filas del CSV del banco en preguntas. Devuelve {preguntas, errores}
export function filasABanco(filas) {
  const norm = s => s.trim().toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  const cab = filas[0].map(norm);
  const col = n => cab.indexOf(n);
  const req = ["id", "pregunta", "a", "b", "correcta"];
  const faltan = req.filter(r => col(r) < 0);
  if (faltan.length) return { preguntas: [], errores: [`Faltan columnas: ${faltan.join(", ")}`] };
  const preguntas = [], errores = [];
  filas.slice(1).forEach((f, k) => {
    const get = n => (col(n) >= 0 ? (f[col(n)] ?? "").trim() : "");
    const nfila = k + 2;
    const id = get("id").replace(/[\/\s]+/g, "_");
    if (!id) { errores.push(`Fila ${nfila}: sin id`); return; }
    const opciones = ["a", "b", "c", "d", "e", "f"].map(get).filter(x => x !== "");
    const correcta = LETRAS.indexOf(get("correcta").toUpperCase());
    if (opciones.length < 2) { errores.push(`Fila ${nfila} (${id}): menos de 2 opciones`); return; }
    if (correcta < 0 || correcta >= opciones.length) { errores.push(`Fila ${nfila} (${id}): "correcta" debe ser una letra entre A y ${LETRAS[opciones.length - 1]}`); return; }
    const rc = norm(get("revelar_celular"));
    preguntas.push({
      id, orden: k, tema: get("tema"), texto: get("pregunta"), opciones, correcta,
      explicacion: get("explicacion"),
      revelarCelular: !(rc === "no" || rc === "n" || rc === "0" || rc === "false"),
      imagen: get("imagen")
    });
  });
  return { preguntas, errores };
}

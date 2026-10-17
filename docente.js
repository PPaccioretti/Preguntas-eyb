import {
  auth, db, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  GoogleAuthProvider, signInWithPopup, doc, collection, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, writeBatch, serverTimestamp
} from "./fb.js";
import { SALAS, MATERIA } from "./config.js";
import { generarPptx } from "./diapositivas.js";
import { analizarPptx, agregarBotones } from "./pptx_proc.js";
import { LETRAS, esc, fmt, hoy, nuevoId, lsGet, lsSet, leerArchivoTexto, parseCSV, toCSV, descargar, filasABanco } from "./util.js";

const params = new URLSearchParams(location.search);
const qParam = params.get("q");
const vista = qParam ? "diapo" : params.get("vista") === "qr" ? "qr" : "panel";
const root = document.getElementById("app");
if (vista !== "panel") document.body.classList.add("diapo");

let user = null;
let salaId = params.get("sala") || lsGet("quiz_sala", SALAS[0].id);
if (!SALAS.some(s => s.id === salaId)) salaId = SALAS[0].id;
let alCambiarSala = () => {};
let iniciado = false;

const urlAlumno = id => new URL(`index.html?sala=${id}`, location.href).href;
const urlDiapo = qid => new URL(`docente.html?q=${encodeURIComponent(qid)}`, location.href).href;
const urlQR = () => new URL("docente.html?vista=qr", location.href).href;
const nombreSala = id => SALAS.find(s => s.id === id)?.nombre || id;

// ---------------------------------------------------------------- sesión
onAuthStateChanged(auth, async u => {
  if (!u || u.isAnonymous) { user = null; iniciado = false; renderLogin(); return; }
  user = u;
  let habilitado = false;
  try { habilitado = (await getDoc(doc(db, "docentes", u.uid))).exists(); } catch { /* sin permiso */ }
  if (!habilitado) { renderNoHabilitado(); return; }
  if (iniciado) return;
  iniciado = true;
  if (!params.get("sala")) {
    onSnapshot(doc(db, "preferencias", u.uid), snap => {
      const v = snap.exists() ? snap.data().sala : null;
      if (v && v !== salaId && SALAS.some(s => s.id === v)) { salaId = v; lsSet("quiz_sala", v); alCambiarSala(); }
    }, () => {});
  }
  if (vista === "diapo") iniciarDiapo();
  else if (vista === "qr") iniciarQR();
  else iniciarPanel();
});

function renderLogin() {
  root.innerHTML = `<div class="wrap"><div class="card">
    <h2>Ingreso docente</h2>
    <div style="display:grid;gap:8px">
      <input type="email" id="em" placeholder="correo" autocomplete="username">
      <input type="password" id="pw" placeholder="contraseña" autocomplete="current-password">
      <div class="fila"><button class="btn primario" id="b-in">Ingresar</button>
        <button class="btn" id="b-new">Crear cuenta</button>
        <button class="btn" id="b-g">Ingresar con Google</button></div>
      <div class="error" id="err"></div>
      <div class="nota">Dentro de PowerPoint conviene usar correo y contraseña: el ingreso con Google puede no abrirse en el visor web.</div>
    </div></div></div>`;
  const err = m => (root.querySelector("#err").textContent = m);
  const em = () => root.querySelector("#em").value.trim(), pw = () => root.querySelector("#pw").value;
  root.querySelector("#b-in").onclick = () => signInWithEmailAndPassword(auth, em(), pw()).catch(e => err(traducir(e)));
  root.querySelector("#b-new").onclick = () => createUserWithEmailAndPassword(auth, em(), pw()).catch(e => err(traducir(e)));
  root.querySelector("#b-g").onclick = () => signInWithPopup(auth, new GoogleAuthProvider()).catch(e => err(traducir(e)));
  root.querySelector("#pw").onkeydown = e => { if (e.key === "Enter") root.querySelector("#b-in").click(); };
}

function traducir(e) {
  const m = {
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/user-not-found": "No existe esa cuenta.",
    "auth/email-already-in-use": "Esa cuenta ya existe: usá Ingresar.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/invalid-email": "Correo inválido.",
    "auth/popup-blocked": "El navegador bloqueó la ventana de Google.",
    "auth/operation-not-allowed": "Ese método de ingreso no está habilitado en Firebase."
  };
  return m[e.code] || e.message;
}

function renderNoHabilitado() {
  root.innerHTML = `<div class="wrap"><div class="card">
    <h2>Pedir acceso como docente</h2>
    <p>Ingresaste como <b>${esc(user.email || "")}</b>. Escribí tu nombre y enviá la solicitud:
    cualquier docente ya habilitado la puede aprobar desde su panel.</p>
    <div class="fila"><input type="text" id="nom" placeholder="Nombre y apellido" style="max-width:320px">
      <button class="btn primario" id="env">Enviar solicitud</button></div>
    <p id="msg" class="nota"></p>
    <button class="btn" id="out">Salir</button></div></div>`;
  const msg = root.querySelector("#msg");
  getDoc(doc(db, "solicitudes", user.uid)).then(d => {
    if (d.exists()) { msg.textContent = "Tu solicitud ya fue enviada. Esta página se actualiza sola cuando la aprueben."; root.querySelector("#nom").value = d.data().nombre || ""; }
  }).catch(() => {});
  root.querySelector("#env").onclick = async () => {
    const nombre = root.querySelector("#nom").value.trim();
    if (!nombre) { msg.textContent = "Escribí tu nombre."; return; }
    try {
      await setDoc(doc(db, "solicitudes", user.uid), { nombre, email: user.email || "", ts: serverTimestamp() });
      msg.textContent = "Solicitud enviada. Esta página se actualiza sola cuando la aprueben.";
    } catch (e) { msg.textContent = "Error: " + e.message; }
  };
  onSnapshot(doc(db, "docentes", user.uid), d => { if (d.exists()) location.reload(); }, () => {});
  root.querySelector("#out").onclick = () => signOut(auth);
}

// ---------------------------------------------------------------- utilidades de sala
function selectorSala() {
  return `<select id="sel-sala" title="Comisión">${SALAS.map(s =>
    `<option value="${s.id}" ${s.id === salaId ? "selected" : ""}>${esc(s.nombre)}</option>`).join("")}</select>`;
}
function conectarSelector() {
  const sel = root.querySelector("#sel-sala");
  if (sel) sel.onchange = () => elegirSala(sel.value);
}
function elegirSala(id) {
  salaId = id; lsSet("quiz_sala", id);
  setDoc(doc(db, "preferencias", user.uid), { sala: id }, { merge: true }).catch(() => {});
  alCambiarSala();
}

// Suscripción al estado de la sala actual (se rehace al cambiar de comisión)
function escucharSala(cb) {
  let unsub = null;
  const sub = () => { unsub?.(); unsub = onSnapshot(doc(db, "salas", salaId), s => cb(s.exists() ? s.data() : null), e => console.error(e)); };
  sub();
  return sub;
}

const refSala = () => doc(db, "salas", salaId);

const cacheQR = {};
function qrSvg(url) {
  if (cacheQR[url]) return cacheQR[url];
  try {
    const qr = qrcode(0, "M"); qr.addData(url); qr.make();
    return (cacheQR[url] = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true }));
  } catch { return `<div class="estado bad">No se pudo generar el QR</div>`; }
}

// ---------------------------------------------------------------- vista diapositiva
async function iniciarDiapo() {
  let p;
  try {
    const snap = await getDoc(doc(db, "banco", qParam));
    if (!snap.exists()) throw new Error(`No existe la pregunta "${qParam}" en el banco.`);
    p = snap.data();
  } catch (e) {
    root.innerHTML = `<div class="wrap"><div class="estado bad">${esc(e.message)}</div></div>`;
    return;
  }
  let s = null, counts = p.opciones.map(() => 0), total = 0;
  let unsubResp = null, lanzSuscrito = null, ocupado = false, error = "", confirmando = false;
  let verVivo = lsGet("quiz_ver_vivo", false);
  let enviarCel = p.revelarCelular !== false;

  const resuscribir = escucharSala(d => { s = d; suscribirRespuestas(); render(); });
  alCambiarSala = () => { lanzSuscrito = undefined; s = null; resuscribir(); render(); };

  function suscribirRespuestas() {
    const l = s && s.qid === qParam ? s.lanzamiento : null;
    if (l === lanzSuscrito) return;
    unsubResp?.(); unsubResp = null; lanzSuscrito = l;
    counts = p.opciones.map(() => 0); total = 0;
    if (!l) return;
    unsubResp = onSnapshot(query(collection(db, "salas", salaId, "respuestas"), where("lanzamiento", "==", l)), snap => {
      counts = p.opciones.map(() => 0);
      snap.forEach(d => { const o = d.data().opcion; if (o >= 0 && o < counts.length) counts[o]++; });
      total = snap.size;
      render();
    }, e => console.error(e));
  }

  async function accion(fn) {
    if (ocupado) return;
    ocupado = true; render();
    error = ""; confirmando = false;
    try { await fn(); } catch (e) { error = "Error: " + e.message; }
    ocupado = false; render();
  }
  const lanzar = () => accion(() => setDoc(refSala(), {
    qid: qParam, lanzamiento: nuevoId(), claseId: hoy(), estado: "abierta",
    pregunta: { texto: p.texto, opciones: p.opciones, imagen: p.imagen || "", tema: p.tema || "" },
    revelada: null, actualizado: serverTimestamp()
  }));
  const set = datos => accion(() => updateDoc(refSala(), { ...datos, actualizado: serverTimestamp() }));
  const datosRev = () => ({ correcta: p.correcta, explicacion: p.explicacion || "" });

  function render() {
    const activa = s && s.qid === qParam && s.estado !== "inactiva";
    const estado = activa ? s.estado : "inactiva";
    const otra = s && s.qid && s.qid !== qParam && s.estado !== "inactiva" ? s.qid : null;
    const mostrarDist = estado === "cerrada" || estado === "revelada" || (estado === "abierta" && verVivo);
    const revelada = estado === "revelada";

    const barras = p.opciones.map((o, i) => {
      const pct = total ? Math.round(100 * counts[i] / total) : 0;
      const cls = revelada && i === p.correcta ? "correcta" : "";
      return `<div class="barra ${cls}"><div class="relleno" style="width:${mostrarDist ? pct : 0}%"></div>
        <span class="letra">${LETRAS[i]}</span><span class="txt">${esc(o)}</span>
        <span class="n">${mostrarDist && activa ? `${pct}% <small>(${counts[i]})</small>` : ""}</span></div>`;
    }).join("");

    const dis = ocupado ? "disabled" : "";
    let ctrl = "";
    if (estado === "inactiva") {
      ctrl = `<button class="btn primario" id="c-lanzar" ${dis}>▶ Lanzar pregunta</button>
        <span class="nota">${esc(nombreSala(salaId))}</span>
        ${otra ? `<span class="nota">Hay otra pregunta activa (${esc(otra)}); se reemplazará.</span>` : ""}`;
    } else {
      ctrl = `<span class="contador">${total} ${total === 1 ? "respuesta" : "respuestas"}</span>`;
      if (estado === "abierta") {
        ctrl += `<button class="btn primario" id="c-cerrar" ${dis}>■ Cerrar votación</button>
          <label><input type="checkbox" id="c-vivo" ${verVivo ? "checked" : ""}> ver distribución en vivo</label>`;
      } else if (estado === "cerrada") {
        ctrl += `<button class="btn primario" id="c-mostrar" ${dis}>✓ Mostrar respuesta</button>
          <label><input type="checkbox" id="c-cel" ${enviarCel ? "checked" : ""}> enviarla también a los celulares</label>
          <button class="btn" id="c-reabrir" ${dis}>Reabrir</button>`;
      } else if (revelada) {
        ctrl += s.revelada
          ? `<span class="nota">Respuesta enviada a los celulares.</span>`
          : `<span class="nota">Respuesta solo en pantalla.</span> <button class="btn" id="c-enviar" ${dis}>Enviar a celulares</button>`;
      }
      ctrl += `<button class="btn" id="c-terminar" ${dis}>Terminar</button>
        <button class="btn peligro" id="c-relanzar" ${dis} title="Empieza de cero, sin los votos anteriores">${confirmando ? "¿Seguro? Clic otra vez" : "↺ Relanzar"}</button>`;
    }

    root.innerHTML = `<div class="top"><span>${esc(p.tema || MATERIA)}</span><span>${selectorSala()}</span></div>
      <div class="diapo-wrap ${p.imagen ? "con-img" : ""}">
        <div><h1 class="enunciado">${fmt(p.texto)}</h1>${p.imagen ? `<img class="img-preg" src="${esc(p.imagen)}" alt="">` : ""}</div>
        <div class="barras">${barras}
          ${revelada && p.explicacion ? `<div class="explicacion">${fmt(p.explicacion)}</div>` : ""}</div>
      </div>
      <div class="controles">${ctrl}${error ? `<span class="error">${esc(error)}</span>` : ""}
        ${estado === "abierta" ? `<div class="mini-qr">${qrSvg(urlAlumno(salaId))}<span>¿Cerraste la página?<br>Escaneá de nuevo</span></div>` : ""}
        ${estado === "inactiva" ? `<div class="mini-qr grande">${qrSvg(urlAlumno(salaId))}<span><b>Escaneá para responder</b><br>${esc(nombreSala(salaId))}<br>Sin cuenta, anónimo</span></div>` : ""}</div>`;

    conectarSelector();
    const on = (id, fn) => { const b = root.querySelector(id); if (b) b.onclick = fn; };
    on("#c-lanzar", lanzar);
    on("#c-relanzar", () => {
      if (confirmando) lanzar();
      else { confirmando = true; render(); setTimeout(() => { if (confirmando) { confirmando = false; render(); } }, 4000); }
    });
    on("#c-cerrar", () => set({ estado: "cerrada" }));
    on("#c-reabrir", () => set({ estado: "abierta" }));
    on("#c-mostrar", () => set({ estado: "revelada", revelada: enviarCel ? datosRev() : null }));
    on("#c-enviar", () => set({ revelada: datosRev() }));
    on("#c-terminar", () => set({ estado: "inactiva", revelada: null }));
    const vivo = root.querySelector("#c-vivo");
    if (vivo) vivo.onchange = () => { verVivo = vivo.checked; lsSet("quiz_ver_vivo", verVivo); render(); };
    const cel = root.querySelector("#c-cel");
    if (cel) cel.onchange = () => { enviarCel = cel.checked; };
  }
  render();
}

// ---------------------------------------------------------------- vista QR
function iniciarQR() {
  function render() {
    const url = urlAlumno(salaId);
    const svg = qrSvg(url);
    root.innerHTML = `<div class="top"><span>${esc(MATERIA)}</span><span>${selectorSala()}</span></div>
      <div class="qr-wrap"><h1>Escaneá para responder · ${esc(nombreSala(salaId))}</h1>${svg}
      <div class="url">${esc(url)}</div><div class="nota">No hace falta cuenta. Dejá la página abierta durante la clase.</div></div>`;
    conectarSelector();
  }
  alCambiarSala = render;
  render();
}

// ---------------------------------------------------------------- panel
function iniciarPanel() {
  let banco = [];
  let s = null;

  root.innerHTML = `<div class="top"><b>${esc(MATERIA)} · Panel docente</b>
      <span>${selectorSala()} <span class="nota" style="color:#fff">${esc(user.email || "")}</span>
      <button class="btn chico" id="out">Salir</button></span></div>
    <div class="wrap" style="max-width:960px">
      <div class="card"><h2>Comisión activa</h2><div id="estado-sala"></div>
        <p class="nota" style="margin-top:12px">Enlace para estudiantes: <code id="url-alu"></code> <button class="btn chico" id="cp-alu">Copiar</button></p>
        <p class="nota">QR en pantalla completa: <code>${esc(urlQR())}</code>
          <button class="btn chico" id="cp-qr">Copiar</button> <a href="${esc(urlQR())}" target="_blank">abrir</a></p>
      </div>
      <div class="card"><h2>Agregar preguntas desde una presentación</h2>
        <p class="nota" style="margin-top:0">Armá la pregunta en PowerPoint como cualquier diapositiva: opciones con letras A, B, C… y en las
          <b>notas del orador</b> escribí <code>Respuesta B</code> seguido de la explicación. Subí acá el archivo: las preguntas se cargan al banco
          y se descarga la misma presentación con el botón <b>▶ Votar en vivo</b> en cada pregunta. El archivo no se sube a ningún servidor.</p>
        <div class="fila"><input type="file" id="f-pptx" accept=".pptx"><button class="btn primario" id="b-analizar">Analizar presentación</button></div>
        <div id="res-pptx" style="margin-top:10px"></div>
      </div>
      <div class="card"><h2>Banco de preguntas</h2>
        <div class="fila"><button class="btn primario" id="b-nueva">＋ Nueva pregunta</button>
          <input type="text" id="filtro" placeholder="Buscar por ID, tema o texto" style="max-width:280px">
          <button class="btn" id="b-pptx">⬇ Diapositivas de las seleccionadas</button></div>
        <div id="editor"></div>
        <div id="msg-banco" class="nota" style="margin-top:8px"></div>
        <div id="tabla-banco" style="margin-top:12px;overflow-x:auto"></div>
        <details style="margin-top:12px"><summary class="nota">Carga masiva desde Excel (CSV)</summary>
          <div class="fila" style="margin-top:8px"><input type="file" id="f-csv" accept=".csv,text/csv">
            <label><input type="checkbox" id="f-reemp"> reemplazar todo el banco</label>
            <button class="btn" id="b-cargar">Cargar CSV</button>
            <button class="btn" id="b-desc-banco">Descargar banco (CSV)</button></div></details>
      </div>
      <div class="card"><h2>Docentes</h2><div id="docentes"></div></div>
      <div class="card"><h2>Respuestas</h2>
        <div class="fila"><button class="btn" id="b-exp">Descargar respuestas de esta comisión</button>
        <button class="btn" id="b-exp-todo">Descargar todas las comisiones</button></div>
        <p class="nota">Las respuestas son anónimas: cada celular aparece con un código aleatorio.</p>
      </div>
    </div>`;

  conectarSelector();
  root.querySelector("#out").onclick = () => signOut(auth);
  const copiar = (t, b) => { navigator.clipboard?.writeText(t); b.textContent = "Copiado"; setTimeout(() => (b.textContent = "Copiar"), 1500); };
  root.querySelector("#cp-qr").onclick = e => copiar(urlQR(), e.target);
  root.querySelector("#cp-alu").onclick = e => copiar(urlAlumno(salaId), e.target);

  function renderEstado() {
    root.querySelector("#url-alu").textContent = urlAlumno(salaId);
    const el = root.querySelector("#estado-sala");
    if (!s || !s.qid || s.estado === "inactiva") { el.innerHTML = `<b>${esc(nombreSala(salaId))}</b>: sin pregunta activa.`; return; }
    el.innerHTML = `<b>${esc(nombreSala(salaId))}</b>: pregunta <b>${esc(s.qid)}</b> — ${esc(s.estado)} (${esc(s.claseId)})
      <button class="btn chico" id="b-term">Terminar</button>`;
    el.querySelector("#b-term").onclick = () => updateDoc(refSala(), { estado: "inactiva", revelada: null, actualizado: serverTimestamp() });
  }
  const resuscribir = escucharSala(d => { s = d; renderEstado(); });
  alCambiarSala = () => {
    const sel = root.querySelector("#sel-sala"); if (sel) sel.value = salaId;
    s = null; renderEstado(); resuscribir();
  };
  renderEstado();

  let filtro = "", seleccion = new Set();
  const visibles = () => banco.filter(p => !filtro || `${p.id} ${p.tema} ${p.texto}`.toLowerCase().includes(filtro));
  async function cargarBanco() {
    const snap = await getDocs(collection(db, "banco"));
    banco = snap.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => (a.tema || "").localeCompare(b.tema || "") || (a.orden ?? 0) - (b.orden ?? 0) || a.id.localeCompare(b.id));
    seleccion = new Set([...seleccion].filter(id => banco.some(p => p.id === id)));
    renderTabla();
  }
  function renderTabla() {
    const t = root.querySelector("#tabla-banco");
    if (!banco.length) { t.innerHTML = `<p class="nota">El banco está vacío.</p>`; return; }
    const vis = visibles();
    t.innerHTML = `<table><tr><th><input type="checkbox" id="sel-todo" title="Seleccionar las visibles" ${vis.length && vis.every(p => seleccion.has(p.id)) ? "checked" : ""}></th><th>ID</th><th>Tema</th><th>Pregunta</th><th>Corr.</th><th>Votación</th><th></th></tr>${
      vis.map(p => `<tr><td><input type="checkbox" data-sel="${esc(p.id)}" ${seleccion.has(p.id) ? "checked" : ""}></td>
        <td><b>${esc(p.id)}</b></td><td>${esc(p.tema)}</td><td>${esc(p.texto.slice(0, 110))}${p.texto.length > 110 ? "…" : ""}</td>
        <td>${LETRAS[p.correcta]}</td>
        <td style="white-space:nowrap"><a href="${esc(urlDiapo(p.id))}" target="_blank">abrir</a>
        <button class="btn chico" data-cp="${esc(p.id)}">Copiar URL</button></td>
        <td style="white-space:nowrap"><button class="btn chico" data-ed="${esc(p.id)}">✏️ Editar</button>
        <button class="btn chico" data-dup="${esc(p.id)}" title="Duplicar">⧉</button>
        <button class="btn chico peligro" data-del="${esc(p.id)}">Borrar</button></td></tr>`).join("")}</table>
      <p class="nota">${vis.length} de ${banco.length} preguntas. Seleccionadas: ${seleccion.size}.</p>`;
    t.querySelector("#sel-todo").onchange = e => { vis.forEach(p => e.target.checked ? seleccion.add(p.id) : seleccion.delete(p.id)); renderTabla(); };
    t.querySelectorAll("[data-sel]").forEach(c => c.onchange = () => { c.checked ? seleccion.add(c.dataset.sel) : seleccion.delete(c.dataset.sel); renderTabla(); });
    t.querySelectorAll("[data-cp]").forEach(b => b.onclick = () => copiar(urlDiapo(b.dataset.cp), b));
    t.querySelectorAll("[data-ed]").forEach(b => b.onclick = () => abrirEditor(banco.find(p => p.id === b.dataset.ed)));
    t.querySelectorAll("[data-dup]").forEach(b => b.onclick = () => {
      const o = banco.find(p => p.id === b.dataset.dup);
      abrirEditor({ ...o, id: idLibre(o.id + "-b") }, true);
    });
    t.querySelectorAll("[data-del]").forEach(b => b.onclick = async () => {
      if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "¿Seguro?"; setTimeout(() => { b.dataset.conf = ""; b.textContent = "Borrar"; }, 4000); return; }
      try { await deleteDoc(doc(db, "banco", b.dataset.del)); aviso(`Pregunta ${b.dataset.del} borrada.`); await cargarBanco(); }
      catch (e) { aviso("Error: " + e.message, true); }
    });
  }
  root.querySelector("#filtro").oninput = e => { filtro = e.target.value.trim().toLowerCase(); renderTabla(); };
  cargarBanco().catch(e => (root.querySelector("#msg-banco").textContent = "Error: " + e.message));

  // ---------- editor de una pregunta
  const aviso = (t, err) => { root.querySelector("#msg-banco").innerHTML = err ? `<span class="error">${esc(t)}</span>` : esc(t); };
  const idLibre = base => { let id = base, k = 2; while (banco.some(p => p.id === id)) id = `${base}${k++}`; return id; };
  root.querySelector("#b-nueva").onclick = () => abrirEditor(null);

  function abrirEditor(p, esNueva = !p) {
    const ed = root.querySelector("#editor");
    const v = p || { id: idLibre("P" + String(banco.length + 1).padStart(2, "0")), tema: "", texto: "", opciones: ["", "", "", ""], correcta: 0, explicacion: "", revelarCelular: true, imagen: "" };
    const ops = [0, 1, 2, 3, 4].map(i => v.opciones[i] || "");
    ed.innerHTML = `<div class="editor">
      <h3>${esNueva ? "Nueva pregunta" : `Editar ${esc(v.id)}`}</h3>
      <div class="ed-grid">
        <label>ID <input type="text" id="e-id" value="${esc(v.id)}" ${esNueva ? "" : "disabled"}></label>
        <label>Tema <input type="text" id="e-tema" value="${esc(v.tema || "")}"></label>
      </div>
      <label>Pregunta <textarea id="e-texto" rows="3">${esc(v.texto)}</textarea></label>
      <div class="nota">Opciones (marcá la correcta; las vacías no se muestran):</div>
      ${ops.map((o, i) => `<div class="ed-op"><input type="radio" name="e-corr" value="${i}" ${i === v.correcta ? "checked" : ""} title="Correcta">
        <b>${LETRAS[i]}</b><input type="text" id="e-op${i}" value="${esc(o)}"></div>`).join("")}
      <label>Explicación <textarea id="e-expl" rows="3">${esc(v.explicacion || "")}</textarea></label>
      <label>Imagen (URL, opcional) <input type="text" id="e-img" value="${esc(v.imagen || "")}"></label>
      <label class="fila"><input type="checkbox" id="e-cel" ${v.revelarCelular === false ? "" : "checked"}> Por defecto, enviar la respuesta también a los celulares</label>
      ${esNueva ? "" : `<p class="nota">El ID no se cambia porque está en la URL de la diapositiva. Si la pregunta está lanzada ahora, los cambios se ven al relanzarla.</p>`}
      <div class="fila"><button class="btn primario" id="e-guardar">Guardar</button><button class="btn" id="e-cancel">Cancelar</button>
        <span class="error" id="e-err"></span></div></div>`;
    ed.scrollIntoView({ behavior: "smooth", block: "start" });
    const val = id => ed.querySelector(id).value.trim();
    ed.querySelector("#e-cancel").onclick = () => { ed.innerHTML = ""; };
    ed.querySelector("#e-guardar").onclick = async () => {
      const err = m => (ed.querySelector("#e-err").textContent = m);
      const id = val("#e-id").replace(/[\/\s]+/g, "_");
      if (!id) return err("Falta el ID.");
      if (esNueva && banco.some(q => q.id === id)) return err(`Ya existe una pregunta con ID ${id}.`);
      const texto = val("#e-texto");
      if (!texto) return err("Falta el enunciado.");
      const marcada = +(ed.querySelector("input[name=e-corr]:checked")?.value ?? -1);
      const llenas = [0, 1, 2, 3, 4].map(i => ({ i, t: val("#e-op" + i) })).filter(o => o.t);
      if (llenas.length < 2) return err("Necesitás al menos 2 opciones.");
      const correcta = llenas.findIndex(o => o.i === marcada);
      if (correcta < 0) return err("Marcá cuál es la opción correcta (debe tener texto).");
      const datos = {
        id, orden: p && !esNueva ? (p.orden ?? 0) : Math.max(-1, ...banco.map(q => q.orden ?? 0)) + 1,
        tema: val("#e-tema"), texto, opciones: llenas.map(o => o.t), correcta,
        explicacion: val("#e-expl"), revelarCelular: ed.querySelector("#e-cel").checked, imagen: val("#e-img")
      };
      try {
        await setDoc(doc(db, "banco", id), datos);
        ed.innerHTML = ""; aviso(`Pregunta ${id} guardada.`); await cargarBanco();
      } catch (e) { err("Error: " + e.message); }
    };
  }

  root.querySelector("#b-cargar").onclick = async () => {
    const msg = root.querySelector("#msg-banco");
    const f = root.querySelector("#f-csv").files[0];
    if (!f) { msg.textContent = "Elegí un archivo CSV."; return; }
    try {
      const { preguntas, errores } = filasABanco(parseCSV(await leerArchivoTexto(f)));
      if (errores.length) { msg.innerHTML = `<span class="error">No se cargó nada. Corregí:<br>${errores.map(esc).join("<br>")}</span>`; return; }
      const reemplazar = root.querySelector("#f-reemp").checked;
      const ops = preguntas.map(p => b => b.set(doc(db, "banco", p.id), p));
      if (reemplazar) {
        const nuevos = new Set(preguntas.map(p => p.id));
        banco.filter(p => !nuevos.has(p.id)).forEach(p => ops.push(b => b.delete(doc(db, "banco", p.id))));
      }
      for (let i = 0; i < ops.length; i += 400) {
        const b = writeBatch(db); ops.slice(i, i + 400).forEach(op => op(b)); await b.commit();
      }
      msg.textContent = `Listo: ${preguntas.length} preguntas cargadas.`;
      await cargarBanco();
    } catch (e) { msg.innerHTML = `<span class="error">Error: ${esc(e.message)}</span>`; }
  };

  root.querySelector("#b-desc-banco").onclick = () => {
    const filas = [["id", "tema", "pregunta", "A", "B", "C", "D", "E", "correcta", "explicacion", "revelar_celular", "imagen"]];
    banco.forEach(p => filas.push([p.id, p.tema, p.texto, ...[0, 1, 2, 3, 4].map(i => p.opciones[i] || ""),
      LETRAS[p.correcta], p.explicacion, p.revelarCelular === false ? "no" : "si", p.imagen]));
    descargar("banco_preguntas.csv", toCSV(filas));
  };

  root.querySelector("#b-pptx").onclick = async () => {
    const elegidas = banco.filter(p => seleccion.has(p.id));
    if (!elegidas.length) return aviso("Marcá en la tabla las preguntas que querés llevar a PowerPoint.", true);
    try {
      const pres = generarPptx(window.PptxGenJS, { banco: elegidas, urlDiapo, materia: MATERIA });
      await pres.writeFile({ fileName: `preguntas_${hoy()}.pptx` });
      aviso(`Descargadas ${elegidas.length} diapositivas. En PowerPoint: Inicio → Nueva diapositiva → Reutilizar diapositivas, o copiar y pegar.`);
    } catch (e) { aviso("Error al generar: " + e.message, true); }
  };

  // ---------- procesar una presentación
  let analisis = null;
  root.querySelector("#b-analizar").onclick = async () => {
    const out = root.querySelector("#res-pptx");
    const f = root.querySelector("#f-pptx").files[0];
    if (!f) { out.innerHTML = `<span class="error">Elegí un archivo .pptx.</span>`; return; }
    out.textContent = "Analizando…";
    try {
      const res = await analizarPptx(f);
      const pref = (f.name.match(/\d+/) ? "C" + f.name.match(/\d+/)[0].padStart(2, "0") : f.name.replace(/\.pptx$/i, "").replace(/[^A-Za-z0-9]/g, "").slice(0, 8) || "P");
      const tema = f.name.replace(/\.pptx$/i, "").replace(/^\d+[_\s-]*/, "").replace(/_/g, " ");
      const usados = new Set(banco.map(p => p.id));
      let k = 1;
      const filas = res.slides.filter(sl => sl.pregunta).map(sl => {
        let id = sl.idExistente;
        if (!id) { do { id = `${pref}-${k++}`; } while (usados.has(id)); usados.add(id); }
        return { sl, id, nueva: !banco.some(p => p.id === id) };
      });
      const temaPrevio = filas.map(r => banco.find(p => p.id === r.id)?.tema).find(Boolean);
      analisis = { res, filas, nombre: f.name, tema: temaPrevio || tema };
      if (!filas.length) {
        out.innerHTML = `<span class="error">No encontré preguntas. Cada diapositiva de pregunta necesita opciones con letras (A, B, C…) y en las notas "Respuesta X".</span>`;
        return;
      }
      out.innerHTML = `<p><b>${filas.length}</b> pregunta(s) en <b>${esc(f.name)}</b>:</p>
        <table><tr><th>Diap.</th><th>ID</th><th>Pregunta</th><th>Opc.</th><th>Corr.</th><th></th></tr>${filas.map(r => `<tr>
          <td>${r.sl.n}</td><td><b>${esc(r.id)}</b></td><td>${esc(r.sl.pregunta.texto.slice(0, 120))}</td>
          <td>${r.sl.pregunta.opciones.length}</td><td>${LETRAS[r.sl.pregunta.correcta]}</td>
          <td class="nota">${r.nueva ? "nueva" : "actualiza"}${r.sl.idExistente ? "" : " · agrega botón"}</td></tr>`).join("")}</table>
        <div class="fila" style="margin-top:10px"><label>Tema <input type="text" id="p-tema" value="${esc(analisis.tema)}" style="width:260px"></label>
          <button class="btn primario" id="b-aplicar">Cargar al banco y descargar la presentación</button></div>`;
      out.querySelector("#b-aplicar").onclick = aplicar;
    } catch (e) { out.innerHTML = `<span class="error">No se pudo leer el archivo: ${esc(e.message)}</span>`; }
  };
  async function aplicar() {
    const out = root.querySelector("#res-pptx");
    const { res, filas, nombre } = analisis;
    const tema = out.querySelector("#p-tema").value.trim();
    try {
      const b = writeBatch(db);
      filas.forEach((r, i) => {
        const prev = banco.find(p => p.id === r.id) || {};
        const q = r.sl.pregunta;
        b.set(doc(db, "banco", r.id), {
          id: r.id, orden: i, tema: tema || prev.tema || "", texto: q.texto, opciones: q.opciones, correcta: q.correcta,
          explicacion: q.explicacion, revelarCelular: prev.revelarCelular !== false, imagen: prev.imagen || "",
          fuente: nombre, diapositiva: r.sl.n
        });
      });
      await b.commit();
      const blob = await agregarBotones(res, filas.map(r => ({ slide: r.sl, url: urlDiapo(r.id) })));
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob); a.download = nombre;
      document.body.appendChild(a); a.click(); a.remove();
      out.innerHTML = `<p>Listo: ${filas.length} pregunta(s) en el banco. Se descargó <b>${esc(nombre)}</b> con los botones: reemplazá con ella tu archivo.</p>`;
      await cargarBanco();
    } catch (e) { out.innerHTML = `<span class="error">Error: ${esc(e.message)}</span>`; }
  }

  // ---------- docentes y solicitudes
  async function cargarDocentes() {
    const el = root.querySelector("#docentes");
    try {
      const [sol, docs] = await Promise.all([getDocs(collection(db, "solicitudes")), getDocs(collection(db, "docentes"))]);
      const pend = sol.docs.map(d => ({ uid: d.id, ...d.data() }));
      el.innerHTML = `${pend.length ? `<p><b>Solicitudes pendientes</b></p>${pend.map(p => `<div class="fila" style="margin-bottom:6px">
          ${esc(p.nombre)} <span class="nota">${esc(p.email)}</span>
          <button class="btn chico primario" data-ok="${p.uid}">Aprobar</button><button class="btn chico peligro" data-no="${p.uid}">Rechazar</button></div>`).join("")}`
        : `<p class="nota">No hay solicitudes pendientes. Para sumar un docente, pasale el enlace de este panel: crea su cuenta y pide acceso.</p>`}
        <p style="margin-top:12px"><b>Habilitados</b></p>${docs.docs.map(d => `<div class="fila" style="margin-bottom:4px">
          ${esc(d.data().nombre || "")} <span class="nota">${esc(d.data().email || d.id)}</span>
          ${d.id === user.uid ? `<span class="nota">(vos)</span>` : `<button class="btn chico peligro" data-quitar="${d.id}">Quitar</button>`}</div>`).join("")}`;
      el.querySelectorAll("[data-ok]").forEach(b => b.onclick = async () => {
        const p = pend.find(x => x.uid === b.dataset.ok);
        const wb = writeBatch(db);
        wb.set(doc(db, "docentes", p.uid), { nombre: p.nombre, email: p.email, aprobadoPor: user.email || "", ts: serverTimestamp() });
        wb.delete(doc(db, "solicitudes", p.uid));
        await wb.commit(); cargarDocentes();
      });
      el.querySelectorAll("[data-no]").forEach(b => b.onclick = async () => { await deleteDoc(doc(db, "solicitudes", b.dataset.no)); cargarDocentes(); });
      el.querySelectorAll("[data-quitar]").forEach(b => b.onclick = async () => {
        if (b.dataset.conf !== "1") { b.dataset.conf = "1"; b.textContent = "¿Seguro?"; return; }
        await deleteDoc(doc(db, "docentes", b.dataset.quitar)); cargarDocentes();
      });
    } catch (e) { el.innerHTML = `<span class="error">${esc(e.message)}</span>`; }
  }
  cargarDocentes();

  async function filasRespuestas(ids) {
    const porId = Object.fromEntries(banco.map(p => [p.id, p]));
    const filas = [["comision", "fecha", "pregunta", "tema", "lanzamiento", "estudiante", "respuesta", "correcta", "acierto", "hora"]];
    for (const id of ids) {
      const snap = await getDocs(collection(db, "salas", id, "respuestas"));
      snap.forEach(d => {
        const r = d.data(), p = porId[r.qid];
        const t = r.ts?.toDate ? r.ts.toDate() : null;
        filas.push([nombreSala(id), r.claseId, r.qid, p?.tema || "", r.lanzamiento, String(r.uid).slice(0, 8),
          LETRAS[r.opcion], p ? LETRAS[p.correcta] : "", p ? (r.opcion === p.correcta ? 1 : 0) : "",
          t ? t.toLocaleTimeString("es-AR") : ""]);
      });
    }
    return filas;
  }
  root.querySelector("#b-exp").onclick = async () => descargar(`respuestas_${salaId}_${hoy()}.csv`, toCSV(await filasRespuestas([salaId])));
  root.querySelector("#b-exp-todo").onclick = async () => descargar(`respuestas_todas_${hoy()}.csv`, toCSV(await filasRespuestas(SALAS.map(s => s.id))));
}

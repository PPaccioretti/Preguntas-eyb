import { auth, db, signInAnonymously, onAuthStateChanged, doc, onSnapshot, setDoc, serverTimestamp } from "./fb.js";
import { SALAS, MATERIA } from "./config.js";
import { LETRAS, esc, fmt, lsGet, lsSet } from "./util.js";

const app = document.getElementById("app");
document.getElementById("titulo").textContent = MATERIA;
const salaId = new URLSearchParams(location.search).get("sala");
const sala = SALAS.find(s => s.id === salaId);

if (!sala) {
  app.innerHTML = `<div class="card"><h2>Elegí tu comisión</h2><div class="opciones">${
    SALAS.map(s => `<a class="opcion" style="text-decoration:none" href="?sala=${s.id}">${esc(s.nombre)}</a>`).join("")
  }</div></div>`;
} else {
  iniciar();
}

function iniciar() {
  document.getElementById("sala-nombre").textContent = sala.nombre;
  const claveLocal = "quiz_resp_" + sala.id;
  const mias = lsGet(claveLocal, {});        // lanzamiento -> opción elegida
  let s = null, uid = null, enviando = false, aviso = "";

  onAuthStateChanged(auth, u => {
    if (!u || uid) return;
    uid = u.uid;
    onSnapshot(doc(db, "salas", sala.id),
      snap => { s = snap.exists() ? snap.data() : null; aviso = ""; render(); },
      err => { app.innerHTML = `<div class="estado bad">No se pudo conectar (${esc(err.code || err.message)}). Recargá la página.</div>`; });
  });
  signInAnonymously(auth).catch(err => {
    app.innerHTML = `<div class="estado bad">No se pudo iniciar (${esc(err.code || err.message)}). Recargá la página.</div>`;
  });

  function render() {
    if (!s || !s.qid || s.estado === "inactiva" || !s.pregunta) {
      app.innerHTML = `<div class="espera"><div class="pulso"></div><div class="grande">Esperando la próxima pregunta</div>Dejá esta página abierta.<br><br><span class="nota">Si la cerrás, volvé a escanear el QR (también aparece en la esquina de cada pregunta) o abrila desde el historial del navegador.</span></div>`;
      return;
    }
    const p = s.pregunta;
    const mia = mias[s.lanzamiento];
    const abierta = s.estado === "abierta";
    const rev = s.estado === "revelada" && s.revelada ? s.revelada : null;

    let h = `${p.tema ? `<div class="tema">${esc(p.tema)}</div>` : ""}
      <h1 class="enunciado">${fmt(p.texto)}</h1>
      ${p.imagen ? `<img class="img-preg" src="${esc(p.imagen)}" alt="">` : ""}
      <div class="opciones">${p.opciones.map((o, i) => {
        let c = "";
        if (mia === i) c = "elegida";
        if (rev && i === rev.correcta) c = "correcta";
        else if (rev && mia === i) c = "incorrecta";
        return `<button class="opcion ${c}" data-i="${i}" ${abierta ? "" : "disabled"}><span class="letra">${LETRAS[i]}</span><span>${esc(o)}</span></button>`;
      }).join("")}</div>`;

    if (abierta) {
      h += mia === undefined
        ? `<div class="estado">Tocá una opción para responder.</div>`
        : `<div class="estado">${enviando ? "Enviando…" : `Respuesta enviada: <b>${LETRAS[mia]}</b>. Podés cambiarla hasta que se cierre la votación.`}</div>`;
    } else if (s.estado === "cerrada") {
      h += `<div class="estado info">Votación cerrada. Mirá la pantalla.${mia === undefined ? " (No respondiste esta pregunta.)" : ""}</div>`;
    } else if (s.estado === "revelada" && !rev) {
      h += `<div class="estado info">Votación cerrada. La respuesta se discute en clase.</div>`;
    } else if (rev) {
      const ok = mia === rev.correcta;
      h += `<div class="estado ${mia === undefined ? "info" : ok ? "ok" : "bad"}">
        ${mia === undefined ? `La respuesta correcta es <b>${LETRAS[rev.correcta]}</b>.` : ok ? "<b>¡Correcto!</b>" : `<b>No era esa.</b> La correcta es <b>${LETRAS[rev.correcta]}</b>.`}
        ${rev.explicacion ? `<div class="explicacion">${fmt(rev.explicacion)}</div>` : ""}</div>`;
    }
    if (aviso) h += `<div class="estado bad">${esc(aviso)}</div>`;
    app.innerHTML = h;
    if (abierta) app.querySelectorAll(".opcion").forEach(b => b.onclick = () => responder(+b.dataset.i));
  }

  async function responder(i) {
    if (!s || s.estado !== "abierta" || !uid) return;
    const lanz = s.lanzamiento, previa = mias[lanz];
    if (previa === i) return;
    mias[lanz] = i; enviando = true; aviso = ""; render();
    try {
      await setDoc(doc(db, "salas", sala.id, "respuestas", `${lanz}__${uid}`), {
        uid, lanzamiento: lanz, qid: s.qid, claseId: s.claseId, opcion: i, ts: serverTimestamp()
      });
      lsSet(claveLocal, mias);
    } catch (e) {
      if (previa === undefined) delete mias[lanz]; else mias[lanz] = previa;
      aviso = "No se pudo enviar la respuesta (¿ya se cerró la votación?).";
    }
    enviando = false; render();
  }
}

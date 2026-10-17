// Procesa una presentación .pptx en el navegador (JSZip global):
//  - detecta diapositivas de pregunta: opciones A, B, C… y "Respuesta X" en las notas del orador
//  - agrega a cada una el botón "▶ Votar en vivo" (si no lo tiene)
// No usa ningún servidor: el archivo no sale de la computadora.

const EMU = 914400;
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const T_HYPER = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/hyperlink";
const LETRAS = "ABCDEF";

const parse = txt => new DOMParser().parseFromString(txt, "application/xml");
const ser = d => new XMLSerializer().serializeToString(d);
const tags = (el, t) => Array.from(el.getElementsByTagName(t));
const dirDe = p => p.slice(0, p.lastIndexOf("/") + 1);
const relsDe = p => `${dirDe(p)}_rels/${p.slice(p.lastIndexOf("/") + 1)}.rels`;
function resolver(base, target) {
  const partes = (dirDe(base) + target).split("/"), out = [];
  for (const s of partes) { if (s === "..") out.pop(); else if (s !== ".") out.push(s); }
  return out.join("/");
}
const textoParrafos = el => tags(el, "a:p").map(p => tags(p, "a:t").map(t => t.textContent).join("")).filter(s => s.trim() !== "");

function formas(slideDoc) {
  return tags(slideDoc, "p:sp").map(sp => {
    const off = sp.getElementsByTagName("a:off")[0];
    const ext = sp.getElementsByTagName("a:ext")[0];
    const ph = sp.getElementsByTagName("p:ph")[0];
    const parrafos = textoParrafos(sp);
    return {
      sp, parrafos, texto: parrafos.join("\n").trim(),
      x: off ? +off.getAttribute("x") : 0, y: off ? +off.getAttribute("y") : 0,
      w: ext ? +ext.getAttribute("cx") : 0,
      ph: ph ? (ph.getAttribute("type") || "body") : null
    };
  }).filter(f => f.texto);
}

const esTitulo = t => /^pregunta(s)?( para la clase| inicial| de la clase)?\s*:?$/i.test(t.trim());

// Devuelve {texto, opciones[], correcta, explicacion} o null
export function detectarPregunta(fs, notas) {
  const m = notas.match(/Respuesta\s*(?:correcta)?\s*:?\s*([A-F])\b/i);
  if (!m) return null;
  let opciones = [], yOp = Infinity, usadas = new Set();

  // Modo 1: letras sueltas en una forma ("A") con el texto de la opción a la derecha, en la misma fila
  const letras = fs.filter(f => /^[A-F]$/.test(f.texto)).sort((a, b) => a.texto.localeCompare(b.texto));
  if (letras.length >= 2) {
    for (const L of letras) {
      const c = fs.filter(f => f !== L && !/^[A-F]$/.test(f.texto) && f.x > L.x && Math.abs(f.y - L.y) < 0.3 * EMU)
        .sort((a, b) => a.x - b.x)[0];
      if (!c) continue;
      opciones.push({ l: L.texto, t: c.texto.replace(/\n/g, " ") });
      usadas.add(L); usadas.add(c); yOp = Math.min(yOp, L.y);
    }
  }
  // Modo 2: párrafos "A) texto", "A. texto", "A: texto"
  let lineasPrevias = [];
  if (opciones.length < 2) {
    opciones = []; usadas = new Set(); yOp = Infinity;
    for (const f of [...fs].sort((a, b) => a.y - b.y || a.x - b.x)) {
      let tiene = false;
      for (const p of f.parrafos) {
        const mm = p.match(/^\s*([A-F])\s*[\)\.:\-–]\s+(.+)$/);
        if (mm && !opciones.some(o => o.l === mm[1])) { opciones.push({ l: mm[1], t: mm[2].trim() }); tiene = true; }
        else if (!tiene && !opciones.length && f.parrafos.some(q => /^\s*[A-F]\s*[\)\.:\-–]\s+/.test(q))) lineasPrevias.push(p);
      }
      if (tiene) { usadas.add(f); yOp = Math.min(yOp, f.y); }
    }
  }
  opciones.sort((a, b) => a.l.localeCompare(b.l));
  if (opciones.length < 2 || opciones.some((o, i) => o.l !== LETRAS[i])) return null;
  const correcta = LETRAS.indexOf(m[1].toUpperCase());
  if (correcta >= opciones.length) return null;

  const enunciado = fs
    .filter(f => !usadas.has(f) && f.y < yOp && !/^\d+$/.test(f.texto) && !esTitulo(f.texto) && !/Votar en vivo/.test(f.texto) && !["sldNum", "title", "ctrTitle", "ftr", "dt"].includes(f.ph))
    .sort((a, b) => a.y - b.y || a.x - b.x).map(f => f.texto);
  const titulo = fs.find(f => f.ph === "title" || f.ph === "ctrTitle");
  let texto = [...enunciado, ...lineasPrevias].join("\n").trim();
  if (!texto && titulo) texto = titulo.texto;

  let explicacion = notas.replace(m[0], "").replace(/^\s*[\.:\-–]?\s*/, "");
  explicacion = explicacion.split("\n").filter(l => !/^\s*Votar en vivo:/i.test(l)).join("\n").trim();
  return { texto, opciones: opciones.map(o => o.t), correcta, explicacion };
}

// Lee la presentación y devuelve {zip, slides:[{n, path, doc, relsDoc, pregunta, idExistente}]}
export async function analizarPptx(file) {
  const zip = await JSZip.loadAsync(file);
  const presDoc = parse(await zip.file("ppt/presentation.xml").async("string"));
  const presRels = parse(await zip.file("ppt/_rels/presentation.xml.rels").async("string"));
  const relPorId = Object.fromEntries(tags(presRels, "Relationship").map(r => [r.getAttribute("Id"), r.getAttribute("Target")]));
  const sldSz = presDoc.getElementsByTagName("p:sldSz")[0];
  const ancho = sldSz ? +sldSz.getAttribute("cx") : 12192000;
  const ids = tags(presDoc, "p:sldId").map(s => s.getAttributeNS(NS_R, "id") || s.getAttribute("r:id"));
  const slides = [];
  for (let i = 0; i < ids.length; i++) {
    const path = resolver("ppt/presentation.xml", relPorId[ids[i]]);
    const doc = parse(await zip.file(path).async("string"));
    const rp = relsDe(path);
    const relsDoc = zip.file(rp) ? parse(await zip.file(rp).async("string")) : null;
    const rels = relsDoc ? tags(relsDoc, "Relationship") : [];
    let notas = "";
    const rn = rels.find(r => /\/notesSlide$/.test(r.getAttribute("Type")));
    if (rn) {
      const nd = parse(await zip.file(resolver(path, rn.getAttribute("Target"))).async("string"));
      const cuerpo = tags(nd, "p:sp").filter(sp => (sp.getElementsByTagName("p:ph")[0]?.getAttribute("type")) === "body");
      notas = cuerpo.map(sp => textoParrafos(sp).join("\n")).join("\n");
    }
    const hl = rels.find(r => r.getAttribute("Type") === T_HYPER && /docente\.html\?q=/.test(r.getAttribute("Target")));
    const idExistente = hl ? decodeURIComponent(hl.getAttribute("Target").split("q=")[1].split("&")[0]) : null;
    const pregunta = detectarPregunta(formas(doc), notas);
    slides.push({ n: i + 1, path, rp, doc, relsDoc, pregunta, idExistente });
  }
  return { zip, slides, ancho };
}

// Agrega el botón a las diapositivas indicadas [{slide, url}] y devuelve un Blob .pptx
export async function agregarBotones(res, lista) {
  const { zip, ancho } = res;
  for (const { slide, url } of lista) {
    if (slide.idExistente) continue;
    let relsDoc = slide.relsDoc;
    if (!relsDoc) {
      relsDoc = parse('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"/>');
    }
    const raiz = relsDoc.documentElement;
    const usados = new Set(tags(relsDoc, "Relationship").map(r => r.getAttribute("Id")));
    let k = 1; while (usados.has(`rIdVV${k}`)) k++;
    const rid = `rIdVV${k}`;
    const rel = relsDoc.createElementNS(raiz.namespaceURI, "Relationship");
    rel.setAttribute("Id", rid); rel.setAttribute("Type", T_HYPER);
    rel.setAttribute("Target", url); rel.setAttribute("TargetMode", "External");
    raiz.appendChild(rel);

    const d = slide.doc;
    const maxId = Math.max(1, ...tags(d, "p:cNvPr").map(c => +c.getAttribute("id") || 0));
    const w = Math.round(2.13 * EMU), h = Math.round(0.58 * EMU);
    const x = ancho - Math.round(0.6 * EMU) - w, y = Math.round(0.5 * EMU);
    const xml = `<p:sp xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${NS_R}">
<p:nvSpPr><p:cNvPr id="${maxId + 1}" name="Boton Votar en vivo"><a:hlinkClick r:id="${rid}" tooltip="Abre la votación en el navegador"/></p:cNvPr><p:cNvSpPr/><p:nvPr/></p:nvSpPr>
<p:spPr><a:xfrm><a:off x="${x}" y="${y}"/><a:ext cx="${w}" cy="${h}"/></a:xfrm><a:prstGeom prst="roundRect"><a:avLst><a:gd name="adj" fmla="val 25000"/></a:avLst></a:prstGeom>
<a:solidFill><a:srgbClr val="1E4D3A"/></a:solidFill><a:ln><a:noFill/></a:ln></p:spPr>
<p:txBody><a:bodyPr lIns="0" tIns="0" rIns="0" bIns="0" anchor="ctr"/><a:lstStyle/><a:p><a:pPr algn="ctr"/><a:r><a:rPr lang="es-AR" sz="1600" b="1"><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:latin typeface="Calibri"/></a:rPr><a:t>▶  Votar en vivo</a:t></a:r></a:p></p:txBody></p:sp>`;
    const nodo = d.importNode(parse(xml).documentElement, true);
    d.getElementsByTagName("p:spTree")[0].appendChild(nodo);
    zip.file(slide.path, ser(d));
    zip.file(slide.rp, ser(relsDoc));
    slide.idExistente = url.split("q=")[1];
  }
  return zip.generateAsync({ type: "blob", mimeType: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
}

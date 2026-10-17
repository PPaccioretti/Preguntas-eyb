// Genera un .pptx con la diapositiva del QR y una diapositiva por pregunta,
// cada una con un botón "▶ Votar en vivo" que abre la pregunta en el navegador.
// Funciona en el navegador (PptxGenJS global) y en Node (para pruebas).

const VERDE = "1F6F5C", TINTA = "1D2327", GRIS = "5F6B73", FONDO_OP = "F3F6F4", BORDE = "D5DED9", BLANCO = "FFFFFF";
const LETRAS = "ABCDEF";

export function generarPptx(PptxGenJS, { banco, urlDiapo, urlQR, urlAlumno, qrData, salaNombre, materia }) {
  const pres = new PptxGenJS();
  pres.layout = "LAYOUT_WIDE"; // 13.33 x 7.5 in
  pres.theme = { headFontFace: "Calibri", bodyFontFace: "Calibri" };
  pres.title = `${materia} — preguntas en clase`;

  // ---------- diapositiva del QR
  const s0 = pres.addSlide();
  s0.background = { color: VERDE };
  s0.addText("Respondé desde el celular", {
    x: 0.7, y: 0.9, w: 6.6, h: 1.4, fontSize: 40, bold: true, color: BLANCO, isTextBox: true, margin: 0, valign: "top"
  });
  s0.addText([
    { text: `${materia} · ${salaNombre}`, options: { breakLine: true } },
    { text: "Escaneá el código. No hace falta cuenta.", options: { breakLine: true } },
    { text: "Dejá la página abierta durante la clase." }
  ], { x: 0.7, y: 2.5, w: 6.4, h: 1.6, fontSize: 18, color: "DCEBE5", isTextBox: true, margin: 0, valign: "top", paraSpaceAfter: 6 });
  s0.addText(urlAlumno, { x: 0.7, y: 4.4, w: 6.4, h: 0.8, fontSize: 13, color: "DCEBE5", isTextBox: true, margin: 0, valign: "top" });
  s0.addText([{ text: "Mostrar QR en vivo / cambiar comisión", options: { hyperlink: { url: urlQR, tooltip: "Abre el QR en el navegador" } } }], {
    shape: pres.ShapeType.roundRect, rectRadius: 0.12, x: 0.7, y: 5.9, w: 4.4, h: 0.6,
    fill: { color: BLANCO, transparency: 85 }, line: { color: BLANCO, width: 1 }, fontSize: 14, color: BLANCO, align: "center", valign: "middle", objectName: "Boton QR"
  });
  s0.addShape(pres.ShapeType.roundRect, { x: 7.85, y: 0.95, w: 5.2, h: 5.6, rectRadius: 0.15, fill: { color: BLANCO }, line: { color: BLANCO }, objectName: "Marco QR" });
  s0.addImage({ data: qrData, x: 8.15, y: 1.25, w: 4.6, h: 4.6, objectName: "QR" });
  s0.addText(salaNombre, { x: 7.85, y: 5.9, w: 5.2, h: 0.5, fontSize: 18, bold: true, color: VERDE, align: "center", isTextBox: true, margin: 0 });
  s0.addNotes(`QR de ${salaNombre}: ${urlAlumno}\nPara otra comisión: descargá las diapositivas eligiendo esa comisión en el panel, o usá el botón "Mostrar QR en vivo".`);

  // ---------- una diapositiva por pregunta
  banco.forEach(p => {
    const s = pres.addSlide();
    s.background = { color: BLANCO };
    if (p.tema) s.addText(p.tema.toUpperCase(), { x: 0.6, y: 0.4, w: 9, h: 0.35, fontSize: 12, color: GRIS, charSpacing: 1, isTextBox: true, margin: 0 });
    s.addText(p.id, { x: 11.2, y: 0.4, w: 1.55, h: 0.35, fontSize: 12, color: GRIS, align: "right", isTextBox: true, margin: 0 });

    const n = p.opciones.length;
    const largo = p.texto.length;
    const tamEnun = largo > 220 ? 22 : largo > 140 ? 26 : 30;
    s.addText(p.texto, { x: 0.6, y: 0.85, w: 12.1, h: 1.55, fontSize: tamEnun, bold: true, color: TINTA, valign: "top", isTextBox: true, margin: 0, fit: "shrink" });

    const y0 = 2.6, alto = 5.35 - y0 + 0.9, gap = 0.16;
    const h = Math.min(0.85, (alto - gap * (n - 1)) / n);
    const tamOp = h < 0.7 ? 16 : 18;
    p.opciones.forEach((o, i) => {
      const y = y0 + i * (h + gap);
      s.addShape(pres.ShapeType.roundRect, { x: 0.6, y, w: 12.1, h, rectRadius: 0.1, fill: { color: FONDO_OP }, line: { color: BORDE, width: 1 }, objectName: `Opcion ${LETRAS[i]}` });
      const d = Math.min(0.5, h - 0.2);
      s.addShape(pres.ShapeType.ellipse, { x: 0.8, y: y + (h - d) / 2, w: d, h: d, fill: { color: VERDE }, line: { color: VERDE } });
      s.addText(LETRAS[i], { x: 0.8, y: y + (h - d) / 2, w: d, h: d, fontSize: 16, bold: true, color: BLANCO, align: "center", valign: "middle", isTextBox: true, margin: 0 });
      s.addText(o, { x: 0.8 + d + 0.25, y, w: 12.1 - d - 0.65, h, fontSize: tamOp, color: TINTA, valign: "middle", isTextBox: true, margin: 0, fit: "shrink" });
    });

    s.addText([{ text: "▶  Votar en vivo", options: { hyperlink: { url: urlDiapo(p.id), tooltip: "Abre la votación en el navegador" } } }], {
      shape: pres.ShapeType.roundRect, rectRadius: 0.12, x: 10.1, y: 6.65, w: 2.6, h: 0.6,
      fill: { color: VERDE }, line: { color: VERDE }, fontSize: 16, bold: true, color: BLANCO, align: "center", valign: "middle", objectName: "Boton votar"
    });
    s.addText("Después: Alt+Tab para volver a la presentación", { x: 0.6, y: 6.75, w: 9, h: 0.4, fontSize: 11, color: GRIS, isTextBox: true, margin: 0, valign: "middle" });

    s.addNotes(`Correcta: ${LETRAS[p.correcta]}${p.explicacion ? `\n${p.explicacion}` : ""}\nRevelar en celulares por defecto: ${p.revelarCelular === false ? "no" : "sí"}\nURL: ${urlDiapo(p.id)}`);
  });
  return pres;
}

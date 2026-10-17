# Preguntas en clase — Estadística y Biometría

Herramienta para hacer preguntas en vivo en clase. Los estudiantes responden desde el celular, sin cuenta, de forma anónima. Vos ves los resultados dentro de la diapositiva de PowerPoint y decidís si la respuesta correcta se muestra solo en pantalla o también en los celulares.

- `index.html`: página de estudiantes (`?sala=com1` … `com7`)
- `docente.html`: panel docente (cargar preguntas, descargar respuestas)
- `docente.html?vista=qr`: diapositiva con el QR de la comisión
- `docente.html?q=ID`: vista de una pregunta (la abre el botón "Votar en vivo")
- `diapositivas.js`: genera el .pptx desde el panel
- `firestore.rules`: reglas de seguridad
- `preguntas_ejemplo.csv`: 5 preguntas de ejemplo y formato del banco
- `config.js`: **el único archivo que hay que editar**

---

## Instalación (una sola vez, ~20 min)

### 1. Firebase
1. Entrá a <https://console.firebase.google.com> con tu cuenta y hacé clic en **Crear proyecto** (por ejemplo `eyb-preguntas`). Google Analytics no hace falta. Usá el plan gratuito (Spark).
   - Si la UNC no permite crear proyectos con la cuenta institucional, usá una cuenta personal. El resto funciona igual.
2. **Authentication → Comenzar → Método de acceso** y habilitá:
   - **Anónimo** (para estudiantes)
   - **Correo electrónico/contraseña** (para docentes)
   - Google es opcional. Dentro de PowerPoint conviene usar correo y contraseña.
3. **Firestore Database → Crear base de datos →** modo **producción**, ubicación `southamerica-east1` (São Paulo).
4. En **Firestore → Reglas**, borrá lo que haya, pegá el contenido de `firestore.rules` y hacé clic en **Publicar**.
5. En **⚙ Configuración del proyecto → General → Tus apps**, agregá una app web (ícono `</>`) sin Hosting. Copiá el bloque `firebaseConfig` y pegalo en `config.js`.

> Que `apiKey` y el resto de la configuración queden en un repositorio público es normal en Firebase: no son contraseñas. La seguridad la dan las reglas del paso 4.

### 2. GitHub Pages
1. Creá un repositorio **público**, por ejemplo `preguntas-eyb`.
2. **Add file → Upload files**: subí todos los archivos de esta carpeta, con `config.js` ya editado.
3. En **Settings → Pages → Build and deployment**, elegí *Deploy from a branch*, rama `main`, carpeta `/ (root)`, y guardá.
4. Al minuto queda en `https://TU-USUARIO.github.io/preguntas-eyb/`.
5. En Firebase, andá a **Authentication → Configuración → Dominios autorizados** y agregá `TU-USUARIO.github.io`.

### 3. Habilitar tu cuenta docente
1. Abrí `https://TU-USUARIO.github.io/preguntas-eyb/docente.html`, escribí tu correo y una contraseña y hacé clic en **Crear cuenta**.
2. Aparece "Cuenta no habilitada" con tu **UID**. Copialo.
3. En **Firestore → Iniciar colección**, poné como ID de colección `docentes`, como ID de documento tu UID, y un campo `nombre` = tu nombre. Guardá.
4. Recargá la página y ya entrás al panel. Otros docentes de comisión hacen lo mismo y vos agregás sus UID.

### 4. Cargar preguntas
Hay dos formas, y podés combinarlas:
- **Desde el panel:** con **＋ Nueva pregunta**, o con **✏️ Editar**, **⧉ Duplicar** y **Borrar** (dos clics) en cada fila. El ID no se cambia al editar, porque está en la URL de la diapositiva.
- **Carga masiva desde Excel:** se explica abajo. **Descargar banco (CSV)** baja lo que hay, lo editás y lo volvés a cargar.

En el panel, en **Banco de preguntas**, elegí el CSV y hacé clic en **Cargar CSV**. Si cargás de nuevo un ID que ya existe, la pregunta se actualiza.

Formato (separador `;` o `,`, primera fila de encabezados):

| columna | contenido |
|---|---|
| `id` | identificador corto, sin espacios: `T4-02` |
| `tema` | aparece arriba de la pregunta |
| `pregunta` | enunciado (puede tener saltos de línea) |
| `A` … `E` | opciones (mínimo 2; las vacías se ignoran) |
| `correcta` | letra |
| `explicacion` | se muestra al revelar |
| `revelar_celular` | `si` / `no`: valor inicial de la casilla "enviarla también a los celulares" |
| `imagen` | opcional: URL de una imagen (por ejemplo, un gráfico subido al mismo repositorio, `img/boxplot.png`) |

En Excel: **Guardar como → CSV UTF-8**. El CSV común (`;`) también funciona.

---

## Trabajo diario (cualquier docente, desde cualquier computadora)

Todo se hace desde el panel `docente.html`. No hace falta instalar nada, ni tocar GitHub, ni que intervenga otra persona.

### Sumar docentes
1. El docente nuevo abre el panel, elige **Crear cuenta** (correo y contraseña) y envía la **solicitud de acceso** con su nombre.
2. Cualquier docente habilitado la ve en **Docentes** y hace clic en **Aprobar**. La página del nuevo docente se actualiza sola.

### Agregar preguntas a una presentación de clase
**Opción A: desde PowerPoint** (recomendada para las clases)
1. Armá la diapositiva de la pregunta como siempre, con las opciones con letras **A, B, C…** (en formas separadas o como párrafos `A) texto`).
2. En las **notas del orador** escribí `Respuesta B` seguido de la explicación.
3. En el panel, en **Agregar preguntas desde una presentación**, subí el `.pptx` y hacé clic en **Analizar**. Revisá la lista y hacé clic en **Cargar al banco y descargar la presentación**.
4. La presentación descargada es la misma con el botón **▶ Votar en vivo** en cada pregunta: reemplazá tu archivo por esa.
5. Si después cambiás el texto o la respuesta en PowerPoint, volvé a procesarla: se actualiza el banco y no se duplican los botones.

**Opción B: desde el banco**
1. Creá o editá la pregunta con **＋ Nueva pregunta** o **✏️ Editar**.
2. Buscala, marcala y hacé clic en **⬇ Diapositivas de las seleccionadas**.
3. En PowerPoint, usá **Inicio → Nueva diapositiva → Reutilizar diapositivas** (o copiar y pegar) para traerlas a tu presentación.

### En clase
- Antes de empezar, abrí el panel en el navegador de la PC del aula e iniciá sesión.
- En la diapositiva de la pregunta (modo presentación), hacé clic en **▶ Votar en vivo**. Se abre la vista de votación con el **QR de la comisión**: elegí la comisión arriba a la derecha y dales un minuto para escanear.
- **▶ Lanzar**, **■ Cerrar**, **✓ Mostrar respuesta**. Después, **Alt+Tab** para volver a PowerPoint (o Ctrl+W para cerrar la pestaña).

**Botones de la vista de pregunta**
- **▶ Lanzar pregunta**: aparece en los celulares. Mientras está abierta, solo se ve el contador de respuestas. Si querés ver la distribución en vivo, marcá la casilla.
- **■ Cerrar votación**: aparece el gráfico de barras.
- **✓ Mostrar respuesta**: se marca la correcta y se muestra la explicación en pantalla. Si la casilla **"enviarla también a los celulares"** está desmarcada, los estudiantes solo leen *"La respuesta se discute en clase"*. Más tarde podés usar **Enviar a celulares**.
- **Terminar**: los celulares vuelven a "Esperando la próxima pregunta".
- **↺ Relanzar** (dos clics): vuelve a votar de cero. Sirve para la técnica de "votar, discutir de a pares y volver a votar".

**Antes de la primera clase**
- Probá todo en **modo presentación** en la computadora del aula.
- Para probar como estudiante usá un celular o una ventana de incógnito, **no** el mismo navegador donde iniciaste sesión como docente.

---

## Si un estudiante cierra la página
- Puede volver a entrar en cualquier momento con el QR de la diapositiva inicial. Mientras una pregunta está abierta, también aparece un **QR chico en la esquina** de la diapositiva. Al entrar ve directamente la pregunta que esté activa.
- Si vuelve a abrir la página en el **mismo navegador**, sigue siendo "el mismo" estudiante: ve la respuesta que había elegido y, si la cambia, se reemplaza su voto.
- Si entra desde otro navegador o en modo incógnito, cuenta como un participante nuevo. En esa pregunta podría votar dos veces, pero el efecto es mínimo con 20 a 80 estudiantes.

## Datos y privacidad
- Los estudiantes no ven el banco de preguntas ni las respuestas de los demás. La respuesta correcta solo llega a sus celulares si la enviás.
- Cada celular tiene un código anónimo. Puede cambiar su respuesta mientras la votación está abierta, y siempre cuenta un solo voto.
- **Respuestas → Descargar** genera un CSV con comisión, fecha, pregunta, respuesta, correcta y acierto (0/1), listo para R.

## Límites del plan gratuito
Firestore Spark: 50.000 lecturas y 20.000 escrituras por día. Una clase de 80 estudiantes con 10 preguntas usa unas 5.000 lecturas y 800 escrituras, así que alcanza aunque des varias comisiones el mismo día.

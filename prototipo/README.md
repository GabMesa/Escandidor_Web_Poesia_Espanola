# Prototipo local: biblioteca y concursos

Iniciar desde la raíz: `npm run dev:prototype`.

Abrir <http://127.0.0.1:8793/prototipo/>. El acceso `/escandidor.html` lleva al Taller; el editor se usa dentro de su pestaña Escandidor.

El almacenamiento por usuario, los campos cifrados y la configuración de claves están documentados en [PLICAS.md](PLICAS.md).

La auditoría de seis portadas y primeras páginas está en [portadas.html](portadas.html), con bases enlazadas, PDF de prueba y límites de validación detallados en [PORTADAS.md](PORTADAS.md).

## Qué se puede probar

- Barra lateral plegable con iconos, nombres accesibles y preferencia persistida en este navegador.
- Escandidor con la misma identidad visual del Taller: paleta, tipografía, superficies y controles. Mantiene las fuentes elegidas para cada poema.
- Colores de poemas más visibles en las tarjetas: franja, indicador y fondo suave. Cada etiqueta recibe un color, editable desde su catálogo; se conserva al renombrarla.
- Biblioteca con catálogo de etiquetas: crear, renombrar y eliminar etiquetas aunque no tengan poemas asignados. El botón Agregar etiquetas abre un selector con casillas y Aplicar etiquetas. En lote permite agregar o quitar etiquetas. Búsqueda y filtros por todas/cualquiera.
- Taller con pestañas Escandidor, Biblioteca, Concursos y Recordatorios. La escritura usa el Escandidor existente; Biblioteca no duplica el editor.
- Biblioteca y Archivos y versiones son una sola interfaz: lista de poemas con filtros y tags, inspector con vista previa e historial, acciones individuales y por selección de poemas o de versiones concretas, incluso entre distintos poemas. Cada fila permite ver, abrir, renombrar, descargar y borrar esa versión. Incluye renombrado, compresión, colores, fuentes, importación Markdown, descargas y papelera integrada. No hay una pantalla de gestor separada. El editor se mantiene montado al cambiar de pestaña.
- Las selecciones de concursos siguen siempre la última versión por defecto; también se pueden fijar versiones. Los ejemplos abiertos y guardados desde Escandidor se vinculan a su poema local, sin duplicar la tarjeta.
- Importación real de una URL de Escritores.org, revisión de los campos, guardado y consulta posterior sin reemplazar selecciones ni entregas.
- Cierre, hora y zona si se detectan, fecha exacta del fallo cuando existe y notas para fechas imprecisas.
- Recordatorios dentro de la app y avisos del navegador activados por el usuario, mientras el taller esté abierto. Los cierres respetan los días elegidos; las fechas previstas del fallo avisan a 7 y 2 días y el propio día. Los enlaces de resultados registrados producen un aviso. Los ejemplos no envían avisos y se guardan marcas locales para evitar repetirlos al recargar.
- Descarga manual de eventos ICS desde Recordatorios y desde cada concurso, con instrucciones para importarlos en Google Calendar. No se necesita conectar una cuenta Google.
- Perfil de formato por concurso, portada, citas con `>`, DOCX real, plica DOCX separada e impresión / PDF usando el navegador. La previsualización separa cada poema en una hoja cuando se activa esa opción y muestra la numeración al pie; cuenta la portada como primera página, igual que DOCX.
- Perfil de plica reutilizable por usuario en SQLite local, con declaración de IA editable y opcional, fecha y nombre para firma. Guardar no firma ni certifica el documento.
- Modales cerrables desde la cruz, Escape o clic en el fondo. La marca de revisión de bases es personal y opcional.
- Registro del envío con copia de la última preparación exportada o de la selección actual si no se exportó. Esa copia conserva texto y formato y permite descargarla después.

## Límites explícitos

Es un prototipo local con datos de ejemplo rotulados. Usa una clave de almacenamiento separada (`escandador.contestsPrototype.v1`) para concursos y etiquetas. El editor y el gestor usan la biblioteca real del Escandidor en el mismo origen. Sus cambios se reflejan en el Taller. Los concursos y tags no se sincronizan todavía con D1.

Las plicas se guardan en `.wrangler/prototype-plicas.sqlite`, por navegador (cookie HttpOnly), compartidas entre concursos, sin poner datos de autoría en localStorage. Se requiere Python para este servidor local. También están implementados el endpoint autenticado `/api/plicas`, la tabla `user_plica_profiles` y las migraciones D1 `0014_contest_plicas.sql` y `0015_user_plica_profiles.sql`; no se aplicó ninguna migración remota ni se publicó el prototipo.

El servidor solo escucha en `127.0.0.1`. La importación consulta páginas HTTPS de Escritores.org bajo `/recursos-para-escritores/` o `/concursos/`, con límite de tamaño, tiempo y validación de redirecciones. No hace barridos del listado. Lee hasta dos PDF enlazados del mismo sitio usando PyMuPDF, con límites de 8 MB y 40 páginas. Los documentos con imágenes y los campos no detectados se señalan para revisión; no hay OCR automático. Los requisitos son editables y los valores de fuente, hoja y tamaño sugeridos se distinguen de los detectados.

La fecha del fallo no prueba que los resultados estén publicados: este prototipo exige que el poeta confirme el enlace. No hay búsquedas periódicas, push, correos ni avisos con el navegador cerrado; los calendarios externos manejan las alarmas del ICS importado.

La previsualización es orientativa, no un motor de paginación. El PDF usa la impresión del navegador: revisar tamaño de hoja, márgenes, encabezados/pies, paginación y peso final. DOCX usa la fuente solicitada, que debe existir en el equipo que lo abre. No se genera una declaración responsable ni se afirma elegibilidad automáticamente.

## Validación

`node scripts/verify-workshop-colors.mjs` comprueba que el color del poema abierto se mantiene en Escandidor, Biblioteca, Concursos, Recordatorios y diálogos. Usa azul, violeta, verde y amarillo, verifica el contraste de los botones y los cambios recibidos con el editor oculto. Guarda 20 capturas y una galería en `qa/prototipo/colores/galeria.html`. El mismo tema compartido se usa en el Taller y en el prototipo.

`node scripts/verify-sinalefa.mjs`, con el servidor activo, verifica el triptongo interno `i-á-y` de `butiá y es` al forzar toda la cadena, la separación manual, la puntuación de `áspera. y` y `áspera, y`, y el resaltado de monosílabos tónicos. Guarda seis capturas en `qa/prototipo/sinalefas/`. `node scripts/export-prototype-gallery.mjs` reúne estas capturas y los 28 flujos generales en `qa/prototipo/galeria.html`.

El acento prosódico de los monosílabos se distingue de la tilde: `sol`, `mar`, `es`, `fue`, `ti` y `yo` son tónicos sin tilde; se respetan pares como `él/el`, `tú/tu`, `mí/mi`, `té/te`, `sé/se`, `dé/de`, `sí/si` y `más/mas`. Las contracciones `al/del`, las conjunciones `si/mas/ni` y los usos habituales de `tan/aun` se tratan como átonos. La pantalla y el cómputo usan la misma tonicidad. El monosílabo final recibe el acento de cierre y conserva el ajuste métrico de una sílaba. La clasificación léxica toma el uso habitual: no resuelve automáticamente nombres de notas o letras (`la`, `te`), citas metalingüísticas o énfasis expresivos. Referencias: [RAE, tilde](https://www.rae.es/dpd/tilde), [Ortografía de la lengua española, tonicidad](https://ceip-calderondelabarca.centros.castillalamancha.es/sites/ceip-calderondelabarca.centros.castillalamancha.es/files/descargas/bernabeu_pag_640.pdf) y [Compendio de arte poética, métrica y acento](https://www.cervantesvirtual.com/obra-visor/compendio-de-arte-poetica/html/dcb22258-2dc6-11e2-b417-000475f5bda5_6.html).

`node --test tests/contest-prototype.test.js` verifica extracción, fechas ambiguas, seguridad del importador, seguimiento de versiones, citas, calendario y estructura de DOCX.

`node scripts/audit-contest-imports.mjs` consulta seis convocatorias reales: Manini Ríos, Gonzalo de Berceo, Tino Barriuso, Zahara, Adonáis y Paco Mollá. Conserva datos e informe en `qa/prototipo/importaciones/`. Compara campos concretos, no garantiza extracción completa de las bases.

`tests/backend.integration.test.js` verifica que D1 guarda y recupera la plica, rechaza solicitudes anónimas y mantiene separados los usuarios, reutiliza el perfil entre concursos y migra las plicas anteriores.

Con el servidor activo, `npm run verify:prototype` revisa los flujos en Edge con perfil aislado, guarda 24 capturas en `qa/prototipo/` y conserva DOCX reales de prueba. Comprueba la Biblioteca unificada, renombrado de poemas y versiones reales y de ejemplo, apariencia, compresión, borrado y restauración, importación Markdown, editor único, perfil SQLite compartido entre concursos, declaración de IA y cierre al hacer clic afuera. También comprueba los permisos de notificaciones, la activación y desactivación y la descarga .ics desde Recordatorios. La entrega de notificaciones se intercepta en el perfil de QA para no mostrar avisos de prueba en el sistema operativo.

La Biblioteca llama a los servicios existentes de `app.js` a través de un puente del mismo origen. Los accesos del Escandidor y el antiguo botón de gestor abren la Biblioteca nueva. El gestor anterior conserva controles internos ocultos necesarios para sus servicios, pero ya no se muestra como otra pantalla. PDF de Biblioteca genera un archivo descargable usando el mismo jsPDF que el gestor anterior; DOCX y Markdown también admiten versiones seleccionadas o todo el historial. La apertura de versiones llama al servicio directamente, sin depender de botones del gestor oculto. Las selecciones y entregas siguen la identidad del poema al restaurarlo, incluso cuando el gestor asigna una nueva clave local. Los poemas de ejemplo usan su almacenamiento separado. Las fuentes remotas se cargan sin bloquear la inicialización del editor.

Las fichas precargadas de Manini Ríos y Gonzalo de Berceo son ejemplos editables basados en convocatorias de 2026. El Certamen del Río es ficticio para mostrar el estado de resultados publicados. Los poemas precargados son textos ficticios de demostración.

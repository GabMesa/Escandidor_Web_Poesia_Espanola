# Funciones del gestor trasladadas a Biblioteca

| Función anterior | Dónde está ahora |
| --- | --- |
| Buscar poemas, versiones o texto | Buscador de Biblioteca |
| Abrir poema o una versión concreta | Lista de poemas, selector y botón Abrir de cada versión |
| Ver contenido de una versión | Botón Ver y previsualización lateral |
| Renombrar poema o versión | Renombrar en el encabezado y en cada fila |
| Marcar versiones individuales | Casilla de cada versión; la selección continúa al cambiar de poema |
| Seleccionar todas las versiones de un poema | Casilla encima del historial |
| Descargar versiones marcadas | Descargar marcadas: Markdown, DOCX o PDF |
| Descargar última versión o historial completo | Descargar historial; también Descargar sobre una selección de poemas |
| Descargar una versión | MD y PDF en cada fila; DOCX en la previsualización |
| Borrar versiones concretas o poemas completos | Borrar marcadas, botón de borrar de la fila y Enviar poema a la papelera |
| Comprimir todas las versiones de poemas seleccionados | Comprimir en acciones de poemas; también Comprimir en el historial |
| Compresión automática al guardar | Preferencias |
| Color y fuente del poema | Color y fuente; incluye Usar color por defecto |
| Fuente y color predeterminados | Preferencias; incluye Restablecer color por defecto |
| Comparar y sincronizar con la nube | Preferencias; requiere la sesión existente del Escandidor |
| Restaurar, vaciar y configurar limpieza de papelera | Pestaña Papelera |
| Crear poema e importar Markdown | Encabezado de Biblioteca |

Las etiquetas se crean en Crear / gestionar etiquetas y permanecen aunque no estén asignadas. Agregar etiquetas abre casillas y aplica los cambios al poema. Etiquetar en acciones de selección permite agregar o quitar etiquetas a varios poemas. Renombrar o eliminar una etiqueta también actualiza las copias recuperables, para que la restauración no reintroduzca el nombre anterior.

Los poemas reales utilizan la biblioteca del Escandidor. El prototipo mantiene sus ejemplos separados y rotulados. Las entregas registradas siguen conservando sus copias. La nueva Biblioteca usa los servicios de `app.js`; el gestor anterior permanece oculto como soporte interno, sin ofrecer una segunda pantalla.

Verificación: crear una etiqueta sin asignarla, aplicarla y renombrarla; seleccionar y exportar versiones exactas de distintos poemas; borrar una versión real y otra de ejemplo en la misma operación y restaurarlas; generar PDF descargable; abrir Biblioteca desde el Escandidor integrado y desde el acceso antiguo, que ahora lleva al Taller.

Las tarjetas resaltan el color del poema con una franja de ocho píxeles, un indicador y un fondo suave. Las etiquetas tienen colores propios, editables al crearlas o desde el catálogo; se conservan al renombrarlas. La barra lateral se puede contraer a iconos y conserva su estado en este navegador.

Los concursos nuevos se agregan a la agenda con recordatorios a 14, 7 y 2 días. Al guardarlos se activa el servicio de avisos y se solicita permiso al navegador si hace falta. Los avisos requieren mantener el taller abierto. Desde un concurso se pueden asignar las mismas etiquetas que en Biblioteca. Quitar de la agenda conserva la ficha y sus entregas, y excluye cierres y resultados de los avisos. Se puede volver a agregar desde la ficha o Recordatorios. Eliminar un concurso requiere confirmación y conserva los poemas y la plica del usuario.

# Aplicación real en local

Iniciar desde la raíz del proyecto con `npm run dev:local` y abrir <http://localhost:8794/taller/>. Se necesita Node.js, Python y las dependencias de `npm`. En Windows la clave de cifrado se protege con DPAPI. En otros sistemas se debe proporcionar `PLICA_ENCRYPTION_KEY` según `prototipo/PLICAS.md`.

La entrada anterior <http://localhost:8794/escandidor> (también `/escandidor.html` y `/escandidor/`) abre el Taller en su pestaña Escandidor. Esta ruta la resuelve únicamente el servidor de desarrollo local. El editor interno sigue disponible con `?taller=1`. El color del poema abierto se comparte con Biblioteca, Concursos, Recordatorios y diálogos.

La portada <http://localhost:8794/> presenta la mesa de trabajo completa: escritura, métrica, biblioteca y versiones, concursos, exportaciones y recordatorios. «Abrir mi mesa» lleva al Taller. `node scripts/verify-landing.mjs` verifica la portada en escritorio y móvil, en claro y oscuro, y guarda las capturas en `qa/local/landing/`.

Los selectores de versiones del editor, Biblioteca y Concursos muestran primero «Guardadas manualmente» y después «Autoguardados», con las más recientes primero en cada grupo. Conservan la selección actual y el seguimiento cronológico de «Última versión». `node scripts/verify-version-selection.mjs` verifica un historial mixto y la apertura de una versión manual anterior en un perfil aislado.

El servidor escucha solo en este equipo. La API de Pages se ejecuta localmente en el puerto 8795. La base SQLite de esta aplicación está en `.wrangler/real-local/`, separada del prototipo y de las bases remotas. El arranque utiliza exclusivamente `d1 execute --local`; la API utiliza un identificador local ficticio y no se ejecutan despliegues ni migraciones remotas. `wrangler.jsonc` y la base de Cloudflare no se modifican.

Crear una cuenta desde «Ingresar / crear cuenta». Son cuentas locales: no son las cuentas del sitio publicado. Sin cuenta se puede escribir y guardar poemas en este navegador. Con cuenta se guardan poemas, versiones, concursos, etiquetas y preferencias en la base local; la plica se vincula al usuario y sus campos sensibles se cifran. Los concursos nuevos entran en la agenda con avisos; las notificaciones del navegador requieren permiso y que el taller permanezca abierto.

«Traer del prototipo» abre una pantalla en el puerto 8793. Mantener el prototipo iniciado (`npm run dev:prototype`) para esta operación. La pantalla permite copiar todos los poemas guardados y sus versiones, etiquetas y concursos reales. Excluye fichas de ejemplo y conserva el origen. La plica se copia solo si se marca la opción correspondiente. Si no aparecen datos, utilizar «Buscar en la otra dirección»: localhost y 127.0.0.1 tienen almacenamientos distintos en el navegador.

La caché del navegador está separada por usuario. Los guardados de concursos y etiquetas usan revisiones para impedir que una pestaña antigua reemplace los cambios de otra. Los errores aparecen junto a la cuenta; «Guardar» reintenta y «Copia local» permite conservar el borrador pendiente.

Para verificar: `npm test` y, con el servidor iniciado, `npm run verify:local`. Las pruebas visuales usan un perfil propio de Edge y cuentas de prueba; no modifican la sesión del navegador del usuario. Las imágenes quedan en `qa/local/`. La comprobación incluye recuperación sin caché, aislamiento de cuentas, importación real de Escritores.org, plica, selección de versiones y migración del prototipo.

Conservar `.wrangler/real-local/` y `.wrangler/prototype-plica-key.dpapi` para recuperar la base y sus datos cifrados. La clave DPAPI depende del usuario de Windows. No publicar estos archivos ni incluirlos en Git.

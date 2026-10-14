# Perfil de plica y protección de datos

La API `/api/plicas` lee y actualiza el perfil del usuario autenticado, sin identificador de concurso. Ni el cliente ni el cuerpo de la petición pueden elegir otro propietario. El prototipo local utiliza una cookie HttpOnly por navegador; la API D1 utiliza la cuenta autenticada y permite reutilizar el perfil entre dispositivos.

Se cifran nombre completo, documento, dirección, correo, teléfono, reseña biobibliográfica y nombre para la firma. La opción de incluir declaración de IA, su texto y su fecha se guardan en columnas sin cifrar. El título de la obra y el seudónimo siguen siendo ajustes de cada concurso. La declaración es editable y debe revisarse antes de cada entrega.

Los campos personales usan AES-256-GCM, nonce aleatorio de 12 bytes y etiqueta de autenticación de 128 bits. El identificador de usuario forma parte de los datos autenticados: copiar el bloque cifrado a otro perfil impide descifrarlo. Las respuestas de la API llevan `Cache-Control: no-store`; los datos de autoría no se guardan en localStorage.

## Servidor local

Al iniciar, el servidor migra las plicas anteriores a un perfil por propietario. Toma las preferencias más recientes y completa los campos personales vacíos con valores anteriores. Elimina la tabla antigua y ejecuta `secure_delete` y `VACUUM` sobre SQLite.

En Windows genera una clave aleatoria y guarda únicamente su versión protegida mediante DPAPI en `.wrangler/prototype-plica-key.dpapi`, fuera del código y bloqueada para descargas HTTP. Usa el ámbito LocalMachine para permitir ejecutar el prototipo desde las cuentas de desarrollo de este equipo. Esto protege una copia robada fuera del equipo; un proceso con acceso al archivo en este mismo equipo puede usar DPAPI. La clave sin proteger solo pasa por memoria y tuberías privadas. No se imprime ni se pasa como argumento de un comando.

También admite `PLICA_ENCRYPTION_KEY` desde el entorno. Si ya hay perfiles cifrados y falta la clave original, falla sin generar una clave nueva. No borres el archivo de clave: perderlo impide recuperar los datos. En otros sistemas se exige la variable de entorno.

## D1 y despliegue

Antes de habilitar la API en producción, aplicar las migraciones 0014 y 0015 y configurar `PLICA_ENCRYPTION_KEY` como **secreto de Cloudflare Pages**, una clave aleatoria de 32 bytes codificada en Base64. No utilizar el valor fijo de las pruebas. No guardarla en D1, en variables públicas, en archivos publicados ni en Git. `.dev.vars*`, `.env*`, `.wrangler` y los archivos DPAPI están excluidos de Git.

La migración 0015 crea `user_plica_profiles`, con `user_id` como clave primaria, y bloquea nuevas escrituras en la tabla anterior. La API migra hasta diez usuarios por petición, con inserción y borrado transaccionales. Mientras queden usuarios pendientes responde 503; las siguientes peticiones continúan el trabajo. Una migración no sobrescribe perfiles que ya existan. Tras completar la conversión, verificar que `user_contest_plicas` tenga cero filas. La conversión de D1 no limpia automáticamente copias históricas, exportaciones ni backups anteriores que contengan datos sin cifrar.

No se aplicaron migraciones remotas ni se publicó este prototipo. La rotación de claves necesita una conversión explícita con la clave anterior: cambiar el secreto directamente hace ilegibles los perfiles existentes.

El cifrado protege los campos personales frente a una copia de la base sin acceso a la clave. No evita el robo si se compromete el servidor que puede descifrarlos. Los DOCX de plica exportados contienen los datos legibles necesarios para entregar al organizador.

Referencias: [OWASP, almacenamiento criptográfico](https://cheatsheetseries.owasp.org/cheatsheets/Cryptographic_Storage_Cheat_Sheet.html) y [Cloudflare, secretos](https://developers.cloudflare.com/workers/configuration/secrets/).

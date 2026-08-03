# Escandidor de poesia espanola

Aplicacion web para escandir poesia en espanol, editar y versionar poemas, consultar recursos lexicos y sincronizar una biblioteca personal. El frontend es HTML, CSS y JavaScript sin compilacion; el backend usa Cloudflare Pages Functions y D1.

Produccion: <https://mesa-de-poesia.pages.dev/>

## Retomar el proyecto

1. Instala una version LTS vigente de Node.js.
2. Ejecuta `npm ci` y despues `npm test`.
3. Lee [ARCHITECTURE.md](ARCHITECTURE.md) para entender responsabilidades y contratos.
4. Lee [OPERATIONS.md](OPERATIONS.md) antes de tocar Cloudflare, D1, Discord o Ko-fi.
5. Revisa [TODO.md](TODO.md) para conocer deuda y trabajo pendiente.
6. Comprueba en Cloudflare que el proyecto, D1, dominios y secretos siguen activos.
7. Antes de desplegar, revisa cambios incompatibles de Wrangler y actualiza `compatibility_date` deliberadamente.

No ejecutes migraciones remotas ni despliegues hasta obtener una copia de seguridad de D1 y confirmar el proyecto y la cuenta de Cloudflare seleccionados.

## Desarrollo

```powershell
npm ci
npm test
npm run dev
```

`npm run dev` sirve el sitio completo con Pages Functions y una D1 local. Para usar solo el analizador sin cuentas se puede abrir `index.html`.

```powershell
npm run check
npm run deploy
```

`npm run deploy` publica conscientemente en Cloudflare Pages. El repositorio no mantiene un despliegue paralelo de GitHub Pages porque el hosting estatico no incluye Functions ni D1.

## Que hace hoy
- Entrada de poema en un panel izquierdo.
- Salida limpia en el panel derecho.
- Escansion en linea por verso:
  - separacion silabica con guiones,
  - silaba tonica destacada en negrita,
  - conteo metrico por verso,
  - patron de acentos (posiciones silabicas).
- Acento versal configurable:
  - preset o patron personalizado (ej: 6-10, 2-4-8-10),
  - validacion visual verde/rojo por posicion.
- Hemistiquio:
  - marcado inline con / o corte global para todas las lineas,
  - salida metrica en formato n+m.
- Sinalefa:
  - deteccion automatica en fronteras candidatas,
  - forzado/ruptura manual con clic por frontera.
- Revision de monosilabos:
  - deteccion de soporte ritmico debil en posiciones objetivo (*).
- Cuentas de usuario (opcional, requiere el backend descrito abajo):
  - registro/inicio de sesion,
  - guardado de poemas en la nube ademas del guardado local,
  - panel de administracion para gestionar usuarios y poemas.

Ejemplo de formato de salida:

Ca-**mi**-no **len**-to por la **tar**-de **cla**-ra, 11 2-4-8-10

## Mapa del repositorio
- index.html: estructura de la pagina.
- styles.css: estilos y layout responsive.
- analyzer.js: reglas de silabificacion, acentuacion y conteo.
- app.js: renderizado y eventos UI del analizador.
- auth.js: barra de cuenta (login/registro/cerrar sesion) y sincronizacion
  de poemas con la nube desde la pagina principal.
- admin.html / admin.js: panel de administracion (gestion de usuarios y
  poemas de todos los usuarios).
- functions/api/**: backend en **Cloudflare Pages Functions** (rutas
  `/api/*`, una funcion por archivo) que atiende autenticacion, guardado
  de poemas y administracion, usando D1 como base de datos.
  - `functions/_lib/helpers.js`: utilidades compartidas (hash de
    contrasenas, cookies de sesion, guards de autenticacion). No es una
    ruta, solo se importa desde los archivos de `functions/api/**`.
  - `functions/api/auth/{register,login,logout,me}.js`
  - `functions/api/poems/index.js` (listar/crear) y `[id].js` (editar/borrar)
  - `functions/api/admin/stats.js`, `admin/users/{index,[id]}.js`,
    `admin/poems/{index,[id]}.js`
- schema.sql: esquema normalizado de D1 para usuarios, poemas versionados,
  servicios, funcionalidades y pagos.
- wrangler.jsonc: configuracion del proyecto de Pages (`pages_build_output_dir`
  + binding D1). Pages sirve los archivos estaticos automaticamente y
  enruta `/api/*` a las funciones de `functions/`.
- reglas_escanción.md: reglas linguisticas de referencia.

Los archivos web permanecen en la raiz porque `wrangler.jsonc` publica `.` y sus URL son parte del contrato. Moverlos requiere una migracion separada de referencias, sitemap, despliegue y pruebas.

## Ejecucion sin backend
1. Abre index.html en tu navegador.
2. Escribe o pega tu poema en el panel izquierdo.
3. Revisa el analisis en el panel derecho.

El analizador en si no requiere build ni backend. La barra de cuenta que
aparece arriba (iniciar sesion / crear cuenta / guardar en la nube) solo
funciona cuando la app corre detras del Worker descrito abajo; si no hay
backend disponible, esos botones mostraran un error de red al usarse pero
el analizador sigue funcionando con normalidad.

## Backend: cuentas, guardado en la nube y administracion

Esta app ahora incluye un backend opcional en **Cloudflare Pages
Functions + D1** que agrega:

- **Registro e inicio de sesion** de usuarios (contrasena con hash
  PBKDF2 + sesiones por cookie httpOnly).
- **Guardado de poemas por usuario** en la nube (ademas del guardado local
  que ya existia en el navegador vía `localStorage`).
- **Historial completo de versiones**: cada guardado manual crea una version
  del mismo poema. Al iniciar sesion se cargan desde D1 todos los poemas con
  todas sus versiones, que pueden abrirse individualmente desde el gestor de
  archivos.
- **Reconciliacion manual** mediante el boton `Comparar y sincronizar`.
  Compara cada poema local con D1, descarga todo el historial remoto y sube
  los estados locales diferentes como versiones nuevas, sin reemplazar una
  biblioteca completa ni descartar informacion.
- **Datos anonimos separados**: al iniciar sesion se ofrece importar los
  poemas locales sin borrar sus copias anonimas; al cerrar sesion vuelve a
  activarse la biblioteca anonima.
- **Papelera sincronizada** con las 10 eliminaciones mas recientes de la
  cuenta. El boton `Vaciar` elimina el contenido recuperable de D1, pero
  conserva marcas internas por ID para impedir que una sesion antigua vuelva
  a subir poemas eliminados.
- **Control de sesiones duplicadas**: una sesion nueva puede cerrar las otras
  sesiones de la misma cuenta y obligarlas a autenticarse otra vez.
- **Reintentos persistentes**: los guardados y borrados fallidos permanecen en
  una cola por usuario hasta que se reintentan correctamente.
- **Panel de administracion** (`/admin.html`) para ver/editar/borrar
  usuarios y poemas de todos los usuarios.

### Requisitos
- Cuenta de Cloudflare con Workers y D1 habilitados.
- `npx wrangler` (no requiere instalacion global).

### Crear una base de datos D1 nueva
```bash
npx wrangler d1 create escandidor-db
```
Copia el `database_id` que te devuelve en `wrangler.jsonc` si es distinto
al que ya esta configurado.

### Aplicar el esquema
```bash
# Local (para wrangler dev)
npx wrangler d1 execute escandidor-db --file=./schema.sql

# Produccion
npx wrangler d1 execute escandidor-db --remote --file=./schema.sql
```
`schema.sql` crea las tablas y relaciones en una base de datos vacia; no
incluye instrucciones para borrar datos existentes.

En una base existente aplica solo las migraciones pendientes en orden. Usa el flujo de migraciones documentado en [OPERATIONS.md](OPERATIONS.md); no repitas a ciegas pasos historicos.

### Ejecutar localmente
```bash
npx wrangler pages dev .
```
Esto sirve `index.html`, `app.js`, `admin.html`, etc. como estaticos y
atiende las rutas `/api/*` con las funciones dentro de `functions/`.

### Desplegar
```bash
npx wrangler pages deploy .
```
(o conecta el repositorio en el dashboard de Cloudflare Pages para
despliegues automaticos en cada push).

### Administradores
Todas las cuentas nuevas, incluida la primera de una base vacia, se crean con
rol `user`. Un administrador existente puede promover usuarios desde
`/admin.html`. Si la base aun no tiene administradores, el rol inicial debe
asignarse explicitamente desde D1:
```bash
npx wrangler d1 execute escandidor-db --remote --command="UPDATE users SET role = 'admin' WHERE email = 'correo@example.com'"
```

### Acceso con Discord
Configura en Discord Developer Portal este redirect de OAuth2:
`https://mesa-de-poesia.pages.dev/api/auth/discord/callback`.

Guarda las credenciales como secretos de Pages, nunca en archivos del
repositorio:
```bash
npx wrangler pages secret put DISCORD_CLIENT_ID --project-name mesa-de-poesia
npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name mesa-de-poesia
```

### Endpoints de la API
| Metodo | Ruta | Descripcion | Acceso |
|---|---|---|---|
| POST | `/api/auth/register` | Crea usuario | publico |
| POST | `/api/auth/login` | Inicia sesion | publico |
| GET | `/api/auth/discord` | Inicia OAuth con Discord | publico |
| GET | `/api/auth/discord/callback` | Completa OAuth con Discord | publico |
| POST | `/api/auth/logout` | Cierra sesion | usuario autenticado |
| GET | `/api/auth/me` | Usuario actual | publico (devuelve `null` si no hay sesion) |
| GET | `/api/poems` | Lista poemas propios con todas sus versiones | usuario autenticado |
| POST | `/api/poems` | Crea poema | usuario autenticado |
| PUT | `/api/poems/:id` | Actualiza poema propio | usuario autenticado |
| DELETE | `/api/poems/:id` | Borra poema propio | usuario autenticado |
| DELETE | `/api/poems/:id?version=N` | Borra una version del poema | usuario autenticado |
| GET | `/api/trash` | Lista hasta 10 eliminaciones y los IDs borrados | usuario autenticado |
| POST | `/api/trash` | Registra el ID de un poema borrado por otra sesion | usuario autenticado |
| DELETE | `/api/trash` | Vacia el contenido recuperable y conserva las marcas por ID | usuario autenticado |
| GET | `/api/admin/stats` | Conteos generales | admin |
| GET | `/api/admin/users` | Lista/busca usuarios | admin |
| PATCH | `/api/admin/users/:id` | Cambia rol/estado | admin |
| DELETE | `/api/admin/users/:id` | Borra usuario y sus poemas | admin |
| GET | `/api/admin/poems` | Lista/busca poemas de todos | admin |
| DELETE | `/api/admin/poems/:id` | Borra cualquier poema | admin |

## Registro de decisiones de implementacion

Ventana auditada: **2026-07-26, ultimas 2 horas de trabajo**. Este registro
resume decisiones de comportamiento; no sustituye el historial de Git ni las
migraciones SQL.

Alcance principal de los cambios:
- Frontend y almacenamiento local: `app.js`, `auth.js`, `cloud-sync.js`,
  `index.html` y `styles.css`.
- Autenticacion y sesiones: `functions/_lib/helpers.js`,
  `functions/api/auth/login.js`, `functions/api/auth/me.js` y
  `functions/api/auth/sessions/others.js`.
- Poemas y papelera: `functions/api/poems/index.js`,
  `functions/api/poems/[id].js` y `functions/api/trash/index.js`.
- Datos: `schema.sql` y migraciones `0003` a `0006`.
- Regresion: `tests/backend.integration.test.js` y
  `tests/cloud-sync.test.js`.

| Area | Decision | Motivo e impacto auditable |
|---|---|---|
| Roles | Toda cuenta nueva se crea como `user`; no existe promocion automatica del primer registro. | Evita conceder privilegios administrativos por orden de registro. La promocion inicial requiere una accion explicita en D1. |
| Modelo de poemas | `poems` representa la identidad del poema y `poem_versions` conserva cada version en orden. `/api/poems` devuelve el historial completo, no solo `current_poems`. | Las versiones son estados consultables del mismo poema y deben poder abrirse individualmente. |
| Identidad local | El almacenamiento local usa esquema v2 con claves inmutables `local:<uuid>` o `server:<id>`; `poemTitle` es metadato editable. | Permite titulos duplicados, renombrados y poemas nuevos con el mismo titulo que uno borrado. Los datos antiguos se migran automaticamente. |
| Inicio y cierre de sesion | Cada cuenta y la sesion anonima mantienen memorias separadas. Los poemas anonimos se importan solo tras confirmacion y sin borrar el original. | Iniciar sesion no debe ocultar permanentemente, mezclar ni destruir trabajo local. |
| Sesiones duplicadas | El backend cuenta las otras sesiones activas y permite revocarlas desde la sesion actual; las revocadas deben iniciar sesion otra vez. | Reduce escrituras concurrentes desde navegadores con estado desactualizado. |
| Reconciliacion | `Comparar y sincronizar` fusiona por ID y firma de contenido/configuracion. Los estados locales unicos se suben como `{titulo}_version_{n}`; los remotos se conservan completos. | La ausencia de un poema en un lado no se interpreta como orden de borrado y ninguna diferencia se sobrescribe silenciosamente. |
| Guardado | Solo los guardados manuales se sincronizan; los autosaves permanecen locales. Las operaciones fallidas quedan en un outbox persistente ligado al ID del usuario. | Evita ruido de versiones, perdida por fallos de red y ejecucion de trabajos pendientes bajo otra cuenta. |
| Borrado | `deleted_poems` es la unica tabla para papelera y marcas de borrado. `poem_id` identifica un borrado completo; el titulo solo se muestra como contexto. | Una sesion antigua no puede resucitar un ID eliminado y un poema nuevo puede reutilizar el mismo titulo. Se elimino `poem_tombstones`. |
| Papelera | Se muestran como maximo 10 grupos con contenido recuperable. Al vaciarla se borra ese contenido, pero se mantienen filas ID-only para bloquear cargas antiguas. | Se separa la experiencia de papelera de la proteccion de sincronizacion sin mantener dos tablas. |
| Copias locales obsoletas | Si `/api/trash` marca un ID remoto como borrado, la reconciliacion elimina su copia local y su mapa de nube; no la vuelve a copiar en la papelera local. | La papelera del servidor ya contiene el archivo autorizado y no se duplica estado obsoleto del navegador. |
| Migraciones D1 | `0003` creo `deleted_poems`; `0004` y `0005` fueron pasos historicos de tombstones; `0006` agrego `poem_id`, migro las marcas y elimino `poem_tombstones`. | `0006` se aplico y verifico en la D1 remota `escandidor-db`; ambas tablas estaban vacias antes de consolidarlas. |
| Verificacion | Linea base al 2026-08-03: 40 pruebas aprobadas, 0 fallos. | Ejecuta `npm test`; el numero crecera al agregar cobertura. |

## Hosting
Con el backend, el hosting recomendado es **Cloudflare Pages**
(`wrangler pages deploy .`), ya que necesita el binding de D1 y las
Pages Functions de la carpeta `functions/` para atender las rutas
`/api/*`.

Una copia estatica puede ejecutar parte del analizador, pero no representa la aplicacion completa y pierde cuentas, D1, administracion, sincronizacion y webhooks. El despliegue soportado es Cloudflare Pages.

## Metodologia del analizador (v2)
1. Tokeniza lineas y palabras.
2. Separa silabas por reglas ortograficas.
3. Detecta silaba tonica (tilde o regla general).
4. Clasifica acento de palabra.
5. Suma silabas por linea.
6. Ajusta por acento final del verso (aguda +1, llana 0, esdrujula -1, monosilaba final +1).
7. Calcula posiciones de acentos del verso.
8. Aplica sinalefa por fronteras con reglas conservadoras y overrides manuales.
9. Valida acentos detectados contra el patron versal objetivo.
10. Si hay hemistiquio, computa y muestra n+m por partes.

## Metodos principales en JavaScript
- analyzePoem(text)
- splitIntoLines(text)
- splitLineIntoWords(line)
- analyzeLine(line)
- analyzeWord(word)
- syllabifyWord(word)
- detectStressSyllable(word, syllables)
- classifyWordAccentType(syllables, stressIndex)
- adjustPoeticCount(syllableCount, accentType)
- parseStressPattern(value)
- normalizeInput(text)
- renderAnalysis(result)
- renderAnnotatedLine(runtime)
- buildLineRuntime(lineAnalysis, lineIndex)

## Modulos externos: que delegar en el futuro
Partes candidatas para delegar a librerias especializadas:
- Silabificacion avanzada (casos de excepcion y dialectales).
- Deteccion acentual lexica con diccionario.

Partes que conviene mantener locales:
- Conteo metrico poetico por verso.
- Reglas de ajuste final (aguda/llana/esdrujula).
- Presentacion de salida y formato de escansion.

## Limitaciones actuales
Aun no implementado o parcial:
- Dialefa y sineresis avanzadas.
- Reglas dialectales finas de sinalefa/hiato.
- Analisis ritmico de estrofa completa (no solo por linea).
- Tonicidad secundaria profunda.

Ver detalles en reglas_escanción.md.

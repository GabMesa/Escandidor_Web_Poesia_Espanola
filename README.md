# Escandador basico de poesia en espanol

Aplicacion estatica (HTML + CSS + JS) para analizar versos en espanol.

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

## Estructura
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

## Como ejecutar local (solo analizador, sin cuentas)
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
- **Panel de administracion** (`/admin.html`) para ver/editar/borrar
  usuarios y poemas de todos los usuarios.

### 1. Requisitos
- Cuenta de Cloudflare con Workers y D1 habilitados.
- `npx wrangler` (no requiere instalacion global).

### 2. Crear la base de datos D1 (si aun no existe)
```bash
npx wrangler d1 create escandidor-db
```
Copia el `database_id` que te devuelve en `wrangler.jsonc` si es distinto
al que ya esta configurado.

### 3. Aplicar el esquema
```bash
# Local (para wrangler dev)
npx wrangler d1 execute escandidor-db --file=./schema.sql

# Produccion
npx wrangler d1 execute escandidor-db --remote --file=./schema.sql
```
`schema.sql` crea las tablas y relaciones en una base de datos vacia; no
incluye instrucciones para borrar datos existentes.

### 4. Ejecutar localmente
```bash
npx wrangler pages dev .
```
Esto sirve `index.html`, `app.js`, `admin.html`, etc. como estaticos y
atiende las rutas `/api/*` con las funciones dentro de `functions/`.

### 5. Desplegar
```bash
npx wrangler pages deploy .
```
(o conecta el repositorio en el dashboard de Cloudflare Pages para
despliegues automaticos en cada push).

### 6. Primer usuario administrador
El **primer usuario que se registre** en una base de datos vacia queda
como `admin` automaticamente. Registra tu propia cuenta primero desde la
app para quedar como administrador; desde ahi puedes promover o
degradar a otras cuentas desde `/admin.html`.

### Endpoints de la API
| Metodo | Ruta | Descripcion | Acceso |
|---|---|---|---|
| POST | `/api/auth/register` | Crea usuario | publico |
| POST | `/api/auth/login` | Inicia sesion | publico |
| POST | `/api/auth/logout` | Cierra sesion | usuario autenticado |
| GET | `/api/auth/me` | Usuario actual | publico (devuelve `null` si no hay sesion) |
| GET | `/api/poems` | Lista poemas propios | usuario autenticado |
| POST | `/api/poems` | Crea poema | usuario autenticado |
| PUT | `/api/poems/:id` | Actualiza poema propio | usuario autenticado |
| DELETE | `/api/poems/:id` | Borra poema propio | usuario autenticado |
| GET | `/api/admin/stats` | Conteos generales | admin |
| GET | `/api/admin/users` | Lista/busca usuarios | admin |
| PATCH | `/api/admin/users/:id` | Cambia rol/estado | admin |
| DELETE | `/api/admin/users/:id` | Borra usuario y sus poemas | admin |
| GET | `/api/admin/poems` | Lista/busca poemas de todos | admin |
| DELETE | `/api/admin/poems/:id` | Borra cualquier poema | admin |

## Hosting
Con el backend, el hosting recomendado es **Cloudflare Pages**
(`wrangler pages deploy .`), ya que necesita el binding de D1 y las
Pages Functions de la carpeta `functions/` para atender las rutas
`/api/*`.

Si solo quieres el analizador sin cuentas ni backend, puedes seguir
desplegando unicamente los archivos estaticos (index.html, styles.css,
analyzer.js, app.js) en:
- GitHub Pages
- Amazon S3 (website hosting)

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

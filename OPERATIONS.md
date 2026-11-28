# Operaciones

Guia para operar Escandidor sin depender de memoria personal. Los comandos remotos modifican produccion: confirma cuenta, proyecto y copia de seguridad antes de ejecutarlos.

## Inventario externo

| Recurso | Identificador conocido en 2026 |
| --- | --- |
| Sitio | `https://mesa-de-poesia.pages.dev/` |
| Proyecto Pages | `mesa-de-poesia` |
| Nombre Wrangler | `escandidor` |
| Base D1 | `escandidor-db` |
| Binding | `escandidor_db` |
| OAuth callback | `https://mesa-de-poesia.pages.dev/api/auth/discord/callback` |
| Webhook Ko-fi | `https://mesa-de-poesia.pages.dev/api/webhooks/kofi` |

El `database_id` publico esta en `wrangler.jsonc`. Credenciales y copias de seguridad deben vivir en Cloudflare o en un gestor de secretos, nunca en Git.

## Desarrollo local

```powershell
npm ci
npm test
npm run dev
```

Wrangler crea estado local bajo `.wrangler/`, ignorado por Git. La prueba de integracion prepara una D1 temporal a partir de `schema.sql`.

## Base de datos

Para una base vacia usa el esquema completo:

```powershell
npx wrangler d1 execute escandidor-db --local --file=./schema.sql
```

Para una base existente aplica solo migraciones pendientes, en orden numerico:

```powershell
npx wrangler d1 migrations list escandidor-db --remote
npx wrangler d1 migrations apply escandidor-db --remote
```

Las migraciones comienzan en `0002`; `schema.sql` representa el resultado acumulado hasta `0016`. La ausencia de `0001` es historica. No renumeres ni reescribas migraciones aplicadas. Las migraciones antiguas se ejecutaron directamente y no todas están registradas: revisar el esquema real antes de aplicar la lista completa.

Antes de cambios remotos, exporta D1 con el comando vigente de Wrangler y guarda la copia fuera del repositorio. Comprueba despues `users`, `poems`, `poem_versions`, `deleted_poems`, `supporters` y `kofi_payments`.

## Despliegue

```powershell
npm test
npm run check
npm run deploy
```

Despues verifica la pagina principal, `/api/auth/me`, inicio y cierre de sesion, guardado/sincronizacion/borrado, paginas secundarias y denegacion de rutas administrativas a usuarios normales.

Cloudflare debe publicar la raiz y usar Pages Functions. Un hosting estatico puro perderia autenticacion, sincronizacion, administracion y webhooks.

## Secretos e integraciones

Secretos esperados:

- `DISCORD_CLIENT_ID`
- `DISCORD_CLIENT_SECRET`
- `KOFI_VERIFICATION_TOKEN`
- `KOFI_HISTORICAL_SUPPORTER_COUNT` (opcional)

Ejemplo historico de configuracion:

```powershell
npx wrangler pages secret put DISCORD_CLIENT_ID --project-name mesa-de-poesia
npx wrangler pages secret put DISCORD_CLIENT_SECRET --project-name mesa-de-poesia
npx wrangler pages secret put KOFI_VERIFICATION_TOKEN --project-name mesa-de-poesia
```

Discord debe autorizar exactamente el callback del inventario. Ko-fi envia un webhook por pago; los reintentos se deduplican por transaccion. El contador historico suma apoyos anteriores al webhook y no debe incluir eventos ya registrados.

## Administracion inicial

Las cuentas nuevas siempre tienen rol `user`. Si no queda ningun administrador:

```powershell
npx wrangler d1 execute escandidor-db --remote --command="UPDATE users SET role = 'admin' WHERE email = 'correo@example.com'"
```

Verifica el correo y la cuenta de Cloudflare antes de ejecutar el comando.

## API operativa

| Area | Rutas |
| --- | --- |
| Autenticacion | `/api/auth/register`, `/login`, `/logout`, `/me`, `/account`, `/discord/*`, `/sessions/others` |
| Estado | `GET /api/state` |
| Poemas | `/api/poems`, `/api/poems/:id`, `/api/trash` |
| Supporters | `/api/supporters`, `/api/supporters/acknowledgements`, `/api/webhooks/kofi` |
| Administracion | `/api/admin/stats`, `/users/*`, `/poems/*`, `/supporters/*` |

Los archivos de `functions/api/` son la fuente de verdad para metodos y cuerpos exactos.

## Recuperacion tras anos de inactividad

1. Recupera acceso a GitHub, Cloudflare, Discord Developer Portal, Ko-fi y al dominio personalizado si existe.
2. Rota secretos desconocidos; no intentes reconstruirlos desde Git.
3. Comprueba facturacion, limites, deprecaciones y estado de D1.
4. Exporta D1 antes de actualizar dependencias o compatibilidad.
5. Prueba primero con las versiones fijadas por `package-lock.json` y actualiza por etapas.
6. Despliega una vista previa de Pages y prueba autenticacion, D1 y webhook.
7. Documenta nuevos nombres, IDs, propietarios y decisiones aqui.

## Limpieza de versiones vacías (2026-10-13)

Se aplicó `migrations/0012_remove_empty_poem_versions.sql` directamente a `escandidor-db`, tras exportar y verificar una copia completa fuera del repositorio. Se eliminaron 236 versiones vacías, 8 poemas sin contenido y 4 versiones vacías de la papelera. Se conservaron las 1.252 versiones con texto, sus IDs y su numeración; se conservaron marcadores de eliminación para impedir que las copias antiguas recrearan poemas vacíos.

La copia previa está en `%TEMP%/escandidor-db-backups/escandidor-db-before-empty-cleanup-20261013-141519.sql`. No debe publicarse con el sitio. La exportación requirió Node 22 y Wrangler 4.150.0 temporales porque Wrangler 4.86.0 no obtenía la URL de descarga. Las dependencias del proyecto no se actualizaron.

La migración también instala cinco protecciones de base de datos contra títulos vacíos o «Sin título», contenido vacío y versiones consecutivas con el mismo texto. Es idempotente. Como se ejecutó con `d1 execute`, no se registró automáticamente en `d1_migrations`: revisar esta nota al aplicar migraciones pendientes.

Auditoría: `scripts/audit-empty-poem-versions.sql`. Verificación local de la limpieza y las protecciones: `python scripts/verify-empty-cleanup.py`. Las validaciones del editor y los mensajes de la API requieren publicar el código actualizado; las protecciones de D1 ya están activas.


## Publicar la política de papelera

La migración `0013_user_trash_settings.sql` crea la preferencia de limpieza por cuenta. Se aplicó a producción el 2026-10-13 para reparar los errores 500 de `GET /api/trash` y `DELETE /api/poems/:id?version=...`: el código publicado consultaba `user_trash_settings`, pero la tabla no existía. Se verificó la cuenta y se exportó una copia completa antes de crear la tabla. Los totales antes y después permanecieron en 36 poemas, 1.252 versiones y 64 entradas de papelera; la versión 376 del poema 64 sigue presente.

La copia previa está en `%TEMP%/escandidor-db-backups/escandidor-db-before-trash-settings-20261013-152740.sql` (831.970 bytes), fuera del repositorio. La operación utilizó Node 22 y Wrangler 4.150.0 temporales; Wrangler 4.86.0 rechazó la consulta remota con el código 7403. Como se ejecutó con `d1 execute`, no se registró automáticamente en `d1_migrations`; la migración es idempotente.

Para instalaciones que todavía no tengan la tabla, aplicar esta migración antes de publicar el código:

```powershell
npx wrangler d1 execute escandidor-db --remote --file=./migrations/0013_user_trash_settings.sql
npm run deploy
npm run deploy:trash-cleanup
```

El último comando publica `escandidor-trash-cleanup` con la configuración `wrangler.trash-cleanup.jsonc`, conectado a la misma D1 que Pages. Se ejecuta una vez por hora y aplica las preferencias de cada usuario; desactivar la caducidad conserva las copias antiguas mientras respeten el límite de espacio y cantidad. El empaquetado se ha verificado con `wrangler deploy --dry-run`, sin publicar el Worker.

Comprobar `GET /api/trash` (campo `policy`) y `PATCH /api/trash` (`{autoCleanup: true|false}`), la persistencia entre dispositivos y el historial de ejecuciones programadas del Worker. No borrar los marcadores `deleted_poems` cuyo `poem_id` no sea nulo al liberar las copias recuperables.

## Publicación del Taller (2026-10-14)

Se aplicaron únicamente `0014_contest_plicas.sql`, `0015_user_plica_profiles.sql` y `0016_workshop.sql` a `escandidor-db` y se registraron en `d1_migrations`. Antes y después permanecieron los 7 usuarios, 40 poemas y 1.725 versiones existentes. Las nuevas tablas de concursos y perfiles comenzaron vacías. No se importaron datos locales ni ejemplos del prototipo.

La copia previa está en `%TEMP%/escandidor-db-backups/escandidor-db-before-workshop-20261014-160604.sql` (1.173.615 bytes), con SHA-256 `C8406C7B387C2B98342C44E8B44CF0D1C9270311DFECF60F44CA439103AD1135`. Se configuró `PLICA_ENCRYPTION_KEY` como secreto de producción de Pages, generado aleatoriamente, sin guardarlo en el repositorio. No rotar esa clave sin convertir antes los perfiles cifrados.

Pages compila con `npm run build`, Node 22 y salida `.wrangler/pages-release`. El empaquetado incluye solo los archivos públicos, fuentes y assets; excluye bases locales, claves, prototipo, pruebas y herramientas. Las Functions se compilan desde `functions/`. El importador de producción lee páginas y PDF mediante `unpdf`, con los mismos límites de tamaño y páginas y sin OCR. El login del Taller conserva el acceso con Discord.

`node scripts/verify-production.mjs` prueba la portada, acceso, guardado de poema, concursos, etiquetas, preferencias, conflictos de revisión, plica cifrada e importación. Crea una cuenta desechable y la elimina al terminar. El informe queda en `qa/production/`, fuera de Git y del paquete público.

## Dominio propio (2026-11-22)

El dominio p?blico y las URL can?nicas son `https://poesia.mimesa.dev`. Pages conserva el proyecto `mesa-de-poesia` y la misma D1. DNS CNAME `poesia` apunta a `mesa-de-poesia.pages.dev`; certificado y dominio activos. Callback nuevo: `https://poesia.mimesa.dev/api/auth/discord/callback`; conservar el anterior en Discord y el webhook Ko-fi existente. No se redirige autom?ticamente el editor anterior para conservar acceso a borradores guardados solo en ese navegador/origen. Iniciar sesi?n en el dominio nuevo permite recuperar los poemas sincronizados.

Se publicaron canonical, metadatos, datos estructurados, robots y sitemap con el dominio propio. Copia D1 previa fuera del repositorio: `%TEMP%/mesa-domain-backups/poesia-before-domain-20261122-143935.sql`.

Search Console: `sc-domain:mimesa.dev` verificado por DNS mediante Domain Connect. El 22/11/2026 ambos sitemaps aparecen Correcto (Poes?a: 5 URLs, Rol: 1). Solicitudes de portada Poes?a y `/escandidor` aceptadas, sin error de cuota; estado inicial Descubierta: actualmente sin indexar. La aceptaci?n no confirma indexaci?n. Seguimiento semanal vigente.

Tambi?n se acept? la solicitud de indexaci?n de la portada Rol el 22/11. Pr?xima revisi?n programada: 26/11/2026 17:40 Uruguay. Los tres pedidos se aceptaron sin cuota superada; no se confirm? indexaci?n efectiva.

## SEO publicado con autorizacion (2026-11-22)

Deployment Pages `8c691455.mesa-de-poesia.pages.dev`: nuevas guias `/componer-versos` y `/separar-en-silabas-metricas`, titulos y descripciones de portada/taller, imagen `assets/social-preview.png` 1200x630, enlaces internos y sitemap de 7 URLs. Verificados en dominio publico. API auth/me responde correctamente. Pruebas previas: 188 aprobadas, check y build correctos. Copia D1 previa: `%TEMP%/mesa-domain-backups/poesia-before-seo-20261122-184602.sql`. No se aplicaron migraciones.

Sitemap reenviado a Google tras publicar; recepcion confirmada. Rol volvio a solicitarse tras su cambio SEO y Google acepto la solicitud; sigue sin confirmar indexacion. Baseline de busquedas reales, Montevideo, no personalizadas: `qa/seo/google-ranking-2026-11-22.json` (fuera de Git y del paquete publico). La primera posicion de Escandidor se observo solo al mantener la consulta original con nfpr=1: Google corrige automaticamente otras variantes. No equivale a primera posicion universal.

## Reparacion de canonical y sitemap (2026-11-24)

El push automatico de main41d02f5 del23/11 restauro en produccion referencias SEO a mesa-de-poesia.pages.dev. Se repararon sobre una exportacion limpia del mismo commit, conservando las guias publicas existentes. Deployment activo de la reparacion: https://7738c98f.mesa-de-poesia.pages.dev. Canonical de portada/OG/robots y sitemap usan poesia.mimesa.dev; XML publico verificado HTTP200 y7URLs. El taller conserva canonical /escandidor.194pruebas, check y build pasaron. Copia D1: %TEMP%/mesa-domain-backups/poesia-before-canonical-repair-20261124-150129.sql. Sin migraciones ni cambios de datos.

IMPORTANTE PARA PROXIMOS DESPLIEGUES: la reparacion se publico desde %TEMP%/mesa-poesia-canonical-fix-20261124-150102 para preservar el trabajo local pendiente de CMS editorial y otras funciones. No se publico ese trabajo. Los cambios de dominio del checkout siguen sin commit: al hacer el proximo push deben conservarse canonical/robots/sitemap del dominio propio para no repetir la regresion. Las dos guias estaban servidas en el despliegue anterior aunque no ambas estaban en Git; tenerlo en cuenta al limpiar el paquete. No revertir decisiones nuevas de contenido por asumir que el baseline SEO del22/11 sigue siendo el codigo actual.

Search Console24/11: portada Poesia, /escandidor y guia metrica indexadas; /componer-versos no reconocida; Rol rastreada sin indexar. Sitemaps Correcto (Poesia informe5URLs aun, Rol233). Se reenviaron solo las correcciones del sitemap de Poesia y Google confirmo recepcion. No se repitio la solicitud aceptada de Rol ni se envio reporte a soporte. Informe qa/seo/indexation-2026-11-24.json fuera de Git.

## Publicación completa SEO, poemas escandidos, motor métrico y CMS editorial (2026-11-28)

Se aplicó únicamente `migrations/0022_editorial_pages.sql` a `escandidor-db` y se registró en `d1_migrations`, tras exportar y verificar una copia completa fuera del repositorio en `%TEMP%/mesa-domain-backups/poesia-before-full-deploy-20261128-032931.sql` (4.051.315 bytes, SHA-256 `77BDADF549D7E8E580B3332992AEE159203692FC4B8D11B6F799460FAB2C5D91`). Los totales antes y después permanecieron intactos: 8 usuarios, 161 poemas, 1.805 versiones, 127 entradas de papelera, 0 supporters y 0 pagos Ko-fi.

Deployment Pages activo: `https://2fa48fda.mesa-de-poesia.pages.dev` (publicado en `main` para `https://poesia.mimesa.dev`, reemplaza `3ba3def2` tras auditoría de dominio público). Incluye:
- Redirección `301` de `/escandidor` → `/taller/` (preservando `/escandidor?taller=1` con `X-Robots-Tag: noindex, nofollow` para iframes) y `X-Robots-Tag: noindex, follow` en `*.mesa-de-poesia.pages.dev`.
- Landings renovadas `/separar-en-silabas` (con sinéresis poética condicional) y `/separar-en-silabas-metricas` (Escandidor interactivo en vivo + traspaso a `/taller/`).
- Catálogo `/metrica/` y 154 poemas clásicos de dominio público verificados verso a verso y publicados antes de 1931 (27 de Uruguay, 92 de Latinoamérica en total, 62 de España, incluyendo *Canción del pirata*; excluidos 2 poemas póstumos del *Cancionero* 1953 de Unamuno y 2 de *Mundo de siete pozos* 1935 de Storni).
- Mejoras del motor métrico: preposiciones átonas, endecasílabo sáfico (`4-8-10`) junto con `6-10` sobre acentos métricos reales y corrección de ruptura automática de sinalefas sobre acento versal.
- CMS editorial (`/recursos` y rutas administrativas protegidas con 401/403).

Verificación previa: `npm run check`, `npm run build` y `npm test` (202/202 aprobados). Verificación posterior en `https://poesia.mimesa.dev`: HTTP 200 en portada, `/taller/`, `/separar-en-silabas`, `/separar-en-silabas-metricas`, `/metrica/`, poemas individuales, `/recursos`, `robots.txt` y `sitemap.xml`; HTTP 301 en `/escandidor`; HTTP 200 en `/api/auth/me` y HTTP 401 en `/api/admin/stats` y `/api/admin/pages`.

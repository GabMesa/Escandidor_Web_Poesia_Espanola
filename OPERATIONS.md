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

Las migraciones comienzan en `0002`; `schema.sql` representa el resultado acumulado hasta `0013`. La ausencia de `0001` es historica. No renumeres ni reescribas migraciones aplicadas.

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

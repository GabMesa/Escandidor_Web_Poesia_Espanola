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

Las migraciones comienzan en `0002`; `schema.sql` representa el resultado acumulado hasta `0011`. La ausencia de `0001` es historica. No renumeres ni reescribas migraciones aplicadas.

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
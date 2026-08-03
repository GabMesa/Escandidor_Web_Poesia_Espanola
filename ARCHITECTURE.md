# Application architecture

## Runtime and deployment

Cloudflare Pages serves the repository root because `wrangler.jsonc` sets `pages_build_output_dir` to `.`. Pages Functions map files below `functions/api/` to `/api/*`, and the `escandidor_db` binding provides D1. There is no compilation or bundling step.

Root filenames and asset paths are therefore deployed contracts. Moving frontend files into `src/` or `public/` requires a deliberate build/output migration, not a cosmetic repository move. `app.js` is the composition root and still owns much UI behavior; extract cohesive modules without creating another mutable state owner.

## Frontend state

`application-state.js` is the single owner of mutable application state. Its branches have explicit responsibilities:

- `editor`: current poem, analysis options, lookup state, and view preferences.
- `library`: poems and trash currently available to the user.
- `auth`: current identity and authentication UI mode.
- `sync`: cloud owner and serialized synchronization queue.
- `runtime`: transient analysis results, selections, and timers.

DOM nodes, immutable lookup indexes, and service clients are dependencies, not application state. New mutable values must be added to `applicationState` rather than introduced as module globals.

## API boundaries

The intended public API is grouped by responsibility:

1. `/api/auth/*`: register, login, logout, OAuth callbacks, and session management.
2. `GET /api/state`: load the authenticated user's complete, versioned application state in one request.
3. `PUT /api/state`: future atomic state synchronization endpoint. Add this after clients send stable poem IDs and revision tokens; do not implement destructive full-state replacement without conflict detection.
4. `/api/admin/*`: administration queries and commands. These endpoints never become application-state persistence APIs.
5. `/api/billing/*`: future checkout, provider webhooks, invoices, and subscription management.

Supporter operations currently live under `/api/supporters`, `/api/admin/supporters`, and `/api/webhooks/kofi`. Ko-fi payment rows are an audit ledger; acknowledgements are an explicit supporter preference and must not expose private payment identity.

The existing `/api/poems` and `/api/trash` routes remain compatibility and feature-service endpoints while clients migrate to the state façade. The state API composes those domain models; it does not replace normalized storage with an opaque JSON document.

## Database ownership

- Identity: `users`, `sessions`, and future external identities.
- Creative state: `poems`, `poem_versions`, and `deleted_poems`.
- Catalog and authorization: `services`, `features`, `service_features`, and future user entitlements.
- Billing ledger: supporters unify one-time donors and memberships across providers, while payments remain immutable events. Provider events grant or revoke entitlements; payment rows must not be queried directly to authorize features.

Before payments are added, give services and features stable unique keys, add prices/supporters separately from the catalog, and add dated user entitlements. This preserves the service-feature model while allowing free, paid, promotional, and administrator-granted access to use the same authorization check.

## Synchronization invariants

- A poem has a stable local or server ID; title changes never create identity.
- Manual saves create versions. Autosaves remain local.
- Reconciliation merges unique states and must not interpret absence as deletion.
- Pending writes are scoped to the authenticated user.
- `deleted_poems` stores recoverable records and ID tombstones that prevent stale clients from resurrecting deleted poems.
- The state facade composes normalized records; it is not permission to replace the database with an opaque client snapshot.

## Schema evolution

`schema.sql` bootstraps a new database. `migrations/` is the history for an existing database and must retain applied filenames and order. The checked-in schema includes changes through `0011_auto_link_supporters.sql`.

Never renumber, rewrite, or delete an applied migration. Add a migration and update `schema.sql` to the resulting clean-install state.
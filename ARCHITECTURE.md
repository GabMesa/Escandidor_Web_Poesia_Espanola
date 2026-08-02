# Application architecture

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

The existing `/api/poems` and `/api/trash` routes remain compatibility and feature-service endpoints while clients migrate to the state façade. The state API composes those domain models; it does not replace normalized storage with an opaque JSON document.

## Database ownership

- Identity: `users`, `sessions`, and future external identities.
- Creative state: `poems`, `poem_versions`, and `deleted_poems`.
- Catalog and authorization: `services`, `features`, `service_features`, and future user entitlements.
- Billing ledger: future customers, subscriptions, and payments. Provider events grant or revoke entitlements; payment rows must not be queried directly to authorize features.

Before payments are added, give services and features stable unique keys, add prices/subscriptions separately from the catalog, and add dated user entitlements. This preserves the service-feature model while allowing free, paid, promotional, and administrator-granted access to use the same authorization check.
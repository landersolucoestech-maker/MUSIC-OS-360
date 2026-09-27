# Enterprise RBAC — Permission Enforcement on All Routes

## What & Why
`RolesGuard` and `@RequireRole()` exist but are not applied to any real route. Every endpoint is effectively open to any authenticated user of the tenant, regardless of role. In addition, there is no concept of feature gates (tenant plan), there are no granular permission decorators (beyond roles), and roles are not checked per operation (read vs. write vs. delete). This task depends on #661 (auth chain fix) because `currentMember` needs to be populated on the request.

## Done looks like
- `@RequireRole('editor')` applied to all create/edit endpoints (POST, PATCH, PUT)
- `@RequireRole('manager')` applied to deletion endpoints and critical settings (DELETE, status PATCH)
- `@RequireRole('admin')` applied to the users, billing and global settings endpoints
- `@Public()` explicitly marked on the health and webhook callback endpoints
- Feature gate decorator `@RequireFeature('monitoring')` for premium module routes
- `TenantFeaturesGuard` checks `tenant.features` (array of feature flags in the schema) before processing the request
- A global `PermissionsGuard` registered in `AppModule` via `APP_GUARD`
- Any unauthorized access returns 403 with a clear message (no stack trace)
- `tsc --noEmit` without errors

## Out of scope
- Role management UI (frontend)
- Changing the role hierarchy (viewer/editor/manager/admin/owner already defined)
- Per-resource row-level security (e.g. an artist only sees their own data — future phase)

## Steps
1. **Audit all controllers** — list each endpoint (method + path) and classify it: public, any-authenticated, editor+, manager+, admin+; produce a decision table for reference
2. **Apply @RequireRole to the controllers** — go through the controllers one by one (artists, works, phonograms, contracts, transactions, releases, shares, clients, leads, campaigns, events, hr, inventory, licensing, monitoring, uploads, billing, integrations, users); apply the correct decorator per endpoint
3. **Feature gate decorator + guard** — create `core/decorators/require-feature.decorator.ts` with `@RequireFeature(...features)`; create `TenantFeaturesGuard`, which reads `request.tenant.features` and rejects with 403 if the feature is not enabled for the plan; apply it to the monitoring, licensing and advanced analytics routes
4. **Register the guards globally** — register `RolesGuard` and `TenantFeaturesGuard` via `APP_GUARD` in `AppModule` (executed after `ClerkAuthGuard` and `TenantGuard`); ensure the correct order in the chain
5. **Permission tests** — create a spec for `RolesGuard` covering: viewer on an editor+ route (403), admin on any route (200), public without a token (200), feature not enabled (403)

## Relevant files
- `apps/api/src/core/guards/roles.guard.ts`
- `apps/api/src/core/decorators/roles.decorator.ts`
- `apps/api/src/core/decorators/public.decorator.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/artists/artists.controller.ts`
- `apps/api/src/modules/contracts/contracts.controller.ts`
- `apps/api/src/modules/users/users.controller.ts`
- `apps/api/src/modules/billing/billing.controller.ts`

## Depends on
- Task #661 (auth chain fix — currentMember needs to be populated)

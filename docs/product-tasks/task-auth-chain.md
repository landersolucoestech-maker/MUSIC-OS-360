# Auth Chain Fix — TenantGuard + Clerk Token

## What & Why
The TenantGuard populates `request.tenant` and `request.currentMember` but **never assigns `request.tenantId` or `request.userId`**. All controllers read `req.tenantId` and `req.userId`, which arrive as `undefined`, silencing every multi-tenant operation (Drizzle queries receive `undefined` as a filter, with no runtime error). In parallel, the frontend `api-client.ts` implements a `tryRefresh()` that calls `POST /auth/refresh` — an endpoint that does not exist in a valid form with Clerk. An expired session produces cascading 401s instead of silently renewing the token.

## Done looks like
- Every authenticated request has `req.tenantId` (UUID string) and `req.userId` (Clerk string) correctly populated by `TenantGuard`
- `express.d.ts` typing the extended Request eliminates every `req: any` from the controllers
- Refactored controllers use `req.tenantId` and `req.userId` with strong typing (no `any`)
- `tryRefresh()` removed from the frontend; a 401 triggers Clerk's `getToken({ skipCache: true })` via `useAuth()` and resends
- The session persists indefinitely with no forced logout after the JWT expires

## Out of scope
- Implementing new modules or endpoints
- Changing the RBAC permission logic (roles/features)
- Rate-limiting middleware (separate task)

## Steps
1. **Fix TenantGuard** — after validating the tenant and member, assign `request.tenantId = tenant.id` and `request.userId = auth.userId` with the correct types; remove the `unknown` casts on `request.tenant` and `request.currentMember`
2. **Create `express.d.ts`** — extend `Express.Request` with `tenantId: string`, `userId: string`, `tenant: Tenant`, `currentMember: OrgMember`, importing types from the Drizzle schema; register it in the api `tsconfig`
3. **Remove `req: any` from the controllers** — replace `@Request() req: any` with `@Req() req: Request` with the import from `express.d.ts`; start with the 6 controllers that use tenantId the most (integrations, artists, works, phonograms, contracts, transactions)
4. **Frontend — replace `tryRefresh`** — create a `useApiClient()` hook that uses Clerk's `getToken({ skipCache: true })` in the 401 interceptor; remove `tryRefresh` and the dependency on an httpOnly cookie; guarantee a single retry with no loop
5. **Validate tsc 0 errors** — run `cd apps/api && npx tsc --noEmit` and `cd client && npx tsc --noEmit`

## Relevant files
- `apps/api/src/core/guards/tenant.guard.ts`
- `apps/api/src/modules/integrations/integrations.controller.ts`
- `apps/api/src/modules/artists/artists.controller.ts`
- `apps/api/src/modules/works/works.controller.ts`
- `apps/api/src/modules/phonograms/phonograms.controller.ts`
- `apps/api/src/modules/contracts/contracts.controller.ts`
- `apps/api/src/modules/transactions/transactions.controller.ts`
- `client/src/shared/lib/api-client.ts:111-155`

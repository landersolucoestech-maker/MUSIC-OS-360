# MUSIC OS 360 — Security Architecture

> **Currency note (2026-09-15):** this document predated a significant amount
> of work already completed (see §8) and must not be treated as a current
> source without cross-checking against the code. `docs/CODEBASE_MAP.md` is the
> most recent verified source on the real security/tenancy state of this
> repository.
>
> **Outdated parts identified while translating (2026-09-30, verified against
> `apps/api/src/app.module.ts` and `apps/api/src/core/guards/`):** the guard
> chain in §3 is incomplete (the real global chain also includes
> `MustChangePasswordGuard` and `BillingEnforcementGuard`, and `PermissionsGuard`
> exists). The role hierarchy and the per-module permission tables (§2, §5, §6)
> were not re-verified and may not match `core/rbac/role-hierarchy.ts` and the
> RBAC seed; treat them as historical until cross-checked. The §7 checklist
> reflects the state at the time of writing and was not re-run.

## Overview

MUSIC OS 360 uses Supabase authentication + hierarchical RBAC + database RLS to guarantee complete multi-tenant isolation.

---

## 1. JWT Authentication Flow

```
Browser → Supabase Auth → JWT (ES256, JWKS)
         ↓
         Bearer token in the Authorization header
         ↓
NestJS JwtAuthGuard → Supabase JWKS endpoint
         ↓
         Verifies the ES256 signature
         ↓
         Extracts: sub (userId), app_metadata.org_id, app_metadata.role
         ↓
TenantGuard → validates org_id against the tenants table
         ↓
         req.auth = { userId, sessionId, orgId, orgRole }
         req.tenant = TenantEntity
         req.currentMember = OrgMemberEntity
         ↓
RolesGuard → compares currentMember.role with @RequireRole()
```

### Supabase JWT claims

| Claim | Value | Use |
|-------|-------|-----|
| `sub` | User UUID | `req.auth.userId` |
| `session_id` | Session UUID | `req.auth.sessionId` |
| `app_metadata.org_id` | Organization UUID | lookup in `tenants.org_id` |
| `app_metadata.role` | RBAC role | e.g. `admin`, `editor` |
| `email` | User email | logging/audit |

### JWKS Endpoint

```
https://<SUPABASE_PROJECT_ID>.supabase.co/auth/v1/.well-known/jwks.json
```

`JwtAuthGuard` uses `jwks-rsa` with a 1-hour cache to fetch public keys.

---

## 2. Role Hierarchy (RBAC)

```
super_admin (6) > owner (5) > admin (4) > manager (3) > editor (2) > viewer (1)
```

| Role | Level | Access |
|------|-------|--------|
| `viewer` | 1 | General read |
| `editor` | 2 | Create and edit records |
| `manager` | 3 | Manage team, approve, delete records |
| `admin` | 4 | User management, sensitive settings |
| `owner` | 5 | Billing, organization configuration |
| `super_admin` | 6 | Full access (platform) |

### Decorators

```ts
@RequireRole('editor')          // method-level
@Roles('admin')                 // class-level alias
@RequireRole('manager', 'admin') // OR logic: minimum of the array
```

---

## 3. Guard Chain (Global, APP_GUARD)

All guards are registered globally in `app.module.ts`:

```
Request → RateLimitGuard → JwtAuthGuard → TenantGuard → RolesGuard → Controller
```

| Guard | Role |
|-------|--------|
| `RateLimitGuard` | Prevents abuse (100 req/min/IP by default) |
| `JwtAuthGuard` | Verifies the JWKS signature, rejects expired/invalid tokens |
| `TenantGuard` | Validates `org_id` → lookup in `tenants` + `org_members` |
| `RolesGuard` | Compares `currentMember.role` with `@RequireRole()` |

Public routes (e.g. Stripe webhook, health check) use `@Public()` to bypass.

---

## 4. Multi-Tenant Isolation

### Backend (NestJS)

All domain queries receive `tenant.id` via `@CurrentTenant()`:

```ts
@Get()
@RequireRole('viewer')
list(@CurrentTenant() tenant: { id: string }) {
  return this.service.list(tenant.id, query); // always filtered by tenant_id
}
```

No repository returns data without a `tenant_id` filter. Verified in:
- `ArtistsService`, `WorksService`, `PhonogramsService`, `ContractsService`
- `TransactionsService`, `UsersService`, `HrService`, `AuditLogService`
- All other domain modules

### TenantGuard: Tenant Lookup

```ts
// Primary: app_metadata.org_id → tenants.org_id (direct UUID)
// Fallback: external_auth_org_id (backward compatibility for old tenants)
WHERE (t.org_id::text = :orgId OR t.external_auth_org_id = :orgId)
  AND t.deleted_at IS NULL
```

---

## 5. Supabase RLS (Row-Level Security)

Script: `apps/api/supabase-rls.sql`

### Helper Functions

```sql
auth_org_id()   → org UUID from the JWT
auth_org_role() → user role from the JWT
has_min_role(required) → boolean
```

### Policy per table

| Table | SELECT | INSERT | UPDATE | DELETE |
|--------|--------|--------|--------|--------|
| `organizations` | own org | super_admin | super_admin | super_admin |
| `tenants` | org match | admin+ | admin+ | admin+ |
| `org_members` | org match | admin+ | admin+ | owner+ |
| `artists` | tenant | editor+ | editor+ | manager+ |
| `works` | tenant | editor+ | editor+ | manager+ |
| `phonograms` | tenant | editor+ | editor+ | manager+ |
| `contracts` | tenant | editor+ | editor+ | manager+ |
| `transactions` | tenant | editor+ | editor+ | manager+ |
| `audit_log` | manager+ | any member | — | — |
| `notifications` | own | manager+ | — | — |

---

## 6. RBAC per Module/Route

| Module | Read | Write | Delete | Notes |
|--------|---------|---------|--------|-------|
| Artists | viewer+ | editor+ | manager+ | |
| Works/Phonograms | viewer+ | editor+ | manager+ | |
| Contracts | viewer+ | editor+ | manager+ | |
| Transactions (Accounting) | viewer+ | editor+ | manager+ | |
| HR (employees) | viewer+ | manager+ | admin+ | sensitive data |
| HR (payroll) | manager+ | manager+ | admin+ | highly sensitive |
| ECAD Reports | manager+ | manager+ | admin+ | regulatory financial data |
| Audit Log | manager+ | — | — | read-only |
| Users | manager+ | owner+ | owner+ | |
| Billing | admin+ (view) | owner+ | owner+ | |
| Notifications | viewer (own) | manager+ | — | |
| AI Gateway | editor+ | editor+ | — | |
| Integrations | editor+ | admin+ | admin+ | |

---

## 7. Validation Checklist

### Authentication

- [x] Email/password login via Supabase
- [x] Session persists in localStorage (`musicos360_auth`)
- [x] `onAuthStateChange` syncs the session between tabs
- [x] Automatic refresh token by the Supabase SDK
- [x] Logout clears the local session and revokes it in Supabase
- [x] Hard refresh keeps the session (via `getSession()` on mount)
- [x] Expired JWT → `JwtAuthGuard` returns 401 `"Token expirado"`
- [x] Invalid/tampered JWT → 401 `"Token inválido"`
- [x] JWT without `kid` → 401 (no JWKS key to verify against)

### Multi-Tenant

- [x] `org_id` missing from the JWT → `TenantGuard` rejects with 401
- [x] `org_id` with no matching tenant → 401
- [x] Inactive tenant (`active = false`) → 401
- [x] User not a member of the tenant → 403
- [x] Cross-tenant data access impossible (queries always `WHERE tenant_id = ?`)
- [x] Supabase RLS as the second line of defense

### RBAC

- [x] Route without `@RequireRole()` → open to any authenticated member of the tenant
- [x] Insufficient role → 403 with a descriptive message
- [x] Passthrough mode (no DB) → allows everything (local dev)
- [x] `super_admin` bypasses all role restrictions
- [x] `@Roles()` and `@RequireRole()` are functionally equivalent

### Additional Security

- [x] Global rate limiting (RateLimitGuard)
- [x] Audit log on all critical mutations (`@Audit()`)
- [x] CORS restricted to configured origins
- [x] Stripe webhook verified by HMAC
- [x] PII encrypted with AES-256 (email, phone, CPF/CNPJ)

---

## 8. Open Items / Next Steps

| Item | Priority | Description |
|------|-----------|-----------|
| Run `supabase-rls.sql` | High | Apply RLS on the Supabase project |
| Populate `app_metadata.org_id` | High | Set org_id in Supabase Dashboard → Authentication → Users or via trigger |
| Rename `auth_user_id` → `supabase_user_id` | Medium | Schema migration (waits for the production DB) |
| Rename `external_auth_org_id` → `ext_org_id` | Medium | Same: schema migration |
| ~~Tenant isolation E2E tests~~ | — | **Done.** `apps/api/test/e2e/rls/rls-isolation.e2e-spec.ts` already covers exactly this: cross-tenant INSERT/UPDATE/DELETE blocked (Postgres `42501`, `WITH CHECK`) against a real Postgres database, tenant A × tenant B, across dozens of tables. Verified on 2026-09-15 during the Cartographer handoff (`docs/CODEBASE_MAP.md`). |
| RBAC denial test | High | Verify that `viewer` cannot `POST /contracts` |
| JWT expiry | High | Test behavior when the token expires mid-session |
| `super_admin` portal | Low | Organization management interface |

---

## 9. Required Environment Variables

### Frontend (VITE_*)

```env
VITE_SUPABASE_URL=https://<project-id>.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
VITE_USE_MOCK=false
VITE_MOCK_MODE=false
```

### Backend

```env
SUPABASE_URL=https://<project-id>.supabase.co
DATABASE_URL=postgresql://...
ENCRYPTION_KEY=<64-char hex>
```

---

## 10. Key Files

```
apps/api/src/core/guards/
  auth.guard.ts   → JwtAuthGuard (JWKS + ES256)
  tenant.guard.ts       → TenantGuard (org_id isolation)
  roles.guard.ts        → RolesGuard (RBAC hierarchy)

apps/api/src/core/decorators/
  roles.decorator.ts    → @RequireRole() + @Roles() aliases
  current-user.ts       → @CurrentUser() param decorator
  current-tenant.ts     → @CurrentTenant() param decorator
  public.decorator.ts   → @Public() bypass marker

apps/api/src/core/rbac/
  rbac.service.ts       → Permission matrix (can/assertCan)

apps/api/supabase-rls.sql → RLS policies to apply on Supabase
```

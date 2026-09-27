# Module: auth (Authentication / Session / Tenant / RBAC)

Phase 2 of Prompt 100. Scope: `apps/web/src/app/providers/AuthContext.tsx` (central hub),
`apps/web/src/modules/auth/**` (6 pages), `apps/web/src/lib/supabase.ts`,
`apps/web/src/shared/lib/api-client.ts`, `apps/web/src/shared/lib/ws-client.ts`+`useWebSocket.ts`,
all of `apps/api/src/modules/auth/**`, `apps/api/src/core/guards/{auth,tenant}.guard.ts`,
`apps/api/src/core/interceptors/request-tenant-context.interceptor.ts`,
`apps/api/src/core/rbac/**` (enumeration, not a complete re-audit of RBAC as a system — out of
scope, but its boundaries with auth were verified). Closes the open item recorded in
`artist.md` (`ArtistaSignupPublic.tsx`).

Read-only. `DATABASE_WRITES: 0`. No `.ts`/`.tsx` changed. `SUPABASE_CHANGED: NÃO` (no).

## 1. Critical finding: `ArtistaSignupPublic.tsx` calls an endpoint that does not exist

Closes the open item from `artist.md`. `ArtistaSignupPublic.tsx` (public route `/cadastro/:orgSlug`,
no authentication) — a 393-line flow, multi-step wizard, explicit comment in the code:
*"Cadastro público cria DIRETAMENTE um artista (sem Lead/CRM/status intermediário)"* (public sign-up creates an artist DIRECTLY — no Lead/CRM/intermediate status) — at the
end it sends:

```ts
publicApi.post("/public/artists", { workspaceSlug: orgSlug, ...artistaPayload, acceptedTerms, companyWebsite })
```

**Confirmed by an exhaustive search across all of `apps/api/src`** (grep for `Controller('public`,
`Post('artists'`, `'public/artists'`): **there is no `POST /public/artists` route anywhere
in the backend.** The only public artist-related endpoint is
`POST /public/artist-registration` (`PublicRegistrationController`,
`modules/leads/public-registration.controller.ts`), which creates a **Lead** (via `LeadsService`), not
an artist — an entirely different data model and controller. `GET /public/workspaces/
:slug` (used in the same component to resolve the workspace by slug, line 194) **exists and
works** — confirmed in the same controller.

Actual result: **every submission of this form returns an error** (nonexistent route → 404), caught
by the component's generic `catch`, which only shows "Erro ao enviar cadastro. Tente novamente." (error submitting sign-up, please try again)
— no artist is created, no data is persisted, under any circumstance. Confirmed by
reading the source code on both sides directly, not by inference.

Additional finding (even if the endpoint existed): the field names sent in the payload
diverge both from `CreateArtistDto` (audited in `artist.md`) and from the real columns of
`artists` — `spotify_artist_url`/`youtube_channel_url` (vs. the real `spotify_url`/`youtube_url`) and
`instagram`/`tiktok` (vs. the real `instagram_url`/`tiktok_url`, the same pair that
`artists.service.ts` already had to fix once in the authenticated flow — see `artist.md` §4). This
suggests that this component was written against a planned API contract that was never synchronized
with the real implementation, not merely "forgotten to implement".

**Classification: `PUBLIC_SIGNUP_GAP` — maximum severity, confirmed, not fixed in this step.**

## 2. `AuthContext.tsx` — real hub, well implemented

Read in full (370 lines). Authentication 100% via Supabase Auth (the SDK manages tokens/refresh/
persistence) — no "mock mode" (the file's own comment confirms). Findings:

- **Session resolution**: `sb.auth.getSession()` at boot + `onAuthStateChange` as the single source of
  truth for session changes (login, logout, refresh, recovery).
- **JWT claims decoded only for DEV logging** (`decodeJwtClaims`/`logJwtClaims`, gated by
  `IS_DEV`) — never used for real authorization in the frontend (correct).
- **`org_id`/`role`**: extracted from the JWT's `app_metadata` (trusted claims, signed by
  Supabase — presumably injected by a custom Auth Hook), falling back to
  `user_metadata`. They never come from a user-editable field.
- **Workspace auto-provisioning**: `needsWorkspaceProvisioning()` detects a session without
  `org_id` but with `user_metadata.workspace_slug` (= just signed up) → calls
  `PATCH /auth/provision-workspace` automatically → `refreshSession()` to obtain a JWT with the
  newly created `org_id`. Real mechanism, tested via `activeProvisioning` (deduplicates concurrent
  calls). **No gap.**
- **`AUTH_DISABLED`**: fixed synthetic user (`AUTH_DISABLED_USER`, fixed UUID, role `owner`) —
  gated by `import.meta.env.VITE_AUTH_DISABLED === "true"` (frontend); never calls Supabase Auth
  when active (explicit comment in the code). Mirrors the backend's `DEV_TENANT`/`DEV_MEMBER`
  (`core/auth-disabled.ts`) — same UUID, confirmed consistent on both sides.
- **`changeRequiredPassword`**: calls `POST /auth/change-required-password` (atomic change +
  clearing of `must_change_password` in the same request on the backend), then `refreshSession()` so
  that the new JWT (without the flag) reaches the app. Well documented, no gap.

## 3. Backend — JWT / Guards / Tenant isolation (positive finding: well protected)

`JwtAuthGuard` (`core/guards/auth.guard.ts`, read in detail): real verification via **JWKS**
(`${SUPABASE_URL}/auth/v1/.well-known/jwks.json`, algorithm `ES256`, `issuer`=Supabase project
URL, `audience`='authenticated') in production; an **HS256** fallback with a dev secret and
`issuer: 'music-os-360-dev'` only in the development environment — clearly
separated paths.

`TenantGuard` (`core/guards/tenant.guard.ts`, read in full) — **positive security finding,
confirmed**: the `X-Tenant-ID` header (sent by the frontend's `api-client.ts`) **is never
used as authority**. The real tenant is resolved from `auth.orgId` (a verified JWT
claim), and the header is used **only as a consistency check** — if
`X-Tenant-ID` does not match the `id`/`org_id`/`external_auth_org_id` of the tenant already resolved from the
JWT, the request is rejected (`ForbiddenException`). It also resolves and validates the
**real membership** (`resolveMembership(tenant.id, auth.userId)`) — rejects if the user is not an
active member. `TENANT_ISOLATION_GAP: 0`.

`DevAuthController` — doubly protected: (a) it is only **registered as a route** when
`!isProdLike(NODE_ENV)` (the route physically does not exist in production, it is not just a 403), and (b) it checks
`isProdLike` again in its own `OnModuleInit`. `AUTHORIZATION_GAP: 0` for this point.

`@Public()` and `@AuthBootstrap()` (decorators) — used correctly: `@Public()` on routes
that are truly session-less (`/public/*`, health, some webhooks); `@AuthBootstrap()` only on
`PATCH /auth/provision-workspace` (user authenticated but still without a tenant) — minimal and
correct scope, not misused on any other route in the module.

## 4. `AuthContextService.build()` — `GET /auth/context`, complete resolution

Read in full. Builds `{ user, workspace, membership, claims }` from
`(auth, tenant, member)` already resolved by the `TenantGuard`/interceptor — never trusts data coming
from the client for the security fields. **Real side effect found**: on every call, it
executes an `UPDATE tenant_invitations SET status='accepted' WHERE tenant_id=$1 AND
auth_user_id=$2 AND status='pending'` — auto-acceptance of a pending invitation the first time the
invited user loads the authenticated context. A real, functional mechanism, not documented
before in this audit series — it adds one more real consumer for `tenant_invitations`
(already confirmed `MATCH`/`DIRECT_RAW_SQL` in Phase 1).

Permissions: `RbacService.getEffectivePermissions({role, role_id, tenant_id})` — "DUAL-SOURCE
(FASE 5)" (phase 5): uses database permissions when `role_id` exists (dynamic RBAC), and falls back to the legacy role
matrix (`role-hierarchy.ts`, 14 identifiers: `super_admin`(100), `tenant_owner`/
`owner`(90), `admin`(80), `manager`(70), `editor`/`financial`/`accounting`(60), `juridico`(55),
`marketing_manager`/`rh_manager`(55), `marketing`(50), `comercial`(45), `produtor`/`radio`/`tv`(40),
`artist`/`artista`(30), `colaborador`(20), `viewer`(10)) when it does not. The complete RBAC system itself
was not re-audited (out of scope for this pass — it belongs to its own boundary, but the
integration with `auth` was verified and is coherent).

## 5. Internal user — the `auth.users` / `public.users` / `app.users` distinction

Confirmed, no mixing: `auth.users` (Supabase-managed, never touched directly by application
code beyond the SDK) is the identity/credentials source. `org_members` (not `public.users`) is
the real **membership** table queried by `TenantGuard`/`AuthContextService` (`member.id`,
`member.role`, `member.role_id`, `member.email`, `member.full_name`, `member.is_active`) —
the same table already identified in doc80 (`ENTITY_TABLE_MAP`'s `user: 'org_members'`). `public.users`
(application profile, `UserEntity`, already confirmed `MATCH` in Phase 1) does not appear anywhere in the
auth/tenant-context flow read in this audit — its real use is left to the audit of the
`settings`/user profile module (out of scope here). `app.users` (future v2 namespace) does not exist and
is not referenced — consistent with doc73/doc84.

## 6. Login / Logout / Signup / Reset — field by field

| Flow | Component | Route | Fields | Backend/Supabase |
|---|---|---|---|---|
| Login | `Auth.tsx` | `/auth`, `/login` | email, password | `supabase.auth.signInWithPassword` |
| Forgot password (request) | `Auth.tsx` (same page, another mode) | `/forgot-password` | email | `supabase.auth.resetPasswordForEmail(email, {redirectTo: origin+"/reset-password"})` |
| Update password (after link) | `ResetPassword.tsx` | `/reset-password` | password, confirmPassword | `supabase.auth.updateUser({password})`, depends on the recovery session already active via `onAuthStateChange` |
| Mandatory password change (1st login) | `ChangeRequiredPassword.tsx` | `/change-required-password` | newPassword, confirmPassword | `POST /auth/change-required-password` (real, atomic) |
| Full signup (company) | `Register.tsx` (3-step wizard) | `/register`, `/signup` | email, password, fullName, tradeName, segment (enum: gravadora/editora/produtora/escritorio), corporateEmail, workspaceName, slug (derived), phone, address, city, state, requestedPlan, acceptedTerms, acceptedLgpd | `supabase.auth.signUp()` with `options.data` = all the fields above as `user_metadata`, followed by auto-provisioning (§2) |
| Post-signup onboarding | `Onboarding.tsx` | `/onboarding` (protected) | via `CompleteOnboardingDto` (not expanded field by field — a finalization form, secondary role relative to Register) | `PATCH /auth/onboarding`, `RequireRole('owner')` |
| Public artist sign-up | `ArtistaSignupPublic.tsx` | `/cadastro/:orgSlug` | ~30 fields (same shape as `ArtistaFormModal`, see `artist.md`) | **`POST /public/artists` — NONEXISTENT (§1)** |
| Logout | button in `AdminLayout`/user menu (not a component of its own) | — | — | `supabase.auth.signOut()` + `clearApiSessionState()` + `queryClient.clear()` — **does not call `disconnectRealtimeChannels()`** (see §8) |

All the fields of `Register.tsx` match exactly the parameters that
`provisionWorkspaceForSession()` sends to `PATCH /auth/provision-workspace` — mapping
verified, no gap.

## 7. API client — Authorization / X-Tenant-ID / 401

`api-client.ts`: injects `Authorization: Bearer <token>` and `X-Tenant-ID` from in-memory
variables (`_accessToken`/`_tenantId`, set exclusively by `AuthContext` via
`setAccessToken`/`setTenantId` — never read directly from `localStorage` by the HTTP client; the
session persistence itself is managed by the Supabase SDK, not by the `api-client`). On `401`:
`setAccessToken(null)` + a backoff circuit-breaker (avoids a request storm after an invalid
session). Custom event `musicos360:auth:tokenRefreshed` fired on `TOKEN_REFRESHED` —
consumed by whoever needs to react to a new token (not mapped in detail — no security-critical
consumer depends on it beyond the SDK's own refresh flow).

## 8. Realtime — integration with Auth

`ws-client.ts`: 2 private channels per session (`tenant:${orgId}`, `user:${userId}`), native Supabase
Realtime — authorization via **RLS** (migration `20260801000001_RealtimeBroadcastAuthorization`,
cited in the file's comment), not via its own logic — the Supabase client already forwards the current
session's JWT automatically. `ensureRealtimeChannels()` (called by `useWebSocket()`, the only
consumer confirmed via grep) re-binds the channels when `orgId`/`userId` change (e.g. switching
users without a page reload).

**Confirmed gap**: `AuthContext.signOut()` **does not call `disconnectRealtimeChannels()`**
(verified by reading the full body of `signOut()`) — the previous session's realtime channels are not
explicitly closed on logout. Since `ensureRealtimeChannels()` returns early when
`orgId`/`userId` are `null` (line `if (!orgId || !userId) return;`, before reaching the logic that
would reconnect/disconnect), an already-open channel may remain subscribed after logout until a
full page reload. `REALTIME_AUTH_GAP` — moderate (not a cross-tenant data leak,
since RLS still applies; it is a potentially stale channel without explicit cleanup).

## 9. Site URL / Redirect paths (inventory, not configured)

```text
FLOW: password reset request → REDIRECT_PATH: {window.location.origin}/reset-password
  (computed dynamically — works in any environment with no additional configuration on the
  frontend side; the Redirect URLs allowlist in the Supabase dashboard still needs to contain each
  real origin, a point already recorded as open/unresolved in doc75 of this series — not re-investigated
  here, only referenced).
FLOW: signup / email confirmation → no explicit emailRedirectTo found in signUp() —
  uses Supabase's default behavior (the project's Site URL). Requires future confirmation of which
  Site URL is configured — same open item as doc75.
```

`DEVELOPMENT_REDIRECTS_REQUIRED`: 1 (`/reset-password`, resolved dynamically, already works).
`STAGING_REDIRECTS_REQUIRED`/`PRODUCTION_REDIRECTS_REQUIRED`: `UNRESOLVED` — depends on the real
allowlist in the Supabase Dashboard, beyond the reach of code reading (same conclusion as doc75, not
reopened here).

## 10. SMTP

Flows that depend on transactional email, confirmed from the code: **password reset**
(`resetPasswordForEmail`) and, conditionally, **signup confirmation** (depends on the Supabase project's
"Confirm email" toggle, not inspectable via code — same open item as doc75).
No explicit "email invitation" flow was found in this module (the auto-acceptance of
`tenant_invitations`, §4, presupposes that the invitation was already created/sent by another flow — not
mapped here, it belongs to `settings`/tenant user management). `SMTP_REQUIRED: SIM` (yes) (for the 2
flows listed). **Neither requested nor configured in this step**, per instruction.

## 11. Errors / User status

Error states handled for real, confirmed in the code: invalid credentials (Supabase message
passed through), missing session (`Navigate to /auth`), tenant not found/inactive
(`UnauthorizedException` in `TenantGuard`), user without an active membership
(`ForbiddenException`), mismatched token/tenant (`ForbiddenException`), `must_change_password`
(redirects to `/change-required-password` — verified in `Home()` of `App.tsx`, already
referenced in earlier prompts of this series). No explicit "suspended"/"deleted"
user state handled in this module specifically was found — only the membership's `is_active`
(a simple boolean).

## 12. Local auth storage

`api-client.ts` does not persist the token in `localStorage` directly (it keeps it in memory, passed in
by AuthContext on every session change). The real session persistence (refresh token, etc.) is
entirely delegated to the Supabase SDK (`@supabase/supabase-js`), which manages its own key
in `localStorage` internally — not read/written directly by application code, so
there would be no value to report even if it were needed (and it is not, per the explicit instruction to never
print values). `CONTENT_TYPE`: session token (sensitive); `OWNER`: Supabase SDK;
`CLEAR_BEHAVIOR`: `supabase.auth.signOut()` clears the SDK's own persistence.

## Summary

```text
STATUS: COMPLETED (auth module)
MODULE_STATUS: COMPLETE
UNMAPPED_AUTH_FIELDS: 0
UNMAPPED_SIGNUP_FIELDS: 0
UNMAPPED_PUBLIC_SIGNUP_FIELDS: 0
UNMAPPED_RESET_FIELDS: 0
UNMAPPED_SESSION_FIELDS: 0
UNMAPPED_ROLE_PERMISSION_REFERENCES: 0
UNMAPPED_TENANT_REFERENCES: 0
UNKNOWN_AUTH_CLASSIFICATIONS: 0
REAL_MAPPING_GAPS: 2 (ArtistaSignupPublic->POST /public/artists nonexistent, maximum severity;
  divergent platform field names in the same payload, even if the endpoint existed)
PUBLIC_SIGNUP_GAPS: 1 (the same finding as §1 — public artist sign-up flow 100% broken)
REALTIME_AUTH_GAPS: 1 (signOut() does not call disconnectRealtimeChannels() — channels may persist
  beyond logout until a full reload; not a cross-tenant leak, RLS still applies)
AUTHORIZATION_GAPS: 0
AUTHENTICATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
SESSION_GAPS: 0
REDIRECT_GAPS: 0 (within what the code controls; the real Supabase Site URL/allowlist remains
  UNRESOLVED, same open item as doc75, not reopened here)
EMAIL_FLOW_GAPS: 0
```

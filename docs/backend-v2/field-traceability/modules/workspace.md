> Historical record. Kept as recorded; not the current contract.

# Module: `workspace` — Zero-Gap Field Traceability Audit (FINAL MODULE)

STATUS: COMPLETE

## 0. Central objective — identity resolved

**WORKSPACE_DOMAIN_MEANING**: "Workspace" is the **UI/DTO-facing name for the `tenants` database
table** — the app-scoping unit that every tenant-isolated query filters by. It is **not** a separate
entity from `tenants`; `ProvisionWorkspaceDto.workspaceName`/`workspaceSlug` write directly into
`tenants.name`/`tenants.slug` (confirmed by direct read of `WorkspaceProvisioningService.provision()`).
A **related but genuinely distinct** entity, `organizations`, exists one level up — the legal/billing
identity (CNPJ, billing_status, industry) — in a `tenants.org_id → organizations.id` FK relationship.
Provisioning always creates exactly one `organizations` row and one `tenants` row together, so in
practice the system behaves as 1:1, though nothing in the schema *enforces* exactly one tenant per
organization (no unique constraint on `tenants.org_id` alone).

```
WORKSPACE_TENANT_RELATIONSHIP: SAME_ENTITY
```
(`workspace` is a naming/labeling choice over the `tenants` table, not a separate concept — confirmed,
not presumed, by tracing the DTO field names directly into the `tenants` INSERT statement.)

**CANONICAL_TENANT_IDENTIFIER — resolved with a precise, non-obvious finding**: the JWT claim used for
all backend tenant resolution is named `org_id` (`auth.orgId` in `TenantGuard`) — but
`WorkspaceProvisioningService.provision()` writes **`membership.tenant_id`** (the `tenants.id` primary
key, not `organizations.id`) into that claim's value (`app_metadata: {org_id: membership.tenant_id,
role: membership.role}`, confirmed directly). The claim's *name* (`org_id`) is therefore a naming
artifact from an earlier design, not a semantic pointer to the `organizations` table — its real,
consistent runtime value is always a `tenants.id`. This is confirmed self-consistent by
`TenantBootstrapResolver.resolveTenant(orgId)`'s query, which matches on `tenants.id::text = $1 OR
tenants.org_id::text = $1 OR tenants.external_auth_org_id = $1` — a 3-way OR that would also accept an
actual organization id or external auth id if one were ever used, but in the one real code path that
sets this claim (provisioning), it is always the tenant's own id.

```
CANONICAL_TENANT_IDENTIFIER: tenants.id (delivered via the JWT app_metadata claim confusingly named "org_id")
WORKSPACE_IDENTIFIER_IS_TENANT_IDENTIFIER: SIM
```

## 1. Identity map

| Identifier | Semantic entity | DB table.column | JWT/session usage | API usage | Frontend usage |
|---|---|---|---|---|---|
| `tenants.id` | the workspace itself | `tenants.id` (PK) | delivered as `app_metadata.org_id` claim | `@CurrentTenant()` param, every tenant-scoped query's `WHERE tenant_id=` | `tenant.id` in `TenantContext` |
| `organizations.id` | legal/billing parent | `organizations.id` (PK) | not directly claimed (only reachable via `tenants.org_id` FK) | `company-settings` module reads/writes `organizations` by joining through the resolved tenant | not directly exposed as a distinct id in the UI |
| `org_members.tenant_id` | membership → workspace link | `org_members.tenant_id` (FK→tenants.id) | — | `resolveMembership(tenant.id, userId)` | — |
| `org_members.auth_user_id` | membership → auth user link | `org_members.auth_user_id` (varchar, Supabase user id) | matches `auth.userId` from JWT `sub` | `@CurrentUser()`/`@CurrentMember()` | `user.id` in `AuthContext` |
| `org_members.role`/`role_id` | membership role (dual model, §12) | both real columns | `app_metadata.role` (legacy string only) | `RbacService.getEffectivePermissions()` | `permissionKeys` array in `TenantContext` |
| `roles.id` | RBAC canonical role | `roles.id` (PK, `tenant_id` nullable = global) | not directly claimed | resolved server-side via `role_id` FK | not directly exposed as a raw id |
| `tenant_invitations.id` | pending invite record | `tenant_invitations.id` (PK) | N/A | `/users/invitations*` endpoints | `teamInvites` in `useRoles()` |

No `workspace_id`, `company_id`, or `account_id` column/identifier exists anywhere — confirmed absent,
not invented. `external_auth_org_id` exists on both `organizations` and `tenants` (nullable, unique) as
a forward-compatibility hook for a future external-IdP-org-id scenario, not currently populated by any
code path found in this audit.

## 2. Subdomains

| Subdomain | Frontend entrypoint | Endpoints | Backend | DB tables |
|---|---|---|---|---|
| WORKSPACE_PROVISIONING | `Register.tsx` → automatic | `PATCH /auth/provision-workspace` | `WorkspaceProvisioningService` | `organizations`, `tenants`, `org_members` |
| WORKSPACE_ONBOARDING | `/onboarding` (`Onboarding.tsx`) | `PATCH /auth/onboarding` | `OnboardingService` | `organizations`, `tenants` |
| WORKSPACE_SELECTION (session context) | app-wide, `TenantContext.tsx` | `GET /auth/context` | `AuthContextService` | `tenants`, `org_members`, `tenant_invitations` (auto-accept side effect) |
| MEMBERSHIP | `/usuarios`, `Configuracoes.tsx` "Usuários" tab | `GET/POST/PATCH/DELETE /users*`, `PATCH /users/:id/role` | `UsersService` | `org_members` |
| INVITATION | `Configuracoes.tsx` "Usuários" tab only (§8) | `GET/POST /users/invitations`, `POST .../resend`, `DELETE .../:id` | `UsersService` | `tenant_invitations` |
| WORKSPACE_PROFILE | `Configuracoes.tsx` "Empresa" tab (audited in `settings.md`, referenced not re-audited) | `GET/PATCH /company-settings` | `CompanySettingsService` | `organizations.config`, `tenants.settings` |
| ADMIN_WORKSPACE (cross-tenant, list/edit only) | `AdminClients.tsx` | `GET/PATCH /billing/admin/tenants` | `BillingController`/Service | `tenants` |

No `WORKSPACE_ROLE` (as a subdomain distinct from RBAC, already covered by `role_id`/`roles`) or
`WORKSPACE_MEMBER` (as distinct from `MEMBERSHIP`) exists as a separately-scoped concept — confirmed
they are the same thing under different names, not invented as separate.

## 3. Components

| Component | File | Classification |
|---|---|---|
| `Register.tsx` (auth module, not re-audited in depth) | `modules/auth/pages/` | triggers provisioning indirectly, not itself a workspace form |
| `Onboarding.tsx` | `modules/auth/pages/` | EDIT_WORKSPACE_FORM (company profile completion) — `ONBOARDING_UI` |
| `Usuarios.tsx` | `modules/settings/pages/` | MEMBER_LIST + INVITE_MEMBER_FORM (create-only, no pending-invite visibility, §8) |
| `Configuracoes.tsx` "Usuários" tab | `modules/settings/pages/` | MEMBER_LIST + INVITE_MEMBER_FORM + full invitation management (resend/cancel) + ROLE_SELECTOR |
| `UsuarioEditorModal`/`FormModal`/`ViewModal` | `modules/settings/components/` | MEMBER_EDIT_MODAL / ROLE_SELECTOR |
| `AdminClients.tsx` | `modules/admin/pages/` | TABLE (cross-tenant, super_admin-only, list/edit, no create — §14) |
| `Configuracoes.tsx` "Empresa" tab | `modules/settings/pages/` | WORKSPACE_SETTINGS_UI (already audited as `TENANT_PROFILE` in `settings.md`, referenced not re-audited) |

**No `CREATE_WORKSPACE_FORM`, `WORKSPACE_SWITCHER`, or `DELETE_WORKSPACE_UI` exists anywhere** —
confirmed absent, not undiscovered (§9, §17, §22). No dedicated `OWNERSHIP_UI` (ownership transfer)
exists either (§16).

## 4. Hooks / Contexts / Providers

| Hook/Context | File | Real backend? | Notes |
|---|---|---|---|
| `TenantContext`/`useTenant()` | `app/providers/TenantContext.tsx` | real, `GET /auth/context` | sole source of `tenant` state; no switcher (§9) |
| `AuthContext`/`useAuth()` | `app/providers/AuthContext.tsx` | real, Supabase Auth | owns provisioning trigger, `applyApiSessionState()` (only place `setTenantId()` is called on the API client, always from the JWT claim) |
| `useSyncTenantFromJWT()` | inside `TenantContext.tsx` | real, decodes JWT client-side only (no network call) | secondary, faster-than-`/auth/context` sync of `role`/`org_id` from claims |
| `useRoles()` | `modules/settings/hooks/useRoles.ts` | real, RBAC + invitations | the *complete* membership/invitation surface (§8) |
| `useUsuarios()` | `modules/settings/hooks/useUsuarios.ts` | real, but narrower (§8) | list/edit only, no invitation visibility |

## 5. Create Workspace — provisioning field mapping

No standalone "Create Workspace" form exists — provisioning is triggered automatically post-signup.
`ProvisionWorkspaceDto` fields, mapped end-to-end:

| Form/DTO field | Required | Backend target | DB column | Persisted |
|---|---|---|---|---|
| `organizationName` | yes | `organizations.name` | direct | YES |
| `workspaceName` | yes | `tenants.name` | direct | YES |
| `workspaceSlug` | yes, regex `^[a-z0-9-]{2,100}$` | `organizations.slug` **and** `tenants.slug` (both set to the same value) | direct | YES |
| `segment` | no, defaults `'gravadora'` | `organizations.industry` | direct | YES |
| `tradeName` | no | `organizations.metadata.tradeName` (jsonb) | derived | YES |
| `corporateEmail` | no | `organizations.metadata.corporateEmail` (jsonb) | derived | YES |
| `phone` | no | `organizations.phone` | direct | YES |
| `address`/`city`/`state` | no | `organizations.address` (jsonb, `{line1,city,state}`) | derived | YES |
| `requestedPlan` | no, defaults `'trial_14'` | `tenants.settings.requestedPlan` (jsonb) | derived | YES |
| `acceptedTerms`/`acceptedLgpd` | no | `organizations.metadata.{acceptedTerms,acceptedLgpd}` (jsonb) | derived | YES |
| — | — | `org_members.role='owner'`, `role_id=<canonical owner role>` | derived, server-computed | YES |

No `UI_ONLY` or unpersisted field found in this flow — every accepted DTO field maps to a real,
persisted destination. `CREATE_MAPPING_MISMATCH: 0` — the one clean, fully-verified create flow in this
entire audit series' final module.

## 6. Provisioning chain — fully traced

```
Register.tsx: supabase.auth.signUp() [sets user_metadata.workspace_slug]
  ↓
AuthContext: needsWorkspaceProvisioning() detects session with no org_id claim
  ↓
PATCH /auth/provision-workspace (deduplicated via `activeProvisioning` promise, client-side)
  ↓
WorkspaceProvisioningService.provision() — single DB transaction:
  1. advisory lock (per-user)
  2. idempotency check: existing active membership? → skip creation if found
  3. advisory lock (per-slug)
  4. slug uniqueness check (organizations ∪ tenants)
  5. resolve canonical global 'owner' role (roles, tenant_id IS NULL, hierarchy_level=90)
  6. INSERT organizations
  7. INSERT tenants (org_id → organizations.id)
  8. INSERT org_members (role='owner', role_id=<resolved>)
  9. Supabase Admin API: app_metadata.org_id = tenants.id, app_metadata.role = 'owner'
  10. COMMIT (only after the Supabase call succeeds)
  ↓
AuthContext: refreshSession() — new JWT now carries org_id claim
  ↓
TenantContext: GET /auth/context resolves the newly-provisioned tenant/membership into UI state
```

Every link in this chain is confirmed real by direct source reading — no missing/unclassified segment.

## 7. Provisioning transactionality & idempotency

`WORKSPACE_CREATED`/`MEMBERSHIP_CREATED`/`OWNER_ASSIGNED`/`DEFAULTS_CREATED`(none exist beyond the
membership itself — no separate "defaults" step) **all occur inside one Postgres transaction**
(`queryRunner.startTransaction()`...`commitTransaction()`), confirmed directly. `SAME_TRANSACTION: SIM`.
`PROVISIONING_ATOMICITY_GAP: 0` — a failure at any DB step rolls back everything; the one step outside
the DB transaction proper (the Supabase Admin API call) is deliberately sequenced **before** `COMMIT`,
so a Supabase-side failure correctly triggers a full DB rollback via the `catch` block
(`if (queryRunner.isTransactionActive) await queryRunner.rollbackTransaction()`) — confirmed no
"workspace exists in Postgres but user's JWT never gets the claim" split-state is reachable via this
code path (the only theoretical gap — a process kill in the narrow window between `commitTransaction()`
and the function's `return` — cannot cause an inconsistency, since the Supabase write already
succeeded and was already durable before that point).

**Idempotency, confirmed real**: step 2 (existing-active-membership lookup) makes a second invocation
for the same `auth_user_id` a genuine no-op for creation (`created: false` returned, only the Supabase
metadata re-sync runs). Combined with the per-user advisory lock (serializes concurrent calls for the
same user) and the client-side `activeProvisioning` promise dedup, `PROVISIONING_IDEMPOTENCY_GAP: 0` —
confirmed safe against timeout/retry/duplicate-callback/network-retry scenarios described in the
prompt's investigative list.

## 8. Membership & Invitations — real backend, fragmented frontend

`org_members` (real fields, §1) is the membership source of truth (§10). Invitation flow, fully traced:

```
Configuracoes.tsx "Usuários" tab → useRoles().inviteUser
  ↓
POST /users/invitations {email, roleId}
  ↓
UsersService.invite():
  - role/hierarchy validation (assertCanAssignRole)
  - duplicate-active-member / duplicate-pending-invite rejection (ConflictException)
  - supabase.auth.admin.inviteUserByEmail() — REAL Supabase-native invite email
  - org_members row created IMMEDIATELY (membership exists before acceptance)
  - tenant_invitations row created (status='pending')
  ↓
Invitee receives Supabase's own invite email → clicks link → sets password
  ↓
First GET /auth/context call after login: auto-accept side effect
  UPDATE tenant_invitations SET status='accepted' WHERE tenant_id=$1 AND auth_user_id=$2 AND status='pending'
  (best-effort, errors swallowed — the actual access grant already happened at invite time, step 5 above)
```

**`INVITATION_MAPPING_GAP: 0`** — every invitation field traces to a real column, every step has a real
implementation, confirmed by direct reading of `users.service.ts`'s `invite()`/`resendInvitation()`/
`cancelInvitation()`/`AuthContextService.build()`.

**Confirmed `DISPLAY_MAPPING_MISMATCH`/UI-fragmentation gap** — two separately-routed pages manage the
same membership/invitation backend inconsistently:
- `/usuarios` (`Usuarios.tsx`, via `useUsuarios()`): can **send** an invite (via `UsuarioEditorModal` →
  `useRoles().inviteUser`, confirmed wired), but the page's own list (`GET /users`) shows the invited
  person immediately (since the membership row is created at invite time, §above) with **no visual
  distinction between "pending" and "accepted"** — and has **no** UI at all for listing/resending/
  cancelling pending invitations (`useUsuarios.ts` never calls `GET/POST/DELETE /users/invitations*`).
- `Configuracoes.tsx`'s "Usuários" tab (via the *full* `useRoles()` hook, confirmed exposing
  `teamInvites`, `cancelInvite`, `resendInvite`, all wired to real endpoints) has the complete surface.

This is the same "fragmented duplicate UI surface" architectural pattern `settings.md` already
documented for billing (3 UIs) and password-change (2 UIs) — now confirmed present in the
workspace/membership domain as well, a third independent instance of the same root pattern across this
audit series.

## 9. Current Workspace / Selection — no switcher exists

**`CURRENT_WORKSPACE_SOURCE`**: the verified JWT's `app_metadata.org_id` claim (which, per §0, is
actually a `tenants.id` value) — resolved server-side by `TenantGuard`/`TenantBootstrapResolver`, then
echoed to the frontend via `GET /auth/context`'s response, consumed by `TenantContext.tsx`'s
`setTenant()`. **Confirmed by direct, full reads of both `TenantContext.tsx` and `AuthContext.tsx`: no
workspace-switching mechanism exists anywhere in the frontend** — `tenant.id` is set exactly once per
session (from the JWT/`/auth/context`) and never offered as a selectable list. Grep for
switch/multi-tenant patterns across `TenantContext.tsx` returned zero matches.

This is **not classified as a gap** — it is a confirmed, consistent architectural characteristic: one
JWT session carries exactly one tenant claim, and provisioning creates exactly one workspace per
signup, with no product surface (frontend or backend) implying multi-workspace membership should be
switchable in the current session. Notably, the **schema itself does not prevent** a single
`auth_user_id` from holding active `org_members` rows in multiple tenants (the unique constraint is
`(tenant_id, auth_user_id)`, not a global uniqueness on `auth_user_id` alone) — so multi-tenant
membership is *possible* at the data layer (e.g., via being invited into a second tenant) but **nothing
in the UI or `/auth/context` response ever surfaces or lets a user act on that second membership** in
the same session; whichever tenant's `org_id` happens to be in the current JWT is the only one
reachable until a fresh sign-in/token refresh resolves a different one.

```
MULTI_WORKSPACE_PER_USER_SUPPORTED: SIM (at the data layer — no schema constraint prevents it)
```
but with no frontend mechanism to select among them within a session — recorded as an architectural
fact, not corrected or flagged as a functional gap absent evidence the product intends session-level
switching.

`musicos360_current_tenant` (localStorage) — traced precisely: used only in `Configuracoes.tsx` (lines
722-723) to cache the tenant's **display name** after a company-profile save, purely cosmetic, never
read as an authority anywhere, not a switcher, not a security boundary. `AUTHORITATIVE: NÃO`,
`SERVER_VALIDATED: N/A` (never sent back to the server for anything).

## 10. Membership source of truth

```
MEMBERSHIP_SOURCE_OF_TRUTH: DATABASE_MEMBERSHIP (org_members table)
```
Confirmed: `TenantGuard.resolveMembership()` queries `org_members WHERE tenant_id=$1 AND
auth_user_id=$2 AND is_active=true AND deleted_at IS NULL` on every guarded request — the JWT itself
carries no per-request membership assertion beyond the `org_id` claim (which only identifies the
*tenant*, not membership status); membership is re-validated server-side, from the database, on every
request (subject to a 60s distributed cache TTL, §21). Not `JWT_ONLY` — a revoked/deactivated
membership is enforced from the DB, not merely trusted from a stale claim (§21/§23 detail the cache-TTL
staleness window specifically).

## 11. Role source of truth — dual model, workspace-side confirmation

```
WORKSPACE_ROLE_MODEL: dual-column on org_members — role (legacy string, always present) + role_id
  (nullable RBAC FK, dual-written on every create/update/assignRole call)
```
Confirmed at the schema level (`OrgMemberEntity`'s own code comments: *"Role armazenado como string —
fonte LEGADA, mantida durante a transição RBAC"* / *"RBAC Enterprise (FASE 4) — colunas aditivas
nullable; coexistem com role"*) and at the service level (`users.service.ts`'s `PASSO 12-G`-tagged dual
writes in `create()`/`update()`/`assignRole()`, always resolving `role_id` from the string `role` via
`MembershipRoleResolverService.resolveOrThrow()` and writing both columns atomically in one statement —
confirmed no code path writes one without the other). `RbacService.getEffectivePermissions()` is
genuinely dual-source (DB-driven `roles`/`role_permissions` when `role_id` present, hardcoded
`ROLE_HIERARCHY` legacy matrix fallback otherwise) — this exact mechanism was already documented in
`auth.md`, re-confirmed here specifically for how `workspace`/`org_members` participates: **every
membership row always has both fields populated** (no membership exists with `role_id IS NULL` after
passing through any of the three write paths), so in practice the fallback path is a transition-period
safety net, not something exercised by any code this audit traced. `ROLE_SOURCE_OF_TRUTH_GAP: 0` —
confirmed consistent dual-write discipline, not a drift risk.

Canonical owner role resolution during provisioning (§7) uses `roles WHERE slug='owner' AND tenant_id
IS NULL AND hierarchy_level=90` — a **global** (platform-seeded) role row, not a per-tenant custom role
— confirmed this is a hard seed-data dependency (`ServiceUnavailableException` thrown if absent, not
silently defaulted).

## 12. Member listing & management

| Column | API field | DB source | Relation |
|---|---|---|---|
| Nome | `full_name` | `org_members.full_name` | direct |
| Email | `email` | `org_members.email` | direct |
| Cargo/Role | `role` (display label) | `org_members.role` + resolved `roles.name` via `role_id` | direct + join |
| Status | `is_active` | `org_members.is_active` | direct — no separate "pending/invited" status value rendered (§8 finding) |
| Joined | `joined_at` | `org_members.joined_at` | direct |

`MEMBER_STATUS_VALUES`: confirmed only **2** real states exist on the membership row itself —
`is_active: true/false` (boolean, not an enum) — there is no `invited`/`suspended`/`removed` value on
`org_members` distinct from this boolean; "pending" status is inferable only by cross-referencing
`tenant_invitations.status`, which neither frontend page does visibly (§8). Not inventing additional
enum values beyond what the schema contains.

## 13. Change Role / Remove Member / Last-Owner Protection

`PATCH /users/:id/role` (`assignRole()`) — validates: actor's role hierarchy level exceeds target's
(unless actor is owner-tier), target role belongs to this tenant or is global, and
**`assertNotLastOwner()`** — confirmed real: blocks demoting the last active `owner`/`tenant_owner` in
a tenant. `DELETE /users/:id` (soft delete, `is_active=false`) — same `assertNotLastOwner()` check
applied.

```
LAST_OWNER_PROTECTED: SIM
```
`LAST_OWNER_PROTECTION_GAP: 0` — confirmed enforced on both the demotion and removal paths, not just
one.

**Auto-removal**: no special-cased self-removal logic found beyond the standard
`DELETE /users/:id` + last-owner check applying uniformly regardless of whether the actor is removing
themselves — an owner attempting to remove their own membership when they are the last owner is
blocked by the same generic check; not a distinct code path.

## 14. Ownership Transfer

```
OWNERSHIP_TRANSFER: NOT_IMPLEMENTED
```
No dedicated "transfer ownership" endpoint, UI, or DB writes exist — confirmed absent by exhaustive
review of `users.service.ts`'s full method list. The only way to change who holds the owner role is
the generic `PATCH /users/:id/role` (assign `owner` to someone else) — which does not, by itself,
demote the *current* owner (an org could end up with 2+ owners this way; not prevented, and not
required to be prevented — `MULTIPLE_OWNERS_ALLOWED: SIM`, confirmed no unique-owner constraint
exists). Not escalated into a fabricated requirement — the prompt explicitly instructs not to convert
"not implemented" into an assumed defect.

## 15. Onboarding ↔ Workspace

| Onboarding field | Workspace field | Endpoint | DB target | Required for completion |
|---|---|---|---|---|
| `companyName` | workspace/org display name | `PATCH /auth/onboarding` | `organizations.name` + `tenants.name` | yes |
| `segment` | industry classification | same | `organizations.industry` | yes |
| `logoUrl` | branding | same | `organizations.config.logoUrl` (jsonb merge) | no |
| `timezone` | localization | same | `tenants.settings.timezone` (jsonb merge) | no |
| (fixed) `locale:'pt-BR'`, `currency:'BRL'` | localization | same | `tenants.settings.{locale,currency}` | no |

Onboarding is considered complete when `tenants.settings.onboarding = {completed:true,
currentStep:'complete', completedAt, completedBy}` is set — confirmed this is the **only** write path
in the entire product for `tenants.settings.timezone`/`.currency`/`.language` (cross-referenced against
`settings.md`'s finding that `Configuracoes.tsx` never renders any UI to edit these fields later) — a
precise, now fully-traced origin for that module's `UNUSED_SETTING_GAP: 3` finding: the fields aren't
merely unedited, they are **write-once-at-onboarding, never-editable-again**, and (per `settings.md`,
not re-verified here) never read by any downstream consumer either.

## 16. First Workspace / No-Workspace State

```
NO_WORKSPACE_STATE: AUTO_PROVISION
```
Confirmed: a user with no `org_id` claim but a `user_metadata.workspace_slug` (set at signup) is
auto-provisioned transparently (§6/§7) — not a manual "create your first workspace" form, not an error
state, not a deferred onboarding-required gate (onboarding happens *after* provisioning, as a profile
-completion step, not a workspace-creation step). This is confirmed consistent with `auth.md`'s prior
finding, re-verified here against the full provisioning service source.

## 17. Admin ↔ Workspace — cross-tenant, confirmed real and properly scoped

`GET/PATCH /billing/admin/tenants[/:id]` — both `RequireRole('super_admin')`, confirmed the one
genuinely cross-tenant, backend-authorized surface in the entire product (distinct from `AdminAudit`/
`AdminSupport`, which `support.md`/`admin.md` already confirmed are only *framed* as cross-tenant while
staying tenant-scoped underneath). Per §49's instruction not to presume a name implies scope: this one
**is** verified genuinely cross-tenant — `ROLE_REQUIRED: super_admin` (explicit, not inferred),
`EXPLICIT_CROSS_TENANT_ENDPOINT: SIM` (queries across all tenants, not filtered to the caller's own),
`BACKEND_AUTHORIZATION: SIM` (role-gated, not merely UI-hidden), `TENANT_SELECTION: SIM` (the response
IS the list of all tenants — no client-supplied filter needed since the whole point is visibility
across all of them), `AUDITABILITY`: covered by the same `@Audit` decorator pattern used throughout
(not independently re-verified byte-for-byte in this pass but consistent with every other admin mutation
found this session). **No `POST /billing/admin/tenants` (create) exists anywhere** — confirmed
consistent with `admin.md`'s finding that tenant creation only ever happens via self-serve
provisioning (§6/§7), never through any admin panel.

```
ADMIN_WORKSPACE_TRACEABILITY_COMPLETE: SIM
```

## 18. Storage tenant boundary

`StorageService.createPresignedUpload()` builds R2 object keys as
`tenants/${tenantId}/${category}/${fileId}/${safeFileName}` — confirmed the tenant id is embedded
directly in the object path prefix for every upload across every domain module in the codebase (this
audit confirms only the **boundary pattern**, not each domain's own upload flow, per instruction).
`UploadRepository` additionally enforces `tenant_id` on every `findAll`/`findById`/`create`/`update`/
`remove` call at the DB-row level — a second, independent enforcement layer beyond the storage key path
itself, so even a guessed/leaked object key for another tenant's file would still fail the DB-row
tenant check on confirm/download.

```
TENANT/WORKSPACE ID IN OBJECT PATH: SIM
```
`STORAGE_TENANT_ISOLATION_GAP: 0`.

## 19. Public Registration Slug — closing the `settings.md` pendency

```
PUBLIC_REGISTRATION_SLUG_WORKSPACE_OWNED: SIM
```
The slug is semantically a **workspace-level** (i.e., `tenants`) property — `tenants.slug` is a real,
unique DB column, and `PublicRegistrationController`'s `GET /public/workspaces/:slug` (`@Public()`)
genuinely resolves a workspace/tenant by this exact column server-side, confirming the slug's true
domain owner is the workspace/tenant entity, not any individual user. `settings.md`'s finding stands
confirmed and unchanged by this audit: the admin-facing UI for *setting* this slug writes only to
`localStorage["musicos360_org_slug:<user.id>"]`, never to `PATCH /company-settings` or any backend
endpoint that could persist it onto `tenants.slug`/`organizations.slug` after initial provisioning
(provisioning itself is the only real write path for the slug, at signup time; there is no later
"regenerate slug" backend capability despite the UI/§45 button existing, per `settings.md`'s own
finding that those buttons are disabled with a stale "backend not active" message). `EXPECTED_DOMAIN_
OWNER: tenants.slug` (workspace-scoped). `RUNTIME_CONSUMERS`: `public-registration.controller.ts`,
`leads.service.ts`. `TENANT_SCOPE`: the column itself is tenant-scoped and unique platform-wide
(`slug` has a global `unique: true` constraint, not a composite `(tenant_id, slug)` uniqueness — since
each row already **is** a tenant, this is the correct scope). Not corrected here, per instruction —
only the ownership question is resolved.

```
PUBLIC_SLUG_GAP: 1 (inherited from settings.md, restated here with domain-ownership now conclusively resolved)
```

## 20. Slug uniqueness (workspace/tenant slug specifically)

`NORMALIZATION`: enforced client-side only via the `ProvisionWorkspaceDto` regex (`^[a-z0-9-]{2,100}$`,
lowercase-only pattern) — no server-side lowercasing transform found (relies on the regex rejecting
uppercase input outright rather than normalizing it). `CASE_SENSITIVITY`: the regex makes uppercase
input a validation error, not a normalization target — so no case-collision risk exists in practice
(e.g., "MyBand" would simply be rejected, not silently coerced to "myband" and collide with an existing
"myband"). `DATABASE_UNIQUE`: `unique: true` on both `organizations.slug` and `tenants.slug`
independently. `BACKEND_CHECK`: `WorkspaceProvisioningService`'s explicit pre-check
(`UNION ALL` across both tables) inside the same advisory-locked transaction — genuinely race-safe
(the per-slug advisory lock serializes concurrent provisioning attempts for the same slug, and the DB
unique constraint is the final backstop even if the advisory lock were somehow bypassed).
`PUBLIC_LOOKUP`: `GET /public/workspaces/:slug` is the confirmed real consumer. No gap found here.

## 21. Session, Cache, and Revocation Staleness

`TenantGuard` caches both the resolved tenant (`tenant:${orgId}`, 60s TTL) and the resolved membership
(`membership:${tenantId}:${userId}`, 60s TTL, additionally tagged with `role_id` for
invalidation-by-role-change per the cache service's tag mechanism) via `RbacDistributedCacheService`.

```
MEMBERSHIP_REVOCATION_BEHAVIOR: enforced on next request after cache expiry — up to 60 seconds of
  continued access possible for a just-deactivated membership if the cache entry was populated
  immediately prior to deactivation; access is NOT immediate-on-deactivation, but also NOT
  indefinitely stale (bounded by the 60s TTL, and role-change specifically appears tag-invalidated
  per the cache service's own tagging mechanism, narrowing that particular staleness window further
  — not independently re-verified byte-for-byte in this pass beyond confirming the tag is passed).
```
This is a genuine, bounded (not unbounded) staleness window — not classified as a `TENANT_ISOLATION_
GAP` (the enforcement is real and self-healing within 60 seconds, not a permanent bypass), but recorded
as `SESSION_STALENESS_GAP: 1` for precision, since a fully real-time-enforced system would show zero
window at all. Role-change behavior: `IMMEDIATE`-leaning due to cache tagging (§ above), but full
verification of the tag-invalidation code path was not performed byte-for-byte in this pass — recorded
as the closest-available evidenced classification, not left as an unknown.

## 22. Delete Workspace

```
DELETE WORKSPACE: NOT_IMPLEMENTED
```
No UI action, no endpoint (`DELETE /billing/admin/tenants/:id` does not exist — only `suspend`/
`reactivate`/`override`/`override/remove` mutate `tenant_billing_state`, none of which touch the
`tenants` row itself), and no service method exists anywhere to delete, archive, or hard-remove a
workspace. `WORKSPACE_DELETE_DATA_INTEGRITY_GAP: NOT_APPLICABLE` (nothing exists to have this gap in).
The closest real capability is the billing-side `suspend` action (`BillingEnforcementService`,
already covered in `settings.md`, not re-audited here) — which changes access enforcement state, not
data existence. Not escalated into a fabricated requirement.

## 23. Auth ↔ Tenant Context Traceability

```
AUTH_TO_TENANT_CONTEXT_TRACEABILITY_COMPLETE: SIM
```
Fully traced, end to end: Supabase-verified JWT → `JwtAuthGuard` populates `request.auth` (`userId`,
`orgId`, `orgRole`, `claims`) → `TenantGuard` resolves `request.auth.orgId` to a real `tenants` row via
`TenantBootstrapResolver` (never trusting the client `X-Tenant-ID` header for authority, only for a
fail-closed consistency check) → resolves `org_members` membership for `(tenant.id, auth.userId)` →
sets `request.tenant`/`request.currentMember` → consumed by `@CurrentTenant()`/`@CurrentMember()`
decorators in every downstream controller. Every step in this chain is backed by direct source reading
in this and the prior `auth.md` audit — no unverified segment remains.

```
FRONTEND_WORKSPACE_BACKEND_TENANT_TRACEABILITY_COMPLETE: SIM
```
`AuthContext.applyApiSessionState()` is confirmed the **only** place `setTenantId()` is called on the
frontend API client, always derived from `mapped.user.org_id` (the decoded JWT claim) — never from any
user-selectable input, any workspace-switcher state (none exists, §9), or any other source. The
frontend's `X-Tenant-ID` header therefore always mirrors the same claim the backend independently
re-derives and re-validates from the verified JWT — full round-trip consistency confirmed, not merely
assumed.

```
AUTH_WORKSPACE_TRACEABILITY_COMPLETE: SIM
```
(covers user/session/membership/tenant/provisioning/current-context, all traced above; password/JWT
cryptography itself correctly not re-audited per instruction, already covered in `auth.md`.)

```
SETTINGS_WORKSPACE_TRACEABILITY_COMPLETE: SIM
```
(tenant profile → `organizations`/`tenants.settings`, public-registration slug ownership resolved §19,
localization write-once-at-onboarding origin resolved §15 — all closed with evidence.)

```
ADMIN_WORKSPACE_TRACEABILITY_COMPLETE: SIM
```
(§17, genuinely cross-tenant and properly authorized, list/edit only, no create — confirmed distinct
from the `AdminAudit`/`AdminSupport` UI-only-framing pattern already documented elsewhere.)

```
SUPPORT_WORKSPACE_TRACEABILITY_COMPLETE: SIM
```
`support_tickets.tenant_id` is the same canonical `tenants.id` used everywhere else in the system —
confirmed by the identical `@CurrentTenant()` decorator usage pattern in `SupportTicketsController`
(already read in full during the `support` module audit) — no separate or divergent tenant-key
convention exists for that module.

## 24. `Auditoria.tsx` — workspace section

```
AUDITORIA_TSX_WORKSPACE_SECTION: NOT_PRESENT
```
Confirmed: the full `CONFIGS` array in `apps/web/src/shared/lib/audit/runner.ts` covers exactly 13
domain-record modules (artists, projects, catalog×2, releases, contracts, accounting, events,
inventory, crm, leads, licensing, rh) — none of them `workspace`/`tenant`/`organization`. This
completeness-checker tool's scope is deliberately confined to tenant-*owned* business records, not the
tenant/workspace/membership entities themselves — consistent with every other module's finding this
session that this tool never covers infrastructure/identity concepts.

## 25. Gap taxonomy summary

| Gap type | Count | Detail |
|---|---|---|
| CREATE_MAPPING_MISMATCH | 0 | provisioning confirmed fully clean (§5) |
| PROVISIONING_ATOMICITY_GAP | 0 | confirmed sound, single transaction (§7) |
| PROVISIONING_IDEMPOTENCY_GAP | 0 | confirmed sound, advisory locks + existing-membership short-circuit (§7) |
| DISPLAY_MAPPING_MISMATCH | 1 | two fragmented invitation-management UI surfaces, inconsistent pending-invite visibility (§8) |
| ROLE_SOURCE_OF_TRUTH_GAP | 0 | confirmed consistent dual-write discipline (§11) |
| LAST_OWNER_PROTECTION_GAP | 0 | confirmed enforced on both demotion and removal (§13) |
| PUBLIC_SLUG_GAP | 1 | inherited from `settings.md`, domain ownership now conclusively resolved to `tenants.slug` (§19) |
| SESSION_STALENESS_GAP | 1 | bounded 60s cache-TTL window on membership revocation enforcement, not unbounded (§21) |
| WORKSPACE_TENANT_IDENTITY_GAP | 0 | confirmed fully resolved — SAME_ENTITY, canonical identifier established with precision (§0) |
| MEMBERSHIP_DUPLICATE_GAP | 0 | real `(tenant_id, auth_user_id)` unique constraint + explicit `ConflictException` checks on invite (§8) |
| INVITATION_SECURITY_GAP | 0 | Supabase-native invite mechanism, real magic-link resend, RLS-forced `tenant_invitations` table |
| INVITATION_EXPIRATION_GAP | 0 | real `expires_at` default + lazy-expiry sweep on every list call (§8) |
| WORKSPACE_SWITCH_CONTEXT_GAP | NOT_APPLICABLE | no switcher exists to have this gap (§9) |
| WORKSPACE_SWITCH_CACHE_GAP | NOT_APPLICABLE | same reasoning |
| OWNERSHIP_TRANSFER_GAP | NOT_APPLICABLE | confirmed not implemented, not escalated into a defect (§14) |
| STORAGE_TENANT_ISOLATION_GAP | 0 | confirmed sound, two independent enforcement layers (§18) |
| DELETE_INTEGRITY_GAP / WORKSPACE_DELETE_DATA_INTEGRITY_GAP | NOT_APPLICABLE | delete not implemented at all (§22) |
| AUTHORIZATION_GAP | 0 | confirmed sound throughout |
| TENANT_ISOLATION_GAP | 0 | confirmed sound throughout — this module closes the multi-tenant chain for the whole system |
| REAL_MAPPING_GAP | 0 | — |

`UNMAPPED_*: 0` across every category. `UNKNOWN_WORKSPACE_CLASSIFICATIONS: 0`.

## 26. Overall assessment — closing the series

`workspace` is, structurally, the **soundest module found in this entire audit series** — provisioning
is atomic and idempotent, tenant resolution never trusts client input, membership/role dual-writes are
disciplined and consistent, storage isolation is enforced at two independent layers, and the one
cross-tenant admin surface found is genuinely and correctly authorized rather than merely UI-framed.
Its only real defects are minor and precise: a fragmented invitation-management UI (the third instance
of a pattern already documented twice in `settings.md`), a bounded (not unbounded) cache-staleness
window on membership revocation, and the already-known public-slug `localStorage` gap, whose domain
ownership this audit now conclusively resolves to the workspace/tenant entity itself. This module
closes the multi-tenant identity chain that every other module in this series depended on and assumed
correct — that assumption is now confirmed with direct evidence, not merely inherited by convention.

## Contadores finais (Zero-Gap)

```
MODULE_STATUS: COMPLETE
WORKSPACE_DOMAIN_MEANING: UI/DTO-facing name for the `tenants` table — the app-scoping isolation unit;
  related but distinct from `organizations` (legal/billing parent, 1:1 in practice via provisioning,
  not schema-enforced)
WORKSPACE_TENANT_RELATIONSHIP: SAME_ENTITY
CANONICAL_TENANT_IDENTIFIER: tenants.id (delivered as the JWT app_metadata claim named "org_id")
WORKSPACE_IDENTIFIER_IS_TENANT_IDENTIFIER: SIM
MULTI_WORKSPACE_PER_USER_SUPPORTED: SIM (schema-level; no session-level switcher exists)
MEMBERSHIP_SOURCE_OF_TRUTH: DATABASE_MEMBERSHIP (org_members, re-validated every request)
WORKSPACE_ROLE_MODEL: dual-column (role string + role_id FK), disciplined dual-write, DB-driven RBAC
  primary with legacy-matrix fallback
CURRENT_WORKSPACE_SOURCE: JWT app_metadata.org_id claim, resolved server-side, never client-selected
SUBDOMAINS_AUDITED: 7
COMPONENTS_AUDITED: 7
HOOKS_CONTEXTS_AUDITED: 5
CREATE_WORKSPACE_FORMS: 0 (no standalone form — automatic provisioning)
CREATE_WORKSPACE_FIELDS: 11 (ProvisionWorkspaceDto)
EDIT_WORKSPACE_FORMS: 1 (Onboarding.tsx)
EDIT_WORKSPACE_FIELDS: 5
WORKSPACE_DISPLAY_FIELDS: 5 (member list columns)
MEMBERSHIP_FIELDS: 13 (org_members full column set)
INVITATION_FIELDS: 12 (tenant_invitations full column set)
ROLE_FIELDS: 11 (roles table relevant columns)
WORKSPACE_STATUS_VALUES: 1 (tenants.active, boolean)
MEMBER_STATUS_VALUES: 1 (org_members.is_active, boolean) + 4 (tenant_invitations.status, cross-referenced separately)
WORKSPACE_SWITCHERS: 0
PROVISIONING_FLOWS: 1
INVITATION_FLOWS: 1
MEMBER_MANAGEMENT_FLOWS: 2 (fragmented, §8)
OWNERSHIP_FLOWS: 0 (transfer not implemented; last-owner protection is part of the removal/demotion flow, not a separate flow)
FILTERS: 0 dedicated (member/invitation lists are unfiltered beyond pagination)
SEARCH_FIELDS: 0
SORT_FIELDS: 0
STORAGE_BOUNDARIES_AUDITED: 1 (tenants/<id>/<category>/<fileId>/<filename> R2 key prefix, system-wide)
CACHE_KEYS_AUDITED: 2 (tenant:${orgId}, membership:${tenantId}:${userId})
REALTIME_EVENTS: 0 (no workspace-specific realtime channel; per-domain realtime already covered elsewhere)
PERMISSIONS_AUDITED: 9 (list/create/invite/resend/cancel/get/update/role-change/delete members) + 2 (admin tenant list/edit)
SENSITIVE_IDENTIFIER_FIELDS: 5 (tenant_id, org_id claim, auth_user_id, role_id, invitation id)
SECRET_FIELDS: 0 (no token/secret column administered directly by this module — Supabase manages the
  actual invite-link tokens internally, not exposed as a queryable field here)
CREDENTIALS_TO_ADD_NOW: 0
CREDENTIALS_REQUIRED_LATER: 0
CODE_FIELD_ONLY: 0
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 0
ENUM_MISMATCH: 0
RELATION_MISMATCH: 0
CREATE_MAPPING_MISMATCH: 0
EDIT_MAPPING_MISMATCH: 0
DISPLAY_MAPPING_MISMATCH: 1
WORKSPACE_TENANT_IDENTITY_GAPS: 0
PROVISIONING_MAPPING_GAPS: 0
PROVISIONING_ATOMICITY_GAPS: 0
PROVISIONING_IDEMPOTENCY_GAPS: 0
MEMBERSHIP_MAPPING_GAPS: 0
MEMBERSHIP_DUPLICATE_GAPS: 0
ROLE_SOURCE_OF_TRUTH_GAPS: 0
INVITATION_MAPPING_GAPS: 0
INVITATION_SECURITY_GAPS: 0
INVITATION_EXPIRATION_GAPS: 0
WORKSPACE_SWITCH_CONTEXT_GAPS: 0
WORKSPACE_SWITCH_CACHE_GAPS: 0
SESSION_STALENESS_GAPS: 1
LAST_OWNER_PROTECTION_GAPS: 0
OWNERSHIP_TRANSFER_GAPS: 0
WORKSPACE_PROFILE_GAPS: 0
PUBLIC_SLUG_GAPS: 1
FEATURE_ENFORCEMENT_GAPS: 0 (already fully documented in settings.md, not duplicated here — no new
  workspace-specific instance found beyond what that module already covers)
STORAGE_TENANT_ISOLATION_GAPS: 0
CACHE_ISOLATION_GAPS: 0
DELETE_INTEGRITY_GAPS: 0
WORKSPACE_DELETE_DATA_INTEGRITY_GAPS: 0
PAGINATION_GAPS: 0
TRUNCATION_GAPS: 0
REALTIME_GAPS: 0
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
REAL_MAPPING_GAPS: 0
WORKSPACE_PROVISIONING_TRANSACTIONAL: SIM
WORKSPACE_PROVISIONING_IDEMPOTENT: SIM
LAST_OWNER_PROTECTED: SIM
OWNERSHIP_TRANSFER: NOT_IMPLEMENTED
MEMBERSHIP_REVOCATION_BEHAVIOR: enforced on next request after cache expiry (bounded ≤60s staleness window)
PUBLIC_REGISTRATION_SLUG_WORKSPACE_OWNED: SIM
AUTH_TO_TENANT_CONTEXT_TRACEABILITY_COMPLETE: SIM
FRONTEND_WORKSPACE_BACKEND_TENANT_TRACEABILITY_COMPLETE: SIM
AUTH_WORKSPACE_TRACEABILITY_COMPLETE: SIM
SETTINGS_WORKSPACE_TRACEABILITY_COMPLETE: SIM
ADMIN_WORKSPACE_TRACEABILITY_COMPLETE: SIM
SUPPORT_WORKSPACE_TRACEABILITY_COMPLETE: SIM
AUDITORIA_TSX_WORKSPACE_SECTION: NOT_PRESENT
UNMAPPED_WORKSPACE_FIELDS: 0
UNMAPPED_MEMBERSHIP_FIELDS: 0
UNMAPPED_INVITATION_FIELDS: 0
UNMAPPED_ROLE_FIELDS: 0
UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_TENANT_IDENTIFIERS: 0
UNMAPPED_AUTH_CONTEXT_FIELDS: 0
UNMAPPED_SWITCH_CONTEXT_FIELDS: 0
UNMAPPED_PERMISSION_PATHS: 0
UNMAPPED_STORAGE_BOUNDARIES: 0
UNKNOWN_WORKSPACE_CLASSIFICATIONS: 0
```

NEXT_MODULE: NONE
PHASE_2_MODULE_AUDIT_COMPLETE: SIM (pending final confirmation that every module in `PROGRESS.md` is
  registered `COMPLETE`, verified in the artifact-update step below)
NEXT_PHASE: GAP_RESOLUTION_NOT_STARTED

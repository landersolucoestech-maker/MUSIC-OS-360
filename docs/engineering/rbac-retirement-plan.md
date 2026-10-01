# RBAC legacy role slug retirement plan (S4b / S5)

Status: DESIGN ONLY. Nothing in this document is applied, registered or executed. S4a (canonical English writes, dual-read everywhere) is shipped code-only; S4b and S5 are gated.

Policy: machine values are English, Portuguese appears only as display labels (`roles.name`, web labels). Expand-contract, nothing destructive without a gate. Never run against production from a work session.

## 1. Vocabulary

| Legacy (persisted today) | Canonical English | State |
|---|---|---|
| juridico | legal | alias row exists (20260930000001), dual-accepted, written canonical since S4a |
| comercial | sales | same |
| produtor | producer | same |
| colaborador | collaborator | same |
| rh_manager | hr_manager | same |
| artista | artist | `artista` is a global alias row of `artist` since 20260610000002; written as `artist` since S4a |
| tenant_owner | owner (NOT mapped) | independent decision, both stay; last-owner logic compares both |
| radio, tv | unchanged | English word / international acronym |
| marketing, marketing_manager, financial, accounting, viewer, editor, manager, admin, owner, super_admin, artist | unchanged | already English |
| admin_master, ar_gestao, financeiro_contabil, leitor (web form values only) | NOT mapped except `leitor`->`viewer` in the web select | no `roles` row exists; the API rejects them (`ROLE_UNKNOWN`); `admin_master` (admin vs owner vs super_admin), `ar_gestao` (no equivalent) and `financeiro_contabil` (accounting vs financial) need a product decision and must not be guessed |

No new alias row is required: every legacy slug that has an unambiguous canonical slug already has an inert alias row. Nothing for `radio`/`tv` (same spelling) and nothing for the web-only form values (no persisted slug).

## 2. S4a (shipped as code only)

- Shared single source: `packages/types/src/role-slugs.ts` (`LEGACY_TO_CANONICAL_ROLE_SLUG`, `toCanonicalRoleSlug`, `toLegacyRoleSlug`, `roleSlugEquivalents`, `areEquivalentRoleSlugs`), re-exported by `apps/api/src/core/rbac/role-hierarchy.ts`; own-property safe (`constructor`, `__proto__` never resolve).
- Writers (`UsersService.create/assignRole/invite/resendInvitation`) persist the canonical slug in `org_members.role`, the domain event and the Supabase invite / `app_metadata.role` claim (the source of the JWT claim copied by `custom_access_token_hook`). `role_id` still resolves from the slug sent and follows `canonical_role_id`. The canonical slug is written only when `roles` proves it resolves to the same `role_id` (live global alias row); otherwise the legacy slug is kept. Kill switch `RBAC_CANONICAL_ROLE_WRITE=false` re-emits the legacy form of the five aliases.
- Readers accept both everywhere: `ROLE_HIERARCHY`, legacy `ROLE_PERMISSIONS`, workflow role arrays (canonical listed first, legacy kept), `RolesGuard`, `PermissionsGuard` shadow (role_id based), permission-divergence telemetry, member list role filter (`IN` both forms), web `useHasRole` (ranks keyed by canonical slug, legacy resolved through the shared map), web role pickers (canonical values, PT-BR labels, prefill of legacy members). SQL: only `super_admin` is keyed in RLS/JWT hooks; no policy references any other role slug.
- Assignability: a canonical alias is assignable exactly when its legacy global twin is; a live tenant role on a canonical slug is refused; inherited object keys are reserved.
- Seed: grant tables are canonical-first and resolve to the persisted holder row, output identical to the previous seed (verified by capturing every `role_permissions`/`roles` insert before and after).

## 3. S4b: in-place rename + backfill (GATED, draft only)

Draft: `apps/api/src/database/migration-drafts/20260930000030_CanonicalizeRoleSlugsInPlaceAndBackfillMembers.ts` (not in `ALL_MIGRATIONS`; a spec asserts this; `up()`/`down()` additionally require `RBAC_S4B_CONFIRM=<token>` so an accidental registration still does nothing).

Effect (single transaction, `lock_timeout` 15 s, BYPASSRLS role required):

1. Pre-flight, fail-closed, before any write: the five pairs are exactly in the S4a state (legacy row live; canonical row an inert alias of it, same level); nothing references the English alias rows (members, invitations, role_permissions, role_inheritance, canonical pointers); no tenant custom role uses any involved slug; every member holding an involved slug has `role_id` equal to the canonical role row (rows that do not are counted and reported, never guessed).
2. In-place rename of the GLOBAL rows (same `id`, so `role_permissions`, `role_inheritance`, `org_members.role_id`, `tenant_invitations.role_id`, permission cache keys stay valid): delete the five inert English alias rows, `UPDATE roles SET slug = <english>` on the legacy row, insert an inert alias row under each legacy slug pointing at the renamed row (so legacy slugs still resolve until S5).
3. `org_members.role` backfill legacy -> canonical (and `artista` -> `artist`), keyset batches of 500 by primary key, only where `role_id` is the role row. `tenant_invitations` stores `role_id` only; a `role` string column would be rewritten the same way if it ever exists.
4. Residue audit inside the transaction: zero legacy slugs left in `org_members`, zero role-string/role_id disagreements, five renamed rows, five inert legacy aliases; otherwise throw and roll back. Messages are bounded (600 chars, counts by slug/source, no PII).
5. `down()`: refuses while anything references the inert legacy alias rows or an English member has a foreign `role_id`; otherwise members back to legacy (not `artist`: indistinguishable and equivalent), delete legacy aliases, rename back, re-insert English aliases, verify.

Not touched: `workflow_transitions.actor_role` and audit rows (history), Supabase auth users (claim refreshes on next token), Redis membership cache (TTL 60 s; flush `membership:{tenantId}:*` after commit).

Code companion that ships with the migration (not in S4a): `ENGLISH_ROLE_ALIASES` direction flips (legacy becomes the alias), `permissionHolderSlug` becomes identity, `assertCanAssignRole` twin logic removed, `is_assignable` of the legacy alias rows stays false, pinned specs updated.

### Gates (all must be evidenced before registering the migration)

- S4a build running on EVERY runtime that reads `org_members.role` (API, workers, web) and `RBAC_CANONICAL_ROLE_WRITE` true for at least one full token lifetime; RolesGuard "Insufficient role" rate and RBAC telemetry not above the previous 24 h.
- The `docs/engineering/security.md` consistency query returns zero rows in the target environment; the tenant-role pre-flight queries return zero rows.
- Disposable PostgreSQL round trip of the draft (up, second up, down, up; the refusal cases; concurrent `assignRole` racing a batch leaves no role/role_id mismatch) recorded. Not run in S4a: no disposable database could be started without privilege workarounds.
- Backup/PITR point recorded; operator runbook for the post-commit cache flush.
- Product decision on `admin_master`, `ar_gestao`, `financeiro_contabil` (and whether `tenant_owner` is retired).

### 3b. RBAC module key `rh` -> `hr` (R4 / R3-08)

- Shipped (code only, dual-read): API `expandHrPermissionAliases` (applied in `RbacService.getEffectivePermissions` and `can`, so `/auth/context` `membership.permissions` carries both `rh:x` and `hr:x` for a persisted grant of either, same action only); web `permission-map` (`permissionKeyEquivalents`, `expandPermissionAliases`, used by `usePermissions` and `useCanAccess`); web module key `hr` (`TenantModuleKey`, `HR.tsx`, audit module id `hr`, `MODULE_RESOURCE.rh` kept as deprecated alias); `packages/auth` `RESOURCES.HR` added next to deprecated `RH`. The seed matrix and `ROLE_PERMISSIONS` still persist `rh:*` (no canonical write: it would break the S4b pre-flight).
- Gated draft: `migration-drafts/20260930000051_RenameLegacyHrPermissionsInPlace.ts` renames `permissions` rows `rh:*` -> `hr:*` in place (same id), refuses if any `hr` row exists, needs `RBAC_S4B_CONFIRM=rename-legacy-hr-permissions-gates-satisfied` (distinct token), never registered (spec asserts). Same gates as section 3, plus: dual-read build on every runtime; flush the permission cache after commit. Code companion in the same release: flip `Resource`/seed matrix to `hr`, keep reading `rh` until S5.
- S5: remove the `rh` spelling from `expandHrPermissionAliases`, web permission-map, `RESOURCES.RH`, `MODULE_RESOURCE.rh`.
- `moduleRh` feature echo (`withLegacyHrFeatureAlias`, auth-context) is a separate plan-feature alias, verified intact (`auth-context.features.spec.ts`).

## 4. S5: retire the legacy slugs (GATED, not designed in code)

Preconditions: S4b verified for at least 7 days and one token lifetime after the last backfill; zero rows referencing legacy slugs in `org_members.role`, `tenant_invitations` (via role_id), persisted workflow/automation role arrays (none today; definitions are code), external clients, exports and docs that send legacy role values (`ArtistSignupPublic` team categories are unrelated; contract signer roles `artista`/`produtor` in `contract-schema.ts` are a different vocabulary).

Steps: remove the legacy members from `ROLE_HIERARCHY`, `ROLE_PERMISSIONS`, `FunctionalRole`, workflow arrays and web `AppRole` in the same change as a guard migration that refuses while any legacy slug is still referenced; archive (not delete) the inert legacy alias rows; decide `artista`/`tenant_owner` separately.

## 5. Risks and abuse paths (S4a review)

- Code before migration: canonical slug is never written without the alias row proof; a canonical English input is still refused (own non-assignable row) when the legacy twin row is absent.
- Tenant role squatting on a canonical slug (`legal`): refused at creation (`assertSlugNotReserved`), refused at assignment, and never lends assignability or level to the canonical slug.
- Prototype-key roles (`constructor`, `__proto__`, `toString`): previously `ROLE_HIERARCHY['constructor']` resolved to a function and `level < required` compared as NaN, which let such a role pass every `@Roles` gate if a tenant could persist it. Lookups are now own-property only (`roleLevel`), the slugs are reserved for tenant roles, and tests pin this.
- Stale JWT claims: `RolesGuard` authorizes on `org_members.role` (membership), the JWT role only feeds workflow `actorRole`, where both forms are listed.
- Residual UI difference: web `artist` now ranks like `artista` in `useHasRole` (UI gating only; the API is authoritative).

> Historical record. Kept as recorded; not the current contract.

# Module: `settings` — Zero-Gap Field Traceability Audit

STATUS: COMPLETE

## 0. Central objective

**SETTINGS_DOMAIN_MEANING**: `settings` is a **multi-surface configuration hub** spanning several real,
independently-audited subdomains — confirmed by evidence, not presumed as one uniform thing:
`TENANT_PROFILE` (company/branding, real backend), `USER_PREFERENCES` (localStorage-only, no backend
table exists), `NOTIFICATIONS` (real backend, fully disconnected from the UI that claims to control it),
`SECURITY` (mostly inert UI over Supabase Auth), `ACCESS` (real RBAC, shared with the already-audited
role/permission system), `INTEGRATIONS` (a real, shared surface — reuses the already-audited
`integrations` module's own hooks/dialogs directly, not a stale duplicate), `LOCALIZATION` (persisted,
zero UI, zero consumer), `BILLING` (real Stripe core, three inconsistent/overlapping UI surfaces),
`FEATURE_CONFIGURATION` (plan-derived, UI-only enforcement), and `OTHER_CONFIRMED: PUBLIC_REGISTRATION`
(a public artist sign-up link generator whose UI is stale relative to an already-live backend).

**No single backend module named `settings` exists** — the frontend `settings` module is an umbrella
UI over several independently-real backend modules (`company-settings`, `notifications`,
`billing`, `rbac`/`users`) plus one deliberately-stubbed, always-no-op local service
(`settings.service.ts`) for a fourth concept ("operational lists") that was never given a backend.

## 1. Subdomains

| Subdomain | Frontend entrypoint | Endpoints | Backend | DB tables |
|---|---|---|---|---|
| TENANT_PROFILE / BRANDING | `Configuracoes.tsx` "Empresa" tab | `GET/PATCH /company-settings` | `company-settings` module | `organizations` (`config` jsonb for branding), `tenants.settings` (jsonb) |
| USER_PREFERENCES | `Configuracoes.tsx` "Automações" tab, `Perfil.tsx` | none (localStorage only) | — | none (no `user_settings`/`user_preferences` entity exists anywhere) |
| NOTIFICATIONS (tenant-wide, despite the name) | none reachable (§5) | `GET/PATCH /notifications/settings` | `notifications` module | `notification_settings` |
| SECURITY | `Configuracoes.tsx` "Segurança" tab, `Perfil.tsx` | Supabase Auth `updatePassword` only | Supabase Auth (external) | none (no local security-settings table) |
| ACCESS (roles/permissions) | `Configuracoes.tsx` "Usuários" tab, `Usuarios.tsx` | RBAC endpoints (already covered structurally by the auth/RBAC system) | `rbac-admin.controller.ts` | RBAC tables (not re-audited) |
| INTEGRATIONS | `Configuracoes.tsx` "Integrações" tab | shared with `integrations` module's own real per-provider endpoints | shared | shared |
| PUBLIC_REGISTRATION | `Configuracoes.tsx` "Cadastro Público" tab | real backend exists (`public-registration.controller.ts`) but **UI never calls it** (§11) | `public-registration` (not re-audited, only its relation to Settings) | `tenants.allow_public_registration` + related counter columns |
| BILLING | `Configuracoes.tsx` "Billing" tab, standalone `Billing.tsx`, `BillingBlockedPage.tsx` | real (`/billing/plans`, `/billing/checkout`, `/billing/portal`, `/billing/subscription`) + 1 nonexistent (`/billing/invoices`, §9) | `billing` module (Stripe) | `billing_subscriptions`, `tenant_billing_state`, `billing_plans`, `payment_events` |
| FEATURE_CONFIGURATION | `FeatureGate` wrapping 13 module pages | none — derived client-side from Stripe subscription | `billing.service.ts` plan-feature maps (not a settings-specific endpoint) | `billing_plans.features` |
| LOCALIZATION | none (persisted, unreachable via any UI, §10) | `PATCH /company-settings` (same as tenant profile) | `company-settings` module | `tenants.settings` jsonb |

## 2. Components / Hooks

| Component | File | Classification |
|---|---|---|
| `Configuracoes.tsx` (2600 lines) | `pages/` | TAB container, 7 tabs, mounted at 3 URLs (`/configuracoes`, `/settings/roles`, `/settings/permissions` — same component regardless of URL) |
| `Perfil.tsx` | `pages/` | FORM (personal profile) + inert SECURITY_UI cards |
| `Usuarios.tsx` | `pages/` | TABLE (real RBAC user management) |
| `Billing.tsx` | `pages/` | **DEAD-CODE-ADJACENT** — a second, fully independent billing UI with **hardcoded plan pricing**, directly contradicting the codebase's own governance comment in `billing-plans.service.ts` ("planos NÃO podem ser hardcoded na tela") |
| `BillingBlockedPage.tsx` | `pages/` | STATIC (real, gates on real `BillingEnforcementService` state) |
| `AuditTrail.tsx` | `pages/` | **DEAD** — fully built (search/filter/diff viewer), zero route references it anywhere |
| `LogoUploader.tsx` | `components/` | UPLOAD — real client-side validation, **broken server path** (§4) |
| `IntegrationStatusBadges.tsx` | `components/` | STATIC (status display) |
| `UsuarioEditorModal.tsx`/`FormModal.tsx`/`ViewModal.tsx` | `components/` | real CRUD modals (RBAC) |

| Hook | File | Backend | Notes |
|---|---|---|---|
| `useCompanySettings` | `hooks/` | real, `GET/PATCH /company-settings` | tenant profile + localization fields |
| `useUserSettings` | `hooks/` | **none — 100% localStorage** (§6) | per-user "preferences," never sent to any backend endpoint |
| `useOperationalSettings` | `hooks/` | none — routes through the always-throwing `settings.service.ts` stub (§7) | 14 configurable lists, all edits silently no-op |
| `useRoles` | `hooks/` | real, RBAC | not re-audited (already covered by the auth/RBAC system) |
| `useUsuarios` | `hooks/` | real | user list/management |
| `useAuditTrail` | `hooks/` | real backend, but its only consumer (`AuditTrail.tsx`) is dead/unrouted | orphaned hook-component pair |
| `settings.store` (`useSettingsStore`) | `hooks/` | N/A, Zustand | **DEAD** — defined, zero importers anywhere |

## 3. Read / Initial load — source-of-truth per field

`useCompanySettings`: real `DATABASE` source (`organizations`/`tenants` via `company-settings` service).
`useUserSettings`: `LOCAL_STORAGE` exclusively — no `DATABASE`/`ENV`/`RUNTIME_CONFIG` source exists for
any of its fields (`full_name, phone, cargo, setor, avatar_url`, all `notify_*`/`auto_*` toggles,
`automation_preferences`). `useOperationalSettings`: intended `DATABASE` (real `operational_list_items`
table exists, migrated) but actual runtime source is `HARDCODED_FRONTEND`
(`DEFAULT_OPERATIONAL_LISTS`, since every read silently falls back to it — §7).
`FeatureGate`/`usePlanFeatures`: `DERIVED` from Stripe subscription data (real), with a `HARDCODED_
FRONTEND` fallback (`STARTER_FEATURES`) when no subscription exists, and an `AUTH_DISABLED`-mode
short-circuit that returns all-true (dev/bypass only, not a production path).

## 4. Branding / Logo upload — SETTINGS_PERSISTENCE_GAP, confirmed broken end-to-end

`LogoUploader.tsx` → `company-logo.service.ts` — real client-side defense (MIME + extension allowlist
**plus magic-byte sniffing** for PNG/JPEG/WEBP, genuinely blocking disguised executables, confirmed
directly). `saveLogo()` POSTs multipart to `POST /api/v1/workspaces/{workspaceId}/logo`. **This
endpoint does not exist anywhere in `apps/api/src/modules`** (confirmed: no controller registers a
`workspaces/:id/logo` route). The service file's own header comment admits this is aspirational:
*"CONTRATO BACKEND (futuro): … Endpoints abaixo serão implementados no backend posteriormente."*
Every real logo upload attempt will fail with a network 404. The storage *target* already exists —
`organizations.config.logoUrl`/`faviconUrl`/`colors` are already accepted by `UpdateCompanySettingsDto`
and already read/written by `company-settings.service.ts` — but nothing wires an actual file (e.g. via
the real, working R2-backed `apps/api/src/modules/uploads/uploads.controller.ts`) into that field. No
favicon/colors UI exists in `Configuracoes.tsx` at all despite the DTO already supporting them.
`BRANDING_GAP: 1` (upload path), plus `UNUSED_SETTING_GAP: 2` (`faviconUrl`/`colors` — backend-ready,
zero UI).

## 5. Notification settings — a real backend and a real UI that never speak to each other

Backend (`apps/api/src/modules/notifications/notification-settings.service.ts`) is genuinely
well-built: per-key config-schema validation, persisted to `notification_settings` (tenant-scoped, one
row per `(tenant_id, notification_key)` — **not** per-user, 14 real keys), fully audit-logged on every
update. **Confirmed zero references anywhere in `apps/web/src`** to `/notifications/settings`,
`notification-settings`, or `NotificationSetting` — the real endpoint is never called by any frontend
code. Instead, `Configuracoes.tsx`'s "Automações" tab reads/writes `useUserSettings` — pure
`localStorage`, per-browser, with toggle keys that superficially resemble (but don't literally match)
the backend's 14 keys. Confirmed directly: 4 of the visible switches in this tab are **hardcoded
`<Switch checked={true} />` with no `onCheckedChange` handler at all** — "Contrato vencido" (line 1079),
"Lembretes semanais automáticos" (1160), "Alertas críticos do sistema" (1179), "Notificações
operacionais" (1186) — permanently ON, non-interactive, decorative. The "SMS" channel toggle is
`checked={false} disabled` — permanently inert in the other direction.

Separately, and independently: **the one real email-sending path found** (`apps/api/src/queues/
processors/email.processor.ts`, the `contract_expiring` job) sends unconditionally — it never checks
`notification_settings.enabled` before dispatching. `NotificationSettingsService` is confirmed used only
within its own module's controller/DTO — no producer anywhere reads it before sending.

**Conclusion, both directions confirmed independently**: the UI writes to a location the backend never
reads (localStorage); the backend has a real, validated settings store that nothing — neither the UI nor
the one confirmed notification producer — ever reads either. `NOTIFICATION_SETTINGS_GAP: 1` (systemic:
the entire preference concept is decorative end-to-end), `FAKE_SETTINGS_SAVE_GAP: 4` (the 4 hardcoded
switches specifically).

## 6. User preferences — scope confusion, `LOCAL_STORAGE_GAP`

`useUserSettings` persists **everything** — `full_name`, `phone`, `cargo`, `setor`, `avatar_url`
(confirmed: raw base64 data-URL from `Perfil.tsx`, potentially multi-MB strings), every notification/
automation toggle, and — critically — the **organization's public-registration slug**
(`saveOrgSlug()`, key `musicos360_org_slug:<user.id>`) — entirely to `localStorage`, keyed per-**user**,
with **no backend table backing any of it** (confirmed: no `user_settings`/`user_preferences` entity
exists anywhere in `entities.ts`). `full_name`/`avatar_url`/`phone` are the only fields with any
server-side echo at all, and only indirectly — via `getSupabaseClient().auth.updateUser({data:...})`
syncing into Supabase's own `user_metadata`, not this app's database.

**`LOCAL_STORAGE_GAP`, business-critical**: `organizations.slug`/`tenants.slug` are real, unique DB
columns, and the public-registration backend (`public-registration.controller.ts`,
`leads.service.ts:137`) genuinely resolves workspaces by slug server-side — but the admin-facing UI for
*setting* that slug (`saveOrgSlug`) writes only to one specific user's browser localStorage, never to
any backend endpoint. If a different admin opens `Configuracoes.tsx`, `orgSlug` reads back empty even
if the tenant already has a real slug in the database — the UI's view of "does this tenant have a
public registration link" is **per-admin-browser**, not per-tenant, despite representing genuinely
tenant-wide, business-critical configuration. Classified `LOCAL_STORAGE_GAP` (severity: high — this is
exactly the "empresarial crítico que vive apenas em localStorage" scenario the audit brief calls out
explicitly as a mandatory gap).

`USER_SCOPED` vs `TENANT_SCOPED` boundary is genuinely blurred in the UI's own mental model: the
"Automações" tab lives inside the **admin-only** `Configuracoes.tsx` page but is backed by a
**per-browser** hook (`useUserSettings`), while the real backend concept it superficially resembles
(`notification_settings`) is **tenant-wide**. Neither side's scope matches the other's, independent of
the fact they're also disconnected (§5).

## 7. Operational lists — deliberately, honestly stubbed (not a fake-success pattern)

`useOperationalSettings.ts` (lead types, lead statuses/segments, contact classifications, event types,
marketing task types, briefing types, "creative AI" settings — 14 configurable lists consumed across
`leads`/`events`/`marketing`) routes through `settings.service.ts`, whose `getX`/`saveX` methods wrap
`storage.getRaw`/`setRaw` — confirmed directly, these **always throw**
(`storage.ts`'s own `IntegrationError`). `settingsService`'s `safeGetRaw`/`safeSetRaw` wrappers catch
this and silently no-op, per the file's own extensive header comment, which explicitly documents *why*:
a prior crash (a `removeChild` React tree failure reproduced when `useOperationalSettings` was called
synchronously inside `useState(() => ...)`) forced this fail-silent design, and the comment explicitly
states the intended classification is *"não suportado," não "sucesso fabricado"* ("unsupported," not
"fabricated success") — i.e., this is a deliberate, self-aware `NOT_IMPLEMENTED` marker, not a disguised
fake-success bug, unlike several patterns found elsewhere this session. Cross-confirmed against the DB
mapping: `operational_list_items` is a real, migrated table with **every column tagged
`NO_TABLE_CONSUMER`** — the table exists, nothing reads or writes it anywhere in `apps/api/src`.
`SETTINGS_PERSISTENCE_GAP: 14` (one per configurable list — every `createItem`/`updateItem`/
`toggleItem`/`removeItem`/`moveItem` silently no-ops).

## 8. Security settings — mostly inert, one real duplicate

| Feature | UI | Real? |
|---|---|---|
| Change password | `Configuracoes.tsx` "Segurança" | **YES** — calls `useAuth().updatePassword()` → Supabase Auth |
| Change password (2nd copy) | `Perfil.tsx` "Segurança" card | **NO** — static `<div>`, no `onClick` at all |
| 2FA/MFA ("Configurar") | both pages | **NO** — button has no `onClick`; no TOTP/WebAuthn endpoint exists anywhere in the codebase |
| Active sessions list | `Configuracoes.tsx` | **NO** — entirely hardcoded (`"Chrome • Windows • São Paulo, BR"`, static "Ativa" badge) |
| "Encerrar Todas as Outras Sessões" | `Configuracoes.tsx` | **NO** — no `onClick` |
| Delete account ("Zona de Perigo") | `Configuracoes.tsx` | **NO** — no `onClick` |
| "Histórico de Login" | `Perfil.tsx` | **NO** — inert `<div>` |

`SECURITY_SETTINGS_GAP: 6` (every item above except password change). The one real capability
(password change) is a legitimate pass-through to Supabase Auth, not re-implemented — appropriately
not re-audited here per the instruction not to re-audit `auth`.

## 9. Billing — real Stripe core, fragmented across three UIs, one missing endpoint

Real, confirmed: Stripe SDK genuinely used (`billing.service.ts`), real checkout/portal/webhook-HMAC
flow, real `BillingEnforcementService` grace/read-only/suspend state machine driven by actual Stripe
webhook events.

**Three separate, inconsistent billing surfaces confirmed to coexist**:
1. `Configuracoes.tsx` "Billing" tab — dynamic, backend-driven plans (`GET /billing/plans`) — correct
   architecture, but its invoice list calls `GET /billing/invoices`, **which does not exist on the
   backend** (confirmed directly: `billing.controller.ts` only exposes `GET /billing/admin/invoices`,
   super_admin-gated). Every regular admin's "Histórico de Faturas" table is **permanently empty by
   construction** — indistinguishable in the UI from "no invoices yet," masking a missing endpoint
   rather than reflecting real data. `REAL_MAPPING_GAP: 1`.
2. Standalone `Billing.tsx` (`/configuracoes/billing`) — **hardcoded** `PLANS` array with baked-in
   prices (`R$ 299`/`R$ 799`/"Consultar") — directly contradicting the codebase's own governance
   comment in `billing-plans.service.ts` ("planos… NÃO podem ser hardcoded na tela"). Uses real Stripe
   checkout/portal calls once the (wrong) plan is selected.
3. `BillingBlockedPage.tsx` — a third, minimal surface for the suspended/overdue state — legitimately
   real and distinct in purpose, not a duplicate.

Additionally confirmed **entirely fake**: the "Método de Pagamento" card in the `Configuracoes.tsx`
tab shows a static `•••• •••• •••• 4242`/`"Expira 12/2027"` card with no `paymentMethod` fetched from
anywhere — pure decoration. "Gerenciar Assinatura"/"Adicionar Assentos"/"Fazer Upgrade" buttons in that
same tab call `toast.info(...)` pointing to email support rather than the real
`stripeClient.createCheckout`/`openPortal` calls that genuinely exist and are used correctly one file
over in `Billing.tsx` — a real capability, present in the codebase, simply not wired to these specific
buttons. `FAKE_SETTINGS_SAVE_GAP: 1` (payment method card), `SETTINGS_CONSUMER_GAP: 3` (the three
toast-only buttons that could call real functions but don't).

## 10. Localization — persisted, zero UI, zero consumer

`company-settings.service.ts` stores `timezone`/`currency`/`language` in `tenants.settings` jsonb — the
*only* real backend surface for localization, fully functional (`GET`/`PATCH /company-settings` both
handle it). **`Configuracoes.tsx` never renders any language/timezone/currency form field anywhere** —
the "Empresa" tab only exposes Razão Social/Nome Fantasia/CNPJ/Endereço/Telefone/Responsável/Slug.
Confirmed no consumer: grepping `accounting`/financial modules for any read of `tenants.settings` or a
tenant-scoped `currency` value found nothing — currency formatting throughout the codebase uses a fixed
`pt-BR`/`BRL` convention (e.g. `BillingBlockedPage.tsx` hardcodes `currency: "BRL"` directly).
Classified `UNUSED_SETTING_GAP: 3` (`timezone`, `currency`, `language` — each has a real DB column and a
real update path, but no UI writer and no runtime reader anywhere in the product).

## 11. Public Registration tab — UI lags a real, already-shipped backend

`Configuracoes.tsx`'s "Cadastro Público" tab disables its "Gerar link"/"Regenerar slug"/"Revogar link"
buttons with the tooltip *"Disponível quando o backend de cadastro público estiver ativo"* (confirmed
directly, 3 occurrences) — but `public-registration.controller.ts` and `leads.service.ts` already
implement and actively track `allow_public_registration`, `public_registration_blocked`,
`public_registration_access_count`, `public_registration_conversion_count` server-side, all real
`tenants` columns. This is the **inverse** of the pattern found almost everywhere else this session
(frontend ahead of a missing/broken backend) — here the **backend shipped and the frontend copy was
never updated to match**, leaving working functionality artificially gated off. Combined with §6's
finding that the slug itself is only ever set in localStorage (never sent to this real backend at all),
the net effect is the same regardless of direction: public registration cannot actually be configured
through the real UI today. Classified `SETTINGS_CONSUMER_GAP: 1` (UI doesn't call an available backend)
+ compounds the `LOCAL_STORAGE_GAP` from §6.

## 12. Feature flags / module gating — UI-only, not backend-enforced

`FeatureGate` wraps 13 pages across `accounting`(4)/`events`/`inventory`/`licensing`/`marketing`(5)/
`monitoring`(3)/`rh` — driven by `usePlanFeatures()`, itself derived from the real Stripe subscription
(`billing_plans.features`) with a hardcoded `STARTER_FEATURES` fallback and an `AUTH_DISABLED`-mode
all-true bypass (dev-only). **Confirmed zero backend enforcement**: grepping
`moduleRh|moduleMarketing|moduleAccounting|PlanFeatures` across all of `apps/api/src` returns hits only
in the billing migration seed data and `billing.service.ts`'s own plan-definition maps — **no NestJS
guard anywhere checks a tenant's plan/feature entitlement before serving any module's actual API**.
Disabling a "module" via plan downgrade only hides its `FeatureGate`-wrapped page; the underlying REST
endpoints for that module remain fully reachable via direct API calls, subject only to whatever
independent `@RequireRole` guard each endpoint already has. Classified `FEATURE_ENFORCEMENT_GAP: 1`
(systemic — applies uniformly to all 13 gated pages, not each counted separately, since the root cause
is identical: no backend entitlement check exists at all).

**Separately confirmed, concrete navigation bug**: `FeatureGate`'s "Ver planos e fazer upgrade" button
navigates to `/settings/billing` — **this route is not registered anywhere**
(`settings.routes.tsx` confirmed to only register `/configuracoes`, `/settings/roles`,
`/settings/permissions`, `/perfil`, `/usuarios`, `/configuracoes/billing`, `/onboarding`, `/auditoria`
— no `/settings/billing`). Every one of the 13 `FeatureGate`-gated pages' upgrade prompt links to a
dead route. Classified `REAL_MAPPING_GAP: 1` (a single root cause, systemically affecting all 13 gates).

Genuine backend-enforced gating **does** exist, but along a different axis entirely — payment-status
(`grace`/`read_only`/`suspended`, `BillingEnforcementService`, real, tenant-wide), not per-module
feature flags. Not conflated with the above.

## 13. Integrations tab — confirmed as a genuine shared surface, not a stale duplicate

The "Integrações" tab's 18-provider grid uses the **same real per-provider hooks** already audited in
`integrations.md` (`useAbramusStatus`, `useEcadStatus`, `useAutentiqueStatus`, `useClicksignStatus`,
`useSpotifyStatus`, etc.) and imports the same dialog components directly from
`@/modules/integrations/components/*` — this is the actual entry point rendering the integrations
module's own UI, not a disconnected mirror requiring separate re-verification. One exception: DocuSign's
"connected" state is tracked in `sessionStorage` (not the real per-provider hook pattern used by every
other integration on this tab) — resets on new browser session, no backend persistence — a narrower,
single-provider version of the same local-storage-for-tenant-state pattern flagged in §6.
The separate "Distribuidoras" card (6 static portal links) matches `releases.md`'s and
`integrations.md`'s own prior finding — confirmed STUB, not re-litigated here.
The "Website / Captação de Leads" snippet dialog hands out code templates referencing a **placeholder**
org id (`ORG_musicos360_abc123`) rather than the real tenant/org id — the generated snippets are
non-functional templates, not tenant-specific working code. `INTEGRATIONS_SETTING_GAP` (informal,
mapped under `REAL_MAPPING_GAP`): 1 (lead-capture snippet uses a placeholder ID, not the real one).
`CREDENTIALS_TO_ADD_NOW: 0` — no credential was added or requested in this audit.

## 14. RBAC / Access ("Usuários" tab) — shared source of truth, not re-audited

`useRoles`/`useUsuarios` talk to the real RBAC backend (`rbac-admin.controller.ts`) — the same system
already implicitly covered by the auth/RBAC infrastructure used throughout every other module's
`@RequireRole` guards. UI and backend are confirmed to use the same endpoints (not a parallel/duplicate
source of truth). Not re-audited in depth per the prompt's explicit instruction.

## 15. Dead code inventory

- `AuditTrail.tsx` + `useAuditTrail.ts` — fully built (search/filter/diff viewer over a real,
  backend-wired hook) but **zero route references it anywhere** — confirmed the routed `/auditoria`
  page is a structurally different component (`admin/pages/Auditoria.tsx`, the data-completeness
  checker, unrelated).
- `hooks/settings.store.ts` (`useSettingsStore`, Zustand) — defined, zero importers anywhere outside
  itself — same dead-store pattern found in `projects`/`releases`/`catalog` this session.

## 16. Tenant Isolation & Permissions

`company-settings` endpoints: `@RequireRole('admin')` on both GET and PATCH, tenant scoping enforced
server-side (frontend cannot select an arbitrary tenant — confirmed by direct reading, consistent with
every other module's pattern this session). `notification_settings` endpoints: `viewer`(GET)/`admin`
(PATCH) — appropriately tiered even though unreachable from the real UI (§5). Billing admin-only routes
(`/billing/admin/*`) are `super_admin`-gated, distinct from tenant-scoped billing routes. `AUTHORIZATION_
GAPS: 0` — every endpoint found is guarded, none unguarded. `TENANT_ISOLATION_GAPS: 0` at the backend
layer for every real endpoint — the actual isolation failures found in this module (§6, §11) are
**client-side scope errors** (per-user-browser storage standing in for per-tenant server data), not
backend cross-tenant leakage; classified separately as `LOCAL_STORAGE_GAP`, not
`TENANT_ISOLATION_GAP`, since no other tenant's data is ever at risk — only the *acting* tenant's own
configuration is misplaced.

## 17. Gap taxonomy summary

| Gap type | Count | Detail |
|---|---|---|
| SETTINGS_PERSISTENCE_GAP | 15 | logo upload (§4, 1) + 14 operational lists (§7) |
| NOTIFICATION_SETTINGS_GAP | 1 | systemic, both directions disconnected (§5) |
| FAKE_SETTINGS_SAVE_GAP | 5 | 4 hardcoded switches (§5) + payment method card (§9) |
| LOCAL_STORAGE_GAP | 1 | org slug + all "user preferences," business-critical (§6) |
| SECURITY_SETTINGS_GAP | 6 | 2FA, sessions, delete account, duplicate inert password card, login history (§8) |
| REAL_MAPPING_GAP | 4 | broken invoices endpoint (§9); FeatureGate dead route, systemic across 13 pages (§12); public-registration UI-lag (§11); lead-capture snippet placeholder ID (§13) |
| SETTINGS_CONSUMER_GAP | 4 | 3 billing toast-only buttons that could call real functions (§9) + public-registration tab not calling its live backend (§11) |
| BRANDING_GAP | 1 | logo upload endpoint doesn't exist (§4) |
| UNUSED_SETTING_GAP | 5 | faviconUrl/colors (2, §4) + timezone/currency/language (3, §10) |
| FEATURE_ENFORCEMENT_GAP | 1 | systemic — no backend entitlement check across all 13 FeatureGate pages (§12) |
| CREDENTIAL_STORAGE_GAP | 0 | none found — no secret is stored in a common/shared field (§4/§9 gaps are missing endpoints, not credential-handling errors) |
| SETTINGS_CACHE_INVALIDATION_GAP | 0 | no settings-specific cache layer found to have this problem |
| AUTHORIZATION_GAP | 0 | confirmed sound (§16) |
| TENANT_ISOLATION_GAP | 0 | confirmed sound at the backend layer (§16) |

`UNMAPPED_*: 0` — every editable field's origin/destination/consumer was traced, even where the trace
terminates in "never persisted" or "persisted but never read."

## 18. Overall assessment

`settings` is the broadest, most fragmented module audited this session — not because any single flow
is as acutely broken as `releases`' or `rh`'s create paths, but because it aggregates **five
independent categories of gap** across its many tabs: (a) a real backend nobody calls
(notifications), (b) a real backend call target that doesn't exist (logo upload, billing invoices), (c)
deliberately-stubbed features that honestly no-op rather than fake success (operational lists — the one
genuinely well-handled gap in the module), (d) business-critical tenant configuration trapped in
per-user browser storage (org slug), and (e) UI that lags behind an already-shipped backend (public
registration). Security and RBAC/access are, by contrast, largely sound or appropriately deferred to
Supabase Auth. Tenant isolation and authorization are confirmed sound throughout at the backend layer.

## Contadores finais (Zero-Gap)

```
MODULE_STATUS: COMPLETE
SETTINGS_DOMAIN_MEANING: multi-surface configuration hub (TENANT_PROFILE, USER_PREFERENCES,
  NOTIFICATIONS, SECURITY, ACCESS, INTEGRATIONS, LOCALIZATION, BILLING, FEATURE_CONFIGURATION,
  PUBLIC_REGISTRATION) — no single backend `settings` module exists; frontend aggregates several
  independently-real backend modules plus one deliberately-stubbed local concept
SUBDOMAINS_AUDITED: 10
TABS_SECTIONS_AUDITED: 7 (Configuracoes.tsx) + 3 standalone pages (Perfil, Usuarios, Billing) + 2 dead
  (AuditTrail, unused Zustand store)
COMPONENTS_AUDITED: 9
HOOKS_AUDITED: 7
EDITABLE_FIELDS: company profile (7) + branding (3, broken) + user prefs (16, localStorage-only) +
  operational lists (14, no-op) + notification keys (14, disconnected) + billing (0 directly editable,
  action-buttons only)
TENANT_SCOPED_FIELDS: company profile (7) + localization (3) + notification_settings (14)
USER_SCOPED_FIELDS: 0 real (no backend user_settings table exists — all 16 "user" fields are
  localStorage-only, not server-persisted at any scope)
GLOBAL_PLATFORM_FIELDS: billing_plans (not editable via Settings UI, admin/super_admin billing routes only)
BRANDING_FIELDS: 3 (logoUrl broken; faviconUrl/colors backend-ready, no UI)
NOTIFICATION_SETTING_FIELDS: 14 (real backend) + ~10 (localStorage mirror, distinct field names)
SECURITY_SETTING_FIELDS: 7 (1 real — password; 6 inert)
INTEGRATION_SETTING_FIELDS: 18 providers + 6 distributors (shared with integrations module)
LOCALIZATION_FIELDS: 3 (timezone, currency, language — persisted, zero UI, zero consumer)
FINANCIAL_SETTING_FIELDS: 0 (not a settings concept in this codebase — accounting has its own
  categories/rules module, not reauditado here)
BILLING_SETTING_FIELDS: real (plans/subscription/checkout/portal) + 1 broken (invoices) + 1 fake
  (payment method display)
FEATURE_FLAG_FIELDS: 13 (FeatureGate-wrapped pages, plan-derived, UI-only enforcement)
STORAGE_FIELDS: 1 (logo, broken upload target)
SECRET_FIELDS: 0 directly administered by Settings UI (no API key/token/SMTP-password field found
  anywhere in this module's own forms)
LOCAL_STORAGE_KEYS: 4 (musicos360_user_settings:<id>, musicos360_org_slug:<id>,
  musicos360_current_tenant, musicos360_external_oauth_connections [sessionStorage])
REAL_RUNTIME_CONSUMERS: company profile (yes), billing plans/subscription (yes), RBAC (yes),
  integrations status (yes) — notification prefs (no), operational lists (no), localization (no)
FUNCTIONAL_SAVE_FLOWS: 2 (company profile; password change)
PARTIAL_SAVE_FLOWS: 1 (billing tab — plan/checkout real, invoices/payment-method broken/fake)
FAKE_OR_NOOP_SAVE_FLOWS: 5 (logo upload, notification toggles, operational lists, org slug, 6 security items)
CREDENTIALS_TO_ADD_NOW: 0
CREDENTIALS_REQUIRED_LATER: 0 (no new integration was scoped in this audit)
PERMISSIONS_AUDITED: 6 (company-settings GET/PATCH; notification-settings GET/PATCH; billing tenant vs
  super_admin tiers)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0
CODE_FIELD_ONLY: 0
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 0
ENUM_MISMATCH: 0
RELATION_MISMATCH: 0
READ_MAPPING_MISMATCH: 0
WRITE_MAPPING_MISMATCH: 0
DISPLAY_MAPPING_MISMATCH: 0
SETTINGS_PERSISTENCE_GAPS: 15
SETTINGS_CONSUMER_GAPS: 4
FAKE_SETTINGS_SAVE_GAPS: 5
LOCAL_STORAGE_GAPS: 1
BRANDING_GAPS: 1
STORAGE_GAPS: 1
NOTIFICATION_SETTINGS_GAPS: 1
SECURITY_SETTINGS_GAPS: 6
FEATURE_ENFORCEMENT_GAPS: 1
CREDENTIAL_STORAGE_GAPS: 0
UNUSED_SETTING_GAPS: 5
SETTINGS_CACHE_INVALIDATION_GAPS: 0
REAL_MAPPING_GAPS: 4
UNMAPPED_SETTINGS_FIELDS: 0
UNMAPPED_READ_FIELDS: 0
UNMAPPED_WRITE_FIELDS: 0
UNMAPPED_RUNTIME_CONSUMERS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNMAPPED_SECRET_FIELDS: 0
UNMAPPED_INTEGRATION_ACTIONS: 0
UNKNOWN_SETTING_CLASSIFICATIONS: 0
```

NEXT_MODULE: support

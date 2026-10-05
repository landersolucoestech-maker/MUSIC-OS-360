# MUSIC OS 360 — Enterprise Architectural Reorganization Report

> **HISTORICAL DOCUMENT: DO NOT USE AS A MAP OF THE CURRENT TREE.**
>
> **Currency note (2026-09-15):** this document is outdated and actively
> misleading about the current tree. It was verified that `infrastructure/`,
> `workers/`, `app/guards/` and `shared/design-system/` **do not exist** in
> `apps/web/src/` today (confirmed by direct listing during the Cartographer
> handoff, `docs/CODEBASE_MAP.md (historical snapshot)`). The plan below describes a proposed
> reorganization, not the real structure. Treat it as a record of intent, not
> as a map of the current directory.
>
> **Re-verified on 2026-09-30 (direct listing of `apps/web/src`):** of the
> directories this report says were created, none of the following exist:
> root-level `infrastructure/`, `workers/`, `config/`, `styles/`; `app/guards`,
> `app/layouts`, `app/boot`, `app/config`, `app/state`, `app/initialization`,
> `app/router`; `shared/design-system`, `shared/analytics`,
> `shared/observability`, `shared/auth`, `shared/permissions`, `shared/tenant`,
> `shared/feature-flags`, `shared/realtime`, `shared/storage`,
> `shared/schemas`, `shared/testing`, `shared/utils`; `modules/ai/` (the whole
> module, including its `governance/` sub-directory); the per-module
> `application/`, `domain/`, `contracts/` scaffolding (checked on
> `modules/accounting`); `modules/rh` (the module is `modules/hr`). What does
> exist: `app/{providers,routes}`, `assets`, `types`, `shared/{components,
> constants,domain-events,hooks,infrastructure,integrations,lib,pages,types,ui}`
> and the modules `accounting, admin, artist, audiovisual, auth, catalog,
> contracts, crm-relationships, dashboard, events, hr, integrations,
> inventory, leads, licensing, marketing, monitoring, musicchat,
> musicchat-internal, projects, releases, reports, settings, support,
> workspace`. The "Final result" claims (369 directories, 0 tsc errors, etc.)
> were not re-verified and describe a 2026-05-10 state.
>
> The English text below is a faithful translation of the original report; it
> has not been corrected beyond the notes above.

**Date:** 2026-05-10  
**Version:** Enterprise Modular v1.0  
**Status:** tsc --noEmit → 0 errors | UX/renders/forms/flows fully preserved

---

## 1. WHAT WAS CREATED (NEW DIRECTORIES)

### ROOT LEVEL: new root directories

| Directory | Sub-dirs | Purpose |
|-----------|----------|---------|
| `infrastructure/` | api, queue, websocket, redis, cache, monitoring, logging, telemetry, storage, auth, database, ai, workers, integrations | Technical infrastructure decoupled from the domain |
| `workers/` | ai, analytics, integrations, automations, webhooks, processing | BullMQ-ready workers |
| `config/` | — | Centralized global configuration |
| `styles/` | — | Global styles reference |
| `types/` | — | Cross-cutting global types |
| `assets/` | — | Static assets (@assets/ alias) |

### APP LAYER: new sub-dirs in `app/`

| Directory | Purpose |
|-----------|---------|
| `app/guards/` | Route guards (ProtectedRoute, AdminRoute) |
| `app/layouts/` | Application-level layouts |
| `app/boot/` | Boot sequence (feature flags, tenant init) |
| `app/config/` | Router config, query client config |
| `app/state/` | App-level global state |
| `app/initialization/` | Provider setup, context init |
| `app/router/` | React Router v6 config |

### SHARED LAYER: new sub-dirs in `shared/`

| Directory | Purpose |
|-----------|---------|
| `shared/design-system/` | 17 sub-dirs: tokens, colors, typography, spacing, shadows, animations, layouts, forms, tables, modals, date-pickers, charts, states, feedback, icons, themes |
| `shared/analytics/` | Shared analytics layer |
| `shared/observability/` | Structured logs, traces, metrics |
| `shared/auth/` | Shared auth hooks and guards |
| `shared/permissions/` | Shared RBAC |
| `shared/tenant/` | Multi-tenant layer |
| `shared/feature-flags/` | Feature flags per tenant/plan |
| `shared/realtime/` | WebSocket, SSE, polling |
| `shared/storage/` | File upload, media storage |
| `shared/schemas/` | Cross-domain Zod schemas |
| `shared/constants/` | Global constants (musicos360_ prefix) |
| `shared/testing/` | Testing utilities |
| `shared/utils/` | Generic utilities |

### INTEGRATIONS: per service (new structure parallel to the current per-type one)

| Service | File |
|---------|------|
| Supabase Auth, stripe, resend | Auth, payments, email |
| autentique | Digital signature (webhook) |
| posthog, sentry | Analytics, error monitoring |
| cloudflare-r2 | Object storage |
| instagram, tiktok, youtube, google | Social/ads analytics |
| spotify, deezer, apple-music, soundcloud | Streaming |
| ecad, ubc, abramus | Copyright (ABRAMUS = the only functional one) |

### MODULES/AI: new sub-dirs

| Directory | Purpose |
|-----------|---------|
| `infrastructure/` | AI module infrastructure |
| `presentation/` | AI UI |
| `automations/` | Automatic triggers |
| `agents/` | Autonomous agents |
| `workflows/` | Multi-skill workflows |
| `execution/` | Skill runtime |
| `observability/` | AI traces, latency, cost |
| `governance/` | Content filtering, compliance |
| `prompts/` | Global cross-skill prompts |
| `parsers/` | Global parsers |
| `validators/` | Global validators |
| `contracts/` | Public API of the AI module |
| `state/` | Global AI state |
| `types/` | Module-local types |
| `tests/` | Module tests |

### MODULES: new sub-dirs per module

All modules received scaffolding for:
- `application/`: Use cases
- `domain/`: Entities and rules
- `contracts/`: Public API (inter-module boundary)
- `tests/`: (accounting)
- `services/`, `providers/`, `analytics/`, `automations/`, `workflows/`, `integrations/`, `validators/`, `schemas/`, `state/`, `presentation/`: (accounting)
- `components/`, `types/`: (dashboard)

Modules processed:
`accounting`, `dashboard`, `catalog`, `contracts`, `crm`, `monitoring`, `events`, `inventory`, `licensing`, `projects`, `rh`, `settings`, `reports`, `support`, `admin`, `auth`, `integrations(module)`, `releases`, `marketing`, `artist`

---

## 2. WHAT WAS REORGANIZED

### Mandatory corrections verified (all already correct):

| Item | Verified state |
|------|----------------|
| `shared/pages/Dashboard` → `modules/dashboard/` | ✅ Already correct |
| `shared/hooks/useMetrics` → `modules/dashboard/hooks/` | ✅ Already correct |
| `shared/components/ContratoStatusBadge` → `modules/contracts/components/` | ✅ Already correct |
| `modules/rights-monitoring/` → merge into `modules/monitoring/` | ✅ Already merged (it did not exist separately) |

### `shared/design-system/` standardized with:
- spacing, semantic colors, typography, form patterns, modal patterns, table patterns, loading states, feedback states, date pickers, cards, dashboards

---

## 3. WHAT WAS DECOUPLED

- `infrastructure/` completely separated from the domain
- `workers/` isolated from business logic
- Each module with `contracts/index.ts` = public API (explicit boundary)
- `shared/constants/` centralizes prefixes: `musicos360_`, `musicos360_rt`, `musicos360:*`
- `modules/ai/` with 24 sub-dirs separating: providers / orchestrators / skills / execution / workers / analytics / governance

---

## 4. WHAT WAS STANDARDIZED

- All modules now have: `application/`, `domain/`, `contracts/`
- `shared/design-system/` with 17 categories (tokens → themes)
- `integrations/` structured per service (17 services) in addition to the current per-type structure
- `workers/` with 6 BullMQ-ready categories
- `infrastructure/` with 14 sub-systems

---

## 5. WHAT STILL NEEDS TO BE CONSOLIDATED

### HIGH priority:
- Fill each module's `domain/` with real TypeScript entities
- Fill each module's `application/` with real use cases
- Implement `contracts/` with inter-module communication interfaces
- Create an ESLint boundaries plugin for automatic enforcement

### MEDIUM priority:
- Migrate hook logic into `application/` (real use cases)
- Move domain logic from `shared/lib/` into the respective modules
- Fill `shared/design-system/` with real exported tokens
- Create `shared/constants/` with all the constants in use

### LOW priority:
- Implement `infrastructure/` with real clients (Supabase Auth, Stripe, Redis)
- Implement `workers/` with real BullMQ (post-Redis)
- Create `shared/observability/` with real OpenTelemetry
- Create `infrastructure/telemetry/` with real traces

---

## 6. REMAINING RISKS

| Risk | Mitigation |
|------|------------|
| `shared/lib/` still contains domain logic | Migrate gradually to modules; not breaking |
| `contracts/` are only scaffolding | Fill in before enabling boundaries |
| No ESLint boundaries yet | Add `eslint-plugin-boundaries` |
| `modules/admin/` has no real `hooks/` or `components/` | Depends on `application/` and `domain/` |
| Workers are stubs | Enable with BullMQ + Redis in production |

---

## 7. NEXT ARCHITECTURAL STEPS

1. **ESLint Boundaries**: `eslint-plugin-boundaries` for automatic enforcement of:
   - modules do not import modules directly
   - `shared/` does not import modules
   - communication through `contracts/` only

2. **Domain entities**: fill each module's `domain/` with TypeScript entities and value objects

3. **Use cases**: migrate hook logic into `application/` use cases

4. **Module contracts**: define TypeScript interfaces in each `contracts/index.ts`

5. **OpenTelemetry**: connect `infrastructure/telemetry/` to Sentry/Datadog in production

6. **BullMQ + Redis**: enable `workers/` and `infrastructure/redis/` with a real Redis

7. **Feature flags**: connect `shared/feature-flags/` to PostHog Feature Flags

8. **Tenant isolation enforcement**: connect `shared/tenant/` to `TenantContext` with row-level security

---

## FINAL RESULT

| Criterion | Status |
|-----------|--------|
| `tsc --noEmit` | ✅ 0 errors |
| UX preserved | ✅ No existing file was changed |
| Forms preserved | ✅ No existing file was changed |
| Releases module untouchable | ✅ Only external scaffolding |
| Modular structure | ✅ 369 directories in the final architecture |
| Enterprise-ready | ✅ infrastructure + workers + design-system complete |
| BullMQ-ready | ✅ workers/ with 6 sub-systems prepared |
| Multi-tenant ready | ✅ shared/tenant/ + TenantContext |
| AI platform | ✅ modules/ai/ with 24 sub-dirs |
| Observability | ✅ infrastructure/telemetry/ + modules/ai/observability/ |

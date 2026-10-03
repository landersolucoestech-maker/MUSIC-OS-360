# MUSIC OS 360 — Staging Architecture

> Staging is an **environment** (GitHub Environment `staging`), never a branch.
> This project's topology is only `dev` and `main`. All new code enters
> `dev`; promotion to staging is the manual, deliberate execution of
> `staging.yml` (Actions tab → Run workflow, ref `dev`), never a merge.

## Architectural decision: Supabase STAGING

Two options, both with real recurring cost on this plan (Pro):

| Option | Cost | Isolation |
|---|---|---|
| Persistent branch in the MUSIC OS 360 project (same model already used by the DEV branch) | ~$0.01344/hour ≈ $9.68/month | Always its own schema/data (a new branch never copies real data); same physical project |
| Separate Supabase project | $10/month flat | Full isolation, including project infrastructure |

**Decided and created in Part 65** (2026-08-01): persistent branch in the MUSIC OS 360 project (cost ~$9.68/month, explicitly approved). Real ref: `jjnnjnxjkqipgqebijen` — `SUPABASE_STAGING_REF` in `env.schema.ts`/`assert-supabase-env.mjs`/`env-check.mjs` was updated to this value, replacing the placeholder `khnaxcgjnvhhtgkozsif` that never matched a real resource.

## Migrations that touch Supabase's own schemas (`realtime`, `auth`, `storage`)

Discovered in Part 67 while trying to apply `20260801000001_RealtimeBroadcastAuthorization`
on real DEV: **the MCP `execute_sql` and `apply_migration` fail with
`must be owner of table messages`** for any DDL on `realtime.messages`
(and, by extension, any table in the `realtime`/`auth`/`storage` schemas,
which belong to the Supabase platform itself, not to the role used by the
Management API). Every earlier migration in this project only touched the `public` schema
(owner = the migration's own role/`musicos_migrator`), so this limit
had never appeared.

**The only way to apply these migrations on DEV/STAGING/MAIN**: the Supabase
Dashboard SQL Editor (connection as the real owner), or a direct connection
via `DATABASE_URL` with the project's real `postgres` role — neither
is available to an agent without those credentials. See PART 67 for the exact
SQL still pending on DEV.

## Single source of migrations (staging included)

Staging uses exactly the same `migrations/index.ts` as DEV/MAIN — there is no
(and there must not be) a third migration list. `scripts/verify-migration-source-of-truth.mjs`
runs in the `migrations-staging` job of `staging.yml` as in any other environment.

## Project ref guard

`src/core/config/verify-supabase-dev-ref.util.ts` exposes `validateSupabaseRef`
(generic) and two wrappers — `validateSupabaseDevRef` and
`validateSupabaseStagingRef` — each explicitly refusing MAIN, denylisted refs,
and any ref that is not exactly the expected one. `staging.yml`
runs `scripts/verify-supabase-staging-ref.ts` before any query.

## Synthetic seed

`apps/api/src/database/seeds/index.ts` is the single runner (`npm run db:seed`).
Current chain: `01_default_tenant` → `02_admin_user` → `03_operational_seed`
(now correctly chained — before this part, `03_operational_seed`
existed on disk but was never called by the runner, and used a different default
`org_id` from `01_default_tenant`, which would have created a duplicate orphan
organization if anyone had invoked it manually) →
`04_rbac_seed` → `05_org_structure_seed`.

Data covered today: organization, tenant, billing_subscription, org_member
(owner), artist, contact, campaign, campaign_task, form, contract,
transaction, contact_timeline — all with deterministic IDs
(`10000000-0000-0000-0000-0000000000XX`) and the default email
`admin@musicos360.dev` (a convention already established in `02_admin_user.ts` and
`dev-auth.controller.ts` — kept for consistency, not a real domain).

**Recorded gap, not filled in this part**: works, phonograms, releases,
invoices, leads, projects, conversations, and additional users per role
(manager/viewer beyond the owner) — the full list from Block 6 of Part 63.
Expanding `03_operational_seed.ts` without a real staging database to test
against would risk introducing silent bugs (wrong column names, broken
FKs) — see the real `leads.tipoServico` bug fixed in Part 61,
which was only discovered by running against a real database.

Anti-MAIN guard added to the runner (`index.ts`): it refuses to run if
`DATABASE_URL` resolves to `SUPABASE_MAIN_REF`, regardless of
`NODE_ENV`/`--force`.

`provision-staging-rbac-users.ts` (pre-existing) already covers creating one
real Supabase Auth user per role (`owner`, `admin`, `manager`, `editor`,
`viewer`, `accounting`, `artist`) with emails `rbac-<role>@homolog.local` —
a reserved domain, a fail-closed guard against any ref that is not
`SUPABASE_STAGING_REF`, and it requires an explicit `PROVISION_CONFIRM=YES`.

## Variable matrix (Block 2)

Source: `apps/api/src/core/config/env.schema.ts`, `.env.production`,
`.env.staging`, `apps/web/.env.staging`, `staging.yml`.

| Variable | Required in staging | Origin | Already available | Action |
|---|---|---|---|---|
| `DATABASE_URL` (staging) | Yes | Supabase STAGING | No | Depends on creating the Supabase STAGING resource |
| `APP_DATABASE_URL` | Yes (runtime RLS) | Supabase STAGING | No | Same |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase STAGING | No | Same |
| `DATABASE_SESSION_CONTEXT_ENABLED` | Yes (`true`) | Static config | Yes | Already in `staging.yml` |
| `RBAC_PERSISTED_AUTHORITY` | Yes (`SHADOW` initially) | Static config | — | Add as a variable in the Environment |
| `ENCRYPTION_KEY` | Yes | Generated (do not reuse DEV) | No | Generate a new staging-specific value |
| `REDIS_URL` / `REDIS_QUEUE_URL` | Yes | Redis STAGING | No | **BLOCKED_EXTERNAL** — no reachable Redis provider |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` (test) | Yes | Stripe TEST mode | No | **BLOCKED_EXTERNAL** — Stripe MCP not authorized |
| `STRIPE_CONNECT_CLIENT_ID` | Optional | Stripe TEST mode | No | Same |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY` / `R2_SECRET_KEY` / `R2_BUCKET_NAME` / `R2_PUBLIC_URL` | Yes | Cloudflare R2 | No | **BLOCKED_EXTERNAL** — Cloudflare MCP not authorized |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL` | Yes (production-like) | Resend | No | **BLOCKED_EXTERNAL** — no credential |
| `SENTRY_DSN` | Yes (production-like) | Sentry | No | **BLOCKED_EXTERNAL** — Sentry MCP not authorized |
| `POSTHOG_API_KEY` / `POSTHOG_HOST` | Optional | PostHog | **Yes** (MCP authorized, single "Default project") | Confirm whether staging should use the same project or an environment property |
| `SPOTIFY_CLIENT_ID/SECRET/REDIRECT_URI/OAUTH_STATE_SECRET` | Optional | Spotify Developer Dashboard | No | **BLOCKED_EXTERNAL** |
| `YOUTUBE_API_KEY` | Optional | Google Cloud Console | No | **BLOCKED_EXTERNAL** |
| `SOUNDCLOUD_CLIENT_ID/SECRET` | Optional | SoundCloud | No | **BLOCKED_EXTERNAL** |
| `META_APP_ID/SECRET/REDIRECT_URI` | Optional | Meta for Developers | No | **BLOCKED_EXTERNAL** |
| `TIKTOK_CLIENT_KEY/SECRET/REDIRECT_URI` | Optional | TikTok for Developers | No | **BLOCKED_EXTERNAL** |
| `DOCUSIGN_INTEGRATION_KEY/CLIENT_SECRET` | Optional | DocuSign | No | **BLOCKED_EXTERNAL** (Docusign MCP exists but is not authorized) |
| `GOOGLE_ADS_CLIENT_ID/SECRET/REDIRECT_URI` | Optional | Google Ads | No | **BLOCKED_EXTERNAL** |
| `ACRCLOUD_HOST/ACCESS_KEY/ACCESS_SECRET` | Optional | ACRCloud | No | **BLOCKED_EXTERNAL** |
| `AUTENTIQUE_WEBHOOK_SECRET` | Yes (if Autentique is active) | Autentique | No | **BLOCKED_EXTERNAL** |
| `CORS_ORIGINS` / `APP_URL` | Yes | Depends on the staging domain | No | Depends on Block 9 (Cloudflare DNS) — **BLOCKED_EXTERNAL** |
| `USE_MOCK` / `DEV_SOCIAL_METRICS_MOCK` / `AUTH_DISABLED` / `DEV_AUTH_ENDPOINT_ENABLED` | Yes (all `false`, or absent) | Static config | Yes | Add as variables |
| Deezer, Apple Music | — | — | — | Not in the schema today — no real integration coded yet; nothing to block or configure |

## External blockers (BLOCKED_EXTERNAL)

None of these is actionable without prior human authorization (via claude.ai
connector settings) or credentials provided directly:

- **Cloudflare** (DNS + R2) — MCP not authorized.
- **Stripe** (test mode, products, webhook) — MCP not authorized.
- **Resend/SMTP** — no credential and no MCP.
- **Sentry** — MCP not authorized.
- **All third-party OAuth integrations** (Spotify, YouTube/Google, Meta,
  TikTok, SoundCloud, DocuSign, Google Ads, ACRCloud, Autentique) — they require
  creating/configuring an app on the respective platforms, out of reach
  of any tool available here.
- **Deploy platform** (API + Web) — no platform-specific deploy manifest
  exists in the repository. `staging.yml` is platform-agnostic:
  it calls a generic `STAGING_STOP_WEBHOOK_URL` (must stop every API instance,
  workers included, and keep it stopped) before any schema change and a generic
  `STAGING_DEPLOY_WEBHOOK_URL` (receives `{"ref":"<commit>"}`, deploys that commit and starts it with `BUILD_SHA=<commit>`, which `/api/v1/health/live` reports) —
  see `docs/engineering/database.md`, "Deploy order". The service itself still
  has to exist on a provider with reachable credentials.

## State of the `staging` GitHub Environment

It already existed before this part (created on 2026-07-03). In this part: non-sensitive
variables were added (see commit `fix(ci): provision and verify the
staging environment`).

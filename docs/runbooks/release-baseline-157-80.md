# RELEASE RUNBOOK - CANONICAL BASELINE 157/80

Date: 2026-07-04
Status: official release runbook based on the current canonical baseline
Canonical source: `docs/STAGE_4_CANONICAL_BASELINE_157_80.md`

## 1. Objective

Define the safe release validation procedure for MUSIC OS 360 starting from the canonical baseline:

```text
public_tables = 157
musicos360_migrations = 80
```

This runbook replaces any script based on the historical `61/14` baseline and permanently blocks the old waves.

## 2. Mandatory Blocks

The documents below are historical and must not guide the execution of a release or of migrations:

- `docs/runbooks/migration-reconciliation.md` (versioned, marked OBSOLETE)
- STAGE 3B - Mirror Restore NO-GO Report (session report, not versioned)
- STAGE 3B.1 - Supabase-Compatible Mirror Report (session report, not versioned)

The technical decision that closes the 3B/3B.1 impasse is recorded in section 6 of
`docs/STAGE_4_CANONICAL_BASELINE_157_80.md`.

Explicit block:

```text
Old STAGE 3C = BLOCKED
Old waves = BLOCKED
Runbook 61/14 = DO NOT EXECUTE
```

## 3. Safety Rules

- Do not run anything against production without explicit approval.
- Do not run migrations in this runbook.
- Do not change the database.
- Do not change `.env`.
- Do not print secrets.
- Do not run Stripe live.
- Do not run a production deploy.
- Run allowed commands only against an isolated staging/mirror.
- Stop immediately if there is a risk of touching the production `DATABASE_URL`.

## 4. Mandatory Pre-Flight

Before any validation:

1. Confirm the branch/release candidate.
2. Confirm that the target environment is staging or an isolated mirror.
3. Confirm that the staging variables do not point to production.
4. Confirm that the process `DATABASE_URL` and `APP_DATABASE_URL` point to staging/mirror.
5. Confirm that `DATABASE_SESSION_CONTEXT_ENABLED=true`.
6. Confirm that Stripe is in test-mode.
7. Confirm that Resend uses the staging domain/sender.
8. Confirm that Sentry uses the staging project/environment.
9. Confirm that R2 uses the staging bucket.

If any item fails:

```text
NO-GO
```

## 5. Current Baseline Validation

Goal: prove that the target environment is on the canonical `157/80` baseline.

Validate:

- `public_tables = 157`
- `public.musicos360_migrations = 80`
- no unexpected pending migrations
- consistent migrations registry
- schema compatible with `docs/STAGE_4_CANONICAL_BASELINE_157_80.md`

Allowed command, only against staging/mirror:

```bash
corepack pnpm --filter @music-os-360/api db:check
```

Expected result:

```text
PASS
0 unexpected pending migrations
baseline 157/80 confirmed
```

NO-GO if:

- the baseline diverges from `157/80`;
- an unexpected pending migration appears;
- the command points to production;
- the connection uses an improper role for runtime;
- `db:check` fails.

## 6. Check of Future New Migrations

This runbook does not run migrations. For new future migrations:

1. Confirm the Task ID and RFC where applicable.
2. Confirm that the migration exists in the repo.
3. Confirm that the migration does not belong to the old waves.
4. Confirm that the migration was rehearsed on a disposable mirror/staging.
5. Confirm rollback/forward-fix.
6. Confirm manual review for schema/RLS/billing/auth/RBAC/storage.

Command forbidden in this runbook without explicit approval:

```bash
corepack pnpm --filter @music-os-360/api db:migrate
```

If there is a new migration:

```text
NO-GO until a specific future-migration runbook exists
```

## 7. RLS Validation

Goal: ensure that RLS/FORCE RLS and critical policies are active on staging/mirror.

Validate:

- active policies;
- FORCE RLS on the critical tenant-scoped tables;
- runtime app role without `BYPASSRLS`;
- tenant session context working.

Allowed commands, only against staging/mirror:

```bash
corepack pnpm --filter @music-os-360/api db:check
corepack pnpm --filter @music-os-360/api test:e2e
```

NO-GO if:

- any critical policy is missing;
- the app role has `BYPASSRLS`;
- the RLS E2E fails;
- the datasource does not initialize.

## 8. Tenant Isolation Validation

Goal: prove that Tenant A neither reads nor writes Tenant B data.

Allowed command:

```bash
corepack pnpm --filter @music-os-360/api verify:tenant-isolation
```

Expected result:

```text
PASS
cross-tenant read = 0
cross-tenant write = 0
```

NO-GO if:

- any cross-tenant read is possible;
- any cross-tenant write is possible;
- the script fails without clear evidence;
- the script runs against a non-staging environment.

## 9. RBAC Readiness Validation

Goal: validate RBAC readiness in the staging/mirror environment with real decision logs.

Allowed command:

```bash
corepack pnpm --filter @music-os-360/api rbac:readiness
```

Expected result:

```text
PASS
>=1000 decisions when applicable
>=10 endpoints when applicable
>=5 resources when applicable
>=5 roles when applicable
>=3 tenants when applicable
cross-tenant = 0
resolver failures = 0
```

NO-GO if:

- readiness fails;
- decision logs are insufficient;
- there is an allow/deny divergence;
- there is a cross-tenant finding;
- there is a protected route without the expected permission criterion.

## 10. Storage Validation

Goal: validate R2/S3 staging and per-tenant isolation.

Allowed command:

```bash
corepack pnpm --filter @music-os-360/api storage:e2e
```

Validate:

- HeadBucket;
- PutObject;
- GetObject;
- Presigned PUT;
- Presigned GET;
- ListObjects by tenant prefix;
- DeleteObject;
- per-tenant isolation.

NO-GO if:

- any operation fails;
- the bucket is a production bucket;
- the tenant prefix is missing;
- the signed URL is not validated;
- delete/cleanup fails.

## 11. Staging Billing Validation

Goal: validate billing without touching Stripe live.

Required:

- Stripe test-mode;
- staging webhook secret;
- test customer;
- test checkout session;
- test subscription;
- upgrade/downgrade test;
- cancellation test;
- reactivation test;
- signed events received in staging.

Minimum events:

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

NO-GO if:

- any Stripe live key is in the environment;
- webhook signature verification fails;
- idempotency fails;
- local persistence does not happen;
- the billing guard does not reflect `read_only`/`suspended` where applicable.

## 12. Staging Resend Validation

Goal: validate transactional email on the staging domain/sender.

Validate:

- staging `RESEND_API_KEY`;
- staging `RESEND_FROM_EMAIL`;
- SPF;
- DKIM;
- DMARC;
- sending of the welcome email;
- sending of the password reset email;
- sending of the invitation email;
- sending of the administrative notification email.

NO-GO if:

- the domain is not validated;
- the sender improperly points to production;
- any required send fails;
- bounce/rejection is not monitored.

## 13. Staging Sentry Validation

Goal: validate end-to-end observability.

Validate:

- frontend exception capture;
- backend exception capture;
- release tracking;
- sourcemaps;
- traces;
- correlation id;
- tenant context without improper PII.

NO-GO if:

- the DSN points to the wrong project;
- the sourcemap does not resolve;
- the backend does not capture a controlled exception;
- the frontend does not capture a controlled exception;
- traces do not correlate the frontend/backend request.

## 14. General Quality Gates

Allowed commands:

```bash
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
corepack pnpm --filter @music-os-360/api test:e2e
```

Expected result:

- typecheck PASS;
- lint PASS;
- build PASS;
- E2E PASS.

NO-GO if any gate fails.

## 15. Security Gate

Required:

- secret scan;
- `gitleaks` PASS;
- no staging secret missing;
- no production secret in staging;
- CORS/CSP/security headers reviewed;
- webhooks with signature and replay protection where applicable.

NO-GO if:

- `gitleaks` fails;
- a real secret is versioned;
- staging uses a production credential;
- a webhook without a signature is exposed.

## 16. Staging Deploy and Smoke

This runbook does not run the deploy automatically.

Before GO:

- the staging deploy must exist;
- the staging deploy must pass;
- the staging smoke must pass;
- the staging rollback must be documented;
- the incident runbook must be up to date.

NO-GO if:

- the staging deploy does not exist;
- the deploy depends on a placeholder;
- the staging smoke fails;
- the staging rollback is not tested or documented.

## 17. Allowed Commands

Only against an isolated staging/mirror when applicable:

```bash
corepack pnpm --filter @music-os-360/api db:check
corepack pnpm --filter @music-os-360/api test:e2e
corepack pnpm --filter @music-os-360/api verify:tenant-isolation
corepack pnpm --filter @music-os-360/api rbac:readiness
corepack pnpm --filter @music-os-360/api storage:e2e
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm build
```

## 18. Commands Forbidden Without Explicit Approval

```bash
corepack pnpm --filter @music-os-360/api db:migrate
db:push
deploy
stripe live
any command against the production DATABASE_URL
any old wave
old STAGE 3C
```

Also forbidden:

- changing `.env` during this runbook;
- printing secrets;
- applying migrations in production;
- using the `61/14` runbook;
- using owner/postgres as the runtime `APP_DATABASE_URL`.

## 19. GO Criterion

GO only if all of the following are true:

- baseline `157/80` confirmed;
- `db:check` PASS;
- E2E PASS;
- tenant isolation PASS;
- RBAC readiness PASS;
- storage staging PASS;
- Stripe test-mode PASS;
- Resend staging PASS;
- Sentry staging PASS;
- `gitleaks` PASS;
- deploy staging PASS;
- smoke staging PASS;
- no open P0;
- no blocking open P1;
- risk of touching production = 0.

## 20. NO-GO Criterion

NO-GO if any item occurs:

- any unexpected pending migration appears;
- the baseline diverges from `157/80`;
- any RLS/RBAC/tenant/storage gate fails;
- any staging secret is missing;
- any staging secret points to production;
- the staging deploy does not exist;
- the staging smoke fails;
- `gitleaks` fails;
- there is a risk of touching production;
- there is an open P0;
- there is a blocking open P1.

## 21. Rollback

This runbook does not apply changes, so it must not require a database rollback.

Operational rollback for validations:

1. Stop at the first gate that fails.
2. Preserve the command logs.
3. Confirm that no forbidden command was executed.
4. If the staging deploy fails, run the staging rollback according to the provider's runbook.
5. If the staging smoke fails after the deploy, revert to the last known staging release and open an internal incident.
6. Do not promote to production.

Forbidden rollback:

- manual rollback in production without an RFC/approval;
- `db:rollback` in production without a specific runbook;
- restoring a dump in production as an improvised action.

## 22. Runbook Verdict

This document creates the safe operational process for future releases based on `157/80`.

It does not declare a production GO.

Status:

```text
RUNBOOK_CREATED
PRODUCTION_GO = NOT_DECLARED
```

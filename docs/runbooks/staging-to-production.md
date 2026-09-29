# Runbook — DEV → Staging → Production promotion · MUSIC OS 360

> Nothing reaches production without going through the `staging` branch and the staging environment with every gate green.
> Production is never a test environment. Development, staging and production secrets are independent.

## Permanent topology

```text
dev -> staging -> main
```

- `dev`: development and continuous integration.
- `staging`: acceptance, authorized migrations, deploy and smoke.
- `main`: production.
- Never promote code directly from `dev` to `main`.

## Precondition: staging operational

Promote to `staging` only when the environment is isolated:

- [ ] Isolated staging Supabase (`jjnnjnxjkqipgqebijen`)
- [ ] Isolated staging Redis
- [ ] Staging R2 storage with a separate bucket/prefix
- [ ] GitHub Environment `staging` configured, including `STAGING_STOP_WEBHOOK_URL` (stops every API instance) and `STAGING_DEPLOY_WEBHOOK_URL` (deploys and starts the build)
- [ ] Staging secrets hold no production values
- [ ] Staging API answers the health check
- [ ] Staging web points only at the staging API

## Promotion order

1. Confirm CI and Security Scan are green on `dev`.
2. Open the `dev` → `staging` promotion; add no functional change during the promotion.
3. After the push/merge to `staging`, wait for the `staging.yml` workflow.
4. Every run first reads the schema state against the build (`db-ops check:state`, read-only):
   - database at this build's schema: RLS, isolation, deploy (the new build must answer `/api/v1/health/ready`) and smoke;
   - database holding migrations this build does not ship: the run fails — this build is older than the schema and is never deployed over it;
   - pending migrations: the run fails in a controlled way and does not touch the database.
5. When pending migrations are reviewed, run `staging.yml` manually on ref `staging` with `apply_migrations=true`. The workflow stops the running build, proves no instance serves, migrates, deploys the matching build and proves it is up (`docs/engineering/database.md`, "Deploy order").
6. Validate on staging:
   - authentication;
   - tenant A × tenant B isolation;
   - critical journeys;
   - integrations;
   - observability;
   - rollback (`rollback_to_migration`, see below).
7. After approval, promote `staging` to `main`.
8. Apply production migrations only in an authorized window, with a recent backup and a rollback plan, following the same order by hand: stop every API instance first, migrate, `db:check`, start the new build (there is no production deploy workflow in this repository).
9. Deploy production and run the post-deploy smoke.

## Pre-production checklist

- [ ] CI green on the promoted code
- [ ] Security Scan green
- [ ] `staging.yml` green
- [ ] Production backup younger than 24 hours
- [ ] No destructive migration without an explicit plan
- [ ] `db:check` clean after the authorized application
- [ ] RLS and multi-tenant isolation verified
- [ ] Staging smoke done
- [ ] Alerts and observability active
- [ ] Eng. Lead and Owner approval

## Rollback

- **Application only (no migration in between):** redeploy the previous immutable build.
- **Database:** from the newer build, with every API instance stopped, `db-ops rollback:to <last migration of the older build>` (staging: `staging.yml` with `rollback_to_migration`, which never deploys), then deploy the older build — see `docs/engineering/database.md`, "Reverse transition", and `docs/RUNBOOK_ROLLBACK.md` §3. A migration whose `down()` refuses or fails requires the pre-deploy backup restore.
- **Rollback criterion:** error rate above 1% for 5 minutes, health check persistently unavailable, or a SEV1/SEV2 incident.

## Minimum evidence

- Link to the green CI on `dev`.
- Link to the green `staging.yml` run on branch `staging`.
- Result of `db:check`, RLS and isolation.
- Evidence of the staging smoke.
- Pre-production backup.
- Commit/tag promoted to `main`.

## Automatic blockers

- Direct `dev -> main` promotion.
- Red `staging.yml`.
- Pending migrations without `apply_migrations=true`.
- A database ahead of the build being deployed.
- A schema change without `STAGING_STOP_WEBHOOK_URL` or without proof that the running build stopped.
- Missing or stale backup.
- Critical/high vulnerability without an approved exception.
- RLS, isolation or smoke failure.

# Runbook — Staging validation and production release · MUSIC OS 360

> dev is the only branch. Nothing reaches production without a green staging run dispatched from `dev`, with every gate green.
> Production is never a test environment. Development, staging and production secrets are independent.

## Branch policy

- `dev` is the only branch: development, continuous integration and the ref every workflow runs on.
- `staging` is an environment (GitHub Environment `staging`), not a branch.
- Production is released by an owner-authorized manual action; there is no `main` branch and no promotion between branches.
- Enforced by `scripts/git-guard/`, `.github/workflows/branch-policy.yml` and `scripts/verify-branch-topology.mjs`.

## Precondition: staging operational

Dispatch `staging.yml` only when the environment is isolated:

- [ ] Isolated staging Supabase (`jjnnjnxjkqipgqebijen`)
- [ ] Isolated staging Redis
- [ ] Staging R2 storage with a separate bucket/prefix
- [ ] GitHub Environment `staging` configured, including `STAGING_STOP_WEBHOOK_URL` (stops every API instance) and `STAGING_DEPLOY_WEBHOOK_URL` (receives `{"ref":"<commit>"}`, deploys that commit and starts it with `BUILD_SHA=<commit>`); the Environment requires reviewers and allows only the `dev` branch
- [ ] Staging secrets hold no production values
- [ ] Staging API answers the health check
- [ ] Staging web points only at the staging API

## Release order

1. Confirm CI and Security Scan are green on `dev`.
2. Dispatch the `staging.yml` workflow manually on ref `dev`; add no functional change between the green CI and the dispatch.
3. Every run first reads the schema state against the build (`db-ops check:state`, read-only):
   - database at this build's schema: RLS, isolation, deploy (the new build must answer `/api/v1/health/ready`) and smoke;
   - database holding migrations this build does not ship: the run fails — this build is older than the schema and is never deployed over it;
   - pending migrations: the run fails in a controlled way and does not touch the database.
4. When pending migrations are reviewed, dispatch `staging.yml` again on ref `dev` with `apply_migrations=true`. The workflow stops the running build, proves no instance serves, migrates, deploys the matching build and proves it is up (`docs/engineering/database.md`, "Deploy order").
5. Validate on staging:
   - authentication;
   - tenant A × tenant B isolation;
   - critical journeys;
   - integrations;
   - observability;
   - rollback (`rollback_to_migration`, see below).
6. After the owner approves the staging evidence, the owner authorizes the production release of that same `dev` commit.
7. Apply production migrations only in an authorized window, with a recent backup and a rollback plan, following the same order by hand: stop every API instance first, migrate, `db:check`, start the new build (there is no production deploy workflow in this repository).
8. Deploy production and run the post-deploy smoke.

## Pre-production checklist

- [ ] CI green on the released commit
- [ ] Security Scan green
- [ ] `staging.yml` green for the same commit
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
- Link to the green `staging.yml` run dispatched on `dev`.
- Result of `db:check`, RLS and isolation.
- Evidence of the staging smoke.
- Pre-production backup.
- The `dev` commit SHA released to production.

## Automatic blockers

- A production release of a commit without a green `staging.yml` run.
- Red `staging.yml`.
- Pending migrations without `apply_migrations=true`.
- A database ahead of the build being deployed.
- A schema change without `STAGING_STOP_WEBHOOK_URL` or without proof that the running build stopped.
- Missing or stale backup.
- Critical/high vulnerability without an approved exception.
- RLS, isolation or smoke failure.

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
- The marketing approval migration (`20260930000003`) does the same for the `metadata->>'approval'` key of `marketing_content_posts` (no column: a jsonb key), restricting it to `pending`, `approved`, `rejected`, `revision_requested`. Run the approval distribution query from "Vocabulary pre-flight queries" first; any residue aborts the migration. An API build older than this release writes Portuguese approvals and fails the new CHECK, so it is stopped in the same swap as above.

## Rollout window for the canonical-vocabulary migrations

The canonical English vocabulary migrations (`20260930000012` to `20260930000025`) run **before** the new API build boots: the API refuses to start while migrations are pending, so a "deploy the API first" order is not possible. For a short window the previous API build serves traffic against migrated data:

- Backfills are exact-match and additive; the new API reads both the legacy and the canonical spelling everywhere, and writes canonical values only.
- The previous build does not know the canonical slugs: its lookups by renamed operational-list slugs (`20260930000016`) miss the renamed platform rows until it is replaced, and any write of an old Portuguese value into a column that now has a CHECK is rejected. Stop the previous API instances and workers in the same swap that runs the migrations (the staging workflow does this: `STAGING_STOP_WEBHOOK_URL`).
- Run the "Vocabulary pre-flight queries" below in every environment first; residue values abort a guarded migration and block the whole pending batch.
- Several migrations rewrite most rows of a table in one transaction (`transactions`, `clients`): run them in a low-traffic window, with a recent backup, and exercise the reverse `down()` order on a disposable PostgreSQL before production (`20260930000022` first, then `16`, `18`, `19`, `25`, `24`, `21`, `17`, `23`).
- The backfill side tables keep before/after jsonb (including third-party personal data) and are not removed by tenant deletion. Run the per-tenant erasure SQL of `docs/engineering/backfill-side-tables-retention.md` on every tenant deletion or erasure request, and purge the tables with the gated draft `migration-drafts/20260930000050_PurgeBackfillSideTables.ts` only after the rollback window ends and the pre-flight residue is 0 in every environment (the draft is not registered; take a backup first, the purge is irreversible).

## Vocabulary pre-flight queries

Read-only `SELECT`s to run on the target database (as the migration role, so RLS does not hide other tenants) before releasing the vocabulary migrations. Every value outside the expected set aborts the matching migration (nothing is coerced); resolve those rows first. The migrations print at most 20 offending values, each truncated to 40 characters.

```sql
-- invoices.payment_method (20260930000010). Allowed after backfill: cash, credit_card, debit_card,
-- check, pix, ted, boleto, transferencia. Legacy dinheiro/cartao_credito/cartao_debito/cheque are
-- rewritten; case, tab and NBSP variants are normalized; any other text (e.g. accented) aborts.
SELECT payment_method, count(*) FROM invoices GROUP BY 1 ORDER BY 2 DESC;

-- transactions.type (20260930000011 validates chk_transactions_type). Allowed: revenue, expense, investment, tax, transfer.
SELECT type, count(*) FROM transactions GROUP BY 1 ORDER BY 2 DESC;

-- financial_rules.type and calculation_method (20260930000011). Allowed type: tax, commission,
-- external_rights_fee, discount, fee, other. Allowed calculation_method: percentage, fixed, tiered.
SELECT type, calculation_method, count(*) FROM financial_rules GROUP BY 1, 2 ORDER BY 3 DESC;

-- marketing_content_posts.metadata->>'approval' (20260930000003). Allowed: pending, approved,
-- rejected, revision_requested (NULL = key absent).
SELECT metadata->>'approval' AS approval, count(*) FROM marketing_content_posts GROUP BY 1 ORDER BY 2 DESC;

-- RBAC slug collision (role alias migration 20260930000001): tenant custom roles, and the members
-- holding them, already using a slug that becomes a built-in role. Must return zero rows, otherwise the holder is widened
-- to that built-in level. Resolve (rename the custom role or change the members) before releasing.
SELECT 'custom_role' AS source, tenant_id, slug, count(*) AS n
FROM roles
WHERE tenant_id IS NOT NULL AND deleted_at IS NULL
  AND slug IN ('legal', 'sales', 'producer', 'collaborator', 'hr_manager')
GROUP BY tenant_id, slug
UNION ALL
SELECT 'member_of_custom_role' AS source, m.tenant_id, r.slug, count(*) AS n
FROM org_members m
JOIN roles r ON r.id = m.role_id
WHERE r.tenant_id IS NOT NULL AND r.deleted_at IS NULL
  AND r.slug IN ('legal', 'sales', 'producer', 'collaborator', 'hr_manager')
GROUP BY m.tenant_id, r.slug;
```

### Residue census of the contract vocabulary backfills (read-only)

Removal condition of the matching read aliases: every query returns 0 in every environment (run as the migration role).

```sql
-- contracts.type default `outro` (20260930000034). Retires the `outro` alias.
SELECT count(*) AS outro_rows FROM contracts WHERE type = 'outro';

-- contract.signed provisional transactions (20260930000035): handler-created rows still on the ad-hoc category.
SELECT category, count(*) FROM transactions
WHERE category IN ('contratos', 'contracts') AND metadata ->> 'source' = 'contract.signed'
GROUP BY 1;

-- platform-owned contract category slugs (20260930000036), contracts and templates. Retires the ten legacy aliases.
SELECT 'contracts' AS source, type AS slug, count(*) FROM contracts
WHERE type IN ('gravacao', 'cessao_direitos', 'producao', 'exclusividade', 'publicitario', 'semantico', 'distribuicao', 'licenciamento', 'gestao', 'outros')
GROUP BY 2
UNION ALL
SELECT 'contract_templates', service_type, count(*) FROM contract_templates
WHERE service_type IN ('gravacao', 'cessao_direitos', 'producao', 'exclusividade', 'publicitario', 'semantico', 'distribuicao', 'licenciamento', 'gestao', 'outros')
GROUP BY 2;
```

A value that is neither canonical nor in these lists (a tenant-authored slug such as `parceria`, or the pre-canonical `exclusivo`,
`nao_exclusivo`, `representacao`, `servicos`) is not residue of these migrations; see blocker `BLK-CONTRACT-CATEGORY-REGISTRY` in
`docs/NAMING_NORMALIZATION_CANONICAL_MAP.md`.

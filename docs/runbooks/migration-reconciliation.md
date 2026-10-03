# OBSOLETE AS OF 2026-07-04

> **DO NOT EXECUTE THIS RUNBOOK.**
>
> OBSOLETE. This document used the historical baseline of `61` tables / `14` migrations and the
> assumption of old pending waves. Execution of the old waves is blocked. The 2026-07 baseline of
> `157` public tables / `80` records in `public.musicos360_migrations` is recorded in
> `docs/STAGE_4_CANONICAL_BASELINE_157_80.md` (historical record, not the current contract); the
> current release and migration contract is `docs/engineering/release-production.md` and
> `docs/engineering/database.md`.
# Runbook — Migration Reconciliation (Prod +66) · MUSIC OS 360

> Production is **66 migrations behind** (last applied `AddArtistIdToWorks20260523000001`; the repo has 79).
> Evidence already collected (read-only, directly in prod): **0% data loss**, **0 orphans/duplicates/violations**, backfills with fail-safe. See the DROP COLUMN / CRM / Migration-Failure audits.

## ⚠️ Blocking prerequisite: FAITHFUL mirror of production
Supabase `create_branch` does **NOT** reproduce the prod state (the schema comes from TypeORM, not the Supabase CLI → the branch starts almost empty). For a faithful rehearsal, create the mirror through **one** of these routes:
1. **pg_dump/restore:** `pg_dump` of prod (schema+data) → restore into a disposable Postgres/branch. **(recommended)**
2. **Supabase branch with data** (if available on the plan) from main.
3. **CI runner:** restore a prod snapshot and run the TypeORM *migration runner*.
**Do not use** `staging-go-live` (divergent schema, 142 tables).

Validate the mirror before starting (it must match prod):
```sql
-- compare with prod: tables=61, musicos360_migrations=14, RLS/FORCE, critical row counts
SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND c.relkind='r';
SELECT count(*) FROM musicos360_migrations;
```
Reference critical row counts (prod, at the time): tenants=2, org_members=11, artists≈105, contracts=72, transactions=89, billing_subscriptions=2, crm_tasks=4, releases=87; most operational tables=0.

## PHASE 2 — Pre-migration snapshot (mirror)
```sql
-- migrations, table count, row counts of the 14 critical tables, RLS/FORCE, policies
SELECT string_agg(name,',' ORDER BY id) FROM musicos360_migrations;
SELECT relname, relrowsecurity, relforcerowsecurity FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r';
-- counts: tenants, organizations, org_members, users, artists, works, phonograms, contracts, releases, transactions, leads, crm_tasks, billing_subscriptions, invoices
```

## PHASE 3 — Apply the 66 in WAVES (chronological order — TypeORM applies sequentially)
> Use the **migration runner** (`pnpm --filter @music-os-360/api db:migrate`) pointing `DATABASE_URL` at the **mirror**. The "waves" are validation checkpoints; the real order is by timestamp.

| Wave | Migrations (range) | Content |
|---|---|---|
| **1 — Additive domains** | `20260526…` → `20260609…` | financial categories, audiovisual (9), marketing, registry/society, skills, workflow_executions, musicchat, notifications, genre |
| **2 — CRM** | `20260528000002` (+ backfill) | contacts/contact_*, operational_tasks · **backfill `crm_tasks(4) → operational_tasks`** |
| **3 — Enterprise RBAC** | `20260610…` → `20260614…` | permissions, roles, role_permissions, org structure, **backfill org_members.role_id**, decision logs, users projection, templates/aliases/inheritance |
| **4 — RLS/Tenant Hardening** | `20260612…` → `20260621…` | RLS helpers (PortableRlsTenantContext), operational FORCE RLS, policy harmonization, tenant_invitations, rbac_error_logs |
| **5 — Public + Billing** | `20260630…` + `20260701000001/002/003` | public artist registration, billing enforcement, billing plans, billing RLS hardening |

**Stop at the first failure** and report (do not continue the wave).

## PHASE 4 — Per-wave validations (repeat after each wave)
```sql
-- 1) the wave's migrations are registered / none pending
SELECT name FROM musicos360_migrations ORDER BY id DESC LIMIT 20;
-- 2) expected tables exist (adjust per wave)
-- 3) critical data preserved (compare counts with the PHASE 2 snapshot)
-- 4) orphans = 0 (domain FKs) — reuse the queries from the failure audit
-- 5) RLS/FORCE consistent ; policies created
SELECT count(*) FILTER (WHERE relforcerowsecurity) AS force_on FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='public' AND relkind='r';
```
Record per wave: **Migrations applied · Time · Status (PASS/FAIL) · counts before/after**.
Known data checkpoints:
- Wave 2: `operational_tasks` receives the **4** rows from `crm_tasks` (backfill); `count(operational_tasks) ≥ 4`.
- Wave 3: `org_members.role_id` **without NULL** (fail-safe → viewer). `SELECT count(*) FROM org_members WHERE role_id IS NULL` = 0.
- Wave 5: `billing_plans` = 3 seeds (Stripe IDs NULL); `tenant_billing_state` backfilled (1 per tenant).

## PHASE 5 — Final mirror validations (after the 66)
```sql
-- total migrations = repo (79) ; billing/RBAC/contacts exist
SELECT count(*) FROM musicos360_migrations;                       -- expected: ~79
SELECT to_regclass('public.billing_plans'), to_regclass('public.payment_events'),
       to_regclass('public.tenant_billing_state'), to_regclass('public.roles'),
       to_regclass('public.permissions'), to_regclass('public.contacts'),
       to_regclass('public.operational_tasks');                   -- all NOT NULL
-- registry_status CHECK valid (0 violating rows) ; org_members.role_id populated
-- billing seeds (3) ; tenant_billing_state backfilled ; payment_events ready (0 rows, table ok)
-- tenant isolation: A/B/system/super_admin matrix (see the billing staging runbook)
```
Compare critical row counts **before vs after**: they must be **equal** (additive) except where there is a backfill (operational_tasks +4).

## PHASE 6 — Risk report (fill in with the rehearsal result)
1. Did the 66 apply without error? · 2. Total time? · 3. Data loss? (expected: 0) · 4. Unexpected row counts? · 5. Constraint failure? · 6. RLS failure? · 7. Backfill failure? · 8. Warnings? · 9. Adjustments needed before prod?

## PHASE 7 — PRODUCTION runbook (execute only after the mirror PASSES)
1. **Mandatory backup** of prod (validated — see `dr.md`). Confirm the restore is testable.
2. **Maintenance window** (app read-only / writes paused if possible).
3. **Commands:** `pnpm --filter @music-os-360/api db:migrate` (DATABASE_URL=prod owner). Applies in order.
4. **Per-wave validations** (same queries as PHASE 4) — stop and abort at the 1st failure.
5. **Rollback:**
   - Failure in an additive migration → the migration's `down()` + investigate; data intact.
   - Failure after several waves → restore the pre-window backup (data preserved).
   - CRM/backfill → idempotent; re-run after fixing.
6. **ABORT criteria:** any unexpected constraint/backfill FAIL, diverging critical row count, RLS error, time > the window SLA.
7. **Post-migration checklist:** `/health` 200 · login · tenant A/B isolation · billing seeds · smoke of the re-enabled modules (audiovisual/marketing/RBAC/CRM).

## Criteria to start
- [ ] **Faithful** mirror of prod created and validated (tables/migrations/counts match)
- [ ] Prod backup validated
- [ ] CRM backfill (`crm_tasks→operational_tasks`) written/tested
- [ ] Window + on-call + rollback ready

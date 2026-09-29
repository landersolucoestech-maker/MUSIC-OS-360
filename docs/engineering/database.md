---
paths:
  - "apps/api/src/database/**"
  - "apps/api/scripts/db-ops.ts"
description: Migrations, RLS, and schema conventions
---

# Database (apps/api/src/database)

- Migrations live in `apps/api/src/database/migrations/*.ts`, applied through the custom
  toolchain in `apps/api/scripts/db-ops.ts` via the `db:migrate` / `db:check` / `db:generate`
  family of scripts — never hand-run raw SQL against a real environment, and never assume the
  bare TypeORM CLI is wired up here.
- Every tenant-scoped table needs RLS + policies. The source of `verify:rls` and `verify:tenant-isolation`
  (`apps/api/scripts/verify-rls.ts`, `verify-tenant-isolation.ts`) defines what coverage is checked,
  matching CI job `db-verify-fresh-postgres`; however **execution safety is separate from coverage**.
  `verify:tenant-isolation` is classified as a database mutation unless current source proves otherwise,
  so do not execute it outside an explicitly authorized isolated/disposable target.
- Some migrations are `EXTERNAL_MANAGED` (e.g. Realtime) and must be excluded from
  `db:migrate:application`/`db:check:application` — see
  `apps/api/src/database/migrations/*RealtimeBroadcastAuthorization*` and
  `scripts/verify-realtime-external.ts` for why; don't fold external-managed migrations into the
  application-managed path.
  **Fresh-DB setup (a new disposable/test Postgres instance with a superuser connection role):**
  a single `db:migrate:application` run will *not* leave the database fully converged — it
  deliberately skips `EXTERNAL_MANAGED` migrations, so tests exercising their effect (e.g.
  `test/e2e/realtime/realtime-broadcast-authorization.e2e-spec.ts`) will fail with unfiltered
  RLS results until the full chain runs. The canonical sequence (exactly what CI's
  `db-verify-fresh-postgres` job in `.github/workflows/ci.yml` runs and asserts) is:
  1. `db:migrate` (unfiltered) — applies everything, `APPLICATION` and `EXTERNAL_MANAGED` alike,
     in one pass (works when the connecting role owns/can alter every schema touched, e.g. a
     local superuser-owned disposable container); **or**, to also assert the classification
     boundary itself (as CI's segmented-executor test does): `db:migrate:application` first
     (must leave zero tracking rows for any `EXTERNAL_MANAGED` migration), then `db:migrate`
     (unfiltered) to converge the rest.
  2. `verify:realtime-external` — read-only physical check; must report `APPLIED_AND_VERIFIED`
     once step 1 has converged (`PENDING_EXTERNAL_PRIVILEGE` is an expected, non-regression
     result only when the connecting role genuinely cannot own the `realtime` schema, e.g. a
     real Supabase-hosted environment before a DBA applies it there).
- New columns/tables: consider nullability, defaults, and backward compatibility for existing
  rows — this repo has migrations specifically for backfills and safe-column additions
  (`AddMissingSafeColumns`, `MakeShareRegistryFieldsNullable`) because that's the established
  pattern for evolving live tenant data safely.
- A migration is not "done" without a corresponding down/rollback path when the existing
  convention has one, and without running `db:check` to confirm no pending state.
- `database-reviewer` is read-only by default; it reviews schema, indexes, constraints, RLS
  coverage, and migration safety before a migration is considered mergeable.

## Technical-language rename migrations (CZ-037 … CZ-043, `20260928000015`+)

These migrations rename columns **in place** (guarded, reversible) and remap persisted values to
English. They are not expand/contract: the running API must match the schema.

**Deploy order (mandatory; forward: old API + old DB -> new API + new DB):**
1. Run the pre-flight (`db-ops preflight migrate`, plus the queries below) and resolve anything it
   reports — nothing predictable may fail once the build is stopped.
2. Prove the liveness probe reaches the running build (`/api/v1/health/live` answers 200 with
   `status: up`), then stop every instance of it (HTTP and the in-process BullMQ workers and
   schedulers — they share the process) and prove it is down: connection refused/timeout or
   502/503/504 for 3 consecutive probes. A 404/3xx/401 is not proof (a wrong URL answers 404 while
   the build still serves). An old API against a renamed column fails every query of that table.
3. `db:migrate` (each migration in its own transaction), then `db:check` — it fails on pending
   migrations **and** on applied migrations the build does not ship (database ahead of the build).
4. Start the new API/worker build and prove **that build** is up: `/api/v1/health/live` reports
   `build` = the deployed commit (`BUILD_SHA`), then `/api/v1/health/ready` = 200, then smoke test.
5. Deploy the new web build. Until every browser reloads, an old web build keeps sending the
   pre-rename payload: the API accepts it as deprecated input (`*-legacy-fields.ts`,
   `musicchat-vocabulary.ts`), drops the values an old build could not have read on edit (form
   defaults, empty lists), and never lets an empty deprecated value overwrite a canonical one.

The reverse order (new web first) fails every save with 400/422 against the old API.

**Staging** enforces this in `.github/workflows/staging.yml` (`workflow_dispatch` on branch
`staging` with `apply_migrations`): `db-ops check:state` refuses a build older than the database;
`db-ops preflight` runs read-only before anything is stopped (role bypasses RLS, no pending
EXTERNAL_MANAGED migration; unmapped transaction types are a warning); `scripts/wait-for-http-state.mjs`
proves the probe reaches the running build, then the `STAGING_STOP_WEBHOOK_URL` hook stops it and the
same script proves it is down before `db:migrate`; the deploy job sends this commit to the deploy hook
and proves the build reporting that commit is up before the smoke test. Without the stop hook the
workflow refuses to change the schema. The base URL is normalized (trailing `/` stripped); URLs with
`//` in the path are rejected. Platform contract: the stop hook stops *all* instances and keeps them
stopped (no auto-restart); the deploy hook receives `{"ref":"<commit>"}`, deploys that commit and
starts it with `BUILD_SHA=<commit>` (until the platform sets it, the "up" check fails closed). A
staging run is never cancelled mid-flight; runs from other refs never change the schema and use
their own concurrency group. `db:migrate`, `db:migrate:application`, `db:rollback` and `rollback:to`
refuse to run with a role that does not bypass RLS. `scripts/verify-staging-deploy-order.mjs` (CI
`quality` job) fails when the workflow drifts from this order. Protect the `staging` GitHub
Environment with required reviewers and the `staging` branch only (repository settings).
**Production** has no deploy workflow in this repository: follow the same steps by hand
(maintenance mode / stop per `docs/RUNBOOK_ROLLBACK.md` first).

**Reverse transition (rollback: new API + new DB -> old API + old DB):**
1. Stop every instance of the new build and prove it is down (as in step 1 above).
2. From the new build (it holds the `down()` code), roll the database back to the last migration of
   the old build: `pnpm --filter @music-os-360/api exec tsx scripts/db-ops.ts rollback:to <Migration>`
   — one migration at a time, each `down()` in its own transaction, newest first. In production set
   `CONFIRM_ROLLBACK=YES_I_KNOW_WHAT_I_AM_DOING`. The whole revert list is validated before anything
   is reverted: it refuses rows applied out of timestamp order around the target, rows this build
   has no `down()` for, and EXTERNAL_MANAGED migrations. Staging: `staging.yml` with
   `rollback_to_migration` and the same name typed again in `confirm_rollback` (stops the build
   first; never deploys; allowed whenever nothing unknown is applied, also on a partial batch).
3. Deploy the old build: `db:check` must pass (nothing pending, nothing unknown applied). Staging:
   revert the `staging` branch to the old build and push — the normal pipeline deploys it; a run of a
   newer build meanwhile stops at `db-ops check:state` (pending migrations without authorization).
4. Prove it is up and smoke test.

**Recovering from a partial state** (a migration or `down()` failed after the build was stopped;
each migration commits on its own, so earlier ones stay applied and staging stays down):
- A transient failure (lock timeout, connection loss): re-run `staging.yml` with `apply_migrations`
  and `staging_already_down` — the plan sees the remaining pending migrations, applies them and
  deploys this commit.
- A failure that repeats: roll the batch back with `rollback_to_migration` (+ `confirm_rollback`,
  `staging_already_down`) to the last migration of the build that was serving, then redeploy that
  build (revert the `staging` branch). The plan accepts a partial batch because nothing unknown is
  applied.
- A `down()` that fails halfway: fix the cause, re-run the same rollback; to go forward instead,
  re-run `apply_migrations`.
Never start an older build while `db:check` of that build fails.

**Pre-flight queries (read-only):**
- The migration role must bypass RLS. The data steps are plain UPDATEs, and the tenant tables use
  `FORCE ROW LEVEL SECURITY`, which applies to the table owner too: a role that is neither superuser
  nor `BYPASSRLS` sees no tenant context, so every UPDATE matches zero rows and the migration
  "succeeds" having changed nothing. It must return `true`:
  `SELECT rolsuper OR rolbypassrls FROM pg_roles WHERE rolname = current_user;`
- Transactions whose `type` has no canonical equivalent — they would violate `chk_transactions_type`
  (added `NOT VALID`) on their next UPDATE:
  `SELECT type, count(*) FROM transactions WHERE lower(type) NOT IN ('receita','despesa','investimento','imposto','transferencia','revenue','expense','investment','tax','transfer') GROUP BY 1;`
  Fix or map those rows, then `ALTER TABLE transactions VALIDATE CONSTRAINT chk_transactions_type;`.
- Table sizes: `SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname IN ('works','phonograms','transactions','artists','clients','releases','conversations','musicchat_automation_settings');`
  Each migration runs in its own transaction; `20260928000020` onwards set `lock_timeout = '15s'`
  (`01`–`19`, including the `releases`/`works` renames, wait for their locks without a timeout —
  run them in a maintenance window with no long transaction open). A migration that
  renames a column (`ALTER TABLE`) holds an ACCESS EXCLUSIVE lock on that table until it commits;
  a value-only migration (`20260928000019`, `20260928000026`) takes ROW EXCLUSIVE and locks only
  the rows it updates — for `20260928000026`, every conversation holding a legacy MusicChat value
  and each tenant's settings row. Schedule a maintenance window when any of them is large.
- MusicChat id collisions (`20260928000026`): tenants whose settings (menu options or templates)
  already use an English id next to its legacy id keep both unchanged (and so do their
  conversations). List the candidates before promoting:
  `SELECT s.tenant_id, p.legacy, p.english FROM musicchat_automation_settings s CROSS JOIN LATERAL (SELECT array_agg(x.id) AS ids FROM (SELECT e->>'id' AS id FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.menu_options) = 'array' THEN s.menu_options ELSE '[]' END) e UNION SELECT e->>'id' FROM jsonb_array_elements(CASE WHEN jsonb_typeof(s.templates) = 'array' THEN s.templates ELSE '[]' END) e) x) u CROSS JOIN (VALUES ('producao','music_production'),('editora','publishing_distribution'),('financeiro','finance'),('conteudo','content'),('outros','other'),('engano','wrong_contact')) p(legacy, english) WHERE u.ids @> ARRAY[p.legacy, p.english];`
  (the used-id set is menu options plus templates, exactly as the migration computes it). Also
  review tenants that use an English id without its legacy one (their conversations keep a legacy
  `selected_menu_option`, since that English id is the tenant's own) and tenants whose
  `menu_options`/`templates` are not arrays (not remapped at all):
  `SELECT tenant_id FROM musicchat_automation_settings WHERE jsonb_typeof(menu_options) <> 'array' OR jsonb_typeof(templates) <> 'array';`

**Recovery:** every migration's `down()` reverses renames, keys and values.
- Release statuses/types (`20260928000019`) are restored from `metadata.legacy_status` /
  `legacy_type`, only while the row still holds the mapped canonical value; a status changed after
  `up()` is never reverted and a planted key is dropped, never applied.
- Artists/clients (`20260928000022`/`23`): `up()` copies each form field from metadata into its
  column (a key present in metadata wins, `null`/`''` clears the column) and then removes the
  copied key from metadata, so the column is the single copy (no stale plaintext PII). A value that
  does not fit (invalid date, over-long text, non-array jsonb) is set to NULL in the column and
  kept in metadata as historical data. `down()` writes every non-NULL column back to its legacy
  metadata key, so the pre-rename API sees the edits made after `up()`, and a re-apply re-derives
  the same columns — including edits and clears the old web made while rolled back.
  Clients follow the same rule; the older alias `cargo_responsavel` only fills a job title that is
  empty and that the current key `responsavel_cargo` does not carry (not even as `null` or as an
  over-long value kept in metadata); otherwise it is parked as `legacy_cargo_responsavel` (never
  read), so it cannot refill a cleared value on re-apply nor let `down()` overwrite a newer one.
  `interacoes` stored as JSON text is parsed like the artists' arrays. Dates are parsed from ISO or `dd/mm/yyyy` only when the text
  round-trips exactly (`00/00/1990` stays in metadata, the column stays NULL).
- `20260928000025` (org-chart slugs): `down()` reverts only rows that still carry the seeded
  default name. Run seeds after migrations (the seed writes the English slugs).
- `20260928000026` (MusicChat vocabulary, CZ-045): `conversations.metadata` service status,
  priority and selected option, and each tenant's `musicchat_automation_settings` option/template
  ids and priorities. Exact legacy values only; a default id is renamed only when the tenant does
  not already use the English target id (ids stay unique), and a conversation's selected option
  follows its tenant's map. `down()` maps every English default value back, including values the
  new build wrote after `up()` (that is what the old build reads); it cannot tell a default id from
  an identical id a tenant created after `up()` (such an `other` option goes back as `outros` when
  `outros` is free). Audit payloads (`musicchat_automation_events.payload`) keep the values of the
  build that wrote them and are never rewritten in either direction. The API maps the ids a pre-CZ-045
  web build sends with the same per-tenant rule and rejects a settings payload with duplicate ids.
- Proof on a disposable copy (refuses any database not named `*_mig`):
  `DB_SSL=false DATABASE_URL=…/musicos360_mig pnpm --filter @music-os-360/api verify:cz042-cz043-migrations`
  and `… verify:cz045-musicchat-migration` (each removes only the probe rows/tenants it created).
  Both run as the migration role, which must be superuser or `BYPASSRLS` (first pre-flight query).
  CI runs both on a fresh, seeded `musicos360_mig` in the `db-verify-fresh-postgres` job.

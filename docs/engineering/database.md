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

**Deploy order (mandatory):**
1. Stop (or drain) the API/worker pods — an old API against a renamed column fails every query of
   that table.
2. Run the pre-flight queries below against the target database and resolve anything they return.
3. `db:migrate`, then `db:check` (zero pending).
4. Start the new API/worker build.
5. Deploy the new web build. Until every browser reloads, an old web build keeps sending the
   pre-rename payload: the API accepts it as deprecated input (`*-legacy-fields.ts`), drops the
   values an old build could not have read on edit (form defaults, empty lists), and never lets an
   empty deprecated value overwrite a canonical one.

The reverse order (new web first) fails every save with 400/422 against the old API.

**Pre-flight queries (read-only):**
- Transactions whose `type` has no canonical equivalent — they would violate `chk_transactions_type`
  (added `NOT VALID`) on their next UPDATE:
  `SELECT type, count(*) FROM transactions WHERE lower(type) NOT IN ('receita','despesa','investimento','imposto','transferencia','revenue','expense','investment','tax','transfer') GROUP BY 1;`
  Fix or map those rows, then `ALTER TABLE transactions VALIDATE CONSTRAINT chk_transactions_type;`.
- Table sizes (the renames and remaps take an ACCESS EXCLUSIVE lock for the whole migration;
  each migration sets `lock_timeout = '15s'`): `SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname IN ('works','phonograms','transactions','artists','clients','releases');`
  Schedule a maintenance window when any of them is large.

**Recovery:** every migration's `down()` reverses renames, keys and values (release statuses/types
are restored from `metadata.legacy_status` / `legacy_type`). Metadata→column backfills are
forward-only; the metadata copy is never deleted, so a rollback loses nothing.

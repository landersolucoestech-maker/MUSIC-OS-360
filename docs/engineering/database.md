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
  each migration sets `lock_timeout = '15s'`): `SELECT relname, n_live_tup FROM pg_stat_user_tables WHERE relname IN ('works','phonograms','transactions','artists','clients','releases','conversations','musicchat_automation_settings');`
  Schedule a maintenance window when any of them is large.

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
  Clients follow the same rule; the older alias `cargo_responsavel` only fills an empty job title
  and is otherwise parked as `legacy_cargo_responsavel` (never read), so it cannot refill a
  cleared value on re-apply. Dates are parsed from ISO or `dd/mm/yyyy` only when the text
  round-trips exactly (`00/00/1990` stays in metadata, the column stays NULL).
- `20260928000025` (org-chart slugs): `down()` reverts only rows that still carry the seeded
  default name. Run seeds after migrations (the seed writes the English slugs).
- `20260928000026` (MusicChat vocabulary, CZ-045): `conversations.metadata` service status,
  priority and selected option, and each tenant's `musicchat_automation_settings` option/template
  ids and priorities. Exact legacy values only; a default id is renamed only when the tenant does
  not already use the English target id (ids stay unique). `down()` maps back exactly.
- Proof on a disposable copy (refuses any database not named `*_mig`):
  `DB_SSL=false DATABASE_URL=…/musicos360_mig pnpm --filter @music-os-360/api verify:cz042-cz043-migrations`
  and `… verify:cz045-musicchat-migration` (each removes only the probe rows/tenants it created).
  Both run as the migration role; with a role that does not bypass RLS the UPDATEs would match
  zero rows, so run migrations with the owner/bypass connection documented in `DATABASE_URL`.

**Known gap (not enforced by CI):** `.github/workflows/staging.yml` runs `db:migrate` while the
previous build is still serving; step 1 above (stop/drain) must be done by the operator until the
workflow gains a drain step (blocker BLK-DEPLOY-DRAIN-STEP).

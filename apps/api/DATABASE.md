# MUSIC OS 360 — Database Operations

## Stack
- **Engine**: PostgreSQL 15+ (Supabase)
- **ORM**: TypeORM 0.3.x
- **Migrations table**: `musicos360_migrations`
- **Schema governance**: versioned migrations, `synchronize: false` always

---

## Single source of migrations (canonical source)

**The official migrations of this project live exclusively in
`apps/api/src/database/migrations/` and are executed by the project's own
TypeORM runner (`db:migrate` / `db:check`, see [scripts/db-ops.ts](scripts/db-ops.ts)).
The canonical tracking of what has already been applied is the
`musicos360_migrations` table.**

There is no second, competing tracker, and there must never be one:

- `supabase/migrations/` holds only 2 old SQL files (initial snapshot plus one
  one-off reconciliation). **It is not the source of truth and must not be
  updated in parallel** with every new TypeORM migration. Do not create
  artificial backfills there just to "sync" with Supabase Branching: that
  would create exactly the double tracker this document exists to prevent,
  with no real gain (the schema is already validated by `db:check` + the
  fresh-DB CI).
- **Supabase Branching** (Supabase's native branch mechanism, visible in the
  dashboard) watches `supabase/migrations/` to decide a branch's status. Since
  this project never fed that mechanism, a branch status badge (e.g.
  `MIGRATIONS_FAILED` on the DEV branch) is **historical Supabase Branching
  metadata, unrelated to the real health of the schema**. It does not reflect
  pending migrations, broken RLS, or any current problem; it only reflects
  that Branching never recognized the real migration history (which lives
  entirely in `musicos360_migrations`).
- The real health of the database is determined by, in this order: `db:check`
  (zero pending migrations), the fresh-DB suite in CI (migrations apply
  cleanly on a new Postgres), and the RLS/tenant-isolation checks
  (`verify:rls`, `verify:tenant-isolation`), never by the Supabase branch
  status.
- No migration may be applied manually (loose SQL via editor/CLI) without
  going through the runner and being recorded in `musicos360_migrations`. An
  application that does not record the migration creates exactly the
  divergence between "real schema" and "official tracking" that this
  document exists to prevent.
- Do not edit Supabase internal tables (`supabase_migrations.*` or
  equivalents) to forge or "fix" a branch status. If Branching ever needs to
  recognize the real history, that is a separate architectural decision
  (deliberately backfill `supabase/migrations/`, or formally disable
  Branching for this project), not a manual edit of internal state.

A CI guard (`scripts/verify-migration-source-of-truth.mjs`) fails the build if
this single source is silently violated; see the CI section below.

### Single migration registry (resolved in Part 61)

`src/database/migrations/index.ts` exports `ALL_MIGRATIONS`, the only list of
migrations in the project. Both `src/database/datasource.ts` (the real runner
behind `db:migrate`/`db:check`/CI) and `src/database/database.module.ts` (the
NestJS application's `ADMIN_DATA_SOURCE`, used by `MigrationValidatorService`
to check pending migrations at boot) import exactly the same array.

This replaces a previous state where `datasource.ts` discovered migrations via
a glob (`migrations/*.{ts,js}`, always automatically up to date) while
`database.module.ts` kept its own explicit array, import by import, which
became **~50 migrations out of date** (nothing between `20260712000001` and
`20260719000025`) without anyone noticing, because nothing compared the two.
This is a real risk, not a cosmetic one: `MigrationValidatorService` uses that
array to decide at boot whether pending migrations exist (fatal in production);
an outdated array means this last-resort safety net is blind to exactly the
most recent migrations.

`scripts/verify-migration-source-of-truth.mjs` runs in CI and fails the build
if `migrations/index.ts` and the real contents of `migrations/` diverge again
(a file with no registry entry, or an entry with no matching file).

**When adding a new migration**: after generating the file (see "Normal
development flow" below), add the import + the entry in
`migrations/index.ts`. That is the only place to update; neither
`datasource.ts` nor `database.module.ts` needs any change.

---

## Prerequisites

Set the `DATABASE_URL` environment variable (in your secrets manager or local `.env`) before any operation:

```
DATABASE_URL=postgresql://postgres:<password>@<host>:5432/postgres
```

---

## Commands

```bash
# Apply all pending migrations (dev + production)
npm run db:migrate

# Revert the last migration (FORBIDDEN in production without CONFIRM_ROLLBACK)
npm run db:rollback

# Show migration state; exits with code 1 if any are pending
npm run db:check

# Populate the database with development data
npm run db:seed

# [DEV ONLY] Full drop + migrate + seed  (BLOCKED when NODE_ENV=production)
npm run db:reset

# Generate a new migration based on the TypeORM entities
npm run db:generate -- MigrationName
# Manually run the command printed as output by the script above
```

> Note: the repository's package manager is `pnpm` (see `.github/PULL_REQUEST_TEMPLATE.md`); the `npm run` form above is kept from the original document and the scripts are defined in `apps/api/package.json`, so `pnpm run <script>` is equivalent.

---

## Normal development flow

```
1. Change the entity in src/database/entities.ts
2. npm run db:generate -- ChangeDescription
3. Review the generated file in src/database/migrations/
4. Add the import + the entry in src/database/migrations/index.ts
   (verify-migration-source-of-truth.mjs fails CI if this step is forgotten)
5. npm run db:migrate
6. Test locally
7. Commit the migration file + the index.ts update together with the
   entity change
```

---

## Schema tables

> Partial, illustrative grouping: it does not list every table. The entity
> count below (138) is the verified figure; this table was not regenerated
> from `entities.ts` and may be missing tables added later.

| Group         | Tables                                                             |
|---------------|---------------------------------------------------------------------|
| Multi-tenant  | organizations, tenants, org_members, billing_subscriptions         |
| Catalog       | artists, works, phonograms, shares                                 |
| Contracts     | contracts, contract_templates                                      |
| Financial     | transactions, invoices                                             |
| CRM           | clients, leads, lead_interactions                                  |
| Marketing     | campaigns, briefings                                               |
| Operations    | events, projects, releases                                         |
| Monitoring    | takedowns, content_detections, ecad_reports, artist_goals         |
| HR            | employees, payroll_entries, leave_requests                         |
| Platform      | uploads, integrations, oauth_connections, webhook_events           |
| System        | audit_logs, ai_jobs, notifications, support_tickets                |

**Total: 138 tables** (count of `@Entity(...)` in `apps/api/src/database/entities.ts`)

---

## Security policies

### Migrations in production
- `synchronize: false` is hardcoded; never change it
- `db:reset` is blocked when `NODE_ENV=production`
- `db:rollback` in production requires `CONFIRM_ROLLBACK=YES_I_KNOW_WHAT_I_AM_DOING`
- `MigrationValidatorService` kills the process at boot if pending migrations exist in production

### Sensitive data
- `*_encrypted` fields hold data encrypted by the `EncryptionService`
- Never log or expose these fields raw

### Seeds
- Seeds run with `ON CONFLICT DO NOTHING`, so they are idempotent
- In production they require the explicit `--force` flag

---

## Adding a new migration

```bash
# 1. Make the change in the entity (entities.ts)
# 2. Generate the migration with the TypeORM CLI:
npx typeorm migration:generate \
  -d src/database/datasource.ts \
  src/database/migrations/$(date +%Y%m%d%H%M%S)_MigrationName

# 3. Check the generated SQL
# 4. Apply:
npm run db:migrate
```

---

## Naming conventions

| Type                | Pattern                                | Example                              |
|---------------------|----------------------------------------|--------------------------------------|
| Migration file      | `YYYYMMDDHHMMSS_PascalCase.ts`         | `20240615120000_AddArtistBio.ts`     |
| Class name          | `PascalCase + timestamp`               | `AddArtistBio20240615120000`         |
| Index               | `idx_<table>_<column(s)>`              | `idx_artists_tenant_id`              |
| Unique index        | `uq_<table>_<column(s)>`               | `uq_tenants_slug`                    |
| FK                  | `fk_<table>_<field>_<ref_table>`       | `fk_artists_tenant_id_tenants`       |

---

## Troubleshooting

**`DATABASE_URL not defined`**: set the environment variable in your secrets manager (not in `.env` in production).

**`Pending migrations exist`**: run `npm run db:migrate`.

**`Failed to connect to PostgreSQL`**: check that Supabase is up and `DATABASE_URL` is correct.

**`relation "xxx" already exists`**: the migration uses `IF NOT EXISTS`, so it can be safely re-run.

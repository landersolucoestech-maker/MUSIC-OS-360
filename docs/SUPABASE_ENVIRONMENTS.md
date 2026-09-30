# Supabase Environments Matrix

> Single source of decision on **which Supabase project each environment may use**.
> Born from the isolation incident of 2026-07-16/17 (a migration and a verification
> fixture were applied to the MAIN branch in the belief that it was DEV).

## Matrix (immutable per environment)

| NODE_ENV | Allowed ref | URL | Notes |
|---|---|---|---|
| `development` | `rypnevnfipygyhysqpdo` | https://rypnevnfipygyhysqpdo.supabase.co | **DEV** environment. The only one accepted locally. |
| `test` | *(no remote)* | — | No silent fallback: any resolved Supabase ref is an error. A local Postgres is allowed. |
| `staging` | `jjnnjnxjkqipgqebijen` | https://jjnnjnxjkqipgqebijen.supabase.co | Persistent **staging** environment. |
| `production` | `sxmfeocztlztvpdnxayk` | https://sxmfeocztlztvpdnxayk.supabase.co | Main project, used exclusively for production after formal release. |

The production ref `sxmfeocztlztvpdnxayk` corresponds to the main Supabase project (`main`). It must remain untouched until the promotion to production is formally approved.

Permanently banned refs:

- `mkyvkciwyhfawmvluugb` — preview branch without public tables;
- `sxdhnhoupjrnntrmjtyn` — first DEV branch, deleted;
- `jtizbxbrwyczbkdiruoq` — legacy/obsolete ref that does not belong to the current matrix.

## Selection rules

1. **Environment identity is the real project ref/hostname** extracted from `SUPABASE_URL`, `DATABASE_URL` and JWTs — never the `.env` file name, the directory or the declared intent.
2. Cross denylist: an environment's ref is explicitly forbidden in the others, even if someone edits the allowlist.
3. All variables (`SUPABASE_URL`, `VITE_SUPABASE_URL`, `DATABASE_URL`, `DIRECT_DATABASE_URL`, `APP_DATABASE_URL` and the JWTs' `payload.ref`) must point to the same project; a mismatch is a fatal error.
4. A `*.supabase.co/com` hostname without an extractable ref is an error.
5. The `production` environment only accepts `sxmfeocztlztvpdnxayk`.
6. No migration or change may be applied to the production project before formal release.

## Administrative confirmation procedure

Before pointing any environment at a ref:

1. Confirm via the Supabase dashboard or the management API which project the ref represents.
2. Record the confirmation in the PR that changes the constants.
3. Update the three validators together:
   - `apps/api/src/core/config/env.schema.ts`;
   - `scripts/env-check.mjs`;
   - `apps/web/scripts/assert-supabase-env.mjs`.
4. Update the matrix tests and the workflows that contain hardcoded refs.

## Where the guard acts

- **API boot** (`main.ts` → `collectSupabaseEnvErrors`): fail-closed.
- **Repository gate** (`pnpm env:check` → `scripts/env-check.mjs`).
- **Frontend dev/build** (`assert-supabase-env.mjs` via Vite).
- **Tests** (`env.schema.spec.ts`).
- **CI/CD**, before build, migrations or deploy.

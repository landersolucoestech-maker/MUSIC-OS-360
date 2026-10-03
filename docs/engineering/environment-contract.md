# Environment contract (development, staging, production)

Names, presence, requirement, defaults and validation only: no value appears in this document or in the matrix. The matrix is generated: `pnpm env:contract:report` writes `env-contract-matrix.md` and `env-contract-matrix.tsv` next to this file; `pnpm env:contract` is the gate (also in CI).

## How development works (traced, not assumed)

`LOCAL DEVELOPMENT -> ENV LOADER -> ENV VALIDATION -> API/WEB -> DATABASE / EXTERNAL SERVICES`

| Step | API (`apps/api`) | Web (`apps/web`) |
|---|---|---|
| Local file (gitignored, real values) | `apps/api/.env.development`, then `<cwd>/.env.development` (the repository root when started from there) | `apps/web/.env.development` (Vite loads it for mode `development`; Vite's own `.local` variants also apply) |
| Template (versioned, placeholders only) | `apps/api/.env.development.example`, root `.env.development.example` (dev-only switches and the root fallback) | `apps/web/.env.development.example` |
| Loader | `src/main.ts` (dependency-free loader, runs before any module); `src/database/datasource.ts` and the CLI scripts use `dotenv` (declared in `apps/api/package.json`) with the same two paths | Vite (`scripts/run-vite.mjs`) |
| Precedence | a variable already present in `process.env` always wins; the first file wins over the second; nothing reads a bare `.env` | process env, then `.env.[mode].local`, `.env.[mode]`, `.env.local`, `.env` (Vite rules) |
| Validation | `validateEnv` (zod schema in `src/core/config/env.schema.ts`, the single authority) at boot; `assertDatabaseCommandEnv` before any database command | `apps/web/scripts/assert-supabase-env.mjs` before dev, build and preview |
| Repository gate | `pnpm env:check` validates the local files (it requires `apps/web/.env.development`) | same |
| Environment isolation | `development` accepts only the DEV Supabase ref, `staging` the STAGING ref, `production` the PROD ref, `test` none; a ref of another environment is refused everywhere | same matrix, mirrored |

Staging and production are different: the files do not exist there. Variables come from the hosting platform, CI secrets or `docker -e`, and `.env.staging` / `.env.production` are placeholder-only documentation of the required set. Nothing loads them.

## Answers to the audit questions

1. Development works from two gitignored local files (`apps/api/.env.development`, `apps/web/.env.development`), plus `process.env`.
2. Those two files provide the configuration; the root `.env.development` is an optional fallback for runs started from the repository root (`env:check` merges it under the API file).
3. The contract for `development` was explicit in code (schema, `env:check`, the Supabase ref matrix) but not in any template of the two apps; the root example documented only the dev-only switches.
4. Development does not depend on `.env` (nothing reads it; two scripts did and were fixed) nor on `.env.local` for the API (Vite reads `.env.local` for the web only).
5. Hardcoded defaults exist and are catalogued in the matrix (`DEFAULT` column): schema defaults (`PORT`, `NODE_ENV`, session-context flag, the documented all-zero `ENCRYPTION_KEY` default that staging and production reject), module fallbacks (pool sizes; the queue dashboard's local-only credentials, refused in production-like environments), and the web API base URL fallback.
6. API and web diverged in their loaders (see "Defects found"), not in names: every `VITE_*` the web reads is documented in the three web templates.
7. Staging and production templates already formed a contract (same variable set for the API, same for the web); development now mirrors it.
8. The absence of a versioned `.env.development` is intentional: the real file holds real local secrets and is gitignored on purpose (`.gitignore`: "no negation for it"). The convention for its template is `*.example` (`!.env.*.example`), which the root already used; the apps had no such template, which was a documentation gap, now closed with `apps/api/.env.development.example` and `apps/web/.env.development.example`.
9. No `.env.development` was created: only placeholder-only `.example` templates were added.

## Rules enforced by `pnpm env:contract`

- the nine templates exist (root, API and web, each for development, staging and production);
- the API and web templates of staging and production document the same names; development documents every name both document (active or commented); environment-specific variables are declared with a reason in `scripts/env-contract.config.json` and never forced equal;
- every variable the schema requires in production, or `env:check` requires locally, is documented for every environment;
- every `process.env` read of the API source is validated by the schema or declared (seed and CLI inputs, with a reason); every template variable is validated, declared, or pending with a reason;
- every `VITE_*` the web source reads is in the three web templates (the build-injected commit id is declared);
- no template line carries a secret-shaped value (a JWT counts only with its signature part);
- no script reads a bare `.env` and none uses `dotenv` without declaring it;
- no schema or loader default hides a secret-named variable without a documented acceptance;
- active documentation names no variable that nothing defines.

The refs, the denylist and the web bypass flags are mirrored in `env.schema.ts`, `scripts/env-check.mjs` and `apps/web/scripts/assert-supabase-env.mjs`; `supabase-refs-agreement.spec.ts` and `bypass-flags-agreement.spec.ts` prove they agree.

## Defects found and fixed by this audit

- `scripts/env-check.mjs` threw `ReferenceError: webMock is not defined` on a fully valid environment (a reference to a removed flag), so `pnpm env:check` could never succeed. Fixed, with end-to-end tests including mutation cases.
- `dotenv` was used by `datasource.ts` and eighteen files but not declared by `apps/api`; it did not resolve, so wherever it sat in a `try/catch` the local file was silently not loaded (db commands then needed exported variables). Declared as `dotenv@16.4.5`, the version already resolved by `@nestjs/config`: one importer line in the lockfile, no new package.
- `apps/api/seed.ts` and `scripts/verify-signup-provisioning.ts` read a bare `.env` while their own messages and the docs said `.env.development`. Fixed to the common contract.
- Fourteen operational variables were read by modules but not validated (`DB_SSL`, `DB_POOL_*`, `ADMIN_QUEUES_*`, `METRICS_TOKEN`, `RATE_LIMIT_TRUST_PROXY`, `RBAC_CANONICAL_ROLE_WRITE`, `REGISTRY_*_ENABLED`, `EXTERNAL_DATA_WEBHOOK_SECRET`, `BUILD_SHA`, `DIRECT_DATABASE_URL`): now in the schema; a malformed value fails at boot.
- Documentation named a removed flag (a mock flag removed long ago) as refused by the schema and told developers to copy the production web template over the development file and to put `/api/v1` in `VITE_API_URL` (the client appends it); corrected.
- The development example documented only a subset; it was incomplete against `env:check` (no database, Supabase or `VITE_*` entries).

## Declared pending (protected files)

Items that need an edit to a protected template (`.env.production`, `.env.staging`, `apps/api/.env.*`, beyond the comment translation the owner authorized) are listed with their reason in `scripts/env-contract.config.json` (`pendingTemplateCleanup`, `pendingTemplateAdditions`) and printed by the gate: an unread variable (`OPENAI_BASE_URL`) in the root production template, and thirteen optional variables the schema validates but the staging and production API templates do not document yet. They do not fail the gate; they are not hidden.

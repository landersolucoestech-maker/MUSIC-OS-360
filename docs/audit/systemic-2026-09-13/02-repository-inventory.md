# Repository Inventory Ledger

Baseline: `dev@506de92fbcb1cd0a9a67b27e0a90bb41f3ce9f48`

Status: **IN AUDIT**. This ledger is deliberately incremental. Items not yet expanded remain `IN AUDIT`; no unexpanded tree is being treated as clean or complete.

## Root

| Path | Type | Layer / purpose | Audit status | Evidence / note |
|---|---|---|---|---|
| `.claude/` | directory | tooling | IN AUDIT | root tree |
| `.config/` | directory | tooling/config | IN AUDIT | root tree |
| `.dockerignore` | file | container config | NOT STARTED | root tree |
| `.env.production` | file | versioned placeholder env template | AUDITED WITH FINDINGS | placeholder nature confirmed; runtime values not inferred |
| `.env.staging` | file | versioned placeholder env template | IN AUDIT | root tree |
| `.github/` | directory | CI/CD | IN AUDIT | workflows enumerated below |
| `.gitignore` | file | repository hygiene | AUDITED WITH FINDINGS | versioned env-template exceptions confirmed |
| `.gitleaks.toml` | file | secret scanning | NOT STARTED | root tree |
| `CLAUDE.md` | file | tool/project instructions | NOT STARTED | root tree |
| `apps/` | directory | applications | IN AUDIT | `api`, `web` |
| `docker-compose.observability.yml` | file | observability runtime | NOT STARTED | root tree |
| `docker-compose.prod-test.yml` | file | production-like testing | NOT STARTED | root tree |
| `docker-compose.yml` | file | local/runtime orchestration | NOT STARTED | root tree |
| `docs/` | directory | active/historical documentation | IN AUDIT | large tree; expansion ongoing |
| `e2e/` | directory | Playwright end-to-end tests | IN AUDIT | 8 specs enumerated below |
| `eslint.config.js` | file | lint config | NOT STARTED | root tree |
| `infra/` | directory | infrastructure/observability scripts | IN AUDIT | immediate children enumerated |
| `package.json` | file | monorepo manifest/scripts | AUDITED WITH FINDINGS | pnpm/Turbo workspace and release commands inspected |
| `packages/` | directory | shared workspaces | IN AUDIT | 8 packages enumerated below |
| `playwright.config.ts` | file | E2E config | NOT STARTED | root tree |
| `pnpm-lock.yaml` | file | dependency lockfile | IN AUDIT | full dependency audit pending |
| `pnpm-workspace.yaml` | file | workspace + overrides | AUDITED WITH FINDINGS | workspace/overrides inspected; package-level consumers pending |
| `public/` | directory | public assets | IN AUDIT | root tree |
| `reports/` | directory | repository reports/artifacts | IN AUDIT | classification pending |
| `scripts/` | directory | operational/release/audit scripts | IN AUDIT | immediate files enumerated below |
| `server/` | directory | root server helper | IN AUDIT | contains `ai-proxy.ts` |
| `supabase/` | directory | Supabase config/migrations | IN AUDIT | immediate children enumerated |
| `tsconfig.app.json` | file | TypeScript config | NOT STARTED | root tree |
| `tsconfig.json` | file | TypeScript config | NOT STARTED | root tree |
| `tsconfig.node.json` | file | TypeScript config | NOT STARTED | root tree |
| `turbo.json` | file | monorepo task graph | NOT STARTED | root tree |

## Applications

### `apps/api`

Immediate inventory discovered:

- `.env.production` — placeholder environment template — IN AUDIT
- `.env.staging` — placeholder environment template — IN AUDIT
- `.gitignore` — repository hygiene — NOT STARTED
- `DATABASE.md` — documentation — NOT STARTED
- `Dockerfile` — container build — NOT STARTED
- `SECURITY_ARCHITECTURE.md` — documentation — NOT STARTED
- `bootstrap.cjs` — runtime bootstrap — NOT STARTED
- `drizzle/` — database artifact/source — IN AUDIT
- `jest.config.ts` — test config — NOT STARTED
- `jest.e2e.config.ts` — E2E/API test config — NOT STARTED
- `migrate.mjs` — migration tooling — NOT STARTED
- `migrations-complete-clean.sql` — empty SQL artifact — HISTORICAL/ARTIFACT CLASSIFICATION PENDING
- `migrations-complete.sql` — large SQL artifact — IN AUDIT
- `migrations-temp.sql` — empty SQL artifact — HISTORICAL/ARTIFACT CLASSIFICATION PENDING
- `package.json` — application manifest/scripts — AUDITED WITH FINDINGS
- `scripts/` — operational/database/security verification scripts — IN AUDIT
- `seed-operational.sql` — seed — NOT STARTED
- `seed.mjs` — seed — NOT STARTED
- `seed.ts` — seed — NOT STARTED
- `setup-supabase-complete.sql` — database setup artifact — NOT STARTED
- `src/` — application source — IN AUDIT
- `supabase-jwt-hook.sql` — auth/database hook — NOT STARTED
- `supabase-rls.sql` — RLS/policy artifact — IN AUDIT
- `test/` — API tests/harnesses — IN AUDIT
- `tsconfig.build.json` — TypeScript config — NOT STARTED
- `tsconfig.json` — TypeScript config — NOT STARTED

API source immediate inventory:

- `app.module.ts` — Nest application composition — IN AUDIT
- `bootstrap.spec.ts` — test — NOT STARTED
- `cache/` — cache subsystem — IN AUDIT
- `common/` — shared application code — IN AUDIT
- `core/` — auth/config/guards/interceptors/realtime/etc. — IN AUDIT
- `create-app.ts` — HTTP bootstrap — IN AUDIT
- `database/` — persistence/migrations/data source — IN AUDIT
- `instrument.ts` — observability bootstrap — IN AUDIT
- `main.ts` — process entrypoint — IN AUDIT
- `modules/` — domain modules — IN AUDIT
- `queues/` — async/queue subsystem — IN AUDIT
- `storage/` — storage/upload subsystem — IN AUDIT

API module directories already discovered (tree expansion continues):

`activity-logs`, `admin-users`, `ai`, `analytics`, `artist-goals`, `artists`, `assets`, `audiovisual`, `audit-log`, `auth`, `billing`, `briefings`, `campaigns`, `clients`, `company-settings`, `contact-attachments`, `contact-contracts`, `contact-timeline`, `contacts`, `content-detections`, `contract-service-types`, `contract-templates`, `contracts`, `conversations`, `ecad-reports`, `events`, `finance-category-rules`, `financial-categories`, `financial-rules`, `financial`, `health`, `hr`, `integrations`, `internal-chat`, `inventory`, `invoices`, `knowledge-base`, `lead-interactions`, `leads`, `licensing`, `marketing`, `notifications` and additional entries still being expanded from the source tree.

### `apps/web`

Immediate inventory discovered:

- `.env.production`, `.env.staging` — versioned placeholder env templates — IN AUDIT
- `.gitignore` — NOT STARTED
- `Dockerfile` — NOT STARTED
- `apps/` — nested application content — IN AUDIT
- `components.json` — component tooling config — NOT STARTED
- `index.html` — frontend entry HTML — NOT STARTED
- `nginx.conf` — serving config — NOT STARTED
- `package.json` — application manifest — AUDITED WITHOUT FINDINGS SO FAR
- `postcss.config.js` — NOT STARTED
- `public/` — assets — IN AUDIT
- `scripts/` — frontend tooling/env guards — IN AUDIT
- `src/` — frontend source — IN AUDIT
- `tailwind.config.ts` — design-system/config — IN AUDIT
- `tsconfig.app.json`, `tsconfig.json`, `tsconfig.node.json` — NOT STARTED
- `vite.config.mjs` — build/runtime config — AUDITED WITHOUT FINDINGS SO FAR
- `vitest.config.mjs`, `vitest.config.ts` — test configs — IN AUDIT (duplicate-authority assessment pending)

Web source immediate inventory:

- `ARCHITECTURE.md` — documentation — NOT STARTED
- `App.tsx` — routing/application composition — IN AUDIT
- `app/` — app shell/config — IN AUDIT
- `assets/` — static assets — IN AUDIT
- `constants/` — constants — IN AUDIT
- `index.css` — global styles/tokens — IN AUDIT
- `lib/` — shared libraries — IN AUDIT
- `main.tsx` — frontend entrypoint — IN AUDIT
- `modules/` — feature modules — IN AUDIT
- `shared/` — shared components/services — IN AUDIT
- `test/` — test utilities/tests — IN AUDIT
- `types/` — local types — IN AUDIT
- `vite-env.d.ts` — generated/tooling type declaration — GENERATED/TOOLING CLASSIFICATION PENDING

Web module directories (complete immediate module-tree enumeration):

`accounting`, `admin`, `artist`, `audiovisual`, `auth`, `catalog`, `contracts`, `crm-relationships`, `dashboard`, `events`, `integrations`, `inventory`, `leads`, `licensing`, `marketing`, `monitoring`, `musicchat-interno`, `musicchat`, `projects`, `releases`, `reports`, `rh`, `settings`, `support`, `workspace`.

All remain `IN AUDIT`; the non-English developer-facing names are candidates for the technical-English hard-enforcement audit, not yet individually remediated.

## Shared packages

The workspace contains the following package roots, all currently `IN AUDIT`:

1. `packages/ai-skills`
2. `packages/auth`
3. `packages/config`
4. `packages/observability`
5. `packages/schemas`
6. `packages/types`
7. `packages/ui`
8. `packages/utils`

## CI/CD workflows

Complete immediate workflow inventory:

| Path | Status | Current audit result |
|---|---|---|
| `.github/workflows/backup.yml` | AUDITED WITH FINDINGS | `AUD-OPS-001`, `AUD-OPS-002`, `AUD-OPS-003` |
| `.github/workflows/ci.yml` | AUDITED WITH FINDINGS | branch governance/topology findings; deeper job-by-job audit ongoing |
| `.github/workflows/security.yml` | IN AUDIT | pending full read |
| `.github/workflows/staging.yml` | AUDITED WITH FINDINGS | depends on absent `staging` branch |
| `.github/workflows/technical-english-normalization.yml` | IN AUDIT | pending full read |
| `.github/PULL_REQUEST_TEMPLATE.md` | NOT STARTED | documentation/governance |

## Root E2E suite

Complete immediate inventory:

1. `e2e/clients-import-template.spec.ts`
2. `e2e/crm-no-mocks.spec.ts`
3. `e2e/crm-timeline-persistence.spec.ts`
4. `e2e/login-and-password-change.spec.ts`
5. `e2e/p84-product-walkthrough.spec.ts`
6. `e2e/p85-auth-disabled-walkthrough.spec.ts`
7. `e2e/p86-reports-centralization.spec.ts`
8. `e2e/reports-export.spec.ts`

All are `IN AUDIT`; execution is currently blocked by the lack of a runnable local checkout in the available container.

## Root operational scripts discovered

The root `scripts/` tree currently includes the following immediate items:

- `check-production-source.mjs`
- `cleanup/`
- `db-verify-gate.mjs`
- `db-verify-gate.test.mjs`
- `dependency-audit-waivers.json`
- `env-check.mjs`
- `generate-blueprint-appendices.mjs`
- `pg-backup-cron.sh`
- `pg-backup.sh`
- `pg-restore.sh`
- `phase2-crud-validation.mjs`
- `post-merge.sh`
- `release-check.mjs`
- `run-technical-english-normalization.mjs`
- `runtime-visual-validation.mjs`
- `set-staging-secrets.sh`
- `test-gitleaks-docs-coverage.sh`
- `test-pg-backup-cron.sh`
- `verify-body-limit-guard.mjs`
- `verify-branch-topology.mjs`
- `verify-critical-workflows.mjs`
- `verify-db-verify-gate-wiring.mjs`
- `verify-db-verify-gate-wiring.test.mjs`
- `verify-migration-source-of-truth.mjs`
- `verify-migration-source-of-truth.test.mjs`
- `verify-production-audit.mjs`
- `verify-production-audit.test.mjs`
- `verify-staging-secrets-presence.mjs`
- `verify-staging-secrets-presence.test.mjs`
- `verify-xlsx-only.mjs`

The tree response was complete for this directory. Individual audit statuses are tracked during the scripts/CI phase; `release-check.mjs`, `pg-backup-cron.sh`, `env-check.mjs`, `verify-branch-topology.mjs`, and `verify-critical-workflows.mjs` have already been read.

## Other discovered roots

- `server/ai-proxy.ts` — IN AUDIT.
- `supabase/config.toml` — IN AUDIT.
- `supabase/migrations/` — IN AUDIT.
- `infra/observability/` — IN AUDIT.
- `infra/scripts/` — IN AUDIT.
- `docs/` — large documentation corpus including architecture, governance, auth/RBAC, RLS/tenant isolation, runbooks, infrastructure, design-system, and historical audit documents. Full file-by-file classification is still in progress.

## Inventory completeness rule

This file is not a completion claim. Audit closure is prohibited until every relevant descendant item has been expanded and assigned one of the allowed final audit statuses, and the final metrics can be derived from evidence rather than estimation.

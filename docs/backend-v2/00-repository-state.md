> Historical record. Kept as recorded; not the current contract.

# 00 — Estado Atual do Repositório

Documento gerado por inspeção read-only. Nenhuma alteração foi feita em `apps/web`, `apps/api`, banco de dados, Supabase, dependências ou migrations durante esta análise.

## Data/hora da análise

2026-08-07 20:35 (horário local da máquina, timezone do sistema não confirmado — `date` retornou `Fri Aug 7 20:35:53 2026`)

## Branch

`dev`

## Commit HEAD

```
faba7511a605f8f265c984a5becef780fea7a812
2026-08-06 19:04:13 -0300
ci: enforce branch policy on pull requests
```

Branch `dev` está sincronizada com `origin/dev` (`git status` reporta "Your branch is up to date with 'origin/dev'").

Aviso do Git observado ao rodar comandos de log/status: `warning: unable to find all commit-graph files` (não investigado — apenas registrado).

## Git status (working tree)

**34 arquivos modificados/deletados, não staged**, mais um diretório novo não rastreado (`reports/`):

```
Changes not staged for commit:
	deleted:    .agents/agent_assets_metadata.toml
	modified:   .env.example
	modified:   .env.staging.example
	modified:   .github/workflows/ci.yml
	modified:   .github/workflows/staging.yml
	modified:   apps/api/.env.dev.example
	modified:   apps/api/.env.example
	modified:   apps/api/.env.production.template
	modified:   apps/api/SECURITY_ARCHITECTURE.md
	modified:   apps/api/migrate.mjs
	modified:   apps/api/scripts/verify-supabase.ts
	modified:   apps/api/seed.mjs
	modified:   apps/api/src/app.module.ts
	modified:   apps/api/src/core/config/env.schema.ts
	modified:   apps/api/src/core/decorators/permissions.decorator.ts
	modified:   apps/api/src/core/guards/auth.guard.ts
	modified:   apps/api/src/core/guards/crud-permission-metadata.spec.ts
	modified:   apps/api/src/core/guards/permissions.guard.spec.ts
	modified:   apps/api/src/core/rbac/rbac-authority-mode.ts
	modified:   apps/api/src/core/security/security-startup.service.ts
	modified:   apps/api/src/core/security/token-verifier.service.ts
	modified:   apps/api/src/modules/integrations/spotify/spotify.service.ts
	modified:   apps/api/test/rbac-shadow-harness/rbac-shadow-harness.config.ts
	modified:   apps/web/.env.example
	modified:   docker-compose.yml
	modified:   docs/ENTERPRISE_INFRASTRUCTURE.md
	modified:   docs/PROVISIONING_GUIDE.md
	modified:   docs/RUNBOOK_INCIDENT.md
	modified:   docs/SRE_RUNBOOK.md
	modified:   docs/STAGING_ARCHITECTURE.md
	modified:   docs/runbooks/release-baseline-157-80.md
	modified:   scripts/env-check.mjs
	modified:   scripts/verify-staging-secrets-presence.mjs
	modified:   server/ai-proxy.ts

Untracked files:
	reports/
```

`git diff --stat` confirma: 34 arquivos, 95 inserções, 158 deleções no total.

> **Observação factual (não corrigida, apenas registrada):** este working tree já contém alterações não commitadas em `apps/api/src/app.module.ts`, `apps/api/src/core/guards/*`, `apps/api/src/core/rbac/*`, `apps/api/src/core/security/*` e outros arquivos de `apps/api` antes de qualquer trabalho de `backend-v2` começar. A origem exata dessas alterações não foi determinada nesta etapa (não fazia parte do escopo desta tarefa investigar autoria/causa). Registrado aqui porque é um fato relevante do estado do repositório no momento desta análise.

## Package manager

`pnpm@10.11.0` (campo `packageManager` em `package.json`, raiz do monorepo). `node_modules/` presente na raiz.

## Workspace

Definido em `pnpm-workspace.yaml` e espelhado em `package.json` (`workspaces`):

- `apps/*`
- `packages/*`

`pnpm-workspace.yaml` também define uma seção `overrides` com pins de segurança para várias dependências transitivas (ex.: `js-yaml`, `multer`, `ws`, `qs`, `lodash`, `@opentelemetry/core`, `protobufjs`, `brace-expansion`, `body-parser`, `uuid`, `socket.io-parser`).

Orquestração de build/typecheck/test entre pacotes: `turbo.json` (tasks `build`, `dev`, `lint`, `typecheck`, `test`; `build`/`typecheck`/`test` declaram `dependsOn: ["^build"]`).

## Aplicações identificadas

- **apps/web** — `apps/web/` (frontend). `package.json` name: `@music-os-360/web`.
- **apps/api** — `apps/api/` (backend). `package.json` name: `@music-os-360/api`.

## Pacotes internos (`packages/*`)

- `packages/ai-skills` → `@music-os-360/ai-skills`
- `packages/auth` → `@music-os-360/auth`
- `packages/config` → `@music-os-360/config`
- `packages/observability` → `@music-os-360/observability`
- `packages/schemas` → `@music-os-360/schemas`
- `packages/types` → `@music-os-360/types`
- `packages/ui` → `@music-os-360/ui`
- `packages/utils` → `@music-os-360/utils`

## Scripts disponíveis — `package.json` raiz

```
dev, dev:api, dev:web, build, typecheck, lint, test, test:coverage, test:e2e,
monorepo:dev, monorepo:build, monorepo:typecheck, monorepo:lint,
repo:clean:dry, repo:clean, env:check, cleanup:check,
verify:critical-workflows, verify:xlsx-only, release:check, release:migrate
```

## Scripts disponíveis — `apps/api/package.json`

```
dev, start:dev, build, start, lint, typecheck,
test, test:watch, test:coverage, test:ci, test:e2e,
db:migrate, db:migrate:application, db:rollback, db:seed, db:bootstrap:tenant-zero,
db:reset, db:check, db:check:application, db:generate, db:seed:operational,
verify:realtime-external, verify:supabase, verify:rls, verify:critical-rls,
verify:migrations, verify:canonical-order, verify:tenant-isolation,
verify:contract-service-types, smoke-test, provision, dump:sql, storage:e2e,
rbac:shadow:run, rbac:shadow:go-no-go, validate:i18n, reports:smoke,
rbac:readiness, verify:signup-provisioning, verify:no-inline-body,
verify:production-flags
```

## Scripts disponíveis — `apps/web/package.json`

```
dev, build, preview, typecheck, lint, test, test:watch, test:run
```

## Arquivos de configuração relevantes

- `pnpm-workspace.yaml` — definição do workspace + overrides de dependências.
- `turbo.json` — pipeline de build/lint/typecheck/test entre pacotes.
- `tsconfig.json` (raiz, project references para `apps/web/tsconfig.app.json` e `apps/api/tsconfig.json`), `tsconfig.app.json`, `tsconfig.node.json`.
- `eslint.config.js` — lint (raiz, flat config).
- `playwright.config.ts` — testes e2e.
- `docker-compose.yml`, `docker-compose.observability.yml`, `docker-compose.prod-test.yml`.
- `.env`, `.env.example`, `.env.staging.example` (raiz) + `.env.example` próprios em `apps/api/` (`.env.dev.example`, `.env.example`, `.env.production.template`) e `apps/web/.env.example`.
- `.gitleaks.toml` — configuração de detecção de segredos.
- `.github/workflows/{ci.yml, staging.yml, security.yml, backup.yml}` — pipelines de CI/CD.
- `supabase/config.toml` + `supabase/migrations/` (2 arquivos SQL congelados — não é a fonte canônica de migrations; ver `apps/api/src/database/migrations/` para o sistema real, conforme `scripts/verify-migration-source-of-truth.mjs`).

## Diretórios de topo do repositório

```
.agents  .claude  .config  .git  .github  .local  .secrets  .turbo
apps  dist  docs  e2e  infra  node_modules  packages  public
reports  scripts  server  supabase  test-results
```

Documentação solta na raiz (não organizada em `docs/`): `ARCHITECTURE_DECISION_RECORDS.md`, `BACKLOG.md`, `CLEANUP_REPORT.md`, `DESIGN_SYSTEM_UI_UX.md`, `EXECUTIVE_SUMMARY.md`, `GOVERNANCE.md`, `INDEX_DOCUMENTATION.md`, `STRUCTURAL_MAP.md`, `PHASE_1_IMPLEMENTATION_GUIDE.md`, `QUICK_START_GUIDE.md`, `README.md`, `RESTRUCTURING_OPERATIONAL_ARCHITECTURE.md`, `ROADMAP_IMPLEMENTATION.md`.

## Problemas encontrados

1. **Working tree não está limpo antes do início do trabalho de `backend-v2`.** 34 arquivos com alterações não commitadas, incluindo arquivos centrais de `apps/api` (`app.module.ts`, guards, RBAC, security). Ver seção "Git status" acima para a lista completa e a observação factual. Isso é relevante para qualquer execução futura que dependa de comparar o estado "antes" vs "depois" de `apps/api` — o "antes" real já diverge do commit HEAD.
2. Não foi possível confirmar o timezone efetivo do `date` do sistema (retornou apenas o horário local sem timezone explícito na saída).

## NENHUM OUTRO ARQUIVO FOI ALTERADO

Confirmado: apenas `docs/backend-v2/00-repository-state.md` foi criado nesta etapa. Nenhum arquivo em `apps/web`, `apps/api`, banco de dados, Supabase, dependências, migrations ou qualquer outro caminho foi alterado.

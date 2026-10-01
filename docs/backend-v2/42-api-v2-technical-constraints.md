> Historical record. Kept as recorded; not the current contract.

# 42 — Restrições Técnicas para `apps/api-v2`

Inventário read-only das restrições técnicas reais já existentes no repositório, para uso posterior no desenho de `apps/api-v2`. Nenhuma arquitetura foi definida, nenhum framework/ORM/migration tool foi escolhido, `apps/api-v2` não foi criado, nenhuma dependência foi instalada/atualizada, `apps/web` e `apps/api` (legacy) não foram alterados.

---

## RUNTIME

```text
NODE_VERSION:
20 (não fixado por .nvmrc/.node-version/.tool-versions na raiz nem por "engines" em nenhum package.json — mas fixado consistentemente em 3 lugares independentes: apps/api/Dockerfile:2 "FROM node:20-alpine3.21", apps/web/Dockerfile:1 "FROM node:20-alpine3.21", e .github/workflows/ci.yml:18 + security.yml:18 "NODE_VERSION: \"20\"" + staging.yml (3 ocorrências "node-version: 20"))

MODULE_SYSTEM:
MIXED — apps/web é ESM ("type": "module" em apps/web/package.json:6 e no package.json raiz:7); apps/api compila para CommonJS (apps/api/tsconfig.build.json:3 "module": "commonjs", confirmado pelo entrypoint Docker apps/api/Dockerfile:59 "CMD [\"dist/bootstrap.cjs\"]")
```

## PACKAGE MANAGER

```text
PACKAGE_MANAGER:
pnpm

VERSION:
10.11.0 (fixada em package.json:5 "packageManager": "pnpm@10.11.0", e reforçada via corepack em ambos os Dockerfiles: "corepack prepare pnpm@10.11.0 --activate")

LOCKFILE:
pnpm-lock.yaml (raiz)
```

## WORKSPACE

```text
WORKSPACE_SYSTEM:
pnpm workspaces (pnpm-workspace.yaml: "apps/*", "packages/*") + Turborepo (turbo.json, tarefas build/dev/lint/typecheck/test) — os dois coexistem; os scripts npm do package.json raiz ("dev", "build", "typecheck", "test") chamam pnpm --filter diretamente nos dois apps, enquanto os scripts "monorepo:*" chamam "turbo run <task>"

APPLICATIONS:
- apps/api (@music-os-360/api — NestJS)
- apps/web (@music-os-360/web — Vite/React)

SHARED_PACKAGES:
- packages/ai-skills (@music-os-360/ai-skills)
- packages/auth (@music-os-360/auth)
- packages/config (@music-os-360/config)
- packages/observability (@music-os-360/observability)
- packages/schemas (@music-os-360/schemas)
- packages/types (@music-os-360/types)
- packages/ui (@music-os-360/ui)
- packages/utils (@music-os-360/utils)
```

## TYPESCRIPT

```text
TYPESCRIPT_VERSION:
MIXED — raiz e apps/web fixam "^5.8.3" (package.json raiz devDependencies:48, apps/web/package.json devDependencies:77); apps/api fixa separadamente "^5.3.3" (apps/api/package.json devDependencies:107) — versões não unificadas entre os 2 apps

ROOT_TSCONFIG:
tsconfig.json (raiz — apenas "references" para apps/web/tsconfig.app.json e apps/api/tsconfig.json, sem compilerOptions completas)

API_RELEVANT_TSCONFIGS:
- apps/api/tsconfig.json (module: commonjs, target: ES2021, emitDecoratorMetadata: true, experimentalDecorators: true — estilo NestJS clássico; strictNullChecks/noImplicitAny/strictBindCallApply true, mas não "strict" completo)
- apps/api/tsconfig.build.json (extends tsconfig.json, exclui *.spec.ts/*.e2e-spec.ts)

PATH_ALIASES:
- "@/*" → apps/api/src/* (uso interno do próprio app api, via jest.config.ts moduleNameMapper e tsconfig-paths/register no script dev)
- "@shared-types/*" → packages/shared-types/src/* (apps/api/tsconfig.json:21 — aponta para um pacote "shared-types" que NÃO existe na lista atual de packages/*; alias morto/histórico, registrado como achado, não corrigido)
- "@music-os-360/types" e "@music-os-360/types/*" → packages/types/src/* (resolvido tanto em tsconfig quanto em jest moduleNameMapper)
- "@music-os-360/ai-skills" e "@music-os-360/ai-skills/*" → packages/ai-skills/src/* (idem)
- apps/web usa "@" → apps/web/src (vitest.config.mjs:12; padrão Vite, não documentado aqui em detalhe por estar fora do escopo "API-relevant")
```

## QUALITY TOOLING

```text
LINTER:
ESLint 9 (flat config, eslint.config.js na raiz) — typescript-eslint + eslint-plugin-react-hooks + eslint-plugin-react-refresh; regras notavelmente relaxadas para "warn" (no-explicit-any, ban-ts-comment, no-unused-expressions, no-require-imports, no-empty-object-type) e "@typescript-eslint/no-unused-vars" totalmente "off" — comentário no próprio arquivo (linha 40-41) identifica isso como "dívida de lint pré-existente" aceita conscientemente. apps/api tem seu próprio script "lint": "eslint src --ext .ts" que reutiliza a config raiz.

FORMATTER:
NONE — nenhum arquivo prettier* encontrado na raiz nem em apps/api ou apps/web; nenhum script "format" em nenhum package.json consultado

TEST_RUNNER:
MIXED — apps/api usa Jest 30 (jest.config.ts + jest.e2e.config.ts, via ts-jest); apps/web usa Vitest 2.1.9 (vitest.config.mjs, ambiente jsdom, @testing-library/react)

COVERAGE_TOOL:
MIXED — apps/api: cobertura nativa do Jest (jest.config.ts "coverageThreshold", baseline registrado: lines 45%, statements 45%, functions 38%, branches 28% — comentário no arquivo cita "CI verificada em 2026-08-05"); apps/web: @vitest/coverage-v8 (devDependency, script "test:coverage" no package.json raiz)

BUILD_TOOL:
MIXED — apps/api: tsc puro (script "build": "tsc -p tsconfig.build.json"); apps/web: tsc (typecheck) + Vite (script "build": "tsc -p tsconfig.app.json && node scripts/run-vite.mjs build"); orquestração cross-app via Turborepo (turbo.json define build/dev/lint/typecheck/test com dependsOn "^build" para builds encadeados entre packages/*)
```

## DATABASE

```text
DATABASE:
PostgreSQL (docker-compose.yml serviço "postgres", imagem postgres:16-alpine; apps/api depende de "pg": "^8.20.0" e "@types/pg")

ORM_OR_QUERY_LAYER:
TypeORM ("typeorm": "^0.3.31" e "@nestjs/typeorm": "^10.0.2" em apps/api/package.json) — DataSource usado diretamente em vários pontos (apps/api/src/database/database-context.service.ts, datasource.ts, bootstrap-tenant-zero.ts)

MIGRATION_TOOL:
TypeORM migrations, com um registro central próprio — apps/api/src/database/database.module.ts comenta explicitamente "Source of truth: TypeORM migrations only" e importa um array único "ALL_MIGRATIONS" de ./migrations/index; "synchronize: false" fixado no código com o comentário "NUNCA true — schema gerido via migrations"; geração via CLI padrão "npx typeorm migration:generate -d src/database/datasource.ts migrations/<Nome>" (comentário em datasource.ts); aplicação via scripts próprios apps/api/scripts/db-ops.ts (db:migrate, db:migrate:application, db:rollback, db:check, db:check:application) — migrationsRun sempre false no código, aplicação é sempre um passo explícito fora do boot da aplicação (reforçado pelo comentário de apps/api/api/index.ts: "db:migrate is a separate, explicit CI step — see .github/workflows/staging.yml's migrations-staging job")
```

## SUPABASE

```text
SUPABASE_CLIENT_LIBRARY:
@supabase/supabase-js ^2.105.4 — presente tanto em apps/api/package.json quanto em apps/web/package.json (mesma versão fixada nos dois)

SUPABASE_AUTH_USAGE_PRESENT:
SIM — apps/api/src/core/config/env.schema.ts implementa um guard dedicado de isolamento de projeto Supabase por ambiente (collectSupabaseEnvErrors), com refs distintos e fixos por NODE_ENV (SUPABASE_PROD_REF, SUPABASE_STAGING_REF, SUPABASE_DEV_REF) e uma denylist cruzada explícita entre ambientes — o comentário do próprio arquivo cita um "incidente de isolamento 2026-07-16/17" como motivação

SUPABASE_SERVER_LIBRARIES_PRESENT:
- @supabase/supabase-js (apps/api) — única biblioteca Supabase server-side encontrada; nenhuma biblioteca adicional (@supabase/ssr, @supabase/auth-helpers-*, postgres-realtime dedicado) foi encontrada em apps/api/package.json
```

## CONFIGURAÇÃO

```text
ENV_LOADING_MECHANISM:
@nestjs/config em apps/api (dependency listada); validação adicional própria via Zod em apps/api/src/core/config/env.schema.ts (não é apenas .env dotenv simples — há lógica de validação cruzada de URLs/connection strings/JWTs específica para Supabase); apps/web usa variáveis prefixadas VITE_* carregadas nativamente pelo Vite (import.meta.env), sem camada de validação própria encontrada neste escopo

ENV_VALIDATION:
Zod (apps/api/src/core/config/env.schema.ts — schema explícito com validação cruzada; arquivo de teste dedicado env.schema.spec.ts confirma que é validação real, não apenas tipagem)

EXISTING_API_ENV_NAMES:
(nomes apenas, valores nunca lidos ou registrados — extraídos de .env.example)
- NODE_ENV
- PORT
- DB_VERIFY_ENABLED
- DATABASE_URL
- DIRECT_DATABASE_URL
- APP_DATABASE_URL
- DATABASE_SESSION_CONTEXT_ENABLED
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ENCRYPTION_KEY
- CORS_ORIGINS
- FRONTEND_URL
- APP_URL
- API_URL
- CRON_SECRET
- REDIS_QUEUE_URL
- REDIS_URL
- RBAC_PERSISTED_AUTHORITY
- ALLOW_RBAC_SHADOW_IN_PRODUCTION
- RBAC_DUAL_READ_TELEMETRY
- RBAC_DISTRIBUTED_CACHE_ENABLED
- RBAC_AUDIT_MIRROR_ENABLED
- RBAC_DECISION_RETENTION_DAYS
- RBAC_DECISION_RETENTION_INTERVAL_HOURS
- STRIPE_SECRET_KEY
- STRIPE_WEBHOOK_SECRET
- STRIPE_CONNECT_CLIENT_ID
- SENTRY_DSN
- SENTRY_RELEASE
- R2_ACCOUNT_ID
- R2_ACCESS_KEY
- R2_SECRET_KEY
- R2_BUCKET_NAME
- R2_PUBLIC_URL
- ANTHROPIC_API_KEY
- OPENAI_API_KEY
- OPENAI_BASE_URL
- GOOGLE_AI_API_KEY
- RESEND_API_KEY
- RESEND_FROM_EMAIL
- ACRCLOUD_HOST
- ACRCLOUD_ACCESS_KEY
- ACRCLOUD_ACCESS_SECRET
- SPOTIFY_CLIENT_ID
- SPOTIFY_CLIENT_SECRET
- SPOTIFY_REDIRECT_URI
- SPOTIFY_OAUTH_STATE_SECRET
- YOUTUBE_API_KEY
- META_APP_ID
- META_APP_SECRET
- META_REDIRECT_URI
- TIKTOK_CLIENT_KEY
- TIKTOK_CLIENT_SECRET
- TIKTOK_REDIRECT_URI
- SOUNDCLOUD_CLIENT_ID
- GOOGLE_CLIENT_ID
- GOOGLE_CLIENT_SECRET
- GOOGLE_ADS_CLIENT_ID
- GOOGLE_ADS_CLIENT_SECRET
- GOOGLE_ADS_REDIRECT_URI
- POSTHOG_API_KEY
- POSTHOG_HOST
- AUTENTIQUE_WEBHOOK_SECRET
- DOCUSIGN_INTEGRATION_KEY
- DOCUSIGN_CLIENT_SECRET
- DOCUSIGN_AUTH_BASE_URL
- SEED_ADMIN_SUB
- SEED_ADMIN_EMAIL
- SEED_ADMIN_NAME
- SEED_ORG_NAME
- SEED_ORG_SLUG
- MOCK_MODE
- USE_MOCK
- VITE_USE_MOCK
- VITE_MOCK_MODE
- AUTH_DISABLED
```

## DEPLOYMENT/RUNTIME

```text
DEPLOYMENT_TARGET:
DUPLO E COMPROVADO — (1) Docker/self-hosted: apps/api/Dockerfile produz uma imagem distroless (gcr.io/distroless/nodejs20-debian12:nonroot) orquestrada localmente via docker-compose.yml (serviços postgres + redis + api); comentário no Dockerfile cita explicitamente "Railway / Render / Fly.io" como plataformas-alvo do healthcheck HTTP. (2) Vercel serverless: apps/api/vercel.json define build/install commands e uma function "api/index.ts" (maxDuration 30s) + rewrites + crons — apps/api/api/index.ts é um entrypoint serverless real e comprovado, com comentário explícito no próprio arquivo distinguindo seu comportamento de main.ts (nunca chama app.listen(), cacheia o app Nest entre invocações no mesmo container "warm", nunca dispara migrations, nunca inicia workers BullMQ nem o adapter Socket.IO "since neither can run inside a function that only lives for the duration of one request"). apps/web é servido como estático via nginx (apps/web/Dockerfile, FROM nginx:1.27-alpine).

SERVERLESS:
SIM (comprovado por apps/api/vercel.json + apps/api/api/index.ts) — coexistindo com um target long-running (Docker) para o mesmo código-fonte da API legacy.

CONTAINER_SUPPORT:
SIM (apps/api/Dockerfile e apps/web/Dockerfile, ambos multi-stage; docker-compose.yml orquestra o stack local completo)

LONG_RUNNING_SERVER_SUPPORTED:
SIM — main.ts (não lido em detalhe, fora do escopo de auditoria funcional, mas referenciado por api/index.ts como "the Docker/self-hosted entrypoint" que chama app.listen()) é o entrypoint usado pelo Dockerfile/docker-compose; BullMQ workers e o adapter Socket.IO, segundo o comentário de api/index.ts, só rodam nesse modo long-running, nunca no modo serverless.
```

---

## SHARED PACKAGES

```text
PACKAGE:
packages/types (@music-os-360/types)

PURPOSE:
Tipos TypeScript compartilhados (API, entities, enums) — descrição do próprio package.json

USED_BY_WEB:
SIM (dependency declarada em apps/web/package.json:20; consumido em apps/web/src/shared/types/auth.ts, enums.ts, entre outros)

USED_BY_LEGACY_API:
SIM (dependency declarada em apps/api/package.json:59 como "file:../../packages/types"; consumido em ~15+ arquivos de apps/api/src, incluindo database/entities.ts, core/rbac/, vários modules/*.service.ts)

POTENTIALLY_REUSABLE_BY_API_V2:
SIM
```

```text
PACKAGE:
packages/ai-skills (@music-os-360/ai-skills)

PURPOSE:
Lógica pura das AI Skills (prompts, parsers, validators) compartilhada entre web e api — descrição do próprio package.json

USED_BY_WEB:
NÃO (nenhuma ocorrência de "@music-os-360/ai-skills" encontrada em apps/web/src; não é dependency declarada em apps/web/package.json — apesar da descrição do pacote mencionar "compartilhada entre web e api", a evidência de uso real hoje é só do lado api)

USED_BY_LEGACY_API:
SIM (dependency declarada em apps/api/package.json:58; consumido em 8 arquivos de apps/api/src/core/automation/*.automation.ts)

POTENTIALLY_REUSABLE_BY_API_V2:
SIM
```

```text
PACKAGE:
packages/config (@music-os-360/config)

PURPOSE:
Configurações compartilhadas (env, constants, feature flags) — descrição do próprio package.json

USED_BY_WEB:
SIM (dependency declarada em apps/web/package.json:19 como "workspace:*"; consumido em apps/web/src/shared/lib/env.ts)

USED_BY_LEGACY_API:
NÃO (não é dependency declarada em apps/api/package.json; nenhuma ocorrência de "@music-os-360/config" encontrada em apps/api/src)

POTENTIALLY_REUSABLE_BY_API_V2:
REQUIRES_ANALYSIS
```

```text
PACKAGE:
packages/auth (@music-os-360/auth)

PURPOSE:
Auth utilities (JWT, RBAC, tenant scope) — descrição do próprio package.json

USED_BY_WEB:
NÃO (nenhuma ocorrência de "@music-os-360/auth" em apps/web/src; não é dependency declarada em apps/web/package.json)

USED_BY_LEGACY_API:
NÃO (não é dependency declarada em apps/api/package.json; nenhuma ocorrência de "@music-os-360/auth" em apps/api/src — a lógica real de JWT/RBAC/tenant scope do legacy vive em apps/api/src/core/rbac/ e módulos correlatos, não neste pacote)

POTENTIALLY_REUSABLE_BY_API_V2:
REQUIRES_ANALYSIS
```

```text
PACKAGE:
packages/observability (@music-os-360/observability)

PURPOSE:
Sentry, OpenTelemetry e Pino logger unificados — descrição do próprio package.json

USED_BY_WEB:
NÃO (nenhuma ocorrência encontrada em apps/web/src; não é dependency declarada)

USED_BY_LEGACY_API:
NÃO (não é dependency declarada em apps/api/package.json; nenhuma ocorrência em apps/api/src — apps/api usa "@sentry/node" diretamente como dependency própria, não via este pacote)

POTENTIALLY_REUSABLE_BY_API_V2:
REQUIRES_ANALYSIS
```

```text
PACKAGE:
packages/schemas (@music-os-360/schemas)

PURPOSE:
Zod schemas compartilhados (validação frontend + backend) — descrição do próprio package.json

USED_BY_WEB:
NÃO (nenhuma ocorrência encontrada em apps/web/src; não é dependency declarada)

USED_BY_LEGACY_API:
NÃO (não é dependency declarada em apps/api/package.json; nenhuma ocorrência em apps/api/src)

POTENTIALLY_REUSABLE_BY_API_V2:
REQUIRES_ANALYSIS
```

```text
PACKAGE:
packages/ui (@music-os-360/ui)

PURPOSE:
Design System & UI primitives — descrição do próprio package.json

USED_BY_WEB:
NÃO (nenhuma ocorrência encontrada em apps/web/src; não é dependency declarada — apps/web tem seus próprios componentes UI locais além de @radix-ui direto)

USED_BY_LEGACY_API:
NÃO (pacote de UI, sem aplicabilidade a uma API; confirmado sem uso)

POTENTIALLY_REUSABLE_BY_API_V2:
NÃO (pacote de UI — sem aplicabilidade a uma API backend)
```

```text
PACKAGE:
packages/utils (@music-os-360/utils)

PURPOSE:
Utilitários puros compartilhados (sem side-effects, sem deps externas) — descrição do próprio package.json

USED_BY_WEB:
NÃO (nenhuma ocorrência encontrada em apps/web/src; não é dependency declarada)

USED_BY_LEGACY_API:
NÃO (não é dependency declarada em apps/api/package.json; nenhuma ocorrência em apps/api/src)

POTENTIALLY_REUSABLE_BY_API_V2:
REQUIRES_ANALYSIS
```

**Achado transversal:** dos 8 pacotes compartilhados declarados no workspace, apenas 2 (`types`, `ai-skills`) têm consumidor real comprovado em `apps/api`; `config` só é consumido por `apps/web`; os outros 4 (`auth`, `observability`, `schemas`, `utils`) não têm nenhum consumidor comprovado em nenhum dos dois apps — mesmo pacotes cujo nome sugere forte aderência a uma futura API v2 (`auth`, `schemas`) estão hoje órfãos, o que exige análise de conteúdo antes de qualquer decisão de reuso (não feita aqui — fora do escopo desta análise puramente técnica/estrutural).

---

## RESUMO FINAL

```text
NODE_VERSION_FIXED:
SIM

PACKAGE_MANAGER_IDENTIFIED:
SIM

WORKSPACE_SYSTEM_IDENTIFIED:
SIM

TYPESCRIPT_CONFIG_IDENTIFIED:
SIM

TEST_RUNNER_IDENTIFIED:
SIM

DATABASE_LAYER_IDENTIFIED:
SIM

MIGRATION_TOOL_IDENTIFIED:
SIM

SUPABASE_AUTH_STACK_IDENTIFIED:
SIM

DEPLOYMENT_TARGET_IDENTIFIED:
SIM

SHARED_PACKAGES_REVIEWED:
8

UNRESOLVED_TECHNICAL_CONSTRAINTS:
0
```

## Cobertura

Todas as categorias solicitadas (runtime, package manager, workspace, TypeScript, quality tooling, database, Supabase, configuração, deployment/runtime, shared packages) foram identificadas com evidência concreta do repositório. Nenhuma arquitetura, framework, ORM ou migration tool foi escolhido para a futura API v2. `apps/api-v2` não foi criado. Nenhuma dependência foi instalada ou atualizada. `apps/web` e `apps/api` (legacy) não foram alterados. Nenhum documento anterior foi modificado.

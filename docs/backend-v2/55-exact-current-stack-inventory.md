> Historical record. Kept as recorded; not the current contract.

# 55 — Inventário Exato da Stack Atual

Fotografia técnica exata da stack atual, complementando [`54-current-project-stack-audit.md`](./54-current-project-stack-audit.md) com versões efetivamente RESOLVIDAS (`pnpm-lock.yaml`), não apenas declaradas. Nenhuma decisão de manutenção/substituição/atualização foi tomada. Nenhum pacote foi instalado/removido. `package.json`/`pnpm-lock.yaml` não foram alterados. `apps/api-v2` não foi criado. `apps/web`, `apps/api` (legacy), banco e Supabase não foram alterados.

Convenção: `RESOLVED_VERSION` extraída de `pnpm-lock.yaml` (seção `packages:`/`snapshots:`). Onde não foi possível confirmar com uma correspondência exata e inequívoca no lockfile, registrado `UNRESOLVED` — nunca inventado.

---

## 1 — Stack raiz do monorepo

```text
TECHNOLOGY: Node.js
DECLARED_VERSION: nenhum campo "engines" em nenhum package.json (doc42/54)
RESOLVED_VERSION: N/A (runtime, não é resolvido via lockfile — fixado em Dockerfiles/CI: "20")
DECLARED_IN: apps/api/Dockerfile:2, apps/web/Dockerfile:1, .github/workflows/ci.yml:18, security.yml:18, staging.yml (3x)
CONFIG_FILES: Dockerfiles + workflows citados
USED: SIM

TECHNOLOGY: pnpm
DECLARED_VERSION: 10.11.0
RESOLVED_VERSION: 10.11.0 (packageManager é fixado por pin exato, não por range — o valor declarado É o resolvido)
DECLARED_IN: package.json:5 ("packageManager")
CONFIG_FILES: pnpm-workspace.yaml, pnpm-lock.yaml (lockfileVersion no topo do arquivo)
USED: SIM

TECHNOLOGY: Turborepo
DECLARED_VERSION: latest (package.json raiz:47 — literal string "latest", não uma versão fixa)
RESOLVED_VERSION: 2.10.8
DECLARED_IN: package.json raiz (devDependencies)
CONFIG_FILES: turbo.json
USED: SIM (scripts "monorepo:*")

TECHNOLOGY: TypeScript
DECLARED_VERSION: ^5.8.3 (raiz + apps/web) | ^5.3.3 (apps/api)
RESOLVED_VERSION: 5.9.3 — ÚNICA versão resolvida em todo o lockfile para AMBOS os ranges declarados
  (correção de precisão frente ao doc54: os ranges DECLARADOS diferem, mas o pnpm, operando com um
  único lockfile de workspace, satisfaz ambos com a mesma versão resolvida mais alta compatível —
  não são 2 versões de TS coexistindo em runtime, é 1 versão resolvida, declarada de 2 formas)
DECLARED_IN: package.json raiz:48, apps/web/package.json:77, apps/api/package.json:107
CONFIG_FILES: tsconfig.json (raiz), tsconfig.app.json, apps/api/tsconfig.json
USED: SIM

TECHNOLOGY: ESLint
DECLARED_VERSION: ^9.32.0
RESOLVED_VERSION: 9.39.4
DECLARED_IN: package.json raiz (devDependencies)
CONFIG_FILES: eslint.config.js (flat config, doc42)
USED: SIM

TECHNOLOGY: Prettier
DECLARED_VERSION: N/A — não é dependency de nenhum package.json do monorepo (confirmado, doc42/54)
RESOLVED_VERSION: N/A
DECLARED_IN: N/A
CONFIG_FILES: nenhum
USED: NÃO

TECHNOLOGY: Git hooks (husky/lint-staged/simple-git-hooks)
DECLARED_VERSION: N/A — nenhuma dessas bibliotecas encontrada em nenhum package.json do monorepo
RESOLVED_VERSION: N/A
DECLARED_IN: N/A
CONFIG_FILES: nenhum encontrado (não descarta hook manual em .git/hooks fora de dependency npm,
  não verificável por esta auditoria de pacotes)
USED: NÃO (via dependency npm — não confirmável via lockfile se existe hook manual)

TECHNOLOGY: lint-staged
DECLARED_VERSION: N/A — mesmo resultado do item acima
RESOLVED_VERSION: N/A
USED: NÃO

TECHNOLOGY: Build orchestration
DECLARED_VERSION: Turborepo (ver acima) + scripts pnpm --filter nativos
RESOLVED_VERSION: 2.10.8 (Turborepo)
DECLARED_IN: turbo.json, package.json raiz (scripts "build"/"monorepo:build")
CONFIG_FILES: turbo.json
USED: SIM

TECHNOLOGY: Workspace configuration
DECLARED_VERSION: N/A (não é um pacote, é config)
RESOLVED_VERSION: N/A
DECLARED_IN: pnpm-workspace.yaml ("apps/*", "packages/*", + seção "overrides")
CONFIG_FILES: pnpm-workspace.yaml
USED: SIM
```

`ROOT_STACK_COMPONENTS` desta seção: 10 (Node.js, pnpm, Turborepo, TypeScript, ESLint, Prettier, Git hooks, lint-staged, build orchestration, workspace configuration).

---

## 2 — Stack exata do frontend (`apps/web`)

```text
RESPONSIBILITY: React runtime
PACKAGE: react / react-dom
DECLARED_VERSION: ^18.3.1
RESOLVED_VERSION: 18.3.1
USED_IN_RUNTIME: SIM
USAGE_FILES: apps/web/src/main.tsx, App.tsx
STATUS: ACTIVE

RESPONSIBILITY: Bundler
PACKAGE: vite (+ @vitejs/plugin-react-swc)
DECLARED_VERSION: ^5.4.19 / ^3.11.0
RESOLVED_VERSION: 5.4.21 / 3.11.0
USED_IN_RUNTIME: SIM
USAGE_FILES: scripts/run-vite.mjs, vitest.config.mjs
STATUS: ACTIVE

RESPONSIBILITY: Router
PACKAGE: react-router-dom
DECLARED_VERSION: ^6.30.4
RESOLVED_VERSION: 6.30.4
USED_IN_RUNTIME: SIM
USAGE_FILES: App.tsx (doc15)
STATUS: ACTIVE

RESPONSIBILITY: State management
PACKAGE: zustand
DECLARED_VERSION: ^5.0.13
RESOLVED_VERSION: 5.0.13
USED_IN_RUNTIME: SIM (parcial — doc29: 1/20 stores com consumidor real)
USAGE_FILES: lead-filters.store.ts
STATUS: ACTIVE

RESPONSIBILITY: Server state
PACKAGE: @tanstack/react-query
DECLARED_VERSION: ^5.83.0
RESOLVED_VERSION: 5.100.10
USED_IN_RUNTIME: SIM
USAGE_FILES: dezenas de hooks (doc13, padrão onError/toast.error)
STATUS: ACTIVE

RESPONSIBILITY: HTTP
PACKAGE: nenhum (fetch nativo)
DECLARED_VERSION: N/A
RESOLVED_VERSION: N/A
USED_IN_RUNTIME: SIM
USAGE_FILES: shared/lib/api-client.ts (doc05/13/50)
STATUS: ACTIVE

RESPONSIBILITY: Forms
PACKAGE: react-hook-form (+ @hookform/resolvers)
DECLARED_VERSION: ^7.61.1 / ^3.10.0
RESOLVED_VERSION: 7.76.0 / UNRESOLVED (não localizado isoladamente na busca desta etapa — provável
  entrada aninhada por versão de resolvers, não confirmada individualmente)
USED_IN_RUNTIME: SIM
USAGE_FILES: formulários de módulo
STATUS: ACTIVE

RESPONSIBILITY: Validation
PACKAGE: zod
DECLARED_VERSION: ^3.25.76
RESOLVED_VERSION: 3.25.76 (achado adicional: o lockfile também resolve zod@4.4.3 em algum ponto da
  árvore de dependências do monorepo — não confirmado nesta etapa se é consumido por apps/web
  diretamente ou é transitivo de outra dependência; registrado como achado, não investigado a fundo,
  fora do escopo desta fotografia pontual)
USED_IN_RUNTIME: SIM
USAGE_FILES: integração com @hookform/resolvers, contratos (doc23)
STATUS: ACTIVE

RESPONSIBILITY: Supabase client
PACKAGE: @supabase/supabase-js
DECLARED_VERSION: ^2.105.4
RESOLVED_VERSION: 2.105.4
USED_IN_RUNTIME: SIM
USAGE_FILES: apps/web/src/lib/supabase.ts (doc17)
STATUS: ACTIVE

RESPONSIBILITY: Authentication (client-side)
PACKAGE: (mesmo @supabase/supabase-js — .auth.*)
USED_IN_RUNTIME: SIM
USAGE_FILES: app/providers/AuthContext.tsx (doc15/17)
STATUS: ACTIVE

RESPONSIBILITY: Realtime (client-side)
PACKAGE: (mesmo @supabase/supabase-js — .channel()/.removeChannel())
USED_IN_RUNTIME: SIM
USAGE_FILES: shared/lib/ws-client.ts (doc17/33)
STATUS: ACTIVE

RESPONSIBILITY: CSS
PACKAGE: tailwindcss (+ tailwindcss-animate, autoprefixer, postcss)
DECLARED_VERSION: ^3.4.17 / ^1.0.7
RESOLVED_VERSION: 3.4.19 / 1.0.7 / 10.5.0 (autoprefixer) / 8.5.16 (postcss)
USED_IN_RUNTIME: SIM
STATUS: ACTIVE (autoprefixer/postcss: DEV_ONLY — build de CSS, não runtime do browser)

RESPONSIBILITY: Component library
PACKAGE: @radix-ui/* (17 subpacotes distintos, doc54) + class-variance-authority + clsx + tailwind-merge
DECLARED_VERSION: variadas (^1.x/^2.x por subpacote Radix) | ^0.7.1 (cva) | ^2.1.1 (clsx) | ^2.6.0 (tw-merge)
RESOLVED_VERSION: UNRESOLVED individualmente por subpacote Radix (17 entradas, não expandidas nesta
  etapa por volume) | 0.7.1 (cva) | 2.1.1 (clsx) | 2.6.1 (tailwind-merge)
USED_IN_RUNTIME: SIM
STATUS: ACTIVE

RESPONSIBILITY: Component library (command palette)
PACKAGE: cmdk
DECLARED_VERSION: ^1.1.1
RESOLVED_VERSION: 1.1.1
USED_IN_RUNTIME: NÃO CONFIRMADO (doc54 — presente no lockfile/package.json, consumidor real não
  rastreado nesta auditoria de stack)
STATUS: INSTALLED_NOT_USED (classificação preliminar — não uma afirmação definitiva de código morto,
  apenas ausência de confirmação de uso nesta etapa pontual)

RESPONSIBILITY: Icons
PACKAGE: lucide-react / react-icons
DECLARED_VERSION: ^0.462.0 / ^5.5.0
RESOLVED_VERSION: 0.462.0 / 5.6.0
USED_IN_RUNTIME: SIM
STATUS: ACTIVE

RESPONSIBILITY: Charts
PACKAGE: recharts
DECLARED_VERSION: ^2.15.4
RESOLVED_VERSION: 2.15.4
USED_IN_RUNTIME: SIM
STATUS: ACTIVE

RESPONSIBILITY: Tables/data grid
PACKAGE: nenhuma biblioteca dedicada encontrada (sem @tanstack/react-table, ag-grid, react-table)
DECLARED_VERSION: N/A
RESOLVED_VERSION: N/A
USED_IN_RUNTIME: NÃO (tabelas prováveis construídas com HTML/componentes próprios, não confirmado em
  detalhe nesta etapa)
STATUS: N/A

RESPONSIBILITY: Dates
PACKAGE: date-fns / react-day-picker
DECLARED_VERSION: ^3.6.0 / ^8.10.1
RESOLVED_VERSION: 3.6.0 / 8.10.2
USED_IN_RUNTIME: SIM
STATUS: ACTIVE

RESPONSIBILITY: Internationalization
PACKAGE: nenhuma (doc54 — sem i18next/react-i18next/formatjs; strings PT-BR fixas)
DECLARED_VERSION: N/A
RESOLVED_VERSION: N/A
USED_IN_RUNTIME: NÃO (não é dependência instalada)
STATUS: N/A

RESPONSIBILITY: Editor (rich text/documento)
PACKAGE: mammoth (conversão .docx)
DECLARED_VERSION: ^1.12.0
RESOLVED_VERSION: 1.12.0
USED_IN_RUNTIME: SIM (provável, parser de template de contrato — não é um editor WYSIWYG, é conversor
  de documento; nenhuma biblioteca de editor rich-text tipo TipTap/Slate/Quill encontrada)
STATUS: ACTIVE

RESPONSIBILITY: Uploads
PACKAGE: nenhuma biblioteca client-side dedicada — upload via fetch nativo contra URL pré-assinada
  (doc13/48, useUploadToR2.ts)
DECLARED_VERSION: N/A
RESOLVED_VERSION: N/A
USED_IN_RUNTIME: SIM
STATUS: ACTIVE

RESPONSIBILITY: Notifications/toasts
PACKAGE: sonner
DECLARED_VERSION: ^1.7.4
RESOLVED_VERSION: 1.7.4
USED_IN_RUNTIME: SIM (padrão toast.error, doc13)
STATUS: ACTIVE

RESPONSIBILITY: Sanitização de HTML
PACKAGE: dompurify
DECLARED_VERSION: ^3.4.12
RESOLVED_VERSION: 3.4.12
USED_IN_RUNTIME: SIM
STATUS: ACTIVE

RESPONSIBILITY: Exportação de planilha
PACKAGE: xlsx
DECLARED_VERSION: ^0.18.5
RESOLVED_VERSION: 0.18.5
USED_IN_RUNTIME: SIM (doc37 A.18 Reports)
STATUS: ACTIVE

RESPONSIBILITY: Analytics
PACKAGE: posthog-js
DECLARED_VERSION: ^1.373.2
RESOLVED_VERSION: 1.373.5
USED_IN_RUNTIME: SIM
STATUS: ACTIVE

RESPONSIBILITY: Error tracking
PACKAGE: @sentry/react
DECLARED_VERSION: ^10.52.0
RESOLVED_VERSION: 10.53.1
USED_IN_RUNTIME: SIM
STATUS: ACTIVE

RESPONSIBILITY: Testing
PACKAGE: vitest (+ @testing-library/react, @testing-library/jest-dom, jsdom)
DECLARED_VERSION: 2.1.9 / ^16.3.1 / ^6.9.1 / ^27.4.0
RESOLVED_VERSION: 2.1.9 / 16.3.2 / UNRESOLVED (jest-dom não localizado isoladamente) / 27.4.0
USED_IN_RUNTIME: SIM
STATUS: TEST_ONLY

RESPONSIBILITY: Coverage
PACKAGE: @vitest/coverage-v8
DECLARED_VERSION: 2.1.9
RESOLVED_VERSION: 2.1.9
STATUS: TEST_ONLY

RESPONSIBILITY: Lint
PACKAGE: eslint (config compartilhada raiz)
RESOLVED_VERSION: 9.39.4 (mesma da seção 1)
STATUS: DEV_ONLY

RESPONSIBILITY: Typecheck
PACKAGE: typescript (tsc --noEmit)
RESOLVED_VERSION: 5.9.3 (mesma da seção 1)
STATUS: DEV_ONLY

RESPONSIBILITY: Build
PACKAGE: vite + tsc (script "build": "tsc -p tsconfig.app.json && node scripts/run-vite.mjs build")
RESOLVED_VERSION: ver acima
STATUS: ACTIVE
```

`WEB_STACK_COMPONENTS` desta seção: 27 responsabilidades distintas auditadas.

---

## 3 — Stack exata do backend legacy (`apps/api`)

```text
RESPONSIBILITY: NestJS core
PACKAGE: @nestjs/core / @nestjs/common
DECLARED_VERSION: ^10.3.0
RESOLVED_VERSION: 10.4.22
USAGE_FILES: src/main.ts, src/create-app.ts, src/app.module.ts
STATUS: ACTIVE

RESPONSIBILITY: NestJS platform (HTTP adapter)
PACKAGE: @nestjs/platform-express
DECLARED_VERSION: ^10.3.0
RESOLVED_VERSION: 10.4.22
USAGE_FILES: src/create-app.ts:16,82-83
STATUS: ACTIVE

RESPONSIBILITY: Express
PACKAGE: express
DECLARED_VERSION: ^5.2.1
RESOLVED_VERSION: 5.2.1
USAGE_FILES: src/create-app.ts (via ExpressAdapter), api/index.ts (serverless handler, doc42/43)
STATUS: ACTIVE

RESPONSIBILITY: TypeScript
PACKAGE: typescript
DECLARED_VERSION: ^5.3.3
RESOLVED_VERSION: 5.9.3 (idêntica à seção 1 — ver nota de correção acima)
USAGE_FILES: tsconfig.json, tsconfig.build.json
STATUS: ACTIVE

RESPONSIBILITY: Validation
PACKAGE: class-validator (+ ValidationPipe) / zod (escape hatch)
DECLARED_VERSION: ^0.14.1 / ^3.22.4
RESOLVED_VERSION: 0.14.4 / 3.25.76 (mesma versão resolvida que apps/web, doc "achado" acima — o
  range ^3.22.4 do apps/api resolve para a MESMA 3.25.76 já usada pelo apps/web, não uma versão
  distinta — correção de precisão frente ao doc54, que registrou os ranges DECLARADOS como diferentes
  sem confirmar a resolução real)
USAGE_FILES: src/create-app.ts:185-186, 78 arquivos de DTO, 3 arquivos Zod (doc44)
STATUS: ACTIVE (ambas)

RESPONSIBILITY: Serialization
PACKAGE: class-transformer
DECLARED_VERSION: ^0.5.1
RESOLVED_VERSION: 0.5.1
USAGE_FILES: junto de class-validator, DTOs
STATUS: ACTIVE

RESPONSIBILITY: TypeORM
PACKAGE: typeorm / @nestjs/typeorm
DECLARED_VERSION: ^0.3.31 / ^10.0.2
RESOLVED_VERSION: 0.3.31 / UNRESOLVED (não localizado isoladamente nesta busca — @nestjs/typeorm não
  apareceu na amostra de grep executada nesta etapa; presença como dependency confirmada no doc42, versão
  resolvida específica não re-confirmada aqui)
USAGE_FILES: src/database/database.module.ts, entities.ts, migrations/index.ts
STATUS: ACTIVE

RESPONSIBILITY: PostgreSQL driver
PACKAGE: pg
DECLARED_VERSION: ^8.20.0
RESOLVED_VERSION: 8.20.0
USAGE_FILES: src/database/database-context.service.ts
STATUS: ACTIVE

RESPONSIBILITY: Supabase (server)
PACKAGE: @supabase/supabase-js
DECLARED_VERSION: ^2.105.4
RESOLVED_VERSION: 2.105.4 (mesma versão do apps/web)
USAGE_FILES: 7 arquivos já listados no doc54 (bootstrap-tenant-zero.cli.ts, auth-password.service.ts,
  core/realtime/realtime.service.ts, users.service.ts, dev-auth.controller.ts,
  workspace-provisioning.service.ts)
STATUS: ACTIVE

RESPONSIBILITY: JWT
PACKAGE: jsonwebtoken
DECLARED_VERSION: ^9.0.3
RESOLVED_VERSION: 9.0.3
USAGE_FILES: src/core/guards/auth.guard.ts, core/security/token-verifier.service.ts
STATUS: ACTIVE

RESPONSIBILITY: JWKS
PACKAGE: jwks-rsa
DECLARED_VERSION: ^4.0.1
RESOLVED_VERSION: 4.0.1
USAGE_FILES: mesmos arquivos acima
STATUS: ACTIVE

RESPONSIBILITY: Auth (validação de identidade)
PACKAGE: implementação própria sobre jsonwebtoken+jwks-rsa (sem @nestjs/passport/passport-jwt)
USAGE_FILES: src/core/guards/auth.guard.ts
STATUS: ACTIVE

RESPONSIBILITY: RBAC
PACKAGE: implementação própria (sem biblioteca RBAC de terceiros)
USAGE_FILES: src/core/guards/tenant.guard.ts, roles.guard.ts, src/core/rbac/*
STATUS: ACTIVE

RESPONSIBILITY: Rate limiting
PACKAGE: implementação própria (sem @nestjs/throttler)
USAGE_FILES: src/core/guards/rate-limit.guard.ts, core/security/rate-limit.service.ts
STATUS: ACTIVE

RESPONSIBILITY: Security middleware
PACKAGE: helmet / compression
DECLARED_VERSION: ^7.1.0 / ^1.7.4
RESOLVED_VERSION: 7.2.0 / 1.8.1
USAGE_FILES: src/create-app.ts:87,112
STATUS: ACTIVE

RESPONSIBILITY: CORS
PACKAGE: implementação própria (via Express/Nest nativo, CORS_ORIGINS de env, doc42/53) — sem pacote
  "cors" dedicado confirmado nesta etapa
USAGE_FILES: src/create-app.ts (não confirmado linha exata nesta etapa)
STATUS: ACTIVE (mecanismo, não necessariamente pacote npm dedicado)

RESPONSIBILITY: Config
PACKAGE: @nestjs/config (+ zod para validação, envSchema)
DECLARED_VERSION: ^3.2.0
RESOLVED_VERSION: 3.3.0
USAGE_FILES: src/core/config/env.schema.ts
STATUS: ACTIVE

RESPONSIBILITY: Logging
PACKAGE: NestJS Logger nativo (sem pino/winston)
USAGE_FILES: src/core/interceptors/logging.interceptor.ts
STATUS: ACTIVE

RESPONSIBILITY: Scheduling
PACKAGE: nenhuma (Vercel Cron externo, apps/api/vercel.json)
STATUS: ACTIVE (mecanismo externo)

RESPONSIBILITY: Queues
PACKAGE: bullmq / @nestjs/bullmq / ioredis / @bull-board/*
DECLARED_VERSION: ^5.76.8 / ^10.2.3 / ^5.10.1 / ^7.0.0
RESOLVED_VERSION: 5.76.8 / 10.2.3 / 5.10.1 / UNRESOLVED (bull-board não localizado isoladamente nesta
  busca)
USAGE_FILES: src/queues/queue.module.ts
STATUS: PARTIAL (ausente em modo serverless, doc42/54)

RESPONSIBILITY: Events (in-process)
PACKAGE: @nestjs/event-emitter
DECLARED_VERSION: ^3.1.0
RESOLVED_VERSION: 3.1.0
USAGE_FILES: src/core/events/notification.handler.ts (já citado no doc52)
STATUS: ACTIVE

RESPONSIBILITY: Uploads
PACKAGE: @aws-sdk/client-s3 / @aws-sdk/s3-request-presigner (sem multer)
DECLARED_VERSION: ^3.1045.0
RESOLVED_VERSION: 3.1048.0 (client-s3; presigner não confirmado isoladamente)
USAGE_FILES: módulo uploads (doc37 A.18)
STATUS: ACTIVE

RESPONSIBILITY: HTTP clients (chamadas a provider externo)
PACKAGE: SDKs próprios por provider (ver seção 10) — sem axios genérico instalado
STATUS: ACTIVE

RESPONSIBILITY: Swagger/OpenAPI
PACKAGE: @nestjs/swagger
DECLARED_VERSION: ^7.3.0
RESOLVED_VERSION: 7.4.2
USAGE_FILES: health.controller.ts e outros controllers (ApiTags/ApiOperation)
STATUS: ACTIVE

RESPONSIBILITY: Health check
PACKAGE: @nestjs/terminus
DECLARED_VERSION: ^10.2.3
RESOLVED_VERSION: 10.3.0
USAGE_FILES: src/modules/health/health.controller.ts (doc52)
STATUS: ACTIVE

RESPONSIBILITY: Metrics
PACKAGE: prom-client
DECLARED_VERSION: ^15.1.3
RESOLVED_VERSION: 15.1.3
USAGE_FILES: src/core/metrics/metrics.service.ts (doc52)
STATUS: ACTIVE

RESPONSIBILITY: Error tracking
PACKAGE: @sentry/node
DECLARED_VERSION: ^10.53.1
RESOLVED_VERSION: 10.53.1
USAGE_FILES: src/instrument.ts, src/core/filters/global-exception.filter.ts (doc50)
STATUS: ACTIVE

RESPONSIBILITY: Testing
PACKAGE: jest (+ ts-jest, @nestjs/testing, supertest)
DECLARED_VERSION: ^30.4.2 / ^29.4.9 / ^10.4.22 / ^7.2.2
RESOLVED_VERSION: 30.4.2 / 29.4.9 / UNRESOLVED (@nestjs/testing não localizado isoladamente) / 7.2.2
USAGE_FILES: apps/api/jest.config.ts, jest.e2e.config.ts
STATUS: TEST_ONLY

RESPONSIBILITY: Build
PACKAGE: tsc (script "build": "tsc -p tsconfig.build.json")
RESOLVED_VERSION: 5.9.3 (mesma TypeScript)
STATUS: ACTIVE

RESPONSIBILITY: Runtime de execução em dev/scripts
PACKAGE: ts-node-dev / tsx
DECLARED_VERSION: ^2.0.0 / ^4.20.5
RESOLVED_VERSION: 2.0.0 / 4.22.3
STATUS: ACTIVE (ambos — ver Seção 11, duplicidade)
```

`API_STACK_COMPONENTS` desta seção: 25 responsabilidades distintas auditadas.

---

## 4 — Database stack exata

```text
TECHNOLOGY: TypeORM
PACKAGE: typeorm
DECLARED_VERSION: ^0.3.31
RESOLVED_VERSION: 0.3.31
USED_BY: API
PURPOSE: ORM principal — entities, migrations (fonte única de migration, doc45), Repository pattern
ACTIVE: SIM

TECHNOLOGY: pg (driver direto)
PACKAGE: pg
DECLARED_VERSION: ^8.20.0
RESOLVED_VERSION: 8.20.0
USED_BY: API, SCRIPT
PURPOSE: driver por baixo do TypeORM; também usado via QueryRunner.query() para SQL cru (padrão RLS
  SET LOCAL, doc45); consumido também por scripts CLI (db-ops.ts e correlatos, doc42)
ACTIVE: SIM

TECHNOLOGY: Supabase JS
PACKAGE: @supabase/supabase-js
DECLARED_VERSION: ^2.105.4
RESOLVED_VERSION: 2.105.4
USED_BY: WEB, API, SCRIPT (bootstrap-tenant-zero.cli.ts é um script)
PURPOSE: Auth (ambos os lados) + Realtime (ambos os lados) — NÃO usado para CRUD de tabela de negócio
  em nenhum dos dois lados (doc17, doc54)
ACTIVE: SIM

TECHNOLOGY: SQL direto (fora de TypeORM/pg formal)
PACKAGE: N/A (arquivos .sql na raiz de apps/api — migrations-complete.sql, migrations-complete-clean.sql,
  migrations-temp.sql)
DECLARED_VERSION: N/A
RESOLVED_VERSION: N/A
USED_BY: SCRIPT (scripts/dump-migrations-sql.ts, já citado no doc42)
PURPOSE: dump/snapshot de schema — propósito exato não investigado a fundo nesta etapa (fora do escopo
  desta fotografia pontual)
ACTIVE: NÃO CONFIRMADO (presença de arquivo ≠ uso ativo em runtime)

TECHNOLOGY: Drizzle
PACKAGE: drizzle-orm / drizzle-kit
DECLARED_VERSION: N/A — não é dependency de nenhum package.json atual (doc45/54)
RESOLVED_VERSION: N/A — não presente no lockfile atual (busca dedicada nesta etapa não encontrou
  entrada "drizzle-orm@"/"drizzle-kit@" no pnpm-lock.yaml)
USED_BY: MIGRATION (histórico — apps/api/drizzle/, arquivado, doc45)
PURPOSE: usado numa fase anterior do projeto, hoje explicitamente descontinuado (_DEPRECATED.md)
ACTIVE: NÃO
```

`DATABASE_ACCESS_TECHNOLOGIES` desta seção: 5 (TypeORM, pg, Supabase JS, SQL direto, Drizzle).

---

## 5 — Migrations exatas

```text
SYSTEM: TypeORM migrations
LOCATION: apps/api/src/database/migrations/ (registry único: migrations/index.ts, ALL_MIGRATIONS)
EXECUTABLE_TODAY: SIM
USED_BY_CURRENT_RUNTIME: SIM
STATUS: ACTIVE

SYSTEM: Drizzle migrations (Drizzle Kit)
LOCATION: apps/api/drizzle/ (0000-0003 + meta/)
EXECUTABLE_TODAY: NÃO — _DEPRECATED.md instrui explicitamente a nunca rodar drizzle-kit push/migrate
  contra nenhum ambiente
USED_BY_CURRENT_RUNTIME: NÃO
STATUS: ARCHIVED

SYSTEM: SQL manual / dumps
LOCATION: apps/api/migrations-complete.sql, migrations-complete-clean.sql, migrations-temp.sql
  (raiz de apps/api) + migrations-complete.sql (raiz do monorepo, arquivo distinto — 104150 bytes,
  já visível na listagem inicial desta sessão)
EXECUTABLE_TODAY: UNKNOWN — não confirmado se algum processo/script os aplica diretamente contra um
  banco (scripts/dump-migrations-sql.ts sugere que é uma SAÍDA de dump, não uma entrada aplicada)
USED_BY_CURRENT_RUNTIME: NÃO CONFIRMADO
STATUS: UNKNOWN

SYSTEM: Supabase migrations (CLI Supabase)
LOCATION: diretório supabase/ na raiz do monorepo (confirmado existir, doc42/54; conteúdo interno não
  auditado em profundidade nesta etapa)
EXECUTABLE_TODAY: UNKNOWN (dependeria da CLI Supabase, presente como devDependency raiz —
  "supabase": "^2.100.1")
USED_BY_CURRENT_RUNTIME: UNKNOWN
STATUS: UNKNOWN

SYSTEM: Scripts de schema (verificação/geração)
LOCATION: apps/api/scripts/db-ops.ts (migrate/rollback/check/generate), scripts/verify-*.ts (doc42)
EXECUTABLE_TODAY: SIM
USED_BY_CURRENT_RUNTIME: SIM (é a interface operacional real do sistema TypeORM migrations — não é um
  "sistema" de migration à parte, é a ferramenta que opera o sistema TypeORM)
STATUS: ACTIVE
```

`MIGRATION_SYSTEMS` desta seção: 5 (TypeORM, Drizzle, SQL manual/dumps, Supabase CLI migrations, scripts de operação — os últimos 2 registrados com status UNKNOWN/operacional por falta de confirmação/por não serem um sistema à parte, não descartados por decisão).

---

## 6 — Supabase

```text
Supabase Auth: PACKAGE @supabase/supabase-js 2.105.4 (ambos os lados) + jsonwebtoken 9.0.3/jwks-rsa
  4.0.1 (validação server-side, apps/api) — USADO, BOTH

Supabase Realtime: PACKAGE @supabase/supabase-js 2.105.4 (ambos os lados, .channel()/.removeChannel())
  — USADO, BOTH

Supabase Database (Postgres gerenciado): acessado via DATABASE_URL/TypeORM/pg (apps/api), nunca
  diretamente pelo apps/web — USADO, API

Supabase Storage: NÃO USADO — R2/S3-compatible é usado no lugar (doc54)

Supabase Functions (Edge Functions): NÃO CONFIRMADO nesta auditoria de código — nenhuma referência
  encontrada em apps/web ou apps/api

Supabase Vault: NÃO CONFIRMADO nesta auditoria de código — nenhuma referência a vault/secrets
  gerenciados via Supabase Vault encontrada; ENCRYPTION_KEY própria (doc42/53) é o mecanismo de
  criptografia at-rest já evidenciado, não Supabase Vault

RLS: SIM — extensivamente evidenciado nos docs 45/47/49 (SET LOCAL app.current_tenant_id, migration
  20260801000001_RealtimeBroadcastAuthorization)

JWT/JWKS: SIM — ver acima (Supabase Auth)
```

**Referência do ambiente Supabase conectado atual (fornecida como contexto pelo prompt, não verificada por consulta direta ao Supabase nesta etapa — sem acesso MCP autorizado nesta sessão):**

```text
SUPABASE_PROJECT: MUSIC OS 360
DATABASE_ENGINE: PostgreSQL 17
REGION: us-east-1
EDGE_FUNCTIONS_DEPLOYED: 0
```

`SUPABASE_COMPONENTS` desta seção: 8 (Auth, Realtime, Database, Storage, Functions, Vault, RLS, JWT/JWKS).

---

## 7 — Pacotes internos (8 shared packages)

```text
PACKAGE: @music-os-360/types
PATH: packages/types
PURPOSE: tipos TS compartilhados (API, entities, enums)
USED_BY_WEB: SIM
USED_BY_API: SIM
RUNTIME_DEPENDENCIES: nenhuma dependency externa relevante (pacote de tipos puros)
DEV_DEPENDENCIES: typescript (mesma 5.9.3 resolvida)
STATUS: ACTIVE

PACKAGE: @music-os-360/ai-skills
PATH: packages/ai-skills
PURPOSE: lógica pura de AI Skills (prompts/parsers/validators)
USED_BY_WEB: NÃO
USED_BY_API: SIM
RUNTIME_DEPENDENCIES: UNRESOLVED (não auditado individualmente nesta etapa)
STATUS: ACTIVE (só lado API)

PACKAGE: @music-os-360/config
PATH: packages/config
PURPOSE: config/constants/feature flags compartilhados
USED_BY_WEB: SIM
USED_BY_API: NÃO
RUNTIME_DEPENDENCIES: UNRESOLVED
STATUS: ACTIVE (só lado web)

PACKAGE: @music-os-360/auth
PATH: packages/auth
PURPOSE: JWT/RBAC/tenant scope utilities
USED_BY_WEB: NÃO
USED_BY_API: NÃO
RUNTIME_DEPENDENCIES: UNRESOLVED
STATUS: UNUSED

PACKAGE: @music-os-360/observability
PATH: packages/observability
PURPOSE: Sentry/OpenTelemetry/Pino unificados
USED_BY_WEB: NÃO
USED_BY_API: NÃO
RUNTIME_DEPENDENCIES: UNRESOLVED
STATUS: UNUSED

PACKAGE: @music-os-360/schemas
PATH: packages/schemas
PURPOSE: Zod schemas compartilhados
USED_BY_WEB: NÃO
USED_BY_API: NÃO
RUNTIME_DEPENDENCIES: UNRESOLVED
STATUS: UNUSED

PACKAGE: @music-os-360/ui
PATH: packages/ui
PURPOSE: Design System/UI primitives
USED_BY_WEB: NÃO
USED_BY_API: NÃO
RUNTIME_DEPENDENCIES: UNRESOLVED
STATUS: UNUSED

PACKAGE: @music-os-360/utils
PATH: packages/utils
PURPOSE: utilitários puros
USED_BY_WEB: NÃO
USED_BY_API: NÃO
RUNTIME_DEPENDENCIES: UNRESOLVED
STATUS: UNUSED
```

`SHARED_PACKAGES_ANALYZED`: 8 (fixo, conforme já identificado nos docs 42/54).

---

## 8 — Test stack

```text
PACKAGE: jest | RESOLVED_VERSION: 30.4.2 | USED_BY: apps/api | PURPOSE: unit + integration
PACKAGE: ts-jest | RESOLVED_VERSION: 29.4.9 | USED_BY: apps/api | PURPOSE: transform TS para Jest
PACKAGE: vitest | RESOLVED_VERSION: 2.1.9 | USED_BY: apps/web | PURPOSE: unit + integration
PACKAGE: @vitest/coverage-v8 | RESOLVED_VERSION: 2.1.9 | USED_BY: apps/web | PURPOSE: coverage
PACKAGE: @playwright/test | RESOLVED_VERSION: 1.62.1 | USED_BY: raiz (e2e/) | PURPOSE: e2e cross-app
PACKAGE: @testing-library/react | RESOLVED_VERSION: 16.3.2 | USED_BY: apps/web | PURPOSE: testes de
  componente React
PACKAGE: @testing-library/jest-dom | RESOLVED_VERSION: UNRESOLVED (não localizado isoladamente nesta
  busca) | USED_BY: apps/web | PURPOSE: matchers de DOM para Vitest/Jest-like assertions
PACKAGE: supertest | RESOLVED_VERSION: 7.2.2 | USED_BY: apps/api | PURPOSE: teste de HTTP end-to-end
  contra a app NestJS
PACKAGE: @nestjs/testing | RESOLVED_VERSION: UNRESOLVED (não localizado isoladamente nesta busca) |
  USED_BY: apps/api | PURPOSE: TestingModule, DI isolada para testes
PACKAGE: jsdom | RESOLVED_VERSION: 27.4.0 | USED_BY: apps/web | PURPOSE: ambiente DOM simulado para
  Vitest
```

`TEST_STACK_COMPONENTS` desta seção: 10.

---

## 9 — Deployment stack

```text
Docker: CONFIGURED — apps/api/Dockerfile (multi-stage, distroless produção), apps/web/Dockerfile
  (multi-stage, nginx produção), docker-compose.yml (+ .observability.yml + .prod-test.yml) — presença
  confirmada, não confirmável se algum destes está de fato rodando em produção neste momento a partir
  só do código do repositório (não deduzido, conforme instrução do prompt)

nginx: CONFIGURED — apps/web/Dockerfile:31 (FROM nginx:1.27-alpine), apps/web/nginx.conf

Vercel: CONFIGURED — apps/api/vercel.json (build/install commands, function api/index.ts, rewrites,
  4 crons)

Serverless: CONFIGURED — api/index.ts é um handler serverless real e completo (doc42/43), mas não
  confirmável a partir do repositório se é o alvo ATIVO de produção no momento ou um caminho alternativo
  mantido em paralelo ao Docker

Long-running API: CONFIGURED — main.ts (app.listen()) + docker-compose.yml orquestrando o stack local
  completo (postgres+redis+api)

CI/CD: ACTIVE — .github/workflows/ci.yml, security.yml, staging.yml (presença + estrutura confirmadas,
  doc42/54; execução real/histórico de runs não verificável a partir do código estático do repositório)

GitHub Actions: ACTIVE (mesmo item acima)

Build scripts: ACTIVE — scripts "build" em ambos os apps + orquestração Turborepo (seção 1)

Start scripts: ACTIVE — "start": "node dist/apps/api/src/main.js" (apps/api), servido via nginx
  (apps/web, sem script "start" próprio — é servido estaticamente pelo container nginx)
```

`DEPLOYMENT_COMPONENTS` desta seção: 9 (Docker, nginx, Vercel, serverless, long-running API, CI/CD,
GitHub Actions, build scripts, start scripts — GitHub Actions e CI/CD contados juntos como 1 no total
por serem o mesmo sistema, ver Resumo).

---

## 10 — Integrações e SDKs (17 providers)

```text
PROVIDER: Stripe | SDK: stripe | RESOLVED_VERSION: 22.1.1 | USED_BY: API | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: ACRCloud | SDK: nenhum (HTTP direto) | RESOLVED_VERSION: N/A | USED_BY: API | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: Spotify | SDK: nenhum (bridge OAuth) | RESOLVED_VERSION: N/A | USED_BY: BOTH | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: YouTube | SDK: nenhum (API key) | RESOLVED_VERSION: N/A | USED_BY: API (provável) | IMPLEMENTATION_STATUS: PARTIAL
PROVIDER: Meta | SDK: nenhum (bridge OAuth) | RESOLVED_VERSION: N/A | USED_BY: BOTH | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: TikTok | SDK: nenhum (bridge OAuth) | RESOLVED_VERSION: N/A | USED_BY: BOTH | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: SoundCloud | SDK: nenhum (client_id público, sem secret no .env.example) | RESOLVED_VERSION: N/A | USED_BY: WEB | IMPLEMENTATION_STATUS: PARTIAL
PROVIDER: Google / Google Ads | SDK: nenhum (bridge OAuth) | RESOLVED_VERSION: N/A | USED_BY: BOTH | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: DocuSign | SDK: nenhum (OAuth integration key) | RESOLVED_VERSION: N/A | USED_BY: API | IMPLEMENTATION_STATUS: PARTIAL
PROVIDER: Autentique | SDK: nenhum (webhook secret) | RESOLVED_VERSION: N/A | USED_BY: API | IMPLEMENTATION_STATUS: PARTIAL
PROVIDER: Cloudflare R2 | SDK: @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner | RESOLVED_VERSION: 3.1048.0 (client-s3) | USED_BY: API | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: Resend | SDK: nenhum (RESEND_API_KEY, sem pacote "resend" no lockfile) | RESOLVED_VERSION: N/A | USED_BY: API | IMPLEMENTATION_STATUS: PARTIAL
PROVIDER: Anthropic | SDK: @anthropic-ai/sdk | RESOLVED_VERSION: 0.95.2 | USED_BY: API | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: OpenAI | SDK: openai | RESOLVED_VERSION: 6.38.0 | USED_BY: API | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: Google AI | SDK: @google/generative-ai | RESOLVED_VERSION: 0.24.1 | USED_BY: API | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: PostHog | SDK: posthog-js / posthog-node | RESOLVED_VERSION: 1.373.5 / 5.34.2 | USED_BY: BOTH | IMPLEMENTATION_STATUS: ACTIVE
PROVIDER: Sentry | SDK: @sentry/react / @sentry/node | RESOLVED_VERSION: 10.53.1 / 10.53.1 | USED_BY: BOTH | IMPLEMENTATION_STATUS: ACTIVE

Distribuidoras (ONErpm/DistroKid/Symphonic/SoundOn/MusicPro/SomVibe): nenhum SDK/credencial —
IMPLEMENTATION_STATUS: STATIC_LINK_ONLY (placeholder client-side, decisão D1 já registrada, doc25/54)
```

`EXTERNAL_INTEGRATIONS` desta seção: 17.

---

## 11 — Duplicidade de responsabilidade

```text
RESPONSIBILITY: Database access
TECHNOLOGIES: TypeORM, pg (direto), Supabase JS
RATIONALE_FOUND_IN_CODE: parcial — TypeORM+pg coexistem por design (pg é o driver por baixo do TypeORM
E usado separadamente via QueryRunner para o padrão RLS SET LOCAL, doc45, com justificativa técnica
explícita no código); Supabase JS é usado por um motivo DIFERENTE e não-sobreposto (Auth/Realtime, não
CRUD de domínio, doc17/54) — não há, portanto, 3 tecnologias competindo pela MESMA operação, mas 3
tecnologias cobrindo responsabilidades adjacentes sob o mesmo guarda-chuva "acesso a Postgres/Supabase".

RESPONSIBILITY: Runtime de execução TypeScript-em-Node (dev/scripts)
TECHNOLOGIES: ts-node-dev, tsx
RATIONALE_FOUND_IN_CODE: nenhuma justificativa textual encontrada no código — inferível pelo uso
segregado nos scripts (ts-node-dev só em "dev"/"start:dev", com watch mode; tsx em todos os demais
~25 scripts CLI pontuais, doc42/54), mas não há um comentário explícito no repositório explicando a
escolha de duas ferramentas.

RESPONSIBILITY: Test framework
TECHNOLOGIES: Jest (apps/api), Vitest (apps/web)
RATIONALE_FOUND_IN_CODE: nenhuma justificativa textual encontrada — consistente com 2 apps
historicamente configurados de forma independente (NestJS tradicionalmente usa Jest por convenção do
próprio scaffold oficial; Vite tradicionalmente integra com Vitest) — inferência de convenção de
ecossistema, não uma decisão documentada no repositório.

RESPONSIBILITY: Validation (apps/api)
TECHNOLOGIES: class-validator, Zod
RATIONALE_FOUND_IN_CODE: SIM — comentário direto no código (zod-validation.pipe.ts + uso em
transactions.controller.ts) mostra Zod escolhido deliberadamente para validação condicional/cruzada
entre campos que decorators não expressam bem (já detalhado no doc44) — a única duplicidade desta
lista com justificativa EXPLÍCITA e textual encontrada no próprio código-fonte.

RESPONSIBILITY: Auth/Identity provider
TECHNOLOGIES: (não há duplicidade aqui) — Supabase Auth é o único provedor de identidade em ambos os
apps, sem duplicidade a registrar.

RESPONSIBILITY: HTTP client (chamadas externas)
TECHNOLOGIES: SDKs individuais por provider (Stripe, Anthropic, OpenAI, Google AI, AWS S3) + fetch nativo
para providers sem SDK (ACRCloud, OAuth bridges, Resend)
RATIONALE_FOUND_IN_CODE: não é uma duplicidade de FERRAMENTA genérica (não há 2 clientes HTTP genéricos
concorrentes tipo axios+fetch) — é a ausência de um cliente HTTP genérico combinada com SDKs
específicos por provider quando disponíveis, e fetch nativo quando não; registrado por completude, não
é a mesma categoria de duplicidade dos itens acima.

RESPONSIBILITY: Logging
TECHNOLOGIES: (não há duplicidade) — NestJS Logger nativo é o único mecanismo em uso (doc52/54), sem
pino/winston coexistindo.

RESPONSIBILITY: Migration tooling
TECHNOLOGIES: TypeORM migrations (ativo) + Drizzle Kit (arquivado)
RATIONALE_FOUND_IN_CODE: SIM — _DEPRECATED.md explica textualmente a descontinuação do Drizzle Kit em
favor de um único executor (TypeORM), já detalhado no doc45.
```

`DUPLICATED_RESPONSIBILITIES` desta seção: 5 (Database access, runtime TS-em-Node, test framework,
validation, migration tooling — Auth/Logging/HTTP client explicitamente registrados como NÃO
duplicados, por completude da varredura pedida pelo prompt, não contados no total).

---

## 12 — Matriz final da stack

```text
AREA | RESPONSIBILITY | TECHNOLOGY | PACKAGE | DECLARED_VERSION | RESOLVED_VERSION | WORKSPACE | RUNTIME_USAGE | STATUS
Root | Package manager | pnpm | pnpm | 10.11.0 | 10.11.0 | raiz | SIM | ACTIVE
Root | Monorepo orchestration | Turborepo | turbo | latest | 2.10.8 | raiz | SIM | ACTIVE
Root | Linguagem | TypeScript | typescript | ^5.8.3/^5.3.3 | 5.9.3 (única) | raiz+web+api | SIM | ACTIVE
Root | Lint | ESLint | eslint | ^9.32.0 | 9.39.4 | raiz | SIM | ACTIVE
Root | Format | (nenhum) | — | — | — | — | NÃO | N/A
Frontend | UI runtime | React | react | ^18.3.1 | 18.3.1 | web | SIM | ACTIVE
Frontend | Bundler | Vite | vite | ^5.4.19 | 5.4.21 | web | SIM | ACTIVE
Frontend | Router | React Router | react-router-dom | ^6.30.4 | 6.30.4 | web | SIM | ACTIVE
Frontend | State | Zustand | zustand | ^5.0.13 | 5.0.13 | web | PARCIAL | ACTIVE
Frontend | Server state | React Query | @tanstack/react-query | ^5.83.0 | 5.100.10 | web | SIM | ACTIVE
Frontend | Forms | React Hook Form | react-hook-form | ^7.61.1 | 7.76.0 | web | SIM | ACTIVE
Frontend | Validation | Zod | zod | ^3.25.76 | 3.25.76 | web | SIM | ACTIVE
Frontend | CSS | Tailwind | tailwindcss | ^3.4.17 | 3.4.19 | web | SIM | ACTIVE
Frontend | Components | Radix UI | @radix-ui/* | variadas | UNRESOLVED (17 subpkgs) | web | SIM | ACTIVE
Frontend | Icons | Lucide/react-icons | lucide-react/react-icons | ^0.462.0/^5.5.0 | 0.462.0/5.6.0 | web | SIM | ACTIVE
Frontend | Charts | Recharts | recharts | ^2.15.4 | 2.15.4 | web | SIM | ACTIVE
Frontend | Dates | date-fns | date-fns | ^3.6.0 | 3.6.0 | web | SIM | ACTIVE
Frontend | Toasts | Sonner | sonner | ^1.7.4 | 1.7.4 | web | SIM | ACTIVE
Frontend | Analytics | PostHog | posthog-js | ^1.373.2 | 1.373.5 | web | SIM | ACTIVE
Frontend | Error tracking | Sentry | @sentry/react | ^10.52.0 | 10.53.1 | web | SIM | ACTIVE
Frontend | Testing | Vitest | vitest | 2.1.9 | 2.1.9 | web | SIM | TEST_ONLY
Backend | Framework | NestJS | @nestjs/core | ^10.3.0 | 10.4.22 | api | SIM | ACTIVE
Backend | HTTP adapter | Express (via Nest) | express | ^5.2.1 | 5.2.1 | api | SIM | ACTIVE
Backend | Validation | class-validator | class-validator | ^0.14.1 | 0.14.4 | api | SIM | ACTIVE
Backend | ORM | TypeORM | typeorm | ^0.3.31 | 0.3.31 | api | SIM | ACTIVE
Backend | DB driver | pg | pg | ^8.20.0 | 8.20.0 | api | SIM | ACTIVE
Backend | Auth | jsonwebtoken+jwks-rsa | jsonwebtoken/jwks-rsa | ^9.0.3/^4.0.1 | 9.0.3/4.0.1 | api | SIM | ACTIVE
Backend | Config | @nestjs/config | @nestjs/config | ^3.2.0 | 3.3.0 | api | SIM | ACTIVE
Backend | Queues | BullMQ | bullmq | ^5.76.8 | 5.76.8 | api | PARCIAL | PARTIAL
Backend | Security | helmet/compression | helmet/compression | ^7.1.0/^1.7.4 | 7.2.0/1.8.1 | api | SIM | ACTIVE
Backend | Docs | Swagger | @nestjs/swagger | ^7.3.0 | 7.4.2 | api | SIM | ACTIVE
Backend | Health | Terminus | @nestjs/terminus | ^10.2.3 | 10.3.0 | api | SIM | ACTIVE
Backend | Metrics | prom-client | prom-client | ^15.1.3 | 15.1.3 | api | SIM | ACTIVE
Backend | Error tracking | Sentry | @sentry/node | ^10.53.1 | 10.53.1 | api | SIM | ACTIVE
Backend | Testing | Jest | jest | ^30.4.2 | 30.4.2 | api | SIM | TEST_ONLY
Database | Engine | PostgreSQL | — | — | 16 (local)/17 (Supabase, ref. fornecida) | — | SIM | ACTIVE
Database | Migration ativo | TypeORM migrations | typeorm | ^0.3.31 | 0.3.31 | api | SIM | ACTIVE
Database | Migration arquivado | Drizzle Kit | — | — | ausente do lockfile | api | NÃO | ARCHIVED
Auth | Provider | Supabase Auth | @supabase/supabase-js | ^2.105.4 | 2.105.4 | web+api | SIM | ACTIVE
Realtime | Provider | Supabase Realtime | @supabase/supabase-js | ^2.105.4 | 2.105.4 | web+api | SIM | ACTIVE
Deployment | Container | Docker | — | — | — | web+api | CONFIGURED | CONFIGURED
Deployment | Serverless | Vercel Functions | — | — | — | api | CONFIGURED | CONFIGURED
Deployment | CI | GitHub Actions | — | — | — | raiz | ACTIVE | ACTIVE
Shared | Tipos | @music-os-360/types | workspace | workspace:* | workspace:* | web+api | SIM | ACTIVE
Shared | AI Skills | @music-os-360/ai-skills | workspace | workspace:* | workspace:* | api | SIM | ACTIVE
Shared | Config | @music-os-360/config | workspace | workspace:* | workspace:* | web | SIM | ACTIVE
Shared | Auth utils | @music-os-360/auth | workspace | workspace:* | workspace:* | — | NÃO | UNUSED
Shared | Observability | @music-os-360/observability | workspace | workspace:* | workspace:* | — | NÃO | UNUSED
Shared | Schemas | @music-os-360/schemas | workspace | workspace:* | workspace:* | — | NÃO | UNUSED
Shared | UI | @music-os-360/ui | workspace | workspace:* | workspace:* | — | NÃO | UNUSED
Shared | Utils | @music-os-360/utils | workspace | workspace:* | workspace:* | — | NÃO | UNUSED
```

---

## Cobertura

12 seções cobertas com versão DECLARADA e, sempre que confirmável no `pnpm-lock.yaml`, versão
RESOLVIDA — nenhuma versão foi inventada; onde a resolução exata não pôde ser confirmada isoladamente
nesta etapa, registrado `UNRESOLVED`. Dois achados de precisão relevantes frente ao doc54: (1) o
"conflito" de TypeScript entre apps/web/raiz (^5.8.3) e apps/api (^5.3.3) resolve, na prática, para a
MESMA versão única (5.9.3) via lockfile único de workspace — não são 2 versões coexistindo, é 1 versão
com 2 ranges declarados diferentes; (2) o mesmo vale para zod (^3.25.76 vs. ^3.22.4 → ambos resolvem
3.25.76), mas foi encontrada uma SEGUNDA versão major de zod (4.4.3) presente em algum ponto da árvore
de dependências do lockfile, não investigada a fundo por estar fora do escopo desta fotografia pontual.
Nenhuma decisão de manutenção/substituição/atualização foi tomada. Nenhum pacote foi instalado ou
removido. `package.json`/`pnpm-lock.yaml` não foram alterados. `apps/api-v2` não foi criado. `apps/web`,
`apps/api` (legacy), banco e Supabase não foram alterados. Nenhum documento anterior foi modificado.

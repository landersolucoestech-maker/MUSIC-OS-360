> Historical record. Kept as recorded; not the current contract.

# 57 — Stack Exata e Consolidada do Projeto Atual

Visão consolidada e definitiva da stack tecnológica atual do MUSIC OS 360, produzida exclusivamente a partir de [`54`](./54-current-project-stack-audit.md), [`55`](./55-exact-current-stack-inventory.md) e [`56`](./56-unresolved-stack-versions-resolution.md) — nenhuma nova auditoria foi realizada. Nenhuma recomendação de mudança foi feita. Nenhuma comparação com a `apps/api-v2` foi feita. Nenhum pacote foi instalado/atualizado/removido. `apps/web`, `apps/api` (legacy), banco, Supabase e Git não foram alterados. `apps/api-v2` não foi criado. Nenhum documento anterior foi modificado.

---

## 1. Core / Monorepo

```text
Node.js: 20 (USADO EM RUNTIME — fixado em Dockerfiles + CI, sem campo "engines")
pnpm: 10.11.0 (USADO EM RUNTIME)
Turborepo: 2.10.8 (USADO EM RUNTIME — build orchestration)
TypeScript: 5.9.3 (USADO EM RUNTIME — versão única resolvida para todos os ranges declarados no monorepo)
Workspace: pnpm workspaces + Turborepo
```

---

## 2. Frontend

```text
React: 18.3.1 (USADO EM RUNTIME)
Vite: 5.4.21 (USADO EM RUNTIME — bundler)
React Router: 6.30.4 (USADO EM RUNTIME)
TanStack Query: 5.100.10 (USADO EM RUNTIME — server state)
Zustand: 5.0.13 (USADO EM RUNTIME, parcial — 1/20 stores com consumidor real, doc54)
React Hook Form: 7.76.0 (USADO EM RUNTIME)
@hookform/resolvers: 3.10.0 (USADO EM RUNTIME)
Zod: 3.25.76 (USADO EM RUNTIME — validation)
HTTP: fetch nativo, sem biblioteca — wrapper próprio (shared/lib/api-client.ts)
Auth Client: @supabase/supabase-js 2.105.4 (USADO EM RUNTIME)
Realtime: @supabase/supabase-js 2.105.4 (USADO EM RUNTIME — canais Realtime)
UI Components: Radix UI — 19 packages ativos — versões 1.x/2.x conforme lockfile (USADO EM RUNTIME) +
  class-variance-authority 0.7.1 + clsx 2.1.1 + tailwind-merge 2.6.1
CSS: Tailwind CSS 3.4.19 + tailwindcss-animate 1.0.7 (USADO EM RUNTIME)
Icons: lucide-react 0.462.0 + react-icons 5.6.0 (USADO EM RUNTIME)
Charts: recharts 2.15.4 (USADO EM RUNTIME)
Tables: nenhuma biblioteca dedicada de data grid encontrada nesta auditoria
Dates: date-fns 3.6.0 + react-day-picker 8.10.2 (USADO EM RUNTIME)
Observability: posthog-js 1.373.5 (analytics) + @sentry/react 10.53.1 (error tracking) (USADO EM RUNTIME)

DEV/TEST ONLY: vitest 2.1.9, @testing-library/react 16.3.2, @testing-library/jest-dom 6.9.1,
jsdom 27.4.0, @vitest/coverage-v8 2.1.9, eslint 9.39.4
INSTALADO MAS NÃO UTILIZADO: cmdk 1.1.1 (doc54/55 — sem consumidor confirmado)
```

---

## 3. Backend legacy

```text
NestJS: 10.4.22 (USADO EM RUNTIME)
@nestjs/platform-express: 10.4.22 (USADO EM RUNTIME)
Express: 5.2.1 (USADO EM RUNTIME)
class-validator: 0.14.4 (USADO EM RUNTIME)
class-transformer: 0.5.1 (USADO EM RUNTIME)
Zod (escape hatch de validação): 3.25.76 (USADO EM RUNTIME, pontual — doc44)
TypeORM: 0.3.31 (USADO EM RUNTIME)
@nestjs/typeorm: 10.0.2 (USADO EM RUNTIME)
pg: 8.20.0 (USADO EM RUNTIME)
Auth: jsonwebtoken 9.0.3 + jwks-rsa 4.0.1 (USADO EM RUNTIME — implementação própria, sem
  @nestjs/passport)
JWT/JWKS: ver acima
RBAC: implementação própria (TenantGuard/RolesGuard/RbacDecisionService — sem biblioteca de terceiros)
Config: @nestjs/config 3.3.0 + Zod (validação de env, envSchema) (USADO EM RUNTIME)
Security: helmet 7.2.0 + compression 1.8.1 (USADO EM RUNTIME)
Rate Limiting: implementação própria (RateLimitGuard/RateLimitService — sem @nestjs/throttler)
Queues: bullmq 5.76.8 + @nestjs/bullmq 10.2.3 + ioredis 5.10.1 (ATIVO só em modo Docker/long-running;
  ausente em modo serverless Vercel — doc42/54)
Scheduling: Vercel Cron (mecanismo externo, sem biblioteca in-process como @nestjs/schedule)
HTTP Client: SDKs dedicados por provider (ver seção 9/integrações) + fetch nativo quando sem SDK
Uploads/Storage: @aws-sdk/client-s3 3.1048.0 + @aws-sdk/s3-request-presigner 3.1048.0 (R2, USADO EM
  RUNTIME)
API Documentation: @nestjs/swagger 7.4.2 (USADO EM RUNTIME)
Logging/Observability: NestJS Logger nativo (sem pino/winston) + @sentry/node 10.53.1 + prom-client
  15.1.3 + @nestjs/terminus 10.3.0 (USADOS EM RUNTIME)

DEV/TEST ONLY: jest 30.4.2, ts-jest 29.4.9, @nestjs/testing 10.4.22, supertest 7.2.2, ts-node-dev 2.0.0,
tsx 4.22.3
```

---

## 4. Database / Supabase

```text
Database: PostgreSQL 17 (referência do ambiente conectado, fornecida — não determinável só pelo código
  do repositório)
Hosting: Supabase
Auth: Supabase Auth
Realtime: Supabase Realtime
Supabase JS: 2.105.4
RLS: utilizado (docs 45/47/49 — padrão SET LOCAL app.current_tenant_id/org_id/role)
SQL direto via pg: utilizado (QueryRunner.query(), padrão RLS, doc45)
TypeORM: utilizado (ORM principal)
Supabase JS database access: utilizado onde comprovado — Auth (ambos os lados) e Realtime (ambos os
  lados); NÃO comprovado para CRUD de tabela de negócio em nenhum dos dois lados (0 supabase.from() de
  tabela de domínio encontrado, doc17/54)

Extensões PostgreSQL efetivamente instaladas e relevantes: NENHUMA CONFIRMADA — os docs 54-56 não
investigaram extensões PostgreSQL em profundidade (doc54 seção 4 registrou "database functions/
triggers: NÃO CONFIRMADO NESTA ETAPA"); nada é listado aqui para não inventar uma extensão sem
evidência direta nos documentos-fonte desta etapa.
```

---

## 5. Acesso ao banco atual

```text
PRIMARY:
- TypeORM 0.3.31

SECONDARY:
- pg 8.20.0 — SQL direto / RLS (SET LOCAL via QueryRunner)
- @supabase/supabase-js 2.105.4 — Auth/Realtime (não CRUD de domínio)

ARCHIVED / NÃO ATIVO:
- Drizzle — sem versão de package (drizzle-orm/drizzle-kit ausentes do package.json e do
  pnpm-lock.yaml atuais, doc55); os únicos vestígios são arquivos SQL arquivados em
  apps/api/drizzle/ (_DEPRECATED.md), mantidos só como referência histórica, nunca executados
```

---

## 6. Migrations atuais

```text
TypeORM migrations: ACTIVE
Supabase migrations: UNKNOWN (diretório supabase/ confirmado existir; conteúdo/uso não auditado em
  profundidade nos docs 54-56)
SQL manual: UNKNOWN (arquivos .sql na raiz de apps/api — migrations-complete.sql,
  migrations-complete-clean.sql, migrations-temp.sql — presença confirmada, propósito/uso ativo não
  confirmado)
Drizzle Kit migrations: ARCHIVED
Database dumps/scripts: UNKNOWN (scripts/dump-migrations-sql.ts — presença confirmada como gerador de
  saída, não como sistema de migration aplicado)
```

---

## 7. Testes

```text
Jest: 30.4.2 (apps/api)
@nestjs/testing: 10.4.22 (apps/api)
Vitest: 2.1.9 (apps/web)
Testing Library: @testing-library/react 16.3.2 (apps/web)
@testing-library/jest-dom: 6.9.1 (apps/web)
Playwright: 1.62.1 (raiz — e2e/)
Supertest: 7.2.2 (apps/api — uso confirmado, doc54/55)
```

---

## 8. Deployment / Infra

```text
Docker: CONFIGURED — apps/api/Dockerfile (multi-stage, base node:20-alpine3.21 → produção
  gcr.io/distroless/nodejs20-debian12:nonroot), apps/web/Dockerfile (multi-stage, base
  node:20-alpine3.21 → produção nginx:1.27-alpine), docker-compose.yml (+ .observability.yml +
  .prod-test.yml) orquestrando postgres:16-alpine + redis:7-alpine + api — versão do Docker Engine em
  si: versão não fixada no repositório

nginx: 1.27-alpine (imagem base do container de produção de apps/web)

Vercel: CONFIGURED — apps/api/vercel.json (function api/index.ts, rewrites, 4 crons) — versão da
  plataforma Vercel: versão não fixada no repositório (é um serviço gerenciado, não um pacote versionado)

Serverless: CONFIGURED — handler serverless real (api/index.ts), comprovadamente distinto do modo
  Docker (main.ts) no mesmo código-fonte

Long-running API: CONFIGURED — main.ts (app.listen()), único modo em que BullMQ/filas rodam

CI/CD: GitHub Actions — .github/workflows/ci.yml, security.yml, staging.yml, com Node fixado em "20"
  em todos — versão do runner GitHub Actions em si: versão não fixada no repositório (depende da
  imagem de runner escolhida em cada workflow, não auditada nos docs 54-56)
```

---

## 9. Storage / Filas / Jobs

```text
AWS SDK / S3:
@aws-sdk/client-s3: 3.1048.0
@aws-sdk/s3-request-presigner: 3.1048.0
(uso: presign de upload para Cloudflare R2, S3-compatible — USADO EM RUNTIME)

BullMQ:
bullmq: 5.76.8
@nestjs/bullmq: 10.2.3
ioredis: 5.10.1
(USADO EM RUNTIME, só em modo Docker/long-running — ausente em modo serverless Vercel)

Bull Board:
@bull-board/api: 7.1.5
@bull-board/express: 7.1.5
@bull-board/nestjs: 7.1.5
(USADO EM RUNTIME, mesma ressalva de modo acima)

Cron/Scheduler:
Vercel Cron (mecanismo externo à aplicação, sem pacote npm associado — versão não fixada no
  repositório, é um recurso da plataforma)

Supabase Storage:
NÃO USADO — Cloudflare R2 (via AWS SDK S3-compatible) é usado no lugar
```

---

## 10. Stack final resumida

```text
MUSIC OS 360 — STACK ATUAL

Runtime:
Node.js 20

Monorepo:
pnpm 10.11.0 + Turborepo 2.10.8

Frontend:
React 18.3.1
Vite 5.4.21
React Router 6.30.4
TanStack Query 5.100.10
Zustand 5.0.13
React Hook Form 7.76.0
Zod 3.25.76
Radix UI (19 packages)
Tailwind CSS 3.4.19
Supabase JS 2.105.4 (Auth + Realtime)

Backend:
NestJS 10.4.22
Express 5.2.1
class-validator 0.14.4
class-transformer 0.5.1
TypeORM 0.3.31
pg 8.20.0

Database:
PostgreSQL 17
Supabase

Auth:
Supabase Auth

Realtime:
Supabase Realtime

Tests:
Jest 30.4.2
Vitest 2.1.9
Playwright 1.62.1

Deployment:
Docker (long-running, distroless) + Vercel (function serverless) + nginx (estático apps/web) +
GitHub Actions (CI/CD)

Database access atual:
TypeORM + pg + Supabase JS

Migrations:
TypeORM migrations (ACTIVE) — Drizzle Kit (ARCHIVED)
```

---

## Cobertura

Todas as 10 seções obrigatórias produzidas exclusivamente a partir dos docs 54/55/56, sem nova
auditoria do repositório. Cada tecnologia foi classificada explicitamente como USADO EM RUNTIME,
DEV/TEST ONLY, ARQUIVADO ou INSTALADO MAS NÃO UTILIZADO, conforme exigido — nenhuma dependência
instalada aparece como tecnologia principal sem uso real confirmado nos documentos-fonte. Nenhuma
recomendação de mudança foi feita, nenhuma comparação com a `apps/api-v2` foi feita. Nenhum pacote foi
instalado, atualizado ou removido. `package.json`/`pnpm-lock.yaml` não foram alterados. `apps/web`,
`apps/api` (legacy), banco, Supabase e Git não foram alterados. `apps/api-v2` não foi criado. Nenhum
documento anterior foi modificado.

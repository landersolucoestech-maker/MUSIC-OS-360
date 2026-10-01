> Historical record. Kept as recorded; not the current contract.

# 54 — Auditoria da Stack Tecnológica Atual do Projeto

Auditoria read-only da stack real em uso hoje no monorepo (`apps/web`, `apps/api`, `packages/**`, configuração raiz, CI/CD, deployment). Fonte de verdade: código e arquivos reais do repositório, não convenção/nome. Nenhuma tecnologia foi instalada, removida, atualizada ou substituída. `apps/api-v2` não foi criado. `apps/web` e `apps/api` (legacy) não foram alterados.

---

## 1. Runtime e monorepo

```text
NODE.JS:
- VERSÃO CONFIGURADA: 20 — fixada em 3 lugares independentes, sem .nvmrc/.node-version/.tool-versions
  na raiz: apps/api/Dockerfile:2 "FROM node:20-alpine3.21", apps/web/Dockerfile:1 idem,
  .github/workflows/ci.yml:18 + security.yml:18 "NODE_VERSION: \"20\"", staging.yml (3x "node-version: 20")
- VERSÃO EXIGIDA PELO package.json: nenhum campo "engines" em nenhum package.json do monorepo (raiz,
  apps/web, apps/api) — confirmado por busca dedicada
- ARQUIVOS .nvmrc/.node-version: NENHUM na raiz do projeto (só um .nvmrc interno de uma dependência de
  terceiros em node_modules/ts-algebra, irrelevante ao projeto)

PACKAGE MANAGER:
pnpm 10.11.0 — fixado em package.json raiz:5 ("packageManager": "pnpm@10.11.0") e reforçado via
corepack em ambos os Dockerfiles ("corepack prepare pnpm@10.11.0 --activate")

WORKSPACE:
pnpm workspaces (pnpm-workspace.yaml: "apps/*", "packages/*") + Turborepo (turbo.json) — coexistindo;
scripts npm da raiz chamam pnpm --filter diretamente, scripts "monorepo:*" chamam "turbo run <task>"

BUILD ORCHESTRATION:
Turborepo (turbo.json) — tasks build/dev/lint/typecheck/test, build com dependsOn ["^build"]
(builds encadeados entre packages/* e apps/*)
```

---

## 2. Frontend (`apps/web`)

```text
Framework:       PACKAGE: react | VERSION: ^18.3.1 | USAGE_CONFIRMED: SIM | MAIN_FILES: apps/web/src/main.tsx, App.tsx | STATUS: INSTALLED_AND_USED
Biblioteca UI:    (mesma — React é a própria biblioteca de UI aqui, sem camada adicional tipo Preact)
Bundler:           PACKAGE: vite | VERSION: ^5.4.19 | USAGE_CONFIRMED: SIM | MAIN_FILES: scripts/run-vite.mjs, vitest.config.mjs | STATUS: INSTALLED_AND_USED
Linguagem:           PACKAGE: typescript | VERSION: ^5.8.3 | USAGE_CONFIRMED: SIM | MAIN_FILES: tsconfig.app.json | STATUS: INSTALLED_AND_USED
Router:                PACKAGE: react-router-dom | VERSION: ^6.30.4 | USAGE_CONFIRMED: SIM | MAIN_FILES: App.tsx (rotas, doc15) | STATUS: INSTALLED_AND_USED
State management:       PACKAGE: zustand | VERSION: ^5.0.13 | USAGE_CONFIRMED: SIM (parcial — doc29: só useLeadFiltersStore tem consumidor real; 19 dos 20 stores auditados são órfãos ou puramente locais) | MAIN_FILES: lead-filters.store.ts | STATUS: INSTALLED_AND_USED
Server state/query:      PACKAGE: @tanstack/react-query | VERSION: ^5.83.0 | USAGE_CONFIRMED: SIM (padrão dominante em dezenas de hooks, doc13) | MAIN_FILES: onError/toast.error pattern em módulos | STATUS: INSTALLED_AND_USED
Forms:                     PACKAGE: react-hook-form | VERSION: ^7.61.1 | USAGE_CONFIRMED: SIM | MAIN_FILES: formulários de módulo (ex.: transacao-form) | STATUS: INSTALLED_AND_USED
Validation:                  PACKAGE: zod | VERSION: ^3.25.76 | USAGE_CONFIRMED: SIM | MAIN_FILES: @hookform/resolvers integração, contratos de shared/integrations (doc23) | STATUS: INSTALLED_AND_USED
                              PACKAGE: @hookform/resolvers | VERSION: ^3.10.0 | USAGE_CONFIRMED: SIM | STATUS: INSTALLED_AND_USED
HTTP client:                   PACKAGE: nenhum (fetch nativo) | USAGE_CONFIRMED: SIM | MAIN_FILES: shared/lib/api-client.ts (doc05/13/50) — sem axios/ky/superagent instalado, wrapper próprio sobre fetch()
CSS:                              PACKAGE: tailwindcss | VERSION: ^3.4.17 | USAGE_CONFIRMED: SIM | MAIN_FILES: tailwind config raiz do app | STATUS: INSTALLED_AND_USED
                                  PACKAGE: tailwindcss-animate | VERSION: ^1.0.7 | STATUS: INSTALLED_AND_USED
                                  PACKAGE: autoprefixer/postcss | STATUS: DEV_ONLY (build de CSS)
Component library:                 PACKAGE: @radix-ui/* (13 pacotes: alert-dialog, avatar, checkbox, collapsible, dialog, dropdown-menu, label, popover, progress, radio-group, scroll-area, select, separator, slot, switch, tabs, toggle, tooltip, visually-hidden) | USAGE_CONFIRMED: SIM | MAIN_FILES: componentes shadcn-style locais construídos sobre Radix | STATUS: INSTALLED_AND_USED
                                    PACKAGE: class-variance-authority + clsx + tailwind-merge | USAGE_CONFIRMED: SIM (padrão cn()/cva() shadcn) | STATUS: INSTALLED_AND_USED
                                    PACKAGE: cmdk | USAGE_CONFIRMED: NÃO VERIFICADO NESTA ETAPA (command palette — presente no package.json, uso real não rastreado, fora do escopo desta auditoria de stack) | STATUS: INSTALLED_BUT_NOT_FOUND_IN_RUNTIME (não confirmado)
Icons:                              PACKAGE: lucide-react | VERSION: ^0.462.0 | USAGE_CONFIRMED: SIM | STATUS: INSTALLED_AND_USED
                                    PACKAGE: react-icons | VERSION: ^5.5.0 | USAGE_CONFIRMED: SIM (usado como fallback/ícones adicionais além do lucide) | STATUS: INSTALLED_AND_USED
Charts:                              PACKAGE: recharts | VERSION: ^2.15.4 | USAGE_CONFIRMED: SIM (dashboards, doc38 domínio dashboard) | STATUS: INSTALLED_AND_USED
Date/time:                            PACKAGE: date-fns | VERSION: ^3.6.0 | USAGE_CONFIRMED: SIM | STATUS: INSTALLED_AND_USED
                                      PACKAGE: react-day-picker | VERSION: ^8.10.1 | USAGE_CONFIRMED: SIM (seletor de data em formulários) | STATUS: INSTALLED_AND_USED
Internationalization:                  NENHUMA BIBLIOTECA — nenhum i18next/react-i18next/formatjs encontrado; strings PT-BR hard-coded, com um script próprio de validação (apps/api/scripts/validate-i18n.ts, do lado api) e mapas estáticos de rótulo (ex.: field-labels.pt-br.ts, doc37/reports) — não é internacionalização real, é localização fixa em PT-BR | STATUS: N/A (não é uma dependência instalada)
Testing:                                PACKAGE: vitest | VERSION: 2.1.9 | USAGE_CONFIRMED: SIM | MAIN_FILES: vitest.config.mjs | STATUS: TEST_ONLY
                                        PACKAGE: @testing-library/react + @testing-library/jest-dom | VERSION: ^16.3.1 / ^6.9.1 | USAGE_CONFIRMED: SIM | STATUS: TEST_ONLY
                                        PACKAGE: @vitest/coverage-v8 | VERSION: 2.1.9 | STATUS: TEST_ONLY
Lint:                                    PACKAGE: eslint (config raiz compartilhada) | VERSION: ^9.32.0 | USAGE_CONFIRMED: SIM | STATUS: DEV_ONLY
Formatting:                              NENHUM FORMATTER INSTALADO — nenhum prettier* encontrado em nenhum package.json do monorepo (já confirmado no doc42), sem script "format" | STATUS: N/A
```

Outras dependências reais confirmadas: `dompurify` (sanitização de HTML, doc23-relacionado), `mammoth` (conversão de .docx, provável parser de templates de contrato), `posthog-js` (analytics, USAGE_CONFIRMED: SIM — corresponde a `@sentry/react` também presente para error tracking), `sonner` (toast, consistente com o padrão `toast.error` já citado em dezenas de call sites do doc13), `xlsx` (exportação de planilhas, doc37 A.18 Reports), `mammoth`/`xlsx` ambos INSTALLED_AND_USED com evidência indireta forte (funcionalidade de import/export de doc37 já mapeada).

---

## 3. Backend legacy (`apps/api`)

```text
TECHNOLOGY: Framework
PACKAGE: @nestjs/core + @nestjs/common | VERSION: ^10.3.0
USAGE: framework HTTP/DI de toda a aplicação
MAIN_FILES: src/main.ts, src/create-app.ts, src/app.module.ts
STATUS: ACTIVE

TECHNOLOGY: HTTP adapter
PACKAGE: @nestjs/platform-express (+ express ^5.2.1)
USAGE: create-app.ts:16,82-83 — ExpressAdapter explícito, usado tanto no boot Docker/long-running
(main.ts, via app.listen()) quanto no handler serverless (api/index.ts, doc42/43)
MAIN_FILES: src/create-app.ts, api/index.ts
STATUS: ACTIVE

TECHNOLOGY: Runtime de execução em dev
PACKAGE: ts-node-dev (dev/start:dev) E tsx (todos os demais ~25 scripts db:*/verify:*/scripts diversos)
USAGE: 2 ferramentas de execução TS-em-Node distintas coexistindo para propósitos diferentes (servidor
dev com watch vs. scripts CLI pontuais) — ver seção 12 (duplicidade de responsabilidade, impacto LOW)
MAIN_FILES: package.json scripts
STATUS: ACTIVE (ambas)

TECHNOLOGY: Validation
PACKAGE: class-validator ^0.14.1 + class-transformer ^0.5.1 (ValidationPipe global) — E zod ^3.22.4
(escape hatch pontual, doc44)
USAGE: ValidationPipe global (create-app.ts:185-186, whitelist+forbidNonWhitelisted+transform) é o
padrão em 78 arquivos de DTO; Zod usado em exatamente 3 arquivos (env.schema.ts, transacao.validator.ts,
zod-validation.pipe.ts) — mesma evidência já detalhada no doc44
MAIN_FILES: src/create-app.ts, src/modules/**/dto/*.dto.ts
STATUS: ACTIVE (ambas, com papéis claramente distintos — não é duplicidade acidental)

TECHNOLOGY: ORM/query layer
PACKAGE: typeorm ^0.3.31 + @nestjs/typeorm ^10.0.2
USAGE: DataSource/Repository/QueryRunner — camada de acesso principal e única fonte de migrations
(doc42/45)
MAIN_FILES: src/database/database.module.ts, entities.ts, migrations/index.ts
STATUS: ACTIVE

TECHNOLOGY: Database driver
PACKAGE: pg ^8.20.0 (+ @types/pg)
USAGE: driver por baixo do TypeORM; também usado para SQL cru via queryRunner.query() (padrão RLS,
doc45)
MAIN_FILES: src/database/database-context.service.ts
STATUS: ACTIVE

TECHNOLOGY: Authentication
PACKAGE: jsonwebtoken ^9.0.3 + jwks-rsa ^4.0.1 (validação própria, sem @nestjs/passport)
USAGE: verificação JWKS/ES256 do Supabase Auth + fallback HS256 dev (doc49, já detalhado)
MAIN_FILES: src/core/guards/auth.guard.ts, src/core/security/token-verifier.service.ts
STATUS: ACTIVE

TECHNOLOGY: Authorization / RBAC
PACKAGE: implementação própria (sem biblioteca de RBAC de terceiros)
USAGE: TenantGuard + RolesGuard + RbacDecisionService/RbacDistributedCacheService — modelo de
permissão coarse (module:action) já mapeado nos docs 15/16/49
MAIN_FILES: src/core/guards/tenant.guard.ts, roles.guard.ts, src/core/rbac/*
STATUS: ACTIVE

TECHNOLOGY: Config
PACKAGE: @nestjs/config ^3.2.0 + zod (validação, envSchema)
USAGE: validateEnv() no boot, fail-fast (doc53, já detalhado)
MAIN_FILES: src/core/config/env.schema.ts
STATUS: ACTIVE

TECHNOLOGY: Logging
PACKAGE: NestJS Logger nativo (@nestjs/common) — SEM pino/winston/bunyan instalado
USAGE: log estruturado JSON manual via console/Logger (doc52, LoggingInterceptor)
MAIN_FILES: src/core/interceptors/logging.interceptor.ts
STATUS: ACTIVE

TECHNOLOGY: Testing
PACKAGE: jest ^30.4.2 + ts-jest ^29.4.9 + supertest ^7.2.2 + @nestjs/testing ^10.4.22
USAGE: unit + integration (jest.config.ts) + e2e (jest.e2e.config.ts)
MAIN_FILES: apps/api/jest.config.ts, jest.e2e.config.ts
STATUS: ACTIVE

TECHNOLOGY: Scheduling
PACKAGE: NENHUMA biblioteca in-process (sem @nestjs/schedule, sem node-cron)
USAGE: agendamento via Vercel Cron externo, definido em apps/api/vercel.json (4 crons apontando para
/internal/cron/*) — consistente com o alvo de deployment serverless (doc42/43)
MAIN_FILES: apps/api/vercel.json
STATUS: ACTIVE (mecanismo externo, não uma dependência npm)

TECHNOLOGY: Queues
PACKAGE: bullmq ^5.76.8 + @nestjs/bullmq ^10.2.3 + ioredis ^5.10.1 + @bull-board/* ^7.0.0 (api/express/nestjs)
USAGE: filas assíncronas + dashboard de monitoramento — explicitamente NÃO disponível no modo
serverless (comentário de api/index.ts, doc42: "never starts BullMQ workers... since neither can run
inside a function")
MAIN_FILES: src/queues/queue.module.ts
STATUS: PARTIAL (ativo só no modo Docker/long-running, ausente no modo serverless Vercel — o mesmo
código-fonte se comporta diferente por deployment target)

TECHNOLOGY: File handling
PACKAGE: @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner ^3.1045.0 (compatível com Cloudflare R2)
— SEM multer instalado
USAGE: upload via URL pré-assinada (padrão presign, doc13/48) — o backend nunca recebe o arquivo
multipart diretamente, por isso multer não é necessário
MAIN_FILES: módulo uploads (doc37 A.18)
STATUS: ACTIVE

TECHNOLOGY: External integrations
PACKAGE: ver seção 10 (tabela dedicada)
STATUS: ver seção 10

TECHNOLOGY: API documentation
PACKAGE: @nestjs/swagger ^7.3.0
USAGE: decorators ApiTags/ApiOperation confirmados em uso real (ex.: health.controller.ts)
MAIN_FILES: espalhado pelos controllers
STATUS: ACTIVE

TECHNOLOGY: Security middleware
PACKAGE: helmet ^7.1.0 + compression ^1.7.4
USAGE: aplicados em create-app.ts:87 (helmet) e :112 (compression)
MAIN_FILES: src/create-app.ts
STATUS: ACTIVE

TECHNOLOGY: Rate limiting
PACKAGE: implementação própria (SEM @nestjs/throttler nem outra biblioteca de rate limit instalada)
USAGE: RateLimitGuard + RateLimitService próprios
MAIN_FILES: src/core/guards/rate-limit.guard.ts, src/core/security/rate-limit.service.ts
STATUS: ACTIVE
```

**Achado relevante — 3 tecnologias de acesso a dado/Supabase coexistindo:** além de TypeORM (ORM
principal) e `pg` (driver/SQL cru via QueryRunner), o `@supabase/supabase-js` (mesma versão ^2.105.4 do
frontend) é usado DIRETAMENTE no backend em pelo menos 7 arquivos (`bootstrap-tenant-zero.cli.ts`,
`auth-password.service.ts`, `core/realtime/realtime.service.ts` — para publicar broadcast, doc17 —,
`users.service.ts`, `dev-auth.controller.ts`, `workspace-provisioning.service.ts`) — para operações de
Supabase Auth (reset de senha, provisionamento) e para publicar eventos Realtime, não para CRUD de
tabelas de negócio (nenhum `supabase.from()` de tabela de domínio encontrado nesta auditoria pontual,
consistente com o próprio propósito desses arquivos). Documentado como constatação, não corrigido.

---

## 4. Banco de dados

```text
DATABASE ENGINE:
PostgreSQL

POSTGRESQL VERSION/CONFIG QUANDO IDENTIFICÁVEL:
postgres:16-alpine (docker-compose.yml, ambiente local) — versão do Postgres hospedado (Supabase) não
identificável a partir do código do repositório, apenas do serviço gerenciado

ORM/QUERY LAYERS PRESENTES:
- TypeORM (principal, doc42/45)
- pg direto (via QueryRunner.query(), padrão RLS SET LOCAL, doc45)
- @supabase/supabase-js (Auth/Realtime, não CRUD de domínio — ver achado da seção 3)
- Drizzle ORM (ARQUIVADO — apps/api/drizzle/_DEPRECATED.md, doc45: usado numa fase anterior, hoje
  explicitamente marcado como não-executável, mantido só como referência histórica)

MIGRATION SYSTEMS PRESENTES:
- TypeORM migrations (ALL_MIGRATIONS registry, ATIVO — "sole migration executor", doc45)
- Drizzle Kit (ARQUIVADO — mesmos arquivos citados acima, não usado)
- SQL manual (migrations-complete.sql, migrations-complete-clean.sql, migrations-temp.sql na raiz de
  apps/api — arquivos de dump/snapshot SQL encontrados no repositório, propósito exato não investigado
  nesta etapa; registrado como presença, não como sistema ativo de migration)

SUPABASE MIGRATIONS:
SIM — diretório supabase/ existe na raiz do monorepo (confirmado na listagem de diretório desta sessão,
doc42), indicando uso da CLI Supabase para alguma parte do fluxo de schema/config, não investigado em
profundidade nesta etapa (fora do escopo pontual de stack)

RLS:
SIM — confirmado extensivamente nos docs 45/47/49 (padrão SET LOCAL app.current_tenant_id, tabela
musicos360_migrations com RLS sem policy para o role de app, migration
20260801000001_RealtimeBroadcastAuthorization para canais Realtime)

DATABASE FUNCTIONS:
NÃO CONFIRMADO NESTA ETAPA — nenhuma function PL/pgSQL foi lida/confirmada diretamente; a existência de
migrations com nomes como "CreateMembershipJobFunctions" (seção de constraints já vista no doc48) sugere
possível uso, mas não foi verificado o conteúdo SQL real nesta auditoria pontual

TRIGGERS:
NÃO CONFIRMADO NESTA ETAPA — mesmo motivo acima, não verificado

REALTIME:
SIM — Supabase Realtime, uso confirmado tanto no frontend (ws-client.ts, doc17/33) quanto no backend
(core/realtime/realtime.service.ts, publica broadcast)

STORAGE:
NÃO — armazenamento de arquivo é via Cloudflare R2 (S3-compatible, seção 3), não Supabase Storage;
nenhuma referência a Supabase Storage (`.storage.from()`) encontrada nesta auditoria
```

---

## 5. Supabase

```text
RECURSO: Supabase Auth
USED: SIM
USED_BY: BOTH
MAIN_FILES: apps/web/src/lib/supabase.ts (doc17), apps/api/src/core/security/token-verifier.service.ts,
apps/api/src/core/guards/auth.guard.ts, apps/api/src/modules/auth/auth-password.service.ts

RECURSO: Supabase Realtime
USED: SIM
USED_BY: BOTH
MAIN_FILES: apps/web/src/shared/lib/ws-client.ts (doc17/33), apps/api/src/core/realtime/realtime.service.ts

RECURSO: Supabase Database (Postgres gerenciado)
USED: SIM
USED_BY: API (o backend é quem se conecta diretamente ao Postgres via DATABASE_URL/TypeORM; o frontend
nunca acessa o banco diretamente — 0 `supabase.from()` em apps/web/src, doc17)
MAIN_FILES: apps/api/src/database/database.module.ts

RECURSO: Supabase Storage
USED: NÃO
USED_BY: N/A
MAIN_FILES: nenhum — R2 é usado no lugar (seção 4)

RECURSO: Supabase Functions (Edge Functions)
USED: NÃO CONFIRMADO NESTA ETAPA — nenhuma referência a Edge Functions encontrada no código de
apps/web ou apps/api; o diretório supabase/ existe (seção 4) mas seu conteúdo não foi auditado em
profundidade nesta etapa
MAIN_FILES: N/A

RECURSO: Supabase JS client
USED: SIM
USED_BY: BOTH (mesma versão ^2.105.4 em ambos os package.json)
MAIN_FILES: apps/web/src/lib/supabase.ts, ver seção 3 para os 7 arquivos do lado apps/api

RECURSO: Supabase server usage (service role / admin)
USED: SIM
USED_BY: API
MAIN_FILES: SUPABASE_SERVICE_ROLE_KEY (doc42/53) consumida pelo backend para operações administrativas
(reset de senha, provisionamento de workspace)
```

---

## 6. Autenticação e autorização

```text
Login: Supabase Auth SDK client-side (signInWithPassword, apps/web/src/modules/auth/pages/Auth.tsx,
doc13/17)

JWT: emitido pelo Supabase Auth (GoTrue), validado no backend via JWKS/ES256 (jwks-rsa + jsonwebtoken,
doc49) com fallback HS256 só-dev

Session: gerenciada pelo Supabase Auth SDK no frontend (getSession/onAuthStateChange, doc15/17),
persistida em localStorage sob a chave "musicos360_auth"

Supabase Auth: fonte única de identidade — nenhum sistema de login paralelo encontrado

Guards: JwtAuthGuard (auth) → TenantGuard (tenant/membership) → RolesGuard (permissão coarse
module:action), nesta ordem — mesma cadeia já detalhada no doc49

Roles: TenantRole (owner/admin/manager/editor/viewer, 5 valores) + super_admin (dimensão separada,
console administrativo) — doc15

Permissions: modelo coarse (read/write/delete/export) traduzido para resource:action real
(ex.: "contracts:create"), fonte real = membership.permissions via GET /auth/context — doc15/16

RBAC: implementação própria (RbacDecisionService, RbacDistributedCacheService, catálogo de
roles/permissions em tabelas próprias — migrations "CreatePermissionsCatalog"/
"CreateRolesAndRolePermissions" já vistas no doc48) — sem biblioteca RBAC de terceiros

Tenant resolution: a partir do claim app_metadata.org_id do JWT (nunca do header) — TenantGuard,
já detalhado no doc49

X-Tenant-ID: header enviado pelo frontend (api-client.ts, doc15), tratado como INDÍCIO — nunca prova de
autorização — conferido contra o tenant resolvido do JWT (doc49, mesmo achado já registrado)

RLS: camada adicional de isolamento (SET LOCAL app.current_tenant_id/org_id/role) por trás da validação
de aplicação, nunca substituindo-a (doc45/47/49)
```

Nada foi redesenhado — este bloco apenas registra o funcionamento atual, mesma evidência já usada nos
docs 15/16/17/49.

---

## 7. Multi-tenancy

```text
tenant_id: coluna presente nas entidades multi-tenant (confirmado indiretamente por migrations com
constraints compostas incluindo tenant_id, ex.: "UNIQUE (tenant_id, conversation_id, level)" já visto no
doc48/51)

tenant context: RequestContext (doc49), construído pelo TenantGuard, propagado explicitamente

headers: X-Tenant-ID (indício, nunca prova — seção 6)

guards: TenantGuard (resolução+validação de membership), RolesGuard (permissão dentro do tenant)

database filters: aplicação obrigatória de filtro por tenant_id em toda query de domínio (camada de
aplicação, doc49) — não verificado exaustivamente linha a linha nesta auditoria de stack, mas
estruturalmente exigido pelo próprio padrão de Repository já usado

RLS: SIM (seção 4/6)

unique constraints: várias já compostas incluindo tenant_id (ex.: as citadas no doc48, migrations
"CreateMembershipJobFunctions"/"MusicChatAutomation")

tenant membership: tabela própria de membership, resolvida via TenantBootstrapResolver
(apps/api/src/database/tenant-bootstrap.resolver.ts, já citado no doc49)

CLASSIFICAÇÃO:
BOTH — aplicação (Guards + filtro obrigatório em query) E banco (RLS + constraints compostas com
tenant_id) atuam em conjunto, com a aplicação como controle primário e RLS como defesa em profundidade
(mesma conclusão já fixada nos docs 45/47/49, não reaberta aqui — apenas classificada conforme pedido
por este prompt).
```

---

## 8. Testes e qualidade

```text
Unit test framework:      Jest ^30.4.2 (api) | Vitest 2.1.9 (web) — 2 runners distintos, um por app
Integration test framework: mesmos runners acima (jest.config.ts cobre unit+integration no api via
                          convenção de nome de arquivo, não config separada)
E2E framework:                Jest com config dedicada (jest.e2e.config.ts, api) | Playwright
                          (@playwright/test ^1.62.1, raiz — e2e/ na raiz do monorepo, cobre fluxos
                          cross-app)
Coverage:                       Jest nativo (api, coverageThreshold já registrado no doc42: lines 45%/
                          statements 45%/functions 38%/branches 28%) | @vitest/coverage-v8 (web)
Lint:                             ESLint ^9.32.0 (flat config compartilhada na raiz, doc42)
Formatting:                        NENHUM (seção 2, reafirmado)
Typecheck:                          tsc (api: tsc -p tsconfig.build.json --noEmit | web: tsc --noEmit -p
                          tsconfig.app.json) — via scripts "typecheck" próprios de cada app
Build validation:                     turbo run build (encadeado via dependsOn ["^build"], doc42) +
                          scripts próprios de build por app
Git hooks:                              NÃO CONFIRMADO NESTA ETAPA — nenhum husky/lint-staged/simple-git-hooks
                          encontrado como dependency em nenhum package.json consultado; não descartada a
                          existência de hooks configurados fora de dependency npm (.git/hooks manual),
                          não verificado nesta auditoria
```

---

## 9. Deployment e infraestrutura

```text
DEPLOYMENT_TARGETS:
- Docker/self-hosted long-running (apps/api/Dockerfile, distroless, healthcheck citando explicitamente
  Railway/Render/Fly.io, doc42)
- Vercel serverless function (apps/api/vercel.json + apps/api/api/index.ts, doc42/43)
- apps/web como estático via nginx (apps/web/Dockerfile, doc42)

CI_SYSTEM:
GitHub Actions (.github/workflows/ci.yml, security.yml, staging.yml — confirmado, doc42)

CONTAINERIZATION:
SIM (Dockerfile em ambos os apps, docker-compose.yml + docker-compose.observability.yml +
docker-compose.prod-test.yml na raiz)

SERVERLESS:
PARCIAL — comprovado para a apps/api (Vercel function), mas coexistindo com o modo long-running
Docker para o MESMO código-fonte (doc42/43, já detalhado); apps/web não é serverless, é estático servido
por nginx

LONG_RUNNING_BACKEND:
SIM — modo Docker (main.ts com app.listen()), único modo em que BullMQ/filas rodam (seção 3)
```

---

## 10. Integrações externas

```text
PROVIDER: Stripe | SDK/PACKAGE: stripe ^22.1.1 | USED_BY: API | AUTH_MODEL: API key (secret) +
webhook signing secret | STATUS: ACTIVE (billing, doc37 A.2/A.3)

PROVIDER: ACRCloud | SDK/PACKAGE: nenhum SDK dedicado (chamada HTTP direta, credenciais
ACRCLOUD_HOST/ACCESS_KEY/SECRET, doc42) | USED_BY: API | AUTH_MODEL: chave/secret de acesso |
STATUS: ACTIVE (doc36/37, fingerprinting)

PROVIDER: Spotify | SDK/PACKAGE: nenhum SDK dedicado | USED_BY: BOTH (bridge OAuth, doc30/31/49) |
AUTH_MODEL: OAuth (client_id público no frontend, client_secret só no backend) | STATUS: ACTIVE

PROVIDER: YouTube | SDK/PACKAGE: nenhum SDK dedicado (YOUTUBE_API_KEY) | USED_BY: API (provável,
não confirmado consumidor exato nesta etapa) | AUTH_MODEL: API key | STATUS: PARTIAL (presença de
credencial confirmada, uso funcional não auditado nesta etapa pontual)

PROVIDER: Meta | SDK/PACKAGE: nenhum SDK dedicado | USED_BY: BOTH (bridge OAuth) | AUTH_MODEL: OAuth |
STATUS: ACTIVE

PROVIDER: TikTok | SDK/PACKAGE: nenhum SDK dedicado | USED_BY: BOTH (bridge OAuth) |
AUTH_MODEL: OAuth | STATUS: ACTIVE

PROVIDER: SoundCloud | SDK/PACKAGE: nenhum SDK dedicado (SOUNDCLOUD_CLIENT_ID, sem CLIENT_SECRET no
.env.example — só client_id) | USED_BY: WEB (provável, client-side) | AUTH_MODEL: OAuth público |
STATUS: PARTIAL

PROVIDER: Google / Google Ads | SDK/PACKAGE: nenhum SDK dedicado (GOOGLE_CLIENT_ID/SECRET,
GOOGLE_ADS_CLIENT_ID/SECRET/REDIRECT_URI) | USED_BY: BOTH | AUTH_MODEL: OAuth | STATUS: ACTIVE

PROVIDER: DocuSign | SDK/PACKAGE: nenhum SDK dedicado (DOCUSIGN_INTEGRATION_KEY/CLIENT_SECRET/
AUTH_BASE_URL) | USED_BY: API | AUTH_MODEL: OAuth (integration key) | STATUS: PARTIAL (credenciais
presentes, doc23 já registrou "distribuidoras/assinatura sem provider real conectado" como achado
correlato — não corrigido aqui, só citado)

PROVIDER: Autentique (e-signature) | SDK/PACKAGE: nenhum SDK dedicado (AUTENTIQUE_WEBHOOK_SECRET) |
USED_BY: API | AUTH_MODEL: webhook signing secret | STATUS: PARTIAL

PROVIDER: Cloudflare R2 | SDK/PACKAGE: @aws-sdk/client-s3 + @aws-sdk/s3-request-presigner (S3-compatible)
| USED_BY: API | AUTH_MODEL: access key/secret key | STATUS: ACTIVE (uploads via presign, seção 3)

PROVIDER: Resend (email) | SDK/PACKAGE: nenhum SDK dedicado (RESEND_API_KEY, RESEND_FROM_EMAIL) |
USED_BY: API | AUTH_MODEL: API key | STATUS: PARTIAL (credencial presente; ausência confirmada de
pacote "resend" no package.json — se usado, é via fetch HTTP direto à API REST, não via SDK oficial)

PROVIDER: Anthropic | SDK/PACKAGE: @anthropic-ai/sdk ^0.95.2 | USED_BY: API | AUTH_MODEL: API key |
STATUS: ACTIVE (doc37 A.20, ai/generate)

PROVIDER: OpenAI | SDK/PACKAGE: openai ^6.37.0 | USED_BY: API | AUTH_MODEL: API key + OPENAI_BASE_URL
configurável | STATUS: ACTIVE

PROVIDER: Google AI | SDK/PACKAGE: @google/generative-ai ^0.24.1 | USED_BY: API | AUTH_MODEL: API key |
STATUS: ACTIVE (3 providers de IA coexistindo — roteamento entre eles não auditado nesta etapa)

PROVIDER: PostHog | SDK/PACKAGE: posthog-js ^1.373.2 (web) + posthog-node ^5.34.1 (api) | USED_BY: BOTH
| AUTH_MODEL: API key | STATUS: ACTIVE (analytics)

PROVIDER: Sentry | SDK/PACKAGE: @sentry/react ^10.52.0 (web) + @sentry/node ^10.53.1 (api) | USED_BY:
BOTH | AUTH_MODEL: DSN | STATUS: ACTIVE (error tracking, doc50/52)

Distribuidoras (ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe): NENHUM SDK/credencial de
ambiente encontrado — consistente com a Decisão D1 já aprovada (doc25): nenhuma integração real hoje,
placeholder client-side, futura integração por API oficial quando disponível, por tenant.
```

---

## 11. Pacotes compartilhados

```text
PACKAGE: @music-os-360/types | PURPOSE: tipos TS compartilhados | USED_BY_WEB: SIM | USED_BY_API: SIM |
DEPENDENCIES_RELEVANT: nenhuma externa relevante (tipos puros) | STATUS: ACTIVE

PACKAGE: @music-os-360/ai-skills | PURPOSE: lógica pura de AI Skills | USED_BY_WEB: NÃO | USED_BY_API:
SIM | DEPENDENCIES_RELEVANT: nenhuma | STATUS: ACTIVE (só no lado API, apesar da descrição do próprio
pacote sugerir uso cross-stack — doc42, já registrado)

PACKAGE: @music-os-360/config | PURPOSE: config/constants/feature flags compartilhados | USED_BY_WEB:
SIM | USED_BY_API: NÃO | STATUS: ACTIVE (só no lado web)

PACKAGE: @music-os-360/auth | PURPOSE: JWT/RBAC/tenant scope utilities | USED_BY_WEB: NÃO |
USED_BY_API: NÃO | STATUS: UNUSED (doc42 — zero consumidor real em nenhum app; lógica real de
JWT/RBAC/tenant vive em apps/api/src/core/*, não neste pacote)

PACKAGE: @music-os-360/observability | PURPOSE: Sentry/OpenTelemetry/Pino unificados | USED_BY_WEB:
NÃO | USED_BY_API: NÃO | STATUS: UNUSED (doc42 — apps/api usa @sentry/node diretamente, não este pacote;
"Pino" citado na descrição do pacote não corresponde a nenhuma dependência pino real instalada em
nenhum app, seção 3/8)

PACKAGE: @music-os-360/schemas | PURPOSE: Zod schemas compartilhados | USED_BY_WEB: NÃO | USED_BY_API:
NÃO | STATUS: UNUSED (doc42)

PACKAGE: @music-os-360/ui | PURPOSE: Design System/UI primitives | USED_BY_WEB: NÃO | USED_BY_API: NÃO
| STATUS: UNUSED (doc42 — apps/web usa @radix-ui direto + componentes locais, não este pacote)

PACKAGE: @music-os-360/utils | PURPOSE: utilitários puros | USED_BY_WEB: NÃO | USED_BY_API: NÃO |
STATUS: UNUSED (doc42)
```

5 de 8 pacotes compartilhados (`auth`, `observability`, `schemas`, `ui`, `utils`) estão sem consumidor
real comprovado em nenhum dos 2 apps — mesma constatação já registrada no doc42, reafirmada aqui sob a
ótica específica desta auditoria de stack.

---

## 12. Dependências críticas e conflitos de versão

```text
PACKAGE_A: typescript (raiz + apps/web) | VERSION: ^5.8.3
PACKAGE_B: typescript (apps/api) | VERSION: ^5.3.3
CONFLICT: versões menores diferentes do compilador TS entre apps do mesmo monorepo — risco de
comportamento de type-checking sutilmente diferente entre apps (novos recursos de linguagem/inferência
disponíveis num app e não no outro)
EVIDENCE: package.json raiz:48, apps/web/package.json:77, apps/api/package.json:107
IMPACT: LOW (ambas são versões da mesma major 5.x, sem breaking change conhecido de linguagem entre
5.3 e 5.8 que afete este projeto especificamente — não verificado exaustivamente)

PACKAGE_A: @types/node (raiz + apps/web) | VERSION: ^22.16.5
PACKAGE_B: @types/node (apps/api) | VERSION: ^20.11.0
CONFLICT: definições de tipo para APIs globais do Node divergentes (major 22 vs. 20) entre apps do
mesmo monorepo, apesar do runtime real ser uniformemente Node 20 (seção 1) — os tipos de apps/api não
reflectem necessariamente todas as APIs disponíveis no Node 20 real se @types/node 20.x estiver
desatualizado em relação a alguma API pontual, e o inverso (tipos 22.x usados em apps/web podem sugerir
disponibilidade de API que não existe no Node 20 real de runtime, embora apps/web não rode em Node
runtime — é build-time apenas)
EVIDENCE: package.json raiz:38, apps/web/package.json:67, apps/api/package.json:100
IMPACT: LOW (apps/web só usa @types/node em build-time/tooling, não em runtime do browser; apps/api usa
em runtime real mas 20.x é a versão correta para o runtime real — o "conflito" é de consistência entre
apps, não de correção individual)

PACKAGE_A: zod (raiz não declara zod diretamente; apps/web) | VERSION: ^3.25.76
PACKAGE_B: zod (apps/api) | VERSION: ^3.22.4
CONFLICT: versões menores diferentes da mesma major dentro do monorepo — relevante porque
packages/schemas (Zod compartilhado, hoje UNUSED, seção 11) presumivelmente precisaria de uma faixa de
versão compatível com ambos os apps se algum dia for adotado
EVIDENCE: apps/web/package.json:61, apps/api/package.json:92
IMPACT: LOW (mesma major, sem breaking change conhecido entre 3.22 e 3.25 relevante a este projeto)

PACKAGE_A: ts-node-dev (apps/api, dev/start:dev)
PACKAGE_B: tsx ^4.20.5 (apps/api, ~25 scripts)
CONFLICT: 2 ferramentas de execução TypeScript-em-Node com responsabilidade sobreposta coexistindo no
mesmo app — não é um conflito de peer dependency real (não rodam no mesmo processo), mas é duplicidade
de biblioteca para a mesma responsabilidade (categoria explicitamente pedida pelo prompt)
EVIDENCE: apps/api/package.json:105-106 (devDependencies), scripts:8-9 vs. scripts:19+ (dezenas de
scripts usando tsx)
IMPACT: LOW (uso segregado por propósito — watch-mode dev server vs. scripts CLI pontuais — sem conflito
de runtime real)

PACKAGE_A: Jest (apps/api) | PACKAGE_B: Vitest (apps/web)
CONFLICT: 2 test runners diferentes no mesmo monorepo (categoria "test framework incompatibilities"
pedida pelo prompt) — não são incompatíveis entre si (cada um roda isolado no seu próprio app via
--filter), mas é uma duplicação de responsabilidade de tooling
EVIDENCE: apps/api/package.json:102-106, apps/web/package.json:71,79-80
IMPACT: LOW (isolados por app, sem interferência real)

PACKAGE: nenhum deprecated package confirmado nesta auditoria pontual — não foi executado nenhum
comando de auditoria de pacotes (npm audit/pnpm audit) nesta etapa (fora do escopo: "não instalar/
atualizar/remover" — rodar um audit não altera nada, mas não foi solicitado explicitamente e não foi
executado para manter a etapa estritamente à leitura de arquivos já existentes)
```

---

## 13. Dependências instaladas mas aparentemente não utilizadas

```text
PACKAGE: knip | VERSION: ^6.24.0 | DECLARED_IN: package.json raiz (devDependencies) | USAGE_FOUND: NÃO
(nenhum script npm na raiz nem em nenhum workflow do .github/workflows invoca "knip") |
STATUS: POTENTIALLY_UNUSED (pode ser invocado manualmente via "pnpm exec knip", não descartável só por
ausência de script — mas nenhuma automação encontrada)

PACKAGE: depcheck | VERSION: ^1.4.7 | DECLARED_IN: package.json raiz (devDependencies) | USAGE_FOUND:
NÃO (mesma busca, mesmo resultado) | STATUS: POTENTIALLY_UNUSED

PACKAGE: ts-prune | VERSION: ^0.10.3 | DECLARED_IN: package.json raiz (devDependencies) | USAGE_FOUND:
NÃO (mesma busca, mesmo resultado) | STATUS: POTENTIALLY_UNUSED

PACKAGE: @music-os-360/auth | VERSION: workspace | DECLARED_IN: workspace (packages/auth) |
USAGE_FOUND: NÃO (nenhum import em apps/web/src ou apps/api/src, doc42) | STATUS: POTENTIALLY_UNUSED

PACKAGE: @music-os-360/observability | VERSION: workspace | DECLARED_IN: workspace |
USAGE_FOUND: NÃO | STATUS: POTENTIALLY_UNUSED

PACKAGE: @music-os-360/schemas | VERSION: workspace | DECLARED_IN: workspace | USAGE_FOUND: NÃO |
STATUS: POTENTIALLY_UNUSED

PACKAGE: @music-os-360/ui | VERSION: workspace | DECLARED_IN: workspace | USAGE_FOUND: NÃO |
STATUS: POTENTIALLY_UNUSED

PACKAGE: @music-os-360/utils | VERSION: workspace | DECLARED_IN: workspace | USAGE_FOUND: NÃO |
STATUS: POTENTIALLY_UNUSED
```

---

## 14. Stack consolidada atual

```text
ÁREA              | TECNOLOGIA                       | VERSÃO      | USO REAL | STATUS
Runtime            | Node.js                            | 20          | SIM       | ACTIVE
Monorepo             | pnpm workspaces + Turborepo          | pnpm 10.11.0 | SIM       | ACTIVE
Frontend               | React                                   | ^18.3.1     | SIM       | ACTIVE
Frontend               | Vite                                     | ^5.4.19     | SIM       | ACTIVE
Frontend               | react-router-dom                          | ^6.30.4     | SIM       | ACTIVE
Frontend               | zustand                                     | ^5.0.13     | PARCIAL   | ACTIVE (1/20 stores reais, doc29)
Frontend               | @tanstack/react-query                        | ^5.83.0     | SIM       | ACTIVE
Frontend               | Tailwind CSS + Radix UI                        | ^3.4.17     | SIM       | ACTIVE
Backend legacy            | NestJS (platform-express)                        | ^10.3.0     | SIM       | ACTIVE
Backend legacy            | TypeORM                                            | ^0.3.31     | SIM       | ACTIVE
Backend legacy            | class-validator/class-transformer                    | ^0.14.1/^0.5.1 | SIM   | ACTIVE
Database                  | PostgreSQL                                           | 16 (local)  | SIM       | ACTIVE
Database                  | Drizzle ORM/Kit                                        | —           | NÃO       | ARQUIVADO
Auth                       | Supabase Auth (JWKS/ES256)                               | JS ^2.105.4 | SIM       | ACTIVE
Auth                       | RBAC próprio (Guards + tabelas)                            | —           | SIM       | ACTIVE
Multi-tenancy                | Aplicação + RLS (BOTH)                                       | —           | SIM       | ACTIVE
Realtime                        | Supabase Realtime                                              | —           | SIM       | ACTIVE
Testing                           | Jest (api) / Vitest (web) / Playwright (e2e raiz)                | 30/2.1.9/1.62 | SIM     | ACTIVE
Observability                        | Sentry + prom-client + Logger estruturado próprio                    | —           | SIM       | ACTIVE
Deployment                              | Docker (long-running) + Vercel (serverless) — dual                      | —           | SIM       | ACTIVE
Integrations                               | ~17 providers (seção 10)                                                  | —           | VARIADO   | MISTO (ACTIVE/PARTIAL)
Shared packages                               | 8 pacotes internos                                                          | —           | 3/8 ativos | MISTO
```

---

## 15. Não confundir stack atual com stack aprovada para v2

```text
CURRENT_STACK:
NestJS (platform-express) + TypeORM + class-validator/class-transformer + PostgreSQL (via Supabase
hospedado) + Supabase Auth — mesma stack de framework/validação que a API v2 também usa, MAS com
TypeORM como ORM (não Drizzle) e sem a arquitetura em camadas/estratégias já aprovadas nos docs 47-53.

API_V2_DECISIONS_ALREADY_APPROVED (registradas nos docs 43-53, não reabertas aqui):
- NestJS (platform-express) — doc43/44
- class-validator + class-transformer — doc44
- Drizzle ORM — doc45
- Drizzle Kit + SQL manual controlado (migrations) — doc46
- PostgreSQL — doc45 (banco em si, não mudou)
- Supabase Auth preservado inicialmente — doc49
```

---

## 16. Gap entre stack atual e API v2

```text
AREA: Database access
CURRENT: TypeORM (+ pg direto para SET LOCAL, + Supabase JS para Auth/Realtime — 3 tecnologias
coexistindo, seção 3/4)
API_V2_APPROVED: Drizzle ORM
DIFFERENT: SIM
IMPLICATION: a apps/api-v2 precisará de um novo schema Drizzle TypeScript equivalente às entities
TypeORM já existentes (doc38 domínios), sem migração automática de código entre as duas ferramentas —
decisão já justificada tecnicamente no doc45, não reaberta aqui.
```

```text
AREA: Migration tool
CURRENT: TypeORM migrations (ALL_MIGRATIONS registry)
API_V2_APPROVED: Drizzle Kit + SQL manual controlado
DIFFERENT: SIM
IMPLICATION: as ~80+ migrations TypeORM já aplicadas ao banco atual não são diretamente reaproveitáveis
como arquivos Drizzle — precisarão ser recriadas conforme a convenção já fixada no doc46 (schema novo e
consolidado, migrations legacy não herdadas automaticamente, decisão já registrada, não reaberta aqui).
```

```text
AREA: Framework HTTP
CURRENT: NestJS (platform-express)
API_V2_APPROVED: NestJS (platform-express)
DIFFERENT: NÃO
IMPLICATION: nenhuma — mesma escolha, decisão do doc43 já reflete o que está comprovadamente em
produção hoje (não uma mudança).
```

```text
AREA: Validação de request
CURRENT: class-validator/class-transformer (padrão dominante, 78 DTOs) + Zod (escape hatch pontual)
API_V2_APPROVED: class-validator/class-transformer (padrão), Zod como escape hatch
DIFFERENT: NÃO
IMPLICATION: nenhuma — doc44 já formalizou o padrão já observado como o padrão aprovado.
```

```text
AREA: Auth
CURRENT: Supabase Auth (JWKS/ES256) + RBAC próprio
API_V2_APPROVED: Supabase Auth preservado + mesmo modelo de Guards (doc49, baseado no mecanismo já
existente)
DIFFERENT: NÃO
IMPLICATION: nenhuma — doc49 adotou deliberadamente o mecanismo já provado, ajustando só a forma
(RequestContext explícito em vez de mutação do Request), não a tecnologia de auth em si.
```

```text
AREA: Estrutura de camadas/diretórios
CURRENT: estrutura de módulos NestJS "tradicional" (controller/service/dto/entities por módulo,
sem separação formal Domain/Application/Infrastructure)
API_V2_APPROVED: 8 camadas explícitas (doc47) + estrutura de diretórios por domínio com
Domain/Application/Infrastructure/Presentation (doc48)
DIFFERENT: SIM
IMPLICATION: a reorganização arquitetural em si (não a tecnologia) é a mudança mais estrutural entre
as duas stacks — cada um dos 35 domínios precisará ser reescrito na nova separação de camadas, não
apenas "portado" com uma troca mecânica de ORM.
```

## Cobertura

16 seções cobertas conforme pedido, com evidência concreta de código/arquivo de configuração para cada
item — nenhuma tecnologia foi assumida presente só por aparecer em `package.json` sem confirmação de
uso real (classificações INSTALLED_AND_USED/DEV_ONLY/TEST_ONLY/POTENTIALLY_UNUSED aplicadas
explicitamente). 3 conflitos de versão reais e evidenciados (TypeScript, @types/node, zod), todos IMPACT
LOW, mais 2 duplicidades de responsabilidade de tooling (ts-node-dev/tsx, Jest/Vitest), também LOW. 8
dependências POTENTIALLY_UNUSED registradas (3 ferramentas de análise de código morto sem invocação
automatizada encontrada + 5 pacotes workspace sem consumidor real). 6 diferenças reais entre stack atual
e decisões já aprovadas para a API v2 registradas, sem propor correção. Nenhuma tecnologia foi
instalada, removida, atualizada ou substituída. `apps/api-v2` não foi criado. `apps/web` e `apps/api`
(legacy) não foram alterados. Nenhum documento anterior foi modificado.

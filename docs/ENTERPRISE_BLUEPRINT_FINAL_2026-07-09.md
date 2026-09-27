# MUSIC OS 360 - Blueprint Enterprise Definitivo

Data da analise: 2026-07-09  
Branch local: `dev`  
Documento canônico desta retomada: `docs/ENTERPRISE_BLUEPRINT_FINAL_2026-07-09.md`\
Escopo: monorepo completo visivel no workspace: `apps/`, `packages/`, `server/`, `scripts/`, `infra/`, `docs/`, `supabase/`, `public/`, `.github/`, arquivos raiz e relatorios gerados em `reports/`.

## 0. Regra De Leitura Deste Blueprint

Este documento registra apenas fatos comprovados no repositorio local. Quando uma area possui codigo, rota, entidade, migration, configuracao, relatorio ou teste verificavel, ela e marcada como `FATO ENCONTRADO`. Quando a evidencia existe mas nao comprova comportamento runtime completo, o status e `NÃO VALIDADO`. Quando o artefato solicitado nao aparece no repositorio analisado, o status e `NÃO ENCONTRADO`.

Cada dominio usa o formato:

- FATO ENCONTRADO: o que existe.
- EVIDÊNCIA: arquivos, pastas, modulo e sinal verificavel.
- RELACIONAMENTO: como o item se conecta a outras partes.
- IMPACTO: efeito arquitetural ou operacional.
- RISCO: lacuna, dependencia fragil ou ponto de producao.
- DEPENDÊNCIAS: bibliotecas, modulos internos, banco, fila, storage ou integracao.
- OBSERVAÇÕES: restricoes, flags, mocks, pendencias e status.

## 1. Estado Atual De Validacao

FATO ENCONTRADO

O estado atual foi validado apos a Fase 7 ter sido bloqueada por sandbox. A retomada executou typecheck, lint, test e build fora do sandbox.

EVIDÊNCIA

- `reports/phase7-resume-validation-2026-07-09.md`
- `package.json`
- Comandos executados em 2026-07-09:
  - `npm.cmd run typecheck`: PASS
  - `npm.cmd run lint`: PASS, 0 erros e 1184 warnings
  - `npm.cmd run test`: PASS, API 87 suites / 727 testes, Web 39 arquivos / 401 testes
  - `npm.cmd run build`: PASS, API build e web production build

RELACIONAMENTO

Os scripts raiz encadeiam API e Web via `corepack pnpm --filter @music-os-360/api` e `@music-os-360/web`.

IMPACTO

O repositorio esta em estado compilavel e testavel no ambiente local fora do sandbox. A Fase 7 deixa de estar bloqueada por erro tecnico de TypeScript e passa a estar aprovada para a validacao retomada.

RISCO

O lint ainda possui 1184 warnings. Isso nao bloqueia build, mas indica debito tecnico em `no-explicit-any`, `no-require-imports`, `react-hooks/exhaustive-deps`, `react-refresh/only-export-components` e `@ts-nocheck`.

DEPENDÊNCIAS

Node, npm, pnpm/corepack, TypeScript, ESLint, Jest, Vitest, Vite.

OBSERVAÇÕES

O sandbox bloqueou leitura de binarios em `node_modules/.pnpm` com `EPERM`; por isso os gates precisaram ser executados com permissao elevada.

## 2. Visao Geral Do Produto

FATO ENCONTRADO

O MUSIC OS 360 e um SaaS B2B multi-tenant para operacoes musicais. O codigo cobre gestao de artistas, catalogo, obras, fonogramas, contratos, financeiro, CRM/leads, marketing, releases, monitoramento, registry, storage/assets, IA/skills, suporte, RH, audiovisual, relatorios, billing, RBAC, auditoria e observabilidade.

EVIDÊNCIA

- `package.json`: `name = music-os-360-monorepo`, descricao "Enterprise Music Management SaaS".
- `docs/BLUEPRINT_ENTERPRISE.md`: descricao de produto e dominio.
- `apps/api/src/app.module.ts`: importa os modulos de dominio e infraestrutura.
- `apps/web/src/App.tsx`: compoe rotas por dominio.
- `apps/web/src/modules/*`
- `apps/api/src/modules/*`

RELACIONAMENTO

Frontend React/Vite chama a API NestJS por rotas protegidas. API persiste em PostgreSQL via TypeORM, usa Supabase Auth/JWT para identidade, aplica tenant/RBAC/billing por guards, usa Redis/BullMQ para filas e Cloudflare R2 para storage.

IMPACTO

O produto e modular por dominio, com fronteiras de app (`apps/web`, `apps/api`) e bibliotecas internas (`packages/*`) para contratos, auth, config, UI, schemas, tipos, utilitarios, skills e observabilidade.

RISCO

Parte do frontend ainda possui dados mockados, fallbacks local/in-memory e providers simulados. O Blueprint separa explicitamente essas areas para impedir que sejam tratadas como funcionalidades de producao.

DEPENDÊNCIAS

React, Vite, NestJS, TypeORM, PostgreSQL, Supabase, BullMQ, Redis, S3/R2, Stripe, Sentry, PostHog, OpenAI e provedores de IA declarados.

OBSERVAÇÕES

Mercado, modelo comercial e posicionamento de negocio existem como descricao arquitetural, mas pricing comercial final, contratos comerciais e politicas de go-to-market sao `NÃO VALIDADO` neste repositorio.

## 3. Estrutura Fisica Do Monorepo

FATO ENCONTRADO

O repositorio possui monorepo pnpm com workspaces `apps/*` e `packages/*`.

EVIDÊNCIA

- `pnpm-workspace.yaml`
- `package.json`
- Diretorios raiz: `.github/`, `apps/`, `packages/`, `server/`, `scripts/`, `infra/`, `docs/`, `supabase/`, `public/`, `reports/`.

RELACIONAMENTO

`apps/api` e `apps/web` sao apps executaveis. `packages/*` sao bibliotecas internas. `scripts/*` executa validacoes, backup, release e limpeza. `supabase/*` contem configuracao/migrations Supabase. `infra/*` contem observabilidade e operacao. `reports/*` contem evidencias de auditoria, validacao, limpeza e retomada.

IMPACTO

As equipes podem reconstruir a arquitetura fisica criando o monorepo com workspaces equivalentes e separando API, Web e packages compartilhados.

RISCO

`reports/` esta atualmente nao rastreado pelo Git no status local. Se estes relatorios virarem documentacao oficial, devem ser adicionados ao versionamento de forma intencional.

DEPENDÊNCIAS

pnpm workspace e scripts npm raiz.

OBSERVAÇÕES

`dist/` existe como build output. `node_modules/` e `.pnpm-store/` existem localmente e nao devem ser tratados como fonte do produto.

## 4. Apps E Packages

### 4.1 `apps/api`

FATO ENCONTRADO

API NestJS com modulo raiz, modulos de dominio, guards globais, interceptors, filas, storage, banco, migrations e testes.

EVIDÊNCIA

- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/modules/*`
- `apps/api/src/database/*`
- `apps/api/src/queues/*`
- `apps/api/src/storage/*`
- `apps/api/test/*`

RELACIONAMENTO

Recebe HTTP em `/api/v1`, expõe `/metrics` fora do prefixo, disponibiliza Swagger fora de producao, conecta a PostgreSQL via TypeORM, Supabase JWT via JWKS, Redis/BullMQ para filas e Cloudflare R2 para uploads.

IMPACTO

E o backend canonico para regras de negocio, persistencia, seguranca, billing, eventos, jobs e integracoes.

RISCO

Sem `DATABASE_URL` em producao a API falha; em dev pode operar em modo standalone para alguns componentes. Flags `AUTH_DISABLED`, `MOCK_MODE` e `USE_MOCK` sao proibidas em staging/producao pelo bootstrap.

DEPENDÊNCIAS

NestJS, TypeORM, pg, BullMQ, ioredis, Stripe, OpenAI, Sentry, helmet, compression, class-validator/class-transformer, zod em validadores.

OBSERVAÇÕES

O arquivo `apps/api/src/database/database.module.ts` declara TypeORM como executor canonico de migrations; snapshots legados Drizzle sao arquivados e nao devem ser executados.

### 4.2 `apps/web`

FATO ENCONTRADO

Frontend React 18 + Vite com rotas modulares, providers globais, TanStack Query, Supabase client, billing guard, tenant provider, realtime layer e design system baseado em Tailwind/Radix.

EVIDÊNCIA

- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/app/providers/*`
- `apps/web/src/app/routes/*`
- `apps/web/src/shared/ui/*`
- `apps/web/src/modules/*`

RELACIONAMENTO

Inicializa observabilidade, valida env frontend, monta `QueryClientProvider`, `AuthProvider`, `TenantProvider`, `BillingProvider`, `RealtimeLayer`, `BrowserRouter` e rotas publicas/protegidas/admin.

IMPACTO

E a camada de apresentacao e workflow de usuario. Toda rota protegida passa por `AuthGuard` e `BillingGuard`, exceto rotas publicas.

RISCO

`AUTH_DISABLED` e `MOCK_MODE` permitem bypass no frontend em desenvolvimento. Dados de varios modulos ainda dependem de `shared/data/mockData.ts`, providers mock ou fallback local.

DEPENDÊNCIAS

React, React Router, TanStack Query, Radix UI, Tailwind, lucide-react, sonner, socket.io-client, Sentry, PostHog.

OBSERVAÇÕES

`main.tsx` nao inicializa Sentry/PostHog em `MOCK_MODE`.

### 4.3 Packages Internos

FATO ENCONTRADO

Existem oito packages internos.

EVIDÊNCIA

- `packages/ai-skills`
- `packages/auth`
- `packages/config`
- `packages/observability`
- `packages/schemas`
- `packages/types`
- `packages/ui`
- `packages/utils`

RELACIONAMENTO

Packages compartilham tipos, schemas, auth helpers, UI, utilitarios, observabilidade e runtime/contratos de skills entre apps.

IMPACTO

Reduz duplicacao entre frontend/backend e define fronteiras reutilizaveis.

RISCO

Contratos API compartilhados ainda nao aparecem como package dedicado `packages/contracts`; ha contratos espalhados em `packages/types`, `packages/schemas`, `packages/ai-skills` e `apps/web/src/shared/integrations/contracts`.

DEPENDÊNCIAS

TypeScript, zod, React para UI, providers de observabilidade.

OBSERVAÇÕES

`packages/ai-skills/dist/*` existe como artefato compilado; fonte primaria e `packages/ai-skills/src/*`.

## 5. Arquitetura Geral

FATO ENCONTRADO

A arquitetura e uma aplicacao SaaS modular com frontend SPA, backend API, banco PostgreSQL, autenticação Supabase, storage R2, filas BullMQ/Redis, observabilidade Prometheus/Sentry/PostHog e billing Stripe.

EVIDÊNCIA

- `apps/web/src/App.tsx`
- `apps/api/src/main.ts`
- `apps/api/src/app.module.ts`
- `apps/api/src/database/database.module.ts`
- `apps/api/src/queues/queue.module.ts`
- `apps/api/src/storage/storage.service.ts`
- `apps/api/src/modules/billing/*`
- `infra/observability/*`
- `docker-compose*.yml`

RELACIONAMENTO

Browser -> React Router -> API client -> NestJS `/api/v1` -> Guards/Interceptors -> Services/Repositories -> PostgreSQL/R2/Redis/Stripe/IA.

IMPACTO

Permite isolamento por tenant e separacao de responsabilidades entre presentation, application, domain, infrastructure, persistence, messaging, observability e security.

RISCO

Alguns modulos frontend existem antes de seus endpoints backend canonicos ou usam fallback. Esses modulos precisam ficar bloqueados em producao ou receber backend/RLS antes de go-live.

DEPENDÊNCIAS

Supabase Auth/JWT, PostgreSQL, TypeORM, Redis, BullMQ, Cloudflare R2, Stripe, Sentry, PostHog, OpenAI.

OBSERVAÇÕES

O bootstrap da API usa Helmet, CORS, compression, body limit, rawBody para Stripe, ValidationPipe, GlobalExceptionFilter, LoggingInterceptor e TransformInterceptor.

## 6. Arquitetura Por Camadas

### Presentation

FATO ENCONTRADO

`apps/web/src/modules/*/pages`, `components`, `modals`, `forms` e `shared/ui` implementam UI.

EVIDÊNCIA

`apps/web/src/App.tsx`, `apps/web/src/shared/ui/*`, `apps/web/src/modules/*`.

RISCO

Parte dos dados vem de mocks locais. Ver secao 12.

### Application

FATO ENCONTRADO

No backend, controllers e services implementam casos de uso. No frontend, hooks e services modulam chamadas e estado.

EVIDÊNCIA

`apps/api/src/modules/*/*.controller.ts`, `*.service.ts`; `apps/web/src/modules/*/hooks`, `services`.

RISCO

Contratos frontend/backend nao estao centralizados em um unico package.

### Domain

FATO ENCONTRADO

Dominios aparecem como modulos API e modulos Web: artists, works, phonograms, contracts, transactions, leads, marketing, releases, support, audiovisual, registry, reports e outros.

EVIDÊNCIA

`apps/api/src/modules/*`, `apps/web/src/modules/*`.

RISCO

Alguns dominios possuem assimetria entre frontend e backend.

### Infrastructure

FATO ENCONTRADO

Banco, cache, storage, filas, metrics, auth, security e config ficam em `apps/api/src/core`, `database`, `queues`, `storage`, `cache`.

EVIDÊNCIA

`apps/api/src/core/*`, `apps/api/src/database/*`, `apps/api/src/queues/*`, `apps/api/src/storage/*`.

RISCO

Redis indisponivel em dev e silenciado para ruidos de rede; em producao deve ser validado por smoke/gates.

### Persistence

FATO ENCONTRADO

PostgreSQL via TypeORM DataSource, migrations TypeORM, entidades por dominio e `ALL_ENTITIES`.

EVIDÊNCIA

`apps/api/src/database/database.module.ts`, `apps/api/src/database/entities.ts`, `apps/api/src/database/migrations/*`, `apps/api/src/modules/*/entities/*`.

RISCO

Estado real do banco remoto/local em runtime e `NÃO VALIDADO` neste documento, pois nao foi executada consulta direta ao banco durante esta retomada.

### Messaging

FATO ENCONTRADO

BullMQ/Redis, processors e queue services.

EVIDÊNCIA

`apps/api/src/queues/queue.module.ts`, `apps/api/src/queues/processors/*`, `apps/api/src/queues/services/*`.

RISCO

Execucao real de workers com Redis externo e `NÃO VALIDADO` nesta retomada.

### Observability

FATO ENCONTRADO

Prometheus metrics, Sentry frontend/backend, PostHog frontend/backend service e runbooks.

EVIDÊNCIA

`apps/api/src/core/metrics/*`, `apps/api/src/instrument.ts`, `apps/web/src/main.tsx`, `packages/observability/*`, `docs/OBSERVABILITY_ARCHITECTURE.md`, `infra/observability/*`.

RISCO

Dashboards/alertas remotos e SLO runtime sao `NÃO VALIDADO`.

### Security

FATO ENCONTRADO

Guards globais, Helmet, CORS, JWT Supabase JWKS, tenant guard, RBAC guards, billing guard, RLS migrations e env validation.

EVIDÊNCIA

`apps/api/src/main.ts`, `apps/api/src/app.module.ts`, `apps/api/src/core/guards/*`, `apps/api/src/core/config/env.schema.ts`, `docs/AUTH_ARCHITECTURE.md`, `docs/RLS_AND_TENANT_ISOLATION_MATRIX.md`.

RISCO

Algumas superficies RLS ainda estavam marcadas como auditoria pendente em docs. Ver banco/multi-tenancy.

## 7. Frontend Completo

FATO ENCONTRADO

Rotas modulares carregadas por lazy import e protegidas por guardas de auth/billing/admin.

EVIDÊNCIA

- `apps/web/src/App.tsx`
- `apps/web/src/app/routes/public.routes.tsx`
- `artist.routes.tsx`, `catalog.routes.tsx`, `accounting.routes.tsx`, `releases.routes.tsx`, `crm.routes.tsx`, `marketing.routes.tsx`, `workspace.routes.tsx`, `settings.routes.tsx`, `operations.routes.tsx`, `admin.routes.tsx`, `contracts.routes.tsx`, `reports.routes.tsx`, `support.routes.tsx`, `audiovisual.routes.tsx`

RELACIONAMENTO

`Home` decide entre landing, onboarding e dashboard com base em usuario e tenant. Rotas protegidas usam `AuthGuard` e `BillingGuard`. Rotas admin usam `SuperAdminGuard`.

IMPACTO

A experiencia do usuario e segmentada por dominios e permite lazy loading para reduzir bundle inicial.

RISCO

`MOCK_MODE` e `AUTH_DISABLED` liberam rotas sem usuario em desenvolvimento. Em producao essas flags devem ser proibidas, e o backend tambem valida isso.

DEPENDÊNCIAS

React Router, TanStack Query, providers internos, env frontend.

OBSERVAÇÕES

Nao foi feita validacao visual via browser nesta retomada; renderizacao runtime e `NÃO VALIDADO` alem do build/test.

## 8. Backend Completo

FATO ENCONTRADO

O backend possui modulo raiz com infraestrutura e modulos de dominio. Guards globais aplicados: `RateLimitGuard`, `JwtAuthGuard`, `TenantGuard`, `BillingEnforcementGuard`, `RolesGuard`, `PermissionsGuard`. Interceptors globais: `RequestTenantContextInterceptor` e `AuditInterceptor`; interceptors adicionais em bootstrap: `LoggingInterceptor` e `TransformInterceptor`.

EVIDÊNCIA

- `apps/api/src/app.module.ts`
- `apps/api/src/main.ts`
- `apps/api/src/core/guards/*`
- `apps/api/src/core/interceptors/*`
- `apps/api/src/modules/*`

RELACIONAMENTO

Toda rota passa pelos guards globais, exceto comportamentos explicitamente publicos via decorators/metadata nos controllers.

IMPACTO

Centraliza auth, tenant, billing, roles e permissions em uma cadeia comum.

RISCO

Ordem documentada no comentario de `app.module.ts` menciona RateLimit -> Jwt -> Tenant -> Roles -> Permissions, mas o provider real inclui BillingEnforcement entre Tenant e Roles. Isto deve permanecer documentado para evitar divergencia operacional.

DEPENDÊNCIAS

NestJS DI, Reflector, decorators, DataSource, config env.

OBSERVAÇÕES

Swagger so e montado fora de producao.

### 8.1 Modulos API Encontrados

FATO ENCONTRADO

Modulos em `apps/api/src/modules`: `activity-logs`, `ai`, `analytics`, `artist-goals`, `artists`, `assets`, `audiovisual`, `audit-log`, `auth`, `billing`, `briefings`, `campaigns`, `clients`, `contact-attachments`, `contact-contracts`, `contact-timeline`, `contacts`, `content-detections`, `contract-templates`, `contracts`, `conversations`, `ecad-reports`, `events`, `financial-categories`, `financial-rules`, `forms`, `health`, `hr`, `integrations`, `inventory`, `invoices`, `lead-interactions`, `leads`, `licensing`, `marketing`, `notifications`, `phonograms`, `projects`, `rbac`, `registry`, `releases`, `reports`, `shares`, `support-tickets`, `takedowns`, `transactions`, `uploads`, `users`, `works`.

EVIDÊNCIA

`Get-ChildItem apps/api/src/modules -Directory`; imports em `apps/api/src/app.module.ts`.

RELACIONAMENTO

Esses modulos compoem os dominios do SaaS e sao conectados no `AppModule`.

IMPACTO

O dominio backend cobre operacao musical, plataforma SaaS, seguranca, billing, relatorios, IA e suporte.

RISCO

Nem todo modulo foi validado por smoke runtime individual nesta retomada. Status detalhado por dominio aparece na secao 18.

## 9. Banco De Dados E Migrations

FATO ENCONTRADO

Banco canonico: PostgreSQL via TypeORM. Migrations TypeORM sao fonte de verdade. Supabase possui migrations SQL complementares em `supabase/migrations`.

EVIDÊNCIA

- `apps/api/src/database/database.module.ts`
- `apps/api/src/database/entities.ts`
- `apps/api/src/database/migrations/*`
- `supabase/migrations/20260521071214_initial_schema.sql`
- `supabase/migrations/20260617233000_reconcile_custom_access_token_hook_tenant_selection.sql`

RELACIONAMENTO

TypeORM executa migrations em `musicos360_migrations`. Supabase Auth/JWT alimenta claims usados por API e RLS.

IMPACTO

A reconstrução do banco deve seguir migrations TypeORM listadas em `ALL_MIGRATIONS`, nao snapshots antigos.

RISCO

O estado real de um banco conectado e `NÃO VALIDADO` nesta retomada. A lista de migrations existe no codigo, mas nao foi executado `db:migrate` agora.

DEPENDÊNCIAS

PostgreSQL, TypeORM, Supabase Auth/JWT, pg.

OBSERVAÇÕES

`DatabaseModule` possui tres conexoes: `DATA_SOURCE`, `ADMIN_DATA_SOURCE`, `PROVISIONING_DATA_SOURCE`. Com `DATABASE_SESSION_CONTEXT_ENABLED=true` e `APP_DATABASE_URL`, o DataSource de app usa proxy tenant-aware para RLS por contexto de sessao.

### 9.1 Migrations TypeORM Encontradas

FATO ENCONTRADO

O diretorio `apps/api/src/database/migrations` contem 81 arquivos de migration, incluindo schema inicial, RLS, performance indexes, conversations/forms, CRM, inventory/licensing/financial rules, billing, registry, audiovisual, marketing, skills, workflow, RBAC enterprise, hardening e cleanup.

EVIDÊNCIA

`apps/api/src/database/migrations/*`; `ALL_MIGRATIONS` em `database.module.ts`.

RISCO

Como migrations antigas e recentes coexistem, a ordem em `ALL_MIGRATIONS` deve ser preservada.

### 9.2 RLS

FATO ENCONTRADO

RLS e tenant isolation sao tratados em migrations e docs. Ha baseline `RLSPolicies20260520000020`, hardening `ForceRLSFailClosed`, policies por assets/audiovisual/society/marketing/skills/workflow/musicchat/billing e docs de matriz.

EVIDÊNCIA

- `docs/RLS_AND_TENANT_ISOLATION_MATRIX.md`
- `apps/api/src/database/migrations/*Rls*`
- `apps/api/src/database/migrations/20260522000002_ForceRLSFailClosed.ts`
- `apps/api/src/database/migrations/20260620000005_ForceRLSOperationalTables.ts`
- `apps/api/src/database/migrations/20260701000003_BillingRlsHardening.ts`

RELACIONAMENTO

API aplica tenant no request e DB reforca isolamento com policies. Supabase JWT claims e contexto de sessao entram na camada de autorizacao.

IMPACTO

Tenant isolation possui defesa em profundidade: API + banco.

RISCO

`docs/RLS_AND_TENANT_ISOLATION_MATRIX.md` ainda lista alguns itens como auditoria requerida. Se migrations posteriores cobriram parte deles, a matriz precisa ser reconciliada com o banco real. Status: `NÃO VALIDADO` sem consulta DB.

## 10. Multi-tenancy

FATO ENCONTRADO

Multi-tenancy usa `TenantGuard`, `RequestTenantContextInterceptor`, `DatabaseContextService`, membership em org/tenant e RLS.

EVIDÊNCIA

- `apps/api/src/core/guards/tenant.guard.ts`
- `apps/api/src/core/interceptors/request-tenant-context.interceptor.ts`
- `apps/api/src/database/database-context.service.ts`
- `apps/api/src/database/tenant-als.ts`
- `docs/TENANT_AUTH_FLOW.md`
- `packages/auth/src/tenant.ts`

RELACIONAMENTO

Frontend envia contexto via auth/token/headers; backend resolve tenant/membership; DataSource tenant-aware pode aplicar contexto de sessao; RLS bloqueia linhas fora do tenant.

IMPACTO

Permite SaaS multi-tenant com isolamento por request, banco, storage e logs.

RISCO

O cliente nao deve ser fonte final de verdade para tenant. O proprio doc `RLS_AND_TENANT_ISOLATION_MATRIX.md` declara essa regra. Testes tenant isolation existem, mas smoke real com banco externo e `NÃO VALIDADO` nesta retomada.

DEPENDÊNCIAS

Supabase Auth claims, `org_members`, `tenants`, `organizations`, guards, DataSource.

OBSERVAÇÕES

Em producao, repositorio indica fail-closed para DB ausente, auth disabled e mock mode.

## 11. Seguranca

FATO ENCONTRADO

Seguranca cobre JWT Supabase JWKS, Helmet/CSP/HSTS, CORS restrito, rate limit guard, tenant guard, roles, permissions, billing guard, env validation, idempotency, encryption service, audit logs, RLS e secret hygiene.

EVIDÊNCIA

- `apps/api/src/main.ts`
- `apps/api/src/core/guards/*`
- `apps/api/src/core/security/*`
- `apps/api/src/core/interceptors/idempotency.interceptor.ts`
- `docs/AUTH_ARCHITECTURE.md`
- `docs/RBAC_ARCHITECTURE.md`
- `docs/RBAC_EXECUTION_FLOW.md`
- `reports/phase5-security-final-report.md`

RELACIONAMENTO

JWT autentica usuario; tenant guard autoriza workspace; roles/permissions autorizam acao; RLS protege banco; audit/interceptors registram atividade; env guards impedem modo inseguro em staging/producao.

IMPACTO

Modelo de seguranca e centralizado, com camadas API + DB + runtime config.

RISCO

Arquivos `.env` reais existem localmente e ignorados pelo Git. Se algum segredo foi compartilhado, deve ser rotacionado. O relatorio de Fase 5 marca aprovado com ressalvas.

DEPENDÊNCIAS

Supabase Auth, JWT/JWKS, Postgres RLS, Nest guards, GitHub Secrets, Docker env.

OBSERVAÇÕES

`user_metadata` nao deve ser usado para autorizacao; autorizacao deve ficar em app_metadata/DB. O doc local `AUTH_ARCHITECTURE.md` usa `app_metadata.org_id` e `app_metadata.role`.

## 12. Registro De Dados Mockados, Simulados, Seeds E Fallbacks

FATO ENCONTRADO

Ha dados mockados em runtime/dev, testes, providers de integracao simulados, seeds de banco e fallback heuristico de skills. Esses itens nao devem ser confundidos com dados reais de producao.

EVIDÊNCIA

Arquivos encontrados por nome:

- `apps/api/seed-operational.sql`
- `apps/api/seed.mjs`
- `apps/api/seed.ts`
- `apps/api/src/core/external-data/mock-distributor.provider.ts`
- `apps/api/src/core/external-data/mock-society.provider.ts`
- `apps/api/src/database/seeds/03_operational_seed.ts`
- `apps/api/src/database/seeds/04_rbac_seed.ts`
- `apps/api/src/database/seeds/05_org_structure_seed.ts`
- `apps/api/test/helpers/tenant-context.mock.ts`
- `apps/web/src/modules/accounting/data/financial-category-rules.seed.ts`
- `apps/web/src/modules/admin/data/mockAdmin.ts`
- `apps/web/src/modules/audiovisual/mock/audiovisual.mock.ts`
- `apps/web/src/modules/integrations/providers/mock/*`
- `apps/web/src/modules/monitoring/rights/services/mock-data.ts`
- `apps/web/src/modules/support/data/mockSupport.ts`
- `apps/web/src/shared/data/mockData.ts`
- `server/ai-proxy.ts`
- `scripts/check-production-source.mjs`
- `scripts/env-check.mjs`
- `reports/mock-dependencies.md`

RELACIONAMENTO

Mocks alimentam UI, dev mode, testes, providers simulados e proxy standalone. Scripts de env/release tentam impedir que mock fique ativo em producao.

IMPACTO

O produto pode demonstrar telas e fluxos sem backend completo em dev, mas deve bloquear fallback silencioso em producao.

RISCO

Alto se dados mockados forem confundidos com fonte real. Especialmente:

- `apps/web/src/shared/data/mockData.ts`: grande seed local compartilhado.
- `apps/web/src/modules/admin/data/mockAdmin.ts`: painel admin pode exibir dados simulados.
- `apps/web/src/modules/support/data/mockSupport.ts`: suporte/base de conhecimento pode exibir dados simulados.
- `apps/web/src/modules/audiovisual/mock/audiovisual.mock.ts`: audiovisual pode operar com mock.
- `apps/web/src/modules/integrations/providers/mock/*`: integrações podem simular autenticação, pagamentos, assinatura, direitos, chat, email, analytics e monitoring.
- `server/ai-proxy.ts`: ACRCloud retorna respostas simuladas em modo standalone.

DEPENDÊNCIAS

Flags `MOCK_MODE`, `VITE_MOCK_MODE`, `VITE_USE_MOCK`, `USE_MOCK`, `AUTH_DISABLED`; storage local/session; scripts `env:check` e `check-production-source`.

OBSERVAÇÕES

`scripts/env-check.mjs` valida alinhamento de mock/auth bypass e proibe incoerencias. `scripts/check-production-source.mjs` checa bundle de producao contra chunks mock e dependencia de marketing in-memory. `docs/API_FRONTEND_MATRIX.md` declara que tabelas pendentes podem usar fallback in-memory apenas fora de producao e devem falhar em producao.

### 12.1 Classificacao Dos Mocks

FATO ENCONTRADO

Mocks se dividem em cinco classes:

1. Seeds operacionais de banco: `apps/api/seed*`, `apps/api/src/database/seeds/*`.
2. Fixtures/test doubles: `apps/api/test/*`, `apps/web/src/test/*`.
3. Dados UI/dev: `mockData.ts`, `mockAdmin.ts`, `mockSupport.ts`, `audiovisual.mock.ts`, `mock-data.ts`.
4. Providers simulados: `apps/web/src/modules/integrations/providers/mock/*`, `apps/api/src/core/external-data/mock-*.provider.ts`.
5. Fallbacks defensivos: parsers de `packages/ai-skills/src/*/parser.ts`, storage pending tables, `server/ai-proxy.ts`.

RISCO

Classes 3 e 4 exigem rastreio prioritario antes de producao. Classes 1 e 2 sao aceitaveis se isoladas de producao. Classe 5 precisa documentar quando e porque entra em acao.

### 12.2 Regra Enterprise Para Mocks

FATO ENCONTRADO

Ha regra em docs e scripts para impedir mock em producao.

EVIDÊNCIA

- `docs/API_FRONTEND_MATRIX.md`
- `scripts/env-check.mjs`
- `scripts/check-production-source.mjs`
- `apps/api/src/main.ts`

RISCO

Ainda e necessario executar `npm run release:check` em ambiente com banco e env real antes de release.

## 13. Billing

FATO ENCONTRADO

Billing usa Stripe, modulo API dedicado, guard global de enforcement, services de planos/dunning, frontend billing provider e paginas de bloqueio/configuracao.

EVIDÊNCIA

- `apps/api/src/modules/billing/*`
- `apps/api/src/core/guards/billing-enforcement.guard.ts`
- `apps/api/src/core/billing/plan-limit.service.ts`
- `apps/api/src/database/migrations/20260701000001_BillingEnforcement.ts`
- `apps/api/src/database/migrations/20260701000002_BillingPlans.ts`
- `apps/api/src/database/migrations/20260701000003_BillingRlsHardening.ts`
- `apps/web/src/app/providers/BillingContext.tsx`
- `apps/web/src/shared/infrastructure/BillingNotice.tsx`
- `apps/web/src/modules/settings/pages/Billing.tsx`
- `apps/web/src/modules/settings/pages/BillingBlockedPage.tsx`
- `apps/web/src/modules/admin/services/admin-billing.service.ts`

RELACIONAMENTO

Stripe eventos e checkout/portal se conectam ao estado de tenant. Billing guard bloqueia uso de rotas quando tenant esta suspenso.

IMPACTO

Billing e parte da autorizacao runtime, nao apenas cobranca.

RISCO

Webhook real, sincronizacao de price IDs e dunning completo sao `NÃO VALIDADO` nesta retomada. O Blueprint antigo alertava "Stripe runtime = NO GO" ate rotacao/sync/webhook serem completados; esse status deve ser revalidado com ambiente real.

DEPENDÊNCIAS

Stripe, Postgres, env secrets, tenant billing state, invoices, payment events.

OBSERVAÇÕES

`rawBody` e preservado em `main.ts` para assinatura HMAC do Stripe.

## 14. Storage E Assets

FATO ENCONTRADO

Storage backend usa Cloudflare R2/S3-compatible com presigned upload. Uploads possuem modulo, DTO, entidade e handler de eventos. Assets possuem classificacao, linking e readiness de release.

EVIDÊNCIA

- `apps/api/src/storage/storage.service.ts`
- `apps/api/src/storage/storage.module.ts`
- `apps/api/src/modules/uploads/*`
- `apps/api/src/modules/assets/*`
- `apps/web/src/shared/hooks/useUploadToR2.ts`
- `apps/web/src/shared/components/FileUpload.tsx`

RELACIONAMENTO

Frontend solicita presigned upload; backend gera chave tenant-scoped; storage recebe arquivo; upload confirm/event handlers processam asset e jobs.

IMPACTO

Storage e central para contratos, assets musicais, marketing, audiovisual e reports.

RISCO

Antivirus, retention/lifecycle e verificacao runtime R2 externa sao `NÃO VALIDADO`.

DEPENDÊNCIAS

Cloudflare R2, S3 API, tenant id, upload module, assets module.

## 15. Integracoes

FATO ENCONTRADO

Repositorio contem integracoes reais/parciais e contratos/provider adapters no frontend, alem de modulo API `integrations`. Registro frontend lista plataformas musicais, marketing, signing, rights, payments, monitoring, storage, auth, chat e analytics.

EVIDÊNCIA

- `apps/api/src/modules/integrations/*`
- `apps/web/src/modules/integrations/*`
- `apps/web/src/shared/integrations/registry.ts`
- `apps/web/src/shared/integrations/contracts/*`
- `apps/web/src/modules/integrations/providers/mock/*`
- `apps/web/src/modules/integrations/hooks/useSpotify.ts`, `useYouTube.ts`, `useAbramus.ts`, `useACRCloud.ts`, `useStripe.ts`, etc.

RELACIONAMENTO

Integracoes aparecem como hooks/adapters/providers no frontend e como modulo API para integracoes backend. Alguns providers sao mock.

IMPACTO

Permite conectar streaming, rights, signing, marketing OAuth, payments, storage e observabilidade.

RISCO

Para cada integracao, autenticacao real, webhook real, retries e logs precisam ser confirmados individualmente. Muitos providers em `providers/mock` sao simulados. Status geral: parcial / `NÃO VALIDADO` por integracao runtime.

DEPENDÊNCIAS

Stripe, Autentique, Clicksign, DocuSign, Spotify, YouTube, Deezer, Apple Music, SoundCloud, ACRCloud, ECAD, ABRAMUS, UBC, Google Ads, Instagram, TikTok, Meta, Resend, Sentry, PostHog, R2.

OBSERVAÇÕES

O Blueprint nao considera provider mock como integracao real.

## 16. IA E Skills

FATO ENCONTRADO

IA existe no frontend, backend e package de skills. Backend possui `AIModule`, `ai.service`, `ai.controller`, processors de AI jobs e `SkillsModule`. Package `packages/ai-skills` contem contratos, prompts, parsers e validators por skill.

EVIDÊNCIA

- `apps/api/src/modules/ai/*`
- `apps/api/src/core/skills/*`
- `apps/api/src/queues/processors/ai-jobs.processor.ts`
- `apps/api/src/queues/services/ai-jobs-queue.service.ts`
- `packages/ai-skills/src/*`
- `apps/web/src/modules/ai/*`
- `server/ai-proxy.ts`

RELACIONAMENTO

Frontend aciona use cases/hooks de AI; backend executa completions/jobs; package de skills valida/parsa resultados; filas processam jobs; eventos/logs registram execucao.

IMPACTO

IA e infraestrutura operacional para analise de artista, checklist de release, planejamento de projeto, calendario de marketing, classificacao financeira, follow-up CRM, triagem de suporte, audiovisual briefing e outras skills encontradas.

RISCO

Custos, budgets, limites por tenant, observabilidade de uso e provedores reais em runtime sao `NÃO VALIDADO` nesta retomada. Parsers possuem fallback heuristico seguro; isso nao equivale a resposta real de modelo.

DEPENDÊNCIAS

OpenAI, Anthropic/Claude, Gemini, Perplexity no frontend providers, filas, skill_runs, env keys.

OBSERVAÇÕES

`server/ai-proxy.ts` usa `gpt-4o-mini` e API key fallback `"dummy"` se env ausente; isso deve ser tratado como dev/standalone, nao producao.

## 17. Observabilidade E DevOps

FATO ENCONTRADO

Observabilidade: metrics Prometheus, Sentry frontend/backend, PostHog, docs de SLO/runbooks. DevOps: Docker Compose, GitHub Actions, scripts de backup/restore/release/env/cleanup.

EVIDÊNCIA

- `apps/api/src/core/metrics/*`
- `apps/api/src/instrument.ts`
- `apps/web/src/main.tsx`
- `packages/observability/*`
- `docker-compose.yml`
- `docker-compose.observability.yml`
- `.github/workflows/*`
- `scripts/pg-backup.sh`, `pg-restore.sh`, `release-check.mjs`, `env-check.mjs`, `cleanup/*`
- `docs/SRE_RUNBOOK.md`, `docs/SLI_SLO_ERROR_BUDGETS.md`, `docs/RUNBOOK_INCIDENT.md`, `docs/RUNBOOK_ROLLBACK.md`

RELACIONAMENTO

API expõe `/metrics`, frontend/backend inicializam Sentry conforme env, PostHog captura analytics frontend quando chave existe, scripts operam release e backup.

IMPACTO

Ha base de SRE para metricas, incidentes, rollback e backup.

RISCO

Dashboards reais, alertas ativos, backup restaurado em ambiente real e deploy/rollback executado sao `NÃO VALIDADO`.

DEPENDÊNCIAS

Prometheus, Grafana, Sentry, PostHog, Docker, GitHub Actions, Postgres tools.

## 18. Mapa Completo Dos Dominios

| Dominio | FATO ENCONTRADO | EVIDÊNCIA | Dependencias | Status |
|---|---|---|---|---|
| Auth | Supabase Auth/JWT, AuthContext, AuthModule, onboarding/provisioning | `apps/web/src/app/providers/AuthContext.tsx`, `apps/api/src/modules/auth/*`, `docs/AUTH_ARCHITECTURE.md` | Supabase, tenants, users | Parcial validado por tests/build; MFA/sessoes `NÃO VALIDADO` |
| Multi-tenancy | TenantGuard, TenantProvider, RLS/session context | `TenantContext.tsx`, `tenant.guard.ts`, `tenant-als.ts` | Auth, DB, RLS | Parcial forte; DB real `NÃO VALIDADO` |
| RBAC | Roles/permissions guards, enterprise RBAC migrations | `apps/api/src/core/rbac/*`, `docs/RBAC_ARCHITECTURE.md`, migrations 20260610/20260614 | org_members, permissions | Encontrado; enforcement runtime por flag `NÃO VALIDADO` |
| Billing | Stripe module, enforcement guard, frontend billing | `apps/api/src/modules/billing/*`, `BillingContext.tsx` | Stripe, tenants, invoices | Parcial; webhook real `NÃO VALIDADO` |
| Admin SaaS | Admin pages/services | `apps/web/src/modules/admin/*` | billing, tenants, support | Parcial; dados mock em `mockAdmin.ts` |
| Artistas | CRUD/API/UI/platform sync | `artists` API/web, platform profiles | catalog, uploads, integrations | Encontrado |
| Catalogo | Works, phonograms, shares, registry | `works`, `phonograms`, `shares`, `catalog` | artists, rights | Encontrado |
| Contratos | Contracts/templates/signing UI | `contracts`, `contract-templates`, signing providers | clients, artists, integrations | Encontrado; providers mock existem |
| Financeiro | Transactions, invoices, categories/rules | `transactions`, `invoices`, `financial-*` | billing, clients | Encontrado |
| CRM/Leads | Leads, contacts, interactions, attachments/contracts/timeline | API modules + web `crm-relationships`, `leads` | artists, forms | Encontrado/parcial |
| Marketing | Projects, campaigns, contents, tasks, assets, strategy, publishing | `marketing` API/web, `campaigns` | AI, assets, queues | Encontrado; verificar in-memory/mock |
| Releases | Releases + release_works | `releases`, migration join table | catalog, workflow | Encontrado |
| Monitoring | content detections, ECAD reports, takedowns, rights monitoring UI | `content-detections`, `ecad-reports`, `takedowns`, `monitoring` | catalog, integrations | Parcial; mock rights data existe |
| Registry | rights holders, external identifiers, society submissions/sync | `apps/api/src/modules/registry/*` | ABRAMUS/ECAD | Encontrado; runtime externo `NÃO VALIDADO` |
| Storage/Assets | uploads, assets, R2 service | `storage`, `uploads`, `assets` | R2, tenant | Encontrado |
| AI/Skills | AI module, queues, skills package | `ai`, `core/skills`, `packages/ai-skills` | model providers | Parcial |
| Suporte | support tickets API, support UI/data | `support-tickets`, `support` | users, notifications | Parcial; `mockSupport.ts` |
| RH | HR API/web | `apps/api/src/modules/hr`, `apps/web/src/modules/rh` | tenant, finance | Encontrado |
| Audiovisual | Audiovisual API/web | `apps/api/src/modules/audiovisual`, `apps/web/src/modules/audiovisual` | projects, assets | Encontrado; `audiovisual.mock.ts` |
| Relatorios | Reports API/web, export/import services | `apps/api/src/modules/reports`, `apps/web/src/modules/reports` | DB, permissions | Encontrado |
| Observabilidade | Metrics, Sentry, PostHog, runbooks | `core/metrics`, `instrument`, `docs/*RUNBOOK*` | infra | Parcial |

## 19. Inventario De APIs, Rotas E Controllers

FATO ENCONTRADO

Controllers existem em praticamente todos os modulos API. Rotas ficam sob prefixo global `/api/v1`, exceto `/metrics` e `/admin/queues`.

EVIDÊNCIA

`apps/api/src/modules/**/*controller.ts`, `apps/api/src/main.ts`.

RELACIONAMENTO

Controllers chamam services, DTOs validam entrada, guards globais protegem chamadas.

IMPACTO

A reconstrução deve criar controllers por dominio, com prefixo global e excecoes iguais.

RISCO

Este Blueprint nao lista linha a linha todos os metodos de controller na versao inicial; para inventario literal automatizado, gerar tabela derivada dos decorators `@Controller`, `@Get`, `@Post`, `@Put`, `@Patch`, `@Delete`. Status de inventario fino: `NÃO VALIDADO` neste arquivo.

DEPENDÊNCIAS

NestJS decorators, Swagger decorators, DTOs.

## 20. Qualidade

FATO ENCONTRADO

Gates de qualidade existem e foram executados com sucesso na retomada.

EVIDÊNCIA

- `package.json`
- `reports/phase7-resume-validation-2026-07-09.md`
- `apps/api/jest.config.ts`
- `apps/web/vitest.config.mjs`
- `eslint.config.js`

RELACIONAMENTO

Build/typecheck/test rodam API e Web em sequencia. Lint cobre monorepo.

IMPACTO

O projeto tem linha base de qualidade automatizada.

RISCO

Cobertura (`test:coverage`) nao foi executada nesta retomada. E2E com banco real nao foi executado nesta retomada.

DEPENDÊNCIAS

Jest, Vitest, Testing Library, TypeScript, ESLint.

## 21. Relacoes Criticas

FATO ENCONTRADO

- Frontend -> Backend: `api-client`, services e hooks por dominio.
- Backend -> Banco: TypeORM DataSource, entities, repositories/services.
- Backend -> Workers: queue services e processors BullMQ.
- Workers -> Banco: processors usam services/DataSource conforme modulo.
- Banco -> Billing: migrations billing, invoices, tenant billing state.
- Billing -> Stripe: billing module/controller/services e webhook rawBody.
- Frontend -> Auth: Supabase SDK/AuthContext.
- Frontend -> Storage: hooks/components de upload chamam API de presign.
- Backend -> Storage: StorageService R2.
- Backend -> Integracoes: modules/integrations, registry, external data, billing, AI.
- Backend -> IA: AIModule, AI jobs, SkillsModule.

EVIDÊNCIA

Arquivos citados nas secoes 4 a 18.

RISCO

Algumas relacoes sao comprovadas por codigo, mas nao por execucao integrada em ambiente completo. Quando nao testado runtime, marcar `NÃO VALIDADO`.

## 22. Roadmap E Debito Tecnico

FATO ENCONTRADO

Debitos e riscos aparecem em docs e relatorios: mocks, warning lint, secrets locais, RLS audit pendente, integrações runtime nao validadas, billing Stripe NO GO anterior, pendencias API/frontend, release check dependente de DB.

EVIDÊNCIA

- `docs/API_FRONTEND_MATRIX.md`
- `reports/mock-dependencies.md`
- `reports/phase5-security-final-report.md`
- `reports/phase7-resume-validation-2026-07-09.md`
- `docs/RLS_AND_TENANT_ISOLATION_MATRIX.md`

Prioridades recomendadas com base no repositorio:

1. Versionar ou arquivar oficialmente os relatorios que viraram evidencia.
2. Transformar o inventario de mocks em gate CI com allowlist.
3. Executar `release:check` com banco real.
4. Reconciliar matriz RLS contra migrations e banco vivo.
5. Validar Stripe webhook/checkout/portal com chaves de teste.
6. Separar contratos frontend/backend em package dedicado ou gerar OpenAPI client.
7. Reduzir warnings lint por categoria.
8. Criar inventario automatizado de decorators/controllers/DTOs/tabelas/policies como apendice gerado.

## 23. Definition Of Done Enterprise

Checklist minimo antes de producao:

- Typecheck API/Web verde.
- Lint com 0 erros e warnings classificados.
- Testes unitarios API/Web verdes.
- Build API/Web verde.
- E2E com banco real verde.
- `release:check` verde com `DATABASE_URL`.
- `env:check` verde em staging/producao.
- `cleanup:check` verde.
- `MOCK_MODE`, `USE_MOCK`, `AUTH_DISABLED` proibidos e testados em staging/producao.
- Inventario de mocks atualizado e sem runtime mock em bundle de producao.
- Migrations aplicadas e auditadas.
- RLS e FORCE RLS verificados por tabela critica.
- Supabase JWT claims e tenant selection validados.
- Stripe checkout, portal e webhook validados com teste real.
- R2 upload/download/delete validados.
- Redis/BullMQ workers validados.
- Sentry/PostHog/Prometheus/Grafana validados.
- Backup e restore testados.
- Runbook de incidente e rollback exercitados.
- Secrets reais em secret manager, nenhum `.env` real rastreado.
- Logs sem segredos.
- Admin SaaS sem dados mockados em producao.
- Suporte, audiovisual, monitoring e integrations sem fallback silencioso em producao.

## 24. Itens NÃO ENCONTRADO / NÃO VALIDADO

NÃO VALIDADO

- Estado de banco real conectado.
- Execucao de migrations nesta retomada.
- Supabase Auth remoto, JWKS remoto e claims reais.
- Stripe webhook real, checkout real, portal real e sync de price IDs.
- R2 externo em runtime real.
- Redis/BullMQ externo em runtime real.
- Dashboards/alertas reais Prometheus/Grafana/Sentry/PostHog.
- Cobertura de testes.
- Browser visual/runtime com Playwright.
- Deploy, rollback, backup e restore em ambiente real.
- Todos os endpoints linha-a-linha com status HTTP em smoke integrado.
- Todas as policies RLS reconciliadas contra banco vivo.

NÃO ENCONTRADO

- Package dedicado `packages/contracts` para contratos API compartilhados.
- App separado `apps/worker`; workers vivem dentro da API.
- Prova de que todos os dados admin/suporte/audiovisual/monitoring em producao vem de backend real.
- Documento unico com inventario literal de todos os decorators/metodos/DTOs/tabelas por linha. Esta versao estabelece a estrutura canônica e evidencia; o apendice literal deve ser gerado automaticamente para evitar omissao manual.

## 25. Conclusao

FATO ENCONTRADO

O MUSIC OS 360 e um SaaS enterprise multi-tenant amplo, com base real de API, frontend, banco, migrations, RLS, RBAC, billing, storage, filas, IA, observabilidade e dominios de negocio musical. A validacao local retomada em 2026-07-09 esta verde para typecheck, lint, test e build.

RISCO CENTRAL

O maior risco documental e operacional e confundir dado mockado/fallback com funcionalidade real de producao. Este Blueprint rastreia explicitamente as superficies mockadas conhecidas e exige gate de producao contra elas.

PROXIMO PASSO OBRIGATORIO

Gerar apendices mecanicos para:

- todos os controllers e endpoints;
- todos os DTOs;
- todas as entities/tabelas;
- todas as migrations/policies/indexes;
- todos os components/hooks/stores/services frontend;
- todos os mocks/fallbacks com importadores;
- todos os scripts/pipelines.

Esses apendices devem ser anexados a este documento ou gerados como fonte auxiliar versionada, mantendo este Blueprint como documento tecnico oficial.

## 26. Apêndices Mecânicos Gerados Em 2026-07-09

FATO ENCONTRADO

Os inventários abaixo foram gerados mecanicamente a partir do workspace local para reduzir omissão manual. Eles complementam, no mesmo documento, as seções analíticas anteriores.

EVIDÊNCIA

- Script gerador: `scripts/generate-blueprint-appendices.mjs`
- Documento alvo: `docs/ENTERPRISE_BLUEPRINT_FINAL_2026-07-09.md`

### 26.1 API Modules

- `apps/api/src/modules/activity-logs`
- `apps/api/src/modules/ai`
- `apps/api/src/modules/analytics`
- `apps/api/src/modules/artist-goals`
- `apps/api/src/modules/artists`
- `apps/api/src/modules/assets`
- `apps/api/src/modules/audiovisual`
- `apps/api/src/modules/audit-log`
- `apps/api/src/modules/auth`
- `apps/api/src/modules/billing`
- `apps/api/src/modules/briefings`
- `apps/api/src/modules/campaigns`
- `apps/api/src/modules/clients`
- `apps/api/src/modules/contact-attachments`
- `apps/api/src/modules/contact-contracts`
- `apps/api/src/modules/contact-timeline`
- `apps/api/src/modules/contacts`
- `apps/api/src/modules/content-detections`
- `apps/api/src/modules/contract-templates`
- `apps/api/src/modules/contracts`
- `apps/api/src/modules/conversations`
- `apps/api/src/modules/ecad-reports`
- `apps/api/src/modules/events`
- `apps/api/src/modules/financial-categories`
- `apps/api/src/modules/financial-rules`
- `apps/api/src/modules/forms`
- `apps/api/src/modules/health`
- `apps/api/src/modules/hr`
- `apps/api/src/modules/integrations`
- `apps/api/src/modules/inventory`
- `apps/api/src/modules/invoices`
- `apps/api/src/modules/lead-interactions`
- `apps/api/src/modules/leads`
- `apps/api/src/modules/licensing`
- `apps/api/src/modules/marketing`
- `apps/api/src/modules/notifications`
- `apps/api/src/modules/phonograms`
- `apps/api/src/modules/projects`
- `apps/api/src/modules/rbac`
- `apps/api/src/modules/registry`
- `apps/api/src/modules/releases`
- `apps/api/src/modules/reports`
- `apps/api/src/modules/shares`
- `apps/api/src/modules/support-tickets`
- `apps/api/src/modules/takedowns`
- `apps/api/src/modules/transactions`
- `apps/api/src/modules/uploads`
- `apps/api/src/modules/users`
- `apps/api/src/modules/works`

### 26.2 Web Modules

- `apps/web/src/modules/accounting`
- `apps/web/src/modules/admin`
- `apps/web/src/modules/ai`
- `apps/web/src/modules/artist`
- `apps/web/src/modules/audiovisual`
- `apps/web/src/modules/auth`
- `apps/web/src/modules/catalog`
- `apps/web/src/modules/contracts`
- `apps/web/src/modules/crm-relationships`
- `apps/web/src/modules/dashboard`
- `apps/web/src/modules/events`
- `apps/web/src/modules/integrations`
- `apps/web/src/modules/inventory`
- `apps/web/src/modules/leads`
- `apps/web/src/modules/licensing`
- `apps/web/src/modules/marketing`
- `apps/web/src/modules/monitoring`
- `apps/web/src/modules/musicchat`
- `apps/web/src/modules/projects`
- `apps/web/src/modules/releases`
- `apps/web/src/modules/reports`
- `apps/web/src/modules/rh`
- `apps/web/src/modules/settings`
- `apps/web/src/modules/support`
- `apps/web/src/modules/workspace`

### 26.3 Packages

- `packages/ai-skills`
- `packages/auth`
- `packages/config`
- `packages/observability`
- `packages/schemas`
- `packages/types`
- `packages/ui`
- `packages/utils`

### 26.4 TypeORM Migrations

- `apps/api/src/database/migrations/20240101000000_InitialSchema.ts`
- `apps/api/src/database/migrations/20240601000001_WorkflowTransitions.ts`
- `apps/api/src/database/migrations/20240602000001_DomainEventLog.ts`
- `apps/api/src/database/migrations/20260516000001_AuditLogEnterpriseColumns.ts`
- `apps/api/src/database/migrations/20260520000002_ActivityLogs.ts`
- `apps/api/src/database/migrations/20260520000004_SupabaseAuthColumnNames.ts`
- `apps/api/src/database/migrations/20260520000020_RLSPolicies.ts`
- `apps/api/src/database/migrations/20260521000030_PerformanceIndexes.ts`
- `apps/api/src/database/migrations/20260521000040_ConversationsAndForms.ts`
- `apps/api/src/database/migrations/20260521000050_CrmPipelinesAnalytics.ts`
- `apps/api/src/database/migrations/20260521000060_InventoryLicensingFinancialRules.ts`
- `apps/api/src/database/migrations/20260522000001_FixRLSFallback.ts`
- `apps/api/src/database/migrations/20260522000002_ForceRLSFailClosed.ts`
- `apps/api/src/database/migrations/20260523000001_AddArtistIdToWorks.ts`
- `apps/api/src/database/migrations/20260526000002_FinancialCategoriesEnterprise.ts`
- `apps/api/src/database/migrations/20260526000003_FinancialCategoryRulesDynamic.ts`
- `apps/api/src/database/migrations/20260527000003_AudiovisualPhase1.ts`
- `apps/api/src/database/migrations/20260527000004_AudiovisualTasks.ts`
- `apps/api/src/database/migrations/20260527000005_AudiovisualAssets.ts`
- `apps/api/src/database/migrations/20260528000002_LeadsContactsOperationalRefactor.ts`
- `apps/api/src/database/migrations/20260529000001_MarketingProjects.ts`
- `apps/api/src/database/migrations/20260529000002_MarketingProjectAutomation.ts`
- `apps/api/src/database/migrations/20260529000003_MarketingStrategyStructure.ts`
- `apps/api/src/database/migrations/20260529000004_MarketingAssets.ts`
- `apps/api/src/database/migrations/20260601000001_RegistryFieldsPhase1.ts`
- `apps/api/src/database/migrations/20260601000002_RegistryRightsHoldersIdentifiers.ts`
- `apps/api/src/database/migrations/20260601000003_SocietyIntegration.ts`
- `apps/api/src/database/migrations/20260602000001_MarketingContentPublishing.ts`
- `apps/api/src/database/migrations/20260604000001_CustomerCareConversationExtensions.ts`
- `apps/api/src/database/migrations/20260605000001_AddGenreToPhonograms.ts`
- `apps/api/src/database/migrations/20260607000001_SkillsAndCentralAssets.ts`
- `apps/api/src/database/migrations/20260607000002_WorkflowExecutions.ts`
- `apps/api/src/database/migrations/20260609000001_MusicChatAutomation.ts`
- `apps/api/src/database/migrations/20260610000001_CreatePermissionsCatalog.ts`
- `apps/api/src/database/migrations/20260610000002_CreateRolesAndRolePermissions.ts`
- `apps/api/src/database/migrations/20260610000003_CreateOrgStructure.ts`
- `apps/api/src/database/migrations/20260610000004_AlterOrgMembersAddRbacColumns.ts`
- `apps/api/src/database/migrations/20260610000005_CreateMembershipJobFunctions.ts`
- `apps/api/src/database/migrations/20260610000006_BackfillOrgMembersRoleId.ts`
- `apps/api/src/database/migrations/20260610000007_EnableRlsOnRbacTables.ts`
- `apps/api/src/database/migrations/20260612000001_PortableRlsTenantContext.ts`
- `apps/api/src/database/migrations/20260612000002_FixAppJwtInsufficientPrivilege.ts`
- `apps/api/src/database/migrations/20260612000003_CreateArtistPlatformProfiles.ts`
- `apps/api/src/database/migrations/20260613000001_CreateReleaseWorksJoinTable.ts`
- `apps/api/src/database/migrations/20260613000002_AddMissingSafeColumns.ts`
- `apps/api/src/database/migrations/20260613000003_AddLeadsPipelineStage.ts`
- `apps/api/src/database/migrations/20260613000004_AddDomainForeignKeys.ts`
- `apps/api/src/database/migrations/20260613000005_AddHrEmployeeForeignKeys.ts`
- `apps/api/src/database/migrations/20260613000006_RlsPoliciesInventoryLicensesFinancial.ts`
- `apps/api/src/database/migrations/20260613000007_RlsPoliciesAssets.ts`
- `apps/api/src/database/migrations/20260613000008_RlsPoliciesAudiovisualSocietyMarketing.ts`
- `apps/api/src/database/migrations/20260613000009_RlsPolicyReleaseWorks.ts`
- `apps/api/src/database/migrations/20260613000010_RlsPoliciesMusicChatAutomation.ts`
- `apps/api/src/database/migrations/20260613000011_WorkflowExecutionTenantNotNull.ts`
- `apps/api/src/database/migrations/20260613000012_RlsPoliciesSkillRunsWorkflowExecutions.ts`
- `apps/api/src/database/migrations/20260613000013_RlsPoliciesSkillWorkflowLogs.ts`
- `apps/api/src/database/migrations/20260613000014_HarmonizeRawUuidPolicies.ts`
- `apps/api/src/database/migrations/20260613000015_HarmonizeRawTextPolicies.ts`
- `apps/api/src/database/migrations/20260613000016_NotificationSettings.ts`
- `apps/api/src/database/migrations/20260613000017_HardenRbacAclDefaults.ts`
- `apps/api/src/database/migrations/20260614000000_CreateUsersProjection.ts`
- `apps/api/src/database/migrations/20260614000001_CreatePermissionGroups.ts`
- `apps/api/src/database/migrations/20260614000002_ExtendPermissionsCatalog.ts`
- `apps/api/src/database/migrations/20260614000003_CreatePermissionAliases.ts`
- `apps/api/src/database/migrations/20260614000004_CreateRoleTemplates.ts`
- `apps/api/src/database/migrations/20260614000005_CreatePermissionDependenciesAndConflicts.ts`
- `apps/api/src/database/migrations/20260614000006_ExtendRolesForEnterpriseRbac.ts`
- `apps/api/src/database/migrations/20260614000007_CreateRoleInheritance.ts`
- `apps/api/src/database/migrations/20260614000008_CreateRbacDecisionLogs.ts`
- `apps/api/src/database/migrations/20260620000001_CreateTenantInvitations.ts`
- `apps/api/src/database/migrations/20260620000002_HardenContactsLeadUploadsRls.ts`
- `apps/api/src/database/migrations/20260620000003_HardenRoleInheritanceFunctions.ts`
- `apps/api/src/database/migrations/20260620000004_ReconcileOperationalSchema.ts`
- `apps/api/src/database/migrations/20260620000005_ForceRLSOperationalTables.ts`
- `apps/api/src/database/migrations/20260620000006_HardenSupabaseDataApiSurface.ts`
- `apps/api/src/database/migrations/20260621000001_CreateRbacErrorLogs.ts`
- `apps/api/src/database/migrations/20260630000001_PublicArtistRegistration.ts`
- `apps/api/src/database/migrations/20260701000001_BillingEnforcement.ts`
- `apps/api/src/database/migrations/20260701000002_BillingPlans.ts`
- `apps/api/src/database/migrations/20260701000003_BillingRlsHardening.ts`
- `apps/api/src/database/migrations/20260705000001_ReconcileInventoryLicensesColumns.ts`
- `apps/api/src/database/migrations/20260705000002_RemoveArtistBannerVideoFields.ts`
- `apps/api/src/database/migrations/20260705000003_RemoveDeadStructuresD1D8.ts`

### 26.5 Supabase Migrations

- `supabase/migrations/20260521071214_initial_schema.sql`
- `supabase/migrations/20260617233000_reconcile_custom_access_token_hook_tenant_selection.sql`

### 26.6 Mock/Seed/Fake/Stub/Sample/Demo Files

| arquivo | bytes |
| --- | --- |
| apps/api/seed-operational.sql | 4044 |
| apps/api/seed.mjs | 3705 |
| apps/api/seed.ts | 4255 |
| apps/api/src/core/external-data/mock-distributor.provider.ts | 4580 |
| apps/api/src/core/external-data/mock-society.provider.ts | 4892 |
| apps/api/src/database/seeds/03_operational_seed.ts | 5644 |
| apps/api/src/database/seeds/04_rbac_seed.ts | 14488 |
| apps/api/src/database/seeds/05_org_structure_seed.ts | 4682 |
| apps/api/test/helpers/tenant-context.mock.ts | 211 |
| apps/web/src/modules/accounting/data/financial-category-rules.seed.ts | 4158 |
| apps/web/src/modules/admin/data/mockAdmin.ts | 34455 |
| apps/web/src/modules/audiovisual/mock/audiovisual.mock.ts | 6660 |
| apps/web/src/modules/integrations/providers/mock/mock-analytics.provider.ts | 1555 |
| apps/web/src/modules/integrations/providers/mock/mock-auth.provider.ts | 1884 |
| apps/web/src/modules/integrations/providers/mock/mock-chat.provider.ts | 7349 |
| apps/web/src/modules/integrations/providers/mock/mock-clicksign.provider.ts | 3671 |
| apps/web/src/modules/integrations/providers/mock/mock-docusign.provider.ts | 3668 |
| apps/web/src/modules/integrations/providers/mock/mock-email.provider.ts | 1417 |
| apps/web/src/modules/integrations/providers/mock/mock-error-monitor.provider.ts | 2329 |
| apps/web/src/modules/integrations/providers/mock/mock-music-monitoring.provider.ts | 19081 |
| apps/web/src/modules/integrations/providers/mock/mock-payments.provider.ts | 3401 |
| apps/web/src/modules/integrations/providers/mock/mock-rights.provider.ts | 13288 |
| apps/web/src/modules/integrations/providers/mock/mock-signing.provider.ts | 3655 |
| apps/web/src/modules/monitoring/rights/services/mock-data.ts | 18435 |
| apps/web/src/modules/support/data/mockSupport.ts | 22724 |
| apps/web/src/shared/data/mockData.ts | 141455 |
| apps/web/src/shared/hooks/useEditQueryParam.ts | 892 |
| apps/web/src/test/mockData.anchor-date.test.ts | 1402 |
| apps/web/src/test/mockData.legacy-artist-media-fields.test.ts | 2863 |

### 26.7 API Controllers E Decorators HTTP

| arquivo | controller | metodos encontrados |
| --- | --- | --- |
| apps/api/src/modules/activity-logs/activity-logs.controller.ts | 'activity-logs' | Get (root) @L16; Post (root) @L23 |
| apps/api/src/modules/ai/ai.controller.ts | 'ai' | Post 'complete' @L34; Post 'generate' @L51; Post 'biography' @L71; Post 'campaign-copy' @L84; Post 'analyze-contract' @L96; Get 'cost-summary' @L109 |
| apps/api/src/modules/analytics/analytics.controller.ts | 'analytics' | Get 'dashboard' @L11; Get 'revenue' @L18; Get 'ai-usage' @L26 |
| apps/api/src/modules/artist-goals/artist-goals.controller.ts | 'artist-goals' | Get (root) @L20; Get ':id' @L39; Post (root) @L50; Patch ':id' @L62; Delete ':id' @L75 |
| apps/api/src/modules/artists/artists.controller.ts | 'artists' | Get (root) @L34; Get ':id/platform-profiles' @L46; Get ':id/platform-profiles/:platform' @L58; Post ':id/platform-profiles/:platform/sync' @L72; Get ':id' @L93; Post (root) @L104; Patch ':id' @L118; Delete ':id' @L132 |
| apps/api/src/modules/assets/assets.controller.ts | (root) | Get 'release-readiness' @L33; Get 'projects/:projectId/assets' @L48; Get 'tasks/:taskId/assets' @L58; Get 'assets/:id' @L68; Post 'assets/:id/classify' @L80; Get 'skill-runs' @L95; Get 'skill-runs/:id' @L110 |
| apps/api/src/modules/audiovisual/approvals/approvals.controller.ts | 'audiovisual' | Get 'approvals' @L19; Get 'approvals/:id' @L24; Post 'projects/:projectId/approvals' @L29; Post 'approvals/:id/decision' @L38 |
| apps/api/src/modules/audiovisual/assets/assets.controller.ts | 'audiovisual' | Get 'projects/:projectId/assets' @L16; Post 'projects/:projectId/assets' @L25; Patch 'assets/:id' @L34; Delete 'assets/:id' @L40 |
| apps/api/src/modules/audiovisual/briefings/briefings.controller.ts | 'audiovisual/projects/:projectId/briefing' | Get (root) @L17; Put (root) @L22 |
| apps/api/src/modules/audiovisual/deliverables/deliverables.controller.ts | 'audiovisual' | Get 'deliverables' @L19; Get 'deliverables/:id' @L24; Post 'projects/:projectId/deliverables' @L29; Post 'projects/:projectId/deliverables/seed-defaults' @L38; Patch 'deliverables/:id' @L49; Delete 'deliverables/:id' @L58 |
| apps/api/src/modules/audiovisual/production-days/production-days.controller.ts | 'audiovisual' | Get 'projects/:projectId/production-days' @L16; Post 'projects/:projectId/production-days' @L22; Patch 'production-days/:id' @L31; Delete 'production-days/:id' @L37 |
| apps/api/src/modules/audiovisual/projects/projects.controller.ts | 'audiovisual/projects' | Get (root) @L20; Get 'dashboard' @L25; Get ':id' @L30; Post (root) @L35; Patch ':id' @L41; Post ':id/transition' @L50; Delete ':id' @L59 |
| apps/api/src/modules/audiovisual/shots/shots.controller.ts | 'audiovisual' | Get 'projects/:projectId/shots' @L14; Post 'projects/:projectId/shots' @L20; Post 'projects/:projectId/shots/reorder' @L29; Patch 'shots/:id' @L38; Delete 'shots/:id' @L44 |
| apps/api/src/modules/audiovisual/tasks/tasks.controller.ts | 'audiovisual' | Get 'projects/:projectId/tasks' @L16; Post 'projects/:projectId/tasks' @L22; Patch 'tasks/:id' @L31; Delete 'tasks/:id' @L40 |
| apps/api/src/modules/audiovisual/team-members/team-members.controller.ts | 'audiovisual' | Get 'projects/:projectId/team' @L14; Post 'projects/:projectId/team' @L20; Patch 'team/:id' @L29; Delete 'team/:id' @L35 |
| apps/api/src/modules/audit-log/audit-log.controller.ts | 'audit-logs' | Get (root) @L24; Get ':id' @L34 |
| apps/api/src/modules/auth/auth.controller.ts | 'auth' | Get 'context' @L26; Patch 'provision-workspace' @L36; Patch 'onboarding' @L46 |
| apps/api/src/modules/auth/dev-auth.controller.ts | 'dev-auth' | Get 'token' @L38 |
| apps/api/src/modules/billing/billing.controller.ts | 'billing' | Get 'plans' @L44; Get 'plans/:id' @L51; Post 'plans' @L58; Patch 'plans/:id' @L66; Post 'plans/:id/sync-stripe' @L74; Post 'checkout' @L82; Post 'portal' @L99; Get 'subscription' @L110; Get 'usage' @L117; Get 'metrics/saas' @L124; Get 'admin/tenants' @L131; Patch 'admin/tenants/:tenantId' @L138; Get 'admin/subscriptions' @L149; Get 'admin/tenants/:tenantId/billing-state' @L156; Get 'admin/invoices' @L163; Post 'admin/tenants/:tenantId/suspend' @L170; Post 'admin/tenants/:tenantId/reactivate' @L180; Post 'admin/tenants/:tenantId/override' @L190; Post 'admin/tenants/:tenantId/override/remove' @L209; Post 'webhooks/stripe' @L224 |
| apps/api/src/modules/briefings/briefings.controller.ts | 'briefings' | Get (root) @L14; Get ':id' @L17; Post (root) @L20; Patch ':id' @L23; Delete ':id' @L26 |
| apps/api/src/modules/campaigns/campaign-operations.controller.ts | 'campaigns/:campaignId' | Get 'tasks' @L23; Get 'calendar' @L32; Post 'tasks' @L40; Patch 'tasks/:taskId' @L50; Delete 'tasks/:taskId' @L60; Get 'assets' @L71; Post 'assets' @L79; Delete 'assets/:assetId' @L89 |
| apps/api/src/modules/campaigns/campaigns.controller.ts | 'campaigns' | Get (root) @L15; Get ':id' @L20; Post (root) @L29; Patch ':id' @L38; Delete ':id' @L48 |
| apps/api/src/modules/clients/clients.controller.ts | 'clients' | Get (root) @L15; Get ':id' @L18; Post (root) @L21; Patch ':id' @L24; Delete ':id' @L27 |
| apps/api/src/modules/contact-attachments/contact-attachments.controller.ts | 'contacts/:contactId/attachments' | Get (root) @L11; Post (root) @L18 |
| apps/api/src/modules/contact-contracts/contact-contracts.controller.ts | 'contacts/:contactId/contracts' | Get (root) @L11; Post (root) @L18 |
| apps/api/src/modules/contact-timeline/contact-timeline.controller.ts | 'contacts/:contactId/timeline' | Get (root) @L11; Post (root) @L18 |
| apps/api/src/modules/contacts/contacts.controller.ts | 'contacts' | Get (root) @L11; Get ':id' @L18; Post (root) @L25; Patch ':id' @L32 |
| apps/api/src/modules/content-detections/content-detections.controller.ts | 'content-detections' | Get (root) @L18; Get ':id' @L36; Post (root) @L46; Patch ':id' @L56; Delete ':id' @L67 |
| apps/api/src/modules/contract-templates/contract-templates.controller.ts | 'contract-templates' | Get (root) @L19; Get ':id' @L27; Post (root) @L35; Patch ':id' @L44; Delete ':id' @L53 |
| apps/api/src/modules/contracts/contracts.controller.ts | 'contracts' | Get (root) @L26; Get ':id' @L34; Post (root) @L46; Patch ':id' @L61; Delete ':id' @L75 |
| apps/api/src/modules/conversations/conversations.controller.ts | 'conversations' | Get (root) @L34; Get ':id' @L44; Post (root) @L54; Patch ':id' @L66; Delete ':id' @L78; Patch ':id/assign' @L91; Patch ':id/transfer' @L103; Patch ':id/close' @L116; Patch ':id/reopen' @L129; Get ':id/messages' @L144; Post ':id/messages' @L157; Get ':id/notes' @L172; Post ':id/notes' @L182 |
| apps/api/src/modules/conversations/musicchat-automation.controller.ts | 'conversations/musicchat/automation' | Get 'settings' @L22; Patch 'settings' @L29; Post 'inbound' @L41; Post 'escalations/run' @L52; Post 'notifications' @L63; Get 'events' @L74 |
| apps/api/src/modules/ecad-reports/ecad-reports.controller.ts | 'ecad-reports' | Get (root) @L19; Get ':id' @L37; Post (root) @L47; Patch ':id' @L58; Delete ':id' @L69 |
| apps/api/src/modules/events/events.controller.ts | 'events' | Get (root) @L15; Get ':id' @L18; Post (root) @L21; Patch ':id' @L24; Delete ':id' @L27 |
| apps/api/src/modules/financial-categories/financial-categories.controller.ts | 'financial-categories' | Get (root) @L32; Get 'tree' @L40; Get 'search' @L48; Post 'suggest' @L56; Post 'rules' @L64; Get 'rules' @L73; Patch 'rules/:ruleId' @L81; Delete 'rules/:ruleId' @L90; Post 'rules/preview' @L99; Post 'rules/execute' @L107; Get ':id' @L116; Get ':id/descendants' @L124; Get ':id/ancestors' @L131; Post (root) @L138; Patch ':id' @L146; Patch ':id/move' @L154; Patch ':id/reorder' @L162; Patch ':id/archive' @L170; Patch ':id/restore' @L178; Post ':id/merge' @L186; Delete ':id' @L194 |
| apps/api/src/modules/financial-rules/financial-rules.controller.ts | 'financial-rules' | Get (root) @L16; Get ':id' @L21; Post (root) @L26; Patch ':id' @L31; Delete ':id' @L36 |
| apps/api/src/modules/forms/forms.controller.ts | 'forms' | Get (root) @L31; Get ':id' @L41; Post (root) @L51; Patch ':id' @L63; Delete ':id' @L75; Get ':id/submissions' @L86; Post ':id/submit' @L98 |
| apps/api/src/modules/health/health.controller.ts | 'health' | Get (root) @L36; Get 'live' @L47; Get 'integrations' @L57; Get 'ready' @L66 |
| apps/api/src/modules/hr/hr.controller.ts | 'hr' | Get 'employees' @L24; Get 'employees/:id' @L40; Post 'employees' @L50; Patch 'employees/:id' @L62; Delete 'employees/:id' @L75; Get 'payroll' @L88; Post 'payroll' @L106; Get 'leave-requests' @L119; Post 'leave-requests' @L137; Patch 'leave-requests/:id/approve' @L149 |
| apps/api/src/modules/integrations/autentique/autentique.controller.ts | 'integrations/autentique' | Post 'documents' @L14; Post 'signature-requests' @L30; Post 'webhook' @L46 |
| apps/api/src/modules/integrations/external-data.controller.ts | 'integrations/external-data' | Get 'providers' @L44; Post 'sync/request' @L51; Post 'distributor/submit' @L70; Post 'distributor/status-check' @L91; Post 'society/submit' @L111; Post 'society/status-check' @L132; Post 'webhooks/:providerId' @L152 |
| apps/api/src/modules/integrations/integrations.controller.ts | 'integrations' | Post 'oauth/init' @L64; Post 'oauth/exchange' @L90; Get 'status' @L226; Post 'acrcloud/recognize' @L247; Post 'autentique/configure' @L258; Post 'autentique/send' @L267; Post 'autentique/webhook' @L281; Get 'spotify/auth' @L291; Get 'spotify/callback' @L298; Post 'spotify/callback' @L312; Post 'spotify/sync-artist' @L321; Delete 'spotify/disconnect' @L330; Get 'youtube/status' @L341; Get 'youtube/channel/:id' @L348; Get 'youtube/video/:id' @L355; Get 'youtube/search' @L362; Get 'deezer/artist/:id' @L371; Get 'deezer/artist/:id/top' @L378; Get 'deezer/album/:id' @L385; Get 'deezer/search' @L392; Post 'soundcloud/configure' @L401; Get 'soundcloud/status' @L413; Delete 'soundcloud/disconnect' @L420; Get 'soundcloud/user' @L429; Get 'soundcloud/track/:id' @L436; Get 'soundcloud/search' @L443; Post 'apple-music/configure' @L452; Get 'apple-music/status' @L464; Delete 'apple-music/disconnect' @L471; Get 'apple-music/artist/:id' @L480; Get 'apple-music/search' @L491; Get 'instagram/auth' @L508; Post 'instagram/callback' @L515; Get 'instagram/status' @L524; Get 'instagram/metrics' @L531; Delete 'instagram/disconnect' @L538; Post 'tiktok/ads/configure' @L549; Get 'tiktok/ads/status' @L563; Delete 'tiktok/ads/disconnect' @L570; Get 'tiktok/ads/campaigns' @L579; Get 'tiktok/ads/insights' @L586; Get 'tiktok/auth' @L599; Post 'tiktok/callback' @L606; Post 'google-ads/configure' @L617; Get 'google-ads/auth' @L629; Post 'google-ads/callback' @L636; Get 'google-ads/status' @L645; Delete 'google-ads/disconnect' @L652; Get 'google-ads/campaigns' @L661; Post 'abramus/configure' @L670; Get 'abramus/status' @L682; Delete 'abramus/disconnect' @L689; Get 'abramus/search-artist' @L698; Get 'abramus/search-work' @L709; Post 'abramus/register-work' @L720; Get 'abramus/statements' @L728 |
| apps/api/src/modules/inventory/inventory.controller.ts | 'inventory' | Get (root) @L15; Get ':id' @L20; Post (root) @L25; Patch ':id' @L30; Delete ':id' @L35 |
| apps/api/src/modules/invoices/invoices.controller.ts | 'invoices' | Get (root) @L18; Get ':id' @L26; Post (root) @L34; Patch ':id' @L47; Delete ':id' @L61 |
| apps/api/src/modules/lead-interactions/lead-interactions.controller.ts | 'lead-interactions' | Get (root) @L15; Post (root) @L18; Delete ':id' @L21 |
| apps/api/src/modules/leads/leads.controller.ts | 'leads' | Get 'public/artist-applications/:slug/tenant' @L23; Post 'public/artist-applications/:slug' @L30; Get (root) @L39; Get ':id' @L44; Post (root) @L53; Patch ':id' @L62; Delete ':id' @L72 |
| apps/api/src/modules/leads/public-registration.controller.ts | 'public' | Get 'workspaces/:slug' @L12; Post 'artist-registration' @L19 |
| apps/api/src/modules/licensing/licensing.controller.ts | 'licenses' | Get (root) @L15; Get ':id' @L20; Post (root) @L25; Patch ':id' @L30; Delete ':id' @L35 |
| apps/api/src/modules/marketing/campaign-builder.controller.ts | 'marketing/campaign-builder' | Get 'config' @L10 |
| apps/api/src/modules/marketing/marketing-ai-suggestions.controller.ts | 'marketing/ai-suggestions' | Get (root) @L16; Post (root) @L23 |
| apps/api/src/modules/marketing/marketing-assets.controller.ts | 'marketing/assets' | Get (root) @L22; Get 'project/:projectId/library' @L29; Get ':id' @L40; Get ':id/versions' @L47; Get ':id/approvals' @L54; Post (root) @L61; Patch ':id' @L73; Post ':id/request-approval' @L86; Post 'approvals/:approvalId/decision' @L98; Delete ':id' @L111 |
| apps/api/src/modules/marketing/marketing-campaign-builder.controller.ts | 'marketing/campaigns' | Get (root) @L129; Get ':id' @L136; Post 'draft' @L143; Patch ':id' @L154; Post ':id/validate' @L173; Post ':id/blueprint' @L193; Post ':id/publish' @L214; Post ':id/pause' @L233; Post ':id/archive' @L251 |
| apps/api/src/modules/marketing/marketing-contents.controller.ts | 'marketing/contents' | Get (root) @L17; Get ':id' @L24; Post (root) @L31; Patch ':id' @L43; Delete ':id' @L56 |
| apps/api/src/modules/marketing/marketing-projects.controller.ts | 'marketing/projects' | Get (root) @L21; Get ':id' @L28; Post (root) @L38; Patch ':id' @L50; Delete ':id' @L63 |
| apps/api/src/modules/marketing/marketing-strategy.controller.ts | 'marketing/strategy' | Get 'project/:marketingProjectId' @L22; Post 'project/:marketingProjectId/complete' @L32; Post 'strategies' @L44; Post 'objectives' @L56; Post 'initiatives' @L68; Post 'actions' @L80 |
| apps/api/src/modules/marketing/marketing-tasks.controller.ts | 'marketing/tasks' | Get (root) @L22; Get ':id' @L30; Post (root) @L37; Patch ':id' @L49; Delete ':id' @L62 |
| apps/api/src/modules/notifications/notifications.controller.ts | 'notifications' | Get (root) @L25; Get 'unread-count' @L36; Post (root) @L47; Patch ':id/read' @L57; Patch 'read-all' @L68; Get 'settings' @L80; Patch 'settings' @L90 |
| apps/api/src/modules/phonograms/phonograms.controller.ts | 'phonograms' | Get (root) @L23; Get ':id' @L31; Post (root) @L39; Patch ':id' @L52; Delete ':id' @L66 |
| apps/api/src/modules/projects/projects.controller.ts | 'projects' | Get (root) @L16; Get ':id' @L21; Post (root) @L30; Patch ':id' @L39; Delete ':id' @L49 |
| apps/api/src/modules/registry/external-identifiers.controller.ts | 'registry' | Get 'entities/:entityType/:entityId/identifiers' @L15; Post 'entities/:entityType/:entityId/identifiers' @L25; Patch 'identifiers/:id' @L37; Delete 'identifiers/:id' @L47 |
| apps/api/src/modules/registry/registry-operations.controller.ts | 'registry' | Post 'works/:workId/validate' @L17; Post 'recordings/:recordingId/validate' @L22; Post 'works/:workId/prepare' @L28; Post 'recordings/:recordingId/prepare' @L38; Post 'works/:workId/submit' @L49; Post 'recordings/:recordingId/submit' @L59; Post 'submissions/:id/payload/regenerate' @L70; Get 'submissions/:id/export/json' @L76; Get 'submissions/:id/export/xlsx' @L84 (Parte 81 — XLSX removido da plataforma) |
| apps/api/src/modules/registry/rights-holders.controller.ts | 'registry/rights-holders' | Get (root) @L15; Get ':id' @L20; Post (root) @L25; Patch ':id' @L30; Delete ':id' @L40 |
| apps/api/src/modules/registry/society/society-accounts.controller.ts | 'registry/society-accounts' | Get (root) @L15; Post (root) @L20; Patch ':id' @L25; Delete ':id' @L35 |
| apps/api/src/modules/registry/society/society-submissions.controller.ts | 'registry/submissions' | Get (root) @L15; Get ':id' @L20; Get ':id/events' @L25; Get ':id/payload' @L30; Patch ':id/status' @L35 |
| apps/api/src/modules/registry/society/society-sync.controller.ts | 'registry' | Post 'sync/abramus' @L15; Get 'sync-jobs' @L20; Get 'sync-jobs/:id' @L25 |
| apps/api/src/modules/releases/releases.controller.ts | 'releases' | Get (root) @L15; Get ':id' @L20; Post (root) @L29; Patch ':id' @L38; Delete ':id' @L48 |
| apps/api/src/modules/reports/reports.controller.ts | 'reports' | Get 'entities' @L69; Get 'definitions' @L92; Get 'entities/:entity/export' @L103; Post 'entities/:entity/import/validate' @L122; Post 'entities/:entity/import/commit' @L137 |
| apps/api/src/modules/shares/shares.controller.ts | 'shares' | Get (root) @L15; Get ':id' @L18; Post (root) @L21; Patch ':id' @L24; Delete ':id' @L27 |
| apps/api/src/modules/support-tickets/support-tickets.controller.ts | 'support-tickets' | Get (root) @L15; Get ':id' @L20; Post (root) @L29; Patch ':id' @L38; Delete ':id' @L48 |
| apps/api/src/modules/takedowns/takedowns.controller.ts | 'takedowns' | Get (root) @L14; Get ':id' @L17; Post (root) @L20; Patch ':id' @L23; Delete ':id' @L26 |
| apps/api/src/modules/transactions/transactions.controller.ts | 'transactions' | Get (root) @L30; Get ':id' @L38; Post (root) @L49; Put ':id' @L64; Patch ':id' @L78; Delete ':id' @L92 |
| apps/api/src/modules/uploads/uploads.controller.ts | 'uploads' | Post 'presign' @L57; Post ':fileId/confirm' @L99; Get ':fileId/download' @L152 |
| apps/api/src/modules/users/rbac-admin.controller.ts | 'rbac' | Get 'roles' @L23; Get 'roles/:roleId' @L32; Get 'permissions' @L41; Get 'grants' @L47; Post 'roles' @L53; Patch 'roles/:roleId' @L63; Post 'roles/:roleId/duplicate' @L74; Post 'roles/:roleId/archive' @L85; Post 'roles/:roleId/restore' @L95; Post 'roles/:roleId/permissions/:permissionId' @L105; Delete 'roles/:roleId/permissions/:permissionId' @L122; Post 'roles/:roleId/inheritance' @L139; Delete 'roles/:roleId/inheritance/:parentRoleId' @L150 |
| apps/api/src/modules/users/users.controller.ts | 'users' | Get (root) @L14; Post (root) @L17; Post 'invitations' @L20; Get 'invitations' @L25; Post 'invitations/:id/resend' @L30; Delete 'invitations/:id' @L39; Get ':id' @L48; Patch ':id' @L53; Patch ':id/role' @L56; Delete ':id' @L64 |
| apps/api/src/modules/works/works.controller.ts | 'works' | Get (root) @L23; Get ':id' @L31; Post (root) @L39; Patch ':id' @L52; Delete ':id' @L66 |

### 26.8 API Entities

| arquivo | classe | @Entity |
| --- | --- | --- |
| apps/api/src/modules/ai/entities/ai.entity.ts | AiEntity | 'ai' |
| apps/api/src/modules/artist-goals/entities/artist_goal.entity.ts | Artist_goalEntity | 'artist-goals' |
| apps/api/src/modules/artists/entities/artist.entity.ts | ArtistEntity | 'artists' |
| apps/api/src/modules/audit-log/entities/audit_log.entity.ts | Audit_logEntity | 'audit-log' |
| apps/api/src/modules/auth/entities/auth.entity.ts | AuthEntity | 'auth' |
| apps/api/src/modules/billing/entities/billing.entity.ts | BillingEntity | 'billing' |
| apps/api/src/modules/briefings/entities/briefing.entity.ts | BriefingEntity | 'briefings' |
| apps/api/src/modules/campaigns/entities/campaign.entity.ts | CampaignEntity | 'campaigns' |
| apps/api/src/modules/clients/entities/client.entity.ts | ClientEntity | 'clients' |
| apps/api/src/modules/content-detections/entities/content_detection.entity.ts | Content_detectionEntity | 'content-detections' |
| apps/api/src/modules/contract-templates/entities/contract_template.entity.ts | Contract_templateEntity | 'contract-templates' |
| apps/api/src/modules/contracts/entities/contract.entity.ts | ContractEntity | 'contracts' |
| apps/api/src/modules/ecad-reports/entities/ecad_report.entity.ts | Ecad_reportEntity | 'ecad-reports' |
| apps/api/src/modules/events/entities/event.entity.ts | EventEntity | 'events' |
| apps/api/src/modules/health/entities/health.entity.ts | HealthEntity | 'health' |
| apps/api/src/modules/hr/entities/hr.entity.ts | HrEntity | 'hr' |
| apps/api/src/modules/integrations/entities/integration.entity.ts | IntegrationEntity | 'integrations' |
| apps/api/src/modules/invoices/entities/invoice.entity.ts | InvoiceEntity | 'invoices' |
| apps/api/src/modules/lead-interactions/entities/lead_interaction.entity.ts | Lead_interactionEntity | 'lead-interactions' |
| apps/api/src/modules/leads/entities/lead.entity.ts | LeadEntity | 'leads' |
| apps/api/src/modules/notifications/entities/notification.entity.ts | NotificationEntity | 'notifications' |
| apps/api/src/modules/phonograms/entities/phonogram.entity.ts | PhonogramEntity | 'phonograms' |
| apps/api/src/modules/projects/entities/project.entity.ts | ProjectEntity | 'projects' |
| apps/api/src/modules/releases/entities/release.entity.ts | ReleaseEntity | 'releases' |
| apps/api/src/modules/shares/entities/share.entity.ts | ShareEntity | 'shares' |
| apps/api/src/modules/support-tickets/entities/support_ticket.entity.ts | Support_ticketEntity | 'support-tickets' |
| apps/api/src/modules/takedowns/entities/takedown.entity.ts | TakedownEntity | 'takedowns' |
| apps/api/src/modules/transactions/entities/transaction.entity.ts | TransactionEntity | 'transactions' |
| apps/api/src/modules/uploads/entities/upload.entity.ts | UploadEntity | 'uploads' |
| apps/api/src/modules/users/entities/user.entity.ts | UserEntity | { schema: 'public', name: 'users' } |
| apps/api/src/modules/works/entities/work.entity.ts | WorkEntity | 'works' |

### 26.9 API DTO Files

- `apps/api/src/modules/activity-logs/dto/activity-log.dto.ts`
- `apps/api/src/modules/ai/dto/ai.dto.ts`
- `apps/api/src/modules/artist-goals/dto/create-artist-goal.dto.ts`
- `apps/api/src/modules/artist-goals/dto/update-artist-goal.dto.ts`
- `apps/api/src/modules/artists/dto/create-artist.dto.spec.ts`
- `apps/api/src/modules/artists/dto/create-artist.dto.ts`
- `apps/api/src/modules/artists/dto/query-artist.dto.ts`
- `apps/api/src/modules/artists/dto/update-artist.dto.ts`
- `apps/api/src/modules/audiovisual/dto/audiovisual.dto.ts`
- `apps/api/src/modules/audit-log/dto/audit-log.dto.ts`
- `apps/api/src/modules/auth/dto/complete-onboarding.dto.ts`
- `apps/api/src/modules/auth/dto/provision-workspace.dto.ts`
- `apps/api/src/modules/billing/dto/admin-billing.dto.ts`
- `apps/api/src/modules/billing/dto/billing-plans.dto.ts`
- `apps/api/src/modules/billing/dto/billing.dto.ts`
- `apps/api/src/modules/briefings/dto/briefings.dto.ts`
- `apps/api/src/modules/campaigns/dto/campaign-operations.dto.ts`
- `apps/api/src/modules/campaigns/dto/campaigns.dto.ts`
- `apps/api/src/modules/clients/dto/clients.dto.ts`
- `apps/api/src/modules/content-detections/dto/create-content-detection.dto.ts`
- `apps/api/src/modules/content-detections/dto/update-content-detection.dto.ts`
- `apps/api/src/modules/contract-templates/dto/create-contract-template.dto.ts`
- `apps/api/src/modules/contract-templates/dto/query-contract-template.dto.ts`
- `apps/api/src/modules/contract-templates/dto/update-contract-template.dto.ts`
- `apps/api/src/modules/contracts/dto/create-contract.dto.ts`
- `apps/api/src/modules/contracts/dto/query-contract.dto.ts`
- `apps/api/src/modules/contracts/dto/update-contract.dto.ts`
- `apps/api/src/modules/conversations/dto/conversations.dto.ts`
- `apps/api/src/modules/conversations/dto/musicchat-automation.dto.ts`
- `apps/api/src/modules/ecad-reports/dto/create-ecad-report.dto.ts`
- `apps/api/src/modules/ecad-reports/dto/update-ecad-report.dto.ts`
- `apps/api/src/modules/events/dto/events.dto.ts`
- `apps/api/src/modules/financial-categories/dto/financial-categories.dto.ts`
- `apps/api/src/modules/financial-rules/dto/financial-rules.dto.ts`
- `apps/api/src/modules/forms/dto/forms.dto.ts`
- `apps/api/src/modules/hr/dto/create-employee.dto.ts`
- `apps/api/src/modules/hr/dto/create-leave-request.dto.ts`
- `apps/api/src/modules/hr/dto/create-payroll-entry.dto.ts`
- `apps/api/src/modules/hr/dto/update-employee.dto.ts`
- `apps/api/src/modules/integrations/dto/integrations.dto.ts`
- `apps/api/src/modules/inventory/dto/inventory.dto.ts`
- `apps/api/src/modules/invoices/dto/invoices.dto.ts`
- `apps/api/src/modules/lead-interactions/dto/lead-interactions.dto.ts`
- `apps/api/src/modules/leads/dto/leads.dto.ts`
- `apps/api/src/modules/licensing/dto/licensing.dto.ts`
- `apps/api/src/modules/marketing/dto/marketing-assets.dto.ts`
- `apps/api/src/modules/marketing/dto/marketing-contents.dto.ts`
- `apps/api/src/modules/marketing/dto/marketing-projects.dto.ts`
- `apps/api/src/modules/marketing/dto/marketing-strategy.dto.ts`
- `apps/api/src/modules/marketing/dto/marketing-tasks.dto.ts`
- `apps/api/src/modules/notifications/dto/create-notification.dto.ts`
- `apps/api/src/modules/notifications/dto/update-notification-settings.dto.ts`
- `apps/api/src/modules/phonograms/dto/create-phonogram.dto.ts`
- `apps/api/src/modules/phonograms/dto/query-phonogram.dto.ts`
- `apps/api/src/modules/phonograms/dto/update-phonogram.dto.ts`
- `apps/api/src/modules/projects/dto/projects.dto.ts`
- `apps/api/src/modules/registry/dto/external-identifier.dto.ts`
- `apps/api/src/modules/registry/dto/operations.dto.ts`
- `apps/api/src/modules/registry/dto/rights-holder.dto.ts`
- `apps/api/src/modules/registry/dto/society.dto.ts`
- `apps/api/src/modules/releases/dto/releases.dto.ts`
- `apps/api/src/modules/shares/dto/shares.dto.ts`
- `apps/api/src/modules/support-tickets/dto/support-tickets.dto.ts`
- `apps/api/src/modules/takedowns/dto/takedowns.dto.ts`
- `apps/api/src/modules/transactions/dto/create-transaction.dto.ts`
- `apps/api/src/modules/transactions/dto/query-transaction.dto.ts`
- `apps/api/src/modules/transactions/dto/transaction-details.dto.ts`
- `apps/api/src/modules/transactions/dto/update-transaction.dto.ts`
- `apps/api/src/modules/uploads/dto/presign-upload.dto.ts`
- `apps/api/src/modules/users/dto/rbac-admin.dto.ts`
- `apps/api/src/modules/users/dto/users.dto.ts`
- `apps/api/src/modules/works/dto/create-work.dto.ts`
- `apps/api/src/modules/works/dto/query-work.dto.ts`
- `apps/api/src/modules/works/dto/update-work.dto.ts`

### 26.10 API Validator Files

- `apps/api/src/modules/ai/validators/ai.validators.ts`
- `apps/api/src/modules/ai/validators/index.ts`
- `apps/api/src/modules/artist-goals/validators/artist_goal.validators.ts`
- `apps/api/src/modules/artist-goals/validators/index.ts`
- `apps/api/src/modules/artists/validators/artist.validators.ts`
- `apps/api/src/modules/artists/validators/index.ts`
- `apps/api/src/modules/audit-log/validators/audit_log.validators.ts`
- `apps/api/src/modules/audit-log/validators/index.ts`
- `apps/api/src/modules/auth/validators/auth.validators.ts`
- `apps/api/src/modules/auth/validators/index.ts`
- `apps/api/src/modules/billing/validators/billing.validators.ts`
- `apps/api/src/modules/billing/validators/index.ts`
- `apps/api/src/modules/briefings/validators/briefing.validators.ts`
- `apps/api/src/modules/briefings/validators/index.ts`
- `apps/api/src/modules/campaigns/validators/campaign.validators.ts`
- `apps/api/src/modules/campaigns/validators/index.ts`
- `apps/api/src/modules/clients/validators/client.validators.ts`
- `apps/api/src/modules/clients/validators/index.ts`
- `apps/api/src/modules/content-detections/validators/content_detection.validators.ts`
- `apps/api/src/modules/content-detections/validators/index.ts`
- `apps/api/src/modules/contract-templates/validators/contract_template.validators.ts`
- `apps/api/src/modules/contract-templates/validators/index.ts`
- `apps/api/src/modules/contracts/validators/contract.validators.ts`
- `apps/api/src/modules/contracts/validators/index.ts`
- `apps/api/src/modules/ecad-reports/validators/ecad_report.validators.ts`
- `apps/api/src/modules/ecad-reports/validators/index.ts`
- `apps/api/src/modules/events/validators/event.validators.ts`
- `apps/api/src/modules/events/validators/index.ts`
- `apps/api/src/modules/health/validators/health.validators.ts`
- `apps/api/src/modules/health/validators/index.ts`
- `apps/api/src/modules/hr/validators/hr.validators.ts`
- `apps/api/src/modules/hr/validators/index.ts`
- `apps/api/src/modules/integrations/validators/index.ts`
- `apps/api/src/modules/integrations/validators/integration.validators.ts`
- `apps/api/src/modules/invoices/validators/index.ts`
- `apps/api/src/modules/invoices/validators/invoice.validators.ts`
- `apps/api/src/modules/lead-interactions/validators/index.ts`
- `apps/api/src/modules/lead-interactions/validators/lead_interaction.validators.ts`
- `apps/api/src/modules/leads/validators/index.ts`
- `apps/api/src/modules/leads/validators/lead.validators.ts`
- `apps/api/src/modules/notifications/validators/index.ts`
- `apps/api/src/modules/notifications/validators/notification.validators.ts`
- `apps/api/src/modules/phonograms/validators/index.ts`
- `apps/api/src/modules/phonograms/validators/phonogram.validators.ts`
- `apps/api/src/modules/projects/validators/index.ts`
- `apps/api/src/modules/projects/validators/project.validators.ts`
- `apps/api/src/modules/registry/validators/registry-validators.spec.ts`
- `apps/api/src/modules/registry/validators/registry-validators.ts`
- `apps/api/src/modules/releases/validators/index.ts`
- `apps/api/src/modules/releases/validators/release.validators.ts`
- `apps/api/src/modules/shares/validators/index.ts`
- `apps/api/src/modules/shares/validators/share.validators.ts`
- `apps/api/src/modules/support-tickets/validators/index.ts`
- `apps/api/src/modules/support-tickets/validators/support_ticket.validators.ts`
- `apps/api/src/modules/takedowns/validators/index.ts`
- `apps/api/src/modules/takedowns/validators/takedown.validators.ts`
- `apps/api/src/modules/transactions/validators/index.ts`
- `apps/api/src/modules/transactions/validators/transacao.validator.ts`
- `apps/api/src/modules/transactions/validators/transaction.validators.ts`
- `apps/api/src/modules/uploads/validators/index.ts`
- `apps/api/src/modules/uploads/validators/upload.validators.ts`
- `apps/api/src/modules/users/validators/index.ts`
- `apps/api/src/modules/users/validators/user.validators.ts`
- `apps/api/src/modules/works/validators/index.ts`
- `apps/api/src/modules/works/validators/work.validators.ts`

### 26.11 Web Route Files

- `apps/web/src/app/routes/accounting.routes.tsx`
- `apps/web/src/app/routes/admin.routes.tsx`
- `apps/web/src/app/routes/artist.routes.tsx`
- `apps/web/src/app/routes/audiovisual.routes.tsx`
- `apps/web/src/app/routes/catalog.routes.tsx`
- `apps/web/src/app/routes/contracts.routes.tsx`
- `apps/web/src/app/routes/crm.routes.tsx`
- `apps/web/src/app/routes/marketing.routes.tsx`
- `apps/web/src/app/routes/operations.routes.tsx`
- `apps/web/src/app/routes/public.routes.tsx`
- `apps/web/src/app/routes/releases.routes.tsx`
- `apps/web/src/app/routes/reports.routes.tsx`
- `apps/web/src/app/routes/settings.routes.tsx`
- `apps/web/src/app/routes/support.routes.tsx`
- `apps/web/src/app/routes/types.ts`
- `apps/web/src/app/routes/workspace.routes.tsx`

### 26.12 Web Store Files

- `apps/web/src/modules/accounting/hooks/accounting.store.ts`
- `apps/web/src/modules/accounting/store/accounting.store.ts`
- `apps/web/src/modules/accounting/store/index.ts`
- `apps/web/src/modules/artist/hooks/artist.store.ts`
- `apps/web/src/modules/artist/store/artist.store.ts`
- `apps/web/src/modules/artist/store/index.ts`
- `apps/web/src/modules/catalog/hooks/catalog.store.ts`
- `apps/web/src/modules/catalog/store/catalog.store.ts`
- `apps/web/src/modules/catalog/store/index.ts`
- `apps/web/src/modules/contracts/hooks/contracts.store.ts`
- `apps/web/src/modules/contracts/store/contracts.store.ts`
- `apps/web/src/modules/contracts/store/index.ts`
- `apps/web/src/modules/crm-relationships/store/contact-agenda.store.ts`
- `apps/web/src/modules/crm-relationships/store/contact-attachments.store.ts`
- `apps/web/src/modules/crm-relationships/store/contact-contracts.store.ts`
- `apps/web/src/modules/crm-relationships/store/contact-filters.store.ts`
- `apps/web/src/modules/crm-relationships/store/contact-panel.store.ts`
- `apps/web/src/modules/crm-relationships/store/contact-tags.store.ts`
- `apps/web/src/modules/crm-relationships/store/contact-timeline.store.ts`
- `apps/web/src/modules/crm-relationships/store/index.ts`
- `apps/web/src/modules/events/hooks/events.store.ts`
- `apps/web/src/modules/events/store/events.store.ts`
- `apps/web/src/modules/events/store/index.ts`
- `apps/web/src/modules/inventory/hooks/inventory.store.ts`
- `apps/web/src/modules/inventory/store/index.ts`
- `apps/web/src/modules/inventory/store/inventory.store.ts`
- `apps/web/src/modules/leads/store/index.ts`
- `apps/web/src/modules/leads/store/lead-filters.store.ts`
- `apps/web/src/modules/leads/store/lead-interactions.store.ts`
- `apps/web/src/modules/leads/store/lead-modal.store.ts`
- `apps/web/src/modules/leads/store/lead-uploads.store.ts`
- `apps/web/src/modules/licensing/hooks/licensing.store.ts`
- `apps/web/src/modules/licensing/store/index.ts`
- `apps/web/src/modules/licensing/store/licensing.store.ts`
- `apps/web/src/modules/monitoring/hooks/monitoring.store.ts`
- `apps/web/src/modules/monitoring/store/index.ts`
- `apps/web/src/modules/monitoring/store/monitoring.store.ts`
- `apps/web/src/modules/projects/hooks/projects.store.ts`
- `apps/web/src/modules/projects/store/index.ts`
- `apps/web/src/modules/projects/store/projects.store.ts`
- `apps/web/src/modules/releases/hooks/releases.store.ts`
- `apps/web/src/modules/releases/store/index.ts`
- `apps/web/src/modules/releases/store/releases.store.ts`
- `apps/web/src/modules/rh/hooks/rh.store.ts`
- `apps/web/src/modules/rh/store/index.ts`
- `apps/web/src/modules/rh/store/rh.store.ts`
- `apps/web/src/modules/settings/hooks/settings.store.ts`
- `apps/web/src/modules/settings/store/index.ts`
- `apps/web/src/modules/settings/store/settings.store.ts`

### 26.13 Web Hook Files

- `apps/web/src/modules/accounting/components/nota-fiscal-form/hooks/useNfRules.ts`
- `apps/web/src/modules/accounting/components/nota-fiscal-form/hooks/useNotaFiscalForm.ts`
- `apps/web/src/modules/accounting/components/transacao-form/hooks/useFinancialRules.ts`
- `apps/web/src/modules/accounting/components/transacao-form/hooks/useFinancialValidation.ts`
- `apps/web/src/modules/accounting/components/transacao-form/hooks/useRuleOverrides.ts`
- `apps/web/src/modules/accounting/components/transacao-form/hooks/useTransacaoForm.ts`
- `apps/web/src/modules/accounting/components/transacao-form/hooks/useTransacaoFormController.ts`
- `apps/web/src/modules/accounting/hooks/accounting.store.ts`
- `apps/web/src/modules/accounting/hooks/useFinancialCategoryRulesStore.ts`
- `apps/web/src/modules/accounting/hooks/useNotasFiscais.ts`
- `apps/web/src/modules/accounting/hooks/useTransacoes.ts`
- `apps/web/src/modules/admin/hooks/index.ts`
- `apps/web/src/modules/ai/hooks/index.ts`
- `apps/web/src/modules/ai/hooks/useAI.ts`
- `apps/web/src/modules/ai/hooks/useAIAnalytics.ts`
- `apps/web/src/modules/ai/hooks/useAIJob.ts`
- `apps/web/src/modules/ai/hooks/useSkill.ts`
- `apps/web/src/modules/artist/hooks/artist.store.ts`
- `apps/web/src/modules/artist/hooks/useArtistPlatformProfiles.ts`
- `apps/web/src/modules/artist/hooks/useArtistas.ts`
- `apps/web/src/modules/artist/hooks/useArtistasAssinados.ts`
- `apps/web/src/modules/audiovisual/hooks/useAudiovisual.ts`
- `apps/web/src/modules/catalog/hooks/catalog.store.ts`
- `apps/web/src/modules/catalog/hooks/useFonogramas.ts`
- `apps/web/src/modules/catalog/hooks/useObras.ts`
- `apps/web/src/modules/contracts/hooks/contracts.store.ts`
- `apps/web/src/modules/contracts/hooks/useCategoryRegistry.ts`
- `apps/web/src/modules/contracts/hooks/useContractServiceTypes.ts`
- `apps/web/src/modules/contracts/hooks/useContratos.ts`
- `apps/web/src/modules/contracts/hooks/useDocuments.ts`
- `apps/web/src/modules/contracts/hooks/useTemplatesContratos.ts`
- `apps/web/src/modules/contracts/hooks/useVariableRegistry.ts`
- `apps/web/src/modules/crm-relationships/hooks/index.ts`
- `apps/web/src/modules/crm-relationships/hooks/useContacts.ts`
- `apps/web/src/modules/dashboard/hooks/useActivityHistory.ts`
- `apps/web/src/modules/dashboard/hooks/useMetrics.ts`
- `apps/web/src/modules/dashboard/hooks/useOperationalDashboard.ts`
- `apps/web/src/modules/events/hooks/events.store.ts`
- `apps/web/src/modules/events/hooks/useAgendaParticipants.ts`
- `apps/web/src/modules/events/hooks/useEventos.ts`
- `apps/web/src/modules/integrations/hooks/index.ts`
- `apps/web/src/modules/integrations/hooks/useACRCloud.ts`
- `apps/web/src/modules/integrations/hooks/useAbramus.ts`
- `apps/web/src/modules/integrations/hooks/useAppleMusic.ts`
- `apps/web/src/modules/integrations/hooks/useAutentique.ts`
- `apps/web/src/modules/integrations/hooks/useChat.ts`
- `apps/web/src/modules/integrations/hooks/useClicksign.ts`
- `apps/web/src/modules/integrations/hooks/useDeezer.ts`
- `apps/web/src/modules/integrations/hooks/useEcad.ts`
- `apps/web/src/modules/integrations/hooks/useGoogleAds.ts`
- `apps/web/src/modules/integrations/hooks/useInstagram.ts`
- `apps/web/src/modules/integrations/hooks/useMarketingOAuth.ts`
- `apps/web/src/modules/integrations/hooks/useNfe.ts`
- `apps/web/src/modules/integrations/hooks/usePostHog.ts`
- `apps/web/src/modules/integrations/hooks/useR2.ts`
- `apps/web/src/modules/integrations/hooks/useResend.ts`
- `apps/web/src/modules/integrations/hooks/useSentry.ts`
- `apps/web/src/modules/integrations/hooks/useSigningProviders.ts`
- `apps/web/src/modules/integrations/hooks/useSoundCloud.ts`
- `apps/web/src/modules/integrations/hooks/useSpotify.ts`
- `apps/web/src/modules/integrations/hooks/useStripe.ts`
- `apps/web/src/modules/integrations/hooks/useTikTok.ts`
- `apps/web/src/modules/integrations/hooks/useTikTokAds.ts`
- `apps/web/src/modules/integrations/hooks/useUbc.ts`
- `apps/web/src/modules/integrations/hooks/useYouTube.ts`
- `apps/web/src/modules/inventory/hooks/inventory.store.ts`
- `apps/web/src/modules/inventory/hooks/useInventario.ts`
- `apps/web/src/modules/leads/hooks/index.ts`
- `apps/web/src/modules/licensing/hooks/licensing.store.ts`
- `apps/web/src/modules/licensing/hooks/useLicencas.ts`
- `apps/web/src/modules/marketing/hooks/useCentralAnaliticaMarketing.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingAI.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingAnalytics.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingAssets.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingAutomations.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingBriefings.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingCampaigns.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingContents.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingDashboard.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingDeliverables.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingProjects.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingResource.ts`
- `apps/web/src/modules/marketing/hooks/useMarketingTasks.ts`
- `apps/web/src/modules/marketing/hooks/useMetas.ts`
- `apps/web/src/modules/monitoring/hooks/monitoring.store.ts`
- `apps/web/src/modules/monitoring/hooks/useDeteccoes.ts`
- `apps/web/src/modules/monitoring/hooks/useTakedowns.ts`
- `apps/web/src/modules/musicchat/hooks/useMusicChatAutomationSettings.ts`
- `apps/web/src/modules/musicchat/hooks/useMusicChatTriageRules.ts`
- `apps/web/src/modules/projects/hooks/projects.store.ts`
- `apps/web/src/modules/projects/hooks/useProjetos.ts`
- `apps/web/src/modules/releases/hooks/releases.store.ts`
- `apps/web/src/modules/releases/hooks/useDistributionPlatforms.ts`
- `apps/web/src/modules/releases/hooks/useLancamentos.ts`
- `apps/web/src/modules/releases/hooks/useShares.ts`
- `apps/web/src/modules/reports/hooks/index.ts`
- `apps/web/src/modules/reports/hooks/useReports.ts`
- `apps/web/src/modules/rh/hooks/rh.store.ts`
- `apps/web/src/modules/rh/hooks/useDocumentosFuncionario.ts`
- `apps/web/src/modules/rh/hooks/useFeriasAusencias.ts`
- `apps/web/src/modules/rh/hooks/useFolhaPagamento.ts`
- `apps/web/src/modules/rh/hooks/useFuncionarios.ts`
- `apps/web/src/modules/settings/hooks/settings.store.ts`
- `apps/web/src/modules/settings/hooks/useAuditTrail.ts`
- `apps/web/src/modules/settings/hooks/useCompanySettings.ts`
- `apps/web/src/modules/settings/hooks/useOperationalSettings.ts`
- `apps/web/src/modules/settings/hooks/useRoles.ts`
- `apps/web/src/modules/settings/hooks/useUserSettings.ts`
- `apps/web/src/modules/settings/hooks/useUsuarios.ts`
- `apps/web/src/modules/support/hooks/useSupport.ts`
- `apps/web/src/modules/workspace/hooks/useWorkspace.ts`
- `apps/web/src/shared/hooks/__tests__/usePermissions.test.tsx`
- `apps/web/src/shared/hooks/use-mobile.tsx`
- `apps/web/src/shared/hooks/useAI.ts`
- `apps/web/src/shared/hooks/useAudit.ts`
- `apps/web/src/shared/hooks/useCanAccess.ts`
- `apps/web/src/shared/hooks/useCurrentOrgId.ts`
- `apps/web/src/shared/hooks/useDataQuery.ts`
- `apps/web/src/shared/hooks/useDebounce.test.ts`
- `apps/web/src/shared/hooks/useDebounce.ts`
- `apps/web/src/shared/hooks/useEditQueryParam.ts`
- `apps/web/src/shared/hooks/useEntityDetail.ts`
- `apps/web/src/shared/hooks/useHasRole.ts`
- `apps/web/src/shared/hooks/useImageContrast.ts`
- `apps/web/src/shared/hooks/useIsAdmin.ts`
- `apps/web/src/shared/hooks/usePagination.ts`
- `apps/web/src/shared/hooks/usePermissions.ts`
- `apps/web/src/shared/hooks/usePlanFeatures.ts`
- `apps/web/src/shared/hooks/useRealtimeSync.ts`
- `apps/web/src/shared/hooks/useUploadToR2.ts`
- `apps/web/src/shared/hooks/useWebSocket.ts`
- `apps/web/src/shared/hooks/useWorkflowTransition.ts`
- `apps/web/src/shared/hooks/useWsEvent.ts`

### 26.14 Web Service Files

- `apps/web/src/modules/accounting/services/accounting.service.ts`
- `apps/web/src/modules/accounting/services/entity-to-form.mapper.ts`
- `apps/web/src/modules/accounting/services/financial-categories.service.ts`
- `apps/web/src/modules/accounting/services/form-to-payload.mapper.ts`
- `apps/web/src/modules/accounting/services/index.ts`
- `apps/web/src/modules/admin/services/admin-audit.service.ts`
- `apps/web/src/modules/admin/services/admin-billing.service.ts`
- `apps/web/src/modules/admin/services/admin-plans.service.ts`
- `apps/web/src/modules/admin/services/admin-support.service.ts`
- `apps/web/src/modules/admin/services/admin-tenants.service.ts`
- `apps/web/src/modules/admin/services/index.ts`
- `apps/web/src/modules/ai/services/index.ts`
- `apps/web/src/modules/artist/services/artista.mapper.ts`
- `apps/web/src/modules/artist/services/artista.service.ts`
- `apps/web/src/modules/artist/services/index.ts`
- `apps/web/src/modules/audiovisual/services/audiovisual.service.ts`
- `apps/web/src/modules/auth/services/activation-plans.service.ts`
- `apps/web/src/modules/auth/services/index.ts`
- `apps/web/src/modules/catalog/services/catalog.service.ts`
- `apps/web/src/modules/catalog/services/index.ts`
- `apps/web/src/modules/catalog/services/registro-musicas.mapper.ts`
- `apps/web/src/modules/contracts/services/contract-party-origin.mapper.ts`
- `apps/web/src/modules/contracts/services/contracts.service.ts`
- `apps/web/src/modules/contracts/services/index.ts`
- `apps/web/src/modules/contracts/services/semantic-parser.service.ts`
- `apps/web/src/modules/crm-relationships/services/contacts.service.ts`
- `apps/web/src/modules/crm-relationships/services/index.ts`
- `apps/web/src/modules/dashboard/services/index.ts`
- `apps/web/src/modules/events/services/events.service.ts`
- `apps/web/src/modules/events/services/index.ts`
- `apps/web/src/modules/integrations/services/contrato.mapper.ts`
- `apps/web/src/modules/integrations/services/index.ts`
- `apps/web/src/modules/integrations/services/notifications.service.ts`
- `apps/web/src/modules/integrations/services/signing.service.ts`
- `apps/web/src/modules/integrations/services/transacao.mapper.ts`
- `apps/web/src/modules/inventory/services/index.ts`
- `apps/web/src/modules/inventory/services/inventory.service.ts`
- `apps/web/src/modules/leads/services/index.ts`
- `apps/web/src/modules/leads/services/leads.service.ts`
- `apps/web/src/modules/licensing/services/index.ts`
- `apps/web/src/modules/licensing/services/licensing.service.ts`
- `apps/web/src/modules/marketing/services/marketing-automation.service.ts`
- `apps/web/src/modules/marketing/services/marketing-integration.contract.ts`
- `apps/web/src/modules/marketing/services/marketing.service.test.ts`
- `apps/web/src/modules/marketing/services/marketing.service.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/analyzeArtistProfile.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/analyzeAudio.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/analyzeLyrics.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/analyzeMarketingPerformance.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/analyzeTrends.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/generateIdeas.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/generatePitching.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/generatePlanning.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/index.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/loadArtistContext.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/loadReleaseContext.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/mergeAudioLyricsInsights.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/saveAiHistory.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/types.ts`
- `apps/web/src/modules/marketing/services/musicIntelligenceEngine/utils.ts`
- `apps/web/src/modules/monitoring/rights/services/adapters.ts`
- `apps/web/src/modules/monitoring/rights/services/catalog-lookup.test.ts`
- `apps/web/src/modules/monitoring/rights/services/catalog-lookup.ts`
- `apps/web/src/modules/monitoring/rights/services/mock-data.ts`
- `apps/web/src/modules/monitoring/rights/services/rights-source.ts`
- `apps/web/src/modules/monitoring/services/index.ts`
- `apps/web/src/modules/monitoring/services/monitoring.service.ts`
- `apps/web/src/modules/musicchat/services/musicchat-automation.service.ts`
- `apps/web/src/modules/projects/services/index.ts`
- `apps/web/src/modules/projects/services/projects.service.ts`
- `apps/web/src/modules/releases/services/distribution-platforms.ts`
- `apps/web/src/modules/releases/services/dto-to-entity.mapper.ts`
- `apps/web/src/modules/releases/services/entity-to-form.mapper.ts`
- `apps/web/src/modules/releases/services/form-to-payload.mapper.ts`
- `apps/web/src/modules/releases/services/index.ts`
- `apps/web/src/modules/releases/services/releases.service.ts`
- `apps/web/src/modules/releases/services/share-from-release.ts`
- `apps/web/src/modules/reports/services/reports-api.ts`
- `apps/web/src/modules/rh/services/index.ts`
- `apps/web/src/modules/rh/services/rh.service.ts`
- `apps/web/src/modules/settings/services/billing-invoices.service.ts`
- `apps/web/src/modules/settings/services/billing-plans.service.ts`
- `apps/web/src/modules/settings/services/company-logo.service.ts`
- `apps/web/src/modules/settings/services/index.ts`
- `apps/web/src/modules/settings/services/settings.service.ts`
- `apps/web/src/modules/support/services/index.ts`

### 26.15 AI Skill Source Directories

- `packages/ai-skills/src/artist-profile-analysis`
- `packages/ai-skills/src/audiovisual-briefing`
- `packages/ai-skills/src/catalog-metadata-validator`
- `packages/ai-skills/src/crm-followup`
- `packages/ai-skills/src/financial-classification`
- `packages/ai-skills/src/marketing-calendar-builder`
- `packages/ai-skills/src/project-planning`
- `packages/ai-skills/src/release-checklist`
- `packages/ai-skills/src/shared`
- `packages/ai-skills/src/support-triage`

RISCO

Este apêndice lista arquivos e decorators, mas não prova execução runtime de cada endpoint. Onde não houve smoke integrado, manter `NÃO VALIDADO`.

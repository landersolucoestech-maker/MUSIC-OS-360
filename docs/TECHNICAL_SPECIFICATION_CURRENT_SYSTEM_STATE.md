> Historical record. Kept as recorded; not the current contract.

# ESPECIFICAÇÃO TÉCNICA COMPLETA DO ESTADO ATUAL DO SISTEMA

Data da auditoria local: 2026-07-06.

> **ATUALIZAÇÃO (2026-07-06, mesma sessão de trabalho, re-execução via Git Bash):**
> Os gates P0 abaixo (`env:check`, `build`, `typecheck`, `lint`, `test` API/web) foram
> corrigidos e re-executados nesta sessão e **todos passam agora**. As falhas originais
> de `build`/`env:check` (flags mock/auth em produção, refs Supabase divergentes) e de
> `test` (erro `form-data` no Jest da API, `Cannot read directory ... Acesso negado` no
> Vitest do web) eram do estado do worktree/shell daquela sessão anterior — não foram
> reproduzidas aqui. Resultado desta re-execução:
> - `env:check` → PASS (ref produção `jtizbxbrwyczbkdiruoq`, mock=off, front/back alinhados)
> - `build` (api+web) → PASS
> - `typecheck` (api+web) → PASS
> - `lint` → PASS (0 erros, apenas warnings)
> - `test` API (Jest) → 87/87 suites, 727/727 testes
> - `test` web (Vitest) → 38/38 arquivos, 401/401 testes
>
> As seções abaixo (Resumo Executivo, P0, Definition of Done) foram deixadas como
> registro histórico do que a auditoria original encontrou, mas os itens de
> env/build/typecheck/lint/test já não se aplicam — ver nota de status inline em cada um.
> O restante do documento (matriz UI/API/DB, migrations pendentes, refatorações P1-P3)
> continua válido e não foi re-verificado nesta atualização.

> **ATUALIZAÇÃO FASE 2 (2026-07-06/2026-07-07, PostgreSQL real via pooler Supabase):**
> A Fase 2 — Consistência UI/API/Banco foi executada para o escopo inicial autorizado
> (`Artists`, `Catalog / Works / Phonograms`, `Billing`, `Reports`, `Uploads`,
> `CRM / Leads / Contacts`) usando a API local em `http://127.0.0.1:3001/api/v1`
> e o banco real do projeto Supabase `jtizbxbrwyczbkdiruoq` via pooler
> `aws-1-sa-east-1.pooler.supabase.com:5432/postgres`.
>
> Evidências:
> - API readiness: `GET /api/v1/health/ready` retornou `database.status=up`, `driver=postgres`,
>   URL mascarada/apontando para o pooler Supabase.
> - Validação CRUD real: run `phase2-1783386546652` retornou `result=PASSOU`.
> - Gates pós-correções: `npm.cmd run typecheck` PASS; `npm.cmd run build` PASS;
>   `npm.cmd run test` PASS fora do sandbox local real.
> - Testes finais: API Jest `87/87 suites`, `727/727 tests`; Web Vitest `38/38 files`, `401/401 tests`.
>
> Correções pontuais aplicadas durante a Fase 2:
> - `apps/api/src/modules/phonograms/phonograms.service.ts`: mapper DTO/API para entity/banco
>   (`title/workId/artistId/duration` -> `titulo/obra_id/artista_id/duration_seconds`).
> - `apps/api/src/modules/leads/leads.service.ts`: mapper `stage` -> `pipeline_stage`.
> - `apps/api/src/modules/contacts/contacts.service.ts`: persistência runtime em tabela real
>   `contacts` via `DATA_SOURCE`, mantendo fallback in-memory apenas para testes sem datasource.
>
> Pendências mantidas:
> - `DIRECT_DATABASE_URL` segue com `ENOTFOUND` no host direto Supabase; débito técnico de
>   conectividade direta, não bloqueador do CRUD funcional via pooler.
> - `Contacts` não possui endpoint `DELETE /contacts/:id`; limpeza da validação foi feita no banco.
> - `Uploads` não possui delete funcional exercitado; remoção foi validada por `status=deleted`,
>   `deleted_at` e `GET /uploads/:fileId/download` retornando `404`.
> - UI visual/browser não foi exercitada nesta rodada; a validação foi API + banco real com reload
>   por `GET` após mutação.

Escopo: monorepo em `C:\Users\Usuario\Downloads\MUSIC-OS-360`. Documento baseado em leitura estática, comandos locais e execução de gates. Nenhuma funcionalidade foi considerada `OK` sem execução funcional. Quando houve apenas existência de código, o status foi marcado como `PARCIAL`, `NÃO VALIDADO` ou `BUILD OK / FUNCIONAL NÃO VALIDADO`.

Comandos executados como evidência:

| Comando | Resultado | Status |
|---|---|---|
| `git status --short` | Worktree com muitas alterações locais em API, web, docs, migrations e CI. | RISCO |
| `npm.cmd run typecheck` | API e web sem erros de typecheck. | OK para typecheck |
| `npm.cmd run build` | API build passou; web build falhou no gate `assert-supabase-env`: `VITE_USE_MOCK=true`, `VITE_MOCK_MODE=true`, `VITE_AUTH_DISABLED=true` proibidos em produção. | QUEBRADO |
| `npm.cmd run env:check` | Falhou: refs Supabase divergentes API/web e modo mock divergente. | QUEBRADO |
| `corepack.cmd pnpm exec jest --config jest.config.ts --runInBand` em `apps/api` | Executou parte da suíte, timeout em 180s; falhou em specs com `Cannot find module 'form-data'` via `supertest`; também há warnings TS em specs. | QUEBRADO / NÃO VALIDADO |
| `corepack.cmd pnpm exec vitest run --config vitest.config.mjs` em `apps/web` | Falhou ao carregar config: `Cannot read directory "../../../..": Acesso negado`; `Could not resolve ... vitest.config.mjs`. | QUEBRADO |
| `rg --files` | 2222 arquivos listados na saída truncada da sessão; varredura confirmou apps, packages, docs, infra, supabase, scripts e assets. | EVIDÊNCIA |

## 1. Resumo executivo

| Pergunta | Resposta | Evidência | Status |
|---|---|---|---|
| O sistema está pronto para produção? | Não. | `npm.cmd run build` falhou por flags de mock/auth em produção; `npm.cmd run env:check` falhou por divergência Supabase e mock API/web. | QUEBRADO |
| O sistema está pronto para MVP? | Parcialmente, mas não homologado. | `npm.cmd run typecheck` passou; testes web/API não passaram localmente; build final falhou. | PARCIAL / NÃO VALIDADO |
| O sistema tem base enterprise? | Sim como arquitetura/código, não como homologação. | NestJS, guards globais, RLS migrations, CI, runbooks, billing, queues, observabilidade existem; execução local não valida produção. | PARCIAL |
| Suporta refatoração incremental segura? | Sim, com bloqueadores prévios. | Monorepo modular e testes existem, mas worktree sujo, build quebrado e testes quebrados reduzem segurança. | PARCIAL |
| Percentual de prontidão | 55% para MVP técnico; 35% para produção enterprise. | Inferência técnica baseada em typecheck OK, build quebrado, testes quebrados, env inconsistente, mocks ativos. | INFERÊNCIA TÉCNICA |
| Maior risco | Ambiente e modo de execução permitem confundir mock/dev com produção. | `scripts/env-check.mjs:155`, `scripts/env-check.mjs:186-189`, `apps/web/scripts/assert-supabase-env.mjs:71-81`, `apps/web/src/shared/lib/env.ts:24-27`. | RISCO |
| Principal bloqueador | Build de produção não passa. | Saída de `npm.cmd run build`. | P0 |
| Prioridade número 1 | Normalizar `.env`, desligar mock/auth-disabled para produção e repetir build/test/env gates. | Critério: `env:check`, `build`, `test` verdes. | AÇÃO NECESSÁRIA |

## 2. Inventário completo

### Estrutura geral

| Artefato | Tipo | Caminho | Responsabilidade | Usado por | Status |
|---|---|---|---|---|---|
| Monorepo | workspace | `package.json`, `pnpm-workspace.yaml` | Workspaces `apps/*`, `packages/*`; scripts build/typecheck/test/lint. | CI, dev local. | PARCIAL |
| API | app NestJS | `apps/api` | Backend enterprise, controllers, guards, services, migrations, queues. | Web e integrações externas. | BUILD OK / FUNCIONAL NÃO VALIDADO |
| Web | app React/Vite | `apps/web` | SPA, rotas, módulos, providers, clients HTTP. | Usuário final. | BUILD QUEBRADO |
| Packages | libs | `packages/auth`, `config`, `schemas`, `types`, `ui`, `utils`, `observability`, `ai-skills` | Tipos, schemas, auth helpers, UI, skills. | API e web. | PARCIAL |
| Infra | observability/docker | `infra`, `docker-compose*.yml` | Prometheus/Grafana, docker compose, setup. | Operação local/staging. | NÃO VALIDADO |
| Supabase | config/migrations | `supabase`, `apps/api/src/database/migrations` | Banco, RLS, migrations. | API, auth, storage. | PARCIAL |
| CI/CD | GitHub Actions | `.github/workflows/*.yml` | CI, staging, security, backup. | GitHub Actions. | NÃO VALIDADO LOCALMENTE |
| Documentação | docs/runbooks | `docs/*.md`, root `*.md` | Runbooks, blueprint, auditorias, governança. | Time técnico. | PARCIAL |
| Assets | imagens/textos | `attached_assets`, `public`, `apps/web/src/assets` | Assets de UI e evidências históricas. | Web/docs. | PARCIAL |

Evidência: `package.json` declara `workspaces: ["apps/*","packages/*"]` e scripts `build`, `typecheck`, `test`; `pnpm-workspace.yaml` confirma `apps/*` e `packages/*`; `turbo.json` define tasks `build`, `dev`, `lint`, `typecheck`, `test`.

### Frontend

Módulos encontrados em `apps/web/src/modules`: `accounting`, `admin`, `ai`, `artist`, `audiovisual`, `auth`, `catalog`, `contracts`, `crm-relationships`, `dashboard`, `events`, `integrations`, `inventory`, `leads`, `licensing`, `marketing`, `monitoring`, `musicchat`, `projects`, `releases`, `reports`, `rh`, `settings`, `support`, `workspace`.

Rotas lazy-load encontradas em `apps/web/src/app/routes/*.tsx`: accounting, admin, artist, audiovisual, catalog, contracts, crm, marketing, operations, public, releases, reports, settings, support, workspace. Evidência: `rg -n "lazy\\(" apps/web/src/app/routes apps/web/src/App.tsx`.

| Artefato | Caminho | Responsabilidade | Usado por | Status |
|---|---|---|---|---|
| Auth provider | `apps/web/src/app/providers/AuthContext.tsx:329` | Usa o usuário sintético de dev quando `AUTH_DISABLED` ou `VITE_DEV_AUTH_BYPASS` (ambos só com `import.meta.env.DEV`; `MOCK_MODE` foi removido por ser flag morta). | Rotas protegidas. | RISCO |
| Tenant provider | `apps/web/src/app/providers/TenantContext.tsx:177`, `:288` | Mock tenant e permissões permissivas em dev/mock/auth-disabled. | Permissões/UI. | RISCO / PARCIAL |
| Billing context | `apps/web/src/app/providers/BillingContext.tsx:73-90` | Busca `/billing/subscription`; ignora em mock/auth-disabled. | Avisos/estado de billing. | API OK / UI NÃO VALIDADA |
| API client | `apps/web/src/shared/lib/api-client.ts:161`, `:188` | Fetch para `${API_BASE_URL}/api/v1`. | Services/hooks. | PARCIAL |
| Supabase client | `apps/web/src/lib/supabase.ts:46` | Auth persistente em `localStorage`. | AuthContext. | SEGURANÇA NÃO VALIDADA |
| Mock data | `apps/web/src/shared/data/mockData.ts` | Dados seed/mock de UI. | Muitos módulos em mock. | MOCKADO |
| Reports API | `apps/web/src/modules/reports/services/reports-api.ts:107`, `:212` | Usa dados locais somente sob o bypass de dev do frontend (`MOCK_MODE` removido). | Relatórios. | MOCKADO/PARCIAL |

### Backend

Módulos encontrados em `apps/api/src/modules`: `activity-logs`, `ai`, `analytics`, `artist-goals`, `artists`, `assets`, `audiovisual`, `audit-log`, `auth`, `billing`, `briefings`, `campaigns`, `clients`, `contacts`, `contracts`, `conversations`, `events`, `financial-categories`, `forms`, `health`, `integrations`, `inventory`, `invoices`, `leads`, `licensing`, `marketing`, `notifications`, `projects`, `rbac`, `registry`, `reports`, `uploads`, `users`, `works`, entre outros.

| Artefato | Caminho | Responsabilidade | Usado por | Status |
|---|---|---|---|---|
| Bootstrap API | `apps/api/src/main.ts:159`, `:215`, `:253`, `:262` | Helmet, CORS, prefixo `api/v1`, ValidationPipe. | Toda API. | PARCIAL |
| Guards globais | `apps/api/src/app.module.ts:230-253` | APP_GUARD para auth/tenant/billing/RBAC/rate. | Controllers. | PARCIAL |
| Auth guard | `apps/api/src/core/guards/auth.guard.ts:90-118` | Bypass se `AUTH_DISABLED`. | API. | RISCO |
| Tenant guard | `apps/api/src/core/guards/tenant.guard.ts:39` | Bypass se `AUTH_DISABLED`. | API. | RISCO |
| Roles/permissions | `apps/api/src/core/guards/roles.guard.ts:85`, `permissions.guard.ts:34` | Fail-closed para rota sem roles; bypass em auth disabled. | Controllers. | PARCIAL |
| Billing | `apps/api/src/modules/billing/billing.controller.ts:35-232`, `billing.service.ts:532-542` | Planos, checkout, portal, subscription, admin, webhook Stripe. | Web/admin/Stripe. | PARCIAL |
| Uploads | `apps/api/src/modules/uploads/uploads.controller.ts:57-153` | Presign, confirm, download. | Web upload/R2. | NÃO VALIDADO |
| Reports | `apps/api/src/modules/reports/reports.controller.ts:58` | Entities, definitions, export, import validate/commit. | Web reports. | PARCIAL |
| Integrations | `apps/api/src/modules/integrations/integrations.controller.ts:36-728` | OAuth/status/providers/webhooks. | Web integrations. | PARCIAL |

### Banco de dados

| Tabela | Colunas principais | Tenant | RLS | FK | Índices | Migration origem | Status |
|---|---|---|---|---|---|---|---|
| `organizations` | `id`, `slug`, `plan`, `billing_status`, `external_auth_org_id` | org | Sim | NÃO VALIDADO | `idx_organizations_slug` | `20240101000000_InitialSchema` | PARCIAL |
| `tenants` | `id`, `org_id`, `slug`, `features`, `settings` | org/tenant | Sim | NÃO VALIDADO | `idx_tenants_org_id` | `20240101000000_InitialSchema` | PARCIAL |
| `org_members` | `tenant_id`, `auth_user_id`, `role` | Sim | Sim | NÃO VALIDADO | `idx_org_members_tenant_id` | `20240101000000_InitialSchema` | PARCIAL |
| `artists` | `tenant_id`, `nome`, `status`, `deleted_at` | Sim | Sim | NÃO VALIDADO | `idx_artists_tenant_id` | `20240101000000_InitialSchema` | PARCIAL |
| `works` | `tenant_id`, `titulo`, `isrc`, `iswc`, `status` | Sim | Sim | NÃO VALIDADO | `idx_works_tenant_id`, `idx_works_isrc` | `20240101000000_InitialSchema` | PARCIAL |
| `phonograms` | `tenant_id`, `obra_id`, `artista_id`, `isrc` | Sim | Sim | NÃO VALIDADO | `idx_phonograms_*` | `20240101000000_InitialSchema` | PARCIAL |
| `contracts` | `tenant_id`, `artista_id`, `status`, `data_fim` | Sim | Sim | NÃO VALIDADO | `idx_contracts_*` | `20240101000000_InitialSchema` | PARCIAL |
| `transactions` | `tenant_id`, `data`, `tipo`, `artista_id` | Sim | Sim | NÃO VALIDADO | `idx_transactions_*` | `20240101000000_InitialSchema` | PARCIAL |
| `uploads` | `tenant_id`, `file_id`, `entity`, `entity_id` | Sim | Sim | NÃO VALIDADO | `idx_uploads_*` | `20240101000000_InitialSchema` | PARCIAL |
| `audit_logs` | `tenant_id`, `entity`, `user_id`, `created_at` | Sim | Sim | NÃO VALIDADO | `idx_audit_logs_*` | `20240101000000_InitialSchema` | PARCIAL |
| `tenant_billing_state` | `tenant_id`, `status`, `grace_until` | Sim | Sim/Force | FK tenant | `idx_tenant_billing_state_status` | `apps/api/src/database/migrations/20260701000001_BillingEnforcement.ts:37-54`, `20260701000003_BillingRlsHardening.ts:30-40` | PARCIAL |
| `payment_events` | `tenant_id`, `event_type` | Sim/parcial | Sim/Force | FK tenant nullable | `idx_payment_events_*` | `20260701000001_BillingEnforcement.ts:84-96`, `20260701000003_BillingRlsHardening.ts:47-57` | PARCIAL |
| `billing_plans` | `slug`, `features`, `stripe_price_id`, `active` | Global | Sim permissivo | NÃO VALIDADO | `idx_billing_plans_active` | `20260701000002_BillingPlans.ts:16-62` | RISCO |

Observação: há 83 arquivos de migration em `apps/api/src/database/migrations`. A auditoria local não conectou a um banco real, então drift schema/runtime é `NÃO VALIDADO`.

## 3. Mapa de arquitetura atual

Arquitetura real encontrada:

| Camada | Implementação atual | Evidência | Status |
|---|---|---|---|
| Apresentação | React/Vite, rotas lazy, módulos por domínio. | `apps/web/src/app/routes/*.tsx`; `apps/web/src/App.tsx:38-40`. | PARCIAL |
| Estado/UI | Contexts de auth/tenant/billing, React Query, stores/hooks por módulo. | `AuthContext.tsx`, `TenantContext.tsx`, `BillingContext.tsx`; hooks em `apps/web/src/shared/hooks`. | PARCIAL |
| API | NestJS com controllers modulares e `api/v1`. | `apps/api/src/main.ts:253`; 75 controllers encontrados. | PARCIAL |
| Segurança API | Guards globais, decorators `@RequireRole`, `@RequirePermission`, `@Public`. | `apps/api/src/app.module.ts:230-253`; `rg @Public/RequireRole`. | PARCIAL |
| Aplicação/domínio | Services por módulo, handlers de eventos, workflow, billing, reports. | `apps/api/src/modules/**.service.ts`, `handlers`, `schedulers`. | PARCIAL |
| Persistência | TypeORM/DataSource + migrations SQL/TS + RLS. | `apps/api/src/database/entities.ts`, `schema.ts`, `migrations`. | PARCIAL |
| Integrações | Stripe, Supabase, R2/S3, OpenAI/Anthropic/Gemini, OAuths, PostHog/Sentry. | `apps/api/package.json`, controllers/services/hooks. | NÃO VALIDADO |
| Operação | GitHub Actions, runbooks, docker compose observability. | `.github/workflows/*.yml`, `docs/runbooks`, `docker-compose.observability.yml`. | NÃO VALIDADO |

## 4. Mapa de dependências

### Dependência entre módulos

| Módulo | Depende de | Usado por | Dependências externas | Dependência circular? | Risco | Status |
|---|---|---|---|---|---|---|
| Auth | Supabase, JWT, tenants, org_members | Guards, web AuthContext | Supabase Auth/JWKS | NÃO VALIDADO | Bypass dev/mock | PARCIAL |
| Tenant/RBAC | Auth, DB, permissions catalog | Todos controllers protegidos | Postgres/RLS/cache | NÃO VALIDADO | IDOR se contexto falhar | PARCIAL |
| Billing | Tenant, Stripe, RLS, guards | Web billing/admin, checkout/webhook | Stripe | NÃO VALIDADO | Cobrança e feature gate parcial | PARCIAL |
| Artists | Tenant, repositories, queues platform sync | Web artist/catalog/dashboard | Spotify/Youtube indireto | NÃO VALIDADO | Fluxo grande e UI 3061 linhas | PARCIAL |
| Reports | Metadata, table guard, import/export | Web reports | XLSX | NÃO VALIDADO | Export/import sem validação funcional local | PARCIAL |
| Integrations | Auth, tenant, providers, OAuth | Web integrations | Spotify, YouTube, Deezer, Google Ads etc. | NÃO VALIDADO | Muitos endpoints e mocks | PARCIAL |
| Uploads | Storage service, R2/S3, tenant | Web upload hooks | Cloudflare R2/S3 | NÃO VALIDADO | Upload/download não homologado | NÃO VALIDADO |
| AI | Providers, queues, skills | Web AI modules | OpenAI/Anthropic/Gemini/Perplexity | NÃO VALIDADO | Mock/fallback heurístico | PARCIAL/MOCKADO |

### Dependência entre camadas

| Fluxo | UI | Hook | API Client | Endpoint | Controller | Service | Repository | Entity | Tabela | Migration | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Auth context | `AuthContext.tsx` | Supabase auth listener | Supabase client | Supabase Auth + `/auth/context` | `auth.controller.ts` | `auth-context.service.ts` | `auth.repository.ts` | org/tenant/member | `tenants`, `org_members` | Initial/RBAC/Auth migrations | PARCIAL |
| Billing subscription | `BillingContext.tsx` | React effect | `api.get` | `GET /billing/subscription` | `billing.controller.ts:110-117` | `billing.service.ts` | billing repo | billing entities | `billing_subscriptions`, `tenant_billing_state` | `20260701000001..3` | API OK / UI NÃO VALIDADA |
| Artist CRUD | `Artistas.tsx`, `ArtistaFormModal.tsx` | `useArtistas` | `api`/storage | `/artists` | `artists.controller.ts:34-132` | `artists.service.ts` | `artist.repository.ts` | `Artist` | `artists` | Initial + RLS | PARCIAL |
| Reports export | `Relatorios.tsx` | `useReports` | `reports-api.ts` | `/reports/entities/:entity/export` | `reports.controller.ts` | export engine/query builder | DB metadata | dynamic | tenant tables | migrations varied | PARCIAL |
| Upload | `FileUpload.tsx`, `useUploadToR2.ts` | `useUploadToR2` | fetch presign/PUT | `/uploads/presign`, R2 URL, `/confirm` | `uploads.controller.ts` | storage/upload handlers | repository | upload | `uploads` | Initial/RLS | NÃO VALIDADO |

### Dependências circulares

| Origem | Depende de | Ciclo encontrado | Impacto | Correção | Prioridade |
|---|---|---|---|---|---|
| Web chunks/build | Vite dependency graph | NÃO VALIDADO por ferramenta de ciclo | Build já falha por env antes de validar chunks. | Rodar `pnpm build` após env limpo e usar `madge`/depcruise se necessário. | P1 |
| API modules | Nest modules/services | NÃO VALIDADO | Risco oculto por modularidade ampla. | Rodar análise de ciclos e limitar imports cross-module. | P2 |
| Frontend/backend | API client e types | NÃO ENCONTRADO import direto backend no frontend na amostra; varredura completa não validada. | Baixo/médio. | Gate lint boundary. | P2 |

## 5. Mapa de fluxos ponta a ponta

| Fluxo | Começa em | Termina em | Dados manipulados | Permissões | Tenant | Persistência | Logs | Testes | Status |
|---|---|---|---|---|---|---|---|---|---|
| Login/session | `AuthContext.tsx` | Supabase session + contexto local | JWT/session/user metadata | Supabase + ProtectedRoute | `org_id`/tenant via JWT/context | Supabase Auth | NÃO VALIDADO | `tenant-labels.test.ts`, auth guard specs | PARCIAL |
| Logout | `AuthContext.tsx` | Supabase signOut/mock no-op | Session | UI route guard | N/A | Supabase | NÃO VALIDADO | NÃO VALIDADO | NÃO VALIDADO |
| Cadastro | `Register.tsx:106`, `:209`, `:523-623` | Supabase/signup + activation plan | user, company, activation_plan_id | Público | Tenant futuro | Supabase/API | NÃO VALIDADO | NÃO VALIDADO | PARCIAL |
| Onboarding | `settings.routes.tsx:14` | `/auth/onboarding` | workspace profile | Auth guard global | tenant/session | DB | NÃO VALIDADO | NÃO VALIDADO | PARCIAL |
| Convite usuário | settings/admin UI | `/users/invitations` | email, roleId | `@RequireRole('admin')` | tenant | `tenant_invitations` | `@Audit` | NÃO VALIDADO | PARCIAL |
| Troca/uso tenant | `TenantContext.tsx` | Context provider | tenant, permissions, features | JWT/context | Sim | N/A/local | Dev log | `usePermissions.test.tsx` | PARCIAL |
| CRUD artists | `Artistas.tsx`/modal | tabela `artists` | artist fields/platform links | viewer/editor/manager | `tenant_id` | DB | `@Audit` create/update/delete | service/cross-tenant specs existem, execução falhou | PARCIAL |
| Upload/download | `useUploadToR2.ts` | R2 + `uploads` table | file metadata | editor/viewer | `tenant_id` | DB + R2 | upload events | `storage.service.spec.ts`, upload handler specs | NÃO VALIDADO |
| Billing checkout | Settings/Billing/Admin | Stripe checkout/session | plan/customer/subscription | auth + billing guard | tenant/org | Stripe + DB | payment_events | billing specs existem, execução não concluiu | PARCIAL |
| Stripe webhook | Stripe | `billing.service.handleWebhook` | Stripe raw body/event | `@Public` + HMAC | org/tenant via metadata | DB | payment_events | `webhook-rawbody.integration.spec.ts` existe | API OK / FUNCIONAL NÃO VALIDADO |
| Reports export/import | `Relatorios.tsx` | download/import commit | table rows, XLSX | viewer/editor | table guard tenant | DB | export/import audit | specs existem | PARCIAL |
| Integrações OAuth | integrations UI | provider callback/status | tokens/provider account | editor/admin/public callback | tenant | oauth_connections/integrations | audit | NÃO VALIDADO | PARCIAL/MOCKADO |
| AI geração | AI pages/providers | API `/ai/generate` ou mock | prompts/resultados | editor | tenant | ai_jobs/usage logs | AI analytics | automation specs existem | PARCIAL/MOCKADO |
| Activity/audit log | controllers/interceptors | `audit_logs`/`activity_logs` | action/entity/user | role-dep | tenant | DB | sim | specs parciais | PARCIAL |

## 6. Matriz UI → API → DTO → Entity → Banco

| Módulo | Campo | UI | Form | Payload | DTO | Entity | Migration | Banco | Response | Mapper | Teste | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Artist | nome/status/platform URLs | `ArtistaFormModal.tsx`, `artist-form.definition.ts` | zod schema | service mapper | `create-artist.dto.ts` | `entities.ts` | initial + remove dead fields | `artists` | controller/service | `artista.mapper.ts` | tests de modal/mapper | PARCIAL |
| Artist | banner/video legado | Removido/guardado | N/A | N/A | spec legado | migration destrutiva | `20260705000002_RemoveArtistBannerVideoFields.ts` | removido | N/A | guard tests | `legacy-platform-fields.guard.test.ts` | PARCIAL |
| Billing | status/plan/grace | BillingContext | N/A | API response | DTOs billing | billing entities | `20260701000001..3` | `tenant_billing_state`, `billing_subscriptions` | subscription | normalizeStatus | billing specs | API OK / UI NÃO VALIDADA |
| Reports | entity fields | Relatorios | filters/export | query params/body | report DTO/types | dynamic metadata | migrations varied | dynamic tables | export blob/import results | reports-api | reports tests | PARCIAL |
| Upload | fileName/contentType/size/category | FileUpload/useUpload | hook | presign DTO | `presign-upload.dto.ts` | upload entity | `uploads` table | uploads | presigned URL | hook | storage/upload specs | NÃO VALIDADO |
| Transactions | tipo/valor/data | Financeiro/forms | zod | `createTransacaoSchema` | ZodValidationPipe | transaction entity | `transactions` | numeric/date | response | mappers | financial tests | PARCIAL |

Quebras/gaps identificados:

| Item | Evidência | Impacto | Status |
|---|---|---|---|
| UI pode operar mock enquanto API real não | `scripts/env-check.mjs` reportou `modo mock divergente: api=false vs web=true`; `apps/web/src/shared/lib/env.ts:24-27`. | Dados não persistem ou divergem de produção. | QUEBRADO |
| Build bloqueado por auth disabled/mock | `apps/web/scripts/assert-supabase-env.mjs:71-81`; saída do build. | Não há artefato produção. | QUEBRADO |
| Matriz campo a campo completa exige DB ativo | Nenhuma conexão DB validada nesta auditoria. | Drift schema/runtime não descartado. | NÃO VALIDADO |

## 7. Inventário de endpoints

Prefixo global: `api/v1`, evidência `apps/api/src/main.ts:253`.

| Método | Path | Controller | Auth | Tenant | RBAC | DTO | Front chama? | Teste | Status |
|---|---|---|---|---|---|---|---|---|---|
| GET/POST/PATCH/DELETE | `/artists` | `artists.controller.ts` | global | global | role/permission | sim | Sim | specs existem | PARCIAL |
| GET/POST/PATCH/DELETE | `/works` | `works.controller.ts` | global | global | role/permission | sim | Sim/catalog | specs existem | PARCIAL |
| GET/POST/PATCH/DELETE | `/phonograms` | `phonograms.controller.ts` | global | global | parcial | sim | Sim/catalog | NÃO VALIDADO | PARCIAL |
| GET/POST/PATCH/DELETE | `/contracts` | `contracts.controller.ts` | global | global | parcial | sim | Sim/contracts | handlers specs | PARCIAL |
| GET/POST/PATCH/DELETE | `/transactions` | `transactions.controller.ts` | global | global | role/permission | zod | Sim/accounting | specs | PARCIAL |
| POST/GET | `/uploads/*` | `uploads.controller.ts` | global | global | role | sim | Sim | specs | NÃO VALIDADO |
| GET/POST/PATCH | `/billing/*` | `billing.controller.ts` | global exceto webhook | global/org | admin/editor/viewer | sim | Sim | specs existem | PARCIAL |
| POST | `/billing/webhooks/stripe` | `billing.controller.ts:224-232` | `@Public` + HMAC | metadata | N/A | raw body | Stripe | integration spec exists | API OK / FUNCIONAL NÃO VALIDADO |
| GET/POST | `/reports/*` | `reports.controller.ts` | global | table guard | role | sim | Sim | specs | PARCIAL |
| GET/POST/etc | `/integrations/*` | `integrations.controller.ts` | global/public callbacks | tenant | role | parcial | Sim | NÃO VALIDADO | PARCIAL/MOCKADO |
| GET | `/health`, `/health/live`, `/health/ready` | `health.controller.ts` | `@Public` em live/ready | N/A | N/A | N/A | infra | NÃO VALIDADO | PARCIAL |
| GET | `/dev-auth/token` | `dev-auth.controller.ts` | 404 salvo `DEV_AUTH_ENDPOINT_ENABLED=true`; 403 em staging/production; exige `DEV_AUTH_EMAIL`/`DEV_AUTH_PASSWORD` | N/A | N/A | N/A | smoke/runbook local | specs unitárias (autenticação real NÃO VALIDADA) | RISCO MITIGADO |

Endpoints públicos encontrados: forms submit, OAuth exchange/callbacks, external-data webhooks, Autentique webhook, Stripe webhook, health live/ready, public artist registration. Status geral: `SEGURANÇA NÃO VALIDADA` até testes de assinatura, rate limit e abuse serem executados.

## 8. Inventário do banco

| Tabela/área | Responsabilidade | Criada por migration | Entidade | Services que usam | Endpoints | Front relacionado | Tenant | RLS | FORCE RLS | Risco | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Core org/tenant/member | SaaS tenancy | initial + auth/RBAC migrations | `entities.ts` | auth/tenant/users | `/auth`, `/users`, `/rbac` | settings/admin | Sim | Sim | parcial | auth metadata/drift | PARCIAL |
| Catálogo musical | artists/works/phonograms/shares/releases | initial + registry | `entities.ts` | artists/works/phonograms | `/artists`, `/works`, `/phonograms` | artist/catalog/releases | Sim | Sim | parcial | campos legados e UI grande | PARCIAL |
| Financeiro | transactions/invoices/categories/rules | initial + financial categories | `entities.ts` | accounting/billing | `/transactions`, `/invoices`, `/financial-*` | accounting | Sim | Sim | parcial | regra fiscal não validada | PARCIAL |
| CRM/leads/forms/conversations | pipeline/relacionamento | `20260521000040`, `20260528000002`, etc. | parcial | leads/contacts/forms | `/leads`, `/contacts`, `/forms` | leads/crm/support | Sim | Sim | parcial | public endpoints | PARCIAL |
| Billing | subscriptions, state, events, plans | `20260701000001..3` | parcial | billing | `/billing/*` | settings/admin | Sim/global | Sim | Sim em state/events/settings | `billing_plans` policy global | PARCIAL |
| Operational/audit/events | activity, audit, domain events, workflow | multiple | `entities.ts` | interceptors/handlers | audit/activity | dashboard/settings | Sim | Sim | parcial | logs sensíveis não auditados | PARCIAL |

Validações pendentes: tabelas órfãs, entities sem tabela, migrations sem entity, colunas sem uso e drift ambiente local/staging/prod. Há documento `docs/DB_AUDIT_2026-07-05.md`, mas ele foi tratado como evidência documental, não como execução atual.

## 9. Matriz de módulos

| Módulo | UI | API | Service | Banco | Tenant | RBAC | Testes | Status | Risco |
|---|---|---|---|---|---|---|---|---|---|
| Auth | Sim | Sim | Sim | Sim | Sim | Sim | Parcial | PARCIAL | bypass/mock |
| Artists | Sim | Sim | Sim | Sim | Sim | Sim | Parcial, execução falhou | PARCIAL | componente gigante |
| Catalog | Sim | Sim | Sim | Sim | Sim | Parcial | Parcial | PARCIAL | consistência campo a campo |
| Billing | Sim | Sim | Sim | Sim | Sim | Sim | Parcial, não verde | PARCIAL | cobrança real |
| Reports | Sim | Sim | Sim | Dinâmico | Sim | Sim | Parcial | PARCIAL | export/import |
| Integrations | Sim | Sim | Sim | Sim | Sim | Parcial | Baixa | PARCIAL/MOCKADO | tokens/webhooks |
| AI | Sim | Sim | Sim | Sim | Sim | Parcial | Parcial | PARCIAL/MOCKADO | fallback heurístico |
| Uploads | Sim | Sim | Sim | Sim | Sim | Role | Parcial | NÃO VALIDADO | storage seguro |
| Admin | Sim | via billing/users | Sim | Sim | Sim | Sim | Baixa | PARCIAL/MOCKADO | dados mock admin |

## 10. Matriz de testes

| Módulo | Arquivos críticos | Testes existentes | Fluxos cobertos | Fluxos não cobertos | Cobertura estimada | Status |
|---|---|---|---|---|---|---|
| API geral | guards, services, migrations | 87 specs detectadas por Jest antes da falha | unit/migration parcial | e2e real local | NÃO VALIDADA | QUEBRADO |
| Web geral | routes/components/hooks | 38 arquivos test/spec detectados | componentes/mappers/hooks | e2e visual e produção | NÃO VALIDADA | QUEBRADO |
| Billing | billing service/controller/webhook | `billing.service.spec.ts`, `webhook-rawbody.integration.spec.ts` | assinatura rawBody em spec | Stripe real/test-mode end-to-end | PARCIAL | NÃO VALIDADO |
| Tenant/RBAC | guards/RLS specs/e2e | guard specs, RLS e2e files | fail-closed unit | execução completa | PARCIAL | NÃO VALIDADO |
| Upload | storage/upload handlers | specs | fail-closed/event | R2 real | PARCIAL | NÃO VALIDADO |
| Reports | service/export/import specs + web reports | specs | export/import unit | roundtrip real | PARCIAL | NÃO VALIDADO |

Execução de testes:

| Fluxo | Unit | Integration | E2E | Security | Tenant | Billing | Webhook | Status |
|---|---|---|---|---|---|---|---|---|
| API | Parcial executou | Falhou em supertest/form-data | Não executado | Parcial | Parcial | Parcial | Parcial | QUEBRADO |
| Web | Não iniciou | Não iniciou | Não executado | Não | Não | Não | Não | QUEBRADO |

## 11. Métricas de qualidade de código

Arquivos grandes:

| Arquivo | Linhas | Problema | Risco | Ação |
|---|---:|---|---|---|
| `apps/web/src/modules/artist/components/ArtistaVisao360Modal.tsx` | 3061 | God Component | manutenção/regressão UX | quebrar em subcomponentes/hooks |
| `apps/api/src/database/entities.ts` | 2780 | God schema/entity file | drift e acoplamento | separar entidades por domínio |
| `apps/web/src/modules/releases/components/LancamentoFormModal.tsx` | 2584 | formulário gigante | bugs de validação | decompor por seções |
| `apps/web/src/modules/settings/pages/Configuracoes.tsx` | 2555 | página gigante | acoplamento | rotas/subpáginas |
| `apps/web/src/shared/pages/MusicChat.tsx` | 1678 | componente/página gigante | performance | modularizar |
| `apps/web/src/modules/catalog/components/ObraFormModal.tsx` | 1376 | formulário gigante | inconsistência UI/API | decompor |
| `apps/web/src/modules/marketing/pages/Calendario.tsx` | 1370 | página gigante | re-render/estado | decompor |
| `apps/api/src/modules/billing/billing.service.ts` | 854 | service grande | billing crítico | separar checkout/webhook/admin |
| `apps/api/src/core/rbac/permission-resolver.service.ts` | 858 | service crítico grande | RBAC regressions | separar cache/resolution/audit |
| `apps/api/src/modules/integrations/integrations.controller.ts` | 652 | controller amplo | segurança OAuth/webhook | dividir por provider |

SOLID/code smells:

| Arquivo/Módulo | Princípio/smell | Evidência | Impacto | Refatoração | Prioridade |
|---|---|---|---|---|---|
| `ArtistaVisao360Modal.tsx` | SRP/God Component | 3061 linhas | alto | componentização por tabs/sections | P1 |
| `entities.ts` | SRP/God Object | 2780 linhas | alto | entidades por domínio | P1 |
| `integrations.controller.ts` | SRP/Large Controller | 652 linhas e múltiplos providers | alto segurança | controllers por integração | P1 |
| `billing.service.ts` | SRP/God Service | 854 linhas | alto financeiro | services checkout/webhook/admin/plans | P1 |
| `apps/web/src/shared/data/mockData.ts` | Mock/fallback amplo | usado em mock mode e tests | risco de produção fake | gate e remoção por domínio | P0/P1 |
| `apps/web/src/modules/admin/data/mockAdmin.ts` | Dados fake admin | linhas 107+ com tenants/Stripe/webhooks fictícios | decisões produto falsas | trocar por API ou esconder | P1 |

## 12. Diagnóstico arquitetural

| Camada | Responsabilidade esperada | Implementação atual | Violação encontrada | Risco | Correção |
|---|---|---|---|---|---|
| UI | Renderizar e orquestrar UX | Muitas páginas/componentes gigantes | regra/estado demais na UI | regressão | extrair hooks/usecases |
| API controllers | Contratos HTTP finos | Alguns controllers amplos | provider logic no controller | segurança/manutenção | dividir controllers |
| Services | Regras de aplicação | Services grandes em billing/RBAC | múltiplas responsabilidades | regressão | separar services |
| Domínio | Invariantes claras | Entities e DTOs predominam | domínio anêmico | regras duplicadas | domain services |
| Dados | Persistência isolada | TypeORM/migrations/RLS | drift não validado | produção | db:check/e2e |
| Operação | Gates automatizados | CI/runbooks existem | local não verde | deploy inseguro | consertar gates |

Escalabilidade: há filas BullMQ, processors, Redis, workers e indexes, mas concorrência, volume, N+1, caches e limites por tenant não foram validados funcionalmente. Status: `NÃO VALIDADO`.

## 13. Segurança

| Risco | Severidade | Local | Evidência | Impacto | Correção | Prioridade | Status |
|---|---|---|---|---|---|---|---|
| Produção com mock/auth disabled bloqueia build, mas `.env` local está assim | Crítico | `.env` via comandos, scripts | build output; `assert-supabase-env.mjs:71-81` | sem artefato prod confiável | normalizar env | P0 | QUEBRADO |
| Front e API em projetos Supabase diferentes | Crítico | env gate | `scripts/env-check.mjs:155`, saída env:check | auth/db split, tenant errado | unificar refs | P0 | QUEBRADO |
| Bypass auth existe fora de produção | Alto | API/web | `auth-disabled.ts:14-21`, `AuthContext.tsx:329`, guards | uso indevido em staging | gate env + logs + CI | P1 | RISCO |
| Webhook público depende de HMAC/rawBody | Alto | Billing | `billing.controller.ts:224-232`, `billing.service.ts:532-542` | spoof se assinatura falhar | manter teste e rodar verde | P0 | API OK / NÃO VALIDADO |
| Integrations public callbacks/webhooks | Alto | integrations | `integrations.controller.ts:91`, `:299`, `external-data.controller.ts:153`, `autentique.controller.ts:47` | abuso/SSRF/replay | assinatura/state/rate-limit por endpoint | P1 | SEGURANÇA NÃO VALIDADA |
| Dados sensíveis em frontend/localStorage | Médio/Alto | Supabase client/storage | `supabase.ts:46`, `TenantMemory.ts`, mock storage | token/data leak | revisar storage e redaction | P1 | NÃO VALIDADO |
| RLS existe mas DB real não validado | Alto | migrations | RLS lines em migrations; testes não verdes | vazamento cross-tenant | verify:rls e e2e | P0 | TENANT ISOLATION NÃO VALIDADO |
| Dependências vulneráveis | Médio | CI security | `.github/workflows/security.yml:40-41` | CVE | rodar `pnpm audit` | P2 | NÃO VALIDADO |

## 14. Multi-tenancy

| Área | Como o tenant é aplicado | Evidência | Risco de vazamento | Teste existente | Status |
|---|---|---|---|---|---|
| JWT/session | app_metadata/top-level fallback no web | `TenantContext.tsx:368-375` | MÉDIO | tenant-label tests | PARCIAL |
| API request | TenantGuard + RequestTenantContextInterceptor | `app.module.ts:230-253`; interceptors | MÉDIO | guard tests | PARCIAL |
| Banco | `tenant_id`, RLS, `app_current_tenant_id()` | migrations `20240101000000_InitialSchema`, `20260612000001_PortableRlsTenantContext` | ALTO se not run | RLS e2e files | NÃO VALIDADO |
| Jobs/events | aborta sem tenantId | múltiplos handlers `fail-closed` | MÉDIO | handler specs | PARCIAL |
| Billing | org/tenant billing state | `BillingContext`, billing migrations | MÉDIO/ALTO | billing specs | PARCIAL |
| Storage/uploads | tenant em uploads/presign | uploads controller/storage specs | ALTO | specs | NÃO VALIDADO |
| Cache | RBAC distributed cache | rbac services | MÉDIO | specs | NÃO VALIDADO |
| Front mock | `MOCK_TENANT` e permissões permissivas | `TenantContext.tsx:129-177`, `:288` | CRÍTICO se vazar para prod | build gate | QUEBRADO no env atual |

## 15. Billing e feature gates

| Fluxo | UI | API | Webhook | Banco | Feature Gate | Teste | Status |
|---|---|---|---|---|---|---|---|
| Planos | AdminPlans/settings | `/billing/plans` | N/A | `billing_plans` | `usePlanFeatures` | billing plans spec | PARCIAL |
| Checkout | Billing page | `/billing/checkout` | Stripe | subscriptions/state | BillingEnforcementGuard | billing specs | NÃO VALIDADO |
| Portal | Billing page | `/billing/portal` | Stripe | subscriptions | N/A | NÃO VALIDADO | NÃO VALIDADO |
| Subscription status | BillingContext | `/billing/subscription` | Stripe events | `tenant_billing_state` | frontend + guard | specs | PARCIAL |
| Webhook Stripe | N/A | `/billing/webhooks/stripe` | HMAC/rawBody | `payment_events` | server-side | rawBody spec | API OK / NÃO VALIDADO |
| Inadimplência | BillingNotice/BillingBlockedPage | BillingEnforcementGuard | invoice events | billing state | server-side | guard specs | PARCIAL |
| Upgrade/downgrade/cancel | UI/admin parcial | services/controller parcial | Stripe | subscriptions | parcial | NÃO VALIDADO | NÃO VALIDADO |

## 16. Integrações

| Integração | Finalidade | Arquivos | Auth | Env Vars | Webhook | Retry | Idempotência | Timeout | Rate Limit | Tenant Safety | Logs | Status | Riscos |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Supabase | Auth/DB | `supabase.ts`, env, migrations | JWT/keys | sim | Auth hooks | N/A | N/A | N/A | N/A | RLS | parcial | QUEBRADO env | refs divergentes |
| Stripe | Billing | billing controller/service | secret + webhook secret | sim | sim | parcial | parcial | NÃO VALIDADO | NÃO VALIDADO | org/tenant | sim | PARCIAL | cobrança |
| R2/S3 | Storage | storage/upload services | AWS SDK creds | sim | N/A | NÃO VALIDADO | N/A | NÃO VALIDADO | N/A | tenant key/table | logs | NÃO VALIDADO | upload público |
| Spotify/YouTube/Deezer | Métricas/OAuth | integrations controller/hooks/providers | OAuth/API | sim | callbacks | NÃO VALIDADO | NÃO VALIDADO | NÃO VALIDADO | NÃO VALIDADO | tenant | logs | PARCIAL | token/rate |
| Autentique/Clicksign/DocuSign | assinatura | providers/controllers | provider keys | sim | sim | NÃO VALIDADO | NÃO VALIDADO | NÃO VALIDADO | NÃO VALIDADO | tenant | audit | PARCIAL/MOCKADO | webhook |
| OpenAI/Anthropic/Gemini | IA | AI providers/API | server keys | sim | N/A | NÃO VALIDADO | N/A | NÃO VALIDADO | NÃO VALIDADO | tenant usage | analytics | PARCIAL/MOCKADO | fallback |
| PostHog/Sentry | observabilidade | packages/observability, deps | DSN/key | sim | N/A | N/A | N/A | N/A | N/A | redaction | parcial | NÃO VALIDADO | dados sensíveis |

## 17. UX/UI e produto

| Tela/Fluxo | Problema | Evidência | Impacto UX/Produto | Correção | Prioridade |
|---|---|---|---|---|---|
| Artist 360 modal | 3061 linhas | métrica de linhas | alto risco de regressão visual | decompor por seções | P1 |
| Settings/Configurações | 2555 linhas | métrica | fluxo denso e acoplado | separar rotas/forms | P1 |
| Admin dashboard | dados mock/fictícios bloqueados parcialmente | `AdminLayout.tsx:216`, `mockAdmin.ts` | risco de decisão com dado falso | API real ou empty state | P1 |
| Billing | depende de subscription API e mock bypass | `BillingContext.tsx:73`, `usePlanFeatures.ts:48-72` | bloqueio/acesso inconsistente | validar end-to-end | P0/P1 |
| Reports | modo local em mock/auth disabled | `reports-api.ts:107`, `:212` | export sem fonte real | desabilitar mock em prod | P1 |
| Responsividade/acessibilidade | não validado por Playwright | nenhum screenshot executado | risco visual | rodada visual depois de build | P2 |

## 18. Performance e escala

| Gargalo | Camada | Evidência | Impacto em escala | Correção | Prioridade |
|---|---|---|---|---|---|
| Componentes >1000 linhas | UI | lista de métricas | re-render/manutenção | modularizar/lazy sections | P1 |
| Controller de integrações grande | API | 652 linhas, muitos endpoints | acoplamento e rate-limit difícil | dividir providers | P1 |
| Entities monolítico | DB/API | 2780 linhas | drift e build lento | modularizar entities | P1 |
| Listagens sem paginação validada | API/UI | endpoints amplos; validação não executada | memória/latência | enforce pagination | P1 |
| Jobs/workers sem teste de carga | queues | processors/specs | retry/concorrência desconhecidos | teste carga/fila | P2 |
| Relatórios/export grandes | reports | export engine | bloqueio/timeout | streaming/limits | P1 |

## 19. DevOps e operação

| Área | Existe? | Evidência | Funciona? | Risco | Correção | Status |
|---|---|---|---|---|---|---|
| CI | Sim | `.github/workflows/ci.yml:38-44`, `:75-81`, `:127` | NÃO VALIDADO localmente | CI pode falhar como local | rodar no GitHub e corrigir | NÃO VALIDADO |
| Staging pipeline | Sim | `.github/workflows/staging.yml:41-44`, `:70`, `:87-88`, `:101-128` | NÃO VALIDADO | deploy hook/secrets | validar staging | NÃO VALIDADO |
| Security workflow | Sim | `.github/workflows/security.yml:40-41` | NÃO VALIDADO | CVEs | rodar audit | NÃO VALIDADO |
| Backup/restore | Sim | `.github/workflows/backup.yml`, `docs/runbooks/dr.md` | NÃO VALIDADO | DR falso | executar restore drill | NÃO VALIDADO |
| Release check | Sim | `scripts/release-check.mjs:25-34` | NÃO VALIDADO | gates não verdes | usar como DoD | PARCIAL |
| Observability | Sim | `infra/observability`, `packages/observability` | NÃO VALIDADO | alertas cegos | smoke dashboards | NÃO VALIDADO |
| Rollback | Docs | `docs/RUNBOOK_ROLLBACK.md` | NÃO VALIDADO | rollback teórico | exercício staging | NÃO VALIDADO |

## 20. Código morto, mocks e dívida técnica

| Tipo | Local | Evidência | Impacto | Status |
|---|---|---|---|---|
| Mock auth | `AuthContext.tsx` | usuário sintético, `AUTH_DISABLED` / `VITE_DEV_AUTH_BYPASS` (DEV only) | login real bypassado em dev | MOCKADO |
| Mock tenant | `TenantContext.tsx` | `MOCK_TENANT`, permissivo em mock/dev | RBAC UI false positive | MOCKADO/RISCO |
| Mock admin data | `apps/web/src/modules/admin/data/mockAdmin.ts` | tenants/subscriptions/integrations fictícios | decisões falsas | MOCKADO |
| Mock AI providers | `OpenAIProvider.ts`, `ClaudeProvider.ts`, `GeminiProvider.ts`, `PerplexityProvider.ts` | retornos simulados em `MOCK_MODE` | IA não real | MOCKADO |
| Local reports | `reports-api.ts` | `LOCAL_REPORTS_ENABLED` somente sob o bypass de dev (`MOCK_MODE` removido) | export sem API | MOCKADO/PARCIAL |
| TODO/fallbacks | packages ai-skills parsers | fallbacks estruturados | outputs heurísticos | PARCIAL |
| Arquivos órfãos | `_archive`, removidos em git status | `_archive`, deleted reports files | confusão | RISCO |
| Worktree sujo | repo todo | `git status --short` | auditoria mutável | RISCO |

## 21. Riscos por prioridade

### P0 — Bloqueia produção

| Descrição | Local | Evidência | Impacto | Correção | Critério de aceite |
|---|---|---|---|---|---|
| ~~Build de produção falha por mock/auth disabled~~ | web env gate | saída `npm.cmd run build`; `assert-supabase-env.mjs:71-81` | sem release | corrigir env | ✅ RESOLVIDO — `build` verde nesta sessão (ver nota do topo) |
| ~~Env Supabase divergente API/web~~ | scripts/env-check | saída `npm.cmd run env:check`; `scripts/env-check.mjs:155` | auth/db split | unificar refs allowlist | ✅ RESOLVIDO — `env:check` verde nesta sessão (ver nota do topo) |
| ~~Testes não verdes~~ | API/web | Jest timeout/form-data; Vitest config access | sem homologação | corrigir deps/config/scripts | ✅ RESOLVIDO — Jest 727/727, Vitest 401/401 (ver nota do topo) |
| Tenant isolation não validado em DB real | RLS/e2e | testes não executados completos | vazamento dados | rodar verify/e2e com DB | `verify:rls`, `verify:tenant-isolation`, `test:e2e` verdes |

### P1 — Bloqueia MVP confiável

| Descrição | Local | Evidência | Impacto | Correção | Critério de aceite |
|---|---|---|---|---|---|
| Componentes/forms gigantes | web | arquivos 1000-3000 linhas | regressão UX | decompor | testes por seção |
| Billing real não homologado | billing | specs existem mas suíte falhou | acesso indevido/cobrança | smoke Stripe test-mode | checkout/webhook/subscription verdes |
| Integrações com mocks/stubs | integrations | hooks/providers desligados por padrão (ver ledger de nomes) | falsa funcionalidade | classificar e gatear | matriz real/mock por provider |
| Reports import/export não homologado | reports | API/UI existem, testes não verdes | perda de dados | roundtrip test | export/import com DB |

### P2 — Necessário para enterprise

| Descrição | Local | Evidência | Impacto | Correção | Critério de aceite |
|---|---|---|---|---|---|
| Entities/controller/services monolíticos | API/web | métricas | escala/manutenção | modularização | boundaries e testes |
| Observabilidade não validada | infra/packages | docs/configs | incident response fraco | smoke dashboards/alerts | alertas testados |
| Backup/restore teórico | workflows/docs | backup.yml/runbooks | DR incerto | restore drill | restore validado |
| Segurança de webhooks/OAuth ampla | integrations | endpoints públicos | replay/spoof | assinatura/state/idempotência | testes segurança |

### P3 — Melhoria técnica

| Descrição | Local | Evidência | Impacto | Correção | Critério de aceite |
|---|---|---|---|---|---|
| Documentação histórica extensa | docs/root | muitos docs | fonte da verdade difusa | consolidar | índice atualizado |
| Arquivos _archive/assets antigos | repo | `_archive`, attached assets | ruído | arquivar fora do app | cleanup check |

## 22. Plano de refatoração completa

### Fase 1 — Estabilização crítica

Objetivo: tornar gates locais verdes.

Tarefas: corrigir `.env`, desligar mock/auth disabled para build, alinhar refs Supabase, corrigir Vitest config/acesso, corrigir dependência `form-data`/supertest, rodar `build`, `typecheck`, `test`, `env:check`.

Arquivos afetados: `.env`, `.env.example`, `scripts/env-check.mjs`, `apps/web/scripts/assert-supabase-env.mjs`, configs test.

Critério: todos comandos P0 verdes.

### Fase 2 — Consistência UI/API/Banco

Status: EXECUTADA E VALIDADA para o escopo inicial autorizado, com banco real Supabase via pooler.

Comando/evidência principal: `node .tmp/phase2-validation.mjs` executado temporariamente e removido após uso. Run final `phase2-1783386546652`: `result=PASSOU`.

Critério: CRUD real por API, persistência no banco real, reload por `GET` após mutação, limpeza dos registros de teste e ausência de mock/fallback/fake/local.

| Módulo | Campo/Fluxo | UI | Form | Payload | DTO | Entity | Migration | Banco | Response | Mapper | Reload após F5/GET | Teste | Status |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Artists | criar/listar/editar/detalhe/excluir | NÃO VALIDADO visual | API validada | `nome_artistico`, `genero_musical`, tenant | DTO/controller existente | `ArtistEntity` | migrations existentes | `artists.tenant_id`, `nome_artistico`, `genero_musical`, `deleted_at` | `201/200` | service existente | `GET /artists/:id` após PATCH OK | run `phase2-1783386546652`, `artistId=8069d27a-c53e-4185-a9dd-102cfe174ad4` | OK |
| Catalog / Works | criar/editar/detalhe/excluir | NÃO VALIDADO visual | API validada | `titulo`, `status`, tenant | DTO/controller existente | `WorkEntity` | migrations existentes | `works.titulo`, `status`, `tenant_id`, `deleted_at` | `201/200` | service existente | `GET /works/:id` após PATCH OK | `workId=bf664708-2bfd-4791-b70d-2ad318d18eaf` | OK |
| Catalog / Phonograms | criar/editar/detalhe/excluir | NÃO VALIDADO visual | API validada | `title/workId/artistId/duration` | DTO aceitava nomes frontend | `PhonogramEntity` usa `titulo/obra_id/artista_id/duration_seconds` | migrations existentes | `phonograms.titulo`, `genero_musical`, `tenant_id` | `201/200` após correção | `toEntityPayload()` | `GET /phonograms/:id` após PATCH OK | `phonId=4ad56433-a6e0-4839-a73f-4483ead8083e` | OK após correção |
| Billing | plano + billing state | NÃO VALIDADO visual | API validada | `slug`, `amount`, `active`, tenant billing state | DTO/controller existente | billing entities/services | migrations billing `20260701000001..3` | `billing_plans`, `tenant_billing_state` | `201/200` | service existente | `GET /billing/plans/:id` e state OK | `planId=26b70f66-c307-4b7a-8a02-aa9a4b4aee65` | OK |
| Reports | entidades/definitions/export | NÃO VALIDADO visual | N/A | query/export | controller existente | dynamic metadata | migrations variadas | leitura de tabelas reais autorizadas | export `200`, `17100 bytes` | export engine | download API OK | `/reports/entities=120`, `/reports/definitions=37` | OK |
| Uploads | presign + persistência + download pós-delete | NÃO VALIDADO visual | API validada | file metadata | `presign` DTO/controller | upload persistence | `uploads` table | `uploads.file_id`, `tenant_id`, `status`, `r2_key`, `deleted_at` | `201`, download `404` após delete lógico | storage/upload controller | `GET /uploads/:fileId/download` após DB delete lógico OK | `fileId=2dc394cb-87fa-4a44-8b83-ee05a759682b` | OK/PARCIAL |
| CRM / Leads | criar/editar/detalhe/excluir | NÃO VALIDADO visual | API validada | `name`, `email`, `phone`, `stage`, `notes` | DTO aceitava `stage` | `LeadEntity` usa `pipeline_stage` | migrations existentes | `leads.pipeline_stage`, `tenant_id`, `deleted_at` | `201/200` após correção | `stage -> pipeline_stage` | `GET /leads/:id` após PATCH OK | `leadId=649e8d54-ead8-48ef-9de2-f35e0dd9bb79` | OK após correção |
| CRM / Contacts | criar/editar/detalhe + persistência | NÃO VALIDADO visual | API validada | `name`, `contact_type`, `email`, `phone`, `notes` | controller aceita payload genérico | sem entity dedicada; SQL parametrizado via `DATA_SOURCE` | `20260528000002_LeadsContactsOperationalRefactor.ts` | `contacts.id`, `tenant_id`, `name`, `notes`, `email_encrypted` | `201/200` após correção | `normalizePayload()`/`toResponse()` | `GET /contacts/:id` após PATCH OK | `contactId=d3479ead-8704-473d-8147-4e23276ea54b` | OK/PARCIAL |

Problemas encontrados e tratados:

| ID | Módulo | Campo/Fluxo | Problema | Evidência | Impacto | Correção necessária/aplicada | Prioridade |
|---|---|---|---|---|---|---|---|
| F2-CATALOG-001 | Catalog / Phonograms | create/update | DTO/API enviava `title/workId/artistId/duration`, entity/banco esperavam `titulo/obra_id/artista_id/duration_seconds`; `POST /phonograms` retornava 500. | Run anterior retornou 500 em `/api/v1/phonograms`; correção em `phonograms.service.ts:53-93`; run final passou. | Fonogramas não eram criados no banco real pelo payload frontend/API. | Aplicado mapper `toEntityPayload()`. | P1 |
| F2-CRM-001 | CRM / Leads | `stage` | DTO aceitava `stage`, mas update tentava persistir campo inexistente na entity/tabela; banco possui `pipeline_stage`. | `PATCH /leads/:id` retornou 500; correção em `leads.service.ts:412-417`; run final persistiu `pipeline_stage=qualified`. | Lead perdia edição/falhava no fluxo de CRM. | Aplicado mapper `stage -> pipeline_stage`. | P1 |
| F2-CRM-002 | CRM / Contacts | persistência | API respondia 201/200, mas service usava `Map` in-memory e `select ... from contacts where id=$1` retornava 0 linhas. | Run anterior reportou `CRM/Contacts não persiste no banco real`; correção em `contacts.service.ts:11-217`; run final encontrou row em `contacts`. | Contatos sumiam ao reiniciar API e não sustentavam relatórios/auditoria. | Aplicada persistência real via `DATA_SOURCE` e SQL parametrizado. | P0/P1 |

Pendências da Fase 2:

| ID | Área | Pendência | Evidência | Impacto | Status |
|---|---|---|---|---|---|
| F2-PEND-001 | Supabase | `DIRECT_DATABASE_URL` segue com `ENOTFOUND` no host direto `db.jtizbxbrwyczbkdiruoq.supabase.co`. | Validações anteriores aceitaram `DATABASE_URL` e `APP_DATABASE_URL` via pooler; `DIRECT_DATABASE_URL` ficou como débito técnico separado. | Pode afetar tarefas que exijam conexão direta, migrations/maintenance fora do pooler. | RISCO / NÃO BLOQUEIA CRUD via pooler |
| F2-PEND-002 | CRM / Contacts | Não há `DELETE /contacts/:id`. | `contacts.controller.ts` expõe `GET`, `POST`, `PATCH`; cleanup do run precisou deletar no banco. | CRUD funcional completo fica parcial para exclusão por API. | PARCIAL |
| F2-PEND-003 | Uploads | Delete funcional por API não foi exercitado. | Validação removeu por `status=deleted/deleted_at` no banco e confirmou download `404`. | Exclusão end-to-end de upload ainda não homologada. | PARCIAL |
| F2-PEND-004 | UI | UI visual/browser não foi exercitada nesta rodada. | Validação executada por API + DB real; reload por `GET` após mutação. | Possíveis divergências de formulário visual/cache React Query ainda podem existir. | UI NÃO VALIDADA / API OK |

### Fase 3 — Segurança e multi-tenancy

Tarefas: rodar e corrigir `verify:rls`, `verify:tenant-isolation`, e2e cross-tenant, revisar public endpoints, rate-limit, HMAC, OAuth state.

Critério: zero rota crítica sem RBAC/tenant.

### Fase 4 — Billing e feature gates

Tarefas: smoke Stripe test-mode, checkout/portal/webhook/idempotência, feature gates server-side.

Critério: upgrade/downgrade/cancel/reactivate testados.

### Fase 5 — Refatoração arquitetural

Tarefas: quebrar `ArtistaVisao360Modal`, `LancamentoFormModal`, `Configuracoes`, `entities.ts`, `billing.service`, `integrations.controller`.

Critério: nenhum arquivo crítico > 800 linhas; testes por submódulo.

### Fase 6 — Testes e homologação

Tarefas: unit/integration/e2e/security/tenant/billing/upload/webhook; cobertura por fluxo.

Critério: matriz de testes `ACEITÁVEL` para fluxos críticos.

### Fase 7 — DevOps, produção e operação

Tarefas: CI verde, staging deploy, smoke, backup/restore, rollback drill, observability alerts.

Critério: release checklist executado com evidências.

### Fase 8 — Evolução enterprise longo prazo

Tarefas: boundaries, ADRs, dashboards SLO, audit logs sensíveis, governance de integrações.

Critério: roadmap trimestral com métricas.

## 23. Roadmap de evolução

### 0–30 dias

Corrigir env/build/test; validar RLS/tenant; homologar billing/webhook/upload; remover mock de fluxos críticos em prod.

### 30–90 dias

Matriz UI/API/Banco por módulo; decompor componentes gigantes; relatórios/import/export; CI/staging sólido.

### 90–180 dias

Hardening enterprise: pentest, rate limits, idempotência, observabilidade, DR, backup/restore, RBAC avançado.

### 180+ dias

Escalabilidade por workers, governança de integrações, automação de compliance, performance e custos por tenant/plano.

## 24. Definition of Done Enterprise

| Checklist | Status atual |
|---|---|
| build frontend sem erro | ✅ RESOLVIDO nesta sessão (era QUEBRADO) |
| build backend sem erro | BUILD OK |
| typecheck sem erro | OK |
| lint sem erro crítico | ✅ RESOLVIDO nesta sessão — 0 erros (era NÃO VALIDADO) |
| testes unitários críticos passando | ✅ RESOLVIDO nesta sessão — Jest 727/727, Vitest 401/401 (era QUEBRADO/NÃO VALIDADO) |
| testes integração passando | ✅ RESOLVIDO nesta sessão — incluídas nos 727/401 acima (era QUEBRADO/NÃO VALIDADO) |
| testes e2e passando | NÃO VALIDADO |
| testes tenant isolation passando | NÃO VALIDADO |
| testes RBAC passando | NÃO VALIDADO |
| testes billing passando | NÃO VALIDADO |
| testes webhook passando | NÃO VALIDADO |
| testes upload passando | PARCIAL — presign/persistência/download 404 pós-delete lógico validados na Fase 2 |
| schema consistente | PARCIAL — Artists/Catalog/Billing/Reports/Uploads/CRM validados no banco real na Fase 2 |
| migrations consistentes | NÃO VALIDADO |
| RLS validado | NÃO VALIDADO |
| FORCE RLS validado | NÃO VALIDADO |
| auth validado | PARCIAL |
| RBAC validado | PARCIAL |
| feature gates server-side | PARCIAL |
| billing real | PARCIAL — billing plans e tenant billing state validados via API+DB real na Fase 2 |
| webhooks assinados | API OK / NÃO VALIDADO |
| idempotência validada | NÃO VALIDADO |
| logs ativos | PARCIAL |
| auditoria ativa | PARCIAL |
| observabilidade ativa | NÃO VALIDADO |
| alertas ativos | NÃO VALIDADO |
| backup ativo | NÃO VALIDADO |
| restore testado | NÃO VALIDADO |
| rollback testado | NÃO VALIDADO |
| staging validado | NÃO VALIDADO |
| produção validada | NÃO VALIDADO |
| documentação mínima | PARCIAL |
| fluxos críticos homologados | PARCIAL — Fase 2 validou CRUD real API+DB para Artists, Catalog, Billing, Reports, Uploads e CRM |
| zero mock sem gate | PARCIAL — gates produção com mock/auth disabled desligados; auditoria de dados fake por fluxo ainda pendente |
| zero dado fake em produção | NÃO VALIDADO |
| zero endpoint crítico sem teste | NÃO VALIDADO |
| zero tabela crítica sem tenant | NÃO VALIDADO |
| zero rota crítica sem RBAC | NÃO VALIDADO |
| zero segredo no código | NÃO VALIDADO |

## 25. Conclusão técnica

Estado real: o sistema possui uma base técnica ampla e ambiciosa, com modularização por domínio, NestJS, React/Vite, RLS, RBAC, billing, integrações, filas, observabilidade e documentação operacional. Após Fase 1 e Fase 2, os gates locais principais estão verdes e o escopo inicial de consistência API/Banco foi validado contra PostgreSQL real Supabase via pooler.

Partes que podem ser mantidas: estrutura monorepo, módulos principais, guards globais, migrations RLS, runbooks, CI como intenção, API client, providers de auth/tenant/billing, services de reports/billing/uploads desde que passem nos gates.

Partes que precisam ser corrigidas: conectividade `DIRECT_DATABASE_URL`, validação DB/RLS completa fora do escopo Fase 2, delete API de contacts, delete funcional de uploads, UI visual/browser dos fluxos homologados por API, billing/webhook além do smoke funcional validado.

Partes que precisam ser refatoradas: componentes web gigantes, `entities.ts`, `billing.service.ts`, `integrations.controller.ts`, services/controllers com múltiplas responsabilidades.

Partes que precisam ser reestruturadas: matriz de dados UI/API/DB, separação de domínio, boundaries entre módulos, governança de integrações e mocks.

Riscos que impedem produção: RLS/FORCE RLS ainda não homologado de ponta a ponta, `DIRECT_DATABASE_URL` com `ENOTFOUND`, billing/webhooks não homologados end-to-end, UI visual/cache não validado por browser, delete de contacts/uploads parcial.

Riscos que impedem escala: componentes/services grandes, relatórios/export sem teste de volume, workers/queues sem teste de carga, observabilidade não validada.

Riscos que impedem enterprise: DR/restore/rollback não testados, segurança de endpoints públicos não provada, feature gates/billing sem homologação real, fonte da verdade dispersa.

Caminho seguro: manter gates verdes, validar tenant/RLS com banco real, completar pendências de delete/API/UI da Fase 2, homologar billing/webhook/upload end-to-end, decompor pontos gigantes, e só então avançar refatoração incremental orientada por testes e runbooks.

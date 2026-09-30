> Historical document (English label). Kept as recorded; not the current contract.

# MUSIC OS 360 — Blueprint Enterprise Definitivo

Data da análise: 2026-07-01  
Última atualização: 2026-07-03 (Adendo 0 — estado do release)  
Escopo analisado: monorepo `apps/web`, `apps/api`, `packages/*`, `infra/*`, `docs/*`, migrations TypeORM e configuração Docker.

Este documento descreve o estado arquitetural real do MUSIC OS 360 e o estado final recomendado para operação enterprise. Ele diferencia:

- **Encontrado no projeto:** existe código, rota, entidade, migration, módulo ou configuração verificável.
- **Parcialmente implementado:** há estrutura ou parte do fluxo, mas faltam contratos, persistência, tela, teste, hardening ou operação.
- **Não implementado:** requisito não aparece de forma verificável no código analisado.
- **Recomendado para arquitetura final:** proposta técnica para produção enterprise, separada do estado atual.

## 0. Adendo — Estado Do Release Em 2026-07-03

Fotografia operacional no momento desta atualização; o restante do documento descreve a arquitetura (que não mudou desde 2026-07-01).

**Branch e versionamento:**

- Branch ativa: `release/stripe-billing-hardening`, 24 commits à frente de `main`, sincronizada com `origin`. Último commit: `339f55eb` (billing hardening + RLS enforcement, já descrito nas seções 7 e 10).
- Working tree com ~119 arquivos pendentes de commit: frontend billing dinâmico (`BillingContext`, `billing-plans.service`, `admin-plans.service`, `BillingBlockedPage`), services de admin (`admin-audit/billing/support/tenants`), cadastro público de artista (migration `20260630000001`, `public-registration.controller`), workflows CI (`backup.yml`, `staging.yml`), scripts de backup Postgres e ~40 docs/relatórios P0/P1.
- Itens sensíveis (`.secrets/`, `.env`) confirmados fora do git via `.gitignore`.

**Gates de corte (`pnpm release:check`):** typecheck/build/verify verdes; gate de banco exige Postgres acessível (`DATABASE_URL` aponta para localhost).

**Stripe runtime = NO GO até completar, em ordem:**

1. Rotacionar a chave `sk_live` vazada (Stripe Dashboard — ação do owner).
2. Chaves de TESTE em `apps/api/.env.development`.
3. `pnpm --filter @music-os-360/api db:migrate` com banco de pé (aplica registry `20260601000001..3` + billing `20260701000001..3` juntas).
4. `sync-stripe` para popular `stripe_price_id` (hoje NULL → checkout 400).
5. Webhook real com `stripe listen`/`trigger` — valida a ressalva do `express.json()` global + `rawBody:true` em `main.ts` (risco de rawBody vazio → 400 na verificação HMAC).

**Decisões de produto vigentes:** lançar com módulo Marketing in-memory (persistência real é fast-follow P1); Skills/Automações/skill_runs são infra interna invisível (sem tela/menu de IA); storage exclusivamente Cloudflare R2.

## 1. Visão Geral Do Produto

### Produto

O MUSIC OS 360 é uma plataforma SaaS multi-tenant para gestão operacional de empresas musicais: gravadoras, selos, editoras, managers, produtoras e operações de catálogo.

### Problema Que Resolve

Centraliza processos hoje dispersos em planilhas, drives, CRMs genéricos, ferramentas de assinatura, plataformas de distribuição, módulos financeiros e controles manuais:

- cadastro e gestão de artistas;
- catálogo musical, obras, fonogramas e direitos;
- contratos e templates;
- lançamentos;
- marketing e campanhas;
- CRM e leads;
- financeiro, invoices e categorias;
- suporte;
- monitoramento, takedowns e ECAD;
- integrações musicais e administrativas;
- auditoria, RBAC e multi-tenant;
- billing SaaS.

### Público-Alvo

- Gravadoras e selos independentes.
- Editoras musicais.
- Managers e agências.
- Operações enterprise de catálogo.
- Equipes internas de marketing, financeiro, jurídico, A&R, suporte e distribuição.

### Modelo SaaS

Encontrado:

- Monorepo com `apps/web` e `apps/api`.
- Tenants e organizations em banco.
- Planos `starter`, `professional`, `enterprise` no billing backend.
- Admin SaaS em `/admin/*`.
- Stripe integrado no backend.

Parcial:

- Painel admin possui páginas funcionais, mas parte dos dados ainda vem de fontes mock/local.
- Billing enforcement existe no backend e parte do frontend, mas precisa de listagem admin real de tenants/subscriptions conectada ao banco.

Modelo final recomendado:

- SaaS B2B multi-tenant com planos, limites, feature gates, cobrança recorrente Stripe, auditoria append-only e isolamento por tenant em API, banco, storage, jobs e relatórios.

### Estrutura Organizacional

Encontrado:

- `organizations`, `tenants`, `org_members`.
- RBAC enterprise com `roles`, `permissions`, `role_permissions`, `departments`, `positions`, `job_functions`, `role_inheritance`.
- Super Admin frontend em `/admin`.

Recomendado:

- Clarificar semanticamente `organization` vs `tenant`: se um tenant é workspace operacional, a organization deve representar conta corporativa/matriz; se não houver hierarquia real, consolidar para evitar duplicidade.

## 2. Mapa Completo De Domínios

| Domínio | Objetivo | Evidência | Dependências | Eventos | Status atual | Status ideal |
|---|---|---|---|---|---|---|
| Auth | Login, sessão, bootstrap de contexto | `AuthContext`, `JwtAuthGuard`, `AuthModule`, Supabase JWKS | Supabase Auth, JWT, tenants | `tenant.created`, `user.invited` | Parcial | MFA, sessão revogável, audit trail completo |
| Multi-tenancy | Isolamento de dados por tenant | `TenantGuard`, `RequestTenantContextInterceptor`, RLS migrations | Auth, DB, headers | todos os eventos com `tenantId` | Parcial/forte | NOBYPASSRLS em produção, testes contínuos |
| RBAC | Roles e permissions por tenant | `roles`, `permissions`, guards, shadow mode | Auth, org_members | `rbac_decision_logs` | Parcial | enforcement ON, UI completa e matriz validada |
| Billing | Planos, Stripe, enforcement | `BillingModule`, `BillingEnforcementGuard`, migration 20260701 | Stripe, tenants, invoices | `stripe.webhook_processed`, billing audit | Parcial | listagem admin real, retries, dunning completo |
| Admin SaaS | Operação da plataforma | `modules/admin`, `/admin/*` | billing, tenants, audit | admin actions | Parcial | CRUD real contra API, sem mock |
| Artistas | Cadastro e gestão de artistas | `artists` API/web, public registration | leads, uploads, tenant | `artist.created` | Encontrado | onboarding, contratos e catálogo integrados |
| Catálogo | Obras, fonogramas, shares | `works`, `phonograms`, `shares`, registry | artists, rights, uploads | `catalog.work.created` | Encontrado | validação musical e versionamento completo |
| Contratos | Contratos e templates | `contracts`, `contract-templates`, Autentique | clients, artists, integrations | `contract.signed` | Encontrado | lifecycle jurídico completo e assinatura robusta |
| Financeiro | Transações, invoices, categorias | `transactions`, `invoices`, `financial-categories` | billing, clients | `transaction.paid` | Encontrado | conciliação, export fiscal, centros de custo |
| CRM/Leads | Leads, contatos, empresas, pipeline | `leads`, `contacts`, `crm_*`, public forms | artists, forms | `lead.created`, `lead.converted` | Encontrado/parcial | pipeline real, automações e SLA |
| Marketing | Projetos, campanhas, assets, posts | `marketing_*`, campaigns, briefings | assets, AI, integrations | `marketing.project_created` | Encontrado | publish real, approval workflow e analytics |
| Lançamentos | Releases e relações com obras | `releases`, `release_works` migration | catalog, integrations | `release.created` | Encontrado | distribuição externa e status sync |
| Monitoramento | ECAD, detecções, takedowns, proteção | `content-detections`, `ecad-reports`, `takedowns`, web tabs | catalog, integrations | `takedown.requested` | Parcial | fingerprint/proteção real futuramente |
| Registry | Titulares, identificadores, sociedades | `registry/*`, society submissions | catalog, integrations | `society.submission_created` | Encontrado | ABRAMUS/ECAD production-grade |
| Storage/Assets | Uploads, R2, assets versionados | `uploads`, `assets`, R2 service | auth, tenant, events | `asset.uploaded` | Encontrado | antivirus, retention, lifecycle |
| AI/Skills | Geração e skills operacionais | `ai`, `packages/ai-skills`, `skill_runs` | OpenAI/Anthropic/Gemini | `skill.completed` | Parcial | budgets, policy, evals e observabilidade |
| Suporte | Tickets e base de conhecimento | `support-tickets`, admin support | users, notifications | `support.ticket.created` | Encontrado/parcial | portal completo, SLA e triagem IA |
| RH | Funcionários, payroll, afastamentos | `hr` API/web | tenant, finance | audit | Encontrado | políticas e workflow de aprovação |
| Audiovisual | Produção audiovisual | `audiovisual_*` | projects, assets, tasks | `audiovisual.*` | Encontrado | pipeline production-ready |
| Relatórios | Export/import entity-driven | `reports` API/web | DB, permissions | audit | Encontrado | catálogo de relatórios, async export |
| Observabilidade | Logs, metrics, dashboards | Prometheus, Grafana, Sentry helpers | API, infra | metrics | Parcial | OTel completo, alertas e SLO |

## 3. Arquitetura Completa

### Frontend Encontrado

- Framework: React 18 + Vite.
- Roteamento: React Router v6 modular em `apps/web/src/app/routes`.
- Estado servidor/cache: TanStack Query.
- Estado local: React state e Zustand em alguns módulos.
- Auth: `AuthProvider`, Supabase client, `AUTH_DISABLED` e `MOCK_MODE`.
- Tenant: `TenantProvider`, `X-Tenant-ID` via `api-client`.
- Billing: `BillingProvider`, `BillingNotice`, `BillingGuard`.
- Design system: Tailwind, Radix UI, componentes em `shared/ui`, ícones `lucide-react`.
- Módulos: `accounting`, `admin`, `artist`, `auth`, `catalog`, `contracts`, `crm-relationships`, `dashboard`, `events`, `integrations`, `inventory`, `leads`, `licensing`, `marketing`, `monitoring`, `musicchat`, `projects`, `releases`, `reports`, `rh`, `settings`, `support`, `workspace`, `audiovisual`.

### Backend Encontrado

- Framework: NestJS 10.
- Banco: PostgreSQL via TypeORM.
- Auth: JWT Supabase via JWKS, token dev em ambiente não produção, flag `AUTH_DISABLED`.
- Guards globais: rate limit, JWT, tenant, billing enforcement, roles, permissions.
- Interceptors: tenant context, audit.
- Eventos: `@nestjs/event-emitter`, `DomainEventLog`.
- Jobs: BullMQ + Redis, processors para notifications, marketing publishing, external data, email, artist sync, AI jobs.
- Storage: Cloudflare R2/S3-compatible via presigned upload.
- Billing: Stripe SDK, checkout, portal, webhook, enforcement service.
- Observabilidade: `/metrics`, health checks, Prometheus/Grafana infra, Sentry env.

### Diagrama Textual

```text
Browser React/Vite
  ├─ AuthProvider/Supabase session
  ├─ TenantProvider -> X-Tenant-ID
  ├─ BillingProvider -> banners/blocked page
  ├─ React Query -> API cache
  └─ Modules UI -> api-client / publicApi

NestJS API /api/v1
  ├─ Middleware: request-id, correlation
  ├─ Guards: rate limit -> JWT -> tenant -> billing -> roles -> permissions
  ├─ Interceptors: tenant DB context -> audit
  ├─ Controllers per domain
  ├─ Services / repositories TypeORM
  ├─ EventsService -> domain_event_log / handlers
  ├─ QueueModule -> BullMQ/Redis processors
  ├─ StorageService -> Cloudflare R2
  └─ Integrations -> Stripe, Supabase, OpenAI, Anthropic, Google AI, Autentique, Spotify, Meta, TikTok, Google Ads, ABRAMUS

PostgreSQL
  ├─ tenant scoped tables
  ├─ RLS migrations and app.current_tenant_id support
  ├─ RBAC catalog and decision logs
  ├─ audit_logs / activity_logs / domain_event_log
  └─ billing_subscriptions / tenant_billing_state / invoices / payment_events
```

## 4. Estrutura Final De Pastas

Encontrado:

```text
apps/
  api/        NestJS API
  web/        React/Vite frontend
packages/
  ai-skills/  prompts, parsers, validators
  auth/       roles, permissions, tenant helpers
  config/     env/features/constants
  observability/
  schemas/
  types/
  ui/
  utils/
infra/
  observability/
docs/
scripts/
supabase/
```

Estrutura final recomendada:

```text
apps/
  web/
  api/
  worker/                 # extrair processors BullMQ se escala exigir
packages/
  contracts/              # DTOs/API contracts compartilhados
  database/               # entidades/migrations/schemas DB centralizados
  auth/
  billing/
  storage/
  observability/
  ui/
  ai-skills/
infra/
  docker/
  terraform/
  observability/
  ci/
docs/
  architecture/
  runbooks/
  adr/
```

Justificativa:

- Separar `worker` reduz acoplamento operacional e permite escala independente.
- `packages/contracts` reduz divergência frontend/backend.
- `packages/database` evita entidades duplicadas em módulos e `database/entities.ts` monolítico.

## 5. Módulos Do Sistema

### Auth / Onboarding

- Telas: `/auth`, `/register`, `/reset-password`, `/onboarding`.
- APIs: `/auth/context`, `/auth/provision-workspace`, `/auth/onboarding`, `/dev-auth/token`.
- Entidades: `users`, `organizations`, `tenants`, `org_members`.
- Status: **Parcialmente implementado**.
- Gap: MFA, revogação de sessão, admin de sessões, política de senha, auditoria de login/logout consolidada.

### Admin SaaS

- Telas: dashboard, clients, plans, subscriptions, audit, support, knowledge, settings.
- Status: **Parcial**.
- Gap: substituir `admin-source` mock por endpoints reais; CRUD admin de tenant, plans, subscriptions, support e settings; hardening de permissões super admin.

### Billing

- APIs: `/billing/checkout`, `/billing/portal`, `/billing/subscription`, `/billing/usage`, `/billing/metrics/saas`, `/billing/webhooks/stripe`, `/billing/admin/tenants/:tenantId/*`.
- Entidades: `billing_subscriptions`, `tenant_billing_state`, `invoices`, `payment_events`, `billing_settings`.
- Permissões: super admin/admin financeiro; frontend apenas reflete estado.
- Status: **Parcialmente implementado com base real**.
- Gap: listagem admin real, dunning emails, reconciliation job, plano/preço persistidos, upgrade/downgrade e customer portal completo.

### Catálogo / Registro

- APIs: `works`, `phonograms`, `shares`, `registry/*`.
- Entidades: `works`, `phonograms`, `shares`, `rights_holders`, `external_identifiers`, `society_*`.
- Status: **Encontrado**.
- Gap: validações musicais enterprise, import/export em lote, versionamento de metadados e reconciliador externo.

### Artistas / Leads / Cadastro Público

- Rotas públicas: `/cadastro/:orgSlug`.
- APIs: `/public/workspaces/:slug`, `/public/artist-registration`, `leads/public/artist-applications`.
- Entidades: `artists`, `artist_platform_profiles`, `leads`, `lead_interactions`.
- Status: **Parcial/Encontrado**.
- Gap: anti-spam robusto, rate limit específico, upload público validado, notificações e painel de conversão real.

### Contratos

- APIs: `contracts`, `contract-templates`, `integrations/autentique`.
- Entidades: `contracts`, `contract_templates`, webhook events.
- Status: **Encontrado**.
- Gap: lifecycle de assinatura completo, anexos versionados, trilha jurídica e expiração automática.

### Financeiro

- APIs: `transactions`, `invoices`, `financial-categories`, `financial-rules`.
- Entidades: `transactions`, `invoices`, `financial_categories`, `financial_category_rules`.
- Status: **Encontrado**.
- Gap: conciliação bancária, NF-e production, centros de custo, permissões granulares e relatórios auditáveis.

### Marketing / Assets

- APIs: `campaigns`, `marketing`, `briefings`, `assets`.
- Entidades: `marketing_projects`, `marketing_tasks`, `marketing_assets`, `asset_versions`, `marketing_content_posts`.
- Status: **Encontrado**.
- Gap: publicações externas reais, approval workflow fechado, calendário editorial e métricas por canal.

### Storage

- APIs: `/uploads/presign`, `/uploads/:fileId/confirm`, `/uploads/:fileId/download`.
- Entidades: `uploads`, `assets`, `asset_versions`, usage logs.
- Status: **Encontrado**.
- Gap: varredura antivírus, quotas por tenant, retenção/expurgo, auditoria de download e lifecycle de bucket.

### Relatórios

- APIs: `/reports/entities`, `/reports/definitions`, export, import validate/commit.
- Status: **Encontrado**.
- Gap: export assíncrono para datasets grandes, templates salvos, permissões por dataset e masking de PII.

### Observabilidade / Saúde

- APIs: `/health`, `/health/live`, `/health/ready`, `/health/integrations`, `/metrics`.
- Infra: Prometheus, Grafana, dashboards API/Postgres/Redis/RBAC.
- Status: **Parcial**.
- Gap: tracing distribuído real, alertas, error budgets, Sentry inicializado por ambiente e logs estruturados centralizados.

## 6. Fluxos De Negócio

### Login E Contexto

```text
Usuário -> /auth -> Supabase Auth -> JWT -> API JwtAuthGuard
  -> TenantGuard resolve tenant/membership
  -> RolesGuard/PermissionsGuard
  -> App renderiza dashboard ou onboarding
```

Status: **Parcial** por causa de `AUTH_DISABLED` e `MOCK_MODE`, úteis para dev mas críticos em produção.

### Cadastro Público De Artista

```text
Artista acessa /cadastro/:slug
  -> publicApi GET /public/workspaces/:slug
  -> valida tenant ativo, não bloqueado e allow_public_registration
  -> formulário envia POST /public/artist-registration
  -> lead/artista vinculado ao tenant resolvido pelo slug
  -> auditoria/notificação/conversão
```

Status: **Parcial**. Estrutura existe, mas deve ganhar proteção anti-abuso production-grade.

### Billing Stripe

```text
Admin/tenant escolhe plano
  -> POST /billing/checkout
  -> Stripe Checkout
  -> Stripe webhook assinado
  -> payment_events idempotente
  -> billing_subscriptions/invoices
  -> tenant_billing_state
  -> BillingEnforcementGuard bloqueia ou libera API
  -> frontend mostra banner ou /billing/blocked
```

Status: **Parcial com núcleo real**.

### Upload

```text
Usuário -> POST /uploads/presign
  -> StorageService gera URL R2
  -> browser faz PUT direto no R2
  -> POST /uploads/:fileId/confirm
  -> API verifica existência
  -> upload confirmado
  -> evento asset.uploaded
```

Status: **Encontrado**.

### Relatórios

```text
Usuário -> /relatorios
  -> GET /reports/entities/definitions
  -> export/import validate/commit
  -> audit log
```

Status: **Encontrado**, com recomendação de async para escala.

## 7. Banco De Dados

### Modelo

Encontrado:

- PostgreSQL com TypeORM migrations versionadas.
- Tabelas tenant-scoped usando `tenant_id`.
- RLS com migrations específicas: policies, force RLS, Data API hardening.
- `app.current_tenant_id` por request via interceptor quando habilitado.
- Soft delete em muitas entidades via `deleted_at`.
- Auditoria: `audit_logs`, `activity_logs`, `domain_event_log`, `rbac_decision_logs`, `payment_events`.

### Tabelas Por Grupo

- Organização: `organizations`, `tenants`, `org_members`, `users`.
- RBAC: `permissions`, `permission_groups`, `permission_aliases`, `roles`, `role_permissions`, `role_inheritance`, `departments`, `positions`, `job_functions`, `rbac_decision_logs`, `rbac_error_logs`.
- Billing: `billing_subscriptions`, `tenant_billing_state`, `invoices`, `payment_events`, `billing_settings`.
- Catálogo: `artists`, `artist_platform_profiles`, `works`, `phonograms`, `shares`.
- Contratos: `contracts`, `contract_templates`.
- CRM/Leads: `leads`, `lead_interactions`, `crm_companies`, `crm_contacts`, `crm_tags`, `pipelines`, `pipeline_stages`, `pipeline_opportunities`.
- Financeiro: `transactions`, `invoices`, `financial_categories`, `financial_category_rules`, audit/runs.
- Marketing: `campaigns`, `campaign_tasks`, `campaign_assets`, `marketing_projects`, `marketing_tasks`, `marketing_assets`, `marketing_content_posts`.
- Storage/assets: `uploads`, `assets`, `asset_versions`, `project_assets`, `task_assets`, `asset_usage_logs`.
- Registry: `rights_holders`, `external_identifiers`, `society_accounts`, `society_submissions`, `society_submission_events`, `society_payload_snapshots`, `society_validation_errors`, `society_sync_jobs`.
- Operação: `events`, `projects`, `releases`, `release_works`, `inventory_items`, `licenses`, `support_tickets`, `notifications`, `forms`, `form_submissions`.
- HR: `employees`, `payroll_entries`, `leave_requests`.
- AI/workflow: `ai_jobs`, `ai_usage_logs`, `skill_runs`, `skill_run_logs`, `workflow_transitions`, `workflow_executions`, `workflow_execution_logs`.

### Regras Final Recomendadas

- Toda tabela tenant-scoped deve ter `tenant_id NOT NULL`, índice por `tenant_id`, RLS `USING tenant_id = current_setting('app.current_tenant_id')`.
- Toda operação mutável deve ter `created_by`, `updated_by` quando fizer sentido.
- IDs externos devem ter unique parcial por provider/tenant.
- Eventos e audit logs devem ser append-only.
- Migrations devem ser imutáveis após merge.

## 8. RBAC E Permissões

Encontrado:

- Roles legados em `packages/auth`: OWNER, ADMIN, MANAGER, FINANCIAL, MARKETING, RADIO, TV, ARTIST.
- Recursos: artist, catalog, contracts, accounting, crm, marketing, monitoring, releases, projects, events, inventory, rh, settings, licensing, leads, analytics.
- Ações: read, create, update, delete, export, approve.
- Persisted RBAC enterprise no banco.
- `RBAC_PERSISTED_AUTHORITY` com OFF/SHADOW/ON.
- Guards `RolesGuard` e `PermissionsGuard`.

Matriz recomendada:

| Role | Escopo | Permissões |
|---|---|---|
| super_admin | sistema | plataforma inteira, admin SaaS, billing global |
| owner | tenant | todas do tenant, billing tenant, usuários |
| admin | tenant | todas exceto billing sensível e destrutivas globais |
| manager | módulo/tenant | create/update/export, sem delete crítico |
| editor | módulo | create/update |
| viewer | módulo | read/export quando permitido |
| financial | financeiro | accounting/invoices/billing tenant |
| marketing | marketing | campaigns/assets/reports marketing |
| artist | portal artista | leitura e submissões restritas |

Gap:

- Garantir `RBAC_PERSISTED_AUTHORITY=ON` em produção.
- Remover dependência de `user_metadata` para autorização.
- Criar UI completa de matriz role x permission com diff/auditoria.

## 9. Multi-Tenancy

Modelo adotado: **single database, shared schema, tenant_id + RLS + guards de API**.

Encontrado:

- `TenantGuard` exige `X-Tenant-ID`.
- Bootstrap resolve tenant e membership.
- Migrations RLS e force RLS.
- Storage keys usam tenant.
- Jobs/eventos carregam `tenantId`.

Recomendado:

- Produção deve usar role Postgres sem `BYPASSRLS`.
- Todo job assíncrono deve reconstituir tenant context.
- Logs, metrics, audit e storage devem sempre registrar `tenantId`.
- Relatórios cross-tenant apenas por super admin e em endpoints separados.

## 10. Billing

Estados finais:

- Subscription Stripe: trialing, active, past_due, unpaid, cancelled, incomplete, incomplete_expired.
- Tenant billing: active, trial, payment_grace, read_only, suspended, cancelled.

Encontrado:

- Checkout/portal.
- Webhook com assinatura Stripe.
- Idempotência via `payment_events`.
- `BillingEnforcementGuard`.
- Admin actions suspend/reactivate/override.

Recomendado:

- `billing_settings` deve controlar grace/read-only/suspend sem hardcode.
- Criar reconciliation job diário Stripe -> DB.
- Criar dunning emails e alertas.
- Criar tela admin real com estado vindo de API.
- Bloqueio backend deve seguir sendo fonte de verdade.

## 11. Storage

Encontrado:

- R2/S3-compatible.
- Presigned PUT direto do browser.
- Download temporário.
- Metadata em `uploads`.
- Evento `asset.uploaded`.

Recomendado:

- Buckets por ambiente, prefixo por tenant: `{env}/{tenantId}/{category}/{fileId}`.
- Limites por plano e tenant.
- Validação MIME e extensão antes do presign.
- Antivírus/scan assíncrono antes de disponibilizar download público.
- Retenção e backup por classe de ativo.

## 12. Integrações

Encontradas no código/env:

- Stripe.
- Supabase.
- Cloudflare R2.
- Autentique.
- OpenAI, Anthropic, Google AI.
- ACRCloud.
- Spotify.
- YouTube.
- SoundCloud.
- Meta.
- TikTok.
- Google Ads.
- DocuSign.
- ABRAMUS.
- Resend.
- Sentry.
- PostHog.

Status geral: **Parcial**. Algumas têm endpoints/configuração, outras apenas env/contratos UI.

Arquitetura final:

- Cada integração deve ter provider adapter, OAuth/token store, healthcheck, webhook signature validation, retry policy, dead-letter queue, audit log e dashboard de status.

## 13. Segurança

Encontrado:

- Helmet, CORS validation, JWT JWKS, rate limit guard, RBAC, RLS migrations, encryption env, audit interceptor.
- Supabase Auth integration.
- `AUTH_DISABLED` para bypass controlado em dev.

Riscos/Gaps:

- Garantir que `AUTH_DISABLED` nunca rode em produção.
- CSP frontend não foi confirmada.
- CSRF deve ser avaliado para cookies/portal.
- MFA não confirmado.
- Secrets precisam rotação e scanner CI.
- Admin pages ainda usam mock em alguns pontos.

Blueprint final:

- MFA para admins.
- Refresh token strategy e session revocation.
- Strict CSP.
- SAST, dependency audit, gitleaks CI.
- RLS force on em produção.
- Audit append-only.
- Rate limit específico para públicas e webhooks.
- Sanitização DOMPurify já existe no frontend, manter política central.

## 14. Observabilidade

Encontrado:

- `/metrics`, Prometheus config, Grafana dashboards, healthchecks, Sentry helpers, PostHog env, request/correlation middleware.

Recomendado:

- OTel real no backend com traces HTTP/DB/Redis/Stripe.
- Logs JSON com tenantId, userId, requestId, correlationId.
- Alertas: API error rate, latency p95, webhook failures, queue DLQ, DB connections, RLS denials anormais, billing suspension spikes.
- SLO inicial: 99.5% API, p95 < 500ms para endpoints CRUD, webhook Stripe processado < 5s.

## 15. Testes

Encontrado:

- Jest API, Vitest web.
- E2E RLS, schema reconciliation, tenant context.
- Tests de billing enforcement criados.
- Scripts de smoke, tenant isolation, RLS, signup provisioning.

Estratégia final:

- Unit: services, validators, guards, mappers.
- Integration: controllers + DB testcontainer.
- E2E: auth, RBAC, billing, public registration, upload, reports.
- Security: tenant isolation, IDOR, RLS, webhook signature, rate limit.
- Performance: endpoints críticos e exports.
- Cobertura mínima: 80% serviços críticos; 100% guards/billing/webhooks/RLS helpers.

## 16. Infraestrutura

Encontrado:

- Docker Compose local/staging com Postgres, Redis, API.
- Overlay web, Prometheus, Grafana.
- Dockerfiles em apps.
- Scripts DB, smoke, validation.

Recomendado:

- Ambientes: local, dev, staging, production.
- CI/CD: typecheck, lint, tests, migrations dry-run, build, SBOM, vulnerability scan, deploy staging, smoke, approval production.
- Deploy: API e worker separados; web em CDN.
- Rollback: artefato versionado + migration rollback planejado.
- Backup: Postgres PITR, R2 lifecycle, Redis não fonte de verdade.
- Cache: Redis para RBAC/session/query hot paths.

## 17. Roadmap Completo

### Fase 1 — Correções Críticas

- Desligar mocks em fluxos admin críticos.
- Garantir `AUTH_DISABLED=false` em prod.
- Verificar RLS/NOBYPASSRLS.
- Aceite: typecheck/build/test/RLS passam.

### Fase 2 — Arquitetura

- Extrair contratos compartilhados.
- Separar worker.
- Documentar boundaries por módulo.
- Aceite: ADRs e ownership atualizados.

### Fase 3 — Módulos Core

- Finalizar artistas, catálogo, contratos, CRM, financeiro, marketing.
- Aceite: CRUD real, audit, RBAC, testes.

### Fase 4 — Billing

- Reconciliation Stripe, dunning, admin real, billing settings.
- Aceite: webhooks idempotentes, bloqueio real, reativação automática.

### Fase 5 — Segurança

- MFA admin, CSP, CSRF, secrets, RLS hardening, pentest.
- Aceite: checklist security green.

### Fase 6 — Testes

- E2E por jornada, performance, tenant isolation contínuo.
- Aceite: cobertura crítica e pipeline bloqueante.

### Fase 7 — Produção

- Observabilidade, runbooks, backups, incident response, SLA.
- Aceite: go/no-go enterprise aprovado.

## 18. Estado Final Do Sistema

Quando 100% concluído, o MUSIC OS 360 será:

- SaaS multi-tenant B2B com isolamento forte por tenant.
- Frontend modular com rotas públicas/protegidas/admin.
- Backend NestJS com guards globais, serviços por domínio e jobs assíncronos.
- PostgreSQL com RLS, audit append-only e migrations governadas.
- Billing Stripe real com enforcement backend.
- Storage R2 seguro, versionado e auditado.
- Integrações musicais e administrativas com webhooks, retries e healthchecks.
- Observabilidade completa via metrics, traces, logs e dashboards.
- Operação enterprise com runbooks, backup/restore, CI/CD e rollback.

## 19. Definition Of Done Enterprise

### Obrigatório

- Auth real ativo em produção; bypass bloqueado.
- RLS force on e app role sem bypass.
- RBAC persisted authority ON.
- Stripe webhook com assinatura e idempotência.
- Billing guard bloqueando backend.
- Admin SaaS sem mocks em fluxos críticos.
- Audit log append-only.
- Uploads com validação, tenant isolation e logs.
- Typecheck, build, lint e testes críticos no CI.
- Backups testados.
- Healthchecks e métricas em produção.

### Recomendado

- MFA para admins.
- OTel distribuído.
- Feature flags por plano persistidas.
- Reconciliation jobs.
- SLO/error budget.
- Dashboards por domínio.
- Data retention por módulo.

### Futuro

- Fingerprint real e proteção de catálogo com motor especializado.
- Analytics avançado cross-tenant anonimizado.
- Marketplace de integrações.
- Billing usage-based.
- Data warehouse/BI dedicado.

## Evidências Principais

- Web app root: `apps/web/src/App.tsx`.
- Web routes: `apps/web/src/app/routes/*.tsx`.
- API root: `apps/api/src/app.module.ts`.
- DB entities: `apps/api/src/database/entities.ts`.
- Migrations: `apps/api/src/database/migrations`.
- Auth guard: `apps/api/src/core/guards/auth.guard.ts`.
- Tenant guard: `apps/api/src/core/guards/tenant.guard.ts`.
- Billing guard: `apps/api/src/core/guards/billing-enforcement.guard.ts`.
- Billing service: `apps/api/src/modules/billing/billing.service.ts`.
- Uploads: `apps/api/src/modules/uploads/uploads.controller.ts`.
- Domain events: `apps/api/src/core/events/events.service.ts`.
- Infra: `docker-compose.yml`, `docker-compose.observability.yml`, `infra/observability`.


> Historical record. Kept as recorded; not the current contract.

# 38 — Inventário de Domínios do Sistema (a partir do Contrato Canônico Final)

Classificação read-only dos 250 endpoints HTTP e 22 eventos realtime do [`37-canonical-frontend-contract-final.md`](./37-canonical-frontend-contract-final.md) em domínios funcionais, por responsabilidade de negócio. Nenhum arquivo foi alterado. Nenhuma arquitetura, ordem de implementação, schema, tabela ou migration foi definida.

## Metodologia

Cada um dos 250 endpoints foi classificado individualmente (reconciliação linha a linha contra a "Visão consolidada" do doc05, preservada intacta pelos docs 34/37) em exatamente 1 dos 35 domínios abaixo — nenhum endpoint duplicado, soma conferida = 250. Um achado estrutural do próprio doc05 (já registrado desde então) condiciona vários domínios abaixo: `shared/lib/storage.ts` expõe 45 tabelas lógicas (`TABLE_ENDPOINT`) através de **apenas 5 linhas de chamada genéricas** no inventário de 250 (`GET`×2, `POST`, `PATCH`, `DELETE` sobre `${resolved.ep}`) — o inventário nunca resolveu essas 45 tabelas para 45 linhas concretas separadas (limitação documentada desde o doc05/12). Por isso, os domínios de negócio servidos por essa camada genérica (artists, works, phonograms, shares, contracts, releases, events, inventory, hr, licensing, projects) aparecem abaixo com `HTTP_ENDPOINTS: NONE` diretos — sua existência como domínio é comprovada por `TABLE_ENDPOINT`, pelos serviços consumidores confirmados no doc32, e (quando aplicável) pelos eventos realtime — não pelos 250 endpoints diretamente, que pertencem tecnicamente ao domínio de infraestrutura `core-entities-gateway`.

---

## Domínios de negócio

### DOMAIN: artists

```text
RESPONSIBILITY: cadastro e gestão de artistas do roster do tenant, incluindo perfis em plataformas externas e captação pública

HTTP_ENDPOINTS:
- GET  /artists [teste, api-client.test.ts]
- GET  /artists/${artistId}/platform-profiles
- POST /artists/${artistId}/platform-profiles/${platform}/sync
- POST /public/artists

REALTIME_EVENTS:
- artist.created
- artist.updated
- artist.deleted

FRONTEND_CONSUMERS: modules/artist/hooks/useArtistPlatformProfiles.ts, modules/artist/services/artista.service.ts (CRUD via storage.ts→core-entities-gateway), modules/auth/pages/ArtistaSignupPublic.tsx, RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx

AUTH_REQUIRED: MISTO (SIM para os 3 endpoints autenticados; NÃO para POST /public/artists, cliente publicApi)
TENANT_SCOPED: MISTO (mesma razão)
PERMISSIONS_FOUND:
- artists:write (módulo "artists", doc15/16 — coarse-action)

RELATED_ENTITIES: artistas (TABLE_ENDPOINT → /artists, servido via core-entities-gateway)

EVIDENCE: doc05 (linhas 389,430,557,562 da Visão Consolidada), doc33 (eventos artist.*), doc16 (Casos 8/9 — permissão artists:write)
```

### DOMAIN: works

```text
RESPONSIBILITY: catálogo de obras musicais (composições)

HTTP_ENDPOINTS: NONE (servido via core-entities-gateway — TABLE_ENDPOINT: obras → /works)

REALTIME_EVENTS:
- catalog.music.registered

FRONTEND_CONSUMERS: modules/catalog/services/catalog.service.ts (createWork/list/findById/update/delete via storage.ts)

AUTH_REQUIRED: SIM (herdado do gateway)
TENANT_SCOPED: SIM
PERMISSIONS_FOUND:
- catalog:write (módulo "catalog", doc15/16 — Caso 6)

RELATED_ENTITIES: obras

EVIDENCE: doc05 (TABLE_ENDPOINT), doc33 (catalog.music.registered), doc16 Caso 6, doc32
```

### DOMAIN: phonograms

```text
RESPONSIBILITY: catálogo de fonogramas (gravações)

HTTP_ENDPOINTS: NONE (core-entities-gateway — TABLE_ENDPOINT: fonogramas → /phonograms)

REALTIME_EVENTS:
- catalog.phonogram.registered

FRONTEND_CONSUMERS: modules/catalog/services/catalog.service.ts (createPhonogram/list/findById/update/delete via storage.ts)

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND:
- catalog:write (mesmo módulo "catalog" que works, doc16 Caso 6)

RELATED_ENTITIES: fonogramas

EVIDENCE: doc05 (TABLE_ENDPOINT), doc33 (catalog.phonogram.registered), doc16 Caso 6, doc32
```

### DOMAIN: shares

```text
RESPONSIBILITY: participações/splits de direitos sobre obras e fonogramas

HTTP_ENDPOINTS: NONE (core-entities-gateway — TABLE_ENDPOINT: shares → /shares)

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/releases/services/releases.service.ts (CRUD de shares via storage.ts)

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE identificado especificamente para "shares" (módulo separado não confirmado em doc15/16 — pode estar coberto pelo módulo "releases" ou "catalog", não verificável sem reabrir esses docs)

RELATED_ENTITIES: shares

EVIDENCE: doc05 (TABLE_ENDPOINT), doc32
```

### DOMAIN: contracts

```text
RESPONSIBILITY: gestão de contratos (musicais/artísticos), templates de contrato e tipos de serviço contratual

HTTP_ENDPOINTS: NONE (core-entities-gateway — TABLE_ENDPOINT: contratos → /contracts, templates_contratos/contract_templates → /contract-templates, contract_service_types → /contract-service-types)

REALTIME_EVENTS:
- contract.created
- contract.updated
- contract.signed

FRONTEND_CONSUMERS: modules/contracts/services/contracts.service.ts (via storage.ts), RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE explicitamente confirmado nos 9 casos resolvidos do doc16 (módulo "contracts" citado na matriz de documentação do governance/permissions.ts, mas sem um Caso dedicado nos docs 15/16)

RELATED_ENTITIES: contratos, templates_contratos, contract_templates, contract_service_types

EVIDENCE: doc05 (TABLE_ENDPOINT), doc33 (eventos contract.*), doc32
```

### DOMAIN: releases

```text
RESPONSIBILITY: lançamentos musicais (releases) e sua distribuição digital

HTTP_ENDPOINTS: NONE (core-entities-gateway — TABLE_ENDPOINT: lancamentos → /releases)

REALTIME_EVENTS:
- storage (evento nativo do browser, filtrado por "musicos360_distributor_connections" — sincronização entre abas do estado de distribuidoras conectadas, doc33)

FRONTEND_CONSUMERS: modules/releases/services/releases.service.ts, modules/releases/hooks/useDistributionPlatforms.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE confirmado nos docs 15/16 (não fazia parte dos 9 casos resolvidos)

RELATED_ENTITIES: lancamentos

EVIDENCE: doc05 (TABLE_ENDPOINT), doc33 (evento storage), doc23-25 (distribuidoras — Decisão D1, exceção funcional preservada, não HTTP)
```

### DOMAIN: events

```text
RESPONSIBILITY: agenda de eventos/shows/produções

HTTP_ENDPOINTS: NONE (core-entities-gateway — TABLE_ENDPOINT: eventos → /events)

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/events/services/events.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND:
- events:write (módulo "events", doc16 Caso 7)

RELATED_ENTITIES: eventos

EVIDENCE: doc05 (TABLE_ENDPOINT), doc16 Caso 7, doc32
```

### DOMAIN: inventory

```text
RESPONSIBILITY: controle de inventário/equipamentos

HTTP_ENDPOINTS: NONE (core-entities-gateway — TABLE_ENDPOINT: inventario → /inventory)

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/inventory/services/inventory.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND:
- inventory:write (módulo "inventory", doc16 Caso 5)

RELATED_ENTITIES: inventario

EVIDENCE: doc05 (TABLE_ENDPOINT), doc16 Caso 5, doc32
```

### DOMAIN: hr

```text
RESPONSIBILITY: recursos humanos (funcionários, folha de pagamento, afastamentos)

HTTP_ENDPOINTS: NONE (core-entities-gateway — TABLE_ENDPOINT: funcionarios/documentos_funcionario → /hr/employees, folha_pagamento → /hr/payroll, afastamentos/ferias_ausencias → /hr/leave-requests)

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/rh/services/rh.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND:
- rh:write (módulo "rh", doc16 Caso 1 — um único gate cobrindo funcionários/folha/afastamentos)

RELATED_ENTITIES: funcionarios, documentos_funcionario, folha_pagamento, afastamentos, ferias_ausencias

EVIDENCE: doc05 (TABLE_ENDPOINT), doc16 Caso 1, doc32
```

### DOMAIN: licensing

```text
RESPONSIBILITY: licenciamento de obras/fonogramas e recebimentos externos de direitos relacionados

HTTP_ENDPOINTS: NONE (core-entities-gateway — TABLE_ENDPOINT: licencas → /licenses)

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/licensing/services/licensing.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND:
- licensing:write (módulo "licensing", doc16 Caso 2)

RELATED_ENTITIES: licencas

EVIDENCE: doc05 (TABLE_ENDPOINT), doc16 Caso 2, doc32
```

### DOMAIN: projects

```text
RESPONSIBILITY: projetos genéricos (produção musical), distintos de projetos de marketing e audiovisual

HTTP_ENDPOINTS: NONE (core-entities-gateway — TABLE_ENDPOINT: projetos → /projects)

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/projects/services/projects.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND:
- projects:write (módulo "projects", doc16 Caso 4)

RELATED_ENTITIES: projetos

EVIDENCE: doc05 (TABLE_ENDPOINT), doc16 Caso 4, doc32
```

### DOMAIN: accounting

```text
RESPONSIBILITY: contabilidade — categorias financeiras hierárquicas (árvore, busca, regras de sugestão automática), transações e notas fiscais

HTTP_ENDPOINTS:
- GET/POST/PATCH/DELETE /financial-categories (+ /tree, /${id}, /${id}/descendants, /${id}/ancestors, /search, /${id}/move, /${id}/reorder, /${id}/archive, /${id}/restore, /${id}/merge, /suggest) — 15 variações
- GET/POST/PATCH/DELETE /financial-categories/rules(/${id}) — 4 variações
- DELETE /financial-categories/category-1 [teste]
(total: 20 endpoints únicos)
Entidades servidas via core-entities-gateway (sem linha própria no inventário): transacoes → /transactions, notas_fiscais → /invoices, regras_financeiras → /financial-rules

REALTIME_EVENTS:
- finance.transaction.created
- finance.transaction.updated
- finance.calculated

FRONTEND_CONSUMERS: modules/accounting/services/{financial-categories,accounting}.service.ts, RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE confirmado explicitamente nos 9 casos do doc16 (accounting citado na matriz de documentação, sem Caso dedicado)

RELATED_ENTITIES: transacoes, notas_fiscais, regras_financeiras, financial_categories, categorias_financeiras

EVIDENCE: doc05 (20 linhas dedicadas + TABLE_ENDPOINT), doc33 (eventos finance.*), doc23 (achado do falso-positivo /financial-rules vs. localStorage de regras)
```

### DOMAIN: billing

```text
RESPONSIBILITY: assinatura/plano do próprio tenant, faturas, checkout e portal de cobrança

HTTP_ENDPOINTS:
- GET /billing/subscription
- GET /billing/plans
- GET /billing/invoices
- POST /billing/checkout
- POST /billing/portal
- GET /public/activation-plans

REALTIME_EVENTS:
- billing:plan_upgraded
- billing:trial_ending (sem consumidor, doc33)
- billing:payment_failed (sem consumidor, doc33)
- billing:cancelled

FRONTEND_CONSUMERS: app/providers/BillingContext.tsx, modules/integrations/hooks/useStripe.ts, modules/integrations/clients/stripe.client.ts, modules/settings/services/{billing-plans,billing-invoices}.service.ts, modules/settings/pages/Billing.tsx, modules/auth/services/activation-plans.service.ts

AUTH_REQUIRED: MISTO (SIM para os 5 primeiros; NÃO para /public/activation-plans, publicApi)
TENANT_SCOPED: MISTO (mesma razão)
PERMISSIONS_FOUND: NONE (gate por autenticação simples, sem permissão de módulo dedicada identificada)

RELATED_ENTITIES: N/A (billing não é uma tabela TABLE_ENDPOINT)

EVIDENCE: doc05, doc33 (eventos billing:*)
```

### DOMAIN: admin-billing

```text
RESPONSIBILITY: administração cross-tenant de billing (super-admin) — assinaturas, tenants, planos, overrides

HTTP_ENDPOINTS:
- GET /billing/admin/subscriptions
- GET /billing/admin/tenants
- PATCH /billing/admin/tenants/${tenantId}
- POST /billing/admin/tenants/${tenantId}/suspend
- POST /billing/admin/tenants/${tenantId}/reactivate
- POST /billing/admin/tenants/${tenantId}/override
- POST /billing/admin/tenants/${tenantId}/override/remove
- GET /billing/admin/invoices${suffix}
- GET /billing/plans?includeInactive=true
- POST /billing/plans
- PATCH /billing/plans/${plan.id}
- PATCH /billing/plans/${id}
- POST /billing/plans/${id}/sync-stripe
(13 endpoints únicos)

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/admin/services/{admin-billing,admin-tenants,admin-plans}.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE por permissão de módulo — gate é por rota administrativa inteira (AdminRoute/SuperAdminGuard, doc18), não por RequirePermission individual

RELATED_ENTITIES: N/A

EVIDENCE: doc05 (13 linhas dedicadas), doc18 (AdminRoute/SuperAdminGuard)
```

### DOMAIN: support

```text
RESPONSIBILITY: tickets de suporte ao cliente (visão do usuário e do admin)

HTTP_ENDPOINTS:
- GET /support-tickets?limit=200
- POST /support-tickets
- PATCH /support-tickets/${id}

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/support/hooks/useSupport.ts, modules/admin/services/admin-support.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE identificado

RELATED_ENTITIES: support_tickets

EVIDENCE: doc05
```

### DOMAIN: audit

```text
RESPONSIBILITY: trilha de auditoria e histórico de atividades do tenant (visão do usuário e do admin)

HTTP_ENDPOINTS:
- GET /audit-logs?limit=200
- GET /audit-logs?limit=${limit}
- GET \audit-logs${qs} [ANOMALIA de path já registrada no doc05, não corrigida]
- GET /activity-logs?entityType=${...}&entityId=${...}
- POST /activity-logs

REALTIME_EVENTS:
- audit.entry.created

FRONTEND_CONSUMERS: modules/admin/services/admin-audit.service.ts, modules/dashboard/hooks/useActivityHistory.ts, modules/settings/hooks/useAuditTrail.ts, modules/workspace/hooks/useWorkspace.ts, modules/marketing/services/marketing.service.ts (POST), useRealtimeSync.ts, Dashboard.tsx

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: módulo "audit" documentado em governance/permissions.ts (leitura restrita a owner/admin/manager, doc15) — sem Caso individual resolvido no doc16

RELATED_ENTITIES: audit_logs

EVIDENCE: doc05, doc33 (audit.entry.created)
```

### DOMAIN: leads

```text
RESPONSIBILITY: captação e pipeline comercial de leads (CRM)

HTTP_ENDPOINTS:
- GET /leads?limit=200
- POST /leads
- PATCH /leads/${id}
- DELETE /leads/${id}

REALTIME_EVENTS:
- crm.lead.captured
- crm.lead.converted

FRONTEND_CONSUMERS: modules/leads/services/leads.service.ts, RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: módulo "leads" documentado na matriz (governance/permissions.ts) — sem Caso individual nos 9 do doc16

RELATED_ENTITIES: leads, lead_interactions (TABLE_ENDPOINT, sem linha própria confirmada no inventário)

EVIDENCE: doc05, doc33 (eventos crm.lead.*)
```

### DOMAIN: clients

```text
RESPONSIBILITY: gestão de clientes/contatos (CRM), incluindo timeline, contratos vinculados e anexos

HTTP_ENDPOINTS:
- GET /clients${qs}
- POST /clients
- PATCH /clients/${id}
- DELETE /clients/${id}
- GET /clients/${clientId}/timeline
- POST /clients/${clientId}/timeline
- GET /clients/${clientId}/contracts
- GET /clients/${clientId}/attachments
- DELETE /clients/${clientId}/attachments/${attachmentId}

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/crm-relationships/services/clients.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: módulo "crm" documentado na matriz — sem Caso individual nos 9 do doc16

RELATED_ENTITIES: clientes, contatos (TABLE_ENDPOINT, mesmo destino /clients)

EVIDENCE: doc05 (9 linhas dedicadas)
```

### DOMAIN: company-settings

```text
RESPONSIBILITY: dados cadastrais e identidade visual (logo) da empresa do próprio tenant

HTTP_ENDPOINTS:
- GET /company-settings
- PATCH /company-settings
- DELETE /workspaces/${workspaceId}/logo
- POST ${API_BASE_URL}/api/v1/workspaces/${workspaceId}/logo [multipart]

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/settings/hooks/useCompanySettings.ts, modules/settings/services/company-logo.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM (INCERTO para o upload multipart especificamente, já registrado no doc34/37)
PERMISSIONS_FOUND: módulo "settings" documentado na matriz — sem Caso individual nos 9 do doc16

RELATED_ENTITIES: N/A

EVIDENCE: doc05
```

### DOMAIN: users

```text
RESPONSIBILITY: gestão de usuários do tenant, convites e atribuição de papel a um usuário

HTTP_ENDPOINTS:
- GET /users?limit=100&offset=0
- GET /users?limit=100
- PATCH /users/${id}
- PATCH /users/${id}/role
- PATCH /users/${userId}/role
- GET /users/invitations
- POST /users/invitations
- DELETE /users/invitations/${id}
- POST /users/invitations/${id}/resend

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/settings/hooks/{useUsuarios,useRoles}.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: módulo "settings" (gestão de usuários é parte da administração do tenant, doc15) — sem Caso individual nos 9 do doc16

RELATED_ENTITIES: usuarios, users, org_members (TABLE_ENDPOINT, mesmo destino /users)

EVIDENCE: doc05 (9 linhas dedicadas)
```

### DOMAIN: rbac

```text
RESPONSIBILITY: definição de papéis (roles) customizados, catálogo de permissões e concessões (grants) de RBAC

HTTP_ENDPOINTS:
- GET /rbac/roles?includeArchived=true
- GET /rbac/permissions
- GET /rbac/grants
- GET /rbac/roles/${roleId}
- POST /rbac/roles
- PATCH /rbac/roles/${id}
- POST /rbac/roles/${id}/duplicate
- POST /rbac/roles/${id}/archive
- POST /rbac/roles/${id}/restore
- POST /rbac/roles/${roleId}/inheritance
- DELETE /rbac/roles/${roleId}/inheritance/${parentRoleId}
- POST /rbac/roles/${roleId}/permissions/${permissionId}
- DELETE /rbac/roles/${roleId}/permissions/${permissionId}

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/settings/hooks/useRoles.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: fonte primária de todo o modelo RBAC do frontend (doc15/16 — GET /auth/context + este domínio alimentam `usePermissions.ts`)

RELATED_ENTITIES: N/A

EVIDENCE: doc05 (13 linhas dedicadas), doc15/16
```

### DOMAIN: integrations

```text
RESPONSIBILITY: conectividade com plataformas externas de streaming/marketing/direitos autorais (status, autenticação, configuração, métricas) e reconhecimento de áudio (ACRCloud)

HTTP_ENDPOINTS (41 endpoints únicos):
- TikTok (7): status, auth, disconnect, ads/status, ads/configure, ads/disconnect, ads/campaigns
- Deezer (2): artist/${id}, artist/${id}/top
- YouTube (2): channel/${id}, video/${id}
- SoundCloud (5): status, configure, disconnect, user?url, track/${id}
- Instagram (4): status, auth, metrics, disconnect
- Google Ads (5): status, configure, auth, disconnect, campaigns
- Apple Music (4): status, configure, disconnect, artist/${id}?storefront
- Abramus (6): status, configure, disconnect, search-work, search-artist, register-work
- Spotify (3): auth, disconnect, sync-artist
- OAuth genérico (2): oauth/status?platform=, oauth/disconnect?platform=
- ACRCloud (1): acrcloud/recognize [resolvido no doc35/36 — FRONTEND_CONTRACT_WINS]

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/integrations/hooks/use{TikTok,TikTokAds,Deezer,YouTube,SoundCloud,Instagram,GoogleAds,AppleMusic,Abramus,Spotify,MarketingOAuth,ACRCloud}.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE confirmado nos 9 casos do doc16 (não fazia parte do escopo resolvido)

RELATED_ENTITIES: N/A (não são tabelas TABLE_ENDPOINT — sub-rotas de integrations)

EVIDENCE: doc05 (41 linhas), doc18 (10 provedores auditados), doc35/36 (ACRCloud)
```

### DOMAIN: ai

```text
RESPONSIBILITY: geração de conteúdo assistida por IA (texto/copy/briefing/insights) para uso em marketing e contratos

HTTP_ENDPOINTS:
- POST /ai/generate [via providerRouter.ts, já CANONICAL desde doc34]
- POST /api/v1/ai/generate [via useAI.ts + semantic-parser.service.ts — mesma linha do inventário de 250, resolvida no doc35 para o mesmo destino final de /ai/generate]

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/marketing/ai/providers/providerRouter.ts, shared/hooks/useAI.ts, modules/contracts/services/semantic-parser.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE identificado no frontend (o backend real usa RequireRole('editor'), achado do doc35 — não é uma "permission" no sentido RBAC do frontend, é role hierárquica)

RELATED_ENTITIES: N/A

EVIDENCE: doc05, doc35 (resolução), doc36
```

### DOMAIN: conversations

```text
RESPONSIBILITY: atendimento ao cliente via conversas (inbox multicanal) e automação de musicchat — domínio de CRM/suporte, distinto do "MusicChat" de comunicação interna (ver Exceções Funcionais)

HTTP_ENDPOINTS (14 endpoints únicos):
- GET /conversations?limit=200
- GET /conversations/${id}/messages?limit=200
- POST /conversations/${id}/messages
- POST /conversations/${id}/notes
- PATCH /conversations/${id}
- PATCH /conversations/${id}/transfer
- PATCH /conversations/${id}/close
- PATCH /conversations/${id}/reopen
- DELETE /conversations/${id}
- GET ${BASE}/settings
- PATCH ${BASE}/settings
- POST ${BASE}/inbound
- POST ${BASE}/escalations/run
- GET ${BASE}/events${query}

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/musicchat/services/{conversations,musicchat-automation}.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE identificado

RELATED_ENTITIES: N/A

EVIDENCE: doc05 (14 linhas), doc20/26 (desambiguação explícita deste domínio vs. "MusicChat")
```

### DOMAIN: marketing

```text
RESPONSIBILITY: planejamento e execução de marketing — projetos, campanhas, conteúdos, briefings, tarefas, assets criativos, metas de artista, sugestões de IA

HTTP_ENDPOINTS (35 endpoints únicos):
- Projetos (4): POST/GET/PATCH/DELETE /marketing/projects(/${id})
- Campanhas (4): POST draft, GET/PATCH /${id}, POST /${id}/archive
- Conteúdos (3): POST /marketing/contents, PATCH/DELETE /${id}
- Briefings (4): POST/GET/PATCH/DELETE /briefings(/${id})
- Tarefas (4): POST/GET/PATCH/DELETE /marketing/tasks(/${id})
- Assets (9): GET/${id} (4 call sites, 1 endpoint), GET /${id}/approvals, GET /${row.id}/versions, GET project/${id}/library, POST /marketing/assets (3 call sites), PATCH /${id} (3 call sites), DELETE /${id}, POST /${id}/request-approval, POST approvals/${id}/decision
- Config/IA (3): GET campaign-builder/config, GET/POST ai-suggestions
- Metas de artista (4): POST/GET/PATCH/DELETE /artist-goals(/${id})

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/marketing/services/marketing.service.ts, modules/marketing/hooks/{useMetas,useMarketingAssets}.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: módulo "marketing" documentado na matriz — sem Caso individual nos 9 do doc16

RELATED_ENTITIES: campanhas, marketing_projects, conteudos, briefings, metas_artistas (TABLE_ENDPOINT — mas todos os endpoints reais deste domínio já têm linha própria dedicada, não passam pelo core-entities-gateway)

EVIDENCE: doc05 (35 linhas dedicadas — maior domínio do inventário)
```

### DOMAIN: audiovisual

```text
RESPONSIBILITY: produção audiovisual — projetos, briefing, deliverables, shots, dias de produção, equipe, assets, tarefas, aprovações

HTTP_ENDPOINTS (40 endpoints únicos — ver doc34 seção A.14 para a lista completa por sub-recurso: projetos(7), briefing(2), deliverables(6), shots(5), production-days(4), team(4), assets(4), tasks(4), approvals(4))

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/audiovisual/services/audiovisual.service.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE identificado nos 9 casos do doc16 (módulo não coberto pelos casos resolvidos)

RELATED_ENTITIES: N/A (não são tabelas TABLE_ENDPOINT — domínio 100% via API REST dedicada)

EVIDENCE: doc05 (40 linhas dedicadas — segundo maior domínio do inventário)
```

### DOMAIN: reports

```text
RESPONSIBILITY: relatórios cross-entidade — listagem de entidades/definições reportáveis, importação (validação/commit/template) e exportação de dados

HTTP_ENDPOINTS:
- GET /reports/entities
- GET /reports/definitions
- POST /reports/entities/${entity}/import/validate
- POST /reports/entities/${entity}/import/commit
- GET ${API_BASE_URL}/api/v1/reports/entities/${entity}/export [binário/Blob]
- GET ${API_BASE_URL}/api/v1/reports/entities/${entity}/import/template [binário/Blob]

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/reports/services/reports-api.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM (INCERTO para os 2 SPECIALIZED binários, já registrado no doc34)
PERMISSIONS_FOUND: NONE identificado

RELATED_ENTITIES: N/A (cross-domain por design — opera sobre entidades de outros domínios)

EVIDENCE: doc05 (6 linhas)
```

### DOMAIN: notifications

```text
RESPONSIBILITY: caixa de notificações do usuário

HTTP_ENDPOINTS:
- PATCH /notifications/read-all

REALTIME_EVENTS:
- notification:new

FRONTEND_CONSUMERS: shared/components/MainLayout.tsx, RealtimeLayer.tsx

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE identificado

RELATED_ENTITIES: N/A

EVIDENCE: doc05, doc33 (notification:new)
```

### DOMAIN: dashboard

```text
RESPONSIBILITY: painel operacional consolidado (métricas agregadas de todos os domínios)

HTTP_ENDPOINTS:
- GET /analytics/dashboard

REALTIME_EVENTS: NONE (o dashboard consome eventos de outros domínios via useRealtimeSync/Dashboard.tsx, mas não possui evento próprio)

FRONTEND_CONSUMERS: modules/dashboard/hooks/useOperationalDashboard.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE identificado

RELATED_ENTITIES: N/A (agregador cross-domain)

EVIDENCE: doc05
```

---

## Domínios de infraestrutura

### DOMAIN: auth (INFRASTRUCTURE)

```text
RESPONSIBILITY: autenticação, sessão, bootstrap de contexto de tenant/permissões e onboarding

HTTP_ENDPOINTS:
- PATCH /auth/provision-workspace
- POST /auth/change-required-password
- GET /auth/context
- PATCH /auth/onboarding

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: app/providers/{AuthContext,TenantContext}.tsx, modules/auth/pages/Onboarding.tsx

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE (é a própria fonte da sessão/permissões, não é gated por permissão)

EVIDENCE: doc05, doc15 (GET /auth/context é a fonte de membership.permissions)
```

### DOMAIN: oauth-bridge (INFRASTRUCTURE)

```text
RESPONSIBILITY: mediação segura de troca de código OAuth para as integrações externas (nonce/exchange_token), sem expor client_secret nem token ao browser

HTTP_ENDPOINTS:
- POST ${API_BASE_URL}/api/v1/integrations/oauth/init
- POST ${API_BASE_URL}/api/v1/integrations/oauth/exchange
- GET ${apiBase}${backendPath} [redirect Spotify via backend]

REALTIME_EVENTS:
- musicos360_oauth_success (postMessage)

FRONTEND_CONSUMERS: modules/settings/pages/Configuracoes.tsx, modules/integrations/components/MarketingOAuthDialog.tsx, modules/integrations/pages/{OAuthCallbackPage,OAuthPopupPage}.tsx

AUTH_REQUIRED: MISTO (init: SIM; exchange: NÃO, doc17/30)
TENANT_SCOPED: NÃO (explicitamente, doc05/30)
PERMISSIONS_FOUND: NONE

EVIDENCE: doc17, doc30, doc31
```

### DOMAIN: uploads (INFRASTRUCTURE)

```text
RESPONSIBILITY: upload de arquivos para armazenamento de objetos (Cloudflare R2) via URL pré-assinada

HTTP_ENDPOINTS:
- POST /uploads/presign
- POST /uploads/${fileId}/confirm
- PUT presign.presignedUrl [destino R2, não apps/api]

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: shared/hooks/useUploadToR2.ts

AUTH_REQUIRED: MISTO (2 primeiros SIM; PUT ao R2 NÃO — URL assinada)
TENANT_SCOPED: SIM (2 primeiros)
PERMISSIONS_FOUND: NONE

EVIDENCE: doc05
```

### DOMAIN: workspace-panel (INFRASTRUCTURE)

```text
RESPONSIBILITY: resolução genérica de um "workspace" (painel de detalhe) para qualquer tipo de entidade, via mapa de rotas — não é uma entidade de negócio própria

HTTP_ENDPOINTS:
- GET ${ENTITY_ROUTE_MAP[workspaceType]}/${workspaceId}

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: modules/workspace/hooks/useWorkspace.ts

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE

EVIDENCE: doc05
```

### DOMAIN: core-entities-gateway (INFRASTRUCTURE)

```text
RESPONSIBILITY: wrapper HTTP genérico (`shared/lib/storage.ts`) que resolve uma tabela lógica para uma das 45 rotas de `TABLE_ENDPOINT` em runtime — mecanismo técnico, não uma responsabilidade de negócio própria; os domínios de negócio reais que ele serve estão listados individualmente acima (artists, works, phonograms, shares, contracts, releases, events, inventory, hr, licensing, projects, accounting-transações/notas-fiscais)

HTTP_ENDPOINTS:
- GET ${resolved.ep}${qs}
- GET ${resolved.ep}/${id}
- POST ${resolved.ep}
- PATCH ${resolved.ep}/${id}
- DELETE ${resolved.ep}/${id}

REALTIME_EVENTS: NONE (os eventos de domínio das entidades servidas estão listados nos respectivos domínios de negócio, não aqui)

FRONTEND_CONSUMERS: shared/lib/storage.ts (usado por 13 *.service.ts, doc32)

AUTH_REQUIRED: SIM
TENANT_SCOPED: SIM
PERMISSIONS_FOUND: NONE (permissões são checadas por domínio de negócio na UI, não neste wrapper)

EVIDENCE: doc05, doc12, doc32
```

### DOMAIN: external-lookups (INFRASTRUCTURE)

```text
RESPONSIBILITY: consultas a serviços de terceiros não pertencentes a apps/api (CEP, geolocalização, anexos já resolvidos) — não fazem parte do contrato que uma API v2 precisaria implementar

HTTP_ENDPOINTS:
- GET https://viacep.com.br/ws/${cep}/json/
- GET ${IBGE_BASE}/localidades/estados/${uf}/municipios
- GET ${NOMINATIM_BASE}/search
- GET attachment.url

REALTIME_EVENTS: NONE

FRONTEND_CONSUMERS: shared/lib/masks.ts, modules/marketing/components/campaign-builder/useIbgeLocations.ts, shared/components/ChatAttachment.tsx

AUTH_REQUIRED: NÃO (serviços de terceiros, sem relação com a auth do MUSIC OS 360)
TENANT_SCOPED: NÃO
PERMISSIONS_FOUND: NONE

EVIDENCE: doc05, doc30 (mesma natureza "third-party" já registrada)
```

---

## Exceções Funcionais (preservadas sem alteração, doc37)

```text
Supabase Auth: mantido diretamente no frontend
Supabase Realtime: pode permanecer direto conforme decisão já documentada
Distribuidoras: integração futura via API oficial por tenant quando disponível
MusicChat: fora do escopo inicial da API v2
PENDING_TABLES: nenhum exige API v2 no estado atual
Mocks: nenhum exige API v2
Memory: nenhum exige API v2
Storage local: 6 casos exigem API v2 (docs 19-24), não recontados como domínios HTTP aqui
Serviços externos: nenhuma integração OAuth exige mudança
```

---

## Resumo

```text
TOTAL_DOMAINS:
35

BUSINESS_DOMAINS:
29

INFRASTRUCTURE_DOMAINS:
6

HTTP_ENDPOINTS_CLASSIFIED:
250

HTTP_ENDPOINTS_UNCLASSIFIED:
0

REALTIME_EVENTS_CLASSIFIED:
22

REALTIME_EVENTS_UNCLASSIFIED:
0

DOMAINS_WITH_REALTIME:
10

DOMAINS_WITH_EXPLICIT_PERMISSIONS:
9
```

`BUSINESS_DOMAINS` (29): artists, works, phonograms, shares, contracts, releases, events, inventory, hr, licensing, projects, accounting, billing, admin-billing, support, audit, leads, clients, company-settings, users, rbac, integrations, ai, conversations, marketing, audiovisual, reports, notifications, dashboard. `INFRASTRUCTURE_DOMAINS` (6): auth, oauth-bridge, uploads, workspace-panel, core-entities-gateway, external-lookups. `DOMAINS_WITH_REALTIME` (10): artists, works, phonograms, contracts, releases, accounting, billing, leads, notifications, oauth-bridge. `DOMAINS_WITH_EXPLICIT_PERMISSIONS` (9): artists, works, phonograms, events, inventory, hr, licensing, projects, rbac — os domínios com um `Caso` de permissão explicitamente resolvido nos docs 15/16 (catalog cobre works+phonograms com o mesmo Caso 6); os demais domínios têm módulo documentado na matriz de `governance/permissions.ts` mas sem um dos 9 Casos individuais resolvidos, por isso registrados como `NONE` (não inventado).

## Cobertura

250/250 endpoints HTTP classificados em exatamente 1 domínio cada, reconciliação linha a linha contra a Visão Consolidada do doc05 (preservada pelos docs 34/37) com soma conferida = 250. 22/22 eventos realtime classificados. Nenhuma dependência entre domínios, ordem de implementação, módulo técnico, tabela, FK, migration, repository, service ou controller foi definida — reservado para etapas posteriores. `apps/web` e `apps/api` não foram alterados. Nenhum doc anterior foi modificado.

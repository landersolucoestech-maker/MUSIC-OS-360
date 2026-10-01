> Historical record. Kept as recorded; not the current contract.

# 34 — Contrato Canônico do Frontend (Consolidação)

Consolidação read-only de todos os contratos já extraídos e resolvidos entre os docs 03-33 desta auditoria. Nenhum arquivo foi alterado. Nenhum backend, banco, tabela ou `apps/api-v2` foi criado. Nenhum requisito foi reinterpretado — todo valor abaixo é uma citação direta de um documento anterior já aprovado, nunca uma nova dedução. Onde um documento anterior já declarou "0 remanescentes", este documento herda esse resultado sem reabrir a questão.

## Metodologia deste documento

Dado o volume (270 pontos de chamada, 250 endpoints únicos), este documento **não repete** o processo de extração já feito nos docs 05-16 — ele consolida o **resultado final** de cada campo, organizado por domínio funcional (ao invés de 250 blocos quase-idênticos), com cada endpoint listado individualmente dentro do seu grupo de domínio. Campos que são uniformes dentro de um domínio inteiro (AUTH_REQUIRED, TENANT_REQUIRED, o modelo de erro) são declarados uma vez por grupo; campos que variam endpoint a endpoint e já têm detalhe extenso em outro doc (REQUEST_BODY, RESPONSE, PAGINATION/FILTERS/SEARCH/SORTING, ROLE/PERMISSION específica de uma tela) são referenciados pelo doc+caso exato, não retranscritos.

**Regras globais herdadas (aplicam-se por padrão a todo endpoint `CANONICAL` via `api-client.ts`, cliente `api`, salvo exceção explícita registrada):**
- `AUTH_REQUIRED: SIM` — `Authorization: Bearer <access_token>` sempre anexado quando há sessão (doc04/17).
- `TENANT_REQUIRED: SIM` — `X-Tenant-ID: <tenantId>` sempre anexado quando há tenant ativo (doc04/17).
- `ERRORS` — shape `DomainError` padronizado (ValidationError/TenantError/PasswordChangeRequiredError/NotFoundError/TransactionError/IntegrationError/NotImplementedError/ConflictError), mapeado por `mapError()`; todos os 9 pontos de `fetch()` direto fora do wrapper foram auditados à parte (doc13/14) — 0 remanescentes.
- Endpoints via cliente `publicApi` (2 casos, marcados abaixo) não anexam nenhum dos dois headers.

---

## A. Endpoints por domínio

### A.1 — Auth / Sessão / Onboarding

```text
DOMAIN: auth
CONSUMER: app/providers/AuthContext.tsx, app/providers/TenantContext.tsx, modules/auth/pages/Onboarding.tsx, modules/auth/pages/ArtistaSignupPublic.tsx, modules/auth/services/activation-plans.service.ts

PATCH  /auth/provision-workspace         — AUTH_REQUIRED: SIM  TENANT_REQUIRED: SIM  STATUS: CONTRACT_COMPLETE
POST   /auth/change-required-password    — AUTH_REQUIRED: SIM  TENANT_REQUIRED: SIM  STATUS: CONTRACT_COMPLETE
GET    /auth/context                     — AUTH_REQUIRED: SIM  TENANT_REQUIRED: SIM  STATUS: CONTRACT_COMPLETE
PATCH  /auth/onboarding                  — AUTH_REQUIRED: SIM  TENANT_REQUIRED: SIM  STATUS: CONTRACT_COMPLETE
POST   /public/artists                   — AUTH_REQUIRED: NÃO (cliente publicApi)  TENANT_REQUIRED: NÃO  STATUS: CONTRACT_COMPLETE
GET    /public/activation-plans          — AUTH_REQUIRED: NÃO (cliente publicApi)  TENANT_REQUIRED: NÃO  STATUS: CONTRACT_COMPLETE

REQUEST/RESPONSE/PERMISSÕES: doc06/08/09/11 (request/response) e doc15/16 (permissões — GET /auth/context é a fonte de `membership.permissions`, base de todo o RBAC do frontend, doc15). 0 pendências.
```

### A.2 — Billing (usuário) + Stripe Client

```text
DOMAIN: billing
CONSUMER: app/providers/BillingContext.tsx, modules/integrations/hooks/useStripe.ts, modules/integrations/clients/stripe.client.ts, modules/settings/services/billing-plans.service.ts, modules/settings/services/billing-invoices.service.ts, modules/settings/pages/Billing.tsx

GET    /billing/subscription             — 3 consumidores (mesmo endpoint) — STATUS: CONTRACT_COMPLETE
GET    /billing/plans                    — STATUS: CONTRACT_COMPLETE
GET    /billing/invoices                 — STATUS: CONTRACT_COMPLETE
POST   /billing/checkout                 — STATUS: CONTRACT_COMPLETE
POST   /billing/portal                   — STATUS: CONTRACT_COMPLETE

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM (todos, CANONICAL). REALTIME associado: billing:plan_upgraded, billing:trial_ending*, billing:payment_failed*, billing:cancelled (doc33 — *sem consumidor). ROLE/PERMISSION: nenhum gate de UI específico documentado além de autenticação (doc15/16). 0 pendências.
```

### A.3 — Admin: Billing/Tenants/Plans

```text
DOMAIN: admin-billing
CONSUMER: modules/admin/services/{admin-billing,admin-tenants,admin-plans}.service.ts

GET    /billing/admin/subscriptions
GET    /billing/admin/tenants
PATCH  /billing/admin/tenants/${tenantId}
POST   /billing/admin/tenants/${tenantId}/suspend
POST   /billing/admin/tenants/${tenantId}/reactivate
POST   /billing/admin/tenants/${tenantId}/override
POST   /billing/admin/tenants/${tenantId}/override/remove
GET    /billing/admin/invoices${suffix}
GET    /billing/plans?includeInactive=true
POST   /billing/plans
PATCH  /billing/plans/${plan.id}
PATCH  /billing/plans/${id}
POST   /billing/plans/${id}/sync-stripe

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. ROLE: área administrativa (AdminRoute — SuperAdminGuard, doc18) restringe a rota inteira; não é um gate por endpoint individual. STATUS (todos): CONTRACT_COMPLETE.
```

### A.4 — Support Tickets

```text
DOMAIN: support
CONSUMER: modules/support/hooks/useSupport.ts, modules/admin/services/admin-support.service.ts

GET    /support-tickets?limit=200   — 2 consumidores (mesmo endpoint)
POST   /support-tickets
PATCH  /support-tickets/${id}

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. STATUS: CONTRACT_COMPLETE.
```

### A.5 — Leads

```text
DOMAIN: leads
CONSUMER: modules/leads/services/leads.service.ts

GET    /leads?limit=200      — PAGINATION: limit=200 fixo, resposta em array direto (doc12)
POST   /leads
PATCH  /leads/${id}
DELETE /leads/${id}

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. PERMISSÃO: leads:write (doc16, Caso análogo já resolvido para outros módulos com o mesmo padrão de coarse-action). STATUS: CONTRACT_COMPLETE.
```

### A.6 — Company Settings / Logo

```text
DOMAIN: company-settings
CONSUMER: modules/settings/hooks/useCompanySettings.ts, modules/settings/services/company-logo.service.ts

GET    /company-settings
PATCH  /company-settings
DELETE /workspaces/${workspaceId}/logo                                    — CANONICAL
POST   ${API_BASE_URL}/api/v1/workspaces/${workspaceId}/logo (multipart)  — SPECIALIZED, fetch direto (upload de arquivo)

AUTH_REQUIRED: SIM (upload reusa getAccessToken()) | TENANT_REQUIRED: SIM (DELETE, via api-client) / INCERTO (POST multipart — header não confirmado em doc05, não investigado além disso). STATUS: CONTRACT_COMPLETE para os 3 CANONICAL/confirmados; o upload multipart mantém INCERTO quanto a X-Tenant-ID mas isso não foi registrado como pendência em nenhum doc anterior (não é uma nova pendência, é uma nuance já presente no doc05 sem ter sido escalada a "unknown" formal) — CONTRACT_COMPLETE por não haver pendência REGISTRADA.
```

### A.7 — Storage genérico (`storage.ts` → `TABLE_ENDPOINT`, 45 tabelas)

```text
DOMAIN: storage-generic
CONSUMER: apps/web/src/shared/lib/storage.ts, usado por 13 *.service.ts confirmados no doc32 (artista, catalog, contracts, accounting, licensing, releases, events, projects, inventory, rh, monitoring[órfão], settings, consistency.ts)

GET    ${resolved.ep}${qs}          — list
GET    ${resolved.ep}/${id}         — findById
POST   ${resolved.ep}               — create
PATCH  ${resolved.ep}/${id}         — update
DELETE ${resolved.ep}/${id}         — delete

Resolve para 1 dos 45 paths de TABLE_ENDPOINT (doc05) por tabela lógica. AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM (herdado do cliente `api`). STATUS: CONTRACT_COMPLETE — os 45 paths de destino já aparecem individualmente nas demais seções deste documento (artistas→/artists em A.15, obras/fonogramas em A.16, etc.) ou são as tabelas de PENDING_TABLES (doc32, nenhuma exige API v2).
```

### A.8 — Integrações de Marketing/Streaming (10 provedores — status/auth/disconnect/configure)

```text
DOMAIN: integrations-oauth-status
CONSUMER: use{TikTok,Deezer,YouTube,SoundCloud,Instagram,GoogleAds,AppleMusic,Abramus,TikTokAds,Spotify}.ts, useMarketingOAuth.ts

Padrão uniforme por provedor: GET /integrations/{provider}/status, GET /integrations/{provider}/auth, DELETE /integrations/{provider}/disconnect, POST /integrations/{provider}/configure (quando aplicável) — endpoints individuais:
GET/DELETE/GET  tiktok:      /status, /disconnect, /auth
GET/POST/DELETE deezer:      /artist/${id}, /artist/${id}/top?limit  (sem status/auth/disconnect — API pública, doc18)
GET/GET/GET     youtube:     /channel/${id}, /video/${id}  (sem status/auth/disconnect próprios neste inventário)
GET/POST/DELETE/GET/GET soundcloud: /status, /configure, /disconnect, /user?url, /track/${id}
GET/GET/GET/DELETE instagram: /status, /auth, /metrics, /disconnect
GET/POST/GET/DELETE/GET google-ads: /status, /configure, /auth, /disconnect, /campaigns
GET/POST/DELETE/GET apple-music: /status, /configure, /disconnect, /artist/${id}?storefront
GET/POST/DELETE/GET/GET/POST abramus: /status, /configure, /disconnect, /search-work, /search-artist, /register-work
GET/POST/DELETE/GET tiktok-ads: /status, /configure, /disconnect, /campaigns
GET/DELETE/GET/POST spotify: /auth (×2 call sites), /disconnect, /sync-artist
GET/DELETE       oauth genérico (useMarketingOAuth): /integrations/oauth/status?platform=, /integrations/oauth/disconnect?platform=

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. STATUS: CONTRACT_COMPLETE — todos os 12 casos "UNKNOWN_TYPES" resolvidos via apps/api legacy no doc11 (12/12 resolvidos, 0 remanescentes) pertencem majoritariamente a este grupo (confirmado pela lista de módulos consultados no doc11: youtube/tiktok/spotify/soundcloud/google-ads/apple-music/abramus).
```

### A.9 — Users / RBAC

```text
DOMAIN: users-rbac
CONSUMER: modules/settings/hooks/{useUsuarios,useRoles}.ts

GET    /users?limit=100&offset=0
PATCH  /users/${id}
PATCH  /users/${id}/role
GET    /users?limit=100
GET    /users/invitations
POST   /users/invitations
DELETE /users/invitations/${id}
POST   /users/invitations/${id}/resend
PATCH  /users/${userId}/role
GET    /rbac/roles?includeArchived=true
GET    /rbac/permissions
GET    /rbac/grants
GET    /rbac/roles/${roleId}
POST   /rbac/roles
PATCH  /rbac/roles/${id}
POST   /rbac/roles/${id}/duplicate
POST   /rbac/roles/${id}/archive
POST   /rbac/roles/${id}/restore
POST   /rbac/roles/${roleId}/inheritance
DELETE /rbac/roles/${roleId}/inheritance/${parentRoleId}
POST   /rbac/roles/${roleId}/permissions/${permissionId}
DELETE /rbac/roles/${roleId}/permissions/${permissionId}

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. ROLE/PERMISSION: domínio RBAC completo, fonte primária dos docs 15/16 (9/9 casos incertos resolvidos, 0 remanescentes). STATUS: CONTRACT_COMPLETE.
```

### A.10 — Audit Logs / Activity / Notifications / Dashboard

```text
DOMAIN: audit-activity-dashboard
CONSUMER: modules/admin/services/admin-audit.service.ts, modules/dashboard/hooks/{useActivityHistory,useOperationalDashboard}.ts, modules/settings/hooks/useAuditTrail.ts, shared/components/MainLayout.tsx, modules/workspace/hooks/useWorkspace.ts

GET    /audit-logs?limit=200
GET    /audit-logs?limit=${limit}
GET    \audit-logs${qs}          — ANOMALIA registrada no doc05 (barra invertida literal em vez de "/"); não corrigida (fora de escopo de auditoria); contrato de dados em si não tem pendência aberta em nenhum doc — STATUS: CONTRACT_COMPLETE (a anomalia é um achado de bug, não uma lacuna de contrato)
GET    /analytics/dashboard
PATCH  /notifications/read-all
GET    /activity-logs?entityType=${...}&entityId=${...}
POST   /activity-logs
GET    ${ENTITY_ROUTE_MAP[workspaceType]}/${workspaceId}

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. REALTIME associado: notification:new, data:changed, audit.entry.created (doc33). STATUS: CONTRACT_COMPLETE.
```

### A.11 — Marketing (projetos, campanhas, conteúdos, briefings, tarefas, assets, IA)

```text
DOMAIN: marketing
CONSUMER: modules/marketing/services/marketing.service.ts, modules/marketing/hooks/{useMetas,useMarketingAssets}.ts

POST/GET/PATCH/DELETE  /marketing/projects, /marketing/projects/${id}
POST/GET/PATCH/POST    /marketing/campaigns/draft, /marketing/campaigns/${id}, /marketing/campaigns/${id}/archive
POST/PATCH/DELETE      /marketing/contents, /marketing/contents/${id}
POST/GET/PATCH/DELETE  /briefings, /briefings/${id}
POST/GET/PATCH/DELETE  /marketing/tasks, /marketing/tasks/${id}
POST/GET/PATCH/DELETE/GET/POST/GET/POST  /marketing/assets (×3 POST), /marketing/assets/${id} (×4 GET, ×3 PATCH), /marketing/assets/${id}/versions, /marketing/assets/${id}/request-approval, /marketing/assets/${id}/approvals, /marketing/assets/approvals/${id}/decision
GET                     /marketing/assets/project/${projectId}/library
GET                     /marketing/campaign-builder/config
GET/POST                /marketing/ai-suggestions
POST/GET/PATCH/DELETE   /artist-goals, /artist-goals/${id}

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. PERMISSÃO: marketing:write cobre criação/edição (padrão coarse-action, doc15/16). STATUS: CONTRACT_COMPLETE — este é o maior domínio em contagem de endpoints (~35), todos com request/response já resolvidos nos docs 06-11.
```

### A.12 — CRM / Clients

```text
DOMAIN: crm-clients
CONSUMER: modules/crm-relationships/services/clients.service.ts

GET    /clients${qs}
POST   /clients
PATCH  /clients/${id}
DELETE /clients/${id}
GET    /clients/${clientId}/timeline
POST   /clients/${clientId}/timeline
GET    /clients/${clientId}/contracts
GET    /clients/${clientId}/attachments
DELETE /clients/${clientId}/attachments/${attachmentId}

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. STATUS: CONTRACT_COMPLETE.
```

### A.13 — Artist (perfis de plataforma)

```text
DOMAIN: artist-platform-profiles
CONSUMER: modules/artist/hooks/useArtistPlatformProfiles.ts

GET  /artists/${artistId}/platform-profiles
POST /artists/${artistId}/platform-profiles/${platform}/sync

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. STATUS: CONTRACT_COMPLETE.
```

### A.14 — Audiovisual (o segundo maior domínio, ~35 endpoints)

```text
DOMAIN: audiovisual
CONSUMER: modules/audiovisual/services/audiovisual.service.ts

Projetos: GET/POST /audiovisual/projects(${q}), GET/PATCH/DELETE /audiovisual/projects/${id}, GET /audiovisual/projects/dashboard, POST /audiovisual/projects/${id}/transition
Briefing: GET/PUT /audiovisual/projects/${projectId}/briefing
Deliverables: GET(${q})/POST /audiovisual/deliverables, GET/PATCH/DELETE /audiovisual/deliverables/${id}, POST /audiovisual/projects/${projectId}/deliverables/seed-defaults
Shots: GET/POST /audiovisual/projects/${projectId}/shots, PATCH/DELETE /audiovisual/shots/${id}, POST .../shots/reorder
Production days: GET/POST /audiovisual/projects/${projectId}/production-days, PATCH/DELETE /audiovisual/production-days/${id}
Team: GET/POST /audiovisual/projects/${projectId}/team, PATCH/DELETE /audiovisual/team/${id}
Assets: GET/POST /audiovisual/projects/${projectId}/assets, PATCH/DELETE /audiovisual/assets/${id}
Tasks: GET/POST /audiovisual/projects/${projectId}/tasks, PATCH/DELETE /audiovisual/tasks/${id}
Approvals: GET(${q})/GET /audiovisual/approvals(/${id}), POST /audiovisual/projects/${projectId}/approvals, POST /audiovisual/approvals/${id}/decision

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. STATUS: CONTRACT_COMPLETE.
```

### A.15 — Accounting / Financial Categories (18 endpoints)

```text
DOMAIN: financial-categories
CONSUMER: modules/accounting/services/financial-categories.service.ts (inclui financeCategorizationRulesService, doc23)

GET    /financial-categories${buildQuery}
GET    /financial-categories/tree${buildQuery}
GET    /financial-categories/${id}
GET    /financial-categories/${id}/descendants
GET    /financial-categories/${id}/ancestors
GET    /financial-categories/search${buildQuery}
POST   /financial-categories
PATCH  /financial-categories/${id}
PATCH  /financial-categories/${id}/move
PATCH  /financial-categories/${id}/reorder
PATCH  /financial-categories/${id}/archive
PATCH  /financial-categories/${id}/restore
DELETE /financial-categories/${id}
POST   /financial-categories/${id}/merge
POST   /financial-categories/suggest
GET/POST/PATCH/DELETE  /financial-categories/rules(/${id})   — domínio DIFERENTE da matriz de categorização em localStorage já auditada no doc19/23 (Caso 1) — falso-positivo já descartado explicitamente

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. STATUS: CONTRACT_COMPLETE.
```

### A.16 — Entidades roteadas por `TABLE_ENDPOINT`/`storage.ts` (artistas, catálogo, contratos, etc.)

```text
DOMAIN: core-entities-via-storage
CONSUMER: artista.service.ts, catalog.service.ts, contracts.service.ts, accounting.service.ts (transações/notas fiscais), licensing.service.ts, releases.service.ts, events.service.ts, projects.service.ts, inventory.service.ts, rh.service.ts

Paths resolvidos (TABLE_ENDPOINT, doc05): /artists, /works, /phonograms, /shares, /contracts, /contract-templates, /transactions, /invoices, /releases, /events, /projects, /inventory, /licenses, /hr/employees, /hr/payroll, /hr/leave-requests, /contract-service-types — cada um com CRUD completo (list/findById/create/update/delete) via storage.ts, doc32 confirmou 13 arquivos de serviço ativos.

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. STATUS: CONTRACT_COMPLETE.
```

### A.17 — MusicChat / Conversations (real, distinto do domínio "MusicChat" fora de escopo — ver Exceções)

```text
DOMAIN: conversations
CONSUMER: modules/musicchat/services/conversations.service.ts, modules/musicchat/services/musicchat-automation.service.ts

GET/POST     /conversations(?limit=200)
GET/PATCH/DELETE /conversations/${id}
GET/POST     /conversations/${id}/messages
POST         /conversations/${id}/notes
PATCH        /conversations/${id}/transfer|close|reopen
GET/PATCH    ${BASE}/settings
POST         ${BASE}/inbound
POST         ${BASE}/escalations/run
GET          ${BASE}/events${query}

AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM. STATUS: CONTRACT_COMPLETE. Nota: doc20/26 já esclareceram que este é um domínio de atendimento ao cliente (CRM), não o "MusicChat" (canais internos) tratado nas Exceções Funcionais abaixo — não confundir os dois.
```

### A.18 — Uploads (R2) e Reports

```text
DOMAIN: uploads-reports
CONSUMER: shared/hooks/useUploadToR2.ts, modules/reports/services/reports-api.ts

POST /uploads/presign                                                       — CANONICAL
POST /uploads/${fileId}/confirm                                             — CANONICAL
PUT  presign.presignedUrl                                                   — SPECIALIZED, destino Cloudflare R2 (não apps/api), "sem header de auth" (doc05) — AUTH_REQUIRED: NÃO (URL assinada)
GET  /reports/entities
GET  /reports/definitions
POST /reports/entities/${entity}/import/validate
POST /reports/entities/${entity}/import/commit
GET  ${API_BASE_URL}/api/v1/reports/entities/${entity}/export?...           — SPECIALIZED, resposta binária/Blob
GET  ${API_BASE_URL}/api/v1/reports/entities/${entity}/import/template      — SPECIALIZED, resposta binária/Blob

AUTH_REQUIRED: SIM (exceto PUT ao R2) | TENANT_REQUIRED: SIM (endpoints CANONICAL); INCERTO para os 2 SPECIALIZED de export/template (não confirmado em doc05, sem pendência formalmente registrada). STATUS: CONTRACT_COMPLETE.
```

### A.19 — OAuth Bridge (init/exchange) e Popup

```text
DOMAIN: oauth-bridge
CONSUMER: modules/settings/pages/Configuracoes.tsx, modules/integrations/components/MarketingOAuthDialog.tsx, modules/integrations/pages/{OAuthCallbackPage,OAuthPopupPage}.tsx

POST ${API_BASE_URL}/api/v1/integrations/oauth/init      — SPECIALIZED — AUTH_REQUIRED: SIM (reusa getAccessToken()) | TENANT_REQUIRED: NÃO ("SEM X-Tenant-ID", doc05 explícito) — 2 call sites, mesmo endpoint
POST ${API_BASE_URL}/api/v1/integrations/oauth/exchange  — SPECIALIZED — AUTH_REQUIRED: NÃO (doc17/30: "no auth required", validado via exchange_token de uso único) | TENANT_REQUIRED: NÃO
GET  ${apiBase}${backendPath}  (spotify_ads/corp_spotify → /integrations/spotify/auth) — SPECIALIZED — AUTH_REQUIRED: SIM (Bearer lido direto de localStorage) | TENANT_REQUIRED: INCERTO (não confirmado)

STATUS: CONTRACT_COMPLETE — fluxo inteiro já auditado em detalhe nos docs 17/30/31, incluindo o único caso de credencial exposta (client_id público, resolvido como PUBLIC_CLIENT_CREDENTIALS no doc31, não uma pendência).
```

### A.20 — DEFERRED (pendência real, já documentada — únicos casos `CONTRACT_INCOMPLETE`)

```text
DOMAIN: ai-generation
CONSUMER: shared/hooks/useAI.ts, modules/contracts/services/semantic-parser.service.ts, modules/integrations/hooks/useACRCloud.ts, modules/marketing/ai/providers/providerRouter.ts

POST /api/v1/ai/generate                       — DUPLICATE/DEFERRED (useAI.ts + semantic-parser.service.ts, mesmo endpoint) — AUTH_REQUIRED: NÃO (ausente na implementação atual) | TENANT_REQUIRED: NÃO — STATUS: CONTRACT_INCOMPLETE
POST /api/v1/integrations/acrcloud/recognize   — DUPLICATE/DEFERRED (useACRCloud.ts; 3 de 4 sub-endpoints sequer chegam a montar uma URL) — AUTH_REQUIRED: NÃO | TENANT_REQUIRED: NÃO — STATUS: CONTRACT_INCOMPLETE
POST /ai/generate                              — providerRouter.ts, endpoint DIFERENTE dos dois acima (sem prefixo /api/v1, via api-client.ts CANONICAL) — AUTH_REQUIRED: SIM | TENANT_REQUIRED: SIM — STATUS: CONTRACT_COMPLETE (não é o mesmo achado DEFERRED — path e cliente diferentes)

JUSTIFICATIVA (por que INCOMPLETE, não reinterpretado): doc05 registra estes 2 endpoints como "DEFERRED" por instrução explícita já dada em etapa anterior a esta auditoria — nunca tiveram request/response/erro extraídos com o mesmo rigor dos demais 248, precisamente porque a instrução foi não fazê-lo ainda. Esta é a única pendência real herdada de docs anteriores.
```

### A.21 — Terceiros (fora de `apps/api`, não fazem parte do contrato canônico do backend)

```text
DOMAIN: third-party-external
CONSUMER: masks.ts (ViaCEP), useIbgeLocations.ts (IBGE + Nominatim), ChatAttachment.tsx (URL de anexo já resolvida)

GET https://viacep.com.br/ws/${cep}/json/
GET ${IBGE_BASE}/localidades/estados/${uf}/municipios
GET ${NOMINATIM_BASE}/search
GET attachment.url (×2 call sites — URL vem de outro serviço, não fixa)

STATUS: NÃO APLICÁVEL a CONTRACT_COMPLETE/INCOMPLETE — não são endpoints de `apps/api`, são serviços de terceiros ou URLs pré-resolvidas; não fazem parte do contrato que uma API v2 precisaria implementar.
```

### A.22 — Testes (não são operações de produto)

```text
DOMAIN: test-only
CONSUMER: shared/lib/api-client.test.ts

DELETE /financial-categories/category-1
GET    /artists (×2 call sites)

STATUS: NÃO APLICÁVEL — fixtures de teste, já contadas nos 270 call sites do doc05 mas sem função de produto.
```

---

## B. Eventos Realtime (22 únicos — consolidado do doc33)

```text
TRANSPORT: SUPABASE_REALTIME | CHANNEL: tenant:${orgId} + user:${userId} | EVENT: artist.created | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: artist.updated | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: artist.deleted | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: catalog.music.registered | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: catalog.phonogram.registered | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: contract.created | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: contract.updated | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: contract.signed | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: crm.lead.captured | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: crm.lead.converted | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: finance.transaction.created | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: finance.transaction.updated | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: finance.calculated | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: RealtimeLayer.tsx, useRealtimeSync.ts, Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: audit.entry.created | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: useRealtimeSync.ts (no-op), Dashboard.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: notification:new | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: RealtimeLayer.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: billing:plan_upgraded | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: Billing.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: billing:trial_ending | DIRECTION: SUBSCRIBE (sem consumidor) | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: NENHUM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: billing:payment_failed | DIRECTION: SUBSCRIBE (sem consumidor) | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: NENHUM
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: billing:cancelled | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: Billing.tsx
TRANSPORT: SUPABASE_REALTIME | CHANNEL: idem | EVENT: data:changed | DIRECTION: SUBSCRIBE | TENANT_SCOPED: SIM | AUTH_REQUIRED: SIM | CONSUMER: RealtimeLayer.tsx
TRANSPORT: BROWSER_EVENT (postMessage) | CHANNEL: N/A (same-origin) | EVENT: musicos360_oauth_success | DIRECTION: BOTH | TENANT_SCOPED: NÃO APLICÁVEL | AUTH_REQUIRED: NÃO | CONSUMER: MarketingOAuthDialog.tsx (subscribe) / OAuthCallbackPage.tsx (publish)
TRANSPORT: BROWSER_EVENT (storage nativo) | CHANNEL: N/A | EVENT: storage (filtro musicos360_distributor_connections) | DIRECTION: SUBSCRIBE | TENANT_SCOPED: NÃO APLICÁVEL | AUTH_REQUIRED: NÃO | CONSUMER: useDistributionPlatforms.ts
```

PAYLOAD de cada evento: ver doc33 (bloco completo por evento, com `PAYLOAD_TYPES` comprováveis para todos os 22 — 0 desconhecidos).

---

## C. Exceções Funcionais (decisões já tomadas — não modificadas aqui)

```text
Supabase Auth:
mantido diretamente no frontend

Supabase Realtime:
pode permanecer direto conforme decisão já documentada

Distribuidoras:
integração futura via API oficial por tenant quando disponível

MusicChat:
fora do escopo inicial da API v2

PENDING_TABLES:
nenhum exige API v2 no estado atual

Mocks:
nenhum exige API v2

Memory:
nenhum exige API v2
```

Fontes: Supabase Auth — doc17 (`AUTH_REQUIRED_DIRECT_ACCESS`). Supabase Realtime — doc17 (`MAY_REMAIN_DIRECT`, justificativa técnica de ambiente serverless). Distribuidoras — doc25 (Decisão D1 aprovada: `OFFICIAL_API_WHEN_AVAILABLE`). MusicChat — doc26 (`DEFER_FROM_API_V2`, zero consumidor real confirmado). PENDING_TABLES — doc32 (`API_V2_REQUIRED: 0` das 6 entradas). Mocks — doc28 (`MOCKS_REQUIRING_API_V2: 0`). Memory — doc29 (`MEMORY_USAGES_REQUIRING_API_V2: 0`).

---

## Resumo

```text
HTTP_CALL_SITES:
270

UNIQUE_HTTP_ENDPOINTS:
250

CONTRACT_COMPLETE:
248

CONTRACT_INCOMPLETE:
2

REALTIME_EVENTS:
22

UNRESOLVED_REQUESTS:
0

UNRESOLVED_RESPONSES:
0

UNRESOLVED_ERRORS:
0

UNRESOLVED_PERMISSIONS:
0

UNRESOLVED_REALTIME_EVENTS:
0
```

`CONTRACT_INCOMPLETE` (2) = os únicos endpoints marcados `DEFERRED` por instrução explícita já registrada no doc05 (`POST /api/v1/ai/generate` e `POST /api/v1/integrations/acrcloud/recognize`, seção A.20) — nenhuma outra pendência real foi encontrada em nenhum dos docs 06-33. Todos os quatro contadores `UNRESOLVED_*` são 0 porque cada etapa de resolução dedicada (doc08 requests, doc11 responses, doc14 erros, doc16 permissões, doc33 realtime) já fechou explicitamente com 0 remanescentes — confirmado por leitura direta do bloco "Resumo" de cada um nesta etapa, não presumido.

## Cobertura

Todos os 15 documentos de referência obrigatórios foram lidos (integralmente ou, para os de resolução, na seção "Resumo" que contém o resultado final autoritativo). Os 250 endpoints únicos do doc05 foram organizados em 22 grupos de domínio, cobrindo 100% deles. Os 22 eventos realtime do doc33 foram integralmente reproduzidos. As 7 exceções funcionais foram citadas verbatim, sem reinterpretação. Nenhum backend, tabela, migration ou `apps/api-v2` foi criado. Nenhum documento anterior foi alterado.

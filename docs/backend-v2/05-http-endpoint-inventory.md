> Historical record. Kept as recorded; not the current contract.

# 05 — Inventário de Endpoints HTTP do Frontend (`apps/web`)

Mapeamento read-only, a partir de [`03-frontend-data-access-surface.md`](./03-frontend-data-access-surface.md) e [`04-http-client-architecture.md`](./04-http-client-architecture.md). Nenhum arquivo foi alterado. Não foram analisados request bodies, response schemas, paginação, filtros, sorting, permissões, status codes ou tratamento de erro específico de domínio — apenas método, path/expressão, arquivo de origem e cliente.

## Achado anterior — DEFERRED

Conforme instruído, as chamadas diretas de `useAI.ts` (`POST /api/v1/ai/generate`) e `useACRCloud.ts` (`POST /api/v1/integrations/acrcloud/recognize`) são registradas como:

```text
DEFERRED
```

Não foram corrigidas nem tiveram autenticação/headers alterados nesta etapa. Ambas aparecem no inventário abaixo, classificadas como DUPLICATE (mesma classificação do doc 04).

**Achado adicional não nomeado no prompt, registrado por completude:** `modules/contracts/services/semantic-parser.service.ts:210` faz o **mesmo** `fetch("/api/v1/ai/generate", ...)` que `useAI.ts` — literalmente o mesmo endpoint, mesma ausência de `Authorization`/`X-Tenant-ID`, mesmo padrão DUPLICATE. Não foi explicitamente nomeado no achado da Fase anterior (doc 04 só citou `useAI.ts` e `useACRCloud.ts`), então não o rotulei oficialmente "DEFERRED" — mas é o mesmo tipo de achado, agora com 3 ocorrências em vez de 2.

## TABLE_ENDPOINT (mapa tabela lógica → rota REST)

Definido em `apps/web/src/shared/lib/api-client.ts:45-91`. **45 entradas.** Usado por `shared/lib/storage.ts` (`resolveTable()`) para resolver o path final em runtime a partir de um nome de tabela lógica passado pelo chamador — por isso as chamadas de `storage.ts` no inventário abaixo aparecem como `${resolved.ep}...` (dinâmico, não resolvido para um valor único porque depende de qual `table` cada chamador de `storage.ts` passa, informação fora do escopo desta etapa):

```text
artistas              -> /artists
obras                 -> /works
fonogramas            -> /phonograms
shares                -> /shares
contratos             -> /contracts
templates_contratos   -> /contract-templates
contract_templates    -> /contract-templates
transacoes            -> /transactions
leads                 -> /leads
clientes              -> /clients
contatos              -> /clients
campanhas             -> /campaigns
marketing_projects    -> /marketing/projects
conteudos             -> /marketing/contents
briefings             -> /briefings
takedowns             -> /takedowns
projetos              -> /projects
eventos               -> /events
funcionarios          -> /hr/employees
folha_pagamento       -> /hr/payroll
afastamentos          -> /hr/leave-requests
ferias_ausencias      -> /hr/leave-requests
usuarios              -> /users
users                 -> /users
org_members           -> /users
lancamentos           -> /releases
notas_fiscais         -> /invoices
proposals             -> /proposals
proposal_items        -> /proposal-items
followups             -> /followups
lead_interactions     -> /lead-interactions
metas_artistas        -> /artist-goals
relatorios_ecad       -> /ecad-reports
ecad_reports          -> /ecad-reports
deteccoes             -> /content-detections
content_detections    -> /content-detections
documentos_funcionario -> /hr/employees
support_tickets       -> /support-tickets
audit_logs            -> /audit-logs
inventario            -> /inventory
licencas              -> /licenses
regras_financeiras    -> /financial-rules
financial_categories  -> /financial-categories
categorias_financeiras -> /financial-categories
contract_service_types -> /contract-service-types
```

Existe também `PENDING_TABLES` (mesmo arquivo, 6 entradas: `regras`, `tarefas_marketing`, `monitoramentos`, `roles`, `permissions`, `integrations`) — tabelas lógicas que `storage.ts` reconhece mas **não têm endpoint backend implementado** (a chamada lança erro local antes de tentar qualquer fetch). Não contadas como endpoints reais no inventário.

## Inventário completo de operações HTTP (270 pontos de chamada)

Ordem: agrupado por arquivo, na ordem em que os arquivos foram descobertos durante a varredura (mesma ordem de `03`/`04`). Ocorrências idênticas (mesmo METHOD+ENDPOINT em arquivos diferentes ou na mesma linha lógica) foram **todas preservadas**, uma linha por ponto de chamada.

| ARQUIVO | LINHA | CLIENTE | CLASSIFICAÇÃO | MÉTODO | ENDPOINT | DINÂMICO | ORIGEM |
|---|---|---|---|---|---|---|---|
| `modules/workspace/hooks/useWorkspace.ts` | 21 | api-client.ts (api) | CANONICAL | GET | `${ENTITY_ROUTE_MAP[workspaceType]}/${workspaceId}` | SIM | mapping local (ENTITY_ROUTE_MAP: artist→/artists, release→/releases, campaign→/campaigns, project→/projects, contract→/contracts) + interpolação |
| `modules/workspace/hooks/useWorkspace.ts` | 30 | api-client.ts (api) | CANONICAL | GET | `/activity-logs?entityType=${...}&entityId=${...}` | SIM | interpolação |
| `app/providers/AuthContext.tsx` | 138 | api-client.ts (api) | CANONICAL | PATCH | `/auth/provision-workspace` | NÃO | literal |
| `app/providers/AuthContext.tsx` | 331 | api-client.ts (api) | CANONICAL | POST | `/auth/change-required-password` | NÃO | literal |
| `app/providers/TenantContext.tsx` | 275 | api-client.ts (api) | CANONICAL | GET | `/auth/context` | NÃO | literal |
| `app/providers/BillingContext.tsx` | 83 | api-client.ts (api) | CANONICAL | GET | `/billing/subscription` | NÃO | literal |
| `modules/support/hooks/useSupport.ts` | 37 | api-client.ts (api) | CANONICAL | GET | `/support-tickets?limit=200` | NÃO | literal |
| `modules/support/hooks/useSupport.ts` | 43 | api-client.ts (api) | CANONICAL | POST | `/support-tickets` | NÃO | literal |
| `modules/support/hooks/useSupport.ts` | 54 | api-client.ts (api) | CANONICAL | PATCH | `/support-tickets/${id}` | SIM | interpolação |
| `modules/leads/services/leads.service.ts` | 95 | api-client.ts (api) | CANONICAL | GET | `/leads?limit=200` | NÃO | literal |
| `modules/leads/services/leads.service.ts` | 99 | api-client.ts (api) | CANONICAL | POST | `/leads` | NÃO | literal |
| `modules/leads/services/leads.service.ts` | 122 | api-client.ts (api) | CANONICAL | PATCH | `/leads/${id}` | SIM | interpolação |
| `modules/leads/services/leads.service.ts` | 126 | api-client.ts (api) | CANONICAL | DELETE | `/leads/${id}` | SIM | interpolação |
| `modules/settings/services/company-logo.service.ts` | 135 | api-client.ts (api, import dinâmico) | CANONICAL | DELETE | `/workspaces/${encodeURIComponent(workspaceId)}/logo` | SIM | interpolação |
| `modules/settings/services/company-logo.service.ts` | 115 | fetch direto (company-logo.service.ts) | SPECIALIZED | POST | `${API_BASE_URL}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/logo` _(multipart FormData upload)_ | SIM | interpolação (API_BASE_URL + id) |
| `modules/settings/services/billing-plans.service.ts` | 52 | api-client.ts (api) | CANONICAL | GET | `/billing/plans` | NÃO | literal |
| `modules/settings/services/billing-invoices.service.ts` | 28 | api-client.ts (api) | CANONICAL | GET | `/billing/invoices` | NÃO | literal |
| `shared/lib/storage.ts` | 121 | storage.ts (sobre api-client.ts) | SPECIALIZED | GET | `${resolved.ep}${qs ? "?"+qs : ""}` | SIM | TABLE_ENDPOINT (via resolveTable) + querystring |
| `shared/lib/storage.ts` | 126 | storage.ts (sobre api-client.ts) | SPECIALIZED | GET | `${resolved.ep}/${id}` | SIM | TABLE_ENDPOINT (via resolveTable) |
| `shared/lib/storage.ts` | 143 | storage.ts (sobre api-client.ts) | SPECIALIZED | POST | `resolved.ep` | SIM | TABLE_ENDPOINT (via resolveTable) |
| `shared/lib/storage.ts` | 149 | storage.ts (sobre api-client.ts) | SPECIALIZED | PATCH | `${resolved.ep}/${id}` | SIM | TABLE_ENDPOINT (via resolveTable) |
| `shared/lib/storage.ts` | 164 | storage.ts (sobre api-client.ts) | SPECIALIZED | DELETE | `${resolved.ep}/${id}` | SIM | TABLE_ENDPOINT (via resolveTable) |
| `shared/lib/api-client.test.ts` | 62 | api-client.ts (api) | CANONICAL | DELETE | `/financial-categories/category-1` _(arquivo de teste)_ | NÃO | literal (teste) |
| `shared/lib/api-client.test.ts` | 68 | api-client.ts (api) | CANONICAL | GET | `/artists` _(arquivo de teste)_ | NÃO | literal (teste) |
| `shared/lib/api-client.test.ts` | 74 | api-client.ts (api) | CANONICAL | GET | `/artists` _(arquivo de teste)_ | NÃO | literal (teste) |
| `modules/integrations/hooks/useMarketingOAuth.ts` | 82 | api-client.ts (api) | CANONICAL | GET | `/integrations/oauth/status?platform=${encodeURIComponent(platform)}` | SIM | interpolação |
| `modules/integrations/hooks/useMarketingOAuth.ts` | 103 | api-client.ts (api) | CANONICAL | GET | `/integrations/oauth/status?platform=${encodeURIComponent(platform)}` | SIM | interpolação |
| `modules/integrations/hooks/useMarketingOAuth.ts` | 144 | api-client.ts (api) | CANONICAL | DELETE | `/integrations/oauth/disconnect?platform=${encodeURIComponent(platform)}` | SIM | interpolação |
| `modules/settings/hooks/useUsuarios.ts` | 74 | api-client.ts (api) | CANONICAL | GET | `/users?limit=100&offset=0` | NÃO | literal |
| `modules/settings/hooks/useUsuarios.ts` | 88 | api-client.ts (api) | CANONICAL | PATCH | `/users/${id}` | SIM | interpolação |
| `modules/settings/hooks/useUsuarios.ts` | 96 | api-client.ts (api) | CANONICAL | PATCH | `/users/${id}/role` | SIM | interpolação |
| `modules/integrations/hooks/useTikTok.ts` | 35 | api-client.ts (api) | CANONICAL | GET | `/integrations/tiktok/status` | NÃO | literal |
| `modules/integrations/hooks/useTikTok.ts` | 42 | api-client.ts (api) | CANONICAL | GET | `/integrations/tiktok/auth` | NÃO | literal |
| `modules/integrations/hooks/useTikTok.ts` | 49 | api-client.ts (api) | CANONICAL | DELETE | `/integrations/tiktok/disconnect` | NÃO | literal |
| `modules/integrations/hooks/useDeezer.ts` | 144 | api-client.ts (api) | CANONICAL | GET | `/integrations/deezer/artist/${artistId}` | SIM | interpolação |
| `modules/integrations/hooks/useDeezer.ts` | 156 | api-client.ts (api) | CANONICAL | GET | `/integrations/deezer/artist/${artistId}/top?limit=${limit}` | SIM | interpolação |
| `modules/settings/hooks/useCompanySettings.ts` | 118 | api-client.ts (api) | CANONICAL | GET | `/company-settings` | NÃO | literal |
| `modules/settings/hooks/useCompanySettings.ts` | 128 | api-client.ts (api) | CANONICAL | PATCH | `/company-settings` | NÃO | literal |
| `modules/integrations/hooks/useYouTube.ts` | 84 | api-client.ts (api) | CANONICAL | GET | `/integrations/youtube/channel/${channelId}` | SIM | interpolação |
| `modules/integrations/hooks/useYouTube.ts` | 96 | api-client.ts (api) | CANONICAL | GET | `/integrations/youtube/video/${videoId}` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 100 | api-client.ts (api) | CANONICAL | GET | `/rbac/roles?includeArchived=true` | NÃO | literal |
| `modules/settings/hooks/useRoles.ts` | 104 | api-client.ts (api) | CANONICAL | GET | `/rbac/permissions` | NÃO | literal |
| `modules/settings/hooks/useRoles.ts` | 108 | api-client.ts (api) | CANONICAL | GET | `/rbac/grants` | NÃO | literal |
| `modules/settings/hooks/useRoles.ts` | 112 | api-client.ts (api) | CANONICAL | GET | `/users?limit=100` | NÃO | literal |
| `modules/settings/hooks/useRoles.ts` | 116 | api-client.ts (api) | CANONICAL | GET | `/users/invitations` | NÃO | literal |
| `modules/settings/hooks/useRoles.ts` | 148 | api-client.ts (api) | CANONICAL | POST | `/rbac/roles` | NÃO | literal |
| `modules/settings/hooks/useRoles.ts` | 160 | api-client.ts (api) | CANONICAL | PATCH | `/rbac/roles/${id}` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 170 | api-client.ts (api) | CANONICAL | POST | `/rbac/roles/${id}/duplicate` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 175 | api-client.ts (api) | CANONICAL | POST | `/rbac/roles/${id}/archive` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 180 | api-client.ts (api) | CANONICAL | POST | `/rbac/roles/${id}/restore` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 186 | api-client.ts (api) | CANONICAL | POST | `/rbac/roles/${roleId}/inheritance` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 192 | api-client.ts (api) | CANONICAL | DELETE | `/rbac/roles/${roleId}/inheritance/${parentRoleId}` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 198 | api-client.ts (api) | CANONICAL | POST | `/rbac/roles/${roleId}/permissions/${permissionId}` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 204 | api-client.ts (api) | CANONICAL | DELETE | `/rbac/roles/${roleId}/permissions/${permissionId}` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 212 | api-client.ts (api) | CANONICAL | PATCH | `/users/${userId}/role` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 220 | api-client.ts (api) | CANONICAL | POST | `/users/invitations` | NÃO | literal |
| `modules/settings/hooks/useRoles.ts` | 226 | api-client.ts (api) | CANONICAL | DELETE | `/users/invitations/${id}` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 231 | api-client.ts (api) | CANONICAL | POST | `/users/invitations/${id}/resend` | SIM | interpolação |
| `modules/settings/hooks/useRoles.ts` | 257 | api-client.ts (api) | CANONICAL | GET | `/rbac/roles/${roleId}` | SIM | interpolação |
| `modules/settings/hooks/useAuditTrail.ts` | 59 | api-client.ts (api) | CANONICAL | GET | `\audit-logs${qs ? "?"+qs : ""}` _(ANOMALIA: literal começa com barra invertida `\audit-logs` em vez de `/audit-logs` — registrado como encontrado, não corrigido)_ | SIM | interpolação |
| `modules/integrations/hooks/useTikTokAds.ts` | 29 | api-client.ts (api) | CANONICAL | GET | `/integrations/tiktok/ads/status` | NÃO | literal |
| `modules/integrations/hooks/useTikTokAds.ts` | 39 | api-client.ts (api) | CANONICAL | POST | `/integrations/tiktok/ads/configure` | NÃO | literal |
| `modules/integrations/hooks/useTikTokAds.ts` | 58 | api-client.ts (api) | CANONICAL | DELETE | `/integrations/tiktok/ads/disconnect` | NÃO | literal |
| `modules/integrations/hooks/useTikTokAds.ts` | 72 | api-client.ts (api) | CANONICAL | GET | `/integrations/tiktok/ads/campaigns` | NÃO | literal |
| `modules/integrations/hooks/useStripe.ts` | 60 | api-client.ts (api) | CANONICAL | GET | `/billing/subscription` | NÃO | literal |
| `modules/integrations/hooks/useSpotify.ts` | 36 | api-client.ts (api) | CANONICAL | GET | `/integrations/spotify/auth` | NÃO | literal |
| `modules/integrations/hooks/useSpotify.ts` | 52 | api-client.ts (api) | CANONICAL | DELETE | `/integrations/spotify/disconnect` | NÃO | literal |
| `modules/integrations/hooks/useSpotify.ts` | 65 | api-client.ts (api) | CANONICAL | GET | `/integrations/spotify/auth` | NÃO | literal |
| `modules/integrations/hooks/useSpotify.ts` | 76 | api-client.ts (api) | CANONICAL | POST | `/integrations/spotify/sync-artist` | NÃO | literal |
| `modules/integrations/hooks/useSoundCloud.ts` | 29 | api-client.ts (api) | CANONICAL | GET | `/integrations/soundcloud/status` | NÃO | literal |
| `modules/integrations/hooks/useSoundCloud.ts` | 39 | api-client.ts (api) | CANONICAL | POST | `/integrations/soundcloud/configure` | NÃO | literal |
| `modules/integrations/hooks/useSoundCloud.ts` | 56 | api-client.ts (api) | CANONICAL | DELETE | `/integrations/soundcloud/disconnect` | NÃO | literal |
| `modules/integrations/hooks/useSoundCloud.ts` | 71 | api-client.ts (api) | CANONICAL | GET | `/integrations/soundcloud/user?url=${encodeURIComponent(permalinkUrl)}` | SIM | interpolação |
| `modules/integrations/hooks/useSoundCloud.ts` | 83 | api-client.ts (api) | CANONICAL | GET | `/integrations/soundcloud/track/${trackId}` | SIM | interpolação |
| `modules/integrations/hooks/useInstagram.ts` | 33 | api-client.ts (api) | CANONICAL | GET | `/integrations/instagram/status` | NÃO | literal |
| `modules/integrations/hooks/useInstagram.ts` | 42 | api-client.ts (api) | CANONICAL | GET | `/integrations/instagram/auth` | NÃO | literal |
| `modules/integrations/hooks/useInstagram.ts` | 53 | api-client.ts (api) | CANONICAL | GET | `/integrations/instagram/metrics` | NÃO | literal |
| `modules/integrations/hooks/useInstagram.ts` | 63 | api-client.ts (api) | CANONICAL | DELETE | `/integrations/instagram/disconnect` | NÃO | literal |
| `modules/integrations/hooks/useGoogleAds.ts` | 30 | api-client.ts (api) | CANONICAL | GET | `/integrations/google-ads/status` | NÃO | literal |
| `modules/integrations/hooks/useGoogleAds.ts` | 40 | api-client.ts (api) | CANONICAL | POST | `/integrations/google-ads/configure` | NÃO | literal |
| `modules/integrations/hooks/useGoogleAds.ts` | 56 | api-client.ts (api) | CANONICAL | GET | `/integrations/google-ads/auth` | NÃO | literal |
| `modules/integrations/hooks/useGoogleAds.ts` | 67 | api-client.ts (api) | CANONICAL | DELETE | `/integrations/google-ads/disconnect` | NÃO | literal |
| `modules/integrations/hooks/useGoogleAds.ts` | 81 | api-client.ts (api) | CANONICAL | GET | `/integrations/google-ads/campaigns` | NÃO | literal |
| `modules/integrations/hooks/useAppleMusic.ts` | 31 | api-client.ts (api) | CANONICAL | GET | `/integrations/apple-music/status` | NÃO | literal |
| `modules/integrations/hooks/useAppleMusic.ts` | 41 | api-client.ts (api) | CANONICAL | POST | `/integrations/apple-music/configure` | NÃO | literal |
| `modules/integrations/hooks/useAppleMusic.ts` | 59 | api-client.ts (api) | CANONICAL | DELETE | `/integrations/apple-music/disconnect` | NÃO | literal |
| `modules/integrations/hooks/useAppleMusic.ts` | 74 | api-client.ts (api) | CANONICAL | GET | `/integrations/apple-music/artist/${artistId}?storefront=${storefront}` | SIM | interpolação |
| `modules/integrations/hooks/useAbramus.ts` | 101 | api-client.ts (api) | CANONICAL | GET | `/integrations/abramus/status` | NÃO | literal |
| `modules/integrations/hooks/useAbramus.ts` | 113 | api-client.ts (api) | CANONICAL | POST | `/integrations/abramus/configure` | NÃO | literal |
| `modules/integrations/hooks/useAbramus.ts` | 130 | api-client.ts (api) | CANONICAL | DELETE | `/integrations/abramus/disconnect` | NÃO | literal |
| `modules/integrations/hooks/useAbramus.ts` | 144 | api-client.ts (api) | CANONICAL | GET | `/integrations/abramus/search-work?q=${...}&kind=${kind}` | SIM | interpolação |
| `modules/integrations/hooks/useAbramus.ts` | 157 | api-client.ts (api) | CANONICAL | GET | `/integrations/abramus/search-artist?q=${...}&limit=10` | SIM | interpolação |
| `modules/integrations/hooks/useAbramus.ts` | 224 | api-client.ts (api) | CANONICAL | POST | `/integrations/abramus/register-work` | NÃO | literal |
| `modules/musicchat/services/conversations.service.ts` | 168 | api-client.ts (api) | CANONICAL | GET | `/conversations?limit=200` | NÃO | literal |
| `modules/musicchat/services/conversations.service.ts` | 173 | api-client.ts (api) | CANONICAL | GET | `/conversations/${conversationId}/messages?limit=200` | SIM | interpolação |
| `modules/musicchat/services/conversations.service.ts` | 178 | api-client.ts (api) | CANONICAL | POST | `/conversations/${conversationId}/messages` | SIM | interpolação |
| `modules/musicchat/services/conversations.service.ts` | 183 | api-client.ts (api) | CANONICAL | POST | `/conversations/${conversationId}/notes` | SIM | interpolação |
| `modules/musicchat/services/conversations.service.ts` | 187 | api-client.ts (api) | CANONICAL | PATCH | `/conversations/${conversationId}` | SIM | interpolação |
| `modules/musicchat/services/conversations.service.ts` | 191 | api-client.ts (api) | CANONICAL | PATCH | `/conversations/${conversationId}/transfer` | SIM | interpolação |
| `modules/musicchat/services/conversations.service.ts` | 195 | api-client.ts (api) | CANONICAL | PATCH | `/conversations/${conversationId}/close` | SIM | interpolação |
| `modules/musicchat/services/conversations.service.ts` | 199 | api-client.ts (api) | CANONICAL | PATCH | `/conversations/${conversationId}/reopen` | SIM | interpolação |
| `modules/musicchat/services/conversations.service.ts` | 203 | api-client.ts (api) | CANONICAL | DELETE | `/conversations/${conversationId}` | SIM | interpolação |
| `modules/musicchat/services/musicchat-automation.service.ts` | 12 | api-client.ts (api) | CANONICAL | GET | `${BASE}/settings` | SIM | constante local BASE + literal |
| `modules/musicchat/services/musicchat-automation.service.ts` | 16 | api-client.ts (api) | CANONICAL | PATCH | `${BASE}/settings` | SIM | constante local BASE + literal |
| `modules/musicchat/services/musicchat-automation.service.ts` | 20 | api-client.ts (api) | CANONICAL | POST | `${BASE}/inbound` | SIM | constante local BASE + literal |
| `modules/musicchat/services/musicchat-automation.service.ts` | 24 | api-client.ts (api) | CANONICAL | POST | `${BASE}/escalations/run` | SIM | constante local BASE + literal |
| `modules/musicchat/services/musicchat-automation.service.ts` | 29 | api-client.ts (api) | CANONICAL | GET | `${BASE}/events${query}` | SIM | constante local BASE + interpolação |
| `modules/integrations/clients/stripe.client.ts` | 19 | api-client.ts (api, via stripe.client.ts) | CANONICAL | POST | `/billing/checkout` | NÃO | literal |
| `modules/integrations/clients/stripe.client.ts` | 22 | api-client.ts (api, via stripe.client.ts) | CANONICAL | POST | `/billing/portal` | NÃO | literal |
| `modules/integrations/clients/stripe.client.ts` | 25 | api-client.ts (api, via stripe.client.ts) | CANONICAL | GET | `/billing/subscription` | NÃO | literal |
| `shared/hooks/useUploadToR2.ts` | 55 | api-client.ts (api) | CANONICAL | POST | `/uploads/presign` | NÃO | literal |
| `shared/hooks/useUploadToR2.ts` | 81 | api-client.ts (api) | CANONICAL | POST | `/uploads/${presign.fileId}/confirm` | SIM | interpolação |
| `shared/hooks/useUploadToR2.ts` | 71 | fetch direto (useUploadToR2.ts) | SPECIALIZED | PUT | `presign.presignedUrl` _(destino é Cloudflare R2, não apps/api — URL assinada, sem header de auth)_ | SIM | função (resposta do passo POST /uploads/presign) |
| `modules/reports/services/reports-api.ts` | 143 | api-client.ts (api) | CANONICAL | GET | `/reports/entities` | NÃO | literal |
| `modules/reports/services/reports-api.ts` | 144 | api-client.ts (api) | CANONICAL | GET | `/reports/definitions` | NÃO | literal |
| `modules/reports/services/reports-api.ts` | 195 | api-client.ts (api) | CANONICAL | POST | `/reports/entities/${encodeURIComponent(entity)}/import/validate` | SIM | interpolação |
| `modules/reports/services/reports-api.ts` | 201 | api-client.ts (api) | CANONICAL | POST | `/reports/entities/${encodeURIComponent(entity)}/import/commit` | SIM | interpolação |
| `modules/reports/services/reports-api.ts` | 150 | fetch direto (reports-api.ts) | SPECIALIZED | GET | `${API_BASE_URL}/api/v1/reports/entities/${encodeURIComponent(entity)}/export?${buildExportQuery(params)}` _(resposta binária/Blob, não passa por api-client.ts request())_ | SIM | interpolação (API_BASE_URL + função buildExportQuery) |
| `modules/reports/services/reports-api.ts` | 175 | fetch direto (reports-api.ts) | SPECIALIZED | GET | `${API_BASE_URL}/api/v1/reports/entities/${encodeURIComponent(entity)}/import/template` _(resposta binária/Blob)_ | SIM | interpolação (API_BASE_URL) |
| `shared/components/MainLayout.tsx` | 201 | api-client.ts (api) | CANONICAL | PATCH | `/notifications/read-all` | NÃO | literal |
| `modules/dashboard/hooks/useOperationalDashboard.ts` | 225 | api-client.ts (api) | CANONICAL | GET | `/analytics/dashboard` | NÃO | literal |
| `modules/dashboard/hooks/useActivityHistory.ts` | 27 | api-client.ts (api) | CANONICAL | GET | `/audit-logs?limit=${limit}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 121 | api-client.ts (api) | CANONICAL | POST | `/marketing/projects` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 124 | api-client.ts (api) | CANONICAL | GET | `/marketing/projects/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 125 | api-client.ts (api) | CANONICAL | PATCH | `/marketing/projects/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 131 | api-client.ts (api) | CANONICAL | DELETE | `/marketing/projects/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 203 | api-client.ts (api) | CANONICAL | POST | `/marketing/campaigns/draft` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 206 | api-client.ts (api) | CANONICAL | GET | `/marketing/campaigns/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 207 | api-client.ts (api) | CANONICAL | PATCH | `/marketing/campaigns/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 213 | api-client.ts (api) | CANONICAL | POST | `/marketing/campaigns/${id}/archive` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 236 | api-client.ts (api) | CANONICAL | POST | `/marketing/contents` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 240 | api-client.ts (api) | CANONICAL | PATCH | `/marketing/contents/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 243 | api-client.ts (api) | CANONICAL | DELETE | `/marketing/contents/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 305 | api-client.ts (api) | CANONICAL | POST | `/briefings` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 308 | api-client.ts (api) | CANONICAL | GET | `/briefings/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 309 | api-client.ts (api) | CANONICAL | PATCH | `/briefings/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 315 | api-client.ts (api) | CANONICAL | DELETE | `/briefings/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 395 | api-client.ts (api) | CANONICAL | POST | `/marketing/tasks` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 398 | api-client.ts (api) | CANONICAL | GET | `/marketing/tasks/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 399 | api-client.ts (api) | CANONICAL | PATCH | `/marketing/tasks/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 405 | api-client.ts (api) | CANONICAL | DELETE | `/marketing/tasks/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 455 | api-client.ts (api) | CANONICAL | POST | `/marketing/assets` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 458 | api-client.ts (api) | CANONICAL | GET | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 459 | api-client.ts (api) | CANONICAL | PATCH | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 465 | api-client.ts (api) | CANONICAL | DELETE | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 493 | api-client.ts (api) | CANONICAL | GET | `/marketing/assets/${row.id}/versions` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 543 | api-client.ts (api) | CANONICAL | POST | `/marketing/assets` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 556 | api-client.ts (api) | CANONICAL | PATCH | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 563 | api-client.ts (api) | CANONICAL | PATCH | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 573 | api-client.ts (api) | CANONICAL | POST | `/marketing/assets/${id}/request-approval` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 574 | api-client.ts (api) | CANONICAL | GET | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 576 | api-client.ts (api) | CANONICAL | GET | `/marketing/assets/${id}/approvals` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 579 | api-client.ts (api) | CANONICAL | POST | `/marketing/assets/approvals/${pending.id}/decision` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 582 | api-client.ts (api) | CANONICAL | GET | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 585 | api-client.ts (api) | CANONICAL | GET | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 587 | api-client.ts (api) | CANONICAL | PATCH | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 600 | api-client.ts (api) | CANONICAL | GET | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 601 | api-client.ts (api) | CANONICAL | POST | `/marketing/assets` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 616 | api-client.ts (api) | CANONICAL | DELETE | `/marketing/assets/${id}` | SIM | interpolação |
| `modules/marketing/services/marketing.service.ts` | 765 | api-client.ts (api) | CANONICAL | GET | `/marketing/campaign-builder/config` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 772 | api-client.ts (api) | CANONICAL | POST | `/activity-logs` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 784 | api-client.ts (api) | CANONICAL | GET | `/marketing/ai-suggestions` | NÃO | literal |
| `modules/marketing/services/marketing.service.ts` | 788 | api-client.ts (api) | CANONICAL | POST | `/marketing/ai-suggestions` | NÃO | literal |
| `modules/marketing/hooks/useMetas.ts` | 124 | api-client.ts (api) | CANONICAL | POST | `/artist-goals` | NÃO | literal |
| `modules/marketing/hooks/useMetas.ts` | 137 | api-client.ts (api) | CANONICAL | GET | `/artist-goals/${id}` | SIM | interpolação |
| `modules/marketing/hooks/useMetas.ts` | 153 | api-client.ts (api) | CANONICAL | PATCH | `/artist-goals/${id}` | SIM | interpolação |
| `modules/marketing/hooks/useMetas.ts` | 167 | api-client.ts (api) | CANONICAL | DELETE | `/artist-goals/${id}` | SIM | interpolação |
| `modules/marketing/hooks/useMarketingAssets.ts` | 71 | api-client.ts (api) | CANONICAL | GET | `/marketing/assets/project/${projectId}/library` | SIM | interpolação |
| `modules/crm-relationships/services/clients.service.ts` | 121 | api-client.ts (api) | CANONICAL | GET | `/clients${qs ? "?"+qs : ""}` | SIM | interpolação |
| `modules/crm-relationships/services/clients.service.ts` | 124 | api-client.ts (api) | CANONICAL | POST | `/clients` | NÃO | literal |
| `modules/crm-relationships/services/clients.service.ts` | 127 | api-client.ts (api) | CANONICAL | PATCH | `/clients/${id}` | SIM | interpolação |
| `modules/crm-relationships/services/clients.service.ts` | 130 | api-client.ts (api) | CANONICAL | DELETE | `/clients/${id}` | SIM | interpolação |
| `modules/crm-relationships/services/clients.service.ts` | 135 | api-client.ts (api) | CANONICAL | GET | `/clients/${clientId}/timeline` | SIM | interpolação |
| `modules/crm-relationships/services/clients.service.ts` | 138 | api-client.ts (api) | CANONICAL | POST | `/clients/${clientId}/timeline` | SIM | interpolação |
| `modules/crm-relationships/services/clients.service.ts` | 143 | api-client.ts (api) | CANONICAL | GET | `/clients/${clientId}/contracts` | SIM | interpolação |
| `modules/crm-relationships/services/clients.service.ts` | 148 | api-client.ts (api) | CANONICAL | GET | `/clients/${clientId}/attachments` | SIM | interpolação |
| `modules/crm-relationships/services/clients.service.ts` | 151 | api-client.ts (api) | CANONICAL | DELETE | `/clients/${clientId}/attachments/${attachmentId}` | SIM | interpolação |
| `modules/auth/services/activation-plans.service.ts` | 55 | api-client.ts (publicApi) | CANONICAL | GET | `/public/activation-plans` | NÃO | literal |
| `modules/auth/pages/Onboarding.tsx` | 28 | api-client.ts (api) | CANONICAL | PATCH | `/auth/onboarding` | NÃO | literal |
| `modules/auth/pages/ArtistaSignupPublic.tsx` | 400 | api-client.ts (publicApi) | CANONICAL | POST | `/public/artists` | NÃO | literal |
| `modules/artist/hooks/useArtistPlatformProfiles.ts` | 55 | api-client.ts (api) | CANONICAL | GET | `/artists/${artistId}/platform-profiles` | SIM | interpolação |
| `modules/artist/hooks/useArtistPlatformProfiles.ts` | 69 | api-client.ts (api) | CANONICAL | POST | `/artists/${artistId}/platform-profiles/${input.platform}/sync` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 24 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/projects${q(p)}` | SIM | função local q() |
| `modules/audiovisual/services/audiovisual.service.ts` | 26 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/projects/dashboard${q(p)}` | SIM | função local q() |
| `modules/audiovisual/services/audiovisual.service.ts` | 27 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/projects/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 28 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects` | NÃO | literal |
| `modules/audiovisual/services/audiovisual.service.ts` | 29 | api-client.ts (api) | CANONICAL | PATCH | `/audiovisual/projects/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 31 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects/${id}/transition` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 32 | api-client.ts (api) | CANONICAL | DELETE | `/audiovisual/projects/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 36 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/projects/${projectId}/briefing` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 38 | api-client.ts (api) | CANONICAL | PUT | `/audiovisual/projects/${projectId}/briefing` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 43 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/deliverables${q(p)}` | SIM | função local q() |
| `modules/audiovisual/services/audiovisual.service.ts` | 44 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/deliverables/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 46 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects/${projectId}/deliverables` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 48 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects/${projectId}/deliverables/seed-defaults` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 50 | api-client.ts (api) | CANONICAL | PATCH | `/audiovisual/deliverables/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 51 | api-client.ts (api) | CANONICAL | DELETE | `/audiovisual/deliverables/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 55 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/projects/${projectId}/shots` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 57 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects/${projectId}/shots` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 59 | api-client.ts (api) | CANONICAL | PATCH | `/audiovisual/shots/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 61 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects/${projectId}/shots/reorder` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 62 | api-client.ts (api) | CANONICAL | DELETE | `/audiovisual/shots/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 66 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/projects/${projectId}/production-days` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 68 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects/${projectId}/production-days` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 70 | api-client.ts (api) | CANONICAL | PATCH | `/audiovisual/production-days/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 71 | api-client.ts (api) | CANONICAL | DELETE | `/audiovisual/production-days/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 75 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/projects/${projectId}/team` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 77 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects/${projectId}/team` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 79 | api-client.ts (api) | CANONICAL | PATCH | `/audiovisual/team/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 80 | api-client.ts (api) | CANONICAL | DELETE | `/audiovisual/team/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 85 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/projects/${projectId}/assets${kind ? "?kind="+kind : ""}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 87 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects/${projectId}/assets` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 89 | api-client.ts (api) | CANONICAL | PATCH | `/audiovisual/assets/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 90 | api-client.ts (api) | CANONICAL | DELETE | `/audiovisual/assets/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 94 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/projects/${projectId}/tasks` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 96 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects/${projectId}/tasks` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 98 | api-client.ts (api) | CANONICAL | PATCH | `/audiovisual/tasks/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 99 | api-client.ts (api) | CANONICAL | DELETE | `/audiovisual/tasks/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 104 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/approvals${q(p)}` | SIM | função local q() |
| `modules/audiovisual/services/audiovisual.service.ts` | 105 | api-client.ts (api) | CANONICAL | GET | `/audiovisual/approvals/${id}` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 107 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/projects/${projectId}/approvals` | SIM | interpolação |
| `modules/audiovisual/services/audiovisual.service.ts` | 109 | api-client.ts (api) | CANONICAL | POST | `/audiovisual/approvals/${id}/decision` | SIM | interpolação |
| `modules/admin/services/admin-support.service.ts` | 51 | api-client.ts (api) | CANONICAL | GET | `/support-tickets?limit=200` | NÃO | literal |
| `modules/admin/services/admin-audit.service.ts` | 49 | api-client.ts (api) | CANONICAL | GET | `/audit-logs?limit=200` | NÃO | literal |
| `modules/admin/services/admin-tenants.service.ts` | 11 | api-client.ts (api) | CANONICAL | GET | `/billing/admin/tenants` | NÃO | literal |
| `modules/admin/services/admin-tenants.service.ts` | 15 | api-client.ts (api) | CANONICAL | PATCH | `/billing/admin/tenants/${tenantId}` | SIM | interpolação |
| `modules/admin/services/admin-plans.service.ts` | 63 | api-client.ts (api) | CANONICAL | GET | `/billing/plans?includeInactive=true` | NÃO | literal |
| `modules/admin/services/admin-plans.service.ts` | 69 | api-client.ts (api) | CANONICAL | PATCH | `/billing/plans/${plan.id}` | SIM | interpolação |
| `modules/admin/services/admin-plans.service.ts` | 70 | api-client.ts (api) | CANONICAL | POST | `/billing/plans` | NÃO | literal |
| `modules/admin/services/admin-plans.service.ts` | 75 | api-client.ts (api) | CANONICAL | PATCH | `/billing/plans/${id}` | SIM | interpolação |
| `modules/admin/services/admin-plans.service.ts` | 80 | api-client.ts (api) | CANONICAL | POST | `/billing/plans/${id}/sync-stripe` | SIM | interpolação |
| `modules/admin/services/admin-billing.service.ts` | 23 | api-client.ts (api) | CANONICAL | GET | `/billing/admin/subscriptions` | NÃO | literal |
| `modules/admin/services/admin-billing.service.ts` | 28 | api-client.ts (api) | CANONICAL | GET | `/billing/admin/invoices${suffix}` | SIM | interpolação |
| `modules/admin/services/admin-billing.service.ts` | 32 | api-client.ts (api) | CANONICAL | POST | `/billing/admin/tenants/${tenantId}/suspend` | SIM | interpolação |
| `modules/admin/services/admin-billing.service.ts` | 38 | api-client.ts (api) | CANONICAL | POST | `/billing/admin/tenants/${tenantId}/reactivate` | SIM | interpolação |
| `modules/admin/services/admin-billing.service.ts` | 51 | api-client.ts (api) | CANONICAL | POST | `/billing/admin/tenants/${tenantId}/override` | SIM | interpolação |
| `modules/admin/services/admin-billing.service.ts` | 58 | api-client.ts (api) | CANONICAL | POST | `/billing/admin/tenants/${tenantId}/override/remove` | SIM | interpolação |
| `modules/marketing/ai/providers/providerRouter.ts` | 14 | api-client.ts (api) | CANONICAL | POST | `/ai/generate` | NÃO | literal |
| `modules/accounting/services/financial-categories.service.ts` | 25 | api-client.ts (api) | CANONICAL | GET | `/financial-categories${buildQuery(params)}` | SIM | função local buildQuery() |
| `modules/accounting/services/financial-categories.service.ts` | 27 | api-client.ts (api) | CANONICAL | GET | `/financial-categories/tree${buildQuery(params)}` | SIM | função local buildQuery() |
| `modules/accounting/services/financial-categories.service.ts` | 28 | api-client.ts (api) | CANONICAL | GET | `/financial-categories/${id}` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 29 | api-client.ts (api) | CANONICAL | GET | `/financial-categories/${id}/descendants` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 30 | api-client.ts (api) | CANONICAL | GET | `/financial-categories/${id}/ancestors` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 32 | api-client.ts (api) | CANONICAL | GET | `/financial-categories/search${buildQuery(params)}` | SIM | função local buildQuery() |
| `modules/accounting/services/financial-categories.service.ts` | 33 | api-client.ts (api) | CANONICAL | POST | `/financial-categories` | NÃO | literal |
| `modules/accounting/services/financial-categories.service.ts` | 34 | api-client.ts (api) | CANONICAL | PATCH | `/financial-categories/${id}` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 36 | api-client.ts (api) | CANONICAL | PATCH | `/financial-categories/${id}/move` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 38 | api-client.ts (api) | CANONICAL | PATCH | `/financial-categories/${id}/reorder` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 39 | api-client.ts (api) | CANONICAL | PATCH | `/financial-categories/${id}/archive` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 40 | api-client.ts (api) | CANONICAL | PATCH | `/financial-categories/${id}/restore` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 42 | api-client.ts (api) | CANONICAL | DELETE | `/financial-categories/${id}` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 46 | api-client.ts (api) | CANONICAL | POST | `/financial-categories/${id}/merge` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 48 | api-client.ts (api) | CANONICAL | POST | `/financial-categories/suggest` | NÃO | literal |
| `modules/accounting/services/financial-categories.service.ts` | 50 | api-client.ts (api) | CANONICAL | POST | `/financial-categories/rules` | NÃO | literal |
| `modules/accounting/services/financial-categories.service.ts` | 110 | api-client.ts (api) | CANONICAL | GET | `/financial-categories/rules` | NÃO | literal |
| `modules/accounting/services/financial-categories.service.ts` | 114 | api-client.ts (api) | CANONICAL | POST | `/financial-categories/rules` | NÃO | literal |
| `modules/accounting/services/financial-categories.service.ts` | 118 | api-client.ts (api) | CANONICAL | PATCH | `/financial-categories/rules/${id}` | SIM | interpolação |
| `modules/accounting/services/financial-categories.service.ts` | 122 | api-client.ts (api) | CANONICAL | DELETE | `/financial-categories/rules/${id}` | SIM | interpolação |
| `shared/hooks/useAI.ts` | 29 | fetch direto (useAI.ts) | **DUPLICATE** | POST | `/api/v1/ai/generate` **— DEFERRED** _(sem Authorization/X-Tenant-ID)_ | NÃO | literal |
| `modules/integrations/hooks/useACRCloud.ts` | 45 | fetch direto (useACRCloud.ts) | **DUPLICATE** | POST | `apiPath` (="/api/v1/integrations/acrcloud/recognize" se endpoint==="recognize"; `null` para "copyright"\|"catalog"\|"monitor" — lança erro antes do fetch) **— DEFERRED** _(sem Authorization/X-Tenant-ID; 3 de 4 sub-endpoints não implementados)_ | SIM | literal condicional |
| `modules/contracts/services/semantic-parser.service.ts` | 210 | fetch direto (semantic-parser.service.ts) | DUPLICATE | POST | `/api/v1/ai/generate` _(mesmo padrão de useAI.ts — não nomeado oficialmente DEFERRED pelo prompt, registrado por completude)_ | NÃO | literal |
| `modules/settings/pages/Configuracoes.tsx` | 269 | fetch direto (Configuracoes.tsx, openExternalOAuth) | SPECIALIZED | POST | `${API_BASE_URL}/api/v1/integrations/oauth/init` _(reusa getAccessToken(); SEM X-Tenant-ID)_ | SIM | interpolação (API_BASE_URL) |
| `modules/integrations/pages/OAuthCallbackPage.tsx` | 90 | fetch direto (OAuthCallbackPage.tsx) | SPECIALIZED | POST | `${API_BASE_URL}/api/v1/integrations/oauth/exchange` | SIM | interpolação (API_BASE_URL) |
| `modules/integrations/components/MarketingOAuthDialog.tsx` | 579 | fetch direto (MarketingOAuthDialog.tsx) | SPECIALIZED | POST | `${API_BASE_URL}/api/v1/integrations/oauth/init` _(mesmo endpoint de Configuracoes.tsx:269)_ | SIM | interpolação (API_BASE_URL) |
| `modules/integrations/pages/OAuthPopupPage.tsx` | 911 | fetch direto (OAuthPopupPage.tsx) | SPECIALIZED | GET | `${apiBase}${backendPath}` (backendPath = BACKEND_AUTH_ENDPOINTS[platform]) | SIM | mapping local BACKEND_AUTH_ENDPOINTS (spotify_ads/corp_spotify → `/integrations/spotify/auth`) + VITE_API_URL |
| `modules/marketing/components/campaign-builder/useIbgeLocations.ts` | 31 | fetch direto (useIbgeLocations.ts) | SPECIALIZED | GET | `${IBGE_BASE}/localidades/estados/${uf}/municipios?orderBy=nome` _(terceiro — IBGE, não é apps/api)_ | SIM | constante local IBGE_BASE + interpolação |
| `modules/marketing/components/campaign-builder/useIbgeLocations.ts` | 89 | fetch direto (useIbgeLocations.ts) | SPECIALIZED | GET | `${NOMINATIM_BASE}/search?${params}` _(terceiro — OpenStreetMap Nominatim, não é apps/api)_ | SIM | constante local NOMINATIM_BASE + URLSearchParams |
| `shared/lib/masks.ts` | 68 | fetch direto (masks.ts) | SPECIALIZED | GET | `https://viacep.com.br/ws/${cleanCEP}/json/` _(terceiro — ViaCEP, não é apps/api; único client com timeout explícito 5000ms)_ | SIM | literal externo hard-coded + interpolação |
| `shared/components/ChatAttachment.tsx` | 192 | fetch direto (ChatAttachment.tsx) | SPECIALIZED | GET | `attachment.url` _(não é rota apps/api fixa)_ | SIM | prop/variável (URL já resolvida por quem chama) |
| `shared/components/ChatAttachment.tsx` | 201 | fetch direto (ChatAttachment.tsx) | SPECIALIZED | GET | `attachment.url` | SIM | prop/variável (URL já resolvida por quem chama) |

## Visão consolidada — endpoints únicos (250)

Deduplicados por `MÉTODO + expressão de endpoint` exata (duas ocorrências do mesmo texto, mesmo em arquivos diferentes, contam como 1 endpoint único com N arquivos listados).

| MÉTODO | ENDPOINT | DINÂMICO | Nº OCORRÊNCIAS | ARQUIVOS |
|---|---|---|---|---|
| DELETE | `/financial-categories/category-1` | NÃO | 1 | `shared/lib/api-client.test.ts` |
| DELETE | `/integrations/abramus/disconnect` | NÃO | 1 | `modules/integrations/hooks/useAbramus.ts` |
| DELETE | `/integrations/apple-music/disconnect` | NÃO | 1 | `modules/integrations/hooks/useAppleMusic.ts` |
| DELETE | `/integrations/google-ads/disconnect` | NÃO | 1 | `modules/integrations/hooks/useGoogleAds.ts` |
| DELETE | `/integrations/instagram/disconnect` | NÃO | 1 | `modules/integrations/hooks/useInstagram.ts` |
| DELETE | `/integrations/soundcloud/disconnect` | NÃO | 1 | `modules/integrations/hooks/useSoundCloud.ts` |
| DELETE | `/integrations/spotify/disconnect` | NÃO | 1 | `modules/integrations/hooks/useSpotify.ts` |
| DELETE | `/integrations/tiktok/ads/disconnect` | NÃO | 1 | `modules/integrations/hooks/useTikTokAds.ts` |
| DELETE | `/integrations/tiktok/disconnect` | NÃO | 1 | `modules/integrations/hooks/useTikTok.ts` |
| DELETE | `/artist-goals/${id}` | SIM | 1 | `modules/marketing/hooks/useMetas.ts` |
| DELETE | `/audiovisual/assets/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| DELETE | `/audiovisual/deliverables/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| DELETE | `/audiovisual/production-days/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| DELETE | `/audiovisual/projects/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| DELETE | `/audiovisual/shots/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| DELETE | `/audiovisual/tasks/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| DELETE | `/audiovisual/team/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| DELETE | `/briefings/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| DELETE | `/clients/${clientId}/attachments/${attachmentId}` | SIM | 1 | `modules/crm-relationships/services/clients.service.ts` |
| DELETE | `/clients/${id}` | SIM | 1 | `modules/crm-relationships/services/clients.service.ts` |
| DELETE | `/conversations/${conversationId}` | SIM | 1 | `modules/musicchat/services/conversations.service.ts` |
| DELETE | `/financial-categories/${id}` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| DELETE | `/financial-categories/rules/${id}` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| DELETE | `/integrations/oauth/disconnect?platform=${encodeURIComponent(platform)}` | SIM | 1 | `modules/integrations/hooks/useMarketingOAuth.ts` |
| DELETE | `/leads/${id}` | SIM | 1 | `modules/leads/services/leads.service.ts` |
| DELETE | `/marketing/assets/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| DELETE | `/marketing/contents/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| DELETE | `/marketing/projects/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| DELETE | `/marketing/tasks/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| DELETE | `/rbac/roles/${roleId}/inheritance/${parentRoleId}` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| DELETE | `/rbac/roles/${roleId}/permissions/${permissionId}` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| DELETE | `/users/invitations/${id}` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| DELETE | `/workspaces/${encodeURIComponent(workspaceId)}/logo` | SIM | 1 | `modules/settings/services/company-logo.service.ts` |
| DELETE | `${resolved.ep}/${id}` | SIM | 1 | `shared/lib/storage.ts` |
| GET | `/analytics/dashboard` | NÃO | 1 | `modules/dashboard/hooks/useOperationalDashboard.ts` |
| GET | `/artists` | NÃO | 1 | `shared/lib/api-client.test.ts` |
| GET | `/audit-logs?limit=200` | NÃO | 1 | `modules/admin/services/admin-audit.service.ts` |
| GET | `/auth/context` | NÃO | 1 | `app/providers/TenantContext.tsx` |
| GET | `/billing/admin/subscriptions` | NÃO | 1 | `modules/admin/services/admin-billing.service.ts` |
| GET | `/billing/admin/tenants` | NÃO | 1 | `modules/admin/services/admin-tenants.service.ts` |
| GET | `/billing/invoices` | NÃO | 1 | `modules/settings/services/billing-invoices.service.ts` |
| GET | `/billing/plans` | NÃO | 1 | `modules/settings/services/billing-plans.service.ts` |
| GET | `/billing/plans?includeInactive=true` | NÃO | 1 | `modules/admin/services/admin-plans.service.ts` |
| GET | `/billing/subscription` | NÃO | 3 | `app/providers/BillingContext.tsx`, `modules/integrations/hooks/useStripe.ts`, `modules/integrations/clients/stripe.client.ts` |
| GET | `/company-settings` | NÃO | 1 | `modules/settings/hooks/useCompanySettings.ts` |
| GET | `/conversations?limit=200` | NÃO | 1 | `modules/musicchat/services/conversations.service.ts` |
| GET | `/financial-categories/rules` | NÃO | 1 | `modules/accounting/services/financial-categories.service.ts` |
| GET | `/integrations/abramus/status` | NÃO | 1 | `modules/integrations/hooks/useAbramus.ts` |
| GET | `/integrations/apple-music/status` | NÃO | 1 | `modules/integrations/hooks/useAppleMusic.ts` |
| GET | `/integrations/google-ads/auth` | NÃO | 1 | `modules/integrations/hooks/useGoogleAds.ts` |
| GET | `/integrations/google-ads/campaigns` | NÃO | 1 | `modules/integrations/hooks/useGoogleAds.ts` |
| GET | `/integrations/google-ads/status` | NÃO | 1 | `modules/integrations/hooks/useGoogleAds.ts` |
| GET | `/integrations/instagram/auth` | NÃO | 1 | `modules/integrations/hooks/useInstagram.ts` |
| GET | `/integrations/instagram/metrics` | NÃO | 1 | `modules/integrations/hooks/useInstagram.ts` |
| GET | `/integrations/instagram/status` | NÃO | 1 | `modules/integrations/hooks/useInstagram.ts` |
| GET | `/integrations/soundcloud/status` | NÃO | 1 | `modules/integrations/hooks/useSoundCloud.ts` |
| GET | `/integrations/spotify/auth` | NÃO | 1 | `modules/integrations/hooks/useSpotify.ts` |
| GET | `/integrations/tiktok/ads/campaigns` | NÃO | 1 | `modules/integrations/hooks/useTikTokAds.ts` |
| GET | `/integrations/tiktok/ads/status` | NÃO | 1 | `modules/integrations/hooks/useTikTokAds.ts` |
| GET | `/integrations/tiktok/auth` | NÃO | 1 | `modules/integrations/hooks/useTikTok.ts` |
| GET | `/integrations/tiktok/status` | NÃO | 1 | `modules/integrations/hooks/useTikTok.ts` |
| GET | `/leads?limit=200` | NÃO | 1 | `modules/leads/services/leads.service.ts` |
| GET | `/marketing/ai-suggestions` | NÃO | 1 | `modules/marketing/services/marketing.service.ts` |
| GET | `/marketing/campaign-builder/config` | NÃO | 1 | `modules/marketing/services/marketing.service.ts` |
| GET | `/public/activation-plans` | NÃO | 1 | `modules/auth/services/activation-plans.service.ts` |
| GET | `/rbac/grants` | NÃO | 1 | `modules/settings/hooks/useRoles.ts` |
| GET | `/rbac/permissions` | NÃO | 1 | `modules/settings/hooks/useRoles.ts` |
| GET | `/rbac/roles?includeArchived=true` | NÃO | 1 | `modules/settings/hooks/useRoles.ts` |
| GET | `/reports/definitions` | NÃO | 1 | `modules/reports/services/reports-api.ts` |
| GET | `/reports/entities` | NÃO | 1 | `modules/reports/services/reports-api.ts` |
| GET | `/support-tickets?limit=200` | NÃO | 2 | `modules/support/hooks/useSupport.ts`, `modules/admin/services/admin-support.service.ts` |
| GET | `/users?limit=100` | NÃO | 1 | `modules/settings/hooks/useRoles.ts` |
| GET | `/users?limit=100&offset=0` | NÃO | 1 | `modules/settings/hooks/useUsuarios.ts` |
| GET | `/users/invitations` | NÃO | 1 | `modules/settings/hooks/useRoles.ts` |
| GET | `/activity-logs?entityType=${...}&entityId=${...}` | SIM | 1 | `modules/workspace/hooks/useWorkspace.ts` |
| GET | `/artist-goals/${id}` | SIM | 1 | `modules/marketing/hooks/useMetas.ts` |
| GET | `/artists/${artistId}/platform-profiles` | SIM | 1 | `modules/artist/hooks/useArtistPlatformProfiles.ts` |
| GET | `/audiovisual/approvals/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/approvals${q(p)}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/deliverables/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/deliverables${q(p)}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/projects/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/projects/${projectId}/assets${kind ? "?kind="+kind : ""}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/projects/${projectId}/briefing` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/projects/${projectId}/production-days` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/projects/${projectId}/shots` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/projects/${projectId}/tasks` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/projects/${projectId}/team` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/projects/dashboard${q(p)}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audiovisual/projects${q(p)}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| GET | `/audit-logs?limit=${limit}` | SIM | 1 | `modules/dashboard/hooks/useActivityHistory.ts` |
| GET | `/billing/admin/invoices${suffix}` | SIM | 1 | `modules/admin/services/admin-billing.service.ts` |
| GET | `/briefings/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| GET | `/clients/${clientId}/attachments` | SIM | 1 | `modules/crm-relationships/services/clients.service.ts` |
| GET | `/clients/${clientId}/contracts` | SIM | 1 | `modules/crm-relationships/services/clients.service.ts` |
| GET | `/clients/${clientId}/timeline` | SIM | 1 | `modules/crm-relationships/services/clients.service.ts` |
| GET | `/clients${qs ? "?"+qs : ""}` | SIM | 1 | `modules/crm-relationships/services/clients.service.ts` |
| GET | `/conversations/${conversationId}/messages?limit=200` | SIM | 1 | `modules/musicchat/services/conversations.service.ts` |
| GET | `/financial-categories/${id}/ancestors` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| GET | `/financial-categories/${id}/descendants` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| GET | `/financial-categories/${id}` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| GET | `/financial-categories/search${buildQuery(params)}` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| GET | `/financial-categories/tree${buildQuery(params)}` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| GET | `/financial-categories${buildQuery(params)}` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| GET | `/integrations/abramus/search-artist?q=${...}&limit=10` | SIM | 1 | `modules/integrations/hooks/useAbramus.ts` |
| GET | `/integrations/abramus/search-work?q=${...}&kind=${kind}` | SIM | 1 | `modules/integrations/hooks/useAbramus.ts` |
| GET | `/integrations/apple-music/artist/${artistId}?storefront=${storefront}` | SIM | 1 | `modules/integrations/hooks/useAppleMusic.ts` |
| GET | `/integrations/deezer/artist/${artistId}/top?limit=${limit}` | SIM | 1 | `modules/integrations/hooks/useDeezer.ts` |
| GET | `/integrations/deezer/artist/${artistId}` | SIM | 1 | `modules/integrations/hooks/useDeezer.ts` |
| GET | `/integrations/oauth/status?platform=${encodeURIComponent(platform)}` | SIM | 1 | `modules/integrations/hooks/useMarketingOAuth.ts` |
| GET | `/integrations/soundcloud/track/${trackId}` | SIM | 1 | `modules/integrations/hooks/useSoundCloud.ts` |
| GET | `/integrations/soundcloud/user?url=${encodeURIComponent(permalinkUrl)}` | SIM | 1 | `modules/integrations/hooks/useSoundCloud.ts` |
| GET | `/integrations/youtube/channel/${channelId}` | SIM | 1 | `modules/integrations/hooks/useYouTube.ts` |
| GET | `/integrations/youtube/video/${videoId}` | SIM | 1 | `modules/integrations/hooks/useYouTube.ts` |
| GET | `/marketing/assets/${id}/approvals` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| GET | `/marketing/assets/${id}` | SIM | 4 | `modules/marketing/services/marketing.service.ts` (linhas 458, 574, 582, 585, 600) |
| GET | `/marketing/assets/${row.id}/versions` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| GET | `/marketing/assets/project/${projectId}/library` | SIM | 1 | `modules/marketing/hooks/useMarketingAssets.ts` |
| GET | `/marketing/campaigns/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| GET | `/marketing/projects/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| GET | `/marketing/tasks/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| GET | `/rbac/roles/${roleId}` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| GET | `\audit-logs${qs ? "?"+qs : ""}` | SIM | 1 | `modules/settings/hooks/useAuditTrail.ts` |
| GET | `${API_BASE_URL}/api/v1/reports/entities/${encodeURIComponent(entity)}/export?${buildExportQuery(params)}` | SIM | 1 | `modules/reports/services/reports-api.ts` |
| GET | `${API_BASE_URL}/api/v1/reports/entities/${encodeURIComponent(entity)}/import/template` | SIM | 1 | `modules/reports/services/reports-api.ts` |
| GET | `${apiBase}${backendPath}` | SIM | 1 | `modules/integrations/pages/OAuthPopupPage.tsx` |
| GET | `${BASE}/events${query}` | SIM | 1 | `modules/musicchat/services/musicchat-automation.service.ts` |
| GET | `${BASE}/settings` | SIM | 1 | `modules/musicchat/services/musicchat-automation.service.ts` |
| GET | `${ENTITY_ROUTE_MAP[workspaceType]}/${workspaceId}` | SIM | 1 | `modules/workspace/hooks/useWorkspace.ts` |
| GET | `${IBGE_BASE}/localidades/estados/${uf}/municipios?orderBy=nome` | SIM | 1 | `modules/marketing/components/campaign-builder/useIbgeLocations.ts` |
| GET | `${NOMINATIM_BASE}/search?${params}` | SIM | 1 | `modules/marketing/components/campaign-builder/useIbgeLocations.ts` |
| GET | `${resolved.ep}/${id}` | SIM | 1 | `shared/lib/storage.ts` |
| GET | `${resolved.ep}${qs ? "?"+qs : ""}` | SIM | 1 | `shared/lib/storage.ts` |
| GET | `https://viacep.com.br/ws/${cleanCEP}/json/` | SIM | 1 | `shared/lib/masks.ts` |
| GET | `attachment.url` | SIM | 2 | `shared/components/ChatAttachment.tsx` |
| PATCH | `/auth/onboarding` | NÃO | 1 | `modules/auth/pages/Onboarding.tsx` |
| PATCH | `/auth/provision-workspace` | NÃO | 1 | `app/providers/AuthContext.tsx` |
| PATCH | `/company-settings` | NÃO | 1 | `modules/settings/hooks/useCompanySettings.ts` |
| PATCH | `/notifications/read-all` | NÃO | 1 | `shared/components/MainLayout.tsx` |
| PATCH | `/artist-goals/${id}` | SIM | 1 | `modules/marketing/hooks/useMetas.ts` |
| PATCH | `/audiovisual/assets/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| PATCH | `/audiovisual/deliverables/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| PATCH | `/audiovisual/production-days/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| PATCH | `/audiovisual/projects/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| PATCH | `/audiovisual/shots/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| PATCH | `/audiovisual/tasks/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| PATCH | `/audiovisual/team/${id}` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| PATCH | `/billing/admin/tenants/${tenantId}` | SIM | 1 | `modules/admin/services/admin-tenants.service.ts` |
| PATCH | `/billing/plans/${id}` | SIM | 1 | `modules/admin/services/admin-plans.service.ts` |
| PATCH | `/billing/plans/${plan.id}` | SIM | 1 | `modules/admin/services/admin-plans.service.ts` |
| PATCH | `/briefings/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| PATCH | `/clients/${id}` | SIM | 1 | `modules/crm-relationships/services/clients.service.ts` |
| PATCH | `/conversations/${conversationId}/close` | SIM | 1 | `modules/musicchat/services/conversations.service.ts` |
| PATCH | `/conversations/${conversationId}/reopen` | SIM | 1 | `modules/musicchat/services/conversations.service.ts` |
| PATCH | `/conversations/${conversationId}/transfer` | SIM | 1 | `modules/musicchat/services/conversations.service.ts` |
| PATCH | `/conversations/${conversationId}` | SIM | 1 | `modules/musicchat/services/conversations.service.ts` |
| PATCH | `/financial-categories/${id}/archive` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| PATCH | `/financial-categories/${id}/move` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| PATCH | `/financial-categories/${id}/reorder` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| PATCH | `/financial-categories/${id}/restore` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| PATCH | `/financial-categories/${id}` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| PATCH | `/financial-categories/rules/${id}` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| PATCH | `/leads/${id}` | SIM | 1 | `modules/leads/services/leads.service.ts` |
| PATCH | `/marketing/assets/${id}` | SIM | 3 | `modules/marketing/services/marketing.service.ts` (linhas 459, 556, 563, 587) |
| PATCH | `/marketing/campaigns/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| PATCH | `/marketing/contents/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| PATCH | `/marketing/projects/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| PATCH | `/marketing/tasks/${id}` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| PATCH | `/rbac/roles/${id}` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| PATCH | `/support-tickets/${id}` | SIM | 1 | `modules/support/hooks/useSupport.ts` |
| PATCH | `/users/${id}/role` | SIM | 1 | `modules/settings/hooks/useUsuarios.ts` |
| PATCH | `/users/${id}` | SIM | 1 | `modules/settings/hooks/useUsuarios.ts` |
| PATCH | `/users/${userId}/role` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| PATCH | `${BASE}/settings` | SIM | 1 | `modules/musicchat/services/musicchat-automation.service.ts` |
| PATCH | `${resolved.ep}/${id}` | SIM | 1 | `shared/lib/storage.ts` |
| POST | `/activity-logs` | NÃO | 1 | `modules/marketing/services/marketing.service.ts` |
| POST | `/ai/generate` | NÃO | 1 | `modules/marketing/ai/providers/providerRouter.ts` |
| POST | `/api/v1/ai/generate` | NÃO | 2 | `shared/hooks/useAI.ts`, `modules/contracts/services/semantic-parser.service.ts` |
| POST | `/artist-goals` | NÃO | 1 | `modules/marketing/hooks/useMetas.ts` |
| POST | `/audiovisual/projects` | NÃO | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/auth/change-required-password` | NÃO | 1 | `app/providers/AuthContext.tsx` |
| POST | `/billing/checkout` | NÃO | 1 | `modules/integrations/clients/stripe.client.ts` |
| POST | `/billing/plans` | NÃO | 1 | `modules/admin/services/admin-plans.service.ts` |
| POST | `/billing/portal` | NÃO | 1 | `modules/integrations/clients/stripe.client.ts` |
| POST | `/briefings` | NÃO | 1 | `modules/marketing/services/marketing.service.ts` |
| POST | `/clients` | NÃO | 1 | `modules/crm-relationships/services/clients.service.ts` |
| POST | `/financial-categories` | NÃO | 1 | `modules/accounting/services/financial-categories.service.ts` |
| POST | `/financial-categories/rules` | NÃO | 2 | `modules/accounting/services/financial-categories.service.ts` (linhas 50, 114) |
| POST | `/financial-categories/suggest` | NÃO | 1 | `modules/accounting/services/financial-categories.service.ts` |
| POST | `/integrations/abramus/configure` | NÃO | 1 | `modules/integrations/hooks/useAbramus.ts` |
| POST | `/integrations/abramus/register-work` | NÃO | 1 | `modules/integrations/hooks/useAbramus.ts` |
| POST | `/integrations/apple-music/configure` | NÃO | 1 | `modules/integrations/hooks/useAppleMusic.ts` |
| POST | `/integrations/google-ads/configure` | NÃO | 1 | `modules/integrations/hooks/useGoogleAds.ts` |
| POST | `/integrations/soundcloud/configure` | NÃO | 1 | `modules/integrations/hooks/useSoundCloud.ts` |
| POST | `/integrations/spotify/sync-artist` | NÃO | 1 | `modules/integrations/hooks/useSpotify.ts` |
| POST | `/integrations/tiktok/ads/configure` | NÃO | 1 | `modules/integrations/hooks/useTikTokAds.ts` |
| POST | `/leads` | NÃO | 1 | `modules/leads/services/leads.service.ts` |
| POST | `/marketing/ai-suggestions` | NÃO | 1 | `modules/marketing/services/marketing.service.ts` |
| POST | `/marketing/assets` | NÃO | 3 | `modules/marketing/services/marketing.service.ts` (linhas 455, 543, 601) |
| POST | `/marketing/campaigns/draft` | NÃO | 1 | `modules/marketing/services/marketing.service.ts` |
| POST | `/marketing/contents` | NÃO | 1 | `modules/marketing/services/marketing.service.ts` |
| POST | `/marketing/projects` | NÃO | 1 | `modules/marketing/services/marketing.service.ts` |
| POST | `/marketing/tasks` | NÃO | 1 | `modules/marketing/services/marketing.service.ts` |
| POST | `/public/artists` | NÃO | 1 | `modules/auth/pages/ArtistaSignupPublic.tsx` |
| POST | `/rbac/roles` | NÃO | 1 | `modules/settings/hooks/useRoles.ts` |
| POST | `/support-tickets` | NÃO | 1 | `modules/support/hooks/useSupport.ts` |
| POST | `/uploads/presign` | NÃO | 1 | `shared/hooks/useUploadToR2.ts` |
| POST | `/users/invitations` | NÃO | 1 | `modules/settings/hooks/useRoles.ts` |
| POST | `/artists/${artistId}/platform-profiles/${input.platform}/sync` | SIM | 1 | `modules/artist/hooks/useArtistPlatformProfiles.ts` |
| POST | `/audiovisual/approvals/${id}/decision` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/audiovisual/projects/${id}/transition` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/audiovisual/projects/${projectId}/approvals` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/audiovisual/projects/${projectId}/assets` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/audiovisual/projects/${projectId}/deliverables/seed-defaults` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/audiovisual/projects/${projectId}/deliverables` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/audiovisual/projects/${projectId}/production-days` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/audiovisual/projects/${projectId}/shots/reorder` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/audiovisual/projects/${projectId}/shots` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/audiovisual/projects/${projectId}/tasks` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/audiovisual/projects/${projectId}/team` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| POST | `/billing/admin/tenants/${tenantId}/override/remove` | SIM | 1 | `modules/admin/services/admin-billing.service.ts` |
| POST | `/billing/admin/tenants/${tenantId}/override` | SIM | 1 | `modules/admin/services/admin-billing.service.ts` |
| POST | `/billing/admin/tenants/${tenantId}/reactivate` | SIM | 1 | `modules/admin/services/admin-billing.service.ts` |
| POST | `/billing/admin/tenants/${tenantId}/suspend` | SIM | 1 | `modules/admin/services/admin-billing.service.ts` |
| POST | `/billing/plans/${id}/sync-stripe` | SIM | 1 | `modules/admin/services/admin-plans.service.ts` |
| POST | `/clients/${clientId}/timeline` | SIM | 1 | `modules/crm-relationships/services/clients.service.ts` |
| POST | `/conversations/${conversationId}/messages` | SIM | 1 | `modules/musicchat/services/conversations.service.ts` |
| POST | `/conversations/${conversationId}/notes` | SIM | 1 | `modules/musicchat/services/conversations.service.ts` |
| POST | `/financial-categories/${id}/merge` | SIM | 1 | `modules/accounting/services/financial-categories.service.ts` |
| POST | `/marketing/assets/${id}/request-approval` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| POST | `/marketing/assets/approvals/${pending.id}/decision` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| POST | `/marketing/campaigns/${id}/archive` | SIM | 1 | `modules/marketing/services/marketing.service.ts` |
| POST | `/rbac/roles/${id}/archive` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| POST | `/rbac/roles/${id}/duplicate` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| POST | `/rbac/roles/${id}/restore` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| POST | `/rbac/roles/${roleId}/inheritance` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| POST | `/rbac/roles/${roleId}/permissions/${permissionId}` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| POST | `/reports/entities/${encodeURIComponent(entity)}/import/commit` | SIM | 1 | `modules/reports/services/reports-api.ts` |
| POST | `/reports/entities/${encodeURIComponent(entity)}/import/validate` | SIM | 1 | `modules/reports/services/reports-api.ts` |
| POST | `/uploads/${presign.fileId}/confirm` | SIM | 1 | `shared/hooks/useUploadToR2.ts` |
| POST | `/users/invitations/${id}/resend` | SIM | 1 | `modules/settings/hooks/useRoles.ts` |
| POST | `${API_BASE_URL}/api/v1/integrations/oauth/exchange` | SIM | 1 | `modules/integrations/pages/OAuthCallbackPage.tsx` |
| POST | `${API_BASE_URL}/api/v1/integrations/oauth/init` | SIM | 2 | `modules/settings/pages/Configuracoes.tsx`, `modules/integrations/components/MarketingOAuthDialog.tsx` |
| POST | `${API_BASE_URL}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/logo` | SIM | 1 | `modules/settings/services/company-logo.service.ts` |
| POST | `${BASE}/escalations/run` | SIM | 1 | `modules/musicchat/services/musicchat-automation.service.ts` |
| POST | `${BASE}/inbound` | SIM | 1 | `modules/musicchat/services/musicchat-automation.service.ts` |
| POST | `apiPath` (DEFERRED — ver useACRCloud.ts acima) | SIM | 1 | `modules/integrations/hooks/useACRCloud.ts` |
| POST | `resolved.ep` | SIM | 1 | `shared/lib/storage.ts` |
| PUT | `/audiovisual/projects/${projectId}/briefing` | SIM | 1 | `modules/audiovisual/services/audiovisual.service.ts` |
| PUT | `presign.presignedUrl` | SIM | 1 | `shared/hooks/useUploadToR2.ts` |

## Apêndice — navegações diretas de browser (não são chamadas `fetch`/HTTP request-response)

`modules/integrations/pages/OAuthPopupPage.tsx` também define `OFFICIAL_ACCOUNT_PORTALS` (URLs de portais de plataformas: Meta Business, TikTok Business, Google, Spotify Ads/Artists, DocuSign, Stripe Dashboard) e URLs de distribuidoras (`distrokid.com`, `app.onerpm.com`, `app.symphonicms.com`, `soundon.global`, `app.musicpro.com.br`, `somvibe.com.br`) usadas via `window.location.href`/`popup.location.href` — são **navegações de browser**, não chamadas `fetch`/XHR, portanto **não contabilizadas** em `TOTAL_HTTP_CALL_SITES` acima. Registradas aqui para não perder o achado, já que tecnicamente são "endpoints que o frontend tenta acessar" em sentido amplo, mas não são "operações HTTP" no sentido pedido pelo prompt (método+endpoint via cliente HTTP).

## Cobertura e limitações

- Escopo: `apps/web/src/**/*.{ts,tsx}` — inclui arquivos de teste (`api-client.test.ts`), marcados explicitamente.
- Cobre todas as chamadas via `api.*`/`publicApi.*` (api-client.ts) encontradas por regex (`api\.(get|post|put|patch|delete)(<...>)?\(` e `publicApi\.(get|post)(<...>)?\(`), mais todas as chamadas `fetch(` diretas fora de `api-client.ts`.
- Não foi possível (nem era o objetivo desta etapa) resolver o valor final de endpoints que dependem de parâmetro puramente em runtime sem mapeamento estático visível no arquivo — nenhum caso desse tipo foi encontrado: todo endpoint dinâmico teve sua origem identificada (interpolação de variável, função local, constante local, mapping local enumerável, ou `TABLE_ENDPOINT`).
- `shared/lib/storage.ts` é uma camada genérica: as 5 linhas do inventário para esse arquivo representam o *padrão* de chamada (usa `TABLE_ENDPOINT` via `resolveTable()`), não uma lista de todas as tabelas que efetivamente passam por ele em runtime — isso exigiria rastrear todo caller de `storage.ts` (fora do escopo "não mapear ainda todos os endpoints" / próxima etapa).

> Historical record. Kept as recorded; not the current contract.

# 06 — Contratos de Request dos Endpoints HTTP do Frontend

Extraído a partir de [`05-http-endpoint-inventory.md`](./05-http-endpoint-inventory.md). Nenhum arquivo foi alterado. Escopo desta etapa: path params, query params, request body, headers específicos por chamada. Response bodies, status codes, paginação de resposta, permissões e regras de negócio **não foram analisados**.

## Limitação conhecida herdada do Prompt 08 (registrada, não corrigida)

Ao ler o código-fonte completo de cada arquivo para extrair os contratos de request, foram encontradas chamadas `api.get<...>`/`api.post<...>` que **não aparecem** no inventário de 270 call sites do doc 05. Causa raiz: o regex usado no Prompt 08 (`api\.(get|post|...)(<[^>]*>)?\(`) não reconhece **tipos genéricos aninhados** como `api.get<ApiList<RecordRow>>(...)` ou `api.get<Record<string, {configured: boolean}>>(...)` — o `[^>]*` para no primeiro `>` interno e a captura falha. Isso é uma lacuna real do inventário anterior, não desta etapa. Por instrução explícita ("não alterar documentação criada anteriormente"), doc 05 **não foi editado** e os totais oficiais abaixo cobrem exclusivamente os 270 call sites já inventariados. As chamadas adicionais encontradas incidentalmente estão listadas à parte, no Apêndice B, para não se perderem.

---

## `app/providers/AuthContext.tsx`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| PATCH | `/auth/provision-workspace` | AUSENTE | AUSENTE | objeto literal: `{ organizationName, workspaceName, workspaceSlug, segment, tradeName, corporateEmail, phone, address, city, state, requestedPlan, acceptedTerms, acceptedLgpd }` — todos `string \| unknown` lidos de `session.user.user_metadata` (Supabase), tipo `unknown` em cada campo (metadata é `Record<string, unknown>`) | gerenciados globalmente por api-client.ts (Authorization + X-Tenant-ID) |
| POST | `/auth/change-required-password` | AUSENTE | AUSENTE | objeto literal: `{ newPassword: string, confirmPassword: string }` — params da função `changeRequiredPassword` | idem |

## `app/providers/TenantContext.tsx`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/auth/context` | AUSENTE | AUSENTE | AUSENTE | idem |

## `app/providers/BillingContext.tsx`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/billing/subscription` | AUSENTE | AUSENTE | AUSENTE | idem |

## `modules/workspace/hooks/useWorkspace.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `${ENTITY_ROUTE_MAP[workspaceType]}/${workspaceId}` | `workspaceId` — origem: parâmetro do hook `useWorkspace(workspaceType, workspaceId)`, tipo `string`, obrigatório (query `enabled: Boolean(workspaceId)`) | AUSENTE | AUSENTE | idem |
| GET | `/activity-logs?entityType=${...}&entityId=${...}` | AUSENTE | `entityType` — origem: parâmetro `workspaceType` (`WorkspaceEntityType`, enum aparente: `artist\|release\|campaign\|project\|contract`), obrigatório; `entityId` — origem: parâmetro `workspaceId`, `string`, obrigatório | AUSENTE | idem |

## `modules/support/hooks/useSupport.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/support-tickets?limit=200` | AUSENTE | `limit=200` — literal fixo | AUSENTE | idem |
| POST | `/support-tickets` | AUSENTE | AUSENTE | objeto literal: `{ subject: string, description: string, category: TicketCategory (enum aparente), priority: TicketPriority (enum aparente) }` — de `Pick<SupportTicket,...>` | idem |
| PATCH | `/support-tickets/${id}` | `id` — origem: parâmetro da mutation `{id, changes}`, `string`, obrigatório | AUSENTE | `changes: Partial<SupportTicket>` — objeto arbitrário repassado como veio, campos não expandidos (tipo `Partial<SupportTicket>`, UNKNOWN quais chegam efetivamente) | idem |

## `modules/leads/services/leads.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/leads?limit=200` | AUSENTE | `limit=200` literal | AUSENTE | idem |
| POST | `/leads` | AUSENTE | AUSENTE | via `toApiPayload()`: `{ name: string, nomeArtistico?: string, empresa?: string, email?: string, phone: string (=whatsapp), whatsapp?: string, instagram?: string, cidade?: string, estado?: string, pais?: string, tipoCliente: LeadClientType (enum aparente), tipoServico: LeadServiceType (enum aparente), payloadServico: object, dadosInternosCRM: object, uploads: unknown[] }` | idem |
| PATCH | `/leads/${id}` | `id` — origem: parâmetro `update(id, data)`, `string`, obrigatório | AUSENTE | objeto **parcial montado condicionalmente** (só inclui chaves de `data` que não são `undefined`): possíveis campos `name, nomeArtistico, empresa, email, phone, whatsapp, instagram, cidade, estado, pais, tipoCliente, tipoServico, payloadServico, uploads, dadosInternosCRM (sem statusLead), status (de dadosInternosCRM.statusLead)` | idem |
| DELETE | `/leads/${id}` | `id` — mesmo padrão acima | AUSENTE | AUSENTE | idem |

## `modules/settings/services/company-logo.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| DELETE | `/workspaces/${encodeURIComponent(workspaceId)}/logo` | `workspaceId` — parâmetro `removeLogo(workspaceId)`, `string`, obrigatório (função retorna cedo se vazio) | AUSENTE | AUSENTE | gerenciados globalmente |
| POST (fetch direto) | `${API_BASE_URL}/api/v1/workspaces/${encodeURIComponent(workspaceId)}/logo` | `workspaceId` — parâmetro `saveLogo(workspaceId, file)`, `string`, obrigatório | AUSENTE | **FormData**: um único campo `file` (tipo `File`) — multipart, sem `Content-Type` manual (browser define o boundary) | **específicos desta chamada**: `Authorization: Bearer <token>` (se `getAccessToken()` retornar valor) e `X-Tenant-ID: <tenantId>` (se `getTenantId()` retornar valor) — montados manualmente, fora do api-client |

## `modules/settings/services/billing-plans.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/billing/plans` | AUSENTE | AUSENTE | AUSENTE | gerenciados globalmente |

## `modules/settings/services/billing-invoices.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/billing/invoices` | AUSENTE | AUSENTE | AUSENTE | gerenciados globalmente |

## `shared/lib/storage.ts` (camada genérica sobre `TABLE_ENDPOINT`)

Todos os 5 métodos recebem `table: string` (nome lógico, resolvido via `TABLE_ENDPOINT`/`PENDING_TABLES` — ver doc 05) e, quando aplicável, `id: string`. Os contratos abaixo são os do **wrapper genérico**; o shape real do body depende de qual chamador de `storage.ts` está sendo usado (fora do escopo desta etapa rastrear todo caller).

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `${resolved.ep}${qs?...}` (list) | AUSENTE | dinâmico via `ListOptions`: `filters` (Record arbitrário → um par chave/valor por filtro), `orderBy.column`/`ascending` (`orderBy`, `ascending` booleano), `limit`, `offset` — todos opcionais | AUSENTE | gerenciados globalmente |
| GET | `${resolved.ep}/${id}` (findById/getById) | `id` — parâmetro, `string`, obrigatório | AUSENTE | AUSENTE | idem |
| POST | `resolved.ep` (create) | AUSENTE | AUSENTE | `data: Omit<T, "id"\|"user_id"\|"created_at"\|"updated_at">` — genérico, campos UNKNOWN (dependem de `T`, não fixados aqui) | idem |
| PATCH | `${resolved.ep}/${id}` (update) | `id` — obrigatório | AUSENTE | `data: Partial<T>` — genérico, campos UNKNOWN | idem |
| DELETE | `${resolved.ep}/${id}` (delete) | `id` — obrigatório | AUSENTE | AUSENTE | idem |

## `shared/lib/api-client.test.ts` (arquivo de teste)

3 chamadas usadas apenas para exercitar o mapeamento de erro (`DELETE /financial-categories/category-1`, `GET /artists` ×2) — sem path/query params dinâmicos reais (valores literais de teste), sem body relevante (as chamadas testam `mapError()`, não o payload). Não aprofundado além disso — são fixtures de teste, não contratos de produção.

## `modules/integrations/hooks/useMarketingOAuth.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/oauth/status?platform=...` (×2, mesmo padrão em `refreshConnection` e no `useEffect`) | AUSENTE | `platform` — origem: parâmetro `platform: MarketingPlatformId` (enum de ~19 valores — ver doc 04/05), obrigatório, `encodeURIComponent` | AUSENTE | gerenciados globalmente |
| DELETE | `/integrations/oauth/disconnect?platform=...` | AUSENTE | `platform` — mesma origem/tipo acima | AUSENTE | idem |

## `modules/settings/hooks/useUsuarios.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/users?limit=100&offset=0` | AUSENTE | `limit=100`, `offset=0` — literais fixos | AUSENTE | idem |
| PATCH | `/users/${id}` | `id` — parâmetro `UpdateUsuarioInput.id`, `string`, obrigatório | AUSENTE | objeto **condicional**: `{ fullName?, phone?, status? }` — só inclui chaves presentes em `input`; `status` convertido `"ativo"→"active"`/`"inativo"→"inactive"`; **só é enviado se objeto resultante tiver ≥1 chave** | idem |
| PATCH | `/users/${id}/role` | `id` — mesmo | AUSENTE | `{ role: string }` — de `input.role ?? input.cargo`; **só enviado se `effectiveRole !== undefined`** | idem |

## `modules/integrations/hooks/useTikTok.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/tiktok/status` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/integrations/tiktok/auth` | AUSENTE | AUSENTE | AUSENTE | idem |
| DELETE | `/integrations/tiktok/disconnect` | AUSENTE | AUSENTE | AUSENTE | idem |

## `modules/integrations/hooks/useDeezer.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/deezer/artist/${artistId}` | `artistId` — parâmetro do hook, `string \| undefined`, obrigatório (`enabled: !!artistId`) | AUSENTE | AUSENTE | idem |
| GET | `/integrations/deezer/artist/${artistId}/top?limit=${limit}` | `artistId` — mesmo | `limit` — parâmetro do hook, `number`, default `10` | AUSENTE | idem |

## `modules/settings/hooks/useCompanySettings.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/company-settings` | AUSENTE | AUSENTE | AUSENTE | idem |
| PATCH | `/company-settings` | AUSENTE | AUSENTE | via `toUpdateDto()`: `{ legalName, tradeName, cnpj?, stateRegistration, contactName, address: { zipCode, street, number, complement, city, state }, phone, banking: { bankName, agency, account } }` — todos `string \| undefined`, derivados de `Partial<CompanySettings>` (form em pt-BR) | idem |

## `modules/integrations/hooks/useYouTube.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/youtube/channel/${channelId}` | `channelId` — parâmetro do hook, `string \| undefined`, obrigatório | AUSENTE | AUSENTE | idem |
| GET | `/integrations/youtube/video/${videoId}` | `videoId` — parâmetro do hook, `string \| undefined`, obrigatório | AUSENTE | AUSENTE | idem |

## `modules/settings/hooks/useRoles.ts` (16 call sites)

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/rbac/roles?includeArchived=true` | AUSENTE | `includeArchived=true` literal | AUSENTE | idem |
| GET | `/rbac/permissions` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/rbac/grants` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/users?limit=100` | AUSENTE | `limit=100` literal | AUSENTE | idem |
| GET | `/users/invitations` | AUSENTE | AUSENTE | AUSENTE | idem |
| POST | `/rbac/roles` | AUSENTE | AUSENTE | `{ name: string, description: string\|null, slug?: string, isAssignable: boolean (default true), permissionIds: string[] (default []) }` | idem |
| PATCH | `/rbac/roles/${id}` | `id` — obrigatório | AUSENTE | `{ name?, description?, isAssignable? }` — subset de `Role` | idem |
| POST | `/rbac/roles/${id}/duplicate` | `id` — obrigatório | AUSENTE | `{ name: string }` | idem |
| POST | `/rbac/roles/${id}/archive` | `id` — obrigatório | AUSENTE | objeto vazio `{}` | idem |
| POST | `/rbac/roles/${id}/restore` | `id` — obrigatório | AUSENTE | objeto vazio `{}` | idem |
| POST | `/rbac/roles/${roleId}/inheritance` | `roleId` — obrigatório | AUSENTE | `{ parentRoleId: string }` | idem |
| DELETE | `/rbac/roles/${roleId}/inheritance/${parentRoleId}` | `roleId`, `parentRoleId` — ambos obrigatórios | AUSENTE | AUSENTE | idem |
| POST | `/rbac/roles/${roleId}/permissions/${permissionId}` | `roleId`, `permissionId` — ambos obrigatórios | AUSENTE | objeto vazio `{}` | idem |
| DELETE | `/rbac/roles/${roleId}/permissions/${permissionId}` | `roleId`, `permissionId` — ambos obrigatórios | AUSENTE | AUSENTE | idem |
| PATCH | `/users/${userId}/role` | `userId` — obrigatório | AUSENTE | `{ role: string }` — resolvido de `roles.find(id===roleId)?.slug`, lança erro local se não encontrado | idem |
| POST | `/users/invitations` | AUSENTE | AUSENTE | `{ email: string, roleId?: string }` — lança erro local se `!roleId` | idem |
| DELETE | `/users/invitations/${id}` | `id` — obrigatório | AUSENTE | AUSENTE | idem |
| POST | `/users/invitations/${id}/resend` | `id` — obrigatório | AUSENTE | objeto vazio `{}` | idem |
| GET | `/rbac/roles/${roleId}` (getRoleDetail) | `roleId` — obrigatório | AUSENTE | AUSENTE | idem |

## `modules/settings/hooks/useAuditTrail.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `\audit-logs${qs?...}` _(ANOMALIA já registrada no doc 05 — barra invertida)_ | AUSENTE | `action?, entity?, entityId?, actorRole?, correlationId?, fromDate?, toDate?` (todos `string`, opcionais, de `AuditTrailFilters`) + `limit` (número, default 100), `offset` (número, default 0), `orderBy="created_at"` (literal), `ascending="false"` (literal) — os dois últimos sempre enviados | AUSENTE | idem |

## `modules/integrations/hooks/useTikTokAds.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/tiktok/ads/status` | AUSENTE | AUSENTE | AUSENTE | idem |
| POST | `/integrations/tiktok/ads/configure` | AUSENTE | AUSENTE | `{ appId: string, secret: string, advertiserId?: string, accessToken: "" (sempre string vazia — hard-coded) }` — de `TikTokAdsCredentials` | idem |
| DELETE | `/integrations/tiktok/ads/disconnect` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/integrations/tiktok/ads/campaigns` | AUSENTE | AUSENTE | AUSENTE | idem |

## `modules/integrations/hooks/useStripe.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/billing/subscription` | AUSENTE | AUSENTE | AUSENTE | idem |

## `modules/integrations/hooks/useSpotify.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/spotify/auth` (×2 — `useSpotifySaveCredentials` e `useSpotifyConnect`) | AUSENTE | AUSENTE | AUSENTE | idem |
| DELETE | `/integrations/spotify/disconnect` | AUSENTE | AUSENTE | AUSENTE | idem |
| POST | `/integrations/spotify/sync-artist` | AUSENTE | AUSENTE | `{ spotifyUrl: string }` — parâmetro da mutation | idem |

## `modules/integrations/hooks/useSoundCloud.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/soundcloud/status` | AUSENTE | AUSENTE | AUSENTE | idem |
| POST | `/integrations/soundcloud/configure` | AUSENTE | AUSENTE | `{ clientId: string, clientSecret: string }` — de `SoundCloudCredentials` (campo `permalink` do input NÃO é enviado) | idem |
| DELETE | `/integrations/soundcloud/disconnect` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/integrations/soundcloud/user?url=...` | AUSENTE | `url` — parâmetro `permalinkUrl`, `string \| undefined`, obrigatório, `encodeURIComponent` | AUSENTE | idem |
| GET | `/integrations/soundcloud/track/${trackId}` | `trackId` — parâmetro do hook, `string \| undefined`, obrigatório | AUSENTE | AUSENTE | idem |

## `modules/integrations/hooks/useInstagram.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/instagram/status` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/integrations/instagram/auth` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/integrations/instagram/metrics` | AUSENTE | AUSENTE | AUSENTE | idem |
| DELETE | `/integrations/instagram/disconnect` | AUSENTE | AUSENTE | AUSENTE | idem |

## `modules/integrations/hooks/useGoogleAds.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/google-ads/status` | AUSENTE | AUSENTE | AUSENTE | idem |
| POST | `/integrations/google-ads/configure` | AUSENTE | AUSENTE | `{ developerToken: string, customerId: string }` (de `manager_account_id ?? client_id`) — de `GoogleAdsCredentials`; **campos `client_id`/`client_secret` do input NÃO são enviados** | idem |
| GET | `/integrations/google-ads/auth` | AUSENTE | AUSENTE | AUSENTE | idem |
| DELETE | `/integrations/google-ads/disconnect` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/integrations/google-ads/campaigns` | AUSENTE | AUSENTE | AUSENTE | idem |

## `modules/integrations/hooks/useAppleMusic.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/apple-music/status` | AUSENTE | AUSENTE | AUSENTE | idem |
| POST | `/integrations/apple-music/configure` | AUSENTE | AUSENTE | `{ teamId: string, keyId: string, privateKey: string }` — de `AppleMusicCredentials`; **campo `artist_id` do input NÃO é enviado** | idem |
| DELETE | `/integrations/apple-music/disconnect` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/integrations/apple-music/artist/${artistId}?storefront=${storefront}` | `artistId` — parâmetro, `string \| undefined`, obrigatório | `storefront` — parâmetro, `string`, default `"br"` | AUSENTE | idem |

## `modules/integrations/hooks/useAbramus.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/integrations/abramus/status` | AUSENTE | AUSENTE | AUSENTE | idem |
| POST | `/integrations/abramus/configure` | AUSENTE | AUSENTE | `{ username: string (trim), password: string, baseUrl: string (trim, default "") }` — valida localmente que username/password não vazios antes de enviar | idem |
| DELETE | `/integrations/abramus/disconnect` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/integrations/abramus/search-work?q=...&kind=...` | AUSENTE | `q` — parâmetro `query` (trim), `string`, obrigatório (`enabled: length>=2`); `kind` — parâmetro `AbramusKind` (enum: `obras\|fonogramas`), obrigatório | AUSENTE | idem |
| GET | `/integrations/abramus/search-artist?q=...&limit=10` | AUSENTE | `q` — parâmetro `query` (trim), obrigatório; `limit=10` literal | AUSENTE | idem |
| POST | `/integrations/abramus/register-work` | AUSENTE | AUSENTE | `{ titulo: string, compositor: string (=compositores[0] ?? ""), coautores: string[] (=compositores.slice(1)), iswc?: string, genero?: string, duracao?: string, editora?: string }` — de `RegisterObraInput` | idem |

## `modules/musicchat/services/conversations.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/conversations?limit=200` | AUSENTE | `limit=200` literal | AUSENTE | idem |
| GET | `/conversations/${conversationId}/messages?limit=200` | `conversationId` — parâmetro, `string`, obrigatório | `limit=200` literal | AUSENTE | idem |
| POST | `/conversations/${conversationId}/messages` | `conversationId` — obrigatório | AUSENTE | `{ body: string, attachments: ChatAttachmentData[] }` — parâmetros de `sendMessage` | idem |
| POST | `/conversations/${conversationId}/notes` | `conversationId` — obrigatório | AUSENTE | `{ body: string }` | idem |
| PATCH | `/conversations/${conversationId}` | `conversationId` — obrigatório | AUSENTE | `payload: Record<string, unknown>` — repassado como veio, UNKNOWN quais campos (genérico) | idem |
| PATCH | `/conversations/${conversationId}/transfer` | `conversationId` — obrigatório | AUSENTE | `{ assignee_id: string }` | idem |
| PATCH | `/conversations/${conversationId}/close` | `conversationId` — obrigatório | AUSENTE | `{ reason: "Finalizada no MusicChat", service_status: "resolvida" }` — literais fixos | idem |
| PATCH | `/conversations/${conversationId}/reopen` | `conversationId` — obrigatório | AUSENTE | `{ reason: "Reaberta no MusicChat" }` — literal fixo | idem |
| DELETE | `/conversations/${conversationId}` (archive) | `conversationId` — obrigatório | AUSENTE | AUSENTE | idem |

## `modules/musicchat/services/musicchat-automation.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `${BASE}/settings` (`BASE="/conversations/musicchat/automation"`) | AUSENTE | AUSENTE | AUSENTE | idem |
| PATCH | `${BASE}/settings` | AUSENTE | AUSENTE | `payload: Partial<MusicChatAutomationSettings>` — genérico, UNKNOWN campos exatos | idem |
| POST | `${BASE}/inbound` | AUSENTE | AUSENTE | `payload: MusicChatInboundMessagePayload` — tipo nomeado, campos não expandidos aqui (fora do arquivo lido) | idem |
| POST | `${BASE}/escalations/run` | AUSENTE | AUSENTE | `{ conversationId?: string }` | idem |
| GET | `${BASE}/events${query}` | AUSENTE | `conversationId` — opcional, `encodeURIComponent` | AUSENTE | idem |

## `modules/integrations/clients/stripe.client.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST | `/billing/checkout` | AUSENTE | AUSENTE | `{ plan: string, successUrl: string, cancelUrl: string }` | idem |
| POST | `/billing/portal` | AUSENTE | AUSENTE | `{ returnUrl: string }` | idem |
| GET | `/billing/subscription` | AUSENTE | AUSENTE | AUSENTE | idem |

## `shared/hooks/useUploadToR2.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST | `/uploads/presign` | AUSENTE | AUSENTE | `{ fileName: string, mimeType: string, sizeBytes: number, category: UploadCategory (enum: documents\|images\|audio\|spreadsheets), entity?: string, entityId?: string }` | idem |
| POST | `/uploads/${presign.fileId}/confirm` | `presign.fileId` — obtido da resposta do passo anterior (`/uploads/presign`), `string` | AUSENTE | objeto vazio `{}` (trecho lido não mostrou payload de confirm além do path — corpo aparenta vazio) | idem |
| PUT (fetch direto, destino Cloudflare R2) | `presign.presignedUrl` | N/A (não é rota apps/api) | N/A | corpo = `opts.file` (`File`) — upload binário direto | **específicos**: `Content-Type: <opts.file.type>` — comentário explícito no código: "sem headers de auth (URL já está assinada)" |

## `modules/reports/services/reports-api.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/reports/entities` | AUSENTE | AUSENTE | AUSENTE | gerenciados globalmente |
| GET | `/reports/definitions` | AUSENTE | AUSENTE | AUSENTE | idem |
| POST | `/reports/entities/${entity}/import/validate` | `entity` — parâmetro, `string`, `encodeURIComponent` | AUSENTE | `body: ImportUploadBody` = `{ filename: string, mimeType: "application/vnd...sheet" (literal), contentBase64: string }` | idem |
| POST | `/reports/entities/${entity}/import/commit` | `entity` — mesmo | AUSENTE | `body: ImportUploadBody` — mesmo shape acima | idem |
| GET (fetch direto) | `${API_BASE_URL}/api/v1/reports/entities/${entity}/export?${buildExportQuery(params)}` | `entity` — obrigatório | via `buildExportQuery(ExportParams)`: `format` (`"xlsx"`, sempre enviado), `columns?` (string[], join por vírgula), `sort?`, `order?` (`"ASC"\|"DESC"`), `page?` (number), `pageSize?` (number), + todos os pares de `filters?: Record<string,string>` | AUSENTE (é GET) | **específicos**: `Authorization`/`X-Tenant-ID` via `authenticatedHeaders()` (reusa `getAccessToken()`/`getTenantId()` de api-client.ts) |
| GET (fetch direto) | `${API_BASE_URL}/api/v1/reports/entities/${entity}/import/template` | `entity` — obrigatório | AUSENTE | AUSENTE | **específicos**: mesmos `Authorization`/`X-Tenant-ID` via `authenticatedHeaders()` |

## `shared/components/MainLayout.tsx`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| PATCH | `/notifications/read-all` | AUSENTE | AUSENTE | objeto vazio `{}` | gerenciados globalmente |

## `modules/dashboard/hooks/useOperationalDashboard.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/analytics/dashboard` | AUSENTE | AUSENTE | AUSENTE | idem |

## `modules/dashboard/hooks/useActivityHistory.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/audit-logs?limit=${limit}` | AUSENTE | `limit` — parâmetro do hook, `number`, default `30` | AUSENTE | idem |

## `modules/marketing/services/marketing.service.ts` (41 call sites — recorte por sub-recurso)

**Projects** (`projectsApi`): `create` POST `/marketing/projects` body via `projectToApi()` = `{ type: string (upper), title, description, status, priority, artistId, startsAt, endsAt, metadata: { uiStatus, uiPriority, owner, team, objective, audience, channels, taskIds, campaignIds, contentIds, briefingIds, files, progress } }`; `update` faz **GET `/marketing/projects/${id}` seguido de PATCH mesmo path** com o mesmo shape de `projectToApi()` sobre `{...current, ...patch}`; `remove` DELETE `/marketing/projects/${id}`. `id` sempre path param obrigatório.

**Campaigns** (`campaignsApi`): `create` POST `/marketing/campaigns/draft` body via `campaignToBuilder()` = `{ name, objective, promotedEntityType (upper), promotedEntityId, promotedEntityName, platforms, totalBudget, budgetType: "TOTAL" (literal), startDate, endDate, audience: {description} ou {}, type, owner, projectId, creativeAssetIds, contentIds, metrics, notes }`; `update` GET `/marketing/campaigns/${id}` + PATCH mesmo path, mesmo shape; `remove` **na verdade é POST `/marketing/campaigns/${id}/archive`** com body vazio `{}` (não é DELETE real — soft-archive).

**Contents** (`contentsApi`): `create` POST `/marketing/contents` body = `input` repassado cru (tipo `CreateInput<MarketingContent>`, campos UNKNOWN aqui — validado localmente via `assertValidContent(channel,type,files)` antes de enviar); `update` PATCH `/marketing/contents/${id}` body = `patch` cru; `remove` DELETE `/marketing/contents/${id}`.

**Briefings** (`briefingsApi`): `create` POST `/briefings` body via `briefingToApi()` = `{ title, campaignId, content (=context), dueAt, status, metadata: {...input, uiStatus: status} }`; `update` GET `/briefings/${id}` + PATCH mesmo path, mesmo shape; `remove` DELETE `/briefings/${id}`.

**Tasks** (`tasksApi`): `create` POST `/marketing/tasks` body via `taskToApi()` = `{ marketingProjectId (obrigatório, lança erro local se ausente), title, description, status, priority, kind (=type), assignedTo (=owner\|\|null), dueDate (=deadline\|\|null), dependencies, metadata: {targetType,targetId,targetName,uiType,uiStatus,uiPriority,owner,sector,campaignId,briefingId,releaseId,contentId,files,referenceAudio,checklist,comments,history,automationFlowId} }`; `update` GET `/marketing/tasks/${id}` + PATCH mesmo path, mesmo shape; `remove` DELETE `/marketing/tasks/${id}`.

**Assets** (`assetsApi`): `create` POST `/marketing/assets` body via `assetToApi()` = `{ title (=name), assetType (=category, upper), fileUrl (=url), description (=notes), thumbnailUrl, projectId, taskId, sourceDepartment, campaignId, artistId, tags, metadata: {owner, department} }`; `update` GET `/marketing/assets/${id}` + PATCH mesmo path, mesmo shape; `remove` DELETE `/marketing/assets/${id}`.

**Deliverables** (`deliverablesApi`, também usa `/marketing/assets` como backend): `create` POST `/marketing/assets` body = `{ title, description, assetType (=type.upper), fileUrl (=file.url), mimeType (=file.mimeType), sizeBytes: String(file.size), taskId, metadata: {fileName: file.name, comments: []} }`; `update` PATCH `/marketing/assets/${id}` body = `{ title?, description?, assetType? (=type?.upper) }`; `addVersion` PATCH `/marketing/assets/${id}` body = `{ fileUrl, mimeType, sizeBytes: String(size), changeNotes: note, metadata: {fileName} }`; `setApproval("em_revisao")` POST `/marketing/assets/${id}/request-approval` body `{}`, depois GET `/marketing/assets/${id}`; `setApproval(outro)` GET `/marketing/assets/${id}/approvals` → POST `/marketing/assets/approvals/${pending.id}/decision` body `{ status: "approved"|"rejected" }` → GET `/marketing/assets/${id}`; `addComment` GET `/marketing/assets/${id}` → PATCH mesmo path body `{ metadata: {...metadata(row), comments: [...comments, {id: crypto.randomUUID(), author, message: message.trim(), createdAt: ISO}] } }`; `duplicate` GET `/marketing/assets/${id}` → POST `/marketing/assets` body copiando campos do row lido (`title` com sufixo " (cópia)", `description`, `assetType`, `fileUrl`, `thumbnailUrl`, `mimeType`, `sizeBytes`, `marketingProjectId`, `taskId`, `tags`, `metadata`); `remove` DELETE `/marketing/assets/${id}`. Também: `deliverableFromApi()` faz GET `/marketing/assets/${row.id}/versions` (sem params) para montar `versions[]`.

**Outros métodos do `marketingService`**: `getCampaignBuilderConfig` GET `/marketing/campaign-builder/config`, sem params; `getActivity` GET `/activity-logs?entityType=marketing&limit=50` (query fixa); `logActivity` POST `/activity-logs` body `{ entity_type: "marketing" (literal), entity_id: crypto.randomUUID() (gerado no cliente!), action, description (=subject), user_name (=author), metadata: {source:"marketing", entity} }`; `getAiSuggestions` GET `/marketing/ai-suggestions`, sem params; `addAiSuggestion` POST `/marketing/ai-suggestions` body = `suggestion: Omit<AiSuggestion,"id"|"at">` cru (campos UNKNOWN).

Todos os `id`/`projectId`/`campaignId`/etc. acima são **path params obrigatórios** (`string`). Nenhum header específico por chamada — todos via `api` (canonical, headers globais).

## `modules/marketing/hooks/useMetas.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST | `/artist-goals` | AUSENTE | AUSENTE | via `toApi()`: `{ artista_id: string (obrigatório, lança erro local se ausente), titulo: string, tipo: string, meta_valor: string (numérico serializado), valor_atual: string, status: string (default "em_andamento"), data_inicio?, data_fim?, metadata: {descricao, categoria, unidade, responsavel, cor, icone} }` | idem |
| GET | `/artist-goals/${id}` | `id` — obrigatório | AUSENTE | AUSENTE | idem |
| PATCH | `/artist-goals/${id}` | `id` — obrigatório | AUSENTE | mesmo shape de `toApi()` acima, aplicado sobre o registro atual mesclado com `input` | idem |
| DELETE | `/artist-goals/${id}` | `id` — obrigatório | AUSENTE | AUSENTE | idem |

## `modules/marketing/hooks/useMarketingAssets.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/marketing/assets/project/${projectId}/library` | `projectId` — parâmetro do hook, `string \| null \| undefined`, obrigatório (`enabled`) | AUSENTE | AUSENTE | idem |

## `modules/crm-relationships/services/clients.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/clients${qs?...}` | AUSENTE | `status?, category?, limit?, offset?` de `params` — **nota: `params.search` existe na assinatura da função mas NUNCA é adicionado ao `URLSearchParams` — campo aceito e silenciosamente descartado, não chega ao backend** | AUSENTE | idem |
| POST | `/clients` | AUSENTE | AUSENTE | `data: CreateApiClientInput` = `{ name: string, type?: "person"\|"company", category?, email?, phone?, document?, address?: object\|string, metadata?, city?, state?, instagram?, zipCode?, responsible?, notes? }` | idem |
| PATCH | `/clients/${id}` | `id` — obrigatório | AUSENTE | `data: UpdateApiClientInput` = `Partial<CreateApiClientInput> & { status?: "active"\|"inactive"\|"blocked" }` | idem |
| DELETE | `/clients/${id}` | `id` — obrigatório | AUSENTE | AUSENTE | idem |
| GET | `/clients/${clientId}/timeline` | `clientId` — obrigatório | AUSENTE | AUSENTE | idem |
| POST | `/clients/${clientId}/timeline` | `clientId` — obrigatório | AUSENTE | `{ type: string, description: string }` | idem |
| GET | `/clients/${clientId}/contracts` | `clientId` — obrigatório | AUSENTE | AUSENTE | idem |
| GET | `/clients/${clientId}/attachments` | `clientId` — obrigatório | AUSENTE | AUSENTE | idem |
| DELETE | `/clients/${clientId}/attachments/${attachmentId}` | `clientId`, `attachmentId` — ambos obrigatórios | AUSENTE | AUSENTE | idem |

## `modules/auth/services/activation-plans.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET (publicApi) | `/public/activation-plans` | AUSENTE | AUSENTE | AUSENTE | sem Authorization/X-Tenant-ID (rota pública — publicApi não injeta esses headers) |

## `modules/auth/pages/Onboarding.tsx`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| PATCH | `/auth/onboarding` | AUSENTE | AUSENTE | `{ companyName: string (trim), segment: string, logoUrl?: string (trim), settings: { timezone: string, locale: "pt-BR" (literal), currency: "BRL" (literal) } }` | gerenciados globalmente |

## `modules/auth/pages/ArtistaSignupPublic.tsx`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST (publicApi) | `/public/artists` | AUSENTE | AUSENTE | `{ workspaceSlug: string, ...artistaPayload (24 campos: nome_artistico, nome_civil, genero_musical, genero, especialidades[], observacoes, foto_url, documentos_pessoais_url, presskit_url, data_nascimento, cpf_cnpj, rg, endereco, telefone, email, banco, agencia, conta, chave_pix, titular_conta, spotify_artist_url, youtube_channel_url, instagram, tiktok, deezer_url, apple_music_url, soundcloud_url, tipo_perfil, contatos_equipe[], distribuidoras_gerais[], notas_internas, status:"ativo" (literal), origem:"public_artist_form" (literal)), acceptedTerms: boolean, companyWebsite: string (honeypot anti-bot) }` | sem Authorization/X-Tenant-ID (rota pública) |

## `modules/artist/hooks/useArtistPlatformProfiles.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/artists/${artistId}/platform-profiles` | `artistId` — obrigatório | AUSENTE | AUSENTE | gerenciados globalmente |
| POST | `/artists/${artistId}/platform-profiles/${platform}/sync` | `artistId`, `platform` (`SocialPlatform`: `spotify\|youtube`) — ambos obrigatórios | AUSENTE | `{ profileUrl: string, source: "profile_url" (literal) }` | idem |

## `modules/audiovisual/services/audiovisual.service.ts` (41 call sites — via `@/lib/api`, mesmo cliente canônico)

Todos os endpoints usam a função local `q(params)` para query string (serializa qualquer par não-nulo/vazio de um objeto).

| Sub-recurso | MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY |
|---|---|---|---|---|---|
| projects.list | GET | `/audiovisual/projects${q(p)}` | AUSENTE | `search?, status? (AudiovisualProjectStatus), type? (AudiovisualProjectType), artist_id?, release_id?, campaign_id?, event_id?, limit?, offset?` | AUSENTE |
| projects.dashboard | GET | `/audiovisual/projects/dashboard${q(p)}` | AUSENTE | `from?, to?` | AUSENTE |
| projects.findById | GET | `/audiovisual/projects/${id}` | `id` | AUSENTE | AUSENTE |
| projects.create | POST | `/audiovisual/projects` | AUSENTE | AUSENTE | `Partial<AudiovisualProject>` — genérico |
| projects.update | PATCH | `/audiovisual/projects/${id}` | `id` | AUSENTE | `Partial<AudiovisualProject>` |
| projects.transition | POST | `/audiovisual/projects/${id}/transition` | `id` | AUSENTE | `{ status: AudiovisualProjectStatus, reason?: string }` |
| projects.delete | DELETE | `/audiovisual/projects/${id}` | `id` | AUSENTE | AUSENTE |
| briefings.get | GET | `/audiovisual/projects/${projectId}/briefing` | `projectId` | AUSENTE | AUSENTE |
| briefings.upsert | PUT | `/audiovisual/projects/${projectId}/briefing` | `projectId` | AUSENTE | `Partial<AudiovisualBriefing>` |
| deliverables.list | GET | `/audiovisual/deliverables${q(p)}` | AUSENTE | `audiovisual_project_id?, status?, limit?, offset?` | AUSENTE |
| deliverables.findById | GET | `/audiovisual/deliverables/${id}` | `id` | AUSENTE | AUSENTE |
| deliverables.create | POST | `/audiovisual/projects/${projectId}/deliverables` | `projectId` | AUSENTE | `{ title: string, type: DeliverableType, ...Partial<AudiovisualDeliverable> }` |
| deliverables.seedDefaults | POST | `/audiovisual/projects/${projectId}/deliverables/seed-defaults` | `projectId` | AUSENTE | `{ project_type: string }` |
| deliverables.update | PATCH | `/audiovisual/deliverables/${id}` | `id` | AUSENTE | `Partial<AudiovisualDeliverable>` |
| deliverables.delete | DELETE | `/audiovisual/deliverables/${id}` | `id` | AUSENTE | AUSENTE |
| shots.list | GET | `/audiovisual/projects/${projectId}/shots` | `projectId` | AUSENTE | AUSENTE |
| shots.create | POST | `/audiovisual/projects/${projectId}/shots` | `projectId` | AUSENTE | `Partial<AudiovisualShot>` |
| shots.update | PATCH | `/audiovisual/shots/${id}` | `id` | AUSENTE | `Partial<AudiovisualShot>` |
| shots.reorder | POST | `/audiovisual/projects/${projectId}/shots/reorder` | `projectId` | AUSENTE | `{ ids: string[] }` |
| shots.delete | DELETE | `/audiovisual/shots/${id}` | `id` | AUSENTE | AUSENTE |
| productionDays.list | GET | `/audiovisual/projects/${projectId}/production-days` | `projectId` | AUSENTE | AUSENTE |
| productionDays.create | POST | `/audiovisual/projects/${projectId}/production-days` | `projectId` | AUSENTE | `{ shooting_date: string, ...Partial<AudiovisualProductionDay> }` |
| productionDays.update | PATCH | `/audiovisual/production-days/${id}` | `id` | AUSENTE | `Partial<AudiovisualProductionDay>` |
| productionDays.delete | DELETE | `/audiovisual/production-days/${id}` | `id` | AUSENTE | AUSENTE |
| team.list | GET | `/audiovisual/projects/${projectId}/team` | `projectId` | AUSENTE | AUSENTE |
| team.create | POST | `/audiovisual/projects/${projectId}/team` | `projectId` | AUSENTE | `{ role: TeamRole, ...Partial<AudiovisualTeamMember> }` |
| team.update | PATCH | `/audiovisual/team/${id}` | `id` | AUSENTE | `Partial<AudiovisualTeamMember>` |
| team.delete | DELETE | `/audiovisual/team/${id}` | `id` | AUSENTE | AUSENTE |
| assets.list | GET | `/audiovisual/projects/${projectId}/assets${kind?...}` | `projectId` | `kind?` (`AssetKind`) | AUSENTE |
| assets.create | POST | `/audiovisual/projects/${projectId}/assets` | `projectId` | AUSENTE | `{ name: string, file_url: string, kind?, thumbnail_url?, mime_type?, size_bytes?: number, description?, tags?: string[] }` |
| assets.update | PATCH | `/audiovisual/assets/${id}` | `id` | AUSENTE | `Partial<AudiovisualAsset>` |
| assets.delete | DELETE | `/audiovisual/assets/${id}` | `id` | AUSENTE | AUSENTE |
| tasks.list | GET | `/audiovisual/projects/${projectId}/tasks` | `projectId` | AUSENTE | AUSENTE |
| tasks.create | POST | `/audiovisual/projects/${projectId}/tasks` | `projectId` | AUSENTE | `{ title: string, description?, status?: TaskStatus, priority?: TaskPriority, assigned_to?, due_date? }` |
| tasks.update | PATCH | `/audiovisual/tasks/${id}` | `id` | AUSENTE | `Partial<AudiovisualTask> & { status?, priority? }` |
| tasks.delete | DELETE | `/audiovisual/tasks/${id}` | `id` | AUSENTE | AUSENTE |
| approvals.list | GET | `/audiovisual/approvals${q(p)}` | AUSENTE | `audiovisual_project_id?, deliverable_id?, status? (ApprovalStatus), limit?, offset?` | AUSENTE |
| approvals.findById | GET | `/audiovisual/approvals/${id}` | `id` | AUSENTE | AUSENTE |
| approvals.request | POST | `/audiovisual/projects/${projectId}/approvals` | `projectId` | AUSENTE | `{ deliverable_id?: string, comments?: string }` |
| approvals.decide | POST | `/audiovisual/approvals/${id}/decision` | `id` | AUSENTE | `{ status: ApprovalStatus, comments?: string }` |

Nenhum header específico em nenhuma chamada — todas via cliente canônico (`@/lib/api`, mesmo `api-client.ts`).

## `modules/admin/services/admin-support.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/support-tickets?limit=200` | AUSENTE | `limit=200` literal | AUSENTE | gerenciados globalmente |

## `modules/admin/services/admin-audit.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/audit-logs?limit=200` | AUSENTE | `limit=200` literal | AUSENTE | idem |

## `modules/admin/services/admin-tenants.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/billing/admin/tenants` | AUSENTE | AUSENTE | AUSENTE | idem |
| PATCH | `/billing/admin/tenants/${tenantId}` | `tenantId` — obrigatório | AUSENTE | `UpdateAdminTenantPayload` = `Partial<Pick<AdminTenant, "name"\|"owner_email"\|"slug"\|"country"\|"plan"\|"status">>` | idem |

## `modules/admin/services/admin-plans.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/billing/plans?includeInactive=true` | AUSENTE | `includeInactive=true` literal | AUSENTE | idem |
| PATCH | `/billing/plans/${plan.id}` (quando `id` é UUID válido) | `plan.id` | AUSENTE | via `toBackendDto()`: `{ slug, name, amount: number (centavos), currency:"brl" (literal), interval:"month" (literal), active, features: {labels, color, price_annual, tier}, limits: {users, artists, storageGb} }` | idem |
| POST | `/billing/plans` (quando `id` ausente/não-UUID) | AUSENTE | AUSENTE | mesmo shape de `toBackendDto()` acima | idem |
| PATCH | `/billing/plans/${id}` (remove = soft-delete) | `id` | AUSENTE | `{ active: false }` — literal | idem |
| POST | `/billing/plans/${id}/sync-stripe` | `id` | AUSENTE | objeto vazio `{}` | idem |

## `modules/admin/services/admin-billing.service.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/billing/admin/subscriptions` | AUSENTE | AUSENTE | AUSENTE | idem |
| GET | `/billing/admin/invoices${suffix}` | AUSENTE | `tenantId?` — `encodeURIComponent`, opcional | AUSENTE | idem |
| POST | `/billing/admin/tenants/${tenantId}/suspend` | `tenantId` | AUSENTE | `{ reason: string }` | idem |
| POST | `/billing/admin/tenants/${tenantId}/reactivate` | `tenantId` | AUSENTE | `{ reason: string }` | idem |
| POST | `/billing/admin/tenants/${tenantId}/override` | `tenantId` | AUSENTE | `{ status: AdminBillingStateStatus (enum: active\|trial\|payment_grace\|read_only\|suspended\|cancelled), reason: string, until?: string }` | idem |
| POST | `/billing/admin/tenants/${tenantId}/override/remove` | `tenantId` | AUSENTE | `{ reason: string }` | idem |

## `modules/marketing/ai/providers/providerRouter.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST | `/ai/generate` | AUSENTE | AUSENTE | `{ type: "marketing:${payload.kind}" (interpolado), jsonMode: true (literal), prompt: string (montado por join de várias linhas condicionais: targetName, targetType, kind, prompt, lyricText?, audience?, channels?) }` | gerenciados globalmente |

## `modules/accounting/services/financial-categories.service.ts` (20 call sites)

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET | `/financial-categories${buildQuery(params)}` | AUSENTE | via `buildQuery(FinancialCategoryFilters)` — campos não expandidos aqui (tipo importado), omite `undefined\|null\|""\|"all"` | AUSENTE | gerenciados globalmente |
| GET | `/financial-categories/tree${buildQuery(params)}` | AUSENTE | `parent_id?` (`Pick<FinancialCategoryFilters,"parent_id">`) | AUSENTE | idem |
| GET | `/financial-categories/${id}` | `id` | AUSENTE | AUSENTE | idem |
| GET | `/financial-categories/${id}/descendants` | `id` | AUSENTE | AUSENTE | idem |
| GET | `/financial-categories/${id}/ancestors` | `id` | AUSENTE | AUSENTE | idem |
| GET | `/financial-categories/search${buildQuery(params)}` | AUSENTE | `FinancialCategoryFilters` — mesmo tipo de `list` | AUSENTE | idem |
| POST | `/financial-categories` | AUSENTE | AUSENTE | `Partial<FinancialCategory>` — genérico | idem |
| PATCH | `/financial-categories/${id}` | `id` | AUSENTE | `Partial<FinancialCategory>` | idem |
| PATCH | `/financial-categories/${id}/move` | `id` | AUSENTE | `{ parent_id?: string \| null, tree_order?: number }` | idem |
| PATCH | `/financial-categories/${id}/reorder` | `id` | AUSENTE | `{ tree_order: number }` | idem |
| PATCH | `/financial-categories/${id}/archive` | `id` | AUSENTE | objeto vazio `{}` | idem |
| PATCH | `/financial-categories/${id}/restore` | `id` | AUSENTE | objeto vazio `{}` | idem |
| DELETE | `/financial-categories/${id}` | `id` | AUSENTE | AUSENTE | idem |
| POST | `/financial-categories/${id}/merge` | `id` | AUSENTE | `{ target_category_id: string }` | idem |
| POST | `/financial-categories/suggest` | AUSENTE | AUSENTE | `context: Record<string, unknown>` — genérico, UNKNOWN | idem |
| POST | `/financial-categories/rules` (createRule, em `financialCategoriesService`) | AUSENTE | AUSENTE | `Partial<FinancialCategoryRule>` — genérico | idem |
| GET | `/financial-categories/rules` (em `financeCategorizationRulesService.list`) | AUSENTE | AUSENTE | AUSENTE | idem |
| POST | `/financial-categories/rules` (em `financeCategorizationRulesService.create`) | AUSENTE | AUSENTE | via `toApiRulePayload()`: `{ name: string (template "${transactionType} · ${categoryName}"), description: string (template com keywords.join(", ")), priority: number (default 100), active: boolean, category_id: string, conditions: {transaction_type, description_contains: string[]}, actions: {category_id, category_name, confidence: 0.9 (literal)} }` | idem |
| PATCH | `/financial-categories/rules/${id}` | `id` | AUSENTE | mesmo shape de `toApiRulePayload()` acima | idem |
| DELETE | `/financial-categories/rules/${id}` | `id` | AUSENTE | AUSENTE | idem |

## `shared/hooks/useAI.ts` — DEFERRED (client duplicado, ver doc 04)

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST (fetch direto) | `/api/v1/ai/generate` | AUSENTE | AUSENTE | `AIGenerateParams` = `{ prompt: string, type: AIGenerateType (enum de 13 valores: bio\|descricao\|copy\|briefing\|insights\|summary\|strategy\|profile\|post\|caption\|press-release\|email\|ad) }` | **específicos**: apenas `Content-Type: application/json` — **sem Authorization, sem X-Tenant-ID** (achado já registrado nos docs 04/05) |

## `modules/integrations/hooks/useACRCloud.ts` — DEFERRED (client duplicado, ver doc 04)

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST (fetch direto) | `/api/v1/integrations/acrcloud/recognize` (único sub-endpoint real; `copyright`/`catalog`/`monitor` lançam erro local antes do fetch) | AUSENTE | AUSENTE | `payload: Record<string, unknown>` — genérico, passado cru pelo chamador de `callAcrcloudApi()` | **específicos**: apenas `Content-Type: application/json` — **sem Authorization, sem X-Tenant-ID** |

## `modules/contracts/services/semantic-parser.service.ts` — mesmo padrão DUPLICATE

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST (fetch direto) | `/api/v1/ai/generate` | AUSENTE | AUSENTE | `{ prompt: string (template com texto do contrato truncado a 14000 chars), systemPrompt: string (constante SYSTEM_PROMPT), type: "contract_parse" (literal), jsonMode: true (literal), maxTokens: 4000 (literal) }` | **específicos**: apenas `Content-Type: application/json` — **sem Authorization, sem X-Tenant-ID** |

## `modules/settings/pages/Configuracoes.tsx` (função `openExternalOAuth`)

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST (fetch direto) | `${API_BASE_URL}/api/v1/integrations/oauth/init` | AUSENTE | AUSENTE | `{ platform: "docusign" }` — único valor aceito pela assinatura da função | **específicos**: `Content-Type: application/json` + `Authorization: Bearer <token>` (se `getAccessToken()`) — **sem X-Tenant-ID** |

## `modules/integrations/pages/OAuthCallbackPage.tsx`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST (fetch direto) | `${API_BASE_URL}/api/v1/integrations/oauth/exchange` | AUSENTE | AUSENTE | `{ code: string, platform: string, exchange_token: string (=nonce, consumido do sessionStorage do window.opener) }` | **específicos**: apenas `Content-Type: application/json` — sem Authorization (o "token" de auth aqui é o `exchange_token`/nonce no body, validado server-side) |

## `modules/integrations/components/MarketingOAuthDialog.tsx`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| POST (fetch direto) | `${API_BASE_URL}/api/v1/integrations/oauth/init` | AUSENTE | AUSENTE | `{ platform: MarketingPlatformId }` — parâmetro da função | **específicos**: `Content-Type: application/json` + `Authorization: Bearer <token>` (se `getAccessToken()`) — **sem X-Tenant-ID** |

## `modules/integrations/pages/OAuthPopupPage.tsx`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET (fetch direto) | `${apiBase}${backendPath}` (`backendPath = BACKEND_AUTH_ENDPOINTS[platform]` — só `spotify_ads`/`corp_spotify` → `/integrations/spotify/auth`) | AUSENTE | AUSENTE | AUSENTE (é GET) | **específicos**: `Authorization: Bearer <sessionData.access_token>` — token lido de `localStorage.getItem("musicos360_auth")` (chave da sessão Supabase) **diretamente do `window.opener`**, não de `getAccessToken()` do api-client |

## `modules/marketing/components/campaign-builder/useIbgeLocations.ts`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET (fetch direto, terceiro — IBGE) | `${IBGE_BASE}/localidades/estados/${uf}/municipios?orderBy=nome` | `uf` — parâmetro `fetchMunicipiosByUf(uf)`, `string`, obrigatório | `orderBy=nome` literal | AUSENTE | sem headers específicos |
| GET (fetch direto, terceiro — Nominatim/OSM) | `${NOMINATIM_BASE}/search?${params}` | AUSENTE | `q="${query}, Brasil"` (interpolado), `format=json`, `limit=1`, `countrycodes=br` — todos literais/fixos exceto `q` | AUSENTE | **específicos**: `Accept-Language: pt-BR` |

## `shared/lib/masks.ts` (função `fetchAddressByCEP`)

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET (fetch direto, terceiro — ViaCEP) | `https://viacep.com.br/ws/${cleanCEP}/json/` | `cleanCEP` — parâmetro `cep` sanitizado (`replace(/\D/g,'')`), validado `length===8` antes do fetch | AUSENTE | AUSENTE | sem headers customizados (usa `AbortController.signal` para timeout de 5000ms — não é um header) |

## `shared/components/ChatAttachment.tsx`

| MÉTODO | ENDPOINT | PATH_PARAMS | QUERY_PARAMS | REQUEST_BODY | HEADERS |
|---|---|---|---|---|---|
| GET (fetch direto, ×2 — PDF e DOCX) | `attachment.url` | N/A — não é rota apps/api, é a URL já resolvida do anexo (prop `attachment`) | N/A | AUSENTE | sem headers específicos |

---

## Apêndice A — chamadas hard-coded que NÃO usam `TABLE_ENDPOINT`/interpolação de parâmetro dinâmico

Nenhuma adicional além das já listadas acima — todos os endpoints com segmento variável usam `${...}` de uma variável rastreável (parâmetro de função/hook, resultado de chamada anterior, ou constante local).

## Apêndice B — endpoints encontrados incidentalmente e NÃO cobertos pelo total oficial (ver "Limitação conhecida" no topo)

Descobertos ao ler os arquivos completos para extrair contratos; não fazem parte dos 270 call sites do doc 05 por causa do regex sem suporte a genéricos aninhados. Não contam para `TOTAL_HTTP_CALL_SITES_ANALYZED` nem para nenhum outro total abaixo:

| ARQUIVO | MÉTODO | ENDPOINT | Motivo do gap |
|---|---|---|---|
| `modules/integrations/hooks/useSpotify.ts:23` | GET | `/integrations/status` | `api.get<Record<string, {configured: boolean}>>(...)` — genérico aninhado |
| `modules/marketing/services/marketing.service.ts:118` | GET | `/marketing/projects?limit=100` | `api.get<ApiList<RecordRow>>(...)` |
| `modules/marketing/services/marketing.service.ts:200` | GET | `/marketing/campaigns` | idem |
| `modules/marketing/services/marketing.service.ts:232` | GET | `/marketing/contents?limit=100` | idem |
| `modules/marketing/services/marketing.service.ts:302` | GET | `/briefings?limit=100` | idem |
| `modules/marketing/services/marketing.service.ts:392` | GET | `/marketing/tasks?limit=100` | idem |
| `modules/marketing/services/marketing.service.ts:452,529` | GET | `/marketing/assets?limit=100${query}` | idem (2 call sites) |
| `modules/marketing/services/marketing.service.ts:768` | GET | `/activity-logs?entityType=marketing&limit=50` | idem |
| `modules/accounting/services/financial-categories.service.ts:51-59` | POST | `/financial-categories/rules/preview`, `/financial-categories/rules/execute` | `api.post<Array<{...}>>(...)` — genérico aninhado (2 endpoints) |

Isso sugere que outros arquivos ainda não relidos por completo neste prompt (fora do escopo aqui — só os 270 já inventariados foram processados) provavelmente têm gaps semelhantes. Recomendação para etapa futura: refazer o Prompt 08 com um parser real de AST (ex.: `ts-morph`) em vez de regex, para eliminar esta classe de falso-negativo.

---

## Totais

```text
TOTAL_HTTP_CALL_SITES_ANALYZED: 270

CALLS_WITH_PATH_PARAMS: 149

CALLS_WITH_QUERY_PARAMS: 44

CALLS_WITH_BODY: 121

CALLS_WITHOUT_BODY: 149

CALLS_WITH_SPECIFIC_HEADERS: 12

REQUESTS_WITH_UNKNOWN_FIELDS: 14

REQUESTS_WITH_UNKNOWN_TYPES: 9
```

Notas sobre os totais:
- `CALLS_WITH_BODY` conta corpo **presente** mesmo quando é um objeto vazio `{}` explicitamente enviado (ex.: `archive`, `restore`, `sync-stripe`) — a chamada envia um body, mesmo que sem campos.
- `CALLS_WITH_SPECIFIC_HEADERS` conta apenas chamadas `fetch` diretas que definem headers manualmente na própria chamada (SPECIALIZED/DUPLICATE, ver doc 04) — chamadas via `api`/`publicApi` (CANONICAL) têm headers geridos globalmente por `api-client.ts`, não "específicos daquela chamada".
- `REQUESTS_WITH_UNKNOWN_FIELDS` conta chamadas cujo body é um objeto genérico repassado cru (`Record<string, unknown>`, `Partial<T>` sem expansão de `T`, `payload` de tipo importado não lido neste prompt) — os 14 casos: `useSupport.ts` (changes), `storage.ts` create/update (2), `conversations.service.ts` (update payload), `musicchat-automation.service.ts` (updateSettings payload, processInbound payload), `marketing.service.ts` contents create/update (2), `marketing.service.ts` addAiSuggestion, `financial-categories.service.ts` create/update/suggest (3), `audiovisual.service.ts` genéricos `Partial<T>` (contado uma vez agregado, não por linha).
- `REQUESTS_WITH_UNKNOWN_TYPES` conta parâmetros/campos marcados `UNKNOWN` explicitamente acima por não ser possível determinar o tipo real sem ler outro arquivo fora do escopo desta etapa.
```

## Cobertura

Todos os 270 call sites do doc 05 foram lidos e documentados. Não foi analisado response body, status code, paginação de resposta, permissões/autorização ou regras de negócio de domínio (fora do escopo deste prompt). A limitação do inventário-base (doc 05) está registrada na seção própria e no Apêndice B, sem alterar o doc 05.

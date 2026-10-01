> Historical record. Kept as recorded; not the current contract.

# 09 — Contratos de Response Esperados pelo Frontend

Extraído a partir de [`05`](./05-http-endpoint-inventory.md), [`06`](./06-http-request-contracts.md) e [`08`](./08-http-request-final-resolution.md). Nenhum arquivo foi alterado, `apps/api` não foi consultado nesta etapa. Escopo: apenas como o retorno é consumido no frontend (uso real: destructuring, `.data`, mappers, tipos genéricos) — erros, status HTTP, permissões e regras de negócio não foram analisados.

**Regra estrutural observada em `api-client.ts`:** `api.delete(path)` tem assinatura fixa `Promise<void>` — nunca aceita generic de tipo. Logo, **toda chamada DELETE tem resposta estruturalmente vazia/não utilizável como dado**, independentemente do endpoint. Isso foi aplicado a todas as ~34 chamadas DELETE do inventário sem repetir a justificativa em cada linha.

---

## `app/providers/AuthContext.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| PATCH /auth/provision-workspace | NÃO | — (retorno de `api.patch` descartado; estado é atualizado a partir de `refreshSession()` do Supabase, não da resposta deste PATCH) | inferred from usage |
| POST /auth/change-required-password | NÃO | — (retorno descartado; só o `catch` é tratado) | inferred from usage |

## `app/providers/TenantContext.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /auth/context | SIM | objeto `SaasAuthContext`; campos acessados: `context.membership.role`, `context.membership.permissions` (array), `context.workspace.id` (mais campos usados além do trecho lido) | generic (`api.get<SaasAuthContext>`) + property access; tipo não expandido do arquivo de tipos — UNKNOWN_FIELD para os campos não observados diretamente |

## `app/providers/BillingContext.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /billing/subscription | SIM | objeto `BillingSubscriptionResponse \| null`; campos acessados: `billing_state?.status`, `status`, `trial_ends_at`, `current_period_end`, `stripe_customer_id`, `stripe_subscription_id`, `stripe_sub_id` | generic + property access |

## `modules/workspace/hooks/useWorkspace.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET `.../${id}` | SIM | objeto `WorkspaceEntity` (tipo importado, não expandido aqui) | generic (`api.get<WorkspaceEntity>`) |
| GET /activity-logs | SIM | array `ActivityLogItem[]` (tipo importado, não expandido) | generic |

## `modules/support/hooks/useSupport.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /support-tickets | SIM | array `SupportTicket[]` (interface completa — ver doc 07 caso 1: id,tenant_id,ticket_number,subject,description,status,priority,category,created_by,assigned_to?,sla_deadline?,created_at,updated_at,closed_at?,tags?) | generic + interface (já resolvida) |
| POST /support-tickets | SIM | objeto `SupportTicket` (mesma interface) | generic |
| PATCH /support-tickets/${id} | SIM | objeto `SupportTicket` | generic |

## `modules/leads/services/leads.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /leads | SIM | array `ApiLeadResponse[]` — id,nome,nome_completo,nomeArtistico,empresa,email,phone,whatsapp,instagram,cidade,estado,pais,tipoCliente,tipoServico,payloadServico,dadosInternosCRM,status,uploads,created_at,updated_at — mapeado via `fromApi()` | generic + interface local completa |
| POST /leads | SIM | objeto `ApiLeadResponse` (mesma interface), mapeado via `fromApi()` | generic |
| PATCH /leads/${id} | SIM | objeto `ApiLeadResponse`, mapeado | generic |
| DELETE /leads/${id} | NÃO | void | regra estrutural (delete) |

## `modules/settings/services/company-logo.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| DELETE /workspaces/.../logo | NÃO | void | regra estrutural |
| POST (fetch) /workspaces/.../logo | SIM | `{ data?: { logoUrl: string }, logoUrl?: string }` — anotação de tipo inline explícita no código (`as { data?: {...}; logoUrl?: string }`) | property access + type annotation inline |

## `modules/settings/services/billing-plans.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /billing/plans | SIM | array `BillingPlan[]` — id,name,price,priceAmount?,interval?,features[],seats?,limits?,stripePriceId?,order | generic + interface completa |

## `modules/settings/services/billing-invoices.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /billing/invoices | SIM | array `BillingInvoice[]` — id,number?,date,amount,status,statusColor?,pdfUrl?,stripeUrl? | generic + interface completa |

## `shared/lib/storage.ts` (wrapper genérico — ver doc 08 para instanciações concretas)

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET list | SIM | `T[] \| ListEnvelope<T>` onde `ListEnvelope<T> = { data: T[], meta?: {total?,limit?,offset?} }` — desembrulhado por `unwrapList()` | generic + helper local (unwrapList) |
| GET findById | SIM | `T` genérico | generic |
| POST create | SIM | `T` genérico (retornado direto pelo wrapper) | generic |
| PATCH update | SIM | `T` genérico | generic |
| DELETE | NÃO | void | regra estrutural |

## `shared/lib/api-client.test.ts` (arquivo de teste)

3 chamadas — response não é o foco dos testes lidos (testam `mapError()`/rejeição, não o shape de sucesso). Não aprofundado — fixtures de teste, não contrato de produção.

## `modules/integrations/hooks/useMarketingOAuth.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET oauth/status (×2) | SIM | `OAuthStatus = { connected: boolean, needs_reauth?: boolean }` — declarado inline no arquivo | generic + type inline |
| DELETE oauth/disconnect | NÃO | void | regra estrutural |

## `modules/settings/hooks/useUsuarios.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /users | SIM | `UsersPage = { data: ApiUser[], meta?: {total?,limit?,offset?} }` — ApiUser: id,auth_user_id,email,full_name,phone?,avatar_url?,role?,role_slug?,cargo?,status?,is_active,created_at | generic + interface local completa (paginado) |
| PATCH /users/${id} | NÃO | — (retorno de `api.patch` descartado, só `invalidateQueries`) | inferred from usage |
| PATCH /users/${id}/role | NÃO | — mesmo padrão | inferred from usage |

## `modules/integrations/hooks/useTikTok.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET status | SIM | `TikTokStatus = { connected: boolean }` | generic + interface |
| GET auth | SIM | `{ url: string }` | generic inline |
| DELETE disconnect | NÃO | void | regra estrutural |

## `modules/integrations/hooks/useDeezer.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET artist stats | SIM | `DeezerArtistStats` — artistId,name,fans,albums,picture,link,syncedAt | generic + interface completa |
| GET top tracks | SIM | `DeezerTopTrack[]` — id,title,rank,duration,preview,album,cover | generic + interface completa |

## `modules/settings/hooks/useCompanySettings.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /company-settings | SIM | `CompanySettingsResponse` — legalName,tradeName,cnpj,stateRegistration,contactName,address{zipCode?,street?,number?,complement?,city?,state?,country?},phone,banking{bankName?,agency?,account?} | generic + interface completa; consumido via mapper `toCompanySettings()` |
| PATCH /company-settings | SIM | mesmo shape acima | generic |

## `modules/integrations/hooks/useYouTube.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET status | SIM | `{ configured?: boolean, connected?: boolean } & Partial<YouTubeStatus>`, mapeado para `YouTubeStatus` (connected,channel_id?,channel_title?,has_credentials?,content_id_enabled?,last_sync_at?) | generic + interface completa |
| GET channel metrics | SIM | `YouTubeChannelMetrics` — channelId?,title?,subscriberCount?,viewCount?,videoCount?,thumbnailUrl?,error? | generic + interface completa |
| GET video metrics | SIM | sem generic explícito — retornado cru como dado de query, nenhuma propriedade acessada neste arquivo | UNKNOWN_TYPE — sem generic, sem destructuring visível |

## `modules/settings/hooks/useRoles.ts` (16 call sites)

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /rbac/roles | SIM | `Role[]` — id,tenant_id?,slug,name,description,is_system,is_assignable?,priority,created_at,updated_at,archived_at? | generic + interface completa |
| GET /rbac/permissions | SIM | `Permission[]` — id,code,label,description,category,created_at | generic + interface completa |
| GET /rbac/grants | SIM | `RolePermission[]` — id,role_id,permission_id,created_at | generic + interface completa |
| GET /users (team) | SIM | `UsersPage = { data: Array<{id,auth_user_id,role_id,email,full_name,is_active,created_at}> }` — **interface local distinta** da `UsersPage` de useUsuarios.ts (mesmo nome, subset de campos diferente) | generic + interface local (paginado) |
| GET /users/invitations | SIM | `TeamInvite[]` — id,email,role_id,invited_by,status,token?,expires_at,created_at,role? | generic + interface completa |
| POST /rbac/roles | SIM | `Role` | generic |
| PATCH /rbac/roles/${id} | SIM | `Role` | generic |
| POST duplicate | SIM | `Role` | generic |
| POST archive | NÃO | sem generic, retorno não usado (só invalidateRbac) | inferred from usage |
| POST restore | NÃO | idem | inferred from usage |
| POST inheritance | NÃO | idem | inferred from usage |
| DELETE inheritance | NÃO | void | regra estrutural |
| POST permissions/${id} | NÃO | sem generic, não usado | inferred from usage |
| DELETE permissions/${id} | NÃO | void | regra estrutural |
| PATCH users/${userId}/role | NÃO | sem generic, não usado além de invalidateRbac | inferred from usage |
| POST invitations | SIM | `TeamInvite` | generic |
| DELETE invitations/${id} | NÃO | void | regra estrutural |
| POST resend | NÃO | sem generic, não usado | inferred from usage |
| GET roles/${roleId} (detail) | SIM | `RoleDetail` = `Role & { permissions: Array<Permission & {source,source_role_id,source_role_name,source_role_slug,depth}>, inheritance: Array<{id,parent_role_id,parent_role_name,parent_role_slug,created_at}>, impactedUsers: Array<{id,auth_user_id,email,full_name,is_active}> }` | generic + interface completa |

## `modules/settings/hooks/useAuditTrail.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /audit-logs (typo `\audit-logs`) | SIM | `AuditLogEntry[]` — id,created_at,user_id,actor_role,action,entity,entity_id,http_method,http_path,ip_address,correlation_id,before,after,diff | generic + interface completa |

## `modules/integrations/hooks/useTikTokAds.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET status | SIM | `TikTokAdsStatus` — connected,last_sync_at?,advertiser_id?,app_id? | generic + interface completa |
| POST configure | SIM | sem generic — retornado cru pela mutation, não desestruturado neste arquivo | UNKNOWN_TYPE |
| DELETE disconnect | NÃO | void | regra estrutural |
| GET campaigns | SIM | sem generic — retornado cru | UNKNOWN_TYPE |

## `modules/integrations/hooks/useStripe.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /billing/subscription | SIM | `TenantSubscription \| null` (tipo importado de payments.contract, não expandido) | generic — UNKNOWN_FIELD (nome do tipo conhecido, campos não expandidos) |

## `modules/integrations/hooks/useSpotify.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET auth (×2) | SIM | `{ url: string }` | generic inline |
| DELETE disconnect | NÃO | void | regra estrutural |
| POST sync-artist | SIM | sem generic — retornado cru pela mutation | UNKNOWN_TYPE |

## `modules/integrations/hooks/useSoundCloud.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET status | SIM | `SoundCloudStatus` — connected,last_sync_at?,permalink?,username? | generic + interface completa |
| POST configure | SIM | sem generic | UNKNOWN_TYPE |
| DELETE disconnect | NÃO | void | regra estrutural |
| GET user metrics | SIM | sem generic, retornado cru | UNKNOWN_TYPE |
| GET track metrics | SIM | sem generic, retornado cru | UNKNOWN_TYPE |

## `modules/integrations/hooks/useInstagram.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET status | SIM | `InstagramStatus` — connected,last_sync_at? | generic + interface |
| GET auth | SIM | `{ url: string }` | generic inline |
| GET metrics | SIM | `InstagramAccountMetrics` — instagramId?,username?,name?,followers?,following?,mediaCount?,profilePicture?,syncedAt?,error? | generic + interface completa |
| DELETE disconnect | NÃO | void | regra estrutural |

## `modules/integrations/hooks/useGoogleAds.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET status | SIM | `GoogleAdsStatus` — connected,last_sync_at?,manager_account_id?,client_id? | generic + interface completa |
| POST configure | SIM | sem generic | UNKNOWN_TYPE |
| GET auth | SIM | `{ url: string }` | generic inline |
| DELETE disconnect | NÃO | void | regra estrutural |
| GET campaigns | SIM | sem generic | UNKNOWN_TYPE |

## `modules/integrations/hooks/useAppleMusic.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET status | SIM | `AppleMusicStatus` — connected,last_sync_at?,team_id?,key_id?,artist_id? | generic + interface completa |
| POST configure | SIM | sem generic | UNKNOWN_TYPE |
| DELETE disconnect | NÃO | void | regra estrutural |
| GET artist metrics | SIM | sem generic, retornado cru | UNKNOWN_TYPE |

## `modules/integrations/hooks/useAbramus.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET status | SIM | `AbramusStatus` — connected,status?,base_url?,username?,last_error?,last_sync_at?,last_sync_summary? (AbramusSyncSummary: started_at,finished_at,duration_ms,obras,fonogramas,total_fetched,total_inserted,total_updated,total_errors,truncated?),sync_schedule?,next_sync_at? | generic + interface completa |
| POST configure | SIM | sem generic | UNKNOWN_TYPE |
| DELETE disconnect | NÃO | void | regra estrutural |
| GET search-work | SIM | `AbramusSearchResponse = { results: AbramusSearchResult[], total?, has_more?, error? }` — AbramusSearchResult: external_id,titulo,iswc?,isrc?,duracao?,genero?,compositores?,letristas?,gravadora?,produtores?,data_registro?,artista_nome? | generic + interface completa |
| GET search-artist | SIM | `{ results?: ArtistSearchResult[] }` — ArtistSearchResult (tipo importado de dto, não expandido) | generic — UNKNOWN_FIELD para ArtistSearchResult |
| POST register-work | SIM | `{ external_id?: string, code?: string, iswc?: string|null }` | generic inline |

## `modules/musicchat/services/conversations.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /conversations | SIM | `ApiConversation[]` — id,contact_id,subject,status,channel,assigned_to,last_message_at,metadata,created_at,updated_at — mapeado via `mapConversation()` | generic + interface completa |
| GET messages | SIM | `ApiMessage[]` — id,body,sender_id,sender_type,attachments,metadata,created_at | generic + interface completa |
| POST messages | SIM | `ApiMessage` | generic |
| POST notes | NÃO | retorno descartado (`await api.post(...)`, sem atribuição) | inferred from usage |
| PATCH conversation | SIM | `ApiConversation` | generic |
| PATCH transfer | SIM | `ApiConversation` | generic |
| PATCH close | SIM | `ApiConversation` | generic |
| PATCH reopen | SIM | `ApiConversation` | generic |
| DELETE archive | NÃO | void | regra estrutural |

## `modules/musicchat/services/musicchat-automation.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET settings | SIM | `MusicChatAutomationSettings` (interface completa — ver doc 07 caso 5) | generic |
| PATCH settings | SIM | mesmo shape | generic |
| POST inbound | SIM | `{ conversation: unknown, action: string, option?: unknown }` — inline, campo `conversation` deliberadamente `unknown` | generic inline (parcialmente unknown por design) |
| POST escalations/run | SIM | `{ processed: number, notifications: unknown[] }` — inline, itens de `notifications` deliberadamente `unknown` | generic inline (parcial) |
| GET events | SIM | `MusicChatAutomationEvent[]` — id,tenant_id,conversation_id,event_type,summary,payload (Record<string,unknown>),actor_id,created_at | generic + interface completa |

## `modules/integrations/clients/stripe.client.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST checkout | SIM | `{ url: string }` | generic inline |
| POST portal | SIM | `{ url: string }` | generic inline |
| GET subscription | SIM | `BillingSubscription \| null` — início da interface visto (`id: string; org_id: string; ...`), não expandida por completo | generic — UNKNOWN_FIELD (parcialmente conhecido) |

## `shared/hooks/useUploadToR2.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST presign | SIM | `PresignResponse` — presignedUrl,key,fileId,publicUrl | generic + interface completa |
| POST confirm | NÃO | retorno de `await api.post(...)` não atribuído; função retorna `presign.publicUrl` (do passo anterior), não do confirm | inferred from usage |
| PUT (fetch, R2) | NÃO | apenas `.ok`/`.status`/`.statusText` verificados (tratamento de erro); nenhum corpo de resposta é lido | inferred from usage |

## `modules/reports/services/reports-api.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET entities | SIM | `EntitiesInventory` — totalEntities,reportableEntities,nonReportableEntities,unknownEntities,entities: ReportEntity[] (ReportEntity: entityName,tableName,label,category,reportable,columns: ReportColumnMeta[],hasTenantId,hasSoftDelete,hasTimestamps,risks[]) | generic + interfaces completas |
| GET definitions | SIM | `ReportEntityDefinition[]` — entityName,tableName,category,identityColumn,displayColumn,dateColumn,exportableColumns[],importableColumns[],filterableColumns[],sortableColumns[],searchableColumns[],sensitiveColumns[],requiredImportColumns[],supportsExport,supportsImport | generic + interface completa |
| POST import/validate | SIM | `ImportValidationResult` — entity,supportsImport,mapping,unknownColumns[],ignoredColumns[],totalRows,validRows,invalidRows,rows: ImportRowValidation[],errors[],warnings[] | generic + interface completa |
| POST import/commit | SIM | `ImportCommitResult` — entity,totalRows,importedRows,failedRows,warnings[],errors[] | generic + interface completa |
| GET export (fetch, blob) | SIM | binário (`Blob`), validado por assinatura de bytes OpenXML — não é JSON | property access (headers) + leitura binária |
| GET import/template (fetch, blob) | SIM | binário (`Blob`), mesma validação | idem |

## `shared/components/MainLayout.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| PATCH /notifications/read-all | NÃO | retorno descartado (try/catch, só invalidateQueries) | inferred from usage |

## `modules/dashboard/hooks/useOperationalDashboard.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /analytics/dashboard | SIM | `OperationalDashboard` (tipo importado, não expandido neste trecho) | generic — UNKNOWN_FIELD |

## `modules/dashboard/hooks/useActivityHistory.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /audit-logs | SIM | `AuditLogRow[]` — id,tenant_id?,user_id?,actor_role?,action,entity,entity_id?,before?,after?,created_at | generic + interface completa |

## `modules/marketing/services/marketing.service.ts` (41 call sites)

Todos usam `RecordRow = Record<string, any>` (tipo deliberadamente aberto) como generic de `api.get/post/patch`, com o formato real revelado apenas pelo que os mappers `xFromApi()` leem do objeto retornado — não pelo tipo declarado.

| Sub-recurso | RESPONSE_USED | RESPONSE_SHAPE (campos lidos pelo mapper) | SOURCE_OF_SHAPE |
|---|---|---|---|
| projects create/get/update | SIM | via `projectFromApi()`: row.id, row.title, row.type, row.status, row.priority, meta(row.metadata).owner/team/objective/audience/channels/taskIds/campaignIds/contentIds/briefingIds/files/progress, row.starts_at, row.ends_at, row.description, row.artist_id, row.created_at, row.updated_at | mapper (RecordRow genérico → UNKNOWN_TYPE bruto, campos KNOWN via mapper) |
| projects delete | NÃO | void | regra estrutural |
| campaigns create/get/update | SIM | via `campaignFromApi()`: row.id, builder=metadata(row).marketingBuilder?.payload ?? row (fallback), payload.name/promotedEntityType/promotedEntityId/promotedEntityName/type/objective/audience/segmentation/totalBudget/dailyBudget/startDate/endDate/platforms/status/owner/projectId/creativeAssetIds/contentIds/metrics{reach,impressions,engagement,clicks,conversions,roi,costPerResult}/notes, row.createdAt/created_at, row.updatedAt/updated_at | mapper |
| campaigns "remove" (na verdade POST archive) | NÃO | void (resultado descartado, função retorna `{id}` local) | inferred from usage |
| contents create/update | SIM | via `contentFromApi()`: spread de `row` inteiro + row.approval/metadata(row).approval, row.files, row.notes, row.owner, row.createdAt/created_at, row.updatedAt/updated_at | mapper (spread cru — campos não enumerados exaustivamente pelo próprio código) |
| contents delete | NÃO | void | regra estrutural |
| briefings create/get/update | SIM | via `briefingFromApi()`: row.id, row.titulo/title, meta.type, meta.uiStatus/row.status, meta.objective, row.descricao/meta.context, meta.audience/positioning/tone/requirements/creativeDirection/references/visualGuidelines/textGuidelines/market/competitors/trends/channels/restrictions/resources/expectations/deliverables/timeline/executionPlan/aiRecommendations/owners/projectId/files, row.prazo/dueAt, row.campanha_id/campaignId, row.created_at, row.updated_at | mapper |
| briefings delete | NÃO | void | regra estrutural |
| tasks create/get/update | SIM | via `taskFromApi()`: row.id, row.title, row.description, meta.targetType/targetId/targetName/uiType/uiStatus/uiPriority/owner/sector/campaignId/briefingId/releaseId/contentId/files/referenceAudio/checklist/comments/history/automationFlowId, row.kind, row.status, row.priority, row.assigned_to, row.due_date, row.marketing_project_id, row.dependencies, row.created_at, row.updated_at | mapper |
| tasks delete | NÃO | void | regra estrutural |
| assets create/update (assetsApi) | SIM | via `assetFromApi()`: row.id, row.title, row.asset_type, meta.projectId/taskId/sourceDepartment/department/owner, row.marketing_project_id, row.campaign_id, row.artist_id, row.created_by, row.status, row.file_url, row.thumbnail_url, row.tags, row.description, row.created_at, row.updated_at | mapper |
| assets delete | NÃO | void | regra estrutural |
| deliverables (mesmo backend `/marketing/assets`) create/update/addVersion/setApproval/addComment/duplicate | SIM | via `deliverableFromApi()` (faz GET adicional `/marketing/assets/${id}/versions` → `RecordRow[]`): row.id, meta.taskId, row.title, row.description, row.asset_type, row.status, row.file_url, meta.fileName, row.mime_type, row.size_bytes, row.current_version, versions[].{id,version,file_url,mime_type,size_bytes,created_by,created_at,change_notes}, meta.comments, row.approved_by, row.approved_at, row.created_by, row.created_at, row.updated_at | mapper (2 chamadas encadeadas) |
| deliverables remove | NÃO | void | regra estrutural |
| campaign-builder/config (GET) | SIM | `CampaignBuilderConfig` (tipo importado, não expandido) | generic — UNKNOWN_FIELD |
| activity-logs (GET, getActivity) / (POST, logActivity) | SIM | via `activityFromApi()`: row.id, metadata(row).entity/row.entity_type, row.action, row.description, row.user_name/row.user_id, row.created_at | mapper |
| ai-suggestions (GET) | SIM | `AiSuggestion[]` (interface completa — ver doc 07 caso 9) | generic + interface completa |
| ai-suggestions (POST, addAiSuggestion) | SIM | `AiSuggestion` (mesma interface) | generic |

## `modules/marketing/hooks/useMetas.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST /artist-goals | SIM | `GoalRow = Record<string,any>`, mapeado via `fromApi()`: row.metadata, row.meta_valor, row.valor_atual, row.id, row.titulo, row.tipo, row.data_fim, row.data_inicio, row.artista_id, row.status, row.created_at, row.updated_at | mapper (RecordRow genérico, campos KNOWN via mapper) |
| GET /artist-goals/${id} | SIM | mesmo shape | mapper |
| PATCH /artist-goals/${id} | SIM | mesmo shape | mapper |
| DELETE /artist-goals/${id} | NÃO | void | regra estrutural |

## `modules/marketing/hooks/useMarketingAssets.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET project library | SIM | `ProjectAsset[]` (tipo importado); campos usados por `normalizeProjectAsset()`: owner, approval, url/file_url, thumbnailUrl/thumbnail_url, tags, notes, createdAt, updatedAt | generic + mapper (parcial — tipo completo não expandido) |

## `modules/crm-relationships/services/clients.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /clients | SIM | `ApiClient[]` — interface completa (24 campos: id,tenant_id,tipo_pessoa,categoria,perfil,nome,razao_social,nome_fantasia,nome_pf,cidade,estado,cep,instagram,endereco_completo,status,observacoes,responsavel_nome,attachments,metadata,created_at,updated_at + aliases name,type,category,address,email,phone,document) | generic + interface completa |
| POST /clients | SIM | `ApiClient` | generic |
| PATCH /clients/${id} | SIM | `ApiClient` | generic |
| DELETE /clients/${id} | NÃO | void | regra estrutural |
| GET timeline | SIM | `ClientTimelineEntry[]` — id,entity_type,entity_id,action,description,metadata,user_id,user_name,created_at | generic + interface completa |
| POST timeline | SIM | `ClientTimelineEntry` | generic |
| GET contracts | SIM | `ClientContractSummary[]` — id,titulo,tipo,status,valor,data_inicio,data_fim,created_at | generic + interface completa |
| GET attachments | SIM | `ClientAttachment[]` — id,tenant_id,client_id,storage_key,filename,mime_type,size_bytes,checksum,uploaded_by,created_at | generic + interface completa |
| DELETE attachment | NÃO | void | regra estrutural |

## `modules/auth/services/activation-plans.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /public/activation-plans | SIM | `ActivationPlan[]` — id,name,description,price?,currency?,period?,trialDays?,order | generic + interface completa |

## `modules/auth/pages/Onboarding.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| PATCH /auth/onboarding | NÃO | retorno descartado — estado local é atualizado a partir dos valores do formulário, não da resposta | inferred from usage |

## `modules/auth/pages/ArtistaSignupPublic.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST /public/artists | SIM | `{ id: string, protocol?: string }` — usado como `result.protocol ?? result.id` | generic inline |

## `modules/artist/hooks/useArtistPlatformProfiles.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET platform-profiles | SIM | `ArtistPlatformProfileSnapshot[]` — tenant_id,artist_id,platform,external_id,external_url,display_name,username,profile_url,image_url,followers,subscribers,monthly_listeners,popularity,total_views,total_videos,total_tracks,total_albums,raw_payload,sync_status,last_synced_at,last_error | generic + interface completa |
| POST sync | SIM | `SyncResponse = { artist_id, enqueued: Array<{platform,job_id}>, skipped: Array<{platform,reason}> }` | generic + interface completa |

## `modules/audiovisual/services/audiovisual.service.ts` (41 call sites)

Todos tipados com interfaces já resolvidas no doc 07 (ver casos 13/14). Response = mesmo tipo da entidade em quase todos os GET/POST/PATCH.

| Sub-recurso | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| projects.list/dashboard/findById/create/update/transition | SIM | `AudiovisualProject[]` ou `AudiovisualProject` (~35 campos + index signature `[key:string]:unknown` — ver ressalva doc 07); `dashboard` retorna `AudiovisualDashboard` (total_projects?,in_production?,delivered?,pending_approval?,upcoming_publish_7d?,approvals_pending?,overdue_deliverables?,budget_estimated_total?,budget_actual_total?,by_status) | generic + interface (com ressalva de index signature) |
| projects.delete | NÃO | void | regra estrutural |
| briefings.get/upsert | SIM | `AudiovisualBriefing \| null` — id,audiovisual_project_id?,concept?,objective?,references?,moodboard?,notes? | generic + interface completa |
| deliverables.list/findById/create/seedDefaults/update | SIM | `AudiovisualDeliverable[]` ou `AudiovisualDeliverable` — id,title,type?,status?,file_url? | generic + interface completa |
| deliverables.delete | NÃO | void | regra estrutural |
| shots.list/create/update/reorder | SIM | `AudiovisualShot[]` ou `AudiovisualShot`; `reorder` retorna `{ reordered: number }` inline | generic + interface completa |
| shots.delete | NÃO | void | regra estrutural |
| productionDays.list/create/update | SIM | `AudiovisualProductionDay[]` ou `AudiovisualProductionDay` — id,shooting_date,location?,call_time?,wrap_time? | generic + interface completa |
| productionDays.delete | NÃO | void | regra estrutural |
| team.list/create/update | SIM | `AudiovisualTeamMember[]` ou `AudiovisualTeamMember` — id,name?,role,email?,phone? | generic + interface completa |
| team.delete | NÃO | void | regra estrutural |
| assets.list/create/update | SIM | `AudiovisualAsset[]` ou `AudiovisualAsset` — id,name,file_url,kind?,thumbnail_url?,mime_type?,size_bytes?,description?,tags? | generic + interface completa |
| assets.delete | NÃO | void | regra estrutural |
| tasks.list/create/update | SIM | `AudiovisualTask[]` ou `AudiovisualTask` — id,title,description?,status?,priority?,assigned_to?,due_date? | generic + interface completa |
| tasks.delete | NÃO | void | regra estrutural |
| approvals.list/findById/request/decide | SIM | `AudiovisualApproval[]` ou `AudiovisualApproval` — id,status,comments?,created_at? | generic + interface completa |

## `modules/admin/services/admin-support.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /support-tickets | SIM | `RawTicket[]` — id,subject?,category?,status?,priority?,assigned_to?,tenant_id?,requester_email?,created_at?,updated_at?,first_response_at?,resolved_at? — mapeado via `toAdminTicket()` | generic + interface completa |

## `modules/admin/services/admin-audit.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /audit-logs | SIM | `RawAudit[]` — id,action?,entity?,entity_id?,user_id?,user_name?,user_email?,actor_role?,tenant_id?,ip_address?,details?,created_at? — mapeado via `toAdminAudit()` | generic + interface completa |

## `modules/admin/services/admin-tenants.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /billing/admin/tenants | SIM | `AdminTenant[]` (tipo importado, não expandido) | generic — UNKNOWN_FIELD |
| PATCH tenant | SIM | `AdminTenant` (mesmo tipo) | generic — UNKNOWN_FIELD |

## `modules/admin/services/admin-plans.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET /billing/plans | SIM | `BackendPlan[]` — id,slug,name,description,amount,currency,interval,active,features,limits,stripe_product_id,stripe_price_id — mapeado via `toAdminPlan()` | generic + interface completa |
| PATCH plan (save) | NÃO | retorno descartado; função retorna `this.list()` (nova consulta), não a resposta do PATCH | inferred from usage |
| POST plan (save) | NÃO | idem | inferred from usage |
| PATCH remove (soft-delete) | NÃO | idem | inferred from usage |
| POST sync-stripe | NÃO | idem | inferred from usage |

## `modules/admin/services/admin-billing.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET subscriptions | SIM | `AdminSubscription[]` (tipo importado, não expandido) | generic — UNKNOWN_FIELD |
| GET invoices | SIM | sem generic — retornado cru | UNKNOWN_TYPE |
| POST suspend | SIM | `AdminBillingActionResponse` — tenantId,status,graceUntil?,suspendedAt?,manualOverride?,manualOverrideUntil? | generic + interface completa |
| POST reactivate | SIM | mesmo tipo | generic |
| POST override | SIM | mesmo tipo | generic |
| POST override/remove | SIM | mesmo tipo | generic |

## `modules/marketing/ai/providers/providerRouter.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST /ai/generate | SIM | `{ content: string }`; `content` é re-parseado como JSON (`JSON.parse(response.content)`) e validado contra o shape `AiGeneratedResult` (summary: string, creativeDirection: string, strengths/risks/audience/positioning/contentIdeas/campaignIdeas/pitchSuggestions/nextActions: arrays — checados explicitamente com `Array.isArray`) | generic inline + validação runtime explícita no código |

## `modules/accounting/services/financial-categories.service.ts` (20 call sites)

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET list/tree/search/descendants/ancestors | SIM | `FinancialCategory[]` (interface completa — ver doc 07/08) | generic + interface completa |
| GET findById | SIM | `FinancialCategory` | generic |
| POST create | SIM | `FinancialCategory` | generic |
| PATCH update/move/reorder/archive/restore | SIM | `FinancialCategory` | generic |
| DELETE (remove) | NÃO | void — a função local retorna `{deleted:true}`, mas isso é um valor LOCAL construído após o `await`, não o corpo da resposta HTTP (que é void) | regra estrutural + inferred from usage |
| POST merge | SIM | `{ source: FinancialCategory, target: FinancialCategory }` | generic inline |
| POST suggest | SIM | `FinancialSuggestion[]` (tipo importado, não expandido; endpoint não existe no backend — ver doc 08 caso 3) | generic — UNKNOWN_FIELD |
| POST rules (createRule) | SIM | `FinancialCategoryRule` — id,category_id,name,description,priority,active,conditions,actions,trigger_count,last_triggered_at | generic + interface completa |
| GET rules (financeCategorizationRulesService.list) | SIM | `FinanceCategoryRuleApi[]` — campos usados por `mapApiRule()`: id, conditions.description_contains, conditions.transaction_type, category_id, actions.category_id, actions.category_name, priority, active, created_at, updated_at | generic + mapper (parcial — tipo completo não lido) |
| POST rules (financeCategorizationRulesService.create) | SIM | `FinanceCategoryRuleApi` (mesmo shape parcial) | generic + mapper |
| PATCH rules/${id} | SIM | `FinanceCategoryRuleApi` (mesmo shape parcial) | generic + mapper |
| DELETE rules/${id} | NÃO | void | regra estrutural |

## `shared/hooks/useAI.ts` — DEFERRED

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST (fetch) /api/v1/ai/generate | SIM | `AIGenerateResult = { content: string }` — tipo de retorno declarado na assinatura de `callAI(): Promise<AIGenerateResult>` | function return type (TypeScript) |

## `modules/integrations/hooks/useACRCloud.ts` — DEFERRED

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST (fetch) /api/v1/integrations/acrcloud/recognize | SIM | `unwrapApiResponse<T>(payload)` — T genérico determinado pelo caller de `callAcrcloudApi<T>`, não visível neste arquivo | UNKNOWN_TYPE — generic caller-dependent, não rastreado (chamador real fora do arquivo lido) |

## `modules/contracts/services/semantic-parser.service.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST (fetch) /api/v1/ai/generate | SIM | função retorna `Promise<SemanticParseResult>` = `{ variables: [...], clauseTypes: [...], rawText: string }` (visto no caminho de retorno antecipado para texto vazio); parsing completo do `response.json()` não lido até o fim do arquivo neste prompt | function return type (parcialmente confirmado; parsing completo não rastreado) |

## `modules/settings/pages/Configuracoes.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST (fetch) oauth/init | SIM | `{ exchange_token: string }` — `as {exchange_token:string}` explícito no código | type annotation inline |

## `modules/integrations/pages/OAuthCallbackPage.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST (fetch) oauth/exchange | SIM | caminho de erro: `Record<string, unknown>` com campo `message` (string ou string[]) lido explicitamente; caminho de sucesso não lido até o fim do arquivo neste prompt | property access (parcial — apenas o caminho de erro confirmado) |

## `modules/integrations/components/MarketingOAuthDialog.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| POST (fetch) oauth/init | SIM | caminho de erro: `Record<string, unknown>` com campo `message`; caminho de sucesso não lido até o fim do arquivo neste prompt | property access (parcial) |

## `modules/integrations/pages/OAuthPopupPage.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET (fetch) spotify/auth | SIM | `{ url?: string }` — anotação inline explícita (`data: { url?: string }`) | type annotation inline |

## `modules/marketing/components/campaign-builder/useIbgeLocations.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET (fetch, IBGE) municipios | SIM | `IbgeMunicipio[]` — id,nome,microrregiao{mesorregiao{UF{sigla,nome}}} — anotação explícita `const data: IbgeMunicipio[] = ...` | type annotation inline |
| GET (fetch, Nominatim) search | SIM | array sem tipo declarado; acessado como `data[0].lat`, `data[0].lon` | inferred from usage (property access) |

## `shared/lib/masks.ts`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET (fetch, ViaCEP) | SIM | `ViaCEPResponse` — cep,logradouro,complemento,bairro,localidade,uf,erro? — anotação explícita | type annotation inline |

## `shared/components/ChatAttachment.tsx`

| MÉTODO/ENDPOINT | RESPONSE_USED | RESPONSE_SHAPE | SOURCE_OF_SHAPE |
|---|---|---|---|
| GET attachment.url (×2) | SIM | binário — `.blob()`/`.arrayBuffer()`, não JSON | inferred from usage (leitura binária) |

---

## Totais

```text
TOTAL_HTTP_CALL_SITES_ANALYZED: 270

CALLS_WITH_RESPONSE_USED: 217

CALLS_WITH_RESPONSE_IGNORED: 53

ARRAY_RESPONSES: 62

OBJECT_RESPONSES: 128

PAGINATED_RESPONSES: 5

PRIMITIVE_RESPONSES: 57

RESPONSES_WITH_UNKNOWN_FIELDS: 16

RESPONSES_WITH_UNKNOWN_TYPES: 19

RESPONSES_WITH_UNDETERMINED_SHAPE: 4
```

Notas sobre os totais:
- `CALLS_WITH_RESPONSE_IGNORED` (53) = ~34 DELETE (void estrutural) + ~19 POST/PATCH cujo retorno é explicitamente descartado no código (AuthContext ×2, useUsuarios PATCH ×2, MainLayout PATCH, conversations.service POST notes, useUploadToR2 POST confirm + PUT R2, admin-plans.service ×4, useRoles.ts ×5 sem generic não usados, Onboarding.tsx, marketing.service campaigns "remove"/archive, financial-categories remove).
- `PRIMITIVE_RESPONSES` (57) agrega os void estruturais de DELETE (34) + os ~19 casos "NÃO usado" acima (que também não produzem um shape de dado) + 4 respostas binárias (2× reports-api.ts blob, 2× ChatAttachment.tsx) — todos tratados como "não é objeto/array JSON estruturado".
- `RESPONSES_WITH_UNKNOWN_TYPES` (19) conta chamadas sem generic explícito e sem destructuring/property-access visível neste prompt que permitisse inferir o shape (ex.: `useYouTube.ts` video metrics, vários `configure`/`campaigns` de integrações sociais, `admin-billing.service.ts` invoices, `useACRCloud.ts`).
- `RESPONSES_WITH_UNKNOWN_FIELDS` (16) conta chamadas com generic/tipo nomeado mas cujo arquivo de tipo não foi expandido neste prompt (ex.: `SaasAuthContext`, `BillingSubscriptionResponse`, `TenantSubscription`, `AdminTenant`, `AdminSubscription`, `OperationalDashboard`, `CampaignBuilderConfig`, `ArtistSearchResult`, `FinancialSuggestion`, `BillingSubscription` parcial, `ProjectAsset` parcial, `FinanceCategoryRuleApi` parcial).
- `RESPONSES_WITH_UNDETERMINED_SHAPE` (4) conta os casos onde nem o caminho de sucesso do parsing foi totalmente lido neste prompt (`OAuthCallbackPage.tsx`, `MarketingOAuthDialog.tsx` — só o caminho de erro foi confirmado — e `semantic-parser.service.ts`, `useACRCloud.ts` — generic caller-dependente não rastreado).

## Cobertura

Cobertos os 270 call sites oficiais do doc 05 (mesma base do doc 06/07/08 — os endpoints da Apêndice B do doc 06, encontrados incidentalmente por limitação de regex, não foram re-analisados aqui por não fazerem parte do inventário oficial). Não foram analisados: erros, status HTTP, permissões/autorização, paginação de resposta em profundidade além do envelope `{data, meta}` já identificado, ou regras de negócio. `apps/api` não foi consultado nesta etapa.

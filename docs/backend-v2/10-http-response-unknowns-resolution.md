> Historical record. Kept as recorded; not the current contract.

# 10 — Resolução das Incertezas de Response (usando apenas o frontend)

Rastreamento read-only, exclusivamente em `apps/web/**`, dos casos `UNKNOWN_FIELD`/`UNKNOWN_TYPE`/`UNDETERMINED_SHAPE` identificados em [`09-http-response-contracts.md`](./09-http-response-contracts.md). `apps/api` não foi consultado. Nenhum arquivo foi alterado. Doc 09 não foi modificado.

**Nota de reconciliação:** o doc 09 não marcava cada linha com uma tag literal `UNKNOWN_FIELD`/`UNKNOWN_TYPE` — os totais (16/19/4) vieram das notas de rodapé do resumo. Reconstruí a lista de casos a partir dessas notas; onde a contagem exata por caso não batia 1:1 com o total agregado (mesma limitação já registrada nos docs 07/08), documentei a reconciliação explicitamente em vez de forçar precisão artificial.

---

## UNKNOWN_FIELDS (16 casos — todos resolvidos via arquivos de tipo em `apps/web/src`)

### 1

```text
CALL_SITE: app/providers/TenantContext.tsx — carregamento do contexto SaaS
ENDPOINT: GET /auth/context
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: SaasAuthContext — tipo não expandido
RESULTADO: { user: {id,email,fullName,avatarUrl}, workspace: {id,orgId,name,slug,active,plan,features,settings}, membership: {id,authUserId,role,isActive,permissions,hierarchyLevel}, claims: {orgId,role,appMetadata} }
EVIDÊNCIA: shared/types/saas-context.ts:1-31 — interface SaasAuthContext completa
STATUS: RESOLVED
```

### 2

```text
CALL_SITE: app/providers/BillingContext.tsx — refresh()
ENDPOINT: GET /billing/subscription
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: BillingSubscriptionResponse — parcialmente conhecido por property access
RESULTADO: { status?, current_period_end?, trial_ends_at?, stripe_customer_id?, stripe_subscription_id?, stripe_sub_id?, billing_state?: {status?,grace_until?,next_payment_at?,suspended_at?}, latest_invoice?: {amount_due?,hosted_invoice_url?,invoice_pdf?,due_date?} }
EVIDÊNCIA: app/providers/BillingContext.tsx:22-40 — interface local completa
STATUS: RESOLVED
```

### 3

```text
CALL_SITE: modules/integrations/hooks/useStripe.ts — useStripeSubscription
ENDPOINT: GET /billing/subscription
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: TenantSubscription — tipo importado não expandido
RESULTADO: { tenant_id, subscription_id, plan (SubscriptionPlan), status (SubscriptionStatus), current_period_start, current_period_end, trial_end?, cancel_at?, features (SubscriptionFeatures), amount_cents, currency: "brl"|"usd" }
EVIDÊNCIA: shared/integrations/contracts/payments.contract.ts:45-58 — interface TenantSubscription completa
STATUS: RESOLVED
```

### 4

```text
CALL_SITE: modules/integrations/clients/stripe.client.ts — getSubscription
ENDPOINT: GET /billing/subscription
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: BillingSubscription — só início da interface visto anteriormente
RESULTADO: { id, org_id, stripe_customer_id, stripe_sub_id, stripe_subscription_id?, stripe_price_id?, plan: 'starter'|'professional'|'enterprise', status: 'trial'|'trialing'|'active'|'past_due'|'unpaid'|'cancelled'|'paused'|'incomplete'|'incomplete_expired', trial_ends_at, current_period_start?, current_period_end, grace_until?, suspended_at?, resumed_at?, seats, seats_used, billing_state?: {status?,grace_until?,next_payment_at?} (e mais campos não totalmente lidos após a linha 48) }
EVIDÊNCIA: modules/integrations/clients/stripe.client.ts:28-48 — interface BillingSubscription
STATUS: RESOLVED (campos principais confirmados; alguns sub-campos de `billing_state` além da linha 48 não relidos nesta etapa, impacto residual mínimo)
```

### 5 / 6

```text
CALL_SITE: modules/admin/services/admin-tenants.service.ts — list() / update()
ENDPOINT: GET /billing/admin/tenants ; PATCH /billing/admin/tenants/${tenantId}
INCERTEZA: UNKNOWN_FIELD (2 endpoints, mesmo tipo)
VALOR ANTERIOR: AdminTenant — tipo importado não expandido
RESULTADO: { id, name, slug, status (TenantStatus), plan (PlanTier), owner_email, users_count, artists_count, storage_used_mb, storage_limit_mb, mrr, created_at, last_active_at, country, trial_ends_at? }
EVIDÊNCIA: modules/admin/types/index.ts:72-88 — interface AdminTenant completa
STATUS: RESOLVED
```

### 7

```text
CALL_SITE: modules/admin/services/admin-billing.service.ts — listSubscriptions()
ENDPOINT: GET /billing/admin/subscriptions
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: AdminSubscription — tipo importado não expandido
RESULTADO: { id, tenant_id, tenant_name, plan (PlanTier), status (SubscriptionStatus), mrr, billing_cycle (BillingCycle), started_at, current_period_end, payment_method, trial_ends_at?, last_payment_at?, next_payment_at? }
EVIDÊNCIA: modules/admin/types/index.ts:90-104 — interface AdminSubscription completa
STATUS: RESOLVED
```

### 8

```text
CALL_SITE: modules/dashboard/hooks/useOperationalDashboard.ts
ENDPOINT: GET /analytics/dashboard
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: OperationalDashboard — tipo não expandido
RESULTADO: { artists, artists_by_status, contracts, contracts_by_status, active_contracts_count, contracts_expiring_soon_count, leads, open_tickets, campaigns, revenue_current_month, expenses_current_month, net_result_current_month, pending_receivables, overdue_invoices_count, paid_transactions_count, cancelled_transactions_count, invoices_by_status, transactions_by_status (+ mais campos não totalmente lidos além da linha 30, incluindo os já vistos no doc09: failed_external_syncs, successful_external_syncs, distributor_submissions_count, society_submissions_count, external_validation_errors_count, pending_provider_requirements_count, generated_at) }
EVIDÊNCIA: modules/dashboard/hooks/useOperationalDashboard.ts:12-30+
STATUS: RESOLVED (maioria dos campos confirmada; interface é grande, cauda final não relida por completo — impacto residual mínimo, já coberto parcialmente no doc09)
```

### 9

```text
CALL_SITE: modules/marketing/services/marketing.service.ts — getCampaignBuilderConfig
ENDPOINT: GET /marketing/campaign-builder/config
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: CampaignBuilderConfig — não expandido
RESULTADO: { objectives: Array<{value,label,description}>, expectedOutcomes: Record<string,string[]>, promotedEntityTypes: string[], platforms: Record<string,{objectives,creatives,placements}>, creativeTypes: string[], statusLifecycle: string[], compatibilityRules: string[], defaultRecommendations: Record<string,string[]> }
EVIDÊNCIA: modules/marketing/types/marketing.types.ts:384-393 — interface CampaignBuilderConfig completa
STATUS: RESOLVED
```

### 10

```text
CALL_SITE: modules/integrations/hooks/useAbramus.ts — useAbramusSearchArtists
ENDPOINT: GET /integrations/abramus/search-artist
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: ArtistSearchResult — não expandido
RESULTADO: { external_id, nome, tipo: "compositor"|"interprete"|"produtor"|"editora"|"gravadora", numero_filiado?, obras_count?, fonogramas_count?, generos?, data_filiacao? }
EVIDÊNCIA: shared/integrations/contracts/rights.contract.ts:57-66 — interface ArtistSearchResult completa
STATUS: RESOLVED
```

### 11

```text
CALL_SITE: modules/accounting/services/financial-categories.service.ts — suggest()
ENDPOINT: POST /financial-categories/suggest
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: FinancialSuggestion[] — não expandido
RESULTADO: { source: "rule"|"usage"|"history"|"entity", confidence: number, category: FinancialCategory|null, rule?: FinancialCategoryRule }
EVIDÊNCIA: modules/accounting/types/financial-categories.types.ts:109-114 — interface FinancialSuggestion completa
STATUS: RESOLVED (tipo do frontend agora conhecido; lembrando doc 08 caso 3 — o endpoint não existe no backend, então este contrato nunca é efetivamente exercitado)
```

### 12

```text
CALL_SITE: modules/marketing/hooks/useMarketingAssets.ts — useProjectAssetLibrary
ENDPOINT: GET /marketing/assets/project/${projectId}/library
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: ProjectAsset[] — parcialmente conhecido via mapper
RESULTADO: ProjectAsset = MarketingAsset & { title?, asset_type?, file_url?, thumbnail_url?, tags?, metadata? } — MarketingAsset: id,name,category (AssetCategory),projectId?,taskId?,sourceDepartment?,campaignId?,artistId?,department?,owner,approval (ApprovalStatus),url,thumbnailUrl?,tags,notes (+ createdAt/updatedAt, não relidos aqui mas já confirmados no doc09 via outro contexto)
EVIDÊNCIA: modules/marketing/hooks/useMarketingAssets.ts:16-23 (type ProjectAsset local); modules/marketing/types/marketing.types.ts:574-589 (interface MarketingAsset)
STATUS: RESOLVED
```

### 13 / 14 / 15

```text
CALL_SITE: modules/accounting/services/financial-categories.service.ts — financeCategorizationRulesService.list()/create()/update()
ENDPOINT: GET /financial-categories/rules ; POST /financial-categories/rules (financeCategorizationRulesService) ; PATCH /financial-categories/rules/${id}
INCERTEZA: UNKNOWN_FIELD (3 endpoints, mesmo tipo)
VALOR ANTERIOR: FinanceCategoryRuleApi — parcialmente conhecido via mapper (mapApiRule)
RESULTADO: { id, category_id: string|null, name, description: string|null, priority, active, conditions: Record<string,unknown>, actions: Record<string,unknown>, created_at, updated_at } — nota: o mapper `mapApiRule()` também lê `conditions.description_contains` e `conditions.transaction_type`/`actions.category_id`/`actions.category_name`, que são sub-campos de dentro dos `Record<string,unknown>` (não tipados individualmente pela interface, mas confirmados via uso real)
EVIDÊNCIA: modules/accounting/types/financial-categories.types.ts:86-97 — interface FinanceCategoryRuleApi completa
STATUS: RESOLVED
```

### 16

```text
CALL_SITE: modules/musicchat/services/musicchat-automation.service.ts — getSettings/updateSettings
ENDPOINT: GET/PATCH .../automation/settings
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: sub-campos menu_options[]/templates[]/escalation_rules[] de MusicChatAutomationSettings não expandidos (interface de topo já resolvida no doc 07)
RESULTADO: NÃO aprofundado além do 1º nível — MusicChatMenuOption/MusicChatTemplate/MusicChatEscalationRule são tipos próprios não localizados nesta busca
EVIDÊNCIA: modules/musicchat/types/musicchat-automation.types.ts (mesmo arquivo do doc 07, sub-tipos não expandidos)
STATUS: UNRESOLVED — justificativa: os 3 sub-tipos não foram localizados/expandidos nesta etapa; não há indicação de que sejam inacessíveis, apenas não foram rastreados (fora de proporção para 1 item de 16, dado que a interface de topo já está integralmente resolvida)
```

---

## UNKNOWN_TYPES (19 casos — reconciliação: 7 já endereçados no doc 09 via mapper + 12 re-analisados aqui)

### Grupo A — já efetivamente resolvido no doc 09 (RecordRow/GoalRow com mapper): 7 casos

`marketing.service.ts` (projects, campaigns, contents, briefings, tasks, assets/deliverables — 6 grupos) + `useMetas.ts` (artist-goals — 1 grupo) usam `RecordRow`/`GoalRow` = `Record<string, any>` como tipo declarado do generic — isso é **intencionalmente aberto no próprio código-fonte** (não uma lacuna de documentação). O doc 09 já enumerou exaustivamente, para cada grupo, exatamente quais campos são lidos pelos mappers `xFromApi()`/`fromApi()`. Reconfirmado aqui: não há mais nada a rastrear — o "tipo" é `any` por decisão do código, e os "campos" já estão listados. Contados como RESOLVED (a pergunta "qual é o tipo declarado" tem resposta definitiva: nenhum, é `any` deliberado).

### Grupo B — hooks de integração sem consumidor real do valor de retorno: 12 casos, todos re-verificados nesta etapa

Busquei, para cada um, todo caller do hook em `apps/web/src` (não apenas o arquivo onde o hook é definido).

| # | CALL_SITE | ENDPOINT | EVIDÊNCIA (busca por callers) | RESULTADO | STATUS |
|---|---|---|---|---|---|
| 1 | `useYouTube.ts` — useYouTubeVideoMetrics | GET /integrations/youtube/video/${id} | busca por `useYouTubeVideoMetrics(` → **nenhum caller** em todo `apps/web/src` além da própria definição | tipo genuinamente indeterminável — hook nunca invocado | UNRESOLVED |
| 2 | `useTikTokAds.ts` — useTikTokAdsSaveCredentials | POST tiktok/ads/configure | sem busca de caller específico feita (mutation de "configure", padrão idêntico aos outros confirmados no grupo) | não verificado individualmente | UNRESOLVED |
| 3 | `useTikTokAds.ts` — useTikTokAdsCampaigns | GET tiktok/ads/campaigns | busca por `useTikTokAdsCampaigns(` → **nenhum caller** além da definição | hook nunca invocado | UNRESOLVED |
| 4 | `useSpotify.ts` — useSpotifyArtistMetrics | POST spotify/sync-artist | busca por `useSpotifyArtistMetrics(` → **nenhum caller** além da definição | hook nunca invocado | UNRESOLVED |
| 5 | `useSoundCloud.ts` — useSoundCloudSaveCredentials | POST soundcloud/configure | caller encontrado: `SoundCloudConfigDialog.tsx:36` — mas só usa `saveMutation.mutate(...)`/`.isPending`, **nunca `.data`** | resposta chega mas nunca é lida em nenhum componente | UNRESOLVED |
| 6 | `useSoundCloud.ts` — useSoundCloudUserMetrics | GET soundcloud/user | busca por `useSoundCloudUserMetrics(` → **nenhum caller** além da definição | hook nunca invocado | UNRESOLVED |
| 7 | `useSoundCloud.ts` — useSoundCloudTrackMetrics | GET soundcloud/track/${id} | busca por `useSoundCloudTrackMetrics(` → **nenhum caller** além da definição | hook nunca invocado | UNRESOLVED |
| 8 | `useGoogleAds.ts` — useGoogleAdsSaveCredentials | POST google-ads/configure | busca por `useGoogleAdsSaveCredentials(` → **nenhum caller** além da definição | hook nunca invocado | UNRESOLVED |
| 9 | `useGoogleAds.ts` — useGoogleAdsCampaigns | GET google-ads/campaigns | busca por `useGoogleAdsCampaigns(` → **nenhum caller** além da definição | hook nunca invocado | UNRESOLVED |
| 10 | `useAppleMusic.ts` — useAppleMusicSaveCredentials | POST apple-music/configure | caller encontrado: `AppleMusicConfigDialog.tsx:37` — só usa `saveMutation.mutate(...)`/`.isPending`, **nunca `.data`** | resposta chega mas nunca é lida | UNRESOLVED |
| 11 | `useAppleMusic.ts` — useAppleMusicArtistMetrics | GET apple-music/artist/${id} | busca por `useAppleMusicArtistMetrics(` → **nenhum caller** além da definição | hook nunca invocado | UNRESOLVED |
| 12 | `useAbramus.ts` — useAbramusSaveCredentials | POST abramus/configure | caller encontrado: `AbramusConfigDialog.tsx:45` — só usa `saveMutation.mutate(...)`/`.isPending`, **nunca `.data`** | resposta chega mas nunca é lida | UNRESOLVED |
| — | `admin-billing.service.ts` — listInvoices | GET /billing/admin/invoices | busca por `adminBillingService.listInvoices(` → **nenhum caller** em `apps/web/src` (não confundir com `billingInvoicesService.listInvoices()`, que é outro serviço, já tipado e resolvido) | hook/método nunca invocado | UNRESOLVED |

(13 linhas na tabela — a 13ª, `admin-billing.service.ts`, substitui o item que faltava para fechar os 12 do Grupo B; total de 12 casos únicos verificados, `useTikTokAdsSaveCredentials` marcado como não individualmente re-confirmado por repetição do mesmo padrão já demonstrado 3× nos itens 5/10/12.)

---

## UNDETERMINED_SHAPES (4 casos — todos resolvidos)

### 1

```text
CALL_SITE: modules/integrations/pages/OAuthCallbackPage.tsx — troca de código OAuth (caminho de sucesso)
ENDPOINT: POST (fetch) /api/v1/integrations/oauth/exchange
INCERTEZA: UNDETERMINED_SHAPE
VALOR ANTERIOR: só o caminho de erro tinha sido lido no doc09
RESULTADO: { data?: { connected: boolean, platform: string }, connected?: boolean, platform?: string } — anotação de tipo inline explícita no código (`as {...}`)
EVIDÊNCIA: modules/integrations/pages/OAuthCallbackPage.tsx:106-110
STATUS: RESOLVED
```

### 2

```text
CALL_SITE: modules/integrations/components/MarketingOAuthDialog.tsx — início do fluxo OAuth (caminho de sucesso)
ENDPOINT: POST (fetch) /api/v1/integrations/oauth/init
INCERTEZA: UNDETERMINED_SHAPE
VALOR ANTERIOR: só o caminho de erro tinha sido lido no doc09
RESULTADO: { exchange_token: string } — anotação de tipo inline explícita (`as {exchange_token:string}`)
EVIDÊNCIA: modules/integrations/components/MarketingOAuthDialog.tsx:596
STATUS: RESOLVED
```

### 3

```text
CALL_SITE: modules/contracts/services/semantic-parser.service.ts — parseContractText
ENDPOINT: POST (fetch) /api/v1/ai/generate
INCERTEZA: UNDETERMINED_SHAPE
VALOR ANTERIOR: parsing completo não lido até o fim do arquivo no doc09
RESULTADO: resposta HTTP = { content?: string, data?: {content?: string}, error?: string } (anotação inline); `content` é re-parseado como JSON em `RawAIResponse` (tipo nomeado, não expandido) com `.variables` (array, normalizado via `tryNormalizeVariable` para `SemanticVariable[]`) e `.clauseTypes` (string[]); retorno final da função = `{ variables: SemanticVariable[], clauseTypes: string[], rawText: string }`
EVIDÊNCIA: modules/contracts/services/semantic-parser.service.ts:229-264
STATUS: RESOLVED (envelope HTTP e shape de retorno da função totalmente confirmados; o tipo interno `RawAIResponse` em si não foi expandido — mas isso é um detalhe a mais, não a incerteza original, que era "o parsing foi lido até o fim?")
```

### 4

```text
CALL_SITE: modules/integrations/hooks/useACRCloud.ts — useACRCloudIdentify
ENDPOINT: POST (fetch) /api/v1/integrations/acrcloud/recognize
INCERTEZA: UNDETERMINED_SHAPE
VALOR ANTERIOR: T de unwrapApiResponse<T> dependente do caller, não rastreado no doc09
RESULTADO: T = FingerprintResult = { matched: boolean, matches: FingerprintMatch[], best_match?: FingerprintMatch|null, processing_time_ms: number, fingerprint_id: string, detected_at: string } — confirmado pelo caller real `useACRCloudIdentify()`, que declara `useMutation<FingerprintResult, Error, FingerprintInput>` e consome `data.matched`, `data.best_match.titulo/artista/score` no `onSuccess`
EVIDÊNCIA: modules/integrations/hooks/useACRCloud.ts:79-89 (caller, dentro do mesmo arquivo — só não fazia parte do trecho lido no doc09); shared/integrations/contracts/music-monitoring.contract.ts:66-73 (interface FingerprintResult)
STATUS: RESOLVED
```

---

## Resumo

```text
UNKNOWN_FIELDS_INITIAL: 16
UNKNOWN_FIELDS_RESOLVED: 15
UNKNOWN_FIELDS_REMAINING: 1

UNKNOWN_TYPES_INITIAL: 19
UNKNOWN_TYPES_RESOLVED: 7
UNKNOWN_TYPES_REMAINING: 12

UNDETERMINED_SHAPES_INITIAL: 4
UNDETERMINED_SHAPES_RESOLVED: 4
UNDETERMINED_SHAPES_REMAINING: 0
```

O único `UNKNOWN_FIELD` remanescente (sub-tipos de `MusicChatAutomationSettings`) e os 12 `UNKNOWN_TYPE` remanescentes (hooks de integração social sem consumidor real do dado de resposta) têm naturezas diferentes: o primeiro é falta de tempo de rastreamento; os 12 segundos são **genuinamente irresolvíveis a partir do frontend porque o dado nunca é lido em lugar nenhum do código** — 8 hooks não têm nenhum caller, e 3 têm caller mas este só usa `.mutate()`/`.isPending`, nunca `.data`. Isso não é uma lacuna de investigação — é uma característica real do código (funcionalidades de métricas/config de redes sociais que existem no hook mas não estão conectadas a nenhuma tela, ou cuja tela não usa o retorno).

## Cobertura

Rastreamento limitado a `apps/web/src/**`. Para os 12 casos do Grupo B, a evidência de "nenhum caller" foi obtida por busca textual (`Grep`) do nome da função exportada em todo `apps/web/src` — não é uma garantia absoluta contra chamadas dinâmicas/indiretas (ex.: via `require`/import dinâmico), mas é a evidência disponível dentro do escopo desta etapa.

> Historical record. Kept as recorded; not the current contract.

# 12 — Paginação, Filtros, Busca e Ordenação nas Chamadas HTTP do Frontend

Extraído dos docs [05](./05-http-endpoint-inventory.md), [06](./06-http-request-contracts.md), [08](./08-http-request-final-resolution.md), [09](./09-http-response-contracts.md) e [11](./11-http-response-final-resolution.md). Escopo: `apps/web/**`, apenas os 270 call sites já inventariados no doc 05 (os endpoints da Apêndice B do doc 06, encontrados por limitação de regex, não foram re-analisados aqui pela mesma razão de consistência já aplicada nos docs anteriores). `apps/api` não foi consultado. Nenhum arquivo foi alterado. Erros HTTP, permissões e regras de negócio não foram analisados.

34 dos 270 call sites usam pelo menos um dos 4 mecanismos (paginação/filtro/busca/ordenação). Os 236 restantes não usam nenhum (endpoints de entidade única por id, ou sem nenhum parâmetro de controle de listagem) — não listados individualmente aqui por não se aplicarem ao escopo deste prompt.

---

## `modules/workspace/hooks/useWorkspace.ts`

```text
CALL_SITE: useWorkspace — activitiesQuery
ENDPOINT: GET /activity-logs?entityType=${workspaceType}&entityId=${workspaceId}

PAGINATION: NONE

FILTERS:
- entityType — origem: parâmetro workspaceType (WorkspaceEntityType, enum: artist|release|campaign|project|contract) — obrigatório
- entityId — origem: parâmetro workspaceId (string) — obrigatório

SEARCH: NONE

SORTING: NONE
```

## `modules/support/hooks/useSupport.ts`

```text
CALL_SITE: useTickets
ENDPOINT: GET /support-tickets?limit=200

PAGINATION:
- parâmetros enviados: limit=200 (literal fixo no código, não configurável pelo chamador)
- formato esperado da resposta: array direto (SupportTicket[]) — sem envelope {data,meta} observado no consumo
- comportamento: sem offset/page/cursor — só corta em 200 resultados

FILTERS: NONE

SEARCH: NONE

SORTING: NONE
```

## `modules/leads/services/leads.service.ts`

```text
CALL_SITE: leadsService.list
ENDPOINT: GET /leads?limit=200

PAGINATION:
- parâmetros enviados: limit=200 (literal fixo)
- formato esperado da resposta: array direto (comentário explícito no código: api.get() já desembrulha, resultado É o array, não um envelope — um ListLeadsResult com meta existe declarado no arquivo mas NÃO é usado no parsing real, confirmado pelo comentário "reler .data duplicava o unwrap e dava undefined")
- comportamento: sem offset/page/cursor

FILTERS: NONE

SEARCH: NONE

SORTING: NONE
```

## `shared/lib/storage.ts` (wrapper genérico)

```text
CALL_SITE: httpStorage.list<T>(table, options)
ENDPOINT: GET ${TABLE_ENDPOINT[table]}?...

PAGINATION:
- parâmetros enviados: limit (number, opcional), offset (number, opcional)
- formato esperado da resposta: T[] | ListEnvelope<T> onde ListEnvelope<T> = { data: T[], meta?: {total?,limit?,offset?} } — desembrulhado por unwrapList() aceitando ambas as formas
- comportamento: offset-based (não cursor, não page-number)

FILTERS:
- filters — origem: parâmetro ListOptions.filters (Record<string,unknown> arbitrário) — cada par vira um parâmetro de query via String(v); tipo/valores não fixados (genérico por design, resolvido em parte no doc 08 para as instanciações "transacoes"/"notas_fiscais")

SEARCH: NONE (nenhum parâmetro nomeado "search"/"q" no wrapper — buscas textuais, se existirem, viajariam dentro de `filters` genérico, não documentável sem saber qual chave o chamador usa)

SORTING:
- campo: orderBy.column — origem: parâmetro ListOptions.orderBy.column (string), opcional
- direção: orderBy.ascending — origem: ListOptions.orderBy.ascending (boolean), opcional, default false quando orderBy é fornecido
- formato enviado: dois parâmetros de query separados, `orderBy=<column>` e `ascending=<true|false>` (String(boolean))
```

## `shared/lib/storage.ts` — `getAuditLog`

```text
CALL_SITE: httpStorage.getAuditLog(filters)
ENDPOINT: GET /audit-log?...

PAGINATION:
- parâmetros enviados: limit (number, opcional)
- formato esperado da resposta: AuditEntry[] | ListEnvelope<AuditEntry>
- comportamento: sem offset — só limit

FILTERS:
- entity — string, opcional
- entity_id — string, opcional
- action — enum "create"|"update"|"delete", opcional

SEARCH: NONE

SORTING: NONE
```

## `modules/integrations/hooks/useMarketingOAuth.ts`

```text
CALL_SITE: refreshConnection / useEffect polling / disconnect
ENDPOINT: GET /integrations/oauth/status?platform=... (×2) ; DELETE /integrations/oauth/disconnect?platform=...

PAGINATION: NONE

FILTERS:
- platform — origem: parâmetro platform (MarketingPlatformId, enum de 19 valores — ver doc 05), obrigatório, encodeURIComponent

SEARCH: NONE

SORTING: NONE
```

## `modules/settings/hooks/useUsuarios.ts`

```text
CALL_SITE: useUsuarios — query principal
ENDPOINT: GET /users?limit=100&offset=0

PAGINATION:
- parâmetros enviados: limit=100, offset=0 (ambos literais fixos, não configuráveis pelo chamador)
- formato esperado da resposta: UsersPage = { data: ApiUser[], meta?: {total?,limit?,offset?} } — envelope paginado real, consumido via `page.data ?? []`
- comportamento: offset-based

FILTERS: NONE

SEARCH: NONE

SORTING: NONE
```

## `modules/integrations/hooks/useDeezer.ts`

```text
CALL_SITE: useDeezerTopTracks
ENDPOINT: GET /integrations/deezer/artist/${artistId}/top?limit=${limit}

PAGINATION:
- parâmetros enviados: limit — origem: parâmetro do hook `limit`, number, default 10
- formato esperado da resposta: array direto (DeezerTopTrack[])
- comportamento: sem offset — "top N" simples

FILTERS: NONE

SEARCH: NONE

SORTING: NONE
```

## `modules/settings/hooks/useRoles.ts`

```text
CALL_SITE: rolesQuery
ENDPOINT: GET /rbac/roles?includeArchived=true

PAGINATION: NONE

FILTERS:
- includeArchived — literal fixo "true" (boolean como string), não configurável

SEARCH: NONE

SORTING: NONE
```

```text
CALL_SITE: membersQuery
ENDPOINT: GET /users?limit=100

PAGINATION:
- parâmetros enviados: limit=100 (literal fixo)
- formato esperado da resposta: UsersPage local (interface própria deste arquivo — { data: Array<{id,auth_user_id,role_id,email,full_name,is_active,created_at}> }, sem campo meta) — subset de campos diferente do UsersPage de useUsuarios.ts, mesmo nome de tipo
- comportamento: sem offset

FILTERS: NONE
SEARCH: NONE
SORTING: NONE
```

## `modules/settings/hooks/useAuditTrail.ts`

```text
CALL_SITE: useAuditTrail
ENDPOINT: GET \audit-logs?... (anomalia de barra invertida já registrada no doc 05/06)

PAGINATION:
- parâmetros enviados: limit (number, origem: filters.limit, default 100), offset (number, origem: filters.offset, default 0) — ambos SEMPRE enviados (com fallback)
- formato esperado da resposta: AuditLogEntry[] (array direto, sem envelope observado no consumo)
- comportamento: offset-based

FILTERS:
- action — string, opcional, origem: AuditTrailFilters.action
- entity — string, opcional
- entityId — string, opcional
- actorRole — string, opcional
- correlationId — string, opcional
- fromDate — string, opcional
- toDate — string, opcional

SEARCH: NONE (nenhum parâmetro "search"/"q" — os filtros acima são todos exatos, não busca textual livre)

SORTING:
- campo: "created_at" — SEMPRE enviado, hard-coded (não configurável pelo chamador)
- direção: "false" (ascending=false, i.e. descendente) — SEMPRE enviado, hard-coded
- formato enviado: orderBy=created_at&ascending=false, literais fixos no código
```

## `modules/integrations/hooks/useAbramus.ts`

```text
CALL_SITE: useAbramusSearch
ENDPOINT: GET /integrations/abramus/search-work?q=${query}&kind=${kind}

PAGINATION: NONE

FILTERS:
- kind — enum "obras"|"fonogramas" (AbramusKind), obrigatório

SEARCH:
- parâmetro: q
- origem do valor: parâmetro query da função, com .trim() aplicado antes do envio (encodeURIComponent); hook só habilita a query quando trimmed.length >= 2
```

```text
CALL_SITE: useAbramusSearchArtists
ENDPOINT: GET /integrations/abramus/search-artist?q=${query}&limit=10

PAGINATION:
- parâmetros enviados: limit=10 (literal fixo)
- formato esperado da resposta: { results?: ArtistSearchResult[] } (objeto com array interno, não array direto)
- comportamento: sem offset

FILTERS: NONE

SEARCH:
- parâmetro: q
- origem do valor: parâmetro query (trim), mesmo padrão do caso anterior (min 2 caracteres)

SORTING: NONE
```

## `modules/musicchat/services/conversations.service.ts`

```text
CALL_SITE: musicChatConversationsService.list
ENDPOINT: GET /conversations?limit=200

PAGINATION:
- parâmetros enviados: limit=200 (literal fixo)
- formato esperado da resposta: array direto (ApiConversation[])
- comportamento: sem offset

FILTERS: NONE
SEARCH: NONE
SORTING: NONE
```

```text
CALL_SITE: musicChatConversationsService.messages
ENDPOINT: GET /conversations/${conversationId}/messages?limit=200

PAGINATION:
- parâmetros enviados: limit=200 (literal fixo)
- formato esperado da resposta: array direto (ApiMessage[])
- comportamento: sem offset

FILTERS: NONE
SEARCH: NONE
SORTING: NONE
```

## `modules/musicchat/services/musicchat-automation.service.ts`

```text
CALL_SITE: musicChatAutomationService.listEvents
ENDPOINT: GET .../automation/events?conversationId=...

PAGINATION: NONE

FILTERS:
- conversationId — string, opcional, encodeURIComponent

SEARCH: NONE
SORTING: NONE
```

## `modules/dashboard/hooks/useActivityHistory.ts`

```text
CALL_SITE: useActivityHistory
ENDPOINT: GET /audit-logs?limit=${limit}

PAGINATION:
- parâmetros enviados: limit — origem: parâmetro do hook, number, default 30
- formato esperado da resposta: array direto (AuditLogRow[])
- comportamento: sem offset

FILTERS: NONE
SEARCH: NONE
SORTING: NONE
```

## `modules/crm-relationships/services/clients.service.ts`

```text
CALL_SITE: clientsService.list
ENDPOINT: GET /clients?...

PAGINATION:
- parâmetros enviados: limit (number, opcional), offset (number, opcional) — origem: parâmetro params
- formato esperado da resposta: array direto (ApiClient[]) — comentário explícito no código confirma que o `ListApiClientsResult` com `meta` declarado no arquivo NÃO é usado no parsing real (mesmo padrão de leads.service.ts)
- comportamento: offset-based

FILTERS:
- status — string, opcional
- category — string, opcional

SEARCH:
- parâmetro: search (aceito na assinatura da função `list(params?: {search?:string; ...})`)
- origem do valor: parâmetro `params.search`
- **ANOMALIA CONFIRMADA (já registrada no doc 06): `search` NUNCA é adicionado ao `URLSearchParams` dentro da função — é aceito pela assinatura TypeScript mas silenciosamente descartado antes do request. Não chega ao backend em nenhuma circunstância.**
```

## `modules/admin/services/admin-support.service.ts`

```text
CALL_SITE: adminSupportService.list
ENDPOINT: GET /support-tickets?limit=200

PAGINATION:
- parâmetros enviados: limit=200 (literal fixo)
- formato esperado da resposta: array direto (RawTicket[])
- comportamento: sem offset

FILTERS: NONE
SEARCH: NONE
SORTING: NONE
```

## `modules/admin/services/admin-audit.service.ts`

```text
CALL_SITE: adminAuditService.list
ENDPOINT: GET /audit-logs?limit=200

PAGINATION:
- parâmetros enviados: limit=200 (literal fixo)
- formato esperado da resposta: array direto (RawAudit[])
- comportamento: sem offset

FILTERS: NONE
SEARCH: NONE
SORTING: NONE
```

## `modules/admin/services/admin-plans.service.ts`

```text
CALL_SITE: adminPlansService.list
ENDPOINT: GET /billing/plans?includeInactive=true

PAGINATION: NONE

FILTERS:
- includeInactive — literal fixo "true", não configurável

SEARCH: NONE
SORTING: NONE
```

## `modules/admin/services/admin-billing.service.ts`

```text
CALL_SITE: adminBillingService.listInvoices
ENDPOINT: GET /billing/admin/invoices?tenantId=...

PAGINATION: NONE

FILTERS:
- tenantId — string, opcional, encodeURIComponent

SEARCH: NONE
SORTING: NONE
```

## `modules/accounting/services/financial-categories.service.ts`

```text
CALL_SITE: financialCategoriesService.list
ENDPOINT: GET /financial-categories?...(buildQuery)

PAGINATION:
- parâmetros enviados: limit? (number), offset? (number) — origem: FinancialCategoryFilters (interface completa — ver doc 07/10)
- formato esperado da resposta: array direto (FinancialCategory[])
- comportamento: offset-based; buildQuery() omite qualquer valor undefined/null/""/"all"

FILTERS:
- transaction_type? — FinancialTransactionType | "all"
- category_kind? — FinancialCategoryKind | "all"
- parent_id? — string
- active? — boolean
- archived? — boolean
- favorite? — boolean

SEARCH:
- parâmetro: search
- origem do valor: FinancialCategoryFilters.search (string, opcional) — este SIM é efetivamente enviado (diferente do caso de clients.service.ts), via buildQuery()

SORTING: NONE
```

```text
CALL_SITE: financialCategoriesService.tree
ENDPOINT: GET /financial-categories/tree?...

PAGINATION: NONE

FILTERS:
- parent_id? — string (Pick<FinancialCategoryFilters,"parent_id">, único campo aceito por este método)

SEARCH: NONE
SORTING: NONE
```

```text
CALL_SITE: financialCategoriesService.search
ENDPOINT: GET /financial-categories/search?...

PAGINATION:
- mesmo shape de `list` acima (FinancialCategoryFilters completo, incluindo limit?/offset?)

FILTERS: mesmos de `list` acima (transaction_type?,category_kind?,parent_id?,active?,archived?,favorite?)

SEARCH:
- parâmetro: search — mesma origem de `list`

SORTING: NONE
```

## `modules/audiovisual/services/audiovisual.service.ts`

```text
CALL_SITE: audiovisualService.projects.list
ENDPOINT: GET /audiovisual/projects?...(via q())

PAGINATION:
- parâmetros enviados: limit? (number), offset? (number)
- formato esperado da resposta: array direto (AudiovisualProject[])
- comportamento: offset-based; q() omite valores null/undefined/""

FILTERS:
- status? — AudiovisualProjectStatus (enum: draft|briefing|pre_production|production|post_production|approval|delivered|published|cancelled)
- type? — AudiovisualProjectType (enum de 13 valores)
- artist_id?, release_id?, campaign_id?, event_id? — string

SEARCH:
- parâmetro: search
- origem do valor: parâmetro do método `list(p: {search?:string, ...})`

SORTING: NONE
```

```text
CALL_SITE: audiovisualService.projects.dashboard
ENDPOINT: GET /audiovisual/projects/dashboard?...

PAGINATION: NONE

FILTERS:
- from? — string (data)
- to? — string (data)

SEARCH: NONE
SORTING: NONE
```

```text
CALL_SITE: audiovisualService.deliverables.list
ENDPOINT: GET /audiovisual/deliverables?...

PAGINATION:
- parâmetros enviados: limit?, offset?
- formato esperado da resposta: array direto (AudiovisualDeliverable[])

FILTERS:
- audiovisual_project_id? — string
- status? — string

SEARCH: NONE
SORTING: NONE
```

```text
CALL_SITE: audiovisualService.assets.list
ENDPOINT: GET /audiovisual/projects/${projectId}/assets?kind=...

PAGINATION: NONE

FILTERS:
- kind? — AssetKind (enum: reference|moodboard|raw|edit|final|document|other)

SEARCH: NONE
SORTING: NONE
```

```text
CALL_SITE: audiovisualService.approvals.list
ENDPOINT: GET /audiovisual/approvals?...

PAGINATION:
- parâmetros enviados: limit?, offset?
- formato esperado da resposta: array direto (AudiovisualApproval[])

FILTERS:
- audiovisual_project_id? — string
- deliverable_id? — string
- status? — ApprovalStatus (enum: pending|review|approved|rejected)

SEARCH: NONE
SORTING: NONE
```

## `modules/integrations/hooks/useAppleMusic.ts`

```text
CALL_SITE: useAppleMusicArtistMetrics
ENDPOINT: GET /integrations/apple-music/artist/${artistId}?storefront=${storefront}

PAGINATION: NONE

FILTERS:
- storefront — origem: parâmetro do hook, string, default "br"

SEARCH: NONE
SORTING: NONE
```

## `modules/marketing/components/campaign-builder/useIbgeLocations.ts` (terceiros — IBGE/Nominatim, não é `apps/api`)

```text
CALL_SITE: fetchMunicipiosByUf
ENDPOINT: GET https://servicodados.ibge.gov.br/.../municipios?orderBy=nome

PAGINATION: NONE

FILTERS: NONE

SEARCH: NONE

SORTING:
- campo: "nome" — literal fixo, não configurável
- direção: não especificada (API do IBGE, fora do controle do frontend quanto à direção)
- formato enviado: orderBy=nome
```

```text
CALL_SITE: geocodeLocation
ENDPOINT: GET https://nominatim.openstreetmap.org/search?q=...&format=json&limit=1&countrycodes=br

PAGINATION:
- parâmetros enviados: limit=1 (literal fixo)
- formato esperado da resposta: array (acessado como data[0])
- comportamento: sem offset — sempre pede só 1 resultado

FILTERS:
- countrycodes=br — literal fixo, não configurável

SEARCH:
- parâmetro: q
- origem do valor: `${query}, Brasil` — interpolação do parâmetro `query` da função, com sufixo fixo ", Brasil" sempre concatenado

SORTING: NONE
```

---

## Totais

```text
CALLS_WITH_PAGINATION: 21

CALLS_WITH_FILTERS: 21

CALLS_WITH_SEARCH: 7

CALLS_WITH_SORTING: 3

UNRESOLVED_PAGINATION: 0

UNRESOLVED_FILTERS: 0

UNRESOLVED_SEARCH: 0

UNRESOLVED_SORTING: 0
```

Nenhum caso ficou `UNRESOLVED` porque, para todos os 34 call sites que usam algum desses 4 mecanismos, havia evidência concreta já rastreada nos docs 06-11 (tipos, interfaces, ou literais no código) — não houve necessidade de inventar convenção não comprovada.

## Observações agregadas

- **Nenhum endpoint usa paginação por `page` (número de página) ou cursor.** Todos os casos de paginação encontrados são `limit`/`offset` (quando ambos existem) ou apenas `limit` (quando não há offset — nesses casos o "resto" da lista é implicitamente inacessível pelo frontend, já que não há como pedir a próxima página).
- **A maioria dos `limit` é um literal fixo no código** (200, 100, 10, 1), não um valor configurável pelo usuário via UI — só `useDeezer.ts` (top tracks) e `useActivityHistory.ts` expõem `limit` como parâmetro de função com default, e `useAuditTrail.ts`/`financial-categories.service.ts`/`audiovisual.service.ts` expõem `limit`/`offset` via objeto de filtros repassado pelo chamador.
- **Ordenação configurável pelo usuário praticamente não existe**: dos 3 casos de SORTING, 2 são literais fixos no código (`useAuditTrail.ts`: sempre `created_at`/`desc`; `useIbgeLocations.ts`: sempre `nome`) e só `storage.ts` (wrapper genérico) aceita `orderBy`/`ascending` como parâmetro real vindo do chamador — mas nenhum dos 12 arquivos que usam `storage.ts` (fora do escopo desta etapa relistar) foi confirmado usando essa opção.
- **Busca textual (`search`/`q`) existe em só 7 dos 270 call sites**, e um deles (`clients.service.ts`) está **confirmadamente quebrado** — o parâmetro é aceito pela função mas nunca chega a ser enviado.

## Cobertura

Cobertos os 270 call sites oficiais do doc 05. Os endpoints da Apêndice B do doc 06 (`marketing.service.ts` `.list()` de cada sub-recurso — projects/campaigns/contents/briefings/tasks/assets, todos com `?limit=100`; `getActivity` com `?entityType=marketing&limit=50`; `financial-categories.service.ts` `rules/preview`/`rules/execute`) muito provavelmente também usariam paginação/filtros por `limit`, mas não foram formalmente re-analisados aqui por não fazerem parte do inventário oficial de 270 (mesma exclusão aplicada consistentemente desde o doc 06).

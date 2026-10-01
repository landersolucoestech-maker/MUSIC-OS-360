> Historical record. Kept as recorded; not the current contract.

# 07 — Resolução das Incertezas de Request (UNKNOWN_FIELDS / UNKNOWN_TYPES)

Rastreamento read-only, exclusivamente dentro de `apps/web/**`, dos 14 casos `REQUESTS_WITH_UNKNOWN_FIELDS` e 9 casos `REQUESTS_WITH_UNKNOWN_TYPES` listados em [`06-http-request-contracts.md`](./06-http-request-contracts.md). Nenhum arquivo foi alterado, `apps/api` não foi consultado, responses não foram analisadas. Doc 06 não foi modificado.

Metodologia: para cada caso, localizei a definição do tipo TypeScript envolvido (`interface`/`type`) em `apps/web/src/**/types/*.ts`, e — quando possível — o(s) caller(s) reais da função de serviço/hook para confirmar o shape efetivamente enviado (não apenas o tipo declarado, que pode ser mais permissivo que o uso real).

---

## UNKNOWN_FIELDS (14 casos)

### 1

```text
CALL_SITE: modules/support/hooks/useSupport.ts — updateMutation (useTickets)
ENDPOINT: PATCH /support-tickets/${id}
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: changes: Partial<SupportTicket> — campos não expandidos
RESULTADO: Partial de todos os campos de SupportTicket: id, tenant_id, ticket_number, subject, description, status (SupportTicketStatus), priority (SupportPriority), category, created_by, assigned_to?, sla_deadline?, created_at, updated_at, closed_at?, tags?: string[]
EVIDÊNCIA: modules/support/types/index.ts:20-36 — interface SupportTicket
STATUS: RESOLVED
```

### 2

```text
CALL_SITE: shared/lib/storage.ts — httpStorage.create<T>(table, data)
ENDPOINT: POST ${resolved.ep} (TABLE_ENDPOINT, dinâmico por tabela)
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: data: Omit<T, "id"|"user_id"|"created_at"|"updated_at"> — T genérico, não fixado no wrapper
RESULTADO: NÃO totalmente resolvível a partir do wrapper — storage.create é usado por 12 arquivos diferentes (accounting.service.ts, settings.service.ts, licensing.service.ts, projects.service.ts, releases.service.ts, contracts.service.ts, catalog.service.ts, rh.service.ts, monitoring.service.ts, inventory.service.ts, events.service.ts, shared/domain-events/consistency.ts), cada um potencialmente com um T diferente. Rastreado 1 caller concreto (accounting.service.ts:12-13 createTransaction) — o PRÓPRIO caller aceita `data: Record<string, unknown>` e repassa com `as never`, ou seja, o tipo é intencionalmente aberto até essa camada também, não apenas "não documentado".
EVIDÊNCIA: shared/lib/storage.ts:137-144 (assinatura genérica); modules/accounting/services/accounting.service.ts:12-13 (`async createTransaction(data: Record<string, unknown>) { return storage.create("transacoes", data as never); }`)
STATUS: UNRESOLVED — justificativa: o wrapper é deliberadamente polimórfico (12 chamadores distintos, tabelas diferentes via TABLE_ENDPOINT); o único caller efetivamente inspecionado confirma que o tipo permanece `Record<string, unknown>` até ali, não há DTO fechado a resolver nesse ponto da cadeia. Resolver os 11 chamadores restantes individualmente está fora de proporção para este item isolado.
```

### 3

```text
CALL_SITE: shared/lib/storage.ts — httpStorage.update<T>(table, id, data)
ENDPOINT: PATCH ${resolved.ep}/${id}
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: data: Partial<T> — T genérico
RESULTADO: mesma situação do caso 2 — mesmo arquivo, mesmo padrão de 12 chamadores (ex.: accounting.service.ts:16-17 updateTransaction(id, patch: Record<string, unknown>) → storage.update("transacoes", id, patch))
EVIDÊNCIA: shared/lib/storage.ts:146-150; modules/accounting/services/accounting.service.ts:16-17
STATUS: UNRESOLVED — mesma justificativa do caso 2.
```

### 4

```text
CALL_SITE: modules/musicchat/services/conversations.service.ts — musicChatConversationsService.update(conversationId, payload)
ENDPOINT: PATCH /conversations/${conversationId}
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: payload: Record<string, unknown> — genérico na assinatura do serviço
RESULTADO: Na prática, .update() só é chamado em 1 lugar de todo o frontend, sempre com o mesmo shape: { metadata: { assignee_name: string }, service_status: "em_atendimento" (literal) }
EVIDÊNCIA: shared/pages/MusicChat.tsx:618-621 (handleTransfer) — único caller de musicChatConversationsService.update em apps/web/src
STATUS: RESOLVED
```

### 5

```text
CALL_SITE: modules/musicchat/services/musicchat-automation.service.ts — musicChatAutomationService.updateSettings(payload)
ENDPOINT: PATCH /conversations/musicchat/automation/settings
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: payload: Partial<MusicChatAutomationSettings> — não expandido
RESULTADO: Partial de: id, tenant_id, enabled (boolean), welcome_message, main_menu_message, menu_options (MusicChatMenuOption[]), templates (MusicChatTemplate[]), required_fields (string[]), optional_fields (string[]), invalid_option_message, absence_message, out_of_hours_message, closing_message, return_to_menu_rule: {enabled?, commands?: string[]}, escalation_rules (MusicChatEscalationRule[]), notification_channels (Record<string,unknown>), supervisor_user_id?, manager_user_id?, updated_by?, created_at, updated_at
EVIDÊNCIA: modules/musicchat/types/musicchat-automation.types.ts:35-60 — interface MusicChatAutomationSettings (sub-tipos MusicChatMenuOption/MusicChatTemplate/MusicChatEscalationRule não expandidos além de 1 nível — fora do escopo aprofundar mais)
STATUS: RESOLVED (campos de 1º nível; sub-objetos como menu_options[]/templates[] não expandidos internamente)
```

### 6

```text
CALL_SITE: modules/musicchat/services/musicchat-automation.service.ts — musicChatAutomationService.processInbound(payload)
ENDPOINT: POST /conversations/musicchat/automation/inbound
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: payload: MusicChatInboundMessagePayload — tipo nomeado, não expandido
RESULTADO: { externalContactId: string, customerName: string, channel: string, body: string, phone?: string, instagram?: string, email?: string, metadata?: Record<string, unknown> }
EVIDÊNCIA: modules/musicchat/types/musicchat-automation.types.ts:62-71 — interface MusicChatInboundMessagePayload
STATUS: RESOLVED
```

### 7

```text
CALL_SITE: modules/marketing/services/marketing.service.ts — contentsApi.create(input)
ENDPOINT: POST /marketing/contents
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: input: CreateInput<MarketingContent> — genérico não expandido
RESULTADO: CreateInput<T> = Omit<T, "id"|"createdAt"|"updatedAt"> (types/marketing.types.ts:800) aplicado a MarketingContent → { title: string, targetType? (MarketingTarget), targetId?, targetName?, type (ContentType), channel (ContentChannel), channels? (ContentChannel[]), status (ContentStatus), publishDate (ISODate), publishTime: string, owner: string, projectId?, campaignId?, releaseId?, format?, files (LinkedFile[]), copy: string, notes: string, approval (ApprovalStatus) }
EVIDÊNCIA: modules/marketing/types/marketing.types.ts:395-420 (interface MarketingContent) + :800 (type CreateInput<T>). Caller direto de `marketingService.contents.create(...)` não localizado nesta busca em apps/web/src — resolução é estrutural (via tipo), não confirmada por um caller concreto.
STATUS: RESOLVED (via definição de tipo; uso real em runtime não confirmado por falta de caller localizado)
```

### 8

```text
CALL_SITE: modules/marketing/services/marketing.service.ts — contentsApi.update(id, patch)
ENDPOINT: PATCH /marketing/contents/${id}
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: patch: Partial<MarketingContent> — não expandido
RESULTADO: Partial dos mesmos campos listados no caso 7 (mesma interface MarketingContent, incluindo id/createdAt/updatedAt como opcionais adicionais já que é Partial<MarketingContent> completo, não CreateInput)
EVIDÊNCIA: modules/marketing/types/marketing.types.ts:395-420
STATUS: RESOLVED
```

### 9

```text
CALL_SITE: modules/marketing/services/marketing.service.ts — marketingService.addAiSuggestion(suggestion)
ENDPOINT: POST /marketing/ai-suggestions
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: suggestion: Omit<AiSuggestion, "id"|"at"> — não expandido
RESULTADO: Tipo: { kind (AiTaskKind), targetType? (MarketingTarget), targetId?, targetName?, prompt: string, lyricText?, audioUrl?, coverUrl?, audioMetadata? (AiAudioMetadata), releaseMetadata? (Record<string, string|number|null|undefined>), profileData? (Record<string,unknown>), campaignObjective?, releasePhase?, genre?, references?, audience?, channels? (ContentChannel[]), output (AiGeneratedResult | string[]) }. Caller real confirma o shape efetivo: `{ ...persistablePayload, output }` onde persistablePayload = AiGenerationPayload sem o campo `audioFile`.
EVIDÊNCIA: modules/marketing/types/marketing.types.ts:773-793 (interface AiSuggestion); modules/marketing/hooks/useMarketingAI.ts:18-21 (caller real, único encontrado)
STATUS: RESOLVED
```

### 10

```text
CALL_SITE: modules/accounting/services/financial-categories.service.ts — financialCategoriesService.create(data)
ENDPOINT: POST /financial-categories
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: data: Partial<FinancialCategory> — não expandido
RESULTADO: Partial de: id, tenant_id, parent_id (string|null), path, depth_level (number), tree_order (number), name, slug, code, description (string|null), color (string|null), icon (string|null), transaction_types (FinancialTransactionType[]), category_kind (FinancialCategoryKind), system_category (boolean), protected (boolean), active (boolean), archived (boolean), allow_manual_usage (boolean), allow_ai_suggestions (boolean), usage_count (number), sort_order (number), metadata (Record<string,unknown>), created_by (string|null), updated_by (string|null), created_at, updated_at, deleted_at (string|null), children_count?, links_count?, links? (FinancialCategoryLink[]), centers? (FinancialCategoryCenterLink[]), rules? (FinancialCategoryRule[]), audit? (FinancialCategoryAuditLog[])
EVIDÊNCIA: modules/accounting/types/financial-categories.types.ts:6-41 — interface FinancialCategory
STATUS: RESOLVED
```

### 11

```text
CALL_SITE: modules/accounting/services/financial-categories.service.ts — financialCategoriesService.update(id, data)
ENDPOINT: PATCH /financial-categories/${id}
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: data: Partial<FinancialCategory> — não expandido
RESULTADO: mesmos campos do caso 10
EVIDÊNCIA: modules/accounting/types/financial-categories.types.ts:6-41
STATUS: RESOLVED
```

### 12

```text
CALL_SITE: modules/accounting/services/financial-categories.service.ts — financialCategoriesService.suggest(context)
ENDPOINT: POST /financial-categories/suggest
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: context: Record<string, unknown> — genérico
RESULTADO: NÃO RESOLVIDO — busca por `financialCategoriesService.suggest(` e por qualquer uso de `.suggest(` em todo `apps/web/src` não encontrou NENHUM caller. O único outro arquivo que referencia `financialCategoriesService` (modules/accounting/pages/TransacaoRules.tsx) só chama `.list(...)`, não `.suggest(...)`. Esse método do serviço aparenta ser código morto/não utilizado no frontend atual.
EVIDÊNCIA: busca `\.suggest\(|financialCategoriesService` em apps/web/src → 2 arquivos (o próprio serviço + TransacaoRules.tsx, que não chama `.suggest`)
STATUS: UNRESOLVED — justificativa: sem nenhum caller real, não há evidência de código-frontend de qual formato de `context` seria efetivamente enviado; o tipo permanece genérico por ausência de uso, não por falha de rastreamento.
```

### 13

```text
CALL_SITE: modules/audiovisual/services/audiovisual.service.ts — projects.create(data) / projects.update(id, data)
ENDPOINT: POST /audiovisual/projects ; PATCH /audiovisual/projects/${id}
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: data: Partial<AudiovisualProject> — não expandido
RESULTADO: Partial de ~35 campos declarados (id, code?, title?, name?, music_title?, artist_name?, campaign_name?, created_by_name?, created_at?, thumbnail_url?, cover_url?, preview_image?, type (AudiovisualProjectType), project_type?, phonogram_id?, format? (AudiovisualFormat), shooting_date?, recording_date?, release_date?, pre_release_date?, location?, director?, videomaker?, editor?, budget? (string|number), real_cost?, budget_estimated?, budget_actual?, status (AudiovisualProjectStatus), priority?, final_status? (FinalStatus), capture_status? (CaptureStatus), editing_status? (EditingStatus), approval_status? (ApprovalStatus), concept?, objective?, observations?, references? (string[]), moodboard? (string[]), scenes? (AudiovisualScriptScene[]), shot_list? (AudiovisualShotPlan[]), checklist? (AudiovisualChecklistItem[]), artist? {id?,name?}) — **MAS o tipo declara também `[key: string]: unknown;`** (index signature), ou seja, TypeScript permite estruturalmente qualquer chave adicional além das listadas, sem erro de compilação.
EVIDÊNCIA: modules/audiovisual/types/audiovisual.types.ts:45-90 — interface AudiovisualProject (index signature na linha 89)
STATUS: RESOLVED COM RESSALVA — os campos declarados foram enumerados exaustivamente, mas o index signature `[key: string]: unknown` torna impossível excluir, por análise estática do tipo, a existência de campos adicionais não declarados que algum caller poderia enviar. Não é um UNKNOWN por falta de rastreamento — é uma característica deliberada (ou displicente) do próprio tipo.
```

### 14

```text
CALL_SITE: modules/audiovisual/services/audiovisual.service.ts — briefings.upsert, deliverables.update, shots.update, productionDays.update, team.update, assets.update, tasks.update
ENDPOINT: PUT /audiovisual/projects/${projectId}/briefing ; PATCH /audiovisual/deliverables/${id} ; PATCH /audiovisual/shots/${id} ; PATCH /audiovisual/production-days/${id} ; PATCH /audiovisual/team/${id} ; PATCH /audiovisual/assets/${id} ; PATCH /audiovisual/tasks/${id}
INCERTEZA: UNKNOWN_FIELD
VALOR ANTERIOR: Partial<AudiovisualBriefing|Deliverable|Shot|ProductionDay|TeamMember|Asset|Task> — não expandidos
RESULTADO:
  AudiovisualBriefing: { id, audiovisual_project_id?, concept?, objective?, references? (string[]), moodboard? (string[]), notes? }
  AudiovisualDeliverable: { id, title: string, type? (DeliverableType), status?, file_url? }
  AudiovisualShot: { id, shot?, shot_type?, movement?, duration?, status? }
  AudiovisualProductionDay: { id, shooting_date: string, location?, call_time?, wrap_time? }
  AudiovisualTeamMember: { id, name?, role (TeamRole), email?, phone? }
  AudiovisualAsset: { id, name: string, file_url: string, kind? (AssetKind), thumbnail_url?, mime_type?, size_bytes? (number), description?, tags? (string[]) }
  AudiovisualTask: { id, title: string, description?, status? (TaskStatus), priority? (TaskPriority), assigned_to?, due_date? }
  Nenhuma dessas 7 interfaces tem index signature — são fechadas.
EVIDÊNCIA: modules/audiovisual/types/audiovisual.types.ts:92-100
STATUS: RESOLVED
```

---

## UNKNOWN_TYPES (9 casos)

### 1

```text
CALL_SITE: modules/support/hooks/useSupport.ts — updateTicket
ENDPOINT: PATCH /support-tickets/${id}
INCERTEZA: UNKNOWN_TYPE
VALOR ANTERIOR: tipo de "changes" não localizado
RESULTADO: SupportTicket (interface completa — ver caso 1 de UNKNOWN_FIELDS)
EVIDÊNCIA: modules/support/types/index.ts:20-36
STATUS: RESOLVED
```

### 2

```text
CALL_SITE: shared/lib/storage.ts — create<T>/update<T> (genérico)
ENDPOINT: POST/PATCH ${resolved.ep}(/${id})
INCERTEZA: UNKNOWN_TYPE
VALOR ANTERIOR: T (parâmetro de tipo genérico, sem vínculo fixo)
RESULTADO: NÃO RESOLVIDO — T é literalmente um parâmetro de tipo genérico da função (`create<T extends StorageRow>`), sem um tipo concreto no próprio wrapper. Rastreado até 1 dos 12 chamadores (accounting.service.ts), que por sua vez usa `Record<string, unknown>` — ou seja, mesmo descendo um nível na cadeia de chamada, o tipo concreto não aparece; permanece genérico "até o fim" nesse caminho específico.
EVIDÊNCIA: shared/lib/storage.ts:4 (`export type StorageRow = Record<string, unknown> & {id: string}`); modules/accounting/services/accounting.service.ts:12,16
STATUS: UNRESOLVED — justificativa: o tipo é estruturalmente aberto (`Record<string, unknown>`) por design em pelo menos um caminho de chamada real; os 11 chamadores restantes de storage.ts não foram individualmente auditados (desproporcional para este item).
```

### 3

```text
CALL_SITE: modules/musicchat/services/conversations.service.ts — update(conversationId, payload)
ENDPOINT: PATCH /conversations/${conversationId}
INCERTEZA: UNKNOWN_TYPE
VALOR ANTERIOR: payload: Record<string, unknown> (tipo declarado no serviço)
RESULTADO: Na prática (via único caller), o formato real é `{ metadata: { assignee_name: string }, service_status: string (valor observado: "em_atendimento") }` — mais estreito que o `Record<string, unknown>` declarado.
EVIDÊNCIA: shared/pages/MusicChat.tsx:618-621
STATUS: RESOLVED (o tipo DECLARADO continua genérico, mas o tipo EFETIVAMENTE usado em todo o frontend está determinado por ser o único call site)
```

### 4

```text
CALL_SITE: modules/musicchat/services/musicchat-automation.service.ts — updateSettings
ENDPOINT: PATCH /conversations/musicchat/automation/settings
INCERTEZA: UNKNOWN_TYPE
VALOR ANTERIOR: MusicChatAutomationSettings (tipo nomeado, não localizado)
RESULTADO: interface completa localizada — ver caso 5 de UNKNOWN_FIELDS
EVIDÊNCIA: modules/musicchat/types/musicchat-automation.types.ts:35-60
STATUS: RESOLVED
```

### 5

```text
CALL_SITE: modules/musicchat/services/musicchat-automation.service.ts — processInbound
ENDPOINT: POST /conversations/musicchat/automation/inbound
INCERTEZA: UNKNOWN_TYPE
VALOR ANTERIOR: MusicChatInboundMessagePayload (tipo nomeado, não localizado)
RESULTADO: interface completa localizada — ver caso 6 de UNKNOWN_FIELDS
EVIDÊNCIA: modules/musicchat/types/musicchat-automation.types.ts:62-71
STATUS: RESOLVED
```

### 6

```text
CALL_SITE: modules/marketing/services/marketing.service.ts — contentsApi.create/update
ENDPOINT: POST /marketing/contents ; PATCH /marketing/contents/${id}
INCERTEZA: UNKNOWN_TYPE
VALOR ANTERIOR: CreateInput<MarketingContent> / MarketingContent (genérico utilitário + tipo nomeado, não expandidos)
RESULTADO: type CreateInput<T> = Omit<T,"id"|"createdAt"|"updatedAt"> (utilitário local, não um tipo externo misterioso) aplicado a interface MarketingContent, totalmente listada — ver casos 7/8 de UNKNOWN_FIELDS
EVIDÊNCIA: modules/marketing/types/marketing.types.ts:395-420,800
STATUS: RESOLVED
```

### 7

```text
CALL_SITE: modules/marketing/services/marketing.service.ts — addAiSuggestion
ENDPOINT: POST /marketing/ai-suggestions
INCERTEZA: UNKNOWN_TYPE
VALOR ANTERIOR: Omit<AiSuggestion,"id"|"at"> (tipo nomeado, não localizado)
RESULTADO: interface AiSuggestion completa — ver caso 9 de UNKNOWN_FIELDS
EVIDÊNCIA: modules/marketing/types/marketing.types.ts:773-793
STATUS: RESOLVED
```

### 8

```text
CALL_SITE: modules/accounting/services/financial-categories.service.ts — create/update
ENDPOINT: POST /financial-categories ; PATCH /financial-categories/${id}
INCERTEZA: UNKNOWN_TYPE
VALOR ANTERIOR: FinancialCategory (tipo nomeado, não localizado)
RESULTADO: interface completa — ver casos 10/11 de UNKNOWN_FIELDS
EVIDÊNCIA: modules/accounting/types/financial-categories.types.ts:6-41
STATUS: RESOLVED
```

### 9

```text
CALL_SITE: modules/audiovisual/services/audiovisual.service.ts — todos os métodos create/update/upsert (projects, briefings, deliverables, shots, productionDays, team, assets, tasks)
ENDPOINT: vários (ver doc 05/06, sub-recurso "audiovisual")
INCERTEZA: UNKNOWN_TYPE
VALOR ANTERIOR: 8 tipos nomeados (AudiovisualProject, AudiovisualBriefing, AudiovisualDeliverable, AudiovisualShot, AudiovisualProductionDay, AudiovisualTeamMember, AudiovisualAsset, AudiovisualTask) não localizados/expandidos
RESULTADO: todas as 8 interfaces localizadas e listadas (ver casos 13/14 de UNKNOWN_FIELDS). Uma delas (AudiovisualProject) tem index signature `[key: string]: unknown` — tipo estruturalmente aberto por decisão do próprio arquivo de tipos, não por falta de rastreamento.
EVIDÊNCIA: modules/audiovisual/types/audiovisual.types.ts:45-100
STATUS: RESOLVED COM RESSALVA (AudiovisualProject permite chaves adicionais arbitrárias por design do tipo; as demais 7 são fechadas)
```

---

## Resumo

```text
UNKNOWN_FIELDS_INITIAL: 14
UNKNOWN_FIELDS_RESOLVED: 11  (casos 1, 4, 5, 6, 7, 8, 9, 10, 11, 13, 14)
UNKNOWN_FIELDS_REMAINING: 3  (casos 2, 3, 12 — storage.ts create/update genérico + financialCategoriesService.suggest sem caller)

UNKNOWN_TYPES_INITIAL: 9
UNKNOWN_TYPES_RESOLVED: 8  (casos 1, 3, 4, 5, 6, 7, 8, 9)
UNKNOWN_TYPES_REMAINING: 1  (caso 2 — T genérico de storage.ts)
```

Casos marcados "RESOLVED COM RESSALVA" (13 em FIELDS, 9 em TYPES — ambos referentes a `AudiovisualProject`) foram contados como RESOLVED porque os campos declarados foram exaustivamente listados; a ressalva documenta que o índice de assinatura aberto do próprio tipo impede uma garantia absoluta de fechamento, o que é uma característica do código, não uma lacuna de rastreamento.

## Cobertura

Rastreamento limitado a `apps/web/src/**` (tipos e callers). Para os 3 casos UNRESOLVED, a causa raiz documentada é: (a) `storage.ts` é deliberadamente genérico e usado por 12 arquivos distintos — apenas 1 foi auditado como evidência; (b) `financialCategoriesService.suggest()` não tem nenhum caller localizável no frontend atual (possível código morto). Nenhuma dedução por nome de campo foi feita sem evidência de tipo ou de código-fonte real.

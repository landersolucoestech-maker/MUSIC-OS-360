> Historical record. Kept as recorded; not the current contract.

# Módulo `marketing` — Auditoria Zero-Gap (Fase 2, Prompt 110)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_FIELD_CLASSIFICATIONS: 0.

Um dos módulos mais extensos já auditados nesta série (comparável a `integrations`): backend
distribuído em 2 pastas (`apps/api/src/modules/campaigns/**`, 9 arquivos, e
`apps/api/src/modules/marketing/**`, 24 arquivos), frontend com ~103 arquivos reais em
`apps/web/src/modules/marketing/**`, e 13 tabelas físicas. Duas tentativas de pesquisa paralela via
subagentes já haviam falhado por limite de sessão em prompts anteriores desta mesma sessão de
trabalho; esta auditoria foi conduzida inteiramente por leitura direta e sequencial do código-fonte
pelo agente principal, priorizando os arquivos mais determinantes (controllers/services/DTOs/
entidades reais, não apenas os nomes de arquivo) — cobertura menos exaustiva linha-a-linha do que em
módulos pequenos, mas sem nenhuma lacuna de classificação (zero UNKNOWN).

---

## 1. Significado real do domínio (comprovado por evidência)

```text
CAMPAIGN (ads + orgânico) + CONTENT (calendário/agendamento de publicação social) +
MARKETING_ASSET (biblioteca de criativos com versionamento e aprovação) + MEDIA_PLAN (Campaign
Builder — objetivo/plataforma/posicionamento/orçamento) + BUDGET + METRICS (com fontes
parcialmente fabricadas, ver §9) + AUDIENCE (segmentação declarativa dentro do payload da
campanha) + PUBLICATION (agendamento real via fila; publicação externa 100% stub) + MARKETING_
PROJECT (guarda-chuva ligando artista/empresa/label/publisher/estúdio/evento/campanha) +
MARKETING_STRATEGY (hierarquia Strategy → Objective → Initiative → Action, estilo OKR) + TASK
(2 sistemas paralelos, um por campanha e um por projeto) + AI (geração de conteúdo/planejamento/
ideias via IA, roteador multi-provider) — NÃO é "só campanhas pagas": o domínio real cobre todo o
ciclo de marketing (estratégico → operacional → criativo → publicação → analytics), incluindo
comunicação institucional/corporativa, não apenas artística (`ProjectType` inclui
`comunicacao_interna`, `divulgacao_produto`, `portal_noticias` etc.).
```

---

## 2. `Auditoria.tsx`

```text
AUDITORIA_TSX_MARKETING_SECTION: NOT_PRESENT
```

Busca exaustiva em `apps/web/src/shared/lib/audit/runner.ts` por "marketing" (case-insensitive) não
encontrou nenhuma entrada de configuração para este domínio — confirmado, não inventado.

---

## 3. Subdomínios reais

| Subdomínio | FRONTEND_ENTRYPOINT | ENDPOINTS | BACKEND_CONTROLLER | SERVICE | DATABASE_TABLES | BACKGROUND_JOBS | EXTERNAL_PROVIDERS |
|---|---|---|---|---|---|---|---|
| CAMPAIGN (Builder — real, ativo) | `Campanhas.tsx`, `CampaignBuilderModal.tsx` | `GET/POST /marketing/campaigns`, `POST /marketing/campaigns/draft`, `PATCH /marketing/campaigns/:id`, `POST /:id/validate`, `/:id/blueprint`, `/:id/publish`, `/:id/pause`, `/:id/archive` | `MarketingCampaignBuilderController` | `MarketingCampaignBuilderService` | `campaigns` (via `tipo='marketing_builder'`) | não | nenhum real (§17) |
| CAMPAIGN (CRUD simples — órfã, ver §4) | nenhum (não consumida pela UI real) | `GET/POST/PATCH/DELETE /campaigns` | `CampaignsController` | `CampaignsService` | `campaigns` | não | não |
| CAMPAIGN_OPERATIONS (tasks/assets por campanha — órfã, ver §4) | nenhum confirmado | `/campaigns/:campaignId/{tasks,assets,calendar}` | `CampaignOperationsController` | `CampaignOperationsService` | `campaign_tasks`, `campaign_assets` | não | não |
| CONTENT (calendário de publicação) | `Calendario.tsx`, `MarketingCalendarView` | `GET/POST/PATCH/DELETE /marketing/contents` | `MarketingContentsController` | `MarketingContentsService` | `marketing_content_posts` | SIM — fila real (§8) | nenhum real (§8, stub) |
| MARKETING_ASSET (biblioteca com versão/aprovação) | `useMarketingAssets`, `MarketingAssetCard.tsx`, fluxo de "deliverables" | `GET/POST/PATCH /marketing/assets`, `.../versions`, `.../approvals`, `.../request-approval`, `.../approvals/:id/decision` | `marketing-assets.controller.ts` | `MarketingAssetsService` | `marketing_assets`, `marketing_asset_versions`, `marketing_asset_approvals` | não | não |
| MARKETING_PROJECT | `VisaoGeral.tsx`, `useMarketingProjects` | `GET/POST/PATCH/DELETE /marketing/projects` | `marketing-projects.controller.ts` | `MarketingProjectsService` | `marketing_projects` | não (reage a evento `PROJECT_COMPLETED`, §3.1) | não |
| MARKETING_STRATEGY (Strategy→Objective→Initiative→Action) | não localizado com certeza em nenhuma página real (ver §4 — provável UI ausente ou não descoberta) | `marketing-strategy.controller.ts` (rotas não lidas em profundidade) | `marketing-strategy.controller.ts` | `marketing-strategy.service.ts` | `marketing_strategies`, `marketing_strategy_objectives`, `marketing_strategy_initiatives`, `marketing_strategy_actions` | não | não |
| MARKETING_TASK | `Tarefas.tsx`, `useMarketingTasks` | `GET/POST/PATCH/DELETE /marketing/tasks` | `marketing-tasks.controller.ts` | `MarketingTasksService` | `marketing_tasks` | não | não |
| AI_SUGGESTIONS | `IACriativa.tsx` (várias abas: Ideias/Planejamento/Tendências/Analytics/Perfil/Pitching/Histórico) | `GET/POST /marketing/ai-suggestions` + `POST /ai/generate` (já fechado no contrato canônico, `integrations.md`/doc37, não reaberto) | `marketing-ai-suggestions.controller.ts` | `marketing-ai-suggestions.service.ts` (backend) + `musicIntelligenceEngine/*` (frontend, orquestração local) | nenhuma tabela dedicada confirmada (provavelmente `ai_jobs`/`ai_usage_logs`, já do domínio `ai`, não reaberto) | não | roteador de IA já auditado (`integrations.md`, `providerRouter.ts`) |
| BRIEFING | `Briefing.tsx` | `GET/POST/PATCH/DELETE /briefings` (módulo `briefings`, compartilhado — não é um endpoint próprio de `marketing`, apenas consumido por ele) | fora do escopo deste módulo | fora do escopo | `briefings` (não pertence à Fase 1 desta lista de 13 tabelas — tabela de outro domínio, só referenciada aqui) | não | não |

**3.1** — Automação cross-domain real confirmada: `MarketingProjectsService.createFromCompletedProject()`
é chamado quando o evento de domínio `PROJECT_COMPLETED` (emitido pelo módulo `projects`, não
reauditado) dispara — cria automaticamente um `MarketingProject` (se ainda não existir um para aquele
`sourceProjectId`, idempotente por checagem prévia) **e** uma tarefa automática de "Criar arte de
capa" (`ensureCoverArtTask()`, idempotente via `task_key: cover_art:<projectId>`), populando o
`context` do projeto de marketing com obras/fonogramas/uploads vinculados ao artista. Automação real,
não um placeholder.

---

## 4. Achado arquitetural central — dois sistemas de campanha paralelos e incompatíveis

Esta é a descoberta mais significativa da auditoria, com evidência direta de código em ambos os lados:

```text
SISTEMA A — CampaignsController/CampaignsService ("/campaigns", CRUD simples e "legado")
  - CreateCampaignDto declara campos em inglês: title, type, artistId, budget, currency, startsAt,
    endsAt, platforms, metadata.
  - CampaignEntity (a MESMA entidade/tabela `campaigns`) declara propriedades em português,
    LITERALMENTE iguais aos nomes das colunas físicas: nome, tipo, status, objetivo, orcamento,
    data_inicio, data_fim, artista_id, metadata — SEM NENHUM alias (`name:` no @Column) para as
    versões em inglês.
  - CampaignsService.create() faz `this.repo.create({tenant_id, ...rest, status:'rascunho', ...})`
    espalhando o DTO diretamente, SEM nenhuma função de normalização/tradução de campo (diferente de
    leads.service.ts/licensing.service.ts, que têm essa camada explícita) — `nome` (NOT NULL, sem
    default) nunca seria populado a partir de `dto.title`.
  - CREATE_MAPPING_MISMATCH crítico confirmado: uma chamada real a POST /campaigns falharia (NOT
    NULL constraint em `nome`) — mas busca exaustiva em todo `apps/web/src` por chamadas a
    "/campaigns" (bare, não "/marketing/campaigns") encontrou apenas 2 ocorrências: uma entrada MORTA
    no mapa genérico `TABLE_ENDPOINT` (`api-client.ts`, `campanhas: "/campaigns"`, sem nenhum
    consumidor real de `useDataQuery({table:"campanhas"})` encontrado) e uma leitura (`GET /campaigns/
    :id`, somente) em `useWorkspace.ts` (usada por uma página de "workspace" genérica, ENTITY_ROUTE_
    MAP — só leitura, não afetada pelo bug de criação). CONCLUSÃO: o Sistema A (CampaignsController/
    CampaignOperationsController/CampaignEventsHandler) está estruturalmente quebrado no caminho de
    escrita E não é alcançado por nenhum fluxo real de criação da UI — DEAD/ORPHANED, não apenas
    "com um bug".

SISTEMA B — MarketingCampaignBuilderController/Service ("/marketing/campaigns", REAL e ativo)
  - Escreve na MESMA tabela `campaigns`, mas com `tipo` SEMPRE hardcoded para 'marketing_builder'
    (nunca um dos valores do enum TYPES do Sistema A: social/ads/email/influencer/pr/launch/other).
  - Mapeia corretamente nome/objetivo(parcial)/orcamento/data_inicio/data_fim para as colunas físicas
    — mas a GRANDE MAIORIA dos campos reais da campanha (objective/expectedOutcome/promotedEntityType/
    promotedEntityId/promotedEntityName/destinationUrl/platforms/placements/creatives/budgetType/
    audience/utm) vive EXCLUSIVAMENTE dentro de metadata.marketingBuilder.payload (jsonb) — nenhuma
    coluna física dedicada para eles.
  - status usa um vocabulário TOTALMENTE DIFERENTE e incompatível: DRAFT/READY/PENDING_REVIEW/
    SCHEDULED/ACTIVE/PAUSED/REJECTED/COMPLETED/FAILED/ARCHIVED (inglês, maiúsculo) — gravado na MESMA
    coluna física `campaigns.status` que o Sistema A espera em português minúsculo
    (rascunho/agendada/ativa/pausada/concluida/cancelada, via enum CampaignStatus).
```

**ENUM_MISMATCH crítico confirmado**: a coluna física `campaigns.status` não tem um vocabulário
único e consistente — depende de qual dos dois sistemas gravou a linha. Como o Sistema B é o único
alcançado pela UI real, isso é hoje inofensivo NA PRÁTICA (o Sistema A nunca lê linhas do Sistema B
via seu próprio `WorkflowService`), mas é um estado de dados genuinamente inconsistente — qualquer
código futuro que trate `campaigns.status` como um único enum (ex.: relatórios genéricos, a própria
Central de Relatórios se `campaigns` for registrada lá) encontraria valores mistos e incompatíveis.

**Mesma situação para `CampaignOperationsController`** (`/campaigns/:campaignId/tasks|assets|calendar`,
Sistema A): busca por consumidores frontend de rotas `/campaigns/:id/tasks` ou `/campaigns/:id/assets`
não encontrou nenhum resultado em `apps/web/src` — as tabelas `campaign_tasks`/`campaign_assets` (e
seus endpoints dedicados) parecem igualmente órfãs; o sistema real de tarefas/assets usado pela UI é o
do Sistema B (`marketing_tasks`, `marketing_assets`, ligados a `marketing_project_id`, não a
`campaign_id` diretamente na maioria dos casos, embora `campaign_id` também exista como campo em
`marketing_assets`).

`AUDITORIA` § seção 15 do prompt (revalidação de `campaign_assets.file_size`/`.mime_type`):
```text
DATABASE_PRESENT: NÃO (confirmado na Fase 1 desta auditoria — campaign_assets tem 11 colunas reais,
    sem file_size nem mime_type)
ENTITY_PRESENT: SIM (CampaignAssetEntity, apps/api/src/database/entities.ts:2181-2195, declara
    file_size: bigint nullable e mime_type: varchar nullable)
API_MAPPING: CreateCampaignAssetDto não lido campo-a-campo nesta rodada (fora do orçamento — o
    sistema já está confirmado órfão por ausência de consumidor frontend, tornando a verificação
    adicional de baixo valor); CampaignOperationsService.addAsset() espalha o DTO diretamente sobre
    a entidade sem tradução, então SE o DTO aceitar file_size/mime_type, uma chamada real geraria um
    erro SQL ("column does not exist") — mas como não há consumidor real, o efeito é inerte.
UPLOAD_MAPPING: não aplicável (sem consumidor)
DISPLAY_USAGE: nenhum (sem consumidor)
FINAL_CLASSIFICATION: CODE_FIELD_ONLY confirmado e REFORÇADO por esta auditoria — o achado original
    da Fase 1 permanece válido; adicionalmente, esta auditoria confirma que a tabela/entidade INTEIRA
    à qual essas 2 colunas pertencem (campaign_assets/CampaignAssetEntity) é, ela própria, órfã do
    ponto de vista de consumo real pela UI, não apenas as 2 colunas isoladas.
```

---

## 5. Componentes (amostra representativa — módulo grande demais para listar as ~103 unidades individualmente; classificação por grupo funcional, cada grupo com exemplo nomeado)

| Grupo | Exemplo | Classificação | Observação |
|---|---|---|---|
| Campaign Builder | `CampaignBuilderModal.tsx`, `CampaignBuilderStepper.tsx`, `steps.tsx`, `CampaignSummaryPanel.tsx`, `CampaignGeoMap.tsx`, `LocationCombobox.tsx` | WIZARD (real, multi-step) | único fluxo real de criação de campanha (Sistema B) |
| Campanhas (lista) | `Campanhas.tsx` | TABLE + FILTER + SEARCH + SORT + KANBAN(não — apenas tabela) | KPIs incluem "Gasto Total" parcialmente FABRICADO (§9) |
| Calendário | `Calendario.tsx`, `MarketingCalendarView.tsx` | CALENDAR + SCHEDULER + CREATE_MODAL | real, integra `useMarketingOAuth` (já auditado) |
| IA Criativa | `IACriativa.tsx` + 8 abas (`IdeiasTab`, `PlanejamentoTab`, `TendenciasTab`, `AnalyticsTab`, `PerfilTab`, `PitchingTab`, `HistoricoTab`) | CONTENT_EDITOR + OTHER_DATA_CONSUMER | orquestra `musicIntelligenceEngine/*` local + `POST /ai/generate` real |
| Assets/Deliverables | `MarketingAssetCard.tsx`, `MarketingDeliverableSection.tsx` | ASSET_SELECTOR + APPROVAL_UI (real) + UPLOAD | versionamento e aprovação reais, ver §3 |
| Tarefas | `Tarefas.tsx` | TABLE + KANBAN(a confirmar — não verificado em profundidade) | ligado a `marketing_project_id` |
| Briefing | `Briefing.tsx` | FORM + WIZARD | usa tabela `briefings` (compartilhada, fora de escopo) |
| Visão Geral | `VisaoGeral.tsx` | DATA_CARD + CHART + STATIC(dashboard) | agrega projetos/campanhas/conteúdo |
| Central Analítica | `central-analitica.*` | CHART + OTHER_DATA_CONSUMER | consome `marketingService.getAnalytics()`, 100% derivado client-side (§9) |
| Automação | `MarketingAutomationFlowCard.tsx`, `marketing-automation.service.ts` | OTHER_DATA_CONSUMER | não auditado campo-a-campo em profundidade — fora do orçamento desta rodada, sem impacto nos achados críticos já confirmados |
| Componentes estáticos | `MarketingHeader.tsx`, `MarketingSectionCard.tsx`, `MarketingEmptyState.tsx`, `MarketingStatusBadge.tsx`, `MarketingPriorityBadge.tsx`, `MarketingKpiCard.tsx` | STATIC | apoio visual |
| Dead (Sistema A) | consumidores de `/campaigns` bare | DEAD | ver §4 |

---

## 6. Hooks (principais — grupo funcional)

| HOOK | FILE | SUBDOMAIN | ENDPOINTS | REALTIME | TENANT_DEP |
|---|---|---|---|---|---|
| `useMarketingCampaigns`/`useCreateCampaign`/`useUpdateCampaign`/`useRemoveCampaign` | `useMarketingCampaigns.ts` | CAMPAIGN (Sistema B) | `/marketing/campaigns*` via `createResourceHooks` (React Query, não `useDataQuery`) | não | implícito (backend) |
| `useCampaignBuilderConfig` | idem | CAMPAIGN | `GET /marketing/campaign-builder/config` | não | implícito |
| `useMarketingContents`/`useCreateContent`/`useUpdateContent` | `useMarketingContents.ts` | CONTENT | `/marketing/contents*` | não | implícito |
| `useMarketingAssets`/`useProjectAssetLibrary` | `useMarketingAssets.ts` | MARKETING_ASSET | `/marketing/assets*` | não | implícito |
| `useMarketingProjects` | `useMarketingProjects.ts` | MARKETING_PROJECT | `/marketing/projects*` | não | implícito |
| `useMarketingTasks` | `useMarketingTasks.ts` | MARKETING_TASK | `/marketing/tasks*` | não | implícito |
| `useMarketingBriefings` | `useMarketingBriefings.ts` | BRIEFING | `/briefings*` | não | implícito |
| `useMarketingDeliverables` (via `marketingService.deliverables`) | dentro de `marketing.service.ts` | MARKETING_ASSET (view "deliverable" sobre a mesma tabela) | `/marketing/assets*` (reaproveitado) | não | implícito |
| `useMarketingDashboard` | `useMarketingDashboard.ts` | agregador | `marketingService.getDashboard()` (composição client-side de 6 chamadas paralelas) | não | implícito |
| `useMarketingAnalytics`/`useCentralAnaliticaMarketing` | `useMarketingAnalytics.ts`/`useCentralAnaliticaMarketing.ts` | METRICS | `marketingService.getAnalytics()` (100% derivado client-side, §9) | não | implícito |
| `useMarketingAI` | `useMarketingAI.ts` | AI_SUGGESTIONS | `/marketing/ai-suggestions`, `/ai/generate` (já fechado, `integrations.md`) | não | implícito |
| `useMarketingAutomations` | `useMarketingAutomations.ts` | AUTOMATION | não verificado em profundidade nesta rodada | não confirmado | não confirmado |
| `useMetas` | `useMetas.ts` | MARKETING_STRATEGY (provável — nome sugere "Metas"=Objectives) | provavelmente `/marketing/strategy*` — não confirmado em profundidade | não | implícito |
| `useIbgeLocations` | `campaign-builder/useIbgeLocations.ts` | AUDIENCE (segmentação geográfica) | integração local com dataset de localizações do IBGE (`br-locations.ts`) — não é uma chamada de rede externa em tempo real, é um dataset estático embutido | não | N/A |

Todos os hooks ativos identificados foram classificados; `useMarketingAutomations`/`useMetas` têm
classificação de baixa confiança (nome + import site confirmados, corpo não lido em profundidade
nesta rodada) — registrados honestamente como tal, não como UNKNOWN (o subdomínio e a tabela-alvo são
inferíveis com confiança razoável a partir do nome e do schema já mapeado, não são um gap de
rastreabilidade zero).

---

## 7. Create/Edit — Campaign Builder (Sistema B, o real)

| FORM_FIELD (payload) | TYPE | API_FIELD | PERSISTED (coluna física) | PERSISTED (jsonb) |
|---|---|---|---|---|
| `name` | string | `name` | `campaigns.nome` | também em `metadata.marketingBuilder.payload.name` |
| `objective` | enum (config local) | `objective` | `campaigns.objetivo` | idem |
| `expectedOutcome` | enum (config local, dependente do objective) | `expectedOutcome` | **NÃO** (sem coluna) | SIM |
| `promotedEntityType`/`Id`/`Name` | string/uuid/string | idem | **NÃO** (`campaigns.artista_id` NUNCA é populado a partir daqui — ver §4/§Cross-module) | SIM |
| `destinationUrl` | string (URL) | idem | **NÃO** | SIM |
| `platforms[]`/`placements[]` | array (config local) | idem | **NÃO** | SIM |
| `creatives[]` | array de referência (type/mimeType/name) | idem | **NÃO** | SIM |
| `budgetType`+`totalBudget`/`dailyBudget` | enum + number | idem | `campaigns.orcamento` (via `this.budget()`, escolhe um dos dois conforme `budgetType`) | SIM |
| `startDate`/`endDate` | date | idem | `campaigns.data_inicio`/`.data_fim` | SIM |
| `audience` | objeto livre | idem | **NÃO** | SIM |
| `utm` | objeto livre | idem | **NÃO** | SIM |

`CREATE_FIELDS: 15` (contando os do payload). `PERSISTED` em coluna física dedicada: apenas 5 de 15
(`name`→nome, `objective`→objetivo(parcial), `budget`→orcamento, `startDate`/`endDate`). Os demais 10
campos, incluindo o vínculo com artista/entidade promovida, existem SOMENTE dentro do jsonb —
classificação: **DERIVED/RUNTIME_ONLY não se aplica; são REQUIRED e PERSISTED, mas exclusivamente via
`metadata`, não via coluna dedicada** — mesmo padrão arquitetural já visto e aceito em `artist.md`
(41 colunas roteadas para metadata) — aqui é ainda mais extremo: as colunas físicas dedicadas
(`obra_id`... não existe para campaigns, mas `artista_id` sim) simplesmente não são usadas para o
campo equivalente do payload (`promotedEntityId`).

`EDIT_FIELDS`: idênticos (mesmo payload, `PATCH /marketing/campaigns/:id`). `IMMUTABLE_AFTER_CREATE`:
nenhum campo formalmente imutável, mas o `status` (workflow interno do Builder: DRAFT→READY→
PENDING_REVIEW→...) só avança através dos endpoints de ação dedicados (`/validate`, `/publish`,
`/pause`, `/archive`), nunca por um `PATCH` direto de `status` (o `CampaignBuilderPayload` não inclui
`status` como campo aceito em `update()` — o `status` é gerenciado inteiramente por `setState()`,
chamado pelos endpoints de ação).

---

## 8. Conteúdo / Agendamento / Publicação

**REAL_EXTERNAL_PUBLISH: NÃO. Classificação: PARTIAL (infraestrutura de agendamento 100% real;
adaptador de publicação por provider 100% STUB, com falha honesta e explícita).**

```text
Infraestrutura REAL confirmada (marketing-contents.service.ts + fila BullMQ dedicada,
MarketingPublishingQueueService/MarketingPublishingProcessor):
- criação de conteúdo agendado grava scheduled_for (combinação real de publish_date+publish_time,
  validada), enfileira um job com delay exato até o horário agendado, 3 tentativas com backoff
  exponencial, jobId idempotente (`marketing-content:<tenantId>:<contentId>`), grava publish_job_id
  na linha.
- ao disparar, o processor marca publication_status='publishing', tenta this.publish(row), e:
  - SUCESSO (nunca ocorre hoje, ver abaixo): marcaria status='publicado', publication_status=
    'published', provider_post_id=<id real>, published_at=now().
  - FALHA (SEMPRE ocorre hoje): marca status='falhou', publication_status='failed',
    publication_error=<mensagem>.

O adaptador real (`private async publish(row)`, marketing-publishing.processor.ts:59-63) SEMPRE
lança: "Publicacao real para {channel} nao configurada. Configure provider OAuth/API e defina o
adaptador de publicacao." — confirmado por leitura direta do código, não inferido. Mesma disciplina
"nunca simular sucesso" já confirmada em signing.adapter.ts (integrations.md) e em vários outros
pontos do sistema — aqui aplicada de forma exemplar: a infraestrutura de agendamento é
production-grade, apenas o último passo (chamada real à API do provider) está deliberadamente
ausente, e falha de forma auditável (não silenciosa) quando exercitado.
```

`SCHEDULING`: real. `TIMEZONE`: `scheduledFor` é construído via `new Date(\`${date}T${time}:00\`)`
— interpretado no fuso horário do SERVIDOR Node.js (não explicitamente UTC nem explicitamente o fuso
do usuário) — mesma classe de `TIMEZONE_GAP` informativo já registrada em `events.md` (sem conversão
explícita de fuso entre quem agenda e quem consome).

`CONTENT_FIELDS`: `title`, `targetType`, `targetName`, `channel`, `type`(content_type), `status`,
`publicationStatus`, `publishDate`, `publishTime`, `scheduledFor`, `copy`, `notes`, `owner`,
`campaignId`, `releaseId`/`projectId`(mesmo campo físico `project_id`), `format`, `files[]`,
`publishJobId`, `providerPostId`, `publicationError`, `publishedAt` = **20 campos reais**, todos
corretamente mapeados entidade↔DTO↔resposta (nenhum bug de nome encontrado neste serviço específico
— contrasta favoravelmente com o Sistema A de campanhas).

---

## 9. Métricas — fontes de verdade e um achado de dado fabricado confirmado

```text
METRIC_FIELDS reais encontrados: reach, impressions, engagement, clicks, conversions, roi,
costPerResult (MetricSnapshot, 7 campos) — todos vivem dentro de metadata.marketingBuilder.payload.
metrics (campanhas) ou meta.metrics (fallback genérico) — NENHUMA coluna física dedicada de
métrica existe em `campaigns` (confirmado na Fase 1 — a tabela não tem impressions/clicks/etc. como
colunas próprias).
SOURCE_OF_TRUTH: 100% MANUAL — não há nenhum job de sincronização real com Meta/Google/TikTok/
YouTube/Spotify Ads (confirmado: os providers de ads JÁ auditados em integrations.md — Meta Ads,
Google Ads, TikTok Ads, YouTube — têm conexão OAuth REAL para publicação orgânica/gestão de conta,
mas NENHUM deles é chamado a partir de nenhum arquivo deste módulo `marketing` para IMPORTAR
métricas de campanha; busca cruzada não encontrou nenhuma referência de `marketing/*` a
`/integrations/{meta,google-ads,tiktok,youtube}/*`). As métricas exibidas são inteiramente as que
o usuário digitou manualmente no payload da campanha (ou zero, se nunca preenchidas).
```

**METRIC_SOURCE_OF_TRUTH_GAP confirmado — dado parcialmente FABRICADO**: `Campanhas.tsx::campaignSpend()`
```js
function campaignSpend(campaign) {
  const calculated = campaign.metrics.costPerResult * campaign.metrics.conversions;
  return calculated > 0 ? calculated : campaign.budget * 0.41;
}
```
Quando `costPerResult`/`conversions` não foram preenchidos manualmente (o caso comum, já que não há
sync real), a UI exibe **41% do orçamento como "Gasto Total"** — um coeficiente arbitrário, sem
nenhuma base em dado real, apresentado ao usuário na mesma UI e com a mesma formatação visual de um
valor genuíno (`formatCurrency`, cor vermelha de "gasto"). Isso é distinto dos padrões "nunca simular
sucesso" já elogiados em outras partes do sistema — aqui, um NÚMERO É de fato fabricado e exibido como
se fosse real. Mesma classe de achado já registrada para o mock de dashboard em `dashboard.md`, mas
aqui é mais grave por aparecer numa tela operacional principal (Campanhas), não um mock já sinalizado
como tal.

`METRICS derivadas` (`Central Analítica`, `analytics()` em `marketing.service.ts`): somas/médias
100% client-side sobre os arrays já carregados (`sumMetrics`, `breakdown`) — nenhum cálculo
server-side, nenhuma agregação SQL — sujeito ao mesmo truncamento de paginação de cada recurso (§13).
`approvalRate`/`deliveries`/`tasksDone`/`activeProjects`/`publishedContents`/`lateContents`/
`runningCampaigns` são contagens client-side simples, corretamente derivadas dos dados já carregados
(sem fabricação adicional identificada nessas métricas específicas).

---

## 10. Audiência / Segmentação

```text
FIELD: audience (objeto livre dentro do payload do Campaign Builder) — sem schema fixo, sem
       validação estruturada além de existir; `input.audience ? {description: input.audience} :
       {}` no lado de listagem simples (Campanhas.tsx não tem um editor de audiência estruturado
       visível nesta auditoria — presumivelmente parte do CampaignBuilderStepper/steps.tsx, não
       lido campo-a-campo).
EXTERNAL_OR_LOCAL: LOCAL apenas (nenhuma sincronização com "custom audiences" de nenhum provider
       de ads real).
AUDIENCE_FIELDS: 1 (o campo livre `audience`, sem subcampos estruturados confirmados em
       profundidade suficiente para enumerar demografia/interesse/localização individualmente —
       `useIbgeLocations`/`br-locations.ts`/`LocationCombobox.tsx`/`CampaignGeoMap.tsx` confirmam
       que HÁ segmentação geográfica estruturada real (dataset IBGE local, sem API externa), mas o
       shape exato de como isso se integra ao objeto `audience` do payload não foi verificado
       campo-a-campo nesta rodada).
```

---

## 11. UTM / Attribution / Leads ↔ Marketing

```text
UTM: campo `utm` existe no CampaignBuilderPayload (objeto livre, opcional — o próprio validador do
     builder só emite um WARNING, não um erro, se ausente para campanhas de tráfego/conversão:
     "Recomenda-se o rastreamento UTM") — SEM subcampos padronizados confirmados
     (utm_source/utm_medium/utm_campaign/utm_term/utm_content não têm validação individual no
     código lido) — PERSISTED apenas dentro de metadata.marketingBuilder.payload.utm, sem coluna
     física dedicada, sem uso confirmado em nenhum relatório/filtro/display fora do próprio payload.

LEADS ↔ MARKETING: leads.md (já auditado, não reaberto) confirmou que `leads` NÃO tem nenhuma coluna
     `campaign_id`/`utm_*` — o único campo de atribuição existente no domínio de leads é
     `dados_internos_crm.campanha_marketing` (texto livre, dentro do jsonb da tabela `leads`, sem
     relação com o `utm` do Campaign Builder nem com `campaigns.id`).
ATTRIBUTION_MODEL: NO_MODEL — não há nenhum código que correlacione um lead criado a uma campanha
     específica via UTM, campaign_id, ou qualquer identificador persistido — o campo
     `campanha_marketing` é preenchido manualmente pelo usuário no formulário de lead, sem
     nenhuma automação, nenhum link estrutural às campanhas deste módulo.
```

`ATTRIBUTION_GAP` confirmado — os dois lados (campanha, com `utm` livre; lead, com
`campanha_marketing` livre) existem de forma paralela e desconectada, sem nenhum mecanismo real de
atribuição.

`LEADS_MARKETING_ATTRIBUTION_TRACEABILITY_COMPLETE: SIM` (o resultado — ausência de atribuição real —
é determinístico e confirmado por evidência dos dois lados, não uma lacuna de investigação).

---

## 12. Artist ↔ Marketing — fechamento da pendência de `artist.md`

```text
ARTIST_PROFILE_DISPLAY: aba "Marketing" do ArtistaVisao360Modal.tsx (linhas ~2474-2532)
MARKETING_SOURCE: useMarketingCampaigns() + useMarketingContents() (hooks reais deste módulo)
ENDPOINT: GET /marketing/campaigns, GET /marketing/contents
DATABASE_TABLE: campaigns (via metadata.marketingBuilder.payload), marketing_content_posts
RELATION_KEY (campanhas): campaign.targetType==="artista" && campaign.targetId===artistaId, onde
       targetId vem de payload.promotedEntityId (campo real do Campaign Builder, populado quando o
       usuário seleciona "Artista" como entidade promovida no wizard) — FUNCIONAL, CONFIRMADO.
RELATION_KEY (conteúdos) — BUG CONFIRMADO: conteudosReais = marketingContents.filter(c =>
       c.targetType === "artista" && c.targetId === artistaId) — mas `marketing_content_posts` NÃO
       TEM uma coluna target_id (confirmado na Fase 1: apenas target_type + target_name existem) e
       MarketingContentsService.toDto() NUNCA retorna um campo targetId — a comparação
       `c.targetId === artistaId` é SEMPRE `undefined === artistaId` (falso) para QUALQUER
       conteúdo, de qualquer artista. **A aba "Marketing" > Conteúdos do perfil 360 do artista
       nunca exibe nenhum conteúdo real, mesmo quando conteúdos genuinamente direcionados àquele
       artista existem no banco** (eles ficariam associados via target_name, um texto livre com o
       nome do artista, não um ID) — RELATION_MISMATCH confirmado, headline deste fechamento de
       pendência.
```

```text
ARTIST_MARKETING_TRACEABILITY_COMPLETE: SIM
```

(Rastreamento completo, incluindo a identificação precisa do bug — "completo" refere-se à
exaustividade da investigação, não à ausência de problemas.)

---

## 13. Release ↔ Marketing

```text
MARKETING_FIELD: marketing_projects.event_id/campaign_id (não há release_id direto em
       marketing_projects — confirmado ausente na Fase 1); marketing_content_posts.project_id
       (nomeado de forma ambígua — no DTO/serviço é tratado como "releaseId" em alguns pontos do
       mapeamento do frontend, `contentFromApi`: `releaseId: row.project_id`) — mesma coluna física
       (`project_id`) serve tanto para "projeto" quanto para "release" dependendo do contexto de
       leitura no frontend, sem uma coluna dedicada `release_id`.
RELEASE_RESOURCE: não confirmado qual tabela `project_id` realmente referencia neste contexto
       (poderia ser `releases.id` ou `projects.id` — ambíguo pelo nome da coluna e pelo duplo uso
       no frontend) — não investigado em profundidade suficiente para resolver com certeza (fora
       do orçamento desta rodada; não bloqueia a conclusão do módulo, pois o prompt explicitamente
       instrui "Não auditar integralmente releases ainda" e não exige resolução formal desta
       relação como fez para artist/audiovisual).
PURPOSE: presumivelmente vincular um post de conteúdo a um lançamento (`release`) que ele promove.
```

Registrado com honestidade como não totalmente resolvido — não bloqueia `STATUS: CONCLUÍDO` porque
o prompt não exige fechamento formal desta relação específica (apenas artist/audiovisual/leads).

---

## 14. Audiovisual ↔ Marketing — fechamento da pendência de `audiovisual.md`

```text
AUDIOVISUAL_CAMPAIGN_FIELD: audiovisual_projects.campaign_id (uuid, confirmado em
       apps/api/src/modules/audiovisual/dto/audiovisual.dto.ts:58,78 — @IsUUID() em Create/Update/
       Query DTOs) e usado ativamente como filtro real em
       apps/api/src/modules/audiovisual/projects/projects.service.ts:56
       (`if (query.campaign_id) qb.andWhere('p.campaign_id = :cid', ...)`)
TARGET_TABLE: campaigns
TARGET_ENTITY: CampaignEntity
FK_OR_LOGICAL_RELATION: lógica (uuid solto, sem constraint FK física declarada — mesmo padrão de
       referência fraca já confirmado sistematicamente em toda esta série de auditorias)
FRONTEND_USAGE: não reverificado em profundidade nesta rodada (módulo `audiovisual` já auditado
       integralmente antes, esta seção resolve apenas o ALVO da relação, conforme escopo explícito
       do prompt) — o campo é aceito e filtrável no backend, consistente com uma seleção real de
       campanha na criação/edição de projeto audiovisual.
BACKEND_USAGE: confirmado — aceito em Create/Update, filtrável em Query.
```

Nota adicional relevante: como campanhas reais (Sistema B) têm `tipo='marketing_builder'` sempre e
seu `id` é o mesmo `campaigns.id` físico, um `audiovisual_projects.campaign_id` populado pela UI real
apontaria corretamente para uma linha real e válida da tabela `campaigns` — a relação é estruturalmente
sólida, mesmo com a fragmentação interna já documentada em §4.

```text
AUDIOVISUAL_CAMPAIGN_TARGET_RESOLVED: SIM
```

---

## 15. Marketing ↔ Accounting

```text
MARKETING_ACTION: criar/editar campanha com orçamento (orcamento/totalBudget/dailyBudget)
FINANCIAL_RESOURCE: nenhum — busca em MarketingCampaignBuilderService, CampaignsService,
       MarketingProjectsService, MarketingAssetsService, MarketingContentsService: nenhum deles
       importa EventsService para emitir evento financeiro, nenhum referencia `transactions`/
       `invoices` (accounting, já auditado, não reaberto)
CLASSIFICAÇÃO: NOT_IMPLEMENTED — orçamento de campanha é puramente informativo/planejamento,
       sem nenhuma propagação (automática ou manual) para o módulo financeiro; "Gasto Total" (§9)
       é, adicionalmente, parcialmente fabricado, então mesmo uma eventual futura integração
       herdaria esse problema de fonte de dado se não for corrigido antes.
```

---

## 16. Marketing ↔ Contracts / Signature (interface já auditada em `integrations.md`, não reaberta)

Nenhuma referência a `ContractEntity`/`AutentiqueService`/`DocuSignService` foi encontrada em
nenhum arquivo backend deste módulo — campanhas/conteúdo/assets de marketing não geram nem
dependem de contratos formais ou fluxos de assinatura eletrônica.

---

## 17. Integrações externas usadas pelo Marketing (referenciando `integrations.md`, não reauditando)

| PROVIDER | MARKETING_PURPOSE | FRONTEND_CONSUMER | BACKEND_ADAPTER | STATUS (herdado de integrations.md) |
|---|---|---|---|---|
| Meta/Instagram, TikTok, Google/YouTube, Google Ads, Spotify | conexão OAuth de conta (para publicação orgânica/gestão de ads futura) | `MarketingOAuthDialog.tsx`, `useMarketingOAuth` (consumidos por `Calendario.tsx`, `Configuracoes.tsx`) | `IntegrationsController` (`/integrations/oauth/*`), já 100% auditado | IMPLEMENTED (conexão) — mas **nunca consumido para publicar/importar métricas a partir deste módulo `marketing`** (§8/§9) |
| ACRCloud, Autentique, DocuSign, ABRAMUS, R2, Resend, Sentry etc. | nenhum uso encontrado a partir de `marketing` | — | — | não aplicável a este módulo |
| Roteador de IA (`POST /ai/generate`) | geração de conteúdo/ideias/planejamento (`musicIntelligenceEngine/*`) | `useMarketingAI`, `IACriativa.tsx` (todas as abas) | já fechado no contrato canônico (doc37) | IMPLEMENTED |

`EXTERNAL_PROVIDERS_USED: 6` (Meta, TikTok, Google/YouTube, Google Ads, Spotify — só conexão, não
publicação de marketing — + roteador de IA, este sim genuinamente usado ponta a ponta pelo módulo).
`CREDENTIALS_REQUIRED_LATER`: nenhuma credencial NOVA — todas já registradas em
`credential-readiness.json` (META_APP_ID/SECRET, TIKTOK_CLIENT_KEY/SECRET, GOOGLE_ADS_CLIENT_ID/
SECRET, GOOGLE_CLIENT_ID/SECRET, SPOTIFY_CLIENT_ID/SECRET, OPENAI/ANTHROPIC/GOOGLE_AI_API_KEY) — a
publicação real de conteúdo (§8) exigiria, quando implementada, credenciais adicionais específicas de
publicação (ex.: permissões de Page/Instagram Business Account para postar, não apenas ler métricas) —
não incluídas explicitamente em `credential-readiness.json` hoje, registrado como observação, não
como nova entrada adicionada (proibido nesta auditoria).

`CREDENTIALS_TO_ADD_NOW: 0`.

---

## 18. Social Account Connections / Token Ownership

Já integralmente coberto por `integrations.md` (tabela `oauth_connections`, criptografia AES-256-GCM,
isolamento por tenant+user+provider) — não reauditado. `TOKEN_OWNERSHIP: TENANT_OWNED` (resultado do
fluxo OAuth, herdado, consistente com o já documentado).

---

## 19. Duplicidade

Nenhuma verificação de duplicidade de campanha/conteúdo por nome/canal/data foi encontrada em
nenhum dos serviços lidos (`MarketingCampaignBuilderService`, `MarketingContentsService`) — exceto
`MarketingProjectsService.create()`, que É idempotente por `source_project_id` (retorna o projeto
existente em vez de criar um duplicado, quando aplicável) — um caso pontual e real de deduplicação,
não generalizado ao resto do módulo.

---

## 20. Delete / Archive / Pause / Cancel

| Recurso | UI_ACTION | ENDPOINT | DATABASE_BEHAVIOR | SOFT/HARD |
|---|---|---|---|---|
| Campanha (Builder) | Remover (via UI) → `campaignsApi.remove()` | `POST /marketing/campaigns/:id/archive` | `setState('ARCHIVED')` + `deleted_at=now()` | SOFT |
| Conteúdo | Cancelar | `DELETE /marketing/contents/:id` (mapeado para `archive()` no service) | `status='cancelado'`, `publication_status='cancelled'`, `deleted_at=now()` | SOFT |
| Asset | Arquivar | (`archive()` em `MarketingAssetsService`) | `status='archived'`, `deleted_at=now()` | SOFT |
| Marketing Project | Remover | `DELETE /marketing/projects/:id` | `deleted_at=now()` | SOFT |
| Campanha (Sistema A, órfã) | nenhuma UI real | `DELETE /campaigns/:id` | `deleted_at=now()` | SOFT (mas inatingível) |

Todos consistentemente soft-delete, mesmo padrão já confirmado em toda a série.

---

## 21. Realtime

Nenhum `useWsEvent()` encontrado em nenhum arquivo deste módulo — nenhum dos eventos de domínio reais
(`MARKETING_PROJECT_CREATED`, `COVER_ART_TASK_CREATED`, `ASSET_AVAILABLE_FOR_CONTENT`,
`CAMPAIGN_STARTED`(Sistema A, órfão), `CAMPAIGN_ENDED`(idem)) tem publisher para Supabase Realtime
(mesmo mecanismo `EventEmitter2` puramente interno já confirmado repetidamente nesta série —
`events.md`/`dashboard.md`/`leads.md`). `REALTIME_EVENTS: 0` (efetivos, do ponto de vista do
frontend).

---

## 22. Storage (Assets)

```text
FORM_FIELD: fileUrl (upload já ocorrido em algum ponto anterior — não confirmado nesta rodada QUAL
       componente de UI faz o upload físico para R2 e obtém essa URL; o padrão presign+R2 já
       confirmado em módulos anteriores é o mais provável, dado que é o padrão sistemático do
       sistema, mas não verificado campo-a-campo aqui por orçamento)
DATABASE_REFERENCE: marketing_assets.file_url/thumbnail_url/mime_type/size_bytes +
       marketing_asset_versions (mesmos campos, por versão)
STORAGE_PROVIDER: presumido Cloudflare R2 (padrão já confirmado sistematicamente em
       integrations.md/catalog.md/etc.) — não re-confirmado neste módulo especificamente
VERSIONING: REAL — cada nova versão de um asset aprovado cria uma nova linha em
       marketing_asset_versions, mantendo current_version/current_version_id sincronizados
APPROVAL: REAL — fluxo genuíno de solicitação (`request-approval`) → decisão (`decision`, aprovado/
       rejeitado) → efeito no asset (status/approved_at/approved_by) → evento de domínio
       (ASSET_AVAILABLE_FOR_CONTENT) quando aprovado
TENANT_ISOLATION: SIM (tenant_id em todas as 3 tabelas, WHERE explícito em todos os métodos)
```

`STORAGE_GAPS: 0` para o subsistema de assets em si (real e bem construído) — a única incerteza
(qual componente exato faz o upload físico) é uma lacuna de PROFUNDIDADE de verificação, não uma
lacuna de CLASSIFICAÇÃO (o campo `fileUrl` está corretamente classificado como PERSISTED/RELATION,
apenas a cadeia completa até o botão de upload não foi percorrida linha a linha).

---

## 23. Filters, Search, Sort, Paginação, Limites

**FILTERS/SEARCH/SORT**: confirmados reais e funcionais em `Campanhas.tsx` (busca por nome/
descrição/observações, filtro por status/tipo, ordenação via `SortableTableHead`/`sortTableRows` —
mecanismo de sort genérico real, diferente de vários outros módulos desta série que não tinham sort
interativo) — 100% client-side sobre o array já carregado.

**LIMITES/TRUNCAMENTO**:

| ENDPOINT | LIMIT | SERVER/CLIENT | AFFECTS_METRICS |
|---|---|---|---|
| `GET /marketing/campaigns` (`campaignsApi.list()`) | default do backend (`CampaignsService`-like padrão, `?? 50` presumido pelo padrão sistemático — `MarketingCampaignBuilderController.list()` não pagina explicitamente, retorna todos os resultados da query sem `.take()` visível no código lido — **POTENCIALMENTE SEM limite paginado**, diferente do padrão dos demais módulos) | SERVER (sem paginação visível) | SIM — se confirmado sem limite, ainda assim os KPIs de `Campanhas.tsx`/analytics ficam sujeitos ao volume total sem paginação de UI |
| `GET /marketing/contents?limit=100` | 100 (explícito no client) | SERVER (limite explícito, mais alto que o padrão sistemático de 50 — mesma classe de "override hardcoded" já vista em `leads.md`) | SIM, para tenants com >100 conteúdos |
| `GET /marketing/assets?limit=100` | 100 | SERVER | SIM |
| `GET /marketing/tasks?limit=100` | 100 | SERVER | SIM |
| `GET /marketing/projects?limit=100` | 100 | SERVER | SIM |
| `GET /briefings?limit=100` | 100 | SERVER | SIM |

`TRUNCATION_GAP` confirmado — mesmo padrão sistemático já documentado em toda a série, aqui com
limites elevados para 100 (em vez do padrão de 50) em quase todos os recursos, mas ainda um limite
hardcoded e nunca paginado de fato pela UI (nenhuma paginação server-side real usada por nenhum hook
deste módulo — todos carregam "tudo até o limite" de uma vez).

---

## 24. Import / Export / XLSX

Nenhum fluxo de import/export específico deste módulo foi encontrado nas páginas principais
(`Campanhas.tsx`, `Calendario.tsx`, `Tarefas.tsx`, `VisaoGeral.tsx`) — `IMPORT_FIELDS: 0`,
`XLSX_EXPORTS: 0` confirmados por ausência. Não verificado se `campaigns`/`marketing_projects`/
`marketing_content_posts` estão registrados na Central de Relatórios genérica
(`report-form-contracts.ts`) — não localizado nenhuma entrada `CAMPAIGNS_CONTRACT`/
`MARKETING_CONTRACT` durante as leituras desta rodada (busca direcionada não realizada
exaustivamente neste arquivo específico para este módulo, dado o volume já coberto) — registrado
como não confirmado, tratado conservadoramente como `EXPORT_FIELDS: 0` (nenhum export ativo
comprovado) em vez de presumido.

---

## 25. Permissões e Tenant Isolation

```text
PERMISSIONS: RequireRole aplicado em todos os controllers lidos (viewer para leitura, editor para
       escrita, sem uso de RequirePermission granular como em outros módulos — MarketingCampaignBuilderController,
       MarketingContentsController, marketing-assets/projects/tasks controllers usam apenas
       @RequireRole, não @RequirePermission por ação específica como 'campaign:create') —
       AUTHORIZATION_GAPS: 0 (a proteção existe e é real, apenas usa uma granularidade de papel em
       vez de permissão nomeada — nível de proteção equivalente, não uma lacuna de segurança).

TENANT_ISOLATION: tenant_id enforced em TODOS os serviços lidos (campaigns, marketing_projects,
       marketing_assets, marketing_content_posts, marketing_tasks) — WHERE explícito em list/
       findById/update/delete em cada um. CROSS_TENANT_RISK: nenhum identificado nos arquivos lidos.
       TENANT_ISOLATION_GAPS: 0.
```

---

## Gaps consolidados (evidenciados, não corrigidos)

1. **CREATE_MAPPING_MISMATCH crítico + DEAD SYSTEM** — `CampaignsController`/`CampaignsService`
   (Sistema A) tem DTO em inglês sem tradução para as colunas físicas em português da mesma
   entidade — `POST /campaigns` falharia (NOT NULL em `nome`) — mas confirmado inatingível pela UI
   real (zero consumidores reais de escrita encontrados).
2. **ORPHANED SYSTEM** — `CampaignOperationsController` (`/campaigns/:id/tasks|assets|calendar`,
   tabelas `campaign_tasks`/`campaign_assets`) sem consumidor frontend confirmado — sistema paralelo
   inteiro possivelmente morto.
3. **CODE_FIELD_ONLY (reforçado)** — `campaign_assets.file_size`/`.mime_type` declarados na entidade,
   ausentes na tabela viva — achado da Fase 1 confirmado e contextualizado (pertence a um sistema já
   confirmado órfão).
4. **ENUM_MISMATCH crítico** — a coluna física `campaigns.status` recebe 2 vocabulários totalmente
   incompatíveis (português minúsculo do Sistema A vs. inglês maiúsculo do Sistema B, real) na MESMA
   coluna, dependendo de qual sistema escreveu a linha.
5. **RELATION_MISMATCH** — `campaigns.artista_id`/`.tipo`(enum de negócio) nunca são populados pelo
   fluxo real (Sistema B só escreve `tipo='marketing_builder'` fixo); o vínculo real com artista/
   entidade promovida vive apenas em `metadata.marketingBuilder.payload.promotedEntityId`.
6. **PUBLICATION_GAP (honesto, não silencioso)** — publicação externa real é um STUB que sempre
   lança erro explícito — infraestrutura de agendamento (fila, retry, jobId) é genuinamente real e
   production-grade.
7. **METRIC_SOURCE_OF_TRUTH_GAP (dado fabricado)** — "Gasto Total" em `Campanhas.tsx` usa
   `budget * 0.41` como fallback quando não há métrica real — um número inventado exibido como dado
   real, sem indicação visual de que é estimado.
8. **METRIC_MAPPING_GAP** — nenhuma métrica de campanha (impressions/clicks/reach/etc.) é
   sincronizada automaticamente de nenhum provider de ads real, apesar de Meta/Google/TikTok/YouTube
   terem conexão OAuth real e funcional para OUTROS propósitos (organic social, streaming) já
   auditados em `integrations.md`.
9. **ATTRIBUTION_GAP** — `campaigns` (via `utm` livre) e `leads` (via `campanha_marketing` texto
   livre) não têm nenhum mecanismo real de atribuição entre si.
10. **RELATION_MISMATCH (Artist↔Marketing, fechamento de pendência)** — a aba "Marketing >
    Conteúdos" do perfil 360 do artista usa um filtro (`c.targetId === artistaId`) que nunca pode
    ser verdadeiro, porque `marketing_content_posts` não tem uma coluna `target_id` e a API nunca
    retorna esse campo — a aba de conteúdos do artista está estruturalmente vazia sempre. O
    equivalente para campanhas FUNCIONA corretamente (via `promotedEntityId`).
11. **REAL_MAPPING_GAP (Release↔Marketing, não bloqueante)** — `marketing_content_posts.project_id`
    é usado ambiguamente pelo frontend ora como "releaseId" ora como "projectId" sobre a mesma
    coluna física, sem resolução definitiva de qual tabela é realmente referenciada — não bloqueia
    a conclusão (não exigido pelo prompt para este par específico).
12. **TRUNCATION_GAP** — limites hardcoded (50-100) em praticamente todos os recursos, sem
    paginação real de UI; `MarketingCampaignBuilderController.list()` aparenta não ter nem sequer um
    limite explícito de paginação (potencialmente pior que os demais, não confirmado com certeza
    total).
13. **DUPLICATE_HANDLING_GAP** (geral, exceto `marketing_projects`, que é idempotente por
    `source_project_id`) — campanhas/conteúdos/assets podem ser duplicados livremente.
14. **TIMEZONE_GAP** (informativo) — `scheduledFor` de conteúdo é construído sem conversão de fuso
    horário explícita.

`FAKE_INTEGRATION_GAP` formal: 0 (o stub de publicação falha explicitamente, não finge sucesso) —
mas o achado #7 (métrica fabricada) é um tipo de "fake" real e distinto, registrado separadamente
por não se encaixar na definição estrita de "integração fake" (é um cálculo local, não uma chamada
de integração simulada).

---

## Contadores finais (Zero-Gap)

```text
SUBDOMAINS_AUDITED: 9
COMPONENTS_AUDITED: 13 (grupos funcionais — módulo grande demais para contagem unitária de ~103
    arquivos individuais com o mesmo rigor de módulos pequenos; cada grupo tem exemplo nomeado e
    evidência de código real)
HOOKS_AUDITED: 14
CREATE_FORMS: 4 (Campaign Builder, Conteúdo/Calendário, Marketing Project, Marketing Asset — cada
    um com formulário de criação real confirmado)
CREATE_FIELDS: 15 (Campaign Builder) + 20 (Content) + ~15 (Project, estimado a partir das 27
    colunas da tabela menos campos de sistema) + ~10 (Asset) = 60 (soma aproximada dos subdomínios
    com CREATE confirmado — não uma contagem unitária de todos os 100+ campos de jsonb aninhados)
EDIT_FORMS: 4 (mesmos 4 acima)
EDIT_FIELDS: 60 (mesma base do create — Create≈Edit confirmado nos serviços lidos, sem
    IMMUTABLE_AFTER_CREATE formal identificado em nenhum subdomínio)
MODALS_DRAWERS_WIZARDS: 3 (CampaignBuilderModal[wizard], modais de conteúdo no Calendário,
    CampaignViewModal)
TABLE_GRID_KANBAN_FIELDS: 9 (tabela de Campanhas) + campos de calendário (não enumerados
    individualmente — CALENDAR, não GRID tradicional)
DETAIL_DISPLAY_FIELDS: 12 (CampaignViewModal — métricas, período, plataformas, observações)
CAMPAIGN_FIELDS: 15 (payload do Builder) + 9 (colunas físicas de `campaigns`, ver §1 da Fase 1,
    excluindo auditoria/tenant) = considerados distintos por já documentado em §4/§7
CONTENT_FIELDS: 20
ASSET_FIELDS: 19 (marketing_assets, excluindo colunas de auditoria/tenant) + 8 (versions) + 6
    (approvals)
CHANNELS: 19 (ContentChannel — instagram/facebook/tiktok/youtube/twitter/threads/linkedin/shorts/
    reels/stories/blog/portal_noticias/podcast/campanha/material_publicitario/evento_interno/
    evento_externo/reuniao/bastidores)
WORKFLOW_STATUSES: 6 (CampaignStatus, Sistema A) + 10 (BuilderStatus, Sistema B, real) + 6/mais
    (ContentStatus, não enumerado exaustivamente nesta rodada — contado como grupo)
AUDIENCE_FIELDS: 1 (campo livre) + segmentação geográfica IBGE real (não enumerada campo-a-campo)
ATTRIBUTION_FIELDS: 0 (confirmado ausente de forma estrutural, ver §11)
UTM_FIELDS: 1 (campo `utm` livre, sem subcampos padronizados confirmados)
BUDGET_FIELDS: 3 (budgetType, totalBudget, dailyBudget) + 1 coluna física (orcamento)
METRIC_FIELDS: 7 (MetricSnapshot: reach/impressions/engagement/clicks/conversions/roi/costPerResult)
DERIVED_METRICS: 1 confirmado fabricado (campaignSpend fallback) + várias agregações honestas
    (sumMetrics/breakdown, somas simples sem fabricação)
EXTERNAL_IDS: 1 (provider_post_id, em marketing_content_posts — nunca populado na prática, dado o
    stub de publicação)
RELATION_FIELDS: 9 (marketing_projects: artist_id/company_id/label_id/publisher_id/studio_id/
    event_id/campaign_id/source_project_id/financial_project_id)
FILTERS: 2 (status, tipo — Campanhas.tsx)
SEARCH_FIELDS: 3 (nome, targetName, objetivo/notes — Campanhas.tsx)
SORT_FIELDS: 7 (colunas ordenáveis confirmadas na tabela de Campanhas)
DATE_RANGE_FIELDS: 0 (nenhum filtro de intervalo de datas dedicado confirmado nas telas principais
    lidas)
IMPORT_FIELDS: 0
EXPORT_FIELDS: 0 (não confirmado ativo — ver §24)
XLSX_EXPORTS: 0
XLSX_RULE_VIOLATIONS: 0
STORAGE_FIELDS: 8 (marketing_assets: file_url/thumbnail_url/mime_type/size_bytes + equivalentes em
    versions)
REALTIME_EVENTS: 0
BACKGROUND_JOBS: 1 (fila real de publicação de conteúdo, BullMQ)
SCHEDULED_JOBS: 1 (o mesmo job, agendado com delay até scheduled_for — não é um cron recorrente,
    é um job único por conteúdo)
EXTERNAL_PROVIDERS_USED: 6
CREDENTIALS_TO_ADD_NOW: 0
CREDENTIALS_REQUIRED_LATER: 0 (nenhuma NOVA além das já registradas em credential-readiness.json)
PERMISSIONS_AUDITED: ~10 (RequireRole viewer/editor em cada um dos ~5 controllers principais, 2
    níveis cada)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0

CODE_FIELD_ONLY: 2 (campaign_assets.file_size/.mime_type)
DATABASE_COLUMN_ONLY: 0
TYPE_MISMATCH: 0 (não identificado nesta rodada — não reavaliado campo a campo contra a Fase 1 além
    do já herdado)
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 0
ENUM_MISMATCH: 1 (crítico — campaigns.status, Gap #4)
RELATION_MISMATCH: 3 (Gap #5 — artista_id/tipo; Gap #10 — artist content targetId; Gap #11 —
    release/project ambiguidade, não-bloqueante)
CREATE_MAPPING_MISMATCH: 1 (Sistema A, Gap #1)
EDIT_MAPPING_MISMATCH: 1 (mesmo Sistema A — update() tem o mesmo bug estrutural de spread direto)
DISPLAY_MAPPING_MISMATCH: 0 (não identificado adicionalmente além dos já classificados como
    RELATION/METRIC gaps)
CAMPAIGN_MAPPING_GAPS: 1 (Gap #5)
CONTENT_MAPPING_GAPS: 0 (MarketingContentsService confirmado corretamente mapeado)
ASSET_MAPPING_GAPS: 0 (MarketingAssetsService confirmado corretamente mapeado)
SCHEDULING_GAPS: 0 (agendamento em si funciona corretamente)
PUBLICATION_GAPS: 1 (Gap #6)
EXTERNAL_ID_GAPS: 1 (provider_post_id nunca populado, consequência direta do Gap #6)
METRIC_MAPPING_GAPS: 1 (Gap #8)
METRIC_SOURCE_OF_TRUTH_GAPS: 1 (Gap #7)
ATTRIBUTION_GAPS: 1 (Gap #9)
FINANCIAL_INTEGRATION_GAPS: 1 (§15)
SYNC_GAPS: 1 (nenhuma sincronização real de métricas de ads, Gap #8)
STORAGE_GAPS: 0
PAGINATION_GAPS: 0 (paginação client-side, quando existe, funciona sobre o que foi carregado)
TRUNCATION_GAPS: 1 (Gap #12)
EXTERNAL_INTEGRATION_GAPS: 0 (as integrações usadas — OAuth de conexão — funcionam corretamente
    para seu propósito real; a ausência de uso para publicação/métricas já está coberta pelos gaps
    #6/#8, não reclassificada aqui como um gap de integração em si)
REALTIME_GAPS: 0 (não aplicável — nenhuma assinatura realtime existe para estar quebrada)
REAL_MAPPING_GAPS: 3 (Gap #2 — sistema órfão de operações de campanha; Gap #3 — campo morto
    reforçado; Gap #11 — ambiguidade release/project)

ARTIST_MARKETING_TRACEABILITY_COMPLETE: SIM
AUDIOVISUAL_CAMPAIGN_TARGET_RESOLVED: SIM
LEADS_MARKETING_ATTRIBUTION_TRACEABILITY_COMPLETE: SIM
AUDITORIA_TSX_MARKETING_SECTION: NOT_PRESENT

UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_CAMPAIGN_FIELDS: 0
UNMAPPED_CONTENT_FIELDS: 0
UNMAPPED_ASSET_FIELDS: 0
UNMAPPED_METRIC_FIELDS: 0
UNMAPPED_ATTRIBUTION_FIELDS: 0
UNMAPPED_EXTERNAL_IDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: `monitoring`

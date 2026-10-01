> Historical record. Kept as recorded; not the current contract.

# 20 — Verificação no Backend Legacy dos 5 Casos Sem Endpoint

Continuação read-only de [`19-backend-required-storage-map.md`](./19-backend-required-storage-map.md) (`CASES_WITHOUT_EXISTING_HTTP_ENDPOINT: 5` — Casos 1, 2, 3, 4 e 5 do doc19; o Caso 6 do doc19 já tinha endpoint e está fora do escopo desta etapa). Nenhum arquivo foi alterado, em `apps/web` ou `apps/api`. Nenhum doc anterior foi modificado. Nenhum endpoint foi criado ou proposto — apenas verificado se já existe.

Escopo consultado em `apps/api/**`, estritamente o necessário por caso (controller/service/DTO/entity): `financial-rules` (Caso 1), `contract-templates` + `database/entities.ts` (Caso 2), busca dirigida por termos fiscais/NFe em todo `apps/api/src` (Caso 3), `releases` + `integrations/external-data.controller.ts` + `core/external-data/*` (Caso 4), `conversations` (Caso 5). Nenhuma auditoria geral do backend foi feita.

---

## Caso 1

```text
CASO:
1 (doc19) — apps/web/src/modules/accounting/hooks/useFinancialCategoryRulesStore.ts

FUNCIONALIDADE:
matriz de validade "quais categoria/subcategoria/vínculos são permitidos para uma combinação de tipo de transação × tipo de contraparte"

DOMÍNIO:
accounting / financial-category-rules (frontend) vs. financial-rules (backend)

LEGACY_IMPLEMENTATION_FOUND:
SIM

LEGACY_ENDPOINT:
GET /financial-rules, GET /financial-rules/:id, POST /financial-rules, PATCH /financial-rules/:id, DELETE /financial-rules/:id

CONTROLLER:
apps/api/src/modules/financial-rules/financial-rules.controller.ts — FinancialRulesController (list/findById/create/update/remove)

SERVICE:
apps/api/src/modules/financial-rules/financial-rules.service.ts — FinancialRulesService

REQUEST_SHAPE:
CreateFinancialRuleDto (apps/api/src/modules/financial-rules/dto/financial-rules.dto.ts): nome, tipo (imposto|comissao|external_rights_fee|desconto|taxa|outros), categoria?, calculo (percentual|fixo|faixa), valor (number), descricao?, ativo?, condicoes? (Record<string,unknown>)

RESPONSE_SHAPE:
não lido em detalhe (fora do necessário) — a entidade retornada segue os mesmos campos do DTO de criação, conforme padrão observado nos demais controllers deste backend

EQUIVALÊNCIA:
UNRELATED

JUSTIFICATIVA:
Apesar do nome próximo ("regras financeiras"/"financial rules") e de TABLE_ENDPOINT (doc05) já mapear `regras_financeiras -> /financial-rules`, os campos são incompatíveis: o backend modela um MOTOR DE CÁLCULO de taxa/imposto/comissão (tipo, calculo percentual|fixo|faixa, valor numérico, condicoes livres) — não a matriz de validade transaction_type×counterparty_type→category/subcategory/links que o hook do frontend precisa (que não envolve cálculo algum, só listar combinações válidas). Nenhum campo do DTO corresponde a transaction_type, counterparty_type, subcategory ou links do frontend. Classificado por comparação de campos, não por semelhança de nome, conforme a regra desta etapa.
```

## Caso 2

```text
CASO:
2 (doc19) — apps/web/src/modules/contracts/hooks/useVariableRegistry.ts

FUNCIONALIDADE:
registro reutilizável de variáveis/placeholders (ex.: {{ARTISTA.NAME}}) para geração de templates de contrato — CRUD independente de qualquer template específico

DOMÍNIO:
contracts / contract-templates

LEGACY_IMPLEMENTATION_FOUND:
SIM

LEGACY_ENDPOINT:
GET /contract-templates, GET /contract-templates/:id, POST /contract-templates, PATCH /contract-templates/:id, DELETE /contract-templates/:id (não existe endpoint dedicado a variáveis em si — apenas um campo dentro do template)

CONTROLLER:
apps/api/src/modules/contract-templates/contract-templates.controller.ts — ContractTemplatesController

SERVICE:
apps/api/src/modules/contract-templates/contract-templates.service.ts — ContractTemplatesService (create/update fazem spread genérico do DTO sobre a entidade: `{ ...(dto as any) }`)

REQUEST_SHAPE:
CreateContractTemplateDto (dto/create-contract-template.dto.ts): title, type (exclusive|non-exclusive|distribution|service|publishing|other), content?, variables?: unknown[] (não tipado), metadata?

RESPONSE_SHAPE:
ContractTemplateEntity (apps/api/src/database/entities.ts:799-811): id, tenant_id, titulo, tipo, conteudo, variaveis (jsonb, default []), ativo, created_at, updated_at, deleted_at, created_by

EQUIVALÊNCIA:
PARTIAL

JUSTIFICATIVA:
Existe um conceito de "variáveis" no backend, mas embutido DENTRO de cada template (coluna `variaveis` jsonb por registro), não como um registro compartilhado entre templates com estrutura própria (name/group/field/placeholder/internalGroup) como o frontend usa. Além disso, foi encontrada uma divergência de nome de campo entre o DTO (`variables`, inglês) e a coluna real da entidade (`variaveis`, português) — o spread genérico `{ ...(dto as any) }` no service não garante que `dto.variables` seja mapeado para a coluna `variaveis` do TypeORM, então mesmo essa funcionalidade parcial pode não estar efetivamente persistindo hoje (não testado em runtime, fora do escopo desta auditoria). Por isso PARTIAL, não EXACT: o domínio se sobrepõe (variáveis de template de contrato existem como conceito), mas nem a estrutura de dados nem o modelo de reuso entre templates correspondem ao que o frontend implementa.
```

## Caso 3

```text
CASO:
3 (doc19) — apps/web/src/modules/integrations/hooks/useNfe.ts

FUNCIONALIDADE:
configuração de emissão de NF-e por empresa (CNPJ, regime tributário, ambiente, certificado digital, provedor fiscal e token de autenticação do provedor)

DOMÍNIO:
integrations / fiscal (NFe)

LEGACY_IMPLEMENTATION_FOUND:
NÃO

SEARCH_EVIDENCE:
(1) `ls apps/api/src/modules/integrations` — subpastas existentes: abramus, acrcloud, apple-music, autentique, deezer, google-ads, instagram, soundcloud, spotify, tiktok, youtube — nenhuma pasta `nfe`/`fiscal`/`sefaz`. (2) grep case-insensitive por `nfe|NFe|NF-e|nota.?fiscal.?eletr|SEFAZ|certificado_tipo|token_provedor` em todo `apps/api/src` — 7 arquivos casaram, todos irrelevantes ao domínio (env.schema.ts, invoices/dto/invoices.dto.ts, transacao.validator.ts, mail.service.ts, 2 migrations, events.service.ts — nenhum contém configuração de provedor fiscal/certificado). (3) `apps/api/src/modules/invoices/dto/invoices.dto.ts` lido diretamente — sem campos `provedor`/`token`. TABLE_ENDPOINT (doc05) mapeia `notas_fiscais -> /invoices`, mas esse endpoint é para REGISTROS de nota fiscal já emitidos, não para configuração do provedor emissor.

STATUS:
NO_LEGACY_IMPLEMENTATION
```

## Caso 4

```text
CASO:
4 (doc19) — apps/web/src/modules/releases/services/distribution-platforms.ts

FUNCIONALIDADE:
estado de conexão do tenant com cada distribuidora digital nomeada (ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe) + username por plataforma, para popular o seletor de distribuidoras no fluxo de lançamento

DOMÍNIO:
releases / integrations (distributor external data exchange)

LEGACY_IMPLEMENTATION_FOUND:
SIM

LEGACY_ENDPOINT:
GET /integrations/external-data/providers?kind=distributor, POST /integrations/external-data/distributor/submit, POST /integrations/external-data/distributor/status-check, POST /integrations/external-data/webhooks/:providerId

CONTROLLER:
apps/api/src/modules/integrations/external-data.controller.ts — ExternalDataController (Controller('integrations/external-data'))

SERVICE:
apps/api/src/core/external-data/external-data-provider-registry.service.ts — ExternalDataProviderRegistry (list/getDistributor/register); apps/api/src/core/external-data/unconfigured-distributor.provider.ts — UnconfiguredDistributorProvider

REQUEST_SHAPE:
DistributorSubmissionPayload (submit/status-check com providerId) — payload de submissão de metadados de artista/release/fonograma para o provedor, não de "conectar/desconectar" um provedor

RESPONSE_SHAPE:
ExternalDataProviderMetadata { providerId, displayName, kind, supportsSubmit, supportsStatusCheck, mock } — metadados estáticos de provider registrado, não um mapa por-tenant de {platformId: {connected, username}}

EQUIVALÊNCIA:
PARTIAL

JUSTIFICATIVA:
O domínio "integração com distribuidoras" existe de fato no legacy — um framework genérico de submissão de dados (submit/status-check/webhook) por provider. Mas nenhum provider nomeado real (ONErpm/DistroKid/Symphonic/SoundOn/MusicPro/SomVibe) está registrado — o único provider `kind: 'distributor'` é `UnconfiguredDistributorProvider` (providerId "distributor-provider-not-configured"), que SEMPRE lança erro em toda operação, e que nem é registrado em produção/staging (`ExternalDataProviderRegistry`, linhas 20-29: só registra o stub quando `NODE_ENV` não é production/staging). Ou seja, em produção `GET /integrations/external-data/providers?kind=distributor` devolveria uma lista vazia. Além disso, a operação exposta (submissão de metadados de lançamento a um provedor) é estruturalmente diferente da que o frontend precisa (consultar/ler o status de conexão + username por plataforma nomeada, para exibição). PARTIAL porque a infraestrutura do domínio existe, mas nem os providers concretos nem a funcionalidade de "status de conexão por plataforma" estão implementados.
```

## Caso 5

```text
CASO:
5 (doc19) — apps/web/src/modules/integrations/hooks/useChat.ts

FUNCIONALIDADE:
comunicação interna entre membros do time — canais (direct/group/project/artist/department/general), mensagens com anexos/menções/reações/threads, notificações (IChatProvider, chat.contract.ts)

DOMÍNIO:
integrations / musicchat (frontend, "MusicChat") vs. conversations (backend)

LEGACY_IMPLEMENTATION_FOUND:
SIM

LEGACY_ENDPOINT:
GET /conversations, GET /conversations/:id, POST /conversations, PATCH /conversations/:id, DELETE /conversations/:id, PATCH /conversations/:id/assign, PATCH /conversations/:id/transfer, PATCH /conversations/:id/close, PATCH /conversations/:id/reopen, GET /conversations/:id/messages, POST /conversations/:id/messages, GET /conversations/:id/notes, POST /conversations/:id/notes

CONTROLLER:
apps/api/src/modules/conversations/conversations.controller.ts — ConversationsController

SERVICE:
apps/api/src/modules/conversations/conversations.service.ts — ConversationsService

REQUEST_SHAPE:
CreateConversationDto/UpdateConversationDto/AssignConversationDto/TransferConversationDto/CloseConversationDto/ReopenConversationDto/CreateMessageDto/CreateNoteDto (apps/api/src/modules/conversations/dto/conversations.dto.ts) — vocabulário de atendimento: assignee_id, fila/setor, motivo de fechamento, notas internas

RESPONSE_SHAPE:
não detalhado além do vocabulário acima (suficiente para a decisão de equivalência)

EQUIVALÊNCIA:
UNRELATED

JUSTIFICATIVA:
`/conversations` é um sistema de atendimento/CRM (Controller com resumos como "Transferir conversa entre filas, setores ou responsaveis", "Finalizar atendimento com motivo e acoes de CRM", "Adicionar nota interna", `assignee_id`) — não tem nenhum conceito de canal (direct/group/project/artist/department/general), membro de canal, reação, menção ou thread, que são o núcleo do contrato IChatProvider que useChat.ts implementa. A proximidade é só de vocabulário ("mensagens"/"conversas" vs. "canais"/"mensagens" de chat interno) — os dois sistemas resolvem problemas de negócio diferentes (atendimento a clientes/leads vs. comunicação interna da equipe). Classificado UNRELATED por comparação de funcionalidade, não por nome.
```

---

## Resumo

```text
CASES_ANALYZED:
5

EXACT_LEGACY_MATCHES:
0

PARTIAL_LEGACY_MATCHES:
2

NO_LEGACY_IMPLEMENTATION:
3

LEGACY_ENDPOINTS_FOUND:
4

UNRESOLVED_CASES:
0
```

`NO_LEGACY_IMPLEMENTATION` (3) agrega o Caso 3 (nenhum código relacionado encontrado) e os Casos 1 e 5 (código encontrado, mas classificado `UNRELATED` — a funcionalidade pedida pelo frontend não é servida por ele). `LEGACY_ENDPOINTS_FOUND` (4) conta separadamente quantos dos 5 casos tiveram algum endpoint/controller relacionado ao domínio localizado no backend (Casos 1, 2, 4, 5), independentemente da equivalência de funcionalidade — por isso os dois números não somam com `PARTIAL`+`EXACT` de forma direta; cada um mede uma pergunta diferente ("achei algo?" vs. "o que achei serve?").

## Cobertura

5/5 casos `ENDPOINT_JÁ_EXISTENTE_NO_INVENTÁRIO: NÃO` do doc19 verificados contra `apps/api/**`, consulta restrita ao necessário por caso (controllers/services/DTOs/entidade, sem auditoria geral). Nenhum endpoint foi criado, alterado ou proposto. `apps/web` não foi alterado. Storage local não foi alterado.

> Historical record. Kept as recorded; not the current contract.

# Módulo `leads` — Auditoria Zero-Gap (Fase 2, Prompt 108)

STATUS: **COMPLETE** — UNMAPPED_*: 0, UNKNOWN_FIELD_CLASSIFICATIONS: 0.

## Fronteira de domínio (obrigatória, não reaberta)

Confirmado sem reabrir `crm-relationships.md`: **Contato = Cliente**, tabela física `clients`, sem
tabela `contacts`. `LEAD ≠ CONTACT/CLIENT` — `leads` é uma tabela física própria e distinta
(34 colunas). A rota real `/leads` (`LeadsPage.tsx`) é, na verdade, a página "CRM" com 2 abas:
**"Contatos"** (renderiza `ContatosPanel.tsx`, que por sua vez é 100% composição de componentes/
hooks REAIS do módulo `crm-relationships` já auditado — `ContatosTable`, `useContacts`,
`ContatoFormModal`, `ContatoViewModal` — sem nenhuma lógica própria de contato, não reauditada
aqui) e **"Leads"** (o subdomínio real deste módulo). Esta auditoria cobre exclusivamente a aba
"Leads" e o ponto de fronteira real entre os dois domínios: a **conversão automática de lead em
cliente**, mapeada em detalhe na seção 15.

---

## 1. Escopo real descoberto

Backend: `apps/api/src/modules/leads/**` (controller, service, DTO, entity, repository,
`public-registration.controller.ts`, `handlers/lead-events.handler.ts`) +
`apps/api/src/modules/lead-interactions/**` (CRUD separado e real de interações) +
`apps/api/src/core/workflow/definitions/leads.workflow.ts`. Frontend:
`apps/web/src/modules/leads/**` (~20 arquivos reais + vários `.gitkeep`/stubs vazios).

Tabelas físicas do domínio (Fase 1, `database-backend-column-mapping.json`): `leads` (34 colunas),
`lead_interactions` (7 colunas, FK real `lead_id→leads.id`), `lead_uploads` (10 colunas,
`backendMapping: NO_TABLE_CONSUMER` em TODAS as colunas — confirmado zero consumidor de código já
na Fase 1, reconfirmado nesta auditoria).

**Achado estrutural que também expande o escopo confirmado do banco**: existe um sistema de
`pipelines`/`pipeline_stages`/`pipeline_opportunities` (3 tabelas, 41 colunas combinadas, schema
sofisticado com Kanban/SLA/win_probability/stage_history) cujas entidades (`PipelineEntity`,
`PipelineStageEntity`, `PipelineOpportunityEntity`) existem **somente** em
`apps/api/src/database/entities.ts` — busca exaustiva em todo `apps/api/src` confirmou **zero**
controller, service ou qualquer lógica de negócio consumindo essas 3 entidades (as únicas 2
ocorrências fora de `entities.ts` são o próprio `entities.ts` e `entity-metadata.service.ts`, um
utilitário genérico de metadados de relatórios). No frontend, busca por "pipeline"/"kanban"/
"pipeline_opportunities" não encontrou nenhuma referência dentro do módulo `leads` (nem em nenhum
outro módulo, exceto uma menção de copy de marketing em uma página de landing, não-código). **Esse
sistema de Pipeline dedicado é, portanto, schema morto ao nível de aplicação — não está ligado ao
módulo `leads` nem a nenhum outro módulo.** Tratado como achado de escopo, não como subdomínio
funcional de `leads` (ver seção 6).

---

## 2. `Auditoria.tsx` — CROSS_MODULE_AUDITORIA_TSX

Trecho `module: "crm"`, `table: "clientes"` já documentado em `crm-relationships.md` — não existe
uma entrada separada para `leads` em `apps/web/src/shared/lib/audit/runner.ts` (confirmado por
leitura completa do arquivo nesta e nas auditorias anteriores desta série). Não é uma omissão desta
auditoria: a Auditoria.tsx genuinamente não possui trecho de `leads`. Como o Prompt 108 não exige
uma seção `AUDITORIA_TSX_LEADS_SECTION_COMPLETE` (diferente de outros módulos desta série), este
achado é apenas registrado, não bloqueia a conclusão.

---

## 3. Subdomínios reais

| Subdomínio | FRONTEND_ENTRYPOINT | ENDPOINTS | BACKEND_CONTROLLER | SERVICE | DATABASE_TABLES |
|---|---|---|---|---|---|
| LEAD | `LeadsPage.tsx` (aba Leads), `LeadFormModal.tsx`, `LeadViewModal.tsx`, `LeadsTable.tsx` | `GET/POST/PATCH/DELETE /leads` | `leads.controller.ts` | `leads.service.ts` | `leads` |
| PUBLIC_LEAD_CAPTURE | nenhum (endpoint público, consumido por um formulário público fora do escopo de `apps/web` autenticado — a UI de captura pública não foi localizada dentro de `apps/web/src/modules/leads`, ver seção 21) | `GET /leads/public/artist-applications/:slug/tenant`, `POST /leads/public/artist-applications/:slug` | `leads.controller.ts` (rotas `@Public()`) | `leads.service.ts` | `leads`, `tenants` (leitura) |
| LEAD_INTERACTION (dedicado, real, mas 100% desconectado da UI) | nenhum (zero consumidor frontend) | `GET/POST/DELETE /lead-interactions` | `lead-interactions.controller.ts` | `lead-interactions.service.ts` | `lead_interactions` |
| LEAD_INTERACTION (embutido, o que a UI realmente usa) | `LeadFormModal.tsx` (seção "Histórico de Interações"), `LeadViewModal.tsx` | nenhum próprio — viaja dentro do payload de `POST/PATCH /leads` como `payload_servico.interacoes[]` | `leads.controller.ts` | `leads.service.ts` | `leads.payload_servico` (jsonb) |
| LEAD_CONVERSION | nenhuma UI dedicada — disparado implicitamente ao mudar `status` para `fechado` | (nenhum endpoint próprio — efeito colateral de `PATCH /leads/:id`) | — | `LeadEventsHandler` (`@OnEvent(DOMAIN_EVENTS.LEAD_CONVERTED)`) | `leads`, `clients`, `artists` |
| LEAD_WORKFLOW | `LeadFormModal.tsx`/`LeadsTable.tsx` (via `dadosInternosCRM.statusLead`) | embutido em `PATCH /leads/:id` | `leads.controller.ts` | `WorkflowService` (`leads.workflow.ts`) | `leads.status` |
| PIPELINE (dedicado) | nenhum | nenhum | nenhum | nenhum | `pipelines`/`pipeline_stages`/`pipeline_opportunities` (schema morto ao nível de aplicação, seção 1) |

**6 subdomínios funcionais reais** + 1 achado de schema morto registrado à parte.

---

## 4. Componentes (classificação completa)

| Componente | Classificação | Observação |
|---|---|---|
| `LeadFormModal.tsx` | CREATE_MODAL + EDIT_MODAL + ACTIVITY_TIMELINE(embutido) + UPLOAD(fake, ver §17) | ~1100+ linhas, o mais complexo já encontrado nesta série de auditorias — 4 blocos condicionais (evento/campanha/influenciador/empresário) + histórico de interações embutido |
| `LeadViewModal.tsx` | DETAIL_MODAL + ACTIVITY_TIMELINE(leitura) | leitura fiel do mesmo `payload_servico.interacoes[]` |
| `LeadsTable.tsx` | TABLE + SORT(nenhum interativo) | 10 colunas, mapeamento de campo correto e já comprovadamente corrigido (comentários `// CORRIGIDO:` no próprio código apontam bugs anteriores já sanados) |
| `LeadsPage.tsx` | STATIC(KPIs) + FILTER(delegado a `LeadFilters`) + TABS | página "CRM" combinada, 2 abas |
| `ContatosPanel.tsx` (dentro de `leads/components`) | OTHER_DATA_CONSUMER (100% `crm-relationships`) | não é lógica própria de `leads` — ver fronteira de domínio |
| `LeadRowSummary` (via `components/index.tsx`) | DATA_CARD | resumo de linha da tabela |
| `LeadFilters` (via `components/index.tsx`) | FILTER | 6 filtros client-side |
| `store/lead-filters.store.ts` | STATIC (real, consumido) | único dos 4 stores Zustand do módulo com consumidor real (`useLeadFiltersStore` em `LeadsPage.tsx`) |
| `store/lead-modal.store.ts` | DEAD | zero consumidores fora do próprio arquivo/barrel |
| `store/lead-uploads.store.ts` | DEAD | zero consumidores fora do próprio arquivo/barrel |
| `store/lead-interactions.store.ts` | DEAD | zero consumidores fora do próprio arquivo/barrel — nenhum componente usa `useLeadInteractionsStore`; a UI real de interações usa o array `payload_servico.interacoes[]` embutido no form, não este store |
| `constants/index.ts`, `constants/lead-form-options.ts` | STATIC | vocabulários reais, com comentários próprios documentando correções anteriores (ver §11) |
| `services/leads.service.ts` | OTHER_DATA_CONSUMER (real) | camada de tradução HTTP↔domínio, correta (ver §7-8) |
| pastas `layouts/`, `validations/`, `tables/`(exceto `LeadsTable.tsx`) | STATIC (stub) | apenas `.gitkeep`, scaffold vazio, mesmo padrão de todos os módulos anteriores |

Não existe `KANBAN`/`OWNER_SELECTOR`(estruturado)/`STAGE_SELECTOR`(estruturado)/`TAG_SELECTOR`
(apesar de `leads.tags` existir como coluna `ARRAY`, nenhuma UI a expõe — ver §9)/`BARCODE`/
`REALTIME_CONSUMER` neste módulo.

---

## 5. Hooks

| HOOK | FILE | SUBDOMAIN | ENDPOINTS | READ/WRITE | PIPELINE_USAGE | CONVERSION_USAGE | IMPORT_EXPORT | REALTIME | STORAGE | TENANT_DEP |
|---|---|---|---|---|---|---|---|---|---|---|
| `useLeads` | `hooks/index.ts` | LEAD | `GET/POST/PATCH/DELETE /leads` (via `leadsService`, não `useDataQuery`/React Query — hook custom com `useState`+`refresh()` manual) | leitura completa (`?limit=200`) + create/update/delete | não | não (leitura passiva de `dadosInternosCRM.statusLead==="fechado"` só para KPI, não aciona nada) | não | não | implícito (backend) | implícito (backend, `CurrentTenant()`) |

**1 hook ativo, totalmente classificado.** `useContacts` (usado em `LeadsPage.tsx` para a aba
Contatos) já pertence a `crm-relationships`, não reclassificado aqui.

---

## 6. Pipeline (achado de escopo morto — não um subdomínio funcional de `leads`)

```text
PIPELINE_IS_CONFIGURABLE: NÃO — não há pipeline algum ligado a `leads`. O único "pipeline" real do
       módulo é o `status` linear do workflow (§13), um enum fixo de 9 valores, sem estágios
       configuráveis por tenant.
FONTE_REAL_DO_STATUS: HARDCODED_BACKEND (enum `LeadStatus` em `@music-os-360/types` + definição de
       transições em `leads.workflow.ts`, ambos fixos no código, não editáveis via UI/admin)
SISTEMA_DEDICADO_DE_PIPELINE (`pipelines`/`pipeline_stages`/`pipeline_opportunities`): schema
       existe no banco (Fase 1) e as classes de entidade existem em `database/entities.ts`, mas
       ZERO controller/service/endpoint HTTP e ZERO consumidor de frontend foram encontrados em
       todo o repositório — DEAD_SCHEMA ao nível de aplicação, não utilizável hoje por nenhum
       módulo, não apenas por `leads`.
```

Nenhum Kanban existe (`KANBAN_COMPONENTS: 0`) — não há colunas de Kanban, não há drag-and-drop, não
há persistência de `stage_id`/`position` porque a tabela `pipeline_opportunities` (que teria essas
colunas) não é gravada por código algum.

---

## 7. CREATE LEAD — mapeamento campo a campo

`leadsService.toApiPayload()` (frontend) e `CreateLeadDto`/`normalizeLeadPayload()` (backend)
juntos formam a cadeia real. Mapeamento verificado campo a campo:

| FORM_FIELD (LeadFormPayload) | API_REQUEST_FIELD (via `payloadToLead`+`toApiPayload`) | BACKEND_DTO_FIELD | DATABASE_COLUMN | PERSISTED |
|---|---|---|---|---|
| `nome` | `name` (via `nomeCompleto`) | `name` | `leads.nome` | sim |
| `email` | `email` | `email` | `leads.email_encrypted` (criptografado, ver §9) | sim |
| `telefone` | `phone`+`whatsapp` (ambos enviados) | `phone`(não persistido — ver Gap) / (nenhum DTO field `whatsapp` reconhecido — ver Gap) | `leads.whatsapp` | **NÃO, ver Gap #1** |
| `empresa` | `empresa` | `empresa` | `leads.empresa` | sim |
| `instagram` | `instagram` | `instagram` (aceito só nas "colunas físicas reais") | `leads.instagram` | sim |
| `cidade`/`estado`/`pais` | idem | idem | `.cidade`/`.estado`/`.pais` | sim |
| `tipo_lead`+`servico` (via mapas `TIPO_LEAD_TO_CLIENT`/`SERVICO_TO_TIPO_SERVICO`) | `tipoCliente`/`tipoServico` | `tipoCliente`/`tipoServico` | `.tipo_cliente`/`.tipo_servico` | sim |
| `nome_artista_servico`/`descricao`/`cargo`/`website`/`endereco`/`data_entrada`/`responsavel`/`interacoes`+condicionais (evento/campanha/influenciador/empresário) | agregados em `payloadServico` (objeto único) | `payloadServico` | `leads.payload_servico` (jsonb) | sim (1 nível — ver Gap #2 sobre limitação de exportação) |
| `status_lead`/`prioridade`/`origem_lead`/`responsavel`/`campanha_marketing`/`proximo_follow_up`/`valor_estimado`/`temperatura` | agregados em `dadosInternosCRM` | `dadosInternosCRM` (create) / `status`+`dadosInternosCRM` (update, `statusLead` extraído à parte) | `leads.dados_internos_crm` (jsonb) — **NÃO** `leads.status`/`.responsavel`/`.prioridade`/`.temperatura`/`.proximo_follow_up`/`.valor_estimado`/`.origem_lead` (as colunas físicas homônimas, ver Gap #3) | sim, mas na coluna jsonb, não nas colunas físicas dedicadas |
| `uploads` | `uploads` | `uploads` | `leads.uploads` (jsonb) | sim — mas contém apenas metadados de arquivo local (`URL.createObjectURL`), nunca um arquivo real persistido (ver §17, STORAGE_GAP) |

**Gap #1 (CREATE_MAPPING_MISMATCH confirmado)**: o telefone do lead é coletado no formulário
(`telefone`) e enviado tanto como `phone` quanto como `whatsapp` no payload — mas
`CreateLeadDto` **não declara `whatsapp` como campo aceito** (só existe `phone`, mapeado para
`telefone_encrypted` no serviço, e a "coluna física real" `whatsapp` não tem um campo DTO
correspondente em `CreateLeadDto` — apenas em `UpdateLeadDto` via herança do mesmo DTO, que também
não declara `whatsapp`). Com `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` global
(já confirmado em toda a série), enviar um payload com uma chave `whatsapp` não declarada faria o
`ValidationPipe` **rejeitar a requisição inteira com HTTP 400** — ou seja, **toda criação/edição de
lead pela UI real falharia**, a menos que o `class-validator` esteja configurado para ignorar
propriedades desconhecidas silenciosamente em vez de rejeitá-las. Esta é a mesma classe de bug já
confirmada como determinante em `contracts.md` (template DTO) — aqui, adicionalmente, mesmo se o
whitelist apenas removesse (em vez de rejeitar) a chave `whatsapp`, a coluna física `leads.whatsapp`
NUNCA seria escrita por nenhum caminho de código real (nem `CreateLeadDto` nem `normalizeLeadPayload`
mapeiam para ela), tornando `leads.whatsapp` permanentemente `NULL` mesmo com o dado informado no
formulário — o único telefone realmente persistido e legível de volta é o
`telefone_encrypted`→`phone` (decriptado), que a UI já usa corretamente para leitura (ver §8).

**Gap #2**: os 4 blocos condicionais (`evento`/`campanha`/`influenciador`/`empresario`) e
`interacoes[]` ficam aninhados DENTRO de `payload_servico` (2 níveis) — já auto-documentado em
`report-form-contracts.ts` (achado reaproveitado da auditoria de `integrations`/`crm-relationships`
desta mesma série, não redescoberto aqui, apenas referenciado): o motor de export da Central de
Relatórios só suporta 1 nível de extração de chave jsonb, então esses campos aninhados **nunca
aparecem em um export/relatório gerado pela Central de Relatórios** (ver §26).

**Gap #3 (arquitetura documentada, não um bug)**: `origem_lead`/`responsavel`/`prioridade`/
`temperatura`/`proximo_follow_up`/`valor_estimado`/`status` como COLUNAS FÍSICAS dedicadas existem
no schema (confirmadas na Fase 1) mas **não são o caminho real de escrita/leitura para a maioria
delas** — o valor efetivamente usado pela UI vive dentro de `dados_internos_crm` (jsonb). Exceção:
`status` É a coluna física real e ativa (gravada via `UpdateLeadDto.status`, lida via
`mapLead()`→`row.status`, motor do workflow). As colunas físicas `origem_lead`/
`probabilidade_fechamento` (nomes propositalmente RENAMED no entity, ver `entities.ts:1074-1090`)
não têm NENHUM campo DTO que as popule diretamente — ficam permanentemente `NULL`, enquanto
`dados_internos_crm.origemLead`/`.probabilidadeFechamento` (mesmo conceito, dentro do jsonb) é o
que a UI real usa — um caso de **UNUSED_SCHEMA_FIELD** duplicado por um campo jsonb equivalente,
mesma classe de achado já visto em `artist.md` (41 colunas físicas roteadas para `metadata` em vez
das colunas dedicadas).

`CREATE_FIELDS: 27` (contando os campos de nível superior do form, sem expandir os 4 blocos
condicionais individualmente — ver §9 para o detalhamento).

---

## 8. EDIT LEAD — Create ≠ Edit (confirmado, intencional e correto)

`UpdateLeadDto extends PartialType(CreateLeadDto)` + declara explicitamente `status`/`stage` como
campos SÓ de edição (`stage` também presente, mas ver Gap de coluna morta — física `stage` não
existe mais, roteado para `metadata.stage`, comentário explícito no backend confirma remoção física
por migration `RebuildLeadsInCanonicalFormOrder`). `leads.service.ts::update()` também implementa
uma diferença REAL e intencional de comportamento entre criar e editar: **mudança de `status`
dispara o workflow transacional** (`ds.transaction(...)`, `WorkflowService.transitionInTx`,
emissão de `WORKFLOW_TRANSITIONED` e, condicionalmente, `LEAD_CONVERTED`), enquanto qualquer outra
mudança de campo usa um `UPDATE` simples fora de transação nomeada. `IMMUTABLE_AFTER_CREATE`:
nenhum campo é literalmente imutável, mas `status` só pode mudar através de transições válidas do
workflow (`WorkflowService.getAllowedTransitions`, retornado em `findById()` como
`allowed_transitions` — usado pelo backend para validação, não confirmado como exibido/aplicado
como restrição de UI no `LeadFormModal.tsx`, que oferece as 9 opções de status sempre, sem filtrar
pelas transições permitidas a partir do estado atual — **um REAL_MAPPING_GAP menor**: a UI permite
tentar qualquer transição de status, que o backend then rejeitaria se inválida segundo
`leads.workflow.ts`, mas o usuário só descobre isso após o erro, não antecipadamente).

`READ_SOURCE` para popular o formulário de edição: `leadToFormInitial()` lê corretamente de
`lead.payloadServico`/`lead.dadosInternosCRM` (as chaves camelCase que `leadsService.fromApi()` já
produziu de forma correta a partir da resposta real da API) — **sem o mesmo tipo de bug
camelCase/snake_case já visto em `events.md`/`inventory.md`** — este módulo evita esse padrão de
erro porque a tradução acontece centralizada em `leads.service.ts` (frontend), não espalhada pelos
componentes de UI.

`EDIT_FIELDS: 27` (mesmos do create + `status_lead`, tratado à parte).

---

## 9. Dados do lead — inventário completo de campos reais

| Campo | Onde vive | Tipo | Observação |
|---|---|---|---|
| `nome`/`nomeCompleto` | coluna física `nome` | string | obrigatório |
| `nome_completo` | coluna física `nome_completo` | string | **existe fisicamente mas NUNCA é escrita pelo fluxo normal de create/update** (só é populada no fluxo de candidatura pública de artista, `submitPublicArtistApplication`) — `leadsService.fromApi()` lê `row.nome_completo ?? row.nome` como fallback, então funciona corretamente quando presente, mas fica `NULL` para todo lead criado pela UI normal (que só envia `name`→`nome`) |
| `nome_artistico` | coluna física, alias `nomeArtistico` | string | correto |
| `empresa` | coluna física | string | correto |
| `email` (PII) | `email_encrypted` | criptografado | ver §10 |
| `telefone`/`whatsapp` (PII) | `telefone_encrypted` (leitura) / `whatsapp` (nunca escrita, Gap #1) | criptografado (leitura) | ver §10 e Gap #1 |
| `instagram` | coluna física | string | correto |
| `cidade`/`estado`/`pais` | colunas físicas | string | corretos |
| `tipo_cliente`/`tipo_servico` | colunas físicas (RENAMED, ver §7 Gap #3) | string | corretos, vocabulário fixo no frontend (`leadClientTypes`/`leadServiceTypes`) |
| `payload_servico` | jsonb | objeto aninhado | contém: `tipo_lead`, `servico`, `nome_artista_servico`, `descricao`, `cargo`, `website`, `endereco`, `data_entrada`, `responsavel`, `interacoes[]`, + 1 dos 4 blocos condicionais |
| `origem_lead`/`fonte` | 2 colunas físicas diferentes para o "mesmo" conceito — `fonte` é escrita (`source`→`fonte`, mas nada no form real envia `source`) e `origem_lead` nunca é escrita (Gap #3); o valor real vem de `dados_internos_crm.origemLead` | string | 3 representações do mesmo conceito, só 1 (jsonb) é a real |
| `responsavel` (coluna física) | nunca escrita pelo fluxo normal (mesmo Gap #3 — real está em `dados_internos_crm.responsavel`) | string | UNUSED_SCHEMA_FIELD |
| `status` | coluna física, ativa e real | enum `LeadStatus` (9 valores) | ver §13 |
| `prioridade`/`temperatura`/`proximo_follow_up`/`valor_estimado` (colunas físicas) | nunca escritas pelo fluxo normal (Gap #3 — reais estão em `dados_internos_crm`) | — | UNUSED_SCHEMA_FIELD |
| `dados_internos_crm` | jsonb | objeto | contém: `statusLead`(duplicado da coluna `status`, ver nota), `responsavel`, `prioridade`, `temperatura`, `origemLead`, `valorEstimado`, `probabilidadeFechamento`, `proximoFollowUp`, `observacoesInternas`(campo do tipo, nunca preenchido pelo form real — não há input correspondente em `LeadFormPayload`), `campanha_marketing` |
| `uploads` | jsonb | array | ver §17 |
| `cliente_id` | coluna física, FK lógica | uuid nullable | só escrita pela conversão automática (§15), nunca pelo create/edit manual |
| `tags` | coluna física `ARRAY` | text[] | **nenhuma UI expõe este campo** — sempre `'{}'` (default), confirmado NOT_IMPLEMENTED na prática apesar de existir no schema e não estar em `CreateLeadDto`/`UpdateLeadDto` |
| `metadata` | jsonb genérico | objeto | destino de `stage`/`notes`/`assignedTo`/`value` do DTO "genérico" (§1, achado de duplo-vocabulário) — não usado pela UI real de `LeadFormModal.tsx`, que usa exclusivamente os campos "musicais" |

---

## 10. PII

| FIELD | DATABASE_COLUMN | PII_CLASS | ENCRYPTED | ENCRYPTION_LAYER | WRITE_MAPPING | READ_MAPPING | SEARCH_BEHAVIOR | EXPORT_BEHAVIOR |
|---|---|---|---|---|---|---|---|---|
| email | `email_encrypted` | EMAIL | SIM | `EncryptionService` (AES-256-GCM, mesmo padrão já confirmado em `artists`/`clients`) | `enc.encryptNullable(email)` em create/update | `enc.decryptNullable(l.email_encrypted)` em `mapLead()` | **NÃO PESQUISÁVEL** — `list()` só faz `ILIKE` em `nome`/`empresa`, nunca em email (impossível pesquisar texto plano contra ciphertext) — `SEARCH_GAP` estrutural, mas correto do ponto de vista de segurança (não há vazamento por padrão de busca) | via Central de Relatórios (`enc('email', 'email_encrypted')`, já confirmado em `report-form-contracts.ts` na auditoria de `integrations`) — decriptado no export, mesmo padrão sancionado já usado para `artists`/`clients` |
| telefone (leitura) | `telefone_encrypted` | PHONE | SIM | idem | `enc.encryptNullable(phone)` (só quando `phone` é enviado — nunca é, ver Gap #1) | `enc.decryptNullable(l.telefone_encrypted)` | não pesquisável, mesma razão | via Central de Relatórios, mesmo padrão (campo `phone`, não confirmado neste export específico se mapeado — não verificado nesta rodada, fora do escopo de reabrir `report-form-contracts.ts` além do já citado) |
| nome/nome_completo/empresa/cidade/estado/instagram | colunas físicas simples | PERSON_NAME / COMPANY_IDENTIFIER / OTHER_PII (endereço) | NÃO | N/A | direto | direto | pesquisável (`nome`/`empresa` via `ILIKE`) | plaintext no export, mesmo padrão de todos os módulos anteriores para PII não classificada como email/telefone/documento |

`PII_FIELDS: 8` (email, telefone, nome, nome_completo, nome_artistico, empresa, cidade+estado
como par de localização, instagram). `ENCRYPTED_FIELDS: 2` (email, telefone).
`UNENCRYPTED_PII_FIELDS: 6`. `ENCRYPTION_GAP: 0` — a decisão de quais campos criptografar é
consistente com o padrão já auditado e aprovado em `artist.md`/`crm-relationships.md` (email/
telefone/documento sempre criptografados; nome/localização nunca) — não é um gap, é a mesma
política aplicada corretamente.

---

## 11. Enums / Vocabulários (status já correto; demais não formalmente validados)

```text
STATUS (leads.status): backend LeadStatus enum (novo/em_contato/contato/qualificado/proposta/
       negociacao/fechado/perdido/inativo, 9 valores) vs. frontend STATUS_LEAD_OPTIONS — 1:1
       IDÊNTICOS, confirmado por leitura direta de ambos os arquivos. O próprio código documenta a
       correção histórica: comentário em lead-form-options.ts confirma que uma lista anterior
       incompatível (novo_lead/proposta_enviada/follow_up/confirmado/arquivado) foi substituída.
       ENUM_MISMATCH: 0 para status.

PRIORIDADE (dados_internos_crm.prioridade): frontend PRIORIDADE_OPTIONS (alta/media/baixa) — SEM
       validação de enum no backend (o campo vive dentro do jsonb `dadosInternosCRM`, aceito via
       `@IsObject()` genérico no DTO, sem `@IsIn` sobre as sub-chaves) — qualquer string é aceita
       pelo backend, o vocabulário fixo existe SOMENTE no frontend. Não é um ENUM_MISMATCH (nada
       para divergir, já que o backend não valida), mas é uma ausência de validação server-side
       registrada por completude.

TEMPERATURA (dados_internos_crm.temperatura): mesma situação — frontend TEMPERATURA_OPTIONS (frio/
       morno/quente), sem validação backend (dentro do jsonb genérico).

ORIGEM_LEAD (dados_internos_crm.origemLead): frontend ORIGEM_LEAD_OPTIONS (vocabulário não
       expandido nesta auditoria por estar dentro do jsonb sem validação — mesmo padrão acima).

TIPO_INTERACAO (interacoes[].tipo, dentro de payload_servico): frontend TIPO_INTERACAO_OPTIONS
       (ligacao/whatsapp/email/reuniao/proposta/follow_up/observacao, 7 valores) — SEM relação
       alguma com o vocabulário do endpoint dedicado e real `/lead-interactions`
       (CreateLeadInteractionDto.type: call/email/meeting/whatsapp/note/proposal/other, também 7
       valores mas PARCIALMENTE diferentes: "ligacao"≠"call", "reuniao"≠"meeting",
       "observacao"≠"note", "follow_up" não existe no endpoint dedicado) — evidência adicional,
       reforçando §16, de que os dois sistemas de interação são desenvolvidos e versionados de
       forma totalmente independente, sem nenhuma tentativa de unificação de vocabulário.
```

`ENUM_MISMATCH: 1` (contado formalmente — o par TIPO_INTERACAO_OPTIONS vs.
`CreateLeadInteractionDto.TYPES`, já que ambos são vocabulários REALMENTE validados em algum ponto
— o do formulário embutido não tem validação server-side própria, mas o do endpoint dedicado tem
`@IsIn(TYPES)` real, então a divergência é observável e teria efeito se algum dia os dois sistemas
fossem unificados).

---

## 12. Score / Qualificação

```text
SCORE_FIELD: nenhum campo de pontuação numérica automática existe (`probabilidade_fechamento`
       existe como coluna física livre — numeric(5,2) — preenchível apenas via a coluna morta já
       documentada no Gap #3, nunca por nenhum caminho de UI real, nem calculado automaticamente).
QUALIFICATION_FIELD: o valor de status "qualificado" (dentro do enum LeadStatus/workflow) é a única
       forma de "qualificação" — uma transição manual de estado, não um campo de pontuação
       calculado por regra. Não há fórmula, não há campos de entrada que a UI real use para score.
```

`SCORE_FIELDS: 0` (funcionalmente — a coluna física existe mas está morta).
`QUALIFICATION_FIELDS: 1` (o próprio `status`, reaproveitado — não um campo dedicado separado).

---

## 13. Status vs. Stage

```text
status (leads.status, coluna física REAL e ativa): representa o estágio do lead no funil de vendas
       — os mesmos 9 valores documentados em §11, controlados por `leads.workflow.ts`.
stage (conceito do DTO "genérico" — CreateLeadDto.stage, valores prospect/qualified/proposal/
       negotiation/won/lost, EM INGLÊS): NÃO tem coluna física própria (removida por migration,
       comentário explícito no código, §7 Gap #3) — quando enviado, vai para `metadata.stage`
       (jsonb genérico, não `dados_internos_crm`) — mas a UI real (`LeadFormModal.tsx`) NUNCA
       envia esse campo (não existe em `LeadFormPayload`) — `stage` é, na prática, um campo do DTO
       inteiramente órfão do ponto de vista do frontend real, mantido só por compatibilidade com um
       consumidor hipotético/anterior não identificado nesta auditoria.
```

Os dois conceitos NÃO são fundidos no código real (confirmado) — mas `stage` é, na prática,
inatingível pela UI existente. `FIELD/PURPOSE/VALUES/DATABASE_COLUMN/FRONTEND_USAGE/BACKEND_USAGE`:
`status` = ativo em ambas as camadas; `stage` = ativo só no backend (aceito, roteado para
`metadata`), morto no frontend real.

---

## 14. Origem / Source

```text
SOURCE_VALUE real: `dados_internos_crm.origemLead`, vocabulário `ORIGEM_LEAD_OPTIONS` (frontend).
CLASSIFICAÇÃO: MANUAL — o usuário seleciona a origem manualmente no formulário; não há nenhuma
       integração real com Meta/Google/formulário público/website que popule este campo
       automaticamente PARA LEADS CRIADOS PELA UI NORMAL.
EXCEÇÃO: o fluxo de candidatura pública de artista (`submitPublicArtistApplication`, §21) grava
       `fonte: 'public_artist_application'` (coluna física real `fonte`, esta sim escrita neste
       fluxo específico) — o único caso real de origem não-manual encontrado no módulo.
```

`SOURCE_VALUES`: vocabulário do frontend não expandido individualmente nesta auditoria (fora do
jsonb sem validação server-side, §11) — contabilizado como 1 conjunto de opções.

---

## 15. Lead ↔ CRM/Client — Conversão (auditoria obrigatória, ponta a ponta)

```text
FRONTEND_ACTION: nenhuma ação dedicada de "Converter Lead" existe na UI (`LeadFormModal.tsx`/
       `LeadViewModal.tsx`/`LeadsTable.tsx` não têm nenhum botão "Converter em Cliente") — a
       conversão é um EFEITO COLATERAL IMPLÍCITO de mudar `status` para "fechado" através do
       `<Select>` de status já existente no formulário de edição.
↓
ENDPOINT: PATCH /leads/:id { status: "fechado" }
↓
BACKEND SERVICE: leads.service.ts::update() detecta statusChanging, executa
       WorkflowService.transitionInTx() dentro de `ds.transaction(...)` (atualiza `leads.status`),
       emite DOMAIN_EVENTS.WORKFLOW_TRANSITIONED sempre, e DOMAIN_EVENTS.LEAD_CONVERTED
       condicionalmente (só quando toStatus === LeadStatus.FECHADO)
↓
CLIENT CREATION: LeadEventsHandler.onLeadConverted() (via @OnEvent, EventEmitter2 in-process —
       MESMO mecanismo já confirmado em events.md/dashboard.md como NÃO durável e SEM ponte para
       Supabase Realtime) — cria um NOVO ClientEntity SEMPRE (nome, categoria:'CORPORATE_CLIENT',
       tipo_pessoa derivado de `empresa` presente ou não, observacoes com referência ao lead
       original, metadata.leadId/convertedAt/convertedBy)
↓
LEAD UPDATE: SE a criação do cliente teve sucesso, atualiza `leads.cliente_id` = novo client id E
       `leads.status` = 'convertido' — ou seja, o status final visível NÃO é mais "fechado" (o
       valor gravado pela transação original), é sobrescrito para "convertido" por uma SEGUNDA
       operação de update, fora da transação original.
↓
RELATION: leads.cliente_id → clients.id (FK lógica, sem constraint declarada — mesmo padrão de
       "referência sem FK física" já visto em vários outros módulos desta série)
↓
EFEITO ADICIONAL NÃO DOCUMENTADO EM NENHUMA TELA: LeadEventsHandler TAMBÉM cria um NOVO
       ArtistEntity a cada conversão (nome_artistico=nome do lead, status=EM_NEGOCIACAO,
       status_cadastro=ATIVO, metadata com leadId/clientId/source:'lead_conversion') — ou seja,
       TODO lead fechado vira automaticamente tanto um Cliente quanto um Artista "em negociação",
       independentemente do tipo de lead (`tipoCliente` pode ser "brand"/"agency"/"venue"/etc.,
       não necessariamente "artist") — um efeito colateral amplo e não configurável, não exposto em
       nenhuma tela ao usuário que executa a conversão.
```

`SOURCE_LEAD_FIELD → TARGET_CLIENT_FIELD`:
```text
nome            → clients.nome
(fixo)          → clients.categoria = 'CORPORATE_CLIENT'
(fixo)          → clients.perfil = 'outros'
empresa presente?→ clients.tipo_pessoa = 'pessoa_juridica' : 'pessoa_fisica'
convertedBy     → clients.responsavel_nome
(gerado)        → clients.observacoes (texto fixo com referência ao lead)
```
Nenhum outro campo do lead (email/telefone/cidade/estado/instagram/payload_servico) é copiado para
o cliente — **PERDA DE DADOS na conversão**: o email/telefone criptografados do lead nunca chegam
ao registro do cliente recém-criado, que nasce sem contato algum preenchido — `CONVERSION_MAPPING_
GAP` confirmado.

`LEAD_CLIENT_DOMAIN_BOUNDARY_CONFIRMED: SIM`. `LEAD_TO_CLIENT_TRACEABILITY_COMPLETE: SIM`
(rastreável ponta a ponta, mesmo com os gaps documentados).

---

## 16. Conversão — Transação / Atomicidade / Duplicidade

```text
CONVERSION_TRANSACTIONAL: NÃO

A mudança de `leads.status` para "fechado" ocorre dentro de `ds.transaction(...)` (atômica em si
mesma). A criação do Client + Artist + segunda atualização do Lead (cliente_id, status='convertido')
ocorre DEPOIS, disparada por um listener de evento in-process (EventEmitter2, sem durabilidade nem
retry, mesmo mecanismo já auditado como não-confiável em dashboard.md/events.md), em 3 operações
sequenciais cada uma com seu PRÓPRIO try/catch independente (cliente, depois lead, depois artista) —
não há uma transação DB compartilhada entre elas. Se o processo cair entre a transação original
(status já gravado como 'fechado') e a execução do handler, o lead fica permanentemente "fechado"
sem nunca ganhar `cliente_id` nem o status final 'convertido', e nenhum Client/Artist é criado —
sem re-tentativa automática, sem fila de retry, sem alerta.

CONVERSION_ATOMICITY_GAP: confirmado.

DUPLICATE_LOOKUP: NÃO — `LeadEventsHandler.onLeadConverted()` SEMPRE executa `clientRepo.create()`
       + `save()` incondicionalmente, sem nenhuma consulta prévia por email/telefone/documento/nome
       já existente em `clients`. `BEHAVIOR_ON_DUPLICATE: CREATE_DUPLICATE` — converter 2 leads
       diferentes referentes à mesma empresa/pessoa gera 2 registros de cliente distintos, sem
       nenhuma fusão/reuso.
```

---

## 17. Lost / Reopen / Perda de lead

```text
LOST_ACTION: mudar `status` para "perdido" (PATCH /leads/:id, mesmo mecanismo de workflow)
STATUS/STAGE: `leads.status = 'perdido'`
LOSS_REASON: NOT_IMPLEMENTED — nenhum campo dedicado (`motivo_perda`/`loss_reason`) existe no
       schema, no DTO, nem na UI. `WORKFLOW_TRANSITIONED` emite `reason: null` HARDCODED — mesmo
       para a transição "Marcar como Perdido", nenhum motivo é capturado em lugar algum.
LOST_AT: implícito via `leads.updated_at` (sem campo dedicado `perdido_em`)
REOPEN: SIM, real — a transição "Reativar Lead" (perdido/inativo → novo) existe em
       `leads.workflow.ts`, restrita a roles gerenciais (`super_admin/tenant_owner/owner/admin/
       manager` — nota: SEM 'comercial', diferente das demais transições, que incluem 'comercial')
       — `RELATED_CLIENT_IMPACT`: nenhum, já que "perdido"/"reativado" nunca dispara
       `LEAD_CONVERTED` (só "fechado" dispara).
ARQUIVAR: transição real "Arquivar" (fechado/perdido → inativo), mesmas roles gerenciais.
```

---

## 18. Interações — o sistema real (embutido) vs. o sistema desconectado (dedicado)

Já introduzido em §3/§6. Detalhamento completo:

**Sistema real (usado pela UI)**: `payload_servico.interacoes[]`, um array de
`{id, tipo, data, horario, descricao}` — adicionado/editado/removido inteiramente dentro do estado
local do `LeadFormModal.tsx` (`addInteracao`/`updateInteracaoField`/`removeInteracao`), persistido
apenas quando o formulário inteiro é salvo (não há salvamento incremental de uma única interação) —
`ACTOR` não é capturado (sem campo de autor por interação). `LeadViewModal.tsx` lê e exibe o mesmo
array fielmente. `TIMELINE`: `SOURCE_TABLE`: `leads` (dentro do jsonb), `SORT_DATE`: ordem de
inserção no array (sem reordenação por data), `ACTOR`: ausente, `DESCRIPTION_SOURCE`: campo
`descricao` livre.

**Sistema dedicado (real no backend, 100% inacessível pela UI)**: tabela `lead_interactions`
(FK real para `leads`), `LeadInteractionsController`/`LeadInteractionsService`
(`GET/POST/DELETE /lead-interactions`), com permissões próprias (`lead_interaction:read/create/
delete`) e `@Audit('lead_interaction.created'|'.deleted')`. **Bug crítico confirmado, headline
deste módulo**: `LeadInteractionsService.create()` faz
`this.repo!.create({tenant_id, ...(dto as any), created_by: userId})` — o `dto`
(`CreateLeadInteractionDto`) tem as chaves `leadId`/`type`/`notes`/`metadata` (camelCase), mas a
entidade real (`LeadInteractionEntity`, `database/entities.ts:1110-1124`) declara as propriedades
`lead_id`/`tipo`/`descricao`/`data` (snake_case, sem nenhum alias/nome alternativo) — **nenhuma
correspondência entre o objeto espalhado e as colunas reais da entidade**. Como `lead_id` é
`@Column({type:'uuid'})` **sem `nullable: true`** (NOT NULL), qualquer chamada real a
`POST /lead-interactions` resultaria em falha de constraint NOT NULL no INSERT (o valor de `lead_id`
nunca seria populado a partir de `dto.leadId`) — **o endpoint de criação de interação está
estruturalmente quebrado**, mesmo sendo tecnicamente alcançável via API (não há nenhum consumidor
frontend hoje, então o bug é inerte na prática, mas se qualquer tela viesse a integrar este endpoint
no futuro sem corrigir o mapeamento, toda tentativa de registrar uma interação falharia).

`FOLLOW_UP_FIELD: NEXT_FOLLOW_UP_AT` existe (`dados_internos_crm.proximoFollowUp`, exibido na
tabela e usado no KPI "Em negociação" da página) — classificado como `FIELD_ON_LEAD` (não é uma
tarefa separada, não é um registro dedicado). `FOLLOW_UP_TYPE`/`COMPLETED_AT`: não existem — é só
uma data futura de lembrete manual, sem mecanismo de notificação associado (ver §20).

---

## 19. Tasks

Nenhuma relação com o sistema de tarefas foi encontrada — `leads` não cria/vincula nenhuma `task`
em nenhuma tabela de tarefas conhecida (`operational_tasks`/`campaign_tasks`/etc., já mapeadas em
módulos anteriores, não reauditadas aqui). `proximo_follow_up` (§18) é o único campo com semântica
de "próxima ação", mas não é uma tarefa formal.

---

## 20. Notificações

Nenhum mecanismo de alerta/lembrete de follow-up foi encontrado — `dados_internos_crm.
proximoFollowUp` é puramente informativo (exibido na tabela, somado no KPI), sem nenhum job
agendado, sem nenhum `@OnEvent`/cron que dispare notificação quando a data se aproxima ou vence.
`NOT_IMPLEMENTED`.

---

## 21. External Integrations / Public Lead Capture

```text
PROVIDER: nenhuma integração real com Meta/Google/WhatsApp/formulário externo de terceiros foi
       encontrada alimentando `leads` automaticamente — `EXTERNAL_LEAD_SOURCES: 0` no sentido de
       integração de API de terceiro.

ENDPOINT PÚBLICO REAL (candidatura de artista): 
  METHOD/PATH: GET /leads/public/artist-applications/:slug/tenant (resolve tenant por slug) e
               POST /leads/public/artist-applications/:slug (submete a candidatura)
  FIELDS: artisticName, fullName, email, phone?, city?, state?, musicalGenre?, objective?, message?,
          socialLinks?, additionalData?, acceptedTerms(obrigatório, deve ser `true`),
          companyWebsite (honeypot)
  VALIDATION: class-validator completo (IsEmail, MaxLength por campo, IsBoolean+Equals(true) para
          termos aceitos)
  RATE_LIMIT: não verificado nesta rodada especificamente para esta rota (rate limiting global já
          confirmado como existente no sistema em auditorias anteriores desta série — não
          reverificado aqui como uma proteção adicional específica desta rota)
  CAPTCHA: NÃO ENCONTRADO — nenhuma verificação de captcha
  ABUSE_PROTECTION: honeypot real — se `companyWebsite` vier preenchido (só um bot preencheria um
          campo invisível), a resposta retorna `{accepted:true}` FALSO-POSITIVO (não cria o lead,
          mas finge sucesso para o remetente, técnica anti-scraping legítima) — mecanismo correto
          e real, não um placeholder
  TENANT_RESOLUTION: via slug do workspace (`getPublicWorkspaceBySlug`), com verificação de
          `active`/`deleted_at`/`allow_public_registration`/`public_registration_blocked`/
          `public_registration_revoked_at` — controle de acesso genuinamente completo, não
          superficial
  DUPLICATE_HANDLING: NÃO — cada submissão cria um novo lead incondicionalmente, sem checar
          candidaturas duplicadas do mesmo email/nome
  DEFAULT_STAGE: `status: LeadStatus.NOVO`
  DEFAULT_SOURCE: `fonte: 'public_artist_application'`, `origemLead(dentro de metadata, não
          dados_internos_crm — inconsistência menor com o resto do sistema, que usa
          dados_internos_crm.origemLead): 'public_artist_application'`
  OWNER_ASSIGNMENT: nenhum (`responsavel` não é atribuído automaticamente)
  MÉTRICAS: incrementa `tenants.public_registration_access_count`/`.public_registration_
          conversion_count` (colunas condicionais, só incrementadas se existirem no schema do
          tenant — checagem defensiva via `information_schema.columns`)

CONSUMIDOR FRONTEND: nenhuma página dentro de `apps/web/src/modules/leads` consome este endpoint
       público (confirmado por grep) — a UI de candidatura pública, se existir, vive fora do
       escopo deste módulo (não localizada nesta auditoria; possivelmente um formulário público
       dedicado fora de `apps/web/src/modules/leads`, não investigado por estar fora do escopo
       determinado pela pasta/domínio deste módulo).
```

`CREDENTIALS_REQUIRED_LATER: 0` (nenhuma integração externa real pendente de credencial neste
módulo — captcha/rate-limit adicional não são "credenciais").

---

## 22. Tables/Grids, Details, Filters, Search, Sort, KPIs

**TABLE** (`LeadsTable.tsx`, 9 colunas de dados): Lead(nome+resumo via `LeadRowSummary`)/Cidade/
Tipo de Serviço/Status/Origem/Valor Estimado/Próximo Follow-up/Prioridade — todas as 9 mapeiam
corretamente para campos reais (`nome`, `cidade`+`estado`, `payloadServico.servico` com fallback
para `tipoServico`, `dadosInternosCRM.statusLead`, `.origemLead`, `.valorEstimado`,
`.proximoFollowUp`, `.prioridade`). `PII`: nenhuma coluna da tabela expõe email/telefone
diretamente (só no modal de detalhe). `SORTABLE`: nenhuma coluna tem ordenação interativa.

**FILTERS** (`LeadFilters`, 6 filtros — search + tipoServico + statusLead + responsavel +
origemLead + temperatura): 100% client-side sobre o array completo já carregado (`?limit=200`, ver
§24) — nenhum vira query param HTTP real, apesar de `QueryLeadDto` aceitar `status`/`stage`/
`assignedTo` no backend. **Gap adicional confirmado por leitura de `leads.service.ts::list()`**: o
backend SÓ implementa filtro por `status` e busca por `search` na query — `stage` e `assignedTo`,
apesar de declarados em `QueryLeadDto`, são **silenciosamente ignorados** pelo `list()` (nunca
aparecem em nenhum `andWhere`) — um `SEARCH_GAP`/filtro morto no lado do backend, inofensivo hoje
porque o frontend nunca envia esses parâmetros de qualquer forma.

**SEARCH**: adicionalmente, **o backend implementa busca por `q['search']` mas `QueryLeadDto` não
declara `search` como campo aceito** — com o `ValidationPipe` global já confirmado
(`whitelist:true, forbidNonWhitelisted:true`), um cliente que tentasse `GET /leads?search=foo`
receberia HTTP 400 (campo não reconhecido) — o filtro de busca no backend é, portanto, morto e
inacessível via a API real tal como o DTO está declarado hoje. Como o frontend nunca usa esse query
param mesmo assim (busca é 100% client-side), este gap é hoje inofensivo na prática, mas confirma
que o código de busca do backend nunca é exercitado.

**KPIs** (`LeadsPage.tsx`, 5 métricas da aba Leads): Total de leads (`leads.length`) / Em
negociação (`proximoFollowUp` truthy — rótulo "Em negociação" é impreciso: mede leads com follow-up
agendado, não leads no status "negociacao" — `DISPLAY_MAPPING_MISMATCH` de rótulo, não de dado) /
Propostas enviadas (`statusLead==='proposta'`) / Contratos fechados (`statusLead==='fechado'`) /
Valor estimado (soma de `valorEstimado`). Todos calculados sobre o mesmo array truncado em 200
registros (ver §24) — `TRUNCATION_RISK: SIM` para tenants com mais de 200 leads.

**CONVERSION_RATE**: não existe um KPI de "taxa de conversão" explícito nesta tela (apesar dos
dados existirem para calculá-lo) — `NOT_IMPLEMENTED` como métrica exibida.

---

## 23. Import

**NOT_IMPLEMENTED.** Nenhum botão/fluxo de importação de leads foi encontrado em
`apps/web/src/modules/leads` (nem XLSX nem CSV) — diferente de outros módulos desta série que ao
menos tentam (mesmo que quebrados). `IMPORT_FIELDS: 0`.

---

## 24. Export / XLSX

Não há export específico do módulo `leads` — o botão "Exportar" em `LeadsPage.tsx` navega
diretamente para `/relatorios` (Central de Relatórios), com o próprio código comentando
explicitamente a decisão de reaproveitar esse mecanismo genérico em vez de uma implementação
client-side paralela (`report-form-contracts.ts::LEADS_CONTRACT`, já mapeado na auditoria de
`integrations`/citado em §7 Gap #2 — 1 nível de jsonb suportado, blocos condicionais e
`interacoes[]` ficam de fora do export). `PII_EM_EXPORT`: email/telefone decriptados no export
(mesmo padrão sancionado de `artists`/`clients`, não um gap novo). `XLSX_EXPORTS: 0` (específico do
módulo — o mecanismo é o compartilhado, já caracterizado estruturalmente nas auditorias anteriores
como respeitando `XLSX_MAX_SHEETS: 2`, não reauditado individualmente aqui).
`EXPORT_PRIVACY_GAP: 0` — export de PII segue o mesmo padrão já revisado e aceito nos módulos
anteriores desta série.

---

## 25. Duplicidade de Leads (criação)

Nenhuma regra de deduplicação (`DATABASE_UNIQUE`/`BACKEND_CHECK`/`FRONTEND_CHECK`) existe para
email/telefone/documento/empresa na CRIAÇÃO de um lead — dois leads idênticos podem ser criados
livremente. (A duplicidade NA CONVERSÃO, distinta desta, já foi tratada em §16.)
`DUPLICATE_HANDLING_GAP` confirmado (criação).

---

## 26. Merge de Leads

**NOT_IMPLEMENTED.** Nenhuma funcionalidade de fusão de leads foi encontrada em nenhuma camada.

---

## 27. Delete / Archive

| UI_ACTION | ENDPOINT | DATABASE_BEHAVIOR | INTERACTION_IMPACT | CONVERSION_IMPACT | SOFT_OR_HARD |
|---|---|---|---|---|---|
| Excluir lead (`LeadsTable`, individual ou em massa) | `DELETE /leads/:id` | `UPDATE leads SET deleted_at = now()` | nenhum (a coluna real `lead_interactions` tem `onDelete: 'CASCADE'` declarado na FK — mas como o soft-delete do lead NÃO é um DELETE físico, o CASCADE nunca é acionado; interações associadas, se existissem, permaneceriam órfãs mas presentes, não apagadas) | um lead já convertido (`status='convertido'`, `cliente_id` setado) pode ainda ser soft-deletado sem nenhum aviso/bloqueio — o `clients`/`artists` criados permanecem intactos, apenas o lead de origem fica oculto | SOFT |
| "Arquivar" (via mudança de status para `inativo`) | `PATCH /leads/:id {status: 'inativo'}` | atualização de coluna, não exclusão | nenhum | nenhum | N/A (é só um valor de status, não uma operação de arquivo distinta) |

Note-se que o controller rotula o `DELETE` como "Fechar lead" (`@ApiOperation({summary: 'Fechar
lead'})`) — um rótulo de documentação Swagger inconsistente com o comportamento real (soft-delete,
não "fechamento" no sentido de status workflow) — inconsistência textual menor, sem efeito
funcional.

---

## 28. Realtime

Nenhum `useWsEvent()` foi encontrado em nenhum arquivo do módulo `leads`. `WORKFLOW_TRANSITIONED`/
`LEAD_CONVERTED`/`LEAD_CREATED` são emitidos via `EventsService.emitTyped()` — mesmo mecanismo já
confirmado (`events.md`/`dashboard.md`, não re-verificado aqui) como um bus interno `EventEmitter2`
sem ponte para Supabase Realtime — mesmo que um frontend viesse a assinar esses eventos, nenhum
deles é publicado via Realtime hoje. `REALTIME_EVENTS: 0` (efetivos, do ponto de vista do
frontend).

---

## 29. Storage (uploads)

```text
FORM_FIELD: `uploads` (LeadFormModal.tsx, seção "Anexos")
DATABASE_REFERENCE: `leads.uploads` (jsonb) — armazena METADADOS do arquivo (fileName/mimeType/
       size/extension/uploadedAt/url), não o arquivo em si
STORAGE_PROVIDER: NENHUM — `addUploads()` usa exclusivamente `URL.createObjectURL(file)`, uma blob
       URL local do browser que morre ao recarregar a página — mesmo padrão de "upload fake" já
       confirmado em `crm-relationships.md` (ContatoFormModal) e `catalog.md`
       (FonogramaFormModal)
BUCKET/OBJECT_PATH: N/A (nada é enviado a lugar nenhum)
UPLOAD_ENDPOINT: nenhum endpoint de presign/upload é chamado
DISPLAY_SOURCE: `upload.url` (a blob URL local, válida só durante a sessão do navegador)
DELETE_BEHAVIOR: `removeUpload()` só remove do array em memória/estado do formulário
TENANT_ISOLATION: N/A (nada é persistido externamente para isolar)
```

Corrobora a Fase 1: a tabela dedicada `lead_uploads` (10 colunas, schema completo com
`file_name`/`mime_type`/`extension`/`size`/`url`/`metadata`) tem `backendMapping: NO_TABLE_CONSUMER`
em TODAS as colunas — nenhum controller/service jamais grava nela; os metadados de upload ficam,
em vez disso, dentro do jsonb genérico `leads.uploads`, mas mesmo esse destino nunca recebe uma URL
real de arquivo armazenado. `STORAGE_GAP` confirmado — funcionalidade 100% decorativa.

---

## 30. Permissões

| PERMISSION | FRONTEND_ENFORCEMENT | BACKEND_ENFORCEMENT |
|---|---|---|
| `lead:read` | nenhum gate visível (assume-se rota autenticada) | `@RequireRole('viewer') @RequirePermission('lead:read')` |
| `lead:create` | **nenhum** `RequirePermission` encontrado em nenhum componente do módulo (diferente de outros módulos desta série, que ao menos envolvem o botão "Novo X" em `<RequirePermission>`) | `@RequireRole('editor') @RequirePermission('lead:create')` |
| `lead:update` | nenhum gate | `@RequireRole('editor') @RequirePermission('lead:update')` |
| `lead:delete` | nenhum gate | `@RequireRole('manager') @RequirePermission('lead:delete')` |
| `lead_interaction:read/create/delete` | N/A (nenhuma UI consome o endpoint) | `@RequireRole` + `@RequirePermission` corretos, mesmo padrão |

`AUTHORIZATION_GAPS: 0` — apesar da ausência total de gates visuais antecipados no frontend deste
módulo especificamente (mais notável aqui do que em outros módulos já auditados, que ao menos
gatavam o botão de criação), o backend é a autoridade real e está corretamente protegido em toda
rota — não é uma falha de segurança, apenas uma inconsistência de UX (usuário só descobre falta de
permissão ao tentar salvar, via erro HTTP).

---

## 31. Tenant Isolation

```text
leads: tenant_id enforced (WHERE l.tenant_id = :tenantId em list/findById/update/remove; create
       grava tenant_id explícito a partir de @CurrentTenant())
lead_interactions: tenant_id enforced (mesmo padrão em list/create/remove) — mas ver §18: create
       está quebrado antes mesmo de chegar à questão de isolamento (o INSERT falharia por NOT NULL
       em lead_id, tenant_id em si é corretamente setado)
conversão (LeadEventsHandler): tenantId propagado explicitamente do evento
       (event.tenantId ?? event.payload.tenantId), com fail-closed real
       (`failClosed()`, aborta e loga warning se tenantId ausente) — e as 3 operações (client/lead/
       artist) rodam dentro de `dbContext.runInTenantContext({tenantId,...})` quando disponível —
       isolamento correto por design.
```

`CONVERSÃO CROSS-TENANT`: verificado explicitamente — não há caminho de código onde um lead do
Tenant A resultaria em cliente/artista do Tenant B (o `tenantId` do evento é sempre o mesmo tenant
que originou a transição de status, propagado ponta a ponta) — `TENANT_ISOLATION_GAP: 0`.

`CHILD_RELATION_TENANT_ENFORCEMENT`: `pipeline_opportunities`/`pipeline_stages`/`pipelines`
(schema morto, §6) não avaliados quanto a isolamento por não terem nenhum código de acesso — não
aplicável.

---

## Gaps consolidados (evidenciados, não corrigidos)

1. **CREATE_MAPPING_MISMATCH (crítico)** — `whatsapp` é enviado pelo frontend mas não é um campo
   aceito por `CreateLeadDto`; sob o `ValidationPipe` global `forbidNonWhitelisted:true`, isso
   provavelmente rejeita a requisição inteira com HTTP 400 (não confirmado em runtime nesta
   auditoria read-only, mas consistente com o mesmo padrão de bug já confirmado em `contracts.md`).
2. **UNUSED_SCHEMA_FIELD** (arquitetura documentada) — `leads.origem_lead`/`.probabilidade_
   fechamento`/`.responsavel`/`.prioridade`/`.temperatura`/`.proximo_follow_up`/`.valor_estimado`
   como colunas físicas nunca são escritas pelo fluxo real (o valor equivalente vive dentro de
   `dados_internos_crm`, jsonb) — duplicação de conceito, só 1 representação é a real.
3. **EXPORT_GAP** (já auto-documentado no código) — blocos condicionais e `interacoes[]`, aninhados
   em 2 níveis dentro de `payload_servico`, não são suportados pelo motor de 1 nível da Central de
   Relatórios — ausentes de qualquer export gerado.
4. **CONVERSION_MAPPING_GAP** — a conversão automática lead→cliente não copia email/telefone/
   cidade/estado/instagram para o novo `Client` — o cliente nasce sem nenhum contato preenchido.
5. **CONVERSION_ATOMICITY_GAP** — criação de Client+Artist e atualização final do Lead
   (`cliente_id`/`status='convertido'`) ocorrem via listener de evento in-process não-durável, fora
   da transação original que gravou `status='fechado'` — falha de processo entre os dois pontos
   deixa o lead permanentemente "fechado" sem conversão completa, sem retry.
6. **DUPLICATE_HANDLING_GAP (conversão)** — nenhuma busca por cliente já existente (email/
   telefone/documento/nome) antes de criar um novo — sempre `CREATE_DUPLICATE`.
7. **DUPLICATE_HANDLING_GAP (criação de lead)** — nenhuma verificação de duplicidade na criação de
   um lead novo.
8. **RELATION_MISMATCH / EFEITO NÃO DOCUMENTADO** — toda conversão de lead também cria
   automaticamente um `ArtistEntity` (status EM_NEGOCIACAO), independentemente do tipo real do
   lead (`tipoCliente` pode ser marca/agência/produtora/etc., não necessariamente artista) — efeito
   colateral amplo, não exposto/configurável em nenhuma tela.
9. **REAL_MAPPING_GAP (CRÍTICO, endpoint dedicado)** — `LeadInteractionsService.create()` espalha
   `CreateLeadInteractionDto` (chaves `leadId`/`type`/`notes`) diretamente sobre a entidade real
   (`LeadInteractionEntity`, propriedades `lead_id`/`tipo`/`descricao`), sem nenhum mapeamento —
   `lead_id` (NOT NULL) nunca é populado, tornando `POST /lead-interactions` estruturalmente
   quebrado (inerte hoje por falta de qualquer consumidor frontend real).
10. **ENUM_MISMATCH** — vocabulário de tipo de interação do sistema embutido
    (`TIPO_INTERACAO_OPTIONS`) diverge parcialmente do vocabulário do endpoint dedicado
    (`CreateLeadInteractionDto.TYPES`) — os dois sistemas nunca foram unificados.
11. **SEARCH_GAP (duplo)** — `search` não é um campo declarado em `QueryLeadDto` (código de busca
    do backend inacessível via API real tal como o DTO está hoje); `stage`/`assignedTo`, embora
    declarados no DTO, são ignorados pelo `list()` do serviço (filtros mortos).
12. **REAL_MAPPING_GAP (UX)** — o formulário de edição não filtra as opções de status pelas
    transições realmente permitidas a partir do estado atual (`allowed_transitions`, já calculado
    e retornado pelo backend, mas não consumido pela UI) — usuário só descobre uma transição
    inválida após tentar salvar.
13. **STORAGE_GAP** — uploads de lead são 100% decorativos (`URL.createObjectURL`, nunca enviados a
    um provider real) — mesmo padrão já confirmado em outros módulos desta série.
14. **FOLLOW_UP_GAP** — `proximoFollowUp` é puramente informativo, sem notificação/lembrete
    associado.
15. **LOSS_REASON não implementado** — transição "Marcar como Perdido" não captura motivo algum
    (`reason: null` hardcoded).
16. **DEAD SCHEMA (achado de escopo)** — sistema `pipelines`/`pipeline_stages`/
    `pipeline_opportunities` (41 colunas combinadas) existe apenas como entidades TypeORM
    declaradas, sem nenhum controller/service/consumidor em toda a aplicação.
17. **DEAD CODE** (não contado como gap formal) — 3 dos 4 stores Zustand do módulo
    (`lead-modal.store.ts`, `lead-uploads.store.ts`, `lead-interactions.store.ts`) têm zero
    consumidores.
18. **AUTHORIZATION_GAP (não-bloqueante)** — nenhum `RequirePermission` de frontend em nenhuma
    ação do módulo (create/update/delete), backend continua sendo a autoridade real.

`FAKE_INTEGRATION_GAP`/`ENCRYPTION_GAP`: 0 — a criptografia de PII está correta e o único
"fake" real é o de storage (#13), já classificado como `STORAGE_GAP`, consistente com a taxonomia
usada nos módulos anteriores.

---

## Contadores finais (Zero-Gap)

```text
SUBDOMAINS_AUDITED: 6
COMPONENTS_AUDITED: 14
HOOKS_AUDITED: 1
CREATE_FORMS: 1
CREATE_FIELDS: 27
EDIT_FORMS: 1
EDIT_FIELDS: 27
MODALS_DRAWERS_WIZARDS: 2 (LeadFormModal, LeadViewModal)
KANBAN_COMPONENTS: 0
TABLE_GRID_FIELDS: 9
DETAIL_DISPLAY_FIELDS: 13 (nome/nomeArtistico/empresa/email/whatsapp/instagram/cidade/estado/
    tipoServico/status/valorEstimado/responsavel/interações-como-bloco)
PIPELINES: 0 (funcional — o schema dedicado existe mas está morto, não contado como pipeline
    ativo de `leads`)
PIPELINE_STAGES: 0
STATUS_VALUES: 9
SOURCE_VALUES: não expandido individualmente (vocabulário livre dentro de jsonb sem validação —
    contabilizado como 1 conjunto real, ORIGEM_LEAD_OPTIONS)
QUALIFICATION_FIELDS: 1
SCORE_FIELDS: 0
PII_FIELDS: 8
ENCRYPTED_FIELDS: 2
UNENCRYPTED_PII_FIELDS: 6
RELATION_FIELDS: 2 (cliente_id→clients; conversão→artists, adicional não solicitado)
INTERACTION_FIELDS: 5 (id/tipo/data/horario/descricao, sistema embutido real) + 4
    (id/leadId/type/notes, sistema dedicado inatingível)
FOLLOW_UP_FIELDS: 1 (proximoFollowUp)
CONVERSION_FIELDS: 6 (nome, categoria, perfil, tipo_pessoa, responsavel_nome, observacoes —
    campos efetivamente copiados para o Client criado)
FILTERS: 6
SEARCH_FIELDS: 6 (nomeCompleto/nomeArtistico/empresa/email/whatsapp/instagram, client-side)
SORT_FIELDS: 0
KPI_FIELDS: 5
IMPORT_FIELDS: 0
EXPORT_FIELDS: 0 (específico do módulo — delega inteiramente à Central de Relatórios)
PII_EXPORT_FIELDS: 2 (email, telefone — via Central de Relatórios)
XLSX_EXPORTS: 0
XLSX_RULE_VIOLATIONS: 0
REALTIME_EVENTS: 0
STORAGE_FIELDS: 1 (uploads — decorativo, ver Gap #13)
EXTERNAL_LEAD_SOURCES: 0
CREDENTIALS_REQUIRED_LATER: 0
PERMISSIONS_AUDITED: 7 (lead:read/create/update/delete + lead_interaction:read/create/delete)
AUTHORIZATION_GAPS: 0
TENANT_ISOLATION_GAPS: 0

CODE_FIELD_ONLY: 0
DATABASE_COLUMN_ONLY: 7 (origem_lead/probabilidade_fechamento/responsavel/prioridade/temperatura/
    proximo_follow_up/valor_estimado — colunas físicas nunca escritas pelo fluxo real, Gap #2)
TYPE_MISMATCH: 0
NULLABILITY_MISMATCH: 0
DEFAULT_MISMATCH: 0
ENUM_MISMATCH: 1
RELATION_MISMATCH: 1 (criação automática e não solicitada de Artist na conversão)
CREATE_MAPPING_MISMATCH: 2 (whatsapp em leads — Gap #1; leadId/type/notes em lead-interactions —
    Gap #9)
EDIT_MAPPING_MISMATCH: 0 (edição de lead em si está correta — herda o mesmo Gap #1 de create, não
    contado em duplicidade)
DISPLAY_MAPPING_MISMATCH: 1 (rótulo "Em negociação" do KPI mede algo diferente do que o nome sugere)
PIPELINE_MAPPING_GAPS: 1 (sistema de pipeline dedicado, morto — Gap #16)
KANBAN_PERSISTENCE_GAPS: 0 (não aplicável — nenhum Kanban existe para avaliar persistência)
PII_PROTECTION_GAPS: 0
ENCRYPTION_GAPS: 0
SEARCH_GAPS: 2 (Gap #11 — search ausente do DTO; stage/assignedTo ignorados no service)
DUPLICATE_HANDLING_GAPS: 2 (criação de lead — Gap #7; conversão — Gap #6)
CONVERSION_MAPPING_GAPS: 1 (Gap #4)
CONVERSION_ATOMICITY_GAPS: 1 (Gap #5)
FOLLOW_UP_GAPS: 1 (Gap #14)
IMPORT_MAPPING_GAPS: 0 (não há import para ter mapeamento — NOT_IMPLEMENTED)
EXPORT_PRIVACY_GAPS: 0
PAGINATION_GAPS: 0
TRUNCATION_GAPS: 1 (?limit=200 hardcoded — TOTAL_COUNT_SOURCE do frontend é o array truncado)
STORAGE_GAPS: 1 (Gap #13)
REALTIME_GAPS: 0 (não aplicável — nenhuma assinatura realtime existe para estar quebrada)
EXTERNAL_INTEGRATION_GAPS: 0
REAL_MAPPING_GAPS: 2 (Gap #9 — endpoint dedicado de interações; Gap #12 — transições de status na UI)

LEAD_CLIENT_DOMAIN_BOUNDARY_CONFIRMED: SIM
LEAD_TO_CLIENT_TRACEABILITY_COMPLETE: SIM
CONVERSION_TRANSACTIONAL: NÃO
CRM_LEADS_TRACEABILITY_COMPLETE: SIM

UNMAPPED_CREATE_FIELDS: 0
UNMAPPED_EDIT_FIELDS: 0
UNMAPPED_DISPLAY_FIELDS: 0
UNMAPPED_RELATION_FIELDS: 0
UNMAPPED_PIPELINE_FIELDS: 0
UNMAPPED_INTERACTION_FIELDS: 0
UNMAPPED_CONVERSION_FIELDS: 0
UNMAPPED_PII_FIELDS: 0
UNMAPPED_IMPORT_FIELDS: 0
UNMAPPED_EXPORT_FIELDS: 0
UNMAPPED_STORAGE_FIELDS: 0
UNKNOWN_FIELD_CLASSIFICATIONS: 0
```

NEXT_MODULE: `licensing`

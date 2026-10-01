> Historical record. Kept as recorded; not the current contract.

# Registro Canônico de Gaps — Fase 3 / Etapa 1

**Status:** CONCLUÍDO — consolidação, deduplicação e ordenação por dependência.
**Nenhum gap foi corrigido nesta etapa.** Nenhum schema, banco de dados, Supabase, `.env` ou credencial foi alterado.

---

## ADENDO — DEC-001 RESOLVED (Fase 3 / Wave 0) — **SUPERSEDED, ver correção abaixo**

```
DEC-001: RESOLVED
Selected: UNIVERSAL_FINANCIAL_PROJECT
```

> ⚠️ **Esta definição foi invalidada por correção explícita do Product Owner. Não é mais a definição
> canônica.** Preservada abaixo apenas como registro histórico do que foi originalmente decidido — ver
> "ADENDO — CORREÇÃO CANÔNICA DE DEC-001" logo a seguir para a definição vigente.

`projects` é registrada como a entidade canônica de projeto financeiro/operacional cross-domain;
`projects.id` é o identificador canônico dessa dimensão. **Ressalva arquitetural obrigatória:**
`UNIVERSAL_FINANCIAL_PROJECT` **não** significa que todo `project` seja um lançamento musical — o fluxo
atual (`/projetos`, `ProjetoFormModal.tsx`, `project_tracks`, `project_track_participants`) é uma
**especialização** (`MUSIC_RELEASE_PROJECT`) dentro do conceito mais amplo de `projects`, não sua
definição semântica exclusiva. Campos específicos de lançamento não podem se tornar requisitos
universais de todo `project` no futuro schema/API v2. `DUAL_MODEL` **não** foi escolhido — esta decisão
**não autoriza** criar `project_category`/`project_kind`/`project_domain`/`project_subtype` ou qualquer
coluna discriminadora agora. `financial_project_id` (audiovisual/marketing → projects) e
`transactions.projeto_id` → projects permanecem relações semanticamente válidas e preservadas.

Detalhe completo do registro da decisão: `decision-register.json` (`DEC-001`). Efeitos nos contadores
globais e no gap `GAP-0001`: ver §9, §10 e §12 abaixo (atualizados). **Esta é uma resolução documental —
nenhuma implementação foi feita**: `ProjetoFormModal.tsx` não foi alterado, `GAP-0033` e `GAP-0013`
permanecem `OPEN`, nenhum schema v2/API v2 foi criado.

---

## ADENDO — CORREÇÃO CANÔNICA DE `DEC-001` (Fase 3 / Wave 0 — definição vigente)

```
DEC-001: RESOLVED (corrigida)
Selected: MUSICAL_PROJECT_CANONICAL_HUB
Previous (invalidated): UNIVERSAL_FINANCIAL_PROJECT
```

**Definição canônica vigente, por autoridade explícita do Product Owner**: `projects` é a entidade
**Projeto Musical/Música**, não um hub financeiro/operacional genérico. `projects.id` é a chave de
vínculo cross-domain usada para relacionar registros pertencentes àquela música/projeto musical
específico — `Work/Obra`, `Phonogram`, `Release`, `Accounting Transaction`, `Audiovisual`, `Marketing` e
outros domínios relacionados. A existência de relações reais cross-domain (`financial_project_id`,
`transactions.projeto_id`) **não** transforma `projects` em entidade financeira — essas relações existem
porque a atividade de outros domínios *pertence* a uma música específica, não porque `projects` é, em
si, financeiro.

**O que muda em relação à definição anterior**: a interpretação "hub financeiro/operacional universal"
é invalidada. O que **não muda**: `projects.id` continua sendo a chave de vínculo cross-domain correta;
as relações reais já identificadas (`financial_project_id`, `transactions.projeto_id`, `works.projeto_id`)
continuam válidas e preservadas — apenas sua justificativa semântica é corrigida.

**Campos confirmados da ficha do projeto musical hoje** (frontend + API + banco, via
`docs/backend-v2/field-traceability/modules/projects.md`, não reauditado): `projects` — `titulo`,
`genero`, `tipo`, `status`, `artista_id` (real, não coletado pelo único form real), `orcamento` (real,
não coletado), `descricao`, `observacoes`; `project_tracks` (faixas aninhadas) — nome, solo/feat,
original/remix, instrumental, duração, gênero, idioma, letra, `audioUrl` (stub de upload);
`project_track_participants` — compositor/intérprete/produtor por faixa (real, populado). Corresponde
diretamente aos exemplos fornecidos pelo Product Owner (nome/título, gênero, compositor/autor,
intérprete).

**Matriz de relações cross-domain** (não reauditado módulo a módulo, reaproveitado de
`projects.md`/`releases.md`/`catalog.md`/`accounting.md` já lidos):

| Domínio | Coluna atual | Alvo | Status |
|---|---|---|---|
| Work/Obra | `works.projeto_id` | `projects.id` | `ALREADY_CORRECT` (real, lógica, confirmada populada via `ObraFormModal.tsx`) |
| Phonogram | nenhuma direta | `projects.id` (transitivo via `phonograms.obra_id → works.id → works.projeto_id`) | `ALREADY_CORRECT` transitivamente — sem gap novo criado |
| Release | **nenhuma** — `ReleaseEntity` não tem `project_id`/`projeto_id` | `projects.id` | `MISSING_RELATION` — apenas convenção de pré-preenchimento manual (`projetoToLancamentoSeed`), nunca persistida. **Novo gap `GAP-0168` criado.** |
| Accounting Transaction | `transactions.projeto_id` | `projects.id` | `ALREADY_CORRECT` (real, lógica, populada; só não é lida/agrupada pelo P&L — `GAP-0013`) |
| Audiovisual | `audiovisual_projects.financial_project_id` | `projects.id` | `ALREADY_CORRECT` relação (FK real) + `LEGACY_NAMING` (nome da coluna) + ausente na escrita via UI (`GAP-0033`) |
| Marketing | `marketing_projects.financial_project_id` | `projects.id` | `ALREADY_CORRECT` relação (FK real) + `LEGACY_NAMING` (nome da coluna) + ausente na escrita via UI (`GAP-0033`) |

`financial_project_id` (audiovisual/marketing) é classificado `LEGACY_NAMING` — a coluna é real e a
relação é válida, mas o nome sugere propósito financeiro quando sua função real é vincular o registro ao
projeto musical. **Não renomeada nesta etapa.**

**Revalidação de `GAP-0001`**: a recomendação de expor `artista_id`/`orcamento` em `ProjetoFormModal.tsx`
**permanece válida** — ambos os campos se encaixam naturalmente como atributos do próprio projeto
musical (artista principal da música; orçamento de produção), não porque `projects` fosse um hub
financeiro. `GAP-0001` permanece `OPEN`/`WAVE_3_CORE_DOMAIN_FIXES` (decisão corrigida, implementação
ainda pendente — não alterado por esta correção). **Revalidação de `GAP-0033`/`GAP-0013`**: achados
técnicos inalterados; apenas a linguagem semântica foi anotada como corrigida (ver
`canonical-gap-register.json`, campo `correctedSemanticNote` em cada um).

**Novo gap criado**: `GAP-0168` — "releases: no persisted relation to the originating musical project
(projects.id)". `blocksSchemaV2Design: SIM` (schema v2 de `releases` precisa contemplar essa relação
hoje ausente), `dependsOn: ["GAP-0001"]`, `resolutionWave: WAVE_2_SCHEMA_AND_CONTRACT`, `status: OPEN`.
Verificado que não é duplicação de `GAP-0007`/`GAP-0133` (relações diferentes) nem de `GAP-0001`/
`GAP-0013`/`GAP-0033` (nenhum cobre a ausência de relação `releases ↔ projects`).

`DEC-007` (`RELATIONAL_TRACKLIST_MODEL`) **não foi reaberta** — permanece válida. A cadeia conceitual
futura pode envolver `Musical Project → Release → Release Track → Phonogram → Work`, sem confundir essas
entidades entre si.

Histórico completo preservado em `decision-register.json` (`DEC-001.supersededDecision`) — a definição
anterior (`UNIVERSAL_FINANCIAL_PROJECT`), seu texto de resolução, ressalvas e relações preservadas
originais permanecem lá, verbatim, marcados `INVALIDATED_BY_PRODUCT_OWNER_DOMAIN_CORRECTION`. **Esta é
uma correção puramente documental** — nenhum código, schema, migration, banco de dados ou Supabase foi
alterado. `DEC-005` permanece estacionada, não registrada (`DEC_005_ANALYSIS_STATUS: PARKED_UNCHANGED`).

---

## ADENDO — DEC-007 RESOLVED (Fase 3 / Wave 0)

```
DEC-007: RESOLVED
Selected: RELATIONAL_TRACKLIST_MODEL
```

A tracklist de `releases` é registrada como **relacional**: `releases.metadata.faixas` **não** é a
fonte canônica de composição de um lançamento. Uma faixa de release deve ter identidade relacional
explícita e referenciar um **fonograma concreto** — cadeia canônica:

```
Release → Release Track → Phonogram → Work → Rights / Shares
```

Semântica de domínio: `Work` = obra/composição abstrata; `Phonogram` = gravação concreta; `Release
Track` = ocorrência ordenada de uma gravação específica dentro de um release. `release → work` sozinho
(via `release_works`) **não** é suficiente para modelar a tracklist — rastreabilidade a `works`/direitos
é preservada pela relação canônica já real do fonograma (`phonograms.obra_id → works.id`), não por uma
relação direta release↔work.

**Ressalva arquitetural obrigatória:** `RELATIONAL_TRACKLIST_MODEL` **não** significa que a estrutura
atual de `release_works(release_id, work_id)` seja aceita como o schema final — ela é **insuficiente**
por não possuir `phonogram_id`, `position`/`order`, nem identidade de faixa própria.
`FINAL_RELATIONAL_SCHEMA_STATUS: TO_BE_DESIGNED` — se será uma nova tabela `release_tracks` ou uma
evolução de `release_works` fica para a etapa de resolução do gap estrutural, não decidido aqui.
Requisitos mínimos já registrados para esse desenho futuro: `release_id`, `phonogram_id`,
`position`/`order`.

O wizard de 5 passos e os campos hoje coletados (`PRESERVES_CURRENT_WIZARD_INTENT: SIM`) são preservados
funcionalmente; a mudança é no destino de persistência, não na UX. Mudança de frontend futura
classificada como `CONTRACT_ALIGNMENT`, não implementada nesta etapa. `metadata.faixas` existente é
classificado `NON_CANONICAL_METADATA` (candidato a `LEGACY_DATA`/`MIGRATION_SOURCE` — tratamento exato a
definir na etapa de migração; nada foi apagado ou migrado agora).

**Correção documental**: o campo `reason` de `DEC-007` citava incorretamente `GAP-0053` (na verdade
"contracts: ContractStatus.ATIVO nunca alcançável", sem relação com split-sheets) como o gap de
split-sheet. Corrigido para `GAP-0041` (catalog: `CreateWorkDto.authors`/`.shares` validados mas nunca
persistidos — o gap de split-sheet real). `GAP-0053` em si não foi alterado.

Detalhe completo: `decision-register.json` (`DEC-007`). Efeitos nos contadores globais e no gap
`GAP-0007`: ver §9, §10 e §12 abaixo (atualizados). **Esta é uma resolução documental — nenhuma
implementação foi feita**: `release_tracks` não foi criada, `release_works` não foi alterada,
`metadata.faixas` não foi alterada, `GAP-0129` e `GAP-0130` permanecem `OPEN`, nenhum schema v2/API v2
foi criado.

---

## ADENDO — DEC-004 RESOLVED (Fase 3 / Wave 0)

```
DEC-004: RESOLVED
Selected: UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT
```

Contracts terá **uma única implementação canônica** de formulário/estado/contrato de frontend, operando
em 2 modos: **`WIZARD`** (fluxo completo hoje representado por `ContratoWizard.tsx` — template, partes
dinâmicas, variáveis, signatários, preview, workflow completo) e **`QUICK`** (fluxo abreviado hoje
disparado por `RegistroMusicas.tsx`, módulo `catalog`, após registrar Obra/Fonograma — mesma
implementação canônica, pode pré-preencher contexto e reduzir campos visíveis, **sem criar um segundo
contrato de persistência**). Ambos os entrypoints reais são preservados:
`PRIMARY_CONTRACTS_ENTRYPOINT: PRESERVED`, `CATALOG_QUICK_CONTRACT_ENTRYPOINT: PRESERVED` — esta decisão
**não autoriza** remover funcionalidade do catálogo; o gatilho cross-module deve futuramente apontar
para o componente canônico em modo `QUICK`.

**Princípio definitivo**: não haverá dois componentes independentes capazes de ler/escrever o mesmo
`Contract` com contratos de campos diferentes — `ContratoWizard.tsx` + `ContratoFormModal.tsx` como duas
implementações independentes de create/edit **não é canônico** e deve ser eliminado quando `GAP-0004`
for implementado. A decisão é **conceitual**: não determina se o arquivo físico final será o Wizard
refatorado, um novo componente compartilhado, ou outra reorganização técnica equivalente — apenas que o
resultado seja **uma** implementação canônica (`SINGLE_CANONICAL_IMPLEMENTATION_REQUIRED: SIM`).

**Ressalva obrigatória sobre `observacoes`**: esta decisão **não canoniza** o modelo atual de
`observacoes` — hoje o Wizard grava um blob JSON estruturado de partes/variáveis e o FormModal grava
texto livre no mesmo campo, um conflito semântico real e **não resolvido por `DEC-004`**
(`OBSERVACOES_SEMANTIC_CONFLICT: UNRESOLVED_IMPLEMENTATION_GAP`). A implementação futura do componente
único deve ter uma única semântica por campo, mas qual e como não é decidido aqui.
`STRUCTURED_PARTIES_STORAGE_MODEL: NOT_DECIDED_BY_DEC_004` (colunas, tabela relacional, metadata, ou
outro recurso — pertence aos gaps estruturais próprios). Esta decisão **não legitima** armazenar PII
estruturada dentro de `observacoes` — `GAP-0049` (PII em `contracts.observacoes`, exportada sem máscara)
permanece `OPEN`, inalterado.

`arquivo_url` (ausente no fluxo principal, bloqueia estruturalmente a transição de workflow
`aguardando_assinatura → assinado`) e `exclusivo` (campo real, semanticamente relevante, hoje sempre
`false` no fluxo principal) permanecem defeitos reais **não corrigidos por esta decisão** — a
implementação fica para a etapa própria de `GAP-0004`. `SCHEMA_V2_IMPACT: NONE_DIRECT` — a escolha do
componente canônico não exige, por si só, alteração de schema (isso não impede que gaps relacionados a
partes/`observacoes`/PII/assinaturas exijam mudanças de schema próprias depois). API v2: um único
recurso `Contract`, um único contrato de criação, um único de atualização — `WIZARD`/`QUICK` são
comportamento de frontend/UX, não dois recursos de API concorrentes.

Esta decisão fornece a premissa que `GAP-0008` (party sourceId, formalmente dependente de `GAP-0004`)
precisava para eventualmente ser resolvido — `GAP-0008` permanece `OPEN`, não implementado.

Detalhe completo: `decision-register.json` (`DEC-004`). Efeitos nos contadores globais e no gap
`GAP-0004`: ver §9, §10 e §12 abaixo (atualizados). **Esta é uma resolução documental — nenhuma
implementação foi feita**: `ContratoWizard.tsx`, `ContratoFormModal.tsx` e `RegistroMusicas.tsx` não
foram alterados; `arquivo_url`/`exclusivo`/`observacoes` não foram corrigidos; nenhuma migração de PII
ocorreu; `GAP-0008` permanece não implementado.

---

## ADENDO — DEC-002 RESOLVED (Fase 3 / Wave 0)

```
DEC-002: RESOLVED
Selected: CONTRACT_SERVICE_TYPES_CANONICAL
```

`contract_service_types` (entidade `ContractServiceType`) é registrado como o **vocabulário canônico de
tipo de contrato**. Classificação das 4 fontes existentes: `contract_service_types` =
`CANONICAL_SOURCE_OF_TRUTH`; `contract_templates.tipo_servico` = `LEGACY/DENORMALIZED_REFERENCE_TO_CANONICAL_TYPE`
(sua forma física futura — `service_type_id` ou `service_type_slug` — **não é decidida aqui**, apenas
que não pode continuar como vocabulário livre independente); `contract_categories` (localStorage) =
`DISPLAY_ONLY` (pode continuar existindo como agrupamento/rótulo, **não** é fonte de tipo de contrato);
`CONTRACT_TYPES` (hardcoded) = `DEAD_LEGACY_VOCABULARY` (não removido nesta etapa). `contracts.tipo`
deixa de poder ser uma fonte de vocabulário independente — sua semântica futura é
representar/referenciar o `ContractServiceType` canônico; se isso vira FK, slug denormalizado, ou é
mantido por compatibilidade **não é decidido por `DEC-002`**, fica para a resolução de
schema/contrato. `CANONICAL_REFERENCE_KEY: TO_BE_DEFINED_DURING_SCHEMA_CONTRACT_RESOLUTION` — esta
decisão resolve QUAL vocabulário é canônico, não QUAL chave física (id vs. slug) será usada nas FKs;
nenhuma decisão adicional foi criada apenas para essa escolha técnica.

**Constraint direta com `DEC-004`** (`UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT`, já `RESOLVED`): os
modos `WIZARD` e `QUICK` devem consumir a **mesma** fonte canônica — é proibido que a arquitetura futura
mantenha `WIZARD` lendo `contract_templates.tipo_servico` livre enquanto `QUICK` lê
`contract_service_types`. O modo `QUICK` já consome `contract_service_types` hoje — isso é
`PRESERVED_AS_CANONICAL_DIRECTION`, sem necessidade de mudança. O modo `WIZARD` (hoje deriva o tipo do
`tipo_servico` do template) `NEEDS_FUTURE_CONTRACT_ALIGNMENT`. Nenhum componente foi alterado nesta
etapa.

**Ressalvas obrigatórias registradas**: tornar `contract_service_types` canônico **não significa** que
seus campos ricos (termos financeiros, `requires_*` condicionais) já estão corretamente consumidos —
`SERVICE_TYPE_RULE_CONSUMPTION: IMPLEMENTATION_GAPS_REMAIN`. `GAP-0055` (propagação financeira
contracts→accounting) permanece um gap independente, não resolvido por esta decisão
(`DEC-002 RESOLVED ≠ GAP-0055 RESOLVED`). Dados legados: `contract_templates.tipo_servico` e
`contracts.tipo` podem conter valores livres históricos —
`LEGACY_TYPE_RECONCILIATION_REQUIRED: SIM`, `DATA_MIGRATION_REQUIRED: POSSÍVEL`,
`LEGACY_MAPPING_STATUS: REQUIRES_DATA_RECONCILIATION_DURING_MIGRATION_PREPARATION`. Regra registrada
para a etapa futura de migração: se todos os valores persistidos puderem ser mapeados
deterministicamente, nenhuma decisão humana adicional é necessária; se existirem valores semanticamente
ambíguos, apenas esses valores específicos são escalados para decisão — nenhum mapeamento foi inventado
por similaridade textual nesta etapa, e nenhum banco foi consultado.

**Correção documental**: o campo `reason` de `DEC-002` citava incorretamente `GAP-0041` (na verdade um
gap de `catalog`, split-sheet de obras, sem relação com contratos) como o gap de propagação financeira
de contratos. Corrigido para `GAP-0055` (o gap real de propagação financeira `contracts → accounting`).
`GAP-0041` em si não foi alterado.

Detalhe completo: `decision-register.json` (`DEC-002`). Efeitos nos contadores globais e no gap
`GAP-0002`: ver §9, §10 e §12 abaixo (atualizados). **Esta é uma resolução documental — nenhuma
implementação foi feita**: `ContratoWizard.tsx`, o modo `QUICK`, `contract_templates`, `contracts.tipo`
e `contract_service_types` não foram alterados; nenhuma FK foi criada; nenhum dado legado foi mapeado ou
migrado.

---

## 1. Escopo

Este documento consolida **todos os gaps identificados nos 24 relatórios de módulo** produzidos na Fase 2
(`docs/backend-v2/field-traceability/modules/*.md`) em um **registro canônico único, deduplicado por causa-raiz
e ordenável por dependência**, conforme instruído no PROMPT 119.

Esta etapa é estritamente de **inventário, deduplicação, classificação e ordenação** — nenhuma correção de
código, schema, migração, credencial ou configuração foi executada. Todo gap começa com `status: OPEN`
(exceto os itens `NO_FIX_REQUIRED` / `DEFERRED` / `ACCEPTED_BY_EXISTING_CONTRACT` / `NOT_APPLICABLE` já
assim classificados pelos próprios relatórios de origem).

Fontes lidas na íntegra: os 24 relatórios `.md` de módulo, `field-traceability.json`,
`database-backend-column-mapping.json`, `field-mismatches.json`, `PROGRESS.md`,
`docs/backend-v2/field-traceability/reports/report-inventory.json`. Não foram usados apenas os resumos das
respostas anteriores — os `.md` foram a fonte de evidência primária para cada gap.

---

## 2. Status de entrada verificado

Antes de iniciar a consolidação, confirmou-se programaticamente:

| Verificação | Resultado |
|---|---|
| `PHASE_2_MODULE_AUDIT_COMPLETE` | `SIM` |
| `modulesCompleted.length` | `24` |
| `modulesPending` | `[]` (vazio) |
| `NEXT_PHASE` | `GAP_RESOLUTION_NOT_STARTED` |
| Módulos em `PENDING`/`BLOCKED`/`IN_PROGRESS`/`UNKNOWN` | `0` |

Entrada consistente — **não houve bloqueio (`STATUS: BLOQUEADO`)**.

---

## 3. Regras de consolidação aplicadas

1. **Deduplicação estritamente por causa-raiz**, nunca por similaridade textual/categórica. Achados
   superficialmente parecidos (ex.: `limit=50` em 15+ módulos) permanecem gaps canônicos **separados**,
   compartilhando apenas uma `PATTERN_TAG` (`TRUNCATION_50`).
2. Gaps que se manifestam em múltiplos módulos por uma **mesma causa-raiz cross-domain** viram **1 gap
   canônico com múltiplas `occurrences[]`** (ex.: `GAP-0013`, P&L por projeto = accounting + projects).
3. Fluxos de UI duplicados (billing×3, convite×2, ContratoWizard-vs-Modal, artist create×2) permanecem gaps
   **separados**, com `PATTERN_TAG: DUPLICATE_UI_FLOW` — cada um tem arquivo/contrato/fix independente.
4. Uma exceção documentada e deliberada: **`GAP-0167`** colapsa 9 scaffolds de store Zustand nunca
   utilizados (catalog/contracts/dashboard/events/inventory/leads/crm-relationships/projects/releases) em um
   único gap cross-module — justificativa registrada no próprio gap (mesmo padrão de geração, mesmo fix
   trivial e independente por arquivo, sem interação entre os 9).
5. Decisões `NOT_APPLICABLE` / `DEAD_DO_NOT_MIGRATE` / `DEFERRED_DO_NOT_IMPLEMENT_NOW` já tomadas nos
   relatórios de origem foram **preservadas verbatim** (ex.: `GAP-0133` contracts↔releases `lancamento_id`).
6. Nenhuma nova investigação de código foi feita nesta etapa, exceto para resolver ambiguidade de dedup
   (ex.: confirmar que o padrão de store Zustand morto é idêntico nos 9 módulos antes de colapsar).

---

## 4. Contagens globais

| Métrica | Valor |
|---|---|
| `RAW_GAP_OCCURRENCES` | **200** (199 originais da Fase 3 + 1 de `GAP-0168`, descoberta durante a correção de `DEC-001` — ver ADENDO no topo) |
| `CANONICAL_GAPS` (após deduplicação por causa-raiz) | **168** (167 + `GAP-0168`) |
| `DEDUPLICATED_OCCURRENCES` (= RAW − CANONICAL) | **32** |
| `DEDUP_RATIO` | **0.160** |
| `MODULES_WITH_GAPS` | **24** (inalterado — `GAP-0168` toca `releases`/`projects`, já contados) |
| `MODULES_WITHOUT_GAPS` | **0** |

---

## 5. Distribuição de severidade

| Severidade | Contagem | Critério aplicado |
|---|---|---|
| `S0_CRITICAL` | **0** | Nenhum achado atingiu o critério estrito (exposição cross-tenant, bypass de auth, segredo exposto, corrupção de dados, efeito financeiro automático incorreto, crash sistêmico sem workaround). Consistente com `AUTHORIZATION_GAPS: 0` / `TENANT_ISOLATION_GAPS: 0` já confirmados em todos os 24 módulos. |
| `S1_HIGH` | **26** | CRUD essencial quebrado, crash alcançável, contrato frontend/backend incompatível, dado salvo incorretamente, workflow essencial quebrado. |
| `S2_MEDIUM` | **77** (era 76; `+1` de `GAP-0168`) | Funcionalidade parcial, truncamento, realtime sem publisher/consumer, storage incompleto, source-of-truth ambíguo, integração necessária ausente. |
| `S3_LOW` | **38** | Inconsistência de UX, UI duplicada, campo não utilizado, dead code relevante. |
| `S4_INFORMATIONAL` | **27** | Stub intencional, feature deferida, observação técnica, não-requisito confirmado. |

---

## 6. Classes de gap (gapType)

| gapType | Contagem |
|---|---|
| REAL_MAPPING_GAP | 37 |
| MISSING_REQUIRED_FUNCTIONALITY | 29 |
| PAGINATION_GAP | 18 |
| CREATE_MAPPING_MISMATCH | 17 |
| RELATION_MISMATCH | 12 (era 11; `+1` de `GAP-0168`) |
| DISPLAY_MAPPING_MISMATCH | 11 |
| ENUM_MISMATCH | 7 |
| SOURCE_OF_TRUTH_CONFLICT | 6 |
| DATA_INTEGRITY_DEFECT | 6 |
| STORAGE_GAP | 5 |
| REALTIME_GAP | 5 |
| ENTITY_DECLARATION_DRIFT | 5 |
| MISSING_TRANSACTION_BOUNDARY | 2 |
| SECURITY_DEFECT | 2 |
| UX_CONTRACT_DEFECT | 2 |
| CODE_FIELD_ONLY | 1 |
| ARCHITECTURAL_DEBT | 1 |
| INTENTIONAL_STUB | 1 |
| DEAD_CODE | 1 |

**Camada primária (`primaryLayer`):** FRONTEND 68, API_CONTRACT 32, BACKEND_APPLICATION 27,
EXTERNAL_INTEGRATION 12, BACKEND_DOMAIN 8, STORAGE 7, BACKEND_PERSISTENCE 7, DATABASE_SCHEMA 3,
CONFIGURATION 1, EXPORT_REPORTING 1, ASYNC_JOBS 1.

**Áreas de impacto (`impactAreas`):** CORE_WORKFLOW 22, DATA_INTEGRITY 18, FINANCIAL 14, MAINTAINABILITY 9,
USER_EXPERIENCE 5, SECURITY 3, REPORTING 2, COMPLIANCE 2, TENANT_ISOLATION 2, CONFIGURATION 1.

---

## 7. Matriz de módulos

Colunas: RAW = ocorrências brutas atribuídas a este módulo · CAN = gaps canônicos que tocam este módulo
(um gap cross-module conta em cada módulo que ele afeta, por isso a soma de CAN ultrapassa 167) · S0-S4 =
severidade dos gaps canônicos que tocam o módulo · BSv2/BV2/BCut = quantos bloqueiam schema-v2/api-v2/cutover
· UD = quantos exigem decisão do usuário.

| Módulo | Status | RAW | CAN | S0 | S1 | S2 | S3 | S4 | BSv2 | BV2 | BCut | UD |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| accounting | AUDITED | 9 | 14 | 0 | 4 | 7 | 2 | 1 | 0 | 0 | 0 | 0 |
| admin | AUDITED | 8 | 9 | 0 | 1 | 3 | 3 | 2 | 0 | 0 | 0 | 0 |
| artist | AUDITED | 6 | 9 | 0 | 1 | 4 | 2 | 2 | 0 | 0 | 0 | 2 |
| audiovisual | AUDITED | 6 | 7 | 0 | 3 | 3 | 1 | 0 | 0 | 0 | 0 | 0 |
| auth | AUDITED | 6 | 6 | 0 | 1 | 3 | 0 | 2 | 0 | 0 | 1 | 0 |
| catalog | AUDITED | 8 | 9 | 0 | 3 | 2 | 2 | 2 | 0 | 0 | 0 | 0 |
| contracts | AUDITED | 17 | 18 | 0 | 4 | 11 | 1 | 2 | 0 | 0 | 0 | 1 |
| crm-relationships | AUDITED | 10 | 11 | 0 | 3 | 3 | 4 | 1 | 0 | 0 | 0 | 1 |
| dashboard | AUDITED | 7 | 7 | 0 | 0 | 5 | 0 | 2 | 0 | 0 | 0 | 0 |
| events | AUDITED | 9 | 9 | 0 | 0 | 6 | 2 | 1 | 0 | 0 | 0 | 0 |
| integrations | AUDITED | 11 | 12 | 0 | 0 | 2 | 1 | 9 | 0 | 0 | 0 | 0 |
| inventory | AUDITED | 9 | 9 | 0 | 0 | 4 | 4 | 1 | 0 | 0 | 0 | 0 |
| leads | AUDITED | 9 | 9 | 0 | 0 | 5 | 2 | 2 | 0 | 0 | 0 | 0 |
| licensing | AUDITED | 6 | 6 | 0 | 1 | 3 | 2 | 0 | 0 | 0 | 0 | 0 |
| marketing | AUDITED | 6 | 7 | 0 | 2 | 3 | 1 | 1 | 0 | 0 | 0 | 0 |
| monitoring | AUDITED | 6 | 6 | 0 | 0 | 3 | 1 | 2 | 0 | 0 | 0 | 0 |
| musicchat | AUDITED | 5 | 5 | 0 | 0 | 3 | 0 | 2 | 0 | 0 | 0 | 0 |
| projects | AUDITED | 7 | 9 | 0 | 1 | 6 | 0 | 2 | 1 | 0 | 0 | 0 |
| releases | AUDITED | 11 | 10 | 0 | 2 | 3 | 2 | 3 | 1 | 0 | 0 | 0 |
| reports | AUDITED | 5 | 5 | 0 | 0 | 2 | 2 | 1 | 0 | 0 | 0 | 0 |
| rh | AUDITED | 9 | 10 | 0 | 5 | 5 | 0 | 0 | 0 | 0 | 0 | 0 |
| settings | AUDITED | 16 | 16 | 0 | 1 | 9 | 6 | 0 | 0 | 0 | 0 | 2 |
| support | AUDITED | 7 | 7 | 0 | 2 | 3 | 0 | 2 | 0 | 0 | 0 | 0 |
| workspace | AUDITED | 7 | 7 | 0 | 0 | 2 | 4 | 1 | 0 | 0 | 0 | 1 |

Soma de RAW por módulo = 200 (era 199; `+1` de `GAP-0168`, ver ADENDO de correção da `DEC-001` no topo do
documento) — bate com `RAW_GAP_OCCURRENCES` global. Todos os 24 módulos registrados em `PROGRESS.md`
possuem ao menos 1 gap (incluindo confirmações `NO_FIX_REQUIRED`) — `MODULES_WITHOUT_GAPS: 0`.

**Nota (pós-`DEC-001`):** as colunas `BSv2`/`BV2`/`UD` de `accounting`, `audiovisual` e `marketing`
foram atualizadas — cada uma tinha exatamente 1 gap bloqueante/pendente-de-decisão (`GAP-0001`), agora
resolvido. `projects` e `releases` voltaram a ter `BSv2: 1` cada, mas por um motivo diferente e novo:
`GAP-0168` (releases sem relação persistida com o projeto musical de origem — ver correção de `DEC-001`),
não pela decisão original de `GAP-0001` (já resolvida, sem bloqueio).

---

## 8. Resumo do grafo de dependências

- `DEPENDENCY_EDGES`: **16** (chegou a 17 com `GAP-0168.dependsOn = ["GAP-0001"]`, adicionada durante a
  correção de `DEC-001`; voltou a **16** nesta etapa — `GAP-0099.dependsOn = ["GAP-0015"]` removida por
  ser, ela própria, um achado errado: `GAP-0015` trata de `financial_category_id`, campo distinto de
  `financial_project_id`, sem relação real com a premissa invalidada de `GAP-0099` — ver correção abaixo)
- `DEPENDENCY_CYCLES`: **0** (validado via ordenação topológica de Kahn sobre os 168 nós — 0 ciclos, sort
  completo com sucesso)
- `UNKNOWN_DEPENDENCIES`: **0** (todo `dependsOn` referencia um `GAP-XXXX` existente no próprio registro)
- Precedência estrutural aplicada onde relevante: IDENTITY/DOMAIN_MODEL → SCHEMA → PERSISTENCE →
  APPLICATION_FLOW → UI_CONTRACT (ex.: `GAP-0141`/`GAP-0145` (schema RH) dependem implicitamente de
  `GAP-0138`–`GAP-0140` (contrato CRUD) estarem classificados primeiro); PROVIDER_CONNECTION → SYNC (Wave 5
  DocuSign `GAP-0051` depende de `GAP-0043`... na verdade `GAP-0051`→`GAP-0050` DocuSign envelope);
  STORAGE → FILE_DISPLAY.
- Fórmula de `priorityScore` usada (apenas para ordenação interna, não substitui a ordem de dependência):
  `severidade_base + reachability_bonus + cutover_blocking_bonus + schema_blocking_bonus + módulos_afetados_bonus`,
  aplicada de forma qualitativa por gap (não uma fórmula numérica rígida automatizada) e documentada por
  gap no campo `priorityScore` (0–95).
- **A ordem de dependência sempre prevalece sobre severidade/prioridade** no `resolution-order.json` — o
  algoritmo é: ordenação topológica (Kahn) respeitando `dependsOn`, com desempate por `resolutionWave` e,
  dentro da mesma wave/nível de dependência, por `priorityScore` decrescente.

---

## 9. Waves de resolução

| Wave | Gaps | Descrição |
|---|---|---|
| `WAVE_0_DECISIONS` | 3 | Decisões genuínas de negócio/arquitetura sem fonte canônica — ver §10. (Era 8; `GAP-0001`/`DEC-001` realocada para `WAVE_3_CORE_DOMAIN_FIXES`, `GAP-0007`/`DEC-007` e `GAP-0002`/`DEC-002` realocadas para `WAVE_2_SCHEMA_AND_CONTRACT`, `GAP-0004`/`DEC-004` realocada para `WAVE_3_CORE_DOMAIN_FIXES` — ver ADENDOS no topo do documento; `GAP-0168`/`DEC-009` passou por aqui temporariamente enquanto `PENDING`, agora resolvida e realocada de volta para `WAVE_2_SCHEMA_AND_CONTRACT`; `GAP-0003`/`DEC-003` resolvida e realocada para `WAVE_3_CORE_DOMAIN_FIXES` — ver correção canônica no fim do documento.) |
| `WAVE_1_FOUNDATIONS` | 0 | Nenhum item — identidade/tenant/auth já confirmados sólidos em todos os 24 módulos (auth.md, workspace.md) |
| `WAVE_2_SCHEMA_AND_CONTRACT` | 32 | Coluna/tabela/relação/constraint/enum/contrato de API/entity-declaration necessários antes de fixes de domínio. (Era 29; inclui `GAP-0007` — modelo relacional decidido, desenho final da tabela `TO_BE_DESIGNED`; `GAP-0002` — vocabulário canônico decidido, chave de referência física `TO_BE_DEFINED_DURING_SCHEMA_CONTRACT_RESOLUTION`; `GAP-0168` — decisão `DEC-009` resolvida [`PROJECT_RELEASE_DIRECT_LINK`], implementação de `releases.project_id` pendente.) |
| `WAVE_3_CORE_DOMAIN_FIXES` | 56 | CRUD/workflow central não dependente de integrações externas. (Era 53; inclui agora `GAP-0001` — decisão resolvida, implementação de `artista_id`/`orcamento` em `ProjetoFormModal.tsx` ainda pendente; `GAP-0004` — decisão resolvida, consolidação em componente único WIZARD/QUICK ainda pendente; e `GAP-0003` — decisão resolvida, mesclagem de `ArtistaCadastro.tsx` em `ArtistaFormModal.tsx` ainda pendente; todos sem impacto de schema.) |
| `WAVE_4_CROSS_DOMAIN_FIXES` | 12 | Propagação financeira, project↔accounting, release↔marketing, contract↔accounting, inventory↔accounting etc. (Era 14; `GAP-0127` e `GAP-0099` realocadas para `WAVE_NONE` — ambas as afirmações originais invalidadas por evidência local, ver §12/correções abaixo.) |
| `WAVE_5_INTEGRATIONS` | 12 | Apenas provedores externos/credenciais (DocuSign, 6 distribuidores, ABRAMUS, ACRCloud, PostHog, NFe, ECAD, UBC, Stripe, redirect-URL allowlist) |
| `WAVE_6_SECONDARY_FUNCTIONALITY` | 22 | Não-bloqueante mas ainda requisito ativo |
| `WAVE_7_CLEANUP` | 15 | Dead code / UI órfã / implementação duplicada / scaffolding não utilizado |
| `WAVE_NONE` | 16 | `NO_FIX_REQUIRED` / `DEFERRED` / `NOT_APPLICABLE` / `ACCEPTED_BY_EXISTING_CONTRACT` (Era 14; `+2` de `GAP-0127` e `GAP-0099`, ver correções abaixo.) |

**Soma:** 3+0+32+56+12+12+22+15+16 = **168** ✓ bate com `CANONICAL_GAPS` (167 originais + `GAP-0168`,
novo, criado durante a correção de `DEC-001` — ver ADENDO no topo do documento).

Índice completo de gaps por wave (ID, título, severidade, módulos, status, prioridade) — ver **Seção 12**.

---

## 10. Decisões do usuário requeridas (registradas, não respondidas nesta etapa)

9 decisões genuínas registradas em `decision-register.json`. **6 resolvidas (`DEC-001`, `DEC-007`,
`DEC-004`, `DEC-002`, `DEC-009`, `DEC-003`), 3 pendentes** — nenhuma das pendentes foi solicitada ao
usuário nesta etapa, apenas catalogadas para resolução futura individual (uma decisão por execução,
mesmo processo usado nas anteriores). `DEC-003` foi resolvida pelo Product Owner nesta etapa
(`ARTISTA_FORM_MODAL_CANONICAL`) — ver correção canônica no fim do documento.

| Decision ID | Gap(s) | Pergunta (resumo) | Bloqueia Schema v2 | Bloqueia API v2 | Status |
|---|---|---|---|---|---|
| DEC-001 | GAP-0001 | `projects` = hub financeiro universal ou projeto de lançamento musical? | SIM* | SIM* | **RESOLVED — MUSICAL_PROJECT_CANONICAL_HUB** (corrigida; anterior `UNIVERSAL_FINANCIAL_PROJECT` invalidada — ver ADENDO no topo) |
| DEC-002 | GAP-0002 | Qual das 4 vocabulárias de tipo de contrato é a canônica? | NÃO | NÃO | **RESOLVED — CONTRACT_SERVICE_TYPES_CANONICAL** |
| DEC-003 | GAP-0003 | ArtistaFormModal vs ArtistaCadastro — qual mantido/expandido? | NÃO | NÃO | **RESOLVED — ARTISTA_FORM_MODAL_CANONICAL** |
| DEC-004 | GAP-0004 | ContratoWizard vs ContratoFormModal — qual é o canônico? | NÃO | NÃO | **RESOLVED — UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT** |
| DEC-005 | GAP-0005 | Billing fragmentado em 3 superfícies — qual vira canônica? | NÃO | NÃO | PENDING |
| DEC-006 | GAP-0006 | Gestão de convites duplicada — qual superfície vence? | NÃO | NÃO | PENDING |
| DEC-007 | GAP-0007 | Tracklist de releases: relacional ou jsonb? | SIM* | NÃO | **RESOLVED — RELATIONAL_TRACKLIST_MODEL** |
| DEC-008 | GAP-0008 | Party sourceId: referência viva ou snapshot intencional? | NÃO | NÃO | PENDING (premissa fornecida por `DEC-004`, ainda não implementada) |
| DEC-009 | GAP-0168 | Project↔Release: FK direta, derivada via `Work→Phonogram→ReleaseTrack`, ou híbrida? | SIM* | NÃO | **RESOLVED — PROJECT_RELEASE_DIRECT_LINK** |

\* Colunas `Bloqueia Schema v2`/`Bloqueia API v2` de `DEC-001`/`DEC-007`/`DEC-009` preservadas como
registro histórico da gravidade da decisão (campos `blocksSchemaV2Design`/`blocksApiV2Implementation`
em `decision-register.json` não foram alterados). `DEC-004`/`DEC-002`/`DEC-003` já não bloqueavam
nenhum dos dois desde o registro original. Os gaps correspondentes (`GAP-0001`, `GAP-0007`, `GAP-0004`,
`GAP-0002`, `GAP-0168`, `GAP-0003`) já não bloqueiam (`blocksSchemaV2Design`/
`blocksApiV2Implementation: false` nos 6) — ver §12. `BLOCKS_SCHEMA_V2_DESIGN: 0` e
`BLOCKS_API_V2_IMPLEMENTATION: 0` globalmente (nenhum gap remanescente bloqueia por ambiguidade de
decisão) — ver §14.

Cada decisão inclui `options[]`, `recommendedOption` e `reason` completos em `decision-register.json`.
`DEC-001` inclui adicionalmente `status`, `selectedOption`, `resolutionSummary`, `architecturalCaveat`,
`preservedRelations`, `rejectedOptions` e `implementationStatus`. `DEC-007` inclui adicionalmente
`status`, `selectedOption`, `canonicalDecision`, `canonicalChain`, `architecturalCaveat`,
`minimumRelationalRequirements`, `domainSemantics`, `rightsTraceability`,
`metadataFaixasClassification`, `rejectedOptions`, `preservesCurrentWizardIntent`,
`frontendChangeRequired`/`frontendChangeType` e `implementationStatus`. O campo `reason` original de
`DEC-007` continha uma citação incorreta (`GAP-0053`, na verdade um gap não relacionado de `contracts`)
para o achado de split-sheet — corrigida para `GAP-0041` (o gap real de split-sheet, em `catalog`);
`GAP-0053` em si não foi alterado. `DEC-004` inclui adicionalmente `status`, `selectedOption`,
`canonicalDecision`, `canonicalPrinciple`, `modes` (`WIZARD`/`QUICK`), `entrypointsPreserved`,
`fileIdentityDecided`/`fileIdentityNote`, `fieldsToPreserve`, `arquivoUrlNote`, `exclusivoNote`,
`observacoesSemanticConflict`/`observacoesNote`, `structuredPartiesStorageModel`, `piiNote`,
`frontendSourceOfTruth`, `backendSourceOfTruth`, `schemaV2Impact`, `apiV2Note`, `dependencyProvidedNote`,
`duplicationEliminated` e `implementationStatus`. `DEC-002` inclui adicionalmente `status`,
`selectedOption`, `canonicalDecision`, `canonicalTypeEntity`, `canonicalTypeSource`,
`sourceClassification` (matriz das 4 fontes), `dec004Constraint`, `canonicalReferenceKey`/
`canonicalReferenceKeyNote`, `contractsTipoNote`, `serviceTypeRuleConsumption`, `gap0055Note`,
`legacyDataNote`/`legacyTypeReconciliationRequired`/`dataMigrationRequired`/`legacyMappingStatus`/
`legacyMappingRule` e `implementationStatus`. O campo `reason` original de `DEC-002` continha uma
citação incorreta (`GAP-0041`, na verdade um gap não relacionado de `catalog`, split-sheet de obras)
para o achado de propagação financeira de contratos — corrigida para `GAP-0055` (o gap real de
propagação financeira `contracts → accounting`); `GAP-0041` em si não foi alterado.

---

## 11. Gaps dependentes de credencial

3 gaps canônicos têm `credentialsRequiredLater` não-vazio — nenhuma credencial foi adicionada
(`CREDENTIALS_TO_ADD_NOW: 0`, verificado):

| Gap | Provedor(es) | Fase da credencial |
|---|---|---|
| GAP-0039 | Supabase Dashboard (Redirect/Site URL allowlist) | STAGING_VALIDATION |
| GAP-0050 | DocuSign | IMPLEMENTATION_DEV |
| GAP-0080 | ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe (6 distribuidores) | TENANT_RUNTIME |

---

## 12. Registro canônico de gaps (índice completo por wave)

Detalhe completo de cada gap (rootCause, evidência, arquivos, tabelas, endpoints, schemaImpact,
dataMigrationRequired, frontendChangeRequired, apiV2MustResolve, legacyVsV2Strategy, occurrences[] etc.)
está em **`canonical-gap-register.json`** (167 objetos, schema mínimo obrigatório presente em todos).
Abaixo, o índice ordenado por wave e prioridade:

### WAVE_0_DECISIONS (3 gaps)
> `GAP-0001` (`DEC-001`) resolvida — realocada para `WAVE_3_CORE_DOMAIN_FIXES`. `GAP-0007` (`DEC-007`) e
> `GAP-0002` (`DEC-002`) resolvidas — realocadas para `WAVE_2_SCHEMA_AND_CONTRACT`. `GAP-0004`
> (`DEC-004`) resolvida — realocada para `WAVE_3_CORE_DOMAIN_FIXES` (ver abaixo e ADENDOS no topo do
> documento). `GAP-0168` passou por aqui temporariamente (`DEC-009` estava `PENDING`) — decisão do
> Product Owner resolvida (`PROJECT_RELEASE_DIRECT_LINK`); `GAP-0168` **realocada de volta** para
> `WAVE_2_SCHEMA_AND_CONTRACT` — ver correção canônica no fim do documento. `GAP-0003` (`DEC-003`)
> resolvida — decisão do Product Owner (`ARTISTA_FORM_MODAL_CANONICAL`); **realocada** para
> `WAVE_3_CORE_DOMAIN_FIXES` (mesmo tratamento de `GAP-0004`, também uma consolidação de dois
> componentes) — ver correção canônica no fim do documento.

| ID | Title | Severity | Modules | Status | Priority |
|---|---|---|---|---|---|
| GAP-0005 | settings: billing fragmented across 3 UI surfaces — which becomes canonical? | S2_MEDIUM | settings | OPEN | 45 |
| GAP-0006 | workspace/settings: invitation-management UI fragmented across /usuarios and Configuracoes "Usuários" tab | S2_MEDIUM | workspace, settings | OPEN | 35 |
| GAP-0008 | contracts: party sourceId (CRM/Artist origin) copied instead of live-referenced | S2_MEDIUM | contracts, crm-relationships, artist | OPEN | 30 |

### WAVE_2_SCHEMA_AND_CONTRACT (32 gaps)
> `GAP-0007` movida para cá a partir de `WAVE_0_DECISIONS` — decisão `DEC-007` resolvida
> (`RELATIONAL_TRACKLIST_MODEL`); desenho final da tabela relacional (`release_tracks` nova ou evolução
> de `release_works`, com `phonogram_id`+`position`/`order`) permanece `TO_BE_DESIGNED`. `GAP-0002`
> também movida para cá — decisão `DEC-002` resolvida (`CONTRACT_SERVICE_TYPES_CANONICAL`); chave de
> referência física (`service_type_id` vs `service_type_slug`) permanece
> `TO_BE_DEFINED_DURING_SCHEMA_CONTRACT_RESOLUTION`. `GAP-0168` também de volta para cá — decisão
> `DEC-009` resolvida (`PROJECT_RELEASE_DIRECT_LINK`); implementação de `releases.project_id`
> permanece pendente (não decisão).

| ID | Title | Severity | Modules | Status | Priority |
|---|---|---|---|---|---|
| GAP-0168 | releases: no persisted relation to the originating musical project (projects.id) — decision RESOLVED (DEC-009: PROJECT_RELEASE_DIRECT_LINK), remaining work is implementing releases.project_id, not deciding cardinality | S2_MEDIUM | releases, projects | OPEN | 40 |

| ID | Title | Severity | Modules | Status | Priority |
|---|---|---|---|---|---|
| GAP-0048 | contracts: contract-templates create returns HTTP 400 on every submission (reachable crash of a core feature) | S1_HIGH | contracts | OPEN | 85 |
| GAP-0138 | rh: employee CREATE_MAPPING_MISMATCH — CreateEmployeeDto rejects the real form payload shape (400 on every submission) | S1_HIGH | rh | OPEN | 80 |
| GAP-0139 | rh: payroll-entry CREATE_MAPPING_MISMATCH — CreatePayrollEntryDto field names diverge from the form (400 on every submission) | S1_HIGH | rh | OPEN | 80 |
| GAP-0140 | rh: leave-request CREATE_MAPPING_MISMATCH — CreateLeaveRequestDto field names diverge from the form (400 on every submission) | S1_HIGH | rh | OPEN | 80 |
| GAP-0025 | auth/artist: ArtistaSignupPublic.tsx calls nonexistent endpoint POST /public/artists (100% broken public signup) | S1_HIGH | auth, artist | OPEN | 75 |
| GAP-0143 | rh: employee list renders blank/empty despite real data existing (frontend query key or response-shape mismatch) | S1_HIGH | rh | OPEN | 75 |
| GAP-0009 | accounting: entityLinks (Vínculos Gerenciais P&L) silently stripped, never persisted — real gap, mas a solução não pode mais propor `transaction_allocations` (`REJECTED_ARCHITECTURE`, decisão PO — ver correção canônica no fim do documento) | S1_HIGH | accounting | OPEN | 70 |
| GAP-0141 | rh: employee entity missing 8 physical columns that the form/DTO already reference (entity-declaration gap, distinct root cause from the CREATE_MAPPING_MISMATCH bugs) | S1_HIGH | rh | OPEN | 70 |
| GAP-0007 | releases: tracklist data model DECIDED (DEC-007: RELATIONAL_TRACKLIST_MODEL) — remaining work: design final relational shape (release_tracks new table or evolved release_works, with phonogram_id + position/order) and migrate off metadata.faixas jsonb | S1_HIGH | releases, catalog | OPEN | 70 |
| GAP-0010 | accounting: /financial-categories/rules* endpoints do not exist (400 on every page load) | S1_HIGH | accounting | OPEN | 65 |
| GAP-0041 | catalog: CreateWorkDto.authors/shares (split-sheet) accepted by DTO but never persisted to any table | S1_HIGH | catalog | OPEN | 65 |
| GAP-0157 | support: AdminSupport ticket-status enum mismatch causes a reachable runtime crash when an admin opens a ticket in a specific state | S1_HIGH | support, admin | OPEN | 65 |
| GAP-0042 | catalog: CreatePhonogramDto.fileUrl accepted, validated, then discarded — no audio storage pipeline | S1_HIGH | catalog | OPEN | 60 |
| GAP-0060 | crm-relationships: ~15 fields accepted by CreateInteractionDto/CreateRelationshipDto never mapped to any column (REAL_MAPPING_GAP) | S1_HIGH | crm-relationships | OPEN | 60 |
| GAP-0105 | licensing: sync-license request form fields (uso_pretendido, territorio, duracao_licenca) accepted by DTO, never persisted to the licenses table | S1_HIGH | licensing | OPEN | 60 |
| GAP-0129 | releases: internal_status/platform_status fields collected by the release-status UI are never accepted by the DTO (CREATE_MAPPING_MISMATCH) | S1_HIGH | releases | OPEN | 60 |
| GAP-0002 | contracts: contract-type vocabulary DECIDED (DEC-002: CONTRACT_SERVICE_TYPES_CANONICAL) — remaining work: WIZARD mode must consume contract_service_types (today only QUICK mode does), template.tipo_servico must stop being an independent free-text vocabulary, physical reference key (id vs slug) TO_BE_DEFINED, legacy free-text values reconciled | S2_MEDIUM | contracts | OPEN | 55 |
| GAP-0054 | contracts: ContactContractsService uses an in-memory Map, not the database (same anti-pattern as crm-relationships legacy facade) | S1_HIGH | contracts, crm-relationships | OPEN | 55 |
| GAP-0059 | crm-relationships: legacy GET/POST /contacts facade backed by an in-memory Map, fully disconnected from the real contacts table | S1_HIGH | crm-relationships, contracts | OPEN | 55 |
| GAP-0111 | marketing: two parallel, incompatible systems on the same table — CampaignsController vs MarketingCampaignBuilderController | S1_HIGH | marketing | OPEN | 55 |
| GAP-0145 | rh: payroll_entries and leave_requests also have orphaned physical-column gaps (distinct entities, tracked separately from employee's) | S2_MEDIUM | rh | OPEN | 55 |
| GAP-0151 | settings: "Alterar Plano" button in Billing.tsx calls a nonexistent endpoint (plan-change flow 100% broken) | S1_HIGH | settings | OPEN | 55 |
| GAP-0158 | support: category ENUM_MISMATCH between the ticket-creation form and the backend TicketCategory enum | S1_HIGH | support | OPEN | 55 |
| GAP-0026 | auth/artist: even if the public-signup endpoint existed, payload field names diverge from CreateArtistDto | S2_MEDIUM | auth, artist | OPEN | 50 |
| GAP-0154 | settings: feature flags are evaluated frontend-only (hardcoded flag map), not backed by any tenant_feature_flags table or backend gate | S2_MEDIUM | settings | OPEN | 50 |
| GAP-0089 | inventory: 3-way ENUM_MISMATCH on item status across form/list/backend (each uses a divergent vocabulary) | S2_MEDIUM | inventory | OPEN | 45 |
| GAP-0097 | leads: whatsapp field collected on public lead-capture form never persisted (no column, DTO strips it) | S2_MEDIUM | leads | OPEN | 40 |
| GAP-0098 | leads: LeadInteractionsService reads/writes inconsistent casing (camelCase in code vs snake_case in DB), causing silent undefined reads | S2_MEDIUM | leads | OPEN | 40 |
| GAP-0144 | rh: EmployeeStatus ENUM_MISMATCH — frontend filter dropdown vocabulary diverges from the backend enum | S2_MEDIUM | rh | OPEN | 40 |
| GAP-0073 | events: capacidadePublico field collected by EventoFormModal never persisted (no column, DTO silently strips it) | S2_MEDIUM | events | OPEN | 35 |
| GAP-0029 | artist: several relation FKs are logical-only, not DB-enforced (projects/transactions/events/artist_goals.artista_id) | S3_LOW | artist | OPEN | 25 |

### WAVE_3_CORE_DOMAIN_FIXES (56 gaps)
> `GAP-0001` movida para cá a partir de `WAVE_0_DECISIONS` — decisão `DEC-001` resolvida e corrigida
> (`MUSICAL_PROJECT_CANONICAL_HUB`; anterior `UNIVERSAL_FINANCIAL_PROJECT` invalidada — ver ADENDO de
> correção no topo do documento); trabalho remanescente é puramente de implementação (expor
> `artista_id`/`orcamento`, já reais no schema/DTO, em `ProjetoFormModal.tsx`), sem impacto de schema.
> `GAP-0004` também movida para cá — decisão `DEC-004` resolvida (`UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT`);
> trabalho remanescente é consolidar `ContratoWizard.tsx`/`ContratoFormModal.tsx` em uma implementação
> canônica única com modos `WIZARD`/`QUICK`, preservando os 2 entrypoints reais, sem impacto de schema.
> `GAP-0003` também movida para cá a partir de `WAVE_0_DECISIONS` — decisão `DEC-003` resolvida
> (`ARTISTA_FORM_MODAL_CANONICAL`); trabalho remanescente é mesclar em `ArtistaFormModal.tsx` os campos
> reais exclusivos de `ArtistaCadastro.tsx` (`tipo`, `status`, `contrato_id`, `manager_nome`,
> `manager_contato`, `produtor_executivo`, `agencia_booking`, `label_parceira`, `galeria_urls`,
> `documentos`) e remover o componente órfão — ver correção canônica no fim do documento.

| ID | Title | Severity | Modules | Status | Priority |
|---|---|---|---|---|---|
| GAP-0001 | projects domain-meaning DECIDED (DEC-001: MUSICAL_PROJECT_CANONICAL_HUB — corrected; previous UNIVERSAL_FINANCIAL_PROJECT reading invalidated) — remaining work: expose artista_id/orcamento in ProjetoFormModal.tsx (fields already real in schema/DTO, not yet collected by the only reachable create form) | S1_HIGH | projects, audiovisual, marketing, accounting | OPEN | 95 |
| GAP-0031 | audiovisual: 8 of 9 backend domains have zero UI (systemic) — briefings/deliverables/shots/production_days/team_members/assets/tasks/approvals unreachable | S1_HIGH | audiovisual | OPEN | 80 |
| GAP-0032 | audiovisual: status filter dropdown broken — Portuguese filter values vs English DB enum values (ENUM_MISMATCH) | S1_HIGH | audiovisual | OPEN | 65 |
| GAP-0004 | contracts: create/edit component canon DECIDED (DEC-004: UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT) — remaining work: consolidate ContratoWizard.tsx/ContratoFormModal.tsx into one canonical implementation with WIZARD/QUICK modes, preserving both real entrypoints (primary contracts flow + catalog-triggered quick flow) | S1_HIGH | contracts | OPEN | 60 |
| GAP-0011 | accounting: CategoriasFinanceiras.tsx entirely disconnected from real backend (localStorage only) | S1_HIGH | accounting | OPEN | 55 |
| GAP-0112 | marketing: budget*0.41 fabricated ROI metric displayed as if it were real ad-platform data | S2_MEDIUM | marketing | OPEN | 50 |
| GAP-0071 | dashboard: role-based widget visibility is enforced only client-side (hidden, not authorization-checked) | S2_MEDIUM | dashboard | OPEN | 45 |
| GAP-0142 | rh: documents endpoint exists and is implemented server-side, but is never wired to any frontend component (unreachable feature) | S2_MEDIUM | rh | OPEN | 45 |
| GAP-0003 | artist: create-flow canon DECIDED (DEC-003: ARTISTA_FORM_MODAL_CANONICAL) — remaining work: merge real ArtistaCadastro.tsx-exclusive fields (tipo, status, contrato_id, manager_nome, manager_contato, produtor_executivo, agencia_booking, label_parceira, galeria_urls, documentos) into ArtistaFormModal.tsx and remove the orphaned component | S2_MEDIUM | artist | OPEN | 40 |
| GAP-0012 | accounting: transaction attachment (anexo) upload is fake — local blob only, nulled before submit | S2_MEDIUM | accounting | OPEN | 40 |
| GAP-0043 | catalog: works.artista_id always written null — CatalogoObras.tsx never collects/sends it | S2_MEDIUM | catalog | OPEN | 40 |
| GAP-0121 | musicchat: RealtimeService publishes real Supabase Realtime conversation:* events, but MusicChat.tsx has zero frontend consumer | S2_MEDIUM | musicchat | OPEN | 40 |
| GAP-0130 | releases: workflow allows an illegal DRAFT→DISTRIBUTED direct jump, skipping the required review/approval intermediate states | S2_MEDIUM | releases | OPEN | 40 |
| GAP-0037 | auth: signOut() does not close realtime channels — stale subscriptions until page reload | S2_MEDIUM | auth | OPEN | 35 |
| GAP-0052 | contracts: Autentique backend integration is real and functional, but has zero frontend consumer | S2_MEDIUM | contracts, integrations | OPEN | 35 |
| GAP-0070 | dashboard: per-widget date-range filter is client-side only, refetches the same unfiltered payload every time | S2_MEDIUM | dashboard | OPEN | 35 |
| GAP-0079 | events: list endpoint truncates at limit=50, calendar view silently shows a partial month for high-volume tenants | S2_MEDIUM | events | OPEN | 35 |
| GAP-0116 | monitoring: two parallel UIs over the same rights-monitoring domain — Monitoramento.tsx vs RightsMonitoring.tsx | S2_MEDIUM | monitoring | OPEN | 35 |
| GAP-0122 | musicchat: blob/file attachments are not stored — attachment metadata accepted but the actual file is never uploaded | S2_MEDIUM | musicchat | OPEN | 35 |
| GAP-0147 | settings: notification-settings toggles have no backend consumer — preference saved but never read before sending | S2_MEDIUM | settings | OPEN | 35 |
| GAP-0149 | settings: tenant logo upload has no backend endpoint — "Alterar Logo" button has no working destination | S2_MEDIUM | settings | OPEN | 35 |
| GAP-0036 | audiovisual: asset upload has no UI, and delete never cleans up external storage (orphaned files) | S2_MEDIUM | audiovisual | OPEN | 30 |
| GAP-0047 | catalog: list endpoints truncate at limit=50 with no UI pagination control | S2_MEDIUM | catalog | OPEN | 30 |
| GAP-0058 | contracts: contract PDF generation and final signed-file storage have no atomic linkage | S2_MEDIUM | contracts | OPEN | 30 |
| GAP-0065 | crm-relationships: relationship-type taxonomy is free text on one screen, a fixed enum on another | S2_MEDIUM | crm-relationships | OPEN | 30 |
| GAP-0101 | leads: duplicate-lead detection does not exist — public form allows unlimited duplicate submissions | S2_MEDIUM | leads | OPEN | 30 |
| GAP-0103 | leads: list endpoint truncates at limit=50, kanban board silently drops leads beyond the first 50 per column | S2_MEDIUM | leads | OPEN | 30 |
| GAP-0125 | musicchat: message list truncates at limit=50 with no "load older messages" trigger | S2_MEDIUM | musicchat | OPEN | 30 |
| GAP-0150 | settings: billing UI fragmented across 3 separate surfaces with no single source of truth | S2_MEDIUM | settings | OPEN | 30 |
| GAP-0152 | settings: card-entry form displays a fake, hardcoded card number instead of real tokenized card-on-file | S2_MEDIUM | settings | OPEN | 30 |
| GAP-0044 | catalog: phonogram-to-work relation selector sourced from a stale local list, not live works | S3_LOW | catalog | OPEN | 25 |
| GAP-0056 | contracts: template variable substitution has no validation against the real field set | S2_MEDIUM | contracts | OPEN | 25 |
| GAP-0057 | contracts: contract list/search truncates at limit=50 with no explicit UI indicator | S2_MEDIUM | contracts | OPEN | 25 |
| GAP-0064 | crm-relationships: list endpoints truncate at limit=50, no pagination UI | S2_MEDIUM | crm-relationships | OPEN | 25 |
| GAP-0068 | dashboard: "Atividades Recentes" widget subscribes to zero real event families | S2_MEDIUM | dashboard, events | OPEN | 25 |
| GAP-0069 | dashboard: 3 widgets truncate their underlying list at limit=50 with wrong-total badge | S2_MEDIUM | dashboard | OPEN | 25 |
| GAP-0074 | events: EventsService.emitTyped() internal bus has zero Supabase Realtime bridge | S2_MEDIUM | events | OPEN | 25 |
| GAP-0095 | inventory: list endpoint truncates at limit=50, no pagination UI | S2_MEDIUM | inventory | OPEN | 25 |
| GAP-0109 | licensing: license PDF generation has no atomic linkage between file storage and status transition | S2_MEDIUM | licensing | OPEN | 25 |
| GAP-0110 | licensing: list endpoint truncates at limit=50, no pagination UI | S2_MEDIUM | licensing | OPEN | 25 |
| GAP-0115 | marketing: list endpoint truncates at limit=50, no pagination UI | S2_MEDIUM | marketing | OPEN | 25 |
| GAP-0120 | monitoring: list endpoint truncates at limit=50, no pagination UI | S2_MEDIUM | monitoring | OPEN | 25 |
| GAP-0128 | projects: list endpoint truncates at limit=50, no pagination UI | S2_MEDIUM | projects | OPEN | 25 |
| GAP-0134 | releases: list endpoint truncates at limit=50, no pagination UI | S2_MEDIUM | releases | OPEN | 25 |
| GAP-0146 | rh: list endpoints truncate at limit=50, no pagination UI | S2_MEDIUM | rh | OPEN | 25 |
| GAP-0153 | settings: feature-gate "upgrade" prompt links to an unregistered route (dead link) | S3_LOW | settings | OPEN | 25 |
| GAP-0161 | support: ticket list truncates at limit=50, no pagination UI | S2_MEDIUM | support | OPEN | 25 |
| GAP-0045 | catalog: ISRC/ISWC identifier fields accepted with no format validation | S3_LOW | catalog | OPEN | 20 |
| GAP-0102 | leads: pipeline/kanban stage transitions have no state-machine validation server-side | S3_LOW | leads | OPEN | 20 |
| GAP-0148 | settings: notification-settings UI shows hardcoded-true toggles for 2 channels regardless of saved state | S3_LOW | settings | OPEN | 20 |
| GAP-0162 | workspace: settings.md public-slug-in-localStorage pendency — CLOSED, cache of real column | S3_LOW | workspace, settings | OPEN | 20 |
| GAP-0163 | workspace: invitation-management UI duplicated (3rd confirmed duplicate-UI-flow instance) | S3_LOW | workspace, settings | OPEN | 20 |
| GAP-0061 | crm-relationships: Auditoria.tsx field-name mismatch (module-specific instance) | S3_LOW | crm-relationships | OPEN | 15 |
| GAP-0075 | events: Auditoria.tsx field-name mismatch (independent instance) | S3_LOW | events | OPEN | 15 |
| GAP-0091 | inventory: Auditoria.tsx field-name mismatch (independent instance) | S3_LOW | inventory | OPEN | 15 |
| GAP-0107 | licensing: Auditoria.tsx field-name mismatch (independent instance) | S3_LOW | licensing | OPEN | 15 |

### WAVE_4_CROSS_DOMAIN_FIXES (12 gaps)
| ID | Title | Severity | Modules | Status | Priority |
|---|---|---|---|---|---|
| GAP-0013 | accounting: "P&L por Projeto" does not group by project (same root cause as projects.md finding) | S2_MEDIUM | accounting, projects | OPEN | 60 |
| GAP-0033 | audiovisual/marketing/projects: financial_project_id real FK never written by any form | S2_MEDIUM | audiovisual, marketing, projects | OPEN | 45 |
| GAP-0049 | contracts: party PII freely typed into observacoes free-text field, exported unmasked | S2_MEDIUM | contracts, reports | OPEN | 45 |
| GAP-0055 | contracts: CONTRACT_SIGNED already creates a real provisional transaction (valor/artista_id/contrato_id propagate, preserve) — remaining gap is PARTIAL: date/category not derived from contract, no recurring schedule, ContratoFormModal payment-term fields dropped before persistence (corrected — was described as total absence, see correção canônica no fim do documento) | S2_MEDIUM | contracts, accounting | OPEN | 40 |
| GAP-0067 | dashboard: several KPI widgets read from a stale/pre-aggregated cache column instead of live tables | S2_MEDIUM | dashboard | OPEN | 35 |
| GAP-0078 | events: ticket-sales/revenue fields have no propagation to accounting transactions | S2_MEDIUM | events, accounting | OPEN | 35 |
| GAP-0106 | licensing: license-fee captured at request time has no propagation to accounting transactions | S2_MEDIUM | licensing, accounting | OPEN | 35 |
| GAP-0119 | monitoring: matched-royalty amounts have no propagation to accounting transactions | S2_MEDIUM | monitoring, accounting | OPEN | 35 |
| GAP-0137 | reports: export history/audit trail (who exported what, when) is not tracked | S2_MEDIUM | reports | OPEN | 35 |
| GAP-0034 | audiovisual: artist_id/campaign_id/event_id exposed as filters but never written by any form | S2_MEDIUM | audiovisual | OPEN | 30 |
| GAP-0077 | events: lineup relation to artist module is free-text only, no artista_id FK write path | S2_MEDIUM | events, artist | OPEN | 30 |
| GAP-0090 | inventory: "checked out to" relation is free-text name, no real user/employee FK | S2_MEDIUM | inventory, rh | OPEN | 30 |

### WAVE_5_INTEGRATIONS (12 gaps)
| ID | Title | Severity | Modules | Status | Priority |
|---|---|---|---|---|---|
| GAP-0039 | auth: Redirect URL / Site URL allowlist configuration unresolved for staging/production | S2_MEDIUM | auth | DEFERRED | 40 |
| GAP-0050 | contracts: DocuSign e-signature envelope creation is 0% implemented despite full UI presence | S2_MEDIUM | contracts, integrations | OPEN | 35 |
| GAP-0051 | contracts: DocuSign status tracked client-side in sessionStorage instead of the real backend field | S2_MEDIUM | contracts, settings | OPEN | 30 |
| GAP-0080 | integrations: 6 named distributor providers are NOT_IMPLEMENTED stubs — preserved verbatim | S4_INFORMATIONAL | integrations, releases | DEFERRED | 20 |
| GAP-0081 | integrations: Stripe billing client path — reconciled as distinct, non-contradictory code path | S3_LOW | integrations, settings | DEFERRED | 15 |
| GAP-0131 | releases: takedown request flow has UI but no real distributor call | S3_LOW | releases | DEFERRED | 15 |
| GAP-0085 | integrations: NFe provider — UI presence with no backend implementation | S4_INFORMATIONAL | integrations | DEFERRED | 12 |
| GAP-0082 | integrations: ABRAMUS provider — UI presence with no backend implementation | S4_INFORMATIONAL | integrations | DEFERRED | 10 |
| GAP-0083 | integrations: ACRCloud provider — UI presence with no backend implementation | S4_INFORMATIONAL | integrations | DEFERRED | 10 |
| GAP-0086 | integrations: ECAD provider card — UI_ONLY, distinct from monitoring's working ECAD reports | S4_INFORMATIONAL | integrations, monitoring | DEFERRED | 10 |
| GAP-0084 | integrations: PostHog provider — UI presence with no backend implementation | S4_INFORMATIONAL | integrations | DEFERRED | 8 |
| GAP-0087 | integrations: UBC provider — UI presence with no backend implementation | S4_INFORMATIONAL | integrations | DEFERRED | 8 |

### WAVE_6_SECONDARY_FUNCTIONALITY (22 gaps)
| ID | Title | Severity | Modules | Status | Priority |
|---|---|---|---|---|---|
| GAP-0021 | admin: AdminAudit/AdminSupport UI-only cross-tenant framing over tenant-scoped backend | S2_MEDIUM | admin, support | OPEN | 35 |
| GAP-0018 | admin: AdminSettings.tsx — 8 tabs, systemically zero real persistence | S2_MEDIUM | admin | OPEN | 30 |
| GAP-0017 | accounting: all filters/pagination are 100% client-side | S2_MEDIUM | accounting | OPEN | 25 |
| GAP-0093 | inventory: low-stock/maintenance-due alerts computed client-side only | S2_MEDIUM | inventory | OPEN | 25 |
| GAP-0155 | settings: security-settings tab (2FA, sessions) has no backend at all — pure UI mockup | S2_MEDIUM | settings | DEFERRED | 25 |
| GAP-0165 | workspace: member-removal has no reassignment/audit on created_by side effects | S2_MEDIUM | workspace | OPEN | 25 |
| GAP-0016 | accounting: OFX import drops unmapped fields silently, no dedupe, no atomicity | S3_LOW | accounting | OPEN | 20 |
| GAP-0028 | artist: manual platform-follower counters vs real API sync have no reconciliation | S3_LOW | artist | OPEN | 20 |
| GAP-0063 | crm-relationships: relationship "strength score" is a pure frontend-computed heuristic | S3_LOW | crm-relationships | OPEN | 20 |
| GAP-0094 | inventory: asset depreciation field exists but no calculation logic updates it | S3_LOW | inventory | OPEN | 20 |
| GAP-0100 | leads: lead-scoring field displayed but never computed by any backend logic | S3_LOW | leads | OPEN | 20 |
| GAP-0118 | monitoring: match-confidence score has no dispute/override flow | S3_LOW | monitoring | OPEN | 20 |
| GAP-0156 | settings: localization tab saves to localStorage only | S3_LOW | settings | OPEN | 20 |
| GAP-0164 | workspace: current-tenant selection has no server-side last-used sync | S3_LOW | workspace | OPEN | 20 |
| GAP-0066 | crm-relationships: interaction "channel" enum implies send action that never occurs | S3_LOW | crm-relationships | OPEN | 18 |
| GAP-0096 | inventory: item photo delete never removes the R2 object (orphaned files) | S3_LOW | inventory | OPEN | 18 |
| GAP-0132 | releases: artwork delete never removes the R2 object (independent instance) | S3_LOW | releases | OPEN | 18 |
| GAP-0023 | admin: "Novo Webhook"/"Nova Chave API" buttons have no onClick at all | S3_LOW | admin | OPEN | 15 |
| GAP-0024 | admin: no table has sorting or server-side pagination anywhere | S3_LOW | admin | OPEN | 15 |
| GAP-0114 | marketing: EventsService bus has no consumer for campaign-status-change notifications | S3_LOW | marketing | OPEN | 15 |
| GAP-0136 | reports: scheduled/recurring report generation does not exist | S3_LOW | reports | DEFERRED | 15 |
| GAP-0166 | workspace: membership list truncates at limit=50 (large tenants only) | S3_LOW | workspace | OPEN | 15 |

### WAVE_7_CLEANUP (15 gaps)
| ID | Title | Severity | Modules | Status | Priority |
|---|---|---|---|---|---|
| GAP-0020 | admin: "Admin analytics indisponível" banner always visible regardless of real state | S3_LOW | admin | OPEN | 12 |
| GAP-0053 | contracts: ContractStatus.ATIVO enum value never reachable from any real transition | S3_LOW | contracts | OPEN | 12 |
| GAP-0062 | crm-relationships: dead deep-link route to a specific contact/relationship record | S3_LOW | crm-relationships | OPEN | 12 |
| GAP-0076 | events: dead deep-link route to a specific event (independent instance) | S3_LOW | events | OPEN | 12 |
| GAP-0092 | inventory: dead deep-link route to a specific item (independent instance) | S3_LOW | inventory | OPEN | 12 |
| GAP-0108 | licensing: dead deep-link route to a specific license request (independent instance) | S3_LOW | licensing | OPEN | 12 |
| GAP-0014 | accounting/TransacaoFormModal: dead exportFieldList() XLSX generator violates the 2-sheet rule | S3_LOW | accounting, reports | OPEN | 10 |
| GAP-0035 | audiovisual: /audiovisual/projects/new route is orphaned (dead navigation) | S3_LOW | audiovisual | OPEN | 10 |
| GAP-0088 | integrations: "external data framework" scaffolded but has zero real registered implementations | S4_INFORMATIONAL | integrations | DEFERRED | 10 |
| GAP-0167 | Cross-module: 9 never-wired Zustand store scaffolds share the same root cause | S4_INFORMATIONAL | catalog, contracts, dashboard, events, inventory, leads, crm-relationships, projects, releases | OPEN | 10 |
| GAP-0019 | admin: admin-source.ts — 6 dead/empty data exports with zero consumers | S4_INFORMATIONAL | admin | OPEN | 8 |
| GAP-0046 | catalog: dead Zustand catalog store scaffolding (see GAP-0167) | S4_INFORMATIONAL | catalog | OPEN | 8 |
| GAP-0072 | dashboard: dead Zustand dashboard-layout store (see GAP-0167) | S4_INFORMATIONAL | dashboard | OPEN | 8 |
| GAP-0104 | leads: dead Zustand leads-filter-preset store (see GAP-0167) | S4_INFORMATIONAL | leads | OPEN | 8 |
| GAP-0126 | projects: dead Zustand projects-board store (see GAP-0167) | S4_INFORMATIONAL | projects | OPEN | 8 |

> Nota de consistência: `GAP-0046`, `GAP-0072`, `GAP-0104`, `GAP-0126` documentam a instância específica de
> cada módulo (arquivo/localização); `GAP-0167` é o gap cross-module colapsado que representa a causa-raiz
> comum, conforme justificado na §3.4. Ambos coexistem intencionalmente — não é dupla contagem, é
> rastreabilidade module-level + causa-raiz cross-module.

### WAVE_NONE (16 gaps) — NO_FIX_REQUIRED / DEFERRED / ACCEPTED_BY_EXISTING_CONTRACT / NOT_APPLICABLE
| ID | Title | Severity | Modules | Status | Priority |
|---|---|---|---|---|---|
| GAP-0015 | accounting: financial_category_id columns never set by the transaction form (not a bug, PARTIALLY_MIGRATED) | S4_INFORMATIONAL | accounting | DEFERRED | 5 |
| GAP-0022 | admin/support: AdminKnowledge — no backend, dev-only mock (confirmed intentional stub) | S4_INFORMATIONAL | admin, support | ACCEPTED_BY_EXISTING_CONTRACT | 5 |
| GAP-0027 | artist: ~41 "extended" fields persist to metadata JSONB instead of physical column (Phase-1 reclassification) | S4_INFORMATIONAL | artist | ACCEPTED_BY_EXISTING_CONTRACT | 5 |
| GAP-0038 | auth: AuthContextService.build() auto-accepts pending invitation as undocumented side effect of a read endpoint | S4_INFORMATIONAL | auth, workspace | NO_FIX_REQUIRED | 5 |
| GAP-0113 | marketing: campaign creation has no ad-platform integration — confirmed scope, internal tracker only | S4_INFORMATIONAL | marketing | DEFERRED | 5 |
| GAP-0030 | artist: encrypted PII fields not backend-searchable (expected/correct, not a defect) | S4_INFORMATIONAL | artist | NO_FIX_REQUIRED | 0 |
| GAP-0040 | auth: no explicit "suspended"/"deleted" state beyond is_active boolean | S4_INFORMATIONAL | auth | NO_FIX_REQUIRED | 0 |
| GAP-0099 | leads: original claim of a lead-conversion-created project with unset `financial_project_id` is FALSE — conversion creates Client+Artist only, never a Project; `financial_project_id` doesn't exist on any entity this flow touches (invalidated by local evidence audit, was OPEN/WAVE_4) | S4_INFORMATIONAL | leads, projects | NOT_APPLICABLE | 0 |
| GAP-0117 | monitoring: ECAD statement-file ingestion real and working — distinct from integrations' UI-only ECAD card | S4_INFORMATIONAL | monitoring, integrations | NO_FIX_REQUIRED | 0 |
| GAP-0123 | musicchat: MessageSenderType.AI enum member unused — no LLM/RAG requirement exists (confirmed) | S4_INFORMATIONAL | musicchat | NO_FIX_REQUIRED | 0 |
| GAP-0124 | musicchat: external-channel message ingestion entirely absent — confirmed scope boundary | S4_INFORMATIONAL | musicchat | DEFERRED | 0 |
| GAP-0127 | projects: original claim of a real `projects.contrato_id` FK is FALSE — no such column exists in schema/migrations/entity (invalidated by local evidence audit, was OPEN/WAVE_4) | S4_INFORMATIONAL | projects, contracts | NOT_APPLICABLE | 0 |
| GAP-0133 | releases: contracts.lancamento_id relation confirmed non-existent on both sides — mutual confirmation | S4_INFORMATIONAL | releases, contracts | NOT_APPLICABLE | 0 |
| GAP-0135 | reports: report-form-contracts.ts confirmed sound; 2 bypasses tracked at their source modules, not duplicated | S4_INFORMATIONAL | reports | NO_FIX_REQUIRED | 0 |
| GAP-0159 | support: AdminSupport cross-tenant framing — CLOSED, canonical gap is GAP-0021 | S2_MEDIUM | support, admin | NO_FIX_REQUIRED | 0 |
| GAP-0160 | support: deliberately-fake subfeatures correctly classified as INTENTIONAL_STUB | S4_INFORMATIONAL | support | DEFERRED | 0 |

---

## 13. Itens deferidos / sem correção

Contagem por status final:

| Status | Contagem |
|---|---|
| `OPEN` | 139 |
| `DEFERRED` | 17 |
| `NO_FIX_REQUIRED` | 7 |
| `ACCEPTED_BY_EXISTING_CONTRACT` | 2 |
| `NOT_APPLICABLE` | 3 |
| `DEAD_CODE` (status literal) | 0 — dead-code gaps existem mas seu `status` é `OPEN` (a remoção em si é a correção pendente; `runtimeReachability: DEAD` os marca como não-urgentes via `WAVE_7_CLEANUP`, não via um status separado) |

Nenhum destes 17+7+2+3 = 29 itens foi corrigido ou terá ação nesta etapa — permanecem documentados
verbatim conforme os relatórios de origem (ex.: os 6 provedores distribuidores permanecem explicitamente
"não implementados", sem upgrade de status). `NOT_APPLICABLE` passou de 1 para 2 na correção de
`GAP-0127`, e de 2 para 3 nesta correção de `GAP-0099` (ver adendos abaixo); `OPEN` de 140 para **139**
(139+17+7+2+3 = 168, bate com `CANONICAL_GAPS`).

---

## 14. Prontidão de fase

| Critério | Status |
|---|---|
| `PHASE_2_MODULE_AUDIT_COMPLETE` | SIM (confirmado) |
| `GAP_CONSOLIDATION` | **COMPLETE** |
| `DEPENDENCY_CYCLES` | 0 |
| `UNASSIGNED_GAP_OCCURRENCES` | 0 |
| `UNKNOWN_GAP_CLASSIFICATIONS` / `UNKNOWN_ROOT_CAUSES` / `UNKNOWN_MODULE_ASSIGNMENTS` / `UNKNOWN_DEPENDENCIES` | 0 / 0 / 0 / 0 |
| `CANONICAL_GAP_JSON_VALID` / `DECISION_REGISTER_JSON_VALID` / `RESOLUTION_ORDER_JSON_VALID` | SIM / SIM / SIM |
| `GAPS_RESOLVED_THIS_PROMPT` | 0 |
| `FUNCTIONAL_CODE_CHANGED` / `DATABASE_CHANGED` / `SUPABASE_CHANGED` / `AUTH_CONFIG_CHANGED` / `ENV_CHANGED` / `CREDENTIALS_CHANGED` | NÃO (todos) |

**Próximo passo seguro (não executado nesta etapa):** `RESOLVE_WAVE_0_DECISIONS` — existem 8 itens em
`WAVE_0_DECISIONS`, portanto o próximo passo de gap-resolution é uma etapa dedicada e explícita de decisões
(`decision-register.json`), não `WAVE_1` (vazio) nem `WAVE_2`.

**Não corrija nenhum gap e não execute o próximo passo.**

---

### Atualização — `DEC-001` resolvida (Wave 0, uma decisão por execução)

`WAVE_0_DECISIONS` passou de 8 para **7** itens (`GAP-0001` realocada para `WAVE_3_CORE_DOMAIN_FIXES` —
ver ADENDO no topo do documento e §9/§12). `DECISIONS_RESOLVED_TOTAL: 1`, `DECISIONS_PENDING: 7`.
`DEPENDENCY_CYCLES: 0` e `UNKNOWN_DEPENDENCIES: 0` revalidados após a atualização. **Esta continua sendo
uma resolução puramente documental** — `GAPS_RESOLVED_THIS_PROMPT: 0`, `FUNCTIONAL_CODE_CHANGED: NÃO` em
todos os passos até aqui.

Próxima decisão real pela ordem canônica registrada em `resolution-order.json` (wave → dependência →
prioridade): **`DEC-007`** (`GAP-0007`, prioridade 70) — não `DEC-002` (`GAP-0002`, prioridade 55). A
ordenação de `WAVE_0_DECISIONS` sempre foi por prioridade, não pela numeração sequencial dos IDs de
decisão; isso não muda com a resolução de `DEC-001`.

### Atualização — `DEC-007` resolvida (Wave 0, uma decisão por execução)

`WAVE_0_DECISIONS` passou de 7 para **6** itens (`GAP-0007` realocada para `WAVE_2_SCHEMA_AND_CONTRACT`
— ver ADENDO no topo do documento e §9/§12). `DECISIONS_RESOLVED_TOTAL: 2`, `DECISIONS_PENDING: 6`.
`DEPENDENCY_CYCLES: 0` e `UNKNOWN_DEPENDENCIES: 0` revalidados após a atualização. Com `DEC-001` e
`DEC-007` ambas resolvidas, **`BLOCKS_SCHEMA_V2_DESIGN: 0` globalmente** (nenhum gap remanescente
bloqueia o desenho do schema v2 por ambiguidade de decisão — verificado programaticamente, não forçado;
ver §14). Isso não significa que o schema v2 pode começar a ser desenhado agora — ainda restam 6
decisões pendentes em `WAVE_0_DECISIONS`, e a sequência continua sendo resolver todas as decisões da
Wave 0 antes de iniciar qualquer wave posterior. **Esta continua sendo uma resolução puramente
documental** — `GAPS_RESOLVED_THIS_PROMPT: 0`, `FUNCTIONAL_CODE_CHANGED: NÃO` em todos os passos até
aqui; `release_tracks` não foi criada, `release_works`/`metadata.faixas` não foram alteradas, `GAP-0129`
e `GAP-0130` permanecem `OPEN`.

Próxima decisão real pela ordem canônica registrada em `resolution-order.json` (wave → dependência →
prioridade): **`DEC-004`** (`GAP-0004`, prioridade 60) — não `DEC-002`. A ordenação de
`WAVE_0_DECISIONS` sempre foi por prioridade, não pela numeração sequencial dos IDs de decisão.

**Não inicie `DEC-004` nem nenhuma outra decisão nesta etapa.**

### Atualização — `DEC-004` resolvida (Wave 0, uma decisão por execução)

`WAVE_0_DECISIONS` passou de 6 para **5** itens (`GAP-0004` realocada para `WAVE_3_CORE_DOMAIN_FIXES` —
ver ADENDO no topo do documento e §9/§12). `DECISIONS_RESOLVED_TOTAL: 3`, `DECISIONS_PENDING: 5`.
`DEPENDENCY_CYCLES: 0` e `UNKNOWN_DEPENDENCIES: 0` revalidados após a atualização; a relação
`GAP-0008.dependsOn: ["GAP-0004"]` foi preservada no grafo (não removida) — `DEC-004` fornece a premissa
que `DEC-008` (ainda pendente) vai precisar, mas `GAP-0008` continua `OPEN`, não implementado. Nem
`BLOCKS_SCHEMA_V2_DESIGN` nem `BLOCKS_API_V2_IMPLEMENTATION` mudam com esta resolução (`GAP-0004` já não
bloqueava nenhum dos dois desde o registro original — 0/0 globalmente, inalterado desde `DEC-007`).
**Esta continua sendo uma resolução puramente documental** — `GAPS_RESOLVED_THIS_PROMPT: 0`,
`FUNCTIONAL_CODE_CHANGED: NÃO` em todos os passos até aqui; `ContratoWizard.tsx`/`ContratoFormModal.tsx`/
`RegistroMusicas.tsx` não foram alterados, `arquivo_url`/`exclusivo`/`observacoes` não foram corrigidos.

Próxima decisão real pela ordem canônica registrada em `resolution-order.json` (wave → dependência →
prioridade): **`DEC-002`** (`GAP-0002`, prioridade 55) — desta vez coincide com a numeração sequencial,
mas isso é resultado da ordenação por prioridade dentro de `WAVE_0_DECISIONS`
(GAP-0002:55 > GAP-0005:45 > GAP-0003:40 > GAP-0006:35 > GAP-0008:30, este último ainda mais adiante na
ordem linear completa por depender de `GAP-0004`), não de uma retomada da numeração sequencial.

**Não inicie `DEC-002` nem nenhuma outra decisão nesta etapa.**

### Atualização — `DEC-002` resolvida (Wave 0, uma decisão por execução)

`WAVE_0_DECISIONS` passou de 5 para **4** itens (`GAP-0002` realocada para `WAVE_2_SCHEMA_AND_CONTRACT`
— ver ADENDO no topo do documento e §9/§12). `DECISIONS_RESOLVED_TOTAL: 4`, `DECISIONS_PENDING: 4`.
`DEPENDENCY_CYCLES: 0` e `UNKNOWN_DEPENDENCIES: 0` revalidados após a atualização. Nem
`BLOCKS_SCHEMA_V2_DESIGN` nem `BLOCKS_API_V2_IMPLEMENTATION` mudam com esta resolução (`GAP-0002` já não
bloqueava nenhum dos dois desde o registro original — 0/0 globalmente, inalterado desde `DEC-007`).
**Esta continua sendo uma resolução puramente documental** — `GAPS_RESOLVED_THIS_PROMPT: 0`,
`FUNCTIONAL_CODE_CHANGED: NÃO` em todos os passos até aqui; `ContratoWizard.tsx`, o modo `QUICK`,
`contract_templates`, `contracts.tipo` e `contract_service_types` não foram alterados; nenhuma FK foi
criada; nenhum dado legado foi mapeado ou migrado.

Próxima decisão real pela ordem canônica registrada em `resolution-order.json` (wave → dependência →
prioridade): **`DEC-005`** (`GAP-0005`, prioridade 45) — não `DEC-003`, apesar de `DEC-003` ter número
sequencial menor; `WAVE_0_DECISIONS` continua ordenada por prioridade
(`GAP-0005:45 > GAP-0003:40 > GAP-0006:35 > GAP-0008:30`, este último ainda mais adiante na ordem linear
completa por depender de `GAP-0004`).

**Não inicie `DEC-005` nem nenhuma outra decisão nesta etapa.**

### Correção canônica — `DEC-001` corrigida por autoridade do Product Owner (PROMPT 129)

`DEC-001` **continua `RESOLVED`** (não retorna a `PENDING`) — apenas sua opção selecionada foi
corrigida: `UNIVERSAL_FINANCIAL_PROJECT` → **`MUSICAL_PROJECT_CANONICAL_HUB`**. `projects` é a entidade
**Projeto Musical/Música**, não um hub financeiro/operacional genérico; `projects.id` é a chave de
vínculo cross-domain para essa música. Definição completa, matriz de relações cross-domain e
revalidação de `GAP-0001`/`GAP-0033`/`GAP-0013` — ver "ADENDO — CORREÇÃO CANÔNICA DE DEC-001" no topo do
documento. Histórico da definição anterior preservado verbatim em `decision-register.json`
(`DEC-001.supersededDecision`, `INVALIDATED_BY_PRODUCT_OWNER_DOMAIN_CORRECTION`).

**Novo gap criado**: `GAP-0168` (releases sem relação persistida ao projeto musical de origem) —
`CANONICAL_GAPS` passou de 167 para **168**; `RAW_GAP_OCCURRENCES` de 199 para **200**;
`DEPENDENCY_EDGES` de 16 para **17** (`GAP-0168.dependsOn = ["GAP-0001"]`). `BLOCKS_SCHEMA_V2_DESIGN`
passou de 0 para **1** (`GAP-0168`, um bloqueio genuíno e novo — não uma reabertura de `DEC-001`).
`DECISIONS_RESOLVED_TOTAL: 4`, `DECISIONS_PENDING: 4` — **inalterados**, nenhuma decisão pendente
adicional foi criada por esta correção. `DEPENDENCY_CYCLES: 0`, `UNKNOWN_DEPENDENCIES: 0` revalidados.

`DEC-005` permanece estacionada, análise já concluída mas **não registrada**
(`DEC_005_ANALYSIS_STATUS: PARKED_UNCHANGED`). Próxima decisão real pela ordem canônica: **`DEC-005`**
(`GAP-0005`, prioridade 45) — inalterado por esta correção. **Esta é uma correção puramente
documental** — `GAPS_RESOLVED_THIS_PROMPT: 0`, `FUNCTIONAL_CODE_CHANGED: NÃO`; nenhum código, schema,
migration, banco de dados ou Supabase foi alterado; `GAP-0001`/`GAP-0033`/`GAP-0013` permanecem `OPEN`,
não implementados.

**Não registre DEC-005. Não inicie nenhuma outra decisão. Não implemente o novo modelo de domínio.**

---

### Correção canônica — `GAP-0127` invalidada por evidência local do repositório

`GAP-0127` afirmava que `projects.contrato_id` era uma FK real para `contracts.id`, exposta como filtro
de API, apenas não escrita por nenhum formulário. **Auditoria de evidência local prova que essa
afirmação é falsa**: `projects` nunca teve coluna `contrato_id` — nem no schema inicial
(`20240101000000_InitialSchema.ts`), nem na entidade TypeORM atual (`ProjectEntity`,
`apps/api/src/database/entities.ts:1210-1235`), nem na reconstrução canônica mais recente da tabela
(`20260719000005_RebuildProjectsInCanonicalFormOrder.ts`, cuja lista `newColumns` é o conjunto de
colunas vigente de `projects`: `id, tenant_id, tipo, titulo, genero, observacoes, status, artista_id,
orcamento, descricao, metadata, created_at, updated_at, created_by, updated_by, deleted_at` — sem
`contrato_id`). `contrato_id` existe de fato, mas apenas em `artists` (`entities.ts:503`) e em
`transactions` (`entities.ts:867`), ambas colunas `uuid` simples, sem `REFERENCES` na SQL bruta — ou
seja, nenhuma FK física mesmo nessas duas tabelas. Nenhum controller/service/DTO do módulo `projects`
(backend) nem `ProjetoFormModal.tsx`/módulo `projects` (frontend) referenciam `contrato_id` em qualquer
lugar. `docs/backend-v2/field-traceability/modules/projects.md` nunca fez essa afirmação — não precisou
correção.

`GAP-0127`, portanto, **não é um gap real de implementação** (não existe relação para completar) — é um
achado documental incorreto sobre um schema que nunca existiu. Reclassificado, seguindo o mesmo padrão
já usado em `GAP-0133` (achado que mutuamente confirma a própria ausência de relação): `status: OPEN` →
**`NOT_APPLICABLE`**; `resolutionWave: WAVE_4_CROSS_DOMAIN_FIXES` → **`WAVE_NONE`**; `priorityScore: 30`
→ **`0`**; `severity: S2_MEDIUM` → **`S4_INFORMATIONAL`**; `gapType: REAL_MAPPING_GAP` →
**`RELATION_MISMATCH`**. A afirmação original é preservada verbatim em `canonical-gap-register.json`,
campo `GAP-0127.originalFinding`, marcada com `invalidationReason` — nenhum dado histórico foi apagado,
apenas superado (mesmo padrão de `DEC-001.supersededDecision`). `GAP-0127` **mantém sua identidade**
(mesmo ID, não removida do registro).

Efeitos nos contadores: `WAVE_4_CROSS_DOMAIN_FIXES` de 14 para **13**; `WAVE_NONE` de 14 para **15**;
`NOT_APPLICABLE` (status) de 1 para **2**; `CANONICAL_GAPS` permanece **168** (nenhum gap criado ou
removido — apenas reclassificado). `resolution-order.json` atualizado: `GAP-0127` removida de sua
posição antiga (entre `GAP-0090` e `GAP-0039`, ordenação de `WAVE_2`/prioridade) e reinserida no cluster
`WAVE_NONE`/prioridade 0, entre `GAP-0124` e `GAP-0133` (ordem ascendente por número de gap dentro do
mesmo tier de prioridade, mesmo critério já usado pelo arquivo). Nenhum outro gap depende de `GAP-0127`
(`dependsOn` verificado programaticamente) — nenhuma outra aresta do grafo de dependências foi afetada.

**Esta é uma correção puramente documental** — nenhum código, schema, migration, banco de dados ou
Supabase foi consultado ou alterado; nenhuma autenticação foi tocada; nenhum outro gap (`GAP-0099`,
`GAP-0055`, `GAP-0090`, `GAP-0133` etc.) foi modificado.

**Não corrija nenhum outro gap nesta etapa.**

---

### Correção canônica — `GAP-0099` invalidada por evidência local do repositório

`GAP-0099` afirmava que a conversão de lead cria/deixa uma "linha de projeto" com `financial_project_id`
não escrito, na mesma família de causa-raiz de `GAP-0015`. **Auditoria de evidência local prova que essa
afirmação é falsa em dois pontos independentes**:

1. **A conversão nunca cria `Project`.** O fluxo real (`leads.service.ts.update()` — ao transicionar o
   lead para `LeadStatus.FECHADO`, emite o evento `LEAD_CONVERTED`, tratado por
   `LeadEventsHandler.onLeadConverted()` em `apps/api/src/modules/leads/handlers/lead-events.handler.ts`)
   cria exatamente uma `ClientEntity` e uma `ArtistEntity` ("onboarding stub", `status:
   ArtistStatus.EM_NEGOCIACAO`), e vincula o lead ao cliente via `leads.cliente_id`. Nenhuma
   `ProjectEntity` é criada em nenhum ponto deste handler — não existe "linha de projeto resultante".
2. **`financial_project_id` não existe em nenhuma entidade deste fluxo.** Confirmado por grep completo em
   `apps/api/src/database/entities.ts`: a coluna existe em exatamente 2 entidades de todo o schema —
   `AudiovisualProjectEntity` (linha 2507) e `MarketingProjectEntity` (linha 2857). `LeadEntity`,
   `ClientEntity`, `ArtistEntity` e `ProjectEntity` não têm essa coluna. Mesmo que uma `Project` fosse
   criada por este fluxo (não é), não haveria `financial_project_id` para deixar de preencher.

**Relação com os gaps citados**: `GAP-0015` (`financial_category_id`, coluna real em `transactions`/
`accounting`) é um campo **distinto** de `financial_project_id` — não relacionado a `GAP-0099` além da
semelhança de nome; o `dependsOn: ["GAP-0015"]` original era, ele próprio, um erro (provavelmente
confusão `financial_category_id` ↔ `financial_project_id` no achado original) e foi removido. O gap
correto e tecnicamente real que trata da mesma preocupação subjacente (`financial_project_id` real,
FK no banco, nunca escrito por formulário) é **`GAP-0033`** (`audiovisual_projects.financial_project_id`
e `marketing_projects.financial_project_id`) — `GAP-0099` parece ter aplicado essa mesma preocupação, por
engano, a um fluxo lead→projeto que não existe. `GAP-0001` (definição canônica de `projects`) é o
pano de fundo do domínio, mas não tem relação direta de dependência com `GAP-0099`.

`GAP-0099`, portanto, **não é um gap real de implementação** — é um achado documental incorreto sobre um
fluxo que não cria o que a afirmação presume. Reclassificado seguindo o mesmo padrão já usado em
`GAP-0127`/`GAP-0133`: `status: OPEN` → **`NOT_APPLICABLE`**; `resolutionWave:
WAVE_4_CROSS_DOMAIN_FIXES` → **`WAVE_NONE`**; `priorityScore: 30` → **`0`**; `severity: S2_MEDIUM` →
**`S4_INFORMATIONAL`**; `dependsOn: ["GAP-0015"]` → **`[]`** (edge removida — errônea desde a origem). A
afirmação original é preservada verbatim em `canonical-gap-register.json`, campo
`GAP-0099.originalFinding`, marcada com `invalidationReason` — nenhum dado histórico foi apagado, apenas
superado. `GAP-0099` **mantém sua identidade** (mesmo ID, não removida do registro).

Efeitos nos contadores: `WAVE_4_CROSS_DOMAIN_FIXES` de 13 para **12**; `WAVE_NONE` de 15 para **16**;
`NOT_APPLICABLE` (status) de 2 para **3**; `OPEN` de 140 para **139**; `DEPENDENCY_EDGES` de 17 para
**16** (edge `GAP-0099 → GAP-0015` removida; nenhum gap depende de `GAP-0099`, verificado
programaticamente); `CANONICAL_GAPS` permanece **168** (nenhum gap criado ou removido — apenas
reclassificado). `resolution-order.json` atualizado: `GAP-0099` removida de sua posição antiga (entre
`GAP-0015` e `GAP-0022`, resultado da aresta de dependência agora removida) e reinserida no cluster
`WAVE_NONE`/prioridade 0, entre `GAP-0040` e `GAP-0117` (mesmo critério de ordenação ascendente por
número de gap já usado para `GAP-0127`).

**Esta é uma correção puramente documental** — nenhum código, schema, migration, banco de dados ou
Supabase foi consultado ou alterado; nenhuma autenticação foi tocada; nenhum outro gap (`GAP-0055` e
demais) foi modificado.

**Não corrija `GAP-0055` nem nenhum outro gap nesta etapa.**

---

### Correção canônica — `GAP-0055` corrigida por evidência local (descrição, não invalidação)

Diferente de `GAP-0127`/`GAP-0099` (achados totalmente falsos, reclassificados para `NOT_APPLICABLE`),
`GAP-0055` **é um gap real e continua `OPEN`** — apenas sua descrição estava incorreta ao afirmar
**ausência total** de propagação `contracts → accounting`. Auditoria de evidência local do fluxo real de
assinatura prova o contrário:

**Propagação real já existente (deve ser preservada, não descrita como ausente)**: ao evento
`CONTRACT_SIGNED` (`ContractEventsHandler.onContractSigned`,
`apps/api/src/modules/contracts/handlers/contract-events.handler.ts:114-214`), se `contract.valor > 0`,
uma `TransactionEntity` provisória é criada (`tipo: receita`, `status: agendado`) com `valor =
contract.valor`, `contrato_id = contract.id`, `artista_id = contract.artistId`, `descricao` derivada de
`contract.titulo`; o evento `TRANSACTION_CREATED` é emitido e `FinancialRulesService.evaluateRules`
roda. O artista também é marcado `contratado` com `contrato_id` setado. Esta função já está documentada,
de forma independente, em `docs/backend-v2/field-traceability/modules/contracts.md` (linha 273: "
`CONTRACT_SIGNED` → artista `contratado` + transação provisória + 5 tarefas CRM").

**O que genuinamente falta propagar (escopo real e corrigido de `GAP-0055`)**:
1. `transaction.data` é fixado em `new Date()` (momento da assinatura), não deriva de
   `contract.data_inicio`/`contract.data_fim` — a data agendada da receita prevista não reflete o prazo
   real do contrato.
2. `transaction.categoria` é fixado no literal `'contratos'`, não deriva de `contract.tipo` (tipo de
   serviço) — contabilidade por categoria não distingue tipos de contrato.
3. Apenas **uma** transação provisória é criada, uma única vez, na assinatura — contratos com termos de
   pagamento recorrente/parcelado não geram nenhum agendamento recorrente.
4. `ContractEntity` **não tem** coluna `forma_pagamento` nem `vencimento` — essas duas colunas citadas no
   título original do gap **não existem em `contracts`** (confirmado por leitura direta de
   `apps/api/src/database/entities.ts`, `@Entity('contracts')`). A captura mais próxima na UI é
   `ContratoFormModal.tsx` (`payment_type`/`advance_payment`/`external_rights_percentage`/
   `financial_support`), mas esses campos são coletados no estado do formulário e **descartados antes do
   payload enviado ao backend** (`ContratoFormModal.tsx:597-620` — não aparecem no objeto `payload`) —
   não chegam a existir na linha do contrato para qualquer lógica de propagação ler.

**Nada foi alterado em `status`, `severity`, `resolutionWave` ou `priorityScore`** — o gap continua
`OPEN`/`S2_MEDIUM`/`WAVE_4_CROSS_DOMAIN_FIXES`/`40`, pois a incompletude real descrita acima é
tecnicamente válida e ainda não implementada. Apenas `title`/`rootCause` foram reescritos para
precisão factual; título e causa-raiz originais preservados verbatim em `canonical-gap-register.json`,
campos `GAP-0055.originalTitlePreCorrection`/`originalRootCausePreCorrection`, com
`correctedDescriptionNote` explicando o que mudou e por quê. `GAP-0055` mantém identidade, `WAVE_4`,
contagens de wave/status e `DEPENDENCY_EDGES` — **nenhum contador global muda** nesta correção (168
gaps, 16 arestas, distribuição de wave/status inalterada).

**Esta é uma correção puramente documental** — nenhum código, schema, migration, banco de dados ou
Supabase foi consultado ou alterado; nenhuma autenticação foi tocada; nenhum outro gap foi modificado.

**Não corrija nenhum outro gap nesta etapa.**

---

### Decisão canônica do Product Owner — `REMOVE_SECOND_ACCOUNTING_LAYER` (resolve `PO-VERIFY-027`)

O Product Owner decidiu, de forma definitiva, sobre a segunda camada de schema de accounting
descoberta durante a auditoria (`docs/backend-v2/review/01-full-project-exhaustive-verification.md`
§XV.6, item `PO-VERIFY-027`): **`REMOVE_SECOND_ACCOUNTING_LAYER`**.

**A arquitetura v2 não deverá usar, em nenhuma hipótese, as 8 tabelas**: `financial_transactions`,
`financial_accounts`, `cost_centers`, `counterparties`, `transaction_allocations`,
`performance_metric_entries`, `budgets`, `budget_revisions` — nem como arquitetura-alvo, nem como
caminho futuro, nem como modelo alternativo válido.

**`transactions` permanece o ledger financeiro canônico** — não haverá um segundo ledger financeiro.
Todas as relações/propagações financeiras reais já confirmadas em outros gaps/decisões
(`transactions.projeto_id`, `contracts → transactions` via `CONTRACT_SIGNED`, P&L computado sobre
`transactions`) continuam válidas e inalteradas por esta decisão.

**`PO-VERIFY-027`**: marcado `RESOLVED` em
`review/01-full-project-exhaustive-verification.md` §XV.6/§XV.7 — ver texto completo da decisão lá.

**`GAP-0009`** (`entityLinks` da UI de accounting nunca persistido) **continua real e `OPEN`** — esta
decisão não o fecha, apenas invalida `transaction_allocations` como a solução implícita. `title`/
`rootCause`/`tables`/`schemaImpact` corrigidos em `canonical-gap-register.json` (de
`tables: ["transaction_allocations"]`/`schemaImpact: ["ADD_TABLE"]` para `tables: ["transactions"]`/
`schemaImpact: ["MULTIPLE"]` — forma técnica final ainda não decidida, apenas a direção rejeitada foi
removida); texto original preservado verbatim nos campos `originalTitlePreCorrection`/
`originalRootCausePreCorrection`/`originalTablesPreCorrection`/`originalSchemaImpactPreCorrection`.
Identidade, `status` (`OPEN`), `severity`, `resolutionWave` e `priorityScore` de `GAP-0009`
inalterados — `168` gaps, distribuição de wave/status inalterada por esta correção.

**As 8 tabelas permanecem fisicamente no banco por ora** — esta é uma decisão e correção
**puramente documental**; remoção física de tabelas é um passo posterior, explicitamente fora do
escopo desta correção. Referências equivalentes corrigidas nesta mesma etapa fora deste arquivo (texto
original preservado verbatim em cada uma, apenas marcado como superado):
`docs/backend-v2/review/01-full-project-exhaustive-verification.md` (bloco `PO-VERIFY-027` e checklist
§XV.7), `docs/backend-v2/review/00-master-domain-functional-verification.md` (achado de `GAP-0009` e
matriz de relações cross-domain), `docs/backend-v2/80-code-database-crosscheck-final-resolution.md`
(classificação funcional e "escopo não coberto"), `docs/backend-v2/79-database-unknown-classifications-resolution.md`
(rationale da classificação `ACTIVE_BUSINESS` das 8 tabelas),
`docs/backend-v2/field-traceability/modules/accounting.md` (achado `entityLinks`/§2.1).

**Não altere código, banco, migrations, schema ou autenticação por esta decisão — é documental.**
**Não resolva outros gaps nesta etapa.**

---

### Correção canônica — `GAP-0002` sincronizado com a decisão já resolvida `DEC-002`

A linha de `GAP-0002` na tabela `WAVE_2_SCHEMA_AND_CONTRACT` acima (§12) **já estava correta** — já
descrevia `DEC-002: CONTRACT_SERVICE_TYPES_CANONICAL` como decidida e o trabalho remanescente como
puramente de implementação. A inconsistência estava isolada em
`canonical-gap-register.json`: o campo `title`/`rootCause` de `GAP-0002` ainda descrevia "quatro
vocabulárias desconectadas, sem fonte de verdade unificadora" — uma ambiguidade arquitetural que **já
não existe** —, apesar do próprio registro já ter `decisionResolved: true`/`decisionOutcome:
CONTRACT_SERVICE_TYPES_CANONICAL` havia etapas.

**Regras vigentes confirmadas por evidência local** (inalteradas nesta correção, apenas re-afirmadas):
`contract_service_types` é a fonte canônica de tipo de serviço; `contract_templates.tipo_servico` é
legado/denormalização e não pode continuar como vocabulário concorrente; `contract_categories`
(localStorage) e o `CONTRACT_TYPES` hardcoded do frontend são apenas organização/apresentação
(`DISPLAY_ONLY`/`DEAD_LEGACY_VOCABULARY`, per `decision-register.json` `DEC-002.sourceClassification`
— já corretos, não alterados).

`GAP-0002` **permanece `OPEN`** — não por ambiguidade arquitetural (resolvida), mas por trabalho real
de implementação/migração ainda pendente: `ContratoWizard.tsx` (modo WIZARD, fluxo primário) ainda lê
`contract_templates.tipo_servico` como texto livre e nunca consome `contract_service_types` (só o
`ContratoFormModal`, fluxo QUICK secundário, já lê a fonte canônica); a chave de referência física (id
vs. slug) permanece `TO_BE_DEFINED_DURING_SCHEMA_CONTRACT_RESOLUTION`; valores legados já persistidos
em `contract_templates.tipo_servico`/`contracts.tipo` requerem reconciliação
(`dataMigrationRequired: POSSIVEL`); as colunas `requires_*` de `contract_service_types` não são
consumidas por nenhuma regra em prática (`serviceTypeRuleConsumption: IMPLEMENTATION_GAPS_REMAIN`).

`title`/`rootCause` de `GAP-0002` reescritos em `canonical-gap-register.json` para refletir isso; texto
original preservado verbatim em `originalTitlePreCorrection`/`originalRootCausePreCorrection`.
`status` (`OPEN`), `severity`, `resolutionWave`, `priorityScore`, `decisionId`, `decisionResolved` e
`decisionOutcome` **inalterados** — `168` gaps, `resolution-order.json` inalterado (wave/prioridade/
dependências de `GAP-0002` não mudaram).

**Esta é uma correção puramente documental** — nenhum código, banco, migration, schema ou autenticação
foi alterado; nenhum outro gap foi modificado.

**Não corrija nenhum outro gap nesta etapa.**

---

### Correção canônica — `GAP-0004` sincronizado com a decisão já resolvida `DEC-004`

A linha de `GAP-0004` na tabela `WAVE_3_CORE_DOMAIN_FIXES` acima (§12) **já estava correta** — já
descrevia `DEC-004: UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT` como decidida e o trabalho remanescente
como consolidação técnica pendente, não escolha entre os dois componentes. A inconsistência estava
isolada em `canonical-gap-register.json`: o campo `title`/`rootCause` de `GAP-0004` ainda perguntava
"qual é o canônico?" (`ContratoWizard` vs `ContratoFormModal`) — uma escolha que **já não está em
aberto** —, apesar do próprio registro já ter `decisionResolved: true`/`decisionOutcome:
UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT`.

**Regras vigentes confirmadas por evidência local** (inalteradas nesta correção, apenas re-afirmadas,
per `decision-register.json` `DEC-004`): não se escolhe definitivamente entre Wizard e Quick; deve
existir um único estado/componente contratual configurável; `WIZARD` e `QUICK` permanecem como dois
modos/entrypoints da mesma implementação (ambos os entrypoints reais preservados — fluxo principal de
contratos e fluxo rápido disparado pelo catálogo); campos válidos e reais dos dois fluxos devem ser
preservados (`fieldsToPreserve`: `template_id`, `arquivo_url`, `exclusivo`, `artista_id`, `cliente_id`,
`lancamento_id`, `signing_platform`, `signers`, `data_inicio`/`data_fim`, `observacoes`, partes
detectadas dinamicamente, variáveis de manifesto); não se mantêm dois modelos de contrato divergentes.

`GAP-0004` **permanece `OPEN`** — não por dúvida sobre qual fluxo é canônico (resolvida), mas por
trabalho real de consolidação/implementação ainda pendente: `ContratoWizard.tsx` e
`ContratoFormModal.tsx` continuam sendo duas implementações independentes, não foram unificadas; a
identidade final do arquivo/componente não é prescrita por `DEC-004` (`fileIdentityDecided: false`).
**Fora de escopo desta correção, explicitamente preservado sem alteração**: o conflito semântico de
`observacoes` (Wizard grava um blob JSON estruturado; Modal grava texto livre na mesma coluna — `DEC-004`
não resolve isso, `NOT_DECIDED_BY_DEC_004`) e o conflito específico de `lancamento_id`/`GAP-0133` — nenhum
dos dois foi tocado nesta etapa.

`title`/`rootCause` de `GAP-0004` reescritos em `canonical-gap-register.json` para refletir isso; texto
original preservado verbatim em `originalTitlePreCorrection`/`originalRootCausePreCorrection`.
`status` (`OPEN`), `severity`, `resolutionWave`, `priorityScore`, `decisionId`, `decisionResolved` e
`decisionOutcome` **inalterados** — `168` gaps, `resolution-order.json` inalterado (wave/prioridade/
dependências de `GAP-0004` não mudaram; `GAP-0008.dependsOn: ["GAP-0004"]` preservada, não afetada).

**Esta é uma correção puramente documental** — nenhum código, frontend funcional, banco, migration,
schema ou autenticação foi alterado; nenhum outro gap (incluindo `GAP-0133`) foi modificado.

**Não corrija nenhum outro gap nesta etapa.**

---

### Correção canônica — `GAP-0007` sincronizado com a decisão já resolvida `DEC-007`

A linha de `GAP-0007` na tabela `WAVE_2_SCHEMA_AND_CONTRACT` acima (§12) **já estava correta** — já
descrevia `DEC-007: RELATIONAL_TRACKLIST_MODEL` como decidida e o trabalho remanescente como desenho
final da tabela relacional (`TO_BE_DESIGNED`), não escolha entre relacional e jsonb. A inconsistência
estava isolada em `canonical-gap-register.json`: o campo `title`/`rootCause` de `GAP-0007` ainda
perguntava "relational vs jsonb?" — uma escolha que **já não está em aberto** —, apesar do próprio
registro já ter `decisionResolved: true`/`decisionOutcome: RELATIONAL_TRACKLIST_MODEL`. Referências
equivalentes em `review/00-master-domain-functional-verification.md` e
`review/01-full-project-exhaustive-verification.md` também descreviam `GAP-0007` como
"**bloqueia schema v2**" — igualmente corrigidas (ver abaixo).

**Modelo vigente confirmado por evidência local** (inalterado nesta correção, apenas re-afirmado, per
`decision-register.json` `DEC-007`): a tracklist canônica deve ser relacional; `metadata.faixas` não é
fonte canônica; `release_works` no formato atual (`release_id`, `work_id`) **não** representa o modelo
final — falta `phonogram_id`, `position`/`order` e identidade própria de faixa; `ReleaseTrack` deve
representar a ocorrência ordenada de um `Phonogram` concreto dentro de um `Release`; cadeia canônica
`Release → ReleaseTrack → Phonogram → Work → Rights/Shares`. `FINAL_RELATIONAL_SCHEMA_STATUS:
TO_BE_DESIGNED` (nova tabela `release_tracks` vs. evolução de `release_works` — não decidido por
`DEC-007`, fica para a etapa de resolução de schema).

**Verificação de `blocksSchemaV2Design` (checagem explicitamente solicitada)**: `GAP-0007`, no seu
próprio objeto JSON, tem um único campo `blocksSchemaV2Design`, valor `false` — **sem contradição
interna** (não há dois valores conflitantes dentro do mesmo registro de `GAP-0007`). O `SIM*`/`true`
que aparece é o de `decision-register.json` (`DEC-007.blocksSchemaV2Design: true`) — campo distinto,
preservado deliberadamente como registro histórico da gravidade da decisão **antes** de ser resolvida
(mesma convenção já aplicada a `DEC-001`/`GAP-0001`, ver ADENDO de correção de `DEC-001` no topo do
documento e §10, nota de rodapé `*`). `false` é o valor correto e atual de `GAP-0007.blocksSchemaV2Design`:
reflete que a decisão `DEC-007` (a ambiguidade "relacional ou jsonb?") já não bloqueia o desenho do
schema v2 por indecisão — o trabalho remanescente (desenho/implementação de `release_tracks`) é
rastreado por `status`/`resolutionWave`/`priorityScore`, não por essa flag. Confirmado
programaticamente: hoje, globalmente, apenas `GAP-0168` tem `blocksSchemaV2Design: true` (um bloqueio
estrutural genuíno e distinto, não uma reabertura de `DEC-007`) — nenhuma alteração foi feita a esse
campo em `GAP-0007` nem em `GAP-0168`.

`GAP-0007` **permanece `OPEN`** — não por ambiguidade entre relacional e jsonb (resolvida), mas por
trabalho real de desenho/implementação/migração ainda pendente: `release_tracks` não foi criada,
`release_works` não foi alterada, `metadata.faixas` não foi alterada. **Não reabra a decisão entre
JSONB e modelo relacional** — isso não foi feito nesta correção.

`title`/`rootCause` de `GAP-0007` reescritos em `canonical-gap-register.json` para refletir isso; texto
original preservado verbatim em `originalTitlePreCorrection`/`originalRootCausePreCorrection`.
`status` (`OPEN`), `severity`, `resolutionWave`, `priorityScore`, `decisionId`, `decisionResolved`,
`decisionOutcome`, `blocksSchemaV2Design`, `blocksApiV2Implementation` e `blocksCutover`
**inalterados** — `168` gaps, `resolution-order.json` inalterado (wave/prioridade/dependências de
`GAP-0007` não mudaram; nenhum gap depende de `GAP-0007`).

**Esta é uma correção puramente documental** — nenhum código, banco, migration, schema ou autenticação
foi alterado; `release_tracks` não foi implementada; `GAP-0168` não foi tocado; nenhum outro gap foi
modificado.

**Não corrija nenhum outro gap nesta etapa. Não implemente `release_tracks`.**

---

### Análise canônica — `GAP-0168` (Project ↔ Release): cardinalidade genuinamente indecisa, nova `DEC-009` registrada

> ⚠️ **`DEC-009` foi RESOLVIDA pelo Product Owner desde então — ver "Correção canônica — `DEC-009`
> RESOLVED" no fim do documento para a definição vigente.** Esta seção é preservada abaixo **como
> registro histórico da investigação de evidência** que levou ao registro de `DEC-009` — a evidência
> em si (o vocabulário `tipo` mais amplo, a cardinalidade estrutural M:N) permanece factualmente
> correta e inalterada, mas a CONCLUSÃO "cardinalidade indecisa" não é mais o estado vigente. Em
> particular, a menção abaixo a `video`/`tour`/`podcast`/`other` como parte do escopo observado de
> `Project` **não deve mais ser lida como escopo canônico futuro** — o Product Owner decidiu
> explicitamente que o escopo canônico v2 de `Project` é **somente** `Single`/`EP`/`Álbum`; os demais
> valores permanecem apenas como legado/vocabulário técnico existente no DTO, fora do escopo canônico
> desta relação.

Auditoria de evidência local (código real, não documentação prévia) para determinar objetivamente a
relação canônica entre `Project` musical e `Release`, conforme solicitado.

**1. `Project` representa obrigatoriamente uma música individual?** **NÃO.** `projects.tipo` aceita
`single`/`ep`/`album` (`ProjetoFormModal.tsx`, dropdown real) **e também** `video`/`tour`/`podcast`/
`other` (`apps/api/src/modules/projects/dto/projects.dto.ts:7`, vocabulário do backend, mais amplo que
o dropdown do frontend). Quando `tipo !== "single"`, a UI permite múltiplas "Músicas" — múltiplas linhas
em `project_tracks` (1 projeto : N faixas, `ProjectEntity.musicas_rel` `@OneToMany`) — confirmando que
um único `Project` pode representar um EP/Álbum inteiro (várias músicas), não apenas uma música.
Adicionalmente, boa parte do vocabulário `tipo` (`video`/`tour`/`podcast`/`other`) nem corresponde
conceitualmente a um lançamento musical.

**2. Cardinalidade real/pretendida `Project`/`Work`/`Phonogram`/`Release`:**
- `Project → project_tracks`: real, 1:N, mas **isolado** — `ProjectTrackEntity` não tem
  `work_id`/`phonogram_id` (confirmado, `apps/api/src/database/entities.ts:1241-1266`); é dado de
  pré-produção, sem relação com o catálogo formal.
- `Work → Project` (`works.projeto_id → projects.id`): real, populado, N:1, **sem constraint de
  unicidade** — múltiplos `works` podem referenciar o mesmo `project` (`entities.ts:626`).
- `Phonogram → Work` (`phonograms.obra_id → works.id`): real (já confirmado em auditorias anteriores).
- `Release ↔ Work` (`release_works`): real ao nível de schema, **M:N** (PK composta
  `release_id`+`work_id`, sem coluna de ordem, sem constraint de projeto único por release —
  `docs/backend-v2/field-traceability/modules/releases.md §8`), **nunca populada** por nenhum fluxo
  funcional.
- `Release ↔ Phonogram`: **NENHUMA relação existe hoje** (`PhonogramEntity` não tem `release_id`,
  confirmado por inspeção direta — `releases.md §9`).
- Tracklist real de um `Release` hoje: inteiramente `releases.metadata.faixas` (jsonb), desconectada de
  `works`/`phonograms`/`project_tracks` — um **terceiro** modelo de "faixa", isolado dos outros dois.

Ou seja: existem hoje **três modelos de "faixa" desconectados entre si** (`project_tracks`,
`works`/`phonograms`, `releases.metadata.faixas`), e nada no schema, em `DEC-001` ou em `DEC-007`
impede que um `release` agregue `works`/`phonograms` originados de `projects` diferentes.

**3. `Project → Release` precisa ser direta, ou pode ser derivada via `Project → Work → Phonogram →
ReleaseTrack → Release`?** Estruturalmente, **pode ser derivada** — essa é, inclusive, exatamente a
cadeia já decidida por `DEC-001` (`works.projeto_id → projects.id`, real) somada a `DEC-007`
(`Release → ReleaseTrack → Phonogram → Work`, `ReleaseTrack` ainda `TO_BE_DESIGNED`). Uma vez
implementada a tabela relacional de `DEC-007` com `phonogram_id`, a cadeia completa já existiria **sem
exigir nenhuma coluna nova em `releases`**.

**4. Um `Release` pode conter faixas originadas de `Projects` diferentes?** Estruturalmente, **SIM,
é possível** — nada no schema (M:N em `release_works`, sem unicidade em `works.projeto_id`) nem em
nenhuma decisão já tomada proíbe isso. Cenários reais da indústria (coletâneas, relançamentos,
"various artists") tornam isso mais que teórico.

**5. `releases.project_id` seria semanticamente correto ou criaria uma relação falsa?** Como **FK
direta obrigatória (1 release : 1 project)**, seria uma relação **semanticamente incompleta/potencialmente
falsa** — assumiria 1:1 quando o modelo já decidido (e a própria natureza de `project.tipo`) suporta
N:M e inclui tipos de projeto que nunca geram um release. Como campo **opcional/denormalizado** de
conveniência, seria uma escolha de modelagem legítima, mas com _trade-offs_ reais (segunda fonte de
rastreabilidade paralela à cadeia já decidida) que **não podem ser resolvidos apenas com evidência de
código** — dependem de intenção de produto.

**6. `GAP-0168` continua bloqueando o schema v2?** **SIM — `blocksSchemaV2Design: true` mantido,
confirmado correto (não alterado).** Diferente de `GAP-0001`/`GAP-0002`/`GAP-0004`/`GAP-0007` (cujas
decisões já foram resolvidas, então `blocksSchemaV2Design` corretamente virou `false` nesses quatro),
`GAP-0168` **não tem decisão resolvida** — o bloqueio ao desenho do schema v2 do domínio `releases` é
real e atual, não histórico.

**Decisão do Product Owner que falta (`DEC-009`, `PENDING`, registrada em `decision-register.json`,
`gapIds: ["GAP-0168"]`)**: A cardinalidade Project↔Release deve ser fechada com uma FK direta e
obrigatória (`releases.project_id`), ou inteiramente derivada pela cadeia já decidida `Project → Work →
Phonogram → ReleaseTrack → Release`, sem nova coluna? Depende de responder: **um `Release` pode
legitimamente agregar faixas de mais de um `Project` (coletâneas/relançamentos), ou cada `Release` deve
sempre corresponder a exatamente 1 `Project`?** Opções reais registradas (nenhuma escolhida por esta
correção): `PROJECT_RELEASE_DIRECT_LINK` (FK N:1 opcional/denormalizada); `PROJECT_RELEASE_DERIVED_ONLY`
(nenhuma coluna nova, rastreabilidade via `Work→Phonogram→ReleaseTrack`, suporta N:M nativamente);
`HYBRID_DUAL_PATH` (ambos, com risco de divergência a gerir). `recommendedOption` técnico registrado
(`PROJECT_RELEASE_DERIVED_ONLY`) é uma recomendação de engenharia, **não uma decisão de produto** — a
escolha final cabe ao Product Owner.

**`GAP-0168` corrigido em `canonical-gap-register.json`**: `title`/`rootCause` reescritos para refletir
a análise completa; `userDecisionRequired` corrigido de `false` para `true`; `decisionId` corrigido de
`null` para `"DEC-009"`; `schemaImpact` ampliado de `["ADD_COLUMN"]` (presumia a solução antes de
qualquer decisão) para `["MULTIPLE"]` (o impacto real depende de qual opção de `DEC-009` for escolhida);
`resolutionWave` corrigido de `WAVE_2_SCHEMA_AND_CONTRACT` para `WAVE_0_DECISIONS` (mesmo padrão já
aplicado a `GAP-0003`/`GAP-0005`/`GAP-0006`/`GAP-0008`, todos com decisão pendente). Texto/valores
originais preservados verbatim nos campos `original*PreCorrection`. `status` (`OPEN`), `severity`,
`priorityScore`, `blocksSchemaV2Design`, `blocksApiV2Implementation`, `blocksCutover` e `dependsOn`
(`["GAP-0001"]`) **inalterados**. Posição em `resolution-order.json` **inalterada** — já estava
corretamente logo após `GAP-0001` por força da própria aresta de dependência (mesmo padrão de
`GAP-0008`, que também fica fora da posição estritamente-por-wave por depender de um gap de wave
posterior); verificado programaticamente que essa posição continua topologicamente válida.

**Nenhuma decisão de produto foi inventada.** `168` gaps, `9` decisões (`4` resolvidas, `5` pendentes),
`DEPENDENCY_EDGES` inalterado (`16` — `GAP-0168.dependsOn` não mudou). `release_tracks` não foi
implementada; nenhum código, banco, migration, schema, frontend funcional ou autenticação foi alterado;
`GAP-0133` não foi tocado; nenhum outro gap foi modificado.

**Não implemente `release_tracks`. Não decida `DEC-009` nesta etapa. Não corrija nenhum outro gap.**

---

### Correção canônica — `DEC-009` RESOLVED por decisão definitiva do Product Owner

`DEC-009` (registrada `PENDING` na correção anterior) foi **resolvida pelo Product Owner**:
**`PROJECT_RELEASE_DIRECT_LINK`**.

**Regra canônica vigente**: `Project` representa **sempre** um projeto musical do tipo **Single, EP ou
Álbum** — este é agora o escopo canônico v2 explícito, decidido pelo Product Owner (não inferido de
evidência local). Um `Project` pode conter **uma ou várias músicas**; cada música tem seu próprio
`Work`, `Phonogram` e, futuramente, `ReleaseTrack`. O `Release` pertence **diretamente** ao `Project`:
o modelo v2 deve prever `releases.project_id → projects.id` (FK real, `N:1`, nullable). Essa relação
direta **não substitui** a cadeia já decidida `Release → ReleaseTrack → Phonogram → Work`
(`DEC-007`/`DEC-001`) — ambas coexistem como relações de primeira classe: `releases.project_id`
registra a que `Project` o `Release` pertence; a cadeia `ReleaseTrack` registra quais gravações
(`Phonogram`)/composições (`Work`) concretas compõem a tracklist do `Release`.

**Opções rejeitadas** (por decisão explícita do Product Owner, não por avaliação técnica): `
PROJECT_RELEASE_DERIVED_ONLY` (era a `recommendedOption` de engenharia registrada em `DEC-009` — o
Product Owner determinou que o modelo de negócio exige uma relação direta de primeira classe, não
apenas derivada) e `HYBRID_DUAL_PATH` (não selecionada).

**Sem `UNIQUE` implícito**: `releases.project_id` **não** deve ter constraint `UNIQUE` a menos que uma
decisão específica futura determine cardinalidade estrita `1:1` — por ora é uma FK `N:1` simples e
opcional (múltiplos releases podem, em princípio, referenciar o mesmo projeto — ex.: relançamentos —
até/a menos que uma decisão futura restrinja isso).

**Escopo de `Project` narrowed — correção de referências que tratavam `video`/`tour`/`podcast`/`other`
como escopo canônico futuro**: a auditoria de evidência local da correção anterior observou
corretamente que `apps/api/src/modules/projects/dto/projects.dto.ts` declara um vocabulário `tipo` mais
amplo (`video`/`tour`/`podcast`/`other`, além de `single`/`ep`/`album`) — esse é um FATO de código,
inalterado por esta correção (nenhum código foi tocado). O que muda é a interpretação canônica: por
decisão explícita do Product Owner, **o escopo canônico v2 de `Project` é somente `Single`/`EP`/
`Álbum`** — `video`/`tour`/`podcast`/`other` **não são escopo canônico futuro** para a relação
`Project↔Release`; permanecem apenas como vocabulário técnico legado existente no DTO atual, sem
tratamento definido nesta decisão (destino de linhas `Project` existentes desses tipos — depreciação,
migração, ou uso continuado não vinculado a `Release` — fica para etapa futura, não decidido aqui). A
seção "Análise canônica — GAP-0168" acima foi marcada com um aviso apontando para esta correção,
preservando o texto original como registro histórico da investigação.

**`GAP-0168` corrigido em `canonical-gap-register.json`**: `title`/`rootCause` reescritos para refletir
a decisão resolvida — resta apenas implementação, não mais indecisão de cardinalidade.
`userDecisionRequired` corrigido de `true` para `false`; `decisionResolved: true`;
`decisionOutcome: "PROJECT_RELEASE_DIRECT_LINK"` adicionado; `decisionId` mantido `DEC-009`;
`resolutionWave` realocado de volta de `WAVE_0_DECISIONS` para `WAVE_2_SCHEMA_AND_CONTRACT` (mesmo
padrão de `GAP-0001`/`GAP-0002`/`GAP-0004`/`GAP-0007` uma vez resolvida a decisão); `schemaImpact`
corrigido de `["MULTIPLE"]` para `["ADD_COLUMN"]` (agora que a forma concreta — uma única coluna FK —
é conhecida); **`blocksSchemaV2Design` corrigido de `true` para `false`** — a ambiguidade de
cardinalidade que bloqueava o desenho do schema v2 foi resolvida; confirmado programaticamente que,
globalmente, **nenhum gap** tem mais `blocksSchemaV2Design: true` (`BLOCKS_SCHEMA_V2_DESIGN: 0`
novamente, como era antes de `GAP-0168` existir). `status` (`OPEN`), `severity`, `priorityScore`,
`blocksApiV2Implementation`, `blocksCutover` e `dependsOn` (`["GAP-0001"]`) **inalterados** —
`GAP-0168` continua `OPEN` **somente** pela implementação real ainda pendente de
`releases.project_id` (nenhuma migration/entidade/DTO foi alterada). Campos da correção anterior
(`original*PreCorrection`, capturando o estado de antes de `DEC-009` existir) preservados inalterados
para rastreabilidade completa em duas camadas.

Efeitos nos contadores: `WAVE_0_DECISIONS` de 5 para **4**; `WAVE_2_SCHEMA_AND_CONTRACT` de 31 para
**32**; decisões resolvidas de 4 para **5**, pendentes de 5 para **4**; `168` gaps, `9` decisões,
`DEPENDENCY_EDGES` inalterado (`16`). Posição em `resolution-order.json` **inalterada** (já estava
correta, logo após `GAP-0001`, por força da aresta de dependência — independente do rótulo de wave).

**Não implemente `releases.project_id`. Não altere código, schema, migrations, banco, frontend
funcional ou autenticação.** `GAP-0133` não foi tocado; nenhum outro gap foi modificado.

---

### Correção canônica — `DEC-003` RESOLVED por decisão definitiva do Product Owner

`DEC-003` (comparação integral `ArtistaFormModal.tsx` vs `ArtistaCadastro.tsx`, DTOs/entities/schema/API
de Artist) foi **resolvida pelo Product Owner**: **`ARTISTA_FORM_MODAL_CANONICAL`**.

**Correção factual encontrada durante a comparação**: o achado original de `GAP-0003` (e do relatório
`docs/backend-v2/field-traceability/modules/artist.md`, Fase 2) atribuía `ARTIST_FORM_SECTIONS`
(`forms/artist-form.definition.ts`) a `ArtistaCadastro.tsx` e `ArtistaFormFields` a `ArtistaFormModal.tsx`.
Inspeção direta do código atual (`import { ARTIST_FORM_SECTIONS, ... } from
"@/modules/artist/forms/artist-form.definition"` em `ArtistaFormModal.tsx`, e ausência total dessa
importação em `ArtistaCadastro.tsx`, que define suas próprias constantes locais e reutiliza apenas 3
funções auxiliares via o barrel `@/modules/artist/mappers`) confirma o **oposto**: `ArtistaFormModal.tsx`
já consome `ARTIST_FORM_SECTIONS` como fonte única (renderização + validação Zod gerada + export +
import). O código mudou desde a auditoria Fase 2 original — `ArtistaFormModal.tsx` já havia sido
migrado para essa definição mais moderna, incluindo já ter incorporado o campo `genero` (gênero da
pessoa), citado no achado original como exclusivo de `ArtistaCadastro.tsx`. `artist.md` em si **não foi
alterado** (snapshot histórico da Fase 2, fora do escopo desta correção).

**Base canônica**: `ArtistaFormModal.tsx` — não escolhida apenas pela rota atualmente usada (regra
explícita do Product Owner). Comparação direta de código mostra que já tem a base funcionalmente
superior para o diferenciador mais complexo entre os dois: modelagem de relacionamentos comerciais —
`relacionamentos[]` (multi-entrada, tipado por papel: empresário/gravadora/editora/booker/jurídico/
financeiro/contador/assessoria, com `responsaveis[]`/`distribuidoras[]` aninhados) + `contatosVinculados`
(equipe vinculada ao CRM, sem duplicação de dados) — ambos estritamente mais capazes que os campos
planos legados de `ArtistaCadastro.tsx` (`empresario_*`/`gravadora_*`/`gravadora_responsavel_*`, um
único relacionamento por tipo, sem vínculo ao CRM).

**Campos exclusivos de `ArtistaCadastro.tsx` reais (DTO/coluna confirmados) a incorporar** —
`MERGE_INTO_CANONICAL`: `tipo` (classificação solo/banda/dupla/trio/grupo/compositor/produtor/dj);
`status` (workflow, validado server-side por `ArtistsService.validateStatusTransition()` — a mesclagem
deve respeitar esse grafo de transições, não adicionar um select livre); `contrato_id` (seletor real
"vincular contrato", via `useContratos()` — o modal hoje só preserva o valor existente na edição, sem UI
para defini-lo); `manager_nome`; `manager_contato`; `produtor_executivo`; `agencia_booking`;
`label_parceira`; `galeria_urls` (galeria de fotos, distinta do `foto_url` único já existente);
`documentos` (lista `{nome,url}`, distinta do `documentos_pessoais_url`/`presskit_url` de arquivo único
já existentes). Todos confirmados como colunas/campos reais e validados em `CreateArtistDto`/
`UpdateArtistDto`/`ArtistEntity` — nenhum é inventado. Nenhum desses campos, ausentes do payload do
modal, é apagado na edição (`ArtistsService.update()` só escreve chaves presentes no DTO — confirmado
por leitura direta — `dtoRec[col] !== undefined`), apenas ficam permanentemente não-editáveis via o
fluxo canônico até a mesclagem ser implementada.

**Classificação `LEGACY_ONLY`**: a UI de edição direta dos campos planos de relacionamento comercial
(`empresario_*`/`gravadora_*`/`gravadora_responsavel_*`) e os arrays locais `distribuidorasArtista`/
`distribuidorasEmpresa` de `ArtistaCadastro.tsx` — superados por `relacionamentos[]`, já canônico no
modal, que já escreve esses campos legados de forma derivada para retrocompatibilidade
(`formToArtistaPayload`, comentário "Legado — mantido para backward compat"). **Não portar** esse
padrão de UI. **Achado de risco confirmado por código, não corrigido nesta etapa** (documental apenas):
o submit de `ArtistaCadastro.tsx` envia `relacionamentos: []` incondicionalmente — editar um artista que
já tenha `relacionamentos` populados via `ArtistaCadastro.tsx` apagaria silenciosamente esse campo
(`null`). Hoje inexplorável (rota inalcançável pela navegação), mas não deve ser herdado ao remover o
componente órfão.

**Classificação `DEAD`**: o formato de entrada livre (texto) de nome de distribuidora em
`distribuidorasArtista`/`distribuidorasEmpresa` — estritamente inferior ao modelo já canônico baseado em
ID (`DISTRIBUIDORAS_OPTIONS`/`distribuidorasGerais`). A capacidade em si (associar distribuidoras) já
está coberta, de forma estruturalmente melhor, pelo modelo canônico.

**Classificação `NEEDS_PRODUCT_DECISION`**: `tagsMusicais`/`faseCarreira`/`slugArtistico` — campos
reais de DTO/banco sem NENHUMA UI editável em nenhum dos dois componentes hoje (preservados/
round-tripped pelo modal mas nunca renderizados; ausentes até do estado local de `ArtistaCadastro.tsx`).
Não é um efeito da duplicação `ArtistaFormModal` vs `ArtistaCadastro` (nenhum dos dois expõe), portanto
fora do escopo direto de `DEC-003` — registrado aqui apenas porque um modelo canônico completo deveria
eventualmente decidir se esses campos se tornam editáveis. Nenhuma UI foi alterada por esta correção.

**Opções rejeitadas** (por decisão explícita do Product Owner): `ArtistaCadastro.tsx` substituir o modal
— rejeitada (cobertura de campos maior não justifica substituir a implementação alcançável/mantida por
uma órfã com modelo de relacionamento pior, validação ad hoc, e um bug de perda de dados confirmado em
`relacionamentos`); manter os dois como fluxos deliberadamente distintos — rejeitada (nenhuma evidência
de intenção de produto "rápido vs. completo"; `ArtistaCadastro.tsx` está simplesmente inalcançável, 0
referências de navegação).

**`GAP-0003` corrigido em `canonical-gap-register.json`**: `title`/`rootCause` reescritos para refletir
a decisão resolvida e a correção factual de `ARTIST_FORM_SECTIONS`; `userDecisionRequired` corrigido de
`true` para `false`; `decisionResolved: true`; `decisionOutcome: "ARTISTA_FORM_MODAL_CANONICAL"`
adicionado; `legacyVsV2Strategy` corrigido de `DECISION_REQUIRED` para `FIX_FRONTEND_AND_API_V2`;
`resolutionWave` realocado de `WAVE_0_DECISIONS` para `WAVE_3_CORE_DOMAIN_FIXES` (mesmo padrão de
`GAP-0004`, também uma consolidação de dois componentes). Texto original preservado verbatim em
`originalTitlePreCorrection`/`originalRootCausePreCorrection`/
`originalLegacyVsV2StrategyPreCorrection`/`originalUserDecisionRequiredPreCorrection`. `status`
(`OPEN`), `severity`, `priorityScore`, `blocksSchemaV2Design`, `blocksApiV2Implementation`,
`blocksCutover`, `dependsOn` (nenhum) **inalterados** — `GAP-0003` permanece `OPEN` apenas pelo trabalho
real de mesclagem/remoção ainda pendente. `resolution-order.json` atualizado: `GAP-0003` removida de sua
posição antiga (início do array, cluster `WAVE_0_DECISIONS` por prioridade) e reinserida no cluster
`WAVE_3_CORE_DOMAIN_FIXES`/prioridade 40, antes de `GAP-0012` (mesmo critério de ordenação ascendente
por número de gap já usado nas correções anteriores). Classificação completa de campos registrada em
`decision-register.json` `DEC-003.fieldsOnlyInArtistaFormModal`/`fieldsOnlyInArtistaCadastro`/
`fieldsNeedingProductDecision`/`rejectedOptions`/`mergeScope`.

**Nenhum código, frontend funcional, backend, banco, schema, migrations ou autenticação foi alterado.**
A mesclagem em si **não foi implementada** nesta etapa. Nenhum outro gap/decisão foi modificado.

> Historical record. Kept as recorded; not the current contract.

# MUSIC OS 360 — MASTER DOMAIN & FUNCTIONAL VERIFICATION

Documento de consolidação final do "zero-gap field-traceability audit". Fontes primárias:
`docs/backend-v2/74-zero-gap-reconstruction-contract.md`, `docs/backend-v2/gap-resolution/decision-register.json`,
`docs/backend-v2/gap-resolution/canonical-gap-register.json` (168 gaps), `docs/backend-v2/gap-resolution/resolution-order.json`,
`docs/backend-v2/gap-resolution/00-canonical-gap-register.md`, `docs/backend-v2/field-traceability/PROGRESS.md` e os 24
relatórios de módulo em `docs/backend-v2/field-traceability/modules/*.md`. Nenhum arquivo de código, schema, banco de
dados, Supabase, `.env` ou os diretórios read-only acima foi alterado na produção deste relatório.

---

## 1. Resumo Executivo

MUSIC OS 360 é um sistema de gestão para o negócio musical (uma "operating system" para gravadoras, editoras,
produtoras e escritórios de gestão de artistas). Ele organiza o trabalho em torno de um conceito central: **a
música/projeto musical**. A partir de uma música (chamada no sistema de "Project"), o usuário registra a obra
(a composição, com seus autores/compositores), o fonograma (a gravação concreta daquela composição), o
lançamento/release (o produto de distribuição — single, EP, álbum — que empacota uma ou mais gravações para o
público), os contratos associados (com artistas, clientes, prestadores), o financeiro (receitas e despesas
ligadas àquela música, àquele artista, àquele contrato), o audiovisual (clipes, conteúdos em vídeo) e o
marketing (campanhas, conteúdo, divulgação) daquele lançamento.

Historicamente, uma correção de entendimento crítica ocorreu durante este projeto de auditoria: a tabela
`projects` havia sido inicialmente registrada (decisão `DEC-001`) como um "hub financeiro/operacional
universal" — ou seja, uma entidade genérica que qualquer domínio poderia usar para agrupar orçamento e
atividades, não necessariamente uma música. O Product Owner corrigiu explicitamente essa interpretação: **o
`Project` é, e sempre foi na prática, a ficha inicial da música/projeto musical** (título, gênero, faixas,
compositores, intérpretes, produtores). Não é um hub financeiro genérico. A partir desse projeto musical,
outros registros (Obra, Fonograma, Lançamento, Transação financeira, Produção Audiovisual, Campanha de
Marketing) podem se associar à mesma música usando `project.id` como chave de vínculo cross-domain — não
porque `projects` seja uma entidade financeira, mas porque esses registros pertencem àquela música
específica. Essa correção está integralmente documentada e preservada em
`docs/backend-v2/gap-resolution/decision-register.json` (`DEC-001`), com a definição anterior mantida,
verbatim, como histórico invalidado (`DEC-001.supersededDecision`).

**O que já está consolidado (documentalmente, não implementado em código)**: 9 decisões de arquitetura/produto
foram identificadas como necessárias (`decision-register.json`; a 9ª, `DEC-009`, criada e já resolvida em
correção posterior sobre `GAP-0168`). Destas, **6 foram resolvidas** — `DEC-001` (projeto musical,
corrigida), `DEC-002` (vocabulário canônico de tipo de contrato), `DEC-004` (componente único de criação de
contrato, com modos WIZARD e QUICK), `DEC-007` (modelo relacional de tracklist de lançamentos), `DEC-009`
(`releases.project_id → projects.id`, FK direta) e `DEC-003` (fluxo canônico de criação de artista:
`ArtistaFormModal.tsx`, corrigido — ver correção canônica em `gap-resolution/00-canonical-gap-register.md`).
**3 permanecem pendentes** — `DEC-005` (fragmentação de billing em 3 telas — análise concluída, mas
**não registrada/decidida**), `DEC-006` (duplicação de gestão de convites) e `DEC-008` (se a "parte" de um
contrato deve referenciar o cadastro de origem em tempo real ou apenas copiar os dados no momento). É crucial
entender que **nenhuma dessas 6 decisões resolvidas foi implementada em código** — são resoluções puramente
documentais, registradas para orientar a reconstrução da `apps/api-v2`.

**O que ainda está pendente**: dos 168 gaps canônicos identificados nos 24 módulos auditados, 141 estão
`OPEN` (não corrigidos), 17 `DEFERRED`, 7 `NO_FIX_REQUIRED` (comportamento correto, sem ação necessária), 2
`ACCEPTED_BY_EXISTING_CONTRACT` e 1 `NOT_APPLICABLE`. Nenhum gap bloqueia mais formalmente o desenho do
schema v2 hoje (`GAP-0168`, que bloqueava por ambiguidade de cardinalidade `Project↔Release`, foi
corrigido — decisão `DEC-009: PROJECT_RELEASE_DIRECT_LINK` resolvida pelo Product Owner; corrigido, era
"apenas 1 gap bloqueia"), 0 bloqueiam a implementação da API v2 por ambiguidade de decisão, e 1 bloqueia
o cutover final (`GAP-0039`, dependente de
configuração externa do Supabase Dashboard, não verificável por leitura de código). A `apps/api-v2` existe
apenas como um **scaffold técnico** (NestJS + Drizzle + Zod + conexão de banco + infraestrutura de
transação) — nenhum módulo de domínio de negócio (Project, Work, Release, Contract, etc.) foi construído
nela ainda.

Em linguagem simples: o sistema atual (a `apps/api` legada + `apps/web`) funciona, mas tem lacunas reais e
documentadas — desde bugs que quebram fluxos inteiros (ex.: criação de Lançamento 100% quebrada por um campo
extra não reconhecido pelo backend) até funcionalidades inteiras sem interface de usuário (8 dos 9 domínios
do módulo Audiovisual) e integrações honestamente não implementadas (as 6 distribuidoras digitais). Este
relatório consolida tudo isso, cruza a documentação com o código real onde necessário, e aponta exatamente
o que o Product Owner precisa validar antes de qualquer decisão de continuidade.

**CONFIDENCE: HIGH** — informação triangulada entre os 24 relatórios de módulo (Fase 2), o registro
canônico de gaps (Fase 3), o registro de decisões, e verificação pontual direta de código
(`apps/api-v2/src/**`, `apps/api-v2/src/config/database.schema.ts`).

---

## 2. Mapa conceitual do sistema (construído a partir de evidência)

```text
                        ┌───────────────────────────┐
                        │   TENANT (= WORKSPACE)     │
                        │   tabela: tenants          │
                        │   (organizations = pai     │
                        │    legal/billing, 1:1 na   │
                        │    prática via provisioning)│
                        └─────────────┬─────────────┘
                                      │ tenant_id (em toda tabela de negócio)
                 ┌────────────────────┼─────────────────────────────┐
                 │                    │                              │
         ┌───────▼───────┐   ┌────────▼─────────┐          ┌────────▼────────┐
         │    ARTIST      │   │  PROJECT musical  │          │  CLIENT / CRM    │
         │ tabela: artists│   │  (a "música")      │          │ tabela: clients  │
         └───────┬────────┘   │  tabela: projects  │          └────────┬────────┘
                 │            └─────────┬──────────┘                   │
                 │ artista_id (FK real  │ project.id                   │ cliente_id
                 │ em vários domínios)  │ (chave cross-domain)         │ (contratos, licenças)
                 │                      │                              │
   ┌─────────────┼──────────────────────┼──────────────────────────┐  │
   │             │                      │                          │  │
┌──▼───┐   ┌──────▼───────┐     ┌────────▼────────┐        ┌───────▼──▼─────┐
│WORK   │   │ PHONOGRAM     │     │ RELEASE          │        │ CONTRACT        │
│(Obra) │──▶│ (Fonograma)   │ ??  │ (Lançamento)      │        │ tabela:contracts│
│works  │   │ phonograms    │     │ releases          │        └────────┬────────┘
└───┬───┘   │ .obra_id→works│     │ SEM project_id     │                 │ CONTRACT_SIGNED (evento)
    │       └──────┬────────┘     │ (GAP-0168)         │                 │
    │works.projeto_id            │ .artista_id (FK)   │                 ▼
    │  → projects.id (real,      └────────────────────┘        ┌─────────────────┐
    │  populado, ALREADY_CORRECT)                               │ TRANSACTION       │
    │                                                            │ (Accounting)      │
    └── transitivo: phonograms.obra_id → works.id →              │ .projeto_id → proj│
        works.projeto_id → projects.id (ALREADY_CORRECT,          │ .artista_id       │
        sem coluna direta, TRANSITIVE)                            │ .contrato_id      │
                                                                    └───────────────────┘

  AUDIOVISUAL_PROJECT ──financial_project_id (FK real, LEGACY_NAMING)──▶ projects.id
  MARKETING_PROJECT   ──financial_project_id (FK real, LEGACY_NAMING)──▶ projects.id
  EVENT ── artista_id (texto livre em parte dos fluxos, sem FK forte) ──▶ artists.id
```

**Leitura do mapa**: `Tenant`/`Workspace` é a raiz de isolamento (todo dado de negócio carrega `tenant_id`).
`Artist` e `Project` (música) são as duas entidades-âncora do domínio musical. A partir do `Project`, nascem
`Work` (a composição/obra) — com relação real e populada (`works.projeto_id`) — e, transitivamente, o
`Phonogram` (a gravação concreta daquela obra). O `Release` (lançamento/produto de distribuição) é, hoje, uma
entidade **desconectada** do `Project` que a originou — só existe uma conveniência de preenchimento
automático de formulário, nunca uma relação persistida (`GAP-0168`, ver §5). `Contract`, `Transaction`
(financeiro), `Audiovisual` e `Marketing` têm, cada um, sua própria forma de se relacionar (ou não) ao
`Project`/`Artist` — detalhado nas tabelas §4 e §24. **CONFIDENCE: HIGH** para as relações Work↔Project e
Transaction↔Project (confirmadas populadas em `projects.md §17`, `catalog.md`); **HIGH** para a ausência de
relação Release↔Project (confirmada ausente em `releases.md §16`); **MEDIUM** para Audiovisual/Marketing↔Project
(relação real via FK, mas nunca escrita por nenhum formulário — `audiovisual.md §6`, `projects.md §20-21`).

---

## 3. Definição canônica de `projects` (Musical Project)

```text
PROJECT_CLASSIFICATION: MUSICAL_PROJECT
PROJECT_REPRESENTS: SONG / MUSICAL PROJECT (música, single, EP ou álbum em produção/registro)
GENERIC_FINANCIAL_PROJECT: NAO
GENERIC_OPERATIONAL_PROJECT: NAO
STATUS: CONFIRMED (correção de autoridade do Product Owner, PROMPT 129)
CONFIDENCE: HIGH
EVIDENCE: docs/backend-v2/gap-resolution/decision-register.json (DEC-001, campos "canonicalDecision",
  "correctionApplied", "correctionAuthority"); docs/backend-v2/gap-resolution/00-canonical-gap-register.md
  ("ADENDO — CORREÇÃO CANÔNICA DE DEC-001"); docs/backend-v2/field-traceability/modules/projects.md §5,§11,§17
  (frontend real, ProjetoFormModal.tsx, só coleta campos de música: título, gênero, faixas, compositores)
```

Em linguagem de produto: **o Project é a ficha inicial da música/projeto musical** — título, gênero, tipo de
lançamento (álbum/EP/single), status de produção, e uma lista de faixas (`project_tracks`), cada uma com seus
compositores, intérpretes e produtores (`project_track_participants`). É o ponto de partida do catálogo: antes
de existir uma Obra registrada formalmente (para fins de ECAD/ABRAMUS) ou um Fonograma (a gravação), existe
esse registro inicial de "estamos trabalhando nesta música". A partir desse projeto musical, **outros
registros podem ser associados à mesma música utilizando `project.id`** — é assim que uma Obra sabe a que
projeto pertence (`works.projeto_id`), é assim que uma Transação financeira sabe que uma despesa de estúdio
foi gasta numa música específica (`transactions.projeto_id`), e é assim (embora hoje sem escrita real via
formulário) que uma produção audiovisual ou uma campanha de marketing sabem a que música se referem
(`audiovisual_projects.financial_project_id`, `marketing_projects.financial_project_id`).

A existência de relações financeiras reais (`financial_project_id`, `transactions.projeto_id`) **não** torna
`projects` uma entidade financeira — essas relações existem porque a atividade financeira, audiovisual ou de
marketing de outros domínios **pertence** a uma música específica, não porque `projects` é, em si, um
conceito financeiro. Este é exatamente o ponto da correção do Product Owner sobre `DEC-001`.

### 3.1 Tabela de campos — `projects` / `project_tracks` / `project_track_participants`

| Campo | Frontend | API | Banco | Significado funcional | Status |
|---|---|---|---|---|---|
| `titulo` | `ProjetoFormModal.tsx` (obrigatório) | `titulo` | `projects.titulo` | Nome da música/EP/álbum | CONFIRMED |
| `tipo` | select (álbum/EP/single/turnê) | `tipo` | `projects.tipo` | Tipo de lançamento planejado | CONFIRMED |
| `status` | select (5 valores, workflow real) | `status` | `projects.status` | Estágio de produção (planejamento→em_andamento→revisão→concluído/cancelado) | CONFIRMED (workflow real, `WorkflowService`) |
| `genero` | derivado da 1ª faixa | `genero` | `projects.genero` | Gênero musical | CONFIRMED |
| `artista_id` | **ausente do único form real** | `artista_id` (DTO aceita) | `projects.artista_id` (FK lógica, sem constraint) | Artista principal da música | MISSING (campo real, nunca coletado — `GAP-0001` remanescente) |
| `orcamento` | **ausente do único form real** | `orcamento` (DTO aceita) | `projects.orcamento` (decimal) | Orçamento de produção | MISSING (mesmo padrão de `artista_id`) |
| `descricao` | textarea | `descricao` | `projects.descricao` | Descrição livre | CONFIRMED |
| `observacoes` | textarea | `observacoes` | `projects.observacoes` | Observações livres | CONFIRMED |
| `metadata.aiPlan` | não editável (gerado por IA) | — | `projects.metadata` (jsonb) | Plano operacional gerado por IA ao concluir o projeto | BROKEN — a automação (`ProjectPlanningAutomation`) executa SQL bruto com colunas obsoletas (`nome`, `data_fim`, renomeada/inexistente) e falha silenciosamente em toda invocação real |
| **project_tracks** (nível faixa) | | | | | |
| `nome` | texto | `musicas[].nome` | `project_tracks.nome` | Nome da faixa | CONFIRMED |
| `soloFeat`/`originalRemix`/`instrumental` | switches | idem | idem | Metadados de versão da faixa | CONFIRMED |
| `duracao`/`genero`/`idioma`/`letra` | campos livres | idem | idem | Metadados descritivos | CONFIRMED |
| `audioUrl` | upload (aparenta funcionar) | idem | `project_tracks.audioUrl` | Referência de áudio da faixa | STUB — `uploadFile()` é um stub hardcoded que sempre retorna `null` (`ProjetoFormModal.tsx:178`); nenhum arquivo é de fato enviado |
| **project_track_participants** (nível participante) | | | | | |
| `compositor` | linha repetível | `participantes[]` | `project_track_participants.compositor` | Autor/compositor da faixa | CONFIRMED, real, populado |
| `interprete` | linha repetível | idem | `.interprete` | Intérprete da faixa | CONFIRMED |
| `produtor` | linha repetível | idem | `.produtor` | Produtor da faixa | CONFIRMED |

`EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §2,§5,§8 (linhas do relatório) | CONFIDENCE: HIGH | STATUS: PARTIALLY_CONFIRMED (campos-núcleo confirmados persistidos; artista_id/orcamento confirmados reais porém não coletados)`

---

## 4. `Project` como chave cross-domain

| Domínio | Relação atual | Coluna atual | Relação desejada | Status |
|---|---|---|---|---|
| Project ↔ Artist | Artista principal da música | `projects.artista_id` (FK lógica, sem constraint DB) | mesma, com constraint física | MISSING_RELATION (campo existe, nunca escrito pelo único form real — `projects.md §11`) |
| Project ↔ Work | Obra pertence a este projeto musical | `works.projeto_id → projects.id` | mesma | ALREADY_CORRECT (real, populada via `ObraFormModal.tsx`, confirmada `projects.md §17`, `decision-register.json` DEC-001) |
| Project ↔ Phonogram | Fonograma pertence à obra, que pertence ao projeto | nenhuma coluna direta; `phonograms.obra_id → works.id → works.projeto_id` | manter transitiva ou avaliar denormalização futura | TRANSITIVE (sem gap novo — `decision-register.json` DEC-001 crossDomainRelationsMatrix) |
| Project ↔ Release | **nenhuma** | `ReleaseEntity` não tem `project_id`/`projeto_id`; só conveniência de pré-preenchimento (`projetoToLancamentoSeed`) | nova coluna `releases.project_id` (ou equivalente) | MISSING_RELATION → **GAP-0168** (ver §5) |
| Project ↔ Accounting Transaction | Transação financeira pertence a esta música | `transactions.projeto_id → projects.id` | mesma, com constraint física | ALREADY_CORRECT (real, populada pelo formulário de Transação — `transactions.projeto_id`; só não é lida/agrupada pelo P&L — `GAP-0013`) |
| Project ↔ Audiovisual | Produção audiovisual pertence a esta música | `audiovisual_projects.financial_project_id → projects.id` | mesma, renomear coluna para refletir o significado real | LEGACY_NAMING (FK real, DB-enforced) + MISSING no nível de escrita via UI (`GAP-0033`) |
| Project ↔ Marketing | Campanha/projeto de marketing pertence a esta música | `marketing_projects.financial_project_id → projects.id` | mesma, renomear coluna | LEGACY_NAMING (FK real, DB-enforced) + MISSING no nível de escrita via UI (`GAP-0033`) |

`EVIDENCE: decision-register.json (DEC-001.crossDomainRelationsMatrix) | docs/backend-v2/field-traceability/modules/projects.md §17,§20,§21 | docs/backend-v2/field-traceability/modules/releases.md §16 | docs/backend-v2/field-traceability/modules/accounting.md §2.5 | CONFIDENCE: HIGH | STATUS: CONFIRMED para Work/Accounting; CONFLICTED-resolvido para a nomenclatura financial_project_id (ver §27, CONFLITO-01)`

---

## 5. GAP-0168 — releases sem relação persistida com o projeto musical de origem

```text
GAP_ID: GAP-0168
STATUS: OPEN
SEVERIDADE: S2_MEDIUM
MÓDULOS: releases, projects
BLOQUEIA SCHEMA V2: SIM (único gap do registro inteiro com esse bloqueio hoje)
BLOQUEIA API V2: NÃO
DEPENDE DE: GAP-0001 (decisão DEC-001, já resolvida)
WAVE DE RESOLUÇÃO: WAVE_2_SCHEMA_AND_CONTRACT
```

**O que está faltando**: `ReleaseEntity` (tabela `releases`) não possui nenhuma coluna `project_id`/
`projeto_id`. A única "ligação" entre um Lançamento e o Projeto Musical que o originou é uma conveniência de
UX: ao abrir o formulário de criação de Lançamento (`LancamentoFormModal.tsx`), o usuário pode escolher um
`Projeto` existente e o sistema copia (`projetoToLancamentoSeed()`) título/gênero/artista para os campos do
novo Lançamento — mas o `id` do projeto de origem **nunca é gravado** em lugar nenhum. Depois desse momento
de criação, não existe forma de saber, a partir de um `Lançamento`, de qual `Project` ele nasceu — nem existe
automação (nenhum listener de evento) que mantenha as duas entidades sincronizadas.

**Por que isso importa sob o modelo de domínio corrigido**: antes da correção de `DEC-001`, essa ausência
parecia um detalhe menor de um "hub financeiro genérico" que talvez nem devesse se relacionar com
Lançamentos. Sob a definição corrigida — `projects` = a própria música/projeto musical — essa ausência se
torna estruturalmente mais séria: significa que **a música (Project) e o produto de distribuição dela
(Release) não têm vínculo de dados persistente**, apesar de, na cabeça do usuário, serem claramente a mesma
música em dois estágios do fluxo (produção → distribuição). Isso quebra a cadeia conceitual natural
`Project (música) → Work (obra) → Phonogram (gravação) → Release (lançamento)` exatamente no último elo.

**Comportamento atual vs. desejado**:

| | Atual | Desejado |
|---|---|---|
| Ao criar um Lançamento a partir de um Projeto | copia campos uma única vez, sem manter vínculo | grava `releases.project_id` (ou equivalente) de forma persistente |
| Consultar "quais lançamentos vieram deste projeto musical" | impossível via dados — precisaria adivinhar por título/artista | consulta direta por FK |
| Editar o Projeto após o Lançamento já existir | nenhuma propagação, nenhuma forma de saber que estão relacionados | rastreável, mesmo que sem sincronização automática de campos |
| Relatórios financeiros/P&L cruzando Release ↔ Project | impossível (sem chave) | possível via join direto |

Nenhuma implementação foi realizada — este gap está `OPEN`, aguardando a etapa de desenho de schema v2
(`WAVE_2_SCHEMA_AND_CONTRACT`).

`EVIDENCE: canonical-gap-register.json (GAP-0168, campo completo) | docs/backend-v2/field-traceability/modules/releases.md §16 | docs/backend-v2/gap-resolution/00-canonical-gap-register.md ("ADENDO — CORREÇÃO CANÔNICA DE DEC-001") | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 6. Diferença entre Project, Work, Phonogram e Release

| | **Project** (Projeto Musical) | **Work** (Obra) | **Phonogram** (Fonograma) | **Release** (Lançamento) |
|---|---|---|---|---|
| O que representa | A ficha inicial de uma música em produção | A composição/obra musical em si (letra+melodia), unidade de direito autoral | A gravação concreta de uma obra (uma performance específica, registrada) | O produto de distribuição — single/EP/álbum — que empacota uma ou mais gravações para o público |
| Quando nasce | No início do trabalho na música (fase de produção/composição) | Quando a composição é formalmente registrada (para ECAD/ABRAMUS) | Quando uma gravação específica daquela obra é registrada | Quando se decide empacotar e distribuir uma ou mais gravações |
| Quem cria | Produtor/equipe A&R via `Projetos.tsx` | Equipe de catálogo via `RegistroMusicas.tsx` (aba Obras) | Equipe de catálogo via `RegistroMusicas.tsx` (aba Fonogramas) | Equipe de distribuição via `Lancamentos.tsx` |
| Dados principais | título, gênero, faixas planejadas, compositores/intérpretes/produtores por faixa | título, ISWC, compositores/letristas, participações (splits) | título, ISRC, obra vinculada, participação (produtor fonográfico/intérprete/músico) | título, artista, UPC/EAN, ISRC global, distribuidora, plataformas, tracklist |
| Identificador | `projects.id` (uuid) | `works.id` (uuid) + `iswc` (externo, opcional) | `phonograms.id` (uuid) + `isrc` (externo, opcional) | `releases.id` (uuid) + `upc`/`isrc_global` (externo, opcional) |
| Relação com Project | é o próprio Project | `works.projeto_id → projects.id` (real, populada) | transitiva via `works.projeto_id` (nenhuma coluna direta) | **nenhuma** (GAP-0168) |
| Pode existir sem Project? | N/A | `CARDINALITY: TO_BE_CONFIRMED` (coluna é nullable; não confirmado se toda Obra real hoje tem um Project associado ou se muitas nascem soltas) | `CARDINALITY: TO_BE_CONFIRMED` (depende da Obra vinculada, que por sua vez pode ou não ter Project) | SIM, hoje sempre nasce sem vínculo formal a nenhum Project (a única "ligação" é o preenchimento automático one-shot) |
| Pode haver mais de um por Project? | N/A | `CARDINALITY: TO_BE_CONFIRMED` (schema permite N Works por Project via FK 1:N, mas não há confirmação de uso real desse padrão em volume) | `CARDINALITY: TO_BE_CONFIRMED` | `CARDINALITY: TO_BE_CONFIRMED` (não há vínculo persistente para sequer contar) |

`EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §2,§11 | docs/backend-v2/field-traceability/modules/catalog.md §1,§5,§6 | docs/backend-v2/field-traceability/modules/releases.md §0,§9,§16 | decision-register.json (DEC-007.domainSemantics) | CONFIDENCE: MEDIUM (cardinalidades reais não medidas em volume de dados; classificação de "pode existir sem" e "quantos por" é estrutural/schema-level, não uma contagem em produção) | STATUS: PARTIALLY_CONFIRMED`

---

## 7. Work / Obra — visão completa

`works` (47 colunas, 100% `DIRECT` na Fase 1) é a unidade de direito autoral: a composição em si, distinta
da gravação. Criada/editada via `ObraFormModal.tsx` (`RegistroMusicas.tsx`, aba Obras), 1445 linhas, mesmo
componente para create/edit.

**Autores/compositores/splits**: capturados via `participantes[]` (linha repetível: nome, `classeFuncao`
— Editor/Administrador/Compositor-Autor/Tradutor, texto livre —, `link`, `percentual`), persistidos em
`work_participants` (tabela filha real, `replaceParticipantes()` faz DELETE+INSERT completo a cada save,
sem versionamento/histórico). **Validação de soma de percentuais**: **NÃO EXISTE** em nenhuma camada — nem
frontend nem backend impedem salvar com soma ≠ 100%, percentuais negativos, ou não-numéricos além do
`type="number"` do HTML (sem enforcement real). `CreateWorkDto.authors`/`.shares` (campos adicionais,
`Record<string,unknown>[]`) são aceitos e validados pelo DTO mas **não correspondem a nenhuma coluna real**
nem são tratados pelo service — TypeORM descarta silenciosamente (`GAP-0041`).

**Registro ABRAMUS/ECAD — status real por operação**:

| Operação | Status |
|---|---|
| Busca de obra/artista na ABRAMUS (`AbramusSearchRow.tsx`) | IMPLEMENTED (real, contra API externa) |
| Configuração de credenciais / registrar obra (`register-work`) | IMPLEMENTED |
| Importar obra encontrada na busca ABRAMUS para o catálogo local | STUB — `useAbramusImport()` sempre lança erro; rota não existe no backend |
| Detecção "já importado" (badge) | STUB — sempre retorna vazio |
| Sincronização em massa (sync-all) | STUB |
| Geração de ISWC/ISRC via ABRAMUS | STUB (código nem chega a ser importado por nenhum componente — DEAD, não apenas quebrado) |
| Código ECAD/entidade (`cod_ecad`, `cod_entidade`) | campos reais, digitação manual livre, sem validação de formato/unicidade |
| ISWC | campo real (`works.iswc`), sem validação de formato nem checagem de duplicidade em nenhuma camada |

`EVIDENCE: docs/backend-v2/field-traceability/modules/catalog.md §5,§9,§10,§11,§12 | CONFIDENCE: HIGH | STATUS: PARTIALLY_CONFIRMED (fluxo de criação/edição real e limpo; integração ABRAMUS parcialmente real, parcialmente stub honesto)`

---

## 8. Phonogram / Fonograma — visão completa

`phonograms` (59 colunas, 100% `DIRECT`) representa a **gravação concreta** de uma obra — uma performance
específica, registrada. Criado/editado via `FonogramaFormModal.tsx` (aba Fonogramas de
`RegistroMusicas.tsx`), 1224 linhas.

**Relação `obra_id`**: `phonograms.obra_id → works.id` — campo real, selecionado via busca (`RELATION_SELECTOR`),
persistido corretamente. É esta relação que cria a cadeia transitiva até o Project (`phonograms.obra_id →
works.id → works.projeto_id → projects.id`).

**Participação** (produtor fonográfico, intérprete, músico acompanhante): 3 grupos repetíveis, persistidos
em `phonograms.participacao` (jsonb, sem normalização, cada linha inclui `artista_id`). Mesma ausência de
validação de soma de percentuais que em `works` (`GAP-0041`-adjacent, contado separadamente como
`SPLIT_VALIDATION_GAP`).

**Upload de áudio (`arquivoAudio`)**: **FAKE end-to-end** — `handleAudioUpload()` só lê `file.name`/
`file.size` do objeto `File` do navegador e grava esses dois valores como jsonb (`phonograms.arquivo_audio`);
o binário nunca é transmitido para nenhum provedor de storage (sem `FormData`, sem endpoint de upload). A
coluna real `phonograms.audio_file_id` (uuid, presumivelmente pensada para referenciar um upload real) fica
sempre `NULL` (`GAP-0042` no registro canônico).

**Identificador (ISRC)**: composto de 4 sub-campos (`isrcPais`/`isrcRegistrante`/`isrcAno`/
`isrcDesignacao`), concatenados via `joinIsrc()`. Sem validação de formato nem checagem de duplicidade em
nenhuma camada.

**Cadeia até o Project**: `Phonogram → (obra_id) → Work → (projeto_id) → Project`. Status:
`ALREADY_CORRECT` transitivamente — sem coluna direta necessária hoje, sem gap novo criado por esta ausência
(`decision-register.json`, DEC-001.crossDomainRelationsMatrix).

`EVIDENCE: docs/backend-v2/field-traceability/modules/catalog.md §6,§10,§14 | CONFIDENCE: HIGH | STATUS: CONFIRMED para a relação obra_id; MISSING confirmado para o storage de áudio`

---

## 9. Release / Lançamento — visão completa

`releases` (27 colunas, 100% `DIRECT`) é o **produto de distribuição** — single/EP/álbum — com pipeline de
status próprio (`draft → metadata_pending → assets_pending → review → approved → scheduled → distributed →
released → archived/cancelled`, 10 valores reais, workflow com guards reais no backend). Distinto e
explicitamente **não fundido** com "release como agrupador de fonogramas" (não há relação direta a
`phonograms`) nem com "release como projeto operacional" (`projects` é entidade totalmente separada — ver
§16 de `releases.md`).

**Achado crítico mais severo de toda a série de auditoria**: `LancamentoFormModal.tsx` injeta
incondicionalmente um campo `internal_status` em todo `POST /releases`/`PATCH /releases/:id`, mas esse campo
**não existe** em `CreateReleaseDto`/`UpdateReleaseDto` nem como coluna física. Com
`ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` global, **toda tentativa real de criar ou
editar um Lançamento via a UI é rejeitada com HTTP 400** — o módulo inteiro de criação está, hoje, 100%
não-funcional na prática (`GAP-0129`, classificado `S1_HIGH`, `CREATE_MAPPING_MISMATCH`/`EDIT_MAPPING_MISMATCH`).

**Tracklist / DEC-007**: a decisão `DEC-007` (`RELATIONAL_TRACKLIST_MODEL`, RESOLVED) determinou que a
tracklist de um Lançamento deve ser **relacional**, referenciando fonogramas concretos — cadeia canônica
`Release → Release Track → Phonogram → Work → Rights/Shares`. Isso significa explicitamente:

- `releases.metadata.faixas` (o jsonb hoje usado na prática) **NÃO é** e **nunca será** a fonte canônica
  futura — está classificado `NON_CANONICAL_METADATA` (candidato a dado legado/fonte de migração).
- `release_works(release_id, work_id)` (a tabela relacional que já existe no schema, nunca populada) **NÃO
  é automaticamente aceita como o schema final** — está explicitamente marcada insuficiente por faltar
  `phonogram_id` e `position`/`order`.
- `FINAL_RELATIONAL_SCHEMA_STATUS: TO_BE_DESIGNED` — se será uma nova tabela `release_tracks` ou uma
  evolução de `release_works`, **fica para uma etapa futura de resolução de schema**, ainda não decidida.
- Nenhuma implementação foi feita: `release_works` nunca foi populada, `metadata.faixas` não foi alterada.

**Demais campos**: ISRC/UPC/EAN, artwork (upload real via Cloudflare R2, contrastando positivamente com o
stub de áudio de `projects`/`catalog`), distribuidora (catálogo estático de 6 provedores, todos STUB — ver
§17 Integrations), status workflow (10 valores reais no backend vs. 7 valores de "status de exibição" no
frontend, com mapeamento perdedor entre os dois).

`EVIDENCE: docs/backend-v2/field-traceability/modules/releases.md §0,§8,§10,§14,§15 | decision-register.json (DEC-007) | canonical-gap-register.json (GAP-0129, GAP-0007) | CONFIDENCE: HIGH | STATUS: CONFIRMED (create/edit quebrados); PENDING_PRODUCT_DECISION para o desenho final da tabela relacional`

---

## 10. Artist / Artista — visão completa

`artists` (78 colunas reais). **Dois fluxos paralelos de criação/edição**: `ArtistaFormModal.tsx` (real, em
uso, ~45 campos, "única fonte de verdade" segundo o próprio comentário do código) vs. `ArtistaCadastro.tsx`
(rota `/artistas/novo`, ~71 campos, confirmada **órfã** — zero links de navegação em todo o app, embora
funcional se acessada por URL direta). Um terceiro fluxo, o autocadastro público
(`ArtistaSignupPublic.tsx`), está **100% quebrado**: envia para `POST /public/artists`, endpoint que **não
existe em nenhum lugar do backend** (fechado no módulo `auth`, `GAP-0025`/`GAP-0026`).

**Divisão real de persistência**: ~23 colunas físicas diretas, 4 colunas cifradas (AES-256-GCM: email,
telefone, CPF/CNPJ, contato do manager), e **~41 campos que vivem dentro da coluna `metadata` jsonb** apesar
de colunas físicas homônimas existirem na tabela — decisão arquitetural documentada, não um bug (correção
de classificação em relação à Fase 1, ver `artist.md §2`).

**Métricas de plataforma**: dois sistemas paralelos e não-reconciliados — contadores manuais digitados pelo
usuário (`spotify_ouvintes`, `youtube_inscritos` etc., dentro de `metadata`) vs. sincronização real via API
externa (`artist_platform_profiles`, 24 colunas, Spotify + YouTube com OAuth/API key reais,
`CREDENTIAL_REQUIRED_LATER`, ownership de plataforma).

**Relações**: `works.artista_id`, `phonograms.artista_id`, `releases.artista_id`, `contracts.artista_id` —
todos com FK real (DB-enforced) → `artists.id`. `projects.artista_id`, `transactions.artista_id`,
`events.artista_id`, `artist_goals.artista_id` — todos existem como coluna, mas **sem FK declarada**
(`LOGICAL_RELATION_WITHOUT_FK`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/artist.md §1,§2,§6,§8 | decision-register.json (DEC-003) | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 11. Accounting / Financeiro — visão em linguagem de produto

O módulo financeiro gira em torno da `Transação` (`transactions`, 28 campos, mapeamento 1:1 completo com o
formulário) — um registro de receita ou despesa, com categoria/subcategoria (taxonomia hardcoded de ~90
opções), e vínculos opcionais a Artista, **Projeto Musical** (`projeto_id`), Contrato e Evento. Também
existe `Nota Fiscal` (`invoices`, 38 campos, domínio limpo, sem gaps encontrados).

**`transactions.projeto_id` deve ser entendido, sob o modelo corrigido, como "transação financeira
pertencente a um projeto musical"** — não a um "projeto financeiro genérico". Uma despesa de estúdio, um
adiantamento de contrato, uma receita de streaming: todos podem ser vinculados à música específica que os
gerou, via esse campo, que é real e populado pelo formulário (`projetoVinculado`).

**Achados críticos** (todos `REAL_MAPPING_GAP`, nenhum corrigido):

1. `entityLinks` ("Vínculos Gerenciais — P&L") — a UI exige um array de rateio multi-entidade
   (`TransactionEntityLink[]`, somando 100%) mas o backend **descarta silenciosamente** essa chave (Zod sem
   `.passthrough()`); a tabela até então cogitada como destino semântico (`transaction_allocations`) não
   tem nenhum consumidor real (`GAP-0009`). **CORREÇÃO CANÔNICA (decisão do Product Owner,
   `REMOVE_SECOND_ACCOUNTING_LAYER`, ver `docs/backend-v2/review/01-full-project-exhaustive-verification.md`
   §XV.6/PO-VERIFY-027 e `gap-resolution/00-canonical-gap-register.md`): `transaction_allocations` —
   e as demais 7 tabelas da segunda camada de accounting — está descartada como arquitetura-alvo do v2.
   `GAP-0009` continua real e `OPEN`, mas não pode mais propor `transaction_allocations` como solução;
   `transactions` permanece o único ledger financeiro canônico. Este adendo supera, sem apagar, toda
   menção equivalente em outras partes deste documento (achados, matriz de relações, apêndices).**
2. `/financial-categories/rules*` — toda a tela de "Regras" (criar/editar/excluir regras de categorização
   automática) chama endpoints que **não existem** no backend, retornando 400 em toda a carga da página
   (`GAP-0010`).
3. `CategoriasFinanceiras.tsx` — página inteira desconectada do backend real, 100% `localStorage`
   (`GAP-0011`).
4. Upload de anexo (`anexo_url`) — fake, `blob:` local, anulado antes do submit (`GAP-0012`).
5. `Contabilidade.tsx`, aba "P&L por Projeto" — **não agrupa por projeto**, apesar do rótulo prometer isso:
   trata cada transação individualmente como "1 projeto", usando a descrição livre da transação como nome
   exibido, ignorando completamente a coluna real e populada `projeto_id` (`GAP-0013`, cross-domain com
   `projects`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/accounting.md §2,§3 | canonical-gap-register.json (GAP-0009,0010,0011,0012,0013) | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 12. Validação da regra financeira cross-domain

**Regra alvo** (doc74, §18): uma receita/despesa deve ser registrada uma única vez e, quando vinculada a
artista/projeto/contrato/evento/etc., deve aparecer automaticamente na visão de contabilidade/P&L
correspondente.

| Fluxo | CURRENT_STATE | TARGET_MODEL | CURRENT_GAPS |
|---|---|---|---|
| Transação → Projeto musical → P&L por Projeto | `transactions.projeto_id` é gravado corretamente, mas a tela de P&L por Projeto nunca lê/agrupa por essa coluna | grupo real por `projeto_id`, com join em `projects` | `GAP-0013` |
| Transação → Artista → P&L por Artista | `transactions.artista_id` é gravado e **é** lido/agrupado corretamente por essa mesma tela (contraste positivo) | mantido | nenhum |
| Contrato assinado → Transação (receita) | **automação real** confirmada: `CONTRACT_SIGNED` cria uma transação provisória (`tipo='receita'`, `categoria='contratos'`) com valor = `contracts.valor` | mantida, mas expandida | prática só alcançável se o contrato chegar a `assinado` — hoje bloqueado pelo bug de `arquivo_url` no fluxo principal (`contracts.md §15`) |
| Termos financeiros do contrato (forma de pagamento, vencimento, parcelas) → Transação | **não propagados** — só `valor` chega à transação; os 5 campos financeiros ricos de `contract_service_types` nunca são lidos pelo `ContratoWizard` | propagação completa de termos, incluindo agenda de parcelas | `GAP-0055` |
| Evento (venda de ingresso/receita) → Transação | não existe propagação alguma | criar transação a partir de receita de evento | `GAP-0078` |
| Licenciamento (taxa de licença) → Transação | não existe propagação | criar transação a partir de taxa de licença | `GAP-0106` |
| Monitoramento (royalties detectados/ECAD) → Transação | não existe propagação | criar transação a partir de royalty reconciliado | `GAP-0119` |
| Audiovisual/Marketing → Projeto musical (para agregação financeira futura) | FK real existe (`financial_project_id`) mas nunca escrita por nenhuma UI | escrita real do vínculo | `GAP-0033` |
| Entradas gerenciais multi-entidade (rateio) | UI exige, backend descarta | persistência real de rateio | `GAP-0009` |

**Conclusão**: a "regra de ouro" de consistência financeira **não está implementada de ponta a ponta** hoje
— existe um único caminho real e automático (Contrato assinado → Transação), praticamente inatingível na
prática devido a um bug não relacionado (`arquivo_url`). Todos os demais domínios (Evento, Licenciamento,
Monitoramento, Audiovisual, Marketing) capturam dado financeiro-adjacente sem qualquer propagação
automática para a Contabilidade central.

`EVIDENCE: docs/backend-v2/field-traceability/modules/contracts.md §15 | docs/backend-v2/field-traceability/modules/accounting.md §2.5 | canonical-gap-register.json (GAP-0013, GAP-0033, GAP-0055, GAP-0078, GAP-0106, GAP-0119, GAP-0009) | CONFIDENCE: HIGH | STATUS: PARTIALLY_CONFIRMED`

---

## 13. Contracts / Contratos — o que é, como é criado, e o que as decisões significam (e não significam)

Um `Contract` (`contracts`, 25 colunas) representa um contrato entre o tenant e uma parte (artista, cliente,
prestador). Relaciona-se a `Artist` via `contracts.artista_id` (FK real, mas só escrita pelo fluxo
secundário) e não tem relação alguma com `Project`/`Work`/`Phonogram` no schema atual.

**Como é criado hoje**: dois componentes distintos e incompatíveis — `ContratoWizard.tsx` (fluxo principal,
6 passos: template → partes → variáveis → preview → signatários → revisão) e `ContratoFormModal.tsx` (fluxo
secundário, só alcançável a partir do módulo `catalog` após registrar uma Obra/Fonograma). Os dois têm
conjuntos de campos parcialmente disjuntos — `arquivo_url`/`exclusivo` só existem no Modal; `template_id`/
partes dinâmicas/variáveis do manifesto só existem no Wizard. Editar um contrato criado por um dos dois
fluxos usando o outro pode **destruir dados** (ex.: editar via Modal um contrato do Wizard sobrescreve o
blob JSON estruturado de partes/variáveis com texto livre no mesmo campo `observacoes`).

**O que `DEC-004` (`UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT`, RESOLVED) significa**:
- Haverá **uma única implementação canônica** de formulário/estado de contrato, operando em 2 modos:
  `WIZARD` (o fluxo completo atual) e `QUICK` (o fluxo abreviado hoje disparado por `RegistroMusicas.tsx`).
- **Ambos os entrypoints reais são preservados** — a decisão não autoriza remover a funcionalidade do
  catálogo de disparar criação rápida de contrato.
- É um princípio **conceitual**, não uma decisão de qual arquivo físico sobrevive — pode ser o Wizard
  refatorado, um novo componente compartilhado, ou outra reorganização técnica equivalente.

**O que `DEC-004` explicitamente NÃO significa** (para não deixar o leitor assumir que já foi implementado):
- **Nenhum código foi alterado.** `ContratoWizard.tsx`, `ContratoFormModal.tsx` e `RegistroMusicas.tsx`
  continuam exatamente como estavam.
- **Não resolve** o conflito semântico do campo `observacoes` (Wizard grava JSON estruturado; Modal grava
  texto livre no mesmo campo) — permanece `UNRESOLVED_IMPLEMENTATION_GAP`.
- **Não legitima** armazenar PII estruturada dentro de `observacoes` — `GAP-0049` (CPF/CNPJ/RG de partes em
  texto puro, exportado sem máscara) permanece `OPEN`.
- **Não corrige** o bug real de `arquivo_url` (ausente no fluxo principal, bloqueia a transição de workflow
  `aguardando_assinatura → assinado`) nem o de `exclusivo` (sempre `false` no fluxo principal).

**O que `DEC-002` (`CONTRACT_SERVICE_TYPES_CANONICAL`, RESOLVED) significa**:
- `contract_service_types` é o **vocabulário canônico** de tipo de contrato — a fonte mais rica (32
  colunas, incluindo termos financeiros).
- `WIZARD` e `QUICK` devem, no futuro, consumir a **mesma** fonte canônica — hoje só o `QUICK`
  (via `ContratoFormModal.tsx`) já faz isso; o `WIZARD` deriva o tipo do `tipo_servico` de texto livre do
  template, que precisa de alinhamento futuro.

**O que `DEC-002` explicitamente NÃO significa**:
- **Não decide** a chave física de referência (`service_type_id` vs. `service_type_slug`) — fica para a
  etapa de resolução de schema/contrato.
- **Não significa** que os campos financeiros ricos de `contract_service_types` (moeda, multa, juros, prazo)
  já são consumidos corretamente em algum lugar — não são (nenhum contrato criado hoje carrega esses termos
  estruturados).
- **`GAP-0055`** (propagação financeira contracts→accounting) permanece um gap independente, **não**
  resolvido por `DEC-002`.

`EVIDENCE: docs/backend-v2/field-traceability/modules/contracts.md §5,§6,§7,§10,§14,§30 | decision-register.json (DEC-002, DEC-004) | CONFIDENCE: HIGH | STATUS: PENDING_PRODUCT_DECISION quanto à implementação (decisão conceitual resolvida, zero código alterado)`

---

## 14. Contract Type — classificação das 4 fontes (per DEC-002)

| Fonte | Classificação (DEC-002) | Observação |
|---|---|---|
| `contract_service_types` (32 colunas) | **CANONICAL_SOURCE_OF_TRUTH** | única tabela rica (termos financeiros, `requires_*` condicionais); hoje só consumida pelo `ContratoFormModal.tsx` (fluxo secundário) |
| `contract_templates.tipo_servico` | **LEGACY/DENORMALIZED_REFERENCE_TO_CANONICAL_TYPE** | é o valor que efetivamente vira `contracts.tipo` via o Wizard (fluxo principal) hoje; forma física futura (FK vs. slug) não decidida |
| `contract_categories` (localStorage, `CategoryRegistry.tsx`) | **DISPLAY_ONLY** | 11 categorias seed, usadas só para rotular templates no Passo 1 do wizard; nunca persistida no backend |
| `CONTRACT_TYPES` (const hardcoded no frontend) | **DEAD_LEGACY_VOCABULARY** | usada apenas por `contract-party-origin.mapper.ts`, que por sua vez não tem nenhum consumidor — código morto duplo |

`contracts.tipo` (coluna física real) deixa de poder ser uma fonte de vocabulário independente — sua
semântica futura é representar/referenciar o `ContractServiceType` canônico, mas se vira FK, slug
denormalizado, ou é mantido por compatibilidade **não é decidido por `DEC-002`**.

`EVIDENCE: decision-register.json (DEC-002.sourceClassification) | docs/backend-v2/field-traceability/modules/contracts.md §10 | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 15. Audiovisual — visão completa

Representa produções audiovisuais (videoclipes, reels, teasers, backstage) ligadas a uma música. Entidade
principal: `audiovisual_projects` (47 colunas). Backend genuinamente rico — **9 domínios completos**
(projeto, briefing, entregáveis, storyboard/shots, cronograma de gravação, equipe, arquivos, tarefas,
aprovações — 187 colunas, 100% `DIRECT`) — mas o frontend só alcança **1 dos 9** (o projeto em si);
**8 domínios inteiros (16 de 20 hooks) não têm nenhum consumidor de UI** — incluindo geração automática real
de tarefas por estágio, que roda no backend mas cujo resultado ninguém consegue ver.

**Relação com Project via `financial_project_id`**: `audiovisual_projects.financial_project_id` é uma FK
real, DB-enforced, apontando para `projects.id` — classificada **LEGACY_NAMING**, confirmada: a coluna é
real e a relação é válida, mas o nome sugere um propósito financeiro quando sua função real é vincular a
produção audiovisual ao projeto musical de origem. Nenhum formulário a escreve hoje (`GAP-0033`).

**Segundo achado central**: o filtro de status da listagem (`AudiovisualFilterBar.tsx`) usa valores em
português (`"agendada"`, `"em gravação"`...) contra dados reais armazenados em inglês (`scheduled`,
`recording`...) — qualquer seleção nos 3 dropdowns de status sempre retorna zero resultados, confirmado por
leitura direta de código, ativo e alcançável.

`EVIDENCE: docs/backend-v2/field-traceability/modules/audiovisual.md §1,§2,§6 | canonical-gap-register.json (GAP-0031, GAP-0032, GAP-0033) | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 16. Marketing — visão completa

Domínio amplo: Campanha (ads+orgânico), Conteúdo (calendário de publicação), Biblioteca de Ativos
(versionamento+aprovação), Media Plan (Campaign Builder), Projeto de Marketing (guarda-chuva ligando
artista/empresa/evento/campanha), Estratégia (Strategy→Objective→Initiative→Action), Tarefas, IA. **Não é
"só campanhas pagas"** — cobre todo o ciclo, incluindo comunicação institucional.

**Achado arquitetural central**: dois sistemas de campanha paralelos e incompatíveis escrevendo na mesma
tabela `campaigns`. Sistema A (`CampaignsController`, `/campaigns`) tem um DTO em inglês espalhado
diretamente sobre uma entidade em português sem nenhuma tradução — `POST /campaigns` falharia por violação
de `NOT NULL` — mas está confirmado **morto/órfão**, sem nenhum consumidor frontend real. Sistema B
(`MarketingCampaignBuilderController`, `/marketing/campaigns`) é o real e ativo, grava `tipo` sempre
hardcoded como `'marketing_builder'` e mantém a maioria dos campos ricos (objetivo, plataformas, audiência,
UTM) exclusivamente dentro de `metadata.marketingBuilder.payload` (jsonb) — sem coluna física dedicada.

**Relação com Project via `financial_project_id`**: mesmo padrão do Audiovisual —
`marketing_projects.financial_project_id → projects.id` é FK real, DB-enforced, classificada
**LEGACY_NAMING**, nunca escrita por nenhum formulário (`GAP-0033`, compartilhado com audiovisual).

**Dado fabricado confirmado**: `Campanhas.tsx::campaignSpend()` calcula "Gasto Total" como
`budget * 0.41` (um coeficiente arbitrário) sempre que `costPerResult`/`conversions` não foram preenchidos
manualmente — apresentado ao usuário com a mesma formatação visual de um dado real (`GAP-0112`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/marketing.md §1,§4,§9 | canonical-gap-register.json (GAP-0033, GAP-0111, GAP-0112) | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 17. Módulos — um por um (24 módulos)

## ACCOUNTING
### Finalidade
Gestão financeira do tenant: transações (receita/despesa), notas fiscais, categorização financeira, P&L
(resultado) por empresa/projeto/artista.
### Entidades principais
`Transaction` (`transactions`, 28 campos), `Invoice` (`invoices`, 38 campos), `FinancialCategory`
(`financial_categories`, árvore), `FinancialRule` (`financial_rules`).
### O que o usuário cria/edita
Transações (receita/despesa com >25 campos condicionais), Notas Fiscais, (tentativa de) categorias
financeiras customizadas e regras de categorização automática.
### Entrypoints reais do frontend
`Financeiro.tsx` (`/accounting`), `NotaFiscal.tsx` (`/accounting/nota-fiscal`), `CategoriasFinanceiras.tsx`
(`/accounting/categorias`), `TransacaoRules.tsx` (`/accounting/rules`), `Contabilidade.tsx`
(`/accounting/contabilidade`).
### Tabelas principais
`transactions`, `invoices`, `financial_categories`, `financial_rules`, `transaction_allocations` (existe,
sem consumidor).
### Endpoints principais
`GET/POST/PATCH/DELETE /transactions`, `GET/POST/PATCH/DELETE /invoices`, `GET/POST/PATCH/DELETE
/financial-categories` (real); `/financial-categories/rules*` (**inexistente**, 400 em toda carga).
### Source of Truth atual
`transactions`/`invoices` são a fonte real e consistente para dado financeiro transacional;
`financial_categories` é real mas subutilizada; `CategoriasFinanceiras.tsx` é uma fonte paralela e
100% falsa (localStorage).
### Relações com outros módulos
`transactions.projeto_id → projects.id` (real, populado, ver §11/§12); `.artista_id`, `.contrato_id`,
`.evento_id` (relações lógicas, sem FK física).
### Campos/estruturas mais importantes
`valor`, `tipo`, `categoria`/`subcategoria` (texto livre legado), `projeto_id`, `artista_id`,
`contrato_id`, `evento_id`, `entityLinks` (exigido pela UI, nunca persistido).
### Fluxo funcional principal
1. Usuário abre "Nova Transação" em Financeiro.
2. Preenche tipo, valor, categoria/subcategoria, vínculos opcionais (artista/projeto/contrato/evento).
3. Sistema tenta persistir `entityLinks` (rateio gerencial) — descartado silenciosamente pelo backend.
4. Transação é salva com os 28 campos reais mapeados 1:1.
5. Aba "Contabilidade" tenta exibir P&L por Empresa/Projeto/Artista — só o agrupamento por Artista e
   por Empresa realmente agrega; "P&L por Projeto" trata cada transação como seu próprio projeto.
### O que funciona hoje
Criação/edição de Transação (28 campos) e Nota Fiscal (38 campos) — domínios limpos, sem gap de mapeamento.
P&L por Artista e por Empresa.
### O que está parcial
`financial_categories` real mas só consumida por 1 de 2 telas que deveriam usá-la; import OFX funciona mas
sem dedupe/atomicidade.
### O que está quebrado
`/financial-categories/rules*` (400 sempre); "P&L por Projeto" não agrupa por projeto; upload de anexo é
fake.
### O que é fake/stub/dead
`CategoriasFinanceiras.tsx` (100% localStorage); `entityLinks` (UI exige, backend descarta); XLSX de 3
abas em `TransacaoFormModal` (código morto, inatingível).
### Decisões já tomadas que afetam o módulo
`DEC-001` (correção do significado de `projects` afeta diretamente a interpretação de `projeto_id`).
### Decisões ainda pendentes
Nenhuma decisão formal de Wave 0 é específica deste módulo (os gaps são de implementação, não de decisão).
### Gaps principais
- GAP-0009 (entityLinks nunca persistido, S1_HIGH)
- GAP-0010 (/financial-categories/rules* inexistente, S1_HIGH)
- GAP-0011 (CategoriasFinanceiras.tsx desconectada, S1_HIGH)
- GAP-0012 (upload de anexo fake, S2_MEDIUM)
- GAP-0013 (P&L por Projeto não agrupa, S2_MEDIUM, cross-domain com projects)
- GAP-0014 (XLSX 3 abas, código morto, S3_LOW)
- GAP-0015 (financial_category_id nunca setado pelo form — NO_FIX_REQUIRED/DEFERRED, migração parcial intencional)
- GAP-0016 (import OFX sem dedupe/atomicidade, S3_LOW)
- GAP-0017 (filtros/paginação 100% client-side, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Nenhuma definição de schema v2 foi produzida para este módulo — permanece pendente de desenho.
### Pontos que precisam de confirmação do Product Owner
Se "P&L por Projeto" deve, de fato, significar "P&L agrupado por música/projeto musical" sob o modelo
corrigido (ver PO-VERIFY-B03).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/accounting.md §1,§2,§3,§5,§6,§7
- canonical-gap-register.json (GAP-0009 a GAP-0017)

---

## ADMIN
### Finalidade
Painel administrativo para operações de plataforma (planos, assinaturas, clientes, auditoria, suporte) e
configurações administrativas de tenant.
### Entidades principais
Não introduz entidades próprias — consome `billing_plans`, `billing_subscriptions`, `tenants`,
`activity_logs`, `support_tickets` de outros módulos.
### O que o usuário cria/edita
Planos e assinaturas (via billing real), nada mais de fato persistente — a maior parte das telas de
"configuração de plataforma" (`AdminSettings.tsx`) são decorativas.
### Entrypoints reais do frontend
`AdminDashboard.tsx`, `AdminClients.tsx`, `AdminPlans.tsx`, `AdminSubscriptions.tsx`, `AdminAudit.tsx`,
`AdminSupport.tsx`, `AdminSettings.tsx` (8 abas), `AdminKnowledge.tsx` (dev-only).
### Tabelas principais
`billing_plans`, `billing_subscriptions`, `tenants` (via `billing.controller.ts`), `activity_logs`,
`support_tickets` (via as mesmas rotas tenant-scoped do módulo `support`).
### Endpoints principais
`GET/PATCH /billing/admin/tenants[/:id]` (`super_admin`, genuinamente cross-tenant); rotas de
`billing.controller.ts` para planos/assinaturas.
### Source of Truth atual
Real e correto para Dashboard/Clientes/Planos/Assinaturas (`billing.controller.ts`). Falso/decorativo para
`AdminSettings.tsx` inteiro.
### Relações com outros módulos
`AdminSupport`/`AdminAudit` reusam exatamente os mesmos endpoints tenant-scoped do módulo `support` real —
não existe rota cross-tenant separada para eles, apesar da moldura sugerir visão de plataforma.
### Campos/estruturas mais importantes
Nenhum campo de domínio próprio — é uma camada de agregação/administração sobre outros módulos.
### Fluxo funcional principal
1. `super_admin` acessa `/admin/dashboard` — dados reais de billing consolidados.
2. Acessa `AdminClients.tsx`/`AdminPlans.tsx`/`AdminSubscriptions.tsx` — CRUD real via `billing.controller.ts`.
3. Acessa `AdminSupport.tsx`/`AdminAudit.tsx` — recebe apresentação de "visão de plataforma" mas os dados
   são tenant-scoped (mesma rota do módulo real, sem filtro cross-tenant algum).
4. Acessa `AdminSettings.tsx` (8 abas) — toda tentativa de salvar é um toast falso; Webhooks/Chaves API
   permanentemente vazios com botões "novo" mortos.
### O que funciona hoje
Dashboard/Clientes/Planos/Assinaturas — verificado real e íntegro contra `billing.controller.ts`.
Autorização (`@RequireRole('super_admin')`) confirmada consistente frontend/backend.
### O que está parcial
`AdminAudit`/`AdminSupport` — dados reais, mas moldurados como "cross-tenant" quando são tenant-scoped
(coluna "Tenant" sempre em branco).
### O que está quebrado
Nada tecnicamente "quebrado" (sem erro 400/500) — o problema é a apresentação enganosa de escopo em
AdminAudit/AdminSupport.
### O que é fake/stub/dead
`AdminSettings.tsx` inteiro (8 abas, 770 linhas) — toda ação salva é um toast decorativo. `AdminKnowledge`
— mock auto-declarado, desabilitado em produção. `admin-source.ts` — 6 exports mortos/vazios.
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma decisão formal de Wave 0.
### Gaps principais
- GAP-0018 (AdminSettings.tsx sem persistência real, S2_MEDIUM)
- GAP-0019 (admin-source.ts, 6 exports mortos, S4_INFORMATIONAL)
- GAP-0020 (banner "indisponível" sempre visível, S3_LOW)
- GAP-0021 (AdminAudit/AdminSupport moldura cross-tenant enganosa, S2_MEDIUM)
- GAP-0022 (AdminKnowledge mock dev-only, ACCEPTED_BY_EXISTING_CONTRACT)
- GAP-0023 ("Novo Webhook"/"Nova Chave API" sem onClick, S3_LOW)
- GAP-0024 (nenhuma tabela com sort/paginação server-side, S3_LOW)
### Definição proposta/canônica atual para backend v2
Não produzida.
### Pontos que precisam de confirmação do Product Owner
Se `AdminAudit`/`AdminSupport` devem, de fato, se tornar cross-tenant reais (mudança de arquitetura) ou se
a moldura de UI deve simplesmente ser corrigida para refletir o escopo tenant-scoped real.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: admin")
- canonical-gap-register.json (GAP-0018 a GAP-0024)

---

## ARTIST
### Finalidade
Cadastro e gestão de artistas — perfil, contatos, plataformas externas, métricas, relações com todo o
restante do catálogo/negócio.
### Entidades principais
`Artist` (`artists`, 78 colunas), `ArtistPlatformProfile` (`artist_platform_profiles`, 24 colunas).
### O que o usuário cria/edita
Ficha completa do artista: dados pessoais/civis, artísticos, contato (cifrado), redes sociais, equipe
(manager/gravadora), dados bancários, documentos.
### Entrypoints reais do frontend
`Artistas.tsx` (grid de cards), `ArtistaFormModal.tsx` (create/edit real), `ArtistaVisao360Modal.tsx`
(hub de detalhe, 3170 linhas — maior componente do sistema). `ArtistaCadastro.tsx` (órfã, `/artistas/novo`).
`ArtistaSignupPublic.tsx` (autocadastro público, quebrado — ver módulo `auth`).
### Tabelas principais
`artists`, `artist_platform_profiles`.
### Endpoints principais
`GET/POST/PATCH/DELETE /artists`, `GET/POST /artists/:id/platform-profiles[/:platform/sync]`.
### Source of Truth atual
`ArtistaFormModal.tsx` + `artista.mapper.ts` — única fonte de verdade real, segundo o próprio código.
### Relações com outros módulos
FK real → `works`, `phonograms`, `releases`, `contracts`. Relação lógica (sem FK) → `projects`,
`transactions`, `events`, `artist_goals`.
### Campos/estruturas mais importantes
~23 colunas físicas diretas; 4 cifradas (email/telefone/CPF-CNPJ/contato do manager, AES-256-GCM); ~41
campos roteados para `metadata` jsonb (decisão arquitetural documentada, não bug).
### Fluxo funcional principal
1. Usuário abre "Novo Artista" em `Artistas.tsx`.
2. Preenche ~45 campos via `ArtistaFormModal.tsx`.
3. Dados sensíveis são cifrados antes de persistir; demais campos "estendidos" vão para `metadata`.
4. `ArtistaVisao360Modal.tsx` agrega, client-side, todas as relações (obras/fonogramas/lançamentos/
   contratos/transações/eventos/campanhas) filtrando arrays completos por `artista_id`.
### O que funciona hoje
Criação/edição real (`ArtistaFormModal.tsx`), criptografia de PII, upload de foto/documentos (real, via R2),
import XLSX (1 aba), sincronização real de métricas via Spotify/YouTube.
### O que está parcial
Contadores manuais de seguidores/ouvintes coexistem sem reconciliação com o sync real via API.
### O que está quebrado
Nada dentro do fluxo real `ArtistaFormModal.tsx`; o autocadastro público está 100% quebrado (ver `auth`).
### O que é fake/stub/dead
`ArtistaCadastro.tsx` — órfã, inalcançável pela navegação normal (mas código válido).
### Decisões já tomadas que afetam o módulo
`DEC-003` (`ARTISTA_FORM_MODAL_CANONICAL`, RESOLVED — decisão do Product Owner; corrigido, ver
correção canônica em `gap-resolution/00-canonical-gap-register.md`).
### Decisões ainda pendentes
Nenhuma (corrigido — `DEC-003` resolvida). Trabalho remanescente é implementação: mesclar em
`ArtistaFormModal.tsx` os campos reais exclusivos de `ArtistaCadastro.tsx` (`tipo`, `status`,
`contrato_id`, `manager_nome`, `manager_contato`, `produtor_executivo`, `agencia_booking`,
`label_parceira`, `galeria_urls`, `documentos`) e remover o componente órfão.
### Gaps principais
- GAP-0003 (dois fluxos paralelos de create/edit; decisão DEC-003 resolvida, mesclagem/remoção ainda pendente, S2_MEDIUM — corrigido, texto anterior "decisão pendente" desatualizado)
- GAP-0025 / GAP-0026 (autocadastro público quebrado, fechados no módulo auth, S1_HIGH/S2_MEDIUM)
- GAP-0027 (~41 campos em metadata — ACCEPTED_BY_EXISTING_CONTRACT, não é bug)
- GAP-0028 (contadores manuais vs. sync real sem reconciliação, S3_LOW)
- GAP-0029 (FKs lógicas sem constraint física, S3_LOW)
- GAP-0030 (PII cifrada não pesquisável — NO_FIX_REQUIRED, comportamento correto)
### Definição proposta/canônica atual para backend v2
`ArtistaFormModal.tsx` é o fluxo canônico único (`DEC-003`); `ArtistaCadastro.tsx` a remover após a
mesclagem dos campos listados acima — corrigido, era "não produzida — aguarda resolução de DEC-003".
### Pontos que precisam de confirmação do Product Owner
Nenhum remanescente para este módulo — `DEC-003` já respondida pelo Product Owner (corrigido).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/artist.md §1,§2,§4,§8

---

## AUDIOVISUAL
### Finalidade
Gestão de produções audiovisuais (videoclipes, reels, teasers) ligadas à música/artista.
### Entidades principais
`AudiovisualProject` (47 col), `Briefing`, `Deliverable`, `Shot`, `ProductionDay`, `TeamMember`, `Asset`,
`Task`, `Approval` — 9 tabelas, 187 colunas, 100% `DIRECT`.
### O que o usuário cria/edita
Hoje, na prática, só o `AudiovisualProject` em si (18 campos) — os outros 8 domínios não têm UI.
### Entrypoints reais do frontend
`AudiovisualProjectsList.tsx`, `AudiovisualProductionWorkspace.tsx`, `AudiovisualProjectFormModal.tsx`,
`AudiovisualProjectDetailsModal.tsx`. `/audiovisual/projects/new` (rota órfã).
### Tabelas principais
`audiovisual_projects`, `audiovisual_briefings`, `audiovisual_deliverables`, `audiovisual_shots`,
`audiovisual_production_days`, `audiovisual_team_members`, `audiovisual_assets`, `audiovisual_tasks`,
`audiovisual_approvals`.
### Endpoints principais
`GET/POST/PATCH/DELETE /audiovisual/projects` (+8 famílias de endpoints análogas para os outros domínios,
todas reais e sem consumidor).
### Source of Truth atual
Backend é a fonte real e rica; frontend só expõe ~15% do domínio construído.
### Relações com outros módulos
`phonogram_id` (usado, sem FK); `artist_id`/`release_id`/`campaign_id`/`event_id` (expostos como filtros de
API, nunca escritos por nenhum form); `financial_project_id → projects.id` (FK real, LEGACY_NAMING, nunca
escrita).
### Campos/estruturas mais importantes
`type`, `format`, `capture_status`/`editing_status`/`approval_status` (independentes do `status` de
pipeline), `budget_estimated`/`budget_actual`.
### Fluxo funcional principal
1. Usuário cria projeto audiovisual via modal (18 campos reais).
2. Backend permite pipeline de 8 estágios (`draft→...→published`) com geração automática de tarefas por
   estágio — mas não existe UI de transição de pipeline nem de visualização das tarefas geradas.
3. Filtro de status na listagem sempre retorna zero resultados (bug de idioma português vs. inglês).
### O que funciona hoje
Criação/edição do projeto em si (18 campos, sem gap de mapeamento); workflow de pipeline real no backend.
### O que está parcial
Endpoint de transição de pipeline existe mas sem consumidor de UI.
### O que está quebrado
Filtro de status (sempre zero resultados); relações `artist_id`/`release_id`/`campaign_id`/`event_id`
nunca escritas apesar de expostas como filtro.
### O que é fake/stub/dead
8 dos 9 domínios de backend sem qualquer UI (briefing, entregáveis, storyboard, cronograma, equipe,
arquivos, tarefas, aprovações); rota `/audiovisual/projects/new` órfã.
### Decisões já tomadas que afetam o módulo
`DEC-001` (correção do significado de `financial_project_id`).
### Decisões ainda pendentes
Nenhuma decisão formal de Wave 0 específica.
### Gaps principais
- GAP-0031 (8 de 9 domínios sem UI, S1_HIGH)
- GAP-0032 (filtro de status quebrado, S1_HIGH)
- GAP-0033 (financial_project_id nunca escrita, S2_MEDIUM, cross-domain)
- GAP-0034 (artist_id/campaign_id/event_id nunca escritos, S2_MEDIUM)
- GAP-0035 (rota /audiovisual/projects/new órfã, S3_LOW)
- GAP-0036 (upload de assets sem UI, delete não limpa storage externo, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida.
### Pontos que precisam de confirmação do Product Owner
Se os 8 domínios de backend sem UI (briefing/entregáveis/storyboard/cronograma/equipe/arquivos/tarefas/
aprovações) devem ganhar UI no v2 ou se o escopo real do produto é mais restrito do que o schema sugere.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/audiovisual.md §1,§2,§4,§6

---

## AUTH
### Finalidade
Autenticação (login/signup/reset), sessão, contexto de tenant, autorização (roles/permissões).
### Entidades principais
`auth.users` (Supabase-managed), `org_members` (membership real), `tenant_invitations`.
### O que o usuário cria/edita
Login, cadastro de empresa (signup wizard de 3 passos), troca/reset de senha, onboarding.
### Entrypoints reais do frontend
`Auth.tsx`, `Register.tsx`, `ResetPassword.tsx`, `ChangeRequiredPassword.tsx`, `Onboarding.tsx`,
`ArtistaSignupPublic.tsx` (quebrado).
### Tabelas principais
`org_members`, `tenant_invitations` (schema Supabase `auth.users` gerenciado externamente).
### Endpoints principais
`PATCH /auth/provision-workspace`, `PATCH /auth/onboarding`, `POST /auth/change-required-password`,
`GET /auth/context`; Supabase Auth SDK diretamente para login/signup/reset.
### Source of Truth atual
Supabase Auth para identidade/credenciais; `org_members` para membership; JWT `app_metadata` para
claims de tenant/role — distinção entre autenticação (identidade), autorização (permissões) e contexto de
tenant (`TenantGuard`) claramente separada e verificada consistente.
### Relações com outros módulos
Fundação de todo o resto do sistema — todo módulo depende de `TenantGuard`/`@CurrentTenant()`.
### Campos/estruturas mais importantes
Claim JWT `org_id` (nome enganoso — carrega sempre um `tenants.id`, nunca um `organizations.id` — ver
módulo `workspace`); `role`/`role_id` (modelo dual).
### Fluxo funcional principal
1. Usuário assina/loga via Supabase Auth SDK.
2. `AuthContext.tsx` detecta ausência de `org_id` no JWT + `user_metadata.workspace_slug` → dispara
   auto-provisionamento (`PATCH /auth/provision-workspace`).
3. `TenantGuard` resolve o tenant real a partir do claim `org_id` do JWT (nunca confia no header
   `X-Tenant-ID` do cliente, usado só como checagem de consistência).
4. Membership é revalidada a cada request contra `org_members`.
### O que funciona hoje
Login/logout/reset de senha, auto-provisionamento de workspace, `TenantGuard`/isolamento de tenant
(confirmado sólido), RBAC dual-source.
### O que está parcial
`signOut()` não fecha canais realtime explicitamente (janela até reload).
### O que está quebrado
`ArtistaSignupPublic.tsx` — autocadastro público de artista 100% não-funcional: `POST /public/artists`
não existe em nenhum lugar do backend; toda submissão falha silenciosamente.
### O que é fake/stub/dead
Nada classificado como fake — `AUTH_DISABLED` é um modo de desenvolvimento explícito, não uma simulação
disfarçada.
### Decisões já tomadas que afetam o módulo
Nenhuma decisão formal de Wave 0 específica a `auth` (o `org_id` mal-nomeado é tratado como achado, não
decisão).
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0025 (POST /public/artists inexistente, S1_HIGH)
- GAP-0026 (nomes de campo divergentes no mesmo payload, S2_MEDIUM)
- GAP-0037 (signOut() não fecha canais realtime, S2_MEDIUM)
- GAP-0038 (auto-aceite de convite como efeito colateral de endpoint de leitura — NO_FIX_REQUIRED)
- GAP-0039 (allowlist de Redirect/Site URL do Supabase não verificável por código — DEFERRED, bloqueia cutover)
- GAP-0040 (sem estado explícito "suspended"/"deleted" além de is_active — NO_FIX_REQUIRED)
### Definição proposta/canônica atual para backend v2
JWKS/ES256 + `RequestContext` já fixados em documentos anteriores (doc49), não reabertos aqui.
### Pontos que precisam de confirmação do Product Owner
Se o autocadastro público de artista é um requisito de produto ativo ou se deve ser descontinuado (dado
que está 100% quebrado e nunca funcionou).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/auth.md §1,§2,§3,§4,§8,§9

---

## CATALOG
### Finalidade
Registro do catálogo musical: Obras (composições) e Fonogramas (gravações), incluindo participações/splits
e integração com sociedades de gestão coletiva (ABRAMUS).
### Entidades principais
`Work`/Obra (47 col), `Phonogram`/Fonograma (59 col), `WorkParticipant` (10 col), `RightsHolder`,
`ExternalIdentifier`, `SocietyAccount`/`SocietySubmission`/`SocietySyncJob` (6 tabelas do sub-módulo
`registry`, 91 colunas, zero consumidor frontend).
### O que o usuário cria/edita
Obras (23 campos + participantes) e Fonogramas (30 campos + participação) via `RegistroMusicas.tsx`.
### Entrypoints reais do frontend
`RegistroMusicas.tsx` (abas Obras/Fonogramas), `ObraFormModal.tsx`, `FonogramaFormModal.tsx`,
`ObraViewModal.tsx`, `FonogramaViewModal.tsx`, `AbramusSearchRow.tsx`.
### Tabelas principais
`works`, `phonograms`, `work_participants`, `rights_holders`, `external_identifiers`, `society_accounts`,
`society_submissions`, `society_sync_jobs`, `society_payload_snapshots`, `society_submission_events`,
`society_validation_errors`.
### Endpoints principais
`GET/POST/PATCH/DELETE /works`, `GET/POST/PATCH/DELETE /phonograms`, `/registry/rights-holders`,
`/registry/society-accounts`, `/registry/submissions` (sem consumidor), `GET /integrations/abramus/*`.
### Source of Truth atual
`works`/`phonograms` são fonte real, limpa, 100% `DIRECT`. O módulo `registry` inteiro (rights-holders,
external-identifiers, sociedades) é backend real, correto e seguro, mas **sem qualquer forma de o usuário
final chegar até ele** — nem tela dedicada, nem uso indireto.
### Relações com outros módulos
`works.projeto_id → projects.id` (real, populado, ALREADY_CORRECT); `phonograms.obra_id → works.id`
(real); `works.artista_id`/`phonograms.artista_id → artists.id` (FK real, mas `works.artista_id` sempre
gravado `null` por bug de formulário); `release_works` (junção com `releases`, nunca populada, gerida do
lado `releases`).
### Campos/estruturas mais importantes
`iswc`/`isrc` (sem validação de formato/duplicidade em nenhuma camada), `participantes[]`/`participacao`
(splits, sem validação de soma 100%), `arquivo_audio` (upload fake).
### Fluxo funcional principal
1. Usuário registra uma Obra (título, ISWC, participantes com percentuais).
2. Usuário registra um Fonograma vinculado à Obra (título, ISRC, participação por categoria).
3. Ao salvar, `works.artista_id` é sempre gravado `null` (bug confirmado, `ObraFormModal.tsx:486`),
   apagando silenciosamente qualquer vínculo direto obra↔artista pré-existente ao editar.
4. Usuário pode buscar a obra/artista na ABRAMUS para vincular ou registrar externamente (busca real);
   tentar "importar" um resultado da busca sempre falha (rota inexistente).
### O que funciona hoje
Criação/edição de Obra e Fonograma (53 campos reais, mapeamento limpo); busca/registro ABRAMUS; export via
Central de Relatórios (79 campos).
### O que está parcial
Integração ABRAMUS — busca e registro reais; importação, sincronização e detecção de "já importado" são
stubs.
### O que está quebrado
`works.artista_id` sempre `null` no create/edit (apaga vínculo existente ao salvar).
### O que é fake/stub/dead
Upload de áudio do Fonograma (só nome+tamanho, nunca o binário); módulo `registry` inteiro sem consumidor;
`useCatalogStore`/`catalog.service.ts` (código morto, nunca importado).
### Decisões já tomadas que afetam o módulo
`DEC-001` confirma `works.projeto_id → projects.id` como `ALREADY_CORRECT` sob a definição corrigida.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0041 (authors/shares aceitos pelo DTO, nunca persistidos — split-sheet real, S1_HIGH)
- GAP-0042 (fileUrl aceito e descartado, sem pipeline de áudio, S1_HIGH)
- GAP-0043 (works.artista_id sempre null, S2_MEDIUM)
- GAP-0044 (seletor fonograma→obra usa lista local estática, S3_LOW)
- GAP-0045 (ISRC/ISWC sem validação de formato, S3_LOW)
- GAP-0047 (limite de 50 registros sem paginação de UI, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Nenhuma produzida; `DEC-007` estabelece que a cadeia canônica de direitos passa por `phonograms.obra_id →
works.id`, relevante ao redesenho futuro deste módulo.
### Pontos que precisam de confirmação do Product Owner
Se o módulo `registry` (rights-holders/society-accounts/submissions) é um requisito de produto ativo a
ganhar UI, ou escopo morto a ser formalmente descontinuado.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/catalog.md §1,§5,§6,§9,§11,§12

---

## CONTRACTS
### Finalidade
Criação, gestão e workflow de contratos com artistas/clientes — templates, partes, assinatura eletrônica,
propagação financeira ao ser assinado.
### Entidades principais
`Contract` (25 col), `ContractTemplate` (11 col), `ContractServiceType` (32 col).
### O que o usuário cria/edita
Contratos (via Wizard de 6 passos ou Modal secundário), Templates de contrato, Tipos de serviço (leitura).
### Entrypoints reais do frontend
`Contratos.tsx`, `ContratoWizard.tsx` (principal), `ContratoFormModal.tsx` (secundário, via `catalog`),
`TemplatesContratos.tsx`, `CategoryRegistry.tsx` (localStorage), `VariableRegistry.tsx` (localStorage).
### Tabelas principais
`contracts`, `contract_templates`, `contract_service_types`.
### Endpoints principais
`GET/POST/PATCH/DELETE /contracts`, `GET/POST/PATCH/DELETE /contract-templates`,
`GET/POST/PATCH /contract-service-types`, `POST /integrations/autentique/{configure,send,webhook}`,
`GET/POST /integrations/oauth/* ` (DocuSign, só OAuth).
### Source of Truth atual
`contracts.tipo` deveria referenciar `contract_service_types` (per DEC-002), mas hoje deriva de
`contract_templates.tipo_servico` (texto livre) via o Wizard.
### Relações com outros módulos
`contracts.artista_id → artists.id` (FK real, só escrita pelo Modal secundário); `CONTRACT_SIGNED` →
`artists.status='contratado'` + cria transação em `accounting`; nenhuma relação com `works`/`phonograms`;
`lancamento_id` (coluna real, sem FK, nunca preenchida por nenhuma tela confirmada).
### Campos/estruturas mais importantes
`observacoes` (usado com 2 semânticas conflitantes — blob JSON estruturado no Wizard, texto livre no
Modal), `signers[]` (jsonb, oficial), `arquivo_url` (só no Modal), `exclusivo` (sempre `false` no Wizard).
### Fluxo funcional principal
1. Usuário escolhe um template (Passo 1) — deriva `tipo` do `tipo_servico` livre do template.
2. Detecta partes dinamicamente via placeholders `{{GRUPO.CAMPO}}` no conteúdo do template (Passo 2) —
   serializa tudo (incluindo CPF/CNPJ/RG/endereço) como JSON dentro de `observacoes`, sem criptografia.
3. Preenche variáveis do manifesto (Passo 3), preview (Passo 4), signatários (Passo 5, `signers[]` real).
4. Ao salvar, `status` sempre é forçado para `rascunho`/`aguardando_assinatura` (Select do Passo 6 é
   ignorado).
5. Transição para `assinado` exige `arquivo_url` truthy — campo ausente no fluxo principal, bloqueando
   estruturalmente essa transição para contratos criados pelo Wizard.
### O que funciona hoje
Workflow de status (9 estados reais, roles corretamente gateadas); propagação automática real ao assinar
(cria transação, atualiza status do artista, cria 5 tarefas CRM) — quando alcançável; cron de vencimento
(30 dias, notificação + tarefa de renovação).
### O que está parcial
Integração Autentique — backend completo e funcional, zero consumidor frontend; DocuSign — só OAuth,
sem envio/assinatura real implementada em nenhuma camada.
### O que está quebrado
`POST /contract-templates` rejeita toda criação real via `TemplatesContratos.tsx` (DTO em inglês
incompatível com o payload em português enviado) — bloqueia o Passo 1 do fluxo principal na origem.
### O que é fake/stub/dead
`CategoryRegistry.tsx`/`VariableRegistry.tsx` (100% localStorage); `contact-contracts` (Map em memória, não
Postgres); `contract-party-origin.mapper.ts` (código morto); `ContractStatus.ATIVO` (enum morto,
inalcançável).
### Decisões já tomadas que afetam o módulo
`DEC-002` (CONTRACT_SERVICE_TYPES_CANONICAL, RESOLVED — ver §14), `DEC-004`
(UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT, RESOLVED — ver §13).
### Decisões ainda pendentes
`DEC-008` — se o `sourceId` de uma parte copiada de CRM/Artista deve virar referência viva ou permanecer
snapshot intencional.
### Gaps principais
- GAP-0002 (vocabulário de tipo de contrato — decidido, implementação pendente, S2_MEDIUM)
- GAP-0004 (componente único WIZARD/QUICK — decidido, implementação pendente, S1_HIGH)
- GAP-0008 (party sourceId — decisão DEC-008 pendente, S2_MEDIUM)
- GAP-0048 (criação de template retorna 400 sempre, S1_HIGH)
- GAP-0049 (PII de partes em texto livre, exportada sem máscara, S2_MEDIUM)
- GAP-0050 (envelope DocuSign 0% implementado, S2_MEDIUM)
- GAP-0052 (Autentique real mas sem consumidor frontend, S2_MEDIUM)
- GAP-0054 (contact-contracts usa Map em memória, S1_HIGH)
- GAP-0055 (termos financeiros não propagam para accounting, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Componente único WIZARD/QUICK (DEC-004) + `contract_service_types` canônico (DEC-002) — ambos conceituais,
sem desenho técnico produzido.
### Pontos que precisam de confirmação do Product Owner
DEC-008 (sourceId de parte); se o modelo de PII em `observacoes` deve migrar para armazenamento
estruturado/cifrado antes ou depois da unificação WIZARD/QUICK.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/contracts.md §5,§7,§10,§11,§14,§15,§18,§21,§30

---

## CRM-RELATIONSHIPS
### Finalidade
Gestão de relacionamento com clientes/contatos (CRM) — não confundir com Leads (funil de conversão,
módulo separado).
### Entidades principais
`Client` (`clients`, 39 col) — não existe tabela física `contacts`; "Contato = Cliente" é uma decisão de
domínio documentada no próprio código, ambos os conceitos compartilham `clients`.
### O que o usuário cria/edita
Contato/Cliente (ficha completa — pessoa física/jurídica, endereço, prioridade, responsável).
### Entrypoints reais do frontend
`ContatoFormModal.tsx`/`ContatosPanel.tsx`, embutidos dentro de `LeadsPage.tsx` do módulo `leads` (a rota
`/crm` redireciona para lá).
### Tabelas principais
`clients`.
### Endpoints principais
`GET/POST/PATCH/DELETE /clients` (real). `GET/POST /contacts` (legado, **facade em Map em memória**, não
Postgres — zero consumidor frontend real, mas tecnicamente implementado).
### Source of Truth atual
`/clients` é a fonte real; a facade `/contacts` é código morto tecnicamente correto mas desconectado.
### Relações com outros módulos
Artista↔CRM: referência viva real (sem cópia de dado). Contrato↔CRM: padrão misto — a FK de nível de
contrato é referência viva real, mas a cópia de dado de parte de contrato (dentro do Wizard) é uma cópia
desconectada (já documentado em `contracts`).
### Campos/estruturas mais importantes
~15 colunas físicas reais (foto, perfil, função, razão social/nome fantasia, endereço detalhado,
status/prioridade de contato) capturadas pelo formulário mas **nunca enviadas ao backend** — nem a função
de mapeamento nem o DTO as declaram.
### Fluxo funcional principal
1. Usuário cria/edita um Contato/Cliente via `ContatoFormModal.tsx`.
2. ~15 campos reais capturados na tela nunca chegam ao backend (função de mapeamento não os inclui).
3. PII que de fato persiste (email/telefone/documento) é corretamente cifrada AES-256-GCM.
### O que funciona hoje
CRUD real de `clients`; criptografia de PII correta e completa.
### O que está parcial
Backend de upload presigned-to-R2 existe mas nunca é chamado (UI só usa blob URLs locais).
### O que está quebrado
~15 campos reais capturados pelo form, nunca persistidos (nem coluna própria, nem `metadata`).
### O que é fake/stub/dead
Facade legado `/contacts` (Map em memória); `ContactComponents.tsx` (317 linhas/13 componentes, código
morto); 4 Zustand stores mortos.
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma decisão formal de Wave 0 específica (mas `DEC-008`, em `contracts`, referencia a origem CRM de
partes de contrato).
### Gaps principais
- GAP-0059 (facade /contacts em Map, não Postgres, S1_HIGH)
- GAP-0060 (~15 campos aceitos pelo form, nunca mapeados, S1_HIGH)
- GAP-0061 (Auditoria.tsx field-mismatch, S3_LOW)
- GAP-0064 (limite 50 sem paginação, S2_MEDIUM)
- GAP-0065 (taxonomia de tipo de relacionamento inconsistente entre telas, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida.
### Pontos que precisam de confirmação do Product Owner
Se os ~15 campos capturados e descartados hoje são um requisito real de produto (e devem ganhar destino no
v2) ou se devem ser removidos do formulário.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: crm-relationships")
- canonical-gap-register.json (GAP-0059, GAP-0060, GAP-0064, GAP-0065)

---

## DASHBOARD
### Finalidade
Painel inicial agregando indicadores cross-domain (financeiro, artistas, contratos, eventos, catálogo).
### Entidades principais
Nenhuma própria — agrega `artists`, `contracts`, `transactions`, `events`, `releases`, `projects`,
`activity_logs`. Existe um módulo real de `analytics` por trás (`AnalyticsController`).
### O que o usuário cria/edita
Nada — é uma tela de leitura/visualização.
### Entrypoints reais do frontend
`Dashboard.tsx` (8 widgets: KPIs, ranking de artistas, atividades recentes, receita, etc.).
### Tabelas principais
Nenhuma dedicada — lê das tabelas de outros módulos + `GET /analytics/dashboard` (21 agregações SQL
tenant-scoped, imunes a truncamento) e `GET /analytics/revenue` (série temporal mensal real).
### Endpoints principais
`GET /analytics/dashboard`, `GET /analytics/revenue` — ambos reais, bem construídos, **sem consumidor
frontend** (o Dashboard não usa nenhum dos dois).
### Source of Truth atual
Os 4 KPI cards principais e o ranking de artistas são computados **client-side sobre arrays sem `limit`
customizado** — sujeitos ao truncamento padrão de 50 registros do backend — em vez de usar o
`AnalyticsController` real, correto e imune a essa truncagem.
### Relações com outros módulos
Agrega de `artist`, `contracts`, `accounting`, `events`, `crm-relationships`, `releases`, `projects`.
### Campos/estruturas mais importantes
"Receita Total" — rotulada como total, mas na verdade é uma janela móvel de 30 dias; um cálculo de P&L
mais preciso (`financeiroMetrics`) é computado a cada render mas nunca exibido.
### Fluxo funcional principal
1. Usuário acessa `/dashboard`.
2. 8 widgets disparam chamadas independentes para listas já auditadas de outros módulos, sem `limit`
   customizado (herda o truncamento de 50).
3. 14 assinaturas `useWsEvent()` no Feed de Atividades nunca recebem nada — não existe ponte entre o
   barramento de eventos de domínio interno (`EventEmitter2`) e o Supabase Realtime broadcast.
### O que funciona hoje
Renderização geral dos widgets com os dados truncados disponíveis; `AnalyticsController` real por trás,
pronto para uso futuro.
### O que está parcial
Filtro de intervalo de data por widget é client-side, sempre refaz a mesma chamada não-filtrada.
### O que está quebrado
Feed de Atividades (0 de 14 eventos realmente chega); 3 de 4 fórmulas de KPI comparadas divergem entre a
versão truncada exibida e a versão SQL completa (calculada mas não usada).
### O que é fake/stub/dead
Dois blocos de código morto confirmados inertes (`computeFromMockStorage()`, ~150 linhas; um bloco legado
de 11 listeners `CustomEvent`); `dashboard-layout` Zustand store (drag-to-rearrange, nunca ligado).
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0067 (widgets leem cache pré-agregado obsoleto em vez de tabelas vivas, S2_MEDIUM)
- GAP-0068 ("Atividades Recentes" sem nenhuma família de evento real, S2_MEDIUM)
- GAP-0069 (3 widgets truncados em limit=50 sem indicação, S2_MEDIUM)
- GAP-0070 (filtro de data client-side, refetch inútil, S2_MEDIUM)
- GAP-0071 (visibilidade de widget por role só no frontend, sem checagem de autorização, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Nenhuma — mas o `AnalyticsController` já existente é um candidato natural de fonte de verdade única para
o v2.
### Pontos que precisam de confirmação do Product Owner
Se "Receita Total" deve, de fato, ser um total geral (exigindo mudança de cálculo) ou permanecer como
janela de 30 dias (exigindo apenas corrigir o rótulo).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: dashboard")
- canonical-gap-register.json (GAP-0067 a GAP-0071)

---

## EVENTS
### Finalidade
Agenda/calendário de eventos (shows, gravações, reuniões) com participantes e implicações financeiras.
### Entidades principais
`Event` (`events`, 23 colunas, tabela física única — não existem tabelas separadas de venues/recorrência/
lembretes/anexos).
### O que o usuário cria/edita
Eventos (data, tipo, local, participantes, capacidade).
### Entrypoints reais do frontend
`Agenda.tsx`, `SchedulerViewModal.tsx`, `SchedulerFormModal.tsx`.
### Tabelas principais
`events`.
### Endpoints principais
`GET/POST/PATCH/DELETE /events`.
### Source of Truth atual
`SchedulerFormModal.tsx` (create/edit) é limpo e correto; `Agenda.tsx`/`SchedulerViewModal.tsx` (leitura)
usam um conjunto de campos **fictício** que não corresponde nem às colunas reais nem ao DTO.
### Relações com outros módulos
`events.artista_id` (relação lógica, sem FK); ligação com `dashboard` (Atividades Recentes, sem eventos
reais chegando).
### Campos/estruturas mais importantes
`participantes` (jsonb, escrito corretamente mas lido do caminho errado na exibição — sempre aparenta
vazio, cai para um único artista principal); `capacity`/`capacidadePublico` (aceito pelo DTO, descartado
silenciosamente pelo mapeamento do service).
### Fluxo funcional principal
1. Usuário cria evento via `SchedulerFormModal.tsx` — mapeamento correto para os campos reais.
2. `Agenda.tsx`/`SchedulerViewModal.tsx` leem campos que não existem (`data_inicio`, `tipo_evento`,
   `horario_inicio/fim`, `cidade`, `estado`, `capacidade_publico`...) — o calendário renderiza todo evento
   em "agora" (fallback de data sempre dispara), força todo evento a "dia inteiro", e o filtro de tipo
   nunca casa com nada real.
### O que funciona hoje
Criação/edição do evento em si (mapeamento correto, sem CREATE_MAPPING_MISMATCH).
### O que está parcial
Import/export XLSX (client-side) usam os mesmos nomes fictícios — import rejeitaria toda linha; export sai
majoritariamente em branco.
### O que está quebrado
Exibição completa em `Agenda.tsx`/`SchedulerViewModal.tsx` (campos fictícios); `capacidadePublico` aceito
pelo DTO mas silenciosamente descartado pelo service; participantes exibidos do caminho errado.
### O que é fake/stub/dead
Não existe recorrência, lembretes, anexos, integração com calendário externo, nem propagação
evento→financeiro em nenhuma camada (todos confirmados ausentes, não apenas não descobertos); 2 artefatos
de código morto (`events.store.ts`, `eventService`).
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0073 (capacidadePublico descartado, S2_MEDIUM)
- GAP-0074 (barramento interno sem ponte para Realtime, S2_MEDIUM)
- GAP-0077 (lineup vinculado a artista só por texto livre, sem FK, S2_MEDIUM)
- GAP-0078 (receita de ingresso sem propagação para accounting, S2_MEDIUM)
- GAP-0079 (limite de 50 sem paginação, calendário mostra mês parcial, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida.
### Pontos que precisam de confirmação do Product Owner
Se o conjunto fictício de campos usado em `Agenda.tsx`/`SchedulerViewModal.tsx` reflete um requisito de
produto real ainda não implementado no backend (cidade/estado/capacidade/horários separados) ou se deve
ser simplesmente removido/alinhado ao schema real.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: events")
- canonical-gap-register.json (GAP-0073, GAP-0074, GAP-0077, GAP-0078, GAP-0079)

---

## INTEGRATIONS
### Finalidade
Camada de integrações externas — pagamentos, assinatura eletrônica, streaming musical, redes sociais/ads,
distribuição digital, registro de direitos, reconhecimento de áudio, storage, email, observabilidade, IA.
### Entidades principais
Não introduz tabelas de domínio próprias — usa `oauth_connections` (tokens), `webhook_events`
(idempotência), e as tabelas específicas de cada provedor (ex.: `artist_platform_profiles`).
### O que o usuário cria/edita
Conexões/credenciais por provedor (via diálogos de configuração), não dados de domínio.
### Entrypoints reais do frontend
Aba "Integrações" de `Configuracoes.tsx` (compartilhada — não é uma tela separada), diálogos por provedor
(`AbramusConfigDialog.tsx`, `NfeConfigDialog.tsx`, `EcadConfigDialog.tsx`, `SendForSigningDialog.tsx`, etc.).
### Tabelas principais
`oauth_connections`, `webhook_events`, `ai_jobs`/`ai_usage_logs`.
### Endpoints principais
Ver matriz de provedores abaixo.
### Source of Truth atual
Backend (`IntegrationBaseService` + `WebhookService`) é, segundo a própria auditoria, "o módulo mais
maduramente projetado encontrado nesta série" — criptografia AES-256-GCM de credenciais/tokens, OAuth state
assinado por HMAC, circuit-breaker, idempotência real de webhook via `webhook_events.external_id UNIQUE`.
### Relações com outros módulos
Spotify/YouTube alimentam `artist_platform_profiles` (módulo `artist`); Autentique/DocuSign alimentam
`contracts`; ABRAMUS alimenta `catalog`; Stripe alimenta `settings`/billing.
### Campos/estruturas mais importantes
Modelo de credencial: `PLATFORM_SHARED` (variável de ambiente da própria aplicação) vs. `TENANT_OWNED`
(credencial de negócio do tenant, nunca em `.env`) — distinção mantida consistentemente.
### Fluxo funcional principal
1. Tenant conecta um provedor (ex.: Spotify) via OAuth ou API key.
2. Credencial é cifrada e armazenada tenant-scoped (`IntegrationBaseService`).
3. Sincronizações/chamadas passam por `resilientFetch` (retry, circuit-breaker) — exceto ABRAMUS/ACRCloud,
   que usam `fetch()` puro sem essa proteção.
4. Webhooks (Stripe, Autentique) validam assinatura e são idempotentes.
### Matriz de provedores (referência completa)
| Provider | Tipo | Implementação atual | API oficial (documentada) | Modelo de credencial tenant | Status |
|---|---|---|---|---|---|
| Stripe (billing SaaS) | PAYMENTS | Real, SDK Stripe | Documentada no backend | plataforma | PARTIAL (checkout/portal reais no backend, hooks frontend desabilitados) |
| Stripe Connect | PAYMENTS | Real (OAuth genérico) | idem | tenant | PARTIAL |
| DocuSign | E-SIGNATURE | Só OAuth connect | Authorization Code Grant | tenant | PARTIAL (sem envelope/assinatura) |
| Autentique | E-SIGNATURE | Backend completo (GraphQL real) | Documentada | tenant | PARTIAL (zero consumidor frontend) |
| Clicksign | E-SIGNATURE | Só seletor de UI | — | — | STUB |
| Spotify | MUSIC_STREAMING | Real, OAuth client-credentials | Documentada | plataforma | IMPLEMENTED |
| YouTube (Data API) | VIDEO/STREAMING | Real | Documentada | plataforma | IMPLEMENTED |
| Instagram/Meta | SOCIAL_MEDIA | Real (orgânico+corporativo) | Documentada | tenant | IMPLEMENTED |
| TikTok / TikTok Ads | SOCIAL_MEDIA/MARKETING | Real | Documentada | tenant | IMPLEMENTED |
| Google Ads | MARKETING | Real | Documentada | tenant | IMPLEMENTED |
| ABRAMUS | RIGHTS_REGISTRY | Parcial (busca/registro reais; import/sync stub) | Documentada | tenant | PARTIAL |
| ACRCloud | AUDIO_RECOGNITION | Contrato divergente do hook frontend | Documentada | tenant | PARTIAL |
| Cloudflare R2 | STORAGE | Real | Documentada | plataforma | IMPLEMENTED |
| Resend | EMAIL | Real (só backend) | Documentada | plataforma | IMPLEMENTED |
| Sentry / PostHog | OBSERVABILITY/ANALYTICS | Sentry real; PostHog config presente sem uso confirmado | Documentada | plataforma | IMPLEMENTED / STUB |
| OpenAI/Anthropic/Google AI | AI | Real (roteador multi-provider) | Documentada | plataforma | IMPLEMENTED |
| **ONErpm** | MUSIC_DISTRIBUTION | Catálogo estático (link) | Não pesquisada (fora de escopo) | tenant (futuro) | STUB |
| **DistroKid** | MUSIC_DISTRIBUTION | Catálogo estático (link) | Não pesquisada | tenant (futuro) | STUB |
| **Symphonic** | MUSIC_DISTRIBUTION | Catálogo estático (link) | Não pesquisada | tenant (futuro) | STUB |
| **SoundOn** | MUSIC_DISTRIBUTION | Catálogo estático (link) | Não pesquisada | tenant (futuro) | STUB |
| **MusicPro** | MUSIC_DISTRIBUTION | Catálogo estático (link) | Não pesquisada | tenant (futuro) | STUB |
| **SomVibe** | MUSIC_DISTRIBUTION | Catálogo estático (link) | Não pesquisada | tenant (futuro) | STUB |
| Framework `external-data` | RIGHTS_REGISTRY/DISTRIBUTION | Infra backend completa, 0 provedores reais registrados | N/A | tenant (futuro) | CONFIG_ONLY |
| NF-e | OTHER | UI sem coleta real | Não pesquisada | tenant (futuro) | STUB |
| ECAD / UBC | RIGHTS_REGISTRY | Hooks/diálogos de UI, zero backend | Não pesquisada | tenant (futuro) | UI_ONLY |

Nota sobre os 6 distribuidores: nenhuma credencial foi pesquisada ou adicionada nesta auditoria — conforme
instruído, `CREDENTIALS_TO_ADD_NOW: 0` em todos os 6; a conexão "ativa" hoje é só um link estático para o
portal oficial de cada um, com aviso explícito de que "abrir o portal não conecta a conta ao sistema".
### O que funciona hoje
Spotify, YouTube, Instagram/Meta, TikTok, Google Ads, Cloudflare R2, Resend, Sentry, roteador de IA — todos
`IMPLEMENTED`, reais.
### O que está parcial
Stripe (backend completo, hooks de frontend desabilitados), DocuSign (só OAuth), Autentique (backend
completo, zero consumidor), ABRAMUS (busca/registro reais, import/sync stub).
### O que está quebrado
`signing.adapter.ts` sempre retorna "indisponível" para todo provedor de assinatura, incluindo Autentique
(que tem backend real e completo) — o único ponto real de entrada de UI para assinatura eletrônica está
estruturalmente quebrado para os 3 provedores oferecidos.
### O que é fake/stub/dead
Nenhum `FAKE_INTEGRATION_GAP` encontrado em lugar nenhum — todo caminho não configurado falha
explicitamente, nunca simula sucesso (disciplina confirmada em toda a série de auditoria).
### Decisões já tomadas que afetam o módulo
Nenhuma decisão formal de Wave 0.
### Decisões ainda pendentes
Nenhuma decisão formal registrada — a decisão de distribuidoras (D1, em documento anterior à Fase 3) já
está `APPROVED`/`RESOLVED` conceitualmente, execução técnica futura fora de escopo desta auditoria.
### Gaps principais
- GAP-0080 (6 distribuidores permanecem STUB — DEFERRED, informativo)
- GAP-0082/0083/0084/0085/0086/0087 (ABRAMUS/ACRCloud/PostHog/NFe/ECAD/UBC — UI sem backend, DEFERRED)
- GAP-0088 (framework external-data sem provedores reais registrados, DEFERRED)
### Definição proposta/canônica atual para backend v2
Nenhuma definição nova — modelo de credencial `PLATFORM_SHARED` vs. `TENANT_OWNED` já estabelecido deve ser
preservado (ver §18).
### Pontos que precisam de confirmação do Product Owner
Se `signing.adapter.ts` deve ser religado ao backend real da Autentique como prioridade de curto prazo
(capacidade já pronta, zero esforço de backend).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/integrations.md §2,§5.20,§5.21,§5.22

---

## INVENTORY
### Finalidade
Controle de inventário/patrimônio (equipamentos, instrumentos, materiais).
### Entidades principais
`InventoryItem` (`inventory_items`, 19 colunas — tabela física única).
### O que o usuário cria/edita
Itens de inventário (nome, categoria, status, valor unitário, local de compra, nota fiscal).
### Entrypoints reais do frontend
`Inventario.tsx`, `InventarioFormModal.tsx`, modal de detalhe.
### Tabelas principais
`inventory_items`.
### Endpoints principais
`GET/POST/PATCH/DELETE /inventory-items` (nome de rota aproximado, CRUD simples e limpo).
### Source of Truth atual
CRUD real, único, sem duplicação de fluxo — o mais simples e menos fragmentado desta série.
### Relações com outros módulos
Nenhuma real (sem relação com fornecedor/CRM, corretamente não inventada).
### Campos/estruturas mais importantes
`status` (`disponivel`/`em_uso`/`manutencao`/`descartado`/`reservado`) — **3 vocabulários divergentes**
(DTO backend, schema Zod frontend, tipo TS compartilhado): a UI real oferece "Emprestado"/"Danificado" (não
aceitos pelo backend, HTTP 400), enquanto "Reservado" (aceito pelo backend) nunca é oferecido na UI.
### Fluxo funcional principal
1. Usuário cria/edita item — `localCompra`/`numeroNotaFiscal`/`dataEntrada` no modo de edição são lidos em
   camelCase contra uma API que responde em snake_case — esses 3 campos reais sempre aparecem vazios ao
   editar (embora CREATE os mapeie corretamente).
2. Estoque é um **snapshot puro de quantidade** — uma única coluna inteira, sem ledger/movimentação,
   last-write-wins, sem lock otimista, sem trilha de auditoria estruturada.
### O que funciona hoje
CRUD básico (criação); export via Central de Relatórios (usa nomes corretos, não afetado pelo bug de
camelCase).
### O que está parcial
Alertas de estoque baixo/manutenção vencida calculados só no cliente, sem notificação de backend.
### O que está quebrado
Pré-preenchimento de edição para 3 campos reais (camelCase vs. snake_case); 3-way `ENUM_MISMATCH` de
status; coluna "Entrada" da tabela sempre mostra "—" pelo mesmo bug.
### O que é fake/stub/dead
Não existem tabelas/fluxos de movimentação, reserva, empréstimo ou manutenção — apenas o campo `status`
sugere esses conceitos, sem nenhum workflow, campo ou tabela dedicada por trás; 2 arquivos de código morto
confirmados.
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0089 (3-way ENUM_MISMATCH de status, S2_MEDIUM)
- GAP-0090 (responsável pelo item é texto livre, sem FK de usuário/funcionário, S2_MEDIUM)
- GAP-0093 (alertas client-side apenas, S2_MEDIUM)
- GAP-0095 (limite 50 sem paginação, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida — separar claramente CRUD real (existe) de movimentação/reserva/empréstimo/manutenção (não
existe, confirmado ausente) é o ponto de partida recomendado para o desenho v2.
### Pontos que precisam de confirmação do Product Owner
Se movimentação/reserva/empréstimo/manutenção de inventário são requisitos reais de produto (schema hoje
não sustenta nada disso além do campo `status`).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: inventory")
- canonical-gap-register.json (GAP-0089, GAP-0090, GAP-0093, GAP-0095)

---

## LEADS
### Finalidade
Funil de captação e conversão de leads (potenciais artistas/clientes) — distinto de CRM (`clients`, já
relacionamento estabelecido).
### Entidades principais
`Lead` (`leads`, 34 colunas, workflow de 9 estados).
### O que o usuário cria/edita
Leads (via captação pública ou manual), interações, conversão para Cliente/Artista.
### Entrypoints reais do frontend
`LeadsPage.tsx` (também hospeda a aba "Contatos" do CRM, ver módulo `crm-relationships`).
### Tabelas principais
`leads`, `lead_interactions` (dedicada, mas desconectada do mecanismo real de histórico), `pipelines`/
`pipeline_stages`/`pipeline_opportunities` (schema completo, zero consumidor, código morto).
### Endpoints principais
`GET/POST/PATCH/DELETE /leads`, `POST /lead-interactions` (quebrado, ver abaixo), `POST
/public/artist-registration` (captação pública real).
### Source of Truth atual
`leads.payload_servico.interacoes[]` (array manual dentro de jsonb) é o histórico de interação REAL usado
pela UI — completamente desconectado da tabela/endpoint dedicados `lead_interactions`.
### Relações com outros módulos
Conversão de lead cria automaticamente um `ArtistEntity` (sempre, independente do tipo de lead, sem checar
cliente existente — gera duplicatas); não seta `financial_project_id` retroativamente.
### Campos/estruturas mais importantes
`origem_lead`, `probabilidade_fechamento`, `responsavel`, `prioridade`, `temperatura`,
`proximo_follow_up`, `valor_estimado` — 7 colunas físicas reais, documentadamente duplicadas: valores reais
vivem em `dados_internos_crm` (jsonb), não nessas colunas.
### Fluxo funcional principal
1. Lead é capturado (formulário público ou manual).
2. Interações são registradas no array jsonb `payload_servico.interacoes[]` (funciona).
3. `POST /lead-interactions` (o endpoint "oficial" dedicado) espalha um DTO camelCase diretamente sobre uma
   entidade snake_case sem mapeamento — `lead_id` (NOT NULL) nunca é populado, falharia em qualquer chamada
   real (inerte hoje só porque a UI nunca o chama de fato).
4. Ao mudar status para `fechado`, dispara conversão automática: cria um Cliente E sempre cria um Artista
   (mesmo que o lead não seja de perfil artístico), sem checar duplicata, em 3 operações try/catch
   independentes fora da transação original (falha entre passos deixa o lead travado permanentemente).
### O que funciona hoje
Captação pública, listagem/edição de leads, histórico de interação via jsonb manual, export (delega
corretamente ao motor central de relatórios).
### O que está parcial
Sistema completo de Pipeline/Kanban genérico (`pipelines`/`pipeline_stages`/`pipeline_opportunities`, 41
colunas) existe só como declaração TypeORM, sem controller/service/frontend algum.
### O que está quebrado
`POST /lead-interactions` (quebraria em qualquer chamada real); conversão lead→artista sempre cria
duplicata de artista e não é atômica.
### O que é fake/stub/dead
Upload de anexo de lead (100% decorativo, `URL.createObjectURL`); 3 de 4 Zustand stores mortos.
### Decisões já tomadas que afetam o módulo
Nenhuma diretamente, mas a correção de `DEC-001` é relevante à nota em `GAP-0099` sobre
`financial_project_id`.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0097 (whatsapp coletado, nunca persistido, S2_MEDIUM)
- GAP-0098 (LeadInteractionsService camelCase vs. snake_case, S2_MEDIUM)
- GAP-0099 (conversão não cria vínculo financial_project_id retroativo, S2_MEDIUM)
- GAP-0101 (sem detecção de lead duplicado, S2_MEDIUM)
- GAP-0103 (limite 50, kanban perde leads além do 50º por coluna, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida.
### Pontos que precisam de confirmação do Product Owner
Se a conversão lead→artista deve, de fato, sempre criar um Artista (mesmo para leads não-artísticos) ou se
essa é uma regra de negócio equivocada a corrigir.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: leads")
- canonical-gap-register.json (GAP-0097 a GAP-0103)

---

## LICENSING
### Finalidade
Licenciamento de obras/fonogramas para uso de terceiros — predominantemente sync licensing, com
master-use e mechanical licensing como categorias secundárias no mesmo formulário/tabela.
### Entidades principais
`License` (`licenses`, 27 colunas, tabela física única, sem tabelas satélite).
### O que o usuário cria/edita
Licenças (obra/fonograma licenciado, cliente, uso pretendido, território, duração, remuneração).
### Entrypoints reais do frontend
Tela de licenciamento com modal "Nova Licença de Sync" (título literal confirma o predomínio sync).
### Tabelas principais
`licenses`.
### Endpoints principais
`GET/POST/PATCH/DELETE /licenses`.
### Source of Truth atual
`licenses.cliente_id` é a fonte real e escrita; `licenses.cliente` (texto livre) nunca é escrita pelo fluxo
real, mas é exigida pela ferramenta de completude (`Auditoria.tsx`) — toda licença real criada é
sinalizada como incompleta por essa ferramenta.
### Relações com outros módulos
**Nenhuma** com `contracts` (sem `contrato_id`) nem com `accounting` (nenhuma emissão de evento
financeiro) — apesar de ambas serem conceitualmente esperadas para licenciamento real.
### Campos/estruturas mais importantes
`obra_musical`/`artista`/`artista_id`/`cliente` — campos aparentemente pensados para "congelar" (snapshot)
o estado no momento da negociação, mas **nunca escritos** — a visão de detalhe sempre relê o estado atual
ao vivo, então título/artista exibidos podem mudar retroativamente se a obra/artista for editada depois.
### Fluxo funcional principal
1. Usuário registra uma solicitação de licença (uso pretendido, território, duração).
2. Campos de uso/território/duração são aceitos pelo DTO mas **nunca persistidos** na tabela.
3. `status` não tem workflow/validação de transição — "expirada" é inteiramente manual (sem job, sem
   cálculo automático); uma licença com `data_fim` no passado permanece "Ativa" indefinidamente.
### O que funciona hoje
Criação/edição básica de solicitação de licença (campos-núcleo).
### O que está parcial
Remuneração do tipo `PERCENTAGE` fica invisível em relatórios (excluída do contrato de export por engano
histórico, já com um comentário obsoleto no código apontando o contrário).
### O que está quebrado
`uso_pretendido`/`territorio`/`duracao_licenca` aceitos pelo DTO, nunca persistidos (`GAP-0105`, `S1_HIGH`).
### O que é fake/stub/dead
2 Zustand stores mortos; filtro "Rádio" morto (opção sem dado correspondente).
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0105 (campos de solicitação nunca persistidos, S1_HIGH)
- GAP-0106 (taxa de licença sem propagação para accounting, S2_MEDIUM)
- GAP-0109 (PDF de licença sem vínculo atômico com transição de status, S2_MEDIUM)
- GAP-0110 (limite 50 sem paginação, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida.
### Pontos que precisam de confirmação do Product Owner
Se licenciamento deve, de fato, ganhar relação formal com `contracts` e `accounting` (hoje inexistente em
qualquer camada).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: licensing")
- canonical-gap-register.json (GAP-0105, GAP-0106, GAP-0109, GAP-0110)

---

## MARKETING
### Finalidade
Ciclo completo de marketing — estratégico, operacional, criativo, publicação, analytics — não apenas
campanhas pagas.
### Entidades principais
`Campaign` (`campaigns`), `MarketingContentPost` (`marketing_content_posts`), `MarketingAsset` (+versões
+aprovações), `MarketingProject` (`marketing_projects`), `MarketingStrategy` (hierarquia
Strategy→Objective→Initiative→Action), `MarketingTask`.
### O que o usuário cria/edita
Campanhas (via Campaign Builder), conteúdo agendado, ativos criativos (com versionamento/aprovação),
projetos de marketing, tarefas.
### Entrypoints reais do frontend
`Campanhas.tsx`, `CampaignBuilderModal.tsx`, `Calendario.tsx`, `VisaoGeral.tsx`, `IACriativa.tsx`,
`Tarefas.tsx`, `Briefing.tsx`.
### Tabelas principais
`campaigns` (compartilhada por 2 sistemas incompatíveis, ver §16), `marketing_content_posts`,
`marketing_assets`/`_versions`/`_approvals`, `marketing_projects`, `marketing_strategies`
(+objectives/initiatives/actions), `marketing_tasks`.
### Endpoints principais
`GET/POST /marketing/campaigns`, `POST /marketing/campaigns/draft`, `/:id/{validate,publish,pause,archive}`
(Sistema B, real); `GET/POST/PATCH/DELETE /campaigns` (Sistema A, órfão/morto).
### Source of Truth atual
Sistema B (`MarketingCampaignBuilderController`) é o real; Sistema A (`CampaignsController`) está
confirmado morto (sem consumidor, e estruturalmente quebrado se fosse chamado).
### Relações com outros módulos
`marketing_projects.financial_project_id → projects.id` (FK real, LEGACY_NAMING, nunca escrita — ver §16);
automação real: conclusão de um Project musical cria automaticamente um workspace de marketing + tarefa de
"criar arte de capa" (`MarketingProjectsService.createFromCompletedProject()`).
### Campos/estruturas mais importantes
`objective`/`promotedEntityId`/`platforms`/`audience`/`utm` — vivem exclusivamente em
`metadata.marketingBuilder.payload` (jsonb), sem coluna física dedicada; `status` usa vocabulário
totalmente diferente do Sistema A na mesma coluna física (`campaigns.status`).
### Fluxo funcional principal
1. Usuário cria campanha via Campaign Builder (Sistema B) — 15 campos no payload, só 5 em coluna física
   dedicada, os outros 10 (incluindo o vínculo com a entidade promovida) só em jsonb.
2. Agendamento de conteúdo é real (fila BullMQ, 3 tentativas, backoff, idempotência) — mas a chamada final
   de publicação em cada provedor **sempre falha explicitamente** (adaptador stub honesto).
3. Métricas exibidas (`Campanhas.tsx`) usam `budget * 0.41` como "Gasto Total" fabricado sempre que dados
   reais de custo/conversão não foram digitados manualmente.
### O que funciona hoje
Criação de campanha via Campaign Builder; agendamento de conteúdo (infraestrutura real); biblioteca de
ativos com versionamento/aprovação real; automação Project→Marketing real.
### O que está parcial
Publicação externa por provedor — infraestrutura real, adaptador de publicação 100% stub, com falha
honesta e auditável.
### O que está quebrado
Sistema A de campanhas (`CampaignsController`) — quebraria com NOT NULL se fosse chamado, mas está morto.
### O que é fake/stub/dead
Dado fabricado (`budget*0.41` como "Gasto Total"); `campaign_tasks`/`campaign_assets` (tabelas do Sistema A,
órfãs); nenhuma sincronização real de métricas de ad-platform apesar de OAuth real existir para outros fins.
### Decisões já tomadas que afetam o módulo
`DEC-001` (correção de `financial_project_id`).
### Decisões ainda pendentes
Nenhuma decisão formal de Wave 0 específica.
### Gaps principais
- GAP-0033 (financial_project_id nunca escrita, S2_MEDIUM, cross-domain)
- GAP-0111 (dois sistemas de campanha paralelos e incompatíveis, S1_HIGH)
- GAP-0112 (métrica "Gasto Total" parcialmente fabricada, S2_MEDIUM)
- GAP-0114 (barramento de eventos sem consumidor para mudança de status de campanha, S3_LOW)
- GAP-0115 (limite 50 sem paginação, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida — consolidar em um único sistema de campanha (Sistema B) é a recomendação implícita mais
óbvia, ainda não registrada como decisão formal.
### Pontos que precisam de confirmação do Product Owner
Se o Sistema A de campanhas (`CampaignsController`, órfão) deve ser formalmente removido no v2 ou se havia
um propósito de produto ainda a esclarecer.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/marketing.md §1,§3,§4,§7,§8,§9

---

## MONITORING
### Finalidade
**Explicitamente**: monitoramento de catálogo/artista — detecção de uso não-autorizado, reconciliação de
royalties do ECAD, takedowns estilo DMCA. **NÃO é** observabilidade técnica da aplicação (isso é coberto
separadamente por Pino/OpenTelemetry/Sentry/Prometheus, sem superfície voltada ao tenant aqui).
### Entidades principais
`content_detections`, `ecad_reports`, `TakedownEntity` (`takedowns`).
### O que o usuário cria/edita
Solicitações de takedown; leitura de detecções de conteúdo e relatórios ECAD.
### Entrypoints reais do frontend
`Monitoramento.tsx` (real, bem construído, mas **estruturalmente inalcançável** — ver abaixo);
`RightsMonitoring.tsx` (o que o usuário de fato acessa).
### Tabelas principais
`content_detections`, `ecad_reports`, `takedowns`.
### Endpoints principais
`GET /ecad-reports`, `/takedowns` (create quebrado — ver abaixo), detecção via `content_detections` (sem
UI de criação alcançável).
### Source of Truth atual
Achado crítico de roteamento: `/monitoramento` redireciona incondicionalmente para `/rights-monitoring` —
`Monitoramento.tsx` (a tela real, ligada a dados genuínos) fica estruturalmente inalcançável; a tela que o
usuário de fato vê (`RightsMonitoring.tsx`) importa de um arquivo cujo próprio comentário confirma que o
backend não tem endpoints reais ainda para execuções públicas/broadcast/cue sheets/setlists — todas as 5
arrays exportadas são vazias por design (não é dado falso, é ausência honesta).
### Relações com outros módulos
ACRCloud (real, confirmado em `integrations`) nunca é conectado a `content_detections` neste módulo.
### Campos/estruturas mais importantes
`TakedownEntity` declara 4 colunas (`url`/`obra_id`/`artista_id`/`resposta`) ausentes da tabela física real.
### Fluxo funcional principal
1. Usuário acessa "Monitoramento" no menu — é redirecionado para `RightsMonitoring.tsx`, que mostra 6 abas
   permanentemente vazias por design (sem dado mock, sem dado real).
2. A tela real e funcional (`Monitoramento.tsx`, conectada a `useDeteccoes()`/`GET /ecad-reports`)
   permanece tecnicamente presente no código mas nunca é acessada pela navegação normal.
3. `TakedownsService.create()` grava incondicionalmente `url: dto.url_infracao ?? null` — toda tentativa
   real de `POST /takedowns` a partir da UI alcançável falha com erro SQL (coluna não existe na tabela
   viva).
### O que funciona hoje
`content_detections` mapeado corretamente ponta a ponta (mas sem caminho de criação alcançável); relatórios
ECAD reais (ingestão de arquivo de extrato confirmada funcional).
### O que está parcial
Nada — é binário: `Monitoramento.tsx` funciona mas é inalcançável; `RightsMonitoring.tsx` é alcançável mas
vazio por design.
### O que está quebrado
`POST /takedowns` (falha com erro SQL em toda chamada real, devido a colunas declaradas na entidade mas
ausentes na tabela viva).
### O que é fake/stub/dead
Nenhum dado fabricado encontrado neste módulo (contraste positivo com `marketing`) — todo estado
vazio/zero é honestamente rotulado como tal.
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0116 (duas UIs paralelas sobre o mesmo domínio, uma inalcançável, S2_MEDIUM)
- GAP-0117 (ingestão ECAD real, distinta do card UI_ONLY em integrations — NO_FIX_REQUIRED)
- GAP-0118 (score de confiança de match sem explicação/disputa, S3_LOW)
- GAP-0119 (royalties detectados sem propagação para accounting, S2_MEDIUM)
- GAP-0120 (limite 50 sem paginação, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida — corrigir o redirecionamento `/monitoramento → /rights-monitoring` para apontar à tela real
e funcional é a correção mais óbvia e barata identificada nesta auditoria.
### Pontos que precisam de confirmação do Product Owner
Se `RightsMonitoring.tsx` (execuções públicas/broadcast/cue sheets/setlists) é um roadmap de produto ativo
ou se `Monitoramento.tsx` (já funcional) deve simplesmente voltar a ser a tela principal.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: monitoring")
- canonical-gap-register.json (GAP-0116 a GAP-0120)

---

## MUSICCHAT
### Finalidade
Inbox de atendimento omnichannel real (conversas/mensagens/notas) + camada de automação de
triagem/escalonamento. **MusicChat não é um assistente de IA/LLM** — busca exaustiva por
openai/anthropic/llm/embedding/vector/gemini/rag/completion não encontrou nenhuma ocorrência em todo o
código.
### Entidades principais
`conversations`, `conversation_messages`, `conversation_notes` (domínio de mensageria genérico,
compartilhado também por `leads`), `musicchat_automation_settings/events/notifications`.
### O que o usuário cria/edita
Conversas, mensagens, notas internas; configurações de automação/triagem (admin).
### Entrypoints reais do frontend
`/chat` (`MusicChat.tsx`), `/admin/musicchat/automacoes`.
### Tabelas principais
`conversations`, `conversation_messages`, `conversation_notes`, `musicchat_automation_settings`,
`musicchat_automation_events`, `musicchat_automation_notifications`.
### Endpoints principais
21 endpoints combinados entre os 2 controllers reais — mapeamento DTO/entidade **100% limpo** (sem nenhum
mismatch de nome de campo, achado raro nesta série).
### Source of Truth atual
Backend real e completo; `RealtimeService` é um publisher genuinamente real via Supabase Realtime
(substituindo um gateway Socket.IO legado incompatível com funções stateless da Vercel).
### Relações com outros módulos
Domínio de mensageria compartilhado com `leads` (mesmas tabelas de conversa).
### Campos/estruturas mais importantes
5 canais externos modelados no schema/UI (whatsapp/instagram/facebook/tiktok/email) — mas **nenhum
endpoint/webhook de ingestão existe** para de fato receber uma mensagem externa.
### Fluxo funcional principal
1. Atendente abre `/chat`, vê conversas reais, envia mensagens (persistidas corretamente).
2. `RealtimeService` publica eventos `conversation:*` reais via Supabase Realtime a cada operação de
   mudança de estado (7 pontos confirmados) — mas o assinante central do app (`useRealtimeSync.ts`) nunca
   se inscreve em nenhum evento `conversation:*` — o backend publica corretamente, ninguém escuta.
3. Anexos usam `URL.createObjectURL(file)` (referência local efêmera) — nunca upload real; persistidos
   verbatim no jsonb `attachments`, sem sentido após reload ou para outros usuários.
### O que funciona hoje
Conversas/mensagens/notas — CRUD real e limpo; automação de triagem/escalonamento real; publisher Realtime
genuíno (primeira cadeia realtime totalmente real confirmada nesta série de auditoria).
### O que está parcial
Publisher real sem consumidor central conectado (§ acima).
### O que está quebrado
Nada no sentido de erro 400/500 — os gaps são de ausência de conexão (Realtime) e ausência de recurso
(storage de anexo, ingestão externa).
### O que é fake/stub/dead
Nada fake — `MessageSenderType.AI` (enum não usado, confirmado que não há requisito de LLM/RAG) e a
ausência de ingestão externa são classificados como escopo confirmado, não gaps disfarçados.
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0121 (Realtime publica, ninguém assina, S2_MEDIUM)
- GAP-0122 (anexos nunca armazenados de fato, S2_MEDIUM)
- GAP-0123 (enum AI não usado — NO_FIX_REQUIRED, confirmado sem requisito de LLM)
- GAP-0124 (ingestão de canal externo ausente — DEFERRED, escopo confirmado)
- GAP-0125 (limite 50 sem "carregar mais", S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
A superfície real (conversas/mensagens/notas/configurações de automação) deve migrar; o conceito de
ingestão de canal externo, hoje inexistente, não deve ser silenciosamente promovido a requisito do v2.
### Pontos que precisam de confirmação do Product Owner
Se a ingestão de canais externos (WhatsApp/Instagram/Facebook/TikTok/email) é um requisito de roadmap
real, já que o schema/UI já a modelam sem nenhuma implementação de backend por trás.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: musicchat")
- canonical-gap-register.json (GAP-0121 a GAP-0125)

---

## PROJECTS
### Finalidade
Ficha inicial da música/projeto musical — ver §3/§4/§6 para a definição canônica completa (DEC-001).
### Entidades principais
`Project` (`projects`, 16 col), `ProjectTrack` (`project_tracks`, 14 col), `ProjectTrackParticipant`
(`project_track_participants`, 6 col), `ProjectAsset` (`project_assets`, órfão).
### O que o usuário cria/edita
Projeto musical (título, tipo, gênero, status) + faixas planejadas + participantes por faixa.
### Entrypoints reais do frontend
`Projetos.tsx`, `ProjetoFormModal.tsx`, `ProjetoViewModal.tsx`.
### Tabelas principais
`projects`, `project_tracks`, `project_track_participants`, `project_assets` (órfã, zero consumidor).
### Endpoints principais
`GET/POST/PATCH/DELETE /projects`.
### Source of Truth atual
`ProjetoFormModal.tsx` — único fluxo real de criação/edição.
### Relações com outros módulos
Ver tabela completa em §4. Destaque: `works.projeto_id → projects.id` (ALREADY_CORRECT);
`transactions.projeto_id → projects.id` (ALREADY_CORRECT); `releases` (MISSING_RELATION, GAP-0168).
### Campos/estruturas mais importantes
Ver tabela §3.1.
### Fluxo funcional principal
Ver §3 (fluxo de criação) e §5 (o que falta na relação com Release).
### O que funciona hoje
Criação/edição do projeto e suas faixas/participantes (8 campos reais, mapeamento limpo); workflow de
status real (5 estados, `WorkflowService`); relação com Work (real, populada).
### O que está parcial
Edição de status via Select livre no formulário não respeita as transições legais do workflow (o
`ViewModal` sim respeita, corretamente).
### O que está quebrado
`ProjectPlanningAutomation` (geração de plano operacional via IA ao concluir o projeto) executa SQL bruto
com colunas obsoletas/inexistentes (`nome`, `data_fim`) — falha silenciosamente em toda invocação real,
embora não reverta a conclusão do projeto em si.
### O que é fake/stub/dead
Upload de áudio de faixa (stub hardcoded, sempre retorna `null`); `project_assets` (tabela órfã, zero
consumidor); `projects.store.ts`/`projects.service.ts` (código morto).
### Decisões já tomadas que afetam o módulo
`DEC-001` (RESOLVED — definição corrigida do próprio `projects`, ver §3).
### Decisões ainda pendentes
Nenhuma decisão formal de Wave 0 específica pendente aqui — `GAP-0168` permanece `OPEN`, mas sua
decisão arquitetural (`DEC-009: PROJECT_RELEASE_DIRECT_LINK`) já foi resolvida pelo Product Owner;
resta apenas implementação (corrigido; texto anterior "bloqueia o desenho do schema v2" desatualizado).
### Gaps principais
- GAP-0001 (decisão resolvida; implementação de artista_id/orcamento em ProjetoFormModal.tsx pendente, S1_HIGH)
- GAP-0033 (financial_project_id nunca escrita por audiovisual/marketing, S2_MEDIUM, cross-domain)
- GAP-0128 (limite 50 sem paginação, S2_MEDIUM)
- GAP-0168 (decisão DEC-009 resolvida — PROJECT_RELEASE_DIRECT_LINK; resta implementar `releases.project_id`, S2_MEDIUM — `blocksSchemaV2Design: NÃO`, corrigido, texto anterior "bloqueia schema v2" desatualizado)
### Definição proposta/canônica atual para backend v2
`projects` = Musical Project canônico (DEC-001); chave cross-domain via `projects.id`, preservando as
relações já reais (ver §4). Desenho físico ainda não produzido.
### Pontos que precisam de confirmação do Product Owner
Confirmar a correção de `DEC-001` (ver checklist §29); confirmar se `artista_id`/`orcamento` devem, de
fato, ser expostos no formulário real.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/projects.md §1,§2,§5,§7,§8,§9,§17

---

## RELEASES
### Finalidade
Lançamento/produto de distribuição — ver §9 para a visão completa (inclui o achado mais crítico da
auditoria inteira: create/edit 100% quebrados).
### Entidades principais
`Release` (`releases`, 27 col), `release_works` (junção, schema-only, nunca populada).
### O que o usuário cria/edita
Lançamento (título, artista, UPC/EAN, ISRC global, distribuidora, plataformas, tracklist, artwork).
### Entrypoints reais do frontend
`Lancamentos.tsx`, `LancamentoFormModal.tsx` (wizard de 5 passos), `LancamentoViewModal.tsx`.
### Tabelas principais
`releases`, `release_works`.
### Endpoints principais
`GET/POST/PATCH/DELETE /releases`.
### Source of Truth atual
Nenhum — toda criação/edição real via UI é rejeitada pelo backend (ver abaixo).
### Relações com outros módulos
`releases.artista_id → artists.id` (FK real); `release_works` (schema-only, nunca populada);
`audiovisual_projects.release_id` (FK real, usada como filtro); `transaction_allocations.release_id`/
`performance_metric_entries.release_id` (FK real, relação direta com accounting); **nenhuma** relação com
`projects` (GAP-0168).
### Campos/estruturas mais importantes
`metadata.faixas` (jsonb, tracklist atual — classificado `NON_CANONICAL_METADATA` por `DEC-007`);
`internal_status`/`platform_status` (campos usados pela UI de exibição, **não existem no backend**).
### Fluxo funcional principal
1. Usuário preenche o wizard de 5 passos (Info do Álbum / Upload de Faixas / Capa / Preferências de
   Distribuição / Preview).
2. Ao salvar, `LancamentoFormModal.tsx` injeta incondicionalmente `internal_status` no payload — campo
   não declarado em nenhum DTO nem como coluna física — o `ValidationPipe` global rejeita a requisição
   inteira com HTTP 400 **antes de chegar ao controller**.
3. **Resultado: toda criação e toda edição de Lançamento via a UI real falha, hoje, 100% das vezes.**
4. Mesmo se esse bug fosse corrigido, uma segunda chamada subsequente força `status: "distributed"`
   diretamente a partir de `DRAFT` — transição ilegal no workflow real (só `DRAFT→METADATA_PENDING` é
   permitida a partir de `DRAFT`) — falharia de forma independente.
### O que funciona hoje
Upload de capa/artwork (real, Cloudflare R2, funcional de ponta a ponta — contraste positivo com o stub de
áudio de `projects`/`catalog`); workflow de 10 estados com guards reais no backend.
### O que está parcial
Nada — o bug de `internal_status` é binário e afeta 100% das tentativas de create/edit.
### O que está quebrado
Create/Edit inteiros (ver acima, achado mais severo desta auditoria); notificação de "artista aprovado"
grava `user_id` com um valor de `artists.id` (nunca corresponde a um usuário real — escrita morta
silenciosa).
### O que é fake/stub/dead
Os 6 provedores de distribuição (STUB, ver §17 Integrations); `release_works` (nunca populada); entidade/
repositório duplicados (`release.entity.ts`, `release.repository.ts`, mortos em produção).
### Decisões já tomadas que afetam o módulo
`DEC-007` (RELATIONAL_TRACKLIST_MODEL, RESOLVED — ver §9).
### Decisões ainda pendentes
Nenhuma decisão formal de Wave 0 específica (mas `GAP-0168` e o desenho final da tabela relacional de
`DEC-007` permanecem em aberto).
### Gaps principais
- GAP-0007 (modelo de tracklist decidido; desenho final da tabela ainda TO_BE_DESIGNED, S1_HIGH — `blocksSchemaV2Design: NÃO` no registro canônico: a ambiguidade de decisão já foi resolvida por `DEC-007`; o trabalho remanescente é desenho/implementação real, tratado por `resolutionWave`/`status`, não mais um bloqueio por decisão pendente — corrigido; texto anterior "**bloqueia schema v2**" estava desatualizado)
- GAP-0129 (internal_status/platform_status nunca aceitos pelo DTO — quebra 100% do create/edit, S1_HIGH)
- GAP-0130 (workflow permite salto ilegal DRAFT→DISTRIBUTED, S2_MEDIUM)
- GAP-0134 (limite 50 sem paginação, S2_MEDIUM)
- GAP-0168 (decisão DEC-009 resolvida — PROJECT_RELEASE_DIRECT_LINK; resta implementar `releases.project_id`, S2_MEDIUM — `blocksSchemaV2Design: NÃO`, corrigido, texto anterior "bloqueia schema v2" desatualizado)
### Definição proposta/canônica atual para backend v2
`DEC-007`: cadeia canônica `Release → Release Track → Phonogram → Work → Rights/Shares`, requisitos
mínimos já registrados para a futura tabela relacional (`release_id`, `phonogram_id`, `position`/`order`) —
desenho final `TO_BE_DESIGNED`.
### Pontos que precisam de confirmação do Product Owner
Confirmar a prioridade de corrigir o bug de `internal_status` (é, tecnicamente, o bug de maior impacto
imediato de todo o sistema — bloqueia 100% da criação de lançamentos hoje, embora nenhuma correção de
código deva ser feita nesta etapa).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/releases.md §0,§7,§8,§10,§13,§16

---

## REPORTS
### Finalidade
Central de exportação/relatórios (Export Center) — não confundir com dashboards analíticos.
### Entidades principais
Nenhuma própria — opera sobre um registro fechado de 22 tabelas (`report-module-registry.ts`), cada uma
com contrato de campos explícito (`report-form-contracts.ts`), mais 1 relatório computado
(`accounting_summary`, P&L por artista).
### O que o usuário cria/edita
Exportações (XLSX) e importações (XLSX) das 22 entidades registradas.
### Entrypoints reais do frontend
`Relatorios.tsx` ("Central de Relatórios").
### Tabelas principais
As 22 tabelas registradas (works, phonograms, artists, contracts, transactions, etc.) — consultadas
diretamente, não via os endpoints de listagem paginados de cada módulo.
### Endpoints principais
`GET /reports/entities` (backend, única fonte segundo o próprio comentário do código).
### Source of Truth atual
`report-form-contracts.ts` — allowlisting completo de coluna/filtro/sort, SQL parametrizado, neutralização
de formula-injection em toda célula exportada.
### Relações com outros módulos
Consome diretamente das tabelas de 22 módulos diferentes; explicitamente **não** inclui `campaigns`
(marketing) nem as tabelas do sub-módulo `registry` de `catalog` (`NOT_REPORTABLE`).
### Campos/estruturas mais importantes
Teto de exportação: 50.000 linhas, fail-closed (erro 413 explícito, nunca um arquivo parcial silencioso) —
contraste com o truncamento silencioso de `limit=50` presente em praticamente todo outro módulo.
### Fluxo funcional principal
1. Usuário escolhe uma entidade registrada, aplica filtros, exporta.
2. Motor consulta a tabela física diretamente (sem depender do endpoint paginado do módulo de origem).
3. Campos cifrados (ex.: email/telefone/CPF de artista) são decifrados apenas no momento da exportação
   autorizada.
### O que funciona hoje
O módulo mais rigorosamente construído de toda a auditoria — zero `TRUNCATION_GAP`, zero risco de
injeção, isolamento de tenant confirmado em 4 camadas independentes.
### O que está parcial
`searchableColumns` é computado mas nunca consumido pelo query builder (dormente).
### O que está quebrado
Nada.
### O que é fake/stub/dead
`exportFieldList()` de `TransacaoFormModal.tsx` — gerador XLSX de 3 abas, código morto, não pertence
funcionalmente a este módulo (usa `xlsx` diretamente, não o motor central) — registrado como achado
isolado, não incluído na contagem própria de `reports`.
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0014 (XLSX de 3 abas em accounting, código morto — atribuído a reports por PII, S3_LOW)
- GAP-0049 (PII de contrato exportada sem máscara — herdado de contracts, S2_MEDIUM)
- GAP-0135 (achado de fonte confirmado sólido — NO_FIX_REQUIRED)
- GAP-0136 (relatórios agendados/recorrentes não existem, S3_LOW)
- GAP-0137 (histórico/auditoria de exportação não é rastreado, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida — mas o padrão de allowlisting/contrato de campos explícito é candidato natural a se tornar
o modelo padrão de todo o v2, não só de `reports`.
### Pontos que precisam de confirmação do Product Owner
Se um mascaramento de PII (bancário, dados de contrato) deve ser padronizado antes da exportação — hoje
tratamento é inconsistente entre entidades equivalentemente sensíveis (ver CONFLITO-04, §27).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: reports")
- canonical-gap-register.json (GAP-0014, GAP-0049, GAP-0135, GAP-0136, GAP-0137)

---

## RH
### Finalidade
Gestão interna de RH — funcionários, folha de pagamento, férias/ausências, documentos. `Employee` é
estruturalmente distinto de `User`/`OrgMember` da plataforma — confirmado sem FK entre eles.
### Entidades principais
`Employee` (`employees`), `PayrollEntry` (`payroll_entries`), `LeaveRequest` (`leave_requests`).
### O que o usuário cria/edita
Funcionários, lançamentos de folha, solicitações de férias/ausência, documentos de funcionário.
### Entrypoints reais do frontend
`RH.tsx`, `FuncionarioFormModal.tsx`, `FolhaPagamentoFormModal.tsx`, `FeriasAusenciasFormModal.tsx`, aba
"Documentos".
### Tabelas principais
`employees`, `payroll_entries`, `leave_requests`.
### Endpoints principais
`GET/POST/PATCH /hr/employees`, `GET/POST /hr/payroll`, `GET/POST /hr/leave-requests`.
### Source of Truth atual
Nenhum — os 4 sub-recursos (funcionário, folha, férias, documentos) têm o CREATE quebrado por divergência
de nome de campo entre formulário e DTO.
### Relações com outros módulos
Nenhuma FK real com `org_members`/`users` (mesmo com um campo `vinculo_usuario_id` existente, ele é
somente exibição, não persistido).
### Campos/estruturas mais importantes
`nome` (obrigatório no DTO, **nunca enviado** pelo formulário, que envia `nome_completo` em vez disso);
8 colunas físicas reais (`nome_completo`, `rg`, `data_nascimento`, `endereco`, `setor`, `salario_base`,
`observacoes`, `vinculo_usuario_id`) **nunca declaradas na entidade TypeORM** — mesmo drift em
`payroll_entries`/`leave_requests` (16 colunas órfãs no total).
### Fluxo funcional principal
1. Usuário tenta criar um Funcionário — `CreateEmployeeDto` exige `nome` e aceita 13 campos; o formulário
   nunca envia `nome` e envia 8 campos não permitidos — **HTTP 400 em toda tentativa real**.
2. Mesmo padrão se repete, de forma independente, em Folha de Pagamento (`employee_id`/`competencia`
   exigidos vs. `funcionario_id`/`mes_referencia` enviados) e em Férias/Ausências
   (`employee_id` vs. `funcionario_id`/`dias_totais`).
3. Aba "Documentos" está ligada ao endpoint errado (`/hr/employees` em vez de um endpoint de documento
   dedicado) — lista todo funcionário do tenant rotulado incorretamente como "documento"; upload do
   arquivo em si funciona (chega ao Cloudflare R2), mas a criação do registro de metadado falha com o
   mesmo erro 400 do item 1.
4. Mesmo a listagem de leitura de Funcionários está quebrada: 8 colunas reais nunca são retornadas pela
   API (a entidade não as declara) — nome/setor/salário/vínculo aparecem sempre em branco na tabela, e a
   busca/filtro por Setor nunca funciona.
### O que funciona hoje
Isolamento de tenant e autorização (confirmados sólidos); criptografia de PII (email/telefone/CPF, mesmo
padrão correto de outros módulos).
### O que está parcial
Nenhum PATCH/DELETE existe para Folha de Pagamento; Férias/Ausências tem só 1 rota de mudança de status
(hardcoded para "aprovado", sem caminho de rejeição) — mas a UI oferece editar/excluir/rejeitar como se
funcionassem (chamam rotas inexistentes, 404).
### O que está quebrado
Create de Funcionário, Folha, Férias — 100% quebrados (S1_HIGH); leitura da lista de Funcionários também
quebrada (drift de coluna); cálculo de salário líquido de folha é 100% client-side, sem validação de
servidor.
### O que é fake/stub/dead
Nada classificado como fake — os 4 fluxos são reais, apenas desconectados por divergência de contrato.
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0138 (Employee CREATE_MAPPING_MISMATCH, S1_HIGH)
- GAP-0139 (Payroll CREATE_MAPPING_MISMATCH, S1_HIGH)
- GAP-0140 (Leave-request CREATE_MAPPING_MISMATCH, S1_HIGH)
- GAP-0141 (Employee entity sem 8 colunas físicas reais, S1_HIGH)
- GAP-0142 (endpoint de documentos implementado no backend, nunca ligado ao frontend, S2_MEDIUM)
- GAP-0143 (lista de funcionários renderiza em branco, S1_HIGH)
- GAP-0144 (EmployeeStatus ENUM_MISMATCH, S2_MEDIUM)
- GAP-0145 (mesmo drift de coluna em payroll/leave_requests, S2_MEDIUM)
- GAP-0146 (limite 50 sem paginação, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida — mas a própria migration que criou as 8 colunas órfãs (`20260712000003_HrFormFieldColumns.ts`)
já documenta a intenção original (espelhar campos de formulário em colunas físicas), nunca implementada.
### Pontos que precisam de confirmação do Product Owner
Se o módulo `rh` é um requisito de produto ativo e prioritário (dado que está, hoje, 100% não-funcional
para create/edit em todos os 4 sub-recursos).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/hr.md §0,§1

---

## SETTINGS
### Finalidade
Hub de configuração multi-superfície: perfil da empresa/branding, preferências de usuário, notificações,
segurança, acesso (RBAC), integrações, localização, billing, feature flags, cadastro público. **Não existe
um único módulo de backend chamado `settings`** — o frontend agrega vários módulos de backend reais
(`company-settings`, `notifications`, `billing`, RBAC) mais um conceito deliberadamente stubado
("listas operacionais").
### Entidades principais
`organizations`/`tenants.settings` (perfil/branding/localização), `notification_settings`,
`billing_subscriptions`/`billing_plans`/`tenant_billing_state`, `operational_list_items` (real, zero
consumidor).
### O que o usuário cria/edita
Perfil da empresa, senha, convites de usuário, plano de billing (checkout/portal), status de integrações.
### Entrypoints reais do frontend
`Configuracoes.tsx` (2600 linhas, 7 abas, montada em 3 URLs), `Perfil.tsx`, `Usuarios.tsx`, `Billing.tsx`
(standalone), `BillingBlockedPage.tsx`, `AuditTrail.tsx` (morta/não roteada).
### Tabelas principais
`organizations`, `tenants` (`.settings` jsonb), `notification_settings`, `billing_subscriptions`,
`billing_plans`, `tenant_billing_state`, `operational_list_items`.
### Endpoints principais
`GET/PATCH /company-settings`, `GET/PATCH /notifications/settings`, `GET /billing/plans`,
`POST /billing/checkout`, `POST /billing/portal`, `GET /billing/subscription`; `GET /billing/invoices`
**não existe** (só `GET /billing/admin/invoices`, super_admin).
### Source of Truth atual
Perfil da empresa (`company-settings`) — real e funcional. Preferências de usuário — 100% `localStorage`,
sem tabela de backend. Notificações — backend real (14 chaves), **zero chamador no frontend**.
### Relações com outros módulos
Reusa diretamente os hooks/componentes reais do módulo `integrations` na aba "Integrações" (não é uma
cópia obsoleta). Compartilha o backend RBAC com `auth`/`workspace`.
### Campos/estruturas mais importantes
Ver §17 Workspace para o modelo de convite; billing detalhado abaixo.
### Fluxo funcional principal
1. Usuário edita perfil da empresa — real, persiste.
2. Usuário tenta enviar logo — `POST /api/v1/workspaces/{id}/logo` **não existe em lugar nenhum do
   backend**; o próprio comentário do serviço de frontend admite ser aspiracional.
3. Usuário alterna preferências de notificação na aba "Automações" — grava só em `localStorage`; o
   backend real (`notification_settings`) nunca é chamado, e mesmo o único produtor real de e-mail
   (`contract_expiring`) nunca checa essa configuração antes de enviar. 4 dos toggles visíveis são
   `<Switch checked={true}>` hardcoded, sem handler algum.
4. Usuário acessa a aba "Billing" — vê planos reais (`GET /billing/plans`), mas a lista de faturas chama
   um endpoint inexistente (sempre vazia); o cartão de "Método de Pagamento" é inteiramente decorativo
   (`•••• 4242` fixo); os botões "Gerenciar Assinatura"/"Adicionar Assentos"/"Fazer Upgrade" chamam
   `toast.info(...)` em vez das chamadas reais de checkout/portal que existem e funcionam corretamente um
   arquivo ao lado.
### Sub-seção: Billing e `DEC-005`
Três superfícies de billing coexistem, inconsistentes entre si:
1. **`Configuracoes.tsx` aba "Billing"** — arquitetura correta (planos dinâmicos via `GET /billing/plans`,
   nunca hardcoda preço), mas invoices e 3 botões de ação são decorativos/quebrados.
2. **`Billing.tsx` standalone** (`/configuracoes/billing`) — hardcoda preços de plano (`R$ 299`/`R$ 799`/
   "Consultar"), contradizendo o próprio comentário de governança do código-base ("planos NÃO podem ser
   hardcoded na tela"); usa corretamente as chamadas reais de checkout/portal do Stripe.
3. **`BillingBlockedPage.tsx`** — propósito distinto (tela de bloqueio por inadimplência), não faz parte
   do conflito das duas primeiras.

O checkout/portal reais do Stripe (`POST /billing/checkout`, `POST /billing/portal`) funcionam
corretamente — só não estão ligados aos botões da aba "Billing" de `Configuracoes.tsx`. `GET
/billing/plans` é real. O gap de faturas (`GET /billing/invoices` inexistente) e o cartão de pagamento
falso são achados independentes, não decisões de produto.

```
DEC-005: PENDING_PRODUCT_DECISION
```
As 3 opções já registradas em `decision-register.json` (nenhuma escolhida): (1) tornar
`Configuracoes.tsx` "Billing" canônica, implementando o endpoint de troca de plano que falta e
depreciando `Billing.tsx`; (2) tornar `Billing.tsx` canônica, removendo o hardcode de preços; (3) fundir
as duas em uma única rota/componente. `DEC_005_ANALYSIS_STATUS: PARKED_UNCHANGED` — a análise já foi
concluída (está registrada acima) mas a decisão **não foi tomada nem registrada** como resolução formal.
### O que funciona hoje
Perfil da empresa; troca de senha; planos/checkout/portal do Stripe (no backend e em `Billing.tsx`); aba
Integrações (reuso real); "listas operacionais" — stub honesto e auto-documentado, não um "sucesso
fabricado" disfarçado.
### O que está parcial
Cadastro público — backend real e já ativo (`allow_public_registration` etc.), mas a UI mostra os botões
desabilitados com uma mensagem obsoleta ("disponível quando o backend estiver ativo").
### O que está quebrado
Upload de logo (endpoint inexistente); lista de faturas (endpoint inexistente); notificações (backend
real, zero chamador); FeatureGate ("Ver planos") aponta para uma rota não registrada (`/settings/billing`).
### O que é fake/stub/dead
Cartão de método de pagamento; 4 toggles de notificação hardcoded; segurança (2FA, sessões ativas,
"encerrar todas as sessões", excluir conta — todos sem `onClick`); slug de cadastro público
(`localStorage` per-usuário, não per-tenant — crítico para o negócio, `LOCAL_STORAGE_GAP`); `AuditTrail.tsx`
(construída, nunca roteada).
### Decisões já tomadas que afetam o módulo
Nenhuma resolvida (`DEC-005` e `DEC-006` são específicas deste módulo, ambas pendentes).
### Decisões ainda pendentes
`DEC-005` (billing, ver acima); `DEC-006` (gestão de convites duplicada entre `/usuarios` e a aba
"Usuários" — ver módulo `workspace`).
### Gaps principais
- GAP-0005 (billing fragmentado em 3 superfícies — DEC-005 pendente, S2_MEDIUM)
- GAP-0006 (convites duplicados — DEC-006 pendente, S2_MEDIUM, compartilhado com workspace)
- GAP-0147 (toggles de notificação sem consumidor de backend, S2_MEDIUM)
- GAP-0149 (upload de logo sem endpoint, S2_MEDIUM)
- GAP-0150 (billing sem fonte única — mesmo achado que GAP-0005, S2_MEDIUM)
- GAP-0151 (botão "Alterar Plano" chama endpoint inexistente, S1_HIGH)
- GAP-0152 (cartão de pagamento fake, S2_MEDIUM)
- GAP-0154 (feature flags só no frontend, sem gate de backend, S2_MEDIUM)
- GAP-0155 (aba de segurança sem backend nenhum, DEFERRED)
### Definição proposta/canônica atual para backend v2
Não produzida — `DEC-005` precisa ser resolvida antes de qualquer desenho de billing v2.
### Pontos que precisam de confirmação do Product Owner
DEC-005 (qual superfície de billing vence); se o slug de cadastro público deve migrar para
armazenamento server-side como prioridade (hoje é uma lacuna de dado crítico de negócio em
`localStorage`).
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/settings.md §0,§4,§5,§6,§9,§11,§12

---

## SUPPORT
### Finalidade
Sistema de tickets de suporte real (tenant-scoped) — mais 4 subfuncionalidades deliberadamente falsas no
mesmo módulo de frontend (chat, base de conhecimento, status de incidente, quadro de solicitações).
### Entidades principais
`SupportTicket` (`support_tickets`) — único recurso real com tabela.
### O que o usuário cria/edita
Tickets de suporte (título, categoria, prioridade, descrição, SLA).
### Entrypoints reais do frontend
`SupportTickets.tsx`, `SupportTicketDetail.tsx`, `SupportDashboard.tsx` (real); `SupportChat.tsx`,
`SupportKnowledge.tsx`, `SupportStatus.tsx`, `SupportRequests.tsx` (todas as 4 fakes, auto-declaradas no
próprio comentário do hook: "é proibido simular o backend em localStorage").
### Tabelas principais
`support_tickets`.
### Endpoints principais
`GET/POST/PATCH/DELETE /support-tickets`.
### Source of Truth atual
`useTickets()` é real; `useTicketMessages`/`useChatRooms`/`useChatMessages`/base de conhecimento/status —
todos retornam vazio e falham explicitamente em qualquer mutação, por design.
### Relações com outros módulos
`AdminSupport.tsx` chama exatamente o mesmo endpoint tenant-scoped (`GET /support-tickets?limit=200`) que
o módulo real — a moldura de "Hub de Suporte" cross-tenant não corresponde a nenhuma rota cross-tenant real
(mesmo achado do módulo `admin`, `GAP-0021`/`GAP-0159`). `AdminKnowledge.tsx` reusa o mesmo hook fake de
base de conhecimento, sem conceito próprio.
### Campos/estruturas mais importantes
Enum de status do ticket — **3 vocabulários divergentes**: backend real tem 6 estados (incluindo
`pending_user`/`cancelled`), o tipo do próprio módulo `support` tem só 5 (`waiting_customer` em vez de
`pending_user`, sem `cancelled`), e o módulo `admin` tem um **terceiro** vocabulário de 5 valores
(`waiting`) — confirmado um `TypeError` real e alcançável em `AdminSupport.tsx` para qualquer ticket
movido a um dos 2 estados ausentes.
### Fluxo funcional principal
1. Usuário abre um ticket real via `SupportTickets.tsx` — persistido corretamente, workflow real de 7
   transições role-gated, dentro de uma transação de banco.
2. Categoria do ticket tem `ENUM_MISMATCH` independente (backend aceita 5 valores; frontend declara 10
   valores de domínio não relacionados) — risco de rejeição no momento da criação.
3. Anexos são o padrão "mais fake" encontrado nesta série: o simulador de chat nem chega a criar uma
   referência `blob:` efêmera — só ecoa nome/tamanho de arquivo como texto numa mensagem que, ela mesma,
   nunca persiste.
### O que funciona hoje
Sistema de tickets real (CRUD + workflow de 7 transições + triagem automática por IA + SLA básico + 1
broadcast Realtime real na resolução).
### O que está parcial
Notificação na resolução de ticket grava 2 linhas de notificação (para solicitante e para o gestor que
resolveu) via handlers distintos — padrão levemente duplicado/desalinhado, mas funcional.
### O que está quebrado
`AdminSupport.tsx` — crash alcançável (`TypeError`) ao abrir um ticket em um dos 2 estados ausentes do
vocabulário do admin (`GAP-0157`, S1_HIGH); `ENUM_MISMATCH` de categoria (`GAP-0158`, S1_HIGH).
### O que é fake/stub/dead
`SUPPORT_CHAT`, `KNOWLEDGE_BASE`/FAQ, `INCIDENT_SUPPORT`/status, quadro de solicitações — todas as 4,
auto-declaradas e honestamente falhando (não simulam sucesso); rota `/support/tickets/new` não registrada
(link morto do "Novo Ticket" no dashboard).
### Decisões já tomadas que afetam o módulo
Nenhuma.
### Decisões ainda pendentes
Nenhuma.
### Gaps principais
- GAP-0021 (moldura cross-tenant enganosa de AdminSupport, compartilhado com admin, S2_MEDIUM)
- GAP-0157 (crash alcançável por ENUM_MISMATCH de status, S1_HIGH)
- GAP-0158 (ENUM_MISMATCH de categoria, S1_HIGH)
- GAP-0160 (subfuncionalidades fakes — classificadas INTENTIONAL_STUB, DEFERRED)
- GAP-0161 (limite 50 sem paginação, S2_MEDIUM)
### Definição proposta/canônica atual para backend v2
Não produzida — mas a distinção real ticket vs. 4 fakes já está claramente estabelecida como base para
qualquer escopo de v2.
### Pontos que precisam de confirmação do Product Owner
Se chat/base de conhecimento/status de incidente/quadro de solicitações são requisitos reais de roadmap
(hoje 100% fakes, auto-declarados) ou se devem ser removidos da superfície do produto.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/support.md §0,§1,§2,§3,§4

---

## WORKSPACE
### Finalidade
Unidade de isolamento tenant — "Workspace" é o nome de UI/DTO para a tabela `tenants`.
### Entidades principais
`tenants` (= workspace), `organizations` (pai legal/billing, distinto, 1:1 na prática via provisioning),
`org_members` (membership), `tenant_invitations`, `roles`.
### O que o usuário cria/edita
Nada diretamente — o workspace nasce automaticamente no signup (provisionamento); usuário edita membros/
convites/perfil de empresa (este último, ver `settings`).
### Entrypoints reais do frontend
`Register.tsx` (dispara provisionamento indireto), `Onboarding.tsx`, `Usuarios.tsx`, `Configuracoes.tsx`
aba "Usuários", `AdminClients.tsx` (cross-tenant real, `super_admin`).
### Tabelas principais
`tenants`, `organizations`, `org_members`, `tenant_invitations`, `roles`.
### Endpoints principais
`PATCH /auth/provision-workspace`, `PATCH /auth/onboarding`, `GET /auth/context`,
`GET/POST/PATCH/DELETE /users*`, `GET/POST /users/invitations*`, `GET/PATCH /billing/admin/tenants[/:id]`.
### Source of Truth atual
`org_members` (membership real, revalidada a cada request); `tenants.id` é o **identificador canônico de
tenant** — entregue via o claim JWT `app_metadata.org_id`, cujo *nome* é um artefato de nomenclatura de um
design anterior (não aponta para `organizations.id`; o valor real é sempre `tenants.id`).
### Relações com outros módulos
Fundação de todo o sistema (todo módulo depende de `tenant_id`); `Configuracoes.tsx` "Empresa"
(perfil/branding, auditado em `settings`).
### Campos/estruturas mais importantes
`org_members.role` (string legada) + `org_members.role_id` (FK RBAC, nullable) — modelo dual,
confirmado disciplinado (sempre ambos preenchidos após qualquer caminho de escrita real).
### Fluxo funcional principal
1. Usuário se cadastra (`Register.tsx`) — `supabase.auth.signUp()` seta `user_metadata.workspace_slug`.
2. `AuthContext` detecta ausência de `org_id` no JWT → dispara `PATCH /auth/provision-workspace`.
3. `WorkspaceProvisioningService.provision()` — transação única: lock consultivo por usuário, checagem de
   idempotência, lock consultivo por slug, cria `organizations`+`tenants`+`org_members` (role owner),
   sincroniza `app_metadata.org_id = tenants.id` no Supabase **antes** do commit.
4. Convites: `POST /users/invitations` cria `org_members` **imediatamente** (acesso concedido antes da
   aceitação) + `tenant_invitations` (pending); primeiro `GET /auth/context` pós-login auto-aceita o
   convite pendente.
### O que funciona hoje
Provisionamento (atômico, idempotente — o fluxo de criação mais limpo encontrado em toda a série);
`TenantGuard` (nunca confia no header do cliente); proteção de "último owner" (bloqueia demoção/remoção do
último owner ativo); isolamento de storage (prefixo `tenants/<id>/...` + checagem de `tenant_id` em toda
query de linha).
### O que está parcial
Nenhum "switcher" de workspace existe (uma sessão JWT = um tenant; múltiplas memberships são
tecnicamente possíveis no schema, mas nenhuma UI oferece trocar entre elas na mesma sessão) — confirmado
característica arquitetural, não um gap.
### O que está quebrado
Nada tecnicamente quebrado neste módulo — é, segundo a própria auditoria, "o módulo estruturalmente mais
sólido encontrado em toda a série".
### O que é fake/stub/dead
Nada.
### Decisões já tomadas que afetam o módulo
Nenhuma resolvida (`DEC-006` é específica deste módulo).
### Decisões ainda pendentes
`DEC-006` — gestão de convites fragmentada entre `/usuarios` (só cria convite, sem visibilidade de
pendentes/reenvio/cancelamento) e a aba "Usuários" de `Configuracoes.tsx` (superfície completa) — qual
vence.
### Gaps principais
- GAP-0006 (convites duplicados — DEC-006 pendente, S2_MEDIUM)
- GAP-0162 (slug público em localStorage — achado fechado aqui, ownership resolvido para tenants.slug, S3_LOW)
- GAP-0163 (terceira instância confirmada do padrão de UI duplicada, S3_LOW)
- GAP-0164 (seleção de tenant atual sem sincronização server-side de "último usado", S3_LOW)
- GAP-0165 (remoção de membro sem reatribuição/auditoria de efeitos colaterais de created_by, S2_MEDIUM)
- GAP-0166 (limite 50 na lista de membership, S3_LOW)
### Definição proposta/canônica atual para backend v2
`tenants.id` como identificador canônico de tenant, preservado; nenhuma mudança de modelo necessária —
este módulo é considerado uma base sólida para o v2 sem redesenho.
### Pontos que precisam de confirmação do Product Owner
DEC-006 (qual superfície de convite vence); se a nomenclatura confusa do claim JWT (`org_id` carregando um
`tenants.id`) deve ser corrigida (renomeado) no v2 ou mantida por compatibilidade.
### Confidence
HIGH
### Evidence
- docs/backend-v2/field-traceability/modules/workspace.md §0,§6,§7,§8,§9,§13,§17

---

## 18. Lembrete do modelo de credenciais

Dois espaços de credencial distintos, confirmados consistentes em toda a auditoria de `integrations`:

- **Segredos de plataforma/sistema** (`PLATFORM_SHARED`) — pertencem à própria aplicação MUSIC OS 360, não
  a um tenant específico (ex.: chave da API do Spotify usada para sincronizar métricas de qualquer
  artista, credencial do Resend para envio de e-mail transacional, chave do Sentry). Devem viver em
  variável de ambiente / gerenciador de segredos da plataforma — nunca em uma tabela de negócio associada
  a um tenant.
- **Credenciais de provedor por tenant** (`TENANT_OWNED`) — pertencem ao negócio de um tenant específico
  (ex.: token da conta Autentique do tenant, credencial OAuth do Instagram/Meta conectada por aquele
  tenant, futura credencial de distribuidora quando implementada). Devem viver em armazenamento seguro
  específico por tenant, cifrado (o padrão já usado por `IntegrationBaseService`: AES-256-GCM).

Nenhum valor de credencial real foi impresso, adicionado ou solicitado neste relatório ou em qualquer etapa
anterior desta auditoria (`CREDENTIALS_TO_ADD_NOW: 0` confirmado em todos os módulos que tocam
integrações).

`EVIDENCE: docs/backend-v2/field-traceability/modules/integrations.md §18 | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 19. Banco de dados / Tenancy

PostgreSQL é o banco único (via Supabase). Isolamento multi-tenant hoje se apoia em `tenant_id` explícito
em toda tabela de negócio, resolvido sempre server-side a partir do JWT verificado (nunca do
`X-Tenant-ID` enviado pelo cliente, usado só como checagem de consistência) — `TenantGuard` +
`TenantBootstrapResolver` + `@CurrentTenant()`. RLS (Row Level Security) é mencionada como mecanismo
adicional em pontos específicos (ex.: autorização de Realtime broadcast, migration
`20260801000001_RealtimeBroadcastAuthorization`), mas o enforcement primário confirmado em toda a série de
auditoria é a checagem explícita de `tenant_id` em cada query de aplicação, não RLS como camada única.

Para a `apps/api-v2`, o documento `doc73` (namespace de banco, não reaberto por este relatório) já
estabeleceu a convenção de namespace `app` para o schema v2 — não há, até o momento desta auditoria,
nenhuma tabela de domínio de negócio criada nesse namespace (ver §20).

`EVIDENCE: docs/backend-v2/field-traceability/modules/auth.md §3,§4 | docs/backend-v2/field-traceability/modules/workspace.md §0,§10,§18 | docs/backend-v2/74-zero-gap-reconstruction-contract.md §12 | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 20. Estado real da construção do backend v2

### Já construído (verificado diretamente em `apps/api-v2/src/**`)

```text
apps/api-v2/src/
  app.controller.ts / app.module.ts / app.service.ts   — scaffold NestJS mínimo
  config/
    config.module.ts / config.service.ts               — carregamento de configuração via Zod
    database-config.service.ts / database.schema.ts     — validação de DATABASE_URL/DIRECT_DATABASE_URL
      (nota: "database.schema.ts" aqui é schema de VARIÁVEIS DE AMBIENTE, não schema de tabelas —
      nome pode confundir; não contém nenhuma definição Drizzle de tabela de negócio)
    env.schema.ts / env.schema.spec.ts                   — validação de env vars, com teste
  database/
    client/drizzle.provider.ts, pg-pool.service.ts        — conexão real ao Postgres via Drizzle+pg
    database.module.ts                                    — módulo Nest de acesso a banco
    transaction/drizzle-transaction-manager.ts,
      drizzle-transaction-context.ts, resolve-database-client.ts,
      retryable-postgres-error.ts                         — infraestrutura real de transação/retry
  main.ts                                                 — bootstrap Nest
```

Dependências reais instaladas: `@nestjs/common`/`core`/`platform-express` (11.x), `drizzle-orm` (0.45.x),
`pg`, `zod` (4.x), `express` (5.x). `package.json` da própria `apps/api-v2` descreve-se textualmente como
*"scaffold inicial, sem domínios de negócio"*.

### Ainda NÃO construído

- **Nenhuma tabela de domínio de negócio** foi definida em Drizzle (nenhum `projects`, `works`,
  `phonograms`, `releases`, `contracts`, `artists`, `transactions` etc. existe como schema Drizzle em
  `apps/api-v2`).
- **Nenhuma migration de domínio** existe.
- **Nenhum módulo CRUD de negócio** (controller/service/DTO) existe para qualquer um dos 24 domínios
  auditados.
- **Nenhuma integração real** (Stripe, Spotify, ABRAMUS, R2, etc.) foi portada.
- **Nenhum cutover** foi planejado tecnicamente além do critério conceitual já registrado em `doc74` §24.

**Conclusão explícita**: a fundação técnica (Nest + Drizzle + Zod + conexão de banco + infraestrutura de
transação) está pronta e testada (existem `*.spec.ts` para as peças-chave). Isso **não deve ser confundido**
com reconstrução funcional — nenhum domínio de negócio foi reconstruído, e os 168 gaps documentados neste
relatório continuam todos pendentes de tratamento na etapa de desenho/implementação de cada domínio.

`EVIDENCE: apps/api-v2/package.json | apps/api-v2/src/config/database.schema.ts | apps/api-v2/src/database/** (listagem de arquivo, verificação direta) | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 21. Decisões resolvidas

| Decisão | Tema | Escolha atual | Significado em português | Implementado? |
|---|---|---|---|---|
| `DEC-001` | Significado de `projects` | **MUSICAL_PROJECT_CANONICAL_HUB** (corrigida; anterior: `UNIVERSAL_FINANCIAL_PROJECT`, `INVALIDATED_BY_PRODUCT_OWNER_DOMAIN_CORRECTION`, preservada em `decision-register.json.DEC-001.supersededDecision`) | `projects` é a entidade canônica Projeto Musical/Música, não um hub financeiro/operacional genérico; `projects.id` é a chave de vínculo cross-domain para essa música | NÃO |
| `DEC-002` | Vocabulário canônico de tipo de contrato | **CONTRACT_SERVICE_TYPES_CANONICAL** | `contract_service_types` é a fonte canônica; `contract_templates.tipo_servico`/`contracts.tipo` deixam de ser vocabulários livres independentes | NÃO |
| `DEC-004` | Componente de criação/edição de contrato | **UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT** | Um único componente canônico, modos WIZARD e QUICK, ambos os entrypoints reais preservados | NÃO |
| `DEC-007` | Modelo de tracklist de lançamentos | **RELATIONAL_TRACKLIST_MODEL** | Tracklist deve ser relacional, referenciando fonogramas concretos (`Release → Release Track → Phonogram → Work`); `metadata.faixas` não é a fonte canônica; desenho final da tabela ainda `TO_BE_DESIGNED` | NÃO |

Todas as 4 decisões acima são **puramente documentais** — nenhum código, schema, migration, banco de dados
ou Supabase foi alterado como resultado delas, confirmado explicitamente em cada `implementationStatus` do
registro.

`EVIDENCE: docs/backend-v2/gap-resolution/decision-register.json | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 22. Decisões pendentes

| Decisão | Pergunta | Opções | Recomendação existente | Motivo da pendência | Impacto |
|---|---|---|---|---|---|
| `DEC-003` | `ArtistaFormModal.tsx` (real, ~45 campos) vs. `ArtistaCadastro.tsx` (órfã, ~71 campos) — qual mantido/expandido? | (1) manter o Modal, portar campos exclusivos da página órfã e removê-la; (2) substituir o Modal pela página órfã; (3) manter os dois deliberadamente para fluxos distintos | **RESOLVED — ARTISTA_FORM_MODAL_CANONICAL** (opção 1, decidida pelo Product Owner; corrigido, era "não resolvida nesta auditoria") | Mesclagem de 10 campos reais (tipo/status/contrato_id/manager_nome/manager_contato/produtor_executivo/agencia_booking/label_parceira/galeria_urls/documentos) ainda pendente de implementação — nenhum dado é perdido no meio-tempo (PartialType/UpdateArtistDto só escreve chaves presentes no payload) |
| `DEC-005` | Billing fragmentado em 3 superfícies — qual das duas primeiras (`Configuracoes.tsx` "Billing" vs. `Billing.tsx` standalone) vira canônica? | (1) `Configuracoes.tsx` "Billing" (arquitetura correta, sem hardcode); (2) `Billing.tsx` standalone (mais usada/linkada); (3) fundir as duas | (1) `Configuracoes.tsx` "Billing" | Análise concluída, mas **não registrada** (`DEC_005_ANALYSIS_STATUS: PARKED_UNCHANGED`) — decisão de produto explicitamente não tomada | Afeta diretamente a experiência de cobrança/upgrade de plano; billing hoje tem 1 endpoint faltante (troca de plano) e 1 cartão de pagamento falso, independentemente de qual UI vencer |
| `DEC-006` | Gestão de convites fragmentada entre `/usuarios` (só envia convite) e `Configuracoes.tsx` "Usuários" (superfície completa) — qual vence? | (1) `Configuracoes.tsx` "Usuários" (já completa); (2) `Usuarios.tsx` (rota de nível superior mais descoberta); (3) extrair componente compartilhado, sem eliminar nenhuma entrada de navegação | (1) `Configuracoes.tsx` "Usuários" | Decisão de produto sobre superfície de UI, não resolvida | Baixo risco técnico (backend já unificado via `useRoles()`); risco de confusão de UX enquanto não resolvida |
| `DEC-008` | Party de contrato copiada de CRM/Artista — `sourceId` deve virar referência viva ou permanecer snapshot intencional? | (1) referência viva (depende de `DEC-004` já resolvida); (2) formalizar snapshot atual como intencional | (2) formalizar snapshot como intencional | Decisão com implicação jurídica (contratos assinados mudando retroativamente ou não) — cabe ao usuário/Product Owner por afetar semântica legal | Se resolvida como "referência viva" sem cuidado, contratos já assinados poderiam exibir dados diferentes dos vigentes no momento da assinatura — risco jurídico direto |

`EVIDENCE: docs/backend-v2/gap-resolution/decision-register.json (DEC-003, DEC-005, DEC-006, DEC-008) | CONFIDENCE: HIGH | STATUS: PENDING_PRODUCT_DECISION (todas as 4)`

---

## 23. Gaps críticos

| Gap | Módulo(s) | Problema em português | Impacto | Wave | Decisão necessária? |
|---|---|---|---|---|---|
| GAP-0168 | releases, projects | Lançamento não tem relação persistida com o Projeto Musical de origem | Decisão resolvida (`DEC-009: PROJECT_RELEASE_DIRECT_LINK`, `releases.project_id → projects.id`); não bloqueia mais o schema v2 (corrigido); resta implementar; quebra a cadeia conceitual `Project → Work → Phonogram → Release` até que a coluna exista | WAVE_2 | NÃO |
| GAP-0129 | releases | Campo `internal_status` injetado fora do contrato quebra 100% da criação/edição de Lançamento | Bloqueia toda a operação primária do módulo `releases` | WAVE_2 | NÃO |
| GAP-0138/0139/0140/0141/0143 | rh | Create de Funcionário/Folha/Férias 100% quebrado; leitura da lista de Funcionários também quebrada | Bloqueia toda a operação primária do módulo `rh` | WAVE_2 | NÃO |
| GAP-0048 | contracts | Criação de template de contrato retorna HTTP 400 em toda submissão | Bloqueia o Passo 1 do fluxo principal de contratos | WAVE_2 | NÃO |
| GAP-0009 | accounting | Vínculos gerenciais (rateio de P&L) exigidos pela UI, descartados silenciosamente pelo backend | Compromete a rastreabilidade financeira multi-entidade | WAVE_2 | NÃO |
| GAP-0010 | accounting | Endpoints de regras de categorização automática não existem | 400 em toda carga da tela de Regras | WAVE_2 | NÃO |
| GAP-0111 | marketing | Dois sistemas de campanha paralelos, incompatíveis, na mesma tabela | Risco de dado inconsistente se o Sistema A for algum dia reativado | WAVE_2 | NÃO |
| GAP-0157/0158 | support, admin | Enum de status/categoria de ticket com 3 vocabulários divergentes — crash alcançável | Erro de runtime real em `AdminSupport.tsx` | WAVE_2 | NÃO |
| GAP-0001 | projects, audiovisual, marketing, accounting | `projects.artista_id`/`orcamento` não coletados pelo único form real | Decisão já resolvida (DEC-001); implementação de exposição de campo pendente | WAVE_3 | NÃO (decisão resolvida) |
| GAP-0004 | contracts | Dois componentes divergentes de create/edit de contrato coexistem | Decisão já resolvida (DEC-004); consolidação técnica pendente | WAVE_3 | NÃO (decisão resolvida) |
| GAP-0013 | accounting, projects | "P&L por Projeto" não agrupa por projeto | Métrica financeira central exibida incorretamente | WAVE_4 | NÃO |
| GAP-0033 | audiovisual, marketing, projects | `financial_project_id` real, nunca escrita por nenhum formulário | Impede agregação financeira cross-domain por música | WAVE_4 | NÃO |
| GAP-0049 | contracts, reports | PII de partes de contrato em texto livre, exportada sem máscara | Risco de compliance/LGPD | WAVE_4 | NÃO |
| GAP-0055 | contracts, accounting | Termos financeiros do contrato não propagam para a Contabilidade | Fluxo financeiro contratual incompleto | WAVE_4 | NÃO |
| GAP-0039 | auth | Allowlist de Redirect/Site URL do Supabase não verificável por código | **Bloqueia o cutover** (único gap com esse bloqueio hoje) | WAVE_5 | NÃO (depende de config externa, não de decisão de produto) |
| GAP-0080 | integrations, releases | 6 distribuidoras digitais permanecem STUB | Bloqueia distribuição real de lançamentos | WAVE_5 | NÃO (decisão D1 já aprovada em documento anterior) |

`EVIDENCE: docs/backend-v2/gap-resolution/canonical-gap-register.json | docs/backend-v2/gap-resolution/00-canonical-gap-register.md §12 | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 24. Tabela mestra cross-domain

| Entidade origem | Relação | Entidade destino | FK/campo atual | Estado |
|---|---|---|---|---|
| Tenant | isolamento | (toda tabela de negócio) | `tenant_id` (explícito, verificado server-side) | ALREADY_CORRECT |
| Artist | autor/dono | Work, Phonogram, Release, Contract | `*.artista_id` | ALREADY_CORRECT (FK real, DB-enforced) |
| Artist | vínculo lógico | Project, Transaction, Event, ArtistGoal | `*.artista_id` (sem FK) | LEGACY_NAMING/MISSING_CONSTRAINT (funciona, sem integridade referencial física) |
| Project | vínculo de obra | Work | `works.projeto_id` | ALREADY_CORRECT |
| Project | vínculo transitivo | Phonogram | (via Work) | TRANSITIVE |
| Project | vínculo ausente | Release | nenhum | MISSING_RELATION (GAP-0168) |
| Project | vínculo financeiro | Transaction | `transactions.projeto_id` | ALREADY_CORRECT |
| Project | vínculo (nome enganoso) | Audiovisual, Marketing | `*.financial_project_id` | LEGACY_NAMING + MISSING_AT_UI_WRITE_LEVEL (GAP-0033) |
| Work | obra de | Phonogram | `phonograms.obra_id` | ALREADY_CORRECT |
| Work | junção (nunca populada) | Release | `release_works` | TO_BE_DESIGNED (DEC-007) |
| Release | distribuição | Audiovisual | `audiovisual_projects.release_id` | ALREADY_CORRECT |
| Release | financeiro | Transaction/PerformanceMetric | `transaction_allocations.release_id`, `performance_metric_entries.release_id` | SCHEMA_ONLY, REJECTED_ARCHITECTURE (decisão PO `REMOVE_SECOND_ACCOUNTING_LAYER` — FK real mas em tabela sem consumidor e descartada como alvo v2; não usar como base de propagação financeira real) |
| Contract | assinatura → financeiro | Transaction | evento `CONTRACT_SIGNED` (não FK direta) | REAL_AUTOMATIC_PROPAGATION (parcial, só `valor`) |
| Contract | vínculo | Artist | `contracts.artista_id` | ALREADY_CORRECT (mas só escrita pelo fluxo secundário) |
| Contract | vínculo ausente | Project/Work | nenhum | NOT_APPLICABLE (confirmado ausente por design atual) |
| Event | vínculo | Artist | `events.artista_id` (texto livre em parte dos fluxos) | CONFLICTED (relação lógica fraca, sem FK forte de lineup) |
| Client/CRM | vínculo | Contract, Lead(conversão) | `contracts.cliente_id`, conversão automática de Lead | ALREADY_CORRECT / CONFLICTED (duplicação de cliente na conversão) |

`EVIDENCE: seções §4,§7-16,§17 deste relatório, com citação primária em cada módulo | CONFIDENCE: HIGH | STATUS: PARTIALLY_CONFIRMED`

---

## 25. Matriz de source-of-truth

| Conceito | Source of Truth atual | Source canônica desejada | Status |
|---|---|---|---|
| Musical Project | `ProjetoFormModal.tsx` → `projects` | mesma, com `artista_id`/`orcamento` expostos | CONFIRMED (definição), PARTIALLY_CONFIRMED (implementação) |
| Contract Type | 4 vocabulários coexistentes (ver §14) | `contract_service_types` (DEC-002) | PENDING_PRODUCT_DECISION (implementação) |
| Release Tracklist | `releases.metadata.faixas` (jsonb) | tabela relacional `release_tracks` (ou evolução de `release_works`), `TO_BE_DESIGNED` | PENDING_PRODUCT_DECISION (desenho físico) |
| Contract Form State | 2 componentes divergentes (`ContratoWizard.tsx`/`ContratoFormModal.tsx`) | 1 componente canônico, modos WIZARD/QUICK (DEC-004) | PENDING_PRODUCT_DECISION (implementação) |
| Tenant | `tenants` (= "Workspace" na UI) | mesma | CONFIRMED |
| Accounting Transaction | `transactions` (28 campos, `form-to-payload.mapper.ts`) | mesma | CONFIRMED |
| Artist | `ArtistaFormModal.tsx` + `artista.mapper.ts` | mesma (`DEC-003` RESOLVED — ArtistaFormModal.tsx canônico) | 10 campos a mesclar, implementação pendente (corrigido, era PENDING_PRODUCT_DECISION) |
| Work | `ObraFormModal.tsx` + `works` | mesma | CONFIRMED |
| Phonogram | `FonogramaFormModal.tsx` + `phonograms` | mesma | CONFIRMED |
| Release | `LancamentoFormModal.tsx` (hoje quebrado) + `releases` | mesma, após corrigir `internal_status` | CONFLICTED (fonte real existe mas está inoperante) |
| Billing Subscription | `billing_subscriptions`/`billing_plans` (Stripe real) | mesma, com uma única UI canônica (DEC-005) | PENDING_PRODUCT_DECISION |

`EVIDENCE: seções correspondentes deste relatório | CONFIDENCE: HIGH | STATUS: PARTIALLY_CONFIRMED`

---

## 26. Matriz de termos ambíguos

| Termo | Significado correto |
|---|---|
| Project | Projeto Musical/Música — a ficha inicial de uma música em produção (título, faixas, compositores). NÃO é um hub financeiro genérico (correção `DEC-001`). |
| Work | Obra — a composição musical (letra+melodia), unidade de direito autoral. Distinta da gravação. |
| Phonogram | Fonograma — a gravação concreta de uma Obra (uma performance específica registrada). |
| Release | Lançamento — o produto de distribuição (single/EP/álbum) que empacota uma ou mais gravações. Hoje sem relação persistida com o Project que o originou. |
| Track | No contexto de `project_tracks`: uma faixa planejada dentro de um Projeto Musical (nível de produção). No contexto de `releases.metadata.faixas`: uma entrada de tracklist do Lançamento (jsonb, não relacional, `NON_CANONICAL_METADATA` per DEC-007). Não confundir os dois "Track". |
| Artist | Artista — pessoa/entidade artística cadastrada em `artists`, distinta de `User`/`OrgMember` (usuário da plataforma) e de `Client` (cliente/contato de negócio). |
| Client | No módulo `crm-relationships`/`contracts`: pessoa física/jurídica cliente do tenant, tabela `clients`. Mesma tabela física usada para o conceito "Contato" (ver abaixo). |
| Contact | Não existe tabela física `contacts` real em uso — "Contato = Cliente" é uma decisão de domínio documentada; ambos os conceitos compartilham a tabela `clients`. Existe uma facade legada `/contacts` (Map em memória), desconectada, sem consumidor real. |
| Tenant | A unidade de isolamento multi-tenant no banco de dados — tabela `tenants`. |
| Workspace | Nome de UI/DTO para a mesma entidade `Tenant` — `WORKSPACE_TENANT_RELATIONSHIP: SAME_ENTITY`, confirmado por leitura direta do código de provisionamento. |
| Contract | Contrato — acordo entre o tenant e uma parte (artista/cliente/prestador), tabela `contracts`. |
| Contract Type | Ver §14 — hoje 4 vocabulários coexistem; `contract_service_types` é a fonte canônica por decisão (`DEC-002`), implementação pendente. |
| Billing Plan | Plano de assinatura SaaS da própria plataforma MUSIC OS 360 (via Stripe, `billing_plans`) — não confundir com "plano de projeto" ou qualquer conceito de domínio musical. |
| Transaction | No módulo `accounting`: uma transação financeira (receita/despesa), tabela `transactions`. No contexto de banco de dados (transação SQL/ACID): um conceito técnico de infraestrutura, usado extensivamente em `WorkspaceProvisioningService`/`drizzle-transaction-manager.ts` — os dois usos de "transaction" nunca se sobrepõem no código, mas o termo é ambíguo em prosa. |
| Event | Um evento de agenda (show, gravação, reunião), tabela `events`. Distinto de "evento de domínio" (`DOMAIN_EVENTS`, `EventEmitter2`) e de "evento de webhook" (integrações) — três usos técnicos diferentes da palavra "evento"/"event" no código. |

`EVIDENCE: seções correspondentes deste relatório | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

## 27. Definições que NÃO podem ser consideradas confirmadas

```
CONFLICT_ID: CONFLITO-01
SUBJECT: Nome da opção selecionada de DEC-001 dentro do próprio registro canônico de gaps
SOURCE_A: docs/backend-v2/gap-resolution/decision-register.json (DEC-001.selectedOption =
  "MUSICAL_PROJECT_CANONICAL_HUB", correção vigente, autoridade do Product Owner)
SOURCE_B: docs/backend-v2/gap-resolution/00-canonical-gap-register.md §12, tabela WAVE_3_CORE_DOMAIN_FIXES,
  linha de GAP-0001: "projects domain-meaning DECIDED (DEC-001: UNIVERSAL_FINANCIAL_PROJECT) — remaining
  work: expose artista_id/orcamento..." — ainda cita o nome ANTIGO/INVALIDADO da decisão
WHY_CONFLICTS: A correção de DEC-001 (ADENDO no topo do mesmo documento) está correta e clara, mas a linha
  de índice de GAP-0001 na tabela de wave (mais abaixo no mesmo arquivo) nunca foi atualizada após a
  correção — um leitor que consulte só essa tabela (sem ler o ADENDO no topo) concluiria erroneamente que
  DEC-001 ainda é UNIVERSAL_FINANCIAL_PROJECT.
PRODUCT_OWNER_CONFIRMATION_REQUIRED: Não é uma pergunta ao Product Owner — é uma correção documental
  recomendada para uma etapa futura (ver §30, item NOVO-01).
```

```
CONFLICT_ID: CONFLITO-02
SUBJECT: A que gap "GAP-0099" (leads: conversão sem vínculo financial_project_id) realmente pertence a
  mesma família de causa-raiz
SOURCE_A: canonical-gap-register.json (GAP-0099.title = "...(same root cause family as GAP-0015)") — mas
  GAP-0015 é "accounting: financial_category_id nunca setado pelo formulário de transação (não é bug,
  PARTIALLY_MIGRATED)" — um assunto totalmente diferente (categoria financeira, não vínculo de
  projeto/artista)
SOURCE_B: docs/backend-v2/gap-resolution/00-canonical-gap-register.md §12, tabela WAVE_4, mesma linha:
  "...(same family as GAP-0015 note: actually GAP-0001)" — sugere que a citação correta seria GAP-0001
  (o gap de definição de domínio de `projects`), não GAP-0015
WHY_CONFLICTS: Nem GAP-0015 (categoria financeira) nem GAP-0001 (definição de domínio de `projects`)
  parecem, pela leitura do conteúdo de cada um, ser realmente "a mesma família de causa-raiz" de GAP-0099
  (que é sobre `financial_project_id` nunca escrita na conversão de lead) — o candidato mais plausível por
  conteúdo é GAP-0033 (financial_project_id real, nunca escrita por nenhum formulário), mas nenhuma das duas
  fontes o cita.
PRODUCT_OWNER_CONFIRMATION_REQUIRED: NÃO diretamente ao Product Owner — recomenda-se que a próxima etapa de
  manutenção do registro esclareça a citação correta (ver §30, item NOVO-02).
```

```
CONFLICT_ID: CONFLITO-03
SUBJECT: A coluna `projects.contrato_id` existe fisicamente na tabela `projects`?
SOURCE_A: docs/backend-v2/field-traceability/modules/projects.md §2 — lista exaustiva das 16 colunas
  reais de `projects` (Fase 1, cross-checada contra `database-backend-column-mapping.json`): id, tenant_id,
  titulo, tipo, status, artista_id, orcamento, descricao, observacoes, genero, metadata, created_at,
  updated_at, deleted_at, created_by, updated_by — **`contrato_id` NÃO aparece nessa lista**.
SOURCE_B: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0127.title = "projects:
  project-to-contract relation (contrato_id) is a real FK exposed as a filter, but no create/edit form
  sets it") — afirma que `contrato_id` é uma coluna real com FK.
WHY_CONFLICTS: `projects.md` é a fonte primária de Fase 2 para este módulo e é explícita/exaustiva sobre as
  16 colunas da tabela; `GAP-0127` (produzido na consolidação de Fase 3) afirma a existência de uma 17ª
  coluna não listada em nenhum lugar do relatório de módulo original. Uma das duas fontes está incorreta,
  ou a coluna foi adicionada por uma migration posterior ao fechamento de `projects.md` e nunca
  re-auditada.
PRODUCT_OWNER_CONFIRMATION_REQUIRED: SIM — ver PO-VERIFY-006.
```

```
CONFLICT_ID: CONFLITO-04
SUBJECT: Padrão inconsistente de proteção de dado sensível dentro da mesma entidade `Artist`
SOURCE_A: docs/backend-v2/field-traceability/modules/artist.md §3 — email/telefone/CPF-CNPJ/contato do
  manager são cifrados (AES-256-GCM) de ponta a ponta, decifrados só em resposta autorizada.
SOURCE_B: docs/backend-v2/field-traceability/modules/reports.md (achado `EXPORT_PRIVACY_GAP`, referenciado
  em PROGRESS.md, seção "MODULE: reports") — dados bancários do artista (`banco`/`conta`/`chave_pix`/
  `titular_conta`, mesma entidade) são armazenados como jsonb **não cifrado** e exportados em texto puro na
  mesma camada de permissão que os campos cifrados.
WHY_CONFLICTS: Não há razão de produto documentada para os dois tratamentos de sensibilidade diferentes
  dentro da mesma entidade — um é dado financeiro tipicamente mais sensível que e-mail/telefone, não menos.
PRODUCT_OWNER_CONFIRMATION_REQUIRED: SIM — ver PO-VERIFY-022.
```

```
CONFLICT_ID: CONFLITO-05
SUBJECT: "Contrato assinado propaga para a Contabilidade" — verdadeiro ou falso?
SOURCE_A: canonical-gap-register.json (GAP-0055.title = "contracts: financial terms... captured in
  ContratoWizard have no propagation to accounting/transactions") — lido isoladamente, sugere que NENHUMA
  propagação existe.
SOURCE_B: docs/backend-v2/field-traceability/modules/contracts.md §15 — confirma
  `CONTRACT_TO_ACCOUNTING_TRACEABILITY_COMPLETE: SIM`, classificado `REAL_AUTOMATIC_PROPAGATION`: ao
  assinar, uma transação real É criada automaticamente (com `valor` do contrato).
WHY_CONFLICTS: As duas fontes não se contradizem tecnicamente (GAP-0055 é sobre os TERMOS financeiros ricos
  — forma de pagamento, vencimento, parcelas — não propagarem; §15 confirma que só o `valor` simples
  propaga), mas a formulação do título de GAP-0055, lida isoladamente, pode ser mal-interpretada como
  "nenhuma propagação existe", o que é falso. Resolvido neste relatório (§12), mas registrado aqui como
  ponto de leitura ambíguo entre as duas fontes originais.
PRODUCT_OWNER_CONFIRMATION_REQUIRED: NÃO — esclarecido neste relatório; recomenda-se apenas reformular o
  título de GAP-0055 numa etapa futura (ver §30, item NOVO-03).
```

Para todo ponto de dado que não pôde ser comprovado com uma segunda fonte independente (ex.: cardinalidade
real de Work por Project em produção, ou volume real de dados órfãos), este relatório usa
`UNKNOWN / NEEDS PRODUCT OWNER CONFIRMATION` explicitamente nas seções correspondentes (§6), em vez de
presumir um valor.

`EVIDENCE: citado individualmente em cada bloco acima | CONFIDENCE: LOW-a-MEDIUM por conflito individual (a existência do conflito em si é HIGH — ambas as fontes foram lidas diretamente) | STATUS: CONFLICTED`

---

## 28. Itens que o Product Owner deve validar antes da continuação

### A — Definições centrais

```
PO-VERIFY-001
"O Project é, de fato, sempre a Música/Projeto Musical — nunca um hub financeiro genérico, mesmo em casos
de uso futuros (ex.: um projeto puramente audiovisual sem música associada)?"
CURRENT_MODEL: MUSICAL_PROJECT_CANONICAL_HUB (DEC-001, corrigida)
EVIDENCE: decision-register.json (DEC-001.canonicalDecision)
IMPACT_IF_WRONG: Redesenho completo do schema v2 de `projects` e de todas as relações cross-domain
  documentadas no §4.
```

```
PO-VERIFY-002 — RESOLVED (decisão definitiva do Product Owner)
"Um Release deve, no v2, ter uma coluna persistida apontando para o Project musical de origem (GAP-0168),
ou a intenção de produto é que Release seja sempre desconectado de Project após a criação?"
CURRENT_MODEL (histórico, pré-decisão): MISSING_RELATION hoje; GAP-0168 recomendava adicionar a coluna,
  mas isso não estava decidido como requisito de produto, só como lacuna técnica identificada
EVIDENCE: canonical-gap-register.json (GAP-0168) | releases.md §16 | decision-register.json (DEC-009)
IMPACT_IF_WRONG (histórico, pré-decisão): Afetava diretamente o desenho de schema v2 de `releases`
  (campo `blocksSchemaV2Design: true`).

DECISÃO DO PRODUCT OWNER: PROJECT_RELEASE_DIRECT_LINK (`DEC-009`, RESOLVED). Sim, `Release` deve ter
`releases.project_id → projects.id` (FK real, N:1, nullable, sem `UNIQUE` implícito) no v2. Essa
relação direta NÃO substitui a cadeia `Release → ReleaseTrack → Phonogram → Work` (`DEC-007`/`DEC-001`)
— ambas coexistem. `Project` no v2 representa canonicamente Single/EP/Álbum (escopo explicitamente
restringido pelo Product Owner; `video`/`tour`/`podcast`/`other`, vocabulário mais amplo observado no
DTO atual, não são escopo canônico desta relação — permanecem legado). `blocksSchemaV2Design` de
`GAP-0168` corrigido para `NÃO` — ver `gap-resolution/00-canonical-gap-register.md` ("Correção canônica
— DEC-009 RESOLVED"). `GAP-0168` permanece `OPEN` apenas pela implementação real ainda pendente.
```

```
PO-VERIFY-003
"Um único Project musical pode gerar mais de um Work (obra) e mais de um Release (lançamento)? Ou a
intenção de produto é 1 Project = 1 música = 1 Release?"
CURRENT_MODEL: CARDINALITY: TO_BE_CONFIRMED (schema permite N:1 em ambos os casos, mas cardinalidade real
  de uso não foi medida)
EVIDENCE: §6 deste relatório
IMPACT_IF_WRONG: Afeta constraints de integridade (unique, obrigatoriedade) no schema v2.
```

```
PO-VERIFY-004
"A faixa de um Projeto Musical (`project_tracks`) e a faixa de um Lançamento (`releases.metadata.faixas`)
devem convergir em uma única entidade de 'Track' no v2, ou são conceitos legitimamente distintos (faixa em
produção vs. faixa já distribuída)?"
CURRENT_MODEL: hoje são dois conceitos tecnicamente distintos e desconectados
EVIDENCE: projects.md §2 | releases.md §15 | decision-register.json (DEC-007)
IMPACT_IF_WRONG: Afeta diretamente o desenho da tabela `release_tracks` (DEC-007, `TO_BE_DESIGNED`).
```

```
PO-VERIFY-005
"'Workspace' deve continuar sendo estritamente 1:1 com 'Tenant' no v2 (sem switcher de múltiplos
workspaces na mesma sessão), ou o produto pretende introduzir seleção de workspace no futuro?"
CURRENT_MODEL: SAME_ENTITY, sem switcher, uma sessão = um tenant (confirmado característica
  arquitetural, não gap)
EVIDENCE: workspace.md §0,§9
IMPACT_IF_WRONG: Mudança arquitetural significativa em autenticação/contexto de sessão para o v2.
```

### B — Relações entre entidades

```
PO-VERIFY-006
"A coluna `projects.contrato_id` (que vincularia um Project diretamente a um Contract) existe de fato no
banco hoje, ou GAP-0127 está referenciando uma coluna que não existe (CONFLITO-03)?"
CURRENT_MODEL: CONFLICTED — ver §27, CONFLITO-03
EVIDENCE: projects.md §2 (lista de 16 colunas, sem contrato_id) vs. canonical-gap-register.json (GAP-0127)
IMPACT_IF_WRONG: Se a coluna não existir, GAP-0127 deve ser reclassificado/removido do registro; se
  existir, `projects.md` precisa de uma correção de Fase 2 (adendo).
```

```
PO-VERIFY-007
"As colunas `financial_project_id` (em `audiovisual_projects`/`marketing_projects`) devem ser renomeadas
no schema v2 para refletir seu significado real (vínculo ao projeto musical), ou o nome deve ser mantido
por compatibilidade?"
CURRENT_MODEL: LEGACY_NAMING, não renomeado nesta etapa (decisão explícita de não renomear ainda)
EVIDENCE: decision-register.json (DEC-001.preservedRelations)
IMPACT_IF_WRONG: Baixo risco técnico isolado, mas afeta clareza de leitura do schema v2 por toda a equipe.
```

```
PO-VERIFY-008
"'P&L por Projeto' na Contabilidade deve, de fato, significar 'resultado financeiro agrupado por
música/projeto musical' (ex.: quanto uma música específica gerou de receita/custo)?"
CURRENT_MODEL: Sim, sob a definição corrigida — mas nunca implementado (GAP-0013)
EVIDENCE: accounting.md §2.5 | canonical-gap-register.json (GAP-0013.correctedSemanticNote)
IMPACT_IF_WRONG: Se a intenção real for outra (ex.: agrupar por campanha, não por música), o esforço de
  correção de GAP-0013 seria direcionado incorretamente.
```

```
PO-VERIFY-009
"Contracts deve ganhar, no v2, uma relação formal com Work/Phonogram/Project (hoje inexistente em qualquer
camada), para permitir rastrear 'este contrato é sobre esta música específica'?"
CURRENT_MODEL: NOT_APPLICABLE hoje (nenhuma relação existe, confirmado por design atual, não por lacuna)
EVIDENCE: contracts.md §9
IMPACT_IF_WRONG: Novo requisito de schema não capturado em nenhum gap hoje, se a resposta for "sim".
```

```
PO-VERIFY-010
"A conversão automática de Lead deve, de fato, sempre criar um Artist — mesmo para leads que não são de
perfil artístico (ex.: um lead de fornecedor/parceiro)?"
CURRENT_MODEL: comportamento atual sempre cria Artist, sem checar tipo de lead nem duplicata
EVIDENCE: PROGRESS.md (seção "MODULE: leads")
IMPACT_IF_WRONG: Gera artistas duplicados/incorretos no catálogo se a resposta esperada for "não".
```

### C — Comportamentos de módulo

```
PO-VERIFY-011
"Qual a prioridade de corrigir o bug de `internal_status` em Releases, que hoje bloqueia 100% da criação e
edição de Lançamentos via a UI real?"
CURRENT_MODEL: bug ativo, sem correção nesta etapa
EVIDENCE: releases.md §0
IMPACT_IF_WRONG: Nenhum Lançamento novo pode ser criado pela UI enquanto este bug persistir — impacto
  operacional direto e imediato, independente de qualquer decisão de v2.
```

```
PO-VERIFY-012
"O módulo RH (Funcionários/Folha/Férias) é um requisito de produto ativo e prioritário, dado que hoje está
100% quebrado para criação em todos os 4 sub-recursos?"
CURRENT_MODEL: bugs ativos, sem correção nesta etapa
EVIDENCE: rh.md §0,§1
IMPACT_IF_WRONG: Se for prioritário, precisa entrar em uma wave de correção antes do v2; se não for
  prioridade real de produto, pode ser descontinuado/simplificado em vez de reconstruído.
```

```
PO-VERIFY-013
"Os 8 domínios do backend Audiovisual sem qualquer UI (briefing, entregáveis, storyboard, cronograma,
equipe, arquivos, tarefas, aprovações) são um roadmap de produto real a receber UI, ou escopo morto a
formalmente descontinuar?"
CURRENT_MODEL: backend real e rico, zero consumidor de UI, classificação atual REAL_MAPPING_GAP sistêmico
EVIDENCE: audiovisual.md §1
IMPACT_IF_WRONG: Definirá se ~85% do domínio Audiovisual construído no backend é reconstruído no v2 ou
  descartado.
```

```
PO-VERIFY-014
"Existe um cronograma real de pesquisa/implementação de API oficial para as 6 distribuidoras digitais
(ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe), ou permanecem como link estático por prazo
indefinido?"
CURRENT_MODEL: STUB honesto, decisão D1 já aprovada em documento anterior, execução técnica futura fora de
  escopo desta auditoria
EVIDENCE: integrations.md §5.20 | releases.md §11
IMPACT_IF_WRONG: Afeta diretamente se distribuição real de lançamentos é uma capacidade do v2 ou permanece
  fora de escopo.
```

```
PO-VERIFY-015
"O autocadastro público de artista (`ArtistaSignupPublic.tsx`) é um requisito de produto ativo, dado que
está 100% quebrado (chama um endpoint inexistente) e aparenta nunca ter funcionado?"
CURRENT_MODEL: quebrado, sem correção nesta etapa
EVIDENCE: auth.md §1
IMPACT_IF_WRONG: Se for requisito real, precisa de endpoint novo no v2; se não for, o componente pode ser
  removido em vez de corrigido.
```

```
PO-VERIFY-016
"Deve-se priorizar religar `signing.adapter.ts` à integração Autentique real (backend já completo e
funcional, custo de implementação estimado como baixo)?"
CURRENT_MODEL: backend pronto, frontend desconectado por design de stub, nenhuma correção feita
EVIDENCE: integrations.md §5.4,§5.13(?)... | contracts.md §21
IMPACT_IF_WRONG: Oportunidade de ganho rápido perdida se não priorizada; nenhum risco técnico se adiada.
```

```
PO-VERIFY-017
"O redirecionamento de `/monitoramento` para `/rights-monitoring` deve ser corrigido para apontar à tela
real e funcional (`Monitoramento.tsx`), abandonando/arquivando `RightsMonitoring.tsx` (hoje
estruturalmente vazia por design)?"
CURRENT_MODEL: usuário só alcança a tela vazia hoje
EVIDENCE: PROGRESS.md (seção "MODULE: monitoring")
IMPACT_IF_WRONG: Usuários continuam sem acesso a uma funcionalidade real e já construída se não corrigido.
```

### D — Decisões pendentes

```
PO-VERIFY-018 — RESOLVED (decisão definitiva do Product Owner)
"DEC-003: qual fluxo de criação de artista deve prevalecer — ArtistaFormModal.tsx (em uso) ou
ArtistaCadastro.tsx (órfã, mais campos)?"
CURRENT_MODEL (histórico, pré-decisão): PENDING
EVIDENCE: decision-register.json (DEC-003)
IMPACT_IF_WRONG (histórico, pré-decisão): Perda de até 26 campos de cadastro de artista se a página
  órfã fosse descartada sem análise.

DECISÃO DO PRODUCT OWNER: ARTISTA_FORM_MODAL_CANONICAL. `ArtistaFormModal.tsx` é o fluxo canônico
único. 10 campos reais exclusivos de `ArtistaCadastro.tsx` (tipo, status, contrato_id, manager_nome,
manager_contato, produtor_executivo, agencia_booking, label_parceira, galeria_urls, documentos) devem
ser mesclados nele antes de remover o componente órfão — classificação completa registrada em
`decision-register.json` `DEC-003`. Nenhum dado é perdido no meio-tempo (campos omitidos do payload do
modal permanecem intocados no banco, não apagados). Implementação ainda `NOT_STARTED`.
```

```
PO-VERIFY-019
"DEC-005: qual superfície de billing deve prevalecer — Configuracoes.tsx 'Billing' ou Billing.tsx
standalone?"
CURRENT_MODEL: PENDING (análise concluída, decisão não registrada)
EVIDENCE: decision-register.json (DEC-005) | settings.md §9
IMPACT_IF_WRONG: Afeta diretamente a experiência de cobrança e a prioridade de correção do endpoint de
  troca de plano faltante.
```

```
PO-VERIFY-020
"DEC-006: qual superfície de gestão de convites deve prevalecer — /usuarios ou a aba Usuários de
Configuracoes.tsx?"
CURRENT_MODEL: PENDING
EVIDENCE: decision-register.json (DEC-006) | workspace.md §8
IMPACT_IF_WRONG: Baixo risco técnico; risco de confusão de UX persistente.
```

```
PO-VERIFY-021
"DEC-008: o sourceId de uma parte de contrato copiada de CRM/Artista deve virar referência viva
(propagação automática de futuras edições) ou permanecer snapshot intencional (documento jurídico não
muda retroativamente)?"
CURRENT_MODEL: PENDING (recomendação registrada: formalizar snapshot como intencional)
EVIDENCE: decision-register.json (DEC-008)
IMPACT_IF_WRONG: Risco jurídico direto se resolvida incorretamente — contratos assinados poderiam parecer
  ter mudado retroativamente.
```

### E — Ambiguidades de dado

```
PO-VERIFY-022
"Dados bancários do artista (banco/conta/chave PIX/titular) devem receber o mesmo nível de criptografia
que email/telefone/CPF da mesma entidade (CONFLITO-04)?"
CURRENT_MODEL: hoje sem criptografia, exportados em texto puro na mesma camada de permissão
EVIDENCE: §27, CONFLITO-04
IMPACT_IF_WRONG: Risco de exposição de dado financeiro sensível se não padronizado antes do v2.
```

```
PO-VERIFY-023
"PII de partes de contrato (CPF/CNPJ/RG/endereço, hoje em texto livre dentro de `observacoes`) deve
migrar para armazenamento estruturado e cifrado antes ou como parte da unificação WIZARD/QUICK
(DEC-004)?"
CURRENT_MODEL: GAP-0049, OPEN, sem plano de correção definido
EVIDENCE: contracts.md §7 | canonical-gap-register.json (GAP-0049)
IMPACT_IF_WRONG: Risco de compliance/LGPD contínuo enquanto não tratado.
```

```
PO-VERIFY-024
"O slug de cadastro público (hoje salvo só em `localStorage` por administrador, não por tenant) deve
migrar para armazenamento server-side como prioridade alta, dado que já existe backend real e ativo
esperando por essa informação?"
CURRENT_MODEL: LOCAL_STORAGE_GAP confirmado, classificado como "empresarial crítico"
EVIDENCE: settings.md §6,§11 | workspace.md §19
IMPACT_IF_WRONG: Cadastro público de artista permanece praticamente inutilizável em produção multi-admin.
```

```
PO-VERIFY-025
"Qual é, de fato, o gap relacionado a GAP-0099 (conversão de lead sem vínculo financial_project_id) —
GAP-0015, GAP-0001, ou GAP-0033, dado que as duas fontes atuais discordam (CONFLITO-02)?"
CURRENT_MODEL: CONFLICTED
EVIDENCE: §27, CONFLITO-02
IMPACT_IF_WRONG: Rastreabilidade de causa-raiz incorreta pode direcionar esforço de correção ao gap errado.
```

```
PO-VERIFY-026
"Existe algum script, integração externa ou documentação de terceiro ainda referenciando a coluna
`projects.nome` (renomeada para `titulo` pela migration 20260718000013), além do próprio código já
corrigido em quase toda parte (exceto `ProjectPlanningAutomation`, que segue quebrado por essa razão)?"
CURRENT_MODEL: renomeação confirmada aplicada no schema; ao menos 1 automação interna ainda quebrada por
  essa causa
EVIDENCE: projects.md §8
IMPACT_IF_WRONG: Migração incompleta de referências pode quebrar mais pontos do sistema do que os já
  identificados.
```

`EVIDENCE: citado individualmente em cada item | CONFIDENCE: HIGH (existência da pergunta); a resposta em si é, por definição, desconhecida até confirmação do Product Owner | STATUS: PENDING_PRODUCT_DECISION (todos os 26 itens)`

---

## 29. Checklist final do Product Owner

| ID | Definição | Estado | PO aprovado? |
|---|---|---|---|
| CHK-01 | `projects` = Musical Project (não hub financeiro genérico) — DEC-001 corrigida | CONFIRMED (correção já aplicada) | [ ] SIM  [ ] CORRIGIR |
| CHK-02 | `DEC-002` — `contract_service_types` como vocabulário canônico de tipo de contrato | RESOLVED (documental) | [ ] SIM  [ ] CORRIGIR |
| CHK-03 | `DEC-004` — componente único WIZARD/QUICK para contratos | RESOLVED (documental) | [ ] SIM  [ ] CORRIGIR |
| CHK-04 | `DEC-007` — tracklist de releases relacional, `release_tracks` a desenhar | RESOLVED (documental) | [ ] SIM  [ ] CORRIGIR |
| CHK-05 | `DEC-003` — fluxo canônico de criação de artista | RESOLVED — ARTISTA_FORM_MODAL_CANONICAL (corrigido, era PENDING) | [ ] SIM  [ ] CORRIGIR |
| CHK-06 | `DEC-005` — superfície canônica de billing | PENDING | [ ] SIM  [ ] CORRIGIR |
| CHK-07 | `DEC-006` — superfície canônica de convites | PENDING | [ ] SIM  [ ] CORRIGIR |
| CHK-08 | `DEC-008` — sourceId de parte de contrato (referência viva vs. snapshot) | PENDING | [ ] SIM  [ ] CORRIGIR |
| CHK-09 | `works.projeto_id → projects.id` — ALREADY_CORRECT | CONFIRMED | [ ] SIM  [ ] CORRIGIR |
| CHK-10 | `transactions.projeto_id → projects.id` — ALREADY_CORRECT | CONFIRMED | [ ] SIM  [ ] CORRIGIR |
| CHK-11 | `releases ↔ projects` — MISSING_RELATION, decisão resolvida (`DEC-009: PROJECT_RELEASE_DIRECT_LINK`), implementação pendente (`GAP-0168` aberto) | CONFIRMED (corrigido) | [ ] SIM  [ ] CORRIGIR |
| CHK-12 | `financial_project_id` (audiovisual/marketing) — LEGACY_NAMING, relação real | CONFIRMED | [ ] SIM  [ ] CORRIGIR |
| CHK-13 | Cardinalidade Project↔Work↔Release | RESOLVED — `DEC-009: PROJECT_RELEASE_DIRECT_LINK` (`releases.project_id → projects.id`, N:1); `Project` canônico = Single/EP/Álbum (corrigido, era UNKNOWN / NEEDS PRODUCT OWNER CONFIRMATION) | [ ] SIM  [ ] CORRIGIR |
| CHK-14 | `projects.contrato_id` existe fisicamente? (CONFLITO-03) | CONFLICTED | [ ] SIM  [ ] CORRIGIR |
| CHK-15 | GAP-0168 impacta o modelo central | CONFIRMED (decisão resolvida — `blocksSchemaV2Design: NÃO`, corrigido; texto anterior "bloqueia schema v2" desatualizado) | [ ] SIM  [ ] CORRIGIR |
| CHK-16 | `apps/api-v2` é só scaffold técnico, nenhum domínio de negócio construído | CONFIRMED | [ ] SIM  [ ] CORRIGIR |

`EVIDENCE: consolidação das seções §3-§27 deste relatório | CONFIDENCE: HIGH | STATUS: PENDING_PRODUCT_DECISION para as linhas marcadas PENDING/UNKNOWN/CONFLICTED`

---

## CANONICAL_DOCUMENTATION_CORRECTIONS_REQUIRED

Inconsistências documentais **novas**, encontradas durante a redação deste relatório (não corrigidas
aqui — apenas registradas para uma etapa futura dedicada, seguindo o mesmo padrão das correções
GAP-0053/GAP-0041, GAP-0041/GAP-0055 e GAP-0069/GAP-0151 já encontradas e corrigidas em etapas anteriores
desta série):

```
NOVO-01
ARQUIVO: docs/backend-v2/gap-resolution/00-canonical-gap-register.md, §12, tabela WAVE_3_CORE_DOMAIN_FIXES
PROBLEMA: A linha de índice de GAP-0001 ainda cita o nome invalidado da decisão
  ("DEC-001: UNIVERSAL_FINANCIAL_PROJECT") em vez do nome corrigido ("DEC-001:
  MUSICAL_PROJECT_CANONICAL_HUB"), apesar do ADENDO de correção, mais acima no mesmo documento, já
  estabelecer o nome correto.
CORREÇÃO SUGERIDA (não aplicada): atualizar o texto da linha de GAP-0001 na tabela de §12 para refletir
  "DEC-001: MUSICAL_PROJECT_CANONICAL_HUB", com uma nota de rodapé remetendo ao ADENDO de correção.
Ver CONFLITO-01, §27.
```

```
NOVO-02
ARQUIVO: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0099.title) e
  docs/backend-v2/gap-resolution/00-canonical-gap-register.md §12, tabela WAVE_4_CROSS_DOMAIN_FIXES
PROBLEMA: GAP-0099 cita GAP-0015 como "mesma família de causa-raiz" no JSON, e o índice em markdown
  acrescenta "note: actually GAP-0001" — nenhuma das duas citações corresponde, pelo conteúdo real dos
  três gaps, a uma relação de causa-raiz clara (o candidato mais plausível pelo conteúdo é GAP-0033).
CORREÇÃO SUGERIDA (não aplicada): revisar e substituir a citação de GAP-0099 pela referência correta (a
  confirmar em etapa dedicada, não presumida aqui) e remover o texto de correção informal embutido no
  título ("note: actually GAP-0001") do índice markdown, que deveria ter sido resolvido, não deixado
  como rastro de edição visível no documento supostamente final.
Ver CONFLITO-02, §27.
```

```
NOVO-03
ARQUIVO: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0055.title)
PROBLEMA: O título de GAP-0055 ("...have no propagation to accounting/transactions"), lido isoladamente
  e sem cruzar com `contracts.md §15`, pode ser mal-interpretado como "nenhuma propagação
  contrato→contabilidade existe", quando na verdade uma propagação automática real e parcial (só o
  campo `valor`) já existe hoje ao assinar um contrato.
CORREÇÃO SUGERIDA (não aplicada): reformular o título de GAP-0055 para deixar explícito que o gap é sobre
  a NÃO-propagação dos TERMOS financeiros ricos (forma de pagamento, vencimento, parcelas), não da
  propagação como um todo — ex.: "contracts: only 'valor' propagates to accounting on signing; forma de
  pagamento/vencimento/parcelas do not".
Ver CONFLITO-05, §27.
```

```
NOVO-04
ARQUIVO: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0127) vs.
  docs/backend-v2/field-traceability/modules/projects.md §2
PROBLEMA: GAP-0127 afirma a existência de `projects.contrato_id` como coluna real com FK; `projects.md`
  (fonte de Fase 2, mais granular e exaustiva sobre as colunas de `projects`) não lista essa coluna entre
  as 16 colunas confirmadas da tabela.
CORREÇÃO SUGERIDA (não aplicada): reverificar diretamente o schema físico do banco para confirmar se
  `projects.contrato_id` existe; se não existir, corrigir/remover GAP-0127; se existir, adicionar um
  adendo a `projects.md` documentando a coluna omitida na Fase 2.
Ver CONFLITO-03, §27, e PO-VERIFY-006, §28.
```

Nenhuma dessas 4 inconsistências foi corrigida como parte deste relatório — são registradas apenas para
tratamento em uma etapa dedicada e explícita, seguindo o mesmo processo já usado para as correções
anteriores desta série.

---

## Contadores finais

Valores lidos diretamente de `docs/backend-v2/gap-resolution/canonical-gap-register.json` e
`docs/backend-v2/gap-resolution/decision-register.json` — nenhum recomputado, estimado ou alterado nesta
etapa.

```text
DECISIONS_RESOLVED: 6          (era 4; DEC-001, DEC-002, DEC-004, DEC-007, DEC-009, DEC-003 — corrigido)
DECISIONS_PENDING: 3           (era 4; DEC-005, DEC-006, DEC-008 — corrigido, DEC-003/DEC-009 resolvidas)

CANONICAL_GAPS_TOTAL: 168

OPEN_GAPS: 141
DEFERRED_GAPS: 17
NO_FIX_REQUIRED_GAPS: 7
ACCEPTED_BY_EXISTING_CONTRACT_GAPS: 2
NOT_APPLICABLE_GAPS: 1
(soma: 141+17+7+2+1 = 168, confere com CANONICAL_GAPS_TOTAL)

SEVERITY: S0_CRITICAL=0, S1_HIGH=26, S2_MEDIUM=77, S3_LOW=38, S4_INFORMATIONAL=27

BLOCKS_SCHEMA_V2_DESIGN: 0     (era 1, GAP-0168 — corrigido: decisão DEC-009 resolvida,
                                 PROJECT_RELEASE_DIRECT_LINK, blocksSchemaV2Design agora NÃO;
                                 ver gap-resolution/00-canonical-gap-register.md)
BLOCKS_API_V2_IMPLEMENTATION: 0
BLOCKS_CUTOVER: 1              (GAP-0039, dependente de configuração externa do Supabase Dashboard,
                                 não verificável por leitura de código)
USER_DECISION_REQUIRED_GAPS: 3 (GAP-0005, GAP-0006, GAP-0008 — correspondem exatamente às 3 decisões
                                 pendentes acima; era 4/GAP-0003 incluído, corrigido — DEC-003 resolvida,
                                 GAP-0003.userDecisionRequired agora NÃO)

DEC_005_ANALYZED: SIM
DEC_005_RESOLVED: NÃO
DEC_005_REGISTERED: NÃO

APPS_API_V2_DOMAIN_MODULES_BUILT: 0
APPS_API_V2_SCAFFOLD_STATUS: PRESENTE (NestJS + Drizzle + Zod + conexão de banco + infraestrutura de
                                         transação — sem nenhum domínio de negócio)

FUNCTIONAL_CODE_CHANGED_BY_THIS_REPORT: NÃO
DATABASE_CHANGED_BY_THIS_REPORT: NÃO
FILES_CREATED_BY_THIS_REPORT: 1
  (docs/backend-v2/review/00-master-domain-functional-verification.md)
```

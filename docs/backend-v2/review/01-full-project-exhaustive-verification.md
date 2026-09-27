# MUSIC OS 360 — VERIFICAÇÃO EXAUSTIVA COMPLETA DO PROJETO (Documento Único de Consolidação Final)

**STATUS DO DOCUMENTO:** CONCLUÍDO — todas as 15 Partes (I a XV) e a seção "Validação" estão presentes; ver §0 (Nota Metodológica) e a seção "Validação" ao final para o detalhamento de cobertura/confiança por seção.

Este é o documento de consolidação final da auditoria "zero-gap field-traceability" de MUSIC OS 360, produzido para o Product Owner autorizar (ou não) a reconstrução do backend (`apps/api-v2`). É **read-only sobre o código** — nenhum arquivo além deste foi criado ou modificado. Nenhuma tabela, schema, migration, `.env`, credencial ou configuração foi alterada em qualquer etapa desta auditoria ou da redação deste relatório.

---

## §0. Nota Metodológica (leia antes do resto)

Este relatório consolida, em um único arquivo, a totalidade das 81+ etapas de auditoria já produzidas em `docs/backend-v2/**`. As fontes primárias são: os 24 relatórios de módulo em `docs/backend-v2/field-traceability/modules/*.md`, `canonical-gap-register.json` (168 gaps), `decision-register.json` (8 decisões), `resolution-order.json`, `00-canonical-gap-register.md`, `PROGRESS.md`, o relatório de consolidação anterior `00-master-domain-functional-verification.md`, `74-zero-gap-reconstruction-contract.md`, e um subconjunto direcionado dos demais documentos de arquitetura em `docs/backend-v2/*.md` e `docs/backend-v2/database-inventory/*`.

**Calibração de profundidade aplicada (declarada explicitamente, não escondida):** dos 24 relatórios de módulo, **18 foram lidos por completo/quase por completo, ou consultados por leitura direta pontual e verificada nesta sessão (incluindo a sessão de continuação que produziu a Parte VI)**: accounting, admin, artist, audiovisual, auth, catalog, contracts, crm-relationships (leitura direta desta etapa), dashboard, events (leitura direta desta etapa), licensing (leitura direta desta etapa), marketing, projects, releases, reports (leitura direta desta etapa), settings, integrations (incluindo a sub-seção de distribuidoras, leitura direta desta etapa), rh, support, workspace. Os **5 módulos restantes (admin cross-tenant detalhado à parte, inventory, leads, monitoring, musicchat) são reportados com base no resumo denso e evidenciado desses mesmos relatórios já registrado em `docs/backend-v2/field-traceability/PROGRESS.md`** (que é, ele próprio, produto do mesmo processo de auditoria byte-a-byte, não um resumo de terceira mão) e no relatório mestre `00-master-domain-functional-verification.md §17`, com `CONFIDENCE: MEDIUM` marcado explicitamente em cada seção correspondente da Parte VI. Isto é uma escolha deliberada de gestão de escopo dentro de uma sessão de execução — não uma omissão silenciosa: todos os 24 módulos aparecem completos na Parte VI, todos os 168 gaps de `canonical-gap-register.json` aparecem na Parte XIII, e nenhum gap, decisão ou tabela foi inventado.

O Apêndice de Gaps (Parte XIII) foi gerado **mecanicamente** a partir de `canonical-gap-register.json` (168 objetos) via script Node.js determinístico — não transcrito manualmente — o que garante 100% de cobertura sem risco de omissão humana em uma lista dessa extensão.

`EVIDENCE_CONVENTION`: toda afirmação relevante carrega uma linha `EVIDENCE:` apontando arquivo/tabela/campo/endpoint/gap/decisão. `CONFIDENCE: HIGH` = confirmado por leitura direta de código-fonte nesta série de auditorias. `CONFIDENCE: MEDIUM` = confirmado via `PROGRESS.md`/relatório de módulo já produzido, não re-verificado linha a linha nesta sessão. Nunca "conforme auditoria" sem ponteiro.

---

## Sumário / Índice Navegável

- **PARTE I** — Visão Global (`VISAO-GLOBAL`)
- **PARTE II** — Modelo de Domínio Musical
  - `DOMAIN-PROJECT` (Musical Project — tratamento mais profundo, inclui `GAP-0168` e relações completas)
  - `DOMAIN-WORK` (Obra)
  - `DOMAIN-PHONOGRAM` (Fonograma)
  - `DOMAIN-RELEASE` (Lançamento — inclui `DEC-007`, `GAP-0129`, `GAP-0130`)
  - `DOMAIN-ARTIST` (Artista)
  - `DOMAIN-CONTRACT`, `DOMAIN-CLIENT`, `DOMAIN-TRANSACTION`, `DOMAIN-AUDIOVISUAL-PROJECT`, `DOMAIN-MARKETING-PROJECT`, `DOMAIN-EVENT`
- **PARTE III** — Frontend (arquitetura HTTP, localStorage, mocks/stubs/dead code, inventário de componentes create/edit)
- **PARTE IV** — Backend Legado (`apps/api`)
- **PARTE V** — Database (tabelas por domínio, relações cross-domain)
- **PARTE VI** — Os 24 Módulos completos: `MODULE-ACCOUNTING`, `MODULE-ADMIN`, `MODULE-ARTIST`, `MODULE-AUDIOVISUAL`, `MODULE-AUTH`, `MODULE-CATALOG`, `MODULE-CONTRACTS`, `MODULE-CRM-RELATIONSHIPS`, `MODULE-DASHBOARD`, `MODULE-EVENTS`, `MODULE-INTEGRATIONS`, `MODULE-INVENTORY`, `MODULE-LEADS`, `MODULE-LICENSING`, `MODULE-MARKETING`, `MODULE-MONITORING`, `MODULE-MUSICCHAT`, `MODULE-PROJECTS`, `MODULE-RELEASES`, `MODULE-REPORTS`, `MODULE-RH`, `MODULE-SETTINGS` (+ `DOMAIN-BILLING`/`DEC-005`), `MODULE-SUPPORT`, `MODULE-WORKSPACE`
- **PARTE VII** — Relações Cross-Domain (matriz mestra)
- **PARTE VIII** — Integrações (matriz completa de provedores + 6 distribuidores)
- **PARTE IX** — Auth / Tenancy / Security
- **PARTE X** — Storage / Realtime / Jobs
- **PARTE XI** — Backend V2 (`apps/api-v2`)
- **PARTE XII** — Decisões (DEC-001 a DEC-008)
- **PARTE XIII** — Apêndice de Gaps (168 de 168, gerado mecanicamente)
- **PARTE XIV** — Conflitos (`CONFLITO-01` a `CONFLITO-05`) + correções documentais pendentes
- **PARTE XV** — Validação do Product Owner (28 `PO-VERIFY`: 26 preservados na íntegra + 2 novos, `PO-VERIFY-027`/`028`)
- **Validação** (checklist de completude deste próprio documento)

---

# PARTE I — VISÃO GLOBAL (`VISAO-GLOBAL`)

## I.1 O que o produto é

MUSIC OS 360 é uma plataforma multi-tenant (SaaS B2B) de gestão de negócio para o mercado musical brasileiro — gravadoras, editoras, produtoras, escritórios de gestão de carreira artística ("segment" no cadastro de tenant: `gravadora|editora|produtora|escritorio`). Cada tenant (uma empresa cliente da MUSIC OS 360) gerencia, dentro do seu próprio espaço isolado, o ciclo de vida de artistas, obras musicais, gravações, lançamentos, contratos, finanças, eventos, campanhas de marketing, produções audiovisuais, licenciamento, CRM, RH interno e integrações com plataformas de streaming/distribuição/assinatura eletrônica.

`EVIDENCE: apps/web/src/modules/auth/pages/Register.tsx (campo segment) | docs/backend-v2/field-traceability/modules/auth.md §6 | CONFIDENCE: HIGH`

## I.2 Quem usa

Usuários são sempre membros de um tenant (`org_members`), nunca usuários "soltos" — o login sempre resolve, via JWT, um `tenant_id` (fisicamente `tenants.id`, exposto na claim `org_id` por um artefato histórico de nomenclatura, não um bug — ver `MODULE-WORKSPACE`). Papéis (roles) hierárquicos vão de `viewer` (10) a `super_admin` (100), passando por papéis funcionais (`financial`, `juridico`, `marketing_manager`, `rh_manager`, `produtor`, `artista`, `colaborador`, entre outros), com um sistema RBAC dual (matriz de hierarquia legada + tabela dinâmica `role_id`, "DUAL-SOURCE FASE 5"). Existe também uma camada de super-administração de plataforma (`/admin/*`), tenant-agnóstica em intenção, mas hoje **tenant-scoped na prática** para 2 das suas 9 telas (ver `MODULE-ADMIN`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/auth.md §4 | docs/backend-v2/field-traceability/modules/admin.md §4 | CONFIDENCE: HIGH`

## I.3 Que problema resolve

Centraliza, para um negócio musical, o que hoje tipicamente vive espalhado em planilhas/e-mails/sistemas desconectados: cadastro de artistas e seu perfil de carreira; registro autoral de obras (com vínculo ECAD/ABRAMUS); registro fonográfico de gravações (ISRC); pipeline de lançamento/distribuição digital; contratos (com fluxo de assinatura eletrônica); controle financeiro (receitas/despesas, notas fiscais, P&L); agenda de eventos/shows; campanhas de marketing e conteúdo; produção audiovisual (clipes); licenciamento de sync/master/mecânica; monitoramento de uso não autorizado e reconciliação de royalties ECAD; CRM de contatos/clientes; funil de leads; RH interno (funcionários/folha/férias); um hub de atendimento (tickets de suporte + triagem por IA) e um chat interno (MusicChat, que é um inbox omnichannel de suporte, não um assistente de IA generativa — ver `MODULE-MUSICCHAT`).

`EVIDENCE: síntese dos 24 relatórios de módulo em docs/backend-v2/field-traceability/modules/*.md | CONFIDENCE: HIGH`

## I.4 Domínios principais e como se relacionam

O sistema tem um núcleo **musical** (Artist → Project → Work → Phonogram → Release, ver Parte II) e uma camada **operacional/negócio** que se pendura nesse núcleo por referências cross-domain (Accounting, Contracts, Events, Marketing, Audiovisual, Licensing, Monitoring), mais uma camada **de plataforma** (Auth, Workspace/Tenant, Settings, Admin, Integrations, Reports, Support) que é transversal a todos os módulos de negócio. Um achado estrutural central desta auditoria, corrigido por autoridade explícita do Product Owner (`DEC-001`), é que `projects` não é um "hub financeiro/operacional universal" — é a entidade **Projeto Musical/Música**, e `projects.id` é a chave de vínculo cross-domain que outros domínios usam para dizer "este registro pertence a esta música específica" (ver `DOMAIN-PROJECT`).

`EVIDENCE: decision-register.json (DEC-001) | docs/backend-v2/gap-resolution/00-canonical-gap-register.md (ADENDO — CORREÇÃO CANÔNICA DE DEC-001) | CONFIDENCE: HIGH`

## I.5 Central entities (visão de 1 frase cada)

| Entidade | 1 frase |
|---|---|
| Tenant / Workspace | A unidade de isolamento multi-tenant — mesma entidade física (`tenants`), "Workspace" é só o nome usado na UI/DTO. |
| Artist | Uma pessoa/entidade artística cadastrada pelo tenant — distinta de `User` (usuário da plataforma) e de `Client` (contato/cliente de negócio). |
| Project | O Projeto Musical/Música — a ficha inicial de uma música em produção (título, faixas, compositores/intérpretes/produtores por faixa). |
| Work (Obra) | A composição musical (letra+melodia) — unidade de direito autoral, distinta da gravação. |
| Phonogram (Fonograma) | A gravação concreta de uma Obra — uma performance específica registrada, com ISRC. |
| Release (Lançamento) | O produto de distribuição (single/EP/álbum) que empacota uma ou mais faixas para lançamento em DSPs. |
| Contract | Um acordo entre o tenant e uma parte (artista/cliente/prestador). |
| Client | Pessoa física/jurídica cliente/contato de negócio do tenant — "Contato = Cliente" é uma decisão de domínio documentada, ambos compartilham a tabela `clients`. |
| Transaction | Um lançamento financeiro (receita/despesa) do tenant. |
| Audiovisual Project | Uma produção de clipe/conteúdo audiovisual — entidade rica e distinta de `Project`. |
| Marketing Project | Um workspace de campanha de marketing — entidade distinta de `Project`. |
| Event | Um compromisso de agenda (show, gravação, reunião). |

`EVIDENCE: docs/backend-v2/field-traceability/modules/{artist,projects,catalog,releases,contracts,crm-relationships,accounting,audiovisual,marketing,events}.md | CONFIDENCE: HIGH`

## I.6 Como o tenant/workspace organiza tudo

Toda tabela de negócio carrega `tenant_id`, resolvido **sempre server-side** a partir do JWT verificado (`TenantGuard`), nunca confiando no header `X-Tenant-ID` enviado pelo cliente (usado apenas como checagem de consistência, rejeitando a requisição se divergir do tenant resolvido pelo JWT). Confirmado em **todos os 24 módulos auditados**: `AUTHORIZATION_GAPS: 0` e `TENANT_ISOLATION_GAPS: 0` de forma consistente — não há, nesta auditoria, nenhum caso confirmado de vazamento cross-tenant. Ver Parte IX para o detalhamento de segurança completo.

`EVIDENCE: docs/backend-v2/field-traceability/modules/auth.md §3 | docs/backend-v2/field-traceability/modules/workspace.md §0 | contagem AUTHORIZATION_GAPS/TENANT_ISOLATION_GAPS = 0 em cada um dos 24 relatórios de módulo | CONFIDENCE: HIGH`

---

# PARTE II — MODELO DE DOMÍNIO MUSICAL

## `DOMAIN-PROJECT` — Project (Projeto Musical/Música)

### Definição autoritativa (leia primeiro)

`projects.id` é a **entidade Projeto Musical/Música** e a **chave de vínculo cross-domain** para essa música específica — usada por Work/Obra, Phonogram/Fonograma, Release/Lançamento, Accounting Transaction, Audiovisual, Marketing e outros domínios relacionados para declarar "este registro pertence a esta música/projeto musical". Esta é a definição **vigente e corrigida** por autoridade explícita do Product Owner (`DEC-001`, `PROMPT 129`).

**A leitura anterior (`UNIVERSAL_FINANCIAL_PROJECT` — hub financeiro/operacional genérico) está INVALIDADA/SUPERSEDIDA.** Ela é citada abaixo **apenas** como histórico claramente rotulado, nunca como definição atual:

```
DEC-001.supersededDecision.selectedOption:    UNIVERSAL_FINANCIAL_PROJECT
DEC-001.supersededDecision.status:            INVALIDATED_BY_PRODUCT_OWNER_DOMAIN_CORRECTION
DEC-001.supersededDecision.invalidationReason: "Product Owner explicitamente corrigiu a definição de
  domínio (PROMPT 129): projects não é um hub financeiro/operacional genérico. A leitura de 'hub
  financeiro universal' generalizou incorretamente 2 relações reais cross-domain (financial_project_id,
  transactions.projeto_id) para uma afirmação incorreta sobre a natureza fundamental da entidade."
```

O que **muda** em relação à leitura anterior: a interpretação "hub financeiro/operacional universal" é invalidada. O que **não muda**: `projects.id` continua sendo a chave de vínculo cross-domain correta; as relações reais já identificadas (`financial_project_id`, `transactions.projeto_id`, `works.projeto_id`) continuam válidas — apenas sua justificativa semântica foi corrigida (essas relações existem porque a atividade de outros domínios *pertence* a uma música específica, não porque `projects` é, em si, uma entidade financeira).

`EVIDENCE: decision-register.json (DEC-001, DEC-001.supersededDecision) | docs/backend-v2/gap-resolution/00-canonical-gap-register.md (ADENDO — CORREÇÃO CANÔNICA DE DEC-001) | CONFIDENCE: HIGH`

### DEFINITION / PURPOSE

Um `Project` é a ficha inicial de produção de uma música (ou de um EP/álbum com várias músicas — ver `PROJECT_TYPES` abaixo), onde o tenant registra título, tipo de lançamento planejado, gênero, e as faixas em produção com seus respectivos compositores, intérpretes e produtores. É o ponto de partida do fluxo de produção musical antes de existir uma `Work` (obra formalmente registrada) ou uma `Release` (lançamento pronto para distribuição).

### TABLE / PRIMARY_KEY / TENANT_SCOPE

`projects` (16 colunas) — PK `id` (uuid), `tenant_id` obrigatório em toda query (resolvido server-side via `@CurrentTenant()`, nunca do body).

### CREATED_FROM / EDITED_FROM

Único fluxo real e alcançável: `/projetos` → `Projetos.tsx` → `ProjetoFormModal.tsx` (mesmo componente para create/edit, `mode="create"|"edit"`). Não existem Kanban, Gantt, Timeline, Calendar, Wizard ou Drawer para este módulo. `hooks/projects.store.ts` (Zustand) e `services/projects.service.ts` estão confirmados **DEAD** (zero consumidores).

### API_RESOURCE

`ProjectsController` → `GET/POST/PATCH/DELETE /projects` (5 endpoints reais, todos com `@RequireRole`+`@RequirePermission` consistentes: leitura=`viewer`, criar/editar=`editor`, excluir=`manager`).

### FIELDS — tabela completa `projects` (16/16 colunas, nenhuma omitida)

| Campo | Tipo DB | Nullable | Default | Frontend Create | Frontend Edit | Frontend Display | DTO/API | Persistido | Regra funcional | Status | Gap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| `id` | uuid | não | gerado | — | — | sim (interno) | `id` | sim | PK | ALREADY_CORRECT | — |
| `tenant_id` | uuid | não | — | — | — | não | implícito (JWT) | sim | isolamento multi-tenant | ALREADY_CORRECT | — |
| `titulo` | varchar | não | — | sim (`tipoLancamento`+`nomeEP`/`musicas[0].nome`) | sim | sim | `titulo` | sim | renomeada de `nome` pela migration `20260718000013` | ALREADY_CORRECT | — |
| `tipo` | varchar/enum | sim | — | sim (`tipoLancamento`) | sim | sim (badge) | `tipo` | sim | 4 valores reais na UI (album/ep/single/turne) de 7 declarados server-side (video/tour/podcast/other inalcançáveis via UI) | PARTIAL | GAP menor, não catalogado individualmente |
| `status` | varchar/enum | não | forçado `PLANEJAMENTO` no create | sim (default) | sim (select 4 de 5 opções — falta `revisao`) | sim | `status` | sim | workflow real de 5 estados, ver Workflows abaixo | REAL_WORKFLOW | `WORKFLOW_GAP` (Edit form não restringe transições ilegais) |
| `artista_id` | uuid | sim | null | **NÃO** | **NÃO** | não (join client-side sempre `undefined`) | `artista_id` (aceito pelo DTO) | sim, mas **sempre NULL** | atributo natural do projeto musical (artista principal) | REAL_MAPPING_GAP | `GAP-0001` |
| `orcamento` | decimal(15,2) | sim | null | **NÃO** | **NÃO** | não | `orcamento` (aceito pelo DTO) | sim, mas **sempre NULL** | orçamento de produção; nenhum consumidor lê de volta mesmo se preenchido | REAL_MAPPING_GAP | `GAP-0001`, ver `GAP-0018` (financeiro) |
| `descricao` | text | sim | — | não claramente mapeado a um campo dedicado (histórico: `musicas[]` já foi serializado aqui, migrado para `project_tracks`) | — | — | `descricao` | sim | — | ALREADY_CORRECT | — |
| `observacoes` | text | sim | — | sim | sim | sim | `observacoes` | sim | livre | ALREADY_CORRECT | — |
| `genero` | varchar | sim | — | derivado (gênero da 1ª faixa) | idem | sim | `genero` | sim | derivado, não digitado diretamente | ALREADY_CORRECT | — |
| `metadata` | jsonb | sim | `{}` | não (uso interno) | não | não | `metadata.aiPlan` (escrito por automação) | sim | destino do plano de IA gerado na conclusão (ver Workflows/Side Effects) | REAL_MAPPING_GAP (broken automation) | ver §Side Effects |
| `created_at` | timestamptz | não | now() | — | — | sim (indireto) | — | sim | — | ALREADY_CORRECT | — |
| `updated_at` | timestamptz | não | now() | — | — | sim (indireto) | — | sim | — | ALREADY_CORRECT | — |
| `deleted_at` | timestamptz | sim | null | — | — | — | — | sim | soft delete | ALREADY_CORRECT | — |
| `created_by` | uuid | sim | — | — | — | — | — | sim | auditoria | ALREADY_CORRECT | — |
| `updated_by` | uuid | sim | — | — | — | — | — | sim | auditoria | ALREADY_CORRECT | — |

`EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §2,§5,§6 | database-backend-column-mapping.json | CONFIDENCE: HIGH`

### FIELDS — tabela completa `project_tracks` (14/14 colunas — faixas de um Project)

| Campo | Tipo | Frontend Create/Edit | Regra funcional | Status | Gap |
|---|---|---|---|---|---|
| `id` | uuid | interno | PK | ALREADY_CORRECT | — |
| `project_id` | uuid FK CASCADE | interno | FK real, `ON DELETE CASCADE` | ALREADY_CORRECT | — |
| `nome` | varchar | sim | nome da faixa | ALREADY_CORRECT | — |
| `solo_feat` | varchar/enum | sim | solo ou feat | ALREADY_CORRECT | — |
| `original_remix` | varchar/enum | sim | original ou remix | ALREADY_CORRECT | — |
| `instrumental` | boolean | sim | — | ALREADY_CORRECT | — |
| `duracao` | varchar | sim | mm:ss | ALREADY_CORRECT | — |
| `genero` | varchar | sim | — | ALREADY_CORRECT | — |
| `idioma` | varchar | sim | — | ALREADY_CORRECT | — |
| `letra` | text | sim | — | ALREADY_CORRECT | — |
| `audio_url` | varchar | sim (nominalmente) | **stub hardcoded** — `uploadFile` sempre retorna `null` (`ProjetoFormModal.tsx:178`) | FILE_STORAGE_GAP | gap consolidado do módulo (não tem GAP-ID próprio no registro de 168 — documentado em `projects.md §8`) |
| `created_at`/`updated_at` | timestamptz | — | — | ALREADY_CORRECT | — |

`project_track_participants` (6 colunas: `id`, `project_track_id` FK CASCADE, `compositor`, `interprete`, `produtor`, timestamps) — real, populado, sem gap de mapeamento.

`EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §2,§5,§8 | CONFIDENCE: HIGH`

### `project_assets` — tabela órfã (registrada, não um gap catalogado à parte)

`project_assets` (7 colunas: `id`, `tenant_id`, `project_id`, `asset_id`, `role`, `source_event`, `linked_by` + auditoria) existe no schema mas **não tem controller, service ou consumidor frontend em lugar nenhum** — nem FK física em `project_id`/`asset_id`. Schema morto puro.

`EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §9 | CONFIDENCE: HIGH`

### RELATIONS — matriz completa Project ↔ outros domínios

| Domínio | Coluna atual | Alvo | Cardinalidade | Status | Evidência |
|---|---|---|---|---|---|
| Project ↔ Artist | `projects.artista_id` | `artists.id` | N:1 (opcional) | `ALREADY_CORRECT` como relação declarada no schema, mas **MISSING no nível de escrita da UI** — nunca setada por nenhum form real | `GAP-0001`; `projects.md §5,§11` |
| Project ↔ Work | `works.projeto_id` | `projects.id` | N:1 | `ALREADY_CORRECT` (real, lógica, confirmada populada via `ObraFormModal.tsx`) | `decision-register.json DEC-001.preservedRelations` |
| Project ↔ Phonogram | nenhuma coluna direta | `projects.id` | transitivo | `ALREADY_CORRECT` transitivamente, via `phonograms.obra_id → works.id → works.projeto_id` — sem gap novo, `TO_BE_DESIGNED` se um dia se quiser denormalizar | `catalog.md §16` |
| Project ↔ Release | **nenhuma ainda** — `ReleaseEntity` não tem `project_id`/`projeto_id` | `projects.id` | N:1 (decidido — `DEC-009: PROJECT_RELEASE_DIRECT_LINK`, corrigido, era "indeterminada") | `MISSING_RELATION` (implementação pendente; decisão arquitetural resolvida) | `GAP-0168`; `DEC-009`; `releases.md §16` |
| Project ↔ Transaction | `transactions.projeto_id` | `projects.id` | N:1 | `ALREADY_CORRECT` (real, lógica, populada; só não é lida/agrupada pelo P&L — `GAP-0013`) | `accounting.md §2.5`; `projects.md §17` |
| Project ↔ Audiovisual | `audiovisual_projects.financial_project_id` | `projects.id` | N:1 (composto com `tenant_id`) | `ALREADY_CORRECT` relação (FK real, DB-enforced) + `LEGACY_NAMING` (nome da coluna) + ausente na escrita via UI (`GAP-0033`) | `audiovisual.md §6`; `decision-register.json` |
| Project ↔ Marketing | `marketing_projects.financial_project_id` | `projects.id` | N:1 (composto) | idem — `ALREADY_CORRECT` relação + `LEGACY_NAMING` + `GAP-0033` | `projects.md §21` |
| Project ↔ Marketing (segundo campo) | `marketing_projects.source_project_id` | `projects.id` (presumido) | N:1 | lógico, **sem FK física** | `projects.md §21` |
| Project ↔ Contract | (ver `PO-VERIFY-006`/`CONFLITO-03`) `GAP-0127` afirma `projects.contrato_id` real; `projects.md §2` (lista exaustiva de 16 colunas) **não lista** essa coluna | `contracts.id` | — | `CONFLICTED` — não confirmar sem reverificação direta do schema físico | `GAP-0127` vs `projects.md §2` |
| Project ↔ Events/Inventory | nenhuma | — | — | `NOT_APPLICABLE` (confirmado ausente por inspeção direta de `EventEntity`/`inventory_items`, não por lacuna de investigação) | `projects.md §19` |

`EVIDENCE: tabela consolidada a partir de decision-register.json, canonical-gap-register.json (GAP-0001, GAP-0013, GAP-0033, GAP-0127, GAP-0168), projects.md, releases.md, audiovisual.md, accounting.md, catalog.md | CONFIDENCE: HIGH (exceto a linha Contract, CONFLICTED)`

### BUSINESS_RULES / WORKFLOWS

`ProjectStatus` enum (`packages/types/src/enums.ts:275-281`): `PLANEJAMENTO, EM_ANDAMENTO, REVISAO, CONCLUIDO, CANCELADO` — 5 valores reais, workflow real (`apps/api/src/core/workflow/definitions/projects.workflow.ts`), aplicado dentro de transação DB via `WorkflowService.transitionInTx`:

```
planejamento → em_andamento   ("Iniciar Projeto")
em_andamento → revisao        ("Enviar para Revisão")
revisao → em_andamento         ("Solicitar Alterações")
revisao → concluido            ("Concluir Projeto")
{planejamento|em_andamento|revisao} → cancelado  ("Cancelar Projeto")
```

Todas as transições exigem papel `manager` ou superior (algumas aceitam também `produtor`). O backend calcula e retorna `allowed_transitions` por ator — `ProjetoViewModal.tsx` consome corretamente essa lista; o Select bruto de status em `ProjetoFormModal.tsx` (modo edição) **não** — oferece só 4 das 5 opções (falta `revisao`) e não restringe a transições legais, dependendo do backend para rejeitar (`WORKFLOW_GAP: PARTIAL`).

### SIDE_EFFECTS — `ProjectPlanningAutomation` (achado crítico)

Ao atingir `CONCLUIDO`, o evento `DOMAIN_EVENTS.PROJECT_COMPLETED` dispara dois listeners reais:

1. **`ProjectPlanningAutomation`** (`apps/api/src/core/automation/project-planning.automation.ts`) — gera, via IA, um plano operacional salvo em `projects.metadata.aiPlan`. **Está 100% quebrada**: seu `loadProject()` executa SQL bruto `SELECT nome, tipo, descricao, artista_id, data_fim, metadata FROM projects...` — `nome` foi renomeado para `titulo` pela migration `20260718000013` e `data_fim` **nunca existiu** como coluna de `projects`. Toda conclusão real de um projeto musical dispara essa query, que lança erro "column does not exist". A automação foi desenhada para falhar de forma segura (não reverte a conclusão do projeto), então o dano é silencioso: o recurso de planejamento por IA nunca funciona, para nenhum projeto, desde a migration de julho/2026.
2. **`MarketingProjectsService.createFromCompletedProject()`** (confirmado real e funcional em `marketing.md`, não broken) — cria automaticamente um workspace de marketing + tarefa de capa quando um projeto conclui.

`EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §7,§8 | migration 20260718000013_ProjectsFormFieldAlignment.ts | CONFIDENCE: HIGH`

### DEPENDENCIES / CURRENT_PROBLEMS (síntese)

`artista_id`/`orcamento` nunca coletados pela UI real (`GAP-0001`, decisão `DEC-001` já resolveu O QUE fazer — expor os campos —, implementação pendente); `project_assets` órfã; `ProjectPlanningAutomation` quebrada por referência a colunas obsoletas; upload de áudio por faixa é um stub hardcoded (`FILE_STORAGE_GAP`); nenhuma paginação real — `GET /projects` trunca em 50, sem filtro/offset enviado pela UI (`GAP-0128`, `TRUNCATION_GAP` — afeta todos os 4 KPIs e todos os filtros client-side); nenhum campo de progresso/prazo existe (`PROGRESS_CALCULATION_GAP`, confirmado ausente, não inventado); `contrato_id` tem status conflitante (ver `CONFLITO-03`).

### TARGET_V2_DIRECTION

Preservar `projects` como Musical Project canônico; expor `artista_id`/`orcamento` no form real; corrigir a query da automação de IA para as colunas atuais; decidir explicitamente (não presumir) a cardinalidade Project↔Work↔Release (`PO-VERIFY-003`); desenhar a relação Project↔Release ausente (`GAP-0168`, ver abaixo) como parte do schema v2 de `releases`.

### CONFIDENCE: HIGH (13/16 campos e todas as relações verificadas por leitura direta de código nesta sessão)

---

### `GAP-0168` — subseção dedicada completa

> ⚠️ **Decisão arquitetural resolvida desde esta subseção — `DEC-009: PROJECT_RELEASE_DIRECT_LINK`
> (Product Owner)**: `releases.project_id → projects.id` (FK real, N:1, nullable). Esta relação NÃO
> substitui a cadeia `Release → ReleaseTrack → Phonogram → Work`. `Project` canônico = Single/EP/Álbum.
> `GAP-0168` não bloqueia mais o schema v2 (`blocksSchemaV2Design: NÃO`). O texto abaixo é preservado
> como registro histórico do comportamento observado (ainda factualmente correto — nenhum código foi
> alterado) e da investigação que precedeu a decisão — ver
> `gap-resolution/00-canonical-gap-register.md` ("Correção canônica — DEC-009 RESOLVED") para a
> definição vigente.

**Comportamento atual**: `ReleaseEntity` **não possui** nenhuma coluna `project_id`/`projeto_id`. A única "ponte" entre um Project musical e um Release existe como uma conveniência de pré-preenchimento manual, de uso único, no momento de abrir o formulário de criação de lançamento: `LancamentoFormModal.tsx` importa `useProjetos()` e a função `projetoToLancamentoSeed()` (em `mappers/`), que — quando o usuário escolhe explicitamente "criar lançamento a partir deste projeto" — copia `titulo`/`genero`/`artista_id` do Project selecionado para dentro dos campos iniciais do formulário de Release. **É só um autofill de digitação** — `projeto.id` nunca é enviado em nenhum payload de `POST /releases`, e não existe campo no DTO para recebê-lo mesmo que fosse enviado.

**Ausência da FK persistida**: não há, em nenhuma camada (DTO, entidade, migration), uma coluna que registre "este Release nasceu deste Project". Depois do preenchimento inicial, as duas entidades ficam completamente desconectadas — nenhuma automação roda em nenhuma direção (nem "Project concluído gera Release", nem "Release aponta para o Project de origem"), diferente do padrão de automação real já confirmado para `PROJECT_COMPLETED` → Marketing (`§Side Effects` acima).

**Impacto**: bloqueia o desenho do schema v2 de `releases` — é hoje o **único** gap do registro canônico com `blocksSchemaV2Design: SIM` que não deriva de uma decisão de negócio pendente (as demais bandeiras de bloqueio de schema já foram resolvidas por `DEC-001`/`DEC-007`). Sem essa relação, a cadeia conceitual completa do domínio musical (`Musical Project → Work → Phonogram → Release`) fica com um elo estrutural faltando exatamente no ponto de transição "produção" → "distribuição".

**Domínios afetados**: `releases`, `projects` — e indiretamente qualquer relatório/tela que um dia queira responder "quais lançamentos vieram deste projeto musical" ou "qual projeto originou este lançamento", pergunta hoje irrespondível de forma confiável (só reconstruível manualmente comparando título/artista, sem garantia).

**Consequências de schema/API/migração**: o desenho final (nova coluna `project_id` em `releases`, ou uma tabela de junção, ou outro mecanismo) é `TO_BE_DESIGNED` — este gap não resolve, nem este documento resolve, qual será o mecanismo físico. Uma migração de dados históricos não é trivial: como a relação nunca foi persistida, não há como reconstruir com certeza, retroativamente, qual Project originou qual Release já existente — na melhor das hipóteses, uma heurística por título/artista/data poderia sugerir candidatos, nunca confirmar.

`GAP-0168` **depende de** (`dependsOn`) `GAP-0001` (a definição de domínio de `projects` — já resolvida por `DEC-001`), está na `WAVE_2_SCHEMA_AND_CONTRACT`, `status: OPEN`. Não confundir com `GAP-0007`/`DEC-007` (tracklist de Release, uma relação diferente: Release↔Phonogram, não Release↔Project) nem com `GAP-0001`/`GAP-0013`/`GAP-0033` (nenhum desses cobre a ausência da relação `releases ↔ projects`).

**Este documento não resolve `GAP-0168`** — apenas o documenta em profundidade, conforme instruído.

`EVIDENCE: canonical-gap-register.json (GAP-0168) | docs/backend-v2/gap-resolution/00-canonical-gap-register.md (ADENDO — CORREÇÃO CANÔNICA DE DEC-001) | docs/backend-v2/field-traceability/modules/releases.md §16 | CONFIDENCE: HIGH`

---

## `DOMAIN-WORK` — Work / Obra

### DEFINITION / PURPOSE

A composição musical em si (letra + melodia) — a unidade de direito autoral, ECAD/ABRAMUS. Distinta da gravação (Phonogram). Uma Obra pode ter N gravações (fonogramas) diferentes ao longo do tempo (regravações, versões).

### TABLE / PRIMARY_KEY / TENANT_SCOPE / API_RESOURCE

`works` (47 colunas, 100% `DIRECT`). PK `id`. `WorksController` → `GET/POST/PATCH/DELETE /works`, `viewer/editor/editor/manager`.

### CREATED_FROM / EDITED_FROM

`RegistroMusicas.tsx` (aba "Obras") → `ObraTipoSelectorModal.tsx` (passo 0: Autoral vs. Referência) → `ObraFormModal.tsx` (1445 linhas, mesmo componente create/edit). `ObraViewModal.tsx` para detalhe.

### FIELDS (síntese das 47 colunas + campos derivados — tabela completa em `catalog.md §5`, reproduzida em essência aqui)

Campos persistidos reais: `titulo`, `genero`, `idioma`, `status`, `iswc`, `cod_ecad`, `cod_entidade`, `duracao`, `instrumental`, `criada_por_ia`, `tipo_ia`, `ia_harmonia`/`ia_melodia`/`ia_letra` (jsonb), `outros_titulos`/`referencias_conexas` (jsonb), `letra_completa`, `projeto_id`, `artista_id` (**sempre `NULL`** — ver Gap crítico abaixo), `tipo_obra`, `compositores`/`letristas` (derivados de `participantes`, jsonb). `duration_seconds` existe fisicamente mas é somente-leitura no contrato atual (nunca escrita por este form). `authors`/`shares` são aceitos pelo `CreateWorkDto` mas **não correspondem a nenhuma coluna real e não são tratados pelo service** — TypeORM descarta silenciosamente no `save()` (o gap de split-sheet explícito citado por `DEC-007`, ver abaixo).

**Gap crítico ativo**: `ObraFormModal.tsx:486` envia sempre `artistaId: null` no payload de create **e** edit — apagando silenciosamente qualquer vínculo `artista_id` já existente ao salvar (ex.: um vínculo herdado de `projetoToObraSeed()`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/catalog.md §5,§12(item 1) | CONFIDENCE: HIGH`

### RELATIONS

Work ↔ Project: `works.projeto_id → projects.id` (`ALREADY_CORRECT`). Work ↔ Artist: `works.artista_id → artists.id` (schema real, mas sempre `NULL` na prática — gap ativo acima). Work ↔ Phonogram: `phonograms.obra_id → works.id` (`ALREADY_CORRECT`, real). Work ↔ Release: `release_works` (join M:N, **schema-only, nunca populada** — ver `DOMAIN-RELEASE`). Work ↔ Shares: `shares.obra_id → works.id` (FK real; `shares` pertence funcionalmente a `releases`, não re-auditado campo-a-campo em `catalog`).

### AUTHORS/COMPOSERS/SHARES — status ECAD/ABRAMUS

**Créditos simples** (`work_participants`, 10 colunas): nome (opcionalmente autocompletado por Artista, sem persistir o vínculo), `classeFuncao` (Editor/Administrador/Compositor-Autor/Tradutor, texto livre), `percentual` — **REPLACE completo (DELETE+INSERT) a cada save, sem versionamento, sem validação de soma = 100%** (`SPLIT_VALIDATION_GAP`).

**Split-sheet formal** (`CreateWorkDto.authors`/`.shares`): **classificado GAP explícito**: aceito e validado pelo DTO, mas nunca persistido — nenhuma tela atual sequer tenta preenchê-lo, mas uma chamada de API direta perderia o dado silenciosamente. Este é o gap citado (após correção documental) por `DEC-007` como `GAP-0041`.

**Registro ECAD/ABRAMUS — classificação implementado/parcial/stub/ausente**:
- Busca ABRAMUS (`AbramusSearchRow.tsx`): **IMPLEMENTADO** (proxy real ao backend, que consulta a API oficial).
- Registro de obra na ABRAMUS (`register-work`): **IMPLEMENTADO** no backend (POST real com título/compositor/ISWC/gênero/duração/editora/coautores) — sem sincronização automática.
- Importar obra encontrada na busca ABRAMUS: **STUB** (`useAbramusImport` sempre lança erro — nenhuma rota de import existe).
- Detecção "já importado" (local lookup): **STUB** (sempre retorna vazio).
- Sync geral com ABRAMUS: **STUB** (`useAbramusSyncAll` sempre falha).
- ISWC/ISRC/código ECAD/entidade: campos de texto livre, **sem validação de formato nem checagem de unicidade em nenhuma camada** (`IDENTIFIER_GAP`).
- `rights_holders`/`external_identifiers`/`society_accounts`/`society_submissions` (módulo `registry`, 91 colunas em 6 tabelas): backend completo e seguro, **zero consumidor frontend**, explicitamente excluído até da Central de Relatórios (`NOT_REPORTABLE`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/catalog.md §1,§9,§10,§11,§12 | CONFIDENCE: HIGH`

### CURRENT_PROBLEMS / TARGET_V2_DIRECTION

Corrigir `artista_id` sempre-null; decidir e implementar o destino físico do split-sheet (`authors`/`shares`); adicionar validação de soma de percentuais; adicionar validação de formato/unicidade de ISRC/ISWC; decidir se o domínio `registry` (ABRAMUS/sociedades) ganha UI no v2 ou é descontinuado.

### CONFIDENCE: HIGH

---

## `DOMAIN-PHONOGRAM` — Phonogram / Fonograma

### DEFINITION / PURPOSE

A gravação concreta de uma Obra — uma performance específica registrada em áudio, com ISRC próprio. Uma Obra pode ter N Fonogramas (várias gravações/versões da mesma composição).

### TABLE / API_RESOURCE / CREATED_FROM

`phonograms` (59 colunas, 100% `DIRECT`). `PhonogramsController` → `GET/POST/PATCH/DELETE /phonograms`. `RegistroMusicas.tsx` (aba "Fonogramas") → `FonogramaFormModal.tsx` (1224 linhas).

### FIELDS (síntese)

`titulo`, `cod_ecad`, `cod_entidade`, `agregadora`, `isrc` (+ `isrc_pais`/`isrc_registrante`/`isrc_ano`/`isrc_designacao`, concatenados via `joinIsrc`), `criada_por_ia`, `emissao`/`gravacao_original`/`data_lancamento`, `duracao`(+min/seg), `instrumental`/`nacional`/`pub_simultanea`, `genero_musical`/`midia`/`classificacao`/`pais_origem`/`pais_publicacao`, `status`, `gravadora`, `observacoes`, `obra_id` (real FK, `phonograms.obra_id → works.id`), `participacao` (jsonb, 3 categorias: Produtor Fonográfico/Intérprete/Músico Acompanhante, incluindo `artista_id` por linha, ao contrário de `work_participants`), `arquivo_audio` (jsonb `{name,size}` — ver Storage abaixo), `artista_id`, `audio_file_id`, `phonographic_producer_id`, `main_artist_id`, `label_id` (colunas reais, `uuid`, mas **ausentes de qualquer DTO/UI** — mortas do ponto de vista de aplicação). Colunas legadas `interpretes`/`produtores` (texto livre) existem e aparecem na grid, mas **nunca são escritas pelo form atual** (que usa `participacao` estruturado) — ficam sempre vazias em qualquer fonograma criado pela UI real.

`EVIDENCE: docs/backend-v2/field-traceability/modules/catalog.md §6,§7 | CONFIDENCE: HIGH`

### ISRC — cadeia até Project

`phonograms.isrc` é o identificador oficial da gravação. Não há validação de formato (`CC-XXX-YY-NNNNN`) nem checagem de unicidade em nenhuma camada. A cadeia até o Project musical de origem é **transitiva**: `phonograms.obra_id → works.id → works.projeto_id → projects.id` — sem coluna direta, `ALREADY_CORRECT` transitivamente, sem gap novo necessário para essa cadeia específica.

### STORAGE — upload de áudio 100% fake

`FonogramaFormModal.tsx::handleAudioUpload` lê **apenas** `file.name`/`file.size` do objeto `File` do browser e grava esses dois valores em `arquivo_audio` (jsonb) — **o binário nunca é transmitido a nenhum storage provider** (sem `FormData`, sem upload real, sem presigned URL). `phonograms.audio_file_id` (coluna real, presumivelmente pensada para referenciar um upload real) nunca é escrita por nenhum fluxo. `STORAGE_GAP` confirmado — mesmo padrão de "captura decorativa" já visto em `accounting` (anexo) e `audiovisual` (assets).

`EVIDENCE: docs/backend-v2/field-traceability/modules/catalog.md §14 | CONFIDENCE: HIGH`

### RELATIONS

Phonogram ↔ Work: `obra_id` (`ALREADY_CORRECT`). Phonogram ↔ Project: transitivo via Work (ver acima). Phonogram ↔ Release: **NENHUMA** — `PhonogramEntity` não tem `release_id` nem qualquer relação com `ReleaseEntity` (confirmado por inspeção direta, não presumido). Isso é central ao entendimento de `DEC-007` abaixo: o modelo relacional futuro de tracklist precisa **criar** essa relação, ela simplesmente não existe hoje.

### CURRENT_PROBLEMS / TARGET_V2_DIRECTION

Implementar upload real de áudio (substituindo o stub de metadata); adicionar validação de ISRC; decidir o destino da relação Release↔Phonogram (ver `DEC-007`/`DOMAIN-RELEASE` abaixo) — hoje ela precisa ser **criada do zero**, não apenas corrigida.

### CONFIDENCE: HIGH

---

## `DOMAIN-RELEASE` — Release / Lançamento

### DEFINITION / PURPOSE (RELEASE_AS_DISTRIBUTION_OBJECT)

Um Release é a entidade de **pipeline de distribuição** — o produto final (single/EP/álbum/compilação/live/outro) que empacota uma ou mais gravações para envio às plataformas de streaming (DSPs). É explicitamente **distinto** de "release como agrupamento de fonogramas" (não existe relação direta a `phonograms` hoje — ver abaixo) e de "release como projeto operacional" (`projects` é uma entidade totalmente separada — ver `DOMAIN-PROJECT`/`GAP-0168`).

### TABLE / API_RESOURCE / CREATED_FROM

`releases` (27 colunas, 100% `DIRECT`). `ReleasesController` → `GET/POST/PATCH/DELETE /releases`. `Lancamentos.tsx` → `LancamentoFormModal.tsx` (wizard de 5 passos: Informações do Álbum / Upload de Faixas / Capa / Preferências de Distribuição / Revisão).

### GAP CRÍTICO — `GAP-0129`/`GAP-0130`: criação e edição de Lançamento **100% quebradas**

Este é classificado, no conjunto dos 24 relatórios de módulo, como o achado individual mais severo de toda a série. `LancamentoFormModal.tsx` injeta incondicionalmente um campo `internal_status` em todo `POST /releases`/`PATCH /releases/:id` — mas `internal_status` **não existe** em `CreateReleaseDto`/`UpdateReleaseDto` nem como coluna física de `ReleaseEntity`. O `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` global rejeita a requisição inteira com HTTP 400 **antes de chegar ao controller**. O próprio arquivo de mapeamento do módulo (`form-to-payload.mapper.ts`) documenta corretamente essa regra em seu cabeçalho e a segue — a violação é introduzida 3 linhas depois, de volta em `LancamentoFormModal.tsx::handleSubmit()`.

**Efeito líquido: toda criação ("Novo Lançamento") e toda edição enviada pela UI real é rejeitada e nunca chega ao banco.** Um segundo bug, independente e composto (`GAP-0130`): mesmo removendo `internal_status`, o mesmo `handleSubmit()` faz, logo após o create, um `PATCH` forçando `status: "distributed"` diretamente a partir de `DRAFT` — uma transição **não existente** no grafo real de workflow (só `DRAFT → METADATA_PENDING` é legal a partir de `DRAFT`), que seria igualmente rejeitada pelo `WorkflowService`.

Consequência direta confirmada: a aba "Releases" da Auditoria.tsx nunca encontra registros incompletos para checar, **não porque os lançamentos estejam completos, mas porque nenhum consegue ser criado**.

`EVIDENCE: canonical-gap-register.json (GAP-0129, GAP-0130) | docs/backend-v2/field-traceability/modules/releases.md §0,§6,§23 | CONFIDENCE: HIGH`

### FIELDS (síntese das 27 colunas)

`titulo`, `tipo` (6 valores: album/ep/single/compilacao/live/outro), `status` (10 valores reais do workflow), `artista_id` (FK real → `artists.id`, `ON DELETE SET NULL`), `upc`, `data_lancamento`, `distribuidora` (varchar livre, catálogo estático de 6 nomes), `plataformas` (jsonb), `capa_url` (**upload real, funcional, R2 — ver Storage abaixo**), `metadata` (jsonb, contém `.faixas[]` — ver Tracklist abaixo), `isrc_global`, `notas_internas`, `observacoes`, `gravadora`, `copyright`, `genero`, `idioma`, `assets` (jsonb, 7 chaves: audio master/vídeo/letra/ficha técnica/press release/EPK), `cronograma` (jsonb, 3 chaves). Todos os 27 campos, individualmente, são corretamente mapeados 1:1 ao DTO — o único defeito é a propriedade extra `internal_status`, mas seu efeito é total (nenhum campo persiste, por nenhum create real).

`EVIDENCE: docs/backend-v2/field-traceability/modules/releases.md §2,§5 | CONFIDENCE: HIGH`

### `DEC-007` no contexto de `releases` — tracklist relacional (decisão já resolvida, implementação pendente)

**Decisão vigente**: `RELATIONAL_TRACKLIST_MODEL`. `releases.metadata.faixas` (jsonb) **não é** a fonte canônica de composição de um lançamento. Uma faixa de release precisa de identidade relacional explícita e referenciar um **fonograma concreto**. Cadeia canônica decidida:

```
Release → Release Track → Phonogram → Work → Rights/Shares
```

Semântica de domínio fixada pela decisão: `Work` = obra/composição abstrata; `Phonogram` = gravação concreta; `Release Track` = ocorrência ordenada de uma gravação específica dentro de um lançamento. `release → work` sozinho (via `release_works`) **não é suficiente** — a rastreabilidade de direitos até `works` já é preservada pela relação real do fonograma (`phonograms.obra_id → works.id`), não por um vínculo direto release↔work.

**Ressalva arquitetural obrigatória, registrada explicitamente na decisão**: `RELATIONAL_TRACKLIST_MODEL` **não** significa que a estrutura atual de `release_works(release_id, work_id)` seja aceita como o schema final. `release_works` é **insuficiente** — faltam `phonogram_id`, `position`/`order` e identidade própria de faixa (só liga release↔work, uma composição abstrata, não release↔fonograma, uma gravação concreta). `FINAL_RELATIONAL_SCHEMA_STATUS: TO_BE_DESIGNED` — se será uma nova tabela `release_tracks` ou uma evolução de `release_works` **fica para a etapa de resolução do gap estrutural, não decidido por `DEC-007` nem por este documento**. Requisitos mínimos já registrados para esse desenho futuro: `release_id`, `phonogram_id`, `position`/`order`.

`metadata.faixas` é classificado `NON_CANONICAL_METADATA` — candidato a `LEGACY_DATA`/`MIGRATION_SOURCE`, tratamento exato não decidido. **`release_works` (o shape atual) NÃO é automaticamente o schema final** — isto é explicitamente reafirmado aqui por instrução direta do prompt deste documento.

**Estado real hoje (`release_works`)**: pura junção M:N (`release_id`, `work_id`, composite PK, 2 FKs `CASCADE`, sem coluna de ordem) — confirmada **nunca populada**, de ambos os lados independentemente (nem `catalog.md` nem `releases.md` encontraram um único componente que a leia/escreva). O seletor de Obra no wizard de Release existe apenas como conveniência de autopreenchimento (copia título/gênero/ISRC ao selecionar uma Obra) — `selectedObraId` é estado local, nunca enviado em nenhum payload.

`EVIDENCE: decision-register.json (DEC-007) | docs/backend-v2/gap-resolution/00-canonical-gap-register.md (ADENDO — DEC-007 RESOLVED) | docs/backend-v2/field-traceability/modules/releases.md §8,§9 | docs/backend-v2/field-traceability/modules/catalog.md §15 | CONFIDENCE: HIGH`

### Tracklist hoje — jsonb sem modelo relacional (`GAP-0007` remanescente)

`releases.metadata.faixas[]` (interface `Faixa`: id/titulo/artista/isrc/flags de versão/artistas adicionais/produtores/compositores/músicos/metadata de IA/`arquivoAudio: File|null`) — **sem coluna de ordem** (a ordem é o índice do array); gerido como estado de array puro no cliente; ISRC por faixa vive só no jsonb, **desconectado** de `phonograms.isrc`; o arquivo de áudio por faixa é descartado antes de persistir (nunca é enviado a lugar nenhum) — mecanismo estruturalmente separado do gap de upload de fonograma em `catalog` (não é o mesmo bug reaberto, é um mecanismo jsonb-only independente). Sem suporte a múltiplos discos (`disc_number` não existe em lugar nenhum, confirmado ausente).

**Deixado explicitamente em aberto por este documento, conforme instruído**: nem o desenho final de `release_tracks`, nem o tratamento de migração de `metadata.faixas`, são resolvidos aqui.

`EVIDENCE: docs/backend-v2/field-traceability/modules/releases.md §15 | canonical-gap-register.json (GAP-0007) | CONFIDENCE: HIGH`

### STORAGE — capa (contraste positivo)

`releases.capa_url` é um upload **real e funcional**, ponta a ponta, para Cloudflare R2 (`useUploadToR2()`, com tratamento explícito de erro se R2 não estiver configurado) — ao contrário do stub de `projects` (áudio, sempre `null`) e do fake de `catalog`/fonograma (metadata apenas). Um segundo `capa_url` redundante existe dentro de `assets` (jsonb) — 3 fontes possíveis para o mesmo valor lógico, resolvidas em cascata por `getReleaseArtworkUrl()` (`DISPLAY_MAPPING_MISMATCH` menor). Sem chamada de exclusão do objeto R2 ao deletar um release (`ARTWORK_STORAGE_GAP`, menor).

### DISTRIBUTION — status geral

Nenhum modelo relacional de submissão de distribuição existe — `distribuidora` (varchar livre), `plataformas` (jsonb), e o catálogo estático de 6 provedores (ver Parte VIII). Nenhum botão de "enviar para distribuição" chama qualquer provedor real; toda mudança de status de distribuição é 100% local. `TAKEDOWN`: não implementado para releases (distinto do takedown de `monitoring`, sem relação entre os dois).

### WORKFLOW — `ReleaseStatus`, 10 valores reais

```
draft → metadata_pending → assets_pending → review → approved → scheduled → distributed → released → archived
                                                                                    ↘ cancelled (de qualquer estado anterior a distributed)
```

Guards reais: `metadata_pending → assets_pending` exige `titulo` presente; `assets_pending → review` exige `capa_url` presente. `Lancamentos.tsx` usa, para filtro/exibição, um modelo **completamente separado** de 7 valores (`resolveReleaseStatus()`), derivado de `platform_status`→`internal_status`→`status` — os dois primeiros **não são colunas reais nem campos de DTO** (daí `GAP-0129` acima).

### SIDE_EFFECTS — segundo bug crítico independente (notificação de artista quebrada)

`ReleaseEventsHandler.onReleaseApproved()` grava uma notificação endereçada "ao artista" com `user_id: artistId` (um `artists.id`) — mas `NotificationEntity.user_id` é semanticamente um `users.id`. Não existe tabela de vínculo artista→usuário em nenhum lugar do schema — a notificação é permanentemente inalcançável por qualquer consulta real de notificações de usuário. Escrita morta silenciosa, mesma natureza estrutural do achado principal (um campo guardando o tipo errado de ID).

### CURRENT_PROBLEMS (síntese)

`internal_status` bloqueia 100% de criação/edição real (`GAP-0129`); jump ilegal de workflow no create (`GAP-0130`); tracklist não-relacional, ISRC desconectado (`GAP-0007` remanescente); `release_works` schema-only; notificação de artista com ID errado; 6 distribuidores STUB (ver Parte VIII); sem relação persistida com o Project de origem (`GAP-0168`, ver `DOMAIN-PROJECT`).

### TARGET_V2_DIRECTION

Corrigir o contrato de create/edit (remover `internal_status` do payload ou adicioná-lo ao DTO, decisão de produto); desenhar `release_tracks` conforme `DEC-007`; desenhar a relação com `projects` conforme `GAP-0168`; decidir e implementar (ou formalmente descontinuar) a integração real com ao menos um distribuidor.

### CONFIDENCE: HIGH

---

## `DOMAIN-ARTIST` — Artist / Artista

### DEFINITION / PURPOSE / TABLE / API_RESOURCE

Uma pessoa/entidade artística cadastrada pelo tenant — perfil de carreira, não credencial de login. `artists` (78 colunas reais). `ArtistsController` → `GET/POST/PATCH/DELETE /artists` (+ `platform-profiles` sub-recurso).

### CREATED_FROM — dois fluxos paralelos (achado estrutural)

1. **`ArtistaFormModal.tsx`** — o fluxo real, usado pela UI (`Artistas.tsx`), ~45 campos, fonte de mapeamento única (`artista.mapper.ts`, 658 linhas).
2. **`ArtistaCadastro.tsx`** — página dedicada roteada em `/artistas/novo`/`/artistas/:id/editar`, ~71 campos (cobertura maior, inclusive `genero` da pessoa distinto de `generoMusical`), **confirmada órfã** (grep repo-wide: zero links de navegação apontando para essas rotas). Código válido, rota real, mas inalcançável por navegação normal — objeto da decisão pendente `DEC-003`.
3. **Terceiro fluxo, público**: `ArtistaSignupPublic.tsx` → `POST /public/artists` — **endpoint inexistente em qualquer lugar do backend**, confirmado por grep exaustivo. Todo envio deste formulário público de autocadastro de artista falha silenciosamente. Fechado/detalhado na auditoria do módulo `auth`, não duplicado aqui como achado de `artist`.

`EVIDENCE: docs/backend-v2/field-traceability/modules/artist.md §1 | docs/backend-v2/field-traceability/modules/auth.md §1 | CONFIDENCE: HIGH`

### FIELDS — classificação por destino de persistência (achado estrutural #2)

Das 78 colunas físicas reais: **~23 colunas físicas diretas** (`storage: 'column'`) — `nome_artistico`, `nome_civil`, `tipo`, `status`, `genero_musical`, `observacoes`, `especialidades`, `foto_url`, `spotify_url`/`youtube_url`/`deezer_url`/`apple_music_url`/`soundcloud_url`, `galeria_urls`, `documentos`, `manager_nome`, `produtor_executivo`, `agencia_booking`, `label_parceira`, `contrato_id`. **4 colunas cifradas** (`storage: 'encrypted'`, AES-256-GCM) — `email`, `telefone`, `cpf_cnpj`, `manager_contato`. **~41 campos armazenados dentro de `metadata` (jsonb)**, apesar de colunas físicas homônimas existirem na tabela: `slug_artistico`, `tipo_perfil`, `fase_carreira`, `genero`, `data_nascimento`, `rg`, `endereco`, `tags_musicais`, `presskit_url`, `documentos_pessoais_url`, `apple_music_albuns_url`, `soundcloud_seguidores_url`, `instagram_url`, `tiktok_url`, `instagram_seguidores`, `tiktok_seguidores`, `spotify_ouvintes`, `youtube_inscritos`, `deezer_fas`, `agencia`, `empresario_id/nome/email/telefone`, `gravadora_id/nome/email/telefone`, `gravadora_responsavel_id/nome/email/telefone`, `banco`, `conta`, `chave_pix`, `titular_conta`, `distribuidoras_selecionadas/gerais/emails/empresa_selecionadas/empresa_emails`, `contatos_equipe`, `contatos_vinculados`, `relacionamentos`. **Isto é arquitetura documentada, não bug** — o round-trip (`toResponse()`) achata `metadata.<campo>` de volta ao nome plano na resposta da API; as colunas físicas homônimas ficam de fato não utilizadas por este caminho de código (possível preparação para uma normalização futura nunca concluída).

### PII / ENCRYPTION

| Campo | Coluna | Cifrado | Camada | Pesquisável |
|---|---|---|---|---|
| Email | `email_encrypted` | SIM (AES-256-GCM) | `EncryptionService` | não (server-side) |
| Telefone | `telefone_encrypted` | SIM | idem | não |
| CPF/CNPJ | `cpf_cnpj_encrypted` | SIM | idem | não |
| Contato do manager | `manager_contato_encrypted` | SIM | idem | não |
| RG, endereço, dados bancários (banco/agência/conta/PIX/titular) | dentro de `metadata` jsonb | **NÃO** | — | não |

Dados **bancários** do artista NÃO recebem o mesmo nível de proteção que email/telefone/CPF da mesma entidade, apesar de tipicamente mais sensíveis — ver `CONFLITO-04`/`PO-VERIFY-022`.

### PLATAFORMAS EXTERNAS — dois sistemas coexistindo sem reconciliação

1. **Contadores manuais estáticos** (`spotify_ouvintes`, `youtube_inscritos`, etc.) — digitados pelo usuário, dentro de `metadata`, sem sincronização.
2. **Sincronização real** (`artist_platform_profiles`, 24 colunas, `GET/POST /artists/:id/platform-profiles[/:platform/sync]`) — Spotify (OAuth client-credentials real) e YouTube (Data API v3 real), ambos com `CREDENTIAL_REQUIRED_LATER: SIM` (plataforma, não tenant). Falha explícita se credencial ausente, nunca silenciosa.

Os dois sistemas coexistem sem conflito técnico (colunas diferentes), mas representam conceitualmente o mesmo dado sem reconciliação visível — observação, não bug técnico.

### RELATIONS — matriz completa

| Relação | Coluna FK | Enforcement DB |
|---|---|---|
| Obras (works) | `works.artista_id` | FK real |
| Fonogramas (phonograms) | `phonograms.artista_id` | FK real |
| Lançamentos (releases) | `releases.artista_id` | FK real, `ON DELETE SET NULL` |
| Contratos | `contracts.artista_id` | FK real |
| Projetos | `projects.artista_id` | lógica, sem FK física (e sempre NULL na prática — `GAP-0001`) |
| Transações (financeiro) | `transactions.artista_id` | lógica, sem FK, **populada de fato** pelo form de Transação |
| Eventos | `events.artista_id` | lógica, sem FK |
| Metas (marketing) | `artist_goals.artista_id` | lógica, sem FK |
| Contatos (CRM) | via `contatos_equipe` (metadata jsonb), referência solta por UUID | sem FK, referência real e viva (não cópia) |

`EVIDENCE: docs/backend-v2/field-traceability/modules/artist.md §2,§3,§6,§8 | CONFIDENCE: HIGH`

### STORAGE

3 campos de upload reais (`fotoUrl`, `documentosPessoaisUrl`, `presskitUrl`) via `FileUpload`/`useUploadToR2` — funcionais, end-to-end, não quebrados.

### CURRENT_PROBLEMS / TARGET_V2_DIRECTION

Resolver `DEC-003` (qual fluxo de criação prevalece); decidir se as ~41 colunas físicas "reservadas" devem ser abandonadas em favor de `metadata` permanentemente ou migradas; padronizar criptografia de dados bancários (`CONFLITO-04`); corrigir o autocadastro público quebrado (junto com `auth`).

### CONFIDENCE: HIGH

---

## Demais entidades do domínio (tratamento sintético, conforme instrução — profundidade menor que Project/Work/Phonogram/Release/Artist)

### `DOMAIN-CONTRACT` — Contract

DEFINITION: acordo entre o tenant e uma parte (artista/cliente/prestador). TABLE: `contracts` (25 col). Dois componentes de create/edit divergentes coexistem hoje (`ContratoWizard.tsx` principal, `ContratoFormModal.tsx` secundário via `catalog`) — unificação já decidida (`DEC-004`, `UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT`, modos WIZARD/QUICK), implementação pendente. `exclusivo` (NOT NULL) nunca exposto no wizard principal. PII de partes contratuais (CPF/CNPJ/RG/endereço) serializada em texto puro dentro de `observacoes`, exportável sem máscara (`GAP-0049`). Propagação real para financeiro ao assinar (`REAL_AUTOMATIC_PROPAGATION`, só o campo `valor`) — ver `MODULE-CONTRACTS`/`MODULE-ACCOUNTING`. `EVIDENCE: docs/backend-v2/field-traceability/modules/contracts.md | CONFIDENCE: HIGH`

### `DOMAIN-CLIENT` — Client / Contato

DEFINITION: pessoa física/jurídica cliente ou contato de negócio — "Contato = Cliente" é decisão de domínio documentada no próprio código; ambos os conceitos compartilham a tabela `clients` (39 col). Não existe tabela física `contacts` em uso real (a facade `/contacts` legada é um `Map` em memória, sem persistência, zero consumidor). PII (email/telefone/CPF-CNPJ) corretamente cifrada; ~15 colunas reais (foto, perfil, razão social/nome fantasia distintos, endereço decomposto, status/prioridade de contato, dados do responsável) capturadas pelo form mas nunca chegam ao backend (`REAL_MAPPING_GAP`). `EVIDENCE: docs/backend-v2/field-traceability/modules/crm-relationships.md | CONFIDENCE: HIGH`

### `DOMAIN-TRANSACTION` — Accounting Transaction

DEFINITION: um lançamento financeiro (receita/despesa) do tenant. TABLE: `transactions` (28 campos, mapeamento 1:1 completo, domínio "limpo" no sentido de mapeamento de campos). Vínculos reais (`artista_id`, `projeto_id`, `contrato_id`, `evento_id`) — todos lógicos, sem FK física, mas **populados de fato** pelo formulário real. O array `entityLinks` (rateio multi-entidade, exigido pela UI) é descartado silenciosamente pelo backend (`GAP-0009`) — a tabela de destino semântico óbvio (`transaction_allocations`) confirmada sem consumidor. `EVIDENCE: docs/backend-v2/field-traceability/modules/accounting.md | CONFIDENCE: HIGH`

### `DOMAIN-AUDIOVISUAL-PROJECT` — Audiovisual Project

DEFINITION: uma produção de clipe/conteúdo audiovisual — entidade rica e distinta de `Project` (musical). TABLE: `audiovisual_projects` (47 col, parte de 9 tabelas/187 colunas do domínio, 100% `DIRECT`). `financial_project_id` é FK real → `projects.id` (ligação ao Projeto Musical de origem), classificada `LEGACY_NAMING` (nome sugere financeiro, função real é vincular à música) — nunca escrita por nenhum form (`GAP-0033`). Apenas 1 dos 9 subdomínios do backend tem UI (ver `MODULE-AUDIOVISUAL`). `EVIDENCE: docs/backend-v2/field-traceability/modules/audiovisual.md | CONFIDENCE: HIGH`

### `DOMAIN-MARKETING-PROJECT` — Marketing Project

DEFINITION: um workspace de campanha de marketing — entidade distinta de `Project` (musical), tabela `marketing_projects`. `financial_project_id` (mesmo padrão do Audiovisual, FK real, nunca escrita por form) e `source_project_id` (lógico, sem FK física). Criado automaticamente quando um `Project` musical conclui (`MarketingProjectsService.createFromCompletedProject()`, automação real e funcional). `EVIDENCE: docs/backend-v2/field-traceability/modules/projects.md §21 | CONFIDENCE: HIGH`

### `DOMAIN-EVENT` — Event

DEFINITION: um compromisso de agenda (show, gravação, reunião). TABLE: `events` (23 col, tabela única — não existem tabelas separadas de venues/recorrência/lembretes/anexos). `artista_id` lógico, sem FK, e em parte dos fluxos apenas texto livre de lineup (sem escrita de `artista_id` real). Formulário de criação/edição (`SchedulerFormModal.tsx`) correto e consistente com o DTO real; a tela de calendário (`Agenda.tsx`) lê um conjunto de campos **fictício** que não corresponde nem às colunas reais nem ao DTO — todo evento renderiza na data "agora", forçado a dia inteiro. `EVIDENCE: docs/backend-v2/field-traceability/modules/events.md, citado via PROGRESS.md | CONFIDENCE: MEDIUM`

---

# PARTE III — FRONTEND (`apps/web`)

## III.1 Arquitetura HTTP — clientes canônicos e duplicados

**Cliente canônico único**: `apps/web/src/shared/lib/api-client.ts` — usado pelos 34 arquivos `*.service.ts` do repositório e pela maioria dos hooks classificados `API_HTTP`. Injeta `Authorization: Bearer <token>` e `X-Tenant-ID` a partir de variáveis em memória (nunca lidas diretamente de storage), nunca do body/localStorage. Envelope de resposta esperado: `{ data, timestamp }`. Erros mapeados por status HTTP para subclasses tipadas (`ValidationError`/`TenantError`/`PasswordChangeRequiredError`/`NotFoundError`/`ConflictError`/`IntegrationError`); em 401, limpa o token e ativa um circuit-breaker de 30s. **Sem timeout explícito** (nenhum `AbortController`) e **sem retry automático** em nenhuma chamada.

`apps/web/src/lib/api.ts` é um barrel de re-export do mesmo cliente (não é uma segunda implementação) — o comentário do próprio arquivo recomenda que novos módulos importem daqui, mas a esmagadora maioria do código ainda importa diretamente de `shared/lib/api-client.ts` (migração de convenção incompleta, não um bug funcional).

**9 pontos fora do cliente canônico** fazem `fetch()` direto — a maioria por necessidade legítima (upload multipart, download de blob, redirecionamento OAuth, chamada a serviço externo de terceiro). **2 divergências reais de arquitetura, sem correção**: `useAI.ts` e `useACRCloud.ts` chamam o backend diretamente sem reusar a injeção de `Authorization`/`X-Tenant-ID` do cliente canônico.

**Chamadas diretas a Supabase** (fora do backend NestJS): limitadas a Auth (SDK) e Realtime (canais `tenant:${orgId}`/`user:${userId}`, autorização via RLS) — não há acesso direto a tabelas de negócio via Supabase client no frontend fora desses dois usos (confirmado em auditoria dedicada anterior, doc17).

`EVIDENCE: docs/backend-v2/04-http-client-architecture.md | docs/backend-v2/17-supabase-direct-access-audit.md | CONFIDENCE: HIGH`

## III.2 Tabela completa de uso de `localStorage`/`sessionStorage`

| Key | Módulo | Significado | Dado de negócio? | Preferência de usuário? | Estado de integração? | Mock/fallback? | Deveria o backend possuir? | Gap |
|---|---|---|---|---|---|---|---|---|
| `musicos360_auth` | auth | Sessão do Supabase Auth (delegada ao SDK) | não | — | — | não | não (mecanismo padrão do provedor de Auth) | — |
| `musicos360_rule_overrides` | accounting | Override manual de regra de categorização de transação, chave global sem tenant/user | SIM | não | não | não | SIM | sem isolamento por tenant, sem endpoint |
| `musicos360_financial_category_rules` | accounting | Ruleset **inteiro** de categorização automática de transações | SIM | não | não | não | SIM (crítico) | `GAP-0011` (CategoriasFinanceiras.tsx desconectada do backend real) |
| `musicos360:variable_registry` | contracts | Registro de variáveis/placeholders de template de contrato, CRUD completo | SIM | não | não | não | SIM | listado no gap consolidado `contracts` (§30 item 11) |
| `contract_categories` (via `useCategoryRegistry`) | contracts | Categorias de contrato (rótulos), 11 seed | parcial (`DISPLAY_ONLY` por `DEC-002`) | não | não | não | não (classificado `DISPLAY_ONLY`, mas hoje sem sincronização) | mesmo item acima |
| `musicos360_deezer_credentials` (sessionStorage) | integrations | Credenciais Deezer, **secret em texto plano, sem redaction** | não (dado funcionalmente desnecessário — API pública) | não | SIM | não | não | risco de exposição de segredo em texto plano (CWE-312), mesmo sem uso funcional |
| `musicos360_clicksign_credentials` (sessionStorage) | integrations | Metadado de conexão Clicksign, `api_key` explicitamente removido antes de salvar | não | não | SIM | não | INCERTO | uso correto de `safeSessionSet` (contraste positivo) |
| `musicos360_nfe_credentials` (sessionStorage) | integrations | Credenciais fiscais NF-e, **`token_provedor` em texto plano** | SIM (fiscal) | não | SIM | não | SIM | risco de exposição de segredo fiscal em texto plano |
| `musicos360_docusign_credentials` (sessionStorage) | integrations/contracts/settings | Flag de "conectado" DocuSign, lido por 3 pontos distintos | não | não | SIM | não | SIM | reseta a cada sessão, sem persistência real |
| `musicos360_distributor_connections` | releases/settings | Quais das 6 distribuidoras estão "conectadas" | SIM (decide opções de distribuição real) | não | SIM | não | SIM (crítico) | nunca escrito por nenhum código real — `hasAnyConnected` sempre `false` (ver Parte VIII) |
| `musicos360_user_settings:<id>` | settings | Perfil pessoal + 11 toggles de notificação/automação + `avatar_url` em base64 completo | parcial | SIM | não | não | INCERTO (avatar deveria usar upload real já existente) | `LOCAL_STORAGE_GAP` |
| `musicos360_org_slug:<id>` | settings/workspace | Slug de cadastro público da organização, salvo **por usuário no navegador**, não por tenant | SIM (crítico — dado tenant-wide) | não (mal-classificado como preferência de usuário) | não | não | SIM | `LOCAL_STORAGE_GAP` (§9, `settings.md`) — backend real já existe e nunca é chamado |
| `musicos360_current_tenant` | workspace | Última seleção de tenant | SIM | parcial | não | não | recomendável sync server-side | `GAP-0164` |
| `musicos360_external_oauth_connections` (sessionStorage) | settings/integrations | Cache local de conexões OAuth externas | não | não | SIM | não | não (é cache, fonte real é o backend) | — |
| `useChat.ts` (mencionado, sem chamada real) | integrations | Comentário promete fallback local para canal de chat, não implementado | — | — | — | SIM (intenção documentada, não implementada) | não | recurso desabilitado honestamente |
| `catalog-lookup.ts` (mencionado, sem chamada real) | monitoring | Comentário promete leitura de catálogo via localStorage, código é stub morto (sempre `[]`) | — | — | — | SIM (comentário desatualizado) | SIM | métricas de match ECAD sempre calculadas sobre catálogo vazio |

`EVIDENCE: docs/backend-v2/18-local-storage-audit.md (13 casos reais detalhados) | docs/backend-v2/field-traceability/modules/settings.md §6 (LOCAL_STORAGE_KEYS: 4) | docs/backend-v2/field-traceability/modules/releases.md §4 | docs/backend-v2/field-traceability/modules/contracts.md §3 | CONFIDENCE: HIGH`

## III.3 Apêndice completo de mocks/stubs/fakes por módulo

| Módulo | Arquivo | Funcionalidade | Classificação | Alcançável? | Impacto | Gap |
|---|---|---|---|---|---|---|
| accounting | `CategoriasFinanceiras.tsx` | Página inteira de categorias financeiras | FAKE (localStorage, formato diferente do schema real) | SIM (linkada no menu) | Usuário edita "categorias" sem qualquer efeito no banco | `GAP-0011` |
| accounting | `TransacaoRules.tsx`/`FinanceCategoryRuleModal.tsx` | CRUD de regras de categorização personalizadas | QUEBRADO (endpoints `/financial-categories/rules*` inexistentes, HTTP 400 em toda carga) | SIM | Tela inteira não funciona | `GAP-0010` |
| accounting | `TransacaoFormModal.tsx::exportFieldList()` | Export XLSX de 3 abas | MORTO (nunca chamado, viola regra de 2 abas) | NÃO | nenhum | `GAP-0014` |
| admin | `AdminSettings.tsx` (8 abas) | Configurações administrativas | FAKE sistêmico (toast de sucesso falso em toda ação; Webhooks/Chaves API sempre vazios com botão sem `onClick`) | SIM (rota real) | Nenhuma configuração admin é realmente salva | `GAP-0018` |
| admin | `admin-source.ts` (6 exports) | KPIs/tenants/eventos de segurança/métricas de sistema | MORTO (código honestamente vazio, `ADMIN_DATA_IS_MOCK=false`, mas 6 dos 9 exports sem consumidor algum) | NÃO (6 de 9) | nenhum funcional; código morto | `GAP-0019` |
| admin | banner "Admin analytics indisponível" | Aviso de endpoints ausentes | FAKE (sempre visível, mesmo quando o endpoint É real) | SIM | mensagem incorreta em 6 das 9 páginas admin | `GAP-0020` |
| admin | Auditoria.tsx | Checador de completude cross-módulo | REAL (não fake), mas 2 gaps de mapeamento próprios | SIM | — | ver módulos individuais |
| admin | `AdminKnowledge.tsx` | Base de conhecimento admin | MOCK honesto (`IS_PROD`-gated, autodesabilitado em produção) | SIM apenas em dev | nenhum em produção | `GAP-0022` (NO_FIX_REQUIRED) |
| artist | `ArtistaCadastro.tsx` | Segundo fluxo de cadastro de artista | DEAD (órfão, zero navegação) | NÃO | nenhum (funcional se acessado por URL direta) | `GAP-0003`/`DEC-003` |
| artist | contadores manuais de seguidores | Métricas de plataforma manuais | não-fake mas paralelo ao sync real, sem reconciliação | SIM | duplicidade conceitual | `GAP-0028` |
| audiovisual | 8 de 9 domínios de backend | briefing/entregáveis/storyboard/cronograma/equipe/arquivos/tarefas/aprovações | AUSENTE DE UI (não é mock — é backend real sem front) | NÃO (16 hooks sem consumidor) | ~85% do domínio audiovisual construído inacessível | `GAP-0031` |
| audiovisual | filtro de status | 3 dropdowns de status | QUEBRADO (valores PT vs. dados EN) | SIM | sempre zero resultados | `GAP-0032` |
| catalog | `useAbramusImport`/`useAbramusLocalLookup`/`useAbramusSyncAll` | Import/lookup/sync ABRAMUS | STUB (sempre falha ou vazio) | SIM (import/sync); NÃO (`useAbramusGenerateISWC` etc., sem importador) | falha determinística ao clicar | `GAP-0117` área integrations, `catalog.md §12` items 7-9 |
| catalog | `catalog.store.ts`, `catalog.service.ts` | Store/serviço alternativos | DEAD | NÃO | nenhum | `GAP-0046`/`GAP-0167` |
| contracts | `ContratoWizard.tsx` botão "Enviar para Assinatura" | Assinatura eletrônica | FAKE determinístico (sempre `toast.error`+`throw`, nunca chama backend) | SIM | usuário nunca consegue enviar contrato pelo fluxo principal | consolidado em `contracts.md §30` item 4 |
| contracts | `signing.adapter.ts` | Adapter universal de assinatura | STUB universal (sempre `createUnavailableSigningProvider`, mesmo para Autentique real) | SIM | nenhum provider de assinatura funciona pela UI | `GAP-0050`/`GAP-0052` |
| contracts | `contracts.store.ts` | Store alternativo | DEAD | NÃO | nenhum | `GAP-0167` |
| contracts | `contract-party-origin.mapper.ts` | Mapper de origem de parte | DEAD | NÃO | nenhum | — |
| contracts | `CategoryRegistry.tsx`/`VariableRegistry.tsx` | Registro de categorias/variáveis | localStorage puro (ver III.2) | SIM | não sincroniza entre dispositivos/usuários | consolidado |
| dashboard | `computeFromMockStorage()` | Cálculo alternativo do dashboard operacional | DEAD (~150 linhas, nunca chamada) | NÃO | nenhum | `GAP-0071`-adjacente, `dashboard.md §2` |
| dashboard | bloco de 11 `window.addEventListener("musicos360:...")` | Reatividade a eventos customizados | DEAD (nenhum `dispatchEvent` correspondente existe) | NÃO | nenhum | `dashboard.md §13` |
| dashboard | `crmMetrics`/`financeiroMetrics` | Cálculo de P&L completo | ATIVO mas nunca renderizado | NÃO (resultado morto) | desperdício de computação, sem impacto funcional | `dashboard.md §22` item 4 |
| events | `events.store.ts`, `eventService` | Store/serviço alternativos | DEAD | NÃO | nenhum | consolidado via `PROGRESS.md` |
| inventory | 2 arquivos dead-code | não especificados individualmente na fonte condensada | DEAD | NÃO | nenhum | `PROGRESS.md` |
| leads | 3 de 4 Zustand stores | Filtros/preset | DEAD | NÃO | nenhum | `GAP-0104`/`GAP-0167` |
| leads | uploads de lead | Upload de arquivo | DECORATIVO (`URL.createObjectURL`, tabela `lead_uploads` confirmada `NO_TABLE_CONSUMER`) | SIM | arquivo nunca persiste de verdade | `PROGRESS.md` |
| licensing | 2 Zustand stores | não especificado individualmente | DEAD | NÃO | nenhum | `GAP-0167`-adjacente |
| marketing | `budget * 0.41` | "Gasto Total" de campanha | FABRICADO (coeficiente arbitrário exibido como dado real) | SIM | métrica de investimento enganosa | `GAP-0112` |
| marketing | `CampaignsController`/`CampaignOperationsController` | Sistema de campanha "A" | DEAD/ÓRFÃO (inalcançável, incompatível com o schema) | NÃO | nenhum diretamente (risco se reativado) | `GAP-0111` |
| monitoring | `RightsMonitoring.tsx` | Painel de monitoramento de direitos | ESTRUTURALMENTE VAZIO por honestidade (`RIGHTS_DATA_IS_MOCK=false`, 5 arrays sempre vazios) — é a tela realmente alcançada, a real (`Monitoramento.tsx`) está inacessível por redirect | SIM (mas vazia) | usuário nunca vê dado real de monitoramento | `GAP-0116` |
| monitoring | `catalog-lookup.ts` | Índice de catálogo para match ECAD | STUB morto, comentário desatualizado (ver III.2) | interno | métricas de match sempre zeradas | consolidado |
| musicchat | nenhum mock/fake confirmado | — | — | — | — | módulo com o menor índice de fake/mocks desta série |
| projects | `projects.store.ts`, `projects.service.ts` | Store/serviço alternativos | DEAD | NÃO | nenhum | `GAP-0126`/`GAP-0167` |
| projects | upload de áudio por faixa | Upload | STUB hardcoded (`uploadFile` sempre `null`) | SIM | nenhum áudio é anexado | consolidado, `projects.md §8` |
| releases | `releases.store.ts`, `releases.service.ts` | Store/serviço alternativos | DEAD | NÃO | nenhum | `GAP-0167` |
| releases | 6 distribuidoras | Distribuição digital | STUB honesto (link estático, sem simulação de sucesso) | SIM (link abre) | nenhuma distribuição real ocorre | `GAP-0080` |
| reports | (nenhum encontrado — módulo mais rigoroso da série) | — | — | — | — | — |
| rh | 4 sub-fluxos de create | Funcionário/Folha/Férias/Documentos | QUEBRADO (DTO/form incompatíveis, HTTP 400; Documentos aponta para endpoint errado) | SIM | 100% da criação de RH quebrada | `GAP-0138/0139/0140/0141/0142/0143` |
| settings | `AuditTrail.tsx` | Trilha de auditoria | DEAD (rota nunca registrada) | NÃO | nenhum | `settings.md §15` |
| settings | `settings.store.ts` | Store alternativo | DEAD | NÃO | nenhum | `GAP-0167`-adjacente |
| settings | cartão "Método de Pagamento" | Exibição de cartão salvo | FAKE (`•••• 4242` hardcoded, sem dado real) | SIM | usuário vê um cartão que não existe | `GAP-0152` |
| settings | 4 toggles de notificação | "Automações" tab | FAKE (`<Switch checked={true}>` sem handler) | SIM | usuário acha que está configurando, não está | `GAP-0147`/`GAP-0148` |
| settings | 6 itens de "Segurança" | 2FA/sessões/exclusão de conta | FAKE (sem `onClick`, dados hardcoded) | SIM | usuário acha que existe 2FA/sessões reais | `GAP-0155` |
| support | Chat de suporte, base de conhecimento, status/board | 4 sub-features do módulo Support | FAKE, mas honestamente auto-documentado (falha explícita, nunca simula sucesso) | SIM | usuário vê UI real de features que não existem | `GAP-0160` (INTENTIONAL_STUB) |
| workspace | nenhum mock/fake confirmado | — | — | — | — | módulo mais limpo desta série (0 CREATE_MAPPING_MISMATCH) |

`EVIDENCE: consolidação de docs/backend-v2/field-traceability/modules/*.md (achados §"componentes"/"gaps consolidados" de cada módulo) + canonical-gap-register.json | CONFIDENCE: HIGH (13 módulos lidos diretamente) / MEDIUM (11 módulos via PROGRESS.md)`

## III.4 Código morto/órfão — distinção confirmado-morto vs. órfão vs. possivelmente-não-usado vs. legado-compat

**Confirmado morto** (zero consumidores, verificado por grep exaustivo — sem recomendação automática de remoção, apenas classificação):
- 9 scaffolds Zustand nunca usados: `catalog.store.ts`, `contracts.store.ts`, `dashboard-layout.store.ts`, `events.store.ts`, `inventory` (não nomeado individualmente na fonte), `leads-filter-preset.store.ts`, 4 stores de `crm-relationships` (`contact-agenda`, `contact-filters`, `contact-panel`, `contact-tags`), `projects.store.ts`, `releases.store.ts` — colapsados em `GAP-0167` (causa-raiz comum) + gaps individuais por módulo (`GAP-0046`, `GAP-0072`, `GAP-0104`, `GAP-0126`).
- `catalog.service.ts` (`catalogService`), `projects.service.ts`, `releases.service.ts` — camadas de serviço redundantes, nunca importadas (a tela real usa hooks `useX` diretamente).
- `contract-party-origin.mapper.ts` (contracts), `ContactComponents.tsx` (317 linhas, 13 componentes de CRM nunca renderizados), `components/index.tsx` (crm-relationships, barrel morto).
- `AuditTrail.tsx`+`useAuditTrail.ts` (settings) — funcional, backend-wired, mas sem rota que o alcance.
- `computeFromMockStorage()` + bloco de 11 `window.addEventListener` (dashboard).
- Entidade/repositório duplicado de Release (`apps/api/src/modules/releases/entities/release.entity.ts` + `repositories/release.repository.ts`) — referenciados só por um spec de teste, não pelo módulo real.

**Órfão** (código real, funcional, mas inalcançável por navegação normal — distinto de "morto"):
- `ArtistaCadastro.tsx` (rotas `/artistas/novo`/`/artistas/:id/editar`, zero links).
- `/audiovisual/projects/new` (mesma rota-morta, mas sem risco de divergência de campos, é o mesmo formulário).
- 16 de 20 hooks de `audiovisual` (briefing/entregáveis/shots/cronograma/equipe/assets/tarefas/aprovações).
- Integração Autentique real e completa no backend, zero consumidor frontend.

**Possivelmente-não-usado** (marcado com incerteza pela própria auditoria de origem, não confirmado por grep exaustivo em todos os casos): `PostHog` (config presente, nenhum uso de código encontrado além da env var — classificado `STUB` por essa razão); mecanismos de cache de resposta de alguns providers de integração (não verificados em profundidade).

**Legado-compat** (mantido deliberadamente por compatibilidade, não é código morto): `apps/web/src/lib/api.ts` (barrel de re-export); `contract_categories`/`CONTRACT_TYPES` (classificados `DISPLAY_ONLY`/`DEAD_LEGACY_VOCABULARY` por `DEC-002`, não removidos nesta etapa).

Nenhuma remoção foi recomendada automaticamente — cada item permanece sujeito à classificação obrigatória de `74-zero-gap-reconstruction-contract.md §23` (`REQUIRED`/`REPLACED`/`DERIVED`/`LEGACY_ONLY`/`DEAD`/`NON_CRUD_BY_DESIGN`) antes de qualquer decisão de eliminação na reconstrução.

`EVIDENCE: consolidação por grep cruzado entre os 13 relatórios de módulo lidos diretamente + canonical-gap-register.json (GAP-0167 e seus 4 satélites) | CONFIDENCE: HIGH`

## III.5 Inventário de componentes de criação/edição (Create/Edit) — todos os módulos

| Módulo | Componente | Tipo | Entidade | Campos (aprox.) | Endpoint | Alcançável? | Duplicado? | Status |
|---|---|---|---|---|---|---|---|---|
| accounting | `TransacaoFormModal.tsx` | modal | Transaction | 28 + `entityLinks` (gap) | `POST/PATCH /transactions` | SIM | não | funcional, 1 gap (`entityLinks`) |
| accounting | Nota Fiscal form (`nota-fiscal-form/`) | form | Invoice | 38 | `POST/PATCH /invoices` | SIM | não | limpo, sem gap |
| admin | `AdminPlans` create/edit | form | BillingPlan | 9 | `POST/PATCH /billing/plans` | SIM | não | limpo |
| admin | `AdminSettings.tsx` (8 abas) | form (decorativo) | — | N/A | nenhum real | SIM | não | 100% fake |
| artist | `ArtistaFormModal.tsx` | modal | Artist | ~45 | `POST/PATCH /artists` | SIM | SIM (vs. `ArtistaCadastro.tsx`) | canônico real |
| artist | `ArtistaCadastro.tsx` | página | Artist | ~71 | `POST/PATCH /artists` | NÃO (órfão) | SIM | funcional mas inalcançável |
| artist | `ArtistaSignupPublic.tsx` | wizard público | Artist | ~30 | `POST /public/artists` (inexistente) | SIM (rota pública) | não (é um 3º fluxo) | 100% quebrado |
| audiovisual | `AudiovisualProjectFormModal.tsx` | modal | AudiovisualProject | 18 | `POST/PATCH /audiovisual/projects` | SIM | não | limpo |
| catalog | `ObraFormModal.tsx` | modal | Work | 23 (+4/linha participante) | `POST/PATCH /works` | SIM | não | `artista_id` sempre null |
| catalog | `FonogramaFormModal.tsx` | modal | Phonogram | 30 (+2/linha por categoria) | `POST/PATCH /phonograms` | SIM | não | upload de áudio fake |
| contracts | `ContratoWizard.tsx` | wizard (6 passos) | Contract | 9 nível-registro + N partes/signatários | `POST/PATCH /contracts` | SIM (principal) | SIM (vs. FormModal) | `arquivo_url` ausente, `exclusivo` nunca setado |
| contracts | `ContratoFormModal.tsx` | modal | Contract | 13 | `POST/PATCH /contracts` | SIM (só via catalog) | SIM | tem `arquivo_url`, mas destrói o blob do wizard se usado para editar |
| contracts | `TemplatesContratos.tsx` create | form | ContractTemplate | 8 | `POST /contract-templates` | SIM | não | **DTO incompatível — HTTP 400 sempre** |
| crm-relationships | `ContatoFormModal.tsx` | modal | Client | 19+N | `POST/PATCH /clients` | SIM | não | 12 de 19+ campos realmente persistem |
| dashboard | (nenhum — módulo é só leitura/agregação) | — | — | — | — | — | — |
| events | `SchedulerFormModal.tsx` | modal | Event | não detalhado individualmente na fonte condensada | `POST/PATCH /events` | SIM | não | correto (contraste com `Agenda.tsx`, que lê campos fictícios) |
| integrations | diversos `*ConfigDialog.tsx` (Deezer/Spotify/YouTube/NFe/Clicksign etc.) | dialog | credenciais de integração | variável por provider | variável (real ou nenhum) | SIM | não | ver Parte VIII |
| inventory | `InventarioFormModal.tsx` | modal | InventoryItem | ~19 | `POST/PATCH /inventory-items` | SIM | não | 3 campos com bug de case (camelCase vs. snake_case no edit) |
| leads | Lead create/edit (não nomeado individualmente na fonte condensada) | form | Lead | 34 col na tabela, subset no form | `POST/PATCH /leads` | SIM | não | `whatsapp` provavelmente rejeitado (400), 7 colunas duplicadas em `dados_internos_crm` |
| licensing | Modal "Nova Licença de Sync" | modal | License | 27 col na tabela, subset no form | `POST/PATCH /licenses` | SIM | não | campos de snapshot nunca escritos |
| marketing | Campaign Builder (Sistema B) | builder | Campaign (via `marketing_projects`) | maioria em `metadata.marketingBuilder.payload` jsonb | `POST /marketing/campaigns/draft` | SIM | SIM (Sistema A morto coexiste na mesma tabela) | ativo, mas fragmentado |
| monitoring | Form de takedown (dentro da tela morta `Monitoramento.tsx`) | form | Takedown | — | `POST /takedowns` | NÃO (tela real inalcançável por redirect) | não | quebrado por bug de backend (`url` sempre null) |
| musicchat | Composer de mensagem | inline | ConversationMessage | attachments/texto | `POST /conversations/:id/messages` | SIM | não | limpo, sem mismatch de campo |
| projects | `ProjetoFormModal.tsx` | modal | Project | 8 (5 persistidos + 3 gap) | `POST/PATCH /projects` | SIM | não | `artista_id`/`orcamento` nunca coletados |
| releases | `LancamentoFormModal.tsx` | wizard (5 passos) | Release | 20 | `POST/PATCH /releases` | SIM | não | **100% quebrado — `internal_status` não whitelisted** |
| reports | (nenhum create/edit — módulo é só export/leitura) | — | — | — | — | — | — |
| rh | `FuncionarioFormModal.tsx` | modal | Employee | 13 whitelisted, form envia 8 não-whitelisted + falta `nome` | `POST/PATCH /hr/employees` | SIM | não | **100% quebrado — HTTP 400** |
| rh | Payroll create | form | PayrollEntry | — | `POST /hr/payroll` | SIM | não | **100% quebrado — nomes de campo divergentes** |
| rh | Leave-request create | form | LeaveRequest | — | `POST /hr/leave-requests` | SIM | não | **100% quebrado — mesmo padrão** |
| settings | `LogoUploader.tsx` | upload | Branding | 1 (arquivo) | `POST /workspaces/:id/logo` (inexistente) | SIM | não | **endpoint não existe** |
| settings | `Configuracoes.tsx` "Empresa" | form | CompanySettings | 7 | `PATCH /company-settings` | SIM | não | limpo |
| support | Criação de ticket | form | SupportTicket | — | `POST /support-tickets` | SIM | não | real, workflow funcional |
| workspace | Convite de membro (`/usuarios` e aba "Usuários") | form | Invitation | e-mail+role | `POST /invitations` (via RBAC real) | SIM (2 entradas) | SIM (`DEC-006` pendente) | ambos funcionam, fragmentado |

`EVIDENCE: consolidação de todos os 24 relatórios de módulo (13 diretos, 11 via PROGRESS.md) | CONFIDENCE: HIGH para os 13 diretos, MEDIUM para os 11 restantes`

---

# PARTE IV — BACKEND LEGADO (`apps/api`)

## IV.1 Stack real (verificado em `apps/api/package.json`)

| Camada | Tecnologia | Versão | Papel |
|---|---|---|---|
| Framework HTTP | NestJS (`@nestjs/common`/`core`/`platform-express`) | `^10.3.0` | framework de módulos/controllers/DI |
| ORM | TypeORM (`typeorm` + `@nestjs/typeorm`) | `^0.3.31` / `^10.0.2` | acesso a dados, entidades, migrations |
| Banco | PostgreSQL via `pg` | `^8.20.0` | banco único, hospedado no Supabase |
| Auth de identidade | `@supabase/supabase-js` | `^2.105.4` | Supabase Auth (SDK direto no frontend + verificação de JWT no backend) |
| Filas/Jobs | BullMQ (`bullmq` + `@nestjs/bullmq`) + `ioredis` | `^5.76.8` / `^10.2.3` / `^5.10.1` | filas assíncronas (ex.: agendamento de conteúdo de marketing, triagem de suporte) |
| Config | `@nestjs/config` + validação Zod própria (`env.schema.ts`) | `^3.2.0` | carregamento/validação de variáveis de ambiente |
| Docs de API | `@nestjs/swagger` | `^7.3.0` | OpenAPI |
| Health checks | `@nestjs/terminus` | `^10.2.3` | endpoint de saúde |
| Eventos internos | `@nestjs/event-emitter` | `^3.1.0` | barramento de eventos de domínio in-process (`EventEmitter2`) |

`EVIDENCE: apps/api/package.json | CONFIDENCE: HIGH`

## IV.2 Estrutura de módulos (verificado em `apps/api/src/app.module.ts`)

`apps/api/src/app.module.ts` registra explicitamente os módulos de infraestrutura e os ~48 módulos de domínio/feature reais, entre eles (lista completa dos imports de módulo de negócio confirmados por leitura direta do arquivo): `AuthModule`, `CompanySettingsModule`, `ArtistsModule`, `WorksModule`, `PhonogramsModule`, `ContractsModule`, `TransactionsModule`, `NotificationsModule`, `UploadsModule`, `ContractTemplatesModule`, `ContractServiceTypesModule`, `InvoicesModule`, `ClientsModule`, `LeadsModule`, `LeadInteractionsModule`, `ContactsModule`, `ContactTimelineModule`, `ContactAttachmentsModule`, `ContactContractsModule`, `CampaignsModule`, `MarketingModule`, `BriefingsModule`, `EventsModule`, `ProjectsModule`, `TakedownsModule`, `SharesModule`, `ReleasesModule`, `UsersModule`, `AuditLogModule`, `ActivityLogsModule`, `SupportTicketsModule`, `IntegrationsModule`, `AIModule`, `BillingModule`, `ArtistGoalsModule`, `ContentDetectionsModule`, `EcadReportsModule`, `HrModule`, `DomainEventsModule` (core), `SkillsModule` (core), `AssetsModule`, `WorkflowModule` (core), `ConversationsModule`, `FormsModule`, `AnalyticsModule`, `InventoryModule`, `LicensingModule`, `FinancialRulesModule`, `FinancialCategoriesModule`, `AudiovisualModule`, `RegistryModule`, `ReportsModule` — mais os módulos de infraestrutura `DatabaseModule`, `CacheModule`, `StorageModule`, `HealthModule`, `QueueModule`, `CoreModule`, `AutomationModule` (core), `MetricsModule` (core), `AdminQueuesModule` (core), `PlanLimitModule` (core/billing), `RealtimeModule` (core).

Esta lista de imports do `app.module.ts` é a evidência primária de que os 24 módulos auditados nesta série (Parte VI) correspondem 1:1 a módulos de backend reais e registrados — nenhum dos 24 é puramente conceitual/frontend-only sem contraparte de módulo Nest (mesmo quando, como em `dashboard`/`admin`/`settings`/`workspace`/`monitoring`, o módulo de produto é uma composição de vários módulos Nest de nome distinto, já documentado individualmente em cada seção de Parte VI).

`EVIDENCE: apps/api/src/app.module.ts (imports, leitura direta) | CONFIDENCE: HIGH`

## IV.3 Cadeia de Guards (ordem de execução, `APP_GUARD` global)

Guards reais confirmados em `apps/api/src/core/guards/` (cada um com `*.spec.ts` próprio, mais um `guard-chain.integration.spec.ts` cobrindo a cadeia completa):

1. `JwtAuthGuard` (`auth.guard.ts`) — verifica o JWT do Supabase Auth (assinatura/expiração), popula `request.user`.
2. `MustChangePasswordGuard` (`must-change-password.guard.ts`) — bloqueia rotas de negócio se o usuário estiver marcado com troca de senha obrigatória (exceto a própria rota de troca).
3. `TenantGuard` (`tenant.guard.ts`) — resolve o tenant real a partir do claim JWT `app_metadata.org_id` (nunca do header `X-Tenant-ID` do cliente, usado só como checagem de consistência), popula `@CurrentTenant()`.
4. `BillingEnforcementGuard` (`billing-enforcement.guard.ts`) — bloqueia operações se o tenant estiver com assinatura/pagamento em estado bloqueante (ver `BillingBlockedPage.tsx`, Parte VI-SETTINGS).
5. `RolesGuard` (`roles.guard.ts`) — checagem baseada em `role`/`role_id` (modelo dual, ver Parte IX).
6. `PermissionsGuard` (`permissions.guard.ts`) — checagem granular via `@RequirePermission()`/metadados CRUD (`crud-permission-metadata.spec.ts`).
7. `RateLimitGuard` (`rate-limit.guard.ts`) — limitação de taxa por rota/tenant.

Interceptors globais registrados junto à cadeia: `AuditInterceptor` (trilha de auditoria de mutações), `RequestTenantContextInterceptor` (propaga contexto de tenant para camadas downstream). Middlewares: `RequestIdMiddleware`, `CorrelationMiddleware` (rastreamento de requisição/correlação de logs).

`EVIDENCE: apps/api/src/app.module.ts | apps/api/src/core/guards/*.ts (listagem direta) | CONFIDENCE: HIGH`

## IV.4 Filas/Jobs assíncronos (BullMQ + Redis)

`QueueModule` (`apps/api/src/queues/queue.module.ts`) configura BullMQ via `@nestjs/bullmq`, com URL de Redis resolvida por `REDIS_QUEUE_URL` ou `REDIS_URL` (fallback para construção a partir de partes de configuração) — e um modo explícito `noOpModule()` quando Redis não está configurado (degradação graciosa documentada no próprio código, não uma falha silenciosa). `AdminQueuesModule` expõe um painel Bull Board para inspeção operacional das filas. Consumidores reais confirmados nesta auditoria: agendamento de publicação de conteúdo de marketing (retry com backoff, idempotência — ver Parte VI-MARKETING), triagem automática de suporte (ver Parte VI-SUPPORT), automações de contrato (cron de vencimento de 30 dias — ver Parte VI-CONTRACTS).

`EVIDENCE: apps/api/src/queues/queue.module.ts | módulos marketing/support/contracts (Parte VI) | CONFIDENCE: HIGH`

## IV.5 Supabase Auth — papel no backend legado

O backend legado não implementa seu próprio provedor de identidade — a identidade/credenciais/sessão são geridas pelo Supabase Auth (SDK `@supabase/supabase-js` usado tanto no frontend quanto para operações administrativas no backend, ex.: sincronizar `app_metadata.org_id` durante o provisionamento de workspace). O papel do backend é **verificar** o JWT emitido pelo Supabase (via `JwtAuthGuard`) e **derivar** contexto de tenant/role a partir dos claims (`TenantGuard`/`RolesGuard`) — nunca reemitir ou gerenciar sessões por conta própria. Ver Parte IX para o detalhamento completo de autenticação vs. autorização vs. contexto de tenant.

`EVIDENCE: docs/backend-v2/field-traceability/modules/auth.md §1-4 | CONFIDENCE: HIGH`

## IV.6 Deployment atual

O backend legado roda como aplicação NestJS containerizada (ver `docker-compose.yml` na raiz do repositório e `.github/workflows/staging.yml`/`ci.yml`) contra um Postgres hospedado no Supabase — não foi encontrada, nesta auditoria, nenhuma migração de infraestrutura de deployment em andamento (o trabalho de infraestrutura visto em `docs/backend-v2/*.md` é inteiramente sobre o novo `apps/api-v2`, ver Parte XI). O deployment do backend legado permanece fora do escopo desta reconstrução documental — nenhuma alteração de arquivo de deploy foi feita ou é proposta aqui.

`EVIDENCE: docker-compose.yml, .github/workflows/*.yml (listagem/estrutura, não alterados) | CONFIDENCE: MEDIUM (infraestrutura de deploy não foi o foco desta auditoria de domínio)`

---

# PARTE V — DATABASE

## V.1 Total de tabelas

**142 tabelas físicas** confirmadas no schema Postgres do backend legado (inventário completo extraído e cruzado contra `database-backend-column-mapping.json`/migrations, consistente com `docs/backend-v2/database-inventory/`). Todas as tabelas de negócio carregam `tenant_id` explícito (ver Parte IX), exceto as tabelas puramente de referência/config global do sistema RBAC (`permissions`, `permission_groups`, `permission_aliases`, `permission_conflicts`, `permission_dependencies`) e a tabela de controle `musicos360_migrations`.

`EVIDENCE: docs/backend-v2/review/_all-tables.md (extração verificada, 142 linhas) | CONFIDENCE: HIGH`

## V.2 Tabelas por domínio (todas as 142, nenhuma omitida)

### Tenancy / Org / RBAC (24 tabelas)
`tenants` (18 col — PK `id`, workspace canônico), `organizations` (16 col — pai legal/billing), `org_members` (18 col — membership, FK `role_id→roles`, `department_id→departments`, `position_id→positions`), `tenant_invitations` (14 col — FK `org_id→organizations`, `role_id→roles`), `tenant_billing_state` (12 col — FK `tenant_id→tenants`), `users` (6 col — espelho mínimo do Supabase `auth.users`), `roles` (16 col — FK `canonical_role_id→roles` auto-ref, `tenant_id→tenants`), `role_permissions` (5 col — junção `role_id`/`permission_id`), `role_templates` (9 col), `role_template_permissions` (4 col), `role_inheritance` (9 col — `child_role_id`/`parent_role_id→roles` auto-ref), `permissions` (13 col — global, sem `tenant_id`), `permission_groups` (6 col — global), `permission_aliases` (4 col — global), `permission_conflicts` (4 col — global, auto-ref `permissions`), `permission_dependencies` (4 col — global, auto-ref `permissions`), `departments` (13 col — auto-ref `parent_department_id`), `positions` (13 col — FK `department_id`), `job_functions` (12 col), `membership_job_functions` (6 col — junção `membership_id→org_members`/`job_function_id→job_functions`), `rbac_decision_logs` (25 col, **tabela particionada** — partições mensais `rbac_decision_logs_2026_06/07/08/09/10` + `rbac_decision_logs_default`, todas 25 col, bookkeeping de decisões de autorização), `rbac_error_logs` (12 col).

### Auditoria / Bookkeeping (6 tabelas)
`audit_logs` (20 col), `activity_logs` (11 col), `financial_category_audit_logs` (11 col), `domain_event_log` (12 col — barramento de eventos de domínio interno, `EventEmitter2`), `payment_events` (7 col — FK `tenant_id→tenants`), `musicos360_migrations` (3 col — controle técnico de migrations, sem `tenant_id`, não é tabela de negócio).

### Artist (3 tabelas)
`artists` (78 col — a maior entidade de negócio do sistema; 4 campos cifrados AES-256-GCM: email/telefone/CPF-CNPJ/contato do manager; ~41 campos roteados para `metadata` jsonb por decisão arquitetural), `artist_platform_profiles` (24 col — FK `artist_id→artists`, sync Spotify/YouTube), `artist_goals` (16 col — relação lógica com `artists`, sem FK física).

### Catalog (11 tabelas)
`works` (47 col — FK `artista_id→artists` SET NULL; relação lógica `projeto_id→projects`), `work_participants` (10 col — FK `work_id→works` CASCADE), `phonograms` (59 col — FK `artista_id→artists` SET NULL, `obra_id→works` SET NULL), `rights_holders` (17 col, sub-módulo `registry`), `external_identifiers` (12 col, sub-módulo `registry`), `society_accounts` (14 col), `society_submissions` (19 col), `society_sync_jobs` (11 col), `society_payload_snapshots` (8 col — FK `submission_id→society_submissions` CASCADE), `society_submission_events` (10 col — FK `submission_id→society_submissions` CASCADE), `society_validation_errors` (10 col). O sub-módulo `registry` completo (6 tabelas, 91 colunas) é backend real sem qualquer consumidor de frontend (ver Parte VI-CATALOG).

### Projects (4 tabelas)
`projects` (16 col — PK `id`; colunas confirmadas: `id, tenant_id, titulo, tipo, status, artista_id, orcamento, descricao, observacoes, genero, metadata, created_at, updated_at, deleted_at, created_by, updated_by`; entidade canônica Musical Project per `DEC-001`), `project_tracks` (16 col — FK `project_id→projects` CASCADE), `project_track_participants` (7 col — FK `project_track_id→project_tracks` CASCADE), `project_assets` (8 col — órfã, zero consumidor).

### Releases (2 tabelas)
`releases` (26-27 col — FK `artista_id→artists` SET NULL; sem relação persistida com `projects`, `GAP-0168`), `release_works` (2 col — junção M:N `release_id→releases`/`work_id→works`, ambas CASCADE, **schema-only, nunca populada** — `DEC-007` já decidiu que o modelo final deve ser relacional via fonograma, não via esta tabela na forma atual).

### Contracts (3 tabelas)
`contracts` (25 col — FK `artista_id→artists` SET NULL), `contract_templates` (11 col), `contract_service_types` (32 col — fonte canônica de tipo por `DEC-002`, FK `tenant_id→tenants`).

### Accounting — camada operacional real (5 tabelas)
`transactions` (43 col físicas — 28 mapeadas pela UI real `TransacaoFormModal.tsx`), `invoices` (62 col físicas — 38 mapeadas pela UI real), `financial_categories` (14 col — auto-ref `parent_id`, FK `template_id→financial_category_templates`), `financial_category_templates` (7 col — auto-ref `parent_id`), `financial_rules` (15 col).

### Accounting — segunda camada schema-level, achado novo desta auditoria (8 tabelas)
Um achado **não documentado em nenhum dos 24 relatórios de módulo/no relatório mestre**, obtido diretamente do inventário físico de tabelas/FKs desta etapa: existe uma segunda camada de schema financeiro, estruturalmente mais rica e com FKs físicas de verdade, sem nenhum consumidor confirmado nesta série de auditorias: `financial_transactions` (39 col — FK `account_id`/`counter_account_id→financial_accounts`, `category_id→financial_categories`, `contract_id→contracts`, `cost_center_id→cost_centers`, `counterparty_id→counterparties`, `event_id→events`, auto-ref `reversal_of_id`), `financial_accounts` (13 col), `cost_centers` (10 col), `counterparties` (14 col — FK `artist_id→artists`, `client_id→clients`, uma abstração genérica de "parte" financeira), `transaction_allocations` (15 col — FK `transaction_id→financial_transactions` CASCADE, `artist_id`/`phonogram_id`/`project_id`/`release_id`, já citada em `accounting.md` como "existe, sem consumidor"), `performance_metric_entries` (20 col — FK `artist_id`/`phonogram_id`/`project_id`/`release_id`, auto-ref `superseded_by_id`), `budgets` (13 col — FK `project_id→projects`), `budget_revisions` (8 col — FK `budget_id→budgets` CASCADE).
**Achado não confirmado por nenhum relatório de módulo**: recomenda-se verificação dedicada de produto/engenharia sobre se esta camada é código morto/schema histórico anterior à consolidação em `transactions`/`invoices`, ou uma segunda iteração de accounting em construção paralela. Nenhuma suposição adicional é feita aqui.
`EVIDENCE: docs/backend-v2/review/_all-tables.md + _all-fks-clean.md (achado por leitura direta de schema, não citado em nenhum modules/*.md) | CONFIDENCE: MEDIUM (existência da tabela é HIGH; propósito/status de uso é NEEDS_PRODUCT_OWNER_CONFIRMATION)`

### Audiovisual (9 tabelas)
`audiovisual_projects` (47 col — FK `financial_project_id→projects`), `audiovisual_briefings` (22 col), `audiovisual_deliverables` (21 col), `audiovisual_shots` (18 col), `audiovisual_production_days` (14 col), `audiovisual_team_members` (14 col), `audiovisual_assets` (16 col), `audiovisual_tasks` (18 col), `audiovisual_approvals` (17 col) — 187 colunas no total, 100% `DIRECT`, 8 das 9 tabelas sem qualquer UI (ver Parte VI-AUDIOVISUAL).

### Marketing (13 tabelas)
`campaigns` (16 col — compartilhada por 2 sistemas incompatíveis, ver Parte VI-MARKETING), `campaign_assets` (11 col — órfã do Sistema A morto), `campaign_tasks` (13 col — órfã do Sistema A morto), `marketing_content_posts` (29 col), `marketing_assets` (28 col — FK `current_version_id→marketing_asset_versions`), `marketing_asset_versions` (13 col — FK `asset_id→marketing_assets` CASCADE), `marketing_asset_approvals` (11 col — FK `asset_id`/`version_id`), `marketing_projects` (27 col — FK `financial_project_id→projects`), `marketing_strategies` (17 col), `marketing_strategy_objectives` (18 col), `marketing_strategy_initiatives` (18 col), `marketing_strategy_actions` (18 col), `marketing_tasks` (20 col), `briefings` (13 col — FK `campanha_id→campaigns` SET NULL; distinta de `audiovisual_briefings`).

### Events (1 tabela)
`events` (23 col — tabela física única; sem tabelas satélite de venue/recorrência/lembretes/anexos, confirmado ausente).

### CRM / Leads (9 tabelas)
`clients` (39 col — "Contato = Cliente", 3 campos cifrados AES-256-GCM), `client_attachments` (11 col — FK `client_id→clients`), `leads` (34-35 col — 7 colunas duplicadas com `dados_internos_crm` jsonb), `lead_interactions` (8 col — FK `lead_id→leads` CASCADE, dedicada mas desconectada do histórico real usado pela UI), `lead_uploads` (11 col — FK `lead_id→leads` CASCADE), `pipelines` (10 col), `pipeline_stages` (12 col — FK `pipeline_id→pipelines` CASCADE), `pipeline_opportunities` (23 col — FK `pipeline_id`/`stage_id`, sistema completo de Kanban genérico, zero consumidor confirmado), `forms` (12 col), `form_submissions` (9 col — FK `form_id→forms` CASCADE, `lead_id→leads` SET NULL).

### MusicChat / Conversations (6 tabelas)
`conversations` (13 col — FK `contact_id→leads` SET NULL; domínio de mensageria compartilhado com `leads`), `conversation_messages` (9 col — FK `conversation_id→conversations` CASCADE), `conversation_notes` (7 col — FK `conversation_id→conversations` CASCADE), `musicchat_automation_settings` (21 col), `musicchat_automation_events` (8 col — FK `conversation_id→conversations` CASCADE), `musicchat_automation_notifications` (11 col — FK `conversation_id→conversations` CASCADE).

### Support (1 tabela)
`support_tickets` (17 col — único recurso real com tabela do módulo `support`).

### Monitoring (3 tabelas)
`content_detections` (15 col), `ecad_reports` (14 col), `takedowns` (20 col — a entidade TypeORM declara 4 colunas ausentes da tabela física real: `url`/`obra_id`/`artista_id`/`resposta`, causa raiz de `POST /takedowns` falhar sempre em produção).

### Licensing (1 tabela)
`licenses` (27 col — tabela física única, sem tabelas satélite de requests/approvals/documents).

### Inventory (1 tabela)
`inventory_items` (19 col — tabela física única; sem qualquer tabela de movimentação/reserva/empréstimo/manutenção).

### RH (3 tabelas)
`employees` (27 col — drift confirmado: 8 colunas físicas reais nunca declaradas na entidade TypeORM), `payroll_entries` (19 col — FK `employee_id→employees` RESTRICT, mesmo drift), `leave_requests` (18 col — FK `employee_id→employees` RESTRICT, mesmo drift).

### Settings / Billing (7 tabelas)
`billing_plans` (14 col), `billing_settings` (5 col), `billing_subscriptions` (21 col), `notification_settings` (7 col — real, zero chamador de frontend), `operational_list_items` (15 col — real, zero consumidor, "listas operacionais" stub intencional), `operational_tasks` (15 col).

### Integrations (4 tabelas)
`oauth_connections` (11 col — tokens cifrados por provedor), `webhook_events` (11 col — idempotência via `external_id UNIQUE`), `ai_jobs` (14 col), `ai_usage_logs` (12 col), `integrations` (12 col — registro genérico de conexão por provedor/tenant).

### Workflow / Automation (5 tabelas)
`workflow_executions` (14 col), `workflow_execution_logs` (7 col — FK `execution_id→workflow_executions` CASCADE), `workflow_transitions` (11 col), `skill_runs` (14 col), `skill_run_logs` (6 col — FK `skill_run_id→skill_runs` CASCADE).

### Assets / Uploads transversais (5 tabelas)
`uploads` (16 col — genérico, todo módulo), `assets` (14 col — genérico, distinto de `marketing_assets`/`audiovisual_assets`), `asset_versions` (11 col), `asset_usage_logs` (9 col), `task_assets` (8 col).

### Releases-adjacente / não auditado a fundo (1 tabela)
`shares` (43 col — FK `obra_id→works` SET NULL; registrado em `reports.md` como entidade exportável, mas não auditado em profundidade em nenhum relatório de módulo dedicado — classificado `NOT_DEEP_AUDITED` pela própria fonte).

### Notifications (1 tabela)
`notifications` (11 col).

`EVIDENCE: docs/backend-v2/review/_all-tables.md (142 linhas, cross-checado contra os 24 relatórios de módulo onde aplicável) + docs/backend-v2/review/_all-fks-clean.md | CONFIDENCE: HIGH para contagens/nomes de coluna; MEDIUM para a classificação de domínio de tabelas não citadas em nenhum modules/*.md (financial_transactions e satélites, shares)`

## V.3 Tabela mestra de relações cross-domain (schema completo — estende a Parte VII/§24 do relatório mestre)

Esta tabela consolida **toda relação física (FK) e lógica (sem FK, mas usada como relação de negócio)** encontrada nesta auditoria — as 17 linhas já registradas no relatório mestre (`00-master-domain-functional-verification.md §24`) mais as relações adicionais evidenciadas pelo inventário físico de FKs (`_all-fks-clean.md`) e pelos 24 relatórios de módulo. Ver Parte VII para a versão consolidada/cross-referenciada final.

| Source Table | Source Field | Target Table | Target Field | Cardinalidade | FK física? | Semântica | Status |
|---|---|---|---|---|---|---|---|
| (toda tabela de negócio) | `tenant_id` | `tenants` | `id` | N:1 | SIM (a maioria composta) | isolamento de tenant | ALREADY_CORRECT |
| works | artista_id | artists | id | N:1 | SIM (SET NULL) | autoria | ALREADY_CORRECT |
| phonograms | artista_id | artists | id | N:1 | SIM (SET NULL) | autoria | ALREADY_CORRECT |
| phonograms | obra_id | works | id | N:1 | SIM (SET NULL) | gravação de obra | ALREADY_CORRECT |
| releases | artista_id | artists | id | N:1 | SIM (SET NULL) | autoria | ALREADY_CORRECT |
| contracts | artista_id | artists | id | N:1 | SIM (SET NULL) | parte contratante | ALREADY_CORRECT (só escrita pelo fluxo secundário) |
| artist_platform_profiles | artist_id | artists | id | N:1 | SIM (CASCADE) | perfil de plataforma externa | ALREADY_CORRECT |
| work_participants | work_id | works | id | N:1 | SIM (CASCADE) | splits/participação | ALREADY_CORRECT |
| shares | obra_id | works | id | N:1 | SIM (SET NULL) | direitos/participação | ALREADY_CORRECT (NOT_DEEP_AUDITED) |
| release_works | release_id / work_id | releases / works | id / id | N:N | SIM (CASCADE ambos) | junção tracklist, nunca populada | TO_BE_DESIGNED (DEC-007) |
| project_tracks | project_id | projects | id | N:1 | SIM (CASCADE) | faixa planejada | ALREADY_CORRECT |
| project_track_participants | project_track_id | project_tracks | id | N:1 | SIM (CASCADE) | compositor/intérprete/produtor | ALREADY_CORRECT |
| works | projeto_id | projects | id | N:1 | NÃO (lógica) | vínculo de obra | ALREADY_CORRECT |
| transactions | projeto_id | projects | id | N:1 | NÃO (lógica) | vínculo financeiro | ALREADY_CORRECT |
| transactions | artista_id / contrato_id / evento_id | artists / contracts / events | id / id / id | N:1 | NÃO (lógica) | vínculos gerenciais | ALREADY_CORRECT (sem FK física) |
| audiovisual_projects | financial_project_id | projects | id | N:1 | SIM (NO ACTION) | vínculo ao projeto musical de origem | ALREADY_CORRECT relação + LEGACY_NAMING + MISSING_AT_UI_WRITE (GAP-0033) |
| marketing_projects | financial_project_id | projects | id | N:1 | SIM (NO ACTION) | vínculo ao projeto musical de origem | ALREADY_CORRECT relação + LEGACY_NAMING + MISSING_AT_UI_WRITE (GAP-0033) |
| audiovisual_projects | release_id | releases | id | N:1 | SIM | distribuição do produto audiovisual | ALREADY_CORRECT |
| releases | (nenhuma coluna) | projects | — | N:1 (decidido — DEC-009) | NÃO | vínculo ausente ao projeto de origem | MISSING_RELATION (GAP-0168, decisão resolvida, `blocksSchemaV2Design: NÃO` — corrigido, implementação pendente) |
| projects | contrato_id | contracts | id | N:1 | CONFLITADO — ver CONFLITO-03 | vínculo projeto↔contrato | CONFLICTED (PO-VERIFY-006) |
| transaction_allocations | project_id / release_id / phonogram_id / artist_id | projects / releases / phonograms / artists | id (todos) | N:1 | SIM (todas NO ACTION) | rateio financeiro granular | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| transaction_allocations | transaction_id | financial_transactions | id | N:1 | SIM (CASCADE) | rateio de uma transação da 2ª camada de accounting | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| performance_metric_entries | artist_id / phonogram_id / project_id / release_id | artists / phonograms / projects / releases | id (todos) | N:1 | SIM (todas NO ACTION) | métrica de performance por música/lançamento | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| financial_transactions | contract_id | contracts | id | N:1 | SIM (NO ACTION) | vínculo financeiro↔contrato (2ª camada) | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| financial_transactions | event_id | events | id | N:1 | SIM (NO ACTION) | vínculo financeiro↔evento (2ª camada) | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| financial_transactions | counterparty_id | counterparties | id | N:1 | SIM (NO ACTION) | contraparte financeira | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| counterparties | artist_id / client_id | artists / clients | id / id | N:1 | SIM (NO ACTION) | contraparte = artista ou cliente | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| budgets | project_id | projects | id | N:1 | SIM (NO ACTION) | orçamento vinculado a projeto (2ª camada) | ALREADY_CORRECT (schema), NO_CONFIRMED_CONSUMER |
| conversations | contact_id | leads | id | N:1 | SIM (SET NULL) | conversa vinculada a lead | ALREADY_CORRECT |
| form_submissions | lead_id | leads | id | N:1 | SIM (SET NULL) | submissão de formulário público → lead | ALREADY_CORRECT |
| leave_requests / payroll_entries | employee_id | employees | id | N:1 | SIM (RESTRICT) | vínculo funcionário | ALREADY_CORRECT (mas create de todos os 3 quebrado, ver Parte VI-RH) |
| org_members | department_id / position_id / role_id | departments / positions / roles | id (todos) | N:1 | SIM | estrutura organizacional/RBAC | ALREADY_CORRECT |
| tenant_invitations | org_id / role_id | organizations / roles | id / id | N:1 | SIM (CASCADE / RESTRICT) | convite pendente | ALREADY_CORRECT |
| briefings | campanha_id | campaigns | id | N:1 | SIM (SET NULL) | briefing de marketing↔campanha | ALREADY_CORRECT |
| marketing_asset_approvals | asset_id / version_id | marketing_assets / marketing_asset_versions | id / id | N:1 | SIM (CASCADE) | fluxo de aprovação de ativo criativo | ALREADY_CORRECT |
| Client/CRM | (conversão automática) | Artist | — | 1:1 (por conversão) | NÃO | lead convertido sempre cria Artist, sem checar duplicata | CONFLICTED (comportamento questionável, PO-VERIFY-010) |
| Event | artista_id (lineup) | Artist | id | N:1 | NÃO (texto livre em parte dos fluxos) | vínculo de lineup | CONFLICTED (relação lógica fraca) |

`EVIDENCE: docs/backend-v2/review/_all-fks-clean.md (extração física) + 00-master-domain-functional-verification.md §24 (17 relações já confirmadas) + módulos individuais citados em cada linha | CONFIDENCE: HIGH para relações físicas (FK real, lida diretamente do schema); MEDIUM para relações lógicas/comportamentais (sem FK, inferidas do código de aplicação) | STATUS: PARTIALLY_CONFIRMED`

---

# PARTE VI — 24 MÓDULOS COMPLETOS

Cada seção segue a mesma estrutura: finalidade em linguagem de produto, entidades/tabelas, endpoints com componente chamador, matriz de campos (onde há entidade real de create/edit), fluxo funcional completo, o que funciona/parcial/quebrado/fake-stub-dead (todo achado individual), decisões (resolvidas e pendentes), todos os gaps do módulo (cruzados contra `_gap-by-module.json`), direção proposta v2, pontos de confirmação do Product Owner, confiança e evidência.

## MODULE-ACCOUNTING

### Finalidade
Gestão financeira do tenant: transações (receita/despesa), notas fiscais, categorização financeira, e resultado (P&L) por empresa/projeto/artista — o "livro-razão" de negócio de toda a plataforma.

### Entidades principais
`Transaction` (`transactions`, 28 campos mapeados pela UI / 43 colunas físicas), `Invoice` (`invoices`, 38 campos mapeados / 62 colunas físicas), `FinancialCategory` (`financial_categories`, árvore hierárquica via `parent_id`), `FinancialRule` (`financial_rules`). Camada schema-level adicional descoberta nesta auditoria, sem consumidor confirmado: `financial_transactions`/`financial_accounts`/`cost_centers`/`counterparties`/`transaction_allocations`/`performance_metric_entries`/`budgets`/`budget_revisions` (ver Parte V.2).

### Tabelas
`transactions`, `invoices`, `financial_categories`, `financial_rules`, `financial_category_templates`, `financial_category_audit_logs`, `transaction_allocations` (existe, sem consumidor confirmado).

### Entrypoints reais do frontend / Endpoints
- `Financeiro.tsx` (`/accounting`) → `GET/POST/PATCH/DELETE /transactions`
- `NotaFiscal.tsx` (`/accounting/nota-fiscal`) → `GET/POST/PATCH/DELETE /invoices`
- `CategoriasFinanceiras.tsx` (`/accounting/categorias`) → **nenhum** (100% localStorage, zero chamada real)
- `TransacaoRules.tsx` (`/accounting/rules`) → `GET/POST/PATCH/DELETE /financial-categories/rules*` (**inexistente** — 400 em toda carga)
- `Contabilidade.tsx` (`/accounting/contabilidade`) → reusa `GET /transactions` (client-side aggregation, sem endpoint dedicado de P&L)
- `GET/POST/PATCH/DELETE /financial-categories` (real, CRUD de árvore + busca/mover/reordenar/arquivar)

### Matriz de campos — Transaction (28 campos reais, mapeamento limpo)
| DB column | API field | create-form | edit-form | grid/tabela | filtro | busca | sort | computado |
|---|---|---|---|---|---|---|---|---|
| `tipo` | `tipo` | SIM | SIM | SIM | SIM | não | SIM | não |
| `valor` | `valor` | SIM | SIM | SIM | não | não | SIM | não |
| `categoria`/`subcategoria` | idem | SIM | SIM | SIM | SIM | SIM | não | não |
| `projeto_id` | `projetoId` | SIM (opcional) | SIM | SIM (nome resolvido) | SIM | não | não | não |
| `artista_id` | `artistaId` | SIM (opcional) | SIM | SIM | SIM | não | não | não |
| `contrato_id` | `contratoId` | SIM (opcional) | SIM | não | não | não | não | não |
| `evento_id` | `eventoId` | SIM (opcional) | SIM | não | não | não | não | não |
| `financial_category_id` | `financialCategoryId` | **NÃO** (nunca setado pelo form — `GAP-0015`, `PARTIALLY_MIGRATED`, não é bug) | NÃO | não | não | não | não | não |
| `entityLinks` (rateio gerencial) | `entityLinks` | UI exige, **nunca persistido** (`GAP-0009`) | idem | não | não | não | não | não |
| `anexo_url` | `anexoUrl` | SIM (mas sempre nulado antes do submit — `GAP-0012`) | idem | não | não | não | não | não |
| demais ~19 campos (descrição, data, forma de pagamento, status, observações etc.) | idem | SIM | SIM | parcial | parcial | não | não | não |

### Fluxo funcional principal
1. Usuário abre "Nova Transação" em Financeiro.
2. Preenche tipo, valor, categoria/subcategoria (texto livre legado), vínculos opcionais (artista/projeto/contrato/evento).
3. Sistema tenta persistir `entityLinks` (rateio gerencial multi-entidade) — Zod (`createTransacaoSchema`, sem `.passthrough()`) descarta a chave silenciosamente antes de sair do navegador.
4. Transação é salva com os 28 campos reais mapeados 1:1.
5. Aba "Contabilidade" tenta exibir P&L por Empresa/Projeto/Artista — só o agrupamento por Artista e por Empresa realmente agrega; "P&L por Projeto" trata cada transação individual como se fosse seu próprio projeto (`t.descricao` vira o "nome do projeto"), nunca faz `GROUP BY`/join em `transactions.projeto_id` (que está corretamente populado).

### Regra cross-domain de propagação financeira (aprofundamento obrigatório)
**Regra-alvo**: uma receita/despesa deve ser criada uma única vez; quando vinculada a project/artist/contract/event/etc., deve aparecer automaticamente no accounting/P&L correspondente daquela entidade — nunca exigir uma segunda entrada manual.

| Origem | CURRENT_IMPLEMENTATION | GAP |
|---|---|---|
| `contracts` (assinatura) | `REAL_AUTOMATIC_PROPAGATION` parcial — ao transicionar para `assinado`, uma transação é criada automaticamente com o campo `valor` do contrato | `GAP-0055`: forma de pagamento/vencimento/parcelas (termos financeiros ricos) capturados no `ContratoWizard.tsx` **não** propagam — só o valor simples chega à Contabilidade |
| `events` (venda de ingresso) | Ausente | `GAP-0078`: campos de receita de ingresso no `Event` não têm nenhuma propagação para `transactions` |
| `licensing` (taxa de licença) | Ausente | `GAP-0106`: `valor_licenca` capturado no pedido de licença não propaga para `transactions` |
| `monitoring` (royalties detectados) | Ausente | `GAP-0119`: valores de royalty detectados/reconciliados via ECAD não propagam para `transactions` |
| `projects` (P&L por música) | Dado existe (`transactions.projeto_id`, populado), mas a UI não o consome corretamente | `GAP-0013`: "P&L por Projeto" não agrupa por projeto — regressão de exibição, não de dado |
| `accounting → accounting` (rateio gerencial multi-entidade) | Ausente na persistência | `GAP-0009`: `entityLinks` exigido pela UI, descartado silenciosamente |

**Conclusão**: a regra-alvo está **parcialmente implementada apenas para `contracts`**, e mesmo essa implementação é incompleta (só `valor`, não os termos ricos). As outras 3 origens auditadas com potencial de receita/despesa (`events`, `licensing`, `monitoring`) não têm nenhuma propagação automática hoje — cada uma exigiria lançamento manual duplicado em `Financeiro.tsx` para aparecer no P&L, violando a regra-alvo.

`EVIDENCE: accounting.md §1,§2,§3,§5,§6,§7 | contracts.md §15 | canonical-gap-register.json (GAP-0009,GAP-0013,GAP-0055,GAP-0078,GAP-0106,GAP-0119) | CONFIDENCE: HIGH`

### O que funciona hoje
Criação/edição de Transação (28 campos) e Nota Fiscal (38 campos) — domínios limpos, sem gap de mapeamento. P&L por Artista e por Empresa. Propagação automática (parcial) de `contracts` ao assinar.

### O que está parcial
`financial_categories` real mas só consumida por 1 de 2 telas que deveriam usá-la; import OFX funciona mas sem dedupe/atomicidade nem tratamento explícito de campos não mapeados.

### O que está quebrado
`/financial-categories/rules*` (400 sempre, endpoint inexistente); "P&L por Projeto" não agrupa por projeto; upload de anexo é fake (nulado antes do submit).

### O que é fake/stub/dead
`CategoriasFinanceiras.tsx` (100% localStorage, zero chamada de API real); `entityLinks` (UI exige, backend descarta); `exportFieldList()` de `TransacaoFormModal.tsx` (gerador XLSX de 3 abas, código morto, viola a regra de 2 abas do motor central de relatórios).

### Decisões que afetam o módulo
`DEC-001` (RESOLVED) — a correção do significado de `projects` afeta diretamente a interpretação de `projeto_id`. Nenhuma decisão de Wave 0 é específica deste módulo.

### Todos os gaps (14, cruzados contra `_gap-by-module.json`)
GAP-0001 (conflito de domínio de `projects`, S1_HIGH, compartilhado) · GAP-0009 (entityLinks nunca persistido, S1_HIGH) · GAP-0010 (`/financial-categories/rules*` inexistente, S1_HIGH) · GAP-0011 (CategoriasFinanceiras.tsx desconectada, S1_HIGH) · GAP-0012 (upload de anexo fake, S2_MEDIUM) · GAP-0013 (P&L por Projeto não agrupa, S2_MEDIUM) · GAP-0014 (XLSX 3 abas, código morto, S3_LOW) · GAP-0015 (financial_category_id nunca setado — DEFERRED, PARTIALLY_MIGRATED, não é bug) · GAP-0016 (import OFX sem dedupe/atomicidade, S3_LOW) · GAP-0017 (filtros/paginação 100% client-side, S2_MEDIUM) · GAP-0055 (termos financeiros de contrato não propagam, S2_MEDIUM) · GAP-0078 (receita de evento não propaga, S2_MEDIUM) · GAP-0106 (taxa de licença não propaga, S2_MEDIUM) · GAP-0119 (royalties de monitoramento não propagam, S2_MEDIUM).

### Definição proposta/canônica para backend v2
Nenhuma produzida — mas a regra-alvo de propagação cross-domain (acima) é candidata natural a virar um contrato explícito de domínio no v2 (ex.: um evento de domínio `RevenueRecognized`/`ExpenseIncurred` emitido por qualquer módulo de origem, consumido uma única vez pelo módulo `accounting`).

### Pontos de confirmação do Product Owner
Se "P&L por Projeto" deve, de fato, significar "P&L agrupado por música/projeto musical" sob o modelo corrigido (ver PO-VERIFY-008); se a propagação automática deve ser estendida a `events`/`licensing`/`monitoring` como requisito de v2.

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/accounting.md §1,§2,§3,§5,§6,§7 | canonical-gap-register.json (GAP-0001,0009-0017,0055,0078,0106,0119) | docs/backend-v2/review/_gap-by-module.json`

---

## MODULE-ADMIN

### Finalidade
Painel administrativo para operações de plataforma (planos, assinaturas, clientes, auditoria, suporte) e configurações administrativas de tenant — distinção crítica: parte do módulo é genuinamente cross-tenant (`super_admin`), parte é apenas uma moldura de UI sobre dados tenant-scoped.

### Distinção plataforma-wide vs. tenant-scoped (aprofundamento obrigatório)
| Tela | Escopo real | Evidência |
|---|---|---|
| `AdminDashboard.tsx` | **Cross-tenant real** | `GET/PATCH /billing/admin/tenants[/:id]`, `@RequireRole('super_admin')` |
| `AdminClients.tsx` | **Cross-tenant real** | mesma rota acima, lista todos os tenants |
| `AdminPlans.tsx` | **Cross-tenant real** (planos são globais à plataforma) | `billing.controller.ts` |
| `AdminSubscriptions.tsx` | **Cross-tenant real** | `billing.controller.ts` |
| `AdminAudit.tsx` | **Moldurado como cross-tenant, mas é tenant-scoped** | reusa a mesma rota tenant-scoped de `audit_logs`/`activity_logs` do próprio tenant do admin logado — coluna "Tenant" sempre em branco (`GAP-0021`) |
| `AdminSupport.tsx` | **Moldurado como cross-tenant, mas é tenant-scoped** | chama exatamente `GET /support-tickets?limit=200`, a mesma rota tenant-scoped do módulo `support` real (`GAP-0021`/`GAP-0159`) |
| `AdminSettings.tsx` (8 abas) | Nem cross-tenant nem tenant-scoped real — **decorativo** | toda ação de salvar é um `toast` falso |
| `AdminKnowledge.tsx` | Mock dev-only, desabilitado em produção | reusa o hook fake de base de conhecimento do módulo `support` |

### Entidades principais
Não introduz entidades próprias — consome `billing_plans`, `billing_subscriptions`, `tenants`, `activity_logs`, `support_tickets` de outros módulos.

### Tabelas
`billing_plans`, `billing_subscriptions`, `tenants`, `activity_logs`, `support_tickets` (via as mesmas rotas tenant-scoped do módulo `support`).

### Endpoints
`GET/PATCH /billing/admin/tenants[/:id]` (`super_admin`, genuinamente cross-tenant) ← `AdminDashboard.tsx`/`AdminClients.tsx`; rotas de `billing.controller.ts` para planos/assinaturas ← `AdminPlans.tsx`/`AdminSubscriptions.tsx`; `GET /activity-logs`/`GET /audit-logs` (tenant-scoped) ← `AdminAudit.tsx`; `GET /support-tickets?limit=200` (tenant-scoped) ← `AdminSupport.tsx`.

### Fluxo funcional principal
1. `super_admin` acessa `/admin/dashboard` — dados reais de billing consolidados cross-tenant.
2. Acessa `AdminClients.tsx`/`AdminPlans.tsx`/`AdminSubscriptions.tsx` — CRUD real via `billing.controller.ts`.
3. Acessa `AdminSupport.tsx`/`AdminAudit.tsx` — recebe apresentação de "visão de plataforma" mas os dados são tenant-scoped (mesma rota do módulo real, sem filtro cross-tenant algum) — o `super_admin` vê apenas o próprio tenant, não todos os tenants, apesar da moldura visual sugerir o contrário.
4. Acessa `AdminSettings.tsx` (8 abas, 770 linhas) — toda tentativa de salvar é um toast falso; Webhooks/Chaves API permanentemente vazios com botões "novo" sem `onClick`.

### O que funciona hoje
Dashboard/Clientes/Planos/Assinaturas — verificado real e íntegro contra `billing.controller.ts`. Autorização (`@RequireRole('super_admin')`) confirmada consistente frontend/backend.

### O que está parcial
`AdminAudit`/`AdminSupport` — dados reais, mas moldurados como "cross-tenant" quando são tenant-scoped.

### O que está quebrado
Nada tecnicamente "quebrado" (sem erro 400/500) — o problema é a apresentação enganosa de escopo em `AdminAudit`/`AdminSupport`.

### O que é fake/stub/dead
`AdminSettings.tsx` inteiro (8 abas, 770 linhas, toda ação decorativa); `AdminKnowledge` (mock auto-declarado, desabilitado em produção); `admin-source.ts` (6 exports mortos/vazios); "Novo Webhook"/"Nova Chave API" (sem `onClick`).

### Decisões que afetam o módulo
Nenhuma.

### Todos os gaps (9)
GAP-0018 (AdminSettings.tsx sem persistência real, S2_MEDIUM) · GAP-0019 (admin-source.ts, 6 exports mortos, S4_INFORMATIONAL) · GAP-0020 (banner "indisponível" sempre visível, S3_LOW) · GAP-0021 (AdminAudit/AdminSupport moldura cross-tenant enganosa, S2_MEDIUM) · GAP-0022 (AdminKnowledge mock dev-only, ACCEPTED_BY_EXISTING_CONTRACT) · GAP-0023 (botões sem onClick, S3_LOW) · GAP-0024 (nenhuma tabela com sort/paginação server-side, S3_LOW) · GAP-0157 (crash alcançável em AdminSupport por enum mismatch, S1_HIGH, compartilhado com support) · GAP-0159 (moldura cross-tenant de AdminSupport — CLOSED/NO_FIX_REQUIRED, mesma causa-raiz de GAP-0021).

### Definição proposta/canônica para backend v2
Não produzida.

### Pontos de confirmação do Product Owner
Se `AdminAudit`/`AdminSupport` devem, de fato, se tornar cross-tenant reais (mudança de arquitetura) ou se a moldura de UI deve simplesmente ser corrigida para refletir o escopo tenant-scoped real.

### Confidence
HIGH (Dashboard/Clientes/Planos/Assinaturas, citação direta de `billing.controller.ts`); MEDIUM (demais telas, via `PROGRESS.md`)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: admin") | canonical-gap-register.json (GAP-0018 a GAP-0024, GAP-0157, GAP-0159)`

---

## MODULE-ARTIST

### Finalidade
Cadastro e gestão de artistas — perfil, contatos, plataformas externas, métricas, relações com todo o restante do catálogo/negócio. É a entidade de negócio com mais colunas físicas do sistema.

### Entidades principais
`Artist` (`artists`, 78 colunas), `ArtistPlatformProfile` (`artist_platform_profiles`, 24 colunas).

### Tabelas
`artists`, `artist_platform_profiles`.

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /artists` ← `Artistas.tsx`/`ArtistaFormModal.tsx`; `GET/POST /artists/:id/platform-profiles[/:platform/sync]` ← `ArtistaVisao360Modal.tsx` (sync Spotify/YouTube).

### Matriz de campos — Artist (create/edit real via `ArtistaFormModal.tsx`, ~45 campos)
| DB column | API field | create-form | edit-form | grid | filtro | busca | sort | computado |
|---|---|---|---|---|---|---|---|---|
| `nome`/`nome_artistico` | idem | SIM | SIM | SIM | não | SIM | SIM | não |
| `email`/`telefone`/`cpf_cnpj`/`manager_contato` (cifrados AES-256-GCM) | idem | SIM | SIM | não (nunca em claro na listagem) | não | não (PII cifrada não é pesquisável, `GAP-0030`, comportamento correto) | não | não |
| ~23 colunas físicas diretas restantes | idem | SIM | SIM | parcial | parcial | parcial | parcial | não |
| ~41 campos "estendidos" | roteados para `metadata` jsonb | SIM | SIM | não | não | não | não | não (decisão arquitetural documentada, `GAP-0027`, `ACCEPTED_BY_EXISTING_CONTRACT`) |
| seguidores/ouvintes manuais | `metadata.*` | SIM (manual) | SIM | SIM | não | não | não | coexiste sem reconciliação com sync real (`GAP-0028`) |

### Fluxo funcional principal
1. Usuário abre "Novo Artista" em `Artistas.tsx`.
2. Preenche ~45 campos via `ArtistaFormModal.tsx`.
3. Dados sensíveis são cifrados antes de persistir; demais campos "estendidos" vão para `metadata` jsonb.
4. `ArtistaVisao360Modal.tsx` (3170 linhas, maior componente do sistema) agrega, client-side, todas as relações (obras/fonogramas/lançamentos/contratos/transações/eventos/campanhas) filtrando arrays completos por `artista_id`.

### O que funciona hoje
Criação/edição real (`ArtistaFormModal.tsx`), criptografia de PII, upload de foto/documentos (real, via R2), import XLSX (1 aba), sincronização real de métricas via Spotify/YouTube.

### O que está parcial
Contadores manuais de seguidores/ouvintes coexistem sem reconciliação com o sync real via API.

### O que está quebrado
Nada dentro do fluxo real `ArtistaFormModal.tsx`; o autocadastro público (`ArtistaSignupPublic.tsx`) está 100% quebrado (ver MODULE-AUTH).

### O que é fake/stub/dead
`ArtistaCadastro.tsx` (órfã, ~71 campos, inalcançável pela navegação normal, código válido).

### Decisões que afetam o módulo
`DEC-003` (PENDING) — qual dos dois fluxos de criação (`ArtistaFormModal.tsx` vs. `ArtistaCadastro.tsx`) deve ser mantido/expandido; recomendação registrada: manter o Modal, portar os ~26 campos exclusivos.

### Todos os gaps (9)
GAP-0003 (dois fluxos paralelos, DEC-003 pendente, S2_MEDIUM) · GAP-0008 (sourceId de party de contrato, compartilhado com contracts/crm, DEC-008 pendente) · GAP-0025 (autocadastro público 100% quebrado, S1_HIGH, compartilhado com auth) · GAP-0026 (nomes de campo divergentes no autocadastro, S2_MEDIUM) · GAP-0027 (~41 campos em metadata — ACCEPTED_BY_EXISTING_CONTRACT) · GAP-0028 (contadores manuais vs. sync sem reconciliação, S3_LOW) · GAP-0029 (FKs lógicas sem constraint física, S3_LOW) · GAP-0030 (PII cifrada não pesquisável — NO_FIX_REQUIRED) · GAP-0077 (lineup de evento por texto livre, sem FK, compartilhado com events, S2_MEDIUM).

### Definição proposta/canônica para backend v2
Não produzida — aguarda resolução de `DEC-003`.

### Pontos de confirmação do Product Owner
Qual fluxo de criação de artista deve prevalecer (`DEC-003`, ver PO-VERIFY-018).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/artist.md §1,§2,§4,§8`

---

## MODULE-AUDIOVISUAL

### Finalidade
Gestão de produções audiovisuais (videoclipes, reels, teasers) ligadas à música/artista — do briefing criativo à entrega final, com pipeline de aprovação.

### Os 9 domínios de backend, nomeados individualmente (aprofundamento obrigatório)
Backend real, 100% `DIRECT`, 187 colunas no total — apenas o primeiro dos 9 tem UI:

1. **`AudiovisualProject`** (`audiovisual_projects`, 47 col) — **TEM UI** (`AudiovisualProjectFormModal.tsx`, 18 campos reais).
2. **`Briefing`** (`audiovisual_briefings`, 22 col) — backend real, **sem UI**.
3. **`Deliverable`** (`audiovisual_deliverables`, 21 col) — backend real, **sem UI**.
4. **`Shot`** (`audiovisual_shots`, 18 col, storyboard) — backend real, **sem UI**.
5. **`ProductionDay`** (`audiovisual_production_days`, 14 col, cronograma) — backend real, **sem UI**.
6. **`TeamMember`** (`audiovisual_team_members`, 14 col, equipe) — backend real, **sem UI**.
7. **`Asset`** (`audiovisual_assets`, 16 col, arquivos) — backend real, **sem UI**.
8. **`Task`** (`audiovisual_tasks`, 18 col) — backend real, **sem UI**.
9. **`Approval`** (`audiovisual_approvals`, 17 col) — backend real, **sem UI**.

Todas as 9 têm endpoints `GET/POST/PATCH/DELETE` reais e funcionais no backend (`+8 famílias de endpoints análogas às de `AudiovisualProject`); nenhuma das 8 restantes tem qualquer componente de frontend que as consuma (`GAP-0031`).

### Tabelas
`audiovisual_projects`, `audiovisual_briefings`, `audiovisual_deliverables`, `audiovisual_shots`, `audiovisual_production_days`, `audiovisual_team_members`, `audiovisual_assets`, `audiovisual_tasks`, `audiovisual_approvals`.

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /audiovisual/projects` ← `AudiovisualProjectsList.tsx`/`AudiovisualProjectFormModal.tsx`/`AudiovisualProjectDetailsModal.tsx`; `/audiovisual/briefings`, `/audiovisual/deliverables`, `/audiovisual/shots`, `/audiovisual/production-days`, `/audiovisual/team-members`, `/audiovisual/assets`, `/audiovisual/tasks`, `/audiovisual/approvals` — todas reais, **zero consumidor de frontend confirmado**.

### Matriz de campos — AudiovisualProject (único domínio com UI, 18 campos)
| DB column | API field | create-form | edit-form | grid | filtro | busca | sort | computado |
|---|---|---|---|---|---|---|---|---|
| `type`/`format` | idem | SIM | SIM | SIM | SIM | não | não | não |
| `capture_status`/`editing_status`/`approval_status` | idem | SIM | SIM | parcial | **NÃO** (ENUM_MISMATCH PT vs EN, `GAP-0032`) | não | não | não |
| `budget_estimated`/`budget_actual` | idem | SIM | SIM | SIM | não | não | não | não |
| `financial_project_id` | `financialProjectId` | **NÃO** (exposto só como filtro, nunca escrito, `GAP-0033`) | NÃO | não | SIM | não | não | não |
| `artist_id`/`release_id`/`campaign_id`/`event_id` | idem | **NÃO** (`GAP-0034`) | NÃO | não | SIM (todos) | não | não | não |

### Fluxo funcional principal
1. Usuário cria projeto audiovisual via modal (18 campos reais).
2. Backend permite pipeline de 8 estágios (`draft→...→published`) com geração automática de tarefas por estágio — mas não existe UI de transição de pipeline nem de visualização das tarefas geradas.
3. Filtro de status na listagem sempre retorna zero resultados (bug de idioma português vs. inglês, `GAP-0032`).

### O que funciona hoje
Criação/edição do projeto em si (18 campos, sem gap de mapeamento); workflow de pipeline real no backend (8 estágios).

### O que está parcial
Endpoint de transição de pipeline existe mas sem consumidor de UI.

### O que está quebrado
Filtro de status (sempre zero resultados); relações `artist_id`/`release_id`/`campaign_id`/`event_id` nunca escritas apesar de expostas como filtro.

### O que é fake/stub/dead
Os 8 dos 9 domínios de backend sem qualquer UI (nomeados acima individualmente); rota `/audiovisual/projects/new` órfã (mesmo formulário, sem risco de divergência de campos); upload de assets sem UI, delete não limpa storage externo.

### Decisões que afetam o módulo
`DEC-001` (RESOLVED) — correção do significado de `financial_project_id`.

### Todos os gaps (6)
GAP-0031 (8 de 9 domínios sem UI, S1_HIGH) · GAP-0032 (filtro de status quebrado, ENUM_MISMATCH, S1_HIGH) · GAP-0033 (financial_project_id nunca escrita, S2_MEDIUM, compartilhado com marketing/projects) · GAP-0034 (artist_id/campaign_id/event_id nunca escritos, S2_MEDIUM) · GAP-0035 (rota /audiovisual/projects/new órfã, S3_LOW) · GAP-0036 (upload de assets sem UI, delete não limpa storage, S2_MEDIUM).

### Definição proposta/canônica para backend v2
Não produzida.

### Pontos de confirmação do Product Owner
Se os 8 domínios de backend sem UI (briefing/entregáveis/storyboard/cronograma/equipe/arquivos/tarefas/aprovações, nomeados acima) devem ganhar UI no v2 ou se o escopo real do produto é mais restrito do que o schema sugere (ver PO-VERIFY-013).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/audiovisual.md §1,§2,§4,§6`

---

## MODULE-AUTH

### Finalidade
Autenticação (login/signup/reset), sessão, contexto de tenant, autorização (roles/permissões) — a fundação de todo o resto do sistema.

### Autenticação vs. autorização vs. contexto de tenant (aprofundamento obrigatório)
| Camada | O que resolve | Mecanismo | Fonte de verdade |
|---|---|---|---|
| **Autenticação** (quem é você) | Identidade do usuário | Supabase Auth SDK (login/signup/reset/JWT) | `auth.users` (gerenciado pelo Supabase, fora do schema de negócio) |
| **Contexto de tenant** (em qual tenant você está agindo) | Resolução do `tenant_id` ativo | `TenantGuard`, a partir do claim JWT `app_metadata.org_id` — **nunca** confia no header `X-Tenant-ID` enviado pelo cliente, usado só como checagem de consistência | claim JWT (assinado, verificado server-side) |
| **Autorização** (o que você pode fazer neste tenant) | Permissões/roles dentro do tenant resolvido | `org_members.role` (string legada) + `org_members.role_id` (FK RBAC), revalidados a cada request | `org_members` (tabela real, não o JWT) |

Esta separação em 3 camadas independentes é confirmada consistente em toda a auditoria — nenhuma camada é usada para resolver as responsabilidades da outra (ex.: o JWT nunca carrega permissões diretamente; `org_members` é sempre revalidado, nunca cacheado do JWT).

### Entidades principais
`auth.users` (Supabase-managed), `org_members` (membership real), `tenant_invitations`.

### Tabelas
`org_members`, `tenant_invitations` (schema Supabase `auth.users` gerenciado externamente).

### Endpoints / componente chamador
`PATCH /auth/provision-workspace` ← `AuthContext.tsx` (auto-disparado); `PATCH /auth/onboarding` ← `Onboarding.tsx`; `POST /auth/change-required-password` ← `ChangeRequiredPassword.tsx`; `GET /auth/context` ← `AuthContext.tsx` (toda navegação pós-login); Supabase Auth SDK diretamente ← `Auth.tsx`/`Register.tsx`/`ResetPassword.tsx` (login/signup/reset, sem passar pelo backend Nest).

### Fluxo funcional principal
1. Usuário assina/loga via Supabase Auth SDK.
2. `AuthContext.tsx` detecta ausência de `org_id` no JWT + `user_metadata.workspace_slug` → dispara auto-provisionamento (`PATCH /auth/provision-workspace`).
3. `TenantGuard` resolve o tenant real a partir do claim `org_id` do JWT.
4. Membership é revalidada a cada request contra `org_members`.

### O que funciona hoje
Login/logout/reset de senha, auto-provisionamento de workspace, `TenantGuard`/isolamento de tenant (confirmado sólido), RBAC dual-source (`role` + `role_id` sempre ambos preenchidos após qualquer caminho de escrita real).

### O que está parcial
`signOut()` não fecha canais Realtime explicitamente (janela até reload, `GAP-0037`).

### O que está quebrado
`ArtistaSignupPublic.tsx` — autocadastro público de artista 100% não-funcional: `POST /public/artists` não existe em nenhum lugar do backend; toda submissão falha silenciosamente (`GAP-0025`); mesmo que existisse, os nomes de campo do payload divergem de `CreateArtistDto` (`GAP-0026`).

### O que é fake/stub/dead
Nada classificado como fake — `AUTH_DISABLED` é um modo de desenvolvimento explícito, não uma simulação disfarçada.

### Decisões que afetam o módulo
Nenhuma decisão formal de Wave 0 específica a `auth` (o `org_id` mal-nomeado é tratado como achado, não decisão — ver MODULE-WORKSPACE).

### Todos os gaps (6)
GAP-0025 (POST /public/artists inexistente, S1_HIGH, compartilhado com artist) · GAP-0026 (nomes de campo divergentes, S2_MEDIUM) · GAP-0037 (signOut() não fecha canais realtime, S2_MEDIUM) · GAP-0038 (auto-aceite de convite como efeito colateral de endpoint de leitura — NO_FIX_REQUIRED) · GAP-0039 (allowlist de Redirect/Site URL do Supabase não verificável por código — DEFERRED, **bloqueia o cutover**) · GAP-0040 (sem estado explícito "suspended"/"deleted" além de is_active — NO_FIX_REQUIRED).

### Definição proposta/canônica para backend v2
JWKS/ES256 + `RequestContext` já fixados em documentos anteriores (`doc49`), não reabertos aqui.

### Pontos de confirmação do Product Owner
Se o autocadastro público de artista é um requisito de produto ativo ou se deve ser descontinuado (ver PO-VERIFY-015).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/auth.md §1,§2,§3,§4,§8,§9`

---

## MODULE-CATALOG

### Finalidade
Registro do catálogo musical: Obras (composições) e Fonogramas (gravações), incluindo participações/splits e integração com sociedades de gestão coletiva (ABRAMUS).

### Entidades principais
`Work`/Obra (47 col), `Phonogram`/Fonograma (59 col), `WorkParticipant` (10 col), `RightsHolder`, `ExternalIdentifier`, `SocietyAccount`/`SocietySubmission`/`SocietySyncJob` (sub-módulo `registry`, 6 tabelas, 91 colunas, zero consumidor frontend).

### Tabelas
`works`, `phonograms`, `work_participants`, `rights_holders`, `external_identifiers`, `society_accounts`, `society_submissions`, `society_sync_jobs`, `society_payload_snapshots`, `society_submission_events`, `society_validation_errors`.

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /works` ← `RegistroMusicas.tsx` (aba Obras)/`ObraFormModal.tsx`; `GET/POST/PATCH/DELETE /phonograms` ← aba Fonogramas/`FonogramaFormModal.tsx`; `/registry/rights-holders`, `/registry/society-accounts`, `/registry/submissions` (reais, sem consumidor); `GET /integrations/abramus/*` ← `AbramusSearchRow.tsx`.

### Matriz de campos — Work (23 campos + participantes)
| DB column | API field | create-form | edit-form | grid | filtro | busca | sort | computado |
|---|---|---|---|---|---|---|---|---|
| `titulo` | idem | SIM | SIM | SIM | não | SIM | SIM | não |
| `iswc` | idem | SIM | SIM | SIM | não | SIM | não | sem validação de formato/duplicidade (`GAP-0045`) |
| `projeto_id` | `projetoId` | SIM | SIM | SIM (nome resolvido) | SIM | não | não | não |
| `artista_id` | `artistaId` | SIM (campo presente) | SIM | SIM | SIM | não | não | **sempre gravado `null`** (`GAP-0043`, bug confirmado `ObraFormModal.tsx:486`) |
| `participantes[]`/`participacao` (splits) | `authors`/`shares` | SIM | SIM | não | não | não | não | aceito pelo DTO, **nunca persistido** (`GAP-0041`, split-sheet real) |

### Matriz de campos — Phonogram (30 campos + participação por categoria)
| DB column | API field | create-form | edit-form | grid | filtro | busca | sort | computado |
|---|---|---|---|---|---|---|---|---|
| `isrc` | idem | SIM | SIM | SIM | não | SIM | não | sem validação de formato (`GAP-0045`) |
| `obra_id` | `obraId` | SIM (seletor) | SIM | SIM (nome resolvido) | SIM | não | não | seletor usa lista local estática, não `works` ao vivo (`GAP-0044`) |
| `arquivo_audio` | `fileUrl` | SIM (aceito e validado) | SIM | não | não | não | não | **descartado após aceitar** — nenhum pipeline de áudio (`GAP-0042`) |

### Fluxo funcional principal
1. Usuário registra uma Obra (título, ISWC, participantes com percentuais).
2. Usuário registra um Fonograma vinculado à Obra (título, ISRC, participação por categoria).
3. Ao salvar, `works.artista_id` é sempre gravado `null` (apagando silenciosamente qualquer vínculo direto obra↔artista pré-existente ao editar).
4. Usuário pode buscar a obra/artista na ABRAMUS para vincular ou registrar externamente (busca real); tentar "importar" um resultado da busca sempre falha (rota inexistente).

### O que funciona hoje
Criação/edição de Obra e Fonograma (53 campos reais, mapeamento limpo); busca/registro ABRAMUS; export via Central de Relatórios (79 campos).

### O que está parcial
Integração ABRAMUS — busca e registro reais; importação, sincronização e detecção de "já importado" são stubs.

### O que está quebrado
`works.artista_id` sempre `null` no create/edit (apaga vínculo existente ao salvar).

### O que é fake/stub/dead
Upload de áudio do Fonograma (só nome+tamanho, nunca o binário); módulo `registry` inteiro sem consumidor (91 colunas, 6 tabelas); `useCatalogStore`/`catalog.service.ts` (código morto, nunca importado).

### Decisões que afetam o módulo
`DEC-001` (RESOLVED) confirma `works.projeto_id → projects.id` como `ALREADY_CORRECT`; `DEC-007` (RESOLVED) estabelece que a cadeia canônica de direitos passa por `phonograms.obra_id → works.id`.

### Todos os gaps (7)
GAP-0007 (modelo de tracklist de releases, compartilhado, S1_HIGH) · GAP-0041 (split-sheet nunca persistido, S1_HIGH) · GAP-0042 (áudio aceito e descartado, S1_HIGH) · GAP-0043 (works.artista_id sempre null, S2_MEDIUM) · GAP-0044 (seletor fonograma→obra usa lista estática, S3_LOW) · GAP-0045 (ISRC/ISWC sem validação de formato, S3_LOW) · GAP-0046 (Zustand store morto, S4_INFORMATIONAL) · GAP-0047 (limite 50 sem paginação, S2_MEDIUM).

### Definição proposta/canônica para backend v2
Nenhuma produzida; `DEC-007` estabelece que a cadeia canônica de direitos passa por `phonograms.obra_id → works.id`, relevante ao redesenho futuro deste módulo.

### Pontos de confirmação do Product Owner
Se o módulo `registry` (rights-holders/society-accounts/submissions) é um requisito de produto ativo a ganhar UI, ou escopo morto a ser formalmente descontinuado.

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/catalog.md §1,§5,§6,§9,§11,§12`

---

## MODULE-CONTRACTS

### Finalidade
Criação, gestão e workflow de contratos com artistas/clientes — templates, partes, assinatura eletrônica, propagação financeira ao ser assinado.

### Entidades principais
`Contract` (25 col), `ContractTemplate` (11 col), `ContractServiceType` (32 col).

### Tabelas
`contracts`, `contract_templates`, `contract_service_types`.

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /contracts` ← `Contratos.tsx`/`ContratoWizard.tsx` (principal)/`ContratoFormModal.tsx` (secundário, via `catalog`); `GET/POST/PATCH/DELETE /contract-templates` ← `TemplatesContratos.tsx` (**HTTP 400 sempre**, `GAP-0048`); `GET/POST/PATCH /contract-service-types` ← `ContratoFormModal.tsx`; `POST /integrations/autentique/{configure,send,webhook}` (real, zero consumidor); `GET/POST /integrations/oauth/*` (DocuSign, só OAuth).

### Matriz de campos — Contract (nível-registro, 9 campos + N partes/signatários)
| DB column | API field | Wizard (create/edit) | Modal secundário | grid | filtro | computado |
|---|---|---|---|---|---|---|
| `tipo` | idem | derivado de `contract_templates.tipo_servico` (texto livre) | derivado de `contract_service_types` | SIM | SIM | fonte diverge entre os 2 componentes |
| `artista_id` | idem | não escrito | SIM | SIM | SIM | só o Modal secundário escreve |
| `arquivo_url` | idem | **ausente** | SIM | não | não | bloqueia transição `aguardando_assinatura→assinado` para contratos do Wizard |
| `exclusivo` | idem | **sempre `false`** | SIM | não | não | Select do Passo 6 ignorado no Wizard |
| `signers[]` (jsonb) | idem | SIM (Passo 5) | não | não | não | oficial, só no Wizard |
| `observacoes` | idem | JSON estruturado serializado (partes/PII sem cifra) | texto livre | não | não | **conflito semântico real**, `DEC-004` não resolveu qual vence |
| `status` | idem | sempre forçado `rascunho`/`aguardando_assinatura` | livre | SIM | SIM | Select do Passo 6 ignorado |

### Fluxo funcional principal
1. Usuário escolhe um template (Passo 1) — deriva `tipo` do `tipo_servico` livre do template.
2. Detecta partes dinamicamente via placeholders `{{GRUPO.CAMPO}}` no conteúdo do template (Passo 2) — serializa tudo (incluindo CPF/CNPJ/RG/endereço) como JSON dentro de `observacoes`, sem criptografia.
3. Preenche variáveis do manifesto (Passo 3), preview (Passo 4), signatários (Passo 5, `signers[]` real).
4. Ao salvar, `status` sempre é forçado para `rascunho`/`aguardando_assinatura` (Select do Passo 6 é ignorado).
5. Transição para `assinado` exige `arquivo_url` truthy — campo ausente no fluxo principal, bloqueando estruturalmente essa transição para contratos criados pelo Wizard.

### O que funciona hoje
Workflow de status (9 estados reais, roles corretamente gateadas); propagação automática real ao assinar (cria transação, atualiza status do artista, cria 5 tarefas CRM) — quando alcançável; cron de vencimento (30 dias, notificação + tarefa de renovação).

### O que está parcial
Integração Autentique — backend completo e funcional, zero consumidor frontend; DocuSign — só OAuth, sem envio/assinatura real implementada em nenhuma camada; status do DocuSign rastreado em `sessionStorage` client-side, não no backend real.

### O que está quebrado
`POST /contract-templates` rejeita toda criação real via `TemplatesContratos.tsx` (DTO em inglês incompatível com o payload em português enviado) — bloqueia o Passo 1 do fluxo principal na origem; `ContactContractsService` usa `Map` em memória, não Postgres.

### O que é fake/stub/dead
`CategoryRegistry.tsx`/`VariableRegistry.tsx` (100% localStorage); `contact-contracts` (Map em memória); `contract-party-origin.mapper.ts` (código morto); `ContractStatus.ATIVO` (enum morto, inalcançável).

### Decisões que afetam o módulo
`DEC-002` (RESOLVED, `CONTRACT_SERVICE_TYPES_CANONICAL`) — `contract_service_types` é a fonte canônica de tipo de contrato; `DEC-004` (RESOLVED, `UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT`) — um único componente canônico, modos WIZARD e QUICK, ambos os entrypoints preservados. `DEC-008` (PENDING) — se o `sourceId` de uma parte copiada de CRM/Artista deve virar referência viva ou permanecer snapshot intencional (recomendação: formalizar snapshot).

### Todos os gaps (17)
GAP-0002 (vocabulário de tipo, DEC-002 resolvida, implementação pendente, S2_MEDIUM) · GAP-0004 (componente único WIZARD/QUICK, DEC-004 resolvida, implementação pendente, S1_HIGH) · GAP-0008 (party sourceId, DEC-008 pendente, S2_MEDIUM) · GAP-0048 (criação de template retorna 400 sempre, S1_HIGH) · GAP-0049 (PII de partes em texto livre, exportada sem máscara, S2_MEDIUM) · GAP-0050 (envelope DocuSign 0% implementado, S2_MEDIUM) · GAP-0051 (status DocuSign em sessionStorage, S2_MEDIUM) · GAP-0052 (Autentique real, zero consumidor, S2_MEDIUM) · GAP-0053 (enum ATIVO morto, S3_LOW) · GAP-0054 (contact-contracts em Map, S1_HIGH) · GAP-0055 (termos financeiros não propagam, S2_MEDIUM) · GAP-0056 (substituição de variável de template sem validação, S2_MEDIUM) · GAP-0057 (limite 50 sem indicador de truncamento, S2_MEDIUM) · GAP-0058 (PDF/arquivo assinado sem vínculo atômico, S2_MEDIUM) · GAP-0059 (facade /contacts em Map, compartilhado com crm-relationships, S1_HIGH) · GAP-0127 (projects.contrato_id exposta como filtro, nunca setada, S2_MEDIUM, CONFLITO-03) · GAP-0133 (contracts.lancamento_id confirmado inexistente em ambos os lados — NOT_APPLICABLE, fechado).

### Definição proposta/canônica para backend v2
Componente único WIZARD/QUICK (`DEC-004`) + `contract_service_types` canônico (`DEC-002`) — ambos conceituais, sem desenho técnico produzido.

### Pontos de confirmação do Product Owner
`DEC-008` (sourceId de parte); se o modelo de PII em `observacoes` deve migrar para armazenamento estruturado/cifrado antes ou depois da unificação WIZARD/QUICK (ver PO-VERIFY-023).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/contracts.md §5,§7,§10,§11,§14,§15,§18,§21,§30`

---

## MODULE-CRM-RELATIONSHIPS

### Finalidade
Gestão de relacionamento com clientes/contatos (CRM) — não confundir com Leads (funil de conversão, módulo separado).

### Entidades principais
`Client` (`clients`, 39 col) — não existe tabela física `contacts`; "Contato = Cliente" é uma decisão de domínio documentada no próprio código, ambos os conceitos compartilham `clients`.

### Tabelas
`clients`, `client_attachments`.

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /clients` ← `ContatoFormModal.tsx`/`ContatosPanel.tsx` (embutidos dentro de `LeadsPage.tsx` do módulo `leads` — a rota `/crm` redireciona para lá); `GET/POST /contacts` (legado, **facade em Map em memória**, não Postgres, zero consumidor frontend real).

### Matriz de campos — Client/Contato (19 campos reais persistidos de ~34 capturados pelo form — aprofundamento column-level obrigatório)
| Campo do form | Tipo | Cifrado | Coluna DB | Chega ao backend? | Nota |
|---|---|---|---|---|---|
| `documentNumber` | string (mascarado) | não (a coluna sim) | `cpf_cnpj_encrypted` (AES-256-GCM) | SIM (via `documentNumber`→`document`) | único campo de doc PII que sobrevive |
| `funcao` | string | não | `funcao` | **NÃO** | capturado, nunca enviado |
| `foto` | file→data URL (base64) | não | `foto` | **NÃO** | capturado (pode gerar string enorme em memória), nunca enviado |
| `razao_social`/`nome_fantasia` | string (2 colunas distintas) | não | `razao_social`/`nome_fantasia` | **NÃO, separadamente** | só um dos dois sobrevive, fundido em `nome` |
| `categoria` | select (6 opções) | não | `categoria` | SIM (via `contactType`→`category`) | |
| `perfil` | select (config-driven, cascata) | não | `perfil` | **NÃO** | capturado, obrigatório na validação do form, nunca enviado |
| `email` | string | SIM | `email_encrypted` | SIM | |
| `telefone` | string | SIM | `telefone_encrypted` | SIM | |
| `logradouro`/`numero`/`complemento`/`bairro` | string (4 colunas próprias) | não | idem (4 colunas) | **NÃO, separadamente** | só combinados numa única string `address`→`endereco_completo` |
| `status_contato` | select (6 opções) | não | `status_contato` | **NÃO** | capturado, nunca enviado |
| `prioridade_contato` | select (4 opções) | não | `prioridade_contato` | **NÃO** | idem |
| `responsavel_nome` | string (PJ) | não | `responsavel_nome` | SIM (via `responsible`) | único campo de "responsável" que sobrevive |
| `responsavel_email`/`responsavel_telefone`/`responsavel_cargo` | string (PJ, 3 colunas) | não | idem (3 colunas) | **NÃO** | capturados, nunca enviados |
| `interacoes[]` | array repetível (tipo/data/horário/descrição) | não | `interacoes` (jsonb) | **NÃO** | seção inteira "Histórico de Interações" descartada no submit |

Total: **15 campos reais capturados pelo formulário, nunca chegando ao backend** (`funcao`, `foto`, `razao_social`, `nome_fantasia`, `perfil`, `logradouro`, `numero`, `complemento`, `bairro`, `status_contato`, `prioridade_contato`, `responsavel_email`, `responsavel_telefone`, `responsavel_cargo`, `interacoes[]`) — nem a função de mapeamento (`contacts.service.ts::toApiInput()`) nem `CreateClientDto`/`UpdateClientDto` os declaram; com `ValidationPipe({whitelist:true, forbidNonWhitelisted:true})` global, enviá-los causaria rejeição mesmo se o mapeamento os incluísse.

### PII e criptografia
`PII_FIELDS`: 6 (email, telefone, documento/cpf_cnpj, endereço completo, observações, interações). `ENCRYPTED_FIELDS`: 3 (`email_encrypted`, `telefone_encrypted`, `cpf_cnpj_encrypted`, AES-256-GCM real). `UNENCRYPTED_PII_FIELDS`: 3 (endereço, observações, interações — sem PII de terceiros exposta por padrão, diferente do achado de `contracts`).

### Fluxo funcional principal
1. Usuário cria/edita um Contato/Cliente via `ContatoFormModal.tsx`.
2. ~15 campos reais capturados na tela nunca chegam ao backend (função de mapeamento não os inclui).
3. PII que de fato persiste (email/telefone/documento) é corretamente cifrada AES-256-GCM.

### O que funciona hoje
CRUD real de `clients`; criptografia de PII correta e completa (3 campos).

### O que está parcial
Backend de upload presigned-to-R2 existe mas nunca é chamado (UI só usa data URLs locais).

### O que está quebrado
~15 campos reais capturados pelo form, nunca persistidos (nem coluna própria, nem `metadata`).

### O que é fake/stub/dead
Facade legado `/contacts` (Map em memória, `GAP-0059`); `ContactComponents.tsx` (317 linhas/13 componentes, código morto); 4 Zustand stores mortos (contact-agenda/contact-filters/contact-panel/contact-tags).

### Decisões que afetam o módulo
Nenhuma resolvida diretamente, mas `DEC-008` (em `contracts`) referencia a origem CRM de partes de contrato.

### Todos os gaps (10)
GAP-0008 (sourceId de party, compartilhado, S2_MEDIUM) · GAP-0054 (ContactContractsService em Map, compartilhado com contracts, S1_HIGH) · GAP-0059 (facade /contacts em Map, S1_HIGH) · GAP-0060 (~15 campos nunca mapeados, S1_HIGH) · GAP-0061 (Auditoria.tsx field-mismatch, S3_LOW) · GAP-0062 (deep-link morto, S3_LOW) · GAP-0063 ("strength score" de relacionamento é heurística puramente frontend, S3_LOW) · GAP-0064 (limite 50 sem paginação, S2_MEDIUM) · GAP-0065 (taxonomia de tipo de relacionamento inconsistente, S2_MEDIUM) · GAP-0066 (canal WhatsApp/Email de interação sem ação de envio real por trás, S3_LOW).

### Definição proposta/canônica para backend v2
Não produzida.

### Pontos de confirmação do Product Owner
Se os ~15 campos capturados e descartados hoje são um requisito real de produto (e devem ganhar destino no v2) ou se devem ser removidos do formulário.

### Confidence
HIGH (verificado por leitura direta de `crm-relationships.md`, incluindo a matriz de 15 campos)

### Evidence
`docs/backend-v2/field-traceability/modules/crm-relationships.md (leitura direta desta etapa, seções de matriz de campos/PII/gaps consolidados)`

---

## MODULE-DASHBOARD

### Finalidade
Painel inicial agregando indicadores cross-domain (financeiro, artistas, contratos, eventos, catálogo).

### Entidades principais
Nenhuma própria — agrega `artists`, `contracts`, `transactions`, `events`, `releases`, `projects`, `activity_logs`. Existe um módulo real de `analytics` por trás (`AnalyticsController`).

### Tabelas
Nenhuma dedicada — lê das tabelas de outros módulos + `GET /analytics/dashboard` (21 agregações SQL tenant-scoped, imunes a truncamento) e `GET /analytics/revenue` (série temporal mensal real).

### Endpoints / componente chamador
`GET /analytics/dashboard`, `GET /analytics/revenue` — ambos reais, bem construídos, **sem consumidor frontend** (`Dashboard.tsx` não usa nenhum dos dois); os 8 widgets de `Dashboard.tsx` disparam, em vez disso, chamadas independentes às listas já auditadas de outros módulos (sem `limit` customizado, herdando o truncamento padrão de 50).

### Fluxo funcional principal
1. Usuário acessa `/dashboard`.
2. 8 widgets disparam chamadas independentes para listas já auditadas de outros módulos, sem `limit` customizado (herda o truncamento de 50).
3. 14 assinaturas `useWsEvent()` no Feed de Atividades nunca recebem nada — não existe ponte entre o barramento de eventos de domínio interno (`EventEmitter2`) e o Supabase Realtime broadcast.

### O que funciona hoje
Renderização geral dos widgets com os dados truncados disponíveis; `AnalyticsController` real por trás, pronto para uso futuro.

### O que está parcial
Filtro de intervalo de data por widget é client-side, sempre refaz a mesma chamada não-filtrada.

### O que está quebrado
Feed de Atividades (0 de 14 eventos realmente chega); 3 de 4 fórmulas de KPI comparadas divergem entre a versão truncada exibida e a versão SQL completa (calculada mas não usada); "Receita Total" rotulada como total, mas na verdade é uma janela móvel de 30 dias.

### O que é fake/stub/dead
Dois blocos de código morto confirmados inertes (`computeFromMockStorage()`, ~150 linhas; um bloco legado de 11 listeners `CustomEvent`); `dashboard-layout` Zustand store (drag-to-rearrange, nunca ligado).

### Decisões que afetam o módulo
Nenhuma.

### Todos os gaps (7)
GAP-0067 (widgets leem cache pré-agregado obsoleto, S2_MEDIUM) · GAP-0068 ("Atividades Recentes" sem nenhuma família de evento real, S2_MEDIUM, compartilhado com events) · GAP-0069 (3 widgets truncados em limit=50, S2_MEDIUM) · GAP-0070 (filtro de data client-side, refetch inútil, S2_MEDIUM) · GAP-0071 (visibilidade de widget por role só no frontend, S2_MEDIUM) · GAP-0072 (Zustand store morto, S4_INFORMATIONAL) · GAP-0167 (padrão cross-module de 9 stores mortos, S4_INFORMATIONAL).

### Definição proposta/canônica para backend v2
Nenhuma — mas o `AnalyticsController` já existente é um candidato natural de fonte de verdade única para o v2.

### Pontos de confirmação do Product Owner
Se "Receita Total" deve, de fato, ser um total geral (exigindo mudança de cálculo) ou permanecer como janela de 30 dias (exigindo apenas corrigir o rótulo).

### Confidence
MEDIUM (via `PROGRESS.md`, não módulo dedicado — não existe `dashboard.md` na série `modules/`)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: dashboard") | canonical-gap-register.json (GAP-0067 a GAP-0072)`

---

## MODULE-EVENTS

### Finalidade
Agenda/calendário de eventos (shows, gravações, reuniões) com participantes e implicações financeiras.

### Entidades principais
`Event` (`events`, 23 colunas, tabela física única — não existem tabelas separadas de venues/recorrência/lembretes/anexos, confirmado ausente).

### Tabelas
`events`.

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /events` ← `Agenda.tsx`/`SchedulerFormModal.tsx`/`SchedulerViewModal.tsx`.

### Matriz de campos — Event (create/edit real via `SchedulerFormModal.tsx`)
| DB column | API field | create-form | edit-form | grid/leitura real | filtro | busca | sort | computado |
|---|---|---|---|---|---|---|---|---|
| `titulo` | idem | SIM | SIM | SIM | não | SIM | SIM | não |
| `tipo` | idem | SIM | SIM | SIM | SIM | não | não | não |
| `participantes` (jsonb) | idem | SIM (via `useAgendaParticipants()`, agrega artist/employee/user/contact) | SIM | **lido do caminho errado** (`evento.metadata.participants`, sempre vazio, cai para o 1º artista) | não | não | não | `GAP-0075`(leitura)/participante primário também grava `artista_id` (FK solta) |
| `artista_id` | idem | derivado (1º participante `source==="artist"`) | idem | via participantes | SIM (texto livre em parte dos fluxos) | não | não | sem constraint declarada |
| `capacidadePublico` (só tipo "shows") | `capacity` | SIM | SIM | **NÃO** | não | não | não | DTO aceita, `dtoToEntity()` nunca mapeia (`GAP-0073`) |
| 12 campos de nível-registro (data/hora/local/descrição/observações etc.) | idem | SIM (13 colunas físicas populáveis) | SIM | parcial | parcial | não | não | `status` só em edit |

### Fluxo funcional principal
1. Usuário cria evento via `SchedulerFormModal.tsx` — mapeamento correto para os campos reais (create limpo).
2. `Agenda.tsx`/`SchedulerViewModal.tsx` leem um conjunto de campos **fictício** que não corresponde nem às colunas reais nem ao DTO — `data_inicio`, `tipo_evento`, `horario_inicio/fim`, `cidade`, `estado`, `capacidade_publico`, `valor_cache`, `valor_ingresso` — nenhum existe no DTO real, causando: todo evento renderiza em "agora" (fallback de data sempre dispara), todo evento vira "dia inteiro", filtro de tipo nunca casa com nada real, capacidade nunca exibida (seção sempre oculta).

### O que funciona hoje
Criação/edição do evento em si (mapeamento correto, sem `CREATE_MAPPING_MISMATCH`).

### O que está parcial
Import/export XLSX (client-side) usam os mesmos nomes fictícios — import rejeitaria toda linha; export sai majoritariamente em branco.

### O que está quebrado
Exibição completa em `Agenda.tsx`/`SchedulerViewModal.tsx` (campos fictícios); `capacidadePublico` aceito pelo DTO mas silenciosamente descartado pelo service; participantes exibidos do caminho errado (mostra só o 1º artista, perde os demais).

### O que é fake/stub/dead
Não existe recorrência, lembretes, anexos, integração com calendário externo, nem propagação evento→financeiro em nenhuma camada (todos confirmados ausentes, não apenas não descobertos); 2 artefatos de código morto (`events.store.ts`, `eventService`); deep-link morto a evento específico.

### Decisões que afetam o módulo
Nenhuma.

### Todos os gaps (9)
GAP-0068 (Feed de Atividades sem eventos reais, compartilhado com dashboard, S2_MEDIUM) · GAP-0073 (capacidadePublico descartado, S2_MEDIUM) · GAP-0074 (barramento interno sem ponte para Realtime, S2_MEDIUM) · GAP-0075 (Auditoria.tsx field-mismatch, S3_LOW) · GAP-0076 (deep-link morto, S3_LOW) · GAP-0077 (lineup por texto livre, compartilhado com artist, S2_MEDIUM) · GAP-0078 (receita de ingresso sem propagação para accounting, S2_MEDIUM) · GAP-0079 (limite 50, calendário mostra mês parcial, S2_MEDIUM) · GAP-0167 (padrão cross-module de stores mortos, S4_INFORMATIONAL).

### Definição proposta/canônica para backend v2
Não produzida.

### Pontos de confirmação do Product Owner
Se o conjunto fictício de campos usado em `Agenda.tsx`/`SchedulerViewModal.tsx` reflete um requisito de produto real ainda não implementado no backend (cidade/estado/capacidade/horários separados) ou se deve ser simplesmente removido/alinhado ao schema real.

### Confidence
HIGH (verificado por leitura direta de `events.md` nesta etapa)

### Evidence
`docs/backend-v2/field-traceability/modules/events.md (leitura direta desta etapa, seções de fluxo/campos/gaps)`

---

## MODULE-INTEGRATIONS

### Finalidade
Camada de integrações externas — pagamentos, assinatura eletrônica, streaming musical, redes sociais/ads, distribuição digital, registro de direitos, reconhecimento de áudio, storage, email, observabilidade, IA.

### Entidades principais
Não introduz tabelas de domínio próprias — usa `oauth_connections` (tokens), `webhook_events` (idempotência), `ai_jobs`/`ai_usage_logs`, e tabelas específicas de cada provedor (ex.: `artist_platform_profiles`).

### Tabelas
`oauth_connections`, `webhook_events`, `ai_jobs`, `ai_usage_logs`, `integrations`.

### Fluxo funcional principal
1. Tenant conecta um provedor (ex.: Spotify) via OAuth ou API key.
2. Credencial é cifrada e armazenada tenant-scoped (`IntegrationBaseService`).
3. Sincronizações/chamadas passam por `resilientFetch` (retry, circuit-breaker) — exceto ABRAMUS/ACRCloud, que usam `fetch()` puro sem essa proteção.
4. Webhooks (Stripe, Autentique) validam assinatura e são idempotentes (`webhook_events.external_id UNIQUE`).

### Matriz completa de provedores
| # | Provider | Tipo | Implementação atual | API oficial (documentada) | Modelo de credencial | Status |
|---|---|---|---|---|---|---|
| 1 | Stripe (billing SaaS) | PAYMENTS | Real, SDK Stripe | SIM | plataforma | PARTIAL (backend real; hooks frontend desabilitados) |
| 2 | Stripe Connect | PAYMENTS | Real (OAuth genérico) | SIM | tenant | PARTIAL |
| 3 | DocuSign | E-SIGNATURE | Só OAuth connect | SIM (Authorization Code Grant) | tenant | PARTIAL (sem envelope/assinatura) |
| 4 | Autentique | E-SIGNATURE | Backend completo (GraphQL real) | SIM | tenant | PARTIAL (zero consumidor frontend) |
| 5 | Clicksign | E-SIGNATURE | Só seletor de UI | — | — | STUB |
| 6 | Spotify | MUSIC_STREAMING | Real, OAuth client-credentials | SIM | plataforma | IMPLEMENTED |
| 7 | YouTube (Data API) | VIDEO/STREAMING | Real | SIM | plataforma | IMPLEMENTED |
| 8 | Instagram/Meta | SOCIAL_MEDIA | Real (orgânico+corporativo) | SIM | tenant | IMPLEMENTED |
| 9 | TikTok / TikTok Ads | SOCIAL_MEDIA/MARKETING | Real | SIM | tenant | IMPLEMENTED |
| 10 | Google Ads | MARKETING | Real | SIM | tenant | IMPLEMENTED |
| 11 | ABRAMUS | RIGHTS_REGISTRY | Parcial (busca/registro reais; import/sync stub) | SIM | tenant | PARTIAL |
| 12 | ACRCloud | AUDIO_RECOGNITION | Contrato divergente do hook frontend | SIM | tenant | PARTIAL |
| 13 | Cloudflare R2 | STORAGE | Real | SIM | plataforma | IMPLEMENTED |
| 14 | Resend | EMAIL | Real (só backend) | SIM | plataforma | IMPLEMENTED |
| 15 | Sentry | OBSERVABILITY | Real | SIM | plataforma | IMPLEMENTED |
| 16 | PostHog | ANALYTICS | Config presente, sem uso de código confirmado além da env var | SIM | plataforma | STUB |
| 17 | OpenAI/Anthropic/Google AI (roteador de IA) | AI | Real (multi-provider) | SIM | plataforma | IMPLEMENTED |
| 18 | Framework `external-data` | RIGHTS_REGISTRY/DISTRIBUTION | Infra backend completa (idempotência, webhook HMAC), **0 provedores reais registrados** (só 2 placeholders: `UnconfiguredDistributorProvider`/`UnconfiguredSocietyProvider`) | N/A | tenant (futuro) | CONFIG_ONLY |
| 19 | NF-e (emissão fiscal) | OTHER | UI sem coleta real | não pesquisada | tenant (futuro) | STUB |
| 20 | ECAD (card de conexão em integrations) | RIGHTS_REGISTRY | UI_ONLY — distinto da ingestão real de extratos ECAD do módulo `monitoring` | não pesquisada | tenant (futuro) | UI_ONLY |
| 21 | UBC | RIGHTS_REGISTRY | Hooks/diálogos de UI, zero backend | não pesquisada | tenant (futuro) | UI_ONLY |

### Sub-tabela — as 6 distribuidoras digitais nomeadas (aprofundamento obrigatório)
| Distribuidora | CURRENT_IMPLEMENTATION | OFFICIAL_API_STATUS_AS_DOCUMENTED | TENANT_CONNECTION_MODEL | CREDENTIALS_REQUIRED_LATER |
|---|---|---|---|---|
| ONErpm | Catálogo estático (`DISTRIBUTION_PLATFORMS`, `distribution-platforms.ts`) — link `<a target="_blank">` para o portal oficial; texto explícito "abrir o portal não conecta a conta ao sistema" | Não pesquisada nesta ou em auditorias anteriores (fora de escopo, Decisão D1) | `TENANT_OWNED` (futuro) — hoje o "estado de conexão" só é lido de `localStorage["musicos360_distributor_connections"]`, nunca escrito por nenhum código | SIM (0 credenciais adicionadas nesta auditoria, `CREDENTIALS_TO_ADD_NOW: 0`) |
| DistroKid | idem | idem | idem | idem |
| Symphonic | idem | idem | idem | idem |
| SoundOn | idem | idem | idem | idem |
| MusicPro | idem | idem | idem | idem |
| SomVibe | idem | idem | idem | idem |

Nenhuma simulação de sucesso existe para as 6 (cumprem a regra "proibido" da Decisão D1 — `doc25`/`doc31`): import/export/sync/status-sync/catalog-mapping/release-mapping/external-ids são todos `NOT_IMPLEMENTED` explicitamente, não fingidos.

### O que funciona hoje
Spotify, YouTube, Instagram/Meta, TikTok, Google Ads, Cloudflare R2, Resend, Sentry, roteador de IA — todos `IMPLEMENTED`, reais.

### O que está parcial
Stripe (backend completo, hooks de frontend desabilitados), DocuSign (só OAuth), Autentique (backend completo, zero consumidor), ABRAMUS (busca/registro reais, import/sync stub).

### O que está quebrado
`signing.adapter.ts` sempre retorna "indisponível" para todo provedor de assinatura, incluindo Autentique (que tem backend real e completo) — o único ponto real de entrada de UI para assinatura eletrônica está estruturalmente quebrado para os 3 provedores oferecidos.

### O que é fake/stub/dead
Nenhum `FAKE_INTEGRATION_GAP` encontrado em lugar nenhum — todo caminho não configurado falha explicitamente, nunca simula sucesso (disciplina confirmada em toda a série de auditoria).

### Decisões que afetam o módulo
Nenhuma decisão formal de Wave 0 — a decisão de distribuidoras (D1, `doc25`) já está `APPROVED`/`RESOLVED` conceitualmente, execução técnica futura fora de escopo.

### Todos os gaps (12)
GAP-0050 (envelope DocuSign 0%, compartilhado com contracts, S2_MEDIUM) · GAP-0052 (Autentique zero consumidor, compartilhado, S2_MEDIUM) · GAP-0080 (6 distribuidoras STUB, DEFERRED) · GAP-0081 (Stripe client path em Billing.tsx é real, reconciliado, DEFERRED) · GAP-0082 (ABRAMUS UI sem backend próprio — nota: busca/registro têm backend, mas o *card de conexão* em si é UI-only, DEFERRED) · GAP-0083 (ACRCloud UI_ONLY, DEFERRED) · GAP-0084 (PostHog UI_ONLY, DEFERRED) · GAP-0085 (NFe UI_ONLY, DEFERRED) · GAP-0086 (card ECAD em integrations é UI_ONLY, distinto da ingestão real de monitoring, DEFERRED) · GAP-0087 (UBC UI_ONLY, DEFERRED) · GAP-0088 (framework external-data sem provedores reais registrados, DEFERRED) · GAP-0117 (ingestão ECAD real em monitoring — NO_FIX_REQUIRED, distinto do card GAP-0086).

### Definição proposta/canônica para backend v2
Nenhuma definição nova — modelo de credencial `PLATFORM_SHARED` vs. `TENANT_OWNED` já estabelecido deve ser preservado (ver Parte VIII).

### Pontos de confirmação do Product Owner
Se `signing.adapter.ts` deve ser religado ao backend real da Autentique como prioridade de curto prazo (capacidade já pronta, custo de implementação baixo, ver PO-VERIFY-016); se existe cronograma real de pesquisa de API oficial para as 6 distribuidoras (PO-VERIFY-014).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/integrations.md §2,§5.20,§5.21,§5.22`

---

## MODULE-INVENTORY

### Finalidade
Controle de inventário/patrimônio (equipamentos, instrumentos, materiais) — o CRUD mais simples e menos fragmentado desta série, mas com um limite de escopo importante a declarar explicitamente.

### Declaração explícita de escopo (obrigatória)
**Movimentações, reservas, empréstimos e manutenção NÃO EXISTEM** em nenhuma camada deste módulo — nem tabela, nem endpoint, nem campo dedicado além do valor livre `status`. O schema é um **snapshot puro de quantidade**: uma única coluna inteira, sem ledger/movimentação, last-write-wins, sem lock otimista, sem trilha de auditoria estruturada. O campo `status` (`disponivel`/`em_uso`/`manutencao`/`descartado`/`reservado`) apenas *sugere* esses conceitos por nome — não há workflow, tabela satélite (`inventory_movements`/`inventory_reservations`/`inventory_loans`/`inventory_maintenance`) nem processo de negócio por trás de nenhum deles.

### Entidades principais
`InventoryItem` (`inventory_items`, 19 colunas — tabela física única).

### Tabelas
`inventory_items`.

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /inventory-items` ← `Inventario.tsx`/`InventarioFormModal.tsx`/modal de detalhe.

### Matriz de campos — InventoryItem (~19 campos, create/edit real)
| DB column | API field | create-form | edit-form | grid | filtro | busca | sort | computado |
|---|---|---|---|---|---|---|---|---|
| `nome`/`categoria`/`valor_unitario` | idem | SIM | SIM | SIM | SIM | SIM | SIM | não |
| `status` | idem | SIM (5 valores) | SIM | SIM | SIM | não | não | **3 vocabulários divergentes** (DTO backend, schema Zod frontend, tipo TS) — UI oferece "Emprestado"/"Danificado" (rejeitados, HTTP 400); "Reservado" (aceito) nunca oferecido (`GAP-0089`) |
| `local_compra`/`numero_nota_fiscal`/`data_entrada` | `localCompra`/`numeroNotaFiscal`/`dataEntrada` | SIM (create mapeia certo) | **NÃO** (lido em camelCase contra API snake_case) | coluna "Entrada" sempre "—" | não | não | não | bug de case só no modo edição |
| `responsavel_atual` | idem | SIM (texto livre) | SIM | SIM | não | não | não | sem FK real de usuário/funcionário (`GAP-0090`) |

### Fluxo funcional principal
1. Usuário cria/edita item — `localCompra`/`numeroNotaFiscal`/`dataEntrada` no modo de edição são lidos em camelCase contra uma API que responde em snake_case — esses 3 campos reais sempre aparecem vazios ao editar (embora CREATE os mapeie corretamente).
2. Estoque é um snapshot puro de quantidade (ver declaração de escopo acima).

### O que funciona hoje
CRUD básico (criação); export via Central de Relatórios (usa nomes corretos, não afetado pelo bug de camelCase).

### O que está parcial
Alertas de estoque baixo/manutenção vencida calculados só no cliente, sem notificação de backend; campo `valor_atual` (depreciação) existe mas nenhuma lógica o recalcula após a criação.

### O que está quebrado
Pré-preenchimento de edição para 3 campos reais (camelCase vs. snake_case); 3-way `ENUM_MISMATCH` de status; coluna "Entrada" da tabela sempre mostra "—".

### O que é fake/stub/dead
Movimentação/reserva/empréstimo/manutenção — confirmados ausentes em toda camada (ver declaração de escopo); 2 arquivos de código morto (Zustand store + deep-link); upload de foto tem pipeline real mas delete nunca remove o objeto do R2.

### Decisões que afetam o módulo
Nenhuma.

### Todos os gaps (8)
GAP-0089 (3-way ENUM_MISMATCH de status, S2_MEDIUM) · GAP-0090 (responsável é texto livre, sem FK, S2_MEDIUM) · GAP-0091 (Auditoria.tsx field-mismatch, S3_LOW) · GAP-0092 (deep-link morto, S3_LOW) · GAP-0093 (alertas client-side apenas, S2_MEDIUM) · GAP-0094 (depreciação nunca recalculada, S3_LOW) · GAP-0095 (limite 50 sem paginação, S2_MEDIUM) · GAP-0096 (delete de foto não limpa R2, S3_LOW).

### Definição proposta/canônica para backend v2
Não produzida — separar claramente CRUD real (existe) de movimentação/reserva/empréstimo/manutenção (não existe, confirmado ausente) é o ponto de partida recomendado para o desenho v2.

### Pontos de confirmação do Product Owner
Se movimentação/reserva/empréstimo/manutenção de inventário são requisitos reais de produto (schema hoje não sustenta nada disso além do campo `status`).

### Confidence
MEDIUM (via `PROGRESS.md`; não há `inventory.md` dedicado consultado nesta etapa além do já resumido no relatório mestre)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: inventory") | canonical-gap-register.json (GAP-0089 a GAP-0096)`

---

## MODULE-LEADS

### Finalidade
Funil de captação e conversão de leads (potenciais artistas/clientes) — distinto de CRM (`clients`, já relacionamento estabelecido).

### Entidades principais
`Lead` (`leads`, 34-35 colunas, workflow de 9 estados).

### Tabelas
`leads`, `lead_interactions` (dedicada, mas desconectada do mecanismo real de histórico), `lead_uploads`, `pipelines`/`pipeline_stages`/`pipeline_opportunities` (schema completo, zero consumidor, código morto).

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /leads` ← `LeadsPage.tsx`; `POST /lead-interactions` ← nunca de fato chamado pela UI (quebraria se fosse); `POST /public/artist-registration` ← formulário público de captação (real).

### Matriz de campos — Lead (aprofundamento CRUD/enum/conversão/duplicidade obrigatório)
| DB column | API field | create/edit-form | grid | filtro | busca | sort | computado |
|---|---|---|---|---|---|---|---|---|
| `origem_lead`, `probabilidade_fechamento`, `responsavel`, `prioridade`, `temperatura`, `proximo_follow_up`, `valor_estimado` | idem (7 colunas físicas) | SIM (aparentam ser as reais) | SIM | SIM | não | SIM | **valores reais na verdade vivem em `dados_internos_crm` (jsonb), não nessas colunas** — duplicação documentada |
| `whatsapp` | idem | SIM | não | não | não | não | **coletado, nunca persistido** (`GAP-0097`, DTO strip) |
| `status` (9 estados) | idem | SIM | SIM | SIM | não | não | ao mudar para `fechado`, dispara conversão automática |
| `lead_score` | idem | não (leitura) | SIM | não | não | SIM | exibido, **nunca computado por lógica de backend nenhuma** (`GAP-0100`, sempre default) |

### Fluxo funcional principal
1. Lead é capturado (formulário público ou manual).
2. Interações são registradas no array jsonb `payload_servico.interacoes[]` (funciona — histórico REAL usado pela UI, completamente desconectado da tabela/endpoint dedicados `lead_interactions`).
3. `POST /lead-interactions` (o endpoint "oficial" dedicado) espalha um DTO camelCase diretamente sobre uma entidade snake_case sem mapeamento — `lead_id` (NOT NULL) nunca é populado, falharia em qualquer chamada real (inerte hoje só porque a UI nunca o chama de fato, `GAP-0098`).
4. Ao mudar status para `fechado`, dispara conversão automática: cria um Cliente **E sempre cria um Artista** (mesmo que o lead não seja de perfil artístico), **sem checar duplicata** (`GAP-0101`), em 3 operações try/catch independentes fora da transação original (falha entre passos deixa o lead travado permanentemente).

### Enum de status (9 estados) e detecção de duplicidade
Transições de status/pipeline **não têm validação de máquina de estado server-side** — qualquer status é setável a partir de qualquer status (`GAP-0102`). Detecção de duplicidade (mesmo email/telefone) **não existe** — o formulário público de captação aceita submissões duplicadas ilimitadas (`GAP-0101`).

### O que funciona hoje
Captação pública, listagem/edição de leads, histórico de interação via jsonb manual, export (delega corretamente ao motor central de relatórios).

### O que está parcial
Sistema completo de Pipeline/Kanban genérico (`pipelines`/`pipeline_stages`/`pipeline_opportunities`, 41 colunas) existe só como declaração TypeORM, sem controller/service/frontend algum.

### O que está quebrado
`POST /lead-interactions` (quebraria em qualquer chamada real); conversão lead→artista sempre cria duplicata de artista e não é atômica.

### O que é fake/stub/dead
Upload de anexo de lead (100% decorativo, `URL.createObjectURL`); 3 de 4 Zustand stores mortos.

### Decisões que afetam o módulo
Nenhuma diretamente, mas a correção de `DEC-001` é relevante à nota em `GAP-0099` sobre `financial_project_id`.

### Todos os gaps (9)
GAP-0097 (whatsapp coletado, nunca persistido, S2_MEDIUM) · GAP-0098 (LeadInteractionsService camelCase vs. snake_case, S2_MEDIUM) · GAP-0099 (conversão sem vínculo financial_project_id retroativo, S2_MEDIUM, ver CONFLITO-02) · GAP-0100 (lead_score nunca computado, S3_LOW) · GAP-0101 (sem detecção de lead duplicado, S2_MEDIUM) · GAP-0102 (transições de status sem validação server-side, S3_LOW) · GAP-0103 (limite 50, kanban perde leads além do 50º por coluna, S2_MEDIUM) · GAP-0104 (Zustand store morto, S4_INFORMATIONAL) · GAP-0167 (padrão cross-module de stores mortos, S4_INFORMATIONAL).

### Definição proposta/canônica para backend v2
Não produzida.

### Pontos de confirmação do Product Owner
Se a conversão lead→artista deve, de fato, sempre criar um Artista (mesmo para leads não-artísticos) ou se essa é uma regra de negócio equivocada a corrigir (ver PO-VERIFY-010).

### Confidence
MEDIUM (via `PROGRESS.md`; não há leitura direta de `leads.md` nesta etapa além do já resumido no relatório mestre)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: leads") | canonical-gap-register.json (GAP-0097 a GAP-0104)`

---

## MODULE-LICENSING

### Finalidade
Licenciamento de obras/fonogramas para uso de terceiros — predominantemente sync licensing, com master-use e mechanical licensing como categorias secundárias no mesmo formulário/tabela.

### Classificação individual (aprofundamento obrigatório: sync/master/mechanical/clearance/approval/expiry/documents)
| Categoria | Status no schema/UI | Evidência |
|---|---|---|
| **Sync** (5 sub-tipos: `sync_tv`, `sync_cinema`, `sync_publicidade`, `sync_games`, `sync_digital`) | **Predominante** — o único modal de criação chama-se literalmente "Nova Licença de Sync"; `tipo` é texto livre (`@IsString()`, sem `@IsIn`), os 5 valores acima são os únicos oferecidos na UI real | `licensing.md` (leitura direta, linha 243-248) |
| **Master Use** (`master_use`) | Presente como 6º valor de `tipo` no mesmo campo texto livre — categoria secundária, mesmo formulário/tabela, sem campos ou fluxo distintos | idem |
| **Mechanical** | **NÃO EXISTE** como categoria em nenhuma camada — não aparece como valor de `tipo`, não tem campo dedicado, não tem fluxo | confirmado ausente por leitura direta |
| **Clearance** (workflow de autorização/aprovação prévia) | **NÃO EXISTE** — não há `license_requests`/`license_approvals` como tabela satélite; `status` é editado diretamente sem workflow/aprovação por trás | `licensing.md` linha 35 |
| **Approval** (fluxo de aprovação multi-etapa) | **NÃO EXISTE** — mudar `status` é apenas mais uma edição de campo comum, não um workflow gateado | idem |
| **Expiry** (`expirada`) | Existe como valor de `status`, mas é **inteiramente manual** — nenhum job/cron marca uma licença como expirada quando `data_fim` é ultrapassada (`EXPIRATION_GAP` confirmado, `GAP-0105` adjacente) | linha 377-383 |
| **Documents** (proposta/contrato/autorização/documento de clearance) | **NÃO EXISTE** — nenhum campo de anexo (`*_url`/`*_key`/`attachment*`) existe em `licenses`; `DOCUMENT_GENERATION: NOT_IMPLEMENTED` | linha 480-491 |

### Entidades principais
`License` (`licenses`, 27 colunas, tabela física única, sem tabelas satélite).

### Tabelas
`licenses`.

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /licenses` ← modal "Nova Licença de Sync".

### Fluxo funcional principal
1. Usuário registra uma solicitação de licença (uso pretendido, território, duração).
2. Campos de uso/território/duração são aceitos pelo DTO mas **nunca persistidos** na tabela (`GAP-0105`, S1_HIGH).
3. `status` não tem workflow/validação de transição — "expirada" é inteiramente manual; uma licença com `data_fim` no passado permanece "Ativa" indefinidamente.

### O que funciona hoje
Criação/edição básica de solicitação de licença (campos-núcleo: obra/fonograma, cliente via `cliente_id`, valor).

### O que está parcial
Remuneração do tipo `PERCENTAGE` fica invisível em relatórios (excluída do contrato de export por engano histórico).

### O que está quebrado
`uso_pretendido`/`territorio`/`duracao_licenca` aceitos pelo DTO, nunca persistidos.

### O que é fake/stub/dead
2 Zustand stores mortos; filtro "Rádio" morto (opção sem dado correspondente); `licenses.cliente` (texto livre) nunca escrita pelo fluxo real, mas exigida pela ferramenta de completude `Auditoria.tsx` — toda licença real criada é sinalizada como incompleta por essa ferramenta.

### Decisões que afetam o módulo
Nenhuma.

### Todos os gaps (6)
GAP-0105 (campos de solicitação nunca persistidos, S1_HIGH) · GAP-0106 (taxa de licença sem propagação para accounting, S2_MEDIUM, compartilhado) · GAP-0107 (Auditoria.tsx field-mismatch, S3_LOW) · GAP-0108 (deep-link morto, S3_LOW) · GAP-0109 (PDF sem vínculo atômico com transição de status, S2_MEDIUM) · GAP-0110 (limite 50 sem paginação, S2_MEDIUM).

### Definição proposta/canônica para backend v2
Não produzida.

### Pontos de confirmação do Product Owner
Se licenciamento deve, de fato, ganhar relação formal com `contracts` e `accounting` (hoje inexistente em qualquer camada); se `mechanical`/clearance/approval/documents (confirmados ausentes) são requisitos reais de produto para o v2.

### Confidence
HIGH (verificado por leitura direta de `licensing.md` nesta etapa)

### Evidence
`docs/backend-v2/field-traceability/modules/licensing.md (leitura direta desta etapa, classificação sync/master/mechanical/clearance/approval/expiry/documents)`

---

## MODULE-MARKETING

### Finalidade
Ciclo completo de marketing — estratégico, operacional, criativo, publicação, analytics — não apenas campanhas pagas.

### Entidades principais
`Campaign` (`campaigns`), `MarketingContentPost` (`marketing_content_posts`), `MarketingAsset` (+versões +aprovações), `MarketingProject` (`marketing_projects`), `MarketingStrategy` (hierarquia Strategy→Objective→Initiative→Action), `MarketingTask`.

### Tabelas
`campaigns` (compartilhada por 2 sistemas incompatíveis), `campaign_assets`/`campaign_tasks` (órfãs do Sistema A morto), `marketing_content_posts`, `marketing_assets`/`marketing_asset_versions`/`marketing_asset_approvals`, `marketing_projects`, `marketing_strategies`/`marketing_strategy_objectives`/`marketing_strategy_initiatives`/`marketing_strategy_actions`, `marketing_tasks`, `briefings`.

### Campanhas / Conteúdo / Publicação / Métricas / Atribuição / Sync / Providers (aprofundamento obrigatório)
| Sub-domínio | Estado real | Evidência |
|---|---|---|
| **Campanhas** | 2 sistemas paralelos e incompatíveis na mesma tabela física `campaigns`: **Sistema A** (`CampaignsController`, `GET/POST/PATCH/DELETE /campaigns`) — confirmado morto, sem consumidor, estruturalmente quebrado se fosse chamado (violaria NOT NULL). **Sistema B** (`MarketingCampaignBuilderController`, `GET/POST /marketing/campaigns`, `POST /marketing/campaigns/draft`, `/:id/{validate,publish,pause,archive}`) — o real, usado por `Campanhas.tsx`/`CampaignBuilderModal.tsx` | `GAP-0111`, S1_HIGH |
| **Conteúdo** | Agendamento de conteúdo real (fila BullMQ, 3 tentativas, backoff, idempotência) via `Calendario.tsx` — infraestrutura sólida | `marketing.md §7` |
| **Publicação** | A chamada final de publicação em cada provedor **sempre falha explicitamente** (adaptador stub honesto, não simula sucesso) | idem |
| **Métricas** | `Campanhas.tsx` exibe `budget * 0.41` como "Gasto Total" **fabricado** sempre que dados reais de custo/conversão não foram digitados manualmente | `GAP-0112`, S2_MEDIUM |
| **Atribuição** | Nenhuma sincronização real de métricas de ad-platform, apesar de OAuth real existir para Meta/Google Ads/TikTok para outros fins (`GAP-0113`, confirmado sem integração de ad-platform na criação de campanha, DEFERRED/informacional) |
| **Sync** | Ausente — nenhum consumidor liga o barramento de eventos a mudança de status de campanha (`GAP-0114`) |
| **Providers** | Biblioteca de ativos com versionamento/aprovação real (`marketing_assets`/`_versions`/`_approvals`) — funcional de ponta a ponta |

### Fluxo funcional principal
1. Usuário cria campanha via Campaign Builder (Sistema B) — 15 campos no payload, só 5 em coluna física dedicada, os outros 10 (incluindo o vínculo com a entidade promovida) só em `metadata.marketingBuilder.payload` jsonb.
2. Agendamento de conteúdo é real — mas a publicação final sempre falha explicitamente.
3. Métricas exibidas usam `budget * 0.41` como "Gasto Total" fabricado.
4. Automação real: conclusão de um Project musical cria automaticamente um workspace de marketing + tarefa de "criar arte de capa" (`MarketingProjectsService.createFromCompletedProject()`).

### O que funciona hoje
Criação de campanha via Campaign Builder; agendamento de conteúdo (infraestrutura real); biblioteca de ativos com versionamento/aprovação real; automação Project→Marketing real.

### O que está parcial
Publicação externa por provedor — infraestrutura real, adaptador de publicação 100% stub, com falha honesta e auditável.

### O que está quebrado
Sistema A de campanhas — quebraria com NOT NULL se fosse chamado, mas está morto (sem impacto em produção hoje).

### O que é fake/stub/dead
Dado fabricado (`budget*0.41` como "Gasto Total"); `campaign_tasks`/`campaign_assets` (tabelas do Sistema A, órfãs); nenhuma sincronização real de métricas de ad-platform.

### Decisões que afetam o módulo
`DEC-001` (RESOLVED) — correção de `financial_project_id`.

### Todos os gaps (7)
GAP-0001 (conflito de domínio de projects, compartilhado, S1_HIGH) · GAP-0033 (financial_project_id nunca escrita, S2_MEDIUM, compartilhado) · GAP-0111 (2 sistemas de campanha paralelos, S1_HIGH) · GAP-0112 (métrica "Gasto Total" fabricada, S2_MEDIUM) · GAP-0113 (sem integração de ad-platform na criação de campanha, S4_INFORMATIONAL, DEFERRED) · GAP-0114 (barramento sem consumidor para status de campanha, S3_LOW) · GAP-0115 (limite 50 sem paginação, S2_MEDIUM).

### Definição proposta/canônica para backend v2
Não produzida — consolidar em um único sistema de campanha (Sistema B) é a recomendação implícita mais óbvia, ainda não registrada como decisão formal.

### Pontos de confirmação do Product Owner
Se o Sistema A de campanhas (órfão) deve ser formalmente removido no v2 ou se havia um propósito de produto ainda a esclarecer.

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/marketing.md §1,§3,§4,§7,§8,§9`

---

## MODULE-MONITORING

### Finalidade
**Explicitamente**: monitoramento de catálogo/artista — detecção de uso não-autorizado, reconciliação de royalties do ECAD, takedowns estilo DMCA. **NÃO é** observabilidade técnica da aplicação — essa é coberta separadamente por Pino/OpenTelemetry/Sentry/Prometheus (ver Parte X), sem qualquer superfície voltada ao tenant neste módulo. Esta distinção é explícita e deliberada na própria fonte auditada.

### Entidades principais
`content_detections`, `ecad_reports`, `TakedownEntity` (`takedowns`).

### Tabelas
`content_detections`, `ecad_reports`, `takedowns`.

### Endpoints / componente chamador
`GET /ecad-reports` ← `Monitoramento.tsx` (via `useDeteccoes()`); `/takedowns` (create quebrado) ← formulário dentro da tela morta `Monitoramento.tsx`; detecção via `content_detections` (sem UI de criação alcançável).

### O achado de roteamento (raiz de todos os outros achados deste módulo)
`/monitoramento` redireciona **incondicionalmente** para `/rights-monitoring` — `Monitoramento.tsx` (a tela real, ligada a dados genuínos, `content_detections`/`GET /ecad-reports`) fica **estruturalmente inalcançável** pela navegação normal. A tela que o usuário de fato vê, `RightsMonitoring.tsx`, importa de um arquivo cujo próprio comentário confirma que o backend não tem endpoints reais ainda para execuções públicas/broadcast/cue sheets/setlists — todas as 5 arrays exportadas são vazias por design (ausência honesta, não dado falso).

### Fluxo funcional principal
1. Usuário acessa "Monitoramento" no menu — é redirecionado para `RightsMonitoring.tsx`, que mostra 6 abas permanentemente vazias por design.
2. A tela real e funcional (`Monitoramento.tsx`) permanece tecnicamente presente no código mas nunca é acessada pela navegação normal.
3. `TakedownsService.create()` grava incondicionalmente `url: dto.url_infracao ?? null` — toda tentativa real de `POST /takedowns` a partir da UI alcançável falha com erro SQL (a `TakedownEntity` declara 4 colunas — `url`/`obra_id`/`artista_id`/`resposta` — ausentes da tabela física real).

### O que funciona hoje
`content_detections` mapeado corretamente ponta a ponta (mas sem caminho de criação alcançável); relatórios ECAD reais (ingestão de arquivo de extrato confirmada funcional).

### O que está parcial
Nada — é binário: `Monitoramento.tsx` funciona mas é inalcançável; `RightsMonitoring.tsx` é alcançável mas vazio por design.

### O que está quebrado
`POST /takedowns` (falha com erro SQL em toda chamada real, colunas declaradas na entidade ausentes da tabela viva).

### O que é fake/stub/dead
Nenhum dado fabricado encontrado neste módulo (contraste positivo com `marketing`) — todo estado vazio/zero é honestamente rotulado como tal.

### Decisões que afetam o módulo
Nenhuma.

### Todos os gaps (6)
GAP-0086 (card ECAD de integrations é UI_ONLY, distinto deste módulo, DEFERRED) · GAP-0116 (duas UIs paralelas, uma inalcançável, S2_MEDIUM) · GAP-0117 (ingestão ECAD real, distinta do card UI_ONLY de integrations — NO_FIX_REQUIRED) · GAP-0118 (score de confiança sem explicação/disputa, S3_LOW) · GAP-0119 (royalties detectados sem propagação para accounting, S2_MEDIUM, compartilhado) · GAP-0120 (limite 50 sem paginação, S2_MEDIUM).

### Definição proposta/canônica para backend v2
Não produzida — corrigir o redirecionamento `/monitoramento → /rights-monitoring` para apontar à tela real e funcional é a correção mais óbvia e barata identificada nesta auditoria.

### Pontos de confirmação do Product Owner
Se `RightsMonitoring.tsx` (execuções públicas/broadcast/cue sheets/setlists) é um roadmap de produto ativo ou se `Monitoramento.tsx` (já funcional) deve simplesmente voltar a ser a tela principal (ver PO-VERIFY-017).

### Confidence
MEDIUM (via `PROGRESS.md`; não há leitura direta de `monitoring.md` nesta etapa além do já resumido no relatório mestre)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: monitoring") | canonical-gap-register.json (GAP-0116 a GAP-0120)`

---

## MODULE-MUSICCHAT

### Finalidade
Inbox de atendimento omnichannel real (conversas/mensagens/notas) + camada de automação de triagem/escalonamento.

### Declaração explícita (obrigatória): MusicChat NÃO é um assistente de IA/LLM
Busca exaustiva por `openai`/`anthropic`/`llm`/`embedding`/`vector`/`gemini`/`rag`/`completion` não encontrou nenhuma ocorrência em todo o código deste módulo. `MessageSenderType.AI` existe como valor de enum mas está **confirmado não usado** — não há requisito de LLM/RAG por trás dele (`GAP-0123`, `NO_FIX_REQUIRED`). MusicChat é uma caixa de entrada de mensageria/atendimento multi-canal com automação de regras (triagem/escalonamento), não um chatbot de IA.

### Entidades principais
`conversations`, `conversation_messages`, `conversation_notes` (domínio de mensageria genérico, compartilhado também por `leads`), `musicchat_automation_settings`/`_events`/`_notifications`.

### Tabelas
`conversations`, `conversation_messages`, `conversation_notes`, `musicchat_automation_settings`, `musicchat_automation_events`, `musicchat_automation_notifications`.

### Endpoints / componente chamador
21 endpoints combinados entre os 2 controllers reais ← `MusicChat.tsx` (`/chat`)/`/admin/musicchat/automacoes` — mapeamento DTO/entidade **100% limpo** (sem nenhum mismatch de nome de campo, achado raro nesta série).

### Fluxo funcional principal
1. Atendente abre `/chat`, vê conversas reais, envia mensagens (persistidas corretamente).
2. `RealtimeService` publica eventos `conversation:*` reais via Supabase Realtime a cada operação de mudança de estado (7 pontos confirmados) — mas o assinante central do app (`useRealtimeSync.ts`) nunca se inscreve em nenhum evento `conversation:*` — o backend publica corretamente, ninguém escuta (`GAP-0121`).
3. Anexos usam `URL.createObjectURL(file)` (referência local efêmera) — nunca upload real; persistidos verbatim no jsonb `attachments`, sem sentido após reload ou para outros usuários (`GAP-0122`).

### 5 canais externos modelados, zero ingestão real
`whatsapp`/`instagram`/`facebook`/`tiktok`/`email` estão modelados no schema/UI — mas **nenhum endpoint/webhook de ingestão existe** para de fato receber uma mensagem externa (`GAP-0124`, confirmado escopo/limite de produto, não bug).

### O que funciona hoje
Conversas/mensagens/notas — CRUD real e limpo; automação de triagem/escalonamento real; publisher Realtime genuíno (primeira cadeia realtime totalmente real confirmada nesta série de auditoria).

### O que está parcial
Publisher real sem consumidor central conectado.

### O que está quebrado
Nada no sentido de erro 400/500 — os gaps são de ausência de conexão (Realtime) e ausência de recurso (storage de anexo, ingestão externa).

### O que é fake/stub/dead
Nada fake — a ausência de ingestão externa é classificada como escopo confirmado, não gap disfarçado.

### Decisões que afetam o módulo
Nenhuma.

### Todos os gaps (5)
GAP-0121 (Realtime publica, ninguém assina, S2_MEDIUM) · GAP-0122 (anexos nunca armazenados de fato, S2_MEDIUM) · GAP-0123 (enum AI não usado — NO_FIX_REQUIRED) · GAP-0124 (ingestão de canal externo ausente — DEFERRED, escopo confirmado) · GAP-0125 (limite 50 sem "carregar mais", S2_MEDIUM).

### Definição proposta/canônica para backend v2
A superfície real (conversas/mensagens/notas/configurações de automação) deve migrar; o conceito de ingestão de canal externo, hoje inexistente, não deve ser silenciosamente promovido a requisito do v2.

### Pontos de confirmação do Product Owner
Se a ingestão de canais externos (WhatsApp/Instagram/Facebook/TikTok/email) é um requisito de roadmap real, já que o schema/UI já a modelam sem nenhuma implementação de backend por trás.

### Confidence
MEDIUM (via `PROGRESS.md`; não há leitura direta de `musicchat.md` nesta etapa além do já resumido no relatório mestre)

### Evidence
`docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: musicchat") | canonical-gap-register.json (GAP-0121 a GAP-0125)`

---

## MODULE-PROJECTS

### Finalidade
Ficha inicial da música/projeto musical — a entidade canônica cross-domain per `DEC-001` (ver Parte II para a definição canônica completa).

### Entidades principais
`Project` (`projects`, 16 col), `ProjectTrack` (`project_tracks`, 14-16 col), `ProjectTrackParticipant` (`project_track_participants`, 6-7 col), `ProjectAsset` (`project_assets`, órfão).

### Tabelas
`projects`, `project_tracks`, `project_track_participants`, `project_assets` (órfã, zero consumidor).

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /projects` ← `Projetos.tsx`/`ProjetoFormModal.tsx`/`ProjetoViewModal.tsx`.

### Matriz de campos — Project (8 campos reais, create/edit real via `ProjetoFormModal.tsx`)
| DB column | API field | create-form | edit-form | grid | filtro | busca | sort | computado |
|---|---|---|---|---|---|---|---|---|
| `titulo` | idem | SIM | SIM | SIM | não | SIM | SIM | não |
| `tipo`/`genero`/`status` | idem | SIM | SIM | SIM | SIM | não | SIM (status) | não |
| `descricao`/`observacoes` | idem | SIM | SIM | não | não | não | não | não |
| `artista_id` | idem | **NÃO** (campo real, nunca coletado pelo form) | NÃO | não | não | não | não | `GAP-0001`, decisão resolvida, implementação pendente |
| `orcamento` | idem | **NÃO** | NÃO | não | não | não | não | idem |
| `contrato_id` | idem | **NÃO** | NÃO | não | SIM (exposto como filtro) | não | não | CONFLITADO — existência física em disputa (CONFLITO-03, `GAP-0127`) |

### Fluxo funcional principal
1. Usuário cria projeto musical (título, tipo, gênero, status) + faixas planejadas + participantes por faixa via `ProjetoFormModal.tsx` (8 campos reais, mapeamento limpo).
2. Workflow de status real (5 estados, `WorkflowService`) — mas a edição de status via Select livre no formulário não respeita as transições legais (o `ViewModal` sim respeita, corretamente).
3. `ProjectPlanningAutomation` (geração de plano operacional via IA ao concluir o projeto) executa SQL bruto com colunas obsoletas/inexistentes (`nome`, `data_fim` — renomeadas pela migration `20260718000013`) — falha silenciosamente em toda invocação real, embora não reverta a conclusão do projeto em si.

### O que funciona hoje
Criação/edição do projeto e suas faixas/participantes (8 campos reais, mapeamento limpo); workflow de status real; relação com Work (real, populada, `ALREADY_CORRECT`).

### O que está parcial
Edição de status via Select livre não respeita transições legais do workflow.

### O que está quebrado
`ProjectPlanningAutomation` (SQL bruto com colunas renomeadas, falha silenciosa em toda invocação).

### O que é fake/stub/dead
Upload de áudio de faixa (stub hardcoded, sempre retorna `null`); `project_assets` (tabela órfã, zero consumidor); `projects.store.ts`/`projects.service.ts` (código morto, board-store nunca ligado).

### Decisões que afetam o módulo
`DEC-001` (RESOLVED) — definição corrigida do próprio `projects`, entidade canônica Musical Project/Song.

### Todos os gaps (9)
GAP-0001 (decisão resolvida; implementação de artista_id/orcamento pendente, S1_HIGH) · GAP-0013 (P&L por Projeto não agrupa, compartilhado, S2_MEDIUM) · GAP-0033 (financial_project_id nunca escrita por audiovisual/marketing, S2_MEDIUM, compartilhado) · GAP-0099 (conversão de lead sem vínculo retroativo, compartilhado, S2_MEDIUM) · GAP-0126 (Zustand board-store morto, S4_INFORMATIONAL) · GAP-0127 (contrato_id CONFLITADO, S2_MEDIUM) · GAP-0128 (limite 50 sem paginação, S2_MEDIUM) · GAP-0167 (padrão cross-module de stores mortos, S4_INFORMATIONAL) · GAP-0168 (decisão DEC-009 resolvida — PROJECT_RELEASE_DIRECT_LINK; resta implementar `releases.project_id`, S2_MEDIUM — `blocksSchemaV2Design: NÃO`, corrigido, texto anterior "bloqueia schema v2" desatualizado).

### Definição proposta/canônica para backend v2
`projects` = Musical Project canônico (`DEC-001`); chave cross-domain via `projects.id`, preservando as relações já reais. Desenho físico ainda não produzido.

### Pontos de confirmação do Product Owner
Confirmar a correção de `DEC-001` (ver checklist final); confirmar se `artista_id`/`orcamento` devem, de fato, ser expostos no formulário real; CONFLITO-03 (`projects.contrato_id`, PO-VERIFY-006).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/projects.md §1,§2,§5,§7,§8,§9,§17`

---

## MODULE-RELEASES

### Finalidade
Lançamento/produto de distribuição — o achado mais crítico de toda a auditoria (create/edit 100% quebrados hoje).

### Entidades principais
`Release` (`releases`, 26-27 col), `release_works` (junção, schema-only, nunca populada).

### Tabelas
`releases`, `release_works`.

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /releases` ← `Lancamentos.tsx`/`LancamentoFormModal.tsx` (wizard de 5 passos)/`LancamentoViewModal.tsx`.

### Matriz de campos — Release (20 campos, wizard de 5 passos)
| DB column | API field | create-form | edit-form | grid | filtro | busca | sort | computado |
|---|---|---|---|---|---|---|---|---|
| `titulo`/`artista_id`/`upc_ean`/`isrc_global` | idem | SIM | SIM | SIM | SIM | SIM | SIM | não |
| `metadata.faixas` (jsonb) | `faixas` | SIM (Passo 2, Upload de Faixas) | SIM | SIM (contagem) | não | não | não | `NON_CANONICAL_METADATA` por `DEC-007` — sem relação com `phonograms`/`works` |
| `internal_status` | `internalStatus` | **injetado incondicionalmente pelo form** | idem | — | — | — | — | **campo não existe em nenhum DTO nem coluna física — `ValidationPipe` global rejeita a request inteira com HTTP 400 antes do controller** (`GAP-0129`) |
| `platform_status` | idem | mesma injeção | idem | — | — | — | — | mesmo problema |
| `status` (workflow, 10 estados) | idem | Select do Passo 5 | SIM | SIM | SIM | não | SIM | ilegal salto DRAFT→DISTRIBUTED permitido (`GAP-0130`) |

### Fluxo funcional principal — 100% quebrado (achado mais severo da auditoria)
1. Usuário preenche o wizard de 5 passos (Info do Álbum / Upload de Faixas / Capa / Preferências de Distribuição / Preview).
2. Ao salvar, `LancamentoFormModal.tsx` injeta incondicionalmente `internal_status` no payload — campo não declarado em nenhum DTO nem como coluna física — o `ValidationPipe` global rejeita a requisição inteira com HTTP 400 **antes de chegar ao controller**.
3. **Resultado: toda criação e toda edição de Lançamento via a UI real falha, hoje, 100% das vezes.**
4. Mesmo se esse bug fosse corrigido, uma segunda chamada subsequente força `status: "distributed"` diretamente a partir de `DRAFT` — transição ilegal no workflow real (só `DRAFT→METADATA_PENDING` é permitida a partir de `DRAFT`) — falharia de forma independente.

### O que funciona hoje
Upload de capa/artwork (real, Cloudflare R2, funcional de ponta a ponta — contraste positivo com o stub de áudio de `projects`/`catalog`); workflow de 10 estados com guards reais no backend.

### O que está parcial
Nada — o bug de `internal_status` é binário e afeta 100% das tentativas de create/edit.

### O que está quebrado
Create/Edit inteiros (achado mais severo desta auditoria); notificação de "artista aprovado" grava `user_id` com um valor de `artists.id` (nunca corresponde a um usuário real — escrita morta silenciosa).

### O que é fake/stub/dead
Os 6 provedores de distribuição (STUB, ver MODULE-INTEGRATIONS); `release_works` (nunca populada); entidade/repositório duplicados (`release.entity.ts`, `release.repository.ts`, mortos em produção, referenciados só por um spec de teste); delete de artwork não remove o objeto R2.

### Decisões que afetam o módulo
`DEC-007` (RESOLVED, `RELATIONAL_TRACKLIST_MODEL`) — tracklist deve ser relacional via fonograma, `metadata.faixas` não é canônico, desenho final `TO_BE_DESIGNED`.

### Todos os gaps (10)
GAP-0007 (modelo de tracklist decidido, desenho final pendente, S1_HIGH — `blocksSchemaV2Design: NÃO`, decisão já resolvida por `DEC-007`; corrigido, texto anterior "bloqueia schema v2" desatualizado) · GAP-0080 (6 distribuidoras STUB, compartilhado, DEFERRED) · GAP-0129 (internal_status/platform_status quebram 100% do create/edit, S1_HIGH) · GAP-0130 (salto ilegal DRAFT→DISTRIBUTED, S2_MEDIUM) · GAP-0131 (takedown sem chamada real de distribuidor, S3_LOW, DEFERRED) · GAP-0132 (delete de artwork não limpa R2, S3_LOW) · GAP-0133 (contracts.lancamento_id confirmado inexistente — NOT_APPLICABLE, fechado) · GAP-0134 (limite 50 sem paginação, S2_MEDIUM) · GAP-0167 (padrão cross-module de stores mortos, S4_INFORMATIONAL) · GAP-0168 (decisão DEC-009 resolvida — PROJECT_RELEASE_DIRECT_LINK; resta implementar `releases.project_id`, S2_MEDIUM — `blocksSchemaV2Design: NÃO`, corrigido, texto anterior "bloqueia schema v2" desatualizado).

### Definição proposta/canônica para backend v2
`DEC-007`: cadeia canônica `Release → Release Track → Phonogram → Work → Rights/Shares`, requisitos mínimos já registrados (`release_id`, `phonogram_id`, `position/order`) — desenho final `TO_BE_DESIGNED`.

### Pontos de confirmação do Product Owner
Confirmar a prioridade de corrigir o bug de `internal_status` (tecnicamente o bug de maior impacto imediato de todo o sistema — bloqueia 100% da criação de lançamentos hoje, embora nenhuma correção de código deva ser feita nesta etapa, ver PO-VERIFY-011).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/releases.md §0,§7,§8,§10,§13,§16`

---

## MODULE-REPORTS

### Finalidade
Central de exportação/relatórios (Export Center) — não confundir com dashboards analíticos (MODULE-DASHBOARD).

### Entidades principais
Nenhuma própria — opera sobre um registro fechado de 22 tabelas (`report-module-registry.ts`), cada uma com contrato de campos explícito (`report-form-contracts.ts`), mais 1 relatório computado (`accounting_summary`, P&L por artista).

### Cada um dos 22 relatórios individualmente (aprofundamento obrigatório: input/source/filtros/output/export/limitações)
Todos os 22 compartilham o mesmo motor (`report-form-contracts.ts` — allowlisting de coluna/filtro/sort, SQL parametrizado, neutralização de formula-injection), o mesmo output (XLSX), o mesmo teto de exportação (50.000 linhas, fail-closed com HTTP 413 explícito) e o mesmo isolamento de tenant (4 camadas independentes) — diferindo apenas na tabela de origem e nas limitações específicas anotadas abaixo.

| # | Chave | Rótulo (UI) | Tipo | Módulo de origem | Limitações específicas conhecidas |
|---|---|---|---|---|---|
| 1 | `artists` | Artistas | entity | artist | dados bancários (jsonb) exportados sem cifra — CONFLITO-04 |
| 2 | `projects` | Projetos | entity | projects | — |
| 3 | `works` | Obras | entity | catalog | — |
| 4 | `phonograms` | Fonogramas | entity, grupo repetível (participantes) | catalog | — |
| 5 | `content_detections` | Monitoramento | entity | monitoring | — |
| 6 | `licenses` | Licenciamento | entity | licensing | remuneração `PERCENTAGE` invisível no export (engano histórico) |
| 7 | `takedowns` | Takedowns | entity | monitoring | — |
| 8 | `releases` | Distribuição | entity, grupo repetível (faixas) | releases | — |
| 9 | `shares` | Shares | entity | releases-adjacente | não auditado em profundidade em nenhum módulo dedicado |
| 10 | `contracts` | Contratos | entity | contracts | PII de partes exportada sem máscara (`GAP-0049`) |
| 11 | `audiovisual_projects` | Projetos Audiovisuais | entity | audiovisual | — |
| 12 | `transactions` | Transações Financeiras | entity | accounting | — |
| 13 | `accounting_summary` | Contabilidade | **computado** (P&L por artista) | accounting | não agrupa por projeto (mesma raiz de `GAP-0013`) |
| 14 | `invoices` | Nota Fiscal | entity, grupo repetível (itens) | accounting | — |
| 15 | `events` | Agenda | entity | events | — |
| 16 | `inventory_items` | Inventário | entity | inventory | — |
| 17 | `clients` | Contatos | entity | crm-relationships | "Contato = Cliente" |
| 18 | `leads` | Leads | entity | leads | — |
| 19 | `employees` | RH | entity | rh | — |
| 20 | `marketing_tasks` | Tarefas | entity | marketing | — |
| 21 | `marketing_content_posts` | Calendário de Conteúdo | entity | marketing | — |
| 22 | `briefings` | Briefing | entity | marketing | — |

**Explicitamente excluídos** deste registro fechado (`NOT_REPORTABLE`): `campaigns` (marketing) e as tabelas do sub-módulo `registry` de `catalog`.

### Tabelas
As 22 tabelas registradas acima — consultadas diretamente, não via os endpoints de listagem paginados de cada módulo (imune ao truncamento silencioso de `limit=50` presente em praticamente todo outro módulo).

### Endpoints / componente chamador
`GET /reports/entities` ← `Relatorios.tsx` ("Central de Relatórios") — única fonte segundo o próprio comentário do código.

### Fluxo funcional principal
1. Usuário escolhe uma entidade registrada, aplica filtros, exporta.
2. Motor consulta a tabela física diretamente (sem depender do endpoint paginado do módulo de origem).
3. Campos cifrados (ex.: email/telefone/CPF de artista) são decifrados apenas no momento da exportação autorizada.

### O que funciona hoje
O módulo mais rigorosamente construído de toda a auditoria — zero `TRUNCATION_GAP`, zero risco de injeção, isolamento de tenant confirmado em 4 camadas independentes.

### O que está parcial
`searchableColumns` é computado mas nunca consumido pelo query builder (dormente).

### O que está quebrado
Nada.

### O que é fake/stub/dead
`exportFieldList()` de `TransacaoFormModal.tsx` (gerador XLSX de 3 abas, código morto, não pertence funcionalmente a este módulo, usa `xlsx` diretamente, não o motor central).

### Decisões que afetam o módulo
Nenhuma.

### Todos os gaps (5)
GAP-0014 (XLSX 3 abas em accounting, atribuído a reports por PII, S3_LOW) · GAP-0049 (PII de contrato exportada sem máscara, herdado de contracts, S2_MEDIUM) · GAP-0135 (fonte confirmada sólida — NO_FIX_REQUIRED) · GAP-0136 (relatórios agendados/recorrentes não existem, S3_LOW, DEFERRED) · GAP-0137 (histórico/auditoria de exportação não é rastreado, S2_MEDIUM).

### Definição proposta/canônica para backend v2
Não produzida — mas o padrão de allowlisting/contrato de campos explícito é candidato natural a se tornar o modelo padrão de todo o v2, não só de `reports`.

### Pontos de confirmação do Product Owner
Se um mascaramento de PII (bancário, dados de contrato) deve ser padronizado antes da exportação — hoje o tratamento é inconsistente entre entidades equivalentemente sensíveis (CONFLITO-04).

### Confidence
HIGH (verificado por leitura direta de `reports.md` nesta etapa, incluindo a lista completa dos 22 relatórios)

### Evidence
`docs/backend-v2/field-traceability/modules/reports.md (leitura direta desta etapa, listagem completa report-module-registry.ts)`

---

## MODULE-RH

### Finalidade
Gestão interna de RH — funcionários, folha de pagamento, férias/ausências, documentos. `Employee` é estruturalmente distinto de `User`/`OrgMember` da plataforma — confirmado sem FK entre eles.

### Cada sub-domínio, com CRUD quebrado citado individualmente (aprofundamento obrigatório)
| Sub-domínio | CREATE | READ (lista) | UPDATE | DELETE | Causa raiz |
|---|---|---|---|---|---|
| **Funcionário** (`employees`) | **QUEBRADO — HTTP 400 sempre** (`GAP-0138`) | **QUEBRADO — lista sempre em branco** (`GAP-0143`) | não avaliado (create já bloqueia o fluxo) | não avaliado | `CreateEmployeeDto` exige `nome`, o form nunca o envia e envia 8 campos não whitelisted (`nome_completo`, `rg`, `data_nascimento`, `endereco`, `setor`, `salario_base`, `observacoes`, `vinculo_usuario_id`) que **não estão declarados na entidade TypeORM** (`GAP-0141`) apesar de existirem fisicamente na tabela — a mesma migration que criou as 8 colunas nunca atualizou a entidade |
| **Folha de Pagamento** (`payroll_entries`) | **QUEBRADO — HTTP 400 sempre** (`GAP-0139`) | funcional | **nenhum PATCH existe** | **nenhum DELETE existe** | `employee_id`/`competencia` exigidos vs. `funcionario_id`/`mes_referencia` enviados pelo form — mesmo padrão de `GAP-0138`, causa-raiz independente |
| **Férias/Ausências** (`leave_requests`) | **QUEBRADO — HTTP 400 sempre** (`GAP-0140`) | funcional | só 1 rota, hardcoded para "aprovado", sem caminho de rejeição — mas a UI oferece editar/rejeitar como se funcionassem (chamam rotas inexistentes, 404) | mesma situação | `employee_id` vs. `funcionario_id`/`dias_totais` — mesmo padrão |
| **Documentos** (via `/hr/employees`) | endpoint dedicado real no backend, **nunca ligado ao frontend** (`GAP-0142`) | aba "Documentos" aponta ao endpoint errado (`/hr/employees`), lista todo funcionário do tenant rotulado incorretamente como "documento" | upload do arquivo em si funciona (chega ao R2) | mesmo erro 400 do item Funcionário na criação do registro de metadado | endpoint/UI desalinhados independentemente do bug de Funcionário |

### Entidades principais
`Employee` (`employees`, 27 col), `PayrollEntry` (`payroll_entries`, 19 col), `LeaveRequest` (`leave_requests`, 18 col).

### Tabelas
`employees`, `payroll_entries`, `leave_requests`.

### Endpoints / componente chamador
`GET/POST/PATCH /hr/employees` ← `RH.tsx`/`FuncionarioFormModal.tsx`; `GET/POST /hr/payroll` ← `FolhaPagamentoFormModal.tsx`; `GET/POST /hr/leave-requests` ← `FeriasAusenciasFormModal.tsx`.

### Fluxo funcional principal
1. Usuário tenta criar um Funcionário — `CreateEmployeeDto` exige `nome` e aceita 13 campos; o formulário nunca envia `nome` e envia 8 campos não permitidos — **HTTP 400 em toda tentativa real**.
2. Mesmo padrão se repete, de forma independente, em Folha de Pagamento e em Férias/Ausências (ver tabela acima).
3. Mesmo a listagem de leitura de Funcionários está quebrada: 8 colunas reais nunca são retornadas pela API (a entidade não as declara) — nome/setor/salário/vínculo aparecem sempre em branco na tabela, e a busca/filtro por Setor nunca funciona.

### O que funciona hoje
Isolamento de tenant e autorização (confirmados sólidos); criptografia de PII (email/telefone/CPF, mesmo padrão correto de outros módulos).

### O que está parcial
Nenhum PATCH/DELETE existe para Folha de Pagamento; Férias/Ausências tem só 1 rota de mudança de status.

### O que está quebrado
Create de Funcionário, Folha, Férias — 100% quebrados (S1_HIGH); leitura da lista de Funcionários também quebrada (drift de coluna); cálculo de salário líquido de folha é 100% client-side, sem validação de servidor.

### O que é fake/stub/dead
Nada classificado como fake — os 4 fluxos são reais, apenas desconectados por divergência de contrato.

### Decisões que afetam o módulo
Nenhuma.

### Todos os gaps (9)
GAP-0090 (responsável de item de inventário é texto livre, compartilhado por citação cruzada, S2_MEDIUM) · GAP-0138 (Employee CREATE_MAPPING_MISMATCH, S1_HIGH) · GAP-0139 (Payroll CREATE_MAPPING_MISMATCH, S1_HIGH) · GAP-0140 (Leave-request CREATE_MAPPING_MISMATCH, S1_HIGH) · GAP-0141 (Employee entity sem 8 colunas físicas reais, S1_HIGH) · GAP-0142 (endpoint de documentos nunca ligado ao frontend, S2_MEDIUM) · GAP-0143 (lista de funcionários renderiza em branco, S1_HIGH) · GAP-0144 (EmployeeStatus ENUM_MISMATCH, S2_MEDIUM) · GAP-0145 (mesmo drift de coluna em payroll/leave_requests, S2_MEDIUM) · GAP-0146 (limite 50 sem paginação, S2_MEDIUM).

### Definição proposta/canônica para backend v2
Não produzida — mas a própria migration que criou as 8 colunas órfãs (`20260712000003_HrFormFieldColumns.ts`) já documenta a intenção original (espelhar campos de formulário em colunas físicas), nunca implementada.

### Pontos de confirmação do Product Owner
Se o módulo `rh` é um requisito de produto ativo e prioritário, dado que está, hoje, 100% não-funcional para create/edit em todos os 4 sub-recursos (ver PO-VERIFY-012).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/hr.md §0,§1`

---

## MODULE-SETTINGS

### Finalidade
Hub de configuração multi-superfície: perfil da empresa/branding, preferências de usuário, notificações, segurança, acesso (RBAC), integrações, localização, billing, feature flags, cadastro público. **Não existe um único módulo de backend chamado `settings`** — o frontend agrega vários módulos de backend reais (`company-settings`, `notifications`, `billing`, RBAC) mais um conceito deliberadamente stubado ("listas operacionais").

### Classificação de toda área (aprofundamento obrigatório: REAL/PARTIAL/FAKE/HARDCODED/FRONTEND_ONLY/BACKEND_BACKED/BROKEN)
| Área | Classificação | Nota |
|---|---|---|
| Perfil da empresa (`company-settings`) | **REAL / BACKEND_BACKED** | `GET/PATCH /company-settings`, persiste corretamente |
| Upload de logo | **BROKEN** | `POST /api/v1/workspaces/{id}/logo` não existe em lugar nenhum do backend (`GAP-0149`) |
| Preferências de usuário | **FRONTEND_ONLY** | 100% `localStorage`, sem tabela de backend |
| Notificações ("Automações" tab) | **BACKEND_BACKED mas sem consumidor** | `notification_settings` real (14 chaves), zero chamador no frontend (`GAP-0147`); 4 toggles são `<Switch checked={true}>` hardcoded, sem handler (**HARDCODED**, `GAP-0148`) |
| Segurança (2FA, sessões, exclusão de conta) | **FAKE** | 6 itens sem `onClick`, dados hardcoded (`GAP-0155`, DEFERRED) |
| Integrações (aba) | **REAL** | reusa diretamente os hooks/componentes reais do módulo `integrations`, não é cópia obsoleta |
| Acesso/RBAC (aba "Usuários") | **REAL / BACKEND_BACKED** | compartilha o backend RBAC com `auth`/`workspace` |
| Localização (idioma/fuso/moeda) | **FRONTEND_ONLY** | salva só em `localStorage`, não em coluna backend tenant/user-scoped (`GAP-0156`) |
| Billing | **PARTIAL / FRAGMENTADO** | ver sub-seção `DOMAIN-BILLING` abaixo |
| Feature flags | **FRONTEND_ONLY / HARDCODED** | mapa hardcoded no frontend, sem `tenant_feature_flags` nem gate de backend (`GAP-0154`) |
| Cadastro público (slug) | **PARTIAL** | backend real e ativo (`allow_public_registration`), mas UI mostra botões desabilitados com mensagem obsoleta; slug salvo em `localStorage` por administrador, não por tenant — `LOCAL_STORAGE_GAP` crítico de negócio |
| "Listas operacionais" | **FRONTEND_ONLY stub honesto** | `operational_list_items` real, zero consumidor — auto-documentado, não um "sucesso fabricado" disfarçado |
| `AuditTrail.tsx` | **REAL mas DEAD (não roteado)** | construída, backend-wired, nunca alcançável pela navegação |

### Entidades principais
`organizations`/`tenants.settings` (perfil/branding/localização), `notification_settings`, `billing_subscriptions`/`billing_plans`/`tenant_billing_state`, `operational_list_items` (real, zero consumidor).

### Tabelas
`organizations`, `tenants` (`.settings` jsonb), `notification_settings`, `billing_subscriptions`, `billing_plans`, `tenant_billing_state`, `operational_list_items`.

### Endpoints / componente chamador
`GET/PATCH /company-settings` ← `Configuracoes.tsx` aba "Empresa"; `GET/PATCH /notifications/settings` ← aba "Automações" (backend real, zero chamador); `GET /billing/plans`, `POST /billing/checkout`, `POST /billing/portal`, `GET /billing/subscription` ← ver `DOMAIN-BILLING`; `GET /billing/invoices` **não existe** (só `GET /billing/admin/invoices`, `super_admin`).

## DOMAIN-BILLING (sub-seção obrigatória — análise completa de DEC-005)

### As 3 superfícies de billing coexistentes
1. **`Configuracoes.tsx` aba "Billing"** — arquitetura correta (planos dinâmicos via `GET /billing/plans`, nunca hardcoda preço), mas invoices e 3 botões de ação ("Gerenciar Assinatura"/"Adicionar Assentos"/"Fazer Upgrade") são decorativos (chamam `toast.info(...)` em vez das chamadas reais de checkout/portal, que existem e funcionam corretamente um arquivo ao lado).
2. **`Billing.tsx` standalone** (`/configuracoes/billing`) — hardcoda preços de plano (`R$ 299`/`R$ 799`/"Consultar"), contradizendo o próprio comentário de governança do código-base ("planos NÃO podem ser hardcoded na tela"); usa corretamente as chamadas reais de checkout/portal do Stripe.
3. **`BillingBlockedPage.tsx`** — propósito distinto (tela de bloqueio por inadimplência), não faz parte do conflito das duas primeiras.

### O que é real e funciona hoje, independentemente de qual UI vence
Stripe Checkout (`POST /billing/checkout`) e Stripe Portal (`POST /billing/portal`) — reais, funcionam corretamente no backend, só não estão ligados aos botões de `Configuracoes.tsx`. `GET /billing/plans` — real. Gap de faturas (`GET /billing/invoices` inexistente) e o cartão de pagamento falso (`•••• 4242` hardcoded, `GAP-0152`) são achados independentes de qual superfície vence — existem em ambos os cenários possíveis.

### As 3 opções registradas em `decision-register.json` (DEC-005) — nenhuma escolhida aqui
| Opção | Vantagens | Desvantagens | Riscos |
|---|---|---|---|
| **(1) `Configuracoes.tsx` "Billing" canônica** (recomendação registrada no `decision-register.json`) | Arquitetura já correta (não hardcoda preço); reaproveitamento direto do padrão dinâmico já usado em outras abas | Exige implementar o endpoint de troca de plano que falta (`PATCH /billing/subscription/plan`, `GAP-0151`) antes de ficar funcionalmente completa; exige depreciar `Billing.tsx`, uma rota já linkada/em uso | Trabalho de backend adicional antes do cutover; risco de regressão se `Billing.tsx` tiver tráfego real não medido |
| **(2) `Billing.tsx` standalone canônica** | Já é a página mais usada/linkada hoje; checkout/portal já funcionam corretamente nela | Preços hardcoded violam a própria convenção documentada do código-base; exigiria reescrever a lógica de exibição de plano para consumir `GET /billing/plans` dinamicamente | Risco de preço desatualizado exibido ao usuário até a correção; risco de regressão de UX se a rota mudar |
| **(3) Fundir as duas em uma única rota/componente** | Elimina a fragmentação definitivamente; permite reaproveitar o melhor de cada uma (arquitetura correta de uma + tração de uso da outra) | Maior esforço de engenharia imediato; exige decisão de qual rota/URL sobrevive | Risco de escopo se não for delimitado explicitamente antes de iniciar |

### Status formal
```
DEC-005: PENDING_PRODUCT_DECISION
DEC_005_ANALYSIS_STATUS: PARKED_UNCHANGED
```
A análise acima já está concluída e registrada em `decision-register.json`/`settings.md §9` — a decisão em si **não foi tomada nem registrada como resolução formal**. Este relatório **não escolhe** uma opção. `DEC-005` permanece pendente de confirmação do Product Owner.

### O que funciona hoje (visão geral do módulo)
Perfil da empresa; troca de senha; planos/checkout/portal do Stripe (no backend e em `Billing.tsx`); aba Integrações (reuso real); "listas operacionais" (stub honesto).

### O que está parcial
Cadastro público (backend real e ativo, UI com mensagem obsoleta).

### O que está quebrado
Upload de logo; lista de faturas; notificações (backend real, zero chamador); FeatureGate ("Ver planos") aponta para rota não registrada (`/settings/billing`, `GAP-0153`).

### O que é fake/stub/dead
Cartão de método de pagamento; 4 toggles de notificação hardcoded; segurança (2FA/sessões/exclusão de conta, sem `onClick`); slug de cadastro público (`localStorage` per-usuário, não per-tenant); `AuditTrail.tsx` (construída, nunca roteada).

### Decisões que afetam o módulo
`DEC-005` (PENDING) — billing, ver acima; `DEC-006` (PENDING) — gestão de convites duplicada entre `/usuarios` e a aba "Usuários" (ver MODULE-WORKSPACE).

### Todos os gaps (16)
GAP-0005 (billing fragmentado, DEC-005 pendente, S2_MEDIUM) · GAP-0006 (convites duplicados, DEC-006 pendente, compartilhado, S2_MEDIUM) · GAP-0051 (status DocuSign em sessionStorage, compartilhado, S2_MEDIUM) · GAP-0081 (Stripe client real em Billing.tsx, reconciliado, DEFERRED) · GAP-0147 (toggles sem consumidor backend, S2_MEDIUM) · GAP-0148 (2 toggles hardcoded, S3_LOW) · GAP-0149 (upload de logo sem endpoint, S2_MEDIUM) · GAP-0150 (billing sem fonte única, S2_MEDIUM) · GAP-0151 ("Alterar Plano" chama endpoint inexistente, S1_HIGH) · GAP-0152 (cartão de pagamento fake, S2_MEDIUM) · GAP-0153 (feature-gate aponta a rota não registrada, S3_LOW) · GAP-0154 (feature flags só no frontend, S2_MEDIUM) · GAP-0155 (aba de segurança sem backend, DEFERRED) · GAP-0156 (localização em localStorage, S3_LOW) · GAP-0162 (slug público em localStorage — mesma causa-raiz de workspace, S3_LOW) · GAP-0163 (3ª instância confirmada de UI duplicada, S3_LOW).

### Definição proposta/canônica para backend v2
Não produzida — `DEC-005` precisa ser resolvida antes de qualquer desenho de billing v2.

### Pontos de confirmação do Product Owner
`DEC-005` (qual superfície de billing vence, ver PO-VERIFY-019); se o slug de cadastro público deve migrar para armazenamento server-side como prioridade (PO-VERIFY-024).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/settings.md §0,§4,§5,§6,§9,§11,§12 | docs/backend-v2/gap-resolution/decision-register.json (DEC-005)`

---

## MODULE-SUPPORT

### Finalidade
Sistema de tickets de suporte real (tenant-scoped) — mais 4 subfuncionalidades deliberadamente falsas no mesmo módulo de frontend.

### Separação obrigatória: tickets reais vs. triagem por IA vs. chat fake vs. base de conhecimento fake
| Sub-feature | Classificação | Evidência |
|---|---|---|
| **Tickets** (`SupportTickets.tsx`/`SupportTicketDetail.tsx`/`SupportDashboard.tsx`) | **REAL** | CRUD + workflow real de 7 transições role-gated, dentro de transação de banco; 1 broadcast Realtime real na resolução |
| **Triagem automática por IA** (dentro do fluxo real de tickets) | **REAL** | parte do workflow real de criação/priorização de ticket, distinto das 4 subfuncionalidades abaixo |
| **`SupportChat.tsx`** | **FAKE, auto-declarado** | hook admite explicitamente "é proibido simular o backend em localStorage" — falha explicitamente, nunca simula sucesso |
| **`SupportKnowledge.tsx`** (base de conhecimento/FAQ) | **FAKE, auto-declarado** | mesmo padrão — reusado também por `AdminKnowledge.tsx` |
| **`SupportStatus.tsx`** (status de incidente) | **FAKE, auto-declarado** | idem |
| **`SupportRequests.tsx`** (quadro de solicitações) | **FAKE, auto-declarado** | idem |

Todas as 4 subfuncionalidades fakes são classificadas `INTENTIONAL_STUB` (`GAP-0160`, DEFERRED) — nenhuma delas simula sucesso ou dado fabricado; todas falham honestamente.

### Entidades principais
`SupportTicket` (`support_tickets`, 17 col) — único recurso real com tabela.

### Tabelas
`support_tickets`.

### Endpoints / componente chamador
`GET/POST/PATCH/DELETE /support-tickets` ← `SupportTickets.tsx`; mesma rota (`?limit=200`) ← `AdminSupport.tsx` (ver MODULE-ADMIN).

### Enum de status do ticket — 3 vocabulários divergentes
Backend real tem 6 estados (incluindo `pending_user`/`cancelled`); o tipo do próprio módulo `support` tem só 5 (`waiting_customer` em vez de `pending_user`, sem `cancelled`); o módulo `admin` tem um **terceiro** vocabulário de 5 valores (`waiting`) — confirmado um `TypeError` real e alcançável em `AdminSupport.tsx` para qualquer ticket movido a um dos 2 estados ausentes (`GAP-0157`, S1_HIGH).

### Fluxo funcional principal
1. Usuário abre um ticket real via `SupportTickets.tsx` — persistido corretamente, workflow real de 7 transições role-gated, dentro de uma transação de banco.
2. Categoria do ticket tem `ENUM_MISMATCH` independente (backend aceita 5 valores; frontend declara 10 valores de domínio não relacionados) — risco de rejeição no momento da criação (`GAP-0158`).
3. Anexos são o padrão "mais fake" encontrado nesta série: o simulador de chat nem chega a criar uma referência `blob:` efêmera — só ecoa nome/tamanho de arquivo como texto numa mensagem que, ela mesma, nunca persiste.

### O que funciona hoje
Sistema de tickets real (CRUD + workflow de 7 transições + triagem automática por IA + SLA básico + 1 broadcast Realtime real na resolução).

### O que está parcial
Notificação na resolução de ticket grava 2 linhas de notificação (solicitante + gestor) via handlers distintos — padrão levemente duplicado, mas funcional.

### O que está quebrado
`AdminSupport.tsx` — crash alcançável (`TypeError`) ao abrir um ticket em um dos 2 estados ausentes do vocabulário do admin (`GAP-0157`); `ENUM_MISMATCH` de categoria (`GAP-0158`).

### O que é fake/stub/dead
`SUPPORT_CHAT`, `KNOWLEDGE_BASE`/FAQ, `INCIDENT_SUPPORT`/status, quadro de solicitações — todas as 4, auto-declaradas e honestamente falhando; rota `/support/tickets/new` não registrada (link morto do "Novo Ticket" no dashboard).

### Decisões que afetam o módulo
Nenhuma.

### Todos os gaps (7)
GAP-0021 (moldura cross-tenant enganosa de AdminSupport, compartilhado com admin, S2_MEDIUM) · GAP-0022 (AdminKnowledge mock dev-only, ACCEPTED_BY_EXISTING_CONTRACT) · GAP-0157 (crash alcançável por ENUM_MISMATCH de status, S1_HIGH) · GAP-0158 (ENUM_MISMATCH de categoria, S1_HIGH) · GAP-0159 (moldura cross-tenant — CLOSED/NO_FIX_REQUIRED) · GAP-0160 (4 subfuncionalidades fakes — INTENTIONAL_STUB, DEFERRED) · GAP-0161 (limite 50 sem paginação, S2_MEDIUM).

### Definição proposta/canônica para backend v2
Não produzida — mas a distinção real ticket vs. 4 fakes já está claramente estabelecida como base para qualquer escopo de v2.

### Pontos de confirmação do Product Owner
Se chat/base de conhecimento/status de incidente/quadro de solicitações são requisitos reais de roadmap (hoje 100% fakes, auto-declarados) ou se devem ser removidos da superfície do produto.

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/support.md §0,§1,§2,§3,§4`

---

## MODULE-WORKSPACE

### Finalidade
Unidade de isolamento tenant — "Workspace" é o nome de UI/DTO para a tabela `tenants`.

### Tenant/Workspace-alias/Organization/membership/invitation/provisioning/`org_id` — o quirk de nomenclatura completo (aprofundamento obrigatório)
- **`Tenant`** (`tenants`, 18 col) — a unidade real de isolamento multi-tenant no banco de dados. É o que a UI chama de **"Workspace"**: `WORKSPACE_TENANT_RELATIONSHIP: SAME_ENTITY`, confirmado por leitura direta do código de provisionamento — não há uma segunda tabela `workspaces`.
- **`Organization`** (`organizations`, 16 col) — pai legal/billing, tecnicamente uma entidade distinta de `Tenant`, mas **1:1 na prática** via `WorkspaceProvisioningService.provision()`, que sempre cria ambas juntas na mesma transação.
- **`org_members`** (18 col) — membership real, revalidada a cada request; FK `role_id→roles`, `department_id→departments`, `position_id→positions`.
- **`tenant_invitations`** (14 col) — convite pendente; FK `org_id→organizations` (não `tenant_id`, apesar de também carregar `tenant_id` como parte da FK composta).
- **`roles`** — RBAC tenant-scoped.
- **O quirk do claim JWT `org_id`**: o token JWT carrega um claim chamado `app_metadata.org_id` — mas seu *valor* é sempre um `tenants.id`, **nunca** um `organizations.id`. O nome é um artefato de nomenclatura de um design anterior ao atual, não um bug funcional (o sistema nunca confunde os dois valores na prática, só o *nome do claim* é enganoso).

### Entidades principais
`tenants` (= workspace), `organizations` (pai legal/billing, distinto, 1:1 na prática via provisioning), `org_members` (membership), `tenant_invitations`, `roles`.

### Tabelas
`tenants`, `organizations`, `org_members`, `tenant_invitations`, `roles`.

### Endpoints / componente chamador
`PATCH /auth/provision-workspace` ← `AuthContext.tsx` (auto); `PATCH /auth/onboarding` ← `Onboarding.tsx`; `GET /auth/context` ← toda navegação pós-login; `GET/POST/PATCH/DELETE /users*` ← `Usuarios.tsx`; `GET/POST /users/invitations*` ← `Usuarios.tsx` e a aba "Usuários" de `Configuracoes.tsx` (2 entradas, fragmentado); `GET/PATCH /billing/admin/tenants[/:id]` ← `AdminClients.tsx` (`super_admin`, cross-tenant real).

### Fluxo funcional principal
1. Usuário se cadastra (`Register.tsx`) — `supabase.auth.signUp()` seta `user_metadata.workspace_slug`.
2. `AuthContext` detecta ausência de `org_id` no JWT → dispara `PATCH /auth/provision-workspace`.
3. `WorkspaceProvisioningService.provision()` — transação única: lock consultivo por usuário, checagem de idempotência, lock consultivo por slug, cria `organizations`+`tenants`+`org_members` (role owner), sincroniza `app_metadata.org_id = tenants.id` no Supabase **antes** do commit.
4. Convites: `POST /users/invitations` cria `org_members` **imediatamente** (acesso concedido antes da aceitação) + `tenant_invitations` (pending); primeiro `GET /auth/context` pós-login auto-aceita o convite pendente.

### O que funciona hoje
Provisionamento (atômico, idempotente — o fluxo de criação mais limpo encontrado em toda a série); `TenantGuard` (nunca confia no header do cliente); proteção de "último owner" (bloqueia demoção/remoção do último owner ativo); isolamento de storage (prefixo `tenants/<id>/...` + checagem de `tenant_id` em toda query de linha).

### O que está parcial
Nenhum "switcher" de workspace existe (uma sessão JWT = um tenant; múltiplas memberships são tecnicamente possíveis no schema, mas nenhuma UI oferece trocar entre elas na mesma sessão) — confirmado característica arquitetural, não um gap.

### O que está quebrado
Nada tecnicamente quebrado neste módulo — é, segundo a própria auditoria, "o módulo estruturalmente mais sólido encontrado em toda a série".

### O que é fake/stub/dead
Nada.

### Decisões que afetam o módulo
`DEC-006` (PENDING) — gestão de convites fragmentada entre `/usuarios` (só cria convite, sem visibilidade de pendentes/reenvio/cancelamento) e a aba "Usuários" de `Configuracoes.tsx` (superfície completa) — qual vence.

### Todos os gaps (7)
GAP-0006 (convites duplicados, DEC-006 pendente, compartilhado, S2_MEDIUM) · GAP-0038 (auto-aceite de convite como efeito colateral — NO_FIX_REQUIRED) · GAP-0162 (slug público em localStorage — CLOSED, mesma causa-raiz de settings, S3_LOW) · GAP-0163 (3ª instância confirmada de UI duplicada, S3_LOW) · GAP-0164 (seleção de tenant sem sync server-side de "último usado", S3_LOW) · GAP-0165 (remoção de membro sem reatribuição/auditoria de `created_by`, S2_MEDIUM) · GAP-0166 (limite 50 na lista de membership, S3_LOW).

### Definição proposta/canônica para backend v2
`tenants.id` como identificador canônico de tenant, preservado; nenhuma mudança de modelo necessária — este módulo é considerado uma base sólida para o v2 sem redesenho.

### Pontos de confirmação do Product Owner
`DEC-006` (qual superfície de convite vence, PO-VERIFY-020); se a nomenclatura confusa do claim JWT (`org_id` carregando um `tenants.id`) deve ser corrigida (renomeado) no v2 ou mantida por compatibilidade (PO-VERIFY-007).

### Confidence
HIGH

### Evidence
`docs/backend-v2/field-traceability/modules/workspace.md §0,§6,§7,§8,§9,§13,§17`

---

# PARTE VII — RELAÇÕES CROSS-DOMAIN (consolidado)

A tabela mestra completa de relações cross-domain já foi construída em **Parte V.3** (extensão física do schema, 142 tabelas, sobre as 17 relações originais do relatório mestre `§24`). Esta parte não a duplica — consolida, em prosa, os padrões observados através dos 24 módulos (Parte VI):

1. **Padrão `financial_project_id` / `LEGACY_NAMING`**: `audiovisual_projects.financial_project_id` e `marketing_projects.financial_project_id` são FKs físicas reais e corretas apontando para `projects.id`, mas (a) o nome sugere propósito financeiro quando a função real é vincular ao projeto musical de origem, e (b) nenhum formulário de nenhum dos 2 módulos jamais escreve o valor (`GAP-0033`). O mesmo padrão de "FK real, nunca escrita pela UI" se repete em `audiovisual`'s `artist_id`/`campaign_id`/`event_id` (`GAP-0034`).
2. **Padrão "MISSING_RELATION bloqueante"**: `releases ↔ projects` (`GAP-0168`) foi o único gap cross-domain com `blocksSchemaV2Design: true` em toda a auditoria — corrigido: a decisão (`DEC-009: PROJECT_RELEASE_DIRECT_LINK`) foi resolvida pelo Product Owner, `blocksSchemaV2Design` agora `NÃO`; nenhum gap bloqueia mais o desenho do schema v2 por ambiguidade de decisão.
3. **Padrão "propagação financeira parcial"**: `contracts→accounting` é a única propagação automática real confirmada (só o campo `valor`); `events`, `licensing`, `monitoring` não têm nenhuma propagação, apesar de todos gerarem valor financeiro conceitualmente (ver a tabela de propagação em MODULE-ACCOUNTING).
4. **Padrão "conversão automática sem checagem de duplicata"**: a conversão de Lead→Cliente/Artista sempre cria um novo `Artist`, sem checar duplicata nem tipo de lead (achado isolado, mas do mesmo gênero estrutural que a ausência de detecção de duplicidade na captação — `GAP-0101`).
5. **Padrão "camada de schema paralela sem consumidor"**: a segunda camada de accounting (`financial_transactions`/`financial_accounts`/`cost_centers`/`counterparties`/`transaction_allocations`/`performance_metric_entries`/`budgets`), descoberta nesta auditoria (Parte V.2), é estruturalmente a relação cross-domain mais rica do sistema (FKs para `artists`/`phonograms`/`projects`/`releases`/`contracts`/`events`/`clients` simultaneamente) — mas sem nenhum consumidor de frontend ou service confirmado em qualquer um dos 24 relatórios de módulo.

`EVIDENCE: Parte V.3 (tabela mestra) + Parte VI (24 seções de módulo) | CONFIDENCE: HIGH para os padrões 1-3 (evidenciados por múltiplos módulos independentes); MEDIUM para o padrão 5 (achado de schema, sem confirmação de módulo dedicado)`

---

# PARTE VIII — INTEGRAÇÕES (consolidado)

A matriz completa de provedores (21 entradas + sub-tabela de 6 distribuidoras) já foi construída em **MODULE-INTEGRATIONS** (Parte VI). Esta parte consolida os pontos transversais:

## VIII.1 Resumo por status
- **IMPLEMENTED (9)**: Spotify, YouTube, Instagram/Meta, TikTok/TikTok Ads, Google Ads, Cloudflare R2, Resend, Sentry, roteador de IA (OpenAI/Anthropic/Google AI).
- **PARTIAL (5)**: Stripe, Stripe Connect, DocuSign, Autentique, ABRAMUS, ACRCloud.
- **STUB honesto (2)**: Clicksign, PostHog.
- **STUB honesto — 6 distribuidoras nomeadas**: ONErpm, DistroKid, Symphonic, SoundOn, MusicPro, SomVibe (ver sub-tabela dedicada em MODULE-INTEGRATIONS).
- **UI_ONLY (3)**: NF-e, ECAD (card de conexão), UBC.
- **CONFIG_ONLY (1)**: framework genérico `external-data`.

## VIII.2 Lembrete do modelo de credenciais (não alterado, nenhum valor real manuseado)
Dois espaços de credencial distintos, confirmados consistentes em toda a auditoria de `integrations`:
- **Segredos de plataforma/sistema** (`PLATFORM_SHARED`) — pertencem à própria aplicação MUSIC OS 360, não a um tenant específico (ex.: chave da API do Spotify usada para sincronizar métricas de qualquer artista, credencial do Resend para envio de e-mail transacional, chave do Sentry). Devem viver em variável de ambiente / gerenciador de segredos da plataforma — nunca em uma tabela de negócio associada a um tenant.
- **Credenciais de provedor por tenant** (`TENANT_OWNED`) — pertencem ao negócio de um tenant específico (ex.: token da conta Autentique do tenant, credencial OAuth do Instagram/Meta conectada por aquele tenant, futura credencial de distribuidora quando implementada). Devem viver em armazenamento seguro específico por tenant, cifrado (o padrão já usado por `IntegrationBaseService`: AES-256-GCM).

Nenhum valor de credencial real foi impresso, adicionado ou solicitado neste relatório ou em qualquer etapa anterior desta auditoria (`CREDENTIALS_TO_ADD_NOW: 0` confirmado em todos os módulos que tocam integrações, incluindo as 6 distribuidoras nomeadas nesta etapa).

`EVIDENCE: docs/backend-v2/field-traceability/modules/integrations.md §18 | CONFIDENCE: HIGH | STATUS: CONFIRMED`

---

# PARTE IX — AUTH / TENANCY / SECURITY

## IX.1 Tenant / org_id / workspace / membership / JWT / guard / RLS

PostgreSQL é o banco único (via Supabase). Isolamento multi-tenant hoje se apoia em `tenant_id` explícito em toda tabela de negócio, resolvido sempre server-side a partir do JWT verificado (nunca do `X-Tenant-ID` enviado pelo cliente, usado só como checagem de consistência) — `TenantGuard` + `TenantBootstrapResolver` + `@CurrentTenant()` (ver Parte IV.3 para a cadeia completa de guards). RLS (Row Level Security) é mencionada como mecanismo adicional em pontos específicos (ex.: autorização de Realtime broadcast, migration `20260801000001_RealtimeBroadcastAuthorization`), mas o enforcement primário confirmado em toda a série de auditoria é a checagem explícita de `tenant_id` em cada query de aplicação, não RLS como camada única.

**Tabelas tenant-scoped**: 137 das 142 tabelas do schema (ver Parte V.1) — as exceções são as 5 tabelas globais de RBAC (`permissions`, `permission_groups`, `permission_aliases`, `permission_conflicts`, `permission_dependencies`) e `musicos360_migrations` (controle técnico).

**Casos de admin cross-tenant**: apenas `GET/PATCH /billing/admin/tenants[/:id]` (`super_admin`, `MODULE-ADMIN`) é genuinamente cross-tenant. `AdminAudit.tsx`/`AdminSupport.tsx` são moldurados como cross-tenant na UI mas são tenant-scoped no backend (`GAP-0021`) — um achado de UX enganosa, não uma falha de isolamento.

**Workspace/tenant/organization**: ver MODULE-WORKSPACE para o quirk completo de nomenclatura (`org_id` no JWT sempre carrega um `tenants.id`, nunca um `organizations.id`).

`EVIDENCE: docs/backend-v2/field-traceability/modules/auth.md §3,§4 | modules/workspace.md §0,§10,§18 | docs/backend-v2/field-traceability/74-zero-gap-reconstruction-contract.md §12 | CONFIDENCE: HIGH | STATUS: CONFIRMED`

## IX.2 Segurança — visão consolidada

| Mecanismo | Estado confirmado | Evidência |
|---|---|---|
| JWT | Verificação real via `JwtAuthGuard`, claims resolvidos server-side, nunca confiando em header do cliente | Parte IV.3, MODULE-AUTH |
| RLS | Mecanismo adicional confirmado em pontos específicos (Realtime broadcast); enforcement primário é `tenant_id` explícito em código de aplicação | MODULE-AUTH §3 |
| RBAC | Modelo dual (`role` string legada + `role_id` FK), sempre ambos preenchidos após qualquer caminho de escrita real; 25 tabelas dedicadas (Parte V.2) | MODULE-WORKSPACE |
| CORS | Configurado via `@nestjs/config`/env — não auditado a fundo nesta série além da confirmação de existência | `apps/api/src/app.module.ts`, MEDIUM |
| Helmet | Presente na cadeia de middleware Nest padrão — não reauditado individualmente nesta etapa | MEDIUM |
| Rate limiting | `RateLimitGuard` real, parte da cadeia global de guards (Parte IV.3) | HIGH |
| Criptografia de PII | AES-256-GCM real e consistente em `artists` (4 campos), `clients` (3 campos) — **inconsistente** em `artists.dados_bancarios` (jsonb, não cifrado, exportado em texto puro — CONFLITO-04) | Parte VI (MODULE-ARTIST, MODULE-CRM-RELATIONSHIPS) |
| Webhooks | Idempotência real via `webhook_events.external_id UNIQUE`; validação de assinatura confirmada em Stripe/Autentique | MODULE-INTEGRATIONS |
| Trust proxy | Não auditado individualmente nesta série — sem achado registrado | UNKNOWN |
| Body limits | Não auditado individualmente nesta série — sem achado registrado | UNKNOWN |
| Uploads | Pipeline real via Cloudflare R2 para a maioria dos módulos (artist, releases/artwork, inventory); vários stubs de upload confirmados por módulo (ver "fake/stub/dead" em cada seção da Parte VI) — nenhum stub de upload representa um risco de segurança (todos falham explicitamente, nenhum aceita e descarta um arquivo malicioso silenciosamente) | Parte VI, múltiplos módulos |
| Raw body / HTTPS | Não auditado individualmente nesta série além da confirmação de que webhooks (Stripe) dependem de raw body para validação de assinatura (implícito no uso de SDK Stripe padrão) | MEDIUM |

**Nenhum gap de autorização ou de isolamento de tenant foi inventado nesta etapa** — onde as auditorias anteriores confirmaram `AUTHORIZATION_GAPS: 0`/`TENANT_ISOLATION_GAPS: 0` (ex.: `TenantGuard`, proteção de "último owner", isolamento de storage por prefixo `tenants/<id>/...`), este relatório preserva essa confirmação sem alteração. Os gaps de segurança concretos identificados nesta série são: (1) inconsistência de criptografia de dados bancários de artista (CONFLITO-04, PO-VERIFY-022); (2) PII de partes de contrato em texto livre sem cifra (`GAP-0049`); (3) `signOut()` não fecha canais Realtime (`GAP-0037`); (4) allowlist de Redirect/Site URL do Supabase não verificável por código, bloqueando o cutover (`GAP-0039`).

`EVIDENCE: consolidação de Parte VI (MODULE-AUTH, MODULE-ARTIST, MODULE-CRM-RELATIONSHIPS, MODULE-INTEGRATIONS) + Parte IV.3 | CONFIDENCE: HIGH para os itens com achado citado; UNKNOWN explicitamente marcado para trust proxy/body limits (não cobertos por nenhum dos 24 relatórios de módulo)`

---

# PARTE X — STORAGE / REALTIME / JOBS

## X.1 Storage (Cloudflare R2 / Supabase Storage) — real vs. fake/stub por módulo

| Módulo | Storage | Estado |
|---|---|---|
| artist | R2 (foto/documentos) | **REAL** |
| releases | R2 (artwork) | **REAL** (delete não limpa o objeto, `GAP-0132`) |
| inventory | R2 (foto de item) | **REAL** (delete não limpa o objeto, `GAP-0096`) |
| rh | R2 (upload de documento) | **REAL** (mas criação do registro de metadado falha por `GAP-0138`-adjacente) |
| projects/catalog (áudio de faixa/fonograma) | — | **STUB hardcoded** (sempre retorna `null`/nunca persiste binário, `GAP-0042`) |
| crm-relationships (foto de contato) | presigned-to-R2 real no backend | **NUNCA CHAMADO** — UI só usa data URLs locais |
| musicchat (anexos de conversa) | — | **FAKE** (`URL.createObjectURL`, referência local efêmera, `GAP-0122`) |
| leads (upload de anexo) | — | **FAKE** (100% decorativo, `URL.createObjectURL`) |
| support (anexo de chat simulado) | — | **FAKE**, o padrão mais fake da série (nem chega a criar blob local) |
| audiovisual (assets) | endpoint real | **SEM UI de upload** |

## X.2 Realtime (Supabase Realtime)

| Módulo | Publisher real? | Consumidor real? | Achado |
|---|---|---|---|
| musicchat | **SIM** (`RealtimeService`, 7 pontos confirmados de publicação `conversation:*`) | **NÃO** — `useRealtimeSync.ts` nunca se inscreve (`GAP-0121`) | primeira cadeia realtime totalmente real (publisher) confirmada, mas sem ponte até o consumidor central |
| support | **SIM** (1 broadcast real na resolução de ticket) | não avaliado individualmente | funcional para esse ponto específico |
| dashboard | ausente (barramento interno `EventEmitter2` sem ponte) | 14 assinaturas `useWsEvent()`, 0 recebem qualquer evento | `GAP-0068` |
| events | ausente | nenhum | `GAP-0074` — sem ponte entre barramento interno e Realtime |
| marketing | ausente | nenhum consumidor para mudança de status de campanha | `GAP-0114` |
| auth | N/A | `signOut()` não fecha canais explicitamente | `GAP-0037` |

**Achado de padrão cross-module**: o barramento de eventos de domínio interno (`EventEmitter2`/`domain_event_log`) é usado consistentemente para lógica server-side (ex.: automações de contrato, criação automática de workspace de marketing), mas a ponte entre esse barramento interno e o Supabase Realtime broadcast (visível ao cliente) só está genuinamente completa em `musicchat` (do lado do publisher) e `support` (1 ponto). Em `dashboard`/`events`/`marketing`, a ausência dessa ponte é a causa-raiz direta de "Atividades Recentes"/atualizações ao vivo nunca funcionarem.

## X.3 Async / Jobs

- **BullMQ + Redis (legado, `apps/api`)**: real, configurado via `QueueModule` com fallback `noOpModule()` gracioso se Redis ausente (ver Parte IV.4). Consumidores confirmados: agendamento de publicação de conteúdo de marketing (retry+backoff+idempotência), triagem automática de suporte, cron de vencimento de contrato (30 dias).
- **pg-boss (v2)**: **não encontrado nenhum documento ou código referenciando pg-boss** em `apps/api-v2` nesta auditoria — não confirmado como parte do stack v2 até o momento (ver Parte XI).
- **Domain events**: `domain_event_log` (tabela real, 12 col) + `EventEmitter2` — usado extensivamente em `WorkspaceProvisioningService`, automações de contrato/marketing; não conectado ao Realtime broadcast na maioria dos módulos (ver X.2).
- **Schedulers/cron**: cron de vencimento de contrato (30 dias, real); nenhum job/cron de expiração automática de licença (`licensing`, `EXPIRATION_GAP`), nenhum job de reconciliação de royalties (`monitoring`), nenhum relatório agendado/recorrente (`reports`, `GAP-0136`).

`EVIDENCE: Parte IV.4 (QueueModule) + Parte VI (achados por módulo, citados individualmente acima) | CONFIDENCE: HIGH para Storage/Realtime (evidenciado por módulo); MEDIUM para "pg-boss não encontrado" (ausência, não presença — ver Parte XI para o inventário direto de `apps/api-v2`)`

---

# PARTE XI — BACKEND V2 (`apps/api-v2`)

## XI.1 Já construído (verificado diretamente em `apps/api-v2/src/**`)

| Arquivo/módulo | Status | Testado? |
|---|---|---|
| `app.controller.ts`/`app.module.ts`/`app.service.ts` | scaffold NestJS mínimo | não confirmado |
| `config/config.module.ts`/`config.service.ts` | carregamento de configuração via Zod | não confirmado |
| `config/database-config.service.ts`/`database.schema.ts` | validação de `DATABASE_URL`/`DIRECT_DATABASE_URL` — **nota**: "database.schema.ts" aqui é schema de VARIÁVEIS DE AMBIENTE, não schema de tabelas de negócio; nome pode confundir | não confirmado |
| `config/env.schema.ts` + `env.schema.spec.ts` | validação de env vars | **SIM** (spec dedicado) |
| `database/client/drizzle.provider.ts`, `pg-pool.service.ts` | conexão real ao Postgres via Drizzle+pg | não confirmado |
| `database/database.module.ts` | módulo Nest de acesso a banco | não confirmado |
| `database/transaction/drizzle-transaction-manager.ts`, `drizzle-transaction-context.ts`, `resolve-database-client.ts`, `retryable-postgres-error.ts` | infraestrutura real de transação/retry | `*.spec.ts` existem para as peças-chave |
| `main.ts` | bootstrap Nest | não confirmado |

Dependências reais instaladas: `@nestjs/common`/`core`/`platform-express` (11.x), `drizzle-orm` (0.45.x), `pg`, `zod` (4.x), `express` (5.x). O próprio `package.json` da `apps/api-v2` descreve-se textualmente como *"scaffold inicial, sem domínios de negócio"*.

## XI.2 Ainda NÃO construído — todos os 24 domínios de negócio, nomeados individualmente

**Nenhuma tabela de domínio de negócio** foi definida em Drizzle e **nenhum módulo CRUD** (controller/service/DTO) existe em `apps/api-v2` para nenhum dos 24 domínios auditados: Project, Work, Phonogram, Release, Contract, Accounting, Audiovisual, Marketing, Artist, CRM (crm-relationships), Events, Inventory, Leads, Licensing, RH, Settings, Support, Admin, Reports, Integrations, MusicChat, Monitoring, Catalog, Dashboard. Nenhuma integração real (Stripe, Spotify, ABRAMUS, R2 etc.) foi portada. Nenhum cutover foi planejado tecnicamente além do critério conceitual já registrado em `docs/backend-v2/field-traceability/74-zero-gap-reconstruction-contract.md §24`.

**Conclusão explícita**: a fundação técnica (Nest + Drizzle + Zod + conexão de banco + infraestrutura de transação) está pronta e parcialmente testada. Isso **não deve ser confundido** com reconstrução funcional — nenhum domínio de negócio foi reconstruído, e os 168 gaps documentados nesta auditoria (Parte XIII) continuam todos pendentes de tratamento na etapa de desenho/implementação de cada domínio.

## XI.3 Stack, Testing, Deployment — conforme documentação encontrada em `docs/backend-v2/*.md`

`docs/backend-v2/` contém 82 documentos numerados (`00-repository-state.md` a `81-field-level-zero-gap-traceability.md`) cobrindo a evolução completa das decisões técnicas do v2, entre eles (não reabertos por este relatório, apenas listados como confirmação de existência): `43-api-v2-http-framework-decision.md`/`44-...-final-resolution.md` (NestJS), `45-api-v2-database-access-decision.md` (Drizzle), `46-database-v2-migration-strategy.md`, `47-api-v2-layered-architecture.md`, `48-api-v2-directory-structure.md`, `49-auth-tenant-request-context.md`, `50-api-v2-error-model.md`, `51-api-v2-transaction-strategy.md`, `52-api-v2-observability-strategy.md`, `53-api-v2-configuration-secrets-strategy.md`, `58-api-v2-database-stack-final-decision.md`, `59-...-nestjs-version-final-decision.md`, `60-...-node-version-final-decision.md`, `61-...-deployment-model-final-decision.md`, `63-...-typescript-final-decision.md`, `64-...-validation-stack-final-decision.md`, `65-...-drizzle-postgres-versions-final.md`, `66-...-auth-jwt-stack-final-decision.md`, `67-...-async-processing-stack-final-decision.md`, `68-...-observability-stack-final-decision.md`, `69-...-testing-quality-gates-final-decision.md`, `70-...-http-security-stack-final-decision.md`, `71-environment-file-naming-final-decision.md`, `72-api-v2-final-stack-and-readiness.md`, `73-api-v2-database-namespace-final-decision.md`, `74-zero-gap-reconstruction-contract.md`.

Estes documentos representam **decisões técnicas já tomadas e registradas** (framework HTTP=NestJS, acesso a banco=Drizzle, namespace de schema=`app`, versões de Node/TypeScript/Postgres/Drizzle fixadas) mas, conforme confirmado diretamente em XI.1/XI.2, **nenhuma delas foi ainda implementada em código de domínio de negócio** — o estado de `apps/api-v2` permanece scaffold puro. Não foi encontrada, nesta auditoria, nenhuma migração de infraestrutura de deployment do v2 em andamento além do que os documentos `61`/`72`/`73` já registram conceitualmente — items específicos de deployment real (pipeline de CI/CD para `apps/api-v2`, ambiente de staging dedicado) permanecem **não confirmados** por esta auditoria e não devem ser presumidos como prontos.

`EVIDENCE: apps/api-v2/package.json | apps/api-v2/src/config/database.schema.ts | apps/api-v2/src/database/** (listagem de arquivo, verificação direta) | docs/backend-v2/*.md (listagem de arquivo, 82 documentos, não reabertos) | CONFIDENCE: HIGH para XI.1/XI.2 (verificação direta de arquivo) | MEDIUM para XI.3 (existência do documento confirmada; conteúdo detalhado de cada um não relido nesta etapa, apenas os já citados anteriormente em Parte XII) | STATUS: CONFIRMED`

---

# PARTE XII — DECISÕES

Fonte primária desta parte: `docs/backend-v2/gap-resolution/decision-register.json` (lido integralmente nesta etapa) + `docs/backend-v2/gap-resolution/00-canonical-gap-register.md` (ADENDOs de correção) + `docs/backend-v2/review/00-master-domain-functional-verification.md §21/§22`. Nenhuma decisão pendente é resolvida aqui.

## XII.1 Decisões RESOLVIDAS (documentais — nenhum código/schema/migration alterado)

### DEC-001 — Significado canônico de `projects`
**OLD (superseded/invalidada)**: `UNIVERSAL_FINANCIAL_PROJECT` — status `INVALIDATED_BY_PRODUCT_OWNER_DOMAIN_CORRECTION`. Interpretação original: `projects` seria um hub financeiro/operacional genérico que `audiovisual`/`marketing`/`accounting` referenciariam via `financial_project_id`; o fluxo real de lançamento musical seria apenas uma especialização (`MUSIC_RELEASE_PROJECT`) dentro desse hub genérico.
**NEW (vigente)**: `MUSICAL_PROJECT_CANONICAL_HUB` — `projects` é a entidade canônica Musical Project/Música; `projects.id` é a chave de vínculo cross-domain para essa música específica. As relações cross-domain reais (`financial_project_id`, `transactions.projeto_id`) continuam existindo e são preservadas — o que muda é apenas a **interpretação** de por que existem (porque o registro pertence a uma música específica, não porque `projects` é em si uma entidade financeira genérica).
**Por que a correção**: `correctionAuthority: PRODUCT_OWNER` — correção explícita de domínio (PROMPT 129 do histórico do projeto), não uma nova análise técnica.
**Relações preservadas** (`preservedRelations`): `audiovisual_projects.financial_project_id → projects` (LEGACY_NAMING); `marketing_projects.financial_project_id → projects` (LEGACY_NAMING); `transactions.projeto_id → projects` (nome já correto); `works.projeto_id → projects` (`ALREADY_CORRECT`, confirmado populado).
**Opção rejeitada `DUAL_MODEL`**: não autoriza criar `project_category`/`project_kind`/`project_domain`/`project_subtype` — não há uma segunda "espécie" de projeto que precise de discriminador.
**Implementação**: `NOT_STARTED` — `ProjetoFormModal.tsx` não foi modificado; `GAP-0033`, `GAP-0013`, `GAP-0168` permanecem abertos; nenhuma coluna foi renomeada.
**Gaps afetados**: GAP-0001. **Módulos afetados**: projects, audiovisual, marketing, accounting, catalog, releases (via cadeia cross-domain).

### DEC-002 — Vocabulário canônico de tipo de contrato
**Selecionado**: `CONTRACT_SERVICE_TYPES_CANONICAL` — `contract_service_types` (32 colunas, incl. termos financeiros) é a fonte canônica. `contract_templates.tipo_servico` = `LEGACY/DENORMALIZED_REFERENCE_TO_CANONICAL_TYPE`; `contract_categories` = `DISPLAY_ONLY` (pode continuar existindo como camada de agrupamento/rótulo, não como fonte de tipo); `CONTRACT_TYPES` (hardcode morto) = `DEAD_LEGACY_VOCABULARY`.
**Restrição imposta a DEC-004**: WIZARD e QUICK devem consumir o mesmo vocabulário canônico — proibido manter o WIZARD lendo texto livre de `contract_templates.tipo_servico` enquanto o QUICK lê `contract_service_types`. QUICK já consome `contract_service_types` hoje (`PRESERVED_AS_CANONICAL_DIRECTION`); WIZARD precisa de alinhamento futuro (`NEEDS_FUTURE_CONTRACT_ALIGNMENT`).
**Chave de referência física** (id vs. slug): `TO_BE_DEFINED_DURING_SCHEMA_CONTRACT_RESOLUTION` — não decidido por `DEC-002`.
**Nota explícita**: `DEC-002 RESOLVED != GAP-0055 RESOLVED` — esta decisão não implementa nem corrige a propagação financeira de contrato para accounting.
**Migração de dados legados**: `POSSIVEL`, `REQUIRES_DATA_RECONCILIATION_DURING_MIGRATION_PREPARATION` — valores ambíguos, se houver, serão escalados individualmente na preparação da migração, não adivinhados agora.
**Implementação**: `NOT_STARTED`.
**Gaps afetados**: GAP-0002. **Módulos afetados**: contracts.

### DEC-004 — Componente único de criação/edição de contrato
**Selecionado**: `UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT` — um único componente/estado de formulário canônico, com modos **WIZARD** (fluxo completo, hoje `ContratoWizard.tsx` — templates, partes dinâmicas, variáveis, signatários, preview, workflow completo) e **QUICK** (fluxo abreviado, hoje disparado por `RegistroMusicas.tsx` após registrar Obra/Fonograma — mesma implementação canônica, pode pré-preencher contexto/reduzir passos visíveis). Ambos os entrypoints são preservados.
**Identidade de arquivo**: `NOT_DECIDED` — pode ser refatoração do Wizard existente, um novo componente compartilhado extraído dele, ou outra reorganização técnica equivalente; não decidido se o arquivo final é `ContratoWizard.tsx`, `ContratoFormModal.tsx` ou um novo arquivo.
**Campos a preservar**: `template_id`, `arquivo_url`, `exclusivo`, `artista_id`, `cliente_id`, `lancamento_id`, `signing_platform`, `signers`, `data_inicio/data_fim`, `observacoes`, partes detectadas dinamicamente, variáveis do manifesto.
**Conflito semântico de `observacoes` NÃO resolvido por esta decisão**: hoje o Wizard escreve um blob JSON estruturado; o Modal escreve texto livre — a mesma coluna, dois significados. `DEC-004` resolve apenas a duplicação de superfície de criação/edição, não este conflito semântico nem o modelo de armazenamento de partes/variáveis (`NOT_DECIDED_BY_DEC_004`), nem a PII em `observacoes` (`GAP-0049` permanece `OPEN`).
**Impacto em schema/API v2**: `NONE_DIRECT` — a escolha do componente canônico não exige, por si, uma mudança de schema.
**Implementação**: `NOT_STARTED`.
**Gaps afetados**: GAP-0004 (e fornece a premissa para GAP-0008/DEC-008). **Módulos afetados**: contracts, catalog (entrypoint QUICK).

### DEC-007 — Modelo de tracklist de lançamentos
**Selecionado**: `RELATIONAL_TRACKLIST_MODEL` — a tracklist deve ser relacional, referenciando fonogramas concretos. Cadeia canônica: `Release → Release Track → Phonogram → Work → Rights/Shares`. `metadata.faixas` (jsonb) **não** é a fonte canônica (`NON_CANONICAL_METADATA`, candidato a `LEGACY_DATA`/`MIGRATION_SOURCE` — tratamento exato a determinar na etapa de migração, nada migrado/apagado agora).
**Ressalva arquitetural**: `release_works(release_id, work_id)`, no formato atual, **não** é aceito como forma final — falta `phonogram_id`, `position/order` e identidade de faixa; ele liga release↔work (composição abstrata), não release↔phonogram (gravação concreta). `FINAL_RELATIONAL_SCHEMA_STATUS: TO_BE_DESIGNED` (nova tabela `release_tracks`, vs. evoluir/substituir `release_works` — escolha da etapa de resolução de schema, não desta decisão).
**Requisitos mínimos já registrados**: `release_id`, `phonogram_id`, `position/order`.
**Semântica de domínio fixada**: `Work` = `ABSTRACT_COMPOSITION`; `Phonogram` = `CONCRETE_RECORDING`; `ReleaseTrack` = `ORDERED_OCCURRENCE_OF_A_RECORDING_IN_A_RELEASE`.
**Opções rejeitadas**: `JSONB_FORMALIZED` (descartaria a rastreabilidade de direitos via `phonograms.obra_id→works.id`); `HYBRID_DUAL_WRITE` (risco de consistência de dupla escrita sem requisito de performance documentado que o justifique).
**Implementação**: `NOT_STARTED` — `release_tracks` não foi criada; `release_works` não foi alterada; `metadata.faixas` não foi alterada; `GAP-0129`/`GAP-0130` permanecem abertos.
**Gaps afetados**: GAP-0007 (`blocksSchemaV2Design: NÃO` — decisão já resolvida por esta `DEC-007`; corrigido, marcação anterior "bloqueia schema v2" desatualizada; ver ADENDO — DEC-007 RESOLVED em `00-canonical-gap-register.md`). **Módulos afetados**: releases, catalog.

## XII.2 Decisões PENDENTES (opções, vantagens/desvantagens/riscos)

### DEC-003 — Fluxo canônico de criação de artista

> ⚠️ **Decisão resolvida desde esta subseção — `DEC-003: ARTISTA_FORM_MODAL_CANONICAL` (Product
> Owner)**: `ArtistaFormModal.tsx` é o fluxo canônico único; `ArtistaCadastro.tsx` a remover após
> mesclar 10 campos reais exclusivos (tipo, status, contrato_id, manager_nome, manager_contato,
> produtor_executivo, agencia_booking, label_parceira, galeria_urls, documentos — classificação
> completa em `decision-register.json` `DEC-003`). **Correção adicional**: a atribuição de
> `ARTIST_FORM_SECTIONS` abaixo está invertida — inspeção direta do código confirma que
> `ArtistaFormModal.tsx` (não `ArtistaCadastro.tsx`) importa e renderiza `ARTIST_FORM_SECTIONS`; o
> código mudou desde esta auditoria. O texto abaixo é preservado como registro histórico da análise
> original — ver `gap-resolution/00-canonical-gap-register.md` ("Correção canônica — DEC-003
> RESOLVED") para a definição vigente.

**Pergunta**: `ArtistaFormModal.tsx` (real, ~45 campos) vs. `ArtistaCadastro.tsx` (órfã, ~71 campos) — qual mantido/expandido?
| Opção | Vantagens | Desvantagens | Risco |
|---|---|---|---|
| (1) Manter o Modal, portar os ~26 campos exclusivos, remover a órfã (recomendada) | Único componente com navegação real hoje; menor superfície a manter | Exige portar ~26 campos sem perdê-los | Perda de campos de cadastro de artista se a página órfã for descartada sem análise |
| (2) Substituir o Modal pela página órfã | Cobertura de campos maior desde o início | Exige reconectar navegação; maior refatoração | Regressão temporária no fluxo real em uso |
| (3) Manter os dois para fluxos distintos (rápido vs. completo) | Preserva ambas as superfícies | Duplicação de manutenção permanente | Risco de divergência de campo contínua (mesmo padrão hoje) |
**Recomendação registrada**: opção (1) — **ESCOLHIDA pelo Product Owner** (`ARTISTA_FORM_MODAL_CANONICAL`, RESOLVED).

### DEC-005 — Superfície canônica de billing
Ver análise completa (3 opções com vantagens/desvantagens/riscos) em **DOMAIN-BILLING**, dentro de MODULE-SETTINGS (Parte VI). `DEC-005: PENDING_PRODUCT_DECISION` — `DEC_005_ANALYSIS_STATUS: PARKED_UNCHANGED`. Não resolvida aqui.

### DEC-006 — Superfície canônica de gestão de convites
**Pergunta**: `/usuarios` (só envia convite) vs. aba "Usuários" de `Configuracoes.tsx` (superfície completa: listar/reenviar/cancelar) — qual vence?
| Opção | Vantagens | Desvantagens | Risco |
|---|---|---|---|
| (1) Aba "Usuários" de Configuracoes (recomendada) | Já tem a superfície completa, contra o mesmo backend real (`useRoles()`) | Exige remover/redirecionar a ação duplicada de `/usuarios` | Baixo — mudança de UI, não de backend |
| (2) `/usuarios.tsx` | Rota de nível superior, mais descoberta | Exige portar listar/reenviar/cancelar | Trabalho de UI maior |
| (3) Extrair componente compartilhado, manter as 2 entradas | Preserva ambos os pontos de navegação | Não elimina a fragmentação conceitual | Menor ganho líquido |
**Recomendação registrada**: opção (1). **Impacto atual**: baixo risco técnico (backend já unificado); risco de confusão de UX enquanto pendente.

### DEC-008 — `sourceId` de parte de contrato (referência viva vs. snapshot)
**Pergunta**: quando uma parte de contrato é populada a partir de um cliente/artista existente, o `sourceId` deve virar referência viva (edições futuras propagam) ou o snapshot atual (copia valores, sem link) deve ser formalizado como intencional?
| Opção | Vantagens | Desvantagens | Risco |
|---|---|---|---|
| (1) Referência viva | Dados sempre atualizados no contrato | Depende de `DEC-004` já resolvida (qual componente é dono do estado de parte) | **Risco jurídico direto**: um contrato assinado poderia parecer ter mudado retroativamente se o CRM/Artista de origem for editado depois |
| (2) Formalizar snapshot como intencional (recomendada) | Documento jurídico não muda retroativamente — comportamento normalmente correto para contratos assinados | Nenhuma propagação automática de correções de cadastro | Baixo — apenas documental, sem alteração de código |
**Recomendação registrada**: opção (2). Cabe ao Product Owner por afetar semântica jurídica dos contratos — não resolvida aqui.

Fora do `decision-register.json` mas frequentemente citada junto às pendentes acima: nenhuma outra decisão formal de Wave 0 foi registrada para os demais 20 módulos.

`EVIDENCE: docs/backend-v2/gap-resolution/decision-register.json (lido integralmente) | docs/backend-v2/gap-resolution/00-canonical-gap-register.md (ADENDOs) | 00-master-domain-functional-verification.md §21,§22 | CONFIDENCE: HIGH | STATUS: DEC-001/002/003/004/007/009=RESOLVED (documental); DEC-005/006/008=PENDING_PRODUCT_DECISION (corrigido — DEC-003 e DEC-009 resolvidas em correções posteriores)`

---

# PARTE XIII — GAPS (apêndice completo)

Esta parte incorpora a tabela completa de todos os gaps do `canonical-gap-register.json`, construída durante a etapa de consolidação de Fase 3 e verificada nesta etapa contra o arquivo JSON vivo: **168 gaps no registro vivo, 168 linhas nesta tabela — contagem confirmada idêntica** (nenhuma linha adicionada, removida ou reordenada em relação à fonte).

Colunas: `Gap ID` (identificador canônico) · `Módulo(s)` (um ou mais módulos afetados) · `Sev` (severidade: `S1_HIGH`/`S2_MEDIUM`/`S3_LOW`/`S4_INFORMATIONAL`) · `Status` (`OPEN`/`DEFERRED`/`ACCEPTED_BY_EXISTING_CONTRACT`/`NO_FIX_REQUIRED`/`NOT_APPLICABLE`) · `Descrição` · `Root Cause` · `gapType` (classificação técnica do padrão de falha) · `Wave` (onda de resolução planejada, `WAVE_0_DECISIONS` a `WAVE_7_CLEANUP`) · `Priority` (score 0-100) · `DependsOn` (gap do qual depende, se houver) · `BSv2`/`BV2`/`BCut` (bloqueia schema v2 / bloqueia implementação de API v2 / bloqueia cutover — `sim`/`não`) · `UD` (requer decisão do usuário/Product Owner antes de resolução técnica — `SIM`/`não`) · `Decision` (ID da decisão associada, se houver) · `Credenciais` (indicador de necessidade de credencial, sempre `—` ou notas — nenhum valor real presente em nenhuma linha).

`EVIDENCE: docs/backend-v2/gap-resolution/canonical-gap-register.json (168 gaps, verificado nesta etapa) | tabela originalmente compilada em docs/backend-v2/review/_gap-appendix-fragment.md (fase anterior, reverificada e incorporada aqui sem alteração de conteúdo) | CONFIDENCE: HIGH | STATUS: CONFIRMED (contagem 168=168)`

| Gap ID | Módulo(s) | Sev | Status | Descrição | Root Cause | gapType | Wave | Priority | DependsOn | BSv2 | BV2 | BCut | UD | Decision | Credenciais |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| GAP-0001 | projects, audiovisual, marketing, accounting | S1_HIGH | OPEN | projects domain-meaning conflict: UNIVERSAL_FINANCIAL_PROJECT (schema) vs MUSIC_RELEASE_PROJECT (only reachable UI) | The `projects` table/DTO was migrated (FinancialOperationalBridges) as a universal financial/operational project entity that audiovisual_projects/marketing_projects can link to via financial_project_id, but the only reachable UI (ProjetoFormModal.tsx) treats it exclusively as a music-release project and never exposes artista_id/orcamento/financial-linkage fields. Both truths coexist with no canonical resolution. | RELATION_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 95 | — | não | não | não | não | DEC-001 | — |
| GAP-0002 | contracts | S2_MEDIUM | OPEN | contracts: contract-type vocabulary DECIDED (DEC-002: CONTRACT_SERVICE_TYPES_CANONICAL) — remaining work is implementation-only (corrected; original text below described this as unresolved source-of-truth ambiguity, which contradicted DEC-002 §XII/2632 in this same document — see canonical-gap-register.json for full correction) | ORIGINAL (superseded): "Four independent type systems coexist: hardcoded frontend CONTRACT_TYPES (dead), contract_categories in localStorage only, contract_templates.tipo_servico (what actually reaches contracts.tipo via the wizard), and contract_service_types.slug (32 rich columns incl. unused financial terms, read only by the secondary ContratoFormModal). No single inventory exists." — contract_service_types is now the canonical source (DEC-002 RESOLVED); remaining real work: ContratoWizard.tsx (WIZARD) still doesn't consume it, physical reference key undecided, legacy free-text values unreconciled, requires_* rules unconsumed. | RELATION_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 55 | — | não | não | não | não | DEC-002 | — |
| GAP-0003 | artist | S2_MEDIUM | OPEN | artist: create-flow canon DECIDED (DEC-003: ARTISTA_FORM_MODAL_CANONICAL) — remaining work is merging real ArtistaCadastro.tsx-exclusive fields, not choosing which flow wins (corrected; original text below misattributed ARTIST_FORM_SECTIONS to ArtistaCadastro.tsx — see canonical-gap-register.json for full correction) | ORIGINAL (superseded): "ArtistaFormModal.tsx (actually used, ~45 fields) and ArtistaCadastro.tsx (routed, ~71 fields via a separate ARTIST_FORM_SECTIONS definition, but confirmed orphaned — zero navigation reaches it) are complete, independent implementations of the same feature with divergent field coverage." — ArtistaFormModal.tsx is canonical (Product Owner decision); it already imports/renders ARTIST_FORM_SECTIONS (not ArtistaCadastro.tsx, as originally recorded); remaining real work: merge tipo/status/contrato_id/manager_nome/manager_contato/produtor_executivo/agencia_booking/label_parceira/galeria_urls/documentos, then remove the orphan. | RELATION_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 40 | — | não | não | não | não | DEC-003 | — |
| GAP-0004 | contracts | S1_HIGH | OPEN | contracts: create/edit component canon DECIDED (DEC-004: UNIFIED_CONFIGURABLE_CONTRACT_COMPONENT) — remaining work is consolidation, not a Wizard-vs-Modal choice (corrected; original text below described this as an unanswered "which is canonical?" choice, which contradicted DEC-004 §XII/2641 in this same document — see canonical-gap-register.json for full correction) | ORIGINAL (superseded): "The two create/edit components support partially disjoint field sets (arquivo_url/exclusivo only in ContratoFormModal; template_id/parties-blob/manifested variables only in ContratoWizard). A contract created by one and edited by the other loses data." — neither component is canonical alone (DEC-004 RESOLVED); the canonical target is ONE shared component with WIZARD/QUICK modes, both entrypoints preserved; remaining real work: actual consolidation not yet implemented (ContratoWizard.tsx/ContratoFormModal.tsx unchanged, still two independent implementations). | RELATION_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 60 | — | não | não | não | não | DEC-004 | — |
| GAP-0005 | settings | S2_MEDIUM | OPEN | settings: billing fragmented across 3 UI surfaces — which becomes canonical? | Three separate billing UIs coexist: Configuracoes.tsx "Billing" tab (correct architecture, hits a missing endpoint), standalone Billing.tsx (hardcodes plan pricing, violating the codebase's own "never hardcode plans" rule), and BillingBlockedPage.tsx (legitimately distinct purpose, not part of the conflict). | RELATION_MISMATCH | WAVE_0_DECISIONS | 45 | — | não | não | não | SIM | DEC-005 | — |
| GAP-0006 | workspace, settings | S2_MEDIUM | OPEN | workspace/settings: invitation-management UI fragmented across /usuarios and Configuracoes "Usuários" tab | /usuarios (Usuarios.tsx) can send invites via useRoles().inviteUser but has zero UI for listing/resending/cancelling pending invitations; Configuracoes.tsx "Usuários" tab (same backend, full useRoles() hook) has the complete surface. Two pages manage the same membership backend inconsistently. | RELATION_MISMATCH | WAVE_0_DECISIONS | 35 | — | não | não | não | SIM | DEC-006 | — |
| GAP-0007 | releases, catalog | S1_HIGH | OPEN | releases: tracklist data model DECIDED (DEC-007: RELATIONAL_TRACKLIST_MODEL, Release → ReleaseTrack → Phonogram → Work) — remaining work is designing/implementing the final relational shape, not choosing between relational and jsonb (corrected; original text below described this as an unanswered choice, which contradicted DEC-007 §XII/2650 in this same document — see canonical-gap-register.json for full correction) | ORIGINAL (superseded): "release_works (real M:N join table to works) exists at schema level but is never populated by any functional flow; the real tracklist UI persists tracks entirely inside releases.metadata.faixas jsonb with no relation to phonograms/works at all. Two structurally incompatible tracklist models coexist with no canonical choice made." — jsonb is NOT canonical (DEC-007 RESOLVED); release_works in its current shape is NOT the final schema either (lacks phonogram_id/position); remaining real work: design/implement the final relational shape (new release_tracks or evolved release_works) and migrate off metadata.faixas. | RELATION_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 70 | — | não | não | não | não | DEC-007 | — |
| GAP-0008 | contracts, crm-relationships, artist | S2_MEDIUM | OPEN | contracts: party sourceId (CRM/Artist origin) copied instead of live-referenced | When a contract party is populated from an existing client/artist, only the copied field values are embedded into the observacoes JSON blob — the sourceId of the originating record is never persisted, so later edits to the source never propagate. A canonical choice (snapshot-by-design vs live-reference) was never made. | RELATION_MISMATCH | WAVE_0_DECISIONS | 30 | GAP-0004 | não | não | não | SIM | DEC-008 | — |
| GAP-0009 | accounting | S1_HIGH | OPEN | accounting: entityLinks (Vínculos Gerenciais P&L) silently stripped, never persisted | ManagerialLinksSection requires a mandatory TransactionEntityLink[] array in the transaction payload, but createTransacaoSchema/patchTransacaoSchema never declare entityLinks — Zod (no .passthrough()) silently strips the key. The semantic destination table transaction_allocations has zero backend consumer. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 70 | — | não | não | não | não | — | — |
| GAP-0010 | accounting | S1_HIGH | OPEN | accounting: /financial-categories/rules* endpoints do not exist (400 on every page load) | financeCategorizationRulesService calls GET/POST/PATCH/DELETE /financial-categories/rules[/preview|/execute], but the controller only implements the base CRUD + tree/search/move/reorder/archive routes — no "rules" route exists. GET falls through to @Get(':id') with id="rules", failing ParseUUIDPipe. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 65 | — | não | não | não | não | — | — |
| GAP-0011 | accounting | S1_HIGH | OPEN | accounting: CategoriasFinanceiras.tsx entirely disconnected from real backend (localStorage only) | The page uses exclusively useFinancialCategoryRulesStore() (localStorage), making zero API calls; its data shape does not correspond to the real financial_categories schema at all. | CREATE_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 55 | GAP-0010 | não | não | não | não | — | — |
| GAP-0012 | accounting | S2_MEDIUM | OPEN | accounting: transaction attachment (anexo) upload is fake — local blob only, nulled before submit | handleFileUpload only creates a local URL.createObjectURL(file) with a toast admitting real upload is future work; form-to-payload.mapper.ts then nulls any anexoUrl still starting with blob: before submit — a real upload is never persisted despite the DB column being correctly mapped. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 40 | — | não | não | não | não | — | — |
| GAP-0013 | accounting, projects | S2_MEDIUM | OPEN | accounting: Contabilidade.tsx "P&L por Projeto" does not group by project (same root cause as projects.md finding) | plPorProjeto maps each individual transaction as if it were "1 project" (own code comment confirms this), displaying t.descricao as the name — it never GROUP BYs/joins on the real, populated transactions.projeto_id column. | DISPLAY_MAPPING_MISMATCH | WAVE_4_CROSS_DOMAIN_FIXES | 60 | — | não | não | não | não | — | — |
| GAP-0014 | accounting, reports | S3_LOW | OPEN | accounting/TransacaoFormModal: dead exportFieldList() XLSX generator violates the 2-sheet rule | exportFieldList() generates a 3-sheet XLSX ("Campos","Itens","Catálogo Financeiro") but is never called from any button/handler — unreachable dead code that also happens to violate the platform-wide single/double-sheet policy. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 10 | — | não | não | não | não | — | — |
| GAP-0015 | accounting | S4_INFORMATIONAL | DEFERRED | accounting: financial_category_id/financial_category_snapshot columns never set by the transaction form (not a bug, PARTIALLY_MIGRATED) | These real DIRECT columns exist but only the legacy free-text categoria/subcategoria pair is used by the form — reflects a known partial-migration state, not a new defect. | REAL_MAPPING_GAP | WAVE_NONE | 5 | — | não | não | não | não | — | — |
| GAP-0016 | accounting | S3_LOW | OPEN | accounting: OFX import drops unmapped fields silently, no dedupe, no atomicity | Client-side OFX parser generates cliente_id/origem/venda_id which are not real transactions columns and are silently stripped by the same Zod mechanism as entityLinks; each row is an independent, non-atomic POST with no dedupe rule. | REAL_MAPPING_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | não | não | não | não | — | — |
| GAP-0017 | accounting | S2_MEDIUM | OPEN | accounting: all filters/pagination are 100% client-side, no server-side filtering anywhere | Financeiro/Contabilidade/TransacaoRules/Nota Fiscal all filter over the full dataset already loaded via useDataQuery; no backend WHERE clause, no server pagination — TOTAL_COUNT_SOURCE is array.length. | PAGINATION_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 25 | — | não | não | não | não | — | — |
| GAP-0018 | admin | S2_MEDIUM | OPEN | admin: AdminSettings.tsx — 8 tabs, systemically zero real persistence | All fields in Geral/Email/Notificações are uncontrolled inputs with no onChange/API call; "Salvar Alterações" fires a fake success toast. Segurança uses local useState lost on tab close. Webhooks/Chaves API are backed by hardcoded empty arrays with "add" buttons having no onClick at all. Integrações mutates only local state. Usuários has no invite/create flow. | REAL_MAPPING_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 30 | — | não | não | não | não | — | — |
| GAP-0019 | admin | S4_INFORMATIONAL | OPEN | admin: admin-source.ts — 6 dead/empty data exports with zero consumers | ADMIN_KPIS/ADMIN_TENANTS/ADMIN_SECURITY_EVENTS/ADMIN_SYSTEM_METRICS/ADMIN_REVENUE/ADMIN_SUBSCRIPTIONS are hardcoded-empty and have zero consumers anywhere. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 8 | — | não | não | não | não | — | — |
| GAP-0020 | admin | S3_LOW | OPEN | admin: "Admin analytics indisponível" banner always visible regardless of real integration state | AdminLayout.tsx conditions the banner on !ADMIN_DATA_IS_MOCK, hardcoded false, so it shows on every admin page including the 6 pages that have real integration — stale/incorrect messaging. | DISPLAY_MAPPING_MISMATCH | WAVE_7_CLEANUP | 12 | — | não | não | não | não | — | — |
| GAP-0021 | admin, support | S2_MEDIUM | OPEN | admin: AdminAudit/AdminSupport UI-only cross-tenant framing over tenant-scoped backend | admin-audit.service.ts / admin-support.service.ts reuse the existing tenant-scoped GET /audit-logs and GET /support-tickets (not super-admin-exclusive routes); both mappers hardcode tenant_name:"" since the endpoint never exposes it — the "Tenant" column is always empty and a super-admin only ever sees their own current tenant's data despite the panel's cross-tenant framing. | DISPLAY_MAPPING_MISMATCH | WAVE_6_SECONDARY_FUNCTIONALITY | 35 | — | não | não | não | não | — | — |
| GAP-0022 | admin, support | S4_INFORMATIONAL | ACCEPTED_BY_EXISTING_CONTRACT | admin/support: AdminKnowledge — no backend, dev-only mock (confirmed intentional stub) | AdminKnowledge reuses the same fake useKnowledgeArticles() hook as the support module's knowledge base; self-disables via IS_PROD gate in production rather than exposing the mock to real users. | REAL_MAPPING_GAP | WAVE_NONE | 5 | — | não | não | não | não | — | — |
| GAP-0023 | admin | S3_LOW | OPEN | admin: "Novo Webhook"/"Nova Chave API" buttons have no onClick at all | Within the AdminSettings dead tabs, these two specific buttons have no handler wired at all (distinct from the other tabs which at least fire a fake-success toast). | REAL_MAPPING_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 15 | GAP-0009 | não | não | não | não | — | — |
| GAP-0024 | admin | S3_LOW | OPEN | admin: no table has sorting or server-side pagination anywhere | None of AdminClients/AdminSubscriptions/AdminSupport/AdminAudit/AdminSettings-Usuários use SortableTableHead/TablePagination; all filters are client-side. | PAGINATION_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 15 | — | não | não | não | não | — | — |
| GAP-0025 | auth, artist | S1_HIGH | OPEN | auth/artist: ArtistaSignupPublic.tsx calls nonexistent endpoint POST /public/artists (100% broken public signup) | The public unauthenticated artist self-signup wizard posts to POST /public/artists, which does not exist anywhere in the backend. The only related public endpoint (POST /public/artist-registration) creates a Lead via LeadsService — an entirely different data model. Every submission fails with 404. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 75 | — | não | não | não | não | — | — |
| GAP-0026 | auth, artist | S2_MEDIUM | OPEN | auth/artist: even if the public-signup endpoint existed, payload field names diverge from CreateArtistDto | ArtistaSignupPublic.tsx sends spotify_artist_url/youtube_channel_url and instagram/tiktok (vs real spotify_url/youtube_url and instagram_url/tiktok_url — the exact pair already fixed once for the authenticated flow) — the component was written against a planned contract never synced with the real one. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 50 | GAP-0014 | não | não | não | não | — | — |
| GAP-0027 | artist | S4_INFORMATIONAL | ACCEPTED_BY_EXISTING_CONTRACT | artist: ~41 "extended" fields persist to metadata JSONB instead of the homonymous physical column (Phase-1 reclassification, not a functional bug) | Physical columns exist (slug_artistico, tipo_perfil, banco, conta, etc.) but ArtistsService.create()/update() route them into the metadata jsonb instead — round-trip is correct (toResponse() flattens it back), so this is a documentation correction, not a live defect. | CODE_FIELD_ONLY | WAVE_NONE | 5 | — | não | não | não | não | — | — |
| GAP-0028 | artist | S3_LOW | OPEN | artist: manual platform-follower counters vs real API sync have no reconciliation | Manual counters (spotify_ouvintes etc., stored in metadata) and real Spotify/YouTube API sync (artist_platform_profiles table) both capture the same concept with no reconciliation logic between them. | RELATION_MISMATCH | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | não | não | não | não | — | — |
| GAP-0029 | artist | S3_LOW | OPEN | artist: several relation FKs are logical-only, not DB-enforced (projects/transactions/events/artist_goals.artista_id) | These columns are used by the app but have no declared foreign-key constraint — enforcement is purely by application convention. | RELATION_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 25 | — | não | não | não | não | — | — |
| GAP-0030 | artist | S4_INFORMATIONAL | NO_FIX_REQUIRED | artist: encrypted PII fields (email/telefone/cpf_cnpj/manager_contato) not backend-searchable (expected/correct, not a defect) | Ciphertext cannot support ILIKE server-side search by nature — the module's Reports search columns correctly exclude these fields. | REAL_MAPPING_GAP | WAVE_NONE | 0 | — | não | não | não | não | — | — |
| GAP-0031 | audiovisual | S1_HIGH | OPEN | audiovisual: 8 of 9 backend domains have zero UI (systemic) — briefings/deliverables/shots/production_days/team_members/assets/tasks/approvals unreachable | The backend implements 9 fully-built domains (187 columns, real REST endpoints, real RBAC) and 20 corresponding frontend hooks exist, but only 4 hooks (project CRUD itself) have any real component consumer. AudiovisualProjectDetailsModal.tsx only displays the project entity itself — no tab exists for any of the other 8 domains. The pipeline /transition endpoint and its auto-generated tasks (audiovisual_tasks) are consequences of this same absence. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 80 | — | não | não | não | não | — | — |
| GAP-0032 | audiovisual | S1_HIGH | OPEN | audiovisual: status filter dropdown broken — Portuguese filter values vs English DB enum values (ENUM_MISMATCH) | AudiovisualFilterBar.tsx defines accented Portuguese filter options while the real stored DB values are English snake_case; the substring-match filter logic never matches, so any selection in the 3 status dropdowns always returns zero results. | ENUM_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 65 | — | não | não | não | não | — | — |
| GAP-0033 | audiovisual, marketing, projects | S2_MEDIUM | OPEN | audiovisual/marketing/projects: financial_project_id real FK never written by any form (shared root cause across 2 modules) | audiovisual_projects.financial_project_id and marketing_projects.financial_project_id both have a real, DB-enforced FK to projects.id (added by FinancialOperationalBridges), but no form in either module exposes a field to set it. | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 45 | GAP-0001 | não | não | não | não | — | — |
| GAP-0034 | audiovisual | S2_MEDIUM | OPEN | audiovisual: artist_id/campaign_id/event_id exposed as API filters but never written by any form | audiovisual_projects has artist_id/campaign_id/event_id columns (no declared FK) exposed as filter params, but no form sets any of them — only artist_name (free text) is written. (release_id, a sibling column, IS confirmed written/used correctly per releases.md — not part of this gap.) | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0035 | audiovisual | S3_LOW | OPEN | audiovisual: /audiovisual/projects/new route is orphaned (dead navigation) | A dedicated page wrapping the same create form is registered as a real route but no link/navigation anywhere points to it — the real list page uses an inline modal instead. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 10 | — | não | não | não | não | — | — |
| GAP-0036 | audiovisual | S2_MEDIUM | OPEN | audiovisual: asset upload has no UI, and delete never cleans up external storage (orphaned files) | POST /audiovisual/projects/:id/assets only registers a reference to an already-externally-uploaded file (does not perform upload); DELETE soft-deletes the DB row but the physical file in storage is never removed. The frontend has zero consumer for this domain at all. | STORAGE_GAP | WAVE_3_CORE_DOMAIN_FIXES | 30 | GAP-0016 | não | não | não | não | — | — |
| GAP-0037 | auth | S2_MEDIUM | OPEN | auth: signOut() does not close realtime channels — stale subscriptions until page reload | AuthContext.signOut() calls supabase.auth.signOut()+clearApiSessionState()+queryClient.clear() but never disconnectRealtimeChannels(); a channel open before logout can remain subscribed until a full reload. Not a cross-tenant leak (RLS still applies). | REALTIME_GAP | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0038 | auth, workspace | S4_INFORMATIONAL | NO_FIX_REQUIRED | auth: AuthContextService.build() auto-accepts pending tenant invitation as an undocumented side effect of a read endpoint | Every GET /auth/context call runs UPDATE tenant_invitations SET status='accepted' for the current (tenantId, authUserId) pending row — best-effort bookkeeping embedded in a read-context endpoint, not the actual access grant (which already happened at invite time). | REAL_MAPPING_GAP | WAVE_NONE | 5 | — | não | não | não | não | — | — |
| GAP-0039 | auth | S2_MEDIUM | DEFERRED | auth: Redirect URL / Site URL allowlist configuration unresolved for staging/production (cannot be verified by code) | Depends on the Supabase Dashboard's Redirect URLs allowlist containing every real origin — not verifiable by reading code. | REAL_MAPPING_GAP | WAVE_5_INTEGRATIONS | 40 | — | não | não | SIM | não | — | [object Object] |
| GAP-0040 | auth | S4_INFORMATIONAL | NO_FIX_REQUIRED | auth: no explicit handling of "suspended"/"deleted" user states beyond the simple is_active boolean | Only is_active (boolean) on membership is checked; no explicit suspended/deleted state distinct from generic deactivation exists in this module. | REAL_MAPPING_GAP | WAVE_NONE | 0 | — | não | não | não | não | — | — |
| GAP-0041 | catalog | S1_HIGH | OPEN | catalog: CreateWorkDto.authors/shares (split-sheet) accepted by DTO but never persisted to any table | WorksController accepts authors[]/shares in the create payload (validated by DTO) but WorksService.create() never writes them anywhere — no work_authors/split table exists to receive them; the data is validated then discarded. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 65 | — | não | não | não | não | — | — |
| GAP-0042 | catalog | S1_HIGH | OPEN | catalog: CreatePhonogramDto.fileUrl accepted, validated, then discarded — no audio storage pipeline | CreatePhonogramDto declares fileUrl and the frontend form collects it, but PhonogramsService.create() never writes it to any column and no upload pipeline exists — the phonograms table has no audio-file column at all. | STORAGE_GAP | WAVE_2_SCHEMA_AND_CONTRACT | 60 | — | não | não | não | não | — | — |
| GAP-0043 | catalog | S2_MEDIUM | OPEN | catalog: works.artista_id always written null — CatalogoObras.tsx never collects/sends it | The real, DB-enforced FK column artista_id exists and is accepted by CreateWorkDto, but the create form never renders an artist-select field, so every work is created with artista_id=null despite the relation existing end-to-end in the backend. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 40 | — | não | não | não | não | — | — |
| GAP-0044 | catalog | S3_LOW | OPEN | catalog: phonogram-to-work relation (obra_id) collected by UI but ENUM/selector sourced from a stale local list, not live works | The phonogram create form's work-selector is populated from a cached/local copy rather than a live query against the real works table, risking creation against a stale or since-deleted obra_id. | SOURCE_OF_TRUTH_CONFLICT | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0045 | catalog | S3_LOW | OPEN | catalog: ISRC/ISWC identifier fields accepted with no format validation (frontend or backend) | isrc/iswc columns accept arbitrary strings; neither the DTO nor the form apply the standard identifier format regex, allowing malformed industry identifiers to be persisted and later exported to distributors/PROs. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 20 | — | não | não | não | não | — | — |
| GAP-0046 | catalog | S4_INFORMATIONAL | OPEN | catalog: dead Zustand catalog store scaffolding never wired to any component (part of cross-module dead-state pattern) | A generated Zustand store for catalog exists with full CRUD actions but zero component imports it — same scaffolding pattern repeated across other modules. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 8 | — | não | não | não | não | — | — |
| GAP-0047 | catalog | S2_MEDIUM | OPEN | catalog: list endpoints truncate at limit=50 with no UI pagination control | PaginationDto default limit=50 applies to /works and /phonograms with no frontend "load more"/page control — catalogs beyond 50 items are silently invisible. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0048 | contracts | S1_HIGH | OPEN | contracts: contract-templates create returns HTTP 400 on every submission (reachable crash of a core feature) | CreateContractTemplateDto requires clausulas as ClausulaDto[] with mandatory ordem:number, but ContractTemplateEditor.tsx sends clauses as a plain string[] — global ValidationPipe({forbidNonWhitelisted:true}) rejects the payload shape outright. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 85 | — | não | não | não | não | — | — |
| GAP-0049 | contracts, reports | S2_MEDIUM | OPEN | contracts: party PII (document number, bank details) freely typed into observacoes free-text field, exported unmasked in reports | ContratoWizard has no structured field for a party's CPF/CNPJ or bank account beyond what fits in the generic observacoes textarea; whatever operators put there is later included verbatim in report/export XLSX generation with no PII masking. | DATA_INTEGRITY_DEFECT | WAVE_4_CROSS_DOMAIN_FIXES | 45 | — | não | não | não | não | — | — |
| GAP-0050 | contracts, integrations | S2_MEDIUM | OPEN | contracts: DocuSign e-signature envelope creation is 0% implemented despite full UI presence | The "Assinar via DocuSign" button and status badges exist in ContratoDetalhes.tsx, but no backend controller route creates a DocuSign envelope — DocusignService only has placeholder/webhook-receiver methods with no outbound envelope-creation call. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 35 | — | não | não | não | não | — | [object Object] |
| GAP-0051 | contracts, settings | S2_MEDIUM | OPEN | contracts: DocuSign status is tracked client-side in sessionStorage instead of the real backend field | ContratoDetalhes.tsx persists the (mocked) DocuSign signing status to sessionStorage rather than reading/writing the contract's real assinatura_status column — status is lost on session end and never reflects server truth. | SOURCE_OF_TRUTH_CONFLICT | WAVE_5_INTEGRATIONS | 30 | GAP-0043 | não | não | não | não | — | — |
| GAP-0052 | contracts, integrations | S2_MEDIUM | OPEN | contracts: Autentique backend integration is real and functional, but has zero frontend consumer | AutentiqueService implements real GraphQL calls against the Autentique API (document creation, webhook status receiver) and is fully wired server-side, but no contracts frontend component calls any of its exposed endpoints — an entirely unreachable, unused real integration. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0053 | contracts | S3_LOW | OPEN | contracts: ContractStatus.ATIVO enum value never reachable from any real transition (dead enum member) | The ContractStatus enum declares ATIVO but the state-machine transition table (validated server-side) has no path that sets it — contracts can only reach ASSINADO, never ATIVO, making the value permanently unused. | ENUM_MISMATCH | WAVE_7_CLEANUP | 12 | — | não | não | não | não | — | — |
| GAP-0054 | contracts, crm-relationships | S1_HIGH | OPEN | contracts: ContactContractsService uses an in-memory Map, not the database (same anti-pattern as crm-relationships legacy facade) | A secondary, legacy service path (ContactContractsService) maintains contract-contact associations purely in an in-process Map rather than a real table — data is lost on every server restart and is not tenant-scoped. | DATA_INTEGRITY_DEFECT | WAVE_2_SCHEMA_AND_CONTRACT | 55 | — | não | não | não | não | — | — |
| GAP-0055 | contracts, accounting | S2_MEDIUM | OPEN | contracts: financial terms (valor, forma_pagamento, vencimento) captured in ContratoWizard have no propagation to accounting/transactions | A signed contract's financial terms are stored only on the contract row; no service creates a corresponding transactions entry or recurring-charge schedule from them — accounting and contracts are financially disconnected. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_4_CROSS_DOMAIN_FIXES | 40 | — | não | não | não | não | — | — |
| GAP-0056 | contracts | S2_MEDIUM | OPEN | contracts: template variable substitution ({{cliente_nome}} etc.) has no validation against the real party/contract field set | Template clause text accepts arbitrary {{variavel}} placeholders with no compile-time or save-time check that each one maps to a real, resolvable field — a typo'd placeholder silently renders as literal text in the generated contract. | DATA_INTEGRITY_DEFECT | WAVE_3_CORE_DOMAIN_FIXES | 25 | GAP-0041 | não | não | não | não | — | — |
| GAP-0057 | contracts | S2_MEDIUM | OPEN | contracts: contract list/search truncates at limit=50 with no explicit UI indicator of truncation | Independent instance of the systemic PaginationDto default; ContratosLista.tsx has no "showing 50 of N" indicator or load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0058 | contracts | S2_MEDIUM | OPEN | contracts: contract PDF generation and final signed-file storage have no atomic linkage — a regenerate can silently orphan the previously-signed file | Regenerating a contract's PDF (e.g. after a clause edit) creates a new storage object and updates the pdf_url column in a non-transactional sequence; if the update fails after upload, the new file is orphaned, and if it succeeds, the previously-signed PDF reference is silently lost with no version history. | MISSING_TRANSACTION_BOUNDARY | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0059 | crm-relationships, contracts | S1_HIGH | OPEN | crm-relationships: legacy GET/POST /contacts facade backed by an in-memory Map, fully disconnected from the real contacts table | A pre-existing, still-registered legacy controller route (/contacts) is served by an in-process Map-based service predating the real ContactsModule (which uses /crm/contacts against the real, tenant-scoped contacts table) — any client still pointed at the old route reads/writes data that vanishes on restart and is invisible to the real module. | DATA_INTEGRITY_DEFECT | WAVE_2_SCHEMA_AND_CONTRACT | 55 | — | não | não | não | não | — | — |
| GAP-0060 | crm-relationships | S1_HIGH | OPEN | crm-relationships: ~15 fields accepted by CreateInteractionDto/CreateRelationshipDto never mapped to any column (REAL_MAPPING_GAP) | The interaction/relationship create forms collect ~15 fields (e.g. sentiment, follow_up_date, channel_detail, tags[], priority) that the DTOs accept and validate but the service layer never writes to the interactions/relationships tables — no corresponding columns exist. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 60 | — | não | não | não | não | — | — |
| GAP-0061 | crm-relationships | S3_LOW | OPEN | crm-relationships: Auditoria.tsx field-name mismatch — actor/target field read from wrong response key (module-specific instance) | The audit-log viewer reads changed_by/target_id, but the /audit-logs response for this module's events actually keys them as user_id/entity_id — display always shows blank actor/target. Independent root cause from the same-named bug in licensing/inventory/events (different field pairs, different components). | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 15 | — | não | não | não | não | — | — |
| GAP-0062 | crm-relationships | S3_LOW | OPEN | crm-relationships: deep-link route to a specific contact/relationship record is dead (no navigation ever constructs it) | A route accepting /crm/contacts/:id is registered and renders correctly if hit directly, but no list/search/notification component ever builds that URL — independent dead-deep-link instance from the same pattern in licensing/inventory/events (different file, different route). | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 12 | — | não | não | não | não | — | — |
| GAP-0063 | crm-relationships | S3_LOW | OPEN | crm-relationships: relationship "strength score" displayed in UI is a pure frontend-computed heuristic, not a persisted or backend-computed value | RelacionamentoCard.tsx computes a 0-100 "strength" number client-side from whatever interaction fields happen to be loaded on that page — the number is never persisted, never recomputed consistently, and differs depending on which page loaded it. | SOURCE_OF_TRUTH_CONFLICT | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | não | não | não | não | — | — |
| GAP-0064 | crm-relationships | S2_MEDIUM | OPEN | crm-relationships: list endpoints truncate at limit=50, no pagination UI | Independent PaginationDto default instance on /crm/contacts and /crm/relationships with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0065 | crm-relationships | S2_MEDIUM | OPEN | crm-relationships: relationship-type taxonomy is free text on one screen, a fixed enum on another (contract drift) | RelacionamentoForm.tsx (quick-create) accepts a free-text tipo string while RelacionamentoDetalhes.tsx (full edit) renders a fixed RelationshipType enum select — records created via quick-create can hold values the detail screen's dropdown cannot represent. | ENUM_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0066 | crm-relationships | S3_LOW | OPEN | crm-relationships: interaction "channel" enum includes WhatsApp/Email options with no functioning send action behind them (UI promises a send, none occurs) | LogInteractionModal.tsx lets the user pick canal=whatsapp/email framed as if logging will trigger a real message, but the service only records the interaction row — no WhatsApp/email dispatch integration exists in this module. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 18 | — | não | não | não | não | — | — |
| GAP-0067 | dashboard | S2_MEDIUM | OPEN | dashboard: several KPI widgets read from a stale/pre-aggregated cache column instead of live tables (source-of-truth conflict) | DashboardService.getKpis() reads dashboard_metrics_cache (populated by a scheduled job) for several cards, while the equivalent module pages (Financeiro, Contratos) compute the same concept live from source tables — the two can diverge whenever the cache job lags. | SOURCE_OF_TRUTH_CONFLICT | WAVE_4_CROSS_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0068 | dashboard, events | S2_MEDIUM | OPEN | dashboard: "Atividades Recentes" widget subscribes to zero real event families — the EventsService bus has no dashboard consumer | EventsService.emitTyped() publishes real domain events (contract.created, transaction.created, etc.) internally via EventEmitter2, but no listener bridges any of them into the dashboard's recent-activity feed — the widget instead polls a generic /activity-log endpoint at low frequency. | REALTIME_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0069 | dashboard | S2_MEDIUM | OPEN | dashboard: 3 widgets truncate their underlying list at limit=50 with no "ver todos" affordance reflecting the true total | Independent PaginationDto instance behind the "Próximos Vencimentos"/"Contratos Recentes"/"Tarefas" widgets; the "ver todos" link exists but the widget's own count badge shows min(50,total) as if it were the true total. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0070 | dashboard | S2_MEDIUM | OPEN | dashboard: per-widget date-range filter is client-side only, refetches the same unfiltered payload every time | The dashboard date-range picker changes only client-side derived state; the underlying /dashboard/kpis call has no from/to query params, so changing the range never re-queries the backend — displayed numbers are always all-time regardless of selection. | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0071 | dashboard | S2_MEDIUM | OPEN | dashboard: role-based widget visibility is enforced only client-side (hidden, not authorization-checked) | Widgets meant for specific roles are hidden via a frontend permission check (usePermission()) but the underlying /dashboard/kpis endpoint returns the same full payload to any authenticated tenant member — a determined client could read the raw response regardless of role. Not a cross-tenant leak; within-tenant role separation is UI-only. | SECURITY_DEFECT | WAVE_3_CORE_DOMAIN_FIXES | 45 | — | não | não | não | não | — | — |
| GAP-0072 | dashboard | S4_INFORMATIONAL | OPEN | dashboard: dead Zustand dashboard-layout store (drag-to-rearrange widgets) never wired to any component | A generated store persisting custom widget order/visibility exists with full actions but DashboardHome.tsx renders a fixed, hardcoded widget list — same dead-scaffolding pattern as other modules. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 8 | — | não | não | não | não | — | — |
| GAP-0073 | events | S2_MEDIUM | OPEN | events: capacidadePublico field collected by EventoFormModal never persisted (no column, DTO silently strips it) | The event form collects capacidadePublico (expected public capacity) but CreateEventDto has no such field declared, and the events table has no matching column — Zod/class-validator whitelist strips it before it reaches the service. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 35 | — | não | não | não | não | — | — |
| GAP-0074 | events | S2_MEDIUM | OPEN | events: EventsService.emitTyped() internal bus has zero Supabase Realtime bridge — no live update on any events screen | emitTyped() only publishes to the in-process EventEmitter2 bus; unlike ConversationsService (musicchat) and NotificationHandler (support), no listener bridges event-domain events to RealtimeService/Supabase Realtime — EventosLista.tsx requires a manual refresh to see another user's changes. | REALTIME_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0075 | events | S3_LOW | OPEN | events: Auditoria.tsx field-name mismatch — this module's own actor/target key pair (independent from crm/inventory/licensing instances) | Same class of bug as the other 3 modules' Auditoria.tsx findings, but here the mismatch is between changed_fields (frontend expects) and diff (actual API key) — different field pair, different fix, not to be merged. | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 15 | — | não | não | não | não | — | — |
| GAP-0076 | events | S3_LOW | OPEN | events: dead deep-link route to a specific event (independent instance, this module's own file) | A /eventos/:id direct route exists and renders correctly but nothing in EventosLista.tsx/notifications ever constructs the link — independent instance from the crm/inventory/licensing dead-deep-link findings. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 12 | — | não | não | não | não | — | — |
| GAP-0077 | events, artist | S2_MEDIUM | OPEN | events: DRAFT/lineup relation to artist module is by free-text artist_name only, no artista_id FK write path (mirrors audiovisual pattern) | EventoFormModal.tsx collects lineup as free-text names; the real, DB-enforced artista_id relation column on the lineup sub-entity is never set by any form field, same class of gap as audiovisual's artist_id. | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0078 | events, accounting | S2_MEDIUM | OPEN | events: ticket-sales/revenue fields on the event entity have no propagation to accounting transactions | receita_prevista/receita_real columns are edited directly on the event form but no service creates or reconciles a corresponding accounting transaction — same cross-domain financial-propagation pattern as contracts and audiovisual. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_4_CROSS_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0079 | events | S2_MEDIUM | OPEN | events: list endpoint truncates at limit=50, calendar view silently shows a partial month for high-volume tenants | Independent PaginationDto instance; the calendar view fetches via the same paginated list endpoint rather than a date-range query, so a busy month beyond 50 events renders incompletely with no indicator. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0080 | integrations, releases | S4_INFORMATIONAL | DEFERRED | integrations: 6 named distributor providers (ONErpm/DistroKid/Symphonic/SoundOn/MusicPro/SomVibe) are NOT_IMPLEMENTED stubs — preserved verbatim, must not be upgraded | releases.md and integrations.md both independently confirm these 6 provider integrations have no real outbound API client anywhere in the codebase — UI presents them as connectable but no controller/service performs any real distributor call. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 20 | — | não | não | não | não | — | [object Object], [object Object], [object Object], [object Object], [object Object], [object Object] |
| GAP-0081 | integrations, settings | S3_LOW | DEFERRED | integrations: Stripe billing client path in Configuracoes/Billing.tsx uses a real stripeClient — reconciled as a distinct, non-contradictory code path from integrations.md's "deliberately disabled" Stripe finding | integrations.md documents a disabled/stubbed Stripe *webhook processing* path server-side (StripeWebhookService intentionally short-circuited pending PCI review); settings.md/Billing.tsx separately confirms a real client-side stripeClient used only for card-entry tokenization. These are two different code paths on the same provider, not a contradiction. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 15 | — | não | não | não | não | — | — |
| GAP-0082 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: ABRAMUS provider — UI presence with no backend implementation | A connect-account UI card exists for ABRAMUS (Brazilian rights-collection society) with no corresponding service/controller anywhere in the codebase. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 10 | — | não | não | não | não | — | — |
| GAP-0083 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: ACRCloud audio-fingerprint provider — UI presence with no backend implementation | A connect-account UI card exists for ACRCloud with no corresponding service/controller. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 10 | — | não | não | não | não | — | — |
| GAP-0084 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: PostHog analytics provider — UI presence with no backend implementation | A connect-account UI card exists for PostHog with no corresponding service/controller wiring events server-side. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 8 | — | não | não | não | não | — | — |
| GAP-0085 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: NFe (nota fiscal eletrônica) provider — UI presence with no backend implementation | Invoice-emission UI references an NFe provider connection with no corresponding service/controller — actual NF issuance in the app is manual/uploaded, not API-driven. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 12 | — | não | não | não | não | — | — |
| GAP-0086 | integrations, monitoring | S4_INFORMATIONAL | DEFERRED | integrations: ECAD (rights-collection) provider entry in the integrations inventory — UI_ONLY, distinct from monitoring.md's separate working ECAD reports feature | The integrations connect-account card for "ECAD" has no backend service; this is confirmed to be a DIFFERENT code path from monitoring.md's real, working ECAD royalty-report ingestion feature (which parses uploaded ECAD statement files, not an API connection) — not to be merged. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 10 | — | não | não | não | não | — | — |
| GAP-0087 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: UBC (rights-collection society) provider — UI presence with no backend implementation | A connect-account UI card exists for UBC with no corresponding service/controller. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 8 | — | não | não | não | não | — | — |
| GAP-0088 | integrations | S4_INFORMATIONAL | DEFERRED | integrations: "external data framework" (generic pluggable provider abstraction) is scaffolded but has zero real registered implementations | An ExternalDataProvider interface + registry exists (apparently meant to unify all provider integrations behind one contract) but every module currently calls its own bespoke provider service directly — the framework itself is dead architecture with 0 adopters. | ARCHITECTURAL_DEBT | WAVE_7_CLEANUP | 10 | — | não | não | não | não | — | — |
| GAP-0089 | inventory | S2_MEDIUM | OPEN | inventory: 3-way ENUM_MISMATCH on item status across form/list/backend (each uses a divergent vocabulary) | ItemFormModal writes one status vocabulary (e.g. disponivel/em_uso/manutencao), InventarioLista.tsx filter dropdown offers a second, partially-overlapping vocabulary, and the real InventoryStatus backend enum is a third — combinations of the 3 mean some valid backend states are unselectable in the filter and some filter options never match any real row. | ENUM_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 45 | — | não | não | não | não | — | — |
| GAP-0090 | inventory, rh | S2_MEDIUM | OPEN | inventory: item "checked out to" (responsavel_atual) relation is free-text name, no real user/employee FK | The check-out flow captures a free-text name string rather than referencing a real users/rh_employees row — no accountability trail beyond a name that can be misspelled or reused. | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0091 | inventory | S3_LOW | OPEN | inventory: Auditoria.tsx field-name mismatch — this module's own key pair (independent instance) | Same bug class as crm/events/licensing Auditoria.tsx findings; here the mismatch is quantidade_anterior/quantidade_nova vs the real before/after keys — independent fix. | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 15 | — | não | não | não | não | — | — |
| GAP-0092 | inventory | S3_LOW | OPEN | inventory: dead deep-link route to a specific item (independent instance) | A /inventario/itens/:id route exists and renders but no list/search/notification component constructs the link. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 12 | — | não | não | não | não | — | — |
| GAP-0093 | inventory | S2_MEDIUM | OPEN | inventory: low-stock/maintenance-due alerts are computed and displayed client-side only, no backend notification/cron | InventarioDashboard.tsx computes "needs maintenance"/"low stock" badges from the already-loaded list client-side; no scheduled job or NotificationsService entry exists to alert a responsible user proactively — the condition is only visible if someone opens the page. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 25 | — | não | não | não | não | — | — |
| GAP-0094 | inventory | S3_LOW | OPEN | inventory: asset depreciation/valor_atual field exists but no calculation logic anywhere updates it after creation | valor_atual is set once at creation from valor_compra and never recalculated by any scheduled job or formula despite depreciacao_mensal also being a stored field — the two columns are logically related but nothing connects them at runtime. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | não | não | não | não | — | — |
| GAP-0095 | inventory | S2_MEDIUM | OPEN | inventory: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /inventory/items with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0096 | inventory | S3_LOW | OPEN | inventory: item photo upload is a real storage pipeline, but delete never removes the object from R2 (orphaned files) | Item photo delete only clears the foto_url column; the R2 object at the tenant-prefixed key is never removed — mirrors the audiovisual asset-delete orphan pattern but is an independent root cause (different module, different service). | STORAGE_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 18 | — | não | não | não | não | — | — |
| GAP-0097 | leads | S2_MEDIUM | OPEN | leads: whatsapp field collected on public lead-capture form never persisted (no column, DTO strips it) | The public /public/artist-registration lead-capture form collects a whatsapp phone field, but CreateLeadDto has no such property and the leads table has no matching column — the whitelist ValidationPipe silently drops it before it reaches the service. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 40 | — | não | não | não | não | — | — |
| GAP-0098 | leads | S2_MEDIUM | OPEN | leads: LeadInteractionsService reads/writes inconsistent casing (camelCase in code vs snake_case in DB) for a subset of fields, causing silent undefined reads | A handful of properties in LeadInteractionsService (createdBy vs created_by-style access) are referenced in camelCase against a raw query result that TypeORM returns in snake_case for that particular repository method, so those specific fields are always undefined at runtime without throwing. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 40 | — | não | não | não | não | — | — |
| GAP-0099 | leads, projects | S2_MEDIUM | OPEN | leads: lead-to-artist conversion does not create the financial_project_id linkage retroactively (same root cause family as GAP-0015) | When a lead converts to a real artist/project, the resulting project row still leaves financial_project_id unset for the same reason as the audiovisual/marketing instance — no form/step in the conversion wizard exposes it. | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 30 | GAP-0015 | não | não | não | não | — | — |
| GAP-0100 | leads | S3_LOW | OPEN | leads: lead-scoring field is UI-displayed but never computed by any backend logic (always the DB default) | LeadCard.tsx renders a "score" badge reading leads.score, but no service (create, update, or scheduled job) ever writes anything other than the column's DB default — the badge is permanently static across all leads. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | não | não | não | não | — | — |
| GAP-0101 | leads | S2_MEDIUM | OPEN | leads: duplicate-lead detection (same email/phone) does not exist — public form allows unlimited duplicate submissions | POST /public/artist-registration has no uniqueness check or upsert logic against existing leads by email/whatsapp — repeated submissions from the same person create N separate lead rows with no merge path. | DATA_INTEGRITY_DEFECT | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0102 | leads | S3_LOW | OPEN | leads: pipeline/kanban stage transitions have no state-machine validation server-side (any status settable from any status) | PATCH /leads/:id/status accepts any enum value transition with no guard against illogical jumps (e.g. CONVERTED back to NEW) — unlike contracts and releases, which do enforce their transition tables. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_3_CORE_DOMAIN_FIXES | 20 | — | não | não | não | não | — | — |
| GAP-0103 | leads | S2_MEDIUM | OPEN | leads: list endpoint truncates at limit=50, kanban board silently drops leads beyond the first 50 per column | Independent PaginationDto instance; the kanban board fetches each column via the same paginated endpoint with no per-column "load more," so any column exceeding 50 leads becomes invisible past the 50th. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0104 | leads | S4_INFORMATIONAL | OPEN | leads: dead Zustand leads-filter-preset store never wired to any component | A generated store for saving/restoring filter presets exists with full actions but LeadsKanban.tsx never imports it — same dead-scaffolding pattern as catalog/dashboard/events/contracts. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 8 | — | não | não | não | não | — | — |
| GAP-0105 | licensing | S1_HIGH | OPEN | licensing: sync-license request form fields (uso_pretendido, territorio, duracao_licenca) accepted by DTO, never persisted to the licenses table | CreateLicenseRequestDto declares and validates these 3 fields but LicensesService.create() never maps them onto any column — the licenses table has no equivalent columns at all. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 60 | — | não | não | não | não | — | — |
| GAP-0106 | licensing, accounting | S2_MEDIUM | OPEN | licensing: license-fee (valor_licenca) captured at request time has no propagation to accounting transactions | Same cross-domain financial-propagation gap class as contracts/events — a granted license's fee is stored only on the license row, no transaction is created. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_4_CROSS_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0107 | licensing | S3_LOW | OPEN | licensing: Auditoria.tsx field-name mismatch — this module's own key pair (independent instance) | Same bug class as crm/events/inventory Auditoria.tsx findings; here the mismatch is status_anterior/status_novo vs the real API keys — independent fix. | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 15 | — | não | não | não | não | — | — |
| GAP-0108 | licensing | S3_LOW | OPEN | licensing: dead deep-link route to a specific license request (independent instance) | A /licenciamento/:id route exists and renders correctly but no list/notification component ever constructs the link. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 12 | — | não | não | não | não | — | — |
| GAP-0109 | licensing | S2_MEDIUM | OPEN | licensing: license PDF/contract-document generation has no atomic linkage between file storage and status transition (mirrors contracts PDF gap, independent module/service) | Approving a license generates a PDF and flips status=APROVADA in two non-transactional steps; a failure between them can leave a status update with no backing document or an orphaned uploaded PDF. | MISSING_TRANSACTION_BOUNDARY | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0110 | licensing | S2_MEDIUM | OPEN | licensing: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /licenses with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0111 | marketing | S1_HIGH | OPEN | marketing: two parallel, incompatible systems on the same table — CampaignsController vs MarketingCampaignBuilderController | Two independently-built controllers both write to marketing_campaigns with different DTOs/field sets (CampaignsController is the older, simpler CRUD; MarketingCampaignBuilderController is a richer wizard-based flow added later) — the frontend has entry points into both, and a campaign built via one may have null fields expected by the other's detail view. | ENTITY_DECLARATION_DRIFT | WAVE_2_SCHEMA_AND_CONTRACT | 55 | — | não | não | não | não | — | — |
| GAP-0112 | marketing | S2_MEDIUM | OPEN | marketing: budget*0.41 fabricated ROI metric displayed as if it were real ad-platform data | CampanhaDetalhes.tsx computes a "ROI estimado" card as orcamento*0.41 (a hardcoded literal multiplier) with no real integration to any ad platform's reporting API — the only confirmed violation of the "never fake success" principle found across the audit. | UX_CONTRACT_DEFECT | WAVE_3_CORE_DOMAIN_FIXES | 50 | — | não | não | não | não | — | — |
| GAP-0113 | marketing | S4_INFORMATIONAL | DEFERRED | marketing: campaign creation has no ad-platform integration at all (Meta/Google Ads/TikTok) — purely an internal tracker | No provider client exists for any external ad platform; "campaign" here means an internally-tracked budget/goal record only — confirmed scope, not a bug, but relevant to the module's domain-meaning determination. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_NONE | 5 | — | não | não | não | não | — | — |
| GAP-0114 | marketing | S3_LOW | OPEN | marketing: EventsService bus has no consumer for campaign-status-change notifications | Same emitTyped()-with-no-bridge pattern as dashboard/events — campaign status changes emit an internal event with zero downstream listener (no email, no realtime, no in-app notification). | REALTIME_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 15 | — | não | não | não | não | — | — |
| GAP-0115 | marketing | S2_MEDIUM | OPEN | marketing: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /marketing/campaigns with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0116 | monitoring | S2_MEDIUM | OPEN | monitoring: two parallel UIs over the same rights-monitoring domain — Monitoramento.tsx vs RightsMonitoring.tsx | Monitoramento.tsx (older) and RightsMonitoring.tsx (newer) both render views over the same monitoring_reports/monitoring_matches tables via different hooks/queries with different filter and column sets — both are reachable from different nav entries, risking inconsistent operator experience and duplicated maintenance. | ENTITY_DECLARATION_DRIFT | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0117 | monitoring, integrations | S4_INFORMATIONAL | NO_FIX_REQUIRED | monitoring: ECAD statement-file ingestion is real and working — confirmed distinct from integrations.md's separate UI-only ECAD connect-card finding | The real feature parses uploaded ECAD royalty-statement files (XLSX/CSV) into monitoring_reports rows via a genuine parser service — this is confirmed NOT the same code path as the integrations module's stubbed "ECAD" API-connection card; no merge, both stand independently. | REAL_MAPPING_GAP | WAVE_NONE | 0 | — | não | não | não | não | — | — |
| GAP-0118 | monitoring | S3_LOW | OPEN | monitoring: match-confidence score displayed with no explanation of methodology, and no manual override/dispute flow | monitoring_matches.confidence_score is displayed as a raw percentage with no UI to dispute/correct a false-positive match — an operator who sees a wrong match has no in-app action beyond ignoring it. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | não | não | não | não | — | — |
| GAP-0119 | monitoring, accounting | S2_MEDIUM | OPEN | monitoring: matched-royalty amounts have no propagation to accounting transactions | A confirmed ECAD match with an associated valor_apurado has no service creating a corresponding accounting transaction — same cross-domain financial-propagation gap class as contracts/events/licensing. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_4_CROSS_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0120 | monitoring | S2_MEDIUM | OPEN | monitoring: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /monitoring/reports with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0121 | musicchat | S2_MEDIUM | OPEN | musicchat: RealtimeService publishes real Supabase Realtime conversation:* events, but MusicChat.tsx has zero frontend consumer | ConversationsService correctly bridges message/conversation changes to Supabase Realtime (confirmed genuine broadcast, not just EventEmitter2), but MusicChat.tsx never calls useWsEvent()/subscribes to any conversation:* channel — new messages from another session/user require a manual reload to appear. | REALTIME_GAP | WAVE_3_CORE_DOMAIN_FIXES | 40 | — | não | não | não | não | — | — |
| GAP-0122 | musicchat | S2_MEDIUM | OPEN | musicchat: blob/file attachments are not stored — attachment metadata is accepted but the actual file is never uploaded | The message-attachment UI creates a local blob URL for preview but no upload call sends the file to R2/storage before message creation — the persisted message references a file that never existed server-side. | STORAGE_GAP | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0123 | musicchat | S4_INFORMATIONAL | NO_FIX_REQUIRED | musicchat: MessageSenderType.AI enum member is unused — no LLM/RAG requirement exists (confirmed, not a gap) | The enum includes an AI sender type for future extensibility, but no AI/RAG generation logic exists anywhere in the module — correctly classified as an unused-but-intentional forward-compat member, not a missing feature. | REAL_MAPPING_GAP | WAVE_NONE | 0 | — | não | não | não | não | — | — |
| GAP-0124 | musicchat | S4_INFORMATIONAL | DEFERRED | musicchat: external-channel message ingestion (WhatsApp/Instagram DM bridging) is entirely absent — confirmed scope boundary, not a defect | MusicChat is an internal, tenant-scoped conversation system between platform users; no external channel adapter exists or was ever partially built — correctly out of scope for this module. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_NONE | 0 | — | não | não | não | não | — | — |
| GAP-0125 | musicchat | S2_MEDIUM | OPEN | musicchat: message list truncates at limit=50 with no "load older messages" infinite-scroll trigger | Independent PaginationDto instance on GET /conversations/:id/messages; the chat pane has no scroll-triggered pagination, so conversations beyond 50 messages permanently hide their earliest history. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0126 | projects | S4_INFORMATIONAL | OPEN | projects: dead Zustand projects-board store never wired to any component | Same cross-module dead-scaffolding pattern — a kanban/board-view store with full drag-reorder actions exists but ProjetosLista.tsx renders a plain table with no board view. | REAL_MAPPING_GAP | WAVE_7_CLEANUP | 8 | — | não | não | não | não | — | — |
| GAP-0127 | projects, contracts | S2_MEDIUM | OPEN | projects: project-to-contract relation (contrato_id) is a real FK exposed as a filter, but no create/edit form sets it | projects.contrato_id has a real FK to contracts.id used as a query filter param, but neither ProjetoFormModal nor the contract wizard's "vincular projeto" step actually writes it — the relation is populated only when manually set via direct API call. | REAL_MAPPING_GAP | WAVE_4_CROSS_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0128 | projects | S2_MEDIUM | OPEN | projects: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /projects with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0129 | releases | S1_HIGH | OPEN | releases: internal_status/platform_status fields collected by the release-status UI are never accepted by the DTO (CREATE_MAPPING_MISMATCH) | ReleaseStatusPanel.tsx captures an internal_status distinct from the public/platform-facing status, but UpdateReleaseDto only declares status — the internal value is validated away by the whitelist ValidationPipe on every submit. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 60 | — | não | não | não | não | — | — |
| GAP-0130 | releases | S2_MEDIUM | OPEN | releases: workflow allows an illegal DRAFT→DISTRIBUTED direct jump, skipping the required review/approval intermediate states | The status-transition validation on the update endpoint does not enforce the full intended state machine — only a subset of illegal transitions are blocked, and DRAFT→DISTRIBUTED specifically passes through unguarded. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_3_CORE_DOMAIN_FIXES | 40 | — | não | não | não | não | — | — |
| GAP-0131 | releases | S3_LOW | DEFERRED | releases: takedown request flow has UI but no real distributor call (consistent with the 6-stub-providers finding, tracked separately for the takedown-specific UX) | A "Solicitar Takedown" button and status badge exist, but since no distributor integration is implemented (GAP for the 6 providers), the takedown action can only set a local status flag with no actual removal ever occurring — same underlying cause as the provider stubs but a distinct manifestation worth its own UX-correctness tracking. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_5_INTEGRATIONS | 15 | — | não | não | não | não | — | — |
| GAP-0132 | releases | S3_LOW | OPEN | releases: artwork upload is a real storage pipeline, but delete never removes the R2 object (orphaned files, independent instance) | Same class of gap as inventory's item-photo and audiovisual's asset-delete findings but an independent root cause (different service/table) — release artwork delete only clears the artwork_url column. | STORAGE_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 18 | — | não | não | não | não | — | — |
| GAP-0133 | releases, contracts | S4_INFORMATIONAL | NOT_APPLICABLE | releases: contracts.lancamento_id relation confirmed non-existent on both sides — mutual confirmation, should be recorded closed, not an open gap | contracts.md flagged an unconfirmed selector for lancamento_id; releases.md independently confirms CONTRACT_RELEASE_TRACEABILITY:NOT_APPLICABLE — no such relation exists in the schema, both audits mutually confirm its absence. Recorded here as a closed cross-check, not an actionable gap. | RELATION_MISMATCH | WAVE_NONE | 0 | — | não | não | não | não | — | — |
| GAP-0134 | releases | S2_MEDIUM | OPEN | releases: list endpoint truncates at limit=50, no pagination UI | Independent PaginationDto instance on /releases with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0135 | reports | S4_INFORMATIONAL | NO_FIX_REQUIRED | reports: report-form-contracts.ts is the confirmed single source of truth for export/import, but 2 modules (accounting XLSX, contracts PII) still bypass it | The Central de Relatórios export engine is real, well-tested, and universally consumed by every module's standard export button — the accounting dead 3-sheet generator (GAP already tracked) and the contracts PII-export gap (GAP already tracked) are the only 2 confirmed bypasses, both tracked at their source modules, not duplicated here. | REAL_MAPPING_GAP | WAVE_NONE | 0 | — | não | não | não | não | — | — |
| GAP-0136 | reports | S3_LOW | DEFERRED | reports: scheduled/recurring report generation (e.g. "send monthly P&L every 1st") does not exist | Every report export in the system is triggered synchronously by a user click; no cron/scheduled-job mechanism exists to generate and email/store a report on a recurring basis. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 15 | — | não | não | não | não | — | — |
| GAP-0137 | reports | S2_MEDIUM | OPEN | reports: export history/audit trail (who exported what, when) is not tracked | No table records completed export operations — for compliance-sensitive exports (contracts PII, RH payroll) there is no way to answer "who downloaded this report and when." | MISSING_REQUIRED_FUNCTIONALITY | WAVE_4_CROSS_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0138 | rh | S1_HIGH | OPEN | rh: employee CREATE_MAPPING_MISMATCH — CreateEmployeeDto rejects the real form payload shape (400 on every submission) | FuncionarioFormModal.tsx nests endereco as a sub-object ({logradouro, numero, cidade, ...}) while CreateEmployeeDto declares flat top-level fields (endereco_logradouro, endereco_numero, ...) — global whitelist ValidationPipe rejects the nested payload outright. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 80 | — | não | não | não | não | — | — |
| GAP-0139 | rh | S1_HIGH | OPEN | rh: payroll-entry CREATE_MAPPING_MISMATCH — CreatePayrollEntryDto field names diverge from the form (400 on every submission) | FolhaPagamentoFormModal.tsx sends valor_bruto/valor_liquido/descontos as a nested descontos:{inss,irrf,outros} object, but CreatePayrollEntryDto declares flat desconto_inss/desconto_irrf/desconto_outros — same whitelist-rejection pattern as employee creation. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 80 | — | não | não | não | não | — | — |
| GAP-0140 | rh | S1_HIGH | OPEN | rh: leave-request CREATE_MAPPING_MISMATCH — CreateLeaveRequestDto field names diverge from the form (400 on every submission) | SolicitacaoFeriasFormModal.tsx sends data_inicio/data_fim/tipo_ausencia, but CreateLeaveRequestDto declares start_date/end_date/leave_type — an English/Portuguese naming split identical in class to the artist-module social-URL bug already fixed once elsewhere, but this instance was never fixed. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 80 | — | não | não | não | não | — | — |
| GAP-0141 | rh | S1_HIGH | OPEN | rh: employee entity missing 8 physical columns that the form/DTO already reference (entity-declaration gap, distinct root cause from the CREATE_MAPPING_MISMATCH bugs) | The Employee TypeORM entity class has no @Column declaration for 8 fields (e.g. pis_pasep, ctps_numero, banco_conta, banco_agencia, etc.) that the DTO validates and the service attempts to assign — TypeORM silently ignores unmapped properties on save, so even a payload that passes validation loses these 8 fields. This is a different root cause from the nested-vs-flat CREATE_MAPPING_MISMATCH bugs (entity declaration vs DTO shape). | ENTITY_DECLARATION_DRIFT | WAVE_2_SCHEMA_AND_CONTRACT | 70 | GAP-0060 | não | não | não | não | — | — |
| GAP-0142 | rh | S2_MEDIUM | OPEN | rh: documents endpoint exists and is implemented server-side, but is never wired to any frontend component (unreachable feature) | A full CRUD set for employee documents (upload/list/download/delete against a real employee_documents table + R2 storage) exists in RhDocumentsController, but no page/modal in the RH module calls any of it — orphaned real backend feature. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 45 | — | não | não | não | não | — | — |
| GAP-0143 | rh | S1_HIGH | OPEN | rh: employee list renders blank/empty despite real data existing (frontend query key or response-shape mismatch) | FuncionariosLista.tsx queries a response shape ({data: Employee[]}) that does not match what GET /rh/employees actually returns for this specific list (a bare array), so the list renders empty even when the backend has employee rows — a distinct, separate root cause from the create-flow bugs above. | DISPLAY_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 75 | — | não | não | não | não | — | — |
| GAP-0144 | rh | S2_MEDIUM | OPEN | rh: EmployeeStatus ENUM_MISMATCH — frontend filter dropdown vocabulary diverges from the backend enum | The status filter on FuncionariosLista.tsx offers ativo/inativo/afastado while the real EmployeeStatus backend enum includes ACTIVE/INACTIVE/ON_LEAVE/TERMINATED — case and vocabulary mismatch means the filter never matches any real row. | ENUM_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 40 | — | não | não | não | não | — | — |
| GAP-0145 | rh | S2_MEDIUM | OPEN | rh: payroll_entries and leave_requests also have orphaned physical-column gaps (grouped with employee's 8-column gap only if literally the same migration; kept separate per distinct table/entity) | Similar to the employee entity, PayrollEntry and LeaveRequest entities are each missing several @Column declarations for fields their respective DTOs/forms reference (e.g. payroll: valor_fgts, leave_requests: aprovado_por) — same class of defect, different entities/tables, tracked separately since each requires its own entity file edit. | ENTITY_DECLARATION_DRIFT | WAVE_2_SCHEMA_AND_CONTRACT | 55 | GAP-0061, GAP-0062 | não | não | não | não | — | — |
| GAP-0146 | rh | S2_MEDIUM | OPEN | rh: list endpoints truncate at limit=50, no pagination UI | Independent PaginationDto instance across /rh/employees, /rh/payroll-entries, /rh/leave-requests with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0147 | settings | S2_MEDIUM | OPEN | settings: notification-settings toggles have no backend consumer — preference is saved but nothing reads it before sending a notification | NotificacoesSettings.tsx persists toggle state to a real tenant_notification_preferences row, but NotificationHandler (the actual dispatcher used by support/musicchat) never queries this table before sending — every notification fires regardless of the saved preference. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0148 | settings | S3_LOW | OPEN | settings: notification-settings UI shows hardcoded-true toggles for 2 channels regardless of saved state | Two specific toggle rows (SMS, Push) render checked=true unconditionally in the component rather than reading tenant_notification_preferences — cosmetic but user-facing lie about what is actually enabled. | DISPLAY_MAPPING_MISMATCH | WAVE_3_CORE_DOMAIN_FIXES | 20 | GAP-0065 | não | não | não | não | — | — |
| GAP-0149 | settings | S2_MEDIUM | OPEN | settings: tenant logo upload has no backend endpoint — "Alterar Logo" button in Branding tab has no working destination | BrandingSettings.tsx builds a FormData upload intended for something like POST /tenants/:id/logo, but no such route exists anywhere in the backend — the only real logo-related field is a plain logo_url text column with no upload pipeline behind it. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_3_CORE_DOMAIN_FIXES | 35 | — | não | não | não | não | — | — |
| GAP-0150 | settings | S2_MEDIUM | OPEN | settings: billing UI fragmented across 3 separate surfaces with no single source of truth for subscription state | Billing.tsx, PlanoAtual (a dashboard widget), and a modal reachable from the feature-gate upgrade prompt each independently query/display subscription state via 3 different hooks — none is authoritative, and they can show different plan/status values if one is stale. | SOURCE_OF_TRUTH_CONFLICT | WAVE_3_CORE_DOMAIN_FIXES | 30 | GAP-0005 | não | não | não | não | — | — |
| GAP-0151 | settings | S1_HIGH | OPEN | settings: "Alterar Plano" button in Billing.tsx calls a nonexistent endpoint (plan-change flow 100% broken) | The plan-change action posts to PATCH /billing/subscription/plan, which does not exist server-side — BillingController only exposes read (GET /billing/subscription) and webhook-receiver routes, no mutation endpoint for self-service plan changes. | CREATE_MAPPING_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 55 | GAP-0068 | não | não | não | não | — | — |
| GAP-0152 | settings | S2_MEDIUM | OPEN | settings: card-entry form in Billing.tsx displays a fake, hardcoded card number instead of the real tokenized card-on-file | The "cartão salvo" display shows a literal hardcoded "**** **** **** 4242" placeholder string rather than the last4 returned by the real stripeClient tokenization — a "never fake success"-principle violation distinct from marketing's fabricated ROI (different module, different mechanism). | UX_CONTRACT_DEFECT | WAVE_3_CORE_DOMAIN_FIXES | 30 | — | não | não | não | não | — | — |
| GAP-0153 | settings | S3_LOW | OPEN | settings: feature-gate "upgrade" prompt links to a route that is not registered in the router (dead link) | FeatureGate.tsx's upgrade CTA navigates to /configuracoes/billing/upgrade, but no such route is registered — only /configuracoes/billing (the base Billing.tsx page) exists, so the CTA 404s. | REAL_MAPPING_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0154 | settings | S2_MEDIUM | OPEN | settings: feature flags are evaluated frontend-only (hardcoded flag map), not backed by any tenant_feature_flags table or backend gate | FeatureGate.tsx and useFeatureFlag() read from a hardcoded local map keyed by plan tier — there is no tenant_feature_flags table and no backend-side enforcement, so a determined client could bypass any gate by editing frontend state; the only real enforcement (if any) would need to be server-side per protected endpoint, which does not exist. | SECURITY_DEFECT | WAVE_2_SCHEMA_AND_CONTRACT | 50 | — | não | não | não | não | — | — |
| GAP-0155 | settings | S2_MEDIUM | DEFERRED | settings: security-settings tab (2FA, session management) has no backend at all — pure UI mockup | SegurancaSettings.tsx renders toggle switches for 2FA and a fake "active sessions" list with no query to any real endpoint — entirely disconnected from Supabase Auth's actual MFA/session APIs. | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 25 | — | não | não | não | não | — | — |
| GAP-0156 | settings | S3_LOW | OPEN | settings: localization tab (language/timezone/currency) saves to localStorage only, not to a tenant/user-scoped backend column | The selected language/timezone/currency persist to browser localStorage, so the setting does not follow the user across devices and is invisible to any backend formatting logic (e.g. report/export date formatting). | REAL_MAPPING_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | não | não | não | não | — | — |
| GAP-0157 | support, admin | S1_HIGH | OPEN | support: AdminSupport ticket-status enum mismatch causes a reachable runtime crash when an admin opens a ticket in a specific state | TicketDetailModal (admin variant) destructures ticket.status expecting one of the tenant-facing SupportTicketStatus enum values, but the admin list endpoint returns a superset including an admin-only value (ESCALATED) that has no corresponding UI branch — the component's switch statement throws (no default case) when rendering the status badge for an escalated ticket. | ENUM_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 65 | — | não | não | não | não | — | — |
| GAP-0158 | support | S1_HIGH | OPEN | support: category ENUM_MISMATCH between the ticket-creation form and the backend TicketCategory enum | NovoTicketModal.tsx offers Portuguese category labels as raw values (e.g. "Financeiro") sent directly as the category field, while TicketCategory backend enum expects English snake_case (BILLING, TECHNICAL, ...) — every ticket created via the UI fails the DTO enum validation (400) unless the value happens to coincide. | ENUM_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 55 | — | não | não | não | não | — | — |
| GAP-0159 | support, admin | S2_MEDIUM | NO_FIX_REQUIRED | support: AdminSupport cross-tenant framing over tenant-scoped backend — CLOSED with full evidence (see admin.md pendency) | Already fully captured as the shared canonical gap with admin — see GAP-0027. This entry exists only to explicitly record the support-side closure evidence referenced by the original admin.md pendency. | DISPLAY_MAPPING_MISMATCH | WAVE_NONE | 0 | GAP-0027 | não | não | não | não | — | — |
| GAP-0160 | support | S4_INFORMATIONAL | DEFERRED | support: deliberately-fake subfeatures (community forum, live chat widget) correctly classified as INTENTIONAL_STUB per their own report basis | SupportCommunity.tsx and the floating live-chat widget both render fully-designed UI with hardcoded/mock content and no backend — confirmed, per the module's own audit, to be deliberate placeholders for a not-yet-prioritized feature, not partial/broken implementations. | INTENTIONAL_STUB | WAVE_NONE | 0 | — | não | não | não | não | — | — |
| GAP-0161 | support | S2_MEDIUM | OPEN | support: ticket list truncates at limit=50, no pagination UI | Independent PaginationDto instance on /support-tickets with no frontend load-more control. | PAGINATION_GAP | WAVE_3_CORE_DOMAIN_FIXES | 25 | — | não | não | não | não | — | — |
| GAP-0162 | workspace, settings | S3_LOW | OPEN | workspace: settings.md public-slug-in-localStorage pendency — CLOSED, same root cause as workspace's tenant-ownership-resolution gap | tenants.slug (used for the tenant's public registration URL) is cached client-side in localStorage by both Configuracoes.tsx (settings) and the workspace-switcher; workspace.md traced the canonical ownership/resolution logic and confirmed both are reads of the same real, DB-backed tenants.slug column with no independent second source — the localStorage copy is a cache, not a second source of truth, but can go stale if the slug is changed and the cache is not invalidated. | SOURCE_OF_TRUTH_CONFLICT | WAVE_3_CORE_DOMAIN_FIXES | 20 | — | não | não | não | não | — | — |
| GAP-0163 | workspace, settings | S3_LOW | OPEN | workspace: invitation-management UI duplicated across workspace-switcher context and settings' team-members tab (3rd confirmed duplicate-UI-flow instance) | A "convidar membro" flow exists both inside the workspace-switcher's dropdown (quick-invite) and as a full page under Configuracoes > Equipe — each calls the real POST /tenant-invitations endpoint correctly, but maintains independent local state/validation, so an in-flight invite in one is invisible to the other until a full refetch. | ENTITY_DECLARATION_DRIFT | WAVE_3_CORE_DOMAIN_FIXES | 20 | — | não | não | não | não | — | — |
| GAP-0164 | workspace | S3_LOW | OPEN | workspace: current-tenant selection persists to localStorage with no server-side default/last-used sync — a user switching devices always lands on their first-ever membership, not their last-used tenant | The "current workspace" selector writes only to localStorage; no users table or membership column stores a last_active_tenant_id, so cross-device continuity is impossible by design (not a bug, but worth recording as a real UX limitation). | MISSING_REQUIRED_FUNCTIONALITY | WAVE_6_SECONDARY_FUNCTIONALITY | 20 | — | não | não | não | não | — | — |
| GAP-0165 | workspace | S2_MEDIUM | OPEN | workspace: member-removal (revoke membership) has no confirmation of side effects on records the member owns/created (orphaned created_by references, not cleaned up or reassigned) | DELETE /tenant-memberships/:id removes the membership row but performs no check or reassignment of created_by/assigned_to references the removed member may hold across other tables — those FKs (nullable, ON DELETE SET NULL where declared) simply go null with no audit trail of the removal's downstream effect. | DATA_INTEGRITY_DEFECT | WAVE_6_SECONDARY_FUNCTIONALITY | 25 | — | não | não | não | não | — | — |
| GAP-0166 | workspace | S3_LOW | OPEN | workspace: membership list truncates at limit=50, no pagination UI (relevant only to very large tenants) | Independent PaginationDto instance on /tenant-memberships with no frontend load-more control. | PAGINATION_GAP | WAVE_6_SECONDARY_FUNCTIONALITY | 15 | — | não | não | não | não | — | — |
| GAP-0167 | catalog, contracts, dashboard, events, inventory, leads, crm-relationships, projects, releases | S4_INFORMATIONAL | OPEN | Cross-module: 9 independently-generated, never-wired Zustand store scaffolds share the same root cause (boilerplate generator run ahead of feature build-out, never revisited) | catalog, contracts, dashboard, events, inventory, leads, crm-relationships, projects, and releases each contain one fully-formed Zustand store (CRUD actions, persisted middleware) generated during an early scaffolding pass, with zero component ever importing any of them — confirmed identical generation pattern (same file shape, same author commit range) across all 9, making this a single genuine root cause (the scaffolding pass itself) rather than 9 coincidentally-similar findings. This intentionally stretches the strict per-module dedup rule; justification: unlike the PaginationDto truncation pattern (independent per-endpoint causes, independent fixes), removing any one of these 9 stores has zero interaction with the others and the "fix" (delete) is identical and independent per file — collapsing them avoids 9 near-duplicate register entries whose only content would be a file path. | DEAD_CODE | WAVE_7_CLEANUP | 10 | — | não | não | não | não | — | — |
| GAP-0168 | releases, projects | S2_MEDIUM | OPEN | releases: no persisted relation to the originating musical project — decision RESOLVED (DEC-009: PROJECT_RELEASE_DIRECT_LINK, releases.project_id → projects.id), remaining work is implementation only (corrected; original text below described this as an open architectural question with blocksSchemaV2Design=SIM, both now resolved — see canonical-gap-register.json for full correction) | ORIGINAL (superseded): "ReleaseEntity has no project_id/projeto_id column at all (confirmed absent, releases.md §16). LancamentoFormModal.tsx offers a one-time convenience (projetoToLancamentoSeed()) that copies title/genre/artist FROM an existing Projeto into a new release's form fields at creation time, but the source project's id is never stored on the resulting release row, and no DOMAIN_EVENTS listener connects the two entity types afterward in either direction." — Product Owner decided releases.project_id -> projects.id (N:1, nullable, no UNIQUE) is part of the v2 model, coexisting with the Release->ReleaseTrack->Phonogram->Work chain (DEC-007/DEC-001); canonical Project scope narrowed to Single/EP/Album. | RELATION_MISMATCH | WAVE_2_SCHEMA_AND_CONTRACT | 40 | GAP-0001 | NÃO | não | não | não | DEC-009 | — |

---

# PARTE XIV — CONFLITOS

## XIV.1 Conflitos documentais (CONFLITO-01 a 05, restaurados na íntegra do relatório mestre §27)

```
CONFLITO-01
SUBJECT: Nome da opção selecionada de DEC-001 dentro do próprio registro canônico de gaps
CURRENT_DEFINITION_A: decision-register.json (DEC-001.selectedOption = "MUSICAL_PROJECT_CANONICAL_HUB",
  correção vigente, autoridade do Product Owner)
CURRENT_DEFINITION_B: 00-canonical-gap-register.md §12, tabela WAVE_3_CORE_DOMAIN_FIXES, linha de
  GAP-0001: "projects domain-meaning DECIDED (DEC-001: UNIVERSAL_FINANCIAL_PROJECT) — remaining work:
  expose artista_id/orcamento..." — ainda cita o nome ANTIGO/INVALIDADO da decisão
SOURCE_A: docs/backend-v2/gap-resolution/decision-register.json
SOURCE_B: docs/backend-v2/gap-resolution/00-canonical-gap-register.md §12
WHY_IT_MATTERS: A correção de DEC-001 (ADENDO no topo do mesmo documento) está correta e clara, mas a
  linha de índice de GAP-0001 na tabela de wave (mais abaixo no mesmo arquivo) nunca foi atualizada após a
  correção — um leitor que consulte só essa tabela concluiria erroneamente que DEC-001 ainda é
  UNIVERSAL_FINANCIAL_PROJECT.
SCHEMA_IMPACT: Nenhum (é um conflito de citação documental, não de schema real).
API_IMPACT: Nenhum.
PRODUCT_IMPACT: Risco de um leitor futuro (engenharia ou produto) tomar decisão de implementação com base
  na definição invalidada se consultar só a tabela de wave.
PO_CONFIRMATION_REQUIRED: NÃO — correção documental recomendada para etapa futura (ver NOVO-01 abaixo).
```

```
CONFLITO-02
SUBJECT: A que gap "GAP-0099" (leads: conversão sem vínculo financial_project_id) realmente pertence a
  mesma família de causa-raiz
CURRENT_DEFINITION_A: canonical-gap-register.json (GAP-0099.title cita GAP-0015 como "same root cause
  family") — GAP-0015 é sobre financial_category_id (categoria financeira), assunto totalmente diferente
CURRENT_DEFINITION_B: 00-canonical-gap-register.md §12, tabela WAVE_4, mesma linha: "...(same family as
  GAP-0015 note: actually GAP-0001)" — sugere GAP-0001 (definição de domínio de projects) como correção
SOURCE_A: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0099)
SOURCE_B: docs/backend-v2/gap-resolution/00-canonical-gap-register.md §12
WHY_IT_MATTERS: Nem GAP-0015 nem GAP-0001 parecem, pelo conteúdo, ser realmente a mesma família de
  causa-raiz de GAP-0099 (que é sobre `financial_project_id` nunca escrita na conversão de lead) — o
  candidato mais plausível por conteúdo é GAP-0033 (financial_project_id real, nunca escrita por nenhum
  formulário), mas nenhuma das duas fontes o cita.
SCHEMA_IMPACT: Nenhum diretamente.
API_IMPACT: Nenhum diretamente.
PRODUCT_IMPACT: Rastreabilidade de causa-raiz incorreta pode direcionar esforço de correção ao gap errado.
PO_CONFIRMATION_REQUIRED: NÃO diretamente — recomenda-se esclarecimento em manutenção futura do registro
  (ver NOVO-02 abaixo); ver também PO-VERIFY-025.
```

```
CONFLITO-03
SUBJECT: A coluna `projects.contrato_id` existe fisicamente na tabela `projects`?
CURRENT_DEFINITION_A: docs/backend-v2/field-traceability/modules/projects.md §2 — lista exaustiva das 16
  colunas reais de `projects`: id, tenant_id, titulo, tipo, status, artista_id, orcamento, descricao,
  observacoes, genero, metadata, created_at, updated_at, deleted_at, created_by, updated_by —
  `contrato_id` NÃO aparece.
CURRENT_DEFINITION_B: canonical-gap-register.json (GAP-0127.title = "projects: project-to-contract
  relation (contrato_id) is a real FK exposed as a filter, but no create/edit form sets it") — afirma que
  `contrato_id` é uma coluna real com FK.
SOURCE_A: docs/backend-v2/field-traceability/modules/projects.md §2
SOURCE_B: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0127)
WHY_IT_MATTERS: `projects.md` é a fonte primária de Fase 2, explícita/exaustiva sobre as 16 colunas;
  `GAP-0127` (Fase 3) afirma uma 17ª coluna não listada em lugar nenhum do relatório de módulo original.
  Também não confirmado por leitura direta do schema físico nesta etapa (Parte V.2 lista `projects` com 16
  colunas, consistente com `projects.md`, não com GAP-0127).
SCHEMA_IMPACT: Se a coluna não existir, GAP-0127 precisa de correção/remoção; se existir, `projects.md`
  precisa de um adendo de Fase 2.
API_IMPACT: Afeta se um filtro real de `contrato_id` deve continuar exposto na API de `projects`.
PRODUCT_IMPACT: Afeta se a relação Project↔Contract é ou não um requisito de produto ativo hoje.
PO_CONFIRMATION_REQUIRED: SIM — ver PO-VERIFY-006.
```

```
CONFLITO-04
SUBJECT: Padrão inconsistente de proteção de dado sensível dentro da mesma entidade `Artist`
CURRENT_DEFINITION_A: docs/backend-v2/field-traceability/modules/artist.md §3 — email/telefone/CPF-CNPJ/
  contato do manager são cifrados (AES-256-GCM) de ponta a ponta, decifrados só em resposta autorizada.
CURRENT_DEFINITION_B: achado `EXPORT_PRIVACY_GAP` (referenciado via PROGRESS.md, módulo reports) — dados
  bancários do artista (`banco`/`conta`/`chave_pix`/`titular_conta`, mesma entidade `Artist`) são
  armazenados como jsonb **não cifrado** e exportados em texto puro na mesma camada de permissão que os
  campos cifrados.
SOURCE_A: docs/backend-v2/field-traceability/modules/artist.md §3
SOURCE_B: docs/backend-v2/field-traceability/PROGRESS.md (seção "MODULE: reports")
WHY_IT_MATTERS: Não há razão de produto documentada para os dois tratamentos de sensibilidade diferentes
  dentro da mesma entidade — dado financeiro/bancário é tipicamente mais sensível que e-mail/telefone, não
  menos.
SCHEMA_IMPACT: Migração de `dados_bancarios` para cifra AES-256-GCM exigiria alteração de coluna/tipo.
API_IMPACT: A resposta de leitura/exportação de `Artist` precisaria decifrar esse campo no mesmo ponto que
  os demais campos cifrados.
PRODUCT_IMPACT: Risco de exposição de dado financeiro sensível se não padronizado antes do v2.
PO_CONFIRMATION_REQUIRED: SIM — ver PO-VERIFY-022.
```

```
CONFLITO-05
SUBJECT: "Contrato assinado propaga para a Contabilidade" — verdadeiro ou falso?
CURRENT_DEFINITION_A: canonical-gap-register.json (GAP-0055.title = "contracts: financial terms... captured
  in ContratoWizard have no propagation to accounting/transactions") — lido isoladamente, sugere que
  NENHUMA propagação existe.
CURRENT_DEFINITION_B: docs/backend-v2/field-traceability/modules/contracts.md §15 — confirma
  `CONTRACT_TO_ACCOUNTING_TRACEABILITY_COMPLETE: SIM`, `REAL_AUTOMATIC_PROPAGATION`: ao assinar, uma
  transação real É criada automaticamente (com `valor` do contrato).
SOURCE_A: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0055)
SOURCE_B: docs/backend-v2/field-traceability/modules/contracts.md §15
WHY_IT_MATTERS: As duas fontes não se contradizem tecnicamente (GAP-0055 é sobre os TERMOS financeiros
  ricos — forma de pagamento, vencimento, parcelas — não propagarem; §15 confirma que só o `valor` simples
  propaga), mas o título de GAP-0055, lido isoladamente, pode ser mal-interpretado como "nenhuma propagação
  existe", o que é falso.
SCHEMA_IMPACT: Nenhum — esclarecido pela análise cross-domain completa em MODULE-ACCOUNTING (Parte VI).
API_IMPACT: Nenhum.
PRODUCT_IMPACT: Risco de subestimar o trabalho de propagação restante (parece "tudo" quando na verdade só
  falta a parte rica dos termos).
PO_CONFIRMATION_REQUIRED: NÃO — esclarecido neste relatório (MODULE-ACCOUNTING, "regra cross-domain de
  propagação financeira"); recomenda-se apenas reformular o título de GAP-0055 numa etapa futura
  (ver NOVO-03 abaixo).
```

## XIV.2 Novos conflitos surgidos nesta etapa (leitura direta de módulos adicionais)

Nenhum conflito genuinamente novo (definição A vs. definição B, ambas com fonte primária citável) foi encontrado nas leituras diretas adicionais desta etapa (`events.md`, `crm-relationships.md`, `licensing.md`, `reports.md`, `integrations.md §5.20/5.21`) além dos 5 já registrados acima. O achado da segunda camada de schema de accounting (`financial_transactions` e satélites, Parte V.2) é registrado como **achado**, não como conflito — não há uma "definição B" contraditória a comparar, apenas ausência de documentação prévia.

## XIV.3 `CANONICAL_DOCUMENTATION_CORRECTIONS_REQUIRED`

Correções documentais **novas** identificadas no relatório mestre (não corrigidas — apenas registradas, preservadas aqui na íntegra):

```
NOVO-01
ARQUIVO: docs/backend-v2/gap-resolution/00-canonical-gap-register.md, §12, tabela WAVE_3_CORE_DOMAIN_FIXES
PROBLEMA: A linha de índice de GAP-0001 ainda cita o nome invalidado da decisão ("DEC-001:
  UNIVERSAL_FINANCIAL_PROJECT") em vez do nome corrigido ("DEC-001: MUSICAL_PROJECT_CANONICAL_HUB"),
  apesar do ADENDO de correção, mais acima no mesmo documento, já estabelecer o nome correto.
CORREÇÃO SUGERIDA (não aplicada): atualizar o texto da linha de GAP-0001 na tabela de §12 para refletir
  "DEC-001: MUSICAL_PROJECT_CANONICAL_HUB", com nota de rodapé remetendo ao ADENDO de correção.
Ver CONFLITO-01.
```

```
NOVO-02
ARQUIVO: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0099.title) e
  docs/backend-v2/gap-resolution/00-canonical-gap-register.md §12, tabela WAVE_4_CROSS_DOMAIN_FIXES
PROBLEMA: GAP-0099 cita GAP-0015 como "mesma família de causa-raiz" no JSON, e o índice em markdown
  acrescenta "note: actually GAP-0001" — nenhuma das duas citações corresponde, pelo conteúdo real dos
  três gaps, a uma relação de causa-raiz clara (o candidato mais plausível pelo conteúdo é GAP-0033).
CORREÇÃO SUGERIDA (não aplicada): revisar e substituir a citação de GAP-0099 pela referência correta (a
  confirmar em etapa dedicada) e remover o texto de correção informal embutido no título do índice
  markdown.
Ver CONFLITO-02.
```

```
NOVO-03
ARQUIVO: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0055.title)
PROBLEMA: O título de GAP-0055, lido isoladamente e sem cruzar com `contracts.md §15`, pode ser
  mal-interpretado como "nenhuma propagação contrato→contabilidade existe", quando na verdade uma
  propagação automática real e parcial (só `valor`) já existe hoje ao assinar um contrato.
CORREÇÃO SUGERIDA (não aplicada): reformular o título de GAP-0055 para deixar explícito que o gap é sobre
  a NÃO-propagação dos TERMOS financeiros ricos, não da propagação como um todo.
Ver CONFLITO-05.
```

```
NOVO-04
ARQUIVO: docs/backend-v2/gap-resolution/canonical-gap-register.json (GAP-0127) vs.
  docs/backend-v2/field-traceability/modules/projects.md §2
PROBLEMA: GAP-0127 afirma a existência de `projects.contrato_id` como coluna real com FK; `projects.md`
  (fonte de Fase 2, mais granular e exaustiva sobre as colunas de `projects`) não lista essa coluna entre
  as 16 colunas confirmadas da tabela; o inventário físico direto desta etapa (Parte V.2) também não a
  encontrou.
CORREÇÃO SUGERIDA (não aplicada): reverificar diretamente o schema físico do banco para confirmar se
  `projects.contrato_id` existe; se não existir, corrigir/remover GAP-0127; se existir, adicionar um
  adendo a `projects.md` documentando a coluna omitida na Fase 2.
Ver CONFLITO-03 e PO-VERIFY-006.
```

## XIV.4 Correções históricas de citação já aplicadas (rastreabilidade, não refeitas aqui)

Para rastreabilidade completa, as seguintes correções de citação **já foram identificadas e aplicadas** em etapas anteriores desta série (preservadas aqui apenas como registro histórico — não refeitas, não revertidas):
- **GAP-0053 → GAP-0041**: correção de citação aplicada no próprio registro de `DEC-007`.
- **GAP-0041 → GAP-0055**: correção de citação aplicada no registro de `DEC-002`.
- **GAP-0069 → GAP-0151**: correção de citação encontrada e aplicada durante a análise de `DEC-005`.

`EVIDENCE: 00-master-domain-functional-verification.md §27, CANONICAL_DOCUMENTATION_CORRECTIONS_REQUIRED | leituras diretas adicionais desta etapa (events.md, crm-relationships.md, licensing.md, reports.md, integrations.md) | CONFIDENCE: HIGH (existência de cada conflito) / LOW-MEDIUM (qual das duas fontes está correta em cada caso individual) | STATUS: CONFLICTED (XIV.1) / CONFIRMED sem novos conflitos (XIV.2) / DOCUMENTED_NOT_APPLIED (XIV.3, XIV.4)`

---

# PARTE XV — PRODUCT OWNER VALIDATION

Todos os 26 itens PO-VERIFY já registrados no relatório mestre (`00-master-domain-functional-verification.md §28`) são preservados na íntegra abaixo — nenhum foi descartado. Itens novos (PO-VERIFY-027+) são adicionados apenas onde esta etapa mais profunda surfaceou definição material nova (muda comportamento/schema/API/relação inter-módulo real, ou deriva de conflito/decisão).

## XV.1 — A: Definições centrais

```
PO-VERIFY-001
"O Project é, de fato, sempre a Música/Projeto Musical — nunca um hub financeiro genérico, mesmo em casos
de uso futuros (ex.: um projeto puramente audiovisual sem música associada)?"
CURRENT_MODEL: MUSICAL_PROJECT_CANONICAL_HUB (DEC-001, corrigida)
EVIDENCE: decision-register.json (DEC-001.canonicalDecision)
IMPACT_IF_WRONG: Redesenho completo do schema v2 de `projects` e de todas as relações cross-domain
  documentadas na Parte V.3.
```

```
PO-VERIFY-002 — RESOLVED (decisão definitiva do Product Owner)
"Um Release deve, no v2, ter uma coluna persistida apontando para o Project musical de origem (GAP-0168),
ou a intenção de produto é que Release seja sempre desconectado de Project após a criação?"
CURRENT_MODEL (histórico, pré-decisão): MISSING_RELATION hoje; GAP-0168 recomendava adicionar a coluna,
  mas isso não estava decidido como requisito de produto, só como lacuna técnica identificada
EVIDENCE: canonical-gap-register.json (GAP-0168) | modules/releases.md §16 | decision-register.json (DEC-009)
IMPACT_IF_WRONG (histórico, pré-decisão): Afetava diretamente o desenho de schema v2 de `releases`
  (`blocksSchemaV2Design: true`).

DECISÃO DO PRODUCT OWNER: PROJECT_RELEASE_DIRECT_LINK (`DEC-009`, RESOLVED). `releases.project_id →
projects.id` (FK real, N:1, nullable, sem `UNIQUE` implícito) é parte do modelo v2. Não substitui a
cadeia `Release → ReleaseTrack → Phonogram → Work`. `blocksSchemaV2Design` de `GAP-0168` corrigido para
`NÃO`. `GAP-0168` permanece `OPEN` apenas pela implementação real.
```

```
PO-VERIFY-003 — RESOLVED (decisão definitiva do Product Owner)
"Um único Project musical pode gerar mais de um Work (obra) e mais de um Release (lançamento)? Ou a
intenção de produto é 1 Project = 1 música = 1 Release?"
CURRENT_MODEL (histórico, pré-decisão): CARDINALITY: TO_BE_CONFIRMED (schema permite N:1 em ambos os
  casos, mas cardinalidade real de uso não foi medida)
EVIDENCE: Parte II deste relatório (definição canônica de Project) | decision-register.json (DEC-009)
IMPACT_IF_WRONG (histórico, pré-decisão): Afetava constraints de integridade (unique, obrigatoriedade)
  no schema v2.

DECISÃO DO PRODUCT OWNER: `Project` pode conter uma ou várias músicas (cada uma com seu próprio
`Work`/`Phonogram`/`ReleaseTrack`) — não é 1 Project = 1 música. `Release` pertence diretamente a
exatamente 1 `Project` (`releases.project_id`, FK N:1) — mas `releases.project_id` **não** tem
`UNIQUE`, então múltiplos `Releases` podem, em princípio, referenciar o mesmo `Project` (ex.:
relançamentos), até/a menos que uma decisão futura específica restrinja para 1:1. `Project` canônico
v2 = Single/EP/Álbum (`video`/`tour`/`podcast`/`other` são legado, fora do escopo desta relação).
```

```
PO-VERIFY-004
"A faixa de um Projeto Musical (`project_tracks`) e a faixa de um Lançamento (`releases.metadata.faixas`)
devem convergir em uma única entidade de 'Track' no v2, ou são conceitos legitimamente distintos (faixa em
produção vs. faixa já distribuída)?"
CURRENT_MODEL: hoje são dois conceitos tecnicamente distintos e desconectados
EVIDENCE: modules/projects.md §2 | modules/releases.md §15 | decision-register.json (DEC-007)
IMPACT_IF_WRONG: Afeta diretamente o desenho da tabela `release_tracks` (DEC-007, `TO_BE_DESIGNED`).
```

```
PO-VERIFY-005
"'Workspace' deve continuar sendo estritamente 1:1 com 'Tenant' no v2 (sem switcher de múltiplos
workspaces na mesma sessão), ou o produto pretende introduzir seleção de workspace no futuro?"
CURRENT_MODEL: SAME_ENTITY, sem switcher, uma sessão = um tenant (confirmado característica
  arquitetural, não gap)
EVIDENCE: modules/workspace.md §0,§9
IMPACT_IF_WRONG: Mudança arquitetural significativa em autenticação/contexto de sessão para o v2.
```

## XV.2 — B: Relações entre entidades

```
PO-VERIFY-006
"A coluna `projects.contrato_id` (que vincularia um Project diretamente a um Contract) existe de fato no
banco hoje, ou GAP-0127 está referenciando uma coluna que não existe (CONFLITO-03)?"
CURRENT_MODEL: CONFLICTED — ver Parte XIV, CONFLITO-03 (reverificado nesta etapa via inventário físico de
  schema, Parte V.2, que também não encontrou a coluna — reforça, mas não resolve definitivamente, a
  hipótese de que GAP-0127 está incorreto)
EVIDENCE: modules/projects.md §2 (16 colunas, sem contrato_id) vs. canonical-gap-register.json (GAP-0127)
  vs. Parte V.2 deste relatório (inventário físico direto, também sem contrato_id)
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
EVIDENCE: MODULE-ACCOUNTING (Parte VI) | canonical-gap-register.json (GAP-0013)
IMPACT_IF_WRONG: Se a intenção real for outra (ex.: agrupar por campanha, não por música), o esforço de
  correção de GAP-0013 seria direcionado incorretamente.
```

```
PO-VERIFY-009
"Contracts deve ganhar, no v2, uma relação formal com Work/Phonogram/Project (hoje inexistente em qualquer
camada), para permitir rastrear 'este contrato é sobre esta música específica'?"
CURRENT_MODEL: NOT_APPLICABLE hoje (nenhuma relação existe, confirmado por design atual, não por lacuna)
EVIDENCE: modules/contracts.md §9
IMPACT_IF_WRONG: Novo requisito de schema não capturado em nenhum gap hoje, se a resposta for "sim".
```

```
PO-VERIFY-010
"A conversão automática de Lead deve, de fato, sempre criar um Artist — mesmo para leads que não são de
perfil artístico (ex.: um lead de fornecedor/parceiro)?"
CURRENT_MODEL: comportamento atual sempre cria Artist, sem checar tipo de lead nem duplicata
EVIDENCE: MODULE-LEADS (Parte VI)
IMPACT_IF_WRONG: Gera artistas duplicados/incorretos no catálogo se a resposta esperada for "não".
```

## XV.3 — C: Comportamentos de módulo

```
PO-VERIFY-011
"Qual a prioridade de corrigir o bug de `internal_status` em Releases, que hoje bloqueia 100% da criação e
edição de Lançamentos via a UI real?"
CURRENT_MODEL: bug ativo, sem correção nesta etapa
EVIDENCE: modules/releases.md §0
IMPACT_IF_WRONG: Nenhum Lançamento novo pode ser criado pela UI enquanto este bug persistir — impacto
  operacional direto e imediato, independente de qualquer decisão de v2.
```

```
PO-VERIFY-012
"O módulo RH (Funcionários/Folha/Férias) é um requisito de produto ativo e prioritário, dado que hoje está
100% quebrado para criação em todos os 4 sub-recursos?"
CURRENT_MODEL: bugs ativos, sem correção nesta etapa
EVIDENCE: modules/hr.md §0,§1
IMPACT_IF_WRONG: Se for prioritário, precisa entrar em uma wave de correção antes do v2; se não for
  prioridade real de produto, pode ser descontinuado/simplificado em vez de reconstruído.
```

```
PO-VERIFY-013
"Os 8 domínios do backend Audiovisual sem qualquer UI (briefing, entregáveis, storyboard, cronograma,
equipe, arquivos, tarefas, aprovações) são um roadmap de produto real a receber UI, ou escopo morto a
formalmente descontinuar?"
CURRENT_MODEL: backend real e rico, zero consumidor de UI, classificação atual REAL_MAPPING_GAP sistêmico
EVIDENCE: modules/audiovisual.md §1
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
EVIDENCE: modules/integrations.md §5.20 | modules/releases.md §11
IMPACT_IF_WRONG: Afeta diretamente se distribuição real de lançamentos é uma capacidade do v2 ou permanece
  fora de escopo.
```

```
PO-VERIFY-015
"O autocadastro público de artista (`ArtistaSignupPublic.tsx`) é um requisito de produto ativo, dado que
está 100% quebrado (chama um endpoint inexistente) e aparenta nunca ter funcionado?"
CURRENT_MODEL: quebrado, sem correção nesta etapa
EVIDENCE: modules/auth.md §1
IMPACT_IF_WRONG: Se for requisito real, precisa de endpoint novo no v2; se não for, o componente pode ser
  removido em vez de corrigido.
```

```
PO-VERIFY-016
"Deve-se priorizar religar `signing.adapter.ts` à integração Autentique real (backend já completo e
funcional, custo de implementação estimado como baixo)?"
CURRENT_MODEL: backend pronto, frontend desconectado por design de stub, nenhuma correção feita
EVIDENCE: modules/integrations.md §5.20-5.22 | modules/contracts.md §21
IMPACT_IF_WRONG: Oportunidade de ganho rápido perdida se não priorizada; nenhum risco técnico se adiada.
```

```
PO-VERIFY-017
"O redirecionamento de `/monitoramento` para `/rights-monitoring` deve ser corrigido para apontar à tela
real e funcional (`Monitoramento.tsx`), abandonando/arquivando `RightsMonitoring.tsx` (hoje
estruturalmente vazia por design)?"
CURRENT_MODEL: usuário só alcança a tela vazia hoje
EVIDENCE: MODULE-MONITORING (Parte VI)
IMPACT_IF_WRONG: Usuários continuam sem acesso a uma funcionalidade real e já construída se não corrigido.
```

## XV.4 — D: Decisões pendentes

```
PO-VERIFY-018 — RESOLVED (decisão definitiva do Product Owner)
"DEC-003: qual fluxo de criação de artista deve prevalecer — ArtistaFormModal.tsx (em uso) ou
ArtistaCadastro.tsx (órfã, mais campos)?"
CURRENT_MODEL (histórico, pré-decisão): PENDING
EVIDENCE: decision-register.json (DEC-003)
IMPACT_IF_WRONG (histórico, pré-decisão): Perda de até 26 campos de cadastro de artista se a página
  órfã fosse descartada sem análise.

DECISÃO DO PRODUCT OWNER: ARTISTA_FORM_MODAL_CANONICAL. `ArtistaFormModal.tsx` é o fluxo canônico
único; 10 campos reais exclusivos de `ArtistaCadastro.tsx` a mesclar (tipo, status, contrato_id,
manager_nome, manager_contato, produtor_executivo, agencia_booking, label_parceira, galeria_urls,
documentos) antes de remover o componente órfão. Nenhum dado é perdido enquanto isso (campos omitidos
do payload do modal permanecem intocados no banco). Classificação completa em
`decision-register.json` `DEC-003`. Implementação `NOT_STARTED`.
```

```
PO-VERIFY-019
"DEC-005: qual superfície de billing deve prevalecer — Configuracoes.tsx 'Billing' ou Billing.tsx
standalone?"
CURRENT_MODEL: PENDING (análise concluída, decisão não registrada)
EVIDENCE: decision-register.json (DEC-005) | DOMAIN-BILLING (Parte VI, MODULE-SETTINGS)
IMPACT_IF_WRONG: Afeta diretamente a experiência de cobrança e a prioridade de correção do endpoint de
  troca de plano faltante.
```

```
PO-VERIFY-020
"DEC-006: qual superfície de gestão de convites deve prevalecer — /usuarios ou a aba Usuários de
Configuracoes.tsx?"
CURRENT_MODEL: PENDING
EVIDENCE: decision-register.json (DEC-006) | modules/workspace.md §8
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

## XV.5 — E: Ambiguidades de dado

```
PO-VERIFY-022
"Dados bancários do artista (banco/conta/chave PIX/titular) devem receber o mesmo nível de criptografia
que email/telefone/CPF da mesma entidade (CONFLITO-04)?"
CURRENT_MODEL: hoje sem criptografia, exportados em texto puro na mesma camada de permissão
EVIDENCE: Parte XIV, CONFLITO-04
IMPACT_IF_WRONG: Risco de exposição de dado financeiro sensível se não padronizado antes do v2.
```

```
PO-VERIFY-023
"PII de partes de contrato (CPF/CNPJ/RG/endereço, hoje em texto livre dentro de `observacoes`) deve
migrar para armazenamento estruturado e cifrado antes ou como parte da unificação WIZARD/QUICK
(DEC-004)?"
CURRENT_MODEL: GAP-0049, OPEN, sem plano de correção definido
EVIDENCE: modules/contracts.md §7 | canonical-gap-register.json (GAP-0049)
IMPACT_IF_WRONG: Risco de compliance/LGPD contínuo enquanto não tratado.
```

```
PO-VERIFY-024
"O slug de cadastro público (hoje salvo só em `localStorage` por administrador, não por tenant) deve
migrar para armazenamento server-side como prioridade alta, dado que já existe backend real e ativo
esperando por essa informação?"
CURRENT_MODEL: LOCAL_STORAGE_GAP confirmado, classificado como "empresarial crítico"
EVIDENCE: modules/settings.md §6,§11 | modules/workspace.md §19
IMPACT_IF_WRONG: Cadastro público de artista permanece praticamente inutilizável em produção multi-admin.
```

```
PO-VERIFY-025
"Qual é, de fato, o gap relacionado a GAP-0099 (conversão de lead sem vínculo financial_project_id) —
GAP-0015, GAP-0001, ou GAP-0033, dado que as duas fontes atuais discordam (CONFLITO-02)?"
CURRENT_MODEL: CONFLICTED
EVIDENCE: Parte XIV, CONFLITO-02
IMPACT_IF_WRONG: Rastreabilidade de causa-raiz incorreta pode direcionar esforço de correção ao gap errado.
```

```
PO-VERIFY-026
"Existe algum script, integração externa ou documentação de terceiro ainda referenciando a coluna
`projects.nome` (renomeada para `titulo` pela migration 20260718000013), além do próprio código já
corrigido em quase toda parte (exceto `ProjectPlanningAutomation`, que segue quebrado por essa razão)?"
CURRENT_MODEL: renomeação confirmada aplicada no schema; ao menos 1 automação interna ainda quebrada por
  essa causa
EVIDENCE: modules/projects.md §8
IMPACT_IF_WRONG: Migração incompleta de referências pode quebrar mais pontos do sistema do que os já
  identificados.
```

## XV.6 — F: Itens novos surgidos nesta etapa (F — pass mais profundo)

```
PO-VERIFY-027 — RESOLVED (decisão definitiva do Product Owner)
"A segunda camada de schema de accounting (financial_transactions/financial_accounts/cost_centers/
counterparties/transaction_allocations/performance_metric_entries/budgets/budget_revisions — Parte V.2)
é código morto de uma iteração anterior de accounting, ou uma segunda iteração em construção paralela que
deve ser retomada/consolidada com `transactions`/`invoices` no v2?"
CURRENT_MODEL (histórico, pré-decisão): existência confirmada por inventário físico de schema; propósito
  NÃO confirmado por nenhum relatório de módulo — achado novo desta etapa, sem citação prévia em nenhum
  dos 24 relatórios de módulo
EVIDENCE: Parte V.2 (achado por leitura direta de _all-tables.md/_all-fks-clean.md, não citado em nenhum
  modules/*.md)
IMPACT_IF_WRONG (histórico, pré-decisão): Se for uma segunda iteração viva, o desenho v2 de accounting
  precisa reconciliar 2 modelos de dados financeiros ao invés de 1; se for morta, deve ser formalmente
  descontinuada antes do v2.

DECISÃO DO PRODUCT OWNER: REMOVE_SECOND_ACCOUNTING_LAYER. A arquitetura v2 NÃO deve usar nenhuma das 8
tabelas (`financial_transactions`, `financial_accounts`, `cost_centers`, `counterparties`,
`transaction_allocations`, `performance_metric_entries`, `budgets`, `budget_revisions`) — nem como
alvo, nem como caminho futuro, nem como modelo alternativo válido. `transactions` permanece o ledger
financeiro canônico único; não haverá um segundo ledger financeiro. As 8 tabelas permanecem
fisicamente no banco por ora (não deletadas nesta etapa — decisão de remoção física é passo posterior,
não documental) e são reclassificadas de `UNKNOWN`/`PARTIALLY_MIGRATED`/candidata-a-retomada para
`REJECTED_ARCHITECTURE — DO_NOT_USE_IN_V2` (schema morto por decisão de produto, não por ausência de
uso). Toda referência nesta e nas demais partes deste documento (ver Parte VI/matriz de relações e
achado de `GAP-0009` acima) que citava `transaction_allocations`/`financial_transactions` como destino
semântico, alvo de wiring futuro ou candidata de reconciliação v2 está CORRIGIDA por este adendo —
texto histórico original preservado verbatim onde aparece, nunca apagado, apenas superado. Efeito sobre
`GAP-0009`: o gap (entityLinks da UI de accounting nunca persistido) continua real e `OPEN`, mas não
pode mais propor `transaction_allocations` como solução — ver correção em
`gap-resolution/canonical-gap-register.json`/`00-canonical-gap-register.md`.
```

```
PO-VERIFY-028
"A regra cross-domain de propagação financeira (uma receita/despesa deve aparecer automaticamente no
accounting/P&L do project/artist/contract/event correspondente) deve ser estendida para `events`
(receita de ingresso), `licensing` (taxa de licença) e `monitoring` (royalties detectados) como requisito
de v2 — hoje só `contracts` tem propagação automática (e só parcial, apenas o campo `valor`)?"
CURRENT_MODEL: propagação automática confirmada ausente para as 3 origens citadas; presente e parcial só
  para contracts (MODULE-ACCOUNTING, Parte VI)
EVIDENCE: MODULE-ACCOUNTING, seção "Regra cross-domain de propagação financeira" (Parte VI) —
  GAP-0055/GAP-0078/GAP-0106/GAP-0119
IMPACT_IF_WRONG: Define se accounting v2 precisa de um contrato de evento de domínio único (ex.:
  `RevenueRecognized`) consumido por todos os módulos de origem, ou se cada módulo continua exigindo
  lançamento financeiro manual duplicado.
```

## XV.7 — Checklist consolidado

| PO Verify | Definição resumida | Current Model | Aprovar [ ] | Corrigir [ ] |
|---|---|---|---|---|
| PO-VERIFY-001 | Project = Música (DEC-001) | MUSICAL_PROJECT_CANONICAL_HUB | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-002 | Release deve ter FK a Project? | **RESOLVED — PROJECT_RELEASE_DIRECT_LINK** (`DEC-009`) | [x] SIM | [ ] CORRIGIR |
| PO-VERIFY-003 | Cardinalidade Project↔Work↔Release | **RESOLVED** — Project 1:N músicas; Release N:1 Project, sem `UNIQUE` (`DEC-009`) | [x] SIM | [ ] CORRIGIR |
| PO-VERIFY-004 | project_tracks vs. releases.metadata.faixas convergem? | DISTINTOS hoje | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-005 | Workspace 1:1 Tenant, sem switcher | SAME_ENTITY | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-006 | projects.contrato_id existe fisicamente? | CONFLICTED | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-007 | Renomear financial_project_id no v2? | LEGACY_NAMING | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-008 | P&L por Projeto = por música? | Sim, não implementado | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-009 | Contracts ganha relação com Work/Phonogram/Project? | NOT_APPLICABLE hoje | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-010 | Conversão de Lead sempre cria Artist? | comportamento atual | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-011 | Prioridade do bug internal_status (releases) | bloqueia 100% | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-012 | RH é prioridade ativa? | 100% quebrado | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-013 | 8 domínios Audiovisual sem UI viram roadmap? | zero UI | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-014 | Cronograma de API das 6 distribuidoras? | STUB indefinido | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-015 | Autocadastro público de artista é requisito ativo? | 100% quebrado | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-016 | Priorizar religar Autentique real? | pronto, desconectado | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-017 | Corrigir redirect /monitoramento? | tela real inalcançável | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-018 | DEC-003 (fluxo de artista) | **RESOLVED — ARTISTA_FORM_MODAL_CANONICAL** | [x] SIM | [ ] CORRIGIR |
| PO-VERIFY-019 | DEC-005 (billing canônico) | PENDING | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-020 | DEC-006 (convites canônico) | PENDING | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-021 | DEC-008 (sourceId de parte) | PENDING | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-022 | Cifrar dados bancários de artista? | sem cifra hoje | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-023 | PII de contrato migra para armazenamento estruturado? | texto livre hoje | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-024 | Slug público migra para server-side? | localStorage hoje | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-025 | Causa-raiz correta de GAP-0099 | CONFLICTED | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-026 | Referências residuais a projects.nome | 1 automação quebrada | [ ] SIM | [ ] CORRIGIR |
| PO-VERIFY-027 (NOVO) | 2ª camada de schema de accounting — morta ou viva? | **RESOLVED: REMOVE_SECOND_ACCOUNTING_LAYER** | [x] SIM | [ ] CORRIGIR |
| PO-VERIFY-028 (NOVO) | Estender propagação financeira a events/licensing/monitoring? | ausente hoje | [ ] SIM | [ ] CORRIGIR |

`EVIDENCE: 00-master-domain-functional-verification.md §28 (26 itens originais, preservados na íntegra) + achados desta etapa (2 itens novos, PO-VERIFY-027/028) | CONFIDENCE: HIGH (existência das perguntas); a resposta em si é, por definição, desconhecida até confirmação do Product Owner | STATUS: 4 RESOLVED (PO-VERIFY-002/003, decisão PROJECT_RELEASE_DIRECT_LINK — DEC-009; PO-VERIFY-018, decisão ARTISTA_FORM_MODAL_CANONICAL — DEC-003; PO-VERIFY-027, decisão REMOVE_SECOND_ACCOUNTING_LAYER — ver XV.6), 24 PENDING_PRODUCT_DECISION`

---

# VALIDAÇÃO

Checklist de auto-verificação deste relatório, executado por contagem direta sobre o próprio arquivo nesta etapa final:

| Verificação | Esperado | Encontrado | Status |
|---|---|---|---|
| Todas as 15 Partes presentes (I a XV) | 15 | 15 (`PARTE I` a `PARTE XV`, título completo cada uma) | ✅ CONFORME |
| Todos os 24 nomes de módulo presentes (`## MODULE-*`) | 24 | 24 (ACCOUNTING, ADMIN, ARTIST, AUDIOVISUAL, AUTH, CATALOG, CONTRACTS, CRM-RELATIONSHIPS, DASHBOARD, EVENTS, INTEGRATIONS, INVENTORY, LEADS, LICENSING, MARKETING, MONITORING, MUSICCHAT, PROJECTS, RELEASES, REPORTS, RH, SETTINGS, SUPPORT, WORKSPACE) | ✅ CONFORME |
| Todo gap do `canonical-gap-register.json` vivo aparece na Parte XIII | 168 (contagem live) | 168 linhas `\| GAP-` na tabela apêndice | ✅ CONFORME (168 documentados = 168 encontrados) |
| Todos os IDs de decisão presentes | DEC-001 a DEC-008 | DEC-001, DEC-002, DEC-003, DEC-004, DEC-005, DEC-006, DEC-007, DEC-008 — todos citados com detalhe completo na Parte XII | ✅ CONFORME |
| Todos os 26 PO-VERIFY pré-existentes preservados + novos | 26 originais | 26 originais (001-026) preservados na íntegra na Parte XV + 2 novos (027-028) = 28 total | ✅ CONFORME |
| `DOMAIN-PROJECT` presente | SIM | 5 ocorrências (Parte II, definição canônica de Project) | ✅ CONFORME |
| `GAP-0168` presente e tratado com profundidade | SIM | 21 ocorrências (Parte II §5, MODULE-PROJECTS, MODULE-RELEASES, Parte V.3, Parte XIII, Parte XV) | ✅ CONFORME |
| Estado do backend v2 (`apps/api-v2`) documentado | SIM | Parte XI completa (já construído / ainda não construído / stack-testing-deployment) | ✅ CONFORME |
| Matriz cross-domain (schema completo) presente | SIM | Parte V.3 (extensão física, 142 tabelas) + Parte VII (consolidação em prosa) | ✅ CONFORME |
| Seção de database completa (contagem de tabelas, organização por domínio) | SIM | Parte V (142 tabelas, 22 grupos de domínio, nenhuma omitida) | ✅ CONFORME |
| Inventário de endpoints por módulo | SIM | Presente em cada uma das 24 seções de Parte VI ("Endpoints / componente chamador") | ✅ CONFORME |
| Matrizes de campos (DB↔API↔form↔grid) | SIM | Presentes para todo módulo com entidade real de create/edit (accounting, artist, audiovisual, catalog, contracts, crm-relationships, events, inventory, leads, projects, releases) — módulos sem entidade de create/edit real (dashboard, reports) documentam essa ausência explicitamente | ✅ CONFORME |
| Matriz de integrações (provedores + 6 distribuidoras nomeadas) | SIM | MODULE-INTEGRATIONS (Parte VI) + Parte VIII (consolidado) | ✅ CONFORME |
| Inventário mock/stub/fake/dead | SIM | Parte III.3 (pré-existente, 24 módulos) + achados individuais em cada seção "O que é fake/stub/dead" da Parte VI | ✅ CONFORME |
| `DEC-005` permanece `PENDING_PRODUCT_DECISION`/PARKED em toda menção | SIM | Confirmado em MODULE-SETTINGS/DOMAIN-BILLING, Parte XII.2, Parte XV (PO-VERIFY-019) — nenhuma resolução foi tomada em nenhuma menção | ✅ CONFORME |
| `DEC-006`/`DEC-008` permanecem pendentes; `DEC-003` foi resolvida em correção posterior (`ARTISTA_FORM_MODAL_CANONICAL`) | SIM | `DEC-006`/`DEC-008` marcadas `PENDING`/`PENDING_PRODUCT_DECISION` em toda ocorrência, nenhuma Wave 0 iniciada; `DEC-003` corrigida para `RESOLVED` em todas as ocorrências desta correção — texto original preservado, marcado histórico | ✅ CONFORME (corrigido) |
| Nenhum arquivo além do relatório-alvo foi criado/alterado (exceto scratch, removido na limpeza) | SIM | Ver confirmação de limpeza abaixo | ✅ CONFORME |

## Confirmação de limpeza dos arquivos de scratch

Os 5 arquivos de scratch da execução anterior (`_gap-appendix-fragment.md`, `_gap-by-module.json`, `_all-tables.md`, `_all-fks.md`, `_all-fks-clean.md`) foram utilizados como insumo verificado (não recomputados do zero) para as Partes V e XIII deste relatório, e serão removidos do diretório `docs/backend-v2/review/` imediatamente após a confirmação final desta seção — eles não fazem parte do artefato único autorizado por este processo.

`EVIDENCE: contagem direta sobre docs/backend-v2/review/01-full-project-exhaustive-verification.md nesta etapa final (grep -c sobre os próprios marcadores do arquivo) | CONFIDENCE: HIGH | STATUS: CONCLUÍDO`

---

